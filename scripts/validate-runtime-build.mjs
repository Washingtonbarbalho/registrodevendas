import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const activeModules = [
  'bootstrap-v56.js',
  'app-patch-setup-v52.js',
  'app-patch-stock-v52.js',
  'app-patch-cancel-v52.js',
  'app-patch-final-v55.js',
  'app.js',
  'aba-financeiro-v54.js',
  'stock-movement-modal-v52.js',
  'sale-cancellation-modal-v52.js',
  'aba-vendas-caixa-v52.js',
  'aba-vendas-prazo-v52.js',
  'aba-clientes-fixed-v52.js',
  'modals-fixed-v52.js',
  'nova-venda-fixed-v55.js',
  'nova-venda-fixed-v55-core.js',
  'nova-venda-fixed.js',
  'nova-venda.js',
  'payment-settings.js',
  'utils.js',
  'components.js',
  'firebase-config.js',
  'tab-persistence.js'
];

const checkSyntax = file => {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`Erro de sintaxe em ${file}:\n${detail}`);
  }
};

for (const relativeFile of activeModules) {
  checkSyntax(resolve(root, relativeFile));
}

Object.defineProperty(globalThis, 'location', {
  configurable: true,
  value: { href: 'https://example.test/registrodevendas/' }
});

const importFresh = async relativeFile => {
  const url = pathToFileURL(resolve(root, relativeFile));
  url.search = `ci=${Date.now()}-${Math.random()}`;
  return import(url.href);
};

const { applySetupPatches } = await importFresh('app-patch-setup-v52.js');
const { applyStockPatch } = await importFresh('app-patch-stock-v52.js');
const { applyCancelPatch } = await importFresh('app-patch-cancel-v52.js');
const { applyFinalPatches } = await importFresh('app-patch-final-v55.js');

let source = await readFile(resolve(root, 'app.js'), 'utf8');
source = applySetupPatches(source);
source = applyStockPatch(source);
source = applyCancelPatch(source);
source = applyFinalPatches(source);

const generatedFile = join(tmpdir(), `registrodevendas-generated-${Date.now()}.mjs`);
await writeFile(generatedFile, source, 'utf8');
checkSyntax(generatedFile);

const compatibilityLine = '    const netAmountToCompany = totalCustomerPays - currentFeeValue;';
const baseSaleSource = await readFile(resolve(root, 'nova-venda.js'), 'utf8');
if (!baseSaleSource.includes(compatibilityLine)) {
  throw new Error('A base da Nova Venda mudou e precisa de revisão antes de publicar.');
}

const summaryWrapperSource = await readFile(resolve(root, 'nova-venda-fixed.js'), 'utf8');
const summaryMarker = `const financialMarker = '${compatibilityLine}';`;
if (!summaryWrapperSource.includes(summaryMarker)) {
  throw new Error('O construtor do resumo de pagamento mudou e precisa de revisão.');
}

const cardCoreSource = await readFile(resolve(root, 'nova-venda-fixed-v55-core.js'), 'utf8');
if (!cardCoreSource.includes(`const newCardFinancialBlock = \``) || !cardCoreSource.includes(compatibilityLine)) {
  throw new Error('A fórmula do cartão deixou de preservar a linha exigida pelo resumo de pagamento.');
}
if (!cardCoreSource.includes('cardBaseAmount / (1 - cardFeeFraction)')) {
  throw new Error('A fórmula de repasse da taxa ao cliente não está usando valor líquido dividido por 1 menos a taxa.');
}
if (!cardCoreSource.includes('cardBaseAmount * cardFeeFraction')) {
  throw new Error('O cálculo da taxa assumida pela loja não está proporcional ao valor passado no cartão.');
}
if (!cardCoreSource.includes('saleDateTime: new Date().toISOString()')) {
  throw new Error('O horário real das novas vendas não está sendo registrado.');
}

const saleBridgeSource = await readFile(resolve(root, 'nova-venda-fixed-v55.js'), 'utf8');
if (!saleBridgeSource.includes("nova-venda-fixed-v55-core.js?v=56")) {
  throw new Error('A Nova Venda não está apontando para o núcleo estável da v56.');
}

console.log(`Validação concluída: ${activeModules.length} módulos ativos + app.js final gerado + fórmula/cartão/resumo/horário compatíveis.`);