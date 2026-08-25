import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.2.0';
import { createPortal } from 'https://esm.sh/react-dom@18.2.0';
import {
  ArrowDown, ArrowUp, Banknote, CalendarDays, CreditCard, Edit3, Eye,
  Package, Plus, Receipt, Search, Trash2, Wallet, X
} from 'https://esm.sh/lucide-react@0.292.0';
import { db, APP_ID } from './firebase-config.js?v=80';
import { doc, onSnapshot, runTransaction, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { MoneyInput } from './components.js';
import { formatCurrency, formatDate, getBrazilDateString, getCurrentMonthEnd, getCurrentMonthStart, parseMoney } from './utils.js';
import { normalizePaymentInstallments } from './purchase-payment-v68.js';
import { buildFinancialLedger, getInstallmentFaceAmount, getPurchaseGroups, money, sumMoney, toCents } from './financial-core-v70.js';
import { buildFinancialAccountDetails } from './financial-account-details-v80.js';

const h = React.createElement;
const EMPTY_DATA = { entries: [], accounts: [] };
const cleanDate = value => String(value || '').split('T')[0];
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const makeId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const isPrazo = sale => sale?.saleType === 'prazo' || !sale?.saleType;
const paymentLabel = method => ({ money: 'Dinheiro', pix: 'PIX', debit: 'Débito', credit: 'Crédito', term: 'A prazo' }[method] || 'Pagamento');
const normalizeFinancialData = raw => ({ entries: Array.isArray(raw?.entries) ? raw.entries : [], accounts: Array.isArray(raw?.accounts) ? raw.accounts : [] });

const formatOffset = date => {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
};

const dateWithCurrentTime = dateValue => {
  const date = cleanDate(dateValue);
  if (!date) return '';
  const now = new Date();
  return `${date}T${now.toTimeString().slice(0, 8)}${formatOffset(now)}`;
};

const sortTimestamp = item => {
  const raw = item?.dateTime || (item?.date ? `${cleanDate(item.date)}T00:00:00` : '');
  if (!raw) return 0;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const formatDateTime = (dateValue, dateTimeValue) => {
  const date = cleanDate(dateValue || dateTimeValue);
  if (!date) return '--/--/---- · --:--';
  if (dateTimeValue) {
    const parsed = new Date(dateTimeValue);
    if (!Number.isNaN(parsed.getTime())) return `${formatDate(date)} · ${parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return `${formatDate(date)} · --:--`;
};

const statusOf = (dueDate, paid, partial = false, canceled = false, paidLabel = 'Recebida') => {
  if (canceled) return { label: 'Cancelada', cls: 'is-canceled' };
  if (paid) return { label: paidLabel, cls: 'is-paid' };
  if (partial) return { label: 'Parcial', cls: 'is-partial' };
  if (!dueDate) return { label: 'Em aberto', cls: 'is-open' };
  const today = getBrazilDateString();
  if (dueDate < today) return { label: 'Atrasada', cls: 'is-overdue' };
  if (dueDate === today) return { label: 'Vence hoje', cls: 'is-today' };
  return { label: 'Em aberto', cls: 'is-open' };
};

const useBodyLock = open => useEffect(() => {
  if (!open) return undefined;
  const previous = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  return () => { document.body.style.overflow = previous; };
}, [open]);

const FormModal = ({ open, kind, initial, onClose, onSave }) => {
  const [type, setType] = useState('income');
  const [description, setDescription] = useState('');
  const [party, setParty] = useState('');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(getBrazilDateString());
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  useBodyLock(open);

  useEffect(() => {
    if (!open) return;
    setType(initial?.type || 'income');
    setDescription(initial?.description || '');
    setParty(initial?.party || '');
    setValue(initial?.value ? String(initial.value).replace('.', ',') : '');
    setDate(cleanDate(initial?.date || initial?.dueDate) || getBrazilDateString());
    setCategory(initial?.category || '');
    setNotes(initial?.notes || '');
    setSaving(false);
  }, [open, kind, initial]);

  if (!open) return null;
  const title = initial ? 'Editar lançamento' : kind === 'movement' ? 'Nova movimentação' : kind === 'receivable' ? 'Nova conta a receber' : 'Nova conta a pagar';

  const submit = async () => {
    const parsed = parseMoney(value);
    if (!description.trim()) return alert('Informe a descrição.');
    if (!(parsed > 0)) return alert('Informe um valor válido.');
    if (!date) return alert('Informe a data.');
    setSaving(true);
    try {
      await onSave({ kind, type: kind === 'movement' ? type : kind, description: description.trim(), party: party.trim(), value: money(parsed), date, category: category.trim(), notes: notes.trim(), id: initial?.id || null });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const bodyChildren = [];
  if (kind === 'movement') {
    bodyChildren.push(h('section', { key: 'type', className: 'finance46-card finance46-card-type' },
      h('div', { className: 'finance46-section-label' }, 'Tipo'),
      h('div', { className: 'finance46-type-switch' },
        h('button', { type: 'button', onClick: () => setType('income'), className: type === 'income' ? 'is-active is-income' : '' }, h(ArrowUp, { size: 17 }), 'Entrada'),
        h('button', { type: 'button', onClick: () => setType('expense'), className: type === 'expense' ? 'is-active is-expense' : '' }, h(ArrowDown, { size: 17 }), 'Saída')
      )
    ));
  }
  bodyChildren.push(h('section', { key: 'info', className: 'finance46-card' },
    h('div', { className: 'finance46-section-label' }, 'Informações'),
    h('label', { className: 'finance46-field finance46-field-wide' }, h('span', null, 'Descrição *'), h('input', { value: description, onChange: e => setDescription(e.target.value) })),
    kind !== 'movement' && h('label', { className: 'finance46-field finance46-field-wide' }, h('span', null, kind === 'receivable' ? 'Cliente / origem' : 'Fornecedor / favorecido'), h('input', { value: party, onChange: e => setParty(e.target.value), placeholder: 'Opcional' })),
    h('div', { className: 'finance46-fields-grid' },
      h('label', { className: 'finance46-field' }, h('span', null, 'Valor *'), h(MoneyInput, { value, onChange: setValue, className: 'finance46-money' })),
      h('label', { className: 'finance46-field' }, h('span', null, kind === 'movement' ? 'Data *' : 'Vencimento *'), h('input', { type: 'date', value: date, onChange: e => setDate(e.target.value) }))
    ),
    h('label', { className: 'finance46-field finance46-field-wide' }, h('span', null, 'Categoria'), h('input', { value: category, onChange: e => setCategory(e.target.value) })),
    h('label', { className: 'finance46-field finance46-field-wide' }, h('span', null, 'Observação'), h('textarea', { rows: 3, value: notes, onChange: e => setNotes(e.target.value) }))
  ));

  return createPortal(h('div', { className: 'finance46-overlay', role: 'dialog', 'aria-modal': 'true' },
    h('div', { className: 'finance46-modal' },
      h('header', { className: 'finance46-modal-hero' },
        h('div', { className: 'finance46-modal-icon' }, h(kind === 'movement' ? Banknote : kind === 'receivable' ? Receipt : CreditCard, { size: 22 })),
        h('div', { className: 'finance46-modal-heading' }, h('span', null, initial ? 'Edição manual' : 'Lançamento manual'), h('h2', null, title), h('p', null, 'Somente registros manuais podem ser alterados por aqui.')),
        h('button', { type: 'button', onClick: onClose, className: 'finance46-close' }, h(X, { size: 20 }))
      ),
      h('div', { className: 'finance46-modal-scroll' }, ...bodyChildren),
      h('footer', { className: 'finance46-modal-footer' },
        h('button', { type: 'button', onClick: onClose, className: 'finance46-button is-secondary' }, 'Cancelar'),
        h('button', { type: 'button', onClick: submit, disabled: saving, className: 'finance46-button is-primary' }, saving ? 'Salvando...' : 'Salvar')
      )
    )
  ), document.body);
};

const AccountDetailsModal = ({ item, products, onClose, onOpenSale, onOpenProduct, onEdit }) => {
  useBodyLock(!!item);
  const details = useMemo(() => item
    ? buildFinancialAccountDetails(item, { products, today: getBrazilDateString() })
    : null, [item, products]);
  if (!details) return null;

  const dueDescription = details.daysUntilDue === null
    ? ''
    : details.daysUntilDue < 0
      ? `${Math.abs(details.daysUntilDue)} dia(s) em atraso`
      : details.daysUntilDue === 0
        ? 'Vence hoje'
        : `Vence em ${details.daysUntilDue} dia(s)`;

  const field = (label, value, key = label) => value
    ? h('div', { key, className: 'finance80-detail-field' },
      h('span', null, label),
      h('strong', null, value))
    : null;

  const sections = [
    h('section', { key: 'summary', className: 'finance46-card finance80-account-summary' },
      h('div', { className: 'finance80-account-title' },
        h('strong', null, details.description),
        h('span', { className: `finance44-status ${details.status.cls}` }, details.status.label)),
      h('div', { className: 'finance80-balance-grid' },
        field('Valor original', formatCurrency(details.originalAmount)),
        field(details.direction === 'receivable' ? 'Valor recebido' : 'Valor pago', formatCurrency(details.paidAmount)),
        field('Saldo em aberto', formatCurrency(details.remainingAmount))),
      dueDescription && h('small', { className: details.daysUntilDue < 0 ? 'finance80-due-note is-overdue' : 'finance80-due-note' }, dueDescription)),
    h('section', { key: 'information', className: 'finance46-card' },
      h('div', { className: 'finance46-section-label' }, 'Informações da conta'),
      h('div', { className: 'finance80-detail-grid' },
        field('Origem', details.sourceLabel),
        field(details.partyLabel, details.party),
        field('Vencimento', details.dueDate ? formatDate(details.dueDate) : 'Não informado'),
        field('Situação', details.status.label),
        field('Parcela', details.installmentNumber ? `${details.installmentNumber} de ${details.installmentsCount}` : ''),
        field('Forma de pagamento', details.paymentMethod),
        field('Categoria', details.category),
        field('WhatsApp', details.customerPhone),
        field(details.originDateLabel, details.originDate ? formatDate(details.originDate) : ''),
        field(details.originTotalLabel, formatCurrency(details.originTotal)),
        field(details.direction === 'receivable' ? 'Recebido em' : 'Pago em',
          details.paidAt ? formatDateTime(details.paidAt, details.paidAtDateTime) : '')),
      details.source === 'stock' && h('div', { className: 'finance80-purchase-summary' },
        field('Total pago na compra', formatCurrency(details.purchasePaidTotal)),
        field('Total em aberto na compra', formatCurrency(details.purchaseOpenTotal)),
        details.purchaseCanceledTotal > 0 && field('Cancelamentos', formatCurrency(details.purchaseCanceledTotal))),
      details.notes && h('div', { className: 'finance80-detail-notes' },
        h('span', null, 'Observações'), h('p', null, details.notes)))
  ];

  if (details.products.length > 0) {
    sections.push(h('section', { key: 'products', className: 'finance46-card' },
      h('div', { className: 'finance46-section-label' }, details.source === 'sale' ? 'Produtos da venda' : 'Produtos da compra'),
      h('div', { className: 'finance80-detail-list' }, details.products.map((product, index) =>
        h('article', { key: `${product.name}-${index}`, className: 'finance80-detail-list-item' },
          h('div', null,
            h('strong', null, product.name),
            h('span', null, `${product.quantity} un. × ${formatCurrency(product.unitValue)}${product.canceledQuantity ? ` · ${product.canceledQuantity} cancelada(s)` : ''}`)),
          h('strong', null, formatCurrency(product.total)))))));
  }

  sections.push(h('section', { key: 'history', className: 'finance46-card' },
    h('div', { className: 'finance46-section-label' }, 'Histórico da conta'),
    details.history.length > 0
      ? h('div', { className: 'finance80-detail-list' }, details.history.map((entry, index) =>
        h('article', { key: `${entry.type}-${entry.dateTime}-${index}`, className: 'finance80-detail-list-item' },
          h('div', null,
            h('strong', null, entry.label),
            h('span', null, entry.date ? formatDateTime(entry.date, entry.dateTime) : 'Data não informada')),
          h('strong', { className: entry.type === 'cancellation' ? 'finance80-history-canceled' : '' }, formatCurrency(entry.amount)))))
      : h('p', { className: 'finance80-empty-history' }, 'Nenhum pagamento registrado para esta conta.')));

  const openOrigin = () => {
    onClose();
    if (item.source === 'sale') onOpenSale?.(item.sale);
    else if (item.source === 'stock' && !item.batchId) onOpenProduct?.(item.product);
    else if (item.source === 'manual') onEdit?.(item);
  };
  const originAction = item.source === 'sale'
    ? 'Ver venda'
    : item.source === 'stock' && !item.batchId
      ? 'Ver produto'
      : item.source === 'manual'
        ? 'Editar conta'
        : '';

  return createPortal(h('div', { className: 'finance46-overlay finance80-account-overlay', role: 'dialog', 'aria-modal': 'true' },
    h('div', { className: 'finance46-modal finance80-account-modal' },
      h('header', { className: 'finance46-modal-hero' },
        h('div', { className: 'finance46-modal-icon' }, h(details.direction === 'receivable' ? Receipt : CreditCard, { size: 22 })),
        h('div', { className: 'finance46-modal-heading' },
          h('span', null, details.sourceLabel), h('h2', null, details.title),
          h('p', null, 'Consulte valores, vencimento, origem e histórico.')),
        h('button', { type: 'button', onClick: onClose, className: 'finance46-close', 'aria-label': 'Fechar detalhes' }, h(X, { size: 20 }))),
      h('div', { className: 'finance46-modal-scroll finance80-account-scroll' }, ...sections),
      h('footer', { className: 'finance46-modal-footer' },
        h('button', { type: 'button', onClick: onClose, className: 'finance46-button is-secondary' }, 'Fechar'),
        originAction && h('button', { type: 'button', onClick: openOrigin, className: 'finance46-button is-primary' }, originAction))
    )
  ), document.body);
};

const MovementRow = ({ item, openManualEdit, deleteManual, onOpenSale, onOpenProduct }) => {
  let action = null;
  if (item.source === 'manual') {
    action = h(React.Fragment, null,
      h('button', { className: 'finance44-action', onClick: () => openManualEdit(item.manual) }, h(Edit3, { size: 14 }), 'Editar'),
      h('button', { className: 'finance44-icon-action is-danger', onClick: () => deleteManual('entry', item.manual.id) }, h(Trash2, { size: 16 }))
    );
  } else if ((item.source === 'sale' || item.source === 'sale-refund') && item.sale) {
    action = h('button', { className: 'finance44-action', onClick: () => onOpenSale?.(item.sale) }, h(Eye, { size: 14 }), 'Ver venda');
  } else if ((item.source === 'stock' || item.source === 'stock-refund') && item.product && !item.batchId) {
    action = h('button', { className: 'finance44-action', onClick: () => onOpenProduct?.(item.product) }, h(Package, { size: 14 }), 'Ver produto');
  } else {
    action = h('span', { className: 'finance44-source' }, item.batchId ? 'Lote automático' : item.source === 'manual-account' ? 'Conta manual' : 'Automático');
  }

  return h('div', { className: 'finance44-row finance44-movement-row' },
    h('div', { className: `finance44-direction ${item.type === 'income' ? 'is-income' : 'is-expense'}` }, item.type === 'income' ? h(ArrowUp, { size: 17 }) : h(ArrowDown, { size: 17 })),
    h('div', { className: 'finance44-main' }, h('strong', null, item.description), h('span', null, `${formatDateTime(item.date, item.dateTime)} · ${item.detail || ''}`)),
    h('strong', { className: item.type === 'income' ? 'finance44-value is-income' : 'finance44-value is-expense' }, `${item.type === 'income' ? '+' : '-'} ${formatCurrency(item.amount)}`),
    h('div', { className: 'finance44-actions' }, action)
  );
};

const AccountRow = ({ item, tab, toggleStockPayable, toggleManualAccount, openManualEdit, deleteManual, onReceiveInstallment, onOpenSale, onOpenProduct, onOpenDetails }) => {
  let actions = null;
  if (item.source === 'sale') {
    actions = h(React.Fragment, null,
      !item.paid && h('button', { className: 'finance44-action is-primary', onClick: () => onReceiveInstallment?.(item.sale, item.installmentIndex) }, 'Receber'),
      h('button', { className: 'finance44-action', onClick: () => onOpenSale?.(item.sale) }, 'Ver venda')
    );
  } else if (item.source === 'stock') {
    actions = h(React.Fragment, null,
      !item.canceled && h('button', { className: item.paid ? 'finance44-action is-secondary' : 'finance44-action is-primary', onClick: () => toggleStockPayable(item) }, item.paid ? 'Reabrir' : 'Pagar'),
      item.batchId
        ? h('span', { className: 'finance44-source' }, `${item.purchaseItems.length} produtos`)
        : h('button', { className: 'finance44-action', onClick: () => onOpenProduct?.(item.product) }, 'Ver produto')
    );
  } else {
    actions = h(React.Fragment, null,
      h('button', { className: item.paid ? 'finance44-action is-secondary' : 'finance44-action is-primary', onClick: () => toggleManualAccount(item) }, item.paid ? 'Reabrir' : tab === 'receivable' ? 'Receber' : 'Pagar'),
      h('button', { className: 'finance44-action', onClick: () => openManualEdit(item) }, h(Edit3, { size: 14 }), 'Editar'),
      h('button', { className: 'finance44-icon-action is-danger', onClick: () => deleteManual('account', item.id) }, h(Trash2, { size: 16 }))
    );
  }

  return h('div', { className: `finance44-row finance44-account-row ${item.canceled ? 'is-canceled-row' : ''}` },
    h('div', { className: 'finance44-main' },
      h('strong', null, item.description),
      h('span', null, `${item.party || (item.source === 'sale' ? 'Venda a prazo' : item.source === 'stock' ? 'Compra de mercadoria' : 'Manual')} · Venc. ${formatDate(item.dueDate)}${item.paid ? ` · Pago em ${formatDateTime(item.paidAt, item.paidAtDateTime)}` : ''}`)
    ),
    h('span', { className: `finance44-status ${item.status.cls}` }, item.status.label),
    h('strong', { className: 'finance44-account-value' }, formatCurrency(item.value)),
    h('div', { className: 'finance44-actions finance80-account-actions' },
      h('button', { type: 'button', className: 'finance44-action finance80-details-button', onClick: () => onOpenDetails(item), 'aria-label': `Ver detalhes de ${item.description}` }, h(Eye, { size: 14 }), 'Detalhes'),
      actions)
  );
};

export const AbaFinanceiro = ({
  userId, sales = [], products = [], onOpenSale, onOpenProduct, onReceiveInstallment,
  analysisStartDate, analysisEndDate, onAnalysisPeriodChange,
  onAnalysisStartDateChange, onAnalysisEndDateChange
}) => {
  const [tab, setTab] = useState('movements');
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [localStartDate, setLocalStartDate] = useState(getCurrentMonthStart());
  const [localEndDate, setLocalEndDate] = useState(getCurrentMonthEnd());
  const startDate = analysisStartDate || localStartDate;
  const endDate = analysisEndDate || localEndDate;
  const [accountFilter, setAccountFilter] = useState('open');
  const [modalState, setModalState] = useState(null);
  const [detailsAccount, setDetailsAccount] = useState(null);

  const profileRef = useMemo(() => doc(db, 'artifacts', APP_ID, 'users', userId, 'profile', 'info'), [userId]);
  useEffect(() => onSnapshot(profileRef,
    snapshot => { setData(normalizeFinancialData(snapshot.data()?.financialData)); setLoading(false); setError(''); },
    err => { console.error(err); setLoading(false); setError('Não foi possível carregar os lançamentos manuais.'); }
  ), [profileRef]);

  const saveData = async next => {
    const normalized = normalizeFinancialData(next);
    await setDoc(profileRef, { financialData: normalized, financialUpdatedAt: serverTimestamp() }, { merge: true });
    setData(normalized);
  };

  const purchaseGroups = useMemo(() => getPurchaseGroups(products), [products]);
  const sharedLedger = useMemo(() => buildFinancialLedger({ sales, products, financialData: data, purchaseGroups }), [sales, products, data, purchaseGroups]);

  const movements = useMemo(() => sharedLedger
    .filter(item => item.date && item.date >= startDate && item.date <= endDate)
    .filter(item => !search || `${item.description} ${item.detail}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortTimestamp(b) - sortTimestamp(a) || String(b.id).localeCompare(String(a.id))),
  [sharedLedger, startDate, endDate, search]);

  const saleReceivables = useMemo(() => {
    const rows = [];
    sales.filter(sale => sale.status !== 'canceled' && isPrazo(sale)).forEach(sale => (sale.installments || []).forEach((inst, index) => {
      const remaining = money(inst.amount);
      const face = getInstallmentFaceAmount(inst);
      const paid = !!inst.paid || remaining <= 0;
      const history = Array.isArray(inst.history) ? inst.history : [];
      const partial = !paid && history.some(item => item && item.type !== 'abatement' && num(item.amount) > 0);
      rows.push({ id: `sale-ar-${sale.id}-${index}`, source: 'sale', direction: 'receivable', sale, installmentIndex: index, description: `${sale.customerName || 'Cliente'} · Parcela ${inst.number || index + 1}/${sale.installmentsCount || sale.installments.length}`, party: sale.customerName || '', dueDate: cleanDate(inst.dueDate), value: paid ? face : remaining, paid, paidAt: cleanDate(inst.paidAt), paidAtDateTime: inst.paidAtDateTime || '', partial, canceled: false, status: statusOf(cleanDate(inst.dueDate), paid, partial, false) });
    }));
    return rows;
  }, [sales]);

  const stockPayables = useMemo(() => {
    const rows = [];
    purchaseGroups.filter(group => group.deferred).forEach(group => {
      const purchaseItems = group.items.map(item => ({ productId: item.product.id, movementId: item.movement.id }));
      group.plan.forEach((planItem, planIndex) => {
        const canceled = !planItem.paid && (group.fullyCanceled || toCents(planItem.amount) <= 0);
        rows.push({
          id: `stock-ap-${group.key}-${planItem.number}`,
          source: 'stock', direction: 'payable', product: group.first.product,
          productId: group.first.product.id, movementId: group.first.movement.id,
          batchId: group.batchId, purchaseItems, purchaseGroup: group,
          installmentIndex: planIndex,
          installmentNumber: planItem.number,
          installmentsCount: group.plan.length,
          description: `${group.batchId ? `Compra de mercadoria em lote · ${group.itemCount} produtos` : `Compra de mercadoria · ${group.first.product.name}`} · Parcela ${planItem.number}/${group.plan.length}`,
          party: paymentLabel(group.paymentMethod),
          dueDate: cleanDate(planItem.dueDate),
          value: money(planItem.amount),
          paid: !!planItem.paid,
          paidAt: cleanDate(planItem.paidAt),
          paidAtDateTime: planItem.paidAtDateTime || '',
          canceled,
          partial: group.partiallyCanceled && !planItem.paid,
          status: canceled
            ? statusOf(cleanDate(planItem.dueDate), false, false, true, 'Paga')
            : statusOf(cleanDate(planItem.dueDate), !!planItem.paid, group.partiallyCanceled && !planItem.paid, false, 'Paga')
        });
      });
    });
    return rows;
  }, [purchaseGroups]);

  const manualReceivables = useMemo(() => data.accounts.filter(item => item.direction === 'receivable').map(item => ({ ...item, source: 'manual', value: money(item.value), dueDate: cleanDate(item.dueDate), canceled: false, status: statusOf(cleanDate(item.dueDate), !!item.paid, false, false, 'Recebida') })), [data]);
  const manualPayables = useMemo(() => data.accounts.filter(item => item.direction === 'payable').map(item => ({ ...item, source: 'manual', value: money(item.value), dueDate: cleanDate(item.dueDate), canceled: false, status: statusOf(cleanDate(item.dueDate), !!item.paid, false, false, 'Paga') })), [data]);
  const receivables = useMemo(() => [...saleReceivables, ...manualReceivables], [saleReceivables, manualReceivables]);
  const payables = useMemo(() => [...stockPayables, ...manualPayables], [stockPayables, manualPayables]);

  const filteredAccounts = useMemo(() => {
    const base = tab === 'receivable' ? receivables : payables;
    return base
      .filter(item => item.dueDate && item.dueDate >= startDate && item.dueDate <= endDate)
      .filter(item => accountFilter === 'all' || (accountFilter === 'paid' ? item.paid && !item.canceled : !item.paid && !item.canceled))
      .filter(item => !search || `${item.description} ${item.party || ''}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (a.canceled !== b.canceled) return a.canceled ? 1 : -1;
        if (a.paid !== b.paid) return a.paid ? 1 : -1;
        return String(a.dueDate || '').localeCompare(String(b.dueDate || ''));
      });
  }, [tab, receivables, payables, accountFilter, search, startDate, endDate]);

  const totals = useMemo(() => {
    const income = sumMoney(movements.filter(item => item.type === 'income'), item => item.amount);
    const expense = sumMoney(movements.filter(item => item.type === 'expense'), item => item.amount);
    return {
      income: money(income),
      expense: money(expense),
      balance: money(income - expense),
      openReceivable: sumMoney(receivables.filter(item => !item.paid && !item.canceled), item => item.value),
      openPayable: sumMoney(payables.filter(item => !item.paid && !item.canceled), item => item.value)
    };
  }, [movements, receivables, payables]);

  const saveManual = async form => {
    setError('');
    setMessage('');
    const now = new Date().toISOString();
    if (form.kind === 'movement') {
      const nextItem = { id: form.id || makeId('mov'), type: form.type, description: form.description, value: form.value, date: form.date, dateTime: dateWithCurrentTime(form.date), category: form.category, notes: form.notes, createdAt: form.id ? (data.entries.find(item => item.id === form.id)?.createdAt || now) : now };
      await saveData({ ...data, entries: form.id ? data.entries.map(item => item.id === form.id ? nextItem : item) : [...data.entries, nextItem] });
    } else {
      const direction = form.kind === 'receivable' ? 'receivable' : 'payable';
      const existing = form.id ? data.accounts.find(item => item.id === form.id) : null;
      const nextItem = { id: form.id || makeId('acc'), direction, description: form.description, party: form.party, value: form.value, dueDate: form.date, category: form.category, notes: form.notes, paid: existing?.paid || false, paidAt: existing?.paidAt || null, paidAtDateTime: existing?.paidAtDateTime || null, createdAt: existing?.createdAt || now };
      await saveData({ ...data, accounts: form.id ? data.accounts.map(item => item.id === form.id ? nextItem : item) : [...data.accounts, nextItem] });
    }
    setMessage(form.id ? 'Lançamento atualizado.' : 'Lançamento salvo.');
  };

  const toggleManualAccount = async item => {
    const nextPaid = !item.paid;
    await saveData({ ...data, accounts: data.accounts.map(account => account.id === item.id ? { ...account, paid: nextPaid, paidAt: nextPaid ? getBrazilDateString() : null, paidAtDateTime: nextPaid ? new Date().toISOString() : null } : account) });
  };

  const toggleStockPayable = async item => {
    if (item.canceled) return;
    const targets = Array.isArray(item.purchaseItems) && item.purchaseItems.length ? item.purchaseItems : [{ productId: item.productId, movementId: item.movementId }];
    const now = new Date().toISOString();
    const today = getBrazilDateString();
    const productIds = [...new Set(targets.map(target => target.productId).filter(Boolean))];
    if (productIds.length === 0) return;

    try {
      await runTransaction(db, async transaction => {
        const references = productIds.map(productId => doc(db, 'artifacts', APP_ID, 'users', userId, 'products', productId));
        const snapshots = await Promise.all(references.map(reference => transaction.get(reference)));
        if (snapshots.some(snapshot => !snapshot.exists())) throw new Error('Um dos produtos desta compra não está mais disponível.');

        const latestProducts = snapshots.map((snapshot, index) => ({ id: productIds[index], ...snapshot.data() }));
        const groupKey = item.batchId ? `batch:${item.batchId}` : `single:${item.productId}:${item.movementId}`;
        const latestGroup = getPurchaseGroups(latestProducts).find(group => group.key === groupKey);
        const currentInstallment = latestGroup?.plan?.[item.installmentIndex];
        if (!currentInstallment || currentInstallment.paid !== item.paid || (!currentInstallment.paid && toCents(currentInstallment.amount) <= 0)) {
          throw new Error('Esta parcela foi alterada. Atualize os dados antes de tentar novamente.');
        }

        const nextPaid = !currentInstallment.paid;
        const updatedPlan = latestGroup.plan.map((planItem, index) => index === item.installmentIndex
          ? { ...planItem, amount: money(planItem.amount), paid: nextPaid, paidAt: nextPaid ? today : null, paidAtDateTime: nextPaid ? now : null }
          : { ...planItem, amount: money(planItem.amount) });
        const allPaid = updatedPlan.length > 0 && updatedPlan.every(planItem => planItem.paid || toCents(planItem.amount) <= 0);

        latestProducts.forEach((product, index) => {
          const movementIds = new Set(targets.filter(target => target.productId === product.id).map(target => target.movementId));
          const updatedMovements = (product.movements || []).map(movement => {
            if (!movementIds.has(movement.id)) return movement;
            const existingPlan = normalizePaymentInstallments(movement, latestGroup.originalAmount);
            return {
              ...movement,
              financialInstallments: updatedPlan.map((planItem, planIndex) => ({ ...existingPlan[planIndex], ...planItem })),
              paymentInstallmentsCount: updatedPlan.length,
              paymentDueDate: updatedPlan[0]?.dueDate || movement.paymentDueDate || null,
              paymentFirstDueDate: updatedPlan[0]?.dueDate || movement.paymentFirstDueDate || null,
              financialPaid: allPaid,
              financialPaidAt: allPaid ? today : null,
              financialPaidAtDateTime: allPaid ? now : null
            };
          });
          transaction.update(references[index], { movements: updatedMovements });
        });
      });
    } catch (transactionError) {
      console.error(transactionError);
      setError(transactionError?.message || 'Não foi possível atualizar a parcela da compra.');
    }
  };

  const deleteManual = async (kind, id) => {
    if (!confirm('Excluir este lançamento manual?')) return;
    if (kind === 'entry') await saveData({ ...data, entries: data.entries.filter(item => item.id !== id) });
    else await saveData({ ...data, accounts: data.accounts.filter(item => item.id !== id) });
  };

  const openCount = list => list.filter(item => !item.paid && !item.canceled).length;
  const cards = [
    { label: 'Saldo do período', value: totals.balance, icon: Wallet, cls: totals.balance >= 0 ? 'is-green' : 'is-red' },
    { label: 'Entradas', value: totals.income, icon: ArrowUp, cls: 'is-green' },
    { label: 'Saídas', value: totals.expense, icon: ArrowDown, cls: 'is-red' },
    { label: 'A receber', value: totals.openReceivable, icon: Receipt, cls: 'is-blue', meta: `${openCount(receivables)} em aberto` },
    { label: 'A pagar', value: totals.openPayable, icon: CreditCard, cls: 'is-amber', meta: `${openCount(payables)} em aberto` }
  ];

  const openManualEdit = item => setModalState({ kind: item.direction ? item.direction : 'movement', initial: item });
  const periodControl = h('div', { className: 'finance44-period' },
    h(CalendarDays, { size: 16 }),
    h('input', { type: 'date', value: startDate, onChange: event => {
      setLocalStartDate(event.target.value);
      onAnalysisPeriodChange?.('custom');
      onAnalysisStartDateChange?.(event.target.value);
    } }),
    h('span', null, 'até'),
    h('input', { type: 'date', value: endDate, onChange: event => {
      setLocalEndDate(event.target.value);
      onAnalysisPeriodChange?.('custom');
      onAnalysisEndDateChange?.(event.target.value);
    } })
  );

  const listContent = (() => {
    if (loading) return h('div', { className: 'surface finance44-empty' }, 'Carregando financeiro...');
    if (tab === 'movements') {
      if (movements.length === 0) return h('div', { className: 'finance44-list' }, h('div', { className: 'finance44-empty' }, 'Nenhuma movimentação neste período.'));
      return h('div', { className: 'finance44-list' }, movements.map(item => h(MovementRow, { key: item.id, item, openManualEdit, deleteManual, onOpenSale, onOpenProduct })));
    }
    if (filteredAccounts.length === 0) return h('div', { className: 'finance44-list' }, h('div', { className: 'finance44-empty' }, 'Nenhuma conta encontrada neste período.'));
    return h('div', { className: 'finance44-list' }, filteredAccounts.map(item => h(AccountRow, { key: item.id, item, tab, toggleStockPayable, toggleManualAccount, openManualEdit, deleteManual, onReceiveInstallment, onOpenSale, onOpenProduct, onOpenDetails: setDetailsAccount })));
  })();

  return h('section', { className: 'finance44 page-stack animate-fade-in' },
    h('div', { className: 'page-heading finance44-heading' },
      h('div', { className: 'page-heading-copy' }, h('h1', { className: 'page-title' }, 'Financeiro'), h('p', { className: 'page-description' }, 'Extrato, contas a receber e contas a pagar. Operações automáticas são controladas na área onde nasceram.')),
      h('button', { type: 'button', className: 'page-primary-action', onClick: () => setModalState({ kind: tab === 'receivable' ? 'receivable' : tab === 'payable' ? 'payable' : 'movement', initial: null }) }, h(Plus, { size: 17 }), tab === 'movements' ? 'Novo lançamento' : tab === 'receivable' ? 'Nova conta a receber' : 'Nova conta a pagar')
    ),
    error && h('div', { className: 'finance44-alert is-error' }, error),
    message && h('div', { className: 'finance44-alert is-success' }, message),
    h('div', { className: 'finance44-summary' }, cards.map(card => h('article', { key: card.label, className: `finance44-summary-card ${card.cls}` }, h('div', { className: 'finance44-summary-icon' }, h(card.icon, { size: 19 })), h('div', null, h('span', null, card.label), h('strong', null, formatCurrency(card.value)), card.meta && h('small', null, card.meta))))),
    h('div', { className: 'finance44-tabs' },
      h('button', { onClick: () => { setTab('movements'); setSearch(''); }, className: tab === 'movements' ? 'is-active' : '' }, h(Banknote, { size: 17 }), 'Movimentações'),
      h('button', { onClick: () => { setTab('receivable'); setSearch(''); }, className: tab === 'receivable' ? 'is-active' : '' }, h(Receipt, { size: 17 }), 'Contas a receber'),
      h('button', { onClick: () => { setTab('payable'); setSearch(''); }, className: tab === 'payable' ? 'is-active' : '' }, h(CreditCard, { size: 17 }), 'Contas a pagar')
    ),
    h('div', { className: 'finance44-toolbar' },
      h('div', { className: 'finance44-search' }, h(Search, { size: 17 }), h('input', { value: search, onChange: event => setSearch(event.target.value), placeholder: 'Buscar no financeiro...' })),
      tab === 'movements'
        ? periodControl
        : h('div', { className: 'finance67-account-tools' },
            periodControl,
            h('div', { className: 'finance44-filter' }, [['open', 'Em aberto'], ['paid', tab === 'receivable' ? 'Recebidas' : 'Pagas'], ['all', 'Todas']].map(([value, label]) => h('button', { key: value, onClick: () => setAccountFilter(value), className: accountFilter === value ? 'is-active' : '' }, label)))
          )
    ),
    listContent,
    h(FormModal, { open: !!modalState, kind: modalState?.kind, initial: modalState?.initial, onClose: () => setModalState(null), onSave: saveManual }),
    h(AccountDetailsModal, { item: detailsAccount, products, onClose: () => setDetailsAccount(null), onOpenSale, onOpenProduct, onEdit: openManualEdit })
  );
};
