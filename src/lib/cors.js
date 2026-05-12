/**
 * CORS middleware. Allows all origins for local-network / dev use.
 * Handles preflight OPTIONS requests automatically.
 */
export function cors(req, res, next) {
    // CORS is now handled by the Host Nginx for production stability.
    next();
}
