import {
  React, useState, useEffect, useMemo, useRef,
  Gift, Hash, Users, Filter, Trophy, LogOut, Search, AlertTriangle, Lock, Mail, Store, ChevronRight, ChevronDown, CheckCircle, Banknote, CreditCard, QrCode, Clock, Check, Star, Award, MessageCircle, ChevronLeft, LayoutGrid, MoreHorizontal, X, BarChart3, TrendingUp, Package, Clock4, HeartHandshake, Calendar, Copy,
  db, auth, APP_ID,
  collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  confetti
} from '../core.js';

import { formatCurrency, parseMoney, maskMoney, formatDate, calculateDaysAgo, getCurrentMonthStart, getCurrentMonthEnd, getPointMessageText, getRewardMessageText, getVipMessageText, getMissYouMessageText, getFeedbackMessageText } from './utils.js';
import { WhatsAppChooserModal, DateRangeFilter, Pagination, MoneyInput, MultiSelectDropdown } from './ui.js';

const DashboardCRM = ({
  customers,
  sales,
  storeName,
  onOpenWA
}) => {
  const [dashPeriod, setDashPeriod] = useState('month');
  const [dashStartDate, setDashStartDate] = useState(getCurrentMonthStart());
  const [dashEndDate, setDashEndDate] = useState(getCurrentMonthEnd());
  useEffect(() => {
    if (dashPeriod === 'month') {
      setDashStartDate(getCurrentMonthStart());
      setDashEndDate(getCurrentMonthEnd());
    }
  }, [dashPeriod]);
  const stats = useMemo(() => {
    const periodSales = sales.filter(s => {
      const saleDate = s.saleDate.split('T')[0];
      return saleDate >= dashStartDate && saleDate <= dashEndDate;
    });
    let totalRevenue = 0;
    let activeCustomersSet = new Set();
    let productMap = {};
    let customerPeriodMap = {};
    customers.forEach(c => {
      customerPeriodMap[c.id] = {
        ...c,
        totalSpent: 0,
        purchaseCount: 0
      };
    });
    periodSales.forEach(s => {
      totalRevenue += s.totalPrice || 0;
      if (s.customerId) activeCustomersSet.add(s.customerId);
      if (customerPeriodMap[s.customerId]) {
        customerPeriodMap[s.customerId].totalSpent += s.totalPrice || 0;
        customerPeriodMap[s.customerId].purchaseCount += 1;
      }
      if (s.items && Array.isArray(s.items)) {
        s.items.forEach(item => {
          if (!item.productName) return;
          if (!productMap[item.productName]) {
            productMap[item.productName] = {
              name: item.productName,
              quantity: 0,
              revenue: 0
            };
          }
          productMap[item.productName].quantity += item.quantity || 1;
          productMap[item.productName].revenue += item.price || 0;
        });
      }
    });
    const totalSalesCount = periodSales.length;
    const averageTicket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;
    const topProducts = Object.values(productMap).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    const vipCustomers = Object.values(customerPeriodMap).filter(c => c.purchaseCount > 0).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);
    let customerGlobalMap = {};
    customers.forEach(c => {
      customerGlobalMap[c.id] = {
        ...c,
        lastPurchase: null,
        purchaseCount: 0
      };
    });
    sales.forEach(s => {
      if (customerGlobalMap[s.customerId]) {
        customerGlobalMap[s.customerId].purchaseCount += 1;
        if (!customerGlobalMap[s.customerId].lastPurchase || s.saleDate > customerGlobalMap[s.customerId].lastPurchase) {
          customerGlobalMap[s.customerId].lastPurchase = s.saleDate;
        }
      }
    });
    const allGlobalCustomers = Object.values(customerGlobalMap).filter(c => c.purchaseCount > 0);
    const recentCustomers = [...allGlobalCustomers].sort((a, b) => new Date(b.lastPurchase) - new Date(a.lastPurchase)).slice(0, 10);
    const idleCustomers = [...allGlobalCustomers].filter(c => calculateDaysAgo(c.lastPurchase) > 30).sort((a, b) => calculateDaysAgo(b.lastPurchase) - calculateDaysAgo(a.lastPurchase)).slice(0, 10);
    return {
      totalRevenue,
      totalSalesCount,
      averageTicket,
      activeCustomers: activeCustomersSet.size,
      topProducts,
      vipCustomers,
      recentCustomers,
      idleCustomers
    };
  }, [customers, sales, dashStartDate, dashEndDate]);
  return React.createElement("div", {
    className: "space-y-6 animate-fade-in"
  }, React.createElement(DateRangeFilter, {
    period: dashPeriod,
    startDate: dashStartDate,
    endDate: dashEndDate,
    onPeriodChange: setDashPeriod,
    onStartChange: setDashStartDate,
    onEndChange: setDashEndDate
  }), React.createElement("div", {
    className: "grid grid-cols-2 lg:grid-cols-4 gap-4"
  }, React.createElement("div", {
    className: "bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center"
  }, React.createElement("div", {
    className: "flex items-center gap-2 mb-2"
  }, React.createElement("div", {
    className: "p-2 bg-blue-50 text-blue-600 rounded-lg"
  }, React.createElement(TrendingUp, {
    size: 18
  })), React.createElement("p", {
    className: "text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider"
  }, "Fatura\xE7\xE3o do Per\xEDodo")), React.createElement("h3", {
    className: "text-xl sm:text-2xl font-black text-slate-800 truncate"
  }, formatCurrency(stats.totalRevenue))), React.createElement("div", {
    className: "bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center"
  }, React.createElement("div", {
    className: "flex items-center gap-2 mb-2"
  }, React.createElement("div", {
    className: "p-2 bg-emerald-50 text-emerald-600 rounded-lg"
  }, React.createElement(Banknote, {
    size: 18
  })), React.createElement("p", {
    className: "text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider"
  }, "Ticket M\xE9dio (Per\xEDodo)")), React.createElement("h3", {
    className: "text-xl sm:text-2xl font-black text-slate-800 truncate"
  }, formatCurrency(stats.averageTicket))), React.createElement("div", {
    className: "bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center"
  }, React.createElement("div", {
    className: "flex items-center gap-2 mb-2"
  }, React.createElement("div", {
    className: "p-2 bg-amber-50 text-amber-600 rounded-lg"
  }, React.createElement(Package, {
    size: 18
  })), React.createElement("p", {
    className: "text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider"
  }, "Vendas no Per\xEDodo")), React.createElement("h3", {
    className: "text-xl sm:text-2xl font-black text-slate-800"
  }, stats.totalSalesCount)), React.createElement("div", {
    className: "bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center"
  }, React.createElement("div", {
    className: "flex items-center gap-2 mb-2"
  }, React.createElement("div", {
    className: "p-2 bg-purple-50 text-purple-600 rounded-lg"
  }, React.createElement(Users, {
    size: 18
  })), React.createElement("p", {
    className: "text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider"
  }, "Clientes Ativos")), React.createElement("h3", {
    className: "text-xl sm:text-2xl font-black text-slate-800"
  }, stats.activeCustomers))), React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-3 gap-6"
  }, React.createElement("div", {
    className: "space-y-6 lg:col-span-1"
  }, React.createElement("div", {
    className: "bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
  }, React.createElement("div", {
    className: "p-4 border-b border-slate-50 bg-slate-50 flex items-center justify-between"
  }, React.createElement("div", {
    className: "flex items-center gap-2"
  }, React.createElement(Trophy, {
    size: 20,
    className: "text-yellow-500"
  }), React.createElement("h3", {
    className: "font-bold text-slate-800"
  }, "Top 5 Produtos"))), React.createElement("div", {
    className: "p-4 space-y-3"
  }, stats.topProducts.length === 0 ? React.createElement("p", {
    className: "text-sm text-slate-400"
  }, "Nenhum dado neste per\xEDodo.") : stats.topProducts.map((p, idx) => React.createElement("div", {
    key: idx,
    className: "flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100"
  }, React.createElement("div", {
    className: "flex items-center gap-3"
  }, React.createElement("span", {
    className: "text-xs font-black text-slate-400 w-4"
  }, idx + 1, "\xBA"), React.createElement("div", null, React.createElement("p", {
    className: "font-bold text-sm text-slate-700 line-clamp-1"
  }, p.name), React.createElement("p", {
    className: "text-xs text-slate-500"
  }, p.quantity, " vendidos"))), React.createElement("span", {
    className: "font-bold text-sm text-slate-800"
  }, formatCurrency(p.revenue)))))), React.createElement("div", {
    className: "bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
  }, React.createElement("div", {
    className: "p-4 border-b border-slate-50 bg-slate-900 flex items-center justify-between"
  }, React.createElement("div", {
    className: "flex items-center gap-2"
  }, React.createElement(Star, {
    size: 20,
    className: "text-yellow-500 fill-yellow-500"
  }), React.createElement("h3", {
    className: "font-bold text-white"
  }, "VIPs do Per\xEDodo (Top 10)"))), React.createElement("div", {
    className: "p-0"
  }, stats.vipCustomers.length === 0 ? React.createElement("p", {
    className: "p-4 text-sm text-slate-400"
  }, "Nenhum cliente com compras no per\xEDodo.") : stats.vipCustomers.map((c, idx) => React.createElement("div", {
    key: c.id,
    className: "flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors gap-3"
  }, React.createElement("div", {
    className: "flex items-center gap-3"
  }, React.createElement("span", {
    className: "min-w-[24px] h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-black"
  }, idx + 1), React.createElement("div", null, React.createElement("p", {
    className: "font-bold text-sm text-slate-800"
  }, c.name), React.createElement("p", {
    className: "text-xs text-slate-500"
  }, c.purchaseCount, " compras \u2022 ", formatCurrency(c.totalSpent)))), c.phone && React.createElement("button", {
    onClick: () => onOpenWA(c.phone, getVipMessageText(c.name, storeName)),
    className: "flex items-center justify-center gap-1 px-3 py-1.5 bg-green-500 text-white hover:bg-green-600 rounded-lg text-xs font-bold transition-colors w-full sm:w-auto"
  }, React.createElement(MessageCircle, {
    size: 14
  }), " Mimar")))))), React.createElement("div", {
    className: "space-y-6 lg:col-span-2"
  }, React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-6"
  }, React.createElement("div", {
    className: "bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col"
  }, React.createElement("div", {
    className: "p-4 border-b border-slate-50 bg-red-50 flex items-center justify-between"
  }, React.createElement("div", {
    className: "flex items-center gap-2"
  }, React.createElement(Clock4, {
    size: 20,
    className: "text-red-500"
  }), React.createElement("div", null, React.createElement("h3", {
    className: "font-bold text-red-900"
  }, "Ausentes (+30 dias)"), React.createElement("p", {
    className: "text-[10px] text-red-600"
  }, "Tempo real (Global)"))), React.createElement("span", {
    className: "text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold"
  }, stats.idleCustomers.length)), React.createElement("div", {
    className: "p-0 flex-1 overflow-y-auto max-h-[600px] hide-scrollbar"
  }, stats.idleCustomers.length === 0 ? React.createElement("p", {
    className: "p-4 text-sm text-slate-400"
  }, "Todos os clientes compraram recentemente!") : stats.idleCustomers.map(c => React.createElement("div", {
    key: c.id,
    className: "p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
  }, React.createElement("div", {
    className: "flex justify-between items-start mb-2"
  }, React.createElement("div", null, React.createElement("p", {
    className: "font-bold text-sm text-slate-800"
  }, c.name), React.createElement("p", {
    className: "text-xs text-red-500 font-medium"
  }, "Sem comprar h\xE1 ", calculateDaysAgo(c.lastPurchase), " dias"))), c.phone && React.createElement("button", {
    onClick: () => onOpenWA(c.phone, getMissYouMessageText(c.name, storeName)),
    className: "w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#25D366]/10 text-[#1DA851] hover:bg-[#25D366]/20 rounded-xl text-sm font-bold transition-colors"
  }, React.createElement(MessageCircle, {
    size: 16
  }), " Enviar Promo\xE7\xE3o"))))), React.createElement("div", {
    className: "bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col"
  }, React.createElement("div", {
    className: "p-4 border-b border-slate-50 bg-emerald-50 flex items-center justify-between"
  }, React.createElement("div", {
    className: "flex items-center gap-2"
  }, React.createElement(HeartHandshake, {
    size: 20,
    className: "text-emerald-500"
  }), React.createElement("div", null, React.createElement("h3", {
    className: "font-bold text-emerald-900"
  }, "\xDAltimas Compras"), React.createElement("p", {
    className: "text-[10px] text-emerald-700"
  }, "Tempo real (Global)")))), React.createElement("div", {
    className: "p-0 flex-1 overflow-y-auto max-h-[600px] hide-scrollbar"
  }, stats.recentCustomers.length === 0 ? React.createElement("p", {
    className: "p-4 text-sm text-slate-400"
  }, "Nenhuma compra registrada.") : stats.recentCustomers.map(c => React.createElement("div", {
    key: c.id,
    className: "p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
  }, React.createElement("div", {
    className: "flex justify-between items-start mb-2"
  }, React.createElement("div", null, React.createElement("p", {
    className: "font-bold text-sm text-slate-800"
  }, c.name), React.createElement("p", {
    className: "text-xs text-slate-500"
  }, "\xDAltima compra: ", formatDate(c.lastPurchase)))), c.phone && React.createElement("button", {
    onClick: () => onOpenWA(c.phone, getFeedbackMessageText(c.name, storeName)),
    className: "w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-sm font-bold transition-colors"
  }, React.createElement(MessageCircle, {
    size: 16
  }), " Pedir Feedback")))))))));
};
const LoyaltyProgram = ({
  customers,
  sales,
  storeName,
  onOpenWA
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 9;
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);
  const loyaltyData = useMemo(() => {
    const data = customers.map(customer => {
      const eligibleSales = sales.filter(s => s.customerId === customer.id && (s.saleType === 'direct' || s.saleType === 'prazo' && s.status === 'completed')).sort((a, b) => a.saleDate.localeCompare(b.saleDate));
      let currentCycle = [];
      let earnedRewards = [];
      eligibleSales.forEach(sale => {
        currentCycle.push(sale.totalPrice || 0);
        if (currentCycle.length === 7) {
          const totalAmount = currentCycle.reduce((acc, val) => acc + val, 0);
          earnedRewards.push({
            averageValue: totalAmount / 7,
            date: sale.saleDate
          });
          currentCycle = [];
        }
      });
      const currentPoints = currentCycle.length;
      const accumulatedValue = currentCycle.reduce((acc, val) => acc + val, 0);
      const currentAverage = currentPoints > 0 ? accumulatedValue / currentPoints : 0;
      return {
        ...customer,
        points: currentPoints,
        currentAverage,
        earnedRewards
      };
    });
    return data.sort((a, b) => {
      if (b.earnedRewards.length !== a.earnedRewards.length) {
        return b.earnedRewards.length - a.earnedRewards.length;
      }
      return b.points - a.points;
    });
  }, [customers, sales]);
  const filteredData = loyaltyData.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  return React.createElement("div", {
    className: "space-y-6 animate-fade-in"
  }, React.createElement("div", {
    className: "bg-white p-5 rounded-2xl shadow-sm border border-slate-100"
  }, React.createElement("div", {
    className: "flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5"
  }, React.createElement("div", null, React.createElement("h3", {
    className: "font-bold text-slate-800 flex items-center gap-2 text-xl mb-1"
  }, React.createElement(Star, {
    size: 24,
    className: "text-yellow-500 fill-yellow-500"
  }), " Plano Fidelidade"), React.createElement("p", {
    className: "text-sm text-slate-500 leading-relaxed"
  }, "Compras \xE0 vista ou ", React.createElement("b", null, "Fiado Quitado"), " valem ", React.createElement("b", null, "1 ponto"), ". ", React.createElement("br", {
    className: "hidden md:block"
  }), "Ao atingir ", React.createElement("b", null, "7 pontos"), ", o cliente ganha um cr\xE9dito da m\xE9dia dessas compras."))), React.createElement("div", {
    className: "relative"
  }, React.createElement(Search, {
    className: "absolute left-3 top-3.5 text-slate-400",
    size: 18
  }), React.createElement("input", {
    className: "w-full p-3.5 pl-10 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none transition-colors",
    placeholder: "Procurar cliente por nome...",
    value: searchTerm,
    onChange: e => setSearchTerm(e.target.value)
  }))), React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
  }, paginatedData.length === 0 ? React.createElement("div", {
    className: "col-span-full py-16 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300"
  }, React.createElement(Star, {
    size: 48,
    className: "mx-auto mb-3 text-slate-200"
  }), React.createElement("p", {
    className: "font-medium text-lg"
  }, "Nenhum cliente encontrado.")) : paginatedData.map(c => React.createElement("div", {
    key: c.id,
    className: "bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col transition-shadow hover:shadow-md"
  }, React.createElement("div", {
    className: "p-5 border-b border-slate-50"
  }, React.createElement("h4", {
    className: "font-bold text-slate-800 text-lg line-clamp-1"
  }, c.name), React.createElement("p", {
    className: "text-sm text-slate-500"
  }, c.phone || 'Sem contato')), React.createElement("div", {
    className: "p-5 flex-1 flex flex-col justify-center"
  }, React.createElement("div", {
    className: "flex justify-between items-end mb-3"
  }, React.createElement("span", {
    className: "text-xs font-bold text-slate-400 uppercase tracking-wider"
  }, "Pontos do Ciclo"), React.createElement("span", {
    className: "text-sm font-black text-slate-800 bg-yellow-100 px-2 py-1 rounded-lg"
  }, c.points, "/7")), React.createElement("div", {
    className: "flex gap-1.5 justify-between mb-5"
  }, [...Array(7)].map((_, i) => React.createElement("div", {
    key: i,
    className: `flex-1 aspect-square rounded-full flex items-center justify-center transition-all duration-300 ${i < c.points ? 'bg-yellow-400 shadow-sm scale-105' : 'bg-slate-100'}`
  }, React.createElement(Star, {
    size: 12,
    className: i < c.points ? 'text-yellow-800 fill-yellow-800' : 'text-slate-300'
  })))), c.points > 0 && React.createElement("div", {
    className: "bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center mb-4"
  }, React.createElement("p", {
    className: "text-xs font-medium text-slate-500"
  }, "M\xE9dia em acumula\xE7\xE3o:"), React.createElement("p", {
    className: "font-black text-slate-700"
  }, formatCurrency(c.currentAverage))), c.points === 0 && c.earnedRewards.length === 0 && React.createElement("p", {
    className: "text-sm text-center text-slate-400 py-2 italic mb-4"
  }, "Ainda n\xE3o iniciou o ciclo."), c.points > 0 && c.phone && React.createElement("button", {
    onClick: () => onOpenWA(c.phone, getPointMessageText(c.name, c.points, storeName)),
    className: "w-full flex items-center justify-center gap-2 py-2.5 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600 transition-colors shadow-sm mt-auto"
  }, React.createElement(MessageCircle, {
    size: 18
  }), " Avisar Ponto no Whats")), c.earnedRewards.length > 0 && React.createElement("div", {
    className: "bg-slate-900 p-5 text-yellow-400 mt-auto"
  }, React.createElement("div", {
    className: "flex items-center gap-2 mb-3"
  }, React.createElement(Award, {
    size: 20,
    className: "fill-yellow-400"
  }), React.createElement("span", {
    className: "font-black text-sm uppercase tracking-wide"
  }, "Cr\xE9ditos Dispon\xEDveis (", c.earnedRewards.length, ")")), React.createElement("div", {
    className: "space-y-2.5 max-h-40 overflow-y-auto hide-scrollbar pr-1"
  }, c.earnedRewards.map((reward, idx) => React.createElement("div", {
    key: idx,
    className: "bg-slate-800 p-3 rounded-xl flex justify-between items-center border border-slate-700 shadow-sm"
  }, React.createElement("div", null, React.createElement("p", {
    className: "text-xs font-bold text-slate-400 uppercase"
  }, "Gerado em"), React.createElement("p", {
    className: "text-sm font-semibold text-white"
  }, formatDate(reward.date))), React.createElement("div", {
    className: "flex items-center gap-3"
  }, React.createElement("span", {
    className: "font-black text-lg px-3 py-1 bg-yellow-500 text-slate-900 rounded-lg"
  }, formatCurrency(reward.averageValue)), c.phone && React.createElement("button", {
    onClick: () => onOpenWA(c.phone, getRewardMessageText(c.name, reward.averageValue, storeName)),
    className: "bg-green-500 text-white p-2.5 rounded-lg hover:bg-green-600 transition-colors shadow-sm",
    title: "Avisar sobre o Pr\xEAmio"
  }, React.createElement(MessageCircle, {
    size: 18
  })))))))))), React.createElement(Pagination, {
    totalItems: filteredData.length,
    itemsPerPage: ITEMS_PER_PAGE,
    currentPage: currentPage,
    onPageChange: setCurrentPage
  }));
};
const CustomerDraw = ({
  customers,
  sales
}) => {
  const [selectedMethods, setSelectedMethods] = useState([]);
  const [minSpent, setMinSpent] = useState('');
  const [minPurchases, setMinPurchases] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentName, setCurrentName] = useState('Pronto para sortear!');
  const [winner, setWinner] = useState(null);
  const paymentOptions = [{
    id: 'prazo',
    label: 'A Prazo'
  }, {
    id: 'pix',
    label: 'PIX'
  }, {
    id: 'credit',
    label: 'Crédito'
  }, {
    id: 'debit',
    label: 'Débito'
  }, {
    id: 'money',
    label: 'Dinheiro'
  }];
  const toggleMethod = methodId => {
    if (isDrawing) return;
    setSelectedMethods(prev => prev.includes(methodId) ? prev.filter(m => m !== methodId) : [...prev, methodId]);
  };
  const customerStats = useMemo(() => {
    const stats = {};
    customers.forEach(c => {
      stats[c.id] = {
        ...c,
        totalSpent: 0,
        purchaseCount: 0,
        methods: new Set()
      };
    });
    sales.forEach(s => {
      if (stats[s.customerId]) {
        stats[s.customerId].totalSpent += s.totalPrice || 0;
        stats[s.customerId].purchaseCount += 1;
        if (s.saleType === 'prazo') stats[s.customerId].methods.add('prazo');
        if (s.saleType === 'direct' && s.paymentMethod) stats[s.customerId].methods.add(s.paymentMethod);
      }
    });
    return stats;
  }, [customers, sales]);
  const eligibleCustomers = useMemo(() => {
    const minVal = parseMoney(minSpent);
    const minCount = parseInt(minPurchases) || 1;
    return Object.values(customerStats).filter(c => {
      if (c.purchaseCount < minCount) return false;
      if (minVal > 0 && c.totalSpent < minVal) return false;
      if (selectedMethods.length > 0) {
        const hasMatch = selectedMethods.some(method => c.methods.has(method));
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [customerStats, selectedMethods, minSpent, minPurchases]);
  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: {
          x: 0
        },
        colors: ['#fde047', '#eab308', '#1e293b']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: {
          x: 1
        },
        colors: ['#fde047', '#eab308', '#1e293b']
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  };
  const startDraw = () => {
    if (eligibleCustomers.length === 0) return;
    setIsDrawing(true);
    setWinner(null);
    let iterations = 0;
    const maxIterations = 30;
    const interval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * eligibleCustomers.length);
      setCurrentName(eligibleCustomers[randomIdx].name);
      iterations++;
      if (iterations >= maxIterations) {
        clearInterval(interval);
        const finalWinner = eligibleCustomers[Math.floor(Math.random() * eligibleCustomers.length)];
        setWinner(finalWinner);
        setCurrentName(finalWinner.name);
        setIsDrawing(false);
        triggerConfetti();
      }
    }, 100);
  };
  return React.createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in"
  }, React.createElement("div", {
    className: "lg:col-span-1 space-y-4"
  }, React.createElement("div", {
    className: "bg-white p-5 rounded-2xl shadow-sm border border-slate-100"
  }, React.createElement("h3", {
    className: "font-bold text-slate-800 flex items-center gap-2 mb-4 border-b pb-3"
  }, React.createElement(Filter, {
    size: 18,
    className: "text-yellow-500"
  }), " Filtros do Sorteio"), React.createElement("div", {
    className: "space-y-5"
  }, React.createElement("div", null, React.createElement("label", {
    className: "block text-xs font-bold text-slate-500 uppercase mb-2"
  }, "Formas de Pagamento"), React.createElement(MultiSelectDropdown, {
    options: paymentOptions,
    selected: selectedMethods,
    onChange: toggleMethod,
    placeholder: "Todas as Formas",
    disabled: isDrawing
  }), React.createElement("p", {
    className: "text-[10px] text-slate-400 mt-2 flex items-center gap-1"
  }, "* Vazio = Todos participam.")), React.createElement("div", null, React.createElement("label", {
    className: "block text-xs font-bold text-slate-500 uppercase mb-2"
  }, "Valor M\xEDnimo Gasto"), React.createElement(MoneyInput, {
    value: minSpent,
    onChange: setMinSpent,
    disabled: isDrawing,
    className: "w-full p-3 pl-10 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-yellow-500 outline-none disabled:opacity-60"
  })), React.createElement("div", null, React.createElement("label", {
    className: "block text-xs font-bold text-slate-500 uppercase mb-2"
  }, "M\xEDnimo de Compras"), React.createElement("input", {
    type: "number",
    min: "1",
    value: minPurchases,
    onChange: e => setMinPurchases(e.target.value),
    className: "w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-yellow-500 outline-none font-bold disabled:opacity-60",
    disabled: isDrawing
  })))), React.createElement("div", {
    className: "bg-slate-900 p-4 rounded-2xl border border-slate-800"
  }, React.createElement("div", {
    className: "flex justify-between items-center"
  }, React.createElement("span", {
    className: "text-sm font-bold text-yellow-400"
  }, "Participantes Eleg\xEDveis:"), React.createElement("span", {
    className: "text-2xl font-black text-slate-900 bg-yellow-500 px-3 py-1 rounded-lg shadow-sm"
  }, eligibleCustomers.length)))), React.createElement("div", {
    className: "lg:col-span-2"
  }, React.createElement("div", {
    className: "bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col items-center justify-center text-center min-h-[400px]"
  }, React.createElement("div", {
    className: "w-full max-w-lg mb-8"
  }, React.createElement("div", {
    className: `slot-machine border-4 ${winner ? 'border-yellow-400' : isDrawing ? 'border-slate-400' : 'border-slate-200'} rounded-3xl p-8 mb-6 relative overflow-hidden transition-colors duration-300`
  }, React.createElement("h2", {
    className: `text-3xl md:text-4xl font-black uppercase tracking-wider truncate px-4 ${winner ? 'text-yellow-600 scale-110' : 'text-slate-700'} transition-transform duration-300`
  }, currentName), winner && React.createElement("div", {
    className: "absolute -top-3 -right-3"
  }, React.createElement("span", {
    className: "bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full shadow-md rotate-12 inline-block"
  }, "VENCEDOR!"))), winner && React.createElement("div", {
    className: "bg-slate-50 p-4 rounded-xl border border-slate-200 text-left animate-fade-in space-y-2 mb-6"
  }, React.createElement("p", {
    className: "text-xs font-bold text-slate-400 uppercase"
  }, "Estat\xEDsticas do Ganhador"), React.createElement("div", {
    className: "grid grid-cols-2 gap-4"
  }, React.createElement("div", null, React.createElement("p", {
    className: "text-xs text-slate-500"
  }, "Total Gasto"), React.createElement("p", {
    className: "font-bold text-slate-800"
  }, formatCurrency(winner.totalSpent))), React.createElement("div", null, React.createElement("p", {
    className: "text-xs text-slate-500"
  }, "Compras"), React.createElement("p", {
    className: "font-bold text-slate-700"
  }, winner.purchaseCount, " pedidos"))))), React.createElement("button", {
    onClick: startDraw,
    disabled: isDrawing || eligibleCustomers.length === 0,
    className: `w-full max-w-sm py-4 rounded-2xl font-black text-lg tracking-wide uppercase transition-all shadow-xl 
                                    ${isDrawing || eligibleCustomers.length === 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-yellow-500 text-slate-900 hover:bg-yellow-400 hover:scale-105 active:scale-95 shadow-yellow-200'}`
  }, isDrawing ? 'Sorteando...' : 'Sortear Agora!'), eligibleCustomers.length === 0 && React.createElement("p", {
    className: "text-red-500 text-sm mt-4 font-medium flex items-center gap-1"
  }, React.createElement(AlertTriangle, {
    size: 16
  }), " Nenhum cliente atende aos filtros."))));
};
const NumericDraw = () => {
  const [minNum, setMinNum] = useState(1);
  const [maxNum, setMaxNum] = useState(100);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentNumber, setCurrentNumber] = useState('-');
  const [winner, setWinner] = useState(null);
  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: {
        y: 0.6
      },
      colors: ['#fde047', '#eab308']
    });
  };
  const startDraw = () => {
    const min = parseInt(minNum);
    const max = parseInt(maxNum);
    if (isNaN(min) || isNaN(max) || min >= max) {
      alert("O valor máximo deve ser maior que o mínimo.");
      return;
    }
    setIsDrawing(true);
    setWinner(null);
    let iterations = 0;
    const maxIterations = 25;
    const interval = setInterval(() => {
      const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
      setCurrentNumber(randomNum);
      iterations++;
      if (iterations >= maxIterations) {
        clearInterval(interval);
        const finalWinner = Math.floor(Math.random() * (max - min + 1)) + min;
        setWinner(finalWinner);
        setCurrentNumber(finalWinner);
        setIsDrawing(false);
        triggerConfetti();
      }
    }, 100);
  };
  return React.createElement("div", {
    className: "max-w-3xl mx-auto animate-fade-in"
  }, React.createElement("div", {
    className: "bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col items-center justify-center text-center"
  }, React.createElement("div", {
    className: "flex gap-4 w-full max-w-md mb-8"
  }, React.createElement("div", {
    className: "flex-1"
  }, React.createElement("label", {
    className: "block text-xs font-bold text-slate-500 uppercase mb-2"
  }, "M\xEDnimo"), React.createElement("input", {
    type: "number",
    value: minNum,
    onChange: e => setMinNum(e.target.value),
    className: "w-full p-4 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-yellow-500 outline-none text-center font-bold text-xl",
    disabled: isDrawing
  })), React.createElement("div", {
    className: "flex-1"
  }, React.createElement("label", {
    className: "block text-xs font-bold text-slate-500 uppercase mb-2"
  }, "M\xE1ximo"), React.createElement("input", {
    type: "number",
    value: maxNum,
    onChange: e => setMaxNum(e.target.value),
    className: "w-full p-4 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-yellow-500 outline-none text-center font-bold text-xl",
    disabled: isDrawing
  }))), React.createElement("div", {
    className: "w-full max-w-md mb-8"
  }, React.createElement("div", {
    className: `slot-machine border-4 ${winner ? 'border-yellow-400 bg-yellow-50' : isDrawing ? 'border-slate-400' : 'border-slate-200'} rounded-full aspect-square flex items-center justify-center mb-6 relative overflow-hidden transition-colors duration-300 w-64 h-64 mx-auto shadow-inner`
  }, React.createElement("h2", {
    className: `text-6xl md:text-8xl font-black ${winner ? 'text-yellow-600 scale-110' : 'text-slate-700'} transition-transform duration-300`
  }, currentNumber))), React.createElement("button", {
    onClick: startDraw,
    disabled: isDrawing,
    className: `w-full max-w-sm py-4 rounded-2xl font-black text-lg tracking-wide uppercase transition-all shadow-xl 
                                ${isDrawing ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-yellow-500 text-slate-900 hover:bg-yellow-400 hover:scale-105 active:scale-95 shadow-yellow-200'}`
  }, isDrawing ? 'Sorteando...' : 'Sortear Número')));
};

export { DashboardCRM, LoyaltyProgram, CustomerDraw, NumericDraw };
