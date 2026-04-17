const CACHE_NAME = 'aura-hub-fine-modular-v11-finance-modal-fix';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './js/core.js',
  './js/main-module.js',
  './js/adm-module.js',
  './js/crm-module.js',
  './js/main/utils.js',
  './js/main/ui.js',
  './js/main/modals.js',
  './js/main/auth.js',
  './js/main/admin.js',
  './js/main/forms.js',
  './js/main/dashboard.js',
  './js/main/index.js',
  './js/adm/utils.js',
  './js/adm/ui.js',
  './js/adm/auth.js',
  './js/adm/modals.js',
  './js/adm/catalog.js',
  './js/adm/finance.js',
  './js/adm/index.js',
  './js/crm/utils.js',
  './js/crm/ui.js',
  './js/crm/auth.js',
  './js/crm/features.js',
  './js/crm/index.js',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => {
        if (!cacheWhitelist.includes(cacheName)) {
          return caches.delete(cacheName);
        }
        return null;
      })
    ))
  );
});
