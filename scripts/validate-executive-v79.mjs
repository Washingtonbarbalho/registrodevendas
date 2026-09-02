import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ANALYSIS_PERIOD_STORAGE_PREFIX,
  readSharedAnalysisPeriod,
  resolveAnalysisPeriod,
  writeSharedAnalysisPeriod
} from '../analysis-period-v79.js';
import { buildExecutiveInsights } from '../executive-insights-v79.js';
import { applyReportFilters, getReportCategories, getReportFilterCapabilities } from '../report-filters-v79.js';
import {
  buildDailySalesEvolution,
  buildProductAbcClassification,
  buildReport,
  REPORT_DEFINITIONS,
  REPORT_GROUPS
} from '../reports-engine-v73.js';
import { buildReportCsvContent } from '../report-export-v74.js';

const today = '2026-08-25';
const memory = new Map();
const storage = {
  getItem: key => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value)
};

assert.deepEqual(resolveAnalysisPeriod('week', today), {
  period: 'week', startDate: '2026-08-19', endDate: '2026-08-25'
});
assert.deepEqual(resolveAnalysisPeriod('last30', today), {
  period: 'last30', startDate: '2026-07-27', endDate: '2026-08-25'
});
assert.deepEqual(resolveAnalysisPeriod('month', today), {
  period: 'month', startDate: '2026-08-01', endDate: '2026-08-31'
});
assert.deepEqual(resolveAnalysisPeriod('month', '2024-02-10'), {
  period: 'month', startDate: '2024-02-01', endDate: '2024-02-29'
});
assert.ok(writeSharedAnalysisPeriod('usuario-1', {
  period: 'custom', startDate: '2026-07-01', endDate: '2026-07-31'
}, { storage }));
assert.deepEqual(readSharedAnalysisPeriod('usuario-1', { storage, today }), {
  period: 'custom', startDate: '2026-07-01', endDate: '2026-07-31'
});
assert.ok(writeSharedAnalysisPeriod('usuario-1', resolveAnalysisPeriod('week', '2026-08-20'), { storage }));
assert.deepEqual(readSharedAnalysisPeriod('usuario-1', { storage, today }), {
  period: 'week', startDate: '2026-08-19', endDate: '2026-08-25'
}, 'Períodos móveis precisam avançar automaticamente quando o usuário volta em outro dia.');
assert.ok(memory.has(`${ANALYSIS_PERIOD_STORAGE_PREFIX}usuario-1`));
assert.ok(!writeSharedAnalysisPeriod('usuario-1', { period: 'custom', startDate: '', endDate: today }, { storage }));

const products = [
  { id: 'perfume', name: 'Perfume', category: 'Perfumaria', quantity: 1, minimumStock: 3, costPrice: 30, repurchaseCycleDays: 10 },
  { id: 'cream', name: 'Creme', category: 'Cuidados pessoais', quantity: 6, minimumStock: 2, costPrice: 5, repurchaseCycleDays: 60 },
  { id: 'soap', name: 'Sabonete', category: 'Cuidados pessoais', quantity: 4, minimumStock: 2, costPrice: 2, repurchaseCycleDays: 60 },
  { id: 'inactive', name: 'Produto parado', category: 'Perfumaria', quantity: 0, minimumStock: 3, costPrice: 8 }
];

const customers = [
  { id: 'alice', name: 'Alice', phone: '85999999991' },
  { id: 'bob', name: 'Bob', phone: '85999999992' },
  { id: 'carol', name: 'Carol', phone: '85999999993' }
];

const makeSale = ({ id, date, customer, product, value, cost, channel, payment }) => ({
  id,
  saleType: 'direct',
  saleDate: date,
  customerId: customer.id,
  customerName: customer.name,
  customerPhone: customer.phone,
  saleChannel: channel,
  paymentMethod: payment,
  status: 'completed',
  totalPrice: value,
  netReceived: value,
  totalCost: cost,
  items: [{ productId: product.id, productName: product.name, quantity: 1, price: value, cost }]
});

const sales = [
  makeSale({ id: 'previous', date: '2026-07-20', customer: customers[0], product: products[0], value: 40, cost: 15, channel: 'whatsapp', payment: 'pix' }),
  makeSale({ id: 'a', date: '2026-08-10', customer: customers[0], product: products[0], value: 80, cost: 30, channel: 'whatsapp', payment: 'pix' }),
  makeSale({ id: 'b', date: '2026-08-12', customer: customers[1], product: products[1], value: 15, cost: 5, channel: 'instagram', payment: 'debit' }),
  makeSale({ id: 'c', date: '2026-08-13', customer: customers[2], product: products[2], value: 5, cost: 2, channel: 'presencial', payment: 'money' })
];

const financialData = {
  entries: [
    { id: 'rent', type: 'expense', value: 10, date: '2026-08-12', description: 'Aluguel', category: 'Estrutura' },
    { id: 'ads', type: 'expense', value: 5, date: '2026-08-13', description: 'Anúncios', category: 'Marketing' }
  ],
  accounts: []
};
const context = {
  sales, products, customers, financialData,
  startDate: '2026-08-01', endDate: '2026-08-25'
};

assert.deepEqual(REPORT_GROUPS.map(group => group.title), [
  'Resultados e vendas', 'Clientes e crediário', 'Produtos e estoque',
  'Financeiro, compras e taxas', 'Descontos e promoções'
]);
assert.deepEqual([...REPORT_GROUPS.flatMap(group => group.reportIds)].sort(),
  REPORT_DEFINITIONS.map(definition => definition.id).sort(),
  'Cada relatório precisa aparecer exatamente uma vez nos cinco grupos temáticos.');

const abc = buildProductAbcClassification(context);
assert.deepEqual(abc.map(item => [item.product.id, item.abcClass, item.revenue]), [
  ['perfume', 'A', 80], ['cream', 'B', 15], ['soap', 'C', 5], ['inactive', 'C', 0]
]);
assert.equal(abc[0].share, 80);
assert.equal(abc[1].accumulatedShare, 95);
const abcReport = buildReport({ ...context, reportId: 'stock-abc' });
assert.equal(abcReport.metrics.find(item => item.label === 'Produtos classe A')?.value, 1);
assert.equal(abcReport.metrics.find(item => item.label === 'Faturamento classe A')?.value, 80);
assert.ok(buildReport({ ...context, reportId: 'stock-replenishment' }).columns.includes('Curva ABC'));

const evolution = buildDailySalesEvolution(context);
assert.equal(evolution.length, 25);
assert.equal(evolution.find(item => item.date === '2026-08-10')?.revenue, 80);
assert.equal(evolution.find(item => item.date === '2026-08-11')?.revenue, 0);
const salesReport = buildReport({ ...context, reportId: 'sales' });
assert.equal(salesReport.metrics.find(item => item.label === 'Crescimento do faturamento')?.value, 150);
assert.equal(salesReport.metrics.find(item => item.label === 'Canais de venda ativos')?.value, 3);
assert.equal(salesReport.dailyEvolution.length, 25);

const filteredProduct = buildReport({ ...context, reportId: 'products', productFilter: 'perfume' });
assert.equal(filteredProduct.metrics.find(item => item.label === 'Receita líquida alocada')?.value, 80);
assert.deepEqual(filteredProduct.rows.map(row => row[0]), ['Perfume']);
const filteredCategory = buildReport({ ...context, reportId: 'products', categoryFilter: 'Cuidados pessoais' });
assert.equal(filteredCategory.metrics.find(item => item.label === 'Receita líquida alocada')?.value, 20);
assert.equal(filteredCategory.rows.length, 2);
const filteredCustomer = buildReport({ ...context, reportId: 'sales', customerFilter: 'bob' });
assert.equal(filteredCustomer.metrics.find(item => item.label === 'Faturamento')?.value, 15);
const filteredPayment = buildReport({ ...context, reportId: 'sales', paymentFilter: 'debit' });
assert.equal(filteredPayment.metrics.find(item => item.label === 'Faturamento')?.value, 15);
const filteredChannel = buildReport({ ...context, reportId: 'sales', saleChannel: 'instagram' });
assert.equal(filteredChannel.metrics.find(item => item.label === 'Faturamento')?.value, 15);
const lowStock = buildReport({ ...context, reportId: 'stock-abc', statusFilter: 'low' });
assert.deepEqual(lowStock.rows.map(row => row[1]), ['Perfume']);
const financialCategory = buildReport({ ...context, reportId: 'net-result', categoryFilter: 'Estrutura' });
assert.equal(financialCategory.metrics.find(item => item.label === 'Despesas operacionais')?.value, 10);
assert.deepEqual(getReportCategories({ reportId: 'products', products }), ['Cuidados pessoais', 'Perfumaria']);
assert.deepEqual(getReportCategories({ reportId: 'net-result', products, financialData }), ['Estrutura', 'Marketing']);
assert.equal(getReportFilterCapabilities('credit').customer, true);
assert.equal(getReportFilterCapabilities('stock').productStatus, true);
assert.equal(getReportFilterCapabilities('net-result').financialCategory, true);

const promotionalProduct = {
  ...products[0], salePrice: 120, isPromo: true, promoPrice: 90,
  promoStart: '2026-08-01', promoEnd: '2026-08-31'
};
const promotionalSale = {
  ...sales[1], id: 'promotion', totalPrice: 80, netReceived: 80, totalCost: 40,
  items: [{
    productId: promotionalProduct.id, productName: promotionalProduct.name,
    quantity: 1, price: 80, unitPrice: 80, cost: 40,
    unitDiscount: 10, discountReason: 'Fidelidade',
    regularUnitPrice: 120, promotionalUnitPrice: 90,
    promotionUnitDiscount: 30, promotionApplied: true
  }]
};
const promotionReport = buildReport({
  ...context, products: [promotionalProduct], sales: [promotionalSale], reportId: 'discounts'
});
assert.equal(promotionReport.metrics.find(item => item.label === 'Desconto total')?.value, 10);
assert.equal(promotionReport.metrics.find(item => item.label === 'Redução em promoções')?.value, 30);
assert.equal(promotionReport.metrics.find(item => item.label === 'Redução comercial total')?.value, 40);
assert.equal(promotionReport.metrics.find(item => item.label === 'Vendas com promoção')?.value, 1);
assert.equal(promotionReport.metrics.find(item => item.label === 'Margem final dos itens')?.value, 50);
assert.ok(Math.abs(promotionReport.metrics.find(item => item.label === 'Impacto na margem')?.value - 16.6666666667) < 0.0001);
assert.ok(promotionReport.rows[0].includes('Promoção + Fidelidade'));
const preservedPromotion = buildReport({
  ...context,
  products: [{ ...promotionalProduct, isPromo: false, salePrice: 200, promoPrice: 0 }],
  sales: [promotionalSale],
  reportId: 'discounts'
});
assert.equal(preservedPromotion.metrics.find(item => item.label === 'Redução em promoções')?.value, 30,
  'Alterar ou encerrar a promoção depois da venda não pode modificar o histórico do relatório.');
const legacyPromotionSale = {
  ...promotionalSale,
  items: promotionalSale.items.map(({ regularUnitPrice, promotionalUnitPrice, promotionUnitDiscount,
    promotionApplied, ...legacyItem }) => legacyItem)
};
const legacyPromotionReport = buildReport({
  ...context, products: [promotionalProduct], sales: [legacyPromotionSale], reportId: 'discounts'
});
assert.equal(legacyPromotionReport.metrics.find(item => item.label === 'Redução em promoções')?.value, 30);
assert.ok(legacyPromotionReport.notes.some(note => note.includes('vendas antigas')));

const mixedSale = {
  ...sales[1], id: 'mixed', totalPrice: 100, netReceived: 100, totalCost: 40,
  items: [
    { productId: 'perfume', productName: 'Perfume', quantity: 1, price: 70, cost: 30 },
    { productId: 'cream', productName: 'Creme', quantity: 1, price: 30, cost: 10 }
  ]
};
const exactAllocation = buildReport({
  ...context, sales: [mixedSale], reportId: 'products', productFilter: 'perfume'
});
assert.equal(exactAllocation.metrics.find(item => item.label === 'Receita líquida alocada')?.value, 70,
  'Filtrar um produto não pode atribuir a ele o valor integral de uma venda com vários itens.');

const insights = buildExecutiveInsights({
  ...context,
  endDate: '2026-08-31',
  today,
  userProfile: { commercialGoals: { '2026-08': { revenue: 200, salesCount: 4, recurringCustomers: 2 } } }
});
assert.equal(insights.effectiveEndDate, today);
assert.equal(insights.revenue, 100);
assert.equal(insights.grossProfit, 63);
assert.equal(insights.netResult, 48);
assert.equal(insights.salesCount, 3);
assert.equal(insights.newCustomers, 2);
assert.equal(insights.recurringCustomers, 1);
assert.equal(insights.stockAlerts, 2);
assert.equal(insights.stockoutProducts, 1);
assert.equal(insights.repurchaseOpportunities, 1);
assert.equal(insights.goals.metrics.find(item => item.id === 'revenue')?.percent, 50);

const recurrence = buildReport({ ...context, reportId: 'repeat-customers', repurchaseSuggestions: insights.repurchases });
assert.equal(recurrence.metrics.find(item => item.label === 'Clientes novos no período')?.value, 2);
assert.equal(recurrence.metrics.find(item => item.label === 'Clientes recorrentes')?.value, 1);
assert.equal(recurrence.metrics.find(item => item.label === 'Oportunidades de recompra')?.value, 1);
assert.equal(recurrence.rowActions.length, recurrence.rows.length);
assert.ok(recurrence.rowActions.some(item => item.phone === '85999999991'));

const julyPaidInAugust = {
  id: 'historical-status', saleType: 'prazo', saleDate: '2026-07-12', customerId: 'alice',
  customerName: 'Alice', totalPrice: 100, totalCost: 30, status: 'completed',
  installments: [{ originalAmount: 100, amount: 0, dueDate: '2026-08-10', paid: true,
    paidAt: '2026-08-05', history: [{ type: 'full', amount: 100, date: '2026-08-05' }] }]
};
const historicalOpen = buildReport({
  reportId: 'credit', sales: [julyPaidInAugust], customers,
  startDate: '2026-07-01', endDate: '2026-07-31', creditToday: today,
  statusFilter: 'open'
});
assert.equal(historicalOpen.metrics.find(item => item.label === 'Saldo na data final do período')?.value, 100,
  'Filtro Em aberto precisa respeitar a posição histórica escolhida no crediário.');

const csv = buildReportCsvContent({
  report: {
    id: 'test', title: 'Relatório "especial"',
    metrics: [{ label: 'Faturamento', display: 'R$ 100,00' }],
    columns: ['Cliente', 'Observação'],
    rows: [['Alice; Sobral', '=CMD()']],
    notes: ['Nota com "aspas"']
  },
  storeName: 'Notar Perfumaria', startDate: '2026-08-01', endDate: '2026-08-25'
});
assert.ok(csv.startsWith('\uFEFF'), 'O CSV precisa abrir com acentuação correta no Excel.');
assert.ok(csv.includes('"Alice; Sobral";"\'=CMD()"'), 'Valores com ponto e vírgula e fórmulas precisam ser protegidos.');
assert.ok(csv.includes('"Relatório ""especial"""'));
assert.ok(csv.includes('"Detalhamento"'));

const root = new URL('..', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
for (const marker of [
  'Visão executiva', 'REPORT_GROUPS', 'Leitura da carteira', 'PDF executivo', 'PDF detalhado',
  'Excel (.xlsx)', 'CSV (.csv)', 'Compartilhar', 'Produto', 'Cliente', 'Situação', 'Categoria', 'Canal da venda'
]) assert.ok(read('aba-relatorios-v73.js').includes(marker), `Recurso ausente na página de relatórios: ${marker}`);
const dashboardSource = read('aba-visao-geral-fixed.js');
for (const marker of ['Acompanhamento do negócio', 'Resumo executivo', 'Meta de faturamento', 'Ações rápidas', 'dashboard79-', 'buildExecutiveInsights']) {
  assert.ok(!dashboardSource.includes(marker), `Seção removida ainda presente no painel inicial: ${marker}`);
}
for (const marker of ['DateRangeFilter', 'A receber', 'Entrou em caixa', 'Em atraso', 'Vencem hoje', 'Próximos 7 dias', 'Lucro estimado', 'Lucro real no caixa', 'setInstallmentListModal']) {
  assert.ok(dashboardSource.includes(marker), `Indicador preservado ausente no painel inicial: ${marker}`);
}
assert.ok(read('aba-comercial-v74.js').includes('Meta de faturamento'),
  'A remoção no dashboard não pode remover as metas da área Comercial.');
assert.ok(read('aba-relatorios-v73.js').includes('buildExecutiveInsights'),
  'Os relatórios devem manter sua visão executiva.');
assert.ok(read('modals-core-runtime-v75.js').includes('Categoria (Opcional)'));
assert.ok(read('nova-venda-runtime-v75.js').includes('promotionUnitDiscount'));
assert.ok(read('aba-financeiro-v68.js').includes('onAnalysisStartDateChange'));
assert.ok(read('aba-vendas-v71.js').includes('onAnalysisEndDateChange'));
assert.ok(read('app-runtime-v75.js').includes('readSharedAnalysisPeriod'));
assert.equal(applyReportFilters({ ...context, reportId: 'sales', customerFilter: 'bob' }).sales.length, 1);

console.log('Evolução executiva validada: período compartilhado, cinco grupos, visão executiva, filtros, curva ABC, promoções e margem, crescimento, clientes, WhatsApp e CSV.');
