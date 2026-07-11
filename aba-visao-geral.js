import React from 'https://esm.sh/react@18.2.0';
import { TrendingUp, Wallet, AlertTriangle, ChevronRight, BellRing, Target, LineChart, CircleDollarSign } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency } from './utils.js';
import { DateRangeFilter } from './components.js';

const MetricCard = ({ label, value, note, icon, color, background, glow, onClick }) => React.createElement('div', {
    onClick,
    className: `metric-card ${onClick ? 'is-clickable' : ''}`,
    style: { '--metric-color': color, '--metric-bg': background, '--metric-glow': glow }
},
    React.createElement('div', { className: "metric-top" },
        React.createElement('div', { className: "metric-icon" }, icon),
        onClick && React.createElement(ChevronRight, { size: 17, className: "text-slate-300" })
    ),
    React.createElement('p', { className: "metric-label" }, label),
    React.createElement('p', { className: "metric-value", style: { color } }, formatCurrency(value)),
    note && React.createElement('p', { className: "metric-note" }, note)
);

export const AbaVisaoGeral = ({ dashPeriod, dashStartDate, dashEndDate, setDashPeriod, setDashStartDate, setDashEndDate, dashboardTotals, setInstallmentListModal }) => {
    return React.createElement('section', { className: "page-stack animate-fade-in" },
        React.createElement('div', { className: "page-heading" },
            React.createElement('div', { className: "page-heading-copy" },
                React.createElement('h2', { className: "page-title" }, "Visão geral"),
                React.createElement('p', { className: "page-description" }, "Resumo financeiro, recebimentos e compromissos do negócio.")
            )
        ),

        React.createElement(DateRangeFilter, {
            period: dashPeriod,
            startDate: dashStartDate,
            endDate: dashEndDate,
            onPeriodChange: setDashPeriod,
            onStartChange: setDashStartDate,
            onEndChange: setDashEndDate
        }),

        React.createElement('div', { className: "dashboard-grid" },
            React.createElement(MetricCard, {
                label: "A receber",
                value: dashboardTotals.totalReceivable,
                note: "Saldo total das vendas a prazo",
                icon: React.createElement(TrendingUp, { size: 19 }),
                color: "#2563eb",
                background: "#eff6ff",
                glow: "rgba(37, 99, 235, .08)"
            }),
            React.createElement(MetricCard, {
                label: "Entrou em caixa",
                value: dashboardTotals.totalReceived,
                note: "Recebido no período selecionado",
                icon: React.createElement(Wallet, { size: 19 }),
                color: "#059669",
                background: "#ecfdf5",
                glow: "rgba(5, 150, 105, .08)"
            }),
            React.createElement(MetricCard, {
                label: "Em atraso",
                value: dashboardTotals.totalOverdue,
                note: `${dashboardTotals.overdueList.length} ${dashboardTotals.overdueList.length === 1 ? 'parcela vencida' : 'parcelas vencidas'}`,
                icon: React.createElement(AlertTriangle, { size: 19 }),
                color: "#dc2626",
                background: "#fef2f2",
                glow: "rgba(220, 38, 38, .08)",
                onClick: () => setInstallmentListModal({ open: true, type: 'overdue', data: dashboardTotals.overdueList })
            }),
            React.createElement(MetricCard, {
                label: "A vencer em 7 dias",
                value: dashboardTotals.totalUpcoming,
                note: `${dashboardTotals.upcomingList.length} ${dashboardTotals.upcomingList.length === 1 ? 'parcela próxima' : 'parcelas próximas'}`,
                icon: React.createElement(BellRing, { size: 19 }),
                color: "#d97706",
                background: "#fff7ed",
                glow: "rgba(217, 119, 6, .08)",
                onClick: () => setInstallmentListModal({ open: true, type: 'upcoming', data: dashboardTotals.upcomingList })
            })
        ),

        React.createElement('div', { className: "dashboard-profit" },
            React.createElement('div', { className: "profit-card" },
                React.createElement('div', { className: "profit-icon bg-amber-50 text-amber-600" }, React.createElement(Target, { size: 21 })),
                React.createElement('div', null,
                    React.createElement('p', { className: "profit-label" }, "Lucro estimado"),
                    React.createElement('p', { className: "profit-value" }, formatCurrency(dashboardTotals.estimatedProfit)),
                    React.createElement('p', { className: "text-[10px] text-slate-400 mt-1" }, "Lucro das vendas realizadas no período")
                )
            ),
            React.createElement('div', { className: "profit-card" },
                React.createElement('div', { className: "profit-icon bg-violet-50 text-violet-600" }, React.createElement(LineChart, { size: 21 })),
                React.createElement('div', null,
                    React.createElement('p', { className: "profit-label" }, "Lucro real no caixa"),
                    React.createElement('p', { className: `profit-value ${dashboardTotals.realProfit >= 0 ? 'text-violet-700' : 'text-red-600'}` }, formatCurrency(dashboardTotals.realProfit)),
                    React.createElement('p', { className: "text-[10px] text-slate-400 mt-1" }, "Lucro já realizado pelos recebimentos")
                )
            )
        ),

        React.createElement('div', { className: "surface p-5 flex items-start gap-4" },
            React.createElement('div', { className: "w-11 h-11 rounded-2xl bg-slate-900 text-amber-400 grid place-items-center shrink-0" }, React.createElement(CircleDollarSign, { size: 22 })),
            React.createElement('div', null,
                React.createElement('h3', { className: "font-extrabold text-slate-800 text-sm" }, "Leitura rápida dos lucros"),
                React.createElement('p', { className: "text-xs text-slate-500 mt-1 leading-relaxed" }, "O lucro estimado considera o que foi vendido. O lucro real considera somente o que já virou lucro no caixa, respeitando custos, entradas e pagamentos das vendas a prazo.")
            )
        )
    );
};
