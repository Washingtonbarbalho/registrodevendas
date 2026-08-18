const VERSION = '65';
const nativeFetch = globalThis.fetch;

const shouldPatchBase = input => {
  try {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    return !!raw && new URL(raw, location.href).pathname.endsWith('/modals.js');
  } catch { return false; }
};

const patchBase = source => {
  const chooserSignature = "export const WhatsAppChooserModal = ({ isOpen, onClose, phone, message }) => {";
  const chooserReplacement = "export const WhatsAppChooserModal = ({ isOpen, onClose, phone, message, onPdf }) => {";
  if (!source.includes(chooserSignature)) throw new Error('Não foi possível preparar o envio de PDF nas mensagens.');
  source = source.replace(chooserSignature, chooserReplacement);

  const copyButton = `                React.createElement('button', { onClick: () => handleOpen('copy'), className: "w-full p-4 bg-slate-100 text-slate-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200" }, React.createElement(Copy, { size: 20 }), "Copiar Mensagem")`;
  const chooserButtons = `${copyButton},\n                onPdf && React.createElement('button', { onClick: onPdf, className: "w-full p-4 bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 shadow-sm" }, React.createElement('span', { className: "text-[10px] font-black border border-white/40 rounded px-1.5 py-0.5" }, "PDF"), "Compartilhar PDF")`;
  if (!source.includes(copyButton)) throw new Error('Não foi possível inserir a opção de PDF nas mensagens.');
  source = source.replace(copyButton, chooserButtons);

  const detailsSignature = "export const SaleDetailsModal = ({ isOpen, onClose, sale, onPay, onEdit, onDeletePayment, onCancelSale, onDeleteSale, onOpenWA, onShowPixCode, hasPixSetup }) => {";
  const detailsReplacement = "export const SaleDetailsModal = ({ isOpen, onClose, sale, onPay, onEdit, onDeletePayment, onCancelSale, onDeleteSale, onOpenWA, onShowPixCode, hasPixSetup, onGeneratePdf }) => {";
  if (!source.includes(detailsSignature)) throw new Error('Não foi possível preparar o PDF no detalhe da venda.');
  source = source.replace(detailsSignature, detailsReplacement);

  const waHeaderButton = `                    sale.status !== 'canceled' && React.createElement('button', { onClick: () => onOpenWA(waType, sale, null, null), className: "p-2 hover:bg-green-100 rounded-full transition-colors text-green-600", title: waTitle }, React.createElement(MessageCircle, { size: 20 })),`;
  const pdfHeaderButton = `                    onGeneratePdf && React.createElement('button', { onClick: onGeneratePdf, className: "px-2.5 py-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-700 text-xs font-black", title: "Gerar ou compartilhar PDF" }, "PDF"),\n${waHeaderButton}`;
  if (!source.includes(waHeaderButton)) throw new Error('Não foi possível inserir o PDF no detalhe da venda.');
  source = source.replace(waHeaderButton, pdfHeaderButton);
  return source;
};

globalThis.fetch = async (input, init) => {
  const response = await nativeFetch.call(globalThis, input, init);
  if (!shouldPatchBase(input) || !response.ok) return response;
  const source = patchBase(await response.text());
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/javascript; charset=utf-8');
  return new Response(source, { status: response.status, statusText: response.statusText, headers });
};

let finalModule;
try {
  finalModule = await import(new URL('./modals-fixed-v59.js?v=' + VERSION, location.href).href);
} finally {
  globalThis.fetch = nativeFetch;
}

const required = ['UserProfileModal','CustomerFormModal','EditInstallmentModal','SaleDetailsModal','PixCodeModal','InstallmentListModal','PaymentConfirmationModal','ConfirmModal','WhatsAppChooserModal','ProductModal','StockMovementModal','ProductDetailsModal'];
for (const key of required) if (typeof finalModule?.[key] !== 'function') throw new Error('Modal não exportado corretamente: ' + key);
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
