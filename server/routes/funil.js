/**
 * Rotas do Funil Kanban de Simulações
 * Todas as rotas requerem autenticação JWT.
 *
 * GET  /api/funil/board/:funil_id      — board com etapas e cards
 * GET  /api/funil/sim/:id              — simulação completa
 * PATCH /api/funil/sim/:id             — atualizar titulo / etapa_funil_id / arquivado
 * POST  /api/funil/sim                 — criar nova simulação
 * POST  /api/funil/sim/:id/checklist   — adicionar item ao checklist
 * PATCH /api/funil/checklist/:item_id  — atualizar item do checklist
 * DELETE /api/funil/checklist/:item_id — excluir item do checklist
 * POST  /api/funil/sim/:id/anotacoes   — adicionar anotação
 * DELETE /api/funil/anotacoes/:id      — excluir anotação
 * GET   /api/funil/leads/:id/perfil    — perfil completo do lead com simulações
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { requireAuth } = require('../middleware/auth');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function notFound(res, entity) {
  return res.status(404).json({ message: `${entity} não encontrado(a).` });
}

function serverError(res, err) {
  console.error('[funil]', err.message);
  return res.status(500).json({ message: err.message });
}

// ─── GET /api/funil/board/:funil_id ───────────────────────────────────────────
router.get('/board/:funil_id', requireAuth, async (req, res) => {
  const { funil_id } = req.params;
  try {
    // Busca etapas do funil
    const etapasResult = await db.query(
      `SELECT id, funil_id, label, cor, ordem
       FROM funil_estagios
       WHERE funil_id = $1
       ORDER BY ordem ASC, id ASC`,
      [funil_id]
    );
    const etapas = etapasResult.rows;

    if (etapas.length === 0) {
      return res.json({ etapas: [], cards: {} });
    }

    const etapaIds = etapas.map(e => e.id);

    // Busca cards (simulações) com dados do lead e contagem de checklist
    const cardsResult = await db.query(
      `SELECT
         s.id,
         s.titulo,
         s.credito,
         s.etapa_funil_id,
         s.lead_id,
         s.usuario_id,
         s.criado_em,
         s.codigo,
         COALESCE(l.nome, s.lead_nome_cache) AS lead_nome,
         l.telefone AS lead_tel,
         l.email AS lead_email,
         (SELECT COUNT(*) FROM sim_checklist_items WHERE simulacao_id = s.id)              AS checklist_total,
         (SELECT COUNT(*) FROM sim_checklist_items WHERE simulacao_id = s.id AND feito = true) AS checklist_feito
       FROM simulacoes s
       LEFT JOIN leads l ON l.id = s.lead_id
       WHERE s.etapa_funil_id = ANY($1::varchar[])
         AND s.arquivado = false
       ORDER BY s.criado_em DESC`,
      [etapaIds]
    );

    // Agrupa cards por etapa
    const cards = {};
    for (const e of etapas) cards[e.id] = [];
    for (const row of cardsResult.rows) {
      if (cards[row.etapa_funil_id]) {
        cards[row.etapa_funil_id].push({
          id:             row.id,
          titulo:         row.titulo,
          credito:        row.credito,
          etapa_funil_id: row.etapa_funil_id,
          codigo:         row.codigo,
          lead: {
            id:       row.lead_id,
            nome:     row.lead_nome,
            telefone: row.lead_tel,
            email:    row.lead_email,
          },
          checklist_total: parseInt(row.checklist_total) || 0,
          checklist_feito: parseInt(row.checklist_feito) || 0,
          lead_nome:  row.lead_nome,
          criado_em:  row.criado_em,
        });
      }
    }

    return res.json({ etapas, cards });
  } catch (e) {
    return serverError(res, e);
  }
});

// ─── GET /api/funil/sim/:id ───────────────────────────────────────────────────
router.get('/sim/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    // Simulação principal + lead
    const simResult = await db.query(
      `SELECT
         s.*,
         COALESCE(l.nome, s.lead_nome_cache) AS lead_nome,
         l.telefone AS lead_tel,
         l.email AS lead_email,
         l.objetivo AS lead_objetivo,
         l.origem AS lead_origem,
         l.valor_desejado AS lead_valor_desejado,
         l.aporte_mensal AS lead_aporte_mensal
       FROM simulacoes s
       LEFT JOIN leads l ON l.id = s.lead_id
       WHERE s.id = $1`,
      [id]
    );
    if (simResult.rows.length === 0) return notFound(res, 'Simulação');
    const sim = simResult.rows[0];

    // Checklist items
    const checkResult = await db.query(
      `SELECT id, texto, feito, ordem, criado_em
       FROM sim_checklist_items
       WHERE simulacao_id = $1
       ORDER BY ordem ASC, id ASC`,
      [id]
    );

    // Anotações com nome do usuário
    const anotResult = await db.query(
      `SELECT a.id, a.texto, a.criado_em, a.usuario_id,
              u.nome AS user_nome
       FROM sim_anotacoes a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       WHERE a.simulacao_id = $1
       ORDER BY a.criado_em DESC`,
      [id]
    );

    return res.json({
      ...sim,
      lead: {
        id:            sim.lead_id,
        nome:          sim.lead_nome,
        telefone:      sim.lead_tel,
        email:         sim.lead_email,
        objetivo:      sim.lead_objetivo,
        origem:        sim.lead_origem,
        valor_desejado: sim.lead_valor_desejado,
        aporte_mensal: sim.lead_aporte_mensal,
      },
      checklist_items: checkResult.rows,
      anotacoes:       anotResult.rows,
    });
  } catch (e) {
    return serverError(res, e);
  }
});

// ─── PATCH /api/funil/sim/:id ─────────────────────────────────────────────────
router.patch('/sim/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { titulo, etapa_funil_id, arquivado } = req.body;

  const setClauses = [];
  const values = [];
  let idx = 1;

  if (titulo !== undefined)         { setClauses.push(`titulo = $${idx++}`);         values.push(titulo); }
  if (etapa_funil_id !== undefined) { setClauses.push(`etapa_funil_id = $${idx++}`); values.push(etapa_funil_id); }
  if (arquivado !== undefined)      { setClauses.push(`arquivado = $${idx++}`);       values.push(arquivado); }

  if (setClauses.length === 0) {
    return res.status(400).json({ message: 'Nenhum campo para atualizar.' });
  }

  values.push(id);

  try {
    const result = await db.query(
      `UPDATE simulacoes SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return notFound(res, 'Simulação');
    return res.json(result.rows[0]);
  } catch (e) {
    return serverError(res, e);
  }
});

// ─── POST /api/funil/sim ──────────────────────────────────────────────────────
router.post('/sim', requireAuth, async (req, res) => {
  const { lead_id, titulo, credito, etapa_funil_id, lead_nome_cache } = req.body;
  const usuario_id = req.user.id;

  if (!etapa_funil_id) {
    return res.status(400).json({ message: 'etapa_funil_id é obrigatório.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO simulacoes (lead_id, usuario_id, titulo, credito, etapa_funil_id, lead_nome_cache, arquivado)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING *`,
      [lead_id || null, usuario_id, titulo || null, credito || 0, etapa_funil_id, lead_nome_cache || null]
    );
    const inserted = result.rows[0];
    // Ensure codigo is set (trigger handles it, but refetch to return updated row)
    if (!inserted.codigo) {
      await db.query(
        `UPDATE simulacoes SET codigo = 'SIM-' || LPAD(id::text, 4, '0') WHERE id = $1 AND codigo IS NULL`,
        [inserted.id]
      );
      const refetch = await db.query('SELECT * FROM simulacoes WHERE id = $1', [inserted.id]);
      return res.status(201).json(refetch.rows[0]);
    }
    return res.status(201).json(inserted);
  } catch (e) {
    return serverError(res, e);
  }
});

// ─── POST /api/funil/sim/:id/checklist ───────────────────────────────────────
router.post('/sim/:id/checklist', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { texto } = req.body;

  if (!texto?.trim()) {
    return res.status(400).json({ message: 'texto é obrigatório.' });
  }

  try {
    // Verifica se simulação existe
    const check = await db.query('SELECT id FROM simulacoes WHERE id = $1', [id]);
    if (check.rows.length === 0) return notFound(res, 'Simulação');

    // Próxima ordem
    const ordemResult = await db.query(
      'SELECT COALESCE(MAX(ordem), -1) + 1 AS next_ordem FROM sim_checklist_items WHERE simulacao_id = $1',
      [id]
    );
    const nextOrdem = ordemResult.rows[0].next_ordem;

    const result = await db.query(
      `INSERT INTO sim_checklist_items (simulacao_id, texto, feito, ordem)
       VALUES ($1, $2, false, $3)
       RETURNING *`,
      [id, texto.trim(), nextOrdem]
    );
    return res.status(201).json(result.rows[0]);
  } catch (e) {
    return serverError(res, e);
  }
});

// ─── PATCH /api/funil/checklist/:item_id ─────────────────────────────────────
router.patch('/checklist/:item_id', requireAuth, async (req, res) => {
  const { item_id } = req.params;
  const { feito, texto } = req.body;

  const setClauses = [];
  const values = [];
  let idx = 1;

  if (feito !== undefined) { setClauses.push(`feito = $${idx++}`); values.push(feito); }
  if (texto !== undefined) { setClauses.push(`texto = $${idx++}`); values.push(texto); }

  if (setClauses.length === 0) {
    return res.status(400).json({ message: 'Nenhum campo para atualizar.' });
  }

  values.push(item_id);

  try {
    const result = await db.query(
      `UPDATE sim_checklist_items SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return notFound(res, 'Item de checklist');
    return res.json(result.rows[0]);
  } catch (e) {
    return serverError(res, e);
  }
});

// ─── DELETE /api/funil/checklist/:item_id ────────────────────────────────────
router.delete('/checklist/:item_id', requireAuth, async (req, res) => {
  const { item_id } = req.params;
  try {
    await db.query('DELETE FROM sim_checklist_items WHERE id = $1', [item_id]);
    return res.status(204).send();
  } catch (e) {
    return serverError(res, e);
  }
});

// ─── POST /api/funil/sim/:id/anotacoes ───────────────────────────────────────
router.post('/sim/:id/anotacoes', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { texto } = req.body;
  const usuario_id = req.user.id;

  if (!texto?.trim()) {
    return res.status(400).json({ message: 'texto é obrigatório.' });
  }

  try {
    const check = await db.query('SELECT id FROM simulacoes WHERE id = $1', [id]);
    if (check.rows.length === 0) return notFound(res, 'Simulação');

    const result = await db.query(
      `INSERT INTO sim_anotacoes (simulacao_id, usuario_id, texto)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, usuario_id, texto.trim()]
    );
    const anotacao = result.rows[0];

    // Busca nome do usuário para retornar
    const userResult = await db.query(
      'SELECT nome FROM usuarios WHERE id = $1',
      [usuario_id]
    );
    anotacao.user_nome = userResult.rows[0]?.nome || null;

    return res.status(201).json(anotacao);
  } catch (e) {
    return serverError(res, e);
  }
});

// ─── DELETE /api/funil/anotacoes/:id ─────────────────────────────────────────
router.delete('/anotacoes/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM sim_anotacoes WHERE id = $1', [id]);
    return res.status(204).send();
  } catch (e) {
    return serverError(res, e);
  }
});

// ─── GET /api/funil/leads/:id/perfil ─────────────────────────────────────────
router.get('/leads/:id/perfil', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const leadResult = await db.query(
      `SELECT id, nome, telefone, email, cpf, codigo, objetivo, origem, valor_desejado, aporte_mensal,
              stage_id, funil_id, criado_em, atualizado_em
       FROM leads
       WHERE id = $1`,
      [id]
    );
    if (leadResult.rows.length === 0) return notFound(res, 'Lead');
    const lead = leadResult.rows[0];

    // Simulações do lead
    const simsResult = await db.query(
      `SELECT s.id, s.titulo, s.credito, s.codigo, s.etapa_funil_id, s.arquivado, s.criado_em,
              e.label AS etapa_label, e.cor AS etapa_cor
       FROM simulacoes s
       LEFT JOIN funil_estagios e ON e.id = s.etapa_funil_id
       WHERE s.lead_id = $1
       ORDER BY s.criado_em DESC`,
      [id]
    );

    return res.json({
      ...lead,
      simulacoes: simsResult.rows,
    });
  } catch (e) {
    return serverError(res, e);
  }
});

// ─── GET /api/funil/etapas ───────────────────────────────────────────────────
// Retorna todas as etapas de todos os funis agrupadas por funil_id
router.get('/etapas', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT e.id, e.label, e.cor, e.ordem, e.funil_id, f.label AS funil_label
       FROM funil_estagios e
       JOIN funis f ON f.id = e.funil_id
       ORDER BY f.label ASC, e.ordem ASC`
    );
    return res.json(result.rows);
  } catch (e) {
    return serverError(res, e);
  }
});

module.exports = router;
