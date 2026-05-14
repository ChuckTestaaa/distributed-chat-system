import { query } from '../config/database.js';
import { v4 as uuid } from 'uuid';

export const createMessage = async ({ roomId, senderId, content, type = 'TEXT' }) => {
    const id = uuid();

    const result = await query(
        `INSERT INTO messages (id, room_id, sender_id, content, type)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, content, type, created_at AS "createdAt", room_id AS "roomId"`,
        [id, roomId, senderId, content, type],
    );

    const msg = result.rows[0];

    // Update last_message_at in rooms table for sorting
    await query(
        `UPDATE rooms SET last_message_at = $1 WHERE id = $2`,
        [msg.createdAt, roomId]
    );

    // Fetch sender info
    const senderResult = await query(
        `SELECT id, username, avatar_url AS "avatarUrl" FROM users WHERE id = $1`,
        [senderId],
    );

    return {
        id: msg.id,
        content: msg.content,
        type: msg.type,
        createdAt: msg.createdAt,
        roomId: msg.roomId,
        sender: senderResult.rows[0],
    };
};

export const getMessages = async (roomId, { limit = 50, before } = {}) => {
    let sql = `
        SELECT m.id, m.content, m.type, m.created_at AS "createdAt", m.room_id AS "roomId", m.reactions,
               u.id AS "senderId", u.username AS "senderUsername", u.avatar_url AS "senderAvatar"
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.room_id = $1
    `;
    const params = [roomId];

    if (before) {
        sql += ` AND m.created_at < $2`;
        params.push(new Date(before));
    }

    sql += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);

    // Return in chronological order (oldest first)
    return result.rows.reverse().map(row => ({
        id: row.id,
        content: row.content,
        type: row.type,
        createdAt: row.createdAt,
        roomId: row.roomId,
        reactions: row.reactions || {},
        sender: {
            id: row.senderId,
            username: row.senderUsername,
            avatarUrl: row.senderAvatar,
        },
    }));
};

/**
 * Fetch multiple messages by their IDs (for offline delivery).
 */
export const getMessagesByIds = async (messageIds) => {
    if (messageIds.length === 0) return [];

    const placeholders = messageIds.map((_, i) => `$${i + 1}`).join(', ');
    const result = await query(
        `SELECT m.id, m.content, m.type, m.created_at AS "createdAt", m.room_id AS "roomId", m.reactions,
                u.id AS "senderId", u.username AS "senderUsername", u.avatar_url AS "senderAvatar"
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.id IN (${placeholders})
         ORDER BY m.created_at ASC`,
        messageIds,
    );

    return result.rows.map(row => ({
        id: row.id,
        content: row.content,
        type: row.type,
        createdAt: row.createdAt,
        roomId: row.roomId,
        reactions: row.reactions || {},
        sender: {
            id: row.senderId,
            username: row.senderUsername,
            avatarUrl: row.senderAvatar,
        },
    }));
};

export const addReaction = async (messageId, emoji, userId) => {
    // We use JSONB operations to update the reactions object
    // If the emoji exists, we add the user if not present. If they already present, we toggle it (remove it).
    
    // First get current reactions
    const res = await query('SELECT reactions FROM messages WHERE id = $1', [messageId]);
    if (res.rows.length === 0) throw new Error('Message not found');
    
    let reactions = res.rows[0].reactions || {};
    let users = reactions[emoji] || [];
    
    if (users.includes(userId)) {
        // Remove reaction (toggle)
        users = users.filter(id => id !== userId);
    } else {
        // Add reaction
        users.push(userId);
    }
    
    if (users.length === 0) {
        delete reactions[emoji];
    } else {
        reactions[emoji] = users;
    }
    
    const updateRes = await query(
        'UPDATE messages SET reactions = $1 WHERE id = $2 RETURNING reactions',
        [JSON.stringify(reactions), messageId]
    );
    
    return updateRes.rows[0].reactions;
};

export const isRoomMember = async (roomId, userId) => {
    const result = await query(
        `SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 LIMIT 1`,
        [roomId, userId],
    );
    return result.rows.length > 0;
};


export async function deleteMessage(messageId) {
    await query('DELETE FROM messages WHERE id = $1', [messageId]);
}
