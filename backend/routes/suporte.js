// routes/suporte.js
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const teamsMovimentacao = require('../services/teams_movimentacao'); // notificador de movimentações

// ==================== CONFIGURAÇÕES (variáveis de ambiente) ====================
const KOMMO_DOMAIN = process.env.KOMMO_DOMAIN || 'madm';
const KOMMO_API_TOKEN = process.env.KOMMO_API_TOKEN || '';
const BASE_URL = `https://${KOMMO_DOMAIN}.kommo.com/api/v4`;

// Mapeamento assessor -> ID (opcional, pode ser usado para validação)
const ASSESSORS_MAP = JSON.parse(process.env.ASSESSORS_MAP || '{}');

// Pipeline padrão para onde os cards serão movidos/criados
const DEFAULT_PIPELINE_ID = 12867279; // ex-CLOSER

// IDs dos campos personalizados (substituir pelos reais)
const CAMPO_TELEFONE_ID = 999999;   // TODO: substituir pelo ID real do campo TELEFONE
const CAMPO_CPF_ID = 888888;        // TODO: substituir pelo ID real do campo CPF

// ID do criador padrão (pode ser o mesmo do assessor de sistema)
const CRIADOR_ID = 13273356;

// Etapas bloqueadas (case insensitive) – não permitem movimentação
const BLOCKED_STAGE_KEYWORDS = [
  'Venda ganha', 'Venda perdida', 'Ganho', 'Perdido',
  'Não tem interesse', 'Bloqueado', 'Cancelado', 'Desqualificado',
  'Inválido', 'Duplicado'
];

// ==================== FUNÇÕES AUXILIARES ====================

async function kommoRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${KOMMO_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, config);
  const text = await response.text();
  if (!response.ok) throw new Error(`Kommo API error ${response.status}: ${text.substring(0, 200)}`);
  if (!text) return {};
  return JSON.parse(text);
}

async function buscarLeads(telefone, cpf) {
  if (telefone) {
    const limpo = telefone.replace(/\D/g, '');
    const res = await kommoRequest(`/leads?query=${limpo}`);
    return res._embedded?.leads || [];
  }
  if (cpf) {
    const limpo = cpf.replace(/\D/g, '');
    let res = await kommoRequest(`/leads?query=${limpo}`);
    let leads = res._embedded?.leads || [];
    if (!leads.length) {
      res = await kommoRequest(`/leads?query=${encodeURIComponent(cpf)}`);
      leads = res._embedded?.leads || [];
    }
    return leads;
  }
  return [];
}

async function buscarInfoLead(leadId) {
  const lead = await kommoRequest(`/leads/${leadId}`);
  const pipelines = await kommoRequest('/leads/pipelines');
  const pipeline = pipelines._embedded?.pipelines?.find(p => p.id === lead.pipeline_id);
  const etapas = await kommoRequest(`/leads/pipelines/${pipeline.id}/statuses`);
  const etapa = etapas._embedded?.statuses?.find(s => s.id === lead.status_id);

  return {
    lead: {
      id: lead.id,
      nome: lead.name,
      pipeline_id: lead.pipeline_id,
      pipeline_nome: pipeline?.name || 'Desconhecido',
      status_id: lead.status_id,
      etapa_nome: etapa?.name || 'Desconhecida',
      responsible_user_id: lead.responsible_user_id
    }
  };
}

function isMovable(etapaNome) {
  if (!etapaNome) return false;
  const etapa = etapaNome.toLowerCase();
  return !BLOCKED_STAGE_KEYWORDS.some(keyword => etapa.includes(keyword.toLowerCase()));
}

async function validarContato(leadId, telefone, cpf) {
  const leadComContatos = await kommoRequest(`/leads/${leadId}?with=contacts`);
  const contatos = leadComContatos._embedded?.contacts;
  if (!contatos?.length) return { valido: true };

  const contato = await kommoRequest(`/contacts/${contatos[0].id}`);
  const telefones = (contato.custom_fields_values || [])
    .filter(cf => cf.field_name?.toLowerCase().includes('telefone'))
    .flatMap(cf => cf.values.map(v => v.value))
    .filter(Boolean);
  const cpfs = (contato.custom_fields_values || [])
    .filter(cf => cf.field_name?.toLowerCase().includes('cpf'))
    .flatMap(cf => cf.values.map(v => v.value))
    .filter(Boolean);

  if (telefone && telefones.length) {
    const limpo = telefone.replace(/\D/g, '');
    const corresponde = telefones.some(t => t.replace(/\D/g, '').includes(limpo));
    if (!corresponde) {
      return { valido: false, tipo: 'telefone_inconsistente', motivo: 'Telefone não corresponde' };
    }
  }
  if (cpf && cpfs.length) {
    const limpo = cpf.replace(/\D/g, '');
    const corresponde = cpfs.some(c => c.replace(/\D/g, '').includes(limpo));
    if (!corresponde) {
      return { valido: false, tipo: 'cpf_inconsistente', motivo: 'CPF não corresponde' };
    }
  }
  return { valido: true };
}

async function criarContato(nome, telefone, cpf, assessorId) {
  const body = {
    name: nome,
    responsible_user_id: parseInt(assessorId),
    created_by: CRIADOR_ID,
    updated_by: CRIADOR_ID
  };

  if (telefone) {
    body.custom_fields_values = [{
      field_id: CAMPO_TELEFONE_ID,
      values: [{ value: telefone, enum_code: 'WORK' }]
    }];
  }
  if (cpf) {
    body.custom_fields_values = body.custom_fields_values || [];
    body.custom_fields_values.push({
      field_id: CAMPO_CPF_ID,
      values: [{ value: cpf }]
    });
  }

  const res = await kommoRequest('/contacts', { method: 'POST', body: [body] });
  if (!res._embedded?.contacts?.[0]?.id) throw new Error('Falha ao criar contato');
  return res._embedded.contacts[0].id;
}

async function criarLeadComContato(nomeCliente, contatoId, assessorId) {
  const etapas = await kommoRequest(`/leads/pipelines/${DEFAULT_PIPELINE_ID}/statuses`);
  const etapa = etapas._embedded?.statuses?.find(e =>
    e.name?.toUpperCase().includes('RECEBIDOS') || e.name?.toUpperCase().includes('NOVO')
  ) || etapas._embedded?.statuses?.[0];
  if (!etapa) throw new Error('Etapa inicial não encontrada');

  const body = {
    name: nomeCliente || `Lead ${new Date().toLocaleDateString('pt-BR')}`,
    pipeline_id: DEFAULT_PIPELINE_ID,
    status_id: etapa.id,
    responsible_user_id: parseInt(assessorId),
    created_by: CRIADOR_ID,
    updated_by: CRIADOR_ID,
    _embedded: { contacts: [{ id: contatoId, is_main: true }] }
  };

  const res = await kommoRequest('/leads', { method: 'POST', body: [body] });
  if (!res._embedded?.leads?.[0]?.id) throw new Error('Falha ao criar lead');
  return res._embedded.leads[0].id;
}

async function movimentarParaPipeline(leadId, assessorId) {
  const etapas = await kommoRequest(`/leads/pipelines/${DEFAULT_PIPELINE_ID}/statuses`);
  const etapa = etapas._embedded?.statuses?.find(e =>
    e.name?.toUpperCase().includes('RECEBIDOS') || e.name?.toUpperCase().includes('NOVO')
  ) || etapas._embedded?.statuses?.[0];
  if (!etapa) throw new Error('Etapa do pipeline padrão não encontrada');

  await kommoRequest(`/leads/${leadId}`, {
    method: 'PATCH',
    body: {
      pipeline_id: DEFAULT_PIPELINE_ID,
      status_id: etapa.id,
      responsible_user_id: parseInt(assessorId),
      updated_by: CRIADOR_ID
    }
  });

  // Atualiza responsável do contato principal
  const leadComContatos = await kommoRequest(`/leads/${leadId}?with=contacts`);
  const contatos = leadComContatos._embedded?.contacts;
  if (contatos?.length) {
    await kommoRequest(`/contacts/${contatos[0].id}`, {
      method: 'PATCH',
      body: { responsible_user_id: parseInt(assessorId), updated_by: CRIADOR_ID }
    }).catch(() => {});
  }
}

// ==================== ROTAS ====================

// POST /api/suporte/movimentar
router.post('/movimentar', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      telefone,
      cpf,
      origem,
      assessorId,
      usuario,
    } = req.body;

    if (!firstName || !lastName || !assessorId) {
      return res.status(400).json({
        success: false,
        status: 'dados_invalidos',
        message: 'Nome, sobrenome e assessorId são obrigatórios',
      });
    }

    const nomeCompleto = `${firstName.trim()} ${lastName.trim()}`;
    const leads = await buscarLeads(telefone, cpf);
    let leadId = null;
    let acao = '';

    // ---------------------------------------------
    // Nenhum lead encontrado → cria novo
    // ---------------------------------------------
    if (leads.length === 0) {
      if (!telefone && !cpf) {
        return res.json({
          success: false,
          status: 'telefone_obrigatorio',
          message: 'Nenhum lead encontrado. Informe telefone ou CPF para criar um novo.',
        });
      }
      const contatoId = await criarContato(nomeCompleto, telefone, cpf, assessorId);
      leadId = await criarLeadComContato(nomeCompleto, contatoId, assessorId);
      acao = 'novo_lead_criado';
    }
    // ---------------------------------------------
    // Um lead encontrado
    // ---------------------------------------------
    else if (leads.length === 1) {
      leadId = leads[0].id;

      // Valida telefone/CPF
      const validacao = await validarContato(leadId, telefone, cpf);
      if (!validacao.valido) {
        await teamsMovimentacao.enviar({
          tipo: validacao.tipo.toUpperCase(),
          usuario,
          leadId,
          leadNome: leads[0].name,
          motivo: validacao.motivo,
          detalhes: 'Inconsistência nos dados de contato'
        });
        return res.json({
          success: false,
          status: 'aviso',
          tipoSuporte: validacao.tipo.toUpperCase(),
          message: validacao.motivo + ' - Notificação enviada ao suporte',
          leadId,
        });
      }

      // Verifica se o lead está em etapa bloqueada
      const info = await buscarInfoLead(leadId);
      if (!isMovable(info.lead.etapa_nome)) {
        // Etapa bloqueada → cria novo lead em vez de mover
        if (!telefone && !cpf) {
          return res.json({
            success: false,
            status: 'telefone_obrigatorio',
            message: 'Lead existente em etapa bloqueada. Informe telefone/CPF para criar novo.',
          });
        }
        const contatoId = await criarContato(nomeCompleto, telefone, cpf, assessorId);
        leadId = await criarLeadComContato(nomeCompleto, contatoId, assessorId);
        acao = 'novo_lead_criado_etapa_bloqueada';
      } else {
        // Movimenta normalmente
        await movimentarParaPipeline(leadId, assessorId);
        acao = 'movimentado';
      }
    }
    // ---------------------------------------------
    // Múltiplos leads → suporte
    // ---------------------------------------------
    else {
      await teamsMovimentacao.enviar({
        tipo: 'MULTIPLOS_CARDS',
        usuario,
        totalLeads: leads.length,
        motivo: `${leads.length} leads encontrados com os mesmos dados`,
        detalhes: 'Necessário verificar manualmente'
      });
      return res.json({
        success: false,
        status: 'suporte',
        tipoSuporte: 'MULTIPLOS_CARDS',
        message: `${leads.length} leads encontrados. Verificação manual necessária.`,
      });
    }

    return res.json({
      success: true,
      status: 'concluido',
      message: acao === 'novo_lead_criado' ? 'Novo lead criado e atribuído ao assessor.' : 'Lead movimentado com sucesso.',
      leadId,
      acao,
      usuario,
      nomeCliente: nomeCompleto
    });

  } catch (error) {
    console.error('Erro em /movimentar:', error);
    await teamsMovimentacao.enviar({
      tipo: 'ERRO_PROCESSAMENTO',
      usuario: req.body.usuario || 'frontend',
      error: error.message,
      detalhes: `Stack: ${error.stack?.substring(0, 500)}`
    });
    return res.status(500).json({
      success: false,
      status: 'erro_interno',
      message: error.message,
    });
  }
});

// POST /api/suporte/registrar-movimentacao (persistência no banco)
router.post('/registrar-movimentacao', async (req, res) => {
  try {
    const {
      Solicitante,
      Nome_Cliente,
      Sobrenome_Cliente,
      Email_Cliente,
      Numero_Cliente,
      CPF_Cliente,
      Origem_Cliente,
      Nome_Colaborador,
      Equipe_Colaborador,
      Status,
    } = req.body;

    if (!Solicitante || !Nome_Cliente || !Sobrenome_Cliente || !Email_Cliente) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios ausentes (Solicitante, Nome, Sobrenome, E-mail)',
      });
    }

    const db = req.app.get('db');
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Conexão com o banco de dados não disponível',
      });
    }

    const query = `
      INSERT INTO app_comissionamento."Movimentacao_Lead" (
        "Solicitante",
        "Data_Encaminhada",
        "Status",
        "Nome_Cliente",
        "Sobrenome_Cliente",
        "Email_Cliente",
        "Numero_Cliente",
        "CPF_Cliente",
        "Origem_Cliente",
        "Nome_Colaborador",
        "Equipe_Colaborador"
      ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING "ID_Caso_Movi"
    `;

    const values = [
      Solicitante,
      Status || 'Registrado',
      Nome_Cliente,
      Sobrenome_Cliente,
      Email_Cliente || null,
      Numero_Cliente || null,
      CPF_Cliente || null,
      Origem_Cliente || null,
      Nome_Colaborador || null,
      Equipe_Colaborador || null,
    ];

    const result = await db.query(query, values);
    const idCaso = result.rows[0].ID_Caso_Movi;

    return res.status(201).json({
      success: true,
      message: 'Movimentação registrada com sucesso',
      ID_Caso_Movi: idCaso,
    });

  } catch (error) {
    console.error('Erro ao registrar movimentação no banco:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== NOVAS ROTAS - VISÃO SALESOPS ====================

// GET /api/suporte/casos
router.get('/casos', async (req, res) => {
  try {
    const db = req.app.get('db');
    if (!db) {
      return res.status(500).json({ success: false, message: 'Banco não disponível' });
    }

    const result = await db.query(`
      SELECT 
        "ID_Caso_Movi" AS id,
        "Solicitante" AS solicitante,
        "Data_Encaminhada" AS data_encaminhada,
        "Status" AS status,
        "Data_Conclusão" AS data_conclusao,
        "Nome_Cliente" AS nome_cliente,
        "Sobrenome_Cliente" AS sobrenome_cliente,
        "Email_Cliente" AS email_cliente,
        "Numero_Cliente" AS numero_cliente,
        "CPF_Cliente" AS cpf_cliente,
        "Origem_Cliente" AS origem_cliente,
        "Nome_Colaborador" AS nome_colaborador,
        "Equipe_Colaborador" AS equipe_colaborador,
        "Observacao" AS observacao
      FROM app_comissionamento."Movimentacao_Lead"
      ORDER BY "Data_Encaminhada" DESC
    `);

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao buscar casos:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/suporte/caso/:id
router.patch('/caso/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { observacao } = req.body;

    const db = req.app.get('db');
    if (!db) {
      return res.status(500).json({ success: false, message: 'Banco não disponível' });
    }

    await db.query(`
      UPDATE app_comissionamento."Movimentacao_Lead"
      SET 
        "Status" = 'Concluído',
        "Data_Conclusão" = CURRENT_DATE,
        "Observacao" = $1
      WHERE "ID_Caso_Movi" = $2
    `, [observacao || '', id]);

    return res.json({ success: true, message: 'Caso concluído' });
  } catch (error) {
    console.error('Erro ao atualizar caso:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;