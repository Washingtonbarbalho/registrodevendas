// Gerado por scripts/consolidate-legacy-runtime-v75.mjs — histórico de clientes consolidado.
import React, { useMemo } from 'https://esm.sh/react@18.2.0';
import { createPortal } from 'https://esm.sh/react-dom@18.2.0';
import {
    X, ShoppingBag, Receipt, CreditCard, Banknote, QrCode, ChevronRight
} from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, formatDate } from './utils.js?v=88';

const getSaleTypeLabel = sale => sale.saleType === 'direct' ? 'Venda no caixa' : 'Venda a prazo';

const formatSaleMoment = sale => {
    const date = formatDate(sale?.saleDate);
    if (sale?.saleDateTime) {
        const parsed = new Date(sale.saleDateTime);
        if (!Number.isNaN(parsed.getTime())) return date + ' · ' + parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return date + ' · --:--';
};

const getPaymentLabel = sale => {
    if (sale.saleType !== 'direct') {
        const count = sale.installmentsCount || sale.installments?.length || 1;
        return `${count}x no crediário`;
    }

    const labels = {
        pix: 'PIX',
        money: 'Dinheiro',
        debit: 'Cartão de débito',
        credit: `Cartão de crédito${sale.cardInstallments > 1 ? ` · ${sale.cardInstallments}x` : ''}`
    };

    return labels[sale.paymentMethod] || 'Pagamento direto';
};

const getSaleStatus = sale => {
    if (sale.status === 'canceled') return { label: 'Cancelada', className: 'status-canceled' };
    if (sale.status === 'completed') return { label: 'Concluída', className: 'status-paid' };
    return { label: 'Em andamento', className: 'status-warning' };
};

export const CustomerPurchaseHistoryModal = ({ isOpen, onClose, customer, sales }) => {
    const customerSales = useMemo(() => {
        if (!customer || !Array.isArray(sales)) return [];
        const normalizedName = String(customer.name || '').trim().toUpperCase();

        return sales
            .filter(sale => {
                if (sale.customerId) return sale.customerId === customer.id;
                return String(sale.customerName || '').trim().toUpperCase() === normalizedName;
            })
            .sort((a, b) => String(b.saleDateTime || b.saleDate || '').localeCompare(String(a.saleDateTime || a.saleDate || '')));
    }, [customer, sales]);

    if (!isOpen || !customer) return null;

    const validSales = customerSales.filter(sale => sale.status !== 'canceled');
    const totalPurchased = validSales.reduce((sum, sale) => sum + (Number(sale.totalPrice) || 0), 0);
    const termPurchases = validSales.filter(sale => sale.saleType !== 'direct').length;
    const directPurchases = validSales.filter(sale => sale.saleType === 'direct').length;

    const modal = React.createElement('div', {
        className: 'app-modal-overlay customer-history-modal-overlay fixed inset-0 z-[9998] flex items-center justify-center p-4 backdrop-blur-sm',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': `Histórico de compras de ${customer.name}`
    },
        React.createElement('div', { className: 'app-modal-panel desktop-modal desktop-modal-customer-history bg-white rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl animate-fade-in' },
            React.createElement('div', { className: 'desktop-modal-header p-5 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0' },
                React.createElement('div', { className: 'min-w-0' },
                    React.createElement('h3', { className: 'text-lg font-bold text-slate-800 flex items-center gap-2' },
                        React.createElement(ShoppingBag, { size: 20, className: 'text-yellow-500' }),
                        'Histórico de compras'
                    ),
                    React.createElement('p', { className: 'text-xs text-slate-500 mt-1 truncate' }, customer.name)
                ),
                React.createElement('button', {
                    onClick: onClose,
                    className: 'p-2 hover:bg-slate-100 rounded-full shrink-0',
                    'aria-label': 'Fechar'
                }, React.createElement(X, { size: 20 }))
            ),

            React.createElement('div', { className: 'customer-history-summary grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b border-slate-100 bg-slate-50 shrink-0' },
                React.createElement('div', { className: 'customer-history-metric' },
                    React.createElement('span', null, 'Compras'),
                    React.createElement('strong', null, validSales.length)
                ),
                React.createElement('div', { className: 'customer-history-metric' },
                    React.createElement('span', null, 'Total comprado'),
                    React.createElement('strong', null, formatCurrency(totalPurchased))
                ),
                React.createElement('div', { className: 'customer-history-metric' },
                    React.createElement('span', null, 'A prazo'),
                    React.createElement('strong', null, termPurchases)
                ),
                React.createElement('div', { className: 'customer-history-metric' },
                    React.createElement('span', null, 'No caixa'),
                    React.createElement('strong', null, directPurchases)
                )
            ),

            React.createElement('div', { className: 'desktop-modal-body flex-1 overflow-y-auto p-4' },
                customerSales.length === 0
                    ? React.createElement('div', { className: 'empty-state py-12' },
                        React.createElement('div', { className: 'empty-state-icon' }, React.createElement(ShoppingBag, { size: 22 })),
                        React.createElement('p', { className: 'empty-state-title' }, 'Nenhuma compra encontrada'),
                        React.createElement('p', { className: 'empty-state-copy' }, 'As vendas no caixa e a prazo deste cliente aparecerão aqui.')
                    )
                    : React.createElement('div', { className: 'customer-purchase-history' },
                        React.createElement('div', { className: 'customer-purchase-history-header', 'aria-hidden': 'true' },
                            React.createElement('span', null, 'Compra'),
                            React.createElement('span', null, 'Pagamento'),
                            React.createElement('span', null, 'Status'),
                            React.createElement('span', null, 'Valor')
                        ),
                        customerSales.map(sale => {
                            const saleStatus = getSaleStatus(sale);
                            const itemCount = (sale.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
                            const TypeIcon = sale.saleType === 'direct'
                                ? (sale.paymentMethod === 'pix' ? QrCode : sale.paymentMethod === 'money' ? Banknote : CreditCard)
                                : Receipt;

                            return React.createElement('div', { key: sale.id, className: 'customer-purchase-row' },
                                React.createElement('div', { className: 'customer-purchase-main' },
                                    React.createElement('div', { className: 'customer-purchase-icon' }, React.createElement(TypeIcon, { size: 18 })),
                                    React.createElement('div', { className: 'min-w-0' },
                                        React.createElement('strong', { className: 'text-sm text-slate-800 block' }, getSaleTypeLabel(sale)),
                                        React.createElement('span', { className: 'text-xs text-slate-500 block mt-0.5' }, `${formatSaleMoment(sale)} · ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`)
                                    )
                                ),
                                React.createElement('div', { className: 'customer-purchase-payment' },
                                    React.createElement('span', { className: 'list-label-mobile' }, 'Pagamento'),
                                    React.createElement('strong', null, getPaymentLabel(sale))
                                ),
                                React.createElement('div', { className: 'customer-purchase-status' },
                                    React.createElement('span', { className: `status-badge ${saleStatus.className}` }, saleStatus.label)
                                ),
                                React.createElement('div', { className: 'customer-purchase-value' },
                                    React.createElement('span', { className: 'list-label-mobile' }, 'Valor'),
                                    React.createElement('strong', null, formatCurrency(sale.totalPrice || 0)),
                                    React.createElement(ChevronRight, { size: 16, className: 'hidden md:block text-slate-300' })
                                )
                            );
                        })
                    )
            ),

            React.createElement('div', { className: 'desktop-modal-footer p-4 border-t border-slate-100 shrink-0 flex justify-end' },
                React.createElement('button', {
                    onClick: onClose,
                    className: 'w-full md:w-auto md:min-w-48 p-3 bg-slate-900 text-white font-bold rounded-xl'
                }, 'Fechar')
            )
        )
    );

    return createPortal(modal, document.body);
};
