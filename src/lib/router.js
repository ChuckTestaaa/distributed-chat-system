import { parse as parseUrl } from 'url';

/**
 * Lightweight router with Express-like API.
 * Supports path parameters (:id), middleware chains, and sub-mounting via use().
 */
export class Router {
    constructor() {
        this.routes = [];
        this.globalMiddleware = [];
    }

    /**
     * Register global middleware that runs on every request matching the prefix.
     * use(fn)            -> runs on all paths
     * use('/prefix', fn) -> runs on paths starting with /prefix
     */
    use(...args) {
        if (typeof args[0] === 'string') {
            const prefix = args[0];
            const handlers = args.slice(1);
            this.globalMiddleware.push({ prefix, handlers });
        } else {
            const handlers = args;
            this.globalMiddleware.push({ prefix: '/', handlers });
        }
    }

    get(path, ...handlers)    { this._add('GET',    path, handlers); }
    post(path, ...handlers)   { this._add('POST',   path, handlers); }
    put(path, ...handlers)    { this._add('PUT',    path, handlers); }
    delete(path, ...handlers) { this._add('DELETE', path, handlers); }
    patch(path, ...handlers)  { this._add('PATCH',  path, handlers); }

    _add(method, path, handlers) {
        const { regex, keys } = pathToRegex(path);
        this.routes.push({ method, path, regex, keys, handlers });
    }

    /**
     * Main request handler. Returns true if a route matched, false otherwise.
     */
    async handle(req, res) {
        const { pathname } = parseUrl(req.url, true);
        req.query = parseUrl(req.url, true).query || {};

        const matchingGlobal = [];
        for (const mw of this.globalMiddleware) {
            if (pathname.startsWith(mw.prefix)) {
                matchingGlobal.push(...mw.handlers);
            }
        }

        for (const route of this.routes) {
            if (route.method !== req.method) continue;

            const match = pathname.match(route.regex);
            if (!match) continue;

            req.params = {};
            route.keys.forEach((key, i) => {
                req.params[key] = match[i + 1];
            });

            const pipeline = [...matchingGlobal, ...route.handlers];
            await runMiddleware(pipeline, req, res);
            return true;
        }

        return false;
    }
}

/**
 * Convert an Express-style path (/rooms/:id/messages) into a RegExp
 * and extract parameter names.
 */
function pathToRegex(path) {
    const keys = [];
    const pattern = path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, key) => {
        keys.push(key);
        return '([^/]+)';
    });
    return { regex: new RegExp(`^${pattern}$`), keys };
}

/**
 * Execute an array of middleware/handler functions in sequence.
 * Each function receives (req, res, next). If next() is not called the
 * chain stops (the handler sent a response).
 */
function runMiddleware(fns, req, res) {
    return new Promise((resolve) => {
        let idx = 0;
        const next = (err) => {
            if (err) {
                res.status(500).json({ error: 'Internal server error' });
                resolve();
                return;
            }
            if (idx >= fns.length) {
                resolve();
                return;
            }
            const fn = fns[idx++];
            try {
                const result = fn(req, res, next);
                if (result && typeof result.catch === 'function') {
                    result.catch((e) => {
                        console.error(e);
                        if (!res.writableEnded) {
                            res.status(500).json({ error: 'Internal server error' });
                        }
                        resolve();
                    });
                }
            } catch (e) {
                console.error(e);
                if (!res.writableEnded) {
                    res.status(500).json({ error: 'Internal server error' });
                }
                resolve();
            }
        };
        next();
    });
}
