/**
 * Middleware JWT — protege rotas que exigem autenticação.
 * Uso: router.get('/rota', requireAuth, handler)
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'genesis-dev-secret-TROQUE-NO-ENV';

function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token de autenticação ausente.' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Sessão expirada. Faça login novamente.'
      : 'Token inválido.';
    return res.status(401).json({ message: msg });
  }
}

/** Versão leve: só injeta req.user se o token existir; não bloqueia se ausente. */
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization ?? '';
  if (header.startsWith('Bearer ')) {
    try { req.user = jwt.verify(header.slice(7), JWT_SECRET); } catch {}
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
