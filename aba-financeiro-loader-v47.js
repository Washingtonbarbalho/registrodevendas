const response = await fetch('./aba-financeiro-fixed-v47.js?v=47', { cache: 'no-store' });
if (!response.ok) throw new Error('Não foi possível carregar o Financeiro v47 (' + response.status + ').');
let wrapperSource = await response.text();

const automaticPaymentMarker = `      const paymentDate = cleanDate(deferred ? (movement.financialPaidAt || movement.paymentDueDate) : movement.date);
      const cancellationEvents = getPurchaseCancellationEvents(movement);
      const canceledQuantity = getPurchaseCanceledQuantity(movement);`;
const automaticPaymentReplacement = `      const paymentDate = cleanDate(deferred ? (movement.financialPaidAt || movement.paymentDueDate) : movement.date);
      const cancellationEvents = getPurchaseCancellationEvents(movement);
      const canceledBeforePaymentAmount = cancellationEvents.filter(event => event.hadCashOut === false).reduce((sum, event) => sum + money(event.amount || (num(event.quantity) * unitCost)), 0);
      const paidPurchaseAmount = money(Math.max(0, originalAmount - canceledBeforePaymentAmount));
      const canceledQuantity = getPurchaseCanceledQuantity(movement);`;
if (!wrapperSource.includes(automaticPaymentMarker)) throw new Error('Não foi possível ajustar compras parcialmente canceladas antes do pagamento.');
wrapperSource = wrapperSource.replace(automaticPaymentMarker, automaticPaymentReplacement);

const expenseAmountMarker = `          amount: originalAmount,
          description: 'Compra de mercadoria · ' + product.name,`;
if (!wrapperSource.includes(expenseAmountMarker)) throw new Error('Não foi possível ajustar o valor efetivamente pago da compra.');
wrapperSource = wrapperSource.replace(expenseAmountMarker, `          amount: paidPurchaseAmount,
          description: 'Compra de mercadoria · ' + product.name,`);

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
if (!wrapperSource.includes(payableValueMarker)) throw new Error('Não foi possível ajustar a conta a pagar proporcional.');
wrapperSource = wrapperSource.replace(payableValueMarker, payableValueReplacement);

const marker = "const blob = new Blob([source], { type: 'text/javascript' });";
if (!wrapperSource.includes(marker)) throw new Error('Não foi possível preparar os imports do Financeiro v47.');
wrapperSource = wrapperSource.replace(marker, `source = source.replace(/from\\s+(['\"])(\\.\\/[^'\"]+)\\1/g, (match, quote, modulePath) => {
  const moduleUrl = new URL(modulePath, location.href);
  moduleUrl.searchParams.set('v', '47');
  return "from '" + moduleUrl.href + "'";
});

${marker}`);
const blob = new Blob([wrapperSource], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
try {
  await import(url);
} finally {
  URL.revokeObjectURL(url);
}
