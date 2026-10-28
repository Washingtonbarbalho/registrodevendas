import assert from 'node:assert/strict';
import test from 'node:test';
import { productionFixture, env, key, request, result, origin, idToken } from './production-fixture.mjs';
const privatePath = uid => '_asaas_production_integrations/' + uid;
async function save(f, uid = 'userA') { return result(await f.worker.fetch(request('PUT', { apiKey: key }, '', uid), env)); }

test('Produção consulta apenas o endereço fixo, salva cifra privada e mantém os recebimentos desativados', async () => {
    const f = productionFixture();
    const data = await save(f);
    assert.equal(data.environment, 'production');
    assert.equal(data.configured, true);
    assert.equal(data.receivingEnabled, false);
    assert.equal(data.connectionVersion, 1);
    assert.equal(data.hasActivePixKey, true);
    assert.match(data.message, /aguardam ativação/);
    const saved = f.store.get(privatePath('userA'));
    assert.equal(saved.fields.enabled.booleanValue, false);
    assert.equal(saved.fields.environment.stringValue, 'production');
    assert.ok(!JSON.stringify(saved).includes(key));
    const aes = await crypto.subtle.importKey('raw', Buffer.from(env.PIX_ENCRYPTION_KEY, 'hex'), 'AES-GCM', false, ['decrypt']);
    const params = { name: 'AES-GCM', iv: Buffer.from(saved.fields.iv.stringValue, 'base64url'), additionalData: new TextEncoder().encode('vendas-aura:asaas:production:v1:userA') };
    const plain = await crypto.subtle.decrypt(params, aes, Buffer.from(saved.fields.cipher.stringValue, 'base64url'));
    assert.equal(new TextDecoder().decode(plain), key);
    await assert.rejects(crypto.subtle.decrypt({ ...params, additionalData: new TextEncoder().encode('vendas-aura:asaas:sandbox:v1:userA') }, aes, Buffer.from(saved.fields.cipher.stringValue, 'base64url')));
    const fresh = productionFixture({ store: f.store });
    assert.equal((await result(await fresh.worker.fetch(request('POST', undefined, '/test'), env))).configured, true);
    assert.equal(fresh.providerCalls.length, 1);
    assert.ok(f.googleCalls.every(([url, init]) => !url.includes('apiKey') && !JSON.stringify(init).includes(key)));
});

test('consulta de estado não acessa Asaas e dados de outro usuário permanecem isolados', async () => {
    const f = productionFixture();
    assert.equal((await result(await f.worker.fetch(request(), env))).configured, false);
    assert.equal(f.providerCalls.length, 0);
    await save(f);
    assert.equal((await result(await f.worker.fetch(request(), env))).configured, true);
    assert.equal((await result(await f.worker.fetch(request('GET', undefined, '', 'userB'), env))).configured, false);
    assert.equal(f.providerCalls.length, 1);
    assert.equal(f.store.size, 1);
});

test('a cópia da cifra para outro UID ou ambiente é recusada', async () => {
    const f = productionFixture();
    await save(f);
    const saved = f.store.get(privatePath('userA'));
    f.store.set(privatePath('userB'), { ...structuredClone(saved), name: saved.name.replace(/userA$/, 'userB') });
    assert.equal((await f.worker.fetch(request('POST', undefined, '/test', 'userB'), env)).status, 503);
    saved.fields.environment.stringValue = 'sandbox';
    await result(await f.worker.fetch(request(), env), 503);
    assert.equal(f.providerCalls.length, 1);
});

test('Sandbox é preservado ao salvar, conferir e remover a chave real', async () => {
    const sandbox = { fields: { cipher: { stringValue: 'sandbox-cipher-must-stay' }, enabled: { booleanValue: true } } };
    const f = productionFixture({ store: new Map([['_asaas_integrations/userA', sandbox]]) });
    await save(f);
    await result(await f.worker.fetch(request('POST', undefined, '/test'), env));
    await result(await f.worker.fetch(request('DELETE'), env));
    assert.deepEqual(f.store.get('_asaas_integrations/userA'), sandbox);
    assert.equal(f.store.size, 1);
});

test('preflight e roteamento recusam origens, métodos, ativações e operações financeiras', async () => {
    const f = productionFixture();
    const preflight = await f.worker.fetch(request('OPTIONS', undefined, '', 'userA', { headers: { Origin: origin, 'Access-Control-Request-Method': 'PUT' } }), env);
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'), null);
    for (const other of [null, 'null', 'https://other.invalid']) {
        const response = await f.worker.fetch(request('GET', undefined, '', 'userA', { headers: { ...(other ? { Origin: other } : {}), Authorization: 'Bearer ' + idToken() } }), env);
        assert.equal(response.status, 403);
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    }
    for (const suffix of ['/charges', '/sandbox/payment/x/confirm', '/webhooks', '/enable']) await result(await f.worker.fetch(request('POST', undefined, suffix), env), 404);
    await result(await f.worker.fetch(request('POST'), env), 405);
    for (const body of [{ apiKey: key, enabled: true }, { apiKey: key, uid: 'userB' }, { apiKey: key, environment: 'sandbox' }, { apiKey: key, baseUrl: 'https://attacker.invalid' }]) await result(await f.worker.fetch(request('PUT', body), env), 400);
    assert.equal(f.providerCalls.length, 0);
    assert.equal(f.store.size, 0);
});

test('identidade é validada pelo Google e perfis sem aprovação não podem conectar', async () => {
    for (const options of [{ invalidLogin: true }, { disabled: true }, { revoked: true }, { unapproved: true }, { profileStatus: 'blocked' }]) {
        const f = productionFixture(options);
        await result(await f.worker.fetch(request('PUT', { apiKey: key }), env), options.unapproved || options.profileStatus ? 403 : 401);
        assert.equal(f.providerCalls.length, 0);
        assert.equal(f.store.size, 0);
    }
    const f = productionFixture();
    const parts = idToken().split('.');
    parts[1] = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(parts[1], 'base64url')), sub: 'userB' })).toString('base64url');
    await result(await f.worker.fetch(request('GET', undefined, '', 'userA', { headers: { Origin: origin, Authorization: 'Bearer ' + parts.join('.') } }), env), 401);
    assert.equal(f.providerCalls.length, 0);
});

test('validação de corpo recusa chave inválida, corpo extra e excesso de tamanho', async () => {
    const f = productionFixture();
    for (const body of [{}, { apiKey: '' }, { apiKey: 'short' }, { apiKey: 'abc\nprivate' }, { apiKey: 'x'.repeat(5000) }]) {
        const response = await f.worker.fetch(request('PUT', body), env);
        assert.ok([400, 413].includes(response.status));
        await result(response, response.status);
    }
    await result(await f.worker.fetch(request('POST', { uid: 'userB' }, '/test'), env), 400);
    await result(await f.worker.fetch(request('DELETE', { enabled: true }), env), 400);
    assert.equal(f.store.size, 0);
    assert.equal(f.providerCalls.length, 0);
});

test('erros e redirecionamentos do provedor não expõem chaves nem salvam credenciais', async () => {
    for (const options of [{ providerFailure: 302 }, { providerFailure: 401 }, { providerFailure: 403 }, { providerFailure: 429 }, { providerThrows: true }, { invalidProviderJson: true }, { invalidProviderShape: true }]) {
        const f = productionFixture(options);
        const response = await f.worker.fetch(request('PUT', { apiKey: key }), env);
        assert.ok([502, 503].includes(response.status));
        await result(response, response.status);
        assert.equal(f.store.size, 0);
    }
});

test('a ausência de chave Pix ativa é informada sem ativar recebimentos', async () => {
    const f = productionFixture({ noPix: true });
    const data = await save(f);
    assert.equal(data.hasActivePixKey, false);
    assert.equal(data.receivingEnabled, false);
    assert.match(data.message, /Falta cadastrar ou ativar/);
});

test('falhas de gravação e disputas mantêm a configuração anterior', async () => {
    const f = productionFixture();
    await save(f);
    const before = structuredClone([...f.store]);
    for (const options of [{ conflict: true }, { writeFailure: true }]) {
        const other = productionFixture({ ...options, store: f.store });
        await result(await other.worker.fetch(request('PUT', { apiKey: key }), env), options.conflict ? 409 : 503);
        assert.deepEqual([...f.store], before);
        await result(await other.worker.fetch(request('DELETE'), env), options.conflict ? 409 : 503);
        assert.deepEqual([...f.store], before);
    }
    const bad = productionFixture({ badWriteResponse: true });
    await result(await bad.worker.fetch(request('PUT', { apiKey: key }), env), 503);
});

test('chave mestra alterada impede uso e pendências impedem substituição ou remoção', async () => {
    const f = productionFixture();
    await save(f);
    await result(await f.worker.fetch(request('POST', undefined, '/test'), { ...env, PIX_ENCRYPTION_KEY: 'ff'.repeat(32) }), 503);
    f.store.get(privatePath('userA')).fields.pendingCharges = { integerValue: '1' };
    await result(await f.worker.fetch(request('DELETE'), env), 409);
    await result(await f.worker.fetch(request('PUT', { apiKey: key }), env), 409);
    assert.equal(f.providerCalls.length, 1);
});
