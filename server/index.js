/* =====================================================================
   Gênesis — Servidor WhatsApp (Express + Socket.io + Evolution API)
   ===================================================================== */
require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const multer     = require('multer');
const cors       = require('cors');
const evo        = require('./evolution');
const authRoutes = require('./routes/auth');

const PORT         = process.env.PORT          || 3001;
const EVO_URL      = process.env.EVO_URL       || 'http://localhost:8080';
const EVO_KEY      = process.env.EVO_API_KEY   || '';
const EVO_INSTANCE = process.env.EVO_INSTANCE  || 'maestro360';
// URL pública/interna que a Evolution API usará para postar eventos neste servidor
const EVO_WEBHOOK  = process.env.EVO_WEBHOOK_URL    || `http://127.0.0.1:${PORT}/webhook`;
const EVO_SECRET   = process.env.EVO_WEBHOOK_SECRET || '';

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 20e6, // 20 MB para envio de mídia
});

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// ── Autenticação e audit log ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/funil', require('./routes/funil'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 16 * 1024 * 1024 }, // 16 MB
});

// Inicializa cliente Evolution
evo.init(io, {
  url:           EVO_URL,
  apiKey:        EVO_KEY,
  instanceName:  EVO_INSTANCE,
  webhookUrl:    EVO_WEBHOOK,
  webhookSecret: EVO_SECRET,
});

/* ── Webhook (Evolution API → este servidor) ────────────────────── */
app.post('/webhook', evo.handleWebhook);

/* ── Health check ─────────────────────────────────────────────────── */
app.get('/health', async (_req, res) => {
  const status = await evo.getStatus();
  res.json({ ok: true, status });
});

/* ── Status ───────────────────────────────────────────────────────── */
app.get('/status', async (_req, res) => {
  const status = await evo.getStatus();
  res.json({ status });
});

/* ── Chats ────────────────────────────────────────────────────────── */
app.get('/chats', async (_req, res) => {
  try {
    res.json(await evo.getChats());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Contatos ─────────────────────────────────────────────────────── */
app.get('/contacts', async (_req, res) => {
  try {
    res.json(await evo.getContacts());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Mensagens de um chat ─────────────────────────────────────────── */
app.get('/messages/:chatId', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 40, 100);
    res.json(await evo.getMessages(req.params.chatId, limit));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Enviar texto ─────────────────────────────────────────────────── */
app.post('/send/text', async (req, res) => {
  const { chatId, text } = req.body;
  if (!chatId || !text?.trim()) {
    return res.status(400).json({ error: 'chatId e text são obrigatórios' });
  }
  try {
    const id = await evo.sendText(chatId, text.trim());
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Enviar mídia ─────────────────────────────────────────────────── */
app.post('/send/media', upload.single('file'), async (req, res) => {
  const { chatId, caption } = req.body;
  if (!chatId || !req.file) {
    return res.status(400).json({ error: 'chatId e arquivo são obrigatórios' });
  }
  try {
    const base64 = req.file.buffer.toString('base64');
    const id     = await evo.sendMedia(chatId, base64, req.file.mimetype, req.file.originalname, caption || '');
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Enviar áudio PTT (mensagem de voz) ─────────────────────────── */
app.post('/send/audio', upload.single('file'), async (req, res) => {
  const { chatId } = req.body;
  if (!chatId || !req.file) {
    return res.status(400).json({ error: 'chatId e arquivo são obrigatórios' });
  }
  try {
    const base64 = req.file.buffer.toString('base64');
    const id     = await evo.sendAudio(chatId, base64);
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Buscar mídia (base64) por ID de mensagem ────────────────────── */
app.post('/media', async (req, res) => {
  const { msgId, chatId, fromMe } = req.body;
  if (!msgId || !chatId) return res.status(400).json({ error: 'msgId e chatId são obrigatórios' });
  try {
    const data = await evo.getMediaBase64(msgId, chatId, fromMe || false);
    if (!data) return res.status(404).json({ error: 'Mídia não disponível' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Marcar como lido ─────────────────────────────────────────────── */
app.post('/read/:chatId', async (req, res) => {
  try {
    await evo.markRead(req.params.chatId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Limpar instância (deleta histórico completo no Evolution API) ── */
app.post('/clear-instance', async (_req, res) => {
  try {
    await evo.clearInstance();
    io.emit('wpp:status', 'disconnected');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Desconectar ──────────────────────────────────────────────────── */
app.post('/disconnect', async (_req, res) => {
  try {
    await evo.disconnect();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Reinicializar (gerar novo QR) ───────────────────────────────── */
app.post('/reinit', async (_req, res) => {
  try {
    // Se já conectado, apenas notifica o frontend em vez de gerar novo QR
    const currentStatus = await evo.getStatus();
    if (currentStatus === 'open') {
      io.emit('wpp:status', 'ready');
      evo.emitReady();
      return res.json({ ok: true, already: true });
    }
    await evo.connectQR();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Enviar localização ────────────────────────────────────────────── */
app.post('/send/location', async (req, res) => {
  const { chatId, latitude, longitude, name, address } = req.body;
  if (!chatId || latitude == null || longitude == null) return res.status(400).json({ error: 'chatId, latitude e longitude são obrigatórios' });
  try { res.json({ ok: true, id: await evo.sendLocation(chatId, latitude, longitude, name, address) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Enviar enquete ────────────────────────────────────────────────── */
app.post('/send/poll', async (req, res) => {
  const { chatId, title, options, selectableCount } = req.body;
  if (!chatId || !title || !Array.isArray(options) || options.length < 2) return res.status(400).json({ error: 'chatId, title e options (min 2) são obrigatórios' });
  try { res.json({ ok: true, id: await evo.sendPoll(chatId, title, options, selectableCount) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Foto de perfil de contato ─────────────────────────────────────── */
app.get('/profile-pic/:jid', async (req, res) => {
  try {
    const url = await evo.getProfilePicture(req.params.jid);
    if (!url) return res.status(404).json({ error: 'Sem foto' });
    res.json({ url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Info da instância conectada ─────────────────────────────────────── */
app.get('/instance-info', async (_req, res) => {
  try { res.json(await evo.getInstanceInfo() || {}); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Socket.io ────────────────────────────────────────────────────── */
io.on('connection', async (socket) => {
  console.log('[Socket] Conectado:', socket.id);
  const status = await evo.getStatus();
  // Evolution API retorna: 'open', 'close', 'connecting' — mapeia para valores do frontend
  const STATUS_MAP = { open: 'ready', close: 'disconnected', connecting: 'connecting' };
  socket.emit('wpp:status', STATUS_MAP[status] || 'disconnected');

  socket.on('disconnect', () => {
    console.log('[Socket] Desconectado:', socket.id);
  });
});

/* ── Start ────────────────────────────────────────────────────────── */
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`[Gênesis WPP] Servidor iniciado na porta ${PORT}`);
  await evo.ensureInstance();
});

process.on('SIGTERM', async () => {
  console.log('[Gênesis WPP] Encerrando...');
  process.exit(0);
});
