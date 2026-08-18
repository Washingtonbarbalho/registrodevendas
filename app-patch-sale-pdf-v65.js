const replaceRequired = (source, marker, replacement, label) => {
  if (!source.includes(marker)) throw new Error(`Não foi possível preparar ${label}.`);
  return source.replace(marker, replacement);
};

export const applySalePdfPatch = source => {
  const settingsImport = "import { normalizePaymentSettings } from './payment-settings.js';";
  source = replaceRequired(source, settingsImport, settingsImport + "\nimport { shareSalePdf } from './sale-pdf-v65.js';", 'o gerador de PDF das vendas');

  const waState = "    const [waChooserModal, setWaChooserModal] = useState({ open: false, phone: '', message: '' });";
  source = replaceRequired(source, waState, "    const [waChooserModal, setWaChooserModal] = useState({ open: false, phone: '', message: '', pdfData: null });", 'o contexto de PDF das mensagens');

  const openWaMarker = "    const handleOpenWA = (type, sale, installment, historyItem) => {";
  const pdfHandler = `    const handleGenerateSalePdf = async (pdfData) => {
        if (!pdfData?.sale) return;
        try {
            const result = await shareSalePdf({
                sale: pdfData.sale,
                userProfile,
                type: pdfData.type || (pdfData.sale.saleType === 'direct' ? 'comprovante' : 'registro'),
                installment: pdfData.installment || null,
                historyItem: pdfData.historyItem || null
            });
            if (result?.downloaded) alert('O compartilhamento direto não estava disponível. O PDF foi baixado para o aparelho.');
        } catch (error) {
            console.error('Erro ao gerar PDF da venda:', error);
            alert('Não foi possível gerar o PDF desta venda.');
        }
    };

${openWaMarker}`;
  source = replaceRequired(source, openWaMarker, pdfHandler, 'a geração de PDF no detalhe da venda');

  const waOpen = "        setWaChooserModal({ open: true, phone: phoneToUse, message: msg });";
  source = replaceRequired(source, waOpen, "        setWaChooserModal({ open: true, phone: phoneToUse, message: msg, pdfData: { type, sale, installment: installment || null, historyItem: historyItem || null } });", 'o PDF associado à mensagem');

  const detailsProps = "            onOpenWA: handleOpenWA, onShowPixCode: handleShowPixCode, hasPixSetup: !!(userProfile?.pixKey)";
  source = replaceRequired(source, detailsProps, "            onOpenWA: handleOpenWA, onShowPixCode: handleShowPixCode, hasPixSetup: !!(userProfile?.pixKey),\n            onGeneratePdf: () => handleGenerateSalePdf({ sale: activeSaleDetails, type: activeSaleDetails?.saleType === 'direct' ? 'comprovante' : (activeSaleDetails?.status === 'completed' ? 'quitacao' : 'registro') })", 'o botão de PDF no detalhe da venda');

  const chooserRender = "        React.createElement(WhatsAppChooserModal, { isOpen: waChooserModal.open, phone: waChooserModal.phone, message: waChooserModal.message, onClose: () => setWaChooserModal({ open: false, phone: '', message: '' }) })";
  source = replaceRequired(source, chooserRender, "        React.createElement(WhatsAppChooserModal, { isOpen: waChooserModal.open, phone: waChooserModal.phone, message: waChooserModal.message, onPdf: waChooserModal.pdfData ? () => handleGenerateSalePdf(waChooserModal.pdfData) : null, onClose: () => setWaChooserModal({ open: false, phone: '', message: '', pdfData: null }) })", 'o compartilhamento de PDF no modal de mensagem');
  return source;
};
