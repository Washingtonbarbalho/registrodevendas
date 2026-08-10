const VERSION = '42';

const nativeFetch = globalThis.fetch;

const oldCardFinancialBlock = `    const isCardPayment = saleType === 'direct' && (directMethod === 'credit' || directMethod === 'debit');
    const currentFeePercent = isCardPayment ? parseMoney(feePercent) : 0;
    const currentFeeValue = isCardPayment ? totalRemaining * (currentFeePercent / 100) : 0;
    const totalCustomerPays = saleType === 'prazo'
        ? totalCartValue + carnetInterestValue
        : totalCartValue + (isCardPayment && feeType === 'com_juros' ? currentFeeValue : 0);
    const netAmountToCompany = totalCustomerPays - currentFeeValue;`;

const newCardFinancialBlock = `    const isCardPayment = saleType === 'direct' && (directMethod === 'credit' || directMethod === 'debit');
    const currentFeePercent = isCardPayment ? parseMoney(feePercent) : 0;
    const cardFeeFraction = isCardPayment
        ? Math.min(0.999999, Math.max(0, currentFeePercent / 100))
        : 0;
    const cardBaseAmount = isCardPayment ? totalRemaining : 0;
    const cardGrossUpAmount = isCardPayment && cardFeeFraction > 0
        ? cardBaseAmount / (1 - cardFeeFraction)
        : cardBaseAmount;
    const customerPassedFeeValue = isCardPayment && feeType === 'com_juros'
        ? Math.max(0, cardGrossUpAmount - cardBaseAmount)
        : 0;
    const storeAbsorbedFeeValue = isCardPayment && feeType === 'sem_juros'
        ? Math.max(0, cardBaseAmount * cardFeeFraction)
        : 0;
    const currentFeeValue = customerPassedFeeValue + storeAbsorbedFeeValue;
    const cardAmountCharged = isCardPayment
        ? cardBaseAmount + customerPassedFeeValue
        : 0;
    const cardNetAmount = isCardPayment
        ? (feeType === 'com_juros'
            ? cardBaseAmount
            : Math.max(0, cardBaseAmount - storeAbsorbedFeeValue))
        : 0;
    const totalCustomerPays = saleType === 'prazo'
        ? totalCartValue + carnetInterestValue
        : isCardPayment
            ? entryValue + cardAmountCharged
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
                finalSalePrice = entryValue + cardAmountCharged;
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
                    calculatedGrossAmount: feeType === 'com_juros' ? cardGrossUpAmount : null,
                    customerPassedFeeValue,
                    storeAbsorbedFeeValue,
                    feeBaseAmount: cardBaseAmount,
                    netCardAmount: finalCardNetAmount,
                    calculationFormula: feeType === 'com_juros'
                        ? 'valor_liquido_dividido_por_um_menos_taxa'
                        : 'valor_passado_multiplicado_por_um_menos_taxa'
                };
            }

            const netReceived = isCardPayment
                ? entryValue + finalCardNetAmount
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

const patchNewSaleSource = (source) => {
    if (typeof source !== 'string' || !source.includes('export const NewSaleScreen')) {
        throw new Error('O formulário-base de vendas não foi reconhecido.');
    }
    if (!source.includes(oldCardFinancialBlock)) {
        throw new Error('O cálculo financeiro original do cartão não foi localizado.');
    }
    if (!source.includes(oldDirectCardBlock)) {
        throw new Error('A gravação original da venda no cartão não foi localizada.');
    }

    return source
        .replace(oldCardFinancialBlock, newCardFinancialBlock)
        .replace(oldDirectCardBlock, newDirectCardBlock);
};

const shouldPatchNewSale = (input) => {
    try {
        const rawUrl = typeof input === 'string' || input instanceof URL
            ? String(input)
            : input?.url;
        if (!rawUrl) return false;
        const url = new URL(rawUrl, location.href);
        return url.pathname.endsWith('/nova-venda.js');
    } catch {
        return false;
    }
};

globalThis.fetch = async (input, init) => {
    const response = await nativeFetch.call(globalThis, input, init);
    if (!shouldPatchNewSale(input) || !response.ok) return response;

    const originalSource = await response.text();
    const patchedSource = patchNewSaleSource(originalSource);
    const headers = new Headers(response.headers);
    headers.set('content-type', 'text/javascript; charset=utf-8');

    return new Response(patchedSource, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
};

let finalModule;
try {
    finalModule = await import(`./nova-venda-fixed-v36.js?v=${VERSION}`);
} finally {
    globalThis.fetch = nativeFetch;
}

if (!finalModule?.NewSaleScreen) {
    throw new Error('O formulário de vendas não foi carregado corretamente.');
}

export const NewSaleScreen = finalModule.NewSaleScreen;
