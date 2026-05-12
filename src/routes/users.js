import { searchUsers, getUserById, updateProfile } from '../services/userService.js';
import { authMiddleware } from '../middleware/auth.js';

export function registerUserRoutes(router) {
    router.get('/api/users', authMiddleware, async (req, res) => {
        try {
            const search = req.query.search;

            if (!search || search.length < 2) {
                return res.status(400).json({ error: 'Search term must be at least 2 characters' });
            }

            const users = await searchUsers(search, req.userId);
            res.json({ users });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/api/users/:id', authMiddleware, async (req, res) => {
        try {
            const user = await getUserById(req.params.id);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json(user);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/api/users/profile', authMiddleware, async (req, res) => {
        try {
            const { avatarUrl, bio } = req.body;
            const updatedUser = await updateProfile(req.userId, avatarUrl, bio);
            
            if (!updatedUser) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json(updatedUser);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
