import { createRoom, getUserRooms, getRoomById, addMemberToRoom, getOrCreateDM } from '../services/roomService.js';
import { getMessages, isRoomMember } from '../services/messageService.js';
import { createInvite, redeemInvite } from '../services/inviteService.js';
import { authMiddleware } from '../middleware/auth.js';

export function registerRoomRoutes(router) {
    router.post('/api/rooms', authMiddleware, async (req, res) => {
        try {
            const { name, type = 'PRIVATE', memberIds = [] } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Room name is required' });
            }

            if (!['PRIVATE', 'GROUP'].includes(type)) {
                return res.status(400).json({ error: 'Type must be PRIVATE or GROUP' });
            }

            const room = await createRoom({
                name,
                type,
                createdById: req.userId,
                memberIds,
            });

            res.status(201).json(room);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    router.get('/api/rooms', authMiddleware, async (req, res) => {
        try {
            const rooms = await getUserRooms(req.userId);
            res.json({ rooms });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/api/rooms/dm', authMiddleware, async (req, res) => {
        try {
            const { friendId } = req.body;
            if (!friendId) return res.status(400).json({ error: 'friendId is required' });

            const room = await getOrCreateDM(req.userId, friendId);
            res.json({ roomId: room.id, room });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    router.get('/api/rooms/:id', authMiddleware, async (req, res) => {
        try {
            const room = await getRoomById(req.params.id, req.userId);
            res.json(room);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    });

    router.post('/api/rooms/:id/members', authMiddleware, async (req, res) => {
        try {
            const { userId } = req.body;

            if (!userId) {
                return res.status(400).json({ error: 'userId is required' });
            }

            const member = await addMemberToRoom(req.params.id, userId, req.userId);

            res.status(201).json({
                message: 'User added to room',
                member,
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    router.post('/api/rooms/:id/invite', authMiddleware, async (req, res) => {
        try {
            const code = await createInvite(req.params.id, req.userId);
            const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
            res.json({ code, url: `${origin}/join/${code}` });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    router.post('/api/rooms/join/:code', authMiddleware, async (req, res) => {
        try {
            const result = await redeemInvite(req.params.code, req.userId);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    router.get('/api/rooms/:id/messages', authMiddleware, async (req, res) => {
        try {
            const roomId = req.params.id;
            const limit = Math.min(parseInt(req.query.limit) || 50, 100);
            const before = req.query.before;

            const isMember = await isRoomMember(roomId, req.userId);
            if (!isMember) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const messages = await getMessages(roomId, { limit, before });

            res.json({
                messages,
                hasMore: messages.length === limit,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
