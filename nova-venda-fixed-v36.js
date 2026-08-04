const VERSION = '36';

const response = await fetch(`./nova-venda-fixed-v34.js?v=${VERSION}`, { cache: 'no-store' });
if (!response.ok) {
    throw new Error(`Não foi possível carregar o formulário de vendas (${response.status}).`);
}

let wrapperSource = await response.text();

if (!wrapperSource.includes("const VERSION = '34';")) {
    throw new Error('Não foi possível corrigir a versão do formulário de vendas.');
}
wrapperSource = wrapperSource.replace("const VERSION = '34';", `const VERSION = '${VERSION}';`);

// Corrige os separadores que existem no próprio arquivo da versão 34.
wrapperSource = wrapperSource
    .replaceAll('].join("\\\\n");', '].join("\\n");')
    .replaceAll(".join('\\\\n')", ".join('\\n')");

// A versão 34 carrega a versão 33 internamente. Este bloco garante que
// todos os separadores antigos também sejam corrigidos antes da montagem final.
const loaderMarker = 'let wrapperSource = await response.text();';
if (!wrapperSource.includes(loaderMarker)) {
    throw new Error('Não foi possível localizar o carregamento interno do formulário.');
}

const normalizedLoader = String.raw`let wrapperSource = await response.text();

wrapperSource = wrapperSource
    .replaceAll('].join("\\\\n");', '].join("\\n");')
    .replaceAll(".join('\\\\n')", ".join('\\n')");`;

wrapperSource = wrapperSource.replace(loaderMarker, normalizedLoader);

const wrapperUrl = URL.createObjectURL(new Blob([wrapperSource], { type: 'text/javascript' }));
let patchedModule;
try {
    patchedModule = await import(wrapperUrl);
} finally {
    URL.revokeObjectURL(wrapperUrl);
}

export const NewSaleScreen = patchedModule.NewSaleScreen;
