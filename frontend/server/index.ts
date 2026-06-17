import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// ========== DECLARAÇÃO DE TIPOS PARA SESSÃO ==========
declare module 'express-session' {
  interface SessionData {
    user?: any;
  }
}

declare module 'express' {
  interface Request {
    session: session.Session & Partial<session.SessionData>;
  }
}

const app = express();
const PORT = process.env.PORT || 3007;

// ---------- VALIDAÇÃO DE VARIÁVEIS ----------
const requiredEnv = ['SESSION_SECRET', 'DATABASE_URL'];
const missing = requiredEnv.filter(key => !process.env[key]);
if (missing.length) {
  console.error(`❌ Variáveis obrigatórias faltando: ${missing.join(', ')}`);
  process.exit(1);
}

// ---------- TRUST PROXY ----------
app.set('trust proxy', 1);

// ---------- CORS ----------
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3008'];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}) as any); // <-- bypass tipo

// ---------- SESSÃO ----------
const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}) as any); // <-- bypass tipo

// ---------- BODY PARSERS ----------
app.use(express.json({ limit: '1mb' }) as any);
app.use(express.urlencoded({ extended: true, limit: '1mb' }) as any);

// ============================================================
// ROTAS DA API
// ============================================================

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Ping
app.get('/api/ping', (_req: Request, res: Response) => {
  res.json({ pong: true, time: new Date().toISOString() });
});

// CSRF token (simplificado)
app.get('/api/csrf-token', (_req: Request, res: Response) => {
  res.json({ csrfToken: 'disabled-for-now' });
});

// LOGIN (simulado)
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    console.log(`🔐 Tentativa de login: ${email}`);

    if (!email || !password) {
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }

    if (email.includes('test') && password === '123456') {
      req.session.user = {
        id: 1,
        name: 'Usuário Teste',
        email: email,
        equipe: 'Equipe Teste',
        grupo: 'Elite',
        status: 'ativo',
        periodo: '2026-06'
      };

      const accessToken = crypto.randomBytes(32).toString('hex');
      return res.json({
        success: true,
        accessToken,
        user: req.session.user
      });
    }

    return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
  } catch (err) {
    console.error('Erro em /login:', err);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

// Logout
app.post('/api/auth/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) console.error('Erro ao destruir sessão:', err);
    res.json({ success: true });
  });
});

// ============================================================
// SERVE FRONTEND (SPA)
// ============================================================
const frontendPath = path.join(__dirname, 'public');
console.log(`📁 Servindo frontend de: ${frontendPath}`);

app.use(express.static(frontendPath) as any);

// Fallback para SPA – todas as rotas não-API vão para index.html
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ---------- MIDDLEWARE DE ERRO ----------
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Erro:', err);
  res.status(500).json({ success: false, error: err.message || 'Erro interno do servidor' });
});

// ---------- INICIALIZAÇÃO ----------
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

export { app };