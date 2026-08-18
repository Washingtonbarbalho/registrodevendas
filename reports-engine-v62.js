import { formatCurrency, formatDate, getBrazilDateString } from './utils.js';

export const REPORT_DEFINITIONS = [
  { id: 'result', number: 1, title: 'Resultado financeiro', description: 'Faturamento, custos, lucro, entradas, saídas e resultado do período.' },
  { id: 'sales', number: 2, title: 'Vendas', description: 'Desempenho das vendas, ticket médio, lucro, descontos e formas de pagamento.' },
  { id: 'sale-profit', number: 3, title: 'Lucro por venda', description: 'Resultado individual de cada venda, custos, taxas, margem e lucro.' },
  { id: 'products', number: 4, title: 'Produtos', description: 'Ranking de produtos por quantidade, faturamento, lucro e margem.' },
  { id: 'stock', number: 5, title: 'Estoque', description: 'Valor atual do estoque, giro no período, produtos parados e cobertura.' },
  { id: 'purchases', number: 6, title: 'Compras de mercadorias', description: 'Compras, custos, formas de pagamento e devoluções a fornecedores.' },
  { id: 'credit', number: 7, title: 'Crediário', description: 'Carteira a prazo, recebimentos, saldo, atrasos e inadimplência.' }
];

export const PAYMENT_FILTERS = [
  ['all', 'Todas'], ['prazo', 'Crediário'], ['pix', 'PIX'], ['money', 'Dinheiro'], ['debit', 'Débito'], ['credit', 'Crédito']
];

const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const money = value => Math.round((num(value) + Number.EPSILON) * 100) / 100;
const cleanDate = value => String(value || '').split('T')[0];
const inPeriod = (value, startDate, endDate) => {
  const date = cleanDate(value);
  return !!date && date >= startDate && date <= endDate;
};
const quantity = value => Math.max(0, parseInt(value, 10) || 0);
const sum = (list, getter = value => value) => money((list || []).reduce((total, item) => total + num(getter(item)), 0));
const percent = value => `${num(value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const formatNumber = value => num(value).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const formatMoment = sale => {
  const date = cleanDate(sale?.saleDate || sale?.saleDateTime);
  const formatted = date ? formatDate(date) : '--/--/----';
  if (!sale?.saleDateTime) return `${formatted} · --:--`;
  const parsed = new Date(sale.saleDateTime);
  if (Number.isNaN(parsed.getTime())) return `${formatted} · --:--`;
  return `${formatted} · ${parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

export const paymentLabel = method => ({
  prazo: 'Crediário', pix: 'PIX', money: 'Dinheiro', debit: 'Débito', credit: 'Crédito', term: 'A prazo'
}[method] || 'Não informado');

const salePaymentKey = sale => sale?.saleType === 'direct' ? (sale.paymentMethod || 'money') : 'prazo';
const isTermSale = sale => sale?.saleType === 'prazo' || !sale?.saleType;
const isCanceled = sale => sale?.status === 'canceled';
const canceledStoreImpact = sale => sum(sale?.cancellations || [], event => event?.storeImpactAmount ?? event?.refundAmount ?? 0);

export const getDirectNet = sale => {
  const hasSaved = sale?.netReceived !== undefined && sale?.netReceived !== null && sale?.netReceived !== '' && Number.isFinite(Number(sale.netReceived));
  const original = hasSaved ? num(sale.netReceived) : Math.max(0, num(sale?.totalPrice) - num(sale?.feeConfig?.value));
  return money(Math.max(0, original - canceledStoreImpact(sale)));
};
export const getSaleNetForProfit = sale => sale?.saleType === 'direct' ? getDirectNet(sale) : money(sale?.totalPrice);
export const getSaleCost = sale => money(sale?.totalCost);
export const getSaleProfit = sale => money(getSaleNetForProfit(sale) - getSaleCost(sale));
export const getSaleMargin = sale => {
  const net = getSaleNetForProfit(sale);
  return net > 0 ? (getSaleProfit(sale) / net) * 100 : 0;
};
const getSaleUnits = sale => (sale?.items || []).reduce((total, item) => total + quantity(item.quantity), 0);
const getItemCost = item => item?.cost !== undefined && item?.cost !== null ? money(item.cost) : money(num(item?.unitCost) * quantity(item?.quantity));
const getItemRevenue = item => money(item?.price !== undefined ? item.price : num(item?.unitPrice) * quantity(item?.quantity));
const getStoreCardFee = sale => sale?.saleType === 'direct' && sale?.feeConfig?.type === 'sem_juros'
  ? money(sale.feeConfig.storeAbsorbedFeeValue ?? sale.feeConfig.value)
  : 0;
const getCustomerCardFee = sale => sale?.saleType === 'direct' && sale?.feeConfig?.type === 'com_juros'
  ? money(sale.feeConfig.customerPassedFeeValue ?? sale.feeConfig.value)
  : 0;
const getCarnetInterest = sale => {
  if (!isTermSale(sale)) return 0;
  if (sale?.interestConfig?.value !== undefined) return money(sale.interestConfig.value);
  if (sale?.carnetInterestValue !== undefined) return money(sale.carnetInterestValue);
  if (sale?.productsTotal !== undefined) return money(Math.max(0, num(sale.totalPrice) - num(sale.productsTotal)));
  return 0;
};
const getHistoryAmount = item => !item || item.type === 'abatement' ? 0 : money(num(item.amount) + (item.type === 'full_surplus' ? num(item.surplus) : 0));
const getTermReceived = sale => {
  let total = num(sale?.entryAmount);
  (sale?.installments || []).forEach(inst => {
    const history = Array.isArray(inst.history) ? inst.history : [];
    if (history.length) history.forEach(item => { total += getHistoryAmount(item); });
    else if (inst.paid && inst.paidAt) total += num(inst.originalAmount || inst.amount);
  });
  const refunds = sum(sale?.cancellations || [], event => event?.customerRefundAmount ?? event?.refundAmount ?? 0);
  return money(Math.max(0, total - refunds));
};
const getTermOpen = sale => money((sale?.installments || []).filter(inst => !inst.paid).reduce((total, inst) => total + num(inst.amount), 0));
const getTermOverdue = sale => {
  const today = getBrazilDateString();
  return money((sale?.installments || []).filter(inst => !inst.paid && cleanDate(inst.dueDate) < today).reduce((total, inst) => total + num(inst.amount), 0));
};

const daysBetween = (from, to) => {
  if (!from || !to) return 0;
  const parse = value => {
    const [y, m, d] = cleanDate(value).split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  };
  return Math.max(0, Math.floor((parse(to) - parse(from)) / 86400000));
};

const getPurchaseEvents = movement => {
  const events = Array.isArray(movement?.financialCancellations) ? movement.financialCancellations : [];
  if (events.length) return events;
  if (!movement?.financialCanceled) return [];
  const deferred = movement.paymentMethod === 'credit' || movement.paymentMethod === 'term';
  return [{
    id: 'legacy', quantity: quantity(movement.quantity), amount: money(quantity(movement.quantity) * num(movement.unitCost)),
    date: cleanDate(movement.financialCanceledAt), reason: movement.financialCancelReason || 'Compra cancelada',
    hadCashOut: deferred ? !!movement.financialPaid : true, createdAt: movement.financialCanceledAtDateTime || ''
  }];
};

const flattenPurchases = products => {
  const rows = [];
  (products || []).forEach(product => (product.movements || []).forEach(movement => {
    if (movement.type !== 'compra') return;
    const qty = quantity(movement.quantity);
    const unitCost = money(movement.unitCost);
    const originalAmount = money(qty * unitCost);
    const events = getPurchaseEvents(movement);
    const returnedQty = Math.min(qty, events.reduce((total, event) => total + quantity(event.quantity), 0));
    const returnedAmount = money(events.reduce((total, event) => total + num(event.amount || quantity(event.quantity) * unitCost), 0));
    rows.push({ product, movement, qty, unitCost, originalAmount, events, returnedQty, returnedAmount, netQty: Math.max(0, qty - returnedQty), netAmount: money(Math.max(0, originalAmount - returnedAmount)) });
  }));
  return rows;
};

const buildCashMovements = ({ sales, products, financialData }) => {
  const rows = [];
  (sales || []).forEach(sale => {
    const cancellations = Array.isArray(sale.cancellations) ? sale.cancellations : [];
    const keepOriginal = sale.status !== 'canceled' || cancellations.length > 0;
    if (keepOriginal) {
      if (sale.saleType === 'direct') {
        const savedNet = sale?.netReceived !== undefined && sale?.netReceived !== null && sale?.netReceived !== '' ? num(sale.netReceived) : Math.max(0, num(sale.totalPrice) - num(sale.feeConfig?.value));
        if (savedNet > 0) rows.push({ type: 'income', date: cleanDate(sale.saleDate), amount: money(savedNet), label: 'Venda no caixa' });
      } else if (isTermSale(sale)) {
        if (num(sale.entryAmount) > 0) rows.push({ type: 'income', date: cleanDate(sale.saleDate), amount: money(sale.entryAmount), label: 'Entrada de venda a prazo' });
        (sale.installments || []).forEach(inst => {
          const history = Array.isArray(inst.history) ? inst.history : [];
          if (history.length) history.forEach(item => {
            const amount = getHistoryAmount(item); const date = cleanDate(item.date || item.timestamp || inst.paidAt);
            if (amount > 0 && date) rows.push({ type: 'income', date, amount, label: 'Parcela recebida' });
          });
          else if (inst.paid && inst.paidAt) rows.push({ type: 'income', date: cleanDate(inst.paidAt), amount: money(inst.originalAmount || inst.amount), label: 'Parcela recebida' });
        });
      }
    }
    cancellations.forEach(event => {
      const amount = money(event.refundAmount);
      if (amount > 0 && event.date) rows.push({ type: 'expense', date: cleanDate(event.date), amount, label: 'Estorno de venda' });
    });
  });

  flattenPurchases(products).forEach(row => {
    const { movement, originalAmount, events, unitCost } = row;
    const deferred = movement.paymentMethod === 'credit' || movement.paymentMethod === 'term';
    const canceledBeforePayment = money(events.filter(event => event.hadCashOut === false).reduce((total, event) => total + num(event.amount || quantity(event.quantity) * unitCost), 0));
    const paidAmount = money(Math.max(0, originalAmount - canceledBeforePayment));
    const hadCashOut = deferred ? !!movement.financialPaid : true;
    const paymentDate = cleanDate(deferred ? movement.financialPaidAt : movement.date);
    if (hadCashOut && paymentDate && paidAmount > 0) rows.push({ type: 'expense', date: paymentDate, amount: paidAmount, label: 'Compra de mercadoria' });
    events.forEach(event => {
      const amount = money(event.amount || quantity(event.quantity) * unitCost);
      if (event.hadCashOut && amount > 0 && event.date) rows.push({ type: 'income', date: cleanDate(event.date), amount, label: 'Estorno de fornecedor' });
    });
  });

  const data = financialData || { entries: [], accounts: [] };
  (data.entries || []).forEach(item => {
    if (item?.date && num(item.value) > 0) rows.push({ type: item.type === 'expense' ? 'expense' : 'income', date: cleanDate(item.date), amount: money(item.value), label: item.description || 'Lançamento manual' });
  });
  (data.accounts || []).filter(item => item?.paid && item?.paidAt).forEach(item => rows.push({
    type: item.direction === 'receivable' ? 'income' : 'expense', date: cleanDate(item.paidAt), amount: money(item.value), label: item.description || (item.direction === 'receivable' ? 'Conta recebida' : 'Conta paga')
  }));
  return rows;
};

const metric = (label, value, type = 'currency', tone = '') => ({ label, value, type, tone, display: type === 'currency' ? formatCurrency(value) : type === 'percent' ? percent(value) : type === 'number' ? formatNumber(value) : String(value ?? '') });
const makeChart = (title, items) => ({ title, items: items.filter(item => num(item.value) >= 0).map(item => ({ ...item, value: num(item.value), display: item.display || formatCurrency(item.value) })) });
const reportBase = (id, title, subtitle, metrics, columns, rows, chart = null, notes = []) => ({ id, title, subtitle, metrics, columns, rows, chart, notes });

const buildResultReport = context => {
  const { sales, products, financialData, startDate, endDate } = context;
  const periodSales = (sales || []).filter(sale => !isCanceled(sale) && inPeriod(sale.saleDate, startDate, endDate));
  const gross = sum(periodSales, sale => sale.totalPrice);
  const net = sum(periodSales, getSaleNetForProfit);
  const cost = sum(periodSales, getSaleCost);
  const storeFees = sum(periodSales, getStoreCardFee);
  const customerFees = sum(periodSales, getCustomerCardFee);
  const carnetInterest = sum(periodSales, getCarnetInterest);
  const discounts = sum(periodSales, sale => sale.totalDiscount);
  const grossProfit = money(net - cost);
  const margin = net > 0 ? grossProfit / net * 100 : 0;
  const cashRows = buildCashMovements({ sales, products, financialData }).filter(item => inPeriod(item.date, startDate, endDate));
  const cashIn = sum(cashRows.filter(item => item.type === 'income'), item => item.amount);
  const cashOut = sum(cashRows.filter(item => item.type === 'expense'), item => item.amount);
  const cashBalance = money(cashIn - cashOut);
  const manualIn = sum((financialData?.entries || []).filter(item => item.type !== 'expense' && inPeriod(item.date, startDate, endDate)), item => item.value);
  const manualOut = sum((financialData?.entries || []).filter(item => item.type === 'expense' && inPeriod(item.date, startDate, endDate)), item => item.value);
  const metrics = [
    metric('Faturamento bruto', gross), metric('Receita líquida das vendas', net), metric('Custo das mercadorias vendidas', cost),
    metric('Lucro bruto', grossProfit, 'currency', grossProfit >= 0 ? 'positive' : 'negative'), metric('Margem bruta', margin, 'percent'), metric('Descontos concedidos', discounts),
    metric('Taxas de cartão assumidas pela loja', storeFees), metric('Taxas de cartão pagas pelos clientes', customerFees), metric('Juros do crediário', carnetInterest),
    metric('Entradas de caixa', cashIn, 'currency', 'positive'), metric('Saídas de caixa', cashOut, 'currency', 'negative'), metric('Saldo do fluxo de caixa', cashBalance, 'currency', cashBalance >= 0 ? 'positive' : 'negative')
  ];
  const rows = [
    ['Vendas registradas', formatNumber(periodSales.length), formatCurrency(gross)],
    ['Outras entradas manuais', '—', formatCurrency(manualIn)],
    ['Outras saídas manuais', '—', formatCurrency(manualOut)],
    ['Taxas assumidas pela loja', '—', formatCurrency(storeFees)],
    ['Descontos concedidos', '—', formatCurrency(discounts)]
  ];
  return reportBase('result', 'Resultado financeiro', 'Visão operacional e financeira do período selecionado.', metrics, ['Componente', 'Quantidade', 'Valor'], rows,
    makeChart('Comparativo do período', [
      { label: 'Entradas', value: cashIn }, { label: 'Saídas', value: cashOut }, { label: 'Lucro bruto', value: Math.max(0, grossProfit) }
    ]),
    ['Lucro bruto considera receita líquida das vendas menos o custo das mercadorias vendidas.', 'Saldo do fluxo de caixa considera recebimentos e pagamentos efetivamente ocorridos no período; por isso não deve ser confundido com lucro.']
  );
};

const buildSalesReport = context => {
  const { sales, startDate, endDate, paymentFilter } = context;
  const allPeriodSales = (sales || []).filter(sale => inPeriod(sale.saleDate, startDate, endDate));
  const matchesPayment = sale => paymentFilter === 'all' || salePaymentKey(sale) === paymentFilter;
  const periodSales = allPeriodSales.filter(sale => !isCanceled(sale) && matchesPayment(sale));
  const canceled = allPeriodSales.filter(sale => isCanceled(sale) && matchesPayment(sale));
  const gross = sum(periodSales, sale => sale.totalPrice);
  const net = sum(periodSales, getSaleNetForProfit);
  const profit = sum(periodSales, getSaleProfit);
  const ticket = periodSales.length ? money(gross / periodSales.length) : 0;
  const units = periodSales.reduce((total, sale) => total + getSaleUnits(sale), 0);
  const discounts = sum(periodSales, sale => sale.totalDiscount);
  const margin = net > 0 ? profit / net * 100 : 0;
  const byDay = new Map();
  periodSales.forEach(sale => { const date = cleanDate(sale.saleDate); byDay.set(date, money((byDay.get(date) || 0) + num(sale.totalPrice))); });
  const chartItems = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14).map(([date, value]) => ({ label: formatDate(date).slice(0, 5), value }));
  const rows = [...periodSales].sort((a, b) => String(b.saleDateTime || b.saleDate).localeCompare(String(a.saleDateTime || a.saleDate))).map(sale => [
    formatMoment(sale), sale.customerName || 'Venda avulsa', paymentLabel(salePaymentKey(sale)), formatCurrency(sale.totalPrice), formatCurrency(getSaleProfit(sale)), percent(getSaleMargin(sale))
  ]);
  const filterName = PAYMENT_FILTERS.find(([key]) => key === paymentFilter)?.[1] || 'Todas';
  return reportBase('sales', 'Vendas', `Desempenho das vendas · Forma de pagamento: ${filterName}.`, [
    metric('Quantidade de vendas', periodSales.length, 'number'), metric('Faturamento', gross), metric('Ticket médio', ticket),
    metric('Lucro estimado', profit, 'currency', profit >= 0 ? 'positive' : 'negative'), metric('Margem', margin, 'percent'), metric('Unidades vendidas', units, 'number'),
    metric('Descontos', discounts), metric('Vendas canceladas', canceled.length, 'number')
  ], ['Data / hora', 'Cliente', 'Pagamento', 'Venda', 'Lucro', 'Margem'], rows, makeChart('Faturamento por dia', chartItems));
};

const buildSaleProfitReport = context => {
  const { sales, startDate, endDate } = context;
  const periodSales = (sales || []).filter(sale => !isCanceled(sale) && inPeriod(sale.saleDate, startDate, endDate));
  const totalNet = sum(periodSales, getSaleNetForProfit);
  const totalCost = sum(periodSales, getSaleCost);
  const totalFees = sum(periodSales, getStoreCardFee);
  const totalProfit = money(totalNet - totalCost);
  const margin = totalNet > 0 ? totalProfit / totalNet * 100 : 0;
  const ranked = [...periodSales].sort((a, b) => getSaleProfit(b) - getSaleProfit(a));
  const rows = ranked.map(sale => [
    formatMoment(sale), sale.customerName || 'Venda avulsa', paymentLabel(salePaymentKey(sale)), formatCurrency(sale.totalPrice), formatCurrency(getSaleNetForProfit(sale)), formatCurrency(getSaleCost(sale)), formatCurrency(getStoreCardFee(sale)), formatCurrency(getSaleProfit(sale)), percent(getSaleMargin(sale))
  ]);
  return reportBase('sale-profit', 'Lucro por venda', 'Quanto cada venda efetivamente contribuiu para o resultado.', [
    metric('Receita líquida', totalNet), metric('Custo vendido', totalCost), metric('Taxas assumidas', totalFees), metric('Lucro total', totalProfit, 'currency', totalProfit >= 0 ? 'positive' : 'negative'), metric('Margem média', margin, 'percent')
  ], ['Data', 'Cliente', 'Pagamento', 'Cobrado', 'Líquido', 'Custo', 'Taxa loja', 'Lucro', 'Margem'], rows,
    makeChart('Maiores lucros por venda', ranked.slice(0, 7).map(sale => ({ label: sale.customerName || 'Venda avulsa', value: Math.max(0, getSaleProfit(sale)) }))));
};

const buildProductsReport = context => {
  const { sales, startDate, endDate } = context;
  const periodSales = (sales || []).filter(sale => !isCanceled(sale) && inPeriod(sale.saleDate, startDate, endDate));
  const map = new Map();
  periodSales.forEach(sale => {
    const items = sale.items || [];
    const itemBaseTotal = items.reduce((total, item) => total + getItemRevenue(item), 0) || 1;
    const saleNet = getSaleNetForProfit(sale);
    items.forEach(item => {
      const key = item.productId || item.productName || item.name || 'sem-id';
      const row = map.get(key) || { id: key, name: item.productName || item.name || 'Produto', qty: 0, revenue: 0, cost: 0, profit: 0 };
      const base = getItemRevenue(item);
      const allocatedNet = money(saleNet * (base / itemBaseTotal));
      const cost = getItemCost(item);
      row.qty += quantity(item.quantity); row.revenue += allocatedNet; row.cost += cost; row.profit += allocatedNet - cost;
      map.set(key, row);
    });
  });
  const products = [...map.values()].map(row => ({ ...row, revenue: money(row.revenue), cost: money(row.cost), profit: money(row.profit), margin: row.revenue > 0 ? row.profit / row.revenue * 100 : 0 })).sort((a, b) => b.profit - a.profit);
  const totalRevenue = sum(products, row => row.revenue); const totalProfit = sum(products, row => row.profit); const totalCost = sum(products, row => row.cost); const totalQty = products.reduce((total, row) => total + row.qty, 0);
  return reportBase('products', 'Produtos', 'Ranking dos produtos vendidos no período.', [
    metric('Produtos diferentes vendidos', products.length, 'number'), metric('Unidades vendidas', totalQty, 'number'), metric('Receita líquida alocada', totalRevenue), metric('Custo vendido', totalCost), metric('Lucro', totalProfit, 'currency', totalProfit >= 0 ? 'positive' : 'negative')
  ], ['Produto', 'Qtd.', 'Receita', 'Custo', 'Lucro', 'Margem'], products.map(row => [row.name, formatNumber(row.qty), formatCurrency(row.revenue), formatCurrency(row.cost), formatCurrency(row.profit), percent(row.margin)]),
    makeChart('Produtos com maior lucro', products.slice(0, 8).map(row => ({ label: row.name, value: Math.max(0, row.profit) }))));
};

const buildStockReport = context => {
  const { sales, products, startDate, endDate } = context;
  const validSales = (sales || []).filter(sale => !isCanceled(sale) && inPeriod(sale.saleDate, startDate, endDate));
  const soldByProduct = new Map();
  validSales.forEach(sale => (sale.items || []).forEach(item => { const key = item.productId || item.productName || item.name; soldByProduct.set(key, (soldByProduct.get(key) || 0) + quantity(item.quantity)); }));
  const purchaseByProduct = new Map();
  flattenPurchases(products).filter(row => inPeriod(row.movement.date, startDate, endDate)).forEach(row => purchaseByProduct.set(row.product.id, (purchaseByProduct.get(row.product.id) || 0) + row.netQty));
  const rowsData = (products || []).map(product => {
    const qty = quantity(product.quantity); const cost = num(product.costPrice); const salePrice = num(product.salePrice); const sold = soldByProduct.get(product.id) || soldByProduct.get(product.name) || 0; const purchased = purchaseByProduct.get(product.id) || 0;
    return { product, qty, cost, salePrice, sold, purchased, stockCost: money(qty * cost), stockSale: money(qty * salePrice), potentialProfit: money(qty * Math.max(0, salePrice - cost)) };
  }).sort((a, b) => b.stockCost - a.stockCost);
  const stockCost = sum(rowsData, row => row.stockCost); const stockSale = sum(rowsData, row => row.stockSale); const potentialProfit = sum(rowsData, row => row.potentialProfit); const totalUnits = rowsData.reduce((total, row) => total + row.qty, 0); const zeroStock = rowsData.filter(row => row.qty <= 0).length; const noSales = rowsData.filter(row => row.sold <= 0 && row.qty > 0).length;
  return reportBase('stock', 'Estoque', 'Posição atual do estoque combinada com o giro no período selecionado.', [
    metric('Unidades em estoque agora', totalUnits, 'number'), metric('Custo atual do estoque', stockCost), metric('Valor potencial de venda', stockSale), metric('Lucro potencial', potentialProfit), metric('Produtos sem estoque', zeroStock, 'number'), metric('Produtos sem venda no período', noSales, 'number')
  ], ['Produto', 'Estoque', 'Vendidas', 'Compradas', 'Custo estoque', 'Venda potencial'], rowsData.map(row => [row.product.name || 'Produto', formatNumber(row.qty), formatNumber(row.sold), formatNumber(row.purchased), formatCurrency(row.stockCost), formatCurrency(row.stockSale)]),
    makeChart('Maior capital imobilizado em estoque', rowsData.slice(0, 8).map(row => ({ label: row.product.name || 'Produto', value: row.stockCost }))),
    ['A posição física e o valor do estoque são atuais; o período selecionado afeta os indicadores de venda e compra usados para medir o giro.']
  );
};

const buildPurchasesReport = context => {
  const { products, startDate, endDate } = context;
  const purchases = flattenPurchases(products).filter(row => inPeriod(row.movement.date, startDate, endDate));
  const total = sum(purchases, row => row.originalAmount); const returned = sum(purchases, row => row.returnedAmount); const net = money(total - returned); const units = purchases.reduce((acc, row) => acc + row.qty, 0); const returnedUnits = purchases.reduce((acc, row) => acc + row.returnedQty, 0);
  const byPayment = new Map();
  purchases.forEach(row => { const key = row.movement.paymentMethod || 'unknown'; byPayment.set(key, money((byPayment.get(key) || 0) + row.originalAmount)); });
  const rows = [...purchases].sort((a, b) => String(b.movement.date).localeCompare(String(a.movement.date))).map(row => {
    const method = row.movement.paymentMethod || 'unknown'; const deferred = method === 'credit' || method === 'term'; const status = row.netQty <= 0 ? 'Devolvida' : deferred ? (row.movement.financialPaid ? 'Paga' : 'A pagar') : 'Paga';
    return [formatDate(cleanDate(row.movement.date)), row.product.name || 'Produto', formatNumber(row.qty), formatCurrency(row.unitCost), formatCurrency(row.originalAmount), paymentLabel(method), row.movement.paymentDueDate ? formatDate(cleanDate(row.movement.paymentDueDate)) : '—', status, row.returnedAmount > 0 ? formatCurrency(row.returnedAmount) : '—'];
  });
  return reportBase('purchases', 'Compras de mercadorias', 'Compras registradas no estoque durante o período.', [
    metric('Compras realizadas', purchases.length, 'number'), metric('Unidades compradas', units, 'number'), metric('Valor bruto comprado', total), metric('Devoluções', returned, 'currency', returned > 0 ? 'positive' : ''), metric('Valor líquido das compras', net), metric('Unidades devolvidas', returnedUnits, 'number')
  ], ['Data', 'Produto', 'Qtd.', 'Custo unit.', 'Total', 'Pagamento', 'Vencimento', 'Situação', 'Devolvido'], rows,
    makeChart('Compras por forma de pagamento', [...byPayment.entries()].map(([key, value]) => ({ label: key === 'unknown' ? 'Não informado' : paymentLabel(key), value }))));
};

const buildCreditReport = context => {
  const { sales, startDate, endDate } = context;
  const today = getBrazilDateString();
  const contracts = (sales || []).filter(sale => isTermSale(sale) && !isCanceled(sale) && inPeriod(sale.saleDate, startDate, endDate));
  let sold = 0, received = 0, open = 0, overdue = 0; const buckets = { current: 0, d1_7: 0, d8_15: 0, d16_30: 0, d31_60: 0, d61: 0 };
  contracts.forEach(sale => {
    sold += num(sale.totalPrice); received += getTermReceived(sale); open += getTermOpen(sale); overdue += getTermOverdue(sale);
    (sale.installments || []).filter(inst => !inst.paid && num(inst.amount) > 0).forEach(inst => {
      const due = cleanDate(inst.dueDate); const amount = num(inst.amount);
      if (!due || due >= today) buckets.current += amount;
      else { const days = daysBetween(due, today); if (days <= 7) buckets.d1_7 += amount; else if (days <= 15) buckets.d8_15 += amount; else if (days <= 30) buckets.d16_30 += amount; else if (days <= 60) buckets.d31_60 += amount; else buckets.d61 += amount; }
    });
  });
  sold = money(sold); received = money(received); open = money(open); overdue = money(overdue); const defaultRate = open > 0 ? overdue / open * 100 : 0;
  const active = contracts.filter(sale => getTermOpen(sale) > 0).length;
  const rows = [...contracts].sort((a, b) => getTermOverdue(b) - getTermOverdue(a) || String(b.saleDate).localeCompare(String(a.saleDate))).map(sale => [
    formatDate(cleanDate(sale.saleDate)), sale.customerName || 'Cliente', formatCurrency(sale.totalPrice), formatCurrency(getTermReceived(sale)), formatCurrency(getTermOpen(sale)), formatCurrency(getTermOverdue(sale)), getTermOverdue(sale) > 0 ? 'Em atraso' : getTermOpen(sale) > 0 ? 'Em dia' : 'Quitado'
  ]);
  return reportBase('credit', 'Crediário', 'Saúde da carteira das vendas a prazo realizadas no período.', [
    metric('Total vendido a prazo', sold), metric('Total recebido', received, 'currency', 'positive'), metric('Saldo a receber', open), metric('Valor vencido', overdue, 'currency', overdue > 0 ? 'negative' : ''), metric('Contratos ativos', active, 'number'), metric('Inadimplência da carteira', defaultRate, 'percent')
  ], ['Venda', 'Cliente', 'Contrato', 'Recebido', 'A receber', 'Vencido', 'Situação'], rows,
    makeChart('Carteira por faixa de atraso', [
      { label: 'Em dia / a vencer', value: buckets.current }, { label: '1–7 dias', value: buckets.d1_7 }, { label: '8–15 dias', value: buckets.d8_15 }, { label: '16–30 dias', value: buckets.d16_30 }, { label: '31–60 dias', value: buckets.d31_60 }, { label: '+60 dias', value: buckets.d61 }
    ]));
};

export const buildReport = context => {
  switch (context.reportId) {
    case 'result': return buildResultReport(context);
    case 'sales': return buildSalesReport(context);
    case 'sale-profit': return buildSaleProfitReport(context);
    case 'products': return buildProductsReport(context);
    case 'stock': return buildStockReport(context);
    case 'purchases': return buildPurchasesReport(context);
    case 'credit': return buildCreditReport(context);
    default: return reportBase('unknown', 'Relatório', 'Relatório não encontrado.', [], [], []);
  }
};

export const reportPeriodLabel = (startDate, endDate) => `${formatDate(startDate)} a ${formatDate(endDate)}`;
