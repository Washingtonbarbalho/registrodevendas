// Etapa 1: diagnóstico do Asaas Sandbox, sem criar cobranças ou alterar vendas.
// Arquivo independente: pode ser colado no editor de código do Cloudflare Worker.
const SANDBOX_URL = 'https://api-sandbox.asaas.com/v3';
const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000',
};

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

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
  <title>Registro de Vendas · Teste Asaas</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#f1f5f9;color:#0f172a;font:16px/1.5 system-ui,sans-serif;padding:28px 16px}main{max-width:620px;margin:24px auto;background:white;padding:28px;border-radius:20px;border:1px solid #cbd5e1}h1{font-size:25px;line-height:1.2;margin:12px 0}p{color:#475569}.tag{display:inline-block;background:#dbeafe;color:#1e40af;padding:4px 10px;border-radius:20px;font-weight:700;font-size:13px}label{display:block;font-weight:700;margin-bottom:8px}input{width:100%;padding:12px;font:inherit;border:1px solid #94a3b8;border-radius:10px}button{cursor:pointer;border:0;border-radius:10px;padding:12px 16px;font:inherit;font-weight:700;background:#0f172a;color:white}button.secondary{background:#e2e8f0;color:#0f172a}button:disabled{opacity:.6;cursor:wait}.actions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 18px}.primary{width:100%}code{font-size:14px;overflow-wrap:anywhere}ol{padding-left:22px;color:#475569}li{margin:8px 0}.result{padding:16px;border-radius:10px;margin-top:18px;background:#f1f5f9;white-space:pre-wrap}.result.success{background:#dcfce7;color:#14532d}.result.error{background:#fee2e2;color:#991b1b}.small{font-size:13px}a{color:#1d4ed8}
  </style>
</head>
<body>
<main>
  <span class="tag">Asaas Sandbox · Etapa de conexão</span>
  <h1>Teste de conexão com o Asaas</h1>
  <p>Este teste consulta se existe uma chave Pix ativa no ambiente de testes. Nenhuma cobrança, venda ou transferência será criada.</p>
  <ol>
    <li>Gere um código de configuração abaixo e copie-o.</li>
    <li>No painel da Cloudflare, abra este Worker em <strong>Settings → Variables and Secrets</strong>. Adicione um <strong>Secret</strong> chamado <code>SETUP_TOKEN</code> com o código gerado. Clique em <strong>Deploy</strong>.</li>
    <li>Volte a esta página e clique em <strong>Testar conexão</strong>. Se tiver fechado a página, cole o código salvo no campo abaixo.</li>
  </ol>
  <form id="setup-form" autocomplete="off">
    <label for="setup-token">Código de configuração</label>
    <input id="setup-token" type="password" maxlength="64" autocomplete="off" spellcheck="false" autocapitalize="off" placeholder="Código de 64 caracteres" required aria-describedby="token-help">
    <div class="actions">
      <button type="button" class="secondary" id="generate">Gerar código</button>
      <button type="button" class="secondary" id="copy">Copiar código</button>
    </div>
    <p class="small" id="token-help">Este código protege o teste. A chave de API do Asaas fica somente no Secret <code>ASAAS_API_KEY</code> da Cloudflare. Não cole a chave do Asaas neste formulário.</p>
    <button class="primary" type="submit" id="check">Testar conexão</button>
  </form>
  <div id="result" class="result" role="status" aria-live="polite">Aguardando configuração.</div>
  <p class="small">A confirmação automática das vendas e parcelas será implementada na próxima etapa, após validar a conexão e configurar o acesso ao Firebase.</p>
</main>
<script nonce="${nonce}">
  const token = document.getElementById('setup-token');
  const result = document.getElementById('result');
  const check = document.getElementById('check');
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
  document.getElementById('setup-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!/^[a-f0-9]{64}$/i.test(token.value)) return show('Informe o código de configuração de 64 caracteres.', 'error');
    check.disabled = true;
    show('Consultando o Asaas Sandbox…');
    try {
      const response = await fetch('/api/setup/check', {
        method: 'POST',
        headers: { 'X-Setup-Token': token.value },
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      });
      const data = await response.json();
      show(data.message || 'Não foi possível concluir o teste.', response.ok ? 'success' : 'error');
    } catch {
      show('Não foi possível concluir a consulta. Confira sua conexão e tente novamente.', 'error');
    } finally {
      check.disabled = false;
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

export function createWorker({ fetchAsaas = (...args) => fetch(...args) } = {}) {
  return {
    async fetch(request, env = {}) {
      const url = new URL(request.url);
      if (request.method === 'GET' && url.pathname === '/') return setupPage();
      if (request.method === 'GET' && url.pathname === '/health') {
        return json({ service: 'registro-vendas-pix-testes', stage: 'connection-only', environment: 'sandbox' });
      }
      if (url.pathname !== '/api/setup/check') {
        return json({ code: 'not_found', message: 'Rota não encontrada.' }, 404);
      }
      if (request.method !== 'POST') {
        return json({ code: 'method_not_allowed', message: 'Use o botão Testar conexão.' }, 405);
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
          redirect: 'error',
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
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
        const data = await response.json();
        if (!data || !Array.isArray(data.data)) throw new Error('invalid-asaas-response');
        const hasActivePixKey = data.data.some(key => key?.status === 'ACTIVE');
        return json({
          code: hasActivePixKey ? 'ready_for_firebase' : 'pix_key_required',
          apiConnected: true,
          hasActivePixKey,
          environment: 'sandbox',
          message: hasActivePixKey
            ? 'Conexão com o Asaas Sandbox funcionando. Existe uma chave Pix ativa de teste. A próxima etapa é configurar o Firebase para integrar as vendas e parcelas.'
            : 'Conexão com o Asaas Sandbox funcionando. Falta cadastrar ou ativar uma chave Pix na conta de testes. Depois, repita este teste.',
        });
      } catch {
        // Nunca retornar respostas brutas do provedor, tokens ou dados da conta.
        return json({ code: 'connection_failed', message: 'Não foi possível consultar o Asaas Sandbox. Tente novamente; se persistir, confira o painel da Cloudflare.' }, 502);
      }
    },
  };
}

export default createWorker();
