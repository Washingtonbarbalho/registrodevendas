// Aplicação consolidada v80 — código-fonte principal do sistema.
import React, { useState, useEffect, useMemo } from 'https://esm.sh/react@18.2.0';
import { createRoot } from 'https://esm.sh/react-dom@18.2.0/client';
import { Users, User, LogOut, Lock, LayoutDashboard, Receipt, WalletCards, Package, Contact, Store, ShieldCheck, BadgePercent, Banknote, Plus } from 'https://esm.sh/lucide-react@0.292.0';

// Firebase
import { app, db, auth, APP_ID } from './firebase-config.js?v=80';
import { collection, onSnapshot, query, doc, getDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, setDoc, runTransaction, writeBatch } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// Utils
import { getCurrentMonthStart, getCurrentMonthEnd, getBrazilDateString, addDays, formatCurrency, formatDate } from './utils.js?v=80';
import { aggregateSaleItems, buildSaleInventoryPlan } from './inventory-reliability-v69.js?v=80';
import { applyInstallmentPayment, buildFinancialLedger, fromCents, getHistoryCashAmount, getInstallmentFaceAmount, getRealizedSalesProfit, getSalesAccrualSummary, isTermSale, normalizeSaleMoney, reverseInstallmentPayment, sumMoney, summarizeFinancialLedger, toCents } from './financial-core-v70.js?v=80';

// Modais
import { 
    UserProfileModal, CustomerFormModal, ProductDetailsModal, EditInstallmentModal, 
    SaleDetailsModal, PixCodeModal, InstallmentListModal, PaymentConfirmationModal, 
    ConfirmModal, WhatsAppChooserModal, ProductModal
} from './modals-runtime-v75.js?v=80';
import { StockMovementModal } from './stock-movement-modal-v68.js?v=80';

// Telas Secundárias
import { AdminUsersPanel } from './auth-admin.js?v=80';
import { AuthScreen } from './auth-screen-v71.js?v=80';
import { NewSaleScreen } from './nova-venda-runtime-v75.js?v=80';

// Abas do Dashboard
import { AbaVisaoGeral } from './aba-visao-geral-fixed.js?v=80';
import { AbaVendas } from './aba-vendas-v71.js?v=80';
import { AbaProdutos } from './aba-produtos-v67.js?v=80';
import { AbaClientes } from './aba-clientes-runtime-v75.js?v=80';
import { AbaTaxas } from './aba-taxas.js?v=80';
import { AbaFinanceiro } from './aba-financeiro-v68.js?v=80';
import { BatchStockModal } from './batch-stock-modal-v68.js?v=80';
import { AbaRelatorios } from './aba-relatorios-v73.js?v=80';
import { AbaComercial } from './aba-comercial-v74.js?v=80';
import { normalizePaymentSettings } from './payment-settings.js?v=80';
import { shareSalePdf } from './sale-pdf-v65.js?v=80';
import { readSharedAnalysisPeriod, resolveAnalysisPeriod, writeSharedAnalysisPeriod } from './analysis-period-v79.js?v=80';

const Dashboard = ({ user, userProfile, onLogout }) => {
    const [view, setView] = useState('dashboard');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showAdminPanel, setShowAdminPanel] = useState(false);

    useEffect(() => {
        if (!mobileMenuOpen) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const closeOnEscape = event => {
            if (event.key === 'Escape') setMobileMenuOpen(false);
        };
        const closeOnDesktop = () => {
            if (window.innerWidth >= 1024) setMobileMenuOpen(false);
        };
        window.addEventListener('keydown', closeOnEscape);
        window.addEventListener('resize', closeOnDesktop);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', closeOnEscape);
            window.removeEventListener('resize', closeOnDesktop);
        };
    }, [mobileMenuOpen]);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [sales, setSales] = useState([]);
    const [paymentSettings, setPaymentSettings] = useState(() => normalizePaymentSettings(userProfile?.paymentSettings));
    const [loadingData, setLoadingData] = useState(true);
    
    const [newSaleMode, setNewSaleMode] = useState(null);

    const [dashPeriod, setDashPeriod] = useState(() => readSharedAnalysisPeriod(user.uid).period);
    const [dashStartDate, setDashStartDate] = useState(() => readSharedAnalysisPeriod(user.uid).startDate);
    const [dashEndDate, setDashEndDate] = useState(() => readSharedAnalysisPeriod(user.uid).endDate);

    const ITEMS_PER_PAGE = 10;
    const [productsPage, setProductsPage] = useState(1);
    const [customersPage, setCustomersPage] = useState(1);

    const [productSearch, setProductSearch] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');

    const [productDetailsData, setProductDetailsData] = useState({ open: false, data: null });
    const [productModalData, setProductModalData] = useState({ open: false, data: null });
    const [stockMovementData, setStockMovementData] = useState({ open: false, data: null });
    const [batchStockOpen, setBatchStockOpen] = useState(false);

    const [customerModalData, setCustomerModalData] = useState({ open: false, data: null });
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    
    const [selectedSaleDetail, setSelectedSaleDetail] = useState(null);
    const activeSaleDetails = selectedSaleDetail ? sales.find(s => s.id === selectedSaleDetail.id) : null;

    const [deleteModal, setDeleteModal] = useState({ open: false, type: null, id: null });
    const [cancelModal, setCancelModal] = useState({ open: false, saleId: null, reason: '' });
    
    const [editInstallmentModal, setEditInstallmentModal] = useState({ open: false, saleId: null, installmentIndex: null, data: null });
    const [installmentListModal, setInstallmentListModal] = useState({ open: false, type: null, data: [] });
    const [paymentModal, setPaymentModal] = useState({ open: false, saleId: null, index: null, item: null, isLast: false });
    const [deletePaymentModal, setDeletePaymentModal] = useState({ open: false, saleId: null, instIndex: null, histIndex: null, historyItem: null });
    
    const [waChooserModal, setWaChooserModal] = useState({ open: false, phone: '', message: '', pdfData: null });
    const [pixModalData, setPixModalData] = useState({ open: false, amount: 0, txid: '' });

    useEffect(() => {
        const customersRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'customers');
        const productsRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'products');
        const salesRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'sales');
        const profileRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'info');
        
        const unsubC = onSnapshot(query(customersRef), s => setCustomers(s.docs.map(d => ({id:d.id, ...d.data()}))));
        const unsubP = onSnapshot(query(productsRef), s => setProducts(s.docs.map(d => ({id:d.id, ...d.data()}))));
        const unsubS = onSnapshot(query(salesRef), s => { setSales(s.docs.map(d => ({id:d.id, ...d.data()}))); setLoadingData(false); });
        const unsubSettings = onSnapshot(
            profileRef,
            snapshot => setPaymentSettings(normalizePaymentSettings(snapshot.data()?.paymentSettings)),
            error => {
                console.error('Erro ao carregar taxas e juros:', error);
                setPaymentSettings(normalizePaymentSettings());
            }
        );
        return () => { unsubC(); unsubP(); unsubS(); unsubSettings(); };
    }, [user.uid]);

    useEffect(() => {
        if (dashPeriod === 'custom') return;
        const selected = resolveAnalysisPeriod(dashPeriod, getBrazilDateString());
        setDashStartDate(selected.startDate);
        setDashEndDate(selected.endDate);
    }, [dashPeriod]);
    useEffect(() => {
        writeSharedAnalysisPeriod(user.uid, { period: dashPeriod, startDate: dashStartDate, endDate: dashEndDate });
    }, [user.uid, dashPeriod, dashStartDate, dashEndDate]);
    useEffect(() => setProductsPage(1), [productSearch]);
    useEffect(() => setCustomersPage(1), [customerSearch]);


    const sortedProducts = useMemo(() => {
        const compareProducts = (a, b) => {
            const aHasStock = (Number(a.quantity) || 0) > 0;
            const bHasStock = (Number(b.quantity) || 0) > 0;
            if (aHasStock !== bHasStock) return aHasStock ? -1 : 1;
            return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' });
        };
        const list = [...products].sort(compareProducts);
        if (!productSearch) return list;
        const term = productSearch.toLowerCase();
        return list.filter(p => String(p.name || '').toLowerCase().includes(term) || String(p.code || '').includes(productSearch));
    }, [products, productSearch]);

    const sortedCustomers = useMemo(() => {
        const list = [...customers].sort((a, b) => a.name.localeCompare(b.name));
        if (!customerSearch) return list;
        return list.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.document && c.document.includes(customerSearch)));
    }, [customers, customerSearch]);

    const dashboardTotals = useMemo(() => {
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
    }, [sales, dashStartDate, dashEndDate]);

    const handleSaveProduct = async (data) => {
        if (productModalData.data) {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'products', productModalData.data.id), data);
        } else {
            await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'products'), { ...data, createdAt: serverTimestamp() });
        }
        setProductModalData({ open: false, data: null });
        if (productDetailsData.open && productModalData.data) {
            const updatedProduct = { ...productModalData.data, ...data };
            setProductDetailsData({ open: true, data: updatedProduct });
        }
    };

    const handleStockMovement = async (productId, movementInfo) => {
        const productRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'products', productId);
        const p = products.find(prod => prod.id === productId);
        if (!p) return;

        const currentQty = parseInt(p.quantity) || 0;
        const currentCost = parseFloat(p.costPrice) || 0;
        const movQty = parseInt(movementInfo.quantity) || 0;
        const movCost = parseFloat(movementInfo.unitCost) || 0;
        const movType = movementInfo.type; 

        let newQty = currentQty;
        let newCost = currentCost;
        let isEntry = ['compra', 'ajuste_entrada', 'devolucao'].includes(movType);

        if (movQty <= 0) return alert('Informe uma quantidade inteira maior que zero.');
        if (!isEntry && movQty > currentQty) return alert('Estoque disponível é ' + currentQty + ' un.');

        if (isEntry) {
            newQty = currentQty + movQty;
            if (movType === 'compra' && movQty > 0) {
                const totalCurrentValue = currentQty * currentCost;
                const totalAddedValue = movQty * movCost;
                newCost = (totalCurrentValue + totalAddedValue) / newQty;
            }
        } else {
            newQty = currentQty - movQty;
        }

        const movementDate = new Date().toISOString();
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
        setProductDetailsData({ open: true, data: { ...p, quantity: newQty, costPrice: newCost, movements: updatedMovements } });
    };

    const handleSaveCustomer = async (data) => {
        if (customerModalData.data) await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'customers', customerModalData.data.id), data);
        else await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'customers'), { ...data, createdAt: serverTimestamp() });
        setCustomerModalData({ open: false, data: null });
    };
    
    const handleAddSale = async (data) => {
        const saleRef = doc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'sales'));
        const normalizedSale = normalizeSaleMoney(data);
        const requestedItems = aggregateSaleItems(normalizedSale.items);

        try {
            await runTransaction(db, async transaction => {
                const productRefs = requestedItems.map(item => doc(db, 'artifacts', APP_ID, 'users', user.uid, 'products', item.productId));
                const productSnapshots = await Promise.all(productRefs.map(productRef => transaction.get(productRef)));
                const inventoryRecords = productSnapshots.map((snapshot, index) => snapshot.exists() ? {
                    productId: requestedItems[index].productId,
                    quantity: snapshot.data().quantity,
                    name: snapshot.data().name
                } : null).filter(Boolean);
                const inventoryPlan = buildSaleInventoryPlan(requestedItems, inventoryRecords);

                transaction.set(saleRef, {
                    ...normalizedSale,
                    inventoryOperationId: saleRef.id,
                    inventoryCommittedAt: serverTimestamp()
                });
                inventoryPlan.forEach((plan, index) => {
                    transaction.update(productRefs[index], {
                        quantity: plan.newQuantity,
                        inventoryUpdatedAt: serverTimestamp()
                    });
                });
            });
            return saleRef.id;
        } catch (error) {
            console.error('Venda não concluída:', error);
            if (error?.name === 'InventoryReliabilityError') throw error;
            throw new Error('Não foi possível concluir a venda. Nenhuma venda ou baixa de estoque foi gravada. Tente novamente.');
        }
    };

    const handleCancelSaleLogic = async (saleId, reason) => {
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

        const saleRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', saleId);
        const returnedByProduct = new Map();
        items.forEach(row => {
            if (!row.item.productId) return;
            const productId = String(row.item.productId);
            returnedByProduct.set(productId, (returnedByProduct.get(productId) || 0) + row.quantity);
        });
        const returnedItems = [...returnedByProduct.entries()].map(([productId, quantity]) => ({ productId, quantity }));
        const productRefs = returnedItems.map(item => doc(db, 'artifacts', APP_ID, 'users', user.uid, 'products', item.productId));

        await runTransaction(db, async transaction => {
            const snapshots = await Promise.all([transaction.get(saleRef), ...productRefs.map(productRef => transaction.get(productRef))]);
            const latestSaleSnapshot = snapshots[0];
            if (!latestSaleSnapshot.exists()) throw new Error('A venda não foi encontrada. Atualize a página e tente novamente.');
            const latestSale = latestSaleSnapshot.data();
            if (latestSale.status === 'canceled') throw new Error('Esta venda já foi cancelada.');

            const productSnapshots = snapshots.slice(1);
            productSnapshots.forEach((snapshot, index) => {
                if (!snapshot.exists()) throw new Error('Um produto da venda não foi encontrado. O cancelamento não foi realizado.');
                const currentQuantity = Number(snapshot.data().quantity);
                if (!Number.isInteger(currentQuantity) || currentQuantity < 0) throw new Error('O estoque de um produto está inválido. O cancelamento não foi realizado.');
            });

            transaction.update(saleRef, {
                status: 'canceled',
                cancelReason: String(reason || '').trim(),
                canceledAt: serverTimestamp(),
                cancellations: [...(latestSale.cancellations || []), event],
                lastCancellationAt: event.date,
                lastCancellationReason: event.reason
            });
            productSnapshots.forEach((snapshot, index) => {
                transaction.update(productRefs[index], {
                    quantity: Number(snapshot.data().quantity) + returnedItems[index].quantity,
                    inventoryUpdatedAt: serverTimestamp()
                });
            });
        });
    };

    const confirmCancelSale = async () => {
        const reason = String(cancelModal.reason || '').trim();
        if (!reason) return alert('Informe o motivo do cancelamento.');
        try {
            await handleCancelSaleLogic(cancelModal.saleId, reason);
            setCancelModal({ open: false, saleId: null, reason: '' });
            setSelectedSaleDetail(null);
        } catch (error) {
            console.error('Cancelamento não concluído:', error);
            alert(error?.message || 'Não foi possível cancelar a venda. Nenhuma alteração foi gravada.');
        }
    };

    const requestDelete = (type, id) => {
        if (type === 'sale') return alert('Vendas não podem ser excluídas permanentemente. Use Cancelar venda para preservar o histórico e devolver os itens ao estoque.');
        setDeleteModal({ open: true, type, id });
    };
    const confirmDelete = async () => {
        const { type, id } = deleteModal;
        if (type === 'sale') {
            setDeleteModal({ open: false, type: null, id: null });
            return alert('A exclusão permanente de vendas foi desativada. Use o cancelamento para manter o estoque consistente.');
        }
        const col = type === 'customer' ? 'customers' : 'products';
        await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, col, id));
        setDeleteModal({ open: false, type: null, id: null });
        if (type === 'product' && productDetailsData.data?.id === id) {
            setProductDetailsData({ open: false, data: null });
        }
    };

    const handleUpdateProfile = async (updatedData) => {
        const privateProfile = {
            name: String(updatedData?.name || '').trim(),
            storeName: String(updatedData?.storeName || '').trim(),
            phone: String(updatedData?.phone || '').trim(),
            pixType: String(updatedData?.pixType || ''),
            pixKey: String(updatedData?.pixKey || '').trim(),
            pixBank: String(updatedData?.pixBank || '').trim(),
            pixName: String(updatedData?.pixName || '').trim(),
            updatedAt: serverTimestamp()
        };
        const directoryProfile = {
            name: privateProfile.name,
            storeName: privateProfile.storeName,
            phone: privateProfile.phone,
            updatedAt: serverTimestamp()
        };
        const batch = writeBatch(db);
        batch.update(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'info'), privateProfile);
        batch.update(doc(db, 'artifacts', APP_ID, 'public', 'data', 'all_users', user.uid), directoryProfile);
        await batch.commit();
        setProfileModalOpen(false);
    };

    const handleSavePaymentSettings = async settings => {
        const normalized = normalizePaymentSettings(settings);
        await setDoc(
            doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'info'),
            {
                paymentSettings: normalized,
                paymentSettingsUpdatedAt: serverTimestamp()
            },
            { merge: true }
        );
        setPaymentSettings(normalized);
        return normalized;
    };

    const handleClickPay = (sale, index) => {
        const item = sale.installments[index];
        if (item.paid) return; 
        const isLast = index === sale.installments.length - 1;
        setPaymentModal({ open: true, saleId: sale.id, index, item, isLast });
    };

    const handleConfirmPayment = async (amountPaid, datePaid) => {
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
    };

    const handleDeletePayment = async () => {
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
    };

    const confirmDeletePayment = (saleId, instIndex, histIndex, historyItem) => {
        if (historyItem.type === 'abatement') return alert("Para cancelar este abatimento, exclua o pagamento com excedente na parcela anterior.");
        setDeletePaymentModal({ open: true, saleId, instIndex, histIndex, historyItem });
    };

    const handlePayFromList = async (item) => {
        const sale = sales.find(s => s.id === item.saleId);
        if (sale) handleClickPay(sale, item.installmentIndex);
    };

    const saveEditedInstallment = async (newData) => {
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
    };

    const handleShowPixCode = (sale, installment) => {
        if (!userProfile?.pixKey) return alert("Configure sua chave PIX no seu Perfil primeiro para gerar esse código!");
        const contractId = sale.id ? `VP-${sale.id.slice(-5).toUpperCase()}` : '00000';
        setPixModalData({ open: true, amount: installment.amount, txid: contractId.replace("-", "") });
    };

    const handleGenerateSalePdf = async (pdfData) => {
        if (!pdfData?.sale) return;
        try {
            const result = await shareSalePdf({
                sale: pdfData.sale,
                userProfile,
                type: pdfData.type || (pdfData.sale.saleType === 'direct' ? 'comprovante' : 'registro'),
                installment: pdfData.installment || null,
                historyItem: pdfData.historyItem || null
            });
            if (result?.downloaded) alert('O compartilhamento direto não estava disponível. O PDF foi baixado para o aparelho.');
        } catch (error) {
            console.error('Erro ao gerar PDF da venda:', error);
            alert('Não foi possível gerar o PDF desta venda.');
        }
    };

    const handleOpenWA = (type, sale, installment, historyItem) => {
        if (!sale) return;
        const currentCustomer = customers.find(c => c.id === sale.customerId);
        const phoneToUse = currentCustomer?.phone || sale.customerPhone;
        if (!phoneToUse) return alert("Este cliente não possui um telefone de WhatsApp cadastrado!");

        const store = userProfile?.storeName || "Nossa Loja";
        const contractId = sale.id ? `VP-${sale.id.slice(-5).toUpperCase()}` : '00000'; 
        let msg = "";

        if (type === 'registro' || type === 'quitacao') {
            const isQuitacao = type === 'quitacao';
            msg = isQuitacao ? `🌟 *CONTRATO QUITADO*\n` : `📄 *CONTRATO REGISTRADO*\n`;
            msg += `━━━━━━━━━━━━━━━━━━━\n\n`;
            msg += `📋 *Contrato:* ${contractId}\n`;
            msg += `📅 *Data:* ${formatDate(sale.saleDate)}\n\n`;
            msg += `👤 *Cliente:* ${sale.customerName}\n`;
            if (phoneToUse) msg += `📱 *Telefone:* ${phoneToUse}\n`;
            msg += `\n`;
            msg += `🛍️ *ITENS DA COMPRA:*\n`;
            sale.items?.forEach(item => { msg += `▪️ ${item.quantity}x ${item.productName} - ${formatCurrency(item.price)}\n`; });
            msg += `\n`;
            msg += `💵 *Valor da Compra:* ${formatCurrency(sale.totalPrice)}\n`;
            if (sale.entryAmount) msg += `💰 *Valor de Entrada:* ${formatCurrency(sale.entryAmount)}\n`;
            
            if (!isQuitacao && sale.installments?.length > 0) {
                msg += `📆 *1º Vencimento:* ${formatDate(sale.installments[0].dueDate)}\n`;
            }
            if (isQuitacao) msg += `\n🎉 Parabéns! Informamos que o seu contrato no valor total de *${formatCurrency(sale.totalPrice)}* foi totalmente quitado.\n`;

            msg += `\n📊 *STATUS DAS PARCELAS:*\n`;
            sale.installments?.forEach(inst => {
                const statusIcon = inst.paid ? '✅' : '⏳';
                const statusText = inst.paid ? 'Pago' : 'Em Aberto';
                const dateToShow = inst.paid && inst.paidAt ? formatDate(inst.paidAt) : formatDate(inst.dueDate);
                const valorInst = formatCurrency(inst.originalAmount || inst.amount); 
                msg += `${inst.number}️⃣ ${statusIcon} ${dateToShow} - ${valorInst} (${statusText})\n`;
            });
            msg += `\n━━━━━━━━━━━━━━━━━━━\n`;
            msg += isQuitacao ? `Muito obrigado pela confiança!\n*${store}*` : `Qualquer dúvida, estamos à disposição!\n*${store}*`;
        } 
        else if (type === 'comprovante') {
            msg = `🧾 *COMPROVANTE DE VENDA*\n`;
            msg += `━━━━━━━━━━━━━━━━━━━\n\n`;
            msg += `📅 *Data:* ${formatDate(sale.saleDate)}\n`;
            msg += `👤 *Cliente:* ${sale.customerName}\n\n`;
            msg += `🛍️ *ITENS DA VENDA:*\n`;
            sale.items?.forEach(item => { msg += `▪️ ${item.quantity}x ${item.productName} - ${formatCurrency(item.price)}\n`; });
            msg += `\n💵 *Total Pago:* ${formatCurrency(sale.totalPrice)}\n`;
            
            let paymentForm = 'Não informada';
            if (sale.paymentMethod === 'pix') paymentForm = 'PIX';
            else if (sale.paymentMethod === 'money') paymentForm = 'Dinheiro';
            else if (sale.paymentMethod === 'debit') paymentForm = 'Débito';
            else if (sale.paymentMethod === 'credit') paymentForm = `Crédito (${sale.cardInstallments}x)`;
            
            msg += `💳 *Forma de Pagto:* ${paymentForm}\n`;
            msg += `\n━━━━━━━━━━━━━━━━━━━\n`;
            msg += `Muito obrigado pela preferência!\n*${store}*`;
        }
        else if (type === 'cobranca' && installment) {
            const today = new Date();
            today.setHours(0,0,0,0);
            const [y,m,d] = installment.dueDate.split('T')[0].split('-');
            const target = new Date(y, m-1, d);
            const diffTime = target - today;
            const daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let statusHeader = "📋 *LEMBRETE DE PAGAMENTO*";
            let daysText = `(em ${daysDiff} dia${daysDiff>1?'s':''})`;
            let instStatus = "⏳ Em Aberto";

            if (daysDiff === 0) { statusHeader = "🔔 *VENCIMENTO HOJE*"; daysText = "(HOJE)"; } 
            else if (daysDiff < 0) { statusHeader = "⚠️ *AVISO DE ATRASO*"; daysText = `(Vencido há ${Math.abs(daysDiff)} dias)`; instStatus = "⚠️ Atrasada"; }

            msg = `Olá *${sale.customerName}*!\n`;
            msg += `━━━━━━━━━━━━━━━━━━━\n\n`;
            msg += `${statusHeader}\n\n`;
            msg += `💵 *Valor:* ${formatCurrency(installment.amount)}\n`;
            msg += `📊 *Parcela:* ${installment.number}/${sale.installmentsCount || sale.installments?.length}\n`;
            msg += `📆 *Vencimento:* ${formatDate(installment.dueDate)} ${daysText}\n\n`;
            msg += `📊 *STATUS DA PARCELA:*\n`;
            msg += `${installment.number}️⃣ ${instStatus}\n`;
            msg += `\nQualquer dúvida, estou à disposição!\n`;
            msg += `━━━━━━━━━━━━━━━━━━━`;
        }
        else if (type === 'recibo' && installment) {
            const paidValue = historyItem ? getHistoryCashAmount(historyItem) : installment.originalAmount || installment.amount;
            const paidDate = historyItem ? historyItem.date : installment.paidAt;
            const totalInst = sale.installmentsCount || sale.installments?.length || 1;
            
            msg = `✅ *PAGAMENTO REGISTRADO*\n`;
            msg += `━━━━━━━━━━━━━━━━━━━\n\n`;
            msg += `📋 *Contrato:* ${contractId}\n`;
            msg += `👤 *Cliente:* ${sale.customerName}\n`;
            if (phoneToUse) msg += `📱 *Telefone:* ${phoneToUse}\n`;
            msg += `\n`;
            msg += `💵 *Valor Pago:* ${formatCurrency(paidValue)}\n`;
            msg += `📊 *Parcela:* ${installment.number}/${totalInst}\n`;
            msg += `📆 *Data:* ${formatDate(paidDate)}\n\n`;
            
            const nextOpen = sale.installments?.find(i => !i.paid);
            if (nextOpen) {
                msg += `📊 *PRÓXIMA PARCELA:*\n`;
                msg += `${nextOpen.number}️⃣ ⏳ ${formatDate(nextOpen.dueDate)} - Em Aberto\n`;
            } else {
                msg += `🎉 *STATUS: COMPRA QUITADA!*\n`;
            }
            msg += `\n━━━━━━━━━━━━━━━━━━━\n`;
            msg += `Muito obrigado!`;
        }
        setWaChooserModal({ open: true, phone: phoneToUse, message: msg, pdfData: { type, sale, installment: installment || null, historyItem: historyItem || null } });
    };

    if (showAdminPanel) return React.createElement(AdminUsersPanel, { onClose: () => setShowAdminPanel(false) });

    if (newSaleMode) {
        return React.createElement(NewSaleScreen, { 
            mode: newSaleMode, 
            onClose: () => setNewSaleMode(null), 
            customers: customers, 
            products: products, 
            sales: sales, 
            onSaveSale: handleAddSale, 
            userProfile: userProfile,
            user: user,
            paymentSettings: paymentSettings
        });
    }

    const getPaginatedData = (data, page) => { const start = (page - 1) * ITEMS_PER_PAGE; return data.slice(start, start + ITEMS_PER_PAGE); };

    const paginatedProducts = getPaginatedData(sortedProducts, productsPage);
    const paginatedCustomers = getPaginatedData(sortedCustomers, customersPage);

    const navItems = [
        { id: 'dashboard', label: 'Visão geral', shortLabel: 'Início', icon: LayoutDashboard },
        { id: 'sales', label: 'Vendas', shortLabel: 'Vendas', icon: Receipt },
        { id: 'products', label: 'Produtos', shortLabel: 'Produtos', icon: Package },
        { id: 'customers', label: 'Clientes', shortLabel: 'Clientes', icon: Contact },
        { id: 'finance', label: 'Financeiro', shortLabel: 'Fin.', icon: Banknote },
        { id: 'commercial', label: 'Comercial', shortLabel: 'Comercial', icon: Store },
        { id: 'reports', label: 'Relatórios', shortLabel: 'Relat.', icon: LayoutDashboard },
        { id: 'rates', label: 'Taxas e juros', shortLabel: 'Taxas', icon: BadgePercent }
    ];
    const currentNav = navItems.find(item => item.id === view) || navItems[0];
    const mobilePrimaryNav = ['dashboard', 'sales', 'products', 'customers']
        .map(id => navItems.find(item => item.id === id))
        .filter(Boolean);

    return React.createElement('div', { className: "app-shell" },
        React.createElement('aside', { className: "app-sidebar" },
            React.createElement('div', { className: "app-brand" },
                React.createElement('div', { className: "app-brand-mark" }, React.createElement(Store, { size: 22 })),
                React.createElement('div', { className: "min-w-0" },
                    React.createElement('p', { className: "app-brand-title truncate" }, userProfile?.storeName || "Registro de Vendas"),
                    React.createElement('p', { className: "app-brand-subtitle" }, "Gestão comercial")
                )
            ),
            React.createElement('nav', { className: "app-nav", 'aria-label': "Navegação principal" },
                navItems.map(item => React.createElement('button', {
                    key: item.id,
                    onClick: () => setView(item.id),
                    className: `app-nav-button ${view === item.id ? 'is-active' : ''}`
                }, React.createElement(item.icon, { size: 19 }), React.createElement('span', null, item.label)))
            ),
            React.createElement('div', { className: "app-sidebar-footer" },
                React.createElement('div', { className: "app-user-card" },
                    React.createElement('div', { className: "app-avatar" }, React.createElement(User, { size: 18 })),
                    React.createElement('div', { className: "min-w-0 flex-1" },
                        React.createElement('p', { className: "text-xs font-extrabold text-white truncate" }, userProfile?.name || "Usuário"),
                        React.createElement('p', { className: "text-[10px] text-slate-400 truncate" }, user.email)
                    ),
                    React.createElement('button', { onClick: onLogout, className: "p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-white/5", title: "Sair" }, React.createElement(LogOut, { size: 17 }))
                )
            )
        ),

        React.createElement('div', { className: "app-main" },
            React.createElement('header', { className: "app-topbar" },
                React.createElement('div', { className: "app-topbar-leading" },
                    React.createElement('button', {
                        type: "button",
                        onClick: () => setMobileMenuOpen(open => !open),
                        className: `mobile-menu-toggle ${mobileMenuOpen ? 'is-open' : ''}`,
                        'aria-label': mobileMenuOpen ? "Fechar menu" : "Abrir menu",
                        'aria-expanded': mobileMenuOpen,
                        'aria-controls': "mobile-navigation-drawer"
                    },
                        React.createElement('span', { className: "mobile-menu-lines", 'aria-hidden': "true" },
                            React.createElement('span', null),
                            React.createElement('span', null),
                            React.createElement('span', null)
                        )
                    ),
                    React.createElement('div', { className: "min-w-0" },
                    React.createElement('p', { className: "app-topbar-title truncate" }, currentNav.label),
                    React.createElement('p', { className: "app-topbar-subtitle truncate" }, `Olá, ${userProfile?.name?.split(' ')[0] || 'bem-vindo'} • ${userProfile?.storeName || 'Sua loja'}`)
                ),
                ),
                React.createElement('div', { className: "flex items-center gap-2" },
                    userProfile?.role === 'admin' && React.createElement('button', {
                        onClick: () => setShowAdminPanel(true),
                        className: "app-icon-button",
                        title: "Gerenciar usuários"
                    }, React.createElement(ShieldCheck, { size: 18 })),
                    React.createElement('button', {
                        onClick: () => setProfileModalOpen(true),
                        className: "app-icon-button",
                        title: "Meu perfil"
                    }, React.createElement(User, { size: 18 })),
                    React.createElement('button', {
                        onClick: onLogout,
                        className: "app-icon-button lg:hidden",
                        title: "Sair"
                    }, React.createElement(LogOut, { size: 18 }))
                )
            ),

            mobileMenuOpen && React.createElement('div', {
                className: "mobile-menu-backdrop",
                onClick: () => setMobileMenuOpen(false),
                role: "presentation"
            },
                React.createElement('aside', {
                    id: "mobile-navigation-drawer",
                    className: "mobile-menu-drawer",
                    role: "dialog",
                    'aria-modal': "true",
                    'aria-label': "Menu de navegação",
                    onClick: event => event.stopPropagation()
                },
                    React.createElement('div', { className: "mobile-menu-header" },
                        React.createElement('div', { className: "mobile-menu-brand" },
                            React.createElement('div', { className: "mobile-menu-brand-mark" }, React.createElement(Store, { size: 21 })),
                            React.createElement('div', { className: "min-w-0" },
                                React.createElement('p', { className: "mobile-menu-store-name truncate" }, userProfile?.storeName || "Registro de Vendas"),
                                React.createElement('p', { className: "mobile-menu-caption" }, "Menu principal")
                            )
                        ),
                        React.createElement('button', {
                            type: "button",
                            onClick: () => setMobileMenuOpen(false),
                            className: "mobile-menu-close",
                            'aria-label': "Fechar menu"
                        }, "×")
                    ),
                    React.createElement('nav', { className: "mobile-menu-nav", 'aria-label': "Navegação mobile" },
                        navItems.map(item => React.createElement('button', {
                            key: item.id,
                            type: "button",
                            onClick: () => { setView(item.id); setMobileMenuOpen(false); },
                            className: `mobile-menu-nav-button ${view === item.id ? 'is-active' : ''}`
                        },
                            React.createElement('span', { className: "mobile-menu-nav-icon" }, React.createElement(item.icon, { size: 20 })),
                            React.createElement('span', { className: "mobile-menu-nav-label" }, item.label),
                            view === item.id && React.createElement('span', { className: "mobile-menu-current-dot", 'aria-label': "Aba atual" })
                        ))
                    ),
                    React.createElement('div', { className: "mobile-menu-footer" },
                        React.createElement('div', { className: "mobile-menu-user" },
                            React.createElement('div', { className: "mobile-menu-user-avatar" }, React.createElement(User, { size: 17 })),
                            React.createElement('div', { className: "min-w-0" },
                                React.createElement('p', { className: "mobile-menu-user-name truncate" }, userProfile?.name || "Usuário"),
                                React.createElement('p', { className: "mobile-menu-user-email truncate" }, user.email)
                            )
                        )
                    )
                )
            ),

            React.createElement('main', { className: "app-content" },
                loadingData
                    ? React.createElement('div', { className: "surface min-h-64 flex flex-col items-center justify-center gap-3 text-slate-500" },
                        React.createElement('div', { className: "app-loading-dot w-10 h-10 rounded-2xl bg-amber-100 grid place-items-center text-amber-600" }, React.createElement(Store, { size: 20 })),
                        React.createElement('span', { className: "text-sm font-bold" }, "Carregando seus dados...")
                    )
                    : view === 'dashboard' ? React.createElement(AbaVisaoGeral, {
                        dashPeriod, dashStartDate, dashEndDate, setDashPeriod, setDashStartDate, setDashEndDate,
                        dashboardTotals, setInstallmentListModal, sales, products, customers, userProfile,
                        onNavigate: setView, onNewSale: () => setNewSaleMode('unified')
                    })
                    : view === 'sales' ? React.createElement(AbaVendas, {
                        sales,
                        setNewSaleMode,
                        setSelectedSaleDetail,
                        analysisPeriod: dashPeriod,
                        analysisStartDate: dashStartDate,
                        analysisEndDate: dashEndDate,
                        onAnalysisPeriodChange: setDashPeriod,
                        onAnalysisStartDateChange: setDashStartDate,
                        onAnalysisEndDateChange: setDashEndDate
                    })
                    : view === 'products' ? React.createElement(AbaProdutos, {
                        productSearch, setProductSearch, paginatedProducts, sortedProducts, productsPage, setProductsPage, setProductDetailsData, setProductModalData, onBatchMovement: () => setBatchStockOpen(true), ITEMS_PER_PAGE
                    })
                    : view === 'customers' ? React.createElement(AbaClientes, {
                        customerSearch, setCustomerSearch, setCustomerModalData, paginatedCustomers, sales, requestDelete, sortedCustomers, customersPage, setCustomersPage, ITEMS_PER_PAGE
                    })
                    : view === 'commercial' ? React.createElement(AbaComercial, {
                        userId: user.uid,
                        sales,
                        products,
                        customers,
                        userProfile,
                        analysisEndDate: dashEndDate,
                        onAnalysisPeriodChange: setDashPeriod,
                        onAnalysisStartDateChange: setDashStartDate,
                        onAnalysisEndDateChange: setDashEndDate
                    })
                    : view === 'reports' ? React.createElement(AbaRelatorios, {
                        userId: user.uid,
                        sales,
                        products,
                        customers,
                        userProfile,
                        analysisPeriod: dashPeriod,
                        analysisStartDate: dashStartDate,
                        analysisEndDate: dashEndDate,
                        onAnalysisPeriodChange: setDashPeriod,
                        onAnalysisStartDateChange: setDashStartDate,
                        onAnalysisEndDateChange: setDashEndDate
                    })
                    : view === 'finance' ? React.createElement(AbaFinanceiro, {
                        userId: user.uid,
                        sales,
                        products,
                        analysisPeriod: dashPeriod,
                        analysisStartDate: dashStartDate,
                        analysisEndDate: dashEndDate,
                        onAnalysisPeriodChange: setDashPeriod,
                        onAnalysisStartDateChange: setDashStartDate,
                        onAnalysisEndDateChange: setDashEndDate,
                        onOpenSale: sale => setSelectedSaleDetail(sale),
                        onOpenProduct: product => setProductDetailsData({ open: true, data: product }),
                        onReceiveInstallment: (sale, index) => handleClickPay(sale, index)
                    })
                    : React.createElement(AbaTaxas, {
                        settings: paymentSettings,
                        onSave: handleSavePaymentSettings
                    })
            )
        ),

        React.createElement('nav', { className: "mobile-quick-nav", 'aria-label': "Acessos rápidos" },
            mobilePrimaryNav.slice(0, 2).map(item => React.createElement('button', {
                key: item.id,
                type: "button",
                onClick: () => { setView(item.id); setMobileMenuOpen(false); },
                className: `mobile-quick-nav-button ${view === item.id ? 'is-active' : ''}`
            }, React.createElement(item.icon, { size: 19 }), React.createElement('span', null, item.shortLabel))),
            React.createElement('button', {
                type: "button",
                onClick: () => { setNewSaleMode('unified'); setMobileMenuOpen(false); },
                className: "mobile-quick-sale-button",
                'aria-label': "Registrar nova venda"
            }, React.createElement('span', { className: "mobile-quick-sale-icon" }, React.createElement(Plus, { size: 23 })), React.createElement('span', null, "Nova")),
            mobilePrimaryNav.slice(2).map(item => React.createElement('button', {
                key: item.id,
                type: "button",
                onClick: () => { setView(item.id); setMobileMenuOpen(false); },
                className: `mobile-quick-nav-button ${view === item.id ? 'is-active' : ''}`
            }, React.createElement(item.icon, { size: 19 }), React.createElement('span', null, item.shortLabel)))
        ),

        React.createElement(UserProfileModal, { isOpen: profileModalOpen, onClose: () => setProfileModalOpen(false), userProfile: userProfile, onSave: handleUpdateProfile }),
        React.createElement(CustomerFormModal, { isOpen: customerModalData.open, onClose: () => setCustomerModalData({open:false, data:null}), initialData: customerModalData.data, onSave: handleSaveCustomer }),
        React.createElement(EditInstallmentModal, { isOpen: editInstallmentModal.open, onClose: () => setEditInstallmentModal({ open: false, saleId: null, data: null }), installment: editInstallmentModal.data, onSave: saveEditedInstallment }),

        React.createElement(ProductDetailsModal, {
            isOpen: productDetailsData.open,
            onClose: () => setProductDetailsData({open:false, data:null}),
            product: productDetailsData.data,
            salesHistory: sales,
            onEdit: product => setProductModalData({open: true, data: product}),
            onMovementRequest: product => setStockMovementData({open: true, data: product}),
            onDeleteRequest: requestDelete
        }),
        React.createElement(ProductModal, {
            isOpen: productModalData.open,
            onClose: () => setProductModalData({open: false, data: null}),
            onSave: handleSaveProduct,
            initialData: productModalData.data,
            lastCode: products.length > 0 ? String(products.reduce((max, product) => Math.max(max, parseInt(product.code || '0', 10) || 0), 0)).padStart(6, '0') : null
        }),
        React.createElement(StockMovementModal, {
            isOpen: stockMovementData.open,
            onClose: () => setStockMovementData({open: false, data: null}),
            product: stockMovementData.data,
            onSave: handleStockMovement
        }),
        React.createElement(BatchStockModal, {
            isOpen: batchStockOpen,
            onClose: () => setBatchStockOpen(false),
            products: products,
            userId: user.uid,
            onSuccess: () => setBatchStockOpen(false)
        }),

        React.createElement(SaleDetailsModal, {
            isOpen: !!activeSaleDetails, onClose: () => setSelectedSaleDetail(null), sale: activeSaleDetails,
            onPay: handleClickPay, onEdit: setEditInstallmentModal, onDeletePayment: confirmDeletePayment,
            onCancelSale: saleId => setCancelModal({ open: true, saleId, reason: '' }), onDeleteSale: requestDelete,
            onOpenWA: handleOpenWA, onShowPixCode: handleShowPixCode, hasPixSetup: !!(userProfile?.pixKey),
            onGeneratePdf: () => handleGenerateSalePdf({ sale: activeSaleDetails, type: activeSaleDetails?.saleType === 'direct' ? 'comprovante' : (activeSaleDetails?.status === 'completed' ? 'quitacao' : 'registro') })
        }),

        React.createElement(PixCodeModal, { isOpen: pixModalData.open, onClose: () => setPixModalData({ open: false, amount: 0, txid: '' }), userProfile: userProfile, amount: pixModalData.amount, txid: pixModalData.txid }),
        React.createElement(InstallmentListModal, { isOpen: installmentListModal.open, onClose: () => setInstallmentListModal({ open: false, type: null, data: [] }), title: installmentListModal.type === 'overdue' ? 'Parcelas em atraso' : installmentListModal.type === 'today' ? 'Parcelas vencendo hoje' : 'Parcelas a vencer nos próximos 7 dias', items: installmentListModal.data, onPay: handlePayFromList, onOpenWA: handleOpenWA }),
        React.createElement(PaymentConfirmationModal, { isOpen: paymentModal.open, onClose: () => setPaymentModal({ open: false, saleId: null, index: null, item: null, isLast: false }), onConfirm: handleConfirmPayment, installment: paymentModal.item, isLast: paymentModal.isLast }),
        React.createElement(ConfirmModal, { isOpen: deletePaymentModal.open, title: "Estornar pagamento?", message: "O valor será devolvido para a parcela e ela ficará em aberto novamente.", onClose: () => setDeletePaymentModal({ open: false, saleId: null, instIndex: null, histIndex: null, historyItem: null }), onConfirm: handleDeletePayment }),
        React.createElement(ConfirmModal, { isOpen: cancelModal.open, title: "Cancelar venda?", message: "Esta ação irá devolver os produtos ao estoque e invalidar os pagamentos.", isCancel: true, reasonValue: cancelModal.reason, onReasonChange: value => setCancelModal(previous => ({...previous, reason: value})), onClose: () => setCancelModal({ open: false, saleId: null, reason: '' }), onConfirm: confirmCancelSale }),
        React.createElement(ConfirmModal, { isOpen: deleteModal.open, title: "Tem certeza?", message: "O registro será apagado permanentemente.", onClose: () => { setDeleteModal({ open: false, id: null, type: null }); setSelectedSaleDetail(null); }, onConfirm: confirmDelete }),
        React.createElement(WhatsAppChooserModal, { isOpen: waChooserModal.open, phone: waChooserModal.phone, message: waChooserModal.message, onPdf: waChooserModal.pdfData ? () => handleGenerateSalePdf(waChooserModal.pdfData) : null, onClose: () => setWaChooserModal({ open: false, phone: '', message: '', pdfData: null }) })
    );
};

function App() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [accessDenied, setAccessDenied] = useState(null);

    useEffect(() => {
        let unsubscribeProfile = () => {};
        let missingProfileTimer = null;

        const stopProfileWatch = () => {
            unsubscribeProfile();
            unsubscribeProfile = () => {};
            if (missingProfileTimer) clearTimeout(missingProfileTimer);
            missingProfileTimer = null;
        };

        const unsubscribeAuth = onAuthStateChanged(auth, currentUser => {
            stopProfileWatch();
            if (!currentUser) {
                setUser(null);
                setUserProfile(null);
                setLoadingAuth(false);
                return;
            }

            setLoadingAuth(true);
            const profileRef = doc(db, 'artifacts', APP_ID, 'users', currentUser.uid, 'profile', 'info');
            unsubscribeProfile = onSnapshot(profileRef, async profileSnapshot => {
                if (!profileSnapshot.exists()) {
                    setUser(null);
                    setUserProfile(null);
                    if (!missingProfileTimer) {
                        missingProfileTimer = setTimeout(async () => {
                            setAccessDenied('deleted');
                            setLoadingAuth(false);
                            await signOut(auth);
                        }, 5000);
                    }
                    return;
                }

                if (missingProfileTimer) clearTimeout(missingProfileTimer);
                missingProfileTimer = null;
                const data = profileSnapshot.data();
                const status = String(data.status || (data.approved ? 'active' : 'pending'));
                if (data.approved === true && status !== 'blocked' && status !== 'deleted') {
                    setAccessDenied(null);
                    setUserProfile(data);
                    setUser(currentUser);
                    setLoadingAuth(false);
                    return;
                }

                setUser(null);
                setUserProfile(null);
                setAccessDenied(status === 'deleted' ? 'deleted' : status === 'blocked' ? 'blocked' : 'pending');
                setLoadingAuth(false);
                await signOut(auth);
            }, async error => {
                console.error('Não foi possível validar o acesso:', error);
                setUser(null);
                setUserProfile(null);
                setAccessDenied('error');
                setLoadingAuth(false);
                await signOut(auth);
            });
        });

        return () => {
            stopProfileWatch();
            unsubscribeAuth();
        };
    }, []);

    if (loadingAuth) return React.createElement('div', { className: "min-h-screen flex flex-col gap-3 items-center justify-center bg-slate-950 text-white" }, React.createElement('div', { className: "app-loading-dot w-12 h-12 rounded-2xl bg-amber-400 text-slate-900 grid place-items-center" }, React.createElement(Store, { size: 23 })), React.createElement('span', { className: "text-sm font-bold text-slate-300" }, "Carregando sistema..."));
    
    if (accessDenied) return React.createElement('div', { className: "min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center" },
        React.createElement(Lock, { size: 48, className: "text-red-500 mb-4" }),
        React.createElement('h1', { className: "text-2xl font-bold text-red-800 mb-2" }, accessDenied === 'pending' ? "Cadastro em análise" : "Acesso revogado"),
        React.createElement('p', { className: "text-red-600 mb-6" }, accessDenied === 'pending'
            ? "Seu cadastro ainda está pendente de aprovação pelo administrador."
            : accessDenied === 'blocked'
                ? "Este usuário foi bloqueado pelo administrador."
                : accessDenied === 'deleted'
                    ? "Este usuário foi removido e não possui mais acesso ao sistema."
                    : "Não foi possível validar sua autorização. Tente entrar novamente."),
        React.createElement('button', { onClick: () => setAccessDenied(null), className: "px-6 py-3 bg-red-600 text-white font-bold rounded-xl" }, "Voltar ao login")
    );

    if (!user) return React.createElement(AuthScreen, {});
    return React.createElement(Dashboard, { user: user, userProfile: userProfile, onLogout: async () => { await signOut(auth); window.location.reload(); } });
}

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));
