/**
 * Rotas de Autenticação
 * POST /api/auth/login   — recebe credenciais + GPS, valida geo, emite JWT
 * POST /api/auth/logout  — revoga sessão (client-side; aqui só log)
 * GET  /api/auth/me      — retorna dados do usuário autenticado
 */

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../db');
const { geoBlockMiddleware, saveAuditLog } = require('../middleware/geoBlock');
const { requireAuth }                       = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET  = process.env.JWT_SECRET  || 'genesis-dev-secret-TROQUE-NO-ENV';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, senha, lat, lon }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', geoBlockMiddleware, async (req, res) => {
  const { email = '', senha = '' } = req.body;
  const { geoInfo } = req;

  if (!email.trim() || !senha) {
    return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const result = await db.query(
      `SELECT id, nome, email, senha_hash, papel, ativo
       FROM usuarios WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email.trim()]
    );

    const usuario = result.rows[0];

    // Usuário não encontrado ou inativo — retorna 401 genérico (não vaza info)
    if (!usuario || !usuario.ativo) {
      saveAuditLog({
        ...geoInfo, username: email, usuarioId: usuario?.id ?? null,
        status: 'falha_senha',
        detalhe: usuario ? 'Conta inativa' : 'Usuário não encontrado',
      });
      // Aguarda tempo fixo para mitigar timing attacks
      await bcrypt.hash('dummy', 10);
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    // Senha incorreta
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) {
      saveAuditLog({
        ...geoInfo, username: email, usuarioId: usuario.id,
        status: 'falha_senha', detalhe: 'Senha incorreta',
      });
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    // ── Sucesso ──────────────────────────────────────────────────────────
    const payload = {
      id:    usuario.id,
      email: usuario.email,
      nome:  usuario.nome,
      papel: usuario.papel,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES,
      issuer:    'genesis-crm',
    });

    saveAuditLog({
      ...geoInfo, username: email, usuarioId: usuario.id,
      status: 'sucesso',
    });

    return res.json({
      token,
      expiresIn: JWT_EXPIRES,
      usuario: payload,
    });

  } catch (e) {
    console.error('[auth/login]', e.message);
    return res.status(500).json({ message: 'Erro interno. Tente novamente em instantes.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({ usuario: req.user });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/audit  — logs de auditoria (apenas admin/gerente)
// Query params: status, ip, user, limit (max 200)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/audit', requireAuth, async (req, res) => {
  if (!['admin', 'gerente'].includes(req.user.papel)) {
    return res.status(403).json({ message: 'Acesso restrito a administradores.' });
  }

  const limit  = Math.min(parseInt(req.query.limit) || 100, 200);
  const status = req.query.status || null;
  const ip     = req.query.ip     || null;
  const user   = req.query.user   || null;

  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (status) { conditions.push(`status = $${idx++}`);                       params.push(status); }
  if (ip)     { conditions.push(`ip::text ILIKE $${idx++}`);                 params.push(`%${ip}%`); }
  if (user)   { conditions.push(`username_digitado ILIKE $${idx++}`);        params.push(`%${user}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [rows, countRow] = await Promise.all([
      db.query(
        `SELECT id, timestamp_utc, username_digitado, ip, porta,
                pais, estado, cidade, isp,
                lat_ip, lon_ip, lat_gps, lon_gps,
                os, navegador, user_agent, status, detalhe
         FROM auth_audit_logs ${where}
         ORDER BY timestamp_utc DESC
         LIMIT $${idx}`,
        [...params, limit]
      ),
      db.query(`SELECT COUNT(*) FROM auth_audit_logs ${where}`, params),
    ]);

    res.json({ logs: rows.rows, total: parseInt(countRow.rows[0].count) });
  } catch (e) {
    console.error('[auth/audit]', e.message);
    res.status(500).json({ message: 'Erro ao consultar logs.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout  (o token JWT é stateless; client descarta do storage)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', requireAuth, (req, res) => {
  // Para invalidação real, implemente uma blocklist de JTI em Redis ou na tabela
  // auth_refresh_tokens. Por ora, o client apaga o token.
  res.json({ message: 'Sessão encerrada.' });
});

module.exports = router;
