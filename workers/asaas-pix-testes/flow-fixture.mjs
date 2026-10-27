import assert from 'node:assert/strict';
import { createWorker } from './worker-under-test.mjs';
import { fixture as baseFixture, env, request, webhookRequest, result, connect, hookToken } from './sandbox-fixture.mjs';

const BASE = '/api/integrations/asaas/flow/charges';
const origin = 'https://washingtonbarbalho.github.io';
const name = path => 'projects/vendas-aura/databases/(default)/documents/' + path;
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });
const value = item => item === null ? { nullValue: null } : typeof item === 'string' ? { stringValue: item } : typeof item === 'boolean' ? { booleanValue: item } : typeof item === 'number' ? Number.isInteger(item) ? { integerValue: String(item) } : { doubleValue: item } : Array.isArray(item) ? { arrayValue: { values: item.map(value) } } : { mapValue: { fields: fields(item) } };
const fields = data => Object.fromEntries(Object.entries(data).map(([key, item]) => [key, value(item)]));
const checkoutId = 'ca4d0000-1111-4222-8333-000000000001';
const checkout = (changes = {}) => ({ kind: 'checkout', idempotencyKey: checkoutId, items: [{ productId: 'product1', quantity: 2, lineTotalCents: 20000 }], ...changes });
const parcel = { kind: 'installment', saleId: 'sale1', installmentIndex: 0 };
const flowRequest = (method = 'GET', suffix = '', body, uid = 'userA') => request(method, '/flow/charges' + suffix, uid, { headers: { Origin: origin, Authorization: request('GET', '', uid).headers.get('Authorization'), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

function flowFixture(options = {}) {
  const base = baseFixture();
  const sources = new Map();
  const payments = new Map();
  const customers = new Map();
  const commits = [];
  const providerCalls = [];
  let clock = 0;
  const version = () => '2026-10-27T13:00:00.' + String(++clock).padStart(6, '0') + 'Z';
  const setSource = (path, data) => sources.set(path, { name: name(path), fields: fields(data), updateTime: version() });
  const productPath = 'artifacts/vendas-aura-main/users/userA/products/product1';
  const salePath = 'artifacts/vendas-aura-main/users/userA/sales/sale1';
  const initialSale = { saleType: 'prazo', status: 'active', totalPrice: 200, installments: [{ number: 1, originalAmount: 100, amount: 60, paid: false, dueDate: '2026-10-27', history: [{ date: '2026-10-20', amount: 40, type: 'partial', timestamp: '2026-10-20T10:00:00Z' }] }, { number: 2, originalAmount: 100, amount: 100, paid: false, dueDate: '2026-11-27', history: [] }] };
  setSource(productPath, { name: 'Perfume teste', quantity: 3, costPrice: 40, salePrice: 100 });
  setSource(salePath, initialSale);
  const fetchGoogle = async (input, init) => {
    const url = new URL(input);
    if (url.hostname !== 'firestore.googleapis.com') return base.fetchGoogle(input, init);
    assert.equal(init.redirect, 'manual');
    const path = url.pathname.split('/documents/')[1];
    if (url.pathname.endsWith('/documents:commit')) {
      const writes = JSON.parse(init.body).writes;
      commits.push(structuredClone(writes));
      for (const write of writes) {
        const resource = write.update?.name || write.delete;
        assert.match(resource, /^projects\/vendas-aura\/databases\/\(default\)\/documents\/(?:_asaas_flow_sandbox\/[\w-]+\/(?:orders|pending|payments|receipts|slots)\/[\w-]+|_asaas_integrations\/[\w-]+)$/);
        const path = resource.split('/documents/')[1];
        const current = base.docs.get(path);
        if (write.currentDocument.updateTime ? current?.updateTime !== write.currentDocument.updateTime : write.currentDocument.exists === false && current) return reply({}, 412);
      }
      if (options.failCommit) return reply({}, 503);
      if (options.failReceiptCommit && writes.some(write => write.update?.name.includes('/receipts/'))) return reply({}, 412);
      await options.beforeCommit?.(writes);
      // Conferir novamente após a barreira de concorrência, antes de aplicar qualquer escrita.
      for (const write of writes) {
        const path = (write.update?.name || write.delete).split('/documents/')[1];
        const current = base.docs.get(path);
        if (write.currentDocument.updateTime ? current?.updateTime !== write.currentDocument.updateTime : write.currentDocument.exists === false && current) return reply({}, 412);
      }
      const updateTime = version();
      for (const write of writes) {
        const path = (write.update?.name || write.delete).split('/documents/')[1];
        if (write.delete) base.docs.delete(path);
        else base.docs.set(path, { name: write.update.name, fields: { ...base.docs.get(path)?.fields, ...write.update.fields }, updateTime });
      }
      return reply({ writeResults: writes.map(() => ({ updateTime })), commitTime: updateTime });
    }
    if (/^artifacts\/vendas-aura-main\/users\/[\w-]+\/(?:sales|products)\/[\w-]+$/.test(path || '')) {
      assert.equal(init.method, 'GET', 'Dados reais podem ser lidos, mas nunca gravados por um teste.');
      return sources.has(path) ? reply(structuredClone(sources.get(path))) : reply({}, 404);
    }
    if (/^_asaas_flow_sandbox\/[\w-]+\/pending$/.test(path || '')) {
      assert.equal(init.method, 'GET');
      return reply({ documents: [...base.docs].filter(([key]) => key.startsWith(path + '/')).map(([, doc]) => structuredClone(doc)) });
    }
    return base.fetchGoogle(input, init);
  };
  const fetchAsaas = async (input, init) => {
    const url = new URL(input);
    assert.equal(url.origin, 'https://api-sandbox.asaas.com');
    assert.equal(init.redirect, 'manual');
    const body = init.body ? JSON.parse(init.body) : null;
    providerCalls.push([url.href, init]);
    const reference = url.searchParams.get('externalReference') || body?.externalReference || '';
    if (url.pathname === '/v3/customers' && reference.startsWith('aura-flow-')) {
      if (init.method === 'GET') return reply({ data: [...customers.values()].filter(item => item.externalReference === reference) });
      assert.equal(body.notificationDisabled, true);
      assert.equal(body.cpfCnpj, '24971563792');
      assert.equal(body.email, undefined);
      assert.equal(body.mobilePhone, undefined);
      const customer = { ...body, id: 'cus_flow_' + (customers.size + 1) };
      customers.set(customer.id, customer);
      return reply(customer);
    }
    if (url.pathname === '/v3/payments' && reference.startsWith('aura-flow-')) {
      if (init.method === 'GET') return reply({ data: [...payments.values()].filter(item => item.externalReference === reference) });
      if (options.rejectPayment) return reply({ errors: [{ description: 'private-provider-details' }] }, 400);
      await options.beforePaymentCreate?.();
      const payment = { ...body, id: 'pay_flow_' + (payments.size + 1), status: 'PENDING' };
      payments.set(payment.id, payment);
      if (options.timeoutPayment) throw new Error('private-provider-details');
      return reply(payment);
    }
    const id = /\/payments\/(pay_flow_\d+)(?:\/pixQrCode)?$/.exec(url.pathname)?.[1] || /\/sandbox\/payment\/(pay_flow_\d+)\/confirm$/.exec(url.pathname)?.[1];
    if (id) {
      const payment = payments.get(id);
      if (!payment) return reply({}, 404);
      if (url.pathname.endsWith('/pixQrCode')) return reply({ encodedImage: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB', payload: '00020126580014br.gov.bcb.pix.SANDBOX_FLOW_TEST_ONLY', expirationDate: '2027-10-27 23:59:59' });
      if (url.pathname.endsWith('/confirm')) payment.status = 'RECEIVED';
      if (init.method === 'DELETE') payment.deleted = true;
      return reply(structuredClone(payment));
    }
    return base.fetchAsaas(input, init);
  };
  const worker = createWorker({ fetchGoogle, fetchAsaas });
  const setup = async () => {
    await connect(base);
    await result(await base.worker.fetch(request('POST'), env));
    await result(await base.worker.fetch(request('POST', '/sandbox-charge/simulate'), env));
    await result(await base.worker.fetch(webhookRequest({ id: 'pay_test' }), env));
  };
  const deliver = (id, eventId = 'evt_flow_1', extra = {}) => worker.fetch(webhookRequest({ id, externalReference: payments.get(id)?.externalReference, ...extra }, eventId), env);
  return { ...base, worker, sources, payments, flowCustomers: customers, commits, providerCalls, fetchGoogle, fetchAsaas, setSource, productPath, salePath, initialSale, setup, deliver };
}

export { flowFixture, flowRequest, checkout, checkoutId, parcel, env, result, hookToken, BASE };
