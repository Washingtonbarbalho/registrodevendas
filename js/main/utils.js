const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const parseMoney = (valStr) => {
    if (!valStr) return 0;
    if (typeof valStr === 'number') return valStr;
    const clean = valStr.replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
};

const maskMoney = (value) => {
    if(value === undefined || value === null) return "0,00";
    let v = String(value).replace(/\D/g, "");
    v = (v / 100).toFixed(2) + "";
    v = v.replace(".", ",");
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    return v;
};

const maskPhone = (v) => {
    v = v.replace(/\D/g, "");
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    return v;
};

const maskCpfCnpj = (v) => {
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

const maskCep = (v) => {
    v = v.replace(/\D/g, "");
    v = v.replace(/^(\d{5})(\d)/, "$1-$2");
    return v.slice(0, 9);
};

const applyPixMask = (val, type) => {
    if (!val) return '';
    if (type === 'cpf_cnpj') return maskCpfCnpj(val);
    if (type === 'phone') return maskPhone(val);
    return val;
};

const formatDate = (dateStr) => {
    if (!dateStr) return '--/--/----';
    const isoDate = dateStr.split('T')[0];
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
};

const getBrazilDateString = () => {
    const date = new Date();
    return date.toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
};

const addDays = (dateStr, days) => {
    const date = new Date(dateStr + 'T12:00:00'); 
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
};

const getCurrentMonthStart = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
};

const getCurrentMonthEnd = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
};


// --- COMPONENTES DE UI ---

export { formatCurrency, parseMoney, maskMoney, maskPhone, maskCpfCnpj, maskCep, applyPixMask, formatDate, getBrazilDateString, addDays, getCurrentMonthStart, getCurrentMonthEnd };
