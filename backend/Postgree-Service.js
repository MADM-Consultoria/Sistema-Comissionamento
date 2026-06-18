// backend/Postgree-Service.js
import pkg from 'pg';
const { Pool } = pkg;

export class PostgresService {
  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';

    // Prioriza variáveis individuais (mais seguras)
    if (process.env.DB_HOST) {
      console.log('📦 Conectando via variáveis individuais');
      this.pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
      });
    } else if (process.env.DATABASE_URL) {
      console.log('📦 Conectando via DATABASE_URL');
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
      });
    } else {
      console.error('❌ Nenhuma configuração de banco encontrada!');
      throw new Error('Variáveis de banco não definidas');
    }

    this.pool.on('error', (err) => {
      console.error('❌ Erro no pool do PostgreSQL:', err);
    });
  }

  async connect() {
    try {
      const client = await this.pool.connect();
      client.release();
      console.log('✅ Conectado ao PostgreSQL com sucesso');
    } catch (error) {
      console.error('❌ Falha ao conectar ao PostgreSQL:', error);
      throw error;
    }
  }

  query(text, params) {
    return this.pool.query(text, params);
  }
}