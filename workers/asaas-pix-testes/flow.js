import { applyInstallmentPayment, fromCents, isTermSale, toCents } from '../../financial-core-v70.js';
import { aggregateSaleItems, buildSaleInventoryPlan } from '../../inventory-reliability-v69.js';

const BASE = '/api/integrations/asaas/flow/charges';
const ID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/;
const SOURCE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const active = state => ['creating', 'pending'].includes(state);
const str = value => ({ stringValue: value });
const int = value => ({ integerValue: String(value) });
const bool = value => ({ booleanValue: value });
const stamp = value => ({ timestampValue: value });
const text = (doc, key) => doc?.fields?.[key]?.stringValue || '';
const number = (doc, key) => Number(doc?.fields?.[key]?.integerValue || 0);
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const decodeValue = (value, depth = 0) => {
  if (depth > 20) throw new Error('invalid_document');
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(item => decodeValue(item, depth + 1));
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decodeValue(item, depth + 1)]));
  throw new Error('invalid_document');
};
const decodeDocument = document => Object.fromEntries(Object.entries(document?.fields || {}).map(([key, value]) => [key, decodeValue(value)]));
const ownKeys = (value, keys) => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key));

/** Somente cópias de homologação. Não contém operações de escrita em artifacts/. */
export function createSandboxFlowHandlers(deps) {
  const { IntegrationError, json, sandboxTag, decryptAsaasKey, sandboxApi, handleSandboxCheck, FIRESTORE_DOCUMENTS } = deps;
  const name = path => 'projects/vendas-aura/databases/(default)/documents/' + path;
  const root = uid => '_asaas_flow_sandbox/' + uid;
  const orderPath = (uid, id) => root(uid) + '/orders/' + id;
  const pendingPath = (uid, id) => root(uid) + '/pending/' + id;
  const receiptPath = (uid, id) => root(uid) + '/receipts/' + id;
  const fail = (code, message, status = 409) => { throw new IntegrationError(code, message, status); };
  const sourceMarker = (env, sale) => sandboxTag(env, 'aura:source-parcel:v1:' + canonical({ status: sale.status || 'active', installments: sale.installments }));
  const checkOrder = doc => {
    if (!doc || doc.fields.simulationOnly?.booleanValue !== true || doc.fields.flowVersion?.integerValue !== '1' || !ID.test(text(doc, 'id')) || !['checkout', 'installment'].includes(text(doc, 'kind')) || !Number.isSafeInteger(number(doc, 'amountCents')) || number(doc, 'amountCents') < 500) fail('flow_invalid', 'Não foi possível conferir o registro de teste.');
    return doc;
  };
  const view = document => {
    checkOrder(document);
    const state = text(document, 'state');
    const kind = text(document, 'kind');
    const ready = document.fields.setupComplete?.booleanValue === true;
    const result = JSON.parse(text(document, 'resultJson') || '{}');
    const messages = {
      creating: 'Preparando o Pix de teste. Se a operação for interrompida, retome este teste pelo perfil.',
      pending: 'Aguardando o pagamento de teste. Use somente a simulação no Sandbox.',
      received: kind === 'checkout' ? 'Venda de teste confirmada. Caixa e estoque reais não foram alterados.' : 'Parcela de teste recebida. A parcela original não foi alterada.',
      cancelled: 'Cobrança de teste cancelada. Nenhum registro real foi alterado.',
      refunded: 'Reembolso conferido no Sandbox. O resultado da simulação foi estornado.',
      review: 'A origem ou o status mudou durante o teste. Confira a cobrança no Asaas Sandbox. Nenhuma baixa real foi realizada.',
    };
    return {
      environment: 'sandbox', simulationOnly: true, id: text(document, 'id'), kind, state,
      amountCents: number(document, 'amountCents'), providerStatus: text(document, 'providerStatus'), ready,
      payload: active(state) && ready ? text(document, 'payload') : '',
      encodedImage: active(state) && ready ? text(document, 'encodedImage') : '',
      receiptId: text(document, 'receiptId'), confirmationSource: text(document, 'confirmationSource'),
      summary: { receivedCents: result.receivedCents || 0, remainingCents: result.remainingCents || 0, stockUnits: result.stockUnits || 0, installmentPaid: result.installmentPaid === true },
      message: messages[state] || 'Confira o andamento da cobrança de teste.',
    };
  };
  const update = (path, document, fields) => ({ update: { name: name(path), fields }, updateMask: { fieldPaths: Object.keys(fields) }, currentDocument: document ? { updateTime: document.updateTime } : { exists: false } });
  const remove = (path, document) => ({ delete: name(path), currentDocument: { updateTime: document.updateTime } });
  const commit = async (ctx, writes) => {
    // Defesa adicional: nenhuma escrita deste módulo pode tocar os dados reais.
    for (const write of writes) {
      const resource = write.update?.name || write.delete;
      if (!(resource.startsWith(name(root(ctx.user.uid) + '/')) || resource === name('_asaas_integrations/' + ctx.user.uid))) throw new Error('unsafe_write');
    }
    const response = await ctx.fetchGoogle(FIRESTORE_DOCUMENTS.slice(0, -1) + ':commit', { method: 'POST', headers: ctx.headers, redirect: 'manual', signal: ctx.signal, body: JSON.stringify({ writes }) });
    if ([409, 412].includes(response.status)) fail('flow_conflict', 'O teste mudou durante esta operação. Consulte o andamento e tente novamente.');
    if (!response.ok) fail('flow_save_failed', 'Não foi possível salvar o teste. Consulte o andamento antes de repetir.', 503);
    const result = JSON.parse(await response.text());
    if (!Array.isArray(result.writeResults) || result.writeResults.length !== writes.length) fail('flow_save_failed', 'A gravação do teste não foi confirmada. Consulte o andamento antes de repetir.', 503);
  };
  const releaseWrites = async (ctx, document) => {
    const integration = await ctx.load('_asaas_integrations/' + ctx.user.uid);
    const pending = await ctx.load(pendingPath(ctx.user.uid, text(document, 'id')));
    const count = number(integration, 'pendingCharges');
    if (!integration || !pending || !Number.isSafeInteger(count) || count < 1) fail('flow_state_conflict', 'O andamento do teste precisa ser conferido antes de confirmar.', 503);
    const writes = [update('_asaas_integrations/' + ctx.user.uid, integration, { pendingCharges: int(count - 1) }), remove(pendingPath(ctx.user.uid, text(document, 'id')), pending)];
    if (text(document, 'sourceSlot')) {
      const path = root(ctx.user.uid) + '/slots/' + text(document, 'sourceSlot');
      const slot = await ctx.load(path);
      if (!slot || text(slot, 'orderId') !== text(document, 'id')) fail('flow_state_conflict', 'Não foi possível conferir a reserva da parcela de teste.', 503);
      writes.push(remove(path, slot));
    }
    return writes;
  };
  const readBody = async request => {
    if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) fail('invalid_body', 'Envie os dados do teste em JSON.', 400);
    const reader = request.body?.getReader();
    if (!reader) fail('invalid_body', 'Informe os dados do teste.', 400);
    const chunks = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 12288) { await reader.cancel(); fail('invalid_body', 'O pedido de teste excedeu o tamanho permitido.', 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { fail('invalid_body', 'Confira os dados do pedido de teste.', 400); }
  };
  const emptyBody = async request => {
    const reader = request.body?.getReader();
    if (!reader) return;
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      if (value.length) { await reader.cancel(); fail('invalid_body', 'Esta ação usa somente a cobrança salva.', 400); }
    }
  };
  const credential = async ctx => {
    if (!ctx.current?.fields?.enabled?.booleanValue) fail('flow_disabled', 'Ative a conexão Asaas Sandbox no perfil antes de testar.');
    const key = await decryptAsaasKey(ctx.env, ctx.user.uid, ctx.current.fields);
    return { key, keyTag: await sandboxTag(ctx.env, 'aura:sandbox-key:v1:' + key), api: sandboxApi(ctx.fetchAsaas, key, ctx.signal) };
  };
  const verifyPayment = (payment, document) => {
    if (payment?.id !== text(document, 'paymentId') || payment.customer !== text(document, 'customerId') || payment.externalReference !== text(document, 'reference') || payment.billingType !== 'PIX' || payment.value !== fromCents(number(document, 'amountCents')) || typeof payment.status !== 'string' || !/^[A-Z_]{3,64}$/.test(payment.status)) fail('flow_payment_mismatch', 'A cobrança não corresponde ao pedido de teste. Nenhuma baixa foi realizada.');
  };
  const snapshotFor = async (ctx, input) => {
    if (input?.kind === 'checkout') {
      if (!ownKeys(input, ['kind', 'idempotencyKey', 'items']) || !/^[a-f0-9-]{36}$/.test(input.idempotencyKey || '') || !ID.test(input.idempotencyKey) || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 10) fail('invalid_checkout', 'O teste do caixa aceita de 1 a 10 itens válidos.', 400);
      const items = input.items.map(item => {
        if (!ownKeys(item, ['productId', 'quantity', 'lineTotalCents']) || !SOURCE_ID.test(item.productId || '') || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999 || !Number.isSafeInteger(item.lineTotalCents) || item.lineTotalCents < item.quantity || item.lineTotalCents > 5000000) fail('invalid_checkout', 'Confira os produtos, as quantidades e os preços do carrinho de teste.', 400);
        return { productId: item.productId, quantity: item.quantity, lineTotalCents: item.lineTotalCents };
      });
      const requested = aggregateSaleItems(items);
      const products = await Promise.all(requested.map(async item => {
        const doc = await ctx.load('artifacts/vendas-aura-main/users/' + ctx.user.uid + '/products/' + item.productId);
        if (!doc) fail('product_not_found', 'Um produto do carrinho não está mais disponível.');
        const data = decodeDocument(doc);
        return { productId: item.productId, quantity: data.quantity, name: String(data.name || 'Produto').slice(0, 160), costPrice: data.costPrice };
      }));
      let stockPlan;
      try { stockPlan = buildSaleInventoryPlan(requested, products); }
      catch { fail('invalid_stock', 'O estoque atual não permite esse carrinho de teste. Atualize as quantidades.'); }
      const amountCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
      return { id: input.idempotencyKey, amountCents, snapshot: { kind: 'checkout', items, stockPlan, amountCents }, request: { kind: input.kind, items } };
    }
    if (input?.kind === 'installment') {
      if (!ownKeys(input, ['kind', 'saleId', 'installmentIndex']) || !SOURCE_ID.test(input.saleId || '') || !Number.isInteger(input.installmentIndex) || input.installmentIndex < 0 || input.installmentIndex > 119) fail('invalid_installment', 'Confira a venda e a parcela de teste.', 400);
      const doc = await ctx.load('artifacts/vendas-aura-main/users/' + ctx.user.uid + '/sales/' + input.saleId);
      if (!doc) fail('sale_not_found', 'A venda não foi encontrada.');
      const sale = decodeDocument(doc);
      const selected = sale.installments?.[input.installmentIndex];
      if (!isTermSale(sale) || sale.status === 'canceled' || !selected || selected.paid || toCents(selected.amount) <= 0) fail('installment_unavailable', 'Esta parcela não está mais disponível para o teste.');
      const marker = await sourceMarker(ctx.env, sale);
      const tag = await sandboxTag(ctx.env, 'aura:installment-order:v1:' + ctx.user.uid + ':' + input.saleId + ':' + input.installmentIndex + ':' + marker + ':' + ctx.keyTag);
      const sourceSlot = (await sandboxTag(ctx.env, 'aura:parcel-slot:v1:' + input.saleId + ':' + input.installmentIndex)).slice(0, 32);
      return { id: tag.slice(0, 32), sourceSlot, amountCents: toCents(selected.amount), snapshot: { kind: 'installment', installments: sale.installments, installmentIndex: input.installmentIndex, saleId: input.saleId, sourceMarker: marker }, request: { kind: input.kind, saleId: input.saleId, installmentIndex: input.installmentIndex, sourceMarker: marker } };
    }
    fail('invalid_kind', 'Escolha um teste do caixa ou de parcela.', 400);
  };
  const list = async ctx => {
    const response = await ctx.fetchGoogle(FIRESTORE_DOCUMENTS + root(ctx.user.uid) + '/pending?pageSize=10', { method: 'GET', headers: ctx.headers, redirect: 'manual', signal: ctx.signal });
    if (!response.ok) fail('flow_list_failed', 'Não foi possível carregar os testes pendentes.', 503);
    const data = JSON.parse(await response.text());
    if (data.nextPageToken || (data.documents !== undefined && !Array.isArray(data.documents))) fail('flow_list_failed', 'Não foi possível conferir os testes pendentes.', 503);
    const orders = (data.documents || []).map(doc => {
      const id = text(doc, 'id');
      if (!ID.test(id) || doc.name !== name(pendingPath(ctx.user.uid, id))) fail('flow_list_failed', 'Não foi possível conferir um teste pendente.', 503);
      return { id, kind: text(doc, 'kind'), amountCents: number(doc, 'amountCents') };
    });
    return json({ environment: 'sandbox', simulationOnly: true, orders });
  };
  const settle = async (ctx, document, payment, source, eventId = '') => {
    checkOrder(document);
    verifyPayment(payment, document);
    const state = text(document, 'state');
    if (eventId && text(document, 'lastEventId') === eventId) return document;
    const received = payment.deleted !== true && payment.status === 'RECEIVED';
    const refunded = payment.status === 'REFUNDED';
    const cancelled = payment.deleted === true;
    let nextState = state;
    let result = JSON.parse(text(document, 'resultJson') || '{}');
    if (received && active(state)) {
      const snapshot = JSON.parse(text(document, 'snapshotJson'));
      if (snapshot.kind === 'checkout') {
        result = { receivedCents: number(document, 'amountCents'), stockUnits: snapshot.stockPlan.reduce((sum, item) => sum + item.requestedQuantity, 0), stockPlan: snapshot.stockPlan, saleStatus: 'completed' };
      } else {
        const original = await ctx.load('artifacts/vendas-aura-main/users/' + ctx.user.uid + '/sales/' + snapshot.saleId);
        if (!original || await sourceMarker(ctx.env, decodeDocument(original)) !== snapshot.sourceMarker) nextState = 'review';
        else {
          const now = new Date().toISOString();
          const dateParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
          const date = ['year', 'month', 'day'].map(type => dateParts.find(part => part.type === type)?.value).join('-');
          const applied = applyInstallmentPayment(snapshot.installments, snapshot.installmentIndex, fromCents(number(document, 'amountCents')), date, now);
          applied.historyItem.provider = 'asaas-sandbox';
          applied.historyItem.providerPaymentId = payment.id;
          result = { receivedCents: number(document, 'amountCents'), remainingCents: toCents(applied.remainingBalance), installmentPaid: applied.installments[snapshot.installmentIndex].paid, installments: applied.installments, saleStatus: applied.allPaid ? 'completed' : 'active' };
        }
      }
      if (nextState !== 'review') nextState = 'received';
    } else if (refunded && (state === 'received' || active(state))) { nextState = 'refunded'; result = { receivedCents: 0, refundedCents: number(document, 'amountCents') }; }
    else if (received && !['received', 'review'].includes(state) || cancelled && payment.status === 'RECEIVED' && active(state)) nextState = 'review';
    else if (cancelled && active(state)) nextState = 'cancelled';
    if (nextState === state && !active(state)) return document;
    const fields = { state: str(nextState), providerStatus: str(cancelled ? 'DELETED' : payment.status), lastEventId: str(eventId || text(document, 'lastEventId')), updatedAt: stamp(new Date().toISOString()) };
    const writes = [];
    const finishing = active(state) && !active(nextState);
    if (finishing) {
      writes.push(...await releaseWrites(ctx, document));
    }
    if (nextState !== state && ['received', 'refunded', 'review'].includes(nextState)) {
      Object.assign(fields, { resultJson: str(JSON.stringify(result)), receiptId: str(payment.id), confirmationSource: str(source) });
      const receipt = await ctx.load(receiptPath(ctx.user.uid, payment.id));
      if (nextState === 'received' && receipt) fail('flow_receipt_conflict', 'Este pagamento já possui um resultado salvo. Confira o andamento do teste.', 503);
      writes.push(update(receiptPath(ctx.user.uid, payment.id), receipt, { orderId: str(text(document, 'id')), paymentId: str(payment.id), state: str(nextState), amountCents: int(number(document, 'amountCents')), simulationOnly: bool(true), resultJson: str(JSON.stringify(result)) }));
    }
    writes.unshift(update(orderPath(ctx.user.uid, text(document, 'id')), document, fields));
    await commit(ctx, writes);
    return ctx.load(orderPath(ctx.user.uid, text(document, 'id')));
  };
  const handleRequest = async ctx => {
    const path = new URL(ctx.request.url).pathname;
    if (path === BASE && ctx.request.method === 'GET') return list(ctx);
    const credentials = await credential(ctx);
    Object.assign(ctx, credentials);
    let id;
    let document;
    if (path === BASE) {
      const input = await readBody(ctx.request);
      const diagnostic = await ctx.load('_asaas_sandbox_checks/' + ctx.user.uid);
      if (text(diagnostic, 'keyTag') !== ctx.keyTag || text(diagnostic, 'providerStatus') !== 'RECEIVED' || !diagnostic?.fields?.webhookAt?.timestampValue) fail('flow_diagnostic_required', 'Conclua primeiro o teste de cobrança e retorno automático no perfil.');
      // Procurar primeiro uma intenção conhecida do caixa permite retomá-la mesmo se o estoque mudou depois.
      if (input?.kind === 'checkout' && ID.test(input.idempotencyKey || '')) {
        document = await ctx.load(orderPath(ctx.user.uid, input.idempotencyKey));
        if (document) {
          const fingerprint = await sandboxTag(ctx.env, 'aura:flow-request:v1:' + canonical({ kind: input.kind, items: input.items }));
          if (!ownKeys(input, ['kind', 'idempotencyKey', 'items']) || fingerprint !== text(document, 'requestHash')) fail('flow_intent_changed', 'Este teste pertence a outro carrinho. Abra uma nova cobrança de teste.');
        }
      }
      let prepared;
      if (!document) prepared = await snapshotFor(ctx, input);
      id = document ? text(document, 'id') : prepared.id;
      if (prepared?.sourceSlot) {
        const slot = await ctx.load(root(ctx.user.uid) + '/slots/' + prepared.sourceSlot);
        if (slot && text(slot, 'orderId') !== id) fail('flow_installment_pending', 'Já existe um teste pendente desta parcela. Retome ou cancele esse teste pelo perfil.');
      }
      if (!document) document = await ctx.load(orderPath(ctx.user.uid, id));
      if (!document) {
        if (prepared.amountCents < 500 || prepared.amountCents > 5000000) fail('flow_amount_invalid', 'Neste teste, o valor deve ficar entre R$ 5,00 e R$ 50.000,00.', 400);
        const snapshotJson = JSON.stringify(prepared.snapshot);
        if (new TextEncoder().encode(snapshotJson).length > 64000) fail('flow_snapshot_large', 'Este contrato é muito grande para o teste. Escolha outra parcela.', 400);
        const integration = await ctx.load('_asaas_integrations/' + ctx.user.uid);
        if (!integration?.fields?.enabled?.booleanValue || await sandboxTag(ctx.env, 'aura:sandbox-key:v1:' + await decryptAsaasKey(ctx.env, ctx.user.uid, integration.fields)) !== ctx.keyTag) fail('flow_credential_changed', 'A conexão mudou. Reabra o perfil antes de gerar o teste.');
        const count = number(integration, 'pendingCharges');
        if (!Number.isInteger(count) || count < 0 || count >= 5) fail('flow_pending_limit', 'Conclua ou cancele os testes pendentes no perfil antes de criar outro.');
        const fields = { id: str(id), kind: str(input.kind), state: str('creating'), amountCents: int(prepared.amountCents), snapshotJson: str(snapshotJson), requestHash: str(await sandboxTag(ctx.env, 'aura:flow-request:v1:' + canonical(prepared.request))), keyTag: str(ctx.keyTag), reference: str('aura-flow-' + id), simulationOnly: bool(true), flowVersion: int(1), sourceSlot: str(prepared.sourceSlot || ''), createdAt: stamp(new Date().toISOString()), leaseUntil: stamp(new Date(0).toISOString()) };
        const writes = [update(orderPath(ctx.user.uid, id), null, fields), update(pendingPath(ctx.user.uid, id), null, { id: str(id), kind: str(input.kind), amountCents: int(prepared.amountCents) }), update('_asaas_integrations/' + ctx.user.uid, integration, { pendingCharges: int(count + 1) })];
        if (prepared.sourceSlot) writes.push(update(root(ctx.user.uid) + '/slots/' + prepared.sourceSlot, null, { orderId: str(id) }));
        await commit(ctx, writes);
        document = await ctx.load(orderPath(ctx.user.uid, id));
      }
    } else {
      id = path.slice(BASE.length + 1).split('/')[0];
      document = await ctx.load(orderPath(ctx.user.uid, id));
      if (!document) fail('flow_not_found', 'A cobrança de teste não foi encontrada.', 404);
    }
    checkOrder(document);
    if (ctx.request.method === 'GET') return json(view(document));
    if (text(document, 'keyTag') !== ctx.keyTag) fail('flow_credential_changed', 'Este teste pertence à conexão anterior. Confira a cobrança no Asaas Sandbox.');
    const action = path.slice(BASE.length + 1 + id.length + 1);
    if (path !== BASE) await emptyBody(ctx.request);
    if (path === BASE || action === 'prepare') {
      if (!active(text(document, 'state'))) return json(view(document));
      const internal = new Request('https://worker.internal/api/integrations/asaas/sandbox-charge', { method: 'POST' });
      await handleSandboxCheck({ ...ctx, request: internal, checkPath: orderPath(ctx.user.uid, id) });
      document = await ctx.load(orderPath(ctx.user.uid, id));
      if (active(text(document, 'state'))) {
        const indexPath = root(ctx.user.uid) + '/payments/' + text(document, 'paymentId');
        const index = await ctx.load(indexPath);
        await commit(ctx, [update(orderPath(ctx.user.uid, id), document, { state: str('pending') }), update(indexPath, index, { orderId: str(id) })]);
      }
      return json(view(await ctx.load(orderPath(ctx.user.uid, id))));
    }
    if (action === 'simulate') {
      if (!active(text(document, 'state'))) return json(view(document));
      const internal = new Request('https://worker.internal/api/integrations/asaas/sandbox-charge/simulate', { method: 'POST' });
      await handleSandboxCheck({ ...ctx, request: internal, checkPath: orderPath(ctx.user.uid, id) });
      return json({ ...view(await ctx.load(orderPath(ctx.user.uid, id))), message: 'Simulação enviada. Aguarde a confirmação automática do Asaas.' });
    }
    if (!text(document, 'paymentId')) {
      if (action === 'cancel' && active(text(document, 'state')) && text(document, 'pendingCreate') !== 'payment') {
        await commit(ctx, [update(orderPath(ctx.user.uid, id), document, { state: str('cancelled') }), ...await releaseWrites(ctx, document)]);
        return json(view(await ctx.load(orderPath(ctx.user.uid, id))));
      }
      fail('flow_not_prepared', 'Retome a preparação deste teste antes de conferir ou cancelar.');
    }
    let payment = await ctx.api('/payments/' + text(document, 'paymentId'));
    verifyPayment(payment, document);
    if (action === 'cancel' && active(text(document, 'state')) && payment.deleted !== true && payment.status === 'CONFIRMED') fail('flow_cancellation_blocked', 'O Asaas ainda está analisando a cobrança. Aguarde a conclusão para confirmar ou cancelar o teste.');
    if (action === 'cancel' && active(text(document, 'state')) && payment.deleted !== true && ['PENDING', 'OVERDUE'].includes(payment.status)) {
      await ctx.api('/payments/' + payment.id, 'DELETE');
      payment = await ctx.api('/payments/' + payment.id);
      verifyPayment(payment, document);
      if (payment.deleted !== true && !['RECEIVED', 'REFUNDED'].includes(payment.status)) fail('flow_cancel_unknown', 'O cancelamento ainda não foi confirmado pelo Asaas. Confira o andamento antes de repetir.');
    }
    return json(view(await settle(ctx, document, payment, 'reconciliation')));
  };
  const handleWebhook = async ctx => {
    const reference = ctx.event.payment.externalReference;
    const index = await ctx.load(root(ctx.user.uid) + '/payments/' + ctx.event.payment.id);
    const id = index ? text(index, 'orderId') : typeof reference === 'string' && reference.startsWith('aura-flow-') ? reference.slice(10) : '';
    if (!ID.test(id)) return json({ accepted: true });
    const document = await ctx.load(orderPath(ctx.user.uid, id));
    if (!document) return json({ accepted: true });
    checkOrder(document);
    if (!text(document, 'paymentId')) fail('flow_webhook_retry', 'A cobrança ainda está sendo registrada. Repetir entrega.', 503);
    if (text(document, 'paymentId') !== ctx.event.payment.id) return json({ accepted: true });
    ctx.current = await ctx.load('_asaas_integrations/' + ctx.user.uid);
    const profile = await ctx.load('artifacts/vendas-aura-main/users/' + ctx.user.uid + '/profile/info');
    if (profile?.fields?.approved?.booleanValue !== true || !['', 'active'].includes(profile.fields.status?.stringValue || '') || !ctx.current?.fields?.enabled?.booleanValue) return json({ accepted: true });
    Object.assign(ctx, await credential(ctx));
    if (text(document, 'keyTag') !== ctx.keyTag) return json({ accepted: true });
    const payment = await ctx.api('/payments/' + ctx.event.payment.id);
    try { await settle(ctx, document, payment, 'webhook', ctx.event.id); }
    catch (error) { if (error.code === 'flow_conflict') fail('flow_webhook_retry', 'O teste mudou. Repetir entrega.', 503); throw error; }
    return json({ accepted: true });
  };
  return {
    methods: path => path === BASE ? ['GET', 'POST'] : new RegExp('^' + BASE + '/(?:[a-f0-9]{32}|[a-f0-9-]{36})(?:/(prepare|simulate|reconcile|cancel))?$').test(path) ? path.slice(BASE.length + 1).includes('/') ? ['POST'] : ['GET'] : [],
    matches: path => path === BASE || path.startsWith(BASE + '/'),
    handleRequest, handleWebhook,
  };
}
