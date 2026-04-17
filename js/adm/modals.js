import {
  React, useState, useEffect, useMemo,
  Users, PlusCircle, Search, Edit2, Trash2, X, Tag, User, Phone, FileText, MapPin, Store, Lock, AlertTriangle, ChevronRight, ChevronLeft, MoreHorizontal, LayoutGrid, ArrowDownCircle, ArrowUpCircle, History, Info, LogOut, CheckCircle, Clock, Package,
  db, auth, APP_ID, ADMIN_EMAIL,
  collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged
} from '../core.js';

import { formatCurrency, parseMoney, maskMoney, maskPhone, maskCpfCnpj, maskCep, formatDateTime, getBrazilDateString, resolveSaleHistoryDate, resolveCanceledSaleHistoryDate } from './utils.js';
import { MoneyInput } from './ui.js';

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

export { StockMovementModal, ProductDetailsModal, ProductModal, CustomerFormModal };
