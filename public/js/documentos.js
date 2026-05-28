/* =====================================================================
   DOCUMENTOS — Repositório de arquivos por cliente (Google Drive)
   Usa: gauthIsConnected(), gauthGetToken(), driveEnsureClientFolder()
   ===================================================================== */

const DOC = { busca: '', leadSel: null };

function initDocumentos() {
  const el = document.getElementById('page-documentos');
  if (!el) return;
  el.innerHTML = _docRender();
}

function _docRender() {
  if (!gauthIsConnected()) {
    return `
      <div class="page-header">
        <div><div class="page-title">Documentos</div><div class="page-subtitle">Repositório de arquivos por cliente (Google Drive)</div></div>
      </div>
      <div class="card" style="text-align:center;padding:60px 20px;max-width:480px;margin:0 auto">
        <i class="bi bi-google" style="font-size:48px;color:#4285f4;display:block;margin-bottom:16px"></i>
        <div style="font-size:18px;font-weight:800;color:var(--primary);margin-bottom:8px">Conectar Google Drive</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:24px;line-height:1.7">
          Clique em <strong>Conectar Google</strong> na barra superior para vincular sua conta.<br>
          O acesso ao Drive permite organizar documentos por cliente automaticamente.
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;text-align:left;background:var(--bg);border-radius:10px;padding:14px 16px;font-size:12px;color:var(--muted)">
          <div><i class="bi bi-folder2-open" style="color:#4285f4"></i> Pasta <strong>clientes/</strong> criada automaticamente no Drive</div>
          <div><i class="bi bi-person-fill" style="color:#4285f4"></i> Subpasta por cliente ao acessar o perfil</div>
          <div><i class="bi bi-shield-lock-fill" style="color:#34a853"></i> Acesso via OAuth 2.0 — credenciais nunca armazenadas</div>
        </div>
      </div>`;
  }

  const leads = storeGet();
  const comPasta = leads.filter(l => l.driveFolderId);
  const semPasta = leads.filter(l => !l.driveFolderId);

  let filtLista = DOC.busca
    ? comPasta.filter(l => l.nome.toLowerCase().includes(DOC.busca.toLowerCase()))
    : comPasta;

  return `
    <div class="page-header">
      <div><div class="page-title">Documentos</div><div class="page-subtitle">Repositório de arquivos por cliente no Google Drive</div></div>
      <a class="btn btn-outline btn-sm" href="https://drive.google.com" target="_blank"><i class="bi bi-google"></i> Abrir Drive</a>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;margin-bottom:20px">
      ${_docKpi('Clientes',         leads.length,    'bi-people-fill',       'var(--primary)')}
      ${_docKpi('Pastas criadas',   comPasta.length, 'bi-folder-fill',        '#4285f4')}
      ${_docKpi('Sem pasta',        semPasta.length, 'bi-folder-x',           '#d97706')}
    </div>

    <!-- Busca -->
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
      <input class="form-input" placeholder="Buscar cliente..." style="max-width:280px"
        value="${_esc(DOC.busca)}" oninput="DOC.busca=this.value;initDocumentos()" />
      <button class="btn btn-outline btn-sm" onclick="_docCriarTodasPastas()">
        <i class="bi bi-folder-plus"></i> Criar pastas pendentes (${semPasta.length})
      </button>
    </div>

    <!-- Clientes com pasta -->
    ${filtLista.length === 0 && DOC.busca
      ? `<div class="card" style="text-align:center;padding:40px;color:var(--muted)">Nenhum cliente encontrado.</div>`
      : filtLista.length > 0 ? `
        <div style="margin-bottom:20px">
          <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px">Pastas no Drive (${filtLista.length})</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
            ${filtLista.map(l => `
              <div class="card" style="display:flex;align-items:center;gap:12px;padding:14px 16px">
                <i class="bi bi-folder-fill" style="font-size:26px;color:#4285f4;flex-shrink:0"></i>
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(l.nome)}</div>
                  <div style="font-size:11px;color:var(--muted)">${_esc(l.email||l.telefone||'—')}</div>
                </div>
                <a href="${_esc(l.driveFolderUrl||'#')}" target="_blank" class="btn btn-outline btn-sm" style="flex-shrink:0;color:#4285f4;border-color:#4285f4">
                  <i class="bi bi-box-arrow-up-right"></i>
                </a>
              </div>`).join('')}
          </div>
        </div>` : ''}

    <!-- Clientes sem pasta -->
    ${!DOC.busca && semPasta.length > 0 ? `
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px">Sem pasta no Drive (${semPasta.length})</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
          ${semPasta.map(l => `
            <div class="card" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border:1.5px dashed var(--border)">
              <i class="bi bi-folder" style="font-size:26px;color:var(--muted);flex-shrink:0"></i>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(l.nome)}</div>
                <div style="font-size:11px;color:var(--muted)">${_esc(l.email||l.telefone||'—')}</div>
              </div>
              <button class="btn btn-sm" style="background:#eff6ff;color:#4285f4;border:1px solid #bfdbfe;flex-shrink:0" onclick="_docCriarPasta(${l.id},'${_esc(l.nome)}',this)">
                <i class="bi bi-folder-plus"></i>
              </button>
            </div>`).join('')}
        </div>
      </div>` : ''}
  `;
}

function _docKpi(label, val, icon, color) {
  return `<div class="card" style="text-align:center;padding:14px 10px">
    <i class="bi ${icon}" style="font-size:20px;color:${color};display:block;margin-bottom:6px"></i>
    <div style="font-size:16px;font-weight:900;color:var(--primary);margin-bottom:2px">${val}</div>
    <div style="font-size:10px;color:var(--muted);font-weight:600">${label}</div>
  </div>`;
}

async function _docCriarPasta(leadId, leadNome, btn) {
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i>'; }
  try {
    const folder = await driveEnsureClientFolder(leadId, leadNome);
    if (folder) {
      initDocumentos();
    } else {
      alert('Não foi possível criar a pasta. Verifique as permissões do Drive.');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-folder-plus"></i>'; }
    }
  } catch {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-folder-plus"></i>'; }
  }
}

async function _docCriarTodasPastas() {
  const semPasta = storeGet().filter(l => !l.driveFolderId);
  if (semPasta.length === 0) { alert('Todos os clientes já têm pasta no Drive!'); return; }
  if (!confirm(`Criar ${semPasta.length} pasta(s) no Drive? Isso pode demorar alguns segundos.`)) return;
  for (const lead of semPasta) {
    await driveEnsureClientFolder(lead.id, lead.nome);
  }
  initDocumentos();
}
