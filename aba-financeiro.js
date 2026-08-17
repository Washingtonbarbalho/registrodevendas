import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.2.0';
import {
  ArrowDown, ArrowUp, Banknote, CalendarDays, Check, Clock3, CreditCard,
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

const getDirectNet = sale => {
  const saved = Number(sale?.netReceived);
  if (sale?.netReceived !== undefined && sale?.netReceived !== null && sale?.netReceived !== '' && Number.isFinite(saved)) return money(saved);
  const total = num(sale?.totalPrice);
  const fee = num(sale?.feeConfig?.value);
  return money(Math.max(0, total - fee));
};

const paymentLabel = method => ({
  money: 'Dinheiro', pix: 'PIX', debit: 'Débito', credit: 'Crédito', term: 'A prazo'
}[method] || 'Não informada');

const normalizeFinancialData = raw => ({
  entries: Array.isArray(raw?.entries) ? raw.entries : [],
  accounts: Array.isArray(raw?.accounts) ? raw.accounts : []
});

const getHistoryAmount = item => {
  if (!item || item.type === 'abatement') return 0;
  return money(num(item.amount) + (item.type === 'full_surplus' ? num(item.surplus) : 0));
};

const buildSaleReceipts = sale => {
  const rows = [];
  if (num(sale.entryAmount) > 0) {
    rows.push({
      id: `sale-entry-${sale.id}`,
      date: cleanDate(sale.saleDate),
      amount: money(sale.entryAmount),
      description: `Entrada · ${sale.customerName || 'Cliente'}`,
      detail: 'Venda a prazo',
      source: 'sale'
    });
  }
  (sale.installments || []).forEach((installment, index) => {
    const history = Array.isArray(installment.history) ? installment.history : [];
    if (history.length) {
      history.forEach((item, historyIndex) => {
        const amount = getHistoryAmount(item);
        const date = cleanDate(item.date || item.timestamp || installment.paidAt);
        if (amount > 0 && date) rows.push({
          id: `sale-payment-${sale.id}-${index}-${historyIndex}`,
          date,
          amount,
          description: `Recebimento · ${sale.customerName || 'Cliente'}`,
          detail: `Parcela ${installment.number || index + 1}`,
          source: 'sale'
        });
      });
    } else if (installment.paid && installment.paidAt) {
      const amount = money(installment.originalAmount || installment.amount);
      if (amount > 0) rows.push({
        id: `sale-paid-${sale.id}-${index}`,
        date: cleanDate(installment.paidAt),
        amount,
        description: `Recebimento · ${sale.customerName || 'Cliente'}`,
        detail: `Parcela ${installment.number || index + 1}`,
        source: 'sale'
      });
    }
  });
  return rows;
};

const statusOf = (dueDate, paid, partial = false) => {
  if (paid) return { label: 'Recebida', cls: 'is-paid' };
  if (partial) return { label: 'Parcial', cls: 'is-partial' };
  const today = getBrazilDateString();
  if (dueDate < today) return { label: 'Atrasada', cls: 'is-overdue' };
  if (dueDate === today) return { label: 'Vence hoje', cls: 'is-today' };
  return { label: 'Em aberto', cls: 'is-open' };
};

const FormModal = ({ open, kind, onClose, onSave }) => {
  const [type, setType] = useState('income');
  const [description, setDescription] = useState('');
  const [party, setParty] = useState('');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(getBrazilDateString());
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType('income'); setDescription(''); setParty(''); setValue('');
    setDate(getBrazilDateString()); setCategory(''); setNotes(''); setSaving(false);
  }, [open, kind]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    const overscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => { document.body.style.overflow = previous; document.body.style.overscrollBehavior = overscroll; };
  }, [open]);

  if (!open) return null;
  const title = kind === 'movement' ? 'Nova movimentação' : kind === 'receivable' ? 'Nova conta a receber' : 'Nova conta a pagar';
  const dateLabel = kind === 'movement' ? 'Data da movimentação' : 'Vencimento';

  const submit = async () => {
    const parsed = parseMoney(value);
    if (!description.trim()) return alert('Informe a descrição.');
    if (!(parsed > 0)) return alert('Informe um valor válido.');
    if (!date) return alert(kind === 'movement' ? 'Informe a data.' : 'Informe o vencimento.');
    setSaving(true);
    try {
      await onSave({
        kind,
        type: kind === 'movement' ? type : kind,
        description: description.trim(), party: party.trim(), value: money(parsed),
        date, category: category.trim(), notes: notes.trim()
      });
      onClose();
    } finally { setSaving(false); }
  };

  return h('div', { className: 'finance44-overlay fixed inset-0 z-[125] flex items-center justify-center p-3 sm:p-5', role: 'dialog', 'aria-modal': 'true' },
    h('div', { className: 'finance44-modal w-full max-w-lg' },
      h('header', { className: 'finance44-modal-header' },
        h('div', null, h('h2', null, title), h('p', null, 'Preencha os dados do lançamento financeiro.')),
        h('button', { type: 'button', onClick: onClose, className: 'finance44-close' }, h(X, { size: 20 }))
      ),
      h('div', { className: 'finance44-modal-body' },
        kind === 'movement' && h('div', { className: 'finance44-type' },
          h('button', { type: 'button', onClick: () => setType('income'), className: type === 'income' ? 'is-active is-income' : '' }, h(ArrowUp, { size: 16 }), 'Entrada'),
          h('button', { type: 'button', onClick: () => setType('expense'), className: type === 'expense' ? 'is-active is-expense' : '' }, h(ArrowDown, { size: 16 }), 'Saída')
        ),
        h('label', { className: 'finance44-field' }, h('span', null, 'Descrição *'), h('input', { autoFocus: true, value: description, onChange: e => setDescription(e.target.value), placeholder: 'Ex.: Frete, serviço, aporte...' })),
        kind !== 'movement' && h('label', { className: 'finance44-field' }, h('span', null, kind === 'receivable' ? 'Cliente / origem' : 'Fornecedor / favorecido'), h('input', { value: party, onChange: e => setParty(e.target.value), placeholder: 'Opcional' })),
        h('div', { className: 'finance44-form-grid' },
          h('label', { className: 'finance44-field' }, h('span', null, 'Valor *'), h(MoneyInput, { value, onChange: setValue, className: 'finance44-money' })),
          h('label', { className: 'finance44-field' }, h('span', null, dateLabel + ' *'), h('input', { type: 'date', value: date, onChange: e => setDate(e.target.value) }))
        ),
        h('label', { className: 'finance44-field' }, h('span', null, 'Categoria'), h('input', { value: category, onChange: e => setCategory(e.target.value), placeholder: 'Ex.: Operacional, fornecedor, aporte...' })),
        h('label', { className: 'finance44-field' }, h('span', null, 'Observação'), h('textarea', { rows: 3, value: notes, onChange: e => setNotes(e.target.value), placeholder: 'Informação adicional...' }))
      ),
      h('footer', { className: 'finance44-modal-footer' },
        h('button', { type: 'button', onClick: onClose, className: 'finance44-secondary' }, 'Cancelar'),
        h('button', { type: 'button', onClick: submit, disabled: saving, className: 'finance44-primary' }, saving ? 'Salvando...' : 'Salvar')
      )
    )
  );
};

export const AbaFinanceiro = ({ userId, sales = [], products = [], onOpenSale }) => {
  const [tab, setTab] = useState('movements');
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(getCurrentMonthStart());
  const [endDate, setEndDate] = useState(getCurrentMonthEnd());
  const [accountFilter, setAccountFilter] = useState('open');
  const [modalKind, setModalKind] = useState(null);

  const profileRef = useMemo(() => doc(db, 'artifacts', APP_ID, 'users', userId, 'profile', 'info'), [userId]);

  useEffect(() => onSnapshot(profileRef, snapshot => {
    setData(normalizeFinancialData(snapshot.data()?.financialData));
    setLoading(false); setError('');
  }, err => {
    console.error('Erro ao carregar Financeiro:', err);
    setLoading(false); setError('Não foi possível carregar os lançamentos manuais.');
  }), [profileRef]);

  const saveData = async next => {
    await setDoc(profileRef, { financialData: normalizeFinancialData(next), financialUpdatedAt: serverTimestamp() }, { merge: true });
    setData(normalizeFinancialData(next));
  };

  const automaticMovements = useMemo(() => {
    const rows = [];
    sales.filter(s => s.status !== 'canceled').forEach(sale => {
      if (sale.saleType === 'direct') {
        const amount = getDirectNet(sale);
        if (amount > 0) rows.push({ id: `direct-${sale.id}`, type: 'income', date: cleanDate(sale.saleDate), amount, description: `Venda · ${sale.customerName || 'Venda avulsa'}`, detail: sale.paymentMethod === 'credit' ? `Cartão de crédito · ${sale.cardInstallments || 1}x` : paymentLabel(sale.paymentMethod), source: 'sale' });
      } else if (isPrazo(sale)) rows.push(...buildSaleReceipts(sale).map(row => ({ ...row, type: 'income' })));
    });

    products.forEach(product => (product.movements || []).forEach(movement => {
      if (movement.type !== 'compra') return;
      const amount = money(num(movement.quantity) * num(movement.unitCost));
      if (!(amount > 0)) return;
      const deferred = movement.paymentMethod === 'credit' || movement.paymentMethod === 'term';
      if (deferred && !movement.financialPaid) return;
      rows.push({
        id: `stock-${product.id}-${movement.id}`,
        type: 'expense',
        date: cleanDate(deferred ? (movement.financialPaidAt || movement.paymentDueDate) : movement.date),
        amount,
        description: `Compra de mercadoria · ${product.name}`,
        detail: deferred ? `${paymentLabel(movement.paymentMethod)} · paga` : paymentLabel(movement.paymentMethod),
        source: 'stock'
      });
    }));
    return rows;
  }, [sales, products]);

  const manualMovements = useMemo(() => {
    const rows = data.entries.map(item => ({
      id: item.id, type: item.type, date: cleanDate(item.date), amount: money(item.value),
      description: item.description, detail: item.category || 'Lançamento manual', source: 'manual', manualId: item.id
    }));
    data.accounts.filter(item => item.paid).forEach(item => rows.push({
      id: `manual-account-${item.id}`, type: item.direction === 'receivable' ? 'income' : 'expense',
      date: cleanDate(item.paidAt), amount: money(item.value), description: item.description,
      detail: item.direction === 'receivable' ? 'Conta recebida' : 'Conta paga', source: 'manual-account', accountId: item.id
    }));
    return rows;
  }, [data]);

  const movements = useMemo(() => [...automaticMovements, ...manualMovements]
    .filter(item => item.date && item.date >= startDate && item.date <= endDate)
    .filter(item => !search || `${item.description} ${item.detail}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), [automaticMovements, manualMovements, startDate, endDate, search]);

  const saleReceivables = useMemo(() => {
    const rows = [];
    sales.filter(s => s.status !== 'canceled' && isPrazo(s)).forEach(sale => {
      (sale.installments || []).forEach((inst, index) => {
        const remaining = money(inst.amount);
        const face = money(inst.originalAmount || remaining);
        const paid = !!inst.paid || remaining <= 0;
        const history = Array.isArray(inst.history) ? inst.history : [];
        const partial = !paid && history.some(item => item && item.type !== 'abatement' && num(item.amount) > 0);
        rows.push({
          id: `sale-ar-${sale.id}-${index}`, source: 'sale', sale, saleId: sale.id,
          description: `${sale.customerName || 'Cliente'} · Parcela ${inst.number || index + 1}/${sale.installmentsCount || sale.installments.length}`,
          party: sale.customerName || '', dueDate: cleanDate(inst.dueDate), value: paid ? face : remaining,
          paid, paidAt: cleanDate(inst.paidAt), partial, status: statusOf(cleanDate(inst.dueDate), paid, partial)
        });
      });
    });
    return rows;
  }, [sales]);

  const stockPayables = useMemo(() => {
    const rows = [];
    products.forEach(product => (product.movements || []).forEach(movement => {
      if (movement.type !== 'compra' || !['credit', 'term'].includes(movement.paymentMethod)) return;
      const value = money(num(movement.quantity) * num(movement.unitCost));
      if (!(value > 0) || !movement.paymentDueDate) return;
      rows.push({
        id: `stock-ap-${product.id}-${movement.id}`, source: 'stock', productId: product.id, movementId: movement.id,
        description: `Compra de mercadoria · ${product.name}`, party: paymentLabel(movement.paymentMethod),
        dueDate: cleanDate(movement.paymentDueDate), value, paid: !!movement.financialPaid,
        paidAt: cleanDate(movement.financialPaidAt), status: statusOf(cleanDate(movement.paymentDueDate), !!movement.financialPaid, false)
      });
    }));
    return rows;
  }, [products]);

  const manualReceivables = useMemo(() => data.accounts.filter(item => item.direction === 'receivable').map(item => ({ ...item, source: 'manual', value: money(item.value), dueDate: cleanDate(item.dueDate), status: statusOf(cleanDate(item.dueDate), !!item.paid, false) })), [data]);
  const manualPayables = useMemo(() => data.accounts.filter(item => item.direction === 'payable').map(item => ({ ...item, source: 'manual', value: money(item.value), dueDate: cleanDate(item.dueDate), status: statusOf(cleanDate(item.dueDate), !!item.paid, false) })), [data]);
  const receivables = useMemo(() => [...saleReceivables, ...manualReceivables], [saleReceivables, manualReceivables]);
  const payables = useMemo(() => [...stockPayables, ...manualPayables], [stockPayables, manualPayables]);

  const filteredAccounts = useMemo(() => {
    const base = tab === 'receivable' ? receivables : payables;
    return base.filter(item => accountFilter === 'all' || (accountFilter === 'paid' ? item.paid : !item.paid))
      .filter(item => !search || `${item.description} ${item.party || ''}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.paid === b.paid ? a.dueDate.localeCompare(b.dueDate) : a.paid ? 1 : -1));
  }, [tab, receivables, payables, accountFilter, search]);

  const totals = useMemo(() => {
    const income = movements.filter(i => i.type === 'income').reduce((sum, i) => sum + i.amount, 0);
    const expense = movements.filter(i => i.type === 'expense').reduce((sum, i) => sum + i.amount, 0);
    const openReceivable = receivables.filter(i => !i.paid).reduce((sum, i) => sum + i.value, 0);
    const openPayable = payables.filter(i => !i.paid).reduce((sum, i) => sum + i.value, 0);
    return { income: money(income), expense: money(expense), balance: money(income - expense), openReceivable: money(openReceivable), openPayable: money(openPayable) };
  }, [movements, receivables, payables]);

  const saveManual = async form => {
    setError(''); setMessage('');
    try {
      if (form.kind === 'movement') {
        await saveData({ ...data, entries: [...data.entries, { id: makeId('mov'), type: form.type, description: form.description, value: form.value, date: form.date, category: form.category, notes: form.notes, createdAt: new Date().toISOString() }] });
      } else {
        const direction = form.kind === 'receivable' ? 'receivable' : 'payable';
        await saveData({ ...data, accounts: [...data.accounts, { id: makeId('acc'), direction, description: form.description, party: form.party, value: form.value, dueDate: form.date, category: form.category, notes: form.notes, paid: false, paidAt: null, createdAt: new Date().toISOString() }] });
      }
      setMessage('Lançamento salvo com sucesso.');
    } catch (err) {
      console.error('Erro ao salvar lançamento financeiro:', err);
      setError('Não foi possível salvar o lançamento. Tente novamente.');
      throw err;
    }
  };

  const toggleManualAccount = async item => {
    const nextPaid = !item.paid;
    await saveData({ ...data, accounts: data.accounts.map(account => account.id === item.id ? { ...account, paid: nextPaid, paidAt: nextPaid ? getBrazilDateString() : null } : account) });
  };

  const deleteManual = async (kind, id) => {
    if (!confirm('Excluir este lançamento manual?')) return;
    if (kind === 'entry') await saveData({ ...data, entries: data.entries.filter(item => item.id !== id) });
    else await saveData({ ...data, accounts: data.accounts.filter(item => item.id !== id) });
  };

  const toggleStockPayable = async item => {
    const product = products.find(p => p.id === item.productId);
    if (!product) return;
    const nextPaid = !item.paid;
    const movementsUpdated = (product.movements || []).map(movement => movement.id === item.movementId ? { ...movement, financialPaid: nextPaid, financialPaidAt: nextPaid ? getBrazilDateString() : null } : movement);
    await updateDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'products', item.productId), { movements: movementsUpdated });
  };

  const openCount = list => list.filter(i => !i.paid).length;
  const summaryCards = [
    { label: 'Saldo do período', value: totals.balance, icon: Wallet, cls: totals.balance >= 0 ? 'is-green' : 'is-red' },
    { label: 'Entradas', value: totals.income, icon: ArrowUp, cls: 'is-green' },
    { label: 'Saídas', value: totals.expense, icon: ArrowDown, cls: 'is-red' },
    { label: 'A receber', value: totals.openReceivable, icon: Receipt, cls: 'is-blue', meta: `${openCount(receivables)} em aberto` },
    { label: 'A pagar', value: totals.openPayable, icon: CreditCard, cls: 'is-amber', meta: `${openCount(payables)} em aberto` }
  ];

  return h('section', { className: 'finance44 page-stack animate-fade-in' },
    h('div', { className: 'page-heading finance44-heading' },
      h('div', { className: 'page-heading-copy' }, h('h1', { className: 'page-title' }, 'Financeiro'), h('p', { className: 'page-description' }, 'Entradas, saídas, contas a receber e contas a pagar em um só lugar.')),
      h('button', { type: 'button', className: 'page-primary-action', onClick: () => setModalKind(tab === 'receivable' ? 'receivable' : tab === 'payable' ? 'payable' : 'movement') }, h(Plus, { size: 17 }), tab === 'movements' ? 'Novo lançamento' : tab === 'receivable' ? 'Nova conta a receber' : 'Nova conta a pagar')
    ),
    error && h('div', { className: 'finance44-alert is-error' }, error),
    message && h('div', { className: 'finance44-alert is-success' }, message),
    h('div', { className: 'finance44-summary' }, summaryCards.map(card => h('article', { key: card.label, className: `finance44-summary-card ${card.cls}` }, h('div', { className: 'finance44-summary-icon' }, h(card.icon, { size: 19 })), h('div', null, h('span', null, card.label), h('strong', null, formatCurrency(card.value)), card.meta && h('small', null, card.meta))))),
    h('div', { className: 'finance44-tabs' },
      h('button', { onClick: () => { setTab('movements'); setSearch(''); }, className: tab === 'movements' ? 'is-active' : '' }, h(Banknote, { size: 17 }), 'Movimentações'),
      h('button', { onClick: () => { setTab('receivable'); setSearch(''); }, className: tab === 'receivable' ? 'is-active' : '' }, h(Receipt, { size: 17 }), 'Contas a receber'),
      h('button', { onClick: () => { setTab('payable'); setSearch(''); }, className: tab === 'payable' ? 'is-active' : '' }, h(CreditCard, { size: 17 }), 'Contas a pagar')
    ),
    h('div', { className: 'finance44-toolbar' },
      h('div', { className: 'finance44-search' }, h(Search, { size: 17 }), h('input', { value: search, onChange: e => setSearch(e.target.value), placeholder: 'Buscar no financeiro...' })),
      tab === 'movements' ? h('div', { className: 'finance44-period' },
        h(CalendarDays, { size: 16 }), h('input', { type: 'date', value: startDate, onChange: e => setStartDate(e.target.value) }), h('span', null, 'até'), h('input', { type: 'date', value: endDate, onChange: e => setEndDate(e.target.value) })
      ) : h('div', { className: 'finance44-filter' },
        [['open','Em aberto'],['paid', tab === 'receivable' ? 'Recebidas' : 'Pagas'],['all','Todas']].map(([value,label]) => h('button', { key: value, onClick: () => setAccountFilter(value), className: accountFilter === value ? 'is-active' : '' }, label))
      )
    ),
    loading ? h('div', { className: 'surface finance44-empty' }, 'Carregando financeiro...') : tab === 'movements'
      ? h('div', { className: 'finance44-list' },
          movements.length === 0 ? h('div', { className: 'finance44-empty' }, 'Nenhuma movimentação neste período.') : movements.map(item => h('div', { key: item.id, className: 'finance44-row finance44-movement-row' },
            h('div', { className: `finance44-direction ${item.type === 'income' ? 'is-income' : 'is-expense'}` }, item.type === 'income' ? h(ArrowUp, { size: 17 }) : h(ArrowDown, { size: 17 })),
            h('div', { className: 'finance44-main' }, h('strong', null, item.description), h('span', null, `${formatDate(item.date)} · ${item.detail || ''}`)),
            h('strong', { className: item.type === 'income' ? 'finance44-value is-income' : 'finance44-value is-expense' }, `${item.type === 'income' ? '+' : '-'} ${formatCurrency(item.amount)}`),
            item.source === 'manual' ? h('button', { className: 'finance44-icon-action is-danger', onClick: () => deleteManual('entry', item.manualId), title: 'Excluir' }, h(Trash2, { size: 16 })) : h('span', { className: 'finance44-source' }, item.source === 'sale' ? 'Venda' : item.source === 'stock' ? 'Estoque' : 'Conta')
          )))
      : h('div', { className: 'finance44-list' },
          filteredAccounts.length === 0 ? h('div', { className: 'finance44-empty' }, 'Nenhuma conta encontrada.') : filteredAccounts.map(item => h('div', { key: item.id, className: 'finance44-row finance44-account-row' },
            h('div', { className: 'finance44-main' }, h('strong', null, item.description), h('span', null, `${item.party || (item.source === 'sale' ? 'Venda a prazo' : 'Automático')} · Venc. ${formatDate(item.dueDate)}`)),
            h('span', { className: `finance44-status ${item.status.cls}` }, item.status.label),
            h('strong', { className: 'finance44-account-value' }, formatCurrency(item.value)),
            h('div', { className: 'finance44-actions' },
              item.source === 'sale' ? h('button', { onClick: () => onOpenSale?.(item.sale), className: 'finance44-action' }, 'Abrir venda')
              : item.source === 'stock' ? h('button', { onClick: () => toggleStockPayable(item), className: item.paid ? 'finance44-action is-secondary' : 'finance44-action is-primary' }, item.paid ? 'Reabrir' : 'Marcar paga')
              : h(React.Fragment, null,
                  h('button', { onClick: () => toggleManualAccount(item), className: item.paid ? 'finance44-action is-secondary' : 'finance44-action is-primary' }, item.paid ? 'Reabrir' : (tab === 'receivable' ? 'Marcar recebida' : 'Marcar paga')),
                  h('button', { onClick: () => deleteManual('account', item.id), className: 'finance44-icon-action is-danger', title: 'Excluir' }, h(Trash2, { size: 16 }))
                )
            )
          )))
    ),
    h(FormModal, { open: !!modalKind, kind: modalKind, onClose: () => setModalKind(null), onSave: saveManual })
  );
};
