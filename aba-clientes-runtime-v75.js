// Gerado por scripts/consolidate-legacy-runtime-v75.mjs — clientes consolidados.
import React, { useState } from 'https://esm.sh/react@18.2.0';
import { createPortal } from 'https://esm.sh/react-dom@18.2.0';
import { Search, Phone, FileText, MapPin, ShieldCheck, Pencil, Trash2, Plus, Users, X, Lock, SlidersHorizontal, History } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, analyzeCustomerCredit, maskMoney, parseMoney } from './utils.js?v=76';
import { Pagination, MoneyInput } from './components.js?v=76';
import { CustomerPurchaseHistoryModal } from './customer-history-runtime-v75.js?v=76';
import { db, auth, APP_ID } from './firebase-config.js?v=76';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

export const AbaClientes = ({ customerSearch, setCustomerSearch, setCustomerModalData, paginatedCustomers, sales, requestDelete, sortedCustomers, customersPage, setCustomersPage, ITEMS_PER_PAGE }) => {
    const [historyModal, setHistoryModal] = useState({ open: false, customer: null });
    const [creditModal, setCreditModal] = useState({ open: false, customer: null });
    const [creditEnabled, setCreditEnabled] = useState(true);
    const [limitMode, setLimitMode] = useState('automatic');
    const [manualLimit, setManualLimit] = useState('');
    const [ignoreOverdue, setIgnoreOverdue] = useState(false);
    const [savingCredit, setSavingCredit] = useState(false);

    const openCreditSettings = customer => {
        const hasManualLimit = customer.creditLimit !== undefined && customer.creditLimit !== null && customer.creditLimit !== '';
        setCreditModal({ open: true, customer });
        setCreditEnabled(customer.creditEnabled !== false);
        setLimitMode(hasManualLimit ? 'manual' : 'automatic');
        setManualLimit(hasManualLimit ? maskMoney(Math.round((Number(customer.creditLimit) || 0) * 100)) : '');
        setIgnoreOverdue(customer.creditIgnoreOverdue === true);
    };

    const closeCreditSettings = () => {
        setCreditModal({ open: false, customer: null });
        setCreditEnabled(true);
        setLimitMode('automatic');
        setManualLimit('');
        setIgnoreOverdue(false);
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
    const pendingLimit = limitMode === 'manual' ? parseMoney(manualLimit) : selectedCreditInfo?.automaticLimit || 0;
    const pendingAvailable = creditEnabled ? Math.max(0, pendingLimit - (selectedCreditInfo?.currentDebt || 0)) : 0;

    const creditSettingsModal = creditModal.open && creditModal.customer
        ? createPortal(
            React.createElement('div', {
                className: "credit-settings-modal-overlay app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[9999]",
                role: "dialog",
                'aria-modal': "true",
                'aria-label': `Configurações de crédito de ${creditModal.customer.name}`
            },
                React.createElement('div', { className: "credit-settings-modal-panel app-modal-panel desktop-modal desktop-modal-credit bg-white rounded-2xl w-full max-w-md shadow-2xl animate-fade-in flex flex-col max-h-[92vh]" },
                    React.createElement('div', { className: "desktop-modal-header p-4 border-b border-slate-100 flex justify-between items-center" },
                        React.createElement('div', null,
                            React.createElement('h3', { className: "font-bold text-lg text-slate-800 flex items-center gap-2" }, React.createElement(ShieldCheck, { className: "text-yellow-500" }), "Crédito a prazo"),
                            React.createElement('p', { className: "text-xs text-slate-400 mt-1" }, creditModal.customer.name)
                        ),
                        React.createElement('button', { onClick: closeCreditSettings, className: "p-2 hover:bg-slate-100 rounded-full", 'aria-label': "Fechar" }, React.createElement(X, { size: 20 }))
                    ),
                    React.createElement('div', { className: "desktop-modal-body credit-settings-grid flex-1 overflow-y-auto p-4 space-y-4" },
                        React.createElement('div', { className: `credit-status-card desktop-span-full p-4 rounded-xl border ${creditEnabled ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}` },
                            React.createElement('div', { className: "flex items-center justify-between gap-4" },
                                React.createElement('div', null,
                                    React.createElement('p', { className: `font-bold text-sm ${creditEnabled ? 'text-emerald-800' : 'text-slate-600'}` }, creditEnabled ? "Cliente ativo para compras a prazo" : "Cliente inativo para compras a prazo"),
                                    React.createElement('p', { className: "text-xs text-slate-500 mt-1" }, creditEnabled ? "Novas vendas serão avaliadas pelo limite configurado." : "O sistema recusará novas compras a prazo para este cliente.")
                                ),
                                React.createElement('button', {
                                    onClick: () => setCreditEnabled(value => !value),
                                    className: `shrink-0 px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 ${creditEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white'}`
                                }, React.createElement(creditEnabled ? ShieldCheck : Lock, { size: 15 }), creditEnabled ? "Ativo" : "Inativo")
                            )
                        ),
                        React.createElement('div', { className: "credit-limit-card bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3" },
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
                        React.createElement('div', { className: "credit-summary-card grid grid-cols-2 gap-3" },
                            React.createElement('div', { className: "bg-white border border-slate-200 rounded-xl p-3" },
                                React.createElement('span', { className: "text-[10px] font-bold text-slate-400 uppercase block" }, "Dívida atual"),
                                React.createElement('strong', { className: "text-sm text-orange-600 mt-1 block" }, formatCurrency(selectedCreditInfo?.currentDebt || 0))
                            ),
                            React.createElement('div', { className: "bg-white border border-slate-200 rounded-xl p-3" },
                                React.createElement('span', { className: "text-[10px] font-bold text-slate-400 uppercase block" }, "Disponível após salvar"),
                                React.createElement('strong', { className: "text-sm text-emerald-600 mt-1 block" }, formatCurrency(pendingAvailable))
                            )
                        )
                    ),
                    React.createElement('div', { className: "desktop-modal-footer p-4 border-t border-slate-100 flex gap-3" },
                        React.createElement('button', { onClick: closeCreditSettings, className: "flex-1 p-3 bg-slate-100 text-slate-600 font-bold rounded-xl" }, "Cancelar"),
                        React.createElement('button', { onClick: saveCreditSettings, disabled: savingCredit, className: "flex-1 p-3 bg-slate-900 text-white font-bold rounded-xl disabled:opacity-50" }, savingCredit ? "Salvando..." : "Salvar crédito")
                    )
                )
            ),
            document.body
        )
        : null;

    return React.createElement(React.Fragment, null,
        React.createElement('section', { className: "page-stack animate-fade-in" },
            React.createElement('div', { className: "page-heading" },
                React.createElement('div', { className: "page-heading-copy" },
                    React.createElement('h2', { className: "page-title" }, "Clientes"),
                    React.createElement('p', { className: "page-description" }, "Dados de contato, crédito e histórico de compras em uma única lista.")
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
                React.createElement('div', { className: "list-header customer-list-header md:grid-cols-[minmax(0,1.7fr)_minmax(150px,1fr)_130px_140px_164px]" },
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
                            className: "list-row customer-list-row-actions cursor-default grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.7fr)_minmax(150px,1fr)_130px_140px_164px]"
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
                                    onClick: event => { event.stopPropagation(); setHistoryModal({ open: true, customer }); },
                                    className: "list-action-button",
                                    title: "Histórico de compras"
                                }, React.createElement(History, { size: 17 })),
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
            })
        ),
        React.createElement(CustomerPurchaseHistoryModal, {
            isOpen: historyModal.open,
            onClose: () => setHistoryModal({ open: false, customer: null }),
            customer: historyModal.customer,
            sales
        }),
        creditSettingsModal
    );
};
