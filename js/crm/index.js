import {
  React, useState, useEffect, useMemo, useRef,
  Gift, Hash, Users, Filter, Trophy, LogOut, Search, AlertTriangle, Lock, Mail, Store, ChevronRight, ChevronDown, CheckCircle, Banknote, CreditCard, QrCode, Clock, Check, Star, Award, MessageCircle, ChevronLeft, LayoutGrid, MoreHorizontal, X, BarChart3, TrendingUp, Package, Clock4, HeartHandshake, Calendar, Copy,
  db, auth, APP_ID,
  collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  confetti
} from '../core.js';

import { AuthScreen } from './auth.js';
import { WhatsAppChooserModal } from './ui.js';
import { DashboardCRM, LoyaltyProgram, CustomerDraw, NumericDraw } from './features.js';

const App = () => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [waModal, setWaModal] = useState({
    open: false,
    phone: '',
    message: ''
  });
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async currentUser => {
      if (currentUser) {
        try {
          const profileRef = doc(db, 'artifacts', APP_ID, 'users', currentUser.uid, 'profile', 'info');
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            const data = profileSnap.data();
            if (data.approved) {
              setUserProfile(data);
              setUser(currentUser);
            } else {
              setAccessDenied(true);
              await signOut(auth);
            }
          } else {
            await signOut(auth);
          }
        } catch (e) {
          console.error(e);
          await signOut(auth);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    if (!user) return;
    const customersRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'customers');
    const salesRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'sales');
    const unsubC = onSnapshot(query(customersRef), s => setCustomers(s.docs.map(d => ({
      id: d.id,
      ...d.data()
    }))));
    const unsubS = onSnapshot(query(salesRef), s => {
      setSales(s.docs.map(d => ({
        id: d.id,
        ...d.data()
      })));
      setLoadingData(false);
    });
    return () => {
      unsubC();
      unsubS();
    };
  }, [user]);
  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };
  const handleOpenWA = (phone, message) => {
    setWaModal({
      open: true,
      phone,
      message
    });
  };
  if (loadingAuth) return React.createElement("div", {
    className: "min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-bold"
  }, "A verificar acesso...");
  if (accessDenied) return React.createElement("div", {
    className: "min-h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center"
  }, React.createElement(Lock, {
    size: 48,
    className: "text-red-500 mb-4"
  }), React.createElement("h1", {
    className: "text-2xl font-bold text-red-800 mb-2"
  }, "Acesso Negado"), React.createElement("p", {
    className: "text-red-600 mb-6"
  }, "Cadastro pendente de aprova\xE7\xE3o no sistema principal."), React.createElement("button", {
    onClick: () => window.location.reload(),
    className: "px-6 py-3 bg-red-600 text-white font-bold rounded-xl"
  }, "Voltar"));
  if (!user) return React.createElement(AuthScreen, null);
  return React.createElement("div", {
    className: "min-h-screen bg-slate-50 pb-24 font-sans text-slate-800 flex flex-col"
  }, React.createElement("header", {
    className: "bg-slate-900 text-white p-4 lg:p-6 rounded-b-3xl shadow-lg sticky top-0 z-40 w-full mb-6"
  }, React.createElement("div", {
    className: "max-w-7xl mx-auto"
  }, React.createElement("div", {
    className: "flex justify-between items-center mb-4"
  }, React.createElement("div", null, React.createElement("h1", {
    className: "text-xl lg:text-2xl font-bold bg-gradient-to-r from-yellow-200 to-yellow-500 bg-clip-text text-transparent"
  }, userProfile?.storeName || "CRM Aura"), React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "P\xF3s-Venda, Sorteios e Indicadores")), React.createElement("div", {
    className: "flex gap-2"
  }, React.createElement("button", {
    onClick: handleLogout,
    className: "bg-slate-800 p-2 rounded-full text-red-400 border border-slate-700 hover:bg-slate-700",
    title: "Sair"
  }, React.createElement(LogOut, {
    size: 20
  })))), React.createElement("div", {
    className: "flex space-x-1 overflow-x-auto no-scrollbar justify-start lg:justify-center"
  }, React.createElement("button", {
    onClick: () => setActiveTab('dashboard'),
    className: `pb-2 px-3 lg:px-6 whitespace-nowrap font-medium text-sm lg:text-base transition-colors flex items-center gap-2 ${activeTab === 'dashboard' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-slate-400 hover:text-white'}`
  }, React.createElement(BarChart3, {
    size: 18,
    className: "hidden sm:block"
  }), " Indicadores"), React.createElement("button", {
    onClick: () => setActiveTab('loyalty'),
    className: `pb-2 px-3 lg:px-6 whitespace-nowrap font-medium text-sm lg:text-base transition-colors flex items-center gap-2 ${activeTab === 'loyalty' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-slate-400 hover:text-white'}`
  }, React.createElement(Star, {
    size: 18,
    className: activeTab === 'loyalty' ? "hidden sm:block" : "hidden"
  }), " Fidelidade"), React.createElement("button", {
    onClick: () => setActiveTab('customers'),
    className: `pb-2 px-3 lg:px-6 whitespace-nowrap font-medium text-sm lg:text-base transition-colors flex items-center gap-2 ${activeTab === 'customers' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-slate-400 hover:text-white'}`
  }, React.createElement(Users, {
    size: 18,
    className: "hidden sm:block"
  }), " Sorteio Clientes"), React.createElement("button", {
    onClick: () => setActiveTab('numeric'),
    className: `pb-2 px-3 lg:px-6 whitespace-nowrap font-medium text-sm lg:text-base transition-colors flex items-center gap-2 ${activeTab === 'numeric' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-slate-400 hover:text-white'}`
  }, React.createElement(Hash, {
    size: 18,
    className: "hidden sm:block"
  }), " Sorteio Num\xE9rico")))), React.createElement("main", {
    className: "flex-1 p-4 max-w-7xl mx-auto w-full"
  }, loadingData ? React.createElement("div", {
    className: "flex flex-col items-center justify-center py-20 text-slate-400"
  }, React.createElement("div", {
    className: "animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500 mb-4"
  }), React.createElement("p", {
    className: "font-bold"
  }, "A carregar dados...")) : React.createElement(React.Fragment, null, activeTab === 'dashboard' && React.createElement(DashboardCRM, {
    customers: customers,
    sales: sales,
    storeName: userProfile?.storeName || 'Nossa Loja',
    onOpenWA: handleOpenWA
  }), activeTab === 'customers' && React.createElement(CustomerDraw, {
    customers: customers,
    sales: sales
  }), activeTab === 'numeric' && React.createElement(NumericDraw, null), activeTab === 'loyalty' && React.createElement(LoyaltyProgram, {
    customers: customers,
    sales: sales,
    storeName: userProfile?.storeName || 'Nossa Loja',
    onOpenWA: handleOpenWA
  }))), React.createElement(WhatsAppChooserModal, {
    isOpen: waModal.open,
    phone: waModal.phone,
    message: waModal.message,
    onClose: () => setWaModal({
      open: false,
      phone: '',
      message: ''
    })
  }));
};

export default App;
