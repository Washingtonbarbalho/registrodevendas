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
  if (result.status !== 0) throw new Error(`Falha ao gerar o runtime v76:\n${result.stderr || result.stdout}`);
};

runBuild();

const criticalFiles = [
  'bootstrap-v75.js',
  'service-worker-v75.js',
  'sw.js',
  'app-patch-final-v71.js',
  'app-runtime-v75.js',
  'firebase-config.js',
  'modals-core-runtime-v75.js',
  'modals-runtime-v75.js',
  'nova-venda-runtime-v75.js',
  'aba-clientes-runtime-v75.js',
  'customer-history-runtime-v75.js',
  'scripts/build-runtime-v75.mjs',
  'scripts/consolidate-legacy-runtime-v75.mjs',
  'scripts/validate-v75.mjs'
];
criticalFiles.forEach(checkSyntax);

const generatedFiles = [
  'app-runtime-v75.js',
  'styles-runtime-v75.css',
  'modals-core-runtime-v75.js',
  'modals-runtime-v75.js',
  'nova-venda-runtime-v75.js',
  'aba-clientes-runtime-v75.js',
  'customer-history-runtime-v75.js'
];
const firstBuild = new Map(generatedFiles.map(file => [file, read(file)]));
runBuild();
for (const file of generatedFiles) {
  assert.equal(read(file), firstBuild.get(file), `A compilação não é determinística: ${file}`);
}

const runtime = read('app-runtime-v75.js');
for (const marker of [
  'Runtime estático v76',
  "from './modals-runtime-v75.js?v=76'",
  "from './nova-venda-runtime-v75.js?v=76'",
  "from './aba-clientes-runtime-v75.js?v=76'",
  "const mobilePrimaryNav = ['dashboard', 'sales', 'products', 'customers']"
]) assert.ok(runtime.includes(marker), `Runtime técnico incompleto: ${marker}`);

for (const obsolete of [
  'fetch(`./app.js',
  'applySetupPatches(',
  'modals-fixed-v69.js',
  'nova-venda-fixed-v70.js',
  'aba-clientes-fixed-v52.js',
  'aba-backup-v75.js',
  "id: 'backup'",
  'BackupAutoSnapshot'
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
  assert.ok(!/\.js\?v=75['"]/.test(source), `${staticRuntimeFile} ainda referencia módulos da v75.`);
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
  assert.ok(read(firebaseConsumer).includes("firebase-config.js?v=76"),
    `${firebaseConsumer} não usa a configuração atual do Firebase.`);
}

const bootstrap = read('bootstrap-v75.js');
assert.ok(bootstrap.includes("const VERSION = '76'"));
assert.ok(bootstrap.includes("import(`./app-runtime-v75.js?v=${VERSION}`)"));
for (const obsolete of ['registerOfflineSupport', 'serviceWorker', 'offline-status', 'URL.createObjectURL']) {
  assert.ok(!bootstrap.includes(obsolete), `Bootstrap ainda contém suporte removido: ${obsolete}`);
}

const index = read('index.html');
assert.ok(index.includes("import('./bootstrap-v75.js?v=76')"));
assert.ok(index.includes('styles-runtime-v75.css?v=76'));
assert.ok(index.includes('manifest.json?v=76'));
assert.equal([...index.matchAll(/<link\s+rel="stylesheet"\s+href="\.\/[^"]+"/g)].length, 1,
  'A página deve carregar apenas um pacote local de CSS.');
for (const cleanupMarker of ['getRegistrations()', 'registration.unregister()', "startsWith('registro-vendas-')", "deleteDatabase('registro-vendas-backups-v75')", 'location.reload()']) {
  assert.ok(index.includes(cleanupMarker), `Limpeza da versão offline incompleta: ${cleanupMarker}`);
}
assert.ok(!index.includes('serviceWorker.register'), 'O sistema não deve registrar um novo service worker.');
assert.ok(!index.includes('offline-status-v75.js'), 'O aviso de modo offline não deve ser carregado.');

const styles = read('styles-runtime-v75.css');
for (const marker of ['Estilos consolidados v76', 'Fonte: styles.css', 'Fonte: v74-commercial.css']) {
  assert.ok(styles.includes(marker), `Pacote CSS incompleto: ${marker}`);
}
assert.ok(!styles.includes('.backup-'), 'Estilos da aba de backup não devem permanecer no pacote.');
assert.ok(!styles.includes('.offline-status-'), 'Estilos do modo offline não devem permanecer no pacote.');

const firebase = read('firebase-config.js');
assert.ok(firebase.includes('const firestore = getFirestore(app);'));
assert.ok(firebase.includes('await clearIndexedDbPersistence(firestore);'));
assert.ok(firebase.includes("localStorage.removeItem(LEGACY_OFFLINE_KEY)"));
for (const removed of ['persistentLocalCache', 'persistentMultipleTabManager', 'initializeFirestore', 'OFFLINE_TRUST_KEY']) {
  assert.ok(!firebase.includes(removed), `Persistência offline ainda configurada no Firebase: ${removed}`);
}

for (const workerFile of ['service-worker-v75.js', 'sw.js']) {
  const retirementWorker = read(workerFile);
  for (const marker of ["startsWith('registro-vendas-')", 'caches.delete(name)', 'self.registration.unregister()']) {
    assert.ok(retirementWorker.includes(marker), `Limpeza de ${workerFile} incompleta: ${marker}`);
  }
  assert.ok(!retirementWorker.includes("addEventListener('fetch'"), `${workerFile} não pode interceptar requisições.`);
}

for (const removedFile of [
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
assert.equal(manifest.icons[0].src, 'app-icon.svg?v=76');

const inherited = spawnSync(process.execPath, ['scripts/validate-v74.mjs'], {
  cwd: root,
  encoding: 'utf8'
});
if (inherited.status !== 0) throw new Error(`Regressão herdada da v74:\n${inherited.stderr || inherited.stdout}`);
process.stdout.write(inherited.stdout);

console.log('Aplicação v76 validada: runtime consolidado, somente online, sem backup na navegação e com regressões cobertas.');
