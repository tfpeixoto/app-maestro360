/* =====================================================================
   Contemplados — Cartas contempladas disponíveis para aquisição
   Depende de: api.js (fetchCotas, parseBRL, formatBRL)
   ===================================================================== */

/* ── ESTADO ── */
const CT = {
  cartas: [],
  filtroCategoria: '',
  filtroDisponivel: true,
  busca: '',
  _mapa: {},
};

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
async function initContemplados() {
  const el = document.getElementById('page-contemplados');
  if (!el) return;
  el.innerHTML = _ctSkeleton();
  document.getElementById('ct-busca').addEventListener('input', e => { CT.busca = e.target.value; _renderCartas(); });
  await _carregarCartas();
}

function _ctSkeleton() {
  return `
    <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:0">
      <div>
        <div class="page-title">Contemplados</div>
        <div class="page-subtitle">Cartas contempladas disponíveis para aquisição — Administradora</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-primary" onclick="abrirSimulador()">
          <i class="bi bi-calculator-fill"></i> Simular Aquisição
        </button>
        <button class="btn btn-outline btn-sm" onclick="_carregarCartas(true)">
          <i class="bi bi-arrow-clockwise"></i> Atualizar
        </button>
      </div>
    </div>

    <div id="ct-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin:18px 0"></div>

    <div class="card" style="margin-bottom:16px;padding:14px 18px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input class="form-input" id="ct-busca" placeholder="Buscar código, crédito, grupo…" style="flex:1;min-width:200px;max-width:340px" />
        <select class="form-select" id="ct-cat" onchange="CT.filtroCategoria=this.value;_renderCartas()" style="width:150px">
          <option value="">Todas categorias</option>
          <option value="Imóvel">Imóvel</option>
          <option value="Veículo">Veículo</option>
        </select>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap">
          <input type="checkbox" id="ct-disp" checked onchange="CT.filtroDisponivel=this.checked;_renderCartas()" />
          Apenas disponíveis
        </label>
      </div>
    </div>

    <div id="ct-lista"></div>

    <!-- MODAL SIMULADOR -->
    <div class="modal-overlay" id="ct-overlay-sim" onclick="if(event.target===this)_fecharSimulador()">
      <div class="modal" id="ct-modal-sim" style="max-width:700px;max-height:90vh;overflow-y:auto"></div>
    </div>

    <!-- MODAL VINCULAR -->
    <div class="modal-overlay" id="ct-overlay-vinc" onclick="if(event.target===this)_fecharVinc()">
      <div class="modal" id="ct-modal-vinc" style="max-width:480px"></div>
    </div>
  `;
}

/* ─────────────────────────────────────────
   CARREGAR E RENDERIZAR CARTAS
───────────────────────────────────────── */
async function _carregarCartas(forceRefresh = false) {
  const lista = document.getElementById('ct-lista');
  if (lista) lista.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)"><i class="bi bi-arrow-repeat" style="font-size:24px;animation:spin 1s linear infinite"></i><div style="margin-top:8px;font-size:13px">Carregando cartas contempladas…</div></div>`;
  try {
    CT.cartas = await fetchCotas(forceRefresh);
    CT._mapa = {};
    CT.cartas.forEach(c => { CT._mapa[c.cod] = _enriquecer(c); });
    CT.cartas = CT.cartas.map(c => CT._mapa[c.cod]);
    _renderStats();
    _renderCartas();
  } catch (err) {
    if (lista) lista.innerHTML = `<div class="card" style="text-align:center;padding:32px;color:var(--red)"><i class="bi bi-exclamation-triangle-fill" style="font-size:28px"></i><div style="margin-top:10px;font-weight:700">Erro ao carregar API</div><div style="font-size:12px;color:var(--muted);margin-top:4px">${_esc(err.message)}</div><button class="btn btn-outline btn-sm" style="margin-top:14px" onclick="_carregarCartas(true)">Tentar novamente</button></div>`;
  }
}

/* Enriquece cota com valores numéricos e métricas calculadas */
function _enriquecer(c) {
  const credito      = parseBRL(c.credito);
  const entrada      = parseBRL(c.entrada);
  const transfer     = parseBRL(c.transfer);
  const parcela      = parseBRL(c.parcela);
  const seguro       = parseBRL(c.seguro);
  const prazo        = parseInt(c.prazo) || 0;
  const custoImed    = entrada + transfer;
  const custoTotal   = custoImed + (parcela + seguro) * prazo;
  const roi          = custoImed > 0 ? (credito - custoImed) / custoImed * 100 : 0;
  const eficiencia   = custoImed > 0 ? credito / custoImed : 0;
  const eficTotal    = custoTotal > 0 ? credito / custoTotal : 0;
  return { ...c, _credito: credito, _entrada: entrada, _transfer: transfer, _parcela: parcela,
    _seguro: seguro, _prazo: prazo, _custoImed: custoImed, _custoTotal: custoTotal,
    _roi: roi, _eficiencia: eficiencia, _eficTotal: eficTotal };
}

function _cartasFiltradas() {
  return CT.cartas.filter(c => {
    if (CT.filtroDisponivel && c.reservado) return false;
    if (CT.filtroCategoria && c.categoria !== CT.filtroCategoria) return false;
    if (CT.busca) {
      const t = CT.busca.toLowerCase();
      if (!c.cod.toLowerCase().includes(t) && !c.credito.toLowerCase().includes(t) &&
          !String(c.grupo).includes(t) && !c.categoria.toLowerCase().includes(t)) return false;
    }
    return true;
  });
}

function _renderStats() {
  const el = document.getElementById('ct-stats');
  if (!el) return;
  const total  = CT.cartas.length;
  const disp   = CT.cartas.filter(c => !c.reservado).length;
  const imovel = CT.cartas.filter(c => c.categoria === 'Imóvel').length;
  const veic   = CT.cartas.filter(c => c.categoria === 'Veículo').length;
  const roiMed = CT.cartas.filter(c => !c.reservado && c._roi).reduce((s,c,_,a) => s + c._roi/a.length, 0);
  el.innerHTML = [
    { ico:'bi-card-list',         lbl:'Total cartas',    val: total,             cor:'var(--primary)' },
    { ico:'bi-check-circle-fill', lbl:'Disponíveis',     val: disp,              cor:'var(--green)' },
    { ico:'bi-house-fill',        lbl:'Imóvel',          val: imovel,            cor:'#6366f1' },
    { ico:'bi-car-front-fill',    lbl:'Veículo',         val: veic,              cor:'#0ea5e9' },
    { ico:'bi-graph-up-arrow',    lbl:'ROI médio',       val: roiMed.toFixed(1)+'%', cor:'var(--accent)' },
  ].map(s => `
    <div class="card" style="padding:14px 16px;display:flex;align-items:center;gap:12px">
      <i class="bi ${s.ico}" style="font-size:22px;color:${s.cor}"></i>
      <div><div style="font-size:20px;font-weight:800;color:var(--text)">${s.val}</div>
           <div style="font-size:11px;color:var(--muted);font-weight:600">${s.lbl}</div></div>
    </div>`).join('');
}

function _renderCartas() {
  const el = document.getElementById('ct-lista');
  if (!el) return;
  const lista = _cartasFiltradas();
  if (!lista.length) {
    el.innerHTML = `<div class="card" style="text-align:center;padding:32px;color:var(--muted)"><i class="bi bi-inbox" style="font-size:28px"></i><div style="margin-top:8px;font-size:13px">Nenhuma carta encontrada com os filtros atuais.</div></div>`;
    return;
  }
  el.innerHTML = `
    <div style="font-size:11px;color:var(--muted);font-weight:600;margin-bottom:10px">${lista.length} carta(s) encontrada(s)</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px">
      ${lista.map(_cardCarta).join('')}
    </div>`;
}

function _cardCarta(c) {
  const cor     = c.categoria === 'Imóvel' ? '#6366f1' : '#0ea5e9';
  const roiCor  = c._roi >= 80 ? '#15803d' : c._roi >= 40 ? '#b45309' : '#dc2626';
  const dispTag = c.reservado
    ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:#fef3c7;color:#b45309">Reservada</span>`
    : `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:#dcfce7;color:#15803d">Disponível</span>`;

  const extras = (c.fundo && c.garantia) ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
      <div><div style="font-size:9px;color:var(--muted);font-weight:600;text-transform:uppercase">Fundo</div><div style="font-size:11px;font-weight:700">${_esc(c.fundo)}</div></div>
      <div><div style="font-size:9px;color:var(--muted);font-weight:600;text-transform:uppercase">Garantia</div><div style="font-size:11px;font-weight:700">${_esc(c.garantia)}</div></div>
    </div>` : '';

  return `
    <div class="card" style="padding:16px;border-left:4px solid ${cor}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div>
          <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px">${_esc(c.cod)} · Grupo ${c.grupo}</div>
          <div style="font-size:17px;font-weight:800;color:var(--primary);margin-top:2px">${_esc(c.credito)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          ${dispTag}
          <span style="font-size:11px;font-weight:800;padding:3px 9px;border-radius:7px;background:${roiCor}22;color:${roiCor}">ROI ${c._roi.toFixed(1)}%</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
        <div><div style="font-size:9px;color:var(--muted);font-weight:600;text-transform:uppercase">Entrada</div><div style="font-size:12px;font-weight:700;color:var(--red)">${_esc(c.entrada)}</div></div>
        <div><div style="font-size:9px;color:var(--muted);font-weight:600;text-transform:uppercase">Transfer.</div><div style="font-size:12px;font-weight:700">${_esc(c.transfer)}</div></div>
        <div><div style="font-size:9px;color:var(--muted);font-weight:600;text-transform:uppercase">Custo imed.</div><div style="font-size:12px;font-weight:700;color:var(--accent)">${formatBRL(c._custoImed)}</div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div><div style="font-size:9px;color:var(--muted);font-weight:600;text-transform:uppercase">Parcela</div><div style="font-size:12px;font-weight:700">${_esc(c.parcela)}</div></div>
        <div><div style="font-size:9px;color:var(--muted);font-weight:600;text-transform:uppercase">Prazo</div><div style="font-size:12px;font-weight:700">${c.prazo}x</div></div>
        <div><div style="font-size:9px;color:var(--muted);font-weight:600;text-transform:uppercase">Seguro/mês</div><div style="font-size:12px;font-weight:700">${_esc(c.seguro)}</div></div>
      </div>

      ${extras}

      <div style="display:flex;gap:8px;margin-top:14px">
        ${!c.reservado ? `
        <button class="btn btn-primary btn-sm" style="flex:1" onclick="simularCarta('${_esc(c.cod)}')">
          <i class="bi bi-calculator-fill"></i> Simular esta
        </button>
        <button class="btn btn-outline btn-sm" onclick="vincularCarta('${_esc(c.cod)}')">
          <i class="bi bi-link-45deg"></i> Vincular
        </button>` : `<span style="font-size:11px;color:var(--muted);font-style:italic">Carta reservada</span>`}
      </div>
    </div>`;
}

/* ─────────────────────────────────────────
   ALGORITMO DE OTIMIZAÇÃO
───────────────────────────────────────── */

/*
  Modos:
  'imediato' → minimiza entrada + transfer
  'total'    → minimiza custo completo (entrada + transfer + parcelas×prazo + seguro×prazo)
  'roi'      → maximiza (credito - custoImediato) / custoImediato
*/
function _otimizar(alvo, modo, disponíveis) {
  const pool = disponíveis
    .filter(c => !c.reservado && c._custoImed > 0 && c._credito > 0)
    .map(c => ({ ...c }));

  const chaveEfic = modo === 'total' ? '_eficTotal' : '_eficiencia';

  // Ordena pela eficiência do modo escolhido
  const ordenado = [...pool].sort((a, b) => b[chaveEfic] - a[chaveEfic]);

  function greedy(excluir = []) {
    const excSet = new Set(excluir.map(c => c.cod));
    const candidatos = ordenado.filter(c => !excSet.has(c.cod));
    const sel = [];
    let totalCredito = 0;
    for (const c of candidatos) {
      if (totalCredito >= alvo) break;
      sel.push(c);
      totalCredito += c._credito;
    }
    return sel;
  }

  // Refinamento: troca a última cota pela menor que ainda cobre o restante
  function refinar(sel) {
    if (sel.length <= 1) return sel;
    const ultima = sel[sel.length - 1];
    const semUltima = sel.slice(0, -1);
    const creditoSemUltima = semUltima.reduce((s, c) => s + c._credito, 0);
    const falta = alvo - creditoSemUltima;
    const selSet = new Set(semUltima.map(c => c.cod));
    const alt = ordenado
      .filter(c => !selSet.has(c.cod) && c.cod !== ultima.cod && c._credito >= falta)
      .sort((a, b) => a[modo === 'total' ? '_custoTotal' : '_custoImed'] - b[modo === 'total' ? '_custoTotal' : '_custoImed'])[0];
    if (alt) {
      const custoAlt = alt[modo === 'total' ? '_custoTotal' : '_custoImed'];
      const custoAtual = ultima[modo === 'total' ? '_custoTotal' : '_custoImed'];
      if (custoAlt < custoAtual) return [...semUltima, alt];
    }
    return sel;
  }

  function metricas(sel) {
    const totalCredito  = sel.reduce((s, c) => s + c._credito, 0);
    const totalCustoImed = sel.reduce((s, c) => s + c._custoImed, 0);
    const totalCustoFull = sel.reduce((s, c) => s + c._custoTotal, 0);
    const totalMensal    = sel.reduce((s, c) => s + c._parcela + c._seguro, 0);
    const roiImed        = totalCustoImed > 0 ? (totalCredito - totalCustoImed) / totalCustoImed * 100 : 0;
    const excedente      = totalCredito - alvo;
    return { cotas: sel, totalCredito, totalCustoImed, totalCustoFull, totalMensal, roiImed, excedente };
  }

  const g1 = refinar(greedy([]));
  const g2 = refinar(greedy([g1[0]].filter(Boolean)));
  const g3 = refinar(greedy([g1[0], g1[1]].filter(Boolean)));

  // Remove duplicatas de combinações (mesmo conjunto de cods)
  const unicas = [g1, g2, g3].filter((sel, i, arr) => {
    const key = [...sel].map(c => c.cod).sort().join(',');
    return arr.findIndex(s => [...s].map(c => c.cod).sort().join(',') === key) === i;
  });

  return unicas.map(sel => metricas(sel));
}

/* ─────────────────────────────────────────
   SIMULADOR MODAL
───────────────────────────────────────── */
let _simPreSel = null; // cota pré-selecionada ao clicar "Simular esta"

function abrirSimulador() {
  _simPreSel = null;
  _renderSimuladorModal();
  document.getElementById('ct-overlay-sim').classList.add('open');
}

function simularCarta(cod) {
  _simPreSel = CT._mapa[cod] || null;
  _renderSimuladorModal();
  document.getElementById('ct-overlay-sim').classList.add('open');
}

function _renderSimuladorModal(resultados = null) {
  const preInfo = _simPreSel
    ? `<div style="background:var(--primary-pale);border:1px solid var(--primary);border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:12px"><b>Carta pré-selecionada:</b> ${_esc(_simPreSel.cod)} — ${_esc(_simPreSel.credito)} · Grupo ${_simPreSel.grupo}</div>`
    : '';

  document.getElementById('ct-modal-sim').innerHTML = `
    <div class="modal-header">
      <span class="modal-title"><i class="bi bi-calculator-fill"></i> Simulador de Aquisição</span>
      <button class="modal-close" onclick="_fecharSimulador()">✕</button>
    </div>
    <div style="padding:20px">
      ${preInfo}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
        <div class="form-group">
          <label class="form-label">Crédito desejado (R$) *</label>
          <input class="form-input" id="sim-alvo" type="text" placeholder="ex: 500.000"
            oninput="this.value=this.value.replace(/\D/g,'').replace(/\B(?=(\d{3})+(?!\d))/g,'.')"
            value="${_simPreSel ? Math.round(_simPreSel._credito).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.') : ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Categoria</label>
          <select class="form-select" id="sim-cat">
            <option value="">Imóvel + Veículo</option>
            <option value="Imóvel">Apenas Imóvel</option>
            <option value="Veículo">Apenas Veículo</option>
          </select>
        </div>
      </div>

      <div class="form-group" style="margin-bottom:20px">
        <label class="form-label">Critério de otimização</label>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          ${[
            { v:'imediato', ico:'bi-lightning-charge-fill', lbl:'Menor custo imediato', desc:'Mínimo em entrada + transferência' },
            { v:'total',    ico:'bi-calendar-range-fill',   lbl:'Menor custo total',    desc:'Inclui parcelas e seguros no prazo' },
            { v:'roi',      ico:'bi-graph-up-arrow',        lbl:'Maior ROI',            desc:'Máximo retorno sobre investimento' },
          ].map(o => `
            <label style="display:flex;flex-direction:column;gap:5px;border:2px solid var(--border);border-radius:10px;padding:12px;cursor:pointer;transition:all .15s"
              onclick="document.querySelectorAll('.sim-opt').forEach(x=>x.style.borderColor='var(--border)');this.style.borderColor='var(--primary)'">
              <input type="radio" name="sim-modo" value="${o.v}" class="sim-opt" style="display:none" ${o.v==='imediato'?'checked':''} />
              <div style="display:flex;align-items:center;gap:6px">
                <i class="bi ${o.ico}" style="color:var(--primary)"></i>
                <span style="font-size:12px;font-weight:700">${o.lbl}</span>
              </div>
              <span style="font-size:10px;color:var(--muted)">${o.desc}</span>
            </label>`).join('')}
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:20px">
        <button class="btn btn-ghost" onclick="_fecharSimulador()">Cancelar</button>
        <button class="btn btn-primary" onclick="_executarSimulacao()">
          <i class="bi bi-calculator-fill"></i> Calcular Top 3 Combinações
        </button>
      </div>

      <div id="sim-resultados"></div>
    </div>`;

  // Borda inicial do modo selecionado
  setTimeout(() => {
    const first = document.querySelector('.sim-opt[value="imediato"]');
    if (first) first.closest('label').style.borderColor = 'var(--primary)';
  }, 10);
}

function _fecharSimulador() {
  document.getElementById('ct-overlay-sim').classList.remove('open');
  _simPreSel = null;
}

function _executarSimulacao() {
  const alvoRaw = (document.getElementById('sim-alvo').value || '').replace(/\./g,'');
  const alvo = parseFloat(alvoRaw) || 0;
  if (!alvo || alvo < 1000) { _ctToast('Informe um crédito desejado válido.', 'warning'); return; }

  const modo     = document.querySelector('input[name="sim-modo"]:checked')?.value || 'imediato';
  const catFiltro = document.getElementById('sim-cat').value;
  let pool = CT.cartas.filter(c => !c.reservado);
  if (catFiltro) pool = pool.filter(c => c.categoria === catFiltro);

  if (_simPreSel) {
    const codPre = _simPreSel.cod;
    pool = pool.filter(c => c.cod !== codPre);
    pool.unshift(_simPreSel);
  }

  const resultados = _otimizar(alvo, modo, pool);
  if (!resultados.length || !resultados[0].cotas.length) {
    document.getElementById('sim-resultados').innerHTML = `<div class="card" style="text-align:center;padding:24px;color:var(--muted)">Não foi possível montar uma combinação com as cartas disponíveis para este valor.</div>`;
    return;
  }

  _renderResultados(resultados, alvo, modo);
}

function _renderResultados(resultados, alvo, modo) {
  const modoLabel = { imediato:'Menor custo imediato', total:'Menor custo total', roi:'Maior ROI' }[modo];
  const tabs = resultados.map((r, i) => `
    <button class="sim-tab ${i===0?'active':''}" onclick="_activateTab(${i})" id="sim-tab-${i}"
      style="flex:1;padding:10px;border:none;background:${i===0?'var(--primary)':'var(--bg)'};color:${i===0?'white':'var(--muted)'};border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s">
      Opção ${i+1}<br><span style="font-size:10px;font-weight:500">${r.cotas.length} carta${r.cotas.length>1?'s':''} · ROI ${r.roiImed.toFixed(1)}%</span>
    </button>`).join('');

  const paineis = resultados.map((r, i) => `
    <div class="sim-painel" id="sim-painel-${i}" style="display:${i===0?'block':'none'}">
      ${_renderPainel(r, alvo, i)}
    </div>`).join('');

  document.getElementById('sim-resultados').innerHTML = `
    <div style="border-top:2px solid var(--border);padding-top:20px">
      <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px">
        Resultado — ${modoLabel} · Alvo: ${formatBRL(alvo)}
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px">${tabs}</div>
      ${paineis}
    </div>`;
}

function _activateTab(idx) {
  document.querySelectorAll('.sim-tab').forEach((t, i) => {
    t.style.background = i === idx ? 'var(--primary)' : 'var(--bg)';
    t.style.color      = i === idx ? 'white' : 'var(--muted)';
  });
  document.querySelectorAll('.sim-painel').forEach((p, i) => {
    p.style.display = i === idx ? 'block' : 'none';
  });
}

function _renderPainel(r, alvo, idx) {
  const corRoi = r.roiImed >= 80 ? '#15803d' : r.roiImed >= 40 ? '#b45309' : '#dc2626';

  const linhas = r.cotas.map(c => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px 10px;font-size:12px;font-weight:700">${_esc(c.cod)}</td>
      <td style="padding:8px 10px;font-size:11px">${_esc(c.categoria)}</td>
      <td style="padding:8px 10px;font-size:12px;font-weight:700;color:var(--primary)">${_esc(c.credito)}</td>
      <td style="padding:8px 10px;font-size:11px;color:var(--red)">${formatBRL(c._custoImed)}</td>
      <td style="padding:8px 10px;font-size:11px">${formatBRL(c._parcela + c._seguro)}/mês</td>
      <td style="padding:8px 10px;font-size:11px;color:var(--muted)">${c.prazo}x</td>
    </tr>`).join('');

  return `
    <div style="overflow-x:auto;margin-bottom:16px">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:var(--bg);border-bottom:2px solid var(--border)">
            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted)">Código</th>
            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted)">Categ.</th>
            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted)">Crédito</th>
            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted)">Custo imed.</th>
            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted)">Mensal</th>
            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted)">Prazo</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px">
      ${[
        { lbl:'Crédito total',    val: formatBRL(r.totalCredito),   cor:'var(--primary)',ico:'bi-award-fill' },
        { lbl:'Custo imediato',   val: formatBRL(r.totalCustoImed), cor:'var(--red)',    ico:'bi-cash-stack' },
        { lbl:'Custo total',      val: formatBRL(r.totalCustoFull), cor:'#b45309',      ico:'bi-calculator' },
        { lbl:'Parcela mensal',   val: formatBRL(r.totalMensal),    cor:'var(--muted)', ico:'bi-calendar-month' },
        { lbl:'ROI imediato',     val: r.roiImed.toFixed(1)+'%',   cor: corRoi,         ico:'bi-graph-up-arrow' },
        { lbl:'Excedente',        val: formatBRL(r.excedente),      cor:'var(--green)', ico:'bi-plus-circle-fill' },
      ].map(m => `
        <div style="background:var(--bg);border-radius:10px;padding:12px 14px;border:1px solid var(--border)">
          <div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">
            <i class="bi ${m.ico}"></i> ${m.lbl}
          </div>
          <div style="font-size:15px;font-weight:800;color:${m.cor}">${m.val}</div>
        </div>`).join('')}
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" onclick="_vincularSimulacao(${idx})">
        <i class="bi bi-link-45deg"></i> Vincular ao Lead
      </button>
      <button class="btn btn-outline btn-sm" onclick="_exportarSimulacao(${idx})">
        <i class="bi bi-copy"></i> Copiar resumo
      </button>
    </div>`;
}

/* Último resultado para ações pós-simulação */
let _ultimosResultados = [];
function _renderResultadosGuardar(r, alvo, modo) {
  _ultimosResultados = r;
  _renderResultados(r, alvo, modo);
}

// Sobrescreve para guardar referência
const _renderResultadosOrig = _renderResultados;

/* ─────────────────────────────────────────
   VINCULAR AO LEAD
───────────────────────────────────────── */
let _vincIdx = null;

function _vincularSimulacao(idx) {
  const resultados = [];
  document.querySelectorAll('.sim-painel').forEach((_, i) => {
    // reconstrói do DOM via referência — guardamos no estado
  });
  vincularCarta(null, idx);
}

function vincularCarta(cod, simIdx = null) {
  const leads = storeGet().filter(l => l.stage !== 'posvenda');
  _vincIdx = simIdx;
  const codInfo = cod ? CT._mapa[cod] : null;
  const infoHtml = codInfo
    ? `<div style="background:var(--bg);border-radius:10px;padding:10px 14px;margin-bottom:14px;border:1px solid var(--border)"><div style="font-size:13px;font-weight:800;color:var(--primary)">${_esc(codInfo.cod)} — ${_esc(codInfo.credito)}</div><div style="font-size:11px;color:var(--muted)">Grupo ${codInfo.grupo} · ${_esc(codInfo.categoria)} · Entrada ${_esc(codInfo.entrada)}</div></div>`
    : `<div style="background:var(--bg);border-radius:10px;padding:10px 14px;margin-bottom:14px;border:1px solid var(--border);font-size:12px;color:var(--muted)">Vinculando resultado da simulação (Opção ${(simIdx||0)+1})</div>`;

  document.getElementById('ct-modal-vinc').innerHTML = `
    <div class="modal-header">
      <span class="modal-title">Vincular ao Lead</span>
      <button class="modal-close" onclick="_fecharVinc()">✕</button>
    </div>
    <div style="padding:18px 20px">
      ${infoHtml}
      <div class="form-group">
        <label class="form-label">Selecione o Lead</label>
        <select class="form-select" id="vinc-lead-sel">
          ${leads.length
            ? leads.map(l => `<option value="${l.id}">${_esc(l.nome)} — ${STAGES.find(s=>s.id===l.stage)?.label||l.stage}</option>`).join('')
            : '<option disabled>Nenhum lead ativo</option>'}
        </select>
      </div>
      <div class="form-actions" style="margin-top:16px">
        <button class="btn btn-ghost" onclick="_fecharVinc()">Cancelar</button>
        <button class="btn btn-primary" onclick="_confirmarVinc('${cod||''}')">
          <i class="bi bi-link-45deg"></i> Vincular
        </button>
      </div>
    </div>`;
  document.getElementById('ct-overlay-vinc').classList.add('open');
}

function _confirmarVinc(cod) {
  const sel = document.getElementById('vinc-lead-sel');
  if (!sel || !sel.value) return;
  const leadId = parseInt(sel.value, 10);
  const cota = cod ? CT._mapa[cod] : null;
  if (cota) {
    leadUpdate(leadId, { cotaVinculada: cota });
    leadAddHistorico(leadId, `Carta contemplada ${cota.cod} (${cota.credito}) vinculada ao lead`);
  }
  _fecharVinc();
  _ctToast('Carta vinculada ao lead com sucesso!', 'success');
  if (typeof renderFunilPage === 'function') renderFunilPage();
}

function _fecharVinc() {
  document.getElementById('ct-overlay-vinc').classList.remove('open');
}

/* ─────────────────────────────────────────
   EXPORTAR RESUMO
───────────────────────────────────────── */
function _exportarSimulacao(idx) {
  const painel = document.getElementById(`sim-painel-${idx}`);
  if (!painel) return;
  const texto = painel.innerText.replace(/\n{3,}/g, '\n\n');
  navigator.clipboard.writeText(texto).then(() => _ctToast('Resumo copiado!', 'success')).catch(() => _ctToast('Não foi possível copiar.', 'warning'));
}

/* ─────────────────────────────────────────
   TOAST
───────────────────────────────────────── */
function _ctToast(msg, tipo = 'success') {
  const cores = { success:'#16a34a', warning:'#b45309', error:'#dc2626', info:'#1d4ed8' };
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:24px;right:24px;background:${cores[tipo]||cores.success};color:white;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);max-width:320px;line-height:1.4`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}
