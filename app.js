import React, { useState, useEffect, useMemo } from 'https://esm.sh/react@18.2.0';
import { createRoot } from 'https://esm.sh/react-dom@18.2.0/client';
import { 
    Users, ShoppingBag, PlusCircle, CheckCircle, MessageCircle, Trash2, 
    ChevronDown, ChevronUp, Package, TrendingUp, Edit2, AlertTriangle, 
    Wallet, Search, CreditCard, QrCode, Banknote, Calendar, Filter, X,
    PieChart, BarChart3, ArrowUpRight, ArrowDownRight, PackageMinus,
    LogOut, Lock, Mail, Phone, Store, UserCog, UserCheck, UserX, Shield,
    ChevronLeft, ChevronRight, MoreHorizontal, LayoutGrid, AlertCircle, RefreshCw,
    Clock, Bell, History, DollarSign
} from 'https://esm.sh/lucide-react@0.292.0';

// --- FIREBASE IMPORTS (Versão 12.9.0 conforme solicitado) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

// --- CONFIGURAÇÃO DO FIREBASE (JÁ PREENCHIDA) ---
const firebaseConfig = {
    apiKey: "AIzaSyDQQcD2tzsVS8Xzy-GpHT897kB7EC-S8Ng",
    authDomain: "vendas-aura.firebaseapp.com",
    projectId: "vendas-aura",
    storageBucket: "vendas-aura.firebasestorage.app",
    messagingSenderId: "767983700810",
    appId: "1:767983700810:web:947c8713bd23fb8a078fb3"
};

// Inicialização
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- COMPONENTES UI ---

const Card = ({ children, className = "" }) => (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>
        {children}
    </div>
);

const Badge = ({ children, color = "blue" }) => {
    const colors = {
        blue: "bg-blue-50 text-blue-700 border-blue-100",
        green: "bg-green-50 text-green-700 border-green-100",
        yellow: "bg-yellow-50 text-yellow-700 border-yellow-100",
        red: "bg-red-50 text-red-700 border-red-100",
        slate: "bg-slate-50 text-slate-600 border-slate-100",
        purple: "bg-purple-50 text-purple-700 border-purple-100"
    };
    return (
        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${colors[color] || colors.slate}`}>
            {children}
        </span>
    );
};

// --- FORMATAÇÃO ---
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('pt-BR').format(date);
    } catch (e) { return dateString; }
};

const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
    } catch (e) { return dateString; }
};

// --- TELAS ---

// 1. TELA DE LOGIN
const AuthScreen = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                const userCred = await createUserWithEmailAndPassword(auth, email, password);
                // Criar perfil inicial
                await setDoc(doc(db, "users", userCred.user.uid), {
                    email: email,
                    role: 'vendedor',
                    createdAt: serverTimestamp(),
                    status: 'pending' // aguardando aprovação
                });
            }
        } catch (err) {
            console.error(err);
            setError(isLogin ? "Falha no login. Verifique suas credenciais." : "Erro ao criar conta. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden p-8">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
                        <ShoppingBag className="text-white w-8 h-8" />
                    </div>
                </div>
                
                <h2 className="text-3xl font-bold text-slate-800 text-center mb-2">
                    {isLogin ? 'Bem-vindo de volta' : 'Criar nova conta'}
                </h2>
                <p className="text-slate-500 text-center mb-8">
                    Gerencie suas vendas Hinode com facilidade
                </p>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 text-sm">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                                placeholder="seu@email.com"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Senha</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input 
                                type="password" 
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                        {loading ? <RefreshCw className="animate-spin" /> : (isLogin ? 'Entrar no Sistema' : 'Criar Conta')}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <button 
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-slate-600 font-medium hover:text-yellow-600 transition-colors"
                    >
                        {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Fazer Login'}
                    </button>
                </div>
            </div>
            <p className="mt-8 text-slate-400 text-sm">© 2024 Hinode Sales System</p>
        </div>
    );
};

// 2. DASHBOARD
const Dashboard = ({ user, userProfile, onLogout }) => {
    const [view, setView] = useState('dashboard');
    const [stats, setStats] = useState({ totalVendas: 0, aReceber: 0, vendasMes: 0 });
    
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'vendas'), where('userId', '==', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let total = 0;
            let receber = 0;
            let mes = 0;
            const currentMonth = new Date().getMonth();

            snapshot.forEach(doc => {
                const data = doc.data();
                total += data.total;
                
                if (data.parcelas) {
                    data.parcelas.forEach(p => {
                        if (p.status !== 'paga') receber += (p.valor || 0);
                    });
                }

                if (data.dataVenda) {
                    const vendaDate = new Date(data.dataVenda);
                    if (vendaDate.getMonth() === currentMonth) {
                        mes += data.total;
                    }
                }
            });

            setStats({ totalVendas: total, aReceber: receber, vendasMes: mes });
        });
        return () => unsubscribe();
    }, [user]);

    const renderContent = () => {
        switch(view) {
            case 'vendas': return <SalesList user={user} onBack={() => setView('dashboard')} />;
            case 'nova-venda': return <NewSale user={user} onFinish={() => setView('vendas')} onBack={() => setView('dashboard')} />;
            case 'clientes': return <div className="p-8 text-center text-slate-500">Módulo de Clientes (Em Breve)</div>;
            case 'perfil': return <div className="p-8 text-center text-slate-500">Meu Perfil (Em Breve)</div>;
            default:
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Visão Geral</h2>
                                <p className="text-slate-500">Olá, {user.email?.split('@')[0]}</p>
                            </div>
                            <button onClick={() => setView('nova-venda')} className="bg-yellow-400 text-slate-900 p-3 rounded-xl shadow-lg hover:bg-yellow-300 transition-all active:scale-95">
                                <PlusCircle size={24} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="p-5 bg-gradient-to-br from-slate-800 to-slate-900 text-white border-none">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-2 bg-white/10 rounded-lg"><Wallet size={20} /></div>
                                    <Badge color="green">+2.5%</Badge>
                                </div>
                                <p className="text-slate-400 text-sm mb-1">Total em Vendas</p>
                                <h3 className="text-2xl font-bold">{formatCurrency(stats.totalVendas)}</h3>
                            </Card>

                            <Card className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-2 bg-yellow-50 text-yellow-600 rounded-lg"><Clock size={20} /></div>
                                    <Badge color="yellow">Pendente</Badge>
                                </div>
                                <p className="text-slate-500 text-sm mb-1">A Receber</p>
                                <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(stats.aReceber)}</h3>
                            </Card>

                            <Card className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Calendar size={20} /></div>
                                    <Badge color="blue">Este Mês</Badge>
                                </div>
                                <p className="text-slate-500 text-sm mb-1">Vendas do Mês</p>
                                <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(stats.vendasMes)}</h3>
                            </Card>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setView('vendas')} className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                                    <ShoppingBag size={24} />
                                </div>
                                <span className="font-semibold text-slate-700">Minhas Vendas</span>
                            </button>
                            <button onClick={() => setView('clientes')} className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                                <div className="p-3 bg-purple-50 text-purple-600 rounded-full">
                                    <Users size={24} />
                                </div>
                                <span className="font-semibold text-slate-700">Clientes</span>
                            </button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
            {/* Top Bar Mobile */}
            <div className="md:hidden bg-white px-6 py-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
                <div className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center">
                        <span className="text-xs font-bold text-slate-900">H</span>
                    </div>
                    Hinode App
                </div>
                <button onClick={onLogout} className="text-slate-400 hover:text-red-500">
                    <LogOut size={20} />
                </button>
            </div>

            <div className="flex">
                {/* Sidebar Desktop */}
                <div className="hidden md:flex flex-col w-64 bg-white h-screen border-r border-slate-200 fixed left-0 top-0 z-20">
                    <div className="p-6 border-b border-slate-100">
                        <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                            <Store className="text-yellow-500" /> Hinode System
                        </h1>
                    </div>
                    <nav className="flex-1 p-4 space-y-2">
                        <SidebarItem icon={LayoutGrid} label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
                        <SidebarItem icon={ShoppingBag} label="Vendas" active={view === 'vendas'} onClick={() => setView('vendas')} />
                        <SidebarItem icon={PlusCircle} label="Nova Venda" active={view === 'nova-venda'} onClick={() => setView('nova-venda')} />
                        <SidebarItem icon={Users} label="Clientes" active={view === 'clientes'} onClick={() => setView('clientes')} />
                    </nav>
                    <div className="p-4 border-t border-slate-100">
                        <button onClick={onLogout} className="flex items-center gap-3 text-slate-500 hover:text-red-600 transition-colors w-full px-4 py-3 rounded-xl hover:bg-red-50">
                            <LogOut size={20} />
                            <span className="font-medium">Sair</span>
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <main className="flex-1 md:ml-64 p-4 md:p-8 max-w-7xl mx-auto w-full">
                    {renderContent()}
                </main>
            </div>

            {/* Mobile Bottom Nav */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-30 pb-safe">
                <NavItem icon={LayoutGrid} active={view === 'dashboard'} onClick={() => setView('dashboard')} />
                <NavItem icon={ShoppingBag} active={view === 'vendas'} onClick={() => setView('vendas')} />
                <div className="relative -top-8">
                    <button onClick={() => setView('nova-venda')} className="w-14 h-14 bg-slate-900 rounded-full flex items-center justify-center text-yellow-400 shadow-lg shadow-slate-900/30 active:scale-90 transition-transform">
                        <PlusCircle size={28} />
                    </button>
                </div>
                <NavItem icon={Users} active={view === 'clientes'} onClick={() => setView('clientes')} />
                <NavItem icon={UserCog} active={view === 'perfil'} onClick={() => setView('perfil')} />
            </div>
        </div>
    );
};

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
        <Icon size={20} className={active ? 'text-yellow-400' : 'text-slate-400'} />
        <span className="font-medium">{label}</span>
    </button>
);

const NavItem = ({ icon: Icon, active, onClick }) => (
    <button onClick={onClick} className={`p-2 rounded-xl transition-colors ${active ? 'text-slate-900 bg-slate-100' : 'text-slate-400'}`}>
        <Icon size={24} strokeWidth={active ? 2.5 : 2} />
    </button>
);

// 3. LISTA DE VENDAS COM PAGAMENTO INTELIGENTE E HISTÓRICO
const SalesList = ({ user, onBack }) => {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedSale, setExpandedSale] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Estados Modal
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedParcelaData, setSelectedParcelaData] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');

    useEffect(() => {
        const q = query(
            collection(db, 'vendas'), 
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    const handleDelete = async (e, saleId) => {
        e.stopPropagation();
        if(confirm("Tem certeza que deseja excluir esta venda?")) {
            await deleteDoc(doc(db, 'vendas', saleId));
        }
    };

    // ABRIR MODAL
    const openPaymentModal = (sale, index) => {
        const parcela = sale.parcelas[index];
        setSelectedParcelaData({
            saleId: sale.id,
            index: index,
            valor: parcela.valor,
            numero: index + 1,
            totalParcelas: sale.parcelas.length,
            sale: sale
        });
        setPaymentAmount('');
        setPaymentModalOpen(true);
    };

    // PROCESSAR PAGAMENTO COM LÓGICA DE TROCO E EXCEDENTE
    const handleProcessPayment = async () => {
        if (!selectedParcelaData) return;

        // Converter input para float
        const amount = parseFloat(paymentAmount.replace(',', '.'));
        const currentVal = selectedParcelaData.valor;
        const sale = selectedParcelaData.sale;
        const pIndex = selectedParcelaData.index;

        if (isNaN(amount) || amount <= 0) {
            alert("Por favor, insira um valor válido.");
            return;
        }

        // TRAVA: Última parcela não pode pagar a mais
        const isLastParcela = pIndex === sale.parcelas.length - 1;
        if (isLastParcela && amount > currentVal) {
            alert("Na última parcela, o valor pago não pode ser maior que o valor restante.");
            return;
        }

        // Clone para manipulação
        let updatedParcelas = JSON.parse(JSON.stringify(sale.parcelas));
        let remainingPayment = amount;
        let currentIndex = pIndex;
        const timestamp = new Date().toISOString();

        // Loop para abater valores (Cascata)
        while (remainingPayment > 0 && currentIndex < updatedParcelas.length) {
            let p = updatedParcelas[currentIndex];

            // Pula se já estiver paga
            if (p.status === 'paga' && p.valor <= 0.01) {
                currentIndex++;
                continue;
            }

            if (!p.historico) p.historico = [];

            if (remainingPayment >= p.valor) {
                // PAGAMENTO TOTAL DA PARCELA
                const valorPagoNesta = p.valor;
                const isOverpayment = remainingPayment > p.valor;
                
                // Define tipo de histórico
                let tipoHistorico = 'Total';
                if (currentIndex === pIndex && isOverpayment) tipoHistorico = 'Total + Excedente';
                else if (currentIndex > pIndex) tipoHistorico = 'Abatimento Automático';

                // Registra
                p.historico.push({
                    data: timestamp,
                    valor: valorPagoNesta,
                    tipo: tipoHistorico,
                    obs: currentIndex > pIndex ? `Sobras da parcela ${pIndex + 1}` : ''
                });

                remainingPayment -= valorPagoNesta; // Sobra continua para a próxima
                p.valor = 0;
                p.status = 'paga';
                p.dataPagamento = timestamp;

            } else {
                // PAGAMENTO PARCIAL (Valor pago < valor da parcela)
                const valorPagoNesta = remainingPayment;
                let tipoHistorico = currentIndex === pIndex ? 'Parcial' : 'Abatimento Parcial';

                p.historico.push({
                    data: timestamp,
                    valor: valorPagoNesta,
                    tipo: tipoHistorico,
                    obs: currentIndex > pIndex ? `Sobras da parcela ${pIndex + 1}` : ''
                });

                p.valor = parseFloat((p.valor - valorPagoNesta).toFixed(2));
                remainingPayment = 0; // Acabou o dinheiro
            }

            // Arredondamento de segurança
            if (p.valor < 0.01) {
                p.valor = 0;
                p.status = 'paga';
            }

            currentIndex++;
        }

        try {
            await updateDoc(doc(db, 'vendas', sale.id), {
                parcelas: updatedParcelas,
                updatedAt: serverTimestamp()
            });
            setPaymentModalOpen(false);
        } catch (error) {
            console.error("Erro ao pagar:", error);
            alert("Erro ao processar pagamento.");
        }
    };

    const filteredSales = sales.filter(s => s.clienteNome?.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="space-y-6 pb-20">
            {/* Modal de Pagamento */}
            {paymentModalOpen && selectedParcelaData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                        <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
                            <h3 className="font-bold flex items-center gap-2">
                                <Banknote className="text-yellow-400" />
                                Confirmar Pagamento
                            </h3>
                            <button onClick={() => setPaymentModalOpen(false)}><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Parcela {selectedParcelaData.numero} de {selectedParcelaData.totalParcelas}</p>
                                <div className="flex justify-between items-end">
                                    <span className="text-slate-600">Restante:</span>
                                    <span className="text-xl font-bold text-slate-800">{formatCurrency(selectedParcelaData.valor)}</span>
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Valor pago</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        autoFocus
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-yellow-400 focus:ring-0 text-lg font-bold text-slate-800"
                                        placeholder="0,00"
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                                    <AlertCircle size={12} className="inline mr-1" />
                                    Valores excedentes serão abatidos automaticamente da próxima parcela.
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setPaymentModalOpen(false)} className="flex-1 py-3 text-slate-600 font-bold bg-slate-100 rounded-xl hover:bg-slate-200">Cancelar</button>
                                <button onClick={handleProcessPayment} className="flex-1 py-3 text-slate-900 font-bold bg-yellow-400 rounded-xl hover:bg-yellow-300 shadow-lg shadow-yellow-400/20">Confirmar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-3">
                <button onClick={onBack} className="md:hidden p-2 hover:bg-white rounded-full"><ChevronLeft /></button>
                <div className="flex-1">
                    <h2 className="text-2xl font-bold text-slate-800">Minhas Vendas</h2>
                    <p className="text-slate-500 text-sm">{filteredSales.length} registros encontrados</p>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                    type="text" 
                    placeholder="Buscar por nome do cliente..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-sm"
                />
            </div>

            {loading ? (
                <div className="text-center py-10 text-slate-400 flex flex-col items-center gap-2">
                    <RefreshCw className="animate-spin" /> Carregando vendas...
                </div>
            ) : filteredSales.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <ShoppingBag size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">Nenhuma venda encontrada</h3>
                    <p className="text-slate-500">Comece registrando sua primeira venda.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredSales.map(sale => {
                        const pendentes = sale.parcelas ? sale.parcelas.filter(p => p.status !== 'paga').length : 0;
                        const isExpanded = expandedSale === sale.id;

                        return (
                            <div key={sale.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-all duration-300">
                                <div 
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                                    onClick={() => setExpandedSale(isExpanded ? null : sale.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${pendentes === 0 ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                                            {sale.clienteNome?.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800">{sale.clienteNome}</h3>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <span>{formatDate(sale.dataVenda)}</span>
                                                <span>•</span>
                                                <span>{sale.items?.length || 0} itens</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="font-bold text-slate-900">{formatCurrency(sale.total)}</span>
                                        {pendentes === 0 ? <Badge color="green">Concluído</Badge> : <Badge color="yellow">{pendentes} pendentes</Badge>}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="border-t border-slate-100 bg-slate-50/50">
                                        <div className="p-4 space-y-4">
                                            <div className="bg-white p-3 rounded-xl border border-slate-100">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Produtos</h4>
                                                <ul className="space-y-2">
                                                    {sale.items?.map((item, idx) => (
                                                        <li key={idx} className="flex justify-between text-sm text-slate-600">
                                                            <span>{item.quantidade}x {item.nome}</span>
                                                            <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <div>
                                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Parcelamento</h4>
                                                <div className="space-y-2">
                                                    {sale.parcelas?.map((parcela, idx) => (
                                                        <InstallmentItem 
                                                            key={idx} 
                                                            parcela={parcela} 
                                                            idx={idx} 
                                                            saleId={sale.id}
                                                            onPay={() => openPaymentModal(sale, idx)} 
                                                        />
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="pt-2 flex justify-end">
                                                <button onClick={(e) => handleDelete(e, sale.id)} className="flex items-center gap-2 text-red-500 hover:text-red-700 text-sm px-3 py-2 hover:bg-red-50 rounded-lg transition-colors">
                                                    <Trash2 size={16} /> Excluir Venda
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// Item de Parcela com Histórico Visual
const InstallmentItem = ({ parcela, idx, onPay }) => {
    const [showHistory, setShowHistory] = useState(false);
    const isPaid = parcela.status === 'paga';
    const hasHistory = parcela.historico && parcela.historico.length > 0;

    return (
        <div className={`bg-white border rounded-xl overflow-hidden ${isPaid ? 'border-green-100' : 'border-slate-200'}`}>
            <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isPaid ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {idx + 1}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm ${isPaid ? 'text-green-700 line-through opacity-70' : 'text-slate-800'}`}>
                                {formatCurrency(parcela.valorOriginal || parcela.valor)} 
                                {!isPaid && parcela.historico?.length > 0 && (
                                    <span className="ml-2 text-slate-900 bg-yellow-100 px-1 rounded text-xs no-line-through">
                                        Restam: {formatCurrency(parcela.valor)}
                                    </span>
                                )}
                            </span>
                        </div>
                        <span className="text-xs text-slate-400">Vence em: {formatDate(parcela.dataVencimento)}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {hasHistory && (
                        <button 
                            onClick={() => setShowHistory(!showHistory)}
                            className={`p-2 rounded-lg transition-colors ${showHistory ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-400 hover:text-blue-500'}`}
                            title="Ver histórico de pagamentos"
                        >
                            <History size={16} />
                        </button>
                    )}

                    {isPaid ? (
                        <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-lg text-xs font-bold">
                            <CheckCircle size={14} /> Paga
                        </div>
                    ) : (
                        <button onClick={onPay} className="bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-slate-700 active:scale-95 transition-all">Pagar</button>
                    )}
                </div>
            </div>

            {showHistory && hasHistory && (
                <div className="bg-slate-50 border-t border-slate-100 p-3 text-xs space-y-2 animate-fade-in">
                    <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Movimentações</p>
                    {parcela.historico.map((mov, i) => (
                        <div key={i} className="flex justify-between items-center border-b border-slate-200 pb-1 last:border-0 last:pb-0">
                            <div className="flex flex-col">
                                <span className="font-medium text-slate-700">{mov.tipo}</span>
                                <span className="text-[10px] text-slate-400">{formatDateTime(mov.data)}</span>
                                {mov.obs && <span className="text-[10px] text-orange-400 italic">{mov.obs}</span>}
                            </div>
                            <span className="font-bold text-slate-700">{formatCurrency(mov.valor)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// 4. NOVA VENDA
const NewSale = ({ user, onFinish, onBack }) => {
    const [step, setStep] = useState(1);
    const [clientName, setClientName] = useState('');
    const [items, setItems] = useState([]);
    const [parcelasCount, setParcelasCount] = useState(1);
    const [newItem, setNewItem] = useState({ nome: '', valor: '', quantidade: 1 });

    const total = items.reduce((acc, item) => acc + item.subtotal, 0);

    const addItem = () => {
        if (!newItem.nome || !newItem.valor) return;
        setItems([...items, { ...newItem, valor: parseFloat(newItem.valor), subtotal: parseFloat(newItem.valor) * newItem.quantidade }]);
        setNewItem({ nome: '', valor: '', quantidade: 1 });
    };

    const handleSave = async () => {
        if (!clientName || items.length === 0) return;

        const valorParcela = total / parcelasCount;
        const parcelas = Array.from({ length: parcelasCount }).map((_, i) => {
            const date = new Date();
            date.setMonth(date.getMonth() + i + 1);
            return {
                numero: i + 1,
                valor: parseFloat(valorParcela.toFixed(2)),
                valorOriginal: parseFloat(valorParcela.toFixed(2)),
                dataVencimento: date.toISOString(),
                status: 'pendente',
                historico: []
            };
        });

        const somaParcelas = parcelas.reduce((a, b) => a + b.valor, 0);
        const diferenca = total - somaParcelas;
        if (diferenca !== 0) {
            parcelas[parcelasCount - 1].valor += diferenca;
            parcelas[parcelasCount - 1].valorOriginal += diferenca;
        }

        try {
            await addDoc(collection(db, 'vendas'), {
                userId: user.uid,
                clienteNome: clientName,
                items,
                total,
                parcelas,
                createdAt: serverTimestamp(),
                dataVenda: new Date().toISOString()
            });
            onFinish();
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar venda");
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden min-h-[500px] flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
                <button onClick={step === 1 ? onBack : () => setStep(1)} className="p-2 hover:bg-white rounded-full transition-colors">
                    <ChevronLeft size={20} />
                </button>
                <h2 className="font-bold text-slate-800">Nova Venda - Passo {step}/2</h2>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
                {step === 1 ? (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Cliente</label>
                            <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:outline-none" placeholder="Nome do Cliente" />
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <Package size={18} /> Adicionar Produtos
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
                                <div className="md:col-span-6"><input placeholder="Nome do Produto" value={newItem.nome} onChange={e => setNewItem({...newItem, nome: e.target.value})} className="w-full p-2 rounded-lg border border-slate-200"/></div>
                                <div className="md:col-span-3"><input type="number" placeholder="Valor R$" value={newItem.valor} onChange={e => setNewItem({...newItem, valor: e.target.value})} className="w-full p-2 rounded-lg border border-slate-200"/></div>
                                <div className="md:col-span-2"><input type="number" placeholder="Qtd" value={newItem.quantidade} onChange={e => setNewItem({...newItem, quantidade: parseInt(e.target.value)})} className="w-full p-2 rounded-lg border border-slate-200"/></div>
                                <div className="md:col-span-1"><button onClick={addItem} className="w-full h-full bg-slate-900 text-white rounded-lg flex items-center justify-center hover:bg-slate-800"><PlusCircle size={20} /></button></div>
                            </div>
                            <div className="space-y-2 mt-4">
                                {items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                        <div className="text-sm"><span className="font-bold text-slate-700">{item.quantidade}x</span> {item.nome}</div>
                                        <div className="font-bold text-slate-800">{formatCurrency(item.subtotal)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        <div className="text-center mb-8">
                            <p className="text-slate-500 text-sm mb-1">Total da Venda</p>
                            <h1 className="text-4xl font-bold text-slate-900">{formatCurrency(total)}</h1>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Número de Parcelas</label>
                            <select value={parcelasCount} onChange={e => setParcelasCount(Number(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:outline-none appearance-none">
                                {[1,2,3,4,5,6,10,12].map(n => <option key={n} value={n}>{n}x de {formatCurrency(total/n)}</option>)}
                            </select>
                        </div>
                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex gap-3 text-yellow-800 text-sm">
                            <AlertTriangle size={20} className="shrink-0" />
                            <p>As datas de vencimento serão geradas automaticamente.</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-slate-100">
                {step === 1 ? (
                    <button onClick={() => setStep(2)} disabled={items.length === 0} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl disabled:opacity-50 hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                        Continuar <ChevronRight size={18} />
                    </button>
                ) : (
                    <button onClick={handleSave} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20">
                        <CheckCircle size={18} /> Finalizar Venda
                    </button>
                )}
            </div>
        </div>
    );
};

// --- APP ROOT COM SEGURANÇA ---
const App = () => {
    const [user, setUser] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [userProfile, setUserProfile] = useState(null);
    const [accessDenied, setAccessDenied] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                try {
                    const docSnap = await getDoc(doc(db, "users", currentUser.uid));
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setUserProfile(data);
                        if (data.status === 'pending') {
                            setAccessDenied(true);
                        } else if (data.status === 'blocked') {
                            alert("Sua conta foi bloqueada.");
                            await signOut(auth);
                        }
                    }
                } catch (e) {
                    console.error("Erro ao buscar perfil", e);
                }
            } else {
                setUser(null);
                setUserProfile(null);
            }
            setLoadingAuth(false);
        });
        return () => unsubscribe();
    }, []);

    if (loadingAuth) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 gap-2"><RefreshCw className="animate-spin" /> Carregando Sistema...</div>;
    
    if (accessDenied) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center">
            <Lock size={48} className="text-red-500 mb-4" />
            <h1 className="text-2xl font-bold text-red-800 mb-2">Acesso Negado</h1>
            <p className="text-red-600 mb-6">Seu cadastro ainda está pendente de aprovação pelo administrador.</p>
            <button onClick={async () => { await signOut(auth); setAccessDenied(false); }} className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg">Sair e Tentar Novamente</button>
        </div>
    );

    if (!user) return <AuthScreen />;

    return <Dashboard user={user} userProfile={userProfile} onLogout={() => signOut(auth)} />;
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
