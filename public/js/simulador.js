/* ── CONSTANTS ── */
const MESES = 186, TAXA_ADM = 0.24, FUNDO = 0.02;

/*
 * TODO — INTEGRAÇÃO API CONSÓRCIO (PENDENTE)
 *
 * SIM_GRUPOS é um placeholder com dados fictícios.
 * Em produção, os grupos disponíveis para simulação devem vir da API de gestão do consórcio.
 *
 * O que a API precisa fornecer:
 *   - Lista de grupos ativos (id, nome, lance livre médio histórico)
 *   - Faixas de crédito disponíveis por grupo
 *
 * Quando integrado, substituir SIM_GRUPOS por chamada assíncrona à API antes de renderizar
 * a etapa de Portfólio (goStep(3)).
 */
const SIM_GRUPOS = {
  '4003': { label: 'Grupo 4003', lanceLivreMedio: 27.3 },  // ← placeholder: substituir pela API
  '4004': { label: 'Grupo 4004', lanceLivreMedio: 30.9 }   // ← placeholder: substituir pela API
};
const CRED_OPTIONS = [50000,75000,100000,150000,200000,300000,400000,500000,600000,700000,800000,1000000,1200000,1500000,2000000];
const STEP_LABELS = ['Cliente','Objetivo','Capacidade','Portfólio','Parâmetros','Resumo'];

/* ── STATE ── */
const S = {
  step: 1,
  cliente: { nome: '', telefone: '', cpf: '', email: '' },
  credito: 0, aporte: 0, lance: 0,
  objetivo: '',
  grupo: '4003',
  cart: {},
  perc: 0.7,
  mesContempl: 36,
  embPerc: 30
};

/* ── UTILS ── */
function _dotSep(n) {
  return Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function fR(v, dec=0) {
  const a = Math.abs(v);
  const s = v < 0 ? '−' : '';
  if (a >= 1e6) {
    const [i,f] = (a/1e6).toFixed(2).split('.');
    return s + 'R$ ' + i.replace(/\B(?=(\d{3})+(?!\d))/g,'.') + ',' + f + 'M';
  }
  if (a >= 1e3) {
    const [i,f] = (a/1e3).toFixed(dec).split('.');
    return s + 'R$ ' + i.replace(/\B(?=(\d{3})+(?!\d))/g,'.') + (dec > 0 && f ? ','+f : '') + 'k';
  }
  return s + 'R$ ' + _dotSep(a);
}
function fRf(v) {
  const [i,f] = Math.abs(v).toFixed(2).split('.');
  return 'R$ ' + i.replace(/\B(?=(\d{3})+(?!\d))/g,'.') + ',' + f;
}
function fP(v, d=1) { return v.toFixed(d).replace('.',',') + '%'; }
function parseMoeda(s) { return parseFloat(String(s).replace(/\./g,'').replace(',','.')) || 0; }
function moeda(el) {
  let v = el.value.replace(/\D/g,'');
  if (!v) { el.value = ''; return; }
  el.value = parseInt(v, 10).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function calcParcela(cred) {
  return cred * (TAXA_ADM + FUNDO) / MESES * S.perc;
}

/* ── PROGRESS BAR ── */
function renderProgress() {
  const bar = document.getElementById('progressBar');
  bar.innerHTML = STEP_LABELS.map((lbl, i) => {
    const n = i + 1;
    const cls = n < S.step ? 'ps done' : n === S.step ? 'ps active' : 'ps';
    const num = n < S.step ? '✓' : n;
    return `<div class="${cls}"><div class="ps-num">${num}</div><div class="ps-label">${lbl}</div></div>`;
  }).join('');
}

/* ── NAVIGATION ── */
function goStep(n) {
  document.getElementById('step-' + S.step).classList.remove('active');
  S.step = n;
  document.getElementById('step-' + n).classList.add('active');
  renderProgress();
  const mc = document.querySelector('.main-content');
  if (mc) mc.scrollTo(0,0); else window.scrollTo(0,0);
  if (n === 4) { renderGrupos(); _simAutoPortfolio(); renderPriceTable(); renderCart(); }
  if (n === 5) { updMes(); updEmb(); renderParamPreview(); }
}

/* ══════════════════ ETAPA 1 — CLIENTE ══════════════════ */
function s0Update() {
  S.cliente.nome      = (document.getElementById('s0_nome')?.value     || '').trim();
  S.cliente.telefone  = (document.getElementById('s0_telefone')?.value || '').trim();
  S.cliente.cpf       = (document.getElementById('s0_cpf')?.value      || '').replace(/\D/g,'');
  S.cliente.email     = (document.getElementById('s0_email')?.value    || '').trim();
  const btn = document.getElementById('btn-s0');
  if (btn) btn.disabled = !S.cliente.nome || !S.cliente.telefone;

  const box = document.getElementById('s0_result');
  if (!box) return;
  if (S.cliente.cpf.length === 11) {
    const leads = JSON.parse(localStorage.getItem('crm_leads') || '[]');
    const found = leads.find(l => (l.cpf||'').replace(/\D/g,'') === S.cliente.cpf);
    if (found) {
      box.innerHTML = `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 14px;font-size:13px;color:#15803d;margin-top:10px">
        <strong>✓ Lead encontrado:</strong> ${found.nome}
        <br><small style="color:#64748b">${found.email||''} · Etapa: ${found.stage||'—'}</small>
        <div style="margin-top:6px;font-size:12px;color:#15803d">A simulação será vinculada a este cliente.</div>
      </div>`;
      S.cliente._leadId = found.id;
    } else {
      box.innerHTML = `<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;font-size:12px;color:#92400e;margin-top:10px">CPF não cadastrado — um novo lead será criado ao salvar.</div>`;
      S.cliente._leadId = null;
    }
  } else {
    box.innerHTML = '';
    S.cliente._leadId = null;
  }
}

function s0CpfInput(el) {
  let v = el.value.replace(/\D/g,'').slice(0,11);
  if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/,'$1.$2.$3-$4');
  else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{0,3})/,'$1.$2.$3');
  else if (v.length > 3) v = v.replace(/(\d{3})(\d{0,3})/,'$1.$2');
  el.value = v;
  s0Update();
}

function s0TelInput(el) {
  let v = el.value.replace(/\D/g,'').slice(0,11);
  if (v.length > 10) v = v.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3');
  else if (v.length > 6) v = v.replace(/(\d{2})(\d{4,5})(\d{0,4})/,'($1) $2-$3');
  else if (v.length > 2) v = v.replace(/(\d{2})(\d{0,5})/,'($1) $2');
  el.value = v;
  s0Update();
}

/* ══════════════════ ETAPA 3 — CAPACIDADE (era etapa 1) ══════════════════ */
function s1Update() {
  S.credito = parseMoeda(document.getElementById('s1_credito').value);
  S.aporte  = parseMoeda(document.getElementById('s1_aporte').value);
  S.lance   = parseMoeda(document.getElementById('s1_lance').value);
  const btnS1 = document.getElementById('btn-s3');
  if (btnS1) btnS1.disabled = !S.credito || !S.aporte;

  const box = document.getElementById('s1_insight');
  if (!S.credito && !S.aporte) { box.innerHTML = '<div class="insight-box"><div style="color:#1e40af;font-size:13px;font-weight:600">💡 Preencha o crédito desejado e o aporte mensal para ver a análise automática.</div></div>'; return; }
  if (!S.credito || !S.aporte) { box.innerHTML = `<div class="insight-box"><div style="color:#1e40af;font-size:13px;font-weight:600">💡 ${!S.credito?'Informe o crédito desejado para continuar.':'Informe o aporte mensal para habilitar o próximo passo.'}</div></div>`; return; }

  const parcela70 = calcParcela(S.credito);
  const lanceEmb  = S.credito * 0.30;
  const lanceProp = S.credito * (SIM_GRUPOS[S.grupo].lanceLivreMedio / 100);
  const lanceTot  = lanceEmb + lanceProp;
  const lanceNec  = Math.max(0, lanceTot - (S.lance || 0));
  const sobra     = S.aporte - parcela70;
  const mesesLance = sobra > 0 ? Math.ceil(lanceNec / sobra) : null;

  let html = `<div class="insight-box"><div style="font-size:12px;font-weight:700;color:#1e40af;margin-bottom:8px;">Análise Rápida — ${fRf(S.credito)}</div>`;
  html += `<div class="ib-row"><span class="ib-label">Parcela estimada (70%)</span><span class="ib-value">${fRf(parcela70)}/mês</span></div>`;
  html += `<div class="ib-row"><span class="ib-label">Lance total estimado (grupo 4003)</span><span class="ib-value">${fRf(lanceTot)}</span></div>`;

  if (sobra > 0 && mesesLance !== null) {
    html += `<div class="ib-row"><span class="ib-label">Sobra para acumular lance</span><span class="ib-value">${fRf(sobra)}/mês</span></div>`;
    html += `<div class="ib-row"><span class="ib-label">Tempo para juntar o lance</span><span class="ib-value">~${mesesLance} meses</span></div>`;
  } else if (sobra <= 0) {
    html += `<div class="ib-warn">⚠ Seu aporte (${fRf(S.aporte)}) é menor que a parcela estimada (${fRf(parcela70)}). Considere um crédito menor ou aumentar o aporte.</div>`;
  }
  html += '</div>';
  box.innerHTML = html;
}

/* ══════════════════ ETAPA 2 — OBJETIVO ══════════════════ */
function selectObj(el) {
  document.querySelectorAll('.obj-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  S.objetivo = el.dataset.obj;
  document.getElementById('btn-s2').disabled = false;
}

/* ══════════════════ ETAPA 4 — PORTFÓLIO (era etapa 3) ══════════════════ */

/* ══════════════════ ETAPA 3 ══════════════════ */
/* Auto-preenche portfólio com base em S.credito e S.aporte (só se carrinho vazio) */
function _simAutoPortfolio() {
  if (Object.keys(S.cart).length > 0) return;
  if (!S.credito) return;

  // Ordena opções por proximidade ao crédito desejado
  const sorted = [...CRED_OPTIONS].sort((a, b) => Math.abs(a - S.credito) - Math.abs(b - S.credito));

  // Melhor cota: a mais próxima cuja parcela cabe no aporte (ou a mais próxima se aporte indefinido)
  let best = sorted.find(c => !S.aporte || calcParcela(c) <= S.aporte) || sorted[0];

  // Quantidade: quantas vezes o aporte suporta E quantas são necessárias para atingir o crédito
  const parcBest = calcParcela(best);
  const maxQtyByAporte = S.aporte && parcBest > 0 ? Math.max(1, Math.floor(S.aporte / parcBest)) : 1;
  const qtyForCredit   = Math.max(1, Math.ceil(S.credito / best));
  let qty = Math.min(maxQtyByAporte, qtyForCredit);

  S.cart[String(best)] = qty;

  // Tenta completar o crédito restante com uma cota menor (se houver margem no aporte)
  const remainder = S.credito - best * qty;
  if (remainder >= 30000) {
    const fill = closestCred(remainder);
    if (fill && fill !== best) {
      const extraParc = calcParcela(fill);
      const usedParc  = parcBest * qty;
      if (!S.aporte || usedParc + extraParc <= S.aporte * 1.05) {
        S.cart[String(fill)] = (S.cart[String(fill)] || 0) + 1;
      }
    }
  }
}

function renderGrupos() {
  document.getElementById('grupoSelector').innerHTML =
    '<div class="grupo-sel">' +
    Object.entries(SIM_GRUPOS).map(([k, g]) =>
      `<button class="g-btn${S.grupo===k?' active':''}" onclick="switchGrupo('${k}')">${g.label}</button>`
    ).join('') + '</div>';
}

function switchGrupo(g) {
  S.grupo = g;
  renderGrupos();
  renderPriceTable();
  renderCart();
}

function renderPriceTable() {
  const g = SIM_GRUPOS[S.grupo];
  const sugCred = closestCred(S.credito);

  let html = `<thead><tr>
    <th style="text-align:left">Crédito</th>
    <th>Parcela 70%</th>
    <th>Lance Emb.</th>
    <th>Crédito Livre</th>
    <th style="text-align:center">Qtde</th>
  </tr></thead><tbody>`;

  CRED_OPTIONS.forEach(c => {
    const key   = String(c);
    const qty   = S.cart[key] || 0;
    const parc  = calcParcela(c);
    const emb   = c * 0.30;
    const livre = c - emb;
    const isSug = c === sugCred;
    const rowCls = qty > 0 ? 'tem-cota' : isSug ? 'sugerida' : '';
    html += `<tr class="${rowCls}">
      <td>${fR(c)}${isSug ? '<span class="tag-sug">Sugerido</span>' : ''}</td>
      <td>${fRf(parc)}/mês</td>
      <td>${fRf(emb)}</td>
      <td style="color:#16a34a;font-weight:700">${fRf(livre)}</td>
      <td>
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="addToCart(${c},-1)">−</button>
          <span class="qty-num">${qty}</span>
          <button class="qty-btn" onclick="addToCart(${c},1)">+</button>
        </div>
      </td>
    </tr>`;
  });

  html += '</tbody>';
  document.getElementById('priceTbl').innerHTML = html;
}

function closestCred(target) {
  if (!target) return null;
  return CRED_OPTIONS.reduce((a,b) => Math.abs(b-target) < Math.abs(a-target) ? b : a);
}

function addToCart(cred, delta) {
  const key = String(cred);
  const cur  = S.cart[key] || 0;
  const next = Math.max(0, cur + delta);
  if (next === 0) delete S.cart[key]; else S.cart[key] = next;
  renderPriceTable();
  renderCart();
  document.getElementById('btn-s4').disabled = Object.keys(S.cart).length === 0;
}

function renderCart() {
  const panel = document.getElementById('cartPanel');
  const items = Object.entries(S.cart);

  if (items.length === 0) {
    panel.innerHTML = '<div class="cart-empty">Nenhuma cota selecionada.<br>Use <strong>+</strong> na tabela para adicionar.</div>';
    return;
  }

  let totalParc = 0, totalLance = 0, totalCred = 0, totalLivre = 0;
  let linhas = '';

  items.forEach(([key, qty]) => {
    const c     = parseInt(key);
    const parc  = calcParcela(c) * qty;
    const emb   = c * 0.30 * qty;
    const livre = (c - c * 0.30) * qty;
    totalParc  += parc;
    totalLance += emb;
    totalCred  += c * qty;
    totalLivre += livre;
    linhas += `<div class="cart-line">
      <div><div class="cl-cred">${fR(c)} × ${qty}</div><div class="cl-info">${fRf(parc)}/mês · Lance emb.: ${fRf(emb)}</div></div>
    </div>`;
  });

  panel.innerHTML = `
    <div class="cart-head">
      <span class="ch-title">Portfólio — ${items.length} cota${items.length>1?'s':''}</span>
      <button class="cart-clear" onclick="clearCart()">Limpar</button>
    </div>
    <div class="cart-body">${linhas}</div>
    <div class="cart-totals">
      <div class="ct-cell"><div class="ct-label">Parcela total/mês</div><div class="ct-val">${fRf(totalParc)}</div></div>
      <div class="ct-cell"><div class="ct-label">Lance emb. total</div><div class="ct-val">${fRf(totalLance)}</div></div>
      <div class="ct-cell"><div class="ct-label">Crédito total</div><div class="ct-val">${fR(totalCred)}</div></div>
      <div class="ct-cell green"><div class="ct-label">Crédito livre total</div><div class="ct-val green">${fR(totalLivre)}</div></div>
    </div>`;
}

function clearCart() {
  S.cart = {};
  renderPriceTable();
  renderCart();
  document.getElementById('btn-s4').disabled = true;
}

/* ══════════════════ ETAPA 4 ══════════════════ */
function setPerc(v, btn) {
  S.perc = v;
  document.querySelectorAll('.perc-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderParamPreview();
}

function updMes() {
  const v = +document.getElementById('sl_mes').value;
  S.mesContempl = v;
  document.getElementById('sv_mes').textContent = 'Mês ' + v;
  const hints = ['✨ Contemplação rápida — lance competitivo','🟢 Prazo adequado','🟡 Prazo longo — considere lance maior','⚠ Muito longo — avalie outra estratégia'];
  const idx = v <= 24 ? 0 : v <= 48 ? 1 : v <= 72 ? 2 : 3;
  document.getElementById('mes_hint').textContent = hints[idx];
  renderParamPreview();
}

function updEmb() {
  const v = +document.getElementById('sl_emb').value;
  S.embPerc = v;
  document.getElementById('sv_emb').textContent = v + '%';
  renderParamPreview();
}

function renderParamPreview() {
  const items = Object.entries(S.cart);
  if (!items.length) return;
  let totParc = 0, totEmb = 0, totCred = 0;
  items.forEach(([key, qty]) => {
    const c = parseInt(key);
    totParc += calcParcela(c) * qty;
    totEmb  += c * (S.embPerc/100) * qty;
    totCred += c * qty;
  });
  const g = SIM_GRUPOS[S.grupo];
  const livrePerc = g.lanceLivreMedio;
  const totProprio = totCred * (livrePerc/100);
  const totLance   = totEmb + totProprio;
  const totLivre   = totCred - totEmb;
  const mult       = totLance > 0 ? (totLivre / totLance).toFixed(2) : '—';

  document.getElementById('param_preview').innerHTML = `
    <div class="param-preview">
      <div class="pp-item"><span class="pp-label">Parcela total/mês</span><span class="pp-val">${fRf(totParc)}</span></div>
      <div class="pp-item"><span class="pp-label">Lance emb. (${S.embPerc}%)</span><span class="pp-val">${fRf(totEmb)}</span></div>
      <div class="pp-item"><span class="pp-label">Lance próprio est.</span><span class="pp-val">${fRf(totProprio)}</span></div>
      <div class="pp-item"><span class="pp-label">Crédito livre total</span><span class="pp-val">${fR(totLivre)}</span></div>
      <div class="pp-item"><span class="pp-label">Multiplicador</span><span class="pp-val">${mult}×</span></div>
      <div class="pp-item"><span class="pp-label">Contemplação esperada</span><span class="pp-val">Mês ${S.mesContempl}</span></div>
    </div>`;
}

/* ══════════════════ ETAPA 5 — CÁLCULO ══════════════════ */
function calcCota(cred, qty) {
  const parcela  = calcParcela(cred);
  const lEmb     = cred * (S.embPerc / 100);
  const g        = SIM_GRUPOS[S.grupo];
  const lProprio = cred * (g.lanceLivreMedio / 100);
  const lTotal   = lEmb + lProprio;
  const credLivre = cred - lEmb;
  const sIni     = cred * (1 + TAXA_ADM + FUNDO);
  const pagosAvante = S.mesContempl * parcela;
  const sPos     = Math.max(0, sIni - pagosAvante - lTotal);
  const novaP    = sPos > 0 ? sPos / (MESES - S.mesContempl) : 0;
  const totalPago = pagosAvante + lTotal + (MESES - S.mesContempl) * novaP;
  const mult     = lTotal > 0 ? (credLivre / lTotal) : 0;

  return { cred, qty, parcela, lEmb, lProprio, lTotal, credLivre, sIni, sPos, novaP, totalPago, mult };
}

function gerarResumo() {
  goStep(6);
  renderResumo();
  renderBotoesStep6();
}

/* ══════════════════ ETAPA 5 — RENDER ══════════════════ */
function renderResumo() {
  const items = Object.entries(S.cart);
  const grupos = {};
  items.forEach(([key, qty]) => { grupos[key] = { qty, data: calcCota(parseInt(key), qty) }; });

  let totCred=0, totParc=0, totLance=0, totLivre=0, totPago=0, totNovaP=0;
  items.forEach(([key, qty]) => {
    const d = calcCota(parseInt(key), qty);
    totCred   += d.cred  * qty;
    totParc   += d.parcela * qty;
    totLance  += d.lTotal  * qty;
    totLivre  += d.credLivre * qty;
    totPago   += d.totalPago * qty;
    totNovaP  += d.novaP * qty;
  });

  const objIcon = { imovel:'🏠', carro:'🚗', financeiro:'💰', outro:'📦' }[S.objetivo] || '📋';
  const objLabel = { imovel:'Comprar Imóvel', carro:'Comprar Veículo', financeiro:'Ganho Financeiro', outro:'Outro' }[S.objetivo] || 'Consórcio';
  const nomeCliente = S.cliente.nome || 'Cliente';
  const aporteOk = !S.aporte || totParc <= S.aporte;
  const aporteColor = aporteOk ? '#16a34a' : '#ef4444';

  // Composição do portfólio
  const composicao = items.map(([key, qty]) => {
    const d = calcCota(parseInt(key), qty);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9">
      <span style="font-size:13px;font-weight:700;color:var(--primary)">${fR(d.cred)} <span style="font-weight:400;color:var(--muted)">× ${qty} cota${qty>1?'s':''}</span></span>
      <span style="font-size:12px;color:var(--muted)">${fRf(d.parcela * qty)}/mês · Lance ${fRf(d.lTotal * qty)}</span>
    </div>`;
  }).join('');

  const html = `
    <!-- HERO -->
    <div style="background:linear-gradient(135deg,#0d1f3c 0%,#1c3a72 100%);border-radius:14px;padding:24px 28px;margin-bottom:20px;color:white">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div style="font-size:36px;line-height:1">${objIcon}</div>
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;opacity:.7">Simulação de Portfólio</div>
          <div style="font-size:20px;font-weight:800;margin-top:2px">${nomeCliente}</div>
          <div style="font-size:12px;opacity:.8;margin-top:2px">${objLabel} · Grupo ${S.grupo} · Contempl. mês ${S.mesContempl}</div>
        </div>
      </div>
      <!-- 4 métricas principais -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
        <div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:12px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;opacity:.7;margin-bottom:4px">Crédito Total</div>
          <div style="font-size:18px;font-weight:800">${fR(totCred)}</div>
          ${S.credito ? `<div style="font-size:10px;opacity:.6;margin-top:2px">Meta: ${fR(S.credito)}</div>` : ''}
        </div>
        <div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:12px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;opacity:.7;margin-bottom:4px">Parcela/mês</div>
          <div style="font-size:18px;font-weight:800">${fRf(totParc)}</div>
          ${S.aporte ? `<div style="font-size:10px;margin-top:2px;color:${aporteColor};font-weight:700">${aporteOk?'✓ Cabe no aporte':'⚠ Acima do aporte'}</div>` : ''}
        </div>
        <div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:12px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;opacity:.7;margin-bottom:4px">Lance Estimado</div>
          <div style="font-size:18px;font-weight:800">${fRf(totLance)}</div>
          <div style="font-size:10px;opacity:.6;margin-top:2px">Emb. ${S.embPerc}% + livre</div>
        </div>
        <div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:12px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;opacity:.7;margin-bottom:4px">Crédito Livre</div>
          <div style="font-size:18px;font-weight:800;color:#86efac">${fR(totLivre)}</div>
          <div style="font-size:10px;opacity:.6;margin-top:2px">Após lance embutido</div>
        </div>
      </div>
    </div>

    <!-- PORTFÓLIO + SECUNDÁRIOS -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <!-- Composição -->
      <div style="background:white;border:1px solid var(--border);border-radius:12px;padding:16px">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:10px">Portfólio</div>
        ${composicao || '<p style="color:var(--muted);font-size:13px">Nenhuma cota selecionada.</p>'}
        <div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:8px">
          <span style="font-size:12px;font-weight:700;color:var(--muted)">Total pago est.</span>
          <span style="font-size:13px;font-weight:800;color:var(--primary)">${fR(totPago)}</span>
        </div>
      </div>
      <!-- Indicadores secundários -->
      <div style="background:white;border:1px solid var(--border);border-radius:12px;padding:16px">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:var(--muted);margin-bottom:10px">Indicadores</div>
        ${[
          ['Parcela pós-contempl.', totNovaP > 0 ? fRf(totNovaP)+'/mês' : 'Quitado'],
          ['Aporte disponível', S.aporte ? fRf(S.aporte)+'/mês' : '—'],
          ['% parcela/aporte', S.aporte ? fP(totParc/S.aporte*100) : '—'],
          ['Duração', MESES + ' meses'],
          ['Grupos', SIM_GRUPOS[S.grupo].label],
        ].map(([k,v]) => `
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9">
            <span style="font-size:12px;color:var(--muted)">${k}</span>
            <span style="font-size:12px;font-weight:700;color:var(--primary)">${v}</span>
          </div>`).join('')}
      </div>
    </div>

    <!-- TIMELINE -->
    ${buildTimeline(grupos)}
  `;

  document.getElementById('resumoContent').innerHTML = html;
}

function buildTimeline(grupos) {
  let rows = '';
  Object.entries(grupos).forEach(([key, { qty, data: d }]) => {
    const total = MESES;
    const prePct  = (S.mesContempl / total * 100).toFixed(1);
    const lancePct = (1 / total * 100 * 3).toFixed(1); // visual width for lance
    const posPct  = ((MESES - S.mesContempl) / total * 100).toFixed(1);

    const parcelaLabel = fRf(d.parcela * qty) + '/mês';
    const lanceLabel   = fRf(d.lTotal * qty);
    const novaPLabel   = d.novaP > 0 ? fRf(d.novaP * qty) + '/mês' : 'Quitado';

    rows += `<div class="tl-row">
      <div class="tl-label">${fR(d.cred)}${qty>1?' ×'+qty:''}</div>
      <div class="tl-bar-track">
        <div class="tl-seg pre" style="left:0;width:${prePct}%" title="Pré-contemplação: ${parcelaLabel}">
          ${parseFloat(prePct)>8 ? parcelaLabel : ''}
        </div>
        <div class="tl-seg lance" style="left:${prePct}%;width:${lancePct}%" title="Lance: ${lanceLabel}"></div>
        <div class="tl-seg pos" style="left:${(parseFloat(prePct)+parseFloat(lancePct)).toFixed(1)}%;width:${posPct}%" title="Pós-contemplação: ${novaPLabel}">
          ${parseFloat(posPct)>8 ? novaPLabel : ''}
        </div>
      </div>
    </div>`;
  });

  return `<div class="timeline-wrap">
    <div class="tl-title">Linha do Tempo — ${MESES} meses (contemplação no mês ${S.mesContempl})</div>
    ${rows}
    <div class="tl-legend">
      <div class="tl-leg-item"><div class="tl-dot" style="background:#2563a8"></div>Parcelas pré-contemplação</div>
      <div class="tl-leg-item"><div class="tl-dot" style="background:#f59e0b"></div>Lance (embutido + próprio)</div>
      <div class="tl-leg-item"><div class="tl-dot" style="background:#16a34a"></div>Parcelas pós-contemplação</div>
    </div>
  </div>`;
}

/* ══════════════════ SALVAR DADOS PARA COMPARATIVO ══════════════════ */
function _simFmtCPF(v) {
  return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4');
}

function buildSimResult() {
  const items = Object.entries(S.cart);
  let totCred = 0, totParc = 0, totLance = 0;
  const cotas = [];
  items.forEach(([key, qty]) => {
    const c = parseInt(key);
    const parcQty = calcParcela(c) * qty;
    const lanceQty = c * (S.embPerc/100) * qty + c * (SIM_GRUPOS[S.grupo].lanceLivreMedio/100) * qty;
    totCred  += c * qty;
    totParc  += parcQty;
    totLance += lanceQty;
    cotas.push({ credito: c * qty, parcela: parcQty });
  });
  return {
    grupo: S.grupo, objetivo: S.objetivo,
    credito: totCred, aporte: S.aporte, lance: S.lance,
    perc: S.perc, mesContempl: S.mesContempl, embPerc: S.embPerc,
    lancePropPerc: SIM_GRUPOS[S.grupo].lanceLivreMedio,
    parcela: totParc, lanceTotal: totLance,
    cart: S.cart, cotas, ts: Date.now(),
    cliente: { ...S.cliente },
  };
}

function irComparativo() {
  localStorage.setItem('crm_sim_result', JSON.stringify(buildSimResult()));
  if (typeof navigate === 'function') {
    navigate('comparativo', document.querySelector('[data-page=comparativo]'));
  }
}

/* ══════════════════ VINCULAR A LEAD ══════════════════ */
function vincularLead() {
  if (!document.getElementById('cpfModal')) buildCPFModal();
  document.getElementById('cpfModal').style.display = 'flex';
  document.getElementById('cpfInput').value = '';
  document.getElementById('cpfResult').innerHTML = '';
  document.getElementById('cpfInput').focus();
}

function closeCPFModal() {
  document.getElementById('cpfModal').style.display = 'none';
}

function fmtCPF(v) {
  v = v.replace(/\D/g,'').slice(0,11);
  if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/,'$1.$2.$3-$4');
  else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{0,3})/,'$1.$2.$3');
  else if (v.length > 3) v = v.replace(/(\d{3})(\d{0,3})/,'$1.$2');
  return v;
}

function onCPFInput(el) {
  el.value = fmtCPF(el.value);
  const cpf = el.value.replace(/\D/g,'');
  if (cpf.length === 11) buscarLeadPorCPF(cpf);
  else document.getElementById('cpfResult').innerHTML = '';
}

function buscarLeadPorCPF(cpf) {
  const leads = JSON.parse(localStorage.getItem('crm_leads') || '[]');
  const found = leads.find(l => (l.cpf || '').replace(/\D/g,'') === cpf);
  const box = document.getElementById('cpfResult');
  if (found) {
    box.innerHTML = `<div class="cpf-found">
      <strong>✓ Lead encontrado:</strong> ${found.nome}
      <br><small style="color:#64748b">${found.email || ''} · Etapa: ${found.stage || '—'}</small>
      <div style="margin-top:12px;display:flex;gap:8px;">
        <button class="btn btn-primary" style="font-size:13px;padding:8px 16px" onclick="salvarSimulacaoNoLead('${found.id}')">Vincular Simulação</button>
      </div>
    </div>`;
  } else {
    box.innerHTML = `<div class="cpf-notfound">
      CPF não encontrado nos leads cadastrados.
      <div style="margin-top:12px;">
        <button class="btn btn-accent" style="font-size:13px;padding:8px 16px" onclick="criarLeadComSim('${cpf}')">+ Criar Lead com esta Simulação</button>
      </div>
    </div>`;
  }
}

function salvarSimulacaoNoLead(id) {
  const leads = JSON.parse(localStorage.getItem('crm_leads') || '[]');
  const idx = leads.findIndex(l => String(l.id) === String(id));
  if (idx < 0) return;
  if (!leads[idx].simulacoes) leads[idx].simulacoes = [];
  const sim = buildSimResult();
  sim.id = 'sim_' + Date.now();
  sim.status = 'pre-proposta';
  sim.criadoEm = new Date().toISOString();
  sim.codigo = typeof _genSimCodigo === 'function' ? _genSimCodigo() : undefined;
  leads[idx].simulacoes.push(sim);
  leads[idx].historico = leads[idx].historico || [];
  leads[idx].historico.unshift({ ts: Date.now(), data: new Date().toISOString(), texto: `Simulação vinculada como pré-proposta: ${fR(sim.credito)} · Grupo ${sim.grupo} · Mês contempl. ${sim.mesContempl}` });
  localStorage.setItem('crm_leads', JSON.stringify(leads));
  // Persiste no banco para aparecer no Funil
  if (typeof simApiCreate === 'function') {
    simApiCreate({
      titulo: leads[idx].nome + ' — ' + fR(sim.credito || 0),
      credito: sim.credito || 0,
      etapa_funil_id: 'sim',
      lead_nome_cache: leads[idx].nome,
    }).catch(e => console.warn('[sim→funil]', e.message));
  }
  closeCPFModal();
  showToast('Simulação salva como pré-proposta de ' + leads[idx].nome + ' ✓');
}

function _simAutoSalvar() {
  const sim = buildSimResult();
  sim.id = 'sim_' + Date.now();
  sim.status = 'pre-proposta';
  sim.criadoEm = new Date().toISOString();
  sim.codigo = typeof _genSimCodigo === 'function' ? _genSimCodigo() : undefined;
  const leads = JSON.parse(localStorage.getItem('crm_leads') || '[]');
  let lead = null;

  if (S.cliente._leadId) {
    const idx = leads.findIndex(l => String(l.id) === String(S.cliente._leadId));
    if (idx >= 0) {
      if (!leads[idx].simulacoes) leads[idx].simulacoes = [];
      leads[idx].simulacoes.push(sim);
      leads[idx].historico = leads[idx].historico || [];
      leads[idx].historico.unshift({ data: new Date().toISOString(), texto: `Pré-proposta criada: ${fR(sim.credito)} · Grupo ${sim.grupo}` });
      lead = leads[idx];
    }
  } else if (S.cliente.nome) {
    // Check for duplicate before creating new lead
    const dupExist = typeof leadDedup === 'function'
      ? leadDedup(S.cliente.nome, S.cliente.telefone, S.cliente.email, S.cliente.cpf)
      : null;

    if (dupExist) {
      if (typeof leadMerge === 'function') {
        leadMerge(dupExist.id, { simulacoes: [{ ...sim }] });
      }
      lead = (typeof storeGet === 'function' ? storeGet() : leads).find(l => String(l.id) === String(dupExist.id));
    } else {
      const novo = {
        id: 'lead_' + Date.now(),
        nome: S.cliente.nome,
        telefone: S.cliente.telefone,
        cpf: S.cliente.cpf ? _simFmtCPF(S.cliente.cpf) : '',
        email: S.cliente.email,
        codigo: typeof _genLeadCodigo === 'function' ? _genLeadCodigo() : undefined,
        funnel: 'simulador', stage: 'sim_novo', origem: 'Simulador',
        valorDesejado: sim.credito,
        objetivo: sim.objetivo,
        historico: [{ data: new Date().toISOString(), texto: 'Lead criado via Simulador' }],
        simulacoes: [sim],
        notas: [],
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };
      leads.push(novo);
      localStorage.setItem('crm_leads', JSON.stringify(leads));
      lead = novo;
    }
  }

  if (lead) {
    showToast(`Pré-proposta salva no perfil de ${lead.nome} ✓`);
    // Persiste no banco para aparecer no Funil
    if (typeof simApiCreate === 'function') {
      simApiCreate({
        titulo: lead.nome + ' — ' + fR(sim.credito || 0),
        credito: sim.credito || 0,
        etapa_funil_id: 'sim',
        lead_nome_cache: lead.nome,
      }).catch(e => console.warn('[sim→funil]', e.message));
    }
  }
}

function criarLeadComSim(cpf) {
  const sim = buildSimResult();
  const simObj = { ...sim, id: 'sim_' + Date.now(), codigo: typeof _genSimCodigo === 'function' ? _genSimCodigo() : undefined };
  const cpfFormatado = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4');

  // Check for duplicate by CPF
  const dupExist = typeof leadDedup === 'function'
    ? leadDedup(null, null, null, cpf)
    : null;

  if (dupExist) {
    if (typeof leadMerge === 'function') {
      leadMerge(dupExist.id, { cpf: cpfFormatado, simulacoes: [simObj] });
    }
    const nomeCliente = dupExist.nome;
    if (typeof simApiCreate === 'function') {
      simApiCreate({
        titulo: nomeCliente + ' — ' + fR(sim.credito || 0),
        credito: sim.credito || 0,
        etapa_funil_id: 'sim',
        lead_nome_cache: nomeCliente,
      }).catch(e => console.warn('[sim→funil]', e.message));
    }
    closeCPFModal();
    showToast(`Simulação vinculada ao perfil existente de ${nomeCliente} ✓`);
    return;
  }

  const leads = JSON.parse(localStorage.getItem('crm_leads') || '[]');
  const nomeCliente = S?.cliente?.nome || ('CPF ' + cpf);
  const novoLead = {
    id: 'lead_' + Date.now(),
    nome: nomeCliente,
    cpf: cpfFormatado,
    email: S?.cliente?.email || '', telefone: S?.cliente?.telefone || '',
    codigo: typeof _genLeadCodigo === 'function' ? _genLeadCodigo() : undefined,
    funnel: 'simulador', stage: 'sim_novo', origem: 'Simulador',
    valorDesejado: sim.credito,
    objetivo: sim.objetivo || 'consorcio',
    historico: [{ ts: Date.now(), data: new Date().toISOString(), texto: 'Lead criado via Simulador' }],
    simulacoes: [simObj],
    notas: [],
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };
  leads.push(novoLead);
  localStorage.setItem('crm_leads', JSON.stringify(leads));
  // Persiste no banco para aparecer no Funil
  if (typeof simApiCreate === 'function') {
    simApiCreate({
      titulo: nomeCliente + ' — ' + fR(sim.credito || 0),
      credito: sim.credito || 0,
      etapa_funil_id: 'sim',
      lead_nome_cache: nomeCliente,
    }).catch(e => console.warn('[sim→funil]', e.message));
  }
  closeCPFModal();
  showToast('Lead criado com simulação vinculada ✓');
}

function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1a3a5c;color:white;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2)';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function buildCPFModal() {
  const el = document.createElement('div');
  el.id = 'cpfModal';
  el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200;align-items:center;justify-content:center;';
  el.innerHTML = `
    <div style="background:white;border-radius:16px;padding:28px;width:90%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.2)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3 style="font-size:18px;font-weight:800;color:#1a3a5c">Vincular a um Lead</h3>
        <button onclick="closeCPFModal()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#64748b">&times;</button>
      </div>
      <label style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:8px">CPF do Cliente</label>
      <input id="cpfInput" type="text" placeholder="000.000.000-00" oninput="onCPFInput(this)"
        style="width:100%;padding:12px 14px;border:2px solid #e2e8f0;border-radius:8px;font-size:18px;font-weight:700;letter-spacing:1px;outline:none;font-family:inherit" />
      <div id="cpfResult" style="margin-top:16px"></div>
    </div>`;
  document.body.appendChild(el);
}

/* ══════════════════ BOTÕES NO STEP 6 ══════════════════ */
function renderBotoesStep6() {
  const el = document.querySelector('#step-6 .step-actions');
  if (!el) return;
  if (!document.getElementById('btnSalvarPreProp')) {
    const btn = document.createElement('button');
    btn.id = 'btnSalvarPreProp';
    btn.className = 'btn btn-primary';
    btn.innerHTML = '<i class="bi bi-bookmark-check-fill"></i> Salvar como Pré-Proposta';
    btn.onclick = () => {
      if (S.cliente.nome) { _simAutoSalvar(); }
      else { vincularLead(); }
    };
    el.insertBefore(btn, el.firstChild);
  }
}

/* ══════════════════ INIT / RESET ══════════════════ */
function initSimulador() {
  Object.assign(S, {
    step: 1, credito: 0, aporte: 0, lance: 0,
    objetivo: '', grupo: '4003', cart: {},
    perc: 0.7, mesContempl: 36, embPerc: 30,
    cliente: { nome:'', telefone:'', cpf:'', email:'', _leadId: null },
  });
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  const s1 = document.getElementById('step-1');
  if (s1) s1.classList.add('active');
  // clear cliente fields
  ['s0_nome','s0_telefone','s0_cpf','s0_email'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const s0res = document.getElementById('s0_result'); if (s0res) s0res.innerHTML = '';
  const btnS0 = document.getElementById('btn-s0'); if (btnS0) btnS0.disabled = true;
  // clear capacity fields
  ['s1_credito', 's1_aporte', 's1_lance'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const box = document.getElementById('s1_insight');
  if (box) box.innerHTML = '';
  const btnS3 = document.getElementById('btn-s3'); if (btnS3) btnS3.disabled = true;
  const btnS2 = document.getElementById('btn-s2'); if (btnS2) btnS2.disabled = true;
  const btnS4 = document.getElementById('btn-s4'); if (btnS4) btnS4.disabled = true;
  const btnSalvar = document.getElementById('btnSalvarPreProp'); if (btnSalvar) btnSalvar.remove();
  document.querySelectorAll('.obj-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.perc-btn').forEach(b => b.classList.remove('active'));
  const btn70 = document.querySelector('.perc-btn[onclick*="0.7"]');
  if (btn70) btn70.classList.add('active');
  const slMes = document.getElementById('sl_mes'); if (slMes) slMes.value = 36;
  const svMes = document.getElementById('sv_mes'); if (svMes) svMes.textContent = 'Mês 36';
  const slEmb = document.getElementById('sl_emb'); if (slEmb) slEmb.value = 30;
  const svEmb = document.getElementById('sv_emb'); if (svEmb) svEmb.textContent = '30%';
  const mesHint = document.getElementById('mes_hint'); if (mesHint) mesHint.textContent = '';
  const paramPrev = document.getElementById('param_preview'); if (paramPrev) paramPrev.innerHTML = '';
  renderProgress();
}

const _pbar = document.getElementById('progressBar');
if (_pbar) renderProgress();

/* CSS extra para modal CPF */
const _s = document.createElement('style');
_s.textContent = `
  .cpf-found { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px 16px; font-size:13px; color:#15803d; }
  .cpf-notfound { background:#fef3c7; border:1px solid #fde68a; border-radius:10px; padding:14px 16px; font-size:13px; color:#92400e; }
`;
document.head.appendChild(_s);
