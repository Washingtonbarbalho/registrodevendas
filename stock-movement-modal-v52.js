import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.2.0';
import { createPortal } from 'https://esm.sh/react-dom@18.2.0';
import { CalendarDays, CreditCard, Package, RotateCcw, X } from 'https://esm.sh/lucide-react@0.292.0';
import { MoneyInput } from './components.js';
import { formatCurrency, getBrazilDateString, maskMoney, parseMoney } from './utils.js';

const h = React.createElement;
const PAYMENT_OPTIONS = [
  { value: 'money', label: 'Dinheiro' }, { value: 'pix', label: 'PIX' },
  { value: 'debit', label: 'Cartão de débito' }, { value: 'credit', label: 'Cartão de crédito' },
  { value: 'term', label: 'Compra a prazo' }
];
const paymentLabel = method => PAYMENT_OPTIONS.find(option => option.value === method)?.label || 'Pagamento';
const canceledQty = movement => (Array.isArray(movement?.financialCancellations) ? movement.financialCancellations : []).reduce((sum, event) => sum + Math.max(0, parseInt(event.quantity, 10) || 0), 0);
const formatMovementMoment = movement => {
  if (!movement?.date) return 'Data não registrada';
  const parsed = new Date(movement.date);
  if (Number.isNaN(parsed.getTime())) return String(movement.date).split('T')[0];
  return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export const StockMovementModal = ({ isOpen, onClose, product, onSave }) => {
  const [type, setType] = useState('compra');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [purchaseMovementId, setPurchaseMovementId] = useState('');
  const [saving, setSaving] = useState(false);

  const eligiblePurchases = useMemo(() => (product?.movements || [])
    .filter(movement => movement.type === 'compra')
    .map(movement => ({ ...movement, remainingReturnQty: Math.max(0, (parseInt(movement.quantity, 10) || 0) - canceledQty(movement)) }))
    .filter(movement => movement.remainingReturnQty > 0)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [product]);

  const selectedPurchase = eligiblePurchases.find(movement => movement.id === purchaseMovementId) || null;

  useEffect(() => {
    if (!isOpen || !product) return;
    setType('compra'); setQuantity(''); setUnitCost(maskMoney(((Number(product.costPrice) || 0) * 100).toFixed(0)));
    setNotes(''); setPaymentMethod('pix'); setPaymentDueDate(''); setPurchaseMovementId(''); setSaving(false);
  }, [isOpen, product]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isOpen]);

  useEffect(() => {
    if (type === 'devolucao_fornecedor' && !purchaseMovementId && eligiblePurchases[0]) setPurchaseMovementId(eligiblePurchases[0].id);
  }, [type, purchaseMovementId, eligiblePurchases]);

  const isSupplierReturn = type === 'devolucao_fornecedor';
  const isEntry = ['compra', 'ajuste_entrada'].includes(type);
  const isPurchase = type === 'compra';
  const isDeferred = isPurchase && (paymentMethod === 'credit' || paymentMethod === 'term');
  const quantityValue = Math.max(0, parseInt(quantity, 10) || 0);
  const unitCostValue = isSupplierReturn ? Number(selectedPurchase?.unitCost || 0) : Math.max(0, parseMoney(unitCost) || 0);
  const purchaseTotal = useMemo(() => quantityValue * unitCostValue, [quantityValue, unitCostValue]);
  const maxReturn = Math.min(Number(product?.quantity) || 0, selectedPurchase?.remainingReturnQty || 0);

  const handleTypeChange = value => {
    setType(value); setQuantity('');
    if (value !== 'compra') setPaymentDueDate('');
    if (value !== 'devolucao_fornecedor') setPurchaseMovementId('');
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (quantityValue <= 0) return alert('Insira uma quantidade válida maior que zero.');
    if (isSupplierReturn) {
      if (!selectedPurchase) return alert('Selecione a compra de origem.');
      if (quantityValue > maxReturn) return alert(`A quantidade máxima para esta devolução é ${maxReturn}.`);
      if (!notes.trim()) return alert('Informe o motivo da devolução ao fornecedor.');
    }
    if (isPurchase && unitCostValue <= 0) return alert('Para compras, informe o custo unitário da mercadoria.');
    if (isDeferred && !paymentDueDate) return alert('Informe a data de vencimento desta compra.');
    setSaving(true);
    try {
      await onSave(product.id, {
        type, quantity: quantityValue, unitCost: unitCostValue, notes: notes.trim(),
        paymentMethod: isPurchase ? paymentMethod : null,
        paymentDueDate: isDeferred ? paymentDueDate : null,
        purchaseTotal: isPurchase ? purchaseTotal : 0,
        purchaseMovementId: isSupplierReturn ? selectedPurchase.id : null
      });
    } finally { setSaving(false); }
  };

  if (!isOpen || !product) return null;
  return createPortal(h('div', { className: 'stock44-overlay fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5', role: 'dialog', 'aria-modal': 'true' },
    h('div', { className: 'stock44-panel w-full max-w-lg bg-white' },
      h('header', { className: 'stock44-header' }, h('div', { className: 'min-w-0' }, h('h2', null, 'Movimentar estoque'), h('p', null, `${product.name} · Estoque atual: ${Number(product.quantity) || 0} un.`)), h('button', { type: 'button', onClick: onClose, className: 'stock44-close' }, h(X, { size: 20 }))),
      h('div', { className: 'stock44-body' },
        h('section', { className: 'stock44-product' }, h('div', { className: 'stock44-product-icon' }, h(Package, { size: 20 })), h('div', { className: 'min-w-0 flex-1' }, h('strong', null, product.name), h('span', null, `Código #${product.code || '—'} · Custo atual ${formatCurrency(product.costPrice || 0)}`))),
        h('label', { className: 'stock44-field' }, h('span', null, 'Tipo de movimentação'), h('select', { value: type, onChange: e => handleTypeChange(e.target.value) },
          h('optgroup', { label: 'Entradas' }, h('option', { value: 'compra' }, 'Compra de mercadoria'), h('option', { value: 'ajuste_entrada' }, 'Ajuste de entrada')),
          h('optgroup', { label: 'Saídas' }, h('option', { value: 'ajuste_saida' }, 'Ajuste de saída'), h('option', { value: 'avaria' }, 'Avaria / perda / vencido'), h('option', { value: 'devolucao_fornecedor' }, 'Devolução ao fornecedor'))
        )),
        isSupplierReturn && h('section', { className: 'stock44-payment-card' },
          h('div', { className: 'stock44-section-title' }, h(RotateCcw, { size: 17 }), h('div', null, h('strong', null, 'Compra de origem'), h('span', null, 'A devolução será vinculada à compra correta e o Financeiro será atualizado automaticamente.'))),
          eligiblePurchases.length === 0 ? h('p', { className: 'stock44-payment-note' }, 'Não há compra com quantidade disponível para devolução.') : h('label', { className: 'stock44-field' }, h('span', null, 'Selecione a compra'), h('select', { value: purchaseMovementId, onChange: e => setPurchaseMovementId(e.target.value) }, eligiblePurchases.map(movement => h('option', { key: movement.id, value: movement.id }, `${formatMovementMoment(movement)} · ${movement.remainingReturnQty} un. · ${paymentLabel(movement.paymentMethod)}`))))
        ),
        h('div', { className: 'stock44-grid' },
          h('label', { className: 'stock44-field' }, h('span', null, isSupplierReturn ? `Quantidade (máx. ${maxReturn})` : 'Quantidade'), h('input', { type: 'number', min: '1', max: isSupplierReturn ? maxReturn : undefined, inputMode: 'numeric', value: quantity, onChange: e => setQuantity(e.target.value), placeholder: '0' })),
          h('label', { className: 'stock44-field' }, h('span', null, 'Custo unitário'), h(MoneyInput, { value: isSupplierReturn ? maskMoney(((unitCostValue || 0) * 100).toFixed(0)) : unitCost, onChange: setUnitCost, disabled: !isEntry || isSupplierReturn, className: 'stock44-money-input' }))
        ),
        isPurchase && h('section', { className: 'stock44-payment-card' },
          h('div', { className: 'stock44-section-title' }, h(CreditCard, { size: 17 }), h('div', null, h('strong', null, 'Pagamento da mercadoria'), h('span', null, 'Define quando esta compra afeta o Financeiro.'))),
          h('label', { className: 'stock44-field' }, h('span', null, 'Forma de pagamento'), h('select', { value: paymentMethod, onChange: e => { setPaymentMethod(e.target.value); if (!['credit', 'term'].includes(e.target.value)) setPaymentDueDate(''); } }, PAYMENT_OPTIONS.map(option => h('option', { key: option.value, value: option.value }, option.label)))),
          isDeferred && h('label', { className: 'stock44-field' }, h('span', null, paymentMethod === 'credit' ? 'Vencimento do cartão' : 'Vencimento da compra'), h('div', { className: 'stock44-date-wrap' }, h(CalendarDays, { size: 17 }), h('input', { type: 'date', min: getBrazilDateString(), value: paymentDueDate, onChange: e => setPaymentDueDate(e.target.value) }))),
          purchaseTotal > 0 && h('div', { className: 'stock44-total' }, h('span', null, isDeferred ? 'Conta a pagar' : 'Saída financeira'), h('strong', null, formatCurrency(purchaseTotal)))
        ),
        isSupplierReturn && selectedPurchase && quantityValue > 0 && h('div', { className: 'stock44-total' }, h('span', null, selectedPurchase.paymentMethod === 'credit' || selectedPurchase.paymentMethod === 'term' ? (selectedPurchase.financialPaid ? 'Estorno previsto' : 'Redução da conta a pagar') : 'Estorno previsto'), h('strong', null, formatCurrency(purchaseTotal))),
        h('label', { className: 'stock44-field' }, h('span', null, isSupplierReturn ? 'Motivo da devolução *' : 'Observação'), h('textarea', { rows: 3, value: notes, onChange: e => setNotes(e.target.value), placeholder: isSupplierReturn ? 'Ex.: produto avariado, mercadoria devolvida...' : 'Informação adicional...' }))
      ),
      h('footer', { className: 'stock44-footer' }, h('button', { type: 'button', onClick: onClose, className: 'stock44-secondary' }, 'Cancelar'), h('button', { type: 'button', onClick: handleSubmit, disabled: saving || (isSupplierReturn && !selectedPurchase), className: 'stock44-primary' }, saving ? 'Salvando...' : isSupplierReturn ? 'Registrar devolução' : 'Registrar movimentação'))
    )
  ), document.body);
};
