/*! FidUP! — Copyright LITUP S.r.l.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * Required Notice: Copyright LITUP S.r.l. (https://github.com/litupsrl/fidup)
 * https://polyformproject.org/licenses/noncommercial/1.0.0 */
// Service worker: rende l'app utilizzabile offline. Non vede né salva dati delle carte.
const CACHE = 'fidup-v1.12.0';
const ASSETS = [
  './', 'index.html', 'styles.css', 'app.js', 'config.js', 'chains.js', 'manifest.webmanifest',
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
// Rete prima di tutto (così gli aggiornamenti arrivano subito); cache solo se offline o rete lenta.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API cloud: sempre rete
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const fromCache = () => cache.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./'));
    try {
      const net = await Promise.race([
        fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
      ]);
      if (net && net.ok) cache.put(e.request, net.clone()).catch(() => {});
      return net;
    } catch {
      return (await fromCache()) || Response.error();
    }
  })());
});
