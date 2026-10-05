import 'dotenv/config';
import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true
});

pool.on('error', err => console.error('[pg] idle client error:', err.code || err.message));

export const q = (text, params) => pool.query(text, params).then(r => r.rows);