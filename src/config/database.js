// Re-export the pg pool as the default database interface.
// All service files import { query, getClient } from here.
export { query, getClient, default as pool } from '../lib/db.js';
