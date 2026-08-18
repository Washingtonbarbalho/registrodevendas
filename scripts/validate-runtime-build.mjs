import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const activeModules = [
  'bootstrap-v60.js',
  'app-patch-setup-v59.js',
  'app-patch-stock-v52.js',
  'app-patch-cancel-v59.js',
  'app-patch-profit-v58.js',
  'app-patch-final-v60.js',
  'app.js',
  'aba-financeiro-v54.js',
  'stock-movement-modal-v52.js',
  'aba-vendas-caixa-v52.js',
  'aba-vendas-prazo-v52.js',
  'aba-clientes-fixed-v52.js',
  'modals-fixed-v59.js',
  'nova-venda-fixed-v60.js',
  'nova-venda-fixed-v59.js',
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

const { applySetupPatches } = await importFresh('app-patch-setup-v59.js');
const { applyStockPatch } = await importFresh('app-patch-stock-v52.js');
const { applyCancelPatch } = await importFresh('app-patch-cancel-v59.js');
const { applyProfitPatch } = await importFresh('app-patch-profit-v58.js');
const { applyFinalPatches } = await importFresh('app-patch-final-v60.js');

let source = await readFile(resolve(root, 'app.js'), 'utf8');
source = applySetupPatches(source);
source = applyStockPatch(source);
source = applyCancelPatch(source);
source = applyProfitPatch(source);
source = applyFinalPatches(source);

const generatedFile = join(tmpdir(), `registrodevendas-generated-${Date.now()}.mjs`);
await writeFile(generatedFile, source, 'utf8');
checkSyntax(generatedFile);

if (source.includes('SaleCancellationModal')) {
  throw new Error('O fluxo de cancelamento parcial ainda está ligado à aplicação final.');
}
if (!source.includes('React.createElement(ConfirmModal, { isOpen: cancelModal.open, title: "Cancelar venda?"')) {
  throw new Error('O cancelamento total simples não está ligado ao modal padrão.');
}
if (!source.includes('nova-venda-fixed-v60.js')) {
  throw new Error('A aplicação final não está apontando para a Nova Venda v60.');
}

const legacyNewSale = await readFile(resolve(root, 'nova-venda-fixed-v59.js'), 'utf8');
for (const marker of [
  'cardBaseAmount / (1 - cardFeeFraction)',
  'cardBaseAmount * cardFeeFraction',
  'const netAmountToCompany = totalCustomerPays - currentFeeValue;',
  'saleDateTime: new Date().toISOString()',
  "const [saleNotes, setSaleNotes] = useState('');",
  'notes: saleNotes.trim()'
]) {
  if (!legacyNewSale.includes(marker)) throw new Error(`Proteção herdada da Nova Venda ausente: ${marker}`);
}

const stableNewSale = await readFile(resolve(root, 'nova-venda-fixed-v60.js'), 'utf8');
for (const marker of [
  'Observações (Opcional)',
  'notesDefinitionsPattern',
  'hasPaymentSectionEndMarker',
  'Resumo do pagamento não inserido porque a estrutura visual da seção foi alterada.',
  './nova-venda-fixed-v59.js?v=${VERSION}',
  "pathname.endsWith('/nova-venda-fixed.js')"
]) {
  if (!stableNewSale.includes(marker)) throw new Error(`Proteção da Nova Venda v60 ausente: ${marker}`);
}
if (stableNewSale.includes('"4. Observações"')) {
  throw new Error('As observações ainda estão sendo injetadas como seção posterior ao Pagamento.');
}

// Teste estrutural do problema que derrubou a v59.
// A nova posição das Observações deve preservar, byte a byte, o fechamento que
// o resumo de pagamento legado procura.
const baseSaleSource = await readFile(resolve(root, 'nova-venda.js'), 'utf8');
const notesAnchor = `                    ),\n\n                    mode === 'prazo' && React.createElement('div', { className: "space-y-4 animate-fade-in" },`;
const paymentSectionEndMarker = `                    )\n                )\n            )\n        ),\n        \n        React.createElement('div', { className: "sale-bottom-bar fixed bottom-0 w-full p-4 z-40" },`;
if (!baseSaleSource.includes(notesAnchor)) {
  throw new Error('O ponto seguro de inserção das Observações não existe mais no formulário-base.');
}
if (!baseSaleSource.includes(paymentSectionEndMarker)) {
  throw new Error('O fechamento original da seção Pagamento não existe no formulário-base.');
}
const simulatedNotesSource = baseSaleSource.replace(
  notesAnchor,
  `                    ),\n                    /* OBSERVACOES_V60 */\n\n                    mode === 'prazo' && React.createElement('div', { className: "space-y-4 animate-fade-in" },`
);
if (!simulatedNotesSource.includes(paymentSectionEndMarker)) {
  throw new Error('A inserção das Observações voltou a quebrar o fechamento da seção Pagamento.');
}

const baseWrapper = await readFile(resolve(root, 'nova-venda-fixed.js'), 'utf8');
if (!baseWrapper.includes('paymentSectionEndMarker') || !baseWrapper.includes('Não foi possível localizar o final da seção de pagamento.')) {
  throw new Error('O contrato legado do resumo de pagamento mudou sem atualização da proteção v60.');
}

const cancelPatch = await readFile(resolve(root, 'app-patch-cancel-v59.js'), 'utf8');
for (const marker of [
  "type: 'total'",
  'customerRefundAmount',
  'storeImpactAmount',
  'refundAmount: storeImpactAmount',
  'canceledCostAmount',
  'profitImpactAmount',
  'quantity: currentQty + row.quantity'
]) {
  if (!cancelPatch.includes(marker)) throw new Error(`Proteção do cancelamento total ausente: ${marker}`);
}
if (cancelPatch.includes('payload.mode') || cancelPatch.includes("type: 'partial'")) {
  throw new Error('Foi encontrado um caminho de novo cancelamento parcial.');
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

const detailsModal = await readFile(resolve(root, 'modals-fixed-v59.js'), 'utf8');
if (!detailsModal.includes('sale.notes') || !detailsModal.includes('Observações da venda')) {
  throw new Error('As observações da venda não estão disponíveis no detalhe da venda.');
}

const financeSource = await readFile(resolve(root, 'aba-financeiro-v54.js'), 'utf8');
if (!financeSource.includes('event.refundAmount')) {
  throw new Error('O Financeiro deixou de considerar o estorno do cancelamento.');
}

console.log(`Validação concluída: ${activeModules.length} módulos ativos + app final + teste estrutural da Nova Venda v60 + cancelamento total + observações.`);
