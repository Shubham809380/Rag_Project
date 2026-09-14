import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.DATABASE_URL || '';

// A lazy pool that never fatally crashes boot in local/air-gapped mode.
// Real queries will fail with a clear error when Postgres is absent.
const ssl = process.env.PG_SSL === 'false'
  ? false
  : { rejectUnauthorized: false };

const pool = url
  ? new pg.Pool({
      connectionString: url,
      ssl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    })
  : null;

if (!pool) {
  console.warn('[db] DATABASE_URL not set — Postgres is DISABLED (sovereign/local mode expects SQLite storage).');
}

// A tiny shim so server.on('error') listeners exist even without a pool.
if (pool) {
  pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err.message);
  });
}

// Always export a queryable object. Without Postgres, queries reject cleanly.
export default pool || {
  query: async () => {
    throw new Error('Postgres is not configured (DATABASE_URL missing). This must be resolved for the online domain.');
  },
};