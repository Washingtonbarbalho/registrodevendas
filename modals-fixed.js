import React, { useState, useMemo } from 'https://esm.sh/react@18.2.0';
import { X, Tag, Trash2, Edit2, ArrowUpCircle, ArrowDownCircle } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, getBrazilDateString } from './utils.js?v=19';

export {
    UserProfileModal,
    CustomerFormModal,
    EditInstallmentModal,
    SaleDetailsModal,
    PixCodeModal,
    InstallmentListModal,
    PaymentConfirmationModal,
    ConfirmModal,
    WhatsAppChooserModal,
    ProductModal,
    StockMovementModal
} from './modals.js?v=19';

const formatDateTime = dateStr => {
    if (!dateStr) return '--/--/---- --:--';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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

    const combinedHistory = useMemo(() => {
        const history = [];
        if (!product) return history;

        if (Array.isArray(product.movements)) {
            product.movements.forEach(movement => {
                const quantity = toNumber(movement.quantity);
                history.push({
                    id: movement.id,
                    date: movement.date,
                    type: movement.type,
                    qty: quantity,
                    isEntry: ['compra', 'ajuste_entrada', 'devolucao'].includes(movement.type),
                    totalValue: quantity * toNumber(movement.unitCost),
                    notes: movement.notes
                });
            });
        }

        if (Array.isArray(salesHistory)) {
            salesHistory.forEach(sale => {
                const itemMatch = sale.items?.find(item => item.productId === product.id);
                if (!itemMatch) return;

                const quantity = toNumber(itemMatch.quantity);
                const storedLineTotal = toNumber(itemMatch.price);
                const storedUnitPrice = toNumber(itemMatch.unitPrice);

                // No cadastro atual da venda, item.price já representa o total da linha.
                // Antes ele era multiplicado novamente pela quantidade, gerando valores como
                // 3 x R$ 270,00 = R$ 810,00. Agora usamos o total salvo diretamente.
                const lineTotal = storedLineTotal > 0
                    ? storedLineTotal
                    : quantity * (storedUnitPrice || toNumber(product.salePrice));

                history.push({
                    id: `sale-${sale.id}`,
                    date: `${sale.saleDate}T12:00:00.000Z`,
                    type: 'venda',
                    qty: quantity,
                    isEntry: false,
                    totalValue: lineTotal,
                    notes: `Venda p/ ${sale.customerName?.split(' ')[0] || 'cliente'}`
                });

                if (sale.status === 'canceled') {
                    history.push({
                        id: `cancel-${sale.id}`,
                        date: getCanceledDate(sale),
                        type: 'cancelamento',
                        qty: quantity,
                        isEntry: true,
                        totalValue: lineTotal,
                        notes: 'Venda Cancelada'
                    });
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
                            React.createElement(ArrowUpCircle, { size: 18 }), " Movimentar"
                        ),
                        React.createElement('button', { onClick: () => onEdit(product), className: "p-3 bg-slate-100 text-slate-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors" },
                            React.createElement(Edit2, { size: 18 }), " Editar Info"
                        )
                    )
                ),
                tab === 'history' && React.createElement('div', { className: "product-history-layout space-y-3 animate-fade-in relative" },
                    combinedHistory.length === 0
                        ? React.createElement('p', { className: "text-center text-slate-400 py-10 italic text-sm" }, "Nenhuma movimentação registrada.")
                        : combinedHistory.map(historyItem => React.createElement('div', { key: historyItem.id, className: "bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3" },
                            React.createElement('div', { className: `p-2 rounded-lg shrink-0 ${historyItem.isEntry ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}` },
                                historyItem.isEntry ? React.createElement(ArrowUpCircle, { size: 20 }) : React.createElement(ArrowDownCircle, { size: 20 })
                            ),
                            React.createElement('div', { className: "flex-1" },
                                React.createElement('div', { className: "flex justify-between items-start" },
                                    React.createElement('p', { className: "text-xs font-bold text-slate-800 uppercase leading-tight" }, historyItem.type.replace('_', ' ')),
                                    React.createElement('div', { className: "text-right" },
                                        React.createElement('p', { className: `font-bold text-sm ${historyItem.isEntry ? 'text-emerald-600' : 'text-red-500'}` }, `${historyItem.isEntry ? '+' : '-'}${historyItem.qty} un.`)
                                    )
                                ),
                                React.createElement('div', { className: "flex justify-between items-center mt-1" },
                                    React.createElement('p', { className: "text-[10px] text-slate-400" }, formatDateTime(historyItem.date)),
                                    historyItem.totalValue > 0 && React.createElement('p', { className: "text-xs font-bold text-slate-600" }, formatCurrency(historyItem.totalValue))
                                ),
                                historyItem.notes && React.createElement('p', { className: "text-[10px] text-slate-500 mt-1 italic" }, `"${historyItem.notes}"`)
                            )
                        ))
                )
            ),
            React.createElement('div', { className: "desktop-modal-footer p-4 border-t border-slate-100 bg-white rounded-b-2xl shrink-0 flex flex-col gap-2" },
                React.createElement('button', { onClick: () => onDeleteRequest('product', product.id), className: "w-full py-3 text-red-400 hover:text-red-600 text-sm font-bold bg-white hover:bg-red-50 rounded-xl transition-colors border border-transparent flex items-center justify-center gap-2" },
                    React.createElement(Trash2, { size: 16 }), " Excluir Produto Permanentemente"
                )
            )
        )
    );
};
