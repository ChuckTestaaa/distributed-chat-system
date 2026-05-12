import { registerUser, loginUser, getUserById } from '../services/authService.js';
import { authMiddleware } from '../middleware/auth.js';

export function registerAuthRoutes(router) {
    router.post('/api/auth/register', async (req, res) => {
        try {
            const { username, email, password } = req.body;

            if (!username || !email || !password) {
                return res.status(400).json({ error: 'Username, email, and password are required' });
            }

            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters' });
            }

            const result = await registerUser({ username, email, password });

            res.status(201).json({
                message: 'Account created successfully',
                token: result.token,
                user: result.user,
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    router.post('/api/auth/login', async (req, res) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }

            const result = await loginUser({ email, password });
            res.json(result);
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    });

    router.get('/api/auth/me', authMiddleware, async (req, res) => {
        try {
            const user = await getUserById(req.userId);
            res.json({ user });
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    });
}
