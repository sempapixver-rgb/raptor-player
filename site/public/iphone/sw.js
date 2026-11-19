/* Cache apenas do "casco" do app. Nada de lista, credencial ou vídeo fica aqui. */
var CACHE = 'raptor-iphone-v1';
var SHELL = [
  './', './index.html', './css/app.css',
  './js/app.js', './js/ios.js', './js/sha256.js', './js/util.js',
  './js/net.js', './js/store.js', './js/source.js', './js/epg.js',
  './vendor/hls.light.min.js', './vendor/qrcode.min.js',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(SHELL).catch(function () {});
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (key) {
      return key === CACHE ? null : caches.delete(key);
    }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      var network = fetch(e.request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return response;
      }).catch(function () { return hit; });
      return hit || network;
    })
  );
});
