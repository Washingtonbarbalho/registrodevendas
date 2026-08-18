const VERSION = '55';
const nativeFetch = globalThis.fetch;

const timestampMarker = "            saleDate: saleDate, saleType: saleType, status: 'active'";
const timestampReplacement = "            saleDate: saleDate, saleDateTime: new Date().toISOString(), saleType: saleType, status: 'active'";

const fragileSummaryBlock = `const financialMarker = '    const netAmountToCompany = totalCustomerPays - currentFeeValue;';
if (!source.includes(financialMarker)) {
    throw new Error('Não foi possível preparar o resumo de pagamento.');
}`;

const robustSummaryBlock = `const financialMarkerMatch = source.match(/    const netAmountToCompany =[\\s\\S]*?;(?=\\n)/);
if (!financialMarkerMatch) {
    throw new Error('Não foi possível preparar o resumo de pagamento.');
}
const financialMarker = financialMarkerMatch[0];`;

const getPathname = input => {
  try {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    return raw ? new URL(raw, location.href).pathname : '';
  } catch {
    return '';
  }
};

globalThis.fetch = async (input, init) => {
  const response = await nativeFetch.call(globalThis, input, init);
  if (!response.ok) return response;

  const pathname = getPathname(input);
  if (!pathname.endsWith('/nova-venda.js') && !pathname.endsWith('/nova-venda-fixed.js')) return response;

  let source = await response.text();

  if (pathname.endsWith('/nova-venda.js')) {
    if (!source.includes(timestampMarker)) {
      throw new Error('Não foi possível registrar o horário real da nova venda.');
    }
    source = source.replace(timestampMarker, timestampReplacement);
  }

  if (pathname.endsWith('/nova-venda-fixed.js')) {
    if (!source.includes(fragileSummaryBlock)) {
      throw new Error('Não foi possível tornar o resumo de pagamento compatível com a fórmula atual.');
    }
    source = source.replace(fragileSummaryBlock, robustSummaryBlock);
  }

  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/javascript; charset=utf-8');
  return new Response(source, { status: response.status, statusText: response.statusText, headers });
};

let finalModule;
try {
  finalModule = await import(`./nova-venda-fixed-v55-core.js?v=${VERSION}`);
} finally {
  globalThis.fetch = nativeFetch;
}

if (!finalModule?.NewSaleScreen) {
  throw new Error('O formulário de vendas v55 não foi carregado corretamente.');
}

export const NewSaleScreen = finalModule.NewSaleScreen;