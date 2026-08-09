const VERSION = '40';

const loadStableFallback = async () => {
    const fallbackUrl = new URL(`./aba-taxas.js?v=${VERSION}`, location.href).href;
    return import(fallbackUrl);
};

let finalModule = null;

try {
    const response = await fetch(`./aba-taxas.js?v=${VERSION}`, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Não foi possível carregar as configurações de taxas (${response.status}).`);
    }

    let source = await response.text();
    source = source.replace("./payment-settings.js?v=29", `./payment-settings.js?v=${VERSION}`);

    const debitHeadingAnchor = `React.createElement('h3', null, "Débito")`;
    const debitHeadingIndex = source.indexOf(debitHeadingAnchor);
    const sectionAnchor = `React.createElement('section', { className: "rates-group" },`;
    const debitSectionStart = debitHeadingIndex >= 0
        ? source.lastIndexOf(sectionAnchor, debitHeadingIndex)
        : -1;

    if (debitHeadingIndex < 0 || debitSectionStart < 0) {
        throw new Error('Não foi possível localizar a seção de débito.');
    }

    const calculationSettings = `            React.createElement('section', { className: "rates-group" },
                React.createElement('div', { className: "rates-group-title" },
                    React.createElement('h3', null, "Cálculo das taxas"),
                    React.createElement('span', null, "Forma usada para calcular o valor cobrado no cartão")
                ),
                React.createElement('div', { className: "grid gap-4 md:grid-cols-2" },
                    React.createElement('label', { className: "rates-table-name" },
                        React.createElement('span', null, "Fórmula de cálculo"),
                        React.createElement('select', {
                            value: draft.card.calculationFormula,
                            onChange: event => updatePath(['card', 'calculationFormula'], event.target.value),
                            className: "w-full"
                        },
                            React.createElement('option', { value: "infinitepay" }, "Fórmula InfinitePay"),
                            React.createElement('option', { value: "sale_total" }, "Taxa sobre o total da venda")
                        )
                    ),
                    React.createElement(RateInput, {
                        label: "Taxa de transação",
                        value: draft.card.transactionFeePercent,
                        onChange: value => updatePath(['card', 'transactionFeePercent'], value)
                    })
                ),
                React.createElement('div', { className: "rates-info-card mt-4" },
                    React.createElement(Info, { size: 19 }),
                    React.createElement('p', null,
                        draft.card.calculationFormula === 'infinitepay'
                            ? "InfinitePay: o valor bruto é ajustado para que, após as taxas, o líquido preserve o valor base da venda. A taxa de transação é considerada separadamente."
                            : "Taxa sobre o total: mantém o cálculo simples, acrescentando os percentuais sobre o valor base da venda."
                    )
                )
            ),

`;

    source = source.slice(0, debitSectionStart)
        + calculationSettings
        + source.slice(debitSectionStart);

    source = source.replace(
        /(['"])(\.\/[^'"]+?\.js)(?:\?[^'"]*)?\1/g,
        (match, quote, modulePath) => {
            const moduleUrl = new URL(modulePath, location.href);
            moduleUrl.search = `?v=${VERSION}`;
            return `'${moduleUrl.href}'`;
        }
    );

    const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    try {
        finalModule = await import(moduleUrl);
    } finally {
        URL.revokeObjectURL(moduleUrl);
    }
} catch (error) {
    console.error('Falha ao carregar melhorias da aba de taxas. Carregando aba estável.', error);
    finalModule = await loadStableFallback();
}

export const AbaTaxas = finalModule.AbaTaxas;
