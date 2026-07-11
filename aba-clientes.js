import React from 'https://esm.sh/react@18.2.0';
import { Search, Phone, FileText, MapPin, ShieldCheck, Pencil, Trash2, Plus, UsersRound } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, analyzeCustomerCredit } from './utils.js';
import { Pagination } from './components.js';

export const AbaClientes = ({ customerSearch, setCustomerSearch, setCustomerModalData, paginatedCustomers, sales, requestDelete, sortedCustomers, customersPage, setCustomersPage, ITEMS_PER_PAGE }) => {
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
            React.createElement('div', { className: "list-header md:grid-cols-[minmax(0,1.7fr)_minmax(150px,1fr)_130px_140px_86px]" },
                React.createElement('span', null, "Cliente"),
                React.createElement('span', null, "Localização"),
                React.createElement('span', null, "Em aberto"),
                React.createElement('span', null, "Limite disponível"),
                React.createElement('span', { className: "text-right" }, "Ações")
            ),

            paginatedCustomers.length === 0
                ? React.createElement('div', { className: "empty-state" },
                    React.createElement('div', { className: "empty-state-icon" }, React.createElement(UsersRound, { size: 22 })),
                    React.createElement('p', { className: "empty-state-title" }, "Nenhum cliente encontrado"),
                    React.createElement('p', { className: "empty-state-copy" }, "Tente mudar sua busca ou adicione um novo cadastro.")
                )
                : paginatedCustomers.map(customer => {
                    const creditInfo = analyzeCustomerCredit(customer, 0, sales);
                    const availableClass = creditInfo.availableLimit > 0 ? 'text-emerald-700' : 'text-red-600';

                    return React.createElement('div', {
                        key: customer.id,
                        className: "list-row cursor-default grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.7fr)_minmax(150px,1fr)_130px_140px_86px]"
                    },
                        React.createElement('div', { className: "list-main" },
                            React.createElement('p', { className: "list-title" }, customer.name),
                            React.createElement('div', { className: "flex flex-wrap items-center gap-x-3 gap-y-1 mt-1" },
                                customer.phone && React.createElement('span', { className: "list-meta flex items-center gap-1" }, React.createElement(Phone, { size: 12 }), customer.phone),
                                customer.document && React.createElement('span', { className: "list-meta flex items-center gap-1" }, React.createElement(FileText, { size: 12 }), customer.document)
                            ),
                            React.createElement('div', { className: "md:hidden mt-3 flex flex-wrap gap-2" },
                                React.createElement('span', { className: "status-badge status-warning" }, `Em aberto: ${formatCurrency(creditInfo.currentDebt)}`),
                                React.createElement('span', { className: `status-badge ${creditInfo.availableLimit > 0 ? 'status-paid' : 'status-canceled'}` }, `Limite: ${formatCurrency(creditInfo.availableLimit)}`)
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
                            React.createElement(ShieldCheck, { size: 14, className: availableClass }),
                            React.createElement('span', { className: `text-xs font-extrabold ${availableClass}` }, formatCurrency(creditInfo.availableLimit))
                        ),
                        React.createElement('div', { className: "list-actions" },
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
        })
    );
};
