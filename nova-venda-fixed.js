const VERSION = '29';

const response = await fetch(`./nova-venda.js?v=${VERSION}`, { cache: 'no-store' });
if (!response.ok) {
    throw new Error(`Não foi possível carregar o formulário de vendas (${response.status}).`);
}

let source = await response.text();

const paymentImport = "import { getCardRate, getCarnetRate, normalizePaymentSettings } from './payment-settings.js';";
if (!source.includes(paymentImport)) {
    throw new Error('Não foi possível carregar as regras de entrada do carnê.');
}
source = source.replace(
    paymentImport,
    "import { getCardRate, getCarnetRate, normalizePaymentSettings, evaluateTermEntryRules } from './payment-settings.js';"
);

const calculationPattern = /    const calculateInstallments = \(\) => \{[\s\S]*?\n    \};\s*\n    const handleFinish/;

const correctedCalculation = `    const calculateInstallments = () => {
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

    const handleFinish`;

if (!calculationPattern.test(source)) {
    throw new Error('Não foi possível aplicar a regra mensal de vencimentos.');
}
source = source.replace(calculationPattern, correctedCalculation);

const financialMarker = '    const netAmountToCompany = totalCustomerPays - currentFeeValue;';
if (!source.includes(financialMarker)) {
    throw new Error('Não foi possível preparar o resumo de pagamento.');
}

source = source.replace(financialMarker, `${financialMarker}
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
    const totalEntryRuleCost = cart.reduce((total, item) => total + (Number(item.cost) || 0), 0);
    const currentEntryRuleEvaluation = saleType === 'prazo' && selectedEntryRuleCustomer
        ? evaluateTermEntryRules({
            settings: normalizedPaymentSettings,
            customer: selectedEntryRuleCustomer,
            sales,
            entryAmount: entryValue,
            totalCost: totalEntryRuleCost
        })
        : null;`);

const originalAnalysisFlow = `            setIsAnalyzingCredit(true); 

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

            }, 2000); `;

if (!source.includes(originalAnalysisFlow)) {
    throw new Error('Não foi possível integrar as regras de entrada à análise da venda.');
}

const enhancedAnalysisFlow = `            setIsAnalyzingCredit(true); 

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
                const creditFailed = !adjustedCreditAnalysis.approved;
                const entryRuleFailed = !entryRuleEvaluation.approved;
                const ruleReason = entryRuleEvaluation.reasons.join(' ');
                const combinedAnalysis = {
                    ...adjustedCreditAnalysis,
                    approved: !creditFailed && !entryRuleFailed,
                    creditApproved: adjustedCreditAnalysis.approved,
                    reason: creditFailed && entryRuleFailed
                        ? adjustedCreditAnalysis.reason + ' ' + ruleReason
                        : creditFailed
                            ? adjustedCreditAnalysis.reason
                            : ruleReason,
                    suggestedEntry: Math.max(
                        Number(adjustedCreditAnalysis.suggestedEntry) || 0,
                        Number(entryRuleEvaluation.requiredEntry) || 0
                    ),
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

            }, 1200); `;

source = source.replace(originalAnalysisFlow, enhancedAnalysisFlow);

const entryFieldMarker = `                        React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Entrada (Opcional)"), React.createElement(MoneyInput, { value: entryAmount, onChange: setEntryAmount, className: "w-full p-3 pl-8 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500" })),`;
if (!source.includes(entryFieldMarker)) {
    throw new Error('Não foi possível mostrar a regra de entrada no formulário.');
}

const entryFieldWithRule = `${entryFieldMarker}
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
                        ),`;

source = source.replace(entryFieldMarker, entryFieldWithRule);

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
    throw new Error('Não foi possível localizar o final da seção de pagamento.');
}

const paymentSectionWithSummary = `                    ),
                    React.createElement('div', { className: "payment-inline-summary mt-5 pt-4 border-t border-slate-200" },
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

const analysisScreenPattern = /\n    if \(isAnalyzingCredit\) \{[\s\S]*?\n    \}\n\n    if \(approvedSaleData\)/;
if (!analysisScreenPattern.test(source)) {
    throw new Error('Não foi possível converter a análise de crédito para modal.');
}
source = source.replace(analysisScreenPattern, '\n    if (approvedSaleData)');

const approvedScreenPattern = /\n    if \(approvedSaleData\) \{[\s\S]*?\n    \}\n\n    return React\.createElement\('div', \{ className: "sale-screen fixed inset-0 z-50 flex flex-col animate-fade-in" \},/;
if (!approvedScreenPattern.test(source)) {
    throw new Error('Não foi possível converter a confirmação de venda aprovada para modal.');
}
source = source.replace(
    approvedScreenPattern,
    '\n    return React.createElement(\'div\', { className: "sale-screen fixed inset-0 z-50 flex flex-col animate-fade-in" },'
);

const creditDeniedMarker = `        creditModal.open && React.createElement('div', { className: "app-modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4" },`;
if (!source.includes(creditDeniedMarker)) {
    throw new Error('Não foi possível posicionar os modais da análise de crédito.');
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
