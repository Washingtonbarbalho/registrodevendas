import assert from 'node:assert/strict';
import { generateKeyPairSync, createHmac } from 'node:crypto';
import { createWorker } from './worker-under-test.mjs';

const pair = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const env = { PIX_ENCRYPTION_KEY: 'ab'.repeat(32), FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ type: 'service_account', project_id: 'vendas-aura', client_email: 'sandbox-fixture@vendas-aura.iam.gserviceaccount.com', private_key: pair.privateKey }), ASAAS_BASE_URL: 'https://api.asaas.com/v3', ASAAS_API_KEY: 'global-key-must-not-be-used' };
const origin = 'https://washingtonbarbalho.github.io';
const prefix = '/api/integrations/asaas';
const key = 'sandbox-user-api-key-test-only';
const secret = 'secret-upstream-must-not-leak';
const name = path => 'projects/vendas-aura/databases/(default)/documents/' + path;
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
const idToken = uid => {
    const now = Math.floor(Date.now() / 1000);
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    return encode({ alg: 'RS256' }) + '.' + encode({ sub: uid, aud: 'vendas-aura', iss: 'https://securetoken.google.com/vendas-aura', iat: now - 1, auth_time: now - 1, exp: now + 3000 }) + '.signature';
};
const request = (method = 'GET', suffix = '/sandbox-charge', uid = 'userA', extra = {}) => new Request('https://worker.test' + prefix + suffix, { method, headers: { Origin: origin, Authorization: 'Bearer ' + idToken(uid) }, ...extra });
const hookToken = uid => createHmac('sha256', Buffer.from(env.PIX_ENCRYPTION_KEY, 'hex')).update('aura:sandbox-webhook:v1:' + uid).digest('hex');
const webhookRequest = (payment, eventId = 'evt_1', uid = 'userA', token = hookToken(uid), event = 'PAYMENT_RECEIVED') => new Request('https://worker.test/api/webhooks/asaas/sandbox/' + uid, { method: 'POST', headers: { 'Content-Type': 'application/json', 'asaas-access-token': token }, body: JSON.stringify({ id: eventId, event, payment }) });

function fixture(options = {}) {
    const docs = new Map();
    const calls = [];
    const providerCalls = [];
    const hooks = [];
    const customers = [];
    const payments = [];
    let clock = 0;
    const fetchGoogle = async (input, init) => {
        const url = new URL(input);
        calls.push([url.href, init]);
        assert.equal(init.redirect, 'manual');
        if (url.hostname === 'identitytoolkit.googleapis.com') {
            const uid = JSON.parse(Buffer.from(JSON.parse(init.body).idToken.split('.')[1], 'base64url')).sub;
            return options.invalidLogin ? reply({ error: { message: secret } }, 400) : reply({ users: [{ localId: uid, email: uid + '@example.com' }] });
        }
        if (url.hostname === 'oauth2.googleapis.com') return reply({ access_token: 'google-private-test-access-token' });
        assert.equal(url.origin, 'https://firestore.googleapis.com');
        assert.equal(init.headers.Authorization, 'Bearer google-private-test-access-token');
        const path = url.pathname.split('/documents/')[1];
        assert.match(path, /^(?:_asaas_integrations\/[\w-]+|_asaas_sandbox_checks\/[\w-]+|_asaas_flow_sandbox\/[\w-]+\/(?:orders|pending|payments|receipts|slots)\/[\w-]+|artifacts\/vendas-aura-main\/users\/[\w-]+\/profile\/info)$/,
            'O teste nunca pode acessar vendas, clientes, parcelas ou estoque.');
        if (path.startsWith('artifacts/')) return reply({ name: name(path), fields: { approved: { booleanValue: !options.unapproved }, status: { stringValue: 'active' } }, updateTime: '2026-10-27T12:00:00.000001Z' });
        const current = docs.get(path);
        if (init.method === 'GET') return current ? reply(structuredClone(current)) : reply({}, 404);
        if (init.method === 'DELETE') { docs.delete(path); return reply({}); }
        assert.equal(init.method, 'PATCH');
        if ((current && url.searchParams.get('currentDocument.updateTime') !== current.updateTime) || (!current && url.searchParams.get('currentDocument.exists') !== 'false')) return reply({}, 412);
        const fields = JSON.parse(init.body).fields;
        if (options.webhookWriteConflict && fields.webhookAt) return reply({}, 412);
        assert.deepEqual(url.searchParams.getAll('updateMask.fieldPaths').sort(), Object.keys(fields).sort());
        const next = { name: name(path), fields: { ...current?.fields, ...fields }, updateTime: '2026-10-27T12:00:00.' + String(++clock).padStart(6, '0') + 'Z' };
        docs.set(path, next);
        return reply(structuredClone(next));
    };
    const fetchAsaas = async (input, init) => {
        const url = new URL(input);
        assert.equal(url.origin, 'https://api-sandbox.asaas.com', 'Nenhuma opção pode desviar o teste para Produção.');
        assert.equal(init.redirect, 'manual');
        assert.notEqual(init.headers.access_token, env.ASAAS_API_KEY);
        providerCalls.push([url.href, init]);
        const body = init.body ? JSON.parse(init.body) : null;
        if (url.pathname === '/v3/pix/addressKeys') return reply({ data: [{ status: 'ACTIVE' }] });
        if (options.providerFailure) return reply({ error: { message: secret + key } }, options.providerFailure);
        if (url.pathname === '/v3/webhooks') {
            if (init.method === 'GET') return reply({ data: hooks });
            assert.equal(body.email, 'userA@example.com');
            assert.equal(body.authToken, hookToken('userA'));
            assert.equal(body.url, 'https://registro-vendas-pix-testes.washington-wn8.workers.dev/api/webhooks/asaas/sandbox/userA');
            const hook = { ...body, id: 'hook_test' };
            hooks.push(hook);
            return reply(hook);
        }
        if (url.pathname === '/v3/webhooks/hook_test') {
            assert.equal(init.method, 'PUT');
            Object.assign(hooks[0], body);
            return reply(hooks[0]);
        }
        if (url.pathname === '/v3/customers') {
            if (init.method === 'GET') return reply({ data: customers.filter(item => item.externalReference === url.searchParams.get('externalReference')) });
            assert.deepEqual(body, { name: 'Cliente Teste Registro de Vendas', cpfCnpj: '24971563792', notificationDisabled: true, externalReference: body.externalReference });
            const customer = { ...body, id: 'cus_test' };
            customers.push(customer);
            return reply(customer);
        }
        if (url.pathname === '/v3/payments') {
            if (init.method === 'GET') return reply({ data: payments.filter(item => item.externalReference === url.searchParams.get('externalReference')) });
            assert.equal(body.billingType, 'PIX');
            assert.equal(body.value, 5);
            assert.equal(body.customer, 'cus_test');
            assert.match(body.dueDate, /^\d{4}-\d{2}-\d{2}$/);
            assert.equal(body.split, undefined);
            assert.equal(body.postalService, undefined);
            await options.beforePaymentCreate?.();
            const payment = { ...body, id: 'pay_test', status: 'PENDING' };
            if (!options.unknownWithoutCreate) payments.push(payment);
            if (options.timeoutPaymentCreate || options.unknownWithoutCreate) throw new Error(secret);
            return reply(payment);
        }
        if (url.pathname === '/v3/payments/pay_test') return reply(payments[0]);
        if (url.pathname === '/v3/payments/pay_test/pixQrCode') {
            if (options.invalidQr) return reply({ encodedImage: secret, payload: 'javascript:' + secret, expirationDate: '' });
            return reply({ encodedImage: png, payload: '00020126580014br.gov.bcb.pix.SANDBOX_TEST_ONLY', expirationDate: '2027-10-27 23:59:59' });
        }
        if (url.pathname === '/v3/sandbox/payment/pay_test/confirm') {
            assert.equal(init.method, 'POST');
            assert.equal(init.body, undefined);
            payments[0].status = 'RECEIVED';
            return reply(payments[0]);
        }
        assert.fail('Chamada não autorizada: ' + url.href);
    };
    return { worker: createWorker({ fetchGoogle, fetchAsaas }), fetchGoogle, fetchAsaas, docs, calls, providerCalls, hooks, customers, payments };
}
async function result(response, status = 200) {
    const raw = await response.text();
    assert.equal(response.status, status, raw);
    for (const value of [key, env.ASAAS_API_KEY, env.PIX_ENCRYPTION_KEY, pair.privateKey, secret, 'google-private-test-access-token', hookToken('userA')]) assert.ok(!raw.includes(value));
    assert.doesNotMatch(raw, /"(?:apiKey|authToken|cipher|iv|cpfCnpj|email)"\s*:/);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    return JSON.parse(raw);
}
async function connect(f) {
    await result(await f.worker.fetch(request('PUT', '', 'userA', { headers: { Origin: origin, Authorization: 'Bearer ' + idToken('userA'), 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: key }) }), env));
}
async function prepare(f) { await connect(f); return result(await f.worker.fetch(request('POST'), env)); }


export { fixture, env, origin, request, webhookRequest, result, connect, prepare, key, png, hookToken };
