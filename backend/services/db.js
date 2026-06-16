// services/db.js
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const dbPassword = process.env.DB_PASSWORD || '';
if (typeof dbPassword !== 'string') {
    console.error('❌ DB_PASSWORD não é uma string:', typeof dbPassword);
    process.exit(1);
}

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: dbPassword,
    database: process.env.DB_NAME,
    ssl: false,
});

const query = (text, params) => pool.query(text, params);

export default { query, pool };