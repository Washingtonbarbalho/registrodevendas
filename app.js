import React, { useState, useEffect, useMemo } from 'https://esm.sh/react@18.2.0';
import { createRoot } from 'https://esm.sh/react-dom@18.2.0/client';
import { 
    Users, ShoppingBag, PlusCircle, CheckCircle, MessageCircle, Trash2, 
    ChevronDown, ChevronUp, Package, TrendingUp, Edit2, AlertTriangle, 
    Wallet, Search, CreditCard, QrCode, Banknote, Calendar, Filter, X,
    PieChart, BarChart3, ArrowUpRight, ArrowDownRight, PackageMinus,
    LogOut, Lock, Mail, Phone, Store, UserCog, UserCheck, UserX, Shield,
    ChevronLeft, ChevronRight, MoreHorizontal, LayoutGrid, AlertCircle, RefreshCw,
    Clock, Bell, History, ArrowRight
} from 'https://esm.sh/lucide-react@0.292.0';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// CONFIGURAÇÃO FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyDQQcD2tzsVS8Xzy-GpHT897kB7EC-S8Ng",
    authDomain: "vendas-aura.firebaseapp.com",
    projectId: "vendas-aura",
    storageBucket: "vendas-aura.firebasestorage.app",
    messagingSenderId: "767983700810",
    appId: "1:767983700810:web:947c8713bd23fb8a078fb3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const APP_ID = 'vendas-aura-main';
const ADMIN_EMAIL = "washington.wn8@gmail.com";

// Inicialização segura do Firebase
let app, db, auth;
try {
    // Tenta usar configuração global injetada se existir, senão usa o objeto acima (placeholder)
    const configToUse = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;
    app = initializeApp(configToUse);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (e) {
    console.error("Erro ao inicializar Firebase:", e);
}

// --- UTILITÁRIOS ---
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    // Se for timestamp do firestore
    if (dateString.seconds) return new Date(dateString.seconds * 1000).toLocaleDateString('pt-BR');
    // Se for string ISO
    return new Date(dateString).toLocaleDateString('pt-BR');
};

const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = dateString.seconds ? new Date(dateString.seconds * 1000) : new Date(dateString);
    return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
};

// --- COMPONENTES ---

// 1. TELA DE AUTENTICAÇÃO (Login/Registro)
const AuthScreen = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                // Criar perfil do usuário
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    name: name,
                    email: email,
                    role: 'pending', // pending, user, admin
                    createdAt: serverTimestamp()
                });
            }
        } catch (err) {
            console.error(err);
            let msg = "Erro na autenticação.";
            if (err.code === 'auth/invalid-credential') msg = "E-mail ou senha incorretos.";
            if (err.code === 'auth/email-already-in-use') msg = "E-mail já cadastrado.";
            if (err.code === 'auth/weak-password') msg = "Senha muito fraca.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return React.createElement('div', { className: "min-h-screen flex items-center justify-center bg-slate-900 p-4" },
        React.createElement('div', { className: "bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden" },
            React.createElement('div', { className: "bg-yellow-500 p-6 text-center" },
                React.createElement('h1', { className: "text-2xl font-bold text-white mb-1" }, "Sistema Hinode"),
                React.createElement('p', { className: "text-yellow-100 text-sm" }, "Controle de Vendas e Estoque")
            ),
            React.createElement('div', { className: "p-8" },
                React.createElement('h2', { className: "text-xl font-bold text-slate-800 mb-6 text-center" }, 
                    isLogin ? "Bem-vindo de volta" : "Criar nova conta"
                ),
                error && React.createElement('div', { className: "bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm flex items-center gap-2" },
                    React.createElement(AlertCircle, { size: 16 }), error
                ),
                React.createElement('form', { onSubmit: handleAuth, className: "space-y-4" },
                    !isLogin && React.createElement('div', {},
                        React.createElement('label', { className: "block text-sm font-medium text-slate-600 mb-1" }, "Nome Completo"),
                        React.createElement('input', { 
                            type: "text", 
                            required: true,
                            className: "w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition",
                            value: name,
                            onChange: (e) => setName(e.target.value)
                        })
                    ),
                    React.createElement('div', {},
                        React.createElement('label', { className: "block text-sm font-medium text-slate-600 mb-1" }, "E-mail"),
                        React.createElement('input', { 
                            type: "email", 
                            required: true,
                            className: "w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition",
                            value: email,
                            onChange: (e) => setEmail(e.target.value)
                        })
                    ),
                    React.createElement('div', {},
                        React.createElement('label', { className: "block text-sm font-medium text-slate-600 mb-1" }, "Senha"),
                        React.createElement('input', { 
                            type: "password", 
                            required: true,
                            className: "w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition",
                            value: password,
                            onChange: (e) => setPassword(e.target.value)
                        })
                    ),
                    React.createElement('button', { 
                        type: "submit", 
                        disabled: loading,
                        className: "w-full bg-slate-900 text-white p-4 rounded-xl font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2" 
                    }, loading ? React.createElement(RefreshCw, { className: "animate-spin" }) : (isLogin ? "Entrar" : "Cadastrar"))
                ),
                React.createElement('div', { className: "mt-6 text-center" },
                    React.createElement('button', { 
                        onClick: () => setIsLogin(!isLogin),
                        className: "text-yellow-600 font-medium hover:text-yellow-700 text-sm"
                    }, isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre")
                )
            )
        )
    );
};

// 2. DASHBOARD PRINCIPAL
const Dashboard = ({ user, userProfile, onLogout }) => {
    const [view, setView] = useState('home'); // home, sales, products, clients, admin
    const [sales, setSales] = useState([]);
    const [products, setProducts] = useState([]);
    const [clients, setClients] = useState([]);
    
    // Listeners do Firebase
    useEffect(() => {
        if (!user) return;

        const salesUnsub = onSnapshot(collection(db, "sales"), (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Ordenar por data (decrescente)
            data.sort((a, b) => {
                const dateA = a.date?.seconds || 0;
                const dateB = b.date?.seconds || 0;
                return dateB - dateA;
            });
            setSales(data);
        });

        const productsUnsub = onSnapshot(collection(db, "products"), (snap) => {
            setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const clientsUnsub = onSnapshot(collection(db, "clients"), (snap) => {
            setClients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => { salesUnsub(); productsUnsub(); clientsUnsub(); };
    }, [user]);

    // Menu de navegação inferior (Mobile)
    const BottomNav = () => {
        const navItems = [
            { id: 'home', icon: LayoutGrid, label: 'Início' },
            { id: 'sales', icon: ShoppingBag, label: 'Vendas' },
            { id: 'products', icon: Package, label: 'Produtos' },
            { id: 'clients', icon: Users, label: 'Clientes' },
        ];

        // Se for admin, adiciona menu admin
        if (userProfile?.role === 'admin') {
            navItems.push({ id: 'admin', icon: Shield, label: 'Admin' });
        }

        return React.createElement('div', { className: "fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 flex justify-between items-center z-50 safe-area-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]" },
            navItems.map(item => 
                React.createElement('button', { 
                    key: item.id,
                    onClick: () => setView(item.id),
                    className: `flex flex-col items-center justify-center p-2 rounded-xl w-full transition duration-300 ${view === item.id ? 'text-yellow-600 bg-yellow-50' : 'text-slate-400 hover:text-slate-600'}`
                },
                    React.createElement(item.icon, { size: 24, strokeWidth: view === item.id ? 2.5 : 2 }),
                    React.createElement('span', { className: "text-[10px] font-medium mt-1" }, item.label)
                )
            )
        );
    };

    return React.createElement('div', { className: "min-h-screen bg-slate-50 pb-24" },
        // Header
        React.createElement('header', { className: "bg-slate-900 text-white pt-12 pb-6 px-6 rounded-b-[2rem] shadow-lg sticky top-0 z-40" },
            React.createElement('div', { className: "flex justify-between items-center mb-6" },
                React.createElement('div', { className: "flex items-center gap-3" },
                    React.createElement('div', { className: "w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center text-slate-900 font-bold text-lg" },
                        userProfile?.name?.charAt(0) || 'U'
                    ),
                    React.createElement('div', {},
                        React.createElement('h1', { className: "font-bold text-lg leading-tight" }, userProfile?.name),
                        React.createElement('span', { className: "text-slate-400 text-xs flex items-center gap-1" }, 
                            userProfile?.role === 'admin' ? React.createElement(Shield, { size: 10 }) : null,
                            userProfile?.role === 'admin' ? 'Administrador' : 'Consultor'
                        )
                    )
                ),
                React.createElement('button', { onClick: onLogout, className: "p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition" },
                    React.createElement(LogOut, { size: 18 })
                )
            ),
            // Resumo Rápido no Header (Só na Home)
            view === 'home' && React.createElement(HomeSummary, { sales: sales })
        ),

        // Conteúdo Principal
        React.createElement('main', { className: "p-4 animate-fade-in" },
            view === 'home' && React.createElement(HomeView, { sales, products, clients, setView }),
            view === 'sales' && React.createElement(SalesModule, { sales, products, clients }),
            view === 'products' && React.createElement(ProductsModule, { products }),
            view === 'clients' && React.createElement(ClientsModule, { clients, sales }),
            view === 'admin' && React.createElement(AdminModule, { userProfile })
        ),

        React.createElement(BottomNav, {})
    );
};

// --- SUB-COMPONENTES E MÓDULOS ---

const HomeSummary = ({ sales }) => {
    // Calcular total vendido hoje
    const today = new Date().toDateString();
    const salesToday = sales.filter(s => new Date(s.date?.seconds * 1000).toDateString() === today);
    const totalToday = salesToday.reduce((acc, s) => acc + s.total, 0);

    // Calcular pendências (vendas a prazo com parcelas pendentes)
    const pendingSales = sales.filter(s => 
        s.paymentType === 'credit' && s.installments.some(i => i.status === 'pending')
    );
    const totalPending = pendingSales.reduce((acc, s) => {
        return acc + s.installments.filter(i => i.status === 'pending').reduce((sub, i) => {
             // Considera valor restante (valor - pago)
             const paid = i.amountPaid || 0;
             return sub + (i.value - paid);
        }, 0);
    }, 0);

    return React.createElement('div', { className: "grid grid-cols-2 gap-4" },
        React.createElement('div', { className: "bg-slate-800 p-4 rounded-2xl" },
            React.createElement('p', { className: "text-slate-400 text-xs mb-1" }, "Vendas Hoje"),
            React.createElement('h3', { className: "text-2xl font-bold text-yellow-400" }, formatCurrency(totalToday))
        ),
        React.createElement('div', { className: "bg-slate-800 p-4 rounded-2xl" },
            React.createElement('p', { className: "text-slate-400 text-xs mb-1" }, "A Receber"),
            React.createElement('h3', { className: "text-xl font-bold text-white" }, formatCurrency(totalPending))
        )
    );
};

const HomeView = ({ sales, products, clients, setView }) => {
    return React.createElement('div', { className: "space-y-6" },
        // Ações Rápidas
        React.createElement('div', {},
            React.createElement('h2', { className: "font-bold text-slate-800 mb-4 px-2" }, "Acesso Rápido"),
            React.createElement('div', { className: "grid grid-cols-2 gap-3" },
                React.createElement('button', { onClick: () => setView('sales'), className: "bg-white p-4 rounded-2xl shadow-sm flex flex-col items-center gap-2 hover:bg-slate-50 transition border border-slate-100" },
                    React.createElement('div', { className: "w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center" }, React.createElement(PlusCircle, { size: 20 })),
                    React.createElement('span', { className: "font-medium text-sm text-slate-700" }, "Nova Venda")
                ),
                React.createElement('button', { onClick: () => setView('products'), className: "bg-white p-4 rounded-2xl shadow-sm flex flex-col items-center gap-2 hover:bg-slate-50 transition border border-slate-100" },
                    React.createElement('div', { className: "w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center" }, React.createElement(Package, { size: 20 })),
                    React.createElement('span', { className: "font-medium text-sm text-slate-700" }, "Estoque")
                )
            )
        ),

        // Últimas Vendas
        React.createElement('div', {},
            React.createElement('div', { className: "flex justify-between items-center px-2 mb-4" },
                React.createElement('h2', { className: "font-bold text-slate-800" }, "Últimas Vendas"),
                React.createElement('button', { onClick: () => setView('sales'), className: "text-yellow-600 text-sm font-medium" }, "Ver tudo")
            ),
            React.createElement('div', { className: "space-y-3" },
                sales.slice(0, 5).map(sale => 
                    React.createElement('div', { key: sale.id, className: "bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center" },
                        React.createElement('div', { className: "flex items-center gap-3" },
                            React.createElement('div', { className: "w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500" },
                                React.createElement(ShoppingBag, { size: 18 })
                            ),
                            React.createElement('div', {},
                                React.createElement('p', { className: "font-bold text-slate-800 text-sm" }, sale.clientName),
                                React.createElement('p', { className: "text-xs text-slate-500" }, formatDate(sale.date))
                            )
                        ),
                        React.createElement('div', { className: "text-right" },
                            React.createElement('p', { className: "font-bold text-slate-800" }, formatCurrency(sale.total)),
                            React.createElement('span', { className: `text-[10px] px-2 py-0.5 rounded-full ${sale.paymentType === 'cash' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}` },
                                sale.paymentType === 'cash' ? 'À Vista' : 'A Prazo'
                            )
                        )
                    )
                )
            )
        )
    );
};

// --- MÓDULO DE VENDAS ---
const SalesModule = ({ sales, products, clients }) => {
    const [viewState, setViewState] = useState('list'); // list, create, details
    const [selectedSale, setSelectedSale] = useState(null);
    const [cart, setCart] = useState([]);
    const [selectedClient, setSelectedClient] = useState('');
    const [paymentType, setPaymentType] = useState('cash'); // cash, credit
    const [installmentCount, setInstallmentCount] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Novo Estado para Modal de Pagamento
    const [paymentModal, setPaymentModal] = useState({ 
        open: false, 
        saleId: null, 
        installmentIndex: null, 
        currentInstallmentValue: 0,
        alreadyPaid: 0,
        isLast: false,
        maxPayable: 0
    });
    const [paymentValueInput, setPaymentValueInput] = useState('');

    const addToCart = (product) => {
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
        } else {
            setCart([...cart, { ...product, quantity: 1 }]);
        }
    };

    const removeFromCart = (productId) => {
        setCart(cart.filter(item => item.id !== productId));
    };

    const updateQuantity = (productId, delta) => {
        setCart(cart.map(item => {
            if (item.id === productId) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    const handleCreateSale = async () => {
        if (!selectedClient || cart.length === 0) {
            alert("Selecione um cliente e adicione produtos.");
            return;
        }

        const clientData = clients.find(c => c.id === selectedClient);
        
        // Gerar parcelas se for a prazo
        let installmentsData = [];
        if (paymentType === 'credit') {
            const valPerInst = cartTotal / installmentCount;
            const now = new Date();
            for (let i = 0; i < installmentCount; i++) {
                const dueDate = new Date(now);
                dueDate.setMonth(now.getMonth() + i + 1); // +1 mês para cada parcela
                installmentsData.push({
                    number: i + 1,
                    value: valPerInst,
                    dueDate: dueDate.toISOString(),
                    status: 'pending', // pending, paid
                    amountPaid: 0, // NOVO: Valor pago até agora
                    history: [] // NOVO: Histórico de pagamentos
                });
            }
        }

        const newSale = {
            clientId: selectedClient,
            clientName: clientData?.name || "Cliente Desconhecido",
            items: cart,
            total: cartTotal,
            date: serverTimestamp(),
            paymentType,
            installments: installmentsData,
            status: 'completed'
        };

        try {
            await addDoc(collection(db, "sales"), newSale);
            // Atualizar estoque (opcional, mas recomendado)
            // Resetar form
            setCart([]);
            setSelectedClient('');
            setPaymentType('cash');
            setViewState('list');
        } catch (e) {
            console.error("Erro ao criar venda:", e);
            alert("Erro ao registrar venda.");
        }
    };

    // --- LÓGICA DE PAGAMENTO DE PARCELA (Alterada) ---
    const openPaymentModal = (sale, index) => {
        const inst = sale.installments[index];
        // Calcular quanto falta pagar
        const paidSoFar = inst.amountPaid || 0;
        const remaining = inst.value - paidSoFar;
        const isLast = index === sale.installments.length - 1;

        // Calcular máximo permitido para pagamento nesta transação
        // Se for a última, só pode pagar o restante.
        // Se não for, teoricamente pode pagar infinito (vai para as próximas), 
        // mas vamos limitar ao total restante da dívida da venda para evitar problemas.
        // Simplificação: Se for última, limita ao remaining.
        
        setPaymentModal({
            open: true,
            saleId: sale.id,
            installmentIndex: index,
            currentInstallmentValue: inst.value,
            alreadyPaid: paidSoFar,
            remaining: remaining,
            isLast: isLast
        });
        setPaymentValueInput(remaining.toFixed(2)); // Sugere o valor restante
    };

    const confirmPayment = async () => {
        const val = parseFloat(paymentValueInput);
        
        if (isNaN(val) || val <= 0) {
            alert("Insira um valor válido.");
            return;
        }

        // Validação da última parcela
        if (paymentModal.isLast && val > (paymentModal.remaining + 0.01)) { // +0.01 para evitar erro de float
            alert(`Para a última parcela, o valor máximo permitido é ${formatCurrency(paymentModal.remaining)}.`);
            return;
        }

        try {
            const saleRef = doc(db, "sales", selectedSale.id);
            // Trabalhar com cópia profunda para não mutar estado diretamente
            const newInstallments = JSON.parse(JSON.stringify(selectedSale.installments));
            
            let amountToDistribute = val;
            let currentIndex = paymentModal.installmentIndex;

            // Loop para distribuir o valor
            while (amountToDistribute > 0.009 && currentIndex < newInstallments.length) {
                const inst = newInstallments[currentIndex];
                
                // Normalizar dados antigos que não tenham amountPaid
                if (typeof inst.amountPaid === 'undefined') {
                    inst.amountPaid = inst.status === 'paid' ? inst.value : 0;
                }
                if (!inst.history) inst.history = [];

                const remainingInThisInst = inst.value - inst.amountPaid;

                if (remainingInThisInst <= 0.009) {
                    // Já está paga, pula pra próxima se tiver dinheiro sobrando
                    currentIndex++;
                    continue;
                }

                let paymentForThis = 0;
                let note = "";

                if (amountToDistribute >= remainingInThisInst) {
                    // Paga essa parcela totalmente
                    paymentForThis = remainingInThisInst;
                    inst.status = 'paid';
                    note = currentIndex === paymentModal.installmentIndex ? "Pagamento Total (+ Excedente)" : "Abatimento Automático (Excedente Anterior)";
                    if (amountToDistribute === remainingInThisInst) note = "Pagamento Quitativo";
                } else {
                    // Paga parcialmente
                    paymentForThis = amountToDistribute;
                    inst.status = 'pending'; // Continua pendente
                    note = "Pagamento Parcial";
                }

                // Aplicar valores
                inst.amountPaid += paymentForThis;
                amountToDistribute -= paymentForThis;

                // Registrar histórico
                inst.history.push({
                    date: new Date().toISOString(),
                    value: paymentForThis,
                    note: note,
                    type: 'payment'
                });

                // Arredondamento de segurança
                inst.amountPaid = Math.round(inst.amountPaid * 100) / 100;
                if (inst.amountPaid >= inst.value - 0.01) inst.status = 'paid';

                currentIndex++;
            }

            // Atualizar no Firebase
            await updateDoc(saleRef, { installments: newInstallments });
            
            // Atualizar estado local para refletir na UI imediatamente
            setSelectedSale({ ...selectedSale, installments: newInstallments });
            setPaymentModal({ ...paymentModal, open: false });

        } catch (e) {
            console.error("Erro ao processar pagamento:", e);
            alert("Erro ao salvar pagamento.");
        }
    };

    // Modal de input de valor
    const PaymentInputModal = () => {
        if (!paymentModal.open) return null;
        return React.createElement('div', { className: "fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" },
            React.createElement('div', { className: "bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-fade-in" },
                React.createElement('div', { className: "flex justify-between items-center mb-4" },
                    React.createElement('h3', { className: "font-bold text-lg" }, "Confirmar Pagamento"),
                    React.createElement('button', { onClick: () => setPaymentModal({...paymentModal, open: false}), className: "p-2 bg-slate-100 rounded-full" }, React.createElement(X, { size: 18 }))
                ),
                React.createElement('div', { className: "mb-4 bg-yellow-50 p-4 rounded-xl border border-yellow-100" },
                    React.createElement('p', { className: "text-sm text-yellow-800 mb-1" }, `Parcela ${paymentModal.installmentIndex + 1}`),
                    React.createElement('div', { className: "flex justify-between text-sm" },
                        React.createElement('span', {}, "Valor da Parcela:"),
                        React.createElement('span', { className: "font-bold" }, formatCurrency(paymentModal.currentInstallmentValue))
                    ),
                    React.createElement('div', { className: "flex justify-between text-sm" },
                        React.createElement('span', {}, "Já Pago:"),
                        React.createElement('span', { className: "font-bold" }, formatCurrency(paymentModal.alreadyPaid))
                    ),
                    React.createElement('div', { className: "flex justify-between text-sm mt-2 pt-2 border-t border-yellow-200" },
                        React.createElement('span', { className: "font-bold text-yellow-900" }, "Restante:"),
                        React.createElement('span', { className: "font-bold text-yellow-900" }, formatCurrency(paymentModal.remaining))
                    )
                ),
                React.createElement('div', { className: "mb-6" },
                    React.createElement('label', { className: "block text-sm font-medium text-slate-700 mb-2" }, "Valor a Pagar (R$)"),
                    React.createElement('input', {
                        type: "number",
                        step: "0.01",
                        className: "w-full p-4 text-2xl font-bold text-center border-2 border-slate-200 rounded-xl focus:border-yellow-500 focus:ring-0 outline-none",
                        value: paymentValueInput,
                        onChange: (e) => setPaymentValueInput(e.target.value),
                        autoFocus: true
                    }),
                    !paymentModal.isLast && React.createElement('p', { className: "text-xs text-slate-500 mt-2 text-center" }, 
                        "Valores acima do restante serão abatidos da próxima parcela."
                    )
                ),
                React.createElement('button', {
                    onClick: confirmPayment,
                    className: "w-full bg-green-600 text-white py-4 rounded-xl font-bold hover:bg-green-700 transition flex items-center justify-center gap-2"
                }, React.createElement(CheckCircle, { size: 20 }), "Confirmar Pagamento")
            )
        );
    };

    // Renderização Principal do Módulo
    if (viewState === 'create') {
        return React.createElement('div', { className: "space-y-6" },
            React.createElement('div', { className: "flex items-center gap-2 mb-4" },
                React.createElement('button', { onClick: () => setViewState('list'), className: "p-2 bg-white rounded-full shadow-sm" }, React.createElement(ChevronLeft, { size: 20 })),
                React.createElement('h2', { className: "text-xl font-bold" }, "Nova Venda")
            ),
            
            // Seleção de Cliente
            React.createElement('div', { className: "bg-white p-4 rounded-xl shadow-sm space-y-3" },
                React.createElement('label', { className: "font-bold text-slate-700 block" }, "Cliente"),
                React.createElement('select', { 
                    value: selectedClient, 
                    onChange: (e) => setSelectedClient(e.target.value),
                    className: "w-full p-3 bg-slate-50 rounded-lg border border-slate-200 outline-none"
                },
                    React.createElement('option', { value: "" }, "Selecione um cliente..."),
                    clients.map(c => React.createElement('option', { key: c.id, value: c.id }, c.name))
                )
            ),

            // Seleção de Produtos
            React.createElement('div', { className: "bg-white p-4 rounded-xl shadow-sm space-y-4" },
                React.createElement('h3', { className: "font-bold text-slate-700" }, "Produtos"),
                React.createElement('div', { className: "flex gap-2 overflow-x-auto pb-2 no-scrollbar" },
                    products.map(prod => 
                        React.createElement('button', { 
                            key: prod.id,
                            onClick: () => addToCart(prod),
                            className: "flex-shrink-0 bg-slate-50 p-3 rounded-lg border border-slate-200 w-32 flex flex-col items-center gap-2 hover:border-yellow-500 transition"
                        },
                            React.createElement('div', { className: "w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm" }, React.createElement(Package, { size: 18 })),
                            React.createElement('span', { className: "text-xs font-medium text-center line-clamp-2 h-8" }, prod.name),
                            React.createElement('span', { className: "text-xs font-bold text-green-600" }, formatCurrency(prod.price))
                        )
                    )
                ),
                // Carrinho
                cart.length > 0 && React.createElement('div', { className: "mt-4 space-y-2 border-t border-slate-100 pt-4" },
                    cart.map(item => 
                        React.createElement('div', { key: item.id, className: "flex justify-between items-center" },
                            React.createElement('div', {},
                                React.createElement('p', { className: "text-sm font-medium" }, item.name),
                                React.createElement('p', { className: "text-xs text-slate-500" }, formatCurrency(item.price))
                            ),
                            React.createElement('div', { className: "flex items-center gap-3 bg-slate-50 rounded-lg p-1" },
                                React.createElement('button', { onClick: () => updateQuantity(item.id, -1), className: "w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-slate-600" }, "-"),
                                React.createElement('span', { className: "text-sm font-bold w-4 text-center" }, item.quantity),
                                React.createElement('button', { onClick: () => updateQuantity(item.id, 1), className: "w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-slate-600" }, "+"),
                                React.createElement('button', { onClick: () => removeFromCart(item.id), className: "text-red-400 ml-2" }, React.createElement(X, { size: 16 }))
                            )
                        )
                    )
                )
            ),

            // Pagamento
            React.createElement('div', { className: "bg-white p-4 rounded-xl shadow-sm space-y-4" },
                React.createElement('h3', { className: "font-bold text-slate-700" }, "Pagamento"),
                React.createElement('div', { className: "grid grid-cols-2 gap-3" },
                    React.createElement('button', { 
                        onClick: () => setPaymentType('cash'),
                        className: `p-3 rounded-lg border font-medium text-sm transition ${paymentType === 'cash' ? 'bg-yellow-50 border-yellow-500 text-yellow-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`
                    }, "À Vista"),
                    React.createElement('button', { 
                        onClick: () => setPaymentType('credit'),
                        className: `p-3 rounded-lg border font-medium text-sm transition ${paymentType === 'credit' ? 'bg-yellow-50 border-yellow-500 text-yellow-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`
                    }, "A Prazo")
                ),
                paymentType === 'credit' && React.createElement('div', { className: "bg-slate-50 p-3 rounded-lg" },
                    React.createElement('label', { className: "text-xs font-bold text-slate-500 uppercase mb-2 block" }, "Número de Parcelas"),
                    React.createElement('div', { className: "flex items-center justify-between" },
                        React.createElement('button', { onClick: () => setInstallmentCount(Math.max(1, installmentCount - 1)), className: "w-8 h-8 bg-white rounded shadow-sm flex items-center justify-center font-bold" }, "-"),
                        React.createElement('span', { className: "font-bold text-lg" }, installmentCount),
                        React.createElement('button', { onClick: () => setInstallmentCount(installmentCount + 1), className: "w-8 h-8 bg-white rounded shadow-sm flex items-center justify-center font-bold" }, "+")
                    ),
                    React.createElement('p', { className: "text-center text-xs text-slate-500 mt-2" }, 
                        `${installmentCount}x de ${formatCurrency(cartTotal / installmentCount)}`
                    )
                )
            ),

            // Total e Botão Final
            React.createElement('div', { className: "sticky bottom-20 bg-slate-900 text-white p-4 rounded-xl shadow-lg flex justify-between items-center" },
                React.createElement('div', {},
                    React.createElement('p', { className: "text-slate-400 text-xs" }, "Total"),
                    React.createElement('p', { className: "text-xl font-bold" }, formatCurrency(cartTotal))
                ),
                React.createElement('button', { 
                    onClick: handleCreateSale,
                    className: "bg-yellow-500 text-slate-900 px-6 py-2 rounded-lg font-bold hover:bg-yellow-400 transition"
                }, "Finalizar")
            )
        );
    }

    if (viewState === 'details' && selectedSale) {
        // Componente de Detalhe da Venda com o novo design de parcelas
        return React.createElement('div', { className: "space-y-6 pb-20" },
            React.createElement(PaymentInputModal), // Modal de pagamento
            React.createElement('div', { className: "flex items-center gap-2" },
                React.createElement('button', { onClick: () => setViewState('list'), className: "p-2 bg-white rounded-full shadow-sm" }, React.createElement(ChevronLeft, { size: 20 })),
                React.createElement('h2', { className: "text-xl font-bold" }, "Detalhes da Venda")
            ),

            // Card Principal
            React.createElement('div', { className: "bg-white p-6 rounded-2xl shadow-sm relative overflow-hidden" },
                React.createElement('div', { className: "absolute top-0 right-0 p-4 opacity-10" },
                    React.createElement(ShoppingBag, { size: 100 })
                ),
                React.createElement('h3', { className: "text-2xl font-bold text-slate-800 mb-1" }, selectedSale.clientName),
                React.createElement('p', { className: "text-slate-500 text-sm mb-4" }, formatDateTime(selectedSale.date)),
                
                React.createElement('div', { className: "flex gap-4 mb-6" },
                    React.createElement('div', {},
                        React.createElement('p', { className: "text-xs text-slate-500 uppercase font-bold" }, "Total"),
                        React.createElement('p', { className: "text-xl font-bold text-slate-900" }, formatCurrency(selectedSale.total))
                    ),
                    React.createElement('div', {},
                        React.createElement('p', { className: "text-xs text-slate-500 uppercase font-bold" }, "Tipo"),
                        React.createElement('span', { className: `inline-block px-2 py-1 rounded text-xs font-bold ${selectedSale.paymentType === 'cash' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}` }, 
                            selectedSale.paymentType === 'cash' ? 'À Vista' : 'A Prazo'
                        )
                    )
                ),

                // Lista de Produtos
                React.createElement('div', { className: "border-t border-slate-100 pt-4" },
                    React.createElement('p', { className: "font-bold text-sm text-slate-700 mb-2" }, "Itens"),
                    selectedSale.items.map((item, idx) => 
                        React.createElement('div', { key: idx, className: "flex justify-between text-sm py-1 border-b border-slate-50 last:border-0" },
                            React.createElement('span', { className: "text-slate-600" }, `${item.quantity}x ${item.name}`),
                            React.createElement('span', { className: "font-medium" }, formatCurrency(item.price * item.quantity))
                        )
                    )
                )
            ),

            // Parcelas (Se houver)
            selectedSale.installments && selectedSale.installments.length > 0 && React.createElement('div', {},
                React.createElement('h3', { className: "font-bold text-lg mb-3 px-2" }, "Parcelas"),
                React.createElement('div', { className: "space-y-3" },
                    selectedSale.installments.map((inst, idx) => {
                        const [showHistory, setShowHistory] = useState(false);
                        const paidAmount = inst.amountPaid || (inst.status === 'paid' ? inst.value : 0);
                        const remaining = inst.value - paidAmount;
                        const isPaid = remaining <= 0.01;
                        const isPartial = paidAmount > 0 && !isPaid;

                        return React.createElement('div', { key: idx, className: `bg-white rounded-xl shadow-sm border-l-4 overflow-hidden transition-all ${isPaid ? 'border-green-500' : isPartial ? 'border-yellow-500' : 'border-slate-300'}` },
                            React.createElement('div', { className: "p-4 flex justify-between items-center" },
                                React.createElement('div', { className: "flex-1" },
                                    React.createElement('div', { className: "flex items-center gap-2 mb-1" },
                                        React.createElement('span', { className: "font-bold text-slate-800" }, `${idx + 1}ª Parcela`),
                                        isPaid 
                                            ? React.createElement('span', { className: "bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold" }, "PAGO")
                                            : isPartial 
                                                ? React.createElement('span', { className: "bg-yellow-100 text-yellow-700 text-[10px] px-2 py-0.5 rounded-full font-bold" }, "PARCIAL")
                                                : React.createElement('span', { className: "bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold" }, "PENDENTE")
                                    ),
                                    React.createElement('div', { className: "flex items-baseline gap-2" },
                                        React.createElement('p', { className: "text-sm text-slate-500" }, 
                                            `Venc: ${new Date(inst.dueDate).toLocaleDateString('pt-BR')}`
                                        ),
                                        isPartial && React.createElement('p', { className: "text-xs font-bold text-yellow-600" }, `Restam: ${formatCurrency(remaining)}`)
                                    ),
                                    React.createElement('div', { className: "mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden" },
                                        React.createElement('div', { 
                                            className: `h-full ${isPaid ? 'bg-green-500' : 'bg-yellow-500'}`, 
                                            style: { width: `${Math.min(100, (paidAmount / inst.value) * 100)}%` } 
                                        })
                                    ),
                                    React.createElement('p', { className: "text-[10px] text-slate-400 mt-1" }, `${formatCurrency(paidAmount)} de ${formatCurrency(inst.value)}`)
                                ),
                                
                                React.createElement('div', { className: "flex items-center gap-2 ml-3" },
                                    // Botão Histórico
                                    React.createElement('button', {
                                        onClick: () => setShowHistory(!showHistory),
                                        className: `p-2 rounded-lg transition ${showHistory ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`
                                    }, React.createElement(Clock, { size: 18 })),
                                    
                                    // Botão Pagar
                                    !isPaid && React.createElement('button', { 
                                        onClick: () => openPaymentModal(selectedSale, idx),
                                        className: "p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition border border-green-200"
                                    }, React.createElement(Banknote, { size: 20 }))
                                )
                            ),
                            
                            // Área de Histórico (Expansível)
                            showHistory && React.createElement('div', { className: "bg-slate-50 border-t border-slate-100 p-3 animate-fade-in" },
                                React.createElement('p', { className: "text-xs font-bold text-slate-500 mb-2 flex items-center gap-1" }, 
                                    React.createElement(History, { size: 12 }), "Histórico de Movimentações"
                                ),
                                (!inst.history || inst.history.length === 0) 
                                ? React.createElement('p', { className: "text-xs text-slate-400 italic" }, "Nenhuma movimentação registrada.")
                                : React.createElement('div', { className: "space-y-2" },
                                    inst.history.map((hist, hIdx) => 
                                        React.createElement('div', { key: hIdx, className: "flex justify-between items-center text-xs bg-white p-2 rounded border border-slate-100" },
                                            React.createElement('div', {},
                                                React.createElement('span', { className: "block font-medium text-slate-700" }, hist.note || "Pagamento"),
                                                React.createElement('span', { className: "text-slate-400" }, formatDateTime(hist.date))
                                            ),
                                            React.createElement('span', { className: "font-bold text-green-600" }, `+ ${formatCurrency(hist.value)}`)
                                        )
                                    )
                                )
                            )
                        );
                    })
                )
            ),
            
            // Botão Excluir Venda (Admin)
            React.createElement('div', { className: "pt-4" },
                React.createElement('button', {
                    onClick: async () => {
                        if (confirm("Tem certeza que deseja excluir esta venda?")) {
                            await deleteDoc(doc(db, "sales", selectedSale.id));
                            setViewState('list');
                            setSelectedSale(null);
                        }
                    },
                    className: "w-full py-3 text-red-500 font-medium text-sm hover:bg-red-50 rounded-xl transition"
                }, "Excluir Venda")
            )
        );
    }

    // Lista de Vendas (Default)
    return React.createElement('div', { className: "space-y-4" },
        React.createElement('div', { className: "flex justify-between items-center" },
            React.createElement('h2', { className: "text-2xl font-bold text-slate-800" }, "Vendas"),
            React.createElement('button', { 
                onClick: () => setViewState('create'),
                className: "bg-slate-900 text-white p-3 rounded-xl shadow-lg hover:scale-105 transition"
            }, React.createElement(PlusCircle, { size: 24 }))
        ),

        // Barra de Pesquisa
        React.createElement('div', { className: "relative" },
            React.createElement(Search, { className: "absolute left-3 top-3.5 text-slate-400", size: 20 }),
            React.createElement('input', {
                type: "text",
                placeholder: "Buscar cliente...",
                className: "w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-yellow-500",
                value: searchTerm,
                onChange: (e) => setSearchTerm(e.target.value)
            })
        ),

        // Listagem
        React.createElement('div', { className: "space-y-3 pb-20" },
            sales.filter(s => s.clientName.toLowerCase().includes(searchTerm.toLowerCase())).map(sale => 
                React.createElement('div', { 
                    key: sale.id, 
                    onClick: () => { setSelectedSale(sale); setViewState('details'); },
                    className: "bg-white p-4 rounded-xl shadow-sm border border-slate-100 active:scale-98 transition cursor-pointer" 
                },
                    React.createElement('div', { className: "flex justify-between items-start mb-2" },
                        React.createElement('div', {},
                            React.createElement('h3', { className: "font-bold text-slate-800" }, sale.clientName),
                            React.createElement('p', { className: "text-xs text-slate-500" }, formatDate(sale.date))
                        ),
                        React.createElement('span', { className: `text-[10px] px-2 py-1 rounded-full font-bold ${sale.paymentType === 'cash' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}` },
                            sale.paymentType === 'cash' ? 'À VISTA' : 'A PRAZO'
                        )
                    ),
                    React.createElement('div', { className: "flex justify-between items-end" },
                        React.createElement('p', { className: "text-xs text-slate-500" }, `${sale.items.length} itens`),
                        React.createElement('p', { className: "font-bold text-lg text-slate-800" }, formatCurrency(sale.total))
                    ),
                    // Indicador de Progresso se for a prazo
                    sale.paymentType === 'credit' && React.createElement('div', { className: "mt-3 flex gap-1" },
                        sale.installments.map((i, idx) => {
                            // Cálculo visual de progresso na mini barra
                            const pPaid = i.amountPaid || (i.status === 'paid' ? i.value : 0);
                            const pPct = (pPaid / i.value);
                            return React.createElement('div', { 
                                key: idx, 
                                className: `h-1.5 flex-1 rounded-full ${pPct >= 0.99 ? 'bg-green-500' : pPct > 0 ? 'bg-yellow-500' : 'bg-slate-200'}` 
                            });
                        })
                    )
                )
            )
        )
    );
};

// --- MÓDULO DE PRODUTOS ---
const ProductsModule = ({ products }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentProduct, setCurrentProduct] = useState({});

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (currentProduct.id) {
                await updateDoc(doc(db, "products", currentProduct.id), currentProduct);
            } else {
                await addDoc(collection(db, "products"), { ...currentProduct, createdAt: serverTimestamp() });
            }
            setIsEditing(false);
            setCurrentProduct({});
        } catch (e) {
            alert("Erro ao salvar produto.");
        }
    };

    const handleDelete = async (id) => {
        if (confirm("Excluir produto?")) {
            await deleteDoc(doc(db, "products", id));
        }
    };

    if (isEditing) {
        return React.createElement('div', { className: "p-4 bg-white rounded-2xl shadow-sm" },
            React.createElement('h2', { className: "font-bold text-xl mb-4" }, currentProduct.id ? "Editar Produto" : "Novo Produto"),
            React.createElement('form', { onSubmit: handleSave, className: "space-y-4" },
                React.createElement('input', { 
                    placeholder: "Nome do Produto", 
                    className: "w-full p-3 border rounded-xl",
                    value: currentProduct.name || '',
                    onChange: e => setCurrentProduct({ ...currentProduct, name: e.target.value }),
                    required: true
                }),
                React.createElement('input', { 
                    placeholder: "Preço (R$)", 
                    type: "number",
                    step: "0.01",
                    className: "w-full p-3 border rounded-xl",
                    value: currentProduct.price || '',
                    onChange: e => setCurrentProduct({ ...currentProduct, price: parseFloat(e.target.value) }),
                    required: true
                }),
                React.createElement('div', { className: "flex gap-2 pt-2" },
                    React.createElement('button', { type: "button", onClick: () => setIsEditing(false), className: "flex-1 py-3 bg-slate-100 rounded-xl font-medium" }, "Cancelar"),
                    React.createElement('button', { type: "submit", className: "flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold" }, "Salvar")
                )
            )
        );
    }

    return React.createElement('div', { className: "space-y-4" },
        React.createElement('div', { className: "flex justify-between items-center" },
            React.createElement('h2', { className: "text-2xl font-bold text-slate-800" }, "Estoque"),
            React.createElement('button', { onClick: () => { setCurrentProduct({}); setIsEditing(true); }, className: "bg-slate-900 text-white p-3 rounded-xl shadow-lg" }, React.createElement(PlusCircle, { size: 24 }))
        ),
        React.createElement('div', { className: "grid grid-cols-1 gap-3 pb-20" },
            products.map(prod => 
                React.createElement('div', { key: prod.id, className: "bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center" },
                    React.createElement('div', { className: "flex items-center gap-3" },
                        React.createElement('div', { className: "w-10 h-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center" },
                            React.createElement(Package, { size: 20 })
                        ),
                        React.createElement('div', {},
                            React.createElement('h3', { className: "font-bold text-slate-700" }, prod.name),
                            React.createElement('p', { className: "text-emerald-600 font-bold" }, formatCurrency(prod.price))
                        )
                    ),
                    React.createElement('div', { className: "flex gap-2" },
                        React.createElement('button', { onClick: () => { setCurrentProduct(prod); setIsEditing(true); }, className: "p-2 bg-slate-50 text-slate-600 rounded-lg" }, React.createElement(Edit2, { size: 16 })),
                        React.createElement('button', { onClick: () => handleDelete(prod.id), className: "p-2 bg-red-50 text-red-500 rounded-lg" }, React.createElement(Trash2, { size: 16 }))
                    )
                )
            )
        )
    );
};

// --- MÓDULO DE CLIENTES ---
const ClientsModule = ({ clients, sales }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentClient, setCurrentClient] = useState({});

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (currentClient.id) {
                await updateDoc(doc(db, "clients", currentClient.id), currentClient);
            } else {
                await addDoc(collection(db, "clients"), { ...currentClient, createdAt: serverTimestamp() });
            }
            setIsEditing(false);
            setCurrentClient({});
        } catch (e) {
            alert("Erro ao salvar cliente.");
        }
    };

    // Calcular dívida total do cliente
    const getClientDebt = (clientId) => {
        const clientSales = sales.filter(s => s.clientId === clientId && s.paymentType === 'credit');
        return clientSales.reduce((total, s) => {
            const pending = s.installments.reduce((acc, i) => {
                 const paid = i.amountPaid || (i.status === 'paid' ? i.value : 0);
                 return acc + (i.value - paid);
            }, 0);
            return total + pending;
        }, 0);
    };

    if (isEditing) {
        return React.createElement('div', { className: "p-4 bg-white rounded-2xl shadow-sm" },
            React.createElement('h2', { className: "font-bold text-xl mb-4" }, currentClient.id ? "Editar Cliente" : "Novo Cliente"),
            React.createElement('form', { onSubmit: handleSave, className: "space-y-4" },
                React.createElement('input', { 
                    placeholder: "Nome Completo", 
                    className: "w-full p-3 border rounded-xl",
                    value: currentClient.name || '',
                    onChange: e => setCurrentClient({ ...currentClient, name: e.target.value }),
                    required: true
                }),
                React.createElement('input', { 
                    placeholder: "Telefone / WhatsApp", 
                    className: "w-full p-3 border rounded-xl",
                    value: currentClient.phone || '',
                    onChange: e => setCurrentClient({ ...currentClient, phone: e.target.value })
                }),
                React.createElement('div', { className: "flex gap-2 pt-2" },
                    React.createElement('button', { type: "button", onClick: () => setIsEditing(false), className: "flex-1 py-3 bg-slate-100 rounded-xl font-medium" }, "Cancelar"),
                    React.createElement('button', { type: "submit", className: "flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold" }, "Salvar")
                )
            )
        );
    }

    return React.createElement('div', { className: "space-y-4" },
        React.createElement('div', { className: "flex justify-between items-center" },
            React.createElement('h2', { className: "text-2xl font-bold text-slate-800" }, "Clientes"),
            React.createElement('button', { onClick: () => { setCurrentClient({}); setIsEditing(true); }, className: "bg-slate-900 text-white p-3 rounded-xl shadow-lg" }, React.createElement(PlusCircle, { size: 24 }))
        ),
        React.createElement('div', { className: "grid grid-cols-1 gap-3 pb-20" },
            clients.map(client => {
                const debt = getClientDebt(client.id);
                return React.createElement('div', { key: client.id, className: "bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center" },
                    React.createElement('div', { className: "flex items-center gap-3" },
                        React.createElement('div', { className: "w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold" },
                            client.name.charAt(0)
                        ),
                        React.createElement('div', {},
                            React.createElement('h3', { className: "font-bold text-slate-700" }, client.name),
                            React.createElement('p', { className: "text-xs text-slate-500" }, client.phone || "Sem telefone"),
                            debt > 0.01 && React.createElement('p', { className: "text-xs text-red-500 font-bold mt-1" }, `Débito: ${formatCurrency(debt)}`)
                        )
                    ),
                    React.createElement('button', { onClick: () => { setCurrentClient(client); setIsEditing(true); }, className: "p-2 bg-slate-50 text-slate-600 rounded-lg" }, React.createElement(Edit2, { size: 16 }))
                );
            })
        )
    );
};

// --- MÓDULO ADMIN (APROVAÇÃO DE USUÁRIOS) ---
const AdminModule = ({ userProfile }) => {
    const [users, setUsers] = useState([]);

    useEffect(() => {
        if (userProfile?.role !== 'admin') return;
        const q = query(collection(db, "users"));
        const unsub = onSnapshot(q, (snap) => {
            setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsub();
    }, [userProfile]);

    const toggleRole = async (userId, currentRole) => {
        const newRole = currentRole === 'pending' ? 'user' : 'pending';
        await updateDoc(doc(db, "users", userId), { role: newRole });
    };

    if (userProfile?.role !== 'admin') return React.createElement('div', { className: "p-8 text-center text-red-500" }, "Acesso restrito.");

    return React.createElement('div', { className: "space-y-4" },
        React.createElement('h2', { className: "text-2xl font-bold text-slate-800" }, "Administração"),
        React.createElement('div', { className: "space-y-3" },
            users.map(u => 
                React.createElement('div', { key: u.id, className: "bg-white p-4 rounded-xl shadow-sm flex justify-between items-center" },
                    React.createElement('div', {},
                        React.createElement('p', { className: "font-bold" }, u.name),
                        React.createElement('p', { className: "text-xs text-slate-500" }, u.email),
                        React.createElement('span', { className: `text-[10px] px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : u.role === 'user' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}` }, 
                            u.role.toUpperCase()
                        )
                    ),
                    u.role !== 'admin' && React.createElement('button', { 
                        onClick: () => toggleRole(u.id, u.role),
                        className: `p-2 rounded-lg ${u.role === 'pending' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`
                    }, u.role === 'pending' ? React.createElement(UserCheck, { size: 20 }) : React.createElement(UserX, { size: 20 }))
                )
            )
        )
    );
};

// --- APP PRINCIPAL ---
const App = () => {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                // Verificar Perfil
                try {
                    const docSnap = await getDoc(doc(db, "users", currentUser.uid));
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        if (data.role === 'pending') {
                            setAccessDenied(true);
                            await signOut(auth);
                        } else {
                            setUser(currentUser);
                            setUserProfile(data);
                            setAccessDenied(false);
                        }
                    } else {
                        // Perfil não encontrado, logout por segurança
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
};

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));
