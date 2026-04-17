import {
  React, useState, useEffect, useMemo, useRef,
  Users, ShoppingBag, PlusCircle, CheckCircle, MessageCircle, Trash2, ChevronDown, ChevronUp, Package, TrendingUp, Edit2, AlertTriangle, Wallet, Search, CreditCard, QrCode, Banknote, Calendar, Filter, X, PieChart, BarChart3, ArrowUpRight, ArrowDownRight, PackageMinus, LogOut, Lock, Mail, Phone, Store, UserCog, UserCheck, UserX, Shield, ChevronLeft, ChevronRight, MoreHorizontal, LayoutGrid, AlertCircle, RefreshCw, Clock, Bell, History, FileText, XCircle, User, Smartphone, Copy, Tag, Info, MapPin, BadgePercent, Receipt,
  db, auth, APP_ID, ADMIN_EMAIL,
  collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged
} from '../core.js';

import { formatCurrency, parseMoney, maskMoney, maskPhone, maskCpfCnpj, maskCep, applyPixMask, formatDate, getBrazilDateString, addDays, getCurrentMonthStart, getCurrentMonthEnd } from './utils.js';
import { MoneyInput, Pagination, DateRangeFilter } from './ui.js';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, isCancel, onReasonChange, reasonValue }) => {
    if (!isOpen) return null;
    return React.createElement('div', { className: "fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[70] backdrop-blur-sm" },
        React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in text-center flex flex-col max-h-[90vh]" },
            React.createElement('div', { className: `mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 shrink-0 ${isCancel ? 'bg-orange-100' : 'bg-red-100'}` }, 
                isCancel ? React.createElement(PackageMinus, { className: "text-orange-500" }) : React.createElement(AlertTriangle, { className: "text-red-500" })
            ),
            React.createElement('h3', { className: "text-lg font-bold text-slate-800 mb-2 shrink-0" }, title),
            React.createElement('p', { className: "text-slate-500 mb-4 shrink-0 text-sm" }, message),
            
            isCancel && React.createElement('div', { className: "mb-6 text-left" },
                React.createElement('label', { className: "block text-[10px] font-bold text-slate-400 uppercase mb-1" }, "Motivo do Cancelamento *"),
                React.createElement('textarea', { 
                    className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm", 
                    rows: 3, 
                    placeholder: "Ex: Cliente desistiu, erro no lançamento...",
                    value: reasonValue,
                    onChange: e => onReasonChange(e.target.value)
                })
            ),

            React.createElement('div', { className: "flex gap-3 shrink-0" },
                React.createElement('button', { onClick: onClose, className: "flex-1 p-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200" }, "Voltar"),
                React.createElement('button', { 
                    onClick: onConfirm, 
                    disabled: isCancel && !reasonValue.trim(),
                    className: `flex-1 p-3 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 ${isCancel ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-200' : 'bg-red-500 hover:bg-red-600 shadow-red-200'}` 
                }, isCancel ? "Confirmar" : "Sim, Excluir")
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
    const [pixLookupMessage, setPixLookupMessage] = useState('');

    useEffect(() => {
        if (isOpen && userProfile) {
            setName(userProfile.name || '');
            setStoreName(userProfile.storeName || '');
            setPhone(userProfile.phone || '');
            setPixType(userProfile.pixType || '');
            setPixKey(userProfile.pixKey || '');
            setPixBank(userProfile.pixBank || '');
            setPixName(userProfile.pixName || '');
            setPixLookupMessage('');
        }
    }, [isOpen, userProfile]);

    useEffect(() => {
        if (!isOpen) return;
        if (pixKey && name && !pixName.trim()) {
            setPixName(name);
        }
    }, [pixKey, name, pixName, isOpen]);

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
                    React.createElement('input', { type: "tel", className: "w-full p-3 border border-slate-200 rounded-lg", value: phone, onChange: e => setPhone(maskPhone(e.target.value)), placeholder: "Seu WhatsApp" })
                ),
                React.createElement('div', { className: "space-y-3 bg-emerald-50 p-4 rounded-xl border border-emerald-100" },
                    React.createElement('p', { className: "text-xs font-bold text-emerald-600 uppercase flex items-center gap-1" }, React.createElement(QrCode, { size: 14 }), "Configuração do PIX (Para Cobranças)"),
                    React.createElement('select', { className: "w-full p-3 border border-slate-200 rounded-lg bg-white", value: pixType, onChange: e => { setPixType(e.target.value); setPixKey(''); setPixLookupMessage(''); } },
                        React.createElement('option', { value: "" }, "Selecione o Tipo de Chave..."),
                        React.createElement('option', { value: "cpf_cnpj" }, "CPF / CNPJ"),
                        React.createElement('option', { value: "phone" }, "Telefone"),
                        React.createElement('option', { value: "email" }, "E-mail"),
                        React.createElement('option', { value: "random" }, "Chave Aleatória")
                    ),
                    React.createElement('input', { className: "w-full p-3 border border-slate-200 rounded-lg bg-white", value: applyPixMask(pixKey, pixType), onChange: e => { setPixKey(e.target.value); setPixLookupMessage(e.target.value ? 'Neste app, a chave PIX não expõe automaticamente banco e titular. O titular pode ser sugerido pelo nome do perfil, mas o banco ainda precisa ser informado manualmente.' : ''); }, placeholder: "Chave PIX", disabled: !pixType }),
                    pixLookupMessage && React.createElement('div', { className: "text-xs text-emerald-700 bg-white border border-emerald-200 rounded-lg p-3" }, pixLookupMessage),
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

export { ConfirmModal, WhatsAppChooserModal, UserProfileModal, PaymentConfirmationModal, InstallmentListModal };
