const VERSION = '58';
const response = await fetch(`./sale-cancellation-modal-v49.js?v=${VERSION}`, { cache: 'no-store' });
if (!response.ok) throw new Error('Não foi possível carregar o modal de cancelamento.');
let source = await response.text();

const calculationPattern = /  const priorRefunds = \(sale\?\.cancellations \|\| \[\]\)\.reduce\([\s\S]*?  const estimatedRefund = money\(effectiveReceived \* fraction\);/;
if (!calculationPattern.test(source)) throw new Error('Não foi possível preparar o cálculo proporcional do cancelamento.');
source = source.replace(calculationPattern, `  const isDirectSale = sale?.saleType === 'direct';
  const isCardSale = isDirectSale && (sale?.paymentMethod === 'credit' || sale?.paymentMethod === 'debit');
  const customerPaysCardFee = isCardSale && sale?.feeConfig?.type === 'com_juros';
  const priorCustomerRefunds = (sale?.cancellations || []).reduce((sum, event) => sum + num(event.customerRefundAmount ?? event.refundAmount), 0);
  const priorStoreImpacts = (sale?.cancellations || []).reduce((sum, event) => sum + num(event.storeImpactAmount ?? event.refundAmount), 0);
  const effectiveReceived = Math.max(0, getReceivedCash(sale) - priorCustomerRefunds);
  const currentCustomerPaid = money(sale?.totalPrice);
  const originalStoreNet = sale?.netReceived !== undefined && sale?.netReceived !== null && sale?.netReceived !== '' ? money(sale.netReceived) : currentCustomerPaid;
  const currentStoreNet = Math.max(0, money(originalStoreNet - priorStoreImpacts));
  const currentContractValue = currentCustomerPaid;
  const remainingContractValue = mode === 'total' ? 0 : money(currentContractValue * (1 - fraction));
  const customerRefundAmount = isDirectSale
    ? (mode === 'total' ? currentCustomerPaid : money(currentCustomerPaid * fraction))
    : (mode === 'total' ? money(effectiveReceived) : money(Math.max(0, effectiveReceived - remainingContractValue)));
  const storeImpactAmount = isDirectSale
    ? (mode === 'total' ? currentStoreNet : money(currentStoreNet * fraction))
    : customerRefundAmount;
  const getCancelUnitCost = item => {
    const storedUnit = num(item?.unitCost);
    if (storedUnit > 0) return storedUnit;
    const quantity = Math.max(1, parseInt(item?.quantity, 10) || 1);
    return money(num(item?.cost) / quantity);
  };
  const canceledCostAmount = money(selected.reduce((sum, row) => sum + getCancelUnitCost(row.item) * row.quantity, 0));
  const canceledContractValue = money(Math.max(0, currentContractValue - remainingContractValue));
  const profitImpactAmount = money((isDirectSale ? storeImpactAmount : canceledContractValue) - canceledCostAmount);
  const estimatedRefund = customerRefundAmount;
  const remainingToPay = isDirectSale ? 0 : mode === 'total' ? 0 : money(Math.max(0, remainingContractValue - effectiveReceived));`);

const oldSummary = `        h('section', { className: 'sale47-summary' },
          h('div', null, h('span', null, 'Produtos selecionados'), h('strong', null, formatCurrency(selectedAmount))),
          h('div', null, h('span', null, 'Saída estimada no Financeiro'), h('strong', null, estimatedRefund > 0 ? formatCurrency(estimatedRefund) : 'Sem valor recebido'))
        ),`;
const newSummary = `        h('section', { className: 'sale47-summary' },
          h('div', null, h('span', null, 'Produtos selecionados'), h('strong', null, formatCurrency(selectedAmount))),
          isDirectSale
            ? h(React.Fragment, null,
                h('div', null, h('span', null, 'Estorno ao cliente'), h('strong', null, formatCurrency(customerRefundAmount))),
                h('div', null, h('span', null, 'Impacto líquido da loja'), h('strong', null, formatCurrency(storeImpactAmount))),
                h('div', null, h('span', null, 'Lucro referente ao cancelamento'), h('strong', null, formatCurrency(profitImpactAmount)))
              )
            : h(React.Fragment, null,
                h('div', null, h('span', null, estimatedRefund > 0 ? 'Estorno previsto' : 'Saldo que continuará a pagar'), h('strong', null, estimatedRefund > 0 ? formatCurrency(estimatedRefund) : remainingToPay > 0 ? formatCurrency(remainingToPay) : 'Sem saldo')),
                h('div', null, h('span', null, 'Lucro estimado cancelado'), h('strong', null, formatCurrency(profitImpactAmount)))
              )
        ),`;
if (!source.includes(oldSummary)) throw new Error('Não foi possível atualizar o resumo do cancelamento.');
source = source.replace(oldSummary, newSummary);

const oldImpact = `          h('p', null, sale.saleType === 'direct'
            ? 'O sistema registrará uma saída proporcional ao valor que efetivamente entrou nesta venda.'
            : 'O valor já recebido será estornado proporcionalmente e as parcelas ainda em aberto serão reduzidas na mesma proporção.')`;
const newImpact = `          h('p', null, isDirectSale
            ? isCardSale
              ? customerPaysCardFee
                ? 'O cliente receberá o valor proporcional dos produtos mais a parcela proporcional da taxa que ele pagou. O lucro cancelado considera somente o líquido que entrou para a loja menos o custo dos produtos cancelados.'
                : 'O cliente receberá o valor proporcional que pagou pelos produtos. O lucro cancelado considera o líquido após a taxa da administradora menos o custo dos produtos cancelados.'
              : 'O lucro cancelado é calculado separadamente pelo valor líquido da parte cancelada menos o custo dos produtos.'
            : estimatedRefund > 0
              ? 'Somente o valor pago acima do que permaneceu na compra será estornado. O lucro estimado dos produtos cancelados também será retirado do resultado.'
              : remainingToPay > 0
                ? 'Não haverá estorno. O saldo restante será redistribuído entre as parcelas em aberto e o lucro estimado dos produtos cancelados será retirado do resultado.'
                : 'Não haverá novo saldo nem estorno financeiro; o lucro dos produtos cancelados deixa de compor o resultado.')`;
if (!source.includes(oldImpact)) throw new Error('Não foi possível atualizar a explicação do cancelamento.');
source = source.replace(oldImpact, newImpact);

source = source.replace(/from\s+(['"])(\.\/[^'"]+)\1/g, (match, quote, path) => {
  const url = new URL(path, location.href);
  url.search = `?v=${VERSION}`;
  return `from '${url.href}'`;
});

const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
let module;
try {
  module = await import(blobUrl);
} finally {
  URL.revokeObjectURL(blobUrl);
}
if (typeof module?.SaleCancellationModal !== 'function') throw new Error('O modal de cancelamento v58 não foi exportado corretamente.');
export const SaleCancellationModal = module.SaleCancellationModal;
