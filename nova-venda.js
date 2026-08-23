import React, { useState, useEffect } from 'https://esm.sh/react@18.2.0';
import { ChevronLeft, User, UserPlus, X, Search, CheckCircle, ShoppingBag, Tag, PlusCircle, Trash2, CreditCard, Calendar, QrCode, Banknote, Copy, BadgePercent, RefreshCw, ThumbsUp, ShieldAlert } from 'https://esm.sh/lucide-react@0.292.0';
import { db, APP_ID } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { formatCurrency, parseMoney, maskPhone, getBrazilDateString, addDays, generatePixPayload, analyzeCustomerCredit } from './utils.js';
import { MoneyInput } from './components.js';
import { getCardRate, getCarnetRate, normalizePaymentSettings } from './payment-settings.js';
import QRCode from 'https://esm.sh/qrcode@1.5.4';

const LocalPixQrCode = ({ payload }) => {
    const [dataUrl, setDataUrl] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        setDataUrl('');
        setError('');
        if (!payload) return () => { active = false; };

        QRCode.toDataURL(payload, { width: 180, margin: 1, errorCorrectionLevel: 'M' })
            .then(nextDataUrl => { if (active) setDataUrl(nextDataUrl); })
            .catch(qrError => {
                console.error('Erro ao gerar QR Code PIX localmente:', qrError);
                if (active) setError('Não foi possível gerar a imagem. Copie o código PIX abaixo.');
            });

        return () => { active = false; };
    }, [payload]);

    return dataUrl
        ? React.createElement('img', {
            src: dataUrl,
            alt: 'QR Code PIX',
            className: 'mb-4 rounded-lg shadow-sm border border-emerald-200 w-32 h-32'
        })
        : React.createElement('div', {
            className: 'mb-4 flex h-32 w-32 items-center justify-center rounded-lg border border-emerald-200 bg-white p-3 text-center text-[10px] text-slate-500'
        }, error || 'Gerando QR Code com segurança...');
};

export const NewSaleScreen = ({ mode, onClose, customers, products, sales, onSaveSale, userProfile, user, paymentSettings }) => {
    useEffect(() => { window.scrollTo(0, 0); }, []);

    const [customerId, setCustomerId] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerList, setShowCustomerList] = useState(false);
    const [isAddingCustomer, setIsAddingCustomer] = useState(false);
    
    const [newCustName, setNewCustName] = useState('');
    const [newCustPhone, setNewCustPhone] = useState('');
    const [newCustProfession, setNewCustProfession] = useState('');
    const [newCustIncome, setNewCustIncome] = useState('');
    const [savingCustomer, setSavingCustomer] = useState(false);

    const [productSearch, setProductSearch] = useState('');
    const [showProductList, setShowProductList] = useState(false);
    const [cart, setCart] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [baseUnitPrice, setBaseUnitPrice] = useState(0); 
    const [currentQty, setCurrentQty] = useState(1);
    const [currentCost, setCurrentCost] = useState(0); 
    const [currentPrice, setCurrentPrice] = useState(''); 
    const [currentDiscount, setCurrentDiscount] = useState(''); 
    
    const [saleDate, setSaleDate] = useState(getBrazilDateString()); 
    const saleType = mode === 'prazo' ? 'prazo' : 'direct';
    const [entryAmount, setEntryAmount] = useState('');
    
    const [frequency, setFrequency] = useState('monthly');
    const [installmentsCount, setInstallmentsCount] = useState(1);
    const [firstDueDate, setFirstDueDate] = useState('');
    
    const [directMethod, setDirectMethod] = useState('pix');
    const [cardInstallments, setCardInstallments] = useState(1);
    const [cardMode, setCardMode] = useState('presencial');
    const [cardBrand, setCardBrand] = useState('visa_master');
    const [feeType, setFeeType] = useState('sem_juros'); 
    const [feePercent, setFeePercent] = useState('0,00');

    const [isAnalyzingCredit, setIsAnalyzingCredit] = useState(false);
    const [approvedSaleData, setApprovedSaleData] = useState(null);
    const [creditModal, setCreditModal] = useState({ open: false, result: null, pendingSaleData: null, manualReason: '' });

    useEffect(() => { 
        const today = getBrazilDateString(); 
        setSaleDate(today); 
        setFirstDueDate(addDays(today, 30)); 
    }, []);

    useEffect(() => { 
        let daysToAdd = 30; 
        if (frequency === 'weekly') daysToAdd = 7; 
        else if (frequency === 'biweekly') daysToAdd = 15; 
        setFirstDueDate(addDays(saleDate, daysToAdd)); 
    }, [frequency, saleDate]);

    useEffect(() => {
        if(saleType !== 'direct' || (directMethod !== 'credit' && directMethod !== 'debit')) return;
        const percent = getCardRate(paymentSettings, {
            mode: cardMode,
            method: directMethod,
            brand: cardBrand,
            installments: cardInstallments
        });
        setFeePercent(percent.toFixed(2).replace('.', ','));
    }, [directMethod, cardMode, cardBrand, cardInstallments, saleType, paymentSettings]);

    const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()));
    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.includes(productSearch));
    
    const totalCartValue = cart.reduce((acc, item) => acc + item.price, 0);
    const acceptsEntry = saleType === 'prazo' || directMethod === 'credit' || directMethod === 'debit';
    const entryValue = acceptsEntry ? parseMoney(entryAmount) || 0 : 0;
    const totalRemaining = Math.max(0, totalCartValue - entryValue);
    const normalizedPaymentSettings = normalizePaymentSettings(paymentSettings);
    const selectedInstallmentsCount = Math.min(12, Math.max(1, parseInt(installmentsCount, 10) || 1));
    const carnetInterestPercent = saleType === 'prazo'
        ? getCarnetRate(normalizedPaymentSettings, frequency, selectedInstallmentsCount)
        : 0;
    const carnetInterestValue = saleType === 'prazo' ? totalRemaining * (carnetInterestPercent / 100) : 0;
    const totalFinancedAmount = totalRemaining + carnetInterestValue;
    const carnetInterestLabel = carnetInterestPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    const isCardPayment = saleType === 'direct' && (directMethod === 'credit' || directMethod === 'debit');
    const currentFeePercent = isCardPayment ? parseMoney(feePercent) : 0;
    const currentFeeValue = isCardPayment ? totalRemaining * (currentFeePercent / 100) : 0;
    const totalCustomerPays = saleType === 'prazo'
        ? totalCartValue + carnetInterestValue
        : totalCartValue + (isCardPayment && feeType === 'com_juros' ? currentFeeValue : 0);
    const netAmountToCompany = totalCustomerPays - currentFeeValue;

    const handleSaveInlineCustomer = async () => {
        if (!newCustName.trim()) return alert("Digite o nome do cliente.");
        setSavingCustomer(true);
        try {
            const dataToSave = {
                name: newCustName.toUpperCase(),
                phone: newCustPhone,
                profession: newCustProfession.toUpperCase(),
                income: parseMoney(newCustIncome),
                createdAt: serverTimestamp()
            };
            const docRef = await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'customers'), dataToSave);
            setCustomerId(docRef.id);
            setCustomerSearch(newCustName.toUpperCase());
            setIsAddingCustomer(false);
            setNewCustName(''); setNewCustPhone(''); setNewCustProfession(''); setNewCustIncome('');
        } catch (e) {
            console.error("Erro:", e); alert("Erro ao salvar cliente.");
        } finally {
            setSavingCustomer(false);
        }
    };

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
        setCurrentCost(cost); setBaseUnitPrice(price); setCurrentPrice(formatCurrency(price).replace('R$', '').trim()); setCurrentDiscount('');
    };

    const handleDiscountChange = (valStr) => {
        setCurrentDiscount(valStr);
        const discountVal = parseMoney(valStr);
        const newPrice = Math.max(0, baseUnitPrice - discountVal);
        setCurrentPrice(formatCurrency(newPrice).replace('R$', '').trim());
    };

    const handlePriceChange = (valStr) => {
        setCurrentPrice(valStr);
        const priceVal = parseMoney(valStr);
        const discountVal = Math.max(0, baseUnitPrice - priceVal);
        setCurrentDiscount(formatCurrency(discountVal).replace('R$', '').trim());
    };

    const handleAddItem = () => {
        const qty = Number(currentQty);
        const unitPrice = parseMoney(currentPrice);
        const unitDiscount = parseMoney(currentDiscount);
        
        if (!Number.isInteger(qty) || qty < 1) return alert("Informe uma quantidade inteira maior que zero.");
        if(!selectedProductId || unitPrice < 0 || qty <= 0) return;
        
        const prod = products.find(p => p.id === selectedProductId);
        if (!prod) return alert("O produto selecionado não foi encontrado. Atualize a página e tente novamente.");

        const availableQuantity = Number(prod.quantity);
        if (!Number.isInteger(availableQuantity) || availableQuantity < 0) {
            return alert(`${prod.name}: o saldo de estoque está inválido e precisa ser corrigido.`);
        }
        const quantityAlreadyInCart = cart.reduce((total, item) => (
            String(item.productId) === String(prod.id) ? total + Number(item.quantity || 0) : total
        ), 0);
        const remainingQuantity = Math.max(0, availableQuantity - quantityAlreadyInCart);
        if (qty > remainingQuantity) {
            return alert(`${prod.name}: estoque disponível é ${remainingQuantity} un. para adicionar ao carrinho.`);
        }

        const totalLineCost = currentCost * qty;
        const totalLinePrice = unitPrice * qty;
        
        const newItem = { 
            tempId: Date.now(), productId: prod.id, productName: prod.name, productCode: prod.code, 
            quantity: qty, cost: totalLineCost, price: totalLinePrice, unitPrice: unitPrice, 
            unitCost: currentCost, unitDiscount: unitDiscount 
        };
        
        setCart([...cart, newItem]);
        setSelectedProductId(''); setCurrentQty(1); setCurrentCost(0); setCurrentPrice(''); setBaseUnitPrice(0); setCurrentDiscount(''); setProductSearch('');
    };

    const handleRemoveItem = (tempId) => { setCart(cart.filter(item => item.tempId !== tempId)); };
    
    const calculateInstallments = () => {
        const total = totalFinancedAmount;
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
        if (!customerId) return alert("Selecione um cliente.");
        if (cart.length === 0) return alert("Adicione ao menos um produto no carrinho.");
        if (entryValue > totalCartValue) return alert("A entrada não pode ser maior que o valor total dos produtos.");

        const customer = customers.find(c => c.id === customerId);
        const cName = customer ? customer.name : customerSearch;
        const cPhone = customer ? customer.phone : "";
        
        const sumDiscount = cart.reduce((acc, i) => acc + (i.unitDiscount * i.quantity), 0);

        let saleData = { 
            customerId: customerId, customerName: cName, customerPhone: cPhone, 
            items: cart, totalCost: cart.reduce((acc, i) => acc + i.cost, 0), totalPrice: totalCartValue, totalDiscount: sumDiscount,
            saleDate: saleDate, saleType: saleType, status: 'active'
        };

        if (saleType === 'prazo') {
            const prazoSaleData = {
                ...saleData,
                productsTotal: totalCartValue,
                totalPrice: totalCartValue + carnetInterestValue,
                installmentInterest: {
                    applied: carnetInterestPercent > 0 && carnetInterestValue > 0,
                    percent: carnetInterestPercent,
                    value: carnetInterestValue,
                    baseAmount: totalRemaining,
                    frequency,
                    installmentsCount: selectedInstallmentsCount
                }
            };
            setIsAnalyzingCredit(true); 

            setTimeout(() => {
                const requestedAmount = totalFinancedAmount;
                const initialAnalysis = analyzeCustomerCredit(customer, requestedAmount, sales);
                const interestMultiplier = 1 + (carnetInterestPercent / 100);
                const analysis = initialAnalysis.suggestedEntry > 0 && interestMultiplier > 1
                    ? { ...initialAnalysis, suggestedEntry: initialAnalysis.suggestedEntry / interestMultiplier }
                    : initialAnalysis;

                if (!analysis.approved) {
                    setIsAnalyzingCredit(false);
                    setCreditModal({ open: true, result: analysis, pendingSaleData: prazoSaleData, manualReason: '' });
                    return;
                }

                const finalInstallments = calculateInstallments();
                const finalSaleDataToSave = { 
                    ...prazoSaleData,
                    entryAmount: entryValue, frequency, installmentsCount: finalInstallments.length, installments: finalInstallments, 
                    status: finalInstallments.length === 0 && entryValue >= totalCartValue ? 'completed' : 'active',
                    creditAnalysis: { approvedBySystem: true, result: analysis }
                };
                
                setIsAnalyzingCredit(false);
                setApprovedSaleData(finalSaleDataToSave); 

            }, 2000); 

        } else {
            let finalSalePrice = totalCartValue;
            let feeObj = null;

            let feeVal = 0;

            if (directMethod === 'credit' || directMethod === 'debit') {
                const feeP = parseMoney(feePercent);
                feeVal = totalRemaining * (feeP / 100);
                if (feeType === 'com_juros') finalSalePrice += feeVal;

                const grossCardAmount = finalSalePrice - entryValue;
                const netCardAmount = grossCardAmount - feeVal;
                feeObj = {
                    applied: feeP > 0,
                    percent: feeP,
                    value: feeVal,
                    type: feeType,
                    mode: cardMode,
                    brand: cardBrand,
                    rateTableName: normalizedPaymentSettings.card.machineName,
                    baseAmount: totalRemaining,
                    grossCardAmount,
                    netCardAmount
                };
            }

            const netReceived = finalSalePrice - feeVal;

            saleData = { 
                ...saleData,
                productsTotal: totalCartValue,
                paymentMethod: directMethod,
                entryAmount: entryValue,
                cardAmount: finalSalePrice - entryValue,
                netReceived,
                cardInstallments: directMethod === 'credit' ? parseInt(cardInstallments) : 1,
                installments: [],
                status: 'completed',
                totalPrice: finalSalePrice,
                feeConfig: feeObj
            };
            
            onSaveSale(saleData); 
            onClose();
        }
    };

    const handleManualApprove = () => {
        const { pendingSaleData, manualReason, result } = creditModal;
        if (!manualReason.trim()) return alert("Você precisa digitar o motivo para a aprovação manual.");
        
        const finalInstallments = calculateInstallments();
        const saleDataToSave = {
            ...pendingSaleData,
            entryAmount: entryValue, frequency, installmentsCount: finalInstallments.length, installments: finalInstallments, 
            status: finalInstallments.length === 0 && entryValue >= totalCartValue ? 'completed' : 'active',
            creditAnalysis: {
                approvedBySystem: false,
                manualApprovalReason: manualReason,
                result: result
            }
        };

        onSaveSale(saleDataToSave);
        setCreditModal({ open: false, result: null, pendingSaleData: null, manualReason: '' });
        onClose();
    };

    if (isAnalyzingCredit) {
        return React.createElement('div', { className: "fixed inset-0 bg-slate-900 z-[100] flex flex-col items-center justify-center p-4" },
            React.createElement(RefreshCw, { size: 64, className: "text-yellow-500 animate-spin mb-6" }),
            React.createElement('h2', { className: "text-2xl font-black text-white text-center uppercase tracking-wider mb-2" }, "Analisando Crédito"),
            React.createElement('p', { className: "text-slate-400 text-center animate-pulse" }, "Avaliando histórico, renda e pagamentos do cliente...")
        );
    }

    if (approvedSaleData) {
        return React.createElement('div', { className: "fixed inset-0 bg-emerald-500 z-[100] flex flex-col items-center justify-center p-4 animate-fade-in" },
            React.createElement('div', { className: "w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-2xl animate-bounce" },
                React.createElement(ThumbsUp, { size: 48, className: "text-emerald-500" })
            ),
            React.createElement('h2', { className: "text-3xl font-black text-white text-center uppercase tracking-wider mb-2 drop-shadow-md" }, "Venda Aprovada!"),
            React.createElement('p', { className: "text-emerald-100 text-center mb-8 font-medium max-w-md" }, "O histórico deste cliente é bom e permitiu a liberação de limite para esta compra a prazo."),
            React.createElement('button', { 
                onClick: () => { onSaveSale(approvedSaleData); onClose(); }, 
                className: "w-full max-w-sm py-4 bg-slate-900 text-emerald-400 font-bold rounded-2xl shadow-xl hover:bg-slate-800 transition-colors text-lg flex items-center justify-center gap-2"
            }, React.createElement(CheckCircle, { size: 24 }), "Concluir e Salvar Venda")
        );
    }

    return React.createElement('div', { className: "sale-screen fixed inset-0 z-50 flex flex-col animate-fade-in" },
        React.createElement('div', { className: `sale-screen-header p-4 shrink-0 flex items-center justify-between text-white ${mode === 'prazo' ? 'bg-slate-900' : 'bg-emerald-700'}` },
            React.createElement('div', { className: "flex items-center gap-3" },
                React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-black/10 rounded-full transition-colors" }, React.createElement(ChevronLeft, { size: 24 })),
                React.createElement('h2', { className: "text-lg md:text-xl font-bold" }, mode === 'prazo' ? "Nova Venda à Prazo" : "Nova Venda Direta (Caixa)")
            )
        ),
        
        React.createElement('div', { className: "flex-1 overflow-y-auto p-4 pb-32" },
            React.createElement('div', { className: "max-w-2xl mx-auto space-y-6" },

                React.createElement('div', { className: "sale-section bg-white p-5 border" },
                    React.createElement('div', { className: "flex justify-between items-center mb-4" },
                        React.createElement('h3', { className: "font-bold text-slate-800 flex items-center gap-2" }, React.createElement(User, { className: "text-slate-400" }), "1. Cliente"),
                        !isAddingCustomer && React.createElement('button', { onClick: () => setIsAddingCustomer(true), className: "text-xs font-bold text-blue-500 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded" }, React.createElement(UserPlus, { size: 14 }), "Novo Cadastro")
                    ),
                    
                    isAddingCustomer ? React.createElement('div', { className: "bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3 animate-fade-in" },
                        React.createElement('div', { className: "flex justify-between items-center mb-1" },
                            React.createElement('p', { className: "text-xs font-bold text-blue-700 uppercase" }, "Cadastro Rápido"),
                            React.createElement('button', { onClick: () => setIsAddingCustomer(false), className: "text-slate-400 hover:text-slate-600" }, React.createElement(X, { size: 16 }))
                        ),
                        React.createElement('input', { autoFocus: true, className: "w-full p-3 border border-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase", placeholder: "Nome Completo *", value: newCustName, onChange: e => setNewCustName(e.target.value.toUpperCase()) }),
                        React.createElement('input', { type: "tel", className: "w-full p-3 border border-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500", placeholder: "WhatsApp", value: newCustPhone, onChange: e => setNewCustPhone(maskPhone(e.target.value)) }),
                        React.createElement('div', { className: "grid grid-cols-2 gap-2" },
                            React.createElement('input', { className: "w-full p-3 border border-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase text-sm", placeholder: "Profissão", value: newCustProfession, onChange: e => setNewCustProfession(e.target.value) }),
                            React.createElement(MoneyInput, { className: "w-full p-3 pl-8 border border-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm", placeholder: "Renda Mensal", value: newCustIncome, onChange: setNewCustIncome })
                        ),
                        React.createElement('button', { onClick: handleSaveInlineCustomer, disabled: savingCustomer, className: "w-full py-3 bg-blue-600 text-white font-bold rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50" }, savingCustomer ? "Salvando..." : "Salvar e Selecionar")
                    ) : React.createElement('div', { className: "relative" },
                        React.createElement('div', { className: "relative" },
                            React.createElement(Search, { className: "absolute left-3 top-3.5 text-slate-400", size: 16 }),
                            React.createElement('input', {
                                className: `w-full p-3 pl-9 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 ${mode === 'prazo' ? 'focus:ring-yellow-500 border-slate-200' : 'focus:ring-emerald-500 border-slate-200'} ${customerId ? 'border-green-300 bg-green-50' : ''}`,
                                placeholder: "Busque pelo nome do cliente...",
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
                                    key: c.id, className: "p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer",
                                    onClick: () => { setCustomerId(c.id); setCustomerSearch(c.name); setShowCustomerList(false); }
                                }, 
                                    React.createElement('p', { className: "font-bold text-slate-800 text-sm" }, c.name),
                                    c.phone && React.createElement('p', { className: "text-xs text-slate-500" }, c.phone)
                                )
                            ) : React.createElement('div', { className: "p-4 text-slate-500 text-sm text-center flex flex-col items-center gap-2" }, 
                                "Cliente não encontrado.",
                                React.createElement('button', { onClick: () => { setShowCustomerList(false); setIsAddingCustomer(true); setNewCustName(customerSearch); }, className: "text-blue-500 font-bold px-3 py-1 bg-blue-50 rounded" }, "Cadastrar agora")
                            )
                        )
                    )
                ),

                React.createElement('div', { className: "sale-section bg-white p-5 border" },
                    React.createElement('h3', { className: "font-bold text-slate-800 flex items-center gap-2 mb-4" }, React.createElement(ShoppingBag, { className: "text-slate-400" }), "2. Produtos"),
                    React.createElement('div', { className: "space-y-4" },
                        React.createElement('div', { className: "relative" },
                            React.createElement('div', { className: "relative" },
                                React.createElement(Search, { className: "absolute left-3 top-3.5 text-slate-400", size: 16 }),
                                React.createElement('input', {
                                    className: `w-full p-3 pl-9 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 ${mode === 'prazo' ? 'focus:ring-yellow-500' : 'focus:ring-emerald-500'}`,
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
                                        key: p.id, className: "p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex justify-between items-center",
                                        onClick: () => handleSelectProduct(p)
                                    }, 
                                        React.createElement('div', null,
                                            React.createElement('p', { className: "font-bold text-slate-800 text-sm flex items-center gap-2" }, p.name, activePromo && React.createElement(Tag, { size: 12, className: "text-purple-500" })),
                                            React.createElement('span', { className: "text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded mt-1 inline-block" }, `#${p.code}`)
                                        ),
                                        React.createElement('div', { className: "text-right" },
                                            activePromo ? React.createElement('p', { className: "text-xs font-bold text-purple-600" }, formatCurrency(p.promoPrice)) : React.createElement('p', { className: "text-xs font-bold text-slate-800" }, formatCurrency(p.salePrice)),
                                            React.createElement('p', { className: "text-[10px] text-slate-400" }, `Estoque: ${p.quantity}`)
                                        )
                                    );
                                }) : React.createElement('div', { className: "p-3 text-slate-500 text-sm text-center" }, "Nenhum produto encontrado.")
                            )
                        ),
                        React.createElement('div', { className: "flex gap-2" },
                            React.createElement('div', { className: "w-16" }, React.createElement('label', { className: "block text-[10px] font-bold text-slate-400 uppercase mb-1" }, "Qtd"), React.createElement('input', { type: "number", min: "1", className: `w-full p-3 border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:ring-2 ${mode === 'prazo' ? 'focus:ring-yellow-500' : 'focus:ring-emerald-500'} px-1`, value: currentQty, onChange: e => setCurrentQty(e.target.value) })),
                            React.createElement('div', { className: "flex-1" }, React.createElement('label', { className: "block text-[10px] font-bold text-slate-400 uppercase mb-1" }, "Desconto Unit."), React.createElement(MoneyInput, { placeholder: "0,00", value: currentDiscount, onChange: handleDiscountChange, className: `w-full p-3 pl-8 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 ${mode === 'prazo' ? 'focus:ring-yellow-500' : 'focus:ring-emerald-500'} text-sm text-red-500 font-bold` })),
                            React.createElement('div', { className: "flex-1" }, React.createElement('label', { className: "block text-[10px] font-bold text-slate-400 uppercase mb-1" }, "Preço Unit."), React.createElement(MoneyInput, { placeholder: "0,00", value: currentPrice, onChange: handlePriceChange, className: `w-full p-3 pl-8 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 ${mode === 'prazo' ? 'focus:ring-yellow-500' : 'focus:ring-emerald-500'} text-sm font-bold text-slate-800` }))
                        ),
                        React.createElement('button', { onClick: handleAddItem, disabled: !selectedProductId || currentQty < 1, className: "w-full py-3 bg-slate-800 text-white rounded-lg font-bold text-sm disabled:opacity-50 hover:bg-slate-700 transition-colors flex justify-center gap-2 items-center" }, React.createElement(PlusCircle, { size: 16 }), "Adicionar no Carrinho"),
                        
                        React.createElement('div', { className: "space-y-2 mt-4" },
                            React.createElement('label', { className: "text-xs font-bold text-slate-400 uppercase" }, `Carrinho (${cart.reduce((a,b)=>a+(parseInt(b.quantity)||1),0)} itens)`),
                            cart.length === 0 ? React.createElement('p', { className: "text-center text-slate-400 text-sm py-4 italic" }, "Nenhum produto adicionado.") : cart.map(item => React.createElement('div', { key: item.tempId, className: `flex justify-between items-center p-3 rounded-lg border shadow-sm ${mode === 'prazo' ? 'bg-yellow-50 border-yellow-200' : 'bg-emerald-50 border-emerald-200'}` }, React.createElement('div', null, React.createElement('p', { className: "font-bold text-sm text-slate-800 leading-tight mb-1" }, `${item.quantity}x ${item.productName}`), React.createElement('div', { className: "flex items-center gap-2" }, React.createElement('p', { className: "text-xs font-bold text-slate-600" }, `${formatCurrency(item.price)}`), item.unitDiscount > 0 && React.createElement('span', { className: "bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded font-bold" }, `-${formatCurrency(item.unitDiscount * item.quantity)}`))), React.createElement('button', { onClick: () => handleRemoveItem(item.tempId), className: "text-red-400 hover:text-red-600 p-2 bg-white rounded-full shadow-sm" }, React.createElement(Trash2, { size: 16 })))),
                            cart.length > 0 && React.createElement('div', { className: "text-right font-bold text-xl text-slate-800 pt-3 border-t border-slate-100 mt-2" }, `Total: ${formatCurrency(totalCartValue)}`)
                        )
                    )
                ),

                React.createElement('div', { className: "sale-section bg-white p-5 border" },
                    React.createElement('div', { className: "flex justify-between items-center mb-4" },
                        React.createElement('h3', { className: "font-bold text-slate-800 flex items-center gap-2" }, React.createElement(CreditCard, { className: "text-slate-400" }), "3. Pagamento"),
                        React.createElement('div', { className: "flex items-center gap-2" }, React.createElement(Calendar, { size: 14, className: "text-slate-400"}), React.createElement('input', { type: "date", className: "text-xs font-bold text-slate-600 outline-none bg-transparent w-28", value: saleDate, onChange: e => setSaleDate(e.target.value) }))
                    ),

                    mode === 'prazo' && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                        React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Entrada (Opcional)"), React.createElement(MoneyInput, { value: entryAmount, onChange: setEntryAmount, className: "w-full p-3 pl-8 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500" })),
                        totalRemaining > 0 && React.createElement(React.Fragment, null,
                            React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Frequência das Parcelas"), React.createElement('select', { className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: frequency, onChange: e => setFrequency(e.target.value) }, React.createElement('option', { value: "weekly" }, "Semanal"), React.createElement('option', { value: "biweekly" }, "Quinzenal"), React.createElement('option', { value: "monthly" }, "Mensal"))),
                            React.createElement('div', { className: "grid grid-cols-2 gap-4" },
                                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Qtd Parcelas"), React.createElement('select', { className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: installmentsCount, onChange: e => setInstallmentsCount(e.target.value) }, Array.from({length: 12}, (_, i) => i + 1).map(n => React.createElement('option', { key: n, value: n }, `${n}x`)))),
                                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "1º Vencimento"), React.createElement('input', { type: "date", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: firstDueDate, onChange: e => setFirstDueDate(e.target.value) }))
                            ),
                            React.createElement('div', { className: `carnet-interest-summary p-3 rounded-xl border space-y-2 ${carnetInterestPercent > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}` },
                                React.createElement('div', { className: "flex items-center justify-between gap-3" },
                                    React.createElement('p', { className: "text-xs font-bold text-slate-700 flex items-center gap-1.5" }, React.createElement(BadgePercent, { size: 14, className: carnetInterestPercent > 0 ? 'text-amber-600' : 'text-slate-400' }), "Juros configurados para este plano"),
                                    React.createElement('span', { className: `text-xs font-black ${carnetInterestPercent > 0 ? 'text-amber-700' : 'text-slate-500'}` }, `${carnetInterestLabel}%`)
                                ),
                                React.createElement('div', { className: "grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]" },
                                    React.createElement('span', { className: "text-slate-500" }, "Saldo sem juros"),
                                    React.createElement('strong', { className: "text-right text-slate-700" }, formatCurrency(totalRemaining)),
                                    React.createElement('span', { className: "text-slate-500" }, "Acréscimo"),
                                    React.createElement('strong', { className: carnetInterestValue > 0 ? 'text-right text-amber-700' : 'text-right text-slate-500' }, `+ ${formatCurrency(carnetInterestValue)}`),
                                    React.createElement('span', { className: "text-slate-700 font-bold pt-1 border-t border-slate-200" }, "Total parcelado"),
                                    React.createElement('strong', { className: "text-right text-slate-800 pt-1 border-t border-slate-200" }, formatCurrency(totalFinancedAmount))
                                ),
                                React.createElement('p', { className: "text-[10px] text-slate-500" }, carnetInterestPercent > 0
                                    ? `O saldo será dividido em ${selectedInstallmentsCount} parcela${selectedInstallmentsCount === 1 ? '' : 's'} de aproximadamente ${formatCurrency(totalFinancedAmount / selectedInstallmentsCount)}.`
                                    : "Este plano está configurado sem acréscimo na aba Taxas e juros."
                                )
                            )
                        )
                    ),

                    mode === 'direct' && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                        React.createElement('div', { className: "grid grid-cols-2 lg:grid-cols-4 gap-3" },
                            ['pix','money','debit','credit'].map(m => React.createElement('button', { key: m, onClick: () => setDirectMethod(m), className: `p-4 rounded-xl border flex flex-col items-center gap-2 ${directMethod === m ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}` }, React.createElement(m === 'pix' ? QrCode : m === 'money' ? Banknote : CreditCard, { size: 24 }), React.createElement('span', { className: "text-xs font-bold uppercase" }, m === 'money' ? 'Dinheiro' : m === 'debit' ? 'Débito' : m === 'credit' ? 'Crédito' : 'PIX')))
                        ),
                        
                        directMethod === 'pix' && React.createElement('div', { className: "space-y-4 pt-4 border-t border-slate-100" },
                            userProfile?.pixKey ? React.createElement('div', { className: "bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col items-center text-center" },
                                React.createElement('p', { className: "text-xs font-bold text-emerald-700 uppercase mb-3 flex items-center gap-2" }, React.createElement(QrCode, { size: 16 }), "Receber via PIX"),
                                React.createElement(LocalPixQrCode, {
                                    payload: generatePixPayload(userProfile.pixKey, userProfile.pixType, userProfile.pixName, userProfile.city || "BRASIL", totalRemaining, "VND")
                                }),
                                React.createElement('div', { className: "w-full relative" },
                                    React.createElement('input', { type: "text", readOnly: true, value: generatePixPayload(userProfile.pixKey, userProfile.pixType, userProfile.pixName, userProfile.city || "BRASIL", totalRemaining, "VND"), className: "w-full text-[10px] p-3 pr-12 border border-emerald-200 rounded-lg bg-white outline-none text-slate-500 font-mono" }),
                                    React.createElement('button', { onClick: () => { navigator.clipboard.writeText(generatePixPayload(userProfile.pixKey, userProfile.pixType, userProfile.pixName, userProfile.city || "BRASIL", totalRemaining, "VND")); alert("Código PIX Copiado!"); }, className: "absolute right-2 top-2 p-1.5 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200 transition-colors", title: "Copiar" }, React.createElement(Copy, { size: 14 }))
                                )
                            ) : React.createElement('div', { className: "bg-yellow-50 p-3 rounded-xl border border-yellow-100 text-xs text-yellow-700 text-center" }, "Configure sua Chave PIX no seu Perfil para gerar o QR Code aqui automaticamente.")
                        ),

                        (directMethod === 'credit' || directMethod === 'debit') && React.createElement('div', { className: "space-y-4 pt-4 border-t border-slate-100" },
                            React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Entrada (Dinheiro/Pix) - Opcional"), React.createElement(MoneyInput, { value: entryAmount, onChange: setEntryAmount, className: "w-full p-3 pl-8 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" })),
                            directMethod === 'credit' && React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Parcelas no Cartão"), React.createElement('select', { className: "w-full p-3 border border-slate-200 rounded-lg outline-none", value: cardInstallments, onChange: e => setCardInstallments(e.target.value) }, React.createElement('option', { value: "1" }, "1x (À Vista)"), Array.from({length: 11}, (_, i) => i + 2).map(n => React.createElement('option', { key: n, value: n }, `${n}x`)))),
                            
                            React.createElement('div', { className: "bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-3" },
                                React.createElement('p', { className: "text-xs font-bold text-orange-700 uppercase flex items-center gap-1" }, React.createElement(BadgePercent, { size: 14 }), `Taxas · ${normalizedPaymentSettings.card.machineName}`),
                                React.createElement('div', { className: "grid grid-cols-2 gap-3" },
                                    React.createElement('div', null, React.createElement('label', { className: "block text-[10px] font-bold text-orange-600 uppercase mb-1" }, "Modalidade"), React.createElement('select', { className: "w-full p-2 border border-orange-200 rounded text-sm outline-none text-slate-700", value: cardMode, onChange: e => setCardMode(e.target.value) }, React.createElement('option', { value: "presencial" }, "Presencial"), React.createElement('option', { value: "link" }, "Link Web"))),
                                    cardMode === 'presencial' ? React.createElement('div', null, React.createElement('label', { className: "block text-[10px] font-bold text-orange-600 uppercase mb-1" }, "Bandeira"), React.createElement('select', { className: "w-full p-2 border border-orange-200 rounded text-sm outline-none text-slate-700", value: cardBrand, onChange: e => setCardBrand(e.target.value) }, React.createElement('option', { value: "visa_master" }, "Visa/Mastercard"), React.createElement('option', { value: "outras" }, "Outras (Elo/Amex...)"))) : React.createElement('div', null)
                                ),
                                React.createElement('div', { className: "grid grid-cols-2 gap-3" },
                                    React.createElement('div', null, React.createElement('label', { className: "block text-[10px] font-bold text-orange-600 uppercase mb-1" }, "Repasse"), React.createElement('select', { className: "w-full p-2 border border-orange-200 rounded text-sm outline-none text-slate-700 font-bold", value: feeType, onChange: e => setFeeType(e.target.value) }, React.createElement('option', { value: "sem_juros" }, "Sem Juros (Loja Paga)"), React.createElement('option', { value: "com_juros" }, "Com Juros (Cliente Paga)"))),
                                    React.createElement('div', null, React.createElement('label', { className: "block text-[10px] font-bold text-orange-600 uppercase mb-1" }, "Taxa Aplicada (%)"), React.createElement('div', { className: "relative" }, React.createElement('input', { type: "text", className: "w-full p-2 pr-6 border border-orange-200 rounded text-sm outline-none font-bold text-slate-700", value: feePercent, onChange: e => setFeePercent(e.target.value) }), React.createElement('span', { className: "absolute right-2 top-2 text-slate-400 text-sm" }, "%")))
                                ),
                                React.createElement('div', { className: "text-[10px] bg-orange-100 p-2 rounded text-orange-800 leading-tight space-y-1" },
                                    React.createElement('div', null, `Valor base no cartão: ${formatCurrency(totalRemaining)}`),
                                    feeType === 'sem_juros'
                                        ? React.createElement('strong', { className: "block" }, `A loja pagará ${formatCurrency(currentFeeValue)} de taxa.`)
                                        : React.createElement('strong', { className: "block" }, `O cliente pagará ${formatCurrency(currentFeeValue)} a mais.`),
                                    React.createElement('div', { className: "pt-1 border-t border-orange-200" }, `Total passado no cartão: ${formatCurrency(totalRemaining + (feeType === 'com_juros' ? currentFeeValue : 0))}`),
                                    React.createElement('div', null, `Valor líquido para a empresa: ${formatCurrency(netAmountToCompany)}`)
                                )
                            )
                        )
                    )
                )
            )
        ),
        
        React.createElement('div', { className: "sale-bottom-bar fixed bottom-0 w-full p-4 z-40" },
            React.createElement('div', { className: "max-w-2xl mx-auto flex items-center justify-between gap-4" },
                React.createElement('div', { className: "hidden md:block flex-1" }, 
                    React.createElement('p', { className: "text-xs font-bold text-slate-400 uppercase" }, "Total a Pagar"),
                    React.createElement('p', { className: "text-2xl font-black text-slate-800" }, formatCurrency(totalCustomerPays))
                ),
                React.createElement('button', { 
                    onClick: handleFinish, 
                    className: `flex-1 py-4 text-white font-bold text-lg rounded-xl shadow-lg transition-transform active:scale-95 flex justify-center items-center gap-2 ${mode === 'prazo' ? 'bg-yellow-500 hover:bg-yellow-600 text-slate-900 shadow-yellow-200' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'}` 
                }, React.createElement(CheckCircle, { size: 20 }), "Finalizar Venda")
            )
        ),

        creditModal.open && React.createElement('div', { className: "app-modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4" },
            React.createElement('div', { className: "app-modal-panel desktop-modal desktop-modal-credit-denied bg-white w-full max-w-md rounded-3xl p-6 animate-fade-in flex flex-col max-h-[90vh]" },
                React.createElement('div', { className: "credit-denied-icon w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4" },
                    React.createElement(ShieldAlert, { size: 32 })
                ),
                React.createElement('h2', { className: "credit-denied-title text-xl font-black text-slate-800 text-center uppercase tracking-tight mb-1" }, "Venda Reprovada"),
                React.createElement('p', { className: "credit-denied-reason text-center text-red-600 text-sm font-bold bg-red-50 p-2 rounded-lg mb-6 border border-red-100" }, creditModal.result?.reason),
                
                React.createElement('div', { className: `desktop-modal-body credit-denied-body ${creditModal.result?.suggestedEntry > 0 ? 'credit-denied-has-suggestion' : ''} overflow-y-auto space-y-4 px-1` },
                    React.createElement('div', { className: "credit-denied-metrics bg-slate-50 p-4 rounded-xl border border-slate-100" },
                        React.createElement('p', { className: "text-[10px] font-bold text-slate-400 uppercase mb-2" }, "Métricas do Cliente"),
                        React.createElement('div', { className: "space-y-2 text-sm" },
                            React.createElement('div', { className: "flex justify-between" }, React.createElement('span', { className: "text-slate-500" }, "Limite Total Calculado:"), React.createElement('span', { className: "font-bold text-slate-800" }, formatCurrency(creditModal.result?.calculatedLimit))),
                            React.createElement('div', { className: "flex justify-between" }, React.createElement('span', { className: "text-slate-500" }, "Limite Comprometido:"), React.createElement('span', { className: "font-bold text-orange-600" }, `- ${formatCurrency(creditModal.result?.currentDebt)}`)),
                            React.createElement('div', { className: "flex justify-between pt-2 border-t border-slate-200" }, React.createElement('span', { className: "text-slate-500 font-bold" }, "Limite Disponível:"), React.createElement('span', { className: "font-black text-emerald-600" }, formatCurrency(creditModal.result?.availableLimit))),
                            React.createElement('div', { className: "flex justify-between" }, React.createElement('span', { className: "text-slate-500" }, "Saldo com juros:"), React.createElement('span', { className: "font-bold text-slate-800" }, formatCurrency(totalFinancedAmount)))
                        )
                    ),

                    creditModal.result?.suggestedEntry > 0 && React.createElement('div', { className: "credit-denied-suggestion bg-blue-50 p-3 rounded-xl border border-blue-100" },
                        React.createElement('p', { className: "text-xs text-blue-700 font-medium" }, "💡 Para o sistema aprovar, o cliente precisa dar uma entrada de ", React.createElement('strong', null, formatCurrency(creditModal.result.suggestedEntry)), " nesta compra.")
                    ),

                    React.createElement('div', { className: "credit-denied-manual" },
                        React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Motivo da Liberação Manual (Obrigatório)"),
                        React.createElement('textarea', {
                            className: "w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-yellow-500 text-sm",
                            placeholder: "Ex: Conheço o cliente, prometeu pagar amanhã...",
                            rows: 3,
                            value: creditModal.manualReason,
                            onChange: e => setCreditModal(prev => ({ ...prev, manualReason: e.target.value }))
                        })
                    )
                ),

                React.createElement('div', { className: "desktop-modal-footer credit-denied-footer mt-6 flex flex-col gap-3" },
                    React.createElement('button', { 
                        onClick: handleManualApprove, 
                        disabled: !creditModal.manualReason.trim(),
                        className: "w-full py-3 bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:bg-red-600 transition-colors disabled:opacity-50 disabled:shadow-none" 
                    }, "Assumir Risco e Aprovar Manualmente"),
                    React.createElement('button', { 
                        onClick: () => setCreditModal({ open: false, result: null, pendingSaleData: null, manualReason: '' }), 
                        className: "w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors" 
                    }, "Voltar e Ajustar Venda")
                )
            )
        )
    );
};
