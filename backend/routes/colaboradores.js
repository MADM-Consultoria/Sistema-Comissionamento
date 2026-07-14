// backend/routes/colaboradores.js
import express from 'express';
import db from '../services/db.js';

const router = express.Router();

// Middleware de autenticação – verifica isAuthenticated e userId
function requireAuth(req, res, next) {
  if (!req.session.isAuthenticated || !req.session.userId) {
    return res.status(401).json({ success: false, error: 'Não autenticado' });
  }
  next();
}

function getCurrentPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function mapGrupoToProduto(grupo) {
  const mapping = {
    'Elite': 'Auxilio Acidente',
    'Quinquenio': 'Quinquenio',
    'Quinquênio ': 'Quinquenio',
    'Concomitante': 'Concomitante',
  };
  return mapping[grupo] || '';
}

const EXCLUDED_TEAMS = [
  'Equipe SAC', 'Sales Ops', 'Equipe', 'Equipe Lucilene', 'Equipe SDR', 'Equipe Marcio',
  'Equipe Erica', 'Equipe Lucas', 'Equipe Irene', 'Equipe Maria Eduarda', 'SalesOps', ''
];

function normalize(str) {
  return (str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ============================================================
// Função de correspondência: tenta várias combinações
// ============================================================
function findMetricByEmail(email, metricsMap) {
  const clean = normalize(email);
  if (!clean) return null;

  if (metricsMap.has(clean)) return metricsMap.get(clean);

  const variants = new Set();
  variants.add(clean);
  if (clean.endsWith('.br')) {
    variants.add(clean.slice(0, -3));
  } else {
    variants.add(clean + '.br');
  }

  if (clean.includes('@')) {
    const localPart = clean.split('@')[0];
    variants.add(localPart);
    variants.add(localPart + '@madmbrasil.com.br');
    if (!localPart.endsWith('.br')) {
      variants.add(localPart + '.br');
    }
  }

  for (const v of variants) {
    if (metricsMap.has(v)) return metricsMap.get(v);
  }
  return null;
}

// ============================================================
// Rota GET /api/collaborators
// ============================================================
router.get('/collaborators', requireAuth, async (req, res) => {
  const periodo = req.query.mes || getCurrentPeriod();
  console.log(`📅 Buscando colaboradores para o período: ${periodo}`);

  try {
    const todosColabs = await db.query(`
      SELECT internal_id, id_crm, colaborador, e_mail, id_equipe, equipe, grupo, status, periodo
      FROM madm.colaboradores
      WHERE periodo = $1
        AND equipe IS NOT NULL AND TRIM(equipe) != ''
        AND LOWER(status) != 'desativado'
        AND LOWER(grupo) != 'desativado'
    `, [periodo]);
    const colabsArray = todosColabs.rows;

    if (colabsArray.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const metricas = await db.query(`
      SELECT email, data_metrica,
             COALESCE(peso_meta_assinados_diario, 3)   AS meta_diario_assinados,
             COALESCE(peso_meta_ganho_diario, 3)       AS meta_diario_ganhos,
             COALESCE(peso_meta_assinados_semanal, 3)  AS meta_semanal_assinados,
             COALESCE(peso_meta_ganho_semanal, 3)      AS meta_semanal_ganhos,
             COALESCE(peso_meta_assinados_mensal, 10)  AS meta_mensal_assinados,
             COALESCE(peso_meta_ganho_mensal, 10)      AS meta_mensal_ganhos,
             COALESCE(comissao_colaborador, 0)         AS comissao,
             COALESCE(comissao_bonus, 0)               AS bonus_comissao
      FROM app_comissionamento.metricas_assessores
      WHERE TO_CHAR(data_metrica::date, 'YYYY-MM') = $1
    `, [periodo]);

    const metricsByEmail = new Map();
    for (const m of metricas.rows) {
      const normalized = normalize(m.email);
      metricsByEmail.set(normalized, m);
      if (normalized.endsWith('.br')) {
        metricsByEmail.set(normalized.slice(0, -3), m);
      } else {
        metricsByEmail.set(normalized + '.br', m);
      }
    }

    const colaboradores = [];
    for (const colab of colabsArray) {
      const equipeNome = (colab.equipe || '').trim();
      if (EXCLUDED_TEAMS.includes(equipeNome)) continue;

      const emailColab = normalize(colab.e_mail);
      let metrica = findMetricByEmail(emailColab, metricsByEmail);

      if (!metrica) {
        const nomeColab = normalize(colab.colaborador);
        for (const [key, m] of metricsByEmail.entries()) {
          if (key === nomeColab || key.includes(nomeColab) || nomeColab.includes(key)) {
            metrica = m;
            break;
          }
        }
      }

      colaboradores.push({
        id: colab.internal_id,
        name: colab.colaborador,
        email: colab.e_mail,
        equipeId: colab.id_equipe ? String(colab.id_equipe) : '',
        equipeNome,
        grupo: colab.grupo || '',
        status: colab.status || 'ativo',
        periodo: colab.periodo || periodo,
        avatar: (colab.colaborador || '?').charAt(0).toUpperCase(),
        emitidos: 0,
        assinados: 0,
        ganhos: 0,
        perdidos: 0,
        metaDiarioAssinados: metrica ? Number(metrica.meta_diario_assinados) : 3,
        metaDiarioGanhos: metrica ? Number(metrica.meta_diario_ganhos) : 3,
        metaSemanalAssinados: metrica ? Number(metrica.meta_semanal_assinados) : 15,
        metaSemanalGanhos: metrica ? Number(metrica.meta_semanal_ganhos) : 15,
        metaMensalAssinados: metrica ? Number(metrica.meta_mensal_assinados) : 60,
        metaMensalGanhos: metrica ? Number(metrica.meta_mensal_ganhos) : 60,
        comissao: metrica ? Number(metrica.comissao) : 0,
        bonusComissao: metrica ? Number(metrica.bonus_comissao) : 0,
        metaAssinados: 3,
        metaGanhos: 3,
        bonusPorCiclo: 0,
        bonusRecebido: 0,
        produto: mapGrupoToProduto(colab.grupo || ''),
      });
    }

    console.log(`✅ Retornando ${colaboradores.length} colaboradores.`);
    res.json({ success: true, data: colaboradores });
  } catch (err) {
    console.error('❌ Erro ao buscar colaboradores:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// Rota GET /api/equipes
// ============================================================
router.get('/equipes', requireAuth, async (req, res) => {
  const gruposPermitidos = [
    'Elite', 'Supervisor', 'Análise de segurado', 'Concomitante',
    'Salesops', 'Quinquenio', 'Quinquênio ', 'Coordenador', 'CEO', 'Diretoria'
  ];
  const periodo = getCurrentPeriod();

  try {
    const result = await db.query(
      `SELECT id_equipe, equipe
       FROM madm.colaboradores
       WHERE periodo = $1 AND grupo = ANY($2) AND id_equipe IS NOT NULL
         AND equipe IS NOT NULL AND TRIM(equipe) != ''`,
      [periodo, gruposPermitidos]
    );

    const teamsMap = new Map();
    for (const row of result.rows) {
      const nome = (row.equipe || '').trim();
      if (!teamsMap.has(nome)) {
        teamsMap.set(nome, row.id_equipe);
      }
    }

    const equipes = Array.from(teamsMap.entries())
      .map(([nome, id]) => ({ id: String(id), nome }))
      .filter(eq => !EXCLUDED_TEAMS.includes(eq.nome))
      .sort((a, b) => parseInt(a.id) - parseInt(b.id));

    res.json({ success: true, data: equipes });
  } catch (err) {
    console.error('❌ Erro ao buscar equipes:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;