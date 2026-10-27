import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorker } from './worker.js';

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
  assert.deepEqual(await response.json(), { service: 'registro-vendas-pix-testes', stage: 'connection-only', environment: 'sandbox' });
  assert.equal(calls.length, 0);
});

test('não aceita nem confirma Webhooks antes da integração financeira', async () => {
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
