import {
  cleanFinancialDate,
  getDirectSaleNet,
  inFinancialPeriod,
  isTermSale,
  sumMoney,
  toCents
} from './financial-core-v70.js?v=91';

export const SALES_VIEW_DEFAULTS = Object.freeze({
  query: '',
  type: 'all',
  status: 'all',
  period: 'current',
  sort: 'priority'
});

const normalizeText = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const paymentLabels = {
  money: 'Dinheiro',
  pix: 'PIX',
  debit: 'Débito',
  credit: 'Crédito'
};

export const getOperationalSaleType = sale => isTermSale(sale) ? 'term' : 'direct';

export const getOperationalSaleStatus = sale => {
  if (sale?.status === 'canceled') return 'canceled';
  if (getOperationalSaleType(sale) === 'direct') return 'completed';
  const installments = Array.isArray(sale?.installments) ? sale.installments : [];
  if (sale?.status === 'completed' || (installments.length > 0 && installments.every(item => item?.paid || toCents(item?.amount) <= 0))) {
    return 'completed';
  }
  return 'open';
};

export const getSalePendingAmount = sale => {
  if (getOperationalSaleType(sale) !== 'term' || getOperationalSaleStatus(sale) !== 'open') return 0;
  return sumMoney(
    (Array.isArray(sale?.installments) ? sale.installments : []).filter(item => !item?.paid && toCents(item?.amount) > 0),
    item => item.amount
  );
};

export const getSalePaymentLabel = sale => {
  if (getOperationalSaleType(sale) === 'term') {
    const count = Number(sale?.installmentsCount) || sale?.installments?.length || 1;
    return `${count}x a prazo`;
  }
  if (sale?.paymentMethod === 'credit') return `Crédito ${Number(sale?.cardInstallments) || 1}x`;
  return paymentLabels[sale?.paymentMethod] || 'Pagamento não informado';
};

export const getNextOpenDueDate = sale => (Array.isArray(sale?.installments) ? sale.installments : [])
  .filter(item => !item?.paid && toCents(item?.amount) > 0 && cleanFinancialDate(item?.dueDate))
  .map(item => cleanFinancialDate(item.dueDate))
  .sort()[0] || '';

const getSaleMomentKey = sale => String(sale?.saleDateTime || cleanFinancialDate(sale?.saleDate) || '');

const saleSearchText = sale => normalizeText([
  sale?.customerName,
  sale?.customerPhone,
  sale?.id,
  sale?.contractId,
  sale?.saleChannel,
  getSalePaymentLabel(sale),
  ...(Array.isArray(sale?.items) ? sale.items.flatMap(item => [item?.productName, item?.productCode, item?.code]) : [])
].filter(Boolean).join(' '));

const matchesPeriod = (sale, filters) => {
  if (filters.period === 'all') return true;
  const saleDate = cleanFinancialDate(sale?.saleDate || sale?.saleDateTime);
  if (filters.period === 'custom') return inFinancialPeriod(saleDate, filters.startDate, filters.endDate);

  // Mantém cobranças antigas visíveis, sem fazer a busca ignorar os demais filtros.
  if (getOperationalSaleStatus(sale) === 'open') return !saleDate || !filters.currentEnd || saleDate <= filters.currentEnd;
  return inFinancialPeriod(saleDate, filters.currentStart, filters.currentEnd);
};

const comparePriority = (left, right) => {
  const leftStatus = getOperationalSaleStatus(left);
  const rightStatus = getOperationalSaleStatus(right);
  if (leftStatus === 'open' && rightStatus !== 'open') return -1;
  if (rightStatus === 'open' && leftStatus !== 'open') return 1;
  if (leftStatus === 'open' && rightStatus === 'open') {
    const leftDue = getNextOpenDueDate(left) || '9999-12-31';
    const rightDue = getNextOpenDueDate(right) || '9999-12-31';
    const dueComparison = leftDue.localeCompare(rightDue);
    if (dueComparison !== 0) return dueComparison;
  }
  return getSaleMomentKey(right).localeCompare(getSaleMomentKey(left));
};

const compareSales = sort => (left, right) => {
  if (sort === 'oldest') return getSaleMomentKey(left).localeCompare(getSaleMomentKey(right));
  if (sort === 'value') {
    const difference = toCents(right?.totalPrice) - toCents(left?.totalPrice);
    return difference || getSaleMomentKey(right).localeCompare(getSaleMomentKey(left));
  }
  if (sort === 'recent') return getSaleMomentKey(right).localeCompare(getSaleMomentKey(left));
  return comparePriority(left, right);
};

export const buildSalesView = ({ sales = [], ...rawFilters } = {}) => {
  const filters = { ...SALES_VIEW_DEFAULTS, ...rawFilters };
  const query = normalizeText(filters.query);

  return (Array.isArray(sales) ? sales : [])
    .filter(sale => filters.type === 'all' || getOperationalSaleType(sale) === filters.type)
    .filter(sale => filters.status === 'all' || getOperationalSaleStatus(sale) === filters.status)
    .filter(sale => matchesPeriod(sale, filters))
    .filter(sale => !query || saleSearchText(sale).includes(query))
    .sort(compareSales(filters.sort));
};

export const summarizeSalesView = (sales = []) => {
  const list = Array.isArray(sales) ? sales : [];
  const valid = list.filter(sale => getOperationalSaleStatus(sale) !== 'canceled');
  return {
    count: list.length,
    directCount: list.filter(sale => getOperationalSaleType(sale) === 'direct').length,
    termCount: list.filter(sale => getOperationalSaleType(sale) === 'term').length,
    openCount: list.filter(sale => getOperationalSaleStatus(sale) === 'open').length,
    completedCount: list.filter(sale => getOperationalSaleStatus(sale) === 'completed').length,
    canceledCount: list.filter(sale => getOperationalSaleStatus(sale) === 'canceled').length,
    pendingAmount: sumMoney(valid, getSalePendingAmount),
    cashNetAmount: sumMoney(
      valid.filter(sale => getOperationalSaleType(sale) === 'direct'),
      getDirectSaleNet
    )
  };
};
