// Gerado por scripts/consolidate-legacy-runtime-v75.mjs — modais finais consolidados.
import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.2.0';
import { createPortal } from 'https://esm.sh/react-dom@18.2.0';
import {
    X, Tag, Trash2, Edit2, ArrowUpCircle, ArrowDownCircle, Phone, FileText,
    MapPin, ShoppingBag, ShieldCheck, SlidersHorizontal, Receipt, CreditCard,
    Banknote, QrCode, Lock, ChevronRight
} from 'https://esm.sh/lucide-react@0.292.0';
import {
    formatCurrency, getBrazilDateString, formatDate, analyzeCustomerCredit
} from './utils.js?v=84';

import * as originalModule from './modals-core-runtime-v75.js?v=84';

export const UserProfileModal = originalModule.UserProfileModal;
export const CustomerFormModal = originalModule.CustomerFormModal;
export const EditInstallmentModal = originalModule.EditInstallmentModal;
export const SaleDetailsModal = originalModule.SaleDetailsModal;
export const PixCodeModal = originalModule.PixCodeModal;
export const InstallmentListModal = originalModule.InstallmentListModal;
export const PaymentConfirmationModal = originalModule.PaymentConfirmationModal;
export const ConfirmModal = originalModule.ConfirmModal;
export const WhatsAppChooserModal = originalModule.WhatsAppChooserModal;
export const ProductModal = originalModule.ProductModal;
export const StockMovementModal = originalModule.StockMovementModal;

const formatDateTime = dateStr => {
    if (!dateStr) return '--/--/---- --:--';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });
};

const toNumber = value => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const normalized = value.trim().replace(/\./g, '').replace(',', '.');
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const getCanceledDate = sale => {
    if (sale?.canceledAt?.toDate) return sale.canceledAt.toDate().toISOString();
    if (sale?.canceledAt?.seconds) return new Date(sale.canceledAt.seconds * 1000).toISOString();
    return `${sale.saleDate}T12:00:01.000Z`;
};

export const ProductDetailsModal = ({ isOpen, onClose, product, salesHistory, onEdit, onMovementRequest, onDeleteRequest }) => {
    const [tab, setTab] = useState('info');

    useEffect(() => {
        if (isOpen) setTab('info');
    }, [isOpen, product?.id]);

    const combinedHistory = useMemo(() => {
        const history = [];
        if (!product) return history;
        if (Array.isArray(product.movements)) {
            product.movements.forEach(movement => {
                const quantity = toNumber(movement.quantity);
                history.push({ id: movement.id, date: movement.date, type: movement.type, qty: quantity, isEntry: ['compra', 'ajuste_entrada', 'devolucao'].includes(movement.type), totalValue: quantity * toNumber(movement.unitCost), notes: movement.notes });
            });
        }
        if (Array.isArray(salesHistory)) {
            salesHistory.forEach(sale => {
                const itemMatch = sale.items?.find(item => item.productId === product.id);
                const cancellationEvents = Array.isArray(sale.cancellations) ? sale.cancellations : [];
                const partialItems = cancellationEvents
                    .filter(event => event.type === 'partial')
                    .flatMap(event => (event.items || []).filter(cancelItem => cancelItem.productId === product.id));
                const partialQuantity = partialItems.reduce((sum, cancelItem) => sum + toNumber(cancelItem.quantity), 0);
                const partialValue = partialItems.reduce((sum, cancelItem) => sum + (toNumber(cancelItem.amount) || toNumber(cancelItem.quantity) * toNumber(cancelItem.unitPrice)), 0);
                const activeQuantity = itemMatch ? toNumber(itemMatch.quantity) : 0;
                const activeLineTotal = itemMatch ? (toNumber(itemMatch.price) || activeQuantity * (toNumber(itemMatch.unitPrice) || toNumber(product.salePrice))) : 0;
                const originalQuantity = activeQuantity + partialQuantity;
                const originalLineTotal = activeLineTotal + partialValue;

                if (originalQuantity > 0) {
                    history.push({
                        id: 'sale-' + sale.id,
                        date: sale.saleDateTime || sale.saleDate,
                        type: 'venda',
                        qty: originalQuantity,
                        isEntry: false,
                        totalValue: originalLineTotal,
                        notes: 'Venda p/ ' + (sale.customerName?.split(' ')[0] || 'cliente')
                    });
                }

                let detailedCancellationFound = false;
                cancellationEvents.forEach((event, eventIndex) => {
                    (event.items || []).filter(cancelItem => cancelItem.productId === product.id).forEach((cancelItem, itemIndex) => {
                        detailedCancellationFound = true;
                        const quantity = toNumber(cancelItem.quantity);
                        history.push({
                            id: 'cancel-' + sale.id + '-' + (event.id || eventIndex) + '-' + itemIndex,
                            date: event.createdAt || event.date || getCanceledDate(sale),
                            type: 'cancelamento',
                            qty: quantity,
                            isEntry: true,
                            totalValue: toNumber(cancelItem.amount) || quantity * toNumber(cancelItem.unitPrice),
                            notes: (event.type === 'partial' ? 'Cancelamento parcial' : 'Venda cancelada') + (event.reason ? ' · ' + event.reason : '')
                        });
                    });
                });

                if (!detailedCancellationFound && sale.status === 'canceled' && itemMatch) {
                    const quantity = toNumber(itemMatch.quantity);
                    const lineTotal = toNumber(itemMatch.price) || quantity * (toNumber(itemMatch.unitPrice) || toNumber(product.salePrice));
                    history.push({ id: 'cancel-' + sale.id, date: getCanceledDate(sale), type: 'cancelamento', qty: quantity, isEntry: true, totalValue: lineTotal, notes: 'Venda Cancelada' });
                }
            });
        }
        return history.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [product, salesHistory]);

    if (!isOpen || !product) return null;

    const today = getBrazilDateString();
    const isPromoActive = product.isPromo && today >= product.promoStart && today <= product.promoEnd;
    const productLayoutClass = tab === 'history' && combinedHistory.length <= 2
        ? 'desktop-modal-product-compact'
        : 'desktop-modal-product-expanded';

    return React.createElement('div', { className: "app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[60] backdrop-blur-sm" },
        React.createElement('div', { className: `app-modal-panel desktop-modal desktop-modal-product ${productLayoutClass} bg-white rounded-2xl w-full max-w-md max-h-[95vh] flex flex-col shadow-2xl animate-fade-in` },
            React.createElement('div', { className: "desktop-modal-header p-5 border-b border-slate-100 flex justify-between items-start bg-slate-900 text-white rounded-t-2xl shrink-0" },
                React.createElement('div', null,
                    React.createElement('span', { className: "text-[10px] font-mono bg-slate-800 text-yellow-400 px-2 py-0.5 rounded" }, `CÓD: #${product.code}`),
                    React.createElement('h3', { className: "text-xl font-bold mt-2 leading-tight" }, product.name)
                ),
                React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-slate-800 rounded-full text-slate-300 transition-colors" }, React.createElement(X, { size: 20 }))
            ),
            React.createElement('div', { className: "product-modal-tabs flex border-b border-slate-100 shrink-0 bg-slate-50" },
                React.createElement('button', { onClick: () => setTab('info'), className: `flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${tab === 'info' ? 'border-yellow-500 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}` }, "Detalhes"),
                React.createElement('button', { onClick: () => setTab('history'), className: `flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${tab === 'history' ? 'border-yellow-500 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}` }, "Histórico")
            ),
            React.createElement('div', { className: "desktop-modal-body product-modal-body flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar" },
                tab === 'info' && React.createElement('div', { className: "product-info-layout space-y-4 animate-fade-in" },
                    React.createElement('div', { className: "product-metrics-grid grid grid-cols-2 gap-4" },
                        React.createElement('div', { className: "bg-slate-50 p-4 rounded-xl border border-slate-100" },
                            React.createElement('p', { className: "text-[10px] uppercase font-bold text-slate-400 mb-1" }, "Custo Médio"),
                            React.createElement('p', { className: "font-bold text-slate-800 text-lg" }, formatCurrency(product.costPrice))
                        ),
                        React.createElement('div', { className: "bg-slate-50 p-4 rounded-xl border border-slate-100" },
                            React.createElement('p', { className: "text-[10px] uppercase font-bold text-slate-400 mb-1" }, "Estoque"),
                            React.createElement('p', { className: `font-bold text-lg ${product.quantity <= 0 ? 'text-red-500' : 'text-slate-800'}` }, `${product.quantity} un.`)
                        )
                    ),
                    React.createElement('div', { className: "product-price-card bg-white p-4 rounded-xl border border-slate-200 shadow-sm" },
                        React.createElement('div', { className: "flex justify-between items-center mb-2" },
                            React.createElement('p', { className: "text-[10px] uppercase font-bold text-slate-400" }, "Preço de Venda"),
                            isPromoActive && React.createElement('span', { className: "bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" }, "Promoção Ativa")
                        ),
                        isPromoActive
                            ? React.createElement('div', { className: "flex items-end gap-3" },
                                React.createElement('p', { className: "text-sm font-bold text-slate-400 line-through" }, formatCurrency(product.salePrice)),
                                React.createElement('p', { className: "text-2xl font-bold text-purple-600" }, formatCurrency(product.promoPrice))
                            )
                            : React.createElement('p', { className: "text-2xl font-bold text-slate-800" }, formatCurrency(product.salePrice))
                    ),
                    product.description && React.createElement('div', { className: "product-description-card desktop-span-full bg-slate-50 p-4 rounded-xl border border-slate-100" },
                        React.createElement('p', { className: "text-[10px] uppercase font-bold text-slate-400 mb-1" }, "Descrição"),
                        React.createElement('p', { className: "text-sm text-slate-600 whitespace-pre-wrap" }, product.description)
                    ),
                    React.createElement('div', { className: "product-actions desktop-span-full grid grid-cols-2 gap-3 pt-2" },
                        React.createElement('button', { onClick: () => onMovementRequest(product), className: "p-3 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors" },
                            React.createElement(ArrowUpCircle, { size: 18 }), "Movimentar"
                        ),
                        React.createElement('button', { onClick: () => onEdit(product), className: "p-3 bg-slate-100 text-slate-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors" },
                            React.createElement(Edit2, { size: 18 }), "Editar informações"
                        )
                    )
                ),
                tab === 'history' && React.createElement('div', { className: "product-history-layout space-y-3 animate-fade-in relative" },
                    combinedHistory.length === 0
                        ? React.createElement('p', { className: "text-center text-slate-400 py-10 italic text-sm" }, "Nenhuma movimentação registrada.")
                        : React.createElement(React.Fragment, null,
                            React.createElement('div', { className: "product-history-header", 'aria-hidden': "true" },
                                React.createElement('span', null, "Movimentação"),
                                React.createElement('span', null, "Data"),
                                React.createElement('span', null, "Quantidade"),
                                React.createElement('span', null, "Valor")
                            ),
                            combinedHistory.map(historyItem => React.createElement('div', { key: historyItem.id, className: "product-history-record bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3" },
                                React.createElement('div', { className: `product-history-icon p-2 rounded-lg shrink-0 ${historyItem.isEntry ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}` },
                                    historyItem.isEntry ? React.createElement(ArrowUpCircle, { size: 20 }) : React.createElement(ArrowDownCircle, { size: 20 })
                                ),
                                React.createElement('div', { className: "product-history-main flex-1" },
                                    React.createElement('div', { className: "product-history-primary flex justify-between items-start" },
                                        React.createElement('p', { className: "product-history-type text-xs font-bold text-slate-800 uppercase leading-tight" }, historyItem.type.replace('_', ' ')),
                                        React.createElement('div', { className: "product-history-quantity text-right" },
                                            React.createElement('p', { className: `font-bold text-sm ${historyItem.isEntry ? 'text-emerald-600' : 'text-red-500'}` }, `${historyItem.isEntry ? '+' : '-'}${historyItem.qty} un.`)
                                        )
                                    ),
                                    React.createElement('div', { className: "product-history-secondary flex justify-between items-center mt-1" },
                                        React.createElement('p', { className: "product-history-date text-[10px] text-slate-400" }, formatDateTime(historyItem.date)),
                                        React.createElement('p', { className: "product-history-value text-xs font-bold text-slate-600" }, historyItem.totalValue > 0 ? formatCurrency(historyItem.totalValue) : "—")
                                    ),
                                    historyItem.notes && React.createElement('p', { className: "product-history-notes text-[10px] text-slate-500 mt-1 italic" }, `"${historyItem.notes}"`)
                                )
                            ))
                        )
                )
            ),
            React.createElement('div', { className: "desktop-modal-footer p-4 border-t border-slate-100 bg-white rounded-b-2xl shrink-0 flex flex-col gap-2" },
                React.createElement('button', { onClick: () => onDeleteRequest('product', product.id), className: "w-full py-3 text-red-400 hover:text-red-600 text-sm font-bold bg-white hover:bg-red-50 rounded-xl transition-colors border border-transparent flex items-center justify-center gap-2" },
                    React.createElement(Trash2, { size: 16 }), "Excluir produto permanentemente"
                )
            )
        )
    );
};

const getSaleTypeLabel = sale => sale.saleType === 'direct' ? 'Venda à vista' : 'Venda a prazo';

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

export const CustomerDetailsModal = ({
    isOpen, onClose, customer, salesHistory, onEdit, onCredit, onDelete
}) => {
    const [tab, setTab] = useState('info');

    useEffect(() => {
        if (isOpen) setTab('info');
    }, [isOpen, customer?.id]);

    const customerSales = useMemo(() => {
        if (!customer || !Array.isArray(salesHistory)) return [];
        const normalizedName = String(customer.name || '').trim().toUpperCase();

        return salesHistory
            .filter(sale => {
                if (sale.customerId) return sale.customerId === customer.id;
                return String(sale.customerName || '').trim().toUpperCase() === normalizedName;
            })
            .sort((a, b) => String(b.saleDate || '').localeCompare(String(a.saleDate || '')));
    }, [customer, salesHistory]);

    if (!isOpen || !customer) return null;

    const creditInfo = analyzeCustomerCredit(customer, 0, salesHistory || []);
    const activeSales = customerSales.filter(sale => sale.status !== 'canceled');
    const totalPurchased = activeSales.reduce((sum, sale) => sum + (Number(sale.totalPrice) || 0), 0);
    const directPurchases = activeSales.filter(sale => sale.saleType === 'direct').length;
    const termPurchases = activeSales.filter(sale => sale.saleType === 'prazo' || !sale.saleType).length;
    const inactive = customer.creditEnabled === false;
    const fullAddress = [
        customer.street,
        customer.number,
        customer.complement,
        customer.neighborhood,
        customer.cityState,
        customer.cep
    ].filter(Boolean).join(', ');

    const modal = React.createElement('div', {
        className: "customer-details-modal-overlay app-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-[9998] backdrop-blur-sm",
        role: "dialog",
        'aria-modal': "true",
        'aria-label': `Detalhes de ${customer.name}`
    },
        React.createElement('div', { className: "app-modal-panel desktop-modal desktop-modal-customer-details bg-white rounded-2xl w-full max-w-lg max-h-[94vh] flex flex-col shadow-2xl animate-fade-in" },
            React.createElement('div', { className: "desktop-modal-header customer-details-header p-5 border-b border-slate-100 flex justify-between items-start bg-slate-900 text-white rounded-t-2xl shrink-0" },
                React.createElement('div', { className: "min-w-0" },
                    React.createElement('p', { className: "text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-1" }, "Cadastro do cliente"),
                    React.createElement('h3', { className: "text-xl font-bold leading-tight truncate" }, customer.name),
                    React.createElement('div', { className: "flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-300" },
                        customer.phone && React.createElement('span', { className: "flex items-center gap-1" }, React.createElement(Phone, { size: 13 }), customer.phone),
                        customer.document && React.createElement('span', { className: "flex items-center gap-1" }, React.createElement(FileText, { size: 13 }), customer.document)
                    )
                ),
                React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-slate-800 rounded-full text-slate-300 transition-colors", 'aria-label': "Fechar" }, React.createElement(X, { size: 20 }))
            ),
            React.createElement('div', { className: "customer-details-tabs flex border-b border-slate-100 shrink-0 bg-slate-50" },
                React.createElement('button', { onClick: () => setTab('info'), className: `flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${tab === 'info' ? 'border-yellow-500 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}` }, "Cadastro e crédito"),
                React.createElement('button', { onClick: () => setTab('history'), className: `flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${tab === 'history' ? 'border-yellow-500 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}` }, `Histórico de compras (${customerSales.length})`)
            ),
            React.createElement('div', { className: "desktop-modal-body customer-details-body flex-1 overflow-y-auto p-5 no-scrollbar" },
                tab === 'info' && React.createElement('div', { className: "customer-details-overview animate-fade-in" },
                    React.createElement('section', { className: "customer-detail-card customer-personal-card" },
                        React.createElement('p', { className: "customer-detail-section-title" }, "Informações pessoais"),
                        React.createElement('div', { className: "customer-detail-fields" },
                            React.createElement('div', null, React.createElement('span', null, "WhatsApp"), React.createElement('strong', null, customer.phone || "Não informado")),
                            React.createElement('div', null, React.createElement('span', null, "CPF / CNPJ"), React.createElement('strong', null, customer.document || "Não informado")),
                            React.createElement('div', null, React.createElement('span', null, "Nascimento"), React.createElement('strong', null, customer.birthDate ? formatDate(customer.birthDate) : "Não informado")),
                            React.createElement('div', null, React.createElement('span', null, "Profissão"), React.createElement('strong', null, customer.profession || "Não informada")),
                            React.createElement('div', null, React.createElement('span', null, "Renda mensal"), React.createElement('strong', null, customer.income ? formatCurrency(customer.income) : "Não informada"))
                        )
                    ),
                    React.createElement('section', { className: "customer-detail-card customer-credit-card" },
                        React.createElement('div', { className: "flex items-start justify-between gap-3" },
                            React.createElement('div', null,
                                React.createElement('p', { className: "customer-detail-section-title" }, "Crédito a prazo"),
                                React.createElement('p', { className: `text-sm font-black mt-1 ${inactive ? 'text-slate-500' : 'text-emerald-700'}` }, inactive ? "Crédito inativo" : "Crédito ativo")
                            ),
                            React.createElement(inactive ? Lock : ShieldCheck, { size: 22, className: inactive ? 'text-slate-400' : 'text-emerald-600' })
                        ),
                        React.createElement('div', { className: "customer-credit-metrics" },
                            React.createElement('div', null, React.createElement('span', null, "Limite total"), React.createElement('strong', null, formatCurrency(creditInfo.calculatedLimit || 0))),
                            React.createElement('div', null, React.createElement('span', null, "Em aberto"), React.createElement('strong', { className: "text-orange-600" }, formatCurrency(creditInfo.currentDebt || 0))),
                            React.createElement('div', null, React.createElement('span', null, "Disponível"), React.createElement('strong', { className: inactive ? 'text-slate-400' : 'text-emerald-700' }, formatCurrency(inactive ? 0 : creditInfo.availableLimit || 0))),
                            React.createElement('div', null, React.createElement('span', null, "Tipo de limite"), React.createElement('strong', null, creditInfo.limitSource === 'manual' ? "Personalizado" : "Automático"))
                        )
                    ),
                    React.createElement('section', { className: "customer-detail-card customer-address-card desktop-span-full" },
                        React.createElement('p', { className: "customer-detail-section-title" }, "Endereço"),
                        React.createElement('div', { className: "flex items-start gap-3 mt-3" },
                            React.createElement(MapPin, { size: 18, className: "text-slate-400 shrink-0 mt-0.5" }),
                            React.createElement('div', null,
                                React.createElement('strong', { className: "text-sm text-slate-700 block" }, fullAddress || "Endereço não informado"),
                                customer.reference && React.createElement('span', { className: "text-xs text-slate-500 block mt-1" }, `Referência: ${customer.reference}`)
                            )
                        )
                    ),
                    React.createElement('section', { className: "customer-detail-card customer-purchase-summary desktop-span-full" },
                        React.createElement('p', { className: "customer-detail-section-title" }, "Resumo de compras"),
                        React.createElement('div', { className: "customer-purchase-metrics" },
                            React.createElement('div', null, React.createElement('span', null, "Compras realizadas"), React.createElement('strong', null, activeSales.length)),
                            React.createElement('div', null, React.createElement('span', null, "Total comprado"), React.createElement('strong', null, formatCurrency(totalPurchased))),
                            React.createElement('div', null, React.createElement('span', null, "A prazo"), React.createElement('strong', null, termPurchases)),
                            React.createElement('div', null, React.createElement('span', null, "À vista"), React.createElement('strong', null, directPurchases))
                        )
                    ),
                    React.createElement('div', { className: "customer-detail-actions desktop-span-full" },
                        React.createElement('button', { onClick: () => onCredit(customer), className: "customer-detail-action is-credit" },
                            React.createElement(SlidersHorizontal, { size: 18 }), "Configurar crédito"
                        ),
                        React.createElement('button', { onClick: () => onEdit(customer), className: "customer-detail-action is-edit" },
                            React.createElement(Edit2, { size: 18 }), "Editar informações"
                        )
                    )
                ),
                tab === 'history' && React.createElement('div', { className: "customer-purchase-history animate-fade-in" },
                    customerSales.length === 0
                        ? React.createElement('div', { className: "empty-state py-12" },
                            React.createElement('div', { className: "empty-state-icon" }, React.createElement(ShoppingBag, { size: 22 })),
                            React.createElement('p', { className: "empty-state-title" }, "Nenhuma compra encontrada"),
                            React.createElement('p', { className: "empty-state-copy" }, "As vendas a prazo e no caixa deste cliente aparecerão aqui.")
                        )
                        : React.createElement(React.Fragment, null,
                            React.createElement('div', { className: "customer-purchase-history-header", 'aria-hidden': "true" },
                                React.createElement('span', null, "Compra"),
                                React.createElement('span', null, "Pagamento"),
                                React.createElement('span', null, "Status"),
                                React.createElement('span', null, "Valor")
                            ),
                            customerSales.map(sale => {
                                const saleStatus = getSaleStatus(sale);
                                const itemCount = (sale.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
                                const TypeIcon = sale.saleType === 'direct'
                                    ? (sale.paymentMethod === 'pix' ? QrCode : sale.paymentMethod === 'money' ? Banknote : CreditCard)
                                    : Receipt;

                                return React.createElement('div', { key: sale.id, className: "customer-purchase-row" },
                                    React.createElement('div', { className: "customer-purchase-main" },
                                        React.createElement('div', { className: "customer-purchase-icon" }, React.createElement(TypeIcon, { size: 18 })),
                                        React.createElement('div', { className: "min-w-0" },
                                            React.createElement('strong', { className: "text-sm text-slate-800 block" }, getSaleTypeLabel(sale)),
                                            React.createElement('span', { className: "text-xs text-slate-500 block mt-0.5" }, `${formatDate(sale.saleDate)} · ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`)
                                        )
                                    ),
                                    React.createElement('div', { className: "customer-purchase-payment" },
                                        React.createElement('span', { className: "list-label-mobile" }, "Pagamento"),
                                        React.createElement('strong', null, getPaymentLabel(sale))
                                    ),
                                    React.createElement('div', { className: "customer-purchase-status" },
                                        React.createElement('span', { className: `status-badge ${saleStatus.className}` }, saleStatus.label)
                                    ),
                                    React.createElement('div', { className: "customer-purchase-value" },
                                        React.createElement('span', { className: "list-label-mobile" }, "Valor"),
                                        React.createElement('strong', null, formatCurrency(sale.totalPrice || 0)),
                                        React.createElement(ChevronRight, { size: 16, className: "hidden md:block text-slate-300" })
                                    )
                                );
                            })
                        )
                )
            ),
            React.createElement('div', { className: "desktop-modal-footer customer-details-footer p-4 border-t border-slate-100 bg-white rounded-b-2xl shrink-0" },
                React.createElement('button', { onClick: () => onDelete(customer), className: "customer-delete-button" },
                    React.createElement(Trash2, { size: 16 }), "Excluir cliente permanentemente"
                )
            )
        )
    );

    return createPortal(modal, document.body);
};
