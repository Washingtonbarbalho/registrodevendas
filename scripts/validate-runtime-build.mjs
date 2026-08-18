import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const activeModules = [
  'bootstrap-v58.js',
  'app-patch-setup-v58.js',
  'app-patch-stock-v52.js',
  'app-patch-cancel-v58.js',
  'app-patch-profit-v58.js',
  'app-patch-final-v58.js',
  'app.js',
  'aba-financeiro-v54.js',
  'stock-movement-modal-v52.js',
  'sale-cancellation-modal-v58.js',
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

const { applySetupPatches } = await importFresh('app-patch-setup-v58.js');
const { applyStockPatch } = await importFresh('app-patch-stock-v52.js');
const { applyCancelPatch } = await importFresh('app-patch-cancel-v58.js');
const { applyProfitPatch } = await importFresh('app-patch-profit-v58.js');
const { applyFinalPatches } = await importFresh('app-patch-final-v58.js');

let source = await readFile(resolve(root, 'app.js'), 'utf8');
source = applySetupPatches(source);
source = applyStockPatch(source);
source = applyCancelPatch(source);
source = applyProfitPatch(source);
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

const cancelPatch = await readFile(resolve(root, 'app-patch-cancel-v58.js'), 'utf8');
for (const marker of [
  'customerRefundAmount',
  'storeImpactAmount',
  'refundAmount: storeImpactAmount',
  'canceledCostAmount',
  'profitImpactAmount',
  'customerPaidAmount',
  'storeNetAmount'
]) {
  if (!cancelPatch.includes(marker)) throw new Error(`Proteção do cancelamento proporcional ausente: ${marker}`);
}

const profitPatch = await readFile(resolve(root, 'app-patch-profit-v58.js'), 'utf8');
for (const marker of [
  'getDirectProfitNetAmount',
  'event?.storeImpactAmount ?? event?.refundAmount',
  'realProfit += getDirectProfitNetAmount(s)',
  'getDirectProfitNetAmount(s) - (s.totalCost || 0)'
]) {
  if (!profitPatch.includes(marker)) throw new Error(`Proteção do lucro após cancelamento ausente: ${marker}`);
}

const cancellationModal = await readFile(resolve(root, 'sale-cancellation-modal-v58.js'), 'utf8');
for (const marker of ['Estorno ao cliente', 'Impacto líquido da loja', 'Lucro referente ao cancelamento']) {
  if (!cancellationModal.includes(marker)) throw new Error(`Resumo do cancelamento incompleto: ${marker}`);
}

const financeSource = await readFile(resolve(root, 'aba-financeiro-v54.js'), 'utf8');
if (!financeSource.includes('event.refundAmount')) {
  throw new Error('O Financeiro deixou de considerar o impacto líquido registrado no cancelamento.');
}

console.log(`Validação concluída: ${activeModules.length} módulos ativos + app final + cartão + estorno + lucro proporcional sem erros de sintaxe.`);
