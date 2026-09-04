import React, { useState, useEffect } from 'https://esm.sh/react@18.2.0';
import { Store, AlertTriangle, Mail, UserCheck, Lock, UserCog, Shield, X, Search, Edit2, Trash2 } from 'https://esm.sh/lucide-react@0.292.0';
import { db, auth, APP_ID, ADMIN_EMAIL } from './firebase-config.js?v=94';
import { collection, query, doc, getDoc, onSnapshot, serverTimestamp, writeBatch, deleteField } from './firestore-runtime-v94.js?v=94';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { maskPhone, applyPixMask } from './utils.js';
import { Pagination } from './components.js';
import { showAppConfirm } from './ui-interactions-v81.js?v=94';

export const AuthScreen = () => {
    const [step, setStep] = useState('email'); 
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [storeName, setStoreName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const checkEmail = async () => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) return setError("Digite um e-mail.");
        setError('');
        setEmail(normalizedEmail);
        setStep('password');
    };

    const handleLogin = async () => {
        if (!password) return setError("Digite a senha.");
        setLoading(true);
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
        } catch (e) {
            setError("E-mail ou senha incorretos. Se ainda não tem cadastro, escolha Criar conta.");
            setLoading(false);
        }
    };

    const createInitialUserData = async (uid) => {
        const normalizedEmail = email.trim().toLowerCase();
        const privateProfile = {
            uid,
            email: normalizedEmail,
            name: fullName || "Usuário",
            storeName: storeName || "Minha Hinode",
            phone: phone || "",
            role: 'user',
            approved: false,
            status: 'pending',
            createdAt: serverTimestamp()
        };
        const directoryProfile = {
            uid,
            email: normalizedEmail,
            name: privateProfile.name,
            storeName: privateProfile.storeName,
            phone: privateProfile.phone,
            role: 'user',
            approved: false,
            status: 'pending',
            createdAt: serverTimestamp()
        };
        const batch = writeBatch(db);
        batch.set(doc(db, 'artifacts', APP_ID, 'users', uid, 'profile', 'info'), privateProfile);
        batch.set(doc(db, 'artifacts', APP_ID, 'public', 'data', 'all_users', uid), directoryProfile);
        await batch.commit();
    };

    const handleRegister = async () => {
        if (!fullName || !phone || !password) return setError("Preencha os campos obrigatórios.");
        if (password !== confirmPassword) return setError("As senhas não coincidem.");
        setLoading(true);
        setError('');
        
        try {
            const userCred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
            await createInitialUserData(userCred.user.uid);

        } catch (e) {
            if (e.code === 'auth/email-already-in-use') {
                setError("Este e-mail já possui uma conta. Volte e faça login com a senha cadastrada.");
                setLoading(false);
            } else {
                setError("Erro ao cadastrar: " + e.message);
                setLoading(false);
            }
        }
    };

    const handlePhoneChange = (e) => setPhone(maskPhone(e.target.value));

    return React.createElement('div', { className: "auth-screen" },
        React.createElement('div', { className: "auth-panel bg-white rounded-3xl p-8 w-full max-w-md animate-fade-in" },
            React.createElement('div', { className: "text-center mb-8" },
                React.createElement('div', { className: "w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4" },
                    React.createElement(Store, { className: "text-yellow-400", size: 32 })
                ),
                React.createElement('h1', { className: "text-2xl font-bold text-slate-800" }, "Acesso ao Sistema"),
                React.createElement('p', { className: "text-slate-400 text-sm" }, step === 'register' ? "Preencha seus dados" : "Identifique-se para continuar")
            ),
            error && React.createElement('div', { className: "bg-red-50 text-red-500 p-3 rounded-xl text-sm mb-4 flex items-center gap-2" }, React.createElement(AlertTriangle, { size: 16 }), error),
            step === 'email' && React.createElement('div', { className: "space-y-4" },
                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1 ml-1" }, "E-mail"), React.createElement('div', { className: "relative" }, React.createElement(Mail, { className: "absolute left-3 top-3 text-slate-400", size: 20 }), React.createElement('input', { autoFocus: true, type: "email", className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none", placeholder: "seu@email.com", value: email, onChange: e => setEmail(e.target.value) }))),
                React.createElement('button', { onClick: checkEmail, disabled: loading, className: "w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50" }, loading ? "Verificando..." : "Continuar")
            ),
            step === 'password' && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                React.createElement('div', { className: "flex items-center gap-2 bg-slate-50 p-2 rounded-lg mb-2" }, React.createElement(UserCheck, { size: 16, className: "text-green-500" }), React.createElement('span', { className: "text-sm text-slate-600 truncate flex-1" }, email), React.createElement('button', { onClick: () => { setStep('email'); setPassword(''); setError(''); }, className: "text-xs text-blue-500 font-bold hover:underline" }, "Trocar")),
                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1 ml-1" }, "Senha"), React.createElement('div', { className: "relative" }, React.createElement(Lock, { className: "absolute left-3 top-3 text-slate-400", size: 20 }), React.createElement('input', { autoFocus: true, type: "password", className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none", placeholder: "••••••••", value: password, onChange: e => setPassword(e.target.value) }))),
                React.createElement('button', { onClick: handleLogin, disabled: loading, className: "w-full py-3 bg-yellow-500 text-slate-900 font-bold rounded-xl hover:bg-yellow-400 transition-colors shadow-lg shadow-yellow-200 disabled:opacity-50" }, loading ? "Entrando..." : "Entrar"),
                React.createElement('button', { type: "button", onClick: () => { setStep('register'); setPassword(''); setError(''); }, disabled: loading, className: "w-full py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 disabled:opacity-50" }, "Criar uma conta")
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

export const AdminUsersPanel = ({ onClose }) => {
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'all_users'));
        let cleaningLegacyFields = false;
        const unsub = onSnapshot(q, (snap) => {
            setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            const legacyProfiles = snap.docs.filter(snapshot => {
                const data = snapshot.data();
                return ['pixType', 'pixKey', 'pixBank', 'pixName', 'paymentSettings', 'financialData'].some(field => Object.prototype.hasOwnProperty.call(data, field));
            });
            if (!cleaningLegacyFields && legacyProfiles.length > 0) {
                cleaningLegacyFields = true;
                (async () => {
                    try {
                        for (let start = 0; start < legacyProfiles.length; start += 400) {
                            const batch = writeBatch(db);
                            legacyProfiles.slice(start, start + 400).forEach(snapshot => batch.update(snapshot.ref, {
                                pixType: deleteField(), pixKey: deleteField(), pixBank: deleteField(), pixName: deleteField(),
                                paymentSettings: deleteField(), financialData: deleteField(), privacyMigratedAt: serverTimestamp()
                            }));
                            await batch.commit();
                        }
                    } catch (error) {
                        console.error('Não foi possível limpar campos privados antigos do diretório:', error);
                    } finally {
                        cleaningLegacyFields = false;
                    }
                })();
            }
        });
        return () => unsub();
    }, []);

    useEffect(() => setCurrentPage(1), [searchTerm]);

    const filteredUsers = users.filter(u => u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase()));
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleOpenEdit = async (directoryUser) => {
        try {
            const privateSnapshot = await getDoc(doc(db, 'artifacts', APP_ID, 'users', directoryUser.id, 'profile', 'info'));
            const privateData = privateSnapshot.exists() ? privateSnapshot.data() : {};
            setEditingUser({
                ...directoryUser,
                ...privateData,
                id: directoryUser.id,
                pixType: privateData.pixType || '',
                pixKey: privateData.pixKey || '',
                pixBank: privateData.pixBank || '',
                pixName: privateData.pixName || ''
            });
        } catch (error) {
            console.error('Não foi possível carregar o perfil privado:', error);
            alert('Não foi possível carregar os dados privados deste usuário.');
        }
    };

    const handleToggleStatus = async (user) => {
        const newStatus = !user.approved;
        const statusData = { approved: newStatus, status: newStatus ? 'active' : 'blocked', updatedAt: serverTimestamp() };
        const batch = writeBatch(db);
        batch.update(doc(db, 'artifacts', APP_ID, 'public', 'data', 'all_users', user.id), statusData);
        batch.set(doc(db, 'artifacts', APP_ID, 'users', user.id, 'profile', 'info'), statusData, { merge: true });
        await batch.commit();
    };

    const handleDeleteUser = async (userId) => {
        const confirmed = await showAppConfirm(
            "O acesso será revogado imediatamente e o cadastro sairá da lista. Os dados comerciais serão preservados.",
            { title: 'Revogar acesso do usuário?', confirmLabel: 'Revogar acesso', cancelLabel: 'Manter usuário', danger: true }
        );
        if (!confirmed) return;
        const batch = writeBatch(db);
        batch.set(doc(db, 'artifacts', APP_ID, 'users', userId, 'profile', 'info'), {
            approved: false,
            status: 'deleted',
            deletedAt: serverTimestamp(),
            deletedBy: auth.currentUser?.uid || null
        }, { merge: true });
        batch.delete(doc(db, 'artifacts', APP_ID, 'public', 'data', 'all_users', userId));
        await batch.commit();
    };

    const handleSaveEdit = async () => {
        if (!editingUser) return;
        const { id, name, storeName, phone, pixType, pixKey, pixBank, pixName } = editingUser;
        const updatedAt = serverTimestamp();
        const privateData = { name, storeName, phone, pixType, pixKey, pixBank, pixName, updatedAt };
        const directoryData = { name, storeName, phone, updatedAt };
        const batch = writeBatch(db);
        batch.update(doc(db, 'artifacts', APP_ID, 'public', 'data', 'all_users', id), directoryData);
        batch.set(doc(db, 'artifacts', APP_ID, 'users', id, 'profile', 'info'), privateData, { merge: true });
        await batch.commit();
        setEditingUser(null);
    };

    return React.createElement('div', { className: "admin-screen fixed inset-0 z-50 flex flex-col animate-fade-in" },
        React.createElement('div', { className: "admin-header text-white p-5 md:p-6 flex justify-between items-center shadow-md" },
            React.createElement('h2', { className: "text-xl font-bold flex items-center gap-2" }, React.createElement(Shield, { className: "text-yellow-400" }), "Gerenciar Usuários"),
            React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-slate-800 rounded-full" }, React.createElement(X, { size: 24 }))
        ),
        React.createElement('div', { className: "admin-toolbar p-4 border-b border-slate-100 bg-slate-50" },
            React.createElement('div', { className: "relative max-w-lg mx-auto" }, React.createElement(Search, { className: "absolute left-3 top-3 text-slate-400", size: 18 }), React.createElement('input', { className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none", placeholder: "Buscar por nome ou e-mail...", value: searchTerm, onChange: e => setSearchTerm(e.target.value) }))
        ),
        React.createElement('div', { className: "admin-content flex-1 overflow-y-auto p-4 md:p-6 bg-transparent" },
            React.createElement('div', { className: "admin-users-table max-w-5xl mx-auto list-shell" },
                paginatedUsers.map(u => {
                    const isMe = u.id === auth.currentUser?.uid || u.email === ADMIN_EMAIL;
                    return React.createElement('div', { key: u.id, className: "admin-user-row flex flex-col md:flex-row justify-between items-start md:items-center gap-4" },
                        React.createElement('div', { className: "flex-1" },
                            React.createElement('div', { className: "flex items-center gap-2" }, React.createElement('h3', { className: "font-bold text-slate-800" }, u.name), u.role === 'admin' && React.createElement('span', { className: "bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" }, "Admin"), !u.approved && React.createElement('span', { className: "bg-red-100 text-red-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" }, "Bloqueado")),
                            React.createElement('p', { className: "text-sm text-slate-500" }, u.email),
                            React.createElement('p', { className: "text-xs text-slate-400 mt-1" }, u.storeName || "Sem loja")
                        ),
                        React.createElement('div', { className: "flex items-center gap-2" }, !isMe && React.createElement('button', { onClick: () => handleToggleStatus(u), className: `px-4 py-2 rounded-lg font-bold text-sm ${u.approved ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}` }, u.approved ? "Bloquear" : "Permitir"), React.createElement('button', { onClick: () => handleOpenEdit(u), className: "p-2 text-slate-400 hover:text-blue-500" }, React.createElement(Edit2, { size: 18 })), !isMe && React.createElement('button', { onClick: () => handleDeleteUser(u.id), className: "p-2 text-slate-400 hover:text-red-500" }, React.createElement(Trash2, { size: 18 })))
                    );
                }),
                React.createElement(Pagination, { totalItems: filteredUsers.length, itemsPerPage: ITEMS_PER_PAGE, currentPage: currentPage, onPageChange: setCurrentPage })
            )
        ),
        editingUser && React.createElement('div', { className: "app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[60]" },
            React.createElement('div', { className: "app-modal-panel desktop-modal desktop-modal-user-edit bg-white p-6 rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto animate-fade-in" },
                React.createElement('h3', { className: "user-edit-title font-bold text-lg mb-4" }, "Editar Usuário"),
                React.createElement('input', { className: "w-full p-2 mb-2 border rounded", value: editingUser.name, onChange: e => setEditingUser({...editingUser, name: e.target.value}), placeholder: "Nome" }),
                React.createElement('input', { className: "w-full p-2 mb-2 border rounded", value: editingUser.storeName, onChange: e => setEditingUser({...editingUser, storeName: e.target.value}), placeholder: "Loja" }),
                React.createElement('input', { className: "w-full p-2 mb-4 border rounded", value: editingUser.phone, onChange: e => setEditingUser({...editingUser, phone: maskPhone(e.target.value)}), placeholder: "Telefone" }),
                
                React.createElement('div', { className: "user-edit-pix bg-slate-50 p-3 rounded-lg mb-4 space-y-2 border border-slate-100" },
                    React.createElement('p', { className: "text-xs font-bold text-slate-500 uppercase" }, "Chave PIX"),
                    React.createElement('select', { className: "w-full p-2 border rounded text-sm", value: editingUser.pixType, onChange: e => setEditingUser({...editingUser, pixType: e.target.value, pixKey: ''}) },
                        React.createElement('option', { value: "" }, "Selecione o Tipo..."),
                        React.createElement('option', { value: "cpf_cnpj" }, "CPF / CNPJ"),
                        React.createElement('option', { value: "phone" }, "Telefone"),
                        React.createElement('option', { value: "email" }, "E-mail"),
                        React.createElement('option', { value: "random" }, "Chave Aleatória")
                    ),
                    React.createElement('input', { className: "w-full p-2 border rounded text-sm", value: applyPixMask(editingUser.pixKey, editingUser.pixType), onChange: e => setEditingUser({...editingUser, pixKey: e.target.value}), placeholder: "Chave PIX", disabled: !editingUser.pixType }),
                    React.createElement('input', { className: "w-full p-2 border rounded text-sm", value: editingUser.pixBank, onChange: e => setEditingUser({...editingUser, pixBank: e.target.value}), placeholder: "Banco" }),
                    React.createElement('input', { className: "w-full p-2 border rounded text-sm", value: editingUser.pixName, onChange: e => setEditingUser({...editingUser, pixName: e.target.value}), placeholder: "Titular" })
                ),

                React.createElement('div', { className: "desktop-modal-footer user-edit-actions flex gap-2" }, React.createElement('button', { onClick: () => setEditingUser(null), className: "flex-1 p-2 text-slate-500 font-bold" }, "Cancelar"), React.createElement('button', { onClick: handleSaveEdit, className: "flex-1 p-2 bg-slate-900 text-white font-bold rounded" }, "Salvar"))
            )
        )
    );
};
