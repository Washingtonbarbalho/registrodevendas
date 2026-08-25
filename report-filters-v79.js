import { isTermSale, projectSalesAsOf, toCents } from './financial-core-v70.js';

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const PRODUCT_REPORTS = new Set([
  'sales', 'sale-profit', 'products', 'stock', 'purchases', 'discounts',
  'sales-channels', 'stock-replenishment', 'stock-abc'
]);
const CUSTOMER_REPORTS = new Set([
  'sales', 'sale-profit', 'credit', 'customers', 'discounts', 'sales-channels', 'repeat-customers'
]);
const PAYMENT_REPORTS = new Set([
  'result', 'sales', 'sale-profit', 'card-fees', 'discounts', 'purchases', 'sales-channels', 'period-comparison'
]);
const STATUS_REPORTS = new Set([
  'sales', 'sale-profit', 'credit', 'customers', 'discounts', 'repeat-customers',
  'products', 'stock', 'stock-replenishment', 'stock-abc'
]);
const CHANNEL_REPORTS = new Set([
  'result', 'sales', 'sale-profit', 'discounts', 'sales-channels', 'period-comparison', 'repeat-customers'
]);
const FINANCIAL_CATEGORY_REPORTS = new Set(['result', 'net-result']);
const PRODUCT_STATUS_REPORTS = new Set(['products', 'stock', 'stock-replenishment', 'stock-abc']);

export const getReportFilterCapabilities = reportId => ({
  product: PRODUCT_REPORTS.has(reportId),
  customer: CUSTOMER_REPORTS.has(reportId),
  payment: PAYMENT_REPORTS.has(reportId),
  status: STATUS_REPORTS.has(reportId),
  category: PRODUCT_REPORTS.has(reportId) || FINANCIAL_CATEGORY_REPORTS.has(reportId),
  channel: CHANNEL_REPORTS.has(reportId),
  productStatus: PRODUCT_STATUS_REPORTS.has(reportId),
  financialCategory: FINANCIAL_CATEGORY_REPORTS.has(reportId)
});

export const getProductCategory = product => String(product?.category || product?.categoria || '').trim() || 'Sem categoria';

export const getReportCategories = ({ reportId, products = [], financialData = {} } = {}) => {
  const values = FINANCIAL_CATEGORY_REPORTS.has(reportId)
    ? [...(financialData.entries || []), ...(financialData.accounts || [])].map(item => String(item?.category || '').trim()).filter(Boolean)
    : products.map(getProductCategory);
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }));
};

const saleChannel = sale => {
  const value = normalize(sale?.saleChannel || sale?.salesChannel || sale?.channel || sale?.origin);
  if (!value) return 'unknown';
  if (value.includes('whats') || value === 'wpp') return 'whatsapp';
  if (value.includes('insta')) return 'instagram';
  if (value.includes('facebook') || value.includes('marketplace') || value === 'face') return 'facebook';
  if (['presencial', 'loja', 'balcao', 'fisico', 'physical', 'store'].includes(value)) return 'presencial';
  return 'outro';
};

const saleStatus = sale => {
  if (sale?.status === 'canceled') return 'canceled';
  if (isTermSale(sale) && (sale.installments || []).some(item => !item.paid && toCents(item.amount) > 0)) return 'open';
  return sale?.status === 'active' ? 'active' : 'completed';
};

const saleContainsProduct = (sale, products) => {
  const identifiers = new Set(products.map(product => String(product.id || '')));
  const names = new Set(products.map(product => normalize(product.name)));
  return (sale?.items || []).some(item => (
    identifiers.has(String(item?.productId || ''))
    || names.has(normalize(item?.productName || item?.name))
  ));
};

export const applyReportFilters = input => {
  const context = {
    productFilter: 'all', customerFilter: 'all', paymentFilter: 'all', statusFilter: 'all',
    categoryFilter: 'all', saleChannel: 'all', sales: [], products: [], customers: [], financialData: {},
    ...input
  };
  const supports = getReportFilterCapabilities(context.reportId);
  let products = context.products;
  let customers = context.customers;
  let sales = context.sales;
  let financialData = context.financialData;

  if (supports.product && context.productFilter !== 'all') {
    products = products.filter(product => String(product.id) === String(context.productFilter));
  }
  if (supports.category && !supports.financialCategory && context.categoryFilter !== 'all') {
    products = products.filter(product => getProductCategory(product) === context.categoryFilter);
  }
  if (supports.productStatus && context.statusFilter !== 'all') {
    products = products.filter(product => {
      const stock = Math.max(0, parseInt(product?.quantity, 10) || 0);
      const minimum = Math.max(0, parseInt(product?.minimumStock ?? 3, 10) || 0);
      if (context.statusFilter === 'out') return stock <= 0;
      if (context.statusFilter === 'low') return stock > 0 && stock <= minimum;
      if (context.statusFilter === 'available') return stock > minimum;
      return true;
    });
  }
  if (supports.customer && context.customerFilter !== 'all') {
    customers = customers.filter(customer => String(customer.id) === String(context.customerFilter));
    const customer = customers[0];
    sales = sales.filter(sale => String(sale.customerId || '') === String(context.customerFilter)
      || (!!customer && normalize(sale.customerName) === normalize(customer.name)));
  }
  if (supports.payment && context.paymentFilter !== 'all' && context.reportId !== 'purchases') {
    sales = sales.filter(sale => (isTermSale(sale) ? 'prazo' : sale.paymentMethod || 'money') === context.paymentFilter);
  }
  if (supports.status && !supports.productStatus && context.statusFilter !== 'all') {
    sales = sales.filter(sale => {
      const historicalSale = context.reportId === 'credit' && context.creditPositionMode === 'current'
        ? sale
        : projectSalesAsOf([sale], context.endDate)[0];
      const status = saleStatus(historicalSale);
      if (context.statusFilter === 'active') return status === 'active' || status === 'open';
      return status === context.statusFilter;
    });
  }
  if (supports.channel && context.saleChannel !== 'all') {
    sales = sales.filter(sale => saleChannel(sale) === context.saleChannel);
  }
  if (supports.product && (context.productFilter !== 'all' || context.categoryFilter !== 'all' || supports.productStatus && context.statusFilter !== 'all')) {
    sales = sales.filter(sale => saleContainsProduct(sale, products));
  }
  if (supports.financialCategory && context.categoryFilter !== 'all') {
    const hasCategory = item => String(item?.category || '').trim() === context.categoryFilter;
    financialData = {
      ...financialData,
      entries: (financialData.entries || []).filter(hasCategory),
      accounts: (financialData.accounts || []).filter(hasCategory)
    };
  }
  if (context.reportId === 'purchases' && context.paymentFilter !== 'all') {
    products = products.map(product => ({
      ...product,
      movements: (product.movements || []).filter(movement => (
        movement.type !== 'compra'
        || (movement.paymentMethod === 'term' ? 'prazo' : movement.paymentMethod) === context.paymentFilter
      ))
    }));
  }

  return { ...context, sales, products, customers, financialData, filterCapabilities: supports };
};
