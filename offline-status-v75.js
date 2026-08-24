const STATUS_ID = 'offline-status-v75';
const INITIALIZED_KEY = '__registroVendasOfflineV75';
const OFFLINE_TRUST_KEY = 'registro-vendas:trusted-device:v75';

const ensureStatus = () => {
  let status = document.getElementById(STATUS_ID);
  if (status) return status;
  status = document.createElement('div');
  status.id = STATUS_ID;
  status.className = 'offline-status-v75';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.innerHTML = '<span class="offline-status-v75-dot" aria-hidden="true"></span><span class="offline-status-v75-text"></span>';
  document.body.appendChild(status);
  return status;
};

const setConnectionStatus = (online, temporary = false) => {
  const status = ensureStatus();
  const text = status.querySelector('.offline-status-v75-text');
  status.classList.toggle('is-online', online);
  status.classList.add('is-visible');
  let trustedDevice = false;
  try { trustedDevice = localStorage.getItem(OFFLINE_TRUST_KEY) === 'yes'; } catch (_) {}
  text.textContent = online
    ? 'Conexão restabelecida. Alterações pendentes serão sincronizadas.'
    : trustedDevice
      ? 'Modo offline: consulte os dados salvos e continue trabalhando.'
      : 'Aplicativo offline disponível; os dados da loja exigem um aparelho confiável.';
  clearTimeout(setConnectionStatus.hideTimer);
  if (online && temporary) {
    setConnectionStatus.hideTimer = setTimeout(() => status.classList.remove('is-visible'), 4_000);
  }
};

const installConnectionListeners = () => {
  if (globalThis[INITIALIZED_KEY]) return;
  globalThis[INITIALIZED_KEY] = true;
  globalThis.addEventListener('offline', () => setConnectionStatus(false));
  globalThis.addEventListener('online', () => setConnectionStatus(true, true));
  if (!navigator.onLine) setConnectionStatus(false);
};

export const registerOfflineSupport = async () => {
  installConnectionListeners();
  if (!('serviceWorker' in navigator)) return null;

  let registration = globalThis.__registroVendasEarlyServiceWorker
    ? await globalThis.__registroVendasEarlyServiceWorker
    : null;
  if (!registration) {
    registration = await navigator.serviceWorker.register(
      './service-worker-v75.js?v=75',
      { scope: './', updateViaCache: 'none' }
    );
  }
  registration.update().catch(() => {});

  const warmCache = worker => worker?.postMessage({ type: 'WARM_STATIC_CACHE' });
  warmCache(registration.active);
  navigator.serviceWorker.ready.then(readyRegistration => warmCache(readyRegistration.active)).catch(() => {});
  return registration;
};
