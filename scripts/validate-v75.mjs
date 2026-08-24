import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import {
  BACKUP_SCHEMA,
  buildBackup,
  computeBackupChecksum,
  decodeBackupValue,
  encodeBackupValue,
  stableStringify,
  validateBackup
} from '../backup-engine-v75.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checkSyntax = file => {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Erro de sintaxe em ${file}:\n${result.stderr || result.stdout}`);
};

const build = spawnSync(process.execPath, ['scripts/build-runtime-v75.mjs'], {
  cwd: root,
  encoding: 'utf8'
});
if (build.status !== 0) throw new Error(`Falha ao gerar o runtime v75:\n${build.stderr || build.stdout}`);

const criticalFiles = [
  'bootstrap-v75.js',
  'offline-status-v75.js',
  'service-worker-v75.js',
  'app-patch-backup-v75.js',
  'app-patch-final-v71.js',
  'app-runtime-v75.js',
  'firebase-config.js',
  'backup-engine-v75.js',
  'backup-storage-v75.js',
  'aba-backup-v75.js',
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

const timestamp = {
  seconds: 1_787_488_200,
  nanoseconds: 123_000_000,
  toDate: () => new Date('2026-08-23T15:10:00.123Z')
};
const backupInput = {
  appId: 'vendas-aura-main',
  userId: 'owner-75',
  userEmail: 'owner@example.test',
  userProfile: {
    name: 'Maria',
    storeName: 'Loja Segura',
    pixKey: 'chave-privada',
    paymentSettings: { debitRate: 1.99 },
    financialData: { openingBalance: 100.01 },
    commercialGoals: { '2026-08': { revenue: 5000 } },
    updatedAt: timestamp,
    role: 'admin',
    approved: true,
    status: 'active'
  },
  products: [{ id: 'product-1', name: 'Produto', quantity: 3, costPrice: 10.01, createdAt: timestamp }],
  customers: [{ id: 'customer-1', name: 'Cliente', phone: '5588999990000', birthday: new Date('1990-01-02T00:00:00.000Z') }],
  sales: [{ id: 'sale-1', totalPrice: 30.03, totalCost: 10.01, status: 'completed', items: [{ productId: 'product-1', quantity: 1 }] }],
  createdAt: new Date('2026-08-24T12:00:00.000Z')
};

const backup = buildBackup(backupInput);
assert.equal(backup.schema, BACKUP_SCHEMA);
assert.deepEqual(validateBackup(backup, { expectedOwnerUid: 'owner-75' }).summary, {
  products: 1, customers: 1, sales: 1, total: 3
});
assert.equal(backup.data.profile.role, undefined, 'Papéis e permissões não podem entrar no backup restaurável.');
assert.equal(backup.data.profile.approved, undefined);
assert.equal(backup.data.profile.status, undefined);
assert.equal(backup.checksum, computeBackupChecksum(backup));

const laterBackup = buildBackup({ ...backupInput, createdAt: new Date('2026-08-24T13:00:00.000Z') });
assert.equal(laterBackup.contentChecksum, backup.contentChecksum, 'Conteúdo idêntico não deve criar cópias automáticas repetidas.');
assert.notEqual(laterBackup.checksum, backup.checksum, 'A data da cópia precisa participar da integridade do arquivo.');

const encodedTimestamp = encodeBackupValue(timestamp);
const decodedTimestamp = decodeBackupValue(encodedTimestamp, {
  timestampFactory: (iso, nanoseconds) => ({ iso, nanoseconds })
});
assert.deepEqual(decodedTimestamp, { iso: '2026-08-23T15:10:00.123Z', nanoseconds: 123_000_000 });
assert.equal(
  stableStringify({ z: 1, nested: { b: 2, a: 1 } }),
  stableStringify({ nested: { a: 1, b: 2 }, z: 1 })
);

const duplicate = structuredClone(backup);
duplicate.data.products.push(structuredClone(duplicate.data.products[0]));
assert.throws(() => validateBackup(duplicate, { expectedOwnerUid: 'owner-75' }), /duplicados/);

const negativeStock = structuredClone(backup);
negativeStock.data.products[0].data.quantity = -1;
assert.throws(() => validateBackup(negativeStock, { expectedOwnerUid: 'owner-75' }), /estoque inválido/);

const changed = structuredClone(backup);
changed.data.sales[0].data.totalPrice = 999;
assert.throws(() => validateBackup(changed, { expectedOwnerUid: 'owner-75' }), /integridade/);
assert.throws(() => validateBackup(backup, { expectedOwnerUid: 'another-owner' }), /outro usuário/);

const unsafe = structuredClone(backup);
unsafe.data.customers[0].data = JSON.parse('{"name":"Cliente","__proto__":{"polluted":true}}');
assert.throws(() => validateBackup(unsafe, { expectedOwnerUid: 'owner-75' }), /inseguro/);

const runtime = read('app-runtime-v75.js');
for (const marker of [
  "from './modals-runtime-v75.js?v=75'",
  "from './nova-venda-runtime-v75.js?v=75'",
  "from './aba-clientes-runtime-v75.js?v=75'",
  "from './aba-backup-v75.js?v=75'",
  "{ id: 'backup', label: 'Backup e dados'",
  "view === 'backup' ? React.createElement(AbaBackup",
  'React.createElement(BackupAutoSnapshot',
  "const mobilePrimaryNav = ['dashboard', 'sales', 'products', 'customers']"
]) assert.ok(runtime.includes(marker), `Runtime v75 incompleto: ${marker}`);

for (const obsolete of [
  'fetch(`./app.js',
  'applySetupPatches(',
  'modals-fixed-v69.js',
  'nova-venda-fixed-v70.js',
  'aba-clientes-fixed-v52.js',
  'example.test'
]) assert.ok(!runtime.includes(obsolete), `Etapa dinâmica antiga ainda ativa: ${obsolete}`);

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
}

const bootstrap = read('bootstrap-v75.js');
assert.ok(bootstrap.includes("import(`./app-runtime-v75.js?v=${VERSION}`)"));
assert.ok(bootstrap.includes('registerOfflineSupport()'));
for (const obsolete of ['preflightCriticalModules', 'applyCommercialPatch', 'fetch(`./app.js', 'URL.createObjectURL']) {
  assert.ok(!bootstrap.includes(obsolete), `Bootstrap ainda executa trabalho antigo: ${obsolete}`);
}

const index = read('index.html');
assert.ok(index.includes('bootstrap-v75.js?v=75'));
assert.ok(index.includes('styles-runtime-v75.css?v=75'));
assert.ok(index.includes('service-worker-v75.js?v=75'));
assert.equal([...index.matchAll(/<link\s+rel="stylesheet"\s+href="\.\/[^\"]+"/g)].length, 1,
  'A página deve carregar apenas um pacote local de CSS.');
for (const oldStyle of ['styles.css?v=71', 'v71-operations.css?v=71', 'v74-commercial.css?v=74']) {
  assert.ok(!index.includes(oldStyle), `CSS antigo ainda é solicitado separadamente: ${oldStyle}`);
}
const styles = read('styles-runtime-v75.css');
for (const marker of ['Fonte: styles.css', 'Fonte: v74-commercial.css', 'Fonte: v75-technical.css']) {
  assert.ok(styles.includes(marker), `Pacote CSS incompleto: ${marker}`);
}

const firebase = read('firebase-config.js');
for (const marker of ['OFFLINE_TRUST_KEY', 'initializeFirestore', 'persistentLocalCache', 'persistentMultipleTabManager', 'getFirestore(app)', 'clearIndexedDbPersistence']) {
  assert.ok(firebase.includes(marker), `Persistência do Firestore incompleta: ${marker}`);
}

const worker = read('service-worker-v75.js');
for (const marker of ['registro-vendas-static-v75', 'warmStaticCache', "request.mode === 'navigate'", 'ignoreSearch: true', 'self.clients.claim()']) {
  assert.ok(worker.includes(marker), `Service worker incompleto: ${marker}`);
}
for (const privateEndpoint of ['firestore.googleapis.com', 'identitytoolkit.googleapis.com', 'securetoken.googleapis.com']) {
  assert.ok(!worker.includes(privateEndpoint), `Dados Firebase não podem entrar no cache HTTP: ${privateEndpoint}`);
}

const workerHandlers = {};
let cachedWrites = 0;
const workerContext = {
  URL,
  Request,
  Response,
  Set,
  Promise,
  fetch: async () => new Response('arquivo', { status: 200 }),
  caches: {
    match: async () => null,
    keys: async () => [],
    delete: async () => true,
    open: async () => ({ put: async () => { cachedWrites += 1; } })
  },
  self: {
    location: { origin: 'https://app.example.test' },
    registration: { scope: 'https://app.example.test/registrodevendas/' },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener: (type, handler) => { workerHandlers[type] = handler; }
  }
};
vm.runInNewContext(worker, workerContext, { filename: 'service-worker-v75.js' });

let privateResponse = null;
workerHandlers.fetch({
  request: new Request('https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel'),
  respondWith: promise => { privateResponse = promise; }
});
assert.equal(privateResponse, null, 'O service worker deve ignorar completamente as requisições de dados do Firestore.');

let staticResponsePromise = null;
workerHandlers.fetch({
  request: new Request('https://app.example.test/registrodevendas/app-runtime-v75.js?v=75'),
  respondWith: promise => { staticResponsePromise = promise; }
});
assert.ok(staticResponsePromise, 'Arquivos estáticos do sistema precisam passar pelo cache offline.');
assert.equal((await staticResponsePromise).status, 200);
assert.equal(cachedWrites, 1);

const assetsBlock = worker.slice(worker.indexOf('const CORE_ASSETS = ['), worker.indexOf('];', worker.indexOf('const CORE_ASSETS = [')));
for (const match of assetsBlock.matchAll(/'([^']+)'/g)) {
  const asset = match[1];
  if (!asset.startsWith('./') || asset === './') continue;
  const file = asset.slice(2).split('?')[0];
  assert.ok(fs.existsSync(path.join(root, file)), `Arquivo do cache offline ausente: ${file}`);
}

const backupUi = read('aba-backup-v75.js');
for (const marker of ['{ merge: true }', "saveLocalBackup(safetyBackup, 'before-restore')", 'downloadBackup(safetyBackup)', 'validateBackup', 'RESTORE_BATCH_SIZE = 400', 'Ativar neste aparelho', 'Desativar e limpar', 'clearLocalBackups(userId)']) {
  assert.ok(backupUi.includes(marker), `Restauração segura incompleta: ${marker}`);
}
assert.ok(!backupUi.includes('deleteDoc'), 'A restauração não pode excluir registros.');
assert.ok(read('backup-storage-v75.js').includes('LOCAL_BACKUP_LIMIT = 5'));
assert.ok(read('backup-storage-v75.js').includes('export const clearLocalBackups'));
assert.ok(read('tab-persistence.js').includes("label === 'backup e dados'"));

const manifest = JSON.parse(read('manifest.json'));
assert.equal(manifest.id, './');
assert.equal(manifest.start_url, './');
assert.equal(manifest.display, 'standalone');

const inherited = spawnSync(process.execPath, ['scripts/validate-v74.mjs'], {
  cwd: root,
  encoding: 'utf8'
});
if (inherited.status !== 0) throw new Error(`Regressão herdada da v74:\n${inherited.stderr || inherited.stdout}`);
process.stdout.write(inherited.stdout);

console.log('Aplicação v75 validada: runtime e CSS consolidados, offline seguro, backups restauráveis e regressões cobertas.');
