const CARD_INSTALLMENT_LIMIT = 12;

const DEFAULT_CARD_CREDIT_RATES = {
    presencial: {
        visa_master: [0, 3.15, 5.39, 6.12, 6.85, 7.57, 8.28, 8.99, 9.69, 10.38, 11.06, 11.74, 12.40],
        outras: [0, 4.91, 6.47, 7.20, 7.92, 8.63, 9.33, 10.03, 10.72, 11.41, 12.08, 12.75, 13.41]
    },
    link: [0, 4.20, 6.09, 7.01, 7.91, 8.80, 9.67, 12.59, 13.42, 14.25, 15.06, 15.87, 16.66]
};

const EMPTY_CARNET_RATES = Array.from({ length: CARD_INSTALLMENT_LIMIT + 1 }, () => 0);

export const CARD_CALCULATION_METHODS = Object.freeze([
    { id: 'infinitepay', label: 'Fórmula InfinitePay' },
    { id: 'sale_total', label: 'Taxa sobre o total da venda' }
]);

export const DEFAULT_TERM_ENTRY_RULES = Object.freeze({
    firstPurchaseCostEntry: { enabled: false },
    lateLastPurchaseCostEntry: { enabled: false, daysLate: 5 }
});

export const DEFAULT_PAYMENT_SETTINGS = Object.freeze({
    version: 3,
    card: {
        machineName: 'Tabela padrão',
        calculationMethod: 'infinitepay',
        transactionFeePercent: 0,
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
    termEntryRules: DEFAULT_TERM_ENTRY_RULES
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

const normalizeCalculationMethod = value => value === 'sale_total' ? 'sale_total' : 'infinitepay';

export const normalizePaymentSettings = (settings = {}) => {
    const source = settings && typeof settings === 'object' ? settings : {};
    const card = source.card && typeof source.card === 'object' ? source.card : {};
    const presencial = card.presencial && typeof card.presencial === 'object' ? card.presencial : {};
    const presencialDebit = presencial.debito && typeof presencial.debito === 'object' ? presencial.debito : {};
    const presencialCredit = presencial.credito && typeof presencial.credito === 'object' ? presencial.credito : {};
    const link = card.link && typeof card.link === 'object' ? card.link : {};
    const carnet = source.carnet && typeof source.carnet === 'object' ? source.carnet : {};
    const entryRules = source.termEntryRules && typeof source.termEntryRules === 'object' ? source.termEntryRules : {};
    const legacyRules = source.termSalesRules && typeof source.termSalesRules === 'object' ? source.termSalesRules : {};
    const firstPurchaseCostEntry = entryRules.firstPurchaseCostEntry && typeof entryRules.firstPurchaseCostEntry === 'object'
        ? entryRules.firstPurchaseCostEntry
        : legacyRules.firstPurchaseCostEntry && typeof legacyRules.firstPurchaseCostEntry === 'object'
            ? legacyRules.firstPurchaseCostEntry
            : {};
    const lateLastPurchaseCostEntry = entryRules.lateLastPurchaseCostEntry && typeof entryRules.lateLastPurchaseCostEntry === 'object'
        ? entryRules.lateLastPurchaseCostEntry
        : {};

    return {
        version: 3,
        card: {
            machineName: String(card.machineName || DEFAULT_PAYMENT_SETTINGS.card.machineName).trim().slice(0, 80) || DEFAULT_PAYMENT_SETTINGS.card.machineName,
            calculationMethod: normalizeCalculationMethod(card.calculationMethod),
            transactionFeePercent: parseRatePercent(card.transactionFeePercent, DEFAULT_PAYMENT_SETTINGS.card.transactionFeePercent),
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
        termEntryRules: {
            firstPurchaseCostEntry: { enabled: firstPurchaseCostEntry.enabled === true },
            lateLastPurchaseCostEntry: {
                enabled: lateLastPurchaseCostEntry.enabled === true,
                daysLate: clampInteger(lateLastPurchaseCostEntry.daysLate, 0, 3650, DEFAULT_TERM_ENTRY_RULES.lateLastPurchaseCostEntry.daysLate)
            }
        }
    };
};

export const clonePaymentSettings = settings => JSON.parse(JSON.stringify(normalizePaymentSettings(settings)));

const safeInstallmentCount = installments => Math.min(CARD_INSTALLMENT_LIMIT, Math.max(1, parseInt(installments, 10) || 1));

export const getCardRate = (settings, { mode, method, brand, installments }) => {
    const normalized = normalizePaymentSettings(settings);
    const safeMode = mode === 'link' ? 'link' : 'presencial';
    const safeMethod = method === 'debit' ? 'debit' : 'credit';
    const safeBrand = brand === 'outras' ? 'outras' : 'visa_master';
    const count = safeInstallmentCount(installments);
    if (safeMode === 'link') {
        return safeMethod === 'debit' ? normalized.card.link.debito : normalized.card.link.credito[count];
    }
    return safeMethod === 'debit' ? normalized.card.presencial.debito[safeBrand] : normalized.card.presencial.credito[safeBrand][count];
};

export const calculateCardPayment = (settings, {
    mode,
    method,
    brand,
    installments,
    baseAmount = 0,
    feeType = 'sem_juros',
    rateOverride = null
} = {}) => {
    const normalized = normalizePaymentSettings(settings);
    const base = Math.max(0, Number(baseAmount) || 0);
    const ratePercent = rateOverride === null || rateOverride === undefined
        ? getCardRate(normalized, { mode, method, brand, installments })
        : parseRatePercent(rateOverride, 0);
    const transactionPercent = parseRatePercent(normalized.card.transactionFeePercent, 0);
    const installmentRate = Math.min(0.999999, ratePercent / 100);
    const transactionRate = transactionPercent / 100;
    const transactionFee = base * transactionRate;
    const customerPaysFees = feeType === 'com_juros';
    const calculationMethod = normalized.card.calculationMethod;

    let grossAmount = base;
    let installmentFee = base * installmentRate;

    if (customerPaysFees) {
        if (calculationMethod === 'infinitepay') {
            grossAmount = (base + transactionFee) / Math.max(0.000001, 1 - installmentRate);
            installmentFee = grossAmount * installmentRate;
        } else {
            installmentFee = base * installmentRate;
            grossAmount = base + transactionFee + installmentFee;
        }
    }

    const totalFee = transactionFee + installmentFee;
    const netAmount = Math.max(0, grossAmount - totalFee);

    return {
        calculationMethod,
        customerPaysFees,
        baseAmount: base,
        grossAmount,
        netAmount,
        ratePercent,
        transactionPercent,
        installmentFee,
        transactionFee,
        totalFee,
        surcharge: Math.max(0, grossAmount - base)
    };
};

export const getCarnetRate = (settings, frequency, installments) => {
    const normalized = normalizePaymentSettings(settings);
    const safeFrequency = ['weekly', 'biweekly', 'monthly'].includes(frequency) ? frequency : 'monthly';
    return normalized.carnet[safeFrequency][safeInstallmentCount(installments)];
};

const cleanDate = value => String(value || '').split('T')[0];
const dateToUtcTimestamp = value => {
    const [year, month, day] = cleanDate(value).split('-').map(Number);
    if (!year || !month || !day) return null;
    return Date.UTC(year, month - 1, day);
};
const calculateLateDays = (paidAt, dueDate) => {
    const paidTimestamp = dateToUtcTimestamp(paidAt);
    const dueTimestamp = dateToUtcTimestamp(dueDate);
    if (paidTimestamp === null || dueTimestamp === null) return 0;
    return Math.max(0, Math.floor((paidTimestamp - dueTimestamp) / 86400000));
};
const getValidCustomerTermSales = (customer, allSales = []) => {
    if (!customer) return [];
    return (Array.isArray(allSales) ? allSales : [])
        .filter(sale => sale.customerId === customer.id && (sale.saleType === 'prazo' || !sale.saleType) && sale.status !== 'canceled')
        .sort((a, b) => String(b.saleDate || '').localeCompare(String(a.saleDate || '')) || String(b.id || '').localeCompare(String(a.id || '')));
};

export const evaluateTermEntryRules = ({ settings, customer, sales = [], entryAmount = 0, totalCost = 0 }) => {
    const normalized = normalizePaymentSettings(settings);
    const rules = normalized.termEntryRules;
    const validPurchases = getValidCustomerTermSales(customer, sales);
    const isFirstPurchase = validPurchases.length === 0;
    const lastPurchase = validPurchases[0] || null;
    const safeEntry = Math.max(0, Number(entryAmount) || 0);
    const safeCost = Math.max(0, Number(totalCost) || 0);
    const lateDaysThreshold = rules.lateLastPurchaseCostEntry.daysLate;
    const latePaymentsInLastPurchase = lastPurchase
        ? (lastPurchase.installments || [])
            .filter(installment => installment.paid && installment.paidAt && installment.dueDate)
            .map(installment => ({
                installmentNumber: installment.number,
                paidAt: installment.paidAt,
                dueDate: installment.dueDate,
                daysLate: calculateLateDays(installment.paidAt, installment.dueDate)
            }))
            .filter(payment => payment.daysLate > lateDaysThreshold)
        : [];
    const triggeredByFirstPurchase = rules.firstPurchaseCostEntry.enabled && isFirstPurchase;
    const triggeredByLateLastPurchase = rules.lateLastPurchaseCostEntry.enabled && latePaymentsInLastPurchase.length > 0;
    const ruleApplies = triggeredByFirstPurchase || triggeredByLateLastPurchase;
    const requiredEntry = ruleApplies ? safeCost : 0;
    const shortage = Math.max(0, requiredEntry - safeEntry);
    const approved = !ruleApplies || shortage < 0.005;
    const reasons = [];
    if (triggeredByFirstPurchase) reasons.push('Primeira compra a prazo do cliente.');
    if (triggeredByLateLastPurchase) {
        const highestDelay = Math.max(...latePaymentsInLastPurchase.map(payment => payment.daysLate));
        reasons.push(`A última compra teve parcela paga com ${highestDelay} dias de atraso, acima do limite de ${lateDaysThreshold} dias.`);
    }
    return {
        approved,
        ruleApplies,
        requiredEntry,
        currentEntry: safeEntry,
        shortage,
        isFirstPurchase,
        lastPurchaseId: lastPurchase?.id || null,
        lastPurchaseDate: lastPurchase?.saleDate || null,
        lateDaysThreshold,
        latePaymentsInLastPurchase,
        triggeredByFirstPurchase,
        triggeredByLateLastPurchase,
        reasons,
        activeRules: {
            firstPurchaseCostEntry: rules.firstPurchaseCostEntry.enabled,
            lateLastPurchaseCostEntry: rules.lateLastPurchaseCostEntry.enabled
        }
    };
};

export const PAYMENT_FREQUENCIES = Object.freeze([
    { id: 'weekly', label: 'Semanal' },
    { id: 'biweekly', label: 'Quinzenal' },
    { id: 'monthly', label: 'Mensal' }
]);
export const PAYMENT_INSTALLMENT_LIMIT = CARD_INSTALLMENT_LIMIT;
