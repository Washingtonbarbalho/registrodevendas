import React, { useMemo, useState } from 'https://esm.sh/react@18.2.0';
import { ArrowDownCircle, BadgePercent, Banknote, Clock, Copy, Edit3, History, MessageCircle, Plus, Receipt, RefreshCw, Search, Users, Wallet } from 'https://esm.sh/lucide-react@0.292.0';
import { DateRangePicker } from '../components.js?v=112';
import { formatDate, getBrazilDateString } from '../utils.js?v=112';
import { agreementMode, commissionMethods, portfolio } from './core.js?v=112';
import { CommissionDialog } from './dialog.js?v=112';
import { CommissionForm } from './forms.js?v=112';
import { brl, buildSellerStatement, currentMonthRange, decimal, eventTitle, includesDate, periodLabel, rowStatus, saleValue, sellerPhoneMask, sellerWhatsappUrl, sellerOverview } from './presentation.js?v=112';

const h = React.createElement;
const pageSize = 12;
const allDates = { startDate: '', endDate: '' };
const normalize = input => String(input ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const button = (label, onClick, { icon, className = 'com-button', ...props } = {}) => h('button', {
  type: 'button', className, onClick, ...props
}, icon && h(icon, { size: 17, 'aria-hidden': true }), label);
const mainButton = (label, onClick, props = {}) => button(label, onClick, { className: 'page-primary-action', ...props });
const empty = (title, copy) => h('div', { className: 'com-empty' }, h('strong', null, title), h('p', null, copy));
const keyValue = (title, value) => h('div', { key: title }, h('dt', null, title), h('dd', null, value));
const facts = (...pairs) => h('dl', { className: 'com-facts' }, pairs.map(([title, value]) => keyValue(title, value)));
const badge = (title, status) => h('span', { className: 'com-badge is-' + status }, title);
const statusKeys = [['all','Todas'], ['available','Disponíveis'], ['pending','A liberar'], ['settled','Liquidadas'], ['canceled','Canceladas']];
const historyKeys = [['all','Tudo'], ['payout','Repasses'], ['agreement','Compensações'], ['other','Outros']];
const endBalance = r => r.available || r.pending;
const rowTitle = r => r.sale ? (r.sale.customerName || (r.sale.archived ? 'Venda excluída' : 'Venda avulsa')) : 'Bônus avulso';
const saleKind = r => r.sale ? (r.sale.saleType === 'direct' ? 'No caixa' : 'Crediário') : 'Lançamento manual';
const moneyEvent = e => e.kind === 'agreement' && agreementMode(e) === 'immediate'
  ? { text: '+ ' + brl(Math.abs(e.amount)), style: 'is-in' }
  : e.kind === 'payout' ? { text: e.cash > 0 ? '− ' + brl(e.cash) : 'Sem saída', style: e.cash > 0 ? 'is-out' : '' }
    : e.kind === 'agreement' ? { text: brl(Math.abs(e.amount)), style: '' }
      : ['canceled','hold','release'].includes(e.kind) ? { text: '', style: '' }
        : { text: brl(e.amount), style: '' };

function Stat({ icon: Icon, title, amount, hint, tone }) {
  return h('article', { className: 'com-stat' },
    h('span', { className: 'com-icon is-' + tone }, h(Icon, { size: 17, 'aria-hidden': true })),
    h('div', null, h('h4', null, title), h('strong', null, brl(amount)), h('small', null, hint)));
}

function CommissionDetails({ row, onClose, onOpenSale, onAgreement }) {
  const state = rowStatus(row);
  const balance = endBalance(row);
  return h(CommissionDialog, {
    title: 'Detalhes da comissão', subtitle: rowTitle(row) + (row.code ? ' · ' + row.code : ''), icon: BadgePercent, onClose,
    actions: [
      button('Fechar', onClose, { key: 'close' }),
      row.sale && !row.sale.archived && button('Abrir venda', () => onOpenSale(row.sale), { key: 'sale', icon: Receipt }),
      row.recoverable > 0 && mainButton('Compensar comissão', () => onAgreement(row.id), { key: 'agreement', icon: RefreshCw })
    ]
  },
    badge(state.title, state.key),
    facts(
      ['Origem', row.grant.reason],
      ['Data do lançamento', formatDate(row.grant.date)],
      ['Cálculo', row.grant.mode === 'percent' ? decimal(row.grant.units) + '% sobre ' + brl(row.state.base) : 'Valor fixo'],
      ...(row.sale ? [['Valor da venda', brl(saleValue(row.sale))]] : []),
      ['Comissão', brl(row.amount)], ['Já liquidado', brl(row.paid)],
      ...(balance ? [[state.title, brl(balance)]] : []),
      ...(row.recoverable ? [['Disponível para compensar', brl(row.recoverable)]] : [])),
    row.pending > 0 && h('p', { className: 'com-callout' }, row.state.costKnown
      ? 'Faltam ' + brl(Math.max(0, row.state.total - row.state.profit)) + ' em recebimentos para liberar a comissão desta venda.'
      : 'O custo da venda não foi identificado. A comissão ainda não pode ser liberada.'));
}

function MovementDetails({ event, overview, port, onClose }) {
  const payout = event.kind === 'payout';
  const agreement = event.kind === 'agreement' ? port.agreements.find(a => a.id === event.id) : null;
  const immediate = agreement && agreementMode(agreement) === 'immediate';
  const origin = overview.rows.find(r => r.id === event.grantId);
  return h(CommissionDialog, {
    title: eventTitle(event), subtitle: formatDate(event.date) + (event.code ? ' · ' + event.code : ''),
    icon: History, onClose, actions: button('Fechar', onClose)
  },
    facts(['Registrado por', event.by], ['Motivo', event.reason],
      ...(origin ? [['Comissão de origem', origin.grant.reason]] : []),
      ...(payout ? [['Valor liquidado', brl(event.gross)], ['Abatido em compensações', brl(event.offset)],
        ['Saída de caixa', brl(event.cash)], ...(event.cash > 0 ? [['Forma do repasse', commissionMethods[event.method]]] : [])]
        : agreement ? [['Valor da compensação', brl(agreement.amount)],
          immediate ? ['Forma da devolução', commissionMethods[agreement.method]] : ['Ainda a compensar', brl(agreement.remaining)]]
          : moneyEvent(event).text ? [['Valor', moneyEvent(event).text]] : [])),
    agreement && h('p', { className: 'com-callout' }, immediate
      ? 'A devolução já foi lançada como entrada de caixa no Financeiro e não será abatida de outro repasse.'
      : 'Este acordo não gera entrada de caixa. O saldo pode ser abatido nos próximos repasses.'),
    payout && h('section', { className: 'com-breakdown' },
      h('h3', null, 'Composição do repasse'),
      facts(...event.lines.map((l, i) => [
        (l.code || 'Bônus avulso') + ' · ' + (overview.rows.find(r => r.id === l.grantId)?.grant.reason || 'Comissão') + (i ? ' · ' + (i + 1) : ''),
        brl(l.amount)
      ])),
      event.offsets.length > 0 && h(React.Fragment, null,
        h('h3', null, 'Compensações aplicadas'),
        facts(...event.offsets.map((l, i) => ['Acordo ' + (i + 1) + ' · ' + (port.agreements.find(a => a.id === l.agreementId)?.code || ''), brl(l.amount)])))));
}

function StatementDialog({ seller, storeName, range, overview, onClose }) {
  const [notice, setNotice] = useState('');
  const text = buildSellerStatement({ seller, storeName, range, overview });
  const link = sellerWhatsappUrl(seller.phone, text);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice('Extrato copiado.');
    } catch {
      setNotice('Não foi possível copiar automaticamente. Selecione o texto da prévia para copiar.');
    }
  };
  return h(CommissionDialog, {
    title: 'Extrato do vendedor', subtitle: seller.name + ' · ' + periodLabel(range), icon: Receipt, onClose,
    actions: [
      button('Copiar mensagem', copy, { key: 'copy', icon: Copy }),
      link && link.length <= 12000 && h('a', {
        key: 'whatsapp', className: 'com-whatsapp', href: link, target: '_blank', rel: 'noopener noreferrer'
      }, h(MessageCircle, { size: 18, 'aria-hidden': true }), 'Abrir no WhatsApp')
    ]
  },
    h('p', { className: 'com-muted' }, 'A mensagem contém apenas o extrato deste vendedor, sem dados dos clientes.'),
    !link && h('p', { className: 'com-callout' }, 'O vendedor não tem WhatsApp cadastrado. Você pode copiar a mensagem.'),
    link.length > 12000 && h('p', { className: 'com-callout' }, 'Extrato longo para envio por link. Copie a mensagem ou selecione um período menor.'),
    h('pre', { className: 'com-statement', tabIndex: 0, 'aria-label': 'Prévia da mensagem' }, text),
    notice && h('p', { className: 'com-callout', role: 'status' }, notice));
}

export function CommissionTab({ book, sales, onPost, onOpenSale, storeName }) {
  const [sellerId, setSellerId] = useState('');
  const [modal, setModal] = useState(null), [notice, setNotice] = useState('');
  const [range, setRange] = useState(() => currentMonthRange(getBrazilDateString()));
  const [pane, setPane] = useState('sales'), [search, setSearch] = useState('');
  const [status, setStatus] = useState('all'), [historyFilter, setHistoryFilter] = useState('all'), [limit, setLimit] = useState(pageSize);
  const port = useMemo(() => portfolio(sales, book), [sales, book]);
  const sellers = useMemo(() => [...book.sellers].sort((a,b) => a.name.localeCompare(b.name, 'pt-BR')), [book.sellers]);
  const seller = sellers.find(s => s.id === sellerId) || sellers.find(s => s.active !== false) || sellers[0];
  const overview = useMemo(() => sellerOverview(port, seller?.id, range), [port, seller?.id, range]);
  const hasAgreement = overview.rows.some(r => r.recoverable > 0);
  const close = () => setModal(null);
  const open = (kind, data = {}) => { setNotice(''); setModal({ kind, ...data }); };
  const resetLimit = (set, value) => { set(value); setLimit(pageSize); };
  const changeSeller = id => {
    setSellerId(id); setSearch(''); setStatus('all'); setHistoryFilter('all'); setLimit(pageSize); setNotice('');
  };
  const searchValue = normalize(search);
  const rows = overview.rows.filter(r => includesDate(range, r.grant.date)
    && (status === 'all' || rowStatus(r).key === status)
    && (!searchValue || normalize([r.code, r.sale?.customerName, r.grant.reason].join(' ')).includes(searchValue)))
    .sort((a,b) => b.grant.date.localeCompare(a.grant.date) || b.grant.at.localeCompare(a.grant.at));
  const events = overview.events.filter(e => historyFilter === 'all' || e.kind === historyFilter
    || (historyFilter === 'other' && !['payout', 'agreement'].includes(e.kind)));
  const detail = modal?.kind === 'commission' ? overview.rows.find(r => r.id === modal.grantId) : null;
  const chips = (title, options, selected, set) => h('div', { role: 'group', 'aria-label': title, className: 'com-chips' },
    options.map(([key, label]) => button(label, () => resetLimit(set, key), {
      key, className: 'com-chip', 'aria-pressed': key === selected
    })));

  return h('section', { className: 'com-page' },
    h('header', { className: 'page-heading com-heading' },
      h('div', { className: 'page-heading-copy' }, h('h1', { className: 'page-title' }, 'Vendedores e comissões'),
        h('p', { className: 'page-description' }, 'Consulte vendas, acompanhe o saldo de cada vendedor e registre repasses e compensações.')),
      mainButton('Cadastrar vendedor', () => open('seller'), { icon: Plus, 'aria-haspopup': 'dialog' })),
    notice && h('p', { role: 'status', className: 'com-callout is-success' }, notice),
    !seller && h('section', { className: 'com-panel com-onboard' },
      h('span', { className: 'com-icon' }, h(Users, { size: 25, 'aria-hidden': true })),
      empty('Nenhum vendedor cadastrado', 'Cadastre seu primeiro vendedor para selecioná-lo em novas vendas e acompanhar as comissões aqui.')),
    seller && h(React.Fragment, null,
      h('section', { className: 'com-panel com-seller' },
        h('div', { className: 'com-seller-top' },
          h('span', { className: 'com-icon' }, h(Users, { size: 22, 'aria-hidden': true })),
          h('label', { className: 'com-field' }, h('span', null, 'Vendedor'),
            h('select', { value: seller.id, onChange: e => changeSeller(e.target.value) },
              sellers.map(s => h('option', { key: s.id, value: s.id }, s.name + (s.active === false ? ' · Inativo' : ''))))),
          button('Editar cadastro', () => open('edit'), { icon: Edit3, 'aria-haspopup': 'dialog' })),
        h('div', { className: 'com-seller-meta' },
          badge(seller.active === false ? 'Inativo' : 'Ativo', seller.active === false ? 'canceled' : 'available'),
          h('span', null, 'Comissão padrão: ', h('strong', null, decimal(seller.rate) + '%')),
          seller.phone && h('span', null, 'WhatsApp: ', h('strong', null, sellerPhoneMask(seller.phone))))),
      h('section', { className: 'com-panel com-summary' },
        h('div', { className: 'com-section-head' },
          h('div', null, h('h2', null, 'Resumo do vendedor'), h('p', { className: 'com-muted' }, 'O período filtra vendas e movimentações; os saldos abaixo são os atuais.')),
          h('div', { className: 'com-period' },
            h(DateRangePicker, { ...range, label: range.startDate || range.endDate ? undefined : 'Todo o período',
              title: 'Período das comissões', onChange: next => resetLimit(setRange, next) }),
            button(range.startDate || range.endDate ? 'Todo o período' : 'Mês atual', () => resetLimit(setRange,
              range.startDate || range.endDate ? allDates : currentMonthRange(getBrazilDateString()))))),
        h('div', { className: 'com-summary-group' },
          h('h3', null, 'No período'),
          h('div', { className: 'com-stats' },
            h(Stat, { icon: Receipt, tone: 'blue', title: 'Total vendido', amount: overview.sold, hint: overview.salesCount === 1 ? '1 venda válida' : overview.salesCount + ' vendas válidas' }),
            h(Stat, { icon: Banknote, tone: 'blue', title: 'Repasses pagos', amount: overview.paid, hint: 'Saídas de caixa' }),
            h(Stat, { icon: ArrowDownCircle, tone: 'green', title: 'Devoluções recebidas', amount: overview.returned, hint: 'Entradas de caixa' }))),
        h('div', { className: 'com-summary-group' },
          h('h3', null, 'Saldo atual'),
          h('div', { className: 'com-stats' },
            h(Stat, { icon: Wallet, tone: 'green', title: 'Disponível', amount: overview.available, hint: 'Para repassar ao vendedor' }),
            h(Stat, { icon: Clock, tone: 'amber', title: 'A liberar', amount: overview.pending, hint: 'Depende dos recebimentos' }),
            h(Stat, { icon: RefreshCw, tone: 'amber', title: 'A compensar', amount: overview.outstanding, hint: 'Nos próximos repasses' }))),
        h('div', { className: 'com-operations', role: 'group', 'aria-label': 'Ações do vendedor' },
          mainButton('Registrar repasse', () => open('payout'), { icon: Wallet, 'aria-haspopup': 'dialog', disabled: !overview.available }),
          button('Adicionar comissão', () => open('credit'), { icon: Plus, 'aria-haspopup': 'dialog', disabled: seller.active === false }),
          button('Compensar comissão', () => open('agreement'), { icon: RefreshCw, 'aria-haspopup': 'dialog', disabled: !hasAgreement,
            title: !hasAgreement ? 'Disponível para comissões já liquidadas de vendas canceladas' : undefined }),
          button('Extrato do vendedor', () => open('statement'), { icon: MessageCircle, 'aria-haspopup': 'dialog' }))),
      h('section', { className: 'com-panel com-records' },
        h('div', { className: 'com-section-head' },
          h('h2', null, 'Registros do vendedor'),
          chips('Exibir', [['sales', 'Vendas e comissões'], ['history', 'Movimentações']], pane, setPane)),
        pane === 'sales' ? h(React.Fragment, null,
          h('div', { className: 'com-list-tools' },
            h('label', { className: 'com-search' }, h(Search, { size: 16, 'aria-hidden': true }),
              h('input', { type: 'search', 'aria-label': 'Buscar por cliente, código ou motivo', placeholder: 'Buscar cliente, código ou motivo',
                value: search, onChange: e => resetLimit(setSearch, e.target.value) })),
            chips('Situação da comissão', statusKeys, status, setStatus)),
          !rows.length && empty('Nenhuma comissão para mostrar', 'Altere o período, a situação ou a busca.'),
          h('div', { className: 'com-list' }, rows.slice(0, limit).map(r => {
            const state = rowStatus(r);
            return h('article', { className: 'com-line', key: r.id },
              h('div', { className: 'com-line-main' }, h('strong', null, rowTitle(r)),
                h('small', null, [r.code, saleKind(r), formatDate(r.grant.date)].filter(Boolean).join(' · '))),
              h('div', { className: 'com-line-value' }, h('strong', null, brl(r.amount)), badge(state.title, state.key),
                r.paid > 0 && endBalance(r) > 0 && h('small', null, 'Saldo: ' + brl(endBalance(r)))),
              button('Ver detalhes', () => open('commission', { grantId: r.id }), {
                'aria-haspopup': 'dialog', 'aria-label': 'Ver detalhes · ' + (r.code || rowTitle(r)) + ' · ' + r.grant.reason
              }));
          })),
          rows.length > limit && button('Mostrar mais comissões', () => setLimit(limit + pageSize)))
          : h(React.Fragment, null,
            h('div', { className: 'com-list-tools' }, chips('Tipo de movimentação', historyKeys, historyFilter, setHistoryFilter)),
            !events.length && empty('Nenhuma movimentação para mostrar', 'Altere o período ou o tipo de movimentação.'),
            h('div', { className: 'com-list' }, events.slice(0, limit).map((e, i) => {
              const amount = moneyEvent(e);
              return h('article', { className: 'com-line', key: [e.kind, e.id || e.saleId, e.at, i].join(':') },
                h('div', { className: 'com-line-main' }, h('strong', null, eventTitle(e)),
                  h('small', null, [formatDate(e.date), e.code].filter(Boolean).join(' · '))),
                h('strong', { className: 'com-line-value ' + amount.style }, amount.text),
                button('Ver detalhes', () => open('movement', { event: e }), {
                  'aria-haspopup': 'dialog', 'aria-label': 'Ver detalhes · ' + eventTitle(e) + (e.code ? ' · ' + e.code : '')
                }));
            })),
            events.length > limit && button('Mostrar mais movimentações', () => setLimit(limit + pageSize))))),
    modal && (modal.kind === 'statement' ? h(StatementDialog, { seller, storeName, range, overview, onClose: close })
      : modal.kind === 'commission' ? detail && h(CommissionDetails, { row: detail, onClose: close,
        onOpenSale: sale => { close(); onOpenSale(sale); }, onAgreement: grantId => open('agreement', { grantId }) })
        : modal.kind === 'movement' ? h(MovementDetails, { event: modal.event, overview, port, onClose: close })
          : h(CommissionForm, { key: modal.kind + (seller?.id || ''), kind: modal.kind === 'edit' ? 'seller' : modal.kind,
            editing: modal.kind === 'edit' ? seller : null, initialGrantId: modal.grantId,
            seller, sales, port, onPost, onClose: close, onSaved: (id, message) => { changeSeller(id); close(); setNotice(message); } })));
}
