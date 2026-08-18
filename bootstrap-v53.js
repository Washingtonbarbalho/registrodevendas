import { applySetupPatches } from './app-patch-setup-v52.js?v=53';
import { applyStockPatch } from './app-patch-stock-v52.js?v=53';
import { applyCancelPatch } from './app-patch-cancel-v52.js?v=53';
import { applyFinalPatches } from './app-patch-final-v52.js?v=53';

export const startApp = async () => {
  const version = '53';
  const cleanupKey = 'registro-vendas-cleanup-v53';
  if (sessionStorage.getItem(cleanupKey) !== 'ok') {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
    }
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(name => caches.delete(name)));
    }
    sessionStorage.setItem(cleanupKey, 'ok');
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      location.reload();
      await new Promise(() => {});
    }
  }

  const response = await fetch(`./app.js?v=${version}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Falha ao carregar app.js (${response.status})`);
  let source = await response.text();
  source = applySetupPatches(source);
  source = applyStockPatch(source);
  source = applyCancelPatch(source);
  source = applyFinalPatches(source);

  const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try {
    await import(blobUrl);
    await import('./tab-persistence.js?v=53');
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};
