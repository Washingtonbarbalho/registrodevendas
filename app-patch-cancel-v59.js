const replaceBlock = (source, startMarker, endMarker, replacement, label) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Não foi possível preparar ${label}.`);
  return source.slice(0, start) + replacement + "\n\n" + source.slice(end);
};

export const applyCancelPatch = source => {
  return replaceBlock(
    source,
    "    const handleCancelSaleLogic = async (saleId, reason) => {",
    "    const requestDelete = (type, id) =>",
    String.raw`    const handleCancelSaleLogic = async (saleId, reason) => {
        const sale = sales.find(s => s.id === saleId);
        if (!sale) return;
        const roundMoney = value => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;
        const historyAmount = item => !item || item.type === 'abatement' ? 0 : roundMoney((Number(item.amount) || 0) + (item.type === 'full_surplus' ? (Number(item.surplus) || 0) : 0));
        const getUnitPrice = item => Number(item?.unitPrice) > 0 ? Number(item.unitPrice) : roundMoney((Number(item?.price) || 0) / Math.max(1, parseInt(item?.quantity, 10) || 1));
        const getUnitCost = item => Number(item?.unitCost) > 0 ? Number(item.unitCost) : roundMoney((Number(item?.cost) || 0) / Math.max(1, parseInt(item?.quantity, 10) || 1));
        const allocateMoney = (total, rows) => {
            const totalCents = Math.max(0, Math.round(roundMoney(total) * 100));
            const weights = rows.map(row => Math.max(0, row.unitPrice * row.quantity));
            const weightTotal = weights.reduce((sum, value) => sum + value, 0);
            if (!rows.length || totalCents <= 0 || weightTotal <= 0) return rows.map(() => 0);
            let used = 0;
            return rows.map((row, index) => {
                const cents = index === rows.length - 1 ? totalCents - used : Math.floor(totalCents * (weights[index] / weightTotal));
                used += cents;
                return cents / 100;
            });
        };
        const receivedOnTermSale = (() => {
            let total = Number(sale.entryAmount) || 0;
            (sale.installments || []).forEach(inst => {
                const history = Array.isArray(inst.history) ? inst.history : [];
                if (history.length) history.forEach(item => { total += historyAmount(item); });
                else if (inst.paid && inst.paidAt) total += Number(inst.originalAmount || inst.amount) || 0;
            });
            return roundMoney(total);
        })();

        const items = (Array.isArray(sale.items) ? sale.items : []).map(item => ({
            item,
            quantity: Math.max(0, parseInt(item.quantity, 10) || 0),
            unitPrice: getUnitPrice(item),
            unitCost: getUnitCost(item)
        })).filter(row => row.quantity > 0);
        const canceledCostAmount = roundMoney(items.reduce((sum, row) => sum + row.unitCost * row.quantity, 0));
        const currentContractValue = roundMoney(sale.totalPrice);
        const isDirectSale = sale.saleType === 'direct';
        const isCardSale = isDirectSale && (sale.paymentMethod === 'credit' || sale.paymentMethod === 'debit');
        const feeResponsibility = isCardSale ? (sale.feeConfig?.type === 'com_juros' ? 'customer' : 'store') : null;
        const priorCustomerRefunds = (sale.cancellations || []).reduce((sum, event) => sum + (Number(event.customerRefundAmount ?? event.refundAmount) || 0), 0);
        const priorStoreImpacts = (sale.cancellations || []).reduce((sum, event) => sum + (Number(event.storeImpactAmount ?? event.refundAmount) || 0), 0);

        let customerRefundAmount = 0;
        let storeImpactAmount = 0;
        let effectivePaidBeforeCancellation = 0;
        let storeNetBeforeCancellation = 0;

        if (isDirectSale) {
            const originalStoreNet = sale.netReceived !== undefined && sale.netReceived !== null && sale.netReceived !== '' ? roundMoney(sale.netReceived) : currentContractValue;
            storeNetBeforeCancellation = roundMoney(Math.max(0, originalStoreNet - priorStoreImpacts));
            effectivePaidBeforeCancellation = currentContractValue;
            customerRefundAmount = currentContractValue;
            storeImpactAmount = storeNetBeforeCancellation;
        } else {
            effectivePaidBeforeCancellation = roundMoney(Math.max(0, receivedOnTermSale - priorCustomerRefunds));
            customerRefundAmount = effectivePaidBeforeCancellation;
            storeImpactAmount = effectivePaidBeforeCancellation;
            storeNetBeforeCancellation = effectivePaidBeforeCancellation;
        }

        const profitImpactAmount = roundMoney((isDirectSale ? storeImpactAmount : currentContractValue) - canceledCostAmount);
        const customerAllocations = allocateMoney(customerRefundAmount, items);
        const storeAllocations = allocateMoney(storeImpactAmount, items);
        const contractAllocations = allocateMoney(currentContractValue, items);
        const now = new Date().toISOString();
        const event = {
            id: 'sale-cancel-' + Date.now(),
            type: 'total',
            date: getBrazilDateString(),
            createdAt: now,
            reason: String(reason || '').trim(),
            fraction: 1,
            canceledContractValue: currentContractValue,
            canceledCostAmount,
            profitImpactAmount,
            customerRefundAmount,
            storeImpactAmount,
            refundAmount: storeImpactAmount,
            remainingContractValue: 0,
            remainingToPay: 0,
            effectivePaidBeforeCancellation,
            storeNetBeforeCancellation,
            paymentMethod: sale.paymentMethod || null,
            isCardCancellation: isCardSale,
            feeResponsibility,
            feePercent: isCardSale ? Number(sale.feeConfig?.percent) || 0 : 0,
            items: items.map((row, index) => {
                const costAmount = roundMoney(row.unitCost * row.quantity);
                const profitBaseAmount = isDirectSale ? roundMoney(storeAllocations[index]) : roundMoney(contractAllocations[index]);
                return {
                    productId: row.item.productId || null,
                    productName: row.item.productName || row.item.name || 'Produto',
                    quantity: row.quantity,
                    unitPrice: row.unitPrice,
                    unitCost: row.unitCost,
                    amount: roundMoney(row.unitPrice * row.quantity),
                    canceledCostAmount: costAmount,
                    profitImpactAmount: roundMoney(profitBaseAmount - costAmount),
                    customerPaidAmount: roundMoney(customerAllocations[index]),
                    storeNetAmount: roundMoney(storeAllocations[index])
                };
            })
        };

        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', saleId), {
            status: 'canceled',
            cancelReason: String(reason || '').trim(),
            canceledAt: serverTimestamp(),
            cancellations: [...(sale.cancellations || []), event],
            lastCancellationAt: event.date,
            lastCancellationReason: event.reason
        });

        for (const row of items) {
            if (!row.item.productId) continue;
            const prodRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'products', row.item.productId);
            try {
                const prodSnap = await getDoc(prodRef);
                if (prodSnap.exists()) {
                    const currentQty = parseInt(prodSnap.data().quantity, 10) || 0;
                    await updateDoc(prodRef, { quantity: currentQty + row.quantity });
                }
            } catch (error) {
                console.error('Erro ao restaurar estoque do cancelamento:', error);
            }
        }
    };

    const confirmCancelSale = async () => {
        const reason = String(cancelModal.reason || '').trim();
        if (!reason) return alert('Informe o motivo do cancelamento.');
        await handleCancelSaleLogic(cancelModal.saleId, reason);
        setCancelModal({ open: false, saleId: null, reason: '' });
        setSelectedSaleDetail(null);
    };`,
    'o cancelamento total das vendas'
  );
};
