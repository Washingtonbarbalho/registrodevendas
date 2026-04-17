import {
  React, useState, useEffect, useMemo,
  Users, PlusCircle, Search, Edit2, Trash2, X, Tag, User, Phone, FileText, MapPin, Store, Lock, AlertTriangle, ChevronRight, ChevronLeft, MoreHorizontal, LayoutGrid, ArrowDownCircle, ArrowUpCircle, History, Info, LogOut, CheckCircle, Clock, Package,
  db, auth, APP_ID, ADMIN_EMAIL,
  collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged
} from '../core.js';

import { formatCurrency, parseMoney } from './utils.js';
import { Pagination, ConfirmModal } from './ui.js';
import { ProductModal, ProductDetailsModal, StockMovementModal, CustomerFormModal } from './modals.js';

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

export { CatalogApp };
