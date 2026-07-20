// backend/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';

import { pool } from './services/db.js';
import { PostgreSqlSessionStore } from './PostgreSqlSessionStore.js';
import twoFactorService from './security/verif-2factory.js';

// Importa os routers protegidos
import colaboradoresRoutes from './routes/colaboradores.js';
import metricsRouter from './routes/metrics.js';
import adminRoutes from './routes/admin.js';
import userRouter from './routes/user.js';

const app = express();
const PORT = process.env.PORT || 3007;

// ---------- Trust proxy ----------
app.set('trust proxy', 1);

// ---------- CORS ----------
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3008'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// ---------- Body parsers ----------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ---------- Helmet ----------
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:3007'],
      fontSrc: ["'self'"],
    },
  },
}));

// ---------- Cookie Parser ----------
app.use(cookieParser());

// ---------- CSRF Double Submit Cookie ----------
// Não utiliza sessão – evita criar sessões vazias antes do login.
app.use((req, res, next) => {
  // Gera um token CSRF se ainda não existir
  if (!req.cookies?.['csrf-token']) {
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie('csrf-token', token, {
      httpOnly: false,    // o frontend precisa ler este cookie
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
    req.csrfToken = token;
  } else {
    req.csrfToken = req.cookies['csrf-token'];
  }
  next();
});

// Middleware de proteção CSRF para métodos que alteram estado
function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const cookieToken = req.cookies?.['csrf-token'];
  if (!token || !cookieToken || token !== cookieToken) {
    return res.status(403).json({ success: false, error: 'CSRF token inválido.' });
  }
  next();
}

// Rota para obter o token CSRF (apenas retorna o cookie existente)
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken });
});

// ---------- Sessão (somente após login) ----------
const sessionStore = new PostgreSqlSessionStore(pool);

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'chave-secreta-sessao',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
  },
}));

// ========== ROTAS PÚBLICAS ==========
app.get('/api/auth/ping', (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.status(401).json({ success: false, error: 'Não autenticado' });
  }
  res.json({ pong: true, time: new Date().toISOString() });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    const userResult = await pool.query(
      'SELECT e_mail, colaborador AS nome, e_mail AS email, equipe, grupo, status FROM madm.colaboradores WHERE e_mail = $1',
      [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }
    const user = userResult.rows[0];

    const twoFactorResult = await twoFactorService.sendCode(user.email, user.nome);
    if (!twoFactorResult.success) {
      return res.status(500).json({ success: false, error: twoFactorResult.error || 'Erro ao enviar código' });
    }

    req.session.cookie.maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    req.session.userId = user.e_mail;
    req.session.tempToken = twoFactorResult.tempToken;
    req.session.ip = req.ip;
    req.session.userAgent = req.headers['user-agent'];

    req.session.save((err) => {
      if (err) {
        console.error('Erro ao salvar sessão:', err);
        return res.status(500).json({ success: false, error: 'Erro interno' });
      }
      return res.json({ success: true, requiresTwoFactor: true, tempToken: twoFactorResult.tempToken });
    });
  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

app.post('/api/auth/verify-2fa', async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    const userId = req.session.userId;

    if (!userId || !tempToken) {
      return res.status(400).json({ success: false, error: 'Sessão inválida. Faça login novamente.' });
    }

    const verification = twoFactorService.verifyCode(userId, code);
    if (!verification.success) {
      return res.status(401).json({ success: false, error: verification.error });
    }

    delete req.session.tempToken;
    req.session.isAuthenticated = true;

    const userResult = await pool.query(
      'SELECT e_mail, colaborador AS nome, e_mail AS email, equipe, grupo, status FROM madm.colaboradores WHERE e_mail = $1',
      [userId]
    );
    const user = userResult.rows[0];

    req.session.save((err) => {
      if (err) return res.status(500).json({ success: false, error: 'Erro ao salvar sessão' });
      return res.json({ success: true, user });
    });
  } catch (error) {
    console.error('❌ Erro na verificação 2FA:', error);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

app.post('/api/auth/resend-code', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Sessão não encontrada' });

    const userResult = await pool.query(
      'SELECT e_mail AS email, colaborador AS nome FROM madm.colaboradores WHERE e_mail = $1',
      [userId]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    const user = userResult.rows[0];

    const result = await twoFactorService.resendCode(userId, user.email);
    if (result.success) {
      req.session.tempToken = result.tempToken;
      req.session.save(() => res.json({ success: true }));
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('❌ Erro ao reenviar código:', error);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  if (!req.session) {
    res.clearCookie('connect.sid');
    return res.json({ success: true });
  }
  req.session.destroy((err) => {
    if (err) console.error('Erro ao destruir sessão:', err);
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.isAuthenticated || !req.session.userId) {
    return res.status(401).json({ success: false, error: 'Não autenticado' });
  }
  pool.query(
    'SELECT e_mail, colaborador AS nome, e_mail AS email, equipe, grupo, status FROM madm.colaboradores WHERE e_mail = $1',
    [req.session.userId]
  ).then(result => {
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    res.json({ success: true, user: result.rows[0] });
  }).catch(error => {
    console.error('Erro ao obter usuário:', error);
    res.status(500).json({ success: false, error: 'Erro interno' });
  });
});

// ========== MIDDLEWARES DE PROTEÇÃO ==========
app.use(csrfProtection);
app.use((req, res, next) => {
  if (req.session.isAuthenticated) return next();
  return res.status(401).json({ success: false, error: 'Não autenticado' });
});

// ========== ROTAS PROTEGIDAS ==========
app.use('/api', colaboradoresRoutes);
app.use('/api/metrics', metricsRouter);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/ping', (req, res) => res.json({ pong: true }));

// Tratamento de erro
app.use((err, req, res, next) => {
  console.error('❌ Erro:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Erro interno' });
});

// ---------- Inicialização ----------
(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Conectado ao PostgreSQL');
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT} (${process.env.NODE_ENV || 'development'})`);
    });
  } catch (error) {
    console.error('❌ Erro ao conectar ao banco:', error);
    process.exit(1);
  }
})();

export { app, pool };