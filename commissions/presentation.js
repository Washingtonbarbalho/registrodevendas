import { formatCurrency, formatDate, maskMoney, maskPhone } from '../utils.js?v=112';
import { toCents } from '../financial-core-v70.js?v=112';
import { agreementMode, commissionMethods, saleCode, units } from './core.js?v=112';

export const brl = cents => formatCurrency(cents / 100);
export const decimal = cents => (cents / 100).toFixed(2).replace('.', ',');
export const moneyDisplay = cents => maskMoney(String(cents));
const digits = value => String(value ?? '').replace(/\D/g, '');
export const moneyMask = value => {
  const raw = digits(value).replace(/^0+(?=\d)/, '');
  return raw ? maskMoney(raw.slice(0, 11)) : '';
};
export const pastedMoney = text => {
  const value = units(String(text).trim().replace(/^R\$\s*/i, ''));
  return Number.isSafeInteger(value) && value >= 0 && value < 1e11 ? moneyDisplay(value) : null;
};
export const percentMask = value => {
  const cleaned = String(value).replace(/[^\d,\.]/g, '').replace(/\./g, ',');
  const [whole, ...fraction] = cleaned.split(',');
  const integer = whole.replace(/^0+(?=\d)/, '').slice(0, 3);
  return fraction.length ? (integer || '0') + ',' + fraction.join('').slice(0, 2) : integer;
};
export const finishPercent = value => {
  if (!value) return '';
  const parsed = units(value.replace(/,$/, ''));
  return Number.isSafeInteger(parsed) ? decimal(parsed) : value;
};
export const sellerPhoneDigits = value => {
  const raw = digits(value);
  return raw.length >= 12 && raw.startsWith('55') ? raw.slice(2) : raw;
};
export const validSellerPhone = value => /^[1-9]\d\d{8,9}$/.test(sellerPhoneDigits(value));
export const sellerPhoneMask = value => maskPhone(sellerPhoneDigits(value).slice(0, 11));
export const sellerWhatsappUrl = (phone, text) => validSellerPhone(phone)
  ? 'https://wa.me/55' + sellerPhoneDigits(phone) + '?text=' + encodeURIComponent(text)
  : '';

export const currentMonthRange = today => {
  const [y, m] = today.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { startDate: today.slice(0, 7) + '-01', endDate: today.slice(0, 7) + '-' + last };
};
export const periodLabel = ({ startDate, endDate }) => startDate && endDate ? formatDate(startDate) + ' a ' + formatDate(endDate)
  : startDate ? 'Desde ' + formatDate(startDate) : endDate ? 'Até ' + formatDate(endDate) : 'Todo o período';
export const includesDate = ({ startDate, endDate }, date) => (!startDate || date >= startDate) && (!endDate || date <= endDate);
export const saleValue = sale => toCents(sale?.totalPrice);
const add = (rows, get) => rows.reduce((total, row) => total + get(row), 0);
export function sellerOverview(port, sellerId, range) {
  const rows = port.rows.filter(r => r.sellerId === sellerId);
  const sales = port.sales.filter(s => s.commission.sellerId === sellerId && includesDate(range, s.saleDate))
    .sort((a, b) => b.saleDate.localeCompare(a.saleDate) || a.id.localeCompare(b.id));
  const events = port.history.filter(e => e.sellerId === sellerId && includesDate(range, e.date));
  const validSales = sales.filter(s => s.status !== 'canceled');
  return {
    rows, sales, events, salesCount: validSales.length, sold: add(validSales, saleValue),
    pending: add(rows, r => r.pending), available: add(rows, r => r.available),
    paid: add(events.filter(e => e.kind === 'payout'), p => p.cash),
    returned: add(events.filter(e => e.kind === 'agreement' && agreementMode(e) === 'immediate'), e => -e.amount),
    outstanding: add(port.agreements.filter(a => a.sellerId === sellerId), a => a.remaining)
  };
}

export const eventTitle = e => ({
  sale: 'Comissão da venda', credit: 'Comissão manual', payout: 'Repasse registrado',
  agreement: agreementMode(e) === 'immediate' ? 'Devolução recebida no caixa' : 'Compensação em repasses futuros',
  void: 'Anulação da comissão não paga', canceled: 'Venda cancelada',
  hold: 'Comissão a liberar', release: 'Comissão liberada', reprice: 'Ajuste da base percentual'
})[e.kind] || 'Movimentação';
export const rowStatus = row => row.canceled ? { title: 'Venda cancelada', key: 'canceled' }
  : row.available > 0 ? { title: 'Disponível', key: 'available' }
    : row.pending > 0 ? { title: 'A liberar', key: 'pending' } : { title: row.paid > 0 ? 'Liquidada' : 'Sem saldo', key: 'settled' };
const messageField = value => String(value ?? '').replace(/[\r\n*_~`]/g, ' ').replace(/\s+/g, ' ').trim();
const marked = (label, value) => '• *' + label + ':* ' + value;
const eventEmoji = { payout: '💸', agreement: '🔄', credit: '➕', void: '↩️', canceled: '❌', release: '✅', hold: '⏳', sale: '🛍️', reprice: '📝' };
const messageEvent = e => {
  const label = eventTitle(e);
  const code = messageField(e.code);
  const base = (eventEmoji[e.kind] || '•') + ' ' + formatDate(e.date) + ' · ' + label + (code ? ' · ' + code : '');
  if (e.kind === 'payout') {
    const line = e.cash > 0 ? 'Pago: ' + brl(e.cash) + (commissionMethods[e.method] ? ' via ' + commissionMethods[e.method] : '') : 'Sem saída de caixa';
    return base + '\n    ' + line + (e.offset ? ' · Abatimento: ' + brl(e.offset) : '');
  }
  return base + (!['release', 'hold', 'canceled'].includes(e.kind) ? ' · ' + brl(e.kind === 'agreement' ? Math.abs(e.amount) : e.amount) : '');
};

export function buildSellerStatement({ seller, storeName, range, overview }) {
  const saleTotals = new Map();
  for (const r of overview.rows) if (r.saleId) saleTotals.set(r.saleId, (saleTotals.get(r.saleId) || 0) + r.amount);
  return [
    '🧾 *EXTRATO DE COMISSÕES*',
    '🏪 *Loja:* ' + (messageField(storeName) || 'Registro de Vendas'),
    '👤 *Vendedor:* ' + messageField(seller.name),
    '📅 *Período:* ' + periodLabel(range),
    '',
    '📊 *RESUMO DO PERÍODO*',
    marked('Vendas válidas', overview.salesCount + ' · ' + brl(overview.sold)),
    marked('Repasses pagos', brl(overview.paid)),
    marked('Devoluções recebidas', brl(overview.returned)),
    '',
    '💰 *SALDO ATUAL*',
    marked('Disponível para repasse', brl(overview.available)),
    marked('A liberar', brl(overview.pending)),
    marked('A compensar em repasses', brl(overview.outstanding)),
    '',
    '🛍️ *VENDAS DO PERÍODO*',
    ...(overview.sales.length ? overview.sales.map(s => [
      '• ' + formatDate(s.saleDate), '*' + messageField(saleCode(s)) + '*', 'Venda: ' + brl(saleValue(s)),
      s.status === 'canceled' ? 'Cancelada' : 'Comissão: ' + brl(saleTotals.get(s.id) || 0)
    ].join(' · ')) : ['Nenhuma venda no período.']),
    '',
    '📋 *MOVIMENTAÇÕES DO PERÍODO*',
    ...(overview.events.length ? overview.events.map(messageEvent) : ['Nenhuma movimentação no período.']),
    '',
    '_Vendas e movimentações respeitam o período acima. Os saldos são os atuais._'
  ].join('\n');
}
