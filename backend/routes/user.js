// backend/routes/user.js
import express from 'express';
import db from '../services/db.js';

const router = express.Router();

// Middleware de autenticação (mesmo padrão do server.js)
function requireAuth(req, res, next) {
  if (!req.session.isAuthenticated || !req.session.userId) {
    return res.status(401).json({ success: false, error: 'Não autenticado' });
  }
  next();
}

// Obtém o colaborador a partir do e-mail da sessão
async function getColaboradorFromSession(req) {
  const email = req.session.userId;   // userId é o e_mail
  if (!email) return null;

  const result = await db.query(
    `SELECT internal_id, colaborador, equipe, grupo, status
     FROM madm.colaboradores
     WHERE e_mail = $1
     LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

router.use(requireAuth);

// ============================================================
// GET /api/user/data
// ============================================================
router.get('/data', async (req, res) => {
  try {
    const user = await getColaboradorFromSession(req);
    if (!user) {
      return res.status(404).json({ error: 'Colaborador não encontrado' });
    }

    let startDate, endDate;
    if (req.query.start && req.query.end) {
      startDate = req.query.start;
      endDate = req.query.end;
    } else if (req.query.date) {
      startDate = req.query.date;
      endDate = req.query.date;
    } else {
      return res.status(400).json({ error: 'Informe start/end ou date' });
    }

    const query = `
      SELECT
        (SELECT COUNT(*) FROM madm.emitidos_e_assinados 
         WHERE consultor_responsavel_emissao = $1 AND data_envio BETWEEN $2 AND $3) as emitidos,
        (SELECT COUNT(*) FROM madm.emitidos_e_assinados 
         WHERE consultor_responsavel_assinatura = $1 AND data_assinatura BETWEEN $2 AND $3) as assinados,
        (SELECT COUNT(*) FROM madm.kommo_leads 
         WHERE lead_usuario_responsavel = $1 AND data_ganho BETWEEN $2 AND $3 
           AND etapa_lead IN ('PROTOCOLADO', 'AG PROTOCOLO', 'Venda ganha')) as ganhos,
        (SELECT COUNT(*) FROM madm.kommo_leads 
         WHERE lead_usuario_responsavel = $1 AND data_ganho BETWEEN $2 AND $3 
           AND etapa_lead = 'Venda perdida') as perdidos
    `;
    const result = await db.query(query, [user.colaborador, startDate, endDate]);
    const data = result.rows[0] || { emitidos: 0, assinados: 0, ganhos: 0, perdidos: 0 };
    res.json(data);
  } catch (err) {
    console.error('Erro em /api/user/data:', err);
    res.status(500).json({ error: 'Erro ao buscar dados do usuário' });
  }
});

// ============================================================
// GET /api/user/meta (metas globais)
// ============================================================
router.get('/meta', async (req, res) => {
  try {
    let pesoAssinados = 3;
    let pesoGanhos = 3;
    let bonusBase = 150;
    try {
      const globalResult = await db.query(
        `SELECT pesoMetaAssinados, pesoMetaGanhos, valorBonus FROM madm.configuracoes_globais LIMIT 1`
      );
      if (globalResult.rows.length) {
        pesoAssinados = globalResult.rows[0].pesometaassinados;
        pesoGanhos = globalResult.rows[0].pesometaganhos;
        bonusBase = globalResult.rows[0].valorbonus;
      }
    } catch (err) { /* mantém defaults */ }

    const meta = {
      meta_quantidade: pesoAssinados,
      meta_percentual: pesoGanhos,
      bonus_base: bonusBase,
      comissao_percentual_padrao: 5,
      bonus_extra_por_meta: 50,
    };
    res.json(meta);
  } catch (err) {
    console.error('Erro em /api/user/meta:', err);
    res.status(500).json({ error: 'Erro ao buscar meta' });
  }
});

// ============================================================
// GET /api/user/team – membros da equipe do utilizador logado
// ============================================================
router.get('/team', async (req, res) => {
  try {
    const user = await getColaboradorFromSession(req);
    if (!user || !user.equipe) {
      return res.status(400).json({ error: 'Usuário não pertence a nenhuma equipe' });
    }

    const result = await db.query(
      `SELECT 
         internal_id as id,
         colaborador as nome,
         equipe,
         grupo as cargo,
         status,
         meta_assinados as meta_individual,
         NULL as comissao_percentual,
         CURRENT_DATE as ultima_atualizacao
       FROM madm.colaboradores
       WHERE equipe = $1 AND status = 'ativo'`,
      [user.equipe]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro em /api/user/team:', err);
    res.status(500).json({ error: 'Erro ao buscar equipe' });
  }
});

// ============================================================
// GET /api/user/config – configurações do assessor logado
// ============================================================
router.get('/config', async (req, res) => {
  try {
    const user = await getColaboradorFromSession(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
    }

    const result = await db.query(
      `SELECT 
         comissao_colaborador,
         comissao_bonus,
         peso_meta_assinados_diario,
         peso_meta_ganho_diario,
         peso_meta_assinados_semanal,
         peso_meta_ganho_semanal,
         peso_meta_assinados_mensal,
         peso_meta_ganho_mensal
       FROM app_comissionamento.metricas_assessores
       WHERE id_assessor::integer = $1`,
      [user.internal_id]
    );

    if (result.rows.length > 0) {
      return res.json({ success: true, ...result.rows[0] });
    } else {
      return res.json({
        success: true,
        comissao_colaborador: 0,
        comissao_bonus: 0,
        peso_meta_assinados_diario: 3,
        peso_meta_ganho_diario: 3,
        peso_meta_assinados_semanal: 3,
        peso_meta_ganho_semanal: 3,
        peso_meta_assinados_mensal: 10,
        peso_meta_ganho_mensal: 10,
      });
    }
  } catch (err) {
    console.error('Erro ao obter configurações:', err);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// ============================================================
// POST /api/user/config – salva configurações
// ============================================================
router.post('/config', async (req, res) => {
  try {
    const user = await getColaboradorFromSession(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
    }

    const {
      comissao_colaborador,
      comissao_bonus,
      peso_meta_assinados_diario,
      peso_meta_ganho_diario,
      peso_meta_assinados_semanal,
      peso_meta_ganho_semanal,
      peso_meta_assinados_mensal,
      peso_meta_ganho_mensal,
    } = req.body;

    const campos = [
      comissao_colaborador,
      comissao_bonus,
      peso_meta_assinados_diario,
      peso_meta_ganho_diario,
      peso_meta_assinados_semanal,
      peso_meta_ganho_semanal,
      peso_meta_assinados_mensal,
      peso_meta_ganho_mensal,
    ];

    if (campos.some(v => v === undefined || isNaN(Number(v)) || Number(v) < 0)) {
      return res.status(400).json({
        success: false,
        error: 'Todos os campos devem ser números válidos e não negativos.',
      });
    }

    const query = `
      UPDATE app_comissionamento.metricas_assessores
      SET
        comissao_colaborador = $1,
        comissao_bonus = $2,
        peso_meta_assinados_diario = $3,
        peso_meta_ganho_diario = $4,
        peso_meta_assinados_semanal = $5,
        peso_meta_ganho_semanal = $6,
        peso_meta_assinados_mensal = $7,
        peso_meta_ganho_mensal = $8,
        updated_at = NOW()
      WHERE id_assessor::integer = $9
      RETURNING id_assessor
    `;

    const values = [
      comissao_colaborador,
      comissao_bonus,
      peso_meta_assinados_diario,
      peso_meta_ganho_diario,
      peso_meta_assinados_semanal,
      peso_meta_ganho_semanal,
      peso_meta_assinados_mensal,
      peso_meta_ganho_mensal,
      user.internal_id,
    ];

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Assessor não encontrado' });
    }

    res.json({ success: true, message: 'Configurações atualizadas com sucesso.' });
  } catch (err) {
    console.error('Erro ao salvar configurações:', err);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// ============================================================
// POST /api/user/extract (placeholder)
// ============================================================
router.post('/extract', async (req, res) => {
  res.json({ success: true, message: 'Extração não armazenada (sem tabela no banco)' });
});

export default router;