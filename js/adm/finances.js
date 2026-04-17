import {
  React, useState, useEffect, useMemo,
  Wallet, PieChart, BarChart3, ArrowUpRight, ArrowDownRight, Receipt, CreditCard, Calendar, Banknote, PlusCircle, Edit2, Trash2, X, CheckCircle, Search, Tag,
  db, APP_ID,
  collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp
} from '../core.js';

import {
  formatCurrency,
  parseMoney,
  formatDate,
  formatDateTime,
  getBrazilDateString,
  getCurrentMonthStart,
  getCurrentMonthEnd,
  toDateFromFirestoreValue,
  resolveSaleHistoryDate,
  resolveCanceledSaleHistoryDate
} from './utils.js';
import { MoneyInput, Pagination, DateRangeFilter, ConfirmModal } from './ui.js';

const h = React.createElement;
const MANUAL_ENTRY_OPTIONS = {
  entrada: [
    { value: 'aporte', label: 'Aporte / Capital' },
    { value: 'receita_extra', label: 'Receita Extra' },
    { value: 'ajuste_entrada', label: 'Ajuste Positivo' },
    { value: 'reembolso', label: 'Reembolso Recebido' },
    { value: 'outros', label: 'Outros' }
  ],
  saida: [
    { value: 'despesa_operacional', label: 'Despesa Operacional' },
    { value: 'retirada', label: 'Retirada / Pró-labore' },
    { value: 'investimento', label: 'Investimento' },
    { value: 'imposto', label: 'Impostos / Tarifas' },
    { value: 'taxa', label: 'Taxa / Tarifa' },
    { value: 'ajuste_saida', label: 'Ajuste Negativo' },
    { value: 'outros', label: 'Outros' }
  ]
};

const MOVEMENT_LABELS = {
  venda_direta: 'Venda à vista',
  entrada_venda: 'Entrada da venda',
  pagamento_parcela: 'Recebimento de parcela',
  taxa_cartao: 'Taxa da administradora',
  estorno_cancelamento: 'Estorno por cancelamento',
  aporte: 'Aporte / Capital',
  receita_extra: 'Receita Extra',
  ajuste_entrada: 'Ajuste Positivo',
  reembolso: 'Reembolso Recebido',
  despesa_operacional: 'Despesa Operacional',
  retirada: 'Retirada / Pró-labore',
  investimento: 'Investimento',
  imposto: 'Impostos / Tarifas',
  taxa: 'Taxa / Tarifa',
  ajuste_saida: 'Ajuste Negativo',
  outros: 'Outros'
};

const getPaymentMethodLabel = sale => {
  if (sale.paymentMethod === 'pix') return 'PIX';
  if (sale.paymentMethod === 'money') return 'Dinheiro';
  if (sale.paymentMethod === 'debit') return 'Débito';
  if (sale.paymentMethod === 'credit') return `Crédito${sale.cardInstallments ? ` ${sale.cardInstallments}x` : ''}`;
  return sale.saleType === 'prazo' ? 'A prazo' : 'Venda';
};

const ensureIso = (value, fallbackTime = '12:00:00') => {
  if (!value) return new Date().toISOString();
  if (String(value).includes('T')) return value;
  return `${value}T${fallbackTime}`;
};

const getDateKeyFromValue = value => {
  const date = toDateFromFirestoreValue(value);
  if (date) return date.toISOString().split('T')[0];
  if (!value) return '';
  return String(value).split('T')[0];
};

const normalizeHistoryIso = value => {
  if (!value) return new Date().toISOString();
  const date = toDateFromFirestoreValue(value);
  if (date) return date.toISOString();
  return ensureIso(value);
};

const buildSaleCashMovements = sale => {
  const movements = [];
  const customerName = sale.customerName || 'Cliente';
  const saleDateKey = sale.saleDate || getDateKeyFromValue(sale.createdAt) || getBrazilDateString();
  const saleOccurredAt = resolveSaleHistoryDate(sale);
  const paymentLabel = getPaymentMethodLabel(sale);
  const pushMovement = payload => {
    if (!payload.amount || payload.amount <= 0) return;
    movements.push({
      source: 'sale',
      saleId: sale.id,
      customerName,
      ...payload
    });
  };

  if (sale.saleType === 'direct') {
    pushMovement({
      id: `sale-direct-${sale.id}`,
      direction: 'entrada',
      movementType: 'venda_direta',
      amount: Number(sale.totalPrice) || 0,
      dateKey: saleDateKey,
      occurredAt: saleOccurredAt,
      title: `Venda à vista • ${customerName}`,
      notes: paymentLabel,
      sourceLabel: 'Venda'
    });
  } else {
    if ((sale.entryAmount || 0) > 0) {
      pushMovement({
        id: `sale-entry-${sale.id}`,
        direction: 'entrada',
        movementType: 'entrada_venda',
        amount: Number(sale.entryAmount) || 0,
        dateKey: saleDateKey,
        occurredAt: saleOccurredAt,
        title: `Entrada da venda • ${customerName}`,
        notes: 'Entrada inicial',
        sourceLabel: 'Venda'
      });
    }

    (sale.installments || []).forEach((installment, index) => {
      const history = Array.isArray(installment.history) ? installment.history : [];
      const validHistory = history.filter(item => item && item.type !== 'abatement' && (Number(item.amount) || 0) > 0);
      if (validHistory.length > 0) {
        validHistory.forEach((item, historyIndex) => {
          const occurredAt = normalizeHistoryIso(item.date || installment.paidAt || installment.dueDate || saleDateKey);
          pushMovement({
            id: `sale-installment-${sale.id}-${index}-${historyIndex}`,
            direction: 'entrada',
            movementType: 'pagamento_parcela',
            amount: Number(item.amount) || 0,
            dateKey: occurredAt.split('T')[0],
            occurredAt,
            title: `Parcela recebida • ${customerName}`,
            notes: `Parcela ${installment.number || index + 1}`,
            sourceLabel: 'Venda'
          });
        });
      } else if (installment.paid && (Number(installment.originalAmount) || Number(installment.amount) || 0) > 0) {
        const occurredAt = normalizeHistoryIso(installment.paidAt || installment.dueDate || saleDateKey);
        pushMovement({
          id: `sale-installment-${sale.id}-${index}`,
          direction: 'entrada',
          movementType: 'pagamento_parcela',
          amount: Number(installment.originalAmount) || Number(installment.amount) || 0,
          dateKey: occurredAt.split('T')[0],
          occurredAt,
          title: `Parcela recebida • ${customerName}`,
          notes: `Parcela ${installment.number || index + 1}`,
          sourceLabel: 'Venda'
        });
      }
    });
  }

  if ((sale.feeConfig?.value || 0) > 0) {
    pushMovement({
      id: `sale-fee-${sale.id}`,
      direction: 'saida',
      movementType: 'taxa_cartao',
      amount: Number(sale.feeConfig?.value) || 0,
      dateKey: saleDateKey,
      occurredAt: saleOccurredAt,
      title: `Taxa da operadora • ${customerName}`,
      notes: paymentLabel,
      sourceLabel: 'Taxa'
    });
  }

  if (sale.status === 'canceled') {
    const receivedAmount = movements.filter(item => item.direction === 'entrada').reduce((sum, item) => sum + item.amount, 0);
    if (receivedAmount > 0) {
      const canceledAt = resolveCanceledSaleHistoryDate(sale);
      movements.push({
        id: `sale-cancel-${sale.id}`,
        source: 'sale',
        saleId: sale.id,
        customerName,
        direction: 'saida',
        movementType: 'estorno_cancelamento',
        amount: receivedAmount,
        dateKey: canceledAt.split('T')[0],
        occurredAt: canceledAt,
        title: `Estorno venda cancelada • ${customerName}`,
        notes: sale.cancelReason || 'Reversão do valor que já havia entrado no caixa',
        sourceLabel: 'Cancelamento'
      });
    }
  }

  return movements;
};

const ManualEntryModal = ({ isOpen, onClose, onSave, initialData }) => {
  const [direction, setDirection] = useState('entrada');
  const [movementType, setMovementType] = useState('aporte');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [movementDate, setMovementDate] = useState(getBrazilDateString());
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setDirection(initialData.direction || 'entrada');
      setMovementType(initialData.movementType || (initialData.direction === 'saida' ? 'despesa_operacional' : 'aporte'));
      setReason(initialData.reason || '');
      setAmount(typeof initialData.amount === 'number' ? initialData.amount : '');
      setMovementDate(initialData.movementDate || getBrazilDateString());
      setNotes(initialData.notes || '');
    } else {
      setDirection('entrada');
      setMovementType('aporte');
      setReason('');
      setAmount('');
      setMovementDate(getBrazilDateString());
      setNotes('');
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    const options = MANUAL_ENTRY_OPTIONS[direction] || [];
    if (!options.find(item => item.value === movementType)) {
      setMovementType(options[0]?.value || 'outros');
    }
  }, [direction]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const parsedAmount = parseMoney(amount);
    if (!reason.trim()) return alert('Informe o motivo / descrição do lançamento.');
    if (parsedAmount <= 0) return alert('Informe um valor válido maior que zero.');
    if (!movementDate) return alert('Informe a data do lançamento.');
    onSave({
      direction,
      movementType,
      reason: reason.trim(),
      amount: parsedAmount,
      movementDate,
      notes: notes.trim()
    });
  };

  return h('div', { className: 'fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[95] backdrop-blur-sm' },
    h('div', { className: 'bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-hidden shadow-2xl animate-fade-in flex flex-col' },
      h('div', { className: 'p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50' },
        h('div', null,
          h('h3', { className: 'font-bold text-lg text-slate-800' }, initialData ? 'Editar Lançamento' : 'Novo Lançamento Manual'),
          h('p', { className: 'text-xs text-slate-500' }, 'Entradas e saídas manuais do financeiro')
        ),
        h('button', { onClick: onClose, className: 'p-2 hover:bg-slate-200 rounded-full' }, h(X, { size: 20 }))
      ),
      h('div', { className: 'p-5 space-y-4 overflow-y-auto' },
        h('div', { className: 'grid grid-cols-2 gap-3' },
          h('button', {
            type: 'button',
            onClick: () => setDirection('entrada'),
            className: `p-3 rounded-xl border font-bold text-sm transition-colors ${direction === 'entrada' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`
          }, 'Entrada'),
          h('button', {
            type: 'button',
            onClick: () => setDirection('saida'),
            className: `p-3 rounded-xl border font-bold text-sm transition-colors ${direction === 'saida' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`
          }, 'Saída')
        ),
        h('div', null,
          h('label', { className: 'block text-[10px] font-bold text-slate-500 uppercase mb-1' }, 'Tipo de Movimentação *'),
          h('select', {
            className: 'w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 bg-white',
            value: movementType,
            onChange: e => setMovementType(e.target.value)
          },
            (MANUAL_ENTRY_OPTIONS[direction] || []).map(option => h('option', { key: option.value, value: option.value }, option.label))
          )
        ),
        h('div', null,
          h('label', { className: 'block text-[10px] font-bold text-slate-500 uppercase mb-1' }, 'Motivo / Descrição *'),
          h('input', {
            type: 'text',
            className: 'w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 text-sm',
            value: reason,
            onChange: e => setReason(e.target.value),
            placeholder: 'Ex.: Conta de energia, aporte, retirada...'
          })
        ),
        h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' },
          h('div', null,
            h('label', { className: 'block text-[10px] font-bold text-slate-500 uppercase mb-1' }, 'Valor *'),
            h(MoneyInput, {
              value: amount,
              onChange: setAmount,
              className: 'w-full p-3 pl-8 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 text-sm font-bold'
            })
          ),
          h('div', null,
            h('label', { className: 'block text-[10px] font-bold text-slate-500 uppercase mb-1' }, 'Data do Lançamento *'),
            h('input', {
              type: 'date',
              className: 'w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 text-sm',
              value: movementDate,
              onChange: e => setMovementDate(e.target.value)
            })
          )
        ),
        h('div', null,
          h('label', { className: 'block text-[10px] font-bold text-slate-500 uppercase mb-1' }, 'Observações'),
          h('textarea', {
            rows: 3,
            className: 'w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 text-sm resize-none',
            value: notes,
            onChange: e => setNotes(e.target.value),
            placeholder: 'Complementos opcionais do lançamento'
          })
        )
      ),
      h('div', { className: 'p-4 border-t border-slate-100 flex gap-3 bg-white' },
        h('button', {
          onClick: onClose,
          className: 'flex-1 p-3 text-slate-500 font-bold bg-slate-100 rounded-xl hover:bg-slate-200'
        }, 'Cancelar'),
        h('button', {
          onClick: handleSubmit,
          className: `flex-1 p-3 text-white font-bold rounded-xl shadow-lg ${direction === 'entrada' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' : 'bg-red-500 hover:bg-red-600 shadow-red-200'}`
        }, initialData ? 'Salvar Alterações' : 'Registrar Lançamento')
      )
    )
  );
};

const FinanceView = ({ user, sales, openManualEntryToken = 0 }) => {
  const [manualEntries, setManualEntries] = useState([]);
  const [entryModalData, setEntryModalData] = useState({ open: false, data: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState(getCurrentMonthStart());
  const [endDate, setEndDate] = useState(getCurrentMonthEnd());
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    const financialQuery = query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'finance_entries'));
    const unsub = onSnapshot(financialQuery, snapshot => {
      setManualEntries(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    });
    return () => unsub();
  }, [user.uid]);

  useEffect(() => {
    if (period === 'month') {
      setStartDate(getCurrentMonthStart());
      setEndDate(getCurrentMonthEnd());
    }
  }, [period]);

  useEffect(() => {
    if (openManualEntryToken > 0) {
      setEntryModalData({ open: true, data: null });
    }
  }, [openManualEntryToken]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, period, startDate, endDate]);

  const saleMovements = useMemo(() => sales.flatMap(buildSaleCashMovements), [sales]);

  const manualMovements = useMemo(() => manualEntries.map(entry => {
    const occurredAt = ensureIso(entry.movementDate || getDateKeyFromValue(entry.createdAt) || getBrazilDateString());
    return {
      id: `manual-${entry.id}`,
      source: 'manual',
      entryId: entry.id,
      direction: entry.direction || 'entrada',
      movementType: entry.movementType || 'outros',
      amount: Number(entry.amount) || 0,
      dateKey: (entry.movementDate || occurredAt.split('T')[0]),
      occurredAt,
      title: entry.reason || MOVEMENT_LABELS[entry.movementType] || 'Lançamento manual',
      notes: entry.notes || '',
      sourceLabel: 'Manual'
    };
  }), [manualEntries]);

  const allMovements = useMemo(() => [...saleMovements, ...manualMovements].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)), [saleMovements, manualMovements]);

  const movementMatchesPeriod = movement => {
    const dateKey = movement.dateKey || movement.occurredAt?.split('T')[0] || '';
    return dateKey >= startDate && dateKey <= endDate;
  };

  const filteredMovements = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return allMovements.filter(item => {
      if (!movementMatchesPeriod(item)) return false;
      if (!search) return true;
      return [
        item.title,
        item.notes,
        item.customerName,
        MOVEMENT_LABELS[item.movementType],
        item.sourceLabel
      ].filter(Boolean).some(value => String(value).toLowerCase().includes(search));
    });
  }, [allMovements, searchTerm, startDate, endDate]);

  const paginatedMovements = filteredMovements.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const metrics = useMemo(() => {
    const periodMovements = allMovements.filter(movementMatchesPeriod);
    const totalEntradas = periodMovements.filter(item => item.direction === 'entrada').reduce((sum, item) => sum + item.amount, 0);
    const totalSaidas = periodMovements.filter(item => item.direction === 'saida').reduce((sum, item) => sum + item.amount, 0);
    const saldoOperacional = totalEntradas - totalSaidas;
    const cardFees = periodMovements.filter(item => item.movementType === 'taxa_cartao').reduce((sum, item) => sum + item.amount, 0);
    const cancelReversals = periodMovements.filter(item => item.movementType === 'estorno_cancelamento').reduce((sum, item) => sum + item.amount, 0);
    const manualIn = periodMovements.filter(item => item.source === 'manual' && item.direction === 'entrada').reduce((sum, item) => sum + item.amount, 0);
    const manualOut = periodMovements.filter(item => item.source === 'manual' && item.direction === 'saida').reduce((sum, item) => sum + item.amount, 0);
    const activePeriodSales = sales.filter(sale => {
      const saleDate = sale.saleDate || getDateKeyFromValue(sale.createdAt) || '';
      return saleDate >= startDate && saleDate <= endDate && sale.status !== 'canceled';
    });
    const productCost = activePeriodSales.reduce((sum, sale) => sum + (Number(sale.totalCost) || 0), 0);
    const estimatedProfit = activePeriodSales.reduce((sum, sale) => sum + ((Number(sale.totalPrice) || 0) - (Number(sale.totalCost) || 0) - (Number(sale.feeConfig?.value) || 0)), 0);
    const netProfit = saldoOperacional - productCost;
    return {
      totalEntradas,
      totalSaidas,
      saldoOperacional,
      cardFees,
      cancelReversals,
      manualIn,
      manualOut,
      productCost,
      estimatedProfit,
      netProfit,
      movementsCount: periodMovements.length
    };
  }, [allMovements, sales, startDate, endDate]);

  const handleSaveManualEntry = async payload => {
    if (entryModalData.data?.id) {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'finance_entries', entryModalData.data.id), {
        ...payload,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'finance_entries'), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    setEntryModalData({ open: false, data: null });
  };

  const confirmDelete = async () => {
    if (!deleteModal.id) return;
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'finance_entries', deleteModal.id));
    setDeleteModal({ open: false, id: null });
  };

  const summaryCards = [
    {
      key: 'entradas',
      title: 'Entradas',
      value: metrics.totalEntradas,
      tone: 'emerald',
      icon: ArrowUpRight,
      helper: 'Recebimentos de vendas e lançamentos positivos'
    },
    {
      key: 'saidas',
      title: 'Saídas',
      value: metrics.totalSaidas,
      tone: 'red',
      icon: ArrowDownRight,
      helper: 'Despesas, taxas, ajustes e estornos'
    },
    {
      key: 'saldo',
      title: 'Saldo operacional',
      value: metrics.saldoOperacional,
      tone: metrics.saldoOperacional >= 0 ? 'blue' : 'amber',
      icon: Wallet,
      helper: 'Entradas menos saídas do período'
    },
    {
      key: 'custos',
      title: 'Custo dos produtos',
      value: metrics.productCost,
      tone: 'slate',
      icon: Receipt,
      helper: 'CMV analítico das vendas ativas do período'
    },
    {
      key: 'taxas',
      title: 'Taxas do cartão',
      value: metrics.cardFees,
      tone: 'orange',
      icon: CreditCard,
      helper: 'Já incluídas nas saídas do caixa'
    },
    {
      key: 'estimado',
      title: 'Lucro estimado',
      value: metrics.estimatedProfit,
      tone: metrics.estimatedProfit >= 0 ? 'emerald' : 'red',
      icon: PieChart,
      helper: 'Venda - custo do produto - taxa do cartão'
    },
    {
      key: 'liquido',
      title: 'Lucro líquido',
      value: metrics.netProfit,
      tone: metrics.netProfit >= 0 ? 'emerald' : 'red',
      icon: BarChart3,
      helper: 'Saldo operacional menos custo dos produtos'
    },
    {
      key: 'canceladas',
      title: 'Estornos por cancelamento',
      value: metrics.cancelReversals,
      tone: 'amber',
      icon: Calendar,
      helper: 'Valor negativo devolvido ao caixa em vendas canceladas'
    }
  ];

  const getCardClasses = tone => {
    if (tone === 'emerald') return 'bg-emerald-50 border-emerald-100 text-emerald-700';
    if (tone === 'red') return 'bg-red-50 border-red-100 text-red-700';
    if (tone === 'blue') return 'bg-blue-50 border-blue-100 text-blue-700';
    if (tone === 'orange') return 'bg-orange-50 border-orange-100 text-orange-700';
    if (tone === 'amber') return 'bg-amber-50 border-amber-100 text-amber-700';
    return 'bg-slate-50 border-slate-100 text-slate-700';
  };

  const getMovementClasses = item => {
    if (item.direction === 'entrada') {
      return {
        badge: 'bg-emerald-100 text-emerald-700',
        amount: 'text-emerald-600',
        icon: ArrowUpRight
      };
    }
    return {
      badge: item.movementType === 'estorno_cancelamento' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700',
      amount: item.movementType === 'estorno_cancelamento' ? 'text-amber-600' : 'text-red-600',
      icon: ArrowDownRight
    };
  };

  return h('div', { className: 'animate-fade-in space-y-4' },
    h(DateRangeFilter, {
      period,
      startDate,
      endDate,
      onPeriodChange: setPeriod,
      onStartChange: setStartDate,
      onEndChange: setEndDate
    }),
    h('div', { className: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4' },
      summaryCards.map(card => {
        const Icon = card.icon;
        return h('div', { key: card.key, className: `rounded-2xl border p-4 shadow-sm ${getCardClasses(card.tone)}` },
          h('div', { className: 'flex items-start justify-between gap-3' },
            h('div', null,
              h('p', { className: 'text-[11px] uppercase font-bold opacity-80 mb-1' }, card.title),
              h('p', { className: 'text-2xl font-black leading-tight' }, formatCurrency(card.value)),
              h('p', { className: 'text-xs mt-2 opacity-80 leading-relaxed' }, card.helper)
            ),
            h('div', { className: 'w-11 h-11 rounded-2xl bg-white/70 flex items-center justify-center shadow-sm' },
              h(Icon, { size: 20 })
            )
          )
        );
      })
    ),
    h('div', { className: 'grid grid-cols-1 lg:grid-cols-3 gap-4' },
      h('div', { className: 'bg-white rounded-2xl border border-slate-100 shadow-sm p-4 lg:col-span-2' },
        h('div', { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4' },
          h('div', null,
            h('h3', { className: 'font-bold text-slate-800 text-lg flex items-center gap-2' }, h(Wallet, { size: 18, className: 'text-yellow-500' }), 'Movimentações Financeiras'),
            h('p', { className: 'text-sm text-slate-500' }, `${metrics.movementsCount} lançamento(s) no período selecionado`)
          ),
          h('button', {
            onClick: () => setEntryModalData({ open: true, data: null }),
            className: 'inline-flex items-center justify-center gap-2 px-4 py-3 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold rounded-xl shadow-lg shadow-yellow-200 transition-transform active:scale-[0.99]'
          }, h(PlusCircle, { size: 18 }), 'Novo Lançamento')
        ),
        h('div', { className: 'flex gap-2 mb-4' },
          h('div', { className: 'relative flex-1' },
            h(Search, { size: 18, className: 'absolute left-3 top-3.5 text-slate-400' }),
            h('input', {
              className: 'w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none shadow-sm',
              placeholder: 'Buscar por cliente, motivo, tipo ou observação...',
              value: searchTerm,
              onChange: e => setSearchTerm(e.target.value)
            })
          )
        ),
        h('div', { className: 'space-y-3' },
          paginatedMovements.map(item => {
            const style = getMovementClasses(item);
            const Icon = style.icon;
            return h('div', { key: item.id, className: 'rounded-2xl border border-slate-100 bg-slate-50/70 p-4' },
              h('div', { className: 'flex items-start justify-between gap-3' },
                h('div', { className: 'flex items-start gap-3 min-w-0' },
                  h('div', { className: `w-11 h-11 rounded-2xl flex items-center justify-center ${style.badge}` }, h(Icon, { size: 20 })),
                  h('div', { className: 'min-w-0' },
                    h('div', { className: 'flex flex-wrap items-center gap-2 mb-1' },
                      h('h4', { className: 'font-bold text-slate-800 truncate' }, item.title),
                      h('span', { className: `text-[10px] font-bold px-2 py-1 rounded-full uppercase ${style.badge}` }, item.direction === 'entrada' ? 'Entrada' : 'Saída'),
                      h('span', { className: 'text-[10px] font-bold px-2 py-1 rounded-full uppercase bg-slate-200 text-slate-600' }, MOVEMENT_LABELS[item.movementType] || 'Movimentação')
                    ),
                    h('p', { className: 'text-xs text-slate-500 flex flex-wrap items-center gap-2' },
                      h('span', { className: 'inline-flex items-center gap-1' }, h(Calendar, { size: 12 }), formatDateTime(item.occurredAt)),
                      h('span', { className: 'inline-flex items-center gap-1' }, h(Tag, { size: 12 }), item.sourceLabel || (item.source === 'manual' ? 'Manual' : 'Venda'))
                    ),
                    item.notes && h('p', { className: 'text-sm text-slate-500 mt-2 leading-relaxed' }, item.notes)
                  )
                ),
                h('div', { className: 'text-right shrink-0 flex flex-col items-end gap-2' },
                  h('span', { className: `text-lg font-black ${style.amount}` }, `${item.direction === 'entrada' ? '+' : '-'} ${formatCurrency(item.amount)}`),
                  item.source === 'manual' && h('div', { className: 'flex items-center gap-1' },
                    h('button', {
                      onClick: () => {
                        const original = manualEntries.find(entry => entry.id === item.entryId);
                        if (original) setEntryModalData({ open: true, data: original });
                      },
                      className: 'p-2 rounded-lg text-slate-400 hover:text-yellow-600 hover:bg-yellow-50'
                    }, h(Edit2, { size: 16 })),
                    h('button', {
                      onClick: () => setDeleteModal({ open: true, id: item.entryId }),
                      className: 'p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50'
                    }, h(Trash2, { size: 16 }))
                  )
                )
              )
            );
          }),
          filteredMovements.length === 0 && h('div', { className: 'text-center py-12 text-slate-400' },
            h(Banknote, { size: 28, className: 'mx-auto mb-3 text-slate-300' }),
            h('p', { className: 'font-medium' }, 'Nenhuma movimentação encontrada para esse período.'),
            h('p', { className: 'text-sm mt-1' }, 'Ajuste os filtros ou adicione um lançamento manual.')
          )
        ),
        h(Pagination, {
          totalItems: filteredMovements.length,
          itemsPerPage: ITEMS_PER_PAGE,
          currentPage: page,
          onPageChange: setPage
        })
      ),
      h('div', { className: 'space-y-4' },
        h('div', { className: 'bg-white rounded-2xl border border-slate-100 shadow-sm p-4' },
          h('h3', { className: 'font-bold text-slate-800 text-lg mb-3 flex items-center gap-2' }, h(CheckCircle, { size: 18, className: 'text-emerald-500' }), 'Resumo Analítico'),
          h('div', { className: 'space-y-3 text-sm' },
            h('div', { className: 'flex items-center justify-between gap-3' }, h('span', { className: 'text-slate-500' }, 'Entradas manuais'), h('strong', { className: 'text-emerald-600' }, formatCurrency(metrics.manualIn))),
            h('div', { className: 'flex items-center justify-between gap-3' }, h('span', { className: 'text-slate-500' }, 'Saídas manuais'), h('strong', { className: 'text-red-600' }, formatCurrency(metrics.manualOut))),
            h('div', { className: 'flex items-center justify-between gap-3' }, h('span', { className: 'text-slate-500' }, 'Taxas de cartão'), h('strong', { className: 'text-orange-600' }, formatCurrency(metrics.cardFees))),
            h('div', { className: 'flex items-center justify-between gap-3' }, h('span', { className: 'text-slate-500' }, 'Estornos de cancelamento'), h('strong', { className: 'text-amber-600' }, formatCurrency(metrics.cancelReversals))),
            h('div', { className: 'pt-3 border-t border-slate-100 flex items-center justify-between gap-3' }, h('span', { className: 'font-bold text-slate-700' }, 'Lucro líquido do período'), h('strong', { className: metrics.netProfit >= 0 ? 'text-emerald-600 text-base' : 'text-red-600 text-base' }, formatCurrency(metrics.netProfit)))
          )
        ),
        h('div', { className: 'bg-slate-900 text-white rounded-2xl shadow-sm p-4' },
          h('h3', { className: 'font-bold text-lg mb-2 flex items-center gap-2' }, h(Receipt, { size: 18, className: 'text-yellow-400' }), 'Regras aplicadas'),
          h('ul', { className: 'space-y-2 text-sm text-slate-300 leading-relaxed' },
            h('li', null, '• Vendas canceladas geram um lançamento negativo na data do cancelamento, preservando a entrada original.'),
            h('li', null, '• Taxas da administradora do cartão entram como saída separada.'),
            h('li', null, '• Custo dos produtos é mostrado como métrica analítica e compõe o lucro líquido.'),
            h('li', null, '• Entradas e saídas manuais entram no caixa e respeitam filtros e paginação.')
          )
        )
      )
    ),
    h(ManualEntryModal, {
      isOpen: entryModalData.open,
      onClose: () => setEntryModalData({ open: false, data: null }),
      onSave: handleSaveManualEntry,
      initialData: entryModalData.data
    }),
    h(ConfirmModal, {
      isOpen: deleteModal.open,
      title: 'Excluir lançamento manual?',
      message: 'Esse lançamento será removido definitivamente do financeiro.',
      onClose: () => setDeleteModal({ open: false, id: null }),
      onConfirm: confirmDelete
    })
  );
};

export { FinanceView };
