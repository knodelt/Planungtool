const CACHE = 'planungtool_demo-inst-planung-v2-2';
const CORE = ['./', './index.html', './styles.css', './js/app.js', './js/store.js', './js/calendar-data.js', './manifest.webmanifest', './js/demo-data.js', './js/demo-api.js', './css/demo.css'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('planungtool_demo-') && key !== CACHE).map((key) => caches.delete(key))))
  ]));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
      }
      return response;
    }).catch(async () => (await caches.match(event.request)) || caches.match('./index.html'))
  );
});
