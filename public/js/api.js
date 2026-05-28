/* =====================================================================
   API Client — Administradora / Bureau de Crédito
   Endpoint base: https://api.themedeploy.com/api/credicob
   ===================================================================== */

const API_BASE = 'https://api.themedeploy.com/api/credicob';

// Credenciais Basic Auth — preencha antes de usar em produção
const API_USER = '';
const API_PASS = '';

// Cache em memória para reduzir requisições repetidas
let _cotasCache = null;
let _cotasCacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function _apiHeaders(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  if (API_USER && API_PASS) {
    h['Authorization'] = 'Basic ' + btoa(API_USER + ':' + API_PASS);
  }
  return h;
}

async function _apiFetch(path = '', options = {}) {
  const url = API_BASE + (path ? '/' + String(path) : '');
  const res = await fetch(url, { ...options, headers: _apiHeaders(options.headers || {}) });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json().catch(() => null);
}

// GET — todos os cotas (com cache de 5 min)
async function fetchCotas(forceRefresh = false) {
  const agora = Date.now();
  if (!forceRefresh && _cotasCache && (agora - _cotasCacheTs) < CACHE_TTL) {
    return _cotasCache;
  }
  _cotasCache = await _apiFetch();
  _cotasCacheTs = agora;
  return _cotasCache;
}

// GET — apenas cotas disponíveis (não reservadas)
async function fetchCotasDisponiveis() {
  const all = await fetchCotas();
  return all.filter(c => !c.reservado);
}

// GET — cotas filtradas por categoria / disponibilidade / busca
async function fetchCotasFiltradas({ categoria, apenasDisponiveis = false, busca = '' } = {}) {
  let cotas = await fetchCotas();
  if (apenasDisponiveis) cotas = cotas.filter(c => !c.reservado);
  if (categoria) cotas = cotas.filter(c => c.categoria === categoria);
  if (busca) {
    const t = busca.toLowerCase();
    cotas = cotas.filter(c =>
      c.cod.toLowerCase().includes(t) ||
      c.categoria.toLowerCase().includes(t) ||
      c.credito.toLowerCase().includes(t) ||
      String(c.grupo).includes(t)
    );
  }
  return cotas;
}

// Marcar cota como vendida na API
// Tenta os padrões REST mais comuns até um funcionar
async function marcarCotaVendida(cod) {
  const codNum = String(cod).replace('#', '');
  const body = JSON.stringify({ cod, reservado: true, status: 'vendida' });

  const tentativas = [
    () => _apiFetch(codNum,   { method: 'PATCH', body }),
    () => _apiFetch(codNum,   { method: 'PUT',   body }),
    () => _apiFetch('',       { method: 'PATCH', body }),
    () => _apiFetch('update', { method: 'POST',  body }),
  ];

  for (const tentativa of tentativas) {
    try {
      const resultado = await tentativa();
      _cotasCache = null; // invalida cache após alteração
      return { ok: true, resultado };
    } catch (_) {
      // tenta próximo padrão
    }
  }

  _cotasCache = null;
  console.warn('[API] Endpoint de atualização não encontrado para cota', cod);
  return { ok: false, erro: 'Endpoint de atualização não encontrado. Verifique api.js.' };
}

// Parsear valor BRL string → número
function parseBRL(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')) || 0;
}

// Formatar número → BRL string
function formatBRL(num) {
  return 'R$ ' + Number(num).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
