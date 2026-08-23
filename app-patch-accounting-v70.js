const replaceRequired = (source, marker, replacement, label) => {
  if (!source.includes(marker)) throw new Error(`Não foi possível preparar ${label}.`);
  return source.replace(marker, replacement);
};

const replaceBlock = (source, startMarker, endMarker, replacement, label) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Não foi possível preparar ${label}.`);
  return source.slice(0, start) + replacement + '\n\n' + source.slice(end);
};

export const applyAccountingPatch = source => {
  const inventoryImport = "import { aggregateSaleItems, buildSaleInventoryPlan } from './inventory-reliability-v69.js';";
  source = replaceRequired(
    source,
    inventoryImport,
    inventoryImport + "\nimport { applyInstallmentPayment, buildFinancialLedger, fromCents, getHistoryCashAmount, getInstallmentFaceAmount, getRealizedSalesProfit, getSalesAccrualSummary, isTermSale, normalizeSaleMoney, reverseInstallmentPayment, sumMoney, summarizeFinancialLedger, toCents } from './financial-core-v70.js';",
    'os cálculos financeiros compartilhados'
  );

  source = replaceRequired(
    source,
    '        const requestedItems = aggregateSaleItems(data?.items);',
    '        const normalizedSale = normalizeSaleMoney(data);\n        const requestedItems = aggregateSaleItems(normalizedSale.items);',
    'a normalização monetária antes de gravar a venda'
  );
  source = replaceRequired(
    source,
    '                transaction.set(saleRef, {\n                    ...data,\n                    inventoryOperationId:',
    '                transaction.set(saleRef, {\n                    ...normalizedSale,\n                    inventoryOperationId:',
    'a gravação de valores e parcelas exatos'
  );

  source = replaceRequired(
    source,
    '            const paidValue = historyItem ? historyItem.amount : installment.originalAmount || installment.amount;',
    '            const paidValue = historyItem ? getHistoryCashAmount(historyItem) : installment.originalAmount || installment.amount;',
    'o valor integral do pagamento nos recibos enviados ao cliente'
  );

  source = replaceBlock(
    source,
    '    const dashboardTotals = useMemo(() => {',
    '    const handleSaveProduct = async (data) => {',
    String.raw`    const dashboardTotals = useMemo(() => {
        const validSales = sales.filter(sale => sale.status !== 'canceled');
        const accrual = getSalesAccrualSummary(sales, dashStartDate, dashEndDate);
        const saleCash = summarizeFinancialLedger(buildFinancialLedger({ sales }), dashStartDate, dashEndDate);
        const overdueList = [];
        const upcomingList = [];
        const today = getBrazilDateString();
        const nextWeek = addDays(today, 7);

        validSales.forEach(sale => {
            (sale.installments || []).forEach((installment, index) => {
                if (installment.paid || toCents(installment.amount) <= 0) return;
                const itemData = {
                    ...installment,
                    sale,
                    saleId: sale.id,
                    customerName: sale.customerName,
                    customerPhone: sale.customerPhone,
                    installmentIndex: index,
                    isOverdue: installment.dueDate < today
                };
                if (installment.dueDate < today) overdueList.push(itemData);
                else if (installment.dueDate <= nextWeek) upcomingList.push(itemData);
            });
        });

        const termInstallments = validSales.filter(isTermSale)
            .flatMap(sale => (sale.installments || []).filter(installment => !installment.paid));

        return {
            totalReceivable: sumMoney(termInstallments, installment => installment.amount),
            totalReceived: saleCash.balance,
            totalOverdue: sumMoney(overdueList, installment => installment.amount),
            totalUpcoming: sumMoney(upcomingList, installment => installment.amount),
            estimatedProfit: accrual.profit,
            realProfit: getRealizedSalesProfit(sales, dashStartDate, dashEndDate),
            overdueList,
            upcomingList
        };
    }, [sales, dashStartDate, dashEndDate]);`,
    'a conciliação da visão geral com os relatórios'
  );

  source = replaceBlock(
    source,
    '    const handleConfirmPayment = async (amountPaid, datePaid) => {',
    '    const handleDeletePayment = async () => {',
    String.raw`    const handleConfirmPayment = async (amountPaid, datePaid) => {
        const { saleId, index } = paymentModal;
        if (!saleId) return;
        const saleRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', saleId);
        const timestamp = new Date().toISOString();

        try {
            await runTransaction(db, async transaction => {
                const snapshot = await transaction.get(saleRef);
                if (!snapshot.exists()) throw new Error('A venda não foi encontrada.');
                const latestSale = snapshot.data();
                if (latestSale.status === 'canceled') throw new Error('Não é possível receber uma venda cancelada.');

                const payment = applyInstallmentPayment(latestSale.installments, index, amountPaid, datePaid, timestamp);
                transaction.update(saleRef, {
                    installments: payment.installments,
                    status: payment.allPaid ? 'completed' : 'active',
                    financialUpdatedAt: serverTimestamp()
                });
            });

            setPaymentModal({ open: false, saleId: null, index: null, item: null, isLast: false });
        } catch (error) {
            console.error('Pagamento não registrado:', error);
            alert(error?.message || 'Não foi possível registrar o pagamento. Nenhuma parcela foi alterada.');
        }
    };`,
    'a distribuição atômica do pagamento entre todas as parcelas'
  );

  source = replaceBlock(
    source,
    '    const handleDeletePayment = async () => {',
    '    const confirmDeletePayment = ',
    String.raw`    const handleDeletePayment = async () => {
        const { saleId, instIndex, histIndex, historyItem } = deletePaymentModal;
        if (!saleId) return;
        const saleRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', saleId);

        try {
            await runTransaction(db, async transaction => {
                const snapshot = await transaction.get(saleRef);
                if (!snapshot.exists()) throw new Error('A venda não foi encontrada.');
                const latestSale = snapshot.data();
                if (latestSale.status === 'canceled') throw new Error('Não é possível alterar pagamentos de uma venda cancelada.');

                const reversed = reverseInstallmentPayment(latestSale.installments, instIndex, histIndex, historyItem?.timestamp);
                transaction.update(saleRef, {
                    installments: reversed.installments,
                    status: reversed.allPaid ? 'completed' : 'active',
                    financialUpdatedAt: serverTimestamp()
                });
            });

            setDeletePaymentModal({ open: false, saleId: null, instIndex: null, histIndex: null, historyItem: null });
        } catch (error) {
            console.error('Pagamento não estornado:', error);
            alert(error?.message || 'Não foi possível estornar o pagamento. Nenhuma parcela foi alterada.');
        }
    };`,
    'o estorno completo e atômico de pagamentos excedentes'
  );

  source = replaceBlock(
    source,
    '    const saveEditedInstallment = async (newData) => {',
    '    const handleShowPixCode = (sale, installment) => {',
    String.raw`    const saveEditedInstallment = async (newData) => {
        const { saleId, installmentIndex } = editInstallmentModal;
        if (!saleId) return;
        const saleRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', saleId);

        try {
            await runTransaction(db, async transaction => {
                const snapshot = await transaction.get(saleRef);
                if (!snapshot.exists()) throw new Error('A venda não foi encontrada.');
                const latestSale = snapshot.data();
                if (latestSale.status === 'canceled') throw new Error('Não é possível editar uma venda cancelada.');

                const installments = (latestSale.installments || []).map(installment => ({ ...installment }));
                const current = installments[installmentIndex];
                if (!current) throw new Error('A parcela informada não foi encontrada.');
                const oldCents = Math.max(0, toCents(current.amount));
                const nextCents = Math.max(0, toCents(newData?.amount));
                const difference = nextCents - oldCents;
                const edited = {
                    ...current,
                    ...newData,
                    amount: fromCents(nextCents),
                    originalAmount: fromCents(Math.max(0, toCents(getInstallmentFaceAmount(current)) + difference)),
                    history: Array.isArray(current.history) ? current.history : []
                };

                if (nextCents <= 0 && !current.paid) {
                    edited.paid = true;
                    edited.paidAt = getBrazilDateString();
                } else if (nextCents > 0) {
                    edited.paid = false;
                    edited.paidAt = null;
                }

                installments[installmentIndex] = edited;
                const allPaid = installments.every(installment => installment.paid || toCents(installment.amount) <= 0);
                transaction.update(saleRef, {
                    installments,
                    totalPrice: fromCents(Math.max(0, toCents(latestSale.totalPrice) + difference)),
                    status: allPaid ? 'completed' : 'active',
                    financialUpdatedAt: serverTimestamp()
                });
            });
        } catch (error) {
            console.error('Parcela não atualizada:', error);
            alert(error?.message || 'Não foi possível atualizar a parcela.');
        }
    };`,
    'a edição de parcelas sem diferenças de centavos'
  );

  return source;
};
