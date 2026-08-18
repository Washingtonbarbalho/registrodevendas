const VERSION = '59';
const nativeFetch = globalThis.fetch;

const shouldPatchBaseModals = input => {
  try {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    return !!raw && new URL(raw, location.href).pathname.endsWith('/modals.js');
  } catch { return false; }
};

const patchBaseModals = source => {
  const totalInstMarker = "    const totalInst = sale.installmentsCount || 0;";
  if (source.includes(totalInstMarker) && !source.includes('const formatRecordMoment =')) {
    source = source.replace(totalInstMarker, `${totalInstMarker}\n    const formatRecordMoment = (dateValue, timestampValue) => {\n        const formattedDate = formatDate(dateValue);\n        if (!timestampValue) return formattedDate + ' · --:--';\n        const parsed = new Date(timestampValue);\n        return Number.isNaN(parsed.getTime()) ? formattedDate + ' · --:--' : formattedDate + ' · ' + parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });\n    };`);
  }
  source = source.replace(
    "if (inst.paid && inst.paidAt) paidDisplayDate = formatDate(inst.paidAt);",
    "if (inst.paid && inst.paidAt) { const latestPayment = Array.isArray(inst.history) && inst.history.length ? inst.history[inst.history.length - 1] : null; paidDisplayDate = formatRecordMoment(inst.paidAt, latestPayment?.timestamp || inst.paidAtDateTime); }"
  );
  source = source.replace(
    "h.type === 'abatement' ? 'Abatimento autom.' : formatDate(h.date)",
    "h.type === 'abatement' ? 'Abatimento autom.' : formatRecordMoment(h.date, h.timestamp)"
  );
  return source;
};

globalThis.fetch = async (input, init) => {
  const response = await nativeFetch.call(globalThis, input, init);
  if (!shouldPatchBaseModals(input) || !response.ok) return response;
  const source = patchBaseModals(await response.text());
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/javascript; charset=utf-8');
  return new Response(source, { status: response.status, statusText: response.statusText, headers });
};

const response = await nativeFetch.call(globalThis, `./modals-fixed-v49.js?v=${VERSION}`, { cache: 'no-store' });
if (!response.ok) throw new Error('Não foi possível carregar os modais da versão anterior.');
let source = await response.text();
source = source
  .replaceAll("sale.saleDateTime || (sale.saleDate + 'T12:00:00.000Z')", "sale.saleDateTime || sale.saleDate")
  .replaceAll("event.createdAt || (event.date ? event.date + 'T12:00:01.000Z' : getCanceledDate(sale))", "event.createdAt || event.date || getCanceledDate(sale)");

const oldCancellationAmounts = `                                React.createElement('div', { className: "text-right" },
                                    React.createElement('p', { className: "text-[10px] uppercase font-bold text-slate-400" }, "Estorno financeiro"),
                                    React.createElement('p', { className: "text-sm font-black text-red-600" }, (Number(event.refundAmount) || 0) > 0 ? formatCurrency(event.refundAmount) : 'Sem estorno')
                                )`;
const newCancellationAmounts = `                                React.createElement('div', { className: "text-right space-y-1" },
                                    React.createElement('div', null,
                                        React.createElement('p', { className: "text-[9px] uppercase font-bold text-slate-400" }, "Estorno ao cliente"),
                                        React.createElement('p', { className: "text-xs font-black text-red-600" }, (Number(event.customerRefundAmount ?? event.refundAmount) || 0) > 0 ? formatCurrency(event.customerRefundAmount ?? event.refundAmount) : 'Sem estorno')
                                    ),
                                    React.createElement('div', null,
                                        React.createElement('p', { className: "text-[9px] uppercase font-bold text-slate-400" }, "Impacto líquido da loja"),
                                        React.createElement('p', { className: "text-xs font-black text-orange-600" }, formatCurrency(Number(event.storeImpactAmount ?? event.refundAmount) || 0))
                                    ),
                                    event.profitImpactAmount !== undefined && React.createElement('div', null,
                                        React.createElement('p', { className: "text-[9px] uppercase font-bold text-slate-400" }, "Lucro cancelado"),
                                        React.createElement('p', { className: "text-xs font-black text-violet-700" }, formatCurrency(Number(event.profitImpactAmount) || 0))
                                    )
                                )`;
if (!source.includes(oldCancellationAmounts)) throw new Error('Não foi possível detalhar os valores do cancelamento da venda.');
source = source.replace(oldCancellationAmounts, newCancellationAmounts);

const observationAnchor = `                cancellationEvents.length > 0 && React.createElement('div', { className: "desktop-span-full bg-red-50/60 p-4 rounded-xl border border-red-200 relative z-10 space-y-3" },`;
const observationBlock = `                sale.notes && React.createElement('div', { className: "desktop-span-full bg-amber-50 p-4 rounded-xl border border-amber-200 relative z-10" },
                    React.createElement('p', { className: "text-[10px] uppercase font-black tracking-wide text-amber-600 mb-1" }, "Observações da venda"),
                    React.createElement('p', { className: "text-sm text-slate-700 whitespace-pre-wrap leading-relaxed" }, sale.notes)
                ),

` + observationAnchor;
if (!source.includes(observationAnchor)) throw new Error('Não foi possível inserir as observações no detalhe da venda.');
source = source.replace(observationAnchor, observationBlock);

const blob = new Blob([source], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
let finalModule;
try { finalModule = await import(url); }
finally { globalThis.fetch = nativeFetch; URL.revokeObjectURL(url); }

const required = ['UserProfileModal','CustomerFormModal','EditInstallmentModal','SaleDetailsModal','PixCodeModal','InstallmentListModal','PaymentConfirmationModal','ConfirmModal','WhatsAppChooserModal','ProductModal','StockMovementModal','ProductDetailsModal'];
for (const key of required) {
  if (typeof finalModule?.[key] !== 'function') throw new Error('Modal não exportado corretamente: ' + key);
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
