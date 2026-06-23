import React from 'https://esm.sh/react@18.2.0';
import { Search, Phone, FileText, MapPin, Shield, Edit2, Trash2 } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, analyzeCustomerCredit } from './utils.js';
import { Pagination } from './components.js';

export const AbaClientes = ({ customerSearch, setCustomerSearch, setCustomerModalData, paginatedCustomers, sales, requestDelete, sortedCustomers, customersPage, setCustomersPage, ITEMS_PER_PAGE }) => {
    return React.createElement('div', { className: "space-y-4 animate-fade-in" },
        React.createElement('div', { className: "flex gap-2 mb-2" }, React.createElement('div', { className: "relative flex-1" }, React.createElement(Search, { className: "absolute left-3 top-3 text-slate-400", size: 18 }), React.createElement('input', { className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none", placeholder: "Buscar cliente ou documento...", value: customerSearch, onChange: e => setCustomerSearch(e.target.value.toUpperCase()) })), React.createElement('button', { onClick: () => setCustomerModalData({open:true, data:null}), className: "bg-yellow-500 text-white p-3 rounded-xl font-bold shadow-lg shadow-yellow-200" }, "+")),
        
        React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
            paginatedCustomers.map(c => {
                const creditInfo = analyzeCustomerCredit(c, 0, sales);

                return React.createElement('div', { key: c.id, className: "bg-white p-4 rounded-xl border border-slate-100 flex flex-col shadow-sm relative overflow-hidden" }, 
                    React.createElement('div', { className: "flex-1" }, 
                        React.createElement('h3', { className: "font-bold text-slate-800 mb-1" }, c.name), 
                        React.createElement('div', { className: "space-y-1 mt-2 text-sm text-slate-600" }, 
                            c.phone && React.createElement('p', { className: "flex items-center gap-2" }, React.createElement(Phone, { size: 14, className: "text-slate-400"}), c.phone), 
                            c.document && React.createElement('p', { className: "flex items-center gap-2" }, React.createElement(FileText, { size: 14, className: "text-slate-400"}), c.document), 
                            c.cityState && React.createElement('p', { className: "flex items-center gap-2" }, React.createElement(MapPin, { size: 14, className: "text-slate-400"}), c.cityState)
                        ),

                        React.createElement('div', { className: "mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100" },
                            React.createElement('p', { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1" }, React.createElement(Shield, { size: 12 }), "Análise de Crédito"),
                            React.createElement('div', { className: "flex justify-between items-center text-sm" },
                                React.createElement('span', { className: "text-slate-600" }, "Limite Disponível:"),
                                React.createElement('span', { className: `font-bold ${creditInfo.availableLimit > 0 ? 'text-emerald-600' : 'text-red-500'}` }, formatCurrency(creditInfo.availableLimit))
                            ),
                            creditInfo.currentDebt > 0 && React.createElement('div', { className: "flex justify-between items-center text-xs mt-1 border-t border-slate-200 pt-1" },
                                React.createElement('span', { className: "text-slate-500" }, "Em Aberto:"),
                                React.createElement('span', { className: "font-bold text-orange-500" }, formatCurrency(creditInfo.currentDebt))
                            )
                        )
                    ), 
                    React.createElement('div', { className: "flex gap-2 mt-4 pt-3 border-t border-slate-100" }, React.createElement('button', { onClick: () => setCustomerModalData({open: true, data: c}), className: "flex-1 text-slate-400 hover:text-yellow-600 p-2 flex justify-center items-center rounded-lg hover:bg-slate-50 transition-colors" }, React.createElement(Edit2, { size: 18 })), React.createElement('button', { onClick: () => requestDelete('customer', c.id), className: "flex-1 text-slate-400 hover:text-red-500 p-2 flex justify-center items-center rounded-lg hover:bg-red-50 transition-colors" }, React.createElement(Trash2, { size: 18 })))
                )
            })
        ),
        React.createElement(Pagination, { totalItems: sortedCustomers.length, itemsPerPage: ITEMS_PER_PAGE, currentPage: customersPage, onPageChange: setCustomersPage })
    );
};
