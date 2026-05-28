(function () {
  var v = typeof APP_VERSION !== 'undefined' ? APP_VERSION : null;
  var label = v ? ('v' + v.v + ' · ' + v.date + ' · #' + v.hash) : 'v— dev';
  var el = document.createElement('div');
  el.id = 'app-version-badge';
  el.style.cssText = [
    'position:fixed', 'bottom:10px', 'right:14px',
    'background:rgba(15,31,53,.72)', 'color:rgba(255,255,255,.65)',
    'font-size:10px', 'font-weight:600', 'font-family:Arial,sans-serif',
    'padding:4px 11px', 'border-radius:20px', 'z-index:9999',
    'pointer-events:none', 'letter-spacing:.3px',
    'backdrop-filter:blur(4px)', '-webkit-backdrop-filter:blur(4px)'
  ].join(';');
  el.textContent = label;
  if (document.body) {
    document.body.appendChild(el);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.appendChild(el);
    });
  }
})();
