import { query } from '../config/database.js';
import { v4 as uuid } from 'uuid';

/**
 * Send a friend request from requesterId to addresseeId.
 */
export const sendFriendRequest = async (requesterId, addresseeId) => {
    if (requesterId === addresseeId) throw new Error('Cannot send friend request to yourself');

    // Check the target user exists
    const userCheck = await query(`SELECT id FROM users WHERE id = $1`, [addresseeId]);
    if (userCheck.rows.length === 0) throw new Error('User not found');

    // Check for existing friendship in either direction
    const existing = await query(
        `SELECT id, status FROM friendships
         WHERE (requester_id = $1 AND addressee_id = $2)
            OR (requester_id = $2 AND addressee_id = $1)
         LIMIT 1`,
        [requesterId, addresseeId],
    );

    if (existing.rows.length > 0) {
        const { status } = existing.rows[0];
        if (status === 'ACCEPTED') throw new Error('Already friends');
        if (status === 'PENDING')  throw new Error('Friend request already pending');
        // If REJECTED, allow re-requesting by updating
        await query(
            `UPDATE friendships SET status = 'PENDING', requester_id = $1, addressee_id = $2, updated_at = NOW()
             WHERE id = $3`,
            [requesterId, addresseeId, existing.rows[0].id],
        );
        return { id: existing.rows[0].id };
    }

    const id = uuid();
    await query(
        `INSERT INTO friendships (id, requester_id, addressee_id) VALUES ($1, $2, $3)`,
        [id, requesterId, addresseeId],
    );

    return { id };
};

/**
 * Accept a pending friend request.
 */
export const acceptFriendRequest = async (friendshipId, userId) => {
    const result = await query(
        `UPDATE friendships
         SET status = 'ACCEPTED', updated_at = NOW()
         WHERE id = $1 AND addressee_id = $2 AND status = 'PENDING'
         RETURNING requester_id AS "requesterId"`,
        [friendshipId, userId],
    );

    if (result.rows.length === 0) throw new Error('Friend request not found or already handled');
    return result.rows[0];
};

/**
 * Reject a pending friend request.
 */
export const rejectFriendRequest = async (friendshipId, userId) => {
    const result = await query(
        `UPDATE friendships
         SET status = 'REJECTED', updated_at = NOW()
         WHERE id = $1 AND addressee_id = $2 AND status = 'PENDING'
         RETURNING id`,
        [friendshipId, userId],
    );

    if (result.rows.length === 0) throw new Error('Friend request not found or already handled');
};

/**
 * Get all accepted friends for a user.
 */
export const getFriends = async (userId) => {
    const result = await query(
        `SELECT
            f.id AS "friendshipId",
            CASE WHEN f.requester_id = $1 THEN u2.id ELSE u1.id END AS id,
            CASE WHEN f.requester_id = $1 THEN u2.username ELSE u1.username END AS username,
            CASE WHEN f.requester_id = $1 THEN u2.avatar_url ELSE u1.avatar_url END AS "avatarUrl"
         FROM friendships f
         JOIN users u1 ON u1.id = f.requester_id
         JOIN users u2 ON u2.id = f.addressee_id
         WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'ACCEPTED'
         ORDER BY f.updated_at DESC`,
        [userId],
    );
    return result.rows;
};

/**
 * Get pending friend requests received by a user.
 */
export const getPendingRequests = async (userId) => {
    const result = await query(
        `SELECT f.id, f.created_at AS "createdAt",
                u.id AS "requesterId", u.username AS "requesterUsername",
                u.avatar_url AS "requesterAvatar"
         FROM friendships f
         JOIN users u ON u.id = f.requester_id
         WHERE f.addressee_id = $1 AND f.status = 'PENDING'
         ORDER BY f.created_at DESC`,
        [userId],
    );
    return result.rows.map(r => ({
        id: r.id,
        createdAt: r.createdAt,
        requester: { id: r.requesterId, username: r.requesterUsername, avatarUrl: r.requesterAvatar },
    }));
};
