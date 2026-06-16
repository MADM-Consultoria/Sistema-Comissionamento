// services/extractBD.js
// Responsável por consultar as quantidades de emitidos, assinados, ganhos e perdidos
// sem persistir nenhum dado no banco.

const db = require('./db'); // conexão com PostgreSQL (assumindo que existe)

class ExtractBD {
    /**
     * Converte um período no formato 'YYYY-MM' para o primeiro e último dia do mês.
     * @param {string} period - Ex: '2026-04'
     * @returns {{ start: string, end: string }}
     */
    getDateRangeFromPeriod(period) {
        const [year, month] = period.split('-');
        const start = `${year}-${month}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const end = `${year}-${month}-${lastDay}`;
        return { start, end };
    }

    /**
     * Consulta quantidade de emitidos para um colaborador, equipe ou total.
     * @param {Object} params - { colaborador?: string, equipe?: string, periodo: string }
     */
    async getEmitidosCount({ colaborador, equipe, periodo }) {
        const { start, end } = this.getDateRangeFromPeriod(periodo);
        let sql = `
            SELECT COUNT(*) as total
            FROM madm.emitidos_e_assinados
            WHERE data_envio BETWEEN $1 AND $2
        `;
        const params = [start, end];
        let paramIndex = 3;

        if (colaborador) {
            sql += ` AND consultor_responsavel_emissao = $${paramIndex}`;
            params.push(colaborador);
            paramIndex++;
        }
        if (equipe) {
            sql += ` AND equipe_responsavel_emissao = $${paramIndex}`;
            params.push(equipe);
            paramIndex++;
        }
        // Se nem colaborador nem equipe foram fornecidos, é total da operação.

        const result = await db.query(sql, params);
        return parseInt(result.rows[0]?.total || 0);
    }

    /**
     * Consulta quantidade de assinados para um colaborador, equipe ou total.
     */
    async getAssinadosCount({ colaborador, equipe, periodo }) {
        const { start, end } = this.getDateRangeFromPeriod(periodo);
        let sql = `
            SELECT COUNT(*) as total
            FROM madm.emitidos_e_assinados
            WHERE data_assinatura BETWEEN $1 AND $2
        `;
        const params = [start, end];
        let paramIndex = 3;

        if (colaborador) {
            sql += ` AND consultor_responsavel_assinatura = $${paramIndex}`;
            params.push(colaborador);
            paramIndex++;
        }
        if (equipe) {
            sql += ` AND equipe_responsavel_assinatura = $${paramIndex}`;
            params.push(equipe);
            paramIndex++;
        }

        const result = await db.query(sql, params);
        return parseInt(result.rows[0]?.total || 0);
    }

    /**
     * Consulta quantidade de ganhos (Venda ganha / protocolado) para um colaborador, equipe ou total.
     */
    async getGanhosCount({ colaborador, equipe, periodo }) {
        const { start, end } = this.getDateRangeFromPeriod(periodo);
        let sql = `
            SELECT COUNT(*) as total
            FROM madm.kommo_leads
            WHERE data_ganho BETWEEN $1 AND $2
              AND funil_vendas IN ('JURIDICO AUDITORIA DE GANHO', 'AUDITORIA DE GANHO', 'PRO')
              AND etapa_lead IN ('Venda ganha', 'AG PROTOCOLO', 'PROTOCOLADO', 'Processo finalizado')
        `;
        const params = [start, end];
        let paramIndex = 3;

        if (colaborador) {
            sql += ` AND lead_usuario_responsavel = $${paramIndex}`;
            params.push(colaborador);
            paramIndex++;
        }
        if (equipe) {
            // Nota: a tabela kommo_leads não tem campo de equipe diretamente.
            // Para filtrar por equipe, precisamos primeiro saber quais colaboradores pertencem à equipe.
            // Como o foco é apenas consulta, faremos uma subconsulta ou JOIN com a tabela de colaboradores.
            sql = sql.replace(
                'FROM madm.kommo_leads',
                `FROM madm.kommo_leads l
                 JOIN madm.colaboradores c ON l.lead_usuario_responsavel = c.colaborador
                 WHERE l.data_ganho BETWEEN $1 AND $2
                   AND l.funil_vendas IN ('JURIDICO AUDITORIA DE GANHO', 'AUDITORIA DE GANHO', 'PRO')
                   AND l.etapa_lead IN ('Venda ganha', 'AG PROTOCOLO', 'PROTOCOLADO', 'Processo finalizado')
                   AND c.equipe = $${paramIndex}`
            );
            params.push(equipe);
            paramIndex++;
        }

        const result = await db.query(sql, params);
        return parseInt(result.rows[0]?.total || 0);
    }

    /**
     * Consulta quantidade de perdidos (Venda perdida) para um colaborador, equipe ou total.
     */
    async getPerdidosCount({ colaborador, equipe, periodo }) {
        const { start, end } = this.getDateRangeFromPeriod(periodo);
        let sql = `
            SELECT COUNT(*) as total
            FROM madm.kommo_leads
            WHERE data_ganho BETWEEN $1 AND $2
              AND funil_vendas IN ('JURIDICO AUDITORIA DE GANHO', 'AUDITORIA DE GANHO', 'PRO')
              AND etapa_lead = 'Venda perdida'
        `;
        const params = [start, end];
        let paramIndex = 3;

        if (colaborador) {
            sql += ` AND lead_usuario_responsavel = $${paramIndex}`;
            params.push(colaborador);
            paramIndex++;
        }
        if (equipe) {
            sql = sql.replace(
                'FROM madm.kommo_leads',
                `FROM madm.kommo_leads l
                 JOIN madm.colaboradores c ON l.lead_usuario_responsavel = c.colaborador
                 WHERE l.data_ganho BETWEEN $1 AND $2
                   AND l.funil_vendas IN ('JURIDICO AUDITORIA DE GANHO', 'AUDITORIA DE GANHO', 'PRO')
                   AND l.etapa_lead = 'Venda perdida'
                   AND c.equipe = $${paramIndex}`
            );
            params.push(equipe);
            paramIndex++;
        }

        const result = await db.query(sql, params);
        return parseInt(result.rows[0]?.total || 0);
    }

    /**
     * Retorna todas as métricas (emitidos, assinados, ganhos, perdidos) para um determinado escopo.
     * @param {Object} options - { colaborador?: string, equipe?: string, periodo: string }
     */
    async getMetrics(options) {
        const { colaborador, equipe, periodo } = options;

        if (!periodo) {
            throw new Error('Período é obrigatório (formato YYYY-MM)');
        }

        const [emitidos, assinados, ganhos, perdidos] = await Promise.all([
            this.getEmitidosCount({ colaborador, equipe, periodo }),
            this.getAssinadosCount({ colaborador, equipe, periodo }),
            this.getGanhosCount({ colaborador, equipe, periodo }),
            this.getPerdidosCount({ colaborador, equipe, periodo })
        ]);

        return {
            emitidos,
            assinados,
            ganhos,
            perdidos,
            periodo,
            ...(colaborador && { colaborador }),
            ...(equipe && { equipe })
        };
    }
}

module.exports = new ExtractBD();