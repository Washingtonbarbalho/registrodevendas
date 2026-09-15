import { fromCents, money, normalizePurchaseInstallments, splitMoney, toCents } from './financial-core-v70.js';

export { money, splitMoney };

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

export const getPurchasePaymentBreakdown = (total, entry = 0) => {
  const totalCents = Math.max(0, toCents(total));
  const requestedEntryCents = Math.max(0, toCents(entry));
  const entryCents = Math.min(totalCents, requestedEntryCents);
  return {
    totalAmount: fromCents(totalCents),
    requestedEntryAmount: fromCents(requestedEntryCents),
    entryAmount: fromCents(entryCents),
    financedAmount: fromCents(totalCents - entryCents),
    entryCoversTotal: totalCents > 0 && requestedEntryCents >= totalCents
  };
};

export const buildPurchasePaymentPlan = (total, entry, count, firstDueDate) => {
  const { financedAmount } = getPurchasePaymentBreakdown(total, entry);
  if (!firstDueDate || toCents(financedAmount) <= 0) return [];
  return buildPaymentInstallments(financedAmount, count, firstDueDate);
};

export const normalizePaymentInstallments = (movement, totalFallback = 0) =>
  normalizePurchaseInstallments(movement, totalFallback);
