const VERSION = '60';
const originalFetch = globalThis.fetch;

const shouldHardenPaymentWrapper = input => {
    try {
        const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
        return !!raw && new URL(raw, location.href).pathname.endsWith('/nova-venda-fixed.js');
    } catch {
        return false;
    }
};

// Proteção de compatibilidade: o resumo do pagamento é útil, mas nunca deve
// impedir o aplicativo inteiro de iniciar caso a estrutura visual seja alterada.
globalThis.fetch = async (input, init) => {
    const response = await originalFetch.call(globalThis, input, init);
    if (!shouldHardenPaymentWrapper(input) || !response.ok) return response;

    let source = await response.text();
    const oldGuard = `if (!source.includes(paymentSectionEndMarker)) {
    throw new Error('Não foi possível localizar o final da seção de pagamento.');
}`;
    const safeGuard = `const hasPaymentSectionEndMarker = source.includes(paymentSectionEndMarker);
if (!hasPaymentSectionEndMarker) {
    console.warn('Resumo do pagamento não inserido porque a estrutura visual da seção foi alterada.');
}`;
    const oldApply = `source = source.replace(paymentSectionEndMarker, paymentSectionWithSummary);`;
    const safeApply = `if (hasPaymentSectionEndMarker) {
    source = source.replace(paymentSectionEndMarker, paymentSectionWithSummary);
}`;

    if (source.includes(oldGuard)) source = source.replace(oldGuard, safeGuard);
    if (source.includes(oldApply)) source = source.replace(oldApply, safeApply);

    const headers = new Headers(response.headers);
    headers.set('content-type', 'text/javascript; charset=utf-8');
    return new Response(source, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
};

let templateResponse;
let templateSource;
try {
    templateResponse = await originalFetch.call(globalThis, `./nova-venda-fixed-v59.js?v=${VERSION}`, { cache: 'no-store' });
    if (!templateResponse.ok) throw new Error(`Não foi possível carregar a base da Nova Venda (${templateResponse.status}).`);
    templateSource = await templateResponse.text();

    if (!templateSource.includes("const VERSION = '59';")) {
        throw new Error('A base da Nova Venda não corresponde à versão esperada.');
    }
    templateSource = templateSource.replace("const VERSION = '59';", `const VERSION = '${VERSION}';`);

    // Como a base v59 será executada a partir de um Blob, o import interno
    // precisa ser absoluto para não depender da resolução de URLs do Blob.
    const internalImportMarker = "finalModule = await import(`./nova-venda-fixed-v36.js?v=${VERSION}`);";
    const internalImportReplacement = "finalModule = await import(new URL('./nova-venda-fixed-v36.js?v=' + VERSION, location.href).href);";
    if (!templateSource.includes(internalImportMarker)) {
        throw new Error('Não foi possível estabilizar o carregamento interno da Nova Venda.');
    }
    templateSource = templateSource.replace(internalImportMarker, internalImportReplacement);

    // Na v59 as Observações eram inseridas exatamente no fechamento da seção
    // Pagamento. Isso destruía o marcador utilizado pelo resumo. Na v60 o campo
    // passa a ficar dentro da própria seção de Pagamento, logo após o cabeçalho,
    // sem tocar em nenhum fechamento estrutural.
    const notesDefinitionsPattern = /const notesUiMarker = `[\s\S]*?const oldCardFinancialBlock = `/;
    if (!notesDefinitionsPattern.test(templateSource)) {
        throw new Error('Não foi possível preparar o campo de observações da venda.');
    }

    const correctedNotesDefinitions = [
        "const notesUiMarker = `                    ),",
        "",
        "                    mode === 'prazo' && React.createElement('div', { className: \"space-y-4 animate-fade-in\" },`;",
        "const notesUiReplacement = `                    ),",
        "",
        "                    React.createElement('div', { className: \"mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3\" },",
        "                        React.createElement('label', { className: \"block text-[10px] font-bold text-slate-500 uppercase mb-1\" }, \"Observações (Opcional)\"),",
        "                        React.createElement('textarea', {",
        "                            rows: 3,",
        "                            value: saleNotes,",
        "                            onChange: e => setSaleNotes(e.target.value),",
        "                            placeholder: \"Ex.: condição combinada, troca posterior, informação adicional...\",",
        "                            className: \"w-full p-3 border border-slate-200 rounded-lg bg-white text-sm resize-y focus:outline-none focus:ring-2 \" + (mode === 'prazo' ? 'focus:ring-yellow-500' : 'focus:ring-emerald-500')",
        "                        })",
        "                    ),",
        "",
        "                    mode === 'prazo' && React.createElement('div', { className: \"space-y-4 animate-fade-in\" },`;",
        "",
        "const oldCardFinancialBlock = `"
    ].join('\n');

    templateSource = templateSource.replace(notesDefinitionsPattern, correctedNotesDefinitions);

    const wrapperUrl = URL.createObjectURL(new Blob([templateSource], { type: 'text/javascript' }));
    try {
        const module = await import(wrapperUrl);
        if (typeof module?.NewSaleScreen !== 'function') {
            throw new Error('A Nova Venda corrigida não exportou o formulário corretamente.');
        }
        globalThis.__registroVendasNewSaleV60 = module.NewSaleScreen;
    } finally {
        URL.revokeObjectURL(wrapperUrl);
    }
} finally {
    globalThis.fetch = originalFetch;
}

if (typeof globalThis.__registroVendasNewSaleV60 !== 'function') {
    throw new Error('O formulário de vendas v60 não foi carregado corretamente.');
}

export const NewSaleScreen = globalThis.__registroVendasNewSaleV60;
delete globalThis.__registroVendasNewSaleV60;
