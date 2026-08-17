const response = await fetch('./aba-financeiro-fixed-v47.js?v=48', { cache: 'no-store' });
if (!response.ok) throw new Error('Não foi possível carregar o Financeiro v47 base (' + response.status + ').');
let wrapperSource = await response.text();

const replaceWrapperRequired = (marker, replacement, label) => {
  if (!wrapperSource.includes(marker)) throw new Error('Não foi possível preparar ' + label + '.');
  wrapperSource = wrapperSource.replace(marker, replacement);
};

const automaticPaymentMarker = `      const paymentDate = cleanDate(deferred ? (movement.financialPaidAt || movement.paymentDueDate) : movement.date);
      const cancellationEvents = getPurchaseCancellationEvents(movement);
      const canceledQuantity = getPurchaseCanceledQuantity(movement);`;
const automaticPaymentReplacement = `      const paymentDate = cleanDate(deferred ? (movement.financialPaidAt || movement.paymentDueDate) : movement.date);
      const cancellationEvents = getPurchaseCancellationEvents(movement);
      const canceledBeforePaymentAmount = cancellationEvents.filter(event => event.hadCashOut === false).reduce((sum, event) => sum + money(event.amount || (num(event.quantity) * unitCost)), 0);
      const paidPurchaseAmount = money(Math.max(0, originalAmount - canceledBeforePaymentAmount));
      const canceledQuantity = getPurchaseCanceledQuantity(movement);`;
replaceWrapperRequired(
  automaticPaymentMarker,
  automaticPaymentReplacement,
  'compras parcialmente canceladas antes do pagamento'
);

const expenseAmountMarker = `          amount: originalAmount,
          description: 'Compra de mercadoria · ' + product.name,`;
replaceWrapperRequired(
  expenseAmountMarker,
  `          amount: paidPurchaseAmount,
          description: 'Compra de mercadoria · ' + product.name,`,
  'o valor efetivamente pago da compra'
);

const payableValueMarker = `      const fullyCanceled = remainingQuantity <= 0;
      const partiallyCanceled = canceledQuantity > 0 && !fullyCanceled;
      const value = movement.financialPaid ? originalValue : money(remainingQuantity * unitCost);
      const cancellationEvents = getPurchaseCancellationEvents(movement);`;
const payableValueReplacement = `      const fullyCanceled = remainingQuantity <= 0;
      const partiallyCanceled = canceledQuantity > 0 && !fullyCanceled;
      const cancellationEvents = getPurchaseCancellationEvents(movement);
      const canceledBeforePaymentAmount = cancellationEvents.filter(event => event.hadCashOut === false).reduce((sum, event) => sum + money(event.amount || (num(event.quantity) * unitCost)), 0);
      const paidValue = money(Math.max(0, originalValue - canceledBeforePaymentAmount));
      const value = movement.financialPaid ? paidValue : money(remainingQuantity * unitCost);`;
replaceWrapperRequired(
  payableValueMarker,
  payableValueReplacement,
  'a conta a pagar proporcional'
);

const finalWrapperMarker = `const blob = new Blob([source], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
try {
  await import(url);
} finally {
  URL.revokeObjectURL(url);
}`;
const finalWrapperReplacement = `source = source.replace(/from\\s+(['\"])(\\.\\/[^'\"]+)\\1/g, (match, quote, modulePath) => {
  const moduleUrl = new URL(modulePath, location.href);
  moduleUrl.searchParams.set('v', '48');
  return "from '" + moduleUrl.href + "'";
});

const blob = new Blob([source], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
let financeModule;
try {
  financeModule = await import(url);
} finally {
  URL.revokeObjectURL(url);
}
if (!financeModule || typeof financeModule.AbaFinanceiro !== 'function') {
  throw new Error('O módulo Financeiro final não exportou AbaFinanceiro.');
}
export const AbaFinanceiro = financeModule.AbaFinanceiro;`;
replaceWrapperRequired(
  finalWrapperMarker,
  finalWrapperReplacement,
  'o export de AbaFinanceiro no wrapper interno'
);

const wrapperBlob = new Blob([wrapperSource], { type: 'text/javascript' });
const wrapperUrl = URL.createObjectURL(wrapperBlob);
let wrapperModule;
try {
  wrapperModule = await import(wrapperUrl);
} finally {
  URL.revokeObjectURL(wrapperUrl);
}

if (!wrapperModule || typeof wrapperModule.AbaFinanceiro !== 'function') {
  throw new Error('O loader Financeiro não recebeu o export AbaFinanceiro.');
}

export const AbaFinanceiro = wrapperModule.AbaFinanceiro;
