import assert from 'node:assert/strict';
import { buildReport as buildAccountingReport } from '../reports-engine-v70.js';
import { buildReport as buildActiveReport } from '../reports-engine-v73.js';

const valueOf = (report, label) => {
  const item = report.metrics.find(metric => metric.label === label);
  assert.ok(item, `Indicador de crediário ausente: ${label}`);
  return item.value;
};

const julySalePaidInAugust = {
  id: 'july-paid-in-august',
  saleType: 'prazo',
  saleDate: '2026-07-12',
  customerId: 'customer-july',
  customerName: 'Cliente de julho',
  status: 'completed',
  totalPrice: 100,
  totalCost: 45,
  entryAmount: 0,
  installments: [{
    originalAmount: 100,
    amount: 0,
    dueDate: '2026-08-10',
    paid: true,
    paidAt: '2026-08-05',
    history: [{ type: 'full', amount: 100, date: '2026-08-05' }]
  }]
};

const julyContext = {
  reportId: 'credit',
  sales: [julySalePaidInAugust],
  startDate: '2026-07-01',
  endDate: '2026-07-31',
  creditToday: '2026-08-24'
};

for (const [name, buildReport] of [
  ['motor financeiro', buildAccountingReport],
  ['relatório ativo', buildActiveReport]
]) {
  const historical = buildReport(julyContext);
  const current = buildReport({ ...julyContext, creditPositionMode: 'current' });

  assert.equal(historical.creditPosition.mode, 'as-of', `${name}: a posição histórica deve ser a leitura inicial.`);
  assert.equal(historical.creditPosition.referenceDate, '2026-07-31');
  assert.equal(current.creditPosition.mode, 'current');
  assert.equal(current.creditPosition.referenceDate, '2026-08-24');
  assert.equal(valueOf(historical, 'Saldo na data final do período'), 100,
    `${name}: julho deve manter R$ 100 a receber quando o pagamento aconteceu apenas em agosto.`);
  assert.equal(valueOf(historical, 'Saldo atual da carteira'), 0,
    `${name}: a carteira atual deve reconhecer o pagamento realizado em agosto.`);
  assert.equal(valueOf(current, 'Saldo na data final do período'), 100,
    `${name}: a leitura atual não pode apagar o encerramento histórico.`);
  assert.equal(valueOf(current, 'Saldo atual da carteira'), 0);
  assert.equal(valueOf(historical, 'Recebido no período'), 0);
  assert.equal(valueOf(current, 'Recebido no período'), 0,
    `${name}: pagamentos de agosto não podem virar recebimentos de julho.`);
  assert.match(historical.rows[0][4], /100,00/);
  assert.match(current.rows[0][4], /0,00/);
  assert.match(current.rows[0][3], /100,00/);
  assert.ok(historical.subtitle.includes('31/07/2026'));
  assert.ok(current.subtitle.includes('24/08/2026'));
}

const partiallyPaidSale = {
  id: 'july-partial',
  saleType: 'prazo',
  saleDate: '2026-07-01',
  customerId: 'customer-partial',
  customerName: 'Cliente parcial',
  status: 'active',
  totalPrice: 300,
  totalCost: 120,
  entryAmount: 0,
  installments: [
    {
      originalAmount: 100, amount: 0, dueDate: '2026-07-10', paid: true, paidAt: '2026-07-15',
      history: [{ type: 'full', amount: 100, date: '2026-07-15' }]
    },
    {
      originalAmount: 100, amount: 40, dueDate: '2026-07-25', paid: false,
      history: [{ type: 'partial', amount: 60, date: '2026-08-03' }]
    },
    { originalAmount: 100, amount: 100, dueDate: '2026-08-10', paid: false, history: [] }
  ]
};

const historicalPartial = buildActiveReport({ ...julyContext, sales: [partiallyPaidSale] });
const currentPartial = buildActiveReport({ ...julyContext, sales: [partiallyPaidSale], creditPositionMode: 'current' });

assert.equal(valueOf(historicalPartial, 'Saldo na data final do período'), 200);
assert.equal(valueOf(historicalPartial, 'Saldo atual da carteira'), 140);
assert.equal(valueOf(historicalPartial, 'Valor vencido'), 100,
  'No encerramento de julho, somente a parcela vencida em julho deve aparecer em atraso.');
assert.equal(valueOf(currentPartial, 'Valor vencido'), 140,
  'Na carteira atual, o saldo parcial e a parcela vencida em agosto devem aparecer em atraso.');
assert.equal(valueOf(historicalPartial, 'Clientes inadimplentes'), 1);
assert.equal(valueOf(currentPartial, 'Clientes inadimplentes'), 1);
assert.equal(valueOf(historicalPartial, 'Inadimplência da carteira'), 50);
assert.equal(valueOf(currentPartial, 'Inadimplência da carteira'), 100);
assert.equal(valueOf(historicalPartial, 'Média de dias em atraso'), 6);
assert.equal(valueOf(currentPartial, 'Média de dias em atraso'), 22);
assert.equal(valueOf(historicalPartial, 'Recebido no período'), 100);
assert.equal(valueOf(currentPartial, 'Recebido no período'), 100);
assert.equal(valueOf(historicalPartial, 'Pagamentos atrasados no período'), 1);
assert.match(historicalPartial.rows[0][3], /100,00/);
assert.match(currentPartial.rows[0][3], /160,00/);
assert.match(historicalPartial.rows[0][4], /200,00/);
assert.match(currentPartial.rows[0][4], /140,00/);

const canceledInAugust = {
  id: 'july-canceled-in-august',
  saleType: 'prazo',
  saleDate: '2026-07-20',
  customerId: 'customer-canceled',
  customerName: 'Cliente cancelado',
  status: 'canceled',
  totalPrice: 50,
  totalCost: 20,
  entryAmount: 0,
  installments: [{ originalAmount: 50, amount: 50, dueDate: '2026-08-20', paid: false }],
  cancellations: [{ id: 'cancel-august', type: 'total', date: '2026-08-08', canceledContractValue: 50 }]
};

const createdAfterJuly = {
  id: 'august-new-contract',
  saleType: 'prazo',
  saleDate: '2026-08-04',
  customerName: 'Contrato de agosto',
  status: 'active',
  totalPrice: 400,
  installments: [{ originalAmount: 400, amount: 400, dueDate: '2026-09-04', paid: false }]
};

const historicalCancellation = buildActiveReport({
  ...julyContext,
  sales: [canceledInAugust, createdAfterJuly]
});
const currentCancellation = buildActiveReport({
  ...julyContext,
  sales: [canceledInAugust, createdAfterJuly],
  creditPositionMode: 'current'
});

assert.equal(valueOf(historicalCancellation, 'Saldo na data final do período'), 50,
  'Cancelamentos de agosto não podem eliminar a carteira existente no fim de julho.');
assert.equal(valueOf(currentCancellation, 'Saldo atual da carteira'), 0,
  'A carteira atual deve excluir contratos cancelados depois do período.');
assert.equal(valueOf(historicalCancellation, 'Vendido a prazo no período'), 50);
assert.equal(valueOf(currentCancellation, 'Vendido a prazo no período'), 50,
  'A troca da leitura de carteira não pode alterar os contratos registrados em julho.');
assert.equal(historicalCancellation.rows.length, 1,
  'Contratos criados após a data final selecionada não pertencem à carteira daquele período.');
assert.equal(currentCancellation.rows.length, 0);

const legacyPaidWithoutHistory = {
  ...julySalePaidInAugust,
  id: 'july-paid-without-history',
  installments: [{ originalAmount: 100, amount: 0, dueDate: '2026-08-10', paid: true, paidAt: '2026-08-05' }]
};

const legacyProjection = buildActiveReport({ ...julyContext, sales: [legacyPaidWithoutHistory] });
assert.equal(valueOf(legacyProjection, 'Saldo na data final do período'), 100,
  'Parcelas antigas sem histórico detalhado ainda devem respeitar a data de quitação.');
assert.equal(valueOf(legacyProjection, 'Saldo atual da carteira'), 0);

console.log('Crediário validado: posição histórica, carteira atual, pagamentos parciais, atrasos, cancelamentos e parcelas antigas.');
