/* =====================================================================
   CONTRATOS — Gestão e acompanhamento de contratos
   Persiste em localStorage: crm_contratos
   ===================================================================== */

const CONT_KEY = 'crm_contratos';

function contGet()     { try { return JSON.parse(localStorage.getItem(CONT_KEY) || '[]'); } catch { return []; } }
function contSet(list) { localStorage.setItem(CONT_KEY, JSON.stringify(list)); }

function contCreate(patch) {
  const list = contGet();
  const c = { id: Date.now(), criadoEm: new Date().toISOString(), status: 'ativo', ...patch };
  list.push(c);
  contSet(list);
  return c;
}

function contUpdate(id, patch) {
  contSet(contGet().map(c => c.id === id ? { ...c, ...patch, atualizadoEm: new Date().toISOString() } : c));
}

function contDelete(id) { contSet(contGet().filter(c => c.id !== id)); }

/* ── Estado ── */
const CONT = { filtro: 'todos', busca: '' };

function initContratos() {
  const el = document.getElementById('page-contratos');
  if (!el) return;
  el.innerHTML = _contRender();
}

function _contRender() {
  const lista = contGet();
  const leads = storeGet();

  const kpis = {
    total:     lista.length,
    ativos:    lista.filter(c => c.status === 'ativo').length,
    pendentes: lista.filter(c => c.status === 'pendente').length,
    valor:     lista.filter(c => c.status === 'ativo').reduce((s,c) => s+(c.valor||0), 0),
  };

  let filtered = [...lista];
  if (CONT.filtro !== 'todos') filtered = filtered.filter(c => c.status === CONT.filtro);
  if (CONT.busca) {
    const b = CONT.busca.toLowerCase();
    filtered = filtered.filter(c => (c.leadNome||'').toLowerCase().includes(b) || (c.titulo||'').toLowerCase().includes(b));
  }
  filtered.sort((a, b) => (b.criadoEm||'').localeCompare(a.criadoEm||''));

  const statusMap = {
    ativo:      { label:'Ativo',      color:'#16a34a' },
    pendente:   { label:'Pendente',   color:'#d97706' },
    cancelado:  { label:'Cancelado',  color:'#ef4444' },
    encerrado:  { label:'Encerrado',  color:'#6b7280' },
  };

  return `
    <div class="page-header">
      <div><div class="page-title">Contratos</div><div class="page-subtitle">Gestão e acompanhamento de contratos</div></div>
      <button class="btn btn-primary" onclick="_contAbrirModal()"><i class="bi bi-plus-lg"></i> Novo Contrato</button>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;margin-bottom:20px">
      ${_contKpi('Total',       kpis.total,          'bi-pen-fill',          'var(--primary)')}
      ${_contKpi('Ativos',      kpis.ativos,          'bi-check-circle-fill', '#16a34a')}
      ${_contKpi('Pendentes',   kpis.pendentes,       'bi-hourglass-split',   '#d97706')}
      ${_contKpi('Valor Ativo', fmtValor(kpis.valor), 'bi-currency-dollar',   '#0891b2')}
    </div>

    <!-- Filtros -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
      <input class="form-input" placeholder="Buscar cliente ou contrato..." style="max-width:280px"
        value="${_esc(CONT.busca)}" oninput="CONT.busca=this.value;initContratos()" />
      ${['todos','ativo','pendente','cancelado','encerrado'].map(s => `
        <button class="btn btn-sm ${CONT.filtro===s?'btn-primary':'btn-ghost'}" onclick="CONT.filtro='${s}';initContratos()">
          ${s==='todos'?'Todos':statusMap[s]?.label||s}
        </button>`).join('')}
    </div>

    <!-- Lista -->
    ${filtered.length === 0
      ? `<div class="card" style="text-align:center;padding:60px 20px;color:var(--muted)">
          <i class="bi bi-pen" style="font-size:40px;display:block;margin-bottom:12px;opacity:.3"></i>
          Nenhum contrato encontrado. Crie o primeiro ou aprove uma proposta!
        </div>`
      : `<div style="display:grid;gap:12px">
          ${filtered.map(c => {
            const st   = statusMap[c.status] || { label: c.status, color:'#6b7280' };
            const dias = c.dataFim ? Math.ceil((new Date(c.dataFim) - new Date()) / 86400000) : null;
            return `
              <div class="card" style="border-left:4px solid ${st.color}">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap">
                  <div style="flex:1;min-width:0">
                    <div style="font-size:14px;font-weight:800;color:var(--primary);margin-bottom:3px">${_esc(c.titulo||'Contrato sem título')}</div>
                    <div style="font-size:12px;color:var(--muted)">${_esc(c.leadNome||'—')}${c.numero?' · Nº '+_esc(c.numero):''}</div>
                  </div>
                  <span style="font-size:10px;font-weight:700;background:${st.color}22;color:${st.color};padding:3px 8px;border-radius:8px;white-space:nowrap">${st.label}</span>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-bottom:12px">
                  <div style="background:var(--bg);border-radius:8px;padding:8px 10px">
                    <div style="font-size:10px;color:var(--muted);font-weight:600">Valor</div>
                    <div style="font-size:13px;font-weight:800;color:var(--primary)">${fmtValor(c.valor)}</div>
                  </div>
                  <div style="background:var(--bg);border-radius:8px;padding:8px 10px">
                    <div style="font-size:10px;color:var(--muted);font-weight:600">Início</div>
                    <div style="font-size:12px;font-weight:700">${c.dataInicio ? new Date(c.dataInicio+'T00:00:00').toLocaleDateString('pt-BR') : '—'}</div>
                  </div>
                  <div style="background:var(--bg);border-radius:8px;padding:8px 10px">
                    <div style="font-size:10px;color:var(--muted);font-weight:600">Encerramento</div>
                    <div style="font-size:12px;font-weight:700;color:${dias !== null && dias < 30 ? '#ef4444' : 'inherit'}">
                      ${c.dataFim ? new Date(c.dataFim+'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                      ${dias !== null && dias >= 0 && dias < 30 ? `<span style="font-size:10px;color:#ef4444"> (${dias}d)</span>` : ''}
                    </div>
                  </div>
                </div>

                ${c.obs ? `<div style="font-size:12px;color:var(--muted);margin-bottom:10px;border-top:1px solid var(--border);padding-top:8px">${_esc(c.obs)}</div>` : ''}

                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${c.status === 'ativo' ? `<button class="btn btn-ghost btn-sm" onclick="_contStatus(${c.id},'encerrado')"><i class="bi bi-x-circle"></i> Encerrar</button>` : ''}
                  ${c.status === 'pendente' ? `<button class="btn btn-sm" style="background:#dcfce7;color:#16a34a;border:none" onclick="_contStatus(${c.id},'ativo')"><i class="bi bi-check-lg"></i> Ativar</button>` : ''}
                  ${c.driveFolderUrl ? `<a class="btn btn-ghost btn-sm" href="${_esc(c.driveFolderUrl)}" target="_blank"><i class="bi bi-google"></i> Drive</a>` : ''}
                  <button class="btn btn-ghost btn-sm" onclick="_contEditar(${c.id})"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-ghost btn-sm" onclick="_contExcluir(${c.id})"><i class="bi bi-trash"></i></button>
                </div>
              </div>`;
          }).join('')}
        </div>`}

    <!-- Modal novo contrato -->
    <div id="contModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;align-items:center;justify-content:center" onclick="if(event.target===this)this.style.display='none'">
      <div class="card" style="width:100%;max-width:500px;padding:24px;max-height:90vh;overflow-y:auto">
        <div style="font-size:15px;font-weight:800;color:var(--primary);margin-bottom:18px"><i class="bi bi-pen-fill"></i> <span id="contModalTitulo">Novo Contrato</span></div>
        <input type="hidden" id="contEditId" />
        <div style="display:grid;gap:12px">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Cliente / Lead</label>
            <select class="form-input" id="contLeadSel" style="width:100%">
              <option value="">— Selecione —</option>
              ${leads.map(l => `<option value="${l.id}" data-valor="${l.valorDesejado||0}">${_esc(l.nome)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Título do Contrato</label>
            <input class="form-input" id="contTitulo" placeholder="Ex: Contrato Consórcio Imóvel" style="width:100%" />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Nº do Contrato</label>
              <input class="form-input" id="contNumero" placeholder="2024/001" style="width:100%" />
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Valor (R$)</label>
              <input class="form-input" id="contValor" type="number" min="0" step="0.01" placeholder="0,00" style="width:100%" />
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Data de Início</label>
              <input class="form-input" id="contDataInicio" type="date" style="width:100%" />
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Data de Encerramento</label>
              <input class="form-input" id="contDataFim" type="date" style="width:100%" />
            </div>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Observações</label>
            <textarea class="form-input" id="contObs" rows="2" style="width:100%;resize:vertical"></textarea>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <button class="btn btn-primary" onclick="_contSalvar()"><i class="bi bi-check-lg"></i> Salvar Contrato</button>
          <button class="btn btn-ghost" onclick="document.getElementById('contModal').style.display='none'">Cancelar</button>
        </div>
      </div>
    </div>
  `;
}

function _contKpi(label, val, icon, color) {
  return `<div class="card" style="text-align:center;padding:14px 10px">
    <i class="bi ${icon}" style="font-size:20px;color:${color};display:block;margin-bottom:6px"></i>
    <div style="font-size:16px;font-weight:900;color:var(--primary);margin-bottom:2px">${val}</div>
    <div style="font-size:10px;color:var(--muted);font-weight:600">${label}</div>
  </div>`;
}

function _contAbrirModal(editId) {
  const m = document.getElementById('contModal');
  if (!m) return;
  document.getElementById('contEditId').value = editId || '';
  document.getElementById('contModalTitulo').textContent = editId ? 'Editar Contrato' : 'Novo Contrato';
  if (editId) {
    const c = contGet().find(x => x.id === editId);
    if (c) {
      document.getElementById('contLeadSel').value = c.leadId || '';
      document.getElementById('contTitulo').value  = c.titulo || '';
      document.getElementById('contNumero').value  = c.numero || '';
      document.getElementById('contValor').value   = c.valor  || '';
      document.getElementById('contDataInicio').value = c.dataInicio || '';
      document.getElementById('contDataFim').value    = c.dataFim    || '';
      document.getElementById('contObs').value        = c.obs        || '';
    }
  } else {
    ['contLeadSel','contTitulo','contNumero','contValor','contDataInicio','contDataFim','contObs'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('contDataInicio').value = new Date().toISOString().slice(0,10);
    const sel = document.getElementById('contLeadSel');
    if (sel) sel.onchange = () => {
      const opt = sel.options[sel.selectedIndex];
      const val = document.getElementById('contValor');
      if (val && opt?.dataset.valor) val.value = opt.dataset.valor;
    };
  }
  m.style.display = 'flex';
}

function _contSalvar() {
  const editId = parseInt(document.getElementById('contEditId')?.value || '0');
  const sel    = document.getElementById('contLeadSel');
  const lead   = storeGet().find(l => l.id === parseInt(sel?.value));
  const titulo = document.getElementById('contTitulo')?.value?.trim();
  if (!titulo) { alert('Informe o título do contrato.'); return; }
  const data = {
    leadId:     lead?.id     || null,
    leadNome:   lead?.nome   || (sel?.value ? '' : '—'),
    titulo,
    numero:     document.getElementById('contNumero')?.value?.trim() || '',
    valor:      parseFloat(document.getElementById('contValor')?.value || '0'),
    dataInicio: document.getElementById('contDataInicio')?.value || '',
    dataFim:    document.getElementById('contDataFim')?.value    || '',
    obs:        document.getElementById('contObs')?.value?.trim() || '',
  };
  if (editId) contUpdate(editId, data); else contCreate(data);
  document.getElementById('contModal').style.display = 'none';
  initContratos();
}

function _contStatus(id, status) {
  contUpdate(id, { status });
  if (status === 'ativo') {
    const c = contGet().find(x => x.id === id);
    if (c?.leadId) leadMoveStage && leadMoveStage(c.leadId, 'fechado');
  }
  initContratos();
}

function _contEditar(id) { _contAbrirModal(id); }

function _contExcluir(id) {
  if (!confirm('Excluir este contrato?')) return;
  contDelete(id);
  initContratos();
}
