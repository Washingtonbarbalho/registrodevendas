import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.2.0';
import { createPortal } from 'https://esm.sh/react-dom@18.2.0';
import {
  ArrowDown, ArrowUp, Banknote, CalendarDays, CreditCard, Edit3, Eye,
  Package, Plus, Receipt, Search, Trash2, Wallet, X
} from 'https://esm.sh/lucide-react@0.292.0';
import { db, APP_ID } from './firebase-config.js';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { MoneyInput } from './components.js';
import { formatCurrency, formatDate, getBrazilDateString, getCurrentMonthEnd, getCurrentMonthStart, parseMoney } from './utils.js';

const h = React.createElement;
const EMPTY_DATA = { entries: [], accounts: [] };
const cleanDate = value => String(value || '').split('T')[0];
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const money = value => Math.round((num(value) + Number.EPSILON) * 100) / 100;
const makeId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const isPrazo = sale => sale?.saleType === 'prazo' || !sale?.saleType;

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
const getDirectNet = sale => {
  const saved = Number(sale?.netReceived);
  if (sale?.netReceived !== undefined && sale?.netReceived !== null && sale?.netReceived !== '' && Number.isFinite(saved)) return money(saved);
  return money(Math.max(0, num(sale?.totalPrice) - num(sale?.feeConfig?.value)));
};
const paymentLabel = method => ({ money: 'Dinheiro', pix: 'PIX', debit: 'Débito', credit: 'Crédito', term: 'A prazo' }[method] || 'Pagamento');
const normalizeFinancialData = raw => ({ entries: Array.isArray(raw?.entries) ? raw.entries : [], accounts: Array.isArray(raw?.accounts) ? raw.accounts : [] });
const getHistoryAmount = item => !item || item.type === 'abatement' ? 0 : money(num(item.amount) + (item.type === 'full_surplus' ? num(item.surplus) : 0));
const getPurchaseCancellationEvents = movement => {
  const current = Array.isArray(movement?.financialCancellations) ? movement.financialCancellations : [];
  if (current.length) return current;
  if (!movement?.financialCanceled) return [];
  const deferred = movement.paymentMethod === 'credit' || movement.paymentMethod === 'term';
  const quantity = Math.max(0, parseInt(movement.quantity, 10) || 0);
  return [{ id: 'legacy-full', quantity, amount: money(quantity * num(movement.unitCost)), date: cleanDate(movement.financialCanceledAt), reason: movement.financialCancelReason || 'Compra cancelada', hadCashOut: deferred ? !!movement.financialPaid : true, createdAt: movement.financialCanceledAtDateTime || '' }];
};
const getPurchaseCanceledQuantity = movement => Math.min(Math.max(0, parseInt(movement?.quantity, 10) || 0), getPurchaseCancellationEvents(movement).reduce((sum, event) => sum + Math.max(0, parseInt(event.quantity, 10) || 0), 0));

const buildSaleReceipts = sale => {
  const rows = [];
  if (num(sale.entryAmount) > 0) rows.push({ id: `sale-entry-${sale.id}`, date: cleanDate(sale.saleDate), dateTime: sale.saleDateTime || '', amount: money(sale.entryAmount), description: `Entrada · ${sale.customerName || 'Cliente'}`, detail: 'Venda a prazo', source: 'sale', sale });
  (sale.installments || []).forEach((installment, index) => {
    const history = Array.isArray(installment.history) ? installment.history : [];
    if (history.length) history.forEach((item, historyIndex) => {
      const amount = getHistoryAmount(item); const date = cleanDate(item.date || item.timestamp || installment.paidAt);
      if (amount > 0 && date) rows.push({ id: `sale-payment-${sale.id}-${index}-${historyIndex}`, date, dateTime: item.timestamp || '', amount, description: `Recebimento · ${sale.customerName || 'Cliente'}`, detail: `Parcela ${installment.number || index + 1}`, source: 'sale', sale });
    });
    else if (installment.paid && installment.paidAt) {
      const amount = money(installment.originalAmount || installment.amount);
      if (amount > 0) rows.push({ id: `sale-paid-${sale.id}-${index}`, date: cleanDate(installment.paidAt), dateTime: installment.paidAtDateTime || '', amount, description: `Recebimento · ${sale.customerName || 'Cliente'}`, detail: `Parcela ${installment.number || index + 1}`, source: 'sale', sale });
    }
  });
  return rows;
};
const statusOf = (dueDate, paid, partial = false, canceled = false, paidLabel = 'Recebida') => {
  if (canceled) return { label: 'Cancelada', cls: 'is-canceled' };
  if (paid) return { label: paidLabel, cls: 'is-paid' };
  if (partial) return { label: 'Parcial', cls: 'is-partial' };
  const today = getBrazilDateString();
  if (dueDate < today) return { label: 'Atrasada', cls: 'is-overdue' };
  if (dueDate === today) return { label: 'Vence hoje', cls: 'is-today' };
  return { label: 'Em aberto', cls: 'is-open' };
};
const useBodyLock = open => useEffect(() => {
  if (!open) return undefined;
  const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
  return () => { document.body.style.overflow = previous; };
}, [open]);

const FormModal = ({ open, kind, initial, onClose, onSave }) => {
  const [type, setType] = useState('income'); const [description, setDescription] = useState(''); const [party, setParty] = useState('');
  const [value, setValue] = useState(''); const [date, setDate] = useState(getBrazilDateString()); const [category, setCategory] = useState(''); const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false);
  useBodyLock(open);
  useEffect(() => { if (!open) return; setType(initial?.type || 'income'); setDescription(initial?.description || ''); setParty(initial?.party || ''); setValue(initial?.value ? String(initial.value).replace('.', ',') : ''); setDate(cleanDate(initial?.date || initial?.dueDate) || getBrazilDateString()); setCategory(initial?.category || ''); setNotes(initial?.notes || ''); setSaving(false); }, [open, kind, initial]);
  if (!open) return null;
  const title = initial ? 'Editar lançamento' : kind === 'movement' ? 'Nova movimentação' : kind === 'receivable' ? 'Nova conta a receber' : 'Nova conta a pagar';
  const submit = async () => {
    const parsed = parseMoney(value); if (!description.trim()) return alert('Informe a descrição.'); if (!(parsed > 0)) return alert('Informe um valor válido.'); if (!date) return alert('Informe a data.');
    setSaving(true); try { await onSave({ kind, type: kind === 'movement' ? type : kind, description: description.trim(), party: party.trim(), value: money(parsed), date, category: category.trim(), notes: notes.trim(), id: initial?.id || null }); onClose(); } finally { setSaving(false); }
  };
  return createPortal(h('div', { className: 'finance46-overlay', role: 'dialog', 'aria-modal': 'true' }, h('div', { className: 'finance46-modal' },
    h('header', { className: 'finance46-modal-hero' }, h('div', { className: 'finance46-modal-icon' }, h(kind === 'movement' ? Banknote : kind === 'receivable' ? Receipt : CreditCard, { size: 22 })), h('div', { className: 'finance46-modal-heading' }, h('span', null, initial ? 'Edição manual' : 'Lançamento manual'), h('h2', null, title), h('p', null, 'Somente registros manuais podem ser alterados por aqui.')), h('button', { type: 'button', onClick: onClose, className: 'finance46-close' }, h(X, { size: 20 }))),
    h('div', { className: 'finance46-modal-scroll' }, kind === 'movement' && h('section', { className: 'finance46-card finance46-card-type' }, h('div', { className: 'finance46-section-label' }, 'Tipo'), h('div', { className: 'finance46-type-switch' }, h('button', { type: 'button', onClick: () => setType('income'), className: type === 'income' ? 'is-active is-income' : '' }, h(ArrowUp, { size: 17 }), 'Entrada'), h('button', { type: 'button', onClick: () => setType('expense'), className: type === 'expense' ? 'is-active is-expense' : '' }, h(ArrowDown, { size: 17 }), 'Saída'))),
      h('section', { className: 'finance46-card' }, h('div', { className: 'finance46-section-label' }, 'Informações'), h('label', { className: 'finance46-field finance46-field-wide' }, h('span', null, 'Descrição *'), h('input', { value: description, onChange: e => setDescription(e.target.value) })), kind !== 'movement' && h('label', { className: 'finance46-field finance46-field-wide' }, h('span', null, kind === 'receivable' ? 'Cliente / origem' : 'Fornecedor / favorecido'), h('input', { value: party, onChange: e => setParty(e.target.value), placeholder: 'Opcional' })), h('div', { className: 'finance46-fields-grid' }, h('label', { className: 'finance46-field' }, h('span', null, 'Valor *'), h(MoneyInput, { value, onChange: setValue, className: 'finance46-money' })), h('label', { className: 'finance46-field' }, h('span', null, kind === 'movement' ? 'Data *' : 'Vencimento *'), h('input', { type: 'date', value: date, onChange: e => setDate(e.target.value) }))), h('label', { className: 'finance46-field finance46-field-wide' }, h('span', null, 'Categoria'), h('input', { value: category, onChange: e => setCategory(e.target.value) })), h('label', { className: 'finance46-field finance46-field-wide' }, h('span', null, 'Observação'), h('textarea', { rows: 3, value: notes, onChange: e => setNotes(e.target.value) })))),
    h('footer', { className: 'finance46-modal-footer' }, h('button', { type: 'button', onClick: onClose, className: 'finance46-button is-secondary' }, 'Cancelar'), h('button', { type: 'button', onClick: submit, disabled: saving, className: 'finance46-button is-primary' }, saving ? 'Salvando...' : 'Salvar'))
  )), document.body);
};

export const AbaFinanceiro = ({ userId, sales = [], products = [], onOpenSale, onOpenProduct, onReceiveInstallment }) => {
  const [tab, setTab] = useState('movements'); const [data, setData] = useState(EMPTY_DATA); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [search, setSearch] = useState(''); const [startDate, setStartDate] = useState(getCurrentMonthStart()); const [endDate, setEndDate] = useState(getCurrentMonthEnd()); const [accountFilter, setAccountFilter] = useState('open'); const [modalState, setModalState] = useState(null);
  const profileRef = useMemo(() => doc(db, 'artifacts', APP_ID, 'users', userId, 'profile', 'info'), [userId]);
  useEffect(() => onSnapshot(profileRef, snapshot => { setData(normalizeFinancialData(snapshot.data()?.financialData)); setLoading(false); setError(''); }, err => { console.error(err); setLoading(false); setError('Não foi possível carregar os lançamentos manuais.'); }), [profileRef]);
  const saveData = async next => { const normalized = normalizeFinancialData(next); await setDoc(profileRef, { financialData: normalized, financialUpdatedAt: serverTimestamp() }, { merge: true }); setData(normalized); };

  const automaticMovements = useMemo(() => {
    const rows = [];
    sales.forEach(sale => {
      const cancellations = Array.isArray(sale.cancellations) ? sale.cancellations : [];
      const keepOriginal = sale.status !== 'canceled' || cancellations.length > 0;
      if (keepOriginal) {
        if (sale.saleType === 'direct') { const amount = getDirectNet(sale); if (amount > 0) rows.push({ id: `direct-${sale.id}`, type: 'income', date: cleanDate(sale.saleDate), dateTime: sale.saleDateTime || '', amount, description: `Venda · ${sale.customerName || 'Venda avulsa'}`, detail: sale.paymentMethod === 'credit' ? `Cartão de crédito · ${sale.cardInstallments || 1}x` : paymentLabel(sale.paymentMethod), source: 'sale', sale }); }
        else if (isPrazo(sale)) rows.push(...buildSaleReceipts(sale).map(row => ({ ...row, type: 'income' })));
      }
      cancellations.forEach((event, index) => { const amount = money(event.refundAmount); if (amount > 0 && event.date) rows.push({ id: `sale-refund-${sale.id}-${event.id || index}`, type: 'expense', date: cleanDate(event.date), dateTime: event.createdAt || '', amount, description: `Estorno de venda · ${sale.customerName || 'Venda avulsa'}`, detail: `${event.type === 'partial' ? 'Cancelamento parcial' : 'Cancelamento total'}${event.reason ? ` · ${event.reason}` : ''}`, source: 'sale-refund', sale }); });
    });
    products.forEach(product => (product.movements || []).forEach(movement => {
      if (movement.type !== 'compra') return;
      const originalQuantity = Math.max(0, parseInt(movement.quantity, 10) || 0); const unitCost = num(movement.unitCost); const originalAmount = money(originalQuantity * unitCost); if (!(originalAmount > 0)) return;
      const deferred = movement.paymentMethod === 'credit' || movement.paymentMethod === 'term'; const events = getPurchaseCancellationEvents(movement); const canceledBeforePayment = money(events.filter(event => event.hadCashOut === false).reduce((sum, event) => sum + (num(event.amount) || num(event.quantity) * unitCost), 0)); const amountActuallyPaid = money(Math.max(0, originalAmount - canceledBeforePayment)); const hadCashOut = deferred ? !!movement.financialPaid : true; const paymentDate = cleanDate(deferred ? movement.financialPaidAt : movement.date); const paymentDateTime = deferred ? (movement.financialPaidAtDateTime || '') : (movement.date || '');
      if (hadCashOut && paymentDate && amountActuallyPaid > 0) rows.push({ id: `stock-${product.id}-${movement.id}`, type: 'expense', date: paymentDate, dateTime: paymentDateTime, amount: amountActuallyPaid, description: `Compra de mercadoria · ${product.name}`, detail: deferred ? `${paymentLabel(movement.paymentMethod)} · paga` : paymentLabel(movement.paymentMethod), source: 'stock', product });
      events.forEach((event, index) => { const amount = money(event.amount || num(event.quantity) * unitCost); if (event.hadCashOut && amount > 0 && event.date) rows.push({ id: `stock-refund-${product.id}-${movement.id}-${event.id || index}`, type: 'income', date: cleanDate(event.date), dateTime: event.createdAt || '', amount, description: `Estorno de compra · ${product.name}`, detail: event.reason || 'Devolução ao fornecedor', source: 'stock-refund', product }); });
    }));
    return rows;
  }, [sales, products]);

  const manualMovements = useMemo(() => { const rows = data.entries.map(item => ({ id: item.id, type: item.type, date: cleanDate(item.date), dateTime: item.dateTime || item.createdAt || '', amount: money(item.value), description: item.description, detail: item.category || 'Lançamento manual', source: 'manual', manual: item })); data.accounts.filter(item => item.paid).forEach(item => rows.push({ id: `manual-account-${item.id}`, type: item.direction === 'receivable' ? 'income' : 'expense', date: cleanDate(item.paidAt), dateTime: item.paidAtDateTime || '', amount: money(item.value), description: item.description, detail: item.direction === 'receivable' ? 'Conta recebida' : 'Conta paga', source: 'manual-account', manual: item })); return rows; }, [data]);
  const movements = useMemo(() => [...automaticMovements, ...manualMovements].filter(item => item.date && item.date >= startDate && item.date <= endDate).filter(item => !search || `${item.description} ${item.detail}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sortTimestamp(b) - sortTimestamp(a) || String(b.id).localeCompare(String(a.id))), [automaticMovements, manualMovements, startDate, endDate, search]);

  const saleReceivables = useMemo(() => { const rows = []; sales.filter(sale => sale.status !== 'canceled' && isPrazo(sale)).forEach(sale => (sale.installments || []).forEach((inst, index) => { const remaining = money(inst.amount); const face = money(inst.originalAmount || remaining); const paid = !!inst.paid || remaining <= 0; const history = Array.isArray(inst.history) ? inst.history : []; const partial = !paid && history.some(item => item && item.type !== 'abatement' && num(item.amount) > 0); rows.push({ id: `sale-ar-${sale.id}-${index}`, source: 'sale', sale, installmentIndex: index, description: `${sale.customerName || 'Cliente'} · Parcela ${inst.number || index + 1}/${sale.installmentsCount || sale.installments.length}`, party: sale.customerName || '', dueDate: cleanDate(inst.dueDate), value: paid ? face : remaining, paid, paidAt: cleanDate(inst.paidAt), paidAtDateTime: inst.paidAtDateTime || '', partial, canceled: false, status: statusOf(cleanDate(inst.dueDate), paid, partial, false) }); })); return rows; }, [sales]);
  const stockPayables = useMemo(() => { const rows = []; products.forEach(product => (product.movements || []).forEach(movement => { if (movement.type !== 'compra' || !['credit', 'term'].includes(movement.paymentMethod)) return; const originalQuantity = Math.max(0, parseInt(movement.quantity, 10) || 0); const unitCost = num(movement.unitCost); const events = getPurchaseCancellationEvents(movement); const canceledQuantity = getPurchaseCanceledQuantity(movement); const remainingQuantity = Math.max(0, originalQuantity - canceledQuantity); const fullyCanceled = remainingQuantity <= 0; const canceledBeforePayment = money(events.filter(event => event.hadCashOut === false).reduce((sum, event) => sum + (num(event.amount) || num(event.quantity) * unitCost), 0)); const paidValue = money(Math.max(0, originalQuantity * unitCost - canceledBeforePayment)); const value = movement.financialPaid ? paidValue : money(remainingQuantity * unitCost); rows.push({ id: `stock-ap-${product.id}-${movement.id}`, source: 'stock', product, productId: product.id, movementId: movement.id, description: `Compra de mercadoria · ${product.name}`, party: paymentLabel(movement.paymentMethod), dueDate: cleanDate(movement.paymentDueDate), value, paid: !!movement.financialPaid, paidAt: cleanDate(movement.financialPaidAt), paidAtDateTime: movement.financialPaidAtDateTime || '', canceled: fullyCanceled, partial: canceledQuantity > 0 && !fullyCanceled, status: fullyCanceled ? statusOf(cleanDate(movement.paymentDueDate), false, false, true, 'Paga') : canceledQuantity > 0 && !movement.financialPaid ? { label: 'Parcialmente cancelada', cls: 'is-partial' } : statusOf(cleanDate(movement.paymentDueDate), !!movement.financialPaid, false, false, 'Paga') }); })); return rows; }, [products]);
  const manualReceivables = useMemo(() => data.accounts.filter(item => item.direction === 'receivable').map(item => ({ ...item, source: 'manual', value: money(item.value), dueDate: cleanDate(item.dueDate), canceled: false, status: statusOf(cleanDate(item.dueDate), !!item.paid, false, false, 'Recebida') })), [data]);
  const manualPayables = useMemo(() => data.accounts.filter(item => item.direction === 'payable').map(item => ({ ...item, source: 'manual', value: money(item.value), dueDate: cleanDate(item.dueDate), canceled: false, status: statusOf(cleanDate(item.dueDate), !!item.paid, false, false, 'Paga') })), [data]);
  const receivables = useMemo(() => [...saleReceivables, ...manualReceivables], [saleReceivables, manualReceivables]); const payables = useMemo(() => [...stockPayables, ...manualPayables], [stockPayables, manualPayables]);
  const filteredAccounts = useMemo(() => { const base = tab === 'receivable' ? receivables : payables; return base.filter(item => accountFilter === 'all' || (accountFilter === 'paid' ? item.paid && !item.canceled : !item.paid && !item.canceled)).filter(item => !search || `${item.description} ${item.party || ''}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => { if (a.canceled !== b.canceled) return a.canceled ? 1 : -1; if (a.paid !== b.paid) return a.paid ? 1 : -1; return String(a.dueDate || '').localeCompare(String(b.dueDate || '')); }); }, [tab, receivables, payables, accountFilter, search]);
  const totals = useMemo(() => { const income = movements.filter(i => i.type === 'income').reduce((sum, i) => sum + i.amount, 0); const expense = movements.filter(i => i.type === 'expense').reduce((sum, i) => sum + i.amount, 0); return { income: money(income), expense: money(expense), balance: money(income - expense), openReceivable: money(receivables.filter(i => !i.paid && !i.canceled).reduce((sum, i) => sum + i.value, 0)), openPayable: money(payables.filter(i => !i.paid && !i.canceled).reduce((sum, i) => sum + i.value, 0)) }; }, [movements, receivables, payables]);

  const saveManual = async form => { setError(''); setMessage(''); const now = new Date().toISOString(); if (form.kind === 'movement') { const nextItem = { id: form.id || makeId('mov'), type: form.type, description: form.description, value: form.value, date: form.date, dateTime: dateWithCurrentTime(form.date), category: form.category, notes: form.notes, createdAt: form.id ? (data.entries.find(i => i.id === form.id)?.createdAt || now) : now }; await saveData({ ...data, entries: form.id ? data.entries.map(item => item.id === form.id ? nextItem : item) : [...data.entries, nextItem] }); } else { const direction = form.kind === 'receivable' ? 'receivable' : 'payable'; const existing = form.id ? data.accounts.find(i => i.id === form.id) : null; const nextItem = { id: form.id || makeId('acc'), direction, description: form.description, party: form.party, value: form.value, dueDate: form.date, category: form.category, notes: form.notes, paid: existing?.paid || false, paidAt: existing?.paidAt || null, paidAtDateTime: existing?.paidAtDateTime || null, createdAt: existing?.createdAt || now }; await saveData({ ...data, accounts: form.id ? data.accounts.map(item => item.id === form.id ? nextItem : item) : [...data.accounts, nextItem] }); } setMessage(form.id ? 'Lançamento atualizado.' : 'Lançamento salvo.'); };
  const toggleManualAccount = async item => { const nextPaid = !item.paid; await saveData({ ...data, accounts: data.accounts.map(account => account.id === item.id ? { ...account, paid: nextPaid, paidAt: nextPaid ? getBrazilDateString() : null, paidAtDateTime: nextPaid ? new Date().toISOString() : null } : account) }); };
  const toggleStockPayable = async item => { if (item.canceled) return; const product = products.find(p => p.id === item.productId); if (!product) return; const nextPaid = !item.paid; const now = new Date().toISOString(); const updated = (product.movements || []).map(movement => movement.id === item.movementId ? { ...movement, financialPaid: nextPaid, financialPaidAt: nextPaid ? getBrazilDateString() : null, financialPaidAtDateTime: nextPaid ? now : null } : movement); await updateDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'products', item.productId), { movements: updated }); };
  const deleteManual = async (kind, id) => { if (!confirm('Excluir este lançamento manual?')) return; if (kind === 'entry') await saveData({ ...data, entries: data.entries.filter(item => item.id !== id) }); else await saveData({ ...data, accounts: data.accounts.filter(item => item.id !== id) }); };

  const openCount = list => list.filter(i => !i.paid && !i.canceled).length;
  const cards = [{ label: 'Saldo do período', value: totals.balance, icon: Wallet, cls: totals.balance >= 0 ? 'is-green' : 'is-red' }, { label: 'Entradas', value: totals.income, icon: ArrowUp, cls: 'is-green' }, { label: 'Saídas', value: totals.expense, icon: ArrowDown, cls: 'is-red' }, { label: 'A receber', value: totals.openReceivable, icon: Receipt, cls: 'is-blue', meta: `${openCount(receivables)} em aberto` }, { label: 'A pagar', value: totals.openPayable, icon: CreditCard, cls: 'is-amber', meta: `${openCount(payables)} em aberto` }];
  const openManualEdit = item => setModalState({ kind: item.direction ? item.direction : 'movement', initial: item });
  const originButton = item => (item.source === 'sale' || item.source === 'sale-refund') && item.sale ? h('button', { className: 'finance44-action', onClick: () => onOpenSale?.(item.sale) }, h(Eye, { size: 14 }), 'Ver venda') : (item.source === 'stock' || item.source === 'stock-refund') && item.product ? h('button', { className: 'finance44-action', onClick: () => onOpenProduct?.(item.product) }, h(Package, { size: 14 }), 'Ver produto') : null;

  return h('section', { className: 'finance44 page-stack animate-fade-in' },
    h('div', { className: 'page-heading finance44-heading' }, h('div', { className: 'page-heading-copy' }, h('h1', { className: 'page-title' }, 'Financeiro'), h('p', { className: 'page-description' }, 'Extrato, contas a receber e contas a pagar. Operações automáticas são controladas na área onde nasceram.')), h('button', { type: 'button', className: 'page-primary-action', onClick: () => setModalState({ kind: tab === 'receivable' ? 'receivable' : tab === 'payable' ? 'payable' : 'movement', initial: null }) }, h(Plus, { size: 17 }), tab === 'movements' ? 'Novo lançamento' : tab === 'receivable' ? 'Nova conta a receber' : 'Nova conta a pagar')),
    error && h('div', { className: 'finance44-alert is-error' }, error), message && h('div', { className: 'finance44-alert is-success' }, message),
    h('div', { className: 'finance44-summary' }, cards.map(card => h('article', { key: card.label, className: `finance44-summary-card ${card.cls}` }, h('div', { className: 'finance44-summary-icon' }, h(card.icon, { size: 19 })), h('div', null, h('span', null, card.label), h('strong', null, formatCurrency(card.value)), card.meta && h('small', null, card.meta))))),
    h('div', { className: 'finance44-tabs' }, h('button', { onClick: () => { setTab('movements'); setSearch(''); }, className: tab === 'movements' ? 'is-active' : '' }, h(Banknote, { size: 17 }), 'Movimentações'), h('button', { onClick: () => { setTab('receivable'); setSearch(''); }, className: tab === 'receivable' ? 'is-active' : '' }, h(Receipt, { size: 17 }), 'Contas a receber'), h('button', { onClick: () => { setTab('payable'); setSearch(''); }, className: tab === 'payable' ? 'is-active' : '' }, h(CreditCard, { size: 17 }), 'Contas a pagar')),
    h('div', { className: 'finance44-toolbar' }, h('div', { className: 'finance44-search' }, h(Search, { size: 17 }), h('input', { value: search, onChange: e => setSearch(e.target.value), placeholder: 'Buscar no financeiro...' })), tab === 'movements' ? h('div', { className: 'finance44-period' }, h(CalendarDays, { size: 16 }), h('input', { type: 'date', value: startDate, onChange: e => setStartDate(e.target.value) }), h('span', null, 'até'), h('input', { type: 'date', value: endDate, onChange: e => setEndDate(e.target.value) })) : h('div', { className: 'finance44-filter' }, [['open', 'Em aberto'], ['paid', tab === 'receivable' ? 'Recebidas' : 'Pagas'], ['all', 'Todas']].map(([value, label]) => h('button', { key: value, onClick: () => setAccountFilter(value), className: accountFilter === value ? 'is-active' : '' }, label)))),
    loading ? h('div', { className: 'surface finance44-empty' }, 'Carregando financeiro...') : tab === 'movements' ? h('div', { className: 'finance44-list' }, movements.length === 0 ? h('div', { className: 'finance44-empty' }, 'Nenhuma movimentação neste período.') : movements.map(item => h('div', { key: item.id, className: 'finance44-row finance44-movement-row' }, h('div', { className: `finance44-direction ${item.type === 'income' ? 'is-income' : 'is-expense'}` }, item.type === 'income' ? h(ArrowUp, { size: 17 }) : h(ArrowDown, { size: 17 })), h('div', { className: 'finance44-main' }, h('strong', null, item.description), h('span', null, `${formatDateTime(item.date, item.dateTime)} · ${item.detail || ''}`)), h('strong', { className: item.type === 'income' ? 'finance44-value is-income' : 'finance44-value is-expense' }, `${item.type === 'income' ? '+' : '-'} ${formatCurrency(item.amount)}`), h('div', { className: 'finance44-actions' }, item.source === 'manual' ? h(React.Fragment, null, h('button', { className: 'finance44-action', onClick: () => openManualEdit(item.manual) }, h(Edit3, { size: 14 }), 'Editar'), h('button', { className: 'finance44-icon-action is-danger', onClick: () => deleteManual('entry', item.manual.id) }, h(Trash2, { size: 16 }))) : originButton(item) || h('span', { className: 'finance44-source' }, item.source === 'manual-account' ? 'Conta manual' : 'Automático'))))) : h('div', { className: 'finance44-list' }, filteredAccounts.length === 0 ? h('div', { className: 'finance44-empty' }, 'Nenhuma conta encontrada.') : filteredAccounts.map(item => h('div', { key: item.id, className: `finance44-row finance44-account-row ${item.canceled ? 'is-canceled-row' : ''}` }, h('div', { className: 'finance44-main' }, h('strong', null, item.description), h('span', null, `${item.party || (item.source === 'sale' ? 'Venda a prazo' : item.source === 'stock' ? 'Compra de mercadoria' : 'Manual')} · Venc. ${formatDate(item.dueDate)}${item.paid ? ` · Pago em ${formatDateTime(item.paidAt, item.paidAtDateTime)}` : ''}`)), h('span', { className: `finance44-status ${item.status.cls}` }, item.status.label), h('strong', { className: 'finance44-account-value' }, formatCurrency(item.value)), h('div', { className: 'finance44-actions' }, item.source === 'sale' ? h(React.Fragment, null, !item.paid && h('button', { className: 'finance44-action is-primary', onClick: () => onReceiveInstallment?.(item.sale, item.installmentIndex) }, 'Receber'), h('button', { className: 'finance44-action', onClick: () => onOpenSale?.(item.sale) }, 'Ver venda')) : item.source === 'stock' ? h(React.Fragment, null, !item.canceled && h('button', { className: item.paid ? 'finance44-action is-secondary' : 'finance44-action is-primary', onClick: () => toggleStockPayable(item) }, item.paid ? 'Reabrir' : 'Pagar'), h('button', { className: 'finance44-action', onClick: () => onOpenProduct?.(item.product) }, 'Ver produto')) : h(React.Fragment, null, h('button', { className: item.paid ? 'finance44-action is-secondary' : 'finance44-action is-primary', onClick: () => toggleManualAccount(item) }, item.paid ? 'Reabrir' : tab === 'receivable' ? 'Receber' : 'Pagar'), h('button', { className: 'finance44-action', onClick: () => openManualEdit(item) }, h(Edit3, { size: 14 }), 'Editar'), h('button', { className: 'finance44-icon-action is-danger', onClick: () => deleteManual('account', item.id) }, h(Trash2, { size: 16 }))))))),
    h(FormModal, { open: !!modalState, kind: modalState?.kind, initial: modalState?.initial, onClose: () => setModalState(null), onSave: saveManual })
  );
};
