const VERSION = '37';

const response = await fetch(`./nova-venda.js?v=${VERSION}`, { cache: 'no-store' });
if (!response.ok) {
    throw new Error(`Não foi possível carregar o formulário de vendas (${response.status}).`);
}

let source = await response.text();

const paymentImport = "import { getCardRate, getCarnetRate, normalizePaymentSettings } from './payment-settings.js';";
if (!source.includes(paymentImport)) {
    throw new Error('Não foi possível carregar as configurações de pagamento.');
}
source = source.replace(
    paymentImport,
    "import { getCardRate, getCarnetRate, normalizePaymentSettings, evaluateTermEntryRules, calculateCardPayment } from './payment-settings.js';"
);

const waiverStateMarker = "    const [firstDueDate, setFirstDueDate] = useState('');";
if (!source.includes(waiverStateMarker)) {
    throw new Error('Não foi possível preparar o parcelamento sem juros.');
}
source = source.replace(
    waiverStateMarker,
    `${waiverStateMarker}\n    const [waiveCarnetInterest, setWaiveCarnetInterest] = useState(false);`
);

const filteredProductsMarker = "    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.includes(productSearch));";
if (!source.includes(filteredProductsMarker)) {
    throw new Error('Não foi possível organizar os produtos da venda.');
}
source = source.replace(
    filteredProductsMarker,
    `    const filteredProducts = products
        .filter(p => String(p.name || '').toLowerCase().includes(productSearch.toLowerCase()) || String(p.code || '').includes(productSearch))
        .sort((a, b) => {
            const aHasStock = (Number(a.quantity) || 0) > 0;
            const bHasStock = (Number(b.quantity) || 0) > 0;
            if (aHasStock !== bHasStock) return aHasStock ? -1 : 1;
            return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' });
        });`
);

const interestCalculationPattern = /    const carnetInterestPercent = saleType === 'prazo'[\s\S]*?    const carnetInterestLabel = carnetInterestPercent\.toLocaleString\('pt-BR', \{ minimumFractionDigits: 2, maximumFractionDigits: 4 \}\);/;
if (!interestCalculationPattern.test(source)) {
    throw new Error('Não foi possível ajustar os juros do carnê.');
}
source = source.replace(
    interestCalculationPattern,
    `    const configuredCarnetInterestPercent = saleType === 'prazo'
        ? getCarnetRate(normalizedPaymentSettings, frequency, selectedInstallmentsCount)
        : 0;
    const carnetInterestWaived = saleType === 'prazo' && waiveCarnetInterest && configuredCarnetInterestPercent > 0;
    const carnetInterestPercent = carnetInterestWaived ? 0 : configuredCarnetInterestPercent;
    const carnetInterestValue = saleType === 'prazo' ? totalRemaining * (carnetInterestPercent / 100) : 0;
    const totalFinancedAmount = totalRemaining + carnetInterestValue;
    const carnetInterestLabel = carnetInterestPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });`
);

const financialPattern = /    const isCardPayment = saleType === 'direct'[\s\S]*?    const netAmountToCompany = totalCustomerPays - currentFeeValue;/;
if (!financialPattern.test(source)) {
    throw new Error('Não foi possível aplicar o novo cálculo das taxas do cartão.');
}
source = source.replace(
    financialPattern,
    `    const isCardPayment = saleType === 'direct' && (directMethod === 'credit' || directMethod === 'debit');
    const currentFeePercent = isCardPayment ? parseMoney(feePercent) : 0;
    const currentCardCalculation = isCardPayment
        ? calculateCardPayment({
            baseAmount: totalRemaining,
            installmentRate: currentFeePercent,
            transactionRate: normalizedPaymentSettings.card.transactionFeePercent,
            formula: normalizedPaymentSettings.card.calculationFormula,
            passFeesToCustomer: feeType === 'com_juros'
        })
        : {
            grossAmount: totalRemaining,
            netAmount: totalRemaining,
            totalFeeValue: 0,
            installmentFeeValue: 0,
            transactionFeeValue: 0,
            transactionRate: 0,
            customerSurchargeValue: 0,
            formula: normalizedPaymentSettings.card.calculationFormula
        };
    const currentFeeValue = currentCardCalculation.totalFeeValue;
    const currentTransactionFeeValue = currentCardCalculation.transactionFeeValue;
    const currentInstallmentFeeValue = currentCardCalculation.installmentFeeValue;
    const totalCustomerPays = saleType === 'prazo'
        ? totalCartValue + carnetInterestValue
        : isCardPayment
            ? entryValue + currentCardCalculation.grossAmount
            : totalCartValue;
    const netAmountToCompany = saleType === 'direct' && isCardPayment
        ? entryValue + currentCardCalculation.netAmount
        : totalCustomerPays;
    const summaryInstallmentsCount = saleType === 'prazo'
        ? selectedInstallmentsCount
        : directMethod === 'credit'
            ? Math.min(12, Math.max(1, parseInt(cardInstallments, 10) || 1))
            : 1;
    const summaryEntryValue = Math.min(Math.max(0, entryValue), Math.max(0, totalCustomerPays));
    const summaryFinancedValue = Math.max(0, totalCustomerPays - summaryEntryValue);
    const summaryInstallmentValue = summaryInstallmentsCount > 0
        ? summaryFinancedValue / summaryInstallmentsCount
        : 0;
    const selectedEntryRuleCustomer = customers.find(customer => customer.id === customerId) || null;
    const totalEntryRuleCost = cart.reduce((total, item) => total + (Number(item.cost) || 0), 0);`
);

const calculationPattern = /    const calculateInstallments = \(\) => \{[\s\S]*?\n    \};\s*\n    const handleFinish/;
if (!calculationPattern.test(source)) {
    throw new Error('Não foi possível corrigir os vencimentos das parcelas.');
}
source = source.replace(
    calculationPattern,
    `    const calculateInstallments = () => {
        const total = totalFinancedAmount;
        const count = parseInt(installmentsCount) || 1;
        if (total <= 0) return [];

        const amountPerInstallment = total / count;
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
                amount: amountPerInstallment,
                dueDate: currentDateStr,
                paid: false,
                paidAt: null
            });

            if (frequency === 'weekly') currentDateStr = addDays(currentDateStr, 7);
            else if (frequency === 'biweekly') currentDateStr = addDays(currentDateStr, 15);
        }

        return installments;
    };

    const handleFinish`
);

source = source.replace(
    '        if (!customerId) return alert("Selecione um cliente.");',
    '        if (saleType === \'prazo\' && !customerId) return alert("Selecione um cliente cadastrado.");'
);

const customerIdentityMarker = `        const customer = customers.find(c => c.id === customerId);
        const cName = customer ? customer.name : customerSearch;
        const cPhone = customer ? customer.phone : "";`;
if (!source.includes(customerIdentityMarker)) {
    throw new Error('Não foi possível preparar a venda avulsa.');
}
source = source.replace(
    customerIdentityMarker,
    `        const customer = customerId ? customers.find(c => c.id === customerId) : null;
        const isAnonymousDirectSale = saleType === 'direct' && !customer;
        const cName = customer ? customer.name : (isAnonymousDirectSale ? 'VENDA AVULSA' : customerSearch);
        const cPhone = customer ? customer.phone : '';`
);

source = source.replace(
    '            customerId: customerId, customerName: cName, customerPhone: cPhone, ',
    '            customerId: customer ? customer.id : null, customerName: cName, customerPhone: cPhone, anonymousSale: isAnonymousDirectSale, '
);

source = source.replace(
    `                    applied: carnetInterestPercent > 0 && carnetInterestValue > 0,
                    percent: carnetInterestPercent,`,
    `                    applied: carnetInterestPercent > 0 && carnetInterestValue > 0,
                    waived: carnetInterestWaived,
                    configuredPercent: configuredCarnetInterestPercent,
                    percent: carnetInterestPercent,`
);

const creditFlowPattern = /            setIsAnalyzingCredit\(true\);\s*\n\s*setTimeout\(\(\) => \{[\s\S]*?\n\s*\}, 2000\);\s*/;
if (!creditFlowPattern.test(source)) {
    throw new Error('Não foi possível integrar as regras à análise de crédito.');
}
source = source.replace(
    creditFlowPattern,
    `            setIsAnalyzingCredit(true);

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
                const entryRuleHasPriority = entryRuleEvaluation.ruleApplies
                    && Number(entryRuleEvaluation.requiredEntry) > 0;
                const limitFailure = !adjustedCreditAnalysis.approved
                    && adjustedCreditAnalysis.reason === 'Limite de crédito insuficiente para esta compra.';
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
                    entryAmount: entryValue,
                    frequency,
                    installmentsCount: finalInstallments.length,
                    installments: finalInstallments,
                    status: finalInstallments.length === 0 && entryValue >= totalCartValue ? 'completed' : 'active',
                    entryRuleEvaluation,
                    creditAnalysis: { approvedBySystem: true, result: combinedAnalysis }
                };

                setIsAnalyzingCredit(false);
                setApprovedSaleData(finalSaleDataToSave);
            }, 1200);

`
);

const directBranchPattern = /        \} else \{\n            let finalSalePrice = totalCartValue;[\s\S]*?            onSaveSale\(saleData\);\s*\n            onClose\(\);\n        \}/;
if (!directBranchPattern.test(source)) {
    throw new Error('Não foi possível atualizar a venda no cartão.');
}
source = source.replace(
    directBranchPattern,
    `        } else {
            const finalSalePrice = isCardPayment
                ? entryValue + currentCardCalculation.grossAmount
                : totalCartValue;
            let feeObj = null;

            if (isCardPayment) {
                feeObj = {
                    applied: currentCardCalculation.totalFeeValue > 0,
                    percent: currentFeePercent,
                    value: currentCardCalculation.totalFeeValue,
                    installmentFeePercent: currentFeePercent,
                    installmentFeeValue: currentInstallmentFeeValue,
                    transactionFeePercent: currentCardCalculation.transactionRate,
                    transactionFeeValue: currentTransactionFeeValue,
                    calculationFormula: currentCardCalculation.formula,
                    type: feeType,
                    mode: cardMode,
                    brand: cardBrand,
                    rateTableName: normalizedPaymentSettings.card.machineName,
                    baseAmount: totalRemaining,
                    grossCardAmount: currentCardCalculation.grossAmount,
                    netCardAmount: currentCardCalculation.netAmount,
                    customerSurchargeValue: currentCardCalculation.customerSurchargeValue
                };
            }

            const netReceived = isCardPayment
                ? entryValue + currentCardCalculation.netAmount
                : finalSalePrice;

            saleData = {
                ...saleData,
                productsTotal: totalCartValue,
                paymentMethod: directMethod,
                entryAmount: entryValue,
                cardAmount: isCardPayment ? currentCardCalculation.grossAmount : 0,
                netReceived,
                cardInstallments: directMethod === 'credit' ? parseInt(cardInstallments) : 1,
                installments: [],
                status: 'completed',
                totalPrice: finalSalePrice,
                feeConfig: feeObj
            };

            onSaveSale(saleData);
            onClose();
        }`
);

source = source.replace(
    "onChange: e => setFrequency(e.target.value)",
    "onChange: e => { setFrequency(e.target.value); setWaiveCarnetInterest(false); }"
);
source = source.replace(
    "onChange: e => setInstallmentsCount(e.target.value)",
    "onChange: e => { setInstallmentsCount(e.target.value); setWaiveCarnetInterest(false); }"
);

source = source.replace(
    /className: `carnet-interest-summary /,
    'className: `legacy-payment-calculation carnet-interest-summary '
);
source = source.replace(
    'className: "text-[10px] bg-orange-100 p-2 rounded text-orange-800 leading-tight space-y-1"',
    'className: "legacy-payment-calculation text-[10px] bg-orange-100 p-2 rounded text-orange-800 leading-tight space-y-1"'
);

const paymentSectionEndMarker = `                    )
                )
            )
        ),
        
        React.createElement('div', { className: "sale-bottom-bar fixed bottom-0 w-full p-4 z-40" },`;
if (!source.includes(paymentSectionEndMarker)) {
    throw new Error('Não foi possível montar o resumo de pagamento.');
}
const paymentSectionWithSummary = `                    ),
                    React.createElement('div', { className: "payment-inline-summary mt-5 pt-4 border-t border-slate-200" },
                        saleType === 'prazo' && configuredCarnetInterestPercent > 0 && React.createElement('button', {
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
        
        React.createElement('div', { className: "sale-bottom-bar fixed bottom-0 w-full p-4 z-40" },`;
source = source.replace(paymentSectionEndMarker, paymentSectionWithSummary);

const customerTitleMarker = `React.createElement('h3', { className: "font-bold text-slate-800 flex items-center gap-2" }, React.createElement(User, { className: "text-slate-400" }), "1. Cliente"),`;
if (!source.includes(customerTitleMarker)) {
    throw new Error('Não foi possível ajustar o cliente opcional no caixa.');
}
source = source.replace(
    customerTitleMarker,
    `React.createElement('h3', { className: "font-bold text-slate-800 flex items-center gap-2" }, React.createElement(User, { className: "text-slate-400" }), mode === 'prazo' ? "1. Cliente" : "1. Cliente (Opcional)"),`
);
source = source.replace(
    '                                placeholder: "Busque pelo nome do cliente...",',
    `                                placeholder: mode === 'prazo' ? "Busque pelo nome do cliente..." : "Cliente opcional — deixe em branco para venda avulsa",`
);

const analysisScreenPattern = /\n    if \(isAnalyzingCredit\) \{[\s\S]*?\n    \}\n\n    if \(approvedSaleData\)/;
if (!analysisScreenPattern.test(source)) {
    throw new Error('Não foi possível converter a análise de crédito para modal.');
}
source = source.replace(analysisScreenPattern, '\n    if (approvedSaleData)');

const approvedScreenPattern = /\n    if \(approvedSaleData\) \{[\s\S]*?\n    \}\n\n    return React\.createElement\('div', \{ className: "sale-screen fixed inset-0 z-50 flex flex-col animate-fade-in" \},/;
if (!approvedScreenPattern.test(source)) {
    throw new Error('Não foi possível converter a confirmação da venda para modal.');
}
source = source.replace(
    approvedScreenPattern,
    '\n    return React.createElement(\'div\', { className: "sale-screen fixed inset-0 z-50 flex flex-col animate-fade-in" },'
);

const creditDeniedMarker = `        creditModal.open && React.createElement('div', { className: "app-modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4" },`;
if (!source.includes(creditDeniedMarker)) {
    throw new Error('Não foi possível posicionar os modais de crédito.');
}
const creditFlowModals = `        isAnalyzingCredit && React.createElement('div', {
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
                React.createElement('div', { className: "credit-analysis-progress mt-5" }, React.createElement('span', null))
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
                        React.createElement('strong', null, (approvedSaleData.installmentsCount || summaryInstallmentsCount) + "x de " + formatCurrency(((approvedSaleData.totalPrice || totalCustomerPays) - (approvedSaleData.entryAmount || 0)) / Math.max(1, approvedSaleData.installmentsCount || summaryInstallmentsCount)))
                    )
                ),
                React.createElement('button', {
                    onClick: () => { onSaveSale(approvedSaleData); onClose(); },
                    className: "w-full py-3.5 bg-slate-900 text-emerald-400 font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                }, React.createElement(CheckCircle, { size: 20 }), "Concluir e salvar venda")
            )
        ),

${creditDeniedMarker}`;
source = source.replace(creditDeniedMarker, creditFlowModals);

source = source.replace(
    /(['"])(\.\/[^'"]+?\.js)(?:\?[^'"]*)?\1/g,
    (match, quote, modulePath) => {
        const moduleUrl = new URL(modulePath, location.href);
        moduleUrl.search = `?v=${VERSION}`;
        return `'${moduleUrl.href}'`;
    }
);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
let originalModule;
try {
    originalModule = await import(moduleUrl);
} finally {
    URL.revokeObjectURL(moduleUrl);
}

export const NewSaleScreen = originalModule.NewSaleScreen;
