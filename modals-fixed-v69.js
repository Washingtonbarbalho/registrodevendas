const VERSION = '69';
const nativeFetch = globalThis.fetch;

const shouldPatchBase = input => {
  try {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    return !!raw && new URL(raw, location.href).pathname.endsWith('/modals.js');
  } catch { return false; }
};

const patchPixPrivacy = source => {
  const componentImport = "import { MoneyInput } from './components.js';";
  if (!source.includes(componentImport)) throw new Error('Não foi possível carregar o gerador privado de QR Code.');
  source = source.replace(componentImport, componentImport + "\nimport QRCode from 'https://esm.sh/qrcode@1.5.4';\nimport { getHistoryCashAmount } from './financial-core-v70.js';");

  const paymentHistoryAmount = '                                    React.createElement(\'span\', { className: "font-bold" }, formatCurrency(h.amount))';
  if (!source.includes(paymentHistoryAmount)) throw new Error('Não foi possível apresentar o valor integral dos pagamentos excedentes.');
  source = source.replace(
    paymentHistoryAmount,
    '                                    React.createElement(\'span\', { className: "font-bold" }, formatCurrency(h.type === \'abatement\' ? h.amount : getHistoryCashAmount(h)))'
  );

  const startMarker = 'export const PixCodeModal = ({ isOpen, onClose, userProfile, amount, txid }) => {';
  const endMarker = 'export const UserProfileModal =';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error('Não foi possível proteger os dados do PIX.');

  const replacement = `export const PixCodeModal = ({ isOpen, onClose, userProfile, amount, txid }) => {
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [qrError, setQrError] = useState('');
    const payload = useMemo(() => {
        if (!userProfile?.pixKey) return '';
        return generatePixPayload(userProfile.pixKey, userProfile.pixType, userProfile.pixName, userProfile.city || "BRASIL", amount, txid);
    }, [userProfile?.pixKey, userProfile?.pixType, userProfile?.pixName, userProfile?.city, amount, txid]);

    useEffect(() => {
        let active = true;
        if (!isOpen || !payload) {
            setQrDataUrl('');
            setQrError('');
            return () => { active = false; };
        }
        setQrDataUrl('');
        setQrError('');
        QRCode.toDataURL(payload, { width: 220, margin: 1, errorCorrectionLevel: 'M' })
            .then(dataUrl => { if (active) setQrDataUrl(dataUrl); })
            .catch(error => {
                console.error('Erro ao gerar QR Code PIX localmente:', error);
                if (active) setQrError('Não foi possível montar o QR Code. Use o botão para copiar o código PIX.');
            });
        return () => { active = false; };
    }, [isOpen, payload]);

    if (!isOpen || !userProfile?.pixKey) return null;
    return React.createElement('div', { className: "app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[90] backdrop-blur-sm" },
        React.createElement('div', { className: "app-modal-panel bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in text-center" },
            React.createElement('div', { className: "flex justify-between items-center mb-4" },
                React.createElement('h3', { className: "text-lg font-bold text-slate-800 flex items-center gap-2" }, React.createElement(QrCode, { className: "text-emerald-500" }), "Receber via PIX"),
                React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-slate-100 rounded-full" }, React.createElement(X, { size: 20 }))
            ),
            React.createElement('div', { className: "bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col items-center" },
                qrDataUrl
                    ? React.createElement('img', { src: qrDataUrl, alt: "QR Code PIX", className: "mb-4 rounded-lg shadow-sm border border-emerald-200 w-44 h-44" })
                    : React.createElement('div', { className: "mb-4 rounded-lg border border-emerald-200 bg-white w-44 h-44 flex items-center justify-center p-4 text-xs text-slate-500" }, qrError || "Gerando QR Code com segurança..."),
                React.createElement('p', { className: "font-bold text-emerald-800 text-lg mb-3" }, formatCurrency(amount)),
                React.createElement('div', { className: "w-full relative" },
                    React.createElement('input', { type: "text", readOnly: true, value: payload, className: "w-full text-xs p-3 pr-12 border border-emerald-200 rounded-lg bg-white outline-none text-slate-500 font-mono" }),
                    React.createElement('button', {
                        onClick: () => { navigator.clipboard.writeText(payload); alert("Código PIX Copiado!"); },
                        className: "absolute right-2 top-2 p-1.5 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200 transition-colors",
                        title: "Copiar"
                    }, React.createElement(Copy, { size: 16 }))
                ),
                React.createElement('p', { className: "mt-3 text-[10px] text-emerald-700" }, "O QR Code é gerado neste aparelho; a chave PIX não é enviada a um serviço de imagens.")
            ),
            React.createElement('button', { onClick: onClose, className: "w-full mt-4 p-3 bg-slate-900 text-white font-bold rounded-xl" }, "Fechar")
        )
    );
};

`;
  return source.slice(0, start) + replacement + source.slice(end);
};

globalThis.fetch = async (input, init) => {
  const response = await nativeFetch.call(globalThis, input, init);
  if (!shouldPatchBase(input) || !response.ok) return response;
  const source = patchPixPrivacy(await response.text());
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/javascript; charset=utf-8');
  return new Response(source, { status: response.status, statusText: response.statusText, headers });
};

let finalModule;
try {
  finalModule = await import(new URL('./modals-fixed-v65.js?v=' + VERSION, location.href).href);
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
