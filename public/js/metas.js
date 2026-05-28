/* =====================================================================
   METAS — Histórico mensal, comparativo e sparklines
   ===================================================================== */
const MT_KEY   = 'crm_metas';
const MT_HIST  = 'crm_metas_history';
const MT_DEF   = { prospeccao:400, leads:300, reunAgend:150, reunMes:110, reunDia:20, vendas:20 };

const MT_ITEMS = [
  { key:'prospeccao', label:'Prospecção / mês',          color:'#2563eb', icon:'bi-telephone-fill',      bg:'#eff6ff'  },
  { key:'leads',      label:'Leads / mês',               color:'#7c3aed', icon:'bi-people-fill',         bg:'#f5f3ff'  },
  { key:'reunAgend',  label:'Reuniões agendadas / mês',  color:'#d97706', icon:'bi-calendar-check-fill', bg:'#fffbeb'  },
  { key:'reunMes',    label:'Reuniões realizadas / mês', color:'#16a34a', icon:'bi-patch-check-fill',    bg:'#f0fdf4'  },
  { key:'reunDia',    label:'Reuniões hoje',             color:'#0891b2', icon:'bi-sun-fill',            bg:'#ecfeff'  },
  { key:'vendas',     label:'Vendas / mês',              color:'#c8920a', icon:'bi-trophy-fill',         bg:'#fffbeb'  },
];

function mtGetMetas()   { return JSON.parse(localStorage.getItem(MT_KEY)  || 'null') || MT_DEF; }
function mtGetHistory() { return JSON.parse(localStorage.getItem(MT_HIST) || '{}'); }

function mtActuals() {
  const leads    = storeGet();
  const reunioes = rnGet ? rnGet() : [];
  const hoje     = new Date().toISOString().slice(0,10);
  const mes      = hoje.slice(0,7); // YYYY-MM

  const leadsDoMes    = leads.filter(l => (l.criadoEm||'').startsWith(mes));
  const reunDoMes     = reunioes.filter(r => (r.data||'').startsWith(mes));
  const reunHoje      = reunioes.filter(r => r.data === hoje);
  const vendasDoMes   = leads.filter(l => l.stage === 'contrato' && (l.atualizadoEm||'').startsWith(mes));

  return {
    prospeccao: leadsDoMes.length,
    leads:      leadsDoMes.filter(l => l.stage !== 'lead').length,
    reunAgend:  reunDoMes.length,
    reunMes:    reunDoMes.filter(r => r.status === 'realizada').length,
    reunDia:    reunHoje.length,
    vendas:     vendasDoMes.length,
  };
}

function mtSnapshotMes() {
  const mes  = new Date().toISOString().slice(0,7);
  const hist = mtGetHistory();
  const act  = mtActuals();
  hist[mes]  = act;
  localStorage.setItem(MT_HIST, JSON.stringify(hist));
  return hist;
}

function mtLastMonths(n = 6) {
  const result = [];
  const now    = new Date();
  for (let i = n-1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    result.push(d.toISOString().slice(0,7));
  }
  return result;
}

/* ── RENDER ── */
function initMetas() {
  const el = document.getElementById('page-metas');
  if (!el) return;

  const hist    = mtSnapshotMes();
  const metas   = mtGetMetas();
  const act     = mtActuals();
  const meses   = mtLastMonths(6);
  const mesPrev = meses[meses.length - 2];
  const prev    = hist[mesPrev] || null;

  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Metas &amp; Objetivos</div>
        <div class="page-subtitle">Desempenho do mês atual e histórico dos últimos 6 meses</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" onclick="_mtEditarMetas()"><i class="bi bi-sliders"></i> Editar Metas</button>
        <button class="btn btn-primary" onclick="_mtRegistrarMes()"><i class="bi bi-floppy-fill"></i> Registrar Mês</button>
      </div>
    </div>

    <!-- KPI Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;margin-bottom:24px">
      ${MT_ITEMS.map(it => _mtKpiCard(it, act[it.key], metas[it.key], prev?.[it.key]??null, meses, hist)).join('')}
    </div>

    <!-- Barras de progresso -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-title"><i class="bi bi-bar-chart-fill" style="color:var(--accent)"></i> Realizado vs Meta — ${_mtMesLabel(meses[meses.length-1])}</div>
      ${MT_ITEMS.map(it => {
        const pct  = metas[it.key]>0 ? Math.min(Math.round(act[it.key]/metas[it.key]*100),100) : 0;
        const clr  = pct>=100?'#16a34a':pct>=75?'#d97706':pct>=50?it.color:'#ef4444';
        const txt  = pct>=100?'Meta atingida':'Abaixo da meta';
        return `<div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;flex-wrap:wrap;gap:4px">
            <span style="font-size:13px;font-weight:700;color:var(--primary)">${it.label}</span>
            <span style="font-size:12px;font-weight:700;color:${clr}">${act[it.key]} / ${metas[it.key]} — ${pct}%${pct>=100?' ✓':''}</span>
          </div>
          <div style="height:9px;background:#f1f5f9;border-radius:5px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${it.color};border-radius:5px;transition:width .4s"></div>
          </div>
          ${pct<100?`<div style="font-size:11px;color:var(--muted);margin-top:3px">${txt} · faltam ${metas[it.key]-act[it.key]}</div>`:
                    `<div style="font-size:11px;color:#16a34a;margin-top:3px;font-weight:700">Meta atingida!</div>`}
        </div>`;
      }).join('')}
    </div>

    <!-- Histórico tabela -->
    <div class="card">
      <div class="card-title"><i class="bi bi-clock-history" style="color:var(--accent)"></i> Histórico — Últimos 6 meses</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px 10px;color:var(--muted);font-weight:700;border-bottom:2px solid var(--border);white-space:nowrap">Métrica</th>
              ${meses.map(m=>`<th style="text-align:center;padding:8px 10px;color:var(--muted);font-weight:700;border-bottom:2px solid var(--border);white-space:nowrap">${_mtMesLabel(m)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${MT_ITEMS.map(it => {
              const values = meses.map(m => hist[m]?.[it.key] ?? '—');
              const meta   = metas[it.key];
              return `<tr>
                <td style="padding:8px 10px;font-weight:700;color:var(--primary);border-bottom:1px solid var(--border);white-space:nowrap">
                  <i class="bi ${it.icon}" style="color:${it.color};margin-right:5px"></i>${it.label}
                  <span style="font-size:10px;color:var(--muted);margin-left:4px">meta: ${meta}</span>
                </td>
                ${values.map((v,i) => {
                  const isAtual = i === meses.length-1;
                  const num     = typeof v === 'number' ? v : null;
                  const pct     = num !== null && meta>0 ? Math.round(num/meta*100) : null;
                  const clr     = pct===null?'var(--muted)':pct>=100?'#16a34a':pct>=75?'#d97706':'#ef4444';
                  return `<td style="text-align:center;padding:8px 10px;border-bottom:1px solid var(--border);background:${isAtual?'var(--primary-pale)':'transparent'}">
                    <span style="font-weight:${isAtual?800:600};color:${clr}">${v}</span>
                    ${pct!==null?`<div style="font-size:10px;color:${clr}">${pct}%</div>`:''}
                  </td>`;
                }).join('')}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal editar metas -->
    <div class="modal-overlay" id="mtModal" onclick="if(event.target===this)_mtCloseModal()" style="display:none;align-items:center;justify-content:center">
      <div class="modal" style="max-width:500px">
        <div class="modal-header">
          <span class="modal-title">Editar Metas</span>
          <button class="modal-close" onclick="_mtCloseModal()">✕</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${MT_ITEMS.map(it=>`
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label"><i class="bi ${it.icon}" style="color:${it.color}"></i> ${it.label}</label>
              <input class="form-input" id="mt-${it.key}" type="number" min="1" value="${metas[it.key]}" />
            </div>`).join('')}
        </div>
        <div class="form-actions" style="margin-top:16px">
          <button class="btn btn-ghost" onclick="_mtCloseModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="_mtSalvarMetas()"><i class="bi bi-floppy-fill"></i> Salvar</button>
        </div>
      </div>
    </div>
  `;
}

function _mtKpiCard(it, actual, meta, prevActual, meses, hist) {
  const pct     = meta>0 ? Math.min(Math.round(actual/meta*100),100) : 0;
  const delta   = prevActual !== null ? actual - prevActual : null;
  const deltaStr= delta !== null ? (delta>=0?'+':'')+delta : null;
  const deltaClr= delta === null ? 'var(--muted)' : delta>=0 ? '#16a34a' : '#ef4444';
  const clr     = pct>=100?'#16a34a':pct>=75?'#d97706':pct>=50?it.color:'#ef4444';

  // sparkline SVG (últimos 6 meses)
  const vals = meses.map(m => hist[m]?.[it.key] ?? 0);
  const maxV = Math.max(...vals, 1);
  const w=80, h=28;
  const pts = vals.map((v,i)=>`${Math.round(i*(w/(vals.length-1))||0)},${Math.round(h-(v/maxV)*h)}`).join(' ');
  const spark = `<svg width="${w}" height="${h}" style="display:block">
    <polyline points="${pts}" fill="none" stroke="${it.color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
    <circle cx="${pts.split(' ').at(-1).split(',')[0]}" cy="${pts.split(' ').at(-1).split(',')[1]}" r="2.5" fill="${it.color}"/>
  </svg>`;

  // anel de progresso
  const r=22, circ=Math.round(2*Math.PI*r);
  const dash=Math.round((pct/100)*circ);
  const ring=`<svg width="60" height="60" viewBox="0 0 60 60">
    <circle cx="30" cy="30" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="5"/>
    <circle cx="30" cy="30" r="${r}" fill="none" stroke="${clr}" stroke-width="5"
      stroke-dasharray="${dash} ${circ-dash}" stroke-dashoffset="${Math.round(circ*0.25)}" stroke-linecap="round"/>
    <text x="30" y="35" text-anchor="middle" font-size="11" font-weight="800" fill="${clr}">${pct}%</text>
  </svg>`;

  return `
    <div class="card" style="border-top:3px solid ${it.color};position:relative">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="width:34px;height:34px;background:${it.bg};border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:6px">
            <i class="bi ${it.icon}" style="font-size:15px;color:${it.color}"></i>
          </div>
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">${it.label}</div>
          <div style="font-size:28px;font-weight:900;color:${clr};line-height:1.1;margin-top:2px">${actual}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">meta: <strong>${meta}</strong>
            ${deltaStr!==null?`&nbsp;<span style="color:${deltaClr};font-weight:700">${deltaStr} vs mês ant.</span>`:''}
          </div>
        </div>
        ${ring}
      </div>
      ${spark}
    </div>`;
}

function _mtMesLabel(ym) {
  const [y,m] = ym.split('-');
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${nomes[parseInt(m,10)-1]}/${y.slice(2)}`;
}

function _mtEditarMetas() {
  const modal = document.getElementById('mtModal');
  if (modal) modal.style.display = 'flex';
}

function _mtCloseModal() {
  const modal = document.getElementById('mtModal');
  if (modal) modal.style.display = 'none';
}

function _mtSalvarMetas() {
  const g = key => parseInt(document.getElementById('mt-'+key)?.value)||MT_DEF[key];
  const m = {};
  MT_ITEMS.forEach(it => m[it.key] = g(it.key));
  localStorage.setItem(MT_KEY, JSON.stringify(m));
  _mtCloseModal();
  initMetas();
}

function _mtRegistrarMes() {
  mtSnapshotMes();
  const btn = event?.target;
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Registrado!';
    btn.style.background = '#16a34a';
    setTimeout(()=>{ btn.innerHTML=orig; btn.style.background=''; }, 2000);
  }
  initMetas();
}

/* Retrocompatibilidade: saveMetas() ainda chamado do HTML antigo */
function saveMetas() { _mtSalvarMetas(); }
