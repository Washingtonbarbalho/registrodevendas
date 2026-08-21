const marker = `        const newMovement = {\n            id: Date.now().toString(),\n            type: movType,\n            quantity: movQty,\n            unitCost: isEntry && movType === 'compra' ? movCost : 0,\n            date: new Date().toISOString(),\n            previousQty: currentQty,\n            newQty: newQty,\n            notes: movementInfo.notes || ''\n        };\n\n        const updatedMovements = p.movements ? [...p.movements, newMovement] : [newMovement];\n\n        await updateDoc(productRef, {\n            quantity: newQty,\n            costPrice: newCost,\n            movements: updatedMovements\n        });\n\n        setStockMovementData({ open: false, data: null });\n        setProductDetailsData({ open: true, data: { ...p, quantity: newQty, costPrice: newCost, movements: updatedMovements }});`;

const replacement = `        const movementDate = new Date().toISOString();
        if (movType === 'devolucao_fornecedor') {
            const purchaseId = movementInfo.purchaseMovementId;
            const purchase = (p.movements || []).find(movement => movement.id === purchaseId && movement.type === 'compra');
            if (!purchase) return alert('Compra de origem não encontrada.');
            if (movQty > currentQty) return alert('Não há estoque suficiente para devolver esta quantidade.');

            const previousEvents = Array.isArray(purchase.financialCancellations) ? purchase.financialCancellations : [];
            const alreadyReturned = previousEvents.reduce((sum, event) => sum + (parseInt(event.quantity, 10) || 0), 0);
            const purchaseQty = parseInt(purchase.quantity, 10) || 0;
            const remainingReturn = Math.max(0, purchaseQty - alreadyReturned);
            if (movQty > remainingReturn) return alert('A quantidade informada é maior que o saldo disponível desta compra.');

            const purchaseUnitCost = Number(purchase.unitCost) || 0;
            const originalPurchaseAmount = Math.round(((purchaseQty * purchaseUnitCost) + Number.EPSILON) * 100) / 100;
            const eventAmount = Math.round(((movQty * purchaseUnitCost) + Number.EPSILON) * 100) / 100;
            const paymentPlan = Array.isArray(purchase.financialInstallments) ? purchase.financialInstallments : [];
            const paidPlanAmount = paymentPlan.length
                ? paymentPlan.filter(item => item && item.paid).reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
                : (purchase.financialPaid ? (Number(purchase.batchTotal) || originalPurchaseAmount) : 0);
            const batchPurchaseTotal = Math.max(originalPurchaseAmount, Number(purchase.batchTotal) || originalPurchaseAmount);
            const productShare = batchPurchaseTotal > 0 ? originalPurchaseAmount / batchPurchaseTotal : 1;
            const paidAmount = Math.round(((paidPlanAmount * productShare) + Number.EPSILON) * 100) / 100;
            const priorAccountReductions = previousEvents.reduce((sum, event) => {
                if (event && event.accountReductionAmount !== undefined) return sum + (Number(event.accountReductionAmount) || 0);
                return sum + (event && event.hadCashOut === false ? (Number(event.amount) || 0) : 0);
            }, 0);
            const openLiability = Math.max(0, originalPurchaseAmount - priorAccountReductions - paidAmount);
            const accountReductionAmount = Math.round((Math.min(eventAmount, openLiability) + Number.EPSILON) * 100) / 100;
            const cashRefundAmount = Math.round((Math.max(0, eventAmount - accountReductionAmount) + Number.EPSILON) * 100) / 100;

            const event = {
                id: 'supplier-return-' + Date.now(),
                date: movementDate.split('T')[0],
                createdAt: movementDate,
                reason: movementInfo.notes || 'Devolução ao fornecedor',
                quantity: movQty,
                amount: eventAmount,
                accountReductionAmount,
                cashRefundAmount,
                hadCashOut: cashRefundAmount > 0
            };
            const totalReturned = alreadyReturned + movQty;
            const updatedPurchase = {
                ...purchase,
                financialCancellations: [...previousEvents, event],
                financialCanceled: totalReturned >= purchaseQty,
                financialPartiallyCanceled: totalReturned < purchaseQty,
                financialCanceledAt: totalReturned >= purchaseQty ? event.date : (purchase.financialCanceledAt || null),
                financialCanceledAtDateTime: totalReturned >= purchaseQty ? movementDate : (purchase.financialCanceledAtDateTime || null),
                financialCancelReason: totalReturned >= purchaseQty ? event.reason : (purchase.financialCancelReason || '')
            };
            const returnMovement = {
                id: 'return-' + Date.now(),
                type: 'devolucao_fornecedor',
                quantity: movQty,
                unitCost: purchaseUnitCost,
                date: movementDate,
                previousQty: currentQty,
                newQty: currentQty - movQty,
                notes: event.reason,
                linkedPurchaseMovementId: purchase.id
            };
            const updatedMovements = (p.movements || []).map(movement => movement.id === purchase.id ? updatedPurchase : movement).concat(returnMovement);
            await updateDoc(productRef, { quantity: currentQty - movQty, movements: updatedMovements });
            setStockMovementData({ open: false, data: null });
            setProductDetailsData({ open: true, data: { ...p, quantity: currentQty - movQty, movements: updatedMovements } });
            return;
        }

        const purchasePaymentMethod = movType === 'compra' ? (movementInfo.paymentMethod || 'pix') : null;
        const purchaseDeferred = movType === 'compra' && (purchasePaymentMethod === 'credit' || purchasePaymentMethod === 'term');
        const rawInstallments = purchaseDeferred && Array.isArray(movementInfo.paymentInstallments) ? movementInfo.paymentInstallments : [];
        const paymentInstallments = rawInstallments.map((item, index) => ({
            number: parseInt(item && item.number, 10) || index + 1,
            dueDate: String((item && item.dueDate) || movementInfo.paymentDueDate || '').split('T')[0],
            amount: Math.round(((Number(item && item.amount) || 0) + Number.EPSILON) * 100) / 100,
            paid: false,
            paidAt: null,
            paidAtDateTime: null
        }));
        const newMovement = {
            id: Date.now().toString(),
            type: movType,
            quantity: movQty,
            unitCost: isEntry && movType === 'compra' ? movCost : 0,
            date: movementDate,
            previousQty: currentQty,
            newQty,
            notes: movementInfo.notes || '',
            paymentMethod: purchasePaymentMethod,
            paymentDueDate: purchaseDeferred ? (movementInfo.paymentDueDate || null) : null,
            paymentFirstDueDate: purchaseDeferred ? (movementInfo.paymentDueDate || null) : null,
            paymentInstallmentsCount: purchaseDeferred ? Math.max(1, parseInt(movementInfo.paymentInstallmentsCount, 10) || paymentInstallments.length || 1) : 1,
            financialInstallments: purchaseDeferred ? paymentInstallments : [],
            financialPaid: movType === 'compra' ? !purchaseDeferred : null,
            financialPaidAt: movType === 'compra' && !purchaseDeferred ? movementDate.split('T')[0] : null,
            financialPaidAtDateTime: movType === 'compra' && !purchaseDeferred ? movementDate : null
        };
        const updatedMovements = p.movements ? [...p.movements, newMovement] : [newMovement];
        await updateDoc(productRef, { quantity: newQty, costPrice: newCost, movements: updatedMovements });
        setStockMovementData({ open: false, data: null });
        setProductDetailsData({ open: true, data: { ...p, quantity: newQty, costPrice: newCost, movements: updatedMovements } });`;

export const applyStockPatch = source => {
  if (!source.includes(marker)) throw new Error('Não foi possível preparar as movimentações de estoque, parcelamentos e devoluções ao fornecedor.');
  return source.replace(marker, replacement);
};
