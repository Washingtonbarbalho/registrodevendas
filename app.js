import React, { useState, useEffect, useMemo } from 'https://esm.sh/react@18.2.0';
import { createRoot } from 'https://esm.sh/react-dom@18.2.0/client';
import { 
    Users, ShoppingBag, PlusCircle, CheckCircle, MessageCircle, Trash2, 
    ChevronDown, ChevronUp, Package, TrendingUp, Edit2, AlertTriangle, 
    Wallet, Search, CreditCard, QrCode, Banknote, Calendar, Filter, X,
    PieChart, BarChart3, ArrowUpRight, ArrowDownRight, PackageMinus,
    LogOut, Lock, Mail, Phone, Store, UserCog, UserCheck, UserX, Shield,
    ChevronLeft, ChevronRight, MoreHorizontal, LayoutGrid, AlertCircle, RefreshCw,
    Clock, Bell, DollarSign, History
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
const appId = __app_id;

// --- UTILS ---
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    // Se for timestamp do firestore
    if (dateString.seconds) return new Date(dateString.seconds * 1000).toLocaleDateString('pt-BR');
    // Se for string YYYY-MM-DD
    if (dateString.includes && dateString.includes('-')) {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    }
    return new Date(dateString).toLocaleDateString('pt-BR');
};

const formatDateFull = (date) => {
    if (!date) return '-';
    let d = date;
    if (date.seconds) d = new Date(date.seconds * 1000);
    else if (typeof date === 'string') d = new Date(date);
    
    return d.toLocaleString('pt-BR', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
    });
};

// --- COMPONENTES DE UI ---

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return React.createElement('div', { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" },
        React.createElement('div', { className: "bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" },
            React.createElement('div', { className: "px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50" },
                React.createElement('h3', { className: "font-bold text-lg text-gray-800" }, title),
                React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-gray-200 rounded-full transition-colors" },
                    React.createElement(X, { size: 20, className: "text-gray-500" })
                )
            ),
            React.createElement('div', { className: "p-6 overflow-y-auto" }, children)
        )
    );
};

// --- TELAS ---

const AuthScreen = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                // Criar perfil do usuário
                await setDoc(doc(db, 'artifacts', appId, 'users', userCredential.user.uid, 'profile', 'data'), {
                    name,
                    email,
                    role: 'vendedor', // Default
                    createdAt: serverTimestamp(),
                    active: false // Requer aprovação
                });
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return React.createElement('div', { className: "min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4" },
        React.createElement('div', { className: "bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl" },
            React.createElement('div', { className: "text-center mb-8" },
                React.createElement('div', { className: "w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4" },
                    React.createElement(Store, { size: 32, className: "text-indigo-600" })
                ),
                React.createElement('h1', { className: "text-2xl font-bold text-gray-800" }, "Gestão de Vendas"),
                React.createElement('p', { className: "text-gray-500" }, isLogin ? "Bem-vindo de volta!" : "Crie sua conta para começar")
            ),
            error && React.createElement('div', { className: "mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2" },
                React.createElement(AlertCircle, { size: 16 }), error
            ),
            React.createElement('form', { onSubmit: handleAuth, className: "space-y-4" },
                !isLogin && React.createElement('div', {},
                    React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, "Nome Completo"),
                    React.createElement('input', { 
                        type: "text", 
                        required: true,
                        className: "w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all",
                        placeholder: "Seu nome",
                        value: name,
                        onChange: e => setName(e.target.value)
                    })
                ),
                React.createElement('div', {},
                    React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, "Email"),
                    React.createElement('input', { 
                        type: "email", 
                        required: true,
                        className: "w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all",
                        placeholder: "seu@email.com",
                        value: email,
                        onChange: e => setEmail(e.target.value)
                    })
                ),
                React.createElement('div', {},
                    React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, "Senha"),
                    React.createElement('input', { 
                        type: "password", 
                        required: true,
                        className: "w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all",
                        placeholder: "••••••••",
                        value: password,
                        onChange: e => setPassword(e.target.value)
                    })
                ),
                React.createElement('button', { 
                    type: "submit", 
                    disabled: loading,
                    className: "w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                }, loading ? React.createElement(RefreshCw, { className: "animate-spin" }) : (isLogin ? "Entrar" : "Criar Conta"))
            ),
            React.createElement('div', { className: "mt-6 text-center" },
                React.createElement('button', { 
                    onClick: () => setIsLogin(!isLogin),
                    className: "text-indigo-600 font-medium hover:underline text-sm"
                }, isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça login")
            )
        )
    );
};

const Dashboard = ({ user, userProfile, onLogout }) => {
    // --- ESTADOS ---
    const [view, setView] = useState('dashboard'); // dashboard, vendas, nova-venda, clientes, usuarios
    const [clientes, setClientes] = useState([]);
    const [vendas, setVendas] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Estados Nova Venda
    const [cart, setCart] = useState([]);
    const [selectedClient, setSelectedClient] = useState('');
    const [formaPagamento, setFormaPagamento] = useState('pix');
    const [parcelasCount, setParcelasCount] = useState(1);
    
    // Estados Modais e Filtros
    const [clientModalOpen, setClientModalOpen] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedVenda, setSelectedVenda] = useState(null); // Para ver detalhes

    // --- ESTADOS PARA O PAGAMENTO PARCIAL ---
    const [pagamentoModalOpen, setPagamentoModalOpen] = useState(false);
    const [pagamentoParcelaInfo, setPagamentoParcelaInfo] = useState(null); // { vendaId, index, valorRestante, valorOriginal, valorPagoAteAgora }
    const [valorInputPagamento, setValorInputPagamento] = useState('');


    // --- LOAD DATA ---
    useEffect(() => {
        if (!user) return;

        // Load Clientes
        const unsubClientes = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'clientes'), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setClientes(data.sort((a,b) => a.nome.localeCompare(b.nome)));
        });

        // Load Vendas
        const unsubVendas = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'vendas'), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Ordenar por data (mais recente primeiro)
            setVendas(data.sort((a,b) => b.data.seconds - a.data.seconds));
            setLoading(false);
        });

        return () => { unsubClientes(); unsubVendas(); };
    }, [user]);

    // --- AÇÕES ---

    const handleAddClient = async (e) => {
        e.preventDefault();
        try {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clientes'), {
                nome: newClientName,
                telefone: newClientPhone,
                createdAt: serverTimestamp()
            });
            setNewClientName(''); setNewClientPhone(''); setClientModalOpen(false);
        } catch (error) {
            console.error("Erro ao adicionar cliente:", error);
            alert("Erro ao adicionar cliente");
        }
    };

    const handleFinalizarVenda = async () => {
        if (!selectedClient || cart.length === 0) return alert("Selecione um cliente e adicione produtos.");
        
        const total = cart.reduce((acc, item) => acc + (item.preco * item.qtd), 0);
        
        // Gerar parcelas
        let parcelas = [];
        const valorParcela = total / parcelasCount;
        const hoje = new Date();

        for (let i = 0; i < parcelasCount; i++) {
            const vencimento = new Date(hoje);
            vencimento.setMonth(hoje.getMonth() + i + 1); // 1 mês depois, 2 meses depois...
            
            parcelas.push({
                numero: i + 1,
                valor: valorParcela,
                valorPago: 0, // Novo campo para controle parcial
                vencimento: vencimento.toISOString().split('T')[0],
                status: 'pendente',
                historico: [] // Novo campo para histórico
            });
        }

        const novaVenda = {
            clienteId: selectedClient,
            clienteNome: clientes.find(c => c.id === selectedClient)?.nome,
            produtos: cart,
            total,
            formaPagamento,
            parcelas, // Array de objetos parcela
            data: serverTimestamp(),
            status: 'concluida', // Status da venda em si
            vendedorId: user.uid,
            vendedorNome: userProfile.name
        };

        try {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'vendas'), novaVenda);
            setCart([]); setSelectedClient(''); setView('vendas');
            alert("Venda realizada com sucesso!");
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar venda.");
        }
    };

    // --- FUNÇÕES DE PAGAMENTO (CORE DA ALTERAÇÃO) ---

    // 1. Abre o modal
    const iniciarPagamento = (venda, index) => {
        const p = venda.parcelas[index];
        const valorPagoAteAgora = p.valorPago || 0;
        const valorRestante = p.valor - valorPagoAteAgora;

        setPagamentoParcelaInfo({
            vendaId: venda.id,
            index: index,
            parcelaNumero: p.numero,
            valorOriginal: p.valor,
            valorPagoAteAgora: valorPagoAteAgora,
            valorRestante: valorRestante,
            isLast: index === venda.parcelas.length - 1
        });
        setValorInputPagamento(valorRestante.toFixed(2)); // Sugere o valor restante
        setPagamentoModalOpen(true);
    };

    // 2. Confirma o pagamento com a lógica complexa
    const confirmarPagamento = async () => {
        if (!pagamentoParcelaInfo) return;

        const valorInformado = parseFloat(valorInputPagamento);
        if (isNaN(valorInformado) || valorInformado <= 0) {
            alert("Por favor, informe um valor válido.");
            return;
        }

        const { vendaId, index, valorRestante, isLast } = pagamentoParcelaInfo;

        // Validação da última parcela
        if (isLast && valorInformado > (valorRestante + 0.01)) { // margem de erro float
            alert("Na última parcela, não é permitido pagar um valor maior que o restante.");
            return;
        }

        try {
            // Pegar a venda atual do estado (mais seguro pegar do banco em app real, mas aqui ok)
            const vendaAtual = vendas.find(v => v.id === vendaId);
            if (!vendaAtual) return;

            // Deep copy das parcelas para editar
            const novasParcelas = [...vendaAtual.parcelas];
            const parcelaAtual = { ...novasParcelas[index] }; // Copy da parcela
            
            // --- CÁLCULO DO PAGAMENTO ---
            let valorEfetivoPagamento = valorInformado;
            let troco = 0;

            if (valorInformado > valorRestante) {
                // Pagamento maior que a dívida
                valorEfetivoPagamento = valorRestante; // Paga só o que deve nesta
                troco = valorInformado - valorRestante; // O resto é troco/crédito
            }

            // Atualizar Parcela Atual
            parcelaAtual.valorPago = (parcelaAtual.valorPago || 0) + valorEfetivoPagamento;
            
            // Adicionar ao histórico
            const novoHistoricoItem = {
                data: new Date().toISOString(),
                valor: valorEfetivoPagamento,
                usuario: userProfile.name || 'Usuário',
                tipo: 'pagamento',
                obs: troco > 0 ? 'Pagamento com valor excedente aplicado na próxima' : 'Pagamento recebido'
            };
            parcelaAtual.historico = [...(parcelaAtual.historico || []), novoHistoricoItem];

            // Verificar se quitou (com pequena margem pra erro de float)
            if (parcelaAtual.valorPago >= parcelaAtual.valor - 0.01) {
                parcelaAtual.status = 'paga';
                parcelaAtual.dataPagamento = new Date().toISOString(); // Mantém compatibilidade
            }

            novasParcelas[index] = parcelaAtual;

            // --- TRATAMENTO DO EXCESSO (TROCO) NA PRÓXIMA PARCELA ---
            if (troco > 0 && !isLast) {
                const proximaIndex = index + 1;
                const proximaParcela = { ...novasParcelas[proximaIndex] };

                // Aplica o troco como "pagamento adiantado" na próxima
                proximaParcela.valorPago = (proximaParcela.valorPago || 0) + troco;

                // Histórico da próxima
                proximaParcela.historico = [...(proximaParcela.historico || []), {
                    data: new Date().toISOString(),
                    valor: troco,
                    usuario: 'Sistema',
                    tipo: 'credito_anterior',
                    obs: `Crédito proveniente da parcela ${parcelaAtual.numero}`
                }];

                // Verifica se a próxima quitou com esse crédito
                if (proximaParcela.valorPago >= proximaParcela.valor - 0.01) {
                    proximaParcela.status = 'paga';
                    proximaParcela.dataPagamento = new Date().toISOString();
                }

                novasParcelas[proximaIndex] = proximaParcela;
            }

            // Salvar no Firestore
            const vendaRef = doc(db, 'artifacts', appId, 'public', 'data', 'vendas', vendaId);
            await updateDoc(vendaRef, { parcelas: novasParcelas });

            setPagamentoModalOpen(false);
            setPagamentoParcelaInfo(null);
            setValorInputPagamento('');
            
            // Atualizar o selectedVenda se estiver aberto
            if (selectedVenda && selectedVenda.id === vendaId) {
                setSelectedVenda({ ...selectedVenda, parcelas: novasParcelas });
            }

        } catch (error) {
            console.error("Erro ao processar pagamento:", error);
            alert("Erro ao processar pagamento. Tente novamente.");
        }
    };


    // --- COMPUTED ---
    const filteredVendas = useMemo(() => {
        if (!searchTerm) return vendas;
        const lower = searchTerm.toLowerCase();
        return vendas.filter(v => 
            v.clienteNome?.toLowerCase().includes(lower) || 
            v.id.toLowerCase().includes(lower)
        );
    }, [vendas, searchTerm]);

    const stats = useMemo(() => {
        const hoje = new Date();
        const mesAtual = hoje.getMonth();
        const vendasMes = vendas.filter(v => new Date(v.data.seconds * 1000).getMonth() === mesAtual);
        
        return {
            totalVendas: vendasMes.reduce((acc, v) => acc + v.total, 0),
            qtdVendas: vendasMes.length,
            ticketMedio: vendasMes.length ? (vendasMes.reduce((acc, v) => acc + v.total, 0) / vendasMes.length) : 0
        };
    }, [vendas]);

    // --- RENDER COMPONENTES INTERNOS ---

    const VendaDetailsModal = () => {
        // Estado local para controlar quais históricos estão expandidos
        const [expandedHistory, setExpandedHistory] = useState({});

        const toggleHistory = (idx) => {
            setExpandedHistory(prev => ({ ...prev, [idx]: !prev[idx] }));
        };

        if (!selectedVenda) return null;
        
        return React.createElement(Modal, { 
            isOpen: !!selectedVenda, 
            onClose: () => setSelectedVenda(null), 
            title: `Venda #${selectedVenda.id.slice(0,6)} - ${selectedVenda.clienteNome}` 
        },
            React.createElement('div', { className: "space-y-6" },
                // Cabeçalho
                React.createElement('div', { className: "bg-gray-50 p-4 rounded-xl flex justify-between items-center" },
                    React.createElement('div', {},
                        React.createElement('p', { className: "text-sm text-gray-500" }, "Valor Total"),
                        React.createElement('p', { className: "text-2xl font-bold text-indigo-600" }, formatCurrency(selectedVenda.total))
                    ),
                    React.createElement('div', { className: "text-right" },
                        React.createElement('p', { className: "text-sm text-gray-500" }, "Data"),
                        React.createElement('p', { className: "font-medium" }, formatDate(selectedVenda.data))
                    )
                ),

                // Lista de Produtos
                React.createElement('div', {},
                    React.createElement('h4', { className: "font-bold text-gray-700 mb-2 flex items-center gap-2" },
                        React.createElement(ShoppingBag, { size: 18 }), "Produtos"
                    ),
                    React.createElement('div', { className: "border rounded-xl overflow-hidden" },
                        React.createElement('table', { className: "w-full text-sm" },
                            React.createElement('thead', { className: "bg-gray-100 text-left" },
                                React.createElement('tr', {},
                                    React.createElement('th', { className: "p-3 font-medium" }, "Item"),
                                    React.createElement('th', { className: "p-3 font-medium text-center" }, "Qtd"),
                                    React.createElement('th', { className: "p-3 font-medium text-right" }, "Total")
                                )
                            ),
                            React.createElement('tbody', {},
                                selectedVenda.produtos.map((p, i) => 
                                    React.createElement('tr', { key: i, className: "border-t" },
                                        React.createElement('td', { className: "p-3" }, p.nome),
                                        React.createElement('td', { className: "p-3 text-center" }, p.qtd),
                                        React.createElement('td', { className: "p-3 text-right" }, formatCurrency(p.preco * p.qtd))
                                    )
                                )
                            )
                        )
                    )
                ),

                // Lista de Parcelas (MODIFICADO)
                React.createElement('div', {},
                    React.createElement('h4', { className: "font-bold text-gray-700 mb-2 flex items-center gap-2" },
                        React.createElement(Calendar, { size: 18 }), "Parcelas"
                    ),
                    React.createElement('div', { className: "space-y-2" },
                        selectedVenda.parcelas.map((p, idx) => {
                            const valorPago = p.valorPago || 0;
                            const restante = p.valor - valorPago;
                            const isPaid = p.status === 'paga';
                            const hasHistory = p.historico && p.historico.length > 0;

                            return React.createElement('div', { key: idx, className: `border rounded-xl p-3 ${isPaid ? 'bg-green-50 border-green-200' : 'bg-white'}` },
                                React.createElement('div', { className: "flex justify-between items-start mb-2" },
                                    React.createElement('div', {},
                                        React.createElement('p', { className: "font-bold text-gray-800" }, `${p.numero}ª Parcela`),
                                        React.createElement('p', { className: "text-xs text-gray-500" }, `Vence em: ${formatDate(p.vencimento)}`)
                                    ),
                                    React.createElement('div', { className: "text-right" },
                                        React.createElement('p', { className: "font-bold" }, formatCurrency(p.valor)),
                                        isPaid 
                                            ? React.createElement('span', { className: "text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full" }, "PAGA")
                                            : React.createElement('span', { className: "text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full" }, "PENDENTE")
                                    )
                                ),
                                
                                // Barra de Progresso do Pagamento
                                React.createElement('div', { className: "w-full bg-gray-200 rounded-full h-2 mb-2 overflow-hidden" },
                                    React.createElement('div', { 
                                        className: `h-full ${isPaid ? 'bg-green-500' : 'bg-amber-500'}`, 
                                        style: { width: `${Math.min((valorPago / p.valor) * 100, 100)}%` } 
                                    })
                                ),
                                
                                React.createElement('div', { className: "flex justify-between text-xs text-gray-600 mb-3" },
                                    React.createElement('span', {}, `Pago: ${formatCurrency(valorPago)}`),
                                    !isPaid && React.createElement('span', { className: "font-medium text-red-500" }, `Resta: ${formatCurrency(restante)}`)
                                ),

                                // Botões de Ação
                                React.createElement('div', { className: "flex gap-2" },
                                    !isPaid && React.createElement('button', {
                                        onClick: () => iniciarPagamento(selectedVenda, idx),
                                        className: "flex-1 bg-indigo-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1"
                                    }, React.createElement(DollarSign, { size: 14 }), "Pagar"),
                                    
                                    hasHistory && React.createElement('button', {
                                        onClick: () => toggleHistory(idx),
                                        className: "px-3 bg-gray-100 text-gray-600 text-xs font-bold py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
                                    }, React.createElement(History, { size: 14 }), expandedHistory[idx] ? "Ocultar Hist." : "Histórico")
                                ),

                                // Área de Histórico Expandida
                                expandedHistory[idx] && hasHistory && React.createElement('div', { className: "mt-3 pt-3 border-t border-gray-200 text-xs animate-in slide-in-from-top-2" },
                                    React.createElement('p', { className: "font-bold text-gray-500 mb-2" }, "Histórico de Movimentações:"),
                                    React.createElement('div', { className: "space-y-2" },
                                        p.historico.map((h, hIdx) => 
                                            React.createElement('div', { key: hIdx, className: "flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100" },
                                                React.createElement('div', {},
                                                    React.createElement('p', { className: "font-bold text-gray-700" }, formatCurrency(h.valor)),
                                                    React.createElement('p', { className: "text-[10px] text-gray-400" }, formatDateFull(h.data))
                                                ),
                                                React.createElement('div', { className: "text-right" },
                                                    React.createElement('p', { className: "font-medium text-gray-600" }, h.usuario),
                                                    React.createElement('p', { className: "text-[10px] text-indigo-500 italic" }, h.tipo === 'credito_anterior' ? 'Crédito Ant.' : 'Pagamento')
                                                )
                                            )
                                        )
                                    )
                                )
                            );
                        })
                    )
                )
            )
        );
    };

    // Componente Modal de Input de Pagamento
    const PagamentoInputModal = () => {
        if (!pagamentoModalOpen || !pagamentoParcelaInfo) return null;

        return React.createElement(Modal, {
            isOpen: pagamentoModalOpen,
            onClose: () => setPagamentoModalOpen(false),
            title: "Registrar Pagamento"
        },
            React.createElement('div', { className: "space-y-4" },
                React.createElement('div', { className: "bg-blue-50 p-4 rounded-xl border border-blue-100 text-center" },
                    React.createElement('p', { className: "text-sm text-blue-600 font-medium uppercase tracking-wide" }, `Parcela ${pagamentoParcelaInfo.parcelaNumero}`),
                    React.createElement('p', { className: "text-3xl font-bold text-blue-800 mt-1" }, formatCurrency(pagamentoParcelaInfo.valorRestante)),
                    React.createElement('p', { className: "text-xs text-blue-500 mt-1" }, `Valor original: ${formatCurrency(pagamentoParcelaInfo.valorOriginal)}`)
                ),

                React.createElement('div', {},
                    React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, "Valor Recebido (R$)"),
                    React.createElement('div', { className: "relative" },
                        React.createElement('span', { className: "absolute left-3 top-3 text-gray-400 font-bold" }, "R$"),
                        React.createElement('input', {
                            type: "number",
                            step: "0.01",
                            autoFocus: true,
                            className: "w-full pl-10 p-3 border border-gray-300 rounded-xl font-bold text-lg text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none",
                            value: valorInputPagamento,
                            onChange: e => setValorInputPagamento(e.target.value)
                        })
                    )
                ),

                !pagamentoParcelaInfo.isLast && parseFloat(valorInputPagamento) > pagamentoParcelaInfo.valorRestante && React.createElement('div', { className: "flex items-start gap-2 bg-amber-50 p-3 rounded-lg text-sm text-amber-700" },
                    React.createElement(AlertTriangle, { size: 16, className: "mt-0.5 shrink-0" }),
                    React.createElement('p', {}, `Atenção: Você está registrando R$ ${formatCurrency(parseFloat(valorInputPagamento) - pagamentoParcelaInfo.valorRestante)} a mais. Esse valor será abatido automaticamente da próxima parcela.`)
                ),

                pagamentoParcelaInfo.isLast && parseFloat(valorInputPagamento) > pagamentoParcelaInfo.valorRestante && React.createElement('div', { className: "flex items-start gap-2 bg-red-50 p-3 rounded-lg text-sm text-red-700" },
                    React.createElement(AlertTriangle, { size: 16, className: "mt-0.5 shrink-0" }),
                    React.createElement('p', {}, "Não é permitido receber valor maior que o restante na última parcela.")
                ),

                React.createElement('div', { className: "pt-2 flex gap-3" },
                    React.createElement('button', {
                        onClick: () => setPagamentoModalOpen(false),
                        className: "flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                    }, "Cancelar"),
                    React.createElement('button', {
                        onClick: confirmarPagamento,
                        disabled: !valorInputPagamento || parseFloat(valorInputPagamento) <= 0 || (pagamentoParcelaInfo.isLast && parseFloat(valorInputPagamento) > (pagamentoParcelaInfo.valorRestante + 0.1)),
                        className: "flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    }, "Confirmar")
                )
            )
        );
    };

    // --- VIEW SWITCHER ---

    const renderContent = () => {
        switch (view) {
            case 'vendas':
                return React.createElement('div', { className: "space-y-6" },
                    React.createElement('div', { className: "flex flex-col md:flex-row justify-between items-start md:items-center gap-4" },
                        React.createElement('h2', { className: "text-2xl font-bold text-gray-800" }, "Histórico de Vendas"),
                        React.createElement('div', { className: "relative w-full md:w-64" },
                            React.createElement(Search, { className: "absolute left-3 top-3 text-gray-400", size: 18 }),
                            React.createElement('input', { 
                                className: "w-full pl-10 p-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500",
                                placeholder: "Buscar venda...",
                                value: searchTerm,
                                onChange: e => setSearchTerm(e.target.value)
                            })
                        )
                    ),
                    React.createElement('div', { className: "grid gap-4" },
                        filteredVendas.map(venda => 
                            React.createElement('div', { 
                                key: venda.id, 
                                onClick: () => setSelectedVenda(venda),
                                className: "bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer flex justify-between items-center group" 
                            },
                                React.createElement('div', { className: "flex items-center gap-4" },
                                    React.createElement('div', { className: "w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold" },
                                        venda.clienteNome ? venda.clienteNome.charAt(0) : '?'
                                    ),
                                    React.createElement('div', {},
                                        React.createElement('h3', { className: "font-bold text-gray-800" }, venda.clienteNome),
                                        React.createElement('p', { className: "text-xs text-gray-500" }, `${venda.parcelas.length}x de ${formatCurrency(venda.parcelas[0].valor)} • ${formatDate(venda.data)}`)
                                    )
                                ),
                                React.createElement('div', { className: "text-right" },
                                    React.createElement('p', { className: "font-bold text-indigo-600" }, formatCurrency(venda.total)),
                                    React.createElement('div', { className: "text-xs mt-1 flex gap-1 justify-end" },
                                        venda.parcelas.every(p => p.status === 'paga') 
                                            ? React.createElement('span', { className: "text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1" }, React.createElement(CheckCircle, { size: 10 }), "Quitada")
                                            : React.createElement('span', { className: "text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1" }, React.createElement(Clock, { size: 10 }), "Em Aberto")
                                    )
                                )
                            )
                        )
                    )
                );

            case 'nova-venda':
                return React.createElement('div', { className: "space-y-6" },
                    React.createElement('h2', { className: "text-2xl font-bold text-gray-800" }, "Nova Venda"),
                    
                    // Seletor de Cliente
                    React.createElement('div', { className: "bg-white p-6 rounded-2xl shadow-sm border border-gray-100" },
                        React.createElement('label', { className: "block text-sm font-bold text-gray-700 mb-2" }, "Cliente"),
                        React.createElement('div', { className: "flex gap-2" },
                            React.createElement('select', { 
                                className: "flex-1 p-3 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 bg-white",
                                value: selectedClient,
                                onChange: e => setSelectedClient(e.target.value)
                            },
                                React.createElement('option', { value: "" }, "Selecione um cliente..."),
                                clientes.map(c => React.createElement('option', { key: c.id, value: c.id }, c.nome))
                            ),
                            React.createElement('button', { 
                                onClick: () => setClientModalOpen(true),
                                className: "p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors" 
                            }, React.createElement(PlusCircle, { size: 20 }))
                        )
                    ),

                    // Adicionar Produtos (Simplificado - apenas input manual para exemplo)
                    React.createElement('div', { className: "bg-white p-6 rounded-2xl shadow-sm border border-gray-100" },
                        React.createElement('h3', { className: "font-bold text-gray-800 mb-4" }, "Itens da Venda"),
                        React.createElement('div', { className: "flex gap-2 mb-4" },
                            React.createElement('input', { id: "prod-name", placeholder: "Nome do produto", className: "flex-[2] p-2 border rounded-lg" }),
                            React.createElement('input', { id: "prod-price", type: "number", placeholder: "Preço", className: "flex-1 p-2 border rounded-lg" }),
                            React.createElement('input', { id: "prod-qtd", type: "number", placeholder: "Qtd", className: "w-20 p-2 border rounded-lg", defaultValue: 1 }),
                            React.createElement('button', {
                                onClick: () => {
                                    const nome = document.getElementById('prod-name').value;
                                    const preco = parseFloat(document.getElementById('prod-price').value);
                                    const qtd = parseInt(document.getElementById('prod-qtd').value);
                                    if(nome && preco) {
                                        setCart([...cart, { nome, preco, qtd }]);
                                        document.getElementById('prod-name').value = '';
                                        document.getElementById('prod-price').value = '';
                                    }
                                },
                                className: "bg-indigo-600 text-white p-2 rounded-lg"
                            }, React.createElement(PlusCircle, { size: 20 }))
                        ),
                        // Lista do Carrinho
                        cart.map((item, idx) => 
                            React.createElement('div', { key: idx, className: "flex justify-between items-center py-2 border-b" },
                                React.createElement('span', {}, `${item.qtd}x ${item.nome}`),
                                React.createElement('span', { className: "font-bold" }, formatCurrency(item.preco * item.qtd))
                            )
                        ),
                        cart.length > 0 && React.createElement('div', { className: "mt-4 text-right text-xl font-bold text-indigo-600" },
                            "Total: ", formatCurrency(cart.reduce((a, b) => a + (b.preco * b.qtd), 0))
                        )
                    ),

                    // Pagamento
                    React.createElement('div', { className: "bg-white p-6 rounded-2xl shadow-sm border border-gray-100" },
                        React.createElement('h3', { className: "font-bold text-gray-800 mb-4" }, "Condições de Pagamento"),
                        React.createElement('div', { className: "grid grid-cols-2 gap-4" },
                            React.createElement('div', {},
                                React.createElement('label', { className: "block text-sm text-gray-600 mb-1" }, "Forma"),
                                React.createElement('select', { 
                                    className: "w-full p-2 border rounded-lg",
                                    value: formaPagamento,
                                    onChange: e => setFormaPagamento(e.target.value)
                                },
                                    React.createElement('option', { value: "pix" }, "Pix"),
                                    React.createElement('option', { value: "dinheiro" }, "Dinheiro"),
                                    React.createElement('option', { value: "cartao" }, "Cartão"),
                                    React.createElement('option', { value: "prazo" }, "A Prazo (Crediário)")
                                )
                            ),
                            formaPagamento === 'prazo' && React.createElement('div', {},
                                React.createElement('label', { className: "block text-sm text-gray-600 mb-1" }, "Parcelas"),
                                React.createElement('select', { 
                                    className: "w-full p-2 border rounded-lg",
                                    value: parcelasCount,
                                    onChange: e => setParcelasCount(parseInt(e.target.value))
                                },
                                    [1,2,3,4,5,6,10,12].map(n => React.createElement('option', { key: n, value: n }, `${n}x`))
                                )
                            )
                        )
                    ),

                    React.createElement('button', {
                        onClick: handleFinalizarVenda,
                        className: "w-full py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                    }, React.createElement(CheckCircle, {}), "Finalizar Venda")
                );

            case 'clientes':
                return React.createElement('div', { className: "space-y-6" },
                    React.createElement('div', { className: "flex justify-between items-center" },
                        React.createElement('h2', { className: "text-2xl font-bold text-gray-800" }, "Carteira de Clientes"),
                        React.createElement('button', { 
                            onClick: () => setClientModalOpen(true),
                            className: "px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2"
                        }, React.createElement(PlusCircle, { size: 18 }), "Novo Cliente")
                    ),
                    React.createElement('div', { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3" },
                        clientes.map(c => 
                            React.createElement('div', { key: c.id, className: "bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4" },
                                React.createElement('div', { className: "w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-lg" },
                                    c.nome.charAt(0)
                                ),
                                React.createElement('div', {},
                                    React.createElement('h3', { className: "font-bold text-gray-800" }, c.nome),
                                    React.createElement('p', { className: "text-sm text-gray-500" }, c.telefone || "Sem telefone")
                                )
                            )
                        )
                    )
                );

            default: // Dashboard Home
                return React.createElement('div', { className: "space-y-6" },
                    React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-3 gap-6" },
                        React.createElement('div', { className: "bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-200" },
                            React.createElement('div', { className: "flex justify-between items-start mb-4" },
                                React.createElement('div', { className: "p-2 bg-white/20 rounded-lg" }, React.createElement(Wallet, { size: 24 })),
                                React.createElement('span', { className: "text-xs font-medium bg-white/20 px-2 py-1 rounded" }, "Este Mês")
                            ),
                            React.createElement('p', { className: "text-indigo-100 mb-1" }, "Vendas Totais"),
                            React.createElement('h3', { className: "text-3xl font-bold" }, formatCurrency(stats.totalVendas))
                        ),
                        React.createElement('div', { className: "bg-white p-6 rounded-2xl border border-gray-100 shadow-sm" },
                            React.createElement('div', { className: "flex justify-between items-start mb-4" },
                                React.createElement('div', { className: "p-2 bg-green-50 text-green-600 rounded-lg" }, React.createElement(ShoppingBag, { size: 24 })),
                                React.createElement('span', { className: "text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded" }, "Volume")
                            ),
                            React.createElement('p', { className: "text-gray-500 mb-1" }, "Qtd. Vendas"),
                            React.createElement('h3', { className: "text-3xl font-bold text-gray-800" }, stats.qtdVendas)
                        ),
                        React.createElement('div', { className: "bg-white p-6 rounded-2xl border border-gray-100 shadow-sm" },
                            React.createElement('div', { className: "flex justify-between items-start mb-4" },
                                React.createElement('div', { className: "p-2 bg-amber-50 text-amber-600 rounded-lg" }, React.createElement(TrendingUp, { size: 24 })),
                            ),
                            React.createElement('p', { className: "text-gray-500 mb-1" }, "Ticket Médio"),
                            React.createElement('h3', { className: "text-3xl font-bold text-gray-800" }, formatCurrency(stats.ticketMedio))
                        )
                    ),
                    
                    React.createElement('div', { className: "flex justify-between items-center mt-8 mb-4" },
                        React.createElement('h3', { className: "font-bold text-gray-800 text-lg" }, "Ações Rápidas"),
                    ),
                    React.createElement('div', { className: "grid grid-cols-2 md:grid-cols-4 gap-4" },
                        React.createElement('button', { onClick: () => setView('nova-venda'), className: "p-4 bg-white border border-gray-100 rounded-xl hover:shadow-md transition-all flex flex-col items-center gap-2 text-gray-600 hover:text-indigo-600" },
                            React.createElement(PlusCircle, { size: 24 }), React.createElement('span', { className: "font-medium" }, "Nova Venda")
                        ),
                        React.createElement('button', { onClick: () => setView('clientes'), className: "p-4 bg-white border border-gray-100 rounded-xl hover:shadow-md transition-all flex flex-col items-center gap-2 text-gray-600 hover:text-indigo-600" },
                            React.createElement(Users, { size: 24 }), React.createElement('span', { className: "font-medium" }, "Clientes")
                        ),
                        React.createElement('button', { onClick: () => setView('vendas'), className: "p-4 bg-white border border-gray-100 rounded-xl hover:shadow-md transition-all flex flex-col items-center gap-2 text-gray-600 hover:text-indigo-600" },
                            React.createElement(BarChart3, { size: 24 }), React.createElement('span', { className: "font-medium" }, "Relatórios")
                        )
                    )
                );
        }
    };

    if (loading) return React.createElement('div', { className: "flex items-center justify-center h-screen bg-slate-50" }, "Carregando...");

    return React.createElement('div', { className: "flex min-h-screen bg-slate-50 text-gray-800 font-sans" },
        // Sidebar Mobile/Desktop Simplificada
        React.createElement('aside', { className: "fixed md:relative bottom-0 w-full md:w-20 md:h-screen bg-white md:flex flex-col items-center py-6 border-r border-gray-200 z-40 hidden" },
            React.createElement('div', { className: "w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white mb-8" },
                React.createElement(Store, { size: 20 })
            ),
            React.createElement('nav', { className: "flex flex-col gap-4 w-full px-2" },
                [
                    { id: 'dashboard', icon: LayoutGrid, label: 'Home' },
                    { id: 'nova-venda', icon: PlusCircle, label: 'Venda' },
                    { id: 'vendas', icon: ShoppingBag, label: 'Vendas' },
                    { id: 'clientes', icon: Users, label: 'Clientes' }
                ].map(item => 
                    React.createElement('button', { 
                        key: item.id,
                        onClick: () => setView(item.id),
                        className: `p-3 rounded-xl flex justify-center transition-all ${view === item.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`
                    }, React.createElement(item.icon, { size: 24 }))
                )
            ),
            React.createElement('div', { className: "mt-auto" },
                React.createElement('button', { onClick: onLogout, className: "p-3 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all" },
                    React.createElement(LogOut, { size: 24 })
                )
            )
        ),
        
        // Mobile Bottom Nav (apenas visualização mobile)
        React.createElement('div', { className: "md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around p-3 z-50" },
             [
                { id: 'dashboard', icon: LayoutGrid },
                { id: 'nova-venda', icon: PlusCircle },
                { id: 'vendas', icon: ShoppingBag },
                { id: 'clientes', icon: Users }
            ].map(item => 
                React.createElement('button', { 
                    key: item.id,
                    onClick: () => setView(item.id),
                    className: `${view === item.id ? 'text-indigo-600' : 'text-gray-400'}`
                }, React.createElement(item.icon, { size: 24 }))
            )
        ),

        // Main Content
        React.createElement('main', { className: "flex-1 p-4 md:p-8 overflow-y-auto mb-16 md:mb-0" },
            React.createElement('header', { className: "flex justify-between items-center mb-8" },
                React.createElement('div', {},
                    React.createElement('h1', { className: "text-xl font-bold text-gray-800" }, "Olá, " + userProfile.name.split(' ')[0]),
                    React.createElement('p', { className: "text-sm text-gray-500" }, new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))
                ),
                React.createElement('div', { className: "flex gap-2" },
                    React.createElement('button', { onClick: onLogout, className: "md:hidden p-2 bg-white rounded-full shadow-sm text-gray-600" }, React.createElement(LogOut, { size: 20 })),
                    React.createElement('div', { className: "w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold" },
                        userProfile.name.charAt(0)
                    )
                )
            ),
            renderContent()
        ),

        // Modais Globais
        React.createElement(Modal, { isOpen: clientModalOpen, onClose: () => setClientModalOpen(false), title: "Novo Cliente" },
            React.createElement('form', { onSubmit: handleAddClient, className: "space-y-4" },
                React.createElement('div', {},
                    React.createElement('label', { className: "block text-sm font-medium mb-1" }, "Nome"),
                    React.createElement('input', { className: "w-full p-2 border rounded-lg", value: newClientName, onChange: e => setNewClientName(e.target.value), required: true })
                ),
                React.createElement('div', {},
                    React.createElement('label', { className: "block text-sm font-medium mb-1" }, "Telefone"),
                    React.createElement('input', { className: "w-full p-2 border rounded-lg", value: newClientPhone, onChange: e => setNewClientPhone(e.target.value) })
                ),
                React.createElement('button', { type: "submit", className: "w-full py-3 bg-indigo-600 text-white rounded-lg font-bold" }, "Salvar Cliente")
            )
        ),

        // Modal Detalhes da Venda
        React.createElement(VendaDetailsModal, {}),

        // Modal de Pagamento (NOVO)
        React.createElement(PagamentoInputModal, {})
    );
};

// --- APP ENTRY POINT ---

const App = () => {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            if (u) {
                // Get Profile
                try {
                    const docSnap = await getDoc(doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data'));
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        if (data.active === false) {
                            setAccessDenied(true);
                            await signOut(auth);
                        } else {
                            setUser(u);
                            setUserProfile(data);
                        }
                    } else {
                        // Perfil não existe (erro de criação?), desloga
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

