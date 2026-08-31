import {
  cleanFinancialDate,
  getInstallmentFaceAmount,
  getPurchaseGroups,
  money,
  sumMoney,
  toCents
} from './financial-core-v70.js';

const paymentNames = {
  money: 'Dinheiro',
  pix: 'PIX',
  debit: 'Débito',
  credit: 'Crédito',
  term: 'A prazo',
  crediario: 'Crediário'
};

const paymentHistoryLabels = {
  partial: 'Pagamento parcial',
  full: 'Pagamento da parcela',
  full_surplus: 'Pagamento com distribuição de excedente',
  abatement: 'Valor distribuído de outra parcela'
};

const normalizedHistory = (entries = []) => entries
  .filter(entry => entry && toCents(entry.amount) > 0)
  .map(entry => ({
    date: cleanFinancialDate(entry.date || entry.timestamp || entry.createdAt),
    dateTime: entry.timestamp || entry.createdAt || '',
    amount: money(entry.amount),
    label: paymentHistoryLabels[entry.type] || 'Pagamento registrado',
    type: entry.type || 'payment'
  }))
  .sort((left, right) => String(left.dateTime || left.date)
    .localeCompare(String(right.dateTime || right.date)));

const daysBetween = (first, second) => {
  if (!first || !second) return null;
  const start = Date.parse(`${first}T00:00:00Z`);
  const end = Date.parse(`${second}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end)
    ? Math.round((end - start) / 86400000)
    : null;
};

const inferDirection = account => account?.direction
  || (account?.source === 'sale' ? 'receivable' : 'payable');

const buildSaleDetails = account => {
  const sale = account.sale || {};
  const installment = sale.installments?.[account.installmentIndex] || {};
  const originalAmount = getInstallmentFaceAmount(installment) || money(account.value);
  const remainingAmount = account.paid ? 0 : money(installment.amount ?? account.value);
  const paidAmount = money(Math.max(0, originalAmount - remainingAmount));
  let history = normalizedHistory(installment.history || []);

  if (history.length === 0 && account.paid && paidAmount > 0) {
    history = [{
      date: cleanFinancialDate(account.paidAt || installment.paidAt),
      dateTime: account.paidAtDateTime || installment.paidAtDateTime || '',
      amount: paidAmount,
      label: 'Pagamento da parcela',
      type: 'full'
    }];
  }

  return {
    sourceLabel: 'Venda a prazo',
    party: sale.customerName || account.party || 'Cliente não informado',
    partyLabel: 'Cliente',
    customerPhone: sale.customerPhone || '',
    originalAmount,
    paidAmount,
    remainingAmount,
    installmentNumber: installment.number || account.installmentIndex + 1,
    installmentsCount: sale.installmentsCount || sale.installments?.length || 1,
    originDate: cleanFinancialDate(sale.saleDate),
    originDateLabel: 'Data da venda',
    originTotal: money(sale.totalPrice),
    originTotalLabel: 'Valor total da venda',
    paymentMethod: 'Crediário',
    notes: sale.notes || '',
    products: (sale.items || []).map(item => {
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const unitValue = money(item.unitPrice ?? (quantity > 0 ? Number(item.price || 0) / quantity : 0));
      return {
        name: item.productName || item.name || 'Produto',
        quantity,
        unitValue,
        total: money(item.price ?? quantity * unitValue)
      };
    }),
    history
  };
};

const findPurchaseGroup = (account, products) => {
  if (account.purchaseGroup) return account.purchaseGroup;
  const key = account.batchId
    ? `batch:${account.batchId}`
    : `single:${account.productId}:${account.movementId}`;
  return getPurchaseGroups(products).find(group => group.key === key) || null;
};

const buildPurchaseDetails = (account, products) => {
  const group = findPurchaseGroup(account, products);
  const movement = group?.first?.movement || {};
  const installment = group?.plan?.[account.installmentIndex] || {};
  const originalAmount = money(installment.amount ?? account.value);
  const paidAmount = account.paid ? originalAmount : 0;
  const history = [];

  if (account.paid && paidAmount > 0) {
    history.push({
      date: cleanFinancialDate(account.paidAt || installment.paidAt),
      dateTime: account.paidAtDateTime || installment.paidAtDateTime || '',
      amount: paidAmount,
      label: 'Pagamento da parcela',
      type: 'full'
    });
  }

  (group?.items || []).forEach(item => (item.events || []).forEach(event => {
    if (toCents(event.amount) <= 0) return;
    history.push({
      date: cleanFinancialDate(event.date || event.createdAt),
      dateTime: event.createdAt || '',
      amount: money(event.amount),
      label: `Cancelamento · ${item.product.name || 'Produto'}`,
      type: 'cancellation'
    });
  }));

  return {
    sourceLabel: account.batchId ? 'Compra de mercadoria em lote' : 'Compra de mercadoria',
    party: movement.supplierName || movement.supplier || movement.vendor || 'Não informado',
    partyLabel: 'Fornecedor / favorecido',
    originalAmount,
    paidAmount,
    remainingAmount: account.paid || account.canceled ? 0 : originalAmount,
    installmentNumber: installment.number || account.installmentNumber || 1,
    installmentsCount: group?.plan?.length || account.installmentsCount || 1,
    originDate: group?.purchaseDate || cleanFinancialDate(movement.date),
    originDateLabel: 'Data da compra',
    originTotal: money(group?.adjustedLiability ?? originalAmount),
    originTotalLabel: 'Valor total da compra',
    purchaseOriginalTotal: money(group?.originalAmount ?? originalAmount),
    purchasePaidTotal: money(group?.paidAmount ?? paidAmount),
    purchaseOpenTotal: money(group?.openTotal ?? (account.paid ? 0 : originalAmount)),
    purchaseCanceledTotal: money(group?.accountReductionAmount),
    paymentMethod: paymentNames[group?.paymentMethod || movement.paymentMethod] || account.party || 'Não informado',
    notes: movement.notes || movement.note || movement.observation || '',
    products: (group?.items || []).map(item => ({
      name: item.product.name || 'Produto',
      quantity: item.originalQuantity,
      canceledQuantity: item.canceledQuantity,
      unitValue: money(item.unitCost),
      total: money(item.originalAmount)
    })),
    history: history.sort((left, right) => String(left.dateTime || left.date)
      .localeCompare(String(right.dateTime || right.date)))
  };
};

const buildManualDetails = (account, direction) => {
  const originalAmount = money(account.value);
  const installmentsCount = Math.max(1, parseInt(account.installmentsCount, 10) || 1);
  const installmentNumber = Math.min(installmentsCount, Math.max(1, parseInt(account.installmentNumber, 10) || 1));
  const isInstallment = !!account.installmentGroupId && installmentsCount > 1;
  return {
    sourceLabel: isInstallment ? 'Lançamento manual parcelado' : 'Lançamento manual',
    party: account.party || 'Não informado',
    partyLabel: direction === 'receivable' ? 'Cliente / origem' : 'Fornecedor / favorecido',
    originalAmount,
    paidAmount: account.paid ? originalAmount : 0,
    remainingAmount: account.paid ? 0 : originalAmount,
    installmentNumber: isInstallment ? installmentNumber : null,
    installmentsCount: isInstallment ? installmentsCount : null,
    originDate: cleanFinancialDate(account.createdAt),
    originDateLabel: 'Data do lançamento',
    originTotal: isInstallment ? money(account.installmentOriginalTotal) : originalAmount,
    originTotalLabel: isInstallment ? 'Valor total do parcelamento' : 'Valor do lançamento',
    paymentMethod: '',
    notes: account.notes || '',
    products: [],
    history: account.paid ? [{
      date: cleanFinancialDate(account.paidAt),
      dateTime: account.paidAtDateTime || '',
      amount: originalAmount,
      label: direction === 'receivable' ? 'Recebimento registrado' : 'Pagamento registrado',
      type: 'full'
    }] : []
  };
};

export const filterFinancialAccounts = (accounts = [], {
  scope = 'period',
  startDate = '',
  endDate = '',
  status = 'open',
  search = ''
} = {}) => {
  const normalizedSearch = String(search || '').trim().toLocaleLowerCase('pt-BR');

  return accounts
    .filter(account => scope === 'all'
      || (account.dueDate && account.dueDate >= startDate && account.dueDate <= endDate))
    .filter(account => status === 'all'
      || (status === 'paid'
        ? account.paid && !account.canceled
        : !account.paid && !account.canceled))
    .filter(account => !normalizedSearch
      || `${account.description || ''} ${account.party || ''}`.toLocaleLowerCase('pt-BR')
        .includes(normalizedSearch))
    .sort((left, right) => {
      if (!!left.canceled !== !!right.canceled) return left.canceled ? 1 : -1;
      if (!!left.paid !== !!right.paid) return left.paid ? 1 : -1;
      const dates = String(left.dueDate || '9999-12-31')
        .localeCompare(String(right.dueDate || '9999-12-31'));
      return dates || String(left.description || '').localeCompare(String(right.description || ''), 'pt-BR');
    });
};

export const summarizeFinancialAccounts = (accounts = []) => {
  const consideredAccounts = accounts.filter(account => !account.canceled);

  return {
    count: consideredAccounts.length,
    total: sumMoney(consideredAccounts, account => account.value)
  };
};

export const buildFinancialAccountDetails = (account, { products = [], today = '' } = {}) => {
  if (!account || typeof account !== 'object') return null;

  const direction = inferDirection(account);
  const details = account.source === 'sale'
    ? buildSaleDetails(account)
    : account.source === 'stock'
      ? buildPurchaseDetails(account, products)
      : buildManualDetails(account, direction);

  const dueDate = cleanFinancialDate(account.dueDate);
  const referenceDate = cleanFinancialDate(today);
  const difference = daysBetween(referenceDate, dueDate);

  return {
    id: account.id || '',
    direction,
    source: account.source || 'manual',
    title: direction === 'receivable' ? 'Detalhes da conta a receber' : 'Detalhes da conta a pagar',
    description: account.description || 'Conta sem descrição',
    category: account.category || '',
    dueDate,
    paid: !!account.paid,
    canceled: !!account.canceled,
    partial: !!account.partial,
    paidAt: cleanFinancialDate(account.paidAt),
    paidAtDateTime: account.paidAtDateTime || '',
    status: account.status || { label: account.paid ? 'Paga' : 'Em aberto', cls: account.paid ? 'is-paid' : 'is-open' },
    daysUntilDue: account.paid || account.canceled ? null : difference,
    ...details,
    historyTotal: sumMoney(details.history.filter(item => item.type !== 'cancellation'), item => item.amount)
  };
};
