import React from 'https://esm.sh/react@18.2.0';
import { Plus, Search, ShieldAlert, CheckCircle2, ChevronRight, Receipt } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, formatDate } from './utils.js';
import { DateRangeFilter, Pagination } from './components.js';

export const AbaVendasPrazo = ({ setNewSaleMode, salesPeriod, salesStart, salesEnd, setSalesPeriod, setSalesStart, setSalesEnd, salesSearch, setSalesSearch, paginatedSales, displayedSales, salesPage, setSalesPage, setSelectedSaleDetail, ITEMS_PER_PAGE }) => {
    return React.createElement('section', { className: "page-stack animate-fade-in" },
        React.createElement('div', { className: "page-heading" },
            React.createElement('div', { className: "page-heading-copy" },
                React.createElement('h2', { className: "page-title" }, "Vendas a prazo"),
                React.createElement('p', { className: "page-description" }, "Acompanhe parcelas, saldos pendentes e contratos quitados.")
            ),
            React.createElement('button', {
                onClick: () => setNewSaleMode('prazo'),
                className: "page-primary-action"
            }, React.createElement(Plus, { size: 18 }), "Nova venda a prazo")
        ),

        React.createElement(DateRangeFilter, {
            period: salesPeriod,
            startDate: salesStart,
            endDate: salesEnd,
            onPeriodChange: setSalesPeriod,
            onStartChange: setSalesStart,
            onEndChange: setSalesEnd
        }),

        React.createElement('div', { className: "toolbar" },
            React.createElement('div', { className: "toolbar-search" },
                React.createElement(Search, { size: 18 }),
                React.createElement('input', {
                    placeholder: "Buscar por cliente ou produto...",
                    value: salesSearch,
                    onChange: event => setSalesSearch(event.target.value.toUpperCase())
                })
            ),
            React.createElement('span', { className: "result-count" }, `${displayedSales.length} ${displayedSales.length === 1 ? 'venda' : 'vendas'}`)
        ),

        React.createElement('div', { className: "list-shell" },
            React.createElement('div', { className: "list-header md:grid-cols-[minmax(0,1.7fr)_130px_130px_150px_110px_34px]" },
                React.createElement('span', null, "Cliente / data"),
                React.createElement('span', null, "Valor total"),
                React.createElement('span', null, "Parcelas"),
                React.createElement('span', null, "Saldo pendente"),
                React.createElement('span', null, "Status"),
                React.createElement('span', null, "")
            ),

            paginatedSales.length === 0
                ? React.createElement('div', { className: "empty-state" },
                    React.createElement('div', { className: "empty-state-icon" }, React.createElement(Receipt, { size: 22 })),
                    React.createElement('p', { className: "empty-state-title" }, "Nenhuma venda a prazo encontrada"),
                    React.createElement('p', { className: "empty-state-copy" }, "Ajuste o período ou faça uma nova venda.")
                )
                : paginatedSales.map(sale => {
                    const installments = sale.installments || [];
                    const pendingAmount = installments.filter(item => !item.paid).reduce((total, item) => total + item.amount, 0);
                    const paidInstallments = installments.filter(item => item.paid).length;
                    const totalInstallments = sale.installmentsCount || installments.length || 0;
                    const statusLabel = sale.status === 'canceled' ? 'Cancelada' : sale.status === 'completed' ? 'Quitada' : 'Em aberto';
                    const statusClass = sale.status === 'canceled' ? 'status-canceled' : sale.status === 'completed' ? 'status-paid' : 'status-open';
                    const rowClass = sale.status === 'canceled' ? 'is-canceled' : sale.status === 'completed' ? 'is-completed' : '';

                    return React.createElement('div', {
                        key: sale.id,
                        onClick: () => setSelectedSaleDetail(sale),
                        className: `list-row ${rowClass} grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.7fr)_130px_130px_150px_110px_34px]`
                    },
                        React.createElement('div', { className: "list-main" },
                            React.createElement('div', { className: "flex items-center gap-2 min-w-0" },
                                React.createElement('p', { className: "list-title" }, sale.customerName),
                                sale.creditAnalysis?.approvedBySystem === false && React.createElement(ShieldAlert, { size: 14, className: "text-red-500 shrink-0", title: "Aprovada manualmente" })
                            ),
                            React.createElement('p', { className: "list-subtitle" }, `Venda em ${formatDate(sale.saleDate)}`),
                            React.createElement('div', { className: "md:hidden mt-3 flex items-center gap-2 flex-wrap" },
                                React.createElement('span', { className: `status-badge ${statusClass}` }, statusLabel),
                                React.createElement('span', { className: "status-badge status-neutral" }, `${paidInstallments}/${totalInstallments} pagas`)
                            )
                        ),
                        React.createElement('div', { className: "hidden md:block list-value" }, formatCurrency(sale.totalPrice)),
                        React.createElement('div', { className: "hidden md:flex items-center gap-2" },
                            React.createElement(CheckCircle2, { size: 15, className: paidInstallments === totalInstallments && totalInstallments > 0 ? 'text-emerald-500' : 'text-slate-400' }),
                            React.createElement('span', { className: "text-xs font-extrabold text-slate-700" }, `${paidInstallments}/${totalInstallments}`)
                        ),
                        React.createElement('div', { className: "hidden md:block" },
                            React.createElement('span', { className: `text-xs font-extrabold ${pendingAmount > 0 ? 'text-orange-600' : 'text-emerald-600'}` }, pendingAmount > 0 ? formatCurrency(pendingAmount) : "Concluída")
                        ),
                        React.createElement('div', { className: "hidden md:block" }, React.createElement('span', { className: `status-badge ${statusClass}` }, statusLabel)),
                        React.createElement('div', { className: "md:hidden text-right" },
                            React.createElement('span', { className: "list-label-mobile" }, "Saldo"),
                            React.createElement('p', { className: `list-value ${pendingAmount > 0 ? 'text-orange-600' : 'text-emerald-600'}` }, pendingAmount > 0 ? formatCurrency(pendingAmount) : "Quitada"),
                            React.createElement('p', { className: "mt-1 text-[10px] text-slate-400" }, `Total ${formatCurrency(sale.totalPrice)}`)
                        ),
                        React.createElement('div', { className: "hidden md:grid place-items-center text-slate-300" }, React.createElement(ChevronRight, { size: 18 }))
                    );
                })
        ),

        React.createElement(Pagination, {
            totalItems: displayedSales.length,
            itemsPerPage: ITEMS_PER_PAGE,
            currentPage: salesPage,
            onPageChange: setSalesPage
        })
    );
};
