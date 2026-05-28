/* =====================================================================
   CLIENTES — Lista + Perfil Expandido + Drive
   Leads = Clientes (mesma entidade, visão expandida)
   ===================================================================== */
const CL = {
  busca:         '',
  filtroStage:   'todos',
  filtroReuniao: 'todos',
  perfilId:      null,
  perfilTab:     'visao',
  driveLoading:  false,
  viewMode:      'list',
};

/* ─────────────────────────────────────────────
   MEETING STATUS HELPER
───────────────────────────────────────────── */
function _clMeetingStatus(leadId) {
  const hoje    = new Date().toISOString().slice(0, 10);
  const reunioes = (typeof rnGet === 'function' ? rnGet() : []).filter(r => r.leadId === leadId);

  const upcoming = reunioes
    .filter(r => r.status === 'agendada' && r.data >= hoje)
    .sort((a, b) => a.data.localeCompare(b.data));

  if (upcoming.length > 0) {
    return { id: 'aguardando', label: 'Aguardando Reunião', cor: '#f59e0b', bg: '#fffbeb', icon: 'bi-clock-fill' };
  }

  const past = reunioes
    .filter(r => r.status !== 'agendada' || r.data < hoje)
    .sort((a, b) => b.data.localeCompare(a.data));

  if (past.length > 0) {
    const last = past[0];
    if (last.status === 'realizada') {
      return { id: 'realizada', label: 'Reunião Feita', cor: '#16a34a', bg: '#dcfce7', icon: 'bi-check-circle-fill' };
    }
    if (last.status === 'cancelada') {
      return { id: 'cancelada', label: 'Reunião Cancelada', cor: '#ef4444', bg: '#fee2e2', icon: 'bi-x-circle-fill' };
    }
  }

  return { id: 'precisa-agendar', label: 'Agendar Reunião', cor: '#94a3b8', bg: '#f1f5f9', icon: 'bi-calendar-plus' };
}

/* ─────────────────────────────────────────────
   TAGS HELPERS
───────────────────────────────────────────── */
const CL_TAG_COLORS = [
  '#ef4444', '#f59e0b', '#16a34a', '#3b82f6',
  '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'
];

function leadAddTag(id, label, cor) {
  const lead = storeGet().find(l => l.id === id);
  if (!lead) return;
  if (!lead.tags) lead.tags = [];
  lead.tags.push({ label: label.trim(), cor });
  leadUpdate(id, { tags: lead.tags });
}

function leadRemoveTag(id, tagIdx) {
  const lead = storeGet().find(l => l.id === id);
  if (!lead || !lead.tags) return;
  lead.tags.splice(tagIdx, 1);
  leadUpdate(id, { tags: lead.tags });
}

function _clTagPill(tag, idx, leadId, removable) {
  const rm = removable
    ? `<span onclick="event.stopPropagation();leadRemoveTag(${leadId},${idx});_clRefreshLista();${CL.perfilId===leadId?'_clReopenPerfil()':''}" style="margin-left:3px;cursor:pointer;opacity:0.7;font-size:9px">✕</span>`
    : '';
  return `<span style="display:inline-flex;align-items:center;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700;background:${_esc(tag.cor)}22;color:${_esc(tag.cor)};border:1px solid ${_esc(tag.cor)}44">${_esc(tag.label)}${rm}</span>`;
}

function _clReopenPerfil() {
  const lead = storeGet().find(l => l.id === CL.perfilId);
  if (lead) _clRenderPerfilPage(lead);
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
function initClientes() {
  const el = document.getElementById('page-clientes');
  if (!el) return;
  el.innerHTML = _clRender();
  document.getElementById('clBusca')?.addEventListener('input', e => {
    CL.busca = e.target.value.toLowerCase();
    _clRefreshLista();
  });
}

/* ─────────────────────────────────────────────
   RENDER SHELL
───────────────────────────────────────────── */
function _clRender() {
  return `
    <!-- Lista Container -->
    <div id="clListaContainer">
      <div class="page-header">
        <div>
          <div class="page-title">Clientes</div>
          <div class="page-subtitle">Cadastro completo e perfil de cada cliente</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="display:flex;gap:4px;border:1px solid var(--border);border-radius:8px;padding:2px">
            <button id="clViewCards" onclick="CL.viewMode='cards';_clRefreshLista()" title="Visualização em cards"
              style="border:none;border-radius:6px;padding:5px 9px;cursor:pointer;font-size:14px;background:${CL.viewMode==='cards'?'var(--primary)':'transparent'};color:${CL.viewMode==='cards'?'white':'var(--muted)'}">
              <i class="bi bi-grid-fill"></i>
            </button>
            <button id="clViewList" onclick="CL.viewMode='list';_clRefreshLista()" title="Visualização em lista"
              style="border:none;border-radius:6px;padding:5px 9px;cursor:pointer;font-size:14px;background:${CL.viewMode==='list'?'var(--primary)':'transparent'};color:${CL.viewMode==='list'?'white':'var(--muted)'}">
              <i class="bi bi-list-ul"></i>
            </button>
          </div>
          <button class="btn btn-primary" onclick="openModalNovoLead('lead')">
            <i class="bi bi-person-plus-fill"></i> Novo Cliente
          </button>
        </div>
      </div>

      <!-- Filtros Etapa -->
      <div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap;align-items:center">
        <input class="form-input" id="clBusca" placeholder="Buscar por nome, e-mail, telefone..." style="max-width:320px" value="${_esc(CL.busca)}" />
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${[{id:'todos',label:'Todos'},...STAGES].map(s=>`
            <button class="btn btn-sm ${CL.filtroStage===s.id?'btn-primary':'btn-ghost'}" onclick="CL.filtroStage='${s.id}';_clRefreshLista()">
              ${s.label}
            </button>`).join('')}
        </div>
      </div>

      <!-- Filtro Reunião -->
      <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
        <span style="font-size:11px;font-weight:700;color:var(--muted);margin-right:2px">Reunião:</span>
        ${[
          { id: 'todos',          label: 'Todos',      cor: '#64748b', bg: '#f1f5f9' },
          { id: 'aguardando',     label: 'Aguardando', cor: '#f59e0b', bg: '#fffbeb' },
          { id: 'realizada',      label: 'Realizada',  cor: '#16a34a', bg: '#dcfce7' },
          { id: 'cancelada',      label: 'Cancelada',  cor: '#ef4444', bg: '#fee2e2' },
          { id: 'precisa-agendar',label: 'Agendar',    cor: '#94a3b8', bg: '#f8fafc' },
        ].map(f => {
          const active = CL.filtroReuniao === f.id;
          return `<button onclick="CL.filtroReuniao='${f.id}';_clRefreshLista()"
            style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;border:1.5px solid ${active?f.cor:'transparent'};background:${active?f.bg:'var(--bg)'};color:${active?f.cor:'var(--muted)'};transition:all .15s">
            ${f.label}
          </button>`;
        }).join('')}
      </div>

      <!-- Lista -->
      <div id="clLista">${_clRenderLista()}</div>
    </div>

    <!-- Perfil Full-Page Container -->
    <div id="clPerfilContainer" style="display:none"></div>

    <!-- Painel Perfil (mantido para compatibilidade, não usado no novo fluxo) -->
    <div class="lead-perfil-overlay" id="clPerfilOverlay" onclick="if(event.target===this)_clClosePerfil()">
      <div class="lead-perfil-panel" id="clPerfilPanel" style="width:700px;max-width:98vw"></div>
    </div>
  `;
}

/* ─────────────────────────────────────────────
   REFRESH
───────────────────────────────────────────── */
function _clRefreshLista() {
  const el = document.getElementById('clLista');
  if (el) el.innerHTML = _clRenderLista();
  const btnCards = document.getElementById('clViewCards');
  const btnList  = document.getElementById('clViewList');
  if (btnCards) {
    btnCards.style.background = CL.viewMode === 'cards' ? 'var(--primary)' : 'transparent';
    btnCards.style.color      = CL.viewMode === 'cards' ? 'white' : 'var(--muted)';
  }
  if (btnList) {
    btnList.style.background  = CL.viewMode === 'list' ? 'var(--primary)' : 'transparent';
    btnList.style.color       = CL.viewMode === 'list' ? 'white' : 'var(--muted)';
  }
}

/* ─────────────────────────────────────────────
   RENDER LIST / CARDS
───────────────────────────────────────────── */
function _clRenderLista() {
  let leads = storeGet();

  if (CL.filtroStage !== 'todos') leads = leads.filter(l => l.stage === CL.filtroStage);
  if (CL.busca) {
    leads = leads.filter(l =>
      l.nome.toLowerCase().includes(CL.busca) ||
      (l.email   || '').toLowerCase().includes(CL.busca) ||
      (l.telefone|| '').includes(CL.busca)
    );
  }
  if (CL.filtroReuniao !== 'todos') {
    leads = leads.filter(l => _clMeetingStatus(l.id).id === CL.filtroReuniao);
  }

  leads.sort((a, b) => new Date(b.atualizadoEm) - new Date(a.atualizadoEm));

  if (!leads.length) return `
    <div class="card" style="text-align:center;padding:48px;color:var(--muted)">
      <i class="bi bi-people" style="font-size:44px;opacity:0.25;display:block;margin-bottom:14px"></i>
      Nenhum cliente encontrado.
    </div>`;

  if (CL.viewMode === 'list') return _clRenderListView(leads);
  return _clRenderCardsView(leads);
}

/* ── LIST VIEW ── */
function _clRenderListView(leads) {
  return `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06)">
        <thead>
          <tr style="background:var(--bg);border-bottom:2px solid var(--border)">
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Código</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Nome</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Etapa</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Status Reunião</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Etiquetas</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Valor</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Contato</th>
            <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${leads.map(l => {
            const stage   = STAGES.find(s => s.id === l.stage);
            const ms      = _clMeetingStatus(l.id);
            const inicial = (l.nome || '?')[0].toUpperCase();
            const tags    = (l.tags || []);
            return `
              <tr style="border-bottom:1px solid var(--border);transition:background .1s;cursor:pointer"
                  onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''"
                  onclick="_clOpenPerfil(${JSON.stringify(l.id)})">
                <td style="padding:10px 14px">
                  <span style="font-size:10px;font-weight:700;color:var(--muted);font-family:monospace;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:1px 5px">${l.codigo || '—'}</span>
                </td>
                <td style="padding:10px 14px">
                  <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:34px;height:34px;background:${stage?.cor||'var(--primary)'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;color:white;flex-shrink:0">${inicial}</div>
                    <div>
                      <div style="font-weight:700;font-size:13px;color:var(--primary)">${_esc(l.nome)}</div>
                      <div style="font-size:11px;color:var(--muted)">${_esc(l.email||'')}</div>
                    </div>
                  </div>
                </td>
                <td style="padding:10px 14px">
                  <span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${(stage?.cor||'#94a3b8')}22;color:${stage?.cor||'#475569'}">${stage?.label||l.stage}</span>
                </td>
                <td style="padding:10px 14px">
                  <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${ms.bg};color:${ms.cor}">
                    <i class="bi ${ms.icon}" style="font-size:10px"></i>${ms.label}
                  </span>
                </td>
                <td style="padding:10px 14px">
                  <div style="display:flex;gap:4px;flex-wrap:wrap">
                    ${tags.slice(0,3).map((t,i) => _clTagPill(t,i,l.id,false)).join('')}
                    ${tags.length>3?`<span style="font-size:10px;color:var(--muted)">+${tags.length-3}</span>`:''}
                  </div>
                </td>
                <td style="padding:10px 14px;font-size:13px;color:var(--text)">${fmtValor(l.valorDesejado)}</td>
                <td style="padding:10px 14px;font-size:12px;color:var(--muted)">${_esc(l.telefone||l.email||'—')}</td>
                <td style="padding:10px 14px;text-align:center" onclick="event.stopPropagation()">
                  <button class="btn btn-ghost btn-sm" onclick="_clOpenPerfil(${JSON.stringify(l.id)})" title="Abrir perfil" style="padding:4px 10px">
                    <i class="bi bi-person-lines-fill"></i>
                  </button>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ── CARDS VIEW ── */
function _clRenderCardsView(leads) {
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
    ${leads.map(l => {
      const stage    = STAGES.find(s => s.id === l.stage);
      const ms       = _clMeetingStatus(l.id);
      const stageIdx = STAGES.findIndex(s => s.id === l.stage);
      const progresso= Math.round(((stageIdx + 1) / STAGES.length) * 100);
      const inicial  = (l.nome || '?')[0].toUpperCase();
      const tags     = (l.tags || []);
      const hoje     = new Date().toISOString().slice(0, 10);
      const proxReun = (typeof rnGet === 'function' ? rnGet() : [])
        .filter(r => r.leadId === l.id && r.status === 'agendada' && r.data >= hoje)
        .sort((a, b) => a.data.localeCompare(b.data))[0];
      const stageCor = stage?.cor || '#0d1f3c';

      return `
        <div class="card" style="cursor:pointer;transition:box-shadow .2s,transform .2s;border:1px solid var(--border);border-radius:12px;overflow:hidden;position:relative"
          onmouseover="this.style.boxShadow='0 6px 24px rgba(13,31,60,.13)';this.style.transform='translateY(-2px)'"
          onmouseout="this.style.boxShadow='';this.style.transform=''"
          onclick="_clOpenPerfil(${JSON.stringify(l.id)})">
          <!-- Color top strip -->
          <div style="height:4px;background:${stageCor};width:100%"></div>
          ${l.codigo ? `<span style="font-size:9px;font-weight:700;color:var(--muted);background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:1px 5px;position:absolute;top:10px;right:10px">${_esc(l.codigo)}</span>` : ''}
          <div style="padding:14px">
            <!-- Header row -->
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
              <div style="width:44px;height:44px;background:linear-gradient(135deg,${stageCor},${stageCor}99);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;color:white;flex-shrink:0;box-shadow:0 2px 8px ${stageCor}44">${inicial}</div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:800;font-size:14px;color:var(--primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(l.nome)}</div>
                <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(l.email||l.telefone||'—')}</div>
              </div>
              <span style="padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;background:${stageCor}18;color:${stageCor};flex-shrink:0">${stage?.label||l.stage}</span>
            </div>

            <!-- Meeting status pill -->
            <div style="margin-bottom:8px">
              <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${ms.bg};color:${ms.cor}">
                <i class="bi ${ms.icon}" style="font-size:10px"></i>${ms.label}
              </span>
            </div>

            <!-- Tags -->
            ${tags.length > 0 ? `
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
              ${tags.slice(0,4).map((t,i) => _clTagPill(t,i,l.id,false)).join('')}
              ${tags.length>4?`<span style="font-size:10px;color:var(--muted);align-self:center">+${tags.length-4}</span>`:''}
            </div>` : ''}

            <!-- Progress bar -->
            <div style="height:4px;background:var(--border);border-radius:2px;margin-bottom:8px">
              <div style="height:100%;width:${progresso}%;background:${stageCor};border-radius:2px;transition:width .3s"></div>
            </div>

            <!-- Footer row -->
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--muted)">
              <span style="font-weight:600">${l.valorDesejado ? fmtValor(l.valorDesejado) : '—'}</span>
              ${proxReun
                ? `<span style="color:#d97706;font-weight:600"><i class="bi bi-calendar-check"></i> ${new Date(proxReun.data+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</span>`
                : `<span>Atual. ${fmtData(l.atualizadoEm)}</span>`}
            </div>
          </div>
        </div>`;
    }).join('')}
  </div>`;
}

/* ─────────────────────────────────────────────
   PERFIL — OPEN / CLOSE
───────────────────────────────────────────── */
function _clOpenPerfil(id) {
  const lead = storeGet().find(l => String(l.id) === String(id));
  if (!lead) return;
  CL.perfilId  = id;
  CL.perfilTab = CL.perfilTab || 'visao';
  _clRenderPerfilPage(lead);
  const lista  = document.getElementById('clListaContainer');
  const perfil = document.getElementById('clPerfilContainer');
  if (lista)  lista.style.display  = 'none';
  if (perfil) perfil.style.display = 'block';
}

function _clClosePerfil() {
  const lista  = document.getElementById('clListaContainer');
  const perfil = document.getElementById('clPerfilContainer');
  if (perfil) perfil.style.display = 'none';
  if (lista)  lista.style.display  = 'block';
  CL.perfilId = null;
}

/* ─────────────────────────────────────────────
   PERFIL — TAB SWITCH
───────────────────────────────────────────── */
function _clToggleTab(tab) {
  CL.perfilTab = tab;
  const tabs = ['visao', 'cotacoes', 'atividade', 'reunioes', 'anotacoes', 'documentos'];
  tabs.forEach(t => {
    const btn  = document.getElementById('clTab_'  + t);
    const pane = document.getElementById('clPane_' + t);
    if (btn) {
      btn.style.borderBottom = t === tab ? '3px solid var(--primary)' : '3px solid transparent';
      btn.style.color        = t === tab ? 'var(--primary)' : 'var(--muted)';
      btn.style.fontWeight   = t === tab ? '700' : '500';
    }
    if (pane) pane.style.display = t === tab ? 'block' : 'none';
  });
  /* Load Drive files lazily when switching to Documents tab */
  if (tab === 'documentos' && CL.perfilId) {
    const lead = storeGet().find(l => l.id === CL.perfilId);
    if (lead?.driveFolderId && gauthIsConnected()) {
      _clLoadDriveFiles(lead.driveFolderId);
    }
  }
}

/* ─────────────────────────────────────────────
   PERFIL — FULL-PAGE RENDER (new)
───────────────────────────────────────────── */
function _clRenderPerfilPage(lead) {
  const id       = lead.id;
  const stage    = STAGES.find(s => s.id === lead.stage);
  const stageCor = stage?.cor || '#0d1f3c';
  const ms       = _clMeetingStatus(id);
  const inicial  = (lead.nome || '?')[0].toUpperCase();
  const tags     = lead.tags || [];
  const hoje     = new Date().toISOString().slice(0, 10);

  const reunioes = (typeof rnGet === 'function' ? rnGet() : [])
    .filter(r => r.leadId === id)
    .sort((a, b) => b.data.localeCompare(a.data));
  const proxReun = reunioes.find(r => r.status === 'agendada' && r.data >= hoje);

  /* ── Funil atual ── */
  const allFunnels      = (typeof funnelsGet === 'function') ? funnelsGet() : [];
  const leadFunnelObj   = allFunnels.find(f => f.id === (lead.funnel || 'vendas')) || allFunnels[0] || { id: 'vendas', label: 'Vendas', cor: '#16a34a', stages: STAGES };
  const leadFunnelStages= leadFunnelObj?.stages || STAGES;
  const stageIdx        = leadFunnelStages.findIndex(s => s.id === lead.stage);
  const progresso       = leadFunnelStages.length > 0 ? Math.round(((stageIdx + 1) / leadFunnelStages.length) * 100) : 0;
  const funnelCor       = leadFunnelObj?.cor || '#16a34a';

  /* ── Parcelas ── */
  const parcelas    = JSON.parse(localStorage.getItem('crm_parcelas') || '[]').filter(p => String(p.leadId) === String(id));
  const parcelasTotal    = parcelas.length;
  const parcelasPagas    = parcelas.filter(p => p.status === 'pago').length;
  const parcelasAtrasadas= parcelas.filter(p => p.status === 'atrasado').length;
  const adimplente       = parcelasAtrasadas === 0;

  /* ── Drive button ── */
  const driveBtn = gauthIsConnected()
    ? (lead.driveFolderId
        ? `<a href="${_esc(lead.driveFolderUrl||'#')}" target="_blank" class="btn btn-outline btn-sm" style="color:#1d4ed8;border-color:#1d4ed8;font-size:12px"><i class="bi bi-google"></i> Drive</a>`
        : `<button class="btn btn-outline btn-sm" style="color:#1d4ed8;border-color:#1d4ed8;font-size:12px" onclick="_clEnsureDrive(${id})"><i class="bi bi-folder2-open"></i> Drive</button>`)
    : '';

  /* ── Pipeline progress dots (funnel-aware) ── */
  const pipelineDots = leadFunnelStages.map((s, i) => {
    const isActive  = s.id === lead.stage;
    const isPast    = i <= stageIdx;
    const dotColor  = isPast ? (s.cor || stageCor) : '#cbd5e1';
    const textColor = isActive ? (s.cor || stageCor) : (isPast ? '#64748b' : '#94a3b8');
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;min-width:0">
      <div style="width:${isActive?'14px':'10px'};height:${isActive?'14px':'10px'};border-radius:50%;background:${dotColor};${isActive?'border:2px solid white;box-shadow:0 0 0 2px '+(s.cor||stageCor)+';':''};transition:all .2s;flex-shrink:0"></div>
      <div style="font-size:9px;font-weight:${isActive?'800':'500'};color:${textColor};text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;padding:0 2px">${_esc(s.label)}</div>
    </div>`;
  }).join('');

  /* ── Section header helper ── */
  const secHeader = (icon, label) =>
    `<div style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);margin-bottom:8px;margin-top:16px">
      <i class="bi ${icon}" style="font-size:11px;opacity:.7"></i>${label}
    </div>`;

  /* ── Info row helper ── */
  const infoRow = (key, val) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9">
      <span style="font-size:12px;color:var(--muted);font-weight:500">${key}</span>
      <span style="font-size:12px;color:var(--text);font-weight:700;text-align:right;max-width:60%;word-break:break-word">${val}</span>
    </div>`;

  const container = document.getElementById('clPerfilContainer');
  if (!container) return;

  container.innerHTML = `
    <!-- Top bar: back + actions -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
      <button onclick="_clClosePerfil()" style="display:inline-flex;align-items:center;gap:6px;background:none;border:1px solid var(--border);border-radius:8px;padding:7px 14px;cursor:pointer;font-size:13px;font-weight:700;color:var(--text);transition:background .15s"
        onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='none'">
        <i class="bi bi-arrow-left"></i> Voltar aos Clientes
      </button>
      <div style="flex:1"></div>
      <button class="btn btn-outline btn-sm" onclick="_clEditarLead(${id})" style="font-size:12px"><i class="bi bi-pencil-fill"></i> Editar</button>
      <button class="btn btn-ghost btn-sm" onclick="_clDeleteLead(${id})" style="font-size:12px;color:#ef4444"><i class="bi bi-trash3-fill"></i></button>
    </div>

    <!-- Two-column layout -->
    <div style="display:grid;grid-template-columns:300px 1fr;min-height:calc(100vh - 180px);background:white;border-radius:14px;border:1px solid var(--border);box-shadow:0 2px 12px rgba(0,0,0,.06);overflow:hidden">

      <!-- LEFT COLUMN -->
      <div id="clLeftCol" style="border-right:1px solid var(--border);overflow-y:auto;display:flex;flex-direction:column">

        <!-- ── DARK GRADIENT HEADER ── -->
        <div style="background:linear-gradient(160deg,#0d1f3c 0%,#1c3a72 100%);padding:28px 24px 20px;text-align:center;flex-shrink:0">

          <!-- Avatar -->
          <div style="width:80px;height:80px;background:linear-gradient(135deg,${stageCor},${stageCor}88);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:32px;color:white;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,0.35)">${inicial}</div>

          <!-- Name -->
          <div style="font-size:20px;font-weight:800;color:white;margin-top:12px;word-break:break-word;line-height:1.2">${_esc(lead.nome)}</div>

          <!-- Stage + Meeting status pills -->
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:10px">
            <span style="padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;background:${stageCor}4d;color:white">${stage?.label||lead.stage}</span>
            <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(255,255,255,0.18);color:white">
              <i class="bi ${ms.icon}" style="font-size:10px"></i>${ms.label}
            </span>
          </div>

          <!-- Funil badge -->
          <div style="margin-top:10px;display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;background:rgba(255,255,255,0.12);font-size:11px;font-weight:700;color:white">
            <span style="width:8px;height:8px;border-radius:50%;background:${funnelCor};flex-shrink:0;display:inline-block"></span>
            ${_esc(leadFunnelObj.label)}
          </div>

          <!-- Action buttons -->
          <div style="display:flex;gap:8px;margin-top:16px;justify-content:center">
            <a href="tel:${_esc(lead.telefone||'')}" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;background:rgba(255,255,255,0.18);color:white;font-size:12px;font-weight:700;text-decoration:none;cursor:pointer;transition:background .15s;border:1px solid rgba(255,255,255,0.22)"
              onmouseover="this.style.background='rgba(255,255,255,0.28)'" onmouseout="this.style.background='rgba(255,255,255,0.18)'">
              <i class="bi bi-telephone-fill"></i> Ligar
            </a>
            <button onclick="_clOpenWppByPhone(${id})" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;background:rgba(255,255,255,0.18);color:white;font-size:12px;font-weight:700;cursor:pointer;transition:background .15s;border:1px solid rgba(255,255,255,0.22)"
              onmouseover="this.style.background='rgba(255,255,255,0.28)'" onmouseout="this.style.background='rgba(255,255,255,0.18)'">
              <i class="bi bi-whatsapp"></i> WhatsApp
            </button>
          </div>
        </div>

        <!-- ── WHITE BODY ── -->
        <div style="padding:16px 20px 24px;background:white;flex:1;display:flex;flex-direction:column">

          <!-- CONTATO -->
          <div style="margin-top:0">
            ${secHeader('bi-person-lines-fill', 'Contato')}
            <div style="margin-top:0">
            ${lead.telefone ? `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9">
              <span style="font-size:12px;color:var(--muted);font-weight:500;display:flex;align-items:center;gap:5px"><i class="bi bi-telephone-fill" style="color:${stageCor}"></i> Telefone</span>
              <a href="tel:${_esc(lead.telefone)}" style="font-size:12px;color:var(--text);font-weight:700;text-decoration:none"
                onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text)'">${_esc(lead.telefone)}</a>
            </div>` : ''}
            ${lead.email ? `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9">
              <span style="font-size:12px;color:var(--muted);font-weight:500;display:flex;align-items:center;gap:5px"><i class="bi bi-envelope-fill" style="color:${stageCor}"></i> E-mail</span>
              <span style="font-size:12px;color:var(--text);font-weight:700;text-align:right;max-width:60%;word-break:break-all">${_esc(lead.email)}</span>
            </div>` : ''}
            ${lead.cpf ? `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9">
              <span style="font-size:12px;color:var(--muted);font-weight:500;display:flex;align-items:center;gap:5px"><i class="bi bi-person-badge"></i> CPF</span>
              <span style="font-size:12px;color:var(--text);font-weight:700">${_esc(lead.cpf)}</span>
            </div>` : ''}
            </div>
          </div>

          <!-- NEGÓCIO -->
          <div>
            ${secHeader('bi-briefcase-fill', 'Negócio')}
            ${lead.valorDesejado ? infoRow('<i class="bi bi-currency-dollar"></i> Crédito desejado', fmtValor(lead.valorDesejado)) : ''}
            ${lead.aporteMensal  ? infoRow('<i class="bi bi-calendar-month"></i> Aporte mensal',    fmtValor(lead.aporteMensal))  : ''}
            ${lead.objetivo      ? infoRow('<i class="bi bi-geo-alt-fill"></i> Objetivo',            _esc(lead.objetivo))          : ''}
            ${lead.origem        ? infoRow('<i class="bi bi-broadcast-pin"></i> Origem',             _esc(lead.origem))            : ''}
            ${parcelasTotal > 0 ? `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9">
              <span style="font-size:12px;color:var(--muted);font-weight:500"><i class="bi bi-credit-card-fill"></i> Parcelas</span>
              <span style="display:flex;align-items:center;gap:6px">
                <span style="font-size:12px;color:var(--text);font-weight:700">${parcelasPagas} pagas de ${parcelasTotal}</span>
                <span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;background:${adimplente?'#dcfce7':'#fee2e2'};color:${adimplente?'#16a34a':'#ef4444'}">${adimplente?'Adimplente':'Inadimplente'}</span>
              </span>
            </div>` : ''}
          </div>

          <!-- PIPELINE -->
          <div>
            ${secHeader('bi-diagram-3-fill', 'Pipeline')}

            <!-- Funnel name + progress dots -->
            <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:8px">${_esc(leadFunnelObj.label)}</div>
            <div style="display:flex;align-items:flex-start;gap:0;position:relative;margin-bottom:14px">
              <div style="position:absolute;top:5px;left:5px;right:5px;height:2px;background:var(--border);z-index:0"></div>
              <div style="position:absolute;top:5px;left:5px;height:2px;width:${progresso}%;background:${stageCor};z-index:1;transition:width .3s"></div>
              <div style="display:flex;width:100%;position:relative;z-index:2">${pipelineDots}</div>
            </div>

            <!-- Trocar funil -->
            <div style="margin-bottom:10px">
              <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px"><i class="bi bi-arrow-left-right" style="opacity:.6"></i> Trocar Funil</div>
              <select onchange="_clTrocarFunil(${id},this.value)"
                style="width:100%;border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;color:var(--text);background:white;cursor:pointer;outline:none">
                <option value="">— Trocar funil —</option>
                ${allFunnels.map(f => `<option value="${_esc(f.id)}" ${(lead.funnel||'vendas')===f.id?'selected':''}>${_esc(f.label)}</option>`).join('')}
              </select>
            </div>

            <!-- Mover etapa -->
            <div>
              <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Mover etapa</div>
              <div style="display:flex;gap:4px;flex-wrap:wrap">
                ${leadFunnelStages.map(s => {
                  const isAct = s.id === lead.stage;
                  const sc = s.cor || '#6b7280';
                  return `<button onclick="_clMoverStage(${id},'${s.id}')" style="padding:4px 10px;border-radius:20px;font-size:10px;font-weight:700;cursor:pointer;border:2px solid ${isAct?sc:'transparent'};background:${isAct?sc+'18':'#f1f5f9'};color:${isAct?sc:'#64748b'};transition:all .15s">${_esc(s.label)}</button>`;
                }).join('')}
              </div>
            </div>
          </div>

          <!-- ETIQUETAS -->
          <div>
            ${secHeader('bi-tags-fill', 'Etiquetas')}
            <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
              ${tags.map((t,i) => _clTagPill(t, i, id, true)).join('')}
              <button onclick="_clAddTagPopover(${id})" style="background:none;border:1.5px dashed var(--border);border-radius:20px;padding:2px 9px;font-size:11px;color:var(--muted);cursor:pointer;line-height:1.4" title="Adicionar etiqueta">+ Tag</button>
            </div>
          </div>

          <!-- INFO -->
          <div>
            ${secHeader('bi-info-circle-fill', 'Info')}
            ${infoRow('Criado em',   new Date(lead.criadoEm   ).toLocaleDateString('pt-BR'))}
            ${infoRow('Atualizado',  new Date(lead.atualizadoEm).toLocaleDateString('pt-BR'))}
            ${driveBtn ? `<div style="margin-top:10px">${driveBtn}</div>` : ''}
          </div>

        </div><!-- end white body -->

      </div><!-- end LEFT COLUMN -->

      <!-- RIGHT COLUMN -->
      <div style="display:flex;flex-direction:column;overflow:hidden">

        <!-- Tabs bar -->
        <div style="display:flex;gap:0;border-bottom:1px solid var(--border);padding:0 24px;overflow-x:auto;flex-shrink:0;background:white">
          ${[
            { id:'visao',       label:'Visão Geral', icon:'bi-person-circle'   },
            { id:'cotacoes',    label:'Cotações',    icon:'bi-calculator-fill' },
            { id:'atividade',   label:'Atividade',   icon:'bi-activity'        },
            { id:'reunioes',    label:'Reuniões',    icon:'bi-calendar3'       },
            { id:'anotacoes',   label:'Anotações',   icon:'bi-sticky'          },
            { id:'documentos',  label:'Documentos',  icon:'bi-folder2-open'    },
          ].map(t => {
            const badge = t.id === 'cotacoes' && (lead.simulacoes||[]).length
              ? `<span style="background:#7c3aed;color:white;font-size:9px;font-weight:800;padding:1px 6px;border-radius:8px;margin-left:4px">${lead.simulacoes.length}</span>`
              : '';
            return `
            <button id="clTab_${t.id}" onclick="_clToggleTab('${t.id}')"
              style="padding:14px 16px;border:none;background:none;cursor:pointer;font-size:13px;border-bottom:3px solid transparent;transition:all .15s;white-space:nowrap;flex-shrink:0">
              <i class="bi ${t.icon}" style="margin-right:4px"></i>${t.label}${badge}
            </button>`;
          }).join('')}
        </div>

        <!-- Tab panes -->
        <div style="flex:1;overflow-y:auto;padding:20px 24px">

          <div id="clPane_visao">
            ${_clPaneVisaoGeral(lead, proxReun, progresso, stageCor, id)}
          </div>

          <div id="clPane_cotacoes" style="display:none">
            ${_clPaneCotacoes(lead, id)}
          </div>

          <div id="clPane_atividade" style="display:none">
            ${_clPaneAtividade(lead, id)}
          </div>

          <div id="clPane_reunioes" style="display:none">
            ${_clPaneReunioes(lead, id, reunioes)}
          </div>

          <div id="clPane_anotacoes" style="display:none">
            ${_clPaneAnotacoes(lead, id)}
          </div>

          <div id="clPane_documentos" style="display:none">
            ${_clPaneDocumentos(lead, id)}
          </div>

        </div><!-- end tab panes -->

      </div><!-- end RIGHT COLUMN -->

    </div><!-- end two-column grid -->
  `;

  /* Activate tab & email widget */
  _clToggleTab(CL.perfilTab || 'visao');

  if (lead.email && typeof emailPerfilWidget === 'function') {
    const emailCont = document.getElementById(`clEmailWidget_${id}`);
    if (emailCont) emailPerfilWidget(lead.email, emailCont);
  }
}

/* ─────────────────────────────────────────────
   TROCAR FUNIL
───────────────────────────────────────────── */
function _clTrocarFunil(id, newFunnelId) {
  if (!newFunnelId) return;
  const allFunnels = (typeof funnelsGet === 'function') ? funnelsGet() : [];
  const newFunnel  = allFunnels.find(f => f.id === newFunnelId);
  if (!newFunnel) return;

  const firstStage  = (newFunnel.stages && newFunnel.stages.length > 0) ? newFunnel.stages[0] : null;
  const updateData  = { funnel: newFunnelId };
  if (firstStage) updateData.stage = firstStage.id;

  leadUpdate(id, updateData);
  if (typeof leadAddHistorico === 'function') leadAddHistorico(id, 'Movido para funil ' + newFunnel.label);

  const updatedLead = storeGet().find(l => l.id === id);
  if (updatedLead) {
    _clRenderPerfilPage(updatedLead);
    _clToggleTab(CL.perfilTab || 'visao');
  }
  _clRefreshLista();
}

/* ─────────────────────────────────────────────
   PERFIL — LEGACY RENDER (kept for backwards compat)
   All internal callers now use _clRenderPerfilPage.
───────────────────────────────────────────── */
function _clRenderPerfil(lead) {
  /* If the full-page container is visible, render into it */
  const perfil = document.getElementById('clPerfilContainer');
  if (perfil && perfil.style.display !== 'none') {
    _clRenderPerfilPage(lead);
    return;
  }

  /* Fallback: legacy sidebar panel (kept for external callers) */
  const id         = lead.id;
  const allFunnels = typeof funnelsGet === 'function' ? funnelsGet() : [];
  const lfObj      = allFunnels.find(f => f.id === (lead.funnel||'vendas')) || allFunnels[0] || { stages: STAGES };
  const lfStages   = lfObj.stages || STAGES;
  const stage      = lfStages.find(s => s.id === lead.stage) || STAGES.find(s => s.id === lead.stage);
  const stageIdx   = lfStages.findIndex(s => s.id === lead.stage);
  const progresso  = Math.round(((stageIdx + 1) / lfStages.length) * 100);
  const stageCor   = stage?.cor || '#0d1f3c';
  const ms       = _clMeetingStatus(id);
  const inicial  = (lead.nome || '?')[0].toUpperCase();
  const tags     = lead.tags || [];
  const hoje     = new Date().toISOString().slice(0, 10);

  const reunioes = (typeof rnGet === 'function' ? rnGet() : [])
    .filter(r => r.leadId === id)
    .sort((a, b) => b.data.localeCompare(a.data));
  const proxReun = reunioes.find(r => r.status === 'agendada' && r.data >= hoje);

  /* ── Drive button ── */
  const driveBtn = gauthIsConnected()
    ? (lead.driveFolderId
        ? `<a href="${_esc(lead.driveFolderUrl||'#')}" target="_blank" class="btn btn-outline btn-sm" style="color:#1d4ed8;border-color:#1d4ed8;font-size:12px"><i class="bi bi-google"></i> Drive</a>`
        : `<button class="btn btn-outline btn-sm" style="color:#1d4ed8;border-color:#1d4ed8;font-size:12px" onclick="_clEnsureDrive(${id})"><i class="bi bi-folder2-open"></i> Drive</button>`)
    : `<button class="btn btn-ghost btn-sm" style="font-size:12px" onclick="_agConnectGoogle&&_agConnectGoogle()"><i class="bi bi-google"></i> Drive</button>`;

  document.getElementById('clPerfilPanel').innerHTML = `
    <!-- ── HEADER ── -->
    <div style="padding:20px 24px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:14px">
        <!-- Avatar -->
        <div style="width:60px;height:60px;background:linear-gradient(135deg,${stageCor},${stageCor}aa);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:24px;color:white;flex-shrink:0;box-shadow:0 3px 12px ${stageCor}44">${inicial}</div>
        <!-- Name/badges -->
        <div style="flex:1;min-width:0">
          <div style="font-size:20px;font-weight:800;color:var(--primary);margin-bottom:2px">${_esc(lead.nome)}</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:8px">
            ${lead.email ? `<i class="bi bi-envelope-fill" style="opacity:.5"></i> ${_esc(lead.email)}` : ''}
            ${lead.telefone ? ` &nbsp;<i class="bi bi-telephone-fill" style="opacity:.5"></i> ${_esc(lead.telefone)}` : ''}
          </div>
          <!-- Stage + Meeting status -->
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
            <span style="padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;background:${stageCor}18;color:${stageCor}">${stage?.label||lead.stage}</span>
            <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;background:${ms.bg};color:${ms.cor}">
              <i class="bi ${ms.icon}" style="font-size:10px"></i>${ms.label}
            </span>
          </div>
          <!-- Tags -->
          <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
            ${tags.map((t,i) => _clTagPill(t, i, id, true)).join('')}
            <button onclick="_clAddTagPopover(${id})" style="background:none;border:1.5px dashed var(--border);border-radius:20px;padding:2px 9px;font-size:11px;color:var(--muted);cursor:pointer;line-height:1.4" title="Adicionar etiqueta">+ Tag</button>
          </div>
        </div>
        <!-- Close -->
        <button onclick="_clClosePerfil()" style="background:none;border:none;font-size:20px;color:var(--muted);cursor:pointer;padding:0;line-height:1;flex-shrink:0">✕</button>
      </div>

      <!-- Quick actions -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
        <a class="btn btn-ghost btn-sm" href="tel:${_esc(lead.telefone||'')}" style="font-size:12px"><i class="bi bi-telephone-fill"></i> Ligar</a>
        <button class="btn btn-ghost btn-sm" style="font-size:12px" onclick="_clOpenWppChat(${id})"><i class="bi bi-whatsapp" style="color:#25d366"></i> WhatsApp</button>
        <button class="btn btn-outline btn-sm" style="font-size:12px" onclick="_clEditarLead(${id})"><i class="bi bi-pencil-fill"></i> Editar</button>
        <button class="btn btn-ghost btn-sm" style="font-size:12px" onclick="_clToggleTab('anotacoes');document.getElementById('clNoteInput')?.focus()"><i class="bi bi-sticky-fill"></i> Nota</button>
        ${driveBtn}
        <button class="btn btn-ghost btn-sm" style="font-size:12px;color:#ef4444;margin-left:auto" onclick="_clDeleteLead(${id})"><i class="bi bi-trash3-fill"></i></button>
      </div>

      <!-- Funnel selector + Stage selector -->
      <div style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
          <span style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;white-space:nowrap"><i class="bi bi-arrow-left-right" style="opacity:.6"></i> Funil</span>
          <select onchange="_clTrocarFunil(${id},this.value)"
            style="flex:1;border:1px solid var(--border);border-radius:8px;padding:5px 8px;font-size:12px;font-weight:600;color:var(--text);background:white;cursor:pointer;outline:none">
            ${allFunnels.map(f => `<option value="${_esc(f.id)}" ${(lead.funnel||'vendas')===f.id?'selected':''}>${_esc(f.label)}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${lfStages.map(s => {
            const isAct = s.id === lead.stage;
            const sc = s.cor || '#6b7280';
            return `<button onclick="_clMoverStage(${id},'${s.id}')" style="padding:4px 11px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;border:2px solid ${isAct?sc:'transparent'};background:${isAct?sc+'18':'#f1f5f9'};color:${isAct?sc:'#64748b'};transition:all .15s">${_esc(s.label)}</button>`;
          }).join('')}
        </div>
      </div>

      <!-- Tabs -->
      <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin:0 -24px;padding:0 24px;overflow-x:auto">
        ${[
          { id:'visao',       label:'Visão Geral', icon:'bi-person-circle'        },
          { id:'cotacoes',    label:'Cotações',    icon:'bi-calculator-fill'      },
          { id:'atividade',   label:'Atividade',   icon:'bi-activity'             },
          { id:'reunioes',    label:'Reuniões',    icon:'bi-calendar3'            },
          { id:'anotacoes',   label:'Anotações',   icon:'bi-sticky'               },
          { id:'documentos',  label:'Documentos',  icon:'bi-folder2-open'         },
        ].map(t => {
          const badge = t.id === 'cotacoes' && (lead.simulacoes||[]).length
            ? `<span style="background:#7c3aed;color:white;font-size:9px;font-weight:800;padding:1px 6px;border-radius:8px;margin-left:4px">${lead.simulacoes.length}</span>`
            : '';
          return `
          <button id="clTab_${t.id}" onclick="_clToggleTab('${t.id}')"
            style="padding:10px 16px;border:none;background:none;cursor:pointer;font-size:13px;border-bottom:3px solid transparent;transition:all .15s;white-space:nowrap;flex-shrink:0">
            <i class="bi ${t.icon}" style="margin-right:4px"></i>${t.label}${badge}
          </button>`;
        }).join('')}
      </div>
    </div>

    <!-- ── TAB PANES ── -->
    <div style="overflow-y:auto;max-height:calc(100vh - 340px);padding:20px 24px">

      <!-- Tab: Visão Geral -->
      <div id="clPane_visao">
        ${_clPaneVisaoGeral(lead, proxReun, progresso, stageCor, id)}
      </div>

      <!-- Tab: Cotações -->
      <div id="clPane_cotacoes" style="display:none">
        ${_clPaneCotacoes(lead, id)}
      </div>

      <!-- Tab: Atividade -->
      <div id="clPane_atividade" style="display:none">
        ${_clPaneAtividade(lead, id)}
      </div>

      <!-- Tab: Reuniões -->
      <div id="clPane_reunioes" style="display:none">
        ${_clPaneReunioes(lead, id, reunioes)}
      </div>

      <!-- Tab: Anotações -->
      <div id="clPane_anotacoes" style="display:none">
        ${_clPaneAnotacoes(lead, id)}
      </div>

      <!-- Tab: Documentos (Drive) -->
      <div id="clPane_documentos" style="display:none">
        ${_clPaneDocumentos(lead, id)}
      </div>

    </div>
  `;

  /* Activate tab & email widget */
  _clToggleTab(CL.perfilTab || 'visao');

  if (lead.email && typeof emailPerfilWidget === 'function') {
    const emailCont = document.getElementById(`clEmailWidget_${id}`);
    if (emailCont) emailPerfilWidget(lead.email, emailCont);
  }
}

/* ─────────────────────────────────────────────
   PANE: VISÃO GERAL
───────────────────────────────────────────── */
function _clPaneVisaoGeral(lead, proxReun, progresso, stageCor, id) {
  /* ── Scorecard values ── */
  const patrimonioTotal = (lead.valorImovel || 0) + (lead.valorVeiculo || 0);
  const rendaTotal      = (lead.rendaMensal || 0) + (lead.rendaConjuge || 0);
  const capacidadeLance = (lead.valorLance  || 0) + (lead.fgts         || 0);

  /* Situação de crédito */
  let creditoLabel, creditoColor, creditoIcon;
  if (!lead.restricoes || lead.restricoes === '') {
    creditoLabel = 'Não informado'; creditoColor = '#94a3b8'; creditoIcon = 'bi-shield-fill';
  } else if (lead.restricoes === 'Não') {
    creditoLabel = 'CPF Limpo';     creditoColor = '#16a34a'; creditoIcon = 'bi-shield-fill-check';
  } else if (lead.restricoes === 'Sim — pendências menores') {
    creditoLabel = 'Pendências';    creditoColor = '#d97706'; creditoIcon = 'bi-shield-exclamation';
  } else {
    creditoLabel = 'Negativado';    creditoColor = '#ef4444'; creditoIcon = 'bi-shield-fill-x';
  }

  /* Urgência badge */
  const urgBadge = urg => {
    if (!urg) return '<span style="color:var(--muted);font-size:12px">Não informado</span>';
    let bg = '#f1f5f9', color = '#64748b';
    if (urg.startsWith('Prefere'))  { bg = '#eff6ff'; color = '#1d4ed8'; }
    if (urg.startsWith('Urgente'))  { bg = '#fffbeb'; color = '#d97706'; }
    if (urg.startsWith('Precisa'))  { bg = '#fee2e2'; color = '#ef4444'; }
    return `<span style="display:inline-block;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:700;background:${bg};color:${color}">${_esc(urg)}</span>`;
  };

  /* Comprometimento bar */
  const rendaBar = pct => {
    if (!pct) return '';
    const p = Math.min(100, Math.max(0, pct));
    const fill = p <= 30 ? '#16a34a' : p <= 50 ? '#d97706' : '#ef4444';
    return `<div class="cl-renda-bar"><div class="cl-renda-fill" style="width:${p}%;background:${fill}"></div></div>`;
  };

  /* Restricoes badge */
  const restricaoBadge = r => {
    if (!r) return '<span style="color:var(--muted);font-size:12px">Não informado</span>';
    if (r === 'Não')                      return '<span style="color:#16a34a;font-weight:700;font-size:12px"><i class="bi bi-check-circle-fill"></i> CPF Limpo</span>';
    if (r === 'Sim — pendências menores') return '<span style="color:#d97706;font-weight:700;font-size:12px"><i class="bi bi-exclamation-circle-fill"></i> Pendências</span>';
    return '<span style="color:#ef4444;font-weight:700;font-size:12px"><i class="bi bi-x-circle-fill"></i> Negativado</span>';
  };

  /* Section card helper — always rendered, with per-section edit button */
  const secCard = (icon, iconColor, title, tab, content, isEmpty) => `
    <div class="cl-info-card" style="${isEmpty ? 'border-style:dashed;opacity:.85' : ''}">
      <div class="cl-info-card-title" style="justify-content:space-between">
        <span style="display:flex;align-items:center;gap:6px">
          <i class="bi ${icon}" style="color:${iconColor}"></i> ${title}
        </span>
        <button onclick="openModalEditarTab(${id},'${tab}')"
                style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:white;color:var(--muted);cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:4px"
                onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
                onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--muted)'">
          <i class="bi bi-pencil-fill"></i> ${isEmpty ? 'Preencher' : 'Editar'}
        </button>
      </div>
      ${content}
    </div>`;

  /* Empty state placeholder */
  const emptyState = msg =>
    `<div style="padding:12px 0;text-align:center;color:var(--muted);font-size:12px;font-style:italic">${msg}</div>`;

  /* Info item */
  const infoItem = (lbl, val, cls='') =>
    `<div class="cl-info-item${cls?' '+cls:''}">
      <div class="cl-info-lbl">${lbl}</div>
      <div class="cl-info-val">${val}</div>
    </div>`;

  /* Val or dash */
  const v = val => val ? _esc(String(val)) : '<span style="color:#cbd5e1">—</span>';
  const vMoney = val => val ? `<span class="cl-info-val accent">${fmtValor(val)}</span>` : '<span style="color:#cbd5e1">—</span>';
  const vGreen = val => val ? `<span class="cl-info-val green">${fmtValor(val)}</span>` : '<span style="color:#cbd5e1">—</span>';

  /* ── Detect empty sections ── */
  const hasFinanceiro = !!(lead.modeloRenda || lead.rendaMensal || lead.compRenda || lead.fgts || lead.restricoes);
  const hasConsorcio  = !!(lead.objetivo || lead.finalidade);
  const hasFamiliar   = !!(lead.estadoCivil || lead.conjuge || lead.dependentes || lead.profissao);
  const hasImovel     = !!(lead.valorImovel || lead.tipoImovel || lead.donoImovel);
  const hasVeiculo    = !!(lead.valorVeiculo || lead.tipoVeiculo || lead.modeloVeiculo);

  /* ── Section contents ── */
  const conteudoFinanceiro = hasFinanceiro ? `
    <div class="cl-info-grid">
      ${infoItem('Modelo de Renda',   v(lead.modeloRenda))}
      ${infoItem('Renda Bruta',       vMoney(lead.rendaMensal))}
      ${lead.compRenda ? `<div class="cl-info-item">
        <div class="cl-info-lbl">Comprometimento Atual</div>
        <div class="cl-info-val">${lead.compRenda}% da renda</div>
        ${rendaBar(lead.compRenda)}
      </div>` : infoItem('Comprometimento', v(''))}
      ${infoItem('FGTS p/ Lance',     vGreen(lead.fgts))}
      ${infoItem('Situação CPF',      restricaoBadge(lead.restricoes))}
      ${infoItem('Renda do Cônjuge',  vGreen(lead.rendaConjuge))}
    </div>
    ${lead.restricaoDetalhe ? `
    <div style="margin-top:10px;background:#fffbeb;border-left:3px solid #fcd34d;border-radius:0 6px 6px 0;padding:8px 10px;font-size:12px;color:#78716c">
      <strong style="color:#d97706">Detalhe restrições:</strong> ${_esc(lead.restricaoDetalhe)}
    </div>` : ''}` : emptyState('Renda e perfil de crédito não preenchidos');

  const simsAtivas = (lead.simulacoes || []).filter(s => !s.arquivado);
  const conteudoConsorcio = (hasConsorcio || simsAtivas.length > 0) ? `
    <div class="cl-info-grid">
      ${infoItem('Intenção de Crédito', v(lead.objetivo))}
      ${simsAtivas.length > 0
        ? `<div class="cl-info-item">
            <div class="cl-info-lbl">Cotações Ativas</div>
            <div class="cl-info-val" style="color:#6366f1">${simsAtivas.length} cotaç${simsAtivas.length===1?'ão':'ões'}</div>
          </div>`
        : infoItem('Cotações', '<span style="color:#cbd5e1">Nenhuma ainda</span>')}
    </div>
    ${lead.finalidade ? `
    <div style="margin-top:8px;background:var(--bg);border-radius:8px;padding:10px 12px">
      <div class="cl-info-lbl" style="margin-bottom:4px">Necessidade do cliente</div>
      <div style="font-size:13px;color:var(--primary);line-height:1.5">${_esc(lead.finalidade)}</div>
    </div>` : ''}
    ${simsAtivas.length > 0 ? `
    <div style="margin-top:8px">
      ${simsAtivas.slice(0,3).map(s => {
        const fv = v => v >= 1e6 ? 'R$ '+(v/1e6).toFixed(1)+'M' : v >= 1e3 ? 'R$ '+Math.round(v/1e3)+'k' : v ? 'R$ '+Number(v).toLocaleString('pt-BR') : '—';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--bg);border-radius:7px;margin-bottom:5px;font-size:12px">
          <span style="font-weight:600;color:var(--primary)">${_esc(s.titulo || s.codigo || 'Cotação')}</span>
          <span style="font-weight:700;color:var(--accent)">${fv(s.credito)}</span>
        </div>`;
      }).join('')}
      ${simsAtivas.length > 3 ? `<div style="font-size:11px;color:var(--muted);text-align:center;padding:4px">+${simsAtivas.length-3} cotaç${simsAtivas.length-3===1?'ão':'ões'} — ver aba Cotações</div>` : ''}
    </div>` : ''}` : emptyState('Intenção de crédito não preenchida — vá à aba Histórico para preencher');

  const conteudoFamiliar = hasFamiliar ? `
    <div class="cl-info-grid">
      ${infoItem('Estado Civil',    v(lead.estadoCivil))}
      ${infoItem('Profissão',       v(lead.profissao))}
      ${infoItem('Empresa',         v(lead.empresa))}
      ${infoItem('Tempo Atividade', v(lead.tempoAtividade))}
      ${infoItem('Cônjuge',         v(lead.conjuge))}
      ${infoItem('Renda Cônjuge',   vGreen(lead.rendaConjuge))}
      ${infoItem('Dependentes',     lead.dependentes !== undefined && lead.dependentes !== '' && lead.dependentes !== null ? v(lead.dependentes) : v(''))}
      ${infoItem('Cidade / UF',     lead.cidade ? v(lead.cidade + (lead.estado ? ' / ' + lead.estado : '')) : v(''))}
    </div>
    ${(lead.consorciado && lead.consorciado !== 'Não') ? `
    <div style="margin-top:10px;background:var(--bg);border-radius:8px;padding:10px 12px">
      <div class="cl-info-lbl">Histórico em Consórcio</div>
      <div style="font-size:12px;font-weight:700;color:var(--primary);margin-top:3px">${_esc(lead.consorciado)}</div>
      ${lead.consorcioDet ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">${_esc(lead.consorcioDet)}</div>` : ''}
    </div>` : ''}` : emptyState('Dados pessoais e profissionais não preenchidos');

  const conteudoImovel = hasImovel ? `
    ${lead.valorImovel ? `<div style="font-size:24px;font-weight:900;color:var(--primary);margin-bottom:6px">${fmtValor(lead.valorImovel)}</div>` : ''}
    <div style="font-size:12px;color:var(--muted);margin-bottom:8px">
      ${[lead.tipoImovel, lead.donoImovel].filter(Boolean).map(_esc).join(' · ')}
    </div>
    ${lead.imovelEndereco ? `<div style="font-size:11px;color:var(--muted);margin-bottom:8px"><i class="bi bi-geo-alt"></i> ${_esc(lead.imovelEndereco)}</div>` : ''}
    <div style="display:flex;gap:5px;flex-wrap:wrap">
      ${lead.imovelAlugado === 'Sim' ? '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:#fffbeb;color:#d97706;border:1px solid #fcd34d">Alugado</span>' : ''}
      ${lead.imovelDebitos === 'Sim' ? '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:#fee2e2;color:#ef4444;border:1px solid #fca5a5">Débitos</span>' : ''}
      ${lead.imovelFinanciado ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe" title="${_esc(lead.imovelFinanciado)}">Financiado</span>` : ''}
      ${lead.imovelVagas > 0 ? `<span style="font-size:10px;font-weight:600;color:var(--muted)">${lead.imovelVagas} vaga${lead.imovelVagas!==1?'s':''}</span>` : ''}
    </div>` : emptyState('Dados do imóvel não preenchidos');

  const conteudoVeiculo = hasVeiculo ? `
    ${lead.valorVeiculo ? `<div style="font-size:24px;font-weight:900;color:var(--primary);margin-bottom:6px">${fmtValor(lead.valorVeiculo)}</div>` : ''}
    <div style="font-size:12px;color:var(--muted);margin-bottom:4px">
      ${[lead.tipoVeiculo, lead.modeloVeiculo, lead.anoVeiculo ? String(lead.anoVeiculo) : ''].filter(Boolean).map(_esc).join(' · ')}
      ${lead.donoVeiculo ? ' · ' + _esc(lead.donoVeiculo) : ''}
    </div>
    ${lead.placaVeiculo ? `<div style="font-size:12px;font-weight:700;font-family:monospace;color:var(--muted);margin-bottom:8px">${_esc(lead.placaVeiculo)}</div>` : ''}
    <div style="display:flex;gap:5px;flex-wrap:wrap">
      ${lead.veiculoDebitos === 'Sim' ? '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:#fee2e2;color:#ef4444;border:1px solid #fca5a5">Débitos</span>' : ''}
      ${lead.veiculoFinanciado ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe" title="${_esc(lead.veiculoFinanciado)}">Financiado</span>` : ''}
    </div>` : emptyState('Dados do veículo não preenchidos');

  return `
    <!-- ══ SCORECARD ══ -->
    <div class="cl-score-grid" style="margin-bottom:16px">
      <div class="cl-score-card">
        <div class="cl-score-ico" style="background:#c8920a18;color:var(--accent)"><i class="bi bi-safe2-fill"></i></div>
        <div class="cl-score-val">${patrimonioTotal > 0 ? fmtValor(patrimonioTotal) : '—'}</div>
        <div class="cl-score-lbl">Patrimônio</div>
      </div>
      <div class="cl-score-card">
        <div class="cl-score-ico" style="background:#dcfce7;color:#16a34a"><i class="bi bi-cash-coin"></i></div>
        <div class="cl-score-val">${rendaTotal > 0 ? fmtValor(rendaTotal) : '—'}</div>
        <div class="cl-score-lbl">Renda Total</div>
      </div>
      <div class="cl-score-card">
        <div class="cl-score-ico" style="background:#ede9fe;color:#7c3aed"><i class="bi bi-trophy-fill"></i></div>
        <div class="cl-score-val">${capacidadeLance > 0 ? fmtValor(capacidadeLance) : '—'}</div>
        <div class="cl-score-lbl">Cap. de Lance</div>
      </div>
      <div class="cl-score-card" style="cursor:pointer" onclick="openModalEditarTab(${id},'financeiro')" title="Clique para preencher situação de crédito">
        <div class="cl-score-ico" style="background:${creditoColor}18;color:${creditoColor}"><i class="bi ${creditoIcon}"></i></div>
        <div class="cl-score-val" style="font-size:13px;color:${creditoColor}">${creditoLabel}</div>
        <div class="cl-score-lbl">Situação CPF</div>
      </div>
    </div>

    <!-- ══ PERFIL FINANCEIRO ══ -->
    ${secCard('bi-cash-stack', '#16a34a', 'Renda & Crédito', 'financeiro', conteudoFinanceiro, !hasFinanceiro)}

    <!-- ══ INTENÇÃO + COTAÇÕES ══ -->
    ${secCard('bi-bullseye', 'var(--accent)', 'Intenção & Cotações', 'consorcio', conteudoConsorcio, !hasConsorcio && simsAtivas.length === 0)}

    <!-- ══ DADOS PESSOAIS / FAMILIAR ══ -->
    ${secCard('bi-person-vcard-fill', '#7c3aed', 'Dados Pessoais & Família', 'financeiro', conteudoFamiliar, !hasFamiliar)}

    <!-- ══ PATRIMÔNIO ══ -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      ${secCard('bi-house-fill', 'var(--accent)', 'Imóvel', 'patrimonio', conteudoImovel, !hasImovel)}
      ${secCard('bi-car-front-fill', 'var(--accent)', 'Veículo', 'patrimonio', conteudoVeiculo, !hasVeiculo)}
    </div>

    <!-- ══ OBSERVAÇÕES ══ -->
    <div class="cl-info-card" style="${!lead.obs ? 'border-style:dashed;opacity:.85' : ''}">
      <div class="cl-info-card-title" style="justify-content:space-between">
        <span><i class="bi bi-chat-left-text-fill" style="color:var(--muted)"></i> Observações do Vendedor</span>
        <button onclick="openModalEditarTab(${id},'crm')"
                style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:white;color:var(--muted);cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:4px"
                onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
                onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--muted)'">
          <i class="bi bi-pencil-fill"></i> ${lead.obs ? 'Editar' : 'Preencher'}
        </button>
      </div>
      ${lead.obs
        ? `<div style="font-size:13px;color:var(--text);line-height:1.6;white-space:pre-wrap">${_esc(lead.obs)}</div>`
        : emptyState('Sem observações registradas')}
    </div>

    <!-- ══ PRÓXIMA REUNIÃO ══ -->
    ${proxReun ? `
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:800;color:#d97706;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px"><i class="bi bi-calendar-check-fill"></i> Próxima Reunião</div>
      <div style="font-size:14px;font-weight:700;color:#111b21;margin-bottom:3px">${_esc(proxReun.titulo)}</div>
      <div style="font-size:12px;color:#78716c">${new Date(proxReun.data+'T00:00:00').toLocaleDateString('pt-BR')} às ${proxReun.hora} · ${proxReun.tipo==='online'?'<i class="bi bi-camera-video-fill"></i> Online':'<i class="bi bi-geo-alt-fill"></i> Presencial'}</div>
      ${proxReun.meetLink?`<a href="${_esc(proxReun.meetLink)}" target="_blank" class="btn btn-sm btn-outline" style="margin-top:8px;color:#4285f4;border-color:#4285f4;font-size:12px"><i class="bi bi-camera-video-fill"></i> Entrar no Meet</a>`:''}
    </div>` : ''}

    <!-- ══ COTA VINCULADA ══ -->
    ${_clCotaVinculada(lead, id)}

    <!-- ══ EMAIL WIDGET ══ -->
    <div id="clEmailWidget_${id}">
      <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px"><i class="bi bi-envelope-fill"></i> E-mails Recentes</div>
      <div style="font-size:12px;color:var(--muted)">${lead.email ? 'Carregando...' : 'Sem e-mail cadastrado.'}</div>
    </div>
  `;
}

/* ─────────────────────────────────────────────
   PANE: SIMULAÇÕES / PRÉ-PROPOSTAS
───────────────────────────────────────────── */
function _clPaneCotacoes(lead, id) {
  const sims = lead.simulacoes || [];

  const fmtV = v => {
    if (!v) return '—';
    if (v >= 1e6) return 'R$ '+(v/1e6).toFixed(1)+'M';
    if (v >= 1e3) return 'R$ '+Math.round(v/1e3)+'k';
    return 'R$ '+Number(v).toLocaleString('pt-BR');
  };

  const statusColor = s => s==='pre-proposta' ? '#7c3aed' : s==='proposta' ? '#0891b2' : '#6b7280';
  const statusLabel = s => s==='pre-proposta' ? 'Pré-Proposta' : s==='proposta' ? 'Proposta' : s||'Cotação';

  if (sims.length === 0) {
    return `
      <div style="text-align:center;padding:40px 20px;color:var(--muted)">
        <i class="bi bi-calculator" style="font-size:40px;opacity:.25;display:block;margin-bottom:12px"></i>
        <div style="font-size:14px;font-weight:700;margin-bottom:6px">Nenhuma cotação vinculada</div>
        <div style="font-size:12px">Faça uma simulação no Simulador e salve para gerar uma cotação.</div>
      </div>`;
  }

  return `
    <div style="display:flex;flex-direction:column;gap:12px">
      ${sims.map((sim, idx) => {
        const sc = statusColor(sim.status);
        const sl = statusLabel(sim.status);
        const dt = sim.criadoEm ? new Date(sim.criadoEm).toLocaleDateString('pt-BR') : '—';
        const isPreProp = sim.status === 'pre-proposta';
        return `
          <div style="border:1px solid var(--border);border-left:4px solid ${sc};border-radius:10px;padding:14px 16px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
              <div>
                <div style="font-size:14px;font-weight:800;color:var(--primary)">${fmtV(sim.credito)}</div>
                <div style="font-size:11px;color:var(--muted)">Grupo ${sim.grupo||'—'} · ${dt}</div>
              </div>
              <span style="font-size:10px;font-weight:700;background:${sc}22;color:${sc};padding:3px 9px;border-radius:8px">${sl}</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
              <div style="background:var(--bg);border-radius:8px;padding:8px">
                <div style="font-size:9px;color:var(--muted);font-weight:700;text-transform:uppercase">Parcela/mês</div>
                <div style="font-size:13px;font-weight:800;color:var(--primary)">${fmtV(sim.parcela)}</div>
              </div>
              <div style="background:var(--bg);border-radius:8px;padding:8px">
                <div style="font-size:9px;color:var(--muted);font-weight:700;text-transform:uppercase">Lance Total</div>
                <div style="font-size:13px;font-weight:800;color:var(--accent)">${fmtV(sim.lanceTotal)}</div>
              </div>
              <div style="background:var(--bg);border-radius:8px;padding:8px">
                <div style="font-size:9px;color:var(--muted);font-weight:700;text-transform:uppercase">Contempl.</div>
                <div style="font-size:13px;font-weight:800;color:var(--primary)">Mês ${sim.mesContempl||'—'}</div>
              </div>
            </div>
            ${sim.objetivo ? `<div style="font-size:11px;color:var(--muted);margin-bottom:10px"><i class="bi bi-geo-alt-fill"></i> Objetivo: ${sim.objetivo}</div>` : ''}
            <div style="display:flex;gap:6px">
              ${isPreProp ? `
                <button class="btn btn-sm" style="background:#ede9fe;color:#7c3aed;border:none;font-size:12px"
                  onclick="_clConverterSimProposta(${id},'${sim.id}')">
                  <i class="bi bi-arrow-right-circle-fill"></i> Converter em Proposta
                </button>` : ''}
              <button class="btn btn-ghost btn-sm" style="font-size:11px;color:#ef4444"
                onclick="_clRemoverSimulacao(${id},'${sim.id}')">
                <i class="bi bi-trash3"></i>
              </button>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

function _clConverterSimProposta(leadId, simId) {
  if (typeof _propConverterPreProposta === 'function') {
    _propConverterPreProposta(leadId, simId);
    const lead = storeGet().find(l => l.id === leadId);
    if (lead) _clRenderPerfil(lead);
    if (typeof showToast === 'function') showToast('Pré-proposta convertida em Proposta ✓');
  } else {
    alert('Abra a tela de Propostas para converter.');
  }
}

function _clRemoverSimulacao(leadId, simId) {
  if (!confirm('Remover esta simulação do perfil?')) return;
  const leads = JSON.parse(localStorage.getItem('crm_leads') || '[]');
  const lead  = leads.find(l => String(l.id) === String(leadId));
  if (!lead) return;
  lead.simulacoes = (lead.simulacoes || []).filter(s => s.id !== simId);
  lead.atualizadoEm = new Date().toISOString();
  localStorage.setItem('crm_leads', JSON.stringify(leads));
  const updated = storeGet().find(l => String(l.id) === String(leadId));
  if (updated) { _clRenderPerfil(updated); _clToggleTab('cotacoes'); }
}

/* ─────────────────────────────────────────────
   PANE: ATIVIDADE (unified timeline)
───────────────────────────────────────────── */
function _clPaneAtividade(lead, id) {
  const historico = (lead.historico || []).map(h => ({ ...h, _tipo: 'hist' }));
  const notas     = (lead.notas     || []).map(n => ({ ...n, _tipo: 'nota', data: n.criadoEm }));
  const todos     = [...historico, ...notas].sort((a, b) => new Date(b.data) - new Date(a.data));

  const renderItem = item => {
    if (item._tipo === 'hist') {
      return `
        <div style="display:flex;gap:12px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="width:8px;height:8px;border-radius:50%;background:var(--primary);flex-shrink:0;margin-top:5px"></div>
          <div style="flex:1">
            <div style="font-size:13px;color:var(--text)">${_esc(item.texto)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${new Date(item.data).toLocaleString('pt-BR')}</div>
          </div>
        </div>`;
    }
    /* nota */
    const isWpp   = (item.texto||'').startsWith('[Chat WPP]');
    const isEmail = (item.texto||'').startsWith('[E-mail]');
    const noteIcon = isWpp
      ? `<i class="bi bi-whatsapp" style="color:#25d366;font-size:14px"></i>`
      : isEmail
        ? `<i class="bi bi-envelope-fill" style="color:#6366f1;font-size:13px"></i>`
        : `<i class="bi bi-sticky-fill" style="color:#f59e0b;font-size:13px"></i>`;
    return `
      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 12px;margin:6px 0">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="display:flex;gap:8px;align-items:flex-start">
            ${noteIcon}
            <div style="font-size:13px;color:var(--text);white-space:pre-wrap;word-break:break-word">${_esc(item.texto)}</div>
          </div>
          <button onclick="leadRemoveTag&&(()=>{})();_clRemoveNota(${id},'${item.id}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:12px;padding:0;flex-shrink:0" title="Excluir nota">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">${new Date(item.data).toLocaleString('pt-BR')}</div>
      </div>`;
  };

  // Conversas Salvas section
  const conversasSalvas = lead.conversasSalvas || [];
  const renderConversa = conv => {
    const msgs = conv.mensagens || [];
    const preview = msgs.slice(0, 3).map(m => {
      const who  = m.fromMe ? '<span style="color:#15803d;font-weight:700">Eu</span>' : `<span style="color:#1a3a5c;font-weight:700">${_esc(conv.chatName||'Contato')}</span>`;
      const body = _esc((m.body||'').slice(0, 80)) + ((m.body||'').length > 80 ? '...' : '');
      return `<div style="font-size:12px;color:#374151;padding:3px 0;border-bottom:1px solid #f0f0f0;display:flex;gap:6px">
        <span style="flex-shrink:0">${who}:</span>
        <span style="color:#6b7280;word-break:break-word">${body || '<em style="color:#aaa">mídia</em>'}</span>
      </div>`;
    }).join('');
    return `
      <div style="background:white;border:1px solid #e9edef;border-radius:10px;margin-bottom:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06)">
        <div style="background:#f0f2f5;padding:8px 12px;display:flex;justify-content:space-between;align-items:center">
          <div style="display:flex;align-items:center;gap:8px">
            <i class="bi bi-whatsapp" style="color:#25d366;font-size:14px"></i>
            <span style="font-size:12px;font-weight:700;color:#1a3a5c">${_esc(conv.chatName||'WhatsApp')}</span>
            <span style="font-size:11px;color:#667781">${msgs.length} msg${msgs.length!==1?'s':''}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:10px;color:#667781">${new Date(conv.criadoEm).toLocaleDateString('pt-BR')}</span>
            <button onclick="_clRemoveConversaSalva(${id},${conv.id})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;padding:0;line-height:1" title="Excluir"><i class="bi bi-trash3"></i></button>
          </div>
        </div>
        <div style="padding:8px 12px">
          ${preview}
          ${msgs.length > 3 ? `<div style="font-size:11px;color:#667781;margin-top:4px">+ ${msgs.length-3} mensagem(ns) a mais</div>` : ''}
          ${conv.nota ? `<div style="font-size:11px;color:#6366f1;margin-top:6px;font-style:italic"><i class="bi bi-info-circle"></i> ${_esc(conv.nota)}</div>` : ''}
        </div>
      </div>`;
  };

  return `
    <!-- Quick note input -->
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <input id="clAtivNoteInput" class="form-input" placeholder="Adicionar anotação rápida..." style="flex:1;font-size:13px" onkeydown="if(event.key==='Enter')_clSalvarNotaInline(${id},'clAtivNoteInput')" />
      <button class="btn btn-primary btn-sm" onclick="_clSalvarNotaInline(${id},'clAtivNoteInput')"><i class="bi bi-plus-lg"></i></button>
    </div>
    ${todos.length === 0
      ? `<div style="text-align:center;padding:32px;color:var(--muted);font-size:13px"><i class="bi bi-clock-history" style="font-size:32px;opacity:.3;display:block;margin-bottom:8px"></i>Nenhuma atividade registrada.</div>`
      : todos.map(renderItem).join('')}

    <!-- Conversas Salvas -->
    ${conversasSalvas.length > 0 ? `
    <div style="margin-top:20px;padding-top:16px;border-top:2px solid #e9edef">
      <div style="font-size:12px;font-weight:700;color:#1a3a5c;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;display:flex;align-items:center;gap:6px">
        <i class="bi bi-chat-square-text-fill" style="color:#25d366"></i> Conversas Salvas (${conversasSalvas.length})
      </div>
      ${conversasSalvas.map(renderConversa).join('')}
    </div>` : ''}
  `;
}

/* ─────────────────────────────────────────────
   PANE: REUNIÕES
───────────────────────────────────────────── */
function _clPaneReunioes(lead, id, reunioes) {
  const renderReuniao = r => {
    const stColor  = r.status==='realizada'?'#16a34a':r.status==='cancelada'?'#ef4444':'#f59e0b';
    const stBg     = r.status==='realizada'?'#dcfce7':r.status==='cancelada'?'#fee2e2':'#fffbeb';
    const stLabel  = r.status==='realizada'?'Realizada':r.status==='cancelada'?'Cancelada':'Agendada';
    return `
      <div style="background:${stBg};border:1px solid ${stColor}44;border-radius:10px;padding:12px 14px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">
          <div style="font-size:13px;font-weight:700;color:#111b21">${_esc(r.titulo)}</div>
          <span style="font-size:10px;background:${stColor}22;color:${stColor};padding:3px 9px;border-radius:10px;font-weight:700;flex-shrink:0">${stLabel}</span>
        </div>
        <div style="font-size:12px;color:#78716c;margin-bottom:6px">
          ${r.data?new Date(r.data+'T00:00:00').toLocaleDateString('pt-BR'):''} ${r.hora?'às '+r.hora:''} ·
          ${r.tipo==='online'?'<i class="bi bi-camera-video-fill"></i> Online':'<i class="bi bi-geo-alt-fill"></i> Presencial'}
        </div>
        ${r.meetLink?`<a href="${_esc(r.meetLink)}" target="_blank" style="font-size:12px;color:#4285f4;text-decoration:none"><i class="bi bi-camera-video-fill"></i> Entrar no Meet →</a>`:''}
        ${r.status==='agendada'?`
        <div style="display:flex;gap:6px;margin-top:8px">
          <button onclick="_clMarcarRealizada('${r.id}')" class="btn btn-sm" style="background:#16a34a;color:white;border:none;font-size:11px"><i class="bi bi-check-circle-fill"></i> Realizada</button>
          <button onclick="_clMarcarCancelada('${r.id}')" class="btn btn-sm" style="background:#ef4444;color:white;border:none;font-size:11px"><i class="bi bi-x-circle-fill"></i> Cancelar</button>
        </div>`:''}
      </div>`;
  };

  return `
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn btn-outline btn-sm" onclick="_clAgendar(${id},'online')"><i class="bi bi-camera-video-fill"></i> Online</button>
      <button class="btn btn-outline btn-sm" onclick="_clAgendar(${id},'presencial')"><i class="bi bi-geo-alt-fill"></i> Presencial</button>
    </div>
    ${reunioes.length === 0
      ? `<div style="text-align:center;padding:32px;color:var(--muted);font-size:13px"><i class="bi bi-calendar-x" style="font-size:32px;opacity:.3;display:block;margin-bottom:8px"></i>Nenhuma reunião registrada.</div>`
      : reunioes.map(renderReuniao).join('')}
  `;
}

/* ─────────────────────────────────────────────
   PANE: ANOTAÇÕES
───────────────────────────────────────────── */
function _clPaneAnotacoes(lead, id) {
  const notas = (lead.notas || []).slice().sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));

  const renderNota = n => {
    const isWpp   = (n.texto||'').startsWith('[Chat WPP]');
    const isEmail = (n.texto||'').startsWith('[E-mail]');
    const noteIcon = isWpp
      ? `<i class="bi bi-whatsapp" style="color:#25d366;font-size:14px"></i>`
      : isEmail
        ? `<i class="bi bi-envelope-fill" style="color:#6366f1;font-size:13px"></i>`
        : `<i class="bi bi-sticky-fill" style="color:#f59e0b;font-size:13px"></i>`;
    return `
      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px">
          <div style="display:flex;gap:8px;align-items:flex-start">
            ${noteIcon}
            <div style="font-size:13px;color:var(--text);white-space:pre-wrap;word-break:break-word">${_esc(n.texto)}</div>
          </div>
          <button onclick="_clRemoveNota(${id},'${n.id}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:12px;padding:0;flex-shrink:0" title="Excluir">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
        <div style="font-size:11px;color:var(--muted)">${new Date(n.criadoEm).toLocaleString('pt-BR')}</div>
      </div>`;
  };

  return `
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <input id="clNoteInput" class="form-input" placeholder="Adicionar nota..." style="flex:1;font-size:13px"
        onkeydown="if(event.key==='Enter')_clSalvarNotaInline(${id},'clNoteInput')" />
      <button class="btn btn-primary btn-sm" onclick="_clSalvarNotaInline(${id},'clNoteInput')"><i class="bi bi-plus-lg"></i></button>
    </div>
    ${notas.length === 0
      ? `<div style="text-align:center;padding:32px;color:var(--muted);font-size:13px"><i class="bi bi-sticky" style="font-size:32px;opacity:.3;display:block;margin-bottom:8px"></i>Nenhuma nota ainda.</div>`
      : notas.map(renderNota).join('')}
  `;
}

/* ─────────────────────────────────────────────
   COTA VINCULADA
───────────────────────────────────────────── */
function _clCotaVinculada(lead, id) {
  if (!lead.cotaVinculada) {
    return `
      <div style="margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Carta Contemplada</div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:12px;color:var(--muted)">Nenhuma carta vinculada.</span>
          <button class="btn btn-outline btn-sm" style="font-size:12px" onclick="_clClosePerfil();navigate('contemplados',document.querySelector('[data-page=contemplados]'))">
            <i class="bi bi-link-45deg"></i> Vincular
          </button>
        </div>
      </div>`;
  }
  const c = lead.cotaVinculada;
  return `
    <div style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Carta Contemplada</div>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 14px">
        <div style="font-size:14px;font-weight:800;color:var(--primary)">${_esc(c.cod)} — ${_esc(c.credito)}</div>
        <div style="font-size:11px;color:var(--muted)">Grupo ${_esc(c.grupo)} · ${_esc(c.categoria)}</div>
      </div>
    </div>`;
}

/* ─────────────────────────────────────────────
   STAGE MOVE
───────────────────────────────────────────── */
function _clMoverStage(id, stage) {
  leadMoveStage(id, stage);
  _clRefreshLista();
  const lead = storeGet().find(l => l.id === id);
  if (lead) _clRenderPerfil(lead);
}

/* ─────────────────────────────────────────────
   EDITAR
───────────────────────────────────────────── */
function _clEditarLead(id) {
  _clClosePerfil();
  openModalEditar(id);
}

/* ─────────────────────────────────────────────
   DELETE LEAD
───────────────────────────────────────────── */
function _clDeleteLead(id) {
  const lead = storeGet().find(l => l.id === id);
  if (!lead) return;
  if (!confirm(`Excluir permanentemente "${lead.nome}"? Esta ação não pode ser desfeita.`)) return;
  leadDelete(id);
  _clClosePerfil();
  _clRefreshLista();
}

/* ─────────────────────────────────────────────
   NOTA — inline (panel)
───────────────────────────────────────────── */
function _clSalvarNotaInline(id, inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const texto = input.value.trim();
  if (!texto) return;
  leadAddNota(id, texto);
  leadAddHistorico(id, 'Nota: ' + texto.slice(0, 60));
  input.value = '';
  const lead = storeGet().find(l => l.id === id);
  if (lead) { _clRenderPerfil(lead); _clToggleTab(CL.perfilTab); }
}

function _clRemoveNota(leadId, notaId) {
  const lead = storeGet().find(l => l.id === leadId);
  if (!lead || !lead.notas) return;
  lead.notas = lead.notas.filter(n => n.id !== notaId);
  leadUpdate(leadId, { notas: lead.notas });
  const updated = storeGet().find(l => l.id === leadId);
  if (updated) { _clRenderPerfil(updated); _clToggleTab(CL.perfilTab); }
}

function _clRemoveConversaSalva(leadId, convId) {
  if (typeof leadRemoveConversaSalva === 'function') leadRemoveConversaSalva(leadId, convId);
  const updated = storeGet().find(l => l.id === leadId);
  if (updated) { _clRenderPerfil(updated); _clToggleTab(CL.perfilTab); }
}

/* ─────────────────────────────────────────────
   NOTA — legacy modal (keep for external calls)
───────────────────────────────────────────── */
function _clNota(id) {
  const lead = storeGet().find(l => l.id === id);
  if (!lead) return;
  const existing = document.getElementById('clNotaModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'clNotaModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:4000;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:white;border-radius:14px;padding:24px;width:100%;max-width:420px;box-shadow:0 8px 40px rgba(0,0,0,.2)">
      <div style="font-size:15px;font-weight:800;color:var(--primary);margin-bottom:12px"><i class="bi bi-sticky-fill"></i> Adicionar Nota</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">Lead: <strong>${_esc(lead.nome)}</strong></div>
      <textarea id="clNotaTexto" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px;resize:none;min-height:90px;outline:none;font-family:inherit;box-sizing:border-box" placeholder="Digite a nota..."></textarea>
      <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('clNotaModal').remove()">Cancelar</button>
        <button class="btn btn-primary btn-sm" onclick="_clSalvarNota(${id})">Salvar</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('clNotaTexto')?.focus(), 50);
}

function _clSalvarNota(id) {
  const texto = document.getElementById('clNotaTexto')?.value.trim();
  if (!texto) return;
  leadAddNota(id, texto);
  leadAddHistorico(id, 'Nota: ' + texto.slice(0, 60));
  document.getElementById('clNotaModal')?.remove();
  const lead = storeGet().find(l => l.id === id);
  if (lead) { _clRenderPerfil(lead); _clToggleTab(CL.perfilTab); }
}

/* ─────────────────────────────────────────────
   AGENDAR REUNIÃO (floating form)
───────────────────────────────────────────── */
function _clAgendar(leadId, tipoInicial) {
  const lead = storeGet().find(l => l.id === leadId);
  if (!lead) return;
  document.getElementById('clAgendaFloat')?.remove();

  const hoje   = new Date().toISOString().slice(0, 10);
  const chatId = typeof _wppGetLinkedChatId === 'function' ? _wppGetLinkedChatId(leadId) : null;

  const el = document.createElement('div');
  el.id = 'clAgendaFloat';
  el.style.cssText = 'position:fixed;top:80px;right:24px;width:340px;background:white;border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,0.22);z-index:6000;overflow:hidden;border:1px solid #e9edef';

  el.innerHTML = `
    <div id="clAgDragHandle" style="background:#1a3a5c;padding:11px 14px;display:flex;align-items:center;gap:8px;cursor:move;user-select:none">
      <i class="bi bi-calendar-plus" style="color:#93c5fd;font-size:15px"></i>
      <span style="color:white;font-size:13px;font-weight:800;flex:1">Agendar Reunião</span>
      <button onclick="document.getElementById('clAgendaFloat').remove()" style="background:rgba(255,255,255,0.15);border:none;border-radius:6px;color:white;cursor:pointer;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:14px">✕</button>
    </div>
    <div style="padding:14px">
      <div style="font-size:12px;color:#667781;margin-bottom:12px">Lead: <strong style="color:#111b21">${_esc(lead.nome)}</strong></div>

      <div style="display:flex;gap:8px;margin-bottom:14px">
        <button id="clAgBtnOnline" onclick="_clAgSetTipo('online')" style="flex:1;padding:9px 6px;border:2px solid #6366f1;border-radius:8px;background:#6366f112;color:#6366f1;font-size:12px;font-weight:700;cursor:pointer"><i class="bi bi-camera-video-fill"></i> Online</button>
        <button id="clAgBtnPresencial" onclick="_clAgSetTipo('presencial')" style="flex:1;padding:9px 6px;border:2px solid #e9edef;border-radius:8px;background:white;color:#667781;font-size:12px;font-weight:700;cursor:pointer"><i class="bi bi-geo-alt-fill"></i> Presencial</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
        <div>
          <label style="font-size:11px;font-weight:700;color:#667781;display:block;margin-bottom:3px">Título</label>
          <input id="clAgTitulo" style="width:100%;border:1px solid #e9edef;border-radius:8px;padding:8px 10px;font-size:13px;outline:none;font-family:inherit;box-sizing:border-box" value="Reunião com ${_esc(lead.nome)}" />
        </div>
        <div style="display:flex;gap:8px">
          <div style="flex:1">
            <label style="font-size:11px;font-weight:700;color:#667781;display:block;margin-bottom:3px">Data</label>
            <input id="clAgData" type="date" style="width:100%;border:1px solid #e9edef;border-radius:8px;padding:8px 10px;font-size:13px;outline:none;box-sizing:border-box" value="${hoje}" />
          </div>
          <div style="flex:1">
            <label style="font-size:11px;font-weight:700;color:#667781;display:block;margin-bottom:3px">Hora</label>
            <input id="clAgHora" type="time" style="width:100%;border:1px solid #e9edef;border-radius:8px;padding:8px 10px;font-size:13px;outline:none;box-sizing:border-box" value="09:00" />
          </div>
        </div>
      </div>

      <div style="background:#f8fafc;border-radius:10px;padding:10px 12px;border:1px solid #e9edef;margin-bottom:14px">
        <div style="font-size:11px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Enviar confirmação</div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#374151;margin-bottom:6px">
          <input type="checkbox" id="clAgSendWpp" ${chatId?'checked':'disabled'} style="width:14px;height:14px;accent-color:#25d366" />
          <i class="bi bi-whatsapp" style="color:#25d366;font-size:14px"></i>
          WhatsApp ${chatId?'':'<span style="color:#9ca3af;font-size:10px">(sem conversa)</span>'}
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#374151">
          <input type="checkbox" id="clAgSendEmail" ${lead.email?'':'disabled'} style="width:14px;height:14px;accent-color:#6366f1" />
          <i class="bi bi-envelope-fill" style="color:#6366f1;font-size:13px"></i>
          E-mail ${lead.email?'('+_esc(lead.email)+')':'<span style="color:#9ca3af;font-size:10px">(sem e-mail)</span>'}
        </label>
      </div>

      <div style="display:flex;gap:8px">
        <button onclick="document.getElementById('clAgendaFloat').remove()" style="flex:1;padding:9px;border:1px solid #e9edef;border-radius:8px;background:white;color:#667781;font-size:13px;cursor:pointer">Cancelar</button>
        <button onclick="_clSalvarAgendamento(${leadId})" style="flex:1;padding:9px;border:none;border-radius:8px;background:#1a3a5c;color:white;font-size:13px;font-weight:800;cursor:pointer">Salvar</button>
      </div>
    </div>
  `;

  document.body.appendChild(el);

  /* Drag */
  const handle = document.getElementById('clAgDragHandle');
  if (handle) {
    let sx, sy, sl, st;
    handle.addEventListener('mousedown', e => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; sl = r.left; st = r.top;
      el.style.right = 'auto';
      el.style.left = sl + 'px'; el.style.top = st + 'px';
      const mv = e2 => {
        el.style.left = Math.max(0, Math.min(window.innerWidth  - el.offsetWidth,  sl + e2.clientX - sx)) + 'px';
        el.style.top  = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, st + e2.clientY - sy)) + 'px';
      };
      const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
  }

  if (tipoInicial) _clAgSetTipo(tipoInicial);
}

function _clAgSetTipo(tipo) {
  window._clAgTipoSel = tipo;
  const onB = document.getElementById('clAgBtnOnline');
  const prB = document.getElementById('clAgBtnPresencial');
  if (!onB || !prB) return;
  if (tipo === 'online') {
    onB.style.border = '2px solid #6366f1'; onB.style.background = '#6366f112'; onB.style.color = '#6366f1';
    prB.style.border = '2px solid #e9edef'; prB.style.background = 'white';     prB.style.color = '#667781';
  } else {
    prB.style.border = '2px solid #f59e0b'; prB.style.background = '#f59e0b12'; prB.style.color = '#d97706';
    onB.style.border = '2px solid #e9edef'; onB.style.background = 'white';     onB.style.color = '#667781';
  }
}

function _clSalvarAgendamento(leadId) {
  const lead = storeGet().find(l => l.id === leadId);
  if (!lead) return;
  const titulo    = document.getElementById('clAgTitulo')?.value.trim();
  const data      = document.getElementById('clAgData')?.value;
  const hora      = document.getElementById('clAgHora')?.value;
  const tipo      = window._clAgTipoSel || 'online';
  const sendWpp   = document.getElementById('clAgSendWpp')?.checked;
  const sendEmail = document.getElementById('clAgSendEmail')?.checked;
  if (!titulo || !data) { alert('Preencha o título e a data'); return; }
  const reuniao = typeof rnCreate === 'function' ? rnCreate({ titulo, data, hora, tipo, leadId, leadNome: lead.nome }) : null;
  leadAddHistorico && leadAddHistorico(leadId, `Reunião ${tipo} agendada: ${titulo} em ${data}`);
  document.getElementById('clAgendaFloat')?.remove();
  if (sendWpp && reuniao && typeof _wppEnviarLinkReuniao === 'function') {
    const chatId = typeof _wppGetLinkedChatId === 'function' ? _wppGetLinkedChatId(leadId) : null;
    if (chatId) _wppEnviarLinkReuniao(chatId, reuniao);
  }
  _clRefreshLista();
  const updated = storeGet().find(l => l.id === leadId);
  if (updated) { _clRenderPerfil(updated); _clToggleTab('reunioes'); }
}

/* ─────────────────────────────────────────────
   MARCAR REUNIÃO
───────────────────────────────────────────── */
function _clMarcarRealizada(reuniaoId) {
  if (typeof rnUpdate === 'function') rnUpdate(reuniaoId, { status: 'realizada' });
  if (CL.perfilId) {
    const lead = storeGet().find(l => l.id === CL.perfilId);
    if (lead) { leadAddHistorico(CL.perfilId, 'Reunião marcada como realizada'); _clRenderPerfil(lead); _clToggleTab('reunioes'); }
  }
  _clRefreshLista();
}

function _clMarcarCancelada(reuniaoId) {
  if (typeof rnUpdate === 'function') rnUpdate(reuniaoId, { status: 'cancelada' });
  if (CL.perfilId) {
    const lead = storeGet().find(l => l.id === CL.perfilId);
    if (lead) { leadAddHistorico(CL.perfilId, 'Reunião cancelada'); _clRenderPerfil(lead); _clToggleTab('reunioes'); }
  }
  _clRefreshLista();
}

/* ─────────────────────────────────────────────
   TAG POPOVER
───────────────────────────────────────────── */
function _clAddTagPopover(leadId) {
  document.getElementById('clTagPopover')?.remove();
  const pop = document.createElement('div');
  pop.id = 'clTagPopover';
  pop.style.cssText = 'position:fixed;inset:0;z-index:7000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35)';
  pop.innerHTML = `
    <div style="background:white;border-radius:14px;padding:20px;width:300px;box-shadow:0 8px 40px rgba(0,0,0,.2)">
      <div style="font-size:14px;font-weight:800;color:var(--primary);margin-bottom:12px"><i class="bi bi-tag-fill"></i> Nova Etiqueta</div>
      <input id="clTagLabel" class="form-input" placeholder="Nome da etiqueta..." style="margin-bottom:10px;font-size:13px" maxlength="24" />
      <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:6px">Cor</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px">
        ${CL_TAG_COLORS.map(cor => `
          <div onclick="window._clTagCorSel='${cor}';document.querySelectorAll('.cl-tag-swatch').forEach(s=>s.style.outline='none');this.style.outline='3px solid #0d1f3c';this.style.outlineOffset='2px'"
            class="cl-tag-swatch"
            style="width:24px;height:24px;border-radius:50%;background:${cor};cursor:pointer;transition:transform .1s"
            onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></div>
        `).join('')}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('clTagPopover').remove()">Cancelar</button>
        <button class="btn btn-primary btn-sm" onclick="_clConfirmAddTag(${leadId})">Adicionar</button>
      </div>
    </div>`;
  pop.addEventListener('click', e => { if (e.target === pop) pop.remove(); });
  window._clTagCorSel = CL_TAG_COLORS[0];
  document.body.appendChild(pop);
  setTimeout(() => document.getElementById('clTagLabel')?.focus(), 30);
}

function _clConfirmAddTag(leadId) {
  const label = document.getElementById('clTagLabel')?.value.trim();
  const cor   = window._clTagCorSel || '#64748b';
  if (!label) { document.getElementById('clTagLabel')?.focus(); return; }
  leadAddTag(leadId, label, cor);
  document.getElementById('clTagPopover')?.remove();
  _clRefreshLista();
  const lead = storeGet().find(l => l.id === leadId);
  if (lead) { _clRenderPerfil(lead); _clToggleTab(CL.perfilTab); }
}

/* ─────────────────────────────────────────────
   WPP HELPERS
───────────────────────────────────────────── */
function _clOpenWppByPhone(leadId) {
  const lead = storeGet().find(l => l.id === leadId);
  if (!lead) return;
  const digits = (lead.telefone || '').replace(/\D/g, '');
  if (!digits) { typeof _wppToast === 'function' && _wppToast('Lead sem telefone cadastrado', 'error'); return; }

  if (typeof WPP === 'undefined' || WPP.status !== 'ready') {
    _clWppNaoConectadoFloat();
    return;
  }

  const numSemPais = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  const fullNum    = '55' + numSemPais;
  const found      = (WPP.chats || []).find(c => c.id && c.id.startsWith(fullNum));
  const chatId     = found ? found.id : fullNum + '@c.us';

  const links = JSON.parse(localStorage.getItem('crm_wpp_links') || '{}');
  if (!links[chatId]) {
    links[chatId] = leadId;
    localStorage.setItem('crm_wpp_links', JSON.stringify(links));
  }

  _clShowMiniChat(leadId, chatId);
}

function _clWppNaoConectadoFloat() {
  document.getElementById('clWppOfflineFloat')?.remove();
  const el = document.createElement('div');
  el.id = 'clWppOfflineFloat';
  el.style.cssText = 'position:fixed;bottom:24px;right:24px;width:320px;background:white;border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,0.2);z-index:5000;overflow:hidden;border:1px solid #e9edef';
  el.innerHTML = `
    <div style="background:#075e54;padding:10px 14px;display:flex;align-items:center;gap:8px">
      <i class="bi bi-whatsapp" style="color:#25d366;font-size:18px"></i>
      <span style="color:white;font-size:13px;font-weight:700;flex:1">WhatsApp</span>
      <button onclick="document.getElementById('clWppOfflineFloat').remove()" style="background:rgba(255,255,255,0.2);border:none;border-radius:6px;color:white;cursor:pointer;padding:3px 7px">✕</button>
    </div>
    <div style="padding:16px;text-align:center">
      <i class="bi bi-wifi-off" style="font-size:32px;color:#9ca3af;display:block;margin-bottom:8px"></i>
      <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:4px">WhatsApp não conectado</div>
      <div style="font-size:12px;color:#9ca3af;margin-bottom:14px">Conecte o WhatsApp na tela de Comunicação para iniciar conversas pelo sistema.</div>
      <button onclick="document.getElementById('clWppOfflineFloat').remove();navigate('comunicacao',document.querySelector('[data-page=comunicacao]'))" style="width:100%;padding:9px;border:none;border-radius:8px;background:#25d366;color:white;font-size:13px;font-weight:700;cursor:pointer"><i class="bi bi-whatsapp"></i> Ir para Comunicação</button>
    </div>`;
  document.body.appendChild(el);
}

function _clOpenWppChat(leadId) {
  if (typeof WPP === 'undefined' || WPP.status !== 'ready') {
    _clWppNaoConectadoFloat();
    return;
  }
  const chatId = typeof _wppGetLinkedChatId === 'function' ? _wppGetLinkedChatId(leadId) : null;
  if (!chatId) {
    if (confirm('Este lead não tem conversa WPP vinculada. Deseja vincular agora?')) {
      navigate('comunicacao', document.querySelector('[data-page=comunicacao]'));
      setTimeout(() => {
        _wppSwitchSidebar('leads');
        typeof _wppVincularLead === 'function' && _wppVincularLead(null, leadId);
      }, 400);
    }
    return;
  }
  _clShowMiniChat(leadId, chatId);
}

function _clShowMiniChat(leadId, chatId) {
  const lead = storeGet().find(l => l.id === leadId);
  if (!lead) return;
  document.getElementById('clMiniChat')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'clMiniChat';
  overlay.style.cssText = 'position:fixed;bottom:24px;right:24px;width:360px;height:520px;background:white;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.22);z-index:5000;display:flex;flex-direction:column;overflow:hidden;border:1px solid #e9edef';

  overlay.innerHTML = `
    <div data-drag style="background:#075e54;padding:10px 14px;display:flex;align-items:center;gap:10px;flex-shrink:0;cursor:move;user-select:none">
      <div style="width:36px;height:36px;border-radius:50%;background:#25d366;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;color:white;flex-shrink:0">${(lead.nome||'?')[0].toUpperCase()}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(lead.nome)}</div>
        <div style="font-size:11px;color:#a7f3d0">Chat WhatsApp</div>
      </div>
      <div style="display:flex;gap:4px">
        <button title="Abrir no WhatsApp completo" onclick="_clOpenWppFull('${_esc(chatId)}')" style="background:rgba(255,255,255,0.2);border:none;border-radius:6px;color:white;cursor:pointer;padding:4px 8px;font-size:11px"><i class="bi bi-box-arrow-up-right"></i></button>
        <button onclick="document.getElementById('clMiniChat').remove()" style="background:rgba(255,255,255,0.2);border:none;border-radius:6px;color:white;cursor:pointer;padding:4px 8px;font-size:11px"><i class="bi bi-x-lg"></i></button>
      </div>
    </div>
    <div id="clMiniMsgs" style="flex:1;overflow-y:auto;padding:8px 10px;background:#efeae2">
      <div style="text-align:center;padding:20px;color:#667781;font-size:12px">
        <div style="width:20px;height:20px;border:2px solid #25d366;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 8px"></div>
        Carregando mensagens...
      </div>
    </div>
    <div style="background:#f0f2f5;padding:6px 10px;display:flex;align-items:flex-end;gap:6px;flex-shrink:0">
      <textarea id="clMiniInput" style="flex:1;border:none;border-radius:8px;padding:7px 10px;font-size:13px;outline:none;resize:none;min-height:36px;max-height:80px;line-height:1.4;font-family:inherit;background:white;color:#111b21"
        placeholder="Mensagem..."
        oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,80)+'px'"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();_clMiniSend('${_esc(chatId)}')}"
      ></textarea>
      <button onclick="_clMiniSend('${_esc(chatId)}')" style="background:#25d366;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:white;flex-shrink:0">
        <i class="bi bi-send-fill" style="font-size:14px"></i>
      </button>
    </div>
  `;

  document.body.appendChild(overlay);
  _clMiniLoadMessages(chatId);

  /* Drag */
  const hdr = overlay.querySelector('[data-drag]');
  if (hdr) {
    let sx, sy, sl, st;
    hdr.addEventListener('mousedown', e => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      const r = overlay.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; sl = r.left; st = r.top;
      overlay.style.right = 'auto'; overlay.style.bottom = 'auto';
      overlay.style.left = sl + 'px'; overlay.style.top = st + 'px';
      const mv = e2 => {
        overlay.style.left = Math.max(0, Math.min(window.innerWidth  - overlay.offsetWidth,  sl + e2.clientX - sx)) + 'px';
        overlay.style.top  = Math.max(0, Math.min(window.innerHeight - overlay.offsetHeight, st + e2.clientY - sy)) + 'px';
      };
      const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
  }
}

async function _clMiniLoadMessages(chatId) {
  const msgsEl = document.getElementById('clMiniMsgs');
  if (!msgsEl) return;
  try {
    const res  = await fetch(`${WPP_BASE}/messages/${encodeURIComponent(chatId)}?limit=30`);
    const msgs = await res.json();
    if (!msgs.length) {
      msgsEl.innerHTML = `<div style="text-align:center;padding:20px;color:#667781;font-size:12px">Nenhuma mensagem ainda</div>`;
      return;
    }
    msgsEl.innerHTML = msgs.map(msg => {
      if (typeof _wppRenderMsg === 'function') return _wppRenderMsg(msg);
      const fromMe = msg.fromMe;
      const body   = msg.body || '';
      return `<div style="display:flex;justify-content:${fromMe?'flex-end':'flex-start'};margin:2px 0">
        <div style="max-width:75%;background:${fromMe?'#d9fdd3':'white'};border-radius:8px;padding:5px 8px 3px;box-shadow:0 1px 2px rgba(0,0,0,0.1)">
          <div style="font-size:13px;color:#111b21;white-space:pre-wrap;word-break:break-word">${_esc(body)}</div>
        </div>
      </div>`;
    }).join('');
    msgsEl.scrollTop = msgsEl.scrollHeight;
  } catch (e) {
    if (msgsEl) msgsEl.innerHTML = `<div style="text-align:center;padding:20px;color:#ef4444;font-size:12px">Erro ao carregar mensagens</div>`;
  }
}

async function _clMiniSend(chatId) {
  const input = document.getElementById('clMiniInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';
  const msgsEl = document.getElementById('clMiniMsgs');
  if (msgsEl) {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;justify-content:flex-end;margin:2px 0';
    div.innerHTML = `<div style="max-width:75%;background:#d9fdd3;border-radius:8px;padding:5px 8px 3px;box-shadow:0 1px 2px rgba(0,0,0,0.1)"><div style="font-size:13px;color:#111b21;white-space:pre-wrap;word-break:break-word">${_esc(text)}</div></div>`;
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  try {
    await fetch(`${WPP_BASE}/send/text`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chatId, text }),
    });
  } catch (e) {
    console.error('[CL] Erro ao enviar mensagem WPP:', e);
  }
}

function _clOpenWppFull(chatId) {
  navigate('comunicacao', document.querySelector('[data-page=comunicacao]'));
  document.getElementById('clMiniChat')?.remove();
  setTimeout(() => {
    if (typeof _wppSelectChat === 'function') {
      _wppSwitchSidebar('chats');
      _wppSelectChat(chatId);
    }
  }, 400);
}

/* ─────────────────────────────────────────────
   DRIVE — PANE HTML
───────────────────────────────────────────── */
function _clPaneDocumentos(lead, id) {
  if (!gauthIsConnected()) {
    return `
      <div style="text-align:center;padding:48px 16px;color:var(--muted)">
        <i class="bi bi-google" style="font-size:40px;opacity:.35;display:block;margin-bottom:14px;color:#4285f4"></i>
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">Google não conectado</div>
        <div style="font-size:13px;margin-bottom:20px">Conecte sua conta Google para acessar o Drive do cliente.</div>
        <button class="btn btn-primary" onclick="gauthSignIn().then(()=>{gauthUpdateTopbar();_clToggleTab('documentos')})">
          <i class="bi bi-google"></i> Conectar Google
        </button>
      </div>`;
  }

  if (!lead.driveFolderId) {
    return `
      <div style="text-align:center;padding:48px 16px;color:var(--muted)">
        <i class="bi bi-folder2" style="font-size:40px;opacity:.35;display:block;margin-bottom:14px;color:#4285f4"></i>
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">Pasta no Drive não criada</div>
        <div style="font-size:13px;margin-bottom:20px">Crie uma pasta dedicada no Google Drive para os documentos de <strong>${_esc(lead.nome)}</strong>.</div>
        <button class="btn btn-primary" id="clDriveCreateBtn_${id}" onclick="_clEnsureDrive(${id})">
          <i class="bi bi-folder-plus"></i> Criar pasta no Drive
        </button>
      </div>`;
  }

  const folderUrl = lead.driveFolderUrl || `https://drive.google.com/drive/folders/${lead.driveFolderId}`;
  return `
    <!-- Folder header -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:10px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px">
      <i class="bi bi-folder2-open" style="font-size:22px;color:#4285f4;flex-shrink:0"></i>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:800;color:#1d4ed8">Pasta do cliente</div>
        <div style="font-size:10px;color:#3b82f6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(lead.driveFolderId)}">${_esc(lead.driveFolderId)}</div>
      </div>
      <a href="${_esc(folderUrl)}" target="_blank" class="btn btn-sm" style="background:#4285f4;color:white;border:none;font-size:12px;flex-shrink:0">
        <i class="bi bi-box-arrow-up-right"></i> Abrir pasta
      </a>
    </div>

    <!-- Upload zone (drag & drop) -->
    <div id="clDriveUploadZone_${id}"
      style="border:2px dashed #cbd5e1;border-radius:10px;padding:18px 12px;text-align:center;margin-bottom:14px;cursor:pointer;transition:border-color .15s,background .15s"
      onclick="document.getElementById('clDriveFilePicker_${id}').click()"
      ondragover="event.preventDefault();this.style.borderColor='#4285f4';this.style.background='#eff6ff'"
      ondragleave="this.style.borderColor='#cbd5e1';this.style.background=''"
      ondrop="_clDriveHandleDrop(event,${id},'${_esc(lead.driveFolderId)}')">
      <i class="bi bi-cloud-upload" style="font-size:26px;color:#4285f4;display:block;margin-bottom:6px"></i>
      <div style="font-size:13px;color:var(--muted)">Arraste arquivos ou <span style="color:#4285f4;font-weight:700">clique para selecionar</span></div>
      <input type="file" id="clDriveFilePicker_${id}" multiple style="display:none"
        onchange="_clDriveHandleFilePick(this,${id},'${_esc(lead.driveFolderId)}')">
    </div>

    <!-- Upload progress bar (hidden by default) -->
    <div id="clDriveProgress_${id}" style="display:none;margin-bottom:12px">
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px" id="clDriveProgressLabel_${id}">Enviando...</div>
      <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
        <div id="clDriveProgressBar_${id}" style="height:100%;width:0%;background:#4285f4;border-radius:3px;transition:width .2s"></div>
      </div>
    </div>

    <!-- File grid -->
    <div id="clDriveFileGrid_${id}">
      <div style="text-align:center;padding:20px;color:var(--muted);font-size:12px">
        <div style="width:18px;height:18px;border:2px solid #4285f4;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 8px"></div>
        Carregando arquivos...
      </div>
    </div>
  `;
}

/* ─────────────────────────────────────────────
   DRIVE — API HELPERS
───────────────────────────────────────────── */

/**
 * Lista arquivos de uma pasta do Google Drive.
 * @param {string} folderId
 * @returns {Promise<Array>}
 */
async function _clDriveListFiles(folderId) {
  const token = gauthGetToken();
  if (!token || !folderId) return [];
  const q      = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const fields  = encodeURIComponent('files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink)');
  const orderBy = encodeURIComponent('modifiedTime desc');
  const url     = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=${orderBy}`;
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return [];
    const d = await r.json();
    return d.files || [];
  } catch (e) {
    console.error('[CL Drive] Erro ao listar arquivos:', e);
    return [];
  }
}

/**
 * Faz upload de um arquivo para uma pasta do Google Drive (multipart).
 * @param {string}   folderId
 * @param {File}     file
 * @param {Function} onProgress  callback(0-100)
 * @returns {Promise<Object|null>}
 */
async function _clDriveUpload(folderId, file, onProgress) {
  const token = gauthGetToken();
  if (!token || !folderId || !file) return null;
  return new Promise((resolve) => {
    const metadata  = JSON.stringify({ name: file.name, parents: [folderId] });
    const boundary  = '-------genesisboundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim= `\r\n--${boundary}--`;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64    = btoa(ev.target.result);
      const multipart = delimiter
        + 'Content-Type: application/json; charset=UTF-8\r\n\r\n'
        + metadata
        + delimiter
        + `Content-Type: ${file.type || 'application/octet-stream'}\r\nContent-Transfer-Encoding: base64\r\n\r\n`
        + base64
        + closeDelim;

      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink,iconLink');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Content-Type', `multipart/related; boundary="${boundary}"`);
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); } catch { resolve(null); }
        } else {
          console.error('[CL Drive] Upload falhou:', xhr.status, xhr.responseText);
          resolve(null);
        }
      };
      xhr.onerror = () => resolve(null);
      xhr.send(multipart);
    };
    reader.onerror = () => resolve(null);
    reader.readAsBinaryString(file);
  });
}

/* ─────────────────────────────────────────────
   DRIVE — UI HELPERS
───────────────────────────────────────────── */

/** Retorna ícone Bootstrap correto para o mimeType */
function _clDriveMimeIcon(mimeType) {
  if (!mimeType) return 'bi-file-earmark';
  if (mimeType === 'application/pdf')                                                      return 'bi-file-earmark-pdf';
  if (mimeType.startsWith('image/'))                                                       return 'bi-file-earmark-image';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
                                                                                            return 'bi-file-earmark-excel';
  if (mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('opendocument.text'))
                                                                                            return 'bi-file-earmark-word';
  if (mimeType.startsWith('video/'))                                                       return 'bi-file-earmark-play';
  if (mimeType.startsWith('audio/'))                                                       return 'bi-file-earmark-music';
  if (mimeType.includes('zip') || mimeType.includes('compress') || mimeType.includes('archive'))
                                                                                            return 'bi-file-earmark-zip';
  if (mimeType.startsWith('text/'))                                                        return 'bi-file-earmark-text';
  return 'bi-file-earmark';
}

/** Retorna cor de destaque para o mimeType */
function _clDriveMimeColor(mimeType) {
  if (!mimeType) return '#64748b';
  if (mimeType === 'application/pdf')                                  return '#ef4444';
  if (mimeType.startsWith('image/'))                                   return '#8b5cf6';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '#16a34a';
  if (mimeType.includes('document') || mimeType.includes('word'))     return '#2563eb';
  if (mimeType.startsWith('video/'))                                   return '#d97706';
  if (mimeType.startsWith('audio/'))                                   return '#db2777';
  return '#64748b';
}

/** Formata tamanho de arquivo em KB/MB */
function _clDriveFmtSize(bytes) {
  if (!bytes) return '';
  const n = parseInt(bytes, 10);
  if (isNaN(n)) return '';
  if (n < 1024)       return `${n} B`;
  if (n < 1024*1024)  return `${(n/1024).toFixed(1)} KB`;
  return `${(n/(1024*1024)).toFixed(1)} MB`;
}

/** Renderiza card de arquivo individual */
function _clDriveFileCard(f) {
  const icon  = _clDriveMimeIcon(f.mimeType);
  const color = _clDriveMimeColor(f.mimeType);
  const date  = f.modifiedTime
    ? new Date(f.modifiedTime).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' })
    : '';
  const size = _clDriveFmtSize(f.size);
  const link = _esc(f.webViewLink || '#');
  const name = _esc(f.name || 'Sem nome');
  return `
    <a href="${link}" target="_blank" rel="noopener noreferrer" title="${name}"
      style="display:flex;flex-direction:column;background:white;border:1px solid var(--border);border-radius:10px;padding:12px 10px;text-decoration:none;color:inherit;transition:box-shadow .15s,border-color .15s;cursor:pointer;min-width:0"
      onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,.1)';this.style.borderColor='${color}'"
      onmouseout="this.style.boxShadow='';this.style.borderColor='var(--border)'">
      <i class="bi ${icon}" style="font-size:28px;color:${color};display:block;margin-bottom:8px"></i>
      <div style="font-size:11px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:3px">${name}</div>
      ${date ? `<div style="font-size:10px;color:var(--muted)">${date}</div>` : ''}
      ${size ? `<div style="font-size:10px;color:var(--muted)">${size}</div>` : ''}
    </a>`;
}

/** Carrega e renderiza a grade de arquivos do Drive no painel aberto */
async function _clLoadDriveFiles(folderId) {
  const leadId = CL.perfilId;
  const gridEl = document.getElementById(`clDriveFileGrid_${leadId}`);
  if (!gridEl) return;
  CL.driveLoading = true;
  const files = await _clDriveListFiles(folderId);
  CL.driveLoading = false;
  if (!gridEl.isConnected) return; // painel foi fechado enquanto carregava

  if (!files.length) {
    gridEl.innerHTML = `
      <div style="text-align:center;padding:32px 12px;color:var(--muted)">
        <i class="bi bi-folder2" style="font-size:36px;opacity:.3;display:block;margin-bottom:10px"></i>
        <div style="font-size:13px">Nenhum arquivo nesta pasta.</div>
        <div style="font-size:11px;margin-top:4px">Use a área acima para enviar o primeiro arquivo.</div>
      </div>`;
    return;
  }

  gridEl.innerHTML = `
    <div style="font-size:11px;color:var(--muted);margin-bottom:8px">${files.length} arquivo${files.length!==1?'s':''}</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      ${files.map(f => _clDriveFileCard(f)).join('')}
    </div>`;
}

/** Drag-and-drop handler para a zona de upload */
function _clDriveHandleDrop(event, leadId, folderId) {
  event.preventDefault();
  const zone = document.getElementById(`clDriveUploadZone_${leadId}`);
  if (zone) { zone.style.borderColor = '#cbd5e1'; zone.style.background = ''; }
  const files = Array.from(event.dataTransfer?.files || []);
  if (!files.length) return;
  _clDriveUploadFiles(leadId, folderId, files);
}

/** File picker change handler */
function _clDriveHandleFilePick(input, leadId, folderId) {
  const files = Array.from(input?.files || []);
  if (!files.length) return;
  input.value = ''; // reset para permitir re-seleção do mesmo arquivo
  _clDriveUploadFiles(leadId, folderId, files);
}

/** Envia múltiplos arquivos sequencialmente, atualiza progresso e recarrega grade */
async function _clDriveUploadFiles(leadId, folderId, files) {
  const progressEl  = document.getElementById(`clDriveProgress_${leadId}`);
  const progressBar = document.getElementById(`clDriveProgressBar_${leadId}`);
  const progressLbl = document.getElementById(`clDriveProgressLabel_${leadId}`);

  if (progressEl) progressEl.style.display = 'block';

  let uploadedCount = 0;
  for (const file of files) {
    if (progressLbl) progressLbl.textContent = `Enviando "${file.name}" (${uploadedCount + 1}/${files.length})...`;
    if (progressBar) progressBar.style.width = '0%';

    const result = await _clDriveUpload(folderId, file, (pct) => {
      if (progressBar) progressBar.style.width = `${pct}%`;
    });

    if (result) {
      uploadedCount++;
      typeof leadAddHistorico === 'function' && leadAddHistorico(leadId, `Arquivo enviado ao Drive: ${file.name}`);
    } else {
      if (progressLbl) progressLbl.textContent = `Falha ao enviar "${file.name}"`;
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  if (progressEl) progressEl.style.display = 'none';
  if (progressBar) progressBar.style.width = '0%';

  // Recarrega grade de arquivos
  await _clLoadDriveFiles(folderId);
}

/* ─────────────────────────────────────────────
   DRIVE — CRIAR PASTA
───────────────────────────────────────────── */
async function _clEnsureDrive(leadId) {
  if (!gauthIsConnected()) {
    alert('Conecte o Google primeiro na tela de Agenda.');
    return;
  }
  const lead = storeGet().find(l => l.id === leadId);
  if (!lead) return;
  const btn = document.getElementById(`clDriveCreateBtn_${leadId}`);
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Criando...'; }
  const folder = await driveEnsureClientFolder(leadId, lead.nome);
  if (folder) {
    const updated = storeGet().find(l => l.id === leadId);
    if (updated) {
      // Re-renderiza apenas o pane de documentos (evita piscar todo o perfil)
      const pane = document.getElementById('clPane_documentos');
      if (pane) {
        pane.innerHTML = _clPaneDocumentos(updated, leadId);
        if (updated.driveFolderId) _clLoadDriveFiles(updated.driveFolderId);
      } else {
        _clRenderPerfil(updated);
        _clToggleTab('documentos');
      }
    }
  } else {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-folder-plus"></i> Criar pasta no Drive'; }
    alert('Não foi possível criar a pasta. Verifique as permissões do Google Drive.');
  }
}

/* ─────────────────────────────────────────────
   GLOBAL ALIASES
───────────────────────────────────────────── */
window.openPerfil  = _clOpenPerfil;
window.closePerfil = _clClosePerfil;
