/**
 * Enhance the raw http.ServerResponse with convenience methods.
 * Call once per request before handing off to route handlers.
 */
export function enhanceResponse(res) {
    res.statusCode = 200;

    res.status = (code) => {
        res.statusCode = code;
        return res;
    };

    res.json = (data) => {
        const body = JSON.stringify(data);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', Buffer.byteLength(body));
        res.end(body);
    };

    return res;
}
