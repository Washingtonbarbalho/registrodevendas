import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.2.0';
import { createPortal } from 'https://esm.sh/react-dom@18.2.0';
import { CalendarDays, CreditCard, Package, Search, Trash2, X } from 'https://esm.sh/lucide-react@0.292.0';
import { db, APP_ID } from './firebase-config.js?v=86';
import { doc, runTransaction } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { MoneyInput } from './components.js';
import { formatCurrency, getBrazilDateString, maskMoney, parseMoney } from './utils.js';
import { buildPaymentInstallments, clampInstallments, money } from './purchase-payment-v68.js';

const h = React.createElement;
const PAYMENT_OPTIONS = [
  { value: 'money', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'debit', label: 'Cartão de débito' },
  { value: 'credit', label: 'Cartão de crédito' },
  { value: 'term', label: 'Compra a prazo' }
];
const MOVEMENT_OPTIONS = [
  { value: 'compra', label: 'Compra de mercadoria', group: 'Entrada' },
  { value: 'ajuste_entrada', label: 'Ajuste de entrada', group: 'Entrada' },
  { value: 'ajuste_saida', label: 'Ajuste de saída', group: 'Saída' },
  { value: 'avaria', label: 'Avaria / perda / vencido', group: 'Saída' }
];
const makeBatchId = () => `stock-batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const BatchStockModal = ({ isOpen, onClose, products = [], userId, onSuccess }) => {
  const [type, setType] = useState('compra');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState('1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setType('compra');
    setSearch('');
    setRows([]);
    setNotes('');
    setPaymentMethod('pix');
    setPaymentDueDate('');
    setInstallmentsCount('1');
    setSaving(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isOpen]);

  const isPurchase = type === 'compra';
  const isEntry = type === 'compra' || type === 'ajuste_entrada';
  const isDeferred = isPurchase && (paymentMethod === 'credit' || paymentMethod === 'term');
  const selectedIds = useMemo(() => new Set(rows.map(row => row.productId)), [rows]);
  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...products]
      .filter(product => !selectedIds.has(product.id))
      .filter(product => !term || String(product.name || '').toLowerCase().includes(term) || String(product.code || '').toLowerCase().includes(term))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' }))
      .slice(0, 8);
  }, [products, search, selectedIds]);

  const batchTotal = useMemo(() => isPurchase
    ? money(rows.reduce((sum, row) => sum + (Math.max(0, parseInt(row.quantity, 10) || 0) * Math.max(0, parseMoney(row.unitCost) || 0)), 0))
    : 0, [rows, isPurchase]);

  const installmentPlan = useMemo(() => isDeferred && paymentDueDate
    ? buildPaymentInstallments(batchTotal, installmentsCount, paymentDueDate)
    : [], [isDeferred, paymentDueDate, installmentsCount, batchTotal]);

  const addProduct = product => {
    setRows(current => [...current, {
      productId: product.id,
      name: product.name || 'Produto',
      code: product.code || '',
      currentQty: Number(product.quantity) || 0,
      quantity: '',
      unitCost: maskMoney(((Number(product.costPrice) || 0) * 100).toFixed(0))
    }]);
    setSearch('');
  };

  const updateRow = (productId, patch) => setRows(current => current.map(row => row.productId === productId ? { ...row, ...patch } : row));
  const removeRow = productId => setRows(current => current.filter(row => row.productId !== productId));

  const handleTypeChange = value => {
    setType(value);
    if (value !== 'compra') {
      setPaymentMethod('pix');
      setPaymentDueDate('');
      setInstallmentsCount('1');
    }
  };

  const handlePaymentMethodChange = value => {
    setPaymentMethod(value);
    if (!['credit', 'term'].includes(value)) {
      setPaymentDueDate('');
      setInstallmentsCount('1');
    }
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (!userId) return alert('Usuário não identificado.');
    if (rows.length === 0) return alert('Adicione pelo menos um produto à movimentação.');

    for (const row of rows) {
      const quantity = Math.max(0, parseInt(row.quantity, 10) || 0);
      if (quantity <= 0) return alert(`Informe uma quantidade válida para ${row.name}.`);
      if (isPurchase && !(parseMoney(row.unitCost) > 0)) return alert(`Informe o custo unitário de ${row.name}.`);
    }

    if (isDeferred && !paymentDueDate) return alert('Informe o vencimento da primeira parcela.');

    const count = isDeferred ? clampInstallments(installmentsCount) : 1;
    if (isDeferred && installmentPlan.length !== count) return alert('Não foi possível montar o parcelamento. Revise o vencimento e a quantidade de parcelas.');

    setSaving(true);
    try {
      const batchId = makeBatchId();
      const movementDate = new Date().toISOString();
      const computed = await runTransaction(db, async transaction => {
        const references = rows.map(row => doc(db, 'artifacts', APP_ID, 'users', userId, 'products', row.productId));
        const productSnapshots = await Promise.all(references.map(reference => transaction.get(reference)));
        const updates = productSnapshots.map((snapshot, index) => {
          const row = rows[index];
          if (!snapshot.exists()) throw new Error(`O produto ${row.name} não foi encontrado.`);
          const product = snapshot.data();
          const currentQty = Math.max(0, parseInt(product.quantity, 10) || 0);
          const currentCost = Math.max(0, Number(product.costPrice) || 0);
          const quantity = Math.max(0, parseInt(row.quantity, 10) || 0);
          const unitCost = isPurchase ? Math.max(0, parseMoney(row.unitCost) || 0) : 0;
          if (!isEntry && quantity > currentQty) throw new Error(`${row.name}: estoque disponível é ${currentQty} un.`);

          const newQty = isEntry ? currentQty + quantity : currentQty - quantity;
          let newCost = currentCost;
          if (isPurchase && quantity > 0 && newQty > 0) {
            newCost = ((currentQty * currentCost) + (quantity * unitCost)) / newQty;
          }

          const deferred = isPurchase && (paymentMethod === 'credit' || paymentMethod === 'term');
          const financialInstallments = deferred ? installmentPlan.map(item => ({ ...item })) : [];
          const movement = {
            id: `${batchId}-${index + 1}`,
            batchId,
            batchIndex: index,
            batchItemCount: rows.length,
            batchTotal: isPurchase ? batchTotal : 0,
            type,
            quantity,
            unitCost,
            date: movementDate,
            previousQty: currentQty,
            newQty,
            notes: notes.trim(),
            paymentMethod: isPurchase ? paymentMethod : null,
            paymentDueDate: deferred ? paymentDueDate : null,
            paymentFirstDueDate: deferred ? paymentDueDate : null,
            paymentInstallmentsCount: deferred ? count : 1,
            financialInstallments,
            financialPaid: isPurchase ? !deferred : null,
            financialPaidAt: isPurchase && !deferred ? movementDate.split('T')[0] : null,
            financialPaidAtDateTime: isPurchase && !deferred ? movementDate : null
          };
          const movements = Array.isArray(product.movements) ? [...product.movements, movement] : [movement];
          return { reference: references[index], update: { quantity: newQty, costPrice: newCost, movements }, result: { row, quantity, unitCost, newQty } };
        });

        updates.forEach(item => transaction.update(item.reference, item.update));
        return updates.map(item => item.result);
      });

      onSuccess?.({ batchId, type, itemCount: rows.length, total: batchTotal, paymentMethod, installmentsCount: count, items: computed });
      onClose?.();
    } catch (error) {
      console.error('Erro ao salvar movimentação em lote:', error);
      alert(error?.message || 'Não foi possível concluir a movimentação em lote.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(h('div', { className: 'batch67-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Movimentar estoque em lote' },
    h('div', { className: 'batch67-panel' },
      h('header', { className: 'batch67-header' },
        h('div', null, h('h2', null, 'Movimentar estoque em lote'), h('p', null, 'Registre vários produtos em uma única operação.')),
        h('button', { type: 'button', onClick: onClose, className: 'batch67-close', 'aria-label': 'Fechar' }, h(X, { size: 20 }))
      ),
      h('div', { className: 'batch67-body' },
        h('section', { className: 'batch67-card' },
          h('label', { className: 'batch67-field' }, h('span', null, 'Tipo de movimentação'), h('select', { value: type, onChange: e => handleTypeChange(e.target.value) },
            h('optgroup', { label: 'Entradas' }, MOVEMENT_OPTIONS.filter(item => item.group === 'Entrada').map(item => h('option', { key: item.value, value: item.value }, item.label))),
            h('optgroup', { label: 'Saídas' }, MOVEMENT_OPTIONS.filter(item => item.group === 'Saída').map(item => h('option', { key: item.value, value: item.value }, item.label)))
          )),
          h('div', { className: 'batch67-search' }, h(Search, { size: 17 }), h('input', { value: search, onChange: e => setSearch(e.target.value), placeholder: 'Buscar produto por nome ou código...' })),
          search && h('div', { className: 'batch67-results' }, candidates.length === 0
            ? h('div', { className: 'batch67-result-empty' }, 'Nenhum produto encontrado.')
            : candidates.map(product => h('button', { key: product.id, type: 'button', onClick: () => addProduct(product), className: 'batch67-result' },
                h('div', { className: 'batch67-product-icon' }, h(Package, { size: 17 })),
                h('div', { className: 'batch67-result-copy' }, h('strong', null, product.name), h('span', null, `#${product.code || '—'} · ${Number(product.quantity) || 0} em estoque`)),
                h('span', { className: 'batch67-add' }, 'Adicionar')
              )))
        ),

        h('section', { className: 'batch67-card' },
          h('div', { className: 'batch67-section-heading' }, h('div', null, h('strong', null, 'Produtos selecionados'), h('span', null, `${rows.length} ${rows.length === 1 ? 'produto' : 'produtos'}`))),
          rows.length === 0
            ? h('div', { className: 'batch67-empty' }, 'Busque e adicione os produtos que serão movimentados.')
            : h('div', { className: 'batch67-selected-list' }, rows.map(row => h('div', { key: row.productId, className: 'batch67-selected-row' },
                h('div', { className: 'batch67-selected-main' }, h('strong', null, row.name), h('span', null, `#${row.code || '—'} · Estoque atual ${row.currentQty} un.`)),
                h('label', { className: 'batch67-mini-field' }, h('span', null, 'Quantidade'), h('input', { type: 'number', min: '1', inputMode: 'numeric', value: row.quantity, onChange: e => updateRow(row.productId, { quantity: e.target.value }), placeholder: '0' })),
                isPurchase && h('label', { className: 'batch67-mini-field is-cost' }, h('span', null, 'Custo unitário'), h(MoneyInput, { value: row.unitCost, onChange: value => updateRow(row.productId, { unitCost: value }), className: 'batch67-money' })),
                h('button', { type: 'button', onClick: () => removeRow(row.productId), className: 'batch67-remove', title: 'Remover produto' }, h(Trash2, { size: 17 }))
              )))
        ),

        isPurchase && h('section', { className: 'batch67-card batch67-payment' },
          h('div', { className: 'batch67-payment-title' }, h(CreditCard, { size: 18 }), h('div', null, h('strong', null, 'Pagamento da compra'), h('span', null, 'O Financeiro consolida o lote e, quando houver parcelamento, cria uma conta por parcela.'))),
          h('label', { className: 'batch67-field' }, h('span', null, 'Forma de pagamento'), h('select', { value: paymentMethod, onChange: e => handlePaymentMethodChange(e.target.value) }, PAYMENT_OPTIONS.map(option => h('option', { key: option.value, value: option.value }, option.label)))),
          isDeferred && h('div', { className: 'batch67-payment-grid' },
            h('label', { className: 'batch67-field' }, h('span', null, 'Parcelamento'), h('select', { value: installmentsCount, onChange: e => setInstallmentsCount(String(clampInstallments(e.target.value))) }, Array.from({ length: 24 }, (_, index) => h('option', { key: index + 1, value: String(index + 1) }, `${index + 1}x`)))),
            h('label', { className: 'batch67-field' }, h('span', null, installmentsCount === '1' ? 'Vencimento' : 'Vencimento da 1ª parcela'), h('div', { className: 'batch67-date' }, h(CalendarDays, { size: 17 }), h('input', { type: 'date', min: getBrazilDateString(), value: paymentDueDate, onChange: e => setPaymentDueDate(e.target.value) })))
          ),
          isDeferred && installmentPlan.length > 0 && h('div', { className: 'batch67-installment-preview' },
            installmentPlan.map(item => h('div', { key: item.number }, h('span', null, `${item.number}/${installmentPlan.length} · ${item.dueDate.split('-').reverse().join('/')}`), h('strong', null, formatCurrency(item.amount))))
          ),
          h('div', { className: 'batch67-total' }, h('span', null, isDeferred ? `${clampInstallments(installmentsCount)} ${clampInstallments(installmentsCount) === 1 ? 'conta a pagar' : 'contas a pagar'}` : 'Saída financeira'), h('strong', null, formatCurrency(batchTotal)))
        ),

        h('label', { className: 'batch67-card batch67-field' }, h('span', null, 'Observação da movimentação'), h('textarea', { rows: 3, value: notes, onChange: e => setNotes(e.target.value), placeholder: 'Informação adicional sobre esta movimentação...' })),
        h('p', { className: 'batch67-note' }, 'Devolução ao fornecedor continua sendo registrada individualmente, pois precisa ficar vinculada à compra de origem de cada produto.')
      ),
      h('footer', { className: 'batch67-footer' },
        h('button', { type: 'button', onClick: onClose, className: 'batch67-secondary' }, 'Cancelar'),
        h('button', { type: 'button', onClick: handleSubmit, disabled: saving || rows.length === 0, className: 'batch67-primary' }, saving ? 'Salvando...' : `Registrar ${rows.length || ''} ${rows.length === 1 ? 'produto' : 'produtos'}`)
      )
    )
  ), document.body);
};
