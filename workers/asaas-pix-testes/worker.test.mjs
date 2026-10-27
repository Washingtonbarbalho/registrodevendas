import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, verify } from 'node:crypto';
import vm from 'node:vm';
import { createWorker } from './worker-under-test.mjs';

const origin = 'https://registro-vendas-pix-testes.washington-wn8.workers.dev';
const setupToken = 'a1'.repeat(32);
const apiKey = 'sandbox-api-secret-used-only-in-unit-tests';
const env = { ASAAS_BASE_URL: 'https://api-sandbox.asaas.com/v3', ASAAS_API_KEY: apiKey, SETUP_TOKEN: setupToken };
const request = (pathname = '/api/setup/check', options = {}) => new Request(origin + pathname, {
  method: 'POST',
  headers: { 'X-Setup-Token': setupToken, Origin: origin },
  ...options,
});
const upstream = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

function mockedWorker(respond = () => upstream({ data: [] })) {
  const calls = [];
  const worker = createWorker({ fetchAsaas: async (...args) => { calls.push(args); return respond(...args); } });
  return { worker, calls };
}

async function assertPrivate(response, ...privateValues) {
  const body = await response.text();
  for (const value of [apiKey, setupToken, ...privateValues]) assert.ok(!body.includes(value), 'A resposta não pode revelar dados privados.');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  return body;
}

test('a página inicial não consulta a API nem recebe os segredos no HTML', async () => {
  const { worker, calls } = mockedWorker();
  const response = await worker.fetch(request('/', { method: 'GET' }), env);
  assert.equal(response.status, 200);
  const html = await assertPrivate(response);
  if (process.env.PIX_WORKER_VARIANT === 'mobile') {
    assert.match(html, /Asaas Sandbox/);
    assert.match(html, /Abrir o sistema/);
    assert.equal(calls.length, 0);
    return;
  }
  assert.match(html, /Teste de conexão com o Asaas/);
  assert.match(html, /crypto\.getRandomValues/);
  assert.match(html, /textContent = message/);
  assert.doesNotMatch(html, /localStorage|sessionStorage|document\.cookie/);
  const nonce = response.headers.get('Content-Security-Policy').match(/script-src 'nonce-([^']+)'/)[1];
  assert.ok(html.includes(`<script nonce="${nonce}">`));
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(calls.length, 0);
});

test('health não significa que a API foi conectada e não acessa o provedor', async () => {
  const { worker, calls } = mockedWorker();
  const response = await worker.fetch(request('/health', { method: 'GET' }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { service: 'registro-vendas-pix-testes', stage: 'sandbox-charge-test', environment: 'sandbox' });
  assert.equal(calls.length, 0);
});

test('recusa rotas de cobrança e Webhooks financeiros não implementados', async () => {
  const { worker, calls } = mockedWorker();
  for (const pathname of ['/webhook', '/asaas/webhook', '/v3/payments', '/api/pix', '/favicon.ico']) {
    const response = await worker.fetch(request(pathname), env);
    assert.equal(response.status, 404);
  }
  assert.equal(calls.length, 0);
});

test('diagnóstico rejeita GET e preflight de outras origens', async () => {
  const { worker, calls } = mockedWorker();
  for (const method of ['GET', 'OPTIONS', 'PUT', 'DELETE']) {
    const response = await worker.fetch(request('/api/setup/check', { method }), env);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  assert.equal(calls.length, 0);
});

test('recusa requisições de outros sites mesmo que tenham um código correto', async () => {
  const { worker, calls } = mockedWorker();
  for (const headers of [
    { Origin: 'https://outro-site.invalid', 'X-Setup-Token': setupToken },
    { Origin: origin, 'Sec-Fetch-Site': 'cross-site', 'X-Setup-Token': setupToken },
  ]) {
    const response = await worker.fetch(request('/api/setup/check', { headers }), env);
    assert.equal(response.status, 403);
  }
  assert.equal(calls.length, 0);
});

test('recusa códigos ausentes, curtos ou incorretos antes de acessar o Asaas', async () => {
  const { worker, calls } = mockedWorker();
  for (const token of ['', 'a1', 'a1'.repeat(31) + 'a2', 'z'.repeat(64), setupToken + '00']) {
    const response = await worker.fetch(request('/api/setup/check', { headers: { 'X-Setup-Token': token } }), env);
    assert.equal(response.status, 401);
    await assertPrivate(response);
  }
  assert.equal(calls.length, 0);
});

test('exige a criação de SETUP_TOKEN com o código aleatório completo', async () => {
  const { worker, calls } = mockedWorker();
  for (const token of [undefined, '', 'senha-curta']) {
    const response = await worker.fetch(request(), { ...env, SETUP_TOKEN: token });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'setup_required');
  }
  assert.equal(calls.length, 0);
});

test('bloqueia Produção, URLs externas e variações que poderiam vazar a chave', async () => {
  const { worker, calls } = mockedWorker();
  for (const url of [
    undefined,
    '',
    'https://api.asaas.com/v3',
    'https://api-sandbox.asaas.com.evil.invalid/v3',
    'https://evil.invalid/v3',
    'https://api-sandbox.asaas.com/v3?redirect=evil',
    'http://api-sandbox.asaas.com/v3',
  ]) {
    const response = await worker.fetch(request(), { ...env, ASAAS_BASE_URL: url });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'sandbox_required');
  }
  assert.equal(calls.length, 0);
});

test('recusa chave de API ausente ou com quebra de linha interna', async () => {
  const { worker, calls } = mockedWorker();
  for (const key of ['', undefined, 'invalid\nheader']) {
    const response = await worker.fetch(request(), { ...env, ASAAS_API_KEY: key });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'api_key_required');
  }
  assert.equal(calls.length, 0);
});

test('consulta somente as chaves Pix ativas, sem body, criação de cobranças ou dados expostos', async () => {
  const privatePix = '11111111-2222-3333-4444-555555555555';
  const { worker, calls } = mockedWorker(() => upstream({
    data: [{ status: 'ACTIVE', key: privatePix, qrCode: { payload: 'private-qr-payload' } }],
  }));
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 200);
  const result = JSON.parse(await assertPrivate(response, privatePix, 'private-qr-payload'));
  assert.equal(result.apiConnected, true);
  assert.equal(result.hasActivePixKey, true);
  assert.equal(result.code, 'ready_for_firebase');
  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.equal(url, 'https://api-sandbox.asaas.com/v3/pix/addressKeys?status=ACTIVE&limit=1');
  assert.equal(options.method, 'GET');
  assert.equal(options.body, undefined);
  assert.equal(options.headers.access_token, apiKey);
  assert.equal(options.redirect, 'manual', 'Usar o modo compatível com Workers sem seguir redirecionamentos portando a credencial.');
  assert.ok(options.signal instanceof AbortSignal);
});

test('distingue conexão válida de chave Pix ausente ou ainda não ativa', async () => {
  for (const data of [[], [{ status: 'AWAITING_ACTIVATION' }], [{ status: 'DELETED' }]]) {
    const { worker } = mockedWorker(() => upstream({ data }));
    const response = await worker.fetch(request(), env);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.apiConnected, true);
    assert.equal(result.hasActivePixKey, false);
    assert.equal(result.code, 'pix_key_required');
  }
});

test('aceita URL de Sandbox com uma barra final sem alterar o destino', async () => {
  const { worker, calls } = mockedWorker();
  const response = await worker.fetch(request(), { ...env, ASAAS_BASE_URL: ' https://api-sandbox.asaas.com/v3/ ' });
  assert.equal(response.status, 200);
  assert.equal(calls[0][0], 'https://api-sandbox.asaas.com/v3/pix/addressKeys?status=ACTIVE&limit=1');
});

test('não encaminha erros ou dados privados vindos do Asaas', async () => {
  for (const status of [301, 400, 401, 403, 429, 500, 503]) {
    const secretError = `private-provider-error-${status}`;
    const { worker } = mockedWorker(() => new Response(JSON.stringify({ apiKey, secretError }), { status }));
    const response = await worker.fetch(request(), env);
    assert.equal(response.status, status === 429 ? 503 : 502);
    assert.match(await assertPrivate(response, secretError), /asaas_unavailable/);
  }
});

test('distingue falha de rede, timeout e resposta inválida sem expor dados', async () => {
  for (const [responder, status, code] of [
    [() => { throw new Error(apiKey + setupToken); }, 502, 'connection_failed'],
    [() => { throw new DOMException(apiKey, 'TimeoutError'); }, 504, 'asaas_timeout'],
    [() => { throw new DOMException(apiKey, 'AbortError'); }, 504, 'asaas_timeout'],
    [() => new Response('invalid JSON ' + apiKey), 502, 'invalid_response'],
    [() => upstream({ unexpected: apiKey }), 502, 'invalid_response'],
    [() => upstream(null), 502, 'invalid_response'],
  ]) {
    const { worker } = mockedWorker(responder);
    const response = await worker.fetch(request(), env);
    assert.equal(response.status, status);
    assert.equal(JSON.parse(await assertPrivate(response)).code, code);
  }
});

// Credencial criada apenas para os testes. Não pertence a um projeto Google.
const keyPair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const account = {
  type: 'service_account', project_id: 'vendas-aura',
  client_email: 'diagnostic-test@vendas-aura.iam.gserviceaccount.com',
  private_key: keyPair.privateKey, private_key_id: 'diagnostic-test-key',
  token_uri: 'https://oauth2.googleapis.com/token',
};
const firebaseEnv = { SETUP_TOKEN: setupToken, FIREBASE_SERVICE_ACCOUNT: JSON.stringify(account) };
const googleToken = 'private-google-token-for-tests';
const probeUrl = 'https://firestore.googleapis.com/v1/projects/vendas-aura/databases/(default)/documents/_pix_connection_check?pageSize=1&mask.fieldPaths=connectionTest';
function firebaseWorker(respond = (url) => upstream(url.endsWith('/token') ? { access_token: googleToken } : {})) {
  const calls = [];
  const worker = createWorker({
    fetchGoogle: async (...args) => { calls.push(args); return respond(...args); },
    fetchAsaas: async () => { throw new Error('Firebase não deve consultar o Asaas.'); },
  });
  return { worker, calls };
}
const firebaseRequest = (options = {}) => request('/api/setup/firebase-check', options);
const privateFirebase = response => assertPrivate(response, account.client_email, account.private_key, googleToken);

test('a página oferece o teste Firebase e seu JavaScript tem sintaxe válida', async () => {
  const { worker } = firebaseWorker();
  const response = await worker.fetch(request('/', { method: 'GET' }), firebaseEnv);
  const html = await privateFirebase(response);
  if (process.env.PIX_WORKER_VARIANT === 'mobile') {
    assert.match(html, /Etapa 6/);
    assert.doesNotMatch(html, /<script/);
    return;
  }
  assert.match(html, /Testar Firebase/);
  assert.match(html, /Use o mesmo código/);
  const script = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new vm.Script(script));
});

test('Firebase exige POST, mesma origem e SETUP_TOKEN antes de usar a credencial', async () => {
  const { worker, calls } = firebaseWorker();
  for (const [options, status] of [
    [{ method: 'GET' }, 405],
    [{ method: 'OPTIONS' }, 405],
    [{ headers: { 'X-Setup-Token': setupToken, Origin: 'https://another.invalid' } }, 403],
    [{ headers: { 'X-Setup-Token': setupToken, 'Sec-Fetch-Site': 'cross-site' } }, 403],
    [{ headers: {} }, 401],
    [{ headers: { 'X-Setup-Token': 'b2'.repeat(32) } }, 401],
  ]) {
    const response = await worker.fetch(firebaseRequest(options), firebaseEnv);
    assert.equal(response.status, status);
    await privateFirebase(response);
  }
  assert.equal(calls.length, 0);
});

test('recusa credencial ausente, malformada, incompleta, de outro projeto ou chave inválida sem consultar o Google', async () => {
  for (const [credential, code] of [
    [undefined, 'firebase_secret_required'],
    ['', 'firebase_secret_required'],
    ['{invalid', 'firebase_json_invalid'],
    ['null', 'firebase_credentials_invalid'],
    ['{}', 'firebase_credentials_invalid'],
    [JSON.stringify({ ...account, type: 'authorized_user' }), 'firebase_credentials_invalid'],
    [JSON.stringify({ ...account, client_email: 'invalid' }), 'firebase_credentials_invalid'],
    [JSON.stringify({ ...account, project_id: 'outro-projeto' }), 'firebase_project_mismatch'],
    [JSON.stringify({ ...account, private_key: 'not-a-private-key' }), 'firebase_private_key_invalid'],
    [JSON.stringify({ ...account, private_key: '-----BEGIN PRIVATE KEY-----\ninvalid\n-----END PRIVATE KEY-----' }), 'firebase_private_key_invalid'],
  ]) {
    const { worker, calls } = firebaseWorker();
    const response = await worker.fetch(firebaseRequest(), { ...firebaseEnv, FIREBASE_SERVICE_ACCOUNT: credential });
    assert.equal(response.status, 503);
    assert.equal(JSON.parse(await privateFirebase(response)).code, code);
    assert.equal(calls.length, 0);
  }
});

test('assina JWT RS256 verificável e confirma leitura de coleção vazia sem gravar ou depender do Asaas', async () => {
  const { worker, calls } = firebaseWorker();
  const response = await worker.fetch(firebaseRequest(), firebaseEnv);
  const result = JSON.parse(await privateFirebase(response));
  assert.equal(response.status, 200);
  assert.equal(result.code, 'firebase_connected');
  assert.equal(result.firestoreRead, true);
  assert.equal(result.mode, 'read-only');
  assert.equal(calls.length, 2);
  const [authUrl, authOptions] = calls[0];
  assert.equal(authUrl, 'https://oauth2.googleapis.com/token');
  assert.equal(authOptions.method, 'POST');
  assert.equal(authOptions.redirect, 'manual');
  assert.equal(authOptions.headers['Content-Type'], 'application/x-www-form-urlencoded');
  const form = new URLSearchParams(authOptions.body);
  assert.equal(form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  const assertion = form.get('assertion');
  const [header, claims, signature] = assertion.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: 'RS256', typ: 'JWT', kid: account.private_key_id });
  const payload = JSON.parse(Buffer.from(claims, 'base64url'));
  assert.equal(payload.iss, account.client_email);
  assert.equal(payload.aud, authUrl);
  assert.equal(payload.scope, 'https://www.googleapis.com/auth/datastore');
  assert.ok(Math.abs(payload.iat - Date.now() / 1000 + 30) < 5);
  assert.ok(payload.exp - payload.iat <= 3600);
  assert.equal(verify('RSA-SHA256', Buffer.from(header + '.' + claims), keyPair.publicKey, Buffer.from(signature, 'base64url')), true);
  assert.ok(!(JSON.stringify(result).includes(assertion)));
  const [readUrl, readOptions] = calls[1];
  assert.equal(readUrl, probeUrl);
  assert.equal(readOptions.method, 'GET');
  assert.equal(readOptions.body, undefined);
  assert.equal(readOptions.redirect, 'manual');
  assert.equal(readOptions.headers.Authorization, 'Bearer ' + googleToken);
  assert.equal(readOptions.signal, authOptions.signal);
});

test('não expõe documentos retornados nem utiliza destinos vindos do JSON da credencial', async () => {
  const privateDoc = 'customer-private-field-for-test';
  const { worker, calls } = firebaseWorker(url => upstream(url.endsWith('/token')
    ? { access_token: googleToken }
    : { documents: [{ fields: { connectionTest: { stringValue: privateDoc } } }] }));
  const response = await worker.fetch(firebaseRequest(), {
    ...firebaseEnv,
    FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ ...account, token_uri: 'https://never-contact.invalid/token', private_key: account.private_key.replace(/\n/g, '\\n') }),
  });
  assert.equal(response.status, 200);
  await assertPrivate(response, privateDoc, account.private_key, googleToken);
  assert.equal(calls[0][0], 'https://oauth2.googleapis.com/token');
  assert.equal(calls[1][0], probeUrl);
});

test('erros ou redirects OAuth não revelam dados nem prosseguem até o Firestore', async () => {
  for (const status of [302, 400, 401, 403, 429, 500]) {
    const { worker, calls } = firebaseWorker(() => new Response('private-google-error ' + googleToken, { status }));
    const response = await worker.fetch(firebaseRequest(), firebaseEnv);
    assert.equal(response.status, 502);
    assert.equal(JSON.parse(await assertPrivate(response, 'private-google-error', googleToken)).code, 'firebase_auth_failed');
    assert.equal(calls.length, 1);
  }
});

test('erro de permissão, banco ausente, limites e redirects do Firestore não liberam acesso público', async () => {
  for (const status of [302, 401, 403, 404, 429, 500]) {
    const { worker, calls } = firebaseWorker(url => url.endsWith('/token')
      ? upstream({ access_token: googleToken })
      : new Response('private-firestore-error ' + googleToken, { status }));
    const response = await worker.fetch(firebaseRequest(), firebaseEnv);
    assert.equal(response.status, status === 429 ? 503 : 502);
    assert.equal(JSON.parse(await assertPrivate(response, 'private-firestore-error', googleToken)).code, 'firebase_read_failed');
    assert.equal(calls.length, 2);
  }
});

test('recusa token ausente, inválido ou resposta OAuth fora do formato antes de ler Firestore', async () => {
  for (const body of ['not-json', 'null', '{}', '{"access_token":"invalid\\nheader"}']) {
    const { worker, calls } = firebaseWorker(() => new Response(body));
    const response = await worker.fetch(firebaseRequest(), firebaseEnv);
    assert.equal(response.status, 502);
    await privateFirebase(response);
    assert.equal(calls.length, 1);
  }
});

test('recusa resposta inválida e oculta falhas e timeout nas duas etapas do Firebase', async () => {
  for (const phase of ['auth', 'firestore']) {
    for (const [responder, expectedCode, status] of [
      [() => { throw new Error(googleToken); }, 'firebase_connection_failed', 502],
      [() => { throw new DOMException(googleToken, 'TimeoutError'); }, 'firebase_timeout', 504],
      [() => { throw new DOMException(googleToken, 'AbortError'); }, 'firebase_timeout', 504],
      [() => new Response('invalid-json ' + googleToken), 'firebase_response_invalid', 502],
    ]) {
      const { worker } = firebaseWorker(url => phase === 'firestore' && url.endsWith('/token') ? upstream({ access_token: googleToken }) : responder());
      const response = await worker.fetch(firebaseRequest(), firebaseEnv);
      assert.equal(response.status, status);
      assert.equal(JSON.parse(await privateFirebase(response)).code, expectedCode);
    }
  }
  for (const data of [null, [], { error: 'private-error' }, { documents: 'invalid' }]) {
    const { worker } = firebaseWorker(url => upstream(url.endsWith('/token') ? { access_token: googleToken } : data));
    const response = await worker.fetch(firebaseRequest(), firebaseEnv);
    assert.equal(response.status, 502);
    assert.equal(JSON.parse(await privateFirebase(response)).code, 'firebase_response_invalid');
  }
});

const writeRequest = (options = {}) => request('/api/setup/firebase-write-check', options);
const probeCollectionPath = '/v1/projects/vendas-aura/databases/(default)/documents/_pix_connection_check';
function writeSimulator(options = {}) {
  let document = null;
  const clone = data => JSON.parse(JSON.stringify(data));
  const responder = async (input, init) => {
    const url = new URL(input);
    if (input === 'https://oauth2.googleapis.com/token') return upstream({ access_token: googleToken });
    assert.equal(url.origin, 'https://firestore.googleapis.com');
    assert.ok(url.pathname.startsWith(probeCollectionPath));
    if (options.block === init.method) return new Response('private-provider-error ' + googleToken, { status: options.status || 403 });
    if (init.method === 'POST') {
      assert.equal(url.pathname, probeCollectionPath);
      if (options.conflict) return new Response('{}', { status: 409 });
      const id = url.searchParams.get('documentId');
      assert.match(id, /^probe-[a-f0-9-]{36}$/);
      const body = JSON.parse(init.body);
      document = { name: url.pathname.slice(4) + '/' + id, fields: body.fields, updateTime: '2026-10-27T12:00:00.000001Z' };
      if (options.invalidCreate) return upstream({ ...clone(document), name: 'projects/vendas-aura/databases/(default)/documents/sales/never-delete' });
      return upstream(clone(document));
    }
    assert.ok(document, 'Só pode acessar um documento que foi criado por este teste.');
    assert.equal(url.pathname.slice(4), document.name);
    if (init.method === 'PATCH') {
      assert.equal(url.searchParams.get('currentDocument.updateTime'), document.updateTime);
      assert.equal(url.searchParams.get('updateMask.fieldPaths'), 'stage');
      const body = JSON.parse(init.body);
      assert.deepEqual(body, { fields: { stage: { stringValue: 'updated' } } });
      document.fields.stage = body.fields.stage;
      document.updateTime = '2026-10-27T12:00:00.000002Z';
      if (options.updateTimeout) throw new DOMException(googleToken, 'TimeoutError');
      return upstream(clone(document));
    }
    if (init.method === 'GET') {
      assert.equal(init.body, undefined);
      if (options.concurrentChange) {
        document.updateTime = '2026-10-27T12:00:00.000003Z';
        document.fields.extra = { stringValue: 'concurrent-change-must-be-preserved' };
      }
      return upstream(clone(document));
    }
    assert.equal(init.method, 'DELETE');
    assert.equal(init.body, undefined);
    if (url.searchParams.get('currentDocument.updateTime') !== document.updateTime) return new Response('{}', { status: 412 });
    document = null;
    return upstream({});
  };
  return { ...firebaseWorker(responder), document: () => document };
}

test('gravação exige autenticação de configuração e mesma origem antes de acessar Google', async () => {
  const { worker, calls } = writeSimulator();
  for (const [options, status] of [
    [{ method: 'GET' }, 405],
    [{ method: 'OPTIONS' }, 405],
    [{ headers: {} }, 401],
    [{ headers: { 'X-Setup-Token': 'b1'.repeat(32) } }, 401],
    [{ headers: { 'X-Setup-Token': setupToken, Origin: 'https://other.invalid' } }, 403],
    [{ headers: { 'X-Setup-Token': setupToken, 'Sec-Fetch-Site': 'cross-site' } }, 403],
  ]) {
    const response = await worker.fetch(writeRequest(options), firebaseEnv);
    assert.equal(response.status, status);
    await privateFirebase(response);
  }
  assert.equal(calls.length, 0);
});

test('teste completo cria, atualiza, confere e apaga somente seu diagnóstico com precondições de versão', async () => {
  const { worker, calls, document } = writeSimulator();
  const response = await worker.fetch(writeRequest({ body: JSON.stringify({ documentId: 'sales/customer-record', uid: 'another-user' }) }), firebaseEnv);
  assert.equal(response.status, 200);
  const result = JSON.parse(await privateFirebase(response));
  assert.equal(result.code, 'firebase_write_connected');
  assert.equal(result.firestoreWrite, true);
  assert.equal(result.diagnosticCleaned, true);
  assert.equal(document(), null);
  assert.deepEqual(calls.map(([, init]) => init.method), ['POST', 'POST', 'PATCH', 'GET', 'DELETE']);
  assert.ok(!JSON.stringify(calls).includes('sales/customer-record'));
  const diagnosticBody = JSON.parse(calls[1][1].body);
  assert.deepEqual(Object.keys(diagnosticBody.fields).sort(), ['connectionTest', 'probeId', 'stage']);
  assert.equal(diagnosticBody.fields.connectionTest.booleanValue, true);
  const probeId = diagnosticBody.fields.probeId.stringValue;
  assert.equal(new URL(calls[1][0]).searchParams.get('documentId'), 'probe-' + probeId);
  assert.equal(new URL(calls[2][0]).searchParams.get('currentDocument.updateTime'), '2026-10-27T12:00:00.000001Z');
  assert.equal(new URL(calls[4][0]).searchParams.get('currentDocument.updateTime'), '2026-10-27T12:00:00.000002Z');
  for (const [, init] of calls) {
    assert.equal(init.redirect, 'manual');
    assert.equal(init.signal, calls[0][1].signal);
  }
});

test('não sobrescreve nem tenta limpar documento preexistente em caso de conflito na criação', async () => {
  const { worker, calls } = writeSimulator({ conflict: true });
  const response = await worker.fetch(writeRequest(), firebaseEnv);
  assert.equal(response.status, 502);
  const result = JSON.parse(await privateFirebase(response));
  assert.equal(result.step, 'criação');
  assert.equal(result.diagnosticCleaned, true);
  assert.equal(calls.length, 2);
});

test('indica a etapa que falhou e só confirma limpeza após exclusão autorizada', async () => {
  for (const [method, step] of [['POST', 'criação'], ['PATCH', 'atualização'], ['GET', 'leitura'], ['DELETE', 'exclusão']]) {
    const { worker, calls, document } = writeSimulator({ block: method });
    const response = await worker.fetch(writeRequest(), firebaseEnv);
    assert.equal(response.status, 502);
    const result = JSON.parse(await assertPrivate(response, googleToken, 'private-provider-error'));
    assert.equal(result.code, 'firebase_write_failed');
    assert.equal(result.step, step);
    assert.match(result.message, /HTTP 403/);
    assert.equal(result.diagnosticCleaned, method !== 'DELETE');
    assert.equal(document() === null, method !== 'DELETE');
    assert.equal(calls.filter(([, init]) => init.method === 'DELETE').length, method === 'POST' ? 0 : method === 'DELETE' ? 2 : 1);
  }
});

test('não adota caminhos fornecidos pelo servidor nem apaga documento sem identidade confirmada', async () => {
  const { worker, calls, document } = writeSimulator({ invalidCreate: true });
  const response = await worker.fetch(writeRequest(), firebaseEnv);
  assert.equal(response.status, 502);
  const result = JSON.parse(await privateFirebase(response));
  assert.equal(result.diagnosticCleaned, false);
  assert.equal(calls.length, 2);
  assert.ok(document());
  assert.ok(!JSON.stringify(calls).includes('never-delete'));
});

test('alteração concorrente do diagnóstico impede exclusão e informa limpeza pendente', async () => {
  const { worker, calls, document } = writeSimulator({ concurrentChange: true });
  const response = await worker.fetch(writeRequest(), firebaseEnv);
  assert.equal(response.status, 502);
  const result = JSON.parse(await privateFirebase(response));
  assert.equal(result.step, 'leitura');
  assert.equal(result.diagnosticCleaned, false);
  assert.ok(document().fields.extra);
  assert.equal(new URL(calls.at(-1)[0]).searchParams.get('currentDocument.updateTime'), '2026-10-27T12:00:00.000002Z');
});

test('timeout após atualização não apaga com versão desconhecida nem declara limpeza falsa', async () => {
  const { worker, calls, document } = writeSimulator({ updateTimeout: true });
  const response = await worker.fetch(writeRequest(), firebaseEnv);
  assert.equal(response.status, 504);
  const result = JSON.parse(await privateFirebase(response));
  assert.equal(result.step, 'atualização');
  assert.equal(result.diagnosticCleaned, false);
  assert.ok(document());
  assert.equal(new URL(calls.at(-1)[0]).searchParams.get('currentDocument.updateTime'), '2026-10-27T12:00:00.000001Z');
  assert.notEqual(calls.at(-1)[1].signal, calls[0][1].signal);
});
