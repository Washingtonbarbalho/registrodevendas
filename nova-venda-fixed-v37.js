const VERSION = '37';

const fetchText = async (path) => {
    const response = await fetch(`${path}?v=${VERSION}`, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Não foi possível carregar ${path} (${response.status}).`);
    }
    return response.text();
};

const blobUrls = [];
const makeModuleUrl = (source) => {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    blobUrls.push(url);
    return url;
};

let finalModule;

try {
    let v29Source = await fetchText('./nova-venda-fixed.js');
    const finalSourceMarker = "const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));";
    if (!v29Source.includes(finalSourceMarker)) {
        throw new Error('Não foi possível preparar o cálculo correto das taxas do cartão.');
    }

    const cardFormulaPatch = String.raw`
const oldCardFinancialBlock = \
\`    const isCardPayment = saleType === 'direct' && (directMethod === 'credit' || directMethod === 'debit');
    const currentFeePercent = isCardPayment ? parseMoney(feePercent) : 0;
    const currentFeeValue = isCardPayment ? totalRemaining * (currentFeePercent / 100) : 0;
    const totalCustomerPays = saleType === 'prazo'
        ? totalCartValue + carnetInterestValue
        : totalCartValue + (isCardPayment && feeType === 'com_juros' ? currentFeeValue : 0);
    const netAmountToCompany = totalCustomerPays - currentFeeValue;\`;

const newCardFinancialBlock = \
\`    const isCardPayment = saleType === 'direct' && (directMethod === 'credit' || directMethod === 'debit');
    const currentFeePercent = isCardPayment ? parseMoney(feePercent) : 0;
    const cardFeeFraction = isCardPayment
        ? Math.min(0.999999, Math.max(0, currentFeePercent / 100))
        : 0;
    const cardGrossAmount = isCardPayment && feeType === 'com_juros' && cardFeeFraction > 0
        ? totalRemaining / (1 - cardFeeFraction)
        : totalRemaining;
    const currentFeeValue = isCardPayment ? cardGrossAmount * cardFeeFraction : 0;
    const totalCustomerPays = saleType === 'prazo'
        ? totalCartValue + carnetInterestValue
        : isCardPayment
            ? entryValue + cardGrossAmount
            : totalCartValue;
    const netAmountToCompany = isCardPayment
        ? entryValue + Math.max(0, cardGrossAmount - currentFeeValue)
        : totalCustomerPays;\`;

if (!source.includes(oldCardFinancialBlock)) {
    throw new Error('Não foi possível localizar o cálculo financeiro do cartão.');
}
source = source.replace(oldCardFinancialBlock, newCardFinancialBlock);

const oldDirectCardBlock = \
\`        } else {
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
            };\`;

const newDirectCardBlock = \
\`        } else {
            const finalSalePrice = isCardPayment
                ? entryValue + cardGrossAmount
                : totalCartValue;
            let feeObj = null;
            let feeVal = 0;

            if (directMethod === 'credit' || directMethod === 'debit') {
                const feeP = currentFeePercent;
                feeVal = currentFeeValue;

                const grossCardAmount = cardGrossAmount;
                const netCardAmount = Math.max(0, grossCardAmount - feeVal);
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
                    netCardAmount,
                    calculationFormula: 'valor_liquido_dividido_por_um_menos_taxa'
                };
            }

            const netReceived = isCardPayment
                ? entryValue + Math.max(0, cardGrossAmount - feeVal)
                : finalSalePrice;

            saleData = { 
                ...saleData,
                productsTotal: totalCartValue,
                paymentMethod: directMethod,
                entryAmount: entryValue,
                cardAmount: isCardPayment ? cardGrossAmount : 0,
                netReceived,
                cardInstallments: directMethod === 'credit' ? parseInt(cardInstallments) : 1,
                installments: [],
                status: 'completed',
                totalPrice: finalSalePrice,
                feeConfig: feeObj
            };\`;

if (!source.includes(oldDirectCardBlock)) {
    throw new Error('Não foi possível localizar a gravação da venda no cartão.');
}
source = source.replace(oldDirectCardBlock, newDirectCardBlock);
`;

    v29Source = v29Source.replace(
        finalSourceMarker,
        cardFormulaPatch + '\n' + finalSourceMarker
    );
    const v29Url = makeModuleUrl(v29Source);

    let v33Source = await fetchText('./nova-venda-fixed-v33.js');
    const v33Fetch = "const response = await fetch(`./nova-venda-fixed.js?v=${VERSION}`, { cache: 'no-store' });";
    if (!v33Source.includes(v33Fetch)) {
        throw new Error('Não foi possível conectar o ajuste à base da versão 33.');
    }
    v33Source = v33Source.replace(
        v33Fetch,
        `const response = await fetch(${JSON.stringify(v29Url)}, { cache: 'no-store' });`
    );
    const v33Url = makeModuleUrl(v33Source);

    let v34Source = await fetchText('./nova-venda-fixed-v34.js');
    const v34Fetch = "const response = await fetch(`./nova-venda-fixed-v33.js?v=${VERSION}`, { cache: 'no-store' });";
    if (!v34Source.includes(v34Fetch)) {
        throw new Error('Não foi possível conectar o ajuste à base da versão 34.');
    }
    v34Source = v34Source.replace(
        v34Fetch,
        `const response = await fetch(${JSON.stringify(v33Url)}, { cache: 'no-store' });`
    );
    const v34Url = makeModuleUrl(v34Source);

    let v36Source = await fetchText('./nova-venda-fixed-v36.js');
    const v36Fetch = "const response = await fetch(`./nova-venda-fixed-v34.js?v=${VERSION}`, { cache: 'no-store' });";
    if (!v36Source.includes(v36Fetch)) {
        throw new Error('Não foi possível conectar o ajuste à versão 36.');
    }
    v36Source = v36Source.replace(
        v36Fetch,
        `const response = await fetch(${JSON.stringify(v34Url)}, { cache: 'no-store' });`
    );
    const v36Url = makeModuleUrl(v36Source);

    finalModule = await import(v36Url);
} finally {
    blobUrls.forEach(url => URL.revokeObjectURL(url));
}

export const NewSaleScreen = finalModule.NewSaleScreen;
