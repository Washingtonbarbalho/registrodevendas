import assert from 'node:assert/strict';
import test from 'node:test';
import { createAsaasFlowClient, createCheckoutTestRequest } from '../integrations/asaas-flow-client.js';

const id = 'ca4d0000-1111-4222-8333-000000000001';
const pending = { environment: 'sandbox', simulationOnly: true, id, kind: 'checkout', state: 'pending', amountCents: 20000, ready: true, providerStatus: 'PENDING', payload: '000201', encodedImage: '', summary: {} };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });

test('pedido do caixa preserva preço por item e centavos e não envia dados pessoais ao Sandbox', () => {
  const request = createCheckoutTestRequest([{ productId: 'a', quantity: 3, price: 19.99, customerName: 'private', cost: 7 }], id);
  assert.deepEqual(request, { kind: 'checkout', idempotencyKey: id, items: [{ productId: 'a', quantity: 3, lineTotalCents: 1999 }] });
});

test('cliente usa rotas fixas, login Firebase e nenhum segredo Asaas ou confirmação enviada pelo navegador', async () => {
  const calls = [];
  const client = createAsaasFlowClient({ getIdToken: async () => 'firebase-token', fetcher: async (url, init) => { calls.push([url, init]); return reply({ ...pending, apiKey: 'private', cipher: 'private', snapshotJson: 'private', received: true }); } });
  const data = await client.create(createCheckoutTestRequest([{ productId: 'p', quantity: 1, price: 200 }], id));
  await client.get(id);
  await client.simulate(id);
  await client.reconcile(id);
  await client.cancel(id);
  assert.equal(data.apiKey, undefined);
  assert.equal(data.cipher, undefined);
  assert.equal(data.snapshotJson, undefined);
  assert.equal(data.state, 'pending');
  assert.deepEqual(calls.map(([url, init]) => [new URL(url).pathname, init.method]), [
    ['/api/integrations/asaas/flow/charges', 'POST'],
    ['/api/integrations/asaas/flow/charges/' + id, 'GET'],
    ['/api/integrations/asaas/flow/charges/' + id + '/simulate', 'POST'],
    ['/api/integrations/asaas/flow/charges/' + id + '/reconcile', 'POST'],
    ['/api/integrations/asaas/flow/charges/' + id + '/cancel', 'POST'],
  ]);
  for (const [, init] of calls) { assert.equal(init.headers.Authorization, 'Bearer firebase-token'); assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'manual'); assert.equal(init.cache, 'no-store'); }
});

test('produção, lista com IDs externos e recebimento sem comprovação não são exibidos como sucesso', async () => {
  for (const data of [{ ...pending, environment: 'production' }, { ...pending, simulationOnly: false }, { ...pending, state: 'received', confirmationSource: 'webhook', summary: { receivedCents: 20000 } }, { ...pending, state: 'received', providerStatus: 'RECEIVED', summary: { receivedCents: 20000 } }, { environment: 'sandbox', simulationOnly: true, orders: [{ id: '../other', kind: 'checkout', amountCents: 500 }] }]) {
    const client = createAsaasFlowClient({ getIdToken: async () => 'token', fetcher: async () => reply(data) });
    await assert.rejects(client.get(id));
  }
});

test('renova token apenas no 401, não repete cobrança em falha de rede e orienta retomar pelo perfil', async () => {
  const refreshes = [];
  let calls = 0;
  const client = createAsaasFlowClient({ getIdToken: async force => { refreshes.push(force); return 'token'; }, fetcher: async () => ++calls === 1 ? reply({}, 401) : reply(pending) });
  await client.get(id);
  assert.deepEqual(refreshes, [false, true]);
  let failures = 0;
  const offline = createAsaasFlowClient({ getIdToken: async () => 'token', fetcher: async () => { failures++; throw new Error('private-key-in-transport'); } });
  await assert.rejects(offline.create({}), error => /Testes pendentes/.test(error.message) && !error.message.includes('private-key-in-transport'));
  assert.equal(failures, 1);
});
