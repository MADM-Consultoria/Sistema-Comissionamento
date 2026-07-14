// backend/suporte/teams_noticacoes.js
const fetch = require('node-fetch');

class TeamsNotificadorSuporte {
    constructor() {
        // Lê as URLs do .env
        this.webhooks = {
            crm: process.env.WEBHOOK_CRM || null,
            dash: process.env.WEBHOOK_DASH || null,
            reversao: process.env.WEBHOOK_REVERSAO || null,
            acesso: process.env.WEBHOOK_ACESSO || null,
            outro: process.env.WEBHOOK_OUTRO || null,
        };

        // Verifica se todas estão configuradas (opcional, pode logar aviso)
        Object.entries(this.webhooks).forEach(([key, url]) => {
            if (!url) {
                console.warn(`⚠️ WEBHOOK_${key.toUpperCase()} não definido no .env`);
            }
        });
    }

    /**
     * Mapeia assunto -> chave do webhook
     */
    mapearAssuntoParaChave(assunto) {
        const mapa = {
            'Discadora': 'crm',
            'CRM': 'crm',
            'Kommo': 'crm',
            'Dash': 'dash',
            'Reversao': 'reversao',
            'Acesso': 'acesso',
            'Outro': 'outro',
        };
        return mapa[assunto] || 'outro';
    }

    /**
     * Formata a data/hora
     */
    formatarDataHora() {
        const agora = new Date();
        return agora.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    }

    /**
     * Monta o Adaptive Card para o Teams
     */
    montarAdaptiveCard(dados) {
        const { assunto, descricao, solicitante, equipe } = dados;
        const dataHora = this.formatarDataHora();

        return {
            type: "AdaptiveCard",
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            version: "1.4",
            body: [
                {
                    type: "TextBlock",
                    size: "Medium",
                    weight: "Bolder",
                    color: "Attention",
                    text: "📢 NOVO REPORTE RECEBIDO",
                    wrap: true
                },
                {
                    type: "TextBlock",
                    text: "Sistema MADM – Suporte Operacional",
                    isSubtle: true,
                    wrap: true
                },
                {
                    type: "FactSet",
                    facts: [
                        { title: "📌 Assunto", value: assunto || "Não informado" },
                        { title: "📝 Descrição", value: descricao || "Não informada" },
                        { title: "👤 Solicitante", value: solicitante || "Não informado" },
                        { title: "👥 Equipe", value: equipe || "Não informada" },
                        { title: "🕒 Data/Hora", value: dataHora }
                    ]
                },
                {
                    type: "Container",
                    style: "emphasis",
                    items: [
                        {
                            type: "TextBlock",
                            text: "🔗 Ações rápidas",
                            weight: "Bolder",
                            wrap: true
                        },
                        {
                            type: "ActionSet",
                            actions: [
                                {
                                    type: "Action.OpenUrl",
                                    title: "🔍 Ver no Sistema",
                                    url: "https://sistema-comissionamento-frontend.onrender.com"
                                }
                            ]
                        }
                    ]
                }
            ]
        };
    }

    /**
     * Envia a notificação para o Teams
     * @param {Object} dados - { assunto, descricao, solicitante, equipe }
     * @returns {Promise<Object>} - { success, status, error, channel }
     */
    async enviar(dados) {
        try {
            // 1. Validar dados obrigatórios
            if (!dados.assunto) {
                throw new Error('Campo "assunto" é obrigatório');
            }
            if (!dados.descricao || dados.descricao.trim().length < 10) {
                throw new Error('Descrição deve ter pelo menos 10 caracteres');
            }

            // 2. Mapear assunto para chave do webhook
            const chave = this.mapearAssuntoParaChave(dados.assunto);
            const webhookUrl = this.webhooks[chave];

            if (!webhookUrl) {
                // Mensagem mais descritiva
                throw new Error(
                    `Webhook para o assunto "${dados.assunto}" (chave: ${chave}) não configurado. ` +
                    'Verifique a variável de ambiente correspondente no .env.'
                );
            }

            // 3. Montar o Adaptive Card
            const card = this.montarAdaptiveCard(dados);

            // 4. Enviar para o Teams via fetch
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'message',
                    attachments: [
                        {
                            contentType: 'application/vnd.microsoft.card.adaptive',
                            content: card
                        }
                    ]
                })
            });

            // 5. Tratar resposta
            if (response.ok) {
                console.log(`✅ Notificação enviada para o canal ${chave} (${dados.assunto})`);
                return {
                    success: true,
                    status: response.status,
                    channel: chave,
                    assunto: dados.assunto,
                };
            } else {
                const errorText = await response.text();
                console.error(`❌ Erro ao enviar para o Teams (${response.status}):`, errorText);
                return {
                    success: false,
                    status: response.status,
                    error: errorText,
                    channel: chave,
                };
            }
        } catch (error) {
            console.error('❌ Erro no envio da notificação:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }
}

// Exporta uma instância única (singleton)
module.exports = new TeamsNotificadorSuporte();