/* =====================================================================
   INADIMPLÊNCIA — Cotas / Clientes com parcelas em atraso
   Lê dados de: crm_parcelas (parcelas.js), storeGet() (leads)
   ===================================================================== */

function initInadimplencia() {
  const el = document.getElementById('page-inadimplencia');
  if (!el) return;
  el.innerHTML = _inadRender();
}

function _inadRender() {
  const parcelas    = parcGet ? parcGet() : [];
  const atrasadas   = parcelas.filter(p => p.status === 'atrasado');
  const leads       = storeGet();
  const hoje        = new Date();

  /* Agrupa por lead */
  const porLead = {};
  atrasadas.forEach(p => {
    if (!porLead[p.leadId]) {
      const lead = leads.find(l => l.id === p.leadId);
      porLead[p.leadId] = { nome: p.leadNome || '—', email: lead?.email || '', telefone: lead?.telefone || '', parcelas: [] };
    }
    porLead[p.leadId].parcelas.push(p);
  });
  const lista = Object.values(porLead).sort((a, b) => {
    const va = a.parcelas.reduce((s, p) => s + (p.valor||0), 0);
    const vb = b.parcelas.reduce((s, p) => s + (p.valor||0), 0);
    return vb - va;
  });

  const totalInad   = atrasadas.reduce((s, p) => s + (p.valor||0), 0);
  const qtdClientes = lista.length;
  const qtdParcelas = atrasadas.length;

  /* Dias de atraso médio */
  const diasMedio = atrasadas.length > 0
    ? Math.round(atrasadas.reduce((s, p) => {
        const diff = (hoje - new Date(p.vencimento+'T00:00:00')) / 86400000;
        return s + Math.max(diff, 0);
      }, 0) / atrasadas.length)
    : 0;

  const risco = totalInad > 10000 ? 'Alto' : totalInad > 3000 ? 'Médio' : 'Baixo';
  const riscoColor = risco === 'Alto' ? '#ef4444' : risco === 'Médio' ? '#d97706' : '#16a34a';

  return `
    <div class="page-header">
      <div><div class="page-title">Inadimplência</div><div class="page-subtitle">Clientes com parcelas em atraso</div></div>
      <button class="btn btn-outline btn-sm" onclick="initInadimplencia()"><i class="bi bi-arrow-clockwise"></i> Atualizar</button>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;margin-bottom:22px">
      ${_inadKpi('Total em Atraso',  fmtValor(totalInad), 'bi-exclamation-triangle-fill', '#ef4444')}
      ${_inadKpi('Clientes',         qtdClientes,          'bi-person-exclamation',        '#d97706')}
      ${_inadKpi('Parcelas',         qtdParcelas,           'bi-calendar-x-fill',          '#7c3aed')}
      ${_inadKpi('Dias Médio Atraso',diasMedio + 'd',       'bi-clock-history',             '#0891b2')}
      ${_inadKpi('Nível de Risco',   risco,                 'bi-shield-exclamation',        riscoColor)}
    </div>

    ${lista.length === 0
      ? `<div class="card" style="text-align:center;padding:60px 20px">
          <i class="bi bi-emoji-smile" style="font-size:48px;color:#16a34a;display:block;margin-bottom:16px"></i>
          <div style="font-size:18px;font-weight:800;color:#16a34a;margin-bottom:8px">Nenhuma inadimplência!</div>
          <div style="font-size:13px;color:var(--muted)">Todos os clientes estão em dia com os pagamentos.</div>
        </div>`
      : lista.map(item => {
          const totalItem = item.parcelas.reduce((s,p) => s+(p.valor||0), 0);
          const maxDias   = Math.max(...item.parcelas.map(p => {
            const diff = (hoje - new Date(p.vencimento+'T00:00:00')) / 86400000;
            return Math.max(diff, 0);
          }));
          const wppLink   = item.telefone
            ? `https://wa.me/55${item.telefone.replace(/\D/g,'')}`
            : null;
          return `
            <div class="card" style="margin-bottom:12px;border-left:4px solid #ef4444">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="width:40px;height:40px;background:#ef444422;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;color:#ef4444;flex-shrink:0">
                    ${(item.nome||'?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style="font-size:14px;font-weight:800;color:var(--primary)">${_esc(item.nome)}</div>
                    <div style="font-size:11px;color:var(--muted)">${item.email ? _esc(item.email)+' · ' : ''}${item.telefone||''}</div>
                  </div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:16px;font-weight:900;color:#ef4444">${fmtValor(totalItem)}</div>
                  <div style="font-size:11px;color:var(--muted)">${item.parcelas.length} parcela(s) · ${Math.round(maxDias)}d atraso</div>
                </div>
              </div>

              <!-- Parcelas em atraso -->
              <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">
                ${item.parcelas.map(p => `
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#fee2e2;border-radius:8px;font-size:12px">
                    <span>Venc. ${p.vencimento ? new Date(p.vencimento+'T00:00:00').toLocaleDateString('pt-BR') : '—'}</span>
                    <span style="font-weight:700;color:#ef4444">${fmtValor(p.valor)}</span>
                    <button class="btn btn-sm" style="background:#dcfce7;color:#16a34a;border:none;font-size:10px;padding:2px 8px" onclick="_inadMarcarPago(${p.id})">
                      <i class="bi bi-check-lg"></i> Pago
                    </button>
                  </div>`).join('')}
              </div>

              <!-- Ações -->
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                ${wppLink ? `<a class="btn btn-sm" style="background:#dcfce7;color:#16a34a;text-decoration:none;display:flex;align-items:center;gap:4px" href="${wppLink}" target="_blank"><i class="bi bi-whatsapp"></i> Cobrar via WhatsApp</a>` : ''}
                ${item.email ? `<button class="btn btn-ghost btn-sm" onclick="_inadCobrarEmail('${_esc(item.email)}','${_esc(item.nome)}',${totalItem})"><i class="bi bi-envelope-fill"></i> Cobrar via E-mail</button>` : ''}
                <button class="btn btn-ghost btn-sm" onclick="_inadRegularizar('${_esc(item.nome)}')"><i class="bi bi-handshake"></i> Acordo</button>
              </div>
            </div>`;
        }).join('')}
  `;
}

function _inadKpi(label, val, icon, color) {
  return `<div class="card" style="text-align:center;padding:14px 10px">
    <i class="bi ${icon}" style="font-size:20px;color:${color};display:block;margin-bottom:6px"></i>
    <div style="font-size:16px;font-weight:900;color:var(--primary);margin-bottom:2px">${val}</div>
    <div style="font-size:10px;color:var(--muted);font-weight:600">${label}</div>
  </div>`;
}

function _inadMarcarPago(parcId) {
  if (typeof parcUpdate === 'function') {
    parcUpdate(parcId, { status: 'pago', pagaEm: new Date().toISOString() });
    initInadimplencia();
  }
}

function _inadCobrarEmail(email, nome, valor) {
  if (!gauthIsConnected()) {
    alert('Conecte o Google para enviar e-mails.');
    return;
  }
  const assunto = 'Parcela em atraso — [Nome da Empresa]';
  const corpo   = `Olá, ${nome}!\n\nIdentificamos parcela(s) em atraso no valor de R$ ${valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}.\n\nPor favor, regularize o quanto antes ou entre em contato conosco.\n\nAtenciosamente,\nEquipe [Nome da Empresa]`;
  if (typeof gmailSend === 'function') {
    gmailSend({ to: email, subject: assunto, body: corpo })
      .then(r => alert(r ? 'E-mail enviado!' : 'Erro ao enviar. Verifique as permissões do Gmail.'));
  }
}

function _inadRegularizar(nome) {
  alert(`Funcionalidade de acordo para ${nome} em desenvolvimento.\nEm breve: registro de acordos, parcelamentos e renegociações.`);
}
