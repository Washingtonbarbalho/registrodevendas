import assert from 'node:assert/strict';
import test from 'node:test';
import { createAsaasProductionCheckClient } from '../integrations/asaas-production-check-client.js';
const status = { environment: 'production', diagnosticOnly: true, amountCents: 500, started: false, created: false, ready: false, status: 'NOT_CREATED', testComplete: false, webhookVerified: false, netCents: null, refundedCents: 0, payload: '', encodedImage: '', message: '' };
const reply = (body = status, code = 200) => new Response(JSON.stringify(body), { status: code });

test('cliente do teste real usa a rota dedicada e envia somente nome e CPF ao gerar', async () => {
    const calls = [];
    const client = createAsaasProductionCheckClient({ getIdToken: async () => 'token', fetcher: async (...args) => { calls.push(args); return reply({ ...status, apiKey: 'must-not-return', cpfCnpj: 'must-not-return' }); } });
    assert.deepEqual(await client.get(), status);
    await client.prepare({ payerName: 'PAGADOR TESTE', payerCpf: '52998224725', value: 999, uid: 'other' });
    await client.prepare(); await client.reconcile(); await client.cancel();
    assert.ok(calls.every(([url, options]) => url.startsWith('https://registro-vendas-pix-testes.washington-wn8.workers.dev/api/integrations/asaas-production/receipt-check') && options.headers.Authorization === 'Bearer token' && options.credentials === 'omit' && options.redirect === 'manual'));
    assert.deepEqual(JSON.parse(calls[1][1].body), { payerName: 'PAGADOR TESTE', payerCpf: '52998224725' });
    assert.equal(calls[2][1].body, undefined); assert.equal(calls[3][1].body, undefined); assert.equal(calls[4][1].body, undefined);
    assert.equal(client.simulate, undefined); assert.equal(client.refund, undefined);
});

test('recusa resposta de Sandbox, valor diferente, confirmação sem prova e imagens arbitrárias', async () => {
    for (const data of [{ ...status, environment: 'sandbox' }, { ...status, amountCents: 501 }, { ...status, diagnosticOnly: false }, { ...status, testComplete: true }, { ...status, netCents: 501 }]) {
        const client = createAsaasProductionCheckClient({ getIdToken: async () => 'token', fetcher: async () => reply(data) });
        await assert.rejects(client.get(), /não corresponde/);
    }
    const client = createAsaasProductionCheckClient({ getIdToken: async () => 'token', fetcher: async () => reply({ ...status, encodedImage: 'javascript:bad' }) });
    assert.equal((await client.get()).encodedImage, '');
});

test('Worker antigo é identificado e erro de transporte após POST não gera repetição automática', async () => {
    const old = createAsaasProductionCheckClient({ getIdToken: async () => 'token', fetcher: async () => reply({}, 404) });
    await assert.rejects(old.get(), /Atualize o Worker/);
    let calls = 0;
    const bad = createAsaasProductionCheckClient({ getIdToken: async () => 'token', fetcher: async () => { calls++; throw new Error('private-cpf-or-key'); } });
    await assert.rejects(bad.prepare({ payerName: 'TESTE', payerCpf: '52998224725' }), error => !error.message.includes('private') && /antes de repetir/.test(error.message));
    assert.equal(calls, 1);
});

test('sessão recusada pode ser atualizada uma vez e fechar a tela aborta a requisição', async () => {
    const refresh = []; let calls = 0;
    const client = createAsaasProductionCheckClient({ getIdToken: async force => { refresh.push(force); return 'token'; }, fetcher: async () => ++calls === 1 ? reply({}, 401) : reply() });
    await client.get(); assert.deepEqual(refresh, [false, true]);
    const controller = new AbortController();
    const waiting = createAsaasProductionCheckClient({ getIdToken: async () => 'token', fetcher: async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('private')))) });
    const call = waiting.get(controller.signal); await new Promise(resolve => setImmediate(resolve)); controller.abort(); await assert.rejects(call, /interrompida/);
});
