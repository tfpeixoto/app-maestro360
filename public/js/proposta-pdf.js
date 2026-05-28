/* =====================================================================
   Gênesis — Geração de PDF de Propostas
   Abre uma janela de impressão estilizada; o usuário salva como PDF
   via o diálogo nativo do browser (Ctrl+P / Cmd+P).
   ===================================================================== */

function propGerarPDF(propId) {
  const prop = propGet().find(p => p.id === propId);
  if (!prop) return;

  const cfg  = (typeof cfgGet === 'function') ? cfgGet() : {};
  const lead = (typeof storeGet === 'function') ? storeGet().find(l => String(l.id) === String(prop.leadId)) : null;

  const empresa  = cfg.nomeEmpresa || '[Nome da Empresa]';
  const cnpj     = cfg.cnpj        || '';
  const telefone = cfg.telefone    || '';
  const email    = cfg.emailEmp    || '';
  const site     = cfg.site        || '';
  const endereco = cfg.endereco    || '';

  const hoje     = new Date().toLocaleDateString('pt-BR');
  const numero   = String(prop.id).slice(-6).padStart(6, '0');
  const validade = prop.validade
    ? new Date(prop.validade + 'T00:00:00').toLocaleDateString('pt-BR')
    : '—';
  const valorFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prop.valor || 0);

  const infoLead = lead ? [
    lead.email    ? `<tr><td>E-mail</td><td>${_esc(lead.email)}</td></tr>`      : '',
    lead.telefone ? `<tr><td>Telefone</td><td>${_esc(lead.telefone)}</td></tr>` : '',
    lead.origem   ? `<tr><td>Origem</td><td>${_esc(lead.origem)}</td></tr>`     : '',
  ].join('') : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Proposta Nº ${numero}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; font-size:12px; color:#1e293b; background:white; }
    .page { width:210mm; min-height:297mm; padding:20mm 18mm; margin:0 auto; }

    .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0d1f3c; padding-bottom:16px; margin-bottom:24px; }
    .logo-block h1 { font-size:22px; font-weight:900; color:#0d1f3c; letter-spacing:-.5px; }
    .logo-block p  { font-size:10px; color:#64748b; margin-top:2px; }
    .header-info   { text-align:right; font-size:10px; color:#64748b; line-height:1.7; }

    .prop-badge { background:#0d1f3c; color:white; display:inline-block; padding:6px 16px; border-radius:6px; font-size:13px; font-weight:800; letter-spacing:1px; margin-bottom:18px; }

    .section { margin-bottom:22px; }
    .section-title { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#64748b; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin-bottom:12px; }

    table { width:100%; border-collapse:collapse; }
    table td { padding:7px 10px; border-bottom:1px solid #f1f5f9; font-size:12px; }
    table td:first-child { font-weight:700; color:#475569; width:35%; }

    .value-box { background:#0d1f3c; color:white; border-radius:10px; padding:16px 22px; display:flex; justify-content:space-between; align-items:center; margin-bottom:22px; }
    .value-box .label  { font-size:11px; opacity:.75; font-weight:600; }
    .value-box .amount { font-size:26px; font-weight:900; letter-spacing:-1px; }
    .value-box .validity { text-align:right; }
    .value-box .validity .date { font-size:14px; font-weight:800; }

    .desc-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px 16px; font-size:12px; line-height:1.7; color:#334155; white-space:pre-wrap; }

    .terms { background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:12px 16px; margin-bottom:22px; }
    .terms p { font-size:10px; color:#78350f; line-height:1.6; }

    .signatures { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-top:50px; }
    .sig-line { border-top:1.5px solid #cbd5e1; padding-top:8px; }
    .sig-name { font-size:11px; font-weight:700; color:#1e293b; }
    .sig-role { font-size:10px; color:#64748b; }

    .footer { margin-top:40px; padding-top:12px; border-top:1px solid #e2e8f0; text-align:center; font-size:9px; color:#94a3b8; }

    @media print {
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .page { padding:15mm 15mm; }
    }
  </style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="logo-block">
      <h1>${_esc(empresa)}</h1>
      ${cnpj ? `<p>CNPJ: ${_esc(cnpj)}</p>` : ''}
    </div>
    <div class="header-info">
      ${telefone ? _esc(telefone) + '<br>' : ''}
      ${email    ? _esc(email)    + '<br>' : ''}
      ${site     ? _esc(site)     + '<br>' : ''}
      ${endereco ? _esc(endereco)          : ''}
    </div>
  </div>

  <div class="prop-badge">PROPOSTA Nº ${numero}</div>

  <div class="value-box">
    <div>
      <div class="label">Valor da Proposta</div>
      <div class="amount">${valorFmt}</div>
    </div>
    <div class="validity">
      <div class="label">Válida até</div>
      <div class="date">${validade}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Dados da Proposta</div>
    <table>
      <tr><td>Título</td><td>${_esc(prop.titulo || '—')}</td></tr>
      <tr><td>Status</td><td>${_propStatusLabel(prop.status)}</td></tr>
      <tr><td>Data de emissão</td><td>${hoje}</td></tr>
      <tr><td>Validade</td><td>${validade}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Dados do Cliente</div>
    <table>
      <tr><td>Nome</td><td>${_esc(prop.leadNome || '—')}</td></tr>
      ${infoLead}
    </table>
  </div>

  ${prop.descricao ? `
  <div class="section">
    <div class="section-title">Descrição e Condições</div>
    <div class="desc-box">${_esc(prop.descricao)}</div>
  </div>` : ''}

  <div class="terms">
    <p><strong>Atenção:</strong> Esta proposta é válida até a data indicada acima e está sujeita à disponibilidade de cotas e aprovação interna. Os valores apresentados podem ser alterados sem aviso prévio após o vencimento.</p>
  </div>

  <div class="signatures">
    <div>
      <div class="sig-line"></div>
      <div class="sig-name">${_esc(prop.leadNome || 'Cliente')}</div>
      <div class="sig-role">Contratante</div>
    </div>
    <div>
      <div class="sig-line"></div>
      <div class="sig-name">${_esc(empresa)}</div>
      <div class="sig-role">Contratada</div>
    </div>
  </div>

  <div class="footer">
    Documento gerado em ${hoje} · Gênesis CRM · ${_esc(empresa)}${cnpj ? ' · CNPJ ' + _esc(cnpj) : ''}
  </div>

</div>
<script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { alert('Permita popups para gerar o PDF.'); return; }
  win.document.write(html);
  win.document.close();
}

function _propStatusLabel(status) {
  const map = {
    'pre-proposta':  'Pré-Proposta',
    rascunho:        'Rascunho',
    enviada:         'Enviada',
    aceita:          'Aceita',
    recusada:        'Recusada',
    venda_realizada: 'Venda Realizada',
  };
  return map[status] || status;
}
