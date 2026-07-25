const VERSION = '23';

const response = await fetch(`./nova-venda.js?v=${VERSION}`, { cache: 'no-store' });
if (!response.ok) {
    throw new Error(`Não foi possível carregar o formulário de vendas (${response.status}).`);
}

let source = await response.text();

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
    throw new Error('Não foi possível preparar o novo resumo de pagamento.');
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
        : 0;`);

source = source.replace(
    /className: `carnet-interest-summary /,
    'className: `legacy-payment-calculation carnet-interest-summary '
);

source = source.replace(
    'className: "text-[10px] bg-orange-100 p-2 rounded text-orange-800 leading-tight space-y-1"',
    'className: "legacy-payment-calculation text-[10px] bg-orange-100 p-2 rounded text-orange-800 leading-tight space-y-1"'
);

const bottomBarPattern = /(\n\s*)React\.createElement\('div', \{ className: "sale-bottom-bar fixed bottom-0 w-full p-4 z-40" \},/;
if (!bottomBarPattern.test(source)) {
    throw new Error('Não foi possível localizar o rodapé da venda para inserir o resumo.');
}

const paymentSummary = `
        React.createElement('div', { className: "sale-payment-summary-shell" },
            React.createElement('div', { className: "payment-standard-summary rounded-xl border border-slate-200 bg-slate-50 overflow-hidden" },
                React.createElement('div', { className: "payment-standard-summary-title px-4 py-3 border-b border-slate-200 bg-white" },
                    React.createElement('p', { className: "text-xs font-black text-slate-700 uppercase tracking-wide" }, "Resumo do pagamento")
                ),
                React.createElement('div', { className: "payment-standard-summary-grid p-4" },
                    React.createElement('div', { className: "payment-summary-row" },
                        React.createElement('span', null, "Valor total da venda"),
                        React.createElement('strong', null, formatCurrency(totalCustomerPays))
                    ),
                    React.createElement('div', { className: "payment-summary-row" },
                        React.createElement('span', null, "Valor da entrada"),
                        React.createElement('strong', null, formatCurrency(summaryEntryValue))
                    ),
                    React.createElement('div', { className: "payment-summary-row" },
                        React.createElement('span', null, "Valor parcelado"),
                        React.createElement('strong', null, formatCurrency(summaryFinancedValue))
                    ),
                    React.createElement('div', { className: "payment-summary-row payment-summary-installments" },
                        React.createElement('span', null, "Parcelamento"),
                        React.createElement('strong', null, summaryFinancedValue > 0
                            ? summaryInstallmentsCount + "x de " + formatCurrency(summaryInstallmentValue)
                            : "Sem valor parcelado")
                    )
                )
            )
        ),`;

source = source.replace(bottomBarPattern, (match, spacing) => {
    return paymentSummary + spacing + 'React.createElement(\'div\', { className: "sale-bottom-bar fixed bottom-0 w-full p-4 z-40" },';
});

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
