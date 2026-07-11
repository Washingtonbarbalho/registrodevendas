import React from 'https://esm.sh/react@18.2.0';
import { Search, Tag, Plus, ChevronRight, PackageSearch, Boxes } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, getBrazilDateString } from './utils.js';
import { Pagination } from './components.js';

export const AbaProdutos = ({ productSearch, setProductSearch, paginatedProducts, sortedProducts, productsPage, setProductsPage, setProductDetailsData, setProductModalData, ITEMS_PER_PAGE }) => {
    return React.createElement('section', { className: "page-stack animate-fade-in" },
        React.createElement('div', { className: "page-heading" },
            React.createElement('div', { className: "page-heading-copy" },
                React.createElement('h2', { className: "page-title" }, "Produtos"),
                React.createElement('p', { className: "page-description" }, "Consulte preços, promoções e estoque em uma lista organizada.")
            ),
            React.createElement('button', {
                onClick: () => setProductModalData({ open: true, data: null }),
                className: "page-primary-action"
            }, React.createElement(Plus, { size: 18 }), "Novo produto")
        ),

        React.createElement('div', { className: "toolbar" },
            React.createElement('div', { className: "toolbar-search" },
                React.createElement(Search, { size: 18 }),
                React.createElement('input', {
                    placeholder: "Buscar por produto ou código...",
                    value: productSearch,
                    onChange: event => setProductSearch(event.target.value.toUpperCase())
                })
            ),
            React.createElement('span', { className: "result-count" }, `${sortedProducts.length} ${sortedProducts.length === 1 ? 'produto' : 'produtos'}`)
        ),

        React.createElement('div', { className: "list-shell" },
            React.createElement('div', { className: "list-header md:grid-cols-[100px_minmax(0,1.7fr)_150px_120px_110px_34px]" },
                React.createElement('span', null, "Código"),
                React.createElement('span', null, "Produto"),
                React.createElement('span', null, "Preço de venda"),
                React.createElement('span', null, "Custo médio"),
                React.createElement('span', null, "Estoque"),
                React.createElement('span', null, "")
            ),

            paginatedProducts.length === 0
                ? React.createElement('div', { className: "empty-state" },
                    React.createElement('div', { className: "empty-state-icon" }, React.createElement(PackageSearch, { size: 22 })),
                    React.createElement('p', { className: "empty-state-title" }, "Nenhum produto encontrado"),
                    React.createElement('p', { className: "empty-state-copy" }, "Tente mudar sua busca ou cadastre um novo produto.")
                )
                : paginatedProducts.map(product => {
                    const today = getBrazilDateString();
                    const isPromoActive = product.isPromo && today >= product.promoStart && today <= product.promoEnd;
                    const stock = Number(product.quantity) || 0;

                    return React.createElement('div', {
                        key: product.id,
                        onClick: () => setProductDetailsData({ open: true, data: product }),
                        className: "list-row grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[100px_minmax(0,1.7fr)_150px_120px_110px_34px]"
                    },
                        React.createElement('div', { className: "hidden md:block font-mono text-xs text-slate-500" }, `#${product.code}`),
                        React.createElement('div', { className: "list-main" },
                            React.createElement('div', { className: "flex items-center gap-2 min-w-0" },
                                React.createElement('span', { className: "md:hidden text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-1 rounded-lg shrink-0" }, `#${product.code}`),
                                React.createElement('p', { className: "list-title" }, product.name),
                                isPromoActive && React.createElement('span', { className: "status-badge status-purple shrink-0" }, React.createElement(Tag, { size: 11 }), "Promo")
                            ),
                            React.createElement('p', { className: "list-subtitle" }, product.description || "Sem descrição cadastrada")
                        ),
                        React.createElement('div', { className: "hidden md:block" },
                            isPromoActive
                                ? React.createElement(React.Fragment, null,
                                    React.createElement('div', { className: "text-[10px] text-slate-400 line-through" }, formatCurrency(product.salePrice)),
                                    React.createElement('div', { className: "list-value text-purple-700" }, formatCurrency(product.promoPrice))
                                )
                                : React.createElement('div', { className: "list-value" }, formatCurrency(product.salePrice))
                        ),
                        React.createElement('div', { className: "hidden md:block list-meta font-semibold" }, formatCurrency(product.costPrice)),
                        React.createElement('div', { className: "hidden md:flex items-center gap-2" },
                            React.createElement(Boxes, { size: 15, className: stock <= 0 ? 'text-red-500' : stock <= 3 ? 'text-orange-500' : 'text-slate-400' }),
                            React.createElement('span', { className: `text-xs font-extrabold ${stock <= 0 ? 'text-red-600' : stock <= 3 ? 'text-orange-600' : 'text-slate-700'}` }, `${stock} un.`)
                        ),
                        React.createElement('div', { className: "md:hidden text-right" },
                            React.createElement('span', { className: "list-label-mobile" }, "Venda"),
                            React.createElement('p', { className: `list-value ${isPromoActive ? 'text-purple-700' : ''}` }, formatCurrency(isPromoActive ? product.promoPrice : product.salePrice)),
                            React.createElement('p', { className: `mt-1 text-[10px] font-extrabold ${stock <= 0 ? 'text-red-600' : stock <= 3 ? 'text-orange-600' : 'text-slate-500'}` }, `${stock} em estoque`)
                        ),
                        React.createElement('div', { className: "hidden md:grid place-items-center text-slate-300" }, React.createElement(ChevronRight, { size: 18 }))
                    );
                })
        ),

        React.createElement(Pagination, {
            totalItems: sortedProducts.length,
            itemsPerPage: ITEMS_PER_PAGE,
            currentPage: productsPage,
            onPageChange: setProductsPage
        })
    );
};
