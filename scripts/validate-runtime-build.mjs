import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const activeModules = [
  'bootstrap-v55.js',
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

const baseSaleSource = await readFile(resolve(root, 'nova-venda.js'), 'utf8');
const oldCardMarker = "    const netAmountToCompany = totalCustomerPays - currentFeeValue;";
if (!baseSaleSource.includes(oldCardMarker)) {
  throw new Error('A base da Nova Venda mudou e precisa de revisão antes de publicar.');
}

const summaryWrapperSource = await readFile(resolve(root, 'nova-venda-fixed.js'), 'utf8');
const compatibilityMarker = "const financialMarker = '    const netAmountToCompany = totalCustomerPays - currentFeeValue;';";
if (!summaryWrapperSource.includes(compatibilityMarker)) {
  throw new Error('O construtor do resumo de pagamento mudou e precisa de revisão.');
}

const v55WrapperSource = await readFile(resolve(root, 'nova-venda-fixed-v55.js'), 'utf8');
if (!v55WrapperSource.includes('financialMarkerMatch') || !v55WrapperSource.includes('nova-venda-fixed-v55-core.js')) {
  throw new Error('A camada de compatibilidade da Nova Venda v55 está incompleta.');
}

console.log(`Validação concluída: ${activeModules.length} módulos ativos + app.js final gerado + compatibilidade da Nova Venda sem erros de sintaxe.`);