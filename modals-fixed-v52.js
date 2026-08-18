const VERSION = '52';
const response = await fetch('./modals-fixed-v49.js?v=52', { cache: 'no-store' });
if (!response.ok) throw new Error('Não foi possível carregar os modais da versão anterior.');
let source = await response.text();
source = source
  .replaceAll("sale.saleDateTime || (sale.saleDate + 'T12:00:00.000Z')", "sale.saleDateTime || sale.saleDate")
  .replaceAll("event.createdAt || (event.date ? event.date + 'T12:00:01.000Z' : getCanceledDate(sale))", "event.createdAt || event.date || getCanceledDate(sale)");

const blob = new Blob([source], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
let finalModule;
try { finalModule = await import(url); }
finally { URL.revokeObjectURL(url); }

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
