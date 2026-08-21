import fs from 'node:fs';
import { applySetupPatches } from '../app-patch-setup-v59.js';
import { applyReportsPatch } from '../app-patch-reports-v65.js';
import { applyStockPatch } from '../app-patch-stock-v68.js';
import { applyCancelPatch } from '../app-patch-cancel-v59.js';
import { applyProfitPatch } from '../app-patch-profit-v58.js';
import { applySalePdfPatch } from '../app-patch-sale-pdf-v65.js';
import { applyMobileMenuPatch } from '../app-patch-mobile-menu-v66.js';
import { applyBatchStockPatch } from '../app-patch-batch-stock-v68.js';
import { applyFinalPatches } from '../app-patch-final-v68.js';
import { buildPaymentInstallments, splitMoney } from '../purchase-payment-v68.js';

globalThis.location = new URL('https://example.test/registrodevendas/');

const split = splitMoney(100, 3);
if (split.length !== 3 || Math.round(split.reduce((sum, value) => sum + value, 0) * 100) !== 10000) {
  throw new Error('Distribuição em centavos do parcelamento está incorreta.');
}
const plan = buildPaymentInstallments(100, 3, '2026-01-31');
if (plan[0].dueDate !== '2026-01-31' || plan[1].dueDate !== '2026-02-28' || plan[2].dueDate !== '2026-03-31') {
  throw new Error('Datas mensais do parcelamento estão incorretas.');
}

let source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
source = applySetupPatches(source);
source = applyReportsPatch(source);
source = applyStockPatch(source);
source = applyCancelPatch(source);
source = applyProfitPatch(source);
source = applySalePdfPatch(source);
source = applyMobileMenuPatch(source);
source = applyBatchStockPatch(source);
source = applyFinalPatches(source);

const required = [
  'BatchStockModal',
  'onBatchMovement: () => setBatchStockOpen(true)',
  'aba-financeiro-v68.js',
  'batch-stock-modal-v68.js',
  'stock-movement-modal-v68.js'
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Marcador ausente na aplicação final: ${marker}`);
}
if (source.includes('mobile-bottom-nav')) throw new Error('A navegação inferior mobile antiga voltou à aplicação final.');
if (!source.includes('financialInstallments')) throw new Error('O parcelamento financeiro das compras não chegou à aplicação final.');

fs.writeFileSync('/tmp/registro-vendas-runtime-v68.mjs', source);
console.log('Aplicação v68 montada com sucesso.');
