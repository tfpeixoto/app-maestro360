/* =====================================================================
   FUNIL — Data Layer (localStorage)
   ===================================================================== */
const STAGES = [
  { id: 'inicio',   label: 'Início',       cor: '#94a3b8' },
  { id: 'lead',     label: 'Lead',         cor: '#3b82f6' },
  { id: 'quali',    label: 'Qualificação', cor: '#f59e0b' },
  { id: 'sim',      label: 'Simulação',    cor: '#8b5cf6' },
  { id: 'proposta', label: 'Proposta',     cor: '#10b981' },
  { id: 'contrato', label: 'Contrato',     cor: '#1a3a5c' },
  { id: 'posvenda', label: 'Pós-venda',    cor: '#64748b' },
];
const ORIGENS  = ['WhatsApp','Instagram','Indicação','Site','Ligação','Outro'];
const OBJETIVOS = ['Comprar Imóvel','Comprar Carro','Ganho Financeiro','Capital de Giro','Outro'];

function _esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function storeGet()       { return JSON.parse(localStorage.getItem('crm_leads') || '[]'); }
function storeSet(leads)  { localStorage.setItem('crm_leads', JSON.stringify(leads)); }
function storeNextId()    { const l = storeGet(); return l.length ? l.reduce((m,x) => x.id > m ? x.id : m, 0)+1 : 1; }

function _genLeadCodigo() {
  const leads = storeGet();
  const nums = leads
    .map(l => l.codigo)
    .filter(c => c && /^CLI-\d+$/.test(c))
    .map(c => parseInt(c.slice(4), 10));
  const max = nums.length ? Math.max(...nums) : 0;
  return 'CLI-' + String(max + 1).padStart(4, '0');
}

function _genSimCodigo() {
  const leads = storeGet();
  const allSims = leads.flatMap(l => l.simulacoes || []);
  const nums = allSims
    .map(s => s.codigo)
    .filter(c => c && /^COT-\d+$/.test(c))
    .map(c => parseInt(c.slice(4), 10));
  const max = nums.length ? Math.max(...nums) : 0;
  return 'COT-' + String(max + 1).padStart(4, '0');
}

function leadCreate(data) {
  const leads = storeGet();
  const novo = {
    id: storeNextId(), nome: data.nome||'', telefone: data.telefone||'', email: data.email||'',
    cpf: data.cpf||'', codigo: _genLeadCodigo(),
    origem: data.origem||'Outro', objetivo: data.objetivo||'', valorDesejado: data.valorDesejado||0,
    aporteMensal: data.aporteMensal||0, stage: data.stage||'lead', funnel: data.funnel||'vendas',
    obs: data.obs||'',
    criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString(),
    historico: [{ texto: 'Lead criado', data: new Date().toISOString() }],
  };
  leads.push(novo); storeSet(leads); return novo;
}

function leadUpdate(id, patch) {
  const leads = storeGet(); const idx = leads.findIndex(l=>l.id===id);
  if (idx===-1) return null;
  Object.assign(leads[idx], patch, { atualizadoEm: new Date().toISOString() });
  storeSet(leads); return leads[idx];
}

function leadMoveStage(id, novoStage) {
  const leads = storeGet(); const lead = leads.find(l=>l.id===id); if (!lead) return;
  const all = getAllStages();
  const ant = all.find(s=>s.id===lead.stage)?.label||lead.stage;
  const nov = all.find(s=>s.id===novoStage)?.label||novoStage;
  lead.stage = novoStage; lead.atualizadoEm = new Date().toISOString();
  lead.historico = lead.historico||[];
  lead.historico.unshift({ texto: `Movido de "${ant}" para "${nov}"`, data: new Date().toISOString() });
  storeSet(leads); return lead;
}

function leadAddHistorico(id, texto) {
  const leads = storeGet(); const lead = leads.find(l=>l.id===id); if (!lead) return;
  lead.historico = lead.historico||[];
  lead.historico.unshift({ texto, data: new Date().toISOString() });
  lead.atualizadoEm = new Date().toISOString(); storeSet(leads);
}

function leadAddNota(id, texto) {
  const leads = storeGet();
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  lead.notas = lead.notas || [];
  lead.notas.unshift({ id: Date.now(), texto, criadoEm: new Date().toISOString() });
  lead.atualizadoEm = new Date().toISOString();
  storeSet(leads);
  return lead;
}

function _normPhone(s) { return (s || '').replace(/\D/g, ''); }
function _normCpf(s)   { return (s || '').replace(/\D/g, ''); }

function leadDedup(nome, telefone, email, cpf) {
  const leads = storeGet();
  const tel = _normPhone(telefone);
  const cpfN = _normCpf(cpf);
  return leads.find(l => {
    if (cpfN && cpfN.length >= 11 && _normCpf(l.cpf) === cpfN) return true;
    if (tel  && tel.length  >= 8  && _normPhone(l.telefone) === tel)  return true;
    if (email && l.email && l.email.toLowerCase().trim() === email.toLowerCase().trim()) return true;
    return false;
  }) || null;
}

function leadMerge(existingId, patch) {
  const leads = storeGet();
  const idx = leads.findIndex(l => String(l.id) === String(existingId));
  if (idx < 0) return null;
  const existing = leads[idx];
  if (!existing.telefone && patch.telefone) existing.telefone = patch.telefone;
  if (!existing.email    && patch.email)    existing.email    = patch.email;
  if (!existing.cpf      && patch.cpf)      existing.cpf      = patch.cpf;
  if (!existing.valorDesejado && patch.valorDesejado) existing.valorDesejado = patch.valorDesejado;
  if (!existing.obs && patch.obs) existing.obs = patch.obs;
  if (patch.simulacoes && patch.simulacoes.length > 0) {
    if (!existing.simulacoes) existing.simulacoes = [];
    existing.simulacoes.push(...patch.simulacoes.map(s => ({
      ...s, id: 'sim_' + Date.now() + Math.random().toString(36).slice(2,5)
    })));
  }
  existing.historico = existing.historico || [];
  existing.historico.unshift({ texto: 'Dados mesclados (duplicata detectada)', data: new Date().toISOString() });
  existing.atualizadoEm = new Date().toISOString();
  leads[idx] = existing;
  storeSet(leads);
  return existing;
}

function leadDelete(id) { storeSet(storeGet().filter(l=>l.id!==id)); }
function leadsByStage(stage) { return storeGet().filter(l=>l.stage===stage); }

/* =====================================================================
   MULTI-FUNNEL SUPPORT
   ===================================================================== */

// DEFAULT_FUNNELS seed – used to initialize crm_funnels in localStorage
const DEFAULT_FUNNELS = [
  {
    id: 'vendas', label: 'Funil de Vendas', cor: '#1a3a5c',
    stages: [
      { id: 'inicio',   label: 'Início',       cor: '#94a3b8' },
      { id: 'lead',     label: 'Lead',         cor: '#3b82f6' },
      { id: 'quali',    label: 'Qualificação', cor: '#f59e0b' },
      { id: 'sim',      label: 'Simulação',    cor: '#8b5cf6' },
      { id: 'proposta', label: 'Proposta',     cor: '#10b981' },
      { id: 'contrato', label: 'Contrato',     cor: '#1a3a5c' },
      { id: 'posvenda', label: 'Pós-venda',    cor: '#64748b' },
    ]
  },
  {
    id: 'wpp', label: 'WhatsApp', cor: '#25d366',
    stages: [
      { id: 'wpp_novo',       label: 'Novo',       cor: '#25d366' },
      { id: 'wpp_trabalhado', label: 'Trabalhado', cor: '#f59e0b' },
      { id: 'wpp_cliente',    label: 'Cliente',    cor: '#1a3a5c' },
    ]
  },
  {
    id: 'simulador', label: 'Funil Simulador', cor: '#8b5cf6',
    stages: [
      { id: 'sim_novo',        label: 'Simulado',   cor: '#8b5cf6' },
      { id: 'sim_qualificado', label: 'Qualificado', cor: '#3b82f6' },
      { id: 'sim_proposta',    label: 'Proposta',   cor: '#10b981' },
    ]
  }
];

function funnelsGet() {
  try {
    const s = localStorage.getItem('crm_funnels');
    if (s) {
      const funnels = JSON.parse(s);
      // migrate: ensure built-in funnels added after initial seed exist
      let dirty = false;
      for (const def of DEFAULT_FUNNELS) {
        if (!funnels.find(f => f.id === def.id)) {
          funnels.push(JSON.parse(JSON.stringify(def)));
          dirty = true;
        }
      }
      if (dirty) localStorage.setItem('crm_funnels', JSON.stringify(funnels));
      return funnels;
    }
  } catch {}
  const seed = JSON.parse(JSON.stringify(DEFAULT_FUNNELS));
  localStorage.setItem('crm_funnels', JSON.stringify(seed));
  return seed;
}
function funnelsSet(f) { localStorage.setItem('crm_funnels', JSON.stringify(f)); }

function funnelCreate(data) {
  const funnels = funnelsGet();
  const nf = { id: 'fn_'+Date.now(), label: data.label||'Novo Funil', cor: data.cor||'#1a3a5c', stages: [] };
  funnels.push(nf); funnelsSet(funnels); return nf;
}
function funnelUpdate(id, patch) {
  const funnels = funnelsGet(); const idx = funnels.findIndex(f=>f.id===id); if(idx===-1) return;
  Object.assign(funnels[idx], patch); funnelsSet(funnels); return funnels[idx];
}
function funnelDelete(id) {
  const funnels = funnelsGet().filter(f=>f.id!==id); funnelsSet(funnels);
}
function funnelAddStage(funnelId, label, cor) {
  const funnels = funnelsGet(); const f = funnels.find(f=>f.id===funnelId); if(!f) return;
  const sid = funnelId+'_'+Date.now();
  f.stages.push({id:sid, label, cor: cor||'#94a3b8'}); funnelsSet(funnels); return f;
}
function funnelUpdateStage(funnelId, stageId, patch) {
  const funnels = funnelsGet(); const f = funnels.find(f=>f.id===funnelId); if(!f) return;
  const s = f.stages.find(s=>s.id===stageId); if(s) Object.assign(s, patch);
  funnelsSet(funnels); return f;
}
function funnelRemoveStage(funnelId, stageId) {
  const funnels = funnelsGet(); const f = funnels.find(fn=>fn.id===funnelId); if(!f) return;
  f.stages = f.stages.filter(s=>s.id!==stageId); funnelsSet(funnels); return f;
}
function getAllStages() { return funnelsGet().flatMap(f=>f.stages); }
function getStageLabel(stageId) {
  for (const f of funnelsGet()) { const s=f.stages.find(s=>s.id===stageId); if(s) return s.label; }
  return stageId;
}
function leadsByFunnel(funnelId) { return storeGet().filter(l=>(l.funnel||'vendas')===funnelId); }

// Migra leads sem campo funnel: detecta pelo estágio a qual funil pertence
function migrateFunnelField() {
  const leads = storeGet();
  const funnels = funnelsGet();
  // Mapa stageId → funnelId
  const stageToFunnel = {};
  for (const f of funnels) for (const s of (f.stages||[])) stageToFunnel[s.id] = f.id;
  let changed = false;
  for (const l of leads) {
    if (!l.funnel) {
      l.funnel = stageToFunnel[l.stage] || 'vendas';
      changed = true;
    }
  }
  if (changed) storeSet(leads);
}

function leadAddTag(id, label, cor) {
  const leads = storeGet();
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  lead.tags = lead.tags || [];
  lead.tags.push({ label, cor });
  lead.atualizadoEm = new Date().toISOString();
  storeSet(leads);
  return lead;
}

function leadRemoveTag(id, tagIdx) {
  const leads = storeGet();
  const lead = leads.find(l => l.id === id);
  if (!lead || !lead.tags) return;
  lead.tags.splice(tagIdx, 1);
  lead.atualizadoEm = new Date().toISOString();
  storeSet(leads);
  return lead;
}

function leadRemoveNota(leadId, notaId) {
  const leads = storeGet();
  const lead = leads.find(l => l.id === leadId);
  if (!lead || !lead.notas) return;
  lead.notas = lead.notas.filter(n => n.id !== notaId);
  lead.atualizadoEm = new Date().toISOString();
  storeSet(leads);
  return lead;
}

function leadAddConversaSalva(id, conversa) {
  const leads = storeGet();
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  lead.conversasSalvas = lead.conversasSalvas || [];
  lead.conversasSalvas.unshift({
    id: Date.now(),
    fonte:      conversa.fonte      || 'WPP',
    chatName:   conversa.chatName   || '',
    mensagens:  conversa.mensagens  || [],
    nota:       conversa.nota       || '',
    criadoEm:   new Date().toISOString(),
  });
  lead.atualizadoEm = new Date().toISOString();
  storeSet(leads);
  return lead;
}

function leadRemoveConversaSalva(leadId, convId) {
  const leads = storeGet();
  const lead = leads.find(l => l.id === leadId);
  if (!lead || !lead.conversasSalvas) return;
  lead.conversasSalvas = lead.conversasSalvas.filter(c => c.id !== convId);
  lead.atualizadoEm = new Date().toISOString();
  storeSet(leads);
  return lead;
}

function fmtData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
}
function fmtValor(v) {
  if (!v||v===0) return '—';
  if (v>=1000000) return 'R$ '+(v/1000000).toFixed(1)+'M';
  if (v>=1000)    return 'R$ '+Math.round(v/1000)+'k';
  return 'R$ '+Number(v).toLocaleString('pt-BR');
}

function seedDemoData() {
  if (storeGet().length > 0) return;
  [
    { nome:'João Silva',   telefone:'(11) 99999-0001', email:'joao@email.com',  origem:'WhatsApp',  objetivo:'Comprar Imóvel',   valorDesejado:500000,  aporteMensal:3000, stage:'lead'     },
    { nome:'Maria Souza',  telefone:'(11) 99999-0002', email:'maria@email.com', origem:'Indicação', objetivo:'Ganho Financeiro', valorDesejado:1000000, aporteMensal:8000, stage:'quali'    },
    { nome:'Carlos Lima',  telefone:'(11) 99999-0003', email:'carlos@email.com',origem:'Instagram', objetivo:'Comprar Imóvel',   valorDesejado:300000,  aporteMensal:2000, stage:'sim'      },
    { nome:'Ana Ferreira', telefone:'(11) 99999-0004', email:'ana@email.com',   origem:'Site',      objetivo:'Comprar Carro',    valorDesejado:80000,   aporteMensal:1200, stage:'proposta' },
    { nome:'Pedro Costa',  telefone:'(11) 99999-0005', email:'pedro@email.com', origem:'Ligação',   objetivo:'Capital de Giro',  valorDesejado:200000,  aporteMensal:2500, stage:'contrato' },
  ].forEach(d => leadCreate(d));
}

/* ── API HELPERS ────────────────────────────────────────────── */
function _apiToken() {
  const auth = JSON.parse(localStorage.getItem('crm_auth') || '{}');
  return auth.token || '';
}

async function _apiFetch(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + _apiToken()
    }
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch((window.GENESIS_API_BASE || '/api') + path, opts);
  if (!r.ok) throw new Error(await r.text());
  if (r.status === 204) return null;
  return r.json();
}

function simApiBoard(funilId)           { return _apiFetch('GET',    '/funil/board/' + funilId); }
function simApiGet(id)                  { return _apiFetch('GET',    '/funil/sim/'   + id); }
function simApiPatch(id, patch)         { return _apiFetch('PATCH',  '/funil/sim/'   + id, patch); }
function simApiCreate(data)             { return _apiFetch('POST',   '/funil/sim',        data); }
function simApiAddChecklist(simId, txt) { return _apiFetch('POST',   '/funil/sim/' + simId + '/checklist', { texto: txt }); }
function simApiToggleCheck(itemId, val) { return _apiFetch('PATCH',  '/funil/checklist/' + itemId, { feito: val }); }
function simApiDelCheck(itemId)         { return _apiFetch('DELETE', '/funil/checklist/' + itemId); }
function simApiAddAnotacao(simId, txt)  { return _apiFetch('POST',   '/funil/sim/' + simId + '/anotacoes', { texto: txt }); }
function simApiDelAnotacao(id)          { return _apiFetch('DELETE', '/funil/anotacoes/' + id); }
function simApiLeadPerfil(leadId)       { return _apiFetch('GET',    '/funil/leads/' + leadId + '/perfil'); }
function simApiEtapas()                { return _apiFetch('GET',    '/funil/etapas'); }
