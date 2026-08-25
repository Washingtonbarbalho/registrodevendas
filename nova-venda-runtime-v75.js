// Gerado por scripts/consolidate-legacy-runtime-v75.mjs — nova venda consolidada.
import React, { useState, useEffect } from 'https://esm.sh/react@18.2.0';
import { ChevronLeft, User, UserPlus, X, Search, CheckCircle, ShoppingBag, Tag, PlusCircle, Trash2, CreditCard, Calendar, QrCode, Banknote, Copy, BadgePercent, RefreshCw, ThumbsUp, ShieldAlert } from 'https://esm.sh/lucide-react@0.292.0';
import { db, APP_ID } from './firebase-config.js?v=82';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { formatCurrency, parseMoney, maskPhone, getBrazilDateString, addDays, generatePixPayload, analyzeCustomerCredit } from './utils.js?v=82';
import { MoneyInput } from './components.js?v=82';
import { getCardRate, getCarnetRate, normalizePaymentSettings, evaluateTermEntryRules } from './payment-settings.js?v=82';
import { splitMoney } from './financial-core-v70.js?v=82';
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

export const NewSaleScreen = ({ mode: initialMode, onClose, customers, products, sales, onSaveSale, userProfile, user, paymentSettings }) => {
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
    const [savingSale, setSavingSale] = useState(false);
    const savingSaleRef = React.useRef(false);

    const [productSearch, setProductSearch] = useState('');
    const [showProductList, setShowProductList] = useState(false);
    const [cart, setCart] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [baseUnitPrice, setBaseUnitPrice] = useState(0); 
    const [currentQty, setCurrentQty] = useState(1);
    const [currentCost, setCurrentCost] = useState(0); 
    const [currentPrice, setCurrentPrice] = useState(''); 
    const [currentDiscount, setCurrentDiscount] = useState(''); 
    const [currentDiscountReason, setCurrentDiscountReason] = useState('');
    
    const [saleDate, setSaleDate] = useState(getBrazilDateString()); 
    const [saleNotes, setSaleNotes] = useState('');
    const [paymentMethod, setPaymentMethod] = useState(initialMode === 'prazo' ? 'crediario' : 'pix');
    const mode = paymentMethod === 'crediario' ? 'prazo' : 'direct';
    const saleType = mode === 'prazo' ? 'prazo' : 'direct';
    const [entryAmount, setEntryAmount] = useState('');
    
    const [frequency, setFrequency] = useState('monthly');
    const [installmentsCount, setInstallmentsCount] = useState(1);
    const [firstDueDate, setFirstDueDate] = useState('');
    const [waiveCarnetInterest, setWaiveCarnetInterest] = useState(false);
    
    const [directMethod, setDirectMethod] = useState('pix');
    const [saleChannel, setSaleChannel] = useState('presencial');
    const [cardInstallments, setCardInstallments] = useState(1);
    const [cardMode, setCardMode] = useState('presencial');
    const [cardBrand, setCardBrand] = useState('visa_master');
    const [feeType, setFeeType] = useState('sem_juros'); 
    const [feePercent, setFeePercent] = useState('0,00');

    const [isAnalyzingCredit, setIsAnalyzingCredit] = useState(false);
    const [approvedSaleData, setApprovedSaleData] = useState(null);
    const [creditModal, setCreditModal] = useState({ open: false, result: null, pendingSaleData: null, manualReason: '' });

    const selectPaymentMethod = method => {
        setPaymentMethod(method);
        if (method !== 'crediario') setDirectMethod(method);
    };

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
    const filteredProducts = products
        .filter(p => String(p.name || '').toLowerCase().includes(productSearch.toLowerCase()) || String(p.code || '').includes(productSearch))
        .sort((a, b) => {
            const aHasStock = (Number(a.quantity) || 0) > 0;
            const bHasStock = (Number(b.quantity) || 0) > 0;
            if (aHasStock !== bHasStock) return aHasStock ? -1 : 1;
            return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' });
        });
    
    const totalCartValue = cart.reduce((acc, item) => acc + item.price, 0);
    const acceptsEntry = saleType === 'prazo' || directMethod === 'credit' || directMethod === 'debit';
    const entryValue = acceptsEntry ? parseMoney(entryAmount) || 0 : 0;
    const totalRemaining = Math.max(0, totalCartValue - entryValue);
    const normalizedPaymentSettings = normalizePaymentSettings(paymentSettings);
    const selectedInstallmentsCount = Math.min(12, Math.max(1, parseInt(installmentsCount, 10) || 1));
    const configuredCarnetInterestPercent = saleType === 'prazo'
        ? getCarnetRate(normalizedPaymentSettings, frequency, selectedInstallmentsCount)
        : 0;
    const carnetInterestWaived = saleType === 'prazo' && waiveCarnetInterest && configuredCarnetInterestPercent > 0;
    const carnetInterestPercent = carnetInterestWaived ? 0 : configuredCarnetInterestPercent;
    const carnetInterestValue = saleType === 'prazo' ? totalRemaining * (carnetInterestPercent / 100) : 0;
    const totalFinancedAmount = totalRemaining + carnetInterestValue;
    const carnetInterestLabel = carnetInterestPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    const configuredCarnetInterestLabel = configuredCarnetInterestPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    const isCardPayment = saleType === 'direct' && (directMethod === 'credit' || directMethod === 'debit');
    const currentFeePercent = isCardPayment ? parseMoney(feePercent) : 0;
    const roundCardMoney = value => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;
    const cardFeeFraction = isCardPayment ? Math.min(0.999999, Math.max(0, currentFeePercent / 100)) : 0;
    const cardBaseAmount = isCardPayment ? roundCardMoney(totalRemaining) : 0;
    const cardGrossUpAmount = isCardPayment && cardFeeFraction > 0
        ? roundCardMoney(cardBaseAmount / (1 - cardFeeFraction))
        : cardBaseAmount;
    const customerPassedFeeValue = isCardPayment && feeType === 'com_juros'
        ? roundCardMoney(Math.max(0, cardGrossUpAmount - cardBaseAmount))
        : 0;
    const storeAbsorbedFeeValue = isCardPayment && feeType === 'sem_juros'
        ? roundCardMoney(cardBaseAmount * cardFeeFraction)
        : 0;
    const currentFeeValue = roundCardMoney(customerPassedFeeValue + storeAbsorbedFeeValue);
    const cardAmountCharged = isCardPayment
        ? (feeType === 'com_juros' ? cardGrossUpAmount : cardBaseAmount)
        : 0;
    const cardNetAmount = isCardPayment
        ? (feeType === 'com_juros' ? cardBaseAmount : roundCardMoney(cardBaseAmount - storeAbsorbedFeeValue))
        : 0;
    const totalCustomerPays = saleType === 'prazo'
        ? totalCartValue + carnetInterestValue
        : isCardPayment
            ? roundCardMoney(entryValue + cardAmountCharged)
            : totalCartValue;
    const netAmountToCompany = totalCustomerPays - currentFeeValue;
    const summaryInstallmentsCount = saleType === 'prazo'
        ? selectedInstallmentsCount
        : directMethod === 'credit'
            ? Math.min(12, Math.max(1, parseInt(cardInstallments, 10) || 1))
            : 1;
    const summaryEntryValue = Math.min(Math.max(0, entryValue), Math.max(0, totalCustomerPays));
    const summaryFinancedValue = Math.max(0, totalCustomerPays - summaryEntryValue);
    const summaryInstallmentValue = summaryInstallmentsCount > 0
        ? (splitMoney(summaryFinancedValue, summaryInstallmentsCount)[0] || 0)
        : 0;
    const selectedEntryRuleCustomer = customers.find(customer => customer.id === customerId) || null;
    const totalEntryRuleCost = cart.reduce((total, item) => total + (Number(item.cost) || 0), 0);
    const currentEntryRuleEvaluation = saleType === 'prazo' && selectedEntryRuleCustomer
        ? evaluateTermEntryRules({
            settings: normalizedPaymentSettings,
            customer: selectedEntryRuleCustomer,
            sales,
            entryAmount: entryValue,
            totalCost: totalEntryRuleCost
        })
        : null;

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
        if (unitDiscount > 0 && !currentDiscountReason.trim()) return alert("Informe o motivo do desconto antes de adicionar o produto.");
        
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
        const regularUnitPrice = Number(prod.salePrice) || 0;
        const promotionalUnitPrice = Math.round((unitPrice + unitDiscount + Number.EPSILON) * 100) / 100;
        const promotionIsActive = !!(prod.isPromo && prod.promoStart && prod.promoEnd
            && Math.round((Number(prod.promoPrice) || 0) * 100) === Math.round(promotionalUnitPrice * 100));
        const promotionUnitDiscount = promotionIsActive
            ? Math.round((Math.max(0, regularUnitPrice - promotionalUnitPrice) + Number.EPSILON) * 100) / 100
            : 0;
        
        const newItem = { 
            tempId: Date.now(), productId: prod.id, productName: prod.name, productCode: prod.code, 
            quantity: qty, cost: totalLineCost, price: totalLinePrice, unitPrice: unitPrice, 
            regularUnitPrice, promotionalUnitPrice, promotionUnitDiscount, promotionApplied: promotionUnitDiscount > 0,
            unitCost: currentCost, unitDiscount: unitDiscount, discountReason: unitDiscount > 0 ? currentDiscountReason.trim() : '' 
        };
        
        setCart([...cart, newItem]);
        setSelectedProductId(''); setCurrentQty(1); setCurrentCost(0); setCurrentPrice(''); setBaseUnitPrice(0); setCurrentDiscount(''); setCurrentDiscountReason(''); setProductSearch('');
    };

    const handleRemoveItem = (tempId) => { setCart(cart.filter(item => item.tempId !== tempId)); };
    
    const persistSale = async saleData => {
        if (savingSaleRef.current) return false;
        savingSaleRef.current = true;
        setSavingSale(true);
        try {
            await onSaveSale(saleData);
            return true;
        } catch (error) {
            console.error('Erro ao salvar venda:', error);
            alert(error?.message || 'Não foi possível salvar a venda. Nenhuma alteração foi gravada.');
            return false;
        } finally {
            savingSaleRef.current = false;
            setSavingSale(false);
        }
    };

    const calculateInstallments = () => {
        const total = totalFinancedAmount;
        const count = parseInt(installmentsCount) || 1;
        if (total <= 0) return [];

        const installmentAmounts = splitMoney(total, count);
        const installments = [];

        const parseLocalDate = (dateStr) => {
            const [year, month, day] = String(dateStr || '').split('-').map(Number);
            return new Date(year, month - 1, day, 12, 0, 0, 0);
        };

        const toDateString = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return year + '-' + month + '-' + day;
        };

        const moveWeekendToMonday = (date) => {
            const adjustedDate = new Date(date.getTime());
            const weekDay = adjustedDate.getDay();
            if (weekDay === 6) adjustedDate.setDate(adjustedDate.getDate() + 2);
            if (weekDay === 0) adjustedDate.setDate(adjustedDate.getDate() + 1);
            return adjustedDate;
        };

        const firstDate = parseLocalDate(firstDueDate);
        const originalDay = firstDate.getDate();
        const originalYear = firstDate.getFullYear();
        const originalMonth = firstDate.getMonth();
        let currentDateStr = firstDueDate;

        for (let i = 0; i < count; i++) {
            if (frequency === 'monthly') {
                const targetMonthStart = new Date(originalYear, originalMonth + i, 1, 12, 0, 0, 0);
                const targetYear = targetMonthStart.getFullYear();
                const targetMonth = targetMonthStart.getMonth();
                const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0, 12, 0, 0, 0).getDate();
                const targetDay = Math.min(originalDay, lastDayOfTargetMonth);
                const nominalDate = new Date(targetYear, targetMonth, targetDay, 12, 0, 0, 0);
                currentDateStr = toDateString(moveWeekendToMonday(nominalDate));
            }

            installments.push({
                number: i + 1,
                amount: installmentAmounts[i],
                originalAmount: installmentAmounts[i],
                dueDate: currentDateStr,
                paid: false,
                paidAt: null
            });

            if (frequency === 'weekly') currentDateStr = addDays(currentDateStr, 7);
            else if (frequency === 'biweekly') currentDateStr = addDays(currentDateStr, 15);
        }

        return installments;
    };

    const handleFinish = async () => {
        if (saleType === 'prazo' && !customerId) return alert("Selecione um cliente cadastrado.");
        if (cart.length === 0) return alert("Adicione ao menos um produto no carrinho.");
        if (entryValue > totalCartValue) return alert("A entrada não pode ser maior que o valor total dos produtos.");

        const customer = customerId ? customers.find(c => c.id === customerId) : null;
        const isAnonymousDirectSale = saleType === 'direct' && !customer;
        const cName = customer ? customer.name : (isAnonymousDirectSale ? 'VENDA AVULSA' : customerSearch);
        const cPhone = customer ? customer.phone : '';
        
        const sumDiscount = cart.reduce((acc, i) => acc + (i.unitDiscount * i.quantity), 0);

        let saleData = { 
            saleChannel,
            customerId: customer ? customer.id : null, customerName: cName, customerPhone: cPhone, anonymousSale: isAnonymousDirectSale, 
            items: cart, totalCost: cart.reduce((acc, i) => acc + i.cost, 0), totalPrice: totalCartValue, totalDiscount: sumDiscount,
            notes: saleNotes.trim(),
            saleDate: saleDate, saleDateTime: new Date().toISOString(), saleType: saleType, status: 'active'
        };

        if (saleType === 'prazo') {
            const prazoSaleData = {
                ...saleData,
                productsTotal: totalCartValue,
                totalPrice: totalCartValue + carnetInterestValue,
                installmentInterest: {
                    applied: carnetInterestPercent > 0 && carnetInterestValue > 0,
                    waived: carnetInterestWaived,
                    configuredPercent: configuredCarnetInterestPercent,
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
                const adjustedCreditAnalysis = initialAnalysis.suggestedEntry > 0 && interestMultiplier > 1
                    ? { ...initialAnalysis, suggestedEntry: initialAnalysis.suggestedEntry / interestMultiplier }
                    : initialAnalysis;
                const entryRuleEvaluation = evaluateTermEntryRules({
                    settings: normalizedPaymentSettings,
                    customer,
                    sales,
                    entryAmount: entryValue,
                    totalCost: totalEntryRuleCost
                });
                const entryRuleApplies = entryRuleEvaluation.ruleApplies;
                const entryRuleHasPriority = entryRuleApplies
                    && Number(entryRuleEvaluation.requiredEntry) > 0;
                const limitFailure = !adjustedCreditAnalysis.approved
                    && Number(adjustedCreditAnalysis.suggestedEntry) > 0;
                const limitIgnoredByEntryRule = entryRuleHasPriority && limitFailure;
                const creditFailed = !adjustedCreditAnalysis.approved && !limitIgnoredByEntryRule;
                const entryRuleFailed = !entryRuleEvaluation.approved;
                const ruleReason = entryRuleEvaluation.reasons.join(' ');
                const effectiveCreditReason = creditFailed ? adjustedCreditAnalysis.reason : '';
                const combinedAnalysis = {
                    ...adjustedCreditAnalysis,
                    approved: !creditFailed && !entryRuleFailed,
                    creditApproved: adjustedCreditAnalysis.approved,
                    limitIgnoredByEntryRule,
                    limitAvailableAtAnalysis: adjustedCreditAnalysis.availableLimit,
                    reason: creditFailed && entryRuleFailed
                        ? effectiveCreditReason + ' ' + ruleReason
                        : creditFailed
                            ? effectiveCreditReason
                            : entryRuleFailed
                                ? ruleReason
                                : limitIgnoredByEntryRule
                                    ? 'Entrada igual ao custo aprovada com prioridade sobre o limite disponível.'
                                    : adjustedCreditAnalysis.reason,
                    suggestedEntry: entryRuleHasPriority
                        ? (entryRuleFailed ? Number(entryRuleEvaluation.requiredEntry) || 0 : 0)
                        : Number(adjustedCreditAnalysis.suggestedEntry) || 0,
                    entryRuleEvaluation
                };

                if (!combinedAnalysis.approved) {
                    setIsAnalyzingCredit(false);
                    setCreditModal({ open: true, result: combinedAnalysis, pendingSaleData: prazoSaleData, manualReason: '' });
                    return;
                }

                const finalInstallments = calculateInstallments();
                const finalSaleDataToSave = { 
                    ...prazoSaleData,
                    entryAmount: entryValue, frequency, installmentsCount: finalInstallments.length, installments: finalInstallments, 
                    status: finalInstallments.length === 0 && entryValue >= totalCartValue ? 'completed' : 'active',
                    entryRuleEvaluation,
                    creditAnalysis: { approvedBySystem: true, result: combinedAnalysis }
                };
                
                setIsAnalyzingCredit(false);
                setApprovedSaleData(finalSaleDataToSave); 

            }, 1200); 

        } else {
            let finalSalePrice = totalCartValue;
            let feeObj = null;
            let feeVal = 0;
            let finalCardNetAmount = 0;

            if (directMethod === 'credit' || directMethod === 'debit') {
                const feeP = currentFeePercent;
                feeVal = currentFeeValue;
                finalSalePrice = roundCardMoney(entryValue + cardAmountCharged);
                finalCardNetAmount = cardNetAmount;

                feeObj = {
                    applied: feeP > 0,
                    percent: feeP,
                    value: feeVal,
                    type: feeType,
                    mode: cardMode,
                    brand: cardBrand,
                    rateTableName: normalizedPaymentSettings.card.machineName,
                    baseAmount: cardBaseAmount,
                    grossCardAmount: cardAmountCharged,
                    calculatedGrossAmount: cardGrossUpAmount,
                    customerPassedFeeValue,
                    storeAbsorbedFeeValue,
                    netCardAmount: finalCardNetAmount,
                    calculationFormula: feeType === 'com_juros'
                        ? 'valor_liquido_dividido_por_um_menos_taxa'
                        : 'taxa_sobre_valor_realmente_passado'
                };
            }

            const netReceived = isCardPayment
                ? roundCardMoney(entryValue + finalCardNetAmount)
                : finalSalePrice;

            saleData = { 
                ...saleData,
                productsTotal: totalCartValue,
                paymentMethod: directMethod,
                entryAmount: entryValue,
                cardAmount: isCardPayment ? cardAmountCharged : 0,
                netReceived,
                cardInstallments: directMethod === 'credit' ? parseInt(cardInstallments) : 1,
                installments: [],
                status: 'completed',
                totalPrice: finalSalePrice,
                feeConfig: feeObj
            };
            
            if (await persistSale(saleData)) onClose();
        }
    };

    const handleManualApprove = async () => {
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

        if (await persistSale(saleDataToSave)) {
            setCreditModal({ open: false, result: null, pendingSaleData: null, manualReason: '' });
            onClose();
        }
    };

    return React.createElement('div', { className: "sale-screen fixed inset-0 z-50 flex flex-col animate-fade-in" },
        React.createElement('div', { className: `sale-screen-header p-4 shrink-0 flex items-center justify-between text-white ${mode === 'prazo' ? 'bg-slate-900' : 'bg-emerald-700'}` },
            React.createElement('div', { className: "flex items-center gap-3" },
                React.createElement('button', { onClick: onClose, className: "p-2 hover:bg-black/10 rounded-full transition-colors" }, React.createElement(ChevronLeft, { size: 24 })),
                React.createElement('h2', { className: "text-lg md:text-xl font-bold" }, "Nova venda")
            )
        ),
        
        React.createElement('div', { className: "flex-1 overflow-y-auto p-4 pb-32" },
            React.createElement('div', { className: "max-w-2xl mx-auto space-y-6" },

                React.createElement('div', { className: "sale-section bg-white p-5 border" },
                    React.createElement('div', { className: "flex justify-between items-center mb-4" },
                        React.createElement('h3', { className: "font-bold text-slate-800 flex items-center gap-2" }, React.createElement(User, { className: "text-slate-400" }), mode === 'prazo' ? "1. Cliente" : "1. Cliente (Opcional)"),
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
                                placeholder: mode === 'prazo' ? "Busque pelo nome do cliente..." : "Cliente opcional — deixe em branco para venda avulsa",
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
                        parseMoney(currentDiscount) > 0 && React.createElement('div', { className: "mt-2" },
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Motivo do desconto *"),
                            React.createElement('input', { type: "text", value: currentDiscountReason, onChange: e => setCurrentDiscountReason(e.target.value), placeholder: "Ex.: negociação, cliente recorrente, avaria estética...", className: `w-full p-3 border border-slate-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 ${mode === 'prazo' ? 'focus:ring-yellow-500' : 'focus:ring-emerald-500'}` })
                        ),
                        React.createElement('button', { onClick: handleAddItem, disabled: !selectedProductId || currentQty < 1, className: "w-full py-3 bg-slate-800 text-white rounded-lg font-bold text-sm disabled:opacity-50 hover:bg-slate-700 transition-colors flex justify-center gap-2 items-center" }, React.createElement(PlusCircle, { size: 16 }), "Adicionar no Carrinho"),
                        
                        React.createElement('div', { className: "space-y-2 mt-4" },
                            React.createElement('label', { className: "text-xs font-bold text-slate-400 uppercase" }, `Carrinho (${cart.reduce((a,b)=>a+(parseInt(b.quantity)||1),0)} itens)`),
                            cart.length === 0 ? React.createElement('p', { className: "text-center text-slate-400 text-sm py-4 italic" }, "Nenhum produto adicionado.") : cart.map(item => React.createElement('div', { key: item.tempId, className: `flex justify-between items-center p-3 rounded-lg border shadow-sm ${mode === 'prazo' ? 'bg-yellow-50 border-yellow-200' : 'bg-emerald-50 border-emerald-200'}` }, React.createElement('div', null, React.createElement('p', { className: "font-bold text-sm text-slate-800 leading-tight mb-1" }, `${item.quantity}x ${item.productName}`), React.createElement('div', { className: "flex items-center gap-2" }, React.createElement('p', { className: "text-xs font-bold text-slate-600" }, `${formatCurrency(item.price)}`), item.unitDiscount > 0 && React.createElement('span', { className: "bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded font-bold" }, `-${formatCurrency(item.unitDiscount * item.quantity)}`))), React.createElement('button', { onClick: () => handleRemoveItem(item.tempId), className: "text-red-400 hover:text-red-600 p-2 bg-white rounded-full shadow-sm" }, React.createElement(Trash2, { size: 16 })))),
                            cart.length > 0 && React.createElement('div', { className: "text-right font-bold text-xl text-slate-800 pt-3 border-t border-slate-100 mt-2" }, `Total: ${formatCurrency(totalCartValue)}`)
                        )
                    )
                ),

                React.createElement('div', { className: "sale-channel-field" },
                    React.createElement('label', { htmlFor: "sale-channel" }, "Canal da venda"),
                    React.createElement('select', {
                        id: "sale-channel",
                        value: saleChannel,
                        onChange: event => setSaleChannel(event.target.value)
                    },
                        React.createElement('option', { value: "presencial" }, "Presencial / loja"),
                        React.createElement('option', { value: "whatsapp" }, "WhatsApp"),
                        React.createElement('option', { value: "instagram" }, "Instagram"),
                        React.createElement('option', { value: "facebook" }, "Facebook / Marketplace"),
                        React.createElement('option', { value: "outro" }, "Outro canal")
                    )
                ),

                React.createElement('div', { className: "sale-section bg-white p-5 border" },
                    React.createElement(React.Fragment, null,
                        React.createElement('div', { className: "flex justify-between items-center mb-4" },
                            React.createElement('h3', { className: "font-bold text-slate-800 flex items-center gap-2" }, React.createElement(CreditCard, { className: "text-slate-400" }), "3. Pagamento"),
                            React.createElement('div', { className: "flex items-center gap-2" }, React.createElement(Calendar, { size: 14, className: "text-slate-400"}), React.createElement('input', { type: "date", className: "text-xs font-bold text-slate-600 outline-none bg-transparent w-28", value: saleDate, onChange: e => setSaleDate(e.target.value) }))
                        ),
                        React.createElement('label', { className: "sale-payment-select-field", htmlFor: "sale-payment-method" },
                            React.createElement('span', null, "Forma de pagamento"),
                            React.createElement('select', {
                                id: "sale-payment-method",
                                value: paymentMethod,
                                onChange: event => selectPaymentMethod(event.target.value),
                                className: `sale-payment-select ${mode === 'prazo' ? 'is-term' : ''}`
                            },
                            [
                                ['pix', 'PIX'],
                                ['money', 'Dinheiro'],
                                ['debit', 'Débito'],
                                ['credit', 'Crédito'],
                                ['crediario', 'Crediário']
                            ].map(([method, label]) => React.createElement('option', {
                                key: method,
                                value: method
                            }, label)))
                        )
                    ),

                    React.createElement('div', { className: "mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3" },
                        React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Observações (Opcional)"),
                        React.createElement('textarea', {
                            rows: 3,
                            value: saleNotes,
                            onChange: e => setSaleNotes(e.target.value),
                            placeholder: "Ex.: condição combinada, troca posterior, informação adicional...",
                            className: "w-full p-3 border border-slate-200 rounded-lg bg-white text-sm resize-y focus:outline-none focus:ring-2 " + (mode === 'prazo' ? 'focus:ring-yellow-500' : 'focus:ring-emerald-500')
                        })
                    ),

                    mode === 'prazo' && React.createElement('div', { className: "space-y-4 animate-fade-in" },
                        React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Entrada (Opcional)"), React.createElement(MoneyInput, { value: entryAmount, onChange: setEntryAmount, className: "w-full p-3 pl-8 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500" })),
                        currentEntryRuleEvaluation?.ruleApplies && React.createElement('div', { className: "entry-rule-preview " + (currentEntryRuleEvaluation.approved ? 'is-approved' : 'needs-entry') },
                            React.createElement('div', { className: "entry-rule-preview-heading" },
                                React.createElement(currentEntryRuleEvaluation.approved ? CheckCircle : ShieldAlert, { size: 17 }),
                                React.createElement('strong', null, currentEntryRuleEvaluation.approved ? "Regra de entrada atendida" : "Entrada mínima obrigatória")
                            ),
                            currentEntryRuleEvaluation.reasons.map((reason, index) => React.createElement('p', { key: index }, reason)),
                            React.createElement('div', { className: "entry-rule-preview-values" },
                                React.createElement('span', null, "Entrada exigida"),
                                React.createElement('strong', null, formatCurrency(currentEntryRuleEvaluation.requiredEntry)),
                                !currentEntryRuleEvaluation.approved && React.createElement('small', null, "Faltam " + formatCurrency(currentEntryRuleEvaluation.shortage))
                            )
                        ),
                        totalRemaining > 0 && React.createElement(React.Fragment, null,
                            React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Frequência das Parcelas"), React.createElement('select', { className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: frequency, onChange: e => { setFrequency(e.target.value); setWaiveCarnetInterest(false); } }, React.createElement('option', { value: "weekly" }, "Semanal"), React.createElement('option', { value: "biweekly" }, "Quinzenal"), React.createElement('option', { value: "monthly" }, "Mensal"))),
                            React.createElement('div', { className: "grid grid-cols-2 gap-4" },
                                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Qtd Parcelas"), React.createElement('select', { className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: installmentsCount, onChange: e => { setInstallmentsCount(e.target.value); setWaiveCarnetInterest(false); } }, Array.from({length: 12}, (_, i) => i + 1).map(n => React.createElement('option', { key: n, value: n }, `${n}x`)))),
                                React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "1º Vencimento"), React.createElement('input', { type: "date", className: "w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500", value: firstDueDate, onChange: e => setFirstDueDate(e.target.value) }))
                            ),
                            React.createElement('div', { className: `legacy-payment-calculation carnet-interest-summary p-3 rounded-xl border space-y-2 ${carnetInterestPercent > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}` },
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
                                React.createElement('div', { className: "legacy-payment-calculation text-[10px] bg-orange-100 p-2 rounded text-orange-800 leading-tight space-y-1" },
                                    React.createElement('div', null, `Valor base no cartão: ${formatCurrency(totalRemaining)}`),
                                    feeType === 'sem_juros'
                                        ? React.createElement('strong', { className: "block" }, `A loja pagará ${formatCurrency(currentFeeValue)} de taxa.`)
                                        : React.createElement('strong', { className: "block" }, `O cliente pagará ${formatCurrency(currentFeeValue)} a mais.`),
                                    React.createElement('div', { className: "pt-1 border-t border-orange-200" }, `Total passado no cartão: ${formatCurrency(totalRemaining + (feeType === 'com_juros' ? currentFeeValue : 0))}`),
                                    React.createElement('div', null, `Valor líquido para a empresa: ${formatCurrency(netAmountToCompany)}`)
                                )
                            )
                        )
                    ),
                    React.createElement('div', { className: "payment-inline-summary mt-5 pt-4 border-t border-slate-200" },
                        configuredCarnetInterestPercent > 0 && React.createElement('button', {
                            type: "button",
                            onClick: () => setWaiveCarnetInterest(previous => !previous),
                            className: "w-full mb-4 px-3 py-3 rounded-xl border flex items-center justify-between gap-3 text-left transition-colors " + (carnetInterestWaived ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"),
                            'aria-pressed': carnetInterestWaived
                        },
                            React.createElement('strong', { className: carnetInterestWaived ? "text-sm text-emerald-800" : "text-sm text-amber-800" }, "Parcelamento sem juros"),
                            React.createElement('span', { className: "shrink-0 w-11 h-6 rounded-full p-1 transition-colors " + (carnetInterestWaived ? "bg-emerald-500" : "bg-slate-300") },
                                React.createElement('span', { className: "block w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform " + (carnetInterestWaived ? "translate-x-5" : "translate-x-0") })
                            )
                        ),
                        React.createElement('p', { className: "payment-inline-summary-title text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3" }, "Resumo do pagamento"),
                        React.createElement('div', { className: "payment-inline-summary-grid" },
                            React.createElement('div', { className: "payment-inline-summary-row" },
                                React.createElement('span', null, "Valor total da venda"),
                                React.createElement('strong', null, formatCurrency(totalCustomerPays))
                            ),
                            React.createElement('div', { className: "payment-inline-summary-row" },
                                React.createElement('span', null, "Valor da entrada"),
                                React.createElement('strong', null, formatCurrency(summaryEntryValue))
                            ),
                            React.createElement('div', { className: "payment-inline-summary-row" },
                                React.createElement('span', null, "Valor parcelado"),
                                React.createElement('strong', null, formatCurrency(summaryFinancedValue))
                            ),
                            React.createElement('div', { className: "payment-inline-summary-row payment-inline-summary-installments" },
                                React.createElement('span', null, "Parcelamento"),
                                React.createElement('strong', null, summaryInstallmentsCount + "x de " + formatCurrency(summaryInstallmentValue))
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
                    disabled: savingSale,
                    className: `flex-1 py-4 text-white font-bold text-lg rounded-xl shadow-lg transition-transform active:scale-95 flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-wait ${mode === 'prazo' ? 'bg-yellow-500 hover:bg-yellow-600 text-slate-900 shadow-yellow-200' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'}`
                }, React.createElement(CheckCircle, { size: 20 }), savingSale ? "Salvando..." : "Finalizar Venda")
            )
        ),

        isAnalyzingCredit && React.createElement('div', {
            className: "app-modal-overlay credit-analysis-modal-overlay fixed inset-0 z-[110] flex items-center justify-center p-4 backdrop-blur-sm",
            role: "dialog",
            'aria-modal': "true",
            'aria-label': "Analisando crédito do cliente"
        },
            React.createElement('div', { className: "app-modal-panel credit-analysis-modal bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-fade-in text-center" },
                React.createElement('div', { className: "w-16 h-16 mx-auto mb-5 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center" },
                    React.createElement(RefreshCw, { size: 30, className: "animate-spin" })
                ),
                React.createElement('h2', { className: "text-xl font-black text-slate-800 mb-2" }, "Analisando crédito"),
                React.createElement('p', { className: "text-sm text-slate-500 leading-relaxed" }, "Avaliando histórico, renda, limite disponível, pagamentos e regras de entrada."),
                React.createElement('div', { className: "credit-analysis-progress mt-5" },
                    React.createElement('span', null)
                )
            )
        ),

        approvedSaleData && React.createElement('div', {
            className: "app-modal-overlay sale-approved-modal-overlay fixed inset-0 z-[110] flex items-center justify-center p-4 backdrop-blur-sm",
            role: "dialog",
            'aria-modal': "true",
            'aria-label': "Venda a prazo aprovada"
        },
            React.createElement('div', { className: "app-modal-panel sale-approved-modal bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-fade-in text-center" },
                React.createElement('div', { className: "sale-approved-icon w-16 h-16 mx-auto mb-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center" },
                    React.createElement(ThumbsUp, { size: 30 })
                ),
                React.createElement('h2', { className: "text-xl font-black text-slate-800 mb-2" }, "Venda aprovada!"),
                React.createElement('p', { className: "text-sm text-slate-500 leading-relaxed mb-5" }, "A análise de crédito foi concluída e as condições da venda foram aprovadas."),
                React.createElement('div', { className: "sale-approved-summary mb-5" },
                    React.createElement('div', null,
                        React.createElement('span', null, "Total da venda"),
                        React.createElement('strong', null, formatCurrency(approvedSaleData.totalPrice || totalCustomerPays))
                    ),
                    React.createElement('div', null,
                        React.createElement('span', null, "Parcelamento"),
                        React.createElement('strong', null, (approvedSaleData.installmentsCount || summaryInstallmentsCount) + "x de " + formatCurrency((approvedSaleData.totalPrice - (approvedSaleData.entryAmount || 0)) / Math.max(1, approvedSaleData.installmentsCount || summaryInstallmentsCount)))
                    )
                ),
                React.createElement('button', {
                    onClick: async () => { if (await persistSale(approvedSaleData)) onClose(); },
                    disabled: savingSale,
                    className: "w-full py-3.5 bg-slate-900 text-emerald-400 font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                }, React.createElement(CheckCircle, { size: 20 }), savingSale ? "Salvando..." : "Concluir e salvar venda")
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
                        disabled: savingSale || !creditModal.manualReason.trim(),
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
