// Etapa 7: conexão real por consulta; cobranças e cópias continuam no Sandbox.
// Fonte de manutenção. build.mjs gera os arquivos independentes para publicação.
import { createSandboxFlowHandlers } from './flow.js';
import { createProductionProfileHandler, PRODUCTION_PROFILE_PATH } from './production-profile.js';
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
const SANDBOX_CHECK_PATH = INTEGRATION_PATH + '/sandbox-charge';
const WEBHOOK_PATH = '/api/webhooks/asaas/sandbox/';
const PUBLIC_WORKER_URL = 'https://registro-vendas-pix-testes.washington-wn8.workers.dev';
const SANDBOX_EVENTS = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_REFUNDED', 'PAYMENT_DELETED', 'PAYMENT_OVERDUE', 'PAYMENT_RESTORED', 'PAYMENT_UPDATED'];

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
  <span class="tag">Etapa 7 · Conexão real e testes Sandbox</span>
  <h1>Teste de conexão com o Asaas e Firebase</h1>
  <p>Em <strong>Meu Perfil</strong>, conecte a conta real do Asaas por consulta e mantenha os testes Sandbox disponíveis. Esta etapa ainda não ativa recebimentos reais. Os diagnósticos anteriores continuam disponíveis abaixo. Use o mesmo código <code>SETUP_TOKEN</code>.</p>
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
  <p class="small">Depois de publicar o código, abra o perfil no sistema para criar uma cobrança fictícia e simular o pagamento. O teste não altera vendas ou parcelas.</p>
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

function compactHome() {
  return new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Registro de Vendas · Asaas Sandbox</title><main style="max-width:560px;margin:40px auto;padding:24px;font:16px/1.5 system-ui"><h1>Conexão Asaas · Etapa 7</h1><p>Abra Meu Perfil para conectar a conta real do Asaas por consulta e retomar os testes Sandbox. A conexão de Produção ainda não cria cobranças reais.</p><p>Os testes usam cópias separadas. Vendas, parcelas e estoque reais não são alterados.</p><a href="https://washingtonbarbalho.github.io/registrodevendas/?v=104">Abrir o sistema</a></main></html>', { headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" } });
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
async function authenticatedUser(request, fetchGoogle) {
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
  return { uid: user.localId, email: typeof user.email === 'string' && user.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) ? user.email : '' };
}

/** @param {AsaasFetch} fetchGoogle @param {Record<string,string>} headers @param {AbortSignal} signal @param {string} path */
async function loadPrivateDocument(fetchGoogle, headers, signal, path) {
  const response = await fetchGoogle(FIRESTORE_DOCUMENTS + path, { method: 'GET', headers, redirect: 'manual', signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new IntegrationError('integration_read_failed', 'Não foi possível carregar a configuração da integração.');
  const data = JSON.parse(await response.text());
  if (data?.name !== 'projects/vendas-aura/databases/(default)/documents/' + path || !data.fields || typeof data.fields !== 'object' || Array.isArray(data.fields) || typeof data.updateTime !== 'string' || !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(data.updateTime)) throw new IntegrationError('integration_read_failed', 'Não foi possível conferir a configuração salva.');
  return data;
}

/** @param {WorkerEnv} env @param {string} message */
async function sandboxTag(env, message) {
  await encryptionKey(env);
  const raw = Uint8Array.from(env.PIX_ENCRYPTION_KEY.trim().match(/../g) || [], byte => parseInt(byte, 16));
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

const stringField = value => ({ stringValue: value });
const timeField = value => ({ timestampValue: value });
const boolField = value => ({ booleanValue: value });
const fieldString = (document, field) => document?.fields?.[field]?.stringValue || '';
const providerId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{5,128}$/.test(value);

/** @param {AsaasFetch} fetchAsaas @param {string} apiKey @param {AbortSignal} signal */
function sandboxApi(fetchAsaas, apiKey, signal) {
  return async (path, method = 'GET', body) => {
    const response = await fetchAsaas(SANDBOX_URL + path, {
      method, redirect: 'manual', signal,
      headers: { accept: 'application/json', access_token: apiKey, 'User-Agent': 'RegistroDeVendas-Pix-Sandbox/2.0', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const error = new IntegrationError('sandbox_provider_failed', [401, 403].includes(response.status) ? 'O Asaas recusou o acesso. Confira as permissões da chave Sandbox para clientes, cobranças e Webhooks.' : response.status === 400 ? 'O Asaas recusou os dados do teste. Confira se a conta Sandbox está aprovada e permite cobranças Pix e Webhooks.' : 'O Asaas não concluiu o teste. Aguarde um pouco e tente novamente.', 502);
      error.definitive = [400, 401, 403, 404, 422, 429].includes(response.status);
      throw error;
    }
    try { return JSON.parse(await response.text()); }
    catch { throw new IntegrationError('sandbox_response_invalid', 'O Asaas respondeu em um formato inesperado. Reabra o perfil para conferir o andamento do teste.'); }
  };
}

function sandboxStatus(document, message = '') {
  const fields = document?.fields || {};
  const status = fieldString(document, 'providerStatus');
  const complete = fields.setupComplete?.booleanValue === true;
  const received = status === 'RECEIVED';
  const webhookVerified = !!fields.webhookAt?.timestampValue;
  return {
    environment: 'sandbox', created: !!fieldString(document, 'paymentId'), ready: complete,
    status: status || 'NOT_CREATED', received, webhookVerified, testComplete: complete && received && webhookVerified,
    paymentId: fieldString(document, 'paymentId'), amount: Number(fields.amountCents?.integerValue || 500) / 100,
    payload: complete ? fieldString(document, 'payload') : '',
    encodedImage: complete ? fieldString(document, 'encodedImage') : '',
    expirationDate: fieldString(document, 'expirationDate'),
    message: message || (complete && received && webhookVerified ? 'Teste completo: o pagamento simulado foi recebido e o retorno automático do Asaas foi validado. Nenhuma venda ou parcela foi alterada.' : complete && received ? 'O Asaas indica recebimento. Aguardando o retorno automático autenticado.' : status === 'CONFIRMED' ? 'O Asaas confirmou a simulação. Aguardando o recebimento e o retorno automático.' : complete && !['PENDING', 'OVERDUE', 'RECEIVED'].includes(status) ? 'A cobrança de teste foi alterada no Asaas e não permite simular outro pagamento. Nenhuma venda ou parcela foi alterada.' : complete ? 'Cobrança de teste criada. Simule o pagamento para validar o retorno automático.' : 'Prepare uma cobrança isolada de R$ 5,00 no Sandbox. Nenhum valor real será movimentado.'),
  };
}

function checkSandboxPayment(payment, document) {
  if (!providerId(payment?.id) || (fieldString(document, 'paymentId') && payment.id !== fieldString(document, 'paymentId')) || payment.customer !== fieldString(document, 'customerId') || payment.externalReference !== fieldString(document, 'reference') || payment.billingType !== 'PIX' || payment.value !== Number(document?.fields?.amountCents?.integerValue || 500) / 100 || typeof payment.status !== 'string' || !/^[A-Z_]{3,64}$/.test(payment.status)) {
    throw new IntegrationError('sandbox_payment_mismatch', 'Os dados da cobrança não correspondem ao teste. Nenhuma confirmação foi registrada.', 409);
  }
}

/** Cobrança de homologação sem vínculo com vendas, parcelas, estoque ou clientes do sistema. */
async function handleSandboxCheck({ request, user, env, current, headers, signal, load, fetchGoogle, fetchAsaas, checkPath }) {
  if (!current || current.fields.enabled?.booleanValue !== true) throw new IntegrationError('sandbox_disabled', 'Ative a conexão Asaas Sandbox no perfil antes de testar.', 409);
  const apiKey = await decryptAsaasKey(env, user.uid, current.fields);
  const keyTag = await sandboxTag(env, 'aura:sandbox-key:v1:' + apiKey);
  const path = checkPath || '_asaas_sandbox_checks/' + user.uid;
  let document = await load(path);
  if (fieldString(document, 'keyTag') !== keyTag) document = null;
  const action = new URL(request.url).pathname;
  if (request.method === 'GET') return json(sandboxStatus(document));
  // Endpoints de ação não aceitam valores, clientes ou IDs enviados pelo navegador.
  if (request.body) {
    const reader = request.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value.length) { await reader.cancel(); throw new IntegrationError('invalid_body', 'O teste usa somente a cobrança preparada pelo sistema.', 400); }
    }
  }
  const api = sandboxApi(fetchAsaas, apiKey, signal);
  if (action === SANDBOX_CHECK_PATH + '/simulate') {
    if (!document?.fields?.setupComplete?.booleanValue) throw new IntegrationError('sandbox_not_ready', 'Prepare a cobrança de teste antes de simular o pagamento.', 409);
    const paymentId = fieldString(document, 'paymentId');
    const payment = await api('/payments/' + paymentId);
    checkSandboxPayment(payment, document);
    if (payment.deleted === true || !['PENDING', 'OVERDUE', 'CONFIRMED', 'RECEIVED'].includes(payment.status)) throw new IntegrationError('sandbox_status_invalid', 'Esta cobrança não permite a simulação. Confira o status no painel Asaas Sandbox.', 409);
    if (['PENDING', 'OVERDUE'].includes(payment.status)) await api('/sandbox/payment/' + paymentId + '/confirm', 'POST');
    // A simulação não grava o resultado: o sucesso depende do Webhook validado.
    return json(sandboxStatus(document, 'Simulação enviada ao Asaas Sandbox. Aguarde o retorno automático nesta tela.'));
  }
  if (!user.email) throw new IntegrationError('sandbox_email_required', 'Sua conta precisa ter um e-mail válido para configurar o retorno do Asaas.', 409);
  const original = await load(path);
  document = fieldString(original, 'keyTag') === keyTag ? original : null;
  let version = original?.updateTime || '';
  if (document && Date.parse(document.fields.leaseUntil?.timestampValue || '') > Date.now()) throw new IntegrationError('sandbox_busy', 'A preparação já está em andamento. Aguarde um minuto antes de tentar novamente.', 409);
  const save = async fields => {
    const params = new URLSearchParams(version ? { 'currentDocument.updateTime': version } : { 'currentDocument.exists': 'false' });
    for (const field of Object.keys(fields)) params.append('updateMask.fieldPaths', field);
    const response = await fetchGoogle(FIRESTORE_DOCUMENTS + path + '?' + params, { method: 'PATCH', headers, redirect: 'manual', signal, body: JSON.stringify({ fields }) });
    if ([409, 412].includes(response.status)) throw new IntegrationError('sandbox_changed', 'O teste mudou durante esta operação. Atualize a tela e tente novamente.', 409);
    if (!response.ok) throw new IntegrationError('sandbox_save_failed', 'Não foi possível salvar o andamento do teste. Aguarde um minuto e tente novamente.');
    const next = JSON.parse(await response.text());
    if (next?.name !== 'projects/vendas-aura/databases/(default)/documents/' + path || !next.updateTime || !next.fields) throw new IntegrationError('sandbox_save_failed', 'Não foi possível conferir o andamento do teste. Aguarde um minuto e tente novamente.');
    document = next;
    version = next.updateTime;
  };
  const until = new Date(Date.now() + 90000).toISOString();
  if (!document) {
    const reset = { keyTag: stringField(keyTag), reference: stringField('aura-sandbox-' + crypto.randomUUID()), customerId: stringField(''), paymentId: stringField(''), webhookId: stringField(''), pendingCreate: stringField(''), providerStatus: stringField(''), payload: stringField(''), encodedImage: stringField(''), expirationDate: stringField(''), setupComplete: boolField(false), webhookAt: { nullValue: null }, lastEventId: stringField(''), leaseUntil: timeField(until) };
    await save(reset);
  } else await save({ leaseUntil: timeField(until) });
  try {
    const reference = fieldString(document, 'reference');
    const find = async (collection, externalReference, matches) => {
      const list = await api('/' + collection + '?externalReference=' + encodeURIComponent(externalReference) + '&limit=2');
      if (!Array.isArray(list?.data) || list.data.length > 1 || list.hasMore === true || list.data.some(item => !matches(item))) throw new IntegrationError('sandbox_duplicates', 'Não foi possível identificar um único registro para este teste. Confira os registros de teste no Asaas Sandbox.', 409);
      return list.data[0] || null;
    };
    const create = async (kind, providerPath, body, recover, validate, checkpoint) => {
      const found = await recover();
      if (found) { validate(found); await save({ ...checkpoint(found), pendingCreate: stringField('') }); return; }
      if (fieldString(document, 'pendingCreate') === kind) throw new IntegrationError('sandbox_creation_unknown', 'Uma criação anterior ficou sem confirmação. O sistema evitou repetir a cobrança. Confira o painel Asaas Sandbox e envie esta mensagem para continuarmos.', 409);
      await save({ pendingCreate: stringField(kind) });
      let created;
      try { created = await api(providerPath, 'POST', body); }
      catch (error) { if (error.definitive) await save({ pendingCreate: stringField('') }); throw error; }
      validate(created);
      await save({ ...checkpoint(created), pendingCreate: stringField('') });
    };
    const webhookUrl = PUBLIC_WORKER_URL + WEBHOOK_PATH + user.uid;
    const authToken = await sandboxTag(env, 'aura:sandbox-webhook:v1:' + user.uid);
    const webhookBody = { name: 'Registro de Vendas - teste isolado', url: webhookUrl, email: user.email, enabled: true, interrupted: false, authToken, events: SANDBOX_EVENTS, sendType: 'SEQUENTIALLY', apiVersion: 3 };
    const hooks = await api('/webhooks?limit=100');
    if (!Array.isArray(hooks?.data) || hooks.hasMore === true) throw new IntegrationError('sandbox_webhook_invalid', 'Não foi possível conferir os Webhooks da conta Sandbox.');
    const ownHooks = hooks.data.filter(hook => hook.url === webhookUrl);
    if (ownHooks.length > 1 || (ownHooks.length && !providerId(ownHooks[0].id))) throw new IntegrationError('sandbox_webhook_invalid', 'Existe mais de um retorno para este teste. Confira os Webhooks no Asaas Sandbox.', 409);
    if (ownHooks.length) {
      const hook = await api('/webhooks/' + ownHooks[0].id, 'PUT', webhookBody);
      if (hook?.id !== ownHooks[0].id || hook.url !== webhookUrl) throw new IntegrationError('sandbox_webhook_invalid', 'Não foi possível confirmar a configuração do retorno automático.');
      await save({ webhookId: stringField(hook.id), ...(fieldString(document, 'pendingCreate') === 'webhook' ? { pendingCreate: stringField('') } : {}) });
    } else {
      await create('webhook', '/webhooks', webhookBody,
        async () => null,
        hook => { if (!providerId(hook?.id) || hook.url !== webhookUrl) throw new IntegrationError('sandbox_webhook_invalid', 'Não foi possível conferir o retorno automático.'); },
        hook => ({ webhookId: stringField(hook.id) }));
    }
    if (!fieldString(document, 'customerId')) {
      const validate = customer => { if (!providerId(customer?.id) || customer.externalReference !== reference || customer.deleted === true) throw new IntegrationError('sandbox_customer_invalid', 'Não foi possível conferir o cliente fictício de teste.'); };
      await create('customer', '/customers', { name: 'Cliente Teste Registro de Vendas', cpfCnpj: '24971563792', notificationDisabled: true, externalReference: reference },
        () => find('customers', reference, customer => customer.externalReference === reference), validate,
        customer => ({ customerId: stringField(customer.id) }));
    }
    if (!fieldString(document, 'paymentId')) {
      const dateParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      const dueDate = ['year', 'month', 'day'].map(type => dateParts.find(part => part.type === type)?.value).join('-');
      await create('payment', '/payments', { customer: fieldString(document, 'customerId'), billingType: 'PIX', value: Number(document.fields.amountCents?.integerValue || 500) / 100, dueDate, description: 'Teste isolado do Registro de Vendas - sem valor real', externalReference: reference, interest: { value: 0 }, fine: { value: 0 }, discount: { value: 0 } },
        () => find('payments', reference, payment => payment.externalReference === reference),
        payment => checkSandboxPayment(payment, document), payment => ({ paymentId: stringField(payment.id), providerStatus: stringField(payment.status) }));
    }
    const payment = await api('/payments/' + fieldString(document, 'paymentId'));
    checkSandboxPayment(payment, document);
    if (payment.deleted === true) throw new IntegrationError('sandbox_payment_deleted', 'A cobrança de teste foi excluída no Asaas Sandbox. Envie esta mensagem para prepararmos outro teste.', 409);
    let qrFields = {};
    if (!document.fields.setupComplete?.booleanValue) {
      const qr = await api('/payments/' + payment.id + '/pixQrCode');
      if (typeof qr?.payload !== 'string' || qr.payload.length < 30 || qr.payload.length > 8192 || typeof qr.encodedImage !== 'string' || !/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(qr.encodedImage) || qr.encodedImage.length > 200000 || typeof qr.expirationDate !== 'string' || qr.expirationDate.length > 64) throw new IntegrationError('sandbox_qr_invalid', 'A cobrança existe, mas o Asaas ainda não retornou um QR Code válido. Tente preparar o teste novamente.');
      qrFields = { payload: stringField(qr.payload), encodedImage: stringField(qr.encodedImage), expirationDate: stringField(qr.expirationDate) };
    }
    await save({ ...qrFields, setupComplete: boolField(true), providerStatus: stringField(payment.status), leaseUntil: timeField(new Date(0).toISOString()) });
    return json(sandboxStatus(document));
  } catch (error) {
    // A precondição não permite liberar a trava de outra requisição.
    // pendingCreate permanece salvo quando a criação pode ter ocorrido no provedor.
    try { await save({ leaseUntil: timeField(new Date(0).toISOString()) }); } catch { /* Em timeout a trava expira sozinha. */ }
    throw error;
  }
}

async function handleSandboxWebhook(request, env, uid, fetchGoogle, fetchAsaas, flow) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return json({ code: 'not_found' }, 404);
  if (request.method !== 'POST') return json({ code: 'method_not_allowed' }, 405);
  try {
    const token = request.headers.get('asaas-access-token') || '';
    if (!TOKEN_PATTERN.test(token) || !equalToken(token, await sandboxTag(env, 'aura:sandbox-webhook:v1:' + uid))) return json({ code: 'unauthorized' }, 401);
    if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return json({ code: 'invalid_body' }, 400);
    const reader = request.body?.getReader();
    const chunks = [];
    let length = 0;
    if (!reader) return json({ code: 'invalid_body' }, 400);
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 131072) { await reader.cancel(); return json({ code: 'invalid_body' }, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let event;
    try { event = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { return json({ code: 'invalid_body' }, 400); }
    if (!event || typeof event.id !== 'string' || event.id.length > 200 || !event.id || !providerId(event.payment?.id)) return json({ code: 'invalid_event' }, 400);
    if (!SANDBOX_EVENTS.includes(event.event)) return json({ accepted: true });
    return await checkFirebase(env, fetchGoogle, false, async (accessToken, signal) => {
      const headers = { accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken };
      const load = path => loadPrivateDocument(fetchGoogle, headers, signal, path);
      const path = '_asaas_sandbox_checks/' + uid;
      const document = await load(path);
      if (!document || event.payment.id !== fieldString(document, 'paymentId')) return flow.handleWebhook({ user: { uid }, event, env, headers, signal, load, fetchGoogle, fetchAsaas });
      if (fieldString(document, 'lastEventId') === event.id) return json({ accepted: true });
      const current = await load('_asaas_integrations/' + uid);
      const profile = await load('artifacts/vendas-aura-main/users/' + uid + '/profile/info');
      if (!current?.fields?.enabled?.booleanValue || profile?.fields?.approved?.booleanValue !== true || !['', 'active'].includes(profile.fields.status?.stringValue || '')) return json({ accepted: true });
      const apiKey = await decryptAsaasKey(env, uid, current.fields);
      if (fieldString(document, 'keyTag') !== await sandboxTag(env, 'aura:sandbox-key:v1:' + apiKey)) return json({ accepted: true });
      const api = sandboxApi(fetchAsaas, apiKey, signal);
      const payment = await api('/payments/' + fieldString(document, 'paymentId'));
      // O JSON do evento não é suficiente: conferir a cobrança na própria API.
      checkSandboxPayment(payment, document);
      const fields = { providerStatus: stringField(payment.deleted === true ? 'DELETED' : payment.status), webhookAt: timeField(new Date().toISOString()), lastEventId: stringField(event.id) };
      const params = new URLSearchParams({ 'currentDocument.updateTime': document.updateTime });
      for (const field of Object.keys(fields)) params.append('updateMask.fieldPaths', field);
      const response = await fetchGoogle(FIRESTORE_DOCUMENTS + path + '?' + params, { method: 'PATCH', headers, redirect: 'manual', signal, body: JSON.stringify({ fields }) });
      if (!response.ok) throw new IntegrationError('sandbox_webhook_retry', 'Retorno ainda não registrado. Repetir entrega.', 503);
      return json({ accepted: true });
    });
  } catch (error) {
    return json({ code: error instanceof IntegrationError ? error.code : 'sandbox_webhook_retry' }, error instanceof IntegrationError ? error.status : 503);
  }
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
  return { configured: !!document, enabled: fields.enabled?.booleanValue === true, environment: 'sandbox', hasActivePixKey: fields.hasActivePixKey?.booleanValue === true, checkedAt: fields.checkedAt?.timestampValue || null, flowVersion: 1, pendingCharges: Number(fields.pendingCharges?.integerValue || 0) };
}

/** @param {Request} request @param {WorkerEnv} env @param {AsaasFetch} fetchGoogle @param {AsaasFetch} fetchAsaas */
async function handleAsaasProfile(request, env, fetchGoogle, fetchAsaas, flow) {
  const origin = request.headers.get('Origin');
  const appOrigin = typeof env.APP_ORIGIN === 'string' && env.APP_ORIGIN.trim() ? env.APP_ORIGIN.trim() : DEFAULT_APP_ORIGIN;
  const path = new URL(request.url).pathname;
  if (!origin || origin !== appOrigin) return json({ code: 'origin_denied', message: 'Abra a integração pelo sistema de vendas.' }, 403);
  const cors = { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
  const withCors = response => { for (const [key, value] of Object.entries(cors)) response.headers.set(key, value); return response; };
  const methods = path === INTEGRATION_PATH ? ['GET', 'PUT', 'DELETE'] : path === SANDBOX_CHECK_PATH ? ['GET', 'POST'] : [INTEGRATION_PATH + '/test', SANDBOX_CHECK_PATH + '/simulate'].includes(path) ? ['POST'] : flow.methods(path);
  if (!methods.length) return withCors(json({ code: 'not_found', message: 'Rota não encontrada.' }, 404));
  if (request.method === 'OPTIONS') {
    if (!methods.includes(request.headers.get('Access-Control-Request-Method') || '')) return withCors(json({ code: 'method_not_allowed', message: 'Método não permitido.' }, 405));
    return new Response(null, { status: 204, headers: { ...SECURITY_HEADERS, ...cors, 'Access-Control-Allow-Methods': methods.join(', '), 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600' } });
  }
  if (!methods.includes(request.method)) return withCors(json({ code: 'method_not_allowed', message: 'Método não permitido.' }, 405));
  try {
    const user = await authenticatedUser(request, fetchGoogle);
    const uid = user.uid;
    const input = request.method === 'PUT' ? await integrationBody(request) : null;
    const result = await checkFirebase(env, fetchGoogle, false, async (accessToken, signal) => {
      const headers = { accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken };
      const profilePath = 'artifacts/vendas-aura-main/users/' + uid + '/profile/info';
      const integrationPath = '_asaas_integrations/' + uid;
      const load = resourcePath => loadPrivateDocument(fetchGoogle, headers, signal, resourcePath);
      const profile = await load(profilePath);
      if (profile?.fields?.approved?.booleanValue !== true || !['', 'active'].includes(profile.fields.status?.stringValue || '')) throw new IntegrationError('account_not_approved', 'Sua conta precisa estar aprovada e ativa para configurar o Asaas.', 403);
      const current = await load(integrationPath);
      if (flow.matches(path)) return flow.handleRequest({ request, user, env, current, headers, signal, load, fetchGoogle, fetchAsaas });
      if (path === SANDBOX_CHECK_PATH || path === SANDBOX_CHECK_PATH + '/simulate') return handleSandboxCheck({ request, user, env, current, headers, signal, load, fetchGoogle, fetchAsaas });
      if (Number(current?.fields?.pendingCharges?.integerValue || 0) > 0 && (request.method === 'DELETE' || request.method === 'PUT' && (input.enabled === false || input.apiKey !== undefined))) throw new IntegrationError('pending_charges', 'Conclua ou cancele os testes pendentes no perfil antes de alterar a chave ou usar Pix manual.', 409);
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
    const signal = AbortSignal.timeout(operation ? 40000 : 20000);
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
      return json({ code: 'firebase_timeout', message: 'A consulta ao Firebase excedeu ' + (operation ? '40' : '20') + ' segundos. Aguarde um pouco e tente novamente.' }, 504);
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
  const flow = createSandboxFlowHandlers({ IntegrationError, json, sandboxTag, decryptAsaasKey, sandboxApi, handleSandboxCheck, FIRESTORE_DOCUMENTS });
  const productionProfile = createProductionProfileHandler({ IntegrationError, json, authenticatedUser, checkFirebase, loadPrivateDocument, encryptionKey, base64url, decodeBase64url, integrationBody, DEFAULT_APP_ORIGIN, FIRESTORE_DOCUMENTS });
  return {
    /** @param {Request} request @param {WorkerEnv} [env] */
    async fetch(request, env = {}) {
      const url = new URL(request.url);
      if (url.pathname === PRODUCTION_PROFILE_PATH || url.pathname.startsWith(PRODUCTION_PROFILE_PATH + '/')) return productionProfile(request, env, fetchGoogle, fetchAsaas);
      if (url.pathname.startsWith(WEBHOOK_PATH)) return handleSandboxWebhook(request, env, url.pathname.slice(WEBHOOK_PATH.length), fetchGoogle, fetchAsaas, flow);
      if (url.pathname === INTEGRATION_PATH || url.pathname.startsWith(INTEGRATION_PATH + '/')) return handleAsaasProfile(request, env, fetchGoogle, fetchAsaas, flow);
      if (request.method === 'GET' && url.pathname === '/') return __MOBILE_BUILD__ ? compactHome() : setupPage();
      if (request.method === 'GET' && url.pathname === '/health') {
        return json({ service: 'registro-vendas-pix-testes', stage: 'sandbox-charge-test', environment: 'sandbox' });
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
