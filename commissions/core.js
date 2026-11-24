// Valores monetários em centavos; percentuais em centésimos de ponto percentual.
import { buildSalePaymentEvents, isTermSale, toCents } from '../financial-core-v70.js?v=112';

const list = value => Array.isArray(value) ? value : [];
const sum = (rows, get) => rows.reduce((n, row) => n + get(row), 0);
const requireThat = (ok, message) => { if (!ok) throw new Error(message); };
const natural = n => Number.isSafeInteger(n) && n >= 0;
export const commissionMethods = Object.freeze({ pix: 'Pix', money: 'Dinheiro', transfer: 'Transferência' });
const validMethod = method => Object.hasOwn(commissionMethods, method);
export const agreementMode = agreement => agreement?.settlement === 'immediate' ? 'immediate' : 'future';
export const readBook = raw => Object.fromEntries(
  ['sellers', 'bonuses', 'payouts', 'agreements', 'refunds', 'archives'].map(key => [key, list(raw?.[key])])
);
export const saleCode = sale => sale?.saleCode || sale?.contractCode || (
  !sale?.id ? '' : isTermSale(sale) ? 'VP-' + sale.id.slice(-5).toUpperCase() : sale.id
);
export const units = input => {
  const s = String(input ?? '').trim();
  if (!s || !/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$|^\d+\.\d{1,2}$/.test(s)) return NaN;
  const n = Number(s.includes(',') || /\.\d{3}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s);
  return Math.round(n * 100);
};
export function saleDraft(form) {
  if (!form.sellerId) return null;
  const expenseCents = units(form.expenses || '0');
  requireThat(natural(expenseCents), 'Confira as despesas diretas da venda.');
  const amount = units(form.value);
  quote(form.mode, amount, 0);
  requireThat(amount > 0, 'Informe uma comissão maior que zero ou escolha Sem vendedor.');
  return { sellerId: form.sellerId, mode: form.mode, units: amount, expenseCents };
}

export function productBase(sale) {
  const products = sale.productsTotal != null ? toCents(sale.productsTotal)
    : sum(list(sale.items), i => toCents(i.price ?? (i.unitPrice || 0) * (i.quantity || 0)));
  return Math.max(0, products - toCents(sale.settlementDiscountTotal));
}
export function quote(mode, units, base) {
  requireThat(['fixed', 'percent'].includes(mode) && natural(units) && natural(base),
    'Informe um valor válido, com no máximo duas casas decimais.');
  requireThat(mode !== 'percent' || units <= 10000, 'O percentual deve estar entre 0 e 100%.');
  if (mode === 'fixed') return units;
  requireThat(Number.isSafeInteger(base * units), 'Valor fora do limite de cálculo.');
  return Math.round(base * units / 10000);
}
export function terms(seller, expenses = 0) {
  requireThat(seller?.id && seller.active !== false, 'O vendedor não está disponível para esta venda.');
  requireThat(natural(expenses), 'Informe despesas diretas válidas.');
  return { sellerId: seller.id, sellerName: seller.name, expenseCents: expenses, grants: [], history: [] };
}
export function grant({ id, mode, units, reason, kind, ...stamp }, base) {
  const amount = quote(mode, units, base);
  requireThat(units > 0 && amount > 0, 'A comissão deve ser de pelo menos R$ 0,01.');
  requireThat(id && reason?.trim(), 'Informe o motivo do lançamento.');
  return { id, mode, units, reason: reason.trim(), kind, base, amount, ...stamp };
}
export function position(sale) {
  const c = sale.commission;
  const base = productBase(sale);
  const total = sum(c.grants, g => quote(g.mode, g.units, base));
  const receipts = isTermSale(sale) ? sum(buildSalePaymentEvents(sale), e => toCents(e.amount)) : toCents(sale.totalPrice);
  // Vendas antigas podem ter custo apenas nos itens. Ausência de custo não significa custo zero.
  const knownCost = n => n != null && n !== '' && Number.isFinite(Number(n)) && Number(n) >= 0;
  const items = list(sale.items);
  const itemCostsKnown = items.length > 0 && items.every(i => knownCost(i.cost) || (knownCost(i.unitCost) && Number(i.quantity) > 0));
  const costKnown = knownCost(sale.totalCost) || itemCostsKnown;
  const goodsCost = knownCost(sale.totalCost) ? toCents(sale.totalCost)
    : sum(items, i => knownCost(i.cost) ? toCents(i.cost) : toCents(i.unitCost) * (Number(i.quantity) || 0));
  const costs = goodsCost + c.expenseCents;
  const profit = receipts - costs;
  return { base, total, receipts, costs, costKnown, profit,
    released: sale.status !== 'canceled' && (!isTermSale(sale) || (costKnown && profit >= total)) };
}

// Histórico aditivo: o combinado não é reescrito por um desconto, recebimento ou estorno.
export function recordTransition(previous, next, stamp) {
  const c = next.commission;
  const before = previous?.commission ? position(previous) : null;
  const after = position(next);
  const events = [];
  if (before && before.base !== after.base) {
    for (const g of c.grants) {
      const delta = quote(g.mode, g.units, after.base) - quote(g.mode, g.units, before.base);
      if (delta) events.push({ ...stamp, kind: 'reprice', grantId: g.id, amount: delta, reason: 'Alteração nos descontos da venda' });
    }
  }
  if ((!before || after.released !== before.released) && (after.released || before?.released)) {
    events.push({ ...stamp, kind: after.released ? 'release' : 'hold', amount: after.total,
      reason: after.released ? 'Condição de liberação atendida' : 'Lucro ainda não cobre a comissão total' });
  }
  return events.length ? { ...c, history: [...c.history, ...events] } : c;
}

function indexAmounts(book) {
  const settled = new Map(), agreed = new Map(), used = new Map();
  const add = (map, key, n) => map.set(key, (map.get(key) || 0) + n);
  for (const p of book.payouts) {
    for (const l of p.lines) add(settled, l.grantId, l.amount);
    for (const l of p.offsets) add(used, l.agreementId, l.amount);
  }
  for (const a of [...book.agreements, ...book.refunds]) add(agreed, a.grantId, a.amount);
  return { settled, agreed, used };
}

export function portfolio(sales, rawBook) {
  const book = readBook(rawBook);
  const { settled, agreed, used } = indexAmounts(book);
  const byId = new Map(book.archives.map(s => [s.id, s]));
  for (const s of sales) if (s.commission && !s.deleted) byId.set(s.id, s);
  const rows = [], history = [];
  const addRow = (g, sellerId, sale, state) => {
    const amount = state ? quote(g.mode, g.units, state.base) : g.amount;
    const paid = settled.get(g.id) || 0;
    const canceled = sale?.status === 'canceled';
    const open = canceled ? 0 : Math.max(0, amount - paid);
    const released = !state || state.released;
    rows.push({ id: g.id, sellerId, saleId: sale?.id || '', code: saleCode(sale), sale, grant: g,
      amount, paid, canceled, state, pending: released ? 0 : open, available: released ? open : 0,
      recoverable: canceled ? Math.max(0, paid - (agreed.get(g.id) || 0)) : 0 });
    history.push({ ...g, sellerId, saleId: sale?.id || '', code: saleCode(sale) });
  };
  for (const sale of byId.values()) {
    const c = sale.commission, state = position(sale);
    for (const g of c.grants) addRow(g, c.sellerId, sale, state);
    for (const entry of c.history) history.push({ ...entry, sellerId: c.sellerId, saleId: sale.id, code: saleCode(sale) });
  }
  for (const g of book.bonuses) addRow(g, g.sellerId, null, null);
  // Acordos criados antes da escolha de tratamento seguem como abatimentos futuros.
  const agreements = [...book.agreements, ...book.refunds].map(a => ({
    ...a, settlement: agreementMode(a),
    remaining: agreementMode(a) === 'immediate' ? 0 : Math.max(0, a.amount - (used.get(a.id) || 0))
  }));
  for (const a of agreements) history.push({ ...a, kind: 'agreement', amount: -a.amount });
  for (const p of book.payouts) history.push({ ...p, kind: 'payout', amount: p.cash });
  history.sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at));
  return { rows, history, agreements, sales: [...byId.values()] };
}

export function cancelCommission(sale, book, stamp, reason) {
  const history = [...sale.commission.history];
  requireThat(sale.status !== 'canceled', 'A venda já foi cancelada.');
  const rows = portfolio([sale], book).rows.filter(r => r.saleId === sale.id);
  for (const row of rows) {
    const unpaid = row.pending + row.available;
    if (unpaid) history.push({ ...stamp, kind: 'void', grantId: row.id, amount: -unpaid, reason });
  }
  // Um cancelamento com todas as comissões pagas não gera nenhum débito.
  history.push({ ...stamp, kind: 'canceled', amount: 0, reason });
  return { ...sale.commission, history };
}

// A exclusão da venda não apaga o extrato do vendedor nem retém dados pessoais do cliente.
export function archiveCommission(sale) {
  requireThat(sale.status === 'canceled', 'Cancele a venda comissionada antes de excluir.');
  const state = position(sale);
  return { id: sale.id, saleCode: saleCode(sale), saleType: isTermSale(sale) ? 'prazo' : 'direct',
    saleDate: sale.saleDate, status: 'canceled', productsTotal: productBase(sale) / 100,
    totalPrice: sale.totalPrice ?? 0, totalCost: state.costKnown ? (state.costs - sale.commission.expenseCents) / 100 : null,
    archived: true, commission: sale.commission };
}

export function makeAgreement(port, { grantId, sellerId, sellerName, amount, reason, settlement, method, ...stamp }) {
  const row = port.rows.find(r => r.id === grantId && r.sellerId === sellerId);
  requireThat(row?.canceled, 'Selecione a comissão de uma venda cancelada.');
  const canceledAt = row.sale.commission.history.find(e => e.kind === 'canceled')?.date;
  requireThat(canceledAt && stamp.date >= canceledAt, 'A data do acordo não pode ser anterior ao cancelamento.');
  requireThat(natural(amount) && amount > 0 && amount <= row.recoverable,
    'O acordo supera o valor já liquidado que ainda não foi compensado.');
  requireThat(reason?.trim(), 'Descreva o acordo individual com o vendedor.');
  requireThat(['immediate', 'future'].includes(settlement), 'Escolha se a compensação é imediata ou em repasses futuros.');
  if (settlement === 'immediate') requireThat(validMethod(method), 'Selecione como o valor voltou ao caixa.');
  return {
    ...stamp, sellerId, sellerName, grantId, saleId: row.saleId, code: row.code, amount,
    settlement, ...(settlement === 'immediate' ? { method } : {}), reason: reason.trim()
  };
}
export function makePayout(port, { sellerId, lines, offset = 0, method, reason = '', ...stamp }) {
  requireThat(Array.isArray(lines) && lines.length > 0, 'Selecione pelo menos uma comissão disponível.');
  requireThat(new Set(lines.map(l => l.grantId)).size === lines.length, 'Uma comissão foi selecionada duas vezes.');
  requireThat(validMethod(method), 'Selecione a forma de repasse.');
  const allocations = lines.map(({ grantId, amount }) => {
    const row = port.rows.find(r => r.id === grantId && r.sellerId === sellerId);
    requireThat(row && natural(amount) && amount > 0 && amount <= row.available,
      'Uma comissão não tem mais o saldo indicado. Confira a seleção antes de repassar.');
    requireThat(stamp.date >= row.grant.date, 'O repasse não pode anteceder a comissão selecionada.');
    if (row.sale && isTermSale(row.sale)) {
      const receipts = sum(buildSalePaymentEvents(row.sale).filter(e => e.date <= stamp.date), e => toCents(e.amount));
      const lastRelease = row.sale.commission.history.filter(e => e.kind === 'release').at(-1);
      requireThat(receipts >= row.state.costs + row.state.total && (!lastRelease || stamp.date >= lastRelease.date),
        'Nesta data os recebimentos ainda não liberavam toda a comissão da venda.');
    }
    return { grantId, saleId: row.saleId, code: row.code, amount };
  });
  const gross = sum(allocations, l => l.amount);
  const open = port.agreements.filter(a => a.sellerId === sellerId && a.settlement === 'future' && a.remaining > 0 && a.date <= stamp.date)
    .sort((a,b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at));
  requireThat(natural(offset) && offset <= gross && offset <= sum(open, a => a.remaining),
    'O abatimento excede o repasse ou o saldo de acordos disponível.');
  let left = offset;
  const offsets = [];
  for (const a of open) {
    if (!left) break;
    const amount = Math.min(left, a.remaining);
    offsets.push({ agreementId: a.id, amount }); left -= amount;
  }
  return { ...stamp, sellerId, lines: allocations, offsets, gross, cash: gross - offset, offset, method, reason: reason.trim() || 'Repasse de comissões' };
}

// O repasse e o acordo imediato já são a origem do movimento: não há cópia editável
// e acordos para abatimento futuro nunca entram no caixa.
export const isCommissionCashEntry = entry => Boolean(entry?.commissionPayoutId || entry?.commissionRefundId);
export function commissionCashEntries(raw) {
  const { payouts, refunds } = readBook(raw?.commissionBook);
  return [
    ...payouts.filter(p => p.cash > 0).map(p => ({
      id: 'commission-payout-' + p.id, commissionPayoutId: p.id, type: 'expense', value: p.cash / 100,
      description: 'Repasse de comissão · ' + p.sellerName, category: 'Comissões', date: p.date,
      dateTime: p.at, notes: p.reason
    })),
    ...refunds.filter(a => agreementMode(a) === 'immediate' && a.amount > 0).map(a => ({
      id: 'commission-refund-' + a.id, commissionRefundId: a.id, type: 'income', value: a.amount / 100,
      description: 'Devolução de comissão · ' + a.sellerName, category: 'Comissões', date: a.date,
      dateTime: a.at, notes: [a.code, commissionMethods[a.method], a.reason].filter(Boolean).join(' · ')
    }))
  ];
}
