import React, { useMemo } from 'https://esm.sh/react@18.2.0';
import {
    TrendingUp, Wallet, AlertTriangle, ChevronRight, BellRing, Target,
    LineChart, CircleDollarSign, CalendarClock, Plus, MessageCircle, Package, BarChart3
} from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, getBrazilDateString } from './utils.js?v=82';
import { DateRangeFilter } from './components.js?v=82';
import { buildExecutiveInsights } from './executive-insights-v79.js?v=82';

const MetricCard = ({ label, value, note, icon, color, background, glow, onClick }) => React.createElement('div', {
    onClick,
    role: onClick ? 'button' : undefined,
    tabIndex: onClick ? 0 : undefined,
    onKeyDown: onClick ? event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
        }
    } : undefined,
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

const sortInstallments = items => [...(items || [])].sort((a, b) => {
    const dateComparison = String(a.dueDate || '').localeCompare(String(b.dueDate || ''));
    if (dateComparison !== 0) return dateComparison;
    const customerComparison = String(a.customerName || '').localeCompare(String(b.customerName || ''), 'pt-BR');
    if (customerComparison !== 0) return customerComparison;
    return (Number(a.number) || 0) - (Number(b.number) || 0);
});

const installmentNote = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`;

export const AbaVisaoGeral = ({
    dashPeriod, dashStartDate, dashEndDate, setDashPeriod, setDashStartDate,
    setDashEndDate, dashboardTotals, setInstallmentListModal,
    sales = [], products = [], customers = [], userProfile = {}, onNavigate, onNewSale
}) => {
    const today = getBrazilDateString();
    const insights = useMemo(() => buildExecutiveInsights({
        sales,
        products,
        customers,
        userProfile,
        financialData: userProfile?.financialData || {},
        startDate: dashStartDate,
        endDate: dashEndDate,
        today
    }), [sales, products, customers, userProfile, dashStartDate, dashEndDate, today]);
    const revenueTrend = insights.comparison?.metrics.find(item => item.label === 'Faturamento líquido');
    const resultTrend = insights.comparison?.metrics.find(item => item.label === 'Resultado líquido');
    const revenueGoal = insights.goals.metrics.find(item => item.id === 'revenue');
    const allUpcoming = dashboardTotals.upcomingList || [];
    const todayList = sortInstallments(allUpcoming.filter(item => item.dueDate === today));
    const nextSevenDaysList = sortInstallments(allUpcoming.filter(item => item.dueDate > today));
    const overdueList = sortInstallments(dashboardTotals.overdueList || []);
    const totalToday = todayList.reduce((total, item) => total + (Number(item.amount) || 0), 0);
    const totalNextSevenDays = nextSevenDaysList.reduce((total, item) => total + (Number(item.amount) || 0), 0);

    const openInstallments = (type, data) => setInstallmentListModal({ open: true, type, data });

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

        React.createElement('section', { className: "dashboard79-executive" },
            React.createElement('div', { className: "dashboard79-heading" },
                React.createElement('div', null,
                    React.createElement('span', null, "Acompanhamento do negócio"),
                    React.createElement('h3', null, "Resumo executivo")
                ),
                React.createElement('button', { type: "button", onClick: () => onNavigate?.('reports') }, "Ver relatórios")
            ),
            React.createElement('div', { className: "dashboard79-summary-grid" },
                [
                    { label: 'Faturamento líquido', value: formatCurrency(insights.revenue), trend: revenueTrend },
                    { label: 'Resultado líquido', value: formatCurrency(insights.netResult), trend: resultTrend },
                    { label: 'Vendas no período', value: String(insights.salesCount), trend: insights.comparison?.metrics.find(item => item.label === 'Vendas válidas') },
                    { label: 'Ticket médio', value: formatCurrency(insights.ticket), trend: insights.comparison?.metrics.find(item => item.label === 'Ticket médio') }
                ].map(item => React.createElement('article', { key: item.label, className: "dashboard79-summary-card" },
                    React.createElement('span', null, item.label),
                    React.createElement('strong', null, item.value),
                    item.trend && React.createElement('small', { className: `is-${item.trend.tone}` },
                        `${item.trend.deltaDisplay} em relação ao período anterior`)
                ))
            ),
            React.createElement('div', { className: "dashboard79-goal" },
                React.createElement('div', { className: "dashboard79-goal-copy" },
                    React.createElement(Target, { size: 18 }),
                    React.createElement('div', null,
                        React.createElement('strong', null, "Meta de faturamento"),
                        React.createElement('span', null, revenueGoal?.target > 0
                            ? `${formatCurrency(revenueGoal.actual)} de ${formatCurrency(revenueGoal.target)}`
                            : "Defina sua meta na área Comercial")
                    )
                ),
                React.createElement('strong', null, revenueGoal?.target > 0
                    ? `${Math.round(revenueGoal.percent)}%` : "—")
            ),
            revenueGoal?.target > 0 && React.createElement('div', { className: "dashboard79-goal-track" },
                React.createElement('span', { style: { width: `${revenueGoal.progress}%` } }))
        ),

        React.createElement('section', { className: "dashboard79-actions" },
            React.createElement('h3', null, "Ações rápidas"),
            React.createElement('div', { className: "dashboard79-action-grid" },
                [
                    { label: 'Nova venda', icon: Plus, onClick: onNewSale, detail: 'Registrar agora' },
                    { label: 'Cobrar clientes', icon: MessageCircle, onClick: () => onNavigate?.('commercial'), detail: `${insights.pendingCollections} cobranças` },
                    { label: 'Repor estoque', icon: Package, onClick: () => onNavigate?.('products'), detail: `${insights.stockAlerts} alertas` },
                    { label: 'Ver relatórios', icon: BarChart3, onClick: () => onNavigate?.('reports'), detail: `${insights.repurchaseOpportunities} recompras` }
                ].map(action => React.createElement('button', {
                    key: action.label, type: "button", onClick: action.onClick, className: "dashboard79-action"
                }, React.createElement(action.icon, { size: 18 }), React.createElement('span', null,
                    React.createElement('strong', null, action.label),
                    React.createElement('small', null, action.detail)
                )))
            )
        ),

        React.createElement('div', { className: "dashboard-grid dashboard-grid-v31" },
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
                note: installmentNote(overdueList.length, 'parcela vencida', 'parcelas vencidas'),
                icon: React.createElement(AlertTriangle, { size: 19 }),
                color: "#dc2626",
                background: "#fef2f2",
                glow: "rgba(220, 38, 38, .08)",
                onClick: () => openInstallments('overdue', overdueList)
            }),
            React.createElement(MetricCard, {
                label: "Vencem hoje",
                value: totalToday,
                note: installmentNote(todayList.length, 'parcela vencendo hoje', 'parcelas vencendo hoje'),
                icon: React.createElement(CalendarClock, { size: 19 }),
                color: "#7c3aed",
                background: "#f5f3ff",
                glow: "rgba(124, 58, 237, .08)",
                onClick: () => openInstallments('today', todayList)
            }),
            React.createElement(MetricCard, {
                label: "Próximos 7 dias",
                value: totalNextSevenDays,
                note: installmentNote(nextSevenDaysList.length, 'parcela próxima', 'parcelas próximas'),
                icon: React.createElement(BellRing, { size: 19 }),
                color: "#d97706",
                background: "#fff7ed",
                glow: "rgba(217, 119, 6, .08)",
                onClick: () => openInstallments('upcoming', nextSevenDaysList)
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
