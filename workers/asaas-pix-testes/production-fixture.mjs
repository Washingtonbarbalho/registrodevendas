import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { createWorker } from './worker-under-test.mjs';

const pair = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
export const env = { FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ type: 'service_account', project_id: 'vendas-aura', client_email: 'production-fixture@vendas-aura.iam.gserviceaccount.com', private_key: pair.privateKey }), PIX_ENCRYPTION_KEY: '0c'.repeat(32), SETUP_TOKEN: '0d'.repeat(32), ASAAS_API_KEY: 'global-key-never-used-for-production', ASAAS_BASE_URL: 'https://wrong-destination.invalid' };
export const key = 'production-api-key-for-fixtures-only';
export const origin = 'https://washingtonbarbalho.github.io';
export const path = '/api/integrations/asaas-production';
export const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const resource = path => 'projects/vendas-aura/databases/(default)/documents/' + path;
export const idToken = (uid = 'userA', changes = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = encode({ alg: 'RS256' }) + '.' + encode({ sub: uid, aud: 'vendas-aura', iss: 'https://securetoken.google.com/vendas-aura', iat: now - 10, auth_time: now - 10, exp: now + 3000, ...changes });
    return unsigned + '.' + sign('RSA-SHA256', Buffer.from(unsigned), pair.privateKey).toString('base64url');
};
export const request = (method = 'GET', body, suffix = '', uid = 'userA', extra = {}) => new Request('https://worker.test' + path + suffix, { method, headers: { Origin: origin, Authorization: 'Bearer ' + idToken(uid), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...extra });
export function productionFixture(options = {}) {
    const store = options.store || new Map();
    const googleCalls = [];
    const providerCalls = [];
    let clock = 0;
    const fetchGoogle = async (input, init) => {
        googleCalls.push([String(input), init]);
        const url = new URL(input);
        assert.equal(init.redirect, 'manual');
        if (url.hostname === 'identitytoolkit.googleapis.com') {
            const token = JSON.parse(init.body).idToken;
            const parts = token.split('.');
            if (options.invalidLogin || !verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), pair.publicKey, Buffer.from(parts[2], 'base64url'))) return reply({ error: key }, 400);
            const claims = JSON.parse(Buffer.from(parts[1], 'base64url'));
            return reply({ users: [{ localId: claims.sub, disabled: !!options.disabled, validSince: options.revoked ? String(claims.auth_time + 1) : '0' }] });
        }
        if (url.hostname === 'oauth2.googleapis.com') return reply({ access_token: 'google-token-only-for-production-fixtures' });
        assert.equal(url.origin, 'https://firestore.googleapis.com');
        assert.equal(init.headers.Authorization, 'Bearer google-token-only-for-production-fixtures');
        const privatePath = url.pathname.split('/documents/')[1];
        if (/^artifacts\/vendas-aura-main\/users\/[\w-]+\/profile\/info$/.test(privatePath)) {
            assert.equal(init.method, 'GET', 'O perfil comum é somente consultado.');
            return reply({ name: resource(privatePath), fields: { approved: { booleanValue: !options.unapproved }, status: { stringValue: options.profileStatus || 'active' } }, updateTime: '2026-10-27T12:00:00.000001Z' });
        }
        assert.match(privatePath, /^_asaas_production_integrations\/[\w-]+$/, 'Esta etapa não acessa Sandbox, vendas, produtos ou clientes.');
        const current = store.get(privatePath);
        if (init.method === 'GET') return current ? reply(structuredClone(current)) : reply({}, 404);
        if (options.conflict) return reply({ error: key }, 412);
        if (options.writeFailure) return reply({ error: key }, 503);
        if ((current && url.searchParams.get('currentDocument.updateTime') !== current.updateTime) || (!current && url.searchParams.get('currentDocument.exists') !== 'false')) return reply({}, 412);
        if (init.method === 'DELETE') { store.delete(privatePath); return reply({}); }
        assert.equal(init.method, 'PATCH');
        const fields = JSON.parse(init.body).fields;
        assert.deepEqual(url.searchParams.getAll('updateMask.fieldPaths').sort(), Object.keys(fields).sort());
        const next = { name: resource(privatePath), fields: { ...current?.fields, ...fields }, updateTime: '2026-10-27T12:01:00.' + String(++clock).padStart(6, '0') + 'Z' };
        store.set(privatePath, next);
        return reply(options.badWriteResponse ? { ...next, fields: {} } : structuredClone(next));
    };
    const fetchAsaas = async (input, init) => {
        providerCalls.push([String(input), init]);
        assert.equal(String(input), 'https://api.asaas.com/v3/pix/addressKeys?status=ACTIVE&limit=1');
        assert.equal(init.method, 'GET', 'A conexão de Produção só pode consultar o Asaas.');
        assert.equal(init.body, undefined);
        assert.equal(init.redirect, 'manual');
        assert.equal(init.headers.access_token, key);
        if (options.providerThrows) throw new Error(key);
        if (options.providerFailure) return reply({ error: { message: key + env.PIX_ENCRYPTION_KEY } }, options.providerFailure);
        if (options.invalidProviderJson) return new Response('not-json ' + key);
        if (options.invalidProviderShape) return reply({ secret: key });
        return reply({ data: options.noPix ? [] : [{ status: 'ACTIVE', key: 'private-pix-address-do-not-expose' }] });
    };
    return { worker: createWorker({ fetchGoogle, fetchAsaas }), fetchGoogle, fetchAsaas, store, googleCalls, providerCalls };
}
export async function result(response, status = 200) {
    const raw = await response.text();
    assert.equal(response.status, status, raw);
    for (const secret of [key, env.PIX_ENCRYPTION_KEY, env.SETUP_TOKEN, env.ASAAS_API_KEY, 'google-token-only-for-production-fixtures', pair.privateKey, 'private-pix-address-do-not-expose']) assert.ok(!raw.includes(secret), 'Não pode expor segredos.');
    assert.doesNotMatch(raw, /"(?:apiKey|cipher|iv|private_key)"\s*:/);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    return JSON.parse(raw);
}
