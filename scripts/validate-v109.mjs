import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyInstallmentPayment,
  applySelectedInstallmentsPayment,
  buildSalePaymentEvents,
  getInstallmentFaceAmount,
  reverseInstallmentPayment
} from '../financial-core-v70.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const installments = [100, 50, 80].map((amount, index) => ({
  number: index + 1,
  amount,
  originalAmount: amount,
  dueDate: `2026-${String(index + 11).padStart(2, '0')}-10`,
  paid: false,
  history: []
}));

const timestamp = '2026-11-05T20:00:00-03:00';
const grouped = applySelectedInstallmentsPayment(
  installments,
  [0, 2],
  18,
  '2026-11-05',
  timestamp,
  { paymentMethod: 'pix' }
);

assert.deepEqual(grouped.selectedIndices, [0, 2]);
assert.equal(grouped.selectedTotal, 180);
assert.equal(grouped.discountAmount, 18);
assert.equal(grouped.paidAmount, 162);
assert.deepEqual(grouped.installments.map(item => item.amount), [0, 50, 0]);
assert.deepEqual(grouped.installments.map(item => item.paid), [true, false, true]);
assert.deepEqual(grouped.installments.map(item => item.originalAmount), [90, 50, 72],
  'O desconto precisa reduzir o valor do contrato sem entrar como dinheiro recebido.');
assert.equal(getInstallmentFaceAmount(grouped.installments[0]), 90);
assert.deepEqual(grouped.historyItems.map(item => item.historyItem.paymentMethod), ['pix', 'pix']);
assert.deepEqual(grouped.historyItems.map(item => item.historyItem.discount), [10, 8]);

const saleEvents = buildSalePaymentEvents({ id: 'sale-group', installments: grouped.installments });
assert.equal(saleEvents.reduce((total, event) => total + event.amount, 0), 162,
  'O caixa deve receber somente o valor pago, sem somar o desconto.');

const reversed = reverseInstallmentPayment(grouped.installments, 0, 0, timestamp);
assert.deepEqual(reversed.installments.map(item => item.amount), [100, 50, 80]);
assert.deepEqual(reversed.installments.map(item => item.originalAmount), [100, 50, 80]);
assert.equal(reversed.reversedAmount, 162);
assert.equal(reversed.reversedDiscount, 18);
assert.ok(reversed.installments.every(item => item.history.length === 0),
  'Estornar uma parcela do grupo deve reabrir todo o recebimento conjunto.');

const single = applyInstallmentPayment(
  installments,
  0,
  25,
  '2026-11-05',
  timestamp,
  { paymentMethod: 'pix' }
);
assert.equal(single.historyItem.paymentMethod, 'pix', 'O recebimento individual deve guardar a forma escolhida.');

assert.throws(
  () => applySelectedInstallmentsPayment(installments, [0], 0, '2026-11-05'),
  error => error?.code === 'invalid-selection'
);
assert.throws(
  () => applySelectedInstallmentsPayment(installments, [0, 2], 180, '2026-11-05'),
  error => error?.code === 'invalid-discount'
);

const modals = read('modals-core-runtime-v75.js');
for (const marker of [
  "type: 'checkbox'",
  'Receber selecionadas',
  'sale109-receive-button',
  'Desconto no total (opcional)',
  'Forma de recebimento',
  'Gerar PIX de',
  'Confirmar recebimento',
  'QR Code PIX do recebimento',
  'payment109-list-receive'
]) assert.ok(modals.includes(marker), `Fluxo visual de recebimento incompleto: ${marker}`);
for (const removed of ['onShowPixCode', 'Gerar PIX desta parcela', 'installment94-pix-action']) {
  assert.ok(!modals.includes(removed), `A ação de PIX separada ainda está nas parcelas: ${removed}`);
}

const runtime = read('app-runtime-v75.js');
for (const marker of [
  'applySelectedInstallmentsPayment',
  'handleClickSelectedPayments',
  'originalTotalPrice',
  'settlementDiscountTotal',
  'paymentModal.items',
  'paymentModal.indices',
  'onReceiveSelected: handleClickSelectedPayments',
  '{ paymentMethod }'
]) assert.ok(runtime.includes(marker), `Integração do recebimento ausente: ${marker}`);
for (const removed of ['handlePixFromList', 'pixModalData', 'onShowPixCode:']) {
  assert.ok(!runtime.includes(removed), `O fluxo antigo de PIX ainda está ativo: ${removed}`);
}

const styles = read('styles-runtime-v75.css');
for (const marker of [
  '.sale109-selection-checkbox',
  '.sale109-multi-receive-bar',
  '.payment109-methods',
  '.payment109-pix-card'
]) assert.ok(styles.includes(marker), `Estilo do recebimento ausente: ${marker}`);

console.log('Versão 109 validada: botão Receber, PIX pelo valor informado e quitação múltipla com desconto.');
