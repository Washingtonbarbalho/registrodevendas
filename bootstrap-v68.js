import { applySetupPatches } from './app-patch-setup-v59.js?v=68';
import { applyReportsPatch } from './app-patch-reports-v65.js?v=68';
import { applyStockPatch } from './app-patch-stock-v68.js?v=68';
import { applyCancelPatch } from './app-patch-cancel-v59.js?v=68';
import { applyProfitPatch } from './app-patch-profit-v58.js?v=68';
import { applySalePdfPatch } from './app-patch-sale-pdf-v65.js?v=68';
import { applyMobileMenuPatch } from './app-patch-mobile-menu-v66.js?v=68';
import { applyBatchStockPatch } from './app-patch-batch-stock-v68.js?v=68';
import { applyFinalPatches } from './app-patch-final-v68.js?v=68';

const VERSION = '68';

const withStage = async (label, task) => {
  try { return await task(); }
  catch (error) {
    const detail = error?.message || String(error || 'Erro desconhecido');
    throw new Error(`${label}: ${detail}`);
  }
};

const criticalModules = [
  ['Financeiro', './aba-financeiro-v68.js?v=68', 'AbaFinanceiro'],
  ['Relatórios', './aba-relatorios-v65.js?v=68', 'AbaRelatorios'],
  ['Produtos', './aba-produtos-v67.js?v=68', 'AbaProdutos'],
  ['Movimentação em lote', './batch-stock-modal-v68.js?v=68', 'BatchStockModal'],
  ['Movimentação de estoque', './stock-movement-modal-v68.js?v=68', 'StockMovementModal'],
  ['Vendas no caixa', './aba-vendas-caixa-v52.js?v=68', 'AbaVendasCaixa'],
  ['Vendas a prazo', './aba-vendas-prazo-v52.js?v=68', 'AbaVendasPrazo'],
  ['Clientes', './aba-clientes-fixed-v52.js?v=68', 'AbaClientes'],
  ['Modais', './modals-fixed-v65.js?v=68', 'SaleDetailsModal'],
  ['Nova venda', './nova-venda-fixed-v65.js?v=68', 'NewSaleScreen']
];

const preflightCriticalModules = async () => {
  for (const [label, url, exportName] of criticalModules) {
    await withStage(`Falha no módulo ${label}`, async () => {
      const module = await import(url);
      if (typeof module?.[exportName] !== 'function') throw new Error(`exportação ${exportName} não encontrada`);
    });
  }

  await withStage('Falha no módulo de parcelamento das compras', async () => {
    const module = await import('./purchase-payment-v68.js?v=68');
    if (typeof module?.buildPaymentInstallments !== 'function' || typeof module?.normalizePaymentInstallments !== 'function') {
      throw new Error('funções de parcelamento não encontradas');
    }
  });
};

export const startApp = async () => {
  const cleanupKey = 'registro-vendas-cleanup-v68';
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
  source = await withStage('Falha ao preparar Relatórios', async () => applyReportsPatch(source));
  source = await withStage('Falha ao preparar estoque e parcelamentos', async () => applyStockPatch(source));
  source = await withStage('Falha ao preparar cancelamento total', async () => applyCancelPatch(source));
  source = await withStage('Falha ao preparar lucro dos cancelamentos anteriores', async () => applyProfitPatch(source));
  source = await withStage('Falha ao preparar PDFs das vendas', async () => applySalePdfPatch(source));
  source = await withStage('Falha ao preparar menu lateral mobile', async () => applyMobileMenuPatch(source));
  source = await withStage('Falha ao preparar movimentação de estoque em lote', async () => applyBatchStockPatch(source));
  source = await withStage('Falha ao preparar roteamento final', async () => applyFinalPatches(source));

  const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try {
    await withStage('Falha ao interpretar a aplicação final', async () => import(blobUrl));
    await withStage('Falha ao restaurar a última aba', async () => import('./tab-persistence.js?v=68'));
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};
