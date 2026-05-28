/* =====================================================================
   LANCES — Registro e histórico de lances por assembleia / cliente
   Persiste em localStorage: crm_lances
   ===================================================================== */

const LANC_KEY = 'crm_lances';

function lancGet()     { try { return JSON.parse(localStorage.getItem(LANC_KEY) || '[]'); } catch { return []; } }
function lancSet(list) { localStorage.setItem(LANC_KEY, JSON.stringify(list)); }

function lancCreate(patch) {
  const list = lancGet();
  const l = { id: Date.now(), criadoEm: new Date().toISOString(), resultado: 'pendente', ...patch };
  list.push(l);
  lancSet(list);
  return l;
}

function lancUpdate(id, patch) {
  lancSet(lancGet().map(l => l.id === id ? { ...l, ...patch } : l));
}

function lancDelete(id) { lancSet(lancGet().filter(l => l.id !== id)); }

/* ── Estado ── */
const LANC = { filtro: 'todos', busca: '', cotaBusca: '' };

function initLances() {
  const el = document.getElementById('page-lances');
  if (!el) return;
  _lancSeedDemo();
  el.innerHTML = _lancRender();
}

function _lancSeedDemo() {
  if (lancGet().length > 0) return;
  const leads      = storeGet().slice(0, 6);
  const assembleias = assmGet ? assmGet() : [];
  if (leads.length === 0) return;
  leads.forEach((lead, i) => {
    const assm = assembleias[i % Math.max(assembleias.length, 1)];
    const pct  = (15 + Math.random() * 25).toFixed(1);
    const res  = Math.random() > 0.5 ? 'vencedor' : 'não contemplado';
    lancCreate({
      leadId:       lead.id,
      leadNome:     lead.nome,
      grupo:        assm?.grupo || `Grupo ${1000 + i}`,
      assembleia:   assm?.data  || new Date(Date.now() - i * 30 * 86400000).toISOString().slice(0,10),
      percentual:   pct,
      valorCredito: lead.valorDesejado || 50000,
      resultado:    res,
    });
  });
}

/* Temporary registry so cota objects can be passed safely via inline onclick */
let _lancCotaReg = [];
function _lancCotaIdx(cota) {
  _lancCotaReg.push(cota);
  return _lancCotaReg.length - 1;
}

function _lancRender() {
  _lancCotaReg = [];
  const lista  = lancGet();
  const leads  = storeGet();

  const vencedores   = lista.filter(l => l.resultado === 'vencedor').length;
  const pendentes    = lista.filter(l => l.resultado === 'pendente').length;
  const taxaVitoria  = lista.length > 0 ? Math.round((vencedores / lista.length) * 100) : 0;
  const pctMedio     = lista.length > 0
    ? (lista.reduce((s, l) => s + parseFloat(l.percentual||0), 0) / lista.length).toFixed(1)
    : 0;

  /* ── Cotas ativas para lance ── */
  const cotas = (() => { try { return JSON.parse(localStorage.getItem('crm_cotas') || '{}'); } catch { return {}; } })();
  const todasParcelas = (() => { try { return JSON.parse(localStorage.getItem('crm_parcelas') || '[]'); } catch { return []; } })();

  const cotasAtivas = Object.entries(cotas)
    .filter(([, c]) => c.status === 'vendida')
    .map(([key, c]) => {
      const [grupo, numStr] = key.split('_');
      const num = parseInt(numStr) || 0;
      const lead = leads.find(l => String(l.id) === String(c.leadId));
      const parcelas = todasParcelas.filter(p => String(p.leadId) === String(c.leadId));
      return { key, grupo, num, cliente: c.cliente || '—', vendedor: c.vendedor || '—', leadId: c.leadId, lead, parcelas };
    });

  const busca = (LANC.cotaBusca || '').toLowerCase().trim();
  const cotasFiltradas = busca
    ? cotasAtivas.filter(c =>
        c.cliente.toLowerCase().includes(busca) ||
        String(c.num).padStart(3, '0').includes(busca)
      )
    : cotasAtivas;

  /* ── Histórico filtrado ── */
  let filtered = [...lista];
  const resMap = {
    vencedor:         { label:'Contemplado',    color:'#16a34a', icon:'bi-trophy-fill' },
    pendente:         { label:'Pendente',        color:'#d97706', icon:'bi-hourglass-split' },
    'não contemplado':{ label:'Não contemplado', color:'#6b7280', icon:'bi-x-circle'  },
  };

  if (LANC.filtro !== 'todos') filtered = filtered.filter(l => l.resultado === LANC.filtro);
  if (LANC.busca) {
    const b = LANC.busca.toLowerCase();
    filtered = filtered.filter(l => (l.leadNome||'').toLowerCase().includes(b) || (l.grupo||'').toLowerCase().includes(b));
  }
  filtered.sort((a, b) => (b.assembleia||'').localeCompare(a.assembleia||''));

  return `
    <div class="page-header">
      <div><div class="page-title">Lances</div><div class="page-subtitle">Histórico e registro de lances por assembleia</div></div>
      <button class="btn btn-primary" onclick="_lancAbrirModal()"><i class="bi bi-plus-lg"></i> Registrar Lance</button>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px;margin-bottom:24px">
      ${_lancKpi('Total de Lances',  lista.length,     'bi-list-check',    'var(--primary)')}
      ${_lancKpi('Contemplados',     vencedores,        'bi-trophy-fill',   '#16a34a')}
      ${_lancKpi('Pendentes',        pendentes,          'bi-hourglass-split','#d97706')}
      ${_lancKpi('Taxa de Vitória',  taxaVitoria+'%',   'bi-graph-up-arrow','#0891b2')}
      ${_lancKpi('Lance Médio',      pctMedio+'%',      'bi-percent',        '#7c3aed')}
    </div>

    <!-- ── COTAS ATIVAS PARA LANCE ── -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <div style="height:1px;flex:1;background:var(--border)"></div>
      <span style="font-size:11px;font-weight:800;letter-spacing:.08em;color:var(--muted);white-space:nowrap">COTAS ATIVAS PARA LANCE</span>
      <div style="height:1px;flex:1;background:var(--border)"></div>
    </div>

    <div style="margin-bottom:14px">
      <input class="form-input" placeholder="Buscar por cliente ou número da cota..." style="max-width:340px"
        value="${_esc(LANC.cotaBusca)}" oninput="LANC.cotaBusca=this.value;initLances()" />
    </div>

    ${cotasFiltradas.length === 0
      ? `<div class="card" style="text-align:center;padding:48px;color:var(--muted);margin-bottom:24px">
           <i class="bi bi-credit-card-2-front" style="font-size:36px;display:block;margin-bottom:10px;opacity:.3"></i>
           Nenhuma cota vendida ativa no momento.
         </div>`
      : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;margin-bottom:24px">
          ${cotasFiltradas.map(c => {
            const numFmt = String(c.num).padStart(3, '0');
            const pagas = c.parcelas.filter(p => p.status === 'paga').length;
            const total = c.parcelas.length;
            return `
              <div class="card" style="border-left:4px solid var(--primary);border-radius:12px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.07);padding:16px;display:flex;flex-direction:column;gap:8px">
                <div>
                  <div style="font-size:28px;font-weight:900;color:var(--primary);line-height:1">${_esc(numFmt)}</div>
                  <div style="font-size:11px;color:var(--muted);margin-top:2px">Grupo ${_esc(c.grupo)}</div>
                </div>
                <div>
                  <div style="font-size:14px;font-weight:700;color:var(--text)">${_esc(c.cliente)}</div>
                  ${c.vendedor !== '—' ? `<div style="font-size:11px;color:var(--muted)">${_esc(c.vendedor)}</div>` : ''}
                </div>
                <div style="font-size:11px;color:var(--muted)">
                  <i class="bi bi-receipt"></i>
                  ${total > 0 ? `${pagas} pagas de ${total}` : 'Sem parcelas'}
                </div>
                <button class="btn btn-primary btn-sm" style="width:100%;margin-top:auto" onclick="_lancAbrirModalParaCota(${_lancCotaIdx(c)})">
                  <i class="bi bi-trophy-fill"></i> Fazer Lance
                </button>
              </div>`;
          }).join('')}
        </div>`}

    <!-- ── HISTÓRICO DE LANCES ── -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <div style="height:1px;flex:1;background:var(--border)"></div>
      <span style="font-size:11px;font-weight:800;letter-spacing:.08em;color:var(--muted);white-space:nowrap">HISTÓRICO DE LANCES</span>
      <div style="height:1px;flex:1;background:var(--border)"></div>
    </div>

    <!-- Filtros histórico -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
      <input class="form-input" placeholder="Buscar cliente ou grupo..." style="max-width:260px"
        value="${_esc(LANC.busca)}" oninput="LANC.busca=this.value;initLances()" />
      ${['todos','pendente','vencedor','não contemplado'].map(s => `
        <button class="btn btn-sm ${LANC.filtro===s?'btn-primary':'btn-ghost'}" onclick="LANC.filtro='${s}';initLances()">
          ${s==='todos'?'Todos':resMap[s]?.label||s}
        </button>`).join('')}
    </div>

    <!-- Cards histórico -->
    ${filtered.length === 0
      ? `<div class="card" style="text-align:center;padding:60px;color:var(--muted)"><i class="bi bi-trophy" style="font-size:40px;display:block;margin-bottom:12px;opacity:.3"></i>Nenhum lance encontrado.</div>`
      : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px">
          ${filtered.map(l => {
            const res = resMap[l.resultado] || { label: l.resultado, color:'#6b7280', icon:'bi-dash-circle' };
            return `
              <div class="card" style="border-top:3px solid ${res.color}">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px">
                  <div>
                    <div style="font-size:14px;font-weight:800;color:var(--primary)">${_esc(l.leadNome||'—')}</div>
                    <div style="font-size:11px;color:var(--muted)">${_esc(l.grupo||'—')} · ${l.assembleia?new Date(l.assembleia+'T00:00:00').toLocaleDateString('pt-BR'):''}</div>
                  </div>
                  <span style="font-size:10px;font-weight:700;background:${res.color}22;color:${res.color};padding:3px 8px;border-radius:8px;white-space:nowrap"><i class="bi ${res.icon}"></i> ${res.label}</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
                  <div style="background:var(--bg);border-radius:8px;padding:8px 10px">
                    <div style="font-size:10px;color:var(--muted);font-weight:600">Lance Ofertado</div>
                    <div style="font-size:18px;font-weight:900;color:${res.color}">${l.percentual||'—'}%</div>
                  </div>
                  <div style="background:var(--bg);border-radius:8px;padding:8px 10px">
                    <div style="font-size:10px;color:var(--muted);font-weight:600">Crédito</div>
                    <div style="font-size:13px;font-weight:800">${fmtValor(l.valorCredito)}</div>
                  </div>
                </div>
                <div style="display:flex;gap:6px">
                  ${l.resultado==='pendente'?`
                    <button class="btn btn-sm" style="background:#dcfce7;color:#16a34a;border:none" onclick="_lancRes(${l.id},'vencedor')"><i class="bi bi-trophy-fill"></i> Contemplado</button>
                    <button class="btn btn-sm" style="background:#f3f4f6;color:#6b7280;border:none" onclick="_lancRes(${l.id},'não contemplado')"><i class="bi bi-x-circle"></i> Não contemplado</button>
                  `:''}
                  <button class="btn btn-ghost btn-sm" onclick="_lancExcluir(${l.id})"><i class="bi bi-trash"></i></button>
                </div>
              </div>`;
          }).join('')}
        </div>`}

    <!-- Modal -->
    <div id="lancModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;align-items:center;justify-content:center" onclick="if(event.target===this)this.style.display='none'">
      <div class="card" style="width:100%;max-width:440px;padding:24px">
        <div style="font-size:15px;font-weight:800;color:var(--primary);margin-bottom:18px"><i class="bi bi-trophy-fill" style="color:#d97706"></i> Registrar Lance</div>
        <div style="display:grid;gap:12px">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Cliente</label>
            <select class="form-input" id="lancLeadSel" style="width:100%">
              <option value="">— Selecione —</option>
              ${leads.map(l => `<option value="${l.id}" data-valor="${l.valorDesejado||0}">${_esc(l.nome)}</option>`).join('')}
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Grupo</label>
              <input class="form-input" id="lancGrupo" placeholder="Grupo 1234" style="width:100%" />
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Data Assembleia</label>
              <input class="form-input" id="lancData" type="date" style="width:100%" value="${new Date().toISOString().slice(0,10)}" />
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Lance (%)</label>
              <input class="form-input" id="lancPct" type="number" min="0" max="100" step="0.1" placeholder="20" style="width:100%" />
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Crédito (R$)</label>
              <input class="form-input" id="lancCredito" type="number" min="0" step="1000" placeholder="50000" style="width:100%" />
            </div>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <button class="btn btn-primary" onclick="_lancSalvar()"><i class="bi bi-plus-lg"></i> Registrar</button>
          <button class="btn btn-ghost" onclick="document.getElementById('lancModal').style.display='none'">Cancelar</button>
        </div>
      </div>
    </div>
  `;
}

function _lancKpi(label, val, icon, color) {
  return `<div class="card" style="text-align:center;padding:12px 8px">
    <i class="bi ${icon}" style="font-size:18px;color:${color};display:block;margin-bottom:5px"></i>
    <div style="font-size:15px;font-weight:900;color:var(--primary);margin-bottom:2px">${val}</div>
    <div style="font-size:10px;color:var(--muted);font-weight:600">${label}</div>
  </div>`;
}

function _lancAbrirModal() {
  const m = document.getElementById('lancModal');
  if (!m) return;
  m.style.display = 'flex';
  const sel = document.getElementById('lancLeadSel');
  if (sel) sel.onchange = () => {
    const opt = sel.options[sel.selectedIndex];
    const cred = document.getElementById('lancCredito');
    if (cred && opt?.dataset.valor) cred.value = opt.dataset.valor;
  };
}

function _lancAbrirModalParaCota(idxOrCota) {
  const cota = typeof idxOrCota === 'number' ? _lancCotaReg[idxOrCota] : idxOrCota;
  if (!cota) return;
  _lancAbrirModal();

  const grupoEl = document.getElementById('lancGrupo');
  if (grupoEl) grupoEl.value = `Grupo ${cota.grupo}`;

  const sel = document.getElementById('lancLeadSel');
  if (sel && cota.leadId) {
    const opt = Array.from(sel.options).find(o => String(o.value) === String(cota.leadId));
    if (opt) sel.value = opt.value;
  }

  const creditoEl = document.getElementById('lancCredito');
  if (creditoEl) creditoEl.value = cota.lead?.valorDesejado || 0;
}

function _lancSalvar() {
  const sel   = document.getElementById('lancLeadSel');
  const lead  = storeGet().find(l => l.id === parseInt(sel?.value));
  const grupo = document.getElementById('lancGrupo')?.value?.trim();
  const data  = document.getElementById('lancData')?.value;
  const pct   = document.getElementById('lancPct')?.value;
  if (!lead || !grupo || !data || !pct) { alert('Preencha todos os campos.'); return; }
  lancCreate({
    leadId:       lead.id,
    leadNome:     lead.nome,
    grupo,
    assembleia:   data,
    percentual:   pct,
    valorCredito: parseFloat(document.getElementById('lancCredito')?.value || '0'),
  });
  document.getElementById('lancModal').style.display = 'none';
  initLances();
}

function _lancRes(id, resultado) {
  lancUpdate(id, { resultado });
  if (resultado === 'vencedor') {
    const l = lancGet().find(x => x.id === id);
    if (l?.leadId) leadMoveStage && leadMoveStage(l.leadId, 'contemplado');
  }
  initLances();
}

function _lancExcluir(id) {
  if (!confirm('Excluir este lance?')) return;
  lancDelete(id);
  initLances();
}
