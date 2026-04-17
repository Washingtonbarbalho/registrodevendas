import {
  React, useState, useEffect, useMemo,
  Users, PlusCircle, Search, Edit2, Trash2, X, Tag, User, Phone, FileText, MapPin, Store, Lock, AlertTriangle, ChevronRight, ChevronLeft, MoreHorizontal, LayoutGrid, ArrowDownCircle, ArrowUpCircle, History, Info, LogOut, CheckCircle, Clock, Package,
  db, auth, APP_ID, ADMIN_EMAIL,
  collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged
} from '../core.js';

import { AuthScreen } from './auth.js';
import { CatalogApp } from './catalog.js';

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

export default App;
