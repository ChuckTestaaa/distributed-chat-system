import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { v4 as uuid } from 'uuid';

const SALT_ROUNDS = 12;

export const registerUser = async ({ username, email, password }) => {
    // Check for existing user
    const existing = await query(
        `SELECT id, email, username FROM users WHERE email = $1 OR username = $2 LIMIT 1`,
        [email, username],
    );

    if (existing.rows.length > 0) {
        if (existing.rows[0].email === email) throw new Error('Email already registered');
        throw new Error('Username already taken');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const id = uuid();

    const result = await query(
        `INSERT INTO users (id, username, email, password_hash, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, username, email, avatar_url AS "avatarUrl", created_at AS "createdAt"`,
        [id, username, email, passwordHash],
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    return { token, user };
};

export const loginUser = async ({ email, password }) => {
    const result = await query(
        `SELECT id, username, email, password_hash, avatar_url AS "avatarUrl" FROM users WHERE email = $1`,
        [email],
    );

    const user = result.rows[0];
    if (!user) throw new Error('Invalid email or password');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new Error('Invalid email or password');

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    return {
        token,
        user: { id: user.id, username: user.username, email: user.email, avatarUrl: user.avatarUrl },
    };
};

export const getUserById = async (userId) => {
    const result = await query(
        `SELECT id, username, email, avatar_url AS "avatarUrl", created_at AS "createdAt"
         FROM users WHERE id = $1`,
        [userId],
    );

    if (result.rows.length === 0) throw new Error('User not found');
    return result.rows[0];
};
