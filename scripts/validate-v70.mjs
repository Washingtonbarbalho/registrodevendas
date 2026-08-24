import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { applySetupPatches } from '../app-patch-setup-v59.js';
import { applyReportsPatch } from '../app-patch-reports-v65.js';
import { applyStockPatch } from '../app-patch-stock-v68.js';
import { applyCancelPatch } from '../app-patch-cancel-v59.js';
import { applyProfitPatch } from '../app-patch-profit-v58.js';
import { applySalePdfPatch } from '../app-patch-sale-pdf-v65.js';
import { applyMobileMenuPatch } from '../app-patch-mobile-menu-v66.js';
import { applyBatchStockPatch } from '../app-patch-batch-stock-v68.js';
import { applySecurityReliabilityPatch } from '../app-patch-security-v69.js';
import { applyAccountingPatch } from '../app-patch-accounting-v70.js';
import { applyFinalPatches } from '../app-patch-final-v70.js';
import {
  allocateMoney,
  applyInstallmentPayment,
  buildFinancialLedger,
  FinancialCalculationError,
  getPurchaseGroups,
  getRealizedSalesProfit,
  getSalesAccrualSummary,
  normalizeSaleMoney,
  projectSalesAsOf,
  reverseInstallmentPayment,
  splitMoney,
  sumMoney,
  summarizeFinancialLedger,
  toCents
} from '../financial-core-v70.js';
import { buildPaymentInstallments } from '../purchase-payment-v68.js';
import { buildReport } from '../reports-engine-v70.js';

globalThis.location = new URL('https://example.test/registrodevendas/');

const checkSyntax = file => {
  const path = file instanceof URL ? fileURLToPath(file) : file;
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Erro de sintaxe em ${path}:\n${result.stderr || result.stdout}`);
};

const extractFunction = (source, startMarker, endMarker, functionName) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Não foi possível extrair ${functionName} para teste.`);
  return Function(`${source.slice(start, end)}\nreturn ${functionName};`)();
};

const metricValue = (report, label) => {
  const result = report.metrics.find(item => item.label === label);
  assert.ok(result, `Indicador ausente: ${label}`);
  return result.value;
};

for (const file of [
  'bootstrap-v70.js',
  'financial-core-v70.js',
  'reports-engine-v70.js',
  'app-patch-accounting-v70.js',
  'app-patch-final-v70.js',
  'nova-venda-fixed-v70.js',
  'purchase-payment-v68.js',
  'aba-financeiro-v68.js',
  'aba-relatorios-v65.js',
  'sale-pdf-v65.js',
  'app-patch-security-v69.js',
  'inventory-reliability-v69.js',
  'modals-fixed-v69.js'
]) checkSyntax(new URL(`../${file}`, import.meta.url));

assert.deepEqual(splitMoney(100, 3), [33.34, 33.33, 33.33], 'As parcelas devem distribuir o centavo restante.');
assert.deepEqual(splitMoney(0.05, 3), [0.02, 0.02, 0.01], 'Valores pequenos também precisam fechar em centavos.');
assert.equal(sumMoney(allocateMoney(100, [1, 1, 1])), 100, 'O rateio de produtos deve somar exatamente o total da venda.');
assert.equal(toCents(1.005), 101, 'O arredondamento monetário deve preservar centavos limítrofes.');

const supplierPlan = buildPaymentInstallments(100, 3, '2026-07-31');
assert.deepEqual(supplierPlan.map(item => item.amount), [33.34, 33.33, 33.33]);
assert.deepEqual(supplierPlan.map(item => item.dueDate), ['2026-07-31', '2026-08-31', '2026-09-30']);

const initialInstallments = [1, 2, 3].map(number => ({
  number,
  amount: 30,
  originalAmount: 30,
  dueDate: `2026-0${number + 6}-10`,
  paid: false,
  history: []
}));
const payment = applyInstallmentPayment(initialInstallments, 0, 75, '2026-08-03', '2026-08-03T12:00:00.000Z');
assert.deepEqual(payment.installments.map(item => item.amount), [0, 0, 15], 'O excedente deve alcançar todas as parcelas seguintes.');
assert.deepEqual(payment.installments.map(item => item.paid), [true, true, false]);
assert.deepEqual(payment.allocations.map(item => item.amount), [30, 15]);
assert.equal(payment.historyItem.surplus, 45);
assert.deepEqual(initialInstallments.map(item => item.amount), [30, 30, 30], 'A operação não deve alterar o estado original.');

const reversed = reverseInstallmentPayment(payment.installments, 0, 0, payment.historyItem.timestamp);
assert.deepEqual(reversed.installments.map(item => item.amount), [30, 30, 30], 'O estorno deve restaurar todas as parcelas atingidas.');
assert.equal(reversed.reversedAmount, 75);
assert.equal(reversed.remainingBalance, 90);

const finalPayment = applyInstallmentPayment(payment.installments, 2, 15, '2026-08-04', '2026-08-04T12:00:00.000Z');
assert.equal(finalPayment.allPaid, true);
const reversedAfterLaterPayment = reverseInstallmentPayment(finalPayment.installments, 0, 0, payment.historyItem.timestamp);
assert.deepEqual(reversedAfterLaterPayment.installments.map(item => item.amount), [30, 30, 15], 'Pagamentos independentes posteriores devem ser preservados no estorno.');

const partialCentPayment = applyInstallmentPayment([{ amount: 0.3, originalAmount: 0.3, paid: false }], 0, 0.1, '2026-08-03');
assert.equal(partialCentPayment.installments[0].amount, 0.2, 'Pagamentos parciais não podem gerar frações de centavos.');

assert.throws(
  () => applyInstallmentPayment(initialInstallments, 0, 90.01, '2026-08-03'),
  error => error instanceof FinancialCalculationError && error.code === 'payment-exceeds-balance',
  'Pagamentos acima do saldo total devem ser rejeitados.'
);

const normalizedSale = normalizeSaleMoney({
  saleType: 'prazo',
  entryAmount: 5,
  totalPrice: 999,
  totalCost: 999,
  productsTotal: 999,
  items: [{ productId: 'p1', quantity: 1, unitPrice: 100, unitCost: 60, price: 100, cost: 60 }],
  installments: splitMoney(95, 3).map(amount => ({ amount }))
});
assert.equal(normalizedSale.totalPrice, 100, 'Contrato deve ser igual à entrada mais a soma das parcelas.');
assert.equal(normalizedSale.totalCost, 60);
assert.equal(normalizedSale.productsTotal, 100);
assert.equal(sumMoney(normalizedSale.installments, item => item.amount), 95);

const julySale = {
  id: 'sale-july',
  saleType: 'direct',
  paymentMethod: 'credit',
  cardInstallments: 1,
  saleDate: '2026-07-12',
  saleDateTime: '2026-07-12T12:00:00.000Z',
  customerName: 'Cliente de julho',
  status: 'canceled',
  totalPrice: 100,
  netReceived: 95,
  totalCost: 60,
  totalDiscount: 0,
  feeConfig: { type: 'sem_juros', value: 5, storeAbsorbedFeeValue: 5 },
  items: [{ productId: 'p1', productName: 'Produto A', quantity: 1, unitPrice: 100, unitCost: 60, price: 100, cost: 60 }],
  cancellations: [{
    id: 'cancel-august',
    type: 'total',
    date: '2026-08-08',
    createdAt: '2026-08-08T12:00:00.000Z',
    reason: 'Devolução',
    canceledContractValue: 100,
    canceledCostAmount: 60,
    profitImpactAmount: 35,
    storeImpactAmount: 95,
    customerRefundAmount: 100,
    refundAmount: 95,
    items: [{ productId: 'p1', productName: 'Produto A', quantity: 1, unitPrice: 100, unitCost: 60, amount: 100, canceledCostAmount: 60 }]
  }]
};

const termSale = {
  id: 'sale-term',
  saleType: 'prazo',
  saleDate: '2026-06-10',
  customerName: 'Cliente do crediário',
  status: 'active',
  totalPrice: 90,
  totalCost: 45,
  entryAmount: 0,
  installmentsCount: 3,
  installments: payment.installments,
  items: [{ productId: 'p2', productName: 'Produto B', quantity: 1, unitPrice: 90, unitCost: 45, price: 90, cost: 45 }]
};

const batchInstallments = [
  { number: 1, dueDate: '2026-07-31', amount: 33.34, paid: true, paidAt: '2026-07-22', paidAtDateTime: '2026-07-22T12:00:00.000Z' },
  { number: 2, dueDate: '2026-08-31', amount: 33.33, paid: true, paidAt: '2026-08-10', paidAtDateTime: '2026-08-10T12:00:00.000Z' },
  { number: 3, dueDate: '2026-09-30', amount: 33.33, paid: false, paidAt: null }
];

const products = [
  {
    id: 'p1',
    name: 'Produto A',
    movements: [{
      id: 'movement-a',
      type: 'compra',
      batchId: 'batch-1',
      batchIndex: 0,
      quantity: 6,
      unitCost: 10,
      date: '2026-07-20T10:00:00.000Z',
      paymentMethod: 'credit',
      financialInstallments: batchInstallments,
      financialCancellations: [{
        id: 'supplier-return',
        quantity: 1,
        amount: 10,
        accountReductionAmount: 10,
        cashRefundAmount: 0,
        hadCashOut: false,
        date: '2026-08-20',
        createdAt: '2026-08-20T12:00:00.000Z'
      }]
    }]
  },
  {
    id: 'p2',
    name: 'Produto B',
    movements: [{
      id: 'movement-b',
      type: 'compra',
      batchId: 'batch-1',
      batchIndex: 1,
      quantity: 4,
      unitCost: 10,
      date: '2026-07-20T10:00:00.000Z',
      paymentMethod: 'credit',
      financialInstallments: batchInstallments
    }]
  }
];

const purchaseGroups = getPurchaseGroups(products);
assert.equal(purchaseGroups.length, 1, 'A compra em lote não pode ser duplicada por produto.');
assert.equal(purchaseGroups[0].originalAmount, 100);
assert.equal(purchaseGroups[0].paidAmount, 66.67);
assert.equal(purchaseGroups[0].openTotal, 23.33);
assert.deepEqual(purchaseGroups[0].plan.map(item => item.amount), [33.34, 33.33, 23.33], 'Devoluções devem reduzir as parcelas finais sem redistribuir as já contratadas.');

const financialData = {
  entries: [
    { id: 'manual-in', type: 'income', value: 4.01, date: '2026-07-25', description: 'Entrada manual' },
    { id: 'manual-out', type: 'expense', value: 1.01, date: '2026-07-25', description: 'Saída manual' }
  ],
  accounts: [{ id: 'manual-account', direction: 'payable', value: 2.02, paid: true, paidAt: '2026-07-28', description: 'Conta paga' }]
};
const sales = [julySale, termSale];
const ledger = buildFinancialLedger({ sales, products, financialData, purchaseGroups });
const julyCash = summarizeFinancialLedger(ledger, '2026-07-01', '2026-07-31');
const augustCash = summarizeFinancialLedger(ledger, '2026-08-01', '2026-08-31');
assert.equal(julyCash.income, 99.01);
assert.equal(julyCash.expense, 36.37);
assert.equal(julyCash.rows.filter(item => item.source === 'stock').length, 1);
assert.equal(augustCash.rows.filter(item => item.source === 'stock').length, 1);
assert.equal(augustCash.rows.find(item => item.source === 'stock').amount, 33.33);
assert.equal(sumMoney(augustCash.rows.filter(item => item.source === 'sale'), item => item.amount), 75, 'O excedente deve entrar uma única vez no caixa.');
assert.equal(augustCash.rows.find(item => item.source === 'sale-refund').amount, 95);

const julyAccrual = getSalesAccrualSummary(sales, '2026-07-01', '2026-07-31');
const augustAccrual = getSalesAccrualSummary(sales, '2026-08-01', '2026-08-31');
assert.equal(julyAccrual.gross, 100, 'O cancelamento futuro não pode alterar o mês da venda.');
assert.equal(julyAccrual.net, 95);
assert.equal(julyAccrual.profit, 35);
assert.equal(augustAccrual.gross, -100, 'O cancelamento deve ser reconhecido no mês em que aconteceu.');
assert.equal(augustAccrual.net, -95);
assert.equal(augustAccrual.cost, -60);
assert.equal(augustAccrual.profit, -35);
assert.equal(getRealizedSalesProfit([julySale], '2026-07-01', '2026-07-31'), 35);
assert.equal(getRealizedSalesProfit([julySale], '2026-08-01', '2026-08-31'), -35);
assert.equal(getRealizedSalesProfit([termSale], '2026-08-01', '2026-08-31'), 30);
assert.notEqual(projectSalesAsOf([julySale], '2026-07-31')[0].status, 'canceled');
assert.equal(projectSalesAsOf([julySale], '2026-08-31')[0].status, 'canceled');

const canceledTermSale = {
  ...termSale,
  status: 'canceled',
  cancellations: [{
    id: 'term-cancel-september',
    type: 'total',
    date: '2026-09-05',
    canceledContractValue: 90,
    canceledCostAmount: 45,
    profitImpactAmount: 45,
    storeImpactAmount: 75,
    refundAmount: 75
  }]
};
assert.equal(summarizeFinancialLedger(buildFinancialLedger({ sales: [canceledTermSale] }), '2026-08-01', '2026-08-31').income, 75);
assert.equal(summarizeFinancialLedger(buildFinancialLedger({ sales: [canceledTermSale] }), '2026-09-01', '2026-09-30').expense, 75);
assert.equal(getRealizedSalesProfit([canceledTermSale], '2026-09-01', '2026-09-30'), -30, 'Cancelamentos devem reverter apenas o lucro já realizado.');
assert.notEqual(projectSalesAsOf([canceledTermSale], '2026-08-31')[0].status, 'canceled');

const context = { sales, products, financialData, paymentFilter: 'all' };
const julyResult = buildReport({ ...context, reportId: 'result', startDate: '2026-07-01', endDate: '2026-07-31' });
const augustResult = buildReport({ ...context, reportId: 'result', startDate: '2026-08-01', endDate: '2026-08-31' });
assert.equal(metricValue(julyResult, 'Entradas de caixa'), julyCash.income);
assert.equal(metricValue(julyResult, 'Saídas de caixa'), julyCash.expense);
assert.equal(metricValue(julyResult, 'Saldo do fluxo de caixa'), julyCash.balance);
assert.equal(metricValue(augustResult, 'Entradas de caixa'), augustCash.income);
assert.equal(metricValue(augustResult, 'Saídas de caixa'), augustCash.expense);
assert.equal(metricValue(augustResult, 'Lucro bruto'), -35);

const julySales = buildReport({ ...context, reportId: 'sales', startDate: '2026-07-01', endDate: '2026-07-31' });
const augustSales = buildReport({ ...context, reportId: 'sales', startDate: '2026-08-01', endDate: '2026-08-31' });
assert.equal(metricValue(julySales, 'Vendas válidas'), 1);
assert.equal(metricValue(julySales, 'Faturamento'), 100);
assert.equal(metricValue(julySales, 'Vendas canceladas'), 0);
assert.equal(metricValue(augustSales, 'Vendas canceladas'), 1);
assert.equal(metricValue(augustSales, 'Valor cancelado'), 100);
assert.ok(augustSales.rows.some(row => row.includes('Cancelamento de mês anterior')));

const julyProfit = buildReport({ ...context, reportId: 'sale-profit', startDate: '2026-07-01', endDate: '2026-07-31' });
const augustProfit = buildReport({ ...context, reportId: 'sale-profit', startDate: '2026-08-01', endDate: '2026-08-31' });
assert.equal(metricValue(julyProfit, 'Lucro total'), 35);
assert.equal(metricValue(augustProfit, 'Lucro total'), -35);

const julyProducts = buildReport({ ...context, reportId: 'products', startDate: '2026-07-01', endDate: '2026-07-31' });
const augustProducts = buildReport({ ...context, reportId: 'products', startDate: '2026-08-01', endDate: '2026-08-31' });
assert.equal(metricValue(julyProducts, 'Receita líquida alocada'), metricValue(julyResult, 'Receita líquida das vendas'));
assert.equal(metricValue(augustProducts, 'Receita líquida alocada'), -95);
assert.equal(metricValue(augustProducts, 'Lucro'), -35);

const julyPurchases = buildReport({ ...context, reportId: 'purchases', startDate: '2026-07-01', endDate: '2026-07-31' });
const augustPurchases = buildReport({ ...context, reportId: 'purchases', startDate: '2026-08-01', endDate: '2026-08-31' });
assert.equal(metricValue(julyPurchases, 'Compras realizadas'), 1);
assert.equal(metricValue(julyPurchases, 'Valor bruto comprado'), 100);
assert.equal(metricValue(julyPurchases, 'Devoluções'), 0);
assert.equal(metricValue(julyPurchases, 'Parcelas pagas no período'), 33.34);
assert.equal(metricValue(augustPurchases, 'Compras realizadas'), 0);
assert.equal(metricValue(augustPurchases, 'Devoluções'), 10);
assert.equal(metricValue(augustPurchases, 'Valor líquido das compras'), -10);
assert.equal(metricValue(augustPurchases, 'Parcelas pagas no período'), 33.33);
assert.equal(metricValue(augustPurchases, 'Saldo atual de compras a pagar'), 23.33);

const cashPurchaseProduct = {
  id: 'cash-product',
  name: 'Compra à vista',
  movements: [{
    id: 'cash-movement',
    type: 'compra',
    quantity: 4,
    unitCost: 20,
    date: '2026-07-15',
    paymentMethod: 'pix',
    financialCancellations: [{
      id: 'cash-refund',
      quantity: 1,
      amount: 20,
      cashRefundAmount: 20,
      hadCashOut: true,
      date: '2026-08-02'
    }]
  }]
};
const cashPurchaseLedger = buildFinancialLedger({ products: [cashPurchaseProduct] });
assert.equal(summarizeFinancialLedger(cashPurchaseLedger, '2026-07-01', '2026-07-31').expense, 80);
assert.equal(summarizeFinancialLedger(cashPurchaseLedger, '2026-08-01', '2026-08-31').income, 20);
assert.equal(metricValue(buildReport({ reportId: 'purchases', products: [cashPurchaseProduct], startDate: '2026-07-01', endDate: '2026-07-31' }), 'Devoluções'), 0);
assert.equal(metricValue(buildReport({ reportId: 'purchases', products: [cashPurchaseProduct], startDate: '2026-08-01', endDate: '2026-08-31' }), 'Devoluções'), 20);

const julyStock = buildReport({ ...context, reportId: 'stock', startDate: '2026-07-01', endDate: '2026-07-31' });
const augustStock = buildReport({ ...context, reportId: 'stock', startDate: '2026-08-01', endDate: '2026-08-31' });
assert.equal(julyStock.rows.find(row => row[0] === 'Produto A')[3], '6', 'Devoluções futuras não podem reduzir compras de julho.');
assert.equal(augustStock.rows.find(row => row[0] === 'Produto A')[2], '-1', 'Cancelamentos devem voltar ao estoque no mês correto.');
assert.equal(augustStock.rows.find(row => row[0] === 'Produto A')[3], '-1', 'Devoluções ao fornecedor devem aparecer no próprio mês.');

const augustCredit = buildReport({ ...context, reportId: 'credit', startDate: '2026-08-01', endDate: '2026-08-31' });
assert.equal(metricValue(augustCredit, 'Recebido no período'), 75);
assert.equal(metricValue(augustCredit, 'Estornos no período'), 0);
assert.equal(metricValue(augustCredit, 'Recebimento líquido no período'), 75);

const precisionSale = {
  id: 'precision',
  saleType: 'direct',
  saleDate: '2026-09-01',
  totalPrice: 100,
  netReceived: 100,
  totalCost: 30,
  status: 'completed',
  items: [1, 2, 3].map(number => ({
    productId: `precision-${number}`,
    productName: `Produto ${number}`,
    quantity: 1,
    price: 1,
    cost: 10
  }))
};
const precisionProducts = buildReport({ reportId: 'products', sales: [precisionSale], startDate: '2026-09-01', endDate: '2026-09-30' });
assert.equal(metricValue(precisionProducts, 'Receita líquida alocada'), 100);
assert.equal(metricValue(precisionProducts, 'Lucro'), 70);

let source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
for (const patch of [
  applySetupPatches,
  applyReportsPatch,
  applyStockPatch,
  applyCancelPatch,
  applyProfitPatch,
  applySalePdfPatch,
  applyMobileMenuPatch,
  applyBatchStockPatch,
  applySecurityReliabilityPatch,
  applyAccountingPatch,
  applyFinalPatches
]) source = patch(source);

const generatedFile = '/tmp/registro-vendas-runtime-v70.mjs';
fs.writeFileSync(generatedFile, source);
checkSyntax(generatedFile);

for (const marker of [
  'financial-core-v70.js?v=70',
  'nova-venda-fixed-v70.js?v=70',
  'modals-fixed-v69.js?v=70',
  'normalizedSale = normalizeSaleMoney(data)',
  '...normalizedSale,',
  'applyInstallmentPayment(latestSale.installments',
  'reverseInstallmentPayment(latestSale.installments',
  'getSalesAccrualSummary(sales, dashStartDate, dashEndDate)',
  'getRealizedSalesProfit(sales, dashStartDate, dashEndDate)',
  'historyItem ? getHistoryCashAmount(historyItem)',
  'buildSaleInventoryPlan(requestedItems, inventoryRecords)',
  "setAccessDenied('deleted')",
  'Vendas não podem ser excluídas permanentemente'
]) assert.ok(source.includes(marker), `Proteção ou integração ausente na aplicação final: ${marker}`);

const financeSource = fs.readFileSync(new URL('../aba-financeiro-v68.js', import.meta.url), 'utf8');
assert.ok(financeSource.includes('buildFinancialLedger({ sales, products, financialData: data, purchaseGroups })'));
assert.ok(financeSource.includes('runTransaction(db, async transaction =>'));
assert.ok(!financeSource.includes('const makePurchaseGroup ='), 'Financeiro não deve manter uma segunda implementação de compras.');

const reportsSource = fs.readFileSync(new URL('../aba-relatorios-v65.js', import.meta.url), 'utf8');
assert.ok(reportsSource.includes("from './reports-engine-v70.js'"));

const salePdfSource = fs.readFileSync(new URL('../sale-pdf-v65.js', import.meta.url), 'utf8');
assert.ok(salePdfSource.includes('historyItem ? getHistoryCashAmount(historyItem)'));

const modalWrapper = fs.readFileSync(new URL('../modals-fixed-v69.js', import.meta.url), 'utf8');
assert.ok(modalWrapper.includes("import { getHistoryCashAmount } from './financial-core-v70.js';"));
assert.ok(modalWrapper.includes("h.type === \\'abatement\\' ? h.amount : getHistoryCashAmount(h)"));

const saleWrapper = fs.readFileSync(new URL('../nova-venda-fixed-v70.js', import.meta.url), 'utf8');
const patchBaseSale = extractFunction(saleWrapper, 'const patchBaseSale =', 'const patchPaymentWrapper =', 'patchBaseSale');
const patchPaymentWrapper = extractFunction(saleWrapper, 'const patchPaymentWrapper =', 'globalThis.fetch =', 'patchPaymentWrapper');
const patchedBaseSale = patchBaseSale(fs.readFileSync(new URL('../nova-venda.js', import.meta.url), 'utf8'));
const patchedPaymentWrapper = patchPaymentWrapper(fs.readFileSync(new URL('../nova-venda-fixed.js', import.meta.url), 'utf8'));
assert.ok(patchedBaseSale.includes("import { splitMoney } from './financial-core-v70.js';"));
assert.ok(patchedBaseSale.includes('const persistSale = async saleData =>'));
assert.ok(patchedPaymentWrapper.includes('const installmentAmounts = splitMoney(total, count);'));
assert.ok(patchedPaymentWrapper.includes('originalAmount: installmentAmounts[i],'));
assert.ok(!patchedPaymentWrapper.includes('const amountPerInstallment = total / count;'));
assert.ok(patchedPaymentWrapper.includes('await persistSale(approvedSaleData)'));

const legacyCalculationStart = patchedPaymentWrapper.indexOf('const calculationPattern =');
const legacyCalculationEnd = patchedPaymentWrapper.indexOf('\n\nif (!calculationPattern.test(source))', legacyCalculationStart);
assert.ok(legacyCalculationStart >= 0 && legacyCalculationEnd > legacyCalculationStart, 'O montador antigo de parcelas precisa ser exercitado no teste.');
const composedSale = Function('source', `${patchedPaymentWrapper.slice(legacyCalculationStart, legacyCalculationEnd)}
  if (!calculationPattern.test(source)) throw new Error('Cálculo de parcelas não localizado.');
  return source.replace(calculationPattern, correctedCalculation);`)(patchedBaseSale);
assert.ok(composedSale.includes('const persistSale = async saleData =>'), 'O formulário montado precisa manter a função que grava a venda.');
assert.ok(composedSale.indexOf('const persistSale = async saleData =>') < composedSale.indexOf('const calculateInstallments = () => {'));
assert.ok(composedSale.includes('const installmentAmounts = splitMoney(total, count);'), 'O formulário final deve manter o parcelamento exato.');
assert.ok(composedSale.includes('if (await persistSale(saleData)) onClose();'), 'A venda no caixa deve aguardar a gravação.');
assert.ok(composedSale.includes('if (await persistSale(saleDataToSave))'), 'A aprovação manual deve aguardar a gravação.');

const persistenceStart = composedSale.indexOf('    const persistSale = async saleData => {');
const persistenceEnd = composedSale.indexOf('    const calculateInstallments = () => {', persistenceStart);
assert.ok(persistenceStart >= 0 && persistenceEnd > persistenceStart);
const createSalePersistence = Function('dependencies', `
  const { savingSaleRef, setSavingSale, onSaveSale, alert } = dependencies;
  const console = { error() {} };
  ${composedSale.slice(persistenceStart, persistenceEnd)}
  return persistSale;
`);

let releaseCommit;
const pendingCommit = new Promise(resolve => { releaseCommit = resolve; });
let saveAttempts = 0;
const busyStates = [];
const persistenceRef = { current: false };
const persistSale = createSalePersistence({
  savingSaleRef: persistenceRef,
  setSavingSale: value => busyStates.push(value),
  onSaveSale: () => { saveAttempts += 1; return pendingCommit; },
  alert: () => {}
});
const firstAttempt = persistSale({ id: 'venda-1' });
assert.equal(await persistSale({ id: 'venda-duplicada' }), false, 'Um segundo clique durante a gravação deve ser ignorado.');
assert.equal(saveAttempts, 1, 'Dois cliques não podem criar duas vendas.');
releaseCommit();
assert.equal(await firstAttempt, true);
assert.deepEqual(busyStates, [true, false]);
assert.equal(persistenceRef.current, false, 'O bloqueio deve ser liberado após gravar.');

const failureAlerts = [];
const failedRef = { current: false };
const failedPersistence = createSalePersistence({
  savingSaleRef: failedRef,
  setSavingSale: () => {},
  onSaveSale: async () => { throw new Error('Estoque atualizado por outra venda.'); },
  alert: message => failureAlerts.push(message)
});
assert.equal(await failedPersistence({ id: 'venda-com-falha' }), false);
assert.deepEqual(failureAlerts, ['Estoque atualizado por outra venda.']);
assert.equal(failedRef.current, false, 'Falhas devem permitir uma nova tentativa.');

fs.writeFileSync('/tmp/registro-vendas-new-sale-base-v70.mjs', patchedBaseSale);
checkSyntax('/tmp/registro-vendas-new-sale-base-v70.mjs');
fs.writeFileSync('/tmp/registro-vendas-new-sale-composed-v70.mjs', composedSale);
checkSyntax('/tmp/registro-vendas-new-sale-composed-v70.mjs');

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.ok(
  index.includes('bootstrap-v70.js?v=70') || index.includes('bootstrap-v71.js?v=71') || index.includes('bootstrap-v71.js?v=72') || index.includes('bootstrap-v71.js?v=73') || index.includes('bootstrap-v71.js?v=74') || index.includes('bootstrap-v75.js?v=75') || index.includes('bootstrap-v75.js?v=76'),
  'A versão v70 ou uma sucessora compatível precisa estar ativa.'
);

console.log('Aplicação v70 validada: relatórios conciliados, compras parceladas, cancelamentos por competência, excedentes e centavos exatos.');
