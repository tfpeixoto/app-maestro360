/* =====================================================================
   FUNIL — Modal (Novo Lead / Editar) + Painel Perfil + Sim Card Modal
   ===================================================================== */
let editandoId = null;

/* ── MODAL FORM — LEAD ─────────────────────────────────────────────── */
function openModalNovoLead(stageInicial) {
  editandoId = null;
  document.getElementById('modalTitle').textContent = 'Novo Lead';
  document.getElementById('leadForm').reset();
  _funilUpdateStageOpts();
  if (stageInicial) document.getElementById('fStage').value = stageInicial;
  _leadTab('contato');
  document.getElementById('modalLead').classList.add('open');
  document.getElementById('fNome').focus();
}

/* ── TAB HELPERS ────────────────────────────────────────────────── */
const _LEAD_TABS = ['contato','financeiro','consorcio','patrimonio','crm'];
let _leadTabAtual = 'contato';

function _leadTab(tabId) {
  _LEAD_TABS.forEach(t => {
    const el  = document.getElementById('ltab-' + t);
    const btn = document.getElementById('ltabBtn-' + t);
    if (el)  el.style.display = t === tabId ? 'block' : 'none';
    if (btn) btn.classList.toggle('ltab-active', t === tabId);
  });
  _leadTabAtual = tabId;
  const idx  = _LEAD_TABS.indexOf(tabId);
  const prev = document.getElementById('leadBtnPrev');
  const next = document.getElementById('leadBtnNext');
  const save = document.getElementById('leadBtnSave');
  if (prev) prev.style.display = idx === 0 ? 'none' : '';
  if (next) next.style.display = idx === _LEAD_TABS.length - 1 ? 'none' : '';
  if (save) save.style.display = idx === _LEAD_TABS.length - 1 ? '' : 'none';
}
function _leadTabNext() {
  const idx = _LEAD_TABS.indexOf(_leadTabAtual);
  if (idx < _LEAD_TABS.length - 1) _leadTab(_LEAD_TABS[idx + 1]);
}
function _leadTabPrev() {
  const idx = _LEAD_TABS.indexOf(_leadTabAtual);
  if (idx > 0) _leadTab(_LEAD_TABS[idx - 1]);
}
function _selVal(id, val) {
  const el = document.getElementById(id);
  if (!el || val == null) return;
  el.value = String(val);
}

function openModalEditar(id) {
  const lead = storeGet().find(l => l.id === id);
  if (!lead) return;
  editandoId = id;
  document.getElementById('modalTitle').textContent = 'Editar Lead';
  _funilUpdateStageOpts(lead.funnel || 'vendas');

  // Tab 1 — Contato
  _selVal('fNome',            lead.nome);
  _selVal('fTelefone',        lead.telefone);
  _selVal('fEmail',           lead.email);
  _selVal('fCpf',             lead.cpf || '');
  _selVal('fDataNasc',        lead.dataNasc || '');
  _selVal('fProfissao',       lead.profissao || '');
  _selVal('fEmpresa',         lead.empresa || '');
  _selVal('fTempoAtividade',  lead.tempoAtividade || '');
  _selVal('fCidade',          lead.cidade || '');
  _selVal('fEstado',          lead.estado || '');
  _selVal('fBairro',          lead.bairro || '');
  _selVal('fHorarioContato',  lead.horarioContato || '');

  // Tab 2 — Financeiro
  _selVal('fModeloRenda',       lead.modeloRenda || '');
  _selVal('fRendaMensal',       lead.rendaMensal || '');
  _selVal('fCompRenda',         lead.compRenda || '');
  _selVal('fFgts',              lead.fgts || '');
  _selVal('fEstadoCivil',       lead.estadoCivil || '');
  _selVal('fConjuge',           lead.conjuge || '');
  _selVal('fRendaConjuge',      lead.rendaConjuge || '');
  _selVal('fDependentes',       lead.dependentes || '');
  _selVal('fRestricoes',        lead.restricoes || '');
  _selVal('fRestricaoDetalhe',  lead.restricaoDetalhe || '');

  // Tab 3 — Consórcio
  _selVal('fObjetivo',      lead.objetivo || '');
  _selVal('fFinalidade',    lead.finalidade || '');
  _selVal('fValor',         lead.valorDesejado || '');
  _selVal('fAporte',        lead.aporteMensal || '');
  _selVal('fValorLance',    lead.valorLance || '');
  _selVal('fTipoLance',     lead.tipoLance || '');
  _selVal('fUrgencia',      lead.urgencia || '');
  _selVal('fConsorciado',   lead.consorciado || '');
  _selVal('fConsorcioDet',  lead.consorcioDet || '');
  _selVal('fNomeCarta',     lead.nomeCarta || '');

  // Tab 4 — Patrimônio — Imóvel
  _selVal('fValorImovel',      lead.valorImovel || '');
  _selVal('fTipoImovel',       lead.tipoImovel || '');
  _selVal('fDonoImovel',       lead.donoImovel || '');
  _selVal('fImovelEndereco',   lead.imovelEndereco || '');
  _selVal('fImovelAlugado',    lead.imovelAlugado || '');
  _selVal('fImovelDebitos',    lead.imovelDebitos || '');
  _selVal('fImovelFinanciado', lead.imovelFinanciado || '');
  _selVal('fImovelVagas',      lead.imovelVagas || '');

  // Tab 4 — Patrimônio — Veículo
  _selVal('fValorVeiculo',      lead.valorVeiculo || '');
  _selVal('fTipoVeiculo',       lead.tipoVeiculo || '');
  _selVal('fModeloVeiculo',     lead.modeloVeiculo || '');
  _selVal('fAnoVeiculo',        lead.anoVeiculo || '');
  _selVal('fPlacaVeiculo',      lead.placaVeiculo || '');
  _selVal('fDonoVeiculo',       lead.donoVeiculo || '');
  _selVal('fVeiculoDebitos',    lead.veiculoDebitos || '');
  _selVal('fVeiculoFinanciado', lead.veiculoFinanciado || '');

  // Tab 5 — CRM
  _selVal('fOrigem',     lead.origem || '');
  _selVal('fIndicacao',  lead.indicacao || '');
  _selVal('fFunnel',     lead.funnel || '');
  _selVal('fStage',      lead.stage || '');
  _selVal('fObs',        lead.obs || '');

  _leadTab(openModalEditar._openTab || 'contato');
  openModalEditar._openTab = null;
  document.getElementById('modalLead').classList.add('open');
}

function openModalEditarTab(id, tab) {
  openModalEditar._openTab = tab || 'contato';
  openModalEditar(id);
}

function closeModal() {
  document.getElementById('modalLead').classList.remove('open');
  editandoId = null;
}

function salvarLead() {
  const nome = document.getElementById('fNome').value.trim();
  if (!nome) { alert('Nome é obrigatório.'); return; }
  const funnelId = document.getElementById('fFunnel')?.value || (typeof activeFunnelId !== 'undefined' ? activeFunnelId : 'vendas');
  const data = {
    nome,
    // Tab 1 — Contato
    telefone:       document.getElementById('fTelefone').value.trim(),
    email:          document.getElementById('fEmail').value.trim(),
    cpf:            document.getElementById('fCpf')?.value.trim() || '',
    dataNasc:       document.getElementById('fDataNasc').value,
    profissao:      document.getElementById('fProfissao').value.trim(),
    empresa:        document.getElementById('fEmpresa').value.trim(),
    tempoAtividade: document.getElementById('fTempoAtividade').value.trim(),
    cidade:         document.getElementById('fCidade').value.trim(),
    estado:         document.getElementById('fEstado').value.trim().toUpperCase(),
    bairro:         document.getElementById('fBairro').value.trim(),
    horarioContato: document.getElementById('fHorarioContato').value.trim(),

    // Tab 2 — Financeiro
    modeloRenda:      document.getElementById('fModeloRenda').value,
    rendaMensal:      parseFloat(document.getElementById('fRendaMensal').value) || 0,
    compRenda:        parseFloat(document.getElementById('fCompRenda').value) || 0,
    fgts:             parseFloat(document.getElementById('fFgts').value) || 0,
    estadoCivil:      document.getElementById('fEstadoCivil').value,
    conjuge:          document.getElementById('fConjuge').value.trim(),
    rendaConjuge:     parseFloat(document.getElementById('fRendaConjuge').value) || 0,
    dependentes:      parseInt(document.getElementById('fDependentes').value) || 0,
    restricoes:       document.getElementById('fRestricoes').value,
    restricaoDetalhe: document.getElementById('fRestricaoDetalhe').value.trim(),

    // Tab 3 — Consórcio
    objetivo:      document.getElementById('fObjetivo').value,
    valorDesejado: parseFloat(document.getElementById('fValor').value) || 0,
    finalidade:    document.getElementById('fFinalidade').value.trim(),
    aporteMensal:  parseFloat(document.getElementById('fAporte').value) || 0,
    valorLance:    parseFloat(document.getElementById('fValorLance').value) || 0,
    tipoLance:     document.getElementById('fTipoLance').value,
    urgencia:      document.getElementById('fUrgencia').value,
    consorciado:   document.getElementById('fConsorciado').value,
    consorcioDet:  document.getElementById('fConsorcioDet').value.trim(),
    nomeCarta:     document.getElementById('fNomeCarta').value.trim(),

    // Tab 4 — Patrimônio — Imóvel
    valorImovel:      parseFloat(document.getElementById('fValorImovel').value) || 0,
    tipoImovel:       document.getElementById('fTipoImovel').value,
    donoImovel:       document.getElementById('fDonoImovel').value.trim(),
    imovelEndereco:   document.getElementById('fImovelEndereco').value.trim(),
    imovelAlugado:    document.getElementById('fImovelAlugado').value,
    imovelDebitos:    document.getElementById('fImovelDebitos').value,
    imovelFinanciado: document.getElementById('fImovelFinanciado').value.trim(),
    imovelVagas:      parseInt(document.getElementById('fImovelVagas').value) || 0,

    // Tab 4 — Patrimônio — Veículo
    valorVeiculo:      parseFloat(document.getElementById('fValorVeiculo').value) || 0,
    tipoVeiculo:       document.getElementById('fTipoVeiculo').value,
    modeloVeiculo:     document.getElementById('fModeloVeiculo').value.trim(),
    anoVeiculo:        parseInt(document.getElementById('fAnoVeiculo').value) || 0,
    placaVeiculo:      document.getElementById('fPlacaVeiculo').value.trim().toUpperCase(),
    donoVeiculo:       document.getElementById('fDonoVeiculo').value.trim(),
    veiculoDebitos:    document.getElementById('fVeiculoDebitos').value,
    veiculoFinanciado: document.getElementById('fVeiculoFinanciado').value.trim(),

    // Tab 5 — CRM
    origem:     document.getElementById('fOrigem').value,
    indicacao:  document.getElementById('fIndicacao').value.trim(),
    funnel:     funnelId,
    stage:      document.getElementById('fStage').value,
    obs:        document.getElementById('fObs').value.trim(),
  };
  let saved;
  if (editandoId) {
    saved = leadUpdate(editandoId, data);
  } else {
    if (typeof leadDedup === 'function') {
      const dup = leadDedup(data.nome, data.telefone, data.email, data.cpf);
      if (dup) {
        const ok = confirm(`Já existe um cliente com mesmo CPF/telefone/e-mail: "${dup.nome}". Deseja mesclar os dados?`);
        if (ok) {
          saved = leadMerge(dup.id, data);
          closeModal();
          if (typeof showToast === 'function') showToast(`Dados mesclados com o perfil de ${dup.nome} ✓`);
          renderFunilPage();
          if (typeof _clRefreshLista === 'function') _clRefreshLista();
          return;
        }
      }
    }
    saved = leadCreate(data);
  }
  closeModal();
  renderFunilPage();
}

function moverStage(id, stage) {
  leadMoveStage(id, stage);
  renderFunilPage();
  if (stage === 'contrato' && typeof onLeadMoveToContrato === 'function') {
    onLeadMoveToContrato(id);
  }
}

/* ── FUNNEL/STAGE SELECT HELPERS ───────────────────────────────────── */
function _funilUpdateStageOpts(funnelId) {
  const fid = funnelId || (typeof activeFunnelId !== 'undefined' ? activeFunnelId : 'vendas');
  const funnel = funnelsGet().find(f => f.id === fid);
  const stages = funnel ? funnel.stages : STAGES;
  const sel = document.getElementById('fStage');
  if (sel) sel.innerHTML = stages.map(s => `<option value="${s.id}">${_esc(s.label)}</option>`).join('');
  const funnelSel = document.getElementById('fFunnel');
  if (funnelSel) {
    funnelSel.innerHTML = funnelsGet().map(f => `<option value="${f.id}">${_esc(f.label)}</option>`).join('');
    funnelSel.value = fid;
    funnelSel.onchange = () => _funilUpdateStageOpts(funnelSel.value);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   SIM CARD MODAL — Trello-style
   ═══════════════════════════════════════════════════════════════════ */
let _currentSimId = null;
let _currentSimData = null;
let _simTituloOriginal = '';
let _allEtapas = null; // cache de todas as etapas de todos os funis

/* ── openSimModal ─────────────────────────────────────────────────── */
async function openSimModal(simId) {
  _currentSimId = simId;
  const overlay = document.getElementById('simCardOverlay');
  if (!overlay) return;

  // Show overlay with loading state
  document.getElementById('simCardHeader').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <div class="spinner" style="width:24px;height:24px;border:3px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0"></div>
      <span style="font-size:15px;color:var(--muted)">Carregando simulação...</span>
    </div>`;
  document.getElementById('simCardLeft').innerHTML = '';
  document.getElementById('simCardRight').innerHTML = '';
  overlay.style.display = 'block';
  document.body.style.overflow = 'hidden';

  try {
    const sim = await simApiGet(simId);
    _currentSimData = sim;
    _simTituloOriginal = sim.titulo || '';
    _renderSimModal(sim);
  } catch (err) {
    console.error('[simModal] Erro ao carregar simulação:', err.message);
    document.getElementById('simCardHeader').innerHTML = `
      <div style="color:#ef4444;font-size:14px"><i class="bi bi-exclamation-triangle-fill"></i> Erro ao carregar simulação. ${_esc(err.message)}</div>`;
  }
}

function closeSimModal() {
  const overlay = document.getElementById('simCardOverlay');
  if (overlay) {
    overlay.style.display = 'none';
    overlay.style.zIndex = '5000'; // restaura z-index padrão
  }
  document.body.style.overflow = '';
  _currentSimId = null;
  _currentSimData = null;
  _simTituloOriginal = '';
}

// Abre o modal da simulação sem fechar o drawer (eleva z-index acima do drawer)
function openSimModalFromDrawer(simId) {
  const overlay = document.getElementById('simCardOverlay');
  if (overlay) overlay.style.zIndex = '7000';
  openSimModal(simId);
}

function _simModalBgClick(e) {
  if (e.target === document.getElementById('simCardOverlay')) closeSimModal();
}

/* ── _renderSimModal ──────────────────────────────────────────────── */
function _renderSimModal(sim) {
  // Etapas: usa cache completo de todos os funis (preferência) ou board atual
  const etapas = _allEtapas || (_simBoardData?.etapas) || [];

  // HEADER
  const etapa = etapas.find(e => e.id === sim.etapa_funil_id);
  const etapaCor = etapa?.cor || '#94a3b8';
  const etapaLabel = etapa?.label || sim.etapa_funil_id || '—';
  const clienteNome = sim.lead?.nome || sim.lead_nome || '—';

  const clienteNomeJson = JSON.stringify(sim.lead_nome_cache || sim.lead?.nome || clienteNome);
  document.getElementById('simCardHeader').innerHTML = `
    <div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <div id="simTituloEdit"
             contenteditable="true"
             spellcheck="false"
             style="font-size:18px;font-weight:800;color:var(--primary);outline:none;border-bottom:2px solid transparent;padding:2px 4px;border-radius:4px;min-height:28px;cursor:text;transition:border-color .15s;flex:1"
             onblur="_simSaveTitulo()"
             onfocus="this.style.borderBottomColor='var(--accent)'"
             onblur_extra="this.style.borderBottomColor='transparent'"
        >${_esc(sim.titulo || 'Simulação #' + sim.id)}</div>
        ${sim.codigo ? `<span style="font-size:10px;font-weight:700;color:var(--muted);background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:2px 8px;font-family:monospace;flex-shrink:0">${_esc(sim.codigo)}</span>` : ''}
      </div>
      <div style="margin-top:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span id="simEtapaBadge" style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:8px;background:${etapaCor}22;color:${etapaCor};border:1px solid ${etapaCor}44">${_esc(etapaLabel)}</span>
        <span style="color:var(--muted);font-size:13px">Cliente: <a id="simClienteLink" href="#" onclick="event.preventDefault();closeSimModal();navigate('clientes',document.querySelector('[data-page=clientes]'));setTimeout(()=>{const ls=typeof storeGet==='function'&&storeGet().find(l=>l.nome===${clienteNomeJson}||(${sim.lead?.id||'null'}&&String(l.id)===String(${sim.lead?.id||'null'})));if(ls&&typeof _clOpenPerfil==='function')_clOpenPerfil(ls.id);},300)" style="color:var(--accent);font-weight:700;text-decoration:none">${_esc(clienteNome)}</a></span>
        ${sim.credito ? `<span style="font-size:12px;font-weight:700;color:var(--primary)">${fmtValor(sim.credito)}</span>` : ''}
      </div>
    </div>`;

  // Fix blur handler (contenteditable doesn't support multiple onblur)
  const tituloEl = document.getElementById('simTituloEdit');
  if (tituloEl) {
    tituloEl.addEventListener('blur', () => {
      tituloEl.style.borderBottomColor = 'transparent';
      _simSaveTitulo();
    });
    tituloEl.addEventListener('focus', () => {
      tituloEl.style.borderBottomColor = 'var(--accent)';
    });
    // Remove inline onblur to avoid double-fire
    tituloEl.removeAttribute('onblur');
    tituloEl.removeAttribute('onblur_extra');
  }

  // LEFT COLUMN
  _renderSimLeft(sim);

  // RIGHT COLUMN
  _renderSimRight(sim, etapas);
}

function _renderSimLeft(sim) {
  const anotacoesHtml = _buildAnotacoesFeed(sim.anotacoes || []);
  const checklistHtml = _buildChecklistItems(sim.checklist_items || []);
  const { pct, fill } = _checklistProgress(sim.checklist_items || []);

  document.getElementById('simCardLeft').innerHTML = `
    <!-- Anotações -->
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--primary);margin-bottom:10px"><i class="bi bi-chat-left-text-fill"></i> Anotações</div>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <textarea id="simNovaAnotacao"
                  placeholder="Adicionar anotação..."
                  style="flex:1;resize:none;border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;min-height:60px;outline:none;transition:border-color .15s"
                  onfocus="this.style.borderColor='var(--accent)'"
                  onblur="this.style.borderColor='var(--border)'"
                  onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();_simEnviarAnotacao()}"></textarea>
        <button onclick="_simEnviarAnotacao()" style="align-self:flex-end;padding:8px 14px;background:var(--primary);color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;transition:opacity .15s" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">Enviar</button>
      </div>
      <div id="simAnotacoesFeed">${anotacoesHtml}</div>
    </div>

    <!-- Checklist -->
    <div style="margin-top:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="font-size:13px;font-weight:700;color:var(--primary)"><i class="bi bi-check2-square"></i> Checklist</div>
        <span id="simCheckPct" style="font-size:12px;font-weight:700;color:var(--muted)">${pct}%</span>
      </div>
      <div id="simProgressBar" style="height:6px;background:#e2e8f0;border-radius:3px;margin-bottom:12px">
        <div id="simProgressFill" style="height:100%;border-radius:3px;background:#16a34a;width:${fill}%;transition:width .3s"></div>
      </div>
      <div id="simChecklistItems">${checklistHtml}</div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <input id="simNovoCheckTxt"
               type="text"
               placeholder="Novo item..."
               style="flex:1;border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:13px;outline:none;transition:border-color .15s"
               onfocus="this.style.borderColor='var(--accent)'"
               onblur="this.style.borderColor='var(--border)'"
               onkeydown="if(event.key==='Enter')_simAddCheck()" />
        <button onclick="_simAddCheck()" style="padding:6px 12px;background:var(--primary);color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600">+ Add</button>
      </div>
    </div>`;
}

function _renderSimRight(sim, etapas) {
  // Monta options agrupados por funil quando _allEtapas disponível
  let etapaOptions;
  if (_allEtapas && _allEtapas.length > 0) {
    const gruposMap = {};
    for (const e of _allEtapas) {
      if (!gruposMap[e.funil_id]) gruposMap[e.funil_id] = { label: e.funil_label, etapas: [] };
      gruposMap[e.funil_id].etapas.push(e);
    }
    etapaOptions = Object.values(gruposMap).map(g =>
      `<optgroup label="${_esc(g.label)}">${g.etapas.map(e =>
        `<option value="${_esc(e.id)}" ${e.id === sim.etapa_funil_id ? 'selected' : ''}>${_esc(e.label)}</option>`
      ).join('')}</optgroup>`
    ).join('');
  } else {
    etapaOptions = etapas.map(e =>
      `<option value="${_esc(e.id)}" ${e.id === sim.etapa_funil_id ? 'selected' : ''}>${_esc(e.label)}</option>`
    ).join('');
  }

  document.getElementById('simCardRight').innerHTML = `
    <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">Ações</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="font-size:12px;font-weight:600;color:var(--primary);margin-bottom:2px">Mover para:</div>
      ${etapas.length > 0 ? `
      <select id="simMoverEtapa"
              onchange="_simMoverEtapa(this.value)"
              style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:12px;outline:none;cursor:pointer;transition:border-color .15s"
              onfocus="this.style.borderColor='var(--accent)'"
              onblur="this.style.borderColor='var(--border)'">
        ${etapaOptions}
      </select>` : `<div style="font-size:12px;color:var(--muted);padding:6px 0">Carregue o board para ver as etapas.</div>`}

      <button onclick="_simArquivar()"
              style="padding:8px;border:1px solid #fca5a5;border-radius:8px;background:white;color:#ef4444;font-size:12px;cursor:pointer;font-weight:600;transition:background .15s;margin-top:4px"
              onmouseover="this.style.background='#fef2f2'"
              onmouseout="this.style.background='white'">
        <i class="bi bi-archive"></i> Arquivar
      </button>

      <button onclick="event.stopPropagation();(async()=>{const nm=${JSON.stringify(sim.lead_nome_cache || sim.lead?.nome || sim.lead_nome || '')};let lid=${sim.lead?.id != null ? sim.lead.id : 'null'};if(!lid&&nm&&typeof storeGet==='function'){const f=storeGet().find(l=>l.nome===nm);if(f)lid=f.id;}closeSimModal();navigate('clientes',document.querySelector('[data-page=clientes]'));if(lid)setTimeout(()=>typeof _clOpenPerfil==='function'&&_clOpenPerfil(lid),300);})()"
              style="padding:8px;border:1px solid var(--accent);border-radius:8px;background:white;color:var(--accent);font-size:12px;cursor:pointer;font-weight:600;transition:background .15s;margin-top:4px"
              onmouseover="this.style.background='#eef2ff'"
              onmouseout="this.style.background='white'">
        <i class="bi bi-person-circle"></i> Ver Perfil do Cliente
      </button>
    </div>`;
}

/* ── Anotações ────────────────────────────────────────────────────── */
function _buildAnotacoesFeed(anotacoes) {
  if (!anotacoes.length) return `<div style="color:var(--muted);font-size:12px;padding:8px 0">Nenhuma anotação ainda.</div>`;
  return anotacoes.map(a => {
    const nome = a.user_nome || 'Usuário';
    const initial = nome.charAt(0).toUpperCase();
    const data = a.criado_em ? new Date(a.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    return `
      <div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${initial}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700;color:var(--primary)">${_esc(nome)}</div>
          <div style="font-size:13px;color:#374151;margin:3px 0;white-space:pre-wrap;word-break:break-word">${_esc(a.texto)}</div>
          <div style="font-size:11px;color:var(--muted)">${data}</div>
        </div>
        <button onclick="_simDelAnotacao(${a.id})"
                style="border:none;background:none;cursor:pointer;color:var(--muted);font-size:12px;align-self:flex-start;flex-shrink:0;padding:2px 4px;border-radius:4px;transition:color .15s"
                onmouseover="this.style.color='#ef4444'"
                onmouseout="this.style.color='var(--muted)'"
                title="Excluir">✕</button>
      </div>`;
  }).join('');
}

async function _simEnviarAnotacao() {
  const ta = document.getElementById('simNovaAnotacao');
  const txt = ta?.value.trim();
  if (!txt || !_currentSimId) return;
  ta.disabled = true;
  try {
    await simApiAddAnotacao(_currentSimId, txt);
    ta.value = '';
    // Reload sim to refresh anotações
    const sim = await simApiGet(_currentSimId);
    _currentSimData = sim;
    document.getElementById('simAnotacoesFeed').innerHTML = _buildAnotacoesFeed(sim.anotacoes || []);
  } catch (err) {
    alert('Erro ao enviar anotação: ' + err.message);
  } finally {
    if (ta) ta.disabled = false;
  }
}

async function _simDelAnotacao(id) {
  if (!confirm('Excluir esta anotação?')) return;
  try {
    await simApiDelAnotacao(id);
    const sim = await simApiGet(_currentSimId);
    _currentSimData = sim;
    document.getElementById('simAnotacoesFeed').innerHTML = _buildAnotacoesFeed(sim.anotacoes || []);
  } catch (err) {
    alert('Erro ao excluir anotação: ' + err.message);
  }
}

/* ── Checklist ────────────────────────────────────────────────────── */
function _checklistProgress(items) {
  const total = items.length;
  const feito = items.filter(i => i.feito).length;
  const pct = total > 0 ? Math.round(feito / total * 100) : 0;
  return { pct, fill: pct };
}

function _buildChecklistItems(items) {
  if (!items.length) return '';
  return items.map(item => `
    <div id="ci-${item.id}" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9">
      <input type="checkbox" ${item.feito ? 'checked' : ''}
             onchange="_simToggleCheck(${item.id}, this.checked)"
             style="width:15px;height:15px;cursor:pointer;accent-color:#16a34a;flex-shrink:0" />
      <span style="flex:1;font-size:13px;color:${item.feito ? 'var(--muted)' : '#374151'};${item.feito ? 'text-decoration:line-through' : ''}">${_esc(item.texto)}</span>
      <button onclick="_simDelCheck(${item.id})"
              style="border:none;background:none;cursor:pointer;color:#cbd5e1;font-size:12px;padding:2px 4px;border-radius:4px;transition:color .15s"
              onmouseover="this.style.color='#ef4444'"
              onmouseout="this.style.color='#cbd5e1'"
              title="Remover">✕</button>
    </div>`).join('');
}

function _updateChecklistUI(items) {
  const { pct, fill } = _checklistProgress(items);
  const pctEl = document.getElementById('simCheckPct');
  const fillEl = document.getElementById('simProgressFill');
  const itemsEl = document.getElementById('simChecklistItems');
  if (pctEl) pctEl.textContent = pct + '%';
  if (fillEl) fillEl.style.width = fill + '%';
  if (itemsEl) itemsEl.innerHTML = _buildChecklistItems(items);
}

async function _simAddCheck() {
  const inp = document.getElementById('simNovoCheckTxt');
  const txt = inp?.value.trim();
  if (!txt || !_currentSimId) return;
  inp.disabled = true;
  try {
    await simApiAddChecklist(_currentSimId, txt);
    inp.value = '';
    const sim = await simApiGet(_currentSimId);
    _currentSimData = sim;
    _updateChecklistUI(sim.checklist_items || []);
  } catch (err) {
    alert('Erro ao adicionar item: ' + err.message);
  } finally {
    if (inp) inp.disabled = false;
  }
}

async function _simToggleCheck(itemId, val) {
  try {
    await simApiToggleCheck(itemId, val);
    const sim = await simApiGet(_currentSimId);
    _currentSimData = sim;
    _updateChecklistUI(sim.checklist_items || []);
  } catch (err) {
    alert('Erro ao atualizar item: ' + err.message);
  }
}

async function _simDelCheck(itemId) {
  try {
    await simApiDelCheck(itemId);
    const sim = await simApiGet(_currentSimId);
    _currentSimData = sim;
    _updateChecklistUI(sim.checklist_items || []);
  } catch (err) {
    alert('Erro ao remover item: ' + err.message);
  }
}

/* ── Título inline save ───────────────────────────────────────────── */
async function _simSaveTitulo() {
  const el = document.getElementById('simTituloEdit');
  if (!el || !_currentSimId) return;
  const novo = el.textContent.trim();
  if (novo === _simTituloOriginal) return;
  try {
    await simApiPatch(_currentSimId, { titulo: novo });
    _simTituloOriginal = novo;
    if (_currentSimData) _currentSimData.titulo = novo;
    // Re-render board card title
    _simBoardData = null;
  } catch (err) {
    console.error('[simModal] Erro ao salvar título:', err.message);
  }
}

/* ── Mover etapa ──────────────────────────────────────────────────── */
async function _simMoverEtapa(etapaId) {
  if (!_currentSimId || !etapaId) return;
  try {
    await simApiPatch(_currentSimId, { etapa_funil_id: etapaId });
    if (_currentSimData) _currentSimData.etapa_funil_id = etapaId;

    // Update badge
    const etapas = _simBoardData?.etapas || [];
    const etapa = etapas.find(e => e.id === etapaId);
    const badge = document.getElementById('simEtapaBadge');
    if (badge && etapa) {
      badge.textContent = etapa.label;
      badge.style.background = etapa.cor + '22';
      badge.style.color = etapa.cor;
      badge.style.borderColor = etapa.cor + '44';
    }

    // Re-render board in background
    _simBoardData = null;
    const funnels = funnelsGet();
    const activeFunnel = funnels.find(f => f.id === activeFunnelId) || funnels[0];
    if (activeFunnel) {
      _loadSimBoard(activeFunnelId, activeFunnel);
    }
  } catch (err) {
    alert('Erro ao mover etapa: ' + err.message);
  }
}

/* ── Arquivar ─────────────────────────────────────────────────────── */
async function _simArquivar() {
  if (!_currentSimId) return;
  if (!confirm('Arquivar esta simulação? Ela não aparecerá mais no board.')) return;
  try {
    await simApiPatch(_currentSimId, { arquivado: true });
    closeSimModal();
    _simBoardData = null;
    await renderFunilPage();
  } catch (err) {
    alert('Erro ao arquivar: ' + err.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   NOVA SIM MODAL — Criar nova simulação
   ═══════════════════════════════════════════════════════════════════ */
function openNovaSimModal(etapaId) {
  const leads = storeGet();
  const leadOptions = leads.map(l =>
    `<option value="${l.id}">${_esc(l.nome)}${l.telefone ? ' — ' + _esc(l.telefone) : ''}</option>`
  ).join('');

  const existing = document.getElementById('novaSimOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'novaSimOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:5500;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;width:100%;max-width:460px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.25);position:relative">
      <div style="font-size:17px;font-weight:800;color:var(--primary);margin-bottom:20px"><i class="bi bi-plus-circle-fill" style="color:var(--accent)"></i> Nova Simulação</div>

      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Cliente (opcional)</label>
          <select id="nsLeadId" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;outline:none;cursor:pointer">
            <option value="">— Sem cliente —</option>
            ${leadOptions}
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Título</label>
          <input id="nsTitulo" type="text" placeholder="Ex: Proposta Imóvel 500k" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;transition:border-color .15s" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'" />
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Crédito (R$)</label>
          <input id="nsCredito" type="number" placeholder="500000" min="0" step="1000" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;transition:border-color .15s" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'" />
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:22px;justify-content:flex-end">
        <button onclick="document.getElementById('novaSimOverlay').remove()"
                style="padding:9px 18px;border:1px solid var(--border);border-radius:8px;background:white;color:var(--muted);font-size:13px;cursor:pointer;font-weight:600">Cancelar</button>
        <button onclick="_salvarNovaSim('${etapaId}')"
                style="padding:9px 18px;border:none;border-radius:8px;background:var(--primary);color:white;font-size:13px;cursor:pointer;font-weight:700;transition:opacity .15s"
                onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
          <i class="bi bi-plus-lg"></i> Criar Simulação
        </button>
      </div>

      <button onclick="document.getElementById('novaSimOverlay').remove()"
              style="position:absolute;top:16px;right:16px;border:none;background:rgba(0,0,0,0.08);border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;color:var(--primary)">✕</button>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  document.getElementById('nsTitulo').focus();
}

async function _salvarNovaSim(etapaId) {
  const leadSel  = document.getElementById('nsLeadId');
  const leadOpt  = leadSel?.selectedOptions[0];
  // localStorage IDs são strings como 'lead_123' ou pequenos inteiros — não correspondem ao banco
  // Usamos lead_nome_cache para preservar o nome sem referência incorreta de FK
  const leadNome = (leadOpt && leadOpt.value) ? leadOpt.text.split(' — ')[0].trim() : '';
  const titulo   = document.getElementById('nsTitulo')?.value.trim();
  const credito  = parseFloat(document.getElementById('nsCredito')?.value) || 0;

  if (!titulo && !leadNome) {
    alert('Informe um título ou selecione um cliente.'); return;
  }

  const btn = document.querySelector('#novaSimOverlay button[onclick*="_salvarNovaSim"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Criando...'; }

  try {
    await simApiCreate({
      lead_id:         null,  // IDs do localStorage não existem no banco
      titulo:          titulo || (leadNome + (credito ? ' — ' + fmtValor(credito) : '')),
      credito:         credito,
      etapa_funil_id:  etapaId,
      lead_nome_cache: leadNome || null,
    });
    document.getElementById('novaSimOverlay')?.remove();
    _simBoardData = null;
    await renderFunilPage();
  } catch (err) {
    alert('Erro ao criar simulação: ' + err.message);
    if (btn) { btn.disabled = false; btn.textContent = '+ Criar Simulação'; }
  }
}

/* ═══════════════════════════════════════════════════════════════════
   CLIENT DRAWER — navegação para perfil completo
   ═══════════════════════════════════════════════════════════════════ */
async function openClientDrawer(leadId, leadNome) {
  // Navigate to full client profile page instead of opening drawer
  const nome = leadNome || '';
  let lsId = leadId;
  if (!lsId && nome && typeof storeGet === 'function') {
    const found = storeGet().find(l => l.nome === nome);
    if (found) lsId = found.id;
  }
  closeSimModal();
  navigate('clientes', document.querySelector('[data-page=clientes]'));
  if (lsId) {
    setTimeout(() => {
      if (typeof _clOpenPerfil === 'function') _clOpenPerfil(lsId);
    }, 300);
  }
}

function closeClientDrawer() {
  // No-op: drawer removed
}

/* ═══════════════════════════════════════════════════════════════════
   INJETAR HTML NO DOM AO CARREGAR
   ═══════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const origemOpts = ORIGENS.map(o => `<option>${o}</option>`).join('');
  const objOpts    = OBJETIVOS.map(o => `<option>${o}</option>`).join('');
  const stageOpts  = STAGES.map(s => `<option value="${s.id}">${s.label}</option>`).join('');

  document.body.insertAdjacentHTML('beforeend', `
    <!-- MODAL LEAD -->
    <div class="modal-overlay" id="modalLead" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title" id="modalTitle">Novo Lead</span>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <form id="leadForm" onsubmit="event.preventDefault();salvarLead()">

          <!-- Tab pills -->
          <div class="lead-tabs">
            <button type="button" id="ltabBtn-contato"    class="ltab-btn" onclick="_leadTab('contato')">1. Contato</button>
            <button type="button" id="ltabBtn-financeiro" class="ltab-btn" onclick="_leadTab('financeiro')">2. Financeiro</button>
            <button type="button" id="ltabBtn-consorcio"  class="ltab-btn" onclick="_leadTab('consorcio')">3. Histórico</button>
            <button type="button" id="ltabBtn-patrimonio" class="ltab-btn" onclick="_leadTab('patrimonio')">4. Patrimônio</button>
            <button type="button" id="ltabBtn-crm"        class="ltab-btn" onclick="_leadTab('crm')">5. CRM</button>
          </div>

          <!-- ══ TAB 1 — CONTATO & PESSOAL ══ -->
          <div id="ltab-contato" class="lead-tab-pane">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Nome *</label>
                <input class="form-input" id="fNome" placeholder="Nome completo" required />
              </div>
              <div class="form-group">
                <label class="form-label">Telefone *</label>
                <input class="form-input" id="fTelefone" placeholder="(11) 99999-0000" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">E-mail</label>
                <input class="form-input" id="fEmail" type="email" placeholder="email@exemplo.com" />
              </div>
              <div class="form-group">
                <label class="form-label">CPF</label>
                <input class="form-input" id="fCpf" placeholder="000.000.000-00" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Data de Nascimento</label>
                <input class="form-input" id="fDataNasc" type="date" />
              </div>
              <div class="form-group">
                <label class="form-label">Profissão / Cargo</label>
                <input class="form-input" id="fProfissao" type="text" placeholder="Ex: Médico, Engenheiro" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Empresa / Empregador</label>
                <input class="form-input" id="fEmpresa" type="text" placeholder="Nome da empresa" />
              </div>
              <div class="form-group">
                <label class="form-label">Tempo na atividade</label>
                <input class="form-input" id="fTempoAtividade" type="text" placeholder="Ex: 5 anos, desde 2019" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Cidade</label>
                <input class="form-input" id="fCidade" type="text" />
              </div>
              <div class="form-group">
                <label class="form-label">Estado / UF</label>
                <input class="form-input" id="fEstado" type="text" maxlength="2" placeholder="SP" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Bairro</label>
                <input class="form-input" id="fBairro" type="text" />
              </div>
              <div class="form-group">
                <label class="form-label">Melhor horário p/ contato</label>
                <input class="form-input" id="fHorarioContato" type="text" placeholder="Ex: tarde, após 17h" />
              </div>
            </div>
          </div><!-- /ltab-contato -->

          <!-- ══ TAB 2 — RENDA & CRÉDITO ══ -->
          <div id="ltab-financeiro" class="lead-tab-pane">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Modelo de renda</label>
                <select class="form-select" id="fModeloRenda">
                  <option value="">— selecione —</option>
                  <option value="Funcionário Público / CLT">Funcionário Público / CLT</option>
                  <option value="Funcionário Público / Estatutário">Funcionário Público / Estatutário</option>
                  <option value="Assalariado / CLT">Assalariado / CLT</option>
                  <option value="Prestador de Serviços / PJ">Prestador de Serviços / PJ</option>
                  <option value="MEI">MEI</option>
                  <option value="Empresário">Empresário</option>
                  <option value="Autônomo">Autônomo</option>
                  <option value="Aposentado / Pensionista">Aposentado / Pensionista</option>
                  <option value="Renda de Aluguel">Renda de Aluguel</option>
                  <option value="Renda de Investimentos">Renda de Investimentos</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Renda bruta mensal R$</label>
                <input class="form-input" id="fRendaMensal" type="number" min="0" step="100" placeholder="Ex: 8000" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Comprometimento de renda atual %</label>
                <input class="form-input" id="fCompRenda" type="number" step="1" min="0" max="100" placeholder="% da renda já comprometida com parcelas/aluguel" />
              </div>
              <div class="form-group">
                <label class="form-label">FGTS disponível para lance R$</label>
                <input class="form-input" id="fFgts" type="number" min="0" step="100" placeholder="0 se não tem ou não pode usar" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Estado civil</label>
                <select class="form-select" id="fEstadoCivil">
                  <option value="">— selecione —</option>
                  <option value="Solteiro(a)">Solteiro(a)</option>
                  <option value="Casado(a)">Casado(a)</option>
                  <option value="União Estável">União Estável</option>
                  <option value="Divorciado(a)">Divorciado(a)</option>
                  <option value="Viúvo(a)">Viúvo(a)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Nome do cônjuge / companheiro(a)</label>
                <input class="form-input" id="fConjuge" type="text" placeholder="Nome completo" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Renda do cônjuge R$</label>
                <input class="form-input" id="fRendaConjuge" type="number" min="0" step="100" />
              </div>
              <div class="form-group">
                <label class="form-label">Dependentes financeiros</label>
                <input class="form-input" id="fDependentes" type="number" step="1" min="0" placeholder="filhos + outros" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Possui restrição no CPF (SPC/Serasa)?</label>
              <select class="form-select" id="fRestricoes">
                <option value="">— selecione —</option>
                <option value="Não">Não</option>
                <option value="Sim — pendências menores">Sim — pendências menores</option>
                <option value="Sim — negativado">Sim — negativado</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Detalhes das restrições</label>
              <textarea class="form-textarea" id="fRestricaoDetalhe" rows="2" placeholder="Descreva se souber os valores/credores"></textarea>
            </div>
          </div><!-- /ltab-financeiro -->

          <!-- ══ TAB 3 — HISTÓRICO & INTENÇÃO ══ -->
          <!-- Apenas dados de perfil: o que o cliente quer e seu histórico.
               Valores de simulação (carta, aporte, lance) ficam no Simulador. -->
          <div id="ltab-consorcio" class="lead-tab-pane">
            <div class="form-group">
              <label class="form-label">Intenção geral de crédito</label>
              <select class="form-select" id="fObjetivo">
                <option value="">— selecione —</option>
                <option value="Comprar Imóvel Residencial">Comprar Imóvel Residencial</option>
                <option value="Comprar Imóvel Comercial">Comprar Imóvel Comercial</option>
                <option value="Reforma / Construção">Reforma / Construção</option>
                <option value="Comprar Carro">Comprar Carro</option>
                <option value="Comprar Moto / Veículo Pesado">Comprar Moto / Veículo Pesado</option>
                <option value="Quitação de Financiamento">Quitação de Financiamento</option>
                <option value="Capital de Giro">Capital de Giro</option>
                <option value="Outro">Outro</option>
              </select>
              <div style="font-size:11px;color:var(--muted);margin-top:4px">Tipo de crédito que o cliente busca — os valores serão definidos no Simulador.</div>
            </div>
            <div class="form-group">
              <label class="form-label">Descrição da necessidade</label>
              <textarea class="form-textarea" id="fFinalidade" rows="3" placeholder="Ex: Quer trocar o apartamento que está pagando aluguel, precisa de imóvel de 3 quartos no ABC…"></textarea>
            </div>

            <div style="margin-top:4px;padding-top:12px;border-top:1px solid var(--border)">
              <div class="lead-section-hd" style="margin-top:0"><i class="bi bi-clock-history"></i> Histórico em Consórcio</div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Já participou de consórcio antes?</label>
                <select class="form-select" id="fConsorciado">
                  <option value="">— selecione —</option>
                  <option value="Não">Não</option>
                  <option value="Sim — contemplado">Sim — contemplado</option>
                  <option value="Sim — não contemplado">Sim — não contemplado</option>
                  <option value="Sim — desistiu">Sim — desistiu</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">A carta ficará em nome de quem?</label>
                <input class="form-input" id="fNomeCarta" type="text" placeholder="Próprio cliente ou terceiro" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Detalhes do consórcio anterior</label>
              <textarea class="form-textarea" id="fConsorcioDet" rows="2" placeholder="Administradora, grupo, valor da carta, situação atual…"></textarea>
            </div>

            <!-- Campos ocultos para compatibilidade com dados antigos -->
            <input type="hidden" id="fValor" />
            <input type="hidden" id="fAporte" />
            <input type="hidden" id="fValorLance" />
            <input type="hidden" id="fTipoLance" />
            <input type="hidden" id="fUrgencia" />
          </div><!-- /ltab-consorcio -->

          <!-- ══ TAB 4 — PATRIMÔNIO ══ -->
          <div id="ltab-patrimonio" class="lead-tab-pane">

            <!-- Imóvel -->
            <div class="lead-section-hd"><i class="bi bi-house-fill"></i> Imóvel</div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Valor atual R$</label>
                <input class="form-input" id="fValorImovel" type="number" min="0" step="1000" />
              </div>
              <div class="form-group">
                <label class="form-label">Tipo</label>
                <select class="form-select" id="fTipoImovel">
                  <option value="">— selecione —</option>
                  <option value="Apartamento">Apartamento</option>
                  <option value="Casa">Casa</option>
                  <option value="Terreno">Terreno</option>
                  <option value="Sala Comercial">Sala Comercial</option>
                  <option value="Galpão">Galpão</option>
                  <option value="Chácara / Sítio">Chácara / Sítio</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Em nome de quem?</label>
                <input class="form-input" id="fDonoImovel" type="text" />
              </div>
              <div class="form-group">
                <label class="form-label">Endereço do imóvel</label>
                <input class="form-input" id="fImovelEndereco" type="text" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Alugado?</label>
                <select class="form-select" id="fImovelAlugado">
                  <option value="">—</option>
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Débitos (IPTU/condomínio)?</label>
                <select class="form-select" id="fImovelDebitos">
                  <option value="">—</option>
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Financiado? + saldo devedor</label>
                <input class="form-input" id="fImovelFinanciado" type="text" placeholder="Ex: Sim — saldo R$ 120.000" />
              </div>
              <div class="form-group">
                <label class="form-label">Vagas de garagem</label>
                <input class="form-input" id="fImovelVagas" type="number" min="0" step="1" />
              </div>
            </div>

            <!-- Veículo -->
            <div class="lead-section-hd"><i class="bi bi-car-front-fill"></i> Veículo</div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Valor atual R$</label>
                <input class="form-input" id="fValorVeiculo" type="number" min="0" step="500" />
              </div>
              <div class="form-group">
                <label class="form-label">Tipo</label>
                <select class="form-select" id="fTipoVeiculo">
                  <option value="">— selecione —</option>
                  <option value="Carro">Carro</option>
                  <option value="Moto">Moto</option>
                  <option value="Caminhão">Caminhão</option>
                  <option value="Van / Utilitário">Van / Utilitário</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Marca / Modelo</label>
                <input class="form-input" id="fModeloVeiculo" type="text" placeholder="Ex: Toyota Corolla 2022" />
              </div>
              <div class="form-group">
                <label class="form-label">Ano</label>
                <input class="form-input" id="fAnoVeiculo" type="number" min="1990" max="2030" placeholder="Ex: 2020" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Placa</label>
                <input class="form-input" id="fPlacaVeiculo" type="text" placeholder="Ex: ABC-1D23" />
              </div>
              <div class="form-group">
                <label class="form-label">Em nome de quem?</label>
                <input class="form-input" id="fDonoVeiculo" type="text" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Débitos (multas/IPVA)?</label>
                <select class="form-select" id="fVeiculoDebitos">
                  <option value="">—</option>
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Financiado? + saldo</label>
                <input class="form-input" id="fVeiculoFinanciado" type="text" placeholder="Ex: Sim — saldo R$ 25.000" />
              </div>
            </div>

          </div><!-- /ltab-patrimonio -->

          <!-- ══ TAB 5 — FUNIL / CRM ══ -->
          <div id="ltab-crm" class="lead-tab-pane">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Origem do lead</label>
                <select class="form-select" id="fOrigem">
                  <option value="">— selecione —</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Google">Google</option>
                  <option value="Indicação">Indicação</option>
                  <option value="Ligação Ativa">Ligação Ativa</option>
                  <option value="Site">Site</option>
                  <option value="Evento">Evento</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Quem indicou</label>
                <input class="form-input" id="fIndicacao" type="text" placeholder="Nome do indicador" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Funil</label>
                <select class="form-select" id="fFunnel">${DEFAULT_FUNNELS.map(f => `<option value="${f.id}">${f.label}</option>`).join('')}</select>
              </div>
              <div class="form-group">
                <label class="form-label">Etapa</label>
                <select class="form-select" id="fStage">${stageOpts}</select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Observações do vendedor</label>
              <textarea class="form-textarea" id="fObs" rows="4" placeholder="Anotações internas sobre o cliente..."></textarea>
            </div>
          </div><!-- /ltab-crm -->

          <!-- Footer navigation -->
          <div class="form-actions" style="justify-content:space-between">
            <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
            <div style="display:flex;gap:8px">
              <button type="button" id="leadBtnPrev" class="btn btn-ghost" onclick="_leadTabPrev()" style="display:none">&#8592; Anterior</button>
              <button type="button" id="leadBtnNext" class="btn btn-outline" onclick="_leadTabNext()">Próximo &#8594;</button>
              <button type="submit" id="leadBtnSave" class="btn btn-primary" style="display:none">Salvar Lead</button>
            </div>
          </div>

        </form>
      </div>
    </div>

    <!-- SIM CARD MODAL (Trello-style) -->
    <div id="simCardOverlay"
         style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:5000;overflow-y:auto;padding:40px 16px"
         onclick="_simModalBgClick(event)">
      <div id="simCardModal" style="background:white;border-radius:16px;width:100%;max-width:860px;margin:0 auto;box-shadow:0 20px 60px rgba(0,0,0,0.25);position:relative">
        <!-- HEADER -->
        <div id="simCardHeader" style="padding:24px 28px 16px;border-bottom:1px solid var(--border)"></div>
        <!-- BODY: two columns -->
        <div style="display:flex;gap:0">
          <!-- LEFT: anotações + checklist -->
          <div id="simCardLeft" style="flex:1;min-width:0;padding:20px 28px;border-right:1px solid var(--border)"></div>
          <!-- RIGHT: actions sidebar -->
          <div id="simCardRight" style="width:200px;flex-shrink:0;padding:20px 20px"></div>
        </div>
        <!-- CLOSE btn -->
        <button onclick="closeSimModal()"
                style="position:absolute;top:16px;right:16px;border:none;background:rgba(0,0,0,0.08);border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;color:var(--primary)">✕</button>
      </div>
    </div>

  `);

  // ESC key handler
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSimModal();
  });
});
