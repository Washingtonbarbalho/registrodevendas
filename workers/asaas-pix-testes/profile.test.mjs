import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { createWorker } from './worker.js';

const pair = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const serviceAccount = { type: 'service_account', project_id: 'vendas-aura', client_email: 'profile-fixture@vendas-aura.iam.gserviceaccount.com', private_key: pair.privateKey };
const env = { FIREBASE_SERVICE_ACCOUNT: JSON.stringify(serviceAccount), PIX_ENCRYPTION_KEY: '0a'.repeat(32), SETUP_TOKEN: '0b'.repeat(32), ASAAS_API_KEY: 'global-key-must-not-be-used-for-users' };
const origin = 'https://washingtonbarbalho.github.io';
const workerOrigin = 'https://worker.test';
const apiPath = '/api/integrations/asaas';
const googleToken = 'google-access-token-only-for-profile-tests';
const apiA = 'sandbox-api-key-user-a-only-for-tests';
const apiB = 'sandbox-api-key-user-b-only-for-tests';
let clock = 0;
const version = () => '2026-10-27T12:00:00.' + String(++clock).padStart(6, '0') + 'Z';
const resource = path => 'projects/vendas-aura/databases/(default)/documents/' + path;
const upstream = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function idToken(uid, changes = {}) {
  const now = Math.floor(Date.now() / 1000);
  const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');
  const unsigned = encode({ alg: 'RS256', typ: 'JWT', kid: 'fixture-key' }) + '.' + encode({ sub: uid, aud: 'vendas-aura', iss: 'https://securetoken.google.com/vendas-aura', iat: now - 60, auth_time: now - 60, exp: now + 3500, ...changes });
  return unsigned + '.' + sign('RSA-SHA256', Buffer.from(unsigned), pair.privateKey).toString('base64url');
}
function request(uid = 'userA', method = 'GET', body, suffix = '', options = {}) {
  return new Request(workerOrigin + apiPath + suffix, { method, headers: { Origin: origin, Authorization: 'Bearer ' + idToken(uid), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...options });
}
function fixture(options = {}) {
  const store = options.store || new Map();
  const googleCalls = [];
  const asaasCalls = [];
  const fetchGoogle = async (input, init) => {
    googleCalls.push([String(input), init]);
    const url = new URL(input);
    if (url.hostname === 'identitytoolkit.googleapis.com') {
      if (options.lookupFailure) return upstream({ error: { message: apiA + googleToken } }, options.lookupFailure);
      const token = JSON.parse(init.body).idToken;
      const parts = token.split('.');
      if (!verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), pair.publicKey, Buffer.from(parts[2], 'base64url'))) return upstream({ error: { message: 'INVALID_ID_TOKEN' } }, 400);
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url'));
      return upstream({ users: [{ localId: claims.sub, disabled: !!options.disabled, validSince: options.revoked ? String(claims.auth_time + 1) : '0' }] });
    }
    if (String(input) === 'https://oauth2.googleapis.com/token') return upstream({ access_token: googleToken });
    assert.equal(url.origin, 'https://firestore.googleapis.com');
    assert.equal(init.headers.Authorization, 'Bearer ' + googleToken);
    assert.equal(init.redirect, 'manual');
    const path = url.pathname.split('/documents/')[1];
    const profile = /^artifacts\/vendas-aura-main\/users\/([A-Za-z0-9_-]+)\/profile\/info$/.exec(path);
    if (profile) return upstream({ name: resource(path), fields: { approved: { booleanValue: options.approved !== false }, status: { stringValue: options.status || 'active' } }, updateTime: version() });
    const match = /^_asaas_integrations\/([A-Za-z0-9_-]+)$/.exec(path);
    assert.ok(match, 'Não pode acessar vendas, perfis de outros namespaces ou caminhos vindos do cliente.');
    const uid = match[1];
    const current = store.get(uid);
    if (init.method === 'GET') return current ? upstream(structuredClone(current)) : upstream({}, 404);
    if (options.conflict) return upstream({ error: { message: apiA } }, 412);
    if (current && url.searchParams.get('currentDocument.updateTime') !== current.updateTime) return upstream({}, 412);
    if (!current && url.searchParams.get('currentDocument.exists') !== 'false') return upstream({}, 412);
    if (init.method === 'DELETE') { store.delete(uid); return upstream({}); }
    assert.equal(init.method, 'PATCH');
    if (options.saveFailure) return upstream({ error: { message: apiA } }, options.saveFailure);
    const fields = JSON.parse(init.body).fields;
    assert.deepEqual(url.searchParams.getAll('updateMask.fieldPaths').sort(), Object.keys(fields).sort());
    const next = { name: resource(path), fields: { ...(current?.fields || {}), ...fields }, updateTime: version() };
    store.set(uid, next);
    return upstream(structuredClone(next));
  };
  const fetchAsaas = async (input, init) => {
    asaasCalls.push([String(input), init]);
    assert.equal(String(input), 'https://api-sandbox.asaas.com/v3/pix/addressKeys?status=ACTIVE&limit=1');
    assert.equal(init.method, 'GET');
    assert.equal(init.body, undefined);
    assert.equal(init.redirect, 'manual');
    assert.notEqual(init.headers.access_token, env.ASAAS_API_KEY);
    if (options.asaasFailure || ![apiA, apiB].includes(init.headers.access_token)) return upstream({ private: init.headers.access_token }, options.asaasFailure || 401);
    return upstream({ data: options.noPix ? [] : [{ status: 'ACTIVE', key: 'private-pix-key-must-not-leak' }] });
  };
  return { worker: createWorker({ fetchGoogle, fetchAsaas }), store, googleCalls, asaasCalls, fetchGoogle, fetchAsaas };
}
async function privateResult(response) {
  const body = await response.text();
  for (const secret of [apiA, apiB, googleToken, pair.privateKey, env.PIX_ENCRYPTION_KEY, env.SETUP_TOKEN, 'private-pix-key-must-not-leak']) assert.ok(!body.includes(secret), 'Não pode devolver segredos ou dados da conta.');
  assert.doesNotMatch(body, /"(?:cipher|iv|private_key|apiKey)"\s*:/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  return JSON.parse(body);
}

test('proteção exige SETUP_TOKEN e valida AES-GCM sem acessar provedores ou revelar a chave', async () => {
  const { worker, googleCalls, asaasCalls } = fixture();
  const setup = token => new Request(workerOrigin + '/api/setup/encryption-check', { method: 'POST', headers: { Origin: workerOrigin, 'X-Setup-Token': token } });
  assert.equal((await worker.fetch(setup('bad'), env)).status, 401);
  for (const key of [undefined, '', 'short', 'z'.repeat(64)]) assert.equal((await worker.fetch(setup(env.SETUP_TOKEN), { ...env, PIX_ENCRYPTION_KEY: key })).status, 503);
  const response = await worker.fetch(setup(env.SETUP_TOKEN), env);
  assert.equal(response.status, 200);
  assert.equal((await privateResult(response)).encryptionReady, true);
  assert.equal(googleCalls.length + asaasCalls.length, 0);
});

test('preflight permite somente origem e métodos conhecidos, sem consultar provedores', async () => {
  const { worker, googleCalls } = fixture();
  const response = await worker.fetch(request('userA', 'OPTIONS', undefined, '', { headers: { Origin: origin, 'Access-Control-Request-Method': 'PUT' } }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
  assert.ok(response.headers.get('Access-Control-Allow-Headers').includes('Authorization'));
  assert.equal((await worker.fetch(request('userA', 'OPTIONS', undefined, '', { headers: { Origin: origin, 'Access-Control-Request-Method': 'TRACE' } }), env)).status, 405);
  assert.equal((await worker.fetch(request('userA', 'GET', undefined, '/unknown'), env)).status, 404);
  assert.equal(googleCalls.length, 0);
});

test('recusa outras origens, SETUP_TOKEN no lugar de login e claims inválidos antes de acessar credenciais', async () => {
  const { worker, googleCalls } = fixture();
  for (const otherOrigin of [null, 'null', 'https://other.invalid']) {
    const response = await worker.fetch(request('userA', 'GET', undefined, '', { headers: { ...(otherOrigin === null ? {} : { Origin: otherOrigin }), Authorization: 'Bearer ' + idToken('userA') } }), env);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  for (const token of [env.SETUP_TOKEN, 'invalid', idToken('userA', { exp: 1 }), idToken('userA', { aud: 'other-project' }), idToken('userA', { iss: 'https://attacker.invalid' }), idToken('../userB')]) {
    const response = await worker.fetch(request('userA', 'GET', undefined, '', { headers: { Origin: origin, Authorization: 'Bearer ' + token } }), env);
    assert.equal(response.status, 401);
    await privateResult(response);
  }
  assert.equal(googleCalls.length, 0);
});

test('não confia em JWT apenas decodificado: Google deve aceitar a assinatura', async () => {
  const { worker, googleCalls } = fixture();
  const parts = idToken('userA').split('.');
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url'));
  parts[1] = Buffer.from(JSON.stringify({ ...claims, sub: 'userB' })).toString('base64url');
  const response = await worker.fetch(request('userA', 'GET', undefined, '', { headers: { Origin: origin, Authorization: 'Bearer ' + parts.join('.') } }), env);
  assert.equal(response.status, 401);
  assert.equal(googleCalls.length, 1);
  await privateResult(response);
});

test('usuário desabilitado, token revogado e perfil pendente, bloqueado ou excluído não podem configurar', async () => {
  for (const options of [{ disabled: true }, { revoked: true }, { approved: false }, { status: 'pending' }, { status: 'blocked' }, { status: 'deleted' }]) {
    const { worker, store, asaasCalls } = fixture(options);
    const response = await worker.fetch(request('userA', 'PUT', { apiKey: apiA, enabled: true }), env);
    assert.equal(response.status, options.disabled || options.revoked ? 401 : 403);
    assert.equal(store.size, 0);
    assert.equal(asaasCalls.length, 0);
    await privateResult(response);
  }
});

test('salva somente cifra AES-GCM privada e consegue recuperar a chave depois em nova instância', async () => {
  const { worker, store, googleCalls } = fixture();
  const response = await worker.fetch(request('userA', 'PUT', { apiKey: apiA, enabled: true }), env);
  assert.equal(response.status, 200);
  const result = await privateResult(response);
  assert.equal(result.configured, true);
  assert.equal(result.enabled, true);
  assert.equal(result.hasActivePixKey, true);
  const saved = store.get('userA');
  assert.ok(saved.fields.cipher.stringValue);
  assert.ok(!JSON.stringify(saved).includes(apiA));
  assert.equal(store.size, 1);
  const rawMaster = Uint8Array.from(env.PIX_ENCRYPTION_KEY.match(/../g), byte => parseInt(byte, 16));
  const aes = await crypto.subtle.importKey('raw', rawMaster, 'AES-GCM', false, ['decrypt']);
  const decoded = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(saved.fields.iv.stringValue, 'base64url'), additionalData: new TextEncoder().encode('vendas-aura:asaas:sandbox:v1:userA') }, aes, Buffer.from(saved.fields.cipher.stringValue, 'base64url'));
  assert.equal(new TextDecoder().decode(decoded), apiA);
  assert.ok(googleCalls.filter(([url]) => url.startsWith('https://firestore')).every(([url, init]) => !url.includes('/profile/info?') && !JSON.stringify(init).includes(apiA)));
  const fresh = fixture({ store });
  const tested = await fresh.worker.fetch(request('userA', 'POST', undefined, '/test'), { ...env, ASAAS_API_KEY: 'different-global-key' });
  assert.equal(tested.status, 200);
  await privateResult(tested);
  assert.equal(fresh.asaasCalls[0][1].headers.access_token, apiA);
  const read = await fresh.worker.fetch(request(), env);
  assert.equal((await privateResult(read)).configured, true);
});

test('contas A e B têm documentos separados; IDs enviados pelo cliente não mudam o dono', async () => {
  const f = fixture();
  await f.worker.fetch(request('userA', 'PUT', { apiKey: apiA }), env);
  await f.worker.fetch(request('userB', 'PUT', { apiKey: apiB }), env);
  assert.deepEqual([...f.store.keys()].sort(), ['userA', 'userB']);
  const bBefore = structuredClone(f.store.get('userB'));
  assert.equal((await f.worker.fetch(request('userA', 'PUT', { apiKey: apiA, uid: 'userB' }), env)).status, 400);
  const aRead = await f.worker.fetch(new Request(workerOrigin + apiPath + '?uid=userB', { headers: { Origin: origin, Authorization: 'Bearer ' + idToken('userA') } }), env);
  assert.equal((await privateResult(aRead)).configured, true);
  const deletion = await f.worker.fetch(request('userA', 'DELETE'), env);
  assert.equal((await privateResult(deletion)).configured, false);
  assert.equal(f.store.has('userA'), false);
  assert.deepEqual(f.store.get('userB'), bBefore);
});

test('AAD impede trocar cifra entre usuários e a chave mestra errada não abre integração salva', async () => {
  const f = fixture();
  await f.worker.fetch(request('userA', 'PUT', { apiKey: apiA }), env);
  const a = f.store.get('userA');
  f.store.set('userB', { ...structuredClone(a), name: resource('_asaas_integrations/userB') });
  const callsBefore = f.asaasCalls.length;
  const swapped = await f.worker.fetch(request('userB', 'POST', undefined, '/test'), env);
  assert.equal(swapped.status, 503);
  assert.equal((await privateResult(swapped)).code, 'integration_key_unreadable');
  const wrongMaster = await f.worker.fetch(request('userA'), { ...env, PIX_ENCRYPTION_KEY: '0c'.repeat(32) });
  assert.equal(wrongMaster.status, 503);
  assert.equal(f.asaasCalls.length, callsBefore);
});

test('rejeição do Asaas preserva a chave anterior e nunca acessa Produção', async () => {
  const f = fixture();
  await f.worker.fetch(request('userA', 'PUT', { apiKey: apiA }), env);
  const before = structuredClone(f.store.get('userA'));
  const rejected = await f.worker.fetch(request('userA', 'PUT', { apiKey: 'invalid-user-key' }), { ...env, ASAAS_BASE_URL: 'https://api.asaas.com/v3' });
  assert.equal(rejected.status, 502);
  await privateResult(rejected);
  assert.deepEqual(f.store.get('userA'), before);
  const production = await f.worker.fetch(request('userA', 'PUT', { apiKey: apiA, environment: 'production' }), env);
  assert.equal(production.status, 400);
  assert.ok(f.asaasCalls.every(([url]) => url.startsWith('https://api-sandbox.asaas.com/v3/')));
});

test('desativar mantém a cifra, reativar testa a chave salva e substituir usa IV novo', async () => {
  const f = fixture();
  await f.worker.fetch(request('userA', 'PUT', { apiKey: apiA }), env);
  const original = structuredClone(f.store.get('userA'));
  const callsBefore = f.asaasCalls.length;
  const disabled = await f.worker.fetch(request('userA', 'PUT', { enabled: false }), env);
  assert.equal((await privateResult(disabled)).enabled, false);
  assert.equal(f.asaasCalls.length, callsBefore);
  assert.equal(f.store.get('userA').fields.cipher.stringValue, original.fields.cipher.stringValue);
  const enabled = await f.worker.fetch(request('userA', 'PUT', { enabled: true }), env);
  assert.equal((await privateResult(enabled)).enabled, true);
  assert.equal(f.asaasCalls.at(-1)[1].headers.access_token, apiA);
  assert.notEqual(f.store.get('userA').fields.iv.stringValue, original.fields.iv.stringValue);
});

test('sem chave Pix ativa informa pendência e conflito de versão não sobrescreve a configuração', async () => {
  const f = fixture({ noPix: true });
  const response = await f.worker.fetch(request('userA', 'PUT', { apiKey: apiA }), env);
  const result = await privateResult(response);
  assert.equal(result.configured, true);
  assert.equal(result.hasActivePixKey, false);
  assert.match(result.message, /Falta cadastrar/);
  const before = structuredClone(f.store.get('userA'));
  const conflict = fixture({ store: f.store, conflict: true });
  const failed = await conflict.worker.fetch(request('userA', 'PUT', { apiKey: apiB }), env);
  assert.equal(failed.status, 409);
  assert.deepEqual(f.store.get('userA'), before);
});

test('valida tamanho, formato e campos da entrada e não envia chaves inválidas ao Asaas', async () => {
  const f = fixture();
  for (const body of [{}, [], null, { apiKey: 'short' }, { apiKey: 'bad\nheader' }, { apiKey: apiA, enabled: 'yes' }, { apiKey: apiA, cipher: 'attacker-cipher' }]) {
    const response = await f.worker.fetch(request('userA', 'PUT', body), env);
    assert.equal(response.status, 400);
  }
  const tooLarge = await f.worker.fetch(request('userA', 'PUT', { apiKey: 'x'.repeat(5000) }), env);
  assert.equal(tooLarge.status, 413);
  const noJson = await f.worker.fetch(request('userA', 'PUT', { apiKey: apiA }, '', { headers: { Origin: origin, Authorization: 'Bearer ' + idToken('userA'), 'Content-Type': 'text/plain' } }), env);
  assert.equal(noJson.status, 400);
  assert.equal(f.asaasCalls.length, 0);
  assert.equal(f.store.size, 0);
});

test('erros de provedor, restrição de API e redirecionamentos não expõem dados privados', async () => {
  for (const options of [{ lookupFailure: 403 }, { lookupFailure: 500 }, { asaasFailure: 302 }, { saveFailure: 302 }]) {
    const f = fixture(options);
    const response = await f.worker.fetch(request('userA', 'PUT', { apiKey: apiA }), env);
    assert.ok(response.status >= 500);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    await privateResult(response);
    assert.equal(f.store.size, 0);
  }
});
