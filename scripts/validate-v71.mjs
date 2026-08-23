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
import { applyOperationsPatch } from '../app-patch-operations-v71.js';
import { applyFinalPatches } from '../app-patch-final-v71.js';
import {
  buildSalesView,
  getOperationalSaleStatus,
  getOperationalSaleType,
  getSalePendingAmount,
  summarizeSalesView
} from '../sales-operations-v71.js';

globalThis.location = new URL('https://example.test/registrodevendas/');

const checkSyntax = file => {
  const path = file instanceof URL ? fileURLToPath(file) : file;
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Erro de sintaxe em ${path}:\n${result.stderr || result.stdout}`);
};

for (const file of [
  'bootstrap-v71.js',
  'sales-operations-v71.js',
  'aba-vendas-v71.js',
  'auth-screen-v71.js',
  'app-patch-operations-v71.js',
  'app-patch-final-v71.js',
  'tab-persistence.js'
]) checkSyntax(new URL(`../${file}`, import.meta.url));

const directAugust = {
  id: 'direct-august',
  saleType: 'direct',
  saleDate: '2026-08-20',
  saleDateTime: '2026-08-20T14:30:00.000Z',
  customerName: 'João da Silva',
  paymentMethod: 'pix',
  status: 'completed',
  totalPrice: 100,
  netReceived: 100,
  items: [{ productName: 'Creme de ação rápida', productCode: '000123' }]
};
const oldOpenTerm = {
  id: 'term-open',
  saleType: 'prazo',
  saleDate: '2026-05-10',
  customerName: 'Maria Souza',
  status: 'active',
  totalPrice: 90,
  installments: [
    { number: 1, amount: 0, paid: true, dueDate: '2026-06-10' },
    { number: 2, amount: 30.01, paid: false, dueDate: '2026-07-10' },
    { number: 3, amount: 29.99, paid: false, dueDate: '2026-08-10' }
  ],
  items: [{ productName: 'Perfume' }]
};
const oldCompletedTerm = {
  id: 'term-completed-old',
  saleType: 'prazo',
  saleDate: '2026-05-03',
  customerName: 'Cliente antigo',
  status: 'completed',
  totalPrice: 50,
  installments: [{ amount: 0, paid: true, dueDate: '2026-06-03' }]
};
const canceledAugust = {
  id: 'canceled-august',
  saleType: 'direct',
  saleDate: '2026-08-05',
  customerName: 'Venda cancelada',
  status: 'canceled',
  totalPrice: 40
};
const futureOpenTerm = {
  ...oldOpenTerm,
  id: 'term-future',
  saleDate: '2026-09-02',
  customerName: 'Venda futura'
};
const sales = [oldCompletedTerm, directAugust, canceledAugust, oldOpenTerm, futureOpenTerm];
const period = { currentStart: '2026-08-01', currentEnd: '2026-08-31' };

assert.equal(getOperationalSaleType(oldOpenTerm), 'term');
assert.equal(getOperationalSaleType(directAugust), 'direct');
assert.equal(getOperationalSaleStatus(oldOpenTerm), 'open');
assert.equal(getOperationalSaleStatus(canceledAugust), 'canceled');
assert.equal(getSalePendingAmount(oldOpenTerm), 60, 'O saldo deve continuar exato em centavos.');

const defaultView = buildSalesView({ sales, ...period });
assert.deepEqual(defaultView.map(sale => sale.id), ['term-open', 'direct-august', 'canceled-august']);
assert.ok(!defaultView.some(sale => sale.id === oldCompletedTerm.id), 'Vendas antigas quitadas não devem poluir o mês atual.');
assert.ok(defaultView.some(sale => sale.id === oldOpenTerm.id), 'Pendências antigas devem permanecer visíveis.');
assert.ok(!defaultView.some(sale => sale.id === futureOpenTerm.id), 'Vendas futuras não devem aparecer no mês atual.');

const accentedSearch = buildSalesView({ sales, ...period, query: 'creme de acao', type: 'direct' });
assert.deepEqual(accentedSearch.map(sale => sale.id), ['direct-august'], 'A busca deve ignorar acentos e combinar com o tipo.');

const strictCustomSearch = buildSalesView({
  sales,
  query: 'Maria',
  period: 'custom',
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  ...period
});
assert.equal(strictCustomSearch.length, 0, 'A busca não pode ignorar o período personalizado.');

const openOnly = buildSalesView({ sales, ...period, status: 'open' });
assert.deepEqual(openOnly.map(sale => sale.id), ['term-open']);
const allHistory = buildSalesView({ sales, ...period, period: 'all', sort: 'oldest' });
assert.equal(allHistory.length, 5);
assert.equal(allHistory[0].id, 'term-completed-old');

const summary = summarizeSalesView(defaultView);
assert.deepEqual({ count: summary.count, direct: summary.directCount, term: summary.termCount, open: summary.openCount }, {
  count: 3,
  direct: 2,
  term: 1,
  open: 1
});
assert.equal(summary.pendingAmount, 60);
assert.equal(summary.cashNetAmount, 100, 'Vendas canceladas não podem entrar no resumo de caixa.');

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
  applyOperationsPatch,
  applyFinalPatches
]) source = patch(source);

const generatedFile = '/tmp/registro-vendas-runtime-v71.mjs';
fs.writeFileSync(generatedFile, source);
checkSyntax(generatedFile);

for (const marker of [
  'aba-vendas-v71.js?v=71',
  'auth-screen-v71.js?v=71',
  "{ id: 'sales', label: 'Vendas', shortLabel: 'Vendas'",
  "view === 'sales' ? React.createElement(AbaVendas",
  'mobile-quick-nav',
  'quick-sale-sheet',
  'buildSaleInventoryPlan(requestedItems, inventoryRecords)',
  'getSalesAccrualSummary(sales, dashStartDate, dashEndDate)',
  "setAccessDenied('deleted')"
]) assert.ok(source.includes(marker), `Integração v71 ausente: ${marker}`);

for (const obsolete of [
  "view === 'cashier'",
  'AbaVendasPrazo',
  'AbaVendasCaixa',
  'cashierSearch',
  'salesSearch',
  "{ id: 'cashier'"
]) assert.ok(!source.includes(obsolete), `Fluxo duplicado ainda presente: ${obsolete}`);

const authSource = fs.readFileSync(new URL('../auth-screen-v71.js', import.meta.url), 'utf8');
for (const marker of ['sendPasswordResetEmail', "autoComplete: 'current-password'", 'Lembrar meu e-mail', "type: 'submit'"]) {
  assert.ok(authSource.includes(marker), `Simplificação do login ausente: ${marker}`);
}
assert.ok(!authSource.includes("localStorage.setItem('password'"), 'A senha nunca pode ser persistida no aparelho.');

const salesUi = fs.readFileSync(new URL('../aba-vendas-v71.js', import.meta.url), 'utf8');
for (const marker of ['Mês atual + pendências', 'Todo o histórico', 'Período personalizado', 'Venda no caixa', 'Venda a prazo']) {
  assert.ok(salesUi.includes(marker), `Filtro ou ação de vendas ausente: ${marker}`);
}

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.ok(index.includes('bootstrap-v71.js?v=71'), 'A versão v71 precisa estar ativa.');
assert.ok(index.includes('v71-operations.css?v=71'), 'Os estilos operacionais v71 precisam estar ativos.');

const inherited = spawnSync(process.execPath, ['scripts/validate-v70.mjs'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  encoding: 'utf8'
});
if (inherited.status !== 0) throw new Error(`Regressão na v70:\n${inherited.stderr || inherited.stdout}`);

console.log('Aplicação v71 validada: vendas unificadas, filtros combinados, navegação mobile rápida e login em uma etapa.');
