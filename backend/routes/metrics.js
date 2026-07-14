// backend/routes/metrics.js
import express from 'express';
import db from '../services/db.js';

const router = express.Router();

// ✅ Middleware de autenticação corrigido
function requireAuth(req, res, next) {
  if (!req.session.isAuthenticated || !req.session.userId) {
    return res.status(401).json({ success: false, error: 'Não autenticado' });
  }
  next();
}

// ============================================================
// AUXILIARES
// ============================================================
async function getColaboradorNomeFromId(colaboradorId) {
  if (!colaboradorId) return null;
  const result = await db.query(
    `SELECT colaborador FROM madm.colaboradores WHERE internal_id = $1 LIMIT 1`,
    [colaboradorId]
  );
  return result.rows[0]?.colaborador || null;
}

async function resolveColaboradorNome(req) {
  if (req.query.colaborador) return req.query.colaborador;
  if (req.query.colaboradorId) {
    const nome = await getColaboradorNomeFromId(req.query.colaboradorId);
    if (nome) return nome;
  }
  return null;
}

function mapGranularity(granularity) {
  const map = { daily: 'day', weekly: 'week', monthly: 'month' };
  return map[granularity] || null;
}

function normalize(str) {
  return (str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ==================== EMITIDOS ====================
router.get('/emitidos', requireAuth, async (req, res) => {
  try {
    let { start, end, equipe, produto, granularity } = req.query;
    if (!start || !end) return res.status(400).json({ success: false, error: 'start e end obrigatórios' });
    const colaboradorNome = await resolveColaboradorNome(req);
    const gran = mapGranularity(granularity);

    let query = `
      SELECT 
        consultor_responsavel_emissao as colaborador,
        equipe_responsavel_emissao as equipe,
        COUNT(DISTINCT internal_id)::int as total
    `;
    if (gran) {
      query = `
        SELECT 
          consultor_responsavel_emissao as colaborador,
          equipe_responsavel_emissao as equipe,
          (DATE_TRUNC('${gran}', data_envio) AT TIME ZONE 'UTC')::date as periodo,
          COUNT(DISTINCT internal_id)::int as total
      `;
    }
    query += `
      FROM madm.emitidos_e_assinados
      WHERE (data_envio AT TIME ZONE 'UTC')::date >= $1 AND (data_envio AT TIME ZONE 'UTC')::date < $2
        AND consultor_responsavel_emissao IS NOT NULL
        AND consultor_responsavel_emissao != ''
    `;
    const params = [start, end];
    let idx = 3;

    if (equipe && equipe !== 'todas') {
      query += ` AND LOWER(TRIM(equipe_responsavel_emissao)) = LOWER(TRIM($${idx}))`;
      params.push(equipe); idx++;
    }
    if (produto && produto !== 'Todos') {
      const productVariants = {
        'Auxilio Acidente': ['Auxilio Acidente', 'Auxílio Acidente'],
        'Quinquenio': ['Quinquenio', 'Quinquênio']
      };
      if (productVariants[produto]) {
        const variants = productVariants[produto];
        const placeholders = variants.map((_, i) => `$${idx + i}`).join(', ');
        query += ` AND produto IN (${placeholders})`;
        params.push(...variants); idx += variants.length;
      } else {
        query += ` AND produto = $${idx}`;
        params.push(produto); idx++;
      }
    }
    if (gran) {
      query += ` GROUP BY consultor_responsavel_emissao, equipe_responsavel_emissao, DATE_TRUNC('${gran}', data_envio) ORDER BY periodo, colaborador`;
    } else {
      query += ` GROUP BY consultor_responsavel_emissao, equipe_responsavel_emissao ORDER BY colaborador`;
    }

    const result = await db.query(query, params);
    let rows = result.rows;

    if (colaboradorNome) {
      const normFilter = normalize(colaboradorNome);
      rows = rows.filter(row => {
        const rowColab = normalize(row.colaborador);
        return rowColab === normFilter || rowColab.includes(normFilter) || normFilter.includes(rowColab);
      });
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erro em /emitidos:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== ASSINADOS ====================
router.get('/assinados', requireAuth, async (req, res) => {
  try {
    let { start, end, equipe, produto, granularity } = req.query;
    if (!start || !end) return res.status(400).json({ success: false, error: 'start e end obrigatórios' });
    const colaboradorNome = await resolveColaboradorNome(req);
    const gran = mapGranularity(granularity);

    let query = `
      SELECT 
        consultor_responsavel_assinatura as colaborador,
        equipe_responsavel_assinatura as equipe,
        COUNT(DISTINCT internal_id)::int as total
    `;
    if (gran) {
      query = `
        SELECT 
          consultor_responsavel_assinatura as colaborador,
          equipe_responsavel_assinatura as equipe,
          (DATE_TRUNC('${gran}', data_assinatura) AT TIME ZONE 'UTC')::date as periodo,
          COUNT(DISTINCT internal_id)::int as total
      `;
    }
    query += `
      FROM madm.emitidos_e_assinados
      WHERE (data_assinatura AT TIME ZONE 'UTC')::date >= $1 AND (data_assinatura AT TIME ZONE 'UTC')::date < $2
        AND status = 'signed'
        AND consultor_responsavel_assinatura IS NOT NULL
        AND consultor_responsavel_assinatura != ''
    `;
    const params = [start, end];
    let idx = 3;

    if (equipe && equipe !== 'todas') {
      query += ` AND LOWER(TRIM(equipe_responsavel_assinatura)) = LOWER(TRIM($${idx}))`;
      params.push(equipe); idx++;
    }
    if (produto && produto !== 'Todos') {
      const productVariants = {
        'Auxilio Acidente': ['Auxilio Acidente', 'Auxílio Acidente'],
        'Quinquenio': ['Quinquenio', 'Quinquênio']
      };
      if (productVariants[produto]) {
        const variants = productVariants[produto];
        const placeholders = variants.map((_, i) => `$${idx + i}`).join(', ');
        query += ` AND produto IN (${placeholders})`;
        params.push(...variants); idx += variants.length;
      } else {
        query += ` AND produto = $${idx}`;
        params.push(produto); idx++;
      }
    }
    if (gran) {
      query += ` GROUP BY consultor_responsavel_assinatura, equipe_responsavel_assinatura, DATE_TRUNC('${gran}', data_assinatura) ORDER BY periodo, colaborador`;
    } else {
      query += ` GROUP BY consultor_responsavel_assinatura, equipe_responsavel_assinatura ORDER BY colaborador`;
    }

    const result = await db.query(query, params);
    let rows = result.rows;

    if (colaboradorNome) {
      const normFilter = normalize(colaboradorNome);
      rows = rows.filter(row => {
        const rowColab = normalize(row.colaborador);
        return rowColab === normFilter || rowColab.includes(normFilter) || normFilter.includes(rowColab);
      });
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erro em /assinados:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== PROTOCOLADOS ====================
router.get('/protocolados', requireAuth, async (req, res) => {
  try {
    let { start, end, equipe, produto, granularity } = req.query;
    if (!start || !end) return res.status(400).json({ success: false, error: 'start e end obrigatórios' });
    const colaboradorNome = await resolveColaboradorNome(req);
    const gran = mapGranularity(granularity);
    const periodo = start.substring(0, 7);
    const colaboradorSubquery = `(
      SELECT DISTINCT ON (colaborador) colaborador, equipe
      FROM madm.colaboradores
      WHERE periodo = '${periodo}'
    )`;

    let query = `
      SELECT 
        l.lead_usuario_responsavel as colaborador,
        COALESCE(c.equipe, '') as equipe,
        COUNT(DISTINCT l.id)::int as total
    `;
    if (gran) {
      query = `
        SELECT 
          l.lead_usuario_responsavel as colaborador,
          COALESCE(c.equipe, '') as equipe,
          (DATE_TRUNC('${gran}', l.data_protocolo_juridico_auditoria) AT TIME ZONE 'UTC')::date as periodo,
          COUNT(DISTINCT l.id)::int as total
      `;
    }
    query += `
      FROM madm.kommo_leads l
      LEFT JOIN ${colaboradorSubquery} c ON l.lead_usuario_responsavel = c.colaborador
      WHERE (l.data_protocolo_juridico_auditoria AT TIME ZONE 'UTC')::date >= $1 AND (l.data_protocolo_juridico_auditoria AT TIME ZONE 'UTC')::date < $2
        AND l.lead_usuario_responsavel IS NOT NULL
        AND l.lead_usuario_responsavel != ''
    `;
    const params = [start, end];
    let idx = 3;

    if (equipe && equipe !== 'todas') {
      query += ` AND LOWER(TRIM(c.equipe)) = LOWER(TRIM($${idx}))`;
      params.push(equipe); idx++;
    }
    if (produto && produto !== 'Todos') {
      const productVariants = {
        'Auxilio Acidente': ['Auxilio Acidente', 'Auxílio Acidente'],
        'Quinquenio': ['Quinquenio', 'Quinquênio']
      };
      if (productVariants[produto]) {
        const variants = productVariants[produto];
        const placeholders = variants.map((_, i) => `$${idx + i}`).join(', ');
        query += ` AND l.produtos IN (${placeholders})`;
        params.push(...variants); idx += variants.length;
      } else {
        query += ` AND l.produtos = $${idx}`;
        params.push(produto); idx++;
      }
    }
    if (gran) {
      query += ` GROUP BY l.lead_usuario_responsavel, c.equipe, DATE_TRUNC('${gran}', l.data_protocolo_juridico_auditoria) ORDER BY periodo, colaborador`;
    } else {
      query += ` GROUP BY l.lead_usuario_responsavel, c.equipe ORDER BY colaborador`;
    }

    const result = await db.query(query, params);
    let rows = result.rows;

    if (colaboradorNome) {
      const normFilter = normalize(colaboradorNome);
      rows = rows.filter(row => {
        const rowColab = normalize(row.colaborador);
        return rowColab === normFilter || rowColab.includes(normFilter) || normFilter.includes(rowColab);
      });
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erro em /protocolados:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== GANHOS ====================
router.get('/ganhos', requireAuth, async (req, res) => {
  try {
    let { start, end, equipe, produto, granularity } = req.query;
    if (!start || !end) return res.status(400).json({ success: false, error: 'start e end obrigatórios' });
    const colaboradorNome = await resolveColaboradorNome(req);
    const gran = mapGranularity(granularity);
    const periodo = start.substring(0, 7);
    const colaboradorSubquery = `(
      SELECT DISTINCT ON (colaborador) colaborador, equipe
      FROM madm.colaboradores
      WHERE periodo = '${periodo}'
    )`;

    const funis = ['AUDITORIA DE GANHO', 'JURIDICO AUDITORIA DE GANHO', 'NOVO - AUDITORIA DE GANHO', 'PRO'];
    const etapas = [
      'Venda ganha', 'PROTOCOLADO', 'AG PROTOCOLO', 'ANALISE DE PRONTUÁRIO',
      'ENTRADA', 'E-MAIL NÃO RESPONDIDO', 'E-MAIL RESPONDIDO', 'AÇÃO DO CLIENTE',
      'ASSINATURA DO ADV', 'AG PRONTUÁRIO', 'PENDÊNCIA PRO', 'VALIDAÇÃO SUPERVISOR',
      'protocolado'
    ];

    let query = `
      SELECT 
        l.lead_usuario_responsavel as colaborador,
        COALESCE(c.equipe, '') as equipe,
        COUNT(DISTINCT l.id)::int as total
    `;
    if (gran) {
      query = `
        SELECT 
          l.lead_usuario_responsavel as colaborador,
          COALESCE(c.equipe, '') as equipe,
          (DATE_TRUNC('${gran}', l.data_ganho) AT TIME ZONE 'UTC')::date as periodo,
          COUNT(DISTINCT l.id)::int as total
      `;
    }
    query += `
      FROM madm.kommo_leads l
      LEFT JOIN ${colaboradorSubquery} c ON l.lead_usuario_responsavel = c.colaborador
      WHERE (l.data_ganho AT TIME ZONE 'UTC')::date >= $1 AND (l.data_ganho AT TIME ZONE 'UTC')::date < $2
        AND l.funil_vendas = ANY($3)
        AND l.etapa_lead = ANY($4)
        AND l.lead_usuario_responsavel IS NOT NULL
        AND l.lead_usuario_responsavel != ''
    `;
    const params = [start, end, funis, etapas];
    let idx = 5;

    if (equipe && equipe !== 'todas') {
      query += ` AND LOWER(TRIM(c.equipe)) = LOWER(TRIM($${idx}))`;
      params.push(equipe); idx++;
    }
    if (produto && produto !== 'Todos') {
      const productVariants = {
        'Auxilio Acidente': ['Auxilio Acidente', 'Auxílio Acidente'],
        'Quinquenio': ['Quinquenio', 'Quinquênio']
      };
      if (productVariants[produto]) {
        const variants = productVariants[produto];
        const placeholders = variants.map((_, i) => `$${idx + i}`).join(', ');
        query += ` AND l.produtos IN (${placeholders})`;
        params.push(...variants); idx += variants.length;
      } else {
        query += ` AND l.produtos = $${idx}`;
        params.push(produto); idx++;
      }
    }
    if (gran) {
      query += ` GROUP BY l.lead_usuario_responsavel, c.equipe, DATE_TRUNC('${gran}', l.data_ganho) ORDER BY periodo, colaborador`;
    } else {
      query += ` GROUP BY l.lead_usuario_responsavel, c.equipe ORDER BY colaborador`;
    }

    const result = await db.query(query, params);
    let rows = result.rows;

    if (colaboradorNome) {
      const normFilter = normalize(colaboradorNome);
      rows = rows.filter(row => {
        const rowColab = normalize(row.colaborador);
        return rowColab === normFilter || rowColab.includes(normFilter) || normFilter.includes(rowColab);
      });
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erro em /ganhos:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== PERDIDOS ====================
router.get('/perdidos', requireAuth, async (req, res) => {
  try {
    let { start, end, equipe, produto, granularity } = req.query;
    if (!start || !end) return res.status(400).json({ success: false, error: 'start e end obrigatórios' });
    const colaboradorNome = await resolveColaboradorNome(req);
    const gran = mapGranularity(granularity);
    const periodo = start.substring(0, 7);
    const colaboradorSubquery = `(
      SELECT DISTINCT ON (colaborador) colaborador, equipe
      FROM madm.colaboradores
      WHERE periodo = '${periodo}'
    )`;

    const funis = ['AUDITORIA DE GANHO', 'JURIDICO AUDITORIA DE GANHO', 'NOVO - AUDITORIA DE GANHO', 'PRO'];

    let query = `
      SELECT 
        l.lead_usuario_responsavel as colaborador,
        COALESCE(c.equipe, '') as equipe,
        COUNT(DISTINCT l.id)::int as total
    `;
    if (gran) {
      query = `
        SELECT 
          l.lead_usuario_responsavel as colaborador,
          COALESCE(c.equipe, '') as equipe,
          (DATE_TRUNC('${gran}', l.data_ganho) AT TIME ZONE 'UTC')::date as periodo,
          COUNT(DISTINCT l.id)::int as total
      `;
    }
    query += `
      FROM madm.kommo_leads l
      LEFT JOIN ${colaboradorSubquery} c ON l.lead_usuario_responsavel = c.colaborador
      WHERE (l.data_ganho AT TIME ZONE 'UTC')::date >= $1 AND (l.data_ganho AT TIME ZONE 'UTC')::date < $2
        AND l.funil_vendas = ANY($3)
        AND l.etapa_lead = 'Venda perdida'
        AND l.lead_usuario_responsavel IS NOT NULL
        AND l.lead_usuario_responsavel != ''
    `;
    const params = [start, end, funis];
    let idx = 4;

    if (equipe && equipe !== 'todas') {
      query += ` AND LOWER(TRIM(c.equipe)) = LOWER(TRIM($${idx}))`;
      params.push(equipe); idx++;
    }
    if (produto && produto !== 'Todos') {
      const productVariants = {
        'Auxilio Acidente': ['Auxilio Acidente', 'Auxílio Acidente'],
        'Quinquenio': ['Quinquenio', 'Quinquênio']
      };
      if (productVariants[produto]) {
        const variants = productVariants[produto];
        const placeholders = variants.map((_, i) => `$${idx + i}`).join(', ');
        query += ` AND l.produtos IN (${placeholders})`;
        params.push(...variants); idx += variants.length;
      } else {
        query += ` AND l.produtos = $${idx}`;
        params.push(produto); idx++;
      }
    }
    if (gran) {
      query += ` GROUP BY l.lead_usuario_responsavel, c.equipe, DATE_TRUNC('${gran}', l.data_ganho) ORDER BY periodo, colaborador`;
    } else {
      query += ` GROUP BY l.lead_usuario_responsavel, c.equipe ORDER BY colaborador`;
    }

    const result = await db.query(query, params);
    let rows = result.rows;

    if (colaboradorNome) {
      const normFilter = normalize(colaboradorNome);
      rows = rows.filter(row => {
        const rowColab = normalize(row.colaborador);
        return rowColab === normFilter || rowColab.includes(normFilter) || normFilter.includes(rowColab);
      });
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erro em /perdidos:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== LEADS RECEBIDOS ====================
router.get('/leads-recebidos', requireAuth, async (req, res) => {
  try {
    let { start, end, equipe, produto, granularity } = req.query;
    if (!start || !end) return res.status(400).json({ success: false, error: 'start e end obrigatórios' });
    const colaboradorNome = await resolveColaboradorNome(req);
    const gran = mapGranularity(granularity);
    const periodo = start.substring(0, 7);
    const colaboradorSubquery = `(
      SELECT DISTINCT ON (colaborador) colaborador, equipe
      FROM madm.colaboradores
      WHERE periodo = '${periodo}'
    )`;

    let query = `
      SELECT 
        l.lead_usuario_responsavel as colaborador,
        COALESCE(c.equipe, '') as equipe,
        (l.data_qualificacao AT TIME ZONE 'UTC')::date as data,
        COUNT(DISTINCT l.id)::int as total
    `;
    if (gran) {
      query = `
        SELECT 
          l.lead_usuario_responsavel as colaborador,
          COALESCE(c.equipe, '') as equipe,
          (DATE_TRUNC('${gran}', l.data_qualificacao) AT TIME ZONE 'UTC')::date as data,
          COUNT(DISTINCT l.id)::int as total
      `;
    }
    query += `
      FROM madm.kommo_leads l
      LEFT JOIN ${colaboradorSubquery} c ON l.lead_usuario_responsavel = c.colaborador
      WHERE (l.data_qualificacao AT TIME ZONE 'UTC')::date >= $1 AND (l.data_qualificacao AT TIME ZONE 'UTC')::date < $2
        AND l.lead_usuario_responsavel IS NOT NULL
        AND l.lead_usuario_responsavel != ''
    `;
    const params = [start, end];
    let idx = 3;

    if (equipe && equipe !== 'todas') {
      query += ` AND LOWER(TRIM(c.equipe)) = LOWER(TRIM($${idx}))`;
      params.push(equipe); idx++;
    }
    if (produto && produto !== 'Todos') {
      const productVariants = {
        'Auxilio Acidente': ['Auxilio Acidente', 'Auxílio Acidente'],
        'Quinquenio': ['Quinquenio', 'Quinquênio']
      };
      if (productVariants[produto]) {
        const variants = productVariants[produto];
        const placeholders = variants.map((_, i) => `$${idx + i}`).join(', ');
        query += ` AND l.produtos IN (${placeholders})`;
        params.push(...variants); idx += variants.length;
      } else {
        query += ` AND l.produtos = $${idx}`;
        params.push(produto); idx++;
      }
    }
    if (gran) {
      query += ` GROUP BY l.lead_usuario_responsavel, c.equipe, DATE_TRUNC('${gran}', l.data_qualificacao) ORDER BY data, colaborador`;
    } else {
      query += ` GROUP BY l.lead_usuario_responsavel, c.equipe, (l.data_qualificacao AT TIME ZONE 'UTC')::date ORDER BY data, colaborador`;
    }

    const result = await db.query(query, params);
    let rows = result.rows;

    if (colaboradorNome) {
      const normFilter = normalize(colaboradorNome);
      rows = rows.filter(row => {
        const rowColab = normalize(row.colaborador);
        return rowColab === normFilter || rowColab.includes(normFilter) || normFilter.includes(rowColab);
      });
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erro em /leads-recebidos:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== LEADS POR ETAPA ====================
router.get('/leads/stages', requireAuth, async (req, res) => {
  try {
    let { start, end, equipe, produto } = req.query;
    if (!start || !end) return res.status(400).json({ success: false, error: 'start e end obrigatórios' });
    const colaboradorNome = await resolveColaboradorNome(req);
    const periodo = start.substring(0, 7);
    const colaboradorSubquery = `(
      SELECT DISTINCT ON (colaborador) colaborador, equipe
      FROM madm.colaboradores
      WHERE periodo = '${periodo}'
    )`;

    let query = `
      SELECT 
        l.lead_usuario_responsavel as colaborador,
        l.etapa_lead,
        COUNT(DISTINCT l.id)::int as total
      FROM madm.kommo_leads l
      LEFT JOIN ${colaboradorSubquery} c ON l.lead_usuario_responsavel = c.colaborador
      WHERE (l.data_qualificacao AT TIME ZONE 'UTC')::date >= $1 AND (l.data_qualificacao AT TIME ZONE 'UTC')::date < $2
        AND l.lead_usuario_responsavel IS NOT NULL
        AND l.lead_usuario_responsavel != ''
    `;
    const params = [start, end];
    let idx = 3;

    if (equipe && equipe !== 'todas') {
      query += ` AND LOWER(TRIM(c.equipe)) = LOWER(TRIM($${idx}))`;
      params.push(equipe); idx++;
    }
    if (produto && produto !== 'Todos') {
      const productVariants = {
        'Auxilio Acidente': ['Auxilio Acidente', 'Auxílio Acidente'],
        'Quinquenio': ['Quinquenio', 'Quinquênio']
      };
      if (productVariants[produto]) {
        const variants = productVariants[produto];
        const placeholders = variants.map((_, i) => `$${idx + i}`).join(', ');
        query += ` AND l.produtos IN (${placeholders})`;
        params.push(...variants); idx += variants.length;
      } else {
        query += ` AND l.produtos = $${idx}`;
        params.push(produto); idx++;
      }
    }
    query += ` GROUP BY l.lead_usuario_responsavel, l.etapa_lead ORDER BY colaborador`;

    const result = await db.query(query, params);
    let rows = result.rows;

    if (colaboradorNome) {
      const normFilter = normalize(colaboradorNome);
      rows = rows.filter(row => {
        const rowColab = normalize(row.colaborador);
        return rowColab === normFilter || rowColab.includes(normFilter) || normFilter.includes(rowColab);
      });
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erro em /leads/stages:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== PERFORMANCE SEMANAL ====================
router.get('/weekly', requireAuth, async (req, res) => {
  try {
    let { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ success: false, error: 'start e end obrigatórios' });
    const query = `
      SELECT 
        (DATE_TRUNC('week', data_assinatura) AT TIME ZONE 'UTC')::date as semana,
        COUNT(DISTINCT internal_id)::int as vendas
      FROM madm.emitidos_e_assinados
      WHERE (data_assinatura AT TIME ZONE 'UTC')::date >= $1 AND (data_assinatura AT TIME ZONE 'UTC')::date < $2
        AND status = 'signed'
        AND consultor_responsavel_assinatura IS NOT NULL
      GROUP BY semana
      ORDER BY semana
    `;
    const result = await db.query(query, [start, end]);
    const weeklyData = result.rows.map(row => ({
      semana: row.semana,
      vendas: row.vendas,
      meta: 5
    }));
    res.json({ success: true, data: weeklyData });
  } catch (err) {
    console.error('Erro em /weekly:', err);
    const mock = [
      { semana: '2026-05-04', vendas: 0, meta: 5 },
      { semana: '2026-05-11', vendas: 0, meta: 5 },
      { semana: '2026-05-18', vendas: 0, meta: 5 },
      { semana: '2026-05-25', vendas: 0, meta: 5 },
    ];
    res.json({ success: true, data: mock });
  }
});

export default router;