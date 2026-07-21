// routes/suporte.js
import express from 'express';
import { pool } from '../services/db.js';

const router = express.Router();

const PLACEHOLDER_UUID = '00000000-0000-0000-0000-000000000000';

// ==================== REGISTO DE TICKET DE MOVIMENTAÇÃO ====================
router.post('/ticket-movimentacao', async (req, res) => {
  try {
    const {
      crm_origem = 'CRM',
      crm_lead_id: rawCrmLeadId = null,
      nome_cliente_informado,
      sobrenome_cliente_informado,
      email_cliente_informado,
      telefone_cliente_informado,
      cpf_cliente_informado,
      origem_cliente_informada,
      tipo_solicitacao = 'Movimentação',
      colaborador_origem_nome,
      equipe_origem_nome,
      colaborador_destino_nome,
      equipe_destino_nome,
      motivo_solicitacao: rawMotivo = null,
      observacao_sales_ops: rawObs = null,
      status_mapeamento = 'pendente',
    } = req.body;

    if (!nome_cliente_informado || !sobrenome_cliente_informado || !email_cliente_informado) {
      return res.status(400).json({ success: false, error: 'Nome, sobrenome e e‑mail são obrigatórios.' });
    }

    const toNull = (val) => (val === 'null' || val === null || val === undefined ? null : val);
    const crmLeadId = toNull(rawCrmLeadId);
    const observacao = toNull(rawObs);

    let motivoSolicitacao = toNull(rawMotivo);
    if (motivoSolicitacao === null) motivoSolicitacao = '';

    const cpfNumerico = cpf_cliente_informado ? cpf_cliente_informado.replace(/\D/g, '') : null;
    const cpfFinal = cpfNumerico && cpfNumerico.length > 11 ? cpfNumerico.substring(0, 11) : cpfNumerico;

    const descricao = `Cliente: ${nome_cliente_informado} ${sobrenome_cliente_informado} | E‑mail: ${email_cliente_informado} | Origem: ${origem_cliente_informada || 'N/A'} | Destino: ${colaborador_destino_nome} (${equipe_destino_nome})`;

    const baseResult = await pool.query(
      `INSERT INTO app_comissionamento.tickets_suporte 
         (solicitante_usuario_id, categoria, tipo_ticket, prioridade, status, titulo, descricao, origem_ticket, criado_em, atualizado_em)
       VALUES ($1, 'Movimentacao', 'Movimentacao', 'AUTO', 'Aberto', 'movimentacao card', $2, 'suporte comissionamento', NOW(), NOW())
       RETURNING id_ticket`,
      [PLACEHOLDER_UUID, descricao]
    );
    const ticketId = baseResult.rows[0].id_ticket;

    const safe = {
      ticket_id:                    ticketId,
      crm_origem:                   crm_origem,
      crm_lead_id:                  crmLeadId,
      nome_cliente_informado:       nome_cliente_informado,
      sobrenome_cliente_informado:  sobrenome_cliente_informado,
      email_cliente_informado:      email_cliente_informado,
      telefone_cliente_informado:   telefone_cliente_informado,
      cpf_cliente_informado:        cpfFinal,
      origem_cliente_informada:     origem_cliente_informada,
      tipo_solicitacao:             tipo_solicitacao,
      colaborador_origem_nome:      colaborador_origem_nome,
      equipe_origem_nome:           equipe_origem_nome,
      colaborador_destino_nome:     colaborador_destino_nome,
      equipe_destino_nome:          equipe_destino_nome,
      motivo_solicitacao:           motivoSolicitacao,
      observacao_sales_ops:         observacao,
      status_mapeamento:            status_mapeamento,
    };

    console.log('📦 Dados finais para inserção:');
    Object.entries(safe).forEach(([key, value]) => {
      console.log(`   ${key}: "${value}" (${value ? String(value).length : 0} caracteres)`);
    });

    const query = `
      INSERT INTO app_comissionamento.tickets_movimentacao_lead (
        ticket_id,
        crm_origem, crm_lead_id,
        nome_cliente_informado, sobrenome_cliente_informado,
        email_cliente_informado, telefone_cliente_informado,
        cpf_cliente_informado, origem_cliente_informada,
        tipo_solicitacao,
        colaborador_origem_nome, equipe_origem_nome,
        colaborador_destino_nome, equipe_destino_nome,
        motivo_solicitacao, observacao_sales_ops,
        status_mapeamento, criado_em, atualizado_em
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17,
        NOW(), NOW()
      )
      RETURNING id_ticket_movimentacao
    `;

    const values = [
      safe.ticket_id,
      safe.crm_origem, safe.crm_lead_id,
      safe.nome_cliente_informado, safe.sobrenome_cliente_informado,
      safe.email_cliente_informado, safe.telefone_cliente_informado || null,
      safe.cpf_cliente_informado || null, safe.origem_cliente_informada,
      safe.tipo_solicitacao,
      safe.colaborador_origem_nome || req.session?.userId || 'frontend',
      safe.equipe_origem_nome || '',
      safe.colaborador_destino_nome, safe.equipe_destino_nome,
      safe.motivo_solicitacao, safe.observacao_sales_ops,
      safe.status_mapeamento,
    ];

    const result = await pool.query(query, values);
    return res.status(201).json({
      success: true,
      message: 'Ticket de movimentação registrado com sucesso.',
      id: result.rows[0].id_ticket_movimentacao,
    });
  } catch (err) {
    console.error('Erro ao registrar ticket:', err);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
});

// ==================== REGISTO DE TICKET DE SUPORTE (REPORTAR) ====================
router.post('/ticket-suporte', async (req, res) => {
  try {
    const {
      assunto,
      descricao,
      files = [],
    } = req.body;

    if (!assunto || !descricao) {
      return res.status(400).json({ success: false, error: 'Assunto e descrição são obrigatórios.' });
    }

    const metadados = files.length > 0 ? { arquivos: files } : null;

    const result = await pool.query(
      `INSERT INTO app_comissionamento.tickets_suporte 
         (solicitante_usuario_id, categoria, tipo_ticket, prioridade, status, titulo, descricao, origem_ticket, metadados, criado_em, atualizado_em)
       VALUES ($1, $2, $3, NULL, 'Aberto', $4, $5, 'suporte comissionamento', $6, NOW(), NOW())
       RETURNING id_ticket`,
      [
        PLACEHOLDER_UUID,
        'Reporte',
        'Reporte',
        assunto,
        descricao,
        metadados ? JSON.stringify(metadados) : null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Ticket de suporte registado com sucesso.',
      id_ticket: result.rows[0].id_ticket,
    });
  } catch (err) {
    console.error('Erro ao registar ticket de suporte:', err);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
});

// ==================== LISTAGEM DE TICKETS ====================
router.get('/tickets-movimentacao', async (req, res) => {
  try {
    const { status_mapeamento } = req.query;
    let query = `
      SELECT id_ticket_movimentacao, ticket_id, crm_origem, tipo_solicitacao,
             nome_cliente_informado, sobrenome_cliente_informado,
             email_cliente_informado, telefone_cliente_informado,
             cpf_cliente_informado, origem_cliente_informada,
             colaborador_origem_nome, equipe_origem_nome,
             colaborador_destino_nome, equipe_destino_nome,
             status_mapeamento, observacao_sales_ops, criado_em
      FROM app_comissionamento.tickets_movimentacao_lead
    `;
    const params = [];

    if (status_mapeamento) {
      query += ' WHERE status_mapeamento = $1';
      params.push(status_mapeamento);
    }

    query += ' ORDER BY criado_em DESC';

    const result = await pool.query(query, params);
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erro ao listar tickets:', err);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
});

export default router;