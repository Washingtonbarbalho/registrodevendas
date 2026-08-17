import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.2.0';
import { createPortal } from 'https://esm.sh/react-dom@18.2.0';
import { ArrowDownCircle, ArrowUpCircle, CalendarDays, CreditCard, Package, X } from 'https://esm.sh/lucide-react@0.292.0';
import { MoneyInput } from './components.js';
import { formatCurrency, getBrazilDateString, maskMoney, parseMoney } from './utils.js';

const h = React.createElement;

const PAYMENT_OPTIONS = [
    { value: 'money', label: 'Dinheiro' },
    { value: 'pix', label: 'PIX' },
    { value: 'debit', label: 'Cartão de débito' },
    { value: 'credit', label: 'Cartão de crédito' },
    { value: 'term', label: 'Compra a prazo' }
];

export const StockMovementModal = ({ isOpen, onClose, product, onSave }) => {
    const [type, setType] = useState('compra');
    const [quantity, setQuantity] = useState('');
    const [unitCost, setUnitCost] = useState('');
    const [notes, setNotes] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('pix');
    const [paymentDueDate, setPaymentDueDate] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen || !product) return;
        setType('compra');
        setQuantity('');
        setUnitCost(maskMoney(((Number(product.costPrice) || 0) * 100).toFixed(0)));
        setNotes('');
        setPaymentMethod('pix');
        setPaymentDueDate('');
        setSaving(false);
    }, [isOpen, product]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const previousOverflow = document.body.style.overflow;
        const previousOverscroll = document.body.style.overscrollBehavior;
        document.body.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'none';
        return () => {
            document.body.style.overflow = previousOverflow;
            document.body.style.overscrollBehavior = previousOverscroll;
        };
    }, [isOpen]);

    const isEntry = ['compra', 'ajuste_entrada', 'devolucao'].includes(type);
    const isPurchase = type === 'compra';
    const isDeferred = isPurchase && (paymentMethod === 'credit' || paymentMethod === 'term');
    const quantityValue = Math.max(0, parseInt(quantity, 10) || 0);
    const unitCostValue = Math.max(0, parseMoney(unitCost) || 0);
    const purchaseTotal = useMemo(() => quantityValue * unitCostValue, [quantityValue, unitCostValue]);

    const handleTypeChange = value => {
        setType(value);
        if (value !== 'compra') {
            setPaymentDueDate('');
        }
    };

    const handlePaymentChange = value => {
        setPaymentMethod(value);
        if (value !== 'credit' && value !== 'term') setPaymentDueDate('');
    };

    const handleSubmit = async () => {
        if (saving) return;
        if (quantityValue <= 0) return alert('Insira uma quantidade válida maior que zero.');
        if (isPurchase && unitCostValue <= 0) return alert('Para compras, informe o custo unitário da mercadoria.');
        if (isDeferred && !paymentDueDate) return alert('Informe a data de vencimento desta compra.');

        setSaving(true);
        try {
            await onSave(product.id, {
                type,
                quantity: quantityValue,
                unitCost: unitCostValue,
                notes: notes.trim(),
                paymentMethod: isPurchase ? paymentMethod : null,
                paymentDueDate: isDeferred ? paymentDueDate : null,
                purchaseTotal: isPurchase ? purchaseTotal : 0
            });
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen || !product) return null;

    const modal = h('div', {
        className: 'stock44-overlay fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': 'Movimentar estoque'
    },
        h('div', { className: 'stock44-panel w-full max-w-lg bg-white' },
            h('header', { className: 'stock44-header' },
                h('div', { className: 'min-w-0' },
                    h('h2', null, 'Movimentar estoque'),
                    h('p', null, `${product.name} · Estoque atual: ${Number(product.quantity) || 0} un.`)
                ),
                h('button', { type: 'button', onClick: onClose, className: 'stock44-close', title: 'Fechar' }, h(X, { size: 20 }))
            ),
            h('div', { className: 'stock44-body' },
                h('section', { className: 'stock44-product' },
                    h('div', { className: 'stock44-product-icon' }, h(Package, { size: 20 })),
                    h('div', { className: 'min-w-0 flex-1' },
                        h('strong', null, product.name),
                        h('span', null, `Código #${product.code || '—'} · Custo atual ${formatCurrency(product.costPrice || 0)}`)
                    )
                ),
                h('label', { className: 'stock44-field' },
                    h('span', null, 'Tipo de movimentação'),
                    h('select', { value: type, onChange: event => handleTypeChange(event.target.value) },
                        h('optgroup', { label: 'Entradas' },
                            h('option', { value: 'compra' }, 'Compra de mercadoria'),
                            h('option', { value: 'ajuste_entrada' }, 'Ajuste de entrada')
                        ),
                        h('optgroup', { label: 'Saídas' },
                            h('option', { value: 'ajuste_saida' }, 'Ajuste de saída'),
                            h('option', { value: 'avaria' }, 'Avaria / perda / vencido')
                        )
                    )
                ),
                h('div', { className: 'stock44-grid' },
                    h('label', { className: 'stock44-field' },
                        h('span', null, 'Quantidade'),
                        h('input', { type: 'number', min: '1', inputMode: 'numeric', value: quantity, onChange: event => setQuantity(event.target.value), placeholder: '0' })
                    ),
                    h('label', { className: 'stock44-field' },
                        h('span', null, 'Custo unitário'),
                        h(MoneyInput, {
                            value: unitCost,
                            onChange: setUnitCost,
                            disabled: !isEntry,
                            className: 'stock44-money-input'
                        })
                    )
                ),
                isPurchase && h('section', { className: 'stock44-payment-card' },
                    h('div', { className: 'stock44-section-title' },
                        h(CreditCard, { size: 17 }),
                        h('div', null,
                            h('strong', null, 'Pagamento da mercadoria'),
                            h('span', null, 'Define quando esta compra afetará o Financeiro.')
                        )
                    ),
                    h('label', { className: 'stock44-field' },
                        h('span', null, 'Forma de pagamento'),
                        h('select', { value: paymentMethod, onChange: event => handlePaymentChange(event.target.value) },
                            PAYMENT_OPTIONS.map(option => h('option', { key: option.value, value: option.value }, option.label))
                        )
                    ),
                    isDeferred && h('label', { className: 'stock44-field' },
                        h('span', null, paymentMethod === 'credit' ? 'Vencimento do cartão' : 'Vencimento da compra'),
                        h('div', { className: 'stock44-date-wrap' },
                            h(CalendarDays, { size: 17 }),
                            h('input', { type: 'date', min: getBrazilDateString(), value: paymentDueDate, onChange: event => setPaymentDueDate(event.target.value) })
                        )
                    ),
                    purchaseTotal > 0 && h('div', { className: 'stock44-total' },
                        h('span', null, isDeferred ? 'Conta a pagar' : 'Saída financeira'),
                        h('strong', null, formatCurrency(purchaseTotal))
                    ),
                    h('p', { className: 'stock44-payment-note' }, isDeferred
                        ? 'Esta compra não sairá do caixa agora. Ela aparecerá em Contas a pagar até ser marcada como paga.'
                        : 'O valor desta compra será registrado como saída financeira na data da movimentação.')
                ),
                isPurchase && h('div', { className: 'stock44-cost-note' },
                    h(ArrowUpCircle, { size: 17 }),
                    h('span', null, 'O custo médio do produto continuará sendo recalculado automaticamente após a entrada.')
                ),
                !isEntry && h('div', { className: 'stock44-cost-note is-out' },
                    h(ArrowDownCircle, { size: 17 }),
                    h('span', null, 'Esta movimentação reduzirá apenas o estoque e não criará lançamento financeiro automático.')
                ),
                h('label', { className: 'stock44-field' },
                    h('span', null, 'Observação'),
                    h('textarea', { rows: 3, value: notes, onChange: event => setNotes(event.target.value), placeholder: 'Informação adicional sobre esta movimentação...' })
                )
            ),
            h('footer', { className: 'stock44-footer' },
                h('button', { type: 'button', onClick: onClose, className: 'stock44-secondary' }, 'Cancelar'),
                h('button', { type: 'button', onClick: handleSubmit, disabled: saving, className: 'stock44-primary' }, saving ? 'Salvando...' : 'Registrar movimentação')
            )
        )
    );

    return createPortal(modal, document.body);
};
