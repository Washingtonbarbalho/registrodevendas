export const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

export const parseMoney = (valStr) => {
    if (!valStr) return 0;
    if (typeof valStr === 'number') return valStr;
    const clean = valStr.replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
};

export const maskMoney = (value) => {
    if(value === undefined || value === null) return "0,00";
    let v = String(value).replace(/\D/g, "");
    v = (v / 100).toFixed(2) + "";
    v = v.replace(".", ",");
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    return v;
};

export const maskPhone = (v) => {
    v = v.replace(/\D/g, "");
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    return v;
};

export const maskCpfCnpj = (v) => {
    v = v.replace(/\D/g, "");
    if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
        v = v.replace(/^(\d{2})(\d)/, "$1.$2");
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
        v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
        v = v.replace(/(\d{4})(\d)/, "$1-$2");
    }
    return v;
};

export const maskCep = (v) => {
    v = v.replace(/\D/g, "");
    v = v.replace(/^(\d{5})(\d)/, "$1-$2");
    return v.slice(0, 9);
};

export const applyPixMask = (val, type) => {
    if (!val) return '';
    if (type === 'cpf_cnpj') return maskCpfCnpj(val);
    if (type === 'phone') return maskPhone(val);
    return val;
};

export const formatDate = (dateStr) => {
    if (!dateStr) return '--/--/----';
    const isoDate = dateStr.split('T')[0];
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
};

export const getBrazilDateString = () => {
    const date = new Date();
    return date.toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
};

export const addDays = (dateStr, days) => {
    const date = new Date(dateStr + 'T12:00:00');
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
};

export const getCurrentMonthStart = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
};

export const getCurrentMonthEnd = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
};

export const formatPixKeyForPayload = (key, type) => {
    if (!key) return '';
    let cleanKey = key.trim();
    if (type === 'phone') {
        cleanKey = cleanKey.replace(/\D/g, '');
        if (!cleanKey.startsWith('55')) cleanKey = '55' + cleanKey;
        return '+' + cleanKey;
    }
    if (type === 'cpf_cnpj') return cleanKey.replace(/\D/g, '');
    return cleanKey;
};

export const generatePixPayload = (pixKey, pixType, pixName, pixCity, amount, txid = "***") => {
    const formattedKey = formatPixKeyForPayload(pixKey, pixType);
    if (!formattedKey) return '';
    const tlv = (id, value) => { const len = String(value.length).padStart(2, '0'); return `${id}${len}${value}`; };
    const cleanStr = (str) => { return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 25).trim().toUpperCase() || "NOME"; };
    const mName = cleanStr(pixName || "LOJA");
    const mCity = cleanStr(pixCity || "BRASIL").substring(0, 15);
    const amtStr = Number(amount).toFixed(2);
    let payload = "";
    payload += tlv("00", "01");
    const gui = tlv("00", "br.gov.bcb.pix");
    const key = tlv("01", formattedKey);
    payload += tlv("26", gui + key);
    payload += tlv("52", "0000");
    payload += tlv("53", "986");
    if (amount > 0) payload += tlv("54", amtStr);
    payload += tlv("58", "BR");
    payload += tlv("59", mName);
    payload += tlv("60", mCity);
    const txidTlv = tlv("05", txid.replace(/[^a-zA-Z0-9]/g, "").substring(0, 25) || "***");
    payload += tlv("62", txidTlv);
    payload += "6304";
    const getCRC16 = (str) => {
        let crc = 0xFFFF;
        for (let i = 0; i < str.length; i++) {
            crc ^= str.charCodeAt(i) << 8;
            for (let j = 0; j < 8; j++) {
                if ((crc & 0x8000) > 0) crc = (crc << 1) ^ 0x1021;
                else crc = crc << 1;
            }
        }
        return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    };
    return payload + getCRC16(payload);
};

export const analyzeCustomerCredit = (customerObj, requestedAmount, allSales) => {
    if (!customerObj) return { approved: false, reason: "Cliente não encontrado para análise.", availableLimit: 0, currentDebt: 0, calculatedLimit: 0, creditActive: false };

    const customerSales = allSales.filter(s =>
        s.customerId === customerObj.id
        && (s.saleType === 'prazo' || !s.saleType)
        && s.cancellationType !== 'credit_rules_rejection'
        && s.affectsCredit !== false
    );
    const today = getBrazilDateString();
    const creditActive = customerObj.creditEnabled !== false;
    const ignoreOverdue = customerObj.creditIgnoreOverdue === true;

    let hasOverdue = false;
    let currentDebt = 0;
    let paidOnTimeCount = 0;
    let paidLateCount = 0;
    let canceledSalesCount = 0;

    customerSales.forEach(s => {
        if (s.status === 'canceled') {
            canceledSalesCount++;
        } else {
            (s.installments || []).forEach(inst => {
                if (!inst.paid) {
                    currentDebt += Number(inst.amount) || 0;
                    if (inst.dueDate < today) hasOverdue = true;
                } else if (inst.paidAt && inst.paidAt > inst.dueDate) {
                    paidLateCount++;
                } else {
                    paidOnTimeCount++;
                }
            });
        }
    });

    const baseLimit = 150;
    const income = Number(customerObj.income) || 0;
    const absoluteMaxLimit = income > 0 ? income * 0.40 : 300;
    let automaticLimit = baseLimit + (paidOnTimeCount * 50) - (paidLateCount * 20) - (canceledSalesCount * 100);
    automaticLimit = Math.max(0, Math.min(automaticLimit, absoluteMaxLimit));

    const hasManualLimit = customerObj.creditLimit !== undefined && customerObj.creditLimit !== null && customerObj.creditLimit !== '';
    const manualLimit = hasManualLimit ? Math.max(0, Number(customerObj.creditLimit) || 0) : null;
    const calculatedLimit = hasManualLimit ? manualLimit : automaticLimit;
    const availableLimit = creditActive ? Math.max(0, calculatedLimit - currentDebt) : 0;
    const baseResult = {
        availableLimit,
        calculatedLimit,
        automaticLimit,
        currentDebt,
        hasOverdue,
        creditActive,
        limitSource: hasManualLimit ? 'manual' : 'automatic'
    };

    if (!creditActive) {
        return { ...baseResult, approved: false, reason: "Cliente inativo para novas compras a prazo." };
    }

    if (hasOverdue && !ignoreOverdue) {
        return { ...baseResult, approved: false, reason: "Cliente bloqueado por inadimplência. Possui parcelas ativas em atraso." };
    }

    if (requestedAmount > availableLimit) {
        const suggestedEntry = requestedAmount - availableLimit;
        return { ...baseResult, approved: false, reason: "Limite de crédito insuficiente para esta compra.", suggestedEntry };
    }

    return {
        ...baseResult,
        approved: true,
        reason: hasManualLimit ? "Crédito aprovado pelo limite personalizado do cliente." : "Crédito aprovado com base no histórico do cliente."
    };
};
