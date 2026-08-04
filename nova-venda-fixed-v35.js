const VERSION = '35';

const response = await fetch(`./nova-venda-fixed-v34.js?v=${VERSION}`, { cache: 'no-store' });
if (!response.ok) {
    throw new Error(`Não foi possível carregar o formulário de vendas (${response.status}).`);
}

let wrapperSource = await response.text();

if (!wrapperSource.includes("const VERSION = '34';")) {
    throw new Error('Não foi possível corrigir a versão do formulário de vendas.');
}
wrapperSource = wrapperSource.replace("const VERSION = '34';", `const VERSION = '${VERSION}';`);

// A versão anterior gerou separadores "\\n" literais dentro do código montado.
// Eles precisam ser convertidos em "\n" para que o código final receba quebras de linha reais.
const doubleQuoteJoin = '].join("\\\\n");';
const correctedDoubleQuoteJoin = '].join("\\n");';
const singleQuoteJoin = ".join('\\\\n')";
const correctedSingleQuoteJoin = ".join('\\n')";

if (!wrapperSource.includes(doubleQuoteJoin) || !wrapperSource.includes(singleQuoteJoin)) {
    throw new Error('Não foi possível localizar os separadores inválidos da versão anterior.');
}

wrapperSource = wrapperSource
    .replaceAll(doubleQuoteJoin, correctedDoubleQuoteJoin)
    .replaceAll(singleQuoteJoin, correctedSingleQuoteJoin);

const wrapperUrl = URL.createObjectURL(new Blob([wrapperSource], { type: 'text/javascript' }));
let patchedModule;
try {
    patchedModule = await import(wrapperUrl);
} finally {
    URL.revokeObjectURL(wrapperUrl);
}

export const NewSaleScreen = patchedModule.NewSaleScreen;
