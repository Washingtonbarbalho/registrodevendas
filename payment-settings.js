const CARD_INSTALLMENT_LIMIT = 12;

const DEFAULT_CARD_CREDIT_RATES = {
    presencial: {
        visa_master: [0, 3.15, 5.39, 6.12, 6.85, 7.57, 8.28, 8.99, 9.69, 10.38, 11.06, 11.74, 12.40],
        outras: [0, 4.91, 6.47, 7.20, 7.92, 8.63, 9.33, 10.03, 10.72, 11.41, 12.08, 12.75, 13.41]
    },
    link: [0, 4.20, 6.09, 7.01, 7.91, 8.80, 9.67, 12.59, 13.42, 14.25, 15.06, 15.87, 16.66]
};

const EMPTY_CARNET_RATES = Array.from({ length: CARD_INSTALLMENT_LIMIT + 1 }, () => 0);

export const DEFAULT_TERM_SALES_RULES = Object.freeze({
    firstPurchaseCostEntry: {
        enabled: false
    },
    progressiveInstallments: {
        enabled: false,
        firstPurchaseMax: 3,
        levels: [
            { minOnTimePayments: 1, maxInstallments: 4 },
            { minOnTimePayments: 3, maxInstallments: 6 },
            { minOnTimePayments: 6, maxInstallments: 9 },
            { minOnTimePayments: 10, maxInstallments: 12 }
        ]
    },
    minimumInstallment: {
        enabled: false,
        amount: 30
    },
    manualExceptions: {
        enabled: true
    }
});

export const DEFAULT_PAYMENT_SETTINGS = Object.freeze({
    version: 2,
    card: {
        machineName: 'Tabela padrão',
        presencial: {
            debito: {
                visa_master: 1.37,
                outras: 2.58
            },
            credito: DEFAULT_CARD_CREDIT_RATES.presencial
        },
        link: {
            debito: 4.20,
            credito: DEFAULT_CARD_CREDIT_RATES.link
        }
    },
    carnet: {
        weekly: EMPTY_CARNET_RATES,
        biweekly: EMPTY_CARNET_RATES,
        monthly: EMPTY_CARNET_RATES
    },
    termSalesRules: DEFAULT_TERM_SALES_RULES
});

export const parseRatePercent = (value, fallback = 0) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : fallback;
    }

    const raw = String(value ?? '').trim().replace('%', '').replace(/\s/g, '');
    if (!raw) return fallback;
    const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(100, Math.max(0, parsed));
};

const parseMoneySetting = (value, fallback = 0) => {
    if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, value) : fallback;
    const raw = String(value ?? '').trim().replace(/R\$/gi, '').replace(/\s/g, '');
    if (!raw) return fallback;
    const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
};

const clampInteger = (value, minimum, maximum, fallback) => {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(maximum, Math.max(minimum, parsed));
};

const normalizeRateArray = (values, defaults) => {
    const source = Array.isArray(values) ? values : [];
    return Array.from({ length: CARD_INSTALLMENT_LIMIT + 1 }, (_, index) => {
        if (index === 0) return 0;
        const fallback = parseRatePercent(defaults?.[index], 0);
        return parseRatePercent(source[index], fallback);
    });
};

const normalizeProgressiveLevels = levels => {
    const source = Array.isArray(levels) ? levels : [];
    return DEFAULT_TERM_SALES_RULES.progressiveInstallments.levels.map((defaultLevel, index) => {
        const level = source[index] && typeof source[index] === 'object' ? source[index] : {};
        return {
            minOnTimePayments: clampInteger(level.minOnTimePayments, 0, 999, defaultLevel.minOnTimePayments),
            maxInstallments: clampInteger(level.maxInstallments, 1, CARD_INSTALLMENT_LIMIT, defaultLevel.maxInstallments)
        };
    });
};

export const normalizePaymentSettings = (settings = {}) => {
    const source = settings && typeof settings === 'object' ? settings : {};
    const card = source.card && typeof source.card === 'object' ? source.card : {};
    const presencial = card.presencial && typeof card.presencial === 'object' ? card.presencial : {};
    const presencialDebit = presencial.debito && typeof presencial.debito === 'object' ? presencial.debito : {};
    const presencialCredit = presencial.credito && typeof presencial.credito === 'object' ? presencial.credito : {};
    const link = card.link && typeof card.link === 'object' ? card.link : {};
    const carnet = source.carnet && typeof source.carnet === 'object' ? source.carnet : {};
    const rules = source.termSalesRules && typeof source.termSalesRules === 'object'
        ? source.termSalesRules
        : {};
    const firstPurchaseCostEntry = rules.firstPurchaseCostEntry && typeof rules.firstPurchaseCostEntry === 'object'
        ? rules.firstPurchaseCostEntry
        : {};
    const progressiveInstallments = rules.progressiveInstallments && typeof rules.progressiveInstallments === 'object'
        ? rules.progressiveInstallments
        : {};
    const minimumInstallment = rules.minimumInstallment && typeof rules.minimumInstallment === 'object'
        ? rules.minimumInstallment
        : {};

    return {
        version: 2,
        card: {
            machineName: String(card.machineName || DEFAULT_PAYMENT_SETTINGS.card.machineName).trim().slice(0, 80) || DEFAULT_PAYMENT_SETTINGS.card.machineName,
            presencial: {
                debito: {
                    visa_master: parseRatePercent(presencialDebit.visa_master, DEFAULT_PAYMENT_SETTINGS.card.presencial.debito.visa_master),
                    outras: parseRatePercent(presencialDebit.outras, DEFAULT_PAYMENT_SETTINGS.card.presencial.debito.outras)
                },
                credito: {
                    visa_master: normalizeRateArray(presencialCredit.visa_master, DEFAULT_PAYMENT_SETTINGS.card.presencial.credito.visa_master),
                    outras: normalizeRateArray(presencialCredit.outras, DEFAULT_PAYMENT_SETTINGS.card.presencial.credito.outras)
                }
            },
            link: {
                debito: parseRatePercent(link.debito, DEFAULT_PAYMENT_SETTINGS.card.link.debito),
                credito: normalizeRateArray(link.credito, DEFAULT_PAYMENT_SETTINGS.card.link.credito)
            }
        },
        carnet: {
            weekly: normalizeRateArray(carnet.weekly, DEFAULT_PAYMENT_SETTINGS.carnet.weekly),
            biweekly: normalizeRateArray(carnet.biweekly, DEFAULT_PAYMENT_SETTINGS.carnet.biweekly),
            monthly: normalizeRateArray(carnet.monthly, DEFAULT_PAYMENT_SETTINGS.carnet.monthly)
        },
        termSalesRules: {
            firstPurchaseCostEntry: {
                enabled: firstPurchaseCostEntry.enabled === true
            },
            progressiveInstallments: {
                enabled: progressiveInstallments.enabled === true,
                firstPurchaseMax: clampInteger(
                    progressiveInstallments.firstPurchaseMax,
                    1,
                    CARD_INSTALLMENT_LIMIT,
                    DEFAULT_TERM_SALES_RULES.progressiveInstallments.firstPurchaseMax
                ),
                levels: normalizeProgressiveLevels(progressiveInstallments.levels)
            },
            minimumInstallment: {
                enabled: minimumInstallment.enabled === true,
                amount: parseMoneySetting(minimumInstallment.amount, DEFAULT_TERM_SALES_RULES.minimumInstallment.amount)
            },
            manualExceptions: {
                enabled: true
            }
        }
    };
};

export const clonePaymentSettings = settings => JSON.parse(JSON.stringify(normalizePaymentSettings(settings)));

const safeInstallmentCount = installments => Math.min(
    CARD_INSTALLMENT_LIMIT,
    Math.max(1, parseInt(installments, 10) || 1)
);

export const getCardRate = (settings, { mode, method, brand, installments }) => {
    const normalized = normalizePaymentSettings(settings);
    const safeMode = mode === 'link' ? 'link' : 'presencial';
    const safeMethod = method === 'debit' ? 'debit' : 'credit';
    const safeBrand = brand === 'outras' ? 'outras' : 'visa_master';
    const count = safeInstallmentCount(installments);

    if (safeMode === 'link') {
        return safeMethod === 'debit'
            ? normalized.card.link.debito
            : normalized.card.link.credito[count];
    }

    return safeMethod === 'debit'
        ? normalized.card.presencial.debito[safeBrand]
        : normalized.card.presencial.credito[safeBrand][count];
};

export const getCarnetRate = (settings, frequency, installments) => {
    const normalized = normalizePaymentSettings(settings);
    const safeFrequency = ['weekly', 'biweekly', 'monthly'].includes(frequency) ? frequency : 'monthly';
    return normalized.carnet[safeFrequency][safeInstallmentCount(installments)];
};

const cleanDate = value => String(value || '').split('T')[0];

export const getCustomerTermRuleHistory = (customer, allSales = []) => {
    if (!customer) {
        return {
            validPurchases: [],
            validPurchaseCount: 0,
            paidOnTimeCount: 0,
            paidLateCount: 0,
            isFirstPurchase: true
        };
    }

    const validPurchases = (Array.isArray(allSales) ? allSales : []).filter(sale => {
        const isSameCustomer = sale.customerId === customer.id;
        const isTermSale = sale.saleType === 'prazo' || !sale.saleType;
        return isSameCustomer && isTermSale && sale.status !== 'canceled';
    });

    let paidOnTimeCount = 0;
    let paidLateCount = 0;

    validPurchases.forEach(sale => {
        (sale.installments || []).forEach(installment => {
            if (!installment.paid) return;
            const paidDate = cleanDate(installment.paidAt);
            const dueDate = cleanDate(installment.dueDate);
            if (paidDate && dueDate && paidDate > dueDate) paidLateCount += 1;
            else paidOnTimeCount += 1;
        });
    });

    return {
        validPurchases,
        validPurchaseCount: validPurchases.length,
        paidOnTimeCount,
        paidLateCount,
        isFirstPurchase: validPurchases.length === 0
    };
};

export const evaluateTermSaleRules = ({
    settings,
    customer,
    sales = [],
    entryAmount = 0,
    totalCost = 0,
    financedAmount = 0,
    installmentsCount = 1
}) => {
    const normalized = normalizePaymentSettings(settings);
    const rules = normalized.termSalesRules;
    const history = getCustomerTermRuleHistory(customer, sales);
    const safeEntry = Math.max(0, Number(entryAmount) || 0);
    const safeCost = Math.max(0, Number(totalCost) || 0);
    const safeFinanced = Math.max(0, Number(financedAmount) || 0);
    const safeInstallments = safeInstallmentCount(installmentsCount);
    const violations = [];

    let allowedMaxInstallments = CARD_INSTALLMENT_LIMIT;
    if (rules.progressiveInstallments.enabled) {
        allowedMaxInstallments = rules.progressiveInstallments.firstPurchaseMax;
        [...rules.progressiveInstallments.levels]
            .sort((a, b) => a.minOnTimePayments - b.minOnTimePayments)
            .forEach(level => {
                if (history.paidOnTimeCount >= level.minOnTimePayments) {
                    allowedMaxInstallments = Math.max(allowedMaxInstallments, level.maxInstallments);
                }
            });
        allowedMaxInstallments = Math.min(CARD_INSTALLMENT_LIMIT, Math.max(1, allowedMaxInstallments));
    }

    const requiredEntry = rules.firstPurchaseCostEntry.enabled && history.isFirstPurchase
        ? Math.min(safeCost, safeCost)
        : 0;

    if (requiredEntry > 0 && safeEntry + 0.005 < requiredEntry) {
        violations.push({
            code: 'first_purchase_cost_entry',
            title: 'Entrada mínima da primeira compra',
            message: `A primeira compra a prazo exige entrada de pelo menos o custo dos produtos.`,
            requiredEntry,
            currentEntry: safeEntry,
            shortage: Math.max(0, requiredEntry - safeEntry)
        });
    }

    if (rules.progressiveInstallments.enabled && safeInstallments > allowedMaxInstallments) {
        violations.push({
            code: 'progressive_installment_limit',
            title: 'Limite progressivo de parcelas',
            message: `O histórico atual deste cliente permite no máximo ${allowedMaxInstallments}x.`,
            allowedMaxInstallments,
            requestedInstallments: safeInstallments,
            paidOnTimeCount: history.paidOnTimeCount
        });
    }

    const installmentAmount = safeInstallments > 0 ? safeFinanced / safeInstallments : 0;
    const minimumInstallmentAmount = rules.minimumInstallment.amount;
    const maxInstallmentsByMinimumValue = minimumInstallmentAmount > 0 && safeFinanced > 0
        ? Math.max(1, Math.min(CARD_INSTALLMENT_LIMIT, Math.floor(safeFinanced / minimumInstallmentAmount)))
        : CARD_INSTALLMENT_LIMIT;

    if (
        rules.minimumInstallment.enabled
        && safeFinanced > 0
        && installmentAmount + 0.005 < minimumInstallmentAmount
    ) {
        violations.push({
            code: 'minimum_installment_value',
            title: 'Valor mínimo da parcela',
            message: `Cada parcela deve ter valor mínimo configurado.`,
            minimumInstallmentAmount,
            installmentAmount,
            maxInstallmentsByMinimumValue,
            requestedInstallments: safeInstallments
        });
    }

    return {
        approved: violations.length === 0,
        violations,
        history,
        isFirstPurchase: history.isFirstPurchase,
        paidOnTimeCount: history.paidOnTimeCount,
        paidLateCount: history.paidLateCount,
        allowedMaxInstallments,
        requiredEntry,
        installmentAmount,
        minimumInstallmentAmount,
        maxInstallmentsByMinimumValue,
        activeRules: {
            firstPurchaseCostEntry: rules.firstPurchaseCostEntry.enabled,
            progressiveInstallments: rules.progressiveInstallments.enabled,
            minimumInstallment: rules.minimumInstallment.enabled,
            manualExceptions: true
        }
    };
};

export const PAYMENT_FREQUENCIES = Object.freeze([
    { id: 'weekly', label: 'Semanal' },
    { id: 'biweekly', label: 'Quinzenal' },
    { id: 'monthly', label: 'Mensal' }
]);

export const PAYMENT_INSTALLMENT_LIMIT = CARD_INSTALLMENT_LIMIT;
