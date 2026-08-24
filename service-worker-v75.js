const STATIC_CACHE = 'registro-vendas-static-v75';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json?v=75',
  './app-icon.svg?v=75',
  './styles-runtime-v75.css?v=75',
  './bootstrap-v75.js?v=75',
  './offline-status-v75.js?v=75',
  './app-runtime-v75.js?v=75',
  './tab-persistence.js?v=75',
  './firebase-config.js?v=75',
  './utils.js?v=75',
  './components.js?v=75',
  './inventory-reliability-v69.js?v=75',
  './financial-core-v70.js?v=75',
  './modals-core-runtime-v75.js?v=75',
  './modals-runtime-v75.js?v=75',
  './stock-movement-modal-v68.js?v=75',
  './purchase-payment-v68.js?v=75',
  './auth-admin.js?v=75',
  './auth-screen-v71.js?v=75',
  './nova-venda-runtime-v75.js?v=75',
  './aba-visao-geral-fixed.js?v=75',
  './aba-vendas-v71.js?v=75',
  './sales-operations-v71.js?v=75',
  './aba-produtos-v67.js?v=75',
  './aba-clientes-runtime-v75.js?v=75',
  './customer-history-runtime-v75.js?v=75',
  './aba-taxas.js?v=75',
  './aba-financeiro-v68.js?v=75',
  './batch-stock-modal-v68.js?v=75',
  './aba-relatorios-v73.js?v=75',
  './reports-engine-v73.js?v=75',
  './reports-engine-v70.js?v=75',
  './reports-engine-v65.js?v=75',
  './report-export-v74.js?v=75',
  './aba-comercial-v74.js?v=75',
  './commercial-engine-v74.js?v=75',
  './sale-pdf-v65.js?v=75',
  './payment-settings.js?v=75',
  './aba-backup-v75.js?v=75',
  './backup-engine-v75.js?v=75',
  './backup-storage-v75.js?v=75',
  'https://cdn.tailwindcss.com/',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  'https://esm.sh/react@18.2.0',
  'https://esm.sh/react-dom@18.2.0',
  'https://esm.sh/react-dom@18.2.0/client',
  'https://esm.sh/lucide-react@0.292.0',
  'https://esm.sh/qrcode@1.5.4',
  'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js'
];

const STATIC_ORIGINS = new Set([
  self.location.origin,
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://esm.sh',
  'https://www.gstatic.com'
]);

const cacheResponse = async (cache, request, response) => {
  if (response && (response.ok || response.type === 'opaque')) {
    await cache.put(request, response.clone());
  }
  return response;
};

const warmStaticCache = async () => {
  const cache = await caches.open(STATIC_CACHE);
  await Promise.allSettled(CORE_ASSETS.map(async asset => {
    const request = new Request(new URL(asset, self.registration.scope).href, { cache: 'reload' });
    const response = await fetch(request);
    await cacheResponse(cache, request, response);
  }));
};

self.addEventListener('install', event => {
  event.waitUntil(warmStaticCache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(name => name.startsWith('registro-vendas-static-') && name !== STATIC_CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'WARM_STATIC_CACHE') event.waitUntil(warmStaticCache());
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

const cachedIgnoringVersion = request => caches.match(request, { ignoreSearch: true });

const navigationResponse = async request => {
  try {
    const response = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    await cacheResponse(cache, request, response);
    return response;
  } catch (_) {
    return (await cachedIgnoringVersion(request))
      || (await caches.match(new URL('./index.html', self.registration.scope).href, { ignoreSearch: true }))
      || Response.error();
  }
};

const staticResponse = async request => {
  const cached = await cachedIgnoringVersion(request);
  const refresh = (async () => {
    const response = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    return cacheResponse(cache, request, response);
  })();

  if (cached) {
    refresh.catch(() => {});
    return cached;
  }
  try {
    return await refresh;
  } catch (_) {
    return Response.error();
  }
};

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(navigationResponse(request));
    return;
  }

  const staticDestination = ['script', 'style', 'font', 'image', 'manifest'].includes(request.destination);
  const sameOriginStaticFile = url.origin === self.location.origin
    && /\.(?:js|css|svg|png|jpg|jpeg|webp|woff2?|json)$/i.test(url.pathname);
  if (STATIC_ORIGINS.has(url.origin) && (staticDestination || sameOriginStaticFile)) {
    event.respondWith(staticResponse(request));
  }
});
