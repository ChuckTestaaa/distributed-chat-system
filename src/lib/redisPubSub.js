/**
 * Manual Redis Pub/Sub layer for cross-instance WebSocket message distribution.
 *
 * When a WebSocket event occurs on server-1 that needs to reach clients on
 * server-2, we PUBLISH the payload on a Redis channel. Every server instance
 * SUBSCRIBEs and forwards matching events to its local WebSocket clients.
 */

let pubClient = null;
let subClient = null;
let messageHandler = null;

/**
 * Initialise with connected Redis clients.
 * @param {import('redis').RedisClientType} pub  - client used for PUBLISH
 * @param {import('redis').RedisClientType} sub  - client used for SUBSCRIBE
 * @param {(channel: string, payload: object) => void} onMessage
 *        callback invoked when a message arrives on any subscribed channel
 */
export async function initPubSub(pub, sub, onMessage) {
    pubClient = pub;
    subClient = sub;
    messageHandler = onMessage;
}

const activeSubscriptions = new Set();

/**
 * Subscribe to a Redis channel (e.g. "room:<id>").
 */
export async function subscribe(channel) {
    if (!subClient) return;
    if (activeSubscriptions.has(channel)) return; // Already subscribed

    activeSubscriptions.add(channel);
    await subClient.subscribe(channel, (raw) => {
        try {
            const payload = JSON.parse(raw);
            if (messageHandler) messageHandler(channel, payload);
        } catch { /* ignore malformed messages */ }
    });
}

/**
 * Unsubscribe from a Redis channel.
 */
export async function unsubscribe(channel) {
    if (!subClient) return;
    if (!activeSubscriptions.has(channel)) return;

    activeSubscriptions.delete(channel);
    await subClient.unsubscribe(channel);
}

/**
 * Publish a JSON payload on a Redis channel.
 */
export async function publish(channel, payload) {
    if (!pubClient) return;
    await pubClient.publish(channel, JSON.stringify(payload));
}

// ── Offline message helpers (used in Phase 6) ─────────────────

/**
 * Queue a message ID for an offline user.
 */
export async function queueForOfflineUser(userId, messageId) {
    if (!pubClient) return;
    await pubClient.rPush(`pending:${userId}`, messageId);
}

/**
 * Retrieve (and clear) pending message IDs for a user.
 */
export async function getPendingMessages(userId) {
    if (!pubClient) return [];
    const ids = await pubClient.lRange(`pending:${userId}`, 0, -1);
    if (ids.length > 0) {
        await pubClient.del(`pending:${userId}`);
    }
    return ids;
}
