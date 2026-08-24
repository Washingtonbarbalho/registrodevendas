import fs from 'node:fs';
import path from 'node:path';
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
import { applyAccountingPatch } from '../app-patch-accounting-v70.js';
import { applyOperationsPatch } from '../app-patch-operations-v71.js';
import { applyCommercialPatch } from '../app-patch-commercial-v74.js';
import { applyFinalPatches } from '../app-patch-final-v71.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const consolidation = spawnSync(process.execPath, [
  '--experimental-vm-modules',
  path.join(root, 'scripts/consolidate-legacy-runtime-v75.mjs')
], { cwd: root, encoding: 'utf8' });
if (consolidation.status !== 0) {
  throw new Error(`Falha ao consolidar Modais e Nova Venda:\n${consolidation.stderr || consolidation.stdout}`);
}

const patches = [
  ['configuração principal', applySetupPatches],
  ['relatórios', applyReportsPatch],
  ['estoque e parcelamentos', applyStockPatch],
  ['cancelamentos', applyCancelPatch],
  ['lucro', applyProfitPatch],
  ['PDF de venda', applySalePdfPatch],
  ['menu mobile', applyMobileMenuPatch],
  ['estoque em lote', applyBatchStockPatch],
  ['segurança e confiabilidade', applySecurityReliabilityPatch],
  ['conciliação financeira', applyAccountingPatch],
  ['simplificação operacional', applyOperationsPatch],
  ['experiência comercial', applyCommercialPatch]
];

let runtime = read('app.js');
for (const [label, patch] of patches) {
  try {
    runtime = patch(runtime);
  } catch (error) {
    throw new Error(`Falha ao consolidar ${label}: ${error?.message || error}`);
  }
}
runtime = applyFinalPatches(runtime, { staticBuild: true, version: '77' });
runtime = `// Runtime estático v77 — gerado por scripts/build-runtime-v75.mjs.\n${runtime}`;

for (const forbidden of [
  'example.test',
  'blob:registro',
  "fetch(`./app.js",
  'applySetupPatches(',
  'modals-fixed-v69.js',
  'nova-venda-fixed-v70.js',
  'aba-clientes-fixed-v52.js',
  'aba-backup-v75.js',
  "id: 'backup'"
]) {
  if (runtime.includes(forbidden)) throw new Error(`O runtime consolidado ainda contém uma etapa dinâmica: ${forbidden}.`);
}

for (const required of [
  "from './modals-runtime-v75.js?v=77'",
  "from './nova-venda-runtime-v75.js?v=77'",
  "from './aba-clientes-runtime-v75.js?v=77'",
  "const mobilePrimaryNav = ['dashboard', 'sales', 'products', 'customers']"
]) {
  if (!runtime.includes(required)) throw new Error(`Integração ausente no runtime v75: ${required}.`);
}

fs.writeFileSync(path.join(root, 'app-runtime-v75.js'), runtime);

const styleFiles = [
  'styles.css',
  'modals-theme.css',
  'ui-refinements.css',
  'final-tweaks.css',
  'v21-improvements.css',
  'v23-fixes.css',
  'v25-fixes.css',
  'v26-fixes.css',
  'v27-fixes.css',
  'v29-entry-rules.css',
  'v30-entry-rule-visibility.css',
  'v31-dashboard.css',
  'v44-financeiro.css',
  'v46-financeiro.css',
  'v47-cancelamentos.css',
  'reports-v62.css',
  'reports-nav-v62.css',
  'v66-mobile-menu.css',
  'v67-batch-stock.css',
  'v68-stock-installments.css',
  'v71-operations.css',
  'reports-strategic-v73.css',
  'v74-commercial.css'
];

const consolidatedStyles = styleFiles.map(file => {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Folha de estilo ausente: ${file}.`);
  return `/* Fonte: ${file} */\n${read(file).trim()}\n`;
}).join('\n');
fs.writeFileSync(
  path.join(root, 'styles-runtime-v75.css'),
  `/* Estilos consolidados v77 — gerado por scripts/build-runtime-v75.mjs. */\n${consolidatedStyles}`
);

console.log(`Runtime v77 consolidado: ${runtime.length} bytes de JS e ${consolidatedStyles.length} bytes de CSS.`);
