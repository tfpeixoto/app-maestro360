/* =====================================================================
   FUNIL — Render (Kanban Board) — Trello-style with Sims + Leads modes
   ===================================================================== */
let activeFunnelId = 'vendas';
let searchTerm = '';
let draggedId = null;
let draggedSimId = null;
let _funilEditMode = false;
let _funilMode = 'sims'; // 'sims' | 'leads'

// Sim board state: { etapas: [...], cards: { [etapaId]: [...] } }
let _simBoardData = null;
let _simBoardLoading = false;

/* ── INIT ─────────────────────────────────────────────────────────── */
async function initFunil() {
  seedDemoData();
  _seedFunnels();
  migrateFunnelField();
  await renderFunilPage();
}

function _seedFunnels() {
  funnelsGet();
}

function switchFunil(id) {
  activeFunnelId = id;
  searchTerm = '';
  _simBoardData = null;
  renderFunilPage();
}

/* ── MAIN RENDER ──────────────────────────────────────────────────── */
async function renderFunilPage() {
  const el = document.getElementById('page-funil');
  if (!el) return;

  const funnels = funnelsGet();
  const activeFunnel = funnels.find(f => f.id === activeFunnelId) || funnels[0];
  if (!activeFunnel) return;
  activeFunnelId = activeFunnel.id;

  const leads = leadsByFunnel(activeFunnelId);
  const total = leads.length;
  const vlTotal = leads.reduce((s, l) => s + (l.valorDesejado || 0), 0);
  const lastStageId = activeFunnel.stages[activeFunnel.stages.length - 1]?.id;
  const fechados = leads.filter(l => l.stage === lastStageId || l.stage === 'contrato').length;
  const activeFunnelLeads = leads.length;

  const selectorHtml = `
    <div style="position:relative;display:inline-block" id="funilSelectorWrap">
      <button id="funilSelectorBtn" onclick="event.stopPropagation();_funilToggleDropdown()" style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:10px;border:2px solid ${activeFunnel.cor};background:white;color:var(--primary);font-size:14px;font-weight:700;cursor:pointer;transition:all .15s;min-width:200px;justify-content:space-between">
        <span style="display:flex;align-items:center;gap:8px">
          <span style="width:10px;height:10px;border-radius:50%;background:${activeFunnel.cor};flex-shrink:0;display:inline-block"></span>
          <span>${_esc(activeFunnel.label)}</span>
          <span style="background:${activeFunnel.cor};color:white;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700">${activeFunnelLeads}</span>
        </span>
        <i class="bi bi-chevron-down" style="font-size:11px;color:var(--muted)"></i>
      </button>
      <div id="funilSelectorDropdown" style="display:none;position:absolute;top:calc(100% + 6px);left:0;z-index:3000;background:white;border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.12);min-width:260px;padding:8px 0;overflow:hidden">
        <div style="padding:8px 10px">
          <input id="funilSelectorSearch" type="text" placeholder="Buscar funil..." oninput="_funilFilterDropdown(this.value)" onclick="event.stopPropagation()" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;outline:none;box-sizing:border-box" />
        </div>
        <div id="funilSelectorList" style="max-height:240px;overflow-y:auto">
          ${funnels.map(f => `
            <div class="funil-selector-item" onclick="event.stopPropagation();_funilSelectFromDropdown('${f.id}')" style="display:flex;align-items:center;gap:8px;padding:9px 14px;cursor:pointer;transition:background .1s;background:${f.id === activeFunnelId ? f.cor + '12' : 'white'}" onmouseover="this.style.background='${f.cor}18'" onmouseout="this.style.background='${f.id === activeFunnelId ? f.cor + '12' : 'white'}'">
              <span style="width:10px;height:10px;border-radius:50%;background:${f.cor};flex-shrink:0;display:inline-block"></span>
              <span style="flex:1;font-size:13px;font-weight:${f.id === activeFunnelId ? '700' : '500'};color:var(--primary)">${_esc(f.label)}</span>
              <span style="background:${f.cor}22;color:${f.cor};border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700">${leadsByFunnel(f.id).length}</span>
              ${f.id === activeFunnelId ? '<i class="bi bi-check2" style="color:' + f.cor + ';font-size:13px"></i>' : ''}
            </div>`).join('')}
        </div>
      </div>
    </div>`;

  // Mode toggle button
  const modeToggleHtml = `
    <button onclick="_funilToggleMode()" style="display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:20px;border:2px solid var(--border);background:${_funilMode === 'sims' ? 'var(--primary)' : 'white'};color:${_funilMode === 'sims' ? 'white' : 'var(--primary)'};font-size:13px;font-weight:700;cursor:pointer;transition:all .15s" title="Alternar entre Leads e Simulações">
      <i class="bi bi-${_funilMode === 'sims' ? 'kanban-fill' : 'people-fill'}"></i>
      ${_funilMode === 'sims' ? 'Simulações' : 'Leads'}
    </button>`;

  // Stats section (different per mode)
  let statsHtml = '';
  if (_funilMode === 'leads') {
    statsHtml = `
      <div class="funil-stats" style="margin-bottom:14px">
        <div class="funil-stat"><div class="fstat-label">Leads no Funil</div><div class="fstat-value">${total}</div></div>
        <div class="funil-stat"><div class="fstat-label">Fechados</div><div class="fstat-value" style="color:#16a34a">${fechados}</div></div>
        <div class="funil-stat"><div class="fstat-label">Potencial</div><div class="fstat-value">${fmtValor(vlTotal)}</div></div>
        <div class="funil-stat"><div class="fstat-label">Conversão</div><div class="fstat-value">${total > 0 ? Math.round(fechados / total * 100) : 0}%</div></div>
      </div>`;
  } else {
    // Stats will be rendered after data is loaded
    statsHtml = `<div id="simStatsBar" class="funil-stats" style="margin-bottom:14px">
      <div class="funil-stat"><div class="fstat-label">Simulações</div><div class="fstat-value" id="statSimTotal">—</div></div>
      <div class="funil-stat"><div class="fstat-label">Fechados</div><div class="fstat-value" style="color:#16a34a" id="statSimFechados">—</div></div>
      <div class="funil-stat"><div class="fstat-label">Potencial</div><div class="fstat-value" id="statSimPotencial">—</div></div>
      <div class="funil-stat"><div class="fstat-label">Conversão</div><div class="fstat-value" id="statSimConversao">—</div></div>
    </div>`;
  }

  el.innerHTML = `
    <div class="page-header" style="margin-bottom:12px">
      <div>
        <div class="page-title">Funis de Vendas</div>
        <div class="page-subtitle">Gerencie todo o ciclo do cliente</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${_funilMode === 'leads' ? `<button class="btn btn-ghost btn-sm" onclick="_funilGerenciar()" title="Gerenciar funis"><i class="bi bi-gear-fill"></i> Gerenciar</button>` : ''}
        ${_funilMode === 'leads' ? `<button id="btnFunilEdit" class="btn ${_funilEditMode ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="_funilToggleEditMode()" title="Editar colunas"><i class="bi bi-pencil-fill"></i> ${_funilEditMode ? 'Concluir' : 'Editar Board'}</button>` : ''}
        ${modeToggleHtml}
        <button class="btn btn-primary" onclick="openModalNovoLead()"><i class="bi bi-plus-lg"></i> Novo Lead</button>
      </div>
    </div>

    <!-- Funnel selector -->
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
      ${selectorHtml}
      ${_funilMode === 'leads' ? `<button onclick="_funilNovoFunil()" style="display:flex;align-items:center;gap:4px;padding:7px 12px;border-radius:20px;border:2px dashed var(--border);background:white;color:var(--muted);font-size:13px;cursor:pointer;transition:all .15s" onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--muted)'">
        <i class="bi bi-plus-lg"></i> Novo Funil
      </button>` : ''}
    </div>

    ${statsHtml}

    ${_funilMode === 'leads' ? `
    <!-- Search -->
    <div class="funil-filters">
      <div style="position:relative">
        <i class="bi bi-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px"></i>
        <input class="funil-search" style="padding-left:30px" type="text" placeholder="Buscar lead..." oninput="onSearch(this.value)" value="${_esc(searchTerm)}" />
      </div>
      ${searchTerm ? `<button class="btn btn-ghost btn-sm" onclick="onSearch('')">Limpar</button>` : ''}
    </div>` : ''}

    <!-- Board -->
    <div class="funil-board" id="funilBoard">
      ${_funilMode === 'leads'
        ? activeFunnel.stages.map(s => renderColuna(s, activeFunnel)).join('') + `
          <div style="flex:0 0 auto;display:flex;align-items:flex-start;padding-top:8px">
            <button onclick="_funilAddStage('${activeFunnelId}')" style="display:flex;align-items:center;gap:6px;padding:10px 16px;border:2px dashed var(--border);border-radius:10px;background:white;color:var(--muted);font-size:13px;cursor:pointer;white-space:nowrap;transition:all .15s" onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--muted)'">
              <i class="bi bi-plus-circle"></i> Nova Etapa
            </button>
          </div>`
        : '<div id="simBoardPlaceholder" style="width:100%;padding:40px;text-align:center;color:var(--muted)"><div class="spinner" style="display:inline-block;width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin 0.7s linear infinite"></div><div style="margin-top:12px;font-size:14px">Carregando simulações...</div></div>'
      }
    </div>
  `;

  const badge = document.getElementById('badge-funil');
  if (badge) badge.textContent = leadsByFunnel('vendas').filter(l => l.stage === 'lead').length || '';

  // In sims mode, load board data from API
  if (_funilMode === 'sims') {
    await _loadSimBoard(activeFunnelId, activeFunnel);
  }
}

/* ── SIM BOARD LOADER ─────────────────────────────────────────────── */
async function _loadSimBoard(funilId, activeFunnel) {
  if (_simBoardLoading) return;
  _simBoardLoading = true;

  try {
    const data = await simApiBoard(funilId);
    _simBoardData = data;
    _renderSimBoard(data, activeFunnel);
    _updateSimStats(data);
  } catch (err) {
    console.warn('[funil] API unavailable, falling back to leads mode:', err.message);
    _funilMode = 'leads';
    await renderFunilPage();
  } finally {
    _simBoardLoading = false;
  }
}

function _updateSimStats(data) {
  if (!data) return;
  const allCards = Object.values(data.cards || {}).flat();
  const total = allCards.length;
  const lastEtapa = data.etapas[data.etapas.length - 1];
  const fechados = lastEtapa ? (data.cards[lastEtapa.id] || []).length : 0;
  const potencial = allCards.reduce((s, c) => s + (parseFloat(c.credito) || 0), 0);
  const conversao = total > 0 ? Math.round(fechados / total * 100) : 0;

  const elTotal = document.getElementById('statSimTotal');
  const elFechados = document.getElementById('statSimFechados');
  const elPotencial = document.getElementById('statSimPotencial');
  const elConversao = document.getElementById('statSimConversao');

  if (elTotal) elTotal.textContent = total;
  if (elFechados) elFechados.textContent = fechados;
  if (elPotencial) elPotencial.textContent = fmtValor(potencial);
  if (elConversao) elConversao.textContent = conversao + '%';
}

function _renderSimBoard(data, activeFunnel) {
  const board = document.getElementById('funilBoard');
  if (!board) return;

  if (!data || data.etapas.length === 0) {
    board.innerHTML = `
      <div style="width:100%;padding:40px;text-align:center;color:var(--muted)">
        <i class="bi bi-kanban" style="font-size:40px;opacity:0.3"></i>
        <div style="margin-top:12px;font-size:14px">Nenhuma etapa encontrada para este funil.</div>
        <div style="margin-top:6px;font-size:12px">Configure as etapas no banco de dados (tabela funil_estagios).</div>
      </div>`;
    return;
  }

  board.innerHTML = data.etapas.map(etapa => {
    const cards = data.cards[etapa.id] || [];
    return renderSimColuna(etapa, cards);
  }).join('');
}

/* ── SIM COLUMN ───────────────────────────────────────────────────── */
function renderSimColuna(etapa, cards) {
  const vlTotal = cards.reduce((s, c) => s + (parseFloat(c.credito) || 0), 0);
  const cardsHtml = cards.map(sim => renderSimCard(sim, etapa)).join('');

  return `
    <div class="funil-col" id="simcol-${etapa.id}"
         ondragover="onSimDragOver(event,'${etapa.id}')"
         ondragleave="onSimDragLeave(event)"
         ondrop="onSimDrop(event,'${etapa.id}')">
      <div class="funil-col-header" style="background:${etapa.cor || '#94a3b8'}">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
          <span class="funil-col-title">${_esc(etapa.label)}</span>
          <span class="funil-col-count">${cards.length}</span>
        </div>
      </div>
      ${vlTotal > 0 ? `<div style="padding:6px 12px;background:${etapa.cor || '#94a3b8'}22;font-size:11px;font-weight:700;color:${etapa.cor || '#94a3b8'};border-bottom:1px solid ${etapa.cor || '#94a3b8'}33">${fmtValor(vlTotal)}</div>` : ''}
      <div class="funil-col-body" id="simbody-${etapa.id}">${cardsHtml}</div>
      <div class="funil-col-add" onclick="openNovaSimModal('${etapa.id}')"><i class="bi bi-plus-lg"></i> Adicionar</div>
    </div>`;
}

/* ── SIM CARD ─────────────────────────────────────────────────────── */
function renderSimCard(sim, stage) {
  const total = parseInt(sim.checklist_total) || 0;
  const feito = parseInt(sim.checklist_feito) || 0;
  const checkColor = total === 0 ? '#94a3b8' : feito === total ? '#16a34a' : '#f59e0b';
  const checkBadge = total > 0
    ? `<span style="font-size:10px;font-weight:700;color:${checkColor};background:${checkColor}18;padding:2px 7px;border-radius:10px">✔ ${feito}/${total}</span>`
    : '';
  const codigoBadge = sim.codigo
    ? `<span style="font-size:9px;font-weight:700;color:var(--muted);background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:1px 5px;font-family:monospace">${_esc(sim.codigo)}</span>`
    : '';
  const leadNome = sim.lead_nome || sim.lead_nome_cache || '';
  const leadId = sim.lead ? sim.lead.id : null;
  const perfilBtn = leadNome
    ? `<button onclick="event.stopPropagation();navigate('clientes',document.querySelector('[data-page=clientes]'));setTimeout(()=>{const ls=typeof storeGet==='function'&&storeGet().find(l=>l.nome===${JSON.stringify(leadNome)});if(ls&&typeof _clOpenPerfil==='function')_clOpenPerfil(ls.id);},300)" style="border:none;background:rgba(99,102,241,0.08);color:#6366f1;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap"><i class="bi bi-person-fill"></i> Perfil</button>`
    : '';
  return `
    <div class="lead-card" id="simcard-${sim.id}"
         draggable="true"
         ondragstart="onSimDragStart(event,${sim.id})"
         ondragend="onSimDragEnd(event)"
         onclick="openSimModal(${sim.id})">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
        <div class="lead-card-name" style="flex:1;min-width:0">${_esc(leadNome || sim.titulo || 'Simulação #' + sim.id)}</div>
        ${codigoBadge}
      </div>
      <div class="lead-card-info" style="margin-top:4px">
        ${sim.titulo && leadNome ? `<span style="font-size:11px;color:var(--muted)">${_esc(sim.titulo)}</span>` : ''}
      </div>
      <div class="lead-card-meta" style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
        <span class="lead-card-valor">${fmtValor(sim.credito)}</span>
        <div style="display:flex;align-items:center;gap:6px">
          ${checkBadge}
          ${perfilBtn}
        </div>
      </div>
    </div>`;
}

/* ── LEADS MODE COLUMNS ───────────────────────────────────────────── */
function renderColuna(stage, funnel) {
  const leads = storeGet()
    .filter(l => (l.funnel || 'vendas') === funnel.id && l.stage === stage.id)
    .filter(l => !searchTerm || l.nome.toLowerCase().includes(searchTerm.toLowerCase()) || (l.telefone || '').includes(searchTerm));

  const cards = leads.map(l => renderCard(l, stage)).join('');
  const vlTotal = leads.reduce((s, l) => s + (l.valorDesejado || 0), 0);

  return `
    <div class="funil-col" id="col-${stage.id}"
         ondragover="onDragOver(event,'${stage.id}')"
         ondragleave="onDragLeave(event)"
         ondrop="onDrop(event,'${stage.id}')">
      <div class="funil-col-header" style="background:${stage.cor}">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
          <span class="funil-col-title" id="stageTitle_${stage.id}"
            ${_funilEditMode ? `onclick="event.stopPropagation();_funilInlineEdit('${funnel.id}','${stage.id}')" title="Clique para renomear" style="cursor:text"` : 'style="cursor:default"'}
          >${_esc(stage.label)}</span>
          <span class="funil-col-count">${leads.length}</span>
        </div>
        ${_funilEditMode ? `
        <div style="display:flex;gap:4px;flex-shrink:0">
          ${funnel.stages.indexOf(stage) > 0 ? `<button onclick="event.stopPropagation();_funilMoveStage('${funnel.id}','${stage.id}','left')" style="background:rgba(255,255,255,0.2);border:none;border-radius:5px;padding:3px 6px;cursor:pointer;color:white;font-size:11px" title="Mover para esquerda"><i class="bi bi-arrow-left"></i></button>` : ''}
          ${funnel.stages.indexOf(stage) < funnel.stages.length - 1 ? `<button onclick="event.stopPropagation();_funilMoveStage('${funnel.id}','${stage.id}','right')" style="background:rgba(255,255,255,0.2);border:none;border-radius:5px;padding:3px 6px;cursor:pointer;color:white;font-size:11px" title="Mover para direita"><i class="bi bi-arrow-right"></i></button>` : ''}
          ${funnel.stages.length > 1 ? `<button onclick="event.stopPropagation();_funilDeleteStage('${funnel.id}','${stage.id}')" style="background:rgba(255,255,255,0.15);border:none;border-radius:5px;padding:3px 6px;cursor:pointer;color:white;font-size:11px" title="Remover etapa"><i class="bi bi-trash3"></i></button>` : ''}
        </div>` : ''}
      </div>
      ${vlTotal > 0 ? `<div style="padding:6px 12px;background:${stage.cor}22;font-size:11px;font-weight:700;color:${stage.cor};border-bottom:1px solid ${stage.cor}33">${fmtValor(vlTotal)}</div>` : ''}
      <div class="funil-col-body" id="body-${stage.id}">${cards}</div>
      <div class="funil-col-add" onclick="openModalNovoLead('${stage.id}')"><i class="bi bi-plus-lg"></i> Adicionar</div>
    </div>`;
}

function renderCard(lead, stage) {
  const tags = (lead.tags || []).map(t => `<span class="lead-tag" style="background:${t.cor}22;color:${t.cor}">${_esc(t.label)}</span>`).join('');
  const origemIcon = { WhatsApp: 'bi-whatsapp', Instagram: 'bi-instagram', 'Indicação': 'bi-person-heart-fill', Site: 'bi-globe2', 'Ligação': 'bi-telephone-fill', Outro: 'bi-three-dots' }[lead.origem] || 'bi-dot';
  return `
    <div class="lead-card" id="card-${lead.id}"
         draggable="true"
         ondragstart="onDragStart(event,${lead.id})"
         ondragend="onDragEnd(event)"
         onclick="navigate('clientes',document.querySelector('[data-page=clientes]'));setTimeout(()=>typeof _clOpenPerfil==='function'&&_clOpenPerfil(${lead.id}),300)">
      <div class="lead-card-actions">
        <button class="lead-action-btn" title="Editar" onclick="event.stopPropagation();openModalEditar(${lead.id})"><i class="bi bi-pencil-fill"></i></button>
        <button class="lead-action-btn" title="Excluir" style="color:#ef4444" onclick="event.stopPropagation();confirmarDelete(${lead.id})"><i class="bi bi-trash3-fill"></i></button>
      </div>
      <div class="lead-card-name">${_esc(lead.nome)}</div>
      <div class="lead-card-info">
        ${lead.telefone ? `<span><i class="bi bi-telephone" style="color:var(--muted)"></i> ${_esc(lead.telefone)}</span>` : ''}
        ${lead.objetivo ? `<span><i class="bi bi-bullseye" style="color:var(--muted)"></i> ${_esc(lead.objetivo)}</span>` : ''}
        ${lead.origem ? `<span><i class="bi ${origemIcon}" style="color:var(--muted)"></i> ${_esc(lead.origem)}</span>` : ''}
      </div>
      ${tags ? `<div class="lead-card-tags">${tags}</div>` : ''}
      <div class="lead-card-meta">
        <span class="lead-card-valor">${fmtValor(lead.valorDesejado)}</span>
        <span class="lead-card-data">${fmtData(lead.criadoEm)}</span>
      </div>
    </div>`;
}

function onSearch(term) { searchTerm = term; renderFunilPage(); }

/* ── MODE TOGGLE ─────────────────────────────────────────────────── */
function _funilToggleMode() {
  _funilMode = _funilMode === 'sims' ? 'leads' : 'sims';
  _simBoardData = null;
  renderFunilPage();
}

/* ── DRAG & DROP — LEADS ─────────────────────────────────────────── */
function onDragStart(e, id) {
  draggedId = id;
  setTimeout(() => { const el = document.getElementById('card-' + id); if (el) el.classList.add('dragging'); }, 0);
  e.dataTransfer.effectAllowed = 'move';
}
function onDragEnd(e) {
  if (draggedId) { const el = document.getElementById('card-' + draggedId); if (el) el.classList.remove('dragging'); }
  document.querySelectorAll('.funil-col-body').forEach(b => b.classList.remove('drag-over'));
  draggedId = null;
}
function onDragOver(e, stage) {
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.funil-col-body').forEach(b => b.classList.remove('drag-over'));
  const body = document.getElementById('body-' + stage); if (body) body.classList.add('drag-over');
}
function onDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.querySelector('.funil-col-body')?.classList.remove('drag-over');
}
function onDrop(e, stage) {
  e.preventDefault();
  if (draggedId) { leadMoveStage(draggedId, stage); draggedId = null; renderFunilPage(); }
}

/* ── DRAG & DROP — SIMS ──────────────────────────────────────────── */
function onSimDragStart(e, id) {
  draggedSimId = id;
  setTimeout(() => { const el = document.getElementById('simcard-' + id); if (el) el.classList.add('dragging'); }, 0);
  e.dataTransfer.effectAllowed = 'move';
}
function onSimDragEnd(e) {
  if (draggedSimId) { const el = document.getElementById('simcard-' + draggedSimId); if (el) el.classList.remove('dragging'); }
  document.querySelectorAll('.funil-col-body').forEach(b => b.classList.remove('drag-over'));
  draggedSimId = null;
}
function onSimDragOver(e, etapaId) {
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.funil-col-body').forEach(b => b.classList.remove('drag-over'));
  const body = document.getElementById('simbody-' + etapaId); if (body) body.classList.add('drag-over');
}
function onSimDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.querySelector('.funil-col-body')?.classList.remove('drag-over');
}
async function onSimDrop(e, etapaId) {
  e.preventDefault();
  if (!draggedSimId) return;
  const id = draggedSimId;
  draggedSimId = null;
  document.querySelectorAll('.funil-col-body').forEach(b => b.classList.remove('drag-over'));
  try {
    await simApiPatch(id, { etapa_funil_id: etapaId });
    _simBoardData = null;
    await renderFunilPage();
  } catch (err) {
    console.error('[funil] Erro ao mover simulação:', err.message);
  }
}

/* ── DELETE LEAD ─────────────────────────────────────────────────── */
function confirmarDelete(id) {
  const lead = storeGet().find(l => l.id === id); if (!lead) return;
  if (confirm(`Excluir "${lead.nome}"?`)) { leadDelete(id); renderFunilPage(); }
}

/* ── EDIT MODE ───────────────────────────────────────────────────── */
function _funilToggleEditMode() {
  _funilEditMode = !_funilEditMode;
  renderFunilPage();
}

/* ── FUNNEL MANAGEMENT ───────────────────────────────────────────── */
function _funilNovoFunil() {
  const label = prompt('Nome do novo funil:'); if (!label?.trim()) return;
  const nf = funnelCreate({ label: label.trim() });
  switchFunil(nf.id);
}

function _funilEditStage(funnelId, stageId) {
  _funilInlineEdit(funnelId, stageId);
}

function _funilDeleteStage(funnelId, stageId) {
  const f = funnelsGet().find(fn => fn.id === funnelId); if (!f) return;
  const s = f.stages.find(st => st.id === stageId); if (!s) return;
  const count = storeGet().filter(l => (l.funnel || 'vendas') === funnelId && l.stage === stageId).length;
  if (!confirm(`Remover etapa "${s.label}"?${count > 0 ? ` (${count} lead(s) serão movidos para a primeira etapa)` : ''}`)) return;
  if (count > 0) {
    const firstStage = f.stages.find(st => st.id !== stageId);
    if (firstStage) storeGet().filter(l => (l.funnel || 'vendas') === funnelId && l.stage === stageId).forEach(l => leadUpdate(l.id, { stage: firstStage.id }));
  }
  funnelRemoveStage(funnelId, stageId);
  renderFunilPage();
}

function _funilAddStage(funnelId) {
  const label = prompt('Nome da nova etapa:'); if (!label?.trim()) return;
  funnelAddStage(funnelId, label.trim());
  renderFunilPage();
}

function _funilGerenciar() {
  const funnels = funnelsGet();
  const rows = funnels.map(f => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="width:12px;height:12px;border-radius:50%;background:${f.cor};flex-shrink:0"></div>
      <span style="flex:1;font-size:13px;font-weight:700">${_esc(f.label)}</span>
      <span style="font-size:11px;color:var(--muted)">${leadsByFunnel(f.id).length} leads &middot; ${f.stages.length} etapas</span>
      <button onclick="_funilRenomear('${f.id}')" style="border:none;background:none;cursor:pointer;color:var(--primary);font-size:13px" title="Renomear"><i class="bi bi-pencil-fill"></i></button>
      ${funnels.length > 1 ? `<button onclick="_funilExcluir('${f.id}')" style="border:none;background:none;cursor:pointer;color:#ef4444;font-size:13px" title="Excluir"><i class="bi bi-trash3-fill"></i></button>` : ''}
    </div>`).join('');

  const modal = document.createElement('div');
  modal.id = 'funilGerenciarModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:4000;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:460px;box-shadow:0 8px 40px rgba(0,0,0,.2)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:16px;font-weight:800;color:var(--primary)"><i class="bi bi-funnel-fill"></i> Gerenciar Funis</div>
        <button onclick="document.getElementById('funilGerenciarModal').remove()" style="border:none;background:none;font-size:20px;cursor:pointer;color:var(--muted)">✕</button>
      </div>
      ${rows}
      <button onclick="document.getElementById('funilGerenciarModal').remove();_funilNovoFunil()" class="btn btn-outline btn-sm" style="margin-top:14px;width:100%"><i class="bi bi-plus-lg"></i> Novo Funil</button>
    </div>`;
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

function _funilRenomear(id) {
  document.getElementById('funilGerenciarModal')?.remove();
  const f = funnelsGet().find(fn => fn.id === id); if (!f) return;
  const label = prompt('Novo nome do funil:', f.label); if (!label?.trim()) return;
  funnelUpdate(id, { label: label.trim() });
  renderFunilPage();
}

function _funilExcluir(id) {
  document.getElementById('funilGerenciarModal')?.remove();
  const f = funnelsGet().find(fn => fn.id === id); if (!f) return;
  const count = leadsByFunnel(id).length;
  if (!confirm(`Excluir funil "${f.label}"?${count > 0 ? ` ${count} lead(s) serão excluídos também.` : ''}`)) return;
  if (count > 0) storeGet().filter(l => (l.funnel || 'vendas') === id).forEach(l => leadDelete(l.id));
  funnelDelete(id);
  if (activeFunnelId === id) activeFunnelId = 'vendas';
  renderFunilPage();
}

/* ── SEARCHABLE FUNNEL SELECTOR ───────────────────────────────────── */
function _funilToggleDropdown() {
  const dd = document.getElementById('funilSelectorDropdown');
  if (!dd) return;
  const isOpen = dd.style.display !== 'none';
  if (isOpen) {
    dd.style.display = 'none';
  } else {
    dd.style.display = 'block';
    const inp = document.getElementById('funilSelectorSearch');
    if (inp) { inp.value = ''; _funilFilterDropdown(''); inp.focus(); }
    setTimeout(() => {
      document.addEventListener('click', _funilCloseDropdown, { once: true });
    }, 0);
  }
}

function _funilCloseDropdown() {
  const dd = document.getElementById('funilSelectorDropdown');
  if (dd) dd.style.display = 'none';
}

function _funilSelectFromDropdown(id) {
  _funilCloseDropdown();
  switchFunil(id);
}

function _funilFilterDropdown(term) {
  const list = document.getElementById('funilSelectorList');
  if (!list) return;
  const q = term.toLowerCase();
  list.querySelectorAll('.funil-selector-item').forEach(item => {
    const name = item.querySelector('span:nth-child(2)')?.textContent.toLowerCase() || '';
    item.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
}

/* ── STAGE REORDER ───────────────────────────────────────────────── */
function _funilMoveStage(funnelId, stageId, dir) {
  const funnels = funnelsGet();
  const f = funnels.find(fn => fn.id === funnelId); if (!f) return;
  const idx = f.stages.findIndex(s => s.id === stageId); if (idx === -1) return;
  if (dir === 'left' && idx > 0) {
    const tmp = f.stages[idx - 1];
    f.stages[idx - 1] = f.stages[idx];
    f.stages[idx] = tmp;
  } else if (dir === 'right' && idx < f.stages.length - 1) {
    const tmp = f.stages[idx + 1];
    f.stages[idx + 1] = f.stages[idx];
    f.stages[idx] = tmp;
  } else {
    return;
  }
  funnelsSet(funnels);
  renderFunilPage();
}

/* ── INLINE STAGE NAME EDITING ───────────────────────────────────── */
function _funilInlineEdit(funnelId, stageId) {
  const titleSpan = document.getElementById('stageTitle_' + stageId);
  if (!titleSpan) return;
  const funnels = funnelsGet();
  const f = funnels.find(fn => fn.id === funnelId); if (!f) return;
  const s = f.stages.find(st => st.id === stageId); if (!s) return;

  const input = document.createElement('input');
  input.value = s.label;
  input.style.cssText = 'background:transparent;border:none;border-bottom:2px solid rgba(255,255,255,0.8);outline:none;color:white;font-size:inherit;font-weight:inherit;font-family:inherit;width:100%;padding:0 0 1px 0;min-width:60px';

  let saved = false;

  function save() {
    if (saved) return;
    saved = true;
    const val = input.value.trim();
    if (val && val !== s.label) {
      funnelUpdateStage(funnelId, stageId, { label: val });
    }
    renderFunilPage();
  }

  function cancel() {
    if (saved) return;
    saved = true;
    renderFunilPage();
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    e.stopPropagation();
  });
  input.addEventListener('blur', save);
  input.addEventListener('click', e => e.stopPropagation());

  titleSpan.replaceWith(input);
  input.select();
}

/* ── CSS keyframe for spinner (injected once) ──────────────────────── */
(function _injectSpinCSS() {
  if (document.getElementById('_spinStyle')) return;
  const s = document.createElement('style');
  s.id = '_spinStyle';
  s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(s);
})();
