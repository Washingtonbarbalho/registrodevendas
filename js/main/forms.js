import {
  React, useState, useEffect, useMemo, useRef,
  Users, ShoppingBag, PlusCircle, CheckCircle, MessageCircle, Trash2, ChevronDown, ChevronUp, Package, TrendingUp, Edit2, AlertTriangle, Wallet, Search, CreditCard, QrCode, Banknote, Calendar, Filter, X, PieChart, BarChart3, ArrowUpRight, ArrowDownRight, PackageMinus, LogOut, Lock, Mail, Phone, Store, UserCog, UserCheck, UserX, Shield, ChevronLeft, ChevronRight, MoreHorizontal, LayoutGrid, AlertCircle, RefreshCw, Clock, Bell, History, FileText, XCircle, User, Smartphone, Copy, Tag, Info, MapPin, BadgePercent, Receipt,
  db, auth, APP_ID, ADMIN_EMAIL,
  collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query, serverTimestamp, getDoc, setDoc, where, getDocs,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged
} from '../core.js';

import { formatCurrency, parseMoney, maskMoney, maskPhone, maskCpfCnpj, maskCep, applyPixMask, formatDate, getBrazilDateString, addDays, getCurrentMonthStart, getCurrentMonthEnd } from './utils.js';
import { MoneyInput, Pagination, DateRangeFilter } from './ui.js';
import { ConfirmModal, WhatsAppChooserModal, UserProfileModal, PaymentConfirmationModal, InstallmentListModal } from './modals.js';

const EditInstallmentModal = ({ isOpen, onClose, installment, onSave }) => {
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');
    useEffect(() => { if (installment) { setAmount(maskMoney((installment.amount * 100).toFixed(0))); setDueDate(installment.dueDate); } }, [installment]);
    const handleSave = () => { onSave({ ...installment, amount: parseMoney(amount), dueDate }); onClose(); };
    if (!isOpen || !installment) return null;
    return React.createElement('div', { className: "fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]" },
        React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in" },
            React.createElement('h3', { className: "text-lg font-bold mb-4 flex items-center gap-2" }, React.createElement(Edit2, { size: 20, className: "text-yellow-600" }), `Editar Parcela ${installment.number}`),
            React.createElement('div', { className: "space-y-4" },
                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Valor (R$)"), React.createElement(MoneyInput, { value: amount, onChange: setAmount })),
                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Vencimento"), React.createElement('input', { type: "date", className: "w-full p-3 border border-slate-200 rounded-lg", value: dueDate, onChange: e => setDueDate(e.target.value) }))
            ),
            React.createElement('div', { className: "flex gap-3 mt-6" }, React.createElement('button', { onClick: onClose, className: "flex-1 p-3 text-slate-500 font-bold" }, "Cancelar"), React.createElement('button', { onClick: handleSave, className: "flex-1 p-3 bg-slate-900 text-white font-bold rounded-xl" }, "Salvar"))
        )
    );
};

// --- MODAL DE VISUALIZAÇÃO DO PRODUTO (Somente Leitura) ---
const ProductDetailsModal = ({ isOpen, onClose, product }) => {
    if (!isOpen || !product) return null;

    const today = getBrazilDateString();
    const isPromoActive = product.isPromo && today >= product.promoStart && today <= product.promoEnd;

    return React.createElement('div', { className: "fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto" },
        React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in" },
            React.createElement('div', { className: "flex justify-between items-center mb-6 border-b border-slate-100 pb-4" },
                React.createElement('h3', { className: "text-lg font-bold flex items-center gap-2 text-slate-800" }, React.createElement(Package, { className: "text-yellow-500" }), "Detalhes do Produto"),
                React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-slate-100 rounded-full text-slate-400" }, React.createElement(X, { size: 20 }))
            ),
            
            React.createElement('div', { className: "space-y-4" },
                React.createElement('div', null,
                    React.createElement('span', { className: "text-xs font-mono bg-slate-100 text-slate-500 px-2 py-1 rounded" }, `#${product.code}`),
                    React.createElement('h2', { className: "text-xl font-bold text-slate-800 mt-2 leading-tight" }, product.name),
                    product.description && React.createElement('p', { className: "text-sm text-slate-500 mt-1" }, product.description)
                ),

                React.createElement('div', { className: "grid grid-cols-2 gap-4" },
                    React.createElement('div', { className: "bg-slate-50 p-3 rounded-xl border border-slate-100" },
                        React.createElement('p', { className: "text-[10px] uppercase font-bold text-slate-400 mb-1" }, "Preço Base"),
                        React.createElement('p', { className: "font-bold text-slate-800 text-lg" }, formatCurrency(product.salePrice))
                    ),
                    React.createElement('div', { className: "bg-slate-50 p-3 rounded-xl border border-slate-100" },
                        React.createElement('p', { className: "text-[10px] uppercase font-bold text-slate-400 mb-1" }, "Estoque Atual"),
                        React.createElement('p', { className: `font-bold text-lg ${product.quantity <= 0 ? 'text-red-500' : 'text-slate-800'}` }, `${product.quantity} un.`)
                    )
                ),

                isPromoActive && React.createElement('div', { className: "bg-purple-50 p-4 rounded-xl border border-purple-200" },
                    React.createElement('p', { className: "text-xs font-bold text-purple-700 uppercase flex items-center gap-1 mb-2" }, React.createElement(Tag, { size: 14 }), "Promoção Ativa"),
                    React.createElement('div', { className: "flex justify-between items-end" },
                        React.createElement('div', null,
                            React.createElement('p', { className: "text-[10px] text-purple-500 font-bold uppercase" }, "Valor Especial"),
                            React.createElement('p', { className: "font-bold text-purple-700 text-2xl" }, formatCurrency(product.promoPrice))
                        ),
                        React.createElement('div', { className: "text-right" },
                            React.createElement('p', { className: "text-[10px] text-purple-500 font-bold uppercase" }, "Válido até"),
                            React.createElement('p', { className: "font-bold text-purple-600 text-sm" }, formatDate(product.promoEnd))
                        )
                    )
                ),

                React.createElement('div', { className: "bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-start gap-3 mt-4" },
                    React.createElement(Info, { size: 18, className: "text-blue-500 shrink-0 mt-0.5" }),
                    React.createElement('p', { className: "text-xs text-blue-700" }, "Para editar preços, descrições ou estoque, acesse o sistema Gestor Integrado de Cadastros independente.")
                )
            ),

            React.createElement('div', { className: "mt-6" },
                React.createElement('button', { onClick: onClose, className: "w-full p-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg" }, "Fechar")
            )
        )
    );
};

// --- NOVO FORMULÁRIO DE CLIENTE COMPLETO ---
const CustomerFormModal = ({ isOpen, onClose, onSave, initialData }) => {
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
            setName(initialData.name || ''); setPhone(initialData.phone || ''); setDocumentData(initialData.document || ''); setBirthDate(initialData.birthDate || '');
            setCep(initialData.cep || ''); setStreet(initialData.street || ''); setNumber(initialData.number || ''); setComplement(initialData.complement || '');
            setReference(initialData.reference || ''); setNeighborhood(initialData.neighborhood || ''); setCityState(initialData.cityState || '');
        } else if (isOpen) {
            setName(''); setPhone(''); setDocumentData(''); setBirthDate(''); setCep(''); setStreet(''); setNumber(''); setComplement(''); setReference(''); setNeighborhood(''); setCityState('');
        }
    }, [initialData, isOpen]);

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
            } catch (e) { console.error(e); }
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

    if (!isOpen) return null;

    return React.createElement('div', { className: "fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" },
        React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in flex flex-col max-h-[95vh]" },
            React.createElement('div', { className: "p-6 border-b border-slate-100 flex justify-between items-center shrink-0" },
                React.createElement('h3', { className: "text-xl font-bold text-slate-800 flex items-center gap-2" }, React.createElement(User, { className: "text-yellow-500" }), initialData ? 'Editar Cliente' : 'Novo Cliente'),
                React.createElement('button', { onClick: onClose, className: "p-2 bg-slate-100 rounded-full hover:bg-slate-200" }, React.createElement(X, { size: 20 }))
            ),
            React.createElement('div', { className: "p-6 overflow-y-auto flex-1 space-y-4 no-scrollbar" },
                // Dados Pessoais
                React.createElement('div', { className: "bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3" },
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase" }, "Dados Pessoais"),
                    React.createElement('div', null,
                        React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Nome Completo *"),
                        React.createElement('input', { autoFocus: true, className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 uppercase", value: name, onChange: e => setName(e.target.value.toUpperCase()) })
                    ),
                    React.createElement('div', { className: "grid grid-cols-2 gap-3" },
                        React.createElement('div', null,
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "WhatsApp"),
                            React.createElement('input', { type: "tel", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: phone, onChange: e => setPhone(maskPhone(e.target.value)), placeholder: "(00) 00000-0000" })
                        ),
                        React.createElement('div', null,
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "CPF / CNPJ"),
                            React.createElement('input', { type: "text", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: documentData, onChange: e => setDocumentData(maskCpfCnpj(e.target.value)), placeholder: "000.000.000-00" })
                        )
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Data de Nascimento"),
                        React.createElement('input', { type: "date", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 text-sm", value: birthDate, onChange: e => setBirthDate(e.target.value) })
                    )
                ),
                // Endereço
                React.createElement('div', { className: "bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-sm" },
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase" }, "Endereço"),
                    React.createElement('div', { className: "grid grid-cols-2 gap-3 items-end" },
                        React.createElement('div', null,
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "CEP"),
                            React.createElement('input', { type: "text", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: cep, onChange: e => setCep(maskCep(e.target.value)), onBlur: handleCepBlur, placeholder: "00000-000" })
                        ),
                        React.createElement('div', { className: "pb-3" }, loadingCep && React.createElement('span', { className: "text-xs text-yellow-600 font-bold animate-pulse" }, "Buscando..."))
                    ),
                    React.createElement('div', { className: "grid grid-cols-4 gap-3" },
                        React.createElement('div', { className: "col-span-3" },
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Rua / Logradouro"),
                            React.createElement('input', { type: "text", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 uppercase", value: street, onChange: e => setStreet(e.target.value.toUpperCase()) })
                        ),
                        React.createElement('div', { className: "col-span-1" },
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Nº"),
                            React.createElement('input', { type: "text", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 uppercase", value: number, onChange: e => setNumber(e.target.value) })
                        )
                    ),
                    React.createElement('div', { className: "grid grid-cols-2 gap-3" },
                        React.createElement('div', null,
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Bairro"),
                            React.createElement('input', { type: "text", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 uppercase", value: neighborhood, onChange: e => setNeighborhood(e.target.value.toUpperCase()) })
                        ),
                        React.createElement('div', null,
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Cidade/UF"),
                            React.createElement('input', { type: "text", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500 uppercase", value: cityState, onChange: e => setCityState(e.target.value.toUpperCase()) })
                        )
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Complemento"),
                        React.createElement('input', { type: "text", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: complement, onChange: e => setComplement(e.target.value) })
                    ),
                    React.createElement('div', null,
                        React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Ponto de Referência"),
                        React.createElement('input', { type: "text", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: reference, onChange: e => setReference(e.target.value) })
                    )
                )
            ),
            React.createElement('div', { className: "p-6 border-t border-slate-100 flex gap-3 shrink-0 bg-white rounded-b-2xl" },
                React.createElement('button', { onClick: onClose, className: "flex-1 p-3 text-slate-500 font-bold bg-slate-100 rounded-xl hover:bg-slate-200" }, "Cancelar"),
                React.createElement('button', { onClick: handleSubmit, className: "flex-1 p-3 bg-slate-900 text-yellow-400 font-bold rounded-xl hover:bg-slate-800 shadow-lg" }, "Salvar Cliente")
            )
        )
    );
};

const NewSaleModal = ({ isOpen, onClose, customers, products, onSave }) => {
    const [step, setStep] = useState(1);

    // Step 1: Cliente
    const [customerId, setCustomerId] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerList, setShowCustomerList] = useState(false);

    // Step 2: Produtos e Descontos
    const [productSearch, setProductSearch] = useState('');
    const [showProductList, setShowProductList] = useState(false);
    const [cart, setCart] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [baseUnitPrice, setBaseUnitPrice] = useState(0);
    const [currentQty, setCurrentQty] = useState(1);
    const [currentCost, setCurrentCost] = useState(0);
    const [currentPrice, setCurrentPrice] = useState('');
    const [currentDiscount, setCurrentDiscount] = useState('');

    // Step 3: Pagamento e Taxas
    const [saleDate, setSaleDate] = useState(getBrazilDateString());
    const [saleType, setSaleType] = useState('prazo');
    const [entryAmount, setEntryAmount] = useState('');

    // A Prazo
    const [frequency, setFrequency] = useState('monthly');
    const [installmentsCount, setInstallmentsCount] = useState(1);
    const [firstDueDate, setFirstDueDate] = useState('');

    // Caixa/Cartão (Direto)
    const [directMethod, setDirectMethod] = useState('pix');
    const [cardInstallments, setCardInstallments] = useState(1);
    const [cardMode, setCardMode] = useState('presencial');
    const [cardBrand, setCardBrand] = useState('visa_master');
    const [feeType, setFeeType] = useState('sem_juros');
    const [feePercent, setFeePercent] = useState('0,00');

    useEffect(() => {
        if (isOpen) {
            const today = getBrazilDateString();
            setSaleDate(today);
            setFirstDueDate(addDays(today, 30));
            setStep(1);
            setCart([]);
            setCustomerId('');
            setEntryAmount('');
            setSaleType('prazo');
            setCustomerSearch('');
            setProductSearch('');
            setCurrentQty(1);
            setCurrentCost(0);
            setCurrentPrice('');
            setBaseUnitPrice(0);
            setCurrentDiscount('');
            setShowCustomerList(false);
            setShowProductList(false);
            setDirectMethod('pix');
            setCardInstallments(1);
            setCardMode('presencial');
            setCardBrand('visa_master');
            setFeeType('sem_juros');
            setFeePercent('0,00');
        }
    }, [isOpen]);

    useEffect(() => {
        let daysToAdd = 30;
        if (frequency === 'weekly') daysToAdd = 7;
        else if (frequency === 'biweekly') daysToAdd = 15;
        setFirstDueDate(addDays(saleDate, daysToAdd));
    }, [frequency, saleDate]);

    useEffect(() => {
        if (saleType !== 'direct' || (directMethod !== 'credit' && directMethod !== 'debit')) return;

        const TAXAS = {
            presencial: {
                debito: { visa_master: 1.37, outras: 2.58 },
                credito: {
                    visa_master: [0, 3.15, 5.39, 6.12, 6.85, 7.57, 8.28, 8.99, 9.69, 10.38, 11.06, 11.74, 12.40],
                    outras: [0, 4.91, 6.47, 7.20, 7.92, 8.63, 9.33, 10.03, 10.72, 11.41, 12.08, 12.75, 13.41]
                }
            },
            link: {
                debito: 4.20,
                credito: [0, 4.20, 6.09, 7.01, 7.91, 8.80, 9.67, 12.59, 13.42, 14.25, 15.06, 15.87, 16.66]
            }
        };

        let percent = 0;
        if (cardMode === 'presencial') {
            if (directMethod === 'debit') {
                percent = cardBrand === 'visa_master' ? TAXAS.presencial.debito.visa_master : TAXAS.presencial.debito.outras;
            } else {
                const inst = parseInt(cardInstallments) || 1;
                const safeInst = Math.min(Math.max(inst, 1), 12);
                percent = cardBrand === 'visa_master' ? TAXAS.presencial.credito.visa_master[safeInst] : TAXAS.presencial.credito.outras[safeInst];
            }
        } else {
            if (directMethod === 'debit') {
                percent = TAXAS.link.debito;
            } else {
                const inst = parseInt(cardInstallments) || 1;
                const safeInst = Math.min(Math.max(inst, 1), 12);
                percent = TAXAS.link.credito[safeInst];
            }
        }

        setFeePercent(percent.toFixed(2).replace('.', ','));
    }, [directMethod, cardMode, cardBrand, cardInstallments, saleType]);

    const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()));
    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.includes(productSearch));

    const totalCartValue = cart.reduce((acc, item) => acc + item.price, 0);
    const totalDiscountValue = cart.reduce((acc, item) => acc + ((item.unitDiscount || 0) * item.quantity), 0);
    const entryValue = parseMoney(entryAmount) || 0;
    const totalRemaining = Math.max(0, totalCartValue - entryValue);
    const feePercentValue = parseMoney(feePercent) || 0;
    const cardFeeValue = totalRemaining * (feePercentValue / 100);
    const projectedTotalPrice = saleType === 'direct' && (directMethod === 'credit' || directMethod === 'debit') && feeType === 'com_juros'
        ? totalCartValue + cardFeeValue
        : totalCartValue;
    const projectedCardCharge = Math.max(0, projectedTotalPrice - entryValue);
    const projectedInstallmentAmount = saleType === 'prazo' && totalRemaining > 0 ? totalRemaining / (parseInt(installmentsCount) || 1) : 0;
    const selectedCustomer = customers.find(c => c.id === customerId);
    const selectedProduct = products.find(p => p.id === selectedProductId);
    const cartItemsCount = cart.reduce((acc, item) => acc + (parseInt(item.quantity) || 1), 0);

    const handleSelectProduct = (p) => {
        setSelectedProductId(p.id);
        setProductSearch(`#${p.code} - ${p.name}`);
        setShowProductList(false);

        const cost = p.costPrice || 0;
        let price = p.salePrice || 0;

        const today = getBrazilDateString();
        if (p.isPromo && p.promoStart && p.promoEnd && today >= p.promoStart && today <= p.promoEnd) {
            price = p.promoPrice || 0;
        }

        setCurrentCost(cost);
        setBaseUnitPrice(price);
        setCurrentPrice(maskMoney((price * 100).toFixed(0)));
        setCurrentDiscount('');
    };

    const handleDiscountChange = (valStr) => {
        setCurrentDiscount(valStr);
        const discountVal = parseMoney(valStr);
        const newPrice = Math.max(0, baseUnitPrice - discountVal);
        setCurrentPrice(maskMoney((newPrice * 100).toFixed(0)));
    };

    const handlePriceChange = (valStr) => {
        setCurrentPrice(valStr);
        const priceVal = parseMoney(valStr);
        const discountVal = Math.max(0, baseUnitPrice - priceVal);
        setCurrentDiscount(maskMoney((discountVal * 100).toFixed(0)));
    };

    const handleAddItem = () => {
        const qty = parseInt(currentQty) || 1;
        const unitPrice = parseMoney(currentPrice);
        const unitDiscount = parseMoney(currentDiscount);

        if (!selectedProductId || unitPrice < 0 || qty <= 0) return;

        const prod = products.find(p => p.id === selectedProductId);
        const totalLineCost = currentCost * qty;
        const totalLinePrice = unitPrice * qty;

        const newItem = {
            tempId: Date.now(),
            productId: prod.id,
            productName: prod.name,
            productCode: prod.code,
            quantity: qty,
            cost: totalLineCost,
            price: totalLinePrice,
            unitPrice: unitPrice,
            unitCost: currentCost,
            unitDiscount: unitDiscount
        };

        setCart([...cart, newItem]);
        setSelectedProductId('');
        setCurrentQty(1);
        setCurrentCost(0);
        setCurrentPrice('');
        setBaseUnitPrice(0);
        setCurrentDiscount('');
        setProductSearch('');
    };

    const handleRemoveItem = (id) => setCart(cart.filter(i => i.tempId !== id));

    const calculateInstallments = () => {
        const total = totalRemaining;
        const count = parseInt(installmentsCount) || 1;
        if (total <= 0) return [];
        const amountPerInstallment = total / count;
        const installments = [];
        let currentDateStr = firstDueDate;
        for (let i = 0; i < count; i++) {
            installments.push({ number: i + 1, amount: amountPerInstallment, dueDate: currentDateStr, paid: false, paidAt: null });
            if (frequency === 'weekly') currentDateStr = addDays(currentDateStr, 7);
            else if (frequency === 'biweekly') currentDateStr = addDays(currentDateStr, 15);
            else currentDateStr = addDays(currentDateStr, 30);
        }
        return installments;
    };

    const handleFinish = () => {
        if (!customerId || cart.length === 0) return;
        const customer = customers.find(c => c.id === customerId);
        const sumDiscount = cart.reduce((acc, i) => acc + (i.unitDiscount * i.quantity), 0);

        let saleData = {
            customerId: customerId,
            customerName: customer.name,
            customerPhone: customer.phone,
            items: cart,
            totalCost: cart.reduce((acc, i) => acc + i.cost, 0),
            totalPrice: totalCartValue,
            totalDiscount: sumDiscount,
            saleDate: saleDate,
            saleType: saleType,
            status: 'active'
        };

        if (saleType === 'prazo') {
            const finalInstallments = calculateInstallments();
            saleData = {
                ...saleData,
                entryAmount: entryValue,
                frequency,
                installmentsCount: finalInstallments.length,
                installments: finalInstallments,
                status: finalInstallments.length === 0 && entryValue >= totalCartValue ? 'completed' : 'active'
            };
        } else {
            let finalSalePrice = totalCartValue;
            let feeObj = null;

            if (directMethod === 'credit' || directMethod === 'debit') {
                const feeP = parseMoney(feePercent);
                const feeVal = totalRemaining * (feeP / 100);

                feeObj = {
                    applied: feeP > 0,
                    percent: feeP,
                    value: feeVal,
                    type: feeType,
                    mode: cardMode,
                    brand: cardBrand
                };

                if (feeType === 'com_juros') {
                    finalSalePrice += feeVal;
                }
            }

            saleData = {
                ...saleData,
                paymentMethod: directMethod,
                entryAmount: entryValue,
                cardAmount: finalSalePrice - entryValue,
                cardInstallments: directMethod === 'credit' ? parseInt(cardInstallments) : 1,
                installments: [],
                status: 'completed',
                totalPrice: finalSalePrice,
                feeConfig: feeObj
            };
        }

        onSave(saleData);
        onClose();
    };

    if (!isOpen) return null;

    const h = React.createElement;
    const inputClass = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-700 outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100";
    const selectClass = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-700 outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100";
    const areaCardClass = "surface-card rounded-[28px] p-5 md:p-6";
    const subCardClass = "surface-card-muted rounded-3xl p-4 md:p-5";

    const stepMeta = [
        { id: 1, icon: Users, title: 'Cliente', description: 'Escolha quem vai receber a venda' },
        { id: 2, icon: Package, title: 'Produtos', description: 'Monte o carrinho com clareza' },
        { id: 3, icon: Wallet, title: 'Pagamento', description: 'Defina recebimento e taxas' }
    ];

    const paymentOptions = [
        { id: 'pix', label: 'PIX', desc: 'Liquidação instantânea', icon: QrCode },
        { id: 'money', label: 'Dinheiro', desc: 'Recebimento no caixa', icon: Banknote },
        { id: 'debit', label: 'Débito', desc: 'Cartão à vista', icon: CreditCard },
        { id: 'credit', label: 'Crédito', desc: 'Parcelamento no cartão', icon: CreditCard }
    ];

    const paymentMethodLabel =
        directMethod === 'pix' ? 'PIX' :
        directMethod === 'money' ? 'Dinheiro' :
        directMethod === 'debit' ? 'Cartão de débito' : 'Cartão de crédito';

    const renderSectionHeading = (Icon, title, description) => h('div', { className: "flex items-start gap-3" },
        h('div', { className: "h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200" }, h(Icon, { size: 20 })),
        h('div', null,
            h('h3', { className: "text-lg font-bold text-slate-900" }, title),
            h('p', { className: "text-sm text-slate-500 mt-0.5" }, description)
        )
    );

    const renderStepChips = () => h('div', { className: "grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-4" },
        stepMeta.map(meta => h('button', {
            key: meta.id,
            type: 'button',
            onClick: () => {
                if (meta.id === 1) setStep(1);
                if (meta.id === 2 && customerId) setStep(2);
                if (meta.id === 3 && customerId && cart.length > 0) setStep(3);
            },
            className: `step-chip ${step === meta.id ? 'is-active' : ''} rounded-2xl px-4 py-3 text-left transition ${meta.id > step + 1 ? 'opacity-70 cursor-default' : ''}`
        },
            h('div', { className: "flex items-center gap-3" },
                h('div', { className: `h-10 w-10 rounded-xl flex items-center justify-center ${step === meta.id ? 'bg-yellow-400 text-slate-900' : 'bg-slate-100 text-slate-500'}` }, h(meta.icon, { size: 18 })),
                h('div', { className: "min-w-0" },
                    h('p', { className: "text-xs font-semibold uppercase tracking-[0.14em] text-slate-400" }, `Etapa ${meta.id}`),
                    h('p', { className: "font-bold text-slate-800 text-sm" }, meta.title),
                    h('p', { className: "text-xs text-slate-500 truncate" }, meta.description)
                )
            )
        ))
    );

    const renderCustomerSearch = () => h('div', { className: areaCardClass },
        renderSectionHeading(Users, 'Identificação do cliente', 'Busque rapidamente e selecione o cadastro que receberá esta venda.'),
        h('div', { className: "mt-5 space-y-4" },
            h('div', { className: "relative" },
                h(Search, { className: "absolute left-4 top-4 text-slate-400", size: 18 }),
                h('input', {
                    className: `${inputClass} pl-11 pr-11`,
                    placeholder: 'Digite nome, apelido ou telefone do cliente...',
                    value: customerSearch,
                    onChange: e => { setCustomerSearch(e.target.value); setCustomerId(''); setShowCustomerList(true); },
                    onFocus: () => setShowCustomerList(true),
                    onBlur: () => setTimeout(() => setShowCustomerList(false), 200)
                }),
                customerId && h(CheckCircle, { className: "absolute right-4 top-4 text-emerald-500", size: 18 }),
                showCustomerList && !customerId && h('div', { className: "absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-64 overflow-y-auto" },
                    filteredCustomers.length > 0
                        ? filteredCustomers.map(c => h('button', {
                            key: c.id,
                            type: 'button',
                            className: "w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 transition last:border-b-0",
                            onClick: () => { setCustomerId(c.id); setCustomerSearch(c.name); setShowCustomerList(false); }
                        },
                            h('p', { className: "font-bold text-slate-800 text-sm" }, c.name),
                            c.phone && h('p', { className: "text-xs text-slate-500 mt-1" }, c.phone)
                        ))
                        : h('div', { className: "px-4 py-6 text-center text-sm text-slate-500" }, 'Nenhum cliente encontrado.')
                )
            ),
            selectedCustomer
                ? h('div', { className: "rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4 md:p-5" },
                    h('div', { className: "flex items-start justify-between gap-3" },
                        h('div', null,
                            h('p', { className: "text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600" }, 'Cliente selecionado'),
                            h('p', { className: "text-lg font-bold text-slate-900 mt-1" }, selectedCustomer.name),
                            h('div', { className: "mt-2 flex flex-wrap gap-2 text-xs text-slate-600" },
                                selectedCustomer.phone && h('span', { className: "rounded-full bg-white px-3 py-1 border border-emerald-100" }, selectedCustomer.phone),
                                selectedCustomer.document && h('span', { className: "rounded-full bg-white px-3 py-1 border border-emerald-100" }, selectedCustomer.document)
                            )
                        ),
                        h('div', { className: "h-11 w-11 rounded-2xl bg-white text-emerald-600 flex items-center justify-center border border-emerald-100" }, h(CheckCircle, { size: 20 }))
                    )
                )
                : h('div', { className: "rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm text-slate-500" },
                    'Selecione um cliente para liberar a etapa de produtos e manter o fluxo da venda bem organizado.'
                )
        )
    );

    const renderProductBuilder = () => {
        const today = getBrazilDateString();
        const activePromo = selectedProduct && selectedProduct.isPromo && today >= selectedProduct.promoStart && today <= selectedProduct.promoEnd;
        return h('div', { className: "space-y-4" },
            h('div', { className: areaCardClass },
                renderSectionHeading(Package, 'Montagem da venda', 'Adicione produtos, ajuste descontos com clareza e visualize o total em tempo real.'),
                h('div', { className: "mt-5 space-y-4" },
                    h('div', { className: "relative" },
                        h(Search, { className: "absolute left-4 top-4 text-slate-400", size: 18 }),
                        h('input', {
                            className: `${inputClass} pl-11 pr-11`,
                            placeholder: 'Buscar por nome ou código do produto...',
                            value: productSearch,
                            onChange: e => { setProductSearch(e.target.value); setSelectedProductId(''); setShowProductList(true); },
                            onFocus: () => setShowProductList(true),
                            onBlur: () => setTimeout(() => setShowProductList(false), 200)
                        }),
                        selectedProductId && h(CheckCircle, { className: "absolute right-4 top-4 text-emerald-500", size: 18 }),
                        showProductList && !selectedProductId && h('div', { className: "absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-64 overflow-y-auto" },
                            filteredProducts.length > 0
                                ? filteredProducts.map(p => {
                                    const promoActive = p.isPromo && today >= p.promoStart && today <= p.promoEnd;
                                    return h('button', {
                                        key: p.id,
                                        type: 'button',
                                        className: "w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 transition last:border-b-0",
                                        onClick: () => handleSelectProduct(p)
                                    },
                                        h('div', { className: "flex items-center justify-between gap-3" },
                                            h('div', { className: "min-w-0" },
                                                h('p', { className: "font-bold text-slate-800 text-sm flex items-center gap-2" },
                                                    p.name,
                                                    promoActive && h(Tag, { size: 13, className: "text-purple-500" })
                                                ),
                                                h('div', { className: "mt-1 flex flex-wrap gap-2 text-xs text-slate-500" },
                                                    h('span', { className: "rounded-full bg-slate-100 px-2.5 py-1 font-mono" }, `#${p.code}`),
                                                    h('span', { className: "rounded-full bg-slate-100 px-2.5 py-1" }, `Estoque ${p.quantity}`)
                                                )
                                            ),
                                            h('div', { className: "text-right shrink-0" },
                                                h('p', { className: `font-bold text-sm ${promoActive ? 'text-purple-600' : 'text-slate-800'}` }, formatCurrency(promoActive ? p.promoPrice : p.salePrice)),
                                                promoActive && h('p', { className: "text-[11px] text-purple-500" }, 'Promoção ativa')
                                            )
                                        )
                                    );
                                })
                                : h('div', { className: "px-4 py-6 text-center text-sm text-slate-500" }, 'Nenhum produto encontrado.')
                        )
                    ),
                    selectedProduct && h('div', { className: "rounded-3xl border border-slate-200 bg-slate-50 p-4 md:p-5" },
                        h('div', { className: "flex items-start justify-between gap-3" },
                            h('div', null,
                                h('p', { className: "text-xs font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Produto selecionado'),
                                h('p', { className: "text-lg font-bold text-slate-900 mt-1" }, selectedProduct.name),
                                h('div', { className: "mt-2 flex flex-wrap gap-2 text-xs text-slate-500" },
                                    h('span', { className: "rounded-full bg-white px-3 py-1 border border-slate-200 font-mono" }, `#${selectedProduct.code}`),
                                    h('span', { className: "rounded-full bg-white px-3 py-1 border border-slate-200" }, `Estoque ${selectedProduct.quantity}`),
                                    activePromo && h('span', { className: "rounded-full bg-purple-100 px-3 py-1 border border-purple-200 text-purple-700 font-semibold" }, 'Preço promocional ativo')
                                )
                            ),
                            h('div', { className: "text-right shrink-0" },
                                h('p', { className: "text-xs font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Referência'),
                                h('p', { className: "text-xl font-bold text-slate-900 mt-1" }, formatCurrency(baseUnitPrice || 0))
                            )
                        )
                    ),
                    h('div', { className: "grid grid-cols-1 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)] gap-3" },
                        h('div', null,
                            h('label', { className: "block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2" }, 'Quantidade'),
                            h('input', { type: 'number', min: '1', className: `${inputClass} text-center font-bold`, value: currentQty, onChange: e => setCurrentQty(e.target.value) })
                        ),
                        h('div', null,
                            h('label', { className: "block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2" }, 'Desconto por unidade'),
                            h(MoneyInput, { placeholder: '0,00', value: currentDiscount, onChange: handleDiscountChange, className: `${inputClass} pl-10 font-semibold text-rose-600` })
                        ),
                        h('div', null,
                            h('label', { className: "block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2" }, 'Valor de venda'),
                            h(MoneyInput, { placeholder: '0,00', value: currentPrice, onChange: handlePriceChange, className: `${inputClass} pl-10 font-bold text-slate-800` })
                        )
                    ),
                    h('button', {
                        type: 'button',
                        onClick: handleAddItem,
                        disabled: !selectedProductId || currentQty < 1,
                        className: "w-full rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    }, h(PlusCircle, { size: 18 }), 'Adicionar ao carrinho')
                )
            ),
            h('div', { className: areaCardClass },
                h('div', { className: "flex items-center justify-between gap-3" },
                    h('div', null,
                        h('p', { className: "text-xs font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Carrinho atual'),
                        h('h4', { className: "text-lg font-bold text-slate-900 mt-1" }, cart.length > 0 ? `${cartItemsCount} item(ns) adicionados` : 'Seu carrinho ainda está vazio')
                    ),
                    cart.length > 0 && h('div', { className: "rounded-2xl bg-yellow-50 px-4 py-2 text-right border border-yellow-100" },
                        h('p', { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-yellow-700" }, 'Total acumulado'),
                        h('p', { className: "text-lg font-bold text-slate-900" }, formatCurrency(totalCartValue))
                    )
                ),
                h('div', { className: "mt-5 space-y-3" },
                    cart.length === 0
                        ? h('div', { className: "rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500" }, 'Adicione produtos para visualizar a composição da venda.')
                        : cart.map(item => h('div', { key: item.tempId, className: "rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm" },
                            h('div', { className: "flex items-start justify-between gap-3" },
                                h('div', { className: "min-w-0" },
                                    h('p', { className: "font-bold text-slate-900 text-sm leading-tight" }, `${item.quantity}x ${item.productName}`),
                                    h('div', { className: "mt-2 flex flex-wrap gap-2 text-xs text-slate-500" },
                                        h('span', { className: "rounded-full bg-slate-100 px-2.5 py-1 font-mono" }, `#${item.productCode}`),
                                        item.unitDiscount > 0 && h('span', { className: "rounded-full bg-rose-50 px-2.5 py-1 text-rose-600 border border-rose-100 font-semibold" }, `Desconto ${formatCurrency(item.unitDiscount * item.quantity)}`),
                                        h('span', { className: "rounded-full bg-slate-100 px-2.5 py-1" }, `Unitário ${formatCurrency(item.unitPrice)}`)
                                    )
                                ),
                                h('div', { className: "text-right shrink-0" },
                                    h('p', { className: "text-base font-bold text-slate-900" }, formatCurrency(item.price)),
                                    h('button', { type: 'button', onClick: () => handleRemoveItem(item.tempId), className: "mt-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 transition hover:bg-rose-100" }, h(Trash2, { size: 16 }))
                                )
                            )
                        ))
                )
            )
        );
    };

    const renderInstallmentConfig = () => h('div', { className: "space-y-4" },
        h('div', { className: areaCardClass },
            renderSectionHeading(Receipt, 'Recebimento a prazo', 'Configure a entrada, a frequência e o parcelamento com uma leitura objetiva.'),
            h('div', { className: "mt-5 grid grid-cols-1 md:grid-cols-2 gap-4" },
                h('div', null,
                    h('label', { className: "block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2" }, 'Entrada opcional'),
                    h(MoneyInput, { value: entryAmount, onChange: setEntryAmount, className: `${inputClass} pl-10 font-semibold text-slate-800` })
                ),
                h('div', null,
                    h('label', { className: "block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2" }, 'Frequência'),
                    h('select', { className: selectClass, value: frequency, onChange: e => setFrequency(e.target.value) },
                        h('option', { value: 'weekly' }, 'Semanal'),
                        h('option', { value: 'biweekly' }, 'Quinzenal'),
                        h('option', { value: 'monthly' }, 'Mensal')
                    )
                ),
                totalRemaining > 0 && h(React.Fragment, null,
                    h('div', null,
                        h('label', { className: "block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2" }, 'Parcelas'),
                        h('select', { className: selectClass, value: installmentsCount, onChange: e => setInstallmentsCount(e.target.value) },
                            Array.from({ length: 12 }, (_, i) => i + 1).map(n => h('option', { key: n, value: n }, `${n}x`))
                        )
                    ),
                    h('div', null,
                        h('label', { className: "block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2" }, 'Primeiro vencimento'),
                        h('input', { type: 'date', className: inputClass, value: firstDueDate, onChange: e => setFirstDueDate(e.target.value) })
                    )
                )
            )
        ),
        h('div', { className: subCardClass },
            h('div', { className: "grid grid-cols-2 lg:grid-cols-4 gap-3" },
                h('div', { className: "info-stat rounded-2xl p-4" },
                    h('p', { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Total da venda'),
                    h('p', { className: "text-lg font-bold text-slate-900 mt-2" }, formatCurrency(totalCartValue))
                ),
                h('div', { className: "info-stat rounded-2xl p-4" },
                    h('p', { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Entrada'),
                    h('p', { className: "text-lg font-bold text-slate-900 mt-2" }, formatCurrency(entryValue))
                ),
                h('div', { className: "info-stat rounded-2xl p-4" },
                    h('p', { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Em aberto'),
                    h('p', { className: "text-lg font-bold text-amber-600 mt-2" }, formatCurrency(totalRemaining))
                ),
                h('div', { className: "info-stat rounded-2xl p-4" },
                    h('p', { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Parcela média'),
                    h('p', { className: "text-lg font-bold text-slate-900 mt-2" }, formatCurrency(projectedInstallmentAmount))
                )
            )
        )
    );

    const renderDirectConfig = () => h('div', { className: "space-y-4" },
        h('div', { className: areaCardClass },
            renderSectionHeading(Wallet, 'Recebimento imediato', 'Escolha a forma de pagamento e visualize o impacto das taxas antes de concluir.'),
            h('div', { className: "mt-5 space-y-5" },
                h('div', { className: "grid grid-cols-2 xl:grid-cols-4 gap-3" },
                    paymentOptions.map(option => h('button', {
                        key: option.id,
                        type: 'button',
                        onClick: () => setDirectMethod(option.id),
                        className: `choice-tile ${directMethod === option.id ? 'is-active' : ''} rounded-3xl px-4 py-4 text-left`
                    },
                        h('div', { className: "flex items-center justify-between gap-3" },
                            h('div', { className: `h-11 w-11 rounded-2xl flex items-center justify-center ${directMethod === option.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}` }, h(option.icon, { size: 20 })),
                            directMethod === option.id && h(CheckCircle, { size: 18, className: 'text-emerald-500' })
                        ),
                        h('p', { className: "mt-4 text-sm font-bold text-slate-900" }, option.label),
                        h('p', { className: "mt-1 text-xs text-slate-500 leading-relaxed" }, option.desc)
                    ))
                ),
                h('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
                    h('div', null,
                        h('label', { className: "block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2" }, 'Data da venda'),
                        h('input', { type: 'date', className: inputClass, value: saleDate, onChange: e => setSaleDate(e.target.value) })
                    ),
                    (directMethod === 'credit' || directMethod === 'debit') && h('div', null,
                        h('label', { className: "block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2" }, 'Entrada opcional em dinheiro ou PIX'),
                        h(MoneyInput, { value: entryAmount, onChange: setEntryAmount, className: `${inputClass} pl-10 font-semibold text-slate-800` })
                    )
                )
            )
        ),
        (directMethod === 'credit' || directMethod === 'debit') && h('div', { className: areaCardClass },
            renderSectionHeading(BadgePercent, 'Configuração do cartão', 'Área redesenhada para leitura rápida, decisões claras e menos chance de erro operacional.'),
            h('div', { className: "mt-5 space-y-5" },
                h('div', { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" },
                    h('div', null,
                        h('label', { className: "block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2" }, 'Modalidade'),
                        h('select', { className: selectClass, value: cardMode, onChange: e => setCardMode(e.target.value) },
                            h('option', { value: 'presencial' }, 'Presencial'),
                            h('option', { value: 'link' }, 'Link Web')
                        )
                    ),
                    directMethod === 'credit' && h('div', null,
                        h('label', { className: "block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2" }, 'Parcelas no cartão'),
                        h('select', { className: selectClass, value: cardInstallments, onChange: e => setCardInstallments(e.target.value) },
                            h('option', { value: '1' }, '1x (à vista)'),
                            Array.from({ length: 11 }, (_, i) => i + 2).map(n => h('option', { key: n, value: n }, `${n}x`))
                        )
                    ),
                    cardMode === 'presencial'
                        ? h('div', null,
                            h('label', { className: "block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2" }, 'Bandeira'),
                            h('select', { className: selectClass, value: cardBrand, onChange: e => setCardBrand(e.target.value) },
                                h('option', { value: 'visa_master' }, 'Visa / Mastercard'),
                                h('option', { value: 'outras' }, 'Outras (Elo, Amex...)')
                            )
                        )
                        : h('div', { className: "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-500 flex items-center" }, 'No Link Web a taxa segue a tabela padrão do gateway.'),
                    h('div', null,
                        h('label', { className: "block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2" }, 'Repasse da taxa'),
                        h('select', { className: selectClass, value: feeType, onChange: e => setFeeType(e.target.value) },
                            h('option', { value: 'sem_juros' }, 'Loja absorve a taxa'),
                            h('option', { value: 'com_juros' }, 'Cliente paga a taxa')
                        )
                    )
                ),
                h('div', { className: "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-4" },
                    h('div', { className: "rounded-3xl border border-amber-100 bg-amber-50/90 px-4 py-4" },
                        h('p', { className: "text-xs font-semibold uppercase tracking-[0.16em] text-amber-700" }, 'Como a taxa será aplicada'),
                        h('p', { className: "mt-2 text-sm text-amber-900 leading-relaxed" },
                            feeType === 'sem_juros'
                                ? `A taxa será abatida do resultado da loja. O cliente continua pagando ${formatCurrency(totalRemaining)} no cartão.`
                                : `A taxa será somada ao valor final cobrado do cliente. O cartão vai receber ${formatCurrency(projectedCardCharge)}.`
                        )
                    ),
                    h('div', null,
                        h('label', { className: "block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2" }, 'Taxa aplicada (%)'),
                        h('div', { className: "relative" },
                            h('input', { type: 'text', className: `${inputClass} pr-10 font-bold text-slate-800`, value: feePercent, onChange: e => setFeePercent(e.target.value) }),
                            h('span', { className: "absolute right-4 top-3.5 text-sm font-semibold text-slate-400" }, '%')
                        )
                    )
                ),
                h('div', { className: "grid grid-cols-2 xl:grid-cols-4 gap-3" },
                    h('div', { className: "info-stat rounded-2xl p-4" },
                        h('p', { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Base no cartão'),
                        h('p', { className: "text-lg font-bold text-slate-900 mt-2" }, formatCurrency(totalRemaining))
                    ),
                    h('div', { className: "info-stat rounded-2xl p-4" },
                        h('p', { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Taxa calculada'),
                        h('p', { className: "text-lg font-bold text-amber-600 mt-2" }, formatCurrency(cardFeeValue))
                    ),
                    h('div', { className: "info-stat rounded-2xl p-4" },
                        h('p', { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Cobrança no cartão'),
                        h('p', { className: "text-lg font-bold text-slate-900 mt-2" }, formatCurrency(projectedCardCharge))
                    ),
                    h('div', { className: "info-stat rounded-2xl p-4" },
                        h('p', { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Configuração atual'),
                        h('p', { className: "text-sm font-bold text-slate-900 mt-2" }, `${directMethod === 'credit' ? `${cardInstallments}x` : 'À vista'} • ${cardMode === 'presencial' ? 'Presencial' : 'Link'}`)
                    )
                )
            )
        ),
        (directMethod === 'pix' || directMethod === 'money') && h('div', { className: subCardClass },
            h('div', { className: "grid grid-cols-2 gap-3" },
                h('div', { className: "info-stat rounded-2xl p-4" },
                    h('p', { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Forma escolhida'),
                    h('p', { className: "text-lg font-bold text-slate-900 mt-2" }, paymentMethodLabel)
                ),
                h('div', { className: "info-stat rounded-2xl p-4" },
                    h('p', { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Total a receber'),
                    h('p', { className: "text-lg font-bold text-emerald-600 mt-2" }, formatCurrency(totalCartValue))
                )
            )
        )
    );

    const renderSummaryPanel = () => h('div', { className: "space-y-4" },
        h('div', { className: "surface-card rounded-[28px] p-5" },
            h('div', { className: "flex items-start justify-between gap-3" },
                h('div', null,
                    h('p', { className: "text-xs font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Resumo operacional'),
                    h('h4', { className: "text-xl font-bold text-slate-900 mt-1" }, 'Venda em andamento')
                ),
                h('div', { className: "h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center" }, h(ShoppingBag, { size: 20 }))
            ),
            h('div', { className: "mt-5 space-y-3" },
                h('div', { className: "rounded-3xl bg-slate-900 px-4 py-4 text-white" },
                    h('p', { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300" }, 'Cliente'),
                    h('p', { className: "mt-2 text-base font-bold" }, selectedCustomer ? selectedCustomer.name : 'Aguardando seleção'),
                    h('p', { className: "mt-1 text-sm text-slate-300" }, selectedCustomer?.phone || 'Selecione um cadastro para prosseguir')
                ),
                h('div', { className: "grid grid-cols-2 gap-3" },
                    h('div', { className: "info-stat rounded-2xl p-4" },
                        h('p', { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Itens'),
                        h('p', { className: "text-lg font-bold text-slate-900 mt-2" }, `${cartItemsCount}`)
                    ),
                    h('div', { className: "info-stat rounded-2xl p-4" },
                        h('p', { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Total bruto'),
                        h('p', { className: "text-lg font-bold text-slate-900 mt-2" }, formatCurrency(totalCartValue))
                    ),
                    h('div', { className: "info-stat rounded-2xl p-4" },
                        h('p', { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Descontos'),
                        h('p', { className: "text-lg font-bold text-rose-600 mt-2" }, formatCurrency(totalDiscountValue))
                    ),
                    h('div', { className: "info-stat rounded-2xl p-4" },
                        h('p', { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Situação'),
                        h('p', { className: `text-sm font-bold mt-2 ${saleType === 'prazo' ? 'text-amber-600' : 'text-emerald-600'}` }, saleType === 'prazo' ? 'A prazo' : paymentMethodLabel)
                    )
                )
            )
        ),
        h('div', { className: "surface-card rounded-[28px] p-5" },
            h('p', { className: "text-xs font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Prévia financeira'),
            h('div', { className: "mt-4 space-y-3 text-sm" },
                h('div', { className: "flex items-center justify-between gap-3" },
                    h('span', { className: 'text-slate-500' }, 'Produtos'),
                    h('strong', { className: 'text-slate-900' }, formatCurrency(totalCartValue))
                ),
                totalDiscountValue > 0 && h('div', { className: "flex items-center justify-between gap-3" },
                    h('span', { className: 'text-slate-500' }, 'Descontos lançados'),
                    h('strong', { className: 'text-rose-600' }, formatCurrency(totalDiscountValue))
                ),
                saleType === 'prazo' && entryValue > 0 && h('div', { className: "flex items-center justify-between gap-3" },
                    h('span', { className: 'text-slate-500' }, 'Entrada'),
                    h('strong', { className: 'text-slate-900' }, formatCurrency(entryValue))
                ),
                saleType === 'direct' && (directMethod === 'credit' || directMethod === 'debit') && h('div', { className: "flex items-center justify-between gap-3" },
                    h('span', { className: 'text-slate-500' }, 'Taxa do cartão'),
                    h('strong', { className: 'text-amber-600' }, formatCurrency(cardFeeValue))
                ),
                h('div', { className: "border-t border-dashed border-slate-200 pt-3 flex items-center justify-between gap-3" },
                    h('span', { className: 'text-slate-500' }, saleType === 'prazo' ? 'Saldo a receber' : 'Total final'),
                    h('strong', { className: 'text-lg text-slate-900' }, formatCurrency(saleType === 'prazo' ? totalRemaining : projectedTotalPrice))
                )
            )
        ),
        h('div', { className: "surface-card rounded-[28px] p-5" },
            h('div', { className: "flex items-center gap-2" },
                h(Clock, { size: 16, className: 'text-slate-400' }),
                h('p', { className: "text-xs font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Checklist rápido')
            ),
            h('div', { className: "mt-4 space-y-3" },
                [
                    { ok: !!customerId, text: 'Cliente identificado' },
                    { ok: cart.length > 0, text: 'Carrinho com itens' },
                    { ok: step === 3, text: 'Pagamento revisado' }
                ].map((item, index) => h('div', { key: index, className: "flex items-center gap-3 text-sm" },
                    h('div', { className: `h-8 w-8 rounded-xl flex items-center justify-center ${item.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}` }, h(CheckCircle, { size: 16 })),
                    h('span', { className: item.ok ? 'text-slate-800 font-semibold' : 'text-slate-500' }, item.text)
                ))
            )
        )
    );

    return h('div', { className: "fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-3 md:p-5" },
        h('div', { className: "modal-modern-shell w-full max-w-6xl max-h-[94vh] overflow-hidden rounded-[32px] flex flex-col" },
            h('div', { className: "border-b border-slate-200/80 bg-white/70 px-4 py-4 md:px-6 md:py-5" },
                h('div', { className: "flex items-start justify-between gap-4" },
                    h('div', { className: "flex items-start gap-3" },
                        h('div', { className: "h-14 w-14 rounded-[22px] bg-yellow-400 text-slate-900 flex items-center justify-center shadow-lg shadow-yellow-200" }, h(ShoppingBag, { size: 24 })),
                        h('div', null,
                            h('p', { className: "text-xs font-semibold uppercase tracking-[0.18em] text-slate-400" }, 'Nova venda'),
                            h('h2', { className: "text-2xl font-black text-slate-900 mt-1" }, 'Fluxo de registro mais limpo'),
                            h('p', { className: "text-sm text-slate-500 mt-1 max-w-2xl" }, 'Redesenhei esta experiência para deixar a venda mais clara, moderna e rápida, sem alterar nenhuma regra de funcionamento.')
                        )
                    ),
                    h('button', { type: 'button', onClick: onClose, className: "h-11 w-11 rounded-2xl bg-white text-slate-500 border border-slate-200 flex items-center justify-center transition hover:bg-slate-100" }, h(X, { size: 20 }))
                ),
                renderStepChips()
            ),
            h('div', { className: "flex-1 min-h-0 grid lg:grid-cols-[minmax(0,1fr)_360px]" },
                h('div', { className: "min-h-0 flex flex-col" },
                    h('div', { className: "flex-1 overflow-y-auto no-scrollbar px-4 py-4 md:px-6 md:py-6 space-y-4" },
                        step === 1 && renderCustomerSearch(),
                        step === 2 && renderProductBuilder(),
                        step === 3 && h('div', { className: "space-y-4" },
                            h('div', { className: areaCardClass },
                                h('div', { className: "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 items-center" },
                                    renderSectionHeading(Calendar, 'Definições finais da venda', 'Escolha a data e o tipo de recebimento. A interface muda de forma limpa conforme sua decisão.'),
                                    h('div', { className: "rounded-3xl bg-slate-100 p-1.5 inline-flex gap-1.5" },
                                        h('button', { type: 'button', onClick: () => setSaleType('prazo'), className: `rounded-2xl px-4 py-3 text-sm font-bold transition ${saleType === 'prazo' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}` }, 'A prazo'),
                                        h('button', { type: 'button', onClick: () => setSaleType('direct'), className: `rounded-2xl px-4 py-3 text-sm font-bold transition ${saleType === 'direct' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500'}` }, 'Caixa / Cartão')
                                    )
                                ),
                                h('div', { className: "mt-5 grid grid-cols-1 md:grid-cols-2 gap-4" },
                                    h('div', null,
                                        h('label', { className: "block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2" }, 'Data da venda'),
                                        h('input', { type: 'date', className: inputClass, value: saleDate, onChange: e => setSaleDate(e.target.value) })
                                    ),
                                    h('div', { className: "rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 flex items-center justify-between gap-3" },
                                        h('div', null,
                                            h('p', { className: "text-xs font-semibold uppercase tracking-[0.16em] text-slate-400" }, 'Modelo atual'),
                                            h('p', { className: "text-lg font-bold text-slate-900 mt-1" }, saleType === 'prazo' ? 'Venda parcelada' : paymentMethodLabel)
                                        ),
                                        h('div', { className: `h-12 w-12 rounded-2xl flex items-center justify-center ${saleType === 'prazo' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}` }, h(saleType === 'prazo' ? Receipt : Wallet, { size: 22 }))
                                    )
                                )
                            ),
                            saleType === 'prazo' ? renderInstallmentConfig() : renderDirectConfig()
                        ),
                        h('div', { className: "lg:hidden" }, renderSummaryPanel())
                    )
                ),
                h('aside', { className: "hidden lg:block border-l border-slate-200/70 bg-slate-100/55" },
                    h('div', { className: "h-full overflow-y-auto no-scrollbar p-5" }, renderSummaryPanel())
                )
            ),
            h('div', { className: "border-t border-slate-200/80 bg-white/75 px-4 py-4 md:px-6" },
                h('div', { className: "flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between" },
                    h('div', { className: "text-xs text-slate-500" },
                        step === 1 ? 'Selecione o cliente para seguir para os produtos.' :
                        step === 2 ? 'Adicione pelo menos um item para liberar o pagamento.' :
                        'Revise os dados finais antes de concluir a venda.'
                    ),
                    h('div', { className: "flex flex-col gap-3 sm:flex-row sm:min-w-[360px]" },
                        step === 1 && h(React.Fragment, null,
                            h('button', { type: 'button', onClick: onClose, className: "rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100" }, 'Cancelar'),
                            h('button', { type: 'button', onClick: () => setStep(2), disabled: !customerId, className: "rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed" }, 'Ir para produtos')
                        ),
                        step === 2 && h(React.Fragment, null,
                            h('button', { type: 'button', onClick: () => setStep(1), className: "rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100" }, 'Voltar'),
                            h('button', { type: 'button', onClick: () => setStep(3), disabled: cart.length === 0, className: "rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed" }, 'Ir para pagamento')
                        ),
                        step === 3 && h(React.Fragment, null,
                            h('button', { type: 'button', onClick: () => setStep(2), className: "rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100" }, 'Voltar'),
                            h('button', { type: 'button', onClick: handleFinish, className: "rounded-2xl bg-yellow-400 px-5 py-3.5 text-sm font-bold text-slate-900 shadow-lg shadow-yellow-200 transition hover:bg-yellow-300" }, 'Finalizar venda')
                        )
                    )
                )
            )
        )
    );
};



// --- MODAL DE DETALHES COMPLETOS DA VENDA ---
const SaleDetailsModal = ({ isOpen, onClose, sale, onPay, onEdit, onDeletePayment, onCancelSale, onDeleteSale, onOpenWA }) => {
    if (!isOpen || !sale) return null;

    const pendingAmount = sale.installments ? sale.installments.filter(i => !i.paid).reduce((acc, i) => acc + i.amount, 0) : 0;
    const paidInstallments = sale.installments ? sale.installments.filter(i => i.paid).length : 0;
    const totalInst = sale.installmentsCount || 0;
    
    let profit = sale.totalPrice - (sale.totalCost || 0);
    // Deduz a taxa do lucro estimado na visualização, se for sem juros (Loja paga)
    if (sale.feeConfig && sale.feeConfig.type === 'sem_juros') {
        profit -= sale.feeConfig.value;
    }

    const waType = sale.saleType === 'direct' ? 'comprovante' : (sale.status === 'completed' ? 'quitacao' : 'registro');
    const waTitle = sale.saleType === 'direct' ? 'Enviar Comprovante' : (sale.status === 'completed' ? 'Enviar Quitação' : 'Enviar Resumo da Venda');

    return React.createElement('div', { className: "fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[55] backdrop-blur-sm" },
        React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl animate-fade-in" },
            // Header
            React.createElement('div', { className: "p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl shrink-0" },
                React.createElement('div', null,
                    React.createElement('h3', { className: "font-bold text-lg text-slate-800" }, "Detalhes da " + (sale.saleType === 'direct' ? "Venda" : "Cobrança")),
                    React.createElement('p', { className: "text-xs text-slate-500 font-medium" }, sale.customerName)
                ),
                React.createElement('div', { className: "flex gap-2 items-center" },
                    sale.status !== 'canceled' && React.createElement('button', { onClick: () => onOpenWA(waType, sale, null, null), className: "p-2 hover:bg-green-100 rounded-full transition-colors text-green-600", title: waTitle }, React.createElement(MessageCircle, { size: 20 })),
                    React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500" }, React.createElement(X, { size: 20 }))
                )
            ),
            
            // Scrollable Content
            React.createElement('div', { className: "flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar relative" },
                // Marca d'água de Cancelado
                sale.status === 'canceled' && React.createElement('div', { className: "absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-10" }, 
                    React.createElement('div', { className: "transform -rotate-45 text-red-600 font-black text-6xl border-4 border-red-600 p-4 rounded-xl uppercase tracking-widest" }, "Cancelado")
                ),

                // Resumo Principal
                React.createElement('div', { className: "flex justify-between items-center relative z-10" },
                    React.createElement('div', null,
                        React.createElement('p', { className: `font-bold text-2xl ${sale.status === 'canceled' ? 'text-red-500 line-through' : 'text-slate-800'}` }, formatCurrency(sale.totalPrice)),
                        React.createElement('p', { className: "text-sm text-slate-500" }, formatDate(sale.saleDate))
                    ),
                    React.createElement('span', { className: `px-3 py-1 rounded-full text-xs font-bold ${sale.status === 'canceled' ? 'bg-red-100 text-red-700' : sale.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}` }, sale.status === 'canceled' ? 'Cancelado' : sale.status === 'completed' ? 'Quitado' : 'Aberto')
                ),

                sale.status === 'canceled' && sale.cancelReason && React.createElement('div', { className: "bg-red-50 p-3 rounded-lg border border-red-100 relative z-10" },
                    React.createElement('p', { className: "text-[10px] uppercase font-bold text-red-500 mb-1" }, "Motivo do Cancelamento:"),
                    React.createElement('p', { className: "text-sm text-red-700 italic" }, `"${sale.cancelReason}"`)
                ),

                sale.saleType === 'prazo' && React.createElement('div', { className: "flex justify-between items-center text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 relative z-10" },
                    React.createElement('span', { className: "flex items-center gap-1" }, React.createElement(CheckCircle, { size: 16, className: paidInstallments === totalInst && sale.status !== 'canceled' ? 'text-emerald-500' : 'text-slate-400' }), `Pagos: ${paidInstallments}/${totalInst}`),
                    React.createElement('span', { className: "font-bold" }, pendingAmount > 0 ? `Resta: ${formatCurrency(pendingAmount)}` : 'Concluído')
                ),

                // Itens
                React.createElement('div', { className: "bg-white p-4 rounded-xl border border-slate-200 relative z-10" },
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2" }, React.createElement(Package, { size: 14 }), "Itens da Venda"),
                    sale.items.map((item, idx) => React.createElement('div', { key: idx, className: "flex justify-between text-sm py-2 border-b border-slate-50 last:border-0" },
                        React.createElement('div', null,
                            React.createElement('span', { className: "text-slate-700" }, item.quantity ? `${item.quantity}x ${item.productName}` : item.productName),
                            item.unitDiscount > 0 && React.createElement('span', { className: "ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-1 rounded font-bold" }, `Desconto: ${formatCurrency(item.unitDiscount * item.quantity)}`)
                        ),
                        React.createElement('span', { className: "font-mono text-slate-800 font-bold" }, formatCurrency(item.price))
                    ))
                ),

                // Financeiro
                React.createElement('div', { className: "bg-white p-4 rounded-xl border border-slate-200 space-y-3 relative z-10" },
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2" }, React.createElement(PieChart, { size: 14 }), "Resumo Financeiro"),
                    React.createElement('div', { className: "flex justify-between text-sm" }, React.createElement('span', { className: "text-slate-500" }, "Valor dos Produtos:"), React.createElement('span', { className: "text-slate-800 font-bold" }, formatCurrency((sale.totalPrice + (sale.totalDiscount||0)) - (sale.feeConfig?.type === 'com_juros' ? sale.feeConfig.value : 0)))),
                    sale.totalDiscount > 0 && React.createElement('div', { className: "flex justify-between text-sm text-emerald-600" }, React.createElement('span', null, "Descontos Aplicados:"), React.createElement('span', { className: "font-bold" }, `- ${formatCurrency(sale.totalDiscount)}`)),
                    sale.feeConfig && React.createElement('div', { className: "flex justify-between text-sm text-orange-600" }, React.createElement('span', null, sale.feeConfig.type === 'sem_juros' ? "Taxa Maquininha (Loja Paga):" : "Taxa Repassada (Cliente Paga):"), React.createElement('span', { className: "font-bold" }, `${sale.feeConfig.type === 'sem_juros' ? '-' : '+'} ${formatCurrency(sale.feeConfig.value)}`)),
                    React.createElement('div', { className: "flex justify-between text-sm" }, React.createElement('span', { className: "text-slate-500" }, "Custo Total:"), React.createElement('span', { className: "text-slate-800" }, formatCurrency(sale.totalCost || 0))),
                    React.createElement('div', { className: "flex justify-between text-sm pt-3 border-t border-slate-100" }, React.createElement('span', { className: "font-bold text-emerald-600 flex items-center gap-1" }, React.createElement(Wallet, { size: 14 }), "Lucro Estimado Líquido:"), React.createElement('span', { className: `font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}` }, formatCurrency(profit)))
                ),

                // Info Especifica de Venda Direta
                sale.saleType === 'direct' && React.createElement(React.Fragment, null,
                    (sale.paymentMethod === 'credit' || sale.paymentMethod === 'debit') && React.createElement('div', { className: "bg-emerald-50 p-4 rounded-xl border border-emerald-100 space-y-3 relative z-10" },
                        sale.entryAmount > 0 && React.createElement('div', { className: "flex justify-between items-center text-sm" }, React.createElement('span', { className: "text-emerald-800" }, "Entrada (Dinheiro/Pix):"), React.createElement('span', { className: "font-bold text-emerald-800" }, formatCurrency(sale.entryAmount))),
                        React.createElement('div', { className: "flex justify-between items-center text-sm" }, React.createElement('span', { className: "text-emerald-800 flex items-center gap-1" }, React.createElement(Receipt, { size: 14 }), `Passado no Cartão (${sale.cardInstallments}x):`), React.createElement('span', { className: "font-bold text-emerald-800" }, formatCurrency(sale.cardAmount || sale.totalPrice))),
                        sale.feeConfig && React.createElement('div', { className: "text-[10px] text-emerald-700 bg-emerald-100 p-2 rounded" }, `${sale.feeConfig.mode === 'link' ? 'Link Web' : 'Presencial'} - ${sale.feeConfig.brand === 'visa_master' ? 'Visa/Master' : 'Outras Bandeiras'} (${sale.feeConfig.percent}%)`)
                    )
                ),

                // Entrada a Prazo
                (sale.saleType === 'prazo' || !sale.saleType) && sale.entryAmount > 0 && React.createElement('div', { className: "bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center relative z-10" },
                    React.createElement('div', { className: "flex items-center gap-2" }, React.createElement(Wallet, { size: 18, className: "text-emerald-600" }), React.createElement('span', { className: "text-sm font-bold text-emerald-800" }, "Valor de Entrada")),
                    React.createElement('span', { className: "font-bold text-emerald-800 text-lg" }, formatCurrency(sale.entryAmount))
                ),

                // Parcelas a Prazo
                (sale.saleType === 'prazo' || !sale.saleType) && React.createElement('div', { className: "space-y-3 relative z-10" },
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase flex items-center gap-2" }, React.createElement(Calendar, { size: 14 }), "Parcelamento"),
                    sale.installments && sale.installments.map((inst, idx) => {
                        const isOverdue = !inst.paid && inst.dueDate < getBrazilDateString();
                        let paidDisplayDate = '';
                        if (inst.paid && inst.paidAt) paidDisplayDate = formatDate(inst.paidAt);
                        
                        return React.createElement('div', { key: idx, className: "bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-sm" },
                            React.createElement('div', { className: "flex justify-between items-center" },
                                React.createElement('div', { className: "flex items-center gap-3" },
                                    sale.status !== 'canceled' && React.createElement('button', { onClick: () => onPay(sale, idx), className: `rounded-full p-2 transition-colors shadow-sm ${inst.paid ? 'bg-emerald-500 text-white cursor-default' : 'bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600'}` }, React.createElement(CheckCircle, { size: 20 })),
                                    React.createElement('div', null,
                                        React.createElement('p', { className: "text-sm font-bold text-slate-700" }, `Parcela ${inst.number}`),
                                        React.createElement('div', { className: "flex flex-col" },
                                            inst.paid && inst.paidAt ? React.createElement('span', { className: "text-xs text-emerald-600 font-bold" }, `Pago dia ${paidDisplayDate}`) : null,
                                            React.createElement('span', { className: `text-[11px] ${inst.paid ? 'text-slate-400' : isOverdue && sale.status !== 'canceled' ? 'text-red-500 font-bold' : 'text-slate-500'}` }, inst.paid ? `Vencia dia ${formatDate(inst.dueDate)}` : `Vence dia ${formatDate(inst.dueDate)}`)
                                        )
                                    )
                                ),
                                React.createElement('p', { className: `font-bold text-lg ${sale.status === 'canceled' ? 'text-slate-400 line-through' : 'text-slate-800'}` }, formatCurrency(inst.amount))
                            ),
                            inst.history && inst.history.length > 0 && React.createElement('div', { className: "mt-1 pt-3 border-t border-slate-100 text-xs bg-slate-50 -mx-4 px-4 pb-2" },
                                React.createElement('p', { className: "text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center gap-1" }, React.createElement(History, { size: 12 }), "Histórico de Pagamentos"),
                                inst.history.map((h, hIdx) => React.createElement('div', { key: hIdx, className: "flex justify-between items-center text-slate-600 py-1.5 border-b border-slate-100 last:border-0" },
                                    React.createElement('div', { className: "flex items-center gap-1" },
                                        React.createElement('span', null, h.type === 'abatement' ? 'Abatimento autom.' : formatDate(h.date)),
                                        h.type !== 'abatement' && sale.status !== 'canceled' && React.createElement('button', { onClick: (e) => { e.stopPropagation(); onOpenWA('recibo', sale, inst, h); }, className: "text-green-500 hover:text-green-600 bg-green-50 p-1 rounded transition-colors ml-1", title: "Enviar Recibo" }, React.createElement(MessageCircle, { size: 12 })),
                                        h.type !== 'abatement' && sale.status !== 'canceled' && React.createElement('button', { onClick: () => onDeletePayment(sale.id, idx, hIdx, h), className: "text-red-400 hover:text-red-600 bg-red-50 p-1 rounded transition-colors" }, React.createElement(XCircle, { size: 12 }))
                                    ),
                                    React.createElement('span', { className: "font-bold" }, formatCurrency(h.amount))
                                ))
                            ),
                            !inst.paid && sale.status !== 'canceled' ? React.createElement('div', { className: "flex gap-2 mt-2" },
                                React.createElement('button', { onClick: () => onEdit({ open: true, saleId: sale.id, installmentIndex: idx, data: inst }), className: "flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors" }, React.createElement(Edit2, { size: 14 }), "Ajustar Valor"),
                                sale.customerPhone && React.createElement('button', { onClick: () => onOpenWA('cobranca', sale, inst, null), className: "flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors shadow-sm" }, React.createElement(MessageCircle, { size: 14 }), "Cobrar")
                            ) : (inst.paid && sale.status !== 'canceled') ? React.createElement('div', { className: "flex gap-2 mt-2" },
                                sale.customerPhone && React.createElement('button', { onClick: () => onOpenWA('recibo', sale, inst, null), className: "flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm border border-emerald-100" }, React.createElement(MessageCircle, { size: 14 }), "Enviar Recibo")
                            ) : null
                        );
                    })
                )
            ),
            // Footer com botões de gestão da Venda
            React.createElement('div', { className: "p-4 border-t border-slate-100 bg-white rounded-b-2xl shrink-0 flex flex-col gap-2" },
                sale.status !== 'canceled' && React.createElement('button', { onClick: () => onCancelSale(sale.id), className: "w-full py-3 text-orange-600 text-sm font-bold bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors border border-orange-100 flex items-center justify-center gap-2" }, React.createElement(PackageMinus, { size: 16 }), "Cancelar Venda e Voltar Estoque"),
                React.createElement('button', { onClick: () => { onDeleteSale('sale', sale.id); onClose(); }, className: "w-full py-3 text-red-400 hover:text-red-600 text-sm font-bold bg-white hover:bg-red-50 rounded-xl transition-colors border border-transparent flex items-center justify-center gap-2" }, React.createElement(Trash2, { size: 16 }), "Excluir Registro Permanentemente")
            )
        )
    );
};

export { EditInstallmentModal, ProductDetailsModal, CustomerFormModal, NewSaleModal, SaleDetailsModal };
