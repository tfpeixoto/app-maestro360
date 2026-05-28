/* =====================================================================
   EQUIPE — Gestão de vendedores, metas e performance
   Persiste em localStorage: crm_equipe
   ===================================================================== */

const EQUI_KEY = 'crm_equipe';

function equiGet()     { try { return JSON.parse(localStorage.getItem(EQUI_KEY) || '[]'); } catch { return []; } }
function equiSet(list) { localStorage.setItem(EQUI_KEY, JSON.stringify(list)); }

function equiCreate(patch) {
  const list = equiGet();
  const m = { id: Date.now(), criadoEm: new Date().toISOString(), ativo: true, comissao: 1.5, ...patch };
  list.push(m);
  equiSet(list);
  return m;
}

function equiUpdate(id, patch) {
  equiSet(equiGet().map(m => m.id === id ? { ...m, ...patch } : m));
}

function equiDelete(id) { equiSet(equiGet().filter(m => m.id !== id)); }

/* ── Estado ── */
let _equiModal = null;

function initEquipe() {
  const el = document.getElementById('page-equipe');
  if (!el) return;
  _equiSeedDemo();
  el.innerHTML = _equiRender();
}

function _equiSeedDemo() {
  if (equiGet().length > 0) return;
  ['Ana Silveira','Carlos Matos','Fernanda Lima'].forEach((nome, i) => {
    equiCreate({ nome, email: nome.toLowerCase().split(' ').join('.')+`@empresa.com`, telefone: `(11) 9${8000+i}-${1234+i}`, cargo: 'Consultor de Vendas', comissao: 1.5 + i * 0.25 });
  });
}

function _equiRender() {
  const membros = equiGet();
  const leads   = storeGet();
  const hoje    = new Date();
  const mesAtual= hoje.toISOString().slice(0,7);
  const reunioes= rnGet();

  /* Performance de cada membro — simplificada: distribui leads por índice (demo) */
  const perfMap = {};
  membros.forEach((m, i) => {
    const myLeads = leads.filter((_, li) => li % membros.length === i);
    const fechados = myLeads.filter(l => ['contrato','fechado'].includes(l.stage));
    const valor    = fechados.reduce((s,l) => s+(l.valorDesejado||0), 0);
    const reuns    = reunioes.filter(r => myLeads.some(l => l.id === r.leadId) && r.data?.startsWith(mesAtual)).length;
    perfMap[m.id] = { leads: myLeads.length, fechados: fechados.length, valor, reuns };
  });

  const totalLeads   = leads.length;
  const totalFecham  = leads.filter(l => ['contrato','fechado'].includes(l.stage)).length;
  const melhorMembro = membros.reduce((best, m) => (!best || (perfMap[m.id]?.fechados||0) > (perfMap[best.id]?.fechados||0)) ? m : best, null);

  return `
    <div class="page-header">
      <div><div class="page-title">Equipe</div><div class="page-subtitle">Vendedores, performance e comissões</div></div>
      <button class="btn btn-primary" onclick="_equiAbrirModal()"><i class="bi bi-person-plus-fill"></i> Adicionar Membro</button>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px;margin-bottom:20px">
      ${_equiKpi('Equipe',     membros.filter(m=>m.ativo).length, 'bi-people-fill',         'var(--primary)')}
      ${_equiKpi('Leads Total',totalLeads,                        'bi-person-lines-fill',    '#0891b2')}
      ${_equiKpi('Fechamentos',totalFecham,                       'bi-check-circle-fill',    '#16a34a')}
      ${_equiKpi('Destaque',   melhorMembro?.nome?.split(' ')[0]||'—', 'bi-star-fill',      '#d97706')}
    </div>

    <!-- Cards de membros -->
    ${membros.length === 0
      ? `<div class="card" style="text-align:center;padding:60px;color:var(--muted)"><i class="bi bi-people" style="font-size:40px;display:block;margin-bottom:12px;opacity:.3"></i>Nenhum membro cadastrado.</div>`
      : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px">
          ${membros.map(m => {
            const p = perfMap[m.id] || {};
            const taxa = p.leads > 0 ? Math.round((p.fechados / p.leads) * 100) : 0;
            const comissaoEst = p.valor * (m.comissao / 100);
            const isMelhor = m.id === melhorMembro?.id;
            return `
              <div class="card" style="border-top:3px solid ${m.ativo?'var(--primary)':'var(--border)'}${isMelhor?';box-shadow:0 4px 20px rgba(13,31,60,.12)':''}">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
                  <div style="width:46px;height:46px;background:var(--primary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;color:white;flex-shrink:0">${(m.nome||'?')[0].toUpperCase()}</div>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:14px;font-weight:800;color:var(--primary);display:flex;align-items:center;gap:6px">
                      ${_esc(m.nome)}
                      ${isMelhor?`<span style="font-size:10px;background:#fef9c3;color:#d97706;padding:2px 6px;border-radius:6px;font-weight:700"><i class="bi bi-trophy-fill"></i> Top</span>`:''}
                    </div>
                    <div style="font-size:11px;color:var(--muted)">${_esc(m.cargo||'Consultor')}</div>
                  </div>
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-ghost" style="width:28px;height:28px;padding:0;font-size:14px;border-radius:6px" onclick="_equiEditar(${m.id})" title="Editar"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-ghost" style="width:28px;height:28px;padding:0;font-size:14px;border-radius:6px" onclick="_equiExcluir(${m.id})" title="Remover"><i class="bi bi-trash"></i></button>
                  </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
                  ${[
                    ['Leads',      p.leads||0,      'var(--primary)'],
                    ['Fechamentos',p.fechados||0,   '#16a34a'],
                    ['Reuniões/mês',p.reuns||0,     '#0891b2'],
                    ['Comissão est.',fmtValor(comissaoEst), '#d97706'],
                  ].map(([l,v,c]) => `
                    <div style="background:var(--bg);border-radius:8px;padding:8px 10px">
                      <div style="font-size:10px;color:var(--muted);font-weight:600">${l}</div>
                      <div style="font-size:14px;font-weight:900;color:${c}">${v}</div>
                    </div>`).join('')}
                </div>

                <!-- Taxa conversão -->
                <div style="margin-bottom:12px">
                  <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
                    <span style="color:var(--muted);font-weight:600">Taxa Conversão</span>
                    <span style="font-weight:800;color:var(--primary)">${taxa}%</span>
                  </div>
                  <div style="height:6px;background:var(--border);border-radius:3px">
                    <div style="height:100%;width:${taxa}%;background:var(--primary);border-radius:3px;transition:width .4s"></div>
                  </div>
                </div>

                <!-- Contato -->
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${m.email?`<a class="btn btn-ghost btn-sm" href="mailto:${_esc(m.email)}"><i class="bi bi-envelope-fill"></i></a>`:''}
                  ${m.telefone?`<a class="btn btn-ghost btn-sm" href="tel:${_esc(m.telefone)}"><i class="bi bi-telephone-fill"></i></a>`:''}
                  <span style="font-size:11px;color:var(--muted);padding:6px 0;margin-left:auto">Comissão: <strong>${m.comissao||1.5}%</strong></span>
                </div>
              </div>`;
          }).join('')}
        </div>`}

    <!-- Modal -->
    <div id="equiModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;align-items:center;justify-content:center" onclick="if(event.target===this)this.style.display='none'">
      <div class="card" style="width:100%;max-width:460px;padding:24px">
        <div style="font-size:15px;font-weight:800;color:var(--primary);margin-bottom:18px"><i class="bi bi-person-badge-fill"></i> <span id="equiModalTit">Novo Membro</span></div>
        <input type="hidden" id="equiEditId" />
        <div style="display:grid;gap:12px">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Nome completo</label>
            <input class="form-input" id="equiNome" placeholder="Ana Silveira" style="width:100%" />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">E-mail</label>
              <input class="form-input" id="equiEmail" type="email" placeholder="ana@empresa.com" style="width:100%" />
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Telefone</label>
              <input class="form-input" id="equiTel" placeholder="(11) 99999-9999" style="width:100%" />
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Cargo</label>
              <input class="form-input" id="equiCargo" placeholder="Consultor de Vendas" style="width:100%" />
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Comissão (%)</label>
              <input class="form-input" id="equiComissao" type="number" min="0" max="100" step="0.25" placeholder="1.5" style="width:100%" />
            </div>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <button class="btn btn-primary" onclick="_equiSalvar()"><i class="bi bi-check-lg"></i> Salvar</button>
          <button class="btn btn-ghost" onclick="document.getElementById('equiModal').style.display='none'">Cancelar</button>
        </div>
      </div>
    </div>
  `;
}

function _equiKpi(label, val, icon, color) {
  return `<div class="card" style="text-align:center;padding:14px 10px">
    <i class="bi ${icon}" style="font-size:20px;color:${color};display:block;margin-bottom:6px"></i>
    <div style="font-size:16px;font-weight:900;color:var(--primary);margin-bottom:2px">${val}</div>
    <div style="font-size:10px;color:var(--muted);font-weight:600">${label}</div>
  </div>`;
}

function _equiAbrirModal(editId) {
  const m = document.getElementById('equiModal');
  if (!m) return;
  document.getElementById('equiEditId').value = editId || '';
  document.getElementById('equiModalTit').textContent = editId ? 'Editar Membro' : 'Novo Membro';
  if (editId) {
    const mem = equiGet().find(x => x.id === editId);
    if (mem) {
      document.getElementById('equiNome').value     = mem.nome     || '';
      document.getElementById('equiEmail').value    = mem.email    || '';
      document.getElementById('equiTel').value      = mem.telefone || '';
      document.getElementById('equiCargo').value    = mem.cargo    || '';
      document.getElementById('equiComissao').value = mem.comissao ?? 1.5;
    }
  } else {
    ['equiNome','equiEmail','equiTel','equiCargo'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
    document.getElementById('equiComissao').value = '1.5';
  }
  m.style.display = 'flex';
}

function _equiSalvar() {
  const editId = parseInt(document.getElementById('equiEditId')?.value || '0');
  const nome   = document.getElementById('equiNome')?.value?.trim();
  if (!nome) { alert('Informe o nome.'); return; }
  const data = {
    nome,
    email:    document.getElementById('equiEmail')?.value?.trim()  || '',
    telefone: document.getElementById('equiTel')?.value?.trim()    || '',
    cargo:    document.getElementById('equiCargo')?.value?.trim()  || 'Consultor de Vendas',
    comissao: parseFloat(document.getElementById('equiComissao')?.value || '1.5'),
  };
  if (editId) equiUpdate(editId, data); else equiCreate(data);
  document.getElementById('equiModal').style.display = 'none';
  initEquipe();
}

function _equiEditar(id) { _equiAbrirModal(id); }

function _equiExcluir(id) {
  if (!confirm('Remover este membro da equipe?')) return;
  equiDelete(id);
  initEquipe();
}
