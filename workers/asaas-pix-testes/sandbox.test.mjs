import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorker } from './worker.js';
import { fixture, env, request, webhookRequest, result, connect, prepare, hookToken } from './sandbox-fixture.mjs';

test('prepara teste fixo, guarda somente no namespace privado e não altera dados financeiros', async () => {
    const f = fixture();
    await connect(f);
    assert.equal((await result(await f.worker.fetch(request(), env))).created, false);
    const data = await result(await f.worker.fetch(request('POST'), env));
    assert.equal(data.created, true);
    assert.equal(data.ready, true);
    assert.equal(data.amount, 5);
    assert.equal(data.testComplete, false);
    assert.equal(data.webhookVerified, false);
    assert.match(data.payload, /^000201/);
    assert.equal(f.docs.size, 2);
    assert.equal(f.hooks.length, 1);
    assert.equal(f.customers.length, 1);
    assert.equal(f.payments.length, 1);
});

test('repetir preparação ou criar em paralelo reutiliza o mesmo cliente, cobrança e Webhook', async () => {
    let entered;
    let release;
    const started = new Promise(resolve => { entered = resolve; });
    const hold = new Promise(resolve => { release = resolve; });
    const f = fixture({ beforePaymentCreate: () => { entered(); return hold; } });
    await connect(f);
    const first = f.worker.fetch(request('POST'), env);
    await started;
    const second = await f.worker.fetch(request('POST'), env);
    release();
    await result(second, 409);
    await result(await first);
    await result(await f.worker.fetch(request('POST'), env));
    assert.equal(f.payments.length, 1);
    assert.equal(f.customers.length, 1);
    assert.equal(f.hooks.length, 1);
});

test('simulação não confirma localmente; só Webhook autenticado com conferência na API conclui', async () => {
    const f = fixture();
    await prepare(f);
    const sent = await result(await f.worker.fetch(request('POST', '/sandbox-charge/simulate'), env));
    assert.equal(sent.received, false);
    assert.equal(sent.testComplete, false);
    const before = f.providerCalls.length;
    assert.equal((await result(await f.worker.fetch(request(), env))).testComplete, false);
    assert.equal(f.providerCalls.length, before, 'Consultar a tela lê o retorno salvo, sem polling no Asaas.');
    await result(await f.worker.fetch(webhookRequest({ id: 'pay_test', value: 1000000, status: 'PENDING' }), env));
    const done = await result(await f.worker.fetch(request(), env));
    assert.equal(done.received, true);
    assert.equal(done.webhookVerified, true);
    assert.equal(done.testComplete, true);
});

test('token ausente, de outro usuário ou corpo inválido não dispara consultas ao Google ou Asaas', async () => {
    const f = fixture();
    for (const token of ['', 'wrong', hookToken('userB')]) await result(await f.worker.fetch(webhookRequest({ id: 'pay_test' }, 'evt_a', 'userA', token), env), 401);
    await result(await f.worker.fetch(new Request('https://worker.test/api/webhooks/asaas/sandbox/userA', { method: 'POST', headers: { 'asaas-access-token': hookToken('userA'), 'Content-Type': 'application/json' }, body: 'x'.repeat(131073) }), env), 413);
    assert.equal(f.calls.length + f.providerCalls.length, 0);
});

test('eventos duplicados e IDs de cobrança de outro contexto não repetem atualizações', async () => {
    const f = fixture();
    await prepare(f);
    f.payments[0].status = 'RECEIVED';
    await result(await f.worker.fetch(webhookRequest({ id: 'pay_test' }), env));
    const before = f.providerCalls.length;
    const version = f.docs.get('_asaas_sandbox_checks/userA').updateTime;
    await result(await f.worker.fetch(webhookRequest({ id: 'pay_test' }), env));
    await result(await f.worker.fetch(webhookRequest({ id: 'pay_other' }, 'evt_other'), env));
    assert.equal(f.providerCalls.length, before);
    assert.equal(f.docs.get('_asaas_sandbox_checks/userA').updateTime, version);
    const other = await f.worker.fetch(request('GET', '/sandbox-charge', 'userB'), env);
    await result(other, 409);
    await result(await f.worker.fetch(request('PUT', '', 'userB', { headers: { Origin: 'https://washingtonbarbalho.github.io', Authorization: request('GET', '', 'userB').headers.get('Authorization'), 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: 'another-sandbox-user-api-key' }) }), env));
    assert.equal((await result(await f.worker.fetch(request('GET', '/sandbox-charge', 'userB'), env))).created, false);
    await result(await f.worker.fetch(request('POST', '/sandbox-charge/simulate', 'userB'), env), 409);
    await result(await f.worker.fetch(webhookRequest({ id: 'pay_test' }, 'evt_wrong_owner', 'userB'), env));
});

test('valor, cliente ou referência divergente na API impedem confirmar, mesmo com evento válido', async () => {
    for (const change of [{ value: 5.01 }, { customer: 'cus_other' }, { externalReference: 'other' }, { billingType: 'BOLETO' }]) {
        const f = fixture();
        await prepare(f);
        Object.assign(f.payments[0], { status: 'RECEIVED', ...change });
        const data = await result(await f.worker.fetch(webhookRequest({ id: 'pay_test' }), env), 409);
        assert.equal(data.code, 'sandbox_payment_mismatch');
        assert.equal((await result(await f.worker.fetch(request(), env))).testComplete, false);
    }
});

test('CONFIRMED não significa recebido e evento atrasado consulta o estado atual sem regredir reembolso', async () => {
    const f = fixture();
    await prepare(f);
    f.payments[0].status = 'CONFIRMED';
    await result(await f.worker.fetch(webhookRequest({ id: 'pay_test', status: 'RECEIVED' }), env));
    assert.equal((await result(await f.worker.fetch(request(), env))).testComplete, false);
    f.payments[0].status = 'REFUNDED';
    await result(await f.worker.fetch(webhookRequest({ id: 'pay_test', status: 'RECEIVED' }, 'evt_late'), env));
    const refunded = await result(await f.worker.fetch(request(), env));
    assert.equal(refunded.status, 'REFUNDED');
    assert.equal(refunded.received, false);
});

test('timeout após criar cobrança recupera pela referência sem novo POST, inclusive em outra instância', async () => {
    const f = fixture({ timeoutPaymentCreate: true });
    await connect(f);
    await result(await f.worker.fetch(request('POST'), env), 502);
    assert.equal(f.payments.length, 1);
    assert.equal(f.docs.get('_asaas_sandbox_checks/userA').fields.pendingCreate.stringValue, 'payment');
    const freshWorker = createWorker({ fetchGoogle: f.fetchGoogle, fetchAsaas: f.fetchAsaas });
    const recovered = await result(await freshWorker.fetch(request('POST'), env));
    assert.equal(recovered.ready, true);
    assert.equal(f.providerCalls.filter(([url, init]) => url.endsWith('/payments') && init.method === 'POST').length, 1);
});

test('criação de resultado desconhecido sem registro visível não é repetida automaticamente', async () => {
    const f = fixture({ unknownWithoutCreate: true });
    await connect(f);
    await result(await f.worker.fetch(request('POST'), env), 502);
    const uncertain = await result(await f.worker.fetch(request('POST'), env), 409);
    assert.equal(uncertain.code, 'sandbox_creation_unknown');
    assert.equal(f.providerCalls.filter(([url, init]) => url.endsWith('/payments') && init.method === 'POST').length, 1);
});

test('QR inválido mantém a cobrança existente para retomar sem gerar outra', async () => {
    const f = fixture({ invalidQr: true });
    await connect(f);
    const first = await result(await f.worker.fetch(request('POST'), env), 503);
    assert.equal(first.code, 'sandbox_qr_invalid');
    await result(await f.worker.fetch(request('POST'), env), 503);
    assert.equal(f.payments.length, 1);
    assert.equal((await result(await f.worker.fetch(request(), env))).ready, false);
});

test('não aceita instruções do navegador, origem externa, login inválido ou conta pendente', async () => {
    const f = fixture();
    await connect(f);
    const count = f.providerCalls.length;
    await result(await f.worker.fetch(request('POST', '/sandbox-charge', 'userA', { body: JSON.stringify({ amount: 100, uid: 'userB', paymentId: 'pay_other' }) }), env), 400);
    await result(await f.worker.fetch(request('POST', '/sandbox-charge', 'userA', { headers: { Origin: 'https://other.invalid' } }), env), 403);
    assert.equal(f.providerCalls.length, count);
    for (const opts of [{ invalidLogin: true }, { unapproved: true }]) {
        const g = fixture(opts);
        await result(await g.worker.fetch(request('POST'), env), opts.invalidLogin ? 401 : 403);
        assert.equal(g.providerCalls.length, 0);
    }
});

test('desativar ou remover integração interrompe os testes e ignora retornos antigos', async () => {
    const f = fixture();
    await prepare(f);
    const current = f.docs.get('_asaas_integrations/userA');
    current.fields.enabled.booleanValue = false;
    const count = f.providerCalls.length;
    await result(await f.worker.fetch(webhookRequest({ id: 'pay_test' }), env));
    await result(await f.worker.fetch(request('POST'), env), 409);
    assert.equal(f.providerCalls.length, count);
    f.docs.delete('_asaas_integrations/userA');
    await result(await f.worker.fetch(webhookRequest({ id: 'pay_test' }, 'evt_b'), env));
    assert.equal(f.providerCalls.length, count);
});

test('substituir chave impede acessar ou confirmar o teste da credencial anterior', async () => {
    const f = fixture();
    await prepare(f);
    await result(await f.worker.fetch(request('PUT', '', 'userA', { headers: { Origin: 'https://washingtonbarbalho.github.io', Authorization: request().headers.get('Authorization'), 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: 'replacement-sandbox-user-key' }) }), env));
    const count = f.providerCalls.length;
    assert.equal((await result(await f.worker.fetch(request(), env))).created, false);
    await result(await f.worker.fetch(webhookRequest({ id: 'pay_test' }), env));
    await result(await f.worker.fetch(request('POST', '/sandbox-charge/simulate'), env), 409);
    assert.equal(f.providerCalls.length, count);
});

test('conflito ao salvar Webhook pede nova entrega e não perde o aviso', async () => {
    const options = { webhookWriteConflict: false };
    const f = fixture(options);
    await prepare(f);
    f.payments[0].status = 'RECEIVED';
    options.webhookWriteConflict = true;
    await result(await f.worker.fetch(webhookRequest({ id: 'pay_test' }), env), 503);
    assert.equal((await result(await f.worker.fetch(request(), env))).testComplete, false);
    options.webhookWriteConflict = false;
    await result(await f.worker.fetch(webhookRequest({ id: 'pay_test' }), env));
    assert.equal((await result(await f.worker.fetch(request(), env))).testComplete, true);
});

test('erros e redirects do provedor não expõem chaves nem encaminham credenciais', async () => {
    for (const providerFailure of [302, 400, 401, 403, 500]) {
        const f = fixture({ providerFailure });
        await connect(f);
        await result(await f.worker.fetch(request('POST'), env), 502);
        assert.equal(f.payments.length, 0);
    }
});
