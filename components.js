import React, { useState, useEffect } from 'https://esm.sh/react@18.2.0';
import { ChevronLeft, ChevronRight, MoreHorizontal, LayoutGrid, X, SlidersHorizontal, ChevronDown, CalendarDays } from 'https://esm.sh/lucide-react@0.292.0';
import { maskMoney, formatDate } from './utils.js';
import { showAppDateRange } from './ui-interactions-v81.js?v=87';

export const MoneyInput = ({ value, onChange, placeholder, className, autoFocus, disabled }) => {
    const [display, setDisplay] = useState(typeof value === 'number' ? maskMoney((value * 100).toFixed(0)) : value);

    useEffect(() => {
        if (typeof value === 'number') setDisplay(maskMoney((value * 100).toFixed(0)));
        else if (typeof value === 'string') setDisplay(value);
    }, [value]);

    const handleChange = (event) => {
        const masked = maskMoney(event.target.value);
        setDisplay(masked);
        onChange(masked);
    };

    return React.createElement('div', { className: "relative w-full" },
        React.createElement('span', { className: `absolute left-3 top-1/2 -translate-y-1/2 text-xs font-extrabold ${disabled ? 'text-slate-300' : 'text-slate-400'}` }, "R$"),
        React.createElement('input', {
            autoFocus,
            disabled,
            type: "text",
            inputMode: "numeric",
            className,
            placeholder: placeholder || "0,00",
            value: display,
            onChange: handleChange
        })
    );
};

export const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const [showAllPagesModal, setShowAllPagesModal] = useState(false);

    if (totalPages <= 1) return null;

    const renderPageNumbers = () => {
        const pages = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else if (currentPage <= 4) {
            pages.push(1, 2, 3, 4, 5, '...', totalPages);
        } else if (currentPage >= totalPages - 3) {
            pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
        } else {
            pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
        }
        return pages;
    };

    return React.createElement(React.Fragment, null,
        React.createElement('div', { className: "pagination-bar select-none" },
            React.createElement('button', {
                onClick: () => onPageChange(currentPage - 1),
                disabled: currentPage === 1,
                className: "pagination-button",
                title: "Página anterior"
            }, React.createElement(ChevronLeft, { size: 18 })),

            renderPageNumbers().map((page, index) => page === '...'
                ? React.createElement('button', {
                    key: `ellipsis-${index}`,
                    onClick: () => setShowAllPagesModal(true),
                    className: "pagination-button",
                    title: "Ver todas as páginas"
                }, React.createElement(MoreHorizontal, { size: 17 }))
                : React.createElement('button', {
                    key: page,
                    onClick: () => onPageChange(page),
                    className: `pagination-button ${currentPage === page ? 'is-active' : ''}`
                }, page)
            ),

            React.createElement('button', {
                onClick: () => onPageChange(currentPage + 1),
                disabled: currentPage === totalPages,
                className: "pagination-button",
                title: "Próxima página"
            }, React.createElement(ChevronRight, { size: 18 }))
        ),

        showAllPagesModal && React.createElement('div', { className: "app-modal-overlay fixed inset-0 z-[90] flex items-center justify-center p-4" },
            React.createElement('div', { className: "app-modal-panel bg-white rounded-2xl w-full max-w-sm p-5 animate-fade-in" },
                React.createElement('div', { className: "flex justify-between items-center mb-4" },
                    React.createElement('h3', { className: "font-extrabold text-slate-800 flex items-center gap-2" }, React.createElement(LayoutGrid, { size: 18 }), "Ir para a página"),
                    React.createElement('button', { onClick: () => setShowAllPagesModal(false), className: "app-icon-button !w-9 !h-9" }, React.createElement(X, { size: 18 }))
                ),
                React.createElement('div', { className: "grid grid-cols-5 gap-2 max-h-64 overflow-y-auto p-1" },
                    Array.from({ length: totalPages }, (_, index) => index + 1).map(page =>
                        React.createElement('button', {
                            key: page,
                            onClick: () => { onPageChange(page); setShowAllPagesModal(false); },
                            className: `pagination-button border border-slate-100 ${currentPage === page ? 'is-active' : ''}`
                        }, page)
                    )
                )
            )
        )
    );
};

export const DateRangePicker = ({ startDate, endDate, onChange, label, className = '', title }) => {
    const openCalendar = async () => {
        const selection = await showAppDateRange({ startDate, endDate, title });
        if (selection) onChange?.(selection);
    };
    const formattedRange = startDate && endDate
        ? `${formatDate(startDate)} até ${formatDate(endDate)}`
        : 'Selecionar período';

    return React.createElement('button', {
        type: 'button',
        onClick: openCalendar,
        className: `period82-trigger ${className}`.trim(),
        'aria-haspopup': 'dialog',
        'aria-label': `${label || 'Selecionar período'}: ${formattedRange}`
    },
        React.createElement(CalendarDays, { size: 17, 'aria-hidden': true }),
        React.createElement('span', { className: 'period82-trigger-label' }, label || formattedRange),
        React.createElement(ChevronRight, { size: 16, className: 'period82-trigger-chevron', 'aria-hidden': true })
    );
};

export const DateRangeFilter = ({ period, startDate, endDate, onPeriodChange, onStartChange, onEndChange }) => {
    const [expanded, setExpanded] = useState(false);
    const periodLabels = { week: 'Últimos 7 dias', month: 'Mês atual', last30: 'Últimos 30 dias' };
    const summary = periodLabels[period] || `${formatDate(startDate)} até ${formatDate(endDate)}`;
    const applyCustomRange = selection => {
        onPeriodChange?.('custom');
        onStartChange?.(selection.startDate);
        onEndChange?.(selection.endDate);
    };
    const choosePeriod = async value => {
        if (value !== 'custom') {
            onPeriodChange?.(value);
            return;
        }
        const selection = await showAppDateRange({ startDate, endDate });
        if (selection) applyCustomRange(selection);
    };

    return React.createElement('div', { className: "date-filter" },
        React.createElement('div', { className: "date-filter-summary", onClick: () => setExpanded(!expanded) },
            React.createElement('div', { className: "date-filter-label" },
                React.createElement(SlidersHorizontal, { size: 16, className: "text-slate-400" }),
                React.createElement('span', null, "Período:"),
                React.createElement('strong', { className: "text-slate-800" }, summary)
            ),
            React.createElement(ChevronDown, { size: 17, className: `text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}` })
        ),
        expanded && React.createElement('div', { className: "mt-4 pt-4 border-t border-slate-100 space-y-3 animate-fade-in" },
            React.createElement('div', { className: "grid grid-cols-2 gap-2" },
                [['week', '7 dias'], ['month', 'Mês atual'], ['last30', '30 dias'], ['custom', 'Personalizar']].map(([value, label]) =>
                    React.createElement('button', {
                        key: value,
                        type: "button",
                        onClick: () => choosePeriod(value),
                        className: `min-h-10 rounded-xl text-xs font-extrabold transition-colors ${period === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`
                    }, label)
                )
            ),
            period === 'custom' && React.createElement('div', { className: 'period82-custom-filter' },
                React.createElement('span', { className: 'period82-field-label' }, 'Intervalo selecionado'),
                React.createElement(DateRangePicker, { startDate, endDate, onChange: applyCustomRange })
            )
        )
    );
};
