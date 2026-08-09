const VERSION = '38';

const response = await fetch(`./nova-venda-fixed-v37.js?v=${VERSION}`, { cache: 'no-store' });
if (!response.ok) {
    throw new Error(`Não foi possível carregar o formulário de vendas (${response.status}).`);
}

let wrapperSource = await response.text();

if (!wrapperSource.includes("const VERSION = '37';")) {
    throw new Error('Não foi possível preparar a correção do formulário de vendas.');
}
wrapperSource = wrapperSource.replace("const VERSION = '37';", `const VERSION = '${VERSION}';`);

const patternStart = wrapperSource.indexOf('const directBranchPattern = ');
const patternEnd = wrapperSource.indexOf('\nif (!directBranchPattern.test(source))', patternStart);

if (patternStart < 0 || patternEnd < 0) {
    throw new Error('Não foi possível localizar a validação da venda no cartão.');
}

const robustDirectBranchPattern = String.raw`const directBranchPattern = /        \} else \{\s*let finalSalePrice = totalCartValue;[\s\S]*?onSaveSale\(saleData\);\s*onClose\(\);\s*\}/;`;

wrapperSource = wrapperSource.slice(0, patternStart)
    + robustDirectBranchPattern
    + wrapperSource.slice(patternEnd);

const wrapperUrl = URL.createObjectURL(new Blob([wrapperSource], { type: 'text/javascript' }));
let patchedModule;
try {
    patchedModule = await import(wrapperUrl);
} finally {
    URL.revokeObjectURL(wrapperUrl);
}

export const NewSaleScreen = patchedModule.NewSaleScreen;
