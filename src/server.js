import 'dotenv/config';
import { createServer } from 'http';
import { createClient } from 'redis';

import { Router } from './lib/router.js';
import { enhanceResponse } from './lib/response.js';
import { cors } from './lib/cors.js';
import { parseBody } from './lib/parseBody.js';

import { registerAuthRoutes } from './routes/auth.js';
import { registerUserRoutes } from './routes/users.js';
import { registerRoomRoutes } from './routes/rooms.js';
import { registerFriendRoutes } from './routes/friends.js';

import { initializeSocket, getOnlineUsers } from './sockets/index.js';
import { setRedisClient } from './lib/redisClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseUrl } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_PATH = path.join(__dirname, '../client/dist');

const PORT = process.env.PORT || 3000;

// ── Router setup ──────────────────────────────────────────────
const router = new Router();

// Static file serving for React frontend (production)
router.use('/', (req, res, next) => {
    const { pathname } = parseUrl(req.url);
    if (pathname.startsWith('/api') || pathname.startsWith('/ws')) return next();

    // Remove leading slash to join correctly with DIST_PATH
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    const filePath = path.join(DIST_PATH, relativePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.json': 'application/json',
            '.ico': 'image/x-icon'
        };
        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
    } else {
        // SPA Fallback: Serve index.html for all other non-API routes
        const indexFile = path.join(DIST_PATH, 'index.html');
        if (fs.existsSync(indexFile)) {
            res.setHeader('Content-Type', 'text/html');
            fs.createReadStream(indexFile).pipe(res);
        } else {
            console.error(`Static file not found: ${filePath}`);
            next();
        }
    }
});

router.use('/', cors, parseBody);

router.get('/', async (req, res) => {
    res.json({ message: 'Chat server is running!', timestamp: new Date().toISOString() });
});

router.get('/health', async (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        onlineUsers: getOnlineUsers().length,
    });
});

registerAuthRoutes(router);
registerUserRoutes(router);
registerRoomRoutes(router);
registerFriendRoutes(router);

// ── HTTP server ───────────────────────────────────────────────
const httpServer = createServer(async (req, res) => {
    enhanceResponse(res);
    
    // The router will handle static files via middleware.
    // If it handles a file, res.writableEnded or res.headersSent will be true.
    const matched = await router.handle(req, res);
    
    if (!matched && !res.writableEnded && !res.headersSent) {
        res.status(404).json({ error: 'Not found' });
    }
});

// ── Redis ─────────────────────────────────────────────────────
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 2000;

async function connectRedis(attempt = 1) {
    const pubClient = createClient({ url: REDIS_URL });
    const subClient = pubClient.duplicate();
    try {
        await Promise.all([pubClient.connect(), subClient.connect()]);
        console.log('Redis connected');
        setRedisClient(pubClient);
        await initializeSocket(httpServer, pubClient, subClient);
        console.log('WebSocket server initialised');
    } catch (err) {
        await pubClient.disconnect().catch(() => {});
        await subClient.disconnect().catch(() => {});
        if (attempt < MAX_RETRIES) {
            console.warn(`Redis connection attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${RETRY_DELAY_MS}ms...`);
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
            return connectRedis(attempt + 1);
        }
        console.error('Redis connection failed after all retries:', err);
        initializeSocket(httpServer, null, null);
    }
}

connectRedis();

// ── Start ─────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('WebSocket server ready for connections');
});
