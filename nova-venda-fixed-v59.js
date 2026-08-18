const VERSION = '59';
const nativeFetch = globalThis.fetch;

const timestampMarker = "            saleDate: saleDate, saleType: saleType, status: 'active'";
const timestampReplacement = "            saleDate: saleDate, saleDateTime: new Date().toISOString(), saleType: saleType, status: 'active'";
const notesStateMarker = "    const [saleDate, setSaleDate] = useState(getBrazilDateString()); \n";
const notesStateReplacement = notesStateMarker + "    const [saleNotes, setSaleNotes] = useState('');\n";
const notesDataMarker = `            items: cart, totalCost: cart.reduce((acc, i) => acc + i.cost, 0), totalPrice: totalCartValue, totalDiscount: sumDiscount,
            saleDate: saleDate, saleType: saleType, status: 'active'`;
const notesDataReplacement = `            items: cart, totalCost: cart.reduce((acc, i) => acc + i.cost, 0), totalPrice: totalCartValue, totalDiscount: sumDiscount,
            notes: saleNotes.trim(),
            saleDate: saleDate, saleType: saleType, status: 'active'`;
const notesUiMarker = `                )
            )
        ),
        
        React.createElement('div', { className: "sale-bottom-bar fixed bottom-0 w-full p-4 z-40" },`;
const notesUiReplacement = `                ),

                React.createElement('div', { className: "sale-section bg-white p-5 border" },
                    React.createElement('h3', { className: "font-bold text-slate-800 mb-2" }, "4. Observações"),
                    React.createElement('p', { className: "text-xs text-slate-500 mb-3" }, "Campo opcional para registrar informações importantes sobre esta venda."),
                    React.createElement('textarea', {
                        rows: 3,
                        value: saleNotes,
                        onChange: e => setSaleNotes(e.target.value),
                        placeholder: "Ex.: cliente trocou um item, condição combinada, informação adicional...",
                        className: \`w-full p-3 border border-slate-200 rounded-xl bg-white text-sm resize-y focus:outline-none focus:ring-2 \${mode === 'prazo' ? 'focus:ring-yellow-500' : 'focus:ring-emerald-500'}\`
                    })
                )
            )
        ),
        
        React.createElement('div', { className: "sale-bottom-bar fixed bottom-0 w-full p-4 z-40" },`;

const oldCardFinancialBlock = `    const isCardPayment = saleType === 'direct' && (directMethod === 'credit' || directMethod === 'debit');
    const currentFeePercent = isCardPayment ? parseMoney(feePercent) : 0;
    const currentFeeValue = isCardPayment ? totalRemaining * (currentFeePercent / 100) : 0;
    const totalCustomerPays = saleType === 'prazo'
        ? totalCartValue + carnetInterestValue
        : totalCartValue + (isCardPayment && feeType === 'com_juros' ? currentFeeValue : 0);
    const netAmountToCompany = totalCustomerPays - currentFeeValue;`;

const newCardFinancialBlock = `    const isCardPayment = saleType === 'direct' && (directMethod === 'credit' || directMethod === 'debit');
    const currentFeePercent = isCardPayment ? parseMoney(feePercent) : 0;
    const roundCardMoney = value => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;
    const cardFeeFraction = isCardPayment ? Math.min(0.999999, Math.max(0, currentFeePercent / 100)) : 0;
    const cardBaseAmount = isCardPayment ? roundCardMoney(totalRemaining) : 0;
    const cardGrossUpAmount = isCardPayment && cardFeeFraction > 0
        ? roundCardMoney(cardBaseAmount / (1 - cardFeeFraction))
        : cardBaseAmount;
    const customerPassedFeeValue = isCardPayment && feeType === 'com_juros'
        ? roundCardMoney(Math.max(0, cardGrossUpAmount - cardBaseAmount))
        : 0;
    const storeAbsorbedFeeValue = isCardPayment && feeType === 'sem_juros'
        ? roundCardMoney(cardBaseAmount * cardFeeFraction)
        : 0;
    const currentFeeValue = roundCardMoney(customerPassedFeeValue + storeAbsorbedFeeValue);
    const cardAmountCharged = isCardPayment
        ? (feeType === 'com_juros' ? cardGrossUpAmount : cardBaseAmount)
        : 0;
    const cardNetAmount = isCardPayment
        ? (feeType === 'com_juros' ? cardBaseAmount : roundCardMoney(cardBaseAmount - storeAbsorbedFeeValue))
        : 0;
    const totalCustomerPays = saleType === 'prazo'
        ? totalCartValue + carnetInterestValue
        : isCardPayment
            ? roundCardMoney(entryValue + cardAmountCharged)
            : totalCartValue;
    const netAmountToCompany = totalCustomerPays - currentFeeValue;`;

const oldDirectCardBlock = `        } else {
            let finalSalePrice = totalCartValue;
            let feeObj = null;

            let feeVal = 0;

            if (directMethod === 'credit' || directMethod === 'debit') {
                const feeP = parseMoney(feePercent);
                feeVal = totalRemaining * (feeP / 100);
                if (feeType === 'com_juros') finalSalePrice += feeVal;

                const grossCardAmount = finalSalePrice - entryValue;
                const netCardAmount = grossCardAmount - feeVal;
                feeObj = {
                    applied: feeP > 0,
                    percent: feeP,
                    value: feeVal,
                    type: feeType,
                    mode: cardMode,
                    brand: cardBrand,
                    rateTableName: normalizedPaymentSettings.card.machineName,
                    baseAmount: totalRemaining,
                    grossCardAmount,
                    netCardAmount
                };
            }

            const netReceived = finalSalePrice - feeVal;

            saleData = { 
                ...saleData,
                productsTotal: totalCartValue,
                paymentMethod: directMethod,
                entryAmount: entryValue,
                cardAmount: finalSalePrice - entryValue,
                netReceived,
                cardInstallments: directMethod === 'credit' ? parseInt(cardInstallments) : 1,
                installments: [],
                status: 'completed',
                totalPrice: finalSalePrice,
                feeConfig: feeObj
            };`;

const newDirectCardBlock = `        } else {
            let finalSalePrice = totalCartValue;
            let feeObj = null;
            let feeVal = 0;
            let finalCardNetAmount = 0;

            if (directMethod === 'credit' || directMethod === 'debit') {
                const feeP = currentFeePercent;
                feeVal = currentFeeValue;
                finalSalePrice = roundCardMoney(entryValue + cardAmountCharged);
                finalCardNetAmount = cardNetAmount;

                feeObj = {
                    applied: feeP > 0,
                    percent: feeP,
                    value: feeVal,
                    type: feeType,
                    mode: cardMode,
                    brand: cardBrand,
                    rateTableName: normalizedPaymentSettings.card.machineName,
                    baseAmount: cardBaseAmount,
                    grossCardAmount: cardAmountCharged,
                    calculatedGrossAmount: cardGrossUpAmount,
                    customerPassedFeeValue,
                    storeAbsorbedFeeValue,
                    netCardAmount: finalCardNetAmount,
                    calculationFormula: feeType === 'com_juros'
                        ? 'valor_liquido_dividido_por_um_menos_taxa'
                        : 'taxa_sobre_valor_realmente_passado'
                };
            }

            const netReceived = isCardPayment
                ? roundCardMoney(entryValue + finalCardNetAmount)
                : finalSalePrice;

            saleData = { 
                ...saleData,
                productsTotal: totalCartValue,
                paymentMethod: directMethod,
                entryAmount: entryValue,
                cardAmount: isCardPayment ? cardAmountCharged : 0,
                netReceived,
                cardInstallments: directMethod === 'credit' ? parseInt(cardInstallments) : 1,
                installments: [],
                status: 'completed',
                totalPrice: finalSalePrice,
                feeConfig: feeObj
            };`;

const shouldPatch = input => {
  try {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    return !!raw && new URL(raw, location.href).pathname.endsWith('/nova-venda.js');
  } catch { return false; }
};

globalThis.fetch = async (input, init) => {
  const response = await nativeFetch.call(globalThis, input, init);
  if (!shouldPatch(input) || !response.ok) return response;

  let source = await response.text();
  for (const [marker, label] of [
    [oldCardFinancialBlock, 'a fórmula correta do cartão'],
    [oldDirectCardBlock, 'os dados financeiros do cartão'],
    [timestampMarker, 'o horário real da nova venda'],
    [notesStateMarker, 'o campo de observações'],
    [notesDataMarker, 'o salvamento das observações'],
    [notesUiMarker, 'a área de observações no formulário']
  ]) {
    if (!source.includes(marker)) throw new Error(`Não foi possível preparar ${label}.`);
  }

  source = source
    .replace(oldCardFinancialBlock, newCardFinancialBlock)
    .replace(oldDirectCardBlock, newDirectCardBlock)
    .replace(notesStateMarker, notesStateReplacement)
    .replace(notesDataMarker, notesDataReplacement)
    .replace(timestampMarker, timestampReplacement)
    .replace(notesUiMarker, notesUiReplacement);

  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/javascript; charset=utf-8');
  return new Response(source, { status: response.status, statusText: response.statusText, headers });
};

let finalModule;
try {
  finalModule = await import(`./nova-venda-fixed-v36.js?v=${VERSION}`);
} finally {
  globalThis.fetch = nativeFetch;
}

if (!finalModule?.NewSaleScreen) throw new Error('O formulário de vendas não foi carregado corretamente.');
export const NewSaleScreen = finalModule.NewSaleScreen;
