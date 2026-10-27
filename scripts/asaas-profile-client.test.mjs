import assert from 'node:assert/strict';
import test from 'node:test';
import { createAsaasProfileClient } from '../integrations/asaas-profile-client.js';

const status = { configured: true, enabled: true, environment: 'sandbox', hasActivePixKey: true, checkedAt: '2026-10-27T12:00:00Z' };
const reply = (body = status, statusCode = 200) => new Response(JSON.stringify(body), { status: statusCode, headers: { 'Content-Type': 'application/json' } });

test('cliente usa ID token por HTTPS e devolve apenas os metadados esperados', async () => {
    const calls = [];
    const client = createAsaasProfileClient({ getIdToken: async () => 'private-id-token', fetcher: async (...args) => { calls.push(args); return reply({ ...status, cipher: 'private-cipher', iv: 'private-iv', apiKey: 'private-api-key' }); } });
    const result = await client.getStatus();
    assert.deepEqual(result, { ...status, message: '' });
    assert.equal(calls[0][0], 'https://registro-vendas-pix-testes.washington-wn8.workers.dev/api/integrations/asaas');
    assert.equal(calls[0][1].headers.Authorization, 'Bearer private-id-token');
    assert.equal(calls[0][1].credentials, 'omit');
    assert.equal(calls[0][1].redirect, 'manual');
    assert.equal(calls[0][1].body, undefined);
    assert.ok(!JSON.stringify(result).includes('private-'));
});

test('salvar envia só chave e modo; testar a chave salva e remover não reenviam o segredo', async () => {
    const calls = [];
    const client = createAsaasProfileClient({ getIdToken: async () => 'id-token', fetcher: async (...args) => { calls.push(args); return reply(); } });
    await client.save({ enabled: true, apiKey: 'sandbox-key-only-for-client-tests', uid: 'another-user' });
    await client.testSavedKey();
    await client.remove();
    assert.deepEqual(JSON.parse(calls[0][1].body), { enabled: true, apiKey: 'sandbox-key-only-for-client-tests' });
    assert.deepEqual(calls.map(([, init]) => init.method), ['PUT', 'POST', 'DELETE']);
    assert.equal(calls[1][0].endsWith('/asaas/test'), true);
    assert.equal(calls[1][1].body, undefined);
    assert.equal(calls[2][1].body, undefined);
});

test('sessão recusada atualiza ID token uma vez e repete a chamada no mesmo destino', async () => {
    const refreshes = [];
    const calls = [];
    const client = createAsaasProfileClient({ getIdToken: async force => { refreshes.push(force); return force ? 'fresh-token' : 'old-token'; }, fetcher: async (...args) => { calls.push(args); return calls.length === 1 ? reply({ message: 'Entre novamente.' }, 401) : reply(); } });
    await client.getStatus();
    assert.deepEqual(refreshes, [false, true]);
    assert.equal(calls[0][0], calls[1][0]);
    assert.equal(calls[1][1].headers.Authorization, 'Bearer fresh-token');
});

test('erros de transporte e autenticação não exibem detalhes potencialmente privados', async () => {
    for (const failure of ['network', 'login']) {
        const secret = 'private-sensitive-value-must-not-be-shown';
        const client = createAsaasProfileClient({ getIdToken: async () => { if (failure === 'login') throw new Error(secret); return 'id-token'; }, fetcher: async () => { throw new Error(secret); } });
        await assert.rejects(client.getStatus(), error => !error.message.includes(secret) && /conectar|Entre novamente/.test(error.message));
    }
});

test('recusa resposta malformada ou ambiente de Produção no fluxo de testes', async () => {
    for (const response of [reply({ ...status, environment: 'production' }), reply({ configured: 'yes' }), new Response('not-json')]) {
        const client = createAsaasProfileClient({ getIdToken: async () => 'token', fetcher: async () => response });
        await assert.rejects(client.getStatus(), /conferir|indisponível/);
    }
});

test('cancelamento ao fechar o perfil interrompe a chamada e não deixa timer pendente', async () => {
    const controller = new AbortController();
    const client = createAsaasProfileClient({ getIdToken: async () => 'token', fetcher: async (_url, init) => new Promise((_resolve, reject) => { init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true }); }) });
    const pending = client.getStatus(controller.signal);
    await new Promise(resolve => setImmediate(resolve));
    controller.abort();
    await assert.rejects(pending, /interrompida/);
});
