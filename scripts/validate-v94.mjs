import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPurchaseTransactionDetails } from '../financial-account-details-v80.js';
import { buildFinancialLedger } from '../financial-core-v70.js';
import { getActiveDatabaseOperations, trackDatabaseOperation } from '../database-activity-v94.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const batchId = 'batch-v94-validation';
const sharedPlan = [
  { number: 1, dueDate: '2026-09-01', amount: 40, paid: true, paidAt: '2026-09-01', paidAtDateTime: '2026-09-01T10:00:00-03:00' },
  { number: 2, dueDate: '2026-10-01', amount: 40, paid: false, paidAt: null }
];
const products = [
  {
    id: 'product-a', name: 'Produto A', movements: [{
      id: `${batchId}-1`, batchId, batchIndex: 0, type: 'compra', quantity: 2, unitCost: 10,
      date: '2026-08-01T09:30:00-03:00', paymentMethod: 'term', financialInstallments: sharedPlan,
      supplierName: 'Fornecedor Teste', notes: 'Pedido 123',
      financialCancellations: [{
        id: 'return-a', quantity: 1, amount: 10, cashRefundAmount: 10,
        accountReductionAmount: 0, hadCashOut: true, date: '2026-09-02',
        createdAt: '2026-09-02T12:00:00-03:00', reason: 'Produto avariado'
      }]
    }]
  },
  {
    id: 'product-b', name: 'Produto B', movements: [{
      id: `${batchId}-2`, batchId, batchIndex: 1, type: 'compra', quantity: 3, unitCost: 20,
      date: '2026-08-01T09:30:00-03:00', paymentMethod: 'term', financialInstallments: sharedPlan,
      supplierName: 'Fornecedor Teste', notes: 'Pedido 123'
    }]
  }
];

const ledger = buildFinancialLedger({ products });
const paymentEntry = ledger.find(entry => entry.source === 'stock' && entry.batchId === batchId);
const refundEntry = ledger.find(entry => entry.source === 'stock-refund');
assert.ok(paymentEntry, 'O pagamento do lote precisa aparecer no extrato.');
assert.equal(refundEntry?.batchId, batchId, 'O estorno precisa preservar o identificador do lote.');

const details = buildPurchaseTransactionDetails(paymentEntry, { products });
assert.equal(details?.title, 'Detalhes da compra em lote');
assert.equal(details?.itemCount, 2);
assert.equal(details?.originalTotal, 80);
assert.equal(details?.paidTotal, 40);
assert.equal(details?.openTotal, 40);
assert.equal(details?.cashRefundTotal, 10);
assert.equal(details?.products.length, 2);
assert.equal(details?.installments.length, 2);
assert.equal(details?.highlightedInstallment?.number, 1);
assert.equal(details?.supplier, 'Fornecedor Teste');

const app = read('app-runtime-v75.js');
for (const marker of [
  'handlePixFromList',
  'handleRegisterPixPayment',
  "handleOpenWA('recibo', completed.sale, paidInstallment, completed.payment.historyItem)",
  "source === 'dashboard'",
  'onRegisterPayment: pixModalData.source',
  'hasPixSetup: !!userProfile?.pixKey'
]) assert.ok(app.includes(marker), `Fluxo de PIX/comprovante incompleto: ${marker}`);

const modals = read('modals-core-runtime-v75.js');
for (const marker of [
  'Gerar PIX desta parcela',
  'Registrar pagamento',
  'Compartilhar no WhatsApp',
  'Copiar Mensagem',
  'onRegisterPayment'
]) assert.ok(modals.includes(marker), `Ação ausente nos modais: ${marker}`);

const finance = read('aba-financeiro-v68.js');
for (const marker of [
  'PurchaseTransactionDetailsModal',
  'buildPurchaseTransactionDetails',
  'onOpenPurchaseDetails',
  'Produtos da compra',
  'Parcelas da compra',
  'Cancelamentos e devoluções'
]) assert.ok(finance.includes(marker), `Detalhamento da compra incompleto: ${marker}`);

for (const consumer of [
  'app-runtime-v75.js',
  'nova-venda-runtime-v75.js',
  'aba-clientes-runtime-v75.js',
  'auth-admin.js',
  'auth-screen-v71.js',
  'batch-stock-modal-v68.js',
  'aba-relatorios-v73.js',
  'aba-financeiro-v68.js',
  'aba-comercial-v74.js'
]) assert.ok(read(consumer).includes("from './firestore-runtime-v94.js?v=94'"),
  `${consumer} precisa usar a camada de carregamento do banco.`);

const firestoreRuntime = read('firestore-runtime-v94.js');
for (const operation of ['getDoc', 'getDocs', 'addDoc', 'setDoc', 'updateDoc', 'deleteDoc', 'runTransaction', 'writeBatch', 'onSnapshot']) {
  assert.ok(firestoreRuntime.includes(`export const ${operation}`), `Operação Firestore sem acompanhamento: ${operation}`);
}

let finishOperation;
const pending = trackDatabaseOperation(new Promise(resolve => { finishOperation = resolve; }), 'Teste de sincronização');
assert.equal(getActiveDatabaseOperations(), 1);
finishOperation('ok');
assert.equal(await pending, 'ok');
await new Promise(resolve => setTimeout(resolve, 5));
assert.equal(getActiveDatabaseOperations(), 0);

const styles = read('styles-runtime-v75.css');
for (const marker of ['.app94-database-loading', '.finance94-purchase-modal', '.installment94-pix-action']) {
  assert.ok(styles.includes(marker), `Estilo v94 ausente: ${marker}`);
}

console.log('Aplicação v94 validada: compras em lote detalhadas, PIX com comprovante e sincronização visível.');
