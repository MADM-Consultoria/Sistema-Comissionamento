// services/twoFactorService.js
import nodemailer from 'nodemailer';
import crypto from 'crypto';

class TwoFactorService {
    constructor() {
        // Códigos para 2FA (login)
        this.codes = new Map();
        // Códigos para recuperação de senha
        this.resetCodes = new Map();

        this.pendingResets = new Map();

        // Configuração do transporte de e-mail (usando variáveis de ambiente)
        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.EMAIL_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // Limpeza automática a cada minuto (remove códigos expirados)
        setInterval(() => this.cleanupExpiredCodes(), 60000);
    }

    /**
     * Gera um código aleatório de 6 dígitos
     */
    generateCode() {
        return crypto.randomInt(100000, 999999).toString();
    }

    // ========== MÉTODOS PARA 2FA (login) ==========

    /**
     * Envia código 2FA por e-mail
     */
    async sendCode(to, identifier, subject = 'Seu código de verificação', templateFn = null) {
        const code = this.generateCode();
        const expires = Date.now() + 5 * 60 * 1000; // 5 minutos
        this.codes.set(identifier, { code, expires, attempts: 0 });

        // Log para depuração (exibe o código no terminal do servidor)
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
                <p style="font-size: 12px; color: #999;">Se você não solicitou este código, ignore este e-mail.</p>
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
            console.log(`✅ Código 2FA enviado para ${to} (${identifier})`);
            return { success: true, code };
        } catch (error) {
            console.error('❌ Erro ao enviar e-mail 2FA:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verifica código 2FA
     */
    verifyCode(identifier, code) {
        const stored = this.codes.get(identifier);
        if (!stored) {
            return { success: false, error: 'Código não encontrado ou já utilizado' };
        }
        if (Date.now() > stored.expires) {
            this.codes.delete(identifier);
            return { success: false, error: 'Código expirado' };
        }
        stored.attempts++;
        this.codes.set(identifier, stored);

        if (stored.attempts > 3) {
            this.codes.delete(identifier);
            return { success: false, error: 'Muitas tentativas. Solicite um novo código.' };
        }

        if (stored.code !== code) {
            return { success: false, error: `Código inválido. Tentativa ${stored.attempts}/3` };
        }

        this.codes.delete(identifier);
        return { success: true };
    }

    /**
     * Reenvia código 2FA
     */
    async resendCode(identifier, email) {
        this.codes.delete(identifier);
        return await this.sendCode(email, identifier);
    }

    // ========== MÉTODOS PARA RECUPERAÇÃO DE SENHA ==========

    /**
     * Envia código de recuperação de senha
     */
    async sendPasswordResetCode(email, userId) {
        const code = this.generateCode();
        const expires = Date.now() + 5 * 60 * 1000; // 5 minutos
        this.resetCodes.set(userId, { code, expires, attempts: 0, email });

        // Log para depuração (exibe o código no terminal do servidor)
        console.log(`🔑 [PASSWORD RESET] Código gerado para ${userId}: ${code}`);

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #09175b;">🔐 Recuperação de senha</h2>
                <p>Olá, ${userId}!</p>
                <p>Seu código de recuperação é:</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; background: #f4f4f4; padding: 16px; text-align: center; border-radius: 8px;">
                    ${code}
                </div>
                <p style="color: #666;">Este código expira em 5 minutos.</p>
                <hr style="margin: 20px 0;" />
                <p style="font-size: 12px; color: #999;">Se você não solicitou a recuperação, ignore este e-mail.</p>
            </div>
        `;

        try {
            await this.transporter.sendMail({
                from: `"MADM System" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: '🔐 Código de recuperação de senha',
                html,
            });
            console.log(`✅ Código de recuperação enviado para ${email} (${userId})`);
            return { success: true };
        } catch (error) {
            console.error('❌ Erro ao enviar e-mail de recuperação:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verifica código de recuperação de senha e retorna um token de redefinição
     */
    verifyPasswordResetCode(userId, code) {
        const stored = this.resetCodes.get(userId);
        if (!stored) {
            return { success: false, error: 'Código não encontrado ou já utilizado' };
        }
        if (Date.now() > stored.expires) {
            this.resetCodes.delete(userId);
            return { success: false, error: 'Código expirado' };
        }
        stored.attempts++;
        this.resetCodes.set(userId, stored);

        if (stored.attempts > 3) {
            this.resetCodes.delete(userId);
            return { success: false, error: 'Muitas tentativas. Solicite um novo código.' };
        }

        if (stored.code !== code) {
            return { success: false, error: `Código inválido. Tentativa ${stored.attempts}/3` };
        }

        // Gera token de redefinição (válido por 15 minutos – pode ser armazenado em sessão)
        const resetToken = crypto.randomBytes(32).toString('hex');
        this.resetCodes.delete(userId); // código de uso único

        // Log para depuração
        console.log(`🔐 Token de redefinição gerado para ${userId}: ${resetToken.substring(0, 16)}...`);

        return { success: true, resetToken };
    }

    /**
     * Remove códigos expirados de ambos os Maps
     */
    cleanupExpiredCodes() {
        const now = Date.now();
        let removed = 0;
        for (const [key, data] of this.codes.entries()) {
            if (now > data.expires) {
                this.codes.delete(key);
                removed++;
            }
        }
        for (const [key, data] of this.resetCodes.entries()) {
            if (now > data.expires) {
                this.resetCodes.delete(key);
                removed++;
            }
        }
        if (removed > 0) console.log(`🧹 ${removed} código(s) expirado(s) removido(s).`);
    }

    // Para compatibilidade (se ainda usado)
    stopTimer() {}
}

// Exporta uma única instância (singleton)
export default new TwoFactorService();