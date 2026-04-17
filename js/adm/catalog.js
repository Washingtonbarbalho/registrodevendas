import {
  React, useState, useEffect, useMemo,
  PlusCircle, Search, Edit2, Trash2, Tag, Phone, FileText, MapPin, LayoutGrid, LogOut, Wallet,
  db, APP_ID,
  collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp
} from '../core.js';

import { formatCurrency, getBrazilDateString } from './utils.js';
import { Pagination, ConfirmModal } from './ui.js';
import { ProductModal, ProductDetailsModal, StockMovementModal, CustomerFormModal } from './modals.js';
import { FinanceView } from './finance.js';

const CatalogApp = ({ user, userProfile, onLogout }) => {
  const [view, setView] = useState('products');
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);
  const [financeOpenToken, setFinanceOpenToken] = useState(0);
  const ITEMS_PER_PAGE = 12;

  const [productModalData, setProductModalData] = useState({ open: false, data: null });
  const [customerModalData, setCustomerModalData] = useState({ open: false, data: null });
  const [productDetailsData, setProductDetailsData] = useState({ open: false, data: null });
  const [stockMovementData, setStockMovementData] = useState({ open: false, data: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, type: null, id: null });

  useEffect(() => {
    const productsQuery = query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'products'));
    const customersQuery = query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'customers'));
    const salesQuery = query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'sales'));

    const unsubProducts = onSnapshot(productsQuery, snapshot => setProducts(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))));
    const unsubCustomers = onSnapshot(customersQuery, snapshot => setCustomers(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))));
    const unsubSales = onSnapshot(salesQuery, snapshot => setSales(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))));

    return () => {
      unsubProducts();
      unsubCustomers();
      unsubSales();
    };
  }, [user.uid]);

  useEffect(() => setProductPage(1), [productSearch]);
  useEffect(() => setCustomerPage(1), [customerSearch]);

  const filteredProducts = useMemo(() => {
    let list = [...products].sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));
    if (productSearch) {
      const search = productSearch.toLowerCase();
      list = list.filter(product => String(product.name || '').toLowerCase().includes(search) || String(product.code || '').includes(productSearch));
    }
    return list;
  }, [products, productSearch]);

  const filteredCustomers = useMemo(() => {
    let list = [...customers].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    if (customerSearch) {
      const search = customerSearch.toLowerCase();
      list = list.filter(customer => String(customer.name || '').toLowerCase().includes(search) || String(customer.document || '').includes(customerSearch));
    }
    return list;
  }, [customers, customerSearch]);

  const paginatedProducts = filteredProducts.slice((productPage - 1) * ITEMS_PER_PAGE, productPage * ITEMS_PER_PAGE);
  const paginatedCustomers = filteredCustomers.slice((customerPage - 1) * ITEMS_PER_PAGE, customerPage * ITEMS_PER_PAGE);

  const handleSaveProduct = async data => {
    if (productModalData.data) {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'products', productModalData.data.id), data);
    } else {
      await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'products'), {
        ...data,
        createdAt: serverTimestamp()
      });
    }

    setProductModalData({ open: false, data: null });

    if (productDetailsData.open && productModalData.data) {
      setProductDetailsData({
        open: true,
        data: {
          ...productModalData.data,
          ...data
        }
      });
    }
  };

  const handleStockMovement = async (productId, movementInfo) => {
    const productRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'products', productId);
    const product = products.find(item => item.id === productId);
    if (!product) return;

    const currentQty = parseInt(product.quantity, 10) || 0;
    const currentCost = parseFloat(product.costPrice) || 0;
    const movementQty = parseInt(movementInfo.quantity, 10) || 0;
    const movementCost = parseFloat(movementInfo.unitCost) || 0;
    const movementType = movementInfo.type;
    const isEntry = ['compra', 'ajuste_entrada', 'devolucao'].includes(movementType);

    let newQty = currentQty;
    let newCost = currentCost;

    if (isEntry) {
      newQty = currentQty + movementQty;
      if (movementType === 'compra' && movementQty > 0) {
        const totalCurrentValue = currentQty * currentCost;
        const totalAddedValue = movementQty * movementCost;
        newCost = newQty > 0 ? (totalCurrentValue + totalAddedValue) / newQty : movementCost;
      }
    } else {
      newQty = currentQty - movementQty;
    }

    const newMovement = {
      id: Date.now().toString(),
      type: movementType,
      quantity: movementQty,
      unitCost: isEntry && movementType === 'compra' ? movementCost : 0,
      date: new Date().toISOString(),
      previousQty: currentQty,
      newQty,
      notes: movementInfo.notes || ''
    };

    const updatedMovements = Array.isArray(product.movements) ? [...product.movements, newMovement] : [newMovement];

    await updateDoc(productRef, {
      quantity: newQty,
      costPrice: newCost,
      movements: updatedMovements
    });

    setStockMovementData({ open: false, data: null });
    setProductDetailsData({
      open: true,
      data: {
        ...product,
        quantity: newQty,
        costPrice: newCost,
        movements: updatedMovements
      }
    });
  };

  const handleSaveCustomer = async data => {
    if (customerModalData.data) {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'customers', customerModalData.data.id), data);
    } else {
      await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'customers'), {
        ...data,
        createdAt: serverTimestamp()
      });
    }
    setCustomerModalData({ open: false, data: null });
  };

  const confirmDelete = async () => {
    const { type, id } = deleteModal;
    if (!type || !id) return;
    const collectionName = type === 'customer' ? 'customers' : 'products';
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, collectionName, id));
    setDeleteModal({ open: false, type: null, id: null });
    if (type === 'product' && productDetailsData.data?.id === id) {
      setProductDetailsData({ open: false, data: null });
    }
  };

  const requestDelete = (type, id) => setDeleteModal({ open: true, type, id });

  const handleHeaderAdd = () => {
    if (view === 'products') {
      setProductModalData({ open: true, data: null });
      return;
    }
    if (view === 'customers') {
      setCustomerModalData({ open: true, data: null });
      return;
    }
    if (view === 'finance') {
      setFinanceOpenToken(prev => prev + 1);
    }
  };

  const viewTabs = [
    { id: 'products', label: 'Catálogo', icon: LayoutGrid },
    { id: 'customers', label: 'Clientes', icon: Phone },
    { id: 'finance', label: 'Financeiro', icon: Wallet }
  ];

  return React.createElement('div', { className: 'min-h-screen bg-slate-50 pb-20 font-sans text-slate-800' },
    React.createElement('header', { className: 'bg-slate-900 text-white p-4 lg:p-6 rounded-b-3xl shadow-lg sticky top-0 z-40 w-full' },
      React.createElement('div', { className: 'max-w-7xl mx-auto' },
        React.createElement('div', { className: 'flex justify-between items-center mb-4' },
          React.createElement('div', { className: 'flex items-center gap-3' },
            React.createElement('div', { className: 'bg-yellow-500 p-2 rounded-xl shadow-lg shadow-yellow-500/20' },
              React.createElement(LayoutGrid, { className: 'text-slate-900', size: 24 })
            ),
            React.createElement('div', null,
              React.createElement('h1', { className: 'text-xl lg:text-2xl font-bold bg-gradient-to-r from-yellow-200 to-yellow-500 bg-clip-text text-transparent' }, 'Gestor Integrado'),
              React.createElement('p', { className: 'text-xs text-slate-400' }, `${userProfile?.storeName || 'Ambiente de Cadastros'} • ADM Aura`)
            )
          ),
          React.createElement('div', { className: 'flex items-center gap-2' },
            React.createElement('button', {
              onClick: onLogout,
              className: 'bg-slate-800 p-2 rounded-full text-red-400 border border-slate-700 hover:bg-slate-700 transition-colors'
            }, React.createElement(LogOut, { size: 20 })),
            React.createElement('button', {
              onClick: handleHeaderAdd,
              className: 'bg-yellow-500 hover:bg-yellow-400 text-slate-900 p-2 rounded-full shadow-lg transition-transform active:scale-95 ml-2'
            }, React.createElement(PlusCircle, { size: 20 }))
          )
        ),
        React.createElement('div', { className: 'flex space-x-1 overflow-x-auto no-scrollbar justify-start lg:justify-center' },
          viewTabs.map(tab => {
            const Icon = tab.icon;
            const active = view === tab.id;
            return React.createElement('button', {
              key: tab.id,
              onClick: () => setView(tab.id),
              className: `pb-2 px-3 lg:px-6 whitespace-nowrap font-medium text-sm lg:text-base transition-colors flex items-center gap-2 ${active ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-slate-400 hover:text-white'}`
            }, React.createElement(Icon, { size: 16 }), tab.label);
          })
        )
      )
    ),
    React.createElement('main', { className: 'max-w-7xl mx-auto p-4 mt-2 space-y-4' },
      view === 'products' && React.createElement('div', { className: 'animate-fade-in' },
        React.createElement('div', { className: 'flex gap-2 mb-4' },
          React.createElement('div', { className: 'relative flex-1' },
            React.createElement(Search, { size: 18, className: 'absolute left-3 top-3.5 text-slate-400' }),
            React.createElement('input', {
              className: 'w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none shadow-sm',
              placeholder: 'Buscar produto...',
              value: productSearch,
              onChange: e => setProductSearch(e.target.value.toUpperCase())
            })
          )
        ),
        React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4' },
          paginatedProducts.map(product => {
            const isPromoActive = product.isPromo && getBrazilDateString() >= product.promoStart && getBrazilDateString() <= product.promoEnd;
            return React.createElement('div', {
              key: product.id,
              onClick: () => setProductDetailsData({ open: true, data: product }),
              className: 'bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:border-yellow-300 transition-all cursor-pointer'
            },
              React.createElement('div', { className: 'p-4 flex-1' },
                React.createElement('div', { className: 'flex justify-between items-start mb-2' },
                  React.createElement('span', { className: 'text-xs font-mono bg-slate-100 text-slate-500 px-2 py-1 rounded' }, '#', product.code),
                  isPromoActive && React.createElement('span', { className: 'bg-purple-100 text-purple-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase flex items-center gap-1' },
                    React.createElement(Tag, { size: 10 }),
                    'Promo'
                  )
                ),
                React.createElement('h3', { className: 'font-bold text-slate-800 leading-tight mb-1' }, product.name),
                React.createElement('div', { className: 'flex justify-between items-end mt-4' },
                  React.createElement('div', null,
                    React.createElement('p', { className: 'text-[10px] text-slate-400 uppercase font-bold' }, 'Venda'),
                    isPromoActive ? React.createElement('div', { className: 'flex flex-col' },
                      React.createElement('span', { className: 'text-xs text-slate-400 line-through' }, formatCurrency(product.salePrice)),
                      React.createElement('span', { className: 'text-lg font-bold text-purple-600' }, formatCurrency(product.promoPrice))
                    ) : React.createElement('span', { className: 'text-lg font-bold text-slate-800' }, formatCurrency(product.salePrice))
                  ),
                  React.createElement('div', { className: 'text-right' },
                    React.createElement('p', { className: 'text-[10px] text-slate-400 uppercase font-bold' }, 'Estoque'),
                    React.createElement('span', { className: `font-bold ${product.quantity <= 0 ? 'text-red-500' : 'text-slate-700'}` }, `${product.quantity} un.`)
                  )
                )
              )
            );
          }),
          filteredProducts.length === 0 && React.createElement('p', { className: 'col-span-full text-center text-slate-400 py-10' }, 'Nenhum produto encontrado.')
        ),
        React.createElement(Pagination, {
          totalItems: filteredProducts.length,
          itemsPerPage: ITEMS_PER_PAGE,
          currentPage: productPage,
          onPageChange: setProductPage
        })
      ),
      view === 'customers' && React.createElement('div', { className: 'animate-fade-in' },
        React.createElement('div', { className: 'flex gap-2 mb-4' },
          React.createElement('div', { className: 'relative flex-1' },
            React.createElement(Search, { size: 18, className: 'absolute left-3 top-3.5 text-slate-400' }),
            React.createElement('input', {
              className: 'w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none shadow-sm',
              placeholder: 'Buscar cliente ou documento...',
              value: customerSearch,
              onChange: e => setCustomerSearch(e.target.value.toUpperCase())
            })
          )
        ),
        React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' },
          paginatedCustomers.map(customer => React.createElement('div', {
            key: customer.id,
            className: 'bg-white p-4 rounded-xl border border-slate-100 flex flex-col shadow-sm hover:shadow-md transition-shadow'
          },
            React.createElement('div', { className: 'flex-1' },
              React.createElement('h3', { className: 'font-bold text-slate-800 mb-1' }, customer.name),
              React.createElement('div', { className: 'space-y-1 mt-2 text-sm text-slate-600' },
                customer.phone && React.createElement('p', { className: 'flex items-center gap-2' }, React.createElement(Phone, { size: 14, className: 'text-slate-400' }), customer.phone),
                customer.document && React.createElement('p', { className: 'flex items-center gap-2' }, React.createElement(FileText, { size: 14, className: 'text-slate-400' }), customer.document),
                customer.cityState && React.createElement('p', { className: 'flex items-center gap-2' }, React.createElement(MapPin, { size: 14, className: 'text-slate-400' }), customer.cityState)
              )
            ),
            React.createElement('div', { className: 'flex gap-2 mt-4 pt-3 border-t border-slate-100' },
              React.createElement('button', {
                onClick: () => setCustomerModalData({ open: true, data: customer }),
                className: 'flex-1 text-slate-400 hover:text-yellow-600 p-2 flex justify-center items-center rounded-lg hover:bg-slate-50 transition-colors'
              }, React.createElement(Edit2, { size: 18 })),
              React.createElement('button', {
                onClick: () => requestDelete('customer', customer.id),
                className: 'flex-1 text-slate-400 hover:text-red-500 p-2 flex justify-center items-center rounded-lg hover:bg-red-50 transition-colors'
              }, React.createElement(Trash2, { size: 18 }))
            )
          )),
          filteredCustomers.length === 0 && React.createElement('p', { className: 'col-span-full text-center text-slate-400 py-10' }, 'Nenhum cliente encontrado.')
        ),
        React.createElement(Pagination, {
          totalItems: filteredCustomers.length,
          itemsPerPage: ITEMS_PER_PAGE,
          currentPage: customerPage,
          onPageChange: setCustomerPage
        })
      ),
      view === 'finance' && React.createElement(FinanceView, {
        user,
        sales,
        openManualEntryToken: financeOpenToken
      })
    ),
    React.createElement(ProductModal, {
      isOpen: productModalData.open,
      onClose: () => setProductModalData({ open: false, data: null }),
      onSave: handleSaveProduct,
      initialData: productModalData.data,
      lastCode: products.length > 0 ? String(products.reduce((max, product) => Math.max(max, parseInt(product.code || '0', 10) || 0), 0)).padStart(6, '0') : null
    }),
    React.createElement(ProductDetailsModal, {
      isOpen: productDetailsData.open,
      onClose: () => setProductDetailsData({ open: false, data: null }),
      product: productDetailsData.data,
      salesHistory: sales,
      onEdit: product => setProductModalData({ open: true, data: product }),
      onMovementRequest: product => setStockMovementData({ open: true, data: product }),
      onDeleteRequest: requestDelete
    }),
    React.createElement(StockMovementModal, {
      isOpen: stockMovementData.open,
      onClose: () => setStockMovementData({ open: false, data: null }),
      product: stockMovementData.data,
      onSave: handleStockMovement
    }),
    React.createElement(CustomerFormModal, {
      isOpen: customerModalData.open,
      onClose: () => setCustomerModalData({ open: false, data: null }),
      onSave: handleSaveCustomer,
      initialData: customerModalData.data
    }),
    React.createElement(ConfirmModal, {
      isOpen: deleteModal.open,
      title: 'Excluir Permanentemente?',
      message: 'O registro será apagado do sistema sem possibilidade de recuperação.',
      onClose: () => setDeleteModal({ open: false, type: null, id: null }),
      onConfirm: confirmDelete
    })
  );
};

export { CatalogApp };
