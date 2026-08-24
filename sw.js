// Arquivo de retirada para instalações antigas que ainda apontam para sw.js.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(name => name.startsWith('registro-vendas-'))
      .map(name => caches.delete(name)));
    await self.registration.unregister();
    await self.clients.claim();
  })());
});
