import crypto from 'crypto';
import { query } from '../config/database.js';
import { v4 as uuid } from 'uuid';
import { getRedisClient } from '../lib/redisClient.js';

const INVITE_TTL_SECONDS = 900; // 15 minutes

export async function createInvite(roomId, userId) {
    const membership = await query(
        `SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 LIMIT 1`,
        [roomId, userId],
    );
    if (membership.rows.length === 0) {
        throw new Error('You are not a member of this room');
    }

    const code = crypto.randomBytes(4).toString('hex');

    const redis = getRedisClient();
    if (!redis) throw new Error('Invite service unavailable');

    await redis.set(`invite:${code}`, roomId, { EX: INVITE_TTL_SECONDS });

    return code;
}

export async function redeemInvite(code, userId) {
    const redis = getRedisClient();
    if (!redis) throw new Error('Invite service unavailable');

    const roomId = await redis.get(`invite:${code}`);
    if (!roomId) throw new Error('Invite link is invalid or has expired');

    const room = await query(`SELECT id, name, type FROM rooms WHERE id = $1`, [roomId]);
    if (room.rows.length === 0) throw new Error('Room no longer exists');

    const existing = await query(
        `SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 LIMIT 1`,
        [roomId, userId],
    );
    if (existing.rows.length > 0) {
        return { alreadyMember: true, roomId };
    }

    const memberId = uuid();
    await query(
        `INSERT INTO room_members (id, user_id, room_id) VALUES ($1, $2, $3)`,
        [memberId, userId, roomId],
    );

    return { alreadyMember: false, roomId };
}
