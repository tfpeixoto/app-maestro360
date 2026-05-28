/* =====================================================================
   GOOGLE AUTH — OAuth 2.0 (Calendar + Drive)
   Usa Google Identity Services (token model, sem redirect)
   ===================================================================== */
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com'; // Configure no Google Cloud Console
const GOOGLE_SCOPES    = [
  'https://www.googleapis.com/auth/calendar.events',   // Agenda + Meet
  'https://www.googleapis.com/auth/drive.file',        // Drive
  'https://www.googleapis.com/auth/gmail.modify',      // Gmail (ler, marcar)
  'https://www.googleapis.com/auth/gmail.send',        // Gmail (enviar)
].join(' ');

const _GA_KEY = 'crm_google_token';

let _tokenClient = null;
let _gauthResolve = null;

function gauthIsConnected() {
  const t = _gauthGetStored();
  return !!(t && t.access_token && t.expires_at > Date.now());
}

function gauthGetToken() {
  const t = _gauthGetStored();
  return (t && t.expires_at > Date.now()) ? t.access_token : null;
}

function _gauthGetStored() {
  try { return JSON.parse(localStorage.getItem(_GA_KEY) || 'null'); } catch { return null; }
}

function _gauthStore(token, expiresIn) {
  localStorage.setItem(_GA_KEY, JSON.stringify({
    access_token: token,
    expires_at:   Date.now() + (expiresIn - 60) * 1000,
  }));
}

function gauthRevoke() {
  const t = _gauthGetStored();
  if (t?.access_token) {
    try { google.accounts.oauth2.revoke(t.access_token, () => {}); } catch {}
  }
  localStorage.removeItem(_GA_KEY);
}

function gauthInit() {
  return new Promise((resolve) => {
    if (typeof google === 'undefined' || !google?.accounts?.oauth2) {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = () => { _initTokenClient(); resolve(); };
      s.onerror = () => resolve();
      document.head.appendChild(s);
    } else {
      _initTokenClient();
      resolve();
    }
  });
}

function _initTokenClient() {
  if (_tokenClient) return;
  if (!google?.accounts?.oauth2) return;
  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES,
    callback: (resp) => {
      if (resp.error) {
        console.warn('[GoogleAuth] error:', resp.error);
        if (_gauthResolve) { _gauthResolve(null); _gauthResolve = null; }
        return;
      }
      _gauthStore(resp.access_token, parseInt(resp.expires_in, 10));
      if (_gauthResolve) { _gauthResolve(resp.access_token); _gauthResolve = null; }
      document.dispatchEvent(new CustomEvent('gauthConnected'));
    },
  });
}

function gauthSignIn() {
  return new Promise((resolve) => {
    if (!_tokenClient) {
      gauthInit().then(() => {
        if (!_tokenClient) { resolve(null); return; }
        _gauthResolve = resolve;
        _tokenClient.requestAccessToken({ prompt: 'consent' });
      });
      return;
    }
    _gauthResolve = resolve;
    _tokenClient.requestAccessToken({ prompt: gauthIsConnected() ? '' : 'consent' });
  });
}

/* ── Calendar API helpers ── */
async function calendarListEvents(timeMin, timeMax) {
  const token = gauthGetToken();
  if (!token) return [];
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return [];
  const d = await r.json();
  return d.items || [];
}

async function calendarCreateEvent(event) {
  const token = gauthGetToken();
  if (!token) return null;
  const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!r.ok) return null;
  return r.json();
}

async function calendarDeleteEvent(eventId) {
  const token = gauthGetToken();
  if (!token) return false;
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.ok || r.status === 204;
}

/* ── Drive API helpers ── */
async function driveFindOrCreateFolder(name, parentId = null) {
  const token = gauthGetToken();
  if (!token) return null;
  const q = parentId
    ? `mimeType='application/vnd.google-apps.folder' and name='${name}' and '${parentId}' in parents and trashed=false`
    : `mimeType='application/vnd.google-apps.folder' and name='${name}' and 'root' in parents and trashed=false`;
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const d = await r.json();
  if (d.files && d.files.length > 0) return d.files[0];
  const body = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) body.parents = [parentId];
  const c = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!c.ok) return null;
  return c.json();
}

async function driveEnsureClientFolder(leadId, leadNome) {
  const token = gauthGetToken();
  if (!token) return null;
  const lead = storeGet().find(l => l.id === leadId);
  if (lead?.driveFolderId) {
    return { id: lead.driveFolderId, webViewLink: lead.driveFolderUrl };
  }
  const root = await driveFindOrCreateFolder('clientes');
  if (!root) return null;
  const sub = await driveFindOrCreateFolder(leadNome, root.id);
  if (!sub) return null;
  leadUpdate(leadId, { driveFolderId: sub.id, driveFolderUrl: sub.webViewLink });
  return sub;
}

/* ── Gmail API helpers ── */
async function gmailListThreads({ q = '', maxResults = 30 } = {}) {
  const token = gauthGetToken();
  if (!token) return [];
  const params = new URLSearchParams({ maxResults, ...(q ? { q } : {}) });
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return [];
  const d = await r.json();
  return d.threads || [];
}

async function gmailGetThread(threadId) {
  const token = gauthGetToken();
  if (!token) return null;
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  return r.json();
}

async function gmailGetMessage(messageId) {
  const token = gauthGetToken();
  if (!token) return null;
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  return r.json();
}

async function gmailMarkRead(messageId) {
  const token = gauthGetToken();
  if (!token) return;
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ removeLabelIds: ['UNREAD'] }),
  });
}

async function gmailSend({ to, subject, body, replyToMessageId, threadId } = {}) {
  const token = gauthGetToken();
  if (!token) return null;

  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
  ];
  if (replyToMessageId) headers.push(`In-Reply-To: ${replyToMessageId}`);

  const raw = btoa(unescape(encodeURIComponent(headers.join('\r\n') + '\r\n\r\n' + body)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const payload = { raw };
  if (threadId) payload.threadId = threadId;

  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!r.ok) return null;
  return r.json();
}

/* Extrai header de uma mensagem Gmail */
function gmailHeader(msg, name) {
  return msg?.payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

/* Decodifica corpo da mensagem (base64url → string) */
function gmailDecodeBody(msg) {
  const find = (part) => {
    if (!part) return '';
    if (part.mimeType === 'text/plain' && part.body?.data) return part.body.data;
    if (part.mimeType === 'text/html'  && part.body?.data) return part.body.data;
    if (part.parts) {
      const plain = part.parts.find(p => p.mimeType === 'text/plain');
      if (plain?.body?.data) return plain.body.data;
      const html  = part.parts.find(p => p.mimeType === 'text/html');
      if (html?.body?.data) return html.body.data;
      for (const p of part.parts) { const r = find(p); if (r) return r; }
    }
    return '';
  };
  const data = find(msg?.payload);
  if (!data) return '';
  try {
    return decodeURIComponent(escape(atob(data.replace(/-/g,'+').replace(/_/g,'/'))));
  } catch {
    return '';
  }
}

/* ── STATUS GLOBAL GOOGLE — topbar ── */
function gauthUpdateTopbar() {
  const el = document.getElementById('gauthTopbarBtn');
  if (!el) return;
  if (gauthIsConnected()) {
    el.innerHTML = `<i class="bi bi-google" style="color:#34a853"></i> Google`;
    el.title = 'Google conectado — clique para desconectar';
    el.onclick = () => { if (confirm('Desconectar conta Google?')) { gauthRevoke(); gauthUpdateTopbar(); } };
  } else {
    el.innerHTML = `<i class="bi bi-google" style="color:#ea4335"></i> Conectar Google`;
    el.title = 'Conectar Google (Agenda, Drive, Gmail, Meet)';
    el.onclick = async () => {
      el.innerHTML = `<i class="bi bi-hourglass-split"></i> Conectando...`;
      el.disabled = true;
      await gauthSignIn();
      el.disabled = false;
      gauthUpdateTopbar();
      document.dispatchEvent(new CustomEvent('gauthConnected'));
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  gauthInit().then(gauthUpdateTopbar);
  document.addEventListener('gauthConnected', gauthUpdateTopbar);
});
