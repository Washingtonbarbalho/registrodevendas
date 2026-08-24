import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildCollectionMessage,
  buildCollectionQueue,
  buildRepurchaseMessage,
  buildRepurchaseSuggestions,
  buildWhatsappUrl,
  calculateMonthlyGoals,
  cleanWhatsappPhone,
  getProductRepurchaseCycleDays,
  normalizeCommercialGoals
} from '../commercial-engine-v74.js';
import { buildReportWorkbookModel, parseReportCell } from '../report-export-v74.js';

const root = new URL('..', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const checkSyntax = file => {
  const path = fileURLToPath(new URL(file, root));
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Erro de sintaxe em ${file}:\n${result.stderr || result.stdout}`);
};

for (const file of [
  'commercial-engine-v74.js', 'aba-comercial-v74.js', 'report-export-v74.js',
  'app-patch-commercial-v74.js', 'aba-relatorios-v73.js', 'bootstrap-v71.js',
  'app-patch-final-v71.js', 'modals.js', 'tab-persistence.js', 'scripts/validate-v74.mjs'
]) checkSyntax(file);

const today = '2026-08-23';
const customers = [
  { id: 'ana', name: 'ANA MARIA', phone: '(88) 99999-0000' },
  { id: 'bruno', name: 'BRUNO LIMA', phone: '' },
  { id: 'carla', name: 'CARLA SOUZA', phone: '88988887777' }
];
const products = [
  { id: 'perfume', name: 'PERFUME FLORAL', repurchaseCycleDays: 30 },
  { id: 'creme', name: 'CREME CORPORAL' },
  { id: 'desativado', name: 'PRODUTO SEM CONTATO', repurchaseCycleDays: 0 },
  { id: 'sabonete', name: 'SABONETE', repurchaseCycleDays: 14 }
];

const item = (productId, productName, price = 50) => ({
  productId, productName, quantity: 1, unitPrice: price, unitCost: price / 2, price, cost: price / 2
});

const termSale = {
  id: 'term-ana', customerId: 'ana', customerName: 'ANA ANTIGA', customerPhone: '8800000000',
  saleType: 'prazo', saleDate: '2026-07-01', status: 'active', totalPrice: 120, totalCost: 50,
  installmentsCount: 5, items: [item('perfume', 'PERFUME FLORAL', 120)],
  installments: [
    { number: 1, amount: 33.34, originalAmount: 33.34, dueDate: '2026-08-20', paid: false },
    { number: 2, amount: 33.33, originalAmount: 33.33, dueDate: '2026-08-23', paid: false },
    { number: 3, amount: 33.33, originalAmount: 33.33, dueDate: '2026-08-30', paid: false },
    { number: 4, amount: 20, originalAmount: 50, dueDate: '2026-08-21', paid: false, history: [{ amount: 30, date: '2026-08-10' }] },
    { number: 5, amount: 20, originalAmount: 20, dueDate: '2026-08-31', paid: false },
    { number: 6, amount: 0, originalAmount: 20, dueDate: '2026-08-18', paid: true, paidAt: '2026-08-18' }
  ]
};
const canceledTerm = {
  ...termSale,
  id: 'term-canceled',
  customerId: 'carla',
  status: 'canceled',
  cancellations: [{
    id: 'cancel-term', type: 'total', date: '2026-08-18', canceledContractValue: 120,
    canceledCostAmount: 50, storeImpactAmount: 0, items: []
  }]
};

const anaEarlier = {
  id: 'ana-earlier', customerId: 'ana', customerName: 'ANA', saleType: 'direct', saleDate: '2026-06-01',
  status: 'completed', totalPrice: 40, totalCost: 20, items: [item('perfume', 'PERFUME FLORAL', 40)]
};
const anaLatest = {
  id: 'ana-latest', customerId: 'ana', customerName: 'ANA', saleType: 'direct', saleDate: '2026-07-25',
  status: 'completed', totalPrice: 60, totalCost: 30, items: [item('perfume', 'PERFUME FLORAL', 60)]
};
const brunoDefaultCycle = {
  id: 'bruno-creme', customerId: 'bruno', customerName: 'BRUNO', saleType: 'direct', saleDate: '2026-06-20',
  status: 'completed', totalPrice: 50, totalCost: 25, items: [item('creme', 'CREME CORPORAL', 50)]
};
const carlaToday = {
  id: 'carla-sabonete', customerId: 'carla', customerName: 'CARLA', saleType: 'direct', saleDate: '2026-08-09',
  status: 'completed', totalPrice: 20, totalCost: 10, items: [item('sabonete', 'SABONETE', 20)]
};
const disabledProductSale = {
  id: 'disabled-product', customerId: 'ana', customerName: 'ANA', saleType: 'direct', saleDate: '2026-05-01',
  status: 'completed', totalPrice: 10, totalCost: 5, items: [item('desativado', 'PRODUTO SEM CONTATO', 10)]
};
const anonymousSale = {
  id: 'anonymous', customerName: 'VENDA AVULSA', saleType: 'direct', saleDate: '2026-07-25',
  status: 'completed', totalPrice: 60, totalCost: 30, items: [item('perfume', 'PERFUME FLORAL', 60)]
};
const canceledRecentPurchase = {
  id: 'recent-canceled', customerId: 'ana', customerName: 'ANA', saleType: 'direct', saleDate: '2026-08-10',
  status: 'canceled', totalPrice: 70, totalCost: 35, items: [item('perfume', 'PERFUME FLORAL', 70)],
  cancellations: [{ id: 'recent-cancel', type: 'total', date: '2026-08-11', canceledContractValue: 70, canceledCostAmount: 35, storeImpactAmount: 70 }]
};

const commercialSales = [
  termSale, canceledTerm, anaEarlier, anaLatest, brunoDefaultCycle, carlaToday,
  disabledProductSale, anonymousSale, canceledRecentPurchase
];

const queue = buildCollectionQueue({ sales: commercialSales, customers, today, horizonDays: 7 });
assert.deepEqual(queue.map(entry => entry.installmentNumber), [1, 4, 2, 3]);
assert.deepEqual(queue.map(entry => entry.status), ['overdue', 'overdue', 'today', 'upcoming']);
assert.equal(queue.reduce((cents, entry) => cents + Math.round(entry.amount * 100), 0), 12_000,
  'Cobranças precisam preservar pagamentos parciais e diferenças de centavos.');
assert.equal(queue[0].customerName, 'ANA MARIA', 'O cadastro atual deve prevalecer sobre o telefone e nome históricos.');
assert.equal(queue[0].whatsappPhone, '5588999990000');
assert.ok(!queue.some(entry => entry.saleId === 'term-canceled'));
assert.ok(!queue.some(entry => entry.dueDate === '2026-08-31'));

const suggestions = buildRepurchaseSuggestions({ sales: commercialSales, products, customers, today, horizonDays: 14 });
assert.deepEqual(suggestions.map(entry => [entry.customerId, entry.productId, entry.status]), [
  ['bruno', 'creme', 'overdue'],
  ['carla', 'sabonete', 'today'],
  ['ana', 'perfume', 'upcoming']
]);
assert.equal(suggestions[0].cycleDays, 60, 'Produtos antigos devem usar o ciclo padrão de 60 dias.');
assert.equal(suggestions[0].noPhone, true, 'A oportunidade pode ser exibida sem inventar um telefone.');
assert.equal(suggestions[2].lastPurchaseDate, '2026-07-25', 'A compra cancelada não pode reiniciar o ciclo de recompra.');
assert.ok(!suggestions.some(entry => entry.productId === 'desativado'));
assert.ok(!suggestions.some(entry => entry.customerName === 'VENDA AVULSA'));
assert.equal(getProductRepurchaseCycleDays({}), 60);
assert.equal(getProductRepurchaseCycleDays({ repurchaseCycleDays: 0 }), 0);
assert.equal(getProductRepurchaseCycleDays({ repurchaseCycleDays: 900 }), 730);

assert.equal(cleanWhatsappPhone('(88) 99999-0000'), '5588999990000');
assert.equal(cleanWhatsappPhone('5588999990000'), '5588999990000');
assert.equal(cleanWhatsappPhone('123'), '');
const collectionMessage = buildCollectionMessage({ entry: queue[0], storeName: 'Minha Loja', pixKey: 'minha-chave' });
assert.match(collectionMessage, /R\$\s*33,34/);
assert.match(collectionMessage, /venceu em 20\/08\/2026/);
assert.match(collectionMessage, /Chave PIX: minha-chave/);
assert.ok(buildWhatsappUrl(queue[0].phone, collectionMessage).startsWith('https://wa.me/5588999990000?text='));
const repurchaseMessage = buildRepurchaseMessage({ entry: suggestions[2], storeName: 'Minha Loja' });
assert.match(repurchaseMessage, /PERFUME FLORAL/);
assert.match(repurchaseMessage, /Sem compromisso/);

const augustSale = {
  id: 'august-valid', customerId: 'ana', customerName: 'ANA', saleType: 'direct', saleDate: '2026-08-05',
  status: 'completed', totalPrice: 80, netReceived: 80, totalCost: 30, items: [item('perfume', 'PERFUME FLORAL', 80)]
};
const augustCanceled = {
  id: 'august-canceled', customerId: 'carla', customerName: 'CARLA', saleType: 'direct', saleDate: '2026-08-06',
  status: 'canceled', totalPrice: 50, netReceived: 50, totalCost: 20, items: [item('sabonete', 'SABONETE', 50)],
  cancellations: [{ id: 'august-cancel', type: 'total', date: '2026-08-20', canceledContractValue: 50, canceledCostAmount: 20, storeImpactAmount: 50 }]
};
const oldCanceledInAugust = {
  id: 'old-canceled', customerId: 'bruno', customerName: 'BRUNO', saleType: 'direct', saleDate: '2026-06-01',
  status: 'canceled', totalPrice: 30, netReceived: 30, totalCost: 12, items: [item('creme', 'CREME CORPORAL', 30)],
  cancellations: [{ id: 'old-cancel', type: 'total', date: '2026-08-10', canceledContractValue: 30, canceledCostAmount: 12, storeImpactAmount: 30 }]
};
const goals = normalizeCommercialGoals({
  '2026-08': { revenue: '100.00', salesCount: '2', recurringCustomers: 2 },
  invalid: { revenue: 999 },
  '2026-09': { revenue: -1, salesCount: -2, recurringCustomers: -3 }
});
assert.deepEqual(goals['2026-08'], { revenue: 100, salesCount: 2, recurringCustomers: 2 });
assert.deepEqual(goals['2026-09'], { revenue: 0, salesCount: 0, recurringCustomers: 0 });
assert.ok(!goals.invalid);
const goalResult = calculateMonthlyGoals({
  sales: [anaLatest, augustSale, augustCanceled, oldCanceledInAugust], customers, goals, month: '2026-08', today
});
assert.equal(goalResult.metrics.find(metric => metric.id === 'revenue').actual, 50,
  'Cancelamentos do próprio mês e de meses anteriores devem afetar a meta exatamente no mês do estorno.');
assert.equal(goalResult.metrics.find(metric => metric.id === 'salesCount').actual, 1);
assert.equal(goalResult.metrics.find(metric => metric.id === 'recurringCustomers').actual, 1);
assert.ok(goalResult.metrics.every(metric => metric.percent === 50));
const noGoal = calculateMonthlyGoals({ sales: [], customers: [], goals: {}, month: '2026-08', today });
assert.ok(noGoal.metrics.every(metric => metric.percent === 0 && Number.isFinite(metric.progress)));

const report = {
  id: 'commercial-test', title: 'Relatório de teste', subtitle: 'Dados conciliados',
  metrics: [
    { label: 'Receita', type: 'currency', value: 1234.56 },
    { label: 'Margem', type: 'percent', value: 12.5 },
    { label: 'Vendas', type: 'number', value: 4 }
  ],
  columns: ['Data', 'Valor', 'Margem', 'Código'],
  rows: [['23/08/2026', 'R$\u00a01.234,56', '12,5%', '000001']],
  comparison: {
    currentPeriod: { startDate: '2026-08-01', endDate: '2026-08-23' },
    previousPeriod: { startDate: '2026-07-09', endDate: '2026-07-31' },
    metrics: [{ label: 'Receita', type: 'currency', current: 1234.56, previous: 1000, delta: 234.56, percent: 23.456 }]
  },
  notes: ['Valores originados do Registro de Vendas.']
};
const workbook = buildReportWorkbookModel({
  report, storeName: 'Minha Loja', startDate: '2026-08-01', endDate: '2026-08-23',
  paymentFilterLabel: 'PIX', saleChannelLabel: 'WhatsApp', generatedAt: new Date('2026-08-23T15:00:00Z')
});
assert.deepEqual(workbook.sheets.map(sheet => sheet.name), ['Resumo', 'Comparação', 'Detalhamento', 'Observações']);
assert.ok(workbook.filename.endsWith('.xlsx'));
const detailRow = workbook.sheets.find(sheet => sheet.name === 'Detalhamento').rows[4];
assert.ok(detailRow[0] instanceof Date, 'Datas precisam ser células de data, não texto.');
assert.equal(detailRow[1], 1234.56, 'Moeda precisa ser numérica no Excel.');
assert.equal(detailRow[2], 0.125, 'Percentuais precisam ser numéricos no Excel.');
assert.equal(detailRow[3], '000001', 'Códigos com zero à esquerda precisam continuar como texto.');
assert.equal(parseReportCell('-R$\u00a012,34'), -12.34);
assert.equal(parseReportCell('1.234'), 1234);
assert.equal(parseReportCell('000123'), '000123');

const commercialUi = read('aba-comercial-v74.js');
for (const marker of ['Régua de cobrança', 'Sugestões de recompra', 'Editar metas', 'buildWhatsappUrl', 'commercialGoalsUpdatedAt']) {
  assert.ok(commercialUi.includes(marker), `Interface Comercial incompleta: ${marker}`);
}
const reportUi = read('aba-relatorios-v73.js');
for (const marker of ['createReportExcelFile', 'Compartilhar', 'downloadFile', "type: 'application/pdf'"]) {
  assert.ok(reportUi.includes(marker), `Exportação de relatório incompleta: ${marker}`);
}
const productModal = read('modals.js');
for (const marker of ['repurchaseCycleDays', 'Recompra do cliente (dias)', 'use 0 para desativar']) {
  assert.ok(productModal.includes(marker), `Ciclo de recompra ausente no produto: ${marker}`);
}
const rules = read('firestore.rules');
assert.ok(rules.includes("'commercialGoals', 'commercialGoalsUpdatedAt'"));
const index = read('index.html');
assert.ok(index.includes('v74-commercial.css?v=74'));
assert.ok(index.includes('bootstrap-v71.js?v=74'));
const bootstrap = read('bootstrap-v71.js');
assert.ok(bootstrap.includes('applyCommercialPatch'));
assert.ok(bootstrap.includes("['Comercial', './aba-comercial-v74.js?v=74'"));
assert.ok(bootstrap.includes("import('./report-export-v74.js?v=74')"));

const inherited = spawnSync(process.execPath, ['scripts/validate-v73.mjs'], {
  cwd: fileURLToPath(root), encoding: 'utf8'
});
if (inherited.status !== 0) throw new Error(`Regressão herdada da v73:\n${inherited.stderr || inherited.stdout}`);
process.stdout.write(inherited.stdout);

const generated = fs.readFileSync('/tmp/registro-vendas-runtime-v71.mjs', 'utf8');
for (const marker of [
  "import { AbaComercial }", "{ id: 'commercial', label: 'Comercial'",
  "view === 'commercial' ? React.createElement(AbaComercial",
  "const mobilePrimaryNav = ['dashboard', 'sales', 'products', 'customers']"
]) assert.ok(generated.includes(marker), `Integração final ausente: ${marker}`);
assert.ok(!generated.includes("const mobilePrimaryNav = ['dashboard', 'sales', 'products', 'commercial']"),
  'A aba Comercial não deve substituir Clientes na barra rápida mobile.');

console.log('Aplicação v74 validada: cobranças, recompra, metas, compartilhamento e Excel estruturado sem regressões.');
