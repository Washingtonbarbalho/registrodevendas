import React, { useState, useEffect, useMemo } from 'https://esm.sh/react@18.2.0';
import { createRoot } from 'https://esm.sh/react-dom@18.2.0/client';
import { Users, User, LogOut, Lock, DollarSign } from 'https://esm.sh/lucide-react@0.292.0';

// Firebase
import { app, db, auth, APP_ID } from './firebase-config.js';
import { collection, onSnapshot, query, doc, getDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// Utils
import { getCurrentMonthStart, getCurrentMonthEnd, getBrazilDateString, addDays, formatCurrency, formatDate } from './utils.js';

// Modais
import { 
    UserProfileModal, CustomerFormModal, ProductDetailsModal, EditInstallmentModal, 
    SaleDetailsModal, PixCodeModal, InstallmentListModal, PaymentConfirmationModal, 
    ConfirmModal, WhatsAppChooserModal, ProductModal, StockMovementModal, TransactionModal, FinancialListModal
} from './modals.js';

// Telas Secundárias
import { AuthScreen, AdminUsersPanel } from './auth-admin.js';
import { NewSaleScreen } from './nova-venda.js';

// Abas do Dashboard
import { AbaVisaoGeral } from './aba-visao-geral.js';
import { AbaVendasPrazo } from './aba-vendas-prazo.js';
import { AbaVendasCaixa } from './aba-vendas-caixa.js';
import { AbaProdutos } from './aba-produtos.js';
import { AbaClientes } from './aba-clientes.js';

const Dashboard = ({ user, userProfile, onLogout }) => {
    const [view, setView] = useState('dashboard');
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [sales, setSales] = useState([]);
    const [manualTransactions, setManualTransactions] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    
    const [newSaleMode, setNewSaleMode] = useState(null);

    const [dashPeriod, setDashPeriod] = useState('month'); 
    const [dashStartDate, setDashStartDate] = useState(getCurrentMonthStart());
    const [dashEndDate, setDashEndDate] = useState(getCurrentMonthEnd());

    const ITEMS_PER_PAGE = 10;
    const [salesPage, setSalesPage] = useState(1);
    const [cashierPage, setCashierPage] = useState(1);
    const [productsPage, setProductsPage] = useState(1);
    const [customersPage, setCustomersPage] = useState(1);

    const [salesPeriod, setSalesPeriod] = useState('month');
    const [salesStart, setSalesStart] = useState(getCurrentMonthStart());
    const [salesEnd, setSalesEnd] = useState(getCurrentMonthEnd());

    const [cashierPeriod, setCashierPeriod] = useState('month');
    const [cashierStart, setCashierStart] = useState(getCurrentMonthStart());
    const [cashierEnd, setCashierEnd] = useState(getCurrentMonthEnd());

    const [salesSearch, setSalesSearch] = useState('');
    const [cashierSearch, setCashierSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');

    const [productDetailsData, setProductDetailsData] = useState({ open: false, data: null });
    const [productModalData, setProductModalData] = useState({ open: false, data: null });
    const [stockMovementData, setStockMovementData] = useState({ open: false, data: null });

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
    
    const [waChooserModal, setWaChooserModal] = useState({ open: false, phone: '', message: '' });
    const [pixModalData, setPixModalData] = useState({ open: false, amount: 0, txid: '' });

    const [transactionModalOpen, setTransactionModalOpen] = useState(false);

    useEffect(() => {
        const customersRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'customers');
        const productsRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'products');
        const salesRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'sales');
        const transactionsRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'transactions');
        
        const unsubC = onSnapshot(query(customersRef), s => setCustomers(s.docs.map(d => ({id:d.id, ...d.data()}))));
        const unsubP = onSnapshot(query(productsRef), s => setProducts(s.docs.map(d => ({id:d.id, ...d.data()}))));
        const unsubS = onSnapshot(query(salesRef), s => { setSales(s.docs.map(d => ({id:d.id, ...d.data()}))); setLoadingData(false); });
        const unsubT = onSnapshot(query(transactionsRef), s => setManualTransactions(s.docs.map(d => ({id:d.id, ...d.data()}))));
        
        return () => { unsubC(); unsubP(); unsubS(); unsubT(); };
    }, [user.uid]);

    useEffect(() => { if (dashPeriod === 'month') { setDashStartDate(getCurrentMonthStart()); setDashEndDate(getCurrentMonthEnd()); } }, [dashPeriod]);
    useEffect(() => { if (salesPeriod === 'month') { setSalesStart(getCurrentMonthStart()); setSalesEnd(getCurrentMonthEnd()); } }, [salesPeriod]);
    useEffect(() => { if (cashierPeriod === 'month') { setCashierStart(getCurrentMonthStart()); setCashierEnd(getCurrentMonthEnd()); } }, [cashierPeriod]);

    useEffect(() => setSalesPage(1), [salesSearch, salesPeriod, salesStart, salesEnd]);
    useEffect(() => setCashierPage(1), [cashierSearch, cashierPeriod, cashierStart, cashierEnd]);
    useEffect(() => setProductsPage(1), [productSearch]);
    useEffect(() => setCustomersPage(1), [customerSearch]);

    // Lógica Financeira Central e Inteligente
    const allFinancialTransactions = useMemo(() => {
        let list = [];
        // 1. Vendas Diretas e Taxas
        sales.filter(s => s.saleType === 'direct' && s.status !== 'canceled').forEach(s => {
            let liquidValue = s.totalPrice;
            if (s.feeConfig && s.feeConfig.type === 'sem_juros') liquidValue -= (s.feeConfig.value || 0);
            list.push({ id: `v-dir-${s.id}`, date: s.saleDate + 'T12:00:00.000Z', description: `Venda Caixa - ${s.customerName}`, type: 'income', category: 'Venda', amount: liquidValue });
        });
        
        // 2. Entradas e Parcelas de Vendas a Prazo
        sales.filter(s => (s.saleType === 'prazo' || !s.saleType) && s.status !== 'canceled').forEach(s => {
            if (s.entryAmount > 0) list.push({ id: `v-ent-${s.id}`, date: s.saleDate + 'T12:00:00.000Z', description: `Entrada Venda - ${s.customerName}`, type: 'income', category: 'Entrada', amount: s.entryAmount });
            if (s.installments) {
                s.installments.forEach((inst, idx) => {
                    if (inst.history) {
                        inst.history.forEach((h, hIdx) => { if (h.type !== 'abatement') list.push({ id: `v-parc-${s.id}-${idx}-${hIdx}`, date: h.date, description: `Parc. ${inst.number} - ${s.customerName}`, type: 'income', category: 'Recebimento', amount: h.amount }); });
                    } else if (inst.paid && inst.paidAt) {
                        list.push({ id: `v-parc-${s.id}-${idx}`, date: inst.paidAt, description: `Parc. ${inst.number} - ${s.customerName}`, type: 'income', category: 'Recebimento', amount: inst.amount });
                    }
                });
            }
        });

        // 3. Compras de Mercadorias (Estoque)
        products.forEach(p => {
            if (p.movements) {
                p.movements.forEach(m => {
                    if (m.type === 'compra' && m.unitCost > 0) list.push({ id: `compra-${p.id}-${m.id}`, date: m.date, description: `Compra Estoque: ${p.name}`, type: 'expense', category: 'Mercadoria', amount: m.quantity * m.unitCost });
                });
            }
        });

        // 4. Estornos (Vendas Canceladas)
        sales.filter(s => s.status === 'canceled').forEach(s => {
            let refunded = s.entryAmount || 0;
            if (s.installments) s.installments.forEach(i => { if (i.history) i.history.forEach(h => { if (h.type !== 'abatement') refunded += h.amount; }); else if (i.paid) refunded += i.amount; });
            if (refunded > 0) {
                const cDate = s.canceledAt ? new Date(s.canceledAt.seconds * 1000).toISOString() : s.saleDate + 'T12:00:00.000Z';
                list.push({ id: `canc-${s.id}`, date: cDate, description: `Estorno Venda Cancelada - ${s.customerName}`, type: 'expense', category: 'Estorno', amount: refunded });
            }
        });

        // 5. Transações Manuais
        manualTransactions.forEach(t => list.push({ id: t.id, date: t.date, description: t.description, type: t.type, category: t.category, amount: t.amount }));
        
        return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [sales, products, manualTransactions]);

    const dashboardTotals = useMemo(() => {
        const validSales = sales.filter(s => s.status !== 'canceled');
        let cashIn = 0; let cashOut = 0; let totalReceivable = 0;
        let realProfit = 0; let estimatedProfit = 0;
        const overdueList = []; const upcomingList = []; const allReceivablesList = [];
        const today = getBrazilDateString(); const nextWeek = addDays(today, 7);

        // Soma baseada no período escolhido
        allFinancialTransactions.forEach(t => {
            const tDate = t.date.split('T')[0];
            if (tDate >= dashStartDate && tDate <= dashEndDate) {
                if (t.type === 'income') cashIn += t.amount;
                if (t.type === 'expense') cashOut += t.amount;
            }
        });

        // Lógica de Lucro Real e Inadimplência
        validSales.forEach(s => {
            let receivedAllTime = 0; let receivedInPeriod = 0;
            let totalCost = s.totalCost || 0;
            let feeDiscount = s.feeConfig?.type === 'sem_juros' ? (s.feeConfig.value || 0) : 0;

            if (s.saleType === 'direct') {
                const netValue = s.totalPrice - feeDiscount;
                receivedAllTime = netValue;
                if (s.saleDate >= dashStartDate && s.saleDate <= dashEndDate) receivedInPeriod = netValue;
            } else {
                if (s.entryAmount) {
                    receivedAllTime += s.entryAmount;
                    if (s.saleDate >= dashStartDate && s.saleDate <= dashEndDate) receivedInPeriod += s.entryAmount;
                }
                if (s.installments) {
                    s.installments.forEach((i, idx) => {
                        if (i.history && i.history.length > 0) {
                            i.history.forEach(h => {
                                if (h.type !== 'abatement') {
                                    receivedAllTime += h.amount;
                                    if (h.date >= dashStartDate && h.date <= dashEndDate) receivedInPeriod += h.amount;
                                }
                            });
                        } else if (i.paid && i.paidAt) {
                            receivedAllTime += i.amount;
                            if (i.paidAt.split('T')[0] >= dashStartDate && i.paidAt.split('T')[0] <= dashEndDate) receivedInPeriod += i.amount;
                        }
                        if (!i.paid) {
                            totalReceivable += i.amount;
                            const itemData = { ...i, sale: s, saleId: s.id, customerName: s.customerName, customerPhone: s.customerPhone, installmentIndex: idx, isOverdue: i.dueDate < today };
                            allReceivablesList.push(itemData);
                            if (i.dueDate < today) overdueList.push(itemData);
                            else if (i.dueDate <= nextWeek) upcomingList.push(itemData);
                        }
                    });
                }
            }

            if (s.saleDate >= dashStartDate && s.saleDate <= dashEndDate) {
                estimatedProfit += (s.totalPrice - totalCost - feeDiscount);
            }

            // O Lucro Real só soma aquilo que ultrapassa o totalCost da venda
            let receivedBeforePeriod = receivedAllTime - receivedInPeriod;
            if (receivedAllTime > totalCost) {
                let profitBefore = Math.max(0, receivedBeforePeriod - totalCost);
                let profitNow = (receivedAllTime - totalCost) - profitBefore;
                realProfit += profitNow;
            }
        });

        allReceivablesList.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

        return { 
            totalReceivable, totalReceived: cashIn, totalCashOut: cashOut, 
            totalOverdue: overdueList.reduce((acc, i) => acc + i.amount, 0), 
            totalUpcoming: upcomingList.reduce((acc, i) => acc + i.amount, 0), 
            estimatedProfit, realProfit, overdueList, upcomingList, allReceivablesList 
        };
    }, [sales, allFinancialTransactions, dashStartDate, dashEndDate]);

    const sortedProducts = useMemo(() => {
        const list = [...products].sort((a, b) => a.code.localeCompare(b.code));
        if (!productSearch) return list;
        return list.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.includes(productSearch));
    }, [products, productSearch]);

    const sortedCustomers = useMemo(() => {
        const list = [...customers].sort((a, b) => a.name.localeCompare(b.name));
        if (!customerSearch) return list;
        return list.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.document && c.document.includes(customerSearch)));
    }, [customers, customerSearch]);

    const displayedSales = useMemo(() => {
        let baseSales = sales.filter(s => s.saleType === 'prazo' || !s.saleType);
        if (salesSearch) {
            const lower = salesSearch.toLowerCase();
            return baseSales.filter(s => s.customerName.toLowerCase().includes(lower) || (s.items && s.items.some(i => i.productName.toLowerCase().includes(lower)))).sort((a, b) => b.saleDate.localeCompare(a.saleDate));
        }
        let active = baseSales.filter(s => s.status !== 'completed' && s.status !== 'canceled');
        let completedOrCanceled = baseSales.filter(s => (s.status === 'completed' || s.status === 'canceled') && s.saleDate >= salesStart && s.saleDate <= salesEnd);
        active.sort((a, b) => {
            const getNextDue = (sale) => { const pending = sale.installments?.find(i => !i.paid); return pending ? pending.dueDate : '9999-99-99'; };
            return getNextDue(a).localeCompare(getNextDue(b));
        });
        completedOrCanceled.sort((a, b) => b.saleDate.localeCompare(a.saleDate));
        return [...active, ...completedOrCanceled];
    }, [sales, salesSearch, salesStart, salesEnd]);

    const directSales = useMemo(() => {
        let list = sales.filter(s => s.saleType === 'direct');
        if (cashierSearch) {
            const lower = cashierSearch.toLowerCase();
            return list.filter(s => s.customerName.toLowerCase().includes(lower) || (s.items && s.items.some(i => i.productName.toLowerCase().includes(lower)))).sort((a, b) => b.saleDate.localeCompare(a.saleDate));
        } else {
            return list.filter(s => s.saleDate >= cashierStart && s.saleDate <= cashierEnd).sort((a, b) => b.saleDate.localeCompare(a.saleDate));
        }
    }, [sales, cashierSearch, cashierStart, cashierEnd]);

    const handleSaveTransaction = async (data) => {
        await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'transactions'), { ...data, createdAt: serverTimestamp() });
        setTransactionModalOpen(false);
    };

    const handleSaveProduct = async (data) => {
        if (productModalData.data) { await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'products', productModalData.data.id), data); } 
        else { await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'products'), { ...data, createdAt: serverTimestamp() }); }
        setProductModalData({ open: false, data: null });
        if (productDetailsData.open && productModalData.data) { setProductDetailsData({ open: true, data: { ...productModalData.data, ...data } }); }
    };

    const handleStockMovement = async (productId, movementInfo) => {
        const productRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'products', productId);
        const p = products.find(prod => prod.id === productId);
        if (!p) return;
        const currentQty = parseInt(p.quantity) || 0; const currentCost = parseFloat(p.costPrice) || 0;
        const movQty = parseInt(movementInfo.quantity) || 0; const movCost = parseFloat(movementInfo.unitCost) || 0;
        const movType = movementInfo.type; 
        let newQty = currentQty; let newCost = currentCost;
        let isEntry = ['compra', 'ajuste_entrada', 'devolucao'].includes(movType);
        if (isEntry) {
            newQty = currentQty + movQty;
            if (movType === 'compra' && movQty > 0) {
                const totalCurrentValue = currentQty * currentCost;
                const totalAddedValue = movQty * movCost;
                newCost = (totalCurrentValue + totalAddedValue) / newQty;
            }
        } else { newQty = currentQty - movQty; }
        const newMovement = {
            id: Date.now().toString(), type: movType, quantity: movQty, unitCost: isEntry && movType === 'compra' ? movCost : 0,
            date: new Date().toISOString(), previousQty: currentQty, newQty: newQty, notes: movementInfo.notes || ''
        };
        const updatedMovements = p.movements ? [...p.movements, newMovement] : [newMovement];
        await updateDoc(productRef, { quantity: newQty, costPrice: newCost, movements: updatedMovements });
        setStockMovementData({ open: false, data: null });
        setProductDetailsData({ open: true, data: { ...p, quantity: newQty, costPrice: newCost, movements: updatedMovements }});
    };

    const handleSaveCustomer = async (data) => {
        if (customerModalData.data) await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'customers', customerModalData.data.id), data);
        else await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'customers'), { ...data, createdAt: serverTimestamp() });
        setCustomerModalData({ open: false, data: null });
    };
    
    const handleAddSale = async (data) => {
        await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'sales'), data);
        if (data.items && data.items.length > 0) {
            for (const item of data.items) {
                if (item.productId) {
                    const prodRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'products', item.productId);
                    try {
                        const prodSnap = await getDoc(prodRef);
                        if (prodSnap.exists()) {
                            const currentQty = parseInt(prodSnap.data().quantity) || 0;
                            const qtyDeducted = parseInt(item.quantity) || 0;
                            await updateDoc(prodRef, { quantity: currentQty - qtyDeducted });
                        }
                    } catch (e) { console.error(e); }
                }
            }
        }
    };
    
    const handleCancelSaleLogic = async (saleId, reason) => {
        const sale = sales.find(s => s.id === saleId);
        if (!sale) return;
        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', saleId), { status: 'canceled', cancelReason: reason, canceledAt: serverTimestamp() });
        if (sale.items && sale.items.length > 0) {
            for (const item of sale.items) {
                if (item.productId) {
                    const prodRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'products', item.productId);
                    try {
                        const prodSnap = await getDoc(prodRef);
                        if (prodSnap.exists()) {
                            const currentQty = parseInt(prodSnap.data().quantity) || 0;
                            await updateDoc(prodRef, { quantity: currentQty + parseInt(item.quantity) });
                        }
                    } catch (e) { console.error(e); }
                }
            }
        }
    };

    const confirmCancelSale = async () => { await handleCancelSaleLogic(cancelModal.saleId, cancelModal.reason); setCancelModal({ open: false, saleId: null, reason: '' }); setSelectedSaleDetail(null); };

    const requestDelete = (type, id) => setDeleteModal({ open: true, type, id });
    const confirmDelete = async () => {
        const { type, id } = deleteModal;
        const col = type === 'sale' ? 'sales' : type === 'customer' ? 'customers' : 'products';
        await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, col, id));
        setDeleteModal({ open: false, type: null, id: null });
        if (type === 'product' && productDetailsData.data?.id === id) { setProductDetailsData({ open: false, data: null }); }
    };

    const handleUpdateProfile = async (updatedData) => {
        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'info'), updatedData);
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'all_users', user.uid), updatedData);
        setProfileModalOpen(false);
    };

    const handleClickPay = (sale, index) => {
        const item = sale.installments[index]; if (item.paid) return; 
        const isLast = index === sale.installments.length - 1;
        setPaymentModal({ open: true, saleId: sale.id, index, item, isLast });
    };

    const handleConfirmPayment = async (amountPaid, datePaid) => {
        const { saleId, index } = paymentModal; const sale = sales.find(s => s.id === saleId); if (!sale) return;
        let updatedInstallments = [...sale.installments];
        const currentInstallment = updatedInstallments[index]; const currentAmount = currentInstallment.amount;
        const amtPaidCents = Math.round(amountPaid * 100); const currAmtCents = Math.round(currentAmount * 100);
        let newHistory = currentInstallment.history || []; const timestamp = new Date().toISOString();

        if (amtPaidCents < currAmtCents) {
            newHistory.push({ date: datePaid, amount: amountPaid, type: 'partial', timestamp: timestamp });
            updatedInstallments[index] = { ...currentInstallment, amount: (currAmtCents - amtPaidCents) / 100, history: newHistory };
        } else if (amtPaidCents === currAmtCents) {
            newHistory.push({ date: datePaid, amount: amountPaid, type: 'full', timestamp: timestamp });
            updatedInstallments[index] = { ...currentInstallment, paid: true, paidAt: datePaid, history: newHistory, amount: 0, originalAmount: currentInstallment.originalAmount || currentInstallment.amount };
        } else {
            const surplus = (amtPaidCents - currAmtCents) / 100;
            newHistory.push({ date: datePaid, amount: currentAmount, surplus: surplus, type: 'full_surplus', timestamp: timestamp });
            updatedInstallments[index] = { ...currentInstallment, paid: true, paidAt: datePaid, amount: 0, history: newHistory, originalAmount: currentInstallment.originalAmount || currentInstallment.amount };
            if (index + 1 < updatedInstallments.length) {
                const next = updatedInstallments[index + 1]; const nextAmtCents = Math.round(next.amount * 100); const newNextAmountCents = nextAmtCents - Math.round(surplus * 100);
                let nextHistory = next.history || []; nextHistory.push({ date: datePaid, amount: surplus, type: 'abatement', fromInstallment: index, sourceTimestamp: timestamp, timestamp: new Date().toISOString() });
                updatedInstallments[index + 1] = { ...next, amount: newNextAmountCents > 0 ? newNextAmountCents / 100 : 0, paid: newNextAmountCents <= 0, paidAt: newNextAmountCents <= 0 ? datePaid : null, history: nextHistory, originalAmount: next.originalAmount || next.amount };
            }
        }
        const allPaid = updatedInstallments.every(i => i.paid);
        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', saleId), { installments: updatedInstallments, status: allPaid ? 'completed' : 'active' });
        setPaymentModal({ open: false, saleId: null, index: null, item: null, isLast: false });
    };

    const handleDeletePayment = async () => {
        const { saleId, instIndex, histIndex, historyItem } = deletePaymentModal; const sale = sales.find(s => s.id === saleId); if (!sale) return;
        let updatedInstallments = [...sale.installments]; const currentInst = updatedInstallments[instIndex];
        const updatedHistory = currentInst.history.filter((_, i) => i !== histIndex); let newAmount = currentInst.amount + historyItem.amount;
        updatedInstallments[instIndex] = { ...currentInst, amount: newAmount, paid: false, paidAt: null, history: updatedHistory };
        if (historyItem.type === 'full_surplus' && instIndex + 1 < updatedInstallments.length) {
            const nextInst = updatedInstallments[instIndex + 1]; const nextHistory = nextInst.history ? nextInst.history.filter(h => h.sourceTimestamp !== historyItem.timestamp) : []; const surplusAmount = historyItem.surplus;
            updatedInstallments[instIndex + 1] = { ...nextInst, amount: nextInst.amount + surplusAmount, paid: false, paidAt: null, history: nextHistory };
        }
        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', saleId), { installments: updatedInstallments, status: 'active' });
        setDeletePaymentModal({ open: false, saleId: null, instIndex: null, histIndex: null, historyItem: null });
    };

    const confirmDeletePayment = (saleId, instIndex, histIndex, historyItem) => {
        if (historyItem.type === 'abatement') return alert("Para cancelar este abatimento, exclua o pagamento com excedente na parcela anterior.");
        setDeletePaymentModal({ open: true, saleId, instIndex, histIndex, historyItem });
    };

    const handlePayFromList = async (item) => { const sale = sales.find(s => s.id === item.saleId); if (sale) handleClickPay(sale, item.installmentIndex); };

    const saveEditedInstallment = async (newData) => {
        const { saleId, installmentIndex } = editInstallmentModal; const sale = sales.find(s => s.id === saleId); if(!sale) return;
        const updated = [...sale.installments]; const oldAmount = updated[installmentIndex].amount; const newAmount = newData.amount; const diff = newAmount - oldAmount;
        if (newAmount <= 0 && !updated[installmentIndex].paid) { newData.amount = 0; newData.paid = true; newData.paidAt = getBrazilDateString(); }
        updated[installmentIndex] = newData; const allPaid = updated.every(i => i.paid); const newTotal = (sale.totalPrice || 0) + diff;
        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', saleId), { installments: updated, totalPrice: newTotal, status: allPaid ? 'completed' : 'active' });
    };

    const handleShowPixCode = (sale, installment) => {
        if (!userProfile?.pixKey) return alert("Configure sua chave PIX no seu Perfil primeiro!");
        const contractId = sale.id ? `VP-${sale.id.slice(-5).toUpperCase()}` : '00000';
        setPixModalData({ open: true, amount: installment.amount, txid: contractId.replace("-", "") });
    };

    const handleOpenWA = (type, sale, installment, historyItem) => {
        if (!sale) return;
        const currentCustomer = customers.find(c => c.id === sale.customerId);
        const phoneToUse = currentCustomer?.phone || sale.customerPhone;
        if (!phoneToUse) return alert("Este cliente não possui um telefone cadastrado!");
        const store = userProfile?.storeName || "Nossa Loja"; const contractId = sale.id ? `VP-${sale.id.slice(-5).toUpperCase()}` : '00000'; let msg = "";
        
        if (type === 'registro' || type === 'quitacao') {
            msg = type === 'quitacao' ? `🌟 *CONTRATO QUITADO*\n\n` : `📄 *CONTRATO REGISTRADO*\n\n`;
            msg += `📋 *Contrato:* ${contractId}\n👤 *Cliente:* ${sale.customerName}\n\n`;
            msg += `💵 *Valor da Compra:* ${formatCurrency(sale.totalPrice)}\n`;
            if (sale.entryAmount) msg += `💰 *Valor de Entrada:* ${formatCurrency(sale.entryAmount)}\n`;
            if (type === 'quitacao') msg += `\n🎉 Parabéns! Contrato quitado.\n`;
            msg += `\n*${store}*`;
        } 
        else if (type === 'comprovante') {
            msg = `🧾 *COMPROVANTE DE VENDA*\n\n📅 *Data:* ${formatDate(sale.saleDate)}\n👤 *Cliente:* ${sale.customerName}\n\n💵 *Total Pago:* ${formatCurrency(sale.totalPrice)}\n\nMuito obrigado pela preferência!\n*${store}*`;
        }
        else if (type === 'cobranca' && installment) {
            msg = `📋 *LEMBRETE DE PAGAMENTO*\n\nOlá *${sale.customerName}*!\n💵 *Valor:* ${formatCurrency(installment.amount)}\n📆 *Vencimento:* ${formatDate(installment.dueDate)}\n\nQualquer dúvida, estou à disposição!`;
        }
        else if (type === 'recibo' && installment) {
            const paidValue = historyItem ? historyItem.amount : installment.originalAmount || installment.amount;
            const paidDate = historyItem ? historyItem.date : installment.paidAt;
            msg = `✅ *PAGAMENTO REGISTRADO*\n\n👤 *Cliente:* ${sale.customerName}\n💵 *Valor Pago:* ${formatCurrency(paidValue)}\n📆 *Data:* ${formatDate(paidDate)}\n\nMuito obrigado!`;
        }
        setWaChooserModal({ open: true, phone: phoneToUse, message: msg });
    };

    if (showAdminPanel) return React.createElement(AdminUsersPanel, { onClose: () => setShowAdminPanel(false) });
    if (newSaleMode) return React.createElement(NewSaleScreen, { mode: newSaleMode, onClose: () => setNewSaleMode(null), customers, products, sales, onSaveSale: handleAddSale, userProfile, user });

    const getPaginatedData = (data, page) => { const start = (page - 1) * ITEMS_PER_PAGE; return data.slice(start, start + ITEMS_PER_PAGE); };

    return React.createElement('div', { className: "min-h-screen bg-slate-50 pb-24 font-sans text-slate-800" },
        React.createElement('header', { className: "bg-slate-900 text-white p-4 lg:p-6 rounded-b-3xl shadow-lg sticky top-0 z-40 w-full" },
            React.createElement('div', { className: "max-w-7xl mx-auto" },
                React.createElement('div', { className: "flex justify-between items-center mb-4" },
                    React.createElement('div', null,
                        React.createElement('h1', { className: "text-xl lg:text-2xl font-bold bg-gradient-to-r from-yellow-200 to-yellow-500 bg-clip-text text-transparent" }, userProfile?.storeName || "Minha Hinode"),
                        React.createElement('p', { className: "text-xs text-slate-400" }, `Olá, ${userProfile?.name?.split(' ')[0]}`)
                    ),
                    React.createElement('div', { className: "flex gap-2 items-center" },
                        userProfile?.role === 'admin' && React.createElement('button', { onClick: () => setShowAdminPanel(true), className: "bg-slate-800 p-2 rounded-full text-yellow-400 border border-slate-700 hover:bg-slate-700" }, React.createElement(Users, { size: 20 })),
                        React.createElement('button', { onClick: () => setProfileModalOpen(true), className: "bg-slate-800 p-2 rounded-full text-blue-400 border border-slate-700 hover:bg-slate-700" }, React.createElement(User, { size: 20 })),
                        React.createElement('button', { onClick: onLogout, className: "bg-slate-800 p-2 rounded-full text-red-400 border border-slate-700 hover:bg-slate-700" }, React.createElement(LogOut, { size: 20 }))
                    )
                ),
                React.createElement('div', { className: "flex space-x-1 overflow-x-auto no-scrollbar justify-start lg:justify-center" },
                    ['dashboard', 'sales', 'cashier', 'products', 'customers'].map((v) => (
                        React.createElement('button', { key: v, onClick: () => setView(v), className: `pb-2 px-3 lg:px-6 whitespace-nowrap font-medium text-sm lg:text-base transition-colors flex items-center gap-1 ${view === v ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-slate-400 hover:text-white'}` }, 
                            v === 'dashboard' ? 'Visão Geral' : 
                            v === 'sales' ? 'Vendas À Prazo' : v === 'cashier' ? 'Vendas' : v === 'products' ? 'Catálogo' : 'Clientes'
                        )
                    ))
                )
            )
        ),

        React.createElement('main', { className: "p-4 max-w-7xl mx-auto" },
            loadingData ? React.createElement('div', { className: "flex justify-center py-10" }, "Carregando dados...") :
            view === 'dashboard' && React.createElement(AbaVisaoGeral, { 
                dashPeriod, dashStartDate, dashEndDate, setDashPeriod, setDashStartDate, setDashEndDate, 
                dashboardTotals, allFinancialTransactions, onOpenTransactionModal: (type) => setTransactionModalOpen(true), 
                setInstallmentListModal, handlePayFromList, handleOpenWA 
            }),
            view === 'sales' && React.createElement(AbaVendasPrazo, { setNewSaleMode, salesPeriod, salesStart, salesEnd, setSalesPeriod, setSalesStart, setSalesEnd, salesSearch, setSalesSearch, paginatedSales: getPaginatedData(displayedSales, salesPage), displayedSales, salesPage, setSalesPage, setSelectedSaleDetail, ITEMS_PER_PAGE }),
            view === 'cashier' && React.createElement(AbaVendasCaixa, { setNewSaleMode, cashierPeriod, cashierStart, cashierEnd, setCashierPeriod, setCashierStart, setCashierEnd, cashierSearch, setCashierSearch, paginatedCashier: getPaginatedData(directSales, cashierPage), directSales, cashierPage, setCashierPage, setSelectedSaleDetail, ITEMS_PER_PAGE }),
            view === 'products' && React.createElement(AbaProdutos, { productSearch, setProductSearch, paginatedProducts: getPaginatedData(sortedProducts, productsPage), sortedProducts, productsPage, setProductsPage, setProductDetailsData, setProductModalData, ITEMS_PER_PAGE }),
            view === 'customers' && React.createElement(AbaClientes, { customerSearch, setCustomerSearch, setCustomerModalData, paginatedCustomers: getPaginatedData(sortedCustomers, customersPage), sales, requestDelete, sortedCustomers, customersPage, setCustomersPage, ITEMS_PER_PAGE })
        ),
        
        React.createElement(UserProfileModal, { isOpen: profileModalOpen, onClose: () => setProfileModalOpen(false), userProfile, onSave: handleUpdateProfile }),
        React.createElement(CustomerFormModal, { isOpen: customerModalData.open, onClose: () => setCustomerModalData({open:false, data:null}), initialData: customerModalData.data, onSave: handleSaveCustomer }),
        React.createElement(EditInstallmentModal, { isOpen: editInstallmentModal.open, onClose: () => setEditInstallmentModal({ open: false, saleId: null, data: null }), installment: editInstallmentModal.data, onSave: saveEditedInstallment }),
        
        React.createElement(ProductDetailsModal, { isOpen: productDetailsData.open, onClose: () => setProductDetailsData({open:false, data:null}), product: productDetailsData.data, salesHistory: sales, onEdit: (p) => setProductModalData({open: true, data: p}), onMovementRequest: (p) => setStockMovementData({open: true, data: p}), onDeleteRequest: requestDelete }),
        React.createElement(ProductModal, { isOpen: productModalData.open, onClose: () => setProductModalData({open: false, data: null}), onSave: handleSaveProduct, initialData: productModalData.data, lastCode: products.length > 0 ? String(products.reduce((max, p) => Math.max(max, parseInt(p.code || '0', 10) || 0), 0)).padStart(6, '0') : null }),
        React.createElement(StockMovementModal, { isOpen: stockMovementData.open, onClose: () => setStockMovementData({open: false, data: null}), product: stockMovementData.data, onSave: handleStockMovement }),
        React.createElement(TransactionModal, { isOpen: transactionModalOpen, onClose: () => setTransactionModalOpen(false), onSave: handleSaveTransaction }),

        React.createElement(SaleDetailsModal, { isOpen: !!activeSaleDetails, onClose: () => setSelectedSaleDetail(null), sale: activeSaleDetails, onPay: handleClickPay, onEdit: setEditInstallmentModal, onDeletePayment: confirmDeletePayment, onCancelSale: (saleId) => setCancelModal({ open: true, saleId, reason: '' }), onDeleteSale: requestDelete, onOpenWA: handleOpenWA, onShowPixCode: handleShowPixCode, hasPixSetup: !!(userProfile?.pixKey) }),

        React.createElement(PixCodeModal, { isOpen: pixModalData.open, onClose: () => setPixModalData({ open: false, amount: 0, txid: '' }), userProfile: userProfile, amount: pixModalData.amount, txid: pixModalData.txid }),
        React.createElement(InstallmentListModal, { isOpen: installmentListModal.open, onClose: () => setInstallmentListModal({ open: false, type: null, data: [] }), title: installmentListModal.type === 'overdue' ? 'Parcelas em Atraso' : 'Vencendo em 7 Dias', items: installmentListModal.data, onPay: handlePayFromList, onOpenWA: handleOpenWA }),
        React.createElement(PaymentConfirmationModal, { isOpen: paymentModal.open, onClose: () => setPaymentModal({ open: false, saleId: null, index: null, item: null, isLast: false }), onConfirm: handleConfirmPayment, installment: paymentModal.item, isLast: paymentModal.isLast }),
        React.createElement(ConfirmModal, { isOpen: deletePaymentModal.open, title: "Estornar Pagamento?", message: "O valor será devolvido para a parcela.", onClose: () => setDeletePaymentModal({ open: false }), onConfirm: handleDeletePayment }),
        React.createElement(ConfirmModal, { isOpen: cancelModal.open, title: "Cancelar Venda?", message: "Esta ação devolverá os itens ao estoque.", isCancel: true, reasonValue: cancelModal.reason, onReasonChange: (val) => setCancelModal(prev => ({...prev, reason: val})), onClose: () => setCancelModal({ open: false, saleId: null, reason: '' }), onConfirm: confirmCancelSale }),
        React.createElement(ConfirmModal, { isOpen: deleteModal.open, title: "Tem certeza?", message: "O registro será apagado.", onClose: () => { setDeleteModal({ open: false }); setSelectedSaleDetail(null); }, onConfirm: confirmDelete }),
        React.createElement(WhatsAppChooserModal, { isOpen: waChooserModal.open, phone: waChooserModal.phone, message: waChooserModal.message, onClose: () => setWaChooserModal({ open: false, phone: '', message: '' }) })
    );
};

function App() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                try {
                    const profileRef = doc(db, 'artifacts', APP_ID, 'users', currentUser.uid, 'profile', 'info');
                    const profileSnap = await getDoc(profileRef);
                    if (profileSnap.exists()) {
                        const data = profileSnap.data();
                        if (data.approved) { setUserProfile(data); setUser(currentUser); } 
                        else { setAccessDenied(true); await signOut(auth); }
                    } else { await signOut(auth); }
                } catch (e) { await signOut(auth); }
            } else { setUser(null); setUserProfile(null); }
            setLoadingAuth(false);
        });
        return () => unsubscribe();
    }, []);

    if (loadingAuth) return React.createElement('div', { className: "min-h-screen flex items-center justify-center bg-slate-50" }, "Carregando Sistema...");
    
    if (accessDenied) return React.createElement('div', { className: "min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center" },
        React.createElement(Lock, { size: 48, className: "text-red-500 mb-4" }),
        React.createElement('h1', { className: "text-2xl font-bold text-red-800 mb-2" }, "Acesso Negado"),
        React.createElement('p', { className: "text-red-600 mb-6" }, "Seu cadastro está pendente de aprovação."),
        React.createElement('button', { onClick: () => { setAccessDenied(false); window.location.reload(); }, className: "px-6 py-3 bg-red-600 text-white font-bold rounded-xl" }, "Voltar")
    );

    if (!user) return React.createElement(AuthScreen, {});
    return React.createElement(Dashboard, { user, userProfile, onLogout: async () => { await signOut(auth); window.location.reload(); } });
}

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));
