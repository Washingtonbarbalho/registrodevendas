const VERSION = '28';

const response = await fetch(`./nova-venda.js?v=${VERSION}`, { cache: 'no-store' });
if (!response.ok) {
    throw new Error(`Não foi possível carregar o formulário de vendas (${response.status}).`);
}

let source = await response.text();

source = source.replace(
    "import { getCardRate, getCarnetRate, normalizePaymentSettings } from './payment-settings.js';",
    "import { getCardRate, getCarnetRate, normalizePaymentSettings, evaluateTermSaleRules } from './payment-settings.js';"
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

if (!calculationPattern.test(source)) throw new Error('Não foi possível aplicar a regra mensal de vencimentos.');
source = source.replace(calculationPattern, correctedCalculation);

const financialMarker = '    const netAmountToCompany = totalCustomerPays - currentFeeValue;';
if (!source.includes(financialMarker)) throw new Error('Não foi possível preparar o resumo e as regras da venda.');
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
    const selectedRuleCustomer = customers.find(customer => customer.id === customerId) || null;
    const totalRuleCost = cart.reduce((total, item) => total + (Number(item.cost) || 0), 0);
    const currentTermRuleEvaluation = saleType === 'prazo' && selectedRuleCustomer
        ? evaluateTermSaleRules({
            settings: normalizedPaymentSettings,
            customer: selectedRuleCustomer,
            sales,
            entryAmount: entryValue,
            totalCost: totalRuleCost,
            financedAmount: totalFinancedAmount,
            installmentsCount: selectedInstallmentsCount
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

if (!source.includes(originalAnalysisFlow)) throw new Error('Não foi possível integrar as regras à análise da venda.');
const enhancedAnalysisFlow = `            setIsAnalyzingCredit(true);

            setTimeout(() => {
                const requestedAmount = totalFinancedAmount;
                const initialAnalysis = analyzeCustomerCredit(customer, requestedAmount, sales);
                const interestMultiplier = 1 + (carnetInterestPercent / 100);
                const adjustedCreditAnalysis = initialAnalysis.suggestedEntry > 0 && interestMultiplier > 1
                    ? { ...initialAnalysis, suggestedEntry: initialAnalysis.suggestedEntry / interestMultiplier }
                    : initialAnalysis;
                const ruleEvaluation = evaluateTermSaleRules({
                    settings: normalizedPaymentSettings,
                    customer,
                    sales,
                    entryAmount: entryValue,
                    totalCost: totalRuleCost,
                    financedAmount: totalFinancedAmount,
                    installmentsCount: selectedInstallmentsCount
                });
                const hasCreditFailure = !adjustedCreditAnalysis.approved;
                const hasRuleFailure = !ruleEvaluation.approved;
                const combinedReason = hasCreditFailure && hasRuleFailure
                    ? "A análise de crédito e as regras configuradas não foram atendidas."
                    : hasCreditFailure
                        ? adjustedCreditAnalysis.reason
                        : "A venda não atende às regras configuradas para o crediário.";
                const combinedAnalysis = {
                    ...adjustedCreditAnalysis,
                    approved: !hasCreditFailure && !hasRuleFailure,
                    creditApproved: adjustedCreditAnalysis.approved,
                    reason: combinedReason,
                    suggestedEntry: Math.max(
                        Number(adjustedCreditAnalysis.suggestedEntry) || 0,
                        Number(ruleEvaluation.requiredEntry) || 0
                    ),
                    ruleEvaluation
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
                    appliedTermRules: ruleEvaluation,
                    creditAnalysis: { approvedBySystem: true, result: combinedAnalysis, ruleEvaluation }
                };

                setIsAnalyzingCredit(false);
                setApprovedSaleData(finalSaleDataToSave);
            }, 1200); `;
source = source.replace(originalAnalysisFlow, enhancedAnalysisFlow);

const originalManualApproval = `    const handleManualApprove = () => {
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
    };`;

if (!source.includes(originalManualApproval)) throw new Error('Não foi possível atualizar a autorização manual.');
const enhancedManualApproval = `    const closeCreditDecision = () => {
        setCreditModal({ open: false, result: null, pendingSaleData: null, manualReason: '' });
    };

    const handleManualApprove = async () => {
        const { pendingSaleData, manualReason, result } = creditModal;
        if (!manualReason.trim()) return alert("Você precisa digitar a justificativa para autorizar a exceção.");

        const finalInstallments = calculateInstallments();
        const authorizedAt = new Date().toISOString();
        const saleDataToSave = {
            ...pendingSaleData,
            entryAmount: entryValue,
            frequency,
            installmentsCount: finalInstallments.length,
            installments: finalInstallments,
            status: finalInstallments.length === 0 && entryValue >= totalCartValue ? 'completed' : 'active',
            appliedTermRules: result?.ruleEvaluation || null,
            ruleException: {
                authorized: true,
                reason: manualReason.trim(),
                authorizedAt,
                authorizedBy: {
                    uid: user?.uid || '',
                    email: user?.email || ''
                },
                violations: result?.ruleEvaluation?.violations || []
            },
            creditAnalysis: {
                approvedBySystem: false,
                manualApprovalReason: manualReason.trim(),
                result
            }
        };

        await onSaveSale(saleDataToSave);
        closeCreditDecision();
        onClose();
    };

    const handleCancelRejectedSale = async () => {
        const { pendingSaleData, result } = creditModal;
        if (!pendingSaleData) return;
        const canceledAt = new Date().toISOString();
        const itemsWithoutInventoryMovement = (pendingSaleData.items || []).map(item => ({
            ...item,
            originalProductId: item.productId || null,
            productId: null
        }));
        const canceledSaleData = {
            ...pendingSaleData,
            items: itemsWithoutInventoryMovement,
            entryAmount: entryValue,
            frequency,
            installmentsCount: selectedInstallmentsCount,
            installments: [],
            status: 'canceled',
            canceledAt,
            cancelReason: 'Venda cancelada durante a análise de crédito e regras.',
            cancellationType: 'credit_rules_rejection',
            affectsInventory: false,
            affectsFinancials: false,
            attemptedConditions: {
                entryAmount: entryValue,
                financedAmount: totalFinancedAmount,
                installmentsCount: selectedInstallmentsCount,
                frequency,
                firstDueDate
            },
            appliedTermRules: result?.ruleEvaluation || null,
            creditAnalysis: {
                approvedBySystem: false,
                canceledBeforeApproval: true,
                result
            }
        };

        await onSaveSale(canceledSaleData);
        closeCreditDecision();
        onClose();
    };`;
source = source.replace(originalManualApproval, enhancedManualApproval);

const entryFieldMarker = `                        React.createElement('div', null, React.createElement('label', { className: "block text-xs font-bold text-slate-500 uppercase mb-1" }, "Entrada (Opcional)"), React.createElement(MoneyInput, { value: entryAmount, onChange: setEntryAmount, className: "w-full p-3 pl-8 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500" })),`;
if (!source.includes(entryFieldMarker)) throw new Error('Não foi possível mostrar as regras no pagamento.');
const entryFieldWithRules = `${entryFieldMarker}
                        currentTermRuleEvaluation && Object.values(currentTermRuleEvaluation.activeRules || {}).some(Boolean) && React.createElement('div', { className: \`term-rule-preview \${currentTermRuleEvaluation.approved ? 'is-approved' : 'has-violations'}\` },
                            React.createElement('div', { className: "term-rule-preview-heading" },
                                React.createElement(currentTermRuleEvaluation.approved ? CheckCircle : ShieldAlert, { size: 17 }),
                                React.createElement('strong', null, currentTermRuleEvaluation.approved ? "Condições dentro das regras" : "Condições precisam de ajuste")
                            ),
                            currentTermRuleEvaluation.activeRules.firstPurchaseCostEntry && currentTermRuleEvaluation.isFirstPurchase && React.createElement('p', null,
                                "Entrada mínima desta primeira compra: ", React.createElement('strong', null, formatCurrency(currentTermRuleEvaluation.requiredEntry))
                            ),
                            currentTermRuleEvaluation.activeRules.progressiveInstallments && React.createElement('p', null,
                                "Histórico: ", React.createElement('strong', null, currentTermRuleEvaluation.paidOnTimeCount + " pagamento(s) em dia"),
                                " · permitido até ", React.createElement('strong', null, currentTermRuleEvaluation.allowedMaxInstallments + "x")
                            ),
                            currentTermRuleEvaluation.activeRules.minimumInstallment && React.createElement('p', null,
                                "Parcela mínima: ", React.createElement('strong', null, formatCurrency(currentTermRuleEvaluation.minimumInstallmentAmount)),
                                " · parcela atual: ", React.createElement('strong', null, formatCurrency(currentTermRuleEvaluation.installmentAmount))
                            )
                        ),`;
source = source.replace(entryFieldMarker, entryFieldWithRules);

source = source.replace(/className: `carnet-interest-summary /, 'className: `legacy-payment-calculation carnet-interest-summary ');
source = source.replace(
    'className: "text-[10px] bg-orange-100 p-2 rounded text-orange-800 leading-tight space-y-1"',
    'className: "legacy-payment-calculation text-[10px] bg-orange-100 p-2 rounded text-orange-800 leading-tight space-y-1"'
);

const paymentSectionEndMarker = `                    )
                )
            )
        ),
        
        React.createElement('div', { className: "sale-bottom-bar fixed bottom-0 w-full p-4 z-40" },`;
if (!source.includes(paymentSectionEndMarker)) throw new Error('Não foi possível localizar o final da seção de pagamento.');
const paymentSectionWithSummary = `                    ),
                    React.createElement('div', { className: "payment-inline-summary mt-5 pt-4 border-t border-slate-200" },
                        React.createElement('p', { className: "payment-inline-summary-title text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3" }, "Resumo do pagamento"),
                        React.createElement('div', { className: "payment-inline-summary-grid" },
                            React.createElement('div', { className: "payment-inline-summary-row" }, React.createElement('span', null, "Valor total da venda"), React.createElement('strong', null, formatCurrency(totalCustomerPays))),
                            React.createElement('div', { className: "payment-inline-summary-row" }, React.createElement('span', null, "Valor da entrada"), React.createElement('strong', null, formatCurrency(summaryEntryValue))),
                            React.createElement('div', { className: "payment-inline-summary-row" }, React.createElement('span', null, "Valor parcelado"), React.createElement('strong', null, formatCurrency(summaryFinancedValue))),
                            React.createElement('div', { className: "payment-inline-summary-row payment-inline-summary-installments" }, React.createElement('span', null, "Parcelamento"), React.createElement('strong', null, summaryInstallmentsCount + "x de " + formatCurrency(summaryInstallmentValue)))
                        )
                    )
                )
            )
        ),
        
        React.createElement('div', { className: "sale-bottom-bar fixed bottom-0 w-full p-4 z-40" },`;
source = source.replace(paymentSectionEndMarker, paymentSectionWithSummary);

const analysisScreenPattern = /\n    if \(isAnalyzingCredit\) \{[\s\S]*?\n    \}\n\n    if \(approvedSaleData\)/;
if (!analysisScreenPattern.test(source)) throw new Error('Não foi possível converter a análise de crédito para modal.');
source = source.replace(analysisScreenPattern, '\n    if (approvedSaleData)');

const approvedScreenPattern = /\n    if \(approvedSaleData\) \{[\s\S]*?\n    \}\n\n    return React\.createElement\('div', \{ className: "sale-screen fixed inset-0 z-50 flex flex-col animate-fade-in" \},/;
if (!approvedScreenPattern.test(source)) throw new Error('Não foi possível converter a confirmação de venda aprovada para modal.');
source = source.replace(approvedScreenPattern, '\n    return React.createElement(\'div\', { className: "sale-screen fixed inset-0 z-50 flex flex-col animate-fade-in" },');

source = source.replace('"Venda Reprovada"', '"Condições não aprovadas"');
source = source.replace('"Motivo da Liberação Manual (Obrigatório)"', '"Justificativa para autorizar exceção (obrigatória)"');
source = source.replace('placeholder: "Ex: Conheço o cliente, prometeu pagar amanhã..."', 'placeholder: "Explique por que esta venda pode ser autorizada fora das regras..."');

const suggestionMarker = `                    creditModal.result?.suggestedEntry > 0 && React.createElement('div', { className: "credit-denied-suggestion bg-blue-50 p-3 rounded-xl border border-blue-100" },`;
if (!source.includes(suggestionMarker)) throw new Error('Não foi possível exibir as regras reprovadas.');
const violationsBlock = `                    creditModal.result?.ruleEvaluation?.violations?.length > 0 && React.createElement('div', { className: "credit-rule-violations" },
                        React.createElement('p', { className: "credit-rule-violations-title" }, "Regras não atendidas"),
                        creditModal.result.ruleEvaluation.violations.map(violation => React.createElement('div', { className: "credit-rule-violation", key: violation.code },
                            React.createElement(ShieldAlert, { size: 16 }),
                            React.createElement('div', null,
                                React.createElement('strong', null, violation.title),
                                React.createElement('p', null, violation.message),
                                violation.code === 'first_purchase_cost_entry' && React.createElement('span', null, "Entrada exigida: " + formatCurrency(violation.requiredEntry) + " · faltam " + formatCurrency(violation.shortage)),
                                violation.code === 'progressive_installment_limit' && React.createElement('span', null, "Solicitado: " + violation.requestedInstallments + "x · permitido: " + violation.allowedMaxInstallments + "x"),
                                violation.code === 'minimum_installment_value' && React.createElement('span', null, "Parcela atual: " + formatCurrency(violation.installmentAmount) + " · mínimo: " + formatCurrency(violation.minimumInstallmentAmount))
                            )
                        ))
                    ),

${suggestionMarker}`;
source = source.replace(suggestionMarker, violationsBlock);

const originalFooter = `                React.createElement('div', { className: "desktop-modal-footer credit-denied-footer mt-6 flex flex-col gap-3" },
                    React.createElement('button', { 
                        onClick: handleManualApprove, 
                        disabled: !creditModal.manualReason.trim(),
                        className: "w-full py-3 bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:bg-red-600 transition-colors disabled:opacity-50 disabled:shadow-none" 
                    }, "Assumir Risco e Aprovar Manualmente"),
                    React.createElement('button', { 
                        onClick: () => setCreditModal({ open: false, result: null, pendingSaleData: null, manualReason: '' }), 
                        className: "w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors" 
                    }, "Voltar e Ajustar Venda")
                )`;
if (!source.includes(originalFooter)) throw new Error('Não foi possível atualizar as ações da reprovação.');
const decisionFooter = `                React.createElement('div', { className: "desktop-modal-footer credit-denied-footer credit-decision-footer mt-6" },
                    React.createElement('button', {
                        onClick: handleCancelRejectedSale,
                        className: "credit-decision-button is-cancel"
                    }, "Cancelar venda"),
                    React.createElement('button', {
                        onClick: closeCreditDecision,
                        className: "credit-decision-button is-correct"
                    }, "Corrigir condições"),
                    React.createElement('button', {
                        onClick: handleManualApprove,
                        disabled: !creditModal.manualReason.trim(),
                        className: "credit-decision-button is-authorize"
                    }, "Autorizar exceção")
                )`;
source = source.replace(originalFooter, decisionFooter);

const creditDeniedMarker = `        creditModal.open && React.createElement('div', { className: "app-modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4" },`;
if (!source.includes(creditDeniedMarker)) throw new Error('Não foi possível posicionar os modais da análise de crédito.');
const creditFlowModals = `        isAnalyzingCredit && React.createElement('div', {
            className: "app-modal-overlay credit-analysis-modal-overlay fixed inset-0 z-[110] flex items-center justify-center p-4 backdrop-blur-sm",
            role: "dialog", 'aria-modal': "true", 'aria-label': "Analisando crédito e regras"
        },
            React.createElement('div', { className: "app-modal-panel credit-analysis-modal bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-fade-in text-center" },
                React.createElement('div', { className: "w-16 h-16 mx-auto mb-5 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center" }, React.createElement(RefreshCw, { size: 30, className: "animate-spin" })),
                React.createElement('h2', { className: "text-xl font-black text-slate-800 mb-2" }, "Analisando venda"),
                React.createElement('p', { className: "text-sm text-slate-500 leading-relaxed" }, "Avaliando crédito, histórico de pagamentos e regras configuradas para o crediário."),
                React.createElement('div', { className: "credit-analysis-progress mt-5" }, React.createElement('span', null))
            )
        ),

        approvedSaleData && React.createElement('div', {
            className: "app-modal-overlay sale-approved-modal-overlay fixed inset-0 z-[110] flex items-center justify-center p-4 backdrop-blur-sm",
            role: "dialog", 'aria-modal': "true", 'aria-label': "Venda a prazo aprovada"
        },
            React.createElement('div', { className: "app-modal-panel sale-approved-modal bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-fade-in text-center" },
                React.createElement('div', { className: "sale-approved-icon w-16 h-16 mx-auto mb-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center" }, React.createElement(ThumbsUp, { size: 30 })),
                React.createElement('h2', { className: "text-xl font-black text-slate-800 mb-2" }, "Venda aprovada!"),
                React.createElement('p', { className: "text-sm text-slate-500 leading-relaxed mb-5" }, "A análise de crédito e as regras do crediário foram atendidas."),
                React.createElement('div', { className: "sale-approved-summary mb-5" },
                    React.createElement('div', null, React.createElement('span', null, "Total da venda"), React.createElement('strong', null, formatCurrency(approvedSaleData.totalPrice || totalCustomerPays))),
                    React.createElement('div', null, React.createElement('span', null, "Parcelamento"), React.createElement('strong', null, (approvedSaleData.installmentsCount || summaryInstallmentsCount) + "x de " + formatCurrency((approvedSaleData.totalPrice - (approvedSaleData.entryAmount || 0)) / Math.max(1, approvedSaleData.installmentsCount || summaryInstallmentsCount))))
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
