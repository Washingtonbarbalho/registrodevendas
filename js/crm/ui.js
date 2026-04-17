import {
  React, useState, useEffect, useMemo, useRef,
  Gift, Hash, Users, Filter, Trophy, LogOut, Search, AlertTriangle, Lock, Mail, Store, ChevronRight, ChevronDown, CheckCircle, Banknote, CreditCard, QrCode, Clock, Check, Star, Award, MessageCircle, ChevronLeft, LayoutGrid, MoreHorizontal, X, BarChart3, TrendingUp, Package, Clock4, HeartHandshake, Calendar, Copy,
  db, auth, APP_ID,
  collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  confetti
} from '../core.js';

import { formatCurrency, parseMoney, maskMoney, formatDate, getCurrentMonthStart, getCurrentMonthEnd } from './utils.js';

const WhatsAppChooserModal = ({
  isOpen,
  onClose,
  phone,
  message
}) => {
  if (!isOpen) return null;
  const handleOpen = type => {
    const encodedMsg = encodeURIComponent(message);
    const cleanPhone = phone?.replace(/\D/g, '') || '';
    if (type === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodedMsg}`, '_blank');
    } else if (type === 'copy') {
      navigator.clipboard.writeText(message);
    }
    onClose();
  };
  return React.createElement("div", {
    className: "fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[90] backdrop-blur-sm"
  }, React.createElement("div", {
    className: "bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in text-center"
  }, React.createElement("h3", {
    className: "text-lg font-bold text-slate-800 mb-1"
  }, "A\xE7\xE3o de Mensagem"), React.createElement("p", {
    className: "text-sm text-slate-500 mb-6"
  }, "Escolha o que deseja fazer com a mensagem."), React.createElement("div", {
    className: "space-y-3"
  }, React.createElement("button", {
    onClick: () => handleOpen('whatsapp'),
    className: "w-full p-4 bg-green-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-green-600 shadow-sm"
  }, React.createElement(MessageCircle, {
    size: 20
  }), " Abrir no WhatsApp"), React.createElement("button", {
    onClick: () => handleOpen('copy'),
    className: "w-full p-4 bg-slate-100 text-slate-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200"
  }, React.createElement(Copy, {
    size: 20
  }), " Copiar Mensagem")), React.createElement("button", {
    onClick: onClose,
    className: "mt-4 p-2 text-slate-400 hover:text-slate-600 w-full font-bold"
  }, "Cancelar")));
};
const DateRangeFilter = ({
  period,
  startDate,
  endDate,
  onPeriodChange,
  onStartChange,
  onEndChange
}) => {
  const [expanded, setExpanded] = useState(false);
  return React.createElement("div", {
    className: "bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6"
  }, React.createElement("div", {
    className: "flex justify-between items-center cursor-pointer",
    onClick: () => setExpanded(!expanded)
  }, React.createElement("div", {
    className: "flex items-center gap-2"
  }, React.createElement(Filter, {
    size: 16,
    className: "text-slate-400"
  }), React.createElement("span", {
    className: "text-sm font-bold text-slate-600"
  }, period === 'month' ? "Mês Atual" : "Período Personalizado")), React.createElement("div", {
    className: "flex items-center gap-3"
  }, React.createElement("span", {
    className: "text-xs text-slate-400 hidden sm:block"
  }, formatDate(startDate), " a ", formatDate(endDate)), React.createElement(ChevronDown, {
    size: 16,
    className: `text-slate-300 transition-transform ${expanded ? 'rotate-180' : ''}`
  }))), expanded && React.createElement("div", {
    className: "mt-4 pt-4 border-t border-slate-50 space-y-3 animate-fade-in"
  }, React.createElement("div", {
    className: "flex gap-2"
  }, React.createElement("button", {
    onClick: () => onPeriodChange('month'),
    className: `flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${period === 'month' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`
  }, "M\xEAs Atual"), React.createElement("button", {
    onClick: () => onPeriodChange('custom'),
    className: `flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${period === 'custom' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`
  }, "Personalizar")), period === 'custom' && React.createElement("div", {
    className: "grid grid-cols-2 gap-3 mt-3"
  }, React.createElement("div", null, React.createElement("label", {
    className: "text-[10px] uppercase font-bold text-slate-400 block mb-1"
  }, "In\xEDcio"), React.createElement("input", {
    type: "date",
    className: "w-full p-2 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-yellow-500 outline-none",
    value: startDate,
    onChange: e => onStartChange(e.target.value)
  })), React.createElement("div", null, React.createElement("label", {
    className: "text-[10px] uppercase font-bold text-slate-400 block mb-1"
  }, "Fim"), React.createElement("input", {
    type: "date",
    className: "w-full p-2 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-yellow-500 outline-none",
    value: endDate,
    onChange: e => onEndChange(e.target.value)
  })))));
};
const Pagination = ({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange
}) => {
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
  return React.createElement("div", {
    className: "flex justify-center items-center gap-2 mt-8 py-2 select-none animate-fade-in"
  }, React.createElement("button", {
    onClick: () => onPageChange(currentPage - 1),
    disabled: currentPage === 1,
    className: "p-2 rounded-lg hover:bg-slate-200 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
  }, React.createElement(ChevronLeft, {
    size: 20
  })), renderPageNumbers().map((page, index) => {
    if (page === '...') {
      return React.createElement("button", {
        key: `ellipsis-${index}`,
        onClick: () => setShowAllPagesModal(true),
        className: "w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
      }, React.createElement(MoreHorizontal, {
        size: 16
      }));
    }
    return React.createElement("button", {
      key: page,
      onClick: () => onPageChange(page),
      className: `w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm transition-colors ${currentPage === page ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100'}`
    }, page);
  }), React.createElement("button", {
    onClick: () => onPageChange(currentPage + 1),
    disabled: currentPage === totalPages,
    className: "p-2 rounded-lg hover:bg-slate-200 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
  }, React.createElement(ChevronRight, {
    size: 20
  })), showAllPagesModal && React.createElement("div", {
    className: "fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4"
  }, React.createElement("div", {
    className: "bg-white rounded-2xl w-full max-w-sm p-4 animate-fade-in shadow-2xl"
  }, React.createElement("div", {
    className: "flex justify-between items-center mb-4"
  }, React.createElement("h3", {
    className: "font-bold text-slate-800 flex items-center gap-2"
  }, React.createElement(LayoutGrid, {
    size: 18
  }), " Navegar para p\xE1gina"), React.createElement("button", {
    onClick: () => setShowAllPagesModal(false),
    className: "p-1 hover:bg-slate-100 rounded-full"
  }, React.createElement(X, {
    size: 20
  }))), React.createElement("div", {
    className: "grid grid-cols-5 gap-2 max-h-60 overflow-y-auto p-1 hide-scrollbar"
  }, Array.from({
    length: totalPages
  }, (_, i) => i + 1).map(p => React.createElement("button", {
    key: p,
    onClick: () => {
      onPageChange(p);
      setShowAllPagesModal(false);
    },
    className: `p-2 rounded-lg font-bold text-sm border ${currentPage === p ? 'bg-yellow-500 text-white border-yellow-500' : 'border-slate-100 text-slate-600 hover:bg-slate-50'}`
  }, p))))));
};
const MoneyInput = ({
  value,
  onChange,
  placeholder,
  className,
  disabled
}) => {
  const [display, setDisplay] = useState(typeof value === 'number' ? maskMoney(value.toFixed(2)) : value);
  useEffect(() => {
    if (typeof value === 'number') setDisplay(maskMoney(value.toFixed(2)));
  }, [value]);
  const handleChange = e => {
    const m = maskMoney(e.target.value);
    setDisplay(m);
    onChange(m);
  };
  return React.createElement("div", {
    className: "relative w-full"
  }, React.createElement("span", {
    className: "absolute left-3 top-3 text-slate-400 font-bold"
  }, "R$"), React.createElement("input", {
    type: "text",
    inputMode: "numeric",
    disabled: disabled,
    className: className,
    placeholder: placeholder || "0,00",
    value: display,
    onChange: handleChange
  }));
};
const MultiSelectDropdown = ({
  options,
  selected,
  onChange,
  placeholder,
  disabled
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = event => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const displayValue = selected.length === 0 ? placeholder : selected.length === options.length ? "Todas as Formas" : `${selected.length} selecionada(s)`;
  return React.createElement("div", {
    className: "relative w-full",
    ref: dropdownRef
  }, React.createElement("div", {
    className: `w-full p-3 border rounded-xl bg-slate-50 flex justify-between items-center transition-colors ${disabled ? 'opacity-60 cursor-not-allowed border-slate-200' : 'cursor-pointer border-slate-200 hover:border-yellow-300'}`,
    onClick: () => !disabled && setIsOpen(!isOpen)
  }, React.createElement("span", {
    className: `text-sm ${selected.length === 0 ? 'text-slate-500' : 'text-slate-800 font-medium'}`
  }, displayValue), React.createElement(ChevronDown, {
    size: 18,
    className: `text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`
  })), isOpen && !disabled && React.createElement("div", {
    className: "absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-fade-in py-1"
  }, options.map(opt => {
    const isSelected = selected.includes(opt.id);
    return React.createElement("div", {
      key: opt.id,
      className: "px-4 py-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer transition-colors",
      onClick: () => onChange(opt.id)
    }, React.createElement("div", {
      className: `w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-yellow-500 border-yellow-500' : 'border-slate-300 bg-white'}`
    }, isSelected && React.createElement(Check, {
      size: 14,
      className: "text-white"
    })), React.createElement("span", {
      className: "text-sm text-slate-700"
    }, opt.label));
  })));
};

export { WhatsAppChooserModal, DateRangeFilter, Pagination, MoneyInput, MultiSelectDropdown };
