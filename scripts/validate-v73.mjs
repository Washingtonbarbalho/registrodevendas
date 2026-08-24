import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildPeriodComparison,
  buildRecurringCustomers,
  buildReport,
  buildReplenishmentForecast,
  countPeriodDays,
  getNetOperatingResult,
  getPreviousEquivalentPeriod,
  getProductLeadTimeDays,
  getProductMinimumStock,
  getSaleChannel,
  REPORT_DEFINITIONS,
  SALE_CHANNELS,
  STRATEGIC_REPORTS
} from '../reports-engine-v73.js';
import { buildSalesView } from '../sales-operations-v71.js';

const checkSyntax = file => {
  const path = fileURLToPath(new URL(`../${file}`, import.meta.url));
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Erro de sintaxe em ${file}:\n${result.stderr || result.stdout}`);
};

for (const file of [
  'reports-engine-v73.js', 'aba-relatorios-v73.js', 'bootstrap-v71.js', 'app-patch-final-v71.js',
  'app-patch-operations-v71.js', 'nova-venda.js', 'modals.js', 'aba-produtos-v67.js',
  'aba-vendas-v71.js', 'sales-operations-v71.js'
]) checkSyntax(file);

const metricValue = (report, label) => {
  const found = report.metrics.find(item => item.label === label);
  assert.ok(found, `Indicador ausente: ${label}`);
  return found.value;
};

assert.equal(REPORT_DEFINITIONS.length, 15, 'Os dez relatórios existentes devem coexistir com cinco análises estratégicas.');
assert.equal(new Set(REPORT_DEFINITIONS.map(item => item.id)).size, 15, 'Não pode haver relatórios duplicados.');
assert.deepEqual(STRATEGIC_REPORTS.map(item => item.id), [
  'period-comparison', 'net-result', 'sales-channels', 'stock-replenishment', 'repeat-customers'
]);
assert.equal(countPeriodDays('2026-08-01', '2026-08-10'), 10);
assert.equal(countPeriodDays('2026-08-10', '2026-08-01'), 0);
assert.deepEqual(getPreviousEquivalentPeriod('2026-08-01', '2026-08-10'), {
  startDate: '2026-07-22', endDate: '2026-07-31', days: 10
});
assert.deepEqual(getPreviousEquivalentPeriod('2024-03-01', '2024-03-03'), {
  startDate: '2024-02-27', endDate: '2024-02-29', days: 3
}, 'Anos bissextos precisam manter períodos equivalentes.');
assert.equal(getPreviousEquivalentPeriod('2026-08-03', '2026-08-02'), null);

assert.equal(getSaleChannel({ saleChannel: 'Instagram' }), 'instagram');
assert.equal(getSaleChannel({ channel: 'WhatsApp Business' }), 'whatsapp');
assert.equal(getSaleChannel({ salesChannel: 'BALCÃO' }), 'presencial');
assert.equal(getSaleChannel({ origin: 'Marketplace' }), 'facebook');
assert.equal(getSaleChannel({ saleChannel: 'Site próprio' }), 'outro');
assert.equal(getSaleChannel({}), 'unknown', 'Não se deve inventar canais para vendas antigas.');
assert.ok(SALE_CHANNELS.some(([channel]) => channel === 'unknown'));
assert.equal(getProductMinimumStock({}), 3);
assert.equal(getProductMinimumStock({ minimumStock: 0 }), 0, 'Um mínimo zero explicitamente configurado precisa ser preservado.');
assert.equal(getProductMinimumStock({ minimumStock: 8.9 }), 8);
assert.equal(getProductMinimumStock({ minimumStock: -2 }), 3);
assert.equal(getProductLeadTimeDays({}), 7);
assert.equal(getProductLeadTimeDays({ replenishmentLeadTimeDays: 0 }), 0);
assert.equal(getProductLeadTimeDays({ replenishmentLeadTimeDays: 800 }), 365);

const item = (productId, productName, count, price, cost) => ({
  productId, productName, quantity: count, unitPrice: price / count, unitCost: cost / count, price, cost
});

const aliceJuly = {
  id: 'alice-july', customerId: 'alice', customerName: 'Alice', customerPhone: '85999990001',
  saleType: 'direct', paymentMethod: 'credit', saleChannel: 'instagram', saleDate: '2026-07-24',
  status: 'completed', totalPrice: 100, netReceived: 98, totalCost: 40,
  feeConfig: { type: 'sem_juros', value: 2 }, items: [item('cream', 'Creme', 2, 100, 40)]
};
const bobCanceled = {
  id: 'bob-july', customerId: 'bob', customerName: 'Bob', saleType: 'direct', paymentMethod: 'pix',
  saleChannel: 'whatsapp', saleDate: '2026-07-30', status: 'canceled', totalPrice: 30,
  netReceived: 30, totalCost: 12, items: [item('perfume', 'Perfume', 1, 30, 12)],
  cancellations: [{
    id: 'bob-august-cancellation', type: 'total', date: '2026-08-09', canceledContractValue: 30,
    canceledCostAmount: 12, storeImpactAmount: 30, refundAmount: 30,
    items: [{ productId: 'perfume', productName: 'Perfume', quantity: 1, amount: 30, canceledCostAmount: 12 }]
  }]
};
const aliceInstagram = {
  id: 'alice-august-instagram', customerId: 'alice', customerName: 'Alice', customerPhone: '85999990001',
  saleType: 'direct', paymentMethod: 'credit', saleChannel: 'instagram', saleDate: '2026-08-02',
  status: 'completed', totalPrice: 120, netReceived: 116, totalCost: 50,
  feeConfig: { type: 'sem_juros', value: 4 }, items: [item('cream', 'Creme', 2, 120, 50)]
};
const aliceWhatsApp = {
  id: 'alice-august-whatsapp', customerId: 'alice', customerName: 'Alice', customerPhone: '85999990001',
  saleType: 'direct', paymentMethod: 'pix', saleChannel: 'whatsapp', saleDate: '2026-08-05',
  status: 'completed', totalPrice: 60, netReceived: 60, totalCost: 24,
  items: [item('cream', 'Creme', 1, 60, 24)]
};
const carolPresential = {
  id: 'carol-august', customerId: 'carol', customerName: 'Carol', saleType: 'direct', paymentMethod: 'money',
  saleChannel: 'presencial', saleDate: '2026-08-07', status: 'completed', totalPrice: 50,
  netReceived: 50, totalCost: 20, items: [item('perfume', 'Perfume', 1, 50, 20)]
};
const oldUnclassified = {
  id: 'anonymous-august', customerId: null, customerName: 'VENDA AVULSA', saleType: 'direct',
  paymentMethod: 'pix', saleDate: '2026-08-08', status: 'completed', totalPrice: 25,
  netReceived: 25, totalCost: 10, items: [item('lipstick', 'Batom', 1, 25, 10)]
};
const daveHistory = [1, 11].map(day => ({
  id: `dave-may-${day}`, customerId: 'dave', customerName: 'Dave', saleType: 'direct', paymentMethod: 'pix',
  saleChannel: 'presencial', saleDate: `2026-05-${String(day).padStart(2, '0')}`,
  status: 'completed', totalPrice: 20, netReceived: 20, totalCost: 8, items: []
}));

const sales = [aliceJuly, bobCanceled, aliceInstagram, aliceWhatsApp, carolPresential, oldUnclassified, ...daveHistory];
const products = [
  {
    id: 'cream', name: 'Creme', quantity: 2, minimumStock: 3, replenishmentLeadTimeDays: 7,
    costPrice: 20, salePrice: 60,
    movements: [{ id: 'purchase-cream', type: 'compra', quantity: 5, unitCost: 20,
      date: '2026-08-03T12:00:00.000Z', paymentMethod: 'pix' }]
  },
  { id: 'perfume', name: 'Perfume', quantity: 8, minimumStock: 2, replenishmentLeadTimeDays: 5, costPrice: 12, salePrice: 50 },
  { id: 'lipstick', name: 'Batom', quantity: 0, costPrice: 10, salePrice: 25 }
];
const financialData = {
  entries: [
    { id: 'rent', type: 'expense', value: 12.35, date: '2026-08-04', description: 'Aluguel', category: 'Estrutura' },
    { id: 'bonus', type: 'income', value: 3.01, date: '2026-08-06', description: 'Bonificação', category: 'Receitas extras' }
  ],
  accounts: [
    { id: 'energy', direction: 'payable', value: 7.66, paid: true, paidAt: '2026-08-06', description: 'Energia' },
    { id: 'partner', direction: 'receivable', value: 4.40, paid: true, paidAt: '2026-08-08', description: 'Parceria' },
    { id: 'future', direction: 'payable', value: 80, paid: false, dueDate: '2026-08-09', description: 'Ainda não paga' }
  ]
};
const context = {
  sales,
  products,
  customers: [{ id: 'alice', name: 'Alice Ferreira' }, { id: 'carol', name: 'Carol Lima' }, { id: 'dave', name: 'Dave Souza' }],
  financialData,
  startDate: '2026-08-01',
  endDate: '2026-08-10'
};

const net = getNetOperatingResult(context);
assert.equal(net.accrual.gross, 225, 'Cancelamento de venda antiga precisa reduzir o mês do cancelamento.');
assert.equal(net.accrual.net, 221);
assert.equal(net.accrual.cost, 92);
assert.equal(net.accrual.profit, 129);
assert.equal(net.operatingIncome, 7.41, 'Receitas manuais e contas recebidas devem entrar no resultado.');
assert.equal(net.operatingExpenses, 20.01, 'Despesas manuais e contas pagas devem entrar no resultado.');
assert.equal(net.netResult, 116.4, 'A compra de estoque não pode ser abatida uma segunda vez.');
assert.ok(net.cash.rows.some(row => row.source === 'stock' && row.amount === 100));
assert.ok(!net.operatingRows.some(row => row.source === 'stock'));
assert.ok(!net.operatingRows.some(row => row.manual?.id === 'future'), 'Contas ainda não pagas não podem virar despesa realizada.');

const netReport = buildReport({ ...context, reportId: 'net-result' });
assert.equal(metricValue(netReport, 'Resultado líquido'), 116.4);
assert.equal(metricValue(netReport, 'Despesas operacionais'), 20.01);
assert.ok(netReport.comparison, 'O resultado deve oferecer comparação automática.');
assert.ok(netReport.notes.some(note => note.includes('não são descontadas novamente')));

const comparison = buildPeriodComparison(context);
assert.equal(comparison.days, 10);
assert.equal(comparison.previous.accrual.net, 128, 'O cancelamento futuro não pode alterar o período anterior.');
assert.equal(comparison.previous.netResult, 76);
assert.equal(comparison.metrics.find(entry => entry.label === 'Resultado líquido').delta, 40.4);
assert.equal(comparison.metrics.find(entry => entry.label === 'Vendas válidas').current, 4);
assert.equal(comparison.metrics.find(entry => entry.label === 'Clientes compradores').current, 2);
assert.equal(comparison.metrics.find(entry => entry.label === 'Ticket médio').current, 63.75,
  'Estornos de vendas antigas não podem distorcer o ticket das vendas realizadas agora.');
assert.equal(comparison.metrics.find(entry => entry.label === 'Despesas operacionais').tone, 'negative',
  'Aumento de despesas deve aparecer como alerta, e não como melhoria.');
const noBaseline = buildPeriodComparison({ ...context, startDate: '2026-05-01', endDate: '2026-05-03' });
assert.equal(noBaseline.metrics.find(entry => entry.label === 'Faturamento líquido').deltaDisplay, 'Novo');
const comparisonReport = buildReport({ ...context, reportId: 'period-comparison' });
assert.equal(metricValue(comparisonReport, 'Resultado líquido atual'), 116.4);
assert.equal(comparisonReport.rows.length, 6);

const channels = buildReport({ ...context, reportId: 'sales-channels' });
assert.equal(metricValue(channels, 'Faturamento líquido'), net.accrual.net,
  'A soma dos canais precisa bater exatamente com o resultado financeiro.');
assert.equal(metricValue(channels, 'Vendas sem canal informado'), 1);
assert.equal(channels.rows.find(row => row[0] === 'Instagram')?.[2], 'R$ 116,00');
assert.equal(channels.rows.find(row => row[0] === 'WhatsApp')?.[2], 'R$ 30,00',
  'O estorno de mês anterior deve permanecer associado ao canal original.');
assert.equal(channels.rows.find(row => row[0] === 'WhatsApp')?.[4], 'R$ 60,00',
  'O ticket do canal deve usar somente as vendas válidas realizadas no período.');
assert.ok(channels.rows.some(row => row[0] === 'Não informado'));
const instagramOnly = buildReport({ ...context, reportId: 'sales-channels', saleChannel: 'instagram' });
assert.equal(metricValue(instagramOnly, 'Faturamento líquido'), 116);
assert.deepEqual(instagramOnly.rows.map(row => row[0]), ['Instagram']);
const instagramSales = buildReport({ ...context, reportId: 'sales', saleChannel: 'instagram' });
assert.equal(metricValue(instagramSales, 'Vendas válidas'), 1);
assert.equal(metricValue(instagramSales, 'Faturamento'), 120);

const forecast = buildReplenishmentForecast(context);
const cream = forecast.find(entry => entry.product.id === 'cream');
const perfume = forecast.find(entry => entry.product.id === 'perfume');
const lipstick = forecast.find(entry => entry.product.id === 'lipstick');
assert.equal(cream.unitsSold, 3);
assert.equal(cream.coverageDays, 6);
assert.equal(cream.minimumStock, 3);
assert.equal(cream.leadTimeDays, 7);
assert.equal(cream.suggestedQuantity, 4);
assert.equal(cream.suggestedCost, 80);
assert.equal(cream.status, 'Abaixo do mínimo');
assert.equal(perfume.unitsSold, 0, 'Cancelamentos precisam reduzir o giro do próprio produto.');
assert.equal(perfume.coverageDays, null, 'Produto sem giro não pode receber previsão inventada.');
assert.equal(perfume.stockoutDate, null);
assert.equal(perfume.status, 'Sem giro no período');
assert.equal(lipstick.minimumStock, 3);
assert.equal(lipstick.leadTimeDays, 7);
assert.equal(lipstick.suggestedQuantity, 4);
assert.equal(lipstick.status, 'Sem estoque');
assert.equal(forecast[0].product.id, 'lipstick', 'Produtos sem estoque devem aparecer primeiro.');
const replenishment = buildReport({ ...context, reportId: 'stock-replenishment' });
assert.equal(metricValue(replenishment, 'Produtos no mínimo ou abaixo'), 2);
assert.equal(metricValue(replenishment, 'Produtos para repor agora'), 2);
assert.equal(metricValue(replenishment, 'Unidades sugeridas para compra'), 8);
assert.equal(metricValue(replenishment, 'Investimento estimado'), 120);

const customers = buildRecurringCustomers(context);
const alice = customers.find(entry => entry.identity === 'id:alice');
const dave = customers.find(entry => entry.identity === 'id:dave');
assert.equal(alice.name, 'Alice Ferreira');
assert.equal(alice.history.length, 3);
assert.equal(alice.periodSales.length, 2);
assert.equal(alice.periodRevenue, 180);
assert.equal(alice.averageInterval, 6);
assert.equal(alice.recurrent, true);
assert.equal(alice.returningInPeriod, true);
assert.equal(dave.status, 'Precisa de atenção');
assert.ok(!customers.some(entry => entry.identity === 'id:bob'), 'Clientes com venda totalmente cancelada não podem contar como compradores.');
assert.ok(!customers.some(entry => entry.name === 'VENDA AVULSA'), 'Vendas anônimas não podem inventar recorrência.');

const recurring = buildReport({ ...context, reportId: 'repeat-customers' });
assert.equal(metricValue(recurring, 'Clientes que compraram'), 2);
assert.equal(metricValue(recurring, 'Clientes recorrentes'), 1);
assert.equal(metricValue(recurring, 'Taxa de recorrência'), 50);
assert.equal(metricValue(recurring, 'Clientes que retornaram'), 1);
assert.equal(metricValue(recurring, 'Receita de clientes recorrentes'), 180);
assert.equal(metricValue(recurring, 'Clientes para reativar'), 1);

const channelSearch = buildSalesView({
  sales,
  query: 'instagram',
  period: 'custom',
  startDate: context.startDate,
  endDate: context.endDate
});
assert.deepEqual(channelSearch.map(sale => sale.id), ['alice-august-instagram']);

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const newSaleSource = read('nova-venda.js');
for (const marker of ["useState('presencial')", 'saleChannel,', 'Canal da venda', 'WhatsApp', 'Instagram']) {
  assert.ok(newSaleSource.includes(marker), `Canal de venda ausente no formulário: ${marker}`);
}
const productsSource = read('modals.js');
for (const marker of ['minimumStock', 'replenishmentLeadTimeDays', 'repurchaseCycleDays', 'Estoque mínimo', 'Reposição (dias)']) {
  assert.ok(productsSource.includes(marker), `Configuração do produto ausente: ${marker}`);
}
const uiSource = read('aba-relatorios-v73.js');
for (const marker of ['Análises estratégicas', 'Relatórios operacionais', 'Comparar com o período anterior equivalente', 'Comparação com o período anterior', 'createReportExcelFile', 'Compartilhar']) {
  assert.ok(uiSource.includes(marker), `Recurso da tela de relatórios ausente: ${marker}`);
}
const navigation = read('app-patch-operations-v71.js');
assert.ok(navigation.includes("['dashboard', 'sales', 'products', 'customers']"));
assert.ok(!navigation.includes("['dashboard', 'sales', 'products', 'finance']"));
const bootstrap = read('bootstrap-v71.js');
assert.ok(bootstrap.includes("['Relatórios', './aba-relatorios-v73.js?v=74'"));
assert.ok(bootstrap.includes("import('./reports-engine-v73.js?v=74')"));
const index = read('index.html');
assert.ok(index.includes('bootstrap-v75.js?v=76'));
assert.ok(index.includes('styles-runtime-v75.css?v=76'));

for (const validator of ['scripts/validate-v69.mjs', 'scripts/validate-v71.mjs']) {
  const inherited = spawnSync(process.execPath, [validator], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8'
  });
  if (inherited.status !== 0) throw new Error(`Regressão em ${validator}:\n${inherited.stderr || inherited.stdout}`);
  process.stdout.write(inherited.stdout);
}

console.log('Aplicação v74 validada: relatórios estratégicos preservados e prontos para a experiência comercial.');
