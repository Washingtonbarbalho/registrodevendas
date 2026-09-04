const finiteNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export class FinancialCalculationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'FinancialCalculationError';
    this.code = code;
    this.details = details;
  }
}

export const toCents = value => {
  const amount = finiteNumber(value);
  const correction = Math.sign(amount || 1) * Number.EPSILON * Math.max(1, Math.abs(amount));
  return Math.round((amount + correction) * 100);
};

export const fromCents = cents => Math.round(finiteNumber(cents)) / 100;
export const money = value => fromCents(toCents(value));
export const sumMoney = (items = [], getter = value => value) => fromCents(
  (Array.isArray(items) ? items : []).reduce((total, item, index) => total + toCents(getter(item, index)), 0)
);

export const splitMoney = (total, count) => {
  const installments = Math.min(24, Math.max(1, parseInt(count, 10) || 1));
  const cents = Math.max(0, toCents(total));
  const base = Math.floor(cents / installments);
  const remainder = cents - base * installments;
  return Array.from({ length: installments }, (_, index) => fromCents(base + (index < remainder ? 1 : 0)));
};

export const allocateMoney = (total, weights = []) => {
  if (!Array.isArray(weights) || weights.length === 0) return [];
  const cents = toCents(total);
  const direction = cents < 0 ? -1 : 1;
  const absolute = Math.abs(cents);
  const normalized = weights.map(weight => Math.max(0, toCents(weight)));
  const totalWeight = normalized.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) return splitMoney(fromCents(absolute), normalized.length).map(value => money(value * direction));

  const allocations = normalized.map((weight, index) => {
    const exact = absolute * weight / totalWeight;
    return { index, cents: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let remaining = absolute - allocations.reduce((sum, allocation) => sum + allocation.cents, 0);
  const ranked = [...allocations].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let index = 0; remaining > 0; index += 1, remaining -= 1) ranked[index % ranked.length].cents += 1;
  return allocations.map(allocation => fromCents(allocation.cents * direction));
};

export const cleanFinancialDate = value => {
  if (!value) return '';
  if (typeof value?.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString().slice(0, 10);
  return String(value).split('T')[0];
};

export const inFinancialPeriod = (value, startDate, endDate) => {
  const date = cleanFinancialDate(value);
  return !!date && (!startDate || date >= startDate) && (!endDate || date <= endDate);
};

export const isTermSale = sale => sale?.saleType === 'prazo' || !sale?.saleType;

export const getDirectSaleNet = sale => {
  const value = sale?.netReceived;
  if (value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))) return money(value);
  return money(Math.max(0, finiteNumber(sale?.totalPrice) - finiteNumber(sale?.feeConfig?.value)));
};

export const getHistoryCashAmount = history => {
  if (!history || history.type === 'abatement') return 0;
  return fromCents(toCents(history.amount) + (history.type === 'full_surplus' ? toCents(history.surplus) : 0));
};

export const getInstallmentFaceAmount = installment => {
  if (finiteNumber(installment?.originalAmount) > 0) return money(installment.originalAmount);
  const remaining = Math.max(0, toCents(installment?.amount));
  const history = Array.isArray(installment?.history) ? installment.history : [];
  const applied = history.reduce((total, item) => total + Math.max(0, toCents(item?.amount)), 0);
  return fromCents(remaining + applied);
};

export const normalizePurchaseInstallments = (movement, totalFallback = 0) => {
  const current = Array.isArray(movement?.financialInstallments) ? movement.financialInstallments : [];
  if (current.length > 0) {
    return current.map((item, index) => ({
      number: parseInt(item?.number, 10) || index + 1,
      dueDate: cleanFinancialDate(item?.dueDate || movement?.paymentDueDate),
      amount: money(item?.amount),
      paid: !!item?.paid,
      paidAt: item?.paidAt ? cleanFinancialDate(item.paidAt) : null,
      paidAtDateTime: item?.paidAtDateTime || ''
    }));
  }
  return [{
    number: 1,
    dueDate: cleanFinancialDate(movement?.paymentDueDate),
    amount: money(totalFallback),
    paid: !!movement?.financialPaid,
    paidAt: movement?.financialPaidAt ? cleanFinancialDate(movement.financialPaidAt) : null,
    paidAtDateTime: movement?.financialPaidAtDateTime || ''
  }];
};

const quantity = value => Math.max(0, parseInt(value, 10) || 0);

export const getPurchaseCancellationEvents = movement => {
  const current = Array.isArray(movement?.financialCancellations) ? movement.financialCancellations : [];
  const unitCost = finiteNumber(movement?.unitCost);
  const events = current.length > 0 ? current : movement?.financialCanceled ? [{
    id: 'legacy-full',
    quantity: quantity(movement.quantity),
    amount: money(quantity(movement.quantity) * unitCost),
    date: cleanFinancialDate(movement.financialCanceledAt),
    createdAt: movement.financialCanceledAtDateTime || '',
    reason: movement.financialCancelReason || 'Compra cancelada',
    hadCashOut: movement.paymentMethod === 'credit' || movement.paymentMethod === 'term' ? !!movement.financialPaid : true
  }] : [];

  return events.map((event, index) => {
    const amount = money(event?.amount ?? quantity(event?.quantity) * unitCost);
    const accountReductionAmount = money(event?.accountReductionAmount ?? (event?.hadCashOut === false ? amount : 0));
    const cashRefundAmount = money(event?.cashRefundAmount ?? (event?.hadCashOut ? amount : 0));
    return {
      ...event,
      id: event?.id || `purchase-return-${index}`,
      quantity: quantity(event?.quantity),
      amount,
      accountReductionAmount,
      cashRefundAmount,
      date: cleanFinancialDate(event?.date || event?.createdAt),
      createdAt: event?.createdAt || ''
    };
  });
};

const makePurchaseItem = (product, movement) => {
  const originalQuantity = quantity(movement?.quantity);
  const unitCost = Math.max(0, finiteNumber(movement?.unitCost));
  const originalAmount = money(originalQuantity * unitCost);
  const events = getPurchaseCancellationEvents(movement);
  return {
    product,
    movement,
    originalQuantity,
    unitCost,
    originalAmount,
    events,
    canceledQuantity: Math.min(originalQuantity, events.reduce((sum, event) => sum + event.quantity, 0)),
    accountReductionAmount: sumMoney(events, event => event.accountReductionAmount),
    cashRefundAmount: sumMoney(events, event => event.cashRefundAmount)
  };
};

const reconcilePurchasePlan = (rawPlan, targetOpenCents) => {
  const plan = rawPlan.map(item => ({ ...item, amount: money(item.amount) }));
  const unpaid = plan.map((item, index) => item.paid ? -1 : index).filter(index => index >= 0);
  if (unpaid.length === 0) return plan;

  let difference = unpaid.reduce((total, index) => total + Math.max(0, toCents(plan[index].amount)), 0) - Math.max(0, targetOpenCents);
  for (let cursor = unpaid.length - 1; cursor >= 0 && difference > 0; cursor -= 1) {
    const index = unpaid[cursor];
    const current = Math.max(0, toCents(plan[index].amount));
    const reduction = Math.min(current, difference);
    plan[index].amount = fromCents(current - reduction);
    difference -= reduction;
  }
  if (difference < 0) {
    const index = unpaid[unpaid.length - 1];
    plan[index].amount = fromCents(toCents(plan[index].amount) - difference);
  }
  return plan;
};

const makePurchaseGroup = group => {
  group.items.sort((a, b) => finiteNumber(a.movement.batchIndex) - finiteNumber(b.movement.batchIndex)
    || String(a.product.name || '').localeCompare(String(b.product.name || ''), 'pt-BR'));
  const first = group.items[0];
  const paymentMethod = first?.movement?.paymentMethod || 'pix';
  const deferred = paymentMethod === 'credit' || paymentMethod === 'term';
  const originalAmount = sumMoney(group.items, item => item.originalAmount);
  const accountReductionAmount = sumMoney(group.items, item => item.accountReductionAmount);
  const adjustedLiability = fromCents(Math.max(0, toCents(originalAmount) - toCents(accountReductionAmount)));
  const rawPlan = deferred ? normalizePurchaseInstallments(first?.movement, originalAmount) : [];
  const paidAmount = sumMoney(rawPlan.filter(item => item.paid), item => item.amount);
  const openCents = Math.max(0, toCents(adjustedLiability) - toCents(paidAmount));
  const plan = reconcilePurchasePlan(rawPlan, openCents);
  const fullyCanceled = group.items.length > 0 && group.items.every(item => item.canceledQuantity >= item.originalQuantity);
  return {
    ...group,
    first,
    paymentMethod,
    deferred,
    originalAmount,
    accountReductionAmount,
    adjustedLiability,
    paidAmount,
    openTotal: fromCents(openCents),
    plan,
    fullyCanceled,
    partiallyCanceled: !fullyCanceled && group.items.some(item => item.canceledQuantity > 0),
    purchaseDate: cleanFinancialDate(first?.movement?.date),
    purchaseDateTime: first?.movement?.date || '',
    itemCount: group.items.length
  };
};

export const getPurchaseGroups = (products = []) => {
  const groups = new Map();
  for (const product of Array.isArray(products) ? products : []) {
    for (const movement of Array.isArray(product?.movements) ? product.movements : []) {
      if (movement?.type !== 'compra') continue;
      const key = movement.batchId ? `batch:${movement.batchId}` : `single:${product.id}:${movement.id}`;
      if (!groups.has(key)) groups.set(key, { key, batchId: movement.batchId || null, items: [] });
      groups.get(key).items.push(makePurchaseItem(product, movement));
    }
  }
  return [...groups.values()].map(makePurchaseGroup);
};

export const buildSalePaymentEvents = sale => {
  const rows = [];
  if (toCents(sale?.entryAmount) > 0) {
    rows.push({
      id: `sale-entry-${sale.id}`,
      date: cleanFinancialDate(sale.saleDate),
      dateTime: sale.saleDateTime || '',
      amount: money(sale.entryAmount),
      kind: 'entry',
      installmentIndex: -1,
      sale
    });
  }
  (Array.isArray(sale?.installments) ? sale.installments : []).forEach((installment, installmentIndex) => {
    const history = Array.isArray(installment?.history) ? installment.history : [];
    if (history.length > 0) {
      history.forEach((item, historyIndex) => {
        const amount = getHistoryCashAmount(item);
        const date = cleanFinancialDate(item?.date || item?.timestamp || installment.paidAt);
        if (toCents(amount) <= 0 || !date) return;
        rows.push({
          id: `sale-payment-${sale.id}-${installmentIndex}-${historyIndex}`,
          date,
          dateTime: item?.timestamp || '',
          amount,
          kind: 'installment',
          installmentIndex,
          historyIndex,
          installment,
          history: item,
          sale
        });
      });
    } else if (installment?.paid && installment?.paidAt) {
      const amount = getInstallmentFaceAmount(installment);
      if (toCents(amount) > 0) {
        rows.push({
          id: `sale-paid-${sale.id}-${installmentIndex}`,
          date: cleanFinancialDate(installment.paidAt),
          dateTime: installment.paidAtDateTime || '',
          amount,
          kind: 'installment',
          installmentIndex,
          installment,
          sale
        });
      }
    }
  });
  return rows.sort((a, b) => String(a.date).localeCompare(String(b.date))
    || String(a.dateTime).localeCompare(String(b.dateTime)) || String(a.id).localeCompare(String(b.id)));
};

export const getSaleCancellationEvents = sale => {
  const current = Array.isArray(sale?.cancellations) ? sale.cancellations : [];
  const originalNet = sale?.saleType === 'direct' ? getDirectSaleNet(sale) : money(sale?.totalPrice);
  const legacyCash = sale?.saleType === 'direct' ? originalNet : sumMoney(buildSalePaymentEvents(sale), item => item.amount);
  const events = current.length > 0 ? current : sale?.status === 'canceled' ? [{
    id: `legacy-sale-cancel-${sale.id || 'sale'}`,
    type: 'total',
    date: cleanFinancialDate(sale.lastCancellationAt || sale.canceledAt || sale.saleDate),
    createdAt: '',
    reason: sale.cancelReason || 'Venda cancelada',
    canceledContractValue: money(sale.totalPrice),
    canceledCostAmount: money(sale.totalCost),
    storeImpactAmount: legacyCash,
    customerRefundAmount: legacyCash,
    refundAmount: legacyCash
  }] : [];

  return events.map((event, index) => {
    const eventItems = Array.isArray(event?.items) ? event.items : [];
    const fallbackContract = eventItems.length > 0 ? sumMoney(eventItems, item => item.amount) : money(sale?.totalPrice);
    const canceledContractValue = money(event?.canceledContractValue ?? fallbackContract);
    const originalContract = Math.max(0, toCents(sale?.totalPrice));
    const fraction = originalContract > 0 ? Math.min(1, Math.max(0, toCents(canceledContractValue) / originalContract)) : 1;
    const fallbackCost = eventItems.length > 0 ? sumMoney(eventItems, item => item.canceledCostAmount ?? finiteNumber(item.unitCost) * quantity(item.quantity)) : money(finiteNumber(sale?.totalCost) * fraction);
    const canceledCostAmount = money(event?.canceledCostAmount ?? fallbackCost);
    const fallbackStoreImpact = sale?.saleType === 'direct' ? money(originalNet * fraction) : money(legacyCash * fraction);
    const storeImpactAmount = money(event?.storeImpactAmount ?? event?.refundAmount ?? event?.customerRefundAmount ?? fallbackStoreImpact);
    const customerRefundAmount = money(event?.customerRefundAmount ?? event?.refundAmount ?? storeImpactAmount);
    const canceledNet = sale?.saleType === 'direct' ? storeImpactAmount : canceledContractValue;
    const profitImpactAmount = money(event?.profitImpactAmount ?? fromCents(toCents(canceledNet) - toCents(canceledCostAmount)));
    return {
      ...event,
      id: event?.id || `sale-cancel-${index}`,
      type: event?.type || 'total',
      date: cleanFinancialDate(event?.date || event?.createdAt || sale?.lastCancellationAt || sale?.canceledAt),
      createdAt: event?.createdAt || '',
      canceledContractValue,
      canceledCostAmount,
      storeImpactAmount,
      customerRefundAmount,
      refundAmount: storeImpactAmount,
      profitImpactAmount,
      fraction
    };
  });
};

const paymentLabel = method => ({ money: 'Dinheiro', pix: 'PIX', debit: 'Débito', credit: 'Crédito', term: 'A prazo' }[method] || 'Pagamento');

export const buildFinancialLedger = ({ sales = [], products = [], financialData = {}, purchaseGroups = null } = {}) => {
  const rows = [];
  for (const sale of Array.isArray(sales) ? sales : []) {
    const cancellations = getSaleCancellationEvents(sale);
    if (sale?.saleType === 'direct') {
      const amount = getDirectSaleNet(sale);
      const date = cleanFinancialDate(sale?.saleDate);
      if (toCents(amount) > 0 && date) rows.push({
        id: `direct-${sale.id}`, type: 'income', date, dateTime: sale.saleDateTime || '', amount,
        description: `Venda · ${sale.customerName || 'Venda avulsa'}`,
        detail: sale.paymentMethod === 'credit' ? `Cartão de crédito · ${sale.cardInstallments || 1}x` : paymentLabel(sale.paymentMethod),
        source: 'sale', sale
      });
    } else if (isTermSale(sale)) {
      buildSalePaymentEvents(sale).forEach(event => rows.push({
        ...event,
        type: 'income',
        description: event.kind === 'entry' ? `Entrada · ${sale.customerName || 'Cliente'}` : `Recebimento · ${sale.customerName || 'Cliente'}`,
        detail: event.kind === 'entry' ? 'Venda a prazo' : `Parcela ${event.installment?.number || event.installmentIndex + 1}`,
        source: 'sale'
      }));
    }
    cancellations.forEach((event, index) => {
      if (toCents(event.storeImpactAmount) <= 0 || !event.date) return;
      rows.push({
        id: `sale-refund-${sale.id}-${event.id || index}`, type: 'expense', date: event.date,
        dateTime: event.createdAt || '', amount: event.storeImpactAmount,
        description: `Estorno de venda · ${sale.customerName || 'Venda avulsa'}`,
        detail: `${event.type === 'partial' ? 'Cancelamento parcial' : 'Cancelamento total'}${event.reason ? ` · ${event.reason}` : ''}`,
        source: 'sale-refund', sale, cancellation: event
      });
    });
  }

  const groups = Array.isArray(purchaseGroups) ? purchaseGroups : getPurchaseGroups(products);
  groups.forEach(group => {
    if (group.deferred) {
      group.plan.forEach(item => {
        if (!item.paid || toCents(item.amount) <= 0 || !item.paidAt) return;
        rows.push({
          id: `stock-${group.key}-installment-${item.number}`, type: 'expense',
          date: cleanFinancialDate(item.paidAt), dateTime: item.paidAtDateTime || '', amount: money(item.amount),
          description: group.batchId ? `Compra de mercadoria em lote · ${group.itemCount} produtos` : `Compra de mercadoria · ${group.first.product.name}`,
          detail: `${paymentLabel(group.paymentMethod)} · parcela ${item.number}/${group.plan.length}`,
          source: 'stock', product: group.first.product, batchId: group.batchId, purchaseGroup: group, installment: item
        });
      });
    } else if (toCents(group.originalAmount) > 0 && group.purchaseDate) {
      rows.push({
        id: `stock-${group.key}`, type: 'expense', date: group.purchaseDate, dateTime: group.purchaseDateTime,
        amount: group.originalAmount,
        description: group.batchId ? `Compra de mercadoria em lote · ${group.itemCount} produtos` : `Compra de mercadoria · ${group.first.product.name}`,
        detail: paymentLabel(group.paymentMethod), source: 'stock', product: group.first.product,
        batchId: group.batchId, purchaseGroup: group
      });
    }
    group.items.forEach(item => item.events.forEach((event, index) => {
      if (toCents(event.cashRefundAmount) <= 0 || !event.date) return;
      rows.push({
        id: `stock-refund-${item.product.id}-${item.movement.id}-${event.id || index}`,
        type: 'income', date: event.date, dateTime: event.createdAt || '', amount: event.cashRefundAmount,
        description: `Estorno de compra · ${item.product.name}`,
        detail: event.reason || 'Devolução ao fornecedor', source: 'stock-refund',
        product: item.product, batchId: group.batchId, purchaseGroup: group, cancellation: event
      });
    }));
  });

  (Array.isArray(financialData?.entries) ? financialData.entries : []).forEach(item => {
    const date = cleanFinancialDate(item?.date);
    const amount = money(item?.value);
    if (!date || toCents(amount) <= 0) return;
    rows.push({
      id: item.id, type: item.type === 'expense' ? 'expense' : 'income', date,
      dateTime: item.dateTime || item.createdAt || '', amount,
      description: item.description || 'Lançamento manual', detail: item.category || 'Lançamento manual',
      source: 'manual', manual: item
    });
  });
  (Array.isArray(financialData?.accounts) ? financialData.accounts : []).forEach(item => {
    const date = cleanFinancialDate(item?.paidAt);
    const amount = money(item?.value);
    if (!item?.paid || !date || toCents(amount) <= 0) return;
    rows.push({
      id: `manual-account-${item.id}`, type: item.direction === 'receivable' ? 'income' : 'expense',
      date, dateTime: item.paidAtDateTime || '', amount,
      description: item.description || 'Conta manual',
      detail: item.direction === 'receivable' ? 'Conta recebida' : 'Conta paga', source: 'manual-account', manual: item
    });
  });
  return rows;
};

export const summarizeFinancialLedger = (ledger, startDate, endDate) => {
  const rows = (Array.isArray(ledger) ? ledger : []).filter(item => inFinancialPeriod(item?.date, startDate, endDate));
  const income = sumMoney(rows.filter(item => item.type === 'income'), item => item.amount);
  const expense = sumMoney(rows.filter(item => item.type === 'expense'), item => item.amount);
  return { rows, income, expense, balance: fromCents(toCents(income) - toCents(expense)) };
};

export const getSalesAccrualSummary = (sales = [], startDate, endDate) => {
  const origins = [];
  const cancellations = [];
  for (const sale of Array.isArray(sales) ? sales : []) {
    if (inFinancialPeriod(sale?.saleDate, startDate, endDate)) origins.push(sale);
    getSaleCancellationEvents(sale).forEach(event => {
      if (inFinancialPeriod(event.date, startDate, endDate)) cancellations.push({ sale, event });
    });
  }
  const originalGross = sumMoney(origins, sale => sale.totalPrice);
  const canceledGross = sumMoney(cancellations, item => item.event.canceledContractValue);
  const originalNet = sumMoney(origins, sale => sale.saleType === 'direct' ? getDirectSaleNet(sale) : sale.totalPrice);
  const canceledNet = sumMoney(cancellations, item => item.sale.saleType === 'direct' ? item.event.storeImpactAmount : item.event.canceledContractValue);
  const originalCost = sumMoney(origins, sale => sale.totalCost);
  const canceledCost = sumMoney(cancellations, item => item.event.canceledCostAmount);
  const gross = fromCents(toCents(originalGross) - toCents(canceledGross));
  const net = fromCents(toCents(originalNet) - toCents(canceledNet));
  const cost = fromCents(toCents(originalCost) - toCents(canceledCost));
  return {
    origins,
    cancellations,
    originalGross,
    canceledGross,
    gross,
    originalNet,
    canceledNet,
    net,
    originalCost,
    canceledCost,
    cost,
    profit: fromCents(toCents(net) - toCents(cost)),
    originalProfit: fromCents(toCents(originalNet) - toCents(originalCost)),
    canceledProfit: fromCents(toCents(canceledNet) - toCents(canceledCost)),
    storeFees: sumMoney(origins, sale => sale?.feeConfig?.type === 'sem_juros' ? sale.feeConfig.storeAbsorbedFeeValue ?? sale.feeConfig.value : 0),
    customerFees: sumMoney(origins, sale => sale?.feeConfig?.type === 'com_juros' ? sale.feeConfig.customerPassedFeeValue ?? sale.feeConfig.value : 0),
    discounts: sumMoney(origins, sale => sale.totalDiscount),
    carnetInterest: sumMoney(origins, sale => isTermSale(sale) ? sale?.installmentInterest?.value ?? sale?.interestConfig?.value ?? sale?.carnetInterestValue ?? Math.max(0, finiteNumber(sale.totalPrice) - finiteNumber(sale.productsTotal)) : 0)
  };
};

export const getRealizedSalesProfit = (sales = [], startDate, endDate) => {
  let totalCents = 0;

  for (const sale of Array.isArray(sales) ? sales : []) {
    const cancellations = getSaleCancellationEvents(sale);
    if (sale?.saleType === 'direct') {
      if (inFinancialPeriod(sale.saleDate, startDate, endDate)) {
        totalCents += toCents(getDirectSaleNet(sale)) - toCents(sale.totalCost);
      }
      cancellations.forEach(event => {
        if (inFinancialPeriod(event.date, startDate, endDate)) totalCents -= toCents(event.profitImpactAmount);
      });
      continue;
    }
    if (!isTermSale(sale)) continue;

    const events = [
      ...buildSalePaymentEvents(sale).map(event => ({ ...event, eventType: 'payment' })),
      ...cancellations.map(event => ({ ...event, dateTime: event.createdAt || '', eventType: 'cancellation' }))
    ].sort((left, right) => String(left.date).localeCompare(String(right.date))
      || String(left.dateTime || '').localeCompare(String(right.dateTime || ''))
      || (left.eventType === 'payment' ? -1 : 1));

    const costCents = Math.max(0, toCents(sale.totalCost));
    const limitCents = Math.max(0, toCents(sale.totalPrice) - costCents);
    let recoveredCostCents = 0;
    let recognizedProfitCents = 0;

    events.forEach(event => {
      if (event.eventType === 'cancellation') {
        const reversed = event.type === 'total'
          ? recognizedProfitCents
          : Math.min(recognizedProfitCents, Math.max(0, toCents(event.profitImpactAmount)));
        recognizedProfitCents -= reversed;
        if (inFinancialPeriod(event.date, startDate, endDate)) totalCents -= reversed;
        return;
      }

      const receivedCents = Math.max(0, toCents(event.amount));
      const costPartCents = Math.min(receivedCents, Math.max(0, costCents - recoveredCostCents));
      const recognized = Math.min(
        Math.max(0, receivedCents - costPartCents),
        Math.max(0, limitCents - recognizedProfitCents)
      );
      recoveredCostCents += costPartCents;
      recognizedProfitCents += recognized;
      if (inFinancialPeriod(event.date, startDate, endDate)) totalCents += recognized;
    });
  }

  return fromCents(totalCents);
};

const projectInstallmentAsOf = (installment, endDate) => {
  const history = Array.isArray(installment?.history) ? installment.history : [];
  const face = getInstallmentFaceAmount(installment);
  if (history.length === 0) {
    const wasPaid = !!installment?.paid && !!installment?.paidAt && cleanFinancialDate(installment.paidAt) <= endDate;
    return { ...installment, originalAmount: face, amount: wasPaid ? 0 : face, paid: wasPaid, paidAt: wasPaid ? cleanFinancialDate(installment.paidAt) : null };
  }
  const visibleHistory = history.filter(item => {
    const date = cleanFinancialDate(item?.date || item?.timestamp);
    return !!date && date <= endDate;
  });
  const applied = visibleHistory.reduce((total, item) => total + Math.max(0, toCents(item?.amount)), 0);
  const remaining = Math.max(0, toCents(face) - applied);
  const paid = remaining === 0;
  return {
    ...installment,
    originalAmount: face,
    amount: fromCents(remaining),
    paid,
    paidAt: paid && installment?.paidAt && cleanFinancialDate(installment.paidAt) <= endDate ? cleanFinancialDate(installment.paidAt) : paid ? cleanFinancialDate(visibleHistory[visibleHistory.length - 1]?.date) : null,
    history: visibleHistory
  };
};

export const projectSalesAsOf = (sales = [], endDate) => (Array.isArray(sales) ? sales : []).map(sale => {
  const cancellations = getSaleCancellationEvents(sale).filter(event => !event.date || event.date <= endDate);
  const installments = (Array.isArray(sale?.installments) ? sale.installments : []).map(item => projectInstallmentAsOf(item, endDate));
  const cancellationTotal = toCents(sumMoney(cancellations, event => event.canceledContractValue));
  const canceledAtDate = sale?.status === 'canceled' && cancellations.length > 0
    && (cancellations.some(event => event.type === 'total') || cancellationTotal >= Math.max(0, toCents(sale?.totalPrice)));
  const inferredStatus = sale?.saleType === 'direct' || (installments.length > 0 && installments.every(item => item.paid)) ? 'completed' : 'active';
  return {
    ...sale,
    installments,
    cancellations,
    status: canceledAtDate ? 'canceled' : sale?.status === 'canceled' ? inferredStatus : sale?.status === 'completed' && installments.length > 0 && installments.some(item => !item.paid) ? 'active' : sale.status
  };
});

const cloneInstallments = installments => (Array.isArray(installments) ? installments : []).map(item => ({
  ...item,
  amount: money(item.amount),
  originalAmount: getInstallmentFaceAmount(item),
  history: Array.isArray(item.history) ? item.history.map(history => ({ ...history })) : []
}));

export const applyInstallmentPayment = (installments, selectedIndex, amountPaid, datePaid, timestamp = new Date().toISOString()) => {
  const index = parseInt(selectedIndex, 10);
  const rows = cloneInstallments(installments);
  const selected = rows[index];
  const paymentCents = toCents(amountPaid);
  const date = cleanFinancialDate(datePaid);
  if (!selected || selected.paid || toCents(selected.amount) <= 0) throw new FinancialCalculationError('invalid-installment', 'A parcela selecionada não está mais disponível para pagamento.');
  if (paymentCents <= 0 || !date) throw new FinancialCalculationError('invalid-payment', 'Informe um valor e uma data de pagamento válidos.');

  const available = rows.slice(index).reduce((total, item) => total + (!item.paid ? Math.max(0, toCents(item.amount)) : 0), 0);
  if (paymentCents > available) {
    throw new FinancialCalculationError('payment-exceeds-balance', `O pagamento informado é maior que o saldo restante do contrato (${fromCents(available).toFixed(2).replace('.', ',')}).`);
  }

  const selectedOpen = Math.max(0, toCents(selected.amount));
  const appliedToSelected = Math.min(paymentCents, selectedOpen);
  let surplus = paymentCents - appliedToSelected;
  const allocations = [];

  for (let cursor = index + 1; surplus > 0 && cursor < rows.length; cursor += 1) {
    const target = rows[cursor];
    if (target.paid) continue;
    const open = Math.max(0, toCents(target.amount));
    if (open <= 0) continue;
    const applied = Math.min(open, surplus);
    const remaining = open - applied;
    target.amount = fromCents(remaining);
    target.paid = remaining === 0;
    target.paidAt = target.paid ? date : null;
    target.paidAtDateTime = target.paid ? timestamp : null;
    target.history.push({
      date,
      amount: fromCents(applied),
      type: 'abatement',
      fromInstallment: index,
      sourceTimestamp: timestamp,
      timestamp
    });
    allocations.push({ installmentIndex: cursor, amount: fromCents(applied) });
    surplus -= applied;
  }

  const remainingSelected = selectedOpen - appliedToSelected;
  const historyItem = {
    date,
    amount: fromCents(appliedToSelected),
    type: paymentCents < selectedOpen ? 'partial' : paymentCents === selectedOpen ? 'full' : 'full_surplus',
    timestamp
  };
  if (paymentCents > selectedOpen) {
    historyItem.surplus = fromCents(paymentCents - selectedOpen);
    historyItem.allocations = allocations;
  }
  selected.history.push(historyItem);
  selected.amount = fromCents(remainingSelected);
  selected.paid = remainingSelected === 0;
  selected.paidAt = selected.paid ? date : null;
  selected.paidAtDateTime = selected.paid ? timestamp : null;
  return {
    installments: rows,
    historyItem,
    allocations,
    paidAmount: fromCents(paymentCents),
    remainingBalance: sumMoney(rows.filter(item => !item.paid), item => item.amount),
    allPaid: rows.every(item => item.paid || toCents(item.amount) <= 0)
  };
};

export const reverseInstallmentPayment = (installments, installmentIndex, historyIndex, expectedTimestamp = '') => {
  const rows = cloneInstallments(installments);
  const index = parseInt(installmentIndex, 10);
  const selected = rows[index];
  if (!selected) throw new FinancialCalculationError('invalid-installment', 'A parcela do pagamento não foi encontrada.');
  const requestedIndex = parseInt(historyIndex, 10);
  const selectedIndex = expectedTimestamp
    ? selected.history.findIndex(item => item?.timestamp === expectedTimestamp && item?.type !== 'abatement')
    : requestedIndex;
  const history = selected.history[selectedIndex];
  if (!history || history.type === 'abatement') throw new FinancialCalculationError('invalid-reversal', 'O pagamento já foi alterado ou não pode ser estornado diretamente.');

  selected.history.splice(selectedIndex, 1);
  selected.amount = fromCents(Math.max(0, toCents(selected.amount) + Math.max(0, toCents(history.amount))));
  selected.paid = toCents(selected.amount) <= 0;
  if (!selected.paid) {
    selected.paidAt = null;
    selected.paidAtDateTime = null;
  }

  if (history.type === 'full_surplus' && history.timestamp) {
    rows.forEach((item, itemIndex) => {
      if (itemIndex === index) return;
      const removed = item.history.filter(entry => entry?.type === 'abatement' && entry?.sourceTimestamp === history.timestamp);
      if (removed.length === 0) return;
      item.history = item.history.filter(entry => !(entry?.type === 'abatement' && entry?.sourceTimestamp === history.timestamp));
      item.amount = fromCents(toCents(item.amount) + removed.reduce((sum, entry) => sum + Math.max(0, toCents(entry.amount)), 0));
      item.paid = toCents(item.amount) <= 0;
      if (!item.paid) {
        item.paidAt = null;
        item.paidAtDateTime = null;
      }
    });
  }
  return {
    installments: rows,
    reversedAmount: getHistoryCashAmount(history),
    remainingBalance: sumMoney(rows.filter(item => !item.paid), item => item.amount),
    allPaid: rows.every(item => item.paid || toCents(item.amount) <= 0)
  };
};

export const normalizeSaleMoney = sale => {
  const items = (Array.isArray(sale?.items) ? sale.items : []).map(item => {
    const count = Math.max(0, quantity(item.quantity));
    const unitPrice = money(item.unitPrice);
    const unitCost = money(item.unitCost);
    return {
      ...item,
      unitPrice,
      unitCost,
      unitDiscount: money(item.unitDiscount),
      price: money(item.price ?? unitPrice * count),
      cost: money(item.cost ?? unitCost * count)
    };
  });
  const installments = (Array.isArray(sale?.installments) ? sale.installments : []).map(item => ({
    ...item,
    amount: money(item.amount),
    originalAmount: money(item.originalAmount ?? item.amount)
  }));
  const entryAmount = money(sale?.entryAmount);
  const normalized = {
    ...sale,
    items,
    installments,
    totalCost: sumMoney(items, item => item.cost),
    totalDiscount: sumMoney(items, item => money(item.unitDiscount * quantity(item.quantity))),
    totalPrice: money(sale?.totalPrice)
  };
  if ('productsTotal' in (sale || {})) normalized.productsTotal = sumMoney(items, item => item.price);
  if ('entryAmount' in (sale || {})) normalized.entryAmount = entryAmount;
  if (isTermSale(sale) && installments.length > 0) normalized.totalPrice = fromCents(toCents(entryAmount) + toCents(sumMoney(installments, item => item.amount)));
  if ('netReceived' in (sale || {})) normalized.netReceived = money(sale.netReceived);
  if ('cardAmount' in (sale || {})) normalized.cardAmount = money(sale.cardAmount);
  if (sale?.feeConfig) {
    normalized.feeConfig = { ...sale.feeConfig };
    ['value', 'baseAmount', 'grossCardAmount', 'calculatedGrossAmount', 'customerPassedFeeValue', 'storeAbsorbedFeeValue', 'netCardAmount'].forEach(key => {
      if (key in normalized.feeConfig) normalized.feeConfig[key] = money(normalized.feeConfig[key]);
    });
  }
  if (sale?.installmentInterest) {
    normalized.installmentInterest = {
      ...sale.installmentInterest,
      value: money(sale.installmentInterest.value),
      baseAmount: money(sale.installmentInterest.baseAmount)
    };
  }
  return normalized;
};
