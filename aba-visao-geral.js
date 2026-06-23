import React from 'https://esm.sh/react@18.2.0';
import { TrendingUp, Wallet, AlertTriangle, ChevronRight, Bell, PieChart, ArrowUpRight, BarChart3, ArrowDownRight } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency } from './utils.js';
import { DateRangeFilter } from './components.js';

export const AbaVisaoGeral = ({ dashPeriod, dashStartDate, dashEndDate, setDashPeriod, setDashStartDate, setDashEndDate, dashboardTotals, setInstallmentListModal }) => {
    return React.createElement('div', { className: "space-y-4 animate-fade-in" },
        React.createElement(DateRangeFilter, { period: dashPeriod, startDate: dashStartDate, endDate: dashEndDate, onPeriodChange: setDashPeriod, onStartChange: setDashStartDate, onEndChange: setDashEndDate }),
        
        React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" },
            React.createElement('div', { className: "bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center" }, React.createElement('div', null, React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase tracking-wider" }, "A Receber (Total)"), React.createElement('h3', { className: "text-2xl lg:text-3xl font-bold text-slate-800" }, formatCurrency(dashboardTotals.totalReceivable))), React.createElement('div', { className: "bg-blue-50 p-3 rounded-full" }, React.createElement(TrendingUp, { className: "text-blue-500" }))),
            
            React.createElement('div', { className: "bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center" }, React.createElement('div', null, React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase tracking-wider" }, "Entrou em Caixa"), React.createElement('h3', { className: "text-2xl lg:text-3xl font-bold text-emerald-600" }, formatCurrency(dashboardTotals.totalReceived)), React.createElement('p', { className: "text-xs text-slate-400 mt-1" }, "Neste período")), React.createElement('div', { className: "bg-emerald-50 p-3 rounded-full" }, React.createElement(Wallet, { className: "text-emerald-500" }))),

            React.createElement('div', { 
                onClick: () => setInstallmentListModal({ open: true, type: 'overdue', data: dashboardTotals.overdueList }),
                className: "bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between cursor-pointer hover:bg-red-50 transition-colors group h-32"
            }, 
                React.createElement('div', { className: "flex justify-between items-start mb-2" }, 
                    React.createElement('div', { className: "bg-red-50 group-hover:bg-white p-2 rounded-lg transition-colors" }, React.createElement(AlertTriangle, { size: 20, className: "text-red-500" })), 
                    React.createElement(ChevronRight, { size: 16, className: "text-slate-300 group-hover:text-red-300" })
                ), 
                React.createElement('div', null, 
                    React.createElement('p', { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-red-400" }, "Em Atraso"), 
                    React.createElement('h3', { className: "text-lg font-bold text-red-500" }, formatCurrency(dashboardTotals.totalOverdue))
                )
            ),

            React.createElement('div', { 
                onClick: () => setInstallmentListModal({ open: true, type: 'upcoming', data: dashboardTotals.upcomingList }),
                className: "bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between cursor-pointer hover:bg-yellow-50 transition-colors group h-32"
            }, 
                React.createElement('div', { className: "flex justify-between items-start mb-2" }, 
                    React.createElement('div', { className: "bg-yellow-50 group-hover:bg-white p-2 rounded-lg transition-colors" }, React.createElement(Bell, { size: 20, className: "text-yellow-600" })), 
                    React.createElement(ChevronRight, { size: 16, className: "text-slate-300 group-hover:text-yellow-300" })
                ), 
                React.createElement('div', null, 
                    React.createElement('p', { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-yellow-600" }, "A Vencer (7 dias)"), 
                    React.createElement('h3', { className: "text-lg font-bold text-yellow-600" }, formatCurrency(dashboardTotals.totalUpcoming))
                )
            )
        ),
        
        React.createElement('div', { className: "grid grid-cols-2 lg:grid-cols-4 gap-4" },
            React.createElement('div', { className: "bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between" }, React.createElement('div', { className: "flex justify-between items-start mb-2" }, React.createElement('div', { className: "bg-yellow-50 p-2 rounded-lg" }, React.createElement(PieChart, { size: 20, className: "text-yellow-600" })), React.createElement(ArrowUpRight, { size: 16, className: "text-slate-300" })), React.createElement('div', null, React.createElement('p', { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider" }, "Lucro Estimado"), React.createElement('h3', { className: "text-lg font-bold text-slate-800" }, formatCurrency(dashboardTotals.estimatedProfit)))),
            React.createElement('div', { className: "bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between" }, React.createElement('div', { className: "flex justify-between items-start mb-2" }, React.createElement('div', { className: "bg-purple-50 p-2 rounded-lg" }, React.createElement(BarChart3, { size: 20, className: "text-purple-600" })), React.createElement(ArrowDownRight, { size: 16, className: "text-slate-300" })), React.createElement('div', null, React.createElement('p', { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider" }, "Lucro Real (Cx)"), React.createElement('h3', { className: `text-lg font-bold ${dashboardTotals.realProfit >= 0 ? 'text-purple-600' : 'text-red-500'}` }, formatCurrency(dashboardTotals.realProfit))))
        )
    );
};
