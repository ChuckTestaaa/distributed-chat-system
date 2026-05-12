import { authMiddleware } from '../middleware/auth.js';
import {
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    getFriends,
    getPendingRequests,
} from '../services/friendshipService.js';
import { sendToUserCrossInstance } from '../sockets/index.js';

export function registerFriendRoutes(router) {
    // Send a friend request
    router.post('/api/friends/request', authMiddleware, async (req, res) => {
        try {
            const { userId } = req.body;
            if (!userId) return res.status(400).json({ error: 'userId is required' });

            const result = await sendFriendRequest(req.userId, userId);

            await sendToUserCrossInstance(userId, 'friend_request', {
                id: result.id,
                from: req.userId,
            });

            res.status(201).json({ message: 'Friend request sent', id: result.id });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    // Accept a friend request
    router.post('/api/friends/accept/:id', authMiddleware, async (req, res) => {
        try {
            const { requesterId } = await acceptFriendRequest(req.params.id, req.userId);

            await sendToUserCrossInstance(requesterId, 'friend_accepted', {
                by: req.userId,
            });
            await sendToUserCrossInstance(req.userId, 'friend_accepted', {
                by: requesterId,
            });

            res.json({ message: 'Friend request accepted' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    // Reject a friend request
    router.post('/api/friends/reject/:id', authMiddleware, async (req, res) => {
        try {
            await rejectFriendRequest(req.params.id, req.userId);
            res.json({ message: 'Friend request rejected' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    // List accepted friends
    router.get('/api/friends', authMiddleware, async (req, res) => {
        try {
            const friends = await getFriends(req.userId);
            res.json({ friends });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // List pending incoming requests
    router.get('/api/friends/pending', authMiddleware, async (req, res) => {
        try {
            const requests = await getPendingRequests(req.userId);
            res.json({ requests });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
