const response = await fetch('./customer-history-modal.js?v=52', { cache: 'no-store' });
if (!response.ok) throw new Error('Não foi possível carregar o histórico de compras do cliente.');
let source = await response.text();

const typeMarker = "const getSaleTypeLabel = sale => sale.saleType === 'direct' ? 'Venda à vista' : 'Venda a prazo';";
if (!source.includes(typeMarker)) throw new Error('Não foi possível preparar a data e hora do histórico de compras.');
source = source.replace(typeMarker, `${typeMarker}\n\nconst formatSaleMoment = sale => {\n    const date = formatDate(sale?.saleDate);\n    if (sale?.saleDateTime) {\n        const parsed = new Date(sale.saleDateTime);\n        if (!Number.isNaN(parsed.getTime())) return date + ' · ' + parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });\n    }\n    return date + ' · --:--';\n};`);

source = source.replace(
  ".sort((a, b) => String(b.saleDate || '').localeCompare(String(a.saleDate || '')));",
  ".sort((a, b) => String(b.saleDateTime || b.saleDate || '').localeCompare(String(a.saleDateTime || a.saleDate || '')));"
);
source = source.replace(
  "`${formatDate(sale.saleDate)} · ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`",
  "`${formatSaleMoment(sale)} · ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`"
);
source = source.replace(/from\s+(['"])(\.\/[^'"]+)\1/g, (match, quote, path) => {
  const url = new URL(path, location.href); url.search = '?v=52'; return `from '${url.href}'`;
});

const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
let module;
try { module = await import(blobUrl); }
finally { URL.revokeObjectURL(blobUrl); }
if (typeof module?.CustomerPurchaseHistoryModal !== 'function') throw new Error('O histórico de compras não foi exportado corretamente.');
export const CustomerPurchaseHistoryModal = module.CustomerPurchaseHistoryModal;
