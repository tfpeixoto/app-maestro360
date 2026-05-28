/**
 * Middleware de Bloqueio Geográfico — Região Metropolitana de BH
 *
 * Fluxo:
 *  1. Exige lat/lon GPS enviados pelo front-end (obrigatório)
 *  2. Valida GPS dentro do bounding-box da RMBH
 *  3. Consulta ip-api.com para enriquecer dados de auditoria
 *  4. Injeta req.geoInfo para uso no handler de login
 *  5. Grava log de auditoria de forma assíncrona (não bloqueia resposta)
 */

const axios = require('axios');
const db    = require('../db');

// ── Bounding box da RMBH ──────────────────────────────────────────────────
// Cobre BH + Contagem, Betim, Nova Lima, Sabará, Santa Luzia,
// Ribeirão das Neves, Vespasiano, Lagoa Santa, Pedro Leopoldo, etc.
const RMBH = { latMin: -20.50, latMax: -19.50, lonMin: -44.45, lonMax: -43.55 };

// Cidades aceitas por nome (para validação via IP quando GPS não é preciso)
const RMBH_CITIES = new Set([
  'belo horizonte','contagem','betim','sabará','sabara',
  'santa luzia','nova lima','ibirité','ibirite','vespasiano',
  'ribeirão das neves','ribeirao das neves','esmeraldas',
  'lagoa santa','pedro leopoldo','brumadinho','caeté','caete',
  'matozinhos','raposos','rio acima','sarzedo','igarapé','igarape',
  'juatuba','são joaquim de bicas','sao joaquim de bicas',
  'taquaraçu de minas','taquaracu de minas','confins',
  'florestal','itabirito','mário campos','mario campos',
  'baldim','jaboticatubas','nova união','nova uniao',
  'capim branco','funilândia','funilândia',
]);

// ── Utilitários ───────────────────────────────────────────────────────────

function inRMBH(lat, lon) {
  return lat >= RMBH.latMin && lat <= RMBH.latMax &&
         lon >= RMBH.lonMin && lon <= RMBH.lonMax;
}

/** Extrai IP real tratando proxies e load balancers. */
function extractIP(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers['x-real-ip']         ||
         req.headers['cf-connecting-ip']  || // Cloudflare
         req.socket?.remoteAddress        ||
         '0.0.0.0';
}

/** Normaliza User-Agent em campos legíveis. */
function parseUA(ua = '') {
  let os = 'Desconhecido';
  let nav = 'Desconhecido';

  if (/Windows NT 10/i.test(ua))       os = 'Windows 10/11';
  else if (/Windows NT 6/i.test(ua))   os = 'Windows 7/8';
  else if (/Mac OS X/i.test(ua))       os = 'macOS';
  else if (/Android/i.test(ua))        os = 'Android';
  else if (/iPhone|iPad/i.test(ua))    os = 'iOS';
  else if (/Linux/i.test(ua))          os = 'Linux';

  if (/Edg\//i.test(ua))              nav = 'Microsoft Edge';
  else if (/OPR\//i.test(ua))         nav = 'Opera';
  else if (/Chrome\//i.test(ua))      nav = 'Chrome';
  else if (/Firefox\//i.test(ua))     nav = 'Firefox';
  else if (/Safari\//i.test(ua))      nav = 'Safari';

  return { os, nav };
}

/** Consulta ip-api.com (gratuito, 45 req/min, sem chave). */
async function fetchIPGeo(ip) {
  // IPs locais/privados: simula BH para desenvolvimento
  const isPrivate = ['127.0.0.1','::1','localhost'].includes(ip) ||
    /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);

  if (isPrivate) {
    return {
      status: 'local', country: 'Brasil', regionName: 'Minas Gerais',
      city: 'Belo Horizonte', lat: -19.9191, lon: -43.9386,
      isp: 'Rede Local', query: ip,
    };
  }

  try {
    const { data } = await axios.get(
      `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon,isp,query`,
      { timeout: 5000 }
    );
    return data?.status === 'success' ? data : null;
  } catch {
    return null;
  }
}

/** Grava log de auditoria de forma assíncrona (fire-and-forget). */
function saveAuditLog(entry) {
  setImmediate(async () => {
    try {
      await db.query(`
        INSERT INTO auth_audit_logs (
          username_digitado, usuario_id, ip, porta,
          pais, estado, cidade, isp,
          lat_ip, lon_ip, lat_gps, lon_gps,
          user_agent, os, navegador,
          status, detalhe, timestamp_utc
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW()
        )
      `, [
        entry.username    ?? null,
        entry.usuarioId   ?? null,
        entry.ip,
        entry.porta       ?? null,
        entry.pais        ?? null,
        entry.estado      ?? null,
        entry.cidade      ?? null,
        entry.isp         ?? null,
        entry.latIP       ?? null,
        entry.lonIP       ?? null,
        entry.latGPS      ?? null,
        entry.lonGPS      ?? null,
        entry.userAgent   ?? null,
        entry.os          ?? null,
        entry.navegador   ?? null,
        entry.status,
        entry.detalhe     ?? null,
      ]);
    } catch (e) {
      console.error('[geoBlock] Erro ao salvar audit log:', e.message);
    }
  });
}

// ── Middleware principal ───────────────────────────────────────────────────

async function geoBlockMiddleware(req, res, next) {
  const { email, lat, lon } = req.body ?? {};
  const ip    = extractIP(req);
  const porta = req.socket?.remotePort ?? null;
  const ua    = req.headers['user-agent'] ?? '';
  const { os, nav } = parseUA(ua);

  const latGPS = (lat !== undefined && lat !== null && lat !== '') ? parseFloat(lat) : null;
  const lonGPS = (lon !== undefined && lon !== null && lon !== '') ? parseFloat(lon) : null;

  const baseLog = { username: email, ip, porta, userAgent: ua, os, navegador: nav };

  // 1 — GPS ausente: valida por IP como fallback (redes corporativas podem bloquear GPS)
  if (latGPS === null || lonGPS === null || isNaN(latGPS) || isNaN(lonGPS)) {
    const geo = await fetchIPGeo(ip);
    const cidadeIP = (geo?.city ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const inRMBH_IP = geo?.status === 'local' ||
      RMBH_CITIES.has((geo?.city ?? '').toLowerCase()) ||
      RMBH_CITIES.has(cidadeIP);

    if (!inRMBH_IP) {
      saveAuditLog({
        ...baseLog, usuarioId: null,
        pais: geo?.country, estado: geo?.regionName, cidade: geo?.city, isp: geo?.isp,
        latIP: geo?.lat, lonIP: geo?.lon, latGPS: null, lonGPS: null,
        status: 'bloqueado_geo',
        detalhe: `GPS ausente e IP fora da RMBH: ${geo?.city ?? 'desconhecido'}`,
      });
      return res.status(403).json({
        code: 'GEO_BLOCKED',
        message: 'Acesso negado. Este sistema é acessível apenas na Região Metropolitana de Belo Horizonte.',
      });
    }

    // GPS ausente mas IP confirma RMBH — permite com aviso no log
    req.geoInfo = {
      ip, porta, userAgent: ua, os, navegador: nav,
      pais:    geo?.country    ?? null,
      estado:  geo?.regionName ?? null,
      cidade:  geo?.city       ?? null,
      isp:     geo?.isp        ?? null,
      latIP:   geo?.lat        ?? null,
      lonIP:   geo?.lon        ?? null,
      latGPS:  null,
      lonGPS:  null,
    };
    return next();
  }

  // 2 — GPS fora da RMBH
  if (!inRMBH(latGPS, lonGPS)) {
    const geo = await fetchIPGeo(ip);
    saveAuditLog({
      ...baseLog, usuarioId: null,
      pais: geo?.country, estado: geo?.regionName, cidade: geo?.city, isp: geo?.isp,
      latIP: geo?.lat, lonIP: geo?.lon, latGPS, lonGPS,
      status: 'bloqueado_geo',
      detalhe: `GPS fora da RMBH: ${latGPS.toFixed(4)}, ${lonGPS.toFixed(4)}`,
    });
    return res.status(403).json({
      code: 'GEO_BLOCKED',
      message: 'Acesso negado. Este sistema é acessível apenas na Região Metropolitana de Belo Horizonte.',
    });
  }

  // 3 — Enriquecer com geo por IP (não bloqueia por IP — GPS tem prioridade)
  const geo = await fetchIPGeo(ip);

  // Injeta dados para o handler de login usar no log de sucesso/falha
  req.geoInfo = {
    ip, porta, userAgent: ua, os, navegador: nav,
    pais:    geo?.country    ?? null,
    estado:  geo?.regionName ?? null,
    cidade:  geo?.city       ?? null,
    isp:     geo?.isp        ?? null,
    latIP:   geo?.lat        ?? null,
    lonIP:   geo?.lon        ?? null,
    latGPS,
    lonGPS,
  };

  next();
}

module.exports = { geoBlockMiddleware, saveAuditLog, extractIP, fetchIPGeo };
