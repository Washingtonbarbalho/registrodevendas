import React, { useState, useEffect, useMemo } from 'https://esm.sh/react@18.2.0';
import { createRoot } from 'https://esm.sh/react-dom@18.2.0/client';
import { 
    Users, ShoppingBag, PlusCircle, CheckCircle, MessageCircle, Trash2, 
    ChevronDown, ChevronUp, Package, TrendingUp, Edit2, AlertTriangle, 
    Wallet, Search, CreditCard, QrCode, Banknote, Calendar, Filter, X,
    PieChart, BarChart3, ArrowUpRight, ArrowDownRight, PackageMinus,
    LogOut, Lock, Mail, Phone, Store, UserCog, UserCheck, UserX, Shield,
    ChevronLeft, ChevronRight, MoreHorizontal, LayoutGrid, AlertCircle, RefreshCw
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

// --- HELPERS GERAIS ---
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const parseMoney = (valStr) => {
    if (!valStr) return 0;
    if (typeof valStr === 'number') return valStr;
    const clean = valStr.replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
};

const maskMoney = (value) => {
    let v = value.replace(/\D/g, "");
    v = (v / 100).toFixed(2) + "";
    v = v.replace(".", ",");
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    return v;
};

const maskPhone = (v) => {
    v = v.replace(/\D/g, "");
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    return v;
};

const formatDate = (dateStr) => {
    if (!dateStr) return '--/--/----';
    const isoDate = dateStr.split('T')[0];
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
};

const getBrazilDateString = () => {
    const date = new Date();
    return date.toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
};

const getBrazilISOString = () => {
    const date = new Date();
    const brazilDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const y = brazilDate.getFullYear(); const m = String(brazilDate.getMonth() + 1).padStart(2, '0'); const d = String(brazilDate.getDate()).padStart(2, '0');
    const hh = String(brazilDate.getHours()).padStart(2, '0'); const mm = String(brazilDate.getMinutes()).padStart(2, '0'); const ss = String(brazilDate.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
};

const addDays = (dateStr, days) => {
    const date = new Date(dateStr + 'T12:00:00'); 
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
};

const getCurrentMonthStart = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
};

const getCurrentMonthEnd = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
};


// --- COMPONENTES DE UI ---

const MoneyInput = ({ value, onChange, placeholder, className }) => {
    const [display, setDisplay] = useState(typeof value === 'number' ? maskMoney(value.toFixed(2)) : value);
    useEffect(() => { if (typeof value === 'number') setDisplay(maskMoney(value.toFixed(2))); }, [value]);
    const handleChange = (e) => { const m = maskMoney(e.target.value); setDisplay(m); onChange(m); };
    return React.createElement('div', { className: "relative w-full" },
        React.createElement('span', { className: "absolute left-3 top-3 text-slate-400 font-bold" }, "R$"),
        React.createElement('input', { type: "text", inputMode: "numeric", className: className, placeholder: placeholder || "0,00", value: display, onChange: handleChange })
    );
};

const UpperInput = ({ value, onChange, placeholder, className, autoFocus }) => {
    const handleChange = (e) => { onChange(e.target.value.toUpperCase()); };
    return React.createElement('input', { autoFocus: autoFocus, className: className, placeholder: placeholder, value: value, onChange: handleChange });
};

const PhoneInput = ({ value, onChange, placeholder, className }) => {
    const handleChange = (e) => { onChange(maskPhone(e.target.value)); };
    return React.createElement('input', { type: "tel", className: className, placeholder: placeholder, value: value, maxLength: 15, onChange: handleChange });
};

const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const [showAllPagesModal, setShowAllPagesModal] = useState(false);

    if (totalPages <= 1) return null;

    const renderPageNumbers = () => {
        const pages = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 4) {
                pages.push(1, 2, 3, 4, 5, '...', totalPages);
            } else if (currentPage >= totalPages - 3) {
                pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            } else {
                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
            }
        }
        return pages;
    };

    return React.createElement('div', { className: "flex justify-center items-center gap-2 mt-6 py-2 select-none" },
        React.createElement('button', { 
            onClick: () => onPageChange(currentPage - 1), 
            disabled: currentPage === 1,
            className: "p-2 rounded-lg hover:bg-slate-200 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent"
        }, React.createElement(ChevronLeft, { size: 20 })),

        renderPageNumbers().map((page, index) => {
            if (page === '...') {
                return React.createElement('button', { 
                    key: `ellipsis-${index}`,
                    onClick: () => setShowAllPagesModal(true),
                    className: "w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400"
                }, React.createElement(MoreHorizontal, { size: 16 }));
            }
            return React.createElement('button', {
                key: page,
                onClick: () => onPageChange(page),
                className: `w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm transition-colors ${currentPage === page ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100'}`
            }, page);
        }),

        React.createElement('button', { 
            onClick: () => onPageChange(currentPage + 1), 
            disabled: currentPage === totalPages,
            className: "p-2 rounded-lg hover:bg-slate-200 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent"
        }, React.createElement(ChevronRight, { size: 20 })),

        showAllPagesModal && React.createElement('div', { className: "fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4" },
            React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-sm p-4 animate-fade-in shadow-2xl" },
                React.createElement('div', { className: "flex justify-between items-center mb-4" },
                    React.createElement('h3', { className: "font-bold text-slate-800 flex items-center gap-2" }, React.createElement(LayoutGrid, { size: 18 }), "Navegar para página"),
                    React.createElement('button', { onClick: () => setShowAllPagesModal(false) }, React.createElement(X, { size: 20 }))
                ),
                React.createElement('div', { className: "grid grid-cols-5 gap-2 max-h-60 overflow-y-auto p-1" },
                    Array.from({ length: totalPages }, (_, i) => i + 1).map(p => 
                        React.createElement('button', {
                            key: p,
                            onClick: () => { onPageChange(p); setShowAllPagesModal(false); },
                            className: `p-2 rounded-lg font-bold text-sm border ${currentPage === p ? 'bg-yellow-500 text-white border-yellow-500' : 'border-slate-100 text-slate-600 hover:bg-slate-50'}`
                        }, p)
                    )
                )
            )
        )
    );
};

const DateRangeFilter = ({ period, startDate, endDate, onPeriodChange, onStartChange, onEndChange }) => {
    const [expanded, setExpanded] = useState(false);
    return React.createElement('div', { className: "bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4" },
        React.createElement('div', { className: "flex justify-between items-center cursor-pointer", onClick: () => setExpanded(!expanded) },
            React.createElement('div', { className: "flex items-center gap-2" }, 
                React.createElement(Filter, { size: 16, className: "text-slate-400" }), 
                React.createElement('span', { className: "text-sm font-bold text-slate-600" }, period === 'month' ? "Mês Atual" : "Período Personalizado")
            ),
            React.createElement(ChevronDown, { size: 16, className: `text-slate-300 transition-transform ${expanded ? 'rotate-180' : ''}` })
        ),
        expanded && React.createElement('div', { className: "mt-4 pt-4 border-t border-slate-50 space-y-3 animate-fade-in" },
            React.createElement('div', { className: "flex gap-2" }, 
                React.createElement('button', { onClick: () => onPeriodChange('month'), className: `flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${period === 'month' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}` }, "Mês Atual"), 
                React.createElement('button', { onClick: () => onPeriodChange('custom'), className: `flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${period === 'custom' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}` }, "Personalizar")
            ),
            period === 'custom' && React.createElement('div', { className: "grid grid-cols-2 gap-2" }, 
                React.createElement('div', null, 
                    React.createElement('label', { className: "text-[10px] uppercase font-bold text-slate-400" }, "Início"), 
                    React.createElement('input', { type: "date", className: "w-full p-2 border border-slate-200 rounded text-xs", value: startDate, onChange: e => onStartChange(e.target.value) })
                ), 
                React.createElement('div', null, 
                    React.createElement('label', { className: "text-[10px] uppercase font-bold text-slate-400" }, "Fim"), 
                    React.createElement('input', { type: "date", className: "w-full p-2 border border-slate-200 rounded text-xs", value: endDate, onChange: e => onEndChange(e.target.value) })
                )
            )
        )
    );
};

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;
    return React.createElement('div', { className: "fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[70] backdrop-blur-sm" },
        React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in text-center" },
            React.createElement('div', { className: "mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4" }, React.createElement(AlertTriangle, { className: "text-red-500" })),
            React.createElement('h3', { className: "text-lg font-bold text-slate-800 mb-2" }, title),
            React.createElement('p', { className: "text-slate-500 mb-6" }, message),
            React.createElement('div', { className: "flex gap-3" },
                React.createElement('button', { onClick: onClose, className: "flex-1 p-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200" }, "Cancelar"),
                React.createElement('button', { onClick: onConfirm, className: "flex-1 p-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-lg shadow-red-200" }, "Sim, Excluir")
            )
        )
    );
};

// --- TELA DE LOGIN / REGISTRO ---
const AuthScreen = () => {
    const [step, setStep] = useState('email'); 
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [storeName, setStoreName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [recoveryMode, setRecoveryMode] = useState(false);

    const checkEmail = async () => {
        if (!email) return setError("Digite um e-mail.");
        setError('');
        setLoading(true);
        try {
            const usersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'all_users');
            const q = query(usersRef, where("email", "==", email));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                setStep('password');
            } else {
                // Se não encontrou no banco, assume registro.
                // O "Auto-Reparo" acontecerá no handleRegister se o Auth já existir.
                setStep('register');
            }
        } catch (e) {
            console.error("CheckEmail Error:", e);
            // Fallback de segurança: assume login
            setStep('password');
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!password) return setError("Digite a senha.");
        setLoading(true);
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (e) {
            setError("Usuário ou senha incorretos.");
            setLoading(false);
        }
    };

    const forceCreateUserData = async (uid) => {
        const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        const userData = {
            uid: uid,
            email: email,
            name: fullName || "Usuário Recuperado",
            storeName: storeName || "Minha Hinode",
            phone: phone || "",
            role: isAdmin ? 'admin' : 'user',
            approved: isAdmin ? true : false, 
            createdAt: serverTimestamp()
        };

        // 1. Salvar Privado
        await setDoc(doc(db, 'artifacts', APP_ID, 'users', uid, 'profile', 'info'), userData);
        // 2. Salvar Público
        await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'all_users', uid), userData);
    };

    const handleRegister = async () => {
        if (!fullName || !phone || !password) return setError("Preencha os campos obrigatórios.");
        if (password !== confirmPassword) return setError("As senhas não coincidem.");
        setLoading(true);
        setError('');
        
        try {
            // Tenta criar usuário
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            await forceCreateUserData(userCred.user.uid);

        } catch (e) {
            // SE O USUÁRIO JÁ EXISTE NO AUTH (ERRO ZUMBI)
            if (e.code === 'auth/email-already-in-use') {
                try {
                    // Tenta logar com a senha fornecida no cadastro
                    const userCred = await signInWithEmailAndPassword(auth, email, password);
                    // Se logou, força a recriação dos dados (Auto-Reparo)
                    await forceCreateUserData(userCred.user.uid);
                    setRecoveryMode(true); // Feedback visual
                } catch (loginErr) {
                    setError("Este e-mail já existe. Tente fazer login na tela inicial com sua senha antiga.");
                    setLoading(false);
                }
            } else {
                setError("Erro ao cadastrar: " + e.message);
                setLoading(false);
            }
        }
    };

    const handlePhoneChange = (e) => setPhone(maskPhone(e.target.value));

    return React.createElement('div', { className: "min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-yellow-400 to-yellow-600" },
        React.createElement('div', { className: "bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md animate-fade-in" },
            React.createElement('div', { className: "text-center mb-8" },
                React.createElement('div', { className: "w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4" },
                    React.createElement(Store, { className: "text-yellow-400", size: 32 })
                ),
                React.createElement('h1', { className: "text-2xl font-bold text-slate-800" }, "Acesso ao Sistema"),
                React.createElement('p', { className: "text-slate-400 text-sm" }, step === 'register' ? "Preencha seus dados" : "Identifique-se para continuar")
            ),
            error && React.createElement('div', { className: "bg-red-50 text-red-500 p-3 rounded-xl text-sm mb-4 flex items-center gap-2" }, React.createElement(AlertTriangle, { size: 16 }), error),
            recoveryMode && React.createElement('div', { className: "bg-blue-50 text-blue-600 p-3 rounded-xl text-sm mb-4 flex items-center gap-2 animate-pulse" }, React.createElement(RefreshCw, { size: 16 }), "Conta recuperada! Redirecionando..."),
            
            step === 'email' && React.createElement('div', { className: "space-y-4" },
                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1 ml-1" }, "E-mail"), React.createElement('div', { className: "relative" }, React.createElement(Mail, { className: "absolute left-3 top-3 text-slate-400", size: 20 }), React.createElement('input', { autoFocus: true, type: "email", className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none", placeholder: "seu@email.com", value: email, onChange: e => setEmail(e.target.value) }))),
                React.createElement('button', { onClick: checkEmail, disabled: loading, className: "w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50" }, loading ? "Verificando..." : "Continuar")
            ),
            step === 'password' && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                React.createElement('div', { className: "flex items-center gap-2 bg-slate-50 p-2 rounded-lg mb-2" }, React.createElement(UserCheck, { size: 16, className: "text-green-500" }), React.createElement('span', { className: "text-sm text-slate-600 truncate flex-1" }, email), React.createElement('button', { onClick: () => { setStep('email'); setPassword(''); setError(''); }, className: "text-xs text-blue-500 font-bold hover:underline" }, "Trocar")),
                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1 ml-1" }, "Senha"), React.createElement('div', { className: "relative" }, React.createElement(Lock, { className: "absolute left-3 top-3 text-slate-400", size: 20 }), React.createElement('input', { autoFocus: true, type: "password", className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none", placeholder: "••••••••", value: password, onChange: e => setPassword(e.target.value) }))),
                React.createElement('button', { onClick: handleLogin, disabled: loading, className: "w-full py-3 bg-yellow-500 text-slate-900 font-bold rounded-xl hover:bg-yellow-400 transition-colors shadow-lg shadow-yellow-200 disabled:opacity-50" }, loading ? "Entrando..." : "Entrar")
            ),
            step === 'register' && React.createElement('div', { className: "space-y-3 animate-fade-in" },
                 React.createElement('div', { className: "flex items-center gap-2 bg-slate-50 p-2 rounded-lg mb-2" }, React.createElement(UserCog, { size: 16, className: "text-orange-500" }), React.createElement('span', { className: "text-sm text-slate-600 truncate flex-1" }, email), React.createElement('button', { onClick: () => { setStep('email'); setPassword(''); setError(''); }, className: "text-xs text-blue-500 font-bold hover:underline" }, "Trocar")),
                React.createElement('input', { className: "w-full p-3 border border-slate-200 rounded-xl", placeholder: "Nome Completo", value: fullName, onChange: e => setFullName(e.target.value) }),
                React.createElement('input', { className: "w-full p-3 border border-slate-200 rounded-xl", placeholder: "Nome da Loja (Opcional)", value: storeName, onChange: e => setStoreName(e.target.value) }),
                React.createElement('input', { className: "w-full p-3 border border-slate-200 rounded-xl", placeholder: "WhatsApp (00) 00000-0000", value: phone, onChange: handlePhoneChange, maxLength: 15 }),
                React.createElement('div', { className: "grid grid-cols-2 gap-2" }, React.createElement('input', { type: "password", className: "w-full p-3 border border-slate-200 rounded-xl", placeholder: "Senha", value: password, onChange: e => setPassword(e.target.value) }), React.createElement('input', { type: "password", className: "w-full p-3 border border-slate-200 rounded-xl", placeholder: "Confirmar Senha", value: confirmPassword, onChange: e => setConfirmPassword(e.target.value) })),
                React.createElement('button', { onClick: handleRegister, disabled: loading, className: "w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg disabled:opacity-50 mt-2" }, loading ? "Cadastrando..." : "Finalizar Cadastro")
            )
        )
    );
};

// --- PAINEL ADMIN ---
const AdminUsersPanel = ({ onClose }) => {
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'all_users'));
        const unsub = onSnapshot(q, (snap) => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => unsub();
    }, []);

    useEffect(() => setCurrentPage(1), [searchTerm]);

    const filteredUsers = users.filter(u => u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase()));

    // Pagination Logic
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleToggleStatus = async (user) => {
        const newStatus = !user.approved;
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'all_users', user.id), { approved: newStatus });
        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.id, 'profile', 'info'), { approved: newStatus });
    };

    const handleDeleteUser = async (userId) => {
        if(!confirm("Tem certeza? O usuário perderá o acesso.")) return;
        await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'all_users', userId));
    };

    const handleSaveEdit = async () => {
        if (!editingUser) return;
        const { id, name, storeName, phone } = editingUser;
        const updateData = { name, storeName, phone };
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'all_users', id), updateData);
        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', id, 'profile', 'info'), updateData);
        setEditingUser(null);
    };

    return React.createElement('div', { className: "fixed inset-0 bg-white z-50 flex flex-col animate-fade-in" },
        React.createElement('div', { className: "bg-slate-900 text-white p-6 flex justify-between items-center shadow-md" },
            React.createElement('h2', { className: "text-xl font-bold flex items-center gap-2" }, React.createElement(Shield, { className: "text-yellow-400" }), "Gerenciar Usuários"),
            React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-slate-800 rounded-full" }, React.createElement(X, { size: 24 }))
        ),
        React.createElement('div', { className: "p-4 border-b border-slate-100 bg-slate-50" },
            React.createElement('div', { className: "relative max-w-lg mx-auto" }, React.createElement(Search, { className: "absolute left-3 top-3 text-slate-400", size: 18 }), React.createElement('input', { className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none", placeholder: "Buscar por nome ou e-mail...", value: searchTerm, onChange: e => setSearchTerm(e.target.value) }))
        ),
        React.createElement('div', { className: "flex-1 overflow-y-auto p-4 bg-slate-100" },
            React.createElement('div', { className: "max-w-3xl mx-auto space-y-3" },
                paginatedUsers.map(u => {
                    const isMe = u.email === ADMIN_EMAIL;
                    return React.createElement('div', { key: u.id, className: "bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4" },
                        React.createElement('div', { className: "flex-1" },
                            React.createElement('div', { className: "flex items-center gap-2" }, React.createElement('h3', { className: "font-bold text-slate-800" }, u.name), u.role === 'admin' && React.createElement('span', { className: "bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" }, "Admin"), !u.approved && React.createElement('span', { className: "bg-red-100 text-red-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" }, "Bloqueado")),
                            React.createElement('p', { className: "text-sm text-slate-500" }, u.email),
                            React.createElement('p', { className: "text-xs text-slate-400 mt-1" }, u.storeName || "Sem loja")
                        ),
                        React.createElement('div', { className: "flex items-center gap-2" }, !isMe && React.createElement('button', { onClick: () => handleToggleStatus(u), className: `px-4 py-2 rounded-lg font-bold text-sm ${u.approved ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}` }, u.approved ? "Bloquear" : "Permitir"), React.createElement('button', { onClick: () => setEditingUser(u), className: "p-2 text-slate-400 hover:text-blue-500" }, React.createElement(Edit2, { size: 18 })), !isMe && React.createElement('button', { onClick: () => handleDeleteUser(u.id), className: "p-2 text-slate-400 hover:text-red-500" }, React.createElement(Trash2, { size: 18 })))
                    );
                }),
                React.createElement(Pagination, { totalItems: filteredUsers.length, itemsPerPage: ITEMS_PER_PAGE, currentPage: currentPage, onPageChange: setCurrentPage })
            )
        ),
        editingUser && React.createElement('div', { className: "fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]" },
            React.createElement('div', { className: "bg-white p-6 rounded-2xl w-full max-w-sm animate-fade-in" },
                React.createElement('h3', { className: "font-bold text-lg mb-4" }, "Editar Usuário"),
                React.createElement('input', { className: "w-full p-2 mb-2 border rounded", value: editingUser.name, onChange: e => setEditingUser({...editingUser, name: e.target.value}), placeholder: "Nome" }),
                React.createElement('input', { className: "w-full p-2 mb-2 border rounded", value: editingUser.storeName, onChange: e => setEditingUser({...editingUser, storeName: e.target.value}), placeholder: "Loja" }),
                React.createElement('input', { className: "w-full p-2 mb-4 border rounded", value: editingUser.phone, onChange: e => setEditingUser({...editingUser, phone: maskPhone(e.target.value)}), placeholder: "Telefone" }),
                React.createElement('div', { className: "flex gap-2" }, React.createElement('button', { onClick: () => setEditingUser(null), className: "flex-1 p-2 text-slate-500 font-bold" }, "Cancelar"), React.createElement('button', { onClick: handleSaveEdit, className: "flex-1 p-2 bg-slate-900 text-white font-bold rounded" }, "Salvar"))
            )
        )
    );
};

// --- COMPONENTES AUXILIARES ---
const EditInstallmentModal = ({ isOpen, onClose, installment, onSave }) => {
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');
    useEffect(() => { if (installment) { setAmount(maskMoney(installment.amount.toFixed(2))); setDueDate(installment.dueDate); } }, [installment]);
    const handleSave = () => { onSave({ ...installment, amount: parseMoney(amount), dueDate }); onClose(); };
    if (!isOpen || !installment) return null;
    return React.createElement('div', { className: "fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]" },
        React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in" },
            React.createElement('h3', { className: "text-lg font-bold mb-4 flex items-center gap-2" }, React.createElement(Edit2, { size: 20, className: "text-yellow-600" }), `Editar Parcela ${installment.number}`),
            React.createElement('div', { className: "space-y-4" },
                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Valor (R$)"), React.createElement(MoneyInput, { value: amount, onChange: setAmount })),
                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Vencimento"), React.createElement('input', { type: "date", className: "w-full p-3 border border-slate-200 rounded-lg", value: dueDate, onChange: e => setDueDate(e.target.value) }))
            ),
            React.createElement('div', { className: "flex gap-3 mt-6" }, React.createElement('button', { onClick: onClose, className: "flex-1 p-3 text-slate-500 font-bold" }, "Cancelar"), React.createElement('button', { onClick: handleSave, className: "flex-1 p-3 bg-slate-900 text-white font-bold rounded-xl" }, "Salvar"))
        )
    );
};

const ProductFormModal = ({ isOpen, onClose, onSave, lastCode, initialData }) => {
    const [name, setName] = useState('');
    useEffect(() => { if (initialData) setName(initialData.name); else setName(''); }, [initialData, isOpen]);
    const nextCode = useMemo(() => { if (initialData) return initialData.code; if (!lastCode) return '000001'; const num = parseInt(lastCode, 10) + 1; return String(num).padStart(6, '0'); }, [lastCode, initialData]);
    const handleSubmit = () => { if (!name) return; onSave({ name, code: nextCode }); setName(''); onClose(); };
    if (!isOpen) return null;
    return React.createElement('div', { className: "fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" },
        React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in" },
            React.createElement('h3', { className: "text-lg font-bold mb-1 flex items-center gap-2" }, React.createElement(Package, { className: "text-yellow-600" }), initialData ? 'Editar Produto' : 'Novo Produto'),
            React.createElement('p', { className: "text-sm text-slate-400 mb-4" }, `Código: #${nextCode}`),
            React.createElement(UpperInput, { autoFocus: true, placeholder: "Nome do Produto", value: name, onChange: setName, className: "w-full p-3 border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-yellow-500 mb-6" }),
            React.createElement('div', { className: "flex gap-2" }, React.createElement('button', { onClick: onClose, className: "flex-1 p-3 text-slate-500 hover:bg-slate-100 rounded-lg" }, "Cancelar"), React.createElement('button', { onClick: handleSubmit, disabled: !name, className: "flex-1 p-3 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600 disabled:opacity-50" }, "Salvar"))
        )
    );
};

const CustomerFormModal = ({ isOpen, onClose, onSave, initialData }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    useEffect(() => { if (initialData) { setName(initialData.name); setPhone(initialData.phone); } else { setName(''); setPhone(''); } }, [initialData, isOpen]);
    const handleSubmit = () => { if (!name) return; onSave({ name, phone }); if(!initialData) { setName(''); setPhone(''); } onClose(); };
    if (!isOpen) return null;
    return React.createElement('div', { className: "fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" },
        React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in" },
            React.createElement('h3', { className: "text-lg font-bold mb-4" }, initialData ? 'Editar Cliente' : 'Novo Cliente'),
            React.createElement(UpperInput, { placeholder: "Nome Completo", value: name, onChange: setName, className: "w-full p-3 border border-slate-200 rounded-lg mb-3" }),
            React.createElement(PhoneInput, { placeholder: "WhatsApp (11) 99999-9999", value: phone, onChange: setPhone, className: "w-full p-3 border border-slate-200 rounded-lg mb-6" }),
            React.createElement('div', { className: "flex gap-2" }, React.createElement('button', { onClick: onClose, className: "flex-1 p-3 text-slate-500 font-bold" }, "Cancelar"), React.createElement('button', { onClick: handleSubmit, className: "flex-1 p-3 bg-slate-900 text-white font-bold rounded-lg" }, "Salvar"))
        )
    );
};

const NewSaleModal = ({ isOpen, onClose, customers, products, onSave }) => {
    const [step, setStep] = useState(1);
    const [customerId, setCustomerId] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [cart, setCart] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [currentQty, setCurrentQty] = useState(1);
    const [currentCost, setCurrentCost] = useState('');
    const [currentPrice, setCurrentPrice] = useState('');
    const [saleDate, setSaleDate] = useState(getBrazilDateString()); 
    const [saleType, setSaleType] = useState('prazo');
    const [frequency, setFrequency] = useState('monthly');
    const [installmentsCount, setInstallmentsCount] = useState(1);
    const [firstDueDate, setFirstDueDate] = useState('');
    const [entryAmount, setEntryAmount] = useState('');
    const [directMethod, setDirectMethod] = useState('pix');
    const [cardInstallments, setCardInstallments] = useState(1);

    useEffect(() => { if (isOpen) { const today = getBrazilDateString(); setSaleDate(today); setFirstDueDate(addDays(today, 30)); setStep(1); setCart([]); setCustomerId(''); setEntryAmount(''); setSaleType('prazo'); setCustomerSearch(''); setProductSearch(''); setCurrentQty(1); setCurrentCost(''); setCurrentPrice(''); } }, [isOpen]);
    useEffect(() => { let daysToAdd = 30; if (frequency === 'weekly') daysToAdd = 7; else if (frequency === 'biweekly') daysToAdd = 15; setFirstDueDate(addDays(saleDate, daysToAdd)); }, [frequency, saleDate]);

    const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()));
    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.includes(productSearch));
    const totalCartValue = cart.reduce((acc, item) => acc + item.price, 0);
    const entryValue = parseMoney(entryAmount) || 0;
    const totalRemaining = Math.max(0, totalCartValue - entryValue);

    const handleAddItem = () => {
        const qty = parseInt(currentQty) || 1;
        const unitCost = parseMoney(currentCost);
        const unitPrice = parseMoney(currentPrice);
        if(!selectedProductId || unitCost <= 0 || unitPrice <= 0 || qty <= 0) return;
        const prod = products.find(p => p.id === selectedProductId);
        const totalLineCost = unitCost * qty;
        const totalLinePrice = unitPrice * qty;
        const newItem = { tempId: Date.now(), productId: prod.id, productName: prod.name, productCode: prod.code, quantity: qty, cost: totalLineCost, price: totalLinePrice, unitPrice: unitPrice, unitCost: unitCost };
        setCart([...cart, newItem]);
        setSelectedProductId(''); setCurrentQty(1); setCurrentCost(''); setCurrentPrice(''); setProductSearch('');
    };
    const handleRemoveItem = (id) => setCart(cart.filter(i => i.tempId !== id));

    const calculateInstallments = () => {
        const total = totalRemaining;
        const count = parseInt(installmentsCount) || 1;
        if (total <= 0) return [];
        const amountPerInstallment = total / count;
        const installments = [];
        let currentDateStr = firstDueDate; 
        for (let i = 0; i < count; i++) {
            installments.push({ number: i + 1, amount: amountPerInstallment, dueDate: currentDateStr, paid: false, paidAt: null });
            if (frequency === 'weekly') currentDateStr = addDays(currentDateStr, 7);
            else if (frequency === 'biweekly') currentDateStr = addDays(currentDateStr, 15);
            else currentDateStr = addDays(currentDateStr, 30);
        }
        return installments;
    };

    const handleFinish = () => {
        if (!customerId || cart.length === 0) return;
        const customer = customers.find(c => c.id === customerId);
        let saleData = { customerId: customerId, customerName: customer.name, customerPhone: customer.phone, items: cart, totalCost: cart.reduce((acc, i) => acc + i.cost, 0), totalPrice: totalCartValue, saleDate: saleDate, saleType: saleType };
        if (saleType === 'prazo') {
            const finalInstallments = calculateInstallments();
            saleData = { ...saleData, entryAmount: entryValue, frequency, installmentsCount: finalInstallments.length, installments: finalInstallments, status: finalInstallments.length === 0 && entryValue >= totalCartValue ? 'completed' : 'active' };
        } else {
            saleData = { ...saleData, paymentMethod: directMethod, entryAmount: entryValue, cardAmount: totalRemaining, cardInstallments: directMethod === 'credit' ? parseInt(cardInstallments) : 1, installments: [], status: 'completed' };
        }
        onSave(saleData); onClose();
    };

    if (!isOpen) return null;
    return React.createElement('div', { className: "fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" },
        React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-md p-6 animate-fade-in shadow-2xl flex flex-col max-h-[90vh]" },
            React.createElement('div', { className: "flex items-center justify-between mb-4" }, React.createElement('h2', { className: "text-xl font-bold text-slate-800 flex items-center gap-2" }, React.createElement(ShoppingBag, { className: "text-yellow-600" }), "Nova Venda"), React.createElement('div', { className: "flex gap-1" }, [1,2,3].map(i => React.createElement('div', { key: i, className: `h-2 w-8 rounded-full ${step >= i ? 'bg-yellow-500' : 'bg-slate-200'}` })))),
            React.createElement('div', { className: "flex-1 overflow-y-auto pr-1" },
                step === 1 && React.createElement('div', { className: "space-y-4" },
                    React.createElement('div', { className: "bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3" },
                        React.createElement('label', { className: "text-xs font-bold text-slate-400 uppercase" }, "Buscar Cliente"),
                        React.createElement('div', { className: "relative" }, React.createElement(Search, { className: "absolute left-3 top-3 text-slate-400", size: 16 }), React.createElement('input', { className: "w-full p-2 pl-9 border border-slate-200 rounded-lg text-sm bg-white", placeholder: "Filtrar por nome...", value: customerSearch, onChange: e => setCustomerSearch(e.target.value) })),
                        React.createElement('select', { className: "w-full p-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500", value: customerId, onChange: e => setCustomerId(e.target.value) }, React.createElement('option', { value: "" }, "Selecione..."), filteredCustomers.map(c => React.createElement('option', { key: c.id, value: c.id }, c.name)))
                    )
                ),
                step === 2 && React.createElement('div', { className: "space-y-4" },
                    React.createElement('div', { className: "bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3" },
                        React.createElement('div', { className: "relative" }, React.createElement(Search, { className: "absolute left-3 top-3 text-slate-400", size: 16 }), React.createElement('input', { className: "w-full p-2 pl-9 border border-slate-200 rounded-lg text-sm bg-white", placeholder: "Filtrar produtos...", value: productSearch, onChange: e => setProductSearch(e.target.value) })),
                        React.createElement('select', { className: "w-full p-3 bg-white border border-slate-200 rounded-lg", value: selectedProductId, onChange: e => setSelectedProductId(e.target.value) }, React.createElement('option', { value: "" }, "Escolha na lista..."), filteredProducts.map(p => React.createElement('option', { key: p.id, value: p.id }, `#${p.code} - ${p.name}`))),
                        React.createElement('div', { className: "flex gap-2" },
                            React.createElement('div', { className: "w-20" }, React.createElement('label', { className: "block text-[10px] font-bold text-slate-400 uppercase mb-1" }, "Qtd"), React.createElement('input', { type: "number", min: "1", className: "w-full p-3 border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-yellow-500", value: currentQty, onChange: e => setCurrentQty(e.target.value) })),
                            React.createElement('div', { className: "flex-1" }, React.createElement('label', { className: "block text-[10px] font-bold text-slate-400 uppercase mb-1" }, "Custo Unit."), React.createElement(MoneyInput, { placeholder: "0,00", value: currentCost, onChange: setCurrentCost, className: "w-full p-3 pl-10 border border-slate-200 rounded-lg bg-white" })),
                            React.createElement('div', { className: "flex-1" }, React.createElement('label', { className: "block text-[10px] font-bold text-slate-400 uppercase mb-1" }, "Venda Unit."), React.createElement(MoneyInput, { placeholder: "0,00", value: currentPrice, onChange: setCurrentPrice, className: "w-full p-3 pl-10 border border-slate-200 rounded-lg bg-white" }))
                        ),
                        React.createElement('button', { onClick: handleAddItem, disabled: !selectedProductId || !currentCost || !currentPrice || currentQty < 1, className: "w-full py-2 bg-slate-800 text-white rounded-lg font-bold text-sm disabled:opacity-50" }, "+ Adicionar Item")
                    ),
                    React.createElement('div', { className: "space-y-2" },
                        React.createElement('label', { className: "text-xs font-bold text-slate-400 uppercase" }, `Carrinho (${cart.reduce((a,b)=>a+(parseInt(b.quantity)||1),0)} itens)`),
                        cart.length === 0 ? React.createElement('p', { className: "text-center text-slate-400 text-sm py-4 italic" }, "Vazio") : cart.map(item => React.createElement('div', { key: item.tempId, className: "flex justify-between items-center bg-yellow-50 p-3 rounded-lg border border-yellow-100" }, React.createElement('div', null, React.createElement('p', { className: "font-bold text-sm text-slate-800" }, `${item.quantity}x ${item.productName}`), React.createElement('p', { className: "text-xs text-slate-500" }, `Total: ${formatCurrency(item.price)}`)), React.createElement('button', { onClick: () => handleRemoveItem(item.tempId), className: "text-red-400 hover:text-red-600" }, React.createElement(Trash2, { size: 16 })))),
                        cart.length > 0 && React.createElement('div', { className: "text-right font-bold text-lg text-slate-800 pt-2 border-t" }, `Total: ${formatCurrency(totalCartValue)}`)
                    )
                ),
                step === 3 && React.createElement('div', { className: "space-y-4" },
                    React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1" }, React.createElement(Calendar, { size: 12 }), " Data da Venda"), React.createElement('input', { type: "date", className: "w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500", value: saleDate, onChange: e => setSaleDate(e.target.value) })),
                    React.createElement('div', { className: "flex bg-slate-100 p-1 rounded-xl mb-2" },
                        React.createElement('button', { onClick: () => setSaleType('prazo'), className: `flex-1 py-2 text-sm font-bold rounded-lg transition-all ${saleType === 'prazo' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}` }, "A Prazo (Fiado)"),
                        React.createElement('button', { onClick: () => setSaleType('direct'), className: `flex-1 py-2 text-sm font-bold rounded-lg transition-all ${saleType === 'direct' ? 'bg-emerald-500 shadow text-white' : 'text-slate-400'}` }, "Caixa / Cartão")
                    ),
                    saleType === 'prazo' && React.createElement('div', { className: "animate-fade-in space-y-4" },
                        React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Entrada (Opcional)"), React.createElement(MoneyInput, { value: entryAmount, onChange: setEntryAmount })),
                        totalRemaining > 0 && React.createElement(React.Fragment, null,
                            React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Frequência"), React.createElement('select', { className: "w-full p-3 border border-slate-200 rounded-lg", value: frequency, onChange: e => setFrequency(e.target.value) }, React.createElement('option', { value: "weekly" }, "Semanal"), React.createElement('option', { value: "biweekly" }, "Quinzenal"), React.createElement('option', { value: "monthly" }, "Mensal"))),
                            React.createElement('div', { className: "grid grid-cols-2 gap-4" },
                                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Parcelas"), React.createElement('select', { className: "w-full p-3 border border-slate-200 rounded-lg", value: installmentsCount, onChange: e => setInstallmentsCount(e.target.value) }, [1,2,3,4,5,6,8,10,12].map(n => React.createElement('option', { key: n, value: n }, `${n}x`)))),
                                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "1ª Data"), React.createElement('input', { type: "date", className: "w-full p-3 border border-slate-200 rounded-lg", value: firstDueDate, onChange: e => setFirstDueDate(e.target.value) }))
                            )
                        )
                    ),
                    saleType === 'direct' && React.createElement('div', { className: "animate-fade-in space-y-4" },
                        React.createElement('div', { className: "grid grid-cols-2 gap-3" },
                            ['pix','money','debit','credit'].map(m => React.createElement('button', { key: m, onClick: () => setDirectMethod(m), className: `p-4 rounded-xl border flex flex-col items-center gap-2 ${directMethod === m ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}` }, React.createElement(m === 'pix' ? QrCode : m === 'money' ? Banknote : CreditCard, { size: 24 }), React.createElement('span', { className: "text-xs font-bold uppercase" }, m === 'money' ? 'Dinheiro' : m === 'debit' ? 'Débito' : m === 'credit' ? 'Crédito' : 'PIX')))
                        ),
                        directMethod === 'credit' && React.createElement('div', { className: "space-y-4 pt-2 border-t border-slate-100" },
                            React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Entrada (Dinheiro/Pix)"), React.createElement(MoneyInput, { value: entryAmount, onChange: setEntryAmount })),
                            React.createElement('div', { className: "bg-slate-50 p-4 rounded-xl border border-slate-200" }, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-2" }, "Parcelas da Maquininha"), React.createElement('select', { className: "w-full p-3 border border-slate-200 rounded-lg", value: cardInstallments, onChange: e => setCardInstallments(e.target.value) }, React.createElement('option', { value: "1" }, "1x (À Vista)"), [2,3,4,5,6,7,8,9,10,11,12].map(n => React.createElement('option', { key: n, value: n }, `${n}x`))))
                        )
                    )
                )
            ),
            React.createElement('div', { className: "flex gap-3 mt-6 pt-4 border-t border-slate-100" },
                step === 1 && React.createElement(React.Fragment, null, React.createElement('button', { onClick: onClose, className: "flex-1 p-3 text-slate-500 font-bold" }, "Cancelar"), React.createElement('button', { onClick: () => setStep(2), disabled: !customerId, className: "flex-1 p-3 bg-slate-900 text-white font-bold rounded-xl disabled:opacity-50" }, "Próximo")),
                step === 2 && React.createElement(React.Fragment, null, React.createElement('button', { onClick: () => setStep(1), className: "flex-1 p-3 text-slate-500 font-bold" }, "Voltar"), React.createElement('button', { onClick: () => setStep(3), disabled: cart.length === 0, className: "flex-1 p-3 bg-slate-900 text-white font-bold rounded-xl disabled:opacity-50" }, "Pagamento")),
                step === 3 && React.createElement(React.Fragment, null, React.createElement('button', { onClick: () => setStep(2), className: "flex-1 p-3 text-slate-500 font-bold" }, "Voltar"), React.createElement('button', { onClick: handleFinish, className: "flex-1 p-3 bg-yellow-500 text-white font-bold rounded-xl shadow-lg shadow-yellow-200 hover:bg-yellow-600" }, "Finalizar"))
            )
        )
    );
};

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
    const [showDashFilter, setShowDashFilter] = useState(false);

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
    const [productModalData, setProductModalData] = useState({ open: false, data: null });
    const [customerModalData, setCustomerModalData] = useState({ open: false, data: null });
    const [expandedSaleId, setExpandedSaleId] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ open: false, type: null, id: null });
    const [editInstallmentModal, setEditInstallmentModal] = useState({ open: false, saleId: null, installmentIndex: null, data: null });

    useEffect(() => {
        const customersRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'customers');
        const productsRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'products');
        const salesRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'sales');
        
        const unsubC = onSnapshot(query(customersRef), s => setCustomers(s.docs.map(d => ({id:d.id, ...d.data()}))));
        const unsubP = onSnapshot(query(productsRef), s => setProducts(s.docs.map(d => ({id:d.id, ...d.data()}))));
        const unsubS = onSnapshot(query(salesRef), s => { setSales(s.docs.map(d => ({id:d.id, ...d.data()}))); setLoadingData(false); });
        return () => { unsubC(); unsubP(); unsubS(); };
    }, [user.uid]);

    // Auto-update dates when period changes
    useEffect(() => { if (dashPeriod === 'month') { setDashStartDate(getCurrentMonthStart()); setDashEndDate(getCurrentMonthEnd()); } }, [dashPeriod]);
    useEffect(() => { if (salesPeriod === 'month') { setSalesStart(getCurrentMonthStart()); setSalesEnd(getCurrentMonthEnd()); } }, [salesPeriod]);
    useEffect(() => { if (cashierPeriod === 'month') { setCashierStart(getCurrentMonthStart()); setCashierEnd(getCurrentMonthEnd()); } }, [cashierPeriod]);

    // Reset pagination when searching/filtering
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
        return list.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()));
    }, [customers, customerSearch]);

    const displayedSales = useMemo(() => {
        // 1. Pega vendas a prazo
        let baseSales = sales.filter(s => s.saleType === 'prazo' || !s.saleType);
        
        // 2. Filtra por pesquisa (Nome ou Produto)
        if (salesSearch) {
            const lower = salesSearch.toLowerCase();
            baseSales = baseSales.filter(s => 
                s.customerName.toLowerCase().includes(lower) || 
                s.items.some(i => i.productName.toLowerCase().includes(lower))
            );
        }

        // 3. Separa ATIVAS (Não Pagas) vs CONCLUÍDAS (Pagas)
        let active = baseSales.filter(s => s.status !== 'completed');
        let completed = baseSales.filter(s => s.status === 'completed');

        // 4. Aplica filtro de DATA apenas nas CONCLUÍDAS
        // O usuário quer ver todas as dívidas, independente da data.
        // Só quer filtrar por data o histórico de pagamentos já finalizados.
        completed = completed.filter(s => s.saleDate >= salesStart && s.saleDate <= salesEnd);

        // 5. Ordenação
        // Ativas: Pela data de vencimento da parcela mais antiga em aberto (prioridade de cobrança)
        active.sort((a, b) => {
            const getNextDue = (sale) => {
                const pending = sale.installments?.find(i => !i.paid);
                return pending ? pending.dueDate : '9999-99-99';
            };
            return getNextDue(a).localeCompare(getNextDue(b));
        });

        // Concluídas: Pela data da venda (mais recente primeiro)
        completed.sort((a, b) => b.saleDate.localeCompare(a.saleDate));

        return [...active, ...completed];
    }, [sales, salesSearch, salesStart, salesEnd]);

    const directSales = useMemo(() => {
        let list = sales.filter(s => s.saleType === 'direct');
        // Filter by Date
        list = list.filter(s => s.saleDate >= cashierStart && s.saleDate <= cashierEnd);
        if (cashierSearch) {
            const lower = cashierSearch.toLowerCase();
            list = list.filter(s => s.customerName.toLowerCase().includes(lower) || s.items.some(i => i.productName.toLowerCase().includes(lower)));
        }
        return list.sort((a, b) => b.saleDate.localeCompare(a.saleDate));
    }, [sales, cashierSearch, cashierStart, cashierEnd]);

    const dashboardTotals = useMemo(() => {
        const periodSales = sales.filter(s => s.saleDate >= dashStartDate && s.saleDate <= dashEndDate);
        const totalReceivable = sales.filter(s => s.saleType === 'prazo' || !s.saleType).reduce((acc, s) => acc + (s.installments || []).filter(i => !i.paid).reduce((sum, i) => sum + i.amount, 0), 0);
        let cashIn = 0;
        periodSales.forEach(s => { if (s.saleType === 'direct') cashIn += s.totalPrice; if (s.saleType === 'prazo' && s.entryAmount) cashIn += s.entryAmount; });
        sales.forEach(s => { if (s.installments) { s.installments.forEach(i => { if (i.paid && i.paidAt) { const paidDate = i.paidAt.split('T')[0]; if (paidDate >= dashStartDate && paidDate <= dashEndDate) { cashIn += i.amount; } } }); } });
        const today = getBrazilDateString();
        const totalOverdue = sales.reduce((acc, s) => { if (s.saleType === 'direct') return acc; return acc + (s.installments || []).filter(i => !i.paid && i.dueDate < today).reduce((sum, i) => sum + i.amount, 0); }, 0);
        const estimatedProfit = periodSales.reduce((acc, s) => acc + (s.totalPrice - (s.totalCost || 0)), 0);
        const periodCost = periodSales.reduce((acc, s) => acc + (s.totalCost || 0), 0);
        const realProfit = cashIn - periodCost;
        return { totalReceivable, totalReceived: cashIn, totalOverdue, estimatedProfit, realProfit, periodCost };
    }, [sales, dashStartDate, dashEndDate]);

    const handleSaveCustomer = async (data) => {
        if (customerModalData.data) await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'customers', customerModalData.data.id), data);
        else await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'customers'), { ...data, createdAt: serverTimestamp() });
        setCustomerModalData({ open: false, data: null });
    };
    const handleSaveProduct = async (data) => {
        if (productModalData.data) await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'products', productModalData.data.id), data);
        else await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'products'), { ...data, createdAt: serverTimestamp() });
        setProductModalData({ open: false, data: null });
    };
    const handleAddSale = async (data) => await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'sales'), data);
    
    const requestDelete = (type, id) => setDeleteModal({ open: true, type, id });
    const confirmDelete = async () => {
        const { type, id } = deleteModal;
        const col = type === 'sale' ? 'sales' : type === 'customer' ? 'customers' : 'products';
        await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, col, id));
        setDeleteModal({ open: false, type: null, id: null });
    };

    const handleTogglePaid = async (sale, index) => {
        const updatedInstallments = [...sale.installments];
        const current = updatedInstallments[index];
        updatedInstallments[index] = { ...current, paid: !current.paid, paidAt: !current.paid ? getBrazilISOString() : null };
        const allPaid = updatedInstallments.every(i => i.paid);
        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', sale.id), { installments: updatedInstallments, status: allPaid ? 'completed' : 'active' });
    };

    const saveEditedInstallment = async (newData) => {
        const { saleId, installmentIndex } = editInstallmentModal;
        const sale = sales.find(s => s.id === saleId);
        if(!sale) return;
        const updated = [...sale.installments];
        updated[installmentIndex] = newData;
        const allPaid = updated.every(i => i.paid);
        const newTotal = updated.reduce((acc, i) => acc + i.amount, 0) + (sale.entryAmount || 0);
        await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'sales', saleId), { installments: updated, totalPrice: newTotal, status: allPaid ? 'completed' : 'active' });
    };

    const getWhatsappLink = (phone, name, amount, date, storeName) => {
        const clean = phone?.replace(/\D/g, '');
        if (!clean) return '#';
        
        const today = getBrazilDateString();
        const firstName = name.split(' ')[0];
        const store = storeName || "nossa loja";
        let msg = "";

        if (date > today) {
            // Antecipado
            msg = `Olá ${firstName}, tudo bem? 👋\nPassando para lembrar que sua parcela de *${formatCurrency(amount)}* na *${store}* vence dia *${formatDate(date)}*.\nSe quiser antecipar, estamos à disposição! 🌟`;
        } else if (date === today) {
            // No Dia
            msg = `Oi ${firstName}! Hoje é o vencimento da sua parcela de *${formatCurrency(amount)}* na *${store}*. 🗓️\nPodemos confirmar o pagamento? Obrigado pela preferência! ✨`;
        } else {
            // Atrasado
            msg = `Olá ${firstName}. Notamos que sua parcela de *${formatCurrency(amount)}* na *${store}* venceu dia *${formatDate(date)}*. ⚠️\nPodemos agendar o pagamento para hoje e evitar juros? Aguardo seu retorno! 🤝`;
        }

        return `https://wa.me/55${clean}?text=${encodeURIComponent(msg)}`;
    };

    if (showAdminPanel) return React.createElement(AdminUsersPanel, { onClose: () => setShowAdminPanel(false) });

    // PAGINATION SLICING
    const getPaginatedData = (data, page) => {
        const start = (page - 1) * ITEMS_PER_PAGE;
        return data.slice(start, start + ITEMS_PER_PAGE);
    };

    const paginatedSales = getPaginatedData(displayedSales, salesPage);
    const paginatedCashier = getPaginatedData(directSales, cashierPage);
    const paginatedProducts = getPaginatedData(sortedProducts, productsPage);
    const paginatedCustomers = getPaginatedData(sortedCustomers, customersPage);

    return React.createElement('div', { className: "min-h-screen bg-slate-50 pb-24 font-sans text-slate-800" },
        React.createElement('header', { className: "bg-slate-900 text-white p-6 rounded-b-3xl shadow-lg sticky top-0 z-40" },
            React.createElement('div', { className: "flex justify-between items-center mb-4" },
                React.createElement('div', null,
                    React.createElement('h1', { className: "text-xl font-bold bg-gradient-to-r from-yellow-200 to-yellow-500 bg-clip-text text-transparent" }, userProfile?.storeName || "Minha Hinode"),
                    React.createElement('p', { className: "text-xs text-slate-400" }, `Olá, ${userProfile?.name?.split(' ')[0]}`)
                ),
                React.createElement('div', { className: "flex gap-2" },
                    userProfile?.role === 'admin' && React.createElement('button', { onClick: () => setShowAdminPanel(true), className: "bg-slate-800 p-2 rounded-full text-yellow-400 border border-slate-700" }, React.createElement(Users, { size: 20 })),
                    React.createElement('button', { onClick: onLogout, className: "bg-slate-800 p-2 rounded-full text-red-400 border border-slate-700" }, React.createElement(LogOut, { size: 20 })),
                     React.createElement('button', { onClick: () => setIsSaleModalOpen(true), className: "bg-yellow-500 hover:bg-yellow-400 text-slate-900 p-2 rounded-full shadow-lg transition-transform active:scale-95" }, React.createElement(PlusCircle, { size: 20 }))
                )
            ),
            React.createElement('div', { className: "flex space-x-1 overflow-x-auto no-scrollbar" },
                ['dashboard', 'sales', 'cashier', 'products', 'customers'].map((v) => (
                    React.createElement('button', { key: v, onClick: () => setView(v), className: `pb-2 px-3 whitespace-nowrap font-medium text-sm transition-colors ${view === v ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-slate-400'}` }, v === 'dashboard' ? 'Visão Geral' : v === 'sales' ? 'Cobranças' : v === 'cashier' ? 'Vendas' : v === 'products' ? 'Catálogo' : 'Clientes')
                ))
            )
        ),
        React.createElement('main', { className: "p-4 max-w-lg mx-auto" },
            loadingData ? React.createElement('div', { className: "flex justify-center py-10" }, "Carregando dados...") :
            view === 'dashboard' && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                React.createElement(DateRangeFilter, { period: dashPeriod, startDate: dashStartDate, endDate: dashEndDate, onPeriodChange: setDashPeriod, onStartChange: setDashStartDate, onEndChange: setDashEndDate }),
                React.createElement('div', { className: "bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center" }, React.createElement('div', null, React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase tracking-wider" }, "A Receber (Total)"), React.createElement('h3', { className: "text-3xl font-bold text-slate-800" }, formatCurrency(dashboardTotals.totalReceivable))), React.createElement('div', { className: "bg-blue-50 p-3 rounded-full" }, React.createElement(TrendingUp, { className: "text-blue-500" }))),
                React.createElement('div', { className: "bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center" }, React.createElement('div', null, React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase tracking-wider" }, "Entrou em Caixa"), React.createElement('h3', { className: "text-2xl font-bold text-emerald-600" }, formatCurrency(dashboardTotals.totalReceived)), React.createElement('p', { className: "text-xs text-slate-400 mt-1" }, "Neste período")), React.createElement('div', { className: "bg-emerald-50 p-3 rounded-full" }, React.createElement(Wallet, { className: "text-emerald-500" }))),
                React.createElement('div', { className: "bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center" }, React.createElement('div', null, React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase tracking-wider" }, "Custo de Vendas"), React.createElement('h3', { className: "text-2xl font-bold text-slate-800" }, formatCurrency(dashboardTotals.periodCost)), React.createElement('p', { className: "text-xs text-slate-400 mt-1" }, "Vendas neste período")), React.createElement('div', { className: "bg-orange-50 p-3 rounded-full" }, React.createElement(PackageMinus, { className: "text-orange-500" }))),
                React.createElement('div', { className: "grid grid-cols-2 gap-4" },
                    React.createElement('div', { className: "bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between" }, React.createElement('div', { className: "flex justify-between items-start mb-2" }, React.createElement('div', { className: "bg-yellow-50 p-2 rounded-lg" }, React.createElement(PieChart, { size: 20, className: "text-yellow-600" })), React.createElement(ArrowUpRight, { size: 16, className: "text-slate-300" })), React.createElement('div', null, React.createElement('p', { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider" }, "Lucro Estimado"), React.createElement('h3', { className: "text-lg font-bold text-slate-800" }, formatCurrency(dashboardTotals.estimatedProfit)))),
                    React.createElement('div', { className: "bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between" }, React.createElement('div', { className: "flex justify-between items-start mb-2" }, React.createElement('div', { className: "bg-purple-50 p-2 rounded-lg" }, React.createElement(BarChart3, { size: 20, className: "text-purple-600" })), React.createElement(ArrowDownRight, { size: 16, className: "text-slate-300" })), React.createElement('div', null, React.createElement('p', { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider" }, "Lucro Real (Cx)"), React.createElement('h3', { className: `text-lg font-bold ${dashboardTotals.realProfit >= 0 ? 'text-purple-600' : 'text-red-500'}` }, formatCurrency(dashboardTotals.realProfit))))
                ),
                React.createElement('div', { className: "bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center" }, React.createElement('div', null, React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase tracking-wider" }, "Atrasado"), React.createElement('h3', { className: "text-2xl font-bold text-red-500" }, formatCurrency(dashboardTotals.totalOverdue))), React.createElement('div', { className: "bg-red-50 p-3 rounded-full" }, React.createElement(AlertTriangle, { className: "text-red-500" })))
            ),
            view === 'sales' && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                React.createElement(DateRangeFilter, { period: salesPeriod, startDate: salesStart, endDate: salesEnd, onPeriodChange: setSalesPeriod, onStartChange: setSalesStart, onEndChange: setSalesEnd }),
                React.createElement('div', { className: "relative mb-4" }, React.createElement(Search, { className: "absolute left-3 top-3 text-slate-400", size: 18 }), React.createElement('input', { className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none", placeholder: "Buscar cobrança...", value: salesSearch, onChange: e => setSalesSearch(e.target.value.toUpperCase()) })),
                paginatedSales.length === 0 && React.createElement('p', { className: "text-center text-slate-400 py-10" }, "Nenhuma cobrança encontrada."),
                paginatedSales.map(sale => {
                    const isExpanded = expandedSaleId === sale.id;
                    const pendingAmount = sale.installments ? sale.installments.filter(i => !i.paid).reduce((acc, i) => acc + i.amount, 0) : 0;
                    const paidInstallments = sale.installments ? sale.installments.filter(i => i.paid).length : 0;
                    const totalInst = sale.installmentsCount || 0;
                    const profit = sale.totalPrice - (sale.totalCost || 0);
                    return React.createElement('div', { key: sale.id, className: `bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden transition-all ${sale.status === 'completed' ? 'opacity-60 bg-slate-50' : ''}` },
                        React.createElement('div', { className: "p-4 cursor-pointer hover:bg-slate-50", onClick: () => setExpandedSaleId(isExpanded ? null : sale.id) },
                            React.createElement('div', { className: "flex justify-between items-start mb-2" },
                                React.createElement('div', null, React.createElement('p', { className: "text-xs font-bold text-slate-500 uppercase" }, sale.customerName), React.createElement('p', { className: "font-bold text-slate-800 text-lg" }, formatCurrency(sale.totalPrice)), React.createElement('p', { className: "text-xs text-slate-400 mt-0.5" }, formatDate(sale.saleDate))),
                                React.createElement('span', { className: `px-2 py-1 rounded text-xs font-bold ${sale.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}` }, sale.status === 'completed' ? 'Quitado' : 'Aberto')
                            ),
                            React.createElement('div', { className: "flex justify-between items-center text-xs text-slate-500" }, React.createElement('span', { className: "flex items-center gap-1" }, React.createElement(CheckCircle, { size: 12, className: paidInstallments === totalInst ? 'text-emerald-500' : 'text-slate-400' }), `Pagos: ${paidInstallments}/${totalInst}`), React.createElement('span', null, pendingAmount > 0 ? `Resta: ${formatCurrency(pendingAmount)}` : 'Concluído')),
                            React.createElement('div', { className: "flex justify-center mt-2" }, React.createElement(ChevronDown, { size: 16, className: `text-slate-300 transition-transform ${isExpanded ? 'rotate-180' : ''}` }))
                        ),
                        isExpanded && React.createElement('div', { className: "bg-slate-50 border-t border-slate-100 p-4 space-y-4" },
                            React.createElement('div', { className: "bg-white p-3 rounded-lg border border-slate-200" }, React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase mb-2" }, "Itens"), sale.items.map((item, idx) => React.createElement('div', { key: idx, className: "flex justify-between text-sm py-1 border-b border-slate-100 last:border-0" }, React.createElement('span', null, item.quantity ? `${item.quantity}x ${item.productName}` : item.productName), React.createElement('span', { className: "font-mono text-slate-600" }, formatCurrency(item.price))))),
                            React.createElement('div', { className: "bg-white p-3 rounded-lg border border-slate-200 space-y-2" }, React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase mb-2" }, "Resumo Financeiro"), React.createElement('div', { className: "flex justify-between text-sm" }, React.createElement('span', { className: "text-slate-500" }, "Valor Total:"), React.createElement('span', { className: "font-bold text-slate-800" }, formatCurrency(sale.totalPrice))), React.createElement('div', { className: "flex justify-between text-sm" }, React.createElement('span', { className: "text-slate-500" }, "Custo Total:"), React.createElement('span', { className: "text-slate-800" }, formatCurrency(sale.totalCost || 0))), React.createElement('div', { className: "flex justify-between text-sm pt-2 border-t border-slate-100" }, React.createElement('span', { className: "font-bold text-emerald-600 flex items-center gap-1" }, React.createElement(Wallet, { size: 14 }), "Lucro Estimado:"), React.createElement('span', { className: "font-bold text-emerald-600" }, formatCurrency(profit)))),
                            sale.entryAmount > 0 && React.createElement('div', { className: "bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex justify-between items-center" }, React.createElement('div', { className: "flex items-center gap-2" }, React.createElement(Wallet, { size: 16, className: "text-emerald-500" }), React.createElement('span', { className: "text-sm font-bold text-emerald-800" }, "Entrada")), React.createElement('span', { className: "font-bold text-emerald-800" }, formatCurrency(sale.entryAmount))),
                            React.createElement('div', { className: "space-y-2" }, React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase" }, "Parcelamento"), sale.installments && sale.installments.map((inst, idx) => { const isOverdue = !inst.paid && inst.dueDate < getBrazilDateString(); let paidDisplayDate = ''; if (inst.paid && inst.paidAt) paidDisplayDate = formatDate(inst.paidAt); return React.createElement('div', { key: idx, className: "bg-white p-3 rounded-lg border border-slate-200 flex flex-col gap-2" }, React.createElement('div', { className: "flex justify-between items-center" }, React.createElement('div', { className: "flex items-center gap-3" }, React.createElement('button', { onClick: () => handleTogglePaid(sale, idx), className: `rounded-full p-1 transition-colors ${inst.paid ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}` }, React.createElement(CheckCircle, { size: 20 })), React.createElement('div', null, React.createElement('p', { className: "text-sm font-bold text-slate-700" }, `Parcela ${inst.number}`), React.createElement('div', { className: "flex flex-col" }, inst.paid && inst.paidAt ? React.createElement('span', { className: "text-xs text-emerald-600 font-bold" }, `Pago dia ${paidDisplayDate}`) : null, React.createElement('span', { className: `text-xs ${inst.paid ? 'text-slate-400' : isOverdue ? 'text-red-500 font-bold' : 'text-slate-500'}` }, inst.paid ? `Vencia dia ${formatDate(inst.dueDate)}` : `Vence dia ${formatDate(inst.dueDate)}`)))), React.createElement('p', { className: "font-bold text-slate-800" }, formatCurrency(inst.amount))), !inst.paid && React.createElement('div', { className: "flex gap-2 mt-1 pt-2 border-t border-slate-50" }, React.createElement('button', { onClick: () => setEditInstallmentModal({ open: true, saleId: sale.id, installmentIndex: idx, data: inst }), className: "flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded hover:bg-slate-200" }, React.createElement(Edit2, { size: 12 }), "Ajustar"), sale.customerPhone && React.createElement('a', { href: getWhatsappLink(sale.customerPhone, sale.customerName, inst.amount, inst.dueDate, userProfile.storeName), target: "_blank", rel: "noreferrer", className: "flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold text-white bg-green-500 rounded hover:bg-green-600" }, React.createElement(MessageCircle, { size: 12 }), "Cobrar"))); })),
                            React.createElement('button', { onClick: () => requestDelete('sale', sale.id), className: "w-full py-3 text-red-500 text-sm font-bold hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" }, "Excluir Venda")
                        )
                    );
                }),
                React.createElement(Pagination, { totalItems: displayedSales.length, itemsPerPage: ITEMS_PER_PAGE, currentPage: salesPage, onPageChange: setSalesPage })
            ),
            view === 'cashier' && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                React.createElement(DateRangeFilter, { period: cashierPeriod, startDate: cashierStart, endDate: cashierEnd, onPeriodChange: setCashierPeriod, onStartChange: setCashierStart, onEndChange: setCashierEnd }),
                React.createElement('div', { className: "relative mb-2" }, React.createElement(Search, { className: "absolute left-3 top-3 text-slate-400", size: 18 }), React.createElement('input', { className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none", placeholder: "Buscar venda...", value: cashierSearch, onChange: e => setCashierSearch(e.target.value.toUpperCase()) })),
                paginatedCashier.length === 0 ? React.createElement('p', { className: "text-center text-slate-400 py-10" }, "Nenhuma venda encontrada.") : paginatedCashier.map(sale => {
                    const isExpanded = expandedSaleId === sale.id;
                    const profit = sale.totalPrice - (sale.totalCost || 0);
                    return React.createElement('div', { key: sale.id, className: "bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden transition-all" },
                        React.createElement('div', { className: "p-4 cursor-pointer hover:bg-slate-50 flex flex-col gap-2", onClick: () => setExpandedSaleId(isExpanded ? null : sale.id) },
                            React.createElement('div', { className: "flex justify-between items-start" },
                                React.createElement('div', null, React.createElement('p', { className: "font-bold text-slate-800 text-lg" }, formatCurrency(sale.totalPrice)), React.createElement('p', { className: "text-sm text-slate-500" }, sale.customerName)),
                                React.createElement('div', { className: "flex flex-col items-end" },
                                    React.createElement('span', { className: "bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded capitalize flex items-center gap-1" }, sale.paymentMethod === 'pix' && React.createElement(QrCode, { size: 12 }), sale.paymentMethod === 'money' && React.createElement(Banknote, { size: 12 }), (sale.paymentMethod === 'credit' || sale.paymentMethod === 'debit') && React.createElement(CreditCard, { size: 12 }), sale.paymentMethod === 'credit' ? `Crédito ${sale.cardInstallments}x` : sale.paymentMethod === 'money' ? 'Dinheiro' : sale.paymentMethod === 'debit' ? 'Débito' : 'PIX'),
                                    React.createElement('span', { className: "text-xs text-slate-400 mt-1" }, formatDate(sale.saleDate))
                                )
                            ),
                            React.createElement('div', { className: "flex justify-center mt-1" }, React.createElement(ChevronDown, { size: 16, className: `text-slate-300 transition-transform ${isExpanded ? 'rotate-180' : ''}` }))
                        ),
                        isExpanded && React.createElement('div', { className: "bg-slate-50 border-t border-slate-100 p-4 space-y-4" },
                            React.createElement('div', { className: "bg-white p-3 rounded-lg border border-slate-200" }, React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase mb-2" }, "Itens da Venda"), sale.items.map((item, idx) => React.createElement('div', { key: idx, className: "flex justify-between text-sm py-1 border-b border-slate-100 last:border-0" }, React.createElement('span', null, item.quantity ? `${item.quantity}x ${item.productName}` : item.productName), React.createElement('div', { className: "text-right" }, React.createElement('span', { className: "font-mono text-slate-600 block" }, formatCurrency(item.price)))))),
                            React.createElement('div', { className: "bg-white p-3 rounded-lg border border-slate-200 space-y-2" }, React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase mb-2" }, "Resumo Financeiro"), React.createElement('div', { className: "flex justify-between text-sm" }, React.createElement('span', { className: "text-slate-500" }, "Valor Total:"), React.createElement('span', { className: "font-bold text-slate-800" }, formatCurrency(sale.totalPrice))), React.createElement('div', { className: "flex justify-between text-sm" }, React.createElement('span', { className: "text-slate-500" }, "Custo Total:"), React.createElement('span', { className: "text-slate-800" }, formatCurrency(sale.totalCost || 0))), React.createElement('div', { className: "flex justify-between text-sm pt-2 border-t border-slate-100" }, React.createElement('span', { className: "font-bold text-emerald-600 flex items-center gap-1" }, React.createElement(Wallet, { size: 14 }), "Lucro Estimado:"), React.createElement('span', { className: "font-bold text-emerald-600" }, formatCurrency(profit)))),
                            sale.paymentMethod === 'credit' && React.createElement('div', { className: "bg-emerald-50 p-3 rounded-lg border border-emerald-100 space-y-2" }, React.createElement('div', { className: "flex justify-between items-center text-sm" }, React.createElement('span', { className: "text-emerald-800" }, "Entrada (Dinheiro/Pix):"), React.createElement('span', { className: "font-bold text-emerald-800" }, formatCurrency(sale.entryAmount || 0))), React.createElement('div', { className: "flex justify-between items-center text-sm" }, React.createElement('span', { className: "text-emerald-800" }, `Passado no Cartão (${sale.cardInstallments}x):`), React.createElement('span', { className: "font-bold text-emerald-800" }, formatCurrency(sale.cardAmount || sale.totalPrice)))),
                            React.createElement('button', { onClick: () => requestDelete('sale', sale.id), className: "w-full py-3 text-red-500 text-sm font-bold hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" }, "Excluir Registro")
                        )
                    );
                }),
                React.createElement(Pagination, { totalItems: directSales.length, itemsPerPage: ITEMS_PER_PAGE, currentPage: cashierPage, onPageChange: setCashierPage })
            ),
            view === 'products' && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                React.createElement('div', { className: "flex gap-2 mb-2" }, React.createElement('div', { className: "relative flex-1" }, React.createElement(Search, { className: "absolute left-3 top-3 text-slate-400", size: 18 }), React.createElement('input', { className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none", placeholder: "Buscar produto...", value: productSearch, onChange: e => setProductSearch(e.target.value.toUpperCase()) })), React.createElement('button', { onClick: () => setProductModalData({open:true, data:null}), className: "bg-yellow-500 text-white p-3 rounded-xl font-bold shadow-lg shadow-yellow-200" }, "+")),
                paginatedProducts.map(p => React.createElement('div', { key: p.id, className: "bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm" }, React.createElement('div', { className: "flex items-center gap-3" }, React.createElement('span', { className: "text-xs font-mono bg-slate-100 text-slate-500 px-2 py-1 rounded" }, `#${p.code}`), React.createElement('span', { className: "font-bold text-slate-800" }, p.name)), React.createElement('div', { className: "flex gap-2" }, React.createElement('button', { onClick: () => setProductModalData({open: true, data: p}), className: "text-slate-300 hover:text-yellow-600 p-2" }, React.createElement(Edit2, { size: 18 })), React.createElement('button', { onClick: () => requestDelete('product', p.id), className: "text-slate-300 hover:text-red-500 p-2" }, React.createElement(Trash2, { size: 18 }))))),
                React.createElement(Pagination, { totalItems: sortedProducts.length, itemsPerPage: ITEMS_PER_PAGE, currentPage: productsPage, onPageChange: setProductsPage })
            ),
            view === 'customers' && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                React.createElement('div', { className: "flex gap-2 mb-2" }, React.createElement('div', { className: "relative flex-1" }, React.createElement(Search, { className: "absolute left-3 top-3 text-slate-400", size: 18 }), React.createElement('input', { className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none", placeholder: "Buscar cliente...", value: customerSearch, onChange: e => setCustomerSearch(e.target.value.toUpperCase()) })), React.createElement('button', { onClick: () => setCustomerModalData({open:true, data:null}), className: "bg-yellow-500 text-white p-3 rounded-xl font-bold shadow-lg shadow-yellow-200" }, "+")),
                paginatedCustomers.map(c => React.createElement('div', { key: c.id, className: "bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm" }, React.createElement('div', null, React.createElement('p', { className: "font-bold text-slate-800" }, c.name), React.createElement('p', { className: "text-xs text-slate-500" }, c.phone || 'Sem contato')), React.createElement('div', { className: "flex gap-2" }, React.createElement('button', { onClick: () => setCustomerModalData({open: true, data: c}), className: "text-slate-300 hover:text-yellow-600 p-2" }, React.createElement(Edit2, { size: 18 })), React.createElement('button', { onClick: () => requestDelete('customer', c.id), className: "text-slate-300 hover:text-red-500 p-2" }, React.createElement(Trash2, { size: 18 }))))),
                React.createElement(Pagination, { totalItems: sortedCustomers.length, itemsPerPage: ITEMS_PER_PAGE, currentPage: customersPage, onPageChange: setCustomersPage })
            )
        ),
        React.createElement(CustomerFormModal, { isOpen: customerModalData.open, onClose: () => setCustomerModalData({open:false, data:null}), initialData: customerModalData.data, onSave: handleSaveCustomer }),
        React.createElement(ProductFormModal, { isOpen: productModalData.open, onClose: () => setProductModalData({open:false, data:null}), initialData: productModalData.data, onSave: handleSaveProduct, lastCode: products.length > 0 ? products[0].code : null }),
        React.createElement(NewSaleModal, { isOpen: isSaleModalOpen, onClose: () => setIsSaleModalOpen(false), customers: customers, products: products, onSave: handleAddSale }),
        React.createElement(EditInstallmentModal, { isOpen: editInstallmentModal.open, onClose: () => setEditInstallmentModal({ open: false, saleId: null, data: null }), installment: editInstallmentModal.data, onSave: saveEditedInstallment }),
        React.createElement(ConfirmModal, { isOpen: deleteModal.open, title: "Tem certeza?", message: "O registro será apagado permanentemente.", onClose: () => setDeleteModal({ open: false, id: null, type: null }), onConfirm: confirmDelete })
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
                    
                    // AUTO-REPARO DE LOGIN: Se o usuário existe no Auth mas não no banco público, corrige agora.
                    const publicSnap = await getDoc(publicRef);
                    if (profileSnap.exists() && !publicSnap.exists()) {
                        console.log("Correção automática: Criando registro público faltante...");
                        await setDoc(publicRef, profileSnap.data());
                    }

                    if (profileSnap.exists()) {
                        const data = profileSnap.data();
                        if (data.approved) { setUserProfile(data); setUser(currentUser); } 
                        else { setAccessDenied(true); await signOut(auth); }
                    } else {
                        // Caso extremo: Usuário no Auth mas sem perfil nenhum
                        await signOut(auth);
                    }
                } catch (e) {
                    console.error("Erro na verificação de auth:", e);
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
