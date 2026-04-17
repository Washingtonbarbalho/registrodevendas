import {
  React, useState, useEffect, useMemo, useRef,
  Users, ShoppingBag, PlusCircle, CheckCircle, MessageCircle, Trash2, ChevronDown, ChevronUp, Package, TrendingUp, Edit2, AlertTriangle, Wallet, Search, CreditCard, QrCode, Banknote, Calendar, Filter, X, PieChart, BarChart3, ArrowUpRight, ArrowDownRight, PackageMinus, LogOut, Lock, Mail, Phone, Store, UserCog, UserCheck, UserX, Shield, ChevronLeft, ChevronRight, MoreHorizontal, LayoutGrid, AlertCircle, RefreshCw, Clock, Bell, History, FileText, XCircle, User, Smartphone, Copy, Tag, Info, MapPin, BadgePercent, Receipt,
  db, auth, APP_ID, ADMIN_EMAIL,
  collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged
} from '../core.js';

import { maskPhone } from './utils.js';

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
                setStep('register');
            }
        } catch (e) {
            console.error("CheckEmail Error:", e);
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
        await setDoc(doc(db, 'artifacts', APP_ID, 'users', uid, 'profile', 'info'), userData);
        await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'all_users', uid), userData);
    };

    const handleRegister = async () => {
        if (!fullName || !phone || !password) return setError("Preencha os campos obrigatórios.");
        if (password !== confirmPassword) return setError("As senhas não coincidem.");
        setLoading(true);
        setError('');
        
        try {
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            await forceCreateUserData(userCred.user.uid);

        } catch (e) {
            if (e.code === 'auth/email-already-in-use') {
                try {
                    const userCred = await signInWithEmailAndPassword(auth, email, password);
                    await forceCreateUserData(userCred.user.uid);
                    setRecoveryMode(true);
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

export { AuthScreen };
