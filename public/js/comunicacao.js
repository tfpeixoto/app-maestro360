/* =====================================================================
   COMUNICAÇÃO — WhatsApp Web + Gmail integrado ao Gênesis
   Etapas: Socket.io → QR → Chat list → Mensagens → CRM

   WPP_BASE deve apontar para o servidor Node.js:
   - Em produção (com NGINX proxy): '/wpp'
   - Em dev local: 'http://localhost:3001'
   ===================================================================== */

const WPP_BASE        = '/wpp';
const WPP_SOCKET_PATH = '/wpp/socket.io';

/* ─────────────────────────────────────────────
   TAB SYSTEM — WhatsApp | E-mail
───────────────────────────────────────────── */
let _comTab = 'wpp'; // 'wpp' | 'email'

function _comSwitchTab(tab) {
  _comTab = tab;
  const btnWpp   = document.getElementById('comTabWpp');
  const btnEmail = document.getElementById('comTabEmail');
  const panelWpp   = document.getElementById('comPanelWpp');
  const panelEmail = document.getElementById('comPanelEmail');
  if (!btnWpp) return;

  if (tab === 'wpp') {
    btnWpp.classList.add('com-tab-active');
    btnEmail.classList.remove('com-tab-active');
    panelWpp.style.display   = 'flex';
    panelEmail.style.display = 'none';
  } else {
    btnEmail.classList.add('com-tab-active');
    btnWpp.classList.remove('com-tab-active');
    panelWpp.style.display   = 'none';
    panelEmail.style.display = 'flex';
    // Para o polling de mensagens ao sair da aba WPP
    _wppStopMsgPolling();
    if (typeof initEmail === 'function' && !panelEmail.dataset.loaded) {
      panelEmail.dataset.loaded = '1';
      initEmail(panelEmail);
    }
  }
}

/* ── ESTADO ── */
const WPP = {
  status:        'disconnected', // disconnected | qr | connecting | ready | server_offline
  socket:        null,
  chats:         [],             // lista de chats carregados
  contacts:      {},             // JID → nome real (do Evolution API)
  chatFilter:    '',             // texto de busca
  leadFilter:    '',             // texto de busca de leads
  currentChatId: null,
  messages:      {},             // chatId → [msg, ...]
  info:          null,           // { name, phone } da conta conectada
  qrImg:         null,
  loadingMsgs:   false,
  sidebarView:   'chats',       // 'chats' | 'leads'
  qrTimer:       null,
  qrCountdown:   60,
  _connPoller:   null,          // polling de status enquanto conectado (detecta desconexão pelo celular)
  selectedLeadId: null,
  infoPanelOpen: false,
  showOtherChats: false,        // controla colapso de "Outros contatos"
  selectMode:    false,
  selectedMsgs:  new Set(),
  _stuckTimer:   null,
  _qrTimeout:    null,          // timeout para chegada do QR via webhook
  _statusPoller: null,          // polling fallback quando webhooks não chegam
  _msgPoller:    null,          // polling de novas mensagens do chat aberto
  replyTo:       null,          // mensagem citada (preview no input)
  profilePics:   {},            // chatId → URL da foto de perfil
  connectedUser: null,          // { name, profilePic } do usuário conectado
};

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
function initComunicacao() {
  const el = document.getElementById('page-comunicacao');
  if (!el) return;
  _wppInjectStyles();
  _comInjectTabStyles();
  // Esconde o botão flutuante do WA (desnecessário dentro do módulo de comunicação)
  const fabWrap  = document.getElementById('wppFabWrap');
  const fabPanel = document.getElementById('wppChatFabPanel');
  if (fabWrap)  fabWrap.style.display  = 'none';
  if (fabPanel) { fabPanel.classList.remove('open'); fabPanel.style.display = 'none'; }
  el.innerHTML = `
    <div style="height:calc(100vh - 60px);display:flex;flex-direction:column;margin:-28px;overflow:hidden">

      <!-- TABS -->
      <div style="display:flex;align-items:center;background:white;border-bottom:1px solid #e0e0e0;padding:0 20px;flex-shrink:0">
        <button id="comTabWpp" class="com-tab com-tab-active" onclick="_comSwitchTab('wpp')">
          <i class="bi bi-whatsapp"></i> WhatsApp
        </button>
        <button id="comTabEmail" class="com-tab" onclick="_comSwitchTab('email')">
          <i class="bi bi-envelope-fill"></i> E-mail
        </button>
      </div>

      <!-- PANEL: WhatsApp -->
      <div id="comPanelWpp" style="display:flex;flex:1;overflow:hidden;flex-direction:column">
        <div id="wppRoot" style="flex:1;display:flex;flex-direction:column;overflow:hidden"></div>
      </div>

      <!-- PANEL: Email -->
      <div id="comPanelEmail" style="display:none;flex:1;overflow:hidden;flex-direction:column"></div>

    </div>`;
  _wppConnect();
}

/* ─────────────────────────────────────────────
   SOCKET.IO — Conexão e eventos
───────────────────────────────────────────── */
function _wppConnect() {
  if (WPP.socket?.connected) { _wppRender(); return; }

  if (typeof io === 'undefined') {
    WPP.status = 'no_lib';
    _wppRender();
    return;
  }

  WPP.socket = io(window.location.origin, {
    path:              WPP_SOCKET_PATH,
    reconnection:      true,
    reconnectionDelay: 3000,
    timeout:           8000,
    transports:        ['websocket', 'polling'],
  });

  WPP.socket.on('connect', () => {
    console.log('[WPP] Socket conectado');
  });

  WPP.socket.on('connect_error', () => {
    WPP.status = 'server_offline';
    _wppRender();
  });

  WPP.socket.on('wpp:status', (status) => {
    WPP.status = status;
    if (status !== 'qr') {
      clearInterval(WPP.qrTimer);
      WPP.qrTimer = null;
      clearInterval(WPP._statusPoller);
      WPP._statusPoller = null;
    }
    _wppRender();
    if (status === 'ready') { _wppLoadChats(); _wppStartConnPoller(); }
  });

  WPP.socket.on('wpp:ready', (info) => {
    WPP.info   = info;
    WPP.status = 'ready';
    // Popula connectedUser imediatamente com dados do evento (profilePic pode vir do servidor)
    if (info.name || info.phone) {
      WPP.connectedUser = {
        name:       info.name || info.phone || 'WhatsApp',
        profilePic: info.profilePic || null,
      };
    }
    _wppRenderApp();
    _wppLoadChats();
    _wppStartConnPoller();
    _wppLoadConnectedUserProfile(); // tenta atualizar com dados mais frescos
  });

  WPP.socket.on('wpp:qr', (img) => {
    WPP.qrImg  = img;
    WPP.status = 'qr';
    clearInterval(WPP.qrTimer);
    WPP.qrCountdown = 60;
    _wppRender();
    WPP.qrTimer = setInterval(() => {
      WPP.qrCountdown--;
      const cdEl = document.getElementById('wppQrCountdown');
      const barEl = document.getElementById('wppQrBar');
      if (cdEl) cdEl.textContent = WPP.qrCountdown;
      if (barEl) barEl.style.width = (WPP.qrCountdown / 60 * 100) + '%';
      if (WPP.qrCountdown <= 0) {
        clearInterval(WPP.qrTimer);
        WPP.qrTimer = null;
        WPP.qrImg = null;
        _wppSolicitarQR();
      }
    }, 1000);
    // Polling fallback: verifica status a cada 3s caso webhook não chegue
    clearInterval(WPP._statusPoller);
    WPP._statusPoller = setInterval(async () => {
      if (WPP.status !== 'qr') { clearInterval(WPP._statusPoller); return; }
      try {
        const r = await fetch(`${WPP_BASE}/status`);
        const j = await r.json();
        if (j.status === 'open') {
          clearInterval(WPP._statusPoller);
          // Aciona reinit que detecta "já conectado" e emite ready
          fetch(`${WPP_BASE}/reinit`, { method: 'POST' }).catch(() => {});
        }
      } catch (_) {}
    }, 3000);
  });

  // Fallback: QR bruto (caso qrcode lib falhe no servidor)
  WPP.socket.on('wpp:qr_raw', (rawQr) => {
    WPP.status = 'qr';
    // Renderiza QR no canvas usando qrcode.js se disponível, senão exibe link
    clearInterval(WPP.qrTimer);
    WPP.qrCountdown = 60;
    const root = document.getElementById('wppRoot');
    if (root) {
      root.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;background:#f0f2f5">
        <div class="card" style="text-align:center;padding:40px 48px;max-width:400px">
          <div style="font-size:16px;font-weight:800;color:var(--primary);margin-bottom:4px">Escanear QR Code</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:20px">Abra o WhatsApp no celular → Dispositivos vinculados → Vincular um dispositivo</div>
          <canvas id="wppQrCanvas" style="border:4px solid var(--border);border-radius:12px;margin-bottom:16px"></canvas>
          <div style="font-size:11px;color:var(--muted)">Se não aparecer, atualize a página</div>
        </div>
      </div>`;
      // Tenta renderizar com QRCode.js (CDN)
      if (typeof QRCode !== 'undefined') {
        new QRCode(document.getElementById('wppQrCanvas'), { text: rawQr, width: 240, height: 240 });
      }
    }
  });

  WPP.socket.on('wpp:loading', (pct) => {
    const el = document.getElementById('wppLoadPct');
    if (el) el.textContent = pct + '%';
  });

  WPP.socket.on('wpp:message', (msg) => {
    _wppOnIncomingMessage(msg);
  });

  WPP.socket.on('wpp:message_ack', ({ id, ack }) => {
    _wppUpdateAck(id, ack);
  });

  WPP.socket.on('wpp:error', (err) => {
    console.warn('[WPP]', err);
    _wppToast(err, 'error');
  });

  _wppRender(); // mostra tela de loading imediatamente
}

/* ─────────────────────────────────────────────
   RENDER — Roteador de telas
───────────────────────────────────────────── */
function _wppRender() {
  const root = document.getElementById('wppRoot');
  if (!root) return;

  if (WPP.status !== 'connecting') {
    clearTimeout(WPP._stuckTimer);
    WPP._stuckTimer = null;
    clearTimeout(WPP._qrTimeout);
    WPP._qrTimeout = null;
  }

  switch (WPP.status) {
    case 'no_lib':
    case 'server_offline': root.innerHTML = _wppRenderOffline(); break;
    case 'evo_offline':    root.innerHTML = _wppRenderEvoOffline(); break;
    case 'disconnected':   root.innerHTML = _wppRenderDisconnected(); break;
    case 'qr':             root.innerHTML = _wppRenderQR(); break;
    case 'connecting':     root.innerHTML = _wppRenderConnecting(); break;
    case 'ready':          _wppRenderApp(); break;
    default:               root.innerHTML = _wppRenderConnecting();
  }
}

/* ── Tela: servidor offline ── */
function _wppRenderOffline() {
  return `
    <div style="flex:1;display:flex;align-items:center;justify-content:center;background:#f0f2f5">
      <div style="text-align:center;max-width:380px;padding:40px">
        <div style="font-size:56px;margin-bottom:16px">⚠️</div>
        <div style="font-size:20px;font-weight:900;color:var(--primary);margin-bottom:8px">Servidor offline</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:24px;line-height:1.6">
          O servidor WhatsApp (Node.js) não está rodando.<br>
          Acesse a VPS e execute:
        </div>
        <div style="background:#1e293b;color:#86efac;border-radius:10px;padding:14px 18px;font-family:monospace;font-size:12px;text-align:left;margin-bottom:20px">
          cd /var/www/genesis/server<br>
          pm2 start index.js --name maestro-wpp<br>
          pm2 save
        </div>
        <button class="btn btn-primary" onclick="_wppConnect()">
          <i class="bi bi-arrow-clockwise"></i> Tentar novamente
        </button>
      </div>
    </div>`;
}

/* ── Tela: Evolution API inacessível ── */
function _wppRenderEvoOffline() {
  return `
    <div style="flex:1;display:flex;align-items:center;justify-content:center;background:#f0f2f5">
      <div style="text-align:center;max-width:440px;padding:40px">
        <div style="font-size:52px;margin-bottom:16px">📡</div>
        <div style="font-size:20px;font-weight:900;color:var(--primary);margin-bottom:8px">Evolution API inacessível</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:20px;line-height:1.7">
          O servidor Node.js está ativo mas não conseguiu se comunicar com a<br>
          <strong>Evolution API</strong> ou o QR code não chegou via webhook.
        </div>
        <div style="background:#1e293b;color:#86efac;border-radius:10px;padding:14px 18px;font-family:monospace;font-size:11px;text-align:left;margin-bottom:16px;line-height:1.8">
          # Verificar se a Evolution API está rodando:<br>
          docker compose up -d<br>
          curl http://localhost:8080<br><br>
          # Verificar variáveis no server/.env:<br>
          EVO_URL=http://localhost:8080<br>
          EVO_API_KEY=SUA_CHAVE<br>
          EVO_WEBHOOK_URL=http://127.0.0.1:3001/webhook
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:20px;line-height:1.6;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;text-align:left">
          <strong>Dica:</strong> Se a Evolution API roda em Docker, o <code>EVO_WEBHOOK_URL</code> deve usar o IP do host (ex: <code>http://172.17.0.1:3001/webhook</code>) e não <code>127.0.0.1</code>.
        </div>
        <button class="btn btn-primary" onclick="_wppSolicitarQR()">
          <i class="bi bi-arrow-clockwise"></i> Tentar novamente
        </button>
      </div>
    </div>`;
}

/* ── Tela: desconectado (sem sessão) ── */
function _wppRenderDisconnected() {
  return `
    <div style="flex:1;display:flex;align-items:center;justify-content:center;background:#f0f2f5">
      <div style="text-align:center;max-width:360px;padding:40px">
        <div style="width:80px;height:80px;background:#25d366;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">
          <i class="bi bi-whatsapp" style="font-size:40px;color:white"></i>
        </div>
        <div style="font-size:20px;font-weight:900;color:var(--primary);margin-bottom:8px">Conectar WhatsApp</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:28px;line-height:1.6">
          Escaneie o QR code com o celular para usar o WhatsApp nesta tela
        </div>
        <button class="btn btn-primary" style="background:#25d366;font-size:15px;padding:12px 28px" onclick="_wppSolicitarQR()">
          <i class="bi bi-qr-code-scan"></i> Gerar QR Code
        </button>
      </div>
    </div>`;
}

/* ── Tela: QR code ── */
function _wppRenderQR() {
  return `
    <div style="flex:1;display:flex;align-items:center;justify-content:center;background:#f0f2f5">
      <div class="card" style="text-align:center;padding:40px 48px;max-width:400px">
        <div style="font-size:16px;font-weight:800;color:var(--primary);margin-bottom:4px">Escanear QR Code</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:24px">
          Abra o WhatsApp no celular → Dispositivos vinculados → Vincular um dispositivo
        </div>
        ${WPP.qrImg
          ? `<img src="${WPP.qrImg}" style="width:240px;height:240px;border:4px solid var(--border);border-radius:12px;margin-bottom:16px" />`
          : `<div style="width:240px;height:240px;border:4px solid var(--border);border-radius:12px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center">
               <div style="width:32px;height:32px;border:3px solid var(--primary);border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite"></div>
             </div>`}
        <div style="margin-bottom:10px">
          <div style="height:4px;background:#e9edef;border-radius:2px;overflow:hidden;margin-bottom:4px">
            <div id="wppQrBar" style="height:100%;width:${(WPP.qrCountdown/60*100)}%;background:#25d366;border-radius:2px;transition:width 1s linear"></div>
          </div>
          <div style="font-size:11px;color:var(--muted)">
            <i class="bi bi-clock" style="color:#25d366"></i>
            Expira em: <strong id="wppQrCountdown">${WPP.qrCountdown}</strong> segundos
          </div>
        </div>
        <div style="font-size:11px;color:var(--muted)">
          <i class="bi bi-shield-check" style="color:#25d366"></i>
          Se expirar, um novo QR é gerado automaticamente
        </div>
      </div>
    </div>`;
}

/* ── Tela: conectando (autenticado, carregando) ── */
function _wppRenderConnecting() {
  clearTimeout(WPP._stuckTimer);
  WPP._stuckTimer = setTimeout(() => {
    const el = document.getElementById('wppStuckActions');
    if (el) el.style.display = 'block';
  }, 10000);

  return `
    <div style="flex:1;display:flex;align-items:center;justify-content:center;background:#f0f2f5">
      <div style="text-align:center;max-width:360px;padding:40px">
        <div style="width:48px;height:48px;border:4px solid #25d366;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px"></div>
        <div style="font-size:15px;font-weight:700;color:var(--primary)">Conectando ao WhatsApp...</div>
        <div style="font-size:12px;color:var(--muted);margin-top:6px">Carregando <span id="wppLoadPct">0</span>%</div>

        <div id="wppStuckActions" style="display:none;margin-top:28px;background:white;border-radius:12px;border:1px solid var(--border);padding:16px 20px">
          <div style="font-size:12px;color:var(--muted);margin-bottom:12px"><i class="bi bi-clock"></i> Demorando mais que o esperado?</div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="_wppSolicitarQR()">
              <i class="bi bi-qr-code-scan"></i> Gerar QR Code
            </button>
            <button class="btn btn-ghost btn-sm" style="color:#ef4444" onclick="_wppDesconectar()">
              <i class="bi bi-x-circle"></i> Desconectar
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

/* ─────────────────────────────────────────────
   APP — Layout principal (quando conectado)
───────────────────────────────────────────── */
function _wppRenderApp() {
  const root = document.getElementById('wppRoot');
  if (!root) return;

  root.innerHTML = `
    <!-- LAYOUT PRINCIPAL -->
    <div style="display:flex;flex:1;overflow:hidden">

      <!-- SIDEBAR: lista de chats -->
      <div id="wppSidebar" style="width:340px;flex-shrink:0;display:flex;flex-direction:column;background:white;border-right:1px solid #e9edef">

        <!-- Header do sidebar (dark) -->
        <div style="background:#111b21;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1f2c33">
          ${(() => {
            // Resolve nome real: evita mostrar "WhatsApp" ou nome da instância como nome humano
            const rawName  = WPP.connectedUser?.name || WPP.info?.name || '';
            const rawPhone = WPP.info?.phone || '';
            const isValidName = rawName && !/^\d+$/.test(rawName) && rawName.toLowerCase() !== 'whatsapp' && rawName.length > 1;
            const displayName = isValidName ? rawName : (_wppFmtPhone(rawPhone) || rawPhone || 'WhatsApp');
            const pic         = WPP.connectedUser?.profilePic || null;
            const initial     = displayName[0]?.toUpperCase() || 'W';
            const phoneLine   = rawPhone && rawPhone !== displayName ? _wppFmtPhone(rawPhone) || rawPhone : (isValidName ? rawPhone : '');
            return `
          <div style="display:flex;align-items:center;gap:11px;min-width:0">
            ${pic ? `<img data-wpp-connected-avatar src="${pic}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.35)" title="${_esc(displayName)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
            <div style="width:44px;height:44px;background:linear-gradient(135deg,#25d366,#128c7e);border-radius:50%;display:${pic?'none':'flex'};align-items:center;justify-content:center;font-weight:800;font-size:16px;color:white;flex-shrink:0;box-shadow:0 2px 6px rgba(37,211,102,0.4);position:relative" title="${_esc(displayName)}">
              ${initial}
              <div style="position:absolute;bottom:1px;right:1px;width:11px;height:11px;background:#25d366;border-radius:50%;border:2px solid #111b21"></div>
            </div>
            <div style="min-width:0">
              <div data-wpp-connected-name style="font-size:13px;font-weight:700;color:#e9edef;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(displayName)}</div>
              <div style="font-size:11px;color:#8696a0;display:flex;align-items:center;gap:5px">
                <span style="display:inline-block;width:6px;height:6px;background:#25d366;border-radius:50%"></span>
                <span>${phoneLine || 'Conectado'}</span>
              </div>
            </div>
          </div>`;
          })()}
          <div style="display:flex;gap:2px;flex-shrink:0">
            <button class="wpp-icon-btn wpp-icon-dark" onclick="_wppNovaConversa()" title="Nova conversa">
              <i class="bi bi-pencil-square"></i>
            </button>
            <button class="wpp-icon-btn wpp-icon-dark" onclick="_wppCampanha()" title="Disparar campanha">
              <i class="bi bi-megaphone-fill"></i>
            </button>
            <button class="wpp-icon-btn wpp-icon-dark" onclick="_wppLimparHistorico()" title="Limpar histórico de conversas" style="color:#fbbf24">
              <i class="bi bi-trash3"></i>
            </button>
            <button class="wpp-icon-btn wpp-icon-dark" onclick="_wppDesconectar()" title="Desconectar" style="color:#f87171">
              <i class="bi bi-box-arrow-right"></i>
            </button>
          </div>
        </div>

        <!-- Busca (Conversas) -->
        <div id="wppSearchBar" style="padding:8px 12px;background:#f0f2f5">
          <div style="position:relative">
            <i class="bi bi-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#667781;font-size:13px"></i>
            <input
              id="wppSearch"
              style="width:100%;padding:7px 10px 7px 32px;border:none;border-radius:8px;background:white;font-size:13px;outline:none;color:#111b21"
              placeholder="Buscar ou começar nova conversa"
              oninput="WPP.chatFilter=this.value.toLowerCase();_wppRenderChatList()"
            />
          </div>
        </div>

        <!-- Lista de chats -->
        <div id="wppChatList" style="flex:1;overflow-y:auto"></div>
      </div>

      <!-- MAIN: área de conversa -->
      <div id="wppMain" style="flex:1;display:flex;overflow:hidden;background:#efeae2">
        <!-- Estado inicial: nenhum chat selecionado -->
        <div id="wppNoChatScreen" style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;background:#f0f2f5">
          <div style="width:96px;height:96px;border:2px solid #d1d7db;border-radius:50%;display:flex;align-items:center;justify-content:center">
            <i class="bi bi-chat-dots" style="font-size:42px;color:#d1d7db"></i>
          </div>
          <div style="text-align:center">
            <div style="font-size:20px;font-weight:300;color:#41525d;margin-bottom:6px">Gênesis WhatsApp</div>
            <div style="font-size:13px;color:#667781">Selecione uma conversa para começar</div>
          </div>
        </div>
        <!-- Área do chat (preenchida ao selecionar) -->
        <div id="wppChatArea" style="flex:1;display:none;flex-direction:column;overflow:hidden"></div>
      </div>

      <!-- PAINEL INFO do lead -->
      <div id="wppInfoSide" style="width:300px;display:none;flex-shrink:0;border-left:1px solid #e9edef;background:white;overflow-y:auto;flex-direction:column"></div>
    </div>

    <!-- TOAST -->
    <div id="wppToast" style="display:none;position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1f2937;color:white;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:3000"></div>
  `;

  _wppRenderChatList();
}

/* ─────────────────────────────────────────────
   CHAT LIST
───────────────────────────────────────────── */
async function _wppLoadChats() {
  try {
    const res   = await fetch(`${WPP_BASE}/chats`);
    WPP.chats   = await res.json();
    _wppRenderChatList();
    _wppAutoRegistrarContatos();
    // Carrega nomes reais de contatos em background
    _wppLoadContacts();
    _wppLoadProfilePics();
  } catch (e) {
    console.error('[WPP] Erro ao carregar chats:', e);
  }
}

async function _wppLoadContacts() {
  try {
    const res  = await fetch(`${WPP_BASE}/contacts`);
    if (!res.ok) return;
    const list = await res.json();
    if (!Array.isArray(list)) return;
    // Indexa JID → nome real (também pelo campo "lid" se a API retornar)
    list.forEach(c => {
      const jid  = c.id || c.remoteJid || '';
      const lid  = c.lid || '';  // @lid alternativo que a Evolution API pode retornar
      const nome = c.pushName || c.profileName || c.name || '';
      if (!jid) return;
      // Só guarda se for um nome legível (não só dígitos, não @, não cuid longo)
      const isValid = nome && !/^\d{10,}$/.test(nome) && !nome.includes('@') && nome.length < 60;
      if (isValid) {
        WPP.contacts[jid] = nome;
        if (lid) WPP.contacts[lid] = nome;
      }
    });
    // Atualiza nomes nos chats que ainda mostram só número/JID/@lid/placeholder
    WPP.chats.forEach(chat => {
      const realName = WPP.contacts[chat.id];
      const curName = chat.name || '';
      const isPlaceholder = !curName || /^\d+$/.test(curName) || curName.includes('@') || curName.startsWith('Contato');
      if (realName && isPlaceholder) {
        chat.name = realName;
      }
    });
    _wppRenderChatList();
  } catch (_) {}
}

async function _wppLoadProfilePics() {
  try {
    const chats = WPP.chats || [];
    // Load in batches of 5 to avoid overloading the server
    for (let i = 0; i < Math.min(chats.length, 30); i++) {
      const c = chats[i];
      if (WPP.profilePics[c.id]) continue;
      fetch(`${WPP_BASE}/profile-pic/${encodeURIComponent(c.id)}`)
        .then(r => r.ok ? r.json() : null)
        .then(j => {
          if (j?.url) {
            WPP.profilePics[c.id] = j.url;
            // Update avatar in chat list
            const el = document.querySelector(`[data-chat-avatar="${CSS.escape(c.id)}"]`);
            if (el) el.src = j.url;
          }
        })
        .catch(() => {});
    }
  } catch {}
}

async function _wppLoadConnectedUserProfile() {
  try {
    const r = await fetch(`${WPP_BASE}/instance-info`);
    if (!r.ok) return;
    const info = await r.json();
    if (info && (info.profileName || info.profilePicUrl)) {
      WPP.connectedUser = {
        name: info.profileName || WPP.info?.name || 'WhatsApp',
        profilePic: info.profilePicUrl || null,
      };
      // Re-render sidebar header by updating DOM directly
      const nameEl = document.querySelector('[data-wpp-connected-name]');
      if (nameEl) nameEl.textContent = WPP.connectedUser.name;
      const avatarEl = document.querySelector('[data-wpp-connected-avatar]');
      if (avatarEl && WPP.connectedUser.profilePic) {
        avatarEl.src = WPP.connectedUser.profilePic;
        avatarEl.style.display = 'block';
      }
    }
  } catch {}
}

function _wppChatIsLead(chat) {
  if (!chat || !chat.id) return false;
  const links = JSON.parse(localStorage.getItem('crm_wpp_links') || '{}');
  if (links[chat.id] !== undefined) return true;
  if (_wppFindLead(chat.name, null)) return true;
  const leads = storeGet ? storeGet() : [];
  return leads.some(l => {
    const digits = (l.telefone || '').replace(/\D/g, '');
    return digits && chat.id.startsWith('55' + digits);
  });
}

function _wppChatDisplayName(c) {
  const _isGoodName = n => n && typeof n === 'string' && !/^\d+$/.test(n) && !n.includes('@') && n.length < 60;

  // 1. Nome do lead CRM vinculado (máxima prioridade)
  const linkedLead = _wppFindLeadByLinks(c.id);
  if (linkedLead?.nome && _isGoodName(linkedLead.nome)) return linkedLead.nome;

  // 2. Lead encontrado por telefone ou nome
  const jidNum = (c.id || '').replace(/@.+$/, '').replace(/\D/g, '');
  const isLid  = (c.id || '').endsWith('@lid');
  const phone  = isLid ? '' : (c.phone || jidNum);
  const leadByPhone = phone ? _wppFindLeadByPhone(phone) : null;
  if (leadByPhone?.nome && _isGoodName(leadByPhone.nome)) return leadByPhone.nome;

  // 3. Nome real do contato no WA (pushName/contacts map)
  const realName = WPP.contacts[c.id];
  if (_isGoodName(realName)) return realName;
  if (_isGoodName(c.pushName)) return c.pushName;
  if (_isGoodName(c.name)) return c.name;

  // 4. Número formatado
  if (c.phone) return _wppFmtPhone(c.phone);
  if (!isLid && jidNum.length >= 8 && jidNum.length <= 13) return _wppFmtPhone(jidNum);

  // 5. Fallback para @lid: sufixo curto
  if (isLid) {
    const suffix = (c.id || '').replace(/@lid$/, '').slice(-4);
    return suffix ? `Contato ···${suffix}` : 'Contato';
  }
  return '';
}

function _wppRenderChatItem(c) {
  const displayName = _wppChatDisplayName(c);
  const initial   = (displayName||'?')[0].toUpperCase();
  const avatarClr = _wppAvatarColor(displayName||'');
  const preview   = _wppMsgPreview(c.lastMessage);
  const time      = c.lastMessage ? _wppFormatTime(c.lastMessage.timestamp) : '';
  const isActive  = c.id === WPP.currentChatId;
  const lead      = _wppFindLead(c.name, null);
  const pic       = WPP.profilePics[c.id];
  return `
    <div class="wpp-chat-item ${isActive?'wpp-chat-active':''}" onclick="_wppSelectChat('${_esc(c.id)}')">
      ${pic
        ? `<img data-chat-avatar="${_esc(c.id)}" src="${pic}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div style="width:48px;height:48px;border-radius:50%;background:${avatarClr};display:none;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:white;flex-shrink:0">${initial}</div>`
        : `<div style="width:49px;height:49px;border-radius:50%;background:${avatarClr};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:white;flex-shrink:0">${initial}</div>`
      }
      <div style="flex:1;min-width:0;padding-left:13px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <div style="font-size:15px;font-weight:600;color:#111b21;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px">
            ${_esc(displayName)}
            ${lead?`<span style="font-size:9px;background:#dcfce7;color:#15803d;padding:1px 5px;border-radius:4px;margin-left:4px;font-weight:700">Lead</span>`:''}
          </div>
          <div style="font-size:11px;color:${c.unreadCount?'#25d366':'#667781'};flex-shrink:0">${time}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px">
          <div style="font-size:13px;color:#667781;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${preview}</div>
          ${c.unreadCount ? `<div style="background:#25d366;color:white;font-size:11px;font-weight:700;padding:1px 6px;border-radius:10px;flex-shrink:0">${c.unreadCount}</div>` : ''}
        </div>
      </div>
    </div>`;
}

function _wppRenderChatList() {
  const el = document.getElementById('wppChatList');
  if (!el) return;

  const filter = WPP.chatFilter;
  const chats  = WPP.chats
    .filter(c => !filter || c.name?.toLowerCase().includes(filter))
    .sort((a,b) => {
      const ta = a.lastMessage?.timestamp || 0;
      const tb = b.lastMessage?.timestamp || 0;
      return tb - ta;
    });

  if (!chats.length) {
    el.innerHTML = `<div style="padding:40px 16px;text-align:center;color:#667781;font-size:13px">
      ${filter ? 'Nenhuma conversa encontrada' : 'Sem conversas ainda'}
    </div>`;
    return;
  }

  const crmChats   = chats.filter(c => _wppChatIsLead(c));
  const outroChats = chats.filter(c => !_wppChatIsLead(c));

  let html = '';

  if (crmChats.length) {
    html += `<div style="padding:6px 16px 4px;font-size:10px;font-weight:800;color:#25d366;text-transform:uppercase;letter-spacing:.5px;background:#f0f2f5;border-bottom:1px solid #e9edef">
      <i class="bi bi-person-check-fill"></i> Clientes CRM (${crmChats.length})
    </div>`;
    html += crmChats.map(_wppRenderChatItem).join('');
  }

  if (outroChats.length) {
    html += `<div style="padding:6px 16px 4px;display:flex;align-items:center;justify-content:space-between;background:#f0f2f5;border-bottom:1px solid #e9edef;border-top:${crmChats.length?'1px solid #e9edef':'none'}">
      <span style="font-size:10px;font-weight:800;color:#667781;text-transform:uppercase;letter-spacing:.5px">Outros contatos (${outroChats.length})</span>
      <button onclick="WPP.showOtherChats=!WPP.showOtherChats;_wppRenderChatList()" style="border:none;background:none;cursor:pointer;font-size:11px;color:#667781;padding:2px 6px;border-radius:4px">
        ${WPP.showOtherChats ? '<i class="bi bi-chevron-up"></i> Recolher' : '<i class="bi bi-chevron-down"></i> Ver ' + outroChats.length + ' outros'}
      </button>
    </div>`;
    if (WPP.showOtherChats) {
      html += outroChats.map(_wppRenderChatItem).join('');
    }
  }

  el.innerHTML = html;
}

/* ─────────────────────────────────────────────
   SIDEBAR — Alternância Conversas / Leads CRM
───────────────────────────────────────────── */
function _wppSwitchSidebar(view) {
  WPP.sidebarView = view;
}

function _wppGetLinkedChatId(leadId) {
  const links = JSON.parse(localStorage.getItem('crm_wpp_links') || '{}');
  return Object.entries(links).find(([, lId]) => lId === leadId)?.[0] || null;
}

function _wppRenderLeadList() {
  const el = document.getElementById('wppLeadList');
  if (!el) return;

  const leads  = storeGet ? storeGet() : [];
  const filter = WPP.leadFilter;
  const list   = filter
    ? leads.filter(l => l.nome?.toLowerCase().includes(filter) || l.telefone?.includes(filter))
    : leads;

  if (!list.length) {
    el.innerHTML = `<div style="padding:40px 16px;text-align:center;color:#667781;font-size:13px">
      ${filter ? 'Nenhum lead encontrado' : 'Nenhum lead cadastrado'}
    </div>`;
    return;
  }

  const stageColors = {
    lead:'#6b7280', quali:'#0891b2', sim:'#7c3aed',
    proposta:'#d97706', contrato:'#16a34a', fechado:'#16a34a', contemplado:'#d97706', posvenda:'#64748b',
  };

  const reunioes = rnGet ? rnGet() : [];

  el.innerHTML = list.map(l => {
    const chatId   = _wppGetLinkedChatId(l.id);
    const linked   = !!chatId;
    const initial  = (l.nome||'?')[0].toUpperCase();
    const color    = _wppAvatarColor(l.nome||'');
    const stageClr = stageColors[l.stage] || '#6b7280';
    const isSelected = WPP.selectedLeadId === l.id;
    const proxReuns = reunioes.filter(r => r.leadId === l.id && r.status === 'agendada').sort((a,b) => a.data.localeCompare(b.data)).slice(0,3);

    const expandedPanel = isSelected ? `
      <div style="background:#f8fafc;border-top:1px solid #e9edef;padding:10px 12px">
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          ${linked
            ? `<button class="btn btn-sm" style="background:#25d366;color:white;font-size:11px;padding:4px 10px;border:none;border-radius:6px;cursor:pointer" onclick="event.stopPropagation();_wppSwitchSidebar('chats');_wppSelectChat('${_esc(chatId)}')"><i class="bi bi-chat-fill"></i> Abrir Conversa</button>`
            : `<button class="btn btn-sm" style="background:#f59e0b;color:white;font-size:11px;padding:4px 10px;border:none;border-radius:6px;cursor:pointer" onclick="event.stopPropagation();_wppVincularLead(null,${l.id})"><i class="bi bi-link-45deg"></i> Vincular WhatsApp</button>`}
          <button class="btn btn-sm" style="background:#6366f1;color:white;font-size:11px;padding:4px 10px;border:none;border-radius:6px;cursor:pointer" onclick="event.stopPropagation();_wppAgendarLead(${l.id})"><i class="bi bi-calendar-plus"></i> Agendar Reunião</button>
        </div>
        ${proxReuns.length ? `
          <div style="font-size:10px;font-weight:700;color:#667781;text-transform:uppercase;margin-bottom:4px">Próximas reuniões</div>
          ${proxReuns.map(r => `
            <div style="font-size:11px;color:#374151;padding:3px 0;border-bottom:1px solid #e9edef;display:flex;justify-content:space-between">
              <span>${_esc(r.titulo)}</span>
              <span style="color:#d97706">${r.data} ${r.hora||''}</span>
            </div>`).join('')}
        ` : `<div style="font-size:11px;color:#667781">Sem reuniões agendadas</div>`}
      </div>` : '';

    return `
      <div>
        <div class="wpp-chat-item ${isSelected ? 'wpp-chat-active' : ''}" onclick="_wppToggleLeadSelect(${l.id})">
          <div style="width:49px;height:49px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:white;flex-shrink:0">
            ${initial}
          </div>
          <div style="flex:1;min-width:0;padding-left:13px">
            <div style="display:flex;justify-content:space-between;align-items:baseline;gap:4px">
              <div style="font-size:14px;font-weight:700;color:#111b21;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">${_esc(l.nome)}</div>
              <span style="font-size:9px;font-weight:700;color:${stageClr};background:${stageClr}18;padding:2px 6px;border-radius:4px;flex-shrink:0;text-transform:uppercase">${l.stage||'lead'}</span>
            </div>
            <div style="font-size:12px;color:#667781;margin-top:2px;display:flex;align-items:center;gap:5px">
              ${linked
                ? `<i class="bi bi-whatsapp" style="color:#25d366;font-size:12px"></i><span style="color:#25d366;font-weight:600">Vinculado</span>`
                : `<i class="bi bi-link-45deg" style="color:#d97706;font-size:12px"></i><span style="color:#d97706">Vincular WhatsApp</span>`}
              ${l.telefone ? `<span>· ${_esc(l.telefone)}</span>` : ''}
            </div>
          </div>
          <i class="bi bi-chevron-${isSelected ? 'up' : 'down'}" style="color:#667781;font-size:12px;flex-shrink:0"></i>
        </div>
        ${expandedPanel}
      </div>`;
  }).join('');
}

function _wppToggleLeadSelect(leadId) {
  WPP.selectedLeadId = WPP.selectedLeadId === leadId ? null : leadId;
  _wppRenderLeadList();
}

function _wppAgendarLead(leadId, tipoInicial) {
  const lead = typeof storeGet === 'function' ? storeGet().find(l => l.id === leadId) : null;
  if (!lead) return;
  document.getElementById('wppAgendaFloat')?.remove();

  const hoje   = new Date().toISOString().slice(0, 10);
  const chatId = _wppGetLinkedChatId(leadId);

  const el = document.createElement('div');
  el.id = 'wppAgendaFloat';
  el.style.cssText = 'position:fixed;top:80px;right:320px;width:340px;background:white;border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,0.22);z-index:6000;overflow:hidden;border:1px solid #e9edef';

  el.innerHTML = `
    <div id="wppAgDragHandle" style="background:#1a3a5c;padding:11px 14px;display:flex;align-items:center;gap:8px;cursor:move;user-select:none;flex-shrink:0">
      <i class="bi bi-calendar-plus" style="color:#93c5fd;font-size:15px"></i>
      <span style="color:white;font-size:13px;font-weight:800;flex:1">Agendar Reunião</span>
      <button onclick="document.getElementById('wppAgendaFloat').remove()" style="background:rgba(255,255,255,0.15);border:none;border-radius:6px;color:white;cursor:pointer;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:14px">✕</button>
    </div>
    <div style="padding:14px">
      <div style="font-size:12px;color:#667781;margin-bottom:12px">Lead: <strong style="color:#111b21">${_esc(lead.nome)}</strong></div>

      <div style="display:flex;gap:8px;margin-bottom:14px">
        <button id="wppAgBtnOnline" onclick="_wppAgSetTipo('online')" style="flex:1;padding:9px 6px;border:2px solid #6366f1;border-radius:8px;background:#6366f112;color:#6366f1;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s"><i class="bi bi-camera-video-fill"></i> Online</button>
        <button id="wppAgBtnPresencial" onclick="_wppAgSetTipo('presencial')" style="flex:1;padding:9px 6px;border:2px solid #e9edef;border-radius:8px;background:white;color:#667781;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s"><i class="bi bi-geo-alt-fill"></i> Presencial</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
        <div>
          <label style="font-size:11px;font-weight:700;color:#667781;display:block;margin-bottom:3px">Título</label>
          <input id="wppAgTitulo" style="width:100%;border:1px solid #e9edef;border-radius:8px;padding:8px 10px;font-size:13px;outline:none;font-family:inherit;box-sizing:border-box" value="Reunião com ${_esc(lead.nome)}" />
        </div>
        <div style="display:flex;gap:8px">
          <div style="flex:1">
            <label style="font-size:11px;font-weight:700;color:#667781;display:block;margin-bottom:3px">Data</label>
            <input id="wppAgData" type="date" style="width:100%;border:1px solid #e9edef;border-radius:8px;padding:8px 10px;font-size:13px;outline:none;box-sizing:border-box" value="${hoje}" />
          </div>
          <div style="flex:1">
            <label style="font-size:11px;font-weight:700;color:#667781;display:block;margin-bottom:3px">Hora</label>
            <input id="wppAgHora" type="time" style="width:100%;border:1px solid #e9edef;border-radius:8px;padding:8px 10px;font-size:13px;outline:none;box-sizing:border-box" value="09:00" />
          </div>
        </div>
      </div>

      <div style="background:#f8fafc;border-radius:10px;padding:10px 12px;border:1px solid #e9edef;margin-bottom:14px">
        <div style="font-size:11px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Enviar confirmação após salvar</div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#374151;margin-bottom:6px">
          <input type="checkbox" id="wppAgSendWpp" ${chatId?'checked':'disabled'} style="width:14px;height:14px;accent-color:#25d366" />
          <i class="bi bi-whatsapp" style="color:#25d366;font-size:14px"></i>
          WhatsApp ${chatId?'':' <span style="color:#9ca3af;font-size:10px">(sem conversa)</span>'}
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#374151">
          <input type="checkbox" id="wppAgSendEmail" ${lead.email?'':'disabled'} style="width:14px;height:14px;accent-color:#6366f1" />
          <i class="bi bi-envelope-fill" style="color:#6366f1;font-size:13px"></i>
          E-mail ${lead.email?'('+_esc(lead.email)+')':'<span style="color:#9ca3af;font-size:10px">(sem e-mail)</span>'}
        </label>
      </div>

      <div style="display:flex;gap:8px">
        <button onclick="document.getElementById('wppAgendaFloat').remove()" style="flex:1;padding:9px;border:1px solid #e9edef;border-radius:8px;background:white;color:#667781;font-size:13px;cursor:pointer">Cancelar</button>
        <button onclick="_wppSalvarAgendamento(${leadId})" style="flex:1;padding:9px;border:none;border-radius:8px;background:#1a3a5c;color:white;font-size:13px;font-weight:800;cursor:pointer">Salvar</button>
      </div>
    </div>
  `;

  document.body.appendChild(el);
  _wppMakeDraggable(el, document.getElementById('wppAgDragHandle'));
  if (tipoInicial) _wppAgSetTipo(tipoInicial);
}

function _wppAgSetTipo(tipo) {
  window._wppAgTipoSel = tipo;
  const onB = document.getElementById('wppAgBtnOnline');
  const prB = document.getElementById('wppAgBtnPresencial');
  if (!onB || !prB) return;
  if (tipo === 'online') {
    onB.style.cssText = onB.style.cssText.replace(/border:[^;]+/,'border:2px solid #6366f1');
    onB.style.background='#6366f112'; onB.style.color='#6366f1';
    prB.style.background='white'; prB.style.color='#667781';
    prB.style.cssText = prB.style.cssText.replace(/border:[^;]+/,'border:2px solid #e9edef');
  } else {
    prB.style.cssText = prB.style.cssText.replace(/border:[^;]+/,'border:2px solid #f59e0b');
    prB.style.background='#f59e0b12'; prB.style.color='#d97706';
    onB.style.background='white'; onB.style.color='#667781';
    onB.style.cssText = onB.style.cssText.replace(/border:[^;]+/,'border:2px solid #e9edef');
  }
}

function _wppSalvarAgendamento(leadId) {
  const lead = typeof storeGet === 'function' ? storeGet().find(l => l.id === leadId) : null;
  if (!lead) return;
  const titulo = document.getElementById('wppAgTitulo')?.value.trim();
  const data   = document.getElementById('wppAgData')?.value;
  const hora   = document.getElementById('wppAgHora')?.value;
  const tipo   = window._wppAgTipoSel || 'online';
  const sendWpp   = document.getElementById('wppAgSendWpp')?.checked;
  const sendEmail = document.getElementById('wppAgSendEmail')?.checked;
  if (!titulo || !data) { _wppToast('Preencha o título e a data', 'error'); return; }
  const reuniao = typeof rnCreate === 'function' ? rnCreate({ titulo, data, hora, tipo, leadId, leadNome: lead.nome }) : null;
  document.getElementById('wppAgendaFloat')?.remove();
  const chatId = _wppGetLinkedChatId(leadId);
  if (sendWpp && chatId && reuniao) _wppEnviarLinkReuniao(chatId, reuniao);
  if (sendEmail && lead.email) _wppToast('E-mail: integração em breve', 'info');
  _wppToast('Reunião agendada!', 'success');
  const updated = typeof storeGet === 'function' ? storeGet().find(l => l.id === leadId) : null;
  if (updated) _wppRenderInfoPanel(updated);
}

async function _wppEnviarLinkReuniao(chatId, reuniao) {
  const dataFmt = reuniao.data ? new Date(reuniao.data + 'T00:00:00').toLocaleDateString('pt-BR') : reuniao.data;
  const mensagem = `📅 *Reunião agendada!*\n${reuniao.titulo}\nData: ${dataFmt}\nHora: ${reuniao.hora}`;
  try {
    await fetch(`${WPP_BASE}/send/text`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chatId, text: mensagem }),
    });
  } catch (e) {
    console.error('[WPP] Erro ao enviar link de reunião:', e);
  }
}

/* ─────────────────────────────────────────────
   CHAT AREA — Cabeçalho + mensagens + input
───────────────────────────────────────────── */
function _wppFindLeadByChatId(chatId) {
  if (!storeGet) return null;
  const links = JSON.parse(localStorage.getItem('crm_wpp_links') || '{}');
  if (links[chatId] !== undefined) {
    return storeGet().find(l => l.id === links[chatId]) || null;
  }
  return null;
}

async function _wppSelectChat(chatId) {
  WPP.currentChatId = chatId;
  _wppRenderChatList(); // atualiza estado ativo

  const chat  = WPP.chats.find(c => c.id === chatId);
  const isLidJid = chatId.endsWith('@lid');
  const isGroup  = chatId.endsWith('@g.us');
  const rawJidNum = chatId.replace(/@.+$/, '').replace(/\D/g, '');
  // Para @lid: usa o phone do servidor se disponível (pode existir); senão fica vazio
  const rawPhone  = chat?.phone || (isLidJid ? '' : rawJidNum);

  // Busca lead: por link salvo → telefone → nome real (contacts map) → nome do chat
  const contactName = WPP.contacts[chatId];
  let lead = _wppFindLeadByChatId(chatId)
    || (rawPhone ? _wppFindLeadByPhone(rawPhone) : null)
    || (contactName ? _wppFindLead(contactName, null) : null)
    || _wppFindLead(chat?.name, rawPhone || null);

  // Auto-salva link se encontrou por telefone/nome mas ainda não estava vinculado
  if (lead && !_wppFindLeadByLinks(chatId)) {
    const links = JSON.parse(localStorage.getItem('crm_wpp_links') || '{}');
    links[chatId] = lead.id;
    localStorage.setItem('crm_wpp_links', JSON.stringify(links));
  }

  // Auto-cria lead se não encontrou e não é grupo (e é um número de telefone válido)
  if (!lead && !isGroup && !isLidJid && rawPhone.length >= 10 && typeof leadCreate === 'function') {
    const nomeChat = contactName || chat?.name || '';
    const nome = (nomeChat && !/^\d+$/.test(nomeChat)) ? nomeChat : _wppFmtPhone(rawPhone);
    const novoLead = leadCreate({ nome, telefone: _wppFmtPhone(rawPhone), stage: 'wpp_novo', funnel: 'wpp' });
    if (novoLead) {
      const links = JSON.parse(localStorage.getItem('crm_wpp_links') || '{}');
      links[chatId] = novoLead.id;
      localStorage.setItem('crm_wpp_links', JSON.stringify(links));
      lead = novoLead;
      _wppRenderChatList();
    }
  }

  const area = document.getElementById('wppChatArea');
  const none = document.getElementById('wppNoChatScreen');
  if (!area) return;

  none.style.display = 'none';
  area.style.display = 'flex';
  area.style.flexDirection = 'row';
  const headerName = contactName
    || (chat?.pushName && !/^\d+$/.test(chat.pushName) && !chat.pushName.includes('@') ? chat.pushName : null)
    || (chat?.name && !/^\d+$/.test(chat.name) && !chat.name.includes('@') ? chat.name : null)
    || (lead?.nome && !/^\d+$/.test(lead.nome) ? lead.nome : null)
    || (isLidJid ? 'Contato' : (rawPhone.length >= 8 ? _wppFmtPhone(rawPhone) : chatId.replace(/@.+$/, '')));
  const headerPhone = isLidJid ? '' : (rawPhone.length >= 8 ? _wppFmtPhone(rawPhone) : '');
  const leadChip = lead
    ? `<button onclick="navigate&&navigate('clientes');setTimeout(()=>_clOpenPerfil&&_clOpenPerfil(${lead.id}),200)" style="background:#dcfce7;color:#15803d;border:1px solid #86efac;border-radius:14px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;margin-top:2px"><i class="bi bi-person-check-fill"></i> ${_esc(lead.nome)}</button>`
    : `<button onclick="_wppVincularLead('${_esc(chatId)}')" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;border-radius:14px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;margin-top:2px"><i class="bi bi-link-45deg"></i> Vincular lead</button>`;

  area.innerHTML = `
    <div id="wppChatContent" style="flex:1;display:flex;flex-direction:column;overflow:hidden">
      <!-- Cabeçalho do chat (dark) -->
      <div style="background:#111b21;padding:10px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #1f2c33;flex-shrink:0">
        <div style="width:40px;height:40px;border-radius:50%;background:${_wppAvatarColor(headerName||'')};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:white;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.25)">
          ${(headerName||'?')[0].toUpperCase()}
        </div>
        <div style="flex:1;min-width:0">
          <div data-header-name style="font-size:15px;font-weight:700;color:#e9edef;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(headerName)}</div>
          <div style="font-size:11px;color:#8696a0;display:flex;align-items:center;gap:8px">
            <span>${_esc(headerPhone)}</span>
            <span data-lead-chip-area>${leadChip}</span>
          </div>
        </div>
        <div style="display:flex;gap:2px;flex-shrink:0">
          <button id="wppSelectModeBtn" class="wpp-icon-btn wpp-icon-dark" title="Selecionar mensagens" onclick="_wppToggleSelectMode('${_esc(chatId)}')"><i class="bi bi-check2-square"></i></button>
          <button class="wpp-icon-btn wpp-icon-dark" title="Salvar trecho no perfil" onclick="_wppSalvarSelecao('${_esc(chatId)}')" style="color:#fbbf24"><i class="bi bi-bookmark-plus-fill"></i></button>
          <button class="wpp-icon-btn wpp-icon-dark" title="Buscar mais mensagens" onclick="_wppLoadMessages('${_esc(chatId)}',true)"><i class="bi bi-arrow-up-circle"></i></button>
        </div>
      </div>

      <!-- Barra de seleção de mensagens -->
      <div id="wppSelectBar" style="display:none;background:#1a3a5c;color:white;padding:8px 16px;display:none;align-items:center;justify-content:space-between;flex-shrink:0">
        <span style="font-size:13px"><i class="bi bi-check2-square"></i> <span id="wppSelectCount">0</span> mensagem(ns) selecionada(s)</span>
        <div style="display:flex;gap:8px">
          <button onclick="_wppSalvarMensagensSelecionadas('${_esc(chatId)}')" style="background:#f59e0b;color:white;border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer"><i class="bi bi-bookmark-plus-fill"></i> Salvar no perfil</button>
          <button onclick="_wppToggleSelectMode('${_esc(chatId)}')" style="background:rgba(255,255,255,0.15);color:white;border:none;border-radius:6px;padding:5px 12px;font-size:12px;cursor:pointer">Cancelar</button>
        </div>
      </div>

      <!-- Mensagens -->
      <div id="wppMsgs" class="wpp-msgs-bg" style="flex:1;overflow-y:auto;padding:8px 6%"></div>

      <!-- Reply preview (mostra quando WPP.replyTo está setado) -->
      <div id="wppReplyPreview" style="display:none"></div>

      <!-- Input -->
      <div style="background:#f0f2f5;padding:8px 16px;display:flex;align-items:flex-end;gap:8px;flex-shrink:0;position:relative">
        <!-- Menu de anexo popup -->
        <div id="wppAttachMenu" style="display:none;position:absolute;bottom:64px;left:8px;background:white;border-radius:16px;box-shadow:0 6px 30px rgba(0,0,0,0.22);padding:12px;z-index:200;border:1px solid #e9edef">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:320px">
            <label style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 8px;border-radius:10px;cursor:pointer;transition:background .1s;text-align:center" onmouseover="this.style.background='#f5f6f6'" onmouseout="this.style.background=''">
              <div style="width:48px;height:48px;border-radius:50%;background:#1d4ed8;display:flex;align-items:center;justify-content:center"><i class="bi bi-file-earmark-fill" style="color:white;font-size:20px"></i></div>
              <span style="font-size:11px;font-weight:600;color:#374151">Documento</span>
              <input type="file" style="display:none" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z" onchange="_wppSendMedia(event,'${_esc(chatId)}');document.getElementById('wppAttachMenu').style.display='none'"/>
            </label>
            <label style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 8px;border-radius:10px;cursor:pointer;transition:background .1s;text-align:center" onmouseover="this.style.background='#f5f6f6'" onmouseout="this.style.background=''">
              <div style="width:48px;height:48px;border-radius:50%;background:#8b5cf6;display:flex;align-items:center;justify-content:center"><i class="bi bi-image-fill" style="color:white;font-size:20px"></i></div>
              <span style="font-size:11px;font-weight:600;color:#374151">Fotos e Vídeos</span>
              <input type="file" style="display:none" accept="image/*,video/*" multiple onchange="_wppSendMedia(event,'${_esc(chatId)}');document.getElementById('wppAttachMenu').style.display='none'"/>
            </label>
            <div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 8px;border-radius:10px;cursor:pointer;transition:background .1s;text-align:center" onclick="_wppOpenCamera('${_esc(chatId)}')" onmouseover="this.style.background='#f5f6f6'" onmouseout="this.style.background=''">
              <div style="width:48px;height:48px;border-radius:50%;background:#16a34a;display:flex;align-items:center;justify-content:center"><i class="bi bi-camera-fill" style="color:white;font-size:20px"></i></div>
              <span style="font-size:11px;font-weight:600;color:#374151">Câmera</span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 8px;border-radius:10px;cursor:pointer;transition:background .1s;text-align:center" onclick="_wppCriarEnquete('${_esc(chatId)}')" onmouseover="this.style.background='#f5f6f6'" onmouseout="this.style.background=''">
              <div style="width:48px;height:48px;border-radius:50%;background:#4f46e5;display:flex;align-items:center;justify-content:center"><i class="bi bi-bar-chart-fill" style="color:white;font-size:20px"></i></div>
              <span style="font-size:11px;font-weight:600;color:#374151">Enquete</span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 8px;border-radius:10px;cursor:pointer;transition:background .1s;text-align:center" onclick="_wppSendLocalizacao('${_esc(chatId)}')" onmouseover="this.style.background='#f5f6f6'" onmouseout="this.style.background=''">
              <div style="width:48px;height:48px;border-radius:50%;background:#ef4444;display:flex;align-items:center;justify-content:center"><i class="bi bi-geo-alt-fill" style="color:white;font-size:20px"></i></div>
              <span style="font-size:11px;font-weight:600;color:#374151">Localização</span>
            </div>
            <label style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 8px;border-radius:10px;cursor:pointer;transition:background .1s;text-align:center" onmouseover="this.style.background='#f5f6f6'" onmouseout="this.style.background=''">
              <div style="width:48px;height:48px;border-radius:50%;background:#ec4899;display:flex;align-items:center;justify-content:center"><i class="bi bi-person-vcard-fill" style="color:white;font-size:20px"></i></div>
              <span style="font-size:11px;font-weight:600;color:#374151">Contato</span>
              <input type="file" style="display:none" accept=".vcf,.vcard" onchange="_wppSendMedia(event,'${_esc(chatId)}');document.getElementById('wppAttachMenu').style.display='none'"/>
            </label>
            <div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 8px;border-radius:10px;cursor:pointer;transition:background .1s;text-align:center" onclick="_wppCriarEvento('${_esc(chatId)}')" onmouseover="this.style.background='#f5f6f6'" onmouseout="this.style.background=''">
              <div style="width:48px;height:48px;border-radius:50%;background:#f97316;display:flex;align-items:center;justify-content:center"><i class="bi bi-calendar-event-fill" style="color:white;font-size:20px"></i></div>
              <span style="font-size:11px;font-weight:600;color:#374151">Evento</span>
            </div>
            <label style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 8px;border-radius:10px;cursor:pointer;transition:background .1s;text-align:center" onmouseover="this.style.background='#f5f6f6'" onmouseout="this.style.background=''">
              <div style="width:48px;height:48px;border-radius:50%;background:#d97706;display:flex;align-items:center;justify-content:center"><i class="bi bi-file-music-fill" style="color:white;font-size:20px"></i></div>
              <span style="font-size:11px;font-weight:600;color:#374151">Áudio</span>
              <input type="file" style="display:none" accept="audio/*" onchange="_wppSendAudioFile(event,'${_esc(chatId)}');document.getElementById('wppAttachMenu').style.display='none'"/>
            </label>
          </div>
        </div>

        <!-- Botão de anexo -->
        <button class="wpp-icon-btn" title="Anexar arquivo" style="cursor:pointer;flex-shrink:0" onclick="_wppToggleAttachMenu(event)">
          <i class="bi bi-paperclip" style="font-size:20px"></i>
        </button>

        <!-- Área central: textarea normal OU indicador de gravação -->
        <div style="flex:1;position:relative">
          <textarea
            id="wppInput"
            style="width:100%;border:none;border-radius:8px;padding:9px 14px;font-size:14px;outline:none;resize:none;min-height:42px;max-height:120px;line-height:1.5;font-family:inherit;background:white;color:#111b21;box-sizing:border-box;display:block"
            placeholder="Digite uma mensagem"
            oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px';_wppUpdateSendBtn()"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();_wppSendText('${_esc(chatId)}')}"
          ></textarea>
          <!-- Indicador de gravação (oculto por padrão) -->
          <div id="wppRecordingBar" style="display:none;align-items:center;gap:10px;padding:0 14px;height:42px;background:white;border-radius:8px">
            <div style="width:10px;height:10px;border-radius:50%;background:#ef4444;animation:wpp-blink 1s infinite;flex-shrink:0"></div>
            <span style="font-size:13px;color:#ef4444;font-weight:700">Gravando</span>
            <span id="wppRecordTimer" style="font-size:13px;color:#111b21;font-weight:600">0:00</span>
            <div style="flex:1;display:flex;align-items:center;gap:2px" id="wppWaveform">
              ${Array(12).fill(0).map((_,i) => `<div style="width:3px;height:${8+Math.random()*16}px;background:#25d366;border-radius:2px;animation:wpp-wave ${0.5+Math.random()*0.5}s ease-in-out infinite alternate" id="wv${i}"></div>`).join('')}
            </div>
            <button onclick="_wppCancelRecording()" style="background:#fee2e2;color:#ef4444;border:none;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0">
              <i class="bi bi-x-circle-fill"></i> Cancelar
            </button>
          </div>
        </div>

        <!-- Botão ENVIAR (texto) — sempre visível, desabilitado quando vazio -->
        <button id="wppSendBtn"
          style="background:#25d366;color:white;width:42px;height:42px;border-radius:50%;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;opacity:0.4;transition:opacity .15s"
          onclick="_wppSendText('${_esc(chatId)}')"
          title="Enviar mensagem">
          <i class="bi bi-send-fill" style="font-size:18px"></i>
        </button>

        <!-- Botão MIC — separado do enviar, clique para iniciar/parar gravação -->
        <button id="wppMicBtn"
          style="background:#1f2937;color:white;width:42px;height:42px;border-radius:50%;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background .15s"
          onclick="_wppToggleRecording('${_esc(chatId)}')"
          title="Gravar mensagem de voz">
          <i class="bi bi-mic-fill" style="font-size:18px"></i>
        </button>
      </div>
    </div>
  `;

  // Reseta reply
  WPP.replyTo = null;
  _wppUpdateReplyPreview();

  // Carrega mensagens
  await _wppLoadMessages(chatId);

  // Inicia polling de novas mensagens
  _wppStartMsgPolling(chatId);

  // Marca como lido
  fetch(`${WPP_BASE}/read/${encodeURIComponent(chatId)}`, { method: 'POST' }).catch(()=>{});

  // Mostra/atualiza o painel lateral de info do lead
  const infoSide = document.getElementById('wppInfoSide');
  if (infoSide) {
    if (lead) {
      infoSide.style.display = 'flex';
      infoSide.style.flexDirection = 'column';
      _wppRenderInfoPanel(lead);
    } else {
      infoSide.style.display = 'flex';
      infoSide.style.flexDirection = 'column';
      infoSide.innerHTML = `
        <div style="padding:20px 14px;text-align:center;color:#667781;font-size:13px;border-bottom:1px solid #e9edef">
          <i class="bi bi-person-slash" style="font-size:32px;display:block;margin-bottom:8px;opacity:0.4"></i>
          Nenhum lead vinculado
        </div>
        <div style="padding:12px 14px">
          <button class="btn btn-sm" style="width:100%;background:#f59e0b;color:white;border:none;border-radius:6px;cursor:pointer;padding:8px" onclick="_wppVincularLead('${chatId}')">
            <i class="bi bi-person-plus-fill"></i> Vincular a um Lead
          </button>
        </div>`;
    }
  }
}

function _wppStopMsgPolling() {
  if (WPP._msgPoller) { clearInterval(WPP._msgPoller); WPP._msgPoller = null; }
}

// Polling de status enquanto conectado — detecta desconexão feita pelo celular
function _wppStartConnPoller() {
  if (WPP._connPoller) clearInterval(WPP._connPoller);
  WPP._connPoller = setInterval(async () => {
    if (WPP.status !== 'ready') { clearInterval(WPP._connPoller); WPP._connPoller = null; return; }
    try {
      const r = await fetch(`${WPP_BASE}/status`);
      if (!r.ok) return;
      const j = await r.json();
      // Evolution API retorna 'open' quando conectado
      if (j.status !== 'open') {
        clearInterval(WPP._connPoller);
        WPP._connPoller = null;
        WPP.status = 'disconnected';
        _wppStopMsgPolling();
        _wppRender();
        _wppToast('WhatsApp desconectado', 'error');
      }
    } catch (_) {}
  }, 20000); // verifica a cada 20s
}

function _wppStartMsgPolling(chatId) {
  _wppStopMsgPolling();
  WPP._msgPoller = setInterval(async () => {
    if (WPP.currentChatId !== chatId) { _wppStopMsgPolling(); return; }
    try {
      const r = await fetch(`${WPP_BASE}/messages/${encodeURIComponent(chatId)}?limit=40`);
      if (!r.ok) return;
      const fresh = await r.json();
      const have  = WPP.messages[chatId] || [];
      const seen  = new Set(have.map(m => m.id));
      const novas = fresh.filter(m => m && m.id && !seen.has(m.id));
      if (!novas.length) return;
      // mantém ordem cronológica
      WPP.messages[chatId] = have.concat(novas).sort((a,b) => (a.timestamp||0) - (b.timestamp||0));
      const msgsEl = document.getElementById('wppMsgs');
      if (!msgsEl) return;
      const wasNearBottom = msgsEl.scrollTop + msgsEl.clientHeight >= msgsEl.scrollHeight - 80;
      for (const m of novas) {
        const div = document.createElement('div');
        div.innerHTML = _wppRenderMsg(m);
        if (div.firstElementChild) msgsEl.appendChild(div.firstElementChild);
      }
      if (wasNearBottom) msgsEl.scrollTop = msgsEl.scrollHeight;
    } catch (_) {}
  }, 5000);
}

async function _wppLoadMessages(chatId, loadMore = false) {
  if (WPP.loadingMsgs) return;
  WPP.loadingMsgs = true;

  const msgsEl = document.getElementById('wppMsgs');
  if (!msgsEl) { WPP.loadingMsgs = false; return; }

  if (!loadMore) {
    msgsEl.innerHTML = `<div style="text-align:center;padding:40px;color:#667781">
      <div style="width:24px;height:24px;border:3px solid #25d366;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 8px"></div>
      Carregando mensagens...
    </div>`;
  }

  try {
    const limit = loadMore ? 80 : 40;
    const res   = await fetch(`${WPP_BASE}/messages/${encodeURIComponent(chatId)}?limit=${limit}`);
    const msgs  = await res.json();
    // Deduplica por ID (Evolution API pode retornar registros duplicados)
    const seenIds = new Set();
    WPP.messages[chatId] = (Array.isArray(msgs) ? msgs : []).filter(m => m && m.id && !seenIds.has(m.id) && seenIds.add(m.id));
    // Extract contact name from received messages (pushName is most reliable)
    const storedMsgs = WPP.messages[chatId];
    const isValidName = n => n && typeof n === 'string' && !/^\d+$/.test(n) && !n.includes('@') && n.length < 60;
    const theirMsg = storedMsgs.filter(m => !m.fromMe && isValidName(m.contactName || m.chatName || ''));
    if (theirMsg.length > 0) {
      const last = theirMsg[theirMsg.length - 1];
      const bestName = isValidName(last.contactName) ? last.contactName : (isValidName(last.chatName) ? last.chatName : null);
      if (bestName) {
        WPP.contacts[chatId] = bestName;
        // Atualiza entrada na lista de chats
        const chatIdx = WPP.chats.findIndex(c => c.id === chatId);
        if (chatIdx !== -1) {
          const oldName = WPP.chats[chatIdx].name || '';
          if (!isValidName(oldName) || oldName.startsWith('Contato')) {
            WPP.chats[chatIdx].name = bestName;
          }
        }
        // Atualiza nome no cabeçalho do chat aberto
        const headerEl = document.querySelector('#wppChatContent [data-header-name]');
        if (headerEl && (!headerEl.textContent.trim() || headerEl.textContent.startsWith('Contato'))) {
          headerEl.textContent = bestName;
        }
        // Tenta vincular lead pelo nome agora que sabemos quem é
        const existingLink = _wppFindLeadByLinks(chatId);
        if (!existingLink && typeof storeGet === 'function') {
          const foundLead = _wppFindLead(bestName, null);
          if (foundLead) {
            const links = JSON.parse(localStorage.getItem('crm_wpp_links') || '{}');
            links[chatId] = foundLead.id;
            localStorage.setItem('crm_wpp_links', JSON.stringify(links));
            // Atualiza chip no cabeçalho
            const chipEl = document.querySelector('[data-lead-chip-area]');
            if (chipEl) {
              chipEl.innerHTML = `<button onclick="navigate&&navigate('clientes');setTimeout(()=>_clOpenPerfil&&_clOpenPerfil(${foundLead.id}),200)" style="background:#dcfce7;color:#15803d;border:1px solid #86efac;border-radius:14px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="bi bi-person-check-fill"></i> ${_esc(foundLead.nome)}</button>`;
            }
            // Atualiza painel lateral
            const infoSide = document.getElementById('wppInfoSide');
            if (infoSide) {
              infoSide.style.display = 'flex';
              infoSide.style.flexDirection = 'column';
              _wppRenderInfoPanel(foundLead);
            }
          }
        }
        _wppRenderChatList();
      }
    }
    _wppRenderMessages(chatId);
  } catch (e) {
    console.error('[WPP] Erro ao carregar mensagens:', e);
    if (msgsEl) msgsEl.innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444">Erro ao carregar mensagens</div>`;
  }

  WPP.loadingMsgs = false;
}

function _wppRenderMessages(chatId) {
  const msgsEl = document.getElementById('wppMsgs');
  if (!msgsEl) return;

  const msgs = WPP.messages[chatId] || [];
  if (!msgs.length) {
    msgsEl.innerHTML = `<div style="text-align:center;padding:40px;color:#667781;font-size:13px">Nenhuma mensagem ainda</div>`;
    return;
  }

  let html = '';
  let lastDate = null;

  for (const msg of msgs) {
    // Separador de data
    const dateStr = _wppFormatDateLabel(msg.timestamp);
    if (dateStr !== lastDate) {
      lastDate = dateStr;
      html += `<div style="text-align:center;margin:12px 0">
        <span style="background:rgba(255,255,255,0.85);color:#667781;font-size:11px;font-weight:600;padding:4px 12px;border-radius:8px">${dateStr}</span>
      </div>`;
    }
    html += _wppRenderMsg(msg);
  }

  msgsEl.innerHTML = html;
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

function _wppRenderMsg(msg) {
  const fromMe   = msg.fromMe;
  const time     = _wppFormatTime(msg.timestamp);
  const ackHtml  = fromMe ? _wppAckIcon(msg.ack) : '';
  const content  = _wppMsgContent(msg);

  // Stickers: sem balão tradicional, fundo transparente
  if (msg.type === 'sticker') {
    return `<div data-msg-id="${_esc(msg.id)}" style="display:flex;justify-content:${fromMe?'flex-end':'flex-start'};margin:4px 0">
      <div style="max-width:65%;display:flex;flex-direction:column;align-items:${fromMe?'flex-end':'flex-start'}">
        ${content}
        <div style="display:flex;gap:3px;margin-top:2px;align-items:center">
          <span style="font-size:10px;color:#667781">${time}</span>${ackHtml}
        </div>
      </div>
    </div>`;
  }

  // Quote / reply: busca mensagem citada no cache
  let quotedHtml = '';
  if (msg.quotedMsgId) {
    const all = WPP.messages[WPP.currentChatId] || [];
    const q = all.find(m => m.id === msg.quotedMsgId);
    if (q) {
      const qBody = q.body ? _esc(q.body.slice(0, 90)) : `[${q.type||'mídia'}]`;
      const qFrom = q.fromMe ? 'Você' : (q.contactName || 'Contato');
      quotedHtml = `
        <div style="border-left:3px solid #25d366;background:rgba(0,0,0,0.04);border-radius:4px;padding:4px 8px;margin-bottom:4px;min-width:120px;max-width:100%;overflow:hidden">
          <div style="font-size:11px;font-weight:700;color:#25d366;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(qFrom)}</div>
          <div style="font-size:12px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${qBody}</div>
        </div>`;
    }
  }

  const chatId = WPP.currentChatId || '';
  const bodyEsc = _esc((msg.body || '').slice(0, 500));
  const isSelected = WPP.selectedMsgs.has(msg.id);
  const selectOverlay = WPP.selectMode ? `
    <div onclick="_wppToggleMsgSelect('${_esc(msg.id)}')" style="position:absolute;inset:0;cursor:pointer;z-index:2;display:flex;align-items:center;${fromMe?'justify-content:flex-end;padding-right:4px':'justify-content:flex-start;padding-left:4px'}">
    </div>` : '';
  const checkboxHtml = WPP.selectMode ? `
    <div style="display:flex;align-items:center;${fromMe?'order:-1;margin-right:8px':'margin-left:8px'};flex-shrink:0">
      <div class="wpp-sel-circle" onclick="_wppToggleMsgSelect('${_esc(msg.id)}')" style="width:20px;height:20px;border-radius:50%;border:2px solid ${isSelected?'#25d366':'#aaa'};background:${isSelected?'#25d366':'white'};display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0">
        ${isSelected?'<i class="bi bi-check" style="color:white;font-size:12px;font-weight:900"></i>':''}
      </div>
    </div>` : '';
  const rowBg = WPP.selectMode && isSelected ? (fromMe ? 'rgba(37,211,102,0.08)' : 'rgba(37,211,102,0.06)') : 'transparent';
  return `
    <div data-msg-id="${_esc(msg.id)}" style="display:flex;justify-content:${fromMe?'flex-end':'flex-start'};margin:2px 0;position:relative;background:${rowBg};border-radius:6px;padding:${WPP.selectMode?'2px 4px':'0'};transition:background .15s" oncontextmenu="${WPP.selectMode?'':` _wppMsgContextMenu(event,'${_esc(msg.id)}','${chatId.replace(/'/g,"\\'")}',this)`}">
      ${WPP.selectMode && fromMe ? checkboxHtml : ''}
      <div onclick="${WPP.selectMode?`_wppToggleMsgSelect('${_esc(msg.id)}')`:''}" style="max-width:65%;min-width:80px;background:${fromMe?'#d9fdd3':'white'};border-radius:${fromMe?'12px 2px 12px 12px':'2px 12px 12px 12px'};padding:6px 8px 4px;box-shadow:0 1px 1px rgba(0,0,0,0.13);${WPP.selectMode?'cursor:pointer':''}">
        ${quotedHtml}
        ${content}
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:3px;margin-top:2px">
          <span style="font-size:10px;color:#667781">${time}</span>
          <span class="wpp-ack">${ackHtml}</span>
        </div>
      </div>
      ${WPP.selectMode && !fromMe ? checkboxHtml : ''}
    </div>`;
}

/* ─────────────────────────────────────────────
   CONTEÚDO DE MENSAGEM por tipo
───────────────────────────────────────────── */
function _wppDocIconByExt(filename, mimetype) {
  const f = (filename || '').toLowerCase();
  const m = (mimetype || '').toLowerCase();
  if (f.endsWith('.pdf') || m.includes('pdf'))                       return { icon: 'bi-file-earmark-pdf-fill',   color: '#dc2626', label: 'PDF' };
  if (/\.(xls|xlsx|csv)$/.test(f) || m.includes('sheet') || m.includes('excel')) return { icon: 'bi-file-earmark-excel-fill', color: '#16a34a', label: 'Excel' };
  if (/\.(doc|docx)$/.test(f) || m.includes('word'))                 return { icon: 'bi-file-earmark-word-fill',  color: '#2563eb', label: 'Word' };
  if (/\.(ppt|pptx)$/.test(f) || m.includes('presentation'))         return { icon: 'bi-file-earmark-slides-fill',color: '#d97706', label: 'PowerPoint' };
  if (/\.(zip|rar|7z|tar|gz)$/.test(f))                              return { icon: 'bi-file-earmark-zip-fill',   color: '#7c3aed', label: 'Arquivo' };
  if (/\.(txt|md|log)$/.test(f) || m.startsWith('text/'))            return { icon: 'bi-file-earmark-text-fill',  color: '#64748b', label: 'Texto' };
  return { icon: 'bi-file-earmark-fill', color: '#1d4ed8', label: 'Documento' };
}

function _wppParseVcard(raw) {
  if (!raw) return { name: '', phone: '' };
  const lines = String(raw).split(/\r?\n/);
  let name = '', phone = '';
  for (const ln of lines) {
    if (!name && /^FN[:;]/i.test(ln))   name  = ln.split(':').slice(1).join(':').trim();
    if (!phone && /^TEL/i.test(ln))     phone = ln.split(':').slice(1).join(':').trim();
  }
  return { name, phone };
}

function _wppOpenPdfModal(src, filename) {
  document.getElementById('wppPdfModal')?.remove();
  const div = document.createElement('div');
  div.id = 'wppPdfModal';
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;flex-direction:column';
  div.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 18px;background:rgba(0,0,0,0.7)">
      <span style="color:white;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%">${_esc(filename)}</span>
      <div style="display:flex;gap:10px;flex-shrink:0">
        <a href="${src}" download="${_esc(filename)}" style="background:rgba(255,255,255,0.18);color:white;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;text-decoration:none;display:flex;align-items:center;gap:5px"><i class="bi bi-download"></i> Baixar</a>
        <button onclick="document.getElementById('wppPdfModal').remove()" style="background:rgba(255,255,255,0.18);color:white;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer"><i class="bi bi-x-lg"></i> Fechar</button>
      </div>
    </div>
    <iframe src="${src}" style="flex:1;border:none;background:white"></iframe>
  `;
  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
  const esc = ev => { if (ev.key === 'Escape') { div.remove(); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);
}

async function _wppFetchAndOpenDoc(msgId, mimetype, filename, fromMe) {
  const chatId = WPP.currentChatId;
  _wppToast('Baixando documento...', 'info');
  try {
    const r = await fetch(`${WPP_BASE}/media`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ msgId, chatId, fromMe: !!fromMe }),
    });
    if (!r.ok) { _wppToast('Documento não disponível no servidor', 'error'); return; }
    const data = await r.json();
    const base64 = data?.base64 || data?.message?.base64;
    if (!base64) { _wppToast('Conteúdo do documento não encontrado', 'error'); return; }
    const mt  = data?.mimetype || data?.message?.mimetype || mimetype;
    const src = `data:${mt};base64,${base64}`;
    const isPdf = filename.toLowerCase().endsWith('.pdf') || mt.includes('pdf');
    if (isPdf) {
      _wppOpenPdfModal(src, filename);
    } else {
      const a = document.createElement('a');
      a.href = src;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (e) {
    _wppToast('Erro ao baixar documento', 'error');
  }
}

async function _wppFetchAndPlayAudio(msgId, mimetype, fromMe, containerEl) {
  const chatId = WPP.currentChatId;
  if (!containerEl) return;
  // Mostra spinner no botão de play
  const btn = containerEl.querySelector('button');
  if (btn) btn.innerHTML = '<div style="width:16px;height:16px;border:2px solid white;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite"></div>';
  try {
    const r = await fetch(`${WPP_BASE}/media`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ msgId, chatId, fromMe: !!fromMe }),
    });
    if (!r.ok) { _wppToast('Áudio não disponível no servidor', 'error'); if (btn) btn.innerHTML = '<i class="bi bi-play-fill" style="color:white;font-size:18px"></i>'; return; }
    const data   = await r.json();
    const base64 = data?.base64 || data?.message?.base64;
    if (!base64) { _wppToast('Áudio não encontrado', 'error'); if (btn) btn.innerHTML = '<i class="bi bi-play-fill" style="color:white;font-size:18px"></i>'; return; }
    const mt  = data?.mimetype || data?.message?.mimetype || mimetype;
    const src = `data:${mt};base64,${base64}`;
    const color = mimetype.includes('ogg') || mimetype.includes('ptt') ? '#25d366' : '#6366f1';
    containerEl.innerHTML = `<div style="display:flex;align-items:center;gap:10px;min-width:260px;padding:4px 0">
      <div style="width:40px;height:40px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 6px ${color}66">
        <i class="bi bi-mic-fill" style="color:white;font-size:16px"></i>
      </div>
      <div style="flex:1;min-width:0">
        <audio controls autoplay style="width:100%;height:32px;outline:none" preload="auto">
          <source src="${src}" type="${mt}" />
        </audio>
      </div>
    </div>`;
  } catch {
    _wppToast('Erro ao carregar áudio', 'error');
    if (btn) btn.innerHTML = '<i class="bi bi-play-fill" style="color:white;font-size:18px"></i>';
  }
}

function _wppOpenImageModal(src) {
  document.getElementById('wppImgModal')?.remove();
  const div = document.createElement('div');
  div.id = 'wppImgModal';
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column';
  div.innerHTML = `
    <div style="position:absolute;top:14px;right:18px;display:flex;gap:10px">
      <a href="${src}" download="imagem.jpg" style="background:rgba(255,255,255,0.18);color:white;border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;text-decoration:none" title="Baixar"><i class="bi bi-download" style="font-size:18px"></i></a>
      <button onclick="document.getElementById('wppImgModal').remove()" style="background:rgba(255,255,255,0.18);color:white;border:none;border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;cursor:pointer" title="Fechar"><i class="bi bi-x-lg" style="font-size:18px"></i></button>
    </div>
    <img src="${src}" style="max-width:92vw;max-height:92vh;border-radius:6px;box-shadow:0 8px 40px rgba(0,0,0,0.6)" />
  `;
  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
  const esc = ev => { if (ev.key === 'Escape') { div.remove(); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);
}

async function _wppFetchAndShowImage(msgId, fromMe, containerEl) {
  if (!containerEl) return;
  const placeholder = containerEl.querySelector('div[style*="background:#1f2937"],div[style*="background:#f5f6f6"],div[style*="background:#111"]');
  if (placeholder) placeholder.innerHTML = `<div style="width:24px;height:24px;border:3px solid #25d366;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite"></div>`;
  try {
    const r = await fetch(`${WPP_BASE}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgId, chatId: WPP.currentChatId, fromMe: !!fromMe }),
    });
    if (!r.ok) { _wppToast('Imagem não disponível', 'error'); return; }
    const data   = await r.json();
    const base64 = data?.base64 || data?.message?.base64;
    if (!base64) { _wppToast('Imagem não encontrada no servidor', 'error'); return; }
    const mt  = data?.mimetype || data?.message?.mimetype || 'image/jpeg';
    const src = `data:${mt};base64,${base64}`;
    containerEl.innerHTML = `<img src="${src}" style="max-width:300px;max-height:320px;border-radius:8px;display:block;cursor:zoom-in" onclick="_wppOpenImageModal(this.src)" />`;
  } catch {
    _wppToast('Erro ao carregar imagem', 'error');
  }
}

async function _wppFetchAndShowVideo(msgId, mimetype, fromMe, containerEl) {
  if (!containerEl) return;
  const placeholder = containerEl.querySelector('div[style*="background:#111"]');
  if (placeholder) placeholder.innerHTML = `<div style="width:24px;height:24px;border:3px solid white;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite"></div>`;
  try {
    const r = await fetch(`${WPP_BASE}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgId, chatId: WPP.currentChatId, fromMe: !!fromMe }),
    });
    if (!r.ok) { _wppToast('Vídeo não disponível', 'error'); return; }
    const data   = await r.json();
    const base64 = data?.base64 || data?.message?.base64;
    if (!base64) { _wppToast('Vídeo não encontrado no servidor', 'error'); return; }
    const mt  = data?.mimetype || data?.message?.mimetype || mimetype;
    const src = `data:${mt};base64,${base64}`;
    containerEl.innerHTML = `<video controls autoplay style="max-width:300px;max-height:320px;border-radius:8px;display:block;background:#000">
      <source src="${src}" type="${_esc(mt)}" />
    </video>`;
  } catch {
    _wppToast('Erro ao carregar vídeo', 'error');
  }
}

function _wppMsgContent(msg) {
  switch (msg.type) {
    case 'chat':
      return `<div style="font-size:14px;color:#111b21;white-space:pre-wrap;word-break:break-word">${_esc(msg.body)}</div>`;

    case 'image': {
      const capImg = msg.body ? `<div style="font-size:14px;color:#111b21;margin-top:6px;white-space:pre-wrap;word-break:break-word">${_esc(msg.body)}</div>` : '';
      if (msg.media?.data) {
        const src = `data:${msg.media.mimetype};base64,${msg.media.data}`;
        return `<img src="${src}" style="max-width:300px;max-height:320px;border-radius:8px;display:block;cursor:zoom-in" onclick="_wppOpenImageModal(this.src)" />${capImg}`;
      }
      // Sem dados inline: carrega ao clicar
      const midImg = _esc(msg.id);
      const fmImg  = msg.fromMe ? 'true' : 'false';
      return `<div data-img-container style="position:relative;display:inline-block">
        <div style="width:240px;height:160px;border-radius:8px;background:#1f2937;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer" onclick="_wppFetchAndShowImage('${midImg}',${fmImg},this.closest('[data-img-container]'))">
          <i class="bi bi-image" style="font-size:36px;color:#9ca3af"></i>
          <span style="font-size:12px;color:#9ca3af">Toque para ver imagem</span>
        </div>
      </div>${capImg}`;
    }

    case 'sticker': {
      if (msg.media?.data) {
        const src = `data:${msg.media.mimetype};base64,${msg.media.data}`;
        return `<img src="${src}" style="width:120px;height:120px;display:block;cursor:zoom-in;background:transparent" onclick="_wppOpenImageModal(this.src)" />`;
      }
      const midSt = _esc(msg.id);
      const fmSt  = msg.fromMe ? 'true' : 'false';
      return `<div data-img-container>
        <div style="width:100px;height:100px;border-radius:8px;background:#f5f6f6;display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="_wppFetchAndShowImage('${midSt}',${fmSt},this.closest('[data-img-container]'))">
          <i class="bi bi-sticky" style="font-size:32px;color:#9ca3af"></i>
        </div>
      </div>`;
    }

    case 'video': {
      const capVid = msg.body ? `<div style="font-size:14px;color:#111b21;margin-top:6px;white-space:pre-wrap;word-break:break-word">${_esc(msg.body)}</div>` : '';
      if (msg.media?.data) {
        const src = `data:${msg.media.mimetype};base64,${msg.media.data}`;
        return `<video controls preload="metadata" style="max-width:300px;max-height:320px;border-radius:8px;display:block;background:#000">
          <source src="${src}" type="${_esc(msg.media.mimetype||'video/mp4')}" />
        </video>${capVid}`;
      }
      const midVid = _esc(msg.id);
      const fmVid  = msg.fromMe ? 'true' : 'false';
      return `<div data-vid-container style="position:relative">
        <div style="width:280px;height:160px;border-radius:8px;background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer" onclick="_wppFetchAndShowVideo('${midVid}','${_esc(msg.media?.mimetype||'video/mp4')}',${fmVid},this.closest('[data-vid-container]'))">
          <i class="bi bi-play-circle-fill" style="font-size:42px;color:white;opacity:0.85"></i>
          <span style="font-size:12px;color:#9ca3af">Toque para carregar vídeo</span>
        </div>
      </div>${capVid}`;
    }

    case 'audio':
    case 'ptt': {
      const isPtt  = msg.type === 'ptt';
      const color  = isPtt ? '#25d366' : '#6366f1';
      const bgClr  = isPtt ? '#e7fce8' : '#ede9fe';
      const icon   = isPtt ? 'bi-mic-fill' : 'bi-music-note-beamed';
      const label  = isPtt ? 'Mensagem de voz' : 'Áudio';
      const mime   = msg.media?.mimetype || 'audio/ogg';
      const fromMeVal = msg.fromMe ? 'true' : 'false';

      if (msg.media?.data) {
        const src = `data:${mime};base64,${msg.media.data}`;
        return `<div style="display:flex;align-items:center;gap:10px;min-width:260px;padding:4px 0">
      <div style="width:40px;height:40px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 6px ${color}66">
        <i class="bi ${icon}" style="color:white;font-size:16px"></i>
      </div>
      <div style="flex:1;min-width:0">
        <audio controls style="width:100%;height:32px;outline:none" preload="metadata">
          <source src="${src}" type="${_esc(mime)}" />
        </audio>
        <div style="font-size:10px;color:#667781;margin-top:2px">${label}</div>
      </div>
    </div>`;
      }

      // Sem dados: botão de play que busca no servidor
      const msgIdSafe = _esc(msg.id);
      return `<div data-audio-container style="display:flex;align-items:center;gap:10px;min-width:260px;padding:4px 0">
    <button onclick="_wppFetchAndPlayAudio('${msgIdSafe}','${_esc(mime)}',${fromMeVal},this.closest('[data-audio-container]'))"
      style="width:40px;height:40px;border-radius:50%;background:${color};border:none;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;box-shadow:0 2px 6px ${color}66">
      <i class="bi bi-play-fill" style="color:white;font-size:18px"></i>
    </button>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:2px;height:24px;margin-bottom:2px">
        ${Array.from({length:20},(_,i)=>`<div style="width:3px;border-radius:2px;background:${color}66;height:${8+Math.sin(i*0.8)*8|0}px"></div>`).join('')}
      </div>
      <div style="font-size:10px;color:#667781">${label} · clique para reproduzir</div>
    </div>
  </div>`;
    }

    case 'document': {
      const fname  = msg.media?.filename || msg.body || 'documento';
      const info   = _wppDocIconByExt(fname, msg.media?.mimetype);
      const mime   = msg.media?.mimetype || 'application/octet-stream';
      const size   = msg.media?.filesize ? ` · ${Math.round(msg.media.filesize/1024)} KB` : '';
      const isPdf  = fname.toLowerCase().endsWith('.pdf') || mime.includes('pdf');
      if (msg.media?.data) {
        const href = `data:${mime};base64,${msg.media.data}`;
        const openBtn = isPdf
          ? `<button onclick="_wppOpenPdfModal('${href}','${_esc(fname)}')" style="background:${info.color};color:white;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0">Abrir</button>`
          : '';
        return `<div style="display:flex;align-items:center;gap:10px;color:#111b21;padding:6px;background:#f5f6f6;border-radius:8px;min-width:240px">
          <div style="width:42px;height:42px;border-radius:8px;background:${info.color}18;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="bi ${info.icon}" style="color:${info.color};font-size:22px"></i></div>
          <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(fname)}</div>
          <div style="font-size:11px;color:#667781">${info.label}${size}</div></div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            ${openBtn}
            <a href="${href}" download="${_esc(fname)}" style="background:#e5e7eb;color:#374151;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:700;text-decoration:none;display:flex;align-items:center;gap:3px"><i class="bi bi-download"></i></a>
          </div>
        </div>`;
      }
      // Sem dados: botão para buscar do servidor
      const msgIdEsc = _esc(msg.id);
      const fromMeVal = msg.fromMe ? 'true' : 'false';
      return `<div style="display:flex;align-items:center;gap:10px;color:#111b21;padding:6px;background:#f5f6f6;border-radius:8px;min-width:240px">
        <div style="width:42px;height:42px;border-radius:8px;background:${info.color}18;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="bi ${info.icon}" style="color:${info.color};font-size:22px"></i></div>
        <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(fname)}</div>
        <div style="font-size:11px;color:#667781">${info.label}${size}</div></div>
        <button onclick="_wppFetchAndOpenDoc('${msgIdEsc}','${_esc(mime)}','${_esc(fname)}',${fromMeVal})" style="background:${info.color};color:white;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0"><i class="bi bi-download"></i> Baixar</button>
      </div>`;
    }

    case 'vcard': {
      const parsed = _wppParseVcard(msg.vcard?.raw);
      const name   = parsed.name || msg.vcard?.displayName || msg.body || 'Contato';
      const phone  = parsed.phone || '';
      return `<div style="display:flex;align-items:center;gap:10px;padding:4px;min-width:220px">
        <div style="width:40px;height:40px;background:#25d366;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="bi bi-person-fill" style="color:white;font-size:20px"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:#111b21">${_esc(name)}</div>
          ${phone ? `<div style="font-size:12px;color:#667781">${_esc(phone)}</div>` : ''}
        </div>
      </div>`;
    }

    case 'location': {
      const lat = msg.location?.latitude, lng = msg.location?.longitude;
      const label = msg.location?.name || msg.location?.address || 'Localização compartilhada';
      return `<a href="https://maps.google.com/?q=${lat},${lng}" target="_blank" rel="noopener"
        style="display:block;text-decoration:none;color:#111b21;min-width:240px">
        <div style="background:linear-gradient(135deg,#a7f3d0,#86efac);border-radius:8px;height:120px;display:flex;align-items:center;justify-content:center;position:relative">
          <i class="bi bi-geo-alt-fill" style="font-size:42px;color:#ef4444;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.25))"></i>
        </div>
        <div style="padding:6px 4px 2px">
          <div style="font-size:13px;font-weight:700">${_esc(label)}</div>
          <div style="font-size:11px;color:#667781"><i class="bi bi-box-arrow-up-right"></i> Abrir no Google Maps</div>
        </div>
      </a>`;
    }

    case 'revoked':
      return `<div style="font-size:13px;color:#667781;font-style:italic;display:flex;align-items:center;gap:6px"><i class="bi bi-slash-circle"></i> Mensagem apagada</div>`;

    default:
      return msg.body
        ? `<div style="font-size:14px;color:#111b21;white-space:pre-wrap;word-break:break-word">${_esc(msg.body)}</div>`
        : `<div style="font-size:12px;color:#667781;font-style:italic">[${msg.type}]</div>`;
  }
}

/* ─────────────────────────────────────────────
   MENU DE ANEXO
───────────────────────────────────────────── */
function _wppMsgContextMenu(e, msgId, chatId, rowEl) {
  e.preventDefault();
  document.getElementById('wppCtxMenu')?.remove();

  const msgs = WPP.messages[chatId] || [];
  const msg  = msgs.find(m => m.id === msgId);
  const text = msg?.body || window.getSelection()?.toString().trim() || '';

  const menu = document.createElement('div');
  menu.id = 'wppCtxMenu';
  menu.style.cssText = `position:fixed;left:${Math.min(e.clientX,window.innerWidth-200)}px;top:${Math.min(e.clientY,window.innerHeight-120)}px;background:white;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.18);border:1px solid #e9edef;z-index:9999;min-width:190px;overflow:hidden`;
  menu.innerHTML = `
    <div style="padding:4px">
      <button onclick="document.getElementById('wppCtxMenu')?.remove();_wppReply('${_esc(msgId)}')" style="display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:none;background:transparent;cursor:pointer;border-radius:7px;text-align:left;font-size:13px;color:#374151" onmouseover="this.style.background='#f5f6f6'" onmouseout="this.style.background=''"><i class="bi bi-reply-fill" style="color:#25d366;font-size:15px"></i> Responder</button>
      ${text ? `<button onclick="(function(){document.getElementById('wppCtxMenu')?.remove();_wppConfirmarSalvarTrecho(${JSON.stringify(text)},_wppFindLeadByChatId('${chatId.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}'))})()" style="display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:none;background:transparent;cursor:pointer;border-radius:7px;text-align:left;font-size:13px;color:#374151" onmouseover="this.style.background='#f5f6f6'" onmouseout="this.style.background=''"><i class="bi bi-bookmark-plus-fill" style="color:#f59e0b;font-size:15px"></i> Salvar no perfil do lead</button>` : ''}
      <button onclick="navigator.clipboard?.writeText(${JSON.stringify(text)}).then(()=>{if(typeof _wppToast==='function')_wppToast('Copiado!','success')});document.getElementById('wppCtxMenu')?.remove()" style="display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:none;background:transparent;cursor:pointer;border-radius:7px;text-align:left;font-size:13px;color:#374151" onmouseover="this.style.background='#f5f6f6'" onmouseout="this.style.background=''"><i class="bi bi-clipboard" style="color:#6366f1;font-size:15px"></i> Copiar mensagem</button>
    </div>`;
  document.body.appendChild(menu);
  const close = () => { menu.remove(); document.removeEventListener('click', close); };
  setTimeout(() => document.addEventListener('click', close), 10);
}

function _wppToggleAttachMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('wppAttachMenu');
  if (!menu) return;
  const isOpen = menu.style.display !== 'none';
  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    const close = ev => { menu.style.display = 'none'; document.removeEventListener('click', close); };
    setTimeout(() => document.addEventListener('click', close), 10);
  }
}

/* ─────────────────────────────────────────────
   REPLY / QUOTE
───────────────────────────────────────────── */
function _wppReply(msgId) {
  const chatId = WPP.currentChatId;
  const msgs   = WPP.messages[chatId] || [];
  const msg    = msgs.find(m => m.id === msgId);
  if (!msg) return;
  WPP.replyTo = {
    id:     msg.id,
    body:   msg.body || `[${msg.type||'mídia'}]`,
    fromMe: msg.fromMe,
    author: msg.fromMe ? 'Você' : (msg.contactName || 'Contato'),
  };
  _wppUpdateReplyPreview();
  document.getElementById('wppInput')?.focus();
}

function _wppCancelReply() {
  WPP.replyTo = null;
  _wppUpdateReplyPreview();
}

function _wppUpdateReplyPreview() {
  const el = document.getElementById('wppReplyPreview');
  if (!el) return;
  if (!WPP.replyTo) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'block';
  el.innerHTML = `
    <div style="background:#f0f2f5;padding:8px 14px;border-top:1px solid #e9edef;display:flex;align-items:center;gap:10px">
      <div style="border-left:4px solid #25d366;padding:4px 10px;flex:1;min-width:0;background:white;border-radius:0 6px 6px 0">
        <div style="font-size:12px;font-weight:700;color:#25d366">Respondendo a ${_esc(WPP.replyTo.author)}</div>
        <div style="font-size:12px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(WPP.replyTo.body.slice(0,140))}</div>
      </div>
      <button onclick="_wppCancelReply()" class="wpp-icon-btn" title="Cancelar resposta" style="flex-shrink:0"><i class="bi bi-x-lg" style="font-size:16px"></i></button>
    </div>`;
}

/* ─────────────────────────────────────────────
   SALVAR TRECHO DA CONVERSA
───────────────────────────────────────────── */
function _wppSalvarSelecao(chatId) {
  const sel = window.getSelection()?.toString().trim();
  const chat = WPP.chats.find(c => c.id === chatId);
  const lead = _wppFindLeadByChatId(chatId) || (chat ? _wppFindLead(chat.name, chat.phone) : null);

  if (sel) {
    _wppConfirmarSalvarTrecho(sel, lead);
    return;
  }

  // Sem seleção: mostra modal
  window._wppTrechoLead = lead;
  _wppShowModal(`
    <div style="font-size:15px;font-weight:800;color:var(--primary);margin-bottom:10px"><i class="bi bi-bookmark-plus-fill" style="color:#f59e0b"></i> Salvar trecho da conversa</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px">Selecione uma parte do texto nas mensagens acima e clique novamente, <strong>ou</strong> escreva o trecho abaixo:</div>
    <textarea id="wppTrechoTexto" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px;resize:none;min-height:80px;outline:none;font-family:inherit;box-sizing:border-box" placeholder="Digite ou cole o trecho importante..."></textarea>
    ${lead ? `<div style="font-size:11px;color:#16a34a;margin-top:6px"><i class="bi bi-person-check-fill"></i> Será salvo no perfil de <strong>${_esc(lead.nome)}</strong></div>` : '<div style="font-size:11px;color:#f59e0b;margin-top:6px"><i class="bi bi-exclamation-triangle-fill"></i> Nenhum lead vinculado. Vincule a conversa a um lead primeiro.</div>'}
    <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">
      <button class="btn btn-ghost btn-sm" onclick="document.querySelector('.wpp-modal').remove()">Cancelar</button>
      <button class="btn btn-primary btn-sm" onclick="_wppConfirmarSalvarTrecho(document.getElementById('wppTrechoTexto').value,window._wppTrechoLead)">Salvar</button>
    </div>
  `);
}

function _wppConfirmarSalvarTrecho(texto, lead) {
  if (!texto?.trim()) { _wppToast('Nenhum texto para salvar', 'error'); return; }
  document.querySelector('.wpp-modal')?.remove();

  if (!lead) {
    _wppToast('Vincule a conversa a um lead para salvar', 'error');
    return;
  }

  const trecho = texto.trim().slice(0, 1000);
  const nota = `[Chat WPP] ${trecho}`;

  if (typeof leadAddNota === 'function') leadAddNota(lead.id, nota);
  if (typeof leadAddHistorico === 'function') leadAddHistorico(lead.id, `Trecho salvo da conversa WPP: "${trecho.slice(0,60)}${trecho.length>60?'...':''}"`);

  _wppToast(`Trecho salvo no perfil de ${lead.nome}!`, 'success');

  const updatedLead = typeof storeGet === 'function' ? storeGet().find(l => l.id === lead.id) : null;
  if (updatedLead && document.getElementById('wppInfoSide')?.style.display !== 'none') {
    _wppRenderInfoPanel(updatedLead);
  }
}

/* ─────────────────────────────────────────────
   SELEÇÃO DE MENSAGENS
───────────────────────────────────────────── */
function _wppToggleSelectMode(chatId) {
  WPP.selectMode = !WPP.selectMode;
  WPP.selectedMsgs.clear();

  const bar = document.getElementById('wppSelectBar');
  const btn = document.getElementById('wppSelectModeBtn');
  if (bar) bar.style.display = WPP.selectMode ? 'flex' : 'none';
  if (btn) {
    btn.style.color = WPP.selectMode ? '#25d366' : '#667781';
    btn.style.background = WPP.selectMode ? 'rgba(37,211,102,0.12)' : '';
  }

  _wppRenderMessages(chatId);
}

function _wppToggleMsgSelect(msgId) {
  if (WPP.selectedMsgs.has(msgId)) {
    WPP.selectedMsgs.delete(msgId);
  } else {
    WPP.selectedMsgs.add(msgId);
  }

  const countEl = document.getElementById('wppSelectCount');
  if (countEl) countEl.textContent = WPP.selectedMsgs.size;

  // Update just the clicked row instead of full re-render
  const chatId = WPP.currentChatId;
  const msgs = WPP.messages[chatId] || [];
  const msg  = msgs.find(m => m.id === msgId);
  if (!msg) return;

  const rowEl = document.querySelector(`[data-msg-id="${CSS.escape(msgId)}"]`);
  if (rowEl) {
    const isSelected = WPP.selectedMsgs.has(msgId);
    rowEl.style.background = isSelected ? (msg.fromMe ? 'rgba(37,211,102,0.08)' : 'rgba(37,211,102,0.06)') : 'transparent';
    const circle = rowEl.querySelector('.wpp-sel-circle');
    if (circle) {
      circle.style.border = `2px solid ${isSelected ? '#25d366' : '#aaa'}`;
      circle.style.background = isSelected ? '#25d366' : 'white';
      circle.innerHTML = isSelected ? '<i class="bi bi-check" style="color:white;font-size:12px;font-weight:900"></i>' : '';
    }
  }
}

function _wppSalvarMensagensSelecionadas(chatId) {
  if (!WPP.selectedMsgs.size) {
    _wppToast('Selecione ao menos uma mensagem', 'error');
    return;
  }
  const lead = _wppFindLeadByChatId(chatId);
  if (!lead) {
    _wppToast('Vincule a conversa a um lead para salvar', 'error');
    return;
  }

  const chat = WPP.chats.find(c => c.id === chatId);
  const msgs = WPP.messages[chatId] || [];
  const selecionadas = msgs.filter(m => WPP.selectedMsgs.has(m.id));

  if (typeof leadAddConversaSalva === 'function') {
    leadAddConversaSalva(lead.id, {
      fonte:     'WPP',
      chatName:  chat?.name || '',
      mensagens: selecionadas.map(m => ({
        id:        m.id,
        body:      m.body || '',
        type:      m.type,
        fromMe:    m.fromMe,
        timestamp: m.timestamp,
      })),
      nota: '',
    });
  }

  if (typeof leadAddHistorico === 'function') {
    leadAddHistorico(lead.id, `${selecionadas.length} mensagem(ns) salva(s) da conversa WPP`);
  }

  _wppToast(`${selecionadas.length} mensagem(ns) salva(s) no perfil de ${lead.nome}!`, 'success');
  _wppToggleSelectMode(chatId); // exit select mode

  const updatedLead = typeof storeGet === 'function' ? storeGet().find(l => l.id === lead.id) : null;
  if (updatedLead && document.getElementById('wppInfoSide')?.style.display !== 'none') {
    _wppRenderInfoPanel(updatedLead);
  }
}

/* ─────────────────────────────────────────────
   ENVIO — Texto e Mídia
───────────────────────────────────────────── */
async function _wppSendText(chatId) {
  const input = document.getElementById('wppInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  _wppUpdateSendBtn();

  // Captura e limpa o reply
  const replyRef = WPP.replyTo;
  WPP.replyTo = null;
  _wppUpdateReplyPreview();

  // Adiciona mensagem localmente (otimistic UI)
  const tmpMsg = {
    id:          'tmp_' + Date.now(),
    chatId,
    body:        text,
    type:        'chat',
    fromMe:      true,
    timestamp:   Math.floor(Date.now() / 1000),
    ack:         0,
    quotedMsgId: replyRef?.id || null,
  };
  _wppAddLocalMessage(chatId, tmpMsg);

  try {
    await fetch(`${WPP_BASE}/send/text`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chatId, text }),
    });
  } catch (e) {
    _wppToast('Erro ao enviar mensagem', 'error');
    console.error('[WPP] Erro ao enviar texto:', e);
  }
}

async function _wppSendMedia(event, chatId) {
  const file = event.target.files?.[0];
  if (!file) return;

  _wppToast('Enviando arquivo...', 'info');

  const formData = new FormData();
  formData.append('chatId', chatId);
  formData.append('file', file);

  try {
    const res = await fetch(`${WPP_BASE}/send/media`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(await res.text());
    _wppToast('Arquivo enviado!', 'success');
  } catch (e) {
    _wppToast('Erro ao enviar arquivo', 'error');
    console.error('[WPP] Erro ao enviar mídia:', e);
  }

  // Limpa o input de arquivo para permitir reenvio do mesmo arquivo
  event.target.value = '';
}

/* ─────────────────────────────────────────────
   SOCKET EVENTS — mensagens em tempo real
───────────────────────────────────────────── */
function _wppOnIncomingMessage(msg) {
  // Atualiza cache de mensagens do chat, evitando duplicatas
  if (!WPP.messages[msg.chatId]) WPP.messages[msg.chatId] = [];
  const alreadyIn = WPP.messages[msg.chatId].some(m => m.id === msg.id);
  if (!alreadyIn) {
    WPP.messages[msg.chatId].push(msg);
    // Se o chat está aberto, adiciona a mensagem na tela
    if (WPP.currentChatId === msg.chatId) {
      _wppAddLocalMessage(msg.chatId, msg, false);
    }
  }

  // Atualiza a lista de chats (lastMessage + nome + unread)
  const idx = WPP.chats.findIndex(c => c.id === msg.chatId);
  if (idx !== -1) {
    WPP.chats[idx].lastMessage = {
      body:      msg.body,
      type:      msg.type,
      timestamp: msg.timestamp,
      fromMe:    msg.fromMe,
    };
    // Atualiza nome do contato se ainda era placeholder/número/vazio
    const currentName = WPP.chats[idx].name || '';
    const betterName  = msg.contactName || msg.chatName || '';
    const isPlaceholder = !currentName || /^\d+$/.test(currentName) || currentName.includes('@') || currentName.startsWith('Contato');
    const isGoodName    = betterName && !/^\d+$/.test(betterName) && !betterName.includes('@') && betterName.length < 60;
    if (isGoodName && isPlaceholder) {
      WPP.chats[idx].name = betterName;
      WPP.contacts[msg.chatId] = betterName;
    }
    if (!msg.fromMe && WPP.currentChatId !== msg.chatId) {
      WPP.chats[idx].unreadCount = (WPP.chats[idx].unreadCount || 0) + 1;
    }
  } else {
    // Chat novo que não estava na lista
    const isLidNew  = msg.chatId.endsWith('@lid');
    const rawPhone  = isLidNew ? '' : msg.chatId.replace(/@.+$/, '').replace(/\D/g, '');
    const chatName = WPP.contacts[msg.chatId] || msg.contactName || msg.chatName || (rawPhone.length >= 8 ? _wppFmtPhone(rawPhone) : (isLidNew ? 'Contato' : msg.chatId.replace(/@.+$/, '')));
    // Atualiza índice de contatos se veio pushName
    if (msg.contactName && !WPP.contacts[msg.chatId]) WPP.contacts[msg.chatId] = msg.contactName;
    WPP.chats.unshift({
      id:          msg.chatId,
      name:        chatName,
      phone:       rawPhone || null,
      unreadCount: msg.fromMe ? 0 : 1,
      lastMessage: { body: msg.body, type: msg.type, timestamp: msg.timestamp, fromMe: msg.fromMe },
    });
    // Auto-cria lead para contato novo (não grupos, não @lid)
    if (!msg.chatId.endsWith('@g.us') && !isLidNew && rawPhone.length >= 10 && typeof leadCreate === 'function') {
      const existeLead = _wppFindLeadByPhone(rawPhone) || _wppFindLeadByLinks(msg.chatId);
      if (!existeLead) {
        const nome = (chatName && !/^\d+$/.test(chatName)) ? chatName : _wppFmtPhone(rawPhone);
        const novoLead = leadCreate({ nome, telefone: _wppFmtPhone(rawPhone), stage: 'wpp_novo', funnel: 'wpp' });
        if (novoLead) {
          const links = JSON.parse(localStorage.getItem('crm_wpp_links') || '{}');
          links[msg.chatId] = novoLead.id;
          localStorage.setItem('crm_wpp_links', JSON.stringify(links));
        }
      }
    }
  }
  _wppRenderChatList();
}

function _wppAddLocalMessage(chatId, msg, scroll = true) {
  const msgsEl = document.getElementById('wppMsgs');
  if (!msgsEl || WPP.currentChatId !== chatId) return;

  const div = document.createElement('div');
  div.innerHTML = _wppRenderMsg(msg);
  msgsEl.appendChild(div.firstElementChild);

  if (scroll) msgsEl.scrollTop = msgsEl.scrollHeight;
}

function _wppUpdateAck(msgId, ack) {
  const row = document.querySelector(`[data-msg-id="${CSS.escape ? CSS.escape(msgId) : msgId}"]`);
  if (!row) return;
  const el = row.querySelector('.wpp-ack');
  if (el) el.innerHTML = _wppAckIcon(ack);
  const cached = (WPP.messages[WPP.currentChatId] || []).find(m => m.id === msgId);
  if (cached) cached.ack = ack;
}

/* ─────────────────────────────────────────────
   INTEGRAÇÃO CRM — Vincular chat a lead
───────────────────────────────────────────── */
function _wppFmtPhone(digits) {
  const d = (digits||'').replace(/\D/g, '');
  if (d.length === 13) return `(${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`;   // 55+DDD+9+8
  if (d.length === 12) return `(${d.slice(2,4)}) ${d.slice(4,8)}-${d.slice(8)}`;   // 55+DDD+8
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;   // DDD+9+8
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;   // DDD+8
  return digits;
}

function _wppAutoRegistrarContatos() {
  if (typeof storeGet !== 'function' || typeof leadCreate !== 'function') return;
  const novos = [];
  const leadsExistentes = storeGet();

  for (const chat of WPP.chats) {
    if (chat.id.endsWith('@g.us')) continue;
    if (chat.id.endsWith('@lid')) continue;
    if (chat.id === 'status@broadcast') continue;

    // Extrai telefone do campo phone (server) ou do id (somente dígitos)
    const rawPhone = (chat.phone || chat.id.replace(/@.+$/, '')).replace(/\D/g, '');
    if (!rawPhone || rawPhone.length < 10) continue;

    // Verifica se já existe lead com este telefone (por sufixo de 8 dígitos)
    const sufixo = rawPhone.slice(-8);
    if (leadsExistentes.some(l => (l.telefone||'').replace(/\D/g,'').endsWith(sufixo))) continue;

    // Nome: usa nome real (contacts map) se disponível; se for só dígitos, formata como telefone
    const nomeChat = WPP.contacts[chat.id] || chat.name || '';
    const nome     = (nomeChat && !/^\d+$/.test(nomeChat) && !nomeChat.includes('@')) ? nomeChat : _wppFmtPhone(rawPhone);

    novos.push({ nome, telefone: _wppFmtPhone(rawPhone), origem: 'WhatsApp', _chatId: chat.id });
  }

  if (novos.length === 0) return;

  const links = JSON.parse(localStorage.getItem('crm_wpp_links') || '{}');
  let cadastrados = 0;
  for (const n of novos) {
    const novoLead = leadCreate({ ...n, stage: 'wpp_novo', funnel: 'wpp' });
    // Salva vínculo chatId → leadId para reconhecimento imediato
    if (novoLead && n._chatId) links[n._chatId] = novoLead.id;
    cadastrados++;
  }
  localStorage.setItem('crm_wpp_links', JSON.stringify(links));

  if (cadastrados > 0) {
    console.log(`[WPP] Auto-cadastrados ${cadastrados} contatos`);
    _wppToast(`${cadastrados} contato(s) novos cadastrados automaticamente`, 'success');
    _wppRenderChatList();
    _wppRenderLeadList();
  }
}

function _wppMoverStage(leadId, stage) {
  if (typeof leadMoveStage === 'function') leadMoveStage(leadId, stage);
  const allStgs = typeof getAllStages === 'function' ? getAllStages() : (typeof STAGES !== 'undefined' ? STAGES : []);
  const stageLabel = allStgs.find(s => s.id === stage)?.label || stage;
  _wppToast(`Lead movido para ${stageLabel}`, 'success');
  _wppRenderLeadList();
  const updatedLead = typeof storeGet === 'function' ? storeGet().find(l => l.id === leadId) : null;
  if (updatedLead && document.getElementById('wppInfoSide')?.style.display !== 'none') {
    _wppRenderInfoPanel(updatedLead);
  }
  // Atualiza chip no cabeçalho do chat sem re-renderizar tudo
  if (WPP.currentChatId && updatedLead) {
    const chip = document.querySelector('[data-lead-chip]');
    if (chip) chip.textContent = updatedLead.nome;
  }
}

function _wppFindLeadByPhone(rawPhone) {
  if (!rawPhone) return null;
  const leads = storeGet ? storeGet() : [];
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  const suffix8  = digits.slice(-8);
  const suffix10 = digits.slice(-10);
  return leads.find(l => {
    const ld = (l.telefone || '').replace(/\D/g, '');
    return ld && (ld.endsWith(suffix8) || suffix10 && ld.endsWith(suffix10));
  }) || null;
}

function _wppFindLead(chatName, chatPhone) {
  const leads = storeGet ? storeGet() : [];
  if (chatPhone) {
    const found = _wppFindLeadByPhone(chatPhone);
    if (found) return found;
  }
  if (chatName) {
    const name = chatName.toLowerCase().trim();
    return leads.find(l => l.nome?.toLowerCase() === name) || null;
  }
  return null;
}

function _wppVincularLead(chatId, preLeadId) {
  const leads = storeGet ? storeGet() : [];
  const opts  = leads.map(l => `<option value="${l.id}" ${preLeadId===l.id?'selected':''}>${_esc(l.nome)} — ${l.telefone||'s/telefone'}</option>`).join('');

  // Se vier do painel de leads (chatId=null), mostrar selector de chats também
  const chatOpts = chatId ? '' : `
    <div style="margin-top:10px">
      <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Conversa WhatsApp</label>
      <select id="wppChatSel" class="form-select">
        <option value="">— Selecione a conversa —</option>
        ${WPP.chats.map(c => `<option value="${_esc(c.id)}">${_esc(c.name||c.id)}</option>`).join('')}
      </select>
    </div>`;

  const resolvedChatId = chatId || '__from_select__';

  const html = `
    <div style="padding:4px">
      <div style="font-size:15px;font-weight:800;color:var(--primary);margin-bottom:12px"><i class="bi bi-link-45deg"></i> Vincular lead ao WhatsApp</div>
      <div>
        <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Lead / Cliente</label>
        <select id="wppLeadSel" class="form-select">${opts}</select>
      </div>
      ${chatOpts}
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="this.closest('.wpp-modal').remove()">Cancelar</button>
        <button class="btn btn-primary btn-sm" onclick="_wppConfirmarVinculo('${_esc(resolvedChatId)}')">Vincular</button>
      </div>
    </div>`;

  _wppShowModal(html);
}

function _wppConfirmarVinculo(chatIdArg) {
  const sel    = document.getElementById('wppLeadSel');
  const id     = parseInt(sel?.value);
  if (!id) { _wppToast('Selecione um lead', 'error'); return; }
  const lead   = storeGet().find(l => l.id === id);
  if (!lead) return;

  let chatId = chatIdArg;
  if (chatId === '__from_select__') {
    chatId = document.getElementById('wppChatSel')?.value;
    if (!chatId) { _wppToast('Selecione uma conversa', 'error'); return; }
  }

  const links = JSON.parse(localStorage.getItem('crm_wpp_links') || '{}');
  links[chatId] = id;
  localStorage.setItem('crm_wpp_links', JSON.stringify(links));

  if (leadAddHistorico) leadAddHistorico(id, `Chat WhatsApp vinculado: ${chatId}`);

  document.querySelector('.wpp-modal')?.remove();
  _wppSwitchSidebar('chats');
  _wppSelectChat(chatId);
  _wppToast('Lead vinculado!', 'success');
}

/* ─────────────────────────────────────────────
   PAINEL INFO DO LEAD — Feature 3
───────────────────────────────────────────── */
function _wppFindLeadByLinks(chatId) {
  const links = JSON.parse(localStorage.getItem('crm_wpp_links') || '{}');
  const leadId = links[chatId];
  if (!leadId) return null;
  return storeGet().find(l => l.id === leadId) || null;
}

function _wppToggleInfoPanel() {
  WPP.infoPanelOpen = !WPP.infoPanelOpen;
  const panel = document.getElementById('wppInfoSide');
  if (panel) panel.style.display = WPP.infoPanelOpen ? 'flex' : 'none';
  if (WPP.infoPanelOpen) {
    const chat = WPP.chats.find(c => c.id === WPP.currentChatId);
    const lead = _wppFindLead(chat?.name, null) || _wppFindLeadByLinks(WPP.currentChatId);
    if (lead) _wppRenderInfoPanel(lead);
    else {
      const p = document.getElementById('wppInfoSide');
      if (p) p.innerHTML = `<div style="padding:20px;text-align:center;color:#667781;font-size:13px"><i class="bi bi-person-slash" style="font-size:32px;display:block;margin-bottom:8px;opacity:0.4"></i>Nenhum lead vinculado a esta conversa</div>`;
    }
  }
}

function _wppRelTime(iso) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m/60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h/24);
  if (d < 7) return `há ${d} dia${d>1?'s':''}`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function _wppMakeDraggable(el, handle) {
  handle.style.cursor = 'move';
  let sx, sy, sl, st;
  handle.addEventListener('mousedown', e => {
    if (e.target.closest('button,a,input,select,textarea')) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    sx=e.clientX; sy=e.clientY; sl=r.left; st=r.top;
    el.style.right='auto'; el.style.bottom='auto';
    el.style.left=sl+'px'; el.style.top=st+'px';
    const mv = e2 => {
      el.style.left = Math.max(0,Math.min(window.innerWidth-el.offsetWidth, sl+e2.clientX-sx))+'px';
      el.style.top  = Math.max(0,Math.min(window.innerHeight-el.offsetHeight,st+e2.clientY-sy))+'px';
    };
    const up = () => { document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up); };
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
  });
}

function _wppRenderInfoPanel(lead) {
  const panel = document.getElementById('wppInfoSide');
  if (!panel) return;

  const reunioes = (typeof rnGet === 'function' ? rnGet() : [])
    .filter(r => r.leadId === lead.id)
    .sort((a, b) => a.data.localeCompare(b.data));
  const proxReuns = reunioes.filter(r => r.status === 'agendada');
  const notas = (lead.notas || []).slice(0, 5);

  // Funil do lead
  const allFunnels    = (typeof funnelsGet === 'function') ? funnelsGet() : [];
  const leadFunnelId  = lead.funnel || 'vendas';
  const leadFunnelObj = allFunnels.find(f => f.id === leadFunnelId) || allFunnels[0] || { id:'vendas', label:'Vendas', cor:'#1a3a5c', stages: typeof STAGES!=='undefined'?STAGES:[] };
  const funnelStages  = leadFunnelObj.stages || [];
  const funnelCor     = leadFunnelObj.cor || '#1a3a5c';

  panel.style.overflowY = 'auto';
  panel.innerHTML = `
    <div style="padding:16px 14px 12px;background:linear-gradient(135deg,#f8fafc,white);border-bottom:1px solid #f0f2f5">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:44px;height:44px;border-radius:50%;background:${_wppAvatarColor(lead.nome||'')};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:white;flex-shrink:0">${(lead.nome||'?')[0].toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:800;color:#111b21;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(lead.nome)}</div>
          ${lead.telefone ? `<div style="font-size:11px;color:#667781;margin-top:1px"><i class="bi bi-telephone-fill" style="font-size:9px"></i> ${_esc(lead.telefone)}</div>` : ''}
          ${lead.email ? `<div style="font-size:11px;color:#667781"><i class="bi bi-envelope-fill" style="font-size:9px"></i> ${_esc(lead.email)}</div>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button onclick="_wppAgendarLead(${lead.id},'online')" style="flex:1;padding:6px;border:1px solid #e9edef;border-radius:8px;background:white;cursor:pointer;font-size:11px;color:#6366f1;font-weight:700;display:flex;align-items:center;justify-content:center;gap:4px"><i class="bi bi-calendar-plus"></i> Agendar</button>
        ${lead.telefone ? `<a href="tel:${_esc(lead.telefone)}" style="padding:6px 10px;border:1px solid #e9edef;border-radius:8px;background:white;font-size:14px;color:#374151;display:flex;align-items:center;justify-content:center;text-decoration:none" title="Ligar"><i class="bi bi-telephone-fill"></i></a>` : ''}
        <button onclick="navigate('clientes',document.querySelector('[data-page=clientes]'));setTimeout(()=>_clOpenPerfil&&_clOpenPerfil(${lead.id}),200)" style="padding:6px 10px;border:1px solid #e9edef;border-radius:8px;background:white;cursor:pointer;font-size:14px;color:#374151;display:flex;align-items:center;justify-content:center" title="Ver perfil"><i class="bi bi-person-lines-fill"></i></button>
      </div>
    </div>

    <div style="padding:12px 14px;border-bottom:1px solid #f0f2f5">
      <!-- Seletor de funil -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:10px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px">Funil &amp; Estágio</div>
      </div>
      <select onchange="_wppTrocarFunil(${lead.id},this.value)"
        style="width:100%;border:1.5px solid ${funnelCor}66;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;color:#111b21;background:${funnelCor}0d;cursor:pointer;outline:none;margin-bottom:10px;appearance:none;-webkit-appearance:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23667781' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 10px center;padding-right:28px">
        ${allFunnels.map(f => `<option value="${_esc(f.id)}" ${f.id===leadFunnelId?'selected':''}>${_esc(f.label)}</option>`).join('')}
      </select>
      <!-- Estágios do funil selecionado -->
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${funnelStages.map(s => {
          const isActive = s.id === lead.stage;
          const clr = s.cor || '#6b7280';
          return `<button onclick="_wppMoverStage(${lead.id},'${s.id}')" style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;border:2px solid ${isActive?clr:'transparent'};background:${isActive?clr+'18':'#f1f5f9'};color:${isActive?clr:'#64748b'};transition:all .15s">${_esc(s.label)}</button>`;
        }).join('')}
      </div>
    </div>

    <div style="padding:12px 14px;border-bottom:1px solid #f0f2f5">
      <div style="font-size:10px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
        Reuniões
        <div style="display:flex;gap:4px">
          <button onclick="_wppAgendarLead(${lead.id},'online')" style="background:#6366f112;color:#6366f1;border:none;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700;padding:2px 7px"><i class="bi bi-camera-video-fill"></i> Online</button>
          <button onclick="_wppAgendarLead(${lead.id},'presencial')" style="background:#f59e0b12;color:#f59e0b;border:none;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700;padding:2px 7px"><i class="bi bi-geo-alt-fill"></i> Presencial</button>
        </div>
      </div>
      ${proxReuns.length ? proxReuns.slice(0,3).map(r => `
        <div style="background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:8px 10px;margin-bottom:6px">
          <div style="font-size:12px;font-weight:700;color:#111b21">${_esc(r.titulo)}</div>
          <div style="font-size:11px;color:#78716c;margin-top:2px">${r.data?new Date(r.data+'T00:00:00').toLocaleDateString('pt-BR'):''} ${r.hora?'às '+r.hora:''} · ${r.tipo==='online'?'🎥 Online':'📍 Presencial'}</div>
          ${r.meetLink?`<a href="${_esc(r.meetLink)}" target="_blank" style="font-size:11px;color:#4285f4;text-decoration:none;display:inline-block;margin-top:4px"><i class="bi bi-camera-video-fill"></i> Entrar no Meet →</a>`:''}
        </div>`).join('')
      : `<div style="font-size:12px;color:#9ca3af;text-align:center;padding:12px 0"><i class="bi bi-calendar-x" style="font-size:20px;display:block;margin-bottom:4px;opacity:0.5"></i>Sem reuniões agendadas</div>`}
    </div>

    <div style="padding:12px 14px;flex:1">
      <div style="font-size:10px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">Notas</div>
      ${notas.length ? notas.map(n => `
        <div style="background:#f8fafc;border-radius:8px;padding:8px 10px;margin-bottom:6px;border-left:3px solid #e2e8f0">
          <div style="font-size:12px;color:#374151;white-space:pre-wrap;word-break:break-word">${_esc(n.texto)}</div>
          <div style="font-size:10px;color:#9ca3af;margin-top:3px">${_wppRelTime(n.criadoEm)}</div>
        </div>`).join('')
      : `<div style="font-size:12px;color:#9ca3af;margin-bottom:8px">Nenhuma anotação ainda</div>`}
      <textarea id="wppNotaInput" style="width:100%;border:1px solid #e9edef;border-radius:8px;padding:8px 10px;font-size:12px;resize:none;min-height:56px;outline:none;font-family:inherit;background:#f8fafc;color:#374151;box-sizing:border-box" placeholder="Adicionar nota..."></textarea>
      <button onclick="_wppSalvarNota(${lead.id})" style="margin-top:5px;width:100%;padding:7px;border:none;border-radius:8px;background:#25d366;color:white;font-size:12px;font-weight:700;cursor:pointer"><i class="bi bi-save2"></i> Salvar nota</button>
    </div>
  `;
}

function _wppTrocarFunil(leadId, newFunnelId) {
  if (!newFunnelId || typeof leadUpdate !== 'function') return;
  const allFunnels = typeof funnelsGet === 'function' ? funnelsGet() : [];
  const newFunnel  = allFunnels.find(f => f.id === newFunnelId);
  if (!newFunnel) return;
  const firstStage = newFunnel.stages?.[0];
  const updateData = { funnel: newFunnelId };
  if (firstStage) updateData.stage = firstStage.id;
  leadUpdate(leadId, updateData);
  if (typeof leadAddHistorico === 'function') leadAddHistorico(leadId, 'Funil alterado para ' + newFunnel.label);
  const updatedLead = typeof storeGet === 'function' ? storeGet().find(l => l.id === leadId) : null;
  if (updatedLead) _wppRenderInfoPanel(updatedLead);
  _wppToast('Funil alterado para ' + newFunnel.label, 'success');
}

function _wppSalvarNota(leadId) {
  const textarea = document.getElementById('wppNotaInput');
  const texto = textarea?.value.trim();
  if (!texto) { _wppToast('Digite uma nota antes de salvar', 'error'); return; }
  const lead = leadAddNota ? leadAddNota(leadId, texto) : null;
  if (!lead) { _wppToast('Erro ao salvar nota', 'error'); return; }
  _wppToast('Nota salva!', 'success');
  _wppRenderInfoPanel(lead);
}

/* ─────────────────────────────────────────────
   CAMPANHA — Painel de disparo em massa
───────────────────────────────────────────── */
const _CMP_QUEUE_KEY = 'wpp_cmp_queue'; // fila persistente em sessionStorage

let _cmpRunning = false;
let _cmpPaused  = false;
let _cmpAbort   = false;

function _wppCampanhaHtml() {
  const leads  = storeGet ? storeGet() : [];
  const stages = [
    { v:'all',     l:'Todos os leads' },
    { v:'lead',    l:'Prospecção (Lead)' },
    { v:'quali',   l:'Qualificação' },
    { v:'sim',     l:'Simulação' },
    { v:'proposta',l:'Proposta enviada' },
    { v:'contrato',l:'Contrato fechado' },
  ];

  // Verifica se há campanha pendente para retomar
  const pending = _cmpQueueGet();
  const pendingBanner = pending
    ? `<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#92400e;display:flex;justify-content:space-between;align-items:center">
        <span><i class="bi bi-clock-history"></i> Campanha interrompida — <strong>${pending.pendentes.length}</strong> mensagem(ns) pendente(s)</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm" style="background:#fde68a;color:#92400e;border:none" onclick="_cmpRetomar()">Retomar</button>
          <button class="btn btn-sm" style="background:#fee2e2;color:#ef4444;border:none" onclick="_cmpDescartarFila()">Descartar</button>
        </div>
       </div>`
    : '';

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div style="font-size:18px;font-weight:800;color:var(--primary)"><i class="bi bi-megaphone-fill" style="color:#25d366"></i> Disparo de Campanha</div>
      <button class="modal-close" onclick="_wppCampanha()">✕</button>
    </div>

    ${pendingBanner}

    <div class="form-group">
      <label class="form-label">Segmento alvo</label>
      <select class="form-select" id="wppCmpSeg" onchange="_wppCmpCount()">
        ${stages.map(s=>`<option value="${s.v}">${s.l}</option>`).join('')}
      </select>
    </div>
    <div style="background:var(--bg);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px">
      Destinatários: <strong id="wppCmpCount">${leads.length}</strong> leads com telefone
    </div>
    <div class="form-group">
      <label class="form-label">Mensagem</label>
      <textarea class="form-textarea" id="wppCmpMsg" style="min-height:100px"
        placeholder="Olá {{nome}}, tudo bem? Tenho uma proposta especial de consórcio para você!"></textarea>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">Use <code>{{nome}}</code> para personalizar</div>
    </div>
    <div class="form-group">
      <label class="form-label">Intervalo entre envios: <strong id="wppCmpDelayVal">4</strong>s</label>
      <input type="range" id="wppCmpDelay" min="2" max="15" value="4" style="width:100%"
        oninput="document.getElementById('wppCmpDelayVal').textContent=this.value" />
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted)">
        <span>2s (mais rápido)</span><span>15s (mais seguro)</span>
      </div>
    </div>
    <div style="background:#fef2f2;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#b91c1c">
      <i class="bi bi-exclamation-triangle-fill"></i>
      Disparar muitas mensagens de forma automatizada pode resultar em banimento do número. Use com moderação e intervalos maiores.
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
      <div id="wppCmpStatus" style="font-size:13px;color:var(--muted);flex:1"></div>
      <div style="display:flex;gap:6px" id="wppCmpBtns">
        <button class="btn btn-primary" style="background:#25d366" onclick="_wppDispararCampanha()">
          <i class="bi bi-send-fill"></i> Disparar
        </button>
      </div>
    </div>
    <div id="wppCmpProgress" style="display:none;margin-top:12px">
      <div style="background:#e2e8f0;border-radius:6px;height:6px;overflow:hidden">
        <div id="wppCmpBar" style="height:100%;background:#25d366;width:0%;transition:width .3s"></div>
      </div>
    </div>`;
}

function _wppCampanha() {
  window.open('/campanha.html', '_blank');
}

function _wppCmpCount() {
  const seg   = document.getElementById('wppCmpSeg')?.value;
  const leads = (storeGet ? storeGet() : []).filter(l => l.telefone);
  const cnt   = seg === 'all' ? leads.length : leads.filter(l => l.stage === seg).length;
  const el    = document.getElementById('wppCmpCount');
  if (el) el.textContent = cnt;
}

/* ── Fila persistente ─────────────────────────────────────────────── */
function _cmpQueueGet() {
  try { return JSON.parse(sessionStorage.getItem(_CMP_QUEUE_KEY) || 'null'); } catch { return null; }
}
function _cmpQueueSet(data) {
  if (data) sessionStorage.setItem(_CMP_QUEUE_KEY, JSON.stringify(data));
  else sessionStorage.removeItem(_CMP_QUEUE_KEY);
}
function _cmpDescartarFila() {
  _cmpQueueSet(null);
}

/* ── Controles ────────────────────────────────────────────────────── */
function _cmpSetBtns(running) {
  const btns = document.getElementById('wppCmpBtns');
  if (!btns) return;
  if (running) {
    btns.innerHTML = `
      <button class="btn btn-sm" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a" onclick="_cmpTogglePause()">
        <i class="bi bi-pause-fill" id="cmpPauseIcon"></i> <span id="cmpPauseLabel">Pausar</span>
      </button>
      <button class="btn btn-sm" style="background:#fee2e2;color:#ef4444;border:1px solid #fecaca" onclick="_cmpAbortar()">
        <i class="bi bi-stop-fill"></i> Cancelar
      </button>`;
  } else {
    btns.innerHTML = `
      <button class="btn btn-primary" style="background:#25d366" onclick="_wppDispararCampanha()">
        <i class="bi bi-send-fill"></i> Disparar
      </button>`;
  }
}

function _cmpTogglePause() {
  _cmpPaused = !_cmpPaused;
  const icon  = document.getElementById('cmpPauseIcon');
  const label = document.getElementById('cmpPauseLabel');
  if (icon)  icon.className  = _cmpPaused ? 'bi bi-play-fill'  : 'bi bi-pause-fill';
  if (label) label.textContent = _cmpPaused ? 'Retomar' : 'Pausar';
}

function _cmpAbortar() {
  if (!confirm('Cancelar a campanha? Os envios pendentes serão descartados.')) return;
  _cmpAbort = true;
  _cmpQueueSet(null);
}

/* ── Dispatch ─────────────────────────────────────────────────────── */
async function _wppDispararCampanha() {
  const seg   = document.getElementById('wppCmpSeg')?.value;
  const msg   = document.getElementById('wppCmpMsg')?.value.trim();
  const delay = parseInt(document.getElementById('wppCmpDelay')?.value || '4', 10) * 1000;

  if (!msg) { _wppToast('Digite uma mensagem', 'error'); return; }

  const leads = (storeGet ? storeGet() : [])
    .filter(l => seg === 'all' || l.stage === seg)
    .filter(l => l.telefone);

  if (!leads.length) { _wppToast('Nenhum lead com telefone neste segmento', 'error'); return; }
  if (!confirm(`Enviar para ${leads.length} lead(s) com intervalo de ${delay/1000}s entre cada envio?`)) return;

  const fila = leads.map(l => ({
    leadId:  l.id,
    nome:    l.nome,
    phone:   '55' + l.telefone.replace(/\D/g, '') + '@s.whatsapp.net',
    texto:   msg.replace(/{{nome}}/g, l.nome),
  }));

  _cmpQueueSet({ total: fila.length, pendentes: fila, ok: 0, err: 0, msg, delay, criadoEm: new Date().toISOString() });
  await _cmpExecutar(delay);
}

async function _cmpRetomar() {
  const q = _cmpQueueGet();
  if (!q) return;
  await _cmpExecutar(q.delay || 4000);
}

async function _cmpExecutar(delay) {
  if (_cmpRunning) return;
  _cmpRunning = true;
  _cmpPaused  = false;
  _cmpAbort   = false;

  const status   = document.getElementById('wppCmpStatus');
  const bar      = document.getElementById('wppCmpBar');
  const progress = document.getElementById('wppCmpProgress');
  if (progress) progress.style.display = 'block';
  _cmpSetBtns(true);

  let q = _cmpQueueGet();
  if (!q) { _cmpRunning = false; return; }

  while (q.pendentes.length > 0 && !_cmpAbort) {
    // Pausa: aguarda até destravar
    while (_cmpPaused && !_cmpAbort) {
      await new Promise(r => setTimeout(r, 500));
      // Relê q para atualizar estado
    }
    if (_cmpAbort) break;

    const item = q.pendentes[0];
    try {
      const r = await fetch(`${WPP_BASE}/send/text`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chatId: item.phone, text: item.texto }),
      });
      r.ok ? q.ok++ : q.err++;
    } catch { q.err++; }

    q.pendentes.shift();
    _cmpQueueSet(q.pendentes.length > 0 ? q : null);

    const enviados = q.total - q.pendentes.length;
    const pct      = Math.round((enviados / q.total) * 100);
    if (status) status.textContent = `Enviando ${enviados}/${q.total} — OK: ${q.ok} · Erros: ${q.err}`;
    if (bar)    bar.style.width = pct + '%';

    if (q.pendentes.length > 0) await new Promise(r => setTimeout(r, delay));

    q = _cmpQueueGet() || q; // relê para caso tenha sido descartado externamente
  }

  _cmpRunning = false;
  _cmpSetBtns(false);
  if (progress) progress.style.display = 'none';

  if (_cmpAbort) {
    if (status) status.innerHTML = `<span style="color:#ef4444">✗ Campanha cancelada</span>`;
  } else {
    _cmpQueueSet(null);
    if (status) status.innerHTML = `<span style="color:#16a34a">✓ Campanha concluída: ${q.ok} enviados, ${q.err} erros</span>`;
  }
}

/* ─────────────────────────────────────────────
   AÇÕES GERAIS
───────────────────────────────────────────── */
async function _wppSolicitarQR() {
  WPP.status = 'connecting';
  WPP.qrImg  = null;
  _wppRender();

  // Chama reinit no servidor — verifica a resposta para detectar falha da Evolution API
  try {
    const resp = await fetch(`${WPP_BASE}/reinit`, { method: 'POST' });
    if (!resp.ok) {
      // Servidor Node.js está de pé, mas Evolution API retornou erro
      WPP.status = 'evo_offline';
      _wppRender();
      return;
    }
  } catch {
    // Servidor Node.js inacessível
    WPP.status = 'server_offline';
    _wppRender();
    return;
  }

  // Timeout de 20s aguardando o QR chegar via webhook
  clearTimeout(WPP._qrTimeout);
  WPP._qrTimeout = setTimeout(() => {
    if (WPP.status === 'connecting') {
      WPP.status = 'evo_offline';
      _wppRender();
    }
  }, 20000);

  // Reconecta o socket se foi desconectado pelo usuário
  if (!WPP.socket || !WPP.socket.connected) {
    WPP.socket = null;
    _wppConnect();
  }
}

function _wppDesconectar() {
  const html = `
    <div style="padding:4px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
        <div style="width:42px;height:42px;border-radius:50%;background:#fee2e2;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="bi bi-plug-fill" style="color:#ef4444;font-size:18px"></i>
        </div>
        <div>
          <div style="font-size:15px;font-weight:800;color:#1f2937">Desconectar WhatsApp</div>
          <div style="font-size:12px;color:#6b7280">Como deseja sair?</div>
        </div>
      </div>

      <!-- Opção 1: manter tudo -->
      <div onclick="_wppConfirmarDesconectar(false,false)"
        style="display:flex;align-items:flex-start;gap:12px;padding:14px;border:1.5px solid #e5e7eb;border-radius:10px;cursor:pointer;margin-bottom:10px;transition:all .15s"
        onmouseover="this.style.borderColor='#1a3a5c';this.style.background='#f0f4ff'"
        onmouseout="this.style.borderColor='#e5e7eb';this.style.background=''">
        <div style="width:38px;height:38px;border-radius:50%;background:#dbeafe;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">
          <i class="bi bi-archive-fill" style="color:#1d4ed8;font-size:16px"></i>
        </div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#1f2937">Desconectar e manter histórico</div>
          <div style="font-size:11px;color:#6b7280;margin-top:3px;line-height:1.5">
            Os vínculos entre conversas e leads ficam salvos.<br>
            Ao reconectar, tudo será reconhecido automaticamente.
          </div>
        </div>
      </div>

      <!-- Opção 2: limpar tudo -->
      <div onclick="_wppConfirmarDesconectar(true,true)"
        style="display:flex;align-items:flex-start;gap:12px;padding:14px;border:1.5px solid #e5e7eb;border-radius:10px;cursor:pointer;margin-bottom:10px;transition:all .15s"
        onmouseover="this.style.borderColor='#ef4444';this.style.background='#fff5f5'"
        onmouseout="this.style.borderColor='#e5e7eb';this.style.background=''">
        <div style="width:38px;height:38px;border-radius:50%;background:#fee2e2;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">
          <i class="bi bi-trash3-fill" style="color:#ef4444;font-size:16px"></i>
        </div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#1f2937">Desconectar e limpar tudo</div>
          <div style="font-size:11px;color:#6b7280;margin-top:3px;line-height:1.5">
            Remove conversas e vínculos do sistema.<br>
            Ao reconectar, será necessário vincular os leads novamente.
          </div>
        </div>
      </div>

      <!-- Opção 3: só vínculos -->
      <div onclick="_wppConfirmarDesconectar(false,true)"
        style="display:flex;align-items:flex-start;gap:12px;padding:14px;border:1.5px solid #e5e7eb;border-radius:10px;cursor:pointer;margin-bottom:18px;transition:all .15s"
        onmouseover="this.style.borderColor='#f59e0b';this.style.background='#fffbeb'"
        onmouseout="this.style.borderColor='#e5e7eb';this.style.background=''">
        <div style="width:38px;height:38px;border-radius:50%;background:#fef3c7;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">
          <i class="bi bi-link-45deg" style="color:#d97706;font-size:18px"></i>
        </div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#1f2937">Desconectar e limpar só os vínculos</div>
          <div style="font-size:11px;color:#6b7280;margin-top:3px;line-height:1.5">
            Remove os vínculos conversa → lead, mas mantém os leads no CRM.<br>
            Útil para reconectar com outro número.
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="document.querySelector('.wpp-modal')?.remove()">Cancelar</button>
      </div>
    </div>`;

  _wppShowModal(html);
}

async function _wppConfirmarDesconectar(limparConversas = false, limparLinks = false) {
  document.querySelector('.wpp-modal')?.remove();

  // Desconecta socket antes de qualquer chamada ao servidor
  if (WPP.socket) {
    WPP.socket.io.opts.reconnection = false;
    WPP.socket.disconnect();
    WPP.socket = null;
  }
  clearInterval(WPP.qrTimer);
  WPP.qrTimer       = null;
  clearInterval(WPP._statusPoller);
  WPP._statusPoller = null;
  clearInterval(WPP._connPoller);
  WPP._connPoller   = null;
  _wppStopMsgPolling();

  if (limparConversas) {
    // Deleta e recria a instância no Evolution API — apaga histórico do servidor
    _wppToast('Limpando histórico no servidor...', 'info');
    try {
      await fetch(`${WPP_BASE}/clear-instance`, { method: 'POST' });
    } catch {}
  } else {
    // Só faz logout (mantém dados cacheados na Evolution API)
    try {
      await fetch(`${WPP_BASE}/disconnect`, { method: 'POST' });
    } catch {}
  }

  // Limpa estado em memória
  WPP.status        = 'disconnected';
  WPP.chats         = [];
  WPP.messages      = {};
  WPP.contacts      = {};
  WPP.info          = null;
  WPP.currentChatId = null;
  WPP.infoPanelOpen = false;

  if (limparLinks) {
    localStorage.removeItem('crm_wpp_links');
  }

  const msg = limparConversas
    ? 'Histórico apagado do servidor. Pronto para novo número.'
    : 'Desconectado. Histórico mantido.';
  _wppToast(msg, 'success');
  _wppRender();
}

function _wppLimparHistorico() {
  _wppShowModal(`
    <div style="padding:4px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div style="width:42px;height:42px;border-radius:50%;background:#fef3c7;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="bi bi-trash3-fill" style="color:#f59e0b;font-size:18px"></i>
        </div>
        <div>
          <div style="font-size:15px;font-weight:800;color:#1f2937">Limpar dados do WhatsApp</div>
          <div style="font-size:12px;color:#6b7280">Sem desconectar a sessão</div>
        </div>
      </div>
      <div style="font-size:13px;color:#374151;margin-bottom:18px;line-height:1.6">
        Apaga o histórico de conversas do servidor da Evolution API e limpa os vínculos com leads.<br>
        A sessão WhatsApp continua ativa — apenas os dados em cache são removidos.
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="document.querySelector('.wpp-modal')?.remove()">Cancelar</button>
        <button onclick="_wppExecutarLimpezaCache()"
          style="background:#f59e0b;color:white;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer">
          <i class="bi bi-trash3-fill"></i> Limpar histórico
        </button>
      </div>
    </div>`);
}

async function _wppExecutarLimpezaCache() {
  document.querySelector('.wpp-modal')?.remove();
  _wppToast('Limpando histórico no servidor...', 'info');
  try {
    await fetch(`${WPP_BASE}/clear-instance`, { method: 'POST' });
  } catch {}
  WPP.chats         = [];
  WPP.messages      = {};
  WPP.contacts      = {};
  WPP.currentChatId = null;
  localStorage.removeItem('crm_wpp_links');
  _wppToast('Histórico limpo no servidor e no sistema', 'success');
  // Recarrega chats (agora virão vazios da instância recriada)
  if (WPP.status === 'ready') {
    _wppRenderApp();
    _wppLoadChats();
  }
}

function _wppNovaConversa() {
  _wppShowModal(`
    <div style="padding:4px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#25d366,#128c7e);display:flex;align-items:center;justify-content:center"><i class="bi bi-pencil-square" style="color:white;font-size:17px"></i></div>
        <div style="font-size:16px;font-weight:800;color:#111b21">Nova conversa</div>
      </div>
      <label style="font-size:11px;font-weight:700;color:#667781;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">Número do WhatsApp</label>
      <input id="wppNovaNum" type="tel" placeholder="(11) 99999-0000"
        style="width:100%;border:2px solid #e9edef;border-radius:10px;padding:11px 13px;font-size:14px;outline:none;font-family:inherit;box-sizing:border-box;transition:border-color .15s"
        oninput="_wppValidaNovoNum(this)" />
      <div id="wppNovaHint" style="font-size:11px;color:#9ca3af;margin-top:6px"><i class="bi bi-info-circle"></i> Digite o número com DDD. Ex: 11999990000</div>
      <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="this.closest('.wpp-modal').remove()" style="padding:9px 18px;border-radius:8px;border:1px solid #e9edef;background:white;color:#667781;font-size:13px;cursor:pointer">Cancelar</button>
        <button id="wppNovaOk" disabled onclick="_wppNovaConversaOk()" style="padding:9px 22px;border-radius:8px;border:none;background:#25d366;color:white;font-size:13px;font-weight:700;cursor:pointer;opacity:.45"><i class="bi bi-chat-fill"></i> Iniciar</button>
      </div>
    </div>
  `);
  setTimeout(() => document.getElementById('wppNovaNum')?.focus(), 50);
}

function _wppValidaNovoNum(input) {
  const digits = input.value.replace(/\D/g, '');
  const hint   = document.getElementById('wppNovaHint');
  const btn    = document.getElementById('wppNovaOk');
  const ok     = digits.length >= 10;
  input.style.borderColor = ok ? '#25d366' : (digits.length ? '#ef4444' : '#e9edef');
  if (hint) hint.innerHTML = ok
    ? `<i class="bi bi-check-circle-fill" style="color:#25d366"></i> Número válido: ${_wppFmtPhone(digits)}`
    : (digits.length ? `<i class="bi bi-exclamation-circle" style="color:#ef4444"></i> Faltam ${10 - digits.length} dígito(s)` : `<i class="bi bi-info-circle"></i> Digite o número com DDD. Ex: 11999990000`);
  if (btn) { btn.disabled = !ok; btn.style.opacity = ok ? '1' : '.45'; }
}

function _wppNovaConversaOk() {
  const input = document.getElementById('wppNovaNum');
  if (!input) return;
  let number = input.value.replace(/\D/g, '');
  if (number.length < 10) return;
  // Adiciona DDI 55 se necessário (BR)
  if (number.length === 10 || number.length === 11) number = '55' + number;
  document.querySelector('.wpp-modal')?.remove();
  const chatId = `${number}@s.whatsapp.net`;
  if (!WPP.chats.find(c => c.id === chatId)) {
    WPP.chats.unshift({ id: chatId, name: _wppFmtPhone(number), phone: number, unreadCount: 0, timestamp: Date.now() / 1000, lastMessage: null });
    _wppRenderChatList();
  }
  _wppSelectChat(chatId);
}

/* ─────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────── */
function _wppFormatTime(ts) {
  if (!ts) return '';
  const d    = new Date(ts * 1000);
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function _wppFormatDateLabel(ts) {
  if (!ts) return '';
  const d    = new Date(ts * 1000);
  const hoje = new Date();
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate()-1);
  if (d.toDateString() === hoje.toDateString())  return 'Hoje';
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function _wppMsgPreview(lastMsg) {
  if (!lastMsg) return '';
  const icons = { image:'📷', video:'🎥', audio:'🎙', ptt:'🎙', document:'📄', sticker:'🏷', location:'📍', vcard:'👤' };
  const icon  = icons[lastMsg.type] || '';
  const body  = lastMsg.body || '';
  // Filtra textos placeholder/internos que não devem aparecer
  if (!body && !icon) return '';
  if (/^\[.+\]$/.test(body.trim())) return icon ? (icon + ' ' + (lastMsg.type || '')) : '';
  const prefix = lastMsg.fromMe ? 'Você: ' : '';
  return prefix + (icon ? icon + ' ' : '') + body.slice(0, 45) + (body.length > 45 ? '...' : '');
}

function _wppAckIcon(ack) {
  const icons = {
    [-1]: `<i class="bi bi-exclamation-circle" style="color:#ef4444;font-size:11px" class="wpp-ack"></i>`,
    0:    `<i class="bi bi-clock" style="color:#667781;font-size:10px" class="wpp-ack"></i>`,
    1:    `<span style="color:#667781;font-size:11px" class="wpp-ack">✓</span>`,
    2:    `<span style="color:#667781;font-size:11px" class="wpp-ack">✓✓</span>`,
    3:    `<span style="color:#53bdeb;font-size:11px" class="wpp-ack">✓✓</span>`,
    4:    `<span style="color:#53bdeb;font-size:11px" class="wpp-ack">▶▶</span>`,
  };
  return icons[ack] || '';
}

const _WPP_COLORS = ['#d32f2f','#c2185b','#7b1fa2','#512da8','#1976d2','#0288d1','#00796b','#388e3c','#f57c00','#5d4037'];
function _wppAvatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return _WPP_COLORS[Math.abs(h) % _WPP_COLORS.length];
}

function _wppToast(msg, tipo = 'info') {
  const el = document.getElementById('wppToast');
  if (!el) return;
  const colors = { info:'#1f2937', success:'#16a34a', error:'#ef4444' };
  el.style.background = colors[tipo] || colors.info;
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function _wppShowModal(html) {
  document.querySelectorAll('.wpp-modal').forEach(e => e.remove());
  const div = document.createElement('div');
  div.className = 'wpp-modal';
  div.setAttribute('data-wpp-modal-overlay', '1');
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:3000;display:flex;align-items:center;justify-content:center;padding:16px';
  div.innerHTML = `<div style="background:white;border-radius:14px;padding:24px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto">${html}</div>`;
  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
  return div;
}

function _wppCloseModal() {
  const overlay = document.querySelector('[data-wpp-modal-overlay]');
  if (overlay) overlay.remove();
}

// Atualiza opacidade do botão enviar baseado no conteúdo do textarea
function _wppUpdateSendBtn() {
  const ta  = document.getElementById('wppInput');
  const btn = document.getElementById('wppSendBtn');
  if (!ta || !btn) return;
  btn.style.opacity = ta.value.trim().length > 0 ? '1' : '0.4';
}

// ── Gravação de voz ──────────────────────────────────────────────────
let _mediaRecorder  = null;
let _recordChunks   = [];
let _recordCanceled = false;
let _recordStream   = null;
let _recordTimer    = null;
let _recordSeconds  = 0;
let _recordChatId   = null;

function _wppBestAudioMime() {
  const candidates = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg','audio/mp4'];
  for (const t of candidates) {
    try { if (MediaRecorder.isTypeSupported(t)) return t; } catch (_) {}
  }
  return '';
}

// Clique no botão mic: se não está gravando → inicia; se está → para e envia
async function _wppToggleRecording(chatId) {
  if (_mediaRecorder) {
    _wppStopAndSendRecording();
  } else {
    await _wppStartRecording(chatId);
  }
}

async function _wppStartRecording(chatId) {
  if (_mediaRecorder) return;
  _recordCanceled = false;
  _recordChatId   = chatId;
  try {
    _recordStream  = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = _wppBestAudioMime();
    _recordChunks  = [];
    _mediaRecorder = mimeType
      ? new MediaRecorder(_recordStream, { mimeType })
      : new MediaRecorder(_recordStream);
    const usedMime = _mediaRecorder.mimeType || mimeType || 'audio/webm';

    _mediaRecorder.ondataavailable = e => { if (e.data.size > 0) _recordChunks.push(e.data); };
    _mediaRecorder.onstop = async () => {
      if (_recordStream) { _recordStream.getTracks().forEach(t => t.stop()); _recordStream = null; }
      _wppStopRecordTimer();
      _wppSetRecordingUI(false);
      if (_recordCanceled || _recordChunks.length === 0) {
        _mediaRecorder = null; _recordChunks = []; return;
      }
      const blob = new Blob(_recordChunks, { type: usedMime });
      _mediaRecorder = null; _recordChunks = [];
      const ext = usedMime.includes('ogg') ? 'ogg' : usedMime.includes('mp4') ? 'mp4' : 'webm';
      const fd  = new FormData();
      fd.append('chatId', chatId);
      fd.append('file', blob, `voice.${ext}`);
      _wppToast('Enviando áudio...', 'info');
      const r = await fetch(`${WPP_BASE}/send/audio`, { method: 'POST', body: fd });
      if (r.ok) {
        _wppToast('Áudio enviado!', 'success');
      } else {
        const err = await r.json().catch(() => ({}));
        _wppToast('Erro ao enviar áudio: ' + (err.error || r.status), 'error');
      }
    };

    _mediaRecorder.start(200); // coleta chunks a cada 200ms
    _wppSetRecordingUI(true);
    _wppStartRecordTimer();
  } catch (e) {
    _wppToast('Microfone não disponível: ' + e.message, 'error');
    _mediaRecorder = null;
  }
}

function _wppStopAndSendRecording() {
  _recordCanceled = false;
  if (_mediaRecorder && _mediaRecorder.state !== 'inactive') _mediaRecorder.stop();
}

function _wppCancelRecording() {
  _recordCanceled = true;
  if (_mediaRecorder && _mediaRecorder.state !== 'inactive') _mediaRecorder.stop();
  else {
    if (_recordStream) { _recordStream.getTracks().forEach(t => t.stop()); _recordStream = null; }
    _wppStopRecordTimer();
    _wppSetRecordingUI(false);
    _mediaRecorder = null; _recordChunks = [];
  }
}

function _wppSetRecordingUI(recording) {
  const input = document.getElementById('wppInput');
  const recBar = document.getElementById('wppRecordingBar');
  const micBtn  = document.getElementById('wppMicBtn');
  const sendBtn = document.getElementById('wppSendBtn');
  if (input)  input.style.display   = recording ? 'none' : 'block';
  if (recBar) recBar.style.display  = recording ? 'flex' : 'none';
  if (micBtn) {
    micBtn.classList.toggle('recording', recording);
    micBtn.title = recording ? 'Enviar áudio' : 'Gravar mensagem de voz';
    micBtn.innerHTML = recording
      ? '<i class="bi bi-send-fill" style="font-size:18px"></i>'
      : '<i class="bi bi-mic-fill" style="font-size:18px"></i>';
  }
  if (sendBtn) sendBtn.style.display = recording ? 'none' : 'flex';
}

function _wppStartRecordTimer() {
  _recordSeconds = 0;
  _wppUpdateRecordTimer();
  _recordTimer = setInterval(_wppUpdateRecordTimer, 1000);
}

function _wppStopRecordTimer() {
  if (_recordTimer) { clearInterval(_recordTimer); _recordTimer = null; }
}

function _wppUpdateRecordTimer() {
  _recordSeconds++;
  const m = Math.floor(_recordSeconds / 60);
  const s = _recordSeconds % 60;
  const el = document.getElementById('wppRecordTimer');
  if (el) el.textContent = `${m}:${String(s).padStart(2,'0')}`;
}

// Envio de arquivo de áudio via input file (anexo)
async function _wppSendAudioFile(event, chatId) {
  const file = event.target.files?.[0];
  if (!file) return;
  _wppToast('Enviando áudio...', 'info');
  const fd = new FormData();
  fd.append('chatId', chatId);
  fd.append('file', file);
  try {
    const r = await fetch(`${WPP_BASE}/send/audio`, { method: 'POST', body: fd });
    if (r.ok) _wppToast('Áudio enviado!', 'success');
    else _wppToast('Erro ao enviar áudio', 'error');
  } catch (e) {
    _wppToast('Erro ao enviar áudio', 'error');
  }
  event.target.value = '';
}

// Camera modal using getUserMedia
let _cameraStream = null;
function _wppOpenCamera(chatId) {
  document.getElementById('wppAttachMenu').style.display = 'none';
  _wppShowModal(`
    <div style="text-align:center">
      <h3 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#111b21">Câmera</h3>
      <video id="wppCamVideo" autoplay playsinline style="width:100%;max-height:400px;border-radius:10px;background:#111;display:block"></video>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:14px">
        <button onclick="_wppCaptureFoto('${chatId}')" style="background:#25d366;color:white;border:none;border-radius:10px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer;flex:1"><i class="bi bi-camera-fill"></i> Capturar</button>
        <button onclick="_wppFecharCamera()" style="background:#e9edef;color:#374151;border:none;border-radius:10px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer;flex:1">Cancelar</button>
      </div>
    </div>
  `);
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(stream => {
      _cameraStream = stream;
      const vid = document.getElementById('wppCamVideo');
      if (vid) vid.srcObject = stream;
    })
    .catch(e => {
      _wppFecharCamera();
      _wppToast('Câmera não disponível: ' + e.message, 'error');
    });
}

function _wppFecharCamera() {
  if (_cameraStream) { _cameraStream.getTracks().forEach(t => t.stop()); _cameraStream = null; }
  _wppCloseModal();
}

function _wppCaptureFoto(chatId) {
  const vid = document.getElementById('wppCamVideo');
  if (!vid) return;
  const canvas = document.createElement('canvas');
  canvas.width = vid.videoWidth;
  canvas.height = vid.videoHeight;
  canvas.getContext('2d').drawImage(vid, 0, 0);
  canvas.toBlob(async blob => {
    _wppFecharCamera();
    if (!blob) { _wppToast('Erro ao capturar imagem', 'error'); return; }
    const fd = new FormData();
    fd.append('chatId', chatId);
    fd.append('file', blob, 'camera.jpg');
    const r = await fetch(`${WPP_BASE}/send/media`, { method: 'POST', body: fd });
    if (!r.ok) _wppToast('Erro ao enviar foto', 'error');
    else _wppToast('Foto enviada!', 'success');
  }, 'image/jpeg', 0.9);
}

// Location sharing
async function _wppSendLocalizacao(chatId) {
  document.getElementById('wppAttachMenu').style.display = 'none';
  if (!navigator.geolocation) { _wppToast('Geolocalização não suportada', 'error'); return; }
  _wppToast('Obtendo localização…', 'info');
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const { latitude, longitude } = pos.coords;
      try {
        const r = await fetch(`${WPP_BASE}/send/location`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, latitude, longitude, name: 'Localização atual', address: '' }),
        });
        if (!r.ok) throw new Error((await r.json()).error);
        _wppToast('Localização enviada!', 'success');
      } catch (e) { _wppToast('Erro: ' + e.message, 'error'); }
    },
    err => { _wppToast('Erro de geolocalização: ' + err.message, 'error'); },
    { timeout: 10000 }
  );
}

// Poll / Enquete
function _wppCriarEnquete(chatId) {
  document.getElementById('wppAttachMenu').style.display = 'none';
  _wppShowModal(`
    <div>
      <h3 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111b21">Criar Enquete</h3>
      <input id="pollTitle" placeholder="Pergunta da enquete" style="width:100%;padding:10px 12px;border:1.5px solid #e9edef;border-radius:8px;font-size:14px;outline:none;margin-bottom:10px;box-sizing:border-box" maxlength="255"/>
      <div id="pollOptions">
        <input class="pollOpt" placeholder="Opção 1" style="width:100%;padding:9px 12px;border:1.5px solid #e9edef;border-radius:8px;font-size:14px;outline:none;margin-bottom:6px;box-sizing:border-box" maxlength="100"/>
        <input class="pollOpt" placeholder="Opção 2" style="width:100%;padding:9px 12px;border:1.5px solid #e9edef;border-radius:8px;font-size:14px;outline:none;margin-bottom:6px;box-sizing:border-box" maxlength="100"/>
      </div>
      <button onclick="_wppAddPollOption()" style="background:none;border:1.5px dashed #25d366;color:#25d366;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;width:100%;margin-bottom:12px"><i class="bi bi-plus-circle"></i> Adicionar opção</button>
      <div style="display:flex;gap:10px">
        <button onclick="_wppEnviarEnquete('${chatId}')" style="flex:1;background:#25d366;color:white;border:none;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer"><i class="bi bi-send-fill"></i> Enviar</button>
        <button onclick="_wppCloseModal()" style="flex:1;background:#e9edef;color:#374151;border:none;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer">Cancelar</button>
      </div>
    </div>
  `);
}

function _wppAddPollOption() {
  const container = document.getElementById('pollOptions');
  if (!container) return;
  const opts = container.querySelectorAll('.pollOpt');
  if (opts.length >= 12) { _wppToast('Máximo de 12 opções', 'error'); return; }
  const inp = document.createElement('input');
  inp.className = 'pollOpt';
  inp.placeholder = `Opção ${opts.length + 1}`;
  inp.maxLength = 100;
  inp.style.cssText = 'width:100%;padding:9px 12px;border:1.5px solid #e9edef;border-radius:8px;font-size:14px;outline:none;margin-bottom:6px;box-sizing:border-box';
  container.appendChild(inp);
}

async function _wppEnviarEnquete(chatId) {
  const title = document.getElementById('pollTitle')?.value.trim();
  const options = [...document.querySelectorAll('.pollOpt')].map(i => i.value.trim()).filter(Boolean);
  if (!title) { _wppToast('Digite a pergunta da enquete', 'error'); return; }
  if (options.length < 2) { _wppToast('Adicione ao menos 2 opções', 'error'); return; }
  try {
    const r = await fetch(`${WPP_BASE}/send/poll`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, title, options, selectableCount: 1 }),
    });
    if (!r.ok) throw new Error((await r.json()).error);
    _wppCloseModal();
    _wppToast('Enquete enviada!', 'success');
  } catch (e) { _wppToast('Erro: ' + e.message, 'error'); }
}

// Event sharing
function _wppCriarEvento(chatId) {
  document.getElementById('wppAttachMenu').style.display = 'none';
  _wppShowModal(`
    <div>
      <h3 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111b21"><i class="bi bi-calendar-event-fill" style="color:#f97316"></i> Compartilhar Evento</h3>
      <input id="evtTitle" placeholder="Título do evento" style="width:100%;padding:10px 12px;border:1.5px solid #e9edef;border-radius:8px;font-size:14px;outline:none;margin-bottom:8px;box-sizing:border-box"/>
      <input id="evtDate" type="datetime-local" style="width:100%;padding:10px 12px;border:1.5px solid #e9edef;border-radius:8px;font-size:14px;outline:none;margin-bottom:8px;box-sizing:border-box"/>
      <input id="evtLocal" placeholder="Local (opcional)" style="width:100%;padding:10px 12px;border:1.5px solid #e9edef;border-radius:8px;font-size:14px;outline:none;margin-bottom:8px;box-sizing:border-box"/>
      <textarea id="evtDesc" placeholder="Descrição (opcional)" rows="3" style="width:100%;padding:10px 12px;border:1.5px solid #e9edef;border-radius:8px;font-size:14px;outline:none;margin-bottom:12px;box-sizing:border-box;resize:none"></textarea>
      <div style="display:flex;gap:10px">
        <button onclick="_wppEnviarEvento('${chatId}')" style="flex:1;background:#f97316;color:white;border:none;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer"><i class="bi bi-send-fill"></i> Enviar</button>
        <button onclick="_wppCloseModal()" style="flex:1;background:#e9edef;color:#374151;border:none;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer">Cancelar</button>
      </div>
    </div>
  `);
}

async function _wppEnviarEvento(chatId) {
  const title = document.getElementById('evtTitle')?.value.trim();
  const date  = document.getElementById('evtDate')?.value;
  const local = document.getElementById('evtLocal')?.value.trim();
  const desc  = document.getElementById('evtDesc')?.value.trim();
  if (!title || !date) { _wppToast('Título e data são obrigatórios', 'error'); return; }
  const dt = new Date(date).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });
  const lines = [`📅 *${title}*`, `🗓 ${dt}`, local ? `📍 ${local}` : '', desc ? `📝 ${desc}` : ''].filter(Boolean);
  const ta = document.getElementById('wppInput');
  if (ta) { ta.value = lines.join('\n'); _wppUpdateSendBtn(); ta.focus(); }
  _wppCloseModal();
}

/* ─────────────────────────────────────────────
   NOTIFICATION BELL
───────────────────────────────────────────── */
function _wppGetNotifications() {
  const notifications = [];
  const now = new Date();
  const leads = typeof storeGet === 'function' ? storeGet() : [];

  for (const lead of leads) {
    // Leads inactive for 7+ days
    const updated = new Date(lead.atualizadoEm || lead.criadoEm);
    const daysSince = (now - updated) / (1000 * 60 * 60 * 24);
    if (daysSince >= 7 && lead.stage !== 'posvenda' && lead.stage !== 'contrato') {
      notifications.push({
        type: 'inactive',
        priority: 'medium',
        icon: 'bi-person-clock',
        color: '#f59e0b',
        title: `${lead.nome} sem contato`,
        body: `${Math.floor(daysSince)} dias sem interação`,
        leadId: lead.id,
      });
    }

    // Overdue or upcoming agendamentos (within 24h)
    for (const ag of (lead.agendamentos || [])) {
      if (ag.status === 'cancelado') continue;
      const agDate = new Date(ag.data);
      const diffH = (agDate - now) / (1000 * 60 * 60);
      if (diffH < 0 && diffH > -72 && ag.status !== 'realizado') {
        notifications.push({
          type: 'overdue',
          priority: 'high',
          icon: 'bi-calendar-x-fill',
          color: '#ef4444',
          title: `Reunião em atraso: ${lead.nome}`,
          body: `${ag.tipo||'Reunião'} · ${new Date(ag.data).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`,
          leadId: lead.id,
        });
      } else if (diffH >= 0 && diffH <= 24) {
        notifications.push({
          type: 'upcoming',
          priority: 'high',
          icon: 'bi-calendar-event-fill',
          color: '#6366f1',
          title: `Reunião em breve: ${lead.nome}`,
          body: `${ag.tipo||'Reunião'} · ${new Date(ag.data).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`,
          leadId: lead.id,
        });
      }
    }
  }

  // Sort: high priority first
  notifications.sort((a, b) => (a.priority === 'high' ? -1 : 1));
  return notifications;
}

function _wppRenderNotificationBell() {
  const notifs = _wppGetNotifications();
  const count = notifs.length;

  // Update badge on bell button
  const bellBtn = document.getElementById('wppBellBtn');
  if (!bellBtn) return;

  let badge = document.getElementById('wppBellBadge');
  if (count > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'wppBellBadge';
      badge.style.cssText = 'position:absolute;top:-4px;right:-4px;background:#ef4444;color:white;font-size:10px;font-weight:700;border-radius:999px;padding:1px 5px;min-width:16px;text-align:center;pointer-events:none';
      bellBtn.style.position = 'relative';
      bellBtn.appendChild(badge);
    }
    badge.textContent = count > 9 ? '9+' : count;
  } else if (badge) {
    badge.remove();
  }
}

function _wppToggleNotifications() {
  const existing = document.getElementById('wppNotifPanel');
  if (existing) { existing.remove(); return; }

  const notifs = _wppGetNotifications();
  const panel = document.createElement('div');
  panel.id = 'wppNotifPanel';
  panel.style.cssText = 'position:fixed;top:52px;right:16px;width:340px;max-height:480px;background:white;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,0.18);z-index:3000;overflow:hidden;display:flex;flex-direction:column;border:1px solid #e9edef';

  const header = `<div style="padding:14px 16px;border-bottom:1px solid #e9edef;display:flex;align-items:center;justify-content:space-between">
    <span style="font-size:14px;font-weight:700;color:#111b21"><i class="bi bi-bell-fill" style="color:#6366f1"></i> Notificações</span>
    <button onclick="document.getElementById('wppNotifPanel').remove()" style="background:none;border:none;color:#667781;cursor:pointer;font-size:18px;line-height:1">×</button>
  </div>`;

  const body = notifs.length === 0
    ? `<div style="padding:32px 16px;text-align:center;color:#667781;font-size:13px"><i class="bi bi-check-circle-fill" style="font-size:32px;color:#25d366;display:block;margin-bottom:10px"></i>Tudo em dia! Nenhuma notificação.</div>`
    : `<div style="overflow-y:auto;flex:1">${notifs.map(n => `
        <div onclick="if(typeof _wppSelectLeadById==='function')_wppSelectLeadById(${n.leadId});document.getElementById('wppNotifPanel').remove()" style="padding:12px 16px;border-bottom:1px solid #f0f0f0;cursor:pointer;display:flex;gap:12px;align-items:flex-start;transition:background .1s" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
          <div style="width:36px;height:36px;border-radius:50%;background:${n.color}20;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="bi ${n.icon}" style="color:${n.color};font-size:16px"></i>
          </div>
          <div style="min-width:0;flex:1">
            <div style="font-size:13px;font-weight:600;color:#111b21;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(n.title)}</div>
            <div style="font-size:12px;color:#667781;margin-top:2px">${_esc(n.body)}</div>
          </div>
        </div>
      `).join('')}</div>`;

  panel.innerHTML = header + body;
  document.body.appendChild(panel);

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!panel.contains(e.target) && e.target.id !== 'wppBellBtn') {
        panel.remove();
        document.removeEventListener('click', handler);
      }
    });
  }, 50);
}

function _wppSelectLeadById(leadId) {
  _wppSwitchSidebar('leads');
  WPP.selectedLeadId = leadId;
  _wppRenderLeadList();
}

/* ─────────────────────────────────────────────
   CSS INJETADO
───────────────────────────────────────────── */
function _comInjectTabStyles() {
  if (document.getElementById('comTabStyles')) return;
  const s = document.createElement('style');
  s.id = 'comTabStyles';
  s.textContent = `
    .com-tab {
      background: none; border: none; border-bottom: 3px solid transparent;
      padding: 12px 20px; font-size: 13px; font-weight: 700; cursor: pointer;
      color: var(--muted); display: flex; align-items: center; gap: 6px;
      transition: color .15s, border-color .15s; white-space: nowrap;
    }
    .com-tab:hover { color: var(--primary); }
    .com-tab-active { color: var(--primary) !important; border-bottom-color: var(--primary) !important; }
  `;
  document.head.appendChild(s);
}

function _wppInjectStyles() {
  if (document.getElementById('wppStyles')) return;
  const s = document.createElement('style');
  s.id = 'wppStyles';
  s.textContent = `
    .wpp-chat-item {
      display: flex; align-items: center;
      padding: 12px 16px; cursor: pointer;
      border-bottom: 1px solid #f0f2f5;
      transition: background .1s;
    }
    .wpp-chat-item:hover   { background: #f5f6f6; }
    .wpp-chat-active       { background: #f0f2f5; }
    .wpp-icon-btn {
      width: 36px; height: 36px; border-radius: 50%;
      border: none; background: transparent; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: #54656f; font-size: 18px; transition: background .15s;
    }
    .wpp-icon-btn:hover { background: rgba(0,0,0,0.08); }
    #wppMsgs::-webkit-scrollbar         { width: 6px; }
    #wppMsgs::-webkit-scrollbar-thumb   { background: rgba(0,0,0,0.15); border-radius: 3px; }
    #wppChatList::-webkit-scrollbar       { width: 4px; }
    #wppChatList::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }
    #wppInput::-webkit-scrollbar { display: none; }
    #wppLeadList::-webkit-scrollbar       { width: 4px; }
    #wppLeadList::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }
    .wpp-sidebar-tab {
      flex: 1; border: none; border-bottom: 2px solid transparent;
      background: white; padding: 10px 8px; font-size: 12px; font-weight: 700;
      cursor: pointer; color: #667781; display: flex; align-items: center;
      justify-content: center; gap: 5px; transition: color .15s, border-color .15s;
    }
    .wpp-sidebar-tab:hover { color: var(--primary); }
    .wpp-sidebar-tab-active { color: var(--primary) !important; border-bottom-color: var(--primary) !important; }
    @keyframes wpp-blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
    @keyframes wpp-wave  { from{transform:scaleY(0.4)} to{transform:scaleY(1.4)} }
    @keyframes spin       { to{transform:rotate(360deg)} }
    #wppSendBtn:not([disabled]):hover { opacity:1 !important; }
    #wppMicBtn.recording { background:#ef4444 !important; }
  `;
  document.head.appendChild(s);
}
