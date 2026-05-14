import { query, getClient } from '../config/database.js';
import { v4 as uuid } from 'uuid';

export const createRoom = async ({ name, type, createdById, memberIds }) => {
    const allMemberIds = [...new Set([createdById, ...memberIds])];
    const roomId = uuid();
    const client = await getClient();

    try {
        await client.query('BEGIN');

        await client.query(
            `INSERT INTO rooms (id, name, type, created_by_id, updated_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [roomId, name, type, createdById],
        );

        for (const userId of allMemberIds) {
            await client.query(
                `INSERT INTO room_members (id, user_id, room_id) VALUES ($1, $2, $3)`,
                [uuid(), userId, roomId],
            );
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    return getRoomByIdInternal(roomId);
};

export const getUserRooms = async (userId) => {
    const roomsResult = await query(
        `SELECT r.id, r.name, r.type, r.created_at AS "createdAt", r.last_message_at AS "lastMessageAt"
         FROM rooms r
         JOIN room_members rm ON rm.room_id = r.id
         WHERE rm.user_id = $1
         ORDER BY r.last_message_at DESC`,
        [userId],
    );

    const rooms = [];
    for (const room of roomsResult.rows) {
        const membersResult = await query(
            `SELECT u.id, u.username, u.avatar_url AS "avatarUrl"
             FROM users u
             JOIN room_members rm ON rm.user_id = u.id
             WHERE rm.room_id = $1`,
            [room.id],
        );

        const lastMsgResult = await query(
            `SELECT m.id, m.content, m.created_at AS "createdAt",
                    u.id AS "senderId", u.username AS "senderUsername"
             FROM messages m
             JOIN users u ON u.id = m.sender_id
             WHERE m.room_id = $1
             ORDER BY m.created_at DESC
             LIMIT 1`,
            [room.id],
        );

        const lastMsg = lastMsgResult.rows[0];

        rooms.push({
            id: room.id,
            name: room.name,
            type: room.type,
            createdAt: room.createdAt,
            members: membersResult.rows,
            lastMessage: lastMsg
                ? {
                    id: lastMsg.id,
                    content: lastMsg.content,
                    createdAt: lastMsg.createdAt,
                    sender: { id: lastMsg.senderId, username: lastMsg.senderUsername },
                }
                : null,
        });
    }

    return rooms;
};

export const getRoomById = async (roomId, userId) => {
    const result = await query(
        `SELECT r.id, r.name, r.type, r.created_at AS "createdAt"
         FROM rooms r
         JOIN room_members rm ON rm.room_id = r.id
         WHERE r.id = $1 AND rm.user_id = $2`,
        [roomId, userId],
    );

    if (result.rows.length === 0) throw new Error('Room not found or access denied');

    const room = result.rows[0];
    const membersResult = await query(
        `SELECT u.id, u.username, u.avatar_url AS "avatarUrl"
         FROM users u
         JOIN room_members rm ON rm.user_id = u.id
         WHERE rm.room_id = $1`,
        [roomId],
    );

    return {
        id: room.id,
        name: room.name,
        type: room.type,
        createdAt: room.createdAt,
        members: membersResult.rows,
    };
};

export const addMemberToRoom = async (roomId, userId, requesterId) => {
    const requester = await query(
        `SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 LIMIT 1`,
        [roomId, requesterId],
    );
    if (requester.rows.length === 0) throw new Error('You are not a member of this room');

    const existing = await query(
        `SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 LIMIT 1`,
        [roomId, userId],
    );
    if (existing.rows.length > 0) throw new Error('User is already a member of this room');

    const memberId = uuid();
    await query(
        `INSERT INTO room_members (id, user_id, room_id) VALUES ($1, $2, $3)`,
        [memberId, userId, roomId],
    );

    const userResult = await query(
        `SELECT id, username, avatar_url AS "avatarUrl" FROM users WHERE id = $1`,
        [userId],
    );

    return {
        id: userResult.rows[0].id,
        username: userResult.rows[0].username,
        avatarUrl: userResult.rows[0].avatarUrl,
    };
};

export const getOrCreateDM = async (userId, friendId) => {
    if (userId === friendId) throw new Error('Cannot DM yourself');

    const friendship = await query(
        `SELECT 1 FROM friendships
         WHERE status = 'ACCEPTED'
           AND ((requester_id = $1 AND addressee_id = $2)
             OR (requester_id = $2 AND addressee_id = $1))
         LIMIT 1`,
        [userId, friendId],
    );
    if (friendship.rows.length === 0) throw new Error('You are not friends with this user');

    const existing = await query(
        `SELECT r.id FROM rooms r
         JOIN room_members rm1 ON rm1.room_id = r.id AND rm1.user_id = $1
         JOIN room_members rm2 ON rm2.room_id = r.id AND rm2.user_id = $2
         WHERE r.type = 'PRIVATE'
           AND (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) = 2
         LIMIT 1`,
        [userId, friendId],
    );

    if (existing.rows.length > 0) {
        return getRoomById(existing.rows[0].id, userId);
    }

    const friendUser = await query(`SELECT username FROM users WHERE id = $1`, [friendId]);
    const currentUser = await query(`SELECT username FROM users WHERE id = $1`, [userId]);
    const roomName = `${currentUser.rows[0].username} & ${friendUser.rows[0].username}`;

    const room = await createRoom({
        name: roomName,
        type: 'PRIVATE',
        createdById: userId,
        memberIds: [friendId],
    });

    return room;
};

// Internal helper (no auth check)
async function getRoomByIdInternal(roomId) {
    const result = await query(
        `SELECT id, name, type, created_at AS "createdAt" FROM rooms WHERE id = $1`,
        [roomId],
    );
    const room = result.rows[0];

    const membersResult = await query(
        `SELECT u.id, u.username, u.avatar_url AS "avatarUrl"
         FROM users u
         JOIN room_members rm ON rm.user_id = u.id
         WHERE rm.room_id = $1`,
        [roomId],
    );

    return {
        id: room.id,
        name: room.name,
        type: room.type,
        createdAt: room.createdAt,
        members: membersResult.rows,
    };
}
