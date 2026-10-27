// Etapa 4: cadastro privado do Asaas por usuário, somente Sandbox.
// Arquivo independente: pode ser colado no editor de código do Cloudflare Worker.
const SANDBOX_URL = 'https://api-sandbox.asaas.com/v3';
const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const FIREBASE_PROJECT = 'vendas-aura';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIRESTORE_PROBE_URL = 'https://firestore.googleapis.com/v1/projects/vendas-aura/databases/(default)/documents/_pix_connection_check?pageSize=1&mask.fieldPaths=connectionTest';
const FIRESTORE_PROBE_COLLECTION = 'https://firestore.googleapis.com/v1/projects/vendas-aura/databases/(default)/documents/_pix_connection_check';
const FIRESTORE_DOCUMENTS = 'https://firestore.googleapis.com/v1/projects/vendas-aura/databases/(default)/documents/';
const FIREBASE_WEB_API_KEY = 'AIzaSyDQQcD2tzsVS8Xzy-GpHT897kB7EC-S8Ng';
const DEFAULT_APP_ORIGIN = 'https://washingtonbarbalho.github.io';
const INTEGRATION_PATH = '/api/integrations/asaas';

/**
 * @typedef {Object} WorkerEnv
 * @property {string} [ASAAS_API_KEY]
 * @property {string} [ASAAS_BASE_URL]
 * @property {string} [SETUP_TOKEN]
 * @property {string} [FIREBASE_SERVICE_ACCOUNT]
 * @property {string} [PIX_ENCRYPTION_KEY]
 * @property {string} [APP_ORIGIN]
 */

/**
 * @callback AsaasFetch
 * @param {RequestInfo | URL} input
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */

/**
 * @callback FirebaseOperation
 * @param {string} accessToken
 * @param {AbortSignal} signal
 * @returns {Promise<Response>}
 */

/** @type {AsaasFetch} */
const defaultAsaasFetch = (input, init) => fetch(input, init);

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000',
};

/** @param {unknown} value @param {number} [status] */
function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** @param {string} actual @param {string} expected */
function equalToken(actual, expected) {
  let difference = actual.length ^ expected.length;
  for (let index = 0; index < 64; index += 1) {
    difference |= (actual.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function setupPage() {
  const nonce = crypto.randomUUID();
  return new Response(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Registro de Vendas · Teste Asaas e Firebase</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#f1f5f9;color:#0f172a;font:16px/1.5 system-ui,sans-serif;padding:28px 16px}main{max-width:620px;margin:24px auto;background:white;padding:28px;border-radius:20px;border:1px solid #cbd5e1}h1{font-size:25px;line-height:1.2;margin:12px 0}p{color:#475569}.tag{display:inline-block;background:#dbeafe;color:#1e40af;padding:4px 10px;border-radius:20px;font-weight:700;font-size:13px}label{display:block;font-weight:700;margin-bottom:8px}input{width:100%;padding:12px;font:inherit;border:1px solid #94a3b8;border-radius:10px}button{cursor:pointer;border:0;border-radius:10px;padding:12px 16px;font:inherit;font-weight:700;background:#0f172a;color:white}button.secondary{background:#e2e8f0;color:#0f172a}button:disabled{opacity:.6;cursor:wait}.actions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 18px}.primary{width:100%}code{font-size:14px;overflow-wrap:anywhere}ol{padding-left:22px;color:#475569}li{margin:8px 0}.result{padding:16px;border-radius:10px;margin-top:18px;background:#f1f5f9;white-space:pre-wrap}.result.success{background:#dcfce7;color:#14532d}.result.error{background:#fee2e2;color:#991b1b}.small{font-size:13px}a{color:#1d4ed8}
  </style>
</head>
<body>
<main>
  <span class="tag">Etapa 4 · Cadastro por usuário</span>
  <h1>Teste de conexão com o Asaas e Firebase</h1>
  <p>As conexões já foram validadas. Agora prepare a chave de proteção e clique em <strong>Testar proteção</strong>. Use o mesmo código <code>SETUP_TOKEN</code>.</p>
  <p>O teste de gravação cria um registro temporário de diagnóstico, atualiza, lê e apaga esse registro. Não acessa vendas, clientes ou parcelas. Os botões anteriores continuam disponíveis.</p>
  <form id="setup-form" autocomplete="off">
    <label for="setup-token">Código de configuração</label>
    <input id="setup-token" type="password" maxlength="64" autocomplete="off" spellcheck="false" autocapitalize="off" placeholder="Código de 64 caracteres" required aria-describedby="token-help">
    <div class="actions">
      <button type="button" class="secondary" id="generate">Gerar código</button>
      <button type="button" class="secondary" id="copy">Copiar código</button>
    </div>
    <p class="small" id="token-help">Cole somente o código SETUP_TOKEN. A chave do Asaas e o JSON do Firebase ficam nos Secrets da Cloudflare. Se precisar gerar outro código, cadastre-o como Secret SETUP_TOKEN e clique em Deploy antes de testar.</p>
    <div class="actions">
      <button type="submit" class="secondary" id="check">Testar Asaas</button>
      <button type="button" id="check-firebase">Testar Firebase</button>
      <button type="button" id="check-firebase-write">Testar gravação Firebase</button>
      <button type="button" id="check-encryption">Testar proteção</button>
    </div>
  </form>
  <div id="result" class="result" role="status" aria-live="polite">Aguardando configuração.</div>
  <hr>
  <h2>Preparar a proteção das chaves</h2>
  <p class="small">Somente na configuração inicial: gere uma chave abaixo, copie e cadastre como Secret <code>PIX_ENCRYPTION_KEY</code> na Cloudflare. Clique em Deploy. A chave é gerada neste navegador e não é enviada por esta página.</p>
  <p class="small">Se esse Secret já foi cadastrado, mantenha o valor existente: as integrações salvas dependem dele.</p>
  <input id="encryption-key" type="password" readonly autocomplete="off" aria-label="Chave de proteção gerada">
  <div class="actions">
    <button type="button" class="secondary" id="generate-encryption">Gerar chave de proteção</button>
    <button type="button" class="secondary" id="copy-encryption">Copiar chave de proteção</button>
  </div>
  <p class="small">Esta etapa permite salvar e testar a conexão Asaas Sandbox pelo perfil. A criação de cobranças e a confirmação automática serão habilitadas na próxima etapa.</p>
</main>
<script nonce="${nonce}">
  const token = document.getElementById('setup-token');
  const result = document.getElementById('result');
  const check = document.getElementById('check');
  const firebaseCheck = document.getElementById('check-firebase');
  const firebaseWriteCheck = document.getElementById('check-firebase-write');
  const encryptionCheck = document.getElementById('check-encryption');
  const encryptionKey = document.getElementById('encryption-key');
  function show(message, type = '') {
    result.className = 'result ' + type;
    result.textContent = message;
  }
  document.getElementById('generate').addEventListener('click', () => {
    if (token.value && !confirm('Gerar outro código? Será necessário atualizar o Secret SETUP_TOKEN na Cloudflare.')) return;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    token.value = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    show('Código gerado neste navegador. Copie-o e cadastre-o como Secret SETUP_TOKEN na Cloudflare.');
  });
  document.getElementById('copy').addEventListener('click', async () => {
    if (!/^[a-f0-9]{64}$/i.test(token.value)) return show('Gere um código de configuração primeiro.', 'error');
    try {
      await navigator.clipboard.writeText(token.value);
      show('Código copiado. Cadastre-o como Secret SETUP_TOKEN na Cloudflare e publique a configuração.');
    } catch {
      show('O navegador não permitiu copiar. Selecione e copie o código pelo campo acima.', 'error');
      token.type = 'text';
      token.select();
    }
  });
  async function runCheck(path, provider) {
    token.value = token.value.trim();
    if (!/^[a-f0-9]{64}$/i.test(token.value)) return show('Informe o código de configuração de 64 caracteres.', 'error');
    check.disabled = true;
    firebaseCheck.disabled = true;
    firebaseWriteCheck.disabled = true;
    encryptionCheck.disabled = true;
    show('Consultando ' + provider + '…');
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'X-Setup-Token': token.value },
        credentials: 'omit',
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(45000),
      });
      const data = await response.json();
      show(data.message || 'Não foi possível concluir o teste.', response.ok ? 'success' : 'error');
    } catch {
      show('Não foi possível concluir a consulta. Confira sua conexão e tente novamente.', 'error');
    } finally {
      check.disabled = false;
      firebaseCheck.disabled = false;
      firebaseWriteCheck.disabled = false;
      encryptionCheck.disabled = false;
    }
  }
  document.getElementById('setup-form').addEventListener('submit', event => {
    event.preventDefault();
    runCheck('/api/setup/check', 'o Asaas Sandbox');
  });
  firebaseCheck.addEventListener('click', () => runCheck('/api/setup/firebase-check', 'o Firebase'));
  firebaseWriteCheck.addEventListener('click', () => runCheck('/api/setup/firebase-write-check', 'as permissões de gravação do Firebase'));
  encryptionCheck.addEventListener('click', () => runCheck('/api/setup/encryption-check', 'a proteção das chaves'));
  document.getElementById('generate-encryption').addEventListener('click', () => {
    if (encryptionKey.value && !confirm('Gerar outra chave de proteção? Mantenha a chave existente se já houver integrações salvas.')) return;
    encryptionKey.value = Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join('');
    show('Chave de proteção gerada. Copie e cadastre como Secret PIX_ENCRYPTION_KEY na Cloudflare. Não envie esta chave em conversas.');
  });
  document.getElementById('copy-encryption').addEventListener('click', async () => {
    if (!encryptionKey.value) return show('Gere a chave de proteção primeiro.', 'error');
    try {
      await navigator.clipboard.writeText(encryptionKey.value);
      show('Chave copiada. Cadastre como Secret PIX_ENCRYPTION_KEY e clique em Deploy.');
    } catch {
      encryptionKey.type = 'text';
      encryptionKey.select();
      show('Selecione e copie a chave de proteção pelo campo acima.', 'error');
    }
  });
</script>
</body>
</html>`, {
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
    },
  });
}

/** @param {Uint8Array} bytes */
function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

class IntegrationError extends Error {
  /** @param {string} code @param {string} message @param {number} [status] */
  constructor(code, message, status = 503) { super(message); this.code = code; this.status = status; }
}

/** @param {unknown} value */
function decodeBase64url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid_base64url');
  const encoded = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(encoded + '='.repeat((4 - encoded.length % 4) % 4)), char => char.charCodeAt(0));
}

/** @param {WorkerEnv} env */
async function encryptionKey(env) {
  if (typeof env.PIX_ENCRYPTION_KEY !== 'string' || !TOKEN_PATTERN.test(env.PIX_ENCRYPTION_KEY.trim())) {
    throw new IntegrationError('integration_setup_required', 'A proteção da integração ainda precisa ser configurada pelo administrador.');
  }
  const raw = Uint8Array.from(env.PIX_ENCRYPTION_KEY.trim().match(/../g) || [], byte => parseInt(byte, 16));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** @param {WorkerEnv} env @param {string} uid @param {string} apiKey */
async function encryptAsaasKey(env, uid, apiKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode('vendas-aura:asaas:sandbox:v1:' + uid);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, await encryptionKey(env), new TextEncoder().encode(apiKey));
  return { cipher: base64url(new Uint8Array(encrypted)), iv: base64url(iv) };
}

/** @param {WorkerEnv} env @param {string} uid @param {Record<string, any>} fields */
async function decryptAsaasKey(env, uid, fields) {
  if (fields.environment?.stringValue !== 'sandbox' || fields.version?.integerValue !== '1') throw new IntegrationError('integration_format_invalid', 'A configuração salva precisa ser refeita.');
  try {
    const iv = decodeBase64url(fields.iv?.stringValue);
    if (iv.length !== 12) throw new Error('invalid_iv');
    const additionalData = new TextEncoder().encode('vendas-aura:asaas:sandbox:v1:' + uid);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData }, await encryptionKey(env), decodeBase64url(fields.cipher?.stringValue));
    return new TextDecoder('utf-8', { fatal: true }).decode(decrypted);
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    throw new IntegrationError('integration_key_unreadable', 'Não foi possível abrir a chave salva. Confira a configuração de proteção antes de substituir a integração.');
  }
}

/** @param {WorkerEnv} env */
async function checkEncryption(env) {
  try {
    const sample = crypto.randomUUID();
    const encrypted = await encryptAsaasKey(env, 'diagnostic-only', sample);
    const decrypted = await decryptAsaasKey(env, 'diagnostic-only', { environment: { stringValue: 'sandbox' }, version: { integerValue: '1' }, cipher: { stringValue: encrypted.cipher }, iv: { stringValue: encrypted.iv } });
    if (decrypted !== sample) throw new Error('encryption_check_failed');
    return json({ code: 'encryption_ready', encryptionReady: true, message: 'Proteção configurada e testada. O Worker consegue proteger e recuperar as chaves das integrações. A próxima etapa é conectar o Asaas Sandbox pelo perfil do sistema.' });
  } catch (error) {
    return json({ code: 'encryption_setup_required', message: error instanceof IntegrationError ? 'Cadastre a chave gerada nesta página como Secret PIX_ENCRYPTION_KEY e clique em Deploy.' : 'Não foi possível validar a proteção. Confira o Secret PIX_ENCRYPTION_KEY.' }, 503);
  }
}

/** @param {Request} request @param {AsaasFetch} fetchGoogle */
async function authenticatedUid(request, fetchGoogle) {
  const bearer = request.headers.get('Authorization') || '';
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
  const unauthorized = () => new IntegrationError('login_required', 'Entre novamente no sistema para configurar o Asaas.', 401);
  if (!token || token.length > 8192) throw unauthorized();
  let claims;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw unauthorized();
    const header = JSON.parse(new TextDecoder().decode(decodeBase64url(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(decodeBase64url(parts[1])));
    const now = Date.now() / 1000;
    if (header.alg !== 'RS256' || claims.aud !== FIREBASE_PROJECT || claims.iss !== 'https://securetoken.google.com/vendas-aura' || typeof claims.sub !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(claims.sub) || !Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 60 || !Number.isFinite(claims.auth_time) || claims.auth_time > now + 60) throw unauthorized();
  } catch { throw unauthorized(); }
  // O Google valida a autenticidade do ID token; decodificar sozinho não autoriza.
  const response = await fetchGoogle('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_WEB_API_KEY, {
    method: 'POST', headers: { 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ idToken: token }), redirect: 'manual', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    if ([400, 401].includes(response.status)) throw unauthorized();
    throw new IntegrationError('login_check_unavailable', 'Não foi possível validar seu acesso. Tente novamente.');
  }
  const data = JSON.parse(await response.text());
  const user = Array.isArray(data?.users) && data.users.length === 1 ? data.users[0] : null;
  if (!user || user.localId !== claims.sub || user.disabled === true || Number(user.validSince || 0) > claims.auth_time) throw unauthorized();
  return user.localId;
}

/** @param {Request} request */
async function integrationBody(request) {
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) throw new IntegrationError('invalid_body', 'Envie a configuração em formato JSON.', 400);
  const reader = request.body?.getReader();
  if (!reader) throw new IntegrationError('invalid_body', 'Informe a configuração da integração.', 400);
  let length = 0;
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 4096) { await reader.cancel(); throw new IntegrationError('invalid_body', 'A configuração enviada excedeu o tamanho permitido.', 413); }
    chunks.push(value);
  }
  try {
    const raw = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.length; }
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0 || Object.keys(data).some(key => !['apiKey', 'enabled'].includes(key)) || (data.enabled !== undefined && typeof data.enabled !== 'boolean') || (data.apiKey !== undefined && (typeof data.apiKey !== 'string' || data.apiKey.trim().length < 8 || data.apiKey.trim().length > 2048 || /[^\x21-\x7e]/.test(data.apiKey.trim())))) throw new Error('invalid_body');
    return data;
  } catch { throw new IntegrationError('invalid_body', 'Confira a chave e a configuração enviadas.', 400); }
}

/** @param {string} apiKey @param {AsaasFetch} fetchAsaas @param {AbortSignal} signal */
async function testUserAsaasKey(apiKey, fetchAsaas, signal) {
  const response = await fetchAsaas(SANDBOX_URL + '/pix/addressKeys?status=ACTIVE&limit=1', {
    method: 'GET', headers: { accept: 'application/json', access_token: apiKey, 'User-Agent': 'RegistroDeVendas-Pix-Sandbox-Profile/1.0' }, redirect: 'manual', signal,
  });
  if (!response.ok) throw new IntegrationError('asaas_key_rejected', [401, 403].includes(response.status) ? 'O Asaas não aceitou esta chave. Confira se ela pertence ao Sandbox e continua ativa.' : 'O Asaas não concluiu o teste. Tente novamente.', 502);
  const data = JSON.parse(await response.text());
  if (!Array.isArray(data?.data)) throw new IntegrationError('asaas_response_invalid', 'O Asaas respondeu em um formato inesperado.', 502);
  return data.data.some(key => key?.status === 'ACTIVE');
}

/** @param {Record<string, any> | null} document */
function integrationStatus(document) {
  const fields = document?.fields || {};
  return { configured: !!document, enabled: fields.enabled?.booleanValue === true, environment: 'sandbox', hasActivePixKey: fields.hasActivePixKey?.booleanValue === true, checkedAt: fields.checkedAt?.timestampValue || null };
}

/** @param {Request} request @param {WorkerEnv} env @param {AsaasFetch} fetchGoogle @param {AsaasFetch} fetchAsaas */
async function handleAsaasProfile(request, env, fetchGoogle, fetchAsaas) {
  const origin = request.headers.get('Origin');
  const appOrigin = typeof env.APP_ORIGIN === 'string' && env.APP_ORIGIN.trim() ? env.APP_ORIGIN.trim() : DEFAULT_APP_ORIGIN;
  const path = new URL(request.url).pathname;
  if (!origin || origin !== appOrigin) return json({ code: 'origin_denied', message: 'Abra a integração pelo sistema de vendas.' }, 403);
  const cors = { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
  const withCors = response => { for (const [key, value] of Object.entries(cors)) response.headers.set(key, value); return response; };
  const methods = path === INTEGRATION_PATH ? ['GET', 'PUT', 'DELETE'] : path === INTEGRATION_PATH + '/test' ? ['POST'] : [];
  if (!methods.length) return withCors(json({ code: 'not_found', message: 'Rota não encontrada.' }, 404));
  if (request.method === 'OPTIONS') {
    if (!methods.includes(request.headers.get('Access-Control-Request-Method') || '')) return withCors(json({ code: 'method_not_allowed', message: 'Método não permitido.' }, 405));
    return new Response(null, { status: 204, headers: { ...SECURITY_HEADERS, ...cors, 'Access-Control-Allow-Methods': methods.join(', '), 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600' } });
  }
  if (!methods.includes(request.method)) return withCors(json({ code: 'method_not_allowed', message: 'Método não permitido.' }, 405));
  try {
    const uid = await authenticatedUid(request, fetchGoogle);
    const input = request.method === 'PUT' ? await integrationBody(request) : null;
    const result = await checkFirebase(env, fetchGoogle, false, async (accessToken, signal) => {
      const headers = { accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken };
      const profilePath = 'artifacts/vendas-aura-main/users/' + uid + '/profile/info';
      const integrationPath = '_asaas_integrations/' + uid;
      const load = async resourcePath => {
        const response = await fetchGoogle(FIRESTORE_DOCUMENTS + resourcePath, { method: 'GET', headers, redirect: 'manual', signal });
        if (response.status === 404) return null;
        if (!response.ok) throw new IntegrationError('integration_read_failed', 'Não foi possível carregar a configuração da integração.');
        const data = JSON.parse(await response.text());
        if (data?.name !== 'projects/vendas-aura/databases/(default)/documents/' + resourcePath || !data.fields || typeof data.fields !== 'object' || Array.isArray(data.fields) || typeof data.updateTime !== 'string' || !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(data.updateTime)) throw new IntegrationError('integration_read_failed', 'Não foi possível conferir a configuração salva.');
        return data;
      };
      const profile = await load(profilePath);
      if (profile?.fields?.approved?.booleanValue !== true || !['', 'active'].includes(profile.fields.status?.stringValue || '')) throw new IntegrationError('account_not_approved', 'Sua conta precisa estar aprovada e ativa para configurar o Asaas.', 403);
      const current = await load(integrationPath);
      const versionParams = () => new URLSearchParams(current ? { 'currentDocument.updateTime': current.updateTime } : { 'currentDocument.exists': 'false' });
      const save = async fields => {
        const params = versionParams();
        for (const field of Object.keys(fields)) params.append('updateMask.fieldPaths', field);
        const response = await fetchGoogle(FIRESTORE_DOCUMENTS + integrationPath + '?' + params, { method: 'PATCH', headers, redirect: 'manual', signal, body: JSON.stringify({ fields }) });
        if ([409, 412].includes(response.status)) throw new IntegrationError('integration_changed', 'A configuração mudou durante esta operação. Atualize a tela e tente novamente.', 409);
        if (!response.ok) throw new IntegrationError('integration_save_failed', 'Não foi possível salvar a integração. Tente novamente.');
      };
      if (request.method === 'DELETE') {
        if (current) {
          const response = await fetchGoogle(FIRESTORE_DOCUMENTS + integrationPath + '?' + versionParams(), { method: 'DELETE', headers, redirect: 'manual', signal });
          if ([409, 412].includes(response.status)) throw new IntegrationError('integration_changed', 'A configuração mudou. Atualize a tela antes de remover.', 409);
          if (!response.ok && response.status !== 404) throw new IntegrationError('integration_delete_failed', 'Não foi possível remover a integração.');
        }
        return json({ ...integrationStatus(null), message: 'Chave da integração removida.' });
      }
      await encryptionKey(env);
      if (request.method === 'GET') {
        if (current) await decryptAsaasKey(env, uid, current.fields);
        return json(integrationStatus(current));
      }
      const now = new Date().toISOString();
      if (request.method === 'PUT' && input.enabled === false && input.apiKey === undefined) {
        if (!current) return json({ ...integrationStatus(null), message: 'Pix manual selecionado.' });
        await save({ enabled: { booleanValue: false }, updatedAt: { timestampValue: now } });
        return json({ ...integrationStatus(current), enabled: false, message: 'Pix manual selecionado. A chave da integração permanece protegida.' });
      }
      const apiKey = input?.apiKey !== undefined ? input.apiKey.trim() : current ? await decryptAsaasKey(env, uid, current.fields) : '';
      if (!apiKey) throw new IntegrationError('asaas_key_required', 'Informe a chave da API do Asaas Sandbox para conectar.', 400);
      const hasActivePixKey = await testUserAsaasKey(apiKey, fetchAsaas, signal);
      const fields = { hasActivePixKey: { booleanValue: hasActivePixKey }, checkedAt: { timestampValue: now }, updatedAt: { timestampValue: now } };
      if (request.method === 'PUT') {
        const encrypted = await encryptAsaasKey(env, uid, apiKey);
        Object.assign(fields, { environment: { stringValue: 'sandbox' }, version: { integerValue: '1' }, cipher: { stringValue: encrypted.cipher }, iv: { stringValue: encrypted.iv }, enabled: { booleanValue: input.enabled !== false } });
      }
      await save(fields);
      const status = integrationStatus({ fields: { ...(current?.fields || {}), ...fields } });
      return json({ ...status, message: hasActivePixKey ? 'Asaas Sandbox conectado. A chave está salva e o teste foi concluído.' : 'Asaas Sandbox conectado. Falta cadastrar ou ativar uma chave Pix na conta de testes.' });
    });
    return withCors(result);
  } catch (error) {
    return withCors(json({ code: error instanceof IntegrationError ? error.code : 'integration_unavailable', message: error instanceof IntegrationError ? error.message : 'Não foi possível concluir a operação do Asaas. Tente novamente.' }, error instanceof IntegrationError ? error.status : 503));
  }
}

/** @param {AsaasFetch} fetchGoogle @param {string} accessToken @param {AbortSignal} signal */
async function checkFirebaseWrite(fetchGoogle, accessToken, signal) {
  const probeId = crypto.randomUUID();
  const documentId = 'probe-' + probeId;
  const documentName = 'projects/vendas-aura/databases/(default)/documents/_pix_connection_check/' + documentId;
  const documentUrl = 'https://firestore.googleapis.com/v1/' + documentName;
  const headers = { accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken };
  let step = 'criação';
  let httpStatus = 0;
  let mayExist = false;
  let version = '';
  /** @param {string} method @param {string} url @param {unknown} [body] */
  async function call(method, url, body) {
    httpStatus = 0;
    const response = await fetchGoogle(url, {
      method, headers, redirect: 'manual', signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      httpStatus = response.status;
      if (step === 'criação' && [400, 401, 403, 404, 409, 429].includes(httpStatus)) mayExist = false;
      throw new Error('diagnostic_request_failed');
    }
    return response;
  }
  /** @param {Response} response @param {string} expectedStage @param {string} [expectedVersion] */
  async function readDocument(response, expectedStage, expectedVersion = '') {
    const data = JSON.parse(await response.text());
    if (!data || data.name !== documentName || data.fields?.connectionTest?.booleanValue !== true || data.fields?.probeId?.stringValue !== probeId || data.fields?.stage?.stringValue !== expectedStage || typeof data.updateTime !== 'string' || !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(data.updateTime) || (expectedVersion && data.updateTime !== expectedVersion)) {
      throw new Error('diagnostic_document_mismatch');
    }
    // Só aceitar a versão de um documento reconhecido como o nosso teste.
    version = data.updateTime;
  }
  try {
    mayExist = true;
    const created = await call('POST', FIRESTORE_PROBE_COLLECTION + '?documentId=' + documentId, {
      fields: { connectionTest: { booleanValue: true }, probeId: { stringValue: probeId }, stage: { stringValue: 'created' } },
    });
    await readDocument(created, 'created');
    step = 'atualização';
    const updateParams = new URLSearchParams({ 'updateMask.fieldPaths': 'stage', 'currentDocument.updateTime': version });
    const updated = await call('PATCH', documentUrl + '?' + updateParams, { fields: { stage: { stringValue: 'updated' } } });
    await readDocument(updated, 'updated');
    step = 'leitura';
    await readDocument(await call('GET', documentUrl), 'updated', version);
    step = 'exclusão';
    await call('DELETE', documentUrl + '?' + new URLSearchParams({ 'currentDocument.updateTime': version }));
    return json({
      code: 'firebase_write_connected', firebaseConnected: true, firestoreWrite: true, diagnosticCleaned: true,
      message: 'Teste completo do Firebase concluído. O Worker criou, atualizou, leu e excluiu um registro de diagnóstico. As permissões de leitura e gravação estão funcionando. Nenhum dado de vendas foi alterado.',
    });
  } catch (error) {
    let diagnosticCleaned = !mayExist;
    // Limpar somente o nosso documento e na última versão reconhecida.
    // Se outra operação o alterou, a precondição impede a exclusão.
    if (version) {
      try {
        const cleanup = await fetchGoogle(documentUrl + '?' + new URLSearchParams({ 'currentDocument.updateTime': version }), {
          method: 'DELETE', headers, redirect: 'manual', signal: AbortSignal.timeout(8000),
        });
        diagnosticCleaned = cleanup.ok || cleanup.status === 404;
      } catch { /* A resposta informará que a limpeza não foi confirmada. */ }
    }
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    const detail = httpStatus ? ' (HTTP ' + httpStatus + ')' : timedOut ? ' por tempo excedido' : '';
    const cleanupMessage = diagnosticCleaned ? ' O registro temporário foi limpo ou não chegou a ser criado.' : ' Pode ter ficado um registro de diagnóstico: ' + documentId + '. Guarde esta mensagem para conferir a limpeza.';
    return json({
      code: 'firebase_write_failed', step, diagnosticCleaned,
      message: 'O teste parou na etapa de ' + step + detail + '. Confira as permissões da conta de serviço no Firebase. Não é necessário liberar as regras públicas do banco.' + cleanupMessage,
    }, timedOut ? 504 : httpStatus === 429 ? 503 : 502);
  }
}

/** @param {WorkerEnv} env @param {AsaasFetch} fetchGoogle @param {boolean} [writeCheck] @param {FirebaseOperation | null} [operation] */
async function checkFirebase(env, fetchGoogle, writeCheck = false, operation = null) {
  if (typeof env.FIREBASE_SERVICE_ACCOUNT !== 'string' || !env.FIREBASE_SERVICE_ACCOUNT.trim()) {
    return json({ code: 'firebase_secret_required', message: 'Cadastre o JSON completo no Secret FIREBASE_SERVICE_ACCOUNT da Cloudflare e clique em Deploy.' }, 503);
  }
  let account;
  try {
    account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  } catch {
    return json({ code: 'firebase_json_invalid', message: 'O Secret FIREBASE_SERVICE_ACCOUNT não contém um JSON válido. Copie todo o conteúdo do arquivo baixado do Firebase, incluindo as chaves do início e do final.' }, 503);
  }
  if (!account || account.type !== 'service_account' || typeof account.client_email !== 'string' || !/^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(account.client_email) || typeof account.private_key !== 'string') {
    return json({ code: 'firebase_credentials_invalid', message: 'O JSON não contém uma conta de serviço completa. Use o arquivo gerado em Contas de serviço → Gerar nova chave privada.' }, 503);
  }
  if (account.project_id !== FIREBASE_PROJECT) {
    return json({ code: 'firebase_project_mismatch', message: 'A credencial precisa pertencer ao projeto vendas-aura. Gere a chave privada nesse projeto e atualize o Secret.' }, 503);
  }
  let assertion;
  try {
    const pem = account.private_key.replace(/\\n/g, '\n').trim();
    if (!pem.startsWith('-----BEGIN PRIVATE KEY-----') || !pem.endsWith('-----END PRIVATE KEY-----')) throw new Error('Invalid PKCS8');
    const der = Uint8Array.from(atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')), char => char.charCodeAt(0));
    const privateKey = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const encoder = new TextEncoder();
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT', ...(typeof account.private_key_id === 'string' ? { kid: account.private_key_id } : {}) };
    const claims = { iss: account.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: GOOGLE_TOKEN_URL, iat: now - 30, exp: now + 3300 };
    const unsigned = base64url(encoder.encode(JSON.stringify(header))) + '.' + base64url(encoder.encode(JSON.stringify(claims)));
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, encoder.encode(unsigned));
    assertion = unsigned + '.' + base64url(new Uint8Array(signature));
  } catch {
    return json({ code: 'firebase_private_key_invalid', message: 'Não foi possível ler a chave privada do Firebase. Atualize FIREBASE_SERVICE_ACCOUNT com o JSON completo, sem editar o campo private_key.' }, 503);
  }
  try {
    // Um único prazo para autenticação e leitura. Os destinos são fixos.
    const signal = AbortSignal.timeout(20000);
    const auth = await fetchGoogle(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
      redirect: 'manual',
      signal,
    });
    if (!auth.ok) {
      return json({ code: 'firebase_auth_failed', message: 'O Google não aceitou a credencial. Confira se a conta de serviço e a chave privada estão ativas e se o JSON foi copiado integralmente.' }, 502);
    }
    const token = JSON.parse(await auth.text());
    if (!token || typeof token.access_token !== 'string' || !token.access_token || /[\r\n]/.test(token.access_token)) {
      return json({ code: 'firebase_auth_response_invalid', message: 'O Google não retornou um token válido para o teste. Tente novamente.' }, 502);
    }
    if (operation) return await operation(token.access_token, signal);
    if (writeCheck) return checkFirebaseWrite(fetchGoogle, token.access_token, signal);
    // GET em coleção de diagnóstico. Não lê vendas nem grava documentos.
    const response = await fetchGoogle(FIRESTORE_PROBE_URL, {
      method: 'GET',
      headers: { accept: 'application/json', Authorization: 'Bearer ' + token.access_token },
      redirect: 'manual',
      signal,
    });
    if (!response.ok) {
      /** @type {Record<number, string>} */
      const messages = {
        401: 'O Firestore recusou a autenticação. Confira se a conta de serviço e a chave privada continuam ativas.',
        403: 'A autenticação funcionou, mas o Firestore recusou a leitura. Confira se o Firestore está ativo e se a conta de serviço tem permissão de acesso. Não é necessário liberar as regras públicas do banco.',
        404: 'O banco Firestore padrão não foi encontrado no projeto vendas-aura. Confira o projeto e o banco usado pelo sistema.',
        429: 'O Firebase limitou temporariamente as consultas. Aguarde e tente novamente.',
      };
      return json({ code: 'firebase_read_failed', message: messages[response.status] || 'O Firestore não concluiu a consulta. Tente novamente mais tarde.' }, response.status === 429 ? 503 : 502);
    }
    const data = JSON.parse(await response.text());
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.error || (data.documents !== undefined && !Array.isArray(data.documents))) {
      return json({ code: 'firebase_response_invalid', message: 'O Firestore respondeu em um formato inesperado. Tente novamente.' }, 502);
    }
    return json({
      code: 'firebase_connected',
      firebaseConnected: true,
      firestoreRead: true,
      mode: 'read-only',
      projectId: FIREBASE_PROJECT,
      message: 'Conexão com o Firebase funcionando. A credencial foi aceita e a leitura do Firestore está autorizada no projeto vendas-aura. Nenhum registro foi alterado. Use Testar gravação Firebase para conferir também a permissão de gravação.',
    });
  } catch (error) {
    if (error instanceof IntegrationError) return json({ code: error.code, message: error.message }, error.status);
    // Não devolver exceções, JSON da credencial, JWTs ou respostas do Google.
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return json({ code: 'firebase_timeout', message: 'A consulta ao Firebase excedeu 20 segundos. Aguarde um pouco e tente novamente.' }, 504);
    }
    if (error instanceof SyntaxError) {
      return json({ code: 'firebase_response_invalid', message: 'O Google ou o Firestore não retornou uma resposta JSON válida. Tente novamente.' }, 502);
    }
    return json({ code: 'firebase_connection_failed', message: 'Não foi possível concluir a conexão com o Firebase. Tente novamente; se persistir, confira o painel da Cloudflare.' }, 502);
  }
}

/** @param {{ fetchAsaas?: AsaasFetch, fetchGoogle?: AsaasFetch }} [options] */
export function createWorker(options = {}) {
  const fetchAsaas = options.fetchAsaas || defaultAsaasFetch;
  const fetchGoogle = options.fetchGoogle || defaultAsaasFetch;
  return {
    /** @param {Request} request @param {WorkerEnv} [env] */
    async fetch(request, env = {}) {
      const url = new URL(request.url);
      if (url.pathname === INTEGRATION_PATH || url.pathname.startsWith(INTEGRATION_PATH + '/')) return handleAsaasProfile(request, env, fetchGoogle, fetchAsaas);
      if (request.method === 'GET' && url.pathname === '/') return setupPage();
      if (request.method === 'GET' && url.pathname === '/health') {
        return json({ service: 'registro-vendas-pix-testes', stage: 'connection-only', environment: 'sandbox' });
      }
      if (!['/api/setup/check', '/api/setup/firebase-check', '/api/setup/firebase-write-check', '/api/setup/encryption-check'].includes(url.pathname)) {
        return json({ code: 'not_found', message: 'Rota não encontrada.' }, 404);
      }
      if (request.method !== 'POST') {
        return json({ code: 'method_not_allowed', message: 'Use os botões de teste desta página.' }, 405);
      }
      const origin = request.headers.get('Origin');
      if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
        return json({ code: 'origin_denied', message: 'Abra o teste pelo endereço do próprio Worker.' }, 403);
      }
      const expectedToken = typeof env.SETUP_TOKEN === 'string' ? env.SETUP_TOKEN.trim() : '';
      if (!TOKEN_PATTERN.test(expectedToken)) {
        return json({ code: 'setup_required', message: 'Cadastre o código gerado nesta página no Secret SETUP_TOKEN da Cloudflare e clique em Deploy.' }, 503);
      }
      const receivedToken = request.headers.get('X-Setup-Token') || '';
      if (!TOKEN_PATTERN.test(receivedToken) || !equalToken(receivedToken, expectedToken)) {
        return json({ code: 'unauthorized', message: 'O código de configuração não confere com o Secret SETUP_TOKEN da Cloudflare.' }, 401);
      }
      if (url.pathname === '/api/setup/firebase-check') return checkFirebase(env, fetchGoogle);
      if (url.pathname === '/api/setup/firebase-write-check') return checkFirebase(env, fetchGoogle, true);
      if (url.pathname === '/api/setup/encryption-check') return checkEncryption(env);
      const baseUrl = typeof env.ASAAS_BASE_URL === 'string' ? env.ASAAS_BASE_URL.trim().replace(/\/+$/, '') : '';
      if (baseUrl !== SANDBOX_URL) {
        return json({ code: 'sandbox_required', message: 'Este código funciona somente em testes. Configure ASAAS_BASE_URL como https://api-sandbox.asaas.com/v3.' }, 503);
      }
      const apiKey = typeof env.ASAAS_API_KEY === 'string' ? env.ASAAS_API_KEY.trim() : '';
      if (!apiKey || /[\r\n]/.test(apiKey)) {
        return json({ code: 'api_key_required', message: 'Cadastre a chave de API do Sandbox como Secret ASAAS_API_KEY e clique em Deploy.' }, 503);
      }
      try {
        const response = await fetchAsaas(`${SANDBOX_URL}/pix/addressKeys?status=ACTIVE&limit=1`, {
          method: 'GET',
          headers: {
            accept: 'application/json',
            access_token: apiKey,
            'User-Agent': 'RegistroDeVendas-Pix-Sandbox-Setup/1.0',
          },
          // Workers aceita somente manual/follow. Não seguir redirecionamentos com a chave.
          redirect: 'manual',
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) {
          /** @type {Record<number, string>} */
          const messages = {
            401: 'O Asaas não aceitou a chave de API. Confira se a chave é do Sandbox, está habilitada e foi copiada integralmente.',
            403: 'O Asaas recusou o acesso. Confira as permissões e eventuais restrições de IP da chave no Sandbox.',
            429: 'O Asaas limitou temporariamente as consultas. Aguarde e tente novamente.',
          };
          return json({
            code: 'asaas_unavailable',
            message: messages[response.status] || 'O Asaas não concluiu a consulta. Tente novamente mais tarde.',
          }, response.status === 429 ? 503 : 502);
        }
        const data = JSON.parse(await response.text());
        if (!data || !Array.isArray(data.data)) {
          return json({ code: 'invalid_response', message: 'O Asaas respondeu em um formato inesperado. Tente novamente mais tarde.' }, 502);
        }
        const hasActivePixKey = data.data.some(
          /** @param {{ status?: string } | null} key */
          key => key?.status === 'ACTIVE'
        );
        return json({
          code: hasActivePixKey ? 'ready_for_firebase' : 'pix_key_required',
          apiConnected: true,
          hasActivePixKey,
          environment: 'sandbox',
          message: hasActivePixKey
            ? 'Conexão com o Asaas Sandbox funcionando. Existe uma chave Pix ativa de teste. Use os botões do Firebase para conferir também o acesso ao banco.'
            : 'Conexão com o Asaas Sandbox funcionando. Falta cadastrar ou ativar uma chave Pix na conta de testes. Depois, repita este teste.',
        });
      } catch (error) {
        // Nunca retornar respostas brutas do provedor, tokens ou dados da conta.
        if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
          return json({ code: 'asaas_timeout', message: 'A consulta ao Asaas Sandbox excedeu 20 segundos. Aguarde um pouco e tente novamente.' }, 504);
        }
        if (error instanceof SyntaxError) {
          return json({ code: 'invalid_response', message: 'O Asaas não retornou uma resposta JSON válida. Tente novamente mais tarde.' }, 502);
        }
        return json({ code: 'connection_failed', message: 'Não foi possível consultar o Asaas Sandbox. Tente novamente; se persistir, confira o painel da Cloudflare.' }, 502);
      }
    },
  };
}

export default createWorker();
