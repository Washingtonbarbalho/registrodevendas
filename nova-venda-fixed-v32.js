const VERSION = '32';

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
                const limitFailure = !adjustedCreditAnalysis.approved
                    && Number(adjustedCreditAnalysis.suggestedEntry) > 0;
                const limitIgnoredByEntryRule = entryRuleApplies && limitFailure;
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
                    suggestedEntry: entryRuleApplies
                        ? (entryRuleFailed ? Number(entryRuleEvaluation.requiredEntry) || 0 : 0)
                        : Number(adjustedCreditAnalysis.suggestedEntry) || 0,
                    entryRuleEvaluation
                };`;

source = source.replace(previousCreditPriority, costEntryPriority);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
let patchedModule;
try {
    patchedModule = await import(moduleUrl);
} finally {
    URL.revokeObjectURL(moduleUrl);
}

export const NewSaleScreen = patchedModule.NewSaleScreen;
