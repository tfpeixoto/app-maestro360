/* =====================================================================
   PARCELAS — Controle de Pagamentos Mensais
   Persiste em localStorage: crm_parcelas
   ===================================================================== */

const PARC_KEY = 'crm_parcelas';

function parcGet()         { try { return JSON.parse(localStorage.getItem(PARC_KEY) || '[]'); } catch { return []; } }
function parcSet(list)     { localStorage.setItem(PARC_KEY, JSON.stringify(list)); }

function parcCreate(patch) {
  const list = parcGet();
  const p = { id: Date.now(), criadoEm: new Date().toISOString(), status: 'pendente', ...patch };
  list.push(p);
  parcSet(list);
  return p;
}

function parcUpdate(id, patch) {
  const list = parcGet().map(p => p.id === id ? { ...p, ...patch } : p);
  parcSet(list);
}

function parcDelete(id) {
  parcSet(parcGet().filter(p => p.id !== id));
}

/* ── Estado ── */
const PARC = { filtro: 'todos', busca: '', mes: '' };

function initParcelas() {
  const el = document.getElementById('page-parcelas');
  if (!el) return;
  _parcSeedDemo();
  el.innerHTML = _parcRender();
}

/* Gera parcelas demo se não houver nenhuma */
function _parcSeedDemo() {
  if (parcGet().length > 0) return;
  const leads = storeGet().filter(l => l.aporteMensal > 0).slice(0, 8);
  if (leads.length === 0) return;
  const hoje  = new Date();
  leads.forEach(lead => {
    for (let m = 0; m < 3; m++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - m, 10);
      const venc = d.toISOString().slice(0, 10);
      const status = m === 0 ? 'pendente' : m === 1 ? 'pago' : (Math.random() > 0.7 ? 'atrasado' : 'pago');
      parcCreate({ leadId: lead.id, leadNome: lead.nome, valor: lead.aporteMensal, vencimento: venc, status, mes: venc.slice(0,7) });
    }
  });
}

function _parcRender() {
  const leads    = storeGet();
  const lista    = parcGet();
  const hoje     = new Date();
  const mesAtual = hoje.toISOString().slice(0, 7);

  const total     = lista.reduce((s, p) => s + (p.valor || 0), 0);
  const recebido  = lista.filter(p => p.status === 'pago').reduce((s, p) => s + (p.valor || 0), 0);
  const atraso    = lista.filter(p => p.status === 'atrasado').reduce((s, p) => s + (p.valor || 0), 0);
  const pendente  = lista.filter(p => p.status === 'pendente').reduce((s, p) => s + (p.valor || 0), 0);

  let filtered = [...lista];
  if (PARC.filtro !== 'todos') filtered = filtered.filter(p => p.status === PARC.filtro);
  if (PARC.busca) {
    const b = PARC.busca.toLowerCase();
    filtered = filtered.filter(p => (p.leadNome||'').toLowerCase().includes(b));
  }
  if (PARC.mes) filtered = filtered.filter(p => p.mes === PARC.mes);
  filtered.sort((a, b) => a.vencimento?.localeCompare(b.vencimento));

  const statusBadge = s => {
    const map = { pago:'#16a34a', pendente:'#d97706', atrasado:'#ef4444' };
    return `<span style="font-size:10px;font-weight:700;background:${map[s]||'#6b7280'}22;color:${map[s]||'#6b7280'};padding:2px 8px;border-radius:8px">${s.charAt(0).toUpperCase()+s.slice(1)}</span>`;
  };

  /* ── Projeção do mês atual ── */
  const parcelasDoMes = lista.filter(p => p.mes === mesAtual);
  const projTotal     = parcelasDoMes.reduce((s,p) => s+(p.valor||0), 0);
  const projPago      = parcelasDoMes.filter(p=>p.status==='pago').reduce((s,p) => s+(p.valor||0), 0);
  const projPendente  = parcelasDoMes.filter(p=>p.status==='pendente').reduce((s,p) => s+(p.valor||0), 0);
  const projAtraso    = parcelasDoMes.filter(p=>p.status==='atrasado').reduce((s,p) => s+(p.valor||0), 0);

  /* Clientes que pagaram este mês */
  const clientesMes = {};
  parcelasDoMes.forEach(p => {
    if (!clientesMes[p.leadId]) clientesMes[p.leadId] = { nome: p.leadNome, pago:0, pendente:0 };
    if (p.status==='pago')     clientesMes[p.leadId].pago     += p.valor||0;
    if (p.status==='pendente') clientesMes[p.leadId].pendente += p.valor||0;
  });
  const clientesMesList = Object.values(clientesMes).sort((a,b) => b.pago - a.pago);

  const mesLabel = new Date(mesAtual+'-01T00:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});

  return `
    <div class="page-header">
      <div><div class="page-title">Parcelas</div><div class="page-subtitle">Controle de pagamentos mensais</div></div>
      <button class="btn btn-primary" onclick="_parcNovaModal()"><i class="bi bi-plus-lg"></i> Nova Parcela</button>
    </div>

    <!-- Projeção do mês -->
    <div style="background:linear-gradient(135deg,#0d1f3c,#1c3a72);border-radius:14px;padding:20px 24px;margin-bottom:20px;color:white">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;opacity:.6;margin-bottom:4px">Projeção — ${mesLabel}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:16px;margin-bottom:14px">
        <div><div style="font-size:24px;font-weight:900">${fmtValor(projTotal)}</div><div style="font-size:11px;opacity:.6">Total esperado</div></div>
        <div><div style="font-size:24px;font-weight:900;color:#4ade80">${fmtValor(projPago)}</div><div style="font-size:11px;opacity:.6">Já recebido</div></div>
        <div><div style="font-size:24px;font-weight:900;color:#fbbf24">${fmtValor(projPendente)}</div><div style="font-size:11px;opacity:.6">A receber</div></div>
        ${projAtraso > 0 ? `<div><div style="font-size:24px;font-weight:900;color:#f87171">${fmtValor(projAtraso)}</div><div style="font-size:11px;opacity:.6">Em atraso</div></div>` : ''}
      </div>
      ${clientesMesList.length > 0 ? `
        <div style="background:rgba(255,255,255,.08);border-radius:10px;padding:12px 14px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;opacity:.5;margin-bottom:8px">Clientes este mês</div>
          ${clientesMesList.slice(0,5).map(c => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.08);font-size:12px">
              <span style="opacity:.85">${_esc(c.nome)}</span>
              <span>${c.pago > 0 ? `<span style="color:#4ade80;font-weight:700">${fmtValor(c.pago)} pago</span>` : ''}${c.pendente>0?` <span style="color:#fbbf24;font-weight:700">${fmtValor(c.pendente)} a pagar</span>`:''}</span>
            </div>`).join('')}
          ${clientesMesList.length > 5 ? `<div style="font-size:11px;opacity:.5;margin-top:6px">+ ${clientesMesList.length-5} clientes</div>` : ''}
        </div>` : ''}
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;margin-bottom:20px">
      ${_parcKpi('Total Carteira', fmtValor(total),    'bi-wallet2',            'var(--primary)')}
      ${_parcKpi('Recebido',       fmtValor(recebido), 'bi-check-circle-fill',  '#16a34a')}
      ${_parcKpi('Pendente',       fmtValor(pendente), 'bi-hourglass-split',    '#d97706')}
      ${_parcKpi('Em Atraso',      fmtValor(atraso),   'bi-exclamation-circle-fill', '#ef4444')}
    </div>

    <!-- Filtros -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
      <input class="form-input" placeholder="Buscar cliente..." style="max-width:240px"
        value="${_esc(PARC.busca)}" oninput="PARC.busca=this.value;initParcelas()" />
      <input type="month" class="form-input" style="max-width:160px"
        value="${PARC.mes}" onchange="PARC.mes=this.value;initParcelas()" />
      ${['todos','pendente','pago','atrasado'].map(s => `
        <button class="btn btn-sm ${PARC.filtro===s?'btn-primary':'btn-ghost'}" onclick="PARC.filtro='${s}';initParcelas()">
          ${s === 'todos' ? 'Todos' : s.charAt(0).toUpperCase()+s.slice(1)}
        </button>`).join('')}
    </div>

    <!-- Tabela -->
    <div class="card" style="padding:0;overflow:hidden">
      ${filtered.length === 0
        ? `<div style="text-align:center;padding:40px;color:var(--muted)"><i class="bi bi-cash-coin" style="font-size:36px;display:block;margin-bottom:12px;opacity:.3"></i>Nenhuma parcela encontrada.</div>`
        : `<table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:var(--bg);font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">
                <th style="padding:10px 16px;text-align:left">Cliente</th>
                <th style="padding:10px 16px;text-align:left">Vencimento</th>
                <th style="padding:10px 16px;text-align:right">Valor</th>
                <th style="padding:10px 16px;text-align:center">Status</th>
                <th style="padding:10px 16px;text-align:center">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(p => `
                <tr style="border-top:1px solid var(--border);font-size:13px">
                  <td style="padding:10px 16px;font-weight:700">${_esc(p.leadNome||'—')}</td>
                  <td style="padding:10px 16px;color:var(--muted)">${p.vencimento ? new Date(p.vencimento+'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                  <td style="padding:10px 16px;text-align:right;font-weight:700">${fmtValor(p.valor)}</td>
                  <td style="padding:10px 16px;text-align:center">${statusBadge(p.status)}</td>
                  <td style="padding:10px 16px;text-align:center">
                    <div style="display:flex;gap:4px;justify-content:center">
                      ${p.status !== 'pago' ? `<button class="btn btn-sm" style="background:#dcfce7;color:#16a34a;border:none;font-size:11px" onclick="_parcMarcarPago(${p.id})"><i class="bi bi-check-lg"></i> Pago</button>` : ''}
                      <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="_parcExcluir(${p.id})"><i class="bi bi-trash"></i></button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>`}
    </div>

    <!-- Modal nova parcela -->
    <div id="parcModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;align-items:center;justify-content:center" onclick="if(event.target===this)this.style.display='none'">
      <div class="card" style="width:100%;max-width:440px;padding:24px">
        <div style="font-size:15px;font-weight:800;color:var(--primary);margin-bottom:18px">Nova Parcela</div>
        <div style="display:grid;gap:12px">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Cliente</label>
            <select class="form-input" id="parcLeadSel" style="width:100%">
              <option value="">— Selecione —</option>
              ${storeGet().map(l => `<option value="${l.id}" data-valor="${l.aporteMensal||0}">${_esc(l.nome)}</option>`).join('')}
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Valor (R$)</label>
              <input class="form-input" id="parcValor" type="number" min="0" step="0.01" placeholder="0,00" style="width:100%" />
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Vencimento</label>
              <input class="form-input" id="parcVenc" type="date" style="width:100%" value="${new Date().toISOString().slice(0,10)}" />
            </div>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <button class="btn btn-primary" onclick="_parcSalvar()"><i class="bi bi-plus-lg"></i> Adicionar</button>
          <button class="btn btn-ghost" onclick="document.getElementById('parcModal').style.display='none'">Cancelar</button>
        </div>
      </div>
    </div>
  `;
}

function _parcKpi(label, val, icon, color) {
  return `<div class="card" style="text-align:center;padding:14px 10px">
    <i class="bi ${icon}" style="font-size:20px;color:${color};display:block;margin-bottom:6px"></i>
    <div style="font-size:16px;font-weight:900;color:var(--primary);margin-bottom:2px">${val}</div>
    <div style="font-size:10px;color:var(--muted);font-weight:600">${label}</div>
  </div>`;
}

function _parcNovaModal() {
  const m = document.getElementById('parcModal');
  if (m) m.style.display = 'flex';
  const sel = document.getElementById('parcLeadSel');
  if (sel) sel.onchange = () => {
    const opt = sel.options[sel.selectedIndex];
    const val = document.getElementById('parcValor');
    if (val && opt?.dataset.valor) val.value = opt.dataset.valor;
  };
}

function _parcSalvar() {
  const sel   = document.getElementById('parcLeadSel');
  const valor = parseFloat(document.getElementById('parcValor')?.value || '0');
  const venc  = document.getElementById('parcVenc')?.value;
  if (!sel?.value || !valor || !venc) { alert('Preencha todos os campos.'); return; }
  const lead  = storeGet().find(l => l.id === parseInt(sel.value));
  if (!lead) return;
  parcCreate({ leadId: lead.id, leadNome: lead.nome, valor, vencimento: venc, mes: venc.slice(0,7) });
  document.getElementById('parcModal').style.display = 'none';
  initParcelas();
}

function _parcMarcarPago(id) {
  parcUpdate(id, { status: 'pago', pagaEm: new Date().toISOString() });
  initParcelas();
}

function _parcExcluir(id) {
  if (!confirm('Excluir esta parcela?')) return;
  parcDelete(id);
  initParcelas();
}
