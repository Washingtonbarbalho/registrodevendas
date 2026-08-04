const VERSION = '34';

const response = await fetch(`./nova-venda-fixed-v33.js?v=${VERSION}`, { cache: 'no-store' });
if (!response.ok) {
    throw new Error(`Não foi possível carregar o formulário de vendas da versão anterior (${response.status}).`);
}

let wrapperSource = await response.text();

if (!wrapperSource.includes("const VERSION = '33';")) {
    throw new Error('Não foi possível atualizar a versão do formulário de vendas.');
}
wrapperSource = wrapperSource.replace("const VERSION = '33';", `const VERSION = '${VERSION}';`);

const waiverBlockPattern = /const paymentSummaryTitleWithWaiver = \[[\s\S]*?\]\.join\("\\n"\);/;
if (!waiverBlockPattern.test(wrapperSource)) {
    throw new Error('Não foi possível simplificar o seletor de parcelamento sem juros.');
}

const simplifiedWaiverBlock = String.raw`const paymentSummaryTitleWithWaiver = [
    "                        configuredCarnetInterestPercent > 0 && React.createElement('button', {",
    "                            type: \"button\",",
    "                            onClick: () => setWaiveCarnetInterest(previous => !previous),",
    "                            className: \"w-full mb-4 px-3 py-3 rounded-xl border flex items-center justify-between gap-3 text-left transition-colors \" + (carnetInterestWaived ? \"bg-emerald-50 border-emerald-200\" : \"bg-amber-50 border-amber-200\"),",
    "                            'aria-pressed': carnetInterestWaived",
    "                        },",
    "                            React.createElement('strong', { className: carnetInterestWaived ? \"text-sm text-emerald-800\" : \"text-sm text-amber-800\" }, \"Parcelamento sem juros\"),",
    "                            React.createElement('span', { className: \"shrink-0 w-11 h-6 rounded-full p-1 transition-colors \" + (carnetInterestWaived ? \"bg-emerald-500\" : \"bg-slate-300\") },",
    "                                React.createElement('span', { className: \"block w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform \" + (carnetInterestWaived ? \"translate-x-5\" : \"translate-x-0\") })",
    "                            )",
    "                        ),",
    paymentSummaryTitleMarker
].join("\\n");`;

wrapperSource = wrapperSource.replace(waiverBlockPattern, simplifiedWaiverBlock);

const featurePatchEndMarker = "`;\n\nsource = source.replace(finalSourceMarker, featurePatch + '\\n' + finalSourceMarker);";
if (!wrapperSource.includes(featurePatchEndMarker)) {
    throw new Error('Não foi possível integrar a venda avulsa ao formulário.');
}

const anonymousSalePatch = String.raw`
const requiredCustomerMarker = '        if (!customerId) return alert("Selecione um cliente.");';
if (!source.includes(requiredCustomerMarker)) {
    throw new Error('Não foi possível ajustar a obrigatoriedade do cliente.');
}
source = source.replace(
    requiredCustomerMarker,
    '        if (saleType === \'prazo\' && !customerId) return alert("Selecione um cliente cadastrado.");'
);

const customerIdentityMarker = [
    '        const customer = customers.find(c => c.id === customerId);',
    '        const cName = customer ? customer.name : customerSearch;',
    '        const cPhone = customer ? customer.phone : "";'
].join('\n');
if (!source.includes(customerIdentityMarker)) {
    throw new Error('Não foi possível preparar a identificação da venda avulsa.');
}
source = source.replace(
    customerIdentityMarker,
    [
        "        const customer = customerId ? customers.find(c => c.id === customerId) : null;",
        "        const isAnonymousDirectSale = saleType === 'direct' && !customer;",
        "        const cName = customer ? customer.name : (isAnonymousDirectSale ? 'VENDA AVULSA' : customerSearch);",
        "        const cPhone = customer ? customer.phone : '';"
    ].join('\n')
);

const saleCustomerMarker = '            customerId: customerId, customerName: cName, customerPhone: cPhone, ';
if (!source.includes(saleCustomerMarker)) {
    throw new Error('Não foi possível registrar a venda avulsa.');
}
source = source.replace(
    saleCustomerMarker,
    '            customerId: customer ? customer.id : null, customerName: cName, customerPhone: cPhone, anonymousSale: isAnonymousDirectSale, '
);

const customerTitleMarker = 'React.createElement(\'h3\', { className: "font-bold text-slate-800 flex items-center gap-2" }, React.createElement(User, { className: "text-slate-400" }), "1. Cliente"),';
if (!source.includes(customerTitleMarker)) {
    throw new Error('Não foi possível identificar o título do cliente no formulário.');
}
source = source.replace(
    customerTitleMarker,
    'React.createElement(\'h3\', { className: "font-bold text-slate-800 flex items-center gap-2" }, React.createElement(User, { className: "text-slate-400" }), mode === \'prazo\' ? "1. Cliente" : "1. Cliente (Opcional)"),'
);

const customerPlaceholderMarker = '                                placeholder: "Busque pelo nome do cliente...",';
if (!source.includes(customerPlaceholderMarker)) {
    throw new Error('Não foi possível ajustar o campo de cliente da venda no caixa.');
}
source = source.replace(
    customerPlaceholderMarker,
    '                                placeholder: mode === \'prazo\' ? "Busque pelo nome do cliente..." : "Cliente opcional — deixe em branco para venda avulsa",'
);
`;

wrapperSource = wrapperSource.replace(
    featurePatchEndMarker,
    anonymousSalePatch + '\n' + featurePatchEndMarker
);

const wrapperUrl = URL.createObjectURL(new Blob([wrapperSource], { type: 'text/javascript' }));
let patchedModule;
try {
    patchedModule = await import(wrapperUrl);
} finally {
    URL.revokeObjectURL(wrapperUrl);
}

export const NewSaleScreen = patchedModule.NewSaleScreen;
