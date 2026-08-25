import {
  cleanFinancialDate,
  getSalesAccrualSummary,
  money,
  projectSalesAsOf,
  toCents
} from './financial-core-v70.js';
import { buildRecurringCustomers } from './reports-engine-v73.js?v=82';

const DAY_MS = 86_400_000;
const DEFAULT_REPURCHASE_DAYS = 60;

const finiteNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const normalizeText = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const dateTimestamp = value => {
  const date = cleanFinancialDate(value);
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return Number.NaN;
  return Date.UTC(year, month - 1, day, 12);
};

export const addCommercialDays = (value, days) => {
  const timestamp = dateTimestamp(value);
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp + finiteNumber(days) * DAY_MS).toISOString().slice(0, 10);
};

export const commercialDaysBetween = (fromDate, toDate) => {
  const from = dateTimestamp(fromDate);
  const to = dateTimestamp(toDate);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / DAY_MS);
};

export const cleanWhatsappPhone = value => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits;
  return digits.length >= 10 ? digits : '';
};

export const buildWhatsappUrl = (phone, message) => {
  const target = cleanWhatsappPhone(phone);
  return target ? `https://wa.me/${target}?text=${encodeURIComponent(String(message || ''))}` : '';
};

const customerIdentity = sale => {
  if (sale?.customerId) return `id:${sale.customerId}`;
  const phone = cleanWhatsappPhone(sale?.customerPhone);
  if (phone) return `phone:${phone}`;
  const name = normalizeText(sale?.customerName);
  if (!name || ['venda avulsa', 'cliente', 'consumidor', 'nao informado'].includes(name)) return '';
  return `name:${name}`;
};

const customerDirectory = customers => new Map((Array.isArray(customers) ? customers : [])
  .map(customer => [`id:${customer.id}`, customer]));

const resolveCustomer = (sale, directory) => {
  const current = sale?.customerId ? directory.get(`id:${sale.customerId}`) : null;
  return {
    id: current?.id || sale?.customerId || '',
    name: current?.name || sale?.customerName || 'Cliente',
    phone: current?.phone || sale?.customerPhone || ''
  };
};

const urgency = daysUntil => daysUntil < 0 ? 'overdue' : daysUntil === 0 ? 'today' : 'upcoming';
const urgencyLabel = status => status === 'overdue' ? 'Em atraso' : status === 'today' ? 'Hoje' : 'Próximos dias';

export const buildCollectionQueue = ({
  sales = [], customers = [], today, horizonDays = 7
} = {}) => {
  const referenceDate = cleanFinancialDate(today);
  if (!referenceDate) return [];
  const horizonDate = addCommercialDays(referenceDate, Math.max(0, parseInt(horizonDays, 10) || 0));
  const directory = customerDirectory(customers);
  const visibleSales = projectSalesAsOf(sales, referenceDate);
  const rows = [];

  visibleSales.forEach(sale => {
    if (sale?.status === 'canceled' || sale?.saleType === 'direct') return;
    const customer = resolveCustomer(sale, directory);
    const installments = Array.isArray(sale?.installments) ? sale.installments : [];
    installments.forEach((installment, installmentIndex) => {
      const dueDate = cleanFinancialDate(installment?.dueDate);
      const amount = money(installment?.amount);
      if (!dueDate || dueDate > horizonDate || installment?.paid || toCents(amount) <= 0) return;
      const daysUntil = commercialDaysBetween(referenceDate, dueDate);
      const status = urgency(daysUntil);
      rows.push({
        id: `${sale.id || 'sale'}:${installmentIndex}`,
        saleId: sale.id || '',
        contractId: sale.id ? `VP-${String(sale.id).slice(-5).toUpperCase()}` : 'Venda',
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone,
        whatsappPhone: cleanWhatsappPhone(customer.phone),
        noPhone: !cleanWhatsappPhone(customer.phone),
        installmentNumber: parseInt(installment?.number, 10) || installmentIndex + 1,
        installmentsCount: parseInt(sale?.installmentsCount, 10) || installments.length || 1,
        dueDate,
        amount,
        daysUntil,
        daysOverdue: Math.max(0, -daysUntil),
        status,
        statusLabel: urgencyLabel(status),
        sale,
        installment
      });
    });
  });

  return rows.sort((left, right) => left.daysUntil - right.daysUntil
    || String(left.customerName).localeCompare(String(right.customerName), 'pt-BR')
    || left.installmentNumber - right.installmentNumber);
};

export const getProductRepurchaseCycleDays = product => {
  const raw = product?.repurchaseCycleDays;
  if (raw === 0 || raw === '0') return 0;
  if (raw === undefined || raw === null || raw === '') return DEFAULT_REPURCHASE_DAYS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(730, Math.max(1, Math.floor(parsed)))
    : DEFAULT_REPURCHASE_DAYS;
};

const productKey = item => item?.productId
  ? `id:${item.productId}`
  : `name:${normalizeText(item?.productName || item?.name)}`;

export const buildRepurchaseSuggestions = ({
  sales = [], products = [], customers = [], today, horizonDays = 14
} = {}) => {
  const referenceDate = cleanFinancialDate(today);
  if (!referenceDate) return [];
  const horizonDate = addCommercialDays(referenceDate, Math.max(0, parseInt(horizonDays, 10) || 0));
  const directory = customerDirectory(customers);
  const productsById = new Map((Array.isArray(products) ? products : []).map(product => [String(product.id), product]));
  const productsByName = new Map((Array.isArray(products) ? products : [])
    .map(product => [normalizeText(product.name), product]));
  const latest = new Map();

  projectSalesAsOf(sales, referenceDate).forEach(sale => {
    const saleDate = cleanFinancialDate(sale?.saleDate);
    const identity = customerIdentity(sale);
    if (!saleDate || saleDate > referenceDate || sale?.status === 'canceled' || !identity) return;
    const customer = resolveCustomer(sale, directory);
    (Array.isArray(sale?.items) ? sale.items : []).forEach((item, itemIndex) => {
      const quantity = Math.max(0, parseInt(item?.quantity, 10) || 0);
      const key = productKey(item);
      if (!quantity || key === 'name:') return;
      const product = item?.productId
        ? productsById.get(String(item.productId))
        : productsByName.get(normalizeText(item?.productName || item?.name));
      const cycleDays = getProductRepurchaseCycleDays(product);
      if (cycleDays === 0) return;
      const groupKey = `${identity}|${key}`;
      const candidateOrder = `${saleDate}|${sale?.saleDateTime || ''}|${sale?.id || ''}|${itemIndex}`;
      const current = latest.get(groupKey);
      if (current && current.order >= candidateOrder) return;
      latest.set(groupKey, { sale, item, product, customer, identity, cycleDays, saleDate, order: candidateOrder, quantity });
    });
  });

  return [...latest.values()].map(entry => {
    const dueDate = addCommercialDays(entry.saleDate, entry.cycleDays);
    const daysUntil = commercialDaysBetween(referenceDate, dueDate);
    const status = urgency(daysUntil);
    const phone = entry.customer.phone;
    return {
      id: `${entry.identity}|${productKey(entry.item)}`,
      customerId: entry.customer.id,
      customerName: entry.customer.name,
      phone,
      whatsappPhone: cleanWhatsappPhone(phone),
      noPhone: !cleanWhatsappPhone(phone),
      productId: entry.product?.id || entry.item?.productId || '',
      productName: entry.product?.name || entry.item?.productName || entry.item?.name || 'Produto',
      lastPurchaseDate: entry.saleDate,
      cycleDays: entry.cycleDays,
      dueDate,
      daysUntil,
      daysOverdue: Math.max(0, -daysUntil),
      status,
      statusLabel: urgencyLabel(status),
      quantity: entry.quantity,
      lastPurchaseValue: money(entry.item?.price ?? finiteNumber(entry.item?.unitPrice) * entry.quantity),
      sale: entry.sale,
      item: entry.item
    };
  }).filter(entry => entry.dueDate && entry.dueDate <= horizonDate)
    .sort((left, right) => left.daysUntil - right.daysUntil
      || String(left.customerName).localeCompare(String(right.customerName), 'pt-BR')
      || String(left.productName).localeCompare(String(right.productName), 'pt-BR'));
};

const sanitizeGoal = value => Math.max(0, finiteNumber(value));

export const normalizeCommercialGoals = value => {
  const raw = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(Object.entries(raw).filter(([month]) => /^\d{4}-\d{2}$/.test(month)).map(([month, goal]) => [month, {
    revenue: money(sanitizeGoal(goal?.revenue)),
    salesCount: Math.floor(sanitizeGoal(goal?.salesCount)),
    recurringCustomers: Math.floor(sanitizeGoal(goal?.recurringCustomers))
  }]));
};

export const commercialMonthBounds = month => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) return null;
  const startDate = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(year, monthNumber, 0, 12)).toISOString().slice(0, 10);
  return { startDate, endDate };
};

const goalMetric = (id, label, unit, actual, target) => {
  const safeTarget = sanitizeGoal(target);
  const safeActual = unit === 'currency' ? money(actual) : Math.max(0, Math.floor(finiteNumber(actual)));
  const percent = safeTarget > 0 ? safeActual / safeTarget * 100 : 0;
  return {
    id, label, unit, actual: safeActual, target: safeTarget,
    remaining: unit === 'currency' ? money(Math.max(0, safeTarget - safeActual)) : Math.max(0, Math.ceil(safeTarget - safeActual)),
    percent,
    progress: Math.min(100, Math.max(0, percent)),
    reached: safeTarget > 0 && safeActual >= safeTarget
  };
};

export const calculateMonthlyGoals = ({
  sales = [], customers = [], goals = {}, month, today
} = {}) => {
  const bounds = commercialMonthBounds(month);
  const referenceDate = cleanFinancialDate(today);
  const selectedGoal = normalizeCommercialGoals(goals)[month] || { revenue: 0, salesCount: 0, recurringCustomers: 0 };
  if (!bounds || !referenceDate || bounds.startDate > referenceDate) {
    const metrics = [
      goalMetric('revenue', 'Faturamento líquido', 'currency', 0, selectedGoal.revenue),
      goalMetric('salesCount', 'Vendas válidas', 'number', 0, selectedGoal.salesCount),
      goalMetric('recurringCustomers', 'Clientes que voltaram', 'number', 0, selectedGoal.recurringCustomers)
    ];
    return { month, startDate: bounds?.startDate || '', endDate: bounds?.endDate || '', effectiveEndDate: '', metrics };
  }

  const effectiveEndDate = bounds.endDate < referenceDate ? bounds.endDate : referenceDate;
  const accrual = getSalesAccrualSummary(sales, bounds.startDate, effectiveEndDate);
  const validSales = projectSalesAsOf(sales, effectiveEndDate).filter(sale => {
    const saleDate = cleanFinancialDate(sale?.saleDate);
    return saleDate >= bounds.startDate && saleDate <= effectiveEndDate && sale?.status !== 'canceled';
  });
  const recurring = buildRecurringCustomers({
    sales, customers, startDate: bounds.startDate, endDate: effectiveEndDate
  }).filter(customer => customer.returningInPeriod).length;
  const metrics = [
    goalMetric('revenue', 'Faturamento líquido', 'currency', accrual.net, selectedGoal.revenue),
    goalMetric('salesCount', 'Vendas válidas', 'number', validSales.length, selectedGoal.salesCount),
    goalMetric('recurringCustomers', 'Clientes que voltaram', 'number', recurring, selectedGoal.recurringCustomers)
  ];
  return { month, ...bounds, effectiveEndDate, accrual, validSales, recurringCustomers: recurring, metrics };
};

const firstName = value => String(value || 'Cliente').trim().split(/\s+/)[0] || 'Cliente';
const currency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finiteNumber(value));
const dateLabel = value => {
  const [year, month, day] = cleanFinancialDate(value).split('-');
  return year && month && day ? `${day}/${month}/${year}` : String(value || '');
};

export const buildCollectionMessage = ({ entry, storeName, pixKey } = {}) => {
  if (!entry) return '';
  const name = firstName(entry.customerName);
  const due = dateLabel(entry.dueDate);
  let timing = `vence em ${due}`;
  if (entry.status === 'today') timing = `vence hoje (${due})`;
  if (entry.status === 'overdue') timing = `venceu em ${due}`;
  const lines = [
    `Olá, ${name}! Tudo bem?`,
    '',
    `Passando para lembrar que a parcela ${entry.installmentNumber}/${entry.installmentsCount}, no valor de ${currency(entry.amount)}, ${timing}.`,
    entry.status === 'overdue'
      ? 'Quando puder, me informe a previsão de pagamento para eu manter seu cadastro atualizado.'
      : 'Se precisar de alguma informação para o pagamento, estou à disposição.'
  ];
  if (pixKey) lines.push('', `Chave PIX: ${pixKey}`);
  lines.push('', 'Se o pagamento já foi realizado, por favor desconsidere esta mensagem.', '', storeName || 'Registro de Vendas');
  return lines.join('\n');
};

export const buildRepurchaseMessage = ({ entry, storeName } = {}) => {
  if (!entry) return '';
  return [
    `Olá, ${firstName(entry.customerName)}! Tudo bem?`,
    '',
    `Vi que já faz um tempo desde a sua compra de ${entry.productName}. Como está o produto?`,
    'Se estiver perto de acabar, posso ajudar com a reposição e verificar as opções disponíveis para você.',
    '',
    'Sem compromisso — fico à disposição!',
    storeName || 'Registro de Vendas'
  ].join('\n');
};
