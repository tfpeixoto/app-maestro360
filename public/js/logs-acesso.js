/* =====================================================================
   Logs de Acesso — página privilegiada para junior@waycapital.com
   Exibe todos os dados coletados em cada tentativa de login:
   IP, localização, GPS, OS, navegador, status, ISP, etc.
   ===================================================================== */

let _logsData = [];
let _logsPage = 1;
const _logsPerPage = 50;

async function initLogsAcesso() {
  const container = document.getElementById('page-logs-acesso');
  if (!container) return;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title"><i class="bi bi-shield-lock-fill" style="color:#ef4444;margin-right:8px"></i>Logs de Acesso</div>
        <div class="page-subtitle">Registro de todas as tentativas de login — IP, localização, dispositivo, status</div>
      </div>
      <button class="btn btn-outline" onclick="initLogsAcesso()"><i class="bi bi-arrow-clockwise"></i> Atualizar</button>
    </div>

    <!-- Filtros -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;align-items:flex-end">
      <div>
        <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Status</label>
        <select id="logsFilterStatus" onchange="_logsCarregar()"
                style="padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:white;color:var(--primary);outline:none">
          <option value="">Todos</option>
          <option value="sucesso">Sucesso</option>
          <option value="falha_senha">Falha de senha</option>
          <option value="bloqueado_geo">Bloqueado (geo)</option>
        </select>
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Período</label>
        <select id="logsFilterDays" onchange="_logsCarregar()"
                style="padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:white;color:var(--primary);outline:none">
          <option value="">Todo o histórico</option>
          <option value="1">Últimas 24h</option>
          <option value="7" selected>Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
        </select>
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">E-mail / usuário</label>
        <input id="logsFilterUser" placeholder="Buscar por e-mail…" oninput="_logsDebounce()"
               style="padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;outline:none;width:200px"
               onfocus="this.style.borderColor='var(--accent)'"
               onblur="this.style.borderColor='var(--border)'" />
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">IP</label>
        <input id="logsFilterIP" placeholder="Filtrar por IP…" oninput="_logsDebounce()"
               style="padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;outline:none;width:160px"
               onfocus="this.style.borderColor='var(--accent)'"
               onblur="this.style.borderColor='var(--border)'" />
      </div>
      <div style="font-size:12px;color:var(--muted);align-self:center" id="logsTotalLabel"></div>
    </div>

    <!-- Tabela -->
    <div style="background:white;border:1px solid var(--border);border-radius:12px;overflow:hidden">
      <div id="logsTableWrap" style="overflow-x:auto">
        <div style="padding:40px;text-align:center;color:var(--muted)">
          <div class="spinner" style="width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 12px"></div>
          Carregando logs…
        </div>
      </div>
    </div>
  `;

  _logsCarregar();
}

let _logsDebounceTimer = null;
function _logsDebounce() {
  clearTimeout(_logsDebounceTimer);
  _logsDebounceTimer = setTimeout(_logsCarregar, 400);
}

async function _logsCarregar() {
  const wrap = document.getElementById('logsTableWrap');
  if (!wrap) return;

  const status = document.getElementById('logsFilterStatus')?.value || '';
  const days   = document.getElementById('logsFilterDays')?.value   || '';
  const user   = document.getElementById('logsFilterUser')?.value   || '';
  const ip     = document.getElementById('logsFilterIP')?.value     || '';

  wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--muted)"><div class="spinner" style="width:24px;height:24px;border:3px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 10px"></div>Carregando…</div>`;

  const params = new URLSearchParams({ limit: 200 });
  if (status) params.set('status', status);
  if (days)   params.set('days',   days);
  if (user)   params.set('user',   user);
  if (ip)     params.set('ip',     ip);

  const auth = JSON.parse(localStorage.getItem('crm_auth') || '{}');
  try {
    const res  = await fetch('/api/auth/audit?' + params.toString(), {
      headers: { Authorization: 'Bearer ' + (auth.token || '') },
    });

    if (res.status === 403) {
      wrap.innerHTML = `<div style="padding:40px;text-align:center;color:#ef4444"><i class="bi bi-shield-x" style="font-size:40px;display:block;margin-bottom:12px;opacity:.5"></i>Acesso negado. Esta página é restrita.</div>`;
      return;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const { logs, total } = await res.json();
    _logsData = logs;

    const totalEl = document.getElementById('logsTotalLabel');
    if (totalEl) totalEl.textContent = `${total} registro${total !== 1 ? 's' : ''}`;

    if (!logs.length) {
      wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--muted)"><i class="bi bi-inbox" style="font-size:36px;display:block;margin-bottom:8px;opacity:.3"></i>Nenhum log encontrado.</div>`;
      return;
    }

    wrap.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#f8fafc;border-bottom:2px solid var(--border)">
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap">Data/Hora</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px">Status</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px">E-mail</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px">IP</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px">Localização</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px">GPS</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px">Dispositivo</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px">ISP</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px">Detalhe</th>
          </tr>
        </thead>
        <tbody id="logsTableBody">
          ${logs.map(_logsRenderRow).join('')}
        </tbody>
      </table>`;

  } catch (e) {
    wrap.innerHTML = `<div style="padding:32px;text-align:center;color:#ef4444;font-size:13px"><i class="bi bi-exclamation-triangle-fill"></i> Erro ao carregar: ${e.message}</div>`;
  }
}

function _logsRenderRow(log) {
  const statusMap = {
    sucesso:       { label: 'Sucesso',      bg: '#dcfce7', color: '#16a34a' },
    falha_senha:   { label: 'Falha senha',  bg: '#fef3c7', color: '#d97706' },
    bloqueado_geo: { label: 'Bloq. Geo',    bg: '#fee2e2', color: '#dc2626' },
  };
  const s = statusMap[log.status] || { label: log.status, bg: '#f1f5f9', color: '#64748b' };

  const dt = log.timestamp_utc ? new Date(log.timestamp_utc).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }) : '—';

  const locIP = [log.cidade, log.estado, log.pais].filter(Boolean).join(', ') || '—';
  const gps = (log.lat_gps != null && log.lon_gps != null)
    ? `${parseFloat(log.lat_gps).toFixed(4)}, ${parseFloat(log.lon_gps).toFixed(4)}`
    : '—';
  const dispositivo = [log.os, log.navegador].filter(Boolean).join(' · ') || '—';

  return `
    <tr style="border-bottom:1px solid var(--border);transition:background .12s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
      <td style="padding:9px 14px;white-space:nowrap;color:var(--muted)">${dt}</td>
      <td style="padding:9px 14px">
        <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${s.bg};color:${s.color}">${s.label}</span>
      </td>
      <td style="padding:9px 14px;color:var(--primary);font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(log.username_digitado||'')}">
        ${_esc(log.username_digitado || '—')}
      </td>
      <td style="padding:9px 14px;font-family:monospace;font-size:11px;color:var(--muted)">${_esc(String(log.ip || '—'))}</td>
      <td style="padding:9px 14px;font-size:11px;color:var(--primary)">${_esc(locIP)}</td>
      <td style="padding:9px 14px;font-size:11px;font-family:monospace;color:var(--muted)">
        ${gps !== '—' ? `<a href="https://www.google.com/maps?q=${log.lat_gps},${log.lon_gps}" target="_blank" style="color:var(--accent);text-decoration:none;font-size:11px" title="Abrir no Maps">${gps} <i class="bi bi-box-arrow-up-right" style="font-size:10px"></i></a>` : '—'}
      </td>
      <td style="padding:9px 14px;font-size:11px;color:var(--muted)">${_esc(dispositivo)}</td>
      <td style="padding:9px 14px;font-size:11px;color:var(--muted);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(log.isp||'')}">
        ${_esc(log.isp || '—')}
      </td>
      <td style="padding:9px 14px;font-size:11px;color:var(--muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(log.detalhe||'')}">
        ${_esc(log.detalhe || '')}
      </td>
    </tr>`;
}

function _esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
