import fs from 'node:fs';
import { applySetupPatches } from '../app-patch-setup-v59.js';
import { applyReportsPatch } from '../app-patch-reports-v65.js';
import { applyStockPatch } from '../app-patch-stock-v52.js';
import { applyCancelPatch } from '../app-patch-cancel-v59.js';
import { applyProfitPatch } from '../app-patch-profit-v58.js';
import { applySalePdfPatch } from '../app-patch-sale-pdf-v65.js';
import { applyMobileMenuPatch } from '../app-patch-mobile-menu-v66.js';
import { applyBatchStockPatch } from '../app-patch-batch-stock-v67.js';
import { applyFinalPatches } from '../app-patch-final-v67.js';

globalThis.location = new URL('https://example.test/registrodevendas/');

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
  'aba-financeiro-v67.js',
  'batch-stock-modal-v67.js',
  'aba-produtos-v67.js'
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Marcador ausente na aplicação final: ${marker}`);
}
if (source.includes('mobile-bottom-nav')) throw new Error('A navegação inferior mobile antiga voltou à aplicação final.');

fs.writeFileSync('/tmp/registro-vendas-runtime-v67.mjs', source);
console.log('Aplicação v67 montada com sucesso.');
