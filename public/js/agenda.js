/* =====================================================================
   AGENDA — Google Calendar + Reuniões Locais
   ===================================================================== */
const RN_KEY = 'crm_reunioes';

function rnGet()        { return JSON.parse(localStorage.getItem(RN_KEY) || '[]'); }
function rnSet(arr)     { localStorage.setItem(RN_KEY, JSON.stringify(arr)); }
function rnNextId()     { const a = rnGet(); return a.length ? a.reduce((m,x)=>x.id>m?x.id:m,0)+1 : 1; }

function rnCreate(data) {
  const arr = rnGet();
  const novo = {
    id:        rnNextId(),
    titulo:    data.titulo || '',
    tipo:      data.tipo || 'online',
    local:     data.local || '',
    meetLink:  data.meetLink || '',
    googleEventId: data.googleEventId || '',
    data:      data.data || '',
    hora:      data.hora || '',
    duracao:   data.duracao || 60,
    leadId:    data.leadId || null,
    leadNome:  data.leadNome || '',
    status:    'agendada',
    notas:     data.notas || '',
    criadoEm:  new Date().toISOString(),
  };
  arr.push(novo);
  rnSet(arr);
  _rnIncrMeta();
  return novo;
}

function rnUpdate(id, patch) {
  const arr = rnGet();
  const i = arr.findIndex(r => r.id === id);
  if (i === -1) return null;
  Object.assign(arr[i], patch);
  rnSet(arr);
  return arr[i];
}

function rnDelete(id) { rnSet(rnGet().filter(r => r.id !== id)); }

function _rnIncrMeta() {
  const METAS_DEFAULT = { prospeccao:400, leads:300, reunAgend:150, reunMes:110, reunDia:20, vendas:20 };
  const m = JSON.parse(localStorage.getItem('crm_metas') || 'null') || METAS_DEFAULT;
  // metas armazena metas (alvo), não actuals — actuals derivam dos dados
  // mas para contagem de hoje, armazenamos em crm_reunioes_count
  const c = JSON.parse(localStorage.getItem('crm_reunioes_count') || '{"total":0,"mes":0,"hoje":0,"ts":""}');
  const hoje = new Date().toDateString();
  const mes  = new Date().toISOString().slice(0,7);
  if (c.tsHoje !== hoje)  { c.hoje = 0; c.tsHoje = hoje; }
  if (c.tsMes  !== mes)   { c.mes  = 0; c.tsMes  = mes;  }
  c.total++; c.mes++; c.hoje++;
  localStorage.setItem('crm_reunioes_count', JSON.stringify(c));
}

/* ── VIEW STATE ── */
const AG = {
  view:        'lista', // lista | semana | mes | dia
  semanaOffset: 0,      // semanas relativas a hoje
  mesOffset:    0,
  diaOffset:    0,
  gcEvents:     [],     // Google Calendar events carregados
  gcLoading:    false,
  modalOpen:    false,
  editId:       null,
  prefillLead:  null,   // { id, nome } — vem do perfil do cliente
};

/* ── INIT ── */
function initAgenda() {
  const el = document.getElementById('page-agenda');
  if (!el) return;
  el.innerHTML = _agRender();
  _agBindEvents();
  _agLoadGcEvents();
}

function _agMetaBar() {
  const MT_DEF = { reunAgend:150, reunMes:110, reunDia:20 };
  const metas  = JSON.parse(localStorage.getItem('crm_metas') || 'null') || MT_DEF;
  const hoje   = new Date().toISOString().slice(0,10);
  const mes    = hoje.slice(0,7);
  const all    = rnGet();
  const doMes  = all.filter(r => (r.data||'').startsWith(mes));
  const deHoje = all.filter(r => r.data === hoje);
  const realizadas = doMes.filter(r => r.status === 'realizada');

  const bar = (val, meta, color, label) => {
    const pct = meta > 0 ? Math.min(Math.round(val/meta*100), 100) : 0;
    const clr = pct >= 100 ? '#16a34a' : pct >= 60 ? '#d97706' : color;
    return `<div style="display:flex;align-items:center;gap:8px;min-width:140px">
      <span style="font-size:11px;color:var(--muted);white-space:nowrap">${label}</span>
      <div style="flex:1;height:6px;background:#f1f5f9;border-radius:3px;min-width:60px">
        <div style="height:100%;width:${pct}%;background:${clr};border-radius:3px;transition:width .4s"></div>
      </div>
      <span style="font-size:11px;font-weight:800;color:${clr};white-space:nowrap">${val}/${meta}</span>
    </div>`;
  };

  return `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 14px">
    <span style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;flex-shrink:0"><i class="bi bi-bullseye" style="color:var(--accent)"></i> Metas</span>
    ${bar(deHoje.length,         metas.reunDia,  '#0891b2', 'Hoje')}
    ${bar(doMes.length,          metas.reunAgend,'#d97706', 'Agendadas/mês')}
    ${bar(realizadas.length,     metas.reunMes,  '#16a34a', 'Realizadas/mês')}
    <a onclick="navigate('metas',document.querySelector('[data-page=metas]'))" style="font-size:11px;color:var(--primary);cursor:pointer;font-weight:700;white-space:nowrap;margin-left:auto">Ver Metas →</a>
  </div>`;
}

function _agRender() {
  const connected = gauthIsConnected();
  return `
    <div class="page-header">
      <div>
        <div class="page-title">Agenda</div>
        <div class="page-subtitle">Reuniões, follow-ups e compromissos</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${connected
          ? `<span style="font-size:12px;color:#16a34a;font-weight:700"><i class="bi bi-google"></i> Google conectado</span>
             <button class="btn btn-ghost btn-sm" onclick="_agDisconnectGoogle()"><i class="bi bi-box-arrow-right"></i> Desconectar</button>`
          : `<button class="btn btn-outline btn-sm" onclick="_agConnectGoogle()"><i class="bi bi-google"></i> Conectar Google</button>`}
        <button class="btn btn-primary" onclick="_agOpenModal()"><i class="bi bi-plus-lg"></i> Nova Reunião</button>
      </div>
    </div>
    <div id="ag-meta-bar">${_agMetaBar()}</div>

    <!-- Abas de visualização -->
    <div style="display:flex;gap:0;margin-bottom:16px;border-bottom:2px solid var(--border)">
      ${['lista','semana','mes','dia'].map(v=>`
        <button class="ag-tab ${AG.view===v?'ag-tab-active':''}" onclick="_agSetView('${v}')" style="padding:8px 18px;font-size:13px;font-weight:700;background:none;border:none;border-bottom:${AG.view===v?'2px solid var(--primary)':'2px solid transparent'};color:${AG.view===v?'var(--primary)':'var(--muted)'};cursor:pointer;margin-bottom:-2px">
          ${{lista:'Lista',semana:'Semana',mes:'Mês',dia:'Dia'}[v]}
        </button>`).join('')}
    </div>

    <div id="ag-content">${_agRenderView()}</div>

    <!-- MODAL REUNIÃO -->
    <div class="modal-overlay" id="agModal" onclick="if(event.target===this)_agCloseModal()" style="display:none;align-items:center;justify-content:center">
      <div class="modal" style="max-width:480px">
        <div class="modal-header">
          <span class="modal-title" id="agModalTitle">Nova Reunião</span>
          <button class="modal-close" onclick="_agCloseModal()">✕</button>
        </div>
        <form id="agForm" onsubmit="event.preventDefault();_agSalvar()">
          <div class="form-group">
            <label class="form-label">Título *</label>
            <input class="form-input" id="agTitulo" placeholder="Ex: Apresentação de proposta" required />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tipo</label>
              <select class="form-select" id="agTipo" onchange="_agTipoChange()">
                <option value="online">Online (Google Meet)</option>
                <option value="presencial">Presencial</option>
              </select>
            </div>
            <div class="form-group" id="agLocalGrp">
              <label class="form-label">Local / Endereço</label>
              <input class="form-input" id="agLocal" placeholder="Rua, número, cidade" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Data *</label>
              <input class="form-input" id="agData" type="date" required />
            </div>
            <div class="form-group">
              <label class="form-label">Hora *</label>
              <input class="form-input" id="agHora" type="time" required />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Duração (minutos)</label>
            <select class="form-select" id="agDuracao">
              <option value="30">30 min</option>
              <option value="60" selected>1 hora</option>
              <option value="90">1h30</option>
              <option value="120">2 horas</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Cliente / Lead</label>
            <input class="form-input" id="agLeadNome" placeholder="Nome do cliente (opcional)" />
            <input type="hidden" id="agLeadId" />
          </div>
          <div class="form-group">
            <label class="form-label">Notas</label>
            <textarea class="form-textarea" id="agNotas" placeholder="Pauta, observações..."></textarea>
          </div>
          <div id="agGcInfo" style="background:#f0f4ff;border-radius:8px;padding:10px 12px;font-size:12px;color:var(--primary);margin-bottom:12px;display:none">
            <i class="bi bi-google"></i> Será criado no Google Calendar automaticamente.
            <span id="agGcMeetInfo"></span>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-ghost" onclick="_agCloseModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="agSubmitBtn">Salvar Reunião</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function _agRenderView() {
  if (AG.view === 'lista')   return _agRenderLista();
  if (AG.view === 'semana')  return _agRenderSemana();
  if (AG.view === 'mes')     return _agRenderMes();
  if (AG.view === 'dia')     return _agRenderDia();
  return '';
}

/* ── LISTA ── */
function _agRenderLista() {
  const reunioes = rnGet().sort((a,b) => (a.data+a.hora).localeCompare(b.data+b.hora));
  const hoje     = new Date().toISOString().slice(0,10);
  const futuras  = reunioes.filter(r => r.data >= hoje && r.status !== 'cancelada');
  const passadas = reunioes.filter(r => r.data <  hoje || r.status === 'cancelada').slice(0,20);
  const gcList   = AG.gcEvents.filter(e => {
    const d = (e.start?.dateTime || e.start?.date || '').slice(0,10);
    return d >= hoje;
  });

  const renderCard = (r, gc=false) => {
    if (gc) {
      const dt = new Date(r.start?.dateTime || r.start?.date);
      const meet = r.conferenceData?.entryPoints?.find(e=>e.entryPointType==='video');
      return `
        <div class="card" style="margin-bottom:10px;border-left:4px solid #4285f4">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-weight:700;font-size:14px;color:var(--primary)">${_esc(r.summary||'Sem título')}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px">
                <i class="bi bi-google" style="color:#4285f4"></i> Google Calendar &nbsp;·&nbsp;
                ${dt.toLocaleDateString('pt-BR')} às ${dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
              </div>
            </div>
            <span style="font-size:10px;background:#e8f0fe;color:#1a73e8;padding:3px 8px;border-radius:10px;font-weight:700">Google</span>
          </div>
          ${meet ? `<a href="${meet.uri}" target="_blank" class="btn btn-outline btn-sm" style="margin-top:8px;color:#1a73e8;border-color:#1a73e8"><i class="bi bi-camera-video-fill"></i> Entrar no Meet</a>` : ''}
        </div>`;
    }
    const stColor = r.status==='realizada'?'#16a34a':r.status==='cancelada'?'#ef4444':'#d97706';
    const stLabel = r.status==='realizada'?'Realizada':r.status==='cancelada'?'Cancelada':'Agendada';
    const icoTipo = r.tipo==='online'?'bi-camera-video-fill':'bi-geo-alt-fill';
    const tipoColor = r.tipo==='online'?'#4285f4':'#16a34a';
    return `
      <div class="card" style="margin-bottom:10px;border-left:4px solid ${tipoColor}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div style="flex:1">
            <div style="font-weight:700;font-size:14px;color:var(--primary)">${_esc(r.titulo)}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:3px;display:flex;gap:12px;flex-wrap:wrap">
              <span><i class="bi bi-calendar3"></i> ${r.data ? new Date(r.data+'T00:00:00').toLocaleDateString('pt-BR') : '—'} às ${r.hora||'—'}</span>
              <span><i class="bi ${icoTipo}" style="color:${tipoColor}"></i> ${r.tipo==='online'?'Online':'Presencial'}</span>
              ${r.leadNome ? `<span><i class="bi bi-person-fill"></i> ${_esc(r.leadNome)}</span>` : ''}
              <span><i class="bi bi-clock"></i> ${r.duracao} min</span>
            </div>
            ${r.local ? `<div style="font-size:12px;color:var(--muted);margin-top:2px"><i class="bi bi-geo-alt"></i> ${_esc(r.local)}</div>` : ''}
            ${r.notas ? `<div style="font-size:12px;color:var(--muted);margin-top:4px">${_esc(r.notas)}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
            <span style="font-size:10px;background:${stColor}22;color:${stColor};padding:3px 8px;border-radius:10px;font-weight:700">${stLabel}</span>
            <div style="display:flex;gap:4px">
              ${r.meetLink ? `<a href="${r.meetLink}" target="_blank" class="btn btn-ghost btn-sm" style="color:#4285f4;padding:4px 8px" title="Entrar no Meet"><i class="bi bi-camera-video-fill"></i></a>` : ''}
              ${r.status==='agendada' ? `<button class="btn btn-ghost btn-sm" style="color:#16a34a;padding:4px 8px" onclick="_agMarcarRealizada(${r.id})" title="Marcar como realizada"><i class="bi bi-check-lg"></i></button>` : ''}
              <button class="btn btn-ghost btn-sm" style="padding:4px 8px" onclick="_agOpenModal(${r.id})" title="Editar"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-ghost btn-sm" style="color:#ef4444;padding:4px 8px" onclick="_agDeletar(${r.id})" title="Excluir"><i class="bi bi-trash"></i></button>
            </div>
          </div>
        </div>
      </div>`;
  };

  return `
    ${futuras.length===0 && gcList.length===0
      ? `<div class="card" style="text-align:center;padding:40px;color:var(--muted)"><i class="bi bi-calendar3" style="font-size:40px;opacity:0.3;display:block;margin-bottom:12px"></i>Nenhuma reunião agendada.<br><button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="_agOpenModal()">Agendar agora</button></div>`
      : `<div style="font-size:13px;font-weight:700;color:var(--primary);margin-bottom:12px">Próximas (${futuras.length + gcList.length})</div>
         ${gcList.map(e=>renderCard(e,true)).join('')}
         ${futuras.map(r=>renderCard(r)).join('')}`
    }
    ${passadas.length ? `
      <div style="font-size:13px;font-weight:700;color:var(--muted);margin:20px 0 12px">Histórico</div>
      ${passadas.map(r=>renderCard(r)).join('')}` : ''}
  `;
}

/* ── SEMANA ── */
function _agRenderSemana() {
  const hoje = new Date();
  const base  = new Date(hoje);
  base.setDate(hoje.getDate() - hoje.getDay() + AG.semanaOffset * 7);
  const dias  = Array.from({length:7}, (_,i) => { const d=new Date(base); d.setDate(base.getDate()+i); return d; });
  const reunioes = rnGet();

  const nav = `<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
    <button class="btn btn-ghost btn-sm" onclick="AG.semanaOffset--;_agRefresh()"><i class="bi bi-chevron-left"></i></button>
    <span style="font-weight:700;font-size:14px">${dias[0].toLocaleDateString('pt-BR',{day:'2-digit',month:'long'})} – ${dias[6].toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}</span>
    <button class="btn btn-ghost btn-sm" onclick="AG.semanaOffset++;_agRefresh()"><i class="bi bi-chevron-right"></i></button>
    <button class="btn btn-ghost btn-sm" onclick="AG.semanaOffset=0;_agRefresh()">Hoje</button>
  </div>`;

  const hojeStr = hoje.toISOString().slice(0,10);
  const cols = dias.map(d => {
    const ds = d.toISOString().slice(0,10);
    const rns = reunioes.filter(r => r.data===ds);
    const gcs = AG.gcEvents.filter(e=>(e.start?.dateTime||e.start?.date||'').slice(0,10)===ds);
    const isHoje = ds===hojeStr;
    return `
      <div style="flex:1;min-width:0;border:1px solid var(--border);border-radius:10px;padding:8px;background:${isHoje?'var(--primary-pale)':'white'}">
        <div style="font-size:11px;font-weight:800;color:${isHoje?'var(--primary)':'var(--muted)'};text-align:center;margin-bottom:6px">
          ${d.toLocaleDateString('pt-BR',{weekday:'short'}).toUpperCase()}<br>
          <span style="font-size:16px;font-weight:900;color:${isHoje?'var(--primary)':'var(--text)'}">${d.getDate()}</span>
        </div>
        ${gcs.map(e=>`<div style="background:#e8f0fe;border-radius:5px;padding:3px 6px;font-size:10px;margin-bottom:3px;color:#1a73e8;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(e.summary||'')}"><i class="bi bi-google"></i> ${_esc((e.summary||'').slice(0,18))}</div>`).join('')}
        ${rns.map(r=>`<div style="background:${r.tipo==='online'?'#dbeafe':'#dcfce7'};border-radius:5px;padding:3px 6px;font-size:10px;margin-bottom:3px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer" onclick="_agOpenModal(${r.id})" title="${_esc(r.titulo)}">${r.hora} ${_esc(r.titulo.slice(0,15))}</div>`).join('')}
        <button style="width:100%;border:1px dashed var(--border);background:none;border-radius:5px;padding:3px;font-size:10px;color:var(--muted);cursor:pointer;margin-top:4px" onclick="_agOpenModalData('${ds}')">+</button>
      </div>`;
  });

  return nav + `<div style="display:flex;gap:6px">${cols.join('')}</div>`;
}

/* ── MÊS ── */
function _agRenderMes() {
  const hoje = new Date();
  const ref  = new Date(hoje.getFullYear(), hoje.getMonth() + AG.mesOffset, 1);
  const ano  = ref.getFullYear();
  const mes  = ref.getMonth();
  const pDia = new Date(ano, mes, 1).getDay();
  const total= new Date(ano, mes+1, 0).getDate();
  const reunioes = rnGet();
  const hojeStr  = hoje.toISOString().slice(0,10);

  const nav = `<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
    <button class="btn btn-ghost btn-sm" onclick="AG.mesOffset--;_agRefresh()"><i class="bi bi-chevron-left"></i></button>
    <span style="font-weight:700;font-size:14px">${ref.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</span>
    <button class="btn btn-ghost btn-sm" onclick="AG.mesOffset++;_agRefresh()"><i class="bi bi-chevron-right"></i></button>
    <button class="btn btn-ghost btn-sm" onclick="AG.mesOffset=0;_agRefresh()">Hoje</button>
  </div>`;

  const semanas = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  let cells = semanas.map(s=>`<div style="text-align:center;font-size:11px;font-weight:800;color:var(--muted);padding:6px 0">${s}</div>`).join('');
  for (let i=0; i<pDia; i++) cells += `<div></div>`;
  for (let d=1; d<=total; d++) {
    const ds = `${ano}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const rns = reunioes.filter(r=>r.data===ds);
    const gcs = AG.gcEvents.filter(e=>(e.start?.dateTime||e.start?.date||'').slice(0,10)===ds);
    const isHoje = ds===hojeStr;
    cells += `
      <div style="border:1px solid var(--border);border-radius:8px;padding:4px;min-height:60px;background:${isHoje?'var(--primary-pale)':'white'};cursor:pointer" onclick="_agOpenModalData('${ds}')">
        <div style="font-size:11px;font-weight:${isHoje?900:600};color:${isHoje?'var(--primary)':'var(--text)'};margin-bottom:2px">${d}</div>
        ${gcs.slice(0,2).map(e=>`<div style="background:#e8f0fe;border-radius:3px;padding:1px 4px;font-size:9px;margin-bottom:1px;color:#1a73e8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc((e.summary||'').slice(0,12))}</div>`).join('')}
        ${rns.slice(0,2).map(r=>`<div style="background:${r.tipo==='online'?'#dbeafe':'#dcfce7'};border-radius:3px;padding:1px 4px;font-size:9px;margin-bottom:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(r.titulo.slice(0,12))}</div>`).join('')}
        ${(rns.length+gcs.length)>2?`<div style="font-size:9px;color:var(--muted)">+${rns.length+gcs.length-2}</div>`:''}
      </div>`;
  }

  return nav + `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">${cells}</div>`;
}

/* ── DIA ── */
function _agRenderDia() {
  const hoje  = new Date();
  const ref   = new Date(hoje);
  ref.setDate(hoje.getDate() + AG.diaOffset);
  const ds    = ref.toISOString().slice(0,10);
  const horas = Array.from({length:14}, (_,i)=>i+7); // 7h–20h
  const reunioes = rnGet().filter(r=>r.data===ds);
  const gcs = AG.gcEvents.filter(e=>(e.start?.dateTime||e.start?.date||'').slice(0,10)===ds);

  const nav = `<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
    <button class="btn btn-ghost btn-sm" onclick="AG.diaOffset--;_agRefresh()"><i class="bi bi-chevron-left"></i></button>
    <span style="font-weight:700;font-size:14px">${ref.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</span>
    <button class="btn btn-ghost btn-sm" onclick="AG.diaOffset++;_agRefresh()"><i class="bi bi-chevron-right"></i></button>
    <button class="btn btn-ghost btn-sm" onclick="AG.diaOffset=0;_agRefresh()">Hoje</button>
  </div>`;

  const rows = horas.map(h => {
    const hs = String(h).padStart(2,'0')+':00';
    const rns = reunioes.filter(r => r.hora && parseInt(r.hora)===h);
    const gcs2= gcs.filter(e => { const t=e.start?.dateTime; return t && new Date(t).getHours()===h; });
    return `
      <div style="display:flex;gap:10px;min-height:50px;border-bottom:1px solid var(--border);padding:4px 0">
        <div style="width:45px;flex-shrink:0;font-size:11px;color:var(--muted);font-weight:700;padding-top:2px">${hs}</div>
        <div style="flex:1;display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start">
          ${gcs2.map(e=>{const meet=e.conferenceData?.entryPoints?.find(ep=>ep.entryPointType==='video');return`<div style="background:#e8f0fe;border-left:3px solid #4285f4;border-radius:5px;padding:5px 10px;font-size:12px"><div style="font-weight:700;color:#1a73e8"><i class="bi bi-google"></i> ${_esc(e.summary||'Evento Google')}</div>${meet?`<a href="${meet.uri}" target="_blank" style="font-size:11px;color:#1a73e8">Entrar no Meet</a>`:''}</div>`;}).join('')}
          ${rns.map(r=>`<div style="background:${r.tipo==='online'?'#dbeafe':'#dcfce7'};border-left:3px solid ${r.tipo==='online'?'#3b82f6':'#16a34a'};border-radius:5px;padding:5px 10px;font-size:12px;cursor:pointer" onclick="_agOpenModal(${r.id})"><div style="font-weight:700">${_esc(r.titulo)}</div>${r.leadNome?`<div style="font-size:11px;color:var(--muted)">${_esc(r.leadNome)}</div>`:''}</div>`).join('')}
          ${rns.length===0&&gcs2.length===0?`<button style="border:1px dashed var(--border);background:none;border-radius:5px;padding:3px 10px;font-size:11px;color:var(--muted);cursor:pointer" onclick="_agOpenModalDataHora('${ds}','${hs}')">+ Adicionar</button>`:''}
        </div>
      </div>`;
  });

  return nav + `<div class="card">${rows.join('')}</div>`;
}

/* ── HELPERS UI ── */
function _agSetView(v) {
  AG.view = v;
  initAgenda();
}

function _agRefresh() {
  const mb = document.getElementById('ag-meta-bar');
  if (mb) mb.innerHTML = _agMetaBar();
  document.getElementById('ag-content').innerHTML = _agRenderView();
}

function _agBindEvents() {
  const agModal = document.getElementById('agModal');
  if (agModal) agModal.style.display = 'none';
  _agTipoChange();
}

function _agTipoChange() {
  const tipo = document.getElementById('agTipo')?.value;
  const grp  = document.getElementById('agLocalGrp');
  const gcInfo = document.getElementById('agGcInfo');
  const gcMeet = document.getElementById('agGcMeetInfo');
  if (!grp) return;
  grp.style.display = tipo==='presencial' ? '' : 'none';
  if (gcInfo) {
    const connected = gauthIsConnected();
    gcInfo.style.display = connected ? '' : 'none';
    if (gcMeet) gcMeet.textContent = tipo==='online' ? ' Um link do Google Meet será gerado.' : '';
  }
}

function _agOpenModal(id = null) {
  AG.editId = id;
  const modal = document.getElementById('agModal');
  if (!modal) { initAgenda(); return; }
  document.getElementById('agModalTitle').textContent = id ? 'Editar Reunião' : 'Nova Reunião';
  document.getElementById('agForm').reset();
  if (id) {
    const r = rnGet().find(x=>x.id===id);
    if (r) {
      document.getElementById('agTitulo').value  = r.titulo;
      document.getElementById('agTipo').value    = r.tipo;
      document.getElementById('agLocal').value   = r.local||'';
      document.getElementById('agData').value    = r.data;
      document.getElementById('agHora').value    = r.hora;
      document.getElementById('agDuracao').value = r.duracao;
      document.getElementById('agLeadNome').value= r.leadNome||'';
      document.getElementById('agLeadId').value  = r.leadId||'';
      document.getElementById('agNotas').value   = r.notas||'';
    }
  } else if (AG.prefillLead) {
    document.getElementById('agLeadNome').value = AG.prefillLead.nome;
    document.getElementById('agLeadId').value   = AG.prefillLead.id;
    AG.prefillLead = null;
  } else {
    const now = new Date();
    document.getElementById('agData').value = now.toISOString().slice(0,10);
    document.getElementById('agHora').value = now.toTimeString().slice(0,5);
  }
  _agTipoChange();
  modal.style.display = 'flex';
}

function _agOpenModalData(ds) {
  _agOpenModal();
  setTimeout(() => { const el=document.getElementById('agData'); if(el) el.value=ds; }, 50);
}

function _agOpenModalDataHora(ds, hs) {
  _agOpenModal();
  setTimeout(() => {
    const d=document.getElementById('agData'); if(d) d.value=ds;
    const h=document.getElementById('agHora'); if(h) h.value=hs;
  }, 50);
}

function _agCloseModal() {
  const modal = document.getElementById('agModal');
  if (modal) modal.style.display = 'none';
  AG.editId = null;
}

async function _agSalvar() {
  const titulo = document.getElementById('agTitulo').value.trim();
  if (!titulo) return;

  const tipo    = document.getElementById('agTipo').value;
  const local   = document.getElementById('agLocal').value.trim();
  const data    = document.getElementById('agData').value;
  const hora    = document.getElementById('agHora').value;
  const duracao = parseInt(document.getElementById('agDuracao').value)||60;
  const leadNome= document.getElementById('agLeadNome').value.trim();
  const leadId  = parseInt(document.getElementById('agLeadId').value)||null;
  const notas   = document.getElementById('agNotas').value.trim();

  const btn = document.getElementById('agSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  const patch = { titulo, tipo, local, data, hora, duracao, leadNome, leadId, notas };

  let meetLink = '';
  let googleEventId = '';

  if (gauthIsConnected()) {
    const start = new Date(`${data}T${hora}:00`);
    const end   = new Date(start.getTime() + duracao*60000);
    const gcEvent = {
      summary:     titulo,
      description: `${leadNome ? 'Cliente: '+leadNome+'\n' : ''}${notas}`,
      start:       { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' },
      end:         { dateTime: end.toISOString(),   timeZone: 'America/Sao_Paulo' },
      location:    tipo==='presencial' ? local : undefined,
    };
    if (tipo === 'online') {
      gcEvent.conferenceData = { createRequest: { requestId: `meet-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } };
    }
    const created = await calendarCreateEvent(gcEvent);
    if (created) {
      googleEventId = created.id;
      const ep = created.conferenceData?.entryPoints?.find(e=>e.entryPointType==='video');
      if (ep) meetLink = ep.uri;
    }
  }

  Object.assign(patch, { meetLink, googleEventId });

  if (AG.editId) {
    rnUpdate(AG.editId, patch);
  } else {
    const saved = rnCreate(patch);
    if (leadId) {
      leadAddHistorico(leadId, `Reunião agendada: "${titulo}" em ${new Date(data+'T00:00:00').toLocaleDateString('pt-BR')} às ${hora}`);
    }
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Salvar Reunião'; }
  _agCloseModal();
  _agRefresh();
  if (typeof mtSnapshotMes === 'function') mtSnapshotMes();
  if (typeof renderFunilPage === 'function') renderFunilPage();
}

function _agMarcarRealizada(id) {
  rnUpdate(id, { status: 'realizada' });
  if (typeof mtSnapshotMes === 'function') mtSnapshotMes();
  _agRefresh();
}

async function _agDeletar(id) {
  const r = rnGet().find(x=>x.id===id);
  if (!r || !confirm(`Excluir reunião "${r.titulo}"?`)) return;
  if (r.googleEventId && gauthIsConnected()) {
    await calendarDeleteEvent(r.googleEventId);
  }
  rnDelete(id);
  _agRefresh();
}

async function _agConnectGoogle() {
  await gauthSignIn();
  initAgenda();
  _agLoadGcEvents();
}

function _agDisconnectGoogle() {
  gauthRevoke();
  AG.gcEvents = [];
  initAgenda();
}

async function _agLoadGcEvents() {
  if (!gauthIsConnected()) return;
  AG.gcLoading = true;
  const now  = new Date();
  const min  = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const max  = new Date(now.getFullYear(), now.getMonth()+3, 1);
  const evts = await calendarListEvents(min, max);
  AG.gcEvents  = evts;
  AG.gcLoading = false;
  _agRefresh();
}

/* API pública para abrir modal de reunião com lead pré-preenchido */
function agendaNovaReuniaoLead(leadId, leadNome) {
  AG.prefillLead = { id: leadId, nome: leadNome };
  navigate('agenda', document.querySelector('[data-page=agenda]'));
  setTimeout(() => _agOpenModal(), 200);
}
