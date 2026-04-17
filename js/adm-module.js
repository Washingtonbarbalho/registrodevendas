import {
  React, useState, useEffect, useMemo,
  Users, PlusCircle, Search, Edit2, Trash2, X, Tag, User, Phone, FileText, MapPin, Store, Lock, AlertTriangle, ChevronRight, ChevronLeft, MoreHorizontal, LayoutGrid, ArrowDownCircle, ArrowUpCircle, History, Info, LogOut, CheckCircle, Clock,
  db, auth, APP_ID, ADMIN_EMAIL,
  collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged
} from './core.js';

const AdmAuraModule = (() => {
const formatCurrency = val => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
}).format(val || 0);
const parseMoney = valStr => {
  if (!valStr) return 0;
  if (typeof valStr === 'number') return valStr;
  const clean = valStr.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
};
const maskMoney = value => {
  if (value === undefined || value === null) return "0,00";
  let v = String(value).replace(/\D/g, "");
  v = (v / 100).toFixed(2) + "";
  v = v.replace(".", ",");
  v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
  return v;
};
const maskPhone = v => {
  v = v.replace(/\D/g, "");
  v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
  v = v.replace(/(\d)(\d{4})$/, "$1-$2");
  return v;
};
const maskCpfCnpj = v => {
  v = v.replace(/\D/g, "");
  if (v.length <= 11) {
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    v = v.replace(/^(\d{2})(\d)/, "$1.$2");
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
    v = v.replace(/(\d{4})(\d)/, "$1-$2");
  }
  return v;
};
const maskCep = v => {
  v = v.replace(/\D/g, "");
  v = v.replace(/^(\d{5})(\d)/, "$1-$2");
  return v.slice(0, 9);
};
const formatDateTime = dateStr => {
  if (!dateStr) return '--/--/---- --:--';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
};
const getBrazilDateString = () => {
  const date = new Date();
  return date.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Sao_Paulo'
  }).split('/').reverse().join('-');
};
const toDateFromFirestoreValue = value => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const resolveSaleHistoryDate = sale => {
  const createdAtDate = toDateFromFirestoreValue(sale?.createdAt);
  if (createdAtDate) return createdAtDate.toISOString();
  if (sale?.saleDate) return `${sale.saleDate}T12:00:00`;
  return new Date().toISOString();
};
const resolveCanceledSaleHistoryDate = sale => {
  const canceledAtDate = toDateFromFirestoreValue(sale?.canceledAt);
  if (canceledAtDate) return canceledAtDate.toISOString();
  if (sale?.saleDate) return `${sale.saleDate}T12:00:01`;
  return new Date().toISOString();
};

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
const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleLogin = async () => {
    if (!email || !password) return setError("Preencha todos os campos.");
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      setError("Usuário ou senha incorretos.");
      setLoading(false);
    }
  };
  return React.createElement("div", {
    className: "min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-yellow-400 to-yellow-600"
  }, React.createElement("div", {
    className: "bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md animate-fade-in"
  }, React.createElement("div", {
    className: "text-center mb-8"
  }, React.createElement("div", {
    className: "w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4"
  }, React.createElement(Package, {
    className: "text-yellow-400",
    size: 32
  })), React.createElement("h1", {
    className: "text-2xl font-bold text-slate-800"
  }, "Gestor de Cadastros"), React.createElement("p", {
    className: "text-slate-400 text-sm"
  }, "Acesse com sua conta do sistema")), error && React.createElement("div", {
    className: "bg-red-50 text-red-500 p-3 rounded-xl text-sm mb-4 flex items-center gap-2"
  }, React.createElement(AlertTriangle, {
    size: 16
  }), error), React.createElement("div", {
    className: "space-y-4"
  }, React.createElement("div", null, React.createElement("label", {
    className: "block text-xs font-bold text-slate-500 uppercase mb-1 ml-1"
  }, "E-mail"), React.createElement("div", {
    className: "relative"
  }, React.createElement(User, {
    className: "absolute left-3 top-3 text-slate-400",
    size: 20
  }), React.createElement("input", {
    type: "email",
    className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none",
    placeholder: "seu@email.com",
    value: email,
    onChange: e => setEmail(e.target.value)
  }))), React.createElement("div", null, React.createElement("label", {
    className: "block text-xs font-bold text-slate-500 uppercase mb-1 ml-1"
  }, "Senha"), React.createElement("div", {
    className: "relative"
  }, React.createElement(Lock, {
    className: "absolute left-3 top-3 text-slate-400",
    size: 20
  }), React.createElement("input", {
    type: "password",
    className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    value: password,
    onChange: e => setPassword(e.target.value)
  }))), React.createElement("button", {
    onClick: handleLogin,
    disabled: loading,
    className: "w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg transition-colors disabled:opacity-50 mt-2"
  }, loading ? "Entrando..." : "Acessar Sistema"))));
};
const StockMovementModal = ({
  isOpen,
  onClose,
  product,
  onSave
}) => {
  const [type, setType] = useState('compra');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (isOpen && product) {
      setType('compra');
      setQuantity('');
      setNotes('');
      setUnitCost(maskMoney((product.costPrice * 100).toFixed(0)));
    }
  }, [isOpen, product]);
  const handleSubmit = () => {
    const qtyVal = parseInt(quantity) || 0;
    if (qtyVal <= 0) return alert("Insira uma quantidade válida maior que zero.");
    const costVal = parseMoney(unitCost);
    if (type === 'compra' && costVal <= 0) return alert("Para compras, insira o valor unitário pago na mercadoria.");
    onSave(product.id, {
      type,
      quantity: qtyVal,
      unitCost: costVal,
      notes
    });
  };
  const isEntry = ['compra', 'ajuste_entrada', 'devolucao'].includes(type);
  if (!isOpen || !product) return null;
  return React.createElement("div", {
    className: "fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[80] backdrop-blur-sm"
  }, React.createElement("div", {
    className: "bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in flex flex-col"
  }, React.createElement("div", {
    className: "p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl"
  }, React.createElement("h3", {
    className: "font-bold text-lg text-slate-800 flex items-center gap-2"
  }, React.createElement(ArrowUpCircle, {
    className: "text-yellow-600",
    size: 20
  }), " Movimentar Estoque"), React.createElement("button", {
    onClick: onClose,
    className: "p-2 hover:bg-slate-200 rounded-full"
  }, React.createElement(X, {
    size: 20
  }))), React.createElement("div", {
    className: "p-5 space-y-4"
  }, React.createElement("div", {
    className: "bg-slate-100 p-3 rounded-xl border border-slate-200 flex justify-between items-center"
  }, React.createElement("div", null, React.createElement("p", {
    className: "text-xs font-bold text-slate-500 uppercase line-clamp-1"
  }, product.name), React.createElement("p", {
    className: "text-[10px] text-slate-400 font-mono"
  }, "C\xF3d: #", product.code)), React.createElement("div", {
    className: "text-right"
  }, React.createElement("p", {
    className: "text-[10px] text-slate-400 uppercase font-bold"
  }, "Estoque Atual"), React.createElement("p", {
    className: "font-bold text-slate-800"
  }, product.quantity, " un."))), React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "Tipo de Movimenta\xE7\xE3o *"), React.createElement("select", {
    className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 bg-white",
    value: type,
    onChange: e => setType(e.target.value)
  }, React.createElement("optgroup", {
    label: "Entradas (Soma Estoque)"
  }, React.createElement("option", {
    value: "compra"
  }, "Compra de Mercadoria"), React.createElement("option", {
    value: "ajuste_entrada"
  }, "Ajuste de Entrada (+)"), React.createElement("option", {
    value: "devolucao"
  }, "Devolu\xE7\xE3o de Cliente")), React.createElement("optgroup", {
    label: "Sa\xEDdas (Subtrai Estoque)"
  }, React.createElement("option", {
    value: "ajuste_saida"
  }, "Ajuste de Sa\xEDda (-)"), React.createElement("option", {
    value: "avaria"
  }, "Avaria / Perda / Vencido")))), React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "Qtd *"), React.createElement("input", {
    type: "number",
    min: "1",
    className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 text-center font-bold",
    value: quantity,
    onChange: e => setQuantity(e.target.value),
    placeholder: "0"
  })), React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "Custo Unit\xE1rio (R$)"), React.createElement(MoneyInput, {
    value: unitCost,
    onChange: setUnitCost,
    disabled: !isEntry,
    className: `w-full p-3 pl-8 border border-slate-200 rounded-lg outline-none font-bold text-sm ${isEntry ? 'focus:ring-2 focus:ring-yellow-500 bg-white' : 'bg-slate-100 text-slate-400'}`
  }))), type === 'compra' && React.createElement("div", {
    className: "bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-[10px] text-yellow-800 leading-tight"
  }, React.createElement("span", {
    className: "font-bold block mb-1"
  }, "C\xE1lculo de Custo M\xE9dio Ativo!"), "Ao registrar uma compra, o sistema unir\xE1 o valor atual do estoque com o valor desta nova compra e calcular\xE1 automaticamente o novo custo base do produto."), React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "Observa\xE7\xF5es (Opcional)"), React.createElement("input", {
    type: "text",
    className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 text-sm",
    value: notes,
    onChange: e => setNotes(e.target.value),
    placeholder: "NFe, motivo..."
  }))), React.createElement("div", {
    className: "p-4 border-t border-slate-100 flex gap-3 bg-white rounded-b-2xl"
  }, React.createElement("button", {
    onClick: onClose,
    className: "flex-1 p-3 text-slate-500 font-bold bg-slate-100 rounded-xl hover:bg-slate-200"
  }, "Cancelar"), React.createElement("button", {
    onClick: handleSubmit,
    className: `flex-1 p-3 text-white font-bold rounded-xl shadow-lg ${isEntry ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' : 'bg-red-500 hover:bg-red-600 shadow-red-200'}`
  }, "Confirmar ", isEntry ? 'Entrada' : 'Saída'))));
};
const ProductDetailsModal = ({
  isOpen,
  onClose,
  product,
  salesHistory,
  onEdit,
  onMovementRequest,
  onDeleteRequest
}) => {
  const [tab, setTab] = useState('info');
  const combinedHistory = useMemo(() => {
    let history = [];
    if (!product) return history;
    if (product.movements && Array.isArray(product.movements)) {
      product.movements.forEach(m => {
        history.push({
          id: m.id,
          date: m.date,
          type: m.type,
          qty: m.quantity,
          isEntry: ['compra', 'ajuste_entrada', 'devolucao'].includes(m.type),
          totalValue: m.quantity * (m.unitCost || 0),
          notes: m.notes
        });
      });
    }
    if (salesHistory && Array.isArray(salesHistory)) {
      salesHistory.forEach(sale => {
        const itemMatch = sale.items?.find(i => i.productId === product.id);
        if (itemMatch) {
          const salePriceItem = itemMatch.price !== undefined ? itemMatch.price : product.salePrice;
          history.push({
            id: `sale-${sale.id}`,
            date: resolveSaleHistoryDate(sale),
            type: 'venda',
            qty: itemMatch.quantity,
            isEntry: false,
            totalValue: itemMatch.quantity * salePriceItem,
            notes: `Venda p/ ${sale.customerName?.split(' ')[0]}`
          });
          if (sale.status === 'canceled') {
            history.push({
              id: `cancel-${sale.id}`,
              date: resolveCanceledSaleHistoryDate(sale),
              type: 'cancelamento',
              qty: itemMatch.quantity,
              isEntry: true,
              totalValue: itemMatch.quantity * salePriceItem,
              notes: `Venda Cancelada`
            });
          }
        }
      });
    }
    return history.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [product, salesHistory]);
  if (!isOpen || !product) return null;
  const isPromoActive = product.isPromo && getBrazilDateString() >= product.promoStart && getBrazilDateString() <= product.promoEnd;
  return React.createElement("div", {
    className: "fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60] backdrop-blur-sm"
  }, React.createElement("div", {
    className: "bg-white rounded-2xl w-full max-w-md max-h-[95vh] flex flex-col shadow-2xl animate-fade-in"
  }, React.createElement("div", {
    className: "p-5 border-b border-slate-100 flex justify-between items-start bg-slate-900 text-white rounded-t-2xl shrink-0"
  }, React.createElement("div", null, React.createElement("span", {
    className: "text-[10px] font-mono bg-slate-800 text-yellow-400 px-2 py-0.5 rounded"
  }, "C\xD3D: #", product.code), React.createElement("h3", {
    className: "text-xl font-bold mt-2 leading-tight"
  }, product.name)), React.createElement("button", {
    onClick: onClose,
    className: "p-2 hover:bg-slate-800 rounded-full text-slate-300 transition-colors"
  }, React.createElement(X, {
    size: 20
  }))), React.createElement("div", {
    className: "flex border-b border-slate-100 shrink-0 bg-slate-50"
  }, React.createElement("button", {
    onClick: () => setTab('info'),
    className: `flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${tab === 'info' ? 'border-yellow-500 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`
  }, "Detalhes"), React.createElement("button", {
    onClick: () => setTab('history'),
    className: `flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${tab === 'history' ? 'border-yellow-500 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`
  }, "Hist\xF3rico")), React.createElement("div", {
    className: "flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar"
  }, tab === 'info' && React.createElement("div", {
    className: "space-y-4 animate-fade-in"
  }, React.createElement("div", {
    className: "grid grid-cols-2 gap-4"
  }, React.createElement("div", {
    className: "bg-slate-50 p-4 rounded-xl border border-slate-100"
  }, React.createElement("p", {
    className: "text-[10px] uppercase font-bold text-slate-400 mb-1"
  }, "Custo M\xE9dio"), React.createElement("p", {
    className: "font-bold text-slate-800 text-lg"
  }, formatCurrency(product.costPrice))), React.createElement("div", {
    className: "bg-slate-50 p-4 rounded-xl border border-slate-100"
  }, React.createElement("p", {
    className: "text-[10px] uppercase font-bold text-slate-400 mb-1"
  }, "Estoque"), React.createElement("p", {
    className: `font-bold text-lg ${product.quantity <= 0 ? 'text-red-500' : 'text-slate-800'}`
  }, product.quantity, " un."))), React.createElement("div", {
    className: "bg-white p-4 rounded-xl border border-slate-200 shadow-sm"
  }, React.createElement("div", {
    className: "flex justify-between items-center mb-2"
  }, React.createElement("p", {
    className: "text-[10px] uppercase font-bold text-slate-400"
  }, "Pre\xE7o de Venda"), isPromoActive && React.createElement("span", {
    className: "bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
  }, "Promo\xE7\xE3o Ativa")), isPromoActive ? React.createElement("div", {
    className: "flex items-end gap-3"
  }, React.createElement("p", {
    className: "text-sm font-bold text-slate-400 line-through"
  }, formatCurrency(product.salePrice)), React.createElement("p", {
    className: "text-2xl font-bold text-purple-600"
  }, formatCurrency(product.promoPrice))) : React.createElement("p", {
    className: "text-2xl font-bold text-slate-800"
  }, formatCurrency(product.salePrice))), product.description && React.createElement("div", {
    className: "bg-slate-50 p-4 rounded-xl border border-slate-100"
  }, React.createElement("p", {
    className: "text-[10px] uppercase font-bold text-slate-400 mb-1"
  }, "Descri\xE7\xE3o"), React.createElement("p", {
    className: "text-sm text-slate-600 whitespace-pre-wrap"
  }, product.description)), React.createElement("div", {
    className: "grid grid-cols-2 gap-3 pt-2"
  }, React.createElement("button", {
    onClick: () => onMovementRequest(product),
    className: "p-3 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors"
  }, React.createElement(ArrowUpCircle, {
    size: 18
  }), " Movimentar"), React.createElement("button", {
    onClick: () => onEdit(product),
    className: "p-3 bg-slate-100 text-slate-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
  }, React.createElement(Edit2, {
    size: 18
  }), " Editar Info"))), tab === 'history' && React.createElement("div", {
    className: "space-y-3 animate-fade-in relative"
  }, combinedHistory.length === 0 ? React.createElement("p", {
    className: "text-center text-slate-400 py-10 italic text-sm"
  }, "Nenhuma movimenta\xE7\xE3o registrada.") : combinedHistory.map((h, i) => React.createElement("div", {
    key: i,
    className: "bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3"
  }, React.createElement("div", {
    className: `p-2 rounded-lg shrink-0 ${h.isEntry ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`
  }, h.isEntry ? React.createElement(ArrowUpCircle, {
    size: 20
  }) : React.createElement(ArrowDownCircle, {
    size: 20
  })), React.createElement("div", {
    className: "flex-1"
  }, React.createElement("div", {
    className: "flex justify-between items-start"
  }, React.createElement("p", {
    className: "text-xs font-bold text-slate-800 uppercase leading-tight"
  }, h.type.replace('_', ' ')), React.createElement("div", {
    className: "text-right"
  }, React.createElement("p", {
    className: `font-bold text-sm ${h.isEntry ? 'text-emerald-600' : 'text-red-500'}`
  }, h.isEntry ? '+' : '-', h.qty, " un."))), React.createElement("div", {
    className: "flex justify-between items-center mt-1"
  }, React.createElement("p", {
    className: "text-[10px] text-slate-400"
  }, formatDateTime(h.date)), h.totalValue > 0 && React.createElement("p", {
    className: "text-xs font-bold text-slate-600"
  }, formatCurrency(h.totalValue))), h.notes && React.createElement("p", {
    className: "text-[10px] text-slate-500 mt-1 italic"
  }, "\"", h.notes, "\"")))))), React.createElement("div", {
    className: "p-4 border-t border-slate-100 bg-white rounded-b-2xl shrink-0 flex flex-col gap-2"
  }, React.createElement("button", {
    onClick: () => onDeleteRequest('product', product.id),
    className: "w-full py-3 text-red-400 hover:text-red-600 text-sm font-bold bg-white hover:bg-red-50 rounded-xl transition-colors border border-transparent flex items-center justify-center gap-2"
  }, React.createElement(Trash2, {
    size: 16
  }), " Excluir Produto Permanentemente"))));
};
const ProductModal = ({
  isOpen,
  onClose,
  onSave,
  lastCode,
  initialData
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [isPromo, setIsPromo] = useState(false);
  const [promoPrice, setPromoPrice] = useState('');
  const [promoStart, setPromoStart] = useState('');
  const [promoEnd, setPromoEnd] = useState('');
  useEffect(() => {
    if (initialData && isOpen) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setSalePrice(initialData.salePrice || 0);
      setCostPrice(initialData.costPrice || 0);
      setIsPromo(initialData.isPromo || false);
      setPromoPrice(initialData.promoPrice || 0);
      setPromoStart(initialData.promoStart || '');
      setPromoEnd(initialData.promoEnd || '');
    } else if (isOpen) {
      setName('');
      setDescription('');
      setSalePrice('');
      setCostPrice('');
      setIsPromo(false);
      setPromoPrice('');
      setPromoStart('');
      setPromoEnd('');
    }
  }, [initialData, isOpen]);
  const nextCode = useMemo(() => {
    if (initialData) return initialData.code;
    if (!lastCode) return '000001';
    return String(parseInt(lastCode, 10) + 1).padStart(6, '0');
  }, [lastCode, initialData]);
  if (!isOpen) return null;
  const numCost = typeof costPrice === 'number' ? costPrice : parseMoney(costPrice);
  const numSale = parseMoney(salePrice);
  const profit = numSale - numCost;
  const margin = numSale > 0 ? profit / numSale * 100 : 0;
  const handleSubmit = () => {
    if (!name || numSale <= 0) return alert("Nome e Preço de Venda são obrigatórios.");
    const dataToSave = {
      code: nextCode,
      name: name.toUpperCase(),
      description,
      salePrice: numSale,
      costPrice: numCost,
      isPromo,
      promoPrice: isPromo ? parseMoney(promoPrice) : 0,
      promoStart: isPromo ? promoStart : null,
      promoEnd: isPromo ? promoEnd : null
    };
    if (!initialData) {
      dataToSave.quantity = 0;
      dataToSave.movements = [];
    }
    onSave(dataToSave);
  };
  return React.createElement("div", {
    className: "fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[70] backdrop-blur-sm"
  }, React.createElement("div", {
    className: "bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in flex flex-col max-h-[95vh]"
  }, React.createElement("div", {
    className: "p-6 border-b border-slate-100 flex justify-between items-center shrink-0"
  }, React.createElement("div", null, React.createElement("h3", {
    className: "text-xl font-bold text-slate-800 flex items-center gap-2"
  }, React.createElement(Package, {
    className: "text-yellow-500"
  }), " ", initialData ? 'Editar Produto' : 'Novo Produto'), React.createElement("p", {
    className: "text-sm text-slate-400 font-mono mt-1"
  }, "C\xD3D: #", nextCode)), React.createElement("button", {
    onClick: onClose,
    className: "p-2 bg-slate-100 rounded-full hover:bg-slate-200"
  }, React.createElement(X, {
    size: 20
  }))), React.createElement("div", {
    className: "p-6 overflow-y-auto flex-1 space-y-4 no-scrollbar"
  }, !initialData && React.createElement("div", {
    className: "bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-start gap-2"
  }, React.createElement(Info, {
    className: "text-blue-500 shrink-0 mt-0.5",
    size: 16
  }), React.createElement("p", {
    className: "text-xs text-blue-700"
  }, "O produto ser\xE1 criado com ", React.createElement("b", null, "estoque zero"), ". Ap\xF3s salvar, use a op\xE7\xE3o \"Movimentar Estoque\" para dar entrada e registrar as quantidades.")), React.createElement("div", {
    className: "bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3"
  }, React.createElement("p", {
    className: "text-xs font-bold text-slate-400 uppercase"
  }, "Dados B\xE1sicos"), React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "Nome do Produto *"), React.createElement("input", {
    className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 uppercase",
    value: name,
    onChange: e => setName(e.target.value.toUpperCase())
  })), React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "Descri\xE7\xE3o (Opcional)"), React.createElement("textarea", {
    className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 text-sm",
    rows: "2",
    value: description,
    onChange: e => setDescription(e.target.value)
  }))), React.createElement("div", {
    className: "bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-sm"
  }, React.createElement("p", {
    className: "text-xs font-bold text-slate-400 uppercase"
  }, "Precifica\xE7\xE3o e Lucro"), React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "Custo M\xE9dio Base"), React.createElement(MoneyInput, {
    value: costPrice,
    onChange: setCostPrice,
    className: "w-full p-3 pl-10 border border-slate-200 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none font-bold text-slate-800"
  })), React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "Pre\xE7o de Venda *"), React.createElement(MoneyInput, {
    value: salePrice,
    onChange: setSalePrice,
    className: "w-full p-3 pl-10 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none font-bold text-slate-800"
  }))), React.createElement("div", {
    className: "flex gap-4 pt-2 border-t border-slate-100"
  }, React.createElement("div", {
    className: "flex-1"
  }, React.createElement("span", {
    className: "text-[10px] text-slate-400 uppercase font-bold block"
  }, "Lucro Estimado (R$)"), React.createElement("span", {
    className: `font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`
  }, formatCurrency(profit))), React.createElement("div", {
    className: "flex-1"
  }, React.createElement("span", {
    className: "text-[10px] text-slate-400 uppercase font-bold block"
  }, "Margem (%)"), React.createElement("span", {
    className: `font-bold ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`
  }, margin.toFixed(2), "%")))), React.createElement("div", {
    className: `p-4 rounded-xl border transition-colors ${isPromo ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-200'}`
  }, React.createElement("div", {
    className: "flex justify-between items-center cursor-pointer",
    onClick: () => setIsPromo(!isPromo)
  }, React.createElement("p", {
    className: `text-xs font-bold uppercase flex items-center gap-2 ${isPromo ? 'text-purple-700' : 'text-slate-400'}`
  }, React.createElement(Tag, {
    size: 14
  }), " Ativar Pre\xE7o Promocional"), React.createElement("div", {
    className: `w-10 h-6 rounded-full p-1 transition-colors ${isPromo ? 'bg-purple-500' : 'bg-slate-300'}`
  }, React.createElement("div", {
    className: `bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${isPromo ? 'translate-x-4' : 'translate-x-0'}`
  }))), isPromo && React.createElement("div", {
    className: "mt-4 space-y-3 animate-fade-in"
  }, React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-purple-600 uppercase mb-1"
  }, "Pre\xE7o na Promo\xE7\xE3o"), React.createElement(MoneyInput, {
    value: promoPrice,
    onChange: setPromoPrice,
    className: "w-full p-3 pl-10 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-purple-900 font-bold"
  })), React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-purple-600 uppercase mb-1"
  }, "In\xEDcio da Promo"), React.createElement("input", {
    type: "date",
    className: "w-full p-2 border border-purple-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-purple-500",
    value: promoStart,
    onChange: e => setPromoStart(e.target.value)
  })), React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-purple-600 uppercase mb-1"
  }, "Fim da Promo"), React.createElement("input", {
    type: "date",
    className: "w-full p-2 border border-purple-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-purple-500",
    value: promoEnd,
    onChange: e => setPromoEnd(e.target.value)
  })))))), React.createElement("div", {
    className: "p-6 border-t border-slate-100 flex gap-3 shrink-0 bg-white rounded-b-2xl"
  }, React.createElement("button", {
    onClick: onClose,
    className: "flex-1 p-3 text-slate-500 font-bold bg-slate-100 rounded-xl hover:bg-slate-200"
  }, "Cancelar"), React.createElement("button", {
    onClick: handleSubmit,
    className: "flex-1 p-3 bg-slate-900 text-yellow-400 font-bold rounded-xl hover:bg-slate-800 shadow-lg"
  }, "Salvar Cadastro"))));
};
const CustomerFormModal = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [documentData, setDocumentData] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [reference, setReference] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [cityState, setCityState] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);
  useEffect(() => {
    if (initialData && isOpen) {
      setName(initialData.name || '');
      setPhone(initialData.phone || '');
      setDocumentData(initialData.document || '');
      setBirthDate(initialData.birthDate || '');
      setCep(initialData.cep || '');
      setStreet(initialData.street || '');
      setNumber(initialData.number || '');
      setComplement(initialData.complement || '');
      setReference(initialData.reference || '');
      setNeighborhood(initialData.neighborhood || '');
      setCityState(initialData.cityState || '');
    } else if (isOpen) {
      setName('');
      setPhone('');
      setDocumentData('');
      setBirthDate('');
      setCep('');
      setStreet('');
      setNumber('');
      setComplement('');
      setReference('');
      setNeighborhood('');
      setCityState('');
    }
  }, [initialData, isOpen]);
  if (!isOpen) return null;
  const handleCepBlur = async () => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      setLoadingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setStreet(data.logradouro || '');
          setNeighborhood(data.bairro || '');
          setCityState(`${data.localidade || ''}/${data.uf || ''}`);
        }
      } catch (e) {
        console.error(e);
      }
      setLoadingCep(false);
    }
  };
  const handleSubmit = () => {
    if (!name) return alert("O Nome Completo é obrigatório.");
    onSave({
      name: name.toUpperCase(),
      phone,
      document: documentData,
      birthDate,
      cep,
      street: street.toUpperCase(),
      number,
      complement,
      reference,
      neighborhood: neighborhood.toUpperCase(),
      cityState: cityState.toUpperCase()
    });
  };
  return React.createElement("div", {
    className: "fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[70] backdrop-blur-sm"
  }, React.createElement("div", {
    className: "bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in flex flex-col max-h-[95vh]"
  }, React.createElement("div", {
    className: "p-6 border-b border-slate-100 flex justify-between items-center shrink-0"
  }, React.createElement("h3", {
    className: "text-xl font-bold text-slate-800 flex items-center gap-2"
  }, React.createElement(User, {
    className: "text-yellow-500"
  }), " ", initialData ? 'Editar Cliente' : 'Novo Cliente'), React.createElement("button", {
    onClick: onClose,
    className: "p-2 bg-slate-100 rounded-full hover:bg-slate-200"
  }, React.createElement(X, {
    size: 20
  }))), React.createElement("div", {
    className: "p-6 overflow-y-auto flex-1 space-y-4 no-scrollbar"
  }, React.createElement("div", {
    className: "bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3"
  }, React.createElement("p", {
    className: "text-xs font-bold text-slate-400 uppercase"
  }, "Dados Pessoais"), React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "Nome Completo *"), React.createElement("input", {
    className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 uppercase",
    value: name,
    onChange: e => setName(e.target.value.toUpperCase())
  })), React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "WhatsApp"), React.createElement("input", {
    type: "tel",
    className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500",
    value: phone,
    onChange: e => setPhone(maskPhone(e.target.value)),
    placeholder: "(00) 00000-0000"
  })), React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "CPF / CNPJ"), React.createElement("input", {
    type: "text",
    className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500",
    value: documentData,
    onChange: e => setDocumentData(maskCpfCnpj(e.target.value)),
    placeholder: "000.000.000-00"
  }))), React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "Data de Nascimento"), React.createElement("input", {
    type: "date",
    className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 text-sm",
    value: birthDate,
    onChange: e => setBirthDate(e.target.value)
  }))), React.createElement("div", {
    className: "bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-sm"
  }, React.createElement("p", {
    className: "text-xs font-bold text-slate-400 uppercase"
  }, "Endere\xE7o"), React.createElement("div", {
    className: "grid grid-cols-2 gap-3 items-end"
  }, React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "CEP"), React.createElement("input", {
    type: "text",
    className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500",
    value: cep,
    onChange: e => setCep(maskCep(e.target.value)),
    onBlur: handleCepBlur,
    placeholder: "00000-000"
  })), React.createElement("div", {
    className: "pb-3"
  }, loadingCep && React.createElement("span", {
    className: "text-xs text-yellow-600 font-bold animate-pulse"
  }, "Buscando..."))), React.createElement("div", {
    className: "grid grid-cols-4 gap-3"
  }, React.createElement("div", {
    className: "col-span-3"
  }, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "Rua / Logradouro"), React.createElement("input", {
    type: "text",
    className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 uppercase",
    value: street,
    onChange: e => setStreet(e.target.value.toUpperCase())
  })), React.createElement("div", {
    className: "col-span-1"
  }, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "N\xBA"), React.createElement("input", {
    type: "text",
    className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 uppercase",
    value: number,
    onChange: e => setNumber(e.target.value)
  }))), React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "Bairro"), React.createElement("input", {
    type: "text",
    className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 uppercase",
    value: neighborhood,
    onChange: e => setNeighborhood(e.target.value.toUpperCase())
  })), React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "Cidade/UF"), React.createElement("input", {
    type: "text",
    className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 uppercase",
    value: cityState,
    onChange: e => setCityState(e.target.value.toUpperCase())
  }))), React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "Complemento"), React.createElement("input", {
    type: "text",
    className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500",
    value: complement,
    onChange: e => setComplement(e.target.value)
  })), React.createElement("div", null, React.createElement("label", {
    className: "block text-[10px] font-bold text-slate-500 uppercase mb-1"
  }, "Ponto de Refer\xEAncia"), React.createElement("input", {
    type: "text",
    className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500",
    value: reference,
    onChange: e => setReference(e.target.value)
  })))), React.createElement("div", {
    className: "p-6 border-t border-slate-100 flex gap-3 shrink-0 bg-white rounded-b-2xl"
  }, React.createElement("button", {
    onClick: onClose,
    className: "flex-1 p-3 text-slate-500 font-bold bg-slate-100 rounded-xl hover:bg-slate-200"
  }, "Cancelar"), React.createElement("button", {
    onClick: handleSubmit,
    className: "flex-1 p-3 bg-slate-900 text-yellow-400 font-bold rounded-xl hover:bg-slate-800 shadow-lg"
  }, "Salvar Cliente"))));
};
const CatalogApp = ({
  user,
  userProfile,
  onLogout
}) => {
  const [view, setView] = useState('products');
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);
  const ITEMS_PER_PAGE = 12;
  const [productModalData, setProductModalData] = useState({
    open: false,
    data: null
  });
  const [customerModalData, setCustomerModalData] = useState({
    open: false,
    data: null
  });
  const [productDetailsData, setProductDetailsData] = useState({
    open: false,
    data: null
  });
  const [stockMovementData, setStockMovementData] = useState({
    open: false,
    data: null
  });
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    type: null,
    id: null
  });
  useEffect(() => {
    const qP = query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'products'));
    const unsubP = onSnapshot(qP, s => setProducts(s.docs.map(d => ({
      id: d.id,
      ...d.data()
    }))));
    const qC = query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'customers'));
    const unsubC = onSnapshot(qC, s => setCustomers(s.docs.map(d => ({
      id: d.id,
      ...d.data()
    }))));
    const qS = query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'sales'));
    const unsubS = onSnapshot(qS, s => setSales(s.docs.map(d => ({
      id: d.id,
      ...d.data()
    }))));
    return () => {
      unsubP();
      unsubC();
      unsubS();
    };
  }, [user.uid]);
  useEffect(() => setProductPage(1), [productSearch]);
  useEffect(() => setCustomerPage(1), [customerSearch]);
  const filteredProducts = useMemo(() => {
    let list = [...products].sort((a, b) => a.code.localeCompare(b.code));
    if (productSearch) list = list.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.includes(productSearch));
    return list;
  }, [products, productSearch]);
  const filteredCustomers = useMemo(() => {
    let list = [...customers].sort((a, b) => a.name.localeCompare(b.name));
    if (customerSearch) list = list.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.document && c.document.includes(customerSearch));
    return list;
  }, [customers, customerSearch]);
  const paginatedProducts = filteredProducts.slice((productPage - 1) * ITEMS_PER_PAGE, productPage * ITEMS_PER_PAGE);
  const paginatedCustomers = filteredCustomers.slice((customerPage - 1) * ITEMS_PER_PAGE, customerPage * ITEMS_PER_PAGE);
  const handleSaveProduct = async data => {
    if (productModalData.data) await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'products', productModalData.data.id), data);else await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'products'), {
      ...data,
      createdAt: serverTimestamp()
    });
    setProductModalData({
      open: false,
      data: null
    });
    if (productDetailsData.open && productModalData.data) {
      const updatedProduct = {
        ...productModalData.data,
        ...data
      };
      setProductDetailsData({
        open: true,
        data: updatedProduct
      });
    }
  };
  const handleStockMovement = async (productId, movementInfo) => {
    const productRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'products', productId);
    const p = products.find(prod => prod.id === productId);
    if (!p) return;
    const currentQty = parseInt(p.quantity) || 0;
    const currentCost = parseFloat(p.costPrice) || 0;
    const movQty = parseInt(movementInfo.quantity) || 0;
    const movCost = parseFloat(movementInfo.unitCost) || 0;
    const movType = movementInfo.type;
    let newQty = currentQty;
    let newCost = currentCost;
    let isEntry = ['compra', 'ajuste_entrada', 'devolucao'].includes(movType);
    if (isEntry) {
      newQty = currentQty + movQty;
      if (movType === 'compra' && movQty > 0) {
        const totalCurrentValue = currentQty * currentCost;
        const totalAddedValue = movQty * movCost;
        newCost = (totalCurrentValue + totalAddedValue) / newQty;
      }
    } else {
      newQty = currentQty - movQty;
    }
    const newMovement = {
      id: Date.now().toString(),
      type: movType,
      quantity: movQty,
      unitCost: isEntry && movType === 'compra' ? movCost : 0,
      date: new Date().toISOString(),
      previousQty: currentQty,
      newQty: newQty,
      notes: movementInfo.notes || ''
    };
    const updatedMovements = p.movements ? [...p.movements, newMovement] : [newMovement];
    await updateDoc(productRef, {
      quantity: newQty,
      costPrice: newCost,
      movements: updatedMovements
    });
    setStockMovementData({
      open: false,
      data: null
    });
    setProductDetailsData({
      open: true,
      data: {
        ...p,
        quantity: newQty,
        costPrice: newCost,
        movements: updatedMovements
      }
    });
  };
  const handleSaveCustomer = async data => {
    if (customerModalData.data) await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'customers', customerModalData.data.id), data);else await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'customers'), {
      ...data,
      createdAt: serverTimestamp()
    });
    setCustomerModalData({
      open: false,
      data: null
    });
  };
  const confirmDelete = async () => {
    const {
      type,
      id
    } = deleteModal;
    const col = type === 'customer' ? 'customers' : 'products';
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, col, id));
    setDeleteModal({
      open: false,
      type: null,
      id: null
    });
    if (type === 'product' && productDetailsData.data?.id === id) {
      setProductDetailsData({
        open: false,
        data: null
      });
    }
  };
  const requestDelete = (type, id) => {
    setDeleteModal({
      open: true,
      type,
      id
    });
  };
  return React.createElement("div", {
    className: "min-h-screen bg-slate-50 pb-20 font-sans text-slate-800"
  }, React.createElement("header", {
    className: "bg-slate-900 text-white p-4 lg:p-6 rounded-b-3xl shadow-lg sticky top-0 z-40 w-full"
  }, React.createElement("div", {
    className: "max-w-7xl mx-auto"
  }, React.createElement("div", {
    className: "flex justify-between items-center mb-4"
  }, React.createElement("div", {
    className: "flex items-center gap-3"
  }, React.createElement("div", {
    className: "bg-yellow-500 p-2 rounded-xl shadow-lg shadow-yellow-500/20"
  }, React.createElement(LayoutGrid, {
    className: "text-slate-900",
    size: 24
  })), React.createElement("div", null, React.createElement("h1", {
    className: "text-xl lg:text-2xl font-bold bg-gradient-to-r from-yellow-200 to-yellow-500 bg-clip-text text-transparent"
  }, "Gestor Integrado"), React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "Ambiente de Cadastros"))), React.createElement("div", {
    className: "flex items-center gap-2"
  }, React.createElement("button", {
    onClick: onLogout,
    className: "bg-slate-800 p-2 rounded-full text-red-400 border border-slate-700 hover:bg-slate-700 transition-colors"
  }, React.createElement(LogOut, {
    size: 20
  })), React.createElement("button", {
    onClick: () => view === 'products' ? setProductModalData({
      open: true,
      data: null
    }) : setCustomerModalData({
      open: true,
      data: null
    }),
    className: "bg-yellow-500 hover:bg-yellow-400 text-slate-900 p-2 rounded-full shadow-lg transition-transform active:scale-95 ml-2"
  }, React.createElement(PlusCircle, {
    size: 20
  })))), React.createElement("div", {
    className: "flex space-x-1 overflow-x-auto no-scrollbar justify-start lg:justify-center"
  }, React.createElement("button", {
    onClick: () => setView('products'),
    className: `pb-2 px-3 lg:px-6 whitespace-nowrap font-medium text-sm lg:text-base transition-colors ${view === 'products' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-slate-400 hover:text-white'}`
  }, "Cat\xE1logo"), React.createElement("button", {
    onClick: () => setView('customers'),
    className: `pb-2 px-3 lg:px-6 whitespace-nowrap font-medium text-sm lg:text-base transition-colors ${view === 'customers' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-slate-400 hover:text-white'}`
  }, "Clientes")))), React.createElement("main", {
    className: "max-w-7xl mx-auto p-4 mt-2 space-y-4"
  }, view === 'products' && React.createElement("div", {
    className: "animate-fade-in"
  }, React.createElement("div", {
    className: "flex gap-2 mb-4"
  }, React.createElement("div", {
    className: "relative flex-1"
  }, React.createElement(Search, {
    size: 18,
    className: "absolute left-3 top-3.5 text-slate-400"
  }), React.createElement("input", {
    className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none shadow-sm",
    placeholder: "Buscar produto...",
    value: productSearch,
    onChange: e => setProductSearch(e.target.value.toUpperCase())
  }))), React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
  }, paginatedProducts.map(p => {
    const isPromoActive = p.isPromo && getBrazilDateString() >= p.promoStart && getBrazilDateString() <= p.promoEnd;
    return React.createElement("div", {
      key: p.id,
      onClick: () => setProductDetailsData({
        open: true,
        data: p
      }),
      className: "bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:border-yellow-300 transition-all cursor-pointer"
    }, React.createElement("div", {
      className: "p-4 flex-1"
    }, React.createElement("div", {
      className: "flex justify-between items-start mb-2"
    }, React.createElement("span", {
      className: "text-xs font-mono bg-slate-100 text-slate-500 px-2 py-1 rounded"
    }, "#", p.code), isPromoActive && React.createElement("span", {
      className: "bg-purple-100 text-purple-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase flex items-center gap-1"
    }, React.createElement(Tag, {
      size: 10
    }), " Promo")), React.createElement("h3", {
      className: "font-bold text-slate-800 leading-tight mb-1"
    }, p.name), React.createElement("div", {
      className: "flex justify-between items-end mt-4"
    }, React.createElement("div", null, React.createElement("p", {
      className: "text-[10px] text-slate-400 uppercase font-bold"
    }, "Venda"), isPromoActive ? React.createElement("div", {
      className: "flex flex-col"
    }, React.createElement("span", {
      className: "text-xs text-slate-400 line-through"
    }, formatCurrency(p.salePrice)), React.createElement("span", {
      className: "text-lg font-bold text-purple-600"
    }, formatCurrency(p.promoPrice))) : React.createElement("span", {
      className: "text-lg font-bold text-slate-800"
    }, formatCurrency(p.salePrice))), React.createElement("div", {
      className: "text-right"
    }, React.createElement("p", {
      className: "text-[10px] text-slate-400 uppercase font-bold"
    }, "Estoque"), React.createElement("span", {
      className: `font-bold ${p.quantity <= 0 ? 'text-red-500' : 'text-slate-700'}`
    }, p.quantity, " un.")))));
  }), filteredProducts.length === 0 && React.createElement("p", {
    className: "col-span-full text-center text-slate-400 py-10"
  }, "Nenhum produto encontrado.")), React.createElement(Pagination, {
    totalItems: filteredProducts.length,
    itemsPerPage: ITEMS_PER_PAGE,
    currentPage: productPage,
    onPageChange: setProductPage
  })), view === 'customers' && React.createElement("div", {
    className: "animate-fade-in"
  }, React.createElement("div", {
    className: "flex gap-2 mb-4"
  }, React.createElement("div", {
    className: "relative flex-1"
  }, React.createElement(Search, {
    size: 18,
    className: "absolute left-3 top-3.5 text-slate-400"
  }), React.createElement("input", {
    className: "w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none shadow-sm",
    placeholder: "Buscar cliente ou documento...",
    value: customerSearch,
    onChange: e => setCustomerSearch(e.target.value.toUpperCase())
  }))), React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
  }, paginatedCustomers.map(c => React.createElement("div", {
    key: c.id,
    className: "bg-white p-4 rounded-xl border border-slate-100 flex flex-col shadow-sm hover:shadow-md transition-shadow"
  }, React.createElement("div", {
    className: "flex-1"
  }, React.createElement("h3", {
    className: "font-bold text-slate-800 mb-1"
  }, c.name), React.createElement("div", {
    className: "space-y-1 mt-2 text-sm text-slate-600"
  }, c.phone && React.createElement("p", {
    className: "flex items-center gap-2"
  }, React.createElement(Phone, {
    size: 14,
    className: "text-slate-400"
  }), " ", c.phone), c.document && React.createElement("p", {
    className: "flex items-center gap-2"
  }, React.createElement(FileText, {
    size: 14,
    className: "text-slate-400"
  }), " ", c.document), c.cityState && React.createElement("p", {
    className: "flex items-center gap-2"
  }, React.createElement(MapPin, {
    size: 14,
    className: "text-slate-400"
  }), " ", c.cityState))), React.createElement("div", {
    className: "flex gap-2 mt-4 pt-3 border-t border-slate-100"
  }, React.createElement("button", {
    onClick: () => setCustomerModalData({
      open: true,
      data: c
    }),
    className: "flex-1 text-slate-400 hover:text-yellow-600 p-2 flex justify-center items-center rounded-lg hover:bg-slate-50 transition-colors"
  }, React.createElement(Edit2, {
    size: 18
  })), React.createElement("button", {
    onClick: () => requestDelete('customer', c.id),
    className: "flex-1 text-slate-400 hover:text-red-500 p-2 flex justify-center items-center rounded-lg hover:bg-red-50 transition-colors"
  }, React.createElement(Trash2, {
    size: 18
  }))))), filteredCustomers.length === 0 && React.createElement("p", {
    className: "col-span-full text-center text-slate-400 py-10"
  }, "Nenhum cliente encontrado.")), React.createElement(Pagination, {
    totalItems: filteredCustomers.length,
    itemsPerPage: ITEMS_PER_PAGE,
    currentPage: customerPage,
    onPageChange: setCustomerPage
  }))), React.createElement(ProductModal, {
    isOpen: productModalData.open,
    onClose: () => setProductModalData({
      open: false,
      data: null
    }),
    onSave: handleSaveProduct,
    initialData: productModalData.data,
    lastCode: products.length > 0 ? String(products.reduce((max, p) => Math.max(max, parseInt(p.code || '0', 10) || 0), 0)).padStart(6, '0') : null
  }), React.createElement(ProductDetailsModal, {
    isOpen: productDetailsData.open,
    onClose: () => setProductDetailsData({
      open: false,
      data: null
    }),
    product: productDetailsData.data,
    salesHistory: sales,
    onEdit: p => setProductModalData({
      open: true,
      data: p
    }),
    onMovementRequest: p => setStockMovementData({
      open: true,
      data: p
    }),
    onDeleteRequest: requestDelete
  }), React.createElement(StockMovementModal, {
    isOpen: stockMovementData.open,
    onClose: () => setStockMovementData({
      open: false,
      data: null
    }),
    product: stockMovementData.data,
    onSave: handleStockMovement
  }), React.createElement(CustomerFormModal, {
    isOpen: customerModalData.open,
    onClose: () => setCustomerModalData({
      open: false,
      data: null
    }),
    onSave: handleSaveCustomer,
    initialData: customerModalData.data
  }), React.createElement(ConfirmModal, {
    isOpen: deleteModal.open,
    title: "Excluir Permanentemente?",
    message: "O registro ser\xE1 apagado do sistema sem possibilidade de recupera\xE7\xE3o.",
    onClose: () => setDeleteModal({
      open: false,
      type: null,
      id: null
    }),
    onConfirm: confirmDelete
  }));
};
const App = () => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (u) {
        const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', u.uid, 'profile', 'info'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.approved) {
            setUser(u);
            setUserProfile(data);
          } else {
            setAccessDenied(true);
            await signOut(auth);
          }
        } else {
          await signOut(auth);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);
  if (loading) return React.createElement("div", {
    className: "min-h-screen flex items-center justify-center bg-slate-50"
  }, "Carregando Sistema...");
  if (accessDenied) return React.createElement("div", {
    className: "min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center"
  }, React.createElement(Lock, {
    size: 48,
    className: "text-red-500 mb-4"
  }), React.createElement("h1", {
    className: "text-2xl font-bold text-red-800 mb-2"
  }, "Acesso Negado"), React.createElement("p", {
    className: "text-red-600 mb-6"
  }, "Seu cadastro n\xE3o possui aprova\xE7\xE3o para acessar este m\xF3dulo."), React.createElement("button", {
    onClick: () => {
      setAccessDenied(false);
      window.location.reload();
    },
    className: "px-6 py-3 bg-red-600 text-white font-bold rounded-xl"
  }, "Voltar"));
  if (!user) return React.createElement(AuthScreen, null);
  return React.createElement(CatalogApp, {
    user: user,
    userProfile: userProfile,
    onLogout: () => signOut(auth)
  });
};
return App;
})();

export default AdmAuraModule;
