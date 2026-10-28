import { decryptProductionKey, PRODUCTION_PROFILE_PATH } from './production-profile.js';

export const PRODUCTION_CHECK_PATH = PRODUCTION_PROFILE_PATH + '/receipt-check';
export const PRODUCTION_WEBHOOK_PATH = '/api/webhooks/asaas/production/';
const EVENTS = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_REFUNDED', 'PAYMENT_PARTIALLY_REFUNDED', 'PAYMENT_DELETED', 'PAYMENT_OVERDUE', 'PAYMENT_RESTORED', 'PAYMENT_UPDATED', 'PAYMENT_REFUND_IN_PROGRESS'];
const apiRoot = 'https://api.asaas.com/v3';
const str = value => ({ stringValue: value });
const stamp = value => ({ timestampValue: value });
const bool = value => ({ booleanValue: value });
const int = value => ({ integerValue: String(value) });
const text = (doc, field) => doc?.fields?.[field]?.stringValue || '';
const count = (doc, field) => Number(doc?.fields?.[field]?.integerValue || 0);
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{5,128}$/.test(value);
const now = () => new Date().toISOString();
const epoch = () => new Date(0).toISOString();
const date = () => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
};
const cents = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001 ? Math.round(value * 100) : null;
export const validPayerCpf = value => {
  if (typeof value !== 'string' || !/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  if (/^(\d)\1+$/.test(digits)) return false;
  for (const length of [9, 10]) {
    const total = [...digits.slice(0, length)].reduce((sum, digit, index) => sum + Number(digit) * (length + 1 - index), 0);
    const digit = (total * 10 % 11) % 10;
    if (digit !== Number(digits[length])) return false;
  }
  return true;
};

// Um único teste real de R$ 5,00 por vez. Nenhuma escrita nas coleções do sistema.
export function createProductionCheckHandlers(deps) {
  const { IntegrationError, json, authenticatedUser, checkFirebase, loadPrivateDocument, sandboxTag, equalToken, DEFAULT_APP_ORIGIN, FIRESTORE_DOCUMENTS, PUBLIC_WORKER_URL } = deps;
  const fail = (code, message, status = 409) => { throw new IntegrationError(code, message, status); };
  const docPath = uid => '_asaas_production_checks/' + uid;
  const integrationPath = uid => '_asaas_production_integrations/' + uid;
  const name = path => 'projects/vendas-aura/databases/(default)/documents/' + path;
  const update = (path, doc, fields) => ({ update: { name: name(path), fields }, updateMask: { fieldPaths: Object.keys(fields) }, currentDocument: doc ? { updateTime: doc.updateTime } : { exists: false } });
  const readJson = async (request, limit, allowEmpty = false) => {
    if (!request.body) { if (allowEmpty) return null; fail('invalid_body', 'Informe os dados do pagador do teste real.', 400); }
    if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) fail('invalid_body', 'Envie os dados do teste em JSON.', 400);
    const reader = request.body.getReader();
    const chunks = [];
    let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) { await reader.cancel(); fail('invalid_body', 'Os dados excedem o tamanho permitido.', 413); }
      chunks.push(value);
    }
    if (!length && allowEmpty) return null;
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try {
      const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (allowEmpty && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) fail('invalid_body', 'Confira os dados do pagador.', 400);
      return parsed;
    }
    catch { fail('invalid_body', 'Não foi possível conferir os dados enviados.', 400); }
  };
  const emptyBody = async request => {
    const reader = request.body?.getReader();
    if (!reader) return;
    while (true) { const { value, done } = await reader.read(); if (done) return; if (value.length) { await reader.cancel(); fail('invalid_body', 'Esta ação usa somente a cobrança real salva.', 400); } }
  };
  const payer = input => {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 2 || Object.keys(input).some(key => !['payerName', 'payerCpf'].includes(key)) || typeof input.payerName !== 'string' || input.payerName.trim().length < 2 || input.payerName.length > 160 || /[\x00-\x1f\x7f]/.test(input.payerName) || !validPayerCpf(input.payerCpf)) fail('payer_required', 'Informe seu nome completo e um CPF válido para gerar o Pix real de R$ 5,00.', 400);
    return { name: input.payerName.normalize('NFC').trim().replace(/\s+/g, ' ').toUpperCase(), cpfCnpj: input.payerCpf.replace(/\D/g, '') };
  };
  const view = document => {
    const status = text(document, 'providerStatus') || 'NOT_CREATED';
    const ready = document?.fields?.setupComplete?.booleanValue === true;
    const verified = !!document?.fields?.receivedWebhookAt?.timestampValue;
    const messages = {
      NOT_CREATED: 'Gere um Pix real de R$ 5,00 para validar a conta oficial e o retorno automático.',
      PENDING: 'Pix real pronto. Pague pelo aplicativo do seu banco e aguarde a confirmação automática.',
      OVERDUE: 'A cobrança real está vencida. Confira o andamento antes de pagar ou cancelar.',
      CONFIRMED: 'O Asaas ainda está processando o pagamento real. Aguarde o recebimento.',
      RECEIVED: verified ? 'Pagamento real recebido. Retorno automático da conta oficial validado.' : 'Pagamento localizado na conta real. Aguardando o retorno automático autenticado.',
      DELETED: 'Cobrança real cancelada. Ela não registrou venda, parcela ou baixa de estoque.',
      REFUNDED: 'O Asaas informa que a cobrança foi estornada. Confira os valores na conta oficial.',
      REVIEW: 'A cobrança foi alterada fora do sistema. Confira o estado na conta oficial do Asaas.'
    };
    const activeQr = ready && ['PENDING', 'OVERDUE'].includes(status);
    return {
      environment: 'production', diagnosticOnly: true, amountCents: 500,
      started: !!text(document, 'reference'), created: !!text(document, 'paymentId'), ready, status, testComplete: verified,
      webhookVerified: verified, netCents: document?.fields?.netCents?.integerValue !== undefined ? count(document, 'netCents') : null,
      refundedCents: count(document, 'refundedCents'),
      payload: activeQr ? text(document, 'payload') : '', encodedImage: activeQr ? text(document, 'encodedImage') : '',
      message: text(document, 'reference') && !ready && !['DELETED', 'REFUNDED'].includes(status) ? 'A preparação foi iniciada. Retome este teste antes de gerar outra cobrança.' : messages[status] || 'Confira o andamento do teste na conta real do Asaas.'
    };
  };
  const commit = async (ctx, writes) => {
    for (const write of writes) {
      const path = write.update?.name;
      if (!path || !(path === name(docPath(ctx.user.uid)) || path.startsWith(name(docPath(ctx.user.uid) + '/history/')) || path === name(integrationPath(ctx.user.uid)))) throw new Error('unsafe_production_check_write');
    }
    const response = await ctx.fetchGoogle(FIRESTORE_DOCUMENTS.slice(0, -1) + ':commit', { method: 'POST', headers: ctx.headers, signal: ctx.signal, redirect: 'manual', body: JSON.stringify({ writes }) });
    if ([409, 412].includes(response.status)) fail('production_check_changed', 'O teste mudou durante a operação. Atualize o andamento antes de repetir.');
    if (!response.ok) fail('production_check_save_failed', 'Não foi possível confirmar a gravação. Confira o andamento do teste antes de repetir.', 503);
    const data = JSON.parse(await response.text());
    if (!Array.isArray(data.writeResults) || data.writeResults.length !== writes.length) fail('production_check_save_failed', 'A gravação não foi confirmada. Confira o andamento do teste antes de repetir.', 503);
  };
  const credentials = async ctx => {
    const integration = await ctx.load(integrationPath(ctx.user.uid));
    if (!integration) fail('production_connection_required', 'Conecte e confira a chave da sua conta real no perfil antes deste teste.');
    const key = await decryptProductionKey(ctx.env, ctx.user.uid, integration, deps);
    const keyTag = await sandboxTag(ctx.env, 'aura:production-key:v1:' + key);
    const api = async (path, method = 'GET', body) => {
      let response;
      try {
        response = await ctx.fetchAsaas(apiRoot + path, { method, redirect: 'manual', signal: ctx.signal, headers: { accept: 'application/json', access_token: key, 'User-Agent': 'RegistroDeVendas-Pix-Production-Check/1.0', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      } catch { fail('production_check_connection_failed', 'Não foi possível concluir a chamada à conta real. Confira o andamento antes de repetir.', 503); }
      if (!response.ok) {
        const error = new IntegrationError('production_check_provider_failed', [401, 403].includes(response.status) ? 'O Asaas recusou o teste. Confira as permissões da chave real para clientes, cobranças e Webhooks.' : response.status === 400 ? 'O Asaas recusou os dados do teste real. Confira seu nome, CPF e as permissões da conta.' : 'O Asaas não concluiu o teste real. Confira o andamento antes de repetir.', 502);
        error.definitive = [400, 401, 403, 404, 422, 429].includes(response.status);
        throw error;
      }
      try { return JSON.parse(await response.text()); } catch { fail('production_check_response_invalid', 'O Asaas respondeu em um formato inesperado. Confira o andamento antes de repetir.', 503); }
    };
    return { integration, keyTag, api };
  };
  const verifyPayment = (payment, doc) => {
    if (!validId(payment?.id) || text(doc, 'paymentId') && payment.id !== text(doc, 'paymentId') || payment.customer !== text(doc, 'customerId') || payment.externalReference !== text(doc, 'reference') || payment.billingType !== 'PIX' || cents(payment.value) !== 500 || typeof payment.status !== 'string' || !/^[A-Z_]{3,64}$/.test(payment.status)) fail('production_check_payment_mismatch', 'A cobrança real não corresponde a este teste. Nenhuma confirmação foi registrada.');
  };
  const settle = async (ctx, doc, payment, eventId = '') => {
    verifyPayment(payment, doc);
    if (eventId && text(doc, 'lastEventId') === eventId) return doc;
    const received = payment.deleted !== true && payment.status === 'RECEIVED';
    const net = cents(payment.netValue);
    if (received && (net === null || net < 0 || net > 500)) fail('production_check_net_invalid', 'Não foi possível conferir o valor líquido do teste real.', 503);
    const refunds = Array.isArray(payment.refunds) ? payment.refunds.filter(item => item.status === 'DONE') : [];
    if (refunds.some(item => cents(item.value) === null || cents(item.value) < 0)) fail('production_check_refund_invalid', 'Não foi possível conferir o estorno do teste real.', 503);
    const refunded = refunds.reduce((sum, item) => sum + cents(item.value), 0);
    if (refunded > 500) fail('production_check_refund_invalid', 'O valor do estorno não corresponde ao teste real.', 503);
    let status = payment.deleted === true ? 'DELETED' : payment.status;
    if (!doc.fields.pendingCounted?.booleanValue && !doc.fields.receivedWebhookAt?.timestampValue && ['PENDING', 'OVERDUE', 'CONFIRMED'].includes(status)) status = 'REVIEW';
    const fields = { providerStatus: str(status), refundedCents: int(refunded), updatedAt: stamp(now()), leaseUntil: stamp(epoch()), ...(net !== null && net >= 0 && net <= 500 ? { netCents: int(net) } : {}), ...(eventId ? { lastEventId: str(eventId), webhookAt: stamp(now()) } : {}) };
    if (received && eventId && !doc.fields.receivedWebhookAt?.timestampValue) fields.receivedWebhookAt = stamp(now());
    const writes = [];
    if (doc.fields.pendingCounted?.booleanValue && (received || ['DELETED', 'REFUNDED'].includes(status))) {
      const integration = await ctx.load(integrationPath(ctx.user.uid));
      const pending = count(integration, 'pendingCharges');
      if (!integration || !Number.isSafeInteger(pending) || pending < 1) fail('production_check_state_conflict', 'O teste precisa ser conferido antes de concluir.', 503);
      fields.pendingCounted = bool(false);
      writes.push(update(integrationPath(ctx.user.uid), integration, { pendingCharges: int(pending - 1) }));
    }
    writes.unshift(update(docPath(ctx.user.uid), doc, fields));
    await commit(ctx, writes);
    return ctx.load(docPath(ctx.user.uid));
  };
  const prepare = async (ctx, input) => {
    let document = await ctx.load(docPath(ctx.user.uid));
    const sameKey = text(document, 'keyTag') === ctx.keyTag;
    const supplied = input ? payer(input) : null;
    const suppliedTag = supplied ? await sandboxTag(ctx.env, 'aura:production-payer:v1:' + supplied.name + ':' + supplied.cpfCnpj) : '';
    const restart = sameKey && text(document, 'providerStatus') === 'DELETED' && !document.fields.receivedWebhookAt?.timestampValue && supplied;
    if (!sameKey || restart) {
      if (!supplied) fail('payer_required', 'Informe seu nome e CPF para gerar o Pix real de R$ 5,00.', 400);
      const integration = await ctx.load(integrationPath(ctx.user.uid));
      if (!integration || await sandboxTag(ctx.env, 'aura:production-key:v1:' + await decryptProductionKey(ctx.env, ctx.user.uid, integration, deps)) !== ctx.keyTag) fail('production_check_key_changed', 'A conexão real mudou. Reabra o perfil antes de gerar o teste.');
      const pending = count(integration, 'pendingCharges');
      if (pending !== 0) fail('production_check_pending', 'Conclua ou cancele o teste real pendente antes de gerar outro.');
      const fields = { keyTag: str(ctx.keyTag), reference: str('aura-prodcheck-' + crypto.randomUUID()), payerTag: str(suppliedTag), customerId: str(''), paymentId: str(''), webhookId: str(''), pendingCreate: str(''), providerStatus: str(''), payload: str(''), encodedImage: str(''), setupComplete: bool(false), pendingCounted: bool(true), webhookAt: { nullValue: null }, receivedWebhookAt: { nullValue: null }, lastEventId: str(''), netCents: { nullValue: null }, refundedCents: int(0), leaseUntil: stamp(epoch()), createdAt: stamp(now()) };
      const writes = [update(docPath(ctx.user.uid), document, fields), update(integrationPath(ctx.user.uid), integration, { pendingCharges: int(1) })];
      if (document && text(document, 'reference')) writes.push(update(docPath(ctx.user.uid) + '/history/' + text(document, 'reference'), null, document.fields));
      await commit(ctx, writes);
      document = await ctx.load(docPath(ctx.user.uid));
    } else if (supplied && suppliedTag !== text(document, 'payerTag')) fail('production_check_other_payer', 'Já existe um teste real com outro pagador. Retome ou cancele essa cobrança antes de gerar outra.');
    if (document.fields.setupComplete?.booleanValue) return view(document);
    if (Date.parse(document.fields.leaseUntil?.timestampValue || '') > Date.now()) fail('production_check_busy', 'A preparação já está em andamento. Aguarde um minuto e confira o teste.');
    const save = async fields => {
      await commit(ctx, [update(docPath(ctx.user.uid), document, fields)]);
      document = await ctx.load(docPath(ctx.user.uid));
    };
    await save({ leaseUntil: stamp(new Date(Date.now() + 90000).toISOString()) });
    try {
      const reference = text(document, 'reference');
      const find = async kind => {
        const data = await ctx.api('/' + kind + '?externalReference=' + encodeURIComponent(reference) + '&limit=2');
        if (!Array.isArray(data?.data) || data.hasMore === true || data.data.length > 1 || data.data.some(item => item.externalReference !== reference)) fail('production_check_duplicates', 'Não foi possível identificar um único registro do teste na conta real. Confira o painel Asaas.');
        return data.data[0] || null;
      };
      const create = async (kind, path, body, recover, validate, fields) => {
        const found = await recover();
        if (found) { validate(found); await save({ ...fields(found), pendingCreate: str('') }); return; }
        if (text(document, 'pendingCreate') === kind) fail('production_check_creation_unknown', 'Uma criação anterior ficou sem confirmação. A cobrança não será repetida. Confira o painel Asaas e envie esta mensagem.');
        await save({ pendingCreate: str(kind) });
        let created;
        try { created = await ctx.api(path, 'POST', body); } catch (error) { if (error.definitive) await save({ pendingCreate: str('') }); throw error; }
        validate(created);
        await save({ ...fields(created), pendingCreate: str('') });
      };
      if (!ctx.user.email) fail('production_check_email_required', 'Sua conta precisa ter e-mail válido para configurar o retorno automático.');
      const webhookUrl = PUBLIC_WORKER_URL + PRODUCTION_WEBHOOK_PATH + ctx.user.uid;
      const hooks = await ctx.api('/webhooks?limit=100');
      if (!Array.isArray(hooks?.data) || hooks.hasMore === true) fail('production_check_webhook_invalid', 'Não foi possível conferir os Webhooks da conta real.');
      const own = hooks.data.filter(hook => hook.url === webhookUrl);
      if (own.length > 1 || own.length && !validId(own[0].id)) fail('production_check_webhook_invalid', 'Existe mais de um retorno para este teste real. Confira a conta Asaas.');
      const body = { name: 'Registro de Vendas - validacao real', url: webhookUrl, email: ctx.user.email, enabled: true, interrupted: false, authToken: await sandboxTag(ctx.env, 'aura:production-webhook:v1:' + ctx.user.uid), events: EVENTS, sendType: 'SEQUENTIALLY', apiVersion: 3 };
      const checkHook = hook => { if (!validId(hook?.id) || hook.url !== webhookUrl) fail('production_check_webhook_invalid', 'Não foi possível conferir o retorno automático real.'); };
      if (own.length) {
        const hook = await ctx.api('/webhooks/' + own[0].id, 'PUT', body); checkHook(hook);
        if (hook.id !== own[0].id) fail('production_check_webhook_invalid', 'O retorno real não corresponde à configuração salva.');
        await save({ webhookId: str(hook.id), ...(text(document, 'pendingCreate') === 'webhook' ? { pendingCreate: str('') } : {}) });
      } else await create('webhook', '/webhooks', body, async () => null, checkHook, hook => ({ webhookId: str(hook.id) }));
      if (!text(document, 'customerId')) {
        const recovered = await find('customers');
        const validate = customer => { if (!validId(customer?.id) || customer.externalReference !== reference || customer.deleted === true || supplied && customer.cpfCnpj && customer.cpfCnpj.replace(/\D/g, '') !== supplied.cpfCnpj) fail('production_check_customer_invalid', 'Não foi possível conferir o pagador do teste real.'); };
        if (recovered) { validate(recovered); await save({ customerId: str(recovered.id), pendingCreate: str('') }); }
        else {
          if (text(document, 'pendingCreate') === 'customer') fail('production_check_creation_unknown', 'O cadastro anterior ficou sem confirmação. Confira a conta Asaas antes de repetir.');
          if (!supplied) fail('payer_required', 'Preencha novamente seu nome e CPF para retomar o cadastro do pagador.', 400);
          await create('customer', '/customers', { ...supplied, externalReference: reference, notificationDisabled: true }, async () => null, validate, customer => ({ customerId: str(customer.id) }));
        }
      }
      if (!text(document, 'paymentId')) await create('payment', '/payments', { customer: text(document, 'customerId'), billingType: 'PIX', value: 5, dueDate: date(), description: 'Validacao real da integracao Pix - Registro de Vendas', externalReference: reference, interest: { value: 0 }, fine: { value: 0 }, discount: { value: 0 } }, () => find('payments'), payment => verifyPayment(payment, document), payment => ({ paymentId: str(payment.id), providerStatus: str(payment.status) }));
      const payment = await ctx.api('/payments/' + text(document, 'paymentId'));
      verifyPayment(payment, document);
      if (payment.deleted === true) fail('production_check_deleted', 'A cobrança real foi excluída no Asaas. Confira o teste antes de repetir.');
      const qr = await ctx.api('/payments/' + payment.id + '/pixQrCode');
      if (typeof qr?.payload !== 'string' || qr.payload.length < 30 || qr.payload.length > 8192 || typeof qr.encodedImage !== 'string' || !/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(qr.encodedImage) || qr.encodedImage.length > 200000) fail('production_check_qr_invalid', 'A cobrança real existe, mas o QR Code ainda não ficou disponível. Retome o teste.');
      await save({ payload: str(qr.payload), encodedImage: str(qr.encodedImage), setupComplete: bool(true), providerStatus: str(payment.status), leaseUntil: stamp(epoch()) });
      return view(document);
    } catch (error) { try { await save({ leaseUntil: stamp(epoch()) }); } catch {} throw error; }
  };
  const operate = async (ctx, action, input) => {
    Object.assign(ctx, await credentials(ctx));
    let doc = await ctx.load(docPath(ctx.user.uid));
    if (action === 'get') return json(view(text(doc, 'keyTag') === ctx.keyTag ? doc : null));
    if (action === 'prepare') return json(await prepare(ctx, input));
    if (!doc || text(doc, 'keyTag') !== ctx.keyTag) fail('production_check_not_found', 'Não foi encontrado um teste para esta conexão real.', 404);
    if (Date.parse(doc.fields.leaseUntil?.timestampValue || '') > Date.now()) fail('production_check_busy', 'A preparação está em andamento. Aguarde antes de conferir ou cancelar.');
    if (!text(doc, 'paymentId')) {
      if (action !== 'cancel' || text(doc, 'pendingCreate') === 'payment') fail('production_check_not_prepared', 'Retome a preparação antes de conferir ou cancelar a cobrança real.');
      const integration = await ctx.load(integrationPath(ctx.user.uid));
      const pending = count(integration, 'pendingCharges');
      if (!doc.fields.pendingCounted?.booleanValue || !Number.isSafeInteger(pending) || pending < 1) fail('production_check_state_conflict', 'Não foi possível conferir o cancelamento da preparação.', 503);
      await commit(ctx, [update(docPath(ctx.user.uid), doc, { providerStatus: str('DELETED'), pendingCounted: bool(false), leaseUntil: stamp(epoch()) }), update(integrationPath(ctx.user.uid), integration, { pendingCharges: int(pending - 1) })]);
      return json(view(await ctx.load(docPath(ctx.user.uid))));
    }
    let payment = await ctx.api('/payments/' + text(doc, 'paymentId'));
    verifyPayment(payment, doc);
    if (action === 'cancel' && payment.deleted !== true && ['PENDING', 'OVERDUE'].includes(payment.status)) {
      // A reserva de versão impede que uma preparação concorrente inicie outra cobrança.
      await commit(ctx, [update(docPath(ctx.user.uid), doc, { leaseUntil: stamp(new Date(Date.now() + 90000).toISOString()) })]);
      doc = await ctx.load(docPath(ctx.user.uid));
      try { await ctx.api('/payments/' + payment.id, 'DELETE'); payment = await ctx.api('/payments/' + payment.id); }
      catch (error) { try { await commit(ctx, [update(docPath(ctx.user.uid), doc, { leaseUntil: stamp(epoch()) })]); } catch {} throw error; }
      verifyPayment(payment, doc);
      if (payment.deleted !== true && !['RECEIVED', 'REFUNDED'].includes(payment.status)) fail('production_check_cancel_unknown', 'O Asaas ainda não confirmou o cancelamento. Confira o andamento antes de repetir.');
    } else if (action === 'cancel' && payment.deleted !== true && !['RECEIVED', 'REFUNDED'].includes(payment.status)) fail('production_check_cancel_blocked', 'O Asaas ainda está processando a cobrança. Aguarde antes de cancelar.');
    const settled = await settle(ctx, doc, payment);
    return json(view(settled));
  };
  const handleRequest = async (request, env, fetchGoogle, fetchAsaas) => {
    const origin = request.headers.get('Origin');
    const allowed = typeof env.APP_ORIGIN === 'string' && env.APP_ORIGIN.trim() ? env.APP_ORIGIN.trim() : DEFAULT_APP_ORIGIN;
    if (!origin || origin !== allowed) return json({ code: 'origin_denied', message: 'Abra o teste real pelo perfil do sistema.' }, 403);
    const withCors = response => { response.headers.set('Access-Control-Allow-Origin', origin); response.headers.set('Vary', 'Origin'); return response; };
    const path = new URL(request.url).pathname;
    const action = path === PRODUCTION_CHECK_PATH ? request.method === 'GET' ? 'get' : 'prepare' : path === PRODUCTION_CHECK_PATH + '/reconcile' ? 'reconcile' : path === PRODUCTION_CHECK_PATH + '/cancel' ? 'cancel' : '';
    const methods = path === PRODUCTION_CHECK_PATH ? ['GET', 'POST'] : action ? ['POST'] : [];
    if (!methods.length) return withCors(json({ code: 'not_found', message: 'Rota não encontrada.' }, 404));
    if (request.method === 'OPTIONS') {
      if (!methods.includes(request.headers.get('Access-Control-Request-Method') || '')) return withCors(json({ code: 'method_not_allowed' }, 405));
      const response = withCors(json(null));
      response.headers.set('Access-Control-Allow-Methods', methods.join(', ')); response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      return new Response(null, { status: 204, headers: response.headers });
    }
    if (!methods.includes(request.method)) return withCors(json({ code: 'method_not_allowed', message: 'Método não permitido.' }, 405));
    try {
      const user = await authenticatedUser(request, fetchGoogle);
      const input = action === 'prepare' ? await readJson(request, 4096, true) : (await emptyBody(request), null);
      const result = await checkFirebase(env, fetchGoogle, false, async (accessToken, signal) => {
        const headers = { accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken };
        const load = path => loadPrivateDocument(fetchGoogle, headers, signal, path);
        const profile = await load('artifacts/vendas-aura-main/users/' + user.uid + '/profile/info');
        if (profile?.fields?.approved?.booleanValue !== true || !['', 'active'].includes(profile.fields.status?.stringValue || '')) fail('account_not_approved', 'Sua conta precisa estar aprovada e ativa para testar o Asaas real.', 403);
        return operate({ request, user, env, fetchGoogle, fetchAsaas, signal, headers, load }, action, input);
      });
      return withCors(result);
    } catch (error) { return withCors(json({ code: error instanceof IntegrationError ? error.code : 'production_check_unavailable', message: error instanceof IntegrationError ? error.message : 'Não foi possível concluir o teste real. Confira o andamento antes de repetir.' }, error instanceof IntegrationError ? error.status : 503)); }
  };
  const handleWebhook = async (request, env, uid, fetchGoogle, fetchAsaas) => {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return json({ code: 'not_found' }, 404);
    if (request.method !== 'POST') return json({ code: 'method_not_allowed' }, 405);
    try {
      const token = request.headers.get('asaas-access-token') || '';
      if (!/^[a-f0-9]{64}$/.test(token) || !equalToken(token, await sandboxTag(env, 'aura:production-webhook:v1:' + uid))) return json({ code: 'unauthorized' }, 401);
      const event = await readJson(request, 131072);
      if (typeof event?.id !== 'string' || !event.id || event.id.length > 200 || !validId(event.payment?.id)) return json({ code: 'invalid_event' }, 400);
      if (!EVENTS.includes(event.event)) return json({ accepted: true });
      return await checkFirebase(env, fetchGoogle, false, async (accessToken, signal) => {
        const headers = { accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken };
        const load = path => loadPrivateDocument(fetchGoogle, headers, signal, path);
        const doc = await load(docPath(uid));
        if (doc && !text(doc, 'paymentId') && event.payment.externalReference === text(doc, 'reference')) fail('production_check_webhook_retry', 'A cobrança real ainda está sendo registrada. Repetir entrega.', 503);
        if (!doc || text(doc, 'paymentId') !== event.payment.id || text(doc, 'lastEventId') === event.id) return json({ accepted: true });
        if (!doc.fields.setupComplete?.booleanValue) fail('production_check_webhook_retry', 'A cobrança real ainda está sendo preparada. Repetir entrega.', 503);
        const profile = await load('artifacts/vendas-aura-main/users/' + uid + '/profile/info');
        if (profile?.fields?.approved?.booleanValue !== true || !['', 'active'].includes(profile.fields.status?.stringValue || '')) return json({ accepted: true });
        const ctx = { user: { uid }, env, headers, signal, load, fetchGoogle, fetchAsaas };
        Object.assign(ctx, await credentials(ctx));
        if (ctx.keyTag !== text(doc, 'keyTag')) return json({ accepted: true });
        const payment = await ctx.api('/payments/' + event.payment.id);
        try { await settle(ctx, doc, payment, event.id); }
        catch (error) { if (error.code === 'production_check_changed') fail('production_check_webhook_retry', 'O teste mudou. Repetir entrega.', 503); throw error; }
        return json({ accepted: true });
      });
    } catch (error) { return json({ code: error instanceof IntegrationError ? error.code : 'production_check_webhook_retry' }, error instanceof IntegrationError ? error.status : 503); }
  };
  return { handleRequest, handleWebhook };
}
