// backend/security/verif-2factory.js
import nodemailer from 'nodemailer';

// Armazenamento temporário dos códigos (chave: email, valor: { code, expires })
const codeStore = new Map();

// Obtém as credenciais a partir das variáveis que JÁ estão no .env
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;

// Só cria o transporter se as credenciais estiverem preenchidas
const hasCredentials = emailUser && emailPass;

let transporter;
if (hasCredentials) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
}

/**
 * Gera um código numérico de 6 dígitos
 */
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Envia o código de verificação por e‑mail.
 * @param {string} email - E‑mail do destinatário
 * @param {string} userName - Nome do usuário (para personalizar a mensagem)
 * @returns {Promise<{success: boolean, tempToken?: string, error?: string}>}
 */
async function sendCode(email, userName) {
  const code = generateCode();
  const expires = Date.now() + 5 * 60 * 1000; // expira em 5 minutos

  // Armazena o código associado ao e‑mail
  codeStore.set(email, { code, expires });

  if (hasCredentials) {
    // Envio real do e‑mail
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"MADM Brasil" <${emailUser}>`,
        to: email,
        subject: 'Código de verificação - MADM Brasil',
        html: `<p>Olá ${userName || ''},</p>
               <p>Seu código de verificação é: <strong>${code}</strong></p>
               <p>Este código expira em 5 minutos.</p>`,
      });
      console.log(`✅ [2FA] E-mail enviado para ${email} com o código ${code}`);
    } catch (error) {
      console.error('❌ [2FA] Erro ao enviar e‑mail:', error);
      // Mesmo em caso de falha no envio, ainda retornamos sucesso
      // para não travar o fluxo – o código fica disponível no console para debug
      console.log(`⚠️  [2FA] Código para ${email}: ${code}`);
    }
  } else {
    // Sem credenciais, apenas exibe o código no terminal (modo desenvolvimento)
    console.log(`📧 [2FA] E-mail NÃO configurado. Código para ${email}: ${code}`);
  }

  // O tempToken usado na sessão é o próprio e‑mail
  return { success: true, tempToken: email };
}

/**
 * Verifica se o código informado é válido e não expirou.
 * @param {string} userId - identificador (e‑mail) do usuário
 * @param {string} code - código de 6 dígitos
 * @returns {{success: boolean, error?: string}}
 */
function verifyCode(userId, code) {
  const entry = codeStore.get(userId);
  if (!entry) {
    return { success: false, error: 'Nenhum código encontrado. Solicite um novo.' };
  }
  if (Date.now() > entry.expires) {
    codeStore.delete(userId);
    return { success: false, error: 'Código expirado. Solicite um novo.' };
  }
  if (entry.code !== code) {
    return { success: false, error: 'Código inválido.' };
  }
  // Código válido → remove do armazenamento
  codeStore.delete(userId);
  return { success: true };
}

/**
 * Reenvia um novo código (remove o anterior e gera outro).
 * @param {string} userId - identificador do usuário (e‑mail)
 * @param {string} email - e‑mail do usuário
 * @returns {Promise<{success: boolean, tempToken?: string, error?: string}>}
 */
async function resendCode(userId, email) {
  // Remove qualquer código anterior
  codeStore.delete(userId);
  // Envia um novo código
  return sendCode(email, '');
}

/**
 * Remove o código do usuário (utilizado no cancelamento/logout).
 * @param {string} userId
 */
function clearCode(userId) {
  codeStore.delete(userId);
}

/**
 * Método para parar um possível temporizador (mantido por compatibilidade).
 */
function stopTimer() {
  // Sem operação – o controle de expiração é feito no momento da verificação
}

export default { sendCode, verifyCode, resendCode, clearCode, stopTimer };