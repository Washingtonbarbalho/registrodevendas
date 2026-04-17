import {
  React, useState, useEffect, useMemo, useRef,
  Users, ShoppingBag, PlusCircle, CheckCircle, MessageCircle, Trash2, ChevronDown, ChevronUp, Package, TrendingUp, Edit2, AlertTriangle, Wallet, Search, CreditCard, QrCode, Banknote, Calendar, Filter, X, PieChart, BarChart3, ArrowUpRight, ArrowDownRight, PackageMinus, LogOut, Lock, Mail, Phone, Store, UserCog, UserCheck, UserX, Shield, ChevronLeft, ChevronRight, MoreHorizontal, LayoutGrid, AlertCircle, RefreshCw, Clock, Bell, History, FileText, XCircle, User, Smartphone, Copy, Tag, Info, MapPin, BadgePercent, Receipt,
  db, auth, APP_ID, ADMIN_EMAIL,
  collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged
} from '../core.js';

import { formatCurrency, parseMoney, maskMoney, maskPhone, maskCpfCnpj, maskCep, applyPixMask, formatDate, getBrazilDateString, addDays, getCurrentMonthStart, getCurrentMonthEnd } from './utils.js';
import { MoneyInput, Pagination, DateRangeFilter } from './ui.js';
import { ConfirmModal, WhatsAppChooserModal, UserProfileModal, PaymentConfirmationModal, InstallmentListModal } from './modals.js';
import { AdminUsersPanel } from './admin.js';
import { EditInstallmentModal, ProductDetailsModal, CustomerFormModal, NewSaleModal, SaleDetailsModal } from './forms.js';

const Dashboard = ({ user, userProfile, onLogout }) => {
    const [view, setView] = useState('dashboard');
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [sales, setSales] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    // Dashboard Date Filter
    const [dashPeriod, setDashPeriod] = useState('month'); 
    const [dashStartDate, setDashStartDate] = useState(getCurrentMonthStart());
    const [dashEndDate, setDashEndDate] = useState(getCurrentMonthEnd());

    // PAGINATION STATES
    const ITEMS_PER_PAGE = 10;
    const [salesPage, setSalesPage] = useState(1);
    const [cashierPage, setCashierPage] = useState(1);
    const [productsPage, setProductsPage] = useState(1);
    const [customersPage, setCustomersPage] = useState(1);

    // SALES TAB FILTER STATE
    const [salesPeriod, setSalesPeriod] = useState('month');
    const [salesStart, setSalesStart] = useState(getCurrentMonthStart());
    const [salesEnd, setSalesEnd] = useState(getCurrentMonthEnd());

    // CASHIER TAB FILTER STATE
    const [cashierPeriod, setCashierPeriod] = useState('month');
    const [cashierStart, setCashierStart] = useState(getCurrentMonthStart());
    const [cashierEnd, setCashierEnd] = useState(getCurrentMonthEnd());

    // SEARCH STATES
    const [salesSearch, setSalesSearch] = useState('');
    const [cashierSearch, setCashierSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');

    // MODALS
    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
    const [productViewModalData, setProductViewModalData] = useState({ open: false, data: null }); 
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
        let totalFeesPaidByStore = 0;

        periodSales.forEach(s => { 
            if (s.saleType === 'direct') {
                let netDirect = s.totalPrice;
                if (s.feeConfig && s.feeConfig.type === 'sem_juros') {
                    netDirect -= (s.feeConfig.value || 0); 
                    totalFeesPaidByStore += (s.feeConfig.value || 0);
                } else if (s.feeConfig && s.feeConfig.type === 'com_juros') {
                    netDirect -= (s.feeConfig.value || 0); 
                }
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

    const handleSaveCustomer = async (data) => {
        if (customerModalData.data) await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'customers', customerModalData.data.id), data);
        else await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'customers'), { ...data, createdAt: serverTimestamp() });
        setCustomerModalData({ open: false, data: null });
    };
    
    const handleAddSale = async (data) => {
        await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'sales'), { ...data, createdAt: serverTimestamp() });
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
    
    // --- LÓGICA DE CANCELAMENTO ---
    const handleCancelSaleLogic = async (saleId, reason) => {
        const sale = sales.find(s => s.id === saleId);
        if (!sale) return;
        
        // 1. Atualiza Status
        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', saleId), {
            status: 'canceled',
            cancelReason: reason,
            canceledAt: serverTimestamp()
        });

        // 2. Retorna Itens pro Estoque
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

    // --- GERADOR DE MENSAGENS E ACIONADOR DE WHATSAPP ---
    const handleOpenWA = (type, sale, installment, historyItem) => {
        if (!sale) return;

        // BUSCA O TELEFONE ATUALIZADO NO CADASTRO DO CLIENTE
        const currentCustomer = customers.find(c => c.id === sale.customerId);
        const phoneToUse = currentCustomer?.phone || sale.customerPhone;

        if (!phoneToUse) {
            alert("Este cliente não possui um telefone de WhatsApp cadastrado!");
            return;
        }

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
            sale.items?.forEach(item => {
                msg += `▪️ ${item.quantity}x ${item.productName} - ${formatCurrency(item.price)}\n`;
            });
            msg += `\n`;

            msg += `💵 *Valor da Compra:* ${formatCurrency(sale.totalPrice)}\n`;
            if (sale.entryAmount) msg += `💰 *Valor de Entrada:* ${formatCurrency(sale.entryAmount)}\n`;
            
            if (!isQuitacao && sale.installments?.length > 0) {
                msg += `📆 *1º Vencimento:* ${formatDate(sale.installments[0].dueDate)}\n`;
            }

            if (isQuitacao) {
                msg += `\n🎉 Parabéns! Informamos que o seu contrato no valor total de *${formatCurrency(sale.totalPrice)}* foi totalmente quitado.\n`;
            }

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
            sale.items?.forEach(item => {
                msg += `▪️ ${item.quantity}x ${item.productName} - ${formatCurrency(item.price)}\n`;
            });

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

            if (daysDiff === 0) {
                statusHeader = "🔔 *VENCIMENTO HOJE*";
                daysText = "(HOJE)";
            } else if (daysDiff < 0) {
                statusHeader = "⚠️ *AVISO DE ATRASO*";
                daysText = `(Vencido há ${Math.abs(daysDiff)} dias)`;
                instStatus = "⚠️ Atrasada";
            }

            msg = `Olá *${sale.customerName}*!\n`;
            msg += `━━━━━━━━━━━━━━━━━━━\n\n`;
            msg += `${statusHeader}\n\n`;
            msg += `💵 *Valor:* ${formatCurrency(installment.amount)}\n`;
            msg += `📊 *Parcela:* ${installment.number}/${sale.installmentsCount || sale.installments?.length}\n`;
            msg += `📆 *Vencimento:* ${formatDate(installment.dueDate)} ${daysText}\n\n`;
            msg += `📊 *STATUS DA PARCELA:*\n`;
            msg += `${installment.number}️⃣ ${instStatus}\n`;

            if (userProfile?.pixKey && userProfile?.pixBank && userProfile?.pixName) {
                msg += `\n💳 *DADOS PARA PAGAMENTO (PIX):*\n`;
                msg += `🏦 *Banco:* ${userProfile.pixBank}\n`;
                msg += `👤 *Titular:* ${userProfile.pixName}\n`;
                msg += `🔑 *Chave PIX:* ${applyPixMask(userProfile.pixKey, userProfile.pixType)}\n`;
            }

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

    const getPaginatedData = (data, page) => {
        const start = (page - 1) * ITEMS_PER_PAGE;
        return data.slice(start, start + ITEMS_PER_PAGE);
    };

    const paginatedSales = getPaginatedData(displayedSales, salesPage);
    const paginatedCashier = getPaginatedData(directSales, cashierPage);
    const paginatedProducts = getPaginatedData(sortedProducts, productsPage);
    const paginatedCustomers = getPaginatedData(sortedCustomers, customersPage);

    return React.createElement('div', { className: "min-h-screen bg-slate-50 pb-24 font-sans text-slate-800" },
        // --- HEADER RESPONSIVO ---
        React.createElement('header', { className: "bg-slate-900 text-white p-4 lg:p-6 rounded-b-3xl shadow-lg sticky top-0 z-40 w-full" },
            React.createElement('div', { className: "max-w-7xl mx-auto" },
                React.createElement('div', { className: "flex justify-between items-center mb-4" },
                    React.createElement('div', null,
                        React.createElement('h1', { className: "text-xl lg:text-2xl font-bold bg-gradient-to-r from-yellow-200 to-yellow-500 bg-clip-text text-transparent" }, userProfile?.storeName || "Minha Hinode"),
                        React.createElement('p', { className: "text-xs text-slate-400" }, `Olá, ${userProfile?.name?.split(' ')[0]}`)
                    ),
                    React.createElement('div', { className: "flex gap-2" },
                        userProfile?.role === 'admin' && React.createElement('button', { onClick: () => setShowAdminPanel(true), className: "bg-slate-800 p-2 rounded-full text-yellow-400 border border-slate-700 hover:bg-slate-700" }, React.createElement(Users, { size: 20 })),
                        React.createElement('button', { onClick: () => setProfileModalOpen(true), className: "bg-slate-800 p-2 rounded-full text-blue-400 border border-slate-700 hover:bg-slate-700" }, React.createElement(User, { size: 20 })),
                        React.createElement('button', { onClick: onLogout, className: "bg-slate-800 p-2 rounded-full text-red-400 border border-slate-700 hover:bg-slate-700" }, React.createElement(LogOut, { size: 20 })),
                         React.createElement('button', { onClick: () => setIsSaleModalOpen(true), className: "bg-yellow-500 hover:bg-yellow-400 text-slate-900 p-2 rounded-full shadow-lg transition-transform active:scale-95 ml-2" }, React.createElement(PlusCircle, { size: 20 }))
                    )
                ),
                React.createElement('div', { className: "flex space-x-1 overflow-x-auto no-scrollbar justify-start lg:justify-center" },
                    ['dashboard', 'sales', 'cashier', 'products', 'customers'].map((v) => (
                        React.createElement('button', { key: v, onClick: () => setView(v), className: `pb-2 px-3 lg:px-6 whitespace-nowrap font-medium text-sm lg:text-base transition-colors ${view === v ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-slate-400 hover:text-white'}` }, v === 'dashboard' ? 'Visão Geral' : v === 'sales' ? 'Cobranças' : v === 'cashier' ? 'Vendas' : v === 'products' ? 'Catálogo' : 'Clientes')
                    ))
                )
            )
        ),

        // --- MAIN CONTAINER (Responsivo) ---
        React.createElement('main', { className: "p-4 max-w-7xl mx-auto" },
            loadingData ? React.createElement('div', { className: "flex justify-center py-10" }, "Carregando dados...") :
            view === 'dashboard' && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                React.createElement(DateRangeFilter, { period: dashPeriod, startDate: dashStartDate, endDate: dashEndDate, onPeriodChange: setDashPeriod, onStartChange: setDashStartDate, onEndChange: setDashEndDate }),
                
                // GRID DASHBOARD
                React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" },
                    React.createElement('div', { className: "bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center" }, React.createElement('div', null, React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase tracking-wider" }, "A Receber (Total)"), React.createElement('h3', { className: "text-2xl lg:text-3xl font-bold text-slate-800" }, formatCurrency(dashboardTotals.totalReceivable))), React.createElement('div', { className: "bg-blue-50 p-3 rounded-full" }, React.createElement(TrendingUp, { className: "text-blue-500" }))),
                    
                    React.createElement('div', { className: "bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center" }, React.createElement('div', null, React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase tracking-wider" }, "Entrou em Caixa"), React.createElement('h3', { className: "text-2xl lg:text-3xl font-bold text-emerald-600" }, formatCurrency(dashboardTotals.totalReceived)), React.createElement('p', { className: "text-xs text-slate-400 mt-1" }, "Neste período")), React.createElement('div', { className: "bg-emerald-50 p-3 rounded-full" }, React.createElement(Wallet, { className: "text-emerald-500" }))),

                    // CARD ATRASADO
                    React.createElement('div', { 
                        onClick: () => setInstallmentListModal({ open: true, type: 'overdue', data: dashboardTotals.overdueList }),
                        className: "bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between cursor-pointer hover:bg-red-50 transition-colors group h-32"
                    }, 
                        React.createElement('div', { className: "flex justify-between items-start mb-2" }, 
                            React.createElement('div', { className: "bg-red-50 group-hover:bg-white p-2 rounded-lg transition-colors" }, React.createElement(AlertTriangle, { size: 20, className: "text-red-500" })), 
                            React.createElement(ChevronRight, { size: 16, className: "text-slate-300 group-hover:text-red-300" })
                        ), 
                        React.createElement('div', null, 
                            React.createElement('p', { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-red-400" }, "Em Atraso"), 
                            React.createElement('h3', { className: "text-lg font-bold text-red-500" }, formatCurrency(dashboardTotals.totalOverdue))
                        )
                    ),

                    // CARD A VENCER
                    React.createElement('div', { 
                        onClick: () => setInstallmentListModal({ open: true, type: 'upcoming', data: dashboardTotals.upcomingList }),
                        className: "bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between cursor-pointer hover:bg-yellow-50 transition-colors group h-32"
                    }, 
                        React.createElement('div', { className: "flex justify-between items-start mb-2" }, 
                            React.createElement('div', { className: "bg-yellow-50 group-hover:bg-white p-2 rounded-lg transition-colors" }, React.createElement(Bell, { size: 20, className: "text-yellow-600" })), 
                            React.createElement(ChevronRight, { size: 16, className: "text-slate-300 group-hover:text-yellow-300" })
                        ), 
                        React.createElement('div', null, 
                            React.createElement('p', { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-yellow-600" }, "A Vencer (7 dias)"), 
                            React.createElement('h3', { className: "text-lg font-bold text-yellow-600" }, formatCurrency(dashboardTotals.totalUpcoming))
                        )
                    )
                ),
                
                React.createElement('div', { className: "grid grid-cols-2 lg:grid-cols-4 gap-4" },
                    React.createElement('div', { className: "bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between" }, React.createElement('div', { className: "flex justify-between items-start mb-2" }, React.createElement('div', { className: "bg-yellow-50 p-2 rounded-lg" }, React.createElement(PieChart, { size: 20, className: "text-yellow-600" })), React.createElement(ArrowUpRight, { size: 16, className: "text-slate-300" })), React.createElement('div', null, React.createElement('p', { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider" }, "Lucro Estimado"), React.createElement('h3', { className: "text-lg font-bold text-slate-800" }, formatCurrency(dashboardTotals.estimatedProfit)))),
                    React.createElement('div', { className: "bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between" }, React.createElement('div', { className: "flex justify-between items-start mb-2" }, React.createElement('div', { className: "bg-purple-50 p-2 rounded-lg" }, React.createElement(BarChart3, { size: 20, className: "text-purple-600" })), React.createElement(ArrowDownRight, { size: 16, className: "text-slate-300" })), React.createElement('div', null, React.createElement('p', { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider" }, "Lucro Real (Cx)"), React.createElement('h3', { className: `text-lg font-bold ${dashboardTotals.realProfit >= 0 ? 'text-purple-600' : 'text-red-500'}` }, formatCurrency(dashboardTotals.realProfit))))
                )
            ),
            
            view === 'sales' && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                React.createElement(DateRangeFilter, { period: salesPeriod, startDate: salesStart, endDate: salesEnd, onPeriodChange: setSalesPeriod, onStartChange: setSalesStart, onEndChange: setSalesEnd }),
                React.createElement('div', { className: "relative mb-4" }, React.createElement(Search, { className: "absolute left-3 top-3 text-slate-400", size: 18 }), React.createElement('input', { className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none", placeholder: "Buscar cobrança...", value: salesSearch, onChange: e => setSalesSearch(e.target.value.toUpperCase()) })),
                paginatedSales.length === 0 && React.createElement('p', { className: "text-center text-slate-400 py-10" }, "Nenhuma cobrança encontrada."),
                
                // GRID DE COBRANÇAS
                React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
                    paginatedSales.map(sale => {
                        const pendingAmount = sale.installments ? sale.installments.filter(i => !i.paid).reduce((acc, i) => acc + i.amount, 0) : 0;
                        const paidInstallments = sale.installments ? sale.installments.filter(i => i.paid).length : 0;
                        const totalInst = sale.installmentsCount || 0;
                        return React.createElement('div', { key: sale.id, className: `bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden transition-all hover:shadow-md cursor-pointer ${sale.status === 'completed' ? 'opacity-60 bg-slate-50' : sale.status === 'canceled' ? 'opacity-50 grayscale' : ''}`, onClick: () => setSelectedSaleDetail(sale) },
                            React.createElement('div', { className: "p-4" },
                                React.createElement('div', { className: "flex justify-between items-start mb-2" },
                                    React.createElement('div', null, React.createElement('p', { className: "text-xs font-bold text-slate-500 uppercase" }, sale.customerName), React.createElement('p', { className: `font-bold text-lg ${sale.status === 'canceled' ? 'text-red-500 line-through' : 'text-slate-800'}` }, formatCurrency(sale.totalPrice)), React.createElement('p', { className: "text-xs text-slate-400 mt-0.5" }, formatDate(sale.saleDate))),
                                    React.createElement('span', { className: `px-2 py-1 rounded text-xs font-bold ${sale.status === 'canceled' ? 'bg-red-100 text-red-700' : sale.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}` }, sale.status === 'canceled' ? 'Cancelado' : sale.status === 'completed' ? 'Quitado' : 'Aberto')
                                ),
                                sale.status !== 'canceled' && React.createElement('div', { className: "flex justify-between items-center text-xs text-slate-500 mt-2 pt-2 border-t border-slate-50" }, React.createElement('span', { className: "flex items-center gap-1" }, React.createElement(CheckCircle, { size: 12, className: paidInstallments === totalInst ? 'text-emerald-500' : 'text-slate-400' }), `Pagos: ${paidInstallments}/${totalInst}`), React.createElement('span', null, pendingAmount > 0 ? `Resta: ${formatCurrency(pendingAmount)}` : 'Concluído'))
                            )
                        );
                    })
                ),
                React.createElement(Pagination, { totalItems: displayedSales.length, itemsPerPage: ITEMS_PER_PAGE, currentPage: salesPage, onPageChange: setSalesPage })
            ),
            
            view === 'cashier' && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                React.createElement(DateRangeFilter, { period: cashierPeriod, startDate: cashierStart, endDate: cashierEnd, onPeriodChange: setCashierPeriod, onStartChange: setCashierStart, onEndChange: setCashierEnd }),
                React.createElement('div', { className: "relative mb-2" }, React.createElement(Search, { className: "absolute left-3 top-3 text-slate-400", size: 18 }), React.createElement('input', { className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none", placeholder: "Buscar venda...", value: cashierSearch, onChange: e => setCashierSearch(e.target.value.toUpperCase()) })),
                paginatedCashier.length === 0 ? React.createElement('p', { className: "text-center text-slate-400 py-10" }, "Nenhuma venda encontrada.") : 
                
                // GRID CAIXA/VENDAS DIRETAS
                React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
                    paginatedCashier.map(sale => {
                        return React.createElement('div', { key: sale.id, className: `bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md cursor-pointer ${sale.status === 'canceled' ? 'opacity-50 grayscale' : ''}`, onClick: () => setSelectedSaleDetail(sale) },
                            React.createElement('div', { className: "p-4 flex flex-col gap-2 relative" },
                                sale.status === 'canceled' && React.createElement('div', { className: "absolute top-2 right-2" }, React.createElement('span', { className: "bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded font-bold" }, "Cancelado")),
                                React.createElement('div', { className: "flex justify-between items-start" },
                                    React.createElement('div', null, React.createElement('p', { className: `font-bold text-lg ${sale.status === 'canceled' ? 'text-red-500 line-through' : 'text-slate-800'}` }, formatCurrency(sale.totalPrice)), React.createElement('p', { className: "text-sm text-slate-500" }, sale.customerName)),
                                    React.createElement('div', { className: "flex flex-col items-end" },
                                        React.createElement('span', { className: "bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded capitalize flex items-center gap-1 mt-1" }, sale.paymentMethod === 'pix' && React.createElement(QrCode, { size: 10 }), sale.paymentMethod === 'money' && React.createElement(Banknote, { size: 10 }), (sale.paymentMethod === 'credit' || sale.paymentMethod === 'debit') && React.createElement(CreditCard, { size: 10 }), sale.paymentMethod === 'credit' ? `Crédito ${sale.cardInstallments}x` : sale.paymentMethod === 'money' ? 'Dinheiro' : sale.paymentMethod === 'debit' ? 'Débito' : 'PIX'),
                                        React.createElement('span', { className: "text-xs text-slate-400 mt-1" }, formatDate(sale.saleDate))
                                    )
                                )
                            )
                        );
                    })
                ),
                React.createElement(Pagination, { totalItems: directSales.length, itemsPerPage: ITEMS_PER_PAGE, currentPage: cashierPage, onPageChange: setCashierPage })
            ),
            
            view === 'products' && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                React.createElement('div', { className: "flex gap-2 mb-2" }, 
                    React.createElement('div', { className: "relative flex-1" }, 
                        React.createElement(Search, { className: "absolute left-3 top-3 text-slate-400", size: 18 }), 
                        React.createElement('input', { className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none shadow-sm", placeholder: "Buscar produto...", value: productSearch, onChange: e => setProductSearch(e.target.value.toUpperCase()) })
                    )
                ),
                
                // GRID PRODUTOS (SOMENTE LEITURA)
                React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
                    paginatedProducts.map(p => {
                        const today = getBrazilDateString();
                        const isPromo = p.isPromo && today >= p.promoStart && today <= p.promoEnd;
                        
                        return React.createElement('div', { key: p.id, onClick: () => setProductViewModalData({open: true, data: p}), className: "bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm cursor-pointer hover:border-yellow-300 transition-colors" }, 
                            React.createElement('div', { className: "flex flex-col gap-1" }, 
                                React.createElement('span', { className: "text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded self-start" }, `#${p.code}`), 
                                React.createElement('span', { className: "font-bold text-slate-800 text-sm leading-tight flex items-center gap-1" }, p.name, isPromo && React.createElement(Tag, { size: 12, className: "text-purple-500" }))
                            ), 
                            React.createElement('div', { className: "flex flex-col items-end gap-1" }, 
                                isPromo ? React.createElement('span', { className: "font-bold text-purple-600 text-sm" }, formatCurrency(p.promoPrice)) : React.createElement('span', { className: "font-bold text-slate-800 text-sm" }, formatCurrency(p.salePrice)),
                                React.createElement('span', { className: `text-[10px] font-bold ${p.quantity <= 0 ? 'text-red-500' : 'text-slate-400'}` }, `${p.quantity} un.`)
                            )
                        )
                    })
                ),
                React.createElement(Pagination, { totalItems: sortedProducts.length, itemsPerPage: ITEMS_PER_PAGE, currentPage: productsPage, onPageChange: setProductsPage })
            ),
            
            view === 'customers' && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                React.createElement('div', { className: "flex gap-2 mb-2" }, React.createElement('div', { className: "relative flex-1" }, React.createElement(Search, { className: "absolute left-3 top-3 text-slate-400", size: 18 }), React.createElement('input', { className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none", placeholder: "Buscar cliente ou documento...", value: customerSearch, onChange: e => setCustomerSearch(e.target.value.toUpperCase()) })), React.createElement('button', { onClick: () => setCustomerModalData({open:true, data:null}), className: "bg-yellow-500 text-white p-3 rounded-xl font-bold shadow-lg shadow-yellow-200" }, "+")),
                
                // GRID CLIENTES
                React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
                    paginatedCustomers.map(c => React.createElement('div', { key: c.id, className: "bg-white p-4 rounded-xl border border-slate-100 flex flex-col shadow-sm" }, 
                        React.createElement('div', { className: "flex-1" }, 
                            React.createElement('h3', { className: "font-bold text-slate-800 mb-1" }, c.name), 
                            React.createElement('div', { className: "space-y-1 mt-2 text-sm text-slate-600" }, 
                                c.phone && React.createElement('p', { className: "flex items-center gap-2" }, React.createElement(Phone, { size: 14, className: "text-slate-400"}), c.phone), 
                                c.document && React.createElement('p', { className: "flex items-center gap-2" }, React.createElement(FileText, { size: 14, className: "text-slate-400"}), c.document), 
                                c.cityState && React.createElement('p', { className: "flex items-center gap-2" }, React.createElement(MapPin, { size: 14, className: "text-slate-400"}), c.cityState)
                            )
                        ), 
                        React.createElement('div', { className: "flex gap-2 mt-4 pt-3 border-t border-slate-100" }, React.createElement('button', { onClick: () => setCustomerModalData({open: true, data: c}), className: "flex-1 text-slate-400 hover:text-yellow-600 p-2 flex justify-center items-center rounded-lg hover:bg-slate-50 transition-colors" }, React.createElement(Edit2, { size: 18 })), React.createElement('button', { onClick: () => requestDelete('customer', c.id), className: "flex-1 text-slate-400 hover:text-red-500 p-2 flex justify-center items-center rounded-lg hover:bg-red-50 transition-colors" }, React.createElement(Trash2, { size: 18 })))
                    ))
                ),
                React.createElement(Pagination, { totalItems: sortedCustomers.length, itemsPerPage: ITEMS_PER_PAGE, currentPage: customersPage, onPageChange: setCustomersPage })
            )
        ),
        
        // MODAIS GERAIS
        React.createElement(UserProfileModal, { isOpen: profileModalOpen, onClose: () => setProfileModalOpen(false), userProfile: userProfile, onSave: handleUpdateProfile }),
        React.createElement(CustomerFormModal, { isOpen: customerModalData.open, onClose: () => setCustomerModalData({open:false, data:null}), initialData: customerModalData.data, onSave: handleSaveCustomer }),
        React.createElement(ProductDetailsModal, { isOpen: productViewModalData.open, onClose: () => setProductViewModalData({open:false, data:null}), product: productViewModalData.data }),
        React.createElement(NewSaleModal, { isOpen: isSaleModalOpen, onClose: () => setIsSaleModalOpen(false), customers: customers, products: products, onSave: handleAddSale }),
        React.createElement(EditInstallmentModal, { isOpen: editInstallmentModal.open, onClose: () => setEditInstallmentModal({ open: false, saleId: null, data: null }), installment: editInstallmentModal.data, onSave: saveEditedInstallment }),
        
        // MODAL DE DETALHES COMPLETOS DA VENDA
        React.createElement(SaleDetailsModal, {
            isOpen: !!activeSaleDetails,
            onClose: () => setSelectedSaleDetail(null),
            sale: activeSaleDetails,
            onPay: handleClickPay,
            onEdit: setEditInstallmentModal,
            onDeletePayment: confirmDeletePayment,
            onCancelSale: (saleId) => setCancelModal({ open: true, saleId, reason: '' }), // NOVO
            onDeleteSale: requestDelete,
            onOpenWA: handleOpenWA
        }),

        // MODAL DE LISTA DE PARCELAS
        React.createElement(InstallmentListModal, { 
            isOpen: installmentListModal.open, 
            onClose: () => setInstallmentListModal({ open: false, type: null, data: [] }),
            title: installmentListModal.type === 'overdue' ? 'Parcelas em Atraso' : 'Vencendo em 7 Dias',
            items: installmentListModal.data,
            onPay: handlePayFromList,
            onOpenWA: handleOpenWA
        }),
        
        // MODAL DE CONFIRMAÇÃO DE PAGAMENTO E EXCLUSÃO
        React.createElement(PaymentConfirmationModal, { isOpen: paymentModal.open, onClose: () => setPaymentModal({ open: false, saleId: null, index: null, item: null, isLast: false }), onConfirm: handleConfirmPayment, installment: paymentModal.item, isLast: paymentModal.isLast }),
        React.createElement(ConfirmModal, { isOpen: deletePaymentModal.open, title: "Estornar Pagamento?", message: "O valor será devolvido para a parcela e ela ficará em aberto novamente.", onClose: () => setDeletePaymentModal({ open: false, saleId: null, instIndex: null, histIndex: null, historyItem: null }), onConfirm: handleDeletePayment }),

        // MODAIS DE CONFIRMAÇÃO DE CANCELAMENTO / EXCLUSÃO
        React.createElement(ConfirmModal, { 
            isOpen: cancelModal.open, 
            title: "Cancelar Venda?", 
            message: "Esta ação irá devolver os produtos ao estoque e invalidar os pagamentos.",
            isCancel: true,
            reasonValue: cancelModal.reason,
            onReasonChange: (val) => setCancelModal(prev => ({...prev, reason: val})),
            onClose: () => setCancelModal({ open: false, saleId: null, reason: '' }), 
            onConfirm: confirmCancelSale 
        }),
        React.createElement(ConfirmModal, { isOpen: deleteModal.open, title: "Tem certeza?", message: "O registro será apagado permanentemente.", onClose: () => { setDeleteModal({ open: false, id: null, type: null }); setSelectedSaleDetail(null); }, onConfirm: confirmDelete }),
        
        React.createElement(WhatsAppChooserModal, { isOpen: waChooserModal.open, phone: waChooserModal.phone, message: waChooserModal.message, onClose: () => setWaChooserModal({ open: false, phone: '', message: '' }) })
    );
};

export { Dashboard };
