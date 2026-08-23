const VERSION = '70';
const nativeFetch = globalThis.fetch;

const pathEndsWith = (input, suffix) => {
  try {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    return !!raw && new URL(raw, location.href).pathname.endsWith(suffix);
  } catch { return false; }
};

const patchBaseSale = source => {
  const paymentImport = "import { getCardRate, getCarnetRate, normalizePaymentSettings } from './payment-settings.js';";
  if (!source.includes(paymentImport)) throw new Error('Não foi possível preparar o parcelamento exato da venda.');
  source = source.replace(paymentImport, paymentImport + "\nimport { splitMoney } from './financial-core-v70.js';");

  const savingCustomerState = "    const [savingCustomer, setSavingCustomer] = useState(false);";
  if (!source.includes(savingCustomerState)) throw new Error('Não foi possível preparar o estado de gravação da venda.');
  source = source.replace(
    savingCustomerState,
    savingCustomerState + "\n    const [savingSale, setSavingSale] = useState(false);\n    const savingSaleRef = React.useRef(false);"
  );

  const finishSignature = "    const handleFinish = () => {";
  if (!source.includes(finishSignature)) throw new Error('Não foi possível proteger a conclusão da venda.');
  source = source.replace(finishSignature, `    const persistSale = async saleData => {
        if (savingSaleRef.current) return false;
        savingSaleRef.current = true;
        setSavingSale(true);
        try {
            await onSaveSale(saleData);
            return true;
        } catch (error) {
            console.error('Erro ao salvar venda:', error);
            alert(error?.message || 'Não foi possível salvar a venda. Nenhuma alteração foi gravada.');
            return false;
        } finally {
            savingSaleRef.current = false;
            setSavingSale(false);
        }
    };

    const handleFinish = async () => {`);

  const directSave = `            onSaveSale(saleData);\x20
            onClose();`;
  if (!source.includes(directSave)) throw new Error('Não foi possível aguardar a gravação da venda direta.');
  source = source.replace(directSave, `            if (await persistSale(saleData)) onClose();`);

  const manualSignature = "    const handleManualApprove = () => {";
  if (!source.includes(manualSignature)) throw new Error('Não foi possível proteger a aprovação manual.');
  source = source.replace(manualSignature, "    const handleManualApprove = async () => {");

  const manualSave = `        onSaveSale(saleDataToSave);
        setCreditModal({ open: false, result: null, pendingSaleData: null, manualReason: '' });
        onClose();`;
  if (!source.includes(manualSave)) throw new Error('Não foi possível aguardar a gravação da venda aprovada manualmente.');
  source = source.replace(manualSave, `        if (await persistSale(saleDataToSave)) {
            setCreditModal({ open: false, result: null, pendingSaleData: null, manualReason: '' });
            onClose();
        }`);

  const finishButton = `                React.createElement('button', {\x20
                    onClick: handleFinish,\x20
                    className: \`flex-1 py-4 text-white font-bold text-lg rounded-xl shadow-lg transition-transform active:scale-95 flex justify-center items-center gap-2 \${mode === 'prazo' ? 'bg-yellow-500 hover:bg-yellow-600 text-slate-900 shadow-yellow-200' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'}\`\x20
                }, React.createElement(CheckCircle, { size: 20 }), "Finalizar Venda")`;
  if (!source.includes(finishButton)) throw new Error('Não foi possível bloquear o botão durante a gravação.');
  source = source.replace(finishButton, `                React.createElement('button', {
                    onClick: handleFinish,
                    disabled: savingSale,
                    className: \`flex-1 py-4 text-white font-bold text-lg rounded-xl shadow-lg transition-transform active:scale-95 flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-wait \${mode === 'prazo' ? 'bg-yellow-500 hover:bg-yellow-600 text-slate-900 shadow-yellow-200' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'}\`
                }, React.createElement(CheckCircle, { size: 20 }), savingSale ? "Salvando..." : "Finalizar Venda")`);

  return source.replace(
    '                        disabled: !creditModal.manualReason.trim(),',
    '                        disabled: savingSale || !creditModal.manualReason.trim(),'
  );
};

const patchPaymentWrapper = source => {
  const installmentDivision = '        const amountPerInstallment = total / count;';
  const installmentAmount = '                amount: amountPerInstallment,';
  if (!source.includes(installmentDivision) || !source.includes(installmentAmount)) {
    throw new Error('Não foi possível distribuir corretamente os centavos entre as parcelas.');
  }
  source = source.replace(installmentDivision, '        const installmentAmounts = splitMoney(total, count);');
  source = source.replace(installmentAmount, '                amount: installmentAmounts[i],\n                originalAmount: installmentAmounts[i],');
  source = source.replace(
    '        ? summaryFinancedValue / summaryInstallmentsCount',
    '        ? (splitMoney(summaryFinancedValue, summaryInstallmentsCount)[0] || 0)'
  );

  const approvedSave = "                    onClick: () => { onSaveSale(approvedSaleData); onClose(); },";
  if (!source.includes(approvedSave)) throw new Error('Não foi possível proteger a confirmação da venda aprovada.');
  return source.replace(
    approvedSave,
    "                    onClick: async () => { if (await persistSale(approvedSaleData)) onClose(); },\n                    disabled: savingSale,"
  ).replace(
    '                }, React.createElement(CheckCircle, { size: 20 }), "Concluir e salvar venda")',
    '                }, React.createElement(CheckCircle, { size: 20 }), savingSale ? "Salvando..." : "Concluir e salvar venda")'
  );
};

globalThis.fetch = async (input, init) => {
  const response = await nativeFetch.call(globalThis, input, init);
  if (!response.ok) return response;
  let source;
  if (pathEndsWith(input, '/nova-venda.js')) source = patchBaseSale(await response.text());
  else if (pathEndsWith(input, '/nova-venda-fixed.js')) source = patchPaymentWrapper(await response.text());
  else return response;

  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/javascript; charset=utf-8');
  return new Response(source, { status: response.status, statusText: response.statusText, headers });
};

let finalModule;
try {
  finalModule = await import(new URL('./nova-venda-fixed-v65.js?v=' + VERSION, location.href).href);
} finally {
  globalThis.fetch = nativeFetch;
}

if (typeof finalModule?.NewSaleScreen !== 'function') throw new Error('A Nova Venda segura não foi carregada.');
export const NewSaleScreen = finalModule.NewSaleScreen;
