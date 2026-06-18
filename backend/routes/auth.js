// backend/routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import twoFactorService from '../services/twoFactorService.js';
import db from '../services/db.js';
import crypto from 'crypto';

const router = express.Router();
console.log('✅ [AUTH] Módulo de autenticação carregado com twoFactorService real');

// ============================================================
// ROTA DE TESTE (para diagnóstico)
// ============================================================
router.get('/test', (req, res) => {
  console.log('🔍 Rota /auth/test foi chamada');
  res.json({ success: true, message: 'Rota auth/test funcionando' });
});

// ============================================================
// FUNÇÃO AUXILIAR
// ============================================================
function getCurrentPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// ============================================================
// ROTA DE LOGIN
// ============================================================
router.post('/login', async (req, res) => {
  console.log('🔐 [LOGIN] Rota /login foi chamada');
  const { email, password } = req.body;
  const periodo = getCurrentPeriod();

  const gruposPermitidos = [
    'Elite', 'Supervisor', 'Análise de segurado', 'Concomitante',
    'Salesops', 'Quinquenio', 'Quinquênio ',
    'Coordenador', 'CEO', 'Diretoria'
  ];

  console.log(`🔐 Tentativa de login: email=${email}, periodo=${periodo}`);

  try {
    const result = await db.query(
      `SELECT 
          c.internal_id,
          c.id_crm,
          c.colaborador,
          a.email,
          a.senha_colaborador_hash,
          c.equipe,
          c.grupo,
          c.status,
          c.periodo
       FROM app_comissionamento.metricas_assessores a
           INNER JOIN madm.colaboradores c 
               ON LOWER(TRIM(a.email)) = LOWER(TRIM(c.e_mail))
       WHERE LOWER(TRIM(a.email)) = LOWER(TRIM($1))
         AND c.periodo = $2
         AND TRIM(c.grupo) = ANY($3)`,
      [email, periodo, gruposPermitidos]
    );

    const user = result.rows[0];
    if (!user) {
      console.log(`❌ Login falhou: usuário não encontrado para ${email} (período=${periodo})`);
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }

    console.log(`👤 Usuário encontrado: ${user.colaborador}, grupo="${user.grupo}", status=${user.status}`);

    // Verificação da senha
    const match = await bcrypt.compare(password, user.senha_colaborador_hash);
    if (!match) {
      console.log(`❌ Login falhou: senha incorreta para ${email}`);
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }

    // Dados temporários para o 2FA
    req.session.tempUser = {
      internal_id: user.internal_id,
      id_crm: user.id_crm,
      nome: user.colaborador,
      email: user.email,
      equipe: user.equipe,
      grupo: user.grupo,
      status: user.status,
      periodo: user.periodo
    };

    // Envia código 2FA
    const sendResult = await twoFactorService.sendCode(user.email, user.colaborador);
    if (!sendResult.success) {
      console.log(`❌ Falha ao enviar código 2FA: ${sendResult.error}`);
      return res.status(500).json({ success: false, error: sendResult.error });
    }

    console.log(`✅ Código 2FA enviado para ${email}`);
    return res.json({ success: true, requiresTwoFactor: true, tempToken: user.colaborador });
  } catch (err) {
    console.error('Erro em /login:', err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: 'Erro interno' });
    }
  }
});

// ============================================================
// VERIFICAÇÃO 2FA
// ============================================================
router.post('/verify-2fa', async (req, res) => {
  const { tempToken, code } = req.body;
  const verification = twoFactorService.verifyCode(tempToken, code);
  if (!verification.success) {
    return res.status(401).json({ success: false, error: verification.error });
  }
  const user = req.session.tempUser;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Sessão expirada' });
  }
  req.session.user = user;
  delete req.session.tempUser;
  const accessToken = crypto.randomBytes(32).toString('hex');

  req.session.save((err) => {
    if (err) {
      console.error('Erro ao salvar sessão no verify-2fa:', err);
      return res.status(500).json({ success: false, error: 'Erro interno' });
    }
    res.json({
      success: true,
      accessToken,
      user: {
        id: user.internal_id,
        name: user.nome,
        email: user.email,
        equipe: user.equipe,
        grupo: user.grupo,
        status: user.status,
        periodo: user.periodo
      }
    });
  });
});

// ============================================================
// REENVIO DE CÓDIGO 2FA
// ============================================================
router.post('/resend-code', async (req, res) => {
  const user = req.session.tempUser;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Sessão inválida' });
  }
  const sendResult = await twoFactorService.resendCode(user.nome, user.email);
  if (!sendResult.success) {
    return res.status(500).json({ success: false, error: sendResult.error });
  }
  res.json({ success: true });
});

// ============================================================
// LOGOUT
// ============================================================
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Erro ao destruir sessão:', err);
    res.json({ success: true });
  });
});

// ============================================================
// RECUPERAÇÃO DE SENHA – ENVIO DE CÓDIGO
// ============================================================
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'E-mail é obrigatório' });
  }

  const periodo = getCurrentPeriod();
  const gruposPermitidos = [
    'Elite', 'Supervisor', 'Análise de segurado', 'Concomitante',
    'Salesops', 'Quinquenio', 'Quinquênio ',
    'Coordenador', 'CEO', 'Diretoria'
  ];

  try {
    const result = await db.query(
      `SELECT 
          c.internal_id,
          c.colaborador,
          a.email
       FROM app_comissionamento.metricas_assessores a
           INNER JOIN madm.colaboradores c 
               ON LOWER(TRIM(a.email)) = LOWER(TRIM(c.e_mail))
       WHERE LOWER(TRIM(a.email)) = LOWER(TRIM($1))
         AND c.periodo = $2
         AND TRIM(c.grupo) = ANY($3)`,
      [email, periodo, gruposPermitidos]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'E-mail não encontrado ou sem permissão.' });
    }

    const user = result.rows[0];
    const userId = user.colaborador;
    const userEmail = user.email;

    const sendResult = await twoFactorService.sendPasswordResetCode(userEmail, userId);
    if (!sendResult.success) {
      return res.status(500).json({ success: false, error: sendResult.error });
    }

    req.session.resetEmail = email;
    req.session.resetName = userId;
    req.session.resetInternalId = user.internal_id;

    res.json({ success: true, message: 'Código de recuperação enviado para o e-mail.' });
  } catch (err) {
    console.error('Erro em forgot-password:', err);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// ============================================================
// RECUPERAÇÃO DE SENHA – VERIFICAÇÃO DO CÓDIGO
// ============================================================
router.post('/verify-reset-code', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ success: false, error: 'E-mail e código são obrigatórios' });
  }

  const resetName = req.session.resetName;
  const resetInternalId = req.session.resetInternalId;
  const storedEmail = req.session.resetEmail;

  if (!resetName || !resetInternalId || storedEmail !== email) {
    return res.status(400).json({ success: false, error: 'Sessão de recuperação inválida ou e-mail divergente.' });
  }

  try {
    const verification = twoFactorService.verifyPasswordResetCode(resetName, code);
    if (!verification.success) {
      return res.status(401).json({ success: false, error: verification.error });
    }

    req.session.resetToken = verification.resetToken;
    req.session.resetUserId = resetInternalId;

    req.session.save((err) => {
      if (err) {
        console.error('Erro ao salvar sessão:', err);
        return res.status(500).json({ success: false, error: 'Erro interno' });
      }
      res.json({ success: true, resetToken: verification.resetToken });
    });
  } catch (err) {
    console.error('Erro em verify-reset-code:', err);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

// ============================================================
// RECUPERAÇÃO DE SENHA – REDEFINIÇÃO
// ============================================================
router.post('/reset-password', async (req, res) => {
  const { resetToken, newPassword } = req.body;

  const userId = req.session.resetUserId;
  const storedToken = req.session.resetToken;

  if (!userId || !storedToken || storedToken !== resetToken) {
    return res.status(401).json({ success: false, error: 'Token inválido ou sessão expirada' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, error: 'A senha deve ter pelo menos 6 caracteres' });
  }

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    const updateResult = await db.query(
      `UPDATE app_comissionamento.metricas_assessores
       SET senha_colaborador_hash = $1,
           updated_at = NOW()
       WHERE id_assessor::integer = $2
       RETURNING id_assessor`,
      [hashedPassword, userId]
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Assessor não encontrado' });
    }

    delete req.session.resetToken;
    delete req.session.resetUserId;
    delete req.session.resetName;
    delete req.session.resetInternalId;
    delete req.session.resetEmail;

    req.session.save((err) => {
      if (err) console.error('Erro ao salvar sessão após reset:', err);
      res.json({ success: true, message: 'Senha redefinida com sucesso' });
    });
  } catch (err) {
    console.error('Erro em reset-password:', err);
    res.status(500).json({ success: false, error: 'Erro ao atualizar senha' });
  }
});

export default router;