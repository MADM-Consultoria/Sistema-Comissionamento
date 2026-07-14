// backend/security/verif-2factory.js
import nodemailer from 'nodemailer';

// Armazenamento temporário dos códigos (chave: email, valor: { code, expires })
const codeStore = new Map();

// SendGrid – funciona em qualquer ambiente (inclusive Render)
const sendgridApiKey = process.env.SENDGRID_API_KEY || null;

// Credenciais SMTP (fallback)
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
const hasSmtpCredentials = emailUser && emailPass;

let transporter;
if (hasSmtpCredentials) {
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
 * Estratégia: SendGrid → SMTP → console
 */
async function sendCode(email, userName) {
  const code = generateCode();
  const expires = Date.now() + 5 * 60 * 1000; // expira em 5 minutos
  codeStore.set(email, { code, expires });

  // 1. Tenta enviar via SendGrid (se configurado)
  if (sendgridApiKey) {
    try {
      await sendViaSendgrid(email, userName, code);
      console.log(`✅ [2FA] E-mail enviado via SendGrid para ${email}`);
      return { success: true, tempToken: email };
    } catch (err) {
      console.error(`❌ [2FA] SendGrid falhou: ${err.message}`);
      // Continua para o próximo método (SMTP ou console)
    }
  }

  // 2. Tenta enviar via SMTP (se configurado)
  if (hasSmtpCredentials) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"MADM Brasil" <${emailUser}>`,
        to: email,
        subject: 'Código de verificação - MADM Brasil',
        html: `<p>Olá ${userName || ''},</p>
               <p>Seu código de verificação é: <strong>${code}</strong></p>
               <p>Este código expira em 5 minutos.</p>`,
      });
      console.log(`✅ [2FA] E-mail enviado via SMTP para ${email}`);
      return { success: true, tempToken: email };
    } catch (err) {
      console.error(`❌ [2FA] SMTP falhou: ${err.message}`);
      // Continua para o console
    }
  }

  // 3. Fallback: exibe o código no console
  console.log(`📧 [2FA] Nenhum serviço de e‑mail disponível. Código para ${email}: ${code}`);
  return { success: true, tempToken: email };
}

/**
 * Envia e‑mail usando a API HTTP do SendGrid
 */
async function sendViaSendgrid(to, userName, code) {
  const url = 'https://api.sendgrid.com/v3/mail/send';
  const fromEmail = process.env.EMAIL_USER || 'noreply@madmbrasil.com';

  const data = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: fromEmail, name: 'MADM Brasil' },
    subject: 'Código de verificação - MADM Brasil',
    content: [
      {
        type: 'text/html',
        value: `<p>Olá ${userName || ''},</p>
               <p>Seu código de verificação é: <strong>${code}</strong></p>
               <p>Este código expira em 5 minutos.</p>`,
      },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sendgridApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SendGrid HTTP ${response.status}: ${errorText}`);
  }
}

/**
 * Verifica se o código informado é válido e não expirou.
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
  codeStore.delete(userId);
  return { success: true };
}

/**
 * Reenvia um novo código (remove o anterior e gera outro).
 */
async function resendCode(userId, email) {
  codeStore.delete(userId);
  return sendCode(email, '');
}

/**
 * Remove o código do usuário (utilizado no cancelamento/logout).
 */
function clearCode(userId) {
  codeStore.delete(userId);
}

/**
 * Método para parar um possível temporizador (mantido por compatibilidade).
 */
function stopTimer() {
  // Sem operação
}

export default { sendCode, verifyCode, resendCode, clearCode, stopTimer };