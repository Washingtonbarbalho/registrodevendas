import React, { useState, useEffect, useMemo, useRef } from 'https://esm.sh/react@18.2.0';
import { createRoot } from 'https://esm.sh/react-dom@18.2.0/client';
import {
  Users, ShoppingBag, PlusCircle, CheckCircle, MessageCircle, Trash2, ChevronDown, ChevronUp, Package, TrendingUp, Edit2, AlertTriangle, Wallet, Search, CreditCard, QrCode, Banknote, Calendar, Filter, X, PieChart, BarChart3, ArrowUpRight, ArrowDownRight, PackageMinus, LogOut, Lock, Mail, Phone, Store, UserCog, UserCheck, UserX, Shield, ChevronLeft, ChevronRight, MoreHorizontal, LayoutGrid, AlertCircle, RefreshCw, Clock, Bell, History, FileText, XCircle, User, Smartphone, Copy, Tag, Info, MapPin, BadgePercent, Receipt, Gift, Hash, Trophy, Check, Star, Award, Clock4, HeartHandshake, Home, ArrowDownCircle, ArrowUpCircle
} from 'https://esm.sh/lucide-react@0.292.0';
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getFirestore, collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import confetti from 'https://esm.sh/canvas-confetti@1.6.0';

const firebaseConfig = {
  apiKey: 'AIzaSyDQQcD2tzsVS8Xzy-GpHT897kB7EC-S8Ng',
  authDomain: 'vendas-aura.firebaseapp.com',
  projectId: 'vendas-aura',
  storageBucket: 'vendas-aura.firebasestorage.app',
  messagingSenderId: '767983700810',
  appId: '1:767983700810:web:947c8713bd23fb8a078fb3'
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const APP_ID = 'vendas-aura-main';
const ADMIN_EMAIL = 'washington.wn8@gmail.com';

export {
  React, useState, useEffect, useMemo, useRef, createRoot,
  Users, ShoppingBag, PlusCircle, CheckCircle, MessageCircle, Trash2, ChevronDown, ChevronUp, Package, TrendingUp, Edit2, AlertTriangle, Wallet, Search, CreditCard, QrCode, Banknote, Calendar, Filter, X, PieChart, BarChart3, ArrowUpRight, ArrowDownRight, PackageMinus, LogOut, Lock, Mail, Phone, Store, UserCog, UserCheck, UserX, Shield, ChevronLeft, ChevronRight, MoreHorizontal, LayoutGrid, AlertCircle, RefreshCw, Clock, Bell, History, FileText, XCircle, User, Smartphone, Copy, Tag, Info, MapPin, BadgePercent, Receipt, Gift, Hash, Trophy, Check, Star, Award, Clock4, HeartHandshake, Home, ArrowDownCircle, ArrowUpCircle,
  db, auth, APP_ID, ADMIN_EMAIL,
  collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  confetti
};
