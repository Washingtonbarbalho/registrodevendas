import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checkSyntax = file => {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Erro de sintaxe em ${file}:\n${result.stderr || result.stdout}`);
};

const runBuild = () => {
  const result = spawnSync(process.execPath, ['scripts/build-runtime-v75.mjs'], {
    cwd: root,
    encoding: 'utf8'
  });
  if (result.status !== 0) throw new Error(`Falha ao validar os módulos ativos:\n${result.stderr || result.stdout}`);
};

runBuild();

const criticalFiles = [
  'bootstrap-v75.js',
  'app-runtime-v75.js',
  'firebase-config.js',
  'financial-account-details-v80.js',
  'ui-interactions-v81.js',
  'analysis-period-v79.js',
  'executive-insights-v79.js',
  'report-filters-v79.js',
  'report-export-v74.js',
  'reports-engine-v70.js',
  'reports-engine-v73.js',
  'aba-visao-geral-fixed.js',
  'aba-relatorios-v73.js',
  'modals-core-runtime-v75.js',
  'modals-runtime-v75.js',
  'nova-venda-runtime-v75.js',
  'aba-clientes-runtime-v75.js',
  'customer-history-runtime-v75.js',
  'scripts/build-runtime-v75.mjs',
  'scripts/validate-v70.mjs',
  'scripts/validate-v71.mjs',
  'scripts/validate-v73.mjs',
  'scripts/validate-v74.mjs',
  'scripts/validate-unified-sales-v77.mjs',
  'scripts/validate-credit-position-v78.mjs',
  'scripts/validate-executive-v79.mjs',
  'scripts/validate-financial-details-v80.mjs',
  'scripts/validate-ui-interactions-v81.mjs',
  'scripts/validate-v75.mjs'
];
criticalFiles.forEach(checkSyntax);

const maintainedFiles = [
  'app-runtime-v75.js',
  'styles-runtime-v75.css',
  'modals-core-runtime-v75.js',
  'modals-runtime-v75.js',
  'nova-venda-runtime-v75.js',
  'aba-clientes-runtime-v75.js',
  'customer-history-runtime-v75.js'
];
const firstBuild = new Map(maintainedFiles.map(file => [file, read(file)]));
runBuild();
for (const file of maintainedFiles) {
  assert.equal(read(file), firstBuild.get(file), `A validação não pode reescrever o código ativo: ${file}`);
}

const version = read('bootstrap-v75.js').match(/const VERSION = '([^']+)'/)?.[1];
assert.ok(version, 'A versão ativa deve estar definida no bootstrap.');

const runtime = read('app-runtime-v75.js');
for (const marker of [
  `Aplicação consolidada v${version}`,
  `from './modals-runtime-v75.js?v=${version}'`,
  `from './nova-venda-runtime-v75.js?v=${version}'`,
  `from './aba-clientes-runtime-v75.js?v=${version}'`,
  `from './analysis-period-v79.js?v=${version}'`,
  'readSharedAnalysisPeriod',
  'analysisPeriod: dashPeriod',
  "const mobilePrimaryNav = ['dashboard', 'sales', 'products', 'customers', 'finance']",
  'mobile83-more-sheet',
  'mobile83-more-nav-button',
  "setNewSaleMode('unified')"
]) assert.ok(runtime.includes(marker), `Runtime técnico incompleto: ${marker}`);

for (const obsolete of [
  'fetch(`./app.js',
  'applySetupPatches(',
  'modals-fixed-v69.js',
  'nova-venda-fixed-v70.js',
  'aba-clientes-fixed-v52.js',
  'aba-backup-v75.js',
  "id: 'backup'",
  'BackupAutoSnapshot',
  'mobile-menu-toggle',
  'mobile-menu-drawer',
  'mobile-menu-nav-button',
  'quick-sale-sheet',
  'quickSaleMenuOpen'
]) assert.ok(!runtime.includes(obsolete), `Recurso antigo ainda ativo: ${obsolete}`);

for (const staticRuntimeFile of [
  'modals-core-runtime-v75.js',
  'modals-runtime-v75.js',
  'nova-venda-runtime-v75.js',
  'aba-clientes-runtime-v75.js',
  'customer-history-runtime-v75.js'
]) {
  const source = read(staticRuntimeFile);
  assert.ok(!source.includes('URL.createObjectURL'), `${staticRuntimeFile} ainda cria módulo blob.`);
  assert.ok(!source.includes('http://localhost'), `${staticRuntimeFile} contém endereço de compilação.`);
  assert.ok(!/\.js\?v=(?:75|76|77|78|79|80|81|82|83|84)['"]/.test(source), `${staticRuntimeFile} ainda referencia módulos desatualizados.`);
}

for (const firebaseConsumer of [
  'app-runtime-v75.js',
  'nova-venda-runtime-v75.js',
  'aba-clientes-runtime-v75.js',
  'auth-admin.js',
  'auth-screen-v71.js',
  'batch-stock-modal-v68.js',
  'aba-relatorios-v73.js',
  'aba-financeiro-v68.js',
  'aba-comercial-v74.js'
]) {
  assert.ok(read(firebaseConsumer).includes(`firebase-config.js?v=${version}`),
    `${firebaseConsumer} não usa a configuração atual do Firebase.`);
}

const bootstrap = read('bootstrap-v75.js');
assert.ok(bootstrap.includes(`const VERSION = '${version}'`));
assert.ok(bootstrap.includes("import(`./app-runtime-v75.js?v=${VERSION}`)"));
for (const obsolete of ['registerOfflineSupport', 'serviceWorker', 'offline-status', 'URL.createObjectURL']) {
  assert.ok(!bootstrap.includes(obsolete), `Bootstrap ainda contém suporte removido: ${obsolete}`);
}

const index = read('index.html');
assert.ok(index.includes(`import('./bootstrap-v75.js?v=${version}')`));
assert.ok(index.includes(`styles-runtime-v75.css?v=${version}`));
assert.ok(index.includes(`manifest.json?v=${version}`));
assert.equal([...index.matchAll(/<link\s+rel="stylesheet"\s+href="\.\/[^"]+"/g)].length, 1,
  'A página deve carregar apenas um pacote local de CSS.');
for (const cleanupMarker of ['getRegistrations()', 'registration.unregister()', "startsWith('registro-vendas-')", "deleteDatabase('registro-vendas-backups-v75')", 'location.reload()']) {
  assert.ok(index.includes(cleanupMarker), `Limpeza da versão offline incompleta: ${cleanupMarker}`);
}
assert.ok(!index.includes('serviceWorker.register'), 'O sistema não deve registrar um novo service worker.');
assert.ok(!index.includes('offline-status-v75.js'), 'O aviso de modo offline não deve ser carregado.');

const styles = read('styles-runtime-v75.css');
for (const marker of [
  `Estilos consolidados v${version}`,
  '.sale-payment-select-field',
  '.reports73-credit-position-note',
  '.reports79-executive-overview',
  '.finance80-details-button',
  '.finance80-account-modal',
  '.app81-dialog-overlay',
  '.app81-select-panel',
  '.finance82-summary-action',
  '.finance83-portfolio-modal',
  '.finance83-portfolio-scroll',
  '.finance92-period-list-summary',
  '.finance85-installment-preview',
  '.finance88-launch-card',
  '.finance88-launch-placeholder',
  '.mobile83-more-sheet',
  '.mobile83-more-nav-button',
  '.app82-calendar-panel',
  '.period82-trigger'
]) {
  assert.ok(styles.includes(marker), `Pacote CSS incompleto: ${marker}`);
}
assert.ok(!styles.includes('.backup-'), 'Estilos da aba de backup não devem permanecer no pacote.');
assert.ok(!styles.includes('.offline-status-'), 'Estilos do modo offline não devem permanecer no pacote.');
assert.ok(!styles.includes('.quick-sale-sheet'), 'A escolha antecipada do tipo de venda não deve manter estilos ativos.');
assert.ok(!styles.includes('.sale-payment-methods'), 'Os botões anteriores de pagamento não devem permanecer no pacote.');
assert.ok(!styles.includes('.mobile-menu-drawer'), 'A gaveta lateral mobile removida não deve manter estilos ativos.');
assert.ok(!styles.includes('.finance82-portfolio-notice'), 'A carteira completa não pode voltar a substituir o filtro da página.');

const firebase = read('firebase-config.js');
assert.ok(firebase.includes('const firestore = getFirestore(app);'));
assert.ok(firebase.includes('await clearIndexedDbPersistence(firestore);'));
assert.ok(firebase.includes("localStorage.removeItem(LEGACY_OFFLINE_KEY)"));
for (const removed of ['persistentLocalCache', 'persistentMultipleTabManager', 'initializeFirestore', 'OFFLINE_TRUST_KEY']) {
  assert.ok(!firebase.includes(removed), `Persistência offline ainda configurada no Firebase: ${removed}`);
}

for (const removedFile of [
  'app.js',
  'modals.js',
  'nova-venda.js',
  'styles.css',
  'bootstrap-v71.js',
  'service-worker-v75.js',
  'sw.js',
  'favicon.png',
  'icon-192.png',
  'icon-512.png',
  'scripts/consolidate-legacy-runtime-v75.mjs',
  '.github/workflows/validate-v75.yml',
  'app-patch-backup-v75.js',
  'aba-backup-v75.js',
  'backup-engine-v75.js',
  'backup-storage-v75.js',
  'offline-status-v75.js',
  'v75-technical.css'
]) assert.ok(!fs.existsSync(path.join(root, removedFile)), `Arquivo removido ainda presente: ${removedFile}`);

assert.ok(!read('tab-persistence.js').includes("label === 'backup e dados'"));

const manifest = JSON.parse(read('manifest.json'));
assert.equal(manifest.id, './');
assert.equal(manifest.start_url, './');
assert.equal(manifest.display, 'standalone');
assert.ok(!manifest.description.toLowerCase().includes('offline'));
assert.equal(manifest.icons[0].src, `app-icon.svg?v=${version}`);

const rules = read('firestore.rules');
for (const marker of [
  "profile(appId, userId).get('status', 'active') != 'deleted'",
  'request.resource.data.quantity >= 0',
  'allow read: if isAdmin(appId)',
  'allow read, write: if false'
]) assert.ok(rules.includes(marker), `Proteção obrigatória ausente nas regras: ${marker}`);

const admin = read('auth-admin.js');
assert.ok(admin.includes("status: 'deleted'"));
assert.ok(admin.includes('writeBatch(db)'));
assert.ok(!read('nova-venda-runtime-v75.js').includes('api.qrserver.com'));
assert.ok(!read('modals-core-runtime-v75.js').includes('api.qrserver.com'));
assert.ok(read('batch-stock-modal-v68.js').includes('runTransaction(db, async transaction =>'));

const activeRootFiles = fs.readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isFile());
assert.ok(activeRootFiles.length <= 50, `A raiz ainda contém arquivos em excesso: ${activeRootFiles.length}.`);
for (const entry of activeRootFiles) {
  assert.ok(!entry.name.startsWith('app-patch-'), `Correção intermediária ainda presente: ${entry.name}`);
  assert.ok(!/^bootstrap-v(?!75\.js$)/.test(entry.name), `Carregador desatualizado ainda presente: ${entry.name}`);
  assert.ok(!/^nova-venda-fixed/.test(entry.name), `Carregador antigo de vendas ainda presente: ${entry.name}`);
}

for (const [label, validator] of [
  ['conciliação financeira e centavos', 'scripts/validate-v70.mjs'],
  ['vendas atômicas e navegação', 'scripts/validate-v71.mjs'],
  ['relatórios estratégicos', 'scripts/validate-v73.mjs'],
  ['experiência comercial e exportações', 'scripts/validate-v74.mjs'],
  ['vendas unificadas', 'scripts/validate-unified-sales-v77.mjs'],
  ['posição histórica do crediário', 'scripts/validate-credit-position-v78.mjs'],
  ['evolução executiva', 'scripts/validate-executive-v79.mjs'],
  ['detalhes das contas a pagar e a receber', 'scripts/validate-financial-details-v80.mjs'],
  ['interações profissionais', 'scripts/validate-ui-interactions-v81.mjs']
]) {
  const result = spawnSync(process.execPath, [validator], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Falha em ${label}:\n${result.stderr || result.stdout}`);
  process.stdout.write(result.stdout);
}

console.log(`Aplicação v${version} validada: calendário único, carteira financeira completa e todos os fluxos anteriores preservados.`);
