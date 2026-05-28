/* ── QUADRO DE COTAS ── */

/*
 * TODO — INTEGRAÇÃO API CONSÓRCIO (PENDENTE)
 *
 * GRUPOS é um placeholder com dados fictícios.
 * Em produção, os grupos e suas cotas devem vir da API de gestão do consórcio.
 *
 * O que a API precisa fornecer:
 *   - Lista de grupos (id, nome, total de cotas)
 *   - Status de cada cota por grupo (disponível, reservada, vendida, contemplada)
 *   - Endpoint para registrar venda/reserva de uma cota
 *
 * Quando integrado:
 *   - Substituir `GRUPOS` por chamada à API (ex: fetchGrupos())
 *   - Substituir `cotasLoad()` / `cotasSave()` por leitura/escrita via API
 *   - O campo `total` de cada grupo deve vir dinamicamente da API
 */
const GRUPOS = {
  '4003': { label: 'Grupo 4003', total: 180 },  // ← placeholder: substituir pela API
  '4004': { label: 'Grupo 4004', total: 180 }   // ← placeholder: substituir pela API
};

const STATUS_LIST = [
  { key: 'disponivel', label: 'Disponível', cls: 'cota-disponivel', dot: '#16a34a' },
  { key: 'reservada',  label: 'Reservada',  cls: 'cota-reservada',  dot: '#d97706' },
  { key: 'vendida',    label: 'Vendida',    cls: 'cota-vendida',    dot: '#1d4ed8' },
  { key: 'contemplada',label: 'Contemplada',cls: 'cota-contemplada',dot: '#b45309' }
];

function cotasLoad() {
  return JSON.parse(localStorage.getItem('crm_cotas') || '{}');
}
function cotasSave(data) {
  localStorage.setItem('crm_cotas', JSON.stringify(data));
}
function cotaKey(grupo, num) { return grupo + '_' + num; }
function cotaGet(data, grupo, num) {
  return data[cotaKey(grupo, num)] || { status: 'disponivel', cliente: '', obs: '' };
}

let _cotaGrupo = '4003';
let _cotaFiltro = 'todos';

function initCotas() {
  const el = document.getElementById('page-cotas');
  if (!el) return;
  el.innerHTML = buildCotasPage();
  bindCotasEvents();
  renderCotasGrid();
}

function buildCotasPage() {
  return `
    <div class="page-header">
      <div>
        <div class="page-title">Quadro de Cotas</div>
        <div class="page-subtitle">Situação das cotas por grupo de consórcio</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="_cotasAbrirDisponiveisApi()" style="font-size:12px">
        <i class="bi bi-shop"></i> Disponíveis HS
      </button>
    </div>

    <div class="cotas-toolbar">
      <div style="display:flex;gap:8px;">
        ${Object.entries(GRUPOS).map(([k, g]) =>
          `<button class="btn btn-outline cota-grupo-btn" data-grupo="${k}" onclick="switchGrupo('${k}')">${g.label}</button>`
        ).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-left:auto;flex-wrap:wrap;">
        <button class="btn btn-outline cota-filtro-btn active" data-filtro="todos" onclick="filtrarCotas('todos')">Todas</button>
        ${STATUS_LIST.map(s =>
          `<button class="btn btn-outline cota-filtro-btn" data-filtro="${s.key}" onclick="filtrarCotas('${s.key}')">${s.label}</button>`
        ).join('')}
      </div>
    </div>

    <div class="cotas-stats" id="cotasStats"></div>

    <div class="cotas-legend">
      ${STATUS_LIST.map(s =>
        `<div class="legend-item"><div class="legend-dot" style="background:${s.dot}"></div>${s.label}</div>`
      ).join('')}
    </div>

    <div class="card" style="padding:16px;">
      <div class="cotas-grid" id="cotasGrid"></div>
    </div>

    <!-- MODAL COTA -->
    <div id="cotaModalOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:200;align-items:center;justify-content:center;">
      <div style="background:white;border-radius:16px;padding:28px;min-width:340px;max-width:440px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="font-size:18px;font-weight:800;color:var(--primary);" id="cotaModalTitle">Cota 001</h3>
          <button onclick="closeCotaModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#64748b;">&times;</button>
        </div>
        <div class="cota-info-grid">
          <div class="cota-info-item">
            <div class="ci-label">Grupo</div>
            <div class="ci-value" id="cotaModalGrupo">—</div>
          </div>
          <div class="cota-info-item">
            <div class="ci-label">Número</div>
            <div class="ci-value" id="cotaModalNum">—</div>
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:6px;">Status</label>
          <div class="status-btns" id="cotaStatusBtns">
            ${STATUS_LIST.map(s =>
              `<button class="status-btn" data-status="${s.key}" onclick="setCotaStatus('${s.key}')">${s.label}</button>`
            ).join('')}
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:6px;">Cliente</label>
          <input id="cotaClienteInput" type="text" placeholder="Nome do cliente..." style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:6px;">Vendedor</label>
          <input id="cotaVendedorInput" type="text" placeholder="Nome do vendedor responsável..." style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;" />
        </div>
        <div style="margin-bottom:20px;">
          <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:6px;">Observação</label>
          <textarea id="cotaObsInput" rows="2" placeholder="Observações sobre esta cota..." style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;resize:vertical;"></textarea>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button onclick="closeCotaModal()" class="btn btn-outline">Cancelar</button>
          <button onclick="salvarCota()" class="btn btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  `;
}

function bindCotasEvents() {
  switchGrupo(_cotaGrupo);
  filtrarCotas(_cotaFiltro);
}

function switchGrupo(grupo) {
  _cotaGrupo = grupo;
  document.querySelectorAll('.cota-grupo-btn').forEach(b => {
    b.classList.toggle('btn-primary', b.dataset.grupo === grupo);
    b.classList.toggle('btn-outline', b.dataset.grupo !== grupo);
  });
  renderCotasGrid();
}

function filtrarCotas(filtro) {
  _cotaFiltro = filtro;
  document.querySelectorAll('.cota-filtro-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filtro === filtro);
    b.classList.toggle('btn-primary', b.dataset.filtro === filtro);
    b.classList.toggle('btn-outline', b.dataset.filtro !== filtro);
  });
  renderCotasGrid();
}

function renderCotasGrid() {
  const data = cotasLoad();
  const total = GRUPOS[_cotaGrupo].total;
  const stats = { disponivel: 0, reservada: 0, vendida: 0, contemplada: 0 };

  for (let i = 1; i <= total; i++) {
    const c = cotaGet(data, _cotaGrupo, i);
    stats[c.status]++;
  }

  const statsEl = document.getElementById('cotasStats');
  if (statsEl) {
    statsEl.innerHTML = STATUS_LIST.map(s => `
      <div class="cota-stat-card">
        <div class="csc-num" style="color:${s.dot}">${stats[s.key]}</div>
        <div class="csc-label">${s.label}</div>
      </div>
    `).join('');
  }

  const grid = document.getElementById('cotasGrid');
  if (!grid) return;

  let html = '';
  for (let i = 1; i <= total; i++) {
    const c = cotaGet(data, _cotaGrupo, i);
    if (_cotaFiltro !== 'todos' && c.status !== _cotaFiltro) continue;
    const num = String(i).padStart(3, '0');
    const title = c.cliente ? `${num} — ${c.cliente}` : `Cota ${num}`;
    html += `
      <div class="cota-num ${STATUS_LIST.find(s=>s.key===c.status).cls}"
           title="${title}"
           onclick="openCotaModal('${_cotaGrupo}', ${i})">
        ${num}
        ${c.cliente ? `<small>${c.cliente.split(' ')[0]}</small>` : ''}
      </div>`;
  }
  grid.innerHTML = html || '<p style="color:var(--muted);padding:20px;">Nenhuma cota neste filtro.</p>';
}

let _cotaModalGrupo = '';
let _cotaModalNum = 0;

function openCotaModal(grupo, num) {
  _cotaModalGrupo = grupo;
  _cotaModalNum = num;
  const data = cotasLoad();
  const c = cotaGet(data, grupo, num);
  const numStr = String(num).padStart(3, '0');

  document.getElementById('cotaModalTitle').textContent = `Cota ${numStr} — ${GRUPOS[grupo].label}`;
  document.getElementById('cotaModalGrupo').textContent = GRUPOS[grupo].label;
  document.getElementById('cotaModalNum').textContent = numStr;
  document.getElementById('cotaClienteInput').value  = c.cliente  || '';
  document.getElementById('cotaVendedorInput').value = c.vendedor || '';
  document.getElementById('cotaObsInput').value      = c.obs      || '';

  document.querySelectorAll('.status-btn').forEach(b => {
    b.classList.toggle('ativo', b.dataset.status === c.status);
  });

  const overlay = document.getElementById('cotaModalOverlay');
  overlay.style.display = 'flex';
}

function setCotaStatus(status) {
  document.querySelectorAll('.status-btn').forEach(b => {
    b.classList.toggle('ativo', b.dataset.status === status);
  });
}

function closeCotaModal() {
  document.getElementById('cotaModalOverlay').style.display = 'none';
}

function salvarCota() {
  const status   = document.querySelector('.status-btn.ativo')?.dataset.status || 'disponivel';
  const cliente  = document.getElementById('cotaClienteInput').value.trim();
  const vendedor = document.getElementById('cotaVendedorInput').value.trim();
  const obs      = document.getElementById('cotaObsInput').value.trim();

  const data = cotasLoad();
  const existing = data[cotaKey(_cotaModalGrupo, _cotaModalNum)] || {};
  data[cotaKey(_cotaModalGrupo, _cotaModalNum)] = { ...existing, status, cliente, vendedor, obs };
  cotasSave(data);

  closeCotaModal();
  renderCotasGrid();
}

function _cotasAbrirDisponiveisApi() {
  if (typeof initCotasApi === 'function') {
    navigate('cotas-api', document.querySelector('[data-page="cotas-api"]'));
  } else {
    alert('Módulo de Cotas Disponíveis não carregado.');
  }
}
