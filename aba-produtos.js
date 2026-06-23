import React from 'https://esm.sh/react@18.2.0';
import { Search, Tag } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, getBrazilDateString } from './utils.js';
import { Pagination } from './components.js';

export const AbaProdutos = ({ productSearch, setProductSearch, paginatedProducts, sortedProducts, productsPage, setProductsPage, setProductViewModalData, ITEMS_PER_PAGE }) => {
    return React.createElement('div', { className: "space-y-4 animate-fade-in" },
        React.createElement('div', { className: "flex gap-2 mb-2" }, 
            React.createElement('div', { className: "relative flex-1" }, 
                React.createElement(Search, { className: "absolute left-3 top-3 text-slate-400", size: 18 }), 
                React.createElement('input', { className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none shadow-sm", placeholder: "Buscar produto...", value: productSearch, onChange: e => setProductSearch(e.target.value.toUpperCase()) })
            )
        ),
        
        React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
            paginatedProducts.map(p => {
                const today = getBrazilDateString();
                const isPromo = p.isPromo && today >= p.promoStart && today <= p.promoEnd;
                
                return React.createElement('div', { key: p.id, onClick: () => setProductViewModalData({open: true, data: p}), className: "bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm cursor-pointer hover:border-yellow-300 transition-colors" }, 
                    React.createElement('div', { className: "flex flex-col gap-1" }, 
                        React.createElement('span', { className: "text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded self-start" }, `#${p.code}`), 
                        React.createElement('span', { className: "font-bold text-slate-800 text-sm leading-tight flex items-center gap-1" }, p.name, isPromo && React.createElement(Tag, { size: 12, className: "text-purple-500" }))
                    ), 
                    React.createElement('div', { className: "flex flex-col items-end gap-1" }, 
                        isPromo ? React.createElement('span', { className: "font-bold text-purple-600 text-sm" }, formatCurrency(p.promoPrice)) : React.createElement('span', { className: "font-bold text-slate-800 text-sm" }, formatCurrency(p.salePrice)),
                        React.createElement('span', { className: `text-[10px] font-bold ${p.quantity <= 0 ? 'text-red-500' : 'text-slate-400'}` }, `${p.quantity} un.`)
                    )
                )
            })
        ),
        React.createElement(Pagination, { totalItems: sortedProducts.length, itemsPerPage: ITEMS_PER_PAGE, currentPage: productsPage, onPageChange: setProductsPage })
    );
};
