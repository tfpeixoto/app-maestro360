/* =====================================================================
   DECISÕES — Inteligência e Analytics do Pipeline
   Usa dados reais: storeGet(), rnGet(), STAGES, fmtValor()
   ===================================================================== */

function initDecisoes() {
  const el = document.getElementById('page-decisoes');
  if (!el) return;
  el.innerHTML = _decRender();
}

function _decRender() {
  const leads    = storeGet();
  const reunioes = rnGet();
  const hoje     = new Date();
  const mesAtual = hoje.toISOString().slice(0, 7);

  /* KPIs */
  const totalLeads     = leads.length;
  const pipeline       = leads.reduce((s, l) => s + (l.valorDesejado || 0), 0);
  const reunMes        = reunioes.filter(r => r.data?.startsWith(mesAtual)).length;
  const convertidos    = leads.filter(l => ['contrato', 'fechado'].includes(l.stage)).length;
  const taxaConv       = totalLeads > 0 ? Math.round((convertidos / totalLeads) * 100) : 0;
  const ticketMedio    = convertidos > 0
    ? leads.filter(l => ['contrato','fechado'].includes(l.stage)).reduce((s,l) => s+(l.valorDesejado||0), 0) / convertidos
    : 0;

  /* Por stage */
  const porStage = STAGES.map(s => {
    const lst  = leads.filter(l => l.stage === s.id);
    const val  = lst.reduce((sum, l) => sum + (l.valorDesejado || 0), 0);
    return { ...s, count: lst.length, valor: val };
  });

  /* Por origem */
  const origens = {};
  leads.forEach(l => { const o = l.origem || 'Não informado'; origens[o] = (origens[o] || 0) + 1; });
  const origensList = Object.entries(origens).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxOrig = origensList[0]?.[1] || 1;

  /* Atividade mensal — últimos 6 meses */
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const d   = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    const lbl = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    meses.push({
      key, lbl,
      leads:    leads.filter(l => l.criadoEm?.startsWith(key)).length,
      reunioes: reunioes.filter(r => r.data?.startsWith(key)).length,
    });
  }
  const maxBarra = Math.max(...meses.map(m => Math.max(m.leads, m.reunioes)), 1);

  /* Top oportunidades — score: stage (50) + valor (30) + reunioes (20) */
  const topLeads = [...leads].map(l => {
    const si   = STAGES.findIndex(s => s.id === l.stage);
    const score = Math.round(
      (si / Math.max(STAGES.length - 1, 1)) * 50 +
      Math.min((l.valorDesejado || 0) / 5000, 30) +
      Math.min(reunioes.filter(r => r.leadId === l.id).length * 4, 20)
    );
    return { ...l, score };
  }).sort((a, b) => b.score - a.score).slice(0, 5);

  return `
    <div class="page-header">
      <div><div class="page-title">Decisões</div><div class="page-subtitle">Inteligência e analytics do pipeline de vendas</div></div>
      <button class="btn btn-outline btn-sm" onclick="initDecisoes()"><i class="bi bi-arrow-clockwise"></i> Atualizar</button>
    </div>

    <!-- KPI Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;margin-bottom:22px">
      ${_decKpi('Leads Total',      totalLeads,           'bi-people-fill',         'var(--primary)')}
      ${_decKpi('Pipeline',         fmtValor(pipeline),   'bi-currency-dollar',      '#16a34a')}
      ${_decKpi('Reuniões/mês',     reunMes,              'bi-calendar-check-fill',  '#7c3aed')}
      ${_decKpi('Convertidos',      convertidos,           'bi-person-check-fill',   '#0891b2')}
      ${_decKpi('Taxa Conversão',   taxaConv + '%',        'bi-graph-up-arrow',      '#d97706')}
      ${_decKpi('Ticket Médio',     fmtValor(ticketMedio), 'bi-receipt-cutoff',      '#db2777')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">

      <!-- Funil de Conversão -->
      <div class="card">
        <div style="font-size:13px;font-weight:800;color:var(--primary);margin-bottom:14px"><i class="bi bi-funnel-fill"></i> Funil de Conversão</div>
        ${totalLeads === 0
          ? `<div style="font-size:12px;color:var(--muted)">Nenhum lead cadastrado.</div>`
          : porStage.map(s => `
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                <span style="font-size:12px;font-weight:700;color:${s.cor||'var(--primary)'}">${s.label}</span>
                <span style="font-size:11px;color:var(--muted)">${s.count} · ${fmtValor(s.valor)}</span>
              </div>
              <div style="height:8px;background:var(--border);border-radius:4px">
                <div style="height:100%;width:${Math.round((s.count/totalLeads)*100)}%;background:${s.cor||'var(--primary)'};border-radius:4px;transition:width .4s"></div>
              </div>
            </div>`).join('')}
      </div>

      <!-- Origem dos Leads -->
      <div class="card">
        <div style="font-size:13px;font-weight:800;color:var(--primary);margin-bottom:14px"><i class="bi bi-diagram-3-fill"></i> Origem dos Leads</div>
        ${origensList.length === 0
          ? `<div style="font-size:12px;color:var(--muted)">Nenhum dado disponível.</div>`
          : origensList.map(([orig, cnt]) => `
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                <span style="font-size:12px;font-weight:700">${_esc(orig)}</span>
                <span style="font-size:11px;color:var(--muted)">${cnt} (${Math.round((cnt/totalLeads)*100)}%)</span>
              </div>
              <div style="height:6px;background:var(--border);border-radius:3px">
                <div style="height:100%;width:${Math.round((cnt/maxOrig)*100)}%;background:var(--primary);border-radius:3px"></div>
              </div>
            </div>`).join('')}
      </div>
    </div>

    <!-- Atividade Mensal -->
    <div class="card" style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:800;color:var(--primary);margin-bottom:16px"><i class="bi bi-bar-chart-fill"></i> Atividade Mensal — Últimos 6 Meses</div>
      <div style="display:flex;align-items:flex-end;gap:10px;height:130px">
        ${meses.map(m => `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
            <div style="width:100%;display:flex;gap:2px;align-items:flex-end;height:96px">
              <div style="flex:1;background:var(--primary);border-radius:3px 3px 0 0;min-height:2px;height:${Math.round((m.leads/maxBarra)*96)}px" title="Leads: ${m.leads}"></div>
              <div style="flex:1;background:#16a34a;border-radius:3px 3px 0 0;min-height:2px;height:${Math.round((m.reunioes/maxBarra)*96)}px" title="Reuniões: ${m.reunioes}"></div>
            </div>
            <div style="font-size:10px;color:var(--muted);text-align:center">${m.lbl}</div>
            <div style="font-size:9px;color:var(--muted)">${m.leads}L/${m.reunioes}R</div>
          </div>`).join('')}
      </div>
      <div style="display:flex;gap:16px;margin-top:10px">
        <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;background:var(--primary);border-radius:2px"></div><span style="font-size:11px;color:var(--muted)">Leads novos</span></div>
        <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;background:#16a34a;border-radius:2px"></div><span style="font-size:11px;color:var(--muted)">Reuniões</span></div>
      </div>
    </div>

    <!-- Top Oportunidades -->
    <div class="card">
      <div style="font-size:13px;font-weight:800;color:var(--primary);margin-bottom:14px"><i class="bi bi-star-fill" style="color:#d97706"></i> Top Oportunidades</div>
      ${topLeads.length === 0
        ? `<div style="font-size:12px;color:var(--muted)">Nenhum lead cadastrado ainda. Cadastre leads no Funil.</div>`
        : topLeads.map((l, i) => {
          const stage = STAGES.find(s => s.id === l.stage);
          const medal = i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#d97706' : 'var(--border)';
          return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="width:28px;height:28px;background:${medal};border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;color:white;flex-shrink:0">${i+1}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(l.nome)}</div>
              <div style="font-size:11px;color:var(--muted)">${stage?.label || l.stage} · ${fmtValor(l.valorDesejado)}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:12px;font-weight:900;color:var(--primary)">Score ${l.score}</div>
              <div style="width:64px;height:4px;background:var(--border);border-radius:2px;margin-top:3px">
                <div style="height:100%;width:${Math.min(l.score, 100)}%;background:var(--primary);border-radius:2px"></div>
              </div>
            </div>
          </div>`;
        }).join('')}
    </div>
  `;
}

function _decKpi(label, value, icon, color) {
  return `
    <div class="card" style="text-align:center;padding:16px 12px">
      <i class="bi ${icon}" style="font-size:22px;color:${color};display:block;margin-bottom:8px"></i>
      <div style="font-size:20px;font-weight:900;color:var(--primary);margin-bottom:3px">${value}</div>
      <div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px">${label}</div>
    </div>`;
}
