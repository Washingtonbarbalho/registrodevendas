const formatCurrency = val => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
}).format(val || 0);
const parseMoney = valStr => {
  if (!valStr) return 0;
  if (typeof valStr === 'number') return valStr;
  const clean = valStr.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
};
const maskMoney = value => {
  if (value === undefined || value === null) return "0,00";
  let v = String(value).replace(/\D/g, "");
  v = (v / 100).toFixed(2) + "";
  v = v.replace(".", ",");
  v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
  return v;
};
const maskPhone = v => {
  v = v.replace(/\D/g, "");
  v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
  v = v.replace(/(\d)(\d{4})$/, "$1-$2");
  return v;
};
const maskCpfCnpj = v => {
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
const maskCep = v => {
  v = v.replace(/\D/g, "");
  v = v.replace(/^(\d{5})(\d)/, "$1-$2");
  return v.slice(0, 9);
};
const formatDateTime = dateStr => {
  if (!dateStr) return '--/--/---- --:--';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
};
const getBrazilDateString = () => {
  const date = new Date();
  return date.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Sao_Paulo'
  }).split('/').reverse().join('-');
};
const toDateFromFirestoreValue = value => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const resolveSaleHistoryDate = sale => {
  const createdAtDate = toDateFromFirestoreValue(sale?.createdAt);
  if (createdAtDate) return createdAtDate.toISOString();
  if (sale?.saleDate) return `${sale.saleDate}T12:00:00`;
  return new Date().toISOString();
};
const resolveCanceledSaleHistoryDate = sale => {
  const canceledAtDate = toDateFromFirestoreValue(sale?.canceledAt);
  if (canceledAtDate) return canceledAtDate.toISOString();
  if (sale?.saleDate) return `${sale.saleDate}T12:00:01`;
  return new Date().toISOString();
};

export { formatCurrency, parseMoney, maskMoney, maskPhone, maskCpfCnpj, maskCep, formatDateTime, getBrazilDateString, toDateFromFirestoreValue, resolveSaleHistoryDate, resolveCanceledSaleHistoryDate };
