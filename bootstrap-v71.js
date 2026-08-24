import { applySetupPatches } from './app-patch-setup-v59.js?v=74';
import { applyReportsPatch } from './app-patch-reports-v65.js?v=74';
import { applyStockPatch } from './app-patch-stock-v68.js?v=74';
import { applyCancelPatch } from './app-patch-cancel-v59.js?v=74';
import { applyProfitPatch } from './app-patch-profit-v58.js?v=74';
import { applySalePdfPatch } from './app-patch-sale-pdf-v65.js?v=74';
import { applyMobileMenuPatch } from './app-patch-mobile-menu-v66.js?v=74';
import { applyBatchStockPatch } from './app-patch-batch-stock-v68.js?v=74';
import { applySecurityReliabilityPatch } from './app-patch-security-v69.js?v=74';
import { applyAccountingPatch } from './app-patch-accounting-v70.js?v=74';
import { applyOperationsPatch } from './app-patch-operations-v71.js?v=74';
import { applyCommercialPatch } from './app-patch-commercial-v74.js?v=74';
import { applyFinalPatches } from './app-patch-final-v71.js?v=74';

const VERSION = '74';

const withStage = async (label, task) => {
  try { return await task(); }
  catch (error) {
    const detail = error?.message || String(error || 'Erro desconhecido');
    throw new Error(`${label}: ${detail}`);
  }
};

const criticalModules = [
  ['Financeiro', './aba-financeiro-v68.js?v=74', 'AbaFinanceiro'],
  ['Relatórios', './aba-relatorios-v73.js?v=74', 'AbaRelatorios'],
  ['Comercial', './aba-comercial-v74.js?v=74', 'AbaComercial'],
  ['Produtos', './aba-produtos-v67.js?v=74', 'AbaProdutos'],
  ['Movimentação em lote', './batch-stock-modal-v68.js?v=74', 'BatchStockModal'],
  ['Movimentação de estoque', './stock-movement-modal-v68.js?v=74', 'StockMovementModal'],
  ['Vendas', './aba-vendas-v71.js?v=74', 'AbaVendas'],
  ['Clientes', './aba-clientes-fixed-v52.js?v=74', 'AbaClientes'],
  ['Login', './auth-screen-v71.js?v=74', 'AuthScreen'],
  ['Modais', './modals-fixed-v69.js?v=74', 'SaleDetailsModal'],
  ['Nova venda', './nova-venda-fixed-v70.js?v=74', 'NewSaleScreen']
];

const preflightCriticalModules = async () => {
  for (const [label, url, exportName] of criticalModules) {
    await withStage(`Falha no módulo ${label}`, async () => {
      const module = await import(url);
      if (typeof module?.[exportName] !== 'function') throw new Error(`exportação ${exportName} não encontrada`);
    });
  }

  await withStage('Falha nos filtros unificados das vendas', async () => {
    const module = await import('./sales-operations-v71.js?v=74');
    for (const name of ['buildSalesView', 'summarizeSalesView', 'getOperationalSaleStatus']) {
      if (typeof module?.[name] !== 'function') throw new Error(`função ${name} não encontrada`);
    }
  });

  await withStage('Falha nos cálculos financeiros compartilhados', async () => {
    const module = await import('./financial-core-v70.js?v=74');
    for (const name of ['buildFinancialLedger', 'getSalesAccrualSummary', 'splitMoney', 'applyInstallmentPayment']) {
      if (typeof module?.[name] !== 'function') throw new Error(`função ${name} não encontrada`);
    }
  });

  await withStage('Falha na conciliação e nos relatórios estratégicos', async () => {
    const module = await import('./reports-engine-v73.js?v=74');
    for (const name of ['buildReport', 'buildPeriodComparison', 'getNetOperatingResult', 'buildReplenishmentForecast', 'buildRecurringCustomers']) {
      if (typeof module?.[name] !== 'function') throw new Error(`função estratégica ${name} não encontrada`);
    }
  });

  await withStage('Falha no planejamento e nas ações comerciais', async () => {
    const module = await import('./commercial-engine-v74.js?v=74');
    for (const name of ['buildCollectionQueue', 'buildRepurchaseSuggestions', 'calculateMonthlyGoals', 'buildCollectionMessage']) {
      if (typeof module?.[name] !== 'function') throw new Error(`função comercial ${name} não encontrada`);
    }
  });

  await withStage('Falha na exportação estruturada dos relatórios', async () => {
    const module = await import('./report-export-v74.js?v=74');
    for (const name of ['buildReportWorkbookModel', 'createReportExcelFile', 'shareFile']) {
      if (typeof module?.[name] !== 'function') throw new Error(`função de exportação ${name} não encontrada`);
    }
  });

  await withStage('Falha no módulo de parcelamento das compras', async () => {
    const module = await import('./purchase-payment-v68.js?v=74');
    if (typeof module?.buildPaymentInstallments !== 'function' || typeof module?.normalizePaymentInstallments !== 'function') {
      throw new Error('funções de parcelamento não encontradas');
    }
  });

  await withStage('Falha na validação de estoque', async () => {
    const module = await import('./inventory-reliability-v69.js?v=74');
    if (typeof module?.aggregateSaleItems !== 'function' || typeof module?.buildSaleInventoryPlan !== 'function') {
      throw new Error('funções de integridade do estoque não encontradas');
    }
  });
};

export const startApp = async () => {
  const cleanupKey = 'registro-vendas-cleanup-v74';
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
  source = await withStage('Falha ao preparar segurança e integridade', async () => applySecurityReliabilityPatch(source));
  source = await withStage('Falha ao conciliar valores, pagamentos e relatórios', async () => applyAccountingPatch(source));
  source = await withStage('Falha ao simplificar vendas, filtros, login e navegação', async () => applyOperationsPatch(source));
  source = await withStage('Falha ao preparar cobranças, recompra e metas', async () => applyCommercialPatch(source));
  source = await withStage('Falha ao preparar roteamento final', async () => applyFinalPatches(source));

  const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try {
    await withStage('Falha ao interpretar a aplicação final', async () => import(blobUrl));
    await withStage('Falha ao restaurar a última aba', async () => import('./tab-persistence.js?v=74'));
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};
