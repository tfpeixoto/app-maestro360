/* =====================================================================
   PROPOSTAS — Propostas comerciais vinculadas a leads e cotas
   Persiste em localStorage: crm_propostas
   ===================================================================== */

const PROP_KEY = 'crm_propostas';

function propGet()     { try { return JSON.parse(localStorage.getItem(PROP_KEY) || '[]'); } catch { return []; } }
function propSet(list) { localStorage.setItem(PROP_KEY, JSON.stringify(list)); }

function propCreate(patch) {
  const list = propGet();
  const p = { id: Date.now(), criadoEm: new Date().toISOString(), status: 'rascunho', ...patch };
  list.push(p);
  propSet(list);
  return p;
}

function propUpdate(id, patch) {
  propSet(propGet().map(p => p.id === id ? { ...p, ...patch, atualizadoEm: new Date().toISOString() } : p));
}

function propDelete(id) { propSet(propGet().filter(p => p.id !== id)); }

/* ── Estado ── */
const PROP = { filtro: 'todos', busca: '' };

function initPropostas() {
  const el = document.getElementById('page-propostas');
  if (!el) return;
  el.innerHTML = _propRender();
}

function _propRender() {
  const lista  = propGet();
  const leads  = storeGet();

  /* Incluir pré-propostas vindas das simulações dos leads */
  const preProps = [];
  leads.forEach(lead => {
    (lead.simulacoes || []).forEach(sim => {
      if (sim.status === 'pre-proposta') {
        preProps.push({
          id: sim.id,
          criadoEm: sim.criadoEm || new Date(sim.ts||Date.now()).toISOString(),
          status: 'pre-proposta',
          leadId: lead.id,
          leadNome: lead.nome,
          titulo: `Pré-Proposta — ${fR ? fR(sim.credito) : sim.credito}`,
          valor: sim.credito,
          descricao: `Grupo ${sim.grupo} · Mês contemplação: ${sim.mesContempl} · Objetivo: ${sim.objetivo||'—'}`,
          _simId: sim.id,
          _leadRef: lead,
        });
      }
    });
  });

  const todasLista = [...preProps, ...lista];

  const kpis = {
    total:    lista.length,
    enviadas: lista.filter(p => p.status === 'enviada').length,
    aceitas:  lista.filter(p => p.status === 'aceita').length,
    valor:    lista.filter(p => ['enviada','aceita'].includes(p.status)).reduce((s,p) => s+(p.valor||0), 0),
  };
  const taxa = kpis.enviadas > 0 ? Math.round((kpis.aceitas / kpis.enviadas) * 100) : 0;

  let filtered = [...todasLista];
  if (PROP.filtro === 'pre-proposta') {
    filtered = preProps;
  } else if (PROP.filtro !== 'todos') {
    filtered = lista.filter(p => p.status === PROP.filtro);
  }
  if (PROP.busca) {
    const b = PROP.busca.toLowerCase();
    filtered = filtered.filter(p => (p.leadNome||'').toLowerCase().includes(b) || (p.titulo||'').toLowerCase().includes(b));
  }
  filtered.sort((a, b) => (b.criadoEm||'').localeCompare(a.criadoEm||''));

  const statusMap = {
    'pre-proposta': { label:'Pré-Proposta', color:'#7c3aed' },
    rascunho:       { label:'Rascunho',     color:'#6b7280' },
    enviada:        { label:'Enviada',       color:'#0891b2' },
    aceita:         { label:'Aceita',        color:'#16a34a' },
    recusada:       { label:'Recusada',      color:'#ef4444' },
  };

  return `
    <div class="page-header">
      <div><div class="page-title">Propostas</div><div class="page-subtitle">Propostas comerciais vinculadas aos leads</div></div>
      <button class="btn btn-primary" onclick="_propAbrirModal()"><i class="bi bi-plus-lg"></i> Nova Proposta</button>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;margin-bottom:20px">
      ${_propKpi('Pré-Propostas',   preProps.length,   'bi-bookmark-star-fill', '#7c3aed')}
      ${_propKpi('Total',           kpis.total,        'bi-file-text-fill',     'var(--primary)')}
      ${_propKpi('Enviadas',        kpis.enviadas,     'bi-send-fill',          '#0891b2')}
      ${_propKpi('Aceitas',         kpis.aceitas,      'bi-check-circle-fill',  '#16a34a')}
      ${_propKpi('Taxa Aprovação',  taxa+'%',          'bi-graph-up-arrow',     '#d97706')}
    </div>

    <!-- Filtros -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
      <input class="form-input" placeholder="Buscar lead ou título..." style="max-width:280px"
        value="${_esc(PROP.busca)}" oninput="PROP.busca=this.value;initPropostas()" />
      ${['todos','pre-proposta','rascunho','enviada','aceita','recusada'].map(s => `
        <button class="btn btn-sm ${PROP.filtro===s?'btn-primary':'btn-ghost'}" onclick="PROP.filtro='${s}';initPropostas()">
          ${s==='todos'?'Todas':statusMap[s]?.label||s}
        </button>`).join('')}
    </div>

    <!-- Cards -->
    ${filtered.length === 0
      ? `<div class="card" style="text-align:center;padding:60px 20px;color:var(--muted)">
          <i class="bi bi-file-text" style="font-size:40px;display:block;margin-bottom:12px;opacity:.3"></i>
          Nenhuma proposta encontrada.
        </div>`
      : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px">
          ${filtered.map(p => {
            const st = statusMap[p.status] || { label: p.status, color:'#6b7280' };
            const isPreProp = p.status === 'pre-proposta';
            return `
              <div class="card" style="border-top:3px solid ${st.color}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
                  <div style="flex:1;min-width:0">
                    <div style="font-size:14px;font-weight:800;color:var(--primary);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(p.titulo||'Sem título')}</div>
                    <div style="font-size:12px;color:var(--muted)">${_esc(p.leadNome||'—')}</div>
                  </div>
                  <span style="font-size:10px;font-weight:700;background:${st.color}22;color:${st.color};padding:3px 8px;border-radius:8px;white-space:nowrap;margin-left:8px">${st.label}</span>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
                  <div style="background:var(--bg);border-radius:8px;padding:8px 10px">
                    <div style="font-size:10px;color:var(--muted);font-weight:600">Valor</div>
                    <div style="font-size:13px;font-weight:800;color:var(--primary)">${fmtValor(p.valor)}</div>
                  </div>
                  <div style="background:var(--bg);border-radius:8px;padding:8px 10px">
                    <div style="font-size:10px;color:var(--muted);font-weight:600">${isPreProp ? 'Criado em' : 'Validade'}</div>
                    <div style="font-size:12px;font-weight:700">${isPreProp
                      ? new Date(p.criadoEm).toLocaleDateString('pt-BR')
                      : (p.validade ? new Date(p.validade+'T00:00:00').toLocaleDateString('pt-BR') : '—')}</div>
                  </div>
                </div>

                ${p.descricao ? `<div style="font-size:12px;color:var(--muted);margin-bottom:12px;border-top:1px solid var(--border);padding-top:10px">${_esc(p.descricao)}</div>` : ''}

                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${isPreProp ? `
                    <button class="btn btn-sm" style="background:#ede9fe;color:#7c3aed;border:none" onclick="_propConverterPreProposta('${p.leadId}','${p._simId}')">
                      <i class="bi bi-arrow-right-circle-fill"></i> Converter em Proposta
                    </button>` : ''}
                  ${p.status === 'rascunho' ? `<button class="btn btn-outline btn-sm" style="color:#0891b2;border-color:#0891b2" onclick="_propStatus(${p.id},'enviada')"><i class="bi bi-send-fill"></i> Enviar</button>` : ''}
                  ${p.status === 'enviada'  ? `<button class="btn btn-sm" style="background:#dcfce7;color:#16a34a;border:none" onclick="_propStatus(${p.id},'aceita')"><i class="bi bi-check-lg"></i> Aceita</button>` : ''}
                  ${p.status === 'enviada'  ? `<button class="btn btn-sm" style="background:#fee2e2;color:#ef4444;border:none" onclick="_propStatus(${p.id},'recusada')"><i class="bi bi-x-lg"></i> Recusada</button>` : ''}
                  ${p.status === 'aceita'   ? `
                    <button class="btn btn-outline btn-sm" style="color:#16a34a;border-color:#16a34a" onclick="_propGerarContrato(${p.id})"><i class="bi bi-pen-fill"></i> Gerar Contrato</button>
                    <button class="btn btn-sm" style="background:#0d1f3c;color:white;border:none" onclick="_propFinalizarVenda(${p.id})"><i class="bi bi-bag-check-fill"></i> Finalizar Venda</button>` : ''}
                  ${!isPreProp ? `
                    <button class="btn btn-ghost btn-sm" onclick="propGerarPDF(${p.id})" title="Gerar PDF"><i class="bi bi-file-earmark-pdf-fill" style="color:#ef4444"></i></button>
                    <button class="btn btn-ghost btn-sm" onclick="_propExcluir(${p.id})"><i class="bi bi-trash"></i></button>` : ''}
                </div>
              </div>`;
          }).join('')}
        </div>`}

    <!-- Modal nova proposta -->
    <div id="propModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;align-items:center;justify-content:center" onclick="if(event.target===this)this.style.display='none'">
      <div class="card" style="width:100%;max-width:500px;padding:24px;max-height:90vh;overflow-y:auto">
        <div style="font-size:15px;font-weight:800;color:var(--primary);margin-bottom:18px"><i class="bi bi-file-text-fill"></i> Nova Proposta</div>
        <div style="display:grid;gap:12px">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Cliente / Lead</label>
            <select class="form-input" id="propLeadSel" style="width:100%">
              <option value="">— Selecione o lead —</option>
              ${leads.map(l => `<option value="${l.id}" data-valor="${l.valorDesejado||0}">${_esc(l.nome)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Título da Proposta</label>
            <input class="form-input" id="propTitulo" placeholder="Ex: Proposta Consórcio Imóvel 200k" style="width:100%" />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Valor (R$)</label>
              <input class="form-input" id="propValor" type="number" min="0" step="0.01" placeholder="0,00" style="width:100%" />
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Validade</label>
              <input class="form-input" id="propValidade" type="date" style="width:100%" />
            </div>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Descrição / Observações</label>
            <textarea class="form-input" id="propDesc" rows="3" placeholder="Descreva as condições da proposta..." style="width:100%;resize:vertical"></textarea>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <button class="btn btn-primary" onclick="_propSalvar()"><i class="bi bi-plus-lg"></i> Criar Proposta</button>
          <button class="btn btn-ghost" onclick="document.getElementById('propModal').style.display='none'">Cancelar</button>
        </div>
      </div>
    </div>

    <!-- Modal Finalizar Venda -->
    <div id="vendaModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:3000;align-items:center;justify-content:center" onclick="if(event.target===this)this.style.display='none'">
      <div class="card" style="width:100%;max-width:640px;padding:24px;max-height:92vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-size:16px;font-weight:800;color:var(--primary)"><i class="bi bi-bag-check-fill"></i> Finalizar Venda</div>
          <button onclick="document.getElementById('vendaModal').style.display='none'" style="background:none;border:none;font-size:22px;cursor:pointer;color:#64748b">&times;</button>
        </div>
        <div id="vendaModalContent"></div>
      </div>
    </div>
  `;
}

function _propKpi(label, val, icon, color) {
  return `<div class="card" style="text-align:center;padding:14px 10px">
    <i class="bi ${icon}" style="font-size:20px;color:${color};display:block;margin-bottom:6px"></i>
    <div style="font-size:16px;font-weight:900;color:var(--primary);margin-bottom:2px">${val}</div>
    <div style="font-size:10px;color:var(--muted);font-weight:600">${label}</div>
  </div>`;
}

function _propAbrirModal() {
  const m = document.getElementById('propModal');
  if (m) {
    m.style.display = 'flex';
    const sel = document.getElementById('propLeadSel');
    if (sel) sel.onchange = () => {
      const opt = sel.options[sel.selectedIndex];
      const val = document.getElementById('propValor');
      if (val && opt?.dataset.valor) val.value = opt.dataset.valor;
    };
    const val = document.getElementById('propValidade');
    if (val) {
      const d = new Date(); d.setDate(d.getDate() + 30);
      val.value = d.toISOString().slice(0,10);
    }
  }
}

function _propSalvar() {
  const sel  = document.getElementById('propLeadSel');
  const lead = storeGet().find(l => String(l.id) === String(sel?.value));
  const val  = parseFloat(document.getElementById('propValor')?.value || '0');
  const tit  = document.getElementById('propTitulo')?.value?.trim();
  if (!lead || !tit) { alert('Selecione o lead e informe o título.'); return; }
  propCreate({
    leadId:    lead.id,
    leadNome:  lead.nome,
    titulo:    tit,
    valor:     val,
    validade:  document.getElementById('propValidade')?.value || '',
    descricao: document.getElementById('propDesc')?.value?.trim() || '',
  });
  document.getElementById('propModal').style.display = 'none';
  initPropostas();
}

function _propStatus(id, status) {
  propUpdate(id, { status });
  if (status === 'aceita') {
    const prop = propGet().find(p => p.id === id);
    if (prop && typeof leadMoveStage === 'function') leadMoveStage(prop.leadId, 'contrato');
  }
  initPropostas();
}

function _propConverterPreProposta(leadId, simId) {
  const leads = JSON.parse(localStorage.getItem('crm_leads') || '[]');
  const lead  = leads.find(l => String(l.id) === String(leadId));
  if (!lead) return;
  const sim   = (lead.simulacoes || []).find(s => s.id === simId);
  if (!sim)   return;

  const titulo = `Proposta — ${fR ? fR(sim.credito) : sim.credito} · Grupo ${sim.grupo}`;
  const d = new Date(); d.setDate(d.getDate() + 30);
  propCreate({
    leadId:   lead.id,
    leadNome: lead.nome,
    titulo,
    valor:    sim.credito,
    validade: d.toISOString().slice(0,10),
    descricao: `Grupo ${sim.grupo} · Parcela: ${sim.parcela ? 'R$ '+sim.parcela.toFixed(2) : '—'} · Mês contempl.: ${sim.mesContempl}`,
    _simId: simId,
  });

  /* marcar sim como proposta */
  sim.status = 'proposta';
  localStorage.setItem('crm_leads', JSON.stringify(leads));

  initPropostas();
  if (typeof showToast === 'function') showToast('Pré-proposta convertida em Proposta ✓');
}

function _propGerarContrato(propId) {
  const prop = propGet().find(p => p.id === propId);
  if (!prop) return;
  if (typeof contCreate === 'function') {
    contCreate({ leadId: prop.leadId, leadNome: prop.leadNome, propostaId: propId, valor: prop.valor, titulo: `Contrato — ${prop.titulo}` });
    navigate('contratos', document.querySelector('[data-page=contratos]'));
  } else {
    alert('Contrato criado! Vá para a tela de Contratos para gerenciá-lo.');
  }
}

/* ── FINALIZAR VENDA — selecionar cota do quadro ── */
function _propFinalizarVenda(propId) {
  const prop = propGet().find(p => p.id === propId);
  if (!prop) return;

  const cotas   = JSON.parse(localStorage.getItem('crm_cotas') || '{}');
  const GRUPOS_C = { '4003': 180, '4004': 180 };

  const renderGrupoCotas = grupo => {
    let html = `<div style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:800;color:var(--primary);margin-bottom:10px">Grupo ${grupo}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(48px,1fr));gap:5px">`;
    for (let i = 1; i <= GRUPOS_C[grupo]; i++) {
      const key  = grupo + '_' + i;
      const cota = cotas[key] || { status:'disponivel', cliente:'' };
      const num  = String(i).padStart(3,'0');
      if (cota.status === 'disponivel') {
        html += `<div class="cota-num cota-disponivel" style="cursor:pointer;font-size:12px;height:44px"
          onclick="_propSelecionarCota('${propId}','${grupo}',${i})" title="Cota ${num}">${num}</div>`;
      } else {
        const bg = cota.status==='vendida'?'#dbeafe':cota.status==='reservada'?'#fef9c3':'#fef3c7';
        const co = cota.status==='vendida'?'#1e40af':cota.status==='reservada'?'#92400e':'#78350f';
        html += `<div style="height:44px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:${bg};color:${co};opacity:0.6" title="${cota.status}: ${cota.cliente||''}">${num}</div>`;
      }
    }
    html += '</div></div>';
    return html;
  };

  const content = `
    <div style="margin-bottom:16px;background:var(--bg);border-radius:10px;padding:12px 16px">
      <div style="font-size:12px;color:var(--muted);font-weight:600">Proposta</div>
      <div style="font-size:15px;font-weight:800;color:var(--primary)">${_esc(prop.titulo)}</div>
      <div style="font-size:12px;color:var(--muted)">${_esc(prop.leadNome)} · ${fmtValor(prop.valor)}</div>
    </div>
    <div style="font-size:13px;font-weight:700;color:var(--primary);margin-bottom:12px">Selecione a cota disponível (verde):</div>
    ${Object.keys(GRUPOS_C).map(renderGrupoCotas).join('')}
  `;

  document.getElementById('vendaModalContent').innerHTML = content;
  document.getElementById('vendaModal').style.display = 'flex';
}

function _propSelecionarCota(propId, grupo, num) {
  const prop    = propGet().find(p => p.id === propId);
  if (!prop) return;
  const numStr  = String(num).padStart(3,'0');
  if (!confirm(`Confirmar venda?\n\nProposta: ${prop.titulo}\nCota: ${numStr} — Grupo ${grupo}\nCliente: ${prop.leadNome}`)) return;

  /* marcar cota como vendida */
  const cotas = JSON.parse(localStorage.getItem('crm_cotas') || '{}');
  const lead  = storeGet().find(l => String(l.id) === String(prop.leadId));
  cotas[grupo + '_' + num] = {
    status:   'vendida',
    cliente:  prop.leadNome,
    obs:      `Proposta: ${prop.titulo}`,
    leadId:   prop.leadId,
    propId:   propId,
    vendedor: (lead?.vendedor || ''),
    vendidoEm: new Date().toISOString(),
  };
  localStorage.setItem('crm_cotas', JSON.stringify(cotas));

  /* criar parcelas mensais (6 meses futuros como exemplo) */
  if (typeof parcCreate === 'function' && lead) {
    const aporte = lead.aporteMensal || prop.valor * 0.01;
    for (let m = 0; m < 6; m++) {
      const d = new Date(); d.setMonth(d.getMonth() + m + 1);
      const venc = d.toISOString().slice(0,10);
      parcCreate({ leadId: lead.id, leadNome: lead.nome, valor: aporte, vencimento: venc, mes: venc.slice(0,7), grupoNum: grupo, cotaNum: num });
    }
  }

  /* atualizar proposta */
  propUpdate(propId, { status: 'venda_realizada', cotaGrupo: grupo, cotaNum: num, vendidoEm: new Date().toISOString() });

  /* mover lead para pós-venda */
  if (typeof leadMoveStage === 'function') leadMoveStage(prop.leadId, 'posvenda');

  document.getElementById('vendaModal').style.display = 'none';
  initPropostas();
  if (typeof showToast === 'function') showToast(`Venda realizada! Cota ${numStr} (Grupo ${grupo}) marcada como vendida ✓`);
}

function _propExcluir(id) {
  if (!confirm('Excluir esta proposta?')) return;
  propDelete(id);
  initPropostas();
}
