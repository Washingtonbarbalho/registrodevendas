// Etapa 6: caixa e parcelas em copias Sandbox. Gerado por build.mjs.

// ../../financial-core-v70.js
var finiteNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
var FinancialCalculationError = class extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "FinancialCalculationError";
    this.code = code;
    this.details = details;
  }
};
var toCents = (value) => {
  const amount = finiteNumber(value);
  const correction = Math.sign(amount || 1) * Number.EPSILON * Math.max(1, Math.abs(amount));
  return Math.round((amount + correction) * 100);
};
var fromCents = (cents) => Math.round(finiteNumber(cents)) / 100;
var money = (value) => fromCents(toCents(value));
var sumMoney = (items = [], getter = (value) => value) => fromCents(
  (Array.isArray(items) ? items : []).reduce((total, item, index) => total + toCents(getter(item, index)), 0)
);
var cleanFinancialDate = (value) => {
  if (!value) return "";
  if (typeof value?.toDate === "function") return value.toDate().toISOString().slice(0, 10);
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1e3).toISOString().slice(0, 10);
  return String(value).split("T")[0];
};
var isTermSale = (sale) => sale?.saleType === "prazo" || !sale?.saleType;
var getInstallmentFaceAmount = (installment) => {
  if (finiteNumber(installment?.originalAmount) > 0) return money(installment.originalAmount);
  const remaining = Math.max(0, toCents(installment?.amount));
  const history = Array.isArray(installment?.history) ? installment.history : [];
  const applied = history.reduce((total, item) => total + Math.max(0, toCents(item?.amount)), 0);
  return fromCents(remaining + applied);
};
var cloneInstallments = (installments) => (Array.isArray(installments) ? installments : []).map((item) => ({
  ...item,
  amount: money(item.amount),
  originalAmount: getInstallmentFaceAmount(item),
  history: Array.isArray(item.history) ? item.history.map((history) => ({ ...history })) : []
}));
var applyInstallmentPayment = (installments, selectedIndex, amountPaid, datePaid, timestamp = (/* @__PURE__ */ new Date()).toISOString()) => {
  const index = parseInt(selectedIndex, 10);
  const rows = cloneInstallments(installments);
  const selected = rows[index];
  const paymentCents = toCents(amountPaid);
  const date = cleanFinancialDate(datePaid);
  if (!selected || selected.paid || toCents(selected.amount) <= 0) throw new FinancialCalculationError("invalid-installment", "A parcela selecionada não está mais disponível para pagamento.");
  if (paymentCents <= 0 || !date) throw new FinancialCalculationError("invalid-payment", "Informe um valor e uma data de pagamento válidos.");
  const available = rows.slice(index).reduce((total, item) => total + (!item.paid ? Math.max(0, toCents(item.amount)) : 0), 0);
  if (paymentCents > available) {
    throw new FinancialCalculationError("payment-exceeds-balance", `O pagamento informado é maior que o saldo restante do contrato (${fromCents(available).toFixed(2).replace(".", ",")}).`);
  }
  const selectedOpen = Math.max(0, toCents(selected.amount));
  const appliedToSelected = Math.min(paymentCents, selectedOpen);
  let surplus = paymentCents - appliedToSelected;
  const allocations = [];
  for (let cursor = index + 1; surplus > 0 && cursor < rows.length; cursor += 1) {
    const target = rows[cursor];
    if (target.paid) continue;
    const open = Math.max(0, toCents(target.amount));
    if (open <= 0) continue;
    const applied = Math.min(open, surplus);
    const remaining = open - applied;
    target.amount = fromCents(remaining);
    target.paid = remaining === 0;
    target.paidAt = target.paid ? date : null;
    target.paidAtDateTime = target.paid ? timestamp : null;
    target.history.push({
      date,
      amount: fromCents(applied),
      type: "abatement",
      fromInstallment: index,
      sourceTimestamp: timestamp,
      timestamp
    });
    allocations.push({ installmentIndex: cursor, amount: fromCents(applied) });
    surplus -= applied;
  }
  const remainingSelected = selectedOpen - appliedToSelected;
  const historyItem = {
    date,
    amount: fromCents(appliedToSelected),
    type: paymentCents < selectedOpen ? "partial" : paymentCents === selectedOpen ? "full" : "full_surplus",
    timestamp
  };
  if (paymentCents > selectedOpen) {
    historyItem.surplus = fromCents(paymentCents - selectedOpen);
    historyItem.allocations = allocations;
  }
  selected.history.push(historyItem);
  selected.amount = fromCents(remainingSelected);
  selected.paid = remainingSelected === 0;
  selected.paidAt = selected.paid ? date : null;
  selected.paidAtDateTime = selected.paid ? timestamp : null;
  return {
    installments: rows,
    historyItem,
    allocations,
    paidAmount: fromCents(paymentCents),
    remainingBalance: sumMoney(rows.filter((item) => !item.paid), (item) => item.amount),
    allPaid: rows.every((item) => item.paid || toCents(item.amount) <= 0)
  };
};

// ../../inventory-reliability-v69.js
var InventoryReliabilityError = class extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "InventoryReliabilityError";
    this.code = code;
    this.details = details;
  }
};
var wholeQuantity = (value, label) => {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new InventoryReliabilityError(
      "invalid-quantity",
      `${label || "Produto"}: informe uma quantidade inteira maior que zero.`
    );
  }
  return quantity;
};
var aggregateSaleItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new InventoryReliabilityError("empty-sale", "Adicione pelo menos um produto antes de concluir a venda.");
  }
  const aggregated = /* @__PURE__ */ new Map();
  for (const item of items) {
    if (!item?.productId) {
      throw new InventoryReliabilityError("invalid-product", "Um item da venda não está vinculado a um produto válido. Atualize a página e tente novamente.");
    }
    const productId = String(item.productId);
    const productName = String(item.productName || item.name || "Produto");
    const quantity = wholeQuantity(item.quantity, productName);
    const current = aggregated.get(productId);
    if (current) current.requestedQuantity += quantity;
    else aggregated.set(productId, { productId, productName, requestedQuantity: quantity });
  }
  return [...aggregated.values()];
};
var buildSaleInventoryPlan = (requestedItems = [], inventoryRecords = []) => {
  const inventory = new Map((Array.isArray(inventoryRecords) ? inventoryRecords : []).map((record) => [String(record.productId), record]));
  return requestedItems.map((requested) => {
    const record = inventory.get(String(requested.productId));
    if (!record) {
      throw new InventoryReliabilityError(
        "product-not-found",
        `${requested.productName}: o produto não foi encontrado. Atualize a página e tente novamente.`,
        { productId: requested.productId }
      );
    }
    const currentQuantity = Number(record.quantity);
    if (!Number.isInteger(currentQuantity) || currentQuantity < 0) {
      throw new InventoryReliabilityError(
        "invalid-stock",
        `${requested.productName}: o saldo de estoque está inválido e precisa ser corrigido.`,
        { productId: requested.productId, currentQuantity }
      );
    }
    if (requested.requestedQuantity > currentQuantity) {
      throw new InventoryReliabilityError(
        "insufficient-stock",
        `${requested.productName}: estoque disponível é ${currentQuantity} un., mas a venda solicita ${requested.requestedQuantity} un.`,
        { productId: requested.productId, currentQuantity, requestedQuantity: requested.requestedQuantity }
      );
    }
    return {
      productId: requested.productId,
      productName: requested.productName,
      previousQuantity: currentQuantity,
      requestedQuantity: requested.requestedQuantity,
      newQuantity: currentQuantity - requested.requestedQuantity
    };
  });
};

// flow.js
var BASE = "/api/integrations/asaas/flow/charges";
var ID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/;
var SOURCE_ID = /^[A-Za-z0-9_-]{1,128}$/;
var active = (state) => ["creating", "pending"].includes(state);
var str = (value) => ({ stringValue: value });
var int = (value) => ({ integerValue: String(value) });
var bool = (value) => ({ booleanValue: value });
var stamp = (value) => ({ timestampValue: value });
var text = (doc, key) => doc?.fields?.[key]?.stringValue || "";
var number = (doc, key) => Number(doc?.fields?.[key]?.integerValue || 0);
var canonical = (value) => JSON.stringify(value, (_, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
var decodeValue = (value, depth = 0) => {
  if (depth > 20) throw new Error("invalid_document");
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map((item) => decodeValue(item, depth + 1));
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decodeValue(item, depth + 1)]));
  throw new Error("invalid_document");
};
var decodeDocument = (document) => Object.fromEntries(Object.entries(document?.fields || {}).map(([key, value]) => [key, decodeValue(value)]));
var ownKeys = (value, keys) => !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => keys.includes(key));
function createSandboxFlowHandlers(deps) {
  const { IntegrationError: IntegrationError2, json: json2, sandboxTag: sandboxTag2, decryptAsaasKey: decryptAsaasKey2, sandboxApi: sandboxApi2, handleSandboxCheck: handleSandboxCheck2, FIRESTORE_DOCUMENTS: FIRESTORE_DOCUMENTS2 } = deps;
  const name = (path) => "projects/vendas-aura/databases/(default)/documents/" + path;
  const root = (uid) => "_asaas_flow_sandbox/" + uid;
  const orderPath = (uid, id) => root(uid) + "/orders/" + id;
  const pendingPath = (uid, id) => root(uid) + "/pending/" + id;
  const receiptPath = (uid, id) => root(uid) + "/receipts/" + id;
  const fail = (code, message, status = 409) => {
    throw new IntegrationError2(code, message, status);
  };
  const sourceMarker = (env, sale) => sandboxTag2(env, "aura:source-parcel:v1:" + canonical({ status: sale.status || "active", installments: sale.installments }));
  const checkOrder = (doc) => {
    if (!doc || doc.fields.simulationOnly?.booleanValue !== true || doc.fields.flowVersion?.integerValue !== "1" || !ID.test(text(doc, "id")) || !["checkout", "installment"].includes(text(doc, "kind")) || !Number.isSafeInteger(number(doc, "amountCents")) || number(doc, "amountCents") < 500) fail("flow_invalid", "Não foi possível conferir o registro de teste.");
    return doc;
  };
  const view = (document) => {
    checkOrder(document);
    const state = text(document, "state");
    const kind = text(document, "kind");
    const ready = document.fields.setupComplete?.booleanValue === true;
    const result = JSON.parse(text(document, "resultJson") || "{}");
    const messages = {
      creating: "Preparando o Pix de teste. Se a operação for interrompida, retome este teste pelo perfil.",
      pending: "Aguardando o pagamento de teste. Use somente a simulação no Sandbox.",
      received: kind === "checkout" ? "Venda de teste confirmada. Caixa e estoque reais não foram alterados." : "Parcela de teste recebida. A parcela original não foi alterada.",
      cancelled: "Cobrança de teste cancelada. Nenhum registro real foi alterado.",
      refunded: "Reembolso conferido no Sandbox. O resultado da simulação foi estornado.",
      review: "A origem ou o status mudou durante o teste. Confira a cobrança no Asaas Sandbox. Nenhuma baixa real foi realizada."
    };
    return {
      environment: "sandbox",
      simulationOnly: true,
      id: text(document, "id"),
      kind,
      state,
      amountCents: number(document, "amountCents"),
      providerStatus: text(document, "providerStatus"),
      ready,
      payload: active(state) && ready ? text(document, "payload") : "",
      encodedImage: active(state) && ready ? text(document, "encodedImage") : "",
      receiptId: text(document, "receiptId"),
      confirmationSource: text(document, "confirmationSource"),
      summary: { receivedCents: result.receivedCents || 0, remainingCents: result.remainingCents || 0, stockUnits: result.stockUnits || 0, installmentPaid: result.installmentPaid === true },
      message: messages[state] || "Confira o andamento da cobrança de teste."
    };
  };
  const update = (path, document, fields) => ({ update: { name: name(path), fields }, updateMask: { fieldPaths: Object.keys(fields) }, currentDocument: document ? { updateTime: document.updateTime } : { exists: false } });
  const remove = (path, document) => ({ delete: name(path), currentDocument: { updateTime: document.updateTime } });
  const commit = async (ctx, writes) => {
    for (const write of writes) {
      const resource = write.update?.name || write.delete;
      if (!(resource.startsWith(name(root(ctx.user.uid) + "/")) || resource === name("_asaas_integrations/" + ctx.user.uid))) throw new Error("unsafe_write");
    }
    const response = await ctx.fetchGoogle(FIRESTORE_DOCUMENTS2.slice(0, -1) + ":commit", { method: "POST", headers: ctx.headers, redirect: "manual", signal: ctx.signal, body: JSON.stringify({ writes }) });
    if ([409, 412].includes(response.status)) fail("flow_conflict", "O teste mudou durante esta operação. Consulte o andamento e tente novamente.");
    if (!response.ok) fail("flow_save_failed", "Não foi possível salvar o teste. Consulte o andamento antes de repetir.", 503);
    const result = JSON.parse(await response.text());
    if (!Array.isArray(result.writeResults) || result.writeResults.length !== writes.length) fail("flow_save_failed", "A gravação do teste não foi confirmada. Consulte o andamento antes de repetir.", 503);
  };
  const releaseWrites = async (ctx, document) => {
    const integration = await ctx.load("_asaas_integrations/" + ctx.user.uid);
    const pending = await ctx.load(pendingPath(ctx.user.uid, text(document, "id")));
    const count = number(integration, "pendingCharges");
    if (!integration || !pending || !Number.isSafeInteger(count) || count < 1) fail("flow_state_conflict", "O andamento do teste precisa ser conferido antes de confirmar.", 503);
    const writes = [update("_asaas_integrations/" + ctx.user.uid, integration, { pendingCharges: int(count - 1) }), remove(pendingPath(ctx.user.uid, text(document, "id")), pending)];
    if (text(document, "sourceSlot")) {
      const path = root(ctx.user.uid) + "/slots/" + text(document, "sourceSlot");
      const slot = await ctx.load(path);
      if (!slot || text(slot, "orderId") !== text(document, "id")) fail("flow_state_conflict", "Não foi possível conferir a reserva da parcela de teste.", 503);
      writes.push(remove(path, slot));
    }
    return writes;
  };
  const readBody = async (request) => {
    if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) fail("invalid_body", "Envie os dados do teste em JSON.", 400);
    const reader = request.body?.getReader();
    if (!reader) fail("invalid_body", "Informe os dados do teste.", 400);
    const chunks = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 12288) {
        await reader.cancel();
        fail("invalid_body", "O pedido de teste excedeu o tamanho permitido.", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    try {
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      fail("invalid_body", "Confira os dados do pedido de teste.", 400);
    }
  };
  const emptyBody = async (request) => {
    const reader = request.body?.getReader();
    if (!reader) return;
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      if (value.length) {
        await reader.cancel();
        fail("invalid_body", "Esta ação usa somente a cobrança salva.", 400);
      }
    }
  };
  const credential = async (ctx) => {
    if (!ctx.current?.fields?.enabled?.booleanValue) fail("flow_disabled", "Ative a conexão Asaas Sandbox no perfil antes de testar.");
    const key = await decryptAsaasKey2(ctx.env, ctx.user.uid, ctx.current.fields);
    return { key, keyTag: await sandboxTag2(ctx.env, "aura:sandbox-key:v1:" + key), api: sandboxApi2(ctx.fetchAsaas, key, ctx.signal) };
  };
  const verifyPayment = (payment, document) => {
    if (payment?.id !== text(document, "paymentId") || payment.customer !== text(document, "customerId") || payment.externalReference !== text(document, "reference") || payment.billingType !== "PIX" || payment.value !== fromCents(number(document, "amountCents")) || typeof payment.status !== "string" || !/^[A-Z_]{3,64}$/.test(payment.status)) fail("flow_payment_mismatch", "A cobrança não corresponde ao pedido de teste. Nenhuma baixa foi realizada.");
  };
  const snapshotFor = async (ctx, input) => {
    if (input?.kind === "checkout") {
      if (!ownKeys(input, ["kind", "idempotencyKey", "items"]) || !/^[a-f0-9-]{36}$/.test(input.idempotencyKey || "") || !ID.test(input.idempotencyKey) || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 10) fail("invalid_checkout", "O teste do caixa aceita de 1 a 10 itens válidos.", 400);
      const items = input.items.map((item) => {
        if (!ownKeys(item, ["productId", "quantity", "lineTotalCents"]) || !SOURCE_ID.test(item.productId || "") || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999 || !Number.isSafeInteger(item.lineTotalCents) || item.lineTotalCents < item.quantity || item.lineTotalCents > 5e6) fail("invalid_checkout", "Confira os produtos, as quantidades e os preços do carrinho de teste.", 400);
        return { productId: item.productId, quantity: item.quantity, lineTotalCents: item.lineTotalCents };
      });
      const requested = aggregateSaleItems(items);
      const products = await Promise.all(requested.map(async (item) => {
        const doc = await ctx.load("artifacts/vendas-aura-main/users/" + ctx.user.uid + "/products/" + item.productId);
        if (!doc) fail("product_not_found", "Um produto do carrinho não está mais disponível.");
        const data = decodeDocument(doc);
        return { productId: item.productId, quantity: data.quantity, name: String(data.name || "Produto").slice(0, 160), costPrice: data.costPrice };
      }));
      let stockPlan;
      try {
        stockPlan = buildSaleInventoryPlan(requested, products);
      } catch {
        fail("invalid_stock", "O estoque atual não permite esse carrinho de teste. Atualize as quantidades.");
      }
      const amountCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
      return { id: input.idempotencyKey, amountCents, snapshot: { kind: "checkout", items, stockPlan, amountCents }, request: { kind: input.kind, items } };
    }
    if (input?.kind === "installment") {
      if (!ownKeys(input, ["kind", "saleId", "installmentIndex"]) || !SOURCE_ID.test(input.saleId || "") || !Number.isInteger(input.installmentIndex) || input.installmentIndex < 0 || input.installmentIndex > 119) fail("invalid_installment", "Confira a venda e a parcela de teste.", 400);
      const doc = await ctx.load("artifacts/vendas-aura-main/users/" + ctx.user.uid + "/sales/" + input.saleId);
      if (!doc) fail("sale_not_found", "A venda não foi encontrada.");
      const sale = decodeDocument(doc);
      const selected = sale.installments?.[input.installmentIndex];
      if (!isTermSale(sale) || sale.status === "canceled" || !selected || selected.paid || toCents(selected.amount) <= 0) fail("installment_unavailable", "Esta parcela não está mais disponível para o teste.");
      const marker = await sourceMarker(ctx.env, sale);
      const tag = await sandboxTag2(ctx.env, "aura:installment-order:v1:" + ctx.user.uid + ":" + input.saleId + ":" + input.installmentIndex + ":" + marker + ":" + ctx.keyTag);
      const sourceSlot = (await sandboxTag2(ctx.env, "aura:parcel-slot:v1:" + input.saleId + ":" + input.installmentIndex)).slice(0, 32);
      return { id: tag.slice(0, 32), sourceSlot, amountCents: toCents(selected.amount), snapshot: { kind: "installment", installments: sale.installments, installmentIndex: input.installmentIndex, saleId: input.saleId, sourceMarker: marker }, request: { kind: input.kind, saleId: input.saleId, installmentIndex: input.installmentIndex, sourceMarker: marker } };
    }
    fail("invalid_kind", "Escolha um teste do caixa ou de parcela.", 400);
  };
  const list = async (ctx) => {
    const response = await ctx.fetchGoogle(FIRESTORE_DOCUMENTS2 + root(ctx.user.uid) + "/pending?pageSize=10", { method: "GET", headers: ctx.headers, redirect: "manual", signal: ctx.signal });
    if (!response.ok) fail("flow_list_failed", "Não foi possível carregar os testes pendentes.", 503);
    const data = JSON.parse(await response.text());
    if (data.nextPageToken || data.documents !== void 0 && !Array.isArray(data.documents)) fail("flow_list_failed", "Não foi possível conferir os testes pendentes.", 503);
    const orders = (data.documents || []).map((doc) => {
      const id = text(doc, "id");
      if (!ID.test(id) || doc.name !== name(pendingPath(ctx.user.uid, id))) fail("flow_list_failed", "Não foi possível conferir um teste pendente.", 503);
      return { id, kind: text(doc, "kind"), amountCents: number(doc, "amountCents") };
    });
    return json2({ environment: "sandbox", simulationOnly: true, orders });
  };
  const settle = async (ctx, document, payment, source, eventId = "") => {
    checkOrder(document);
    verifyPayment(payment, document);
    const state = text(document, "state");
    if (eventId && text(document, "lastEventId") === eventId) return document;
    const received = payment.deleted !== true && payment.status === "RECEIVED";
    const refunded = payment.status === "REFUNDED";
    const cancelled = payment.deleted === true;
    let nextState = state;
    let result = JSON.parse(text(document, "resultJson") || "{}");
    if (received && active(state)) {
      const snapshot = JSON.parse(text(document, "snapshotJson"));
      if (snapshot.kind === "checkout") {
        result = { receivedCents: number(document, "amountCents"), stockUnits: snapshot.stockPlan.reduce((sum, item) => sum + item.requestedQuantity, 0), stockPlan: snapshot.stockPlan, saleStatus: "completed" };
      } else {
        const original = await ctx.load("artifacts/vendas-aura-main/users/" + ctx.user.uid + "/sales/" + snapshot.saleId);
        if (!original || await sourceMarker(ctx.env, decodeDocument(original)) !== snapshot.sourceMarker) nextState = "review";
        else {
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const dateParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(/* @__PURE__ */ new Date());
          const date = ["year", "month", "day"].map((type) => dateParts.find((part) => part.type === type)?.value).join("-");
          const applied = applyInstallmentPayment(snapshot.installments, snapshot.installmentIndex, fromCents(number(document, "amountCents")), date, now);
          applied.historyItem.provider = "asaas-sandbox";
          applied.historyItem.providerPaymentId = payment.id;
          result = { receivedCents: number(document, "amountCents"), remainingCents: toCents(applied.remainingBalance), installmentPaid: applied.installments[snapshot.installmentIndex].paid, installments: applied.installments, saleStatus: applied.allPaid ? "completed" : "active" };
        }
      }
      if (nextState !== "review") nextState = "received";
    } else if (refunded && (state === "received" || active(state))) {
      nextState = "refunded";
      result = { receivedCents: 0, refundedCents: number(document, "amountCents") };
    } else if (received && !["received", "review"].includes(state) || cancelled && payment.status === "RECEIVED" && active(state)) nextState = "review";
    else if (cancelled && active(state)) nextState = "cancelled";
    if (nextState === state && !active(state)) return document;
    const fields = { state: str(nextState), providerStatus: str(cancelled ? "DELETED" : payment.status), lastEventId: str(eventId || text(document, "lastEventId")), updatedAt: stamp((/* @__PURE__ */ new Date()).toISOString()) };
    const writes = [];
    const finishing = active(state) && !active(nextState);
    if (finishing) {
      writes.push(...await releaseWrites(ctx, document));
    }
    if (nextState !== state && ["received", "refunded", "review"].includes(nextState)) {
      Object.assign(fields, { resultJson: str(JSON.stringify(result)), receiptId: str(payment.id), confirmationSource: str(source) });
      const receipt = await ctx.load(receiptPath(ctx.user.uid, payment.id));
      if (nextState === "received" && receipt) fail("flow_receipt_conflict", "Este pagamento já possui um resultado salvo. Confira o andamento do teste.", 503);
      writes.push(update(receiptPath(ctx.user.uid, payment.id), receipt, { orderId: str(text(document, "id")), paymentId: str(payment.id), state: str(nextState), amountCents: int(number(document, "amountCents")), simulationOnly: bool(true), resultJson: str(JSON.stringify(result)) }));
    }
    writes.unshift(update(orderPath(ctx.user.uid, text(document, "id")), document, fields));
    await commit(ctx, writes);
    return ctx.load(orderPath(ctx.user.uid, text(document, "id")));
  };
  const handleRequest = async (ctx) => {
    const path = new URL(ctx.request.url).pathname;
    if (path === BASE && ctx.request.method === "GET") return list(ctx);
    const credentials = await credential(ctx);
    Object.assign(ctx, credentials);
    let id;
    let document;
    if (path === BASE) {
      const input = await readBody(ctx.request);
      const diagnostic = await ctx.load("_asaas_sandbox_checks/" + ctx.user.uid);
      if (text(diagnostic, "keyTag") !== ctx.keyTag || text(diagnostic, "providerStatus") !== "RECEIVED" || !diagnostic?.fields?.webhookAt?.timestampValue) fail("flow_diagnostic_required", "Conclua primeiro o teste de cobrança e retorno automático no perfil.");
      if (input?.kind === "checkout" && ID.test(input.idempotencyKey || "")) {
        document = await ctx.load(orderPath(ctx.user.uid, input.idempotencyKey));
        if (document) {
          const fingerprint = await sandboxTag2(ctx.env, "aura:flow-request:v1:" + canonical({ kind: input.kind, items: input.items }));
          if (!ownKeys(input, ["kind", "idempotencyKey", "items"]) || fingerprint !== text(document, "requestHash")) fail("flow_intent_changed", "Este teste pertence a outro carrinho. Abra uma nova cobrança de teste.");
        }
      }
      let prepared;
      if (!document) prepared = await snapshotFor(ctx, input);
      id = document ? text(document, "id") : prepared.id;
      if (prepared?.sourceSlot) {
        const slot = await ctx.load(root(ctx.user.uid) + "/slots/" + prepared.sourceSlot);
        if (slot && text(slot, "orderId") !== id) fail("flow_installment_pending", "Já existe um teste pendente desta parcela. Retome ou cancele esse teste pelo perfil.");
      }
      if (!document) document = await ctx.load(orderPath(ctx.user.uid, id));
      if (!document) {
        if (prepared.amountCents < 500 || prepared.amountCents > 5e6) fail("flow_amount_invalid", "Neste teste, o valor deve ficar entre R$ 5,00 e R$ 50.000,00.", 400);
        const snapshotJson = JSON.stringify(prepared.snapshot);
        if (new TextEncoder().encode(snapshotJson).length > 64e3) fail("flow_snapshot_large", "Este contrato é muito grande para o teste. Escolha outra parcela.", 400);
        const integration = await ctx.load("_asaas_integrations/" + ctx.user.uid);
        if (!integration?.fields?.enabled?.booleanValue || await sandboxTag2(ctx.env, "aura:sandbox-key:v1:" + await decryptAsaasKey2(ctx.env, ctx.user.uid, integration.fields)) !== ctx.keyTag) fail("flow_credential_changed", "A conexão mudou. Reabra o perfil antes de gerar o teste.");
        const count = number(integration, "pendingCharges");
        if (!Number.isInteger(count) || count < 0 || count >= 5) fail("flow_pending_limit", "Conclua ou cancele os testes pendentes no perfil antes de criar outro.");
        const fields = { id: str(id), kind: str(input.kind), state: str("creating"), amountCents: int(prepared.amountCents), snapshotJson: str(snapshotJson), requestHash: str(await sandboxTag2(ctx.env, "aura:flow-request:v1:" + canonical(prepared.request))), keyTag: str(ctx.keyTag), reference: str("aura-flow-" + id), simulationOnly: bool(true), flowVersion: int(1), sourceSlot: str(prepared.sourceSlot || ""), createdAt: stamp((/* @__PURE__ */ new Date()).toISOString()), leaseUntil: stamp((/* @__PURE__ */ new Date(0)).toISOString()) };
        const writes = [update(orderPath(ctx.user.uid, id), null, fields), update(pendingPath(ctx.user.uid, id), null, { id: str(id), kind: str(input.kind), amountCents: int(prepared.amountCents) }), update("_asaas_integrations/" + ctx.user.uid, integration, { pendingCharges: int(count + 1) })];
        if (prepared.sourceSlot) writes.push(update(root(ctx.user.uid) + "/slots/" + prepared.sourceSlot, null, { orderId: str(id) }));
        await commit(ctx, writes);
        document = await ctx.load(orderPath(ctx.user.uid, id));
      }
    } else {
      id = path.slice(BASE.length + 1).split("/")[0];
      document = await ctx.load(orderPath(ctx.user.uid, id));
      if (!document) fail("flow_not_found", "A cobrança de teste não foi encontrada.", 404);
    }
    checkOrder(document);
    if (ctx.request.method === "GET") return json2(view(document));
    if (text(document, "keyTag") !== ctx.keyTag) fail("flow_credential_changed", "Este teste pertence à conexão anterior. Confira a cobrança no Asaas Sandbox.");
    const action = path.slice(BASE.length + 1 + id.length + 1);
    if (path !== BASE) await emptyBody(ctx.request);
    if (path === BASE || action === "prepare") {
      if (!active(text(document, "state"))) return json2(view(document));
      const internal = new Request("https://worker.internal/api/integrations/asaas/sandbox-charge", { method: "POST" });
      await handleSandboxCheck2({ ...ctx, request: internal, checkPath: orderPath(ctx.user.uid, id) });
      document = await ctx.load(orderPath(ctx.user.uid, id));
      if (active(text(document, "state"))) {
        const indexPath = root(ctx.user.uid) + "/payments/" + text(document, "paymentId");
        const index = await ctx.load(indexPath);
        await commit(ctx, [update(orderPath(ctx.user.uid, id), document, { state: str("pending") }), update(indexPath, index, { orderId: str(id) })]);
      }
      return json2(view(await ctx.load(orderPath(ctx.user.uid, id))));
    }
    if (action === "simulate") {
      if (!active(text(document, "state"))) return json2(view(document));
      const internal = new Request("https://worker.internal/api/integrations/asaas/sandbox-charge/simulate", { method: "POST" });
      await handleSandboxCheck2({ ...ctx, request: internal, checkPath: orderPath(ctx.user.uid, id) });
      return json2({ ...view(await ctx.load(orderPath(ctx.user.uid, id))), message: "Simulação enviada. Aguarde a confirmação automática do Asaas." });
    }
    if (!text(document, "paymentId")) {
      if (action === "cancel" && active(text(document, "state")) && text(document, "pendingCreate") !== "payment") {
        await commit(ctx, [update(orderPath(ctx.user.uid, id), document, { state: str("cancelled") }), ...await releaseWrites(ctx, document)]);
        return json2(view(await ctx.load(orderPath(ctx.user.uid, id))));
      }
      fail("flow_not_prepared", "Retome a preparação deste teste antes de conferir ou cancelar.");
    }
    let payment = await ctx.api("/payments/" + text(document, "paymentId"));
    verifyPayment(payment, document);
    if (action === "cancel" && active(text(document, "state")) && payment.deleted !== true && payment.status === "CONFIRMED") fail("flow_cancellation_blocked", "O Asaas ainda está analisando a cobrança. Aguarde a conclusão para confirmar ou cancelar o teste.");
    if (action === "cancel" && active(text(document, "state")) && payment.deleted !== true && ["PENDING", "OVERDUE"].includes(payment.status)) {
      await ctx.api("/payments/" + payment.id, "DELETE");
      payment = await ctx.api("/payments/" + payment.id);
      verifyPayment(payment, document);
      if (payment.deleted !== true && !["RECEIVED", "REFUNDED"].includes(payment.status)) fail("flow_cancel_unknown", "O cancelamento ainda não foi confirmado pelo Asaas. Confira o andamento antes de repetir.");
    }
    return json2(view(await settle(ctx, document, payment, "reconciliation")));
  };
  const handleWebhook = async (ctx) => {
    const reference = ctx.event.payment.externalReference;
    const index = await ctx.load(root(ctx.user.uid) + "/payments/" + ctx.event.payment.id);
    const id = index ? text(index, "orderId") : typeof reference === "string" && reference.startsWith("aura-flow-") ? reference.slice(10) : "";
    if (!ID.test(id)) return json2({ accepted: true });
    const document = await ctx.load(orderPath(ctx.user.uid, id));
    if (!document) return json2({ accepted: true });
    checkOrder(document);
    if (!text(document, "paymentId")) fail("flow_webhook_retry", "A cobrança ainda está sendo registrada. Repetir entrega.", 503);
    if (text(document, "paymentId") !== ctx.event.payment.id) return json2({ accepted: true });
    ctx.current = await ctx.load("_asaas_integrations/" + ctx.user.uid);
    const profile = await ctx.load("artifacts/vendas-aura-main/users/" + ctx.user.uid + "/profile/info");
    if (profile?.fields?.approved?.booleanValue !== true || !["", "active"].includes(profile.fields.status?.stringValue || "") || !ctx.current?.fields?.enabled?.booleanValue) return json2({ accepted: true });
    Object.assign(ctx, await credential(ctx));
    if (text(document, "keyTag") !== ctx.keyTag) return json2({ accepted: true });
    const payment = await ctx.api("/payments/" + ctx.event.payment.id);
    try {
      await settle(ctx, document, payment, "webhook", ctx.event.id);
    } catch (error) {
      if (error.code === "flow_conflict") fail("flow_webhook_retry", "O teste mudou. Repetir entrega.", 503);
      throw error;
    }
    return json2({ accepted: true });
  };
  return {
    methods: (path) => path === BASE ? ["GET", "POST"] : new RegExp("^" + BASE + "/(?:[a-f0-9]{32}|[a-f0-9-]{36})(?:/(prepare|simulate|reconcile|cancel))?$").test(path) ? path.slice(BASE.length + 1).includes("/") ? ["POST"] : ["GET"] : [],
    matches: (path) => path === BASE || path.startsWith(BASE + "/"),
    handleRequest,
    handleWebhook
  };
}

// worker.entry.js
var SANDBOX_URL = "https://api-sandbox.asaas.com/v3";
var TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
var FIREBASE_PROJECT = "vendas-aura";
var GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
var FIRESTORE_PROBE_URL = "https://firestore.googleapis.com/v1/projects/vendas-aura/databases/(default)/documents/_pix_connection_check?pageSize=1&mask.fieldPaths=connectionTest";
var FIRESTORE_PROBE_COLLECTION = "https://firestore.googleapis.com/v1/projects/vendas-aura/databases/(default)/documents/_pix_connection_check";
var FIRESTORE_DOCUMENTS = "https://firestore.googleapis.com/v1/projects/vendas-aura/databases/(default)/documents/";
var FIREBASE_WEB_API_KEY = "AIzaSyDQQcD2tzsVS8Xzy-GpHT897kB7EC-S8Ng";
var DEFAULT_APP_ORIGIN = "https://washingtonbarbalho.github.io";
var INTEGRATION_PATH = "/api/integrations/asaas";
var SANDBOX_CHECK_PATH = INTEGRATION_PATH + "/sandbox-charge";
var WEBHOOK_PATH = "/api/webhooks/asaas/sandbox/";
var PUBLIC_WORKER_URL = "https://registro-vendas-pix-testes.washington-wn8.workers.dev";
var SANDBOX_EVENTS = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_REFUNDED", "PAYMENT_DELETED", "PAYMENT_OVERDUE", "PAYMENT_RESTORED", "PAYMENT_UPDATED"];
var defaultAsaasFetch = (input, init) => fetch(input, init);
var SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000"
};
function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8" }
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
  <title>Registro de Vendas · Teste Asaas e Firebase</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#f1f5f9;color:#0f172a;font:16px/1.5 system-ui,sans-serif;padding:28px 16px}main{max-width:620px;margin:24px auto;background:white;padding:28px;border-radius:20px;border:1px solid #cbd5e1}h1{font-size:25px;line-height:1.2;margin:12px 0}p{color:#475569}.tag{display:inline-block;background:#dbeafe;color:#1e40af;padding:4px 10px;border-radius:20px;font-weight:700;font-size:13px}label{display:block;font-weight:700;margin-bottom:8px}input{width:100%;padding:12px;font:inherit;border:1px solid #94a3b8;border-radius:10px}button{cursor:pointer;border:0;border-radius:10px;padding:12px 16px;font:inherit;font-weight:700;background:#0f172a;color:white}button.secondary{background:#e2e8f0;color:#0f172a}button:disabled{opacity:.6;cursor:wait}.actions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 18px}.primary{width:100%}code{font-size:14px;overflow-wrap:anywhere}ol{padding-left:22px;color:#475569}li{margin:8px 0}.result{padding:16px;border-radius:10px;margin-top:18px;background:#f1f5f9;white-space:pre-wrap}.result.success{background:#dcfce7;color:#14532d}.result.error{background:#fee2e2;color:#991b1b}.small{font-size:13px}a{color:#1d4ed8}
  </style>
</head>
<body>
<main>
  <span class="tag">Etapa 5 · Cobrança isolada Sandbox</span>
  <h1>Teste de conexão com o Asaas e Firebase</h1>
  <p>As conexões e a proteção já foram validadas. O teste de cobrança e retorno automático está em <strong>Meu Perfil</strong> no sistema. Os diagnósticos anteriores continuam disponíveis abaixo. Use o mesmo código <code>SETUP_TOKEN</code>.</p>
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
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`
    }
  });
}
function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
var IntegrationError = class extends Error {
  /** @param {string} code @param {string} message @param {number} [status] */
  constructor(code, message, status = 503) {
    super(message);
    this.code = code;
    this.status = status;
  }
};
function decodeBase64url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid_base64url");
  const encoded = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(encoded + "=".repeat((4 - encoded.length % 4) % 4)), (char) => char.charCodeAt(0));
}
async function encryptionKey(env) {
  if (typeof env.PIX_ENCRYPTION_KEY !== "string" || !TOKEN_PATTERN.test(env.PIX_ENCRYPTION_KEY.trim())) {
    throw new IntegrationError("integration_setup_required", "A proteção da integração ainda precisa ser configurada pelo administrador.");
  }
  const raw = Uint8Array.from(env.PIX_ENCRYPTION_KEY.trim().match(/../g) || [], (byte) => parseInt(byte, 16));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encryptAsaasKey(env, uid, apiKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode("vendas-aura:asaas:sandbox:v1:" + uid);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData }, await encryptionKey(env), new TextEncoder().encode(apiKey));
  return { cipher: base64url(new Uint8Array(encrypted)), iv: base64url(iv) };
}
async function decryptAsaasKey(env, uid, fields) {
  if (fields.environment?.stringValue !== "sandbox" || fields.version?.integerValue !== "1") throw new IntegrationError("integration_format_invalid", "A configuração salva precisa ser refeita.");
  try {
    const iv = decodeBase64url(fields.iv?.stringValue);
    if (iv.length !== 12) throw new Error("invalid_iv");
    const additionalData = new TextEncoder().encode("vendas-aura:asaas:sandbox:v1:" + uid);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData }, await encryptionKey(env), decodeBase64url(fields.cipher?.stringValue));
    return new TextDecoder("utf-8", { fatal: true }).decode(decrypted);
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    throw new IntegrationError("integration_key_unreadable", "Não foi possível abrir a chave salva. Confira a configuração de proteção antes de substituir a integração.");
  }
}
async function checkEncryption(env) {
  try {
    const sample = crypto.randomUUID();
    const encrypted = await encryptAsaasKey(env, "diagnostic-only", sample);
    const decrypted = await decryptAsaasKey(env, "diagnostic-only", { environment: { stringValue: "sandbox" }, version: { integerValue: "1" }, cipher: { stringValue: encrypted.cipher }, iv: { stringValue: encrypted.iv } });
    if (decrypted !== sample) throw new Error("encryption_check_failed");
    return json({ code: "encryption_ready", encryptionReady: true, message: "Proteção configurada e testada. O Worker consegue proteger e recuperar as chaves das integrações. A próxima etapa é conectar o Asaas Sandbox pelo perfil do sistema." });
  } catch (error) {
    return json({ code: "encryption_setup_required", message: error instanceof IntegrationError ? "Cadastre a chave gerada nesta página como Secret PIX_ENCRYPTION_KEY e clique em Deploy." : "Não foi possível validar a proteção. Confira o Secret PIX_ENCRYPTION_KEY." }, 503);
  }
}
async function authenticatedUser(request, fetchGoogle) {
  const bearer = request.headers.get("Authorization") || "";
  const token = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
  const unauthorized = () => new IntegrationError("login_required", "Entre novamente no sistema para configurar o Asaas.", 401);
  if (!token || token.length > 8192) throw unauthorized();
  let claims;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw unauthorized();
    const header = JSON.parse(new TextDecoder().decode(decodeBase64url(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(decodeBase64url(parts[1])));
    const now = Date.now() / 1e3;
    if (header.alg !== "RS256" || claims.aud !== FIREBASE_PROJECT || claims.iss !== "https://securetoken.google.com/vendas-aura" || typeof claims.sub !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(claims.sub) || !Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 60 || !Number.isFinite(claims.auth_time) || claims.auth_time > now + 60) throw unauthorized();
  } catch {
    throw unauthorized();
  }
  const response = await fetchGoogle("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + FIREBASE_WEB_API_KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ idToken: token }),
    redirect: "manual",
    signal: AbortSignal.timeout(1e4)
  });
  if (!response.ok) {
    if ([400, 401].includes(response.status)) throw unauthorized();
    throw new IntegrationError("login_check_unavailable", "Não foi possível validar seu acesso. Tente novamente.");
  }
  const data = JSON.parse(await response.text());
  const user = Array.isArray(data?.users) && data.users.length === 1 ? data.users[0] : null;
  if (!user || user.localId !== claims.sub || user.disabled === true || Number(user.validSince || 0) > claims.auth_time) throw unauthorized();
  return { uid: user.localId, email: typeof user.email === "string" && user.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) ? user.email : "" };
}
async function loadPrivateDocument(fetchGoogle, headers, signal, path) {
  const response = await fetchGoogle(FIRESTORE_DOCUMENTS + path, { method: "GET", headers, redirect: "manual", signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new IntegrationError("integration_read_failed", "Não foi possível carregar a configuração da integração.");
  const data = JSON.parse(await response.text());
  if (data?.name !== "projects/vendas-aura/databases/(default)/documents/" + path || !data.fields || typeof data.fields !== "object" || Array.isArray(data.fields) || typeof data.updateTime !== "string" || !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(data.updateTime)) throw new IntegrationError("integration_read_failed", "Não foi possível conferir a configuração salva.");
  return data;
}
async function sandboxTag(env, message) {
  await encryptionKey(env);
  const raw = Uint8Array.from(env.PIX_ENCRYPTION_KEY.trim().match(/../g) || [], (byte) => parseInt(byte, 16));
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
var stringField = (value) => ({ stringValue: value });
var timeField = (value) => ({ timestampValue: value });
var boolField = (value) => ({ booleanValue: value });
var fieldString = (document, field) => document?.fields?.[field]?.stringValue || "";
var providerId = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{5,128}$/.test(value);
function sandboxApi(fetchAsaas, apiKey, signal) {
  return async (path, method = "GET", body) => {
    const response = await fetchAsaas(SANDBOX_URL + path, {
      method,
      redirect: "manual",
      signal,
      headers: { accept: "application/json", access_token: apiKey, "User-Agent": "RegistroDeVendas-Pix-Sandbox/2.0", ...body === void 0 ? {} : { "Content-Type": "application/json" } },
      ...body === void 0 ? {} : { body: JSON.stringify(body) }
    });
    if (!response.ok) {
      const error = new IntegrationError("sandbox_provider_failed", [401, 403].includes(response.status) ? "O Asaas recusou o acesso. Confira as permissões da chave Sandbox para clientes, cobranças e Webhooks." : response.status === 400 ? "O Asaas recusou os dados do teste. Confira se a conta Sandbox está aprovada e permite cobranças Pix e Webhooks." : "O Asaas não concluiu o teste. Aguarde um pouco e tente novamente.", 502);
      error.definitive = [400, 401, 403, 404, 422, 429].includes(response.status);
      throw error;
    }
    try {
      return JSON.parse(await response.text());
    } catch {
      throw new IntegrationError("sandbox_response_invalid", "O Asaas respondeu em um formato inesperado. Reabra o perfil para conferir o andamento do teste.");
    }
  };
}
function sandboxStatus(document, message = "") {
  const fields = document?.fields || {};
  const status = fieldString(document, "providerStatus");
  const complete = fields.setupComplete?.booleanValue === true;
  const received = status === "RECEIVED";
  const webhookVerified = !!fields.webhookAt?.timestampValue;
  return {
    environment: "sandbox",
    created: !!fieldString(document, "paymentId"),
    ready: complete,
    status: status || "NOT_CREATED",
    received,
    webhookVerified,
    testComplete: complete && received && webhookVerified,
    paymentId: fieldString(document, "paymentId"),
    amount: Number(fields.amountCents?.integerValue || 500) / 100,
    payload: complete ? fieldString(document, "payload") : "",
    encodedImage: complete ? fieldString(document, "encodedImage") : "",
    expirationDate: fieldString(document, "expirationDate"),
    message: message || (complete && received && webhookVerified ? "Teste completo: o pagamento simulado foi recebido e o retorno automático do Asaas foi validado. Nenhuma venda ou parcela foi alterada." : complete && received ? "O Asaas indica recebimento. Aguardando o retorno automático autenticado." : status === "CONFIRMED" ? "O Asaas confirmou a simulação. Aguardando o recebimento e o retorno automático." : complete && !["PENDING", "OVERDUE", "RECEIVED"].includes(status) ? "A cobrança de teste foi alterada no Asaas e não permite simular outro pagamento. Nenhuma venda ou parcela foi alterada." : complete ? "Cobrança de teste criada. Simule o pagamento para validar o retorno automático." : "Prepare uma cobrança isolada de R$ 5,00 no Sandbox. Nenhum valor real será movimentado.")
  };
}
function checkSandboxPayment(payment, document) {
  if (!providerId(payment?.id) || fieldString(document, "paymentId") && payment.id !== fieldString(document, "paymentId") || payment.customer !== fieldString(document, "customerId") || payment.externalReference !== fieldString(document, "reference") || payment.billingType !== "PIX" || payment.value !== Number(document?.fields?.amountCents?.integerValue || 500) / 100 || typeof payment.status !== "string" || !/^[A-Z_]{3,64}$/.test(payment.status)) {
    throw new IntegrationError("sandbox_payment_mismatch", "Os dados da cobrança não correspondem ao teste. Nenhuma confirmação foi registrada.", 409);
  }
}
async function handleSandboxCheck({ request, user, env, current, headers, signal, load, fetchGoogle, fetchAsaas, checkPath }) {
  if (!current || current.fields.enabled?.booleanValue !== true) throw new IntegrationError("sandbox_disabled", "Ative a conexão Asaas Sandbox no perfil antes de testar.", 409);
  const apiKey = await decryptAsaasKey(env, user.uid, current.fields);
  const keyTag = await sandboxTag(env, "aura:sandbox-key:v1:" + apiKey);
  const path = checkPath || "_asaas_sandbox_checks/" + user.uid;
  let document = await load(path);
  if (fieldString(document, "keyTag") !== keyTag) document = null;
  const action = new URL(request.url).pathname;
  if (request.method === "GET") return json(sandboxStatus(document));
  if (request.body) {
    const reader = request.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value.length) {
        await reader.cancel();
        throw new IntegrationError("invalid_body", "O teste usa somente a cobrança preparada pelo sistema.", 400);
      }
    }
  }
  const api = sandboxApi(fetchAsaas, apiKey, signal);
  if (action === SANDBOX_CHECK_PATH + "/simulate") {
    if (!document?.fields?.setupComplete?.booleanValue) throw new IntegrationError("sandbox_not_ready", "Prepare a cobrança de teste antes de simular o pagamento.", 409);
    const paymentId = fieldString(document, "paymentId");
    const payment = await api("/payments/" + paymentId);
    checkSandboxPayment(payment, document);
    if (payment.deleted === true || !["PENDING", "OVERDUE", "CONFIRMED", "RECEIVED"].includes(payment.status)) throw new IntegrationError("sandbox_status_invalid", "Esta cobrança não permite a simulação. Confira o status no painel Asaas Sandbox.", 409);
    if (["PENDING", "OVERDUE"].includes(payment.status)) await api("/sandbox/payment/" + paymentId + "/confirm", "POST");
    return json(sandboxStatus(document, "Simulação enviada ao Asaas Sandbox. Aguarde o retorno automático nesta tela."));
  }
  if (!user.email) throw new IntegrationError("sandbox_email_required", "Sua conta precisa ter um e-mail válido para configurar o retorno do Asaas.", 409);
  const original = await load(path);
  document = fieldString(original, "keyTag") === keyTag ? original : null;
  let version = original?.updateTime || "";
  if (document && Date.parse(document.fields.leaseUntil?.timestampValue || "") > Date.now()) throw new IntegrationError("sandbox_busy", "A preparação já está em andamento. Aguarde um minuto antes de tentar novamente.", 409);
  const save = async (fields) => {
    const params = new URLSearchParams(version ? { "currentDocument.updateTime": version } : { "currentDocument.exists": "false" });
    for (const field of Object.keys(fields)) params.append("updateMask.fieldPaths", field);
    const response = await fetchGoogle(FIRESTORE_DOCUMENTS + path + "?" + params, { method: "PATCH", headers, redirect: "manual", signal, body: JSON.stringify({ fields }) });
    if ([409, 412].includes(response.status)) throw new IntegrationError("sandbox_changed", "O teste mudou durante esta operação. Atualize a tela e tente novamente.", 409);
    if (!response.ok) throw new IntegrationError("sandbox_save_failed", "Não foi possível salvar o andamento do teste. Aguarde um minuto e tente novamente.");
    const next = JSON.parse(await response.text());
    if (next?.name !== "projects/vendas-aura/databases/(default)/documents/" + path || !next.updateTime || !next.fields) throw new IntegrationError("sandbox_save_failed", "Não foi possível conferir o andamento do teste. Aguarde um minuto e tente novamente.");
    document = next;
    version = next.updateTime;
  };
  const until = new Date(Date.now() + 9e4).toISOString();
  if (!document) {
    const reset = { keyTag: stringField(keyTag), reference: stringField("aura-sandbox-" + crypto.randomUUID()), customerId: stringField(""), paymentId: stringField(""), webhookId: stringField(""), pendingCreate: stringField(""), providerStatus: stringField(""), payload: stringField(""), encodedImage: stringField(""), expirationDate: stringField(""), setupComplete: boolField(false), webhookAt: { nullValue: null }, lastEventId: stringField(""), leaseUntil: timeField(until) };
    await save(reset);
  } else await save({ leaseUntil: timeField(until) });
  try {
    const reference = fieldString(document, "reference");
    const find = async (collection, externalReference, matches) => {
      const list = await api("/" + collection + "?externalReference=" + encodeURIComponent(externalReference) + "&limit=2");
      if (!Array.isArray(list?.data) || list.data.length > 1 || list.hasMore === true || list.data.some((item) => !matches(item))) throw new IntegrationError("sandbox_duplicates", "Não foi possível identificar um único registro para este teste. Confira os registros de teste no Asaas Sandbox.", 409);
      return list.data[0] || null;
    };
    const create = async (kind, providerPath, body, recover, validate, checkpoint) => {
      const found = await recover();
      if (found) {
        validate(found);
        await save({ ...checkpoint(found), pendingCreate: stringField("") });
        return;
      }
      if (fieldString(document, "pendingCreate") === kind) throw new IntegrationError("sandbox_creation_unknown", "Uma criação anterior ficou sem confirmação. O sistema evitou repetir a cobrança. Confira o painel Asaas Sandbox e envie esta mensagem para continuarmos.", 409);
      await save({ pendingCreate: stringField(kind) });
      let created;
      try {
        created = await api(providerPath, "POST", body);
      } catch (error) {
        if (error.definitive) await save({ pendingCreate: stringField("") });
        throw error;
      }
      validate(created);
      await save({ ...checkpoint(created), pendingCreate: stringField("") });
    };
    const webhookUrl = PUBLIC_WORKER_URL + WEBHOOK_PATH + user.uid;
    const authToken = await sandboxTag(env, "aura:sandbox-webhook:v1:" + user.uid);
    const webhookBody = { name: "Registro de Vendas - teste isolado", url: webhookUrl, email: user.email, enabled: true, interrupted: false, authToken, events: SANDBOX_EVENTS, sendType: "SEQUENTIALLY", apiVersion: 3 };
    const hooks = await api("/webhooks?limit=100");
    if (!Array.isArray(hooks?.data) || hooks.hasMore === true) throw new IntegrationError("sandbox_webhook_invalid", "Não foi possível conferir os Webhooks da conta Sandbox.");
    const ownHooks = hooks.data.filter((hook) => hook.url === webhookUrl);
    if (ownHooks.length > 1 || ownHooks.length && !providerId(ownHooks[0].id)) throw new IntegrationError("sandbox_webhook_invalid", "Existe mais de um retorno para este teste. Confira os Webhooks no Asaas Sandbox.", 409);
    if (ownHooks.length) {
      const hook = await api("/webhooks/" + ownHooks[0].id, "PUT", webhookBody);
      if (hook?.id !== ownHooks[0].id || hook.url !== webhookUrl) throw new IntegrationError("sandbox_webhook_invalid", "Não foi possível confirmar a configuração do retorno automático.");
      await save({ webhookId: stringField(hook.id), ...fieldString(document, "pendingCreate") === "webhook" ? { pendingCreate: stringField("") } : {} });
    } else {
      await create(
        "webhook",
        "/webhooks",
        webhookBody,
        async () => null,
        (hook) => {
          if (!providerId(hook?.id) || hook.url !== webhookUrl) throw new IntegrationError("sandbox_webhook_invalid", "Não foi possível conferir o retorno automático.");
        },
        (hook) => ({ webhookId: stringField(hook.id) })
      );
    }
    if (!fieldString(document, "customerId")) {
      const validate = (customer) => {
        if (!providerId(customer?.id) || customer.externalReference !== reference || customer.deleted === true) throw new IntegrationError("sandbox_customer_invalid", "Não foi possível conferir o cliente fictício de teste.");
      };
      await create(
        "customer",
        "/customers",
        { name: "Cliente Teste Registro de Vendas", cpfCnpj: "24971563792", notificationDisabled: true, externalReference: reference },
        () => find("customers", reference, (customer) => customer.externalReference === reference),
        validate,
        (customer) => ({ customerId: stringField(customer.id) })
      );
    }
    if (!fieldString(document, "paymentId")) {
      const dateParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(/* @__PURE__ */ new Date());
      const dueDate = ["year", "month", "day"].map((type) => dateParts.find((part) => part.type === type)?.value).join("-");
      await create(
        "payment",
        "/payments",
        { customer: fieldString(document, "customerId"), billingType: "PIX", value: Number(document.fields.amountCents?.integerValue || 500) / 100, dueDate, description: "Teste isolado do Registro de Vendas - sem valor real", externalReference: reference, interest: { value: 0 }, fine: { value: 0 }, discount: { value: 0 } },
        () => find("payments", reference, (payment2) => payment2.externalReference === reference),
        (payment2) => checkSandboxPayment(payment2, document),
        (payment2) => ({ paymentId: stringField(payment2.id), providerStatus: stringField(payment2.status) })
      );
    }
    const payment = await api("/payments/" + fieldString(document, "paymentId"));
    checkSandboxPayment(payment, document);
    if (payment.deleted === true) throw new IntegrationError("sandbox_payment_deleted", "A cobrança de teste foi excluída no Asaas Sandbox. Envie esta mensagem para prepararmos outro teste.", 409);
    let qrFields = {};
    if (!document.fields.setupComplete?.booleanValue) {
      const qr = await api("/payments/" + payment.id + "/pixQrCode");
      if (typeof qr?.payload !== "string" || qr.payload.length < 30 || qr.payload.length > 8192 || typeof qr.encodedImage !== "string" || !/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(qr.encodedImage) || qr.encodedImage.length > 2e5 || typeof qr.expirationDate !== "string" || qr.expirationDate.length > 64) throw new IntegrationError("sandbox_qr_invalid", "A cobrança existe, mas o Asaas ainda não retornou um QR Code válido. Tente preparar o teste novamente.");
      qrFields = { payload: stringField(qr.payload), encodedImage: stringField(qr.encodedImage), expirationDate: stringField(qr.expirationDate) };
    }
    await save({ ...qrFields, setupComplete: boolField(true), providerStatus: stringField(payment.status), leaseUntil: timeField((/* @__PURE__ */ new Date(0)).toISOString()) });
    return json(sandboxStatus(document));
  } catch (error) {
    try {
      await save({ leaseUntil: timeField((/* @__PURE__ */ new Date(0)).toISOString()) });
    } catch {
    }
    throw error;
  }
}
async function handleSandboxWebhook(request, env, uid, fetchGoogle, fetchAsaas, flow) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return json({ code: "not_found" }, 404);
  if (request.method !== "POST") return json({ code: "method_not_allowed" }, 405);
  try {
    const token = request.headers.get("asaas-access-token") || "";
    if (!TOKEN_PATTERN.test(token) || !equalToken(token, await sandboxTag(env, "aura:sandbox-webhook:v1:" + uid))) return json({ code: "unauthorized" }, 401);
    if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) return json({ code: "invalid_body" }, 400);
    const reader = request.body?.getReader();
    const chunks = [];
    let length = 0;
    if (!reader) return json({ code: "invalid_body" }, 400);
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 131072) {
        await reader.cancel();
        return json({ code: "invalid_body" }, 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let event;
    try {
      event = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      return json({ code: "invalid_body" }, 400);
    }
    if (!event || typeof event.id !== "string" || event.id.length > 200 || !event.id || !providerId(event.payment?.id)) return json({ code: "invalid_event" }, 400);
    if (!SANDBOX_EVENTS.includes(event.event)) return json({ accepted: true });
    return await checkFirebase(env, fetchGoogle, false, async (accessToken, signal) => {
      const headers = { accept: "application/json", "Content-Type": "application/json", Authorization: "Bearer " + accessToken };
      const load = (path2) => loadPrivateDocument(fetchGoogle, headers, signal, path2);
      const path = "_asaas_sandbox_checks/" + uid;
      const document = await load(path);
      if (!document || event.payment.id !== fieldString(document, "paymentId")) return flow.handleWebhook({ user: { uid }, event, env, headers, signal, load, fetchGoogle, fetchAsaas });
      if (fieldString(document, "lastEventId") === event.id) return json({ accepted: true });
      const current = await load("_asaas_integrations/" + uid);
      const profile = await load("artifacts/vendas-aura-main/users/" + uid + "/profile/info");
      if (!current?.fields?.enabled?.booleanValue || profile?.fields?.approved?.booleanValue !== true || !["", "active"].includes(profile.fields.status?.stringValue || "")) return json({ accepted: true });
      const apiKey = await decryptAsaasKey(env, uid, current.fields);
      if (fieldString(document, "keyTag") !== await sandboxTag(env, "aura:sandbox-key:v1:" + apiKey)) return json({ accepted: true });
      const api = sandboxApi(fetchAsaas, apiKey, signal);
      const payment = await api("/payments/" + fieldString(document, "paymentId"));
      checkSandboxPayment(payment, document);
      const fields = { providerStatus: stringField(payment.deleted === true ? "DELETED" : payment.status), webhookAt: timeField((/* @__PURE__ */ new Date()).toISOString()), lastEventId: stringField(event.id) };
      const params = new URLSearchParams({ "currentDocument.updateTime": document.updateTime });
      for (const field of Object.keys(fields)) params.append("updateMask.fieldPaths", field);
      const response = await fetchGoogle(FIRESTORE_DOCUMENTS + path + "?" + params, { method: "PATCH", headers, redirect: "manual", signal, body: JSON.stringify({ fields }) });
      if (!response.ok) throw new IntegrationError("sandbox_webhook_retry", "Retorno ainda não registrado. Repetir entrega.", 503);
      return json({ accepted: true });
    });
  } catch (error) {
    return json({ code: error instanceof IntegrationError ? error.code : "sandbox_webhook_retry" }, error instanceof IntegrationError ? error.status : 503);
  }
}
async function integrationBody(request) {
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) throw new IntegrationError("invalid_body", "Envie a configuração em formato JSON.", 400);
  const reader = request.body?.getReader();
  if (!reader) throw new IntegrationError("invalid_body", "Informe a configuração da integração.", 400);
  let length = 0;
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 4096) {
      await reader.cancel();
      throw new IntegrationError("invalid_body", "A configuração enviada excedeu o tamanho permitido.", 413);
    }
    chunks.push(value);
  }
  try {
    const raw = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      raw.set(chunk, offset);
      offset += chunk.length;
    }
    const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
    if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).length === 0 || Object.keys(data).some((key) => !["apiKey", "enabled"].includes(key)) || data.enabled !== void 0 && typeof data.enabled !== "boolean" || data.apiKey !== void 0 && (typeof data.apiKey !== "string" || data.apiKey.trim().length < 8 || data.apiKey.trim().length > 2048 || /[^\x21-\x7e]/.test(data.apiKey.trim()))) throw new Error("invalid_body");
    return data;
  } catch {
    throw new IntegrationError("invalid_body", "Confira a chave e a configuração enviadas.", 400);
  }
}
async function testUserAsaasKey(apiKey, fetchAsaas, signal) {
  const response = await fetchAsaas(SANDBOX_URL + "/pix/addressKeys?status=ACTIVE&limit=1", {
    method: "GET",
    headers: { accept: "application/json", access_token: apiKey, "User-Agent": "RegistroDeVendas-Pix-Sandbox-Profile/1.0" },
    redirect: "manual",
    signal
  });
  if (!response.ok) throw new IntegrationError("asaas_key_rejected", [401, 403].includes(response.status) ? "O Asaas não aceitou esta chave. Confira se ela pertence ao Sandbox e continua ativa." : "O Asaas não concluiu o teste. Tente novamente.", 502);
  const data = JSON.parse(await response.text());
  if (!Array.isArray(data?.data)) throw new IntegrationError("asaas_response_invalid", "O Asaas respondeu em um formato inesperado.", 502);
  return data.data.some((key) => key?.status === "ACTIVE");
}
function integrationStatus(document) {
  const fields = document?.fields || {};
  return { configured: !!document, enabled: fields.enabled?.booleanValue === true, environment: "sandbox", hasActivePixKey: fields.hasActivePixKey?.booleanValue === true, checkedAt: fields.checkedAt?.timestampValue || null, flowVersion: 1, pendingCharges: Number(fields.pendingCharges?.integerValue || 0) };
}
async function handleAsaasProfile(request, env, fetchGoogle, fetchAsaas, flow) {
  const origin = request.headers.get("Origin");
  const appOrigin = typeof env.APP_ORIGIN === "string" && env.APP_ORIGIN.trim() ? env.APP_ORIGIN.trim() : DEFAULT_APP_ORIGIN;
  const path = new URL(request.url).pathname;
  if (!origin || origin !== appOrigin) return json({ code: "origin_denied", message: "Abra a integração pelo sistema de vendas." }, 403);
  const cors = { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  const withCors = (response) => {
    for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
    return response;
  };
  const methods = path === INTEGRATION_PATH ? ["GET", "PUT", "DELETE"] : path === SANDBOX_CHECK_PATH ? ["GET", "POST"] : [INTEGRATION_PATH + "/test", SANDBOX_CHECK_PATH + "/simulate"].includes(path) ? ["POST"] : flow.methods(path);
  if (!methods.length) return withCors(json({ code: "not_found", message: "Rota não encontrada." }, 404));
  if (request.method === "OPTIONS") {
    if (!methods.includes(request.headers.get("Access-Control-Request-Method") || "")) return withCors(json({ code: "method_not_allowed", message: "Método não permitido." }, 405));
    return new Response(null, { status: 204, headers: { ...SECURITY_HEADERS, ...cors, "Access-Control-Allow-Methods": methods.join(", "), "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "600" } });
  }
  if (!methods.includes(request.method)) return withCors(json({ code: "method_not_allowed", message: "Método não permitido." }, 405));
  try {
    const user = await authenticatedUser(request, fetchGoogle);
    const uid = user.uid;
    const input = request.method === "PUT" ? await integrationBody(request) : null;
    const result = await checkFirebase(env, fetchGoogle, false, async (accessToken, signal) => {
      const headers = { accept: "application/json", "Content-Type": "application/json", Authorization: "Bearer " + accessToken };
      const profilePath = "artifacts/vendas-aura-main/users/" + uid + "/profile/info";
      const integrationPath = "_asaas_integrations/" + uid;
      const load = (resourcePath) => loadPrivateDocument(fetchGoogle, headers, signal, resourcePath);
      const profile = await load(profilePath);
      if (profile?.fields?.approved?.booleanValue !== true || !["", "active"].includes(profile.fields.status?.stringValue || "")) throw new IntegrationError("account_not_approved", "Sua conta precisa estar aprovada e ativa para configurar o Asaas.", 403);
      const current = await load(integrationPath);
      if (flow.matches(path)) return flow.handleRequest({ request, user, env, current, headers, signal, load, fetchGoogle, fetchAsaas });
      if (path === SANDBOX_CHECK_PATH || path === SANDBOX_CHECK_PATH + "/simulate") return handleSandboxCheck({ request, user, env, current, headers, signal, load, fetchGoogle, fetchAsaas });
      if (Number(current?.fields?.pendingCharges?.integerValue || 0) > 0 && (request.method === "DELETE" || request.method === "PUT" && (input.enabled === false || input.apiKey !== void 0))) throw new IntegrationError("pending_charges", "Conclua ou cancele os testes pendentes no perfil antes de alterar a chave ou usar Pix manual.", 409);
      const versionParams = () => new URLSearchParams(current ? { "currentDocument.updateTime": current.updateTime } : { "currentDocument.exists": "false" });
      const save = async (fields2) => {
        const params = versionParams();
        for (const field of Object.keys(fields2)) params.append("updateMask.fieldPaths", field);
        const response = await fetchGoogle(FIRESTORE_DOCUMENTS + integrationPath + "?" + params, { method: "PATCH", headers, redirect: "manual", signal, body: JSON.stringify({ fields: fields2 }) });
        if ([409, 412].includes(response.status)) throw new IntegrationError("integration_changed", "A configuração mudou durante esta operação. Atualize a tela e tente novamente.", 409);
        if (!response.ok) throw new IntegrationError("integration_save_failed", "Não foi possível salvar a integração. Tente novamente.");
      };
      if (request.method === "DELETE") {
        if (current) {
          const response = await fetchGoogle(FIRESTORE_DOCUMENTS + integrationPath + "?" + versionParams(), { method: "DELETE", headers, redirect: "manual", signal });
          if ([409, 412].includes(response.status)) throw new IntegrationError("integration_changed", "A configuração mudou. Atualize a tela antes de remover.", 409);
          if (!response.ok && response.status !== 404) throw new IntegrationError("integration_delete_failed", "Não foi possível remover a integração.");
        }
        return json({ ...integrationStatus(null), message: "Chave da integração removida." });
      }
      await encryptionKey(env);
      if (request.method === "GET") {
        if (current) await decryptAsaasKey(env, uid, current.fields);
        return json(integrationStatus(current));
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (request.method === "PUT" && input.enabled === false && input.apiKey === void 0) {
        if (!current) return json({ ...integrationStatus(null), message: "Pix manual selecionado." });
        await save({ enabled: { booleanValue: false }, updatedAt: { timestampValue: now } });
        return json({ ...integrationStatus(current), enabled: false, message: "Pix manual selecionado. A chave da integração permanece protegida." });
      }
      const apiKey = input?.apiKey !== void 0 ? input.apiKey.trim() : current ? await decryptAsaasKey(env, uid, current.fields) : "";
      if (!apiKey) throw new IntegrationError("asaas_key_required", "Informe a chave da API do Asaas Sandbox para conectar.", 400);
      const hasActivePixKey = await testUserAsaasKey(apiKey, fetchAsaas, signal);
      const fields = { hasActivePixKey: { booleanValue: hasActivePixKey }, checkedAt: { timestampValue: now }, updatedAt: { timestampValue: now } };
      if (request.method === "PUT") {
        const encrypted = await encryptAsaasKey(env, uid, apiKey);
        Object.assign(fields, { environment: { stringValue: "sandbox" }, version: { integerValue: "1" }, cipher: { stringValue: encrypted.cipher }, iv: { stringValue: encrypted.iv }, enabled: { booleanValue: input.enabled !== false } });
      }
      await save(fields);
      const status = integrationStatus({ fields: { ...current?.fields || {}, ...fields } });
      return json({ ...status, message: hasActivePixKey ? "Asaas Sandbox conectado. A chave está salva e o teste foi concluído." : "Asaas Sandbox conectado. Falta cadastrar ou ativar uma chave Pix na conta de testes." });
    });
    return withCors(result);
  } catch (error) {
    return withCors(json({ code: error instanceof IntegrationError ? error.code : "integration_unavailable", message: error instanceof IntegrationError ? error.message : "Não foi possível concluir a operação do Asaas. Tente novamente." }, error instanceof IntegrationError ? error.status : 503));
  }
}
async function checkFirebaseWrite(fetchGoogle, accessToken, signal) {
  const probeId = crypto.randomUUID();
  const documentId = "probe-" + probeId;
  const documentName = "projects/vendas-aura/databases/(default)/documents/_pix_connection_check/" + documentId;
  const documentUrl = "https://firestore.googleapis.com/v1/" + documentName;
  const headers = { accept: "application/json", "Content-Type": "application/json", Authorization: "Bearer " + accessToken };
  let step = "criação";
  let httpStatus = 0;
  let mayExist = false;
  let version = "";
  async function call(method, url, body) {
    httpStatus = 0;
    const response = await fetchGoogle(url, {
      method,
      headers,
      redirect: "manual",
      signal,
      ...body === void 0 ? {} : { body: JSON.stringify(body) }
    });
    if (!response.ok) {
      httpStatus = response.status;
      if (step === "criação" && [400, 401, 403, 404, 409, 429].includes(httpStatus)) mayExist = false;
      throw new Error("diagnostic_request_failed");
    }
    return response;
  }
  async function readDocument(response, expectedStage, expectedVersion = "") {
    const data = JSON.parse(await response.text());
    if (!data || data.name !== documentName || data.fields?.connectionTest?.booleanValue !== true || data.fields?.probeId?.stringValue !== probeId || data.fields?.stage?.stringValue !== expectedStage || typeof data.updateTime !== "string" || !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(data.updateTime) || expectedVersion && data.updateTime !== expectedVersion) {
      throw new Error("diagnostic_document_mismatch");
    }
    version = data.updateTime;
  }
  try {
    mayExist = true;
    const created = await call("POST", FIRESTORE_PROBE_COLLECTION + "?documentId=" + documentId, {
      fields: { connectionTest: { booleanValue: true }, probeId: { stringValue: probeId }, stage: { stringValue: "created" } }
    });
    await readDocument(created, "created");
    step = "atualização";
    const updateParams = new URLSearchParams({ "updateMask.fieldPaths": "stage", "currentDocument.updateTime": version });
    const updated = await call("PATCH", documentUrl + "?" + updateParams, { fields: { stage: { stringValue: "updated" } } });
    await readDocument(updated, "updated");
    step = "leitura";
    await readDocument(await call("GET", documentUrl), "updated", version);
    step = "exclusão";
    await call("DELETE", documentUrl + "?" + new URLSearchParams({ "currentDocument.updateTime": version }));
    return json({
      code: "firebase_write_connected",
      firebaseConnected: true,
      firestoreWrite: true,
      diagnosticCleaned: true,
      message: "Teste completo do Firebase concluído. O Worker criou, atualizou, leu e excluiu um registro de diagnóstico. As permissões de leitura e gravação estão funcionando. Nenhum dado de vendas foi alterado."
    });
  } catch (error) {
    let diagnosticCleaned = !mayExist;
    if (version) {
      try {
        const cleanup = await fetchGoogle(documentUrl + "?" + new URLSearchParams({ "currentDocument.updateTime": version }), {
          method: "DELETE",
          headers,
          redirect: "manual",
          signal: AbortSignal.timeout(8e3)
        });
        diagnosticCleaned = cleanup.ok || cleanup.status === 404;
      } catch {
      }
    }
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    const detail = httpStatus ? " (HTTP " + httpStatus + ")" : timedOut ? " por tempo excedido" : "";
    const cleanupMessage = diagnosticCleaned ? " O registro temporário foi limpo ou não chegou a ser criado." : " Pode ter ficado um registro de diagnóstico: " + documentId + ". Guarde esta mensagem para conferir a limpeza.";
    return json({
      code: "firebase_write_failed",
      step,
      diagnosticCleaned,
      message: "O teste parou na etapa de " + step + detail + ". Confira as permissões da conta de serviço no Firebase. Não é necessário liberar as regras públicas do banco." + cleanupMessage
    }, timedOut ? 504 : httpStatus === 429 ? 503 : 502);
  }
}
async function checkFirebase(env, fetchGoogle, writeCheck = false, operation = null) {
  if (typeof env.FIREBASE_SERVICE_ACCOUNT !== "string" || !env.FIREBASE_SERVICE_ACCOUNT.trim()) {
    return json({ code: "firebase_secret_required", message: "Cadastre o JSON completo no Secret FIREBASE_SERVICE_ACCOUNT da Cloudflare e clique em Deploy." }, 503);
  }
  let account;
  try {
    account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  } catch {
    return json({ code: "firebase_json_invalid", message: "O Secret FIREBASE_SERVICE_ACCOUNT não contém um JSON válido. Copie todo o conteúdo do arquivo baixado do Firebase, incluindo as chaves do início e do final." }, 503);
  }
  if (!account || account.type !== "service_account" || typeof account.client_email !== "string" || !/^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(account.client_email) || typeof account.private_key !== "string") {
    return json({ code: "firebase_credentials_invalid", message: "O JSON não contém uma conta de serviço completa. Use o arquivo gerado em Contas de serviço → Gerar nova chave privada." }, 503);
  }
  if (account.project_id !== FIREBASE_PROJECT) {
    return json({ code: "firebase_project_mismatch", message: "A credencial precisa pertencer ao projeto vendas-aura. Gere a chave privada nesse projeto e atualize o Secret." }, 503);
  }
  let assertion;
  try {
    const pem = account.private_key.replace(/\\n/g, "\n").trim();
    if (!pem.startsWith("-----BEGIN PRIVATE KEY-----") || !pem.endsWith("-----END PRIVATE KEY-----")) throw new Error("Invalid PKCS8");
    const der = Uint8Array.from(atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "")), (char) => char.charCodeAt(0));
    const privateKey = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    const encoder = new TextEncoder();
    const now = Math.floor(Date.now() / 1e3);
    const header = { alg: "RS256", typ: "JWT", ...typeof account.private_key_id === "string" ? { kid: account.private_key_id } : {} };
    const claims = { iss: account.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: GOOGLE_TOKEN_URL, iat: now - 30, exp: now + 3300 };
    const unsigned = base64url(encoder.encode(JSON.stringify(header))) + "." + base64url(encoder.encode(JSON.stringify(claims)));
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, encoder.encode(unsigned));
    assertion = unsigned + "." + base64url(new Uint8Array(signature));
  } catch {
    return json({ code: "firebase_private_key_invalid", message: "Não foi possível ler a chave privada do Firebase. Atualize FIREBASE_SERVICE_ACCOUNT com o JSON completo, sem editar o campo private_key." }, 503);
  }
  try {
    const signal = AbortSignal.timeout(operation ? 4e4 : 2e4);
    const auth = await fetchGoogle(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
      redirect: "manual",
      signal
    });
    if (!auth.ok) {
      return json({ code: "firebase_auth_failed", message: "O Google não aceitou a credencial. Confira se a conta de serviço e a chave privada estão ativas e se o JSON foi copiado integralmente." }, 502);
    }
    const token = JSON.parse(await auth.text());
    if (!token || typeof token.access_token !== "string" || !token.access_token || /[\r\n]/.test(token.access_token)) {
      return json({ code: "firebase_auth_response_invalid", message: "O Google não retornou um token válido para o teste. Tente novamente." }, 502);
    }
    if (operation) return await operation(token.access_token, signal);
    if (writeCheck) return checkFirebaseWrite(fetchGoogle, token.access_token, signal);
    const response = await fetchGoogle(FIRESTORE_PROBE_URL, {
      method: "GET",
      headers: { accept: "application/json", Authorization: "Bearer " + token.access_token },
      redirect: "manual",
      signal
    });
    if (!response.ok) {
      const messages = {
        401: "O Firestore recusou a autenticação. Confira se a conta de serviço e a chave privada continuam ativas.",
        403: "A autenticação funcionou, mas o Firestore recusou a leitura. Confira se o Firestore está ativo e se a conta de serviço tem permissão de acesso. Não é necessário liberar as regras públicas do banco.",
        404: "O banco Firestore padrão não foi encontrado no projeto vendas-aura. Confira o projeto e o banco usado pelo sistema.",
        429: "O Firebase limitou temporariamente as consultas. Aguarde e tente novamente."
      };
      return json({ code: "firebase_read_failed", message: messages[response.status] || "O Firestore não concluiu a consulta. Tente novamente mais tarde." }, response.status === 429 ? 503 : 502);
    }
    const data = JSON.parse(await response.text());
    if (!data || typeof data !== "object" || Array.isArray(data) || data.error || data.documents !== void 0 && !Array.isArray(data.documents)) {
      return json({ code: "firebase_response_invalid", message: "O Firestore respondeu em um formato inesperado. Tente novamente." }, 502);
    }
    return json({
      code: "firebase_connected",
      firebaseConnected: true,
      firestoreRead: true,
      mode: "read-only",
      projectId: FIREBASE_PROJECT,
      message: "Conexão com o Firebase funcionando. A credencial foi aceita e a leitura do Firestore está autorizada no projeto vendas-aura. Nenhum registro foi alterado. Use Testar gravação Firebase para conferir também a permissão de gravação."
    });
  } catch (error) {
    if (error instanceof IntegrationError) return json({ code: error.code, message: error.message }, error.status);
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return json({ code: "firebase_timeout", message: "A consulta ao Firebase excedeu " + (operation ? "40" : "20") + " segundos. Aguarde um pouco e tente novamente." }, 504);
    }
    if (error instanceof SyntaxError) {
      return json({ code: "firebase_response_invalid", message: "O Google ou o Firestore não retornou uma resposta JSON válida. Tente novamente." }, 502);
    }
    return json({ code: "firebase_connection_failed", message: "Não foi possível concluir a conexão com o Firebase. Tente novamente; se persistir, confira o painel da Cloudflare." }, 502);
  }
}
function createWorker(options = {}) {
  const fetchAsaas = options.fetchAsaas || defaultAsaasFetch;
  const fetchGoogle = options.fetchGoogle || defaultAsaasFetch;
  const flow = createSandboxFlowHandlers({ IntegrationError, json, sandboxTag, decryptAsaasKey, sandboxApi, handleSandboxCheck, FIRESTORE_DOCUMENTS });
  return {
    /** @param {Request} request @param {WorkerEnv} [env] */
    async fetch(request, env = {}) {
      const url = new URL(request.url);
      if (url.pathname.startsWith(WEBHOOK_PATH)) return handleSandboxWebhook(request, env, url.pathname.slice(WEBHOOK_PATH.length), fetchGoogle, fetchAsaas, flow);
      if (url.pathname === INTEGRATION_PATH || url.pathname.startsWith(INTEGRATION_PATH + "/")) return handleAsaasProfile(request, env, fetchGoogle, fetchAsaas, flow);
      if (request.method === "GET" && url.pathname === "/") return false ? compactHome() : setupPage();
      if (request.method === "GET" && url.pathname === "/health") {
        return json({ service: "registro-vendas-pix-testes", stage: "sandbox-charge-test", environment: "sandbox" });
      }
      if (!["/api/setup/check", "/api/setup/firebase-check", "/api/setup/firebase-write-check", "/api/setup/encryption-check"].includes(url.pathname)) {
        return json({ code: "not_found", message: "Rota não encontrada." }, 404);
      }
      if (request.method !== "POST") {
        return json({ code: "method_not_allowed", message: "Use os botões de teste desta página." }, 405);
      }
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin || request.headers.get("Sec-Fetch-Site") === "cross-site") {
        return json({ code: "origin_denied", message: "Abra o teste pelo endereço do próprio Worker." }, 403);
      }
      const expectedToken = typeof env.SETUP_TOKEN === "string" ? env.SETUP_TOKEN.trim() : "";
      if (!TOKEN_PATTERN.test(expectedToken)) {
        return json({ code: "setup_required", message: "Cadastre o código gerado nesta página no Secret SETUP_TOKEN da Cloudflare e clique em Deploy." }, 503);
      }
      const receivedToken = request.headers.get("X-Setup-Token") || "";
      if (!TOKEN_PATTERN.test(receivedToken) || !equalToken(receivedToken, expectedToken)) {
        return json({ code: "unauthorized", message: "O código de configuração não confere com o Secret SETUP_TOKEN da Cloudflare." }, 401);
      }
      if (url.pathname === "/api/setup/firebase-check") return checkFirebase(env, fetchGoogle);
      if (url.pathname === "/api/setup/firebase-write-check") return checkFirebase(env, fetchGoogle, true);
      if (url.pathname === "/api/setup/encryption-check") return checkEncryption(env);
      const baseUrl = typeof env.ASAAS_BASE_URL === "string" ? env.ASAAS_BASE_URL.trim().replace(/\/+$/, "") : "";
      if (baseUrl !== SANDBOX_URL) {
        return json({ code: "sandbox_required", message: "Este código funciona somente em testes. Configure ASAAS_BASE_URL como https://api-sandbox.asaas.com/v3." }, 503);
      }
      const apiKey = typeof env.ASAAS_API_KEY === "string" ? env.ASAAS_API_KEY.trim() : "";
      if (!apiKey || /[\r\n]/.test(apiKey)) {
        return json({ code: "api_key_required", message: "Cadastre a chave de API do Sandbox como Secret ASAAS_API_KEY e clique em Deploy." }, 503);
      }
      try {
        const response = await fetchAsaas(`${SANDBOX_URL}/pix/addressKeys?status=ACTIVE&limit=1`, {
          method: "GET",
          headers: {
            accept: "application/json",
            access_token: apiKey,
            "User-Agent": "RegistroDeVendas-Pix-Sandbox-Setup/1.0"
          },
          // Workers aceita somente manual/follow. Não seguir redirecionamentos com a chave.
          redirect: "manual",
          signal: AbortSignal.timeout(2e4)
        });
        if (!response.ok) {
          const messages = {
            401: "O Asaas não aceitou a chave de API. Confira se a chave é do Sandbox, está habilitada e foi copiada integralmente.",
            403: "O Asaas recusou o acesso. Confira as permissões e eventuais restrições de IP da chave no Sandbox.",
            429: "O Asaas limitou temporariamente as consultas. Aguarde e tente novamente."
          };
          return json({
            code: "asaas_unavailable",
            message: messages[response.status] || "O Asaas não concluiu a consulta. Tente novamente mais tarde."
          }, response.status === 429 ? 503 : 502);
        }
        const data = JSON.parse(await response.text());
        if (!data || !Array.isArray(data.data)) {
          return json({ code: "invalid_response", message: "O Asaas respondeu em um formato inesperado. Tente novamente mais tarde." }, 502);
        }
        const hasActivePixKey = data.data.some(
          /** @param {{ status?: string } | null} key */
          (key) => key?.status === "ACTIVE"
        );
        return json({
          code: hasActivePixKey ? "ready_for_firebase" : "pix_key_required",
          apiConnected: true,
          hasActivePixKey,
          environment: "sandbox",
          message: hasActivePixKey ? "Conexão com o Asaas Sandbox funcionando. Existe uma chave Pix ativa de teste. Use os botões do Firebase para conferir também o acesso ao banco." : "Conexão com o Asaas Sandbox funcionando. Falta cadastrar ou ativar uma chave Pix na conta de testes. Depois, repita este teste."
        });
      } catch (error) {
        if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
          return json({ code: "asaas_timeout", message: "A consulta ao Asaas Sandbox excedeu 20 segundos. Aguarde um pouco e tente novamente." }, 504);
        }
        if (error instanceof SyntaxError) {
          return json({ code: "invalid_response", message: "O Asaas não retornou uma resposta JSON válida. Tente novamente mais tarde." }, 502);
        }
        return json({ code: "connection_failed", message: "Não foi possível consultar o Asaas Sandbox. Tente novamente; se persistir, confira o painel da Cloudflare." }, 502);
      }
    }
  };
}
var worker_entry_default = createWorker();
export {
  createWorker,
  worker_entry_default as default
};
