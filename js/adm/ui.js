import {
  React, useState, useEffect, useMemo,
  Users, PlusCircle, Search, Edit2, Trash2, X, Tag, User, Phone, FileText, MapPin, Store, Lock, AlertTriangle, ChevronRight, ChevronLeft, MoreHorizontal, LayoutGrid, ArrowDownCircle, ArrowUpCircle, History, Info, LogOut, CheckCircle, Clock, Package,
  db, auth, APP_ID, ADMIN_EMAIL,
  collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged
} from '../core.js';

import { maskMoney } from './utils.js';

const MoneyInput = ({
  value,
  onChange,
  placeholder,
  className,
  disabled
}) => {
  const [display, setDisplay] = useState(typeof value === 'number' ? maskMoney((value * 100).toFixed(0)) : value);
  useEffect(() => {
    if (typeof value === 'number') {
      setDisplay(maskMoney((value * 100).toFixed(0)));
    } else if (typeof value === 'string') {
      setDisplay(value);
    }
  }, [value]);
  const handleChange = e => {
    const m = maskMoney(e.target.value);
    setDisplay(m);
    onChange(m);
  };
  return React.createElement("div", {
    className: "relative w-full"
  }, React.createElement("span", {
    className: `absolute left-3 top-3 font-bold ${disabled ? 'text-slate-300' : 'text-slate-400'}`
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
const Pagination = ({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
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
    className: "flex justify-center items-center gap-2 mt-6 py-2 select-none"
  }, React.createElement("button", {
    onClick: () => onPageChange(currentPage - 1),
    disabled: currentPage === 1,
    className: "p-2 rounded-lg hover:bg-slate-200 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent"
  }, React.createElement(ChevronLeft, {
    size: 20
  })), renderPageNumbers().map((page, index) => {
    if (page === '...') return React.createElement("span", {
      key: `ellipsis-${index}`,
      className: "w-8 h-8 flex items-center justify-center text-slate-400"
    }, React.createElement(MoreHorizontal, {
      size: 16
    }));
    return React.createElement("button", {
      key: page,
      onClick: () => onPageChange(page),
      className: `w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm transition-colors ${currentPage === page ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100'}`
    }, page);
  }), React.createElement("button", {
    onClick: () => onPageChange(currentPage + 1),
    disabled: currentPage === totalPages,
    className: "p-2 rounded-lg hover:bg-slate-200 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent"
  }, React.createElement(ChevronRight, {
    size: 20
  })));
};
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message
}) => {
  if (!isOpen) return null;
  return React.createElement("div", {
    className: "fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[90] backdrop-blur-sm"
  }, React.createElement("div", {
    className: "bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in text-center flex flex-col"
  }, React.createElement("div", {
    className: "mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 shrink-0"
  }, React.createElement(AlertTriangle, {
    className: "text-red-500"
  })), React.createElement("h3", {
    className: "text-lg font-bold text-slate-800 mb-2 shrink-0"
  }, title), React.createElement("p", {
    className: "text-slate-500 mb-6 shrink-0 text-sm"
  }, message), React.createElement("div", {
    className: "flex gap-3 shrink-0"
  }, React.createElement("button", {
    onClick: onClose,
    className: "flex-1 p-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
  }, "Voltar"), React.createElement("button", {
    onClick: onConfirm,
    className: "flex-1 p-3 text-white bg-red-500 hover:bg-red-600 font-bold rounded-xl shadow-lg shadow-red-200"
  }, "Sim, Excluir"))));
};

export { MoneyInput, Pagination, ConfirmModal };
