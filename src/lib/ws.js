import { WebSocketServer } from 'ws';
import { parse as parseUrl } from 'url';
import jwt from 'jsonwebtoken';

/**
 * Custom WebSocket server built on the `ws` library.
 *
 * Features:
 *  - JWT authentication during the HTTP upgrade handshake
 *  - JSON message protocol: { event, data }
 *  - Room management with join/leave/broadcast
 *  - Per-user socket tracking for multi-device support
 */
export class WsServer {
    constructor() {
        /** @type {WebSocketServer} */
        this.wss = null;

        /** Map<roomId, Set<WebSocket>> */
        this.rooms = new Map();

        /** Map<socketId, userId> */
        this.onlineUsers = new Map();

        /** Map<userId, Set<WebSocket>> */
        this.userSockets = new Map();

        /** Registered event handlers: Map<event, handler(ws, data)> */
        this.handlers = new Map();

        this._idCounter = 0;
    }

    /**
     * Attach to an existing http.Server instance.
     * Authenticates via the `token` query-string parameter during upgrade.
     */
    attach(httpServer, getUserByIdFn) {
        this.wss = new WebSocketServer({ noServer: true });
        this._getUserById = getUserByIdFn;

        httpServer.on('upgrade', async (req, socket, head) => {
            try {
                const { query } = parseUrl(req.url, true);
                const token = query.token;

                if (!token) {
                    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket.destroy();
                    return;
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await this._getUserById(decoded.userId);

                if (!user) {
                    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket.destroy();
                    return;
                }

                this.wss.handleUpgrade(req, socket, head, (ws) => {
                    ws.userId = decoded.userId;
                    ws.username = user.username;
                    ws.socketId = `ws_${++this._idCounter}`;
                    ws.joinedRooms = new Set();
                    this.wss.emit('connection', ws, req);
                });
            } catch {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
            }
        });

        this.wss.on('connection', (ws) => this._onConnection(ws));
    }

    /**
     * Register a handler for a named event.
     */
    on(event, handler) {
        this.handlers.set(event, handler);
    }

    // ── Connection lifecycle ──────────────────────────────────

    _onConnection(ws) {
        const { userId } = ws;

        this.onlineUsers.set(ws.socketId, userId);

        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId).add(ws);

        // Notify first-connection
        const isFirstConnection = this.userSockets.get(userId).size === 1;
        if (isFirstConnection) {
            this.broadcastAll('user_online', { userId }, ws);
        }

        // Fire the 'connection' handler if registered
        const connHandler = this.handlers.get('connection');
        if (connHandler) connHandler(ws);

        ws.on('message', (raw) => {
            try {
                const { event, data } = JSON.parse(raw.toString());
                const handler = this.handlers.get(event);
                if (handler) handler(ws, data);
            } catch { /* ignore malformed frames */ }
        });

        ws.on('close', () => this._onDisconnect(ws));
        ws.on('error', () => this._onDisconnect(ws));
    }

    _onDisconnect(ws) {
        const { userId } = ws;
        this.onlineUsers.delete(ws.socketId);

        // Leave all rooms
        for (const roomId of ws.joinedRooms) {
            const room = this.rooms.get(roomId);
            if (room) {
                room.delete(ws);
                if (room.size === 0) this.rooms.delete(roomId);
            }
        }

        if (this.userSockets.has(userId)) {
            this.userSockets.get(userId).delete(ws);

            if (this.userSockets.get(userId).size === 0) {
                this.userSockets.delete(userId);
                this.broadcastAll('user_offline', { userId });

                const handler = this.handlers.get('disconnect');
                if (handler) handler(ws);
            }
        }
    }

    // ── Room management ───────────────────────────────────────

    joinRoom(ws, roomId) {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
        }
        this.rooms.get(roomId).add(ws);
        ws.joinedRooms.add(roomId);
    }

    leaveRoom(ws, roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.delete(ws);
            if (room.size === 0) this.rooms.delete(roomId);
        }
        ws.joinedRooms.delete(roomId);
    }

    // ── Sending helpers ───────────────────────────────────────

    /** Send a JSON event to a single socket. */
    send(ws, event, data) {
        if (ws.readyState === 1 /* OPEN */) {
            ws.send(JSON.stringify({ event, data }));
        }
    }

    /** Broadcast to all sockets in a room. */
    broadcastRoom(roomId, event, data, excludeWs = null) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        const msg = JSON.stringify({ event, data });
        for (const ws of room) {
            if (ws !== excludeWs && ws.readyState === 1) {
                ws.send(msg);
            }
        }
    }

    /** Broadcast to all connected sockets. */
    broadcastAll(event, data, excludeWs = null) {
        const msg = JSON.stringify({ event, data });
        for (const client of this.wss.clients) {
            if (client !== excludeWs && client.readyState === 1) {
                client.send(msg);
            }
        }
    }

    /** Send to all sockets belonging to a specific user. */
    sendToUser(userId, event, data) {
        const sockets = this.userSockets.get(userId);
        if (!sockets) return;
        const msg = JSON.stringify({ event, data });
        for (const ws of sockets) {
            if (ws.readyState === 1) ws.send(msg);
        }
    }

    // ── Queries ───────────────────────────────────────────────

    getOnlineUserIds() {
        return [...this.userSockets.keys()];
    }

    isUserOnline(userId) {
        return this.userSockets.has(userId);
    }

    getUserSocketsList(userId) {
        const sockets = this.userSockets.get(userId);
        return sockets ? [...sockets] : [];
    }
}
