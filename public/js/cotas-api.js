/* =====================================================================
   Cotas Disponíveis — Página com dados da API Administradora
   Depende de: api.js
   ===================================================================== */

/* ── ESTADO LOCAL DA PÁGINA ── */
const CA = {
  cotas: [],
  filtroCategoria: '',
  filtroDisponivel: true,
  busca: '',
  carregando: false,
  _mapa: {},  // cod → objeto cota (para acesso seguro nos onclick)
};

/* ── INIT ── */
async function initCotasApi() {
  const el = document.getElementById('page-cotas-api');
  if (!el) return;

  el.innerHTML = _cotasApiSkeleton();
  _bindCotasApiEvents();
  await _carregarCotas();
}

function _cotasApiSkeleton() {
  return `
    <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <div class="page-title">Cotas Disponíveis</div>
        <div class="page-subtitle">Transferências disponíveis — Administradora</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <span id="ca-badge-total" class="badge" style="font-size:12px;padding:5px 12px;background:var(--primary);color:white">Carregando…</span>
        <button class="btn btn-outline btn-sm" onclick="_carregarCotas(true)">
          <i class="bi bi-arrow-clockwise"></i> Atualizar
        </button>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px;padding:14px 18px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input class="form-input" id="ca-busca" placeholder="Buscar por código, crédito, grupo…"
          oninput="CA.busca=this.value;_renderCotasApi()" style="flex:1;min-width:200px;max-width:340px" />

        <select class="form-select" id="ca-cat" onchange="CA.filtroCategoria=this.value;_renderCotasApi()" style="width:150px">
          <option value="">Todas categorias</option>
          <option value="Imóvel">Imóvel</option>
          <option value="Veículo">Veículo</option>
        </select>

        <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap">
          <input type="checkbox" id="ca-disp" checked onchange="CA.filtroDisponivel=this.checked;_renderCotasApi()" />
          Apenas disponíveis
        </label>
      </div>
    </div>

    <div id="ca-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:18px"></div>
    <div id="ca-lista"></div>
  `;
}

function _bindCotasApiEvents() {}

async function _carregarCotas(forceRefresh = false) {
  CA.carregando = true;
  const lista = document.getElementById('ca-lista');
  if (lista) lista.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)"><i class="bi bi-arrow-repeat" style="font-size:24px;animation:spin 1s linear infinite"></i><div style="margin-top:8px;font-size:13px">Carregando cotas da API…</div></div>`;

  try {
    CA.cotas = await fetchCotas(forceRefresh);
    CA._mapa = {};
    CA.cotas.forEach(c => { CA._mapa[c.cod] = c; });
    _renderCotasApiStats();
    _renderCotasApi();
  } catch (err) {
    if (lista) lista.innerHTML = `<div class="card" style="text-align:center;padding:32px;color:var(--red)"><i class="bi bi-exclamation-triangle-fill" style="font-size:28px"></i><div style="margin-top:10px;font-weight:700">Erro ao carregar API</div><div style="font-size:12px;color:var(--muted);margin-top:4px">${_esc(err.message)}</div><button class="btn btn-outline btn-sm" style="margin-top:14px" onclick="_carregarCotas(true)">Tentar novamente</button></div>`;
  }
  CA.carregando = false;
}

function _cotasFiltradas() {
  return CA.cotas.filter(c => {
    if (CA.filtroDisponivel && c.reservado) return false;
    if (CA.filtroCategoria && c.categoria !== CA.filtroCategoria) return false;
    if (CA.busca) {
      const t = CA.busca.toLowerCase();
      if (!c.cod.toLowerCase().includes(t) && !c.credito.toLowerCase().includes(t) &&
          !String(c.grupo).includes(t) && !c.categoria.toLowerCase().includes(t)) return false;
    }
    return true;
  });
}

function _renderCotasApiStats() {
  const el = document.getElementById('ca-stats');
  if (!el) return;
  const total = CA.cotas.length;
  const disp  = CA.cotas.filter(c => !c.reservado).length;
  const res   = CA.cotas.filter(c => c.reservado).length;
  const imoveis = CA.cotas.filter(c => c.categoria === 'Imóvel').length;
  const veics   = CA.cotas.filter(c => c.categoria === 'Veículo').length;

  const badge = document.getElementById('ca-badge-total');
  if (badge) badge.textContent = `${total} cotas`;

  el.innerHTML = [
    { ico: 'bi-grid-3x3-gap', lbl: 'Total', val: total, cor: 'var(--primary)' },
    { ico: 'bi-check-circle-fill', lbl: 'Disponíveis', val: disp, cor: 'var(--green)' },
    { ico: 'bi-lock-fill', lbl: 'Reservadas', val: res, cor: 'var(--accent)' },
    { ico: 'bi-house-fill', lbl: 'Imóvel', val: imoveis, cor: '#6366f1' },
    { ico: 'bi-car-front-fill', lbl: 'Veículo', val: veics, cor: '#0ea5e9' },
  ].map(s => `
    <div class="card" style="padding:14px 16px;display:flex;align-items:center;gap:12px">
      <i class="bi ${s.ico}" style="font-size:22px;color:${s.cor}"></i>
      <div><div style="font-size:22px;font-weight:800;color:var(--text)">${s.val}</div>
           <div style="font-size:11px;color:var(--muted);font-weight:600">${s.lbl}</div></div>
    </div>`).join('');
}

function _renderCotasApi() {
  const el = document.getElementById('ca-lista');
  if (!el) return;
  const lista = _cotasFiltradas();

  if (!lista.length) {
    el.innerHTML = `<div class="card" style="text-align:center;padding:32px;color:var(--muted)"><i class="bi bi-inbox" style="font-size:28px"></i><div style="margin-top:8px;font-size:13px">Nenhuma cota encontrada com os filtros atuais.</div></div>`;
    return;
  }

  el.innerHTML = `
    <div style="font-size:11px;color:var(--muted);font-weight:600;margin-bottom:10px">${lista.length} cota(s) encontrada(s)</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
      ${lista.map(_cardCota).join('')}
    </div>`;
}

function _cardCota(c) {
  const isImovel = c.categoria === 'Imóvel';
  const cor = isImovel ? '#6366f1' : '#0ea5e9';
  const dispBadge = c.reservado
    ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:#fef3c7;color:#b45309">Reservada</span>`
    : `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:#dcfce7;color:#15803d">Disponível</span>`;

  const extras = (c.fundo && c.garantia) ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
      <div><div style="font-size:10px;color:var(--muted);font-weight:600">Fundo</div><div style="font-size:12px;font-weight:700">${_esc(c.fundo)}</div></div>
      <div><div style="font-size:10px;color:var(--muted);font-weight:600">Garantia</div><div style="font-size:12px;font-weight:700">${_esc(c.garantia)}</div></div>
    </div>` : '';

  return `
    <div class="card" style="padding:16px;border-left:4px solid ${cor};position:relative">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div>
          <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px">${_esc(c.cod)} · Grupo ${c.grupo}</div>
          <div style="font-size:15px;font-weight:800;color:var(--primary);margin-top:2px">${_esc(c.credito)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          ${dispBadge}
          <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${isImovel ? '#ede9fe' : '#e0f2fe'};color:${cor}">
            <i class="${_esc(c.categoria_ico)}"></i> ${_esc(c.categoria)}
          </span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div><div style="font-size:10px;color:var(--muted);font-weight:600">Parcela</div><div style="font-size:13px;font-weight:700">${_esc(c.parcela)}</div></div>
        <div><div style="font-size:10px;color:var(--muted);font-weight:600">Prazo</div><div style="font-size:13px;font-weight:700">${_esc(c.prazo)}x</div></div>
        <div><div style="font-size:10px;color:var(--muted);font-weight:600">Transfer.</div><div style="font-size:13px;font-weight:700">${_esc(c.transfer)}</div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        <div><div style="font-size:10px;color:var(--muted);font-weight:600">Entrada</div><div style="font-size:12px;font-weight:700">${_esc(c.entrada)}</div></div>
        <div><div style="font-size:10px;color:var(--muted);font-weight:600">Seguro/mês</div><div style="font-size:12px;font-weight:700">${_esc(c.seguro)}</div></div>
      </div>

      ${extras}

      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        ${!c.reservado ? `<button class="btn btn-outline btn-sm" onclick="abrirModalVincularCota('${_esc(c.cod)}')">
          <i class="bi bi-link-45deg"></i> Vincular a Lead
        </button>` : ''}
        <button class="btn btn-sm ${c.reservado ? 'btn-ghost' : 'btn-primary'}" onclick="abrirModalVenderCota('${_esc(c.cod)}')">
          <i class="bi bi-bag-check-fill"></i> ${c.reservado ? 'Ver detalhes' : 'Registrar Venda'}
        </button>
      </div>
    </div>`;
}

/* ── MODAL: VINCULAR COTA A LEAD ── */
let _cotaSelecionada = null;

function abrirModalVincularCota(cod) {
  const cota = CA._mapa[cod];
  if (!cota) return;
  _cotaSelecionada = cota;
  const leads = storeGet().filter(l => l.stage !== 'posvenda');
  const opcoesLeads = leads.length
    ? leads.map(l => `<option value="${l.id}">${_esc(l.nome)} — ${STAGES.find(s=>s.id===l.stage)?.label||l.stage}</option>`).join('')
    : '<option disabled>Nenhum lead ativo encontrado</option>';

  document.getElementById('modalCotaApi').innerHTML = `
    <div class="modal-header">
      <span class="modal-title">Vincular Cota ${_esc(cota.cod)}</span>
      <button class="modal-close" onclick="_fecharModalCotaApi()">✕</button>
    </div>
    <div style="padding:18px 20px">
      <div style="background:var(--bg);border-radius:10px;padding:12px 14px;margin-bottom:16px;border:1px solid var(--border)">
        <div style="font-size:13px;font-weight:800;color:var(--primary)">${_esc(cota.credito)} — ${_esc(cota.categoria)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:3px">Grupo ${cota.grupo} · ${_esc(cota.parcelas)} · Entrada ${_esc(cota.entrada)}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Selecione o Lead</label>
        <select class="form-select" id="ca-lead-sel">${opcoesLeads}</select>
      </div>
      <div class="form-actions" style="margin-top:20px">
        <button class="btn btn-ghost" onclick="_fecharModalCotaApi()">Cancelar</button>
        <button class="btn btn-primary" onclick="_confirmarVincularCota()">
          <i class="bi bi-link-45deg"></i> Vincular Cota
        </button>
      </div>
    </div>`;
  document.getElementById('overlayModalCotaApi').classList.add('open');
}

function _confirmarVincularCota() {
  const sel = document.getElementById('ca-lead-sel');
  if (!sel || !sel.value) return;
  const leadId = parseInt(sel.value, 10);
  leadUpdate(leadId, { cotaVinculada: _cotaSelecionada });
  leadAddHistorico(leadId, `Cota ${_cotaSelecionada.cod} (${_cotaSelecionada.credito}) vinculada ao lead`);
  _fecharModalCotaApi();
  _toast(`Cota ${_cotaSelecionada.cod} vinculada com sucesso!`, 'success');
  if (typeof renderFunilPage === 'function') renderFunilPage();
}

/* ── MODAL: REGISTRAR VENDA (API) ── */
function abrirModalVenderCota(cod) {
  const cota = CA._mapa[cod];
  if (!cota) return;
  _cotaSelecionada = cota;

  document.getElementById('modalCotaApi').innerHTML = `
    <div class="modal-header">
      <span class="modal-title">Registrar Venda — ${_esc(cota.cod)}</span>
      <button class="modal-close" onclick="_fecharModalCotaApi()">✕</button>
    </div>
    <div style="padding:18px 20px">
      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;margin-bottom:16px">
        <div style="font-size:13px;font-weight:800;color:#92400e">Confirmar marcação como VENDIDA</div>
        <div style="font-size:11px;color:#78350f;margin-top:4px">Esta ação irá registrar a cota como vendida na API da Administradora. Esta operação pode ser irreversível.</div>
      </div>

      <div style="background:var(--bg);border-radius:10px;padding:12px 14px;margin-bottom:16px;border:1px solid var(--border)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><div style="font-size:10px;color:var(--muted);font-weight:600">Código</div><div style="font-size:14px;font-weight:800">${_esc(cota.cod)}</div></div>
          <div><div style="font-size:10px;color:var(--muted);font-weight:600">Grupo</div><div style="font-size:14px;font-weight:800">${cota.grupo}</div></div>
          <div><div style="font-size:10px;color:var(--muted);font-weight:600">Crédito</div><div style="font-size:14px;font-weight:800;color:var(--primary)">${_esc(cota.credito)}</div></div>
          <div><div style="font-size:10px;color:var(--muted);font-weight:600">Categoria</div><div style="font-size:14px;font-weight:800">${_esc(cota.categoria)}</div></div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Vincular ao Lead (opcional)</label>
        <select class="form-select" id="ca-venda-lead">
          <option value="">— Sem vínculo —</option>
          ${storeGet().map(l => `<option value="${l.id}">${_esc(l.nome)} — ${STAGES.find(s=>s.id===l.stage)?.label||l.stage}</option>`).join('')}
        </select>
      </div>

      <div class="form-actions" style="margin-top:20px">
        <button class="btn btn-ghost" onclick="_fecharModalCotaApi()">Cancelar</button>
        <button class="btn btn-primary" id="btn-confirmar-venda" onclick="_confirmarVenderCota()">
          <i class="bi bi-bag-check-fill"></i> Confirmar Venda
        </button>
      </div>
    </div>`;
  document.getElementById('overlayModalCotaApi').classList.add('open');
}

async function _confirmarVenderCota() {
  const btn = document.getElementById('btn-confirmar-venda');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Registrando…'; }

  const resultado = await marcarCotaVendida(_cotaSelecionada.cod);

  const leadSel = document.getElementById('ca-venda-lead');
  if (leadSel && leadSel.value) {
    const leadId = parseInt(leadSel.value, 10);
    leadUpdate(leadId, { cotaVinculada: { ..._cotaSelecionada, reservado: true }, stage: 'contrato' });
    leadAddHistorico(leadId, `Venda registrada — Cota ${_cotaSelecionada.cod} (${_cotaSelecionada.credito}) marcada como vendida na API`);
    if (typeof renderFunilPage === 'function') renderFunilPage();
  }

  _fecharModalCotaApi();

  if (resultado.ok) {
    _toast(`Cota ${_cotaSelecionada.cod} registrada como vendida na API!`, 'success');
    await _carregarCotas(true);
  } else {
    _toast(`Cota registrada localmente. Verifique a configuração da API.`, 'warning');
    _renderCotasApi();
  }
}

function _fecharModalCotaApi() {
  document.getElementById('overlayModalCotaApi').classList.remove('open');
  _cotaSelecionada = null;
}

/* ── CHAMADA AUTOMÁTICA ao mover lead para "contrato" ── */
async function onLeadMoveToContrato(leadId) {
  const lead = storeGet().find(l => l.id === leadId);
  if (!lead || !lead.cotaVinculada || lead.cotaVinculada.reservado) return;

  const cota = lead.cotaVinculada;
  const confirmar = window.confirm(
    `Deseja registrar a cota ${cota.cod} (${cota.credito}) como VENDIDA na API da Administradora?`
  );
  if (!confirmar) return;

  _toast('Registrando venda na API…', 'info');
  const resultado = await marcarCotaVendida(cota.cod);
  leadUpdate(leadId, { cotaVinculada: { ...cota, reservado: true } });
  leadAddHistorico(leadId, `Venda confirmada — Cota ${cota.cod} registrada na API`);

  if (resultado.ok) {
    _toast(`Cota ${cota.cod} marcada como vendida na API!`, 'success');
  } else {
    _toast(`Venda registrada localmente. Confirme manualmente na plataforma HS.`, 'warning');
  }
}

/* ── TOAST ── */
function _toast(msg, tipo = 'success') {
  const cores = { success: '#16a34a', warning: '#b45309', error: '#dc2626', info: '#1d4ed8' };
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:24px;right:24px;background:${cores[tipo]||cores.success};color:white;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);max-width:320px;line-height:1.4`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

/* ── INJECT: overlay + modal no DOM ── */
document.addEventListener('DOMContentLoaded', () => {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="overlayModalCotaApi" onclick="if(event.target===this)_fecharModalCotaApi()">
      <div class="modal" id="modalCotaApi" style="max-width:520px"></div>
    </div>
  `);
});
