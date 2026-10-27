import assert from 'node:assert/strict';
import test from 'node:test';
import { flowFixture, flowRequest, checkout, checkoutId, parcel, env, result } from './flow-fixture.mjs';

const order = (f, id) => f.docs.get('_asaas_flow_sandbox/userA/orders/' + id);
const count = f => Number(f.docs.get('_asaas_integrations/userA').fields.pendingCharges?.integerValue || 0);
const create = (f, body = checkout()) => f.worker.fetch(flowRequest('POST', '', body), env);
const action = (f, id, name) => f.worker.fetch(flowRequest('POST', '/' + id + '/' + name), env);

test('caixa: confirma em cópia isolada com estoque e recibo únicos, preservando os dados reais', async () => {
  const f = flowFixture();
  await f.setup();
  const realBefore = structuredClone([...f.sources]);
  const created = await result(await create(f));
  assert.equal(created.amountCents, 20000);
  assert.equal(created.state, 'pending');
  assert.equal(created.simulationOnly, true);
  assert.equal(count(f), 1);
  assert.equal((await result(await action(f, created.id, 'simulate'))).state, 'pending');
  await result(await f.deliver('pay_flow_1', 'evt_1', { value: 1, status: 'PENDING' }));
  const received = await result(await f.worker.fetch(flowRequest('GET', '/' + created.id), env));
  assert.equal(received.state, 'received');
  assert.equal(received.confirmationSource, 'webhook');
  assert.equal(received.summary.receivedCents, 20000);
  assert.equal(received.summary.stockUnits, 2);
  assert.equal(count(f), 0);
  assert.deepEqual([...f.sources], realBefore);
  assert.equal(JSON.parse(order(f, created.id).fields.resultJson.stringValue).stockPlan[0].newQuantity, 1);
  await result(await f.deliver('pay_flow_1', 'evt_1'));
  await result(await f.deliver('pay_flow_1', 'evt_duplicate'));
  assert.equal([...f.docs.keys()].filter(path => path.includes('/receipts/')).length, 1);
  assert.deepEqual((await result(await f.worker.fetch(flowRequest(), env))).orders, []);
  assert.equal((await result(await create(f))).state, 'received');
  assert.equal(f.payments.size, 1);
});

test('parcela: usa saldo restante do servidor, preserva histórico e original e deduplica entre dispositivos', async () => {
  const f = flowFixture();
  await f.setup();
  const realBefore = structuredClone([...f.sources]);
  const first = await result(await create(f, parcel));
  assert.equal(first.amountCents, 6000);
  assert.equal((await result(await create(f, parcel))).id, first.id);
  assert.equal(f.payments.size, 1);
  await result(await action(f, first.id, 'simulate'));
  await result(await f.deliver('pay_flow_1'));
  const received = await result(await f.worker.fetch(flowRequest('GET', '/' + first.id), env));
  assert.equal(received.summary.installmentPaid, true);
  assert.equal(received.summary.remainingCents, 10000);
  const copy = JSON.parse(order(f, first.id).fields.resultJson.stringValue);
  assert.equal(copy.installments[0].history.length, 2);
  assert.equal(copy.installments[0].history[1].providerPaymentId, 'pay_flow_1');
  assert.equal(copy.installments[1].paid, false);
  assert.deepEqual([...f.sources], realBefore);
});

test('mudança manual, edição ou cancelamento da parcela impede aplicar um recebimento desatualizado', async () => {
  for (const change of ['paid', 'amount', 'cancelled']) {
    const f = flowFixture();
    await f.setup();
    const created = await result(await create(f, parcel));
    const sale = structuredClone(f.initialSale);
    if (change === 'paid') sale.installments[0].paid = true;
    if (change === 'amount') sale.installments[0].amount = 20;
    if (change === 'cancelled') sale.status = 'canceled';
    f.setSource(f.salePath, sale);
    const realBefore = structuredClone([...f.sources]);
    await result(await action(f, created.id, 'simulate'));
    await result(await f.deliver('pay_flow_1'));
    assert.equal(order(f, created.id).fields.state.stringValue, 'review');
    assert.equal(count(f), 0);
    assert.deepEqual([...f.sources], realBefore);
  }
});

test('reembolso estorna somente o resultado simulado e eventos atrasados não criam novo crédito', async () => {
  const f = flowFixture();
  await f.setup();
  const created = await result(await create(f));
  await result(await action(f, created.id, 'simulate'));
  await result(await f.deliver('pay_flow_1', 'evt_paid'));
  f.payments.get('pay_flow_1').status = 'REFUNDED';
  await result(await f.deliver('pay_flow_1', 'evt_refund'));
  assert.equal((await result(await f.worker.fetch(flowRequest('GET', '/' + created.id), env))).summary.receivedCents, 0);
  await result(await f.deliver('pay_flow_1', 'evt_late'));
  assert.equal(order(f, created.id).fields.state.stringValue, 'refunded');
  assert.equal(count(f), 0);
});

test('valor, referência, cliente ou forma divergentes na API não confirmam o pedido', async () => {
  for (const change of [{ value: 200.01 }, { externalReference: 'other' }, { customer: 'cus_other' }, { billingType: 'BOLETO' }]) {
    const f = flowFixture();
    await f.setup();
    const created = await result(await create(f));
    Object.assign(f.payments.get('pay_flow_1'), { status: 'RECEIVED', ...change });
    await result(await f.deliver('pay_flow_1'), 409);
    assert.equal(order(f, created.id).fields.state.stringValue, 'pending');
    assert.equal(count(f), 1);
  }
});

test('CONFIRMED e a resposta da simulação não geram baixa; conciliação usa a API sem confiar no navegador', async () => {
  const f = flowFixture();
  await f.setup();
  const created = await result(await create(f));
  f.payments.get('pay_flow_1').status = 'CONFIRMED';
  await result(await f.deliver('pay_flow_1'));
  assert.equal(order(f, created.id).fields.state.stringValue, 'pending');
  f.payments.get('pay_flow_1').status = 'RECEIVED';
  const received = await result(await action(f, created.id, 'reconcile'));
  assert.equal(received.state, 'received');
  assert.equal(received.confirmationSource, 'reconciliation');
});

test('cancelamento confere exclusão no provedor e libera o teste e a configuração', async () => {
  const f = flowFixture();
  await f.setup();
  const created = await result(await create(f));
  assert.equal((await result(await action(f, created.id, 'cancel'))).state, 'cancelled');
  assert.equal(f.payments.get('pay_flow_1').deleted, true);
  assert.equal(count(f), 0);
  assert.deepEqual((await result(await f.worker.fetch(flowRequest(), env))).orders, []);
});

test('testes pendentes impedem desativar, substituir ou remover a credencial usada', async () => {
  const f = flowFixture();
  await f.setup();
  await result(await create(f));
  for (const [method, body] of [['PUT', { enabled: false }], ['PUT', { apiKey: 'another-sandbox-key' }], ['DELETE', undefined]]) {
    const req = flowRequest(method, '', body);
    const request = new Request(req.url.replace('/flow/charges', ''), req);
    assert.equal((await result(await f.worker.fetch(request, env), 409)).code, 'pending_charges');
  }
});

test('falha atômica no recibo não reduz o contador nem aplica parte do pagamento', async () => {
  const options = { failReceiptCommit: false };
  const f = flowFixture(options);
  await f.setup();
  const created = await result(await create(f));
  await result(await action(f, created.id, 'simulate'));
  options.failReceiptCommit = true;
  await result(await f.deliver('pay_flow_1'), 503);
  assert.equal(count(f), 1);
  assert.equal(order(f, created.id).fields.state.stringValue, 'pending');
  assert.equal([...f.docs.keys()].filter(path => path.includes('/receipts/')).length, 0);
  options.failReceiptCommit = false;
  await result(await f.deliver('pay_flow_1'));
  assert.equal(count(f), 0);
});

test('timeout após criar no Asaas é recuperado pela mesma intenção, sem repetir cobrança', async () => {
  const f = flowFixture({ timeoutPayment: true });
  await f.setup();
  await result(await create(f), 502);
  assert.equal(f.payments.size, 1);
  assert.equal((await result(await create(f))).id, checkoutId);
  assert.equal(f.payments.size, 1);
  assert.equal(count(f), 1);
});

test('cancelar rascunho rejeitado antes da cobrança libera a configuração sem criar pagamento', async () => {
  const f = flowFixture({ rejectPayment: true });
  await f.setup();
  await result(await create(f), 502);
  assert.equal(f.payments.size, 0);
  const cancelled = await result(await action(f, checkoutId, 'cancel'));
  assert.equal(cancelled.state, 'cancelled');
  assert.equal(count(f), 0);
});

test('rejeita totais livres, IDs e caminhos externos e reutilização da intenção com outro carrinho', async () => {
  const f = flowFixture();
  await f.setup();
  for (const body of [checkout({ amountCents: 1 }), checkout({ uid: 'userB' }), checkout({ environment: 'production' }), checkout({ items: [{ productId: '../other', quantity: 1, lineTotalCents: 500 }] }), { ...parcel, installmentIndex: -1 }, { ...parcel, amountCents: 1 }]) await result(await create(f, body), 400);
  await result(await create(f));
  await result(await create(f, checkout({ items: [{ productId: 'product1', quantity: 1, lineTotalCents: 9000 }] })), 409);
  const other = await f.worker.fetch(flowRequest('GET', '/' + checkoutId, undefined, 'userB'), env);
  await result(other, 409);
  assert.equal(f.payments.size, 1);
});

test('limite de pendências e estoque insuficiente não geram cobranças adicionais', async () => {
  const f = flowFixture();
  await f.setup();
  await result(await create(f, checkout({ items: [{ productId: 'product1', quantity: 4, lineTotalCents: 40000 }] })), 409);
  assert.equal(f.payments.size, 0);
  f.docs.get('_asaas_integrations/userA').fields.pendingCharges = { integerValue: '5' };
  await result(await create(f), 409);
  assert.equal(f.payments.size, 0);
});

test('callbacks concorrentes gravam um único recibo e liberam o contador uma única vez', async () => {
  let entered = 0;
  let release;
  let both;
  const barrier = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { both = resolve; });
  const f = flowFixture({ beforeCommit: async writes => {
    if (!writes.some(write => write.update?.name.includes('/receipts/'))) return;
    if (++entered === 2) both();
    await barrier;
  } });
  await f.setup();
  const created = await result(await create(f));
  await result(await action(f, created.id, 'simulate'));
  const first = f.deliver('pay_flow_1', 'evt_concurrent_1');
  const second = f.deliver('pay_flow_1', 'evt_concurrent_2');
  await started;
  release();
  const responses = await Promise.all([first, second]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 503]);
  assert.equal(count(f), 0);
  assert.equal([...f.docs.keys()].filter(path => path.includes('/receipts/')).length, 1);
  await result(await f.deliver('pay_flow_1', 'evt_retry'));
  assert.equal(count(f), 0);
});

test('parcela com valor alterado não cria outra cobrança enquanto a intenção anterior está pendente', async () => {
  const f = flowFixture();
  await f.setup();
  const created = await result(await create(f, parcel));
  const changed = structuredClone(f.initialSale);
  changed.installments[0].amount = 50;
  f.setSource(f.salePath, changed);
  const blocked = await result(await create(f, parcel), 409);
  assert.equal(blocked.code, 'flow_installment_pending');
  assert.equal(f.payments.size, 1);
  await result(await action(f, created.id, 'cancel'));
  const next = await result(await create(f, parcel));
  assert.equal(next.amountCents, 5000);
  assert.notEqual(next.id, created.id);
});

test('reembolso recebido antes da confirmação encerra a pendência sem creditar o teste', async () => {
  const f = flowFixture();
  await f.setup();
  const created = await result(await create(f));
  f.payments.get('pay_flow_1').status = 'REFUNDED';
  await result(await f.deliver('pay_flow_1'));
  assert.equal(order(f, created.id).fields.state.stringValue, 'refunded');
  assert.equal(count(f), 0);
  assert.equal((await result(await f.worker.fetch(flowRequest('GET', '/' + created.id), env))).summary.receivedCents, 0);
});
