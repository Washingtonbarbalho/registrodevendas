const response = await fetch('./aba-financeiro-fixed-v47.js?v=49', { cache: 'no-store' });
if (!response.ok) throw new Error('Não foi possível carregar o Financeiro base (' + response.status + ').');
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
replaceWrapperRequired(automaticPaymentMarker, automaticPaymentReplacement, 'compras parcialmente canceladas antes do pagamento');

const expenseAmountMarker = `          amount: originalAmount,
          description: 'Compra de mercadoria · ' + product.name,`;
replaceWrapperRequired(expenseAmountMarker, `          amount: paidPurchaseAmount,
          description: 'Compra de mercadoria · ' + product.name,`, 'o valor efetivamente pago da compra');

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
replaceWrapperRequired(payableValueMarker, payableValueReplacement, 'a conta a pagar proporcional');

const finalWrapperMarker = `const blob = new Blob([source], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
try {
  await import(url);
} finally {
  URL.revokeObjectURL(url);
}`;

const finalWrapperReplacement = `const moneyHelperMarker = "const money = value => Math.round((num(value) + Number.EPSILON) * 100) / 100;";
replaceRequired(moneyHelperMarker, moneyHelperMarker + \`
const combineDateAndTime = (dateValue, timestampValue) => {
  const datePart = cleanDate(dateValue);
  if (!datePart) return '';
  let timePart = '';
  if (timestampValue) {
    const parsed = new Date(timestampValue);
    if (!Number.isNaN(parsed.getTime())) {
      timePart = parsed.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }
  return datePart + 'T' + (timePart || '00:00:00');
};
const movementSortKey = item => item.dateTime || (item.date ? item.date + 'T00:00:00' : '');
const formatMovementDateTime = item => {
  const raw = item.dateTime;
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('pt-BR') + ' · ' + parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
  }
  return formatDate(item.date) + ' · --:--';
};\`, 'os utilitários de data e hora');

replaceRequired(
\`      date: cleanDate(sale.saleDate),
      amount: money(sale.entryAmount),\`,
\`      date: cleanDate(sale.saleDate),
      dateTime: sale.saleDateTime || '',
      amount: money(sale.entryAmount),\`,
'o horário da entrada da venda a prazo'
);
replaceRequired(
\`          date,
          amount,
          description: \\\`Recebimento · \\\${sale.customerName || 'Cliente'}\\\`,\`,
\`          date,
          dateTime: item.timestamp || '',
          amount,
          description: \\\`Recebimento · \\\${sale.customerName || 'Cliente'}\\\`,\`,
'o horário dos recebimentos de parcelas'
);
replaceRequired(
\`        date: cleanDate(installment.paidAt),
        amount,
        description: \\\`Recebimento · \\\${sale.customerName || 'Cliente'}\\\`,\`,
\`        date: cleanDate(installment.paidAt),
        dateTime: installment.paidAtDateTime || '',
        amount,
        description: \\\`Recebimento · \\\${sale.customerName || 'Cliente'}\\\`,\`,
'o horário dos pagamentos antigos sem histórico'
);
replaceRequired(
\`          date: cleanDate(sale.saleDate),
          amount,
          description: 'Venda · ' + (sale.customerName || 'Venda avulsa'),\`,
\`          date: cleanDate(sale.saleDate),
          dateTime: sale.saleDateTime || '',
          amount,
          description: 'Venda · ' + (sale.customerName || 'Venda avulsa'),\`,
'o horário das vendas no caixa'
);
replaceRequired(
\`          date: cleanDate(event.date),
          amount,
          description: 'Estorno de venda · ' + (sale.customerName || 'Venda avulsa'),\`,
\`          date: cleanDate(event.date),
          dateTime: combineDateAndTime(event.date, event.createdAt),
          amount,
          description: 'Estorno de venda · ' + (sale.customerName || 'Venda avulsa'),\`,
'o horário dos estornos de venda'
);
replaceRequired(
\`          date: paymentDate,
          amount: paidPurchaseAmount,
          description: 'Compra de mercadoria · ' + product.name,\`,
\`          date: paymentDate,
          dateTime: deferred ? (movement.financialPaidAtDateTime || '') : (movement.date || ''),
          amount: paidPurchaseAmount,
          description: 'Compra de mercadoria · ' + product.name,\`,
'o horário das compras de mercadoria'
);
replaceRequired(
\`          date: cleanDate(event.date),
          amount,
          description: 'Estorno de compra · ' + product.name,\`,
\`          date: cleanDate(event.date),
          dateTime: combineDateAndTime(event.date, event.createdAt),
          amount,
          description: 'Estorno de compra · ' + product.name,\`,
'o horário dos estornos de compras'
);
replaceRequired(
\`      date: cleanDate(item.date),
      amount: money(item.value),\`,
\`      date: cleanDate(item.date),
      dateTime: item.dateTime || '',
      amount: money(item.value),\`,
'o horário dos lançamentos manuais'
);
replaceRequired(
\`      date: cleanDate(item.paidAt),
      amount: money(item.value),\`,
\`      date: cleanDate(item.paidAt),
      dateTime: item.paidAtDateTime || '',
      amount: money(item.value),\`,
'o horário das contas manuais pagas ou recebidas'
);
replaceRequired(
"    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), [automaticMovements, manualMovements, startDate, endDate, search]);",
"    .sort((a, b) => movementSortKey(b).localeCompare(movementSortKey(a)) || b.id.localeCompare(a.id)), [automaticMovements, manualMovements, startDate, endDate, search]);",
'a ordenação cronológica das movimentações'
);
replaceRequired(
\`            date: form.date,
            category: form.category,\`,
\`            date: form.date,
            dateTime: combineDateAndTime(form.date, new Date().toISOString()),
            category: form.category,\`,
'o horário dos lançamentos financeiros manuais'
);
replaceRequired(
"? { ...account, paid: nextPaid, paidAt: nextPaid ? getBrazilDateString() : null }",
"? { ...account, paid: nextPaid, paidAt: nextPaid ? getBrazilDateString() : null, paidAtDateTime: nextPaid ? new Date().toISOString() : null }",
'o horário de quitação das contas manuais'
);
replaceRequired(
"? { ...movement, financialPaid: nextPaid, financialPaidAt: nextPaid ? getBrazilDateString() : null }",
"? { ...movement, financialPaid: nextPaid, financialPaidAt: nextPaid ? getBrazilDateString() : null, financialPaidAtDateTime: nextPaid ? new Date().toISOString() : null }",
'o horário de pagamento das compras'
);
replaceRequired("formatDate(item.date)", "formatMovementDateTime(item)", 'a exibição da data e hora nas movimentações');

source = source.replace(/from\\s+(['\"])(\\.\\/[^'\"]+)\\1/g, (match, quote, modulePath) => {
  const moduleUrl = new URL(modulePath, location.href);
  moduleUrl.searchParams.set('v', '49');
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

replaceWrapperRequired(finalWrapperMarker, finalWrapperReplacement, 'o módulo Financeiro final com horários');

const wrapperBlob = new Blob([wrapperSource], { type: 'text/javascript' });
const wrapperUrl = URL.createObjectURL(wrapperBlob);
let wrapperModule;
try {
  wrapperModule = await import(wrapperUrl);
} finally {
  URL.revokeObjectURL(wrapperUrl);
}
if (!wrapperModule || typeof wrapperModule.AbaFinanceiro !== 'function') {
  throw new Error('O loader Financeiro v49 não recebeu o export AbaFinanceiro.');
}

export const AbaFinanceiro = wrapperModule.AbaFinanceiro;
