/*! FidUP! — Copyright LITUP S.r.l.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * Required Notice: Copyright LITUP S.r.l. (https://github.com/litupsrl/fidup)
 * https://polyformproject.org/licenses/noncommercial/1.0.0 */
// Service worker: rende l'app utilizzabile offline. Non vede né salva dati delle carte.
const CACHE = 'fidup-v1.5.0';
const ASSETS = [
  './', 'index.html', 'styles.css', 'app.js', 'config.js', 'manifest.webmanifest',
  'vendor/JsBarcode.all.min.js', 'vendor/qrcode.js', 'vendor/zxing.min.js',
  'favicon.ico', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API cloud: sempre rete
  // la pagina principale con ?code=... (ritorno OAuth) va servita dalla cache ignorando la query
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
