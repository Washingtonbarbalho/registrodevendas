import React from 'https://esm.sh/react@18.2.0';
import { PlusCircle, Search, QrCode, Banknote, CreditCard } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, formatDate } from './utils.js';
import { DateRangeFilter, Pagination } from './components.js';

export const AbaVendasCaixa = ({ setNewSaleMode, cashierPeriod, cashierStart, cashierEnd, setCashierPeriod, setCashierStart, setCashierEnd, cashierSearch, setCashierSearch, paginatedCashier, directSales, cashierPage, setCashierPage, setSelectedSaleDetail, ITEMS_PER_PAGE }) => {
    return React.createElement('div', { className: "space-y-4 animate-fade-in" },
        React.createElement('button', { 
            onClick: () => setNewSaleMode('direct'), 
            className: "w-full md:w-auto px-6 py-3 bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 mb-4 shadow-sm hover:bg-emerald-600 transition-colors"
        }, React.createElement(PlusCircle, { size: 20 }), "Nova Venda Direta"),

        React.createElement(DateRangeFilter, { period: cashierPeriod, startDate: cashierStart, endDate: cashierEnd, onPeriodChange: setCashierPeriod, onStartChange: setCashierStart, onEndChange: setCashierEnd }),
        React.createElement('div', { className: "relative mb-2" }, React.createElement(Search, { className: "absolute left-3 top-3 text-slate-400", size: 18 }), React.createElement('input', { className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none", placeholder: "Buscar venda...", value: cashierSearch, onChange: e => setCashierSearch(e.target.value.toUpperCase()) })),
        paginatedCashier.length === 0 ? React.createElement('p', { className: "text-center text-slate-400 py-10" }, "Nenhuma venda encontrada.") : 
        
        React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
            paginatedCashier.map(sale => {
                return React.createElement('div', { key: sale.id, className: `bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md cursor-pointer ${sale.status === 'canceled' ? 'opacity-50 grayscale' : ''}`, onClick: () => setSelectedSaleDetail(sale) },
                    React.createElement('div', { className: "p-4 flex flex-col gap-2 relative" },
                        sale.status === 'canceled' && React.createElement('div', { className: "absolute top-2 right-2" }, React.createElement('span', { className: "bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded font-bold" }, "Cancelado")),
                        React.createElement('div', { className: "flex justify-between items-start" },
                            React.createElement('div', null, React.createElement('p', { className: `font-bold text-lg ${sale.status === 'canceled' ? 'text-red-500 line-through' : 'text-slate-800'}` }, formatCurrency(sale.totalPrice)), React.createElement('p', { className: "text-sm text-slate-500" }, sale.customerName)),
                            React.createElement('div', { className: "flex flex-col items-end" },
                                React.createElement('span', { className: "bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded capitalize flex items-center gap-1 mt-1" }, sale.paymentMethod === 'pix' && React.createElement(QrCode, { size: 10 }), sale.paymentMethod === 'money' && React.createElement(Banknote, { size: 10 }), (sale.paymentMethod === 'credit' || sale.paymentMethod === 'debit') && React.createElement(CreditCard, { size: 10 }), sale.paymentMethod === 'credit' ? `Crédito ${sale.cardInstallments}x` : sale.paymentMethod === 'money' ? 'Dinheiro' : sale.paymentMethod === 'debit' ? 'Débito' : 'PIX'),
                                React.createElement('span', { className: "text-xs text-slate-400 mt-1" }, formatDate(sale.saleDate))
                            )
                        )
                    )
                );
            })
        ),
        React.createElement(Pagination, { totalItems: directSales.length, itemsPerPage: ITEMS_PER_PAGE, currentPage: cashierPage, onPageChange: setCashierPage })
    );
};
