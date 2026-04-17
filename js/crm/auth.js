import {
  React, useState, useEffect, useMemo, useRef,
  Gift, Hash, Users, Filter, Trophy, LogOut, Search, AlertTriangle, Lock, Mail, Store, ChevronRight, ChevronDown, CheckCircle, Banknote, CreditCard, QrCode, Clock, Check, Star, Award, MessageCircle, ChevronLeft, LayoutGrid, MoreHorizontal, X, BarChart3, TrendingUp, Package, Clock4, HeartHandshake, Calendar, Copy,
  db, auth, APP_ID,
  collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  confetti
} from '../core.js';


const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleLogin = async e => {
    e.preventDefault();
    if (!email || !password) return setError("Preencha e-mail e senha.");
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
  }, React.createElement(Trophy, {
    className: "text-yellow-400",
    size: 32
  })), React.createElement("h1", {
    className: "text-2xl font-bold text-slate-800"
  }, "Acesso ao CRM"), React.createElement("p", {
    className: "text-slate-400 text-sm"
  }, "Fidelidade, Indicadores e Sorteios")), error && React.createElement("div", {
    className: "bg-red-50 text-red-500 p-3 rounded-xl text-sm mb-4 flex items-center gap-2"
  }, React.createElement(AlertTriangle, {
    size: 16
  }), error), React.createElement("form", {
    onSubmit: handleLogin,
    className: "space-y-4"
  }, React.createElement("div", null, React.createElement("label", {
    className: "block text-xs font-bold text-slate-500 uppercase mb-1 ml-1"
  }, "E-mail"), React.createElement("div", {
    className: "relative"
  }, React.createElement(Mail, {
    className: "absolute left-3 top-3 text-slate-400",
    size: 20
  }), React.createElement("input", {
    type: "email",
    autoFocus: true,
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
    type: "submit",
    disabled: loading,
    className: "w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg disabled:opacity-50 mt-2"
  }, loading ? "Entrando..." : "Entrar no Sistema"))));
};

export { AuthScreen };
