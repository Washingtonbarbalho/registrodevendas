const VERSION = '65';
const nativeFetch = globalThis.fetch;

const shouldPatchBase = input => {
  try {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    return !!raw && new URL(raw, location.href).pathname.endsWith('/nova-venda.js');
  } catch { return false; }
};

const patchDiscountReason = source => {
  const stateMarker = "    const [currentDiscount, setCurrentDiscount] = useState(''); \n";
  if (!source.includes(stateMarker)) throw new Error('Não foi possível preparar o motivo do desconto.');
  source = source.replace(stateMarker, stateMarker + "    const [currentDiscountReason, setCurrentDiscountReason] = useState('');\n");

  const validationMarker = "        if(!selectedProductId || unitPrice < 0 || qty <= 0) return;";
  source = source.replace(validationMarker, `${validationMarker}\n        if (unitDiscount > 0 && !currentDiscountReason.trim()) return alert("Informe o motivo do desconto antes de adicionar o produto.");`);

  const itemMarker = "            unitCost: currentCost, unitDiscount: unitDiscount \n";
  if (!source.includes(itemMarker)) throw new Error('Não foi possível salvar o motivo do desconto no item.');
  source = source.replace(itemMarker, "            unitCost: currentCost, unitDiscount: unitDiscount, discountReason: unitDiscount > 0 ? currentDiscountReason.trim() : '' \n");

  const resetMarker = "        setSelectedProductId(''); setCurrentQty(1); setCurrentCost(0); setCurrentPrice(''); setBaseUnitPrice(0); setCurrentDiscount(''); setProductSearch('');";
  if (!source.includes(resetMarker)) throw new Error('Não foi possível limpar o motivo do desconto após adicionar o item.');
  source = source.replace(resetMarker, "        setSelectedProductId(''); setCurrentQty(1); setCurrentCost(0); setCurrentPrice(''); setBaseUnitPrice(0); setCurrentDiscount(''); setCurrentDiscountReason(''); setProductSearch('');");

  const buttonMarker = `                        React.createElement('button', { onClick: handleAddItem, disabled: !selectedProductId || currentQty < 1, className: "w-full py-3 bg-slate-800 text-white rounded-lg font-bold text-sm disabled:opacity-50 hover:bg-slate-700 transition-colors flex justify-center gap-2 items-center" }, React.createElement(PlusCircle, { size: 16 }), "Adicionar no Carrinho"),`;
  if (!source.includes(buttonMarker)) throw new Error('Não foi possível inserir o campo de motivo do desconto.');
  const reasonUi = `                        parseMoney(currentDiscount) > 0 && React.createElement('div', { className: "mt-2" },
                            React.createElement('label', { className: "block text-[10px] font-bold text-slate-500 uppercase mb-1" }, "Motivo do desconto *"),
                            React.createElement('input', { type: "text", value: currentDiscountReason, onChange: e => setCurrentDiscountReason(e.target.value), placeholder: "Ex.: negociação, cliente recorrente, avaria estética...", className: \`w-full p-3 border border-slate-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 \${mode === 'prazo' ? 'focus:ring-yellow-500' : 'focus:ring-emerald-500'}\` })
                        ),
${buttonMarker}`;
  source = source.replace(buttonMarker, reasonUi);
  return source;
};

globalThis.fetch = async (input, init) => {
  const response = await nativeFetch.call(globalThis, input, init);
  if (!shouldPatchBase(input) || !response.ok) return response;
  const source = patchDiscountReason(await response.text());
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/javascript; charset=utf-8');
  return new Response(source, { status: response.status, statusText: response.statusText, headers });
};

let finalModule;
try {
  finalModule = await import(new URL('./nova-venda-fixed-v60.js?v=' + VERSION, location.href).href);
} finally {
  globalThis.fetch = nativeFetch;
}
if (typeof finalModule?.NewSaleScreen !== 'function') throw new Error('A Nova Venda com motivo de desconto não foi carregada.');
export const NewSaleScreen = finalModule.NewSaleScreen;
