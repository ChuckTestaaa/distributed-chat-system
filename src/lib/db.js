import pg from 'pg';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
});

/**
 * Execute a parameterised SQL query.
 * @param {string} text  SQL string with $1, $2, … placeholders
 * @param {any[]}  params  values bound to the placeholders
 * @returns {Promise<import('pg').QueryResult>}
 */
export function query(text, params) {
    return pool.query(text, params);
}

/**
 * Obtain a client from the pool for use inside a transaction.
 * Caller MUST call client.release() when done.
 */
export function getClient() {
    return pool.connect();
}

export default pool;
