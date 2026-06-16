// backend/Postgree-Service.js
import pkg from 'pg';
const { Pool } = pkg;

export class PostgresService {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
  }
  async connect() {
    await this.pool.query('SELECT NOW()');
  }
  query(text, params) {
    return this.pool.query(text, params);
  }
}