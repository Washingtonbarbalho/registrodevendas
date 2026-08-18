const VERSION = '50';

const response = await fetch('./aba-financeiro-fixed-v47.js?v=50', { cache: 'no-store' });
if (!response.ok) throw new Error('Não foi possível carregar o Financeiro base (' + response.status + ').');
let wrapperSource = await response.text();

const replaceWrapperRegexRequired = (regex, replacement, label) => {
  const before = wrapperSource;
  wrapperSource = wrapperSource.replace(regex, replacement);
  if (wrapperSource === before) throw new Error('Não foi possível preparar ' + label + '.');
};

replaceWrapperRegexRequired(
  /const paymentDate = cleanDate\(deferred \? \(movement\.financialPaidAt \|\| movement\.paymentDueDate\) : movement\.date\);\s*const cancellationEvents = getPurchaseCancellationEvents\(movement\);\s*const canceledQuantity = getPurchaseCanceledQuantity\(movement\);/,
  `const paymentDate = cleanDate(deferred ? (movement.financialPaidAt || movement.paymentDueDate) : movement.date);\n      const cancellationEvents = getPurchaseCancellationEvents(movement);\n      const canceledBeforePaymentAmount = cancellationEvents.filter(event => event.hadCashOut === false).reduce((sum, event) => sum + money(event.amount || (num(event.quantity) * unitCost)), 0);\n      const paidPurchaseAmount = money(Math.max(0, originalAmount - canceledBeforePaymentAmount));\n      const canceledQuantity = getPurchaseCanceledQuantity(movement);`,
  'compras parcialmente canceladas antes do pagamento'
);

replaceWrapperRegexRequired(
  /amount:\s*originalAmount,\s*\n\s*description:\s*'Compra de mercadoria · ' \+ product\.name,/,
  `amount: paidPurchaseAmount,\n          description: 'Compra de mercadoria · ' + product.name,`,
  'o valor efetivamente pago da compra'
);

replaceWrapperRegexRequired(
  /const fullyCanceled = remainingQuantity <= 0;\s*const partiallyCanceled = canceledQuantity > 0 && !fullyCanceled;\s*const value = movement\.financialPaid \? originalValue : money\(remainingQuantity \* unitCost\);\s*const cancellationEvents = getPurchaseCancellationEvents\(movement\);/,
  `const fullyCanceled = remainingQuantity <= 0;\n      const partiallyCanceled = canceledQuantity > 0 && !fullyCanceled;\n      const cancellationEvents = getPurchaseCancellationEvents(movement);\n      const canceledBeforePaymentAmount = cancellationEvents.filter(event => event.hadCashOut === false).reduce((sum, event) => sum + money(event.amount || (num(event.quantity) * unitCost)), 0);\n      const paidValue = money(Math.max(0, originalValue - canceledBeforePaymentAmount));\n      const value = movement.financialPaid ? paidValue : money(remainingQuantity * unitCost);`,
  'a conta a pagar proporcional'
);

const finalWrapperMarker = `const blob = new Blob([source], { type: 'text/javascript' });\nconst url = URL.createObjectURL(blob);\ntry {\n  await import(url);\n} finally {\n  URL.revokeObjectURL(url);\n}`;

if (!wrapperSource.includes(finalWrapperMarker)) {
  throw new Error('Não foi possível preparar o módulo final do Financeiro.');
}

const finalWrapperReplacement = String.raw`
const replaceSourceRegexRequired = (regex, replacement, label) => {
  const before = source;
  source = source.replace(regex, replacement);
  if (source === before) throw new Error('Não foi possível preparar ' + label + '.');
};

const replaceSourceRegexCount = (regex, replacement, minimum, label) => {
  let count = 0;
  source = source.replace(regex, (...args) => {
    count += 1;
    return typeof replacement === 'function' ? replacement(...args) : replacement;
  });
  if (count < minimum) throw new Error('Não foi possível preparar ' + label + '.');
};

const moneyHelperMarker = "const money = value => Math.round((num(value) + Number.EPSILON) * 100) / 100;";
if (!source.includes(moneyHelperMarker)) throw new Error('Não foi possível preparar os utilitários de data e hora.');
source = source.replace(moneyHelperMarker, moneyHelperMarker + "\n" + [
  "const combineDateAndTime = (dateValue, timestampValue) => {",
  "  const datePart = cleanDate(dateValue);",
  "  if (!datePart) return '';",
  "  let timePart = '';",
  "  if (timestampValue) {",
  "    const parsed = new Date(timestampValue);",
  "    if (!Number.isNaN(parsed.getTime())) timePart = parsed.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });",
  "  }",
  "  return datePart + 'T' + (timePart || '00:00:00');",
  "};",
  "const movementSortKey = item => {",
  "  const raw = item.dateTime || (item.date ? item.date + 'T00:00:00' : '');",
  "  if (!raw) return 0;",
  "  const parsed = new Date(raw);",
  "  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();",
  "};",
  "const formatMovementDateTime = item => {",
  "  const raw = item.dateTime;",
  "  if (raw) {",
  "    const parsed = new Date(raw);",
  "    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString('pt-BR') + ' · ' + parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });",
  "  }",
  "  return formatDate(item.date) + ' · --:--';",
  "};"
].join("\n"));

replaceSourceRegexCount(
  /^(\s*)date:\s*cleanDate\(sale\.saleDate\),\s*$/gm,
  (match, indent) => match + "\n" + indent + "dateTime: sale.saleDateTime || '',",
  2,
  'o horário das vendas a prazo e no caixa'
);

replaceSourceRegexRequired(
  /^(\s*)date,\s*\n(\s*)amount,\s*$/m,
  (match, dateIndent, amountIndent) => dateIndent + "date,\n" + amountIndent + "dateTime: item.timestamp || '',\n" + amountIndent + 'amount,',
  'o horário dos recebimentos de parcelas'
);

replaceSourceRegexRequired(
  /^(\s*)date:\s*cleanDate\(installment\.paidAt\),\s*$/m,
  (match, indent) => match + "\n" + indent + "dateTime: installment.paidAtDateTime || '',",
  'o horário dos pagamentos antigos sem histórico'
);

replaceSourceRegexCount(
  /^(\s*)date:\s*cleanDate\(event\.date\),\s*$/gm,
  (match, indent) => match + "\n" + indent + "dateTime: combineDateAndTime(event.date, event.createdAt),",
  2,
  'o horário dos estornos de vendas e compras'
);

replaceSourceRegexRequired(
  /^(\s*)date:\s*paymentDate,\s*$/m,
  (match, indent) => match + "\n" + indent + "dateTime: deferred ? (movement.financialPaidAtDateTime || '') : (movement.date || ''),",
  'o horário das compras de mercadoria'
);

replaceSourceRegexRequired(
  /^(\s*)date:\s*cleanDate\(item\.date\),\s*$/m,
  (match, indent) => match + "\n" + indent + "dateTime: item.dateTime || '',",
  'o horário dos lançamentos manuais'
);

replaceSourceRegexRequired(
  /^(\s*)date:\s*cleanDate\(item\.paidAt\),\s*$/m,
  (match, indent) => match + "\n" + indent + "dateTime: item.paidAtDateTime || '',",
  'o horário das contas manuais quitadas'
);

replaceSourceRegexRequired(
  /\.sort\(\(a,\s*b\)\s*=>\s*b\.date\.localeCompare\(a\.date\)\s*\|\|\s*b\.id\.localeCompare\(a\.id\)\)/,
  ".sort((a, b) => movementSortKey(b) - movementSortKey(a) || b.id.localeCompare(a.id))",
  'a ordenação cronológica das movimentações'
);

replaceSourceRegexRequired(
  /^(\s*)date:\s*form\.date,\s*$/m,
  (match, indent) => match + "\n" + indent + "dateTime: combineDateAndTime(form.date, new Date().toISOString()),",
  'o horário dos lançamentos financeiros manuais'
);

replaceSourceRegexRequired(
  /paidAt:\s*nextPaid \? getBrazilDateString\(\) : null/,
  "paidAt: nextPaid ? getBrazilDateString() : null, paidAtDateTime: nextPaid ? new Date().toISOString() : null",
  'o horário de quitação das contas manuais'
);

replaceSourceRegexRequired(
  /financialPaidAt:\s*nextPaid \? getBrazilDateString\(\) : null/,
  "financialPaidAt: nextPaid ? getBrazilDateString() : null, financialPaidAtDateTime: nextPaid ? new Date().toISOString() : null",
  'o horário de pagamento das compras'
);

replaceSourceRegexRequired(
  /formatDate\(item\.date\)/,
  'formatMovementDateTime(item)',
  'a exibição da data e hora nas movimentações'
);

source = source.replace(/from\s+(['\"])(\.\/[^'\"]+)\1/g, (match, quote, modulePath) => {
  const moduleUrl = new URL(modulePath, location.href);
  moduleUrl.searchParams.set('v', '50');
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
if (!financeModule || typeof financeModule.AbaFinanceiro !== 'function') throw new Error('O módulo Financeiro final não exportou AbaFinanceiro.');
export const AbaFinanceiro = financeModule.AbaFinanceiro;
`;

wrapperSource = wrapperSource.replace(finalWrapperMarker, finalWrapperReplacement);

const wrapperBlob = new Blob([wrapperSource], { type: 'text/javascript' });
const wrapperUrl = URL.createObjectURL(wrapperBlob);
let wrapperModule;
try {
  wrapperModule = await import(wrapperUrl);
} finally {
  URL.revokeObjectURL(wrapperUrl);
}

if (!wrapperModule || typeof wrapperModule.AbaFinanceiro !== 'function') {
  throw new Error('O loader Financeiro corrigido não recebeu o export AbaFinanceiro.');
}

export const AbaFinanceiro = wrapperModule.AbaFinanceiro;
