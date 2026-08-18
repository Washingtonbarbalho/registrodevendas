const response = await fetch('./sale-cancellation-modal-v49.js?v=52', { cache: 'no-store' });
if (!response.ok) throw new Error('Não foi possível carregar o modal de cancelamento.');
let source = await response.text();

const oldCalculation = "  const estimatedRefund = money(effectiveReceived * fraction);";
const newCalculation = `  const currentContractValue = money(sale?.totalPrice);\n  const remainingContractValue = mode === 'total' ? 0 : money(currentContractValue * (1 - fraction));\n  const estimatedRefund = mode === 'total' ? money(effectiveReceived) : money(Math.max(0, effectiveReceived - remainingContractValue));\n  const remainingToPay = mode === 'total' ? 0 : money(Math.max(0, remainingContractValue - effectiveReceived));`;
if (!source.includes(oldCalculation)) throw new Error('Não foi possível preparar a regra de estorno do cancelamento.');
source = source.replace(oldCalculation, newCalculation);
source = source.replace(
  "h('div', null, h('span', null, 'Saída estimada no Financeiro'), h('strong', null, estimatedRefund > 0 ? formatCurrency(estimatedRefund) : 'Sem valor recebido'))",
  "h('div', null, h('span', null, estimatedRefund > 0 ? 'Estorno previsto' : 'Saldo que continuará a pagar'), h('strong', null, estimatedRefund > 0 ? formatCurrency(estimatedRefund) : remainingToPay > 0 ? formatCurrency(remainingToPay) : 'Sem saldo'))"
);
source = source.replace(
  "'O valor já recebido será estornado proporcionalmente e as parcelas ainda em aberto serão reduzidas na mesma proporção.'",
  "estimatedRefund > 0 ? 'Houve pagamento acima do valor que permanecerá na compra. Somente esse excedente será estornado.' : remainingToPay > 0 ? 'Não haverá estorno. O valor que ainda falta pagar será redistribuído entre as parcelas em aberto.' : 'Não haverá novo valor a pagar nem estorno financeiro.'"
);
source = source.replace(/from\s+(['"])(\.\/[^'"]+)\1/g, (match, quote, path) => {
  const url = new URL(path, location.href); url.search = '?v=52'; return `from '${url.href}'`;
});

const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
let module;
try { module = await import(blobUrl); }
finally { URL.revokeObjectURL(blobUrl); }
if (typeof module?.SaleCancellationModal !== 'function') throw new Error('O modal de cancelamento v52 não foi exportado corretamente.');
export const SaleCancellationModal = module.SaleCancellationModal;
