// backend/services/twoFactorService.js
import nodemailer from 'nodemailer';
import crypto from 'crypto';

class TwoFactorService {
    constructor() {
        this.codes = new Map();
        this.resetCodes = new Map();

        // ============================================================
        // 1. SendGrid 
        // ============================================================
        const sendgridApiKey = process.env.SENDGRID_API_KEY;
        if (sendgridApiKey) {
            this.sendgridApiKey = sendgridApiKey;
            this.useSendgrid = true;
            console.log('📧 [2FA] SendGrid configurado como serviço principal.');
        } else {
            this.useSendgrid = false;
            console.log('ℹ️ [2FA] SendGrid não configurado. Usando SMTP como fallback.');
        }

        // ============================================================
        // 2. SMTP (Gmail) – fallback
        // ============================================================
        const hasEmailConfig = process.env.EMAIL_USER && process.env.EMAIL_PASS;
        if (hasEmailConfig) {
            try {
                this.smtpTransporter = nodemailer.createTransport({
                    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                    port: parseInt(process.env.EMAIL_PORT) || 587,
                    secure: false,
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS,
                    },
                    tls: { rejectUnauthorized: false },
                    connectionTimeout: 10000,
                    greetingTimeout: 10000,
                    socketTimeout: 10000,
                    dns: { family: 4 },
                });
                console.log('📧 [2FA] SMTP configurado como fallback.');
            } catch (err) {
                console.warn('⚠️ [2FA] Erro ao configurar SMTP:', err.message);
                this.smtpTransporter = null;
            }
        } else {
            console.warn('⚠️ [2FA] SMTP não configurado (variáveis ausentes).');
            this.smtpTransporter = null;
        }

        setInterval(() => this.cleanupExpiredCodes(), 60000);
    }

    generateCode() {
        return crypto.randomInt(100000, 999999).toString();
    }

    // ============================================================
    // Envio via SendGrid (API HTTP)
    // ============================================================
    async sendViaSendgrid(to, subject, html, text = '') {
        const url = 'https://api.sendgrid.com/v3/mail/send';
        const fromEmail = process.env.EMAIL_USER || 'noreply@madmbrasil.com';

        const data = {
            personalizations: [{ to: [{ email: to }] }],
            from: { email: fromEmail, name: 'MADM Brasil' },
            subject: subject,
            content: [
                { type: 'text/plain', value: text || html.replace(/<[^>]+>/g, '') },
                { type: 'text/html', value: html },
            ],
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.sendgridApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SendGrid error ${response.status}: ${errorText}`);
        }
        return response;
    }

    // ============================================================
    // Envio principal (tenta SendGrid, depois SMTP, depois console)
    // ============================================================
    async sendEmail(to, subject, html, identifier = null) {
        // Tenta SendGrid primeiro
        if (this.useSendgrid) {
            try {
                await this.sendViaSendgrid(to, subject, html);
                console.log(`✅ [2FA] E-mail enviado via SendGrid para ${to}`);
                return { success: true, method: 'SendGrid' };
            } catch (err) {
                console.error(`❌ [2FA] SendGrid falhou: ${err.message}`);
                // Se SendGrid falhar, tenta SMTP
            }
        }

        // Tenta SMTP (Gmail)
        if (this.smtpTransporter) {
            try {
                await this.smtpTransporter.sendMail({
                    from: `"MADM System" <${process.env.EMAIL_USER}>`,
                    to,
                    subject,
                    html,
                });
                console.log(`✅ [2FA] E-mail enviado via SMTP para ${to}`);
                return { success: true, method: 'SMTP' };
            } catch (err) {
                console.error(`❌ [2FA] SMTP falhou: ${err.message}`);
            }
        }

        // Último recurso: log no console (apenas para não bloquear o login)
        console.log(`📧 [FALLBACK] E-mail não enviado. Código disponível nos logs.`);
        console.log(`🔑 Código: ${this.getLastCode(identifier)}`);
        return { success: true, method: 'console' };
    }

    // ============================================================
    // Métodos principais (sendCode, sendPasswordResetCode)
    // ============================================================
    async sendCode(to, identifier, subject = 'Seu código de verificação', templateFn = null) {
        const code = this.generateCode();
        const expires = Date.now() + 5 * 60 * 1000;
        this.codes.set(identifier, { code, expires, attempts: 0, lastCode: code });

        console.log(`🔑 [2FA] Código gerado para ${identifier}: ${code}`);

        const defaultHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #09175b;">🔐 Código de verificação</h2>
                <p>Seu código é:</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; background: #f4f4f4; padding: 16px; text-align: center; border-radius: 8px;">
                    ${code}
                </div>
                <p style="color: #666;">Este código expira em 5 minutos.</p>
                <hr style="margin: 20px 0;" />
                <p style="font-size: 12px; color: #999;">Se não solicitou, ignore.</p>
            </div>
        `;
        const html = templateFn ? templateFn(code) : defaultHtml;

        const result = await this.sendEmail(to, subject, html, identifier);
        return { success: result.success, code };
    }

    async sendPasswordResetCode(email, userId) {
        const code = this.generateCode();
        const expires = Date.now() + 5 * 60 * 1000;
        this.resetCodes.set(userId, { code, expires, attempts: 0, email });

        console.log(`🔑 [PASSWORD RESET] Código gerado para ${userId}: ${code}`);

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #09175b;">🔐 Recuperação de senha</h2>
                <p>Olá, ${userId}!</p>
                <p>Seu código de recuperação:</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; background: #f4f4f4; padding: 16px; text-align: center; border-radius: 8px;">
                    ${code}
                </div>
                <p style="color: #666;">Expira em 5 minutos.</p>
                <hr style="margin: 20px 0;" />
                <p style="font-size: 12px; color: #999;">Se não solicitou, ignore.</p>
            </div>
        `;

        const result = await this.sendEmail(email, '🔐 Código de recuperação de senha', html, userId);
        return { success: result.success };
    }

    // ============================================================
    // Verificações de código (inalteradas)
    // ============================================================
    verifyCode(identifier, code) {
        const stored = this.codes.get(identifier);
        if (!stored) return { success: false, error: 'Código não encontrado' };
        if (Date.now() > stored.expires) {
            this.codes.delete(identifier);
            return { success: false, error: 'Código expirado' };
        }
        stored.attempts++;
        if (stored.attempts > 3) {
            this.codes.delete(identifier);
            return { success: false, error: 'Muitas tentativas' };
        }
        if (stored.code !== code) {
            return { success: false, error: `Código inválido (tentativa ${stored.attempts}/3)` };
        }
        this.codes.delete(identifier);
        return { success: true };
    }

    async resendCode(identifier, email) {
        this.codes.delete(identifier);
        return await this.sendCode(email, identifier);
    }

    verifyPasswordResetCode(userId, code) {
        const stored = this.resetCodes.get(userId);
        if (!stored) return { success: false, error: 'Código não encontrado' };
        if (Date.now() > stored.expires) {
            this.resetCodes.delete(userId);
            return { success: false, error: 'Código expirado' };
        }
        stored.attempts++;
        if (stored.attempts > 3) {
            this.resetCodes.delete(userId);
            return { success: false, error: 'Muitas tentativas' };
        }
        if (stored.code !== code) {
            return { success: false, error: `Código inválido (tentativa ${stored.attempts}/3)` };
        }
        const resetToken = crypto.randomBytes(32).toString('hex');
        this.resetCodes.delete(userId);
        return { success: true, resetToken };
    }

    getLastCode(identifier) {
        const stored = this.codes.get(identifier);
        return stored ? stored.code : 'N/A';
    }

    cleanupExpiredCodes() {
        const now = Date.now();
        let removed = 0;
        for (const [key, data] of this.codes.entries()) {
            if (now > data.expires) { this.codes.delete(key); removed++; }
        }
        for (const [key, data] of this.resetCodes.entries()) {
            if (now > data.expires) { this.resetCodes.delete(key); removed++; }
        }
        if (removed > 0) console.log(`🧹 ${removed} códigos expirados removidos.`);
    }
}

export default new TwoFactorService();