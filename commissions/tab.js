import React, { useMemo, useState } from 'https://esm.sh/react@18.2.0';
import { formatDate, getCurrentMonthStart, getCurrentMonthEnd } from '../utils.js?v=111';
import { portfolio } from './core.js?v=111';
import { brl, CommissionForm, decimal, h } from './forms.js?v=111';

const captions = { sale: 'Comissão da venda', credit: 'Crédito manual', agreement: 'Acordo individual',
  payout: 'Repasse registrado', void: 'Anulação da parte não paga', canceled: 'Venda cancelada',
  hold: 'Comissão a liberar', release: 'Comissão liberada', reprice: 'Ajuste da base percentual' };
const methodNames = { pix: 'Pix', money: 'Dinheiro', transfer: 'Transferência' };
const total = (rows, fn) => rows.reduce((n, r) => n + fn(r), 0);
const button = (label, onClick, props = {}) => h('button', { type: 'button', onClick, ...props }, label);
const eventDetail = e => e.kind === 'payout'
  ? 'Liquidado ' + brl(e.gross) + ' · acordos ' + brl(e.offset) + ' · caixa ' + brl(e.cash) + ' · ' + methodNames[e.method]
  : e.reason;
const amountLabel = e => ['release', 'hold', 'canceled'].includes(e.kind) ? '' : brl(e.amount);
export function CommissionTab({ book, sales, onPost, onOpenSale }) {
  const [sellerId, selectSeller] = useState(''), [form, setForm] = useState(''), [notice, setNotice] = useState('');
  const [start, setStart] = useState(getCurrentMonthStart), [end, setEnd] = useState(getCurrentMonthEnd);
  const [search, setSearch] = useState('');
  const port = useMemo(() => portfolio(sales, book), [sales, book]);
  const seller = book.sellers.find(s => s.id === sellerId) || book.sellers[0];
  const id = seller?.id;
  const rows = port.rows.filter(r => r.sellerId === id), mySales = port.sales.filter(s => s.commission.sellerId === id);
  const period = date => (!start || date >= start) && (!end || date <= end);
  const events = port.history.filter(e => e.sellerId === id && period(e.date));
  const sold = total(mySales.filter(s => period(s.saleDate) && s.status !== 'canceled'), s => Math.round(s.totalPrice * 100));
  const pending = total(rows, r => r.pending), available = total(rows, r => r.available);
  const paid = total(events.filter(e => e.kind === 'payout'), p => p.cash);
  const outstanding = total(port.agreements.filter(a => a.sellerId === id), a => a.remaining);
  const selected = rows.filter(r => period(r.grant.date) && (!search.trim() || [r.code, r.sale?.customerName, r.grant.reason].join(' ').toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))));
  const open = kind => { setForm(kind); setNotice(''); };
  const share = () => {
    const text = ['Extrato de comissões · ' + seller.name,
      (start ? formatDate(start) : 'Início') + ' a ' + (end ? formatDate(end) : 'hoje'),
      'Vendas no período: ' + brl(sold) + ' · Repasse em dinheiro/Pix/transferência: ' + brl(paid),
      'Saldo atual: ' + brl(available) + ' disponível · ' + brl(pending) + ' a liberar · ' + brl(outstanding) + ' em acordos a compensar',
      ...events.map(e => [formatDate(e.date), captions[e.kind], e.code, amountLabel(e), e.kind === 'payout' ? eventDetail(e) : ''].filter(Boolean).join(' · '))].join('\n');
    const phone = (seller.phone || '').replace(/\D/g, '');
    window.open('https://wa.me/' + (phone ? (phone.length <= 11 ? '55' : '') + phone : '') + '?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
  };
  const stat = (title, amount, hint) => h('article', { className: 'com-stat', key: title },
    h('span', null, title), h('strong', null, brl(amount)), h('small', null, hint));
  return h('section', { className: 'com-page' },
    h('header', { className: 'com-panel com-toolbar' }, h('div', null, h('h2', null, 'Vendedores e comissões'),
      h('p', { className: 'com-muted' }, 'Acompanhe indicações, comissões e acertos de cada vendedor.')),
      button('Cadastrar vendedor', () => open('seller'), { className: 'com-primary' })),
    notice && h('p', { role: 'status', className: 'com-note' }, notice),
    !book.sellers.length && !form && h('div', { className: 'com-panel' }, h('h3', null, 'Nenhum vendedor cadastrado'), h('p', null, 'Cadastre o primeiro indicador para poder selecioná-lo nas novas vendas. Vendas sem indicação continuam funcionando normalmente.')),
    seller && h('div', { className: 'com-panel com-filters' },
      h('label', { className: 'com-field' }, h('span', null, 'Vendedor ou indicador'), h('select', { value: id, onChange: e => { selectSeller(e.target.value); setForm(''); setSearch(''); setNotice(''); } },
        [...book.sellers].sort((a,b) => a.name.localeCompare(b.name, 'pt-BR')).map(s => h('option', { key: s.id, value: s.id }, s.name + (s.active === false ? ' · Inativo' : ''))))),
      h('label', { className: 'com-field' }, h('span', null, 'De'), h('input', { type: 'date', value: start, max: end || undefined, onChange: e => setStart(e.target.value) })),
      h('label', { className: 'com-field' }, h('span', null, 'Até'), h('input', { type: 'date', value: end, min: start || undefined, onChange: e => setEnd(e.target.value) })),
      button('Todo o período', () => { setStart(''); setEnd(''); }), button('Editar cadastro', () => open('edit'))),
    form && h(CommissionForm, { key: form + (id || ''), kind: form === 'edit' ? 'seller' : form, editing: form === 'edit' ? seller : null,
      seller, sales, port, onPost, onClose: () => setForm(''), onSaved: next => { selectSeller(next); setForm(''); setNotice('Registro salvo.'); } }),
    seller && h(React.Fragment, null,
      h('div', { className: 'com-stats' }, stat('Total vendido', sold, 'Vendas válidas do período'), stat('A liberar', pending, 'Saldo atual do crediário'),
        stat('Disponível', available, 'Saldo atual antes de acordos'), stat('Já pago', paid, 'Saída efetiva no período'), stat('A compensar', outstanding, 'Acordos ainda não abatidos')),
      h('div', { className: 'com-actions' },
        button('Registrar repasse', () => open('payout'), { className: 'com-primary', disabled: !available }),
        button('Adicionar comissão', () => open('credit'), { disabled: seller.active === false }),
        button('Lançar compensação manual', () => open('agreement'), { disabled: !rows.some(r => r.recoverable > 0) }),
        button('Compartilhar extrato no WhatsApp', share)),
      h('div', { className: 'com-panel' }, h('h3', null, 'Vendas indicadas e bônus'), h('p', { className: 'com-muted' }, 'Comissões concedidas no período · padrão atual do vendedor: ' + decimal(seller.rate) + '%'),
        h('input', { type: 'search', value: search, 'aria-label': 'Buscar por cliente, código ou motivo', placeholder: 'Buscar por cliente, código ou motivo', onChange: e => setSearch(e.target.value) }),
        !selected.length && h('p', { className: 'com-muted' }, 'Nenhuma comissão corresponde a este filtro.'),
        [...selected].sort((a,b) => b.grant.date.localeCompare(a.grant.date)).map(r => h('article', { key: r.id, className: 'com-line' },
          h('div', null, h('strong', null, r.saleId ? (r.sale?.customerName || (r.sale?.archived ? 'Venda excluída' : 'Venda avulsa')) + ' · ' + r.code : 'Bônus avulso'),
            h('small', null, formatDate(r.grant.date) + ' · ' + r.grant.reason + (r.sale ? ' · Venda ' + brl(Math.round(r.sale.totalPrice * 100)) : '')),
            h('small', null, (r.grant.mode === 'percent' ? decimal(r.grant.units) + '% sobre ' + brl(r.state.base) : 'Valor fixo') + ' · Comissão ' + brl(r.amount)),
            r.pending > 0 && h('small', null, r.state.costKnown ? 'Faltam ' + brl(Math.max(0, r.state.total - r.state.profit)) + ' em recebimentos para liberar a comissão da venda.' : 'Custo da venda não identificado; a comissão permanece a liberar.')),
          h('div', { className: 'com-line-end' }, h('strong', null, r.canceled ? 'Venda cancelada' : r.available ? 'Disponível: ' + brl(r.available) : r.pending ? 'A liberar: ' + brl(r.pending) : 'Liquidada'),
            r.paid > 0 && h('small', null, 'Já liquidado: ' + brl(r.paid)),
            r.sale && !r.sale.archived && button('Ver venda', () => onOpenSale(r.sale)))))),
      h('div', { className: 'com-panel' }, h('h3', null, 'Histórico de comissões'), h('p', { className: 'com-muted' }, 'Movimentos pela data do lançamento. Acordos e liberações não são saídas de caixa.'),
        !events.length && h('p', null, 'Nenhum lançamento no período.'),
        events.map((e, i) => h('article', { key: [e.id || e.grantId || e.saleId, e.kind, e.at, i].join(':'), className: 'com-line' },
          h('div', null, h('strong', null, captions[e.kind] + (e.code ? ' · ' + e.code : '')),
            h('small', null, formatDate(e.date) + ' · ' + e.by), h('small', null, eventDetail(e)),
            e.kind === 'payout' && h('details', null, h('summary', null, 'Composição do repasse'),
              e.lines.map(l => h('small', { key: l.grantId }, (l.code || 'Bônus avulso') + ' · ' + (rows.find(r => r.id === l.grantId)?.grant.reason || 'Comissão') + ' · ' + brl(l.amount))),
              e.offsets.map(l => h('small', { key: l.agreementId }, 'Acordo · ' + (port.agreements.find(a => a.id === l.agreementId)?.code || '') + ' · ' + brl(l.amount))),
              h('small', null, e.reason)),
            ['void','agreement','reprice'].includes(e.kind) && h('small', null, 'Origem: ' + (rows.find(r => r.id === e.grantId)?.grant.reason || e.grantId))),
          h('strong', null, amountLabel(e)))))));
}
