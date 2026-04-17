import {
  React, useState, useEffect, useMemo, useRef,
  Users, ShoppingBag, PlusCircle, CheckCircle, MessageCircle, Trash2, ChevronDown, ChevronUp, Package, TrendingUp, Edit2, AlertTriangle, Wallet, Search, CreditCard, QrCode, Banknote, Calendar, Filter, X, PieChart, BarChart3, ArrowUpRight, ArrowDownRight, PackageMinus, LogOut, Lock, Mail, Phone, Store, UserCog, UserCheck, UserX, Shield, ChevronLeft, ChevronRight, MoreHorizontal, LayoutGrid, AlertCircle, RefreshCw, Clock, Bell, History, FileText, XCircle, User, Smartphone, Copy, Tag, Info, MapPin, BadgePercent, Receipt,
  db, auth, APP_ID, ADMIN_EMAIL,
  collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged
} from '../core.js';

import { maskMoney, parseMoney, getCurrentMonthStart, getCurrentMonthEnd } from './utils.js';

const MoneyInput = ({ value, onChange, placeholder, className, autoFocus, disabled }) => {
    const [display, setDisplay] = useState(typeof value === 'number' ? maskMoney((value * 100).toFixed(0)) : value);
    
    useEffect(() => { 
        if (typeof value === 'number') {
            setDisplay(maskMoney((value * 100).toFixed(0))); 
        } else if (typeof value === 'string') {
            setDisplay(value);
        }
    }, [value]);

    const handleChange = (e) => { const m = maskMoney(e.target.value); setDisplay(m); onChange(m); };
    return React.createElement('div', { className: "relative w-full" },
        React.createElement('span', { className: `absolute left-3 top-3 font-bold ${disabled ? 'text-slate-300' : 'text-slate-400'}` }, "R$"),
        React.createElement('input', { autoFocus: autoFocus, disabled: disabled, type: "text", inputMode: "numeric", className: className, placeholder: placeholder || "0,00", value: display, onChange: handleChange })
    );
};

const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const [showAllPagesModal, setShowAllPagesModal] = useState(false);

    if (totalPages <= 1) return null;

    const renderPageNumbers = () => {
        const pages = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 4) {
                pages.push(1, 2, 3, 4, 5, '...', totalPages);
            } else if (currentPage >= totalPages - 3) {
                pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            } else {
                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
            }
        }
        return pages;
    };

    return React.createElement('div', { className: "flex justify-center items-center gap-2 mt-6 py-2 select-none" },
        React.createElement('button', { 
            onClick: () => onPageChange(currentPage - 1), 
            disabled: currentPage === 1,
            className: "p-2 rounded-lg hover:bg-slate-200 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent"
        }, React.createElement(ChevronLeft, { size: 20 })),

        renderPageNumbers().map((page, index) => {
            if (page === '...') {
                return React.createElement('button', { 
                    key: `ellipsis-${index}`,
                    onClick: () => setShowAllPagesModal(true),
                    className: "w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400"
                }, React.createElement(MoreHorizontal, { size: 16 }));
            }
            return React.createElement('button', {
                key: page,
                onClick: () => onPageChange(page),
                className: `w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm transition-colors ${currentPage === page ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100'}`
            }, page);
        }),

        React.createElement('button', { 
            onClick: () => onPageChange(currentPage + 1), 
            disabled: currentPage === totalPages,
            className: "p-2 rounded-lg hover:bg-slate-200 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent"
        }, React.createElement(ChevronRight, { size: 20 })),

        showAllPagesModal && React.createElement('div', { className: "fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4" },
            React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-sm p-4 animate-fade-in shadow-2xl" },
                React.createElement('div', { className: "flex justify-between items-center mb-4" },
                    React.createElement('h3', { className: "font-bold text-slate-800 flex items-center gap-2" }, React.createElement(LayoutGrid, { size: 18 }), "Navegar para página"),
                    React.createElement('button', { onClick: () => setShowAllPagesModal(false) }, React.createElement(X, { size: 20 }))
                ),
                React.createElement('div', { className: "grid grid-cols-5 gap-2 max-h-60 overflow-y-auto p-1" },
                    Array.from({ length: totalPages }, (_, i) => i + 1).map(p => 
                        React.createElement('button', {
                            key: p,
                            onClick: () => { onPageChange(p); setShowAllPagesModal(false); },
                            className: `p-2 rounded-lg font-bold text-sm border ${currentPage === p ? 'bg-yellow-500 text-white border-yellow-500' : 'border-slate-100 text-slate-600 hover:bg-slate-50'}`
                        }, p)
                    )
                )
            )
        )
    );
};

const DateRangeFilter = ({ period, startDate, endDate, onPeriodChange, onStartChange, onEndChange }) => {
    const [expanded, setExpanded] = useState(false);
    return React.createElement('div', { className: "bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4" },
        React.createElement('div', { className: "flex justify-between items-center cursor-pointer", onClick: () => setExpanded(!expanded) },
            React.createElement('div', { className: "flex items-center gap-2" }, 
                React.createElement(Filter, { size: 16, className: "text-slate-400" }), 
                React.createElement('span', { className: "text-sm font-bold text-slate-600" }, period === 'month' ? "Mês Atual" : "Período Personalizado")
            ),
            React.createElement(ChevronDown, { size: 16, className: `text-slate-300 transition-transform ${expanded ? 'rotate-180' : ''}` })
        ),
        expanded && React.createElement('div', { className: "mt-4 pt-4 border-t border-slate-50 space-y-3 animate-fade-in" },
            React.createElement('div', { className: "flex gap-2" }, 
                React.createElement('button', { onClick: () => onPeriodChange('month'), className: `flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${period === 'month' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}` }, "Mês Atual"), 
                React.createElement('button', { onClick: () => onPeriodChange('custom'), className: `flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${period === 'custom' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}` }, "Personalizar")
            ),
            period === 'custom' && React.createElement('div', { className: "grid grid-cols-2 gap-2" }, 
                React.createElement('div', null, 
                    React.createElement('label', { className: "text-[10px] uppercase font-bold text-slate-400" }, "Início"), 
                    React.createElement('input', { type: "date", className: "w-full p-2 border border-slate-200 rounded text-xs", value: startDate, onChange: e => onStartChange(e.target.value) })
                ), 
                React.createElement('div', null, 
                    React.createElement('label', { className: "text-[10px] uppercase font-bold text-slate-400" }, "Fim"), 
                    React.createElement('input', { type: "date", className: "w-full p-2 border border-slate-200 rounded text-xs", value: endDate, onChange: e => onEndChange(e.target.value) })
                )
            )
        )
    );
};

export { MoneyInput, Pagination, DateRangeFilter };
