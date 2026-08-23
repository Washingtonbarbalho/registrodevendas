import { formatCurrency, formatDate } from './utils.js';
import {
  buildReport as buildLegacyReport,
  PAYMENT_FILTERS,
  paymentLabel,
  REPORT_DEFINITIONS,
  reportPeriodLabel
} from './reports-engine-v65.js';
import {
  allocateMoney,
  buildFinancialLedger,
  cleanFinancialDate,
  fromCents,
  getDirectSaleNet,
  getPurchaseGroups,
  getSalesAccrualSummary,
  inFinancialPeriod,
  isTermSale,
  money,
  projectSalesAsOf,
  sumMoney,
  summarizeFinancialLedger,
  toCents
} from './financial-core-v70.js';

export { PAYMENT_FILTERS, paymentLabel, REPORT_DEFINITIONS, reportPeriodLabel };

const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const quantity = value => Math.max(0, parseInt(value, 10) || 0);
const numberLabel = value => numeric(value).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const percentLabel = value => `${numeric(value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const paymentKey = sale => sale?.saleType === 'direct' ? sale.paymentMethod || 'money' : 'prazo';
const saleNet = sale => sale?.saleType === 'direct' ? getDirectSaleNet(sale) : money(sale?.totalPrice);
const saleCost = sale => money(sale?.totalCost);
const saleProfit = sale => fromCents(toCents(saleNet(sale)) - toCents(saleCost(sale)));
const itemRevenue = item => money(item?.price ?? numeric(item?.unitPrice) * quantity(item?.quantity));
const itemCost = item => money(item?.cost ?? numeric(item?.unitCost) * quantity(item?.quantity));

const momentLabel = (date, timestamp = '') => {
  const normalized = cleanFinancialDate(date || timestamp);
  const formatted = normalized ? formatDate(normalized) : '--/--/----';
  if (!timestamp) return `${formatted} · --:--`;
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime())
    ? `${formatted} · --:--`
    : `${formatted} · ${parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

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

const chart = (title, items) => ({
  title,
  items: (items || []).filter(item => numeric(item.value) >= 0).map(item => ({
    ...item,
    value: money(item.value),
    display: item.display || formatCurrency(item.value)
  }))
});

const report = (id, title, subtitle, metrics, columns, rows, graph = null, notes = []) => ({
  id, title, subtitle, metrics, columns, rows, chart: graph, notes
});

const resultReport = context => {
  const { sales = [], products = [], financialData = {}, startDate, endDate } = context;
  const accrual = getSalesAccrualSummary(sales, startDate, endDate);
  const cash = summarizeFinancialLedger(buildFinancialLedger({ sales, products, financialData }), startDate, endDate);
  const manualIncome = sumMoney(cash.rows.filter(item => item.type === 'income' && item.source === 'manual'), item => item.amount);
  const manualExpense = sumMoney(cash.rows.filter(item => item.type === 'expense' && item.source === 'manual'), item => item.amount);
  const paidPurchases = sumMoney(cash.rows.filter(item => item.type === 'expense' && item.source === 'stock'), item => item.amount);
  const margin = accrual.net > 0 ? accrual.profit / accrual.net * 100 : 0;

  return report(
    'result',
    'Resultado financeiro',
    'Resultado por competência e fluxo de caixa conciliados com o Financeiro.',
    [
      metric('Faturamento bruto', accrual.gross),
      metric('Receita líquida das vendas', accrual.net),
      metric('Custo das mercadorias vendidas', accrual.cost),
      metric('Lucro bruto', accrual.profit, 'currency', accrual.profit >= 0 ? 'positive' : 'negative'),
      metric('Margem bruta', margin, 'percent'),
      metric('Descontos concedidos', accrual.discounts),
      metric('Taxas de cartão assumidas pela loja', accrual.storeFees),
      metric('Taxas de cartão pagas pelos clientes', accrual.customerFees),
      metric('Juros do crediário', accrual.carnetInterest),
      metric('Cancelamentos no período', accrual.cancellations.length, 'number'),
      metric('Valor cancelado no período', accrual.canceledGross),
      metric('Entradas de caixa', cash.income, 'currency', 'positive'),
      metric('Saídas de caixa', cash.expense, 'currency', 'negative'),
      metric('Saldo do fluxo de caixa', cash.balance, 'currency', cash.balance >= 0 ? 'positive' : 'negative')
    ],
    ['Componente', 'Quantidade', 'Valor'],
    [
      ['Vendas registradas', numberLabel(accrual.origins.length), formatCurrency(accrual.originalGross)],
      ['Cancelamentos registrados', numberLabel(accrual.cancellations.length), formatCurrency(accrual.canceledGross)],
      ['Compras e parcelas pagas', numberLabel(cash.rows.filter(item => item.source === 'stock').length), formatCurrency(paidPurchases)],
      ['Outras entradas manuais', '—', formatCurrency(manualIncome)],
      ['Outras saídas manuais', '—', formatCurrency(manualExpense)],
      ['Taxas assumidas pela loja', '—', formatCurrency(accrual.storeFees)],
      ['Descontos concedidos', '—', formatCurrency(accrual.discounts)]
    ],
    chart('Comparativo do período', [
      { label: 'Entradas', value: cash.income },
      { label: 'Saídas', value: cash.expense },
      { label: 'Lucro bruto', value: Math.max(0, accrual.profit) }
    ]),
    [
      'Vendas e cancelamentos entram no mês em que cada evento aconteceu, preservando os resultados dos meses anteriores.',
      'Entradas, saídas e saldo utilizam exatamente os mesmos lançamentos do Financeiro, incluindo parcelas pagas de compras.',
      'Lucro considera receita líquida menos custo; fluxo de caixa considera apenas pagamentos e recebimentos efetivos.'
    ]
  );
};

const salesReport = context => {
  const filter = context.paymentFilter || 'all';
  const matches = sale => filter === 'all' || paymentKey(sale) === filter;
  const filteredSales = (context.sales || []).filter(matches);
  const accrual = getSalesAccrualSummary(filteredSales, context.startDate, context.endDate);
  const projected = projectSalesAsOf(accrual.origins, context.endDate);
  const valid = projected.filter(sale => sale.status !== 'canceled');
  const validGross = sumMoney(valid, sale => sale.totalPrice);
  const ticket = valid.length ? money(validGross / valid.length) : 0;
  const cancellationSales = new Set(accrual.cancellations.map(item => item.sale.id));
  const canceledProfit = sumMoney(accrual.cancellations, item => item.event.profitImpactAmount);
  const rows = projected.map(sale => {
    const canceled = sale.status === 'canceled';
    const event = [...(sale.cancellations || [])].reverse().find(item => inFinancialPeriod(item.date, context.startDate, context.endDate));
    return {
      sortDate: sale.saleDateTime || sale.saleDate,
      columns: [
        momentLabel(sale.saleDate, sale.saleDateTime),
        sale.customerName || 'Venda avulsa',
        paymentLabel(paymentKey(sale)),
        canceled ? 'Cancelada' : sale.status === 'completed' ? 'Concluída' : 'Ativa',
        formatCurrency(sale.totalPrice),
        canceled ? '—' : formatCurrency(saleProfit(sale)),
        formatCurrency(sale.totalDiscount || 0),
        event?.reason || (canceled ? sale.cancelReason || 'Sem motivo informado' : '—')
      ]
    };
  });

  accrual.cancellations.forEach(({ sale, event }) => {
    if (inFinancialPeriod(sale.saleDate, context.startDate, context.endDate)) return;
    rows.push({
      sortDate: event.createdAt || event.date,
      columns: [
        momentLabel(event.date, event.createdAt),
        sale.customerName || 'Venda avulsa',
        paymentLabel(paymentKey(sale)),
        'Cancelamento de mês anterior',
        formatCurrency(-event.canceledContractValue),
        formatCurrency(-event.profitImpactAmount),
        '—',
        event.reason || 'Sem motivo informado'
      ]
    });
  });

  const byDay = new Map();
  accrual.origins.forEach(sale => {
    const date = cleanFinancialDate(sale.saleDate);
    byDay.set(date, fromCents(toCents(byDay.get(date)) + toCents(sale.totalPrice)));
  });
  accrual.cancellations.forEach(({ event }) => {
    byDay.set(event.date, fromCents(toCents(byDay.get(event.date)) - toCents(event.canceledContractValue)));
  });

  return report(
    'sales',
    'Vendas',
    `Desempenho das vendas · Forma de pagamento: ${PAYMENT_FILTERS.find(([key]) => key === filter)?.[1] || 'Todas'}.`,
    [
      metric('Vendas válidas', valid.length, 'number'),
      metric('Faturamento', accrual.gross),
      metric('Ticket médio', ticket),
      metric('Lucro estimado', accrual.profit, 'currency', accrual.profit >= 0 ? 'positive' : 'negative'),
      metric('Margem', accrual.net > 0 ? accrual.profit / accrual.net * 100 : 0, 'percent'),
      metric('Descontos', accrual.discounts),
      metric('Vendas canceladas', cancellationSales.size, 'number'),
      metric('Valor cancelado', accrual.canceledGross),
      metric('Lucro cancelado', canceledProfit)
    ],
    ['Data / hora', 'Cliente', 'Pagamento', 'Status', 'Venda', 'Lucro', 'Desconto', 'Motivo do cancelamento'],
    rows.sort((left, right) => String(right.sortDate || '').localeCompare(String(left.sortDate || ''))).map(row => row.columns),
    chart('Faturamento por dia', [...byDay.entries()].sort((left, right) => left[0].localeCompare(right[0])).slice(-14).map(([date, value]) => ({
      label: formatDate(date).slice(0, 5), value: Math.max(0, value)
    }))),
    ['Cancelamentos de vendas de meses anteriores aparecem no mês do cancelamento, sem alterar o faturamento já apurado anteriormente.']
  );
};

const saleProfitReport = context => {
  const accrual = getSalesAccrualSummary(context.sales, context.startDate, context.endDate);
  const rows = accrual.origins.map(sale => ({
    sortProfit: saleProfit(sale),
    columns: [
      momentLabel(sale.saleDate, sale.saleDateTime),
      sale.customerName || 'Venda avulsa',
      paymentLabel(paymentKey(sale)),
      formatCurrency(sale.totalPrice),
      formatCurrency(saleNet(sale)),
      formatCurrency(saleCost(sale)),
      formatCurrency(sale?.feeConfig?.type === 'sem_juros' ? sale.feeConfig.storeAbsorbedFeeValue ?? sale.feeConfig.value : 0),
      formatCurrency(saleProfit(sale)),
      percentLabel(saleNet(sale) > 0 ? saleProfit(sale) / saleNet(sale) * 100 : 0)
    ]
  }));

  accrual.cancellations.forEach(({ sale, event }) => {
    const canceledNet = sale.saleType === 'direct' ? event.storeImpactAmount : event.canceledContractValue;
    rows.push({
      sortProfit: -event.profitImpactAmount,
      columns: [
        momentLabel(event.date, event.createdAt),
        `${sale.customerName || 'Venda avulsa'} · Cancelamento`,
        paymentLabel(paymentKey(sale)),
        formatCurrency(-event.canceledContractValue),
        formatCurrency(-canceledNet),
        formatCurrency(-event.canceledCostAmount),
        '—',
        formatCurrency(-event.profitImpactAmount),
        '—'
      ]
    });
  });

  const ranked = [...rows].sort((left, right) => right.sortProfit - left.sortProfit);
  return report(
    'sale-profit',
    'Lucro por venda',
    'Resultado de cada venda e reversões registradas no período.',
    [
      metric('Receita líquida', accrual.net),
      metric('Custo vendido', accrual.cost),
      metric('Taxas assumidas', accrual.storeFees),
      metric('Lucro total', accrual.profit, 'currency', accrual.profit >= 0 ? 'positive' : 'negative'),
      metric('Margem média', accrual.net > 0 ? accrual.profit / accrual.net * 100 : 0, 'percent')
    ],
    ['Data', 'Cliente', 'Pagamento', 'Cobrado', 'Líquido', 'Custo', 'Taxa loja', 'Lucro', 'Margem'],
    ranked.map(row => row.columns),
    chart('Maiores lucros por venda', ranked.filter(row => row.sortProfit > 0).slice(0, 7).map(row => ({
      label: row.columns[1], value: row.sortProfit
    }))),
    ['O lucro cancelado é revertido na data efetiva do cancelamento.']
  );
};

const productsReport = context => {
  const accrual = getSalesAccrualSummary(context.sales, context.startDate, context.endDate);
  const groups = new Map();

  const applyItems = (items, totalRevenue, totalCost, direction) => {
    if (!Array.isArray(items) || items.length === 0) return;
    const revenues = allocateMoney(totalRevenue, items.map(item => itemRevenue(item)));
    const costs = allocateMoney(totalCost, items.map(item => itemCost(item) || itemRevenue(item)));
    items.forEach((item, index) => {
      const key = item.productId || item.productName || item.name || 'sem-id';
      const row = groups.get(key) || { name: item.productName || item.name || 'Produto', quantity: 0, revenueCents: 0, costCents: 0 };
      row.quantity += quantity(item.quantity) * direction;
      row.revenueCents += toCents(revenues[index]) * direction;
      row.costCents += toCents(costs[index]) * direction;
      groups.set(key, row);
    });
  };

  accrual.origins.forEach(sale => applyItems(sale.items || [], saleNet(sale), saleCost(sale), 1));
  accrual.cancellations.forEach(({ sale, event }) => {
    const eventItems = Array.isArray(event.items) && event.items.length ? event.items : sale.items || [];
    const normalizedItems = eventItems.map(item => ({
      ...item,
      price: item.amount ?? item.price,
      cost: item.canceledCostAmount ?? item.cost
    }));
    const canceledNet = sale.saleType === 'direct' ? event.storeImpactAmount : event.canceledContractValue;
    applyItems(normalizedItems, canceledNet, event.canceledCostAmount, -1);
  });

  const rows = [...groups.values()].map(row => {
    const revenue = fromCents(row.revenueCents);
    const cost = fromCents(row.costCents);
    const profit = fromCents(row.revenueCents - row.costCents);
    return { ...row, revenue, cost, profit, margin: revenue > 0 ? profit / revenue * 100 : 0 };
  }).filter(row => row.quantity !== 0 || row.revenueCents !== 0 || row.costCents !== 0)
    .sort((left, right) => right.profit - left.profit);

  const totalRevenue = sumMoney(rows, row => row.revenue);
  const totalCost = sumMoney(rows, row => row.cost);
  const totalProfit = fromCents(toCents(totalRevenue) - toCents(totalCost));
  const totalUnits = rows.reduce((total, row) => total + row.quantity, 0);

  return report(
    'products',
    'Produtos',
    'Ranking de produtos com rateio exato e reversões do período.',
    [
      metric('Produtos diferentes vendidos', rows.filter(row => row.quantity > 0).length, 'number'),
      metric('Unidades vendidas', totalUnits, 'number'),
      metric('Receita líquida alocada', totalRevenue),
      metric('Custo vendido', totalCost),
      metric('Lucro', totalProfit, 'currency', totalProfit >= 0 ? 'positive' : 'negative')
    ],
    ['Produto', 'Qtd.', 'Receita', 'Custo', 'Lucro', 'Margem'],
    rows.map(row => [row.name, numberLabel(row.quantity), formatCurrency(row.revenue), formatCurrency(row.cost), formatCurrency(row.profit), percentLabel(row.margin)]),
    chart('Produtos com maior lucro', rows.slice(0, 8).map(row => ({ label: row.name, value: Math.max(0, row.profit) }))),
    ['O rateio distribui os centavos restantes entre os itens para que o total dos produtos seja idêntico ao total das vendas.']
  );
};

const stockReport = context => {
  const accrual = getSalesAccrualSummary(context.sales, context.startDate, context.endDate);
  const groups = getPurchaseGroups(context.products);
  const soldByProduct = new Map();
  const purchasedByProduct = new Map();

  const addQuantity = (map, key, amount) => {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + amount);
  };

  accrual.origins.forEach(sale => (sale.items || []).forEach(item => {
    addQuantity(soldByProduct, item.productId || item.productName || item.name, quantity(item.quantity));
  }));
  accrual.cancellations.forEach(({ sale, event }) => {
    const items = Array.isArray(event.items) && event.items.length ? event.items : sale.items || [];
    items.forEach(item => addQuantity(soldByProduct, item.productId || item.productName || item.name, -quantity(item.quantity)));
  });

  groups.forEach(group => group.items.forEach(item => {
    if (inFinancialPeriod(group.purchaseDate, context.startDate, context.endDate)) {
      addQuantity(purchasedByProduct, item.product.id, item.originalQuantity);
    }
    item.events.forEach(event => {
      if (inFinancialPeriod(event.date, context.startDate, context.endDate)) {
        addQuantity(purchasedByProduct, item.product.id, -event.quantity);
      }
    });
  }));

  const rows = (context.products || []).map(product => {
    const currentQuantity = quantity(product.quantity);
    const cost = money(product.costPrice);
    const salePrice = money(product.salePrice);
    return {
      product,
      quantity: currentQuantity,
      sold: soldByProduct.get(product.id) || soldByProduct.get(product.name) || 0,
      purchased: purchasedByProduct.get(product.id) || 0,
      stockCost: money(currentQuantity * cost),
      stockSale: money(currentQuantity * salePrice),
      potentialProfit: money(currentQuantity * Math.max(0, salePrice - cost))
    };
  }).sort((left, right) => right.stockCost - left.stockCost);

  return report(
    'stock',
    'Estoque',
    'Posição atual do estoque combinada com as movimentações reais do período.',
    [
      metric('Unidades em estoque agora', rows.reduce((total, row) => total + row.quantity, 0), 'number'),
      metric('Custo atual do estoque', sumMoney(rows, row => row.stockCost)),
      metric('Valor potencial de venda', sumMoney(rows, row => row.stockSale)),
      metric('Lucro potencial', sumMoney(rows, row => row.potentialProfit)),
      metric('Produtos sem estoque', rows.filter(row => row.quantity <= 0).length, 'number'),
      metric('Produtos sem venda no período', rows.filter(row => row.sold <= 0 && row.quantity > 0).length, 'number')
    ],
    ['Produto', 'Estoque', 'Vendidas', 'Compradas', 'Custo estoque', 'Venda potencial'],
    rows.map(row => [
      row.product.name || 'Produto',
      numberLabel(row.quantity),
      numberLabel(row.sold),
      numberLabel(row.purchased),
      formatCurrency(row.stockCost),
      formatCurrency(row.stockSale)
    ]),
    chart('Maior capital imobilizado em estoque', rows.slice(0, 8).map(row => ({
      label: row.product.name || 'Produto', value: row.stockCost
    }))),
    [
      'A posição física e o valor do estoque são atuais; vendas, compras e devoluções respeitam a data em que cada movimentação aconteceu.',
      'Devoluções de compras ou vendas de meses anteriores aparecem como movimentações negativas no mês da devolução.'
    ]
  );
};

const purchasesReport = context => {
  const groups = getPurchaseGroups(context.products);
  const periodGroups = groups.filter(group => inFinancialPeriod(group.purchaseDate, context.startDate, context.endDate));
  const periodReturns = groups.flatMap(group => group.items.flatMap(item => item.events
    .filter(event => inFinancialPeriod(event.date, context.startDate, context.endDate))
    .map(event => ({ group, item, event }))));
  const gross = sumMoney(periodGroups, group => group.originalAmount);
  const returned = sumMoney(periodReturns, item => item.event.amount);
  const net = fromCents(toCents(gross) - toCents(returned));
  const boughtUnits = periodGroups.reduce((total, group) => total + group.items.reduce((count, item) => count + item.originalQuantity, 0), 0);
  const returnedUnits = periodReturns.reduce((total, item) => total + item.event.quantity, 0);
  const ledger = summarizeFinancialLedger(buildFinancialLedger({ products: context.products, purchaseGroups: groups }), context.startDate, context.endDate);
  const paidInstallments = sumMoney(ledger.rows.filter(item => item.source === 'stock' && item.purchaseGroup?.deferred), item => item.amount);
  const openPurchases = sumMoney(groups.filter(group => group.deferred && !group.fullyCanceled), group => group.openTotal);
  const byPayment = new Map();
  const rows = [];

  periodGroups.forEach(group => {
    const key = group.paymentMethod || 'unknown';
    byPayment.set(key, fromCents(toCents(byPayment.get(key)) + toCents(group.originalAmount)));
    const paidCount = group.plan.filter(item => item.paid && item.paidAt && item.paidAt <= context.endDate).length;
    group.items.forEach(item => {
      const returnedInPeriod = sumMoney(item.events.filter(event => inFinancialPeriod(event.date, context.startDate, context.endDate)), event => event.amount);
      const returnedUntilEnd = item.events.filter(event => event.date && event.date <= context.endDate)
        .reduce((total, event) => total + event.quantity, 0);
      const status = returnedUntilEnd >= item.originalQuantity ? 'Devolvida'
        : !group.deferred ? 'Paga'
        : paidCount >= group.plan.length ? `Paga ${paidCount}/${group.plan.length}`
        : paidCount > 0 ? `Parcial ${paidCount}/${group.plan.length}`
        : `A pagar 0/${group.plan.length}`;
      rows.push({
        sortDate: group.purchaseDateTime || group.purchaseDate,
        columns: [
          formatDate(group.purchaseDate),
          item.product.name || 'Produto',
          numberLabel(item.originalQuantity),
          formatCurrency(item.unitCost),
          formatCurrency(item.originalAmount),
          paymentLabel(group.paymentMethod),
          group.plan[0]?.dueDate ? formatDate(group.plan[0].dueDate) : '—',
          status,
          returnedInPeriod > 0 ? formatCurrency(returnedInPeriod) : '—'
        ]
      });
    });
  });

  periodReturns.forEach(({ group, item, event }) => {
    if (inFinancialPeriod(group.purchaseDate, context.startDate, context.endDate)) return;
    rows.push({
      sortDate: event.createdAt || event.date,
      columns: [
        formatDate(event.date),
        `${item.product.name || 'Produto'} · Devolução`,
        numberLabel(-event.quantity),
        formatCurrency(item.unitCost),
        formatCurrency(-event.amount),
        paymentLabel(group.paymentMethod),
        '—',
        'Compra de mês anterior',
        formatCurrency(event.amount)
      ]
    });
  });

  return report(
    'purchases',
    'Compras de mercadorias',
    'Compras, parcelas efetivamente pagas e devoluções do período.',
    [
      metric('Compras realizadas', periodGroups.length, 'number'),
      metric('Unidades compradas', boughtUnits, 'number'),
      metric('Valor bruto comprado', gross),
      metric('Devoluções', returned, 'currency', returned > 0 ? 'positive' : ''),
      metric('Valor líquido das compras', net),
      metric('Parcelas pagas no período', paidInstallments),
      metric('Saldo atual de compras a pagar', openPurchases),
      metric('Unidades devolvidas', returnedUnits, 'number')
    ],
    ['Data', 'Produto', 'Qtd.', 'Custo unit.', 'Total', 'Pagamento', 'Vencimento', 'Situação', 'Devolvido'],
    rows.sort((left, right) => String(right.sortDate || '').localeCompare(String(left.sortDate || ''))).map(row => row.columns),
    chart('Compras por forma de pagamento', [...byPayment.entries()].map(([key, value]) => ({
      label: key === 'unknown' ? 'Não informado' : paymentLabel(key), value
    }))),
    [
      'Compras em lote são contabilizadas uma única vez, mesmo quando possuem vários produtos.',
      'Cada parcela é reconhecida na sua própria data de pagamento; devoluções são registradas no mês em que ocorreram.'
    ]
  );
};

const creditReport = context => {
  const projectedContext = { ...context, sales: projectSalesAsOf(context.sales || [], context.endDate) };
  const current = buildLegacyReport(projectedContext);
  const termSales = (context.sales || []).filter(isTermSale);
  const cash = summarizeFinancialLedger(buildFinancialLedger({ sales: termSales }), context.startDate, context.endDate);
  const received = sumMoney(cash.rows.filter(item => item.source === 'sale'), item => item.amount);
  const refunds = sumMoney(cash.rows.filter(item => item.source === 'sale-refund'), item => item.amount);
  const metrics = current.metrics.map(item => item.label === 'Recebido no período'
    ? metric(item.label, received, 'currency', 'positive')
    : item);
  const receivedIndex = metrics.findIndex(item => item.label === 'Recebido no período');
  if (receivedIndex >= 0) metrics.splice(receivedIndex + 1, 0,
    metric('Estornos no período', refunds, 'currency', refunds > 0 ? 'negative' : ''),
    metric('Recebimento líquido no período', fromCents(toCents(received) - toCents(refunds)), 'currency')
  );
  return { ...current, metrics };
};

export const buildReport = context => {
  const normalized = { paymentFilter: 'all', sales: [], products: [], customers: [], financialData: {}, ...context };
  switch (normalized.reportId) {
    case 'result': return resultReport(normalized);
    case 'sales': return salesReport(normalized);
    case 'sale-profit': return saleProfitReport(normalized);
    case 'products': return productsReport(normalized);
    case 'stock': return stockReport(normalized);
    case 'purchases': return purchasesReport(normalized);
    case 'credit': return creditReport(normalized);
    default: return buildLegacyReport({ ...normalized, sales: projectSalesAsOf(normalized.sales, normalized.endDate) });
  }
};
