const VERSION = '33';

const response = await fetch(`./nova-venda-fixed.js?v=${VERSION}`, { cache: 'no-store' });
if (!response.ok) {
    throw new Error(`Não foi possível carregar o formulário de vendas ajustado (${response.status}).`);
}

let source = await response.text();

if (!source.includes("const VERSION = '29';")) {
    throw new Error('Não foi possível atualizar a versão do formulário de vendas.');
}
source = source.replace("const VERSION = '29';", `const VERSION = '${VERSION}';`);

const previousCreditPriority = `                const creditFailed = !adjustedCreditAnalysis.approved;
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
                };`;

if (!source.includes(previousCreditPriority)) {
    throw new Error('Não foi possível localizar a prioridade das regras de entrada.');
}

const costEntryPriority = `                const entryRuleApplies = entryRuleEvaluation.ruleApplies;
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
                };`;

source = source.replace(previousCreditPriority, costEntryPriority);

const finalSourceMarker = "const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));";
if (!source.includes(finalSourceMarker)) {
    throw new Error('Não foi possível preparar as melhorias da venda a prazo.');
}

const featurePatch = String.raw`
const waiverStateMarker = "    const [firstDueDate, setFirstDueDate] = useState('');";
if (!source.includes(waiverStateMarker)) {
    throw new Error('Não foi possível adicionar o seletor de juros da negociação.');
}
source = source.replace(
    waiverStateMarker,
    waiverStateMarker + "\n    const [waiveCarnetInterest, setWaiveCarnetInterest] = useState(false);"
);

const filteredProductsMarker = "    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.includes(productSearch));";
if (!source.includes(filteredProductsMarker)) {
    throw new Error('Não foi possível organizar os produtos da busca da venda.');
}
source = source.replace(
    filteredProductsMarker,
    [
        "    const filteredProducts = products",
        "        .filter(p => String(p.name || '').toLowerCase().includes(productSearch.toLowerCase()) || String(p.code || '').includes(productSearch))",
        "        .sort((a, b) => {",
        "            const aHasStock = (Number(a.quantity) || 0) > 0;",
        "            const bHasStock = (Number(b.quantity) || 0) > 0;",
        "            if (aHasStock !== bHasStock) return aHasStock ? -1 : 1;",
        "            return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' });",
        "        });"
    ].join("\n")
);

const interestCalculationPattern = /    const carnetInterestPercent = saleType === 'prazo'[\s\S]*?    const carnetInterestLabel = carnetInterestPercent\.toLocaleString\('pt-BR', \{ minimumFractionDigits: 2, maximumFractionDigits: 4 \}\);/;
if (!interestCalculationPattern.test(source)) {
    throw new Error('Não foi possível ajustar o cálculo dos juros do carnê.');
}
source = source.replace(
    interestCalculationPattern,
    [
        "    const configuredCarnetInterestPercent = saleType === 'prazo'",
        "        ? getCarnetRate(normalizedPaymentSettings, frequency, selectedInstallmentsCount)",
        "        : 0;",
        "    const carnetInterestWaived = saleType === 'prazo' && waiveCarnetInterest && configuredCarnetInterestPercent > 0;",
        "    const carnetInterestPercent = carnetInterestWaived ? 0 : configuredCarnetInterestPercent;",
        "    const carnetInterestValue = saleType === 'prazo' ? totalRemaining * (carnetInterestPercent / 100) : 0;",
        "    const totalFinancedAmount = totalRemaining + carnetInterestValue;",
        "    const carnetInterestLabel = carnetInterestPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });",
        "    const configuredCarnetInterestLabel = configuredCarnetInterestPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });"
    ].join("\n")
);

const interestAuditMarker = "                    applied: carnetInterestPercent > 0 && carnetInterestValue > 0,\n                    percent: carnetInterestPercent,";
if (!source.includes(interestAuditMarker)) {
    throw new Error('Não foi possível registrar a negociação sem juros.');
}
source = source.replace(
    interestAuditMarker,
    "                    applied: carnetInterestPercent > 0 && carnetInterestValue > 0,\n                    waived: carnetInterestWaived,\n                    configuredPercent: configuredCarnetInterestPercent,\n                    percent: carnetInterestPercent,"
);

source = source.replace(
    "onChange: e => setFrequency(e.target.value)",
    "onChange: e => { setFrequency(e.target.value); setWaiveCarnetInterest(false); }"
);
source = source.replace(
    "onChange: e => setInstallmentsCount(e.target.value)",
    "onChange: e => { setInstallmentsCount(e.target.value); setWaiveCarnetInterest(false); }"
);

const paymentSummaryTitleMarker = "                        React.createElement('p', { className: \"payment-inline-summary-title text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3\" }, \"Resumo do pagamento\"),";
if (!source.includes(paymentSummaryTitleMarker)) {
    throw new Error('Não foi possível posicionar o seletor de negociação sem juros.');
}
const paymentSummaryTitleWithWaiver = [
    "                        configuredCarnetInterestPercent > 0 && React.createElement('button', {",
    "                            type: \"button\",",
    "                            onClick: () => setWaiveCarnetInterest(previous => !previous),",
    "                            className: \"w-full mb-4 p-3 rounded-xl border flex items-center justify-between gap-3 text-left transition-colors \" + (carnetInterestWaived ? \"bg-emerald-50 border-emerald-200\" : \"bg-amber-50 border-amber-200\"),",
    "                            'aria-pressed': carnetInterestWaived",
    "                        },",
    "                            React.createElement('div', { className: \"min-w-0\" },",
    "                                React.createElement('strong', { className: carnetInterestWaived ? \"block text-sm text-emerald-800\" : \"block text-sm text-amber-800\" }, \"Liberar esta venda sem juros\"),",
    "                                React.createElement('span', { className: carnetInterestWaived ? \"block mt-1 text-[11px] text-emerald-700\" : \"block mt-1 text-[11px] text-amber-700\" }, carnetInterestWaived",
    "                                    ? \"Negociação especial ativa: os \" + configuredCarnetInterestLabel + \"% configurados foram retirados somente desta venda.\"",
    "                                    : \"Este plano possui \" + configuredCarnetInterestLabel + \"% de juros. Ative para zerar somente nesta negociação.\"",
    "                                )",
    "                            ),",
    "                            React.createElement('span', { className: \"shrink-0 w-11 h-6 rounded-full p-1 transition-colors \" + (carnetInterestWaived ? \"bg-emerald-500\" : \"bg-slate-300\") },",
    "                                React.createElement('span', { className: \"block w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform \" + (carnetInterestWaived ? \"translate-x-5\" : \"translate-x-0\") })",
    "                            )",
    "                        ),",
    paymentSummaryTitleMarker
].join("\n");
source = source.replace(paymentSummaryTitleMarker, paymentSummaryTitleWithWaiver);
`;

source = source.replace(finalSourceMarker, featurePatch + '\n' + finalSourceMarker);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
let patchedModule;
try {
    patchedModule = await import(moduleUrl);
} finally {
    URL.revokeObjectURL(moduleUrl);
}

export const NewSaleScreen = patchedModule.NewSaleScreen;
