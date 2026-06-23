import React from 'https://esm.sh/react@18.2.0';
import { PlusCircle, Search, ShieldAlert, CheckCircle } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, formatDate } from './utils.js';
import { DateRangeFilter, Pagination } from './components.js';

export const AbaVendasPrazo = ({ setNewSaleMode, salesPeriod, salesStart, salesEnd, setSalesPeriod, setSalesStart, setSalesEnd, salesSearch, setSalesSearch, paginatedSales, displayedSales, salesPage, setSalesPage, setSelectedSaleDetail, ITEMS_PER_PAGE }) => {
    return React.createElement('div', { className: "space-y-4 animate-fade-in" },
        React.createElement('button', { 
            onClick: () => setNewSaleMode('prazo'), 
            className: "w-full md:w-auto px-6 py-3 bg-yellow-500 text-slate-900 font-bold rounded-xl flex items-center justify-center gap-2 mb-4 shadow-sm hover:bg-yellow-400 transition-colors"
        }, React.createElement(PlusCircle, { size: 20 }), "Nova Venda à Prazo"),

        React.createElement(DateRangeFilter, { period: salesPeriod, startDate: salesStart, endDate: salesEnd, onPeriodChange: setSalesPeriod, onStartChange: setSalesStart, onEndChange: setSalesEnd }),
        React.createElement('div', { className: "relative mb-4" }, React.createElement(Search, { className: "absolute left-3 top-3 text-slate-400", size: 18 }), React.createElement('input', { className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none", placeholder: "Buscar cobrança...", value: salesSearch, onChange: e => setSalesSearch(e.target.value.toUpperCase()) })),
        paginatedSales.length === 0 && React.createElement('p', { className: "text-center text-slate-400 py-10" }, "Nenhuma cobrança encontrada."),
        
        React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
            paginatedSales.map(sale => {
                const pendingAmount = sale.installments ? sale.installments.filter(i => !i.paid).reduce((acc, i) => acc + i.amount, 0) : 0;
                const paidInstallments = sale.installments ? sale.installments.filter(i => i.paid).length : 0;
                const totalInst = sale.installmentsCount || 0;
                return React.createElement('div', { key: sale.id, className: `bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden transition-all hover:shadow-md cursor-pointer ${sale.status === 'completed' ? 'opacity-60 bg-slate-50' : sale.status === 'canceled' ? 'opacity-50 grayscale' : ''}`, onClick: () => setSelectedSaleDetail(sale) },
                    React.createElement('div', { className: "p-4" },
                        React.createElement('div', { className: "flex justify-between items-start mb-2" },
                            React.createElement('div', null, 
                                React.createElement('p', { className: "text-xs font-bold text-slate-500 uppercase flex items-center gap-1" }, sale.customerName, sale.creditAnalysis?.approvedBySystem === false && React.createElement(ShieldAlert, { size: 12, className: "text-red-500", title: "Aprovado Manualmente" })), 
                                React.createElement('p', { className: `font-bold text-lg ${sale.status === 'canceled' ? 'text-red-500 line-through' : 'text-slate-800'}` }, formatCurrency(sale.totalPrice)), 
                                React.createElement('p', { className: "text-xs text-slate-400 mt-0.5" }, formatDate(sale.saleDate))
                            ),
                            React.createElement('span', { className: `px-2 py-1 rounded text-xs font-bold ${sale.status === 'canceled' ? 'bg-red-100 text-red-700' : sale.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}` }, sale.status === 'canceled' ? 'Cancelado' : sale.status === 'completed' ? 'Quitado' : 'Aberto')
                        ),
                        sale.status !== 'canceled' && React.createElement('div', { className: "flex justify-between items-center text-xs text-slate-500 mt-2 pt-2 border-t border-slate-50" }, React.createElement('span', { className: "flex items-center gap-1" }, React.createElement(CheckCircle, { size: 12, className: paidInstallments === totalInst ? 'text-emerald-500' : 'text-slate-400' }), `Pagos: ${paidInstallments}/${totalInst}`), React.createElement('span', null, pendingAmount > 0 ? `Resta: ${formatCurrency(pendingAmount)}` : 'Concluído'))
                    )
                );
            })
        ),
        React.createElement(Pagination, { totalItems: displayedSales.length, itemsPerPage: ITEMS_PER_PAGE, currentPage: salesPage, onPageChange: setSalesPage })
    );
};
