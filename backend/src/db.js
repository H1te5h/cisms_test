import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Verify Database URL is set
if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL environment variable is missing. Database commands will fail.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export const query = (text, params) => pool.query(text, params);
export default pool;
