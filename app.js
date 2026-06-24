import React, { useState, useEffect, useMemo } from 'https://esm.sh/react@18.2.0';
import { createRoot } from 'https://esm.sh/react-dom@18.2.0/client';
import { Users, User, LogOut, Lock } from 'https://esm.sh/lucide-react@0.292.0';

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
    ConfirmModal, WhatsAppChooserModal, ProductModal, StockMovementModal
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

    useEffect(() => {
        const customersRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'customers');
        const productsRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'products');
        const salesRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'sales');
        
        const unsubC = onSnapshot(query(customersRef), s => setCustomers(s.docs.map(d => ({id:d.id, ...d.data()}))));
        const unsubP = onSnapshot(query(productsRef), s => setProducts(s.docs.map(d => ({id:d.id, ...d.data()}))));
        const unsubS = onSnapshot(query(salesRef), s => { setSales(s.docs.map(d => ({id:d.id, ...d.data()}))); setLoadingData(false); });
        return () => { unsubC(); unsubP(); unsubS(); };
    }, [user.uid]);

    useEffect(() => { if (dashPeriod === 'month') { setDashStartDate(getCurrentMonthStart()); setDashEndDate(getCurrentMonthEnd()); } }, [dashPeriod]);
    useEffect(() => { if (salesPeriod === 'month') { setSalesStart(getCurrentMonthStart()); setSalesEnd(getCurrentMonthEnd()); } }, [salesPeriod]);
    useEffect(() => { if (cashierPeriod === 'month') { setCashierStart(getCurrentMonthStart()); setCashierEnd(getCurrentMonthEnd()); } }, [cashierPeriod]);

    useEffect(() => setSalesPage(1), [salesSearch, salesPeriod, salesStart, salesEnd]);
    useEffect(() => setCashierPage(1), [cashierSearch, cashierPeriod, cashierStart, cashierEnd]);
    useEffect(() => setProductsPage(1), [productSearch]);
    useEffect(() => setCustomersPage(1), [customerSearch]);


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
            return baseSales.filter(s => 
                s.customerName.toLowerCase().includes(lower) || 
                (s.items && s.items.some(i => i.productName.toLowerCase().includes(lower)))
            ).sort((a, b) => b.saleDate.localeCompare(a.saleDate));
        }
        
        let active = baseSales.filter(s => s.status !== 'completed' && s.status !== 'canceled');
        let completedOrCanceled = baseSales.filter(s => (s.status === 'completed' || s.status === 'canceled') && s.saleDate >= salesStart && s.saleDate <= salesEnd);
        
        active.sort((a, b) => {
            const getNextDue = (sale) => {
                const pending = sale.installments?.find(i => !i.paid);
                return pending ? pending.dueDate : '9999-99-99';
            };
            return getNextDue(a).localeCompare(getNextDue(b));
        });
        completedOrCanceled.sort((a, b) => b.saleDate.localeCompare(a.saleDate));
        
        return [...active, ...completedOrCanceled];
    }, [sales, salesSearch, salesStart, salesEnd]);

    const directSales = useMemo(() => {
        let list = sales.filter(s => s.saleType === 'direct');
        if (cashierSearch) {
            const lower = cashierSearch.toLowerCase();
            return list.filter(s => 
                s.customerName.toLowerCase().includes(lower) || 
                (s.items && s.items.some(i => i.productName.toLowerCase().includes(lower)))
            ).sort((a, b) => b.saleDate.localeCompare(a.saleDate));
        } else {
            return list.filter(s => s.saleDate >= cashierStart && s.saleDate <= cashierEnd)
                       .sort((a, b) => b.saleDate.localeCompare(a.saleDate));
        }
    }, [sales, cashierSearch, cashierStart, cashierEnd]);

    const dashboardTotals = useMemo(() => {
        const validSales = sales.filter(s => s.status !== 'canceled');
        const periodSales = validSales.filter(s => s.saleDate >= dashStartDate && s.saleDate <= dashEndDate);
        
        const totalReceivable = validSales.filter(s => s.saleType === 'prazo' || !s.saleType).reduce((acc, s) => acc + (s.installments || []).filter(i => !i.paid).reduce((sum, i) => sum + i.amount, 0), 0);
        
        let cashIn = 0;

        periodSales.forEach(s => { 
            if (s.saleType === 'direct') {
                let netDirect = s.totalPrice;
                if (s.feeConfig && s.feeConfig.type === 'sem_juros') netDirect -= (s.feeConfig.value || 0); 
                else if (s.feeConfig && s.feeConfig.type === 'com_juros') netDirect -= (s.feeConfig.value || 0); 
                cashIn += netDirect;
            } 
            if (s.saleType === 'prazo' && s.entryAmount) cashIn += s.entryAmount; 
        });
        
        const overdueList = [];
        const upcomingList = [];
        const today = getBrazilDateString();
        const nextWeek = addDays(today, 7);

        validSales.forEach(s => {
            if (s.installments) {
                s.installments.forEach((i, idx) => {
                    if (i.paid && i.paidAt && (!i.history || i.history.length === 0)) {
                        const paidDate = i.paidAt.split('T')[0];
                        if (paidDate >= dashStartDate && paidDate <= dashEndDate) cashIn += i.amount;
                    }
                    if (i.history) {
                        i.history.forEach(h => {
                            if (h.type !== 'abatement' && h.date >= dashStartDate && h.date <= dashEndDate) cashIn += h.amount;
                        });
                    }

                    if (!i.paid) {
                        const itemData = { ...i, sale: s, saleId: s.id, customerName: s.customerName, customerPhone: s.customerPhone, installmentIndex: idx, isOverdue: i.dueDate < today };
                        if (i.dueDate < today) overdueList.push(itemData);
                        else if (i.dueDate <= nextWeek) upcomingList.push(itemData);
                    }
                });
            }
        });

        const totalOverdue = overdueList.reduce((acc, i) => acc + i.amount, 0);
        const totalUpcoming = upcomingList.reduce((acc, i) => acc + i.amount, 0);

        const estimatedProfit = periodSales.reduce((acc, s) => {
            let profit = s.totalPrice - (s.totalCost || 0);
            if (s.feeConfig && s.feeConfig.type === 'sem_juros') profit -= (s.feeConfig.value || 0);
            return acc + profit;
        }, 0);
        
        const periodCost = periodSales.reduce((acc, s) => acc + (s.totalCost || 0), 0);
        const realProfit = cashIn - periodCost; 
        
        return { 
            totalReceivable, totalReceived: cashIn, totalOverdue, totalUpcoming,
            estimatedProfit, realProfit, periodCost, overdueList, upcomingList 
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

        const newMovement = {
            id: Date.now().toString(),
            type: movType,
            quantity: movQty,
            unitCost: isEntry && movType === 'compra' ? movCost : 0,
            date: new Date().toISOString(),
            previousQty: currentQty,
            newQty: newQty,
            notes: movementInfo.notes || ''
        };

        const updatedMovements = p.movements ? [...p.movements, newMovement] : [newMovement];

        await updateDoc(productRef, {
            quantity: newQty,
            costPrice: newCost,
            movements: updatedMovements
        });

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
        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', saleId), {
            status: 'canceled', cancelReason: reason, canceledAt: serverTimestamp()
        });
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
                    } catch (e) { console.error("Erro ao restaurar estoque:", e); }
                }
            }
        }
    };

    const confirmCancelSale = async () => {
        await handleCancelSaleLogic(cancelModal.saleId, cancelModal.reason);
        setCancelModal({ open: false, saleId: null, reason: '' });
        setSelectedSaleDetail(null);
    };

    const requestDelete = (type, id) => setDeleteModal({ open: true, type, id });
    const confirmDelete = async () => {
        const { type, id } = deleteModal;
        const col = type === 'sale' ? 'sales' : type === 'customer' ? 'customers' : 'products';
        await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, col, id));
        setDeleteModal({ open: false, type: null, id: null });
        if (type === 'product' && productDetailsData.data?.id === id) {
            setProductDetailsData({ open: false, data: null });
        }
    };

    const handleUpdateProfile = async (updatedData) => {
        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'info'), updatedData);
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'all_users', user.uid), updatedData);
        setProfileModalOpen(false);
    };

    const handleClickPay = (sale, index) => {
        const item = sale.installments[index];
        if (item.paid) return; 
        const isLast = index === sale.installments.length - 1;
        setPaymentModal({ open: true, saleId: sale.id, index, item, isLast });
    };

    const handleConfirmPayment = async (amountPaid, datePaid) => {
        const { saleId, index } = paymentModal;
        const sale = sales.find(s => s.id === saleId);
        if (!sale) return;

        let updatedInstallments = [...sale.installments];
        const currentInstallment = updatedInstallments[index];
        const currentAmount = currentInstallment.amount;

        const amtPaidCents = Math.round(amountPaid * 100);
        const currAmtCents = Math.round(currentAmount * 100);

        let newHistory = currentInstallment.history || [];
        const timestamp = new Date().toISOString();

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
                const next = updatedInstallments[index + 1];
                const nextAmtCents = Math.round(next.amount * 100);
                const newNextAmountCents = nextAmtCents - Math.round(surplus * 100);
                let nextHistory = next.history || [];
                nextHistory.push({ date: datePaid, amount: surplus, type: 'abatement', fromInstallment: index, sourceTimestamp: timestamp, timestamp: new Date().toISOString() });
                
                updatedInstallments[index + 1] = { 
                    ...next, 
                    amount: newNextAmountCents > 0 ? newNextAmountCents / 100 : 0, 
                    paid: newNextAmountCents <= 0, 
                    paidAt: newNextAmountCents <= 0 ? datePaid : null, 
                    history: nextHistory, 
                    originalAmount: next.originalAmount || next.amount 
                };
            }
        }

        const allPaid = updatedInstallments.every(i => i.paid);
        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', saleId), { 
            installments: updatedInstallments, 
            status: allPaid ? 'completed' : 'active' 
        });

        setPaymentModal({ open: false, saleId: null, index: null, item: null, isLast: false });
    };

    const handleDeletePayment = async () => {
        const { saleId, instIndex, histIndex, historyItem } = deletePaymentModal;
        const sale = sales.find(s => s.id === saleId);
        if (!sale) return;

        let updatedInstallments = [...sale.installments];
        const currentInst = updatedInstallments[instIndex];
        
        const updatedHistory = currentInst.history.filter((_, i) => i !== histIndex);
        let newAmount = currentInst.amount + historyItem.amount;
        
        updatedInstallments[instIndex] = { ...currentInst, amount: newAmount, paid: false, paidAt: null, history: updatedHistory };

        if (historyItem.type === 'full_surplus' && instIndex + 1 < updatedInstallments.length) {
            const nextInst = updatedInstallments[instIndex + 1];
            const nextHistory = nextInst.history ? nextInst.history.filter(h => h.sourceTimestamp !== historyItem.timestamp) : [];
            const surplusAmount = historyItem.surplus;
            updatedInstallments[instIndex + 1] = { ...nextInst, amount: nextInst.amount + surplusAmount, paid: false, paidAt: null, history: nextHistory };
        }

        const allPaid = updatedInstallments.every(i => i.paid);
        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', saleId), { installments: updatedInstallments, status: 'active' });

        setDeletePaymentModal({ open: false, saleId: null, instIndex: null, histIndex: null, historyItem: null });
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
        const sale = sales.find(s => s.id === saleId);
        if(!sale) return;
        const updated = [...sale.installments];
        const oldAmount = updated[installmentIndex].amount;
        const newAmount = newData.amount;
        const diff = newAmount - oldAmount;

        if (newAmount <= 0 && !updated[installmentIndex].paid) {
            newData.amount = 0;
            newData.paid = true;
            newData.paidAt = getBrazilDateString();
        }

        updated[installmentIndex] = newData;
        const allPaid = updated.every(i => i.paid);
        const newTotal = (sale.totalPrice || 0) + diff;

        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', saleId), { installments: updated, totalPrice: newTotal, status: allPaid ? 'completed' : 'active' });
    };

    const handleShowPixCode = (sale, installment) => {
        if (!userProfile?.pixKey) return alert("Configure sua chave PIX no seu Perfil primeiro para gerar esse código!");
        const contractId = sale.id ? `VP-${sale.id.slice(-5).toUpperCase()}` : '00000';
        setPixModalData({ open: true, amount: installment.amount, txid: contractId.replace("-", "") });
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
            const paidValue = historyItem ? historyItem.amount : installment.originalAmount || installment.amount;
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
        setWaChooserModal({ open: true, phone: phoneToUse, message: msg });
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
            user: user
        });
    }

    const getPaginatedData = (data, page) => { const start = (page - 1) * ITEMS_PER_PAGE; return data.slice(start, start + ITEMS_PER_PAGE); };

    const paginatedSales = getPaginatedData(displayedSales, salesPage);
    const paginatedCashier = getPaginatedData(directSales, cashierPage);
    const paginatedProducts = getPaginatedData(sortedProducts, productsPage);
    const paginatedCustomers = getPaginatedData(sortedCustomers, customersPage);

    return React.createElement('div', { className: "min-h-screen bg-slate-50 pb-24 font-sans text-slate-800" },
        React.createElement('header', { className: "bg-slate-900 text-white p-4 lg:p-6 rounded-b-3xl shadow-lg sticky top-0 z-40 w-full" },
            React.createElement('div', { className: "max-w-7xl mx-auto" },
                React.createElement('div', { className: "flex justify-between items-center mb-4" },
                    React.createElement('div', null,
                        React.createElement('h1', { className: "text-xl lg:text-2xl font-bold bg-gradient-to-r from-yellow-200 to-yellow-500 bg-clip-text text-transparent" }, userProfile?.storeName || "Minha Hinode"),
                        React.createElement('p', { className: "text-xs text-slate-400" }, `Olá, ${userProfile?.name?.split(' ')[0]}`)
                    ),
                    React.createElement('div', { className: "flex gap-2 items-center" },
                        userProfile?.role === 'admin' && React.createElement('button', { onClick: () => setShowAdminPanel(true), className: "bg-slate-800 p-2 rounded-full text-yellow-400 border border-slate-700 hover:bg-slate-700 transition-colors" }, React.createElement(Users, { size: 20 })),
                        React.createElement('button', { onClick: () => setProfileModalOpen(true), className: "bg-slate-800 p-2 rounded-full text-blue-400 border border-slate-700 hover:bg-slate-700 transition-colors" }, React.createElement(User, { size: 20 })),
                        React.createElement('button', { onClick: onLogout, className: "bg-slate-800 p-2 rounded-full text-red-400 border border-slate-700 hover:bg-slate-700 transition-colors" }, React.createElement(LogOut, { size: 20 }))
                    )
                ),
                React.createElement('div', { className: "flex space-x-1 overflow-x-auto no-scrollbar justify-start lg:justify-center" },
                    ['dashboard', 'sales', 'cashier', 'products', 'customers'].map((v) => (
                        React.createElement('button', { key: v, onClick: () => setView(v), className: `pb-2 px-3 lg:px-6 whitespace-nowrap font-medium text-sm lg:text-base transition-colors ${view === v ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-slate-400 hover:text-white'}` }, v === 'dashboard' ? 'Visão Geral' : v === 'sales' ? 'Vendas À Prazo' : v === 'cashier' ? 'Vendas' : v === 'products' ? 'Catálogo' : 'Clientes')
                    ))
                )
            )
        ),

        React.createElement('main', { className: "p-4 max-w-7xl mx-auto" },
            loadingData ? React.createElement('div', { className: "flex justify-center py-10" }, "Carregando dados...") :
            view === 'dashboard' && React.createElement(AbaVisaoGeral, {
                dashPeriod, dashStartDate, dashEndDate, setDashPeriod, setDashStartDate, setDashEndDate, dashboardTotals, setInstallmentListModal
            }),
            view === 'sales' && React.createElement(AbaVendasPrazo, {
                setNewSaleMode, salesPeriod, salesStart, salesEnd, setSalesPeriod, setSalesStart, setSalesEnd,
                salesSearch, setSalesSearch, paginatedSales, displayedSales, salesPage, setSalesPage, setSelectedSaleDetail, ITEMS_PER_PAGE
            }),
            view === 'cashier' && React.createElement(AbaVendasCaixa, {
                setNewSaleMode, cashierPeriod, cashierStart, cashierEnd, setCashierPeriod, setCashierStart, setCashierEnd,
                cashierSearch, setCashierSearch, paginatedCashier, directSales, cashierPage, setCashierPage, setSelectedSaleDetail, ITEMS_PER_PAGE
            }),
            view === 'products' && React.createElement(AbaProdutos, {
                productSearch, setProductSearch, paginatedProducts, sortedProducts, productsPage, setProductsPage, setProductDetailsData, setProductModalData, ITEMS_PER_PAGE
            }),
            view === 'customers' && React.createElement(AbaClientes, {
                customerSearch, setCustomerSearch, setCustomerModalData, paginatedCustomers, sales, requestDelete, sortedCustomers, customersPage, setCustomersPage, ITEMS_PER_PAGE
            })
        ),
        
        React.createElement(UserProfileModal, { isOpen: profileModalOpen, onClose: () => setProfileModalOpen(false), userProfile: userProfile, onSave: handleUpdateProfile }),
        React.createElement(CustomerFormModal, { isOpen: customerModalData.open, onClose: () => setCustomerModalData({open:false, data:null}), initialData: customerModalData.data, onSave: handleSaveCustomer }),
        React.createElement(EditInstallmentModal, { isOpen: editInstallmentModal.open, onClose: () => setEditInstallmentModal({ open: false, saleId: null, data: null }), installment: editInstallmentModal.data, onSave: saveEditedInstallment }),
        
        React.createElement(ProductDetailsModal, { 
            isOpen: productDetailsData.open, 
            onClose: () => setProductDetailsData({open:false, data:null}), 
            product: productDetailsData.data,
            salesHistory: sales,
            onEdit: (p) => setProductModalData({open: true, data: p}),
            onMovementRequest: (p) => setStockMovementData({open: true, data: p}),
            onDeleteRequest: requestDelete
        }),
        React.createElement(ProductModal, {
            isOpen: productModalData.open,
            onClose: () => setProductModalData({open: false, data: null}),
            onSave: handleSaveProduct,
            initialData: productModalData.data,
            lastCode: products.length > 0 ? String(products.reduce((max, p) => Math.max(max, parseInt(p.code || '0', 10) || 0), 0)).padStart(6, '0') : null
        }),
        React.createElement(StockMovementModal, {
            isOpen: stockMovementData.open,
            onClose: () => setStockMovementData({open: false, data: null}),
            product: stockMovementData.data,
            onSave: handleStockMovement
        }),

        React.createElement(SaleDetailsModal, {
            isOpen: !!activeSaleDetails, onClose: () => setSelectedSaleDetail(null), sale: activeSaleDetails,
            onPay: handleClickPay, onEdit: setEditInstallmentModal, onDeletePayment: confirmDeletePayment,
            onCancelSale: (saleId) => setCancelModal({ open: true, saleId, reason: '' }), onDeleteSale: requestDelete,
            onOpenWA: handleOpenWA, onShowPixCode: handleShowPixCode, hasPixSetup: !!(userProfile?.pixKey)
        }),

        React.createElement(PixCodeModal, { isOpen: pixModalData.open, onClose: () => setPixModalData({ open: false, amount: 0, txid: '' }), userProfile: userProfile, amount: pixModalData.amount, txid: pixModalData.txid }),
        React.createElement(InstallmentListModal, { isOpen: installmentListModal.open, onClose: () => setInstallmentListModal({ open: false, type: null, data: [] }), title: installmentListModal.type === 'overdue' ? 'Parcelas em Atraso' : 'Vencendo em 7 Dias', items: installmentListModal.data, onPay: handlePayFromList, onOpenWA: handleOpenWA }),
        React.createElement(PaymentConfirmationModal, { isOpen: paymentModal.open, onClose: () => setPaymentModal({ open: false, saleId: null, index: null, item: null, isLast: false }), onConfirm: handleConfirmPayment, installment: paymentModal.item, isLast: paymentModal.isLast }),
        React.createElement(ConfirmModal, { isOpen: deletePaymentModal.open, title: "Estornar Pagamento?", message: "O valor será devolvido para a parcela e ela ficará em aberto novamente.", onClose: () => setDeletePaymentModal({ open: false, saleId: null, instIndex: null, histIndex: null, historyItem: null }), onConfirm: handleDeletePayment }),
        React.createElement(ConfirmModal, { isOpen: cancelModal.open, title: "Cancelar Venda?", message: "Esta ação irá devolver os produtos ao estoque e invalidar os pagamentos.", isCancel: true, reasonValue: cancelModal.reason, onReasonChange: (val) => setCancelModal(prev => ({...prev, reason: val})), onClose: () => setCancelModal({ open: false, saleId: null, reason: '' }), onConfirm: confirmCancelSale }),
        React.createElement(ConfirmModal, { isOpen: deleteModal.open, title: "Tem certeza?", message: "O registro será apagado permanentemente.", onClose: () => { setDeleteModal({ open: false, id: null, type: null }); setSelectedSaleDetail(null); }, onConfirm: confirmDelete }),
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
                    const publicRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'all_users', currentUser.uid);
                    
                    const profileSnap = await getDoc(profileRef);
                    const publicSnap = await getDoc(publicRef);
                    if (profileSnap.exists() && !publicSnap.exists()) {
                        await setDoc(publicRef, profileSnap.data());
                    }

                    if (profileSnap.exists()) {
                        const data = profileSnap.data();
                        if (data.approved) { setUserProfile(data); setUser(currentUser); } 
                        else { setAccessDenied(true); await signOut(auth); }
                    } else {
                        await signOut(auth);
                    }
                } catch (e) {
                    await signOut(auth);
                }
            } else {
                setUser(null); setUserProfile(null);
            }
            setLoadingAuth(false);
        });
        return () => unsubscribe();
    }, []);

    if (loadingAuth) return React.createElement('div', { className: "min-h-screen flex items-center justify-center bg-slate-50" }, "Carregando Sistema...");
    
    if (accessDenied) return React.createElement('div', { className: "min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center" },
        React.createElement(Lock, { size: 48, className: "text-red-500 mb-4" }),
        React.createElement('h1', { className: "text-2xl font-bold text-red-800 mb-2" }, "Acesso Negado"),
        React.createElement('p', { className: "text-red-600 mb-6" }, "Seu cadastro ainda está pendente de aprovação pelo administrador."),
        React.createElement('button', { onClick: () => { setAccessDenied(false); window.location.reload(); }, className: "px-6 py-3 bg-red-600 text-white font-bold rounded-xl" }, "Voltar")
    );

    if (!user) return React.createElement(AuthScreen, {});
    return React.createElement(Dashboard, { user: user, userProfile: userProfile, onLogout: async () => { await signOut(auth); window.location.reload(); } });
}

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));
