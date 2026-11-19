/* Ajustes específicos para rodar dentro do Safari/iPhone (PWA instalável). */

Net.UA = 'Raptor/1.2 (iPhone)';

/* No iPhone não existe MAC confiável para o site. Derivamos um código estável
   do aparelho e guardamos no localStorage, no mesmo formato AA:BB:CC:DD:EE:FF. */
Device.code = function () {
  var cached = Store.cachedCode();
  if (cached) return Promise.resolve(cached);

  var seed = Store.get('deviceSeed', null);
  if (!seed) {
    seed = 'iphone-' + navigator.userAgent + '-' + Math.random() + '-' + Date.now();
    Store.set('deviceSeed', seed);
  }
  var digest = sha256Hex(seed);
  var parts = [];
  for (var i = 0; i < 6; i++) parts.push(digest.substr(i * 2, 2).toUpperCase());
  var code = parts.join(':');
  Store.cacheCode(code);
  return Promise.resolve(code);
};

/* Aviso claro quando a página HTTPS tenta falar com um servidor HTTP. */
function mixedBlocked(url) {
  return location.protocol === 'https:' && /^http:\/\//i.test(String(url || ''));
}

function mixedMessage() {
  return 'Este provedor usa HTTP. O iPhone bloqueia conexões HTTP dentro de um app instalado por link HTTPS. ' +
    'Peça ao provedor um endereço HTTPS ou use o app nativo via TestFlight.';
}

/* Identifica rapidamente se um link veio de Xtream (get.php) ou é M3U. */
function detectSmartLink(raw) {
  var text = String(raw || '').trim();
  if (!text) return null;
  if (/get\.php|player_api\.php/i.test(text) || /^https?:\/\/[^/?#]+:\d+\/?$/i.test(text)) {
    var converted = xtreamFromM3uUrl(text);
    if (converted) return { mode: 'XTREAM', session: converted };
    if (/player_api\.php|get\.php/i.test(text)) {
      var base = text.split('?')[0].replace(/\/[^/]*\.php$/i, '').replace(/\/+$/, '');
      var q = (text.split('?')[1] || '').split('&');
      var p = {};
      for (var i = 0; i < q.length; i++) {
        var kv = q[i].split('=');
        if (kv.length > 1) p[decodeURIComponent(kv[0]).toLowerCase()] = decodeURIComponent(kv.slice(1).join('='));
      }
      return { mode: 'XTREAM', session: { mode: 'XTREAM', baseUrl: base,
        username: p.username || p.user || '', password: p.password || p.pass || '', m3uUrl: '', label: '' } };
    }
    return { mode: 'XTREAM', base: text };
  }
  if (/\.m3u8?(\?|$)/i.test(text) || /^https?:\/\//i.test(text)) {
    return { mode: 'M3U', session: { mode: 'M3U', m3uUrl: text, baseUrl: '', username: '', password: '', label: '' } };
  }
  return null;
}
