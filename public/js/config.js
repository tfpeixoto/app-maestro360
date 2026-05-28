/* =====================================================================
   CONFIGURAÇÕES — Parâmetros do sistema Gênesis
   Persiste em localStorage: crm_config
   ===================================================================== */

const CFG_KEY = 'crm_config';

function cfgGet() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch { return {}; }
}

function cfgSave(patch) {
  localStorage.setItem(CFG_KEY, JSON.stringify({ ...cfgGet(), ...patch }));
}

let _cfgTab = 'empresa';

function initConfig() {
  const el = document.getElementById('page-config');
  if (!el) return;
  el.innerHTML = _cfgRender();
}

function _cfgRender() {
  const c = cfgGet();
  const tabs = [
    ['empresa',     'bi-building',       'Empresa'],
    ['integracoes', 'bi-plug-fill',      'Integrações'],
    ['crm',         'bi-funnel-fill',    'CRM'],
    ['dados',       'bi-database-fill',  'Dados'],
    ['seguranca',   'bi-shield-lock-fill', 'Segurança'],
  ];
  return `
    <div class="page-header">
      <div><div class="page-title">Configurações</div><div class="page-subtitle">Parâmetros do sistema Gênesis</div></div>
    </div>

    <div style="display:flex;border-bottom:2px solid var(--border);margin-bottom:22px">
      ${tabs.map(([id, icon, label]) => `
        <button onclick="_cfgTab='${id}';initConfig()"
          style="background:none;border:none;border-bottom:3px solid ${_cfgTab===id?'var(--primary)':'transparent'};padding:10px 18px;font-size:13px;font-weight:700;color:${_cfgTab===id?'var(--primary)':'var(--muted)'};cursor:pointer;display:flex;align-items:center;gap:6px;margin-bottom:-2px;transition:color .15s">
          <i class="bi ${icon}"></i> ${label}
        </button>`).join('')}
    </div>

    ${_cfgTab === 'empresa'     ? _cfgPanelEmpresa(c)     : ''}
    ${_cfgTab === 'integracoes' ? _cfgPanelIntegracoes(c)  : ''}
    ${_cfgTab === 'crm'         ? _cfgPanelCRM()           : ''}
    ${_cfgTab === 'dados'       ? _cfgPanelDados()         : ''}
    ${_cfgTab === 'seguranca'   ? _cfgPanelSeguranca(c)    : ''}

    <div id="cfgToastEl" style="display:none;position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1f2937;color:white;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:3000"></div>
  `;
}

/* ── Empresa ── */
function _cfgPanelEmpresa(c) {
  const f = (id, label, val, placeholder, full) => `
    <div ${full ? 'style="grid-column:1/-1"' : ''}>
      <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">${label}</label>
      <input class="form-input" id="${id}" value="${_esc(val||'')}" placeholder="${placeholder}" style="width:100%" />
    </div>`;
  return `
    <div class="card" style="max-width:620px">
      <div style="font-size:13px;font-weight:800;color:var(--primary);margin-bottom:16px"><i class="bi bi-building"></i> Dados da Empresa</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        ${f('cfgNomeEmpresa', 'Nome da Empresa',  c.nomeEmpresa, '[Nome da Empresa]', false)}
        ${f('cfgCNPJ',        'CNPJ',              c.cnpj,        '00.000.000/0001-00',    false)}
        ${f('cfgTelefone',    'Telefone',          c.telefone,    '(11) 99999-9999',       false)}
        ${f('cfgEmailEmp',    'E-mail',            c.emailEmp,    'contato@empresa.com',   false)}
        ${f('cfgSite',        'Site',              c.site,        'https://empresa.com.br', true)}
        ${f('cfgEndereco',    'Endereço',          c.endereco,    'Rua, número — Cidade/UF', true)}
      </div>
      <button class="btn btn-primary" style="margin-top:18px" onclick="_cfgSalvarEmpresa()">
        <i class="bi bi-check-lg"></i> Salvar dados da empresa
      </button>
    </div>`;
}

function _cfgSalvarEmpresa() {
  cfgSave({
    nomeEmpresa: document.getElementById('cfgNomeEmpresa')?.value || '',
    cnpj:        document.getElementById('cfgCNPJ')?.value        || '',
    telefone:    document.getElementById('cfgTelefone')?.value    || '',
    emailEmp:    document.getElementById('cfgEmailEmp')?.value    || '',
    site:        document.getElementById('cfgSite')?.value        || '',
    endereco:    document.getElementById('cfgEndereco')?.value    || '',
  });
  _cfgToast('Dados da empresa salvos!');
}

/* ── Integrações ── */
function _cfgPanelIntegracoes(c) {
  const gOk = typeof gauthIsConnected === 'function' && gauthIsConnected();
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;max-width:900px">

      <!-- Google -->
      <div class="card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <i class="bi bi-google" style="font-size:22px;color:${gOk?'#34a853':'#ea4335'}"></i>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:800">Google Services</div>
            <div style="font-size:11px;color:var(--muted)">Calendar · Drive · Gmail · Meet</div>
          </div>
          <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;background:${gOk?'#dcfce7':'#fee2e2'};color:${gOk?'#16a34a':'#ef4444'}">
            ${gOk ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">Google OAuth Client ID</label>
          <input class="form-input" id="cfgGoogleClientId" value="${_esc(c.googleClientId||'')}"
            placeholder="xxxx.apps.googleusercontent.com" style="width:100%;font-size:11px;font-family:monospace" />
          <div style="font-size:10px;color:var(--muted);margin-top:4px">
            Configure em <strong>console.cloud.google.com → APIs → Credenciais</strong>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="_cfgSalvarGoogle()"><i class="bi bi-save"></i> Salvar Client ID</button>
          ${gOk
            ? `<button class="btn btn-ghost btn-sm" onclick="gauthRevoke();initConfig()"><i class="bi bi-box-arrow-right"></i> Desconectar</button>`
            : `<button class="btn btn-primary btn-sm" onclick="gauthSignIn().then(()=>initConfig())"><i class="bi bi-google"></i> Conectar agora</button>`}
        </div>
      </div>

      <!-- WhatsApp -->
      <div class="card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <i class="bi bi-whatsapp" style="font-size:22px;color:#25d366"></i>
          <div>
            <div style="font-size:13px;font-weight:800">WhatsApp Web</div>
            <div style="font-size:11px;color:var(--muted)">Servidor Node.js via PM2</div>
          </div>
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px">URL do Servidor WPP</label>
          <input class="form-input" id="cfgWppUrl" value="${_esc(c.wppUrl||'/wpp')}"
            style="width:100%;font-size:11px;font-family:monospace" />
          <div style="font-size:10px;color:var(--muted);margin-top:4px">Padrão em produção: <code>/wpp</code> (proxy NGINX)</div>
        </div>
        <div style="background:#f0fdf4;border-radius:8px;padding:10px;font-size:11px;color:#166534;font-family:monospace;margin-bottom:12px;line-height:1.7">
          pm2 start index.js --name maestro-wpp<br>pm2 save
        </div>
        <button class="btn btn-outline btn-sm" onclick="_cfgSalvarWpp()"><i class="bi bi-save"></i> Salvar URL</button>
      </div>

      <!-- Notificações -->
      <div class="card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <i class="bi bi-bell-fill" style="font-size:22px;color:${(()=>{ const s=ntfStatus(); return s==='granted'?'#16a34a':s==='denied'?'#ef4444':'#d97706'; })()}"></i>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:800">Notificações de Reunião</div>
            <div style="font-size:11px;color:var(--muted)">Alertas 60min, 15min e 5min antes</div>
          </div>
          <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;background:${(()=>{ const s=ntfStatus(); return s==='granted'?'#dcfce7':s==='denied'?'#fee2e2':'#fef3c7'; })()};color:${(()=>{ const s=ntfStatus(); return s==='granted'?'#16a34a':s==='denied'?'#ef4444':'#92400e'; })()}">
            ${(()=>{ const s=ntfStatus(); return s==='granted'?'Ativo':s==='denied'?'Bloqueado':'Pendente'; })()}
          </span>
        </div>
        ${(()=>{
          const s = ntfStatus();
          if (s === 'unsupported') return `<div style="font-size:12px;color:var(--muted)">Seu browser não suporta notificações.</div>`;
          if (s === 'denied')      return `<div style="font-size:12px;color:#ef4444">Notificações bloqueadas. Libere em <strong>Configurações do browser → Notificações</strong> para este site.</div>`;
          if (s === 'granted')     return `<div style="font-size:12px;color:#166534">Notificações ativas. Você receberá alertas antes das suas reuniões.</div>`;
          return `<button class="btn btn-primary btn-sm" onclick="ntfSolicitarPermissao().then(()=>initConfig())"><i class="bi bi-bell"></i> Ativar notificações</button>`;
        })()}
      </div>

    </div>`;
}

function _cfgSalvarGoogle() {
  cfgSave({ googleClientId: document.getElementById('cfgGoogleClientId')?.value || '' });
  _cfgToast('Client ID salvo! Recarregue a página para aplicar.');
}

function _cfgSalvarWpp() {
  cfgSave({ wppUrl: document.getElementById('cfgWppUrl')?.value || '/wpp' });
  _cfgToast('URL do servidor WPP salva!');
}

/* ── CRM ── */
function _cfgPanelCRM() {
  const leads   = storeGet();
  const origens = [...new Set(leads.map(l => l.origem).filter(Boolean))];
  return `
    <div style="max-width:700px;display:grid;gap:16px">

      <div class="card">
        <div style="font-size:13px;font-weight:800;color:var(--primary);margin-bottom:14px"><i class="bi bi-funnel-fill"></i> Estágios do Funil</div>
        <div style="display:grid;gap:8px">
          ${STAGES.map(s => `
            <div style="display:flex;align-items:center;gap:12px;padding:9px 12px;background:${s.cor}15;border-radius:8px;border-left:4px solid ${s.cor}">
              <div style="width:8px;height:8px;background:${s.cor};border-radius:50%;flex-shrink:0"></div>
              <span style="font-size:13px;font-weight:700;flex:1;color:var(--primary)">${s.label}</span>
              <span style="font-size:11px;color:var(--muted)">${leads.filter(l=>l.stage===s.id).length} leads</span>
            </div>`).join('')}
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:10px">
          <i class="bi bi-info-circle"></i> Estágios definidos em <code>public/js/funil-data.js</code>
        </div>
      </div>

      <div class="card">
        <div style="font-size:13px;font-weight:800;color:var(--primary);margin-bottom:14px"><i class="bi bi-tags-fill"></i> Origens de Leads</div>
        ${origens.length === 0
          ? `<div style="font-size:12px;color:var(--muted)">Nenhuma origem cadastrada ainda.</div>`
          : `<div style="display:flex;gap:6px;flex-wrap:wrap">
              ${origens.map(o => `<span style="background:var(--primary-pale);color:var(--primary);padding:4px 10px;border-radius:8px;font-size:12px;font-weight:700">${_esc(o)}</span>`).join('')}
             </div>`}
        <div style="font-size:11px;color:var(--muted);margin-top:10px">
          <i class="bi bi-info-circle"></i> Origens capturadas automaticamente ao cadastrar leads
        </div>
      </div>

    </div>`;
}

/* ── Dados ── */
function _cfgPanelDados() {
  const leads      = storeGet();
  const reunioes   = rnGet();
  const totalBytes = Object.keys(localStorage).reduce((s, k) => s + (localStorage.getItem(k)||'').length, 0);

  return `
    <div style="max-width:620px;display:grid;gap:16px">

      <div class="card">
        <div style="font-size:13px;font-weight:800;color:var(--primary);margin-bottom:14px"><i class="bi bi-database-fill"></i> Resumo dos Dados</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
          ${[
            ['Leads',      leads.length,              'bi-people-fill'],
            ['Reuniões',   reunioes.length,            'bi-calendar-check-fill'],
            ['Armazenado', Math.round(totalBytes/1024) + ' KB', 'bi-hdd-fill'],
          ].map(([l, v, i]) => `
            <div style="text-align:center;padding:14px;background:var(--bg);border-radius:10px">
              <i class="bi ${i}" style="font-size:20px;color:var(--primary);display:block;margin-bottom:6px"></i>
              <div style="font-size:18px;font-weight:900;color:var(--primary)">${v}</div>
              <div style="font-size:11px;color:var(--muted)">${l}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div style="font-size:13px;font-weight:800;color:var(--primary);margin-bottom:14px"><i class="bi bi-arrow-down-up"></i> Exportar / Importar</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
          <button class="btn btn-outline btn-sm" onclick="_cfgExportarDados()">
            <i class="bi bi-download"></i> Exportar Backup JSON
          </button>
          <label class="btn btn-ghost btn-sm" style="cursor:pointer">
            <i class="bi bi-upload"></i> Importar Backup
            <input type="file" accept=".json" style="display:none" onchange="_cfgImportarDados(event)" />
          </label>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:6px">O backup inclui leads, reuniões, metas, funis, cotas e configurações.</div>
        ${(()=>{ const ts = localStorage.getItem('crm_last_backup'); return ts ? `<div style="font-size:11px;color:#16a34a"><i class="bi bi-check-circle-fill"></i> Último backup: ${new Date(ts).toLocaleString('pt-BR')}</div>` : `<div style="font-size:11px;color:#d97706"><i class="bi bi-exclamation-circle"></i> Nenhum backup exportado ainda.</div>`; })()}
      </div>

      <div class="card" style="border:1.5px solid #fecaca">
        <div style="font-size:13px;font-weight:800;color:#ef4444;margin-bottom:12px"><i class="bi bi-exclamation-triangle-fill"></i> Zona de Perigo</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
          <button class="btn btn-sm" style="background:#fee2e2;color:#ef4444;border:1px solid #fecaca" onclick="_cfgLimparLeads()">
            <i class="bi bi-person-x-fill"></i> Limpar Leads
          </button>
          <button class="btn btn-sm" style="background:#fee2e2;color:#ef4444;border:1px solid #fecaca" onclick="_cfgLimparTudo()">
            <i class="bi bi-trash3-fill"></i> Apagar Todos os Dados
          </button>
        </div>
        <div style="font-size:11px;color:#ef4444"><i class="bi bi-exclamation-circle"></i> Ação irreversível — exporte um backup antes.</div>
      </div>

    </div>`;
}

const _BACKUP_KEYS = [
  'crm_leads', 'crm_funnels', 'crm_reunioes', 'crm_metas', 'crm_metas_history',
  'crm_config', 'crm_wpp_links', 'crm_cotas', 'crm_sim_result',
  'crm_parcelas', 'crm_propostas', 'crm_contratos', 'crm_assembleias',
  'crm_lances', 'crm_equipe',
];

function _cfgExportarDados() {
  const backup = { _version: 1, _exportedAt: new Date().toISOString(), _app: 'genesis' };
  _BACKUP_KEYS.forEach(k => {
    try { const v = localStorage.getItem(k); if (v) backup[k] = JSON.parse(v); } catch {}
  });
  const leads = backup.crm_leads?.length ?? 0;
  backup._meta = { leads, exportedAt: backup._exportedAt };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `genesis-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();

  localStorage.setItem('crm_last_backup', new Date().toISOString());
  _cfgToast(`Backup exportado — ${leads} lead(s)`);
  initConfig();
}

function _cfgImportarDados(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const backup = JSON.parse(e.target.result);

      // Validação básica
      if (backup._app !== 'genesis' || !backup._version) {
        alert('Arquivo inválido — não é um backup do Gênesis.');
        return;
      }

      const leads    = backup.crm_leads?.length ?? 0;
      const dateStr  = backup._exportedAt ? new Date(backup._exportedAt).toLocaleString('pt-BR') : '?';
      const chaves   = Object.keys(backup).filter(k => !k.startsWith('_')).length;

      if (!confirm(`Importar backup de ${dateStr}?\n\n• ${leads} leads\n• ${chaves} conjunto(s) de dados\n\nOs dados atuais serão substituídos.`)) return;

      Object.entries(backup).forEach(([k, v]) => {
        if (!k.startsWith('_')) localStorage.setItem(k, JSON.stringify(v));
      });

      _cfgToast('Backup importado! Recarregue a página para aplicar.');
    } catch {
      alert('Arquivo inválido ou corrompido.');
    }
  };
  reader.readAsText(file);
}

function _cfgLimparLeads() {
  if (!confirm('Limpar TODOS os leads? Esta ação é irreversível.')) return;
  localStorage.removeItem('crm_leads');
  _cfgToast('Leads removidos.');
  initConfig();
}

function _cfgLimparTudo() {
  if (!confirm('Apagar TODOS os dados? Isso remove leads, reuniões, metas e configurações.')) return;
  if (!confirm('Confirme novamente: todos os dados serão apagados permanentemente.')) return;
  ['crm_leads','crm_reunioes','crm_metas','crm_metas_history','crm_config','crm_wpp_links',
   'crm_parcelas','crm_propostas','crm_contratos','crm_assembleias','crm_lances','crm_equipe'].forEach(k => localStorage.removeItem(k));
  _cfgToast('Dados apagados. Recarregue a página.');
  initConfig();
}

function _cfgToast(msg) {
  const t = document.getElementById('cfgToastEl');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._tmr);
  t._tmr = setTimeout(() => { t.style.display = 'none'; }, 2800);
}

/* ── Segurança ── */
function _cfgPanelSeguranca(_c) {
  return `
    <div style="max-width:480px;display:grid;gap:16px">
      <div class="card">
        <div style="font-size:13px;font-weight:800;color:var(--primary);margin-bottom:10px">
          <i class="bi bi-shield-lock-fill"></i> Autenticação
        </div>
        <div style="font-size:13px;color:var(--muted);line-height:1.7">
          As credenciais de acesso são gerenciadas pelo servidor de autenticação.<br>
          Para alterar senhas ou criar usuários, entre em contato com o administrador do sistema.
        </div>
      </div>
      <div class="card">
        <div style="font-size:13px;font-weight:800;color:var(--primary);margin-bottom:10px"><i class="bi bi-clock-history"></i> Sessão</div>
        <div style="font-size:12px;color:var(--muted)">As sessões expiram automaticamente após <strong>8 horas</strong>.</div>
      </div>
    </div>`;
}
