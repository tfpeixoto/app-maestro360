/* =====================================================================
   Gênesis — Notificações de reunião
   Verifica reuniões próximas a cada minuto e dispara browser notifications.
   Avisos em: 60 min, 15 min e 5 min antes da reunião.
   ===================================================================== */

const _NTF_AVISOS_MIN  = [60, 15, 5];      // minutos antes para notificar
const _NTF_STORAGE_KEY = 'crm_ntf_sent';   // ids já notificados por janela

let _ntfTimer = null;

/* ── Inicialização ────────────────────────────────────────────────── */
function ntfInit() {
  if (!('Notification' in window)) return; // browser sem suporte

  if (Notification.permission === 'default') {
    // Pede permissão de forma silenciosa na primeira carga
    Notification.requestPermission();
  }

  _ntfTick();
  _ntfTimer = setInterval(_ntfTick, 60 * 1000); // verifica a cada 1 minuto
}

/* ── Tick principal ───────────────────────────────────────────────── */
function _ntfTick() {
  if (Notification.permission !== 'granted') return;

  const agora    = new Date();
  const hojeStr  = agora.toISOString().slice(0, 10);
  const reunioes = (typeof rnGet === 'function' ? rnGet() : [])
    .filter(r => r.data === hojeStr && r.status !== 'cancelada' && r.status !== 'realizada');

  // Recupera chaves já enviadas nesta sessão (evita repetir)
  let enviadas;
  try { enviadas = new Set(JSON.parse(sessionStorage.getItem(_NTF_STORAGE_KEY) || '[]')); }
  catch { enviadas = new Set(); }

  reunioes.forEach(r => {
    const [hh, mm] = (r.hora || '00:00').split(':').map(Number);
    const dtReuniao = new Date(agora);
    dtReuniao.setHours(hh, mm, 0, 0);

    const diffMin = Math.round((dtReuniao - agora) / 60000);

    _NTF_AVISOS_MIN.forEach(aviso => {
      const chave = `${r.id}_${aviso}`;
      if (enviadas.has(chave)) return;

      // Notifica quando diff está dentro de ±1 min da janela de aviso
      if (diffMin >= aviso - 1 && diffMin <= aviso + 1) {
        _ntfDisparar(r, aviso);
        enviadas.add(chave);
      }

      // Notifica reunião que começou agora (diff entre -1 e 1)
      if (aviso === 5 && diffMin >= -1 && diffMin <= 1) {
        const chaveAgora = `${r.id}_agora`;
        if (!enviadas.has(chaveAgora)) {
          _ntfDisparar(r, 0);
          enviadas.add(chaveAgora);
        }
      }
    });
  });

  sessionStorage.setItem(_NTF_STORAGE_KEY, JSON.stringify([...enviadas]));
}

/* ── Dispara uma notificação ──────────────────────────────────────── */
function _ntfDisparar(reuniao, minutosAntes) {
  const tipo  = reuniao.tipo === 'online' ? '🎥 Online' : '📍 Presencial';
  const lead  = reuniao.leadNome ? ` — ${reuniao.leadNome}` : '';

  let titulo, corpo;
  if (minutosAntes === 0) {
    titulo = `⏰ Reunião começando agora!`;
    corpo  = `${reuniao.titulo || 'Reunião'}${lead} · ${tipo}`;
  } else if (minutosAntes <= 5) {
    titulo = `⚡ Reunião em ${minutosAntes} minutos`;
    corpo  = `${reuniao.titulo || 'Reunião'}${lead} · ${tipo} · ${reuniao.hora}`;
  } else if (minutosAntes <= 15) {
    titulo = `🔔 Reunião em ${minutosAntes} minutos`;
    corpo  = `${reuniao.titulo || 'Reunião'}${lead} · ${tipo} · ${reuniao.hora}`;
  } else {
    titulo = `📅 Reunião em 1 hora`;
    corpo  = `${reuniao.titulo || 'Reunião'}${lead} · ${tipo} · ${reuniao.hora}`;
  }

  try {
    const n = new Notification(titulo, {
      body: corpo,
      icon: '/public/img/logo.png',
      tag:  `reuniao-${reuniao.id}-${minutosAntes}`,
    });
    // Clicar na notificação navega para a agenda
    n.onclick = () => {
      window.focus();
      if (typeof navigate === 'function') navigate('agenda');
    };
  } catch (_) { /* silencioso */ }
}

/* ── Status / permissão (usado em config.js) ──────────────────────── */
function ntfStatus() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

async function ntfSolicitarPermissao() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}
