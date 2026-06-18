// backend/server.js
import 'dotenv/config';
import session from 'express-session';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import csrfLib from 'csrf';
import { PostgresService } from './Postgree-Service.js';

// Importação das rotas com log
import authRouter from './routes/auth.js';
console.log('🔍 authRouter carregado?', typeof authRouter, authRouter ? '✅' : '❌');

import colaboradoresRoutes from './routes/colaboradores.js';
import metricsRouter from './routes/metrics.js';
import adminRoutes from './routes/admin.js';
import { securityMiddleware } from './security/index.js';

const app = express();
const PORT = process.env.PORT || 3007;

// ---------- TRUST PROXY (Render) ----------
app.set('trust proxy', 1);

// ---------- CORS ----------
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3008'];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// ---------- SESSÃO ----------
const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

// ---------- BODY PARSERS ----------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ---------- SANITIZAÇÃO ----------
app.use(securityMiddleware);

// ---------- HELMET ----------
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

// ---------- CSRF ----------
const tokens = new csrfLib();
app.use((req, res, next) => {
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = tokens.secretSync();
  }
  req.csrfToken = () => tokens.create(req.session.csrfSecret);
  next();
});

// ---------- ROTAS PÚBLICAS (sem CSRF) ----------
app.use('/api/auth', authRouter);
app.get('/api/csrf-token', (req, res) => {
  const token = req.csrfToken();
  console.log('🔑 Token CSRF gerado:', token?.substring(0, 20) + '...');
  res.json({ csrfToken: token });
});

// ---------- MIDDLEWARE DE VERIFICAÇÃO CSRF (com retorno JSON) ----------
function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  if (!tokens.verify(req.session.csrfSecret, token || '')) {
    console.warn('❌ CSRF inválido');
    // RETORNA JSON EM VEZ DE RESPOSTA VAZIA
    return res.status(403).json({ success: false, error: 'CSRF token inválido. Recarregue a página e tente novamente.' });
  }
  next();
}
app.use(csrfProtection);

// ---------- ROTAS PROTEGIDAS ----------
app.use('/api', colaboradoresRoutes);
app.use('/api/metrics', metricsRouter);
app.use('/api/admin', adminRoutes);

// ========== ROTA PARA RECALCULAR HIERARQUIA ==========
app.post('/api/commission/recalculate-hierarchy', async (req, res) => {
  try {
    const db = dbService;
    const now = new Date();
    const dataReferencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const periodoRef = dataReferencia.substring(0, 7);
    console.log(`📅 Recalculando hierarquia para o mês atual: ${dataReferencia}`);

    const colaboradoresResult = await db.query(`
      SELECT e_mail, colaborador as name, equipe, grupo
      FROM madm.colaboradores
      WHERE periodo = $1
    `, [periodoRef]);
    const colaboradores = colaboradoresResult.rows;
    if (colaboradores.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum colaborador encontrado para o período atual' });
    }

    const metricsResult = await db.query(`
      SELECT email,
             peso_meta_assinados_diario, peso_meta_ganho_diario,
             peso_meta_assinados_semanal, peso_meta_ganho_semanal,
             peso_meta_assinados_mensal, peso_meta_ganho_mensal
      FROM app_comissionamento.metricas_assessores
      WHERE data_metrica = $1
    `, [dataReferencia]);
    const metricsMap = new Map();
    metricsResult.rows.forEach(m => metricsMap.set(m.email, m));

    const sumWeights = (listaEmails) => {
      let somaDiarioAss = 0, somaDiarioGan = 0;
      let somaSemanalAss = 0, somaSemanalGan = 0;
      let somaMensalAss = 0, somaMensalGan = 0;
      for (const email of listaEmails) {
        const m = metricsMap.get(email);
        if (m) {
          somaDiarioAss += Number(m.peso_meta_assinados_diario) || 0;
          somaDiarioGan += Number(m.peso_meta_ganho_diario) || 0;
          somaSemanalAss += Number(m.peso_meta_assinados_semanal) || 0;
          somaSemanalGan += Number(m.peso_meta_ganho_semanal) || 0;
          somaMensalAss += Number(m.peso_meta_assinados_mensal) || 0;
          somaMensalGan += Number(m.peso_meta_ganho_mensal) || 0;
        }
      }
      return { somaDiarioAss, somaDiarioGan, somaSemanalAss, somaSemanalGan, somaMensalAss, somaMensalGan };
    };

    const updateMetrics = async (email, soma, tipo) => {
      const { somaDiarioAss, somaDiarioGan, somaSemanalAss, somaSemanalGan, somaMensalAss, somaMensalGan } = soma;
      const existing = await db.query(
        `SELECT id_assessor FROM app_comissionamento.metricas_assessores WHERE email = $1 AND data_metrica = $2`,
        [email, dataReferencia]
      );
      if (existing.rows.length > 0) {
        await db.query(`
          UPDATE app_comissionamento.metricas_assessores
          SET peso_meta_assinados_diario = $1,
              peso_meta_ganho_diario = $2,
              peso_meta_assinados_semanal = $3,
              peso_meta_ganho_semanal = $4,
              peso_meta_assinados_mensal = $5,
              peso_meta_ganho_mensal = $6
          WHERE email = $7 AND data_metrica = $8
        `, [somaDiarioAss, somaDiarioGan, somaSemanalAss, somaSemanalGan, somaMensalAss, somaMensalGan, email, dataReferencia]);
      }
    };

    const supervisores = colaboradores.filter(c => c.grupo?.toLowerCase() === 'supervisor');
    const coordAdmins = colaboradores.filter(c => c.grupo?.toLowerCase() === 'coordenador');
    for (const sup of supervisores) {
      const membrosEquipe = colaboradores.filter(c => c.equipe === sup.equipe && c.e_mail !== sup.e_mail && c.grupo?.toLowerCase() !== 'supervisor');
      const emailsEquipe = membrosEquipe.map(c => c.e_mail);
      const soma = sumWeights(emailsEquipe);
      await updateMetrics(sup.e_mail, soma, 'Supervisor');
    }
    if (supervisores.length > 0) {
      const emailsSupervisores = supervisores.map(s => s.e_mail);
      const somaSupervisores = sumWeights(emailsSupervisores);
      for (const coord of coordAdmins) {
        await updateMetrics(coord.e_mail, somaSupervisores, 'Coordenador');
      }
    }
    res.json({ success: true, message: `Hierarquia recalculada com sucesso para ${dataReferencia}` });
  } catch (error) {
    console.error('❌ Erro ao recalcular hierarquia:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------- HEALTH CHECK E PING ----------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/ping', (req, res) => {
  res.json({ pong: true, time: new Date().toISOString() });
});

// ---------- FALLBACK 404 ----------
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ---------- MIDDLEWARE DE ERRO ----------
app.use((err, req, res, next) => {
  console.error('❌ Erro:', err);
  res.status(500).json({ success: false, error: 'Erro interno do servidor' });
});

// ---------- INICIALIZAÇÃO ----------
const dbService = new PostgresService();
async function startServer() {
  try {
    await dbService.connect();
    console.log('✅ Conectado ao PostgreSQL');
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT} (${process.env.NODE_ENV || 'development'})`);
    });
  } catch (error) {
    console.error('❌ Erro ao conectar ao banco:', error);
    process.exit(1);
  }
}
startServer();

export { app, dbService };