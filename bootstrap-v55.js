import { applySetupPatches } from './app-patch-setup-v52.js?v=55';
import { applyStockPatch } from './app-patch-stock-v52.js?v=55';
import { applyCancelPatch } from './app-patch-cancel-v52.js?v=55';
import { applyFinalPatches } from './app-patch-final-v55.js?v=55';

const VERSION = '55';

const withStage = async (label, task) => {
  try {
    return await task();
  } catch (error) {
    const detail = error?.message || String(error || 'Erro desconhecido');
    throw new Error(`${label}: ${detail}`);
  }
};

const criticalModules = [
  ['Financeiro', './aba-financeiro-v54.js?v=55', 'AbaFinanceiro'],
  ['Movimentação de estoque', './stock-movement-modal-v52.js?v=55', 'StockMovementModal'],
  ['Cancelamento de venda', './sale-cancellation-modal-v52.js?v=55', 'SaleCancellationModal'],
  ['Vendas no caixa', './aba-vendas-caixa-v52.js?v=55', 'AbaVendasCaixa'],
  ['Vendas a prazo', './aba-vendas-prazo-v52.js?v=55', 'AbaVendasPrazo'],
  ['Clientes', './aba-clientes-fixed-v52.js?v=55', 'AbaClientes'],
  ['Modais', './modals-fixed-v52.js?v=55', 'SaleDetailsModal'],
  ['Nova venda', './nova-venda-fixed-v55.js?v=55', 'NewSaleScreen']
];

const preflightCriticalModules = async () => {
  for (const [label, url, exportName] of criticalModules) {
    await withStage(`Falha no módulo ${label}`, async () => {
      const module = await import(url);
      if (typeof module?.[exportName] !== 'function') {
        throw new Error(`exportação ${exportName} não encontrada`);
      }
    });
  }
};

export const startApp = async () => {
  const cleanupKey = 'registro-vendas-cleanup-v55';
  if (sessionStorage.getItem(cleanupKey) !== 'ok') {
    await withStage('Falha ao limpar cache antigo', async () => {
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
    });
  }

  await preflightCriticalModules();

  const response = await withStage('Falha ao carregar app.js', async () => {
    const result = await fetch(`./app.js?v=${VERSION}`, { cache: 'no-store' });
    if (!result.ok) throw new Error(`HTTP ${result.status}`);
    return result;
  });

  let source = await response.text();
  source = await withStage('Falha ao preparar integrações principais', async () => applySetupPatches(source));
  source = await withStage('Falha ao preparar estoque', async () => applyStockPatch(source));
  source = await withStage('Falha ao preparar cancelamentos', async () => applyCancelPatch(source));
  source = await withStage('Falha ao preparar roteamento final', async () => applyFinalPatches(source));

  const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try {
    await withStage('Falha ao interpretar a aplicação final', async () => import(blobUrl));
    await withStage('Falha ao restaurar a última aba', async () => import('./tab-persistence.js?v=55'));
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};