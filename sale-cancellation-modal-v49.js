import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.2.0';
import { createPortal } from 'https://esm.sh/react-dom@18.2.0';
import { AlertTriangle, PackageX, X } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, getBrazilDateString } from './utils.js';

const h = React.createElement;
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const money = value => Math.round((num(value) + Number.EPSILON) * 100) / 100;

const getItemUnitPrice = item => {
  const storedUnit = num(item?.unitPrice);
  if (storedUnit > 0) return storedUnit;
  const quantity = Math.max(1, parseInt(item?.quantity, 10) || 1);
  return money(num(item?.price) / quantity);
};

const getHistoryAmount = item => {
  if (!item || item.type === 'abatement') return 0;
  return money(num(item.amount) + (item.type === 'full_surplus' ? num(item.surplus) : 0));
};

const getReceivedCash = sale => {
  if (!sale) return 0;
  if (sale.saleType === 'direct') {
    if (sale.netReceived !== undefined && sale.netReceived !== null && sale.netReceived !== '') return money(sale.netReceived);
    return money(sale.totalPrice);
  }
  let total = num(sale.entryAmount);
  (sale.installments || []).forEach(inst => {
    const history = Array.isArray(inst.history) ? inst.history : [];
    if (history.length) history.forEach(item => { total += getHistoryAmount(item); });
    else if (inst.paid && inst.paidAt) total += num(inst.originalAmount || inst.amount);
  });
  return money(total);
};

export const SaleCancellationModal = ({ isOpen, sale, onClose, onConfirm }) => {
  const [mode, setMode] = useState('total');
  const [quantities, setQuantities] = useState({});
  const [date, setDate] = useState(getBrazilDateString());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !sale) return;
    const initial = {};
    (sale.items || []).forEach((item, index) => { initial[index] = 0; });
    setMode('total');
    setQuantities(initial);
    setDate(getBrazilDateString());
    setReason('');
    setSaving(false);
  }, [isOpen, sale?.id]);

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

  const selected = useMemo(() => (sale?.items || []).map((item, index) => {
    const available = Math.max(0, parseInt(item.quantity, 10) || 0);
    const quantity = mode === 'total' ? available : Math.min(available, Math.max(0, parseInt(quantities[index], 10) || 0));
    const unitPrice = getItemUnitPrice(item);
    return { index, item, available, quantity, unitPrice, amount: money(quantity * unitPrice) };
  }).filter(row => row.quantity > 0), [sale, mode, quantities]);

  const selectedAmount = money(selected.reduce((sum, row) => sum + row.amount, 0));
  const activeGoodsValue = money((sale?.items || []).reduce((sum, item) => {
    const quantity = Math.max(0, parseInt(item.quantity, 10) || 0);
    return sum + getItemUnitPrice(item) * quantity;
  }, 0));
  const selectedQty = selected.reduce((sum, row) => sum + row.quantity, 0);
  const activeQty = (sale?.items || []).reduce((sum, item) => sum + Math.max(0, parseInt(item.quantity, 10) || 0), 0);
  const fraction = activeGoodsValue > 0 ? Math.min(1, selectedAmount / activeGoodsValue) : activeQty > 0 ? Math.min(1, selectedQty / activeQty) : 1;
  const priorRefunds = (sale?.cancellations || []).reduce((sum, event) => sum + num(event.refundAmount), 0);
  const effectiveReceived = Math.max(0, getReceivedCash(sale) - priorRefunds);
  const estimatedRefund = money(effectiveReceived * fraction);

  if (!isOpen || !sale) return null;

  const setQty = (index, value, max) => {
    const parsed = Math.max(0, Math.min(max, parseInt(value, 10) || 0));
    setQuantities(previous => ({ ...previous, [index]: parsed }));
  };

  const submit = async () => {
    if (!date) return alert('Informe a data do cancelamento.');
    if (!reason.trim()) return alert('Informe o motivo do cancelamento.');
    if (!selected.length) return alert('Selecione ao menos uma unidade para cancelar.');
    setSaving(true);
    try {
      await onConfirm({
        mode,
        date,
        reason: reason.trim(),
        items: selected.map(row => ({ index: row.index, quantity: row.quantity }))
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const modal = h('div', { className: 'sale47-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Cancelar venda' },
    h('div', { className: 'sale47-modal' },
      h('header', { className: 'sale47-header' },
        h('div', { className: 'sale47-icon' }, h(PackageX, { size: 22 })),
        h('div', { className: 'sale47-heading' },
          h('span', null, 'Cancelamento e estorno'),
          h('h2', null, 'Cancelar venda'),
          h('p', null, sale.customerName || 'Venda avulsa')
        ),
        h('button', { type: 'button', className: 'sale47-close', onClick: onClose }, h(X, { size: 20 }))
      ),
      h('div', { className: 'sale47-scroll' },
        h('section', { className: 'sale47-card' },
          h('span', { className: 'sale47-label' }, 'Tipo de cancelamento'),
          h('div', { className: 'sale47-mode' },
            h('button', { type: 'button', onClick: () => setMode('total'), className: mode === 'total' ? 'is-active' : '' }, 'Cancelamento total'),
            h('button', { type: 'button', onClick: () => setMode('partial'), className: mode === 'partial' ? 'is-active' : '' }, 'Cancelamento parcial')
          )
        ),
        h('section', { className: 'sale47-card' },
          h('div', { className: 'sale47-card-title' },
            h('div', null,
              h('strong', null, mode === 'total' ? 'Todos os produtos serão cancelados' : 'Escolha os produtos e quantidades'),
              h('span', null, mode === 'total' ? 'O estoque será devolvido integralmente.' : 'Somente as quantidades selecionadas voltarão ao estoque.')
            )
          ),
          h('div', { className: 'sale47-items' },
            (sale.items || []).map((item, index) => {
              const available = Math.max(0, parseInt(item.quantity, 10) || 0);
              const qty = mode === 'total' ? available : quantities[index] || 0;
              const unitPrice = getItemUnitPrice(item);
              return h('div', { key: `${item.productId || 'item'}-${index}`, className: 'sale47-item' },
                h('div', { className: 'sale47-item-copy' },
                  h('strong', null, item.productName || item.name || 'Produto'),
                  h('span', null, `${available} un. disponíveis para cancelamento · ${formatCurrency(unitPrice)} cada`)
                ),
                mode === 'total'
                  ? h('strong', { className: 'sale47-item-qty' }, `${available} un.`)
                  : h('input', { type: 'number', min: 0, max: available, inputMode: 'numeric', value: qty, onChange: e => setQty(index, e.target.value, available), 'aria-label': `Quantidade de ${item.productName || 'produto'} para cancelar` })
              );
            })
          )
        ),
        h('section', { className: 'sale47-summary' },
          h('div', null, h('span', null, 'Produtos selecionados'), h('strong', null, formatCurrency(selectedAmount))),
          h('div', null, h('span', null, 'Saída estimada no Financeiro'), h('strong', null, estimatedRefund > 0 ? formatCurrency(estimatedRefund) : 'Sem valor recebido'))
        ),
        h('div', { className: 'sale47-impact' },
          h(AlertTriangle, { size: 18 }),
          h('p', null, sale.saleType === 'direct'
            ? 'O sistema registrará uma saída proporcional ao valor que efetivamente entrou nesta venda.'
            : 'O valor já recebido será estornado proporcionalmente e as parcelas ainda em aberto serão reduzidas na mesma proporção.')
        ),
        h('section', { className: 'sale47-card' },
          h('div', { className: 'sale47-grid' },
            h('label', { className: 'sale47-field' }, h('span', null, 'Data do cancelamento *'), h('input', { type: 'date', value: date, onChange: e => setDate(e.target.value) })),
            h('label', { className: 'sale47-field sale47-wide' }, h('span', null, 'Motivo *'), h('textarea', { rows: 3, value: reason, onChange: e => setReason(e.target.value), placeholder: 'Ex.: produto devolvido, defeito, desistência...' }))
          )
        )
      ),
      h('footer', { className: 'sale47-footer' },
        h('button', { type: 'button', className: 'sale47-button is-secondary', onClick: onClose }, 'Voltar'),
        h('button', { type: 'button', className: 'sale47-button is-danger', disabled: saving, onClick: submit }, saving ? 'Cancelando...' : mode === 'total' ? 'Confirmar cancelamento total' : 'Confirmar cancelamento parcial')
      )
    )
  );

  return createPortal(modal, document.body);
};
