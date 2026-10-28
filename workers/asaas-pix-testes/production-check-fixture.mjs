import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createWorker } from './worker-under-test.mjs';
import { productionFixture, env, key, origin, request, reply, result } from './production-fixture.mjs';
export { env, key, origin, result };
export const payer = { payerName: 'PAGADOR APENAS PARA TESTES AUTOMATIZADOS', payerCpf: '52998224725' };
export const path = '/receipt-check';
export const checkRequest = (method = 'GET', body, suffix = '', uid = 'userA', extra = {}) => request(method, body, path + suffix, uid, extra);
export const tokenFor = uid => createHmac('sha256', Buffer.from(env.PIX_ENCRYPTION_KEY, 'hex')).update('aura:production-webhook:v1:' + uid).digest('hex');
export const webhook = (payment, event = 'PAYMENT_RECEIVED', id = 'evt_real_1', uid = 'userA', token = tokenFor(uid)) => new Request('https://worker.test/api/webhooks/asaas/production/' + uid, { method: 'POST', headers: { 'Content-Type': 'application/json', 'asaas-access-token': token }, body: JSON.stringify({ id, event, payment }) });
const name = path => 'projects/vendas-aura/databases/(default)/documents/' + path;
export function checkFixture(options = {}) {
    const base = productionFixture(options);
    const docs = base.store;
    const customers = [], payments = [], hooks = [];
    let clock = 0;
    const version = () => '2026-10-27T13:00:00.' + String(++clock).padStart(6, '0') + 'Z';
    const fetchGoogle = async (input, init) => {
        const url = new URL(input);
        if (url.hostname === 'identitytoolkit.googleapis.com') {
            const response = await base.fetchGoogle(input, init);
            const data = await response.json();
            data.users?.forEach(user => { user.email = user.localId + '@example.com'; });
            return reply(data, response.status);
        }
        if (url.pathname.endsWith('/documents:commit')) {
            base.googleCalls.push([String(input), init]);
            assert.equal(init.method, 'POST');
            assert.equal(init.redirect, 'manual');
            assert.equal(init.headers.Authorization, 'Bearer google-token-only-for-production-fixtures');
            const { writes } = JSON.parse(init.body);
            for (const write of writes) {
                assert.ok(write.update);
                assert.match(write.update.name, /^projects\/vendas-aura\/databases\/\(default\)\/documents\/(?:_asaas_production_checks\/[\w-]+(?:\/history\/[\w-]+)?|_asaas_production_integrations\/[\w-]+)$/);
                assert.deepEqual(write.updateMask.fieldPaths.sort(), Object.keys(write.update.fields).sort());
            }
            const valid = () => writes.every(write => {
                const current = docs.get(write.update.name.split('/documents/')[1]);
                return current ? write.currentDocument.updateTime === current.updateTime : write.currentDocument.exists === false;
            });
            if (!valid()) return reply({}, 412);
            await options.beforeCommit?.(writes);
            if (!valid()) return reply({}, 412);
            if (options.commitFailure && writes.some(write => write.update.fields.receivedWebhookAt?.timestampValue)) return reply({}, 503);
            const writeResults = writes.map(write => {
                const path = write.update.name.split('/documents/')[1];
                const current = docs.get(path);
                const updateTime = version();
                docs.set(path, { name: write.update.name, fields: { ...current?.fields, ...write.update.fields }, updateTime });
                return { updateTime };
            });
            return reply({ writeResults });
        }
        const privatePath = url.pathname.split('/documents/')[1];
        if (privatePath?.startsWith('_asaas_production_checks/')) {
            base.googleCalls.push([String(input), init]);
            assert.equal(init.method, 'GET');
            const current = docs.get(privatePath);
            return current ? reply(structuredClone(current)) : reply({}, 404);
        }
        return base.fetchGoogle(input, init);
    };
    const fetchAsaas = async (input, init) => {
        const url = new URL(input);
        if (url.pathname === '/v3/pix/addressKeys') return base.fetchAsaas(input, init);
        base.providerCalls.push([String(input), init]);
        assert.equal(url.origin, 'https://api.asaas.com');
        assert.equal(init.redirect, 'manual');
        assert.equal(init.headers.access_token, key);
        const body = init.body ? JSON.parse(init.body) : null;
        if (options.diagnosticProviderFailure) return reply({ error: { message: key + payer.payerCpf } }, options.diagnosticProviderFailure);
        if (url.pathname === '/v3/webhooks') {
            if (init.method === 'GET') return reply({ data: hooks, hasMore: options.tooManyHooks || false });
            assert.equal(init.method, 'POST');
            assert.equal(body.url, 'https://registro-vendas-pix-testes.washington-wn8.workers.dev/api/webhooks/asaas/production/userA');
            assert.equal(body.authToken, tokenFor('userA'));
            assert.equal(body.email, 'userA@example.com');
            const hook = { ...body, id: 'hook_real_' + (hooks.length + 1) };
            hooks.push(hook);
            if (options.timeoutHook) throw new Error(key);
            return reply(hook);
        }
        if (url.pathname.startsWith('/v3/webhooks/')) {
            assert.equal(init.method, 'PUT');
            const hook = hooks.find(item => item.id === url.pathname.split('/').pop());
            Object.assign(hook, body);
            return reply(hook);
        }
        if (url.pathname === '/v3/customers') {
            if (init.method === 'GET') return reply({ data: customers.filter(item => item.externalReference === url.searchParams.get('externalReference')), hasMore: false });
            assert.equal(init.method, 'POST');
            assert.equal(body.name, payer.payerName);
            assert.equal(body.cpfCnpj, payer.payerCpf);
            assert.equal(body.notificationDisabled, true);
            assert.equal(body.email, undefined);
            assert.equal(body.phone, undefined);
            assert.equal(body.mobilePhone, undefined);
            const customer = { ...body, id: 'cus_real_' + (customers.length + 1) };
            customers.push(customer);
            if (options.timeoutCustomer) throw new Error(key);
            return reply(customer);
        }
        if (url.pathname === '/v3/payments') {
            if (init.method === 'GET') return reply({ data: payments.filter(item => item.externalReference === url.searchParams.get('externalReference')), hasMore: false });
            assert.equal(init.method, 'POST');
            assert.equal(body.value, 5);
            assert.equal(body.billingType, 'PIX');
            assert.equal(body.split, undefined);
            assert.equal(body.postalService, undefined);
            assert.match(body.dueDate, /^\d{4}-\d{2}-\d{2}$/);
            const payment = { ...body, id: 'pay_real_' + (payments.length + 1), netValue: 4.5, status: 'PENDING' };
            await options.beforeCreatePayment?.(payment);
            if (!options.unknownPayment) payments.push(payment);
            if (options.timeoutPayment || options.unknownPayment) throw new Error(key);
            return reply(payment);
        }
        const match = /^\/v3\/payments\/([\w-]+)(\/pixQrCode)?$/.exec(url.pathname);
        if (match) {
            const payment = payments.find(item => item.id === match[1]);
            assert.ok(payment);
            if (match[2]) return reply(options.invalidQr ? {} : { payload: '00020126580014br.gov.bcb.pix.REAL_FIXTURE_ONLY', encodedImage: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB' });
            if (init.method === 'DELETE') {
                if (options.receivedOnCancel) payment.status = 'RECEIVED';
                else payment.deleted = true;
            } else assert.equal(init.method, 'GET');
            return reply(payment);
        }
        assert.fail('Operação não permitida: ' + init.method + ' ' + url.href);
    };
    const worker = createWorker({ fetchGoogle, fetchAsaas });
    const connect = async () => result(await worker.fetch(request('PUT', { apiKey: key }), env));
    const prepare = async () => { await connect(); return result(await worker.fetch(checkRequest('POST', payer), env)); };
    return { ...base, worker, fetchGoogle, fetchAsaas, docs, hooks, customers, payments, options, connect, prepare, doc: () => docs.get('_asaas_production_checks/userA') };
}
