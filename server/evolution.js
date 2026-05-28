/* =====================================================================
   Gênesis — Evolution API client
   Substitui whatsapp-web.js por HTTP + webhooks via Evolution API v2.
   ===================================================================== */
const axios = require('axios');

let _io     = null;
let _config = {};

// Intervalo de reconexão quando a Evolution API está inacessível
let _reconnectTimer = null;
const RECONNECT_INTERVAL_MS = 15000;

/* ── Init ─────────────────────────────────────────────────────────── */
function init(io, config) {
  _io     = io;
  _config = config; // { url, apiKey, instanceName, webhookUrl, webhookSecret? }
}

/* ── HTTP helper ──────────────────────────────────────────────────── */
async function api(path, method = 'GET', data = null) {
  const res = await axios({
    method,
    url:     `${_config.url}${path}`,
    headers: { apikey: _config.apiKey, 'Content-Type': 'application/json' },
    ...(data !== null ? { data } : {}),  // não envia body em GET sem payload
    timeout: 15000,
  });
  return res.data;
}

/* ── Expõe _fetchAndEmitReady para uso externo ────────────────────── */
function emitReady() {
  return _fetchAndEmitReady();
}

/* ── Webhook receiver ─────────────────────────────────────────────── */
function handleWebhook(req, res) {
  // Valida secret se configurado
  if (_config.webhookSecret) {
    const header = req.headers['x-webhook-secret'] || req.headers['authorization'];
    if (header !== _config.webhookSecret) {
      return res.sendStatus(401);
    }
  }

  res.sendStatus(200); // responde imediatamente

  const body  = req.body || {};
  const event = (body.event || '').toLowerCase();
  const data  = body.data  || {};
  console.log(`[EVO] Webhook: ${event || '(sem event)'}`);

  switch (event) {
    case 'qrcode.updated':
      if (data.qrcode?.base64) {
        _io.emit('wpp:qr',     data.qrcode.base64);
        _io.emit('wpp:status', 'qr');
      }
      break;

    case 'connection.update': {
      const state = data.state || data.connection;
      if (state === 'open') {
        _clearReconnect();
        _io.emit('wpp:status', 'ready');
        _fetchAndEmitReady();
      } else if (state === 'close') {
        _io.emit('wpp:status', 'disconnected');
        _scheduleReconnect();
      } else if (state === 'connecting') {
        _io.emit('wpp:status', 'connecting');
      }
      break;
    }

    case 'messages.upsert':
      (data.messages || []).forEach(msg => {
        const n = _normalizeMsg(msg);
        if (n) _io.emit('wpp:message', n);
      });
      break;

    case 'messages.update':
      (data.messages || []).forEach(msg => {
        const ack = _statusToAck(msg.update?.status);
        if (ack !== null && msg.key?.id) {
          _io.emit('wpp:message_ack', { id: msg.key.id, ack });
        }
      });
      break;

    default:
      break;
  }
}

/* ── Reconexão automática ─────────────────────────────────────────── */
function _scheduleReconnect() {
  if (_reconnectTimer) return; // já agendado
  console.log(`[EVO] Desconectado — tentando reconectar em ${RECONNECT_INTERVAL_MS / 1000}s...`);
  _reconnectTimer = setTimeout(async () => {
    _reconnectTimer = null;
    try {
      const state = await getStatus();
      if (state === 'open') {
        console.log('[EVO] Reconexão desnecessária — já conectado.');
        return;
      }
      console.log('[EVO] Tentando reconectar...');
      await connectQR();
    } catch (e) {
      console.error('[EVO] Falha na reconexão:', e.message);
      _scheduleReconnect(); // reagenda se falhou
    }
  }, RECONNECT_INTERVAL_MS);
}

function _clearReconnect() {
  if (_reconnectTimer) {
    clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
  }
}

async function _fetchAndEmitReady() {
  try {
    const list = await api('/instance/fetchInstances');
    const inst = Array.isArray(list)
      ? list.find(i => i.instance?.instanceName === _config.instanceName)
      : null;
    _io.emit('wpp:ready', {
      name:       inst?.instance?.profileName || _config.instanceName,
      phone:      (inst?.instance?.wuid || '').replace('@s.whatsapp.net', ''),
      profilePic: inst?.instance?.profilePictureUrl || null,
    });
  } catch (_) { /* silencioso */ }
}

/* ── Normalização de mensagem ─────────────────────────────────────── */
function _normalizeMsg(msg) {
  const { key, message, messageTimestamp, pushName } = msg || {};
  if (!key || !message) return null;

  const chatId  = key.remoteJid || '';
  const isLidId = chatId.endsWith('@lid');
  const phone   = isLidId ? '' : chatId.replace(/@s\.whatsapp\.net|@g\.us/, '');

  let body    = '';
  let type    = 'chat';
  let hasMedia = false;
  let media   = null;
  let quotedMsgId = null;
  let location = null;
  let vcard    = null;

  if (message.conversation) {
    body = message.conversation;
  } else if (message.extendedTextMessage) {
    body        = message.extendedTextMessage.text || '';
    quotedMsgId = message.extendedTextMessage.contextInfo?.stanzaId || null;
  } else if (message.imageMessage) {
    type    = 'image';
    body    = message.imageMessage.caption || '';
    hasMedia = true;
    if (message.imageMessage.base64) {
      media = {
        mimetype: message.imageMessage.mimetype || 'image/jpeg',
        data:     message.imageMessage.base64,
        filename: 'image.jpg',
        filesize: 0,
      };
    }
  } else if (message.videoMessage) {
    type    = 'video';
    body    = message.videoMessage.caption || '';
    hasMedia = true;
  } else if (message.audioMessage) {
    type    = message.audioMessage.ptt ? 'ptt' : 'audio';
    hasMedia = true;
  } else if (message.documentMessage) {
    type    = 'document';
    body    = message.documentMessage.caption || message.documentMessage.title || '';
    hasMedia = true;
    if (message.documentMessage.base64) {
      media = {
        mimetype: message.documentMessage.mimetype || 'application/octet-stream',
        data:     message.documentMessage.base64,
        filename: message.documentMessage.fileName || 'document',
        filesize: message.documentMessage.fileLength || 0,
      };
    }
  } else if (message.stickerMessage) {
    type    = 'sticker';
    hasMedia = true;
  } else if (message.locationMessage) {
    type = 'location';
    location = {
      latitude:  message.locationMessage.degreesLatitude,
      longitude: message.locationMessage.degreesLongitude,
      name:      message.locationMessage.name || '',
      address:   message.locationMessage.address || '',
    };
    body = `${location.latitude},${location.longitude}`;
  } else if (message.contactMessage) {
    type = 'vcard';
    body = message.contactMessage.displayName || '';
    vcard = { displayName: message.contactMessage.displayName || '', raw: message.contactMessage.vcard || '' };
  } else if (message.protocolMessage) {
    type = 'revoked';
  }

  return {
    id:           key.id,
    chatId,
    chatName:     pushName || (phone && !isLidId ? phone : null) || null,
    contactName:  pushName || null,
    contactPhone: phone || null,
    body,
    type,
    timestamp:    messageTimestamp || Math.floor(Date.now() / 1000),
    fromMe:       key.fromMe || false,
    hasMedia,
    media,
    ack:          1,
    quotedMsgId,
    location,
    vcard,
  };
}

function _statusToAck(status) {
  const map = { PENDING: 0, SERVER_ACK: 1, DELIVERY_ACK: 2, READ: 3, PLAYED: 4 };
  return map[status] ?? null;
}

/* ── Contatos ─────────────────────────────────────────────────────── */
async function getContacts() {
  try {
    const r = await api(`/contact/fetchContacts/${_config.instanceName}`, 'POST', {});
    return Array.isArray(r) ? r : [];
  } catch (_) { return []; }
}

/* ── Buscar base64 de mídia por ID de mensagem ───────────────────── */
async function getMediaBase64(msgId, remoteJid, fromMe) {
  try {
    const r = await api(`/chat/getBase64FromMediaMessage/${_config.instanceName}`, 'POST', {
      message: { key: { id: msgId, remoteJid, fromMe: !!fromMe } },
    });
    return r; // { base64, mimetype, ... }
  } catch (_) { return null; }
}

/* ── Instância ────────────────────────────────────────────────────── */
async function ensureInstance() {
  try {
    // Verifica se a instância já existe
    let exists = false;
    try {
      const list = await api('/instance/fetchInstances');
      exists = Array.isArray(list) &&
        list.some(i => i.instance?.instanceName === _config.instanceName);
    } catch (e) {
      console.error('[EVO] fetchInstances falhou:', e?.response?.status, e?.response?.data || e.message);
      return;
    }

    if (!exists) {
      console.log(`[EVO] Criando instância "${_config.instanceName}"...`);
      try {
        await api('/instance/create', 'POST', {
          instanceName: _config.instanceName,
          integration:  'WHATSAPP-BAILEYS',
        });
      } catch (e) {
        // 400/403 = instância já existe com outro estado; continua
        if (e?.response?.status !== 400 && e?.response?.status !== 403) throw e;
        console.log(`[EVO] Instância já existe (${e?.response?.status}), continuando...`);
      }
    }

    // Configura webhook — Evolution API v2 exige payload dentro da chave "webhook"
    const webhookInner = {
      url:             _config.webhookUrl,
      enabled:         true,
      webhookByEvents: false,
      webhookBase64:   true,
      events: [
        'QRCODE_UPDATED',
        'CONNECTION_UPDATE',
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
      ],
    };
    if (_config.webhookSecret) webhookInner.secretToken = _config.webhookSecret;

    try {
      await api(`/webhook/set/${_config.instanceName}`, 'POST', { webhook: webhookInner });
      console.log(`[EVO] Instância "${_config.instanceName}" pronta. Webhook → ${_config.webhookUrl}`);
    } catch (e) {
      console.error('[EVO] Erro ao configurar webhook:', e?.response?.status, e?.response?.data || e.message);
    }
  } catch (e) {
    console.error('[EVO] Erro ao configurar instância:', e?.response?.status, e?.response?.data || e.message);
  }
}

/* ── Status ───────────────────────────────────────────────────────── */
async function getStatus() {
  try {
    const r = await api(`/instance/connectionState/${_config.instanceName}`);
    return r?.instance?.state || 'disconnected';
  } catch (_) { return 'disconnected'; }
}

/* ── QR / Reconectar ──────────────────────────────────────────────── */
async function connectQR() {
  const r = await api(`/instance/connect/${_config.instanceName}`);
  // v2 retorna o QR diretamente na resposta — emite imediatamente sem esperar webhook
  if (r?.base64) {
    _io.emit('wpp:qr', r.base64);
    _io.emit('wpp:status', 'qr');
  }
  return r;
}

/* ── Chats ────────────────────────────────────────────────────────── */
async function getChats(limit = 50) {
  try {
    const list = await api(`/chat/findChats/${_config.instanceName}`, 'POST', {});
    return (Array.isArray(list) ? list : []).slice(0, limit).map(c => {
      const lm  = c.lastMessage;
      const jid = c.remoteJid || c.id || '';
      const isLid  = jid.endsWith('@lid');
      const phone  = jid.replace(/@s\.whatsapp\.net|@g\.us|@lid/, '');
      const ts  = c.updatedAt ? Math.floor(new Date(c.updatedAt).getTime() / 1000)
                              : (c.conversationTimestamp || 0);
      // c.name no Evolution API v2 costuma ser o ID interno do banco (cuid) — ignorar
      const isCuid = s => typeof s === 'string' && /^[a-z0-9]{20,}$/.test(s);
      // @lid JIDs: o número extraído NÃO é telefone real; só usa pushName/name
      const chatName = c.pushName || (isCuid(c.name) ? null : c.name) || (isLid ? null : phone);
      return {
        id:          jid,
        name:        chatName,
        pushName:    c.pushName || null,
        phone:       isLid ? null : phone,
        unreadCount: c.unreadCount || 0,
        timestamp:   ts,
        lastMessage: lm ? {
          body:      lm.message?.conversation
                  || lm.message?.extendedTextMessage?.text
                  || '',
          type:      lm.messageType ? lm.messageType.replace('Message', '').toLowerCase() : 'chat',
          fromMe:    lm.key?.fromMe || false,
          timestamp: lm.messageTimestamp || ts,
        } : null,
      };
    });
  } catch (_) { return []; }
}

/* ── Mensagens ────────────────────────────────────────────────────── */
async function getMessages(chatId, limit = 40) {
  try {
    const r = await api(`/chat/findMessages/${_config.instanceName}`, 'POST', {
      where: { key: { remoteJid: chatId } },
      limit,
      order: [['messageTimestamp', 'DESC']],
    });
    // v2 pode retornar: r.messages.records, r.records, ou array direto
    const records = r?.messages?.records || r?.records || (Array.isArray(r) ? r : []);
    const normalized = records.map(_normalizeMsg).filter(Boolean).reverse();
    // Deduplica por ID de mensagem (Evolution API pode retornar registros duplicados)
    const seen = new Set();
    return normalized.filter(m => m.id && !seen.has(m.id) && seen.add(m.id));
  } catch (e) {
    console.error('[EVO] getMessages erro:', e?.response?.status, e?.response?.data || e.message);
    return [];
  }
}

/* ── Normaliza chatId para o campo "number" da Evolution API v2 ─── */
// @s.whatsapp.net → só dígitos (phone); @lid e @g.us → JID completo
function _toNumber(chatId) {
  if (chatId.endsWith('@s.whatsapp.net')) return chatId.replace('@s.whatsapp.net', '');
  return chatId; // @lid, @g.us — Evolution API v2 aceita JID completo
}

/* ── Enviar texto ─────────────────────────────────────────────────── */
async function sendText(chatId, text) {
  const r = await api(`/message/sendText/${_config.instanceName}`, 'POST', {
    number: _toNumber(chatId),
    text,
  });
  return r?.key?.id || null;
}

/* ── Enviar mídia ─────────────────────────────────────────────────── */
async function sendMedia(chatId, base64, mimetype, filename, caption = '') {
  const mediatype = mimetype.startsWith('image') ? 'image'
    : mimetype.startsWith('video')               ? 'video'
    : mimetype.startsWith('audio')               ? 'audio'
    : 'document';
  const r = await api(`/message/sendMedia/${_config.instanceName}`, 'POST', {
    number:   _toNumber(chatId),
    mediatype, caption,
    media:    base64,
    fileName: filename,
  });
  return r?.key?.id || null;
}

/* ── Enviar áudio como PTT (mensagem de voz) ─────────────────────── */
async function sendAudio(chatId, base64) {
  const r = await api(`/message/sendWhatsAppAudio/${_config.instanceName}`, 'POST', {
    number:   _toNumber(chatId),
    audio:    base64,
    encoding: true,
  });
  return r?.key?.id || null;
}

/* ── Marcar como lido ─────────────────────────────────────────────── */
async function markRead(chatId) {
  await api(`/chat/markMessageAsRead/${_config.instanceName}`, 'POST', {
    readMessages: [{ remoteJid: chatId, fromMe: false, id: 'all' }],
  });
}

/* ── Desconectar ──────────────────────────────────────────────────── */
async function disconnect() {
  _clearReconnect();
  await api(`/instance/logout/${_config.instanceName}`, 'DELETE');
}

/* ── Limpar instância (deleta e recria — apaga histórico completo) ── */
async function clearInstance() {
  _clearReconnect();
  // Logout first (ignore errors)
  try { await api(`/instance/logout/${_config.instanceName}`, 'DELETE'); } catch (_) {}
  // Try to delete the instance entirely (removes all cached chats/messages from Evolution API DB)
  let deleted = false;
  for (const path of [
    `/instance/delete/${_config.instanceName}`,
    `/instance/${_config.instanceName}`,
  ]) {
    try {
      await api(path, 'DELETE');
      console.log(`[EVO] Instância deletada via ${path}`);
      deleted = true;
      break;
    } catch (e) {
      console.warn(`[EVO] Delete via ${path} falhou:`, e?.response?.status);
    }
  }
  if (!deleted) {
    console.error('[EVO] Não foi possível deletar a instância. Tentando apenas logout.');
  }
  // Wait a moment then recreate
  await new Promise(r => setTimeout(r, 1000));
  await ensureInstance();
  console.log('[EVO] Instância recriada limpa.');
}

async function sendLocation(chatId, latitude, longitude, name, address) {
  return api(`/message/sendLocation/${_config.instanceName}`, 'POST', {
    number: _toNumber(chatId),
    locationMessage: { latitude, longitude, name: name || '', address: address || '' },
  });
}

async function sendPoll(chatId, title, values, selectableCount) {
  return api(`/message/sendPoll/${_config.instanceName}`, 'POST', {
    number: _toNumber(chatId),
    pollMessage: { name: title, values, selectableCount: selectableCount || 1 },
  });
}

async function getProfilePicture(jid) {
  try {
    const r = await api(`/chat/fetchProfilePictureUrl/${_config.instanceName}`, 'POST', { number: jid });
    return r?.profilePictureUrl || null;
  } catch { return null; }
}

async function getInstanceInfo() {
  try {
    const r = await api(`/instance/fetchInstances`, 'GET');
    const inst = Array.isArray(r) ? r.find(i => i.instance?.instanceName === _config.instanceName) : r;
    return inst?.instance || null;
  } catch { return null; }
}

module.exports = {
  init,
  handleWebhook,
  ensureInstance,
  getStatus,
  connectQR,
  emitReady,
  getChats,
  getContacts,
  getMessages,
  getMediaBase64,
  sendText,
  sendMedia,
  sendAudio,
  markRead,
  disconnect,
  clearInstance,
  sendLocation,
  sendPoll,
  getProfilePicture,
  getInstanceInfo,
};
