import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { createFetchMock, Miniflare } from 'miniflare';

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
