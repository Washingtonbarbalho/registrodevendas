from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(name):
    return (ROOT / name).read_text(encoding='utf-8')


def write(name, content):
    (ROOT / name).write_text(content, encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: esperado 1 ocorrência, encontrado {count}')
    return text.replace(old, new, 1)


def section_replace(text, start, end, transform, label):
    start_pos = text.find(start)
    end_pos = text.find(end, start_pos)
    if start_pos < 0 or end_pos < 0:
        raise RuntimeError(f'{label}: seção não encontrada')
    section = text[start_pos:end_pos]
    updated = transform(section)
    return text[:start_pos] + updated + text[end_pos:]


# =========================================================
# app.js — aba atual, telas/modais abertos e títulos
# =========================================================
app = read('app.js')
app = replace_once(
    app,
    "import { getCurrentMonthStart, getCurrentMonthEnd, getBrazilDateString, addDays, formatCurrency, formatDate } from './utils.js';",
    "import { getCurrentMonthStart, getCurrentMonthEnd, getBrazilDateString, addDays, formatCurrency, formatDate } from './utils.js';\nimport { loadDraft, saveDraft } from './draft-storage.js?v=1';",
    'app import draft'
)

app = replace_once(
    app,
    "const Dashboard = ({ user, userProfile, onLogout }) => {\n    const [view, setView] = useState('dashboard');\n    const [showAdminPanel, setShowAdminPanel] = useState(false);",
    "const Dashboard = ({ user, userProfile, onLogout }) => {\n    const workspaceKey = `registro-vendas:workspace:${user.uid}`;\n    const restoredWorkspace = loadDraft(workspaceKey, {}) || {};\n    const validViews = ['dashboard', 'sales', 'cashier', 'products', 'customers'];\n    const [view, setView] = useState(validViews.includes(restoredWorkspace.view) ? restoredWorkspace.view : 'dashboard');\n    const [showAdminPanel, setShowAdminPanel] = useState(!!restoredWorkspace.showAdminPanel);",
    'app estado inicial'
)
app = replace_once(app, "    const [newSaleMode, setNewSaleMode] = useState(null);", "    const [newSaleMode, setNewSaleMode] = useState(restoredWorkspace.newSaleMode || null);", 'app nova venda')
app = replace_once(app, "    const [productModalData, setProductModalData] = useState({ open: false, data: null });", "    const [productModalData, setProductModalData] = useState(restoredWorkspace.productModalData || { open: false, data: null });", 'app produto modal')
app = replace_once(app, "    const [stockMovementData, setStockMovementData] = useState({ open: false, data: null });", "    const [stockMovementData, setStockMovementData] = useState(restoredWorkspace.stockMovementData || { open: false, data: null });", 'app estoque modal')
app = replace_once(app, "    const [customerModalData, setCustomerModalData] = useState({ open: false, data: null });", "    const [customerModalData, setCustomerModalData] = useState(restoredWorkspace.customerModalData || { open: false, data: null });", 'app cliente modal')
app = replace_once(app, "    const [profileModalOpen, setProfileModalOpen] = useState(false);", "    const [profileModalOpen, setProfileModalOpen] = useState(!!restoredWorkspace.profileModalOpen);", 'app perfil modal')
app = replace_once(app, "    const [editInstallmentModal, setEditInstallmentModal] = useState({ open: false, saleId: null, installmentIndex: null, data: null });", "    const [editInstallmentModal, setEditInstallmentModal] = useState(restoredWorkspace.editInstallmentModal || { open: false, saleId: null, installmentIndex: null, data: null });", 'app parcela modal')
app = replace_once(app, "    const [paymentModal, setPaymentModal] = useState({ open: false, saleId: null, index: null, item: null, isLast: false });", "    const [paymentModal, setPaymentModal] = useState(restoredWorkspace.paymentModal || { open: false, saleId: null, index: null, item: null, isLast: false });", 'app pagamento modal')

app = replace_once(
    app,
    "    useEffect(() => setCustomersPage(1), [customerSearch]);\n\n",
    "    useEffect(() => setCustomersPage(1), [customerSearch]);\n\n    useEffect(() => {\n        saveDraft(workspaceKey, {\n            view, showAdminPanel, newSaleMode, productModalData, stockMovementData,\n            customerModalData, profileModalOpen, editInstallmentModal, paymentModal\n        });\n    }, [workspaceKey, view, showAdminPanel, newSaleMode, productModalData, stockMovementData, customerModalData, profileModalOpen, editInstallmentModal, paymentModal]);\n\n",
    'app salvar workspace'
)

app = replace_once(
    app,
    "    if (showAdminPanel) return React.createElement(AdminUsersPanel, { onClose: () => setShowAdminPanel(false) });",
    "    if (showAdminPanel) return React.createElement(AdminUsersPanel, { onClose: () => setShowAdminPanel(false), draftKey: `registro-vendas:draft:${user.uid}:admin-user` });",
    'app admin prop'
)
app = replace_once(
    app,
    "            userProfile: userProfile,\n            user: user",
    "            userProfile: userProfile,\n            user: user,\n            draftKey: `registro-vendas:draft:${user.uid}:sale:${newSaleMode}`",
    'app sale draft prop'
)
app = replace_once(
    app,
    "                    React.createElement('p', { className: \"app-topbar-title truncate\" }, currentNav.label),\n                    React.createElement('p', { className: \"app-topbar-subtitle truncate\" }, `Olá, ${userProfile?.name?.split(' ')[0] || 'bem-vindo'} • ${userProfile?.storeName || 'Sua loja'}`)",
    "                    React.createElement('p', { className: \"app-topbar-title truncate\" }, userProfile?.storeName || 'Registro de Vendas'),\n                    React.createElement('p', { className: \"app-topbar-subtitle truncate\" }, `Olá, ${userProfile?.name?.split(' ')[0] || 'bem-vindo'} • Gestão comercial`)",
    'app topbar'
)
app = replace_once(
    app,
    "        React.createElement(UserProfileModal, { isOpen: profileModalOpen, onClose: () => setProfileModalOpen(false), userProfile: userProfile, onSave: handleUpdateProfile }),",
    "        React.createElement(UserProfileModal, { isOpen: profileModalOpen, onClose: () => setProfileModalOpen(false), userProfile: userProfile, onSave: handleUpdateProfile, draftKey: `registro-vendas:draft:${user.uid}:profile` }),",
    'app profile draft'
)
app = replace_once(
    app,
    "        React.createElement(CustomerFormModal, { isOpen: customerModalData.open, onClose: () => setCustomerModalData({open:false, data:null}), initialData: customerModalData.data, onSave: handleSaveCustomer }),",
    "        React.createElement(CustomerFormModal, { isOpen: customerModalData.open, onClose: () => setCustomerModalData({open:false, data:null}), initialData: customerModalData.data, onSave: handleSaveCustomer, draftKey: `registro-vendas:draft:${user.uid}:customer:${customerModalData.data?.id || 'new'}` }),",
    'app customer draft'
)
app = replace_once(
    app,
    "        React.createElement(EditInstallmentModal, { isOpen: editInstallmentModal.open, onClose: () => setEditInstallmentModal({ open: false, saleId: null, data: null }), installment: editInstallmentModal.data, onSave: saveEditedInstallment }),",
    "        React.createElement(EditInstallmentModal, { isOpen: editInstallmentModal.open, onClose: () => setEditInstallmentModal({ open: false, saleId: null, installmentIndex: null, data: null }), installment: editInstallmentModal.data, onSave: saveEditedInstallment, draftKey: `registro-vendas:draft:${user.uid}:installment:${editInstallmentModal.saleId || 'none'}:${editInstallmentModal.installmentIndex ?? 'none'}` }),",
    'app installment draft'
)
app = replace_once(
    app,
    "            lastCode: products.length > 0 ? String(products.reduce((max, product) => Math.max(max, parseInt(product.code || '0', 10) || 0), 0)).padStart(6, '0') : null",
    "            lastCode: products.length > 0 ? String(products.reduce((max, product) => Math.max(max, parseInt(product.code || '0', 10) || 0), 0)).padStart(6, '0') : null,\n            draftKey: `registro-vendas:draft:${user.uid}:product:${productModalData.data?.id || 'new'}`",
    'app product draft'
)
app = replace_once(
    app,
    "            product: stockMovementData.data,\n            onSave: handleStockMovement",
    "            product: stockMovementData.data,\n            onSave: handleStockMovement,\n            draftKey: `registro-vendas:draft:${user.uid}:stock:${stockMovementData.data?.id || 'none'}`",
    'app stock draft'
)
app = replace_once(
    app,
    "        React.createElement(PaymentConfirmationModal, { isOpen: paymentModal.open, onClose: () => setPaymentModal({ open: false, saleId: null, index: null, item: null, isLast: false }), onConfirm: handleConfirmPayment, installment: paymentModal.item, isLast: paymentModal.isLast }),",
    "        React.createElement(PaymentConfirmationModal, { isOpen: paymentModal.open, onClose: () => setPaymentModal({ open: false, saleId: null, index: null, item: null, isLast: false }), onConfirm: handleConfirmPayment, installment: paymentModal.item, isLast: paymentModal.isLast, draftKey: `registro-vendas:draft:${user.uid}:payment:${paymentModal.saleId || 'none'}:${paymentModal.index ?? 'none'}` }),",
    'app payment draft'
)
app = app.replace("./modals.js?v=4", "./modals.js?v=9").replace("./nova-venda.js?v=4", "./nova-venda.js?v=9").replace("./aba-vendas-caixa.js?v=4", "./aba-vendas-caixa.js?v=9")
write('app.js', app)


# =========================================================
# utils.js — limite manual, ativação e exceção de atraso
# =========================================================
utils = read('utils.js')
old_credit = '''export const analyzeCustomerCredit = (customerObj, requestedAmount, allSales) => {
    if(!customerObj) return { approved: false, reason: "Cliente não encontrado para análise.", availableLimit: 0, currentDebt: 0, calculatedLimit: 0 };

    const customerSales = allSales.filter(s => s.customerId === customerObj.id && (s.saleType === 'prazo' || !s.saleType));
    const today = getBrazilDateString();
    
    let hasOverdue = false;
    let currentDebt = 0;
    let paidOnTimeCount = 0;
    let paidLateCount = 0;
    let canceledSalesCount = 0;

    customerSales.forEach(s => {
        if (s.status === 'canceled') {
            canceledSalesCount++;
        } else {
            (s.installments || []).forEach(inst => {
                if (!inst.paid) {
                    currentDebt += inst.amount;
                    if (inst.dueDate < today) hasOverdue = true;
                } else {
                    if (inst.paidAt && inst.paidAt > inst.dueDate) {
                        paidLateCount++;
                    } else {
                        paidOnTimeCount++;
                    }
                }
            });
        }
    });

    const baseLimit = 150;
    const income = customerObj.income || 0;
    const absoluteMaxLimit = income > 0 ? income * 0.40 : 300; 

    let calculatedLimit = baseLimit + (paidOnTimeCount * 50) - (paidLateCount * 20) - (canceledSalesCount * 100);
    
    if (calculatedLimit < 0) calculatedLimit = 0;
    if (calculatedLimit > absoluteMaxLimit) calculatedLimit = absoluteMaxLimit;

    const availableLimit = Math.max(0, calculatedLimit - currentDebt);

    if (hasOverdue) {
        return { approved: false, reason: "Cliente bloqueado por inadimplência. Possui parcelas ativas em atraso.", availableLimit, calculatedLimit, currentDebt };
    }

    if (requestedAmount > availableLimit) {
        const suggestedEntry = requestedAmount - availableLimit;
        return { approved: false, reason: "Limite de crédito insuficiente para esta compra.", availableLimit, calculatedLimit, currentDebt, suggestedEntry };
    }

    return { approved: true, reason: "Crédito aprovado com base no histórico do cliente.", availableLimit, calculatedLimit, currentDebt };
};'''
new_credit = '''export const analyzeCustomerCredit = (customerObj, requestedAmount, allSales) => {
    if (!customerObj) return { approved: false, reason: "Cliente não encontrado para análise.", availableLimit: 0, currentDebt: 0, calculatedLimit: 0, creditActive: false };

    const customerSales = allSales.filter(s => s.customerId === customerObj.id && (s.saleType === 'prazo' || !s.saleType));
    const today = getBrazilDateString();
    const creditActive = customerObj.creditEnabled !== false;
    const ignoreOverdue = customerObj.creditIgnoreOverdue === true;

    let hasOverdue = false;
    let currentDebt = 0;
    let paidOnTimeCount = 0;
    let paidLateCount = 0;
    let canceledSalesCount = 0;

    customerSales.forEach(s => {
        if (s.status === 'canceled') {
            canceledSalesCount++;
        } else {
            (s.installments || []).forEach(inst => {
                if (!inst.paid) {
                    currentDebt += Number(inst.amount) || 0;
                    if (inst.dueDate < today) hasOverdue = true;
                } else if (inst.paidAt && inst.paidAt > inst.dueDate) {
                    paidLateCount++;
                } else {
                    paidOnTimeCount++;
                }
            });
        }
    });

    const baseLimit = 150;
    const income = Number(customerObj.income) || 0;
    const absoluteMaxLimit = income > 0 ? income * 0.40 : 300;
    let automaticLimit = baseLimit + (paidOnTimeCount * 50) - (paidLateCount * 20) - (canceledSalesCount * 100);
    automaticLimit = Math.max(0, Math.min(automaticLimit, absoluteMaxLimit));

    const hasManualLimit = customerObj.creditLimit !== undefined && customerObj.creditLimit !== null && customerObj.creditLimit !== '';
    const manualLimit = hasManualLimit ? Math.max(0, Number(customerObj.creditLimit) || 0) : null;
    const calculatedLimit = hasManualLimit ? manualLimit : automaticLimit;
    const availableLimit = creditActive ? Math.max(0, calculatedLimit - currentDebt) : 0;
    const baseResult = {
        availableLimit,
        calculatedLimit,
        automaticLimit,
        currentDebt,
        hasOverdue,
        creditActive,
        limitSource: hasManualLimit ? 'manual' : 'automatic'
    };

    if (!creditActive) {
        return { ...baseResult, approved: false, reason: "Cliente inativo para novas compras a prazo." };
    }

    if (hasOverdue && !ignoreOverdue) {
        return { ...baseResult, approved: false, reason: "Cliente bloqueado por inadimplência. Possui parcelas ativas em atraso." };
    }

    if (requestedAmount > availableLimit) {
        const suggestedEntry = requestedAmount - availableLimit;
        return { ...baseResult, approved: false, reason: "Limite de crédito insuficiente para esta compra.", suggestedEntry };
    }

    return {
        ...baseResult,
        approved: true,
        reason: hasManualLimit ? "Crédito aprovado pelo limite personalizado do cliente." : "Crédito aprovado com base no histórico do cliente."
    };
};'''
utils = replace_once(utils, old_credit, new_credit, 'utils crédito')
write('utils.js', utils)


# =========================================================
# aba-clientes.js — painel manual de crédito
# =========================================================
clientes = r'''import React, { useEffect, useState } from 'https://esm.sh/react@18.2.0';
import { Search, Phone, FileText, MapPin, ShieldCheck, Pencil, Trash2, Plus, Users, X, Lock, Unlock, SlidersHorizontal } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, analyzeCustomerCredit, maskMoney, parseMoney } from './utils.js?v=9';
import { Pagination, MoneyInput } from './components.js';
import { db, auth, APP_ID } from './firebase-config.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { loadDraft, saveDraft, clearDraft } from './draft-storage.js?v=1';

export const AbaClientes = ({ customerSearch, setCustomerSearch, setCustomerModalData, paginatedCustomers, sales, requestDelete, sortedCustomers, customersPage, setCustomersPage, ITEMS_PER_PAGE }) => {
    const userId = auth.currentUser?.uid || 'anonymous';
    const creditDraftKey = `registro-vendas:draft:${userId}:credit-settings`;
    const restoredCredit = loadDraft(creditDraftKey, null);
    const [creditModal, setCreditModal] = useState(restoredCredit?.creditModal || { open: false, customer: null });
    const [creditEnabled, setCreditEnabled] = useState(restoredCredit?.creditEnabled ?? true);
    const [limitMode, setLimitMode] = useState(restoredCredit?.limitMode || 'automatic');
    const [manualLimit, setManualLimit] = useState(restoredCredit?.manualLimit || '');
    const [ignoreOverdue, setIgnoreOverdue] = useState(restoredCredit?.ignoreOverdue || false);
    const [savingCredit, setSavingCredit] = useState(false);

    useEffect(() => {
        if (!creditModal.open) return;
        saveDraft(creditDraftKey, { creditModal, creditEnabled, limitMode, manualLimit, ignoreOverdue });
    }, [creditDraftKey, creditModal, creditEnabled, limitMode, manualLimit, ignoreOverdue]);

    const openCreditSettings = customer => {
        const hasManualLimit = customer.creditLimit !== undefined && customer.creditLimit !== null && customer.creditLimit !== '';
        setCreditModal({ open: true, customer });
        setCreditEnabled(customer.creditEnabled !== false);
        setLimitMode(hasManualLimit ? 'manual' : 'automatic');
        setManualLimit(hasManualLimit ? maskMoney(Math.round((Number(customer.creditLimit) || 0) * 100)) : '');
        setIgnoreOverdue(customer.creditIgnoreOverdue === true);
    };

    const closeCreditSettings = () => {
        clearDraft(creditDraftKey);
        setCreditModal({ open: false, customer: null });
    };

    const saveCreditSettings = async () => {
        const customer = creditModal.customer;
        if (!customer || !auth.currentUser) return;
        setSavingCredit(true);
        try {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'users', auth.currentUser.uid, 'customers', customer.id), {
                creditEnabled,
                creditLimit: limitMode === 'manual' ? Math.max(0, parseMoney(manualLimit)) : null,
                creditIgnoreOverdue: ignoreOverdue,
                creditUpdatedAt: new Date().toISOString()
            });
            closeCreditSettings();
        } catch (error) {
            console.error(error);
            alert('Não foi possível salvar as configurações de crédito.');
        } finally {
            setSavingCredit(false);
        }
    };

    const selectedCreditInfo = creditModal.customer ? analyzeCustomerCredit(creditModal.customer, 0, sales) : null;

    return React.createElement('section', { className: "page-stack animate-fade-in" },
        React.createElement('div', { className: "page-heading" },
            React.createElement('div', { className: "page-heading-copy" },
                React.createElement('h2', { className: "page-title" }, "Clientes"),
                React.createElement('p', { className: "page-description" }, "Dados de contato e situação de crédito em uma única lista.")
            ),
            React.createElement('button', {
                onClick: () => setCustomerModalData({ open: true, data: null }),
                className: "page-primary-action"
            }, React.createElement(Plus, { size: 18 }), "Novo cliente")
        ),

        React.createElement('div', { className: "toolbar" },
            React.createElement('div', { className: "toolbar-search" },
                React.createElement(Search, { size: 18 }),
                React.createElement('input', {
                    placeholder: "Buscar por nome ou documento...",
                    value: customerSearch,
                    onChange: event => setCustomerSearch(event.target.value.toUpperCase())
                })
            ),
            React.createElement('span', { className: "result-count" }, `${sortedCustomers.length} ${sortedCustomers.length === 1 ? 'cliente' : 'clientes'}`)
        ),

        React.createElement('div', { className: "list-shell" },
            React.createElement('div', { className: "list-header md:grid-cols-[minmax(0,1.7fr)_minmax(150px,1fr)_130px_140px_120px]" },
                React.createElement('span', null, "Cliente"),
                React.createElement('span', null, "Localização"),
                React.createElement('span', null, "Em aberto"),
                React.createElement('span', null, "Crédito"),
                React.createElement('span', { className: "text-right" }, "Ações")
            ),

            paginatedCustomers.length === 0
                ? React.createElement('div', { className: "empty-state" },
                    React.createElement('div', { className: "empty-state-icon" }, React.createElement(Users, { size: 22 })),
                    React.createElement('p', { className: "empty-state-title" }, "Nenhum cliente encontrado"),
                    React.createElement('p', { className: "empty-state-copy" }, "Tente mudar sua busca ou adicione um novo cadastro.")
                )
                : paginatedCustomers.map(customer => {
                    const creditInfo = analyzeCustomerCredit(customer, 0, sales);
                    const inactive = customer.creditEnabled === false;
                    const availableClass = inactive ? 'text-slate-400' : creditInfo.availableLimit > 0 ? 'text-emerald-700' : 'text-red-600';

                    return React.createElement('div', {
                        key: customer.id,
                        className: "list-row cursor-default grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.7fr)_minmax(150px,1fr)_130px_140px_120px]"
                    },
                        React.createElement('div', { className: "list-main" },
                            React.createElement('p', { className: "list-title" }, customer.name),
                            React.createElement('div', { className: "flex flex-wrap items-center gap-x-3 gap-y-1 mt-1" },
                                customer.phone && React.createElement('span', { className: "list-meta flex items-center gap-1" }, React.createElement(Phone, { size: 12 }), customer.phone),
                                customer.document && React.createElement('span', { className: "list-meta flex items-center gap-1" }, React.createElement(FileText, { size: 12 }), customer.document)
                            ),
                            React.createElement('div', { className: "md:hidden mt-3 flex flex-wrap gap-2" },
                                React.createElement('span', { className: "status-badge status-warning" }, `Em aberto: ${formatCurrency(creditInfo.currentDebt)}`),
                                inactive
                                    ? React.createElement('span', { className: "status-badge status-neutral" }, "Crédito inativo")
                                    : React.createElement('span', { className: `status-badge ${creditInfo.availableLimit > 0 ? 'status-paid' : 'status-canceled'}` }, `Disponível: ${formatCurrency(creditInfo.availableLimit)}`),
                                React.createElement('span', { className: "status-badge status-info" }, creditInfo.limitSource === 'manual' ? 'Limite manual' : 'Limite automático')
                            )
                        ),
                        React.createElement('div', { className: "hidden md:block list-meta" },
                            customer.cityState
                                ? React.createElement('span', { className: "flex items-center gap-1.5" }, React.createElement(MapPin, { size: 14, className: "text-slate-400" }), customer.cityState)
                                : React.createElement('span', { className: "text-slate-400" }, "Não informado")
                        ),
                        React.createElement('div', { className: "hidden md:block" },
                            React.createElement('span', { className: `text-xs font-extrabold ${creditInfo.currentDebt > 0 ? 'text-orange-600' : 'text-slate-400'}` }, formatCurrency(creditInfo.currentDebt))
                        ),
                        React.createElement('div', { className: "hidden md:flex items-center gap-1.5" },
                            React.createElement(inactive ? Lock : ShieldCheck, { size: 14, className: availableClass }),
                            React.createElement('div', null,
                                React.createElement('span', { className: `text-xs font-extrabold block ${availableClass}` }, inactive ? 'Inativo' : formatCurrency(creditInfo.availableLimit)),
                                !inactive && React.createElement('span', { className: "text-[9px] font-bold text-slate-400 uppercase" }, creditInfo.limitSource === 'manual' ? 'Manual' : 'Automático')
                            )
                        ),
                        React.createElement('div', { className: "list-actions" },
                            React.createElement('button', {
                                onClick: event => { event.stopPropagation(); openCreditSettings(customer); },
                                className: "list-action-button",
                                title: "Configurar crédito"
                            }, React.createElement(SlidersHorizontal, { size: 17 })),
                            React.createElement('button', {
                                onClick: event => { event.stopPropagation(); setCustomerModalData({ open: true, data: customer }); },
                                className: "list-action-button",
                                title: "Editar cliente"
                            }, React.createElement(Pencil, { size: 17 })),
                            React.createElement('button', {
                                onClick: event => { event.stopPropagation(); requestDelete('customer', customer.id); },
                                className: "list-action-button is-danger",
                                title: "Excluir cliente"
                            }, React.createElement(Trash2, { size: 17 }))
                        )
                    );
                })
        ),

        React.createElement(Pagination, {
            totalItems: sortedCustomers.length,
            itemsPerPage: ITEMS_PER_PAGE,
            currentPage: customersPage,
            onPageChange: setCustomersPage
        }),

        creditModal.open && creditModal.customer && React.createElement('div', { className: "app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[95]" },
            React.createElement('div', { className: "app-modal-panel bg-white rounded-2xl w-full max-w-md shadow-2xl animate-fade-in flex flex-col max-h-[92vh]" },
                React.createElement('div', { className: "p-4 border-b border-slate-100 flex justify-between items-center" },
                    React.createElement('div', null,
                        React.createElement('h3', { className: "font-bold text-lg text-slate-800 flex items-center gap-2" }, React.createElement(ShieldCheck, { className: "text-yellow-500" }), "Crédito a prazo"),
                        React.createElement('p', { className: "text-xs text-slate-400 mt-1" }, creditModal.customer.name)
                    ),
                    React.createElement('button', { onClick: closeCreditSettings, className: "p-2 hover:bg-slate-100 rounded-full" }, React.createElement(X, { size: 20 }))
                ),
                React.createElement('div', { className: "flex-1 overflow-y-auto p-4 space-y-4" },
                    React.createElement('div', { className: `p-4 rounded-xl border ${creditEnabled ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}` },
                        React.createElement('div', { className: "flex items-center justify-between gap-4" },
                            React.createElement('div', null,
                                React.createElement('p', { className: `font-bold text-sm ${creditEnabled ? 'text-emerald-800' : 'text-slate-600'}` }, creditEnabled ? "Cliente ativo para compras a prazo" : "Cliente inativo para compras a prazo"),
                                React.createElement('p', { className: "text-xs text-slate-500 mt-1" }, creditEnabled ? "Novas vendas serão avaliadas pelo limite configurado." : "O sistema recusará novas compras a prazo para este cliente.")
                            ),
                            React.createElement('button', {
                                onClick: () => setCreditEnabled(value => !value),
                                className: `shrink-0 px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 ${creditEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white'}`
                            }, React.createElement(creditEnabled ? Unlock : Lock, { size: 15 }), creditEnabled ? "Ativo" : "Inativo")
                        )
                    ),
                    React.createElement('div', { className: "bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3" },
                        React.createElement('p', { className: "text-xs font-bold text-slate-500 uppercase" }, "Definição do limite"),
                        React.createElement('div', { className: "grid grid-cols-2 gap-2" },
                            React.createElement('button', { onClick: () => setLimitMode('automatic'), className: `p-3 rounded-xl border text-xs font-bold ${limitMode === 'automatic' ? 'border-yellow-400 bg-yellow-50 text-yellow-800' : 'border-slate-200 bg-white text-slate-500'}` }, "Automático"),
                            React.createElement('button', { onClick: () => setLimitMode('manual'), className: `p-3 rounded-xl border text-xs font-bold ${limitMode === 'manual' ? 'border-yellow-400 bg-yellow-50 text-yellow-800' : 'border-slate-200 bg-white text-slate-500'}` }, "Personalizado")
                        ),
                        limitMode === 'manual'
                            ? React.createElement('div', null,
                                React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Limite total do cliente"),
                                React.createElement(MoneyInput, { value: manualLimit, onChange: setManualLimit, className: "w-full p-3 pl-9 border border-slate-200 rounded-xl font-bold" })
                            )
                            : React.createElement('div', { className: "bg-white border border-slate-200 rounded-xl p-3 flex justify-between items-center" },
                                React.createElement('span', { className: "text-xs text-slate-500" }, "Limite automático atual"),
                                React.createElement('strong', { className: "text-sm text-slate-800" }, formatCurrency(selectedCreditInfo?.automaticLimit || 0))
                            ),
                        React.createElement('label', { className: "flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer" },
                            React.createElement('input', { type: "checkbox", checked: ignoreOverdue, onChange: event => setIgnoreOverdue(event.target.checked), className: "mt-0.5 w-4 h-4" }),
                            React.createElement('span', null,
                                React.createElement('span', { className: "block text-xs font-bold text-slate-700" }, "Permitir mesmo com parcelas atrasadas"),
                                React.createElement('span', { className: "block text-[10px] text-slate-500 mt-1" }, "Use esta opção somente quando desejar liberar manualmente um cliente inadimplente.")
                            )
                        )
                    ),
                    React.createElement('div', { className: "grid grid-cols-2 gap-3" },
                        React.createElement('div', { className: "bg-white border border-slate-200 rounded-xl p-3" },
                            React.createElement('span', { className: "text-[10px] font-bold text-slate-400 uppercase block" }, "Dívida atual"),
                            React.createElement('strong', { className: "text-sm text-orange-600 mt-1 block" }, formatCurrency(selectedCreditInfo?.currentDebt || 0))
                        ),
                        React.createElement('div', { className: "bg-white border border-slate-200 rounded-xl p-3" },
                            React.createElement('span', { className: "text-[10px] font-bold text-slate-400 uppercase block" }, "Disponível após salvar"),
                            React.createElement('strong', { className: "text-sm text-emerald-600 mt-1 block" }, formatCurrency(creditEnabled ? Math.max(0, (limitMode === 'manual' ? parseMoney(manualLimit) : selectedCreditInfo?.automaticLimit || 0) - (selectedCreditInfo?.currentDebt || 0)) : 0))
                        )
                    )
                ),
                React.createElement('div', { className: "p-4 border-t border-slate-100 flex gap-3" },
                    React.createElement('button', { onClick: closeCreditSettings, className: "flex-1 p-3 bg-slate-100 text-slate-600 font-bold rounded-xl" }, "Cancelar"),
                    React.createElement('button', { onClick: saveCreditSettings, disabled: savingCredit, className: "flex-1 p-3 bg-slate-900 text-white font-bold rounded-xl disabled:opacity-50" }, savingCredit ? "Salvando..." : "Salvar crédito")
                )
            )
        )
    );
};
'''
write('aba-clientes.js', clientes)


# =========================================================
# nova-venda.js — rascunho completo da venda
# =========================================================
sale = read('nova-venda.js')
sale = replace_once(
    sale,
    "import { MoneyInput } from './components.js';",
    "import { MoneyInput } from './components.js';\nimport { loadDraft, saveDraft, clearDraft } from './draft-storage.js?v=1';",
    'sale import draft'
)
sale = replace_once(
    sale,
    "export const NewSaleScreen = ({ mode, onClose, customers, products, sales, onSaveSale, userProfile, user }) => {\n    useEffect(() => { window.scrollTo(0, 0); }, []);",
    "export const NewSaleScreen = ({ mode, onClose, customers, products, sales, onSaveSale, userProfile, user, draftKey }) => {\n    useEffect(() => { window.scrollTo(0, 0); }, []);\n    const saleDraftKey = draftKey || `registro-vendas:draft:${user.uid}:sale:${mode}`;\n    const [draftReady, setDraftReady] = useState(false);",
    'sale signature'
)
old_date_effect = '''    useEffect(() => { 
        const today = getBrazilDateString(); 
        setSaleDate(today); 
        setFirstDueDate(addDays(today, 30)); 
    }, []);
'''
new_date_effect = '''    useEffect(() => {
        const saved = loadDraft(saleDraftKey, null);
        if (saved) {
            setCustomerId(saved.customerId || '');
            setCustomerSearch(saved.customerSearch || '');
            setIsAddingCustomer(!!saved.isAddingCustomer);
            setNewCustName(saved.newCustName || '');
            setNewCustPhone(saved.newCustPhone || '');
            setNewCustProfession(saved.newCustProfession || '');
            setNewCustIncome(saved.newCustIncome || '');
            setProductSearch(saved.productSearch || '');
            setCart(Array.isArray(saved.cart) ? saved.cart : []);
            setSelectedProductId(saved.selectedProductId || '');
            setBaseUnitPrice(saved.baseUnitPrice || 0);
            setCurrentQty(saved.currentQty || 1);
            setCurrentCost(saved.currentCost || 0);
            setCurrentPrice(saved.currentPrice || '');
            setCurrentDiscount(saved.currentDiscount || '');
            setSaleDate(saved.saleDate || getBrazilDateString());
            setEntryAmount(saved.entryAmount || '');
            setFrequency(saved.frequency || 'monthly');
            setInstallmentsCount(saved.installmentsCount || 1);
            setFirstDueDate(saved.firstDueDate || addDays(getBrazilDateString(), 30));
            setDirectMethod(saved.directMethod || 'pix');
            setCardInstallments(saved.cardInstallments || 1);
            setCardMode(saved.cardMode || 'presencial');
            setCardBrand(saved.cardBrand || 'visa_master');
            setFeeType(saved.feeType || 'sem_juros');
            setFeePercent(saved.feePercent || '0,00');
            setCreditModal(saved.creditModal || { open: false, result: null, pendingSaleData: null, manualReason: '' });
            setApprovedSaleData(saved.approvedSaleData || null);
        } else {
            const today = getBrazilDateString();
            setSaleDate(today);
            setFirstDueDate(addDays(today, 30));
        }
        setDraftReady(true);
    }, [saleDraftKey]);

    useEffect(() => {
        if (!draftReady) return;
        saveDraft(saleDraftKey, {
            customerId, customerSearch, isAddingCustomer, newCustName, newCustPhone, newCustProfession, newCustIncome,
            productSearch, cart, selectedProductId, baseUnitPrice, currentQty, currentCost, currentPrice, currentDiscount,
            saleDate, entryAmount, frequency, installmentsCount, firstDueDate, directMethod, cardInstallments,
            cardMode, cardBrand, feeType, feePercent, creditModal, approvedSaleData
        });
    }, [draftReady, saleDraftKey, customerId, customerSearch, isAddingCustomer, newCustName, newCustPhone, newCustProfession, newCustIncome, productSearch, cart, selectedProductId, baseUnitPrice, currentQty, currentCost, currentPrice, currentDiscount, saleDate, entryAmount, frequency, installmentsCount, firstDueDate, directMethod, cardInstallments, cardMode, cardBrand, feeType, feePercent, creditModal, approvedSaleData]);
'''
sale = replace_once(sale, old_date_effect, new_date_effect, 'sale restore effect')

sale = replace_once(
    sale,
    "            onSaveSale(saleData); \n            onClose();",
    "            clearDraft(saleDraftKey);\n            onSaveSale(saleData); \n            onClose();",
    'sale direct clear'
)
sale = replace_once(
    sale,
    "        onSaveSale(saleDataToSave);\n        setCreditModal({ open: false, result: null, pendingSaleData: null, manualReason: '' });\n        onClose();",
    "        clearDraft(saleDraftKey);\n        onSaveSale(saleDataToSave);\n        setCreditModal({ open: false, result: null, pendingSaleData: null, manualReason: '' });\n        onClose();",
    'sale manual clear'
)
sale = replace_once(
    sale,
    "    if (isAnalyzingCredit) {",
    "    const discardAndClose = () => { clearDraft(saleDraftKey); onClose(); };\n\n    if (isAnalyzingCredit) {",
    'sale close helper'
)
sale = replace_once(sale, "onClick: () => { onSaveSale(approvedSaleData); onClose(); },", "onClick: () => { clearDraft(saleDraftKey); onSaveSale(approvedSaleData); onClose(); },", 'sale approved clear')
sale = replace_once(sale, "React.createElement('button', { onClick: onClose, className: \"p-2 hover:bg-black/10 rounded-full transition-colors\" }", "React.createElement('button', { onClick: discardAndClose, className: \"p-2 hover:bg-black/10 rounded-full transition-colors\" }", 'sale back close')
write('nova-venda.js', sale)


# =========================================================
# modals.js — rascunhos dos formulários
# =========================================================
modals = read('modals.js')
modals = replace_once(
    modals,
    "import { MoneyInput } from './components.js';",
    "import { MoneyInput } from './components.js';\nimport { loadDraft, saveDraft, clearDraft } from './draft-storage.js?v=1';",
    'modals import draft'
)

profile_component = r'''export const UserProfileModal = ({ isOpen, onClose, userProfile, onSave, draftKey }) => {
    const [name, setName] = useState('');
    const [storeName, setStoreName] = useState('');
    const [phone, setPhone] = useState('');
    const [pixType, setPixType] = useState('');
    const [pixKey, setPixKey] = useState('');
    const [pixBank, setPixBank] = useState('');
    const [pixName, setPixName] = useState('');

    useEffect(() => {
        if (isOpen && userProfile) {
            const saved = loadDraft(draftKey, null);
            const source = saved || userProfile;
            setName(source.name || ''); setStoreName(source.storeName || ''); setPhone(source.phone || '');
            setPixType(source.pixType || ''); setPixKey(source.pixKey || ''); setPixBank(source.pixBank || ''); setPixName(source.pixName || '');
        }
    }, [isOpen, userProfile, draftKey]);

    useEffect(() => {
        if (isOpen) saveDraft(draftKey, { name, storeName, phone, pixType, pixKey, pixBank, pixName });
    }, [isOpen, draftKey, name, storeName, phone, pixType, pixKey, pixBank, pixName]);

    const closeModal = () => { clearDraft(draftKey); onClose(); };
    const handleSave = () => { clearDraft(draftKey); onSave({ ...userProfile, name, storeName, phone, pixType, pixKey, pixBank, pixName }); };

    if (!isOpen) return null;
    return React.createElement('div', { className: "app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[80] backdrop-blur-sm" },
        React.createElement('div', { className: "app-modal-panel bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl animate-fade-in" },
            React.createElement('div', { className: "p-4 border-b border-slate-100 flex justify-between items-center" },
                React.createElement('h3', { className: "font-bold text-lg text-slate-800 flex items-center gap-2" }, React.createElement(User, { className: "text-yellow-500" }), "Meu Perfil"),
                React.createElement('button', { onClick: closeModal, className: "p-2 hover:bg-slate-100 rounded-full" }, React.createElement(X, { size: 20 }))
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
                React.createElement('button', { onClick: closeModal, className: "flex-1 p-3 text-slate-500 font-bold rounded-lg hover:bg-slate-50" }, "Cancelar"),
                React.createElement('button', { onClick: handleSave, className: "flex-1 p-3 bg-slate-900 text-white font-bold rounded-lg shadow-sm" }, "Salvar Alterações")
            )
        )
    );
};

'''
modals = re.sub(r"export const UserProfileModal = .*?\n};\n\n(?=export const PaymentConfirmationModal)", profile_component, modals, count=1, flags=re.S)

payment_component = r'''export const PaymentConfirmationModal = ({ isOpen, onClose, onConfirm, installment, isLast, draftKey }) => {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(getBrazilDateString());
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && installment) {
            const saved = loadDraft(draftKey, null);
            setAmount(saved?.amount || maskMoney((installment.amount * 100).toFixed(0)));
            setDate(saved?.date || getBrazilDateString());
            setError('');
        }
    }, [isOpen, installment, draftKey]);

    useEffect(() => { if (isOpen) saveDraft(draftKey, { amount, date }); }, [isOpen, draftKey, amount, date]);
    const closeModal = () => { clearDraft(draftKey); onClose(); };

    const handleConfirm = () => {
        const val = parseMoney(amount);
        if (val <= 0) { setError('Digite um valor válido.'); return; }
        const valCents = Math.round(val * 100);
        const instAmtCents = Math.round(installment.amount * 100);
        if (isLast && valCents > instAmtCents) { setError('Na última parcela não é permitido pagar valor maior que o restante.'); return; }
        clearDraft(draftKey);
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
                React.createElement('button', { onClick: closeModal, className: "flex-1 p-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl" }, "Cancelar"),
                React.createElement('button', { onClick: handleConfirm, className: "flex-1 p-3 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-600" }, "Confirmar")
            )
        )
    );
};

'''
modals = re.sub(r"export const PaymentConfirmationModal = .*?\n};\n\n(?=export const InstallmentListModal)", payment_component, modals, count=1, flags=re.S)

edit_component = r'''export const EditInstallmentModal = ({ isOpen, onClose, installment, onSave, draftKey }) => {
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');
    useEffect(() => {
        if (installment) {
            const saved = loadDraft(draftKey, null);
            setAmount(saved?.amount || maskMoney((installment.amount * 100).toFixed(0)));
            setDueDate(saved?.dueDate || installment.dueDate);
        }
    }, [installment, draftKey]);
    useEffect(() => { if (isOpen) saveDraft(draftKey, { amount, dueDate }); }, [isOpen, draftKey, amount, dueDate]);
    const closeModal = () => { clearDraft(draftKey); onClose(); };
    const handleSave = () => { clearDraft(draftKey); onSave({ ...installment, amount: parseMoney(amount), dueDate }); onClose(); };
    if (!isOpen || !installment) return null;
    return React.createElement('div', { className: "app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[60]" },
        React.createElement('div', { className: "app-modal-panel bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in" },
            React.createElement('h3', { className: "text-lg font-bold mb-4 flex items-center gap-2" }, React.createElement(Edit2, { size: 20, className: "text-yellow-600" }), `Editar Parcela ${installment.number}`),
            React.createElement('div', { className: "space-y-4" },
                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Valor (R$)"), React.createElement(MoneyInput, { value: amount, onChange: setAmount })),
                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Vencimento"), React.createElement('input', { type: "date", className: "w-full p-3 border border-slate-200 rounded-lg", value: dueDate, onChange: e => setDueDate(e.target.value) }))
            ),
            React.createElement('div', { className: "flex gap-3 mt-6" }, React.createElement('button', { onClick: closeModal, className: "flex-1 p-3 text-slate-500 font-bold" }, "Cancelar"), React.createElement('button', { onClick: handleSave, className: "flex-1 p-3 bg-slate-900 text-white font-bold rounded-xl" }, "Salvar"))
        )
    );
};

'''
modals = re.sub(r"export const EditInstallmentModal = .*?\n};\n\n(?=/\* --- MODAIS DE PRODUTO)", edit_component, modals, count=1, flags=re.S)


def patch_product(section):
    section = replace_once(section, "export const ProductModal = ({ isOpen, onClose, onSave, lastCode, initialData }) => {", "export const ProductModal = ({ isOpen, onClose, onSave, lastCode, initialData, draftKey }) => {", 'product signature')
    old = '''    useEffect(() => {
        if (initialData && isOpen) {
            setName(initialData.name || ''); setDescription(initialData.description || ''); 
            setSalePrice(initialData.salePrice || 0); setCostPrice(initialData.costPrice || 0); 
            setIsPromo(initialData.isPromo || false); setPromoPrice(initialData.promoPrice || 0); 
            setPromoStart(initialData.promoStart || ''); setPromoEnd(initialData.promoEnd || '');
        } else if (isOpen) {
            setName(''); setDescription(''); setSalePrice(''); setCostPrice('');
            setIsPromo(false); setPromoPrice(''); setPromoStart(''); setPromoEnd('');
        }
    }, [initialData, isOpen]);'''
    new = '''    useEffect(() => {
        if (!isOpen) return;
        const saved = loadDraft(draftKey, null);
        if (saved) {
            setName(saved.name || ''); setDescription(saved.description || ''); setSalePrice(saved.salePrice || ''); setCostPrice(saved.costPrice || '');
            setIsPromo(!!saved.isPromo); setPromoPrice(saved.promoPrice || ''); setPromoStart(saved.promoStart || ''); setPromoEnd(saved.promoEnd || '');
        } else if (initialData) {
            setName(initialData.name || ''); setDescription(initialData.description || '');
            setSalePrice(initialData.salePrice || 0); setCostPrice(initialData.costPrice || 0);
            setIsPromo(initialData.isPromo || false); setPromoPrice(initialData.promoPrice || 0);
            setPromoStart(initialData.promoStart || ''); setPromoEnd(initialData.promoEnd || '');
        } else {
            setName(''); setDescription(''); setSalePrice(''); setCostPrice(''); setIsPromo(false); setPromoPrice(''); setPromoStart(''); setPromoEnd('');
        }
    }, [initialData, isOpen, draftKey]);

    useEffect(() => { if (isOpen) saveDraft(draftKey, { name, description, salePrice, costPrice, isPromo, promoPrice, promoStart, promoEnd }); }, [isOpen, draftKey, name, description, salePrice, costPrice, isPromo, promoPrice, promoStart, promoEnd]);'''
    section = replace_once(section, old, new, 'product effect')
    section = replace_once(section, "        onSave(dataToSave);", "        clearDraft(draftKey);\n        onSave(dataToSave);", 'product clear save')
    section = replace_once(section, "    return React.createElement('div',", "    const closeModal = () => { clearDraft(draftKey); onClose(); };\n\n    return React.createElement('div',", 'product close helper')
    section = section.replace("onClick: onClose", "onClick: closeModal")
    return section

modals = section_replace(modals, "export const ProductModal", "export const ProductDetailsModal", patch_product, 'product section')


def patch_stock(section):
    section = replace_once(section, "export const StockMovementModal = ({ isOpen, onClose, product, onSave }) => {", "export const StockMovementModal = ({ isOpen, onClose, product, onSave, draftKey }) => {", 'stock signature')
    old = '''    useEffect(() => {
        if (isOpen && product) {
            setType('compra'); setQuantity(''); setNotes('');
            setUnitCost(maskMoney((product.costPrice * 100).toFixed(0)));
        }
    }, [isOpen, product]);'''
    new = '''    useEffect(() => {
        if (isOpen && product) {
            const saved = loadDraft(draftKey, null);
            setType(saved?.type || 'compra'); setQuantity(saved?.quantity || ''); setNotes(saved?.notes || '');
            setUnitCost(saved?.unitCost || maskMoney((product.costPrice * 100).toFixed(0)));
        }
    }, [isOpen, product, draftKey]);
    useEffect(() => { if (isOpen) saveDraft(draftKey, { type, quantity, unitCost, notes }); }, [isOpen, draftKey, type, quantity, unitCost, notes]);'''
    section = replace_once(section, old, new, 'stock effect')
    section = replace_once(section, "        onSave(product.id, { type, quantity: qtyVal, unitCost: costVal, notes });", "        clearDraft(draftKey);\n        onSave(product.id, { type, quantity: qtyVal, unitCost: costVal, notes });", 'stock clear save')
    section = replace_once(section, "    const isEntry =", "    const closeModal = () => { clearDraft(draftKey); onClose(); };\n    const isEntry =", 'stock close helper')
    section = section.replace("onClick: onClose", "onClick: closeModal")
    return section

modals = section_replace(modals, "export const StockMovementModal", "export const CustomerFormModal", patch_stock, 'stock section')


def patch_customer(section):
    section = replace_once(section, "export const CustomerFormModal = ({ isOpen, onClose, onSave, initialData }) => {", "export const CustomerFormModal = ({ isOpen, onClose, onSave, initialData, draftKey }) => {", 'customer signature')
    old = '''    useEffect(() => {
        if (initialData && isOpen) {
            setName(initialData.name || ''); setPhone(initialData.phone || ''); setDocumentData(initialData.document || ''); setBirthDate(initialData.birthDate || '');
            setProfession(initialData.profession || ''); setIncome(initialData.income ? maskMoney((initialData.income * 100).toFixed(0)) : '');
            setCep(initialData.cep || ''); setStreet(initialData.street || ''); setNumber(initialData.number || ''); setComplement(initialData.complement || '');
            setReference(initialData.reference || ''); setNeighborhood(initialData.neighborhood || ''); setCityState(initialData.cityState || '');
        } else if (isOpen) {
            setName(''); setPhone(''); setDocumentData(''); setBirthDate(''); setProfession(''); setIncome('');
            setCep(''); setStreet(''); setNumber(''); setComplement(''); setReference(''); setNeighborhood(''); setCityState('');
        }
    }, [initialData, isOpen]);'''
    new = '''    useEffect(() => {
        if (!isOpen) return;
        const saved = loadDraft(draftKey, null);
        const source = saved || initialData || {};
        setName(source.name || ''); setPhone(source.phone || ''); setDocumentData(source.documentData ?? source.document ?? ''); setBirthDate(source.birthDate || '');
        setProfession(source.profession || ''); setIncome(saved ? (source.income || '') : source.income ? maskMoney((source.income * 100).toFixed(0)) : '');
        setCep(source.cep || ''); setStreet(source.street || ''); setNumber(source.number || ''); setComplement(source.complement || '');
        setReference(source.reference || ''); setNeighborhood(source.neighborhood || ''); setCityState(source.cityState || '');
    }, [initialData, isOpen, draftKey]);

    useEffect(() => {
        if (isOpen) saveDraft(draftKey, { name, phone, documentData, birthDate, profession, income, cep, street, number, complement, reference, neighborhood, cityState });
    }, [isOpen, draftKey, name, phone, documentData, birthDate, profession, income, cep, street, number, complement, reference, neighborhood, cityState]);'''
    section = replace_once(section, old, new, 'customer effect')
    section = replace_once(section, "        onSave({ ", "        clearDraft(draftKey);\n        onSave({ ", 'customer clear save')
    section = replace_once(section, "    if (!isOpen) return null;", "    const closeModal = () => { clearDraft(draftKey); onClose(); };\n\n    if (!isOpen) return null;", 'customer close helper')
    section = section.replace("onClick: onClose", "onClick: closeModal")
    return section

modals = section_replace(modals, "export const CustomerFormModal", "export const SaleDetailsModal", patch_customer, 'customer section')
write('modals.js', modals)


# =========================================================
# auth-admin.js — manter edição de usuário após atualização
# =========================================================
auth = read('auth-admin.js')
auth = replace_once(auth, "import { Pagination } from './components.js';", "import { Pagination } from './components.js';\nimport { loadDraft, saveDraft, clearDraft } from './draft-storage.js?v=1';", 'auth import draft')
auth = replace_once(auth, "export const AdminUsersPanel = ({ onClose }) => {", "export const AdminUsersPanel = ({ onClose, draftKey }) => {", 'auth signature')
auth = replace_once(auth, "    const [editingUser, setEditingUser] = useState(null);", "    const [editingUser, setEditingUser] = useState(() => loadDraft(draftKey, null));", 'auth initial edit')
auth = replace_once(
    auth,
    "    useEffect(() => setCurrentPage(1), [searchTerm]);",
    "    useEffect(() => setCurrentPage(1), [searchTerm]);\n    useEffect(() => { if (editingUser) saveDraft(draftKey, editingUser); else clearDraft(draftKey); }, [draftKey, editingUser]);",
    'auth save edit'
)
auth = replace_once(auth, "        setEditingUser(null);", "        clearDraft(draftKey);\n        setEditingUser(null);", 'auth clear save')
auth = replace_once(auth, "onClick: () => setEditingUser(null)", "onClick: () => { clearDraft(draftKey); setEditingUser(null); }", 'auth clear cancel')
write('auth-admin.js', auth)


# =========================================================
# index.html — versão nova e cache dos módulos alterados
# =========================================================
index = read('index.html')
index = index.replace("./styles.css?v=8", "./styles.css?v=9")
index = index.replace("./modals-theme.css?v=1", "./modals-theme.css?v=2")
index = index.replace("./ui-refinements.css?v=1", "./ui-refinements.css?v=2")
index = index.replace("registro-vendas-cleanup-v8", "registro-vendas-cleanup-v9")
index = index.replace("const version = '8';", "const version = '9';")
index = index.replace("'aba-vendas-prazo', 'aba-vendas-caixa', 'aba-produtos', 'aba-clientes'", "'aba-vendas-prazo', 'aba-vendas-caixa', 'aba-produtos', 'aba-clientes', 'utils', 'draft-storage'")
write('index.html', index)

print('Recursos finais aplicados com sucesso.')
