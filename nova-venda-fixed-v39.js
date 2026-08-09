const VERSION = '39';

const loadStableFallback = async () => {
    const fallbackUrl = new URL(`./nova-venda-fixed-v36.js?v=${VERSION}`, location.href).href;
    return import(fallbackUrl);
};

let finalModule = null;

try {
    const response = await fetch(`./nova-venda-fixed-v37.js?v=${VERSION}`, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Não foi possível carregar a base da versão 37 (${response.status}).`);
    }

    let wrapperSource = await response.text();

    if (!wrapperSource.includes("const VERSION = '37';")) {
        throw new Error('Versão-base inesperada do formulário.');
    }
    wrapperSource = wrapperSource.replace("const VERSION = '37';", `const VERSION = '${VERSION}';`);

    const blockStart = wrapperSource.indexOf('const directBranchPattern = ');
    const blockEndMarker = '\n\nsource = source.replace(\n    "onChange: e => setFrequency(e.target.value)"';
    const blockEnd = wrapperSource.indexOf(blockEndMarker, blockStart);

    if (blockStart < 0 || blockEnd < 0) {
        throw new Error('Bloco antigo de atualização do cartão não localizado.');
    }

    const replacementBlock = [
        "const directBranchAnchor = '            let finalSalePrice = totalCartValue;';",
        "const directBranchAnchorIndex = source.indexOf(directBranchAnchor);",
        "const directBranchStart = directBranchAnchorIndex >= 0 ? source.lastIndexOf('        } else {', directBranchAnchorIndex) : -1;",
        "const directBranchEnd = directBranchAnchorIndex >= 0 ? source.indexOf('\\n    };\\n\\n    const handleManualApprove', directBranchAnchorIndex) : -1;",
        "if (directBranchAnchorIndex < 0 || directBranchStart < 0 || directBranchEnd < 0) {",
        "    throw new Error('Não foi possível localizar com segurança o bloco da venda no cartão.');",
        "}",
        "const directBranchReplacement = [",
        "    '        } else {',",
        "    '            const finalSalePrice = isCardPayment',",
        "    '                ? entryValue + currentCardCalculation.grossAmount',",
        "    '                : totalCartValue;',",
        "    '            let feeObj = null;',",
        "    '',",
        "    '            if (isCardPayment) {',",
        "    '                feeObj = {',",
        "    '                    applied: currentCardCalculation.totalFeeValue > 0,',",
        "    '                    percent: currentFeePercent,',",
        "    '                    value: currentCardCalculation.totalFeeValue,',",
        "    '                    installmentFeePercent: currentFeePercent,',",
        "    '                    installmentFeeValue: currentInstallmentFeeValue,',",
        "    '                    transactionFeePercent: currentCardCalculation.transactionRate,',",
        "    '                    transactionFeeValue: currentTransactionFeeValue,',",
        "    '                    calculationFormula: currentCardCalculation.formula,',",
        "    '                    type: feeType,',",
        "    '                    mode: cardMode,',",
        "    '                    brand: cardBrand,',",
        "    '                    rateTableName: normalizedPaymentSettings.card.machineName,',",
        "    '                    baseAmount: totalRemaining,',",
        "    '                    grossCardAmount: currentCardCalculation.grossAmount,',",
        "    '                    netCardAmount: currentCardCalculation.netAmount,',",
        "    '                    customerSurchargeValue: currentCardCalculation.customerSurchargeValue',",
        "    '                };',",
        "    '            }',",
        "    '',",
        "    '            const netReceived = isCardPayment',",
        "    '                ? entryValue + currentCardCalculation.netAmount',",
        "    '                : finalSalePrice;',",
        "    '',",
        "    '            saleData = {',",
        "    '                ...saleData,',",
        "    '                productsTotal: totalCartValue,',",
        "    '                paymentMethod: directMethod,',",
        "    '                entryAmount: entryValue,',",
        "    '                cardAmount: isCardPayment ? currentCardCalculation.grossAmount : 0,',",
        "    '                netReceived,',",
        "    \"                cardInstallments: directMethod === 'credit' ? parseInt(cardInstallments) : 1,\",",
        "    '                installments: [],',",
        "    \"                status: 'completed',\",",
        "    '                totalPrice: finalSalePrice,',",
        "    '                feeConfig: feeObj',",
        "    '            };',",
        "    '',",
        "    '            onSaveSale(saleData);',",
        "    '            onClose();',",
        "    '        }'",
        "].join('\\n');",
        "source = source.slice(0, directBranchStart) + directBranchReplacement + source.slice(directBranchEnd);"
    ].join('\n');

    wrapperSource = wrapperSource.slice(0, blockStart)
        + replacementBlock
        + wrapperSource.slice(blockEnd);

    const wrapperUrl = URL.createObjectURL(new Blob([wrapperSource], { type: 'text/javascript' }));
    try {
        finalModule = await import(wrapperUrl);
    } finally {
        URL.revokeObjectURL(wrapperUrl);
    }
} catch (error) {
    console.error('Falha na versão 39 do formulário. Carregando versão estável anterior.', error);
    finalModule = await loadStableFallback();
}

export const NewSaleScreen = finalModule.NewSaleScreen;
