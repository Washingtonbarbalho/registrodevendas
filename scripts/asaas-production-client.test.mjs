import assert from 'node:assert/strict';
import test from 'node:test';
import { createAsaasProductionClient } from '../integrations/asaas-production-client.js';
const status = { configured: true, environment: 'production', connectionVersion: 1, receivingEnabled: false, hasActivePixKey: true, checkedAt: '2026-10-27T12:00:00Z', message: '' };
const reply = (value = status, code = 200) => new Response(JSON.stringify(value), { status: code });

test('cliente real envia apenas a chave ao caminho separado e descarta campos privados da resposta', async () => {
    const calls = [];
    const client = createAsaasProductionClient({ getIdToken: async () => 'token', fetcher: async (...args) => { calls.push(args); return reply({ ...status, cipher: 'private-cipher', apiKey: 'private-key', iv: 'private-iv' }); } });
    assert.deepEqual(await client.getStatus(), status);
    await client.save(' real-key-only-for-tests ');
    await client.testSavedKey();
    await client.remove();
    assert.ok(calls.every(([url, options]) => url.startsWith('https://registro-vendas-pix-testes.washington-wn8.workers.dev/api/integrations/asaas-production') && options.headers.Authorization === 'Bearer token' && options.credentials === 'omit' && options.cache === 'no-store' && options.redirect === 'manual'));
    assert.deepEqual(calls.map(([, options]) => options.method), ['GET', 'PUT', 'POST', 'DELETE']);
    assert.deepEqual(JSON.parse(calls[1][1].body), { apiKey: 'real-key-only-for-tests' });
    assert.equal(calls[2][1].body, undefined);
    assert.equal(calls[3][1].body, undefined);
});

test('cliente recusa Sandbox, respostas antigas e recebimento real ativado por outra versão', async () => {
    for (const data of [{ ...status, environment: 'sandbox' }, { ...status, connectionVersion: 0 }, { ...status, receivingEnabled: true }, { configured: true }]) {
        const client = createAsaasProductionClient({ getIdToken: async () => 'token', fetcher: async () => reply(data) });
        await assert.rejects(client.getStatus(), /resposta da conexão/);
    }
});

test('atualiza a identidade uma vez e identifica Worker antigo sem repetir erros de rede', async () => {
    const refreshed = [];
    let calls = 0;
    const client = createAsaasProductionClient({ getIdToken: async force => { refreshed.push(force); return 'token'; }, fetcher: async () => ++calls === 1 ? reply({}, 401) : reply() });
    await client.getStatus();
    assert.deepEqual(refreshed, [false, true]);
    const old = createAsaasProductionClient({ getIdToken: async () => 'token', fetcher: async () => reply({}, 404) });
    await assert.rejects(old.getStatus(), /Atualize o Worker/);
    let attempts = 0;
    const failed = createAsaasProductionClient({ getIdToken: async () => 'token', fetcher: async () => { attempts++; throw new Error('private-key-do-not-display'); } });
    await assert.rejects(failed.save('test-key'), error => !error.message.includes('private-key'));
    assert.equal(attempts, 1);
});

test('fechar a tela interrompe a consulta e erros de autenticação não expõem detalhes', async () => {
    const controller = new AbortController();
    const client = createAsaasProductionClient({ getIdToken: async () => 'token', fetcher: async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('secret')))) });
    const call = client.getStatus(controller.signal);
    await new Promise(resolve => setImmediate(resolve));
    controller.abort();
    await assert.rejects(call, /interrompida/);
    const auth = createAsaasProductionClient({ getIdToken: async () => { throw new Error('secret'); } });
    await assert.rejects(auth.getStatus(), /Entre novamente/);
});
