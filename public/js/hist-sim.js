/* ── HIST-SIM — Histórico de Simulações ── */
function initHistSim() {
  const wrap = document.getElementById('page-hist-sim');
  if (!wrap) return;

  /* ── fallback helpers ── */
  const _fmt  = typeof fmtValor === 'function' ? fmtValor : v => {
    if (!v) return '—';
    if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return 'R$ ' + Math.round(v / 1e3) + 'k';
    return 'R$ ' + Number(v).toLocaleString('pt-BR');
  };
  const _fmtFull = v => {
    if (!v) return '—';
    const n = Number(v);
    const [i, f] = n.toFixed(2).split('.');
    return 'R$ ' + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + f;
  };
  const _date = typeof fmtData === 'function' ? fmtData : iso => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const _e = typeof _esc === 'function' ? _esc : s =>
    String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  /* ── collect all simulations from every lead ── */
  const leads = JSON.parse(localStorage.getItem('crm_leads') || '[]');
  const allSims = [];
  leads.forEach(lead => {
    (lead.simulacoes || []).forEach(sim => {
      allSims.push({ sim, lead });
    });
  });
  allSims.sort((a, b) => new Date(b.sim.criadoEm) - new Date(a.sim.criadoEm));

  /* ── derive stats ── */
  const totalSims     = allSims.length;
  const uniqueClients = new Set(allSims.map(r => r.lead.id)).size;
  const totalCredito  = allSims.reduce((acc, r) => acc + (Number(r.sim.credito) || 0), 0);

  /* ── build unique group list from data + default groups ── */
  const groupsInData = [...new Set(allSims.map(r => r.sim.grupo).filter(Boolean))].sort();
  const defaultGroups = ['4003', '4004'];
  const allGroups = [...new Set([...defaultGroups, ...groupsInData])].sort();

  /* ── render ── */
  wrap.innerHTML = `
<div style="padding:24px;max-width:1200px;margin:0 auto">

  <div style="margin-bottom:24px">
    <div class="page-title"><i class="bi bi-clock-history" style="color:var(--accent);margin-right:8px"></i>Histórico de Simulações</div>
    <div class="page-subtitle">Todas as simulações realizadas pelos clientes</div>
  </div>

  <div id="hs-stats" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
    <div class="card" style="display:flex;align-items:center;gap:14px;padding:18px 20px">
      <div style="width:44px;height:44px;border-radius:12px;background:var(--primary-pale);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="bi bi-calculator" style="font-size:20px;color:var(--primary)"></i>
      </div>
      <div>
        <div style="font-size:24px;font-weight:800;color:var(--primary)">${totalSims}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:1px">Total de Simulações</div>
      </div>
    </div>
    <div class="card" style="display:flex;align-items:center;gap:14px;padding:18px 20px">
      <div style="width:44px;height:44px;border-radius:12px;background:#fff7ed;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="bi bi-people" style="font-size:20px;color:var(--accent)"></i>
      </div>
      <div>
        <div style="font-size:24px;font-weight:800;color:var(--primary)">${uniqueClients}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:1px">Clientes Únicos</div>
      </div>
    </div>
    <div class="card" style="display:flex;align-items:center;gap:14px;padding:18px 20px">
      <div style="width:44px;height:44px;border-radius:12px;background:var(--green-pale);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="bi bi-currency-dollar" style="font-size:20px;color:var(--green)"></i>
      </div>
      <div>
        <div style="font-size:20px;font-weight:800;color:var(--primary)">${_fmtFull(totalCredito)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:1px">Crédito Total Simulado</div>
      </div>
    </div>
  </div>

  <div class="card" style="margin-bottom:20px;padding:14px 18px">
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
      <div style="position:relative;flex:1;min-width:200px">
        <i class="bi bi-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px;pointer-events:none"></i>
        <input id="hs-search" type="text" placeholder="Buscar por cliente ou grupo…"
          style="width:100%;padding:8px 10px 8px 32px;border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--text);background:var(--bg);outline:none"
          oninput="hsApplyFilters()">
      </div>
      <select id="hs-filter-grupo"
        style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--text);background:var(--bg);cursor:pointer;outline:none"
        onchange="hsApplyFilters()">
        <option value="">Todos os Grupos</option>
        ${allGroups.map(g => `<option value="${_e(g)}">${_e(g)}</option>`).join('')}
      </select>
      <select id="hs-filter-status"
        style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--text);background:var(--bg);cursor:pointer;outline:none"
        onchange="hsApplyFilters()">
        <option value="">Todos os Status</option>
        <option value="pre-proposta">Pré-proposta</option>
      </select>
      <button onclick="hsClearFilters()"
        style="padding:8px 14px;border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--muted);background:transparent;cursor:pointer;white-space:nowrap">
        <i class="bi bi-x-circle"></i> Limpar
      </button>
    </div>
  </div>

  <div id="hs-list"></div>

</div>`;

  /* ── expose data for filter callbacks ── */
  wrap._hsData    = allSims;
  wrap._hsFmt     = _fmt;
  wrap._hsDate    = _date;
  wrap._hsE       = _e;

  hsApplyFilters();
}

/* ── filter + render list ── */
function hsApplyFilters() {
  const wrap = document.getElementById('page-hist-sim');
  if (!wrap || !wrap._hsData) return;

  const q      = (document.getElementById('hs-search')?.value || '').trim().toLowerCase();
  const grupo  = (document.getElementById('hs-filter-grupo')?.value || '');
  const status = (document.getElementById('hs-filter-status')?.value || '');

  const _fmt  = wrap._hsFmt;
  const _date = wrap._hsDate;
  const _e    = wrap._hsE;

  const rows = wrap._hsData.filter(({ sim, lead }) => {
    if (grupo  && sim.grupo  !== grupo)  return false;
    if (status && sim.status !== status) return false;
    if (q) {
      const haystack = ((lead.nome || '') + ' ' + (sim.grupo || '')).toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const list = document.getElementById('hs-list');
  if (!list) return;

  if (rows.length === 0) {
    list.innerHTML = `
<div style="text-align:center;padding:60px 20px">
  <i class="bi bi-calculator" style="font-size:48px;color:var(--border)"></i>
  <div style="font-size:16px;font-weight:700;color:var(--primary);margin-top:16px">Nenhuma simulação registrada ainda.</div>
  <div style="font-size:13px;color:var(--muted);margin-top:6px">Crie uma nova simulação para os seus clientes.</div>
  <button class="btn btn-accent" style="margin-top:20px;padding:10px 24px;font-size:14px"
    onclick="if(window.navigate)navigate('simulador',document.querySelector('[data-page=simulador]'))">
    <i class="bi bi-plus-circle"></i> Nova Simulação
  </button>
</div>`;
    return;
  }

  /* ── table ── */
  list.innerHTML = `
<div class="card" style="overflow-x:auto;padding:0">
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead>
      <tr style="background:var(--bg);border-bottom:2px solid var(--border)">
        <th style="padding:12px 16px;text-align:left;font-weight:700;color:var(--primary);white-space:nowrap">Data</th>
        <th style="padding:12px 16px;text-align:left;font-weight:700;color:var(--primary)">Cliente</th>
        <th style="padding:12px 16px;text-align:left;font-weight:700;color:var(--primary)">Grupo</th>
        <th style="padding:12px 16px;text-align:right;font-weight:700;color:var(--primary)">Crédito</th>
        <th style="padding:12px 16px;text-align:left;font-weight:700;color:var(--primary)">Objetivo</th>
        <th style="padding:12px 16px;text-align:center;font-weight:700;color:var(--primary);white-space:nowrap">Mês Contempl.</th>
        <th style="padding:12px 16px;text-align:center;font-weight:700;color:var(--primary)">Status</th>
        <th style="padding:12px 16px;text-align:center;font-weight:700;color:var(--primary)">Ação</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(({ sim, lead }, idx) => {
        const isPreProposta = sim.status === 'pre-proposta';
        const badge = isPreProposta
          ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;white-space:nowrap"><span style="width:6px;height:6px;border-radius:50%;background:#16a34a;display:inline-block"></span>Pré-proposta</span>`
          : `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--bg);color:var(--muted);border:1px solid var(--border);border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;white-space:nowrap"><span style="width:6px;height:6px;border-radius:50%;background:var(--muted);display:inline-block"></span>${_e(sim.status || '—')}</span>`;

        const leadClick = `navigate('clientes',document.querySelector('[data-page=clientes]'));setTimeout(()=>typeof _clOpenPerfil==='function'&&_clOpenPerfil(${JSON.stringify(lead.id)}),300)`;
        const nomeCell = lead.id
          ? `<span style="color:var(--primary);font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:2px" onclick="${_e(leadClick)}">${_e(lead.nome || '—')}</span>`
          : `<span style="font-weight:600">${_e(lead.nome || '—')}</span>`;

        const rowBg = idx % 2 === 1 ? 'background:var(--bg)' : '';

        return `<tr style="${rowBg};border-bottom:1px solid var(--border)" class="hs-row">
          <td style="padding:12px 16px;white-space:nowrap;color:var(--muted)">${_date(sim.criadoEm)}</td>
          <td style="padding:12px 16px">${nomeCell}</td>
          <td style="padding:12px 16px"><span style="background:var(--primary-pale);color:var(--primary);border-radius:6px;padding:3px 8px;font-size:12px;font-weight:700">${_e(sim.grupo || '—')}</span></td>
          <td style="padding:12px 16px;text-align:right;font-weight:700;color:var(--primary);white-space:nowrap">${_fmt(sim.credito)}</td>
          <td style="padding:12px 16px;color:var(--text);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_e(sim.objetivo || '')}">${_e(sim.objetivo || '—')}</td>
          <td style="padding:12px 16px;text-align:center;color:var(--text)">${sim.mesContempl ? sim.mesContempl + ' meses' : '—'}</td>
          <td style="padding:12px 16px;text-align:center">${badge}</td>
          <td style="padding:12px 16px;text-align:center">
            <button class="btn btn-ghost btn-sm"
              style="font-size:12px;padding:5px 12px;border:1px solid var(--border);border-radius:8px;white-space:nowrap"
              onclick="navigate('clientes',document.querySelector('[data-page=clientes]'));setTimeout(()=>typeof _clOpenPerfil==='function'&&_clOpenPerfil(${JSON.stringify(lead.id)}),300)">
              <i class="bi bi-person-lines-fill"></i> Ver Perfil
            </button>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  <div style="padding:10px 16px;border-top:1px solid var(--border);font-size:12px;color:var(--muted)">
    Exibindo ${rows.length} de ${wrap._hsData.length} simulações
  </div>
</div>`;
}

/* ── clear filters helper ── */
function hsClearFilters() {
  const s = document.getElementById('hs-search');
  const g = document.getElementById('hs-filter-grupo');
  const st = document.getElementById('hs-filter-status');
  if (s)  s.value  = '';
  if (g)  g.value  = '';
  if (st) st.value = '';
  hsApplyFilters();
}
