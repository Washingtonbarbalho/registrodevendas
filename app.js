import React, { useState, useEffect, useMemo } from 'https://esm.sh/react@18.2.0';
import { createRoot } from 'https://esm.sh/react-dom@18.2.0/client';
import { 
    Users, ShoppingBag, PlusCircle, CheckCircle, MessageCircle, Trash2, 
    ChevronDown, ChevronUp, Package, TrendingUp, Edit2, AlertTriangle, 
    Wallet, Search, CreditCard, QrCode, Banknote, Calendar, Filter, X,
    PieChart, BarChart3, ArrowUpRight, ArrowDownRight, PackageMinus,
    LogOut, Lock, Mail, Phone, Store, UserCog, UserCheck, UserX, Shield,
    ChevronLeft, ChevronRight, MoreHorizontal, LayoutGrid, AlertCircle, RefreshCw,
    Clock, Bell, History, FileText, XCircle, User, Smartphone, Copy, Tag, Info
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
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const parseMoney = (valStr) => {
    if (!valStr) return 0;
    if (typeof valStr === 'number') return valStr;
    const clean = valStr.replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
};

const maskMoney = (value) => {
    if(value === undefined || value === null) return "0,00";
    let v = String(value).replace(/\D/g, "");
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

const maskCpfCnpj = (v) => {
    v = v.replace(/\D/g, "");
    if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
        v = v.replace(/^(\d{2})(\d)/, "$1.$2");
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
        v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
        v = v.replace(/(\d{4})(\d)/, "$1-$2");
    }
    return v;
};

const applyPixMask = (val, type) => {
    if (!val) return '';
    if (type === 'cpf_cnpj') return maskCpfCnpj(val);
    if (type === 'phone') return maskPhone(val);
    return val;
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

const MoneyInput = ({ value, onChange, placeholder, className, autoFocus, disabled }) => {
    const [display, setDisplay] = useState(typeof value === 'number' ? maskMoney((value * 100).toFixed(0)) : value);
    
    useEffect(() => { 
        if (typeof value === 'number') {
            setDisplay(maskMoney((value * 100).toFixed(0))); 
        } else if (typeof value === 'string') {
            setDisplay(value);
        }
    }, [value]);

    const handleChange = (e) => { const m = maskMoney(e.target.value); setDisplay(m); onChange(m); };
    return React.createElement('div', { className: "relative w-full" },
        React.createElement('span', { className: `absolute left-3 top-3 font-bold ${disabled ? 'text-slate-300' : 'text-slate-400'}` }, "R$"),
        React.createElement('input', { autoFocus: autoFocus, disabled: disabled, type: "text", inputMode: "numeric", className: className, placeholder: placeholder || "0,00", value: display, onChange: handleChange })
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

// --- MODAIS DE NEGÓCIO ---

const WhatsAppChooserModal = ({ isOpen, onClose, phone, message }) => {
    if (!isOpen) return null;

    const handleOpen = (type) => {
        const encodedMsg = encodeURIComponent(message);
        const cleanPhone = phone?.replace(/\D/g, '') || '';

        if (type === 'whatsapp') {
            window.open(`https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodedMsg}`, '_blank');
        } else if (type === 'copy') {
            navigator.clipboard.writeText(message);
        }
        onClose();
    };

    return React.createElement('div', { className: "fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[90] backdrop-blur-sm" },
        React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in text-center" },
            React.createElement('h3', { className: "text-lg font-bold text-slate-800 mb-1" }, "Enviar Mensagem"),
            React.createElement('p', { className: "text-sm text-slate-500 mb-6" }, "Escolha a ação desejada para a mensagem."),
            React.createElement('div', { className: "space-y-3" },
                React.createElement('button', { onClick: () => handleOpen('whatsapp'), className: "w-full p-4 bg-green-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-green-600 shadow-sm" }, React.createElement(MessageCircle, { size: 20 }), "Abrir no WhatsApp"),
                React.createElement('button', { onClick: () => handleOpen('copy'), className: "w-full p-4 bg-slate-100 text-slate-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200" }, React.createElement(Copy, { size: 20 }), "Copiar Mensagem")
            ),
            React.createElement('button', { onClick: onClose, className: "mt-4 p-2 text-slate-400 hover:text-slate-600 w-full font-bold" }, "Cancelar")
        )
    );
};


const UserProfileModal = ({ isOpen, onClose, userProfile, onSave }) => {
    const [name, setName] = useState('');
    const [storeName, setStoreName] = useState('');
    const [phone, setPhone] = useState('');
    const [pixType, setPixType] = useState('');
    const [pixKey, setPixKey] = useState('');
    const [pixBank, setPixBank] = useState('');
    const [pixName, setPixName] = useState('');

    useEffect(() => {
        if (isOpen && userProfile) {
            setName(userProfile.name || '');
            setStoreName(userProfile.storeName || '');
            setPhone(userProfile.phone || '');
            setPixType(userProfile.pixType || '');
            setPixKey(userProfile.pixKey || '');
            setPixBank(userProfile.pixBank || '');
            setPixName(userProfile.pixName || '');
        }
    }, [isOpen, userProfile]);

    const handleSave = () => {
        onSave({ ...userProfile, name, storeName, phone, pixType, pixKey, pixBank, pixName });
    };

    if (!isOpen) return null;

    return React.createElement('div', { className: "fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[80] backdrop-blur-sm" },
        React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl animate-fade-in" },
            React.createElement('div', { className: "p-4 border-b border-slate-100 flex justify-between items-center" },
                React.createElement('h3', { className: "font-bold text-lg text-slate-800 flex items-center gap-2" }, React.createElement(User, { className: "text-yellow-500" }), "Meu Perfil"),
                React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-slate-100 rounded-full" }, React.createElement(X, { size: 20 }))
            ),
            React.createElement('div', { className: "flex-1 overflow-y-auto p-4 space-y-4" },
                React.createElement('div', { className: "space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100" },
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase" }, "Dados da Loja"),
                    React.createElement('input', { className: "w-full p-3 border border-slate-200 rounded-lg", value: name, onChange: e => setName(e.target.value), placeholder: "Seu Nome" }),
                    React.createElement('input', { className: "w-full p-3 border border-slate-200 rounded-lg", value: storeName, onChange: e => setStoreName(e.target.value), placeholder: "Nome da Loja" }),
                    React.createElement(PhoneInput, { className: "w-full p-3 border border-slate-200 rounded-lg", value: phone, onChange: setPhone, placeholder: "Seu WhatsApp" })
                ),
                React.createElement('div', { className: "space-y-3 bg-emerald-50 p-4 rounded-xl border border-emerald-100" },
                    React.createElement('p', { className: "text-xs font-bold text-emerald-600 uppercase flex items-center gap-1" }, React.createElement(QrCode, { size: 14 }), "Configuração do PIX (Para Cobranças)"),
                    React.createElement('select', { className: "w-full p-3 border border-slate-200 rounded-lg bg-white", value: pixType, onChange: e => { setPixType(e.target.value); setPixKey(''); } },
                        React.createElement('option', { value: "" }, "Selecione o Tipo de Chave..."),
                        React.createElement('option', { value: "cpf_cnpj" }, "CPF / CNPJ"),
                        React.createElement('option', { value: "phone" }, "Telefone"),
                        React.createElement('option', { value: "email" }, "E-mail"),
                        React.createElement('option', { value: "random" }, "Chave Aleatória")
                    ),
                    React.createElement('input', { className: "w-full p-3 border border-slate-200 rounded-lg bg-white", value: applyPixMask(pixKey, pixType), onChange: e => setPixKey(e.target.value), placeholder: "Chave PIX", disabled: !pixType }),
                    React.createElement('input', { className: "w-full p-3 border border-slate-200 rounded-lg bg-white", value: pixBank, onChange: e => setPixBank(e.target.value), placeholder: "Nome do Banco (Ex: NuBank)" }),
                    React.createElement('input', { className: "w-full p-3 border border-slate-200 rounded-lg bg-white", value: pixName, onChange: e => setPixName(e.target.value), placeholder: "Nome Completo do Titular" })
                )
            ),
            React.createElement('div', { className: "p-4 border-t border-slate-100 flex gap-2" },
                React.createElement('button', { onClick: onClose, className: "flex-1 p-3 text-slate-500 font-bold rounded-lg hover:bg-slate-50" }, "Cancelar"),
                React.createElement('button', { onClick: handleSave, className: "flex-1 p-3 bg-slate-900 text-white font-bold rounded-lg shadow-sm" }, "Salvar Alterações")
            )
        )
    );
};


const PaymentConfirmationModal = ({ isOpen, onClose, onConfirm, installment, isLast }) => {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(getBrazilDateString());
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && installment) {
            setAmount(maskMoney((installment.amount * 100).toFixed(0)));
            setDate(getBrazilDateString());
            setError('');
        }
    }, [isOpen, installment]);

    const handleConfirm = () => {
        const val = parseMoney(amount);
        if (val <= 0) {
            setError('Digite um valor válido.');
            return;
        }
        
        const valCents = Math.round(val * 100);
        const instAmtCents = Math.round(installment.amount * 100);

        if (isLast && valCents > instAmtCents) {
            setError('Na última parcela não é permitido pagar valor maior que o restante.');
            return;
        }
        onConfirm(val, date);
    };

    if (!isOpen || !installment) return null;

    return React.createElement('div', { className: "fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[75] backdrop-blur-sm" },
        React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in" },
            React.createElement('div', { className: "text-center mb-4" },
                React.createElement('div', { className: "w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3" },
                    React.createElement(Wallet, { className: "text-emerald-600", size: 24 })
                ),
                React.createElement('h3', { className: "text-lg font-bold text-slate-800" }, "Confirmar Pagamento"),
                React.createElement('p', { className: "text-sm text-slate-500" }, `Parcela ${installment.number} - Restante: ${formatCurrency(installment.amount)}`)
            ),

            error && React.createElement('div', { className: "bg-red-50 text-red-500 text-xs p-3 rounded-lg mb-4 flex items-center gap-2" },
                React.createElement(AlertTriangle, { size: 14 }), error
            ),

            React.createElement('div', { className: "space-y-4" },
                React.createElement('div', null,
                    React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Valor Pago (R$)"),
                    React.createElement(MoneyInput, { autoFocus: true, value: amount, onChange: setAmount, className: "w-full p-3 pl-10 border border-slate-200 rounded-xl text-lg font-bold text-slate-800" })
                ),
                React.createElement('div', null,
                    React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Data do Pagamento"),
                    React.createElement('input', { type: "date", className: "w-full p-3 border border-slate-200 rounded-xl", value: date, onChange: e => setDate(e.target.value) })
                )
            ),

            React.createElement('div', { className: "flex gap-3 mt-6" },
                React.createElement('button', { onClick: onClose, className: "flex-1 p-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl" }, "Cancelar"),
                React.createElement('button', { onClick: handleConfirm, className: "flex-1 p-3 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-600" }, "Confirmar")
            )
        )
    );
};


const InstallmentListModal = ({ isOpen, onClose, title, items, onPay, onOpenWA }) => {
    if (!isOpen) return null;

    const groupedItems = items.reduce((acc, item) => {
        if (!acc[item.customerName]) acc[item.customerName] = [];
        acc[item.customerName].push(item);
        return acc;
    }, {});

    return React.createElement('div', { className: "fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[80] backdrop-blur-sm" },
        React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl animate-fade-in" },
            React.createElement('div', { className: "p-4 border-b border-slate-100 flex justify-between items-center" },
                React.createElement('h3', { className: "font-bold text-lg text-slate-800 flex items-center gap-2" }, 
                    React.createElement(Clock, { className: "text-yellow-600", size: 20 }), 
                    title
                ),
                React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-slate-100 rounded-full" }, React.createElement(X, { size: 20 }))
            ),
            React.createElement('div', { className: "flex-1 overflow-y-auto p-4 space-y-4" },
                items.length === 0 ? React.createElement('p', { className: "text-center text-slate-400 py-4" }, "Nenhuma parcela encontrada.") :
                Object.keys(groupedItems).map(customerName => (
                    React.createElement('div', { key: customerName, className: "space-y-2" },
                        React.createElement('div', { className: "flex items-center gap-2 px-1" },
                            React.createElement(Users, { size: 14, className: "text-slate-400" }),
                            React.createElement('h4', { className: "text-xs font-bold text-slate-500 uppercase" }, customerName)
                        ),
                        groupedItems[customerName].map((item, idx) => (
                            React.createElement('div', { key: `${item.saleId}-${item.installmentIndex}`, className: "bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center gap-2" },
                                React.createElement('div', null,
                                    React.createElement('div', { className: "flex items-center gap-2" },
                                        React.createElement('p', { className: "font-bold text-slate-800" }, formatCurrency(item.amount)),
                                        React.createElement('span', { className: "text-[10px] bg-white border border-slate-200 px-1.5 rounded text-slate-500" }, `Parcela ${item.number}`)
                                    ),
                                    React.createElement('p', { className: `text-xs ${item.isOverdue ? 'text-red-500 font-bold' : 'text-slate-400'}` }, 
                                        item.isOverdue ? `Venceu ${formatDate(item.dueDate)}` : `Vence ${formatDate(item.dueDate)}`
                                    )
                                ),
                                React.createElement('div', { className: "flex gap-2" },
                                    item.customerPhone && React.createElement('button', { 
                                        onClick: () => onOpenWA('cobranca', item.sale, item, null),
                                        className: "p-2 bg-green-500 text-white rounded-lg shadow-sm hover:bg-green-600 transition-colors"
                                    }, React.createElement(MessageCircle, { size: 16 })),
                                    React.createElement('button', { 
                                        onClick: () => onPay(item),
                                        className: "p-2 bg-slate-800 text-white rounded-lg shadow-sm hover:bg-slate-700 transition-colors"
                                    }, React.createElement(CheckCircle, { size: 16 }))
                                )
                            )
                        ))
                    )
                ))
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

const EditInstallmentModal = ({ isOpen, onClose, installment, onSave }) => {
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');
    useEffect(() => { if (installment) { setAmount(maskMoney((installment.amount * 100).toFixed(0))); setDueDate(installment.dueDate); } }, [installment]);
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

// --- MODAL DE VISUALIZAÇÃO DO PRODUTO (Somente Leitura) ---
const ProductDetailsModal = ({ isOpen, onClose, product }) => {
    if (!isOpen || !product) return null;

    const today = getBrazilDateString();
    const isPromoActive = product.isPromo && today >= product.promoStart && today <= product.promoEnd;

    return React.createElement('div', { className: "fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto" },
        React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in" },
            React.createElement('div', { className: "flex justify-between items-center mb-6 border-b border-slate-100 pb-4" },
                React.createElement('h3', { className: "text-lg font-bold flex items-center gap-2 text-slate-800" }, React.createElement(Package, { className: "text-yellow-500" }), "Detalhes do Produto"),
                React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-slate-100 rounded-full text-slate-400" }, React.createElement(X, { size: 20 }))
            ),
            
            React.createElement('div', { className: "space-y-4" },
                React.createElement('div', null,
                    React.createElement('span', { className: "text-xs font-mono bg-slate-100 text-slate-500 px-2 py-1 rounded" }, `#${product.code}`),
                    React.createElement('h2', { className: "text-xl font-bold text-slate-800 mt-2 leading-tight" }, product.name),
                    product.description && React.createElement('p', { className: "text-sm text-slate-500 mt-1" }, product.description)
                ),

                React.createElement('div', { className: "grid grid-cols-2 gap-4" },
                    React.createElement('div', { className: "bg-slate-50 p-3 rounded-xl border border-slate-100" },
                        React.createElement('p', { className: "text-[10px] uppercase font-bold text-slate-400 mb-1" }, "Preço Base"),
                        React.createElement('p', { className: "font-bold text-slate-800 text-lg" }, formatCurrency(product.salePrice))
                    ),
                    React.createElement('div', { className: "bg-slate-50 p-3 rounded-xl border border-slate-100" },
                        React.createElement('p', { className: "text-[10px] uppercase font-bold text-slate-400 mb-1" }, "Estoque Atual"),
                        React.createElement('p', { className: `font-bold text-lg ${product.quantity <= 0 ? 'text-red-500' : 'text-slate-800'}` }, `${product.quantity} un.`)
                    )
                ),

                isPromoActive && React.createElement('div', { className: "bg-purple-50 p-4 rounded-xl border border-purple-200" },
                    React.createElement('p', { className: "text-xs font-bold text-purple-700 uppercase flex items-center gap-1 mb-2" }, React.createElement(Tag, { size: 14 }), "Promoção Ativa"),
                    React.createElement('div', { className: "flex justify-between items-end" },
                        React.createElement('div', null,
                            React.createElement('p', { className: "text-[10px] text-purple-500 font-bold uppercase" }, "Valor Especial"),
                            React.createElement('p', { className: "font-bold text-purple-700 text-2xl" }, formatCurrency(product.promoPrice))
                        ),
                        React.createElement('div', { className: "text-right" },
                            React.createElement('p', { className: "text-[10px] text-purple-500 font-bold uppercase" }, "Válido até"),
                            React.createElement('p', { className: "font-bold text-purple-600 text-sm" }, formatDate(product.promoEnd))
                        )
                    )
                ),

                React.createElement('div', { className: "bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-start gap-3 mt-4" },
                    React.createElement(Info, { size: 18, className: "text-blue-500 shrink-0 mt-0.5" }),
                    React.createElement('p', { className: "text-xs text-blue-700" }, "Para editar preços, descrições ou estoque, acesse o sistema Gestor de Catálogo independente.")
                )
            ),

            React.createElement('div', { className: "mt-6" },
                React.createElement('button', { onClick: onClose, className: "w-full p-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg" }, "Fechar")
            )
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
    const [currentCost, setCurrentCost] = useState(''); // Mantido na lógica de trás para o lucro
    const [currentPrice, setCurrentPrice] = useState('');
    const [saleDate, setSaleDate] = useState(getBrazilDateString()); 
    const [saleType, setSaleType] = useState('prazo');
    const [frequency, setFrequency] = useState('monthly');
    const [installmentsCount, setInstallmentsCount] = useState(1);
    const [firstDueDate, setFirstDueDate] = useState('');
    const [entryAmount, setEntryAmount] = useState('');
    const [directMethod, setDirectMethod] = useState('pix');
    const [cardInstallments, setCardInstallments] = useState(1);
    const [showCustomerList, setShowCustomerList] = useState(false);
    const [showProductList, setShowProductList] = useState(false);

    useEffect(() => { if (isOpen) { const today = getBrazilDateString(); setSaleDate(today); setFirstDueDate(addDays(today, 30)); setStep(1); setCart([]); setCustomerId(''); setEntryAmount(''); setSaleType('prazo'); setCustomerSearch(''); setProductSearch(''); setCurrentQty(1); setCurrentCost(''); setCurrentPrice(''); setShowCustomerList(false); setShowProductList(false); } }, [isOpen]);
    useEffect(() => { let daysToAdd = 30; if (frequency === 'weekly') daysToAdd = 7; else if (frequency === 'biweekly') daysToAdd = 15; setFirstDueDate(addDays(saleDate, daysToAdd)); }, [frequency, saleDate]);

    const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()));
    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.includes(productSearch));
    const totalCartValue = cart.reduce((acc, item) => acc + item.price, 0);
    const entryValue = parseMoney(entryAmount) || 0;
    const totalRemaining = Math.max(0, totalCartValue - entryValue);

    const handleSelectProduct = (p) => {
        setSelectedProductId(p.id); 
        setProductSearch(`#${p.code} - ${p.name}`); 
        setShowProductList(false);
        
        const cost = p.costPrice || 0;
        let price = p.salePrice || 0;
        
        const today = getBrazilDateString();
        if(p.isPromo && p.promoStart && p.promoEnd && today >= p.promoStart && today <= p.promoEnd) {
            price = p.promoPrice || 0;
        }

        setCurrentCost(maskMoney((cost * 100).toFixed(0)));
        setCurrentPrice(maskMoney((price * 100).toFixed(0)));
    };

    const handleAddItem = () => {
        const qty = parseInt(currentQty) || 1;
        const unitCost = parseMoney(currentCost);
        const unitPrice = parseMoney(currentPrice);
        if(!selectedProductId || unitPrice <= 0 || qty <= 0) return;
        
        const prod = products.find(p => p.id === selectedProductId);
        const totalLineCost = unitCost * qty;
        const totalLinePrice = unitPrice * qty;
        
        const newItem = { 
            tempId: Date.now(), 
            productId: prod.id, 
            productName: prod.name, 
            productCode: prod.code, 
            quantity: qty, 
            cost: totalLineCost, 
            price: totalLinePrice, 
            unitPrice: unitPrice, 
            unitCost: unitCost 
        };
        
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
                        React.createElement('div', { className: "relative" },
                            React.createElement('div', { className: "relative" },
                                React.createElement(Search, { className: "absolute left-3 top-3.5 text-slate-400", size: 16 }),
                                React.createElement('input', {
                                    className: "w-full p-3 pl-9 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500",
                                    placeholder: "Digite o nome para buscar...",
                                    value: customerSearch,
                                    onChange: e => { setCustomerSearch(e.target.value); setCustomerId(''); setShowCustomerList(true); },
                                    onFocus: () => setShowCustomerList(true),
                                    onBlur: () => setTimeout(() => setShowCustomerList(false), 200)
                                }),
                                customerId && React.createElement(CheckCircle, { className: "absolute right-3 top-3 text-green-500", size: 20 })
                            ),
                            showCustomerList && !customerId && React.createElement('div', { className: "absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto" },
                                filteredCustomers.length > 0 ? filteredCustomers.map(c => 
                                    React.createElement('div', { 
                                        key: c.id, 
                                        className: "p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer",
                                        onClick: () => { setCustomerId(c.id); setCustomerSearch(c.name); setShowCustomerList(false); }
                                    }, 
                                        React.createElement('p', { className: "font-bold text-slate-800 text-sm" }, c.name),
                                        c.phone && React.createElement('p', { className: "text-xs text-slate-500" }, c.phone)
                                    )
                                ) : React.createElement('div', { className: "p-3 text-slate-500 text-sm text-center" }, "Nenhum cliente encontrado.")
                            )
                        )
                    )
                ),
                step === 2 && React.createElement('div', { className: "space-y-4" },
                    React.createElement('div', { className: "bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3" },
                        React.createElement('label', { className: "text-xs font-bold text-slate-400 uppercase" }, "Buscar Produto"),
                        React.createElement('div', { className: "relative" },
                            React.createElement('div', { className: "relative" },
                                React.createElement(Search, { className: "absolute left-3 top-3.5 text-slate-400", size: 16 }),
                                React.createElement('input', {
                                    className: "w-full p-3 pl-9 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500",
                                    placeholder: "Buscar por nome ou código...",
                                    value: productSearch,
                                    onChange: e => { setProductSearch(e.target.value); setSelectedProductId(''); setShowProductList(true); },
                                    onFocus: () => setShowProductList(true),
                                    onBlur: () => setTimeout(() => setShowProductList(false), 200)
                                }),
                                selectedProductId && React.createElement(CheckCircle, { className: "absolute right-3 top-3 text-green-500", size: 20 })
                            ),
                            showProductList && !selectedProductId && React.createElement('div', { className: "absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto" },
                                filteredProducts.length > 0 ? filteredProducts.map(p => {
                                    const today = getBrazilDateString();
                                    const activePromo = p.isPromo && today >= p.promoStart && today <= p.promoEnd;
                                    return React.createElement('div', { 
                                        key: p.id, 
                                        className: "p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex justify-between items-center",
                                        onClick: () => handleSelectProduct(p)
                                    }, 
                                        React.createElement('div', null,
                                            React.createElement('p', { className: "font-bold text-slate-800 text-sm flex items-center gap-2" }, p.name, activePromo && React.createElement(Tag, { size: 12, className: "text-purple-500" })),
                                            React.createElement('span', { className: "text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded mt-1 inline-block" }, `#${p.code}`)
                                        ),
                                        React.createElement('div', { className: "text-right" },
                                            activePromo ? React.createElement('p', { className: "text-xs font-bold text-purple-600" }, formatCurrency(p.promoPrice)) : React.createElement('p', { className: "text-xs font-bold text-slate-800" }, formatCurrency(p.salePrice)),
                                            React.createElement('p', { className: "text-[10px] text-slate-400" }, `Est: ${p.quantity}`)
                                        )
                                    );
                                }) : React.createElement('div', { className: "p-3 text-slate-500 text-sm text-center" }, "Nenhum produto encontrado.")
                            )
                        ),
                        React.createElement('div', { className: "flex gap-2" },
                            React.createElement('div', { className: "w-24" }, React.createElement('label', { className: "block text-[10px] font-bold text-slate-400 uppercase mb-1" }, "Qtd"), React.createElement('input', { type: "number", min: "1", className: "w-full p-3 border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-yellow-500", value: currentQty, onChange: e => setCurrentQty(e.target.value) })),
                            React.createElement('div', { className: "flex-1" }, React.createElement('label', { className: "block text-[10px] font-bold text-slate-400 uppercase mb-1" }, "Venda Unit."), React.createElement(MoneyInput, { placeholder: "0,00", value: currentPrice, onChange: setCurrentPrice, className: "w-full p-3 pl-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500" }))
                        ),
                        React.createElement('button', { onClick: handleAddItem, disabled: !selectedProductId || !currentPrice || currentQty < 1, className: "w-full py-3 bg-slate-800 text-white rounded-lg font-bold text-sm disabled:opacity-50 hover:bg-slate-700 transition-colors" }, "+ Adicionar Item")
                    ),
                    React.createElement('div', { className: "space-y-2" },
                        React.createElement('label', { className: "text-xs font-bold text-slate-400 uppercase" }, `Carrinho (${cart.reduce((a,b)=>a+(parseInt(b.quantity)||1),0)} itens)`),
                        cart.length === 0 ? React.createElement('p', { className: "text-center text-slate-400 text-sm py-4 italic" }, "Vazio") : cart.map(item => React.createElement('div', { key: item.tempId, className: "flex justify-between items-center bg-yellow-50 p-3 rounded-lg border border-yellow-100" }, React.createElement('div', null, React.createElement('p', { className: "font-bold text-sm text-slate-800" }, `${item.quantity}x ${item.productName}`), React.createElement('p', { className: "text-xs text-slate-500" }, `Total: ${formatCurrency(item.price)}`)), React.createElement('button', { onClick: () => handleRemoveItem(item.tempId), className: "text-red-400 hover:text-red-600 p-2" }, React.createElement(Trash2, { size: 18 })))),
                        cart.length > 0 && React.createElement('div', { className: "text-right font-bold text-lg text-slate-800 pt-2 border-t border-slate-100 mt-2" }, `Total: ${formatCurrency(totalCartValue)}`)
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
                                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Parcelas"), React.createElement('select', { className: "w-full p-3 border border-slate-200 rounded-lg", value: installmentsCount, onChange: e => setInstallmentsCount(e.target.value) }, Array.from({length: 12}, (_, i) => i + 1).map(n => React.createElement('option', { key: n, value: n }, `${n}x`)))),
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
                            React.createElement('div', { className: "bg-slate-50 p-4 rounded-xl border border-slate-200" }, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-2" }, "Parcelas da Maquininha"), React.createElement('select', { className: "w-full p-3 border border-slate-200 rounded-lg", value: cardInstallments, onChange: e => setCardInstallments(e.target.value) }, React.createElement('option', { value: "1" }, "1x (À Vista)"), Array.from({length: 11}, (_, i) => i + 2).map(n => React.createElement('option', { key: n, value: n }, `${n}x`))))
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


// --- MODAL DE DETALHES COMPLETOS DA VENDA ---
const SaleDetailsModal = ({ isOpen, onClose, sale, onPay, onEdit, onDeletePayment, onDeleteSale, onOpenWA }) => {
    if (!isOpen || !sale) return null;

    const pendingAmount = sale.installments ? sale.installments.filter(i => !i.paid).reduce((acc, i) => acc + i.amount, 0) : 0;
    const paidInstallments = sale.installments ? sale.installments.filter(i => i.paid).length : 0;
    const totalInst = sale.installmentsCount || 0;
    const profit = sale.totalPrice - (sale.totalCost || 0);

    const waType = sale.saleType === 'direct' ? 'comprovante' : (sale.status === 'completed' ? 'quitacao' : 'registro');
    const waTitle = sale.saleType === 'direct' ? 'Enviar Comprovante' : (sale.status === 'completed' ? 'Enviar Quitação' : 'Enviar Resumo da Venda');

    return React.createElement('div', { className: "fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[55] backdrop-blur-sm" },
        React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl animate-fade-in" },
            // Header
            React.createElement('div', { className: "p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl" },
                React.createElement('div', null,
                    React.createElement('h3', { className: "font-bold text-lg text-slate-800" }, "Detalhes da " + (sale.saleType === 'direct' ? "Venda" : "Cobrança")),
                    React.createElement('p', { className: "text-xs text-slate-500 font-medium" }, sale.customerName)
                ),
                React.createElement('div', { className: "flex gap-2 items-center" },
                    React.createElement('button', { 
                        onClick: () => onOpenWA(waType, sale, null, null),
                        className: "p-2 hover:bg-green-100 rounded-full transition-colors text-green-600",
                        title: waTitle
                    }, React.createElement(MessageCircle, { size: 20 })),
                    React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500" }, React.createElement(X, { size: 20 }))
                )
            ),
            
            // Scrollable Content
            React.createElement('div', { className: "flex-1 overflow-y-auto p-4 space-y-4" },
                // Resumo Principal
                React.createElement('div', { className: "flex justify-between items-center" },
                    React.createElement('div', null,
                        React.createElement('p', { className: "font-bold text-slate-800 text-2xl" }, formatCurrency(sale.totalPrice)),
                        React.createElement('p', { className: "text-sm text-slate-500" }, formatDate(sale.saleDate))
                    ),
                    React.createElement('span', { className: `px-3 py-1 rounded-full text-xs font-bold ${sale.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}` }, sale.status === 'completed' ? 'Quitado' : 'Aberto')
                ),

                sale.saleType === 'prazo' && React.createElement('div', { className: "flex justify-between items-center text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100" },
                    React.createElement('span', { className: "flex items-center gap-1" }, React.createElement(CheckCircle, { size: 16, className: paidInstallments === totalInst ? 'text-emerald-500' : 'text-slate-400' }), `Pagos: ${paidInstallments}/${totalInst}`),
                    React.createElement('span', { className: "font-bold" }, pendingAmount > 0 ? `Resta: ${formatCurrency(pendingAmount)}` : 'Concluído')
                ),

                // Itens
                React.createElement('div', { className: "bg-white p-4 rounded-xl border border-slate-200" },
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2" }, React.createElement(Package, { size: 14 }), "Itens da Venda"),
                    sale.items.map((item, idx) => React.createElement('div', { key: idx, className: "flex justify-between text-sm py-2 border-b border-slate-50 last:border-0" },
                        React.createElement('span', { className: "text-slate-700" }, item.quantity ? `${item.quantity}x ${item.productName}` : item.productName),
                        React.createElement('span', { className: "font-mono text-slate-800 font-bold" }, formatCurrency(item.price))
                    ))
                ),

                // Financeiro
                React.createElement('div', { className: "bg-white p-4 rounded-xl border border-slate-200 space-y-3" },
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2" }, React.createElement(PieChart, { size: 14 }), "Resumo Financeiro"),
                    React.createElement('div', { className: "flex justify-between text-sm" }, React.createElement('span', { className: "text-slate-500" }, "Valor Total:"), React.createElement('span', { className: "font-bold text-slate-800" }, formatCurrency(sale.totalPrice))),
                    React.createElement('div', { className: "flex justify-between text-sm" }, React.createElement('span', { className: "text-slate-500" }, "Custo Total:"), React.createElement('span', { className: "text-slate-800" }, formatCurrency(sale.totalCost || 0))),
                    React.createElement('div', { className: "flex justify-between text-sm pt-3 border-t border-slate-100" }, React.createElement('span', { className: "font-bold text-emerald-600 flex items-center gap-1" }, React.createElement(Wallet, { size: 14 }), "Lucro Estimado:"), React.createElement('span', { className: "font-bold text-emerald-600" }, formatCurrency(profit)))
                ),

                // Info Especifica de Venda Direta
                sale.saleType === 'direct' && React.createElement(React.Fragment, null,
                    sale.paymentMethod === 'credit' && React.createElement('div', { className: "bg-emerald-50 p-4 rounded-xl border border-emerald-100 space-y-3" },
                        React.createElement('div', { className: "flex justify-between items-center text-sm" }, React.createElement('span', { className: "text-emerald-800" }, "Entrada (Dinheiro/Pix):"), React.createElement('span', { className: "font-bold text-emerald-800" }, formatCurrency(sale.entryAmount || 0))),
                        React.createElement('div', { className: "flex justify-between items-center text-sm" }, React.createElement('span', { className: "text-emerald-800" }, `Passado no Cartão (${sale.cardInstallments}x):`), React.createElement('span', { className: "font-bold text-emerald-800" }, formatCurrency(sale.cardAmount || sale.totalPrice)))
                    )
                ),

                // Entrada a Prazo
                (sale.saleType === 'prazo' || !sale.saleType) && sale.entryAmount > 0 && React.createElement('div', { className: "bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center" },
                    React.createElement('div', { className: "flex items-center gap-2" }, React.createElement(Wallet, { size: 18, className: "text-emerald-600" }), React.createElement('span', { className: "text-sm font-bold text-emerald-800" }, "Valor de Entrada")),
                    React.createElement('span', { className: "font-bold text-emerald-800 text-lg" }, formatCurrency(sale.entryAmount))
                ),

                // Parcelas a Prazo
                (sale.saleType === 'prazo' || !sale.saleType) && React.createElement('div', { className: "space-y-3" },
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase flex items-center gap-2" }, React.createElement(Calendar, { size: 14 }), "Parcelamento"),
                    sale.installments && sale.installments.map((inst, idx) => {
                        const isOverdue = !inst.paid && inst.dueDate < getBrazilDateString();
                        let paidDisplayDate = '';
                        if (inst.paid && inst.paidAt) paidDisplayDate = formatDate(inst.paidAt);
                        
                        return React.createElement('div', { key: idx, className: "bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-sm" },
                            React.createElement('div', { className: "flex justify-between items-center" },
                                React.createElement('div', { className: "flex items-center gap-3" },
                                    React.createElement('button', { onClick: () => onPay(sale, idx), className: `rounded-full p-2 transition-colors shadow-sm ${inst.paid ? 'bg-emerald-500 text-white cursor-default' : 'bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600'}` }, React.createElement(CheckCircle, { size: 20 })),
                                    React.createElement('div', null,
                                        React.createElement('p', { className: "text-sm font-bold text-slate-700" }, `Parcela ${inst.number}`),
                                        React.createElement('div', { className: "flex flex-col" },
                                            inst.paid && inst.paidAt ? React.createElement('span', { className: "text-xs text-emerald-600 font-bold" }, `Pago dia ${paidDisplayDate}`) : null,
                                            React.createElement('span', { className: `text-[11px] ${inst.paid ? 'text-slate-400' : isOverdue ? 'text-red-500 font-bold' : 'text-slate-500'}` }, inst.paid ? `Vencia dia ${formatDate(inst.dueDate)}` : `Vence dia ${formatDate(inst.dueDate)}`)
                                        )
                                    )
                                ),
                                React.createElement('p', { className: "font-bold text-slate-800 text-lg" }, formatCurrency(inst.amount))
                            ),
                            inst.history && inst.history.length > 0 && React.createElement('div', { className: "mt-1 pt-3 border-t border-slate-100 text-xs bg-slate-50 -mx-4 px-4 pb-2" },
                                React.createElement('p', { className: "text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center gap-1" }, React.createElement(History, { size: 12 }), "Histórico de Pagamentos"),
                                inst.history.map((h, hIdx) => React.createElement('div', { key: hIdx, className: "flex justify-between items-center text-slate-600 py-1.5 border-b border-slate-100 last:border-0" },
                                    React.createElement('div', { className: "flex items-center gap-1" },
                                        React.createElement('span', null, h.type === 'abatement' ? 'Abatimento autom.' : formatDate(h.date)),
                                        h.type !== 'abatement' && React.createElement('button', { onClick: (e) => { e.stopPropagation(); onOpenWA('recibo', sale, inst, h); }, className: "text-green-500 hover:text-green-600 bg-green-50 p-1 rounded transition-colors ml-1", title: "Enviar Recibo" }, React.createElement(MessageCircle, { size: 12 })),
                                        h.type !== 'abatement' && React.createElement('button', { onClick: () => onDeletePayment(sale.id, idx, hIdx, h), className: "text-red-400 hover:text-red-600 bg-red-50 p-1 rounded transition-colors" }, React.createElement(XCircle, { size: 12 }))
                                    ),
                                    React.createElement('span', { className: "font-bold" }, formatCurrency(h.amount))
                                ))
                            ),
                            !inst.paid ? React.createElement('div', { className: "flex gap-2 mt-2" },
                                React.createElement('button', { onClick: () => onEdit({ open: true, saleId: sale.id, installmentIndex: idx, data: inst }), className: "flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors" }, React.createElement(Edit2, { size: 14 }), "Ajustar Valor"),
                                sale.customerPhone && React.createElement('button', { onClick: () => onOpenWA('cobranca', sale, inst, null), className: "flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors shadow-sm" }, React.createElement(MessageCircle, { size: 14 }), "Cobrar")
                            ) : React.createElement('div', { className: "flex gap-2 mt-2" },
                                sale.customerPhone && React.createElement('button', { onClick: () => onOpenWA('recibo', sale, inst, null), className: "flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm border border-emerald-100" }, React.createElement(MessageCircle, { size: 14 }), "Enviar Recibo")
                            )
                        );
                    })
                )
            ),
            // Footer com botão de deletar
            React.createElement('div', { className: "p-4 border-t border-slate-100 bg-white rounded-b-2xl" },
                React.createElement('button', { onClick: () => { onDeleteSale('sale', sale.id); onClose(); }, className: "w-full py-3 text-red-500 text-sm font-bold bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-100 flex items-center justify-center gap-2" }, React.createElement(Trash2, { size: 16 }), "Excluir Registro Permanente")
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
    const [productViewModalData, setProductViewModalData] = useState({ open: false, data: null }); // Alterado
    const [customerModalData, setCustomerModalData] = useState({ open: false, data: null });
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    
    // Novo Estado para o Modal Detalhado
    const [selectedSaleDetail, setSelectedSaleDetail] = useState(null);
    const activeSaleDetails = selectedSaleDetail ? sales.find(s => s.id === selectedSaleDetail.id) : null;

    const [deleteModal, setDeleteModal] = useState({ open: false, type: null, id: null });
    const [editInstallmentModal, setEditInstallmentModal] = useState({ open: false, saleId: null, installmentIndex: null, data: null });
    
    const [installmentListModal, setInstallmentListModal] = useState({ open: false, type: null, data: [] });
    const [paymentModal, setPaymentModal] = useState({ open: false, saleId: null, index: null, item: null, isLast: false });
    const [deletePaymentModal, setDeletePaymentModal] = useState({ open: false, saleId: null, instIndex: null, histIndex: null, historyItem: null });

    // Estado do Seletor de WhatsApp
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
        let baseSales = sales.filter(s => s.saleType === 'prazo' || !s.saleType);
        
        if (salesSearch) {
            const lower = salesSearch.toLowerCase();
            // Ignora datas e busca tudo
            return baseSales.filter(s => 
                s.customerName.toLowerCase().includes(lower) || 
                (s.items && s.items.some(i => i.productName.toLowerCase().includes(lower)))
            ).sort((a, b) => b.saleDate.localeCompare(a.saleDate));
        }
        
        let active = baseSales.filter(s => s.status !== 'completed');
        let completed = baseSales.filter(s => s.status === 'completed' && s.saleDate >= salesStart && s.saleDate <= salesEnd);
        
        active.sort((a, b) => {
            const getNextDue = (sale) => {
                const pending = sale.installments?.find(i => !i.paid);
                return pending ? pending.dueDate : '9999-99-99';
            };
            return getNextDue(a).localeCompare(getNextDue(b));
        });
        completed.sort((a, b) => b.saleDate.localeCompare(a.saleDate));
        
        return [...active, ...completed];
    }, [sales, salesSearch, salesStart, salesEnd]);

    const directSales = useMemo(() => {
        let list = sales.filter(s => s.saleType === 'direct');
        if (cashierSearch) {
            const lower = cashierSearch.toLowerCase();
            // Ignora datas e busca tudo
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
        const periodSales = sales.filter(s => s.saleDate >= dashStartDate && s.saleDate <= dashEndDate);
        const totalReceivable = sales.filter(s => s.saleType === 'prazo' || !s.saleType).reduce((acc, s) => acc + (s.installments || []).filter(i => !i.paid).reduce((sum, i) => sum + i.amount, 0), 0);
        let cashIn = 0;
        periodSales.forEach(s => { if (s.saleType === 'direct') cashIn += s.totalPrice; if (s.saleType === 'prazo' && s.entryAmount) cashIn += s.entryAmount; });
        
        sales.forEach(s => {
            if (s.installments) {
                s.installments.forEach(i => {
                    if (i.paid && i.paidAt && (!i.history || i.history.length === 0)) {
                        const paidDate = i.paidAt.split('T')[0];
                        if (paidDate >= dashStartDate && paidDate <= dashEndDate) {
                            cashIn += i.amount;
                        }
                    }
                    if (i.history) {
                        i.history.forEach(h => {
                            if (h.type !== 'abatement' && h.date >= dashStartDate && h.date <= dashEndDate) {
                                cashIn += h.amount;
                            }
                        });
                    }
                });
            }
        });
        
        const today = getBrazilDateString();
        const nextWeek = addDays(today, 7);

        const overdueList = [];
        const upcomingList = [];

        sales.forEach(s => {
            if (s.saleType === 'prazo' && s.installments) {
                s.installments.forEach((i, idx) => {
                    if (!i.paid) {
                        const itemData = { 
                            ...i, 
                            sale: s,
                            saleId: s.id, 
                            customerName: s.customerName, 
                            customerPhone: s.customerPhone,
                            installmentIndex: idx,
                            isOverdue: i.dueDate < today
                        };

                        if (i.dueDate < today) {
                            overdueList.push(itemData);
                        } else if (i.dueDate <= nextWeek) {
                            upcomingList.push(itemData);
                        }
                    }
                });
            }
        });

        const totalOverdue = overdueList.reduce((acc, i) => acc + i.amount, 0);
        const totalUpcoming = upcomingList.reduce((acc, i) => acc + i.amount, 0);

        const estimatedProfit = periodSales.reduce((acc, s) => acc + (s.totalPrice - (s.totalCost || 0)), 0);
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
    
    // --- FUNÇÃO ATUALIZADA: ADICIONAR VENDA E DESCONTAR ESTOQUE ---
    const handleAddSale = async (data) => {
        // 1. Salva a Venda
        await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'sales'), data);
        
        // 2. Itera sobre os itens comprados para descontar o estoque
        if (data.items && data.items.length > 0) {
            for (const item of data.items) {
                if (item.productId) {
                    const prodRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'products', item.productId);
                    try {
                        const prodSnap = await getDoc(prodRef);
                        if (prodSnap.exists()) {
                            const currentQty = parseInt(prodSnap.data().quantity) || 0;
                            const qtyDeducted = parseInt(item.quantity) || 0;
                            // Salva a nova quantidade (pode ficar negativo se vender sem ter estoque real registrado)
                            await updateDoc(prodRef, { quantity: currentQty - qtyDeducted });
                        }
                    } catch (e) {
                        console.error("Erro ao descontar estoque do produto", item.productId, e);
                    }
                }
            }
        }
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

    // --- LÓGICA DE PAGAMENTO ---
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

        // CORREÇÃO PONTO FLUTUANTE
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

    // --- LÓGICA DE EXCLUSÃO DE PAGAMENTO ---
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

        // Se ajustou o valor para <= 0 manualmente, marcar como paga pra evitar bug
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
        if (!sale || !sale.customerPhone) return;

        const store = userProfile?.storeName || "Nossa Loja";
        const contractId = sale.id ? `VP-${sale.id.slice(-5).toUpperCase()}` : '00000'; // Alterado para VP-
        let msg = "";

        if (type === 'registro' || type === 'quitacao') {
            const isQuitacao = type === 'quitacao';
            msg = isQuitacao ? `🌟 *CONTRATO QUITADO*\n` : `📄 *CONTRATO REGISTRADO*\n`;
            msg += `━━━━━━━━━━━━━━━━━━━\n\n`;
            msg += `📋 *Contrato:* ${contractId}\n`;
            msg += `📅 *Data:* ${formatDate(sale.saleDate)}\n\n`;
            msg += `👤 *Cliente:* ${sale.customerName}\n`;
            if (sale.customerPhone) msg += `📱 *Telefone:* ${sale.customerPhone}\n`;
            msg += `\n`;
            
            // ITENS DA VENDA
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
                // Busca o valor da parcela (caso tenha sido paga e o valor zerado, mostra o original)
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
            
            // ITENS DA VENDA
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
            if (sale.customerPhone) msg += `📱 *Telefone:* ${sale.customerPhone}\n`;
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

        setWaChooserModal({ open: true, phone: sale.customerPhone, message: msg });
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
                
                // GRID DASHBOARD (1 coluna mobile, 2 tablet, 4 desktop)
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
                        return React.createElement('div', { key: sale.id, className: `bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden transition-all hover:shadow-md cursor-pointer ${sale.status === 'completed' ? 'opacity-60 bg-slate-50' : ''}`, onClick: () => setSelectedSaleDetail(sale) },
                            React.createElement('div', { className: "p-4" },
                                React.createElement('div', { className: "flex justify-between items-start mb-2" },
                                    React.createElement('div', null, React.createElement('p', { className: "text-xs font-bold text-slate-500 uppercase" }, sale.customerName), React.createElement('p', { className: "font-bold text-slate-800 text-lg" }, formatCurrency(sale.totalPrice)), React.createElement('p', { className: "text-xs text-slate-400 mt-0.5" }, formatDate(sale.saleDate))),
                                    React.createElement('span', { className: `px-2 py-1 rounded text-xs font-bold ${sale.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}` }, sale.status === 'completed' ? 'Quitado' : 'Aberto')
                                ),
                                React.createElement('div', { className: "flex justify-between items-center text-xs text-slate-500 mt-2 pt-2 border-t border-slate-50" }, React.createElement('span', { className: "flex items-center gap-1" }, React.createElement(CheckCircle, { size: 12, className: paidInstallments === totalInst ? 'text-emerald-500' : 'text-slate-400' }), `Pagos: ${paidInstallments}/${totalInst}`), React.createElement('span', null, pendingAmount > 0 ? `Resta: ${formatCurrency(pendingAmount)}` : 'Concluído'))
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
                        return React.createElement('div', { key: sale.id, className: "bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md cursor-pointer", onClick: () => setSelectedSaleDetail(sale) },
                            React.createElement('div', { className: "p-4 flex flex-col gap-2" },
                                React.createElement('div', { className: "flex justify-between items-start" },
                                    React.createElement('div', null, React.createElement('p', { className: "font-bold text-slate-800 text-lg" }, formatCurrency(sale.totalPrice)), React.createElement('p', { className: "text-sm text-slate-500" }, sale.customerName)),
                                    React.createElement('div', { className: "flex flex-col items-end" },
                                        React.createElement('span', { className: "bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded capitalize flex items-center gap-1" }, sale.paymentMethod === 'pix' && React.createElement(QrCode, { size: 12 }), sale.paymentMethod === 'money' && React.createElement(Banknote, { size: 12 }), (sale.paymentMethod === 'credit' || sale.paymentMethod === 'debit') && React.createElement(CreditCard, { size: 12 }), sale.paymentMethod === 'credit' ? `Crédito ${sale.cardInstallments}x` : sale.paymentMethod === 'money' ? 'Dinheiro' : sale.paymentMethod === 'debit' ? 'Débito' : 'PIX'),
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
                React.createElement('div', { className: "flex gap-2 mb-2" }, React.createElement('div', { className: "relative flex-1" }, React.createElement(Search, { className: "absolute left-3 top-3 text-slate-400", size: 18 }), React.createElement('input', { className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none", placeholder: "Buscar cliente...", value: customerSearch, onChange: e => setCustomerSearch(e.target.value.toUpperCase()) })), React.createElement('button', { onClick: () => setCustomerModalData({open:true, data:null}), className: "bg-yellow-500 text-white p-3 rounded-xl font-bold shadow-lg shadow-yellow-200" }, "+")),
                
                // GRID CLIENTES
                React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
                    paginatedCustomers.map(c => React.createElement('div', { key: c.id, className: "bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm" }, React.createElement('div', null, React.createElement('p', { className: "font-bold text-slate-800" }, c.name), React.createElement('p', { className: "text-xs text-slate-500" }, c.phone || 'Sem contato')), React.createElement('div', { className: "flex gap-2" }, React.createElement('button', { onClick: () => setCustomerModalData({open: true, data: c}), className: "text-slate-300 hover:text-yellow-600 p-2" }, React.createElement(Edit2, { size: 18 })), React.createElement('button', { onClick: () => requestDelete('customer', c.id), className: "text-slate-300 hover:text-red-500 p-2" }, React.createElement(Trash2, { size: 18 })))))
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
        
        // MODAL DE CONFIRMAÇÃO DE PAGAMENTO
        React.createElement(PaymentConfirmationModal, {
            isOpen: paymentModal.open,
            onClose: () => setPaymentModal({ open: false, saleId: null, index: null, item: null, isLast: false }),
            onConfirm: handleConfirmPayment,
            installment: paymentModal.item,
            isLast: paymentModal.isLast
        }),

        // MODAL DE EXCLUSÃO DE PAGAMENTO
        React.createElement(ConfirmModal, {
            isOpen: deletePaymentModal.open,
            title: "Estornar Pagamento?",
            message: "O valor será devolvido para a parcela e ela ficará em aberto novamente.",
            onClose: () => setDeletePaymentModal({ open: false, saleId: null, instIndex: null, histIndex: null, historyItem: null }),
            onConfirm: handleDeletePayment
        }),

        // SELETOR DE WHATSAPP E CONFIRM DELETE
        React.createElement(WhatsAppChooserModal, {
            isOpen: waChooserModal.open,
            phone: waChooserModal.phone,
            message: waChooserModal.message,
            onClose: () => setWaChooserModal({ open: false, phone: '', message: '' })
        }),
        React.createElement(ConfirmModal, { isOpen: deleteModal.open, title: "Tem certeza?", message: "O registro será apagado permanentemente.", onClose: () => { setDeleteModal({ open: false, id: null, type: null }); setSelectedSaleDetail(null); }, onConfirm: confirmDelete })
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
