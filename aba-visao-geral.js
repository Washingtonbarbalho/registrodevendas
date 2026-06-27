import React, { useState } from 'https://esm.sh/react@18.2.0';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Clock, AlertTriangle, ChevronRight, CheckCircle, Package } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency } from './utils.js';
import { FinancialListModal, InstallmentListModal } from './modals.js';

export const AbaVisaoGeral = ({ 
    dashPeriod, dashStartDate, dashEndDate, setDashPeriod, setDashStartDate, setDashEndDate, 
    dashboardTotals, allFinancialTransactions, onOpenTransactionModal, setInstallmentListModal, handlePayFromList, handleOpenWA 
}) => {
    const [cashInModalOpen, setCashInModalOpen] = useState(false);
    const [cashOutModalOpen, setCashOutModalOpen] = useState(false);
    const [receivablesModalOpen, setReceivablesModalOpen] = useState(false);

    // Filtra as transações para exibir dentro dos modais de acordo com o período escolhido
    const periodIncomes = allFinancialTransactions.filter(t => t.type === 'income' && t.date.split('T')[0] >= dashStartDate && t.date.split('T')[0] <= dashEndDate);
    const periodExpenses = allFinancialTransactions.filter(t => t.type === 'expense' && t.date.split('T')[0] >= dashStartDate && t.date.split('T')[0] <= dashEndDate);

    return React.createElement('div', { className: "space-y-6 animate-fade-in" },
        // 1. Filtros de Período
        React.createElement('div', { className: "flex flex-col md:flex-row gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-100 justify-between items-center" },
            React.createElement('div', { className: "flex bg-slate-100 rounded-lg p-1 w-full md:w-auto" },
                [{id:'month', label:'Este Mês'}, {id:'custom', label:'Personalizado'}].map(opt => 
                    React.createElement('button', { 
                        key: opt.id, 
                        onClick: () => setDashPeriod(opt.id), 
                        className: `flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-md transition-colors ${dashPeriod === opt.id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}` 
                    }, opt.label)
                )
            ),
            dashPeriod === 'custom' && React.createElement('div', { className: "flex items-center gap-2 w-full md:w-auto animate-fade-in" },
                React.createElement('input', { type: "date", className: "p-2 border border-slate-200 rounded-lg text-sm flex-1 md:w-36 outline-none focus:ring-1 focus:ring-yellow-500", value: dashStartDate, onChange: e => setDashStartDate(e.target.value) }),
                React.createElement('span', { className: "text-slate-400 font-bold text-sm" }, "até"),
                React.createElement('input', { type: "date", className: "p-2 border border-slate-200 rounded-lg text-sm flex-1 md:w-36 outline-none focus:ring-1 focus:ring-yellow-500", value: dashEndDate, onChange: e => setDashEndDate(e.target.value) })
            )
        ),

        // 2. CARDS FINANCEIROS (Clicáveis)
        React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-3 gap-4" },
            // A Receber
            React.createElement('div', { 
                onClick: () => setReceivablesModalOpen(true), 
                className: "bg-white p-5 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all group" 
            },
                React.createElement('div', { className: "absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity" }, React.createElement(Clock, { size: 48, className: "text-blue-500" })),
                React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase mb-1 flex items-center justify-between" }, "A Receber (Geral) 👆", React.createElement(ChevronRight, { size: 14, className: "text-blue-400" })),
                React.createElement('p', { className: "text-2xl font-black text-blue-600" }, formatCurrency(dashboardTotals.totalReceivable))
            ),
            
            // Entrou em Caixa
            React.createElement('div', { 
                onClick: () => setCashInModalOpen(true), 
                className: "bg-emerald-500 p-5 rounded-2xl shadow-lg relative overflow-hidden cursor-pointer hover:bg-emerald-600 hover:shadow-emerald-200 transition-all group text-white" 
            },
                React.createElement('div', { className: "absolute top-0 right-0 p-4 opacity-20 group-hover:scale-110 transition-transform" }, React.createElement(TrendingUp, { size: 48 })),
                React.createElement('p', { className: "text-xs font-bold text-emerald-100 uppercase mb-1 flex items-center justify-between" }, "Entrou em Caixa 👆", React.createElement(ChevronRight, { size: 14, className: "text-emerald-200" })),
                React.createElement('p', { className: "text-3xl font-black" }, formatCurrency(dashboardTotals.totalReceived))
            ),
            
            // Saiu do Caixa
            React.createElement('div', { 
                onClick: () => setCashOutModalOpen(true), 
                className: "bg-white p-5 rounded-2xl border border-red-100 shadow-sm relative overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all group" 
            },
                React.createElement('div', { className: "absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity" }, React.createElement(TrendingDown, { size: 48, className: "text-red-500" })),
                React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase mb-1 flex items-center justify-between" }, "Saiu do Caixa 👆", React.createElement(ChevronRight, { size: 14, className: "text-red-400" })),
                React.createElement('p', { className: "text-2xl font-black text-red-500" }, formatCurrency(dashboardTotals.totalCashOut))
            )
        ),

        // 3. CARDS DE LUCRO (Inteligência Real)
        React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
            React.createElement('div', { className: "bg-slate-900 p-6 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-center" },
                React.createElement('div', { className: "absolute top-0 right-0 p-4 opacity-10" }, React.createElement(DollarSign, { size: 64, className: "text-yellow-400" })),
                React.createElement('div', { className: "flex items-center gap-2 mb-2" },
                    React.createElement('span', { className: "w-2 h-2 rounded-full bg-yellow-400 animate-pulse" }),
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase" }, "Lucro Real (Líquido em Caixa)")
                ),
                React.createElement('p', { className: `text-4xl font-black ${dashboardTotals.realProfit >= 0 ? 'text-yellow-400' : 'text-red-400'}` }, formatCurrency(dashboardTotals.realProfit)),
                React.createElement('p', { className: "text-[10px] text-slate-500 mt-2 max-w-[80%]" }, "Lucro gerado no período considerando apenas vendas cujo valor recebido já ultrapassou o custo de aquisição do produto.")
            ),
            React.createElement('div', { className: "bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-center" },
                React.createElement('div', { className: "absolute top-0 right-0 p-4 opacity-5" }, React.createElement(Package, { size: 64, className: "text-slate-800" })),
                React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase mb-2" }, "Lucro Estimado (Projeção)"),
                React.createElement('p', { className: "text-2xl font-black text-slate-800" }, formatCurrency(dashboardTotals.estimatedProfit)),
                React.createElement('p', { className: "text-[10px] text-slate-400 mt-2" }, "Projeção de lucro se todas as vendas feitas neste período forem totalmente pagas pelos clientes.")
            )
        ),

        // 4. Avisos de Inadimplência e Próximos Vencimentos
        (dashboardTotals.totalOverdue > 0 || dashboardTotals.totalUpcoming > 0) && React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
            dashboardTotals.totalOverdue > 0 && React.createElement('div', { 
                onClick: () => setInstallmentListModal({ open: true, type: 'overdue', data: dashboardTotals.overdueList }), 
                className: "bg-red-50 p-4 rounded-xl border border-red-100 flex items-center justify-between cursor-pointer hover:bg-red-100 transition-colors shadow-sm" 
            },
                React.createElement('div', { className: "flex items-center gap-3" },
                    React.createElement('div', { className: "p-2 bg-red-100 text-red-500 rounded-lg" }, React.createElement(AlertTriangle, { size: 20 })),
                    React.createElement('div', null, React.createElement('p', { className: "text-xs font-bold text-red-800 uppercase" }, "Em Atraso"), React.createElement('p', { className: "font-bold text-red-600" }, formatCurrency(dashboardTotals.totalOverdue)))
                ),
                React.createElement(ChevronRight, { size: 20, className: "text-red-300" })
            ),
            
            dashboardTotals.totalUpcoming > 0 && React.createElement('div', { 
                onClick: () => setInstallmentListModal({ open: true, type: 'upcoming', data: dashboardTotals.upcomingList }), 
                className: "bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex items-center justify-between cursor-pointer hover:bg-yellow-100 transition-colors shadow-sm" 
            },
                React.createElement('div', { className: "flex items-center gap-3" },
                    React.createElement('div', { className: "p-2 bg-yellow-100 text-yellow-600 rounded-lg" }, React.createElement(Calendar, { size: 20 })),
                    React.createElement('div', null, React.createElement('p', { className: "text-xs font-bold text-yellow-800 uppercase" }, "Vencendo (7 dias)"), React.createElement('p', { className: "font-bold text-yellow-700" }, formatCurrency(dashboardTotals.totalUpcoming)))
                ),
                React.createElement(ChevronRight, { size: 20, className: "text-yellow-400" })
            )
        ),

        // 5. MODAIS DA TELA
        React.createElement(FinancialListModal, { 
            isOpen: cashInModalOpen, 
            onClose: () => setCashInModalOpen(false), 
            title: "Entradas em Caixa", 
            type: "income", 
            transactions: periodIncomes, 
            onAddManual: () => { setCashInModalOpen(false); onOpenTransactionModal('income'); } 
        }),
        React.createElement(FinancialListModal, { 
            isOpen: cashOutModalOpen, 
            onClose: () => setCashOutModalOpen(false), 
            title: "Saídas do Caixa", 
            type: "expense", 
            transactions: periodExpenses, 
            onAddManual: () => { setCashOutModalOpen(false); onOpenTransactionModal('expense'); } 
        }),
        React.createElement(InstallmentListModal, { 
            isOpen: receivablesModalOpen, 
            onClose: () => setReceivablesModalOpen(false), 
            title: "Todos os Pagamentos a Receber", 
            items: dashboardTotals.allReceivablesList, 
            onPay: (item) => { setReceivablesModalOpen(false); handlePayFromList(item); }, 
            onOpenWA: handleOpenWA 
        })
    );
};
