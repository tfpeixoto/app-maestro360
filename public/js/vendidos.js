/* =====================================================================
   VENDIDOS — Cotas vendidas por grupo, filtráveis por vendedor
   ===================================================================== */

const VEND = { grupo: 'todos', vendedor: '' };

function initVendidos() {
  const el = document.getElementById('page-vendidos');
  if (!el) return;
  el.innerHTML = _vendRender();
}

function _vendRender() {
  const cotas  = JSON.parse(localStorage.getItem('crm_cotas') || '{}');
  const leads  = JSON.parse(localStorage.getItem('crm_leads') || '[]');
  const GRUPOS_V = { '4003': { label: 'Grupo 4003', total: 180 }, '4004': { label: 'Grupo 4004', total: 180 } };

  /* collect all vendidas */
  const vendidas = [];
  Object.entries(cotas).forEach(([key, c]) => {
    if (c.status === 'vendida' || c.status === 'contemplada') {
      const [grupo, num] = key.split('_');
      const lead = leads.find(l => String(l.id) === String(c.leadId));
      vendidas.push({
        key, grupo, num: parseInt(num),
        cliente: c.cliente || '—',
        vendedor: c.vendedor || '—',
        status: c.status,
        vendidoEm: c.vendidoEm || '',
        obs: c.obs || '',
        leadId: c.leadId,
        telefone: lead?.telefone || '',
        parcelas: _vendGetParcelas(c.leadId),
      });
    }
  });

  /* filter */
  let filtered = [...vendidas];
  if (VEND.grupo !== 'todos') filtered = filtered.filter(v => v.grupo === VEND.grupo);
  if (VEND.vendedor) {
    const bv = VEND.vendedor.toLowerCase();
    filtered = filtered.filter(v => v.vendedor.toLowerCase().includes(bv) || v.cliente.toLowerCase().includes(bv));
  }
  filtered.sort((a, b) => (b.vendidoEm||'').localeCompare(a.vendidoEm||''));

  /* unique vendedores for filter */
  const vendedores = [...new Set(vendidas.map(v => v.vendedor).filter(v => v && v !== '—'))];

  /* stats */
  const totVend = filtered.length;
  const totAdim = filtered.filter(v => _vendAdimplente(v.parcelas)).length;
  const totInad = totVend - totAdim;

  return `
    <div class="page-header">
      <div>
        <div class="page-title">Vendidos</div>
        <div class="page-subtitle">Cotas vendidas por grupo e vendedor</div>
      </div>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;margin-bottom:20px">
      ${_vendKpi('Total Vendidas', totVend, 'bi-bag-check-fill', 'var(--primary)')}
      ${_vendKpi('Adimplentes', totAdim, 'bi-check-circle-fill', '#16a34a')}
      ${_vendKpi('Inadimplentes', totInad, 'bi-exclamation-circle-fill', '#ef4444')}
      ${_vendKpi('Contempladas', vendidas.filter(v=>v.status==='contemplada').length, 'bi-star-fill', '#d97706')}
    </div>

    <!-- Filtros -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
      <select class="form-input" style="max-width:180px" onchange="VEND.grupo=this.value;initVendidos()">
        <option value="todos" ${VEND.grupo==='todos'?'selected':''}>Todos os grupos</option>
        ${Object.entries(GRUPOS_V).map(([k,g]) => `<option value="${k}" ${VEND.grupo===k?'selected':''}>${g.label}</option>`).join('')}
      </select>
      ${vendedores.length ? `
        <select class="form-input" style="max-width:200px" onchange="VEND.vendedor=this.value==='todos'?'':this.value;initVendidos()">
          <option value="todos">Todos os vendedores</option>
          ${vendedores.map(v => `<option value="${v}" ${VEND.vendedor===v?'selected':''}>${_esc(v)}</option>`).join('')}
        </select>` : ''}
      <input class="form-input" placeholder="Buscar cliente ou vendedor..." style="max-width:260px"
        value="${_esc(VEND.vendedor)}" oninput="VEND.vendedor=this.value;initVendidos()" />
    </div>

    ${filtered.length === 0
      ? `<div class="card" style="text-align:center;padding:60px;color:var(--muted)">
          <i class="bi bi-bag" style="font-size:40px;opacity:.25;display:block;margin-bottom:12px"></i>
          Nenhuma cota vendida encontrada.
        </div>`
      : `<div class="card" style="padding:0;overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:var(--bg);font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">
                <th style="padding:10px 16px;text-align:left">Cota</th>
                <th style="padding:10px 16px;text-align:left">Cliente</th>
                <th style="padding:10px 16px;text-align:left">Vendedor</th>
                <th style="padding:10px 16px;text-align:center">Status</th>
                <th style="padding:10px 16px;text-align:center">Pagamentos</th>
                <th style="padding:10px 16px;text-align:center">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(v => {
                const numStr = String(v.num).padStart(3,'0');
                const grupoLabel = GRUPOS_V[v.grupo]?.label || v.grupo;
                const adim = _vendAdimplente(v.parcelas);
                const parcPagas = v.parcelas.filter(p => p.status === 'pago').length;
                const parcTotal = v.parcelas.length;
                const statusColor = v.status==='contemplada' ? '#d97706' : '#1d4ed8';
                const statusLabel = v.status==='contemplada' ? 'Contemplada' : 'Vendida';
                return `
                  <tr style="border-top:1px solid var(--border);font-size:13px">
                    <td style="padding:10px 16px">
                      <div style="font-weight:800;color:var(--primary)">${numStr}</div>
                      <div style="font-size:11px;color:var(--muted)">${grupoLabel}</div>
                    </td>
                    <td style="padding:10px 16px">
                      <div style="font-weight:700">${_esc(v.cliente)}</div>
                      ${v.telefone ? `<div style="font-size:11px;color:var(--muted)">${_esc(v.telefone)}</div>` : ''}
                    </td>
                    <td style="padding:10px 16px;color:var(--muted)">${_esc(v.vendedor)}</td>
                    <td style="padding:10px 16px;text-align:center">
                      <span style="font-size:10px;font-weight:700;background:${statusColor}22;color:${statusColor};padding:3px 9px;border-radius:8px">${statusLabel}</span>
                    </td>
                    <td style="padding:10px 16px;text-align:center">
                      <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
                        <span style="font-size:11px;font-weight:700;color:${adim?'#16a34a':'#ef4444'}">
                          <i class="bi bi-${adim?'check-circle-fill':'exclamation-circle-fill'}"></i>
                          ${adim ? 'Adimplente' : 'Inadimplente'}
                        </span>
                        ${parcTotal ? `<span style="font-size:10px;color:var(--muted)">${parcPagas}/${parcTotal} pagas</span>` : ''}
                      </div>
                    </td>
                    <td style="padding:10px 16px;text-align:center">
                      <div style="display:flex;gap:4px;justify-content:center">
                        ${v.telefone ? `<a class="btn btn-sm" style="background:#dcfce7;color:#15803d;border:none;font-size:11px" href="https://wa.me/55${v.telefone.replace(/\D/g,'')}" target="_blank" title="WhatsApp"><i class="bi bi-whatsapp"></i></a>` : ''}
                        <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="_vendMarcarContemplada('${v.key}')" title="Marcar como contemplada">
                          <i class="bi bi-star"></i>
                        </button>
                      </div>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`}
  `;
}

function _vendGetParcelas(leadId) {
  if (!leadId) return [];
  try {
    return JSON.parse(localStorage.getItem('crm_parcelas') || '[]').filter(p => String(p.leadId) === String(leadId));
  } catch { return []; }
}

function _vendAdimplente(parcelas) {
  if (!parcelas.length) return true;
  return !parcelas.some(p => p.status === 'atrasado');
}

function _vendMarcarContemplada(key) {
  const cotas = JSON.parse(localStorage.getItem('crm_cotas') || '{}');
  if (!cotas[key]) return;
  cotas[key].status = 'contemplada';
  localStorage.setItem('crm_cotas', JSON.stringify(cotas));
  initVendidos();
  if (typeof showToast === 'function') showToast('Cota marcada como contemplada ✓');
}

function _vendKpi(label, val, icon, color) {
  return `<div class="card" style="text-align:center;padding:14px 10px">
    <i class="bi ${icon}" style="font-size:20px;color:${color};display:block;margin-bottom:6px"></i>
    <div style="font-size:20px;font-weight:900;color:var(--primary);margin-bottom:2px">${val}</div>
    <div style="font-size:10px;color:var(--muted);font-weight:600">${label}</div>
  </div>`;
}
