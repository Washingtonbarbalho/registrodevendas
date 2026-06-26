import React, { useState, useMemo } from 'https://esm.sh/react@18.2.0';
import { Search, TrendingUp, TrendingDown, DollarSign, Plus, Filter, Calendar } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, formatDate } from './utils.js';

export const AbaFinanceiro = ({ allTransactions, onAddTransaction }) => {
    const [filterType, setFilterType] = useState('all'); // all, income, expense
    const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [search, setSearch] = useState('');

    const filteredTransactions = useMemo(() => {
        return allTransactions.filter(t => {
            const matchType = filterType === 'all' ? true : t.type === filterType;
            const matchMonth = t.date.startsWith(monthFilter);
            const matchSearch = t.description.toLowerCase().includes(search.toLowerCase()) || (t.category && t.category.toLowerCase().includes(search.toLowerCase()));
            return matchType && matchMonth && matchSearch;
        });
    }, [allTransactions, filterType, monthFilter, search]);

    const totals = useMemo(() => {
        const income = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        return { income, expense, balance: income - expense };
    }, [filteredTransactions]);

    return React.createElement('div', { className: "space-y-6 animate-fade-in" },
        // Resumo Financeiro (Cards)
        React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-3 gap-4" },
            React.createElement('div', { className: "bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden" },
                React.createElement('div', { className: "absolute top-0 right-0 p-4 opacity-10" }, React.createElement(TrendingUp, { size: 48, className: "text-emerald-500" })),
                React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase mb-1" }, "Total de Entradas"),
                React.createElement('p', { className: "text-2xl font-black text-emerald-600" }, formatCurrency(totals.income))
            ),
            React.createElement('div', { className: "bg-white p-5 rounded-2xl border border-red-100 shadow-sm relative overflow-hidden" },
                React.createElement('div', { className: "absolute top-0 right-0 p-4 opacity-10" }, React.createElement(TrendingDown, { size: 48, className: "text-red-500" })),
                React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase mb-1" }, "Total de Saídas"),
                React.createElement('p', { className: "text-2xl font-black text-red-500" }, formatCurrency(totals.expense))
            ),
            React.createElement('div', { className: "bg-slate-900 p-5 rounded-2xl shadow-lg relative overflow-hidden" },
                React.createElement('div', { className: "absolute top-0 right-0 p-4 opacity-10" }, React.createElement(DollarSign, { size: 48, className: "text-yellow-400" })),
                React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase mb-1" }, "Saldo do Período"),
                React.createElement('p', { className: `text-3xl font-black ${totals.balance >= 0 ? 'text-yellow-400' : 'text-red-400'}` }, formatCurrency(totals.balance))
            )
        ),

        // Filtros e Ações
        React.createElement('div', { className: "flex flex-col md:flex-row gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-100" },
            React.createElement('div', { className: "flex-1 relative" },
                React.createElement(Search, { className: "absolute left-3 top-3.5 text-slate-400", size: 18 }),
                React.createElement('input', { className: "w-full p-3 pl-10 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 text-sm", placeholder: "Buscar lançamento...", value: search, onChange: e => setSearch(e.target.value) })
            ),
            React.createElement('div', { className: "flex items-center gap-2 border border-slate-200 rounded-lg p-1 bg-slate-50" },
                React.createElement('input', { type: "month", className: "p-2 bg-transparent outline-none text-sm font-bold text-slate-700 w-36", value: monthFilter, onChange: e => setMonthFilter(e.target.value) })
            ),
            React.createElement('div', { className: "flex bg-slate-100 rounded-lg p-1" },
                [{id:'all', label:'Tudo'}, {id:'income', label:'Entradas'}, {id:'expense', label:'Saídas'}].map(opt => 
                    React.createElement('button', { key: opt.id, onClick: () => setFilterType(opt.id), className: `px-4 py-2 text-xs font-bold rounded-md transition-colors ${filterType === opt.id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}` }, opt.label)
                )
            ),
            React.createElement('button', { onClick: onAddTransaction, className: "bg-slate-900 text-yellow-400 px-4 py-3 rounded-lg font-bold shadow-md hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm whitespace-nowrap" }, 
                React.createElement(Plus, { size: 16 }), "Novo Lançamento"
            )
        ),

        // Lista de Transações
        React.createElement('div', { className: "bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden" },
            filteredTransactions.length === 0 ? React.createElement('div', { className: "p-10 text-center text-slate-400 flex flex-col items-center gap-2" },
                React.createElement(Filter, { size: 32, className: "opacity-20" }),
                React.createElement('p', null, "Nenhuma movimentação encontrada para estes filtros.")
            ) :
            React.createElement('div', { className: "divide-y divide-slate-50" },
                filteredTransactions.map((t, idx) => React.createElement('div', { key: t.id + idx, className: "p-4 hover:bg-slate-50 transition-colors flex justify-between items-center gap-4" },
                    React.createElement('div', { className: "flex items-center gap-4" },
                        React.createElement('div', { className: `w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}` },
                            t.type === 'income' ? React.createElement(TrendingUp, { size: 18 }) : React.createElement(TrendingDown, { size: 18 })
                        ),
                        React.createElement('div', null,
                            React.createElement('p', { className: "font-bold text-slate-800 text-sm" }, t.description),
                            React.createElement('div', { className: "flex items-center gap-2 mt-1" },
                                React.createElement('span', { className: "text-[10px] text-slate-500 flex items-center gap-1" }, React.createElement(Calendar, { size: 10 }), formatDate(t.date)),
                                React.createElement('span', { className: "text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase font-bold" }, t.category),
                                t.source === 'system' && React.createElement('span', { className: "text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-500 font-bold" }, "Automático")
                            )
                        )
                    ),
                    React.createElement('p', { className: `font-bold whitespace-nowrap ${t.type === 'income' ? 'text-emerald-600' : 'text-red-500'}` }, 
                        `${t.type === 'income' ? '+' : '-'} ${formatCurrency(t.amount)}`
                    )
                ))
            )
        )
    );
};
