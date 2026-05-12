/**
 * Middleware that reads the request body and parses it as JSON.
 * Attaches the parsed object to req.body.
 */
export function parseBody(req, res, next) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
        req.body = {};
        return next();
    }

    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
        try {
            const raw = Buffer.concat(chunks).toString();
            req.body = raw.length > 0 ? JSON.parse(raw) : {};
            next();
        } catch {
            res.status(400).json({ error: 'Invalid JSON body' });
        }
    });
    req.on('error', () => {
        res.status(400).json({ error: 'Failed to read request body' });
    });
}
