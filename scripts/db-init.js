import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const schemaPath = fileURLToPath(new URL('../schema.sql', import.meta.url));
const sql = readFileSync(schemaPath, 'utf8');

try {
  await pool.query(sql);
  console.log('✅ Schema applied successfully');
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}