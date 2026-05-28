/* =====================================================================
   ASSEMBLEIAS — Reuniões mensais dos grupos de consórcio
   Persiste em localStorage: crm_assembleias
   ===================================================================== */

const ASSM_KEY = 'crm_assembleias';

function assmGet()     { try { return JSON.parse(localStorage.getItem(ASSM_KEY) || '[]'); } catch { return []; } }
function assmSet(list) { localStorage.setItem(ASSM_KEY, JSON.stringify(list)); }

function assmCreate(patch) {
  const list = assmGet();
  const a = { id: Date.now(), criadoEm: new Date().toISOString(), status: 'agendada', contemplados: [], ...patch };
  list.push(a);
  assmSet(list);
  return a;
}

function assmUpdate(id, patch) {
  assmSet(assmGet().map(a => a.id === id ? { ...a, ...patch } : a));
}

function assmDelete(id) { assmSet(assmGet().filter(a => a.id !== id)); }

/* ── Estado ── */
const ASSM = { filtro: 'todos', busca: '' };

function initAssembleias() {
  const el = document.getElementById('page-assembleias');
  if (!el) return;
  _assmSeedDemo();
  el.innerHTML = _assmRender();
}

function _assmSeedDemo() {
  if (assmGet().length > 0) return;
  const hoje = new Date();
  const grupos = ['Grupo 1234', 'Grupo 5678', 'Grupo 9012'];
  grupos.forEach((grupo, gi) => {
    for (let m = -1; m <= 1; m++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + m, 15);
      const data = d.toISOString().slice(0, 10);
      const status = m < 0 ? 'realizada' : m === 0 ? 'agendada' : 'agendada';
      assmCreate({
        grupo,
        data,
        horario: '19:00',
        local: 'Sede da Administradora',
        status,
        numSorteados: status === 'realizada' ? Math.floor(Math.random() * 3) + 1 : null,
        lanceVencedor: status === 'realizada' ? `${(20 + gi * 5 + Math.random() * 10).toFixed(1)}%` : null,
      });
    }
  });
}

function _assmRender() {
  const lista = assmGet();
  const hoje  = new Date().toISOString().slice(0, 10);

  const prox = lista.filter(a => a.data >= hoje && a.status === 'agendada').sort((a,b) => a.data.localeCompare(b.data))[0];

  let filtered = [...lista];
  if (ASSM.filtro !== 'todos') filtered = filtered.filter(a => a.status === ASSM.filtro);
  if (ASSM.busca) {
    const b = ASSM.busca.toLowerCase();
    filtered = filtered.filter(a => (a.grupo||'').toLowerCase().includes(b));
  }
  filtered.sort((a, b) => b.data?.localeCompare(a.data));

  const statusMap = {
    agendada:  { label:'Agendada',  color:'#0891b2' },
    realizada: { label:'Realizada', color:'#16a34a' },
    cancelada: { label:'Cancelada', color:'#ef4444' },
  };

  return `
    <div class="page-header">
      <div><div class="page-title">Assembleias</div><div class="page-subtitle">Reuniões mensais dos grupos de consórcio</div></div>
      <button class="btn btn-primary" onclick="_assmAbrirModal()"><i class="bi bi-plus-lg"></i> Nova Assembleia</button>
    </div>

    <!-- Próxima Assembleia -->
    ${prox ? `
    <div class="card" style="background:linear-gradient(135deg,var(--primary),#1e40af);color:white;margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;opacity:.8;margin-bottom:6px;text-transform:uppercase;letter-spacing:.6px"><i class="bi bi-calendar-event-fill"></i> Próxima Assembleia</div>
      <div style="font-size:20px;font-weight:900;margin-bottom:4px">${_esc(prox.grupo)}</div>
      <div style="font-size:14px;opacity:.9">${new Date(prox.data+'T00:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})} às ${prox.horario||'—'}</div>
      ${prox.local ? `<div style="font-size:12px;opacity:.7;margin-top:4px"><i class="bi bi-geo-alt-fill"></i> ${_esc(prox.local)}</div>` : ''}
    </div>` : ''}

    <!-- KPIs rápidos -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;margin-bottom:20px">
      ${_assmKpi('Total', lista.length, 'bi-building', 'var(--primary)')}
      ${_assmKpi('Agendadas', lista.filter(a=>a.status==='agendada').length, 'bi-calendar-check-fill', '#0891b2')}
      ${_assmKpi('Realizadas', lista.filter(a=>a.status==='realizada').length, 'bi-check-circle-fill', '#16a34a')}
      ${_assmKpi('Grupos', [...new Set(lista.map(a=>a.grupo))].length, 'bi-grid-3x3-gap-fill', '#7c3aed')}
    </div>

    <!-- Filtros -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
      <input class="form-input" placeholder="Buscar grupo..." style="max-width:240px"
        value="${_esc(ASSM.busca)}" oninput="ASSM.busca=this.value;initAssembleias()" />
      ${['todos','agendada','realizada','cancelada'].map(s => `
        <button class="btn btn-sm ${ASSM.filtro===s?'btn-primary':'btn-ghost'}" onclick="ASSM.filtro='${s}';initAssembleias()">
          ${s==='todos'?'Todas':statusMap[s]?.label||s}
        </button>`).join('')}
    </div>

    <!-- Lista -->
    ${filtered.length === 0
      ? `<div class="card" style="text-align:center;padding:60px;color:var(--muted)"><i class="bi bi-building" style="font-size:40px;display:block;margin-bottom:12px;opacity:.3"></i>Nenhuma assembleia encontrada.</div>`
      : `<div style="display:grid;gap:12px">
          ${filtered.map(a => {
            const st = statusMap[a.status] || { label: a.status, color:'#6b7280' };
            return `
              <div class="card" style="border-left:4px solid ${st.color}">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px">
                  <div>
                    <div style="font-size:14px;font-weight:800;color:var(--primary)">${_esc(a.grupo||'Sem grupo')}</div>
                    <div style="font-size:12px;color:var(--muted)">${a.data?new Date(a.data+'T00:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'}):''} ${a.horario?'às '+a.horario:''}</div>
                    ${a.local?`<div style="font-size:11px;color:var(--muted)"><i class="bi bi-geo-alt"></i> ${_esc(a.local)}</div>`:''}
                  </div>
                  <span style="font-size:10px;font-weight:700;background:${st.color}22;color:${st.color};padding:3px 8px;border-radius:8px">${st.label}</span>
                </div>
                ${a.status === 'realizada' ? `
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
                    ${a.numSorteados!=null?`<div style="background:#f0fdf4;border-radius:8px;padding:8px 10px"><div style="font-size:10px;color:#16a34a;font-weight:700">Sorteados</div><div style="font-size:16px;font-weight:900;color:#16a34a">${a.numSorteados}</div></div>`:''}
                    ${a.lanceVencedor?`<div style="background:#fffbeb;border-radius:8px;padding:8px 10px"><div style="font-size:10px;color:#d97706;font-weight:700">Lance Vencedor</div><div style="font-size:16px;font-weight:900;color:#d97706">${a.lanceVencedor}</div></div>`:''}
                  </div>` : ''}
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${a.status==='agendada'?`<button class="btn btn-sm" style="background:#dcfce7;color:#16a34a;border:none" onclick="_assmRegistrarResultado(${a.id})"><i class="bi bi-check-lg"></i> Registrar Resultado</button>`:''}
                  <button class="btn btn-ghost btn-sm" onclick="_assmExcluir(${a.id})"><i class="bi bi-trash"></i></button>
                </div>
              </div>`;
          }).join('')}
        </div>`}

    <!-- Modal nova assembleia -->
    <div id="assmModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;align-items:center;justify-content:center" onclick="if(event.target===this)this.style.display='none'">
      <div class="card" style="width:100%;max-width:440px;padding:24px">
        <div style="font-size:15px;font-weight:800;color:var(--primary);margin-bottom:18px">Nova Assembleia</div>
        <div style="display:grid;gap:12px">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Grupo</label>
            <input class="form-input" id="assmGrupo" placeholder="Ex: Grupo 1234" style="width:100%" />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Data</label>
              <input class="form-input" id="assmData" type="date" style="width:100%" value="${new Date().toISOString().slice(0,10)}" />
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Horário</label>
              <input class="form-input" id="assmHorario" type="time" value="19:00" style="width:100%" />
            </div>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Local</label>
            <input class="form-input" id="assmLocal" placeholder="Sede / Videoconferência" style="width:100%" />
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <button class="btn btn-primary" onclick="_assmSalvar()"><i class="bi bi-plus-lg"></i> Agendar</button>
          <button class="btn btn-ghost" onclick="document.getElementById('assmModal').style.display='none'">Cancelar</button>
        </div>
      </div>
    </div>

    <!-- Modal resultado -->
    <div id="assmResultModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;align-items:center;justify-content:center" onclick="if(event.target===this)this.style.display='none'">
      <div class="card" style="width:100%;max-width:400px;padding:24px">
        <div style="font-size:15px;font-weight:800;color:var(--primary);margin-bottom:18px"><i class="bi bi-check-circle-fill" style="color:#16a34a"></i> Registrar Resultado</div>
        <input type="hidden" id="assmResultId" />
        <div style="display:grid;gap:12px">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Nº de Sorteados</label>
            <input class="form-input" id="assmSorteados" type="number" min="0" value="1" style="width:100%" />
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Lance Vencedor (%)</label>
            <input class="form-input" id="assmLance" placeholder="Ex: 25%" style="width:100%" />
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <button class="btn btn-primary" onclick="_assmSalvarResultado()"><i class="bi bi-check-lg"></i> Salvar Resultado</button>
          <button class="btn btn-ghost" onclick="document.getElementById('assmResultModal').style.display='none'">Cancelar</button>
        </div>
      </div>
    </div>
  `;
}

function _assmKpi(label, val, icon, color) {
  return `<div class="card" style="text-align:center;padding:12px 8px">
    <i class="bi ${icon}" style="font-size:18px;color:${color};display:block;margin-bottom:5px"></i>
    <div style="font-size:15px;font-weight:900;color:var(--primary);margin-bottom:2px">${val}</div>
    <div style="font-size:10px;color:var(--muted);font-weight:600">${label}</div>
  </div>`;
}

function _assmAbrirModal() {
  const m = document.getElementById('assmModal');
  if (m) m.style.display = 'flex';
}

function _assmSalvar() {
  const grupo   = document.getElementById('assmGrupo')?.value?.trim();
  const data    = document.getElementById('assmData')?.value;
  const horario = document.getElementById('assmHorario')?.value || '';
  const local   = document.getElementById('assmLocal')?.value?.trim() || '';
  if (!grupo || !data) { alert('Informe o grupo e a data.'); return; }
  assmCreate({ grupo, data, horario, local });
  document.getElementById('assmModal').style.display = 'none';
  initAssembleias();
}

function _assmRegistrarResultado(id) {
  document.getElementById('assmResultId').value = id;
  document.getElementById('assmResultModal').style.display = 'flex';
}

function _assmSalvarResultado() {
  const id     = parseInt(document.getElementById('assmResultId')?.value || '0');
  const sorte  = parseInt(document.getElementById('assmSorteados')?.value || '0');
  const lance  = document.getElementById('assmLance')?.value?.trim() || '';
  assmUpdate(id, { status: 'realizada', numSorteados: sorte, lanceVencedor: lance });
  document.getElementById('assmResultModal').style.display = 'none';
  initAssembleias();
}

function _assmExcluir(id) {
  if (!confirm('Excluir esta assembleia?')) return;
  assmDelete(id);
  initAssembleias();
}
