import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    try {
        // Advisory lock so only one instance runs migrations at a time
        await client.query(`SELECT pg_advisory_lock(1)`);

        // Clean up old Prisma migrations table if present
        await client.query(`DROP TABLE IF EXISTS "_prisma_migrations"`);

        // Create migrations table if it doesn't exist (safe check)
        const tableCheck = await client.query(`
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = '_migrations'
        `);

        if (tableCheck.rows.length === 0) {
            await client.query(`
                CREATE TABLE _migrations (
                    name TEXT PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);

            // If old Prisma tables already exist, mark 001_init.sql as applied
            const prismaCheck = await client.query(`
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'users'
            `);

            if (prismaCheck.rows.length > 0) {
                console.log('  Detected existing schema from Prisma, marking 001_init.sql as applied');
                await client.query(
                    `INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`,
                    ['001_init.sql'],
                );
            }
        }

        const applied = await client.query(`SELECT name FROM _migrations ORDER BY name`);
        const appliedSet = new Set(applied.rows.map(r => r.name));

        const dir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

        for (const file of files) {
            if (appliedSet.has(file)) {
                console.log(`  skip  ${file} (already applied)`);
                continue;
            }

            const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
            console.log(`  apply ${file} ...`);

            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query(`INSERT INTO _migrations (name) VALUES ($1)`, [file]);
                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`  FAILED: ${err.message}`);
                process.exit(1);
            }
        }

        console.log('Migrations complete.');
    } finally {
        await client.query(`SELECT pg_advisory_unlock(1)`);
        client.release();
        await pool.end();
    }
}

migrate();
