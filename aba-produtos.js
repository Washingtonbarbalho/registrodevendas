import React from 'https://esm.sh/react@18.2.0';
import { Search, Tag } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, getBrazilDateString } from './utils.js';
import { Pagination } from './components.js';

export const AbaProdutos = ({ productSearch, setProductSearch, paginatedProducts, sortedProducts, productsPage, setProductsPage, setProductDetailsData, setProductModalData, ITEMS_PER_PAGE }) => {
    return React.createElement('div', { className: "space-y-4 animate-fade-in" },
        React.createElement('div', { className: "flex gap-2 mb-4" }, 
            React.createElement('div', { className: "relative flex-1" }, 
                React.createElement(Search, { className: "absolute left-3 top-3.5 text-slate-400", size: 18 }), 
                React.createElement('input', { className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none shadow-sm", placeholder: "Buscar produto...", value: productSearch, onChange: e => setProductSearch(e.target.value.toUpperCase()) })
            ),
            React.createElement('button', { 
                onClick: () => setProductModalData({open: true, data: null}), 
                className: "bg-yellow-500 text-slate-900 p-3 rounded-xl font-bold shadow-lg shadow-yellow-200 hover:bg-yellow-400 transition-colors flex items-center justify-center w-12 h-12 shrink-0" 
            }, "+")
        ),
        
        React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" },
            paginatedProducts.map(p => {
                const today = getBrazilDateString();
                const isPromoActive = p.isPromo && today >= p.promoStart && today <= p.promoEnd;
                
                return React.createElement('div', { 
                    key: p.id, 
                    onClick: () => setProductDetailsData({open: true, data: p}), 
                    className: "bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:border-yellow-300 transition-all cursor-pointer" 
                }, 
                    React.createElement('div', { className: "p-4 flex-1" },
                        React.createElement('div', { className: "flex justify-between items-start mb-2" },
                            React.createElement('span', { className: "text-xs font-mono bg-slate-100 text-slate-500 px-2 py-1 rounded" }, `#${p.code}`),
                            isPromoActive && React.createElement('span', { className: "bg-purple-100 text-purple-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase flex items-center gap-1" }, React.createElement(Tag, { size: 10 }), " Promo")
                        ),
                        React.createElement('h3', { className: "font-bold text-slate-800 leading-tight mb-1" }, p.name),
                        React.createElement('div', { className: "flex justify-between items-end mt-4" },
                            React.createElement('div', null,
                                React.createElement('p', { className: "text-[10px] text-slate-400 uppercase font-bold" }, "Venda"),
                                isPromoActive ? 
                                    React.createElement('div', { className: "flex flex-col" },
                                        React.createElement('span', { className: "text-xs text-slate-400 line-through" }, formatCurrency(p.salePrice)),
                                        React.createElement('span', { className: "text-lg font-bold text-purple-600" }, formatCurrency(p.promoPrice))
                                    ) : 
                                    React.createElement('span', { className: "text-lg font-bold text-slate-800" }, formatCurrency(p.salePrice))
                            ),
                            React.createElement('div', { className: "text-right" },
                                React.createElement('p', { className: "text-[10px] text-slate-400 uppercase font-bold" }, "Estoque"),
                                React.createElement('span', { className: `font-bold ${p.quantity <= 0 ? 'text-red-500' : 'text-slate-700'}` }, `${p.quantity} un.`)
                            )
                        )
                    )
                );
            }),
            sortedProducts.length === 0 && React.createElement('p', { className: "col-span-full text-center text-slate-400 py-10" }, "Nenhum produto encontrado.")
        ),
        React.createElement(Pagination, { totalItems: sortedProducts.length, itemsPerPage: ITEMS_PER_PAGE, currentPage: productsPage, onPageChange: setProductsPage })
    );
};
