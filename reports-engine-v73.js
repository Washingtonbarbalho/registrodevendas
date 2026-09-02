import { formatCurrency, formatDate, getBrazilDateString } from './utils.js';
import {
  buildReport as buildAccountingReport,
  PAYMENT_FILTERS,
  paymentLabel,
  REPORT_DEFINITIONS as OPERATIONAL_REPORTS,
  reportPeriodLabel
} from './reports-engine-v70.js?v=93';
import {
  allocateMoney,
  buildFinancialLedger,
  cleanFinancialDate,
  fromCents,
  getDirectSaleNet,
  getSalesAccrualSummary,
  inFinancialPeriod,
  money,
  projectSalesAsOf,
  sumMoney,
  summarizeFinancialLedger,
  toCents
} from './financial-core-v70.js';
import { applyReportFilters, getProductCategory } from './report-filters-v79.js?v=93';

export { PAYMENT_FILTERS, paymentLabel, reportPeriodLabel };

export const SALE_CHANNELS = [
  ['presencial', 'Presencial'],
  ['whatsapp', 'WhatsApp'],
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook / Marketplace'],
  ['outro', 'Outro'],
  ['unknown', 'Não informado']
];

export const STRATEGIC_REPORTS = [
  {
    id: 'period-comparison', number: 8, title: 'Comparação de períodos',
    description: 'Compare faturamento, resultado, vendas e clientes com o período anterior.'
  },
  {
    id: 'net-result', number: 9, title: 'Resultado líquido real',
    description: 'Descubra o lucro depois dos custos, taxas e despesas operacionais.'
  },
  {
    id: 'sales-channels', number: 11, title: 'Vendas por canal',
    description: 'Veja o desempenho de WhatsApp, Instagram, loja e outros canais.'
  },
  {
    id: 'stock-replenishment', number: 12, title: 'Estoque mínimo e reposição',
    description: 'Antecipe faltas, veja a cobertura e a quantidade sugerida para compra.'
  },
  {
    id: 'repeat-customers', number: 13, title: 'Clientes recorrentes',
    description: 'Acompanhe recompra, frequência, ticket e clientes que precisam de atenção.'
  },
  {
    id: 'stock-abc', number: 16, title: 'Curva ABC de produtos',
    description: 'Identifique os produtos que concentram faturamento, margem e prioridade de estoque.'
  }
].map(definition => ({ ...definition, group: 'strategic' }));

export const REPORT_DEFINITIONS = [
  ...STRATEGIC_REPORTS,
  ...OPERATIONAL_REPORTS.map(definition => ({
    ...definition,
    ...(definition.id === 'discounts' ? {
      title: 'Descontos e promoções',
      description: 'Promoções, descontos adicionais, motivos e impacto efetivo na margem.'
    } : {}),
    group: 'operational'
  }))
];

export const REPORT_GROUPS = [
  {
    id: 'results-sales', title: 'Resultados e vendas',
    description: 'Faturamento, vendas, canais, lucro, evolução e comparações.',
    reportIds: ['period-comparison', 'sales', 'sale-profit', 'sales-channels']
  },
  {
    id: 'customers-credit', title: 'Clientes e crediário',
    description: 'Clientes ativos, recorrência, inadimplência, cobranças e limites.',
    reportIds: ['repeat-customers', 'credit', 'customers']
  },
  {
    id: 'products-stock', title: 'Produtos e estoque',
    description: 'Produtos vendidos, margem, reposição, cobertura e curva ABC.',
    reportIds: ['stock-replenishment', 'stock-abc', 'products', 'stock']
  },
  {
    id: 'finance-purchases', title: 'Financeiro, compras e taxas',
    description: 'Entradas, saídas, despesas, compras, cartão e resultado líquido.',
    reportIds: ['net-result', 'result', 'purchases', 'card-fees']
  },
  {
    id: 'discounts-promotions', title: 'Descontos e promoções',
    description: 'Descontos concedidos, motivos e impacto sobre a margem.',
    reportIds: ['discounts']
  }
];

const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const quantity = value => Math.max(0, parseInt(value, 10) || 0);
const numberLabel = value => numeric(value).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const decimalLabel = value => numeric(value).toLocaleString('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});
const percentLabel = value => `${decimalLabel(value)}%`;
const MS_PER_DAY = 86_400_000;

const metric = (label, value, type = 'currency', tone = '') => ({
  label,
  value: type === 'currency' ? money(value) : value,
  type,
  tone,
  display: type === 'currency' ? formatCurrency(value)
    : type === 'percent' ? percentLabel(value)
    : type === 'number' ? numberLabel(value)
    : String(value ?? '')
});

const chart = (title, items = []) => ({
  title,
  items: items.map(item => ({
    ...item,
    value: Math.max(0, numeric(item.value)),
    display: item.display || formatCurrency(item.value)
  }))
});

const isoDate = value => cleanFinancialDate(value);

const dateTimestamp = value => {
  const [year, month, day] = isoDate(value).split('-').map(Number);
  if (!year || !month || !day) return Number.NaN;
  return Date.UTC(year, month - 1, day, 12);
};

export const shiftReportDate = (value, days) => {
  const timestamp = dateTimestamp(value);
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp + numeric(days) * MS_PER_DAY).toISOString().slice(0, 10);
};

export const countPeriodDays = (startDate, endDate) => {
  const start = dateTimestamp(startDate);
  const end = dateTimestamp(endDate);
  return Number.isFinite(start) && Number.isFinite(end) && end >= start
    ? Math.floor((end - start) / MS_PER_DAY) + 1
    : 0;
};

export const getPreviousEquivalentPeriod = (startDate, endDate) => {
  const days = countPeriodDays(startDate, endDate);
  if (!days) return null;
  const previousEndDate = shiftReportDate(startDate, -1);
  return {
    startDate: shiftReportDate(previousEndDate, -(days - 1)),
    endDate: previousEndDate,
    days
  };
};

export const buildDailySalesEvolution = ({ sales = [], startDate, endDate } = {}) => {
  const count = countPeriodDays(startDate, endDate);
  if (!count) return [];
  return Array.from({ length: Math.min(count, 366) }, (_, index) => {
    const date = shiftReportDate(startDate, index);
    const accrual = getSalesAccrualSummary(sales, date, date);
    return {
      date,
      label: formatDate(date).slice(0, 5),
      revenue: accrual.net,
      gross: accrual.gross,
      profit: accrual.profit,
      salesCount: projectSalesAsOf(accrual.origins, date).filter(sale => sale.status !== 'canceled').length,
      cancellations: accrual.cancellations.length
    };
  });
};

const normalizeText = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export const getSaleChannel = sale => {
  const raw = normalizeText(sale?.saleChannel || sale?.salesChannel || sale?.channel || sale?.origin);
  if (!raw) return 'unknown';
  if (raw.includes('whats') || raw === 'wpp') return 'whatsapp';
  if (raw.includes('insta')) return 'instagram';
  if (raw.includes('facebook') || raw.includes('marketplace') || raw === 'face') return 'facebook';
  if (['presencial', 'loja', 'balcao', 'fisico', 'physical', 'store'].includes(raw)) return 'presencial';
  if (['outro', 'outros', 'other'].includes(raw)) return 'outro';
  return 'outro';
};

export const saleChannelLabel = channel => SALE_CHANNELS.find(([id]) => id === channel)?.[1]
  || 'Não informado';

export const getProductMinimumStock = product => {
  const raw = product?.minimumStock;
  if (raw === undefined || raw === null || raw === '') return 3;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 3;
};

export const getProductLeadTimeDays = product => {
  const raw = product?.replenishmentLeadTimeDays;
  if (raw === undefined || raw === null || raw === '') return 7;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(365, Math.floor(parsed)) : 7;
};

const customerIdentity = sale => {
  if (sale?.customerId) return `id:${sale.customerId}`;
  const phone = String(sale?.customerPhone || '').replace(/\D/g, '');
  if (phone.length >= 8) return `phone:${phone}`;
  const name = normalizeText(sale?.customerName);
  if (!name || ['venda avulsa', 'cliente', 'consumidor', 'nao informado'].includes(name)) return '';
  return `name:${name}`;
};

const periodBuyers = (sales, startDate, endDate) => {
  const visible = projectSalesAsOf(sales, endDate).filter(sale =>
    sale?.status !== 'canceled' && inFinancialPeriod(sale.saleDate, startDate, endDate));
  const identities = new Set(visible.map(customerIdentity).filter(Boolean));
  return { sales: visible, count: identities.size };
};

export const getNetOperatingResult = ({ sales = [], products = [], financialData = {}, startDate, endDate }) => {
  const accrual = getSalesAccrualSummary(sales, startDate, endDate);
  const cash = summarizeFinancialLedger(buildFinancialLedger({ sales, products, financialData }), startDate, endDate);
  const operatingRows = cash.rows.filter(row => row.source === 'manual' || row.source === 'manual-account');
  const operatingIncome = sumMoney(operatingRows.filter(row => row.type === 'income'), row => row.amount);
  const operatingExpenses = sumMoney(operatingRows.filter(row => row.type === 'expense'), row => row.amount);
  const netResult = fromCents(toCents(accrual.profit) + toCents(operatingIncome) - toCents(operatingExpenses));
  const netMargin = toCents(accrual.net) > 0 ? netResult / accrual.net * 100 : 0;
  return { accrual, cash, operatingRows, operatingIncome, operatingExpenses, netResult, netMargin };
};

const compareMetric = (label, current, previous, type = 'currency', higherIsBetter = true) => {
  const delta = type === 'currency'
    ? fromCents(toCents(current) - toCents(previous))
    : numeric(current) - numeric(previous);
  const hasBaseline = numeric(previous) !== 0;
  const percent = hasBaseline ? delta / Math.abs(numeric(previous)) * 100 : null;
  const format = value => type === 'currency' ? formatCurrency(value)
    : type === 'percent' ? percentLabel(value)
    : numberLabel(value);
  return {
    label,
    type,
    current,
    previous,
    currentDisplay: format(current),
    previousDisplay: format(previous),
    delta,
    percent,
    deltaDisplay: percent === null
      ? numeric(current) === 0 ? 'Sem alteração' : 'Novo'
      : `${percent > 0 ? '+' : ''}${percentLabel(percent)}`,
    tone: delta === 0 ? 'neutral'
      : (delta > 0) === higherIsBetter ? 'positive' : 'negative'
  };
};

export const buildPeriodComparison = context => {
  const previousPeriod = getPreviousEquivalentPeriod(context.startDate, context.endDate);
  if (!previousPeriod) return null;
  const currentResult = getNetOperatingResult(context);
  const previousResult = getNetOperatingResult({
    ...context,
    startDate: previousPeriod.startDate,
    endDate: previousPeriod.endDate
  });
  const currentBuyers = periodBuyers(context.sales || [], context.startDate, context.endDate);
  const previousBuyers = periodBuyers(context.sales || [], previousPeriod.startDate, previousPeriod.endDate);
  const currentTicket = currentBuyers.sales.length
    ? money(sumMoney(currentBuyers.sales, sale => sale.totalPrice) / currentBuyers.sales.length) : 0;
  const previousTicket = previousBuyers.sales.length
    ? money(sumMoney(previousBuyers.sales, sale => sale.totalPrice) / previousBuyers.sales.length) : 0;

  return {
    days: previousPeriod.days,
    currentPeriod: { startDate: context.startDate, endDate: context.endDate },
    previousPeriod,
    metrics: [
      compareMetric('Faturamento líquido', currentResult.accrual.net, previousResult.accrual.net),
      compareMetric('Resultado líquido', currentResult.netResult, previousResult.netResult),
      compareMetric('Vendas válidas', currentBuyers.sales.length, previousBuyers.sales.length, 'number'),
      compareMetric('Clientes compradores', currentBuyers.count, previousBuyers.count, 'number'),
      compareMetric('Ticket médio', currentTicket, previousTicket),
      compareMetric('Despesas operacionais', currentResult.operatingExpenses, previousResult.operatingExpenses, 'currency', false)
    ],
    current: currentResult,
    previous: previousResult
  };
};

const comparisonReport = context => {
  const comparison = buildPeriodComparison(context);
  if (!comparison) return {
    id: 'period-comparison', title: 'Comparação de períodos', subtitle: 'Escolha um período válido.',
    metrics: [], columns: [], rows: [], chart: null, notes: []
  };
  const revenue = comparison.metrics[0];
  const profit = comparison.metrics[1];
  const orders = comparison.metrics[2];

  return {
    id: 'period-comparison',
    title: 'Comparação de períodos',
    subtitle: `${comparison.days} dias comparados com os ${comparison.days} dias imediatamente anteriores.`,
    metrics: [
      metric('Faturamento líquido atual', revenue.current),
      metric('Faturamento líquido anterior', revenue.previous),
      metric('Resultado líquido atual', profit.current, 'currency', profit.current >= 0 ? 'positive' : 'negative'),
      metric('Variação do resultado', profit.delta, 'currency', profit.delta >= 0 ? 'positive' : 'negative'),
      metric('Vendas no período', orders.current, 'number'),
      metric('Vendas no período anterior', orders.previous, 'number')
    ],
    columns: ['Indicador', 'Período atual', 'Período anterior', 'Variação'],
    rows: comparison.metrics.map(item => [item.label, item.currentDisplay, item.previousDisplay, item.deltaDisplay]),
    chart: chart('Receita e resultado comparados', [
      { label: 'Receita atual', value: Math.max(0, revenue.current) },
      { label: 'Receita anterior', value: Math.max(0, revenue.previous) },
      { label: 'Resultado atual', value: Math.max(0, profit.current) },
      { label: 'Resultado anterior', value: Math.max(0, profit.previous) }
    ]),
    notes: [
      `Período anterior: ${reportPeriodLabel(comparison.previousPeriod.startDate, comparison.previousPeriod.endDate)}.`,
      'Os períodos sempre têm a mesma quantidade de dias, inclusive em viradas de mês e anos bissextos.',
      'Quando o período anterior foi zero, a variação é exibida como “Novo” para evitar porcentagens enganosas.'
    ],
    comparison
  };
};

const netResultReport = context => {
  const result = getNetOperatingResult(context);
  const byCategory = new Map();
  result.operatingRows.filter(row => row.type === 'expense').forEach(row => {
    const category = row.detail || row.description || 'Outras despesas';
    byCategory.set(category, fromCents(toCents(byCategory.get(category) || 0) + toCents(row.amount)));
  });

  return {
    id: 'net-result',
    title: 'Resultado líquido real',
    subtitle: 'Receita das vendas menos mercadorias e despesas operacionais, sem duplicar compras.',
    metrics: [
      metric('Receita líquida das vendas', result.accrual.net),
      metric('Custo das mercadorias vendidas', result.accrual.cost),
      metric('Lucro bruto das vendas', result.accrual.profit, 'currency', result.accrual.profit >= 0 ? 'positive' : 'negative'),
      metric('Outras receitas operacionais', result.operatingIncome, 'currency', 'positive'),
      metric('Despesas operacionais', result.operatingExpenses, 'currency', result.operatingExpenses ? 'negative' : ''),
      metric('Resultado líquido', result.netResult, 'currency', result.netResult >= 0 ? 'positive' : 'negative'),
      metric('Margem líquida', result.netMargin, 'percent', result.netMargin >= 0 ? 'positive' : 'negative'),
      metric('Saldo real do caixa', result.cash.balance, 'currency', result.cash.balance >= 0 ? 'positive' : 'negative'),
      metric('Taxas assumidas pela loja', result.accrual.storeFees),
      metric('Estornos e cancelamentos', result.accrual.canceledGross)
    ],
    columns: ['Componente do resultado', 'Movimentação', 'Valor'],
    rows: [
      ['Receita líquida das vendas', 'Entrada por competência', formatCurrency(result.accrual.net)],
      ['Custo das mercadorias vendidas', 'Custo reconhecido', formatCurrency(-result.accrual.cost)],
      ['Lucro bruto das vendas', 'Subtotal', formatCurrency(result.accrual.profit)],
      ['Outras receitas e contas recebidas', 'Receita operacional', formatCurrency(result.operatingIncome)],
      ['Despesas e contas pagas', 'Despesa operacional', formatCurrency(-result.operatingExpenses)],
      ['RESULTADO LÍQUIDO', 'Resultado final', formatCurrency(result.netResult)],
      ...result.operatingRows.map(row => [
        `${formatDate(row.date)} · ${row.description}`,
        row.type === 'expense' ? 'Despesa operacional' : 'Receita operacional',
        formatCurrency(row.type === 'expense' ? -row.amount : row.amount)
      ])
    ],
    chart: chart('Despesas operacionais por categoria', [...byCategory.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 8)),
    notes: [
      'Compras de mercadorias não são descontadas novamente: seu custo já é reconhecido no custo das mercadorias vendidas.',
      'Despesas operacionais incluem lançamentos manuais e contas a pagar efetivamente pagas no período.',
      'O resultado líquido é diferente do saldo do caixa porque vendas a prazo e compras parceladas têm datas de pagamento próprias.',
      'Taxas absorvidas pela loja já estão descontadas da receita líquida das vendas.'
    ]
  };
};

const channelsReport = context => {
  const grouped = new Map();
  (context.sales || []).forEach(sale => {
    const channel = getSaleChannel(sale);
    if (!grouped.has(channel)) grouped.set(channel, []);
    grouped.get(channel).push(sale);
  });
  const selectedChannel = context.saleChannel || 'all';
  const data = [...grouped.entries()]
    .filter(([channel]) => selectedChannel === 'all' || channel === selectedChannel)
    .map(([channel, sales]) => {
      const accrual = getSalesAccrualSummary(sales, context.startDate, context.endDate);
      const visible = projectSalesAsOf(accrual.origins, context.endDate)
        .filter(sale => sale.status !== 'canceled');
      return {
        channel,
        label: saleChannelLabel(channel),
        accrual,
        count: visible.length,
        ticket: visible.length ? money(sumMoney(visible, sale => sale.totalPrice) / visible.length) : 0
      };
    })
    .filter(item => item.count > 0 || item.accrual.origins.length > 0 || item.accrual.cancellations.length > 0)
    .sort((left, right) => right.accrual.net - left.accrual.net || right.count - left.count);
  const total = sumMoney(data, item => item.accrual.net);
  const gross = sumMoney(data, item => item.accrual.gross);
  const validCount = data.reduce((sum, item) => sum + item.count, 0);
  const leader = data.find(item => item.channel !== 'unknown' && item.accrual.net > 0);
  const unknown = data.find(item => item.channel === 'unknown');

  return {
    id: 'sales-channels',
    title: 'Vendas por canal',
    subtitle: 'Faturamento, lucro e participação real de cada origem de venda.',
    metrics: [
      metric('Faturamento líquido', total),
      metric('Faturamento bruto', gross),
      metric('Vendas válidas', validCount, 'number'),
      metric('Canais com vendas', data.filter(item => item.channel !== 'unknown' && item.count > 0).length, 'number'),
      metric('Canal líder', leader?.label || 'Ainda não identificado', 'text'),
      metric('Vendas sem canal informado', unknown?.count || 0, 'number')
    ],
    columns: ['Canal', 'Vendas', 'Faturamento líquido', 'Participação', 'Ticket médio', 'Lucro bruto', 'Cancelamentos'],
    rows: data.map(item => [
      item.label,
      numberLabel(item.count),
      formatCurrency(item.accrual.net),
      total > 0 ? percentLabel(item.accrual.net / total * 100) : '—',
      formatCurrency(item.ticket),
      formatCurrency(item.accrual.profit),
      numberLabel(item.accrual.cancellations.length)
    ]),
    chart: chart('Receita líquida por canal', data
      .filter(item => item.accrual.net > 0)
      .map(item => ({ label: item.label, value: item.accrual.net }))),
    notes: [
      'Escolha o canal ao registrar cada nova venda para acompanhar Instagram, WhatsApp, loja e outros meios.',
      'Vendas antigas sem essa informação aparecem como “Não informado”; nenhum canal é presumido.',
      'Cancelamentos são atribuídos ao canal original no período em que o cancelamento aconteceu.'
    ]
  };
};

export const buildReplenishmentForecast = ({ products = [], sales = [], startDate, endDate }) => {
  const periodDays = Math.max(1, countPeriodDays(startDate, endDate));
  const accrual = getSalesAccrualSummary(sales, startDate, endDate);
  const sold = new Map();
  const add = (item, factor = 1) => {
    const key = item?.productId || item?.productName || item?.name;
    if (!key) return;
    sold.set(key, (sold.get(key) || 0) + quantity(item.quantity) * factor);
  };
  accrual.origins.forEach(sale => (sale.items || []).forEach(item => add(item)));
  accrual.cancellations.forEach(({ sale, event }) => {
    const items = Array.isArray(event.items) && event.items.length ? event.items : sale.items || [];
    items.forEach(item => add(item, -1));
  });
  const anchor = getBrazilDateString();

  return (products || []).map(product => {
    const currentStock = quantity(product.quantity);
    const minimumStock = getProductMinimumStock(product);
    const leadTimeDays = getProductLeadTimeDays(product);
    const unitsSold = Math.max(0, sold.get(product.id) || sold.get(product.name) || 0);
    const dailyDemand = unitsSold / periodDays;
    const coverageDays = dailyDemand > 0 ? Math.floor(currentStock / dailyDemand) : null;
    const demandDuringLeadTime = Math.ceil(dailyDemand * leadTimeDays);
    const reorderPoint = Math.max(minimumStock, demandDuringLeadTime);
    const needsReplenishment = currentStock <= reorderPoint;
    const suggestedQuantity = needsReplenishment
      ? Math.max(0, minimumStock + demandDuringLeadTime - currentStock)
      : 0;
    const stockoutDate = dailyDemand > 0
      ? shiftReportDate(anchor, Math.ceil(currentStock / dailyDemand))
      : null;
    let status = 'Adequado';
    let urgency = 4;
    if (currentStock <= 0) {
      status = 'Sem estoque';
      urgency = 0;
    } else if (currentStock <= minimumStock) {
      status = currentStock < minimumStock ? 'Abaixo do mínimo' : 'No estoque mínimo';
      urgency = 1;
    } else if (coverageDays !== null && coverageDays <= leadTimeDays) {
      status = 'Reposição urgente';
      urgency = 2;
    } else if (dailyDemand === 0) {
      status = 'Sem giro no período';
      urgency = 3;
    }
    return {
      product,
      currentStock,
      minimumStock,
      leadTimeDays,
      unitsSold,
      dailyDemand,
      coverageDays,
      reorderPoint,
      needsReplenishment,
      suggestedQuantity,
      suggestedCost: money(suggestedQuantity * numeric(product.costPrice)),
      stockoutDate,
      status,
      urgency
    };
  }).sort((left, right) => left.urgency - right.urgency
    || (left.coverageDays ?? Number.MAX_SAFE_INTEGER) - (right.coverageDays ?? Number.MAX_SAFE_INTEGER)
    || String(left.product.name || '').localeCompare(String(right.product.name || ''), 'pt-BR'));
};

export const buildProductAbcClassification = ({ sales = [], products = [], startDate, endDate } = {}) => {
  const accrual = getSalesAccrualSummary(sales, startDate, endDate);
  const productDirectory = new Map(products.flatMap(product => [
    [`id:${String(product.id || '')}`, product],
    [`name:${normalizeText(product.name)}`, product]
  ]));
  const eligible = new Set(products.map(product => String(product.id || '')));
  const rows = new Map();

  const applyItems = (items, revenue, cost, direction) => {
    if (!Array.isArray(items) || !items.length) return;
    const weights = items.map(item => money(item?.amount ?? item?.price ?? numeric(item?.unitPrice) * quantity(item?.quantity)));
    const itemCosts = items.map(item => money(item?.canceledCostAmount ?? item?.cost ?? numeric(item?.unitCost) * quantity(item?.quantity)));
    const allocatedRevenue = allocateMoney(revenue, weights);
    const allocatedCost = allocateMoney(cost, itemCosts.map((value, index) => value || weights[index]));
    items.forEach((item, index) => {
      const product = productDirectory.get(`id:${String(item?.productId || '')}`)
        || productDirectory.get(`name:${normalizeText(item?.productName || item?.name)}`);
      if (!product || !eligible.has(String(product.id || ''))) return;
      const key = String(product.id || item.productName);
      const current = rows.get(key) || { product, unitsSold: 0, revenueCents: 0, costCents: 0 };
      current.unitsSold += quantity(item.quantity) * direction;
      current.revenueCents += toCents(allocatedRevenue[index]) * direction;
      current.costCents += toCents(allocatedCost[index]) * direction;
      rows.set(key, current);
    });
  };

  accrual.origins.forEach(sale => applyItems(
    sale.items || [],
    sale.saleType === 'direct' ? getDirectSaleNet(sale) : sale.totalPrice,
    sale.totalCost,
    1
  ));
  accrual.cancellations.forEach(({ sale, event }) => applyItems(
    Array.isArray(event.items) && event.items.length ? event.items : sale.items || [],
    sale.saleType === 'direct' ? event.storeImpactAmount : event.canceledContractValue,
    event.canceledCostAmount,
    -1
  ));

  products.forEach(product => {
    const key = String(product.id || product.name);
    if (!rows.has(key)) rows.set(key, { product, unitsSold: 0, revenueCents: 0, costCents: 0 });
  });

  const ranked = [...rows.values()].map(entry => ({
    ...entry,
    revenue: fromCents(entry.revenueCents),
    cost: fromCents(entry.costCents),
    profit: fromCents(entry.revenueCents - entry.costCents),
    category: getProductCategory(entry.product)
  })).sort((left, right) => right.revenue - left.revenue
    || right.profit - left.profit
    || String(left.product.name || '').localeCompare(String(right.product.name || ''), 'pt-BR'));

  const total = sumMoney(ranked.filter(entry => entry.revenue > 0), entry => entry.revenue);
  let accumulated = 0;
  return ranked.map(entry => {
    const previous = accumulated;
    const share = total > 0 && entry.revenue > 0 ? entry.revenue / total * 100 : 0;
    accumulated += share;
    const abcClass = entry.revenue <= 0 ? 'C' : previous < 80 ? 'A' : previous < 95 ? 'B' : 'C';
    return { ...entry, share, accumulatedShare: Math.min(100, accumulated), abcClass };
  });
};

const abcReport = context => {
  const ranking = buildProductAbcClassification(context);
  const totalRevenue = sumMoney(ranking, item => item.revenue);
  const totalProfit = sumMoney(ranking, item => item.profit);
  const classA = ranking.filter(item => item.abcClass === 'A');
  const classB = ranking.filter(item => item.abcClass === 'B');
  const classC = ranking.filter(item => item.abcClass === 'C');

  return {
    id: 'stock-abc',
    title: 'Curva ABC de produtos',
    subtitle: 'Classificação dos produtos pelo faturamento líquido e contribuição acumulada no período.',
    metrics: [
      metric('Produtos classe A', classA.length, 'number'),
      metric('Produtos classe B', classB.length, 'number'),
      metric('Produtos classe C', classC.length, 'number'),
      metric('Faturamento dos produtos', totalRevenue),
      metric('Faturamento classe A', sumMoney(classA, item => item.revenue)),
      metric('Lucro dos produtos', totalProfit, 'currency', totalProfit >= 0 ? 'positive' : 'negative')
    ],
    columns: ['Classe', 'Produto', 'Categoria', 'Vendidas', 'Faturamento', 'Participação', 'Acumulado', 'Lucro', 'Estoque'],
    rows: ranking.map(item => [
      item.abcClass,
      item.product.name || 'Produto',
      item.category,
      numberLabel(item.unitsSold),
      formatCurrency(item.revenue),
      percentLabel(item.share),
      percentLabel(item.accumulatedShare),
      formatCurrency(item.profit),
      numberLabel(item.product.quantity)
    ]),
    chart: chart('Faturamento por classificação ABC', [
      { label: 'Classe A', value: sumMoney(classA, item => Math.max(0, item.revenue)) },
      { label: 'Classe B', value: sumMoney(classB, item => Math.max(0, item.revenue)) },
      { label: 'Classe C', value: sumMoney(classC, item => Math.max(0, item.revenue)) }
    ]),
    notes: [
      'Classe A concentra aproximadamente os primeiros 80% do faturamento; classe B avança até 95%; os demais itens ficam na classe C.',
      'A receita é rateada em centavos entre os itens de cada venda, incluindo o efeito dos cancelamentos.',
      'Produtos sem vendas permanecem visíveis na classe C para apoiar decisões de estoque.'
    ]
  };
};

const replenishmentReport = context => {
  const forecast = buildReplenishmentForecast(context);
  const needsPurchase = forecast.filter(item => item.needsReplenishment);
  const abcByProduct = new Map(buildProductAbcClassification(context).map(item => [String(item.product.id), item.abcClass]));
  return {
    id: 'stock-replenishment',
    title: 'Estoque mínimo e previsão de reposição',
    subtitle: 'Giro do período combinado com o estoque atual e o prazo de reposição de cada produto.',
    metrics: [
      metric('Produtos no mínimo ou abaixo', forecast.filter(item => item.currentStock <= item.minimumStock).length, 'number', 'negative'),
      metric('Produtos sem estoque', forecast.filter(item => item.currentStock <= 0).length, 'number', 'negative'),
      metric('Produtos para repor agora', needsPurchase.length, 'number', needsPurchase.length ? 'negative' : 'positive'),
      metric('Unidades sugeridas para compra', needsPurchase.reduce((sum, item) => sum + item.suggestedQuantity, 0), 'number'),
      metric('Investimento estimado', sumMoney(needsPurchase, item => item.suggestedCost)),
      metric('Produtos sem giro', forecast.filter(item => item.unitsSold <= 0 && item.currentStock > 0).length, 'number')
    ],
    columns: ['Produto', 'Curva ABC', 'Estoque', 'Mínimo', 'Vendidas', 'Cobertura', 'Previsão de falta', 'Prazo reposição', 'Comprar', 'Situação'],
    rows: forecast.map(item => [
      item.product.name || 'Produto',
      abcByProduct.get(String(item.product.id)) || 'C',
      numberLabel(item.currentStock),
      numberLabel(item.minimumStock),
      numberLabel(item.unitsSold),
      item.coverageDays === null ? 'Sem giro' : `${numberLabel(item.coverageDays)} dias`,
      item.stockoutDate ? formatDate(item.stockoutDate) : 'Sem previsão',
      `${numberLabel(item.leadTimeDays)} dias`,
      numberLabel(item.suggestedQuantity),
      item.status
    ]),
    chart: chart('Produtos com maior necessidade de reposição', needsPurchase
      .filter(item => item.suggestedQuantity > 0)
      .slice(0, 8)
      .map(item => ({
        label: item.product.name || 'Produto',
        value: item.suggestedQuantity,
        display: `${numberLabel(item.suggestedQuantity)} unidades`
      }))),
    notes: [
      'Configure o estoque mínimo e o prazo médio do fornecedor no cadastro de cada produto.',
      'Produtos antigos utilizam 3 unidades como mínimo e 7 dias para reposição até serem configurados.',
      'A cobertura usa vendas líquidas de cancelamentos no período selecionado e o estoque existente agora.',
      'Produtos sem vendas no período ficam sem previsão de falta: o sistema não inventa uma demanda.'
    ]
  };
};

export const buildRecurringCustomers = ({ sales = [], customers = [], startDate, endDate }) => {
  const directory = new Map((customers || []).map(customer => [`id:${customer.id}`, customer]));
  const visible = projectSalesAsOf(sales, endDate).filter(sale => {
    const saleDate = isoDate(sale.saleDate);
    return !!saleDate && saleDate <= endDate && sale.status !== 'canceled';
  });
  const byCustomer = new Map();
  visible.forEach(sale => {
    const identity = customerIdentity(sale);
    if (!identity) return;
    if (!byCustomer.has(identity)) byCustomer.set(identity, []);
    byCustomer.get(identity).push(sale);
  });

  return [...byCustomer.entries()].map(([identity, history]) => {
    history.sort((left, right) => String(left.saleDate).localeCompare(String(right.saleDate)));
    const periodSales = history.filter(sale => inFinancialPeriod(sale.saleDate, startDate, endDate));
    const customer = directory.get(identity) || {};
    const firstDate = isoDate(history[0]?.saleDate);
    const latestDate = isoDate(history.at(-1)?.saleDate);
    const span = history.length > 1
      ? Math.max(0, Math.round((dateTimestamp(latestDate) - dateTimestamp(firstDate)) / MS_PER_DAY))
      : null;
    const averageInterval = span === null ? null : Math.round(span / (history.length - 1));
    const daysInactive = Math.max(0, Math.round((dateTimestamp(endDate) - dateTimestamp(latestDate)) / MS_PER_DAY));
    const periodRevenue = sumMoney(periodSales, sale => sale.totalPrice);
    const lifetimeRevenue = sumMoney(history, sale => sale.totalPrice);
    const recurrenceThreshold = averageInterval === null ? 30 : Math.max(15, Math.ceil(averageInterval * 1.5));
    let status = history.length < 2 ? 'Primeira compra' : 'Recorrente';
    if (daysInactive >= recurrenceThreshold && history.length >= 2) status = 'Precisa de atenção';
    return {
      identity,
      name: customer.name || history.at(-1)?.customerName || 'Cliente',
      phone: customer.phone || history.at(-1)?.customerPhone || '',
      history,
      periodSales,
      periodRevenue,
      lifetimeRevenue,
      firstDate,
      latestDate,
      averageInterval,
      daysInactive,
      recurrent: history.length >= 2,
      returningInPeriod: periodSales.length > 0 && firstDate < startDate,
      status
    };
  }).sort((left, right) => right.periodRevenue - left.periodRevenue
    || right.history.length - left.history.length
    || String(left.name).localeCompare(String(right.name), 'pt-BR'));
};

const recurringCustomersReport = context => {
  const allCustomers = buildRecurringCustomers(context);
  const buyers = allCustomers.filter(item => item.periodSales.length > 0);
  const recurrent = buyers.filter(item => item.recurrent);
  const returning = buyers.filter(item => item.returningInPeriod);
  const attention = allCustomers.filter(item => item.status === 'Precisa de atenção');
  const recurringRevenue = sumMoney(recurrent, item => item.periodRevenue);
  const intervals = recurrent.map(item => item.averageInterval).filter(value => value !== null);
  const rows = [...buyers, ...attention.filter(item => item.periodSales.length === 0)];
  const newCustomers = buyers.filter(item => item.firstDate >= context.startDate);
  const opportunities = Array.isArray(context.repurchaseSuggestions)
    ? context.repurchaseSuggestions.filter(item => !context.customerFilter || context.customerFilter === 'all'
      || String(item.customerId) === String(context.customerFilter))
    : attention;

  return {
    id: 'repeat-customers',
    title: 'Clientes recorrentes',
    subtitle: 'Recompra, frequência, faturamento e oportunidades para reativar clientes.',
    metrics: [
      metric('Clientes que compraram', buyers.length, 'number'),
      metric('Clientes novos no período', newCustomers.length, 'number'),
      metric('Clientes recorrentes', recurrent.length, 'number'),
      metric('Taxa de recorrência', buyers.length ? recurrent.length / buyers.length * 100 : 0, 'percent'),
      metric('Clientes que retornaram', returning.length, 'number'),
      metric('Receita de clientes recorrentes', recurringRevenue),
      metric('Intervalo médio de recompra', intervals.length
        ? `${numberLabel(Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length))} dias`
        : 'Ainda sem histórico', 'text'),
      metric('Clientes para reativar', attention.length, 'number', attention.length ? 'negative' : ''),
      metric('Oportunidades de recompra', opportunities.length, 'number', opportunities.length ? 'positive' : '')
    ],
    columns: ['Cliente', 'Compras no período', 'Compras totais', 'Receita no período', 'Última compra', 'Recompra média', 'Situação'],
    rows: rows.map(item => [
      item.name,
      numberLabel(item.periodSales.length),
      numberLabel(item.history.length),
      formatCurrency(item.periodRevenue),
      formatDate(item.latestDate),
      item.averageInterval === null ? 'Primeira compra' : `${numberLabel(item.averageInterval)} dias`,
      item.status
    ]),
    rowActions: rows.map(item => ({
      customerName: item.name,
      phone: item.phone,
      type: item.status === 'Precisa de atenção' ? 'repurchase' : 'customer'
    })),
    chart: chart('Receita dos clientes recorrentes', recurrent.slice(0, 8)
      .map(item => ({ label: item.name, value: item.periodRevenue }))),
    notes: [
      'Um cliente é considerado recorrente quando possui pelo menos duas compras válidas até a data final do relatório.',
      'Vendas canceladas integralmente e vendas avulsas sem identificação não entram na recorrência.',
      'Clientes sem cadastro são identificados pelo telefone ou, na ausência dele, pelo nome informado.',
      'O alerta de reativação aparece quando o tempo sem comprar ultrapassa o padrão histórico de recompra.'
    ]
  };
};

const discountsAndPromotionsReport = context => {
  const directory = new Map((context.products || []).flatMap(product => [
    [`id:${String(product.id || '')}`, product],
    [`name:${normalizeText(product.name)}`, product]
  ]));
  const restrictProducts = context.productFilter !== 'all' || context.categoryFilter !== 'all';
  const events = [];
  let inferredPromotions = 0;

  projectSalesAsOf(context.sales || [], context.endDate)
    .filter(sale => sale.status !== 'canceled' && inFinancialPeriod(sale.saleDate, context.startDate, context.endDate))
    .forEach(sale => (sale.items || []).forEach(item => {
      const product = directory.get(`id:${String(item?.productId || '')}`)
        || directory.get(`name:${normalizeText(item?.productName || item?.name)}`);
      if (restrictProducts && !product) return;

      const units = quantity(item.quantity);
      if (units <= 0) return;
      const manualUnitDiscount = Math.max(0, numeric(item.unitDiscount));
      const hasPromotionSnapshot = item.promotionUnitDiscount !== undefined && item.promotionUnitDiscount !== null;
      const matchesLegacyPromotion = !!product?.isPromo
        && !!product?.promoStart && !!product?.promoEnd
        && sale.saleDate >= product.promoStart && sale.saleDate <= product.promoEnd
        && toCents(numeric(item.unitPrice) + manualUnitDiscount) <= toCents(product.promoPrice)
        && toCents(product.salePrice) > toCents(product.promoPrice);
      const promotionUnitDiscount = hasPromotionSnapshot
        ? Math.max(0, numeric(item.promotionUnitDiscount))
        : matchesLegacyPromotion
          ? fromCents(toCents(product.salePrice) - toCents(product.promoPrice))
          : 0;
      const manualDiscount = fromCents(toCents(manualUnitDiscount) * units);
      const promotionDiscount = fromCents(toCents(promotionUnitDiscount) * units);
      const totalDiscount = fromCents(toCents(manualDiscount) + toCents(promotionDiscount));
      if (toCents(totalDiscount) <= 0) return;
      if (promotionDiscount > 0 && !hasPromotionSnapshot) inferredPromotions += 1;

      const revenue = money(item.price ?? numeric(item.unitPrice) * units);
      const cost = money(item.cost ?? numeric(item.unitCost) * units);
      const profit = fromCents(toCents(revenue) - toCents(cost));
      const reason = String(item.discountReason || '').trim();
      events.push({
        sale,
        item,
        units,
        manualDiscount,
        promotionDiscount,
        totalDiscount,
        revenue,
        cost,
        profit,
        reason: promotionDiscount > 0 && manualDiscount > 0
          ? `Promoção + ${reason || 'desconto sem motivo'}`
          : promotionDiscount > 0
            ? 'Promoção cadastrada'
            : reason || 'Não informado',
        finalMargin: revenue > 0 ? profit / revenue * 100 : 0
      });
    }));

  events.sort((left, right) => String(right.sale.saleDateTime || right.sale.saleDate)
    .localeCompare(String(left.sale.saleDateTime || left.sale.saleDate)));
  const manualEvents = events.filter(event => event.manualDiscount > 0);
  const promotionEvents = events.filter(event => event.promotionDiscount > 0);
  const manualTotal = sumMoney(events, event => event.manualDiscount);
  const promotionTotal = sumMoney(events, event => event.promotionDiscount);
  const totalDiscount = fromCents(toCents(manualTotal) + toCents(promotionTotal));
  const revenue = sumMoney(events, event => event.revenue);
  const cost = sumMoney(events, event => event.cost);
  const profit = fromCents(toCents(revenue) - toCents(cost));
  const undiscountedRevenue = fromCents(toCents(revenue) + toCents(totalDiscount));
  const undiscountedProfit = fromCents(toCents(undiscountedRevenue) - toCents(cost));
  const initialMargin = undiscountedRevenue > 0 ? undiscountedProfit / undiscountedRevenue * 100 : 0;
  const finalMargin = revenue > 0 ? profit / revenue * 100 : 0;
  const marginImpact = initialMargin - finalMargin;
  const byProduct = new Map();
  events.forEach(event => {
    const name = event.item.productName || event.item.name || 'Produto';
    byProduct.set(name, fromCents(toCents(byProduct.get(name) || 0) + toCents(event.totalDiscount)));
  });

  const notes = [
    'Promoções usam o preço normal e o preço promocional registrados no momento da venda; descontos adicionais permanecem separados.',
    'O impacto na margem compara a margem dos itens pelo preço normal com a margem efetiva após promoções e descontos.',
    'Descontos antigos sem motivo gravado aparecem como “Não informado”.'
  ];
  if (inferredPromotions > 0) notes.push(
    `${numberLabel(inferredPromotions)} item(ns) de vendas antigas tiveram a promoção estimada a partir do cadastro atual do produto.`
  );

  return {
    id: 'discounts',
    title: 'Descontos e promoções',
    subtitle: 'Promoções, descontos adicionais, motivos registrados e impacto real na margem.',
    metrics: [
      metric('Desconto total', manualTotal),
      metric('Redução em promoções', promotionTotal),
      metric('Redução comercial total', totalDiscount),
      metric('Vendas com desconto', new Set(manualEvents.map(event => event.sale.id)).size, 'number'),
      metric('Vendas com promoção', new Set(promotionEvents.map(event => event.sale.id)).size, 'number'),
      metric('Itens com desconto', manualEvents.length, 'number'),
      metric('Itens em promoção', promotionEvents.length, 'number'),
      metric('Desconto médio por item', manualEvents.length ? manualTotal / manualEvents.length : 0),
      metric('Maior desconto em um item', manualEvents.length
        ? Math.max(...manualEvents.map(event => event.manualDiscount)) : 0),
      metric('Margem sem reduções', initialMargin, 'percent'),
      metric('Margem final dos itens', finalMargin, 'percent'),
      metric('Impacto na margem', marginImpact, 'percent', marginImpact > 0 ? 'negative' : '')
    ],
    columns: [
      'Data', 'Cliente', 'Produto', 'Qtd.', 'Promoção', 'Desconto extra',
      'Redução total', 'Motivo', 'Margem final', 'Valor final do item'
    ],
    rows: events.map(event => [
      formatDate(event.sale.saleDate),
      event.sale.customerName || 'Venda avulsa',
      event.item.productName || event.item.name || 'Produto',
      numberLabel(event.units),
      formatCurrency(event.promotionDiscount),
      formatCurrency(event.manualDiscount),
      formatCurrency(event.totalDiscount),
      event.reason,
      percentLabel(event.finalMargin),
      formatCurrency(event.revenue)
    ]),
    chart: chart('Reduções comerciais por produto', [...byProduct.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }))),
    notes
  };
};

const comparableReports = new Set(['result', 'sales', 'sale-profit', 'products', 'net-result', 'sales-channels', 'repeat-customers']);

export const buildReport = input => {
  const context = {
    paymentFilter: 'all',
    saleChannel: 'all',
    compareWithPrevious: true,
    sales: [],
    products: [],
    customers: [],
    financialData: {},
    ...input
  };
  const filtered = applyReportFilters(context);

  let result;
  switch (filtered.reportId) {
    case 'period-comparison': result = comparisonReport(filtered); break;
    case 'net-result': result = netResultReport(filtered); break;
    case 'sales-channels': result = channelsReport(filtered); break;
    case 'stock-replenishment': result = replenishmentReport(filtered); break;
    case 'stock-abc': result = abcReport(filtered); break;
    case 'repeat-customers': result = recurringCustomersReport(filtered); break;
    case 'discounts': result = discountsAndPromotionsReport(filtered); break;
    default: result = buildAccountingReport(filtered); break;
  }
  if (!result.comparison && filtered.compareWithPrevious && comparableReports.has(filtered.reportId)) {
    result.comparison = buildPeriodComparison(filtered);
  }
  if (filtered.reportId === 'sales') {
    const evolution = buildDailySalesEvolution(filtered);
    const revenueComparison = result.comparison?.metrics.find(item => item.label === 'Faturamento líquido');
    const activeChannels = new Set(projectSalesAsOf(filtered.sales, filtered.endDate).filter(sale => (
      inFinancialPeriod(sale.saleDate, filtered.startDate, filtered.endDate) && sale.status !== 'canceled'
    )).map(getSaleChannel).filter(channel => channel !== 'unknown'));
    result.metrics.push(
      revenueComparison?.percent === null
        ? metric('Crescimento do faturamento', revenueComparison?.deltaDisplay || 'Sem histórico', 'text')
        : metric('Crescimento do faturamento', revenueComparison?.percent || 0, 'percent'),
      metric('Canais de venda ativos', activeChannels.size, 'number')
    );
    result.dailyEvolution = evolution;
    result.chart = chart('Evolução diária do faturamento', evolution.filter(item => item.revenue !== 0)
      .slice(-31).map(item => ({ label: item.label, value: Math.max(0, item.revenue), display: formatCurrency(item.revenue) })));
    result.notes = [...(result.notes || []),
      'O crescimento compara o faturamento líquido com um período anterior de mesma duração; dias sem vendas permanecem no histórico diário.'
    ];
  }
  if (filtered.filterCapabilities?.product && (filtered.productFilter !== 'all' || filtered.categoryFilter !== 'all')
    && ['sales', 'sale-profit', 'sales-channels', 'discounts'].includes(filtered.reportId)) {
    result.notes = [...(result.notes || []),
      'Filtros de produto e categoria selecionam vendas que contêm os itens escolhidos; os valores continuam representando o total de cada venda.'
    ];
  }
  return result;
};
