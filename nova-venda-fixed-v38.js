const VERSION = '38';

const response = await fetch(`./nova-venda-fixed-v37.js?v=${VERSION}`, { cache: 'no-store' });
if (!response.ok) {
    throw new Error(`Não foi possível carregar o formulário de vendas (${response.status}).`);
}

let source = await response.text();

const oldFinancialCalculation = `    const cardGrossAmount = isCardPayment && feeType === 'com_juros' && cardFeeFraction > 0
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
        : totalCustomerPays;`;

const newFinancialCalculation = `    const cardFormulaGrossAmount = isCardPayment && cardFeeFraction > 0
        ? totalRemaining / (1 - cardFeeFraction)
        : totalRemaining;
    const currentFeeValue = isCardPayment
        ? Math.max(0, cardFormulaGrossAmount - totalRemaining)
        : 0;
    const cardAmountCharged = isCardPayment && feeType === 'com_juros'
        ? cardFormulaGrossAmount
        : totalRemaining;
    const totalCustomerPays = saleType === 'prazo'
        ? totalCartValue + carnetInterestValue
        : isCardPayment
            ? entryValue + cardAmountCharged
            : totalCartValue;
    const netAmountToCompany = isCardPayment
        ? entryValue + Math.max(0, cardAmountCharged - currentFeeValue)
        : totalCustomerPays;`;

if (!source.includes(oldFinancialCalculation)) {
    throw new Error('Não foi possível localizar o cálculo atual da taxa do cartão.');
}
source = source.replace(oldFinancialCalculation, newFinancialCalculation);

const directSaleReplacements = [
    [
        `            const finalSalePrice = isCardPayment
                ? entryValue + cardGrossAmount
                : totalCartValue;`,
        `            const finalSalePrice = isCardPayment
                ? entryValue + cardAmountCharged
                : totalCartValue;`
    ],
    [
        `                const grossCardAmount = cardGrossAmount;
                const netCardAmount = Math.max(0, grossCardAmount - feeVal);`,
        `                const grossCardAmount = cardAmountCharged;
                const netCardAmount = Math.max(0, grossCardAmount - feeVal);`
    ],
    [
        `                    grossCardAmount,
                    netCardAmount,
                    calculationFormula: 'valor_liquido_dividido_por_um_menos_taxa'`,
        `                    grossCardAmount,
                    calculatedGrossAmount: cardFormulaGrossAmount,
                    netCardAmount,
                    calculationFormula: 'valor_liquido_dividido_por_um_menos_taxa'`
    ],
    [
        `            const netReceived = isCardPayment
                ? entryValue + Math.max(0, cardGrossAmount - feeVal)
                : finalSalePrice;`,
        `            const netReceived = isCardPayment
                ? entryValue + Math.max(0, cardAmountCharged - feeVal)
                : finalSalePrice;`
    ],
    [
        `                cardAmount: isCardPayment ? cardGrossAmount : 0,`,
        `                cardAmount: isCardPayment ? cardAmountCharged : 0,`
    ]
];

for (const [oldSnippet, newSnippet] of directSaleReplacements) {
    if (!source.includes(oldSnippet)) {
        throw new Error('Não foi possível atualizar todos os pontos do cálculo do cartão.');
    }
    source = source.replace(oldSnippet, newSnippet);
}

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
let finalModule;
try {
    finalModule = await import(moduleUrl);
} finally {
    URL.revokeObjectURL(moduleUrl);
}

export const NewSaleScreen = finalModule.NewSaleScreen;
