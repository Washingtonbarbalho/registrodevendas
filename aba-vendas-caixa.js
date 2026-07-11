import React from 'https://esm.sh/react@18.2.0';
import { Plus, Search, QrCode, Banknote, CreditCard, ChevronRight, WalletCards } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, formatDate } from './utils.js';
import { DateRangeFilter, Pagination } from './components.js';

export const AbaVendasCaixa = ({ setNewSaleMode, cashierPeriod, cashierStart, cashierEnd, setCashierPeriod, setCashierStart, setCashierEnd, cashierSearch, setCashierSearch, paginatedCashier, directSales, cashierPage, setCashierPage, setSelectedSaleDetail, ITEMS_PER_PAGE }) => {
    const getNetAmount = sale => {
        const savedNetAmount = Number(sale.netReceived);
        if (Number.isFinite(savedNetAmount)) return savedNetAmount;

        let netAmount = Number(sale.totalPrice) || 0;
        if (sale.feeConfig && (sale.feeConfig.type === 'sem_juros' || sale.feeConfig.type === 'com_juros')) {
            netAmount -= Number(sale.feeConfig.value) || 0;
        }
        return netAmount;
    };

    const getPaymentLabel = sale => sale.paymentMethod === 'credit'
        ? `Crédito ${sale.cardInstallments || 1}x`
        : sale.paymentMethod === 'debit'
            ? 'Débito'
            : sale.paymentMethod === 'money'
                ? 'Dinheiro'
                : 'PIX';

    const getPaymentIcon = sale => sale.paymentMethod === 'pix'
        ? React.createElement(QrCode, { size: 13 })
        : sale.paymentMethod === 'money'
            ? React.createElement(Banknote, { size: 13 })
            : React.createElement(CreditCard, { size: 13 });

    return React.createElement('section', { className: "page-stack animate-fade-in" },
        React.createElement('div', { className: "page-heading" },
            React.createElement('div', { className: "page-heading-copy" },
                React.createElement('h2', { className: "page-title" }, "Vendas no caixa"),
                React.createElement('p', { className: "page-description" }, "Vendas diretas com valor bruto, taxa e líquido recebido.")
            ),
            React.createElement('button', {
                onClick: () => setNewSaleMode('direct'),
                className: "page-primary-action is-success"
            }, React.createElement(Plus, { size: 18 }), "Nova venda direta")
        ),

        React.createElement(DateRangeFilter, {
            period: cashierPeriod,
            startDate: cashierStart,
            endDate: cashierEnd,
            onPeriodChange: setCashierPeriod,
            onStartChange: setCashierStart,
            onEndChange: setCashierEnd
        }),

        React.createElement('div', { className: "toolbar" },
            React.createElement('div', { className: "toolbar-search" },
                React.createElement(Search, { size: 18 }),
                React.createElement('input', {
                    placeholder: "Buscar por cliente ou produto...",
                    value: cashierSearch,
                    onChange: event => setCashierSearch(event.target.value.toUpperCase())
                })
            ),
            React.createElement('span', { className: "result-count" }, `${directSales.length} ${directSales.length === 1 ? 'venda' : 'vendas'}`)
        ),

        React.createElement('div', { className: "list-shell" },
            React.createElement('div', { className: "list-header md:grid-cols-[minmax(0,1.7fr)_140px_140px_150px_120px_34px]" },
                React.createElement('span', null, "Cliente / data"),
                React.createElement('span', null, "Pagamento"),
                React.createElement('span', null, "Cobrado"),
                React.createElement('span', null, "Líquido no caixa"),
                React.createElement('span', null, "Taxa"),
                React.createElement('span', null, "")
            ),

            paginatedCashier.length === 0
                ? React.createElement('div', { className: "empty-state" },
                    React.createElement('div', { className: "empty-state-icon" }, React.createElement(WalletCards, { size: 22 })),
                    React.createElement('p', { className: "empty-state-title" }, "Nenhuma venda direta encontrada"),
                    React.createElement('p', { className: "empty-state-copy" }, "Ajuste o período ou registre uma nova venda.")
                )
                : paginatedCashier.map(sale => {
                    const netAmount = getNetAmount(sale);
                    const grossAmount = Number(sale.totalPrice) || 0;
                    const feeAmount = Number(sale.feeConfig?.value) || 0;
                    const hasCardFee = feeAmount > 0 && (sale.paymentMethod === 'credit' || sale.paymentMethod === 'debit');
                    const isCanceled = sale.status === 'canceled';

                    return React.createElement('div', {
                        key: sale.id,
                        onClick: () => setSelectedSaleDetail(sale),
                        className: `list-row ${isCanceled ? 'is-canceled' : ''} grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.7fr)_140px_140px_150px_120px_34px]`
                    },
                        React.createElement('div', { className: "list-main" },
                            React.createElement('p', { className: `list-title ${isCanceled ? 'line-through text-red-600' : ''}` }, sale.customerName),
                            React.createElement('p', { className: "list-subtitle" }, `Venda em ${formatDate(sale.saleDate)}`),
                            React.createElement('div', { className: "md:hidden mt-3 flex items-center gap-2 flex-wrap" },
                                React.createElement('span', { className: `status-badge ${isCanceled ? 'status-canceled' : 'status-paid'}` }, isCanceled ? 'Cancelada' : getPaymentLabel(sale)),
                                hasCardFee && React.createElement('span', { className: "status-badge status-warning" }, `Taxa ${formatCurrency(feeAmount)}`)
                            )
                        ),
                        React.createElement('div', { className: "hidden md:block" },
                            React.createElement('span', { className: `status-badge ${isCanceled ? 'status-canceled' : 'status-info'}` }, getPaymentIcon(sale), getPaymentLabel(sale))
                        ),
                        React.createElement('div', { className: "hidden md:block list-meta font-semibold" }, formatCurrency(grossAmount)),
                        React.createElement('div', { className: "hidden md:block list-value text-emerald-700" }, formatCurrency(netAmount)),
                        React.createElement('div', { className: "hidden md:block" },
                            React.createElement('span', { className: `text-xs font-extrabold ${hasCardFee ? 'text-orange-600' : 'text-slate-400'}` }, hasCardFee ? `- ${formatCurrency(feeAmount)}` : "Sem taxa")
                        ),
                        React.createElement('div', { className: "md:hidden text-right" },
                            React.createElement('span', { className: "list-label-mobile" }, "Líquido"),
                            React.createElement('p', { className: `list-value ${isCanceled ? 'line-through text-red-600' : 'text-emerald-700'}` }, formatCurrency(netAmount)),
                            React.createElement('p', { className: "mt-1 text-[10px] text-slate-400" }, `Cobrado ${formatCurrency(grossAmount)}`)
                        ),
                        React.createElement('div', { className: "hidden md:grid place-items-center text-slate-300" }, React.createElement(ChevronRight, { size: 18 }))
                    );
                })
        ),

        React.createElement(Pagination, {
            totalItems: directSales.length,
            itemsPerPage: ITEMS_PER_PAGE,
            currentPage: cashierPage,
            onPageChange: setCashierPage
        })
    );
};
