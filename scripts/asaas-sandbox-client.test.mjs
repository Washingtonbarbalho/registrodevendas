import assert from 'node:assert/strict';
import test from 'node:test';
import { createAsaasSandboxClient } from '../integrations/asaas-sandbox-client.js';

const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
const status = { environment: 'sandbox', created: true, ready: true, status: 'PENDING', webhookVerified: false, amount: 5, encodedImage: '', payload: '000201', message: 'Cobrança preparada.' };

test('cliente chama somente rotas fixas com ID token; ignora dados sensíveis na resposta', async () => {
    const calls = [];
    const client = createAsaasSandboxClient({ getIdToken: async () => 'login-token', fetcher: async (url, init) => { calls.push([url, init]); return reply({ ...status, apiKey: 'do-not-return', authToken: 'do-not-return', uid: 'other', testComplete: true, received: true }); } });
    const data = await client.getStatus();
    await client.prepare();
    await client.simulate();
    assert.deepEqual(calls.map(([url, init]) => [new URL(url).pathname, init.method]), [['/api/integrations/asaas/sandbox-charge', 'GET'], ['/api/integrations/asaas/sandbox-charge', 'POST'], ['/api/integrations/asaas/sandbox-charge/simulate', 'POST']]);
    for (const [, init] of calls) {
        assert.equal(init.headers.Authorization, 'Bearer login-token');
        assert.equal(init.body, undefined);
        assert.equal(init.redirect, 'manual');
        assert.equal(init.credentials, 'omit');
        assert.equal(init.cache, 'no-store');
    }
    assert.equal(data.testComplete, false);
    assert.equal(data.received, false);
    assert.equal(data.apiKey, undefined);
    assert.equal(data.authToken, undefined);
});

test('conclusão exige RECEIVED e retorno validado, não basta CONFIRMED ou flag enviada', async () => {
    for (const [providerStatus, webhookVerified, expected] of [['CONFIRMED', true, false], ['RECEIVED', false, false], ['RECEIVED', true, true], ['REFUNDED', true, false]]) {
        const client = createAsaasSandboxClient({ getIdToken: async () => 'token', fetcher: async () => reply({ ...status, status: providerStatus, webhookVerified, testComplete: true }) });
        assert.equal((await client.getStatus()).testComplete, expected);
    }
});

test('renova login uma vez em 401 e não repete ação após falha de rede', async () => {
    const refreshes = [];
    let calls = 0;
    const client = createAsaasSandboxClient({ getIdToken: async force => { refreshes.push(force); return 'token'; }, fetcher: async () => ++calls === 1 ? reply({}, 401) : reply(status) });
    await client.prepare();
    assert.deepEqual(refreshes, [false, true]);
    let networkCalls = 0;
    const failure = createAsaasSandboxClient({ getIdToken: async () => 'token', fetcher: async () => { networkCalls++; throw new Error('secret-upstream'); } });
    await assert.rejects(failure.prepare(), error => !error.message.includes('secret-upstream') && /conferir o andamento/.test(error.message));
    assert.equal(networkCalls, 1);
});

test('Worker antigo orienta atualização e nunca apresenta QR de formato inseguro', async () => {
    const old = createAsaasSandboxClient({ getIdToken: async () => 'token', fetcher: async () => reply({}, 404) });
    await assert.rejects(old.getStatus(), /Atualize o código do Worker/);
    const malformed = createAsaasSandboxClient({ getIdToken: async () => 'token', fetcher: async () => reply({ ...status, encodedImage: 'data:image/svg+xml,<script>bad</script>' }) });
    assert.equal((await malformed.getStatus()).encodedImage, '');
    const prod = createAsaasSandboxClient({ getIdToken: async () => 'token', fetcher: async () => reply({ ...status, environment: 'production' }) });
    await assert.rejects(prod.getStatus(), /inesperado/);
});
