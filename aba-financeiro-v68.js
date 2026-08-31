import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.2.0';
import { createPortal } from 'https://esm.sh/react-dom@18.2.0';
import {
  ArrowDown, ArrowUp, Banknote, CreditCard, Edit3, Eye,
  Package, Plus, Receipt, Search, Trash2, Wallet, X
} from 'https://esm.sh/lucide-react@0.292.0';
import { db, APP_ID } from './firebase-config.js?v=92';
import { doc, onSnapshot, runTransaction, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { DateRangePicker, MoneyInput } from './components.js?v=92';
import { formatCurrency, formatDate, getBrazilDateString, getCurrentMonthEnd, getCurrentMonthStart, parseMoney } from './utils.js';
import { buildPaymentInstallments, clampInstallments, normalizePaymentInstallments } from './purchase-payment-v68.js';
import { buildFinancialLedger, getInstallmentFaceAmount, getPurchaseGroups, money, sumMoney, summarizeFinancialLedger, toCents } from './financial-core-v70.js';
import { buildFinancialAccountDetails, filterFinancialAccounts, summarizeFinancialAccounts } from './financial-account-details-v80.js?v=92';
import { showAppConfirm } from './ui-interactions-v81.js?v=92';

const h = React.createElement;
const EMPTY_DATA = { entries: [], accounts: [] };
const cleanDate = value => String(value || '').split('T')[0];
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const makeId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const isPrazo = sale => sale?.saleType === 'prazo' || !sale?.saleType;
const paymentLabel = method => ({ money: 'Dinheiro', pix: 'PIX', debit: 'Débito', credit: 'Crédito', term: 'A prazo' }[method] || 'Pagamento');
const normalizeFinancialData = raw => ({ entries: Array.isArray(raw?.entries) ? raw.entries : [], accounts: Array.isArray(raw?.accounts) ? raw.accounts : [] });
const MANUAL_LAUNCH_TYPES = Object.freeze([
  { value: 'income', label: 'Entrada financeira' },
  { value: 'expense', label: 'Saída financeira' },
  { value: 'receivable', label: 'Conta a receber' },
  { value: 'payable', label: 'Conta a pagar' }
]);

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
  const [launchType, setLaunchType] = useState('');
  const [description, setDescription] = useState('');
  const [party, setParty] = useState('');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(getBrazilDateString());
  const [installmentsCount, setInstallmentsCount] = useState('1');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  useBodyLock(open);

  useEffect(() => {
    if (!open) return;
    setType(initial?.type || 'income');
    setLaunchType(initial ? (kind === 'movement' ? initial?.type || 'income' : kind) : '');
    setDescription(initial?.baseDescription || initial?.description || '');
    setParty(initial?.party || '');
    setValue(initial?.value ? String(initial.value).replace('.', ',') : '');
    setDate(cleanDate(initial?.date || initial?.dueDate) || getBrazilDateString());
    setInstallmentsCount('1');
    setCategory(initial?.category || '');
    setNotes(initial?.notes || '');
    setSaving(false);
  }, [open, kind, initial]);

  const selectedKind = initial
    ? kind
    : ['income', 'expense'].includes(launchType)
      ? 'movement'
      : ['receivable', 'payable'].includes(launchType)
        ? launchType
        : '';
  const selectedMovementType = initial ? type : launchType === 'expense' ? 'expense' : 'income';
  const isNewAccount = !initial && ['receivable', 'payable'].includes(selectedKind);
  const parsedValue = parseMoney(value);
  const installmentCount = clampInstallments(installmentsCount);
  const installmentPlan = useMemo(() => isNewAccount && parsedValue > 0 && date
    ? buildPaymentInstallments(parsedValue, installmentCount, date)
    : [], [isNewAccount, parsedValue, installmentCount, date]);

  if (!open) return null;
  const title = initial ? 'Editar lançamento' : 'Novo lançamento';
  const LaunchIcon = selectedKind === 'receivable'
    ? Receipt
    : selectedKind === 'payable'
      ? CreditCard
      : selectedMovementType === 'expense'
        ? ArrowDown
        : selectedKind === 'movement'
          ? ArrowUp
          : Banknote;

  const chooseLaunchType = next => {
    setLaunchType(next);
    if (next === 'income' || next === 'expense') setInstallmentsCount('1');
  };

  const submit = async () => {
    if (!selectedKind) return alert('Selecione o tipo de lançamento.');
    const parsed = parseMoney(value);
    if (!description.trim()) return alert('Informe a descrição.');
    if (!(parsed > 0)) return alert('Informe um valor válido.');
    if (!date) return alert('Informe a data.');
    if (isNewAccount && installmentPlan.length !== installmentCount) return alert('Não foi possível montar o parcelamento.');
    if (isNewAccount && installmentPlan.some(item => toCents(item.amount) <= 0)) return alert('O valor total deve permitir pelo menos R$ 0,01 por parcela.');
    setSaving(true);
    try {
      await onSave({
        kind: selectedKind,
        type: selectedKind === 'movement' ? selectedMovementType : selectedKind,
        description: description.trim(),
        party: party.trim(),
        value: money(parsed),
        date,
        installmentsCount: isNewAccount ? installmentCount : 1,
        installmentPlan: isNewAccount ? installmentPlan : [],
        category: category.trim(),
        notes: notes.trim(),
        id: initial?.id || null
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const bodyChildren = [];
  if (!initial) {
    bodyChildren.push(h('section', { key: 'launch-type', className: 'finance46-card finance46-card-type finance88-launch-card' },
      h('div', { className: 'finance46-section-label' }, 'Primeiro passo'),
      h('label', { className: 'finance46-field finance46-field-wide' },
        h('span', null, 'Tipo de lançamento *'),
        h('select', {
          value: launchType,
          onChange: event => chooseLaunchType(event.target.value),
          'aria-label': 'Tipo de lançamento'
        },
          h('option', { value: '', disabled: true }, 'Selecione o tipo'),
          MANUAL_LAUNCH_TYPES.map(option => h('option', { key: option.value, value: option.value }, option.label))
        )),
      h('p', { className: 'finance88-launch-description' }, 'Essa escolha define os campos, o vencimento e a possibilidade de parcelamento.')
    ));
  } else if (selectedKind === 'movement') {
    bodyChildren.push(h('section', { key: 'type', className: 'finance46-card finance46-card-type' },
      h('div', { className: 'finance46-section-label' }, 'Tipo'),
      h('div', { className: 'finance46-type-switch' },
        h('button', { type: 'button', onClick: () => setType('income'), className: type === 'income' ? 'is-active is-income' : '' }, h(ArrowUp, { size: 17 }), 'Entrada'),
        h('button', { type: 'button', onClick: () => setType('expense'), className: type === 'expense' ? 'is-active is-expense' : '' }, h(ArrowDown, { size: 17 }), 'Saída')
      )
    ));
  }
  const dateField = h('label', { className: 'finance46-field' },
    h('span', null, selectedKind === 'movement'
      ? 'Data *'
      : isNewAccount && installmentCount > 1
        ? 'Vencimento da 1ª parcela *'
        : 'Vencimento *'),
    h('input', { type: 'date', value: date, onChange: event => setDate(event.target.value) }));
  const amountFields = selectedKind === 'movement'
    ? h('div', { className: 'finance46-fields-grid' },
        h('label', { className: 'finance46-field' },
          h('span', null, 'Valor *'),
          h(MoneyInput, { value, onChange: setValue, className: 'finance46-money' })),
        dateField)
    : h(React.Fragment, null,
        h('label', { className: 'finance46-field finance46-field-wide' },
          h('span', null, isNewAccount ? 'Valor total *' : 'Valor da conta *'),
          h(MoneyInput, { value, onChange: setValue, className: 'finance46-money' })),
        h('div', { className: 'finance46-fields-grid' },
          isNewAccount && h('label', { className: 'finance46-field' },
            h('span', null, 'Parcelamento'),
            h('select', {
              value: installmentsCount,
              onChange: event => setInstallmentsCount(String(clampInstallments(event.target.value)))
            }, Array.from({ length: 24 }, (_, index) =>
              h('option', { key: index + 1, value: String(index + 1) }, `${index + 1}x`)))),
          dateField),
        isNewAccount && installmentPlan.length > 1 && h('div', { className: 'finance85-installment-preview' },
          h('div', { className: 'finance85-installment-heading' },
            h('span', null, 'Prévia das parcelas'),
            h('strong', null, `${installmentPlan.length}x · ${formatCurrency(parsedValue)}`)),
          h('div', { className: 'finance85-installment-list' }, installmentPlan.map(item =>
            h('div', { key: item.number },
              h('span', null, `${item.number}/${installmentPlan.length} · ${formatDate(item.dueDate)}`),
              h('strong', null, formatCurrency(item.amount)))))));

  if (selectedKind) {
    bodyChildren.push(h('section', { key: 'info', className: 'finance46-card' },
      h('div', { className: 'finance46-section-label' }, 'Informações'),
      h('label', { className: 'finance46-field finance46-field-wide' }, h('span', null, 'Descrição *'), h('input', { value: description, onChange: e => setDescription(e.target.value) })),
      selectedKind !== 'movement' && h('label', { className: 'finance46-field finance46-field-wide' }, h('span', null, selectedKind === 'receivable' ? 'Cliente / origem' : 'Fornecedor / favorecido'), h('input', { value: party, onChange: e => setParty(e.target.value), placeholder: 'Opcional' })),
      amountFields,
      h('label', { className: 'finance46-field finance46-field-wide' }, h('span', null, 'Categoria'), h('input', { value: category, onChange: e => setCategory(e.target.value) })),
      h('label', { className: 'finance46-field finance46-field-wide' }, h('span', null, 'Observação'), h('textarea', { rows: 3, value: notes, onChange: e => setNotes(e.target.value) }))
    ));
  } else {
    bodyChildren.push(h('section', { key: 'launch-placeholder', className: 'finance88-launch-placeholder' },
      h(Banknote, { size: 22 }),
      h('div', null,
        h('strong', null, 'Selecione como deseja lançar'),
        h('span', null, 'Os demais campos aparecerão logo depois da escolha.'))
    ));
  }

  return createPortal(h('div', { className: 'finance46-overlay', role: 'dialog', 'aria-modal': 'true' },
    h('div', { className: 'finance46-modal' },
      h('header', { className: 'finance46-modal-hero' },
        h('div', { className: 'finance46-modal-icon' }, h(LaunchIcon, { size: 22 })),
        h('div', { className: 'finance46-modal-heading' }, h('span', null, initial ? 'Edição manual' : 'Lançamento manual'), h('h2', null, title), h('p', null, initial ? 'Atualize as informações deste registro manual.' : 'Escolha o tipo e preencha as informações do lançamento.')),
        h('button', { type: 'button', onClick: onClose, className: 'finance46-close' }, h(X, { size: 20 }))
      ),
      h('div', { className: 'finance46-modal-scroll' }, ...bodyChildren),
      h('footer', { className: 'finance46-modal-footer' },
        h('button', { type: 'button', onClick: onClose, className: 'finance46-button is-secondary' }, 'Cancelar'),
        h('button', { type: 'button', onClick: submit, disabled: saving || !selectedKind, className: 'finance46-button is-primary' }, saving ? 'Salvando...' : 'Salvar')
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

const AccountPortfolioModal = ({ direction, accounts, onClose, rowActions }) => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('open');
  useBodyLock(!!direction);

  useEffect(() => {
    if (!direction) return;
    setSearch('');
    setStatus('open');
  }, [direction]);

  const filteredAccounts = useMemo(() => filterFinancialAccounts(accounts, {
    scope: 'all',
    status,
    search
  }), [accounts, status, search]);

  const openAccounts = useMemo(() => accounts.filter(item => !item.paid && !item.canceled), [accounts]);
  if (!direction) return null;

  const receivable = direction === 'receivable';
  const label = receivable ? 'a receber' : 'a pagar';

  return createPortal(h('div', {
    className: 'finance46-overlay finance83-portfolio-overlay',
    role: 'presentation',
    onClick: onClose
  }, h('section', {
    className: 'finance46-modal finance83-portfolio-modal',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'finance83-portfolio-title',
    onClick: event => event.stopPropagation()
  },
    h('header', { className: 'finance46-modal-hero' },
      h('div', { className: 'finance46-modal-icon' }, h(receivable ? Receipt : CreditCard, { size: 22 })),
      h('div', { className: 'finance46-modal-heading' },
        h('span', null, 'Carteira financeira completa'),
        h('h2', { id: 'finance83-portfolio-title' }, `Todas as contas ${label}`),
        h('p', null, 'Todos os vencimentos, inclusive parcelas dos próximos meses.')),
      h('button', { type: 'button', onClick: onClose, className: 'finance46-close', 'aria-label': 'Fechar carteira financeira' }, h(X, { size: 20 }))),
    h('div', { className: `finance83-portfolio-summary ${receivable ? 'is-receivable' : 'is-payable'}` },
      h('div', null,
        h('span', null, `Total ${label} em aberto`),
        h('strong', null, formatCurrency(sumMoney(openAccounts, item => item.value)))),
      h('span', { className: 'finance83-portfolio-count' }, `${openAccounts.length} ${openAccounts.length === 1 ? 'conta pendente' : 'contas pendentes'}`)),
    h('div', { className: 'finance83-portfolio-tools' },
      h('div', { className: 'finance44-search finance83-portfolio-search' },
        h(Search, { size: 17 }),
        h('input', {
          value: search,
          onChange: event => setSearch(event.target.value),
          placeholder: `Buscar contas ${label}...`,
          'aria-label': `Buscar contas ${label}`
        })),
      h('div', { className: 'finance44-filter finance83-portfolio-filter' },
        [['open', 'Em aberto'], ['paid', receivable ? 'Recebidas' : 'Pagas'], ['all', 'Todas']].map(([value, text]) =>
          h('button', { key: value, type: 'button', onClick: () => setStatus(value), className: status === value ? 'is-active' : '' }, text)))),
    h('div', { className: 'finance83-portfolio-scroll' },
      h('div', { className: 'finance44-list finance83-portfolio-list' },
        filteredAccounts.length > 0
          ? filteredAccounts.map(item => h(AccountRow, { key: item.id, item, tab: direction, ...rowActions }))
          : h('div', { className: 'finance44-empty' }, 'Nenhuma conta encontrada na carteira completa.'))),
    h('footer', { className: 'finance46-modal-footer finance83-portfolio-footer' },
      h('button', { type: 'button', onClick: onClose, className: 'finance46-button is-secondary' }, 'Fechar'))
  )), document.body);
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
  const [portfolioDirection, setPortfolioDirection] = useState(null);
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
    return filterFinancialAccounts(base, {
      scope: 'period',
      startDate,
      endDate,
      status: accountFilter,
      search
    });
  }, [tab, receivables, payables, accountFilter, search, startDate, endDate]);
  const periodListSummary = useMemo(() => summarizeFinancialAccounts(filteredAccounts), [filteredAccounts]);

  const cashSummary = useMemo(() => summarizeFinancialLedger(
    sharedLedger,
    '',
    getBrazilDateString()
  ), [sharedLedger]);

  const totals = useMemo(() => {
    const income = sumMoney(movements.filter(item => item.type === 'income'), item => item.amount);
    const expense = sumMoney(movements.filter(item => item.type === 'expense'), item => item.amount);
    const openReceivables = receivables.filter(item => !item.paid && !item.canceled);
    const openPayables = payables.filter(item => !item.paid && !item.canceled);
    return {
      income: money(income),
      expense: money(expense),
      cashBalance: cashSummary.balance,
      openReceivable: sumMoney(openReceivables, item => item.value),
      openReceivableCount: openReceivables.length,
      openPayable: sumMoney(openPayables, item => item.value),
      openPayableCount: openPayables.length
    };
  }, [movements, receivables, payables, cashSummary]);

  const saveManual = async form => {
    setError('');
    setMessage('');
    const now = new Date().toISOString();
    if (form.kind === 'movement') {
      const nextItem = { id: form.id || makeId('mov'), type: form.type, description: form.description, value: form.value, date: form.date, dateTime: dateWithCurrentTime(form.date), category: form.category, notes: form.notes, createdAt: form.id ? (data.entries.find(item => item.id === form.id)?.createdAt || now) : now };
      await saveData({ ...data, entries: form.id ? data.entries.map(item => item.id === form.id ? nextItem : item) : [...data.entries, nextItem] });
    } else if (form.id) {
      const direction = form.kind === 'receivable' ? 'receivable' : 'payable';
      const existing = data.accounts.find(item => item.id === form.id);
      if (!existing) throw new Error('Esta conta não está mais disponível para edição.');
      const count = clampInstallments(existing.installmentsCount || 1);
      const number = Math.min(count, Math.max(1, parseInt(existing.installmentNumber, 10) || 1));
      const nextItem = {
        ...existing,
        direction,
        baseDescription: form.description,
        description: count > 1 ? `${form.description} · Parcela ${number}/${count}` : form.description,
        party: form.party,
        value: form.value,
        dueDate: form.date,
        category: form.category,
        notes: form.notes
      };
      let nextAccounts = data.accounts.map(item => item.id === form.id ? nextItem : item);
      if (existing.installmentGroupId) {
        const groupTotal = sumMoney(
          nextAccounts.filter(item => item.installmentGroupId === existing.installmentGroupId),
          item => item.value
        );
        nextAccounts = nextAccounts.map(item => item.installmentGroupId === existing.installmentGroupId
          ? { ...item, installmentOriginalTotal: groupTotal }
          : item);
      }
      await saveData({ ...data, accounts: nextAccounts });
    } else {
      const direction = form.kind === 'receivable' ? 'receivable' : 'payable';
      const count = clampInstallments(form.installmentsCount);
      const plan = buildPaymentInstallments(form.value, count, form.date);
      const groupId = count > 1 ? makeId('acc-group') : null;
      const nextAccounts = plan.map(item => ({
        id: makeId(`acc-${item.number}`),
        direction,
        baseDescription: form.description,
        description: count > 1 ? `${form.description} · Parcela ${item.number}/${count}` : form.description,
        party: form.party,
        value: item.amount,
        dueDate: item.dueDate,
        category: form.category,
        notes: form.notes,
        paid: false,
        paidAt: null,
        paidAtDateTime: null,
        createdAt: now,
        ...(count > 1 ? {
          installmentGroupId: groupId,
          installmentNumber: item.number,
          installmentsCount: count,
          installmentOriginalTotal: money(form.value)
        } : {})
      }));
      await saveData({ ...data, accounts: [...data.accounts, ...nextAccounts] });
    }
    setMessage(form.id
      ? 'Lançamento atualizado.'
      : form.kind !== 'movement' && form.installmentsCount > 1
        ? `${form.installmentsCount} parcelas salvas.`
        : 'Lançamento salvo.');
    if (!form.id) {
      setTab(form.kind === 'movement' ? 'movements' : form.kind);
      setSearch('');
      if (form.kind !== 'movement') setAccountFilter('open');
    }
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
    const confirmed = await showAppConfirm(
      kind === 'entry'
        ? 'O lançamento será removido definitivamente do extrato financeiro.'
        : 'A conta será removida definitivamente do financeiro.',
      {
        title: kind === 'entry' ? 'Excluir lançamento?' : 'Excluir conta?',
        confirmLabel: 'Sim, excluir',
        cancelLabel: 'Manter registro',
        danger: true
      }
    );
    if (!confirmed) return;
    if (kind === 'entry') await saveData({ ...data, entries: data.entries.filter(item => item.id !== id) });
    else await saveData({ ...data, accounts: data.accounts.filter(item => item.id !== id) });
  };

  const openCompletePortfolio = direction => setPortfolioDirection(direction);
  const cards = [
    { label: 'Saldo total em caixa', value: totals.cashBalance, icon: Wallet, cls: totals.cashBalance >= 0 ? 'is-green' : 'is-red', meta: 'Histórico realizado até hoje' },
    { label: 'Entradas', value: totals.income, icon: ArrowUp, cls: 'is-green' },
    { label: 'Saídas', value: totals.expense, icon: ArrowDown, cls: 'is-red' },
    { label: 'A receber', value: totals.openReceivable, icon: Receipt, cls: 'is-blue', meta: `${totals.openReceivableCount} em aberto`, direction: 'receivable' },
    { label: 'A pagar', value: totals.openPayable, icon: CreditCard, cls: 'is-amber', meta: `${totals.openPayableCount} em aberto`, direction: 'payable' }
  ];

  const openManualEdit = item => setModalState({ kind: item.direction ? item.direction : 'movement', initial: item });
  const applyDateRange = selection => {
    setLocalStartDate(selection.startDate);
    setLocalEndDate(selection.endDate);
    onAnalysisPeriodChange?.('custom');
    onAnalysisStartDateChange?.(selection.startDate);
    onAnalysisEndDateChange?.(selection.endDate);
  };
  const periodControl = h('div', { className: 'finance44-period finance82-period' },
    h(DateRangePicker, {
      startDate,
      endDate,
      onChange: applyDateRange,
      className: 'finance82-period-trigger'
    })
  );
  const periodListTitle = tab === 'receivable'
    ? accountFilter === 'paid'
      ? 'Total recebido no período'
      : accountFilter === 'all'
        ? 'Total das contas a receber no período'
        : 'Total a receber no período'
    : accountFilter === 'paid'
      ? 'Total pago no período'
      : accountFilter === 'all'
        ? 'Total das contas a pagar no período'
        : 'Total a pagar no período';

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
      h('button', { type: 'button', className: 'page-primary-action', onClick: () => setModalState({ kind: 'new', initial: null }) }, h(Plus, { size: 17 }), 'Novo lançamento')
    ),
    error && h('div', { className: 'finance44-alert is-error' }, error),
    message && h('div', { className: 'finance44-alert is-success' }, message),
    h('div', { className: 'finance44-summary' }, cards.map(card => h(card.direction ? 'button' : 'article', {
      key: card.label,
      className: `finance44-summary-card ${card.cls}${card.direction ? ' finance82-summary-action' : ''}${card.direction === portfolioDirection ? ' is-active' : ''}`,
      ...(card.direction ? {
        type: 'button',
        onClick: () => openCompletePortfolio(card.direction),
        'aria-label': `Ver todas as contas ${card.direction === 'receivable' ? 'a receber' : 'a pagar'}, inclusive parcelas futuras`,
        'aria-expanded': card.direction === portfolioDirection
      } : {})
    }, h('div', { className: 'finance44-summary-icon' }, h(card.icon, { size: 19 })), h('div', null, h('span', null, card.label), h('strong', null, formatCurrency(card.value)), card.meta && h('small', null, card.meta))))),
    h('div', { className: 'finance44-tabs' },
      h('button', { type: 'button', onClick: () => { setTab('movements'); setSearch(''); }, className: tab === 'movements' ? 'is-active' : '' }, h(Banknote, { size: 17 }), 'Movimentações'),
      h('button', { type: 'button', onClick: () => { setTab('receivable'); setSearch(''); }, className: tab === 'receivable' ? 'is-active' : '' }, h(Receipt, { size: 17 }), 'Contas a receber'),
      h('button', { type: 'button', onClick: () => { setTab('payable'); setSearch(''); }, className: tab === 'payable' ? 'is-active' : '' }, h(CreditCard, { size: 17 }), 'Contas a pagar')
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
    !loading && tab !== 'movements' && h('article', {
      className: `finance92-period-list-summary ${tab === 'receivable' ? 'is-receivable' : 'is-payable'}`
    },
      h('div', { className: 'finance92-period-list-icon' }, h(tab === 'receivable' ? Receipt : CreditCard, { size: 20 })),
      h('div', { className: 'finance92-period-list-copy' },
        h('span', null, periodListTitle),
        h('strong', null, formatCurrency(periodListSummary.total)),
        h('small', null, `${formatDate(startDate)} a ${formatDate(endDate)}`)),
      h('span', { className: 'finance92-period-list-count' }, `${periodListSummary.count} ${periodListSummary.count === 1 ? 'conta no período' : 'contas no período'}`)),
    listContent,
    h(AccountPortfolioModal, {
      direction: portfolioDirection,
      accounts: portfolioDirection === 'receivable' ? receivables : payables,
      onClose: () => setPortfolioDirection(null),
      rowActions: {
        toggleStockPayable,
        toggleManualAccount,
        deleteManual,
        onOpenDetails: setDetailsAccount,
        openManualEdit: item => { setPortfolioDirection(null); openManualEdit(item); },
        onReceiveInstallment: (sale, index) => { setPortfolioDirection(null); onReceiveInstallment?.(sale, index); },
        onOpenSale: sale => { setPortfolioDirection(null); onOpenSale?.(sale); },
        onOpenProduct: product => { setPortfolioDirection(null); onOpenProduct?.(product); }
      }
    }),
    h(FormModal, { key: modalState ? `${modalState.kind}:${modalState.initial?.id || 'new'}` : 'closed', open: !!modalState, kind: modalState?.kind, initial: modalState?.initial, onClose: () => setModalState(null), onSave: saveManual }),
    h(AccountDetailsModal, {
      item: detailsAccount,
      products,
      onClose: () => setDetailsAccount(null),
      onOpenSale: sale => { setPortfolioDirection(null); onOpenSale?.(sale); },
      onOpenProduct: product => { setPortfolioDirection(null); onOpenProduct?.(product); },
      onEdit: item => { setPortfolioDirection(null); openManualEdit(item); }
    })
  );
};
