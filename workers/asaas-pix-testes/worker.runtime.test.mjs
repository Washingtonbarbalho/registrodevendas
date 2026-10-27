import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { generateKeyPairSync, verify } from 'node:crypto';
import { createFetchMock, Miniflare } from 'miniflare';
import { fixture as sandboxFixture, env as sandboxEnv, request as sandboxRequest, webhookRequest, key as sandboxApiKey } from './sandbox-fixture.mjs';

const source = await fs.readFile(new URL('./worker.js', import.meta.url), 'utf8');
const testToken = 'a1'.repeat(32);
const privateKey = 'sandbox-key-only-for-runtime-tests';

async function runInWorkersRuntime(t, upstreamStatus, upstreamBody, headers = {}) {
  const fetchMock = createFetchMock();
  fetchMock.disableNetConnect();
  fetchMock.get('https://api-sandbox.asaas.com').intercept({
    path: '/v3/pix/addressKeys?status=ACTIVE&limit=1',
    method: 'GET',
    headers: { access_token: privateKey },
  }).reply(upstreamStatus, JSON.stringify(upstreamBody), {
    headers: { 'Content-Type': 'application/json', ...headers },
  });
  const mf = new Miniflare({
    modules: true,
    script: source,
    compatibilityDate: '2026-07-30',
    fetchMock,
    bindings: {
      ASAAS_API_KEY: privateKey,
      ASAAS_BASE_URL: 'https://api-sandbox.asaas.com/v3',
      SETUP_TOKEN: testToken,
    },
  });
  t.after(() => mf.dispose());
  const response = await mf.dispatchFetch('https://worker.test/api/setup/check', {
    method: 'POST',
    headers: { Origin: 'https://worker.test', 'X-Setup-Token': testToken },
  });
  const body = await response.text();
  assert.ok(!body.includes(privateKey));
  assert.ok(!body.includes(testToken));
  fetchMock.assertNoPendingInterceptors();
  return { response, result: JSON.parse(body) };
}

test('workerd executa a consulta Asaas com o modo de redirect suportado', async t => {
  const { response, result } = await runInWorkersRuntime(t, 200, {
    data: [{ status: 'ACTIVE', key: 'pix-value-must-not-leak' }],
  });
  assert.equal(response.status, 200);
  assert.equal(result.code, 'ready_for_firebase');
  assert.equal(result.apiConnected, true);
  assert.equal(result.hasActivePixKey, true);
  assert.ok(!JSON.stringify(result).includes('pix-value-must-not-leak'));
});

test('workerd recusa redirect do provedor sem encaminhar a credencial para outro host', async t => {
  const { response, result } = await runInWorkersRuntime(t, 302, {}, {
    Location: 'https://never-contact-this.invalid/collect',
  });
  assert.equal(response.status, 502);
  assert.equal(result.code, 'asaas_unavailable');
});

const rsaPair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const serviceAccount = {
  type: 'service_account', project_id: 'vendas-aura',
  client_email: 'runtime-test@vendas-aura.iam.gserviceaccount.com',
  private_key: rsaPair.privateKey,
};
const googleAccessToken = 'private-access-token-only-for-workerd-test';

async function runFirebaseRuntime(t, authStatus = 200, firestoreStatus = 200) {
  const fetchMock = createFetchMock();
  fetchMock.disableNetConnect();
  let validSignature = false;
  fetchMock.get('https://oauth2.googleapis.com').intercept({
    path: '/token', method: 'POST',
  }).reply(authStatus, async ({ body }) => {
      // Miniflare encaminha o corpo como ReadableStream para o servidor simulado.
      const params = new URLSearchParams(await new Response(body).text());
      const parts = params.get('assertion')?.split('.') || [];
      validSignature = parts.length === 3 && params.get('grant_type') === 'urn:ietf:params:oauth:grant-type:jwt-bearer' && verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), rsaPair.publicKey, Buffer.from(parts[2], 'base64url'));
      return JSON.stringify({ access_token: googleAccessToken });
  }, {
    headers: { 'Content-Type': 'application/json', ...(authStatus === 302 ? { Location: 'https://never-contact.invalid/auth' } : {}) },
  });
  if (authStatus === 200) {
    fetchMock.get('https://firestore.googleapis.com').intercept({
      path: '/v1/projects/vendas-aura/databases/(default)/documents/_pix_connection_check?pageSize=1&mask.fieldPaths=connectionTest',
      method: 'GET', headers: { Authorization: 'Bearer ' + googleAccessToken },
    }).reply(firestoreStatus, '{}', {
      headers: { 'Content-Type': 'application/json', ...(firestoreStatus === 302 ? { Location: 'https://never-contact.invalid/firestore' } : {}) },
    });
  }
  const mf = new Miniflare({
    modules: true, script: source, compatibilityDate: '2026-07-30', fetchMock,
    bindings: { SETUP_TOKEN: testToken, FIREBASE_SERVICE_ACCOUNT: JSON.stringify(serviceAccount) },
  });
  t.after(() => mf.dispose());
  const response = await mf.dispatchFetch('https://worker.test/api/setup/firebase-check', {
    method: 'POST', headers: { Origin: 'https://worker.test', 'X-Setup-Token': testToken },
  });
  const body = await response.text();
  for (const value of [testToken, serviceAccount.client_email, serviceAccount.private_key, googleAccessToken]) assert.ok(!body.includes(value));
  assert.equal(validSignature, true, 'O JWT produzido pelo workerd precisa ter assinatura RSA válida. Resposta: ' + body);
  fetchMock.assertNoPendingInterceptors();
  return { response, result: JSON.parse(body) };
}

test('workerd importa o PKCS8, assina JWT válido e faz somente leitura do Firestore', async t => {
  const { response, result } = await runFirebaseRuntime(t);
  assert.equal(response.status, 200);
  assert.equal(result.code, 'firebase_connected');
  assert.equal(result.firestoreRead, true);
  assert.equal(result.mode, 'read-only');
});

test('workerd recusa redirects OAuth sem encaminhar a assinatura para outro destino', async t => {
  const { response, result } = await runFirebaseRuntime(t, 302);
  assert.equal(response.status, 502);
  assert.equal(result.code, 'firebase_auth_failed');
});

test('workerd recusa redirects Firestore sem encaminhar o token para outro destino', async t => {
  const { response, result } = await runFirebaseRuntime(t, 200, 302);
  assert.equal(response.status, 502);
  assert.equal(result.code, 'firebase_read_failed');
});

test('workerd cria, atualiza, confere e exclui somente o diagnóstico com sua versão', async t => {
  const fetchMock = createFetchMock();
  fetchMock.disableNetConnect();
  fetchMock.get('https://oauth2.googleapis.com').intercept({ path: '/token', method: 'POST' }).reply(200, JSON.stringify({ access_token: googleAccessToken }));
  const prefix = '/v1/projects/vendas-aura/databases/(default)/documents/_pix_connection_check';
  let document;
  let createVersionValid = false;
  let deleteVersionValid = false;
  let deleted = false;
  const calls = [];
  const googleHeaders = { Authorization: 'Bearer ' + googleAccessToken };
  const pool = fetchMock.get('https://firestore.googleapis.com');
  pool.intercept({ path: path => new URL(path, 'https://firestore.googleapis.com').pathname === prefix, method: 'POST', headers: googleHeaders }).reply(200, async ({ path, body }) => {
    calls.push('POST');
    const url = new URL(path, 'https://firestore.googleapis.com');
    const data = JSON.parse(await new Response(body).text());
    document = { name: prefix.slice(4) + '/' + url.searchParams.get('documentId'), fields: data.fields, updateTime: '2026-10-27T12:00:00.000001Z' };
    return JSON.stringify(document);
  });
  const isProbe = path => new URL(path, 'https://firestore.googleapis.com').pathname.startsWith(prefix + '/probe-');
  pool.intercept({ path: isProbe, method: 'PATCH', headers: googleHeaders }).reply(200, async ({ path, body }) => {
    calls.push('PATCH');
    const url = new URL(path, 'https://firestore.googleapis.com');
    createVersionValid = url.searchParams.get('currentDocument.updateTime') === document.updateTime && url.searchParams.get('updateMask.fieldPaths') === 'stage' && url.pathname.slice(4) === document.name;
    const data = JSON.parse(await new Response(body).text());
    document.fields.stage = data.fields.stage;
    document.updateTime = '2026-10-27T12:00:00.000002Z';
    return JSON.stringify(document);
  });
  pool.intercept({ path: isProbe, method: 'GET', headers: googleHeaders }).reply(200, () => {
    calls.push('GET');
    return JSON.stringify(document);
  });
  pool.intercept({ path: isProbe, method: 'DELETE', headers: googleHeaders }).reply(200, ({ path }) => {
    calls.push('DELETE');
    const url = new URL(path, 'https://firestore.googleapis.com');
    deleteVersionValid = url.searchParams.get('currentDocument.updateTime') === document.updateTime && url.pathname.slice(4) === document.name;
    deleted = true;
    return '{}';
  });
  const mf = new Miniflare({
    modules: true, script: source, compatibilityDate: '2026-07-30', fetchMock,
    bindings: { SETUP_TOKEN: testToken, FIREBASE_SERVICE_ACCOUNT: JSON.stringify(serviceAccount) },
  });
  t.after(() => mf.dispose());
  const response = await mf.dispatchFetch('https://worker.test/api/setup/firebase-write-check', {
    method: 'POST', headers: { Origin: 'https://worker.test', 'X-Setup-Token': testToken },
  });
  const body = await response.text();
  assert.equal(response.status, 200, body);
  const result = JSON.parse(body);
  assert.equal(result.code, 'firebase_write_connected');
  assert.equal(result.diagnosticCleaned, true);
  assert.equal(createVersionValid, true);
  assert.equal(deleteVersionValid, true);
  assert.equal(deleted, true);
  assert.deepEqual(calls, ['POST', 'PATCH', 'GET', 'DELETE']);
  for (const value of [testToken, googleAccessToken, serviceAccount.private_key, serviceAccount.client_email]) assert.ok(!body.includes(value));
  fetchMock.assertNoPendingInterceptors();
});

test('workerd importa chave AES-GCM e valida a proteção sem consultas externas', async t => {
  const fetchMock = createFetchMock();
  fetchMock.disableNetConnect();
  const masterKey = 'af'.repeat(32);
  const mf = new Miniflare({ modules: true, script: source, compatibilityDate: '2026-07-30', fetchMock, bindings: { SETUP_TOKEN: testToken, PIX_ENCRYPTION_KEY: masterKey } });
  t.after(() => mf.dispose());
  const response = await mf.dispatchFetch('https://worker.test/api/setup/encryption-check', { method: 'POST', headers: { Origin: 'https://worker.test', 'X-Setup-Token': testToken } });
  const body = await response.text();
  assert.equal(response.status, 200, body);
  assert.equal(JSON.parse(body).encryptionReady, true);
  assert.ok(!body.includes(masterKey));
});

test('workerd salva chave por usuário e testa a cifra recuperada sem depender da chave global', async t => {
  const fetchMock = createFetchMock();
  fetchMock.disableNetConnect();
  const uid = 'runtimeProfileUser';
  const appOrigin = 'https://washingtonbarbalho.github.io';
  const userKey = 'private-user-sandbox-key-for-workerd-only';
  const masterKey = 'ab'.repeat(32);
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const userToken = encode({ alg: 'RS256' }) + '.' + encode({ sub: uid, aud: 'vendas-aura', iss: 'https://securetoken.google.com/vendas-aura', iat: now - 60, auth_time: now - 60, exp: now + 3500 }) + '.mocked-google-signature';
  fetchMock.get('https://identitytoolkit.googleapis.com').intercept({ path: '/v1/accounts:lookup?key=AIzaSyDQQcD2tzsVS8Xzy-GpHT897kB7EC-S8Ng', method: 'POST' }).reply(200, JSON.stringify({ users: [{ localId: uid, validSince: '0' }] })).times(3);
  fetchMock.get('https://oauth2.googleapis.com').intercept({ path: '/token', method: 'POST' }).reply(200, JSON.stringify({ access_token: googleAccessToken })).times(3);
  const googleHeaders = { Authorization: 'Bearer ' + googleAccessToken };
  const pool = fetchMock.get('https://firestore.googleapis.com');
  const rootPath = '/v1/projects/vendas-aura/databases/(default)/documents/';
  pool.intercept({ path: rootPath + 'artifacts/vendas-aura-main/users/' + uid + '/profile/info', method: 'GET', headers: googleHeaders }).reply(200, JSON.stringify({ name: 'projects/vendas-aura/databases/(default)/documents/artifacts/vendas-aura-main/users/' + uid + '/profile/info', updateTime: '2026-10-27T12:00:00.000001Z', fields: { approved: { booleanValue: true }, status: { stringValue: 'active' } } })).times(3);
  let savedDocument = null;
  let writes = 0;
  let preconditionsValid = true;
  const integrationPath = rootPath + '_asaas_integrations/' + uid;
  pool.intercept({ path: integrationPath, method: 'GET', headers: googleHeaders }).reply(404, '{}');
  pool.intercept({ path: integrationPath, method: 'GET', headers: googleHeaders }).reply(200, () => JSON.stringify(savedDocument)).times(2);
  pool.intercept({ path: path => new URL(path, 'https://firestore.googleapis.com').pathname === integrationPath, method: 'PATCH', headers: googleHeaders }).reply(200, async ({ path, body }) => {
    const url = new URL(path, 'https://firestore.googleapis.com');
    preconditionsValid &&= savedDocument ? url.searchParams.get('currentDocument.updateTime') === savedDocument.updateTime : url.searchParams.get('currentDocument.exists') === 'false';
    const data = JSON.parse(await new Response(body).text());
    savedDocument = { name: integrationPath.slice(4), fields: { ...(savedDocument?.fields || {}), ...data.fields }, updateTime: '2026-10-27T12:00:00.' + String(++writes).padStart(6, '0') + 'Z' };
    return JSON.stringify(savedDocument);
  }).times(2);
  fetchMock.get('https://api-sandbox.asaas.com').intercept({ path: '/v3/pix/addressKeys?status=ACTIVE&limit=1', method: 'GET', headers: { access_token: userKey } }).reply(200, JSON.stringify({ data: [{ status: 'ACTIVE' }] })).times(2);
  const mf = new Miniflare({ modules: true, script: source, compatibilityDate: '2026-07-30', fetchMock, bindings: { FIREBASE_SERVICE_ACCOUNT: JSON.stringify(serviceAccount), PIX_ENCRYPTION_KEY: masterKey, ASAAS_API_KEY: 'global-key-never-used-here' } });
  t.after(() => mf.dispose());
  for (const [method, suffix, body] of [['PUT', '', JSON.stringify({ apiKey: userKey, enabled: true })], ['POST', '/test'], ['GET', '']]) {
    const response = await mf.dispatchFetch('https://worker.test/api/integrations/asaas' + suffix, { method, headers: { Origin: appOrigin, Authorization: 'Bearer ' + userToken, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body } : {}) });
    const text = await response.text();
    assert.equal(response.status, 200, text);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), appOrigin);
    assert.equal(JSON.parse(text).configured, true);
    for (const secret of [userKey, masterKey, userToken, googleAccessToken, serviceAccount.private_key]) assert.ok(!text.includes(secret));
    assert.doesNotMatch(text, /"(?:cipher|iv|apiKey)"\s*:/);
  }
  assert.equal(preconditionsValid, true);
  assert.equal(writes, 2);
  assert.ok(savedDocument.fields.cipher.stringValue);
  assert.ok(!JSON.stringify(savedDocument).includes(userKey));
  fetchMock.assertNoPendingInterceptors();
});

test('workerd cria a cobrança isolada, simula e valida Webhook com HMAC e consulta ao Asaas', async t => {
  const f = sandboxFixture();
  const fetchMock = createFetchMock();
  fetchMock.disableNetConnect();
  const root = '/v1/projects/vendas-aura/databases/(default)/documents/';
  const firestore = fetchMock.get('https://firestore.googleapis.com');
  firestore.intercept({ path: root + '_asaas_integrations/userA', method: 'GET' }).reply(404, '{}');
  firestore.intercept({ path: root + '_asaas_sandbox_checks/userA', method: 'GET' }).reply(404, '{}').times(2);
  const proxy = (host, method, handler) => {
    fetchMock.get(host).intercept({ path: () => true, method }).reply(200, async options => {
      const incoming = new Headers(options.headers);
      const headers = { Authorization: incoming.get('authorization'), access_token: incoming.get('access_token') };
      const body = options.body ? await new Response(options.body).text() : undefined;
      const response = await handler(host + options.path, { method, headers, body: body || undefined, redirect: 'manual' });
      const raw = await response.text();
      assert.equal(response.status, 200, raw);
      return raw;
    }).persist();
  };
  proxy('https://identitytoolkit.googleapis.com', 'POST', f.fetchGoogle);
  proxy('https://oauth2.googleapis.com', 'POST', f.fetchGoogle);
  for (const method of ['GET', 'PATCH']) proxy('https://firestore.googleapis.com', method, f.fetchGoogle);
  for (const method of ['GET', 'POST', 'PUT']) proxy('https://api-sandbox.asaas.com', method, f.fetchAsaas);
  const mf = new Miniflare({ modules: true, script: source, compatibilityDate: '2026-07-30', fetchMock, bindings: sandboxEnv });
  t.after(() => mf.dispose());
  const dispatch = async request => {
    const body = request.body ? await request.text() : undefined;
    const response = await mf.dispatchFetch(request.url, { method: request.method, headers: Object.fromEntries(request.headers), ...(body ? { body } : {}) });
    const raw = await response.text();
    assert.equal(response.status, 200, raw);
    return JSON.parse(raw);
  };
  await dispatch(sandboxRequest('PUT', '', 'userA', { headers: { Origin: 'https://washingtonbarbalho.github.io', Authorization: sandboxRequest().headers.get('Authorization'), 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: sandboxApiKey }) }));
  assert.equal((await dispatch(sandboxRequest('POST'))).ready, true);
  assert.equal((await dispatch(sandboxRequest('POST'))).ready, true);
  assert.equal((await dispatch(sandboxRequest('POST', '/sandbox-charge/simulate'))).testComplete, false);
  await dispatch(webhookRequest({ id: 'pay_test' }));
  assert.equal((await dispatch(sandboxRequest())).testComplete, true);
  assert.equal(f.payments.length, 1);
  fetchMock.assertNoPendingInterceptors();
});
