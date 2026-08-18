import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const activeModules = [
  'bootstrap-v54.js',
  'app-patch-setup-v52.js',
  'app-patch-stock-v52.js',
  'app-patch-cancel-v52.js',
  'app-patch-final-v52.js',
  'app.js',
  'aba-financeiro-v54.js',
  'stock-movement-modal-v52.js',
  'sale-cancellation-modal-v52.js',
  'aba-vendas-caixa-v52.js',
  'aba-vendas-prazo-v52.js',
  'aba-clientes-fixed-v52.js',
  'modals-fixed-v52.js',
  'nova-venda-fixed-v52.js',
  'nova-venda-fixed-v52-core.js',
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
const { applyFinalPatches } = await importFresh('app-patch-final-v52.js');

let source = await readFile(resolve(root, 'app.js'), 'utf8');
source = applySetupPatches(source);
source = applyStockPatch(source);
source = applyCancelPatch(source);
source = applyFinalPatches(source);

const generatedFile = join(tmpdir(), `registrodevendas-generated-${Date.now()}.mjs`);
await writeFile(generatedFile, source, 'utf8');
checkSyntax(generatedFile);

console.log(`Validação concluída: ${activeModules.length} módulos ativos + app.js final gerado sem erros de sintaxe.`);
