const VERSION = '49';
const nativeFetch = globalThis.fetch;

const saleDateMarker = "            saleDate: saleDate, saleType: saleType, status: 'active'";
const saleDateReplacement = "            saleDate: saleDate, saleDateTime: `${saleDate}T${new Date().toTimeString().slice(0, 8)}`, saleType: saleType, status: 'active'";

const shouldPatch = input => {
  try {
    const rawUrl = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    if (!rawUrl) return false;
    return new URL(rawUrl, location.href).pathname.endsWith('/nova-venda.js');
  } catch {
    return false;
  }
};

globalThis.fetch = async (input, init) => {
  const response = await nativeFetch.call(globalThis, input, init);
  if (!shouldPatch(input) || !response.ok) return response;

  let source = await response.text();
  if (!source.includes(saleDateMarker)) {
    throw new Error('Não foi possível adicionar o horário exato ao registro da venda.');
  }
  source = source.replace(saleDateMarker, saleDateReplacement);

  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/javascript; charset=utf-8');
  return new Response(source, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

let finalModule;
try {
  finalModule = await import(`./nova-venda-fixed-v40.js?v=${VERSION}`);
} finally {
  globalThis.fetch = nativeFetch;
}

if (!finalModule?.NewSaleScreen) {
  throw new Error('O formulário de vendas com horário não foi carregado corretamente.');
}

export const NewSaleScreen = finalModule.NewSaleScreen;
