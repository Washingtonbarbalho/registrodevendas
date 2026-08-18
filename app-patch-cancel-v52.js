const replaceBlock = (source, startMarker, endMarker, replacement, label) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Não foi possível preparar ${label}.`);
  return source.slice(0, start) + replacement + "\n\n" + source.slice(end);
};

export const applyCancelPatch = source => {
  source = replaceBlock(source,
    "    const handleCancelSaleLogic = async (saleId, reason) => {",
    "    const requestDelete = (type, id) =>",
    String.raw`    const confirmCancelSale = async payload => {
        const sale = sales.find(s => s.id === cancelModal.saleId);
        if (!sale) return;
        const roundMoney = value => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;
        const getUnitPrice = item => Number(item?.unitPrice) > 0 ? Number(item.unitPrice) : roundMoney((Number(item?.price) || 0) / Math.max(1, parseInt(item?.quantity, 10) || 1));
        const getUnitCost = item => Number(item?.unitCost) > 0 ? Number(item.unitCost) : roundMoney((Number(item?.cost) || 0) / Math.max(1, parseInt(item?.quantity, 10) || 1));
        const historyAmount = item => !item || item.type === 'abatement' ? 0 : roundMoney((Number(item.amount) || 0) + (item.type === 'full_surplus' ? (Number(item.surplus) || 0) : 0));
        const receivedCash = (() => {
            if (sale.saleType === 'direct') {
                if (sale.netReceived !== undefined && sale.netReceived !== null && sale.netReceived !== '') return roundMoney(sale.netReceived);
                return roundMoney(sale.totalPrice);
            }
            let total = Number(sale.entryAmount) || 0;
            (sale.installments || []).forEach(inst => {
                const history = Array.isArray(inst.history) ? inst.history : [];
                if (history.length) history.forEach(item => { total += historyAmount(item); });
                else if (inst.paid && inst.paidAt) total += Number(inst.originalAmount || inst.amount) || 0;
            });
            return roundMoney(total);
        })();

        const items = Array.isArray(sale.items) ? sale.items : [];
        const requested = new Map((payload.items || []).map(row => [Number(row.index), Math.max(0, parseInt(row.quantity, 10) || 0)]));
        const selected = items.map((item, index) => {
            const available = Math.max(0, parseInt(item.quantity, 10) || 0);
            const quantity = Math.min(available, requested.get(index) || 0);
            return { index, item, available, quantity, unitPrice: getUnitPrice(item), unitCost: getUnitCost(item) };
        }).filter(row => row.quantity > 0);
        if (!selected.length) throw new Error('Nenhum produto foi selecionado para cancelamento.');

        const activeGoodsValue = items.reduce((sum, item) => sum + getUnitPrice(item) * (parseInt(item.quantity, 10) || 0), 0);
        const selectedGoodsValue = selected.reduce((sum, row) => sum + row.unitPrice * row.quantity, 0);
        const activeQuantity = items.reduce((sum, item) => sum + Math.max(0, parseInt(item.quantity, 10) || 0), 0);
        const selectedQuantity = selected.reduce((sum, row) => sum + row.quantity, 0);
        const fraction = Math.min(1, Math.max(0, activeGoodsValue > 0 ? selectedGoodsValue / activeGoodsValue : selectedQuantity / Math.max(1, activeQuantity)));
        const isTotal = payload.mode === 'total' || selectedQuantity >= activeQuantity;
        const priorRefunds = (sale.cancellations || []).reduce((sum, event) => sum + (Number(event.refundAmount) || 0), 0);
        const effectiveReceived = roundMoney(Math.max(0, receivedCash - priorRefunds));
        const currentContractValue = roundMoney(sale.totalPrice);
        const remainingContractValue = isTotal ? 0 : roundMoney(currentContractValue * (1 - fraction));
        const refundAmount = isTotal ? effectiveReceived : roundMoney(Math.max(0, effectiveReceived - remainingContractValue));
        const remainingToPay = isTotal ? 0 : roundMoney(Math.max(0, remainingContractValue - effectiveReceived));
        const canceledContractValue = roundMoney(currentContractValue - remainingContractValue);

        const event = {
            id: 'sale-cancel-' + Date.now(), type: isTotal ? 'total' : 'partial', date: payload.date, createdAt: new Date().toISOString(),
            reason: payload.reason, fraction, canceledContractValue, refundAmount, remainingContractValue, remainingToPay, effectivePaidBeforeCancellation: effectiveReceived,
            items: selected.map(row => ({ productId: row.item.productId || null, productName: row.item.productName || row.item.name || 'Produto', quantity: row.quantity, unitPrice: row.unitPrice, amount: roundMoney(row.unitPrice * row.quantity) }))
        };
        const updateData = { cancellations: [...(sale.cancellations || []), event], lastCancellationAt: payload.date, lastCancellationReason: payload.reason };

        if (isTotal) {
            updateData.status = 'canceled'; updateData.cancelReason = payload.reason; updateData.canceledAt = serverTimestamp();
        } else {
            const selectedByIndex = new Map(selected.map(row => [row.index, row.quantity]));
            updateData.items = items.map((item, index) => {
                const oldQty = Math.max(0, parseInt(item.quantity, 10) || 0);
                const newQty = Math.max(0, oldQty - (selectedByIndex.get(index) || 0));
                const unitPrice = getUnitPrice(item), unitCost = getUnitCost(item);
                return { ...item, quantity: newQty, price: roundMoney(unitPrice * newQty), cost: roundMoney(unitCost * newQty), unitPrice, unitCost };
            }).filter(item => (parseInt(item.quantity, 10) || 0) > 0);
            updateData.productsTotal = roundMoney(updateData.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0));
            updateData.totalCost = roundMoney(updateData.items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0));
            updateData.totalDiscount = roundMoney(updateData.items.reduce((sum, item) => sum + (Number(item.unitDiscount) || 0) * (Number(item.quantity) || 0), 0));
            updateData.totalPrice = remainingContractValue;

            if (Array.isArray(sale.installments)) {
                const openIndexes = sale.installments.map((inst, index) => (!inst.paid ? index : -1)).filter(index => index >= 0);
                const totalCents = Math.max(0, Math.round(remainingToPay * 100));
                const baseCents = openIndexes.length ? Math.floor(totalCents / openIndexes.length) : 0;
                let remainder = openIndexes.length ? totalCents - baseCents * openIndexes.length : 0;
                updateData.installments = sale.installments.map((inst, index) => {
                    if (inst.paid) return inst;
                    const shareCents = baseCents + (remainder-- > 0 ? 1 : 0);
                    const amount = shareCents / 100;
                    return { ...inst, amount, paid: amount <= 0, paidAt: null, settledByCancellation: amount <= 0 };
                });
            }
            updateData.status = remainingToPay > 0.004 ? 'active' : 'completed';
            updateData.partiallyCanceled = true;
        }

        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', sale.id), updateData);
        for (const row of selected) {
            if (!row.item.productId) continue;
            const prodRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'products', row.item.productId);
            try {
                const prodSnap = await getDoc(prodRef);
                if (prodSnap.exists()) await updateDoc(prodRef, { quantity: (parseInt(prodSnap.data().quantity, 10) || 0) + row.quantity });
            } catch (error) { console.error('Erro ao restaurar estoque do cancelamento:', error); }
        }
        setCancelModal({ open: false, saleId: null }); setSelectedSaleDetail(null);
    };`,
    'o cancelamento total e parcial das vendas'
  );

  const cancelRender = `        React.createElement(ConfirmModal, { isOpen: cancelModal.open, title: "Cancelar venda?", message: "Esta ação irá devolver os produtos ao estoque e invalidar os pagamentos.", isCancel: true, reasonValue: cancelModal.reason, onReasonChange: value => setCancelModal(previous => ({...previous, reason: value})), onClose: () => setCancelModal({ open: false, saleId: null, reason: '' }), onConfirm: confirmCancelSale }),`;
  const replacement = `        React.createElement(SaleCancellationModal, {\n            isOpen: cancelModal.open,\n            sale: cancelModal.saleId ? sales.find(s => s.id === cancelModal.saleId) : null,\n            onClose: () => setCancelModal({ open: false, saleId: null }),\n            onConfirm: confirmCancelSale\n        }),`;
  if (!source.includes(cancelRender)) throw new Error('Não foi possível preparar o modal de cancelamento.');
  return source.replace(cancelRender, replacement);
};
