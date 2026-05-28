/* =====================================================================
   EMAIL — Gmail integrado ao Gênesis
   Usa o mesmo token OAuth de google-auth.js (gauthGetToken)
   ===================================================================== */

const EM = {
  threads:       [],   // lista de threads
  currentThread: null, // thread aberta
  filter:        '',   // busca
  leadFilter:    null, // { email } — filtra threads por lead
  loading:       false,
};

/* ─────────────────────────────────────────────
   INIT — chamado ao navegar para a aba E-mail
───────────────────────────────────────────── */
function initEmail(container) {
  if (!container) return;
  _emInjectStyles();
  container.innerHTML = _emRender();
  _emLoadThreads();
}

/* Abre o Gmail já filtrado pelo e-mail de um lead */
function emailAbrirLead(leadEmail) {
  EM.leadFilter = leadEmail ? { email: leadEmail } : null;
  EM.threads    = [];
  const el = document.getElementById('emRoot');
  if (el) { el.innerHTML = _emRender(); _emLoadThreads(); }
}

/* ─────────────────────────────────────────────
   RENDER — estrutura principal
───────────────────────────────────────────── */
function _emRender() {
  if (!gauthIsConnected()) {
    return `
      <div style="flex:1;display:flex;align-items:center;justify-content:center;background:#f6f8fc">
        <div style="text-align:center;max-width:360px;padding:40px">
          <div style="font-size:56px;margin-bottom:16px">📧</div>
          <div style="font-size:20px;font-weight:800;color:var(--primary);margin-bottom:8px">Conectar Gmail</div>
          <div style="font-size:13px;color:var(--muted);margin-bottom:24px;line-height:1.6">
            Clique em <strong>Conectar Google</strong> na barra superior para vincular
            sua conta Google. Agenda, Drive, Gmail e Meet serão conectados de uma só vez.
          </div>
          <div style="background:#f0f4ff;border-radius:10px;padding:12px 16px;font-size:12px;color:var(--primary)">
            <i class="bi bi-shield-lock-fill"></i>
            O acesso é seguro via OAuth 2.0. Suas credenciais nunca são armazenadas.
          </div>
        </div>
      </div>`;
  }

  return `
    <div id="emRoot" style="display:flex;flex:1;overflow:hidden">
      <!-- SIDEBAR: lista de threads -->
      <div style="width:360px;flex-shrink:0;display:flex;flex-direction:column;background:white;border-right:1px solid #e0e0e0">

        <!-- Header -->
        <div style="padding:14px 16px;background:#f6f8fc;border-bottom:1px solid #e0e0e0">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-size:15px;font-weight:800;color:var(--primary)">
              <i class="bi bi-envelope-fill" style="color:#ea4335"></i>
              ${EM.leadFilter ? `E-mails de ${_esc(EM.leadFilter.email)}` : 'Caixa de entrada'}
            </div>
            ${EM.leadFilter
              ? `<button class="btn btn-ghost btn-sm" onclick="emailAbrirLead(null)" title="Ver todos">
                   <i class="bi bi-x-lg"></i>
                 </button>`
              : `<button class="btn btn-primary btn-sm" onclick="_emComporNovo()" title="Novo e-mail">
                   <i class="bi bi-pencil-square"></i> Novo
                 </button>`}
          </div>
          <!-- Busca -->
          <div style="position:relative">
            <i class="bi bi-search" style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:#9aa0a6;font-size:13px"></i>
            <input
              style="width:100%;padding:7px 10px 7px 30px;border:1px solid #e0e0e0;border-radius:20px;font-size:13px;outline:none;background:white"
              placeholder="Buscar e-mails..."
              oninput="EM.filter=this.value;_emLoadThreads()"
              value="${_esc(EM.filter)}"
            />
          </div>
        </div>

        <!-- Lista -->
        <div id="emThreadList" style="flex:1;overflow-y:auto">
          ${EM.loading ? _emSpinner() : _emRenderThreadList()}
        </div>
      </div>

      <!-- MAIN: thread aberta -->
      <div id="emMain" style="flex:1;display:flex;flex-direction:column;background:#f6f8fc;overflow:hidden">
        ${EM.currentThread ? _emRenderThreadDetail() : _emRenderEmpty()}
      </div>
    </div>`;
}

/* ─────────────────────────────────────────────
   LISTA DE THREADS
───────────────────────────────────────────── */
async function _emLoadThreads() {
  if (!gauthIsConnected()) return;
  EM.loading = true;
  const listEl = document.getElementById('emThreadList');
  if (listEl) listEl.innerHTML = _emSpinner();

  let q = 'in:inbox';
  if (EM.filter)            q += ` ${EM.filter}`;
  if (EM.leadFilter?.email) q = `from:${EM.leadFilter.email} OR to:${EM.leadFilter.email}`;

  const threads = await gmailListThreads({ q, maxResults: 40 });
  EM.threads = [];

  // Busca snippet/assunto de cada thread (limitado para não fazer muitas chamadas)
  const preview = await Promise.all(
    threads.slice(0, 40).map(t => _emGetThreadPreview(t.id))
  );
  EM.threads  = preview.filter(Boolean);
  EM.loading  = false;

  if (listEl) listEl.innerHTML = _emRenderThreadList();
}

async function _emGetThreadPreview(threadId) {
  try {
    const r = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${gauthGetToken()}` } }
    );
    if (!r.ok) return null;
    const t = await r.json();
    const last = t.messages?.[t.messages.length - 1];
    if (!last) return null;
    return {
      id:        t.id,
      snippet:   t.snippet || '',
      msgCount:  t.messages.length,
      unread:    (last.labelIds || []).includes('UNREAD'),
      from:      gmailHeader(last, 'From'),
      subject:   gmailHeader(last, 'Subject'),
      date:      gmailHeader(last, 'Date'),
      timestamp: parseInt(last.internalDate || '0', 10),
    };
  } catch { return null; }
}

function _emRenderThreadList() {
  if (!EM.threads.length) {
    return `<div style="padding:40px 16px;text-align:center;color:#9aa0a6;font-size:13px">
      ${EM.filter ? 'Nenhum resultado' : 'Caixa de entrada vazia'}
    </div>`;
  }
  return EM.threads.map(t => {
    const from    = _emParseName(t.from);
    const isActive= t.id === EM.currentThread?.id;
    const lead    = _emFindLead(t.from);
    return `
      <div onclick="_emOpenThread('${t.id}')"
        style="padding:12px 16px;border-bottom:1px solid #f1f3f4;cursor:pointer;background:${isActive?'#e8f0fe':t.unread?'white':'#fafafa'};transition:background .1s"
        onmouseover="this.style.background='${isActive?'#e8f0fe':'#f1f3f4'}'"
        onmouseout="this.style.background='${isActive?'#e8f0fe':t.unread?'white':'#fafafa'}'">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
          <div style="font-size:14px;font-weight:${t.unread?800:500};color:${t.unread?'#202124':'#5f6368'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px">
            ${_esc(from)}
            ${lead?`<span style="font-size:9px;background:#dcfce7;color:#15803d;padding:1px 5px;border-radius:4px;margin-left:4px">Lead</span>`:''}
          </div>
          <div style="font-size:11px;color:#5f6368;flex-shrink:0">${_emFormatDate(t.timestamp)}</div>
        </div>
        <div style="font-size:13px;font-weight:${t.unread?700:400};color:#202124;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${_esc(t.subject||'(sem assunto)')}
          ${t.msgCount>1?`<span style="color:#5f6368;font-size:11px"> (${t.msgCount})</span>`:''}
        </div>
        <div style="font-size:12px;color:#5f6368;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${_esc(t.snippet||'')}
        </div>
      </div>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   THREAD DETAIL
───────────────────────────────────────────── */
async function _emOpenThread(threadId) {
  const mainEl = document.getElementById('emMain');
  if (mainEl) mainEl.innerHTML = _emSpinner('Carregando conversa...');

  const thread = await gmailGetThread(threadId);
  if (!thread) { if (mainEl) mainEl.innerHTML = `<div style="padding:40px;color:#9aa0a6">Erro ao carregar conversa.</div>`; return; }

  EM.currentThread = thread;

  // Atualiza lista (marca como lido visualmente)
  const t = EM.threads.find(x => x.id === threadId);
  if (t) { t.unread = false; }
  const listEl = document.getElementById('emThreadList');
  if (listEl) listEl.innerHTML = _emRenderThreadList();

  // Marca todas as mensagens não lidas como lidas
  for (const msg of thread.messages || []) {
    if ((msg.labelIds||[]).includes('UNREAD')) gmailMarkRead(msg.id);
  }

  if (mainEl) mainEl.innerHTML = _emRenderThreadDetail();
}

function _emRenderThreadDetail() {
  const t     = EM.currentThread;
  if (!t) return _emRenderEmpty();
  const msgs  = t.messages || [];
  const last  = msgs[msgs.length - 1];
  const subj  = gmailHeader(last, 'Subject') || '(sem assunto)';
  const lead  = _emFindLead(gmailHeader(msgs[0], 'From') + ' ' + gmailHeader(msgs[0], 'To'));

  return `
    <!-- Cabeçalho da thread -->
    <div style="padding:16px 24px;background:white;border-bottom:1px solid #e0e0e0;flex-shrink:0">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div>
          <div style="font-size:20px;font-weight:700;color:#202124;margin-bottom:4px">${_esc(subj)}</div>
          ${lead?`<span style="font-size:11px;background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:8px;font-weight:700">
            <i class="bi bi-person-fill"></i> Lead: ${_esc(lead.nome)}
          </span>`:''}
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          ${lead?`<button class="btn btn-ghost btn-sm" onclick="navigate('clientes',document.querySelector('[data-page=clientes]'));setTimeout(()=>typeof _clOpenPerfil==='function'&&_clOpenPerfil(${lead.id}),300)" title="Ver perfil do lead"><i class="bi bi-person-lines-fill"></i> Perfil</button>`:''}
          ${lead?`<button class="btn btn-ghost btn-sm" style="color:#f59e0b" onclick="_emSalvarTrecho(${lead.id},'${_esc(lead.nome)}')" title="Salvar trecho selecionado no perfil do lead"><i class="bi bi-bookmark-plus-fill"></i> Salvar</button>`:''}
          <button class="btn btn-outline btn-sm" onclick="_emResponder('${t.id}')" style="color:#1a73e8;border-color:#1a73e8">
            <i class="bi bi-reply-fill"></i> Responder
          </button>
        </div>
      </div>
    </div>

    <!-- Mensagens da thread -->
    <div style="flex:1;overflow-y:auto;padding:16px 24px;display:flex;flex-direction:column;gap:12px">
      ${msgs.map((msg, i) => _emRenderMessage(msg, i === msgs.length - 1)).join('')}
    </div>

    <!-- Resposta rápida -->
    <div id="emReplyArea" style="display:none;padding:12px 24px;background:white;border-top:1px solid #e0e0e0">
      ${_emReplyHtml(t.id, gmailHeader(last, 'From'), subj)}
    </div>
  `;
}

function _emRenderMessage(msg, isLast) {
  const from    = gmailHeader(msg, 'From');
  const to      = gmailHeader(msg, 'To');
  const date    = gmailHeader(msg, 'Date');
  const body    = gmailDecodeBody(msg);
  const isHtml  = msg.payload?.parts?.some(p=>p.mimeType==='text/html') ||
                  msg.payload?.mimeType === 'text/html';
  const unread  = (msg.labelIds||[]).includes('UNREAD');
  const name    = _emParseName(from);

  return `
    <div style="background:white;border-radius:12px;border:1px solid #e0e0e0;overflow:hidden${!isLast&&!unread?';opacity:0.85':''}">
      <!-- Header da mensagem -->
      <div style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;background:${isLast?'white':'#fafafa'}"
           onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:50%;background:${_emAvatarColor(name)};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:white;flex-shrink:0">
            ${name[0]?.toUpperCase()||'?'}
          </div>
          <div>
            <div style="font-size:13px;font-weight:${unread?700:600};color:#202124">${_esc(name)}</div>
            <div style="font-size:11px;color:#5f6368">para ${_esc(to)}</div>
          </div>
        </div>
        <div style="font-size:11px;color:#5f6368">${_emFormatDateFull(date)}</div>
      </div>
      <!-- Corpo -->
      <div style="padding:12px 16px;border-top:1px solid #f1f3f4;display:${isLast?'block':'none'}">
        ${isHtml
          ? `<iframe srcdoc="${_esc(body)}" style="width:100%;min-height:200px;border:none" onload="this.style.height=this.contentDocument.body.scrollHeight+32+'px'"></iframe>`
          : `<div style="font-size:14px;color:#202124;white-space:pre-wrap;line-height:1.6;word-break:break-word">${_esc(body)}</div>`}
      </div>
    </div>`;
}

/* ─────────────────────────────────────────────
   COMPOR / RESPONDER
───────────────────────────────────────────── */
function _emResponder(threadId) {
  const area = document.getElementById('emReplyArea');
  if (area) {
    area.style.display = area.style.display === 'none' ? 'block' : 'none';
    setTimeout(() => document.getElementById('emReplyBody')?.focus(), 50);
  }
}

function _emReplyHtml(threadId, toRaw, subject) {
  const replyTo = toRaw;
  const reSubj  = subject?.startsWith('Re:') ? subject : `Re: ${subject}`;
  const last    = EM.currentThread?.messages?.slice(-1)[0];
  return `
    <div style="border:1px solid #e0e0e0;border-radius:10px;overflow:hidden">
      <div style="padding:8px 14px;background:#f6f8fc;border-bottom:1px solid #e0e0e0;font-size:12px;color:#5f6368">
        Para: <strong>${_esc(replyTo)}</strong> · Assunto: <strong>${_esc(reSubj)}</strong>
      </div>
      <textarea id="emReplyBody"
        style="width:100%;padding:12px 14px;border:none;outline:none;font-size:14px;min-height:80px;resize:none;font-family:inherit;color:#202124"
        placeholder="Escreva sua resposta..."></textarea>
      <div style="padding:8px 14px;display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #f1f3f4">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('emReplyArea').style.display='none'">Cancelar</button>
        <button class="btn btn-primary btn-sm" style="background:#1a73e8" onclick="_emEnviarResposta('${threadId}','${_esc(replyTo)}','${_esc(reSubj)}','${last?.id||''}')">
          <i class="bi bi-send-fill"></i> Enviar
        </button>
      </div>
    </div>`;
}

async function _emEnviarResposta(threadId, to, subject, replyToMsgId) {
  const body = document.getElementById('emReplyBody')?.value?.trim();
  if (!body) return;

  const btn = document.querySelector('#emReplyArea .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  const sent = await gmailSend({ to, subject, body, replyToMessageId: replyToMsgId, threadId });

  if (sent) {
    document.getElementById('emReplyArea').style.display = 'none';
    _emToast('E-mail enviado!', 'success');
    // Recarrega a thread para mostrar a resposta
    setTimeout(() => _emOpenThread(threadId), 1000);
  } else {
    _emToast('Erro ao enviar e-mail', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar'; }
  }
}

function _emComporNovo() {
  _emShowModal(`
    <div style="font-size:16px;font-weight:800;color:var(--primary);margin-bottom:16px"><i class="bi bi-pencil-square" style="color:#1a73e8"></i> Novo E-mail</div>
    <div class="form-group">
      <label class="form-label">Para</label>
      <input class="form-input" id="emTo" type="email" placeholder="destinatario@email.com" />
    </div>
    <div class="form-group">
      <label class="form-label">Assunto</label>
      <input class="form-input" id="emSubject" placeholder="Assunto do e-mail" />
    </div>
    <div class="form-group">
      <label class="form-label">Mensagem</label>
      <textarea class="form-textarea" id="emBody" style="min-height:120px" placeholder="Escreva sua mensagem..."></textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="document.querySelector('.em-modal')?.remove()">Cancelar</button>
      <button class="btn btn-primary" style="background:#1a73e8" onclick="_emEnviarNovo()"><i class="bi bi-send-fill"></i> Enviar</button>
    </div>
  `);
}

async function _emEnviarNovo() {
  const to      = document.getElementById('emTo')?.value?.trim();
  const subject = document.getElementById('emSubject')?.value?.trim();
  const body    = document.getElementById('emBody')?.value?.trim();
  if (!to || !body) { _emToast('Preencha destinatário e mensagem', 'error'); return; }

  const btn = document.querySelector('.em-modal .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  const sent = await gmailSend({ to, subject: subject || '(sem assunto)', body });
  document.querySelector('.em-modal')?.remove();
  if (sent) { _emToast('E-mail enviado!', 'success'); _emLoadThreads(); }
  else _emToast('Erro ao enviar', 'error');
}

/* ─────────────────────────────────────────────
   INTEGRAÇÃO CRM — perfil do lead
───────────────────────────────────────────── */
function _emFindLead(emailStr) {
  const leads = storeGet ? storeGet() : [];
  const addr  = (emailStr.match(/<(.+?)>|(\S+@\S+)/)?.[1] || emailStr.match(/<(.+?)>|(\S+@\S+)/)?.[2] || '').toLowerCase();
  if (!addr) return null;
  return leads.find(l => l.email?.toLowerCase() === addr) || null;
}

/* Renderiza widget de e-mails no perfil do lead — chamado por clientes.js */
async function emailPerfilWidget(leadEmail, container) {
  if (!container) return;
  if (!gauthIsConnected()) {
    container.innerHTML = `<div style="font-size:12px;color:var(--muted)">Conecte o Google na barra superior para ver e-mails.</div>`;
    return;
  }
  container.innerHTML = _emSpinner('Carregando e-mails...');
  const threads = await gmailListThreads({ q: `from:${leadEmail} OR to:${leadEmail}`, maxResults: 5 });
  if (!threads.length) {
    container.innerHTML = `<div style="font-size:12px;color:var(--muted)">Nenhum e-mail encontrado.</div>`;
    return;
  }
  const previews = await Promise.all(threads.map(t => _emGetThreadPreview(t.id)));
  container.innerHTML = previews.filter(Boolean).map(t => `
    <div style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="navigate('comunicacao',document.querySelector('[data-page=comunicacao]'));setTimeout(()=>{if(typeof _wppSetTabEmail==='function')_wppSetTabEmail();emailAbrirLead('${_esc(leadEmail)}')},300)">
      <div style="font-size:12px;font-weight:${t.unread?700:600};color:var(--primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(t.subject||'(sem assunto)')}</div>
      <div style="font-size:11px;color:var(--muted)">${_emFormatDate(t.timestamp)} · ${_esc(_emParseName(t.from))}</div>
    </div>`).join('') +
    `<button class="btn btn-ghost btn-sm" style="margin-top:6px;font-size:11px" onclick="navigate('comunicacao',document.querySelector('[data-page=comunicacao]'));setTimeout(()=>emailAbrirLead('${_esc(leadEmail)}'),300)">
      Ver todos →
    </button>`;
}

/* ─────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────── */
function _emParseName(from) {
  if (!from) return '?';
  const m = from.match(/^"?([^"<]+)"?\s*</);
  return m ? m[1].trim() : from.replace(/<.+>/, '').trim() || from;
}

function _emFormatDate(ts) {
  if (!ts) return '';
  const d    = new Date(ts);
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString())
    return d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
}

function _emFormatDateFull(dateStr) {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }); }
  catch { return dateStr; }
}

const _EM_COLORS = ['#d32f2f','#1976d2','#388e3c','#f57c00','#7b1fa2','#00796b','#c2185b','#5d4037'];
function _emAvatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name||'').length; i++) h = (h*31 + name.charCodeAt(i)) & 0xffffffff;
  return _EM_COLORS[Math.abs(h) % _EM_COLORS.length];
}

function _emRenderEmpty() {
  return `<div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:#5f6368">
    <i class="bi bi-envelope-open" style="font-size:48px;opacity:0.3"></i>
    <div style="font-size:15px;font-weight:300">Selecione uma conversa</div>
  </div>`;
}

function _emSpinner(msg = '') {
  return `<div style="padding:40px;text-align:center;color:#9aa0a6">
    <div style="width:24px;height:24px;border:3px solid #1a73e8;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 10px"></div>
    ${msg ? `<div style="font-size:13px">${msg}</div>` : ''}
  </div>`;
}

/* ─────────────────────────────────────────────
   SALVAR TRECHO DO E-MAIL NO PERFIL DO LEAD
───────────────────────────────────────────── */
function _emSalvarTrecho(leadId, leadNome) {
  const sel = window.getSelection()?.toString().trim();

  if (sel) {
    _emConfirmarSalvarTrecho(leadId, leadNome, sel);
    return;
  }

  // Mostra modal para digitar o trecho
  window._emTrechoLeadId   = leadId;
  window._emTrechoLeadNome = leadNome;

  const existing = document.getElementById('emTrechoModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'emTrechoModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:5000;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:white;border-radius:14px;padding:24px;width:100%;max-width:420px">
      <div style="font-size:15px;font-weight:800;color:var(--primary,#0d1f3c);margin-bottom:10px"><i class="bi bi-bookmark-plus-fill" style="color:#f59e0b"></i> Salvar trecho do e-mail</div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:12px">Selecione texto no e-mail e clique novamente, <strong>ou</strong> escreva abaixo:</div>
      <textarea id="emTrechoTexto" style="width:100%;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font-size:13px;resize:none;min-height:80px;outline:none;font-family:inherit;box-sizing:border-box" placeholder="Cole ou escreva o trecho importante..."></textarea>
      <div style="font-size:11px;color:#16a34a;margin-top:6px"><i class="bi bi-person-check-fill"></i> Será salvo no perfil de <strong>${(leadNome||'').replace(/</g,'&lt;')}</strong></div>
      <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">
        <button style="padding:6px 14px;border:1px solid #d1d5db;border-radius:7px;background:white;cursor:pointer;font-size:13px" onclick="document.getElementById('emTrechoModal').remove()">Cancelar</button>
        <button style="padding:6px 14px;border:none;border-radius:7px;background:#0d1f3c;color:white;cursor:pointer;font-size:13px;font-weight:700" onclick="_emConfirmarSalvarTrecho(window._emTrechoLeadId,window._emTrechoLeadNome,document.getElementById('emTrechoTexto').value)">Salvar</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('emTrechoTexto')?.focus(), 50);
}

function _emConfirmarSalvarTrecho(leadId, leadNome, texto) {
  document.getElementById('emTrechoModal')?.remove();
  if (!texto?.trim()) return;

  const trecho = texto.trim().slice(0, 1000);
  const nota   = `[E-mail] ${trecho}`;

  if (typeof leadAddNota === 'function') leadAddNota(leadId, nota);
  if (typeof leadAddHistorico === 'function') leadAddHistorico(leadId, `Trecho de e-mail salvo: "${trecho.slice(0,60)}${trecho.length>60?'...':''}"`);

  // Toast simples
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#16a34a;color:white;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.2)';
  t.textContent = `Trecho salvo no perfil de ${leadNome}!`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function _emToast(msg, tipo = 'info') {
  const colors = { info:'#1f2937', success:'#16a34a', error:'#ef4444' };
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${colors[tipo]||colors.info};color:white;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function _emShowModal(html) {
  document.querySelectorAll('.em-modal').forEach(e=>e.remove());
  const div = document.createElement('div');
  div.className = 'em-modal';
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:3000;display:flex;align-items:center;justify-content:center';
  div.innerHTML = `<div style="background:white;border-radius:14px;padding:24px;width:100%;max-width:480px">${html}</div>`;
  div.addEventListener('click', e => { if (e.target===div) div.remove(); });
  document.body.appendChild(div);
}

function _emInjectStyles() {
  if (document.getElementById('emStyles')) return;
  const s = document.createElement('style');
  s.id = 'emStyles';
  s.textContent = `
    #emThreadList::-webkit-scrollbar       { width:5px; }
    #emThreadList::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.12); border-radius:3px; }
  `;
  document.head.appendChild(s);
}
