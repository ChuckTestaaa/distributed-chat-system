import { WsServer } from '../lib/ws.js';
import { initPubSub, publish, subscribe, queueForOfflineUser, getPendingMessages } from '../lib/redisPubSub.js';
import { createMessage, isRoomMember, getMessagesByIds, addReaction } from '../services/messageService.js';
import { query } from '../config/database.js';

import crypto from 'crypto';

const wsServer = new WsServer();
const INSTANCE_ID = crypto.randomUUID();

/**
 * Initialise WebSocket server on the raw http.Server.
 */
export async function initializeSocket(httpServer, pubClient, subClient) {
    // Wire up Redis pub/sub for cross-instance delivery
    await initPubSub(pubClient, subClient, (channel, payload) => {
        // Ignore messages published by this very same instance
        if (payload.instanceId === INSTANCE_ID) return;

        // When we receive from Redis (from another instance), broadcast to local room sockets
        if (channel.startsWith('room:')) {
            const roomId = channel.slice(5);
            const room = wsServer.rooms.get(roomId);
            if (!room) return;
            const msg = JSON.stringify({ event: payload.event, data: payload.data });
            for (const ws of room) {
                if (ws.readyState === 1) ws.send(msg);
            }
        }

        if (channel === 'global') {
            wsServer.broadcastAll(payload.event, payload.data);
        }

        if (channel === 'user_event' && payload.targetUserId) {
            wsServer.sendToUser(payload.targetUserId, payload.event, payload.data);
        }
    });

    await subscribe('user_event');

    const getUserById = async (userId) => {
        const result = await query(
            `SELECT username FROM users WHERE id = $1`,
            [userId],
        );
        return result.rows[0] || null;
    };

    wsServer.attach(httpServer, getUserById);

    // ── Deliver pending offline messages on connect ─────────────

    wsServer.on('connection', async (ws) => {
        try {
            const pendingIds = await getPendingMessages(ws.userId);
            if (pendingIds.length > 0) {
                const messages = await getMessagesByIds(pendingIds);
                for (const msg of messages) {
                    wsServer.send(ws, 'offline_message', msg);
                }
                console.log(`Delivered ${messages.length} offline messages to ${ws.userId}`);
            }
        } catch (err) {
            console.error('Failed to deliver offline messages:', err);
        }
    });

    // ── Event handlers ────────────────────────────────────────

    wsServer.on('join_room', async (ws, data) => {
        const roomId = typeof data === 'string' ? data : data?.roomId;
        console.log(`[WS] ${ws.userId} joining room ${roomId}`);
        if (!roomId) {
            console.warn(`[WS] Missing roomId in join_room event from ${ws.userId}`);
            return;
        }

        wsServer.joinRoom(ws, roomId);

        // Subscribe this instance to the Redis channel for this room
        await subscribe(`room:${roomId}`);

        wsServer.broadcastRoom(roomId, 'user_joined', {
            userId: ws.userId,
            roomId,
        }, ws);
    });

    wsServer.on('leave_room', (ws, data) => {
        const roomId = typeof data === 'string' ? data : data?.roomId;
        if (!roomId) return;

        wsServer.leaveRoom(ws, roomId);

        wsServer.broadcastRoom(roomId, 'user_left', {
            userId: ws.userId,
            roomId,
        });
    });

    wsServer.on('typing', (ws, { roomId, isTyping }) => {
        wsServer.broadcastRoom(roomId, 'typing', {
            userId: ws.userId,
            username: ws.username,
            roomId,
            isTyping,
        }, ws);
    });

    wsServer.on('send_message', async (ws, { roomId, content, type = 'TEXT' }) => {
        console.log(`[WS] send_message from ${ws.userId} in room ${roomId}. Content: ${content}`);
        try {
            const isMember = await isRoomMember(roomId, ws.userId);
            if (!isMember) {
                console.warn(`[WS] ${ws.userId} is not a member of ${roomId}`);
                wsServer.send(ws, 'error', { message: 'You are not a member of this room' });
                return;
            }

            if (!content || content.trim().length === 0) {
                wsServer.send(ws, 'error', { message: 'Message content cannot be empty' });
                return;
            }

            const message = await createMessage({
                roomId,
                senderId: ws.userId,
                content: content.trim(),
                type,
            });

            // Broadcast to local sockets in this room
            wsServer.broadcastRoom(roomId, 'new_message', message);

            // Publish to Redis so other server instances deliver it too
            await publish(`room:${roomId}`, { event: 'new_message', data: message, instanceId: INSTANCE_ID });

            // Queue for offline room members
            const membersResult = await query(
                `SELECT user_id FROM room_members WHERE room_id = $1 AND user_id != $2`,
                [roomId, ws.userId],
            );
            for (const row of membersResult.rows) {
                if (!wsServer.isUserOnline(row.user_id)) {
                    await queueForOfflineUser(row.user_id, message.id);
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
            wsServer.send(ws, 'error', { message: 'Failed to send message' });
        }
    });

    wsServer.on('add_reaction', async (ws, { roomId, messageId, emoji }) => {
        try {
            const isMember = await isRoomMember(roomId, ws.userId);
            if (!isMember) return;

            const updatedReactions = await addReaction(messageId, emoji, ws.userId);
            
            const payload = { roomId, messageId, reactions: updatedReactions };
            
            // Broadcast to local room members
            wsServer.broadcastRoom(roomId, 'message_reaction_updated', payload);
            
            // Sync with other server instances
            await publish(`room:${roomId}`, { 
                event: 'message_reaction_updated', 
                data: payload, 
                instanceId: INSTANCE_ID 
            });
        } catch (error) {
            console.error('Error adding reaction:', error);
        }
    });

    // ── WebRTC signaling ──────────────────────────────────────

    wsServer.on('call_user', (ws, { to, offer }) => {
        const targets = wsServer.getUserSocketsList(to);
        if (targets.length === 0) {
            wsServer.send(ws, 'error', { message: 'User is not online' });
            return;
        }
        for (const t of targets) {
            wsServer.send(t, 'incoming_call', {
                from: ws.userId,
                username: ws.username,
                offer,
            });
        }
    });

    wsServer.on('answer_call', (ws, { to, answer }) => {
        for (const t of wsServer.getUserSocketsList(to)) {
            wsServer.send(t, 'call_accepted', { from: ws.userId, answer });
        }
    });

    wsServer.on('ice_candidate', (ws, { to, candidate }) => {
        for (const t of wsServer.getUserSocketsList(to)) {
            wsServer.send(t, 'ice_candidate', { from: ws.userId, candidate });
        }
    });

    wsServer.on('end_call', (ws, { to }) => {
        for (const t of wsServer.getUserSocketsList(to)) {
            wsServer.send(t, 'call_ended', { from: ws.userId });
        }
    });
}

/**
 * Send an event to a specific user across all server instances.
 * Delivers locally and publishes via Redis for other instances.
 */
export async function sendToUserCrossInstance(userId, event, data) {
    wsServer.sendToUser(userId, event, data);
    await publish(`user_event`, { event, data, targetUserId: userId, instanceId: INSTANCE_ID });
}

export const getOnlineUsers = () => wsServer.getOnlineUserIds();
export const isUserOnline = (userId) => wsServer.isUserOnline(userId);
export const getUserSockets = (userId) => wsServer.getUserSocketsList(userId);
export { wsServer };
