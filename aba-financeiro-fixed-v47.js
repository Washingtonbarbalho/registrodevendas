const VERSION = '47';
const response = await fetch('./aba-financeiro.js?v=46', { cache: 'no-store' });
if (!response.ok) throw new Error('Não foi possível carregar o Financeiro base (' + response.status + ').');
let source = await response.text();

const replaceRequired = (marker, replacement, label) => {
  if (!source.includes(marker)) throw new Error('Não foi possível preparar ' + label + '.');
  source = source.replace(marker, replacement);
};

const replaceBlock = (startMarker, endMarker, replacement, label) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error('Não foi possível preparar ' + label + '.');
  source = source.slice(0, start) + replacement + '\n\n' + source.slice(end);
};

replaceRequired(
`const normalizeFinancialData = raw => ({
  entries: Array.isArray(raw?.entries) ? raw.entries : [],
  accounts: Array.isArray(raw?.accounts) ? raw.accounts : []
});`,
`const normalizeFinancialData = raw => ({
  entries: Array.isArray(raw?.entries) ? raw.entries : [],
  accounts: Array.isArray(raw?.accounts) ? raw.accounts : []
});

const getPurchaseCancellationEvents = movement => {
  const current = Array.isArray(movement?.financialCancellations) ? movement.financialCancellations : [];
  if (current.length) return current;
  if (!movement?.financialCanceled) return [];
  const deferred = movement.paymentMethod === 'credit' || movement.paymentMethod === 'term';
  const hadCashOut = deferred ? !!movement.financialPaid : true;
  const quantity = Math.max(0, parseInt(movement.quantity, 10) || 0);
  return [{
    id: 'legacy-full',
    quantity,
    amount: money(quantity * num(movement.unitCost)),
    date: cleanDate(movement.financialCanceledAt),
    reason: movement.financialCancelReason || 'Compra cancelada',
    hadCashOut
  }];
};

const getPurchaseCanceledQuantity = movement => Math.min(
  Math.max(0, parseInt(movement?.quantity, 10) || 0),
  getPurchaseCancellationEvents(movement).reduce((sum, event) => sum + Math.max(0, parseInt(event.quantity, 10) || 0), 0)
);

const getSaleCancellationEvents = sale => Array.isArray(sale?.cancellations) ? sale.cancellations : [];`,
'os históricos de cancelamento'
);

replaceBlock(
'const CancelPurchaseModal =',
'export const AbaFinanceiro =',
String.raw`const CancelPurchaseModal = ({ target, onClose, onConfirm }) => {
  const [mode, setMode] = useState('total');
  const [quantity, setQuantity] = useState(1);
  const [date, setDate] = useState(getBrazilDateString());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const open = !!target;
  useBodyLock(open);

  useEffect(() => {
    if (!open) return;
    setMode('total');
    setQuantity(1);
    setDate(getBrazilDateString());
    setReason('');
    setSaving(false);
  }, [open, target?.movementId]);

  if (!target) return null;

  const remainingQuantity = Math.max(0, parseInt(target.remainingQuantity, 10) || 0);
  const selectedQuantity = mode === 'total'
    ? remainingQuantity
    : Math.min(remainingQuantity, Math.max(0, parseInt(quantity, 10) || 0));
  const cancelAmount = money(selectedQuantity * num(target.unitCost));
  const willRefund = !!target.hadCashOut;

  const submit = async () => {
    if (!date) return alert('Informe a data do cancelamento.');
    if (!reason.trim()) return alert('Informe o motivo do cancelamento.');
    if (selectedQuantity <= 0) return alert('Informe uma quantidade válida para cancelar.');
    setSaving(true);
    try {
      await onConfirm({ target, date, reason: reason.trim(), mode, quantity: selectedQuantity });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const modal = h('div', { className: 'finance46-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Cancelar compra de mercadoria' },
    h('div', { className: 'finance46-modal finance46-cancel-modal finance47-purchase-cancel' },
      h('header', { className: 'finance46-modal-hero is-danger' },
        h('div', { className: 'finance46-modal-icon' }, h(RotateCcw, { size: 22 })),
        h('div', { className: 'finance46-modal-heading' },
          h('span', null, 'Cancelamento de compra'),
          h('h2', null, 'Cancelar compra de mercadoria'),
          h('p', null, target.description)
        ),
        h('button', { type: 'button', onClick: onClose, className: 'finance46-close', title: 'Fechar' }, h(X, { size: 20 }))
      ),
      h('div', { className: 'finance46-modal-scroll' },
        h('section', { className: 'finance46-cancel-summary' },
          h('div', null, h('span', null, 'Quantidade original'), h('strong', null, String(target.originalQuantity) + ' un.')),
          h('div', null, h('span', null, 'Ainda cancelável'), h('strong', null, String(remainingQuantity) + ' un.')),
          h('div', null, h('span', null, 'Custo unitário'), h('strong', null, formatCurrency(target.unitCost))),
          h('div', null, h('span', null, 'Pagamento'), h('strong', null, paymentLabel(target.paymentMethod)))
        ),
        h('section', { className: 'finance46-card' },
          h('div', { className: 'finance46-section-label' }, 'Tipo de cancelamento'),
          h('div', { className: 'finance47-cancel-mode' },
            h('button', { type: 'button', onClick: () => setMode('total'), className: mode === 'total' ? 'is-active' : '' }, 'Total restante'),
            h('button', { type: 'button', onClick: () => setMode('partial'), className: mode === 'partial' ? 'is-active' : '' }, 'Parcial')
          ),
          mode === 'partial' && h('label', { className: 'finance46-field finance47-qty-field' },
            h('span', null, 'Quantidade a cancelar *'),
            h('input', { type: 'number', min: 1, max: remainingQuantity, inputMode: 'numeric', value: quantity, onChange: e => setQuantity(e.target.value) })
          )
        ),
        h('div', { className: willRefund ? 'finance46-impact is-refund' : 'finance46-impact is-cancel' },
          h(AlertTriangle, { size: 18 }),
          h('div', null,
            h('strong', null, willRefund ? 'Esta parte da compra já foi paga.' : 'Esta parte da compra ainda não foi paga.'),
            h('p', null, willRefund
              ? 'Será criada uma entrada de estorno de ' + formatCurrency(cancelAmount) + ' referente a ' + selectedQuantity + ' unidade(s).'
              : 'A conta a pagar será reduzida em ' + formatCurrency(cancelAmount) + '. Nenhum dinheiro será movimentado agora.')
          )
        ),
        h('section', { className: 'finance46-card' },
          h('div', { className: 'finance46-fields-grid' },
            h('label', { className: 'finance46-field' },
              h('span', null, willRefund ? 'Data do estorno *' : 'Data do cancelamento *'),
              h('input', { type: 'date', value: date, onChange: e => setDate(e.target.value) })
            ),
            h('div', { className: 'finance46-cancel-badge' },
              h('span', null, mode === 'total' ? 'Cancelamento total restante' : 'Cancelamento parcial'),
              h('strong', null, (willRefund ? '+ ' : '- ') + formatCurrency(cancelAmount))
            )
          ),
          h('label', { className: 'finance46-field finance46-field-wide' },
            h('span', null, 'Motivo *'),
            h('textarea', { rows: 3, value: reason, onChange: e => setReason(e.target.value), placeholder: 'Ex.: unidades avariadas, devolução parcial ao fornecedor...' })
          )
        ),
        h('p', { className: 'finance46-stock-warning' }, 'Este cancelamento afeta somente o Financeiro. Se as unidades também saíram fisicamente do estoque, registre a movimentação de estoque correspondente.')
      ),
      h('footer', { className: 'finance46-modal-footer' },
        h('button', { type: 'button', onClick: onClose, className: 'finance46-button is-secondary' }, 'Voltar'),
        h('button', { type: 'button', onClick: submit, disabled: saving, className: 'finance46-button is-danger' }, saving ? 'Cancelando...' : 'Confirmar cancelamento')
      )
    )
  );

  return createPortal(modal, document.body);
};`,
'o cancelamento parcial das compras'
);

replaceBlock(
'  const automaticMovements = useMemo(() => {',
'  const manualMovements = useMemo(() => {',
String.raw`  const automaticMovements = useMemo(() => {
    const rows = [];

    sales.forEach(sale => {
      const cancellationEvents = getSaleCancellationEvents(sale);
      const keepHistoricalReceipts = sale.status !== 'canceled' || cancellationEvents.length > 0;

      if (keepHistoricalReceipts) {
        if (sale.saleType === 'direct') {
          const amount = getDirectNet(sale);
          if (amount > 0) rows.push({
            id: 'direct-' + sale.id,
            type: 'income',
            date: cleanDate(sale.saleDate),
            amount,
            description: 'Venda · ' + (sale.customerName || 'Venda avulsa'),
            detail: sale.paymentMethod === 'credit' ? 'Cartão de crédito · ' + (sale.cardInstallments || 1) + 'x' : paymentLabel(sale.paymentMethod),
            source: 'sale'
          });
        } else if (isPrazo(sale)) {
          rows.push(...buildSaleReceipts(sale).map(row => ({ ...row, type: 'income' })));
        }
      }

      cancellationEvents.forEach((event, index) => {
        const amount = money(event.refundAmount);
        if (!(amount > 0) || !event.date) return;
        rows.push({
          id: 'sale-refund-' + sale.id + '-' + (event.id || index),
          type: 'expense',
          date: cleanDate(event.date),
          amount,
          description: 'Estorno de venda · ' + (sale.customerName || 'Venda avulsa'),
          detail: (event.type === 'partial' ? 'Cancelamento parcial' : 'Cancelamento total') + (event.reason ? ' · ' + event.reason : ''),
          source: 'sale-refund',
          canceled: true
        });
      });
    });

    products.forEach(product => (product.movements || []).forEach(movement => {
      if (movement.type !== 'compra') return;
      const originalQuantity = Math.max(0, parseInt(movement.quantity, 10) || 0);
      const unitCost = num(movement.unitCost);
      const originalAmount = money(originalQuantity * unitCost);
      if (!(originalAmount > 0)) return;

      const deferred = movement.paymentMethod === 'credit' || movement.paymentMethod === 'term';
      const hadCashOut = deferred ? !!movement.financialPaid : true;
      const paymentDate = cleanDate(deferred ? (movement.financialPaidAt || movement.paymentDueDate) : movement.date);
      const cancellationEvents = getPurchaseCancellationEvents(movement);
      const canceledQuantity = getPurchaseCanceledQuantity(movement);
      const remainingQuantity = Math.max(0, originalQuantity - canceledQuantity);
      const fullyCanceled = remainingQuantity <= 0;
      const partiallyCanceled = canceledQuantity > 0 && !fullyCanceled;

      if (hadCashOut && paymentDate) {
        rows.push({
          id: 'stock-' + product.id + '-' + movement.id,
          type: 'expense',
          date: paymentDate,
          amount: originalAmount,
          description: 'Compra de mercadoria · ' + product.name,
          detail: fullyCanceled ? paymentLabel(movement.paymentMethod) + ' · compra cancelada' : partiallyCanceled ? paymentLabel(movement.paymentMethod) + ' · cancelamento parcial' : deferred ? paymentLabel(movement.paymentMethod) + ' · paga' : paymentLabel(movement.paymentMethod),
          source: 'stock',
          productId: product.id,
          movementId: movement.id,
          paymentMethod: movement.paymentMethod,
          canceled: fullyCanceled,
          partialCanceled: partiallyCanceled,
          canCancel: remainingQuantity > 0
        });
      }

      cancellationEvents.forEach((event, index) => {
        const amount = money(event.amount || (num(event.quantity) * unitCost));
        if (!event.hadCashOut || !(amount > 0) || !event.date) return;
        rows.push({
          id: 'stock-refund-' + product.id + '-' + movement.id + '-' + (event.id || index),
          type: 'income',
          date: cleanDate(event.date),
          amount,
          description: 'Estorno de compra · ' + product.name,
          detail: paymentLabel(movement.paymentMethod) + ' · ' + (event.reason || 'Compra cancelada'),
          source: 'stock-refund',
          productId: product.id,
          movementId: movement.id,
          canceled: true
        });
      });
    }));

    return rows;
  }, [sales, products]);`,
'as movimentações automáticas com estornos proporcionais'
);

replaceBlock(
'  const stockPayables = useMemo(() => {',
'  const manualReceivables = useMemo(() =>',
String.raw`  const stockPayables = useMemo(() => {
    const rows = [];
    products.forEach(product => (product.movements || []).forEach(movement => {
      if (movement.type !== 'compra' || !['credit', 'term'].includes(movement.paymentMethod)) return;
      const originalQuantity = Math.max(0, parseInt(movement.quantity, 10) || 0);
      const unitCost = num(movement.unitCost);
      const originalValue = money(originalQuantity * unitCost);
      if (!(originalValue > 0) || !movement.paymentDueDate) return;
      const canceledQuantity = getPurchaseCanceledQuantity(movement);
      const remainingQuantity = Math.max(0, originalQuantity - canceledQuantity);
      const fullyCanceled = remainingQuantity <= 0;
      const partiallyCanceled = canceledQuantity > 0 && !fullyCanceled;
      const value = movement.financialPaid ? originalValue : money(remainingQuantity * unitCost);
      const cancellationEvents = getPurchaseCancellationEvents(movement);
      const latestCancellation = cancellationEvents[cancellationEvents.length - 1];

      rows.push({
        id: 'stock-ap-' + product.id + '-' + movement.id,
        source: 'stock',
        productId: product.id,
        movementId: movement.id,
        paymentMethod: movement.paymentMethod,
        description: 'Compra de mercadoria · ' + product.name,
        party: paymentLabel(movement.paymentMethod),
        dueDate: cleanDate(movement.paymentDueDate),
        value,
        originalValue,
        originalQuantity,
        canceledQuantity,
        remainingQuantity,
        unitCost,
        paid: !!movement.financialPaid,
        paidAt: cleanDate(movement.financialPaidAt),
        canceled: fullyCanceled,
        partialCanceled: partiallyCanceled,
        canceledAt: fullyCanceled ? cleanDate(latestCancellation?.date || movement.financialCanceledAt) : '',
        cancelReason: latestCancellation?.reason || movement.financialCancelReason || '',
        status: fullyCanceled
          ? statusOf(cleanDate(movement.paymentDueDate), !!movement.financialPaid, false, true, 'Paga')
          : partiallyCanceled
            ? { label: 'Parcialmente cancelada', cls: 'is-partial' }
            : statusOf(cleanDate(movement.paymentDueDate), !!movement.financialPaid, false, false, 'Paga')
      });
    }));
    return rows;
  }, [products]);`,
'as contas a pagar proporcionais'
);

replaceBlock(
'  const buildCancelTarget = item => {',
'  const openCount = list =>',
String.raw`  const buildCancelTarget = item => {
    const product = products.find(p => p.id === item.productId);
    const movement = product?.movements?.find(m => m.id === item.movementId);
    if (!product || !movement) return null;
    const originalQuantity = Math.max(0, parseInt(movement.quantity, 10) || 0);
    const canceledQuantity = getPurchaseCanceledQuantity(movement);
    const remainingQuantity = Math.max(0, originalQuantity - canceledQuantity);
    if (remainingQuantity <= 0) return null;
    const deferred = movement.paymentMethod === 'credit' || movement.paymentMethod === 'term';
    const hadCashOut = deferred ? !!movement.financialPaid : true;
    return {
      productId: product.id,
      movementId: movement.id,
      description: 'Compra de mercadoria · ' + product.name,
      originalQuantity,
      canceledQuantity,
      remainingQuantity,
      unitCost: num(movement.unitCost),
      paymentMethod: movement.paymentMethod,
      hadCashOut
    };
  };

  const requestCancelStockPurchase = item => {
    const target = buildCancelTarget(item);
    if (target) setCancelTarget(target);
  };

  const confirmCancelStockPurchase = async ({ target, date, reason, mode, quantity }) => {
    const product = products.find(p => p.id === target.productId);
    if (!product) throw new Error('Produto não encontrado para o cancelamento.');
    const movement = (product.movements || []).find(item => item.id === target.movementId);
    if (!movement) throw new Error('Compra de mercadoria não encontrada.');

    const originalQuantity = Math.max(0, parseInt(movement.quantity, 10) || 0);
    const alreadyCanceled = getPurchaseCanceledQuantity(movement);
    const remainingQuantity = Math.max(0, originalQuantity - alreadyCanceled);
    const requestedQuantity = mode === 'total' ? remainingQuantity : Math.max(0, parseInt(quantity, 10) || 0);
    const cancelQuantity = Math.min(remainingQuantity, requestedQuantity);
    if (cancelQuantity <= 0) throw new Error('Não há quantidade disponível para cancelar.');

    const deferred = movement.paymentMethod === 'credit' || movement.paymentMethod === 'term';
    const hadCashOut = deferred ? !!movement.financialPaid : true;
    const unitCost = num(movement.unitCost);
    const event = {
      id: 'cancel-' + Date.now(),
      date,
      reason,
      quantity: cancelQuantity,
      amount: money(cancelQuantity * unitCost),
      hadCashOut,
      createdAt: new Date().toISOString()
    };
    const existingEvents = Array.isArray(movement.financialCancellations) ? movement.financialCancellations : [];
    const totalCanceled = Math.min(originalQuantity, alreadyCanceled + cancelQuantity);
    const fullyCanceled = totalCanceled >= originalQuantity;

    const movementsUpdated = (product.movements || []).map(item => item.id === target.movementId
      ? {
          ...item,
          financialCancellations: [...existingEvents, event],
          financialCanceled: fullyCanceled,
          financialPartiallyCanceled: !fullyCanceled && totalCanceled > 0,
          financialCanceledAt: fullyCanceled ? date : (item.financialCanceledAt || null),
          financialCancelReason: fullyCanceled ? reason : (item.financialCancelReason || ''),
          financialRefunded: hadCashOut ? true : !!item.financialRefunded
        }
      : item);

    await updateDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'products', target.productId), { movements: movementsUpdated });
    setMessage(hadCashOut
      ? 'Cancelamento registrado e estorno proporcional incluído como entrada.'
      : fullyCanceled
        ? 'Conta a pagar cancelada com sucesso.'
        : 'Conta a pagar reduzida proporcionalmente às unidades canceladas.');
    setError('');
  };`,
'a gravação do cancelamento parcial das compras'
);

replaceRequired(
"item.source === 'stock-refund' ? 'is-refund' : item.canceled ? 'is-canceled' : ''",
"(item.source === 'stock-refund' || item.source === 'sale-refund') ? 'is-refund' : item.canceled ? 'is-canceled' : ''",
'a identificação visual dos estornos'
);
replaceRequired(
"item.source === 'sale' ? 'Venda' : item.source === 'stock-refund' ? 'Estorno' : item.source === 'stock' ? 'Estoque' : 'Conta'",
"item.source === 'sale' ? 'Venda' : (item.source === 'stock-refund' || item.source === 'sale-refund') ? 'Estorno' : item.source === 'stock' ? 'Estoque' : 'Conta'",
'o rótulo dos estornos de venda'
);

const blob = new Blob([source], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
try {
  await import(url);
} finally {
  URL.revokeObjectURL(url);
}
