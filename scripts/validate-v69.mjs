import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { applySetupPatches } from '../app-patch-setup-v59.js';
import { applyReportsPatch } from '../app-patch-reports-v65.js';
import { applyStockPatch } from '../app-patch-stock-v68.js';
import { applyCancelPatch } from '../app-patch-cancel-v59.js';
import { applyProfitPatch } from '../app-patch-profit-v58.js';
import { applySalePdfPatch } from '../app-patch-sale-pdf-v65.js';
import { applyMobileMenuPatch } from '../app-patch-mobile-menu-v66.js';
import { applyBatchStockPatch } from '../app-patch-batch-stock-v68.js';
import { applySecurityReliabilityPatch } from '../app-patch-security-v69.js';
import { applyFinalPatches } from '../app-patch-final-v69.js';
import { aggregateSaleItems, buildSaleInventoryPlan, InventoryReliabilityError } from '../inventory-reliability-v69.js';

globalThis.location = new URL('https://example.test/registrodevendas/');

const checkSyntax = file => {
  const filePath = file instanceof URL ? fileURLToPath(file) : file;
  const result = spawnSync(process.execPath, ['--check', filePath], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Erro de sintaxe em ${file}:\n${result.stderr || result.stdout}`);
};

const extractFunction = (source, startMarker, endMarker, functionName) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Não foi possível extrair ${functionName} para teste.`);
  return Function(`${source.slice(start, end)}\nreturn ${functionName};`)();
};

for (const file of [
  'bootstrap-v69.js', 'app-patch-security-v69.js', 'app-patch-final-v69.js', 'inventory-reliability-v69.js',
  'nova-venda-fixed-v69.js', 'modals-fixed-v69.js', 'auth-admin.js', 'batch-stock-modal-v68.js'
]) checkSyntax(new URL(`../${file}`, import.meta.url));

const requested = aggregateSaleItems([
  { productId: 'perfume-1', productName: 'Perfume 1', quantity: 2 },
  { productId: 'perfume-1', productName: 'Perfume 1', quantity: 1 },
  { productId: 'perfume-2', productName: 'Perfume 2', quantity: 1 }
]);
if (requested.length !== 2 || requested[0].requestedQuantity !== 3) throw new Error('Itens repetidos da venda não foram consolidados.');
const plan = buildSaleInventoryPlan(requested, [
  { productId: 'perfume-1', quantity: 3 },
  { productId: 'perfume-2', quantity: 5 }
]);
if (plan[0].newQuantity !== 0 || plan[1].newQuantity !== 4) throw new Error('Plano de baixa de estoque incorreto.');

let insufficientStockWasBlocked = false;
try {
  buildSaleInventoryPlan([{ productId: 'perfume-1', productName: 'Perfume 1', requestedQuantity: 4 }], [{ productId: 'perfume-1', quantity: 3 }]);
} catch (error) {
  insufficientStockWasBlocked = error instanceof InventoryReliabilityError && error.code === 'insufficient-stock';
}
if (!insufficientStockWasBlocked) throw new Error('Venda acima do estoque não foi bloqueada.');

let invalidQuantityWasBlocked = false;
try { aggregateSaleItems([{ productId: 'perfume-1', productName: 'Perfume 1', quantity: 0 }]); }
catch (error) { invalidQuantityWasBlocked = error instanceof InventoryReliabilityError && error.code === 'invalid-quantity'; }
if (!invalidQuantityWasBlocked) throw new Error('Quantidade inválida não foi bloqueada.');

let emptySaleWasBlocked = false;
try { aggregateSaleItems([]); }
catch (error) { emptySaleWasBlocked = error instanceof InventoryReliabilityError && error.code === 'empty-sale'; }
if (!emptySaleWasBlocked) throw new Error('Venda sem produtos não foi bloqueada.');

let source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
for (const patch of [
  applySetupPatches, applyReportsPatch, applyStockPatch, applyCancelPatch, applyProfitPatch,
  applySalePdfPatch, applyMobileMenuPatch, applyBatchStockPatch, applySecurityReliabilityPatch, applyFinalPatches
]) source = patch(source);

const generatedFile = '/tmp/registro-vendas-runtime-v69.mjs';
fs.writeFileSync(generatedFile, source);
checkSyntax(generatedFile);

for (const marker of [
  'runTransaction(db, async transaction =>',
  'buildSaleInventoryPlan(requestedItems, inventoryRecords)',
  'inventoryOperationId: saleRef.id',
  "setAccessDenied('deleted')",
  'onSnapshot(profileRef',
  'modals-fixed-v69.js?v=69',
  'nova-venda-fixed-v69.js?v=69',
  'inventory-reliability-v69.js?v=69',
  "status === 'blocked'",
  'Nenhuma venda ou baixa de estoque foi gravada',
  'Vendas não podem ser excluídas permanentemente'
]) if (!source.includes(marker)) throw new Error(`Proteção ausente na aplicação final: ${marker}`);

for (const forbidden of [
  'profileSnap.exists() && !publicSnap.exists()',
  'await setDoc(publicRef, publicProfile)',
  'currentQty - qtyDeducted'
]) if (source.includes(forbidden)) throw new Error(`Fluxo inseguro ainda presente na aplicação final: ${forbidden}`);

const authSource = fs.readFileSync(new URL('../auth-admin.js', import.meta.url), 'utf8');
for (const marker of ['writeBatch(db)', "status: 'deleted'", 'deletedBy:', 'Criar uma conta']) {
  if (!authSource.includes(marker)) throw new Error(`Proteção de usuários ausente: ${marker}`);
}
for (const forbidden of ['where("email"', 'forceCreateUserData', 'pixKey, pixBank, pixName };\n        await updateDoc']) {
  if (authSource.includes(forbidden)) throw new Error(`Fluxo de privacidade antigo ainda presente: ${forbidden}`);
}

const batchStock = fs.readFileSync(new URL('../batch-stock-modal-v68.js', import.meta.url), 'utf8');
if (!batchStock.includes('runTransaction(db, async transaction =>') || batchStock.includes('writeBatch(db)')) {
  throw new Error('A movimentação em lote não está protegida contra concorrência.');
}

const pixWrapper = fs.readFileSync(new URL('../modals-fixed-v69.js', import.meta.url), 'utf8');
for (const marker of ['QRCode.toDataURL', 'QR Code é gerado neste aparelho', "qrcode@1.5.4"]) {
  if (!pixWrapper.includes(marker)) throw new Error(`Proteção local do PIX ausente: ${marker}`);
}
const patchPixPrivacy = extractFunction(pixWrapper, 'const patchPixPrivacy =', 'globalThis.fetch =', 'patchPixPrivacy');
const patchedModals = patchPixPrivacy(fs.readFileSync(new URL('../modals.js', import.meta.url), 'utf8'));
if (patchedModals.includes('api.qrserver.com') || !patchedModals.includes('QRCode.toDataURL')) {
  throw new Error('O módulo final dos modais ainda enviaria o payload PIX ao serviço externo.');
}
fs.writeFileSync('/tmp/registro-vendas-modals-v69.mjs', patchedModals);
checkSyntax('/tmp/registro-vendas-modals-v69.mjs');

const saleWrapper = fs.readFileSync(new URL('../nova-venda-fixed-v69.js', import.meta.url), 'utf8');
for (const marker of ['await onSaveSale(saleData)', 'if (await persistSale(saleData))', 'disabled: savingSale', 'savingSaleRef.current']) {
  if (!saleWrapper.includes(marker)) throw new Error(`Espera segura da venda ausente: ${marker}`);
}
const patchBaseSale = extractFunction(saleWrapper, 'const patchBaseSale =', 'const patchPaymentWrapper =', 'patchBaseSale');
const patchPaymentWrapper = extractFunction(saleWrapper, 'const patchPaymentWrapper =', 'globalThis.fetch =', 'patchPaymentWrapper');
const patchedBaseSale = patchBaseSale(fs.readFileSync(new URL('../nova-venda.js', import.meta.url), 'utf8'));
const patchedPaymentWrapper = patchPaymentWrapper(fs.readFileSync(new URL('../nova-venda-fixed.js', import.meta.url), 'utf8'));
for (const marker of ['const persistSale = async saleData =>', 'const handleFinish = async () =>', 'await persistSale(saleDataToSave)']) {
  if (!patchedBaseSale.includes(marker)) throw new Error(`A Nova Venda montada não contém: ${marker}`);
}
if (!patchedPaymentWrapper.includes('await persistSale(approvedSaleData)')) {
  throw new Error('A confirmação da análise de crédito não aguarda a transação da venda.');
}

const legacyCalculationStart = patchedPaymentWrapper.indexOf('const calculationPattern =');
const legacyCalculationEnd = patchedPaymentWrapper.indexOf('\n\nif (!calculationPattern.test(source))', legacyCalculationStart);
if (legacyCalculationStart < 0 || legacyCalculationEnd < 0) {
  throw new Error('Não foi possível reproduzir a montagem real do formulário de vendas.');
}
const composedSale = Function('source', `${patchedPaymentWrapper.slice(legacyCalculationStart, legacyCalculationEnd)}
  if (!calculationPattern.test(source)) throw new Error('Cálculo de parcelas não localizado.');
  return source.replace(calculationPattern, correctedCalculation);`)(patchedBaseSale);
if (!composedSale.includes('const persistSale = async saleData =>')) {
  throw new Error('A montagem final do formulário removeu a função que grava a venda.');
}
if (composedSale.indexOf('const persistSale = async saleData =>') > composedSale.indexOf('const calculateInstallments = () => {')) {
  throw new Error('A função de gravação precisa ficar fora do bloco substituído pelo parcelamento.');
}
fs.writeFileSync('/tmp/registro-vendas-new-sale-base-v69.mjs', patchedBaseSale);
checkSyntax('/tmp/registro-vendas-new-sale-base-v69.mjs');
fs.writeFileSync('/tmp/registro-vendas-new-sale-composed-v69.mjs', composedSale);
checkSyntax('/tmp/registro-vendas-new-sale-composed-v69.mjs');

const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
for (const marker of ['isApprovedOwner', 'validProductStock', "get('status', 'active') != 'deleted'", 'allow read: if isAdmin(appId);', 'profileAfter(appId, userId)']) {
  if (!rules.includes(marker)) throw new Error(`Regra do Firestore ausente: ${marker}`);
}
const protectedSalesRules = `    match /artifacts/{appId}/users/{userId}/sales/{saleId} {
      allow read, create, update: if isApprovedOwner(appId, userId);
      allow delete: if false;
    }`;
if (!rules.includes(protectedSalesRules)) {
  throw new Error('A exclusão direta de vendas não foi bloqueada nas regras do Firestore.');
}

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
if (!index.includes('bootstrap-v69.js?v=69') && !index.includes('bootstrap-v70.js?v=70') && !index.includes('bootstrap-v71.js?v=71') && !index.includes('bootstrap-v71.js?v=72') && !index.includes('bootstrap-v71.js?v=73') && !index.includes('bootstrap-v71.js?v=74')) {
  throw new Error('Nenhuma versão compatível com as proteções v69 está ativa no index.html.');
}

console.log('Aplicação v69 validada: revogação ao vivo, privacidade do PIX, estoque não negativo e operações atômicas.');
