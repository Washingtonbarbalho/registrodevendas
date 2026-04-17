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
    const [baseUnitPrice, setBaseUnitPrice] = useState(0); // Preço original do produto
    const [currentQty, setCurrentQty] = useState(1);
    const [currentCost, setCurrentCost] = useState(0); // Mantido oculto na logica
    const [currentPrice, setCurrentPrice] = useState(''); // Preço cobrado na venda
    const [currentDiscount, setCurrentDiscount] = useState(''); // Desconto unitário manual
    
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
    const [cardMode, setCardMode] = useState('presencial'); // 'presencial', 'link'
    const [cardBrand, setCardBrand] = useState('visa_master'); // 'visa_master', 'outras'
    const [feeType, setFeeType] = useState('sem_juros'); // 'sem_juros', 'com_juros'
    const [feePercent, setFeePercent] = useState('0,00');

    useEffect(() => { 
        if (isOpen) { 
            const today = getBrazilDateString(); 
            setSaleDate(today); setFirstDueDate(addDays(today, 30)); setStep(1); 
            setCart([]); setCustomerId(''); setEntryAmount(''); setSaleType('prazo'); 
            setCustomerSearch(''); setProductSearch(''); setCurrentQty(1); 
            setCurrentCost(0); setCurrentPrice(''); setBaseUnitPrice(0); setCurrentDiscount(''); 
            setShowCustomerList(false); setShowProductList(false);
            setDirectMethod('pix'); setCardInstallments(1); setCardMode('presencial'); setCardBrand('visa_master'); setFeeType('sem_juros'); setFeePercent('0,00');
        } 
    }, [isOpen]);

    useEffect(() => { let daysToAdd = 30; if (frequency === 'weekly') daysToAdd = 7; else if (frequency === 'biweekly') daysToAdd = 15; setFirstDueDate(addDays(saleDate, daysToAdd)); }, [frequency, saleDate]);

    // Calcula taxa de cartão padrão automaticamente usando as TABELAS EXATAS
    useEffect(() => {
        if(saleType !== 'direct' || (directMethod !== 'credit' && directMethod !== 'debit')) return;
        
        // =========================================================================
        // TABELA EXATA DE TAXAS (Mapeado das imagens fornecidas)
        // Array position: index 1 = 1x, index 2 = 2x ... index 12 = 12x
        // =========================================================================
        const TAXAS = {
            presencial: {
                debito: { visa_master: 1.37, outras: 2.58 },
                credito: {
                    visa_master: [0, 3.15, 5.39, 6.12, 6.85, 7.57, 8.28, 8.99, 9.69, 10.38, 11.06, 11.74, 12.40],
                    outras:      [0, 4.91, 6.47, 7.20, 7.92, 8.63, 9.33, 10.03, 10.72, 11.41, 12.08, 12.75, 13.41]
                }
            },
            link: {
                debito: 4.20, // Assumindo valor de 1x, pois não há tarifa explícita de débito na imagem do link
                credito: [0, 4.20, 6.09, 7.01, 7.91, 8.80, 9.67, 12.59, 13.42, 14.25, 15.06, 15.87, 16.66]
            }
        };

        let percent = 0;
        if(cardMode === 'presencial') {
            if(directMethod === 'debit') {
                percent = cardBrand === 'visa_master' ? TAXAS.presencial.debito.visa_master : TAXAS.presencial.debito.outras;
            } else {
                const inst = parseInt(cardInstallments) || 1;
                const safeInst = Math.min(Math.max(inst, 1), 12); // Garante que fica entre 1 e 12
                percent = cardBrand === 'visa_master' ? TAXAS.presencial.credito.visa_master[safeInst] : TAXAS.presencial.credito.outras[safeInst];
            }
        } else { // link
            if(directMethod === 'debit') {
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
    const entryValue = parseMoney(entryAmount) || 0;
    const totalRemaining = Math.max(0, totalCartValue - entryValue);

    // --- Lógica de Descontos Automáticos ---
    const handleSelectProduct = (p) => {
        setSelectedProductId(p.id); 
        setProductSearch(`#${p.code} - ${p.name}`); 
        setShowProductList(false);
        
        const cost = p.costPrice || 0;
        let price = p.salePrice || 0;
        
        const today = getBrazilDateString();
        if(p.isPromo && p.promoStart && p.promoEnd && today >= p.promoStart && today <= p.promoEnd) {
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
        
        if(!selectedProductId || unitPrice < 0 || qty <= 0) return;
        
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
        setSelectedProductId(''); setCurrentQty(1); setCurrentCost(0); setCurrentPrice(''); setBaseUnitPrice(0); setCurrentDiscount(''); setProductSearch('');
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
            // CAIXA E CARTÃO - LOGICA DE TAXAS
            let finalSalePrice = totalCartValue;
            let feeObj = null;

            if (directMethod === 'credit' || directMethod === 'debit') {
                const feeP = parseMoney(feePercent);
                const feeVal = totalRemaining * (feeP / 100);

                feeObj = {
                    applied: feeP > 0,
                    percent: feeP,
                    value: feeVal,
                    type: feeType, // 'sem_juros' ou 'com_juros'
                    mode: cardMode,
                    brand: cardBrand
                };

                if (feeType === 'com_juros') {
                    finalSalePrice += feeVal; // Adiciona a taxa no valor total da venda repassada pro cliente
                }
            }

            saleData = { 
                ...saleData, 
                paymentMethod: directMethod, 
                entryAmount: entryValue, 
                cardAmount: finalSalePrice - entryValue, // O que vai ser cobrado do cartão
                cardInstallments: directMethod === 'credit' ? parseInt(cardInstallments) : 1, 
                installments: [], 
                status: 'completed',
                totalPrice: finalSalePrice, // Preço final ajustado
                feeConfig: feeObj
            };
        }
        onSave(saleData); onClose();
    };

    if (!isOpen) return null;
    return React.createElement('div', { className: "fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" },
        React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-md p-6 animate-fade-in shadow-2xl flex flex-col max-h-[90vh]" },
            React.createElement('div', { className: "flex items-center justify-between mb-4 shrink-0" }, React.createElement('h2', { className: "text-xl font-bold text-slate-800 flex items-center gap-2" }, React.createElement(ShoppingBag, { className: "text-yellow-600" }), "Nova Venda"), React.createElement('div', { className: "flex gap-1" }, [1,2,3].map(i => React.createElement('div', { key: i, className: `h-2 w-8 rounded-full ${step >= i ? 'bg-yellow-500' : 'bg-slate-200'}` })))),
            React.createElement('div', { className: "flex-1 overflow-y-auto pr-1 no-scrollbar space-y-4" },
                step === 1 && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                    React.createElement('div', { className: "bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3" },
                        React.createElement('label', { className: "text-xs font-bold text-slate-400 uppercase" }, "Buscar Cliente"),
                        React.createElement('div', { className: "relative" },
                            React.createElement('div', { className: "relative" },
                                React.createElement(Search, { className: "absolute left-3 top-3.5 text-slate-400", size: 16 }),
                                React.createElement('input', {
                                    className: "w-full p-3 pl-9 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500",
                                    placeholder: "Digite o nome para buscar...",
                                    value: customerSearch,
                                    onChange: e => { setCustomerSearch(e.target.value); setCustomerId(''); setShowCustomerList(true); },
                                    onFocus: () => setShowCustomerList(true),
                                    onBlur: () => setTimeout(() => setShowCustomerList(false), 200)
                                }),
                                customerId && React.createElement(CheckCircle, { className: "absolute right-3 top-3 text-green-500", size: 20 })
                            ),
                            showCustomerList && !customerId && React.createElement('div', { className: "absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto" },
                                filteredCustomers.length > 0 ? filteredCustomers.map(c => 
                                    React.createElement('div', { 
                                        key: c.id, 
                                        className: "p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer",
                                        onClick: () => { setCustomerId(c.id); setCustomerSearch(c.name); setShowCustomerList(false); }
                                    }, 
                                        React.createElement('p', { className: "font-bold text-slate-800 text-sm" }, c.name),
                                        c.phone && React.createElement('p', { className: "text-xs text-slate-500" }, c.phone)
                                    )
                                ) : React.createElement('div', { className: "p-3 text-slate-500 text-sm text-center" }, "Nenhum cliente encontrado.")
                            )
                        )
                    )
                ),
                step === 2 && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                    React.createElement('div', { className: "bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3" },
                        React.createElement('label', { className: "text-xs font-bold text-slate-400 uppercase" }, "Adicionar Produto"),
                        React.createElement('div', { className: "relative" },
                            React.createElement('div', { className: "relative" },
                                React.createElement(Search, { className: "absolute left-3 top-3.5 text-slate-400", size: 16 }),
                                React.createElement('input', {
                                    className: "w-full p-3 pl-9 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500",
                                    placeholder: "Buscar por nome ou código...",
                                    value: productSearch,
                                    onChange: e => { setProductSearch(e.target.value); setSelectedProductId(''); setShowProductList(true); },
                                    onFocus: () => setShowProductList(true),
                                    onBlur: () => setTimeout(() => setShowProductList(false), 200)
                                }),
                                selectedProductId && React.createElement(CheckCircle, { className: "absolute right-3 top-3 text-green-500", size: 20 })
                            ),
                            showProductList && !selectedProductId && React.createElement('div', { className: "absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto" },
                                filteredProducts.length > 0 ? filteredProducts.map(p => {
                                    const today = getBrazilDateString();
                                    const activePromo = p.isPromo && today >= p.promoStart && today <= p.promoEnd;
                                    return React.createElement('div', { 
                                        key: p.id, 
                                        className: "p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex justify-between items-center",
                                        onClick: () => handleSelectProduct(p)
                                    }, 
                                        React.createElement('div', null,
                                            React.createElement('p', { className: "font-bold text-slate-800 text-sm flex items-center gap-2" }, p.name, activePromo && React.createElement(Tag, { size: 12, className: "text-purple-500" })),
                                            React.createElement('span', { className: "text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded mt-1 inline-block" }, `#${p.code}`)
                                        ),
                                        React.createElement('div', { className: "text-right" },
                                            activePromo ? React.createElement('p', { className: "text-xs font-bold text-purple-600" }, formatCurrency(p.promoPrice)) : React.createElement('p', { className: "text-xs font-bold text-slate-800" }, formatCurrency(p.salePrice)),
                                            React.createElement('p', { className: "text-[10px] text-slate-400" }, `Est: ${p.quantity}`)
                                        )
                                    );
                                }) : React.createElement('div', { className: "p-3 text-slate-500 text-sm text-center" }, "Nenhum produto encontrado.")
                            )
                        ),
                        React.createElement('div', { className: "flex gap-2" },
                            React.createElement('div', { className: "w-16" }, React.createElement('label', { className: "block text-[10px] font-bold text-slate-400 uppercase mb-1" }, "Qtd"), React.createElement('input', { type: "number", min: "1", className: "w-full p-3 border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-yellow-500 px-1", value: currentQty, onChange: e => setCurrentQty(e.target.value) })),
                            React.createElement('div', { className: "flex-1" }, React.createElement('label', { className: "block text-[10px] font-bold text-slate-400 uppercase mb-1" }, "Desconto"), React.createElement(MoneyInput, { placeholder: "0,00", value: currentDiscount, onChange: handleDiscountChange, className: "w-full p-3 pl-8 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm text-red-500 font-bold" })),
                            React.createElement('div', { className: "flex-1" }, React.createElement('label', { className: "block text-[10px] font-bold text-slate-400 uppercase mb-1" }, "Venda R$"), React.createElement(MoneyInput, { placeholder: "0,00", value: currentPrice, onChange: handlePriceChange, className: "w-full p-3 pl-8 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm font-bold text-slate-800" }))
                        ),
                        React.createElement('button', { onClick: handleAddItem, disabled: !selectedProductId || currentQty < 1, className: "w-full py-3 bg-slate-800 text-white rounded-lg font-bold text-sm disabled:opacity-50 hover:bg-slate-700 transition-colors flex justify-center gap-2 items-center" }, React.createElement(PlusCircle, { size: 16 }), "Adicionar no Carrinho")
                    ),
                    React.createElement('div', { className: "space-y-2" },
                        React.createElement('label', { className: "text-xs font-bold text-slate-400 uppercase" }, `Carrinho (${cart.reduce((a,b)=>a+(parseInt(b.quantity)||1),0)} itens)`),
                        cart.length === 0 ? React.createElement('p', { className: "text-center text-slate-400 text-sm py-4 italic" }, "Nenhum produto adicionado.") : cart.map(item => React.createElement('div', { key: item.tempId, className: "flex justify-between items-center bg-yellow-50 p-3 rounded-lg border border-yellow-200 shadow-sm" }, React.createElement('div', null, React.createElement('p', { className: "font-bold text-sm text-slate-800 leading-tight mb-1" }, `${item.quantity}x ${item.productName}`), React.createElement('div', { className: "flex items-center gap-2" }, React.createElement('p', { className: "text-xs font-bold text-slate-600" }, `${formatCurrency(item.price)}`), item.unitDiscount > 0 && React.createElement('span', { className: "bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded font-bold" }, `-${formatCurrency(item.unitDiscount * item.quantity)}`))), React.createElement('button', { onClick: () => handleRemoveItem(item.tempId), className: "text-red-400 hover:text-red-600 p-2 bg-white rounded-full shadow-sm" }, React.createElement(Trash2, { size: 16 })))),
                        cart.length > 0 && React.createElement('div', { className: "text-right font-bold text-xl text-slate-800 pt-3 border-t border-slate-100 mt-2" }, `Total: ${formatCurrency(totalCartValue)}`)
                    )
                ),
                step === 3 && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                    React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1" }, React.createElement(Calendar, { size: 12 }), " Data da Venda"), React.createElement('input', { type: "date", className: "w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500", value: saleDate, onChange: e => setSaleDate(e.target.value) })),
                    React.createElement('div', { className: "flex bg-slate-100 p-1 rounded-xl mb-2" },
                        React.createElement('button', { onClick: () => setSaleType('prazo'), className: `flex-1 py-2 text-sm font-bold rounded-lg transition-all ${saleType === 'prazo' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}` }, "A Prazo (Fiado)"),
                        React.createElement('button', { onClick: () => setSaleType('direct'), className: `flex-1 py-2 text-sm font-bold rounded-lg transition-all ${saleType === 'direct' ? 'bg-emerald-500 shadow text-white' : 'text-slate-400'}` }, "Caixa / Cartão")
                    ),
                    saleType === 'prazo' && React.createElement('div', { className: "animate-fade-in space-y-4" },
                        React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Entrada (Opcional)"), React.createElement(MoneyInput, { value: entryAmount, onChange: setEntryAmount })),
                        totalRemaining > 0 && React.createElement(React.Fragment, null,
                            React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Frequência"), React.createElement('select', { className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: frequency, onChange: e => setFrequency(e.target.value) }, React.createElement('option', { value: "weekly" }, "Semanal"), React.createElement('option', { value: "biweekly" }, "Quinzenal"), React.createElement('option', { value: "monthly" }, "Mensal"))),
                            React.createElement('div', { className: "grid grid-cols-2 gap-4" },
                                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Parcelas"), React.createElement('select', { className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: installmentsCount, onChange: e => setInstallmentsCount(e.target.value) }, Array.from({length: 12}, (_, i) => i + 1).map(n => React.createElement('option', { key: n, value: n }, `${n}x`)))),
                                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "1ª Data"), React.createElement('input', { type: "date", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: firstDueDate, onChange: e => setFirstDueDate(e.target.value) }))
                            )
                        )
                    ),
                    saleType === 'direct' && React.createElement('div', { className: "animate-fade-in space-y-4" },
                        React.createElement('div', { className: "grid grid-cols-2 gap-3" },
                            ['pix','money','debit','credit'].map(m => React.createElement('button', { key: m, onClick: () => setDirectMethod(m), className: `p-4 rounded-xl border flex flex-col items-center gap-2 ${directMethod === m ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}` }, React.createElement(m === 'pix' ? QrCode : m === 'money' ? Banknote : CreditCard, { size: 24 }), React.createElement('span', { className: "text-xs font-bold uppercase" }, m === 'money' ? 'Dinheiro' : m === 'debit' ? 'Débito' : m === 'credit' ? 'Crédito' : 'PIX')))
                        ),
                        (directMethod === 'credit' || directMethod === 'debit') && React.createElement('div', { className: "space-y-4 pt-4 border-t border-slate-100" },
                            React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Entrada (Dinheiro/Pix) - Opcional"), React.createElement(MoneyInput, { value: entryAmount, onChange: setEntryAmount })),
                            directMethod === 'credit' && React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Parcelas no Cartão"), React.createElement('select', { className: "w-full p-3 border border-slate-200 rounded-lg outline-none", value: cardInstallments, onChange: e => setCardInstallments(e.target.value) }, React.createElement('option', { value: "1" }, "1x (À Vista)"), Array.from({length: 11}, (_, i) => i + 2).map(n => React.createElement('option', { key: n, value: n }, `${n}x`)))),
                            
                            // NOVO: BLOCO DE TAXAS DE CARTÃO
                            React.createElement('div', { className: "bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-3" },
                                React.createElement('p', { className: "text-xs font-bold text-orange-700 uppercase flex items-center gap-1" }, React.createElement(BadgePercent, { size: 14 }), "Configuração de Taxas"),
                                React.createElement('div', { className: "grid grid-cols-2 gap-3" },
                                    React.createElement('div', null, React.createElement('label', { className: "block text-[10px] font-bold text-orange-600 uppercase mb-1" }, "Modalidade"), React.createElement('select', { className: "w-full p-2 border border-orange-200 rounded text-sm outline-none text-slate-700", value: cardMode, onChange: e => setCardMode(e.target.value) }, React.createElement('option', { value: "presencial" }, "Presencial"), React.createElement('option', { value: "link" }, "Link Web"))),
                                    cardMode === 'presencial' ? React.createElement('div', null, React.createElement('label', { className: "block text-[10px] font-bold text-orange-600 uppercase mb-1" }, "Bandeira"), React.createElement('select', { className: "w-full p-2 border border-orange-200 rounded text-sm outline-none text-slate-700", value: cardBrand, onChange: e => setCardBrand(e.target.value) }, React.createElement('option', { value: "visa_master" }, "Visa/Mastercard"), React.createElement('option', { value: "outras" }, "Outras (Elo/Amex...)"))) : React.createElement('div', null)
                                ),
                                React.createElement('div', { className: "grid grid-cols-2 gap-3" },
                                    React.createElement('div', null, React.createElement('label', { className: "block text-[10px] font-bold text-orange-600 uppercase mb-1" }, "Repasse"), React.createElement('select', { className: "w-full p-2 border border-orange-200 rounded text-sm outline-none text-slate-700 font-bold", value: feeType, onChange: e => setFeeType(e.target.value) }, React.createElement('option', { value: "sem_juros" }, "Sem Juros (Você Paga)"), React.createElement('option', { value: "com_juros" }, "Com Juros (Cliente Paga)"))),
                                    React.createElement('div', null, React.createElement('label', { className: "block text-[10px] font-bold text-orange-600 uppercase mb-1" }, "Taxa Aplicada (%)"), React.createElement('div', { className: "relative" }, React.createElement('input', { type: "text", className: "w-full p-2 pr-6 border border-orange-200 rounded text-sm outline-none font-bold text-slate-700", value: feePercent, onChange: e => setFeePercent(e.target.value) }), React.createElement('span', { className: "absolute right-2 top-2 text-slate-400 text-sm" }, "%")))
                                ),
                                React.createElement('div', { className: "text-[10px] bg-orange-100 p-2 rounded text-orange-800 leading-tight" }, 
                                    `Valor da transação: ${formatCurrency(totalRemaining)}`, React.createElement('br'),
                                    feeType === 'sem_juros' ? React.createElement('strong', null, `A loja pagará ${formatCurrency(totalRemaining * (parseMoney(feePercent)/100))} de taxa.`) : React.createElement('strong', null, `O cliente pagará ${formatCurrency(totalRemaining * (parseMoney(feePercent)/100))} a mais na venda.`)
                                )
                            )
                        )
                    )
                )
            ),
            React.createElement('div', { className: "flex gap-3 mt-4 pt-4 border-t border-slate-100 shrink-0" },
                step === 1 && React.createElement(React.Fragment, null, React.createElement('button', { onClick: onClose, className: "flex-1 p-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl" }, "Cancelar"), React.createElement('button', { onClick: () => setStep(2), disabled: !customerId, className: "flex-1 p-3 bg-slate-900 text-white font-bold rounded-xl disabled:opacity-50" }, "Próximo")),
                step === 2 && React.createElement(React.Fragment, null, React.createElement('button', { onClick: () => setStep(1), className: "flex-1 p-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl" }, "Voltar"), React.createElement('button', { onClick: () => setStep(3), disabled: cart.length === 0, className: "flex-1 p-3 bg-slate-900 text-white font-bold rounded-xl disabled:opacity-50" }, "Pagamento")),
                step === 3 && React.createElement(React.Fragment, null, React.createElement('button', { onClick: () => setStep(2), className: "flex-1 p-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl" }, "Voltar"), React.createElement('button', { onClick: handleFinish, className: "flex-1 p-3 bg-yellow-500 text-white font-bold rounded-xl shadow-lg shadow-yellow-200 hover:bg-yellow-600" }, "Finalizar Venda"))
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
