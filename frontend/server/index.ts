import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import session from 'express-session';
import cors from 'cors';

dotenv.config();

// ========== DECLARAÇÃO DE TIPOS ==========
declare global {
  namespace Express {
    interface Request {
      session: session.Session & Partial<session.SessionData>;
    }
  }
}

const app = express();
const PORT = process.env.PORT || 3007;

// ---------- TRUST PROXY ----------
app.set('trust proxy', 1);

// ---------- CORS ----------
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3008'];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// ---------- SESSÃO (com as any para evitar erro de tipo) ----------
const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}) as any); // <-- Correção aqui

// ---------- BODY PARSERS ----------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ---------- HEALTH CHECK ----------
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------- (OPCIONAL) ROTA DE TESTE ----------
app.get('/api/ping', (_req, res) => {
  res.json({ pong: true, time: new Date().toISOString() });
});

// ---------- SERVE FRONTEND (SPA) ----------
// __dirname = dist/ (onde está o index.js compilado)
const frontendPath = path.join(__dirname, 'public');
app.use(express.static(frontendPath));

// Fallback para SPA – todas as rotas não-API vão para index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ---------- MIDDLEWARE DE ERRO ----------
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('❌ Erro:', err);
  res.status(500).json({ success: false, error: err.message || 'Erro interno do servidor' });
});

// ---------- INICIALIZAÇÃO ----------
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

export { app };