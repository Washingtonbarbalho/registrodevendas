import {
  React, useState, useEffect, useMemo, useRef,
  Users, ShoppingBag, PlusCircle, CheckCircle, MessageCircle, Trash2, ChevronDown, ChevronUp, Package, TrendingUp, Edit2, AlertTriangle, Wallet, Search, CreditCard, QrCode, Banknote, Calendar, Filter, X, PieChart, BarChart3, ArrowUpRight, ArrowDownRight, PackageMinus, LogOut, Lock, Mail, Phone, Store, UserCog, UserCheck, UserX, Shield, ChevronLeft, ChevronRight, MoreHorizontal, LayoutGrid, AlertCircle, RefreshCw, Clock, Bell, History, FileText, XCircle, User, Smartphone, Copy, Tag, Info, MapPin, BadgePercent, Receipt,
  db, auth, APP_ID, ADMIN_EMAIL,
  collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged
} from '../core.js';

import { formatDate } from './utils.js';
import { Pagination } from './ui.js';

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
        const { id, name, storeName, phone, pixType, pixKey, pixBank, pixName } = editingUser;
        const updateData = { name, storeName, phone, pixType, pixKey, pixBank, pixName };
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
                        React.createElement('div', { className: "flex items-center gap-2" }, !isMe && React.createElement('button', { onClick: () => handleToggleStatus(u), className: `px-4 py-2 rounded-lg font-bold text-sm ${u.approved ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}` }, u.approved ? "Bloquear" : "Permitir"), React.createElement('button', { onClick: () => setEditingUser({...u, pixType: u.pixType||'', pixKey: u.pixKey||'', pixBank: u.pixBank||'', pixName: u.pixName||''}), className: "p-2 text-slate-400 hover:text-blue-500" }, React.createElement(Edit2, { size: 18 })), !isMe && React.createElement('button', { onClick: () => handleDeleteUser(u.id), className: "p-2 text-slate-400 hover:text-red-500" }, React.createElement(Trash2, { size: 18 })))
                    );
                }),
                React.createElement(Pagination, { totalItems: filteredUsers.length, itemsPerPage: ITEMS_PER_PAGE, currentPage: currentPage, onPageChange: setCurrentPage })
            )
        ),
        editingUser && React.createElement('div', { className: "fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]" },
            React.createElement('div', { className: "bg-white p-6 rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto animate-fade-in" },
                React.createElement('h3', { className: "font-bold text-lg mb-4" }, "Editar Usuário"),
                React.createElement('input', { className: "w-full p-2 mb-2 border rounded", value: editingUser.name, onChange: e => setEditingUser({...editingUser, name: e.target.value}), placeholder: "Nome" }),
                React.createElement('input', { className: "w-full p-2 mb-2 border rounded", value: editingUser.storeName, onChange: e => setEditingUser({...editingUser, storeName: e.target.value}), placeholder: "Loja" }),
                React.createElement('input', { className: "w-full p-2 mb-4 border rounded", value: editingUser.phone, onChange: e => setEditingUser({...editingUser, phone: maskPhone(e.target.value)}), placeholder: "Telefone" }),
                
                React.createElement('div', { className: "bg-slate-50 p-3 rounded-lg mb-4 space-y-2 border border-slate-100" },
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

                React.createElement('div', { className: "flex gap-2" }, React.createElement('button', { onClick: () => setEditingUser(null), className: "flex-1 p-2 text-slate-500 font-bold" }, "Cancelar"), React.createElement('button', { onClick: handleSaveEdit, className: "flex-1 p-2 bg-slate-900 text-white font-bold rounded" }, "Salvar"))
            )
        )
    );
};

export { AdminUsersPanel };
