import assert from 'node:assert/strict';
import test from 'node:test';
import { validPayerCpf } from './production-check.js';
import { checkFixture, env, key, payer, checkRequest, webhook, result, tokenFor } from './production-check-fixture.mjs';
import { request } from './production-fixture.mjs';
const returned = async (f, request, code = 200) => result(await f.worker.fetch(request, env), code);
const paymentWrites = f => f.providerCalls.filter(([url, init]) => url.endsWith('/payments') && init.method === 'POST').length;

test('valida CPF e exige dados mínimos do pagador sem aceitar valor, UID ou ambiente', async () => {
    assert.equal(validPayerCpf(payer.payerCpf), true);
    assert.equal(validPayerCpf('529.982.247-25'), true);
    for (const cpf of ['', '11111111111', '52998224726', 'abc52998224725', null]) assert.equal(validPayerCpf(cpf), false);
    const f = checkFixture(); await f.connect();
    for (const body of [null, false, [], {}, { ...payer, amount: 1 }, { ...payer, uid: 'other' }, { ...payer, environment: 'sandbox' }, { ...payer, payerCpf: '11111111111' }]) await returned(f, checkRequest('POST', body), 400);
    assert.equal(paymentWrites(f), 0);
    assert.equal(f.docs.size, 1);
});

test('cria somente um Pix real fixo e guarda apenas metadados e hash do pagador em coleções privadas', async () => {
    const f = checkFixture();
    const data = await f.prepare();
    assert.equal(data.environment, 'production'); assert.equal(data.amountCents, 500);
    assert.equal(data.diagnosticOnly, true); assert.equal(data.ready, true); assert.equal(data.testComplete, false);
    assert.equal(data.netCents, null);
    assert.equal(f.docs.get('_asaas_production_integrations/userA').fields.pendingCharges.integerValue, '1');
    assert.equal(f.payments.length, 1); assert.equal(f.hooks.length, 1); assert.equal(f.customers.length, 1);
    assert.ok(!JSON.stringify([...f.docs]).includes(payer.payerCpf));
    assert.ok(!JSON.stringify([...f.docs]).includes(payer.payerName));
    assert.ok(!JSON.stringify([...f.docs]).includes(key));
    await returned(f, checkRequest('POST', payer));
    await returned(f, checkRequest('POST'));
    assert.equal(paymentWrites(f), 1);
    const calls = f.providerCalls.length;
    await returned(f, checkRequest());
    assert.equal(f.providerCalls.length, calls, 'Verificar retorno só consulta o estado salvo.');
    assert.ok([...f.docs.keys()].every(path => path.startsWith('_asaas_production_')));
});

test('somente o Webhook autenticado e a consulta do pagamento real concluem o teste; duplicatas não liberam duas vezes', async () => {
    const f = checkFixture(); await f.prepare();
    f.payments[0].status = 'CONFIRMED';
    await returned(f, webhook(f.payments[0], 'PAYMENT_CONFIRMED', 'evt_confirmed'));
    assert.equal((await returned(f, checkRequest())).testComplete, false);
    f.payments[0].status = 'RECEIVED';
    await returned(f, webhook({ id: f.payments[0].id, value: 9999 }));
    const data = await returned(f, checkRequest());
    assert.equal(data.testComplete, true); assert.equal(data.webhookVerified, true); assert.equal(data.netCents, 450);
    assert.equal(data.payload, '');
    assert.equal(f.docs.get('_asaas_production_integrations/userA').fields.pendingCharges.integerValue, '0');
    const before = structuredClone([...f.docs]);
    const calls = f.providerCalls.length;
    await returned(f, webhook(f.payments[0]));
    assert.deepEqual([...f.docs], before); assert.equal(f.providerCalls.length, calls);
});

test('conciliação consulta o Asaas mas aguarda Webhook para declarar retorno automático validado', async () => {
    const f = checkFixture(); await f.prepare(); f.payments[0].status = 'RECEIVED';
    const data = await returned(f, checkRequest('POST', undefined, '/reconcile'));
    assert.equal(data.status, 'RECEIVED'); assert.equal(data.testComplete, false); assert.equal(data.webhookVerified, false);
    await returned(f, webhook(f.payments[0]));
    assert.equal((await returned(f, checkRequest())).testComplete, true);
});

test('token de outro ambiente, corpo excessivo e eventos de outro pagamento não confirmam o teste', async () => {
    const f = checkFixture(); await f.prepare();
    const calls = f.googleCalls.length;
    await returned(f, webhook(f.payments[0], 'PAYMENT_RECEIVED', 'evt_x', 'userA', 'ff'.repeat(32)), 401);
    assert.equal(f.googleCalls.length, calls);
    const oversized = webhook(f.payments[0]);
    const large = new Request(oversized.url, { method: 'POST', headers: oversized.headers, body: JSON.stringify({ id: 'x', payment: { id: f.payments[0].id }, pad: 'x'.repeat(140000) }) });
    await returned(f, large, 413);
    await returned(f, webhook({ id: 'pay_other' }));
    assert.equal((await returned(f, checkRequest())).testComplete, false);
    assert.equal((await f.worker.fetch(checkRequest('POST', undefined, '/simulate'), env)).status, 404);
    assert.ok(!f.providerCalls.some(([url]) => /sandbox|refund|transfer/.test(url)));
});

test('dados incompatíveis e valor líquido inválido são recusados antes de confirmar ou liberar a pendência', async () => {
    for (const changes of [{ value: 4.99 }, { customer: 'cus_other' }, { externalReference: 'other' }, { billingType: 'BOLETO' }, { netValue: -1 }, { netValue: 6 }, { netValue: undefined }]) {
        const f = checkFixture(); await f.prepare(); Object.assign(f.payments[0], { status: 'RECEIVED' }, changes);
        const response = await f.worker.fetch(webhook(f.payments[0]), env);
        assert.ok([409, 503].includes(response.status)); await result(response, response.status);
        assert.equal((await returned(f, checkRequest())).testComplete, false);
        assert.equal(f.docs.get('_asaas_production_integrations/userA').fields.pendingCharges.integerValue, '1');
    }
});

test('uma cobrança pendente impede trocar ou remover a chave real', async () => {
    const f = checkFixture(); await f.prepare();
    await returned(f, request('PUT', { apiKey: key }), 409);
    await returned(f, request('DELETE'), 409);
    await returned(f, request('POST', undefined, '/test'));
    assert.equal(paymentWrites(f), 1);
});

test('cancelamento confere a exclusão no provedor, libera a pendência e permite um novo teste explícito', async () => {
    const f = checkFixture(); await f.prepare();
    const data = await returned(f, checkRequest('POST', undefined, '/cancel'));
    assert.equal(data.status, 'DELETED'); assert.equal(data.testComplete, false);
    assert.equal(f.payments[0].deleted, true);
    assert.equal(f.docs.get('_asaas_production_integrations/userA').fields.pendingCharges.integerValue, '0');
    await returned(f, checkRequest('POST', payer));
    assert.equal(paymentWrites(f), 2);
    assert.equal(f.payments.length, 2);
    assert.equal([...f.docs.keys()].filter(path => path.includes('/history/')).length, 1);
});

test('cancelar durante análise é bloqueado e pagamento que chegou antes do cancelamento é conciliado', async () => {
    const f = checkFixture(); await f.prepare(); f.payments[0].status = 'CONFIRMED';
    await returned(f, checkRequest('POST', undefined, '/cancel'), 409);
    assert.ok(!f.providerCalls.some(([, init]) => init.method === 'DELETE'));
    const g = checkFixture({ receivedOnCancel: true }); await g.prepare();
    const data = await returned(g, checkRequest('POST', undefined, '/cancel'));
    assert.equal(data.status, 'RECEIVED'); assert.equal(data.testComplete, false); assert.equal(g.payments[0].deleted, undefined);
});

test('respostas inconclusivas de criação são recuperadas pela referência sem repetir cobrança', async () => {
    for (const option of ['timeoutHook', 'timeoutCustomer', 'timeoutPayment']) {
        const f = checkFixture({ [option]: true }); await f.connect();
        await returned(f, checkRequest('POST', payer), 503);
        f.options[option] = false;
        await returned(f, checkRequest('POST', payer));
        assert.equal(f.payments.length, 1); assert.equal(paymentWrites(f), 1); assert.equal(f.customers.length, 1); assert.equal(f.hooks.length, 1);
    }
});

test('resultado desconhecido de uma criação impede novo POST e não permite cancelar como se a cobrança não existisse', async () => {
    const f = checkFixture({ unknownPayment: true }); await f.connect();
    await returned(f, checkRequest('POST', payer), 503);
    await returned(f, checkRequest('POST', payer), 409);
    await returned(f, checkRequest('POST', undefined, '/cancel'), 409);
    assert.equal(paymentWrites(f), 1);
    assert.equal(f.docs.get('_asaas_production_integrations/userA').fields.pendingCharges.integerValue, '1');
});

test('falha de permissão preserva diagnóstico e permite cancelar preparação sem pagamento criado', async () => {
    const f = checkFixture({ diagnosticProviderFailure: 403 }); await f.connect();
    await returned(f, checkRequest('POST', payer), 502);
    assert.equal(f.payments.length, 0);
    const data = await returned(f, checkRequest('POST', undefined, '/cancel'));
    assert.equal(data.status, 'DELETED'); assert.equal(f.docs.get('_asaas_production_integrations/userA').fields.pendingCharges.integerValue, '0');
});

test('um retorno adiantado pede reentrega enquanto o ID da cobrança ainda está sendo registrado', async () => {
    let f;
    f = checkFixture({ beforeCreatePayment: async payment => {
        const response = await f.worker.fetch(webhook(payment), env);
        assert.equal(response.status, 503);
    } });
    await f.prepare();
});

test('falha da gravação do retorno não aplica confirmação ou liberação parcial', async () => {
    const f = checkFixture({ commitFailure: true }); await f.prepare(); f.payments[0].status = 'RECEIVED';
    const before = structuredClone([...f.docs]);
    await returned(f, webhook(f.payments[0]), 503);
    assert.deepEqual([...f.docs], before);
});

test('retornos simultâneos gravam somente uma confirmação e uma liberação de pendência', async () => {
    let count = 0, release, enter;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { enter = resolve; });
    const f = checkFixture({ beforeCommit: async writes => {
        if (writes.some(write => write.update.fields.receivedWebhookAt?.timestampValue)) { count++; if (count === 1) { enter(); await gate; } }
    } });
    await f.prepare(); f.payments[0].status = 'RECEIVED';
    const first = f.worker.fetch(webhook(f.payments[0], 'PAYMENT_RECEIVED', 'evt_parallel_1'), env);
    await started;
    const second = await f.worker.fetch(webhook(f.payments[0], 'PAYMENT_RECEIVED', 'evt_parallel_2'), env);
    assert.equal(second.status, 200); release();
    assert.equal((await first).status, 503);
    await returned(f, webhook(f.payments[0], 'PAYMENT_RECEIVED', 'evt_parallel_1'));
    assert.equal(f.docs.get('_asaas_production_integrations/userA').fields.pendingCharges.integerValue, '0');
    assert.equal((await returned(f, checkRequest())).testComplete, true);
});

test('estornos concluídos são informados sem disparar estorno pela API e preservam a prova do teste', async () => {
    const f = checkFixture(); await f.prepare(); f.payments[0].status = 'RECEIVED';
    await returned(f, webhook(f.payments[0]));
    f.payments[0].refunds = [{ status: 'DONE', value: 1 }, { status: 'PENDING', value: 2 }, { status: 'CANCELLED', value: 2 }];
    await returned(f, webhook(f.payments[0], 'PAYMENT_PARTIALLY_REFUNDED', 'evt_partial'));
    assert.equal((await returned(f, checkRequest())).refundedCents, 100);
    f.payments[0].status = 'REFUNDED'; f.payments[0].refunds = [{ status: 'DONE', value: 5 }];
    await returned(f, webhook(f.payments[0], 'PAYMENT_REFUNDED', 'evt_refunded'));
    const data = await returned(f, checkRequest()); assert.equal(data.testComplete, true); assert.equal(data.status, 'REFUNDED'); assert.equal(data.refundedCents, 500);
    assert.ok(!f.providerCalls.some(([url]) => url.endsWith('/refund')));
});

test('rota real exige origem permitida, identidade válida e conta aprovada', async () => {
    const f = checkFixture(); await f.connect();
    for (const origin of [undefined, 'null', 'https://other.invalid']) await returned(f, checkRequest('GET', undefined, '', 'userA', { headers: { ...(origin ? { Origin: origin } : {}), Authorization: checkRequest().headers.get('Authorization') } }), 403);
    await returned(f, checkRequest('GET', undefined, '', 'userA', { headers: { Origin: 'https://washingtonbarbalho.github.io', Authorization: 'Bearer invalid' } }), 401);
    f.options.unapproved = true;
    await returned(f, checkRequest(), 403);
    assert.equal(paymentWrites(f), 0);
    const preflight = await f.worker.fetch(checkRequest('OPTIONS', undefined, '', 'userA', { headers: { Origin: 'https://washingtonbarbalho.github.io', 'Access-Control-Request-Method': 'POST' } }), env);
    assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'), null);
});

test('duas preparações concorrentes criam somente uma cobrança real', async () => {
    let first = true, release, enter;
    const gate = new Promise(resolve => { release = resolve; });
    const entered = new Promise(resolve => { enter = resolve; });
    const f = checkFixture({ beforeCommit: async writes => {
        if (writes.some(write => write.update.fields.reference?.stringValue) && first) { first = false; enter(); await gate; }
    } });
    await f.connect();
    const a = f.worker.fetch(checkRequest('POST', payer), env); await entered;
    const b = await f.worker.fetch(checkRequest('POST', payer), env); assert.equal(b.status, 200);
    release(); assert.equal((await a).status, 409);
    assert.equal(paymentWrites(f), 1); assert.equal(f.customers.length, 1); assert.equal(f.hooks.length, 1);
    assert.equal(f.docs.get('_asaas_production_integrations/userA').fields.pendingCharges.integerValue, '1');
});
