export const money = value => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;

export const clampInstallments = value => {
  const parsed = parseInt(value, 10) || 1;
  return Math.min(24, Math.max(1, parsed));
};

const parseDateParts = value => {
  const [year, month, day] = String(value || '').split('T')[0].split('-').map(Number);
  return year && month && day ? { year, month, day } : null;
};

export const addMonthsClamped = (dateValue, offset) => {
  const parts = parseDateParts(dateValue);
  if (!parts) return '';
  const zeroMonth = parts.month - 1 + offset;
  const targetYear = parts.year + Math.floor(zeroMonth / 12);
  const targetMonth = ((zeroMonth % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(parts.day, lastDay);
  return `${String(targetYear).padStart(4, '0')}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
};

export const splitMoney = (total, count) => {
  const installments = clampInstallments(count);
  const cents = Math.max(0, Math.round((Number(total) || 0) * 100));
  const base = Math.floor(cents / installments);
  let remainder = cents - base * installments;
  return Array.from({ length: installments }, () => {
    const value = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return value / 100;
  });
};

export const buildPaymentInstallments = (total, count, firstDueDate) => {
  const installmentCount = clampInstallments(count);
  const amounts = splitMoney(total, installmentCount);
  return amounts.map((amount, index) => ({
    number: index + 1,
    dueDate: addMonthsClamped(firstDueDate, index),
    amount: money(amount),
    paid: false,
    paidAt: null,
    paidAtDateTime: null
  }));
};

export const normalizePaymentInstallments = (movement, totalFallback = 0) => {
  const current = Array.isArray(movement?.financialInstallments) ? movement.financialInstallments : [];
  if (current.length) {
    return current.map((item, index) => ({
      number: parseInt(item?.number, 10) || index + 1,
      dueDate: String(item?.dueDate || movement?.paymentDueDate || '').split('T')[0],
      amount: money(item?.amount),
      paid: !!item?.paid,
      paidAt: item?.paidAt ? String(item.paidAt).split('T')[0] : null,
      paidAtDateTime: item?.paidAtDateTime || ''
    }));
  }

  const total = money(totalFallback);
  return [{
    number: 1,
    dueDate: String(movement?.paymentDueDate || '').split('T')[0],
    amount: total,
    paid: !!movement?.financialPaid,
    paidAt: movement?.financialPaidAt ? String(movement.financialPaidAt).split('T')[0] : null,
    paidAtDateTime: movement?.financialPaidAtDateTime || ''
  }];
};
