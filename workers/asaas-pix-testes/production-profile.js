// Etapa 7: conexão de Produção, somente consulta e cadastro privado da credencial.
// Não cria clientes, cobranças, Webhooks ou lançamentos financeiros.
export const PRODUCTION_PROFILE_PATH = '/api/integrations/asaas-production';
const API_URL = 'https://api.asaas.com/v3/pix/addressKeys?status=ACTIVE&limit=1';
const collection = '_asaas_production_integrations/';

export async function decryptProductionKey(env, uid, document, deps) {
  const { IntegrationError, encryptionKey, decodeBase64url } = deps;
  if (document?.fields?.environment?.stringValue !== 'production' || document.fields.version?.integerValue !== '1') throw new IntegrationError('production_format_invalid', 'Não foi possível conferir a conexão de Produção salva.');
  try {
    const iv = decodeBase64url(document.fields.iv?.stringValue);
    if (iv.length !== 12) throw new Error('invalid_iv');
    const additionalData = new TextEncoder().encode('vendas-aura:asaas:production:v1:' + uid);
    const value = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData }, await encryptionKey(env), decodeBase64url(document.fields.cipher?.stringValue));
    return new TextDecoder('utf-8', { fatal: true }).decode(value);
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    throw new IntegrationError('production_key_unreadable', 'Não foi possível abrir a chave real salva. Confira a configuração de proteção antes de substituir a conexão.');
  }
}

export function createProductionProfileHandler(deps) {
  const { IntegrationError, json, authenticatedUser, checkFirebase, loadPrivateDocument, encryptionKey, base64url, decodeBase64url, integrationBody, DEFAULT_APP_ORIGIN, FIRESTORE_DOCUMENTS } = deps;
  const fail = (code, message, status = 503) => { throw new IntegrationError(code, message, status); };
  const additionalData = uid => new TextEncoder().encode('vendas-aura:asaas:production:v1:' + uid);
  const encrypt = async (env, uid, key) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: additionalData(uid) }, await encryptionKey(env), new TextEncoder().encode(key));
    return { cipher: base64url(new Uint8Array(cipher)), iv: base64url(iv) };
  };
  const decrypt = (env, uid, document) => decryptProductionKey(env, uid, document, deps);
  const status = document => ({
    configured: !!document,
    environment: 'production',
    connectionVersion: 1,
    receivingEnabled: false,
    hasActivePixKey: document?.fields?.hasActivePixKey?.booleanValue === true,
    checkedAt: document?.fields?.checkedAt?.timestampValue || null
  });
  const emptyBody = async request => {
    const reader = request.body?.getReader();
    if (!reader) return;
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      if (value.length) { await reader.cancel(); fail('invalid_body', 'Esta ação usa somente a conexão real salva.', 400); }
    }
  };
  const testKey = async (key, fetchAsaas, signal) => {
    let response;
    try {
      response = await fetchAsaas(API_URL, {
        method: 'GET', redirect: 'manual', signal,
        headers: { accept: 'application/json', access_token: key, 'User-Agent': 'RegistroDeVendas-Pix-Production-Connection/1.0' }
      });
    } catch (error) {
      const timedOut = ['TimeoutError', 'AbortError'].includes(error?.name);
      fail('production_connection_failed', timedOut ? 'A consulta da conta real excedeu o tempo de espera. Tente novamente.' : 'Não foi possível consultar a conta real do Asaas. Tente novamente.', timedOut ? 504 : 503);
    }
    if (!response.ok) fail('production_key_rejected', [401, 403].includes(response.status)
      ? 'O Asaas não aceitou a chave real. Confira se ela pertence à conta de Produção e permite consultar as chaves Pix.'
      : response.status === 429 ? 'O Asaas limitou temporariamente as consultas. Aguarde e tente novamente.'
      : 'O Asaas não concluiu a consulta da conta real. Tente novamente.', 502);
    let data;
    try { data = JSON.parse(await response.text()); } catch { fail('production_response_invalid', 'O Asaas não retornou uma resposta válida para a consulta da conta real.', 502); }
    if (!Array.isArray(data?.data)) fail('production_response_invalid', 'Não foi possível conferir a consulta da conta real.', 502);
    return data.data.some(item => item?.status === 'ACTIVE');
  };
  return async (request, env, fetchGoogle, fetchAsaas) => {
    const origin = request.headers.get('Origin');
    const allowed = typeof env.APP_ORIGIN === 'string' && env.APP_ORIGIN.trim() ? env.APP_ORIGIN.trim() : DEFAULT_APP_ORIGIN;
    if (!origin || origin !== allowed) return json({ code: 'origin_denied', message: 'Abra a conexão de Produção pelo sistema de vendas.' }, 403);
    const cors = { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
    const withCors = response => { for (const [key, value] of Object.entries(cors)) response.headers.set(key, value); return response; };
    const path = new URL(request.url).pathname;
    const methods = path === PRODUCTION_PROFILE_PATH ? ['GET', 'PUT', 'DELETE'] : path === PRODUCTION_PROFILE_PATH + '/test' ? ['POST'] : [];
    if (!methods.length) return withCors(json({ code: 'not_found', message: 'Rota não encontrada.' }, 404));
    if (request.method === 'OPTIONS') {
      if (!methods.includes(request.headers.get('Access-Control-Request-Method') || '')) return withCors(json({ code: 'method_not_allowed', message: 'Método não permitido.' }, 405));
      const response = json(null, 200);
      return new Response(null, { status: 204, headers: { ...Object.fromEntries(response.headers), ...cors, 'Access-Control-Allow-Methods': methods.join(', '), 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600' } });
    }
    if (!methods.includes(request.method)) return withCors(json({ code: 'method_not_allowed', message: 'Método não permitido.' }, 405));
    try {
      const user = await authenticatedUser(request, fetchGoogle);
      const input = request.method === 'PUT' ? await integrationBody(request) : null;
      if (input && (Object.keys(input).some(key => key !== 'apiKey') || typeof input.apiKey !== 'string')) fail('invalid_body', 'Informe somente a chave de API de Produção. A ativação dos recebimentos será feita na próxima etapa.', 400);
      if (!input) await emptyBody(request);
      const result = await checkFirebase(env, fetchGoogle, false, async (accessToken, signal) => {
        const headers = { accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken };
        const load = path => loadPrivateDocument(fetchGoogle, headers, signal, path);
        const profile = await load('artifacts/vendas-aura-main/users/' + user.uid + '/profile/info');
        if (profile?.fields?.approved?.booleanValue !== true || !['', 'active'].includes(profile.fields.status?.stringValue || '')) fail('account_not_approved', 'Sua conta precisa estar aprovada e ativa para conectar o Asaas real.', 403);
        const privatePath = collection + user.uid;
        const current = await load(privatePath);
        const precondition = () => new URLSearchParams(current ? { 'currentDocument.updateTime': current.updateTime } : { 'currentDocument.exists': 'false' });
        if (['PUT', 'DELETE'].includes(request.method) && Number(current?.fields?.pendingCharges?.integerValue || 0) > 0) fail('production_pending_charges', 'Existem cobranças pendentes vinculadas à conexão real. Confira essas cobranças antes de alterar a chave.', 409);
        if (request.method === 'DELETE') {
          if (current) {
            const response = await fetchGoogle(FIRESTORE_DOCUMENTS + privatePath + '?' + precondition(), { method: 'DELETE', headers, redirect: 'manual', signal });
            if ([409, 412].includes(response.status)) fail('production_changed', 'A conexão real mudou. Atualize o perfil antes de remover.', 409);
            if (!response.ok && response.status !== 404) fail('production_delete_failed', 'Não foi possível remover a conexão real.');
          }
          return json({ ...status(null), message: 'Chave de Produção removida. A conexão Sandbox foi preservada.' });
        }
        await encryptionKey(env);
        if (request.method === 'GET') {
          if (current) await decrypt(env, user.uid, current);
          return json(status(current));
        }
        const apiKey = input ? input.apiKey.trim() : current ? await decrypt(env, user.uid, current) : '';
        if (!apiKey) fail('production_key_required', 'Informe a chave da API da sua conta real do Asaas.', 400);
        const hasActivePixKey = await testKey(apiKey, fetchAsaas, signal);
        const now = new Date().toISOString();
        const fields = { hasActivePixKey: { booleanValue: hasActivePixKey }, checkedAt: { timestampValue: now }, updatedAt: { timestampValue: now } };
        if (input) {
          const protectedKey = await encrypt(env, user.uid, apiKey);
          Object.assign(fields, { environment: { stringValue: 'production' }, version: { integerValue: '1' }, cipher: { stringValue: protectedKey.cipher }, iv: { stringValue: protectedKey.iv }, enabled: { booleanValue: false } });
        }
        const params = precondition();
        for (const field of Object.keys(fields)) params.append('updateMask.fieldPaths', field);
        const response = await fetchGoogle(FIRESTORE_DOCUMENTS + privatePath + '?' + params, { method: 'PATCH', headers, redirect: 'manual', signal, body: JSON.stringify({ fields }) });
        if ([409, 412].includes(response.status)) fail('production_changed', 'A conexão real mudou durante a consulta. Atualize o perfil e tente novamente.', 409);
        if (!response.ok) fail('production_save_failed', 'A chave foi consultada, mas não foi possível confirmar a gravação. Atualize o perfil antes de repetir.');
        let saved;
        try { saved = JSON.parse(await response.text()); } catch { fail('production_save_failed', 'Não foi possível confirmar a gravação da conexão real. Atualize o perfil antes de repetir.'); }
        if (saved?.name !== 'projects/vendas-aura/databases/(default)/documents/' + privatePath || typeof saved.updateTime !== 'string' || !saved.fields || Object.entries(fields).some(([key, value]) => JSON.stringify(saved.fields[key]) !== JSON.stringify(value))) fail('production_save_failed', 'Não foi possível confirmar a gravação da conexão real. Atualize o perfil antes de repetir.');
        return json({ ...status(saved), message: hasActivePixKey
          ? 'Conta real do Asaas conectada. A chave está protegida e a consulta foi validada. Os recebimentos reais ainda aguardam ativação.'
          : 'Conta real do Asaas conectada. Falta cadastrar ou ativar uma chave Pix nessa conta. Os recebimentos reais ainda aguardam ativação.' });
      });
      return withCors(result);
    } catch (error) {
      return withCors(json({ code: error instanceof IntegrationError ? error.code : 'production_unavailable', message: error instanceof IntegrationError ? error.message : 'Não foi possível concluir a consulta da conta real. Tente novamente.' }, error instanceof IntegrationError ? error.status : 503));
    }
  };
}
