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

// --- FIREBASE IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// CONFIGURAÇÃO FIREBASE (Mantenha sua configuração aqui)
const firebaseConfig = {
    apiKey: "AIzaSyDQQcD2tzsVS8Xzy-GpHT897kB7EC-S8Ng",
    authDomain: "vendas-aura.firebaseapp.com",
    projectId: "vendas-aura",
    storageBucket: "vendas-aura.firebasestorage.app",
    messagingSenderId: "767983700810",
    appId: "1:767983700810:web:947c8713bd23fb8a078fb3"
};
// Inicialização segura
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- COMPONENTES AUXILIARES ---

// Componente de Modal Genérico
const Modal = ({ children, onClose, title }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-900 p-4 flex justify-between items-center">
                <h3 className="text-white font-bold text-lg">{title}</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                    <X size={24} />
                </button>
            </div>
            <div className="p-6">
                {children}
            </div>
        </div>
    </div>
);

// Formatação de Moeda
const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

// Formatação de Data
const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    } catch (e) {
        return dateString;
    }
};

// Formatação de Data e Hora
const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return `${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
    } catch (e) {
        return dateString;
    }
};

// --- TELA DE LOGIN ---
const AuthScreen = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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
                await createUserWithEmailAndPassword(auth, email, password);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">
                <div className="p-8 text-center bg-slate-800">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-500 mb-4">
                        <Store size={32} className="text-slate-900" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Sistema de Vendas</h1>
                    <p className="text-slate-400 text-sm mt-1">Controle total do seu negócio</p>
                </div>
                <div className="p-8">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 flex items-center gap-2">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}
                    <form onSubmit={handleAuth} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input 
                                    type="email" 
                                    required
                                    className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none"
                                    placeholder="seu@email.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input 
                                    type="password" 
                                    required
                                    className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>
                        </div>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold py-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <RefreshCw className="animate-spin" /> : (isLogin ? 'Entrar' : 'Cadastrar')}
                        </button>
                    </form>
                    <div className="mt-6 text-center">
                        <button 
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-sm text-slate-600 hover:text-yellow-600 font-medium"
                        >
                            {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE DE DETALHES DA VENDA (COM NOVA LÓGICA DE PAGAMENTO) ---
const SaleDetails = ({ sale, onClose, onUpdate }) => {
    const [pagamentoModal, setPagamentoModal] = useState({ open: false, index: null, max: 0 });
    const [valorPagamento, setValorPagamento] = useState('');
    const [historicoModal, setHistoricoModal] = useState({ open: false, index: null });

    const parcelas = sale.parcelas || [];
    const cliente = sale.cliente || {};

    const handleOpenPagamento = (index, parcela) => {
        const valorPagoAteAgora = parcela.valorPago || 0;
        const valorRestante = parcela.valor - valorPagoAteAgora;
        
        setPagamentoModal({
            open: true,
            index,
            max: valorRestante
        });
        setValorPagamento(''); // Reset input
    };

    const confirmPayment = async (e) => {
        e.preventDefault();
        const valorInformado = parseFloat(valorPagamento.replace(',', '.'));
        
        if (!valorInformado || valorInformado <= 0) {
            alert("Informe um valor válido.");
            return;
        }

        const novasParcelas = [...parcelas];
        const index = pagamentoModal.index;
        const parcelaAtual = novasParcelas[index];
        const valorRestante = parcelaAtual.valor - (parcelaAtual.valorPago || 0);

        // Validação: Última parcela não pode pagar a mais
        if (index === novasParcelas.length - 1 && valorInformado > valorRestante) {
            alert(`Para a última parcela, o valor máximo permitido é ${formatCurrency(valorRestante)}`);
            return;
        }

        // 1. Registrar Histórico na Parcela Atual
        const registroHistorico = {
            data: new Date().toISOString(),
            valor: valorInformado,
            usuario: auth.currentUser.email,
            tipo: 'pagamento_direto'
        };
        
        parcelaAtual.historico = [...(parcelaAtual.historico || []), registroHistorico];

        // 2. Lógica de Abatimento
        if (valorInformado < valorRestante) {
            // Cenário: Pagamento Parcial
            parcelaAtual.valorPago = (parcelaAtual.valorPago || 0) + valorInformado;
            parcelaAtual.status = 'parcial';
        } else {
            // Cenário: Pagamento Total ou Excedente
            const excedente = valorInformado - valorRestante;
            
            // Quita a parcela atual
            parcelaAtual.valorPago = parcelaAtual.valor;
            parcelaAtual.status = 'paga';
            parcelaAtual.dataPagamento = new Date().toISOString();

            // Se houver excedente e não for a última parcela
            if (excedente > 0 && index < novasParcelas.length - 1) {
                const proximaParcela = novasParcelas[index + 1];
                
                // Reduz o valor original da próxima parcela (conforme solicitado)
                // Nota: Alternativamente poderíamos marcar como pago parcial, mas o pedido foi "diminuído da parcela seguinte"
                proximaParcela.valor = proximaParcela.valor - excedente;
                
                // Registra o abatimento no histórico da próxima parcela para rastreabilidade
                proximaParcela.historico = [...(proximaParcela.historico || []), {
                    data: new Date().toISOString(),
                    valor: excedente,
                    usuario: 'Sistema (Cascata)',
                    tipo: 'abatimento_anterior',
                    obs: `Crédito vindo da parcela ${index + 1}`
                }];

                // Se o abatimento zerar ou negativar a próxima (caso raro, mas possível)
                if (proximaParcela.valor <= 0) {
                    proximaParcela.valor = 0;
                    proximaParcela.valorPago = 0;
                    proximaParcela.status = 'paga';
                    proximaParcela.dataPagamento = new Date().toISOString();
                    // Se sobrou ainda mais, deveria ir para a próxima da próxima, mas vamos limitar a 1 nível por simplicidade da regra
                }
            }
        }

        try {
            const saleRef = doc(db, 'vendas', sale.id);
            await updateDoc(saleRef, { parcelas: novasParcelas });
            setPagamentoModal({ open: false, index: null, max: 0 });
            onUpdate(); // Atualiza a tela
        } catch (err) {
            console.error(err);
            alert("Erro ao processar pagamento.");
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-100 z-40 overflow-y-auto animate-fade-in">
            <div className="sticky top-0 bg-white shadow-sm border-b px-4 py-3 flex items-center justify-between z-10">
                <button onClick={onClose} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full">
                    <ChevronLeft size={24} />
                </button>
                <h2 className="font-bold text-lg text-slate-800">Detalhes da Venda</h2>
                <div className="w-10"></div>
            </div>

            <div className="p-4 max-w-3xl mx-auto space-y-6">
                {/* Info Cliente */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                            {cliente.nome ? cliente.nome.charAt(0) : '?'}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">{cliente.nome}</h3>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Phone size={12} /> {cliente.telefone || 'Sem telefone'}
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm mt-4 pt-4 border-t">
                        <div>
                            <p className="text-slate-500">Data da Venda</p>
                            <p className="font-medium">{formatDate(sale.dataVenda)}</p>
                        </div>
                        <div>
                            <p className="text-slate-500">Valor Total</p>
                            <p className="font-bold text-emerald-600">{formatCurrency(sale.total)}</p>
                        </div>
                    </div>
                </div>

                {/* Produtos */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <ShoppingBag size={18} /> Produtos
                    </h3>
                    <div className="space-y-3">
                        {sale.produtos && sale.produtos.map((prod, idx) => (
                            <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0 border-slate-100">
                                <div className="flex items-center gap-3">
                                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded">
                                        {prod.quantidade}x
                                    </span>
                                    <span className="text-slate-700">{prod.nome}</span>
                                </div>
                                <span className="font-medium text-slate-900">
                                    {formatCurrency(prod.preco * prod.quantidade)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Parcelas */}
                <div className="space-y-3 pb-20">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 px-1">
                        <Calendar size={18} /> Parcelas
                    </h3>
                    {parcelas.map((parcela, index) => {
                        const valorRestante = parcela.valor - (parcela.valorPago || 0);
                        const isPaga = parcela.status === 'paga';
                        const isParcial = parcela.status === 'parcial';
                        
                        return (
                            <div key={index} className={`relative overflow-hidden bg-white p-4 rounded-xl shadow-sm border-l-4 transition-all ${
                                isPaga ? 'border-l-emerald-500 bg-emerald-50/50' : 
                                isParcial ? 'border-l-yellow-500' : 
                                'border-l-slate-300'
                            }`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                            Parcela {index + 1}/{parcelas.length}
                                        </span>
                                        <p className="text-sm font-medium text-slate-700 mt-1">
                                            Vencimento: {formatDate(parcela.vencimento)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-lg text-slate-800">
                                            {formatCurrency(parcela.valor)}
                                        </p>
                                        {isParcial && (
                                            <p className="text-xs text-yellow-600 font-medium">
                                                Restante: {formatCurrency(valorRestante)}
                                            </p>
                                        )}
                                        {isPaga && (
                                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-bold bg-emerald-100 px-2 py-0.5 rounded-full mt-1">
                                                <CheckCircle size={12} /> Paga
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Barra de Progresso Parcial */}
                                {isParcial && (
                                    <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3 mt-1">
                                        <div 
                                            className="bg-yellow-500 h-1.5 rounded-full" 
                                            style={{ width: `${(parcela.valorPago / parcela.valor) * 100}%` }}
                                        ></div>
                                    </div>
                                )}

                                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                                    {!isPaga && (
                                        <button 
                                            onClick={() => handleOpenPagamento(index, parcela)}
                                            className="flex-1 bg-slate-900 text-white text-sm font-medium py-2 rounded-lg hover:bg-slate-800 transition flex items-center justify-center gap-2"
                                        >
                                            <Wallet size={16} /> Pagar
                                        </button>
                                    )}
                                    
                                    <button 
                                        onClick={() => setHistoricoModal({ open: true, index })}
                                        className={`flex-1 text-sm font-medium py-2 rounded-lg border transition flex items-center justify-center gap-2 ${
                                            (parcela.historico && parcela.historico.length > 0)
                                                ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                : 'bg-slate-50 text-slate-500 border-slate-100'
                                        }`}
                                    >
                                        <History size={16} /> Histórico
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* MODAL DE PAGAMENTO */}
            {pagamentoModal.open && (
                <Modal 
                    title="Confirmar Pagamento" 
                    onClose={() => setPagamentoModal({ open: false, index: null })}
                >
                    <form onSubmit={confirmPayment}>
                        <div className="mb-4">
                            <p className="text-sm text-slate-600 mb-2">
                                Valor Restante desta parcela: <strong className="text-slate-900">{formatCurrency(pagamentoModal.max)}</strong>
                            </p>
                            <label className="block text-sm font-bold text-slate-700 mb-1">
                                Qual valor foi pago?
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-slate-500 font-bold">R$</span>
                                <input 
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    required
                                    autoFocus
                                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl text-lg font-bold text-slate-800 focus:ring-2 focus:ring-yellow-500 outline-none"
                                    placeholder="0,00"
                                    value={valorPagamento}
                                    onChange={e => setValorPagamento(e.target.value)}
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-2 bg-yellow-50 p-2 rounded border border-yellow-100">
                                <AlertCircle size={12} className="inline mr-1"/>
                                Se o valor for maior que o restante, a diferença será descontada da próxima parcela.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                type="button"
                                onClick={() => setPagamentoModal({ open: false, index: null })}
                                className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-100 rounded-xl"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit"
                                className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200"
                            >
                                Confirmar
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* MODAL DE HISTÓRICO */}
            {historicoModal.open && (
                <Modal 
                    title={`Histórico - Parcela ${historicoModal.index + 1}`} 
                    onClose={() => setHistoricoModal({ open: false, index: null })}
                >
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                        {(!parcelas[historicoModal.index].historico || parcelas[historicoModal.index].historico.length === 0) ? (
                            <p className="text-center text-slate-500 py-4">Nenhum movimento registrado.</p>
                        ) : (
                            parcelas[historicoModal.index].historico.slice().reverse().map((mov, i) => (
                                <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <div className={`mt-1 p-1.5 rounded-full ${mov.tipo === 'abatimento_anterior' ? 'bg-purple-100 text-purple-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                        {mov.tipo === 'abatimento_anterior' ? <ArrowDownRight size={14} /> : <DollarSign size={14} />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">{formatCurrency(mov.valor)}</p>
                                        <p className="text-xs text-slate-500">{formatDateTime(mov.data)}</p>
                                        {mov.obs && <p className="text-xs text-purple-600 font-medium mt-1">{mov.obs}</p>}
                                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{mov.usuario}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

// --- COMPONENTE DE NOVA VENDA ---
const NewSale = ({ onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [cliente, setCliente] = useState({ nome: '', telefone: '' });
    const [produtos, setProdutos] = useState([]);
    const [novoProd, setNovoProd] = useState({ nome: '', preco: '', quantidade: 1 });
    const [numParcelas, setNumParcelas] = useState(1);
    const [loading, setLoading] = useState(false);

    const totalVenda = useMemo(() => {
        return produtos.reduce((acc, curr) => acc + (curr.preco * curr.quantidade), 0);
    }, [produtos]);

    const handleAddProd = () => {
        if (!novoProd.nome || !novoProd.preco) return;
        setProdutos([...produtos, { ...novoProd, preco: parseFloat(novoProd.preco) }]);
        setNovoProd({ nome: '', preco: '', quantidade: 1 });
    };

    const handleSave = async () => {
        if (!cliente.nome || produtos.length === 0) return;
        setLoading(true);

        // Gerar parcelas
        const valorParcela = totalVenda / numParcelas;
        const parcelasGeradas = Array.from({ length: numParcelas }).map((_, i) => {
            const dataVencimento = new Date();
            dataVencimento.setMonth(dataVencimento.getMonth() + i + 1);
            return {
                numero: i + 1,
                valor: valorParcela,
                vencimento: dataVencimento.toISOString(),
                status: 'pendente',
                valorPago: 0,
                historico: [] // Inicializa array de histórico vazio
            };
        });

        try {
            await addDoc(collection(db, 'vendas'), {
                cliente,
                produtos,
                total: totalVenda,
                parcelas: parcelasGeradas,
                dataVenda: new Date().toISOString(),
                criadoPor: auth.currentUser.uid,
                status: 'ativa'
            });
            onSuccess();
        } catch (e) {
            alert("Erro ao salvar venda");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-white z-20 overflow-y-auto animate-fade-in">
             <div className="sticky top-0 bg-white shadow-sm border-b px-4 py-3 flex items-center justify-between z-10">
                <button onClick={onClose} className="text-slate-500">Cancelar</button>
                <h2 className="font-bold text-lg">Nova Venda</h2>
                {step === 3 ? (
                    <button onClick={handleSave} disabled={loading} className="text-emerald-600 font-bold">
                        {loading ? '...' : 'Salvar'}
                    </button>
                ) : (
                    <button onClick={() => setStep(s => s + 1)} className="text-yellow-600 font-bold">
                        Próximo
                    </button>
                )}
            </div>
            
            <div className="p-6 max-w-lg mx-auto">
                {step === 1 && (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Dados do Cliente</h3>
                        <div>
                            <label className="block text-sm font-medium mb-1">Nome do Cliente</label>
                            <input 
                                className="w-full border p-3 rounded-xl bg-slate-50"
                                value={cliente.nome}
                                onChange={e => setCliente({...cliente, nome: e.target.value})}
                                placeholder="Ex: Maria Silva"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Telefone</label>
                            <input 
                                className="w-full border p-3 rounded-xl bg-slate-50"
                                value={cliente.telefone}
                                type="tel"
                                onChange={e => setCliente({...cliente, telefone: e.target.value})}
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Produtos</h3>
                        <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                            <input 
                                className="w-full border p-2 rounded-lg"
                                placeholder="Nome do Produto"
                                value={novoProd.nome}
                                onChange={e => setNovoProd({...novoProd, nome: e.target.value})}
                            />
                            <div className="flex gap-2">
                                <input 
                                    className="w-1/2 border p-2 rounded-lg"
                                    placeholder="Preço"
                                    type="number"
                                    value={novoProd.preco}
                                    onChange={e => setNovoProd({...novoProd, preco: e.target.value})}
                                />
                                <input 
                                    className="w-1/2 border p-2 rounded-lg"
                                    placeholder="Qtd"
                                    type="number"
                                    value={novoProd.quantidade}
                                    onChange={e => setNovoProd({...novoProd, quantidade: parseInt(e.target.value)})}
                                />
                            </div>
                            <button onClick={handleAddProd} className="w-full bg-slate-800 text-white py-2 rounded-lg font-medium">
                                Adicionar Produto
                            </button>
                        </div>
                        
                        <div className="space-y-2 mt-4">
                            {produtos.map((p, i) => (
                                <div key={i} className="flex justify-between bg-white border p-3 rounded-lg shadow-sm">
                                    <span>{p.quantidade}x {p.nome}</span>
                                    <span className="font-bold">{formatCurrency(p.preco * p.quantidade)}</span>
                                </div>
                            ))}
                        </div>
                        
                        <div className="mt-4 p-4 bg-yellow-50 rounded-xl border border-yellow-200 flex justify-between items-center">
                            <span className="font-bold text-yellow-800">Total</span>
                            <span className="font-bold text-2xl text-yellow-900">{formatCurrency(totalVenda)}</span>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Pagamento</h3>
                        <div>
                            <label className="block text-sm font-medium mb-1">Quantidade de Parcelas</label>
                            <select 
                                className="w-full border p-3 rounded-xl bg-white text-lg font-medium"
                                value={numParcelas}
                                onChange={e => setNumParcelas(parseInt(e.target.value))}
                            >
                                {[1,2,3,4,5,6,10,12].map(n => (
                                    <option key={n} value={n}>{n}x de {formatCurrency(totalVenda/n)}</option>
                                ))}
                            </select>
                        </div>

                        <div className="mt-8 space-y-2">
                            <h4 className="font-medium text-slate-500 text-sm uppercase">Resumo</h4>
                            <div className="bg-white border rounded-xl p-4 space-y-2">
                                <div className="flex justify-between">
                                    <span>Cliente</span>
                                    <span className="font-medium">{cliente.nome}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Total</span>
                                    <span className="font-bold text-emerald-600">{formatCurrency(totalVenda)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Forma</span>
                                    <span>{numParcelas}x (Mensal)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- DASHBOARD PRINCIPAL ---
const Dashboard = ({ user, onLogout }) => {
    const [vendas, setVendas] = useState([]);
    const [view, setView] = useState('list'); // list, new, details
    const [selectedSale, setSelectedSale] = useState(null);
    const [filtro, setFiltro] = useState('');

    useEffect(() => {
        const q = query(collection(db, 'vendas'), orderBy('dataVenda', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const vendasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setVendas(vendasData);
        });
        return () => unsubscribe();
    }, []);

    const resumo = useMemo(() => {
        let totalRecebido = 0;
        let totalPendente = 0;
        let vendasMes = 0;
        
        vendas.forEach(v => {
            // Conta vendas do mês atual
            if(new Date(v.dataVenda).getMonth() === new Date().getMonth()) vendasMes++;

            if (v.parcelas) {
                v.parcelas.forEach(p => {
                    const pago = p.valorPago || 0;
                    const valor = p.valor || 0;
                    
                    if (p.status === 'paga') {
                        totalRecebido += valor; // Se tá paga, consideramos o valor total da parcela
                    } else if (p.status === 'parcial') {
                        totalRecebido += pago;
                        totalPendente += (valor - pago);
                    } else {
                        totalPendente += valor;
                    }
                });
            }
        });
        return { totalRecebido, totalPendente, vendasMes };
    }, [vendas]);

    const vendasFiltradas = vendas.filter(v => 
        v.cliente.nome.toLowerCase().includes(filtro.toLowerCase())
    );

    return (
        <div className="pb-20 min-h-screen">
            {/* Header */}
            <div className="bg-slate-900 text-white p-6 rounded-b-3xl shadow-lg relative z-10">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Store className="text-yellow-500" /> Controle Vendas
                        </h1>
                        <p className="text-slate-400 text-xs">Bem-vindo, {user.email}</p>
                    </div>
                    <button onClick={onLogout} className="bg-slate-800 p-2 rounded-full hover:bg-slate-700 transition">
                        <LogOut size={18} />
                    </button>
                </div>

                {/* Cards Resumo */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <p className="text-slate-400 text-xs mb-1">A Receber</p>
                        <p className="text-lg font-bold text-yellow-400">{formatCurrency(resumo.totalPendente)}</p>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <p className="text-slate-400 text-xs mb-1">Recebido</p>
                        <p className="text-lg font-bold text-emerald-400">{formatCurrency(resumo.totalRecebido)}</p>
                    </div>
                </div>
            </div>

            {/* Lista de Vendas */}
            <div className="px-4 mt-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold text-slate-800 text-lg">Últimas Vendas</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                        <input 
                            className="pl-9 pr-4 py-2 text-sm bg-white rounded-full border border-slate-200 focus:border-yellow-500 outline-none w-40 transition-all focus:w-48"
                            placeholder="Buscar cliente..."
                            value={filtro}
                            onChange={e => setFiltro(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    {vendasFiltradas.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <Package size={48} className="mx-auto mb-2 opacity-20" />
                            <p>Nenhuma venda encontrada</p>
                        </div>
                    ) : (
                        vendasFiltradas.map(venda => (
                            <div 
                                key={venda.id} 
                                onClick={() => { setSelectedSale(venda); setView('details'); }}
                                className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 active:scale-[0.98] transition-transform cursor-pointer"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-bold text-slate-800">{venda.cliente.nome}</h3>
                                        <p className="text-xs text-slate-500">{formatDate(venda.dataVenda)}</p>
                                    </div>
                                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg text-sm">
                                        {formatCurrency(venda.total)}
                                    </span>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md flex items-center gap-1">
                                        <Package size={12} /> {venda.produtos.length} itens
                                    </span>
                                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md flex items-center gap-1">
                                        <Calendar size={12} /> {venda.parcelas.filter(p => p.status === 'paga').length}/{venda.parcelas.length} pagas
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Floating Action Button */}
            <button 
                onClick={() => setView('new')}
                className="fixed bottom-6 right-6 bg-yellow-500 text-slate-900 p-4 rounded-full shadow-lg shadow-yellow-500/30 hover:bg-yellow-400 transition-all hover:scale-110 active:scale-90 z-30"
            >
                <PlusCircle size={28} />
            </button>

            {/* Modais de Navegação */}
            {view === 'new' && (
                <NewSale 
                    onClose={() => setView('list')} 
                    onSuccess={() => setView('list')}
                />
            )}

            {view === 'details' && selectedSale && (
                <SaleDetails 
                    sale={selectedSale} 
                    onClose={() => { setView('list'); setSelectedSale(null); }}
                    onUpdate={() => { /* Firebase listener atualiza automático */ }}
                />
            )}
        </div>
    );
};

// --- COMPONENTE RAIZ ---
const App = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-400">Carregando...</div>;

    if (!user) return <AuthScreen />;

    return <Dashboard user={user} onLogout={() => signOut(auth)} />;
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
