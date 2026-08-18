import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const activeModules = [
  'bootstrap-v57.js',
  'app-patch-setup-v57.js',
  'app-patch-stock-v52.js',
  'app-patch-cancel-v57.js',
  'app-patch-final-v57.js',
  'app.js',
  'aba-financeiro-v54.js',
  'stock-movement-modal-v52.js',
  'sale-cancellation-modal-v57.js',
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

for (const relativeFile of activeModules) checkSyntax(resolve(root, relativeFile));

Object.defineProperty(globalThis, 'location', {
  configurable: true,
  value: { href: 'https://example.test/registrodevendas/' }
});

const importFresh = async relativeFile => {
  const url = pathToFileURL(resolve(root, relativeFile));
  url.search = `ci=${Date.now()}-${Math.random()}`;
  return import(url.href);
};

const { applySetupPatches } = await importFresh('app-patch-setup-v57.js');
const { applyStockPatch } = await importFresh('app-patch-stock-v52.js');
const { applyCancelPatch } = await importFresh('app-patch-cancel-v57.js');
const { applyFinalPatches } = await importFresh('app-patch-final-v57.js');

let source = await readFile(resolve(root, 'app.js'), 'utf8');
source = applySetupPatches(source);
source = applyStockPatch(source);
source = applyCancelPatch(source);
source = applyFinalPatches(source);

const generatedFile = join(tmpdir(), `registrodevendas-generated-${Date.now()}.mjs`);
await writeFile(generatedFile, source, 'utf8');
checkSyntax(generatedFile);

const cardCore = await readFile(resolve(root, 'nova-venda-fixed-v55-core.js'), 'utf8');
for (const marker of [
  'cardBaseAmount / (1 - cardFeeFraction)',
  'cardBaseAmount * cardFeeFraction',
  'const netAmountToCompany = totalCustomerPays - currentFeeValue;',
  'saleDateTime: new Date().toISOString()'
]) {
  if (!cardCore.includes(marker)) throw new Error(`Proteção da Nova Venda ausente: ${marker}`);
}

const cancelPatch = await readFile(resolve(root, 'app-patch-cancel-v57.js'), 'utf8');
for (const marker of [
  'customerRefundAmount',
  'storeImpactAmount',
  'refundAmount: storeImpactAmount',
  "feeResponsibility = isCardSale ? (sale.feeConfig?.type === 'com_juros' ? 'customer' : 'store') : null",
  'customerPaidAmount',
  'storeNetAmount'
]) {
  if (!cancelPatch.includes(marker)) throw new Error(`Proteção do cancelamento proporcional ausente: ${marker}`);
}

const cancellationModal = await readFile(resolve(root, 'sale-cancellation-modal-v57.js'), 'utf8');
if (!cancellationModal.includes('Estorno ao cliente') || !cancellationModal.includes('Impacto líquido da loja')) {
  throw new Error('O modal não diferencia o estorno ao cliente do impacto líquido da loja.');
}

const financeSource = await readFile(resolve(root, 'aba-financeiro-v54.js'), 'utf8');
if (!financeSource.includes('event.refundAmount')) {
  throw new Error('O Financeiro deixou de considerar o impacto líquido registrado no cancelamento.');
}

console.log(`Validação concluída: ${activeModules.length} módulos ativos + app final + cartão + cancelamento proporcional sem erros de sintaxe.`);
