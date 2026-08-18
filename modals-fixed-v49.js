const VERSION = '49';
const nativeFetch = globalThis.fetch;

const patchSaleDetailsSource = source => {
  const totalInstMarker = "    const totalInst = sale.installmentsCount || 0;";
  if (!source.includes(totalInstMarker)) throw new Error('Não foi possível preparar o histórico de cancelamentos da venda.');
  source = source.replace(totalInstMarker, `${totalInstMarker}
    const cancellationEvents = Array.isArray(sale.cancellations) ? sale.cancellations : [];
    const formatDetailedDateTime = (dateValue, timestampValue) => {
        const datePart = String(dateValue || timestampValue || '').split('T')[0];
        let timePart = '';
        const timeSource = timestampValue || (String(dateValue || '').includes('T') ? dateValue : '');
        if (timeSource) {
            const parsed = new Date(timeSource);
            if (!Number.isNaN(parsed.getTime())) timePart = parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
        return datePart ? formatDate(datePart) + (timePart ? ' às ' + timePart : '') : '--/--/----';
    };`);

  const saleDateMarker = `React.createElement('p', { className: "text-sm text-slate-500" }, formatDate(sale.saleDate))`;
  if (!source.includes(saleDateMarker)) throw new Error('Não foi possível exibir o horário nos detalhes da venda.');
  source = source.replace(saleDateMarker, `React.createElement('p', { className: "text-sm text-slate-500" }, formatDetailedDateTime(sale.saleDate, sale.saleDateTime))`);

  const cancelReasonMarker = `                sale.status === 'canceled' && sale.cancelReason && React.createElement('div', { className: "desktop-span-full bg-red-50 p-3 rounded-lg border border-red-100 relative z-10" },
                    React.createElement('p', { className: "text-[10px] uppercase font-bold text-red-500 mb-1" }, "Motivo do Cancelamento:"),
                    React.createElement('p', { className: "text-sm text-red-700 italic" }, \`"\${sale.cancelReason}"\`)
                ),`;
  if (!source.includes(cancelReasonMarker)) throw new Error('Não foi possível inserir os detalhes dos cancelamentos.');

  const cancellationHistoryBlock = `${cancelReasonMarker}

                cancellationEvents.length > 0 && React.createElement('div', { className: "desktop-span-full bg-red-50/60 p-4 rounded-xl border border-red-200 relative z-10 space-y-3" },
                    React.createElement('div', { className: "flex items-center justify-between gap-3" },
                        React.createElement('div', null,
                            React.createElement('p', { className: "text-[10px] uppercase font-black tracking-wide text-red-500" }, "Histórico de cancelamentos"),
                            React.createElement('p', { className: "text-xs text-slate-500 mt-0.5" }, cancellationEvents.length + (cancellationEvents.length === 1 ? ' ocorrência registrada' : ' ocorrências registradas'))
                        )
                    ),
                    cancellationEvents.slice().sort((a, b) => String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || ''))).map((event, eventIndex) =>
                        React.createElement('div', { key: event.id || eventIndex, className: "bg-white rounded-xl border border-red-100 p-3 space-y-2 shadow-sm" },
                            React.createElement('div', { className: "flex flex-wrap items-start justify-between gap-2" },
                                React.createElement('div', null,
                                    React.createElement('p', { className: "text-sm font-black text-slate-800" }, event.type === 'partial' ? 'Cancelamento parcial' : 'Cancelamento total'),
                                    React.createElement('p', { className: "text-xs text-slate-500" }, formatDetailedDateTime(event.date, event.createdAt))
                                ),
                                React.createElement('div', { className: "text-right" },
                                    React.createElement('p', { className: "text-[10px] uppercase font-bold text-slate-400" }, "Estorno financeiro"),
                                    React.createElement('p', { className: "text-sm font-black text-red-600" }, (Number(event.refundAmount) || 0) > 0 ? formatCurrency(event.refundAmount) : 'Sem estorno')
                                )
                            ),
                            event.reason && React.createElement('p', { className: "text-xs text-red-700 bg-red-50 rounded-lg px-2.5 py-2" }, React.createElement('strong', null, "Motivo: "), event.reason),
                            Array.isArray(event.items) && event.items.length > 0 && React.createElement('div', { className: "border-t border-slate-100 pt-2 space-y-1.5" },
                                event.items.map((cancelItem, itemIndex) => React.createElement('div', { key: (cancelItem.productId || cancelItem.productName || 'item') + '-' + itemIndex, className: "flex items-center justify-between gap-3 text-xs" },
                                    React.createElement('span', { className: "text-slate-600" }, (cancelItem.quantity || 0) + 'x ' + (cancelItem.productName || 'Produto')),
                                    React.createElement('span', { className: "font-bold text-slate-800" }, formatCurrency(Number(cancelItem.amount) || ((Number(cancelItem.unitPrice) || 0) * (Number(cancelItem.quantity) || 0))))
                                ))
                            ),
                            (Number(event.canceledContractValue) || 0) > 0 && React.createElement('div', { className: "flex justify-between gap-3 border-t border-slate-100 pt-2 text-xs" },
                                React.createElement('span', { className: "text-slate-500" }, "Valor contratual cancelado"),
                                React.createElement('strong', { className: "text-slate-800" }, formatCurrency(event.canceledContractValue))
                            )
                        )
                    )
                ),`;
  return source.replace(cancelReasonMarker, cancellationHistoryBlock);
};

const shouldPatchModals = input => {
  try {
    const rawUrl = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    if (!rawUrl) return false;
    return new URL(rawUrl, location.href).pathname.endsWith('/modals.js');
  } catch {
    return false;
  }
};

const baseResponse = await nativeFetch.call(globalThis, `./modals-fixed.js?v=${VERSION}`, { cache: 'no-store' });
if (!baseResponse.ok) throw new Error('Não foi possível carregar os modais-base (' + baseResponse.status + ').');
let wrapperSource = await baseResponse.text();

const historyStart = '    const combinedHistory = useMemo(() => {';
const historyEnd = '    if (!isOpen || !product) return null;';
const historyStartIndex = wrapperSource.indexOf(historyStart);
const historyEndIndex = wrapperSource.indexOf(historyEnd, historyStartIndex + historyStart.length);
if (historyStartIndex < 0 || historyEndIndex < 0) throw new Error('Não foi possível preparar o histórico de movimentação dos produtos.');

const newCombinedHistory = `    const combinedHistory = useMemo(() => {
        const history = [];
        if (!product) return history;

        if (Array.isArray(product.movements)) {
            product.movements.forEach(movement => {
                const quantity = toNumber(movement.quantity);
                history.push({
                    id: movement.id,
                    date: movement.date,
                    type: movement.type,
                    qty: quantity,
                    isEntry: ['compra', 'ajuste_entrada', 'devolucao'].includes(movement.type),
                    totalValue: quantity * toNumber(movement.unitCost),
                    notes: movement.notes
                });
            });
        }

        if (Array.isArray(salesHistory)) {
            salesHistory.forEach(sale => {
                const itemMatch = sale.items?.find(item => item.productId === product.id);
                if (itemMatch) {
                    const quantity = toNumber(itemMatch.quantity);
                    const storedLineTotal = toNumber(itemMatch.price);
                    const storedUnitPrice = toNumber(itemMatch.unitPrice);
                    const lineTotal = storedLineTotal > 0 ? storedLineTotal : quantity * (storedUnitPrice || toNumber(product.salePrice));
                    history.push({
                        id: 'sale-' + sale.id,
                        date: sale.saleDateTime || (sale.saleDate + 'T12:00:00.000Z'),
                        type: 'venda',
                        qty: quantity,
                        isEntry: false,
                        totalValue: lineTotal,
                        notes: 'Venda p/ ' + (sale.customerName?.split(' ')[0] || 'cliente')
                    });
                }

                const cancellationEvents = Array.isArray(sale.cancellations) ? sale.cancellations : [];
                let detailedCancellationFound = false;
                cancellationEvents.forEach((event, eventIndex) => {
                    (event.items || []).filter(cancelItem => cancelItem.productId === product.id).forEach((cancelItem, itemIndex) => {
                        detailedCancellationFound = true;
                        const quantity = toNumber(cancelItem.quantity);
                        history.push({
                            id: 'cancel-' + sale.id + '-' + (event.id || eventIndex) + '-' + itemIndex,
                            date: event.createdAt || (event.date ? event.date + 'T12:00:01.000Z' : getCanceledDate(sale)),
                            type: 'cancelamento',
                            qty: quantity,
                            isEntry: true,
                            totalValue: toNumber(cancelItem.amount) || quantity * toNumber(cancelItem.unitPrice),
                            notes: (event.type === 'partial' ? 'Cancelamento parcial' : 'Venda cancelada') + (event.reason ? ' · ' + event.reason : '')
                        });
                    });
                });

                if (!detailedCancellationFound && sale.status === 'canceled' && itemMatch) {
                    const quantity = toNumber(itemMatch.quantity);
                    const lineTotal = toNumber(itemMatch.price) || quantity * (toNumber(itemMatch.unitPrice) || toNumber(product.salePrice));
                    history.push({
                        id: 'cancel-' + sale.id,
                        date: getCanceledDate(sale),
                        type: 'cancelamento',
                        qty: quantity,
                        isEntry: true,
                        totalValue: lineTotal,
                        notes: 'Venda Cancelada'
                    });
                }
            });
        }

        return history.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [product, salesHistory]);

`;
wrapperSource = wrapperSource.slice(0, historyStartIndex) + newCombinedHistory + wrapperSource.slice(historyEndIndex);

wrapperSource = wrapperSource.replace(/from\s+(['"])(\.\/[^'"]+)\1/g, (match, quote, modulePath) => {
  const moduleUrl = new URL(modulePath, location.href);
  moduleUrl.searchParams.set('v', VERSION);
  return "from '" + moduleUrl.href + "'";
});

globalThis.fetch = async (input, init) => {
  const response = await nativeFetch.call(globalThis, input, init);
  if (!shouldPatchModals(input) || !response.ok) return response;
  const patchedSource = patchSaleDetailsSource(await response.text());
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/javascript; charset=utf-8');
  return new Response(patchedSource, { status: response.status, statusText: response.statusText, headers });
};

const blob = new Blob([wrapperSource], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
let finalModule;
try {
  finalModule = await import(url);
} finally {
  globalThis.fetch = nativeFetch;
  URL.revokeObjectURL(url);
}

const required = ['UserProfileModal','CustomerFormModal','EditInstallmentModal','SaleDetailsModal','PixCodeModal','InstallmentListModal','PaymentConfirmationModal','ConfirmModal','WhatsAppChooserModal','ProductModal','StockMovementModal','ProductDetailsModal'];
for (const key of required) {
  if (typeof finalModule?.[key] !== 'function') throw new Error('O modal ' + key + ' não foi exportado corretamente.');
}

export const UserProfileModal = finalModule.UserProfileModal;
export const CustomerFormModal = finalModule.CustomerFormModal;
export const EditInstallmentModal = finalModule.EditInstallmentModal;
export const SaleDetailsModal = finalModule.SaleDetailsModal;
export const PixCodeModal = finalModule.PixCodeModal;
export const InstallmentListModal = finalModule.InstallmentListModal;
export const PaymentConfirmationModal = finalModule.PaymentConfirmationModal;
export const ConfirmModal = finalModule.ConfirmModal;
export const WhatsAppChooserModal = finalModule.WhatsAppChooserModal;
export const ProductModal = finalModule.ProductModal;
export const StockMovementModal = finalModule.StockMovementModal;
export const ProductDetailsModal = finalModule.ProductDetailsModal;
