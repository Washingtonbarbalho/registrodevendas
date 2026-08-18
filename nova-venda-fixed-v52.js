const VERSION = '52';
const nativeFetch = globalThis.fetch;
const marker = "            saleDate: saleDate, saleType: saleType, status: 'active'";
const replacement = "            saleDate: saleDate, saleDateTime: new Date().toISOString(), saleType: saleType, status: 'active'";

const shouldPatch = input => {
  try {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    return !!raw && new URL(raw, location.href).pathname.endsWith('/nova-venda.js');
  } catch { return false; }
};

globalThis.fetch = async (input, init) => {
  const response = await nativeFetch.call(globalThis, input, init);
  if (!shouldPatch(input) || !response.ok) return response;
  let source = await response.text();
  if (!source.includes(marker)) throw new Error('Não foi possível registrar o horário real da nova venda.');
  source = source.replace(marker, replacement);
  const headers = new Headers(response.headers); headers.set('content-type', 'text/javascript; charset=utf-8');
  return new Response(source, { status: response.status, statusText: response.statusText, headers });
};

let finalModule;
try { finalModule = await import(`./nova-venda-fixed-v52-core.js?v=${VERSION}`); }
finally { globalThis.fetch = nativeFetch; }
if (!finalModule?.NewSaleScreen) throw new Error('O formulário de vendas v52 não foi carregado corretamente.');
export const NewSaleScreen = finalModule.NewSaleScreen;
