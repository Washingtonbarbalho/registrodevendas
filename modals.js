import React, { useState, useEffect, useMemo } from 'https://esm.sh/react@18.2.0';
import { PackageMinus, AlertTriangle, MessageCircle, Copy, QrCode, X, User, Wallet, Clock, Users, CheckCircle, Edit2, Package, Tag, Info, ShieldAlert, History, XCircle, Receipt, BadgePercent, Calendar, PieChart, Trash2, ArrowUpCircle, ArrowDownCircle } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, parseMoney, maskMoney, maskPhone, applyPixMask, generatePixPayload, maskCpfCnpj, maskCep, formatDate, getBrazilDateString } from './utils.js';
import { MoneyInput } from './components.js';

const formatDateTime = (dateStr) => {
    if (!dateStr) return '--/--/---- --:--';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
};

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, isCancel, onReasonChange, reasonValue }) => {
    if (!isOpen) return null;
    return React.createElement('div', { className: "app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[70] backdrop-blur-sm" },
        React.createElement('div', { className: "app-modal-panel bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in text-center flex flex-col max-h-[90vh]" },
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

export const WhatsAppChooserModal = ({ isOpen, onClose, phone, message }) => {
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
    return React.createElement('div', { className: "app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[90] backdrop-blur-sm" },
        React.createElement('div', { className: "app-modal-panel bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in text-center" },
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

export const PixCodeModal = ({ isOpen, onClose, userProfile, amount, txid }) => {
    if (!isOpen || !userProfile?.pixKey) return null;
    const payload = generatePixPayload(userProfile.pixKey, userProfile.pixType, userProfile.pixName, userProfile.city || "BRASIL", amount, txid);
    return React.createElement('div', { className: "app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[90] backdrop-blur-sm" },
        React.createElement('div', { className: "app-modal-panel bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in text-center" },
            React.createElement('div', { className: "flex justify-between items-center mb-4" },
                React.createElement('h3', { className: "text-lg font-bold text-slate-800 flex items-center gap-2" }, React.createElement(QrCode, { className: "text-emerald-500" }), "Receber via PIX"),
                React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-slate-100 rounded-full" }, React.createElement(X, { size: 20 }))
            ),
            React.createElement('div', { className: "bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col items-center" },
                React.createElement('img', { 
                    src: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(payload)}`, 
                    alt: "QR Code PIX", 
                    className: "mb-4 rounded-lg shadow-sm border border-emerald-200 w-36 h-36" 
                }),
                React.createElement('p', { className: "font-bold text-emerald-800 text-lg mb-3" }, formatCurrency(amount)),
                React.createElement('div', { className: "w-full relative" },
                    React.createElement('input', { type: "text", readOnly: true, value: payload, className: "w-full text-xs p-3 pr-12 border border-emerald-200 rounded-lg bg-white outline-none text-slate-500 font-mono" }),
                    React.createElement('button', { 
                        onClick: () => { navigator.clipboard.writeText(payload); alert("Código PIX Copiado!"); }, 
                        className: "absolute right-2 top-2 p-1.5 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200 transition-colors", 
                        title: "Copiar" 
                    }, React.createElement(Copy, { size: 16 }))
                )
            ),
            React.createElement('button', { onClick: onClose, className: "w-full mt-4 p-3 bg-slate-900 text-white font-bold rounded-xl" }, "Fechar")
        )
    );
};

export const UserProfileModal = ({ isOpen, onClose, userProfile, onSave }) => {
    const [name, setName] = useState('');
    const [storeName, setStoreName] = useState('');
    const [phone, setPhone] = useState('');
    const [pixType, setPixType] = useState('');
    const [pixKey, setPixKey] = useState('');
    const [pixBank, setPixBank] = useState('');
    const [pixName, setPixName] = useState('');

    useEffect(() => {
        if (isOpen && userProfile) {
            setName(userProfile.name || ''); setStoreName(userProfile.storeName || ''); setPhone(userProfile.phone || '');
            setPixType(userProfile.pixType || ''); setPixKey(userProfile.pixKey || ''); setPixBank(userProfile.pixBank || ''); setPixName(userProfile.pixName || '');
        }
    }, [isOpen, userProfile]);

    const handleSave = () => { onSave({ ...userProfile, name, storeName, phone, pixType, pixKey, pixBank, pixName }); };

    if (!isOpen) return null;
    return React.createElement('div', { className: "app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[80] backdrop-blur-sm" },
        React.createElement('div', { className: "app-modal-panel desktop-modal desktop-modal-profile bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl animate-fade-in" },
            React.createElement('div', { className: "desktop-modal-header p-4 border-b border-slate-100 flex justify-between items-center" },
                React.createElement('h3', { className: "font-bold text-lg text-slate-800 flex items-center gap-2" }, React.createElement(User, { className: "text-yellow-500" }), "Meu Perfil"),
                React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-slate-100 rounded-full" }, React.createElement(X, { size: 20 }))
            ),
            React.createElement('div', { className: "desktop-modal-body desktop-profile-grid flex-1 overflow-y-auto p-4 space-y-4" },
                React.createElement('div', { className: "space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100" },
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase" }, "Dados da Loja"),
                    React.createElement('input', { className: "w-full p-3 border border-slate-200 rounded-lg", value: name, onChange: e => setName(e.target.value), placeholder: "Seu Nome" }),
                    React.createElement('input', { className: "w-full p-3 border border-slate-200 rounded-lg", value: storeName, onChange: e => setStoreName(e.target.value), placeholder: "Nome da Loja" }),
                    React.createElement('input', { type: "tel", className: "w-full p-3 border border-slate-200 rounded-lg", value: phone, onChange: e => setPhone(maskPhone(e.target.value)), placeholder: "Seu WhatsApp" })
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
            React.createElement('div', { className: "desktop-modal-footer p-4 border-t border-slate-100 flex gap-2" },
                React.createElement('button', { onClick: onClose, className: "flex-1 p-3 text-slate-500 font-bold rounded-lg hover:bg-slate-50" }, "Cancelar"),
                React.createElement('button', { onClick: handleSave, className: "flex-1 p-3 bg-slate-900 text-white font-bold rounded-lg shadow-sm" }, "Salvar Alterações")
            )
        )
    );
};

export const PaymentConfirmationModal = ({ isOpen, onClose, onConfirm, installment, isLast }) => {
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
        if (val <= 0) { setError('Digite um valor válido.'); return; }
        const valCents = Math.round(val * 100);
        const instAmtCents = Math.round(installment.amount * 100);
        if (isLast && valCents > instAmtCents) { setError('Na última parcela não é permitido pagar valor maior que o restante.'); return; }
        onConfirm(val, date);
    };

    if (!isOpen || !installment) return null;
    return React.createElement('div', { className: "app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[75] backdrop-blur-sm" },
        React.createElement('div', { className: "app-modal-panel bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in" },
            React.createElement('div', { className: "text-center mb-4" },
                React.createElement('div', { className: "w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3" }, React.createElement(Wallet, { className: "text-emerald-600", size: 24 })),
                React.createElement('h3', { className: "text-lg font-bold text-slate-800" }, "Confirmar Pagamento"),
                React.createElement('p', { className: "text-sm text-slate-500" }, `Parcela ${installment.number} - Restante: ${formatCurrency(installment.amount)}`)
            ),
            error && React.createElement('div', { className: "bg-red-50 text-red-500 text-xs p-3 rounded-lg mb-4 flex items-center gap-2" }, React.createElement(AlertTriangle, { size: 14 }), error),
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

export const InstallmentListModal = ({ isOpen, onClose, title, items, onPay, onOpenWA }) => {
    if (!isOpen) return null;
    const groupedItems = items.reduce((acc, item) => {
        if (!acc[item.customerName]) acc[item.customerName] = [];
        acc[item.customerName].push(item);
        return acc;
    }, {});

    return React.createElement('div', { className: "app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[80] backdrop-blur-sm" },
        React.createElement('div', { className: "app-modal-panel desktop-modal desktop-modal-installments bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl animate-fade-in" },
            React.createElement('div', { className: "desktop-modal-header p-4 border-b border-slate-100 flex justify-between items-center" },
                React.createElement('h3', { className: "font-bold text-lg text-slate-800 flex items-center gap-2" }, React.createElement(Clock, { className: "text-yellow-600", size: 20 }), title),
                React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-slate-100 rounded-full" }, React.createElement(X, { size: 20 }))
            ),
            React.createElement('div', { className: "desktop-modal-body installment-groups-grid flex-1 overflow-y-auto p-4 space-y-4" },
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
                                    React.createElement('p', { className: `text-xs ${item.isOverdue ? 'text-red-500 font-bold' : 'text-slate-400'}` }, item.isOverdue ? `Venceu ${formatDate(item.dueDate)}` : `Vence ${formatDate(item.dueDate)}`)
                                ),
                                React.createElement('div', { className: "flex gap-2" },
                                    item.customerPhone && React.createElement('button', { onClick: () => onOpenWA('cobranca', item.sale, item, null), className: "p-2 bg-green-500 text-white rounded-lg shadow-sm hover:bg-green-600 transition-colors" }, React.createElement(MessageCircle, { size: 16 })),
                                    React.createElement('button', { onClick: () => onPay(item), className: "p-2 bg-slate-800 text-white rounded-lg shadow-sm hover:bg-slate-700 transition-colors" }, React.createElement(CheckCircle, { size: 16 }))
                                )
                            )
                        ))
                    )
                ))
            )
        )
    );
};

export const EditInstallmentModal = ({ isOpen, onClose, installment, onSave }) => {
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');
    useEffect(() => { if (installment) { setAmount(maskMoney((installment.amount * 100).toFixed(0))); setDueDate(installment.dueDate); } }, [installment]);
    const handleSave = () => { onSave({ ...installment, amount: parseMoney(amount), dueDate }); onClose(); };
    if (!isOpen || !installment) return null;
    return React.createElement('div', { className: "app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[60]" },
        React.createElement('div', { className: "app-modal-panel bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in" },
            React.createElement('h3', { className: "text-lg font-bold mb-4 flex items-center gap-2" }, React.createElement(Edit2, { size: 20, className: "text-yellow-600" }), `Editar Parcela ${installment.number}`),
            React.createElement('div', { className: "space-y-4" },
                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Valor (R$)"), React.createElement(MoneyInput, { value: amount, onChange: setAmount })),
                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Vencimento"), React.createElement('input', { type: "date", className: "w-full p-3 border border-slate-200 rounded-lg", value: dueDate, onChange: e => setDueDate(e.target.value) }))
            ),
            React.createElement('div', { className: "flex gap-3 mt-6" }, React.createElement('button', { onClick: onClose, className: "flex-1 p-3 text-slate-500 font-bold" }, "Cancelar"), React.createElement('button', { onClick: handleSave, className: "flex-1 p-3 bg-slate-900 text-white font-bold rounded-xl" }, "Salvar"))
        )
    );
};

/* --- MODAIS DE PRODUTO DO SISTEMA ADMINISTRATIVO --- */

export const ProductModal = ({ isOpen, onClose, onSave, lastCode, initialData }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [salePrice, setSalePrice] = useState('');
    const [costPrice, setCostPrice] = useState('');
    const [isPromo, setIsPromo] = useState(false);
    const [promoPrice, setPromoPrice] = useState('');
    const [promoStart, setPromoStart] = useState('');
    const [promoEnd, setPromoEnd] = useState('');

    useEffect(() => {
        if (initialData && isOpen) {
            setName(initialData.name || ''); setDescription(initialData.description || ''); 
            setSalePrice(initialData.salePrice || 0); setCostPrice(initialData.costPrice || 0); 
            setIsPromo(initialData.isPromo || false); setPromoPrice(initialData.promoPrice || 0); 
            setPromoStart(initialData.promoStart || ''); setPromoEnd(initialData.promoEnd || '');
        } else if (isOpen) {
            setName(''); setDescription(''); setSalePrice(''); setCostPrice('');
            setIsPromo(false); setPromoPrice(''); setPromoStart(''); setPromoEnd('');
        }
    }, [initialData, isOpen]);

    const nextCode = useMemo(() => { 
        if (initialData) return initialData.code; 
        if (!lastCode) return '000001'; 
        return String(parseInt(lastCode, 10) + 1).padStart(6, '0'); 
    }, [lastCode, initialData]);

    if (!isOpen) return null;

    const numCost = typeof costPrice === 'number' ? costPrice : parseMoney(costPrice);
    const numSale = parseMoney(salePrice);
    const profit = numSale - numCost;
    const margin = numSale > 0 ? (profit / numSale) * 100 : 0;

    const handleSubmit = () => {
        if (!name || numSale <= 0) return alert("Nome e Preço de Venda são obrigatórios.");
        const dataToSave = {
            code: nextCode, name: name.toUpperCase(), description, salePrice: numSale, costPrice: numCost,
            isPromo, promoPrice: isPromo ? parseMoney(promoPrice) : 0, promoStart: isPromo ? promoStart : null, promoEnd: isPromo ? promoEnd : null
        };
        if (!initialData) {
            dataToSave.quantity = 0;
            dataToSave.movements = [];
        }
        onSave(dataToSave);
    };

    return React.createElement('div', { className: "app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[70] backdrop-blur-sm" },
        React.createElement('div', { className: "app-modal-panel bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in flex flex-col max-h-[95vh]" },
            React.createElement('div', { className: "p-6 border-b border-slate-100 flex justify-between items-center shrink-0" },
                React.createElement('div', null,
                    React.createElement('h3', { className: "text-xl font-bold text-slate-800 flex items-center gap-2" }, React.createElement(Package, { className: "text-yellow-500" }), initialData ? 'Editar Produto' : 'Novo Produto'),
                    React.createElement('p', { className: "text-sm text-slate-400 font-mono mt-1" }, `CÓD: #${nextCode}`)
                ),
                React.createElement('button', { onClick: onClose, className: "p-2 bg-slate-100 rounded-full hover:bg-slate-200" }, React.createElement(X, { size: 20 }))
            ),
            React.createElement('div', { className: "p-6 overflow-y-auto flex-1 space-y-4 no-scrollbar" },
                !initialData && React.createElement('div', { className: "bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-start gap-2" },
                    React.createElement(Info, { className: "text-blue-500 shrink-0 mt-0.5", size: 16 }),
                    React.createElement('p', { className: "text-xs text-blue-700" }, React.createElement('b', null, "O produto será criado com estoque zero."), " Após salvar, use a opção 'Movimentar Estoque' para dar entrada e registrar as quantidades.")
                ),
                React.createElement('div', { className: "bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3" },
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase" }, "Dados Básicos"),
                    React.createElement('div', null,
                        React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Nome do Produto *"),
                        React.createElement('input', { className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 uppercase", value: name, onChange: e => setName(e.target.value.toUpperCase()) })
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Descrição (Opcional)"),
                        React.createElement('textarea', { className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 text-sm", rows: "2", value: description, onChange: e => setDescription(e.target.value) })
                    )
                ),
                React.createElement('div', { className: "bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-sm" },
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase" }, "Precificação e Lucro"),
                    React.createElement('div', { className: "grid grid-cols-2 gap-3" },
                        React.createElement('div', null,
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Custo Médio Base"),
                            React.createElement(MoneyInput, { value: costPrice, onChange: setCostPrice, className: "w-full p-3 pl-10 border border-slate-200 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none font-bold text-slate-800" })
                        ),
                        React.createElement('div', null,
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Preço de Venda *"),
                            React.createElement(MoneyInput, { value: salePrice, onChange: setSalePrice, className: "w-full p-3 pl-10 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none font-bold text-slate-800" })
                        )
                    ),
                    React.createElement('div', { className: "flex gap-4 pt-2 border-t border-slate-100" },
                        React.createElement('div', { className: "flex-1" },
                            React.createElement('span', { className: "text-[10px] text-slate-400 uppercase font-bold block" }, "Lucro Estimado (R$)"),
                            React.createElement('span', { className: `font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}` }, formatCurrency(profit))
                        ),
                        React.createElement('div', { className: "flex-1" },
                            React.createElement('span', { className: "text-[10px] text-slate-400 uppercase font-bold block" }, "Margem (%)"),
                            React.createElement('span', { className: `font-bold ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}` }, `${margin.toFixed(2)}%`)
                        )
                    )
                ),
                React.createElement('div', { className: `p-4 rounded-xl border transition-colors ${isPromo ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-200'}` },
                    React.createElement('div', { className: "flex justify-between items-center cursor-pointer", onClick: () => setIsPromo(!isPromo) },
                        React.createElement('p', { className: `text-xs font-bold uppercase flex items-center gap-2 ${isPromo ? 'text-purple-700' : 'text-slate-400'}` }, React.createElement(Tag, { size: 14 }), " Ativar Preço Promocional"),
                        React.createElement('div', { className: `w-10 h-6 rounded-full p-1 transition-colors ${isPromo ? 'bg-purple-500' : 'bg-slate-300'}` },
                            React.createElement('div', { className: `bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${isPromo ? 'translate-x-4' : 'translate-x-0'}` })
                        )
                    ),
                    isPromo && React.createElement('div', { className: "mt-4 space-y-3 animate-fade-in" },
                        React.createElement('div', null,
                            React.createElement('label', { className: "block text-[10px] font-bold text-purple-600 uppercase mb-1" }, "Preço na Promoção"),
                            React.createElement(MoneyInput, { value: promoPrice, onChange: setPromoPrice, className: "w-full p-3 pl-10 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-purple-900 font-bold" })
                        ),
                        React.createElement('div', { className: "grid grid-cols-2 gap-3" },
                            React.createElement('div', null,
                                React.createElement('label', { className: "block text-[10px] font-bold text-purple-600 uppercase mb-1" }, "Início da Promo"),
                                React.createElement('input', { type: "date", className: "w-full p-2 border border-purple-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-purple-500", value: promoStart, onChange: e => setPromoStart(e.target.value) })
                            ),
                            React.createElement('div', null,
                                React.createElement('label', { className: "block text-[10px] font-bold text-purple-600 uppercase mb-1" }, "Fim da Promo"),
                                React.createElement('input', { type: "date", className: "w-full p-2 border border-purple-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-purple-500", value: promoEnd, onChange: e => setPromoEnd(e.target.value) })
                            )
                        )
                    )
                )
            ),
            React.createElement('div', { className: "p-6 border-t border-slate-100 flex gap-3 shrink-0 bg-white rounded-b-2xl" },
                React.createElement('button', { onClick: onClose, className: "flex-1 p-3 text-slate-500 font-bold bg-slate-100 rounded-xl hover:bg-slate-200" }, "Cancelar"),
                React.createElement('button', { onClick: handleSubmit, className: "flex-1 p-3 bg-slate-900 text-yellow-400 font-bold rounded-xl hover:bg-slate-800 shadow-lg" }, "Salvar Cadastro")
            )
        )
    );
};

export const ProductDetailsModal = ({ isOpen, onClose, product, salesHistory, onEdit, onMovementRequest, onDeleteRequest }) => {
    const [tab, setTab] = useState('info');

    const combinedHistory = useMemo(() => {
        let history = [];
        if (!product) return history;

        if (product.movements && Array.isArray(product.movements)) {
            product.movements.forEach(m => {
                history.push({
                    id: m.id, date: m.date, type: m.type, qty: m.quantity,
                    isEntry: ['compra', 'ajuste_entrada', 'devolucao'].includes(m.type),
                    totalValue: m.quantity * (m.unitCost || 0), notes: m.notes
                });
            });
        }
        
        if (salesHistory && Array.isArray(salesHistory)) {
            salesHistory.forEach(sale => {
                const itemMatch = sale.items?.find(i => i.productId === product.id);
                if (itemMatch) {
                    const salePriceItem = itemMatch.price !== undefined ? itemMatch.price : product.salePrice;
                    history.push({
                        id: `sale-${sale.id}`, date: sale.saleDate + 'T12:00:00.000Z', type: 'venda',
                        qty: itemMatch.quantity, isEntry: false, totalValue: itemMatch.quantity * salePriceItem,
                        notes: `Venda p/ ${sale.customerName?.split(' ')[0]}`
                    });
                    if (sale.status === 'canceled') {
                        history.push({
                            id: `cancel-${sale.id}`, 
                            date: sale.canceledAt ? new Date(sale.canceledAt.seconds * 1000).toISOString() : sale.saleDate + 'T12:00:01.000Z',
                            type: 'cancelamento', qty: itemMatch.quantity, isEntry: true,
                            totalValue: itemMatch.quantity * salePriceItem, notes: `Venda Cancelada`
                        });
                    }
                }
            });
        }
        return history.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [product, salesHistory]);

    if (!isOpen || !product) return null;

    const isPromoActive = product.isPromo && getBrazilDateString() >= product.promoStart && getBrazilDateString() <= product.promoEnd;

    return React.createElement('div', { className: "app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[60] backdrop-blur-sm" },
        React.createElement('div', { className: "app-modal-panel bg-white rounded-2xl w-full max-w-md max-h-[95vh] flex flex-col shadow-2xl animate-fade-in" },
            React.createElement('div', { className: "p-5 border-b border-slate-100 flex justify-between items-start bg-slate-900 text-white rounded-t-2xl shrink-0" },
                React.createElement('div', null,
                    React.createElement('span', { className: "text-[10px] font-mono bg-slate-800 text-yellow-400 px-2 py-0.5 rounded" }, `CÓD: #${product.code}`),
                    React.createElement('h3', { className: "text-xl font-bold mt-2 leading-tight" }, product.name)
                ),
                React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-slate-800 rounded-full text-slate-300 transition-colors" }, React.createElement(X, { size: 20 }))
            ),
            React.createElement('div', { className: "flex border-b border-slate-100 shrink-0 bg-slate-50" },
                React.createElement('button', { onClick: () => setTab('info'), className: `flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${tab === 'info' ? 'border-yellow-500 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}` }, "Detalhes"),
                React.createElement('button', { onClick: () => setTab('history'), className: `flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${tab === 'history' ? 'border-yellow-500 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}` }, "Histórico")
            ),
            React.createElement('div', { className: "flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar" },
                tab === 'info' && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                    React.createElement('div', { className: "grid grid-cols-2 gap-4" },
                        React.createElement('div', { className: "bg-slate-50 p-4 rounded-xl border border-slate-100" },
                            React.createElement('p', { className: "text-[10px] uppercase font-bold text-slate-400 mb-1" }, "Custo Médio"),
                            React.createElement('p', { className: "font-bold text-slate-800 text-lg" }, formatCurrency(product.costPrice))
                        ),
                        React.createElement('div', { className: "bg-slate-50 p-4 rounded-xl border border-slate-100" },
                            React.createElement('p', { className: "text-[10px] uppercase font-bold text-slate-400 mb-1" }, "Estoque"),
                            React.createElement('p', { className: `font-bold text-lg ${product.quantity <= 0 ? 'text-red-500' : 'text-slate-800'}` }, `${product.quantity} un.`)
                        )
                    ),
                    React.createElement('div', { className: "bg-white p-4 rounded-xl border border-slate-200 shadow-sm" },
                        React.createElement('div', { className: "flex justify-between items-center mb-2" },
                            React.createElement('p', { className: "text-[10px] uppercase font-bold text-slate-400" }, "Preço de Venda"),
                            isPromoActive && React.createElement('span', { className: "bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" }, "Promoção Ativa")
                        ),
                        isPromoActive ? React.createElement('div', { className: "flex items-end gap-3" },
                            React.createElement('p', { className: "text-sm font-bold text-slate-400 line-through" }, formatCurrency(product.salePrice)),
                            React.createElement('p', { className: "text-2xl font-bold text-purple-600" }, formatCurrency(product.promoPrice))
                        ) : React.createElement('p', { className: "text-2xl font-bold text-slate-800" }, formatCurrency(product.salePrice))
                    ),
                    product.description && React.createElement('div', { className: "bg-slate-50 p-4 rounded-xl border border-slate-100" },
                        React.createElement('p', { className: "text-[10px] uppercase font-bold text-slate-400 mb-1" }, "Descrição"),
                        React.createElement('p', { className: "text-sm text-slate-600 whitespace-pre-wrap" }, product.description)
                    ),
                    React.createElement('div', { className: "grid grid-cols-2 gap-3 pt-2" },
                        React.createElement('button', { onClick: () => onMovementRequest(product), className: "p-3 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors" },
                            React.createElement(ArrowUpCircle, { size: 18 }), " Movimentar"
                        ),
                        React.createElement('button', { onClick: () => onEdit(product), className: "p-3 bg-slate-100 text-slate-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors" },
                            React.createElement(Edit2, { size: 18 }), " Editar Info"
                        )
                    )
                ),
                tab === 'history' && React.createElement('div', { className: "space-y-3 animate-fade-in relative" },
                    combinedHistory.length === 0 ? React.createElement('p', { className: "text-center text-slate-400 py-10 italic text-sm" }, "Nenhuma movimentação registrada.") :
                    combinedHistory.map((h, i) => React.createElement('div', { key: i, className: "bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3" },
                        React.createElement('div', { className: `p-2 rounded-lg shrink-0 ${h.isEntry ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}` },
                            h.isEntry ? React.createElement(ArrowUpCircle, { size: 20 }) : React.createElement(ArrowDownCircle, { size: 20 })
                        ),
                        React.createElement('div', { className: "flex-1" },
                            React.createElement('div', { className: "flex justify-between items-start" },
                                React.createElement('p', { className: "text-xs font-bold text-slate-800 uppercase leading-tight" }, h.type.replace('_', ' ')),
                                React.createElement('div', { className: "text-right" },
                                    React.createElement('p', { className: `font-bold text-sm ${h.isEntry ? 'text-emerald-600' : 'text-red-500'}` }, `${h.isEntry ? '+' : '-'}${h.qty} un.`)
                                )
                            ),
                            React.createElement('div', { className: "flex justify-between items-center mt-1" },
                                React.createElement('p', { className: "text-[10px] text-slate-400" }, formatDateTime(h.date)),
                                h.totalValue > 0 && React.createElement('p', { className: "text-xs font-bold text-slate-600" }, formatCurrency(h.totalValue))
                            ),
                            h.notes && React.createElement('p', { className: "text-[10px] text-slate-500 mt-1 italic" }, `"${h.notes}"`)
                        )
                    ))
                )
            ),
            React.createElement('div', { className: "p-4 border-t border-slate-100 bg-white rounded-b-2xl shrink-0 flex flex-col gap-2" },
                React.createElement('button', { onClick: () => onDeleteRequest('product', product.id), className: "w-full py-3 text-red-400 hover:text-red-600 text-sm font-bold bg-white hover:bg-red-50 rounded-xl transition-colors border border-transparent flex items-center justify-center gap-2" },
                    React.createElement(Trash2, { size: 16 }), " Excluir Produto Permanentemente"
                )
            )
        )
    );
};

export const StockMovementModal = ({ isOpen, onClose, product, onSave }) => {
    const [type, setType] = useState('compra');
    const [quantity, setQuantity] = useState('');
    const [unitCost, setUnitCost] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen && product) {
            setType('compra'); setQuantity(''); setNotes('');
            setUnitCost(maskMoney((product.costPrice * 100).toFixed(0)));
        }
    }, [isOpen, product]);

    const handleSubmit = () => {
        const qtyVal = parseInt(quantity) || 0;
        if (qtyVal <= 0) return alert("Insira uma quantidade válida maior que zero.");
        const costVal = parseMoney(unitCost);
        if (type === 'compra' && costVal <= 0) return alert("Para compras, insira o valor unitário pago na mercadoria.");
        onSave(product.id, { type, quantity: qtyVal, unitCost: costVal, notes });
    };

    const isEntry = ['compra', 'ajuste_entrada', 'devolucao'].includes(type);
    if (!isOpen || !product) return null;

    return React.createElement('div', { className: "app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[80] backdrop-blur-sm" },
        React.createElement('div', { className: "app-modal-panel bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in flex flex-col" },
            React.createElement('div', { className: "p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl" },
                React.createElement('h3', { className: "font-bold text-lg text-slate-800 flex items-center gap-2" }, React.createElement(ArrowUpCircle, { className: "text-yellow-600", size: 20 }), " Movimentar Estoque"),
                React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-slate-200 rounded-full" }, React.createElement(X, { size: 20 }))
            ),
            React.createElement('div', { className: "p-5 space-y-4" },
                React.createElement('div', { className: "bg-slate-100 p-3 rounded-xl border border-slate-200 flex justify-between items-center" },
                    React.createElement('div', null,
                        React.createElement('p', { className: "text-xs font-bold text-slate-500 uppercase line-clamp-1" }, product.name),
                        React.createElement('p', { className: "text-[10px] text-slate-400 font-mono" }, `Cód: #${product.code}`)
                    ),
                    React.createElement('div', { className: "text-right" },
                        React.createElement('p', { className: "text-[10px] text-slate-400 uppercase font-bold" }, "Estoque Atual"),
                        React.createElement('p', { className: "font-bold text-slate-800" }, `${product.quantity} un.`)
                    )
                ),
                React.createElement('div', null,
                    React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Tipo de Movimentação *"),
                    React.createElement('select', { className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 bg-white", value: type, onChange: e => setType(e.target.value) },
                        React.createElement('optgroup', { label: "Entradas (Soma Estoque)" },
                            React.createElement('option', { value: "compra" }, "Compra de Mercadoria"),
                            React.createElement('option', { value: "ajuste_entrada" }, "Ajuste de Entrada (+)")
                        ),
                        React.createElement('optgroup', { label: "Saídas (Subtrai Estoque)" },
                            React.createElement('option', { value: "ajuste_saida" }, "Ajuste de Saída (-)"),
                            React.createElement('option', { value: "avaria" }, "Avaria / Perda / Vencido")
                        )
                    )
                ),
                React.createElement('div', { className: "grid grid-cols-2 gap-3" },
                    React.createElement('div', null,
                        React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Qtd *"),
                        React.createElement('input', { type: "number", min: "1", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 text-center font-bold", value: quantity, onChange: e => setQuantity(e.target.value), placeholder: "0" })
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Custo Unitário (R$)"),
                        React.createElement(MoneyInput, { value: unitCost, onChange: setUnitCost, disabled: !isEntry, className: `w-full p-3 pl-8 border border-slate-200 rounded-lg outline-none font-bold text-sm ${isEntry ? 'focus:ring-2 focus:ring-yellow-500 bg-white' : 'bg-slate-100 text-slate-400'}` })
                    )
                ),
                type === 'compra' && React.createElement('div', { className: "bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-[10px] text-yellow-800 leading-tight" },
                    React.createElement('span', { className: "font-bold block mb-1" }, "Cálculo de Custo Médio Ativo!"),
                    "Ao registrar uma compra, o sistema unirá o valor atual do estoque com o valor desta nova compra e calculará automaticamente o novo custo base do produto."
                ),
                React.createElement('div', null,
                    React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Observações (Opcional)"),
                    React.createElement('input', { type: "text", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 text-sm", value: notes, onChange: e => setNotes(e.target.value), placeholder: "NFe, motivo..." })
                )
            ),
            React.createElement('div', { className: "p-4 border-t border-slate-100 flex gap-3 bg-white rounded-b-2xl" },
                React.createElement('button', { onClick: onClose, className: "flex-1 p-3 text-slate-500 font-bold bg-slate-100 rounded-xl hover:bg-slate-200" }, "Cancelar"),
                React.createElement('button', { onClick: handleSubmit, className: `flex-1 p-3 text-white font-bold rounded-xl shadow-lg ${isEntry ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' : 'bg-red-500 hover:bg-red-600 shadow-red-200'}` }, `Confirmar ${isEntry ? 'Entrada' : 'Saída'}`)
            )
        )
    );
};

export const CustomerFormModal = ({ isOpen, onClose, onSave, initialData }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [documentData, setDocumentData] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [profession, setProfession] = useState('');
    const [income, setIncome] = useState('');
    
    const [cep, setCep] = useState('');
    const [street, setStreet] = useState('');
    const [number, setNumber] = useState('');
    const [complement, setComplement] = useState('');
    const [reference, setReference] = useState('');
    const [neighborhood, setNeighborhood] = useState('');
    const [cityState, setCityState] = useState('');
    const [loadingCep, setLoadingCep] = useState(false);

    useEffect(() => {
        if (initialData && isOpen) {
            setName(initialData.name || ''); setPhone(initialData.phone || ''); setDocumentData(initialData.document || ''); setBirthDate(initialData.birthDate || '');
            setProfession(initialData.profession || ''); setIncome(initialData.income ? maskMoney((initialData.income * 100).toFixed(0)) : '');
            setCep(initialData.cep || ''); setStreet(initialData.street || ''); setNumber(initialData.number || ''); setComplement(initialData.complement || '');
            setReference(initialData.reference || ''); setNeighborhood(initialData.neighborhood || ''); setCityState(initialData.cityState || '');
        } else if (isOpen) {
            setName(''); setPhone(''); setDocumentData(''); setBirthDate(''); setProfession(''); setIncome('');
            setCep(''); setStreet(''); setNumber(''); setComplement(''); setReference(''); setNeighborhood(''); setCityState('');
        }
    }, [initialData, isOpen]);

    const handleCepBlur = async () => {
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length === 8) {
            setLoadingCep(true);
            try {
                const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
                const data = await res.json();
                if (!data.erro) {
                    setStreet(data.logradouro || '');
                    setNeighborhood(data.bairro || '');
                    setCityState(`${data.localidade || ''}/${data.uf || ''}`);
                }
            } catch (e) { console.error(e); }
            setLoadingCep(false);
        }
    };

    const handleSubmit = () => {
        if (!name) return alert("O Nome Completo é obrigatório.");
        onSave({ 
            name: name.toUpperCase(), 
            phone, 
            document: documentData, 
            birthDate, 
            profession: profession.toUpperCase(),
            income: parseMoney(income),
            cep, 
            street: street.toUpperCase(), 
            number, 
            complement, 
            reference, 
            neighborhood: neighborhood.toUpperCase(), 
            cityState: cityState.toUpperCase() 
        });
    };

    if (!isOpen) return null;

    return React.createElement('div', { className: "app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[90]" },
        React.createElement('div', { className: "app-modal-panel desktop-modal desktop-modal-customer-form bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in flex flex-col max-h-[95vh]" },
            React.createElement('div', { className: "desktop-modal-header p-6 border-b border-slate-100 flex justify-between items-center shrink-0" },
                React.createElement('h3', { className: "text-xl font-bold text-slate-800 flex items-center gap-2" }, React.createElement(User, { className: "text-yellow-500" }), initialData ? 'Editar Cliente' : 'Novo Cliente'),
                React.createElement('button', { onClick: onClose, className: "p-2 bg-slate-100 rounded-full hover:bg-slate-200" }, React.createElement(X, { size: 20 }))
            ),
            React.createElement('div', { className: "desktop-modal-body customer-form-grid p-6 overflow-y-auto flex-1 space-y-4 no-scrollbar" },
                React.createElement('div', { className: "bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3" },
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase" }, "Dados Pessoais & Financeiros"),
                    React.createElement('div', null,
                        React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Nome Completo *"),
                        React.createElement('input', { autoFocus: true, className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 uppercase", value: name, onChange: e => setName(e.target.value.toUpperCase()) })
                    ),
                    React.createElement('div', { className: "grid grid-cols-2 gap-3" },
                        React.createElement('div', null,
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "WhatsApp"),
                            React.createElement('input', { type: "tel", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: phone, onChange: e => setPhone(maskPhone(e.target.value)), placeholder: "(00) 00000-0000" })
                        ),
                        React.createElement('div', null,
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "CPF / CNPJ"),
                            React.createElement('input', { type: "text", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: documentData, onChange: e => setDocumentData(maskCpfCnpj(e.target.value)), placeholder: "000.000.000-00" })
                        )
                    ),
                    React.createElement('div', { className: "grid grid-cols-3 gap-3" },
                        React.createElement('div', { className: "col-span-1" },
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Nascimento"),
                            React.createElement('input', { type: "date", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 text-sm", value: birthDate, onChange: e => setBirthDate(e.target.value) })
                        ),
                        React.createElement('div', { className: "col-span-1" },
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Profissão"),
                            React.createElement('input', { type: "text", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 uppercase text-sm", value: profession, onChange: e => setProfession(e.target.value), placeholder: "Ex: Professor" })
                        ),
                        React.createElement('div', { className: "col-span-1" },
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Renda Mensal"),
                            React.createElement(MoneyInput, { value: income, onChange: setIncome, className: "w-full p-3 pl-8 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 text-sm" })
                        )
                    )
                ),
                React.createElement('div', { className: "bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-sm" },
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase" }, "Endereço"),
                    React.createElement('div', { className: "grid grid-cols-2 gap-3 items-end" },
                        React.createElement('div', null,
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "CEP"),
                            React.createElement('input', { type: "text", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: cep, onChange: e => setCep(maskCep(e.target.value)), onBlur: handleCepBlur, placeholder: "00000-000" })
                        ),
                        React.createElement('div', { className: "pb-3" }, loadingCep && React.createElement('span', { className: "text-xs text-yellow-600 font-bold animate-pulse" }, "Buscando..."))
                    ),
                    React.createElement('div', { className: "grid grid-cols-4 gap-3" },
                        React.createElement('div', { className: "col-span-3" },
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Rua / Logradouro"),
                            React.createElement('input', { type: "text", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 uppercase", value: street, onChange: e => setStreet(e.target.value.toUpperCase()) })
                        ),
                        React.createElement('div', { className: "col-span-1" },
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Nº"),
                            React.createElement('input', { type: "text", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 uppercase", value: number, onChange: e => setNumber(e.target.value) })
                        )
                    ),
                    React.createElement('div', { className: "grid grid-cols-2 gap-3" },
                        React.createElement('div', null,
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Bairro"),
                            React.createElement('input', { type: "text", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 uppercase", value: neighborhood, onChange: e => setNeighborhood(e.target.value.toUpperCase()) })
                        ),
                        React.createElement('div', null,
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Cidade/UF"),
                            React.createElement('input', { type: "text", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 uppercase", value: cityState, onChange: e => setCityState(e.target.value.toUpperCase()) })
                        )
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Complemento"),
                        React.createElement('input', { type: "text", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: complement, onChange: e => setComplement(e.target.value) })
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Ponto de Referência"),
                        React.createElement('input', { type: "text", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: reference, onChange: e => setReference(e.target.value) })
                    )
                )
            ),
            React.createElement('div', { className: "desktop-modal-footer p-6 border-t border-slate-100 flex gap-3 shrink-0 bg-white rounded-b-2xl" },
                React.createElement('button', { onClick: onClose, className: "flex-1 p-3 text-slate-500 font-bold bg-slate-100 rounded-xl hover:bg-slate-200" }, "Cancelar"),
                React.createElement('button', { onClick: handleSubmit, className: "flex-1 p-3 bg-slate-900 text-yellow-400 font-bold rounded-xl hover:bg-slate-800 shadow-lg" }, "Salvar Cliente")
            )
        )
    );
};

export const SaleDetailsModal = ({ isOpen, onClose, sale, onPay, onEdit, onDeletePayment, onCancelSale, onDeleteSale, onOpenWA, onShowPixCode, hasPixSetup }) => {
    if (!isOpen || !sale) return null;

    const pendingAmount = sale.installments ? sale.installments.filter(i => !i.paid).reduce((acc, i) => acc + i.amount, 0) : 0;
    const paidInstallments = sale.installments ? sale.installments.filter(i => i.paid).length : 0;
    const totalInst = sale.installmentsCount || 0;

    const feeAmount = Number(sale.feeConfig?.value) || 0;
    const hasSavedNetAmount = sale.netReceived !== undefined && sale.netReceived !== null && sale.netReceived !== '';
    const savedNetAmount = Number(sale.netReceived);
    const directNetAmount = hasSavedNetAmount && Number.isFinite(savedNetAmount)
        ? savedNetAmount
        : (Number(sale.totalPrice) || 0) - feeAmount;

    const profit = sale.saleType === 'direct'
        ? directNetAmount - (sale.totalCost || 0)
        : (sale.totalPrice || 0) - (sale.totalCost || 0);

    const waType = sale.saleType === 'direct' ? 'comprovante' : (sale.status === 'completed' ? 'quitacao' : 'registro');
    const waTitle = sale.saleType === 'direct' ? 'Enviar Comprovante' : (sale.status === 'completed' ? 'Enviar Quitação' : 'Enviar Resumo da Venda');

    return React.createElement('div', { className: "app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[55] backdrop-blur-sm" },
        React.createElement('div', { className: "app-modal-panel desktop-modal desktop-modal-sale-details bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl animate-fade-in" },
            React.createElement('div', { className: "desktop-modal-header p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl shrink-0" },
                React.createElement('div', null,
                    React.createElement('h3', { className: "font-bold text-lg text-slate-800 flex items-center gap-2" }, 
                        "Detalhes da " + (sale.saleType === 'direct' ? "Venda" : "Cobrança"),
                        sale.creditAnalysis?.approvedBySystem === false && React.createElement(ShieldAlert, { size: 16, className: "text-red-500", title: "Aprovado Manualmente" })
                    ),
                    React.createElement('p', { className: "text-xs text-slate-500 font-medium" }, sale.customerName)
                ),
                React.createElement('div', { className: "flex gap-2 items-center" },
                    sale.status !== 'canceled' && React.createElement('button', { onClick: () => onOpenWA(waType, sale, null, null), className: "p-2 hover:bg-green-100 rounded-full transition-colors text-green-600", title: waTitle }, React.createElement(MessageCircle, { size: 20 })),
                    React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500" }, React.createElement(X, { size: 20 }))
                )
            ),
            
            React.createElement('div', { className: "desktop-modal-body sale-details-grid flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar relative" },
                sale.status === 'canceled' && React.createElement('div', { className: "absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-10" }, 
                    React.createElement('div', { className: "transform -rotate-45 text-red-600 font-black text-6xl border-4 border-red-600 p-4 rounded-xl uppercase tracking-widest" }, "Cancelado")
                ),

                sale.creditAnalysis?.approvedBySystem === false && sale.status !== 'canceled' && React.createElement('div', { className: "desktop-span-full bg-red-50 p-3 rounded-lg border border-red-100 relative z-10 text-sm" },
                    React.createElement('p', { className: "text-[10px] uppercase font-bold text-red-600 mb-1 flex items-center gap-1" }, React.createElement(ShieldAlert, { size: 14 }), "Exceção de Crédito"),
                    React.createElement('p', { className: "text-red-800 mb-1" }, React.createElement('strong', null, "Motivo da Reprovação: "), sale.creditAnalysis.result?.reason),
                    React.createElement('p', { className: "text-red-800 italic" }, React.createElement('strong', null, "Liberação Manual: "), `"${sale.creditAnalysis.manualApprovalReason}"`)
                ),

                React.createElement('div', { className: "sale-details-summary desktop-span-full flex justify-between items-center relative z-10" },
                    React.createElement('div', null,
                        React.createElement('p', { className: `font-bold text-2xl ${sale.status === 'canceled' ? 'text-red-500 line-through' : 'text-slate-800'}` }, formatCurrency(sale.totalPrice)),
                        React.createElement('p', { className: "text-sm text-slate-500" }, formatDate(sale.saleDate))
                    ),
                    React.createElement('span', { className: `px-3 py-1 rounded-full text-xs font-bold ${sale.status === 'canceled' ? 'bg-red-100 text-red-700' : sale.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}` }, sale.status === 'canceled' ? 'Cancelado' : sale.status === 'completed' ? 'Quitado' : 'Aberto')
                ),

                sale.status === 'canceled' && sale.cancelReason && React.createElement('div', { className: "desktop-span-full bg-red-50 p-3 rounded-lg border border-red-100 relative z-10" },
                    React.createElement('p', { className: "text-[10px] uppercase font-bold text-red-500 mb-1" }, "Motivo do Cancelamento:"),
                    React.createElement('p', { className: "text-sm text-red-700 italic" }, `"${sale.cancelReason}"`)
                ),

                sale.saleType === 'prazo' && React.createElement('div', { className: "sale-details-progress desktop-span-full flex justify-between items-center text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 relative z-10" },
                    React.createElement('span', { className: "flex items-center gap-1" }, React.createElement(CheckCircle, { size: 16, className: paidInstallments === totalInst && sale.status !== 'canceled' ? 'text-emerald-500' : 'text-slate-400' }), `Pagos: ${paidInstallments}/${totalInst}`),
                    React.createElement('span', { className: "font-bold" }, pendingAmount > 0 ? `Resta: ${formatCurrency(pendingAmount)}` : 'Concluído')
                ),

                React.createElement('div', { className: "sale-details-items bg-white p-4 rounded-xl border border-slate-200 relative z-10" },
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2" }, React.createElement(Package, { size: 14 }), "Itens da Venda"),
                    sale.items.map((item, idx) => React.createElement('div', { key: idx, className: "flex justify-between text-sm py-2 border-b border-slate-50 last:border-0" },
                        React.createElement('div', null,
                            React.createElement('span', { className: "text-slate-700" }, item.quantity ? `${item.quantity}x ${item.productName}` : item.productName),
                            item.unitDiscount > 0 && React.createElement('span', { className: "ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-1 rounded font-bold" }, `Desconto: ${formatCurrency(item.unitDiscount * item.quantity)}`)
                        ),
                        React.createElement('span', { className: "font-mono text-slate-800 font-bold" }, formatCurrency(item.price))
                    ))
                ),

                React.createElement('div', { className: "sale-details-finance bg-white p-4 rounded-xl border border-slate-200 space-y-3 relative z-10" },
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2" }, React.createElement(PieChart, { size: 14 }), "Resumo Financeiro"),
                    React.createElement('div', { className: "flex justify-between text-sm" }, React.createElement('span', { className: "text-slate-500" }, "Valor dos Produtos:"), React.createElement('span', { className: "text-slate-800 font-bold" }, formatCurrency((sale.totalPrice + (sale.totalDiscount||0)) - (sale.feeConfig?.type === 'com_juros' ? sale.feeConfig.value : 0)))),
                    sale.totalDiscount > 0 && React.createElement('div', { className: "flex justify-between text-sm text-emerald-600" }, React.createElement('span', null, "Descontos Aplicados:"), React.createElement('span', { className: "font-bold" }, `- ${formatCurrency(sale.totalDiscount)}`)),
                    sale.feeConfig && React.createElement('div', { className: "flex justify-between text-sm text-orange-600" }, React.createElement('span', null, sale.feeConfig.type === 'sem_juros' ? "Taxa Maquininha (Loja Paga):" : "Taxa Repassada (Cliente Paga):"), React.createElement('span', { className: "font-bold" }, `${sale.feeConfig.type === 'sem_juros' ? '-' : '+'} ${formatCurrency(sale.feeConfig.value)}`)),
                    sale.saleType === 'direct' && React.createElement('div', { className: "flex justify-between text-sm" }, React.createElement('span', { className: "text-slate-500" }, "Total Cobrado do Cliente:"), React.createElement('span', { className: "text-slate-800 font-bold" }, formatCurrency(sale.totalPrice || 0))),
                    sale.saleType === 'direct' && React.createElement('div', { className: "flex justify-between text-sm bg-emerald-50 p-2 rounded-lg" }, React.createElement('span', { className: "text-emerald-700 font-bold" }, "Líquido que Entra no Caixa:"), React.createElement('span', { className: "text-emerald-700 font-bold" }, formatCurrency(directNetAmount))),
                    React.createElement('div', { className: "flex justify-between text-sm" }, React.createElement('span', { className: "text-slate-500" }, "Custo Total:"), React.createElement('span', { className: "text-slate-800" }, formatCurrency(sale.totalCost || 0))),
                    
                    React.createElement('div', { className: "flex justify-between text-sm font-bold text-emerald-600 pt-2 border-t border-slate-100 mt-1" }, 
                        React.createElement('span', null, "Lucro Estimado:"), 
                        React.createElement('span', null, formatCurrency(profit))
                    )
                ),

                sale.saleType === 'direct' && React.createElement(React.Fragment, null,
                    (sale.paymentMethod === 'credit' || sale.paymentMethod === 'debit') && React.createElement('div', { className: "sale-details-payment bg-emerald-50 p-4 rounded-xl border border-emerald-100 space-y-3 relative z-10" },
                        sale.entryAmount > 0 && React.createElement('div', { className: "flex justify-between items-center text-sm" }, React.createElement('span', { className: "text-emerald-800" }, "Entrada (Dinheiro/Pix):"), React.createElement('span', { className: "font-bold text-emerald-800" }, formatCurrency(sale.entryAmount))),
                        React.createElement('div', { className: "flex justify-between items-center text-sm" }, React.createElement('span', { className: "text-emerald-800 flex items-center gap-1" }, React.createElement(Receipt, { size: 14 }), `Passado no Cartão (${sale.cardInstallments}x):`), React.createElement('span', { className: "font-bold text-emerald-800" }, formatCurrency(sale.cardAmount || sale.totalPrice))),
                        sale.feeConfig && React.createElement('div', { className: "text-[10px] text-emerald-700 bg-emerald-100 p-2 rounded space-y-1" },
                            React.createElement('div', null, `${sale.feeConfig.mode === 'link' ? 'Link Web' : 'Presencial'} - ${sale.feeConfig.brand === 'visa_master' ? 'Visa/Master' : 'Outras Bandeiras'} (${sale.feeConfig.percent}%)`),
                            React.createElement('div', null, `Taxa da administradora: ${formatCurrency(feeAmount)}`),
                            React.createElement('div', { className: "font-bold" }, `Líquido da venda: ${formatCurrency(directNetAmount)}`)
                        )
                    )
                ),

                (sale.saleType === 'prazo' || !sale.saleType) && sale.entryAmount > 0 && React.createElement('div', { className: "sale-details-entry bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center relative z-10" },
                    React.createElement('div', { className: "flex items-center gap-2" }, React.createElement(Wallet, { size: 18, className: "text-emerald-600" }), React.createElement('span', { className: "text-sm font-bold text-emerald-800" }, "Valor de Entrada")),
                    React.createElement('span', { className: "font-bold text-emerald-800 text-lg" }, formatCurrency(sale.entryAmount))
                ),

                (sale.saleType === 'prazo' || !sale.saleType) && React.createElement('div', { className: "sale-details-installments desktop-span-full space-y-3 relative z-10" },
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase flex items-center gap-2" }, React.createElement(Calendar, { size: 14 }), "Parcelamento"),
                    sale.installments && sale.installments.map((inst, idx) => {
                        const isOverdue = !inst.paid && inst.dueDate < getBrazilDateString();
                        let paidDisplayDate = '';
                        if (inst.paid && inst.paidAt) paidDisplayDate = formatDate(inst.paidAt);
                        
                        return React.createElement('div', { key: idx, className: "bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-sm" },
                            React.createElement('div', { className: "flex justify-between items-center" },
                                React.createElement('div', { className: "flex items-center gap-3" },
                                    sale.status !== 'canceled' && React.createElement('button', { onClick: () => onPay(sale, idx), className: `rounded-full p-2 transition-colors shadow-sm ${inst.paid ? 'bg-emerald-500 text-white cursor-default' : 'bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600'}` }, React.createElement(CheckCircle, { size: 20 })),
                                    React.createElement('div', null,
                                        React.createElement('p', { className: "text-sm font-bold text-slate-700" }, `Parcela ${inst.number}`),
                                        React.createElement('div', { className: "flex flex-col" },
                                            inst.paid && inst.paidAt ? React.createElement('span', { className: "text-xs text-emerald-600 font-bold" }, `Pago dia ${paidDisplayDate}`) : null,
                                            React.createElement('span', { className: `text-[11px] ${inst.paid ? 'text-slate-400' : isOverdue && sale.status !== 'canceled' ? 'text-red-500 font-bold' : 'text-slate-500'}` }, inst.paid ? `Vencia dia ${formatDate(inst.dueDate)}` : `Vence dia ${formatDate(inst.dueDate)}`)
                                        )
                                    )
                                ),
                                React.createElement('p', { className: `font-bold text-lg ${sale.status === 'canceled' ? 'text-slate-400 line-through' : 'text-slate-800'}` }, formatCurrency(inst.amount))
                            ),
                            inst.history && inst.history.length > 0 && React.createElement('div', { className: "mt-1 pt-3 border-t border-slate-100 text-xs bg-slate-50 -mx-4 px-4 pb-2" },
                                React.createElement('p', { className: "text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center gap-1" }, React.createElement(History, { size: 12 }), "Histórico de Pagamentos"),
                                inst.history.map((h, hIdx) => React.createElement('div', { key: hIdx, className: "flex justify-between items-center text-slate-600 py-1.5 border-b border-slate-100 last:border-0" },
                                    React.createElement('div', { className: "flex items-center gap-1" },
                                        React.createElement('span', null, h.type === 'abatement' ? 'Abatimento autom.' : formatDate(h.date)),
                                        h.type !== 'abatement' && sale.status !== 'canceled' && React.createElement('button', { onClick: (e) => { e.stopPropagation(); onOpenWA('recibo', sale, inst, h); }, className: "text-green-500 hover:text-green-600 bg-green-50 p-1 rounded transition-colors ml-1", title: "Enviar Recibo" }, React.createElement(MessageCircle, { size: 12 })),
                                        h.type !== 'abatement' && sale.status !== 'canceled' && React.createElement('button', { onClick: () => onDeletePayment(sale.id, idx, hIdx, h), className: "text-red-400 hover:text-red-600 bg-red-50 p-1 rounded transition-colors" }, React.createElement(XCircle, { size: 12 }))
                                    ),
                                    React.createElement('span', { className: "font-bold" }, formatCurrency(h.amount))
                                ))
                            ),
                            !inst.paid && sale.status !== 'canceled' ? React.createElement('div', { className: "flex gap-2 mt-2" },
                                React.createElement('button', { onClick: () => onEdit({ open: true, saleId: sale.id, installmentIndex: idx, data: inst }), className: "flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors" }, React.createElement(Edit2, { size: 14 }), "Ajustar"),
                                hasPixSetup && React.createElement('button', { onClick: () => onShowPixCode(sale, inst), className: "flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm" }, React.createElement(QrCode, { size: 14 }), "PIX"),
                                sale.customerPhone && React.createElement('button', { onClick: () => onOpenWA('cobranca', sale, inst, null), className: "flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors shadow-sm" }, React.createElement(MessageCircle, { size: 14 }), "Cobrar")
                            ) : (inst.paid && sale.status !== 'canceled') ? React.createElement('div', { className: "flex gap-2 mt-2" },
                                sale.customerPhone && React.createElement('button', { onClick: () => onOpenWA('recibo', sale, inst, null), className: "flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm border border-emerald-100" }, React.createElement(MessageCircle, { size: 14 }), "Enviar Recibo")
                            ) : null
                        );
                    })
                )
            ),
            React.createElement('div', { className: "desktop-modal-footer p-4 border-t border-slate-100 bg-white rounded-b-2xl shrink-0 flex flex-col gap-2" },
                sale.status !== 'canceled' && React.createElement('button', { onClick: () => onCancelSale(sale.id), className: "w-full py-3 text-orange-600 text-sm font-bold bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors border border-orange-100 flex items-center justify-center gap-2" }, React.createElement(PackageMinus, { size: 16 }), "Cancelar Venda e Voltar Estoque"),
                React.createElement('button', { onClick: () => { onDeleteSale('sale', sale.id); onClose(); }, className: "w-full py-3 text-red-400 hover:text-red-600 text-sm font-bold bg-white hover:bg-red-50 rounded-xl transition-colors border border-transparent flex items-center justify-center gap-2" }, React.createElement(Trash2, { size: 16 }), "Excluir Registro Permanentemente")
            )
        )
    );
};
