import nodemailer from 'nodemailer';
import crypto from 'crypto';

class TwoFactorService {
    constructor() {
        this.codes = new Map();
        this.resetCodes = new Map();
        this.pendingResets = new Map();

        // Configura o transporter apenas se as credenciais existirem
        const hasEmailConfig = process.env.EMAIL_USER && process.env.EMAIL_PASS;
        if (hasEmailConfig) {
            try {
                this.transporter = nodemailer.createTransport({
                    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                    port: parseInt(process.env.EMAIL_PORT) || 587,
                    secure: false,
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS,
                    },
                });
                console.log('📧 [2FA] Serviço de e-mail configurado.');
            } catch (err) {
                console.error('❌ [2FA] Erro ao criar transporter:', err.message);
                this.transporter = null;
            }
        } else {
            console.warn('⚠️ [2FA] Variáveis de e-mail não definidas. Modo simulação ativado.');
            this.transporter = null;
        }

        // Limpeza automática a cada minuto
        setInterval(() => this.cleanupExpiredCodes(), 60000);
    }

    generateCode() {
        return crypto.randomInt(100000, 999999).toString();
    }

    // ===== 2FA Login =====
    async sendCode(to, identifier, subject = 'Seu código de verificação', templateFn = null) {
        const code = this.generateCode();
        const expires = Date.now() + 5 * 60 * 1000;
        this.codes.set(identifier, { code, expires, attempts: 0 });

        console.log(`🔑 [2FA] Código gerado para ${identifier}: ${code}`);

        if (!this.transporter) {
            console.log(`📧 [SIMULAÇÃO] Código para ${to}: ${code}`);
            return { success: true, code };
        }

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

        try {
            await this.transporter.sendMail({
                from: `"MADM System" <${process.env.EMAIL_USER}>`,
                to,
                subject,
                html,
            });
            console.log(`✅ [2FA] Código enviado para ${to}`);
            return { success: true, code };
        } catch (error) {
            console.error('❌ [2FA] Erro ao enviar e-mail:', error.message);
            return { success: false, error: error.message };
        }
    }

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
            return { success: false, error: 'Muitas tentativas. Solicite novo código.' };
        }
        if (stored.code !== code) {
            return { success: false, error: `Código inválido. Tentativa ${stored.attempts}/3` };
        }
        this.codes.delete(identifier);
        return { success: true };
    }

    async resendCode(identifier, email) {
        this.codes.delete(identifier);
        return await this.sendCode(email, identifier);
    }

    // ===== Recuperação de senha =====
    async sendPasswordResetCode(email, userId) {
        const code = this.generateCode();
        const expires = Date.now() + 5 * 60 * 1000;
        this.resetCodes.set(userId, { code, expires, attempts: 0, email });

        console.log(`🔑 [PASSWORD RESET] Código gerado para ${userId}: ${code}`);

        if (!this.transporter) {
            console.log(`📧 [SIMULAÇÃO] Código de reset para ${email}: ${code}`);
            return { success: true };
        }

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

        try {
            await this.transporter.sendMail({
                from: `"MADM System" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: '🔐 Código de recuperação de senha',
                html,
            });
            console.log(`✅ [PASSWORD RESET] Código enviado para ${email}`);
            return { success: true };
        } catch (error) {
            console.error('❌ [PASSWORD RESET] Erro:', error.message);
            return { success: false, error: error.message };
        }
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
            return { success: false, error: `Código inválido. Tentativa ${stored.attempts}/3` };
        }
        const resetToken = crypto.randomBytes(32).toString('hex');
        this.resetCodes.delete(userId);
        return { success: true, resetToken };
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
        if (removed > 0) console.log(`🧹 ${removed} código(s) expirado(s) removido(s).`);
    }
}

export default new TwoFactorService();