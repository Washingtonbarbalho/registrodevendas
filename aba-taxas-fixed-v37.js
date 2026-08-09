const VERSION = '37';

const response = await fetch(`./aba-taxas.js?v=${VERSION}`, { cache: 'no-store' });
if (!response.ok) {
    throw new Error(`Não foi possível carregar as configurações de taxas (${response.status}).`);
}

let source = await response.text();

source = source.replace("./payment-settings.js?v=29", `./payment-settings.js?v=${VERSION}`);

const debitMarker = `            React.createElement('section', { className: "rates-group" },
                React.createElement('div', { className: "rates-group-title" },
                    React.createElement('h3', null, "Débito"),`;

if (!source.includes(debitMarker)) {
    throw new Error('Não foi possível adicionar as opções de cálculo do cartão.');
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
                            ? "InfinitePay: o sistema calcula o valor bruto necessário para que, após as taxas, o líquido corresponda ao valor à vista. A taxa de transação é calculada sobre o valor dos produtos."
                            : "Taxa sobre o total: mantém o cálculo simples atual, somando os percentuais ao valor base da venda. A taxa de transação também é calculada sobre o valor dos produtos."
                    )
                )
            ),

${debitMarker}`;

source = source.replace(debitMarker, calculationSettings);

source = source.replace(
    /(['"])(\.\/[^'"]+?\.js)(?:\?[^'"]*)?\1/g,
    (match, quote, modulePath) => {
        const moduleUrl = new URL(modulePath, location.href);
        moduleUrl.search = `?v=${VERSION}`;
        return `'${moduleUrl.href}'`;
    }
);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
let originalModule;
try {
    originalModule = await import(moduleUrl);
} finally {
    URL.revokeObjectURL(moduleUrl);
}

export const AbaTaxas = originalModule.AbaTaxas;
