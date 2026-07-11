import React, { useEffect, useState } from 'https://esm.sh/react@18.2.0';
import { Search, Phone, FileText, MapPin, ShieldCheck, Pencil, Trash2, Plus, Users, X, Lock, SlidersHorizontal } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, analyzeCustomerCredit, maskMoney, parseMoney } from './utils.js?v=10';
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
    const pendingLimit = limitMode === 'manual' ? parseMoney(manualLimit) : selectedCreditInfo?.automaticLimit || 0;
    const pendingAvailable = creditEnabled ? Math.max(0, pendingLimit - (selectedCreditInfo?.currentDebt || 0)) : 0;

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
                            }, React.createElement(creditEnabled ? ShieldCheck : Lock, { size: 15 }), creditEnabled ? "Ativo" : "Inativo")
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
                            React.createElement('strong', { className: "text-sm text-emerald-600 mt-1 block" }, formatCurrency(pendingAvailable))
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
