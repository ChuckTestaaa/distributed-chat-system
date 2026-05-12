import { query } from '../config/database.js';

export const searchUsers = async (searchTerm, currentUserId) => {
    const result = await query(
        `SELECT id, username, avatar_url AS "avatarUrl", bio
         FROM users
         WHERE id != $1
           AND (username ILIKE $2 OR email ILIKE $2)
         LIMIT 20`,
        [currentUserId, `%${searchTerm}%`],
    );
    return result.rows;
};

export const getUserById = async (userId) => {
    const result = await query(
        `SELECT id, username, email, avatar_url AS "avatarUrl", bio, created_at AS "createdAt"
         FROM users WHERE id = $1`,
        [userId],
    );
    return result.rows[0] || null;
};

export const updateProfile = async (userId, avatarUrl, bio) => {
    const result = await query(
        `UPDATE users
         SET avatar_url = $1, bio = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id, username, email, avatar_url AS "avatarUrl", bio, created_at AS "createdAt"`,
        [avatarUrl, bio, userId]
    );
    return result.rows[0];
};
