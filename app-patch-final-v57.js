const replaceRequired = (source, marker, replacement, label) => {
  if (!source.includes(marker)) throw new Error(`Não foi possível preparar ${label}.`);
  return source.replace(marker, replacement);
};

export const applyFinalPatches = source => {
  source = source.replaceAll(
    "b.saleDate.localeCompare(a.saleDate)",
    "String(b.saleDateTime || b.saleDate || '').localeCompare(String(a.saleDateTime || a.saleDate || ''))"
  );

  const productSortingMarker = `    const sortedProducts = useMemo(() => {
        const list = [...products].sort((a, b) => a.code.localeCompare(b.code));
        if (!productSearch) return list;
        return list.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.code.includes(productSearch));
    }, [products, productSearch]);`;
  source = replaceRequired(source, productSortingMarker, `    const sortedProducts = useMemo(() => {
        const compareProducts = (a, b) => {
            const aHasStock = (Number(a.quantity) || 0) > 0;
            const bHasStock = (Number(b.quantity) || 0) > 0;
            if (aHasStock !== bHasStock) return aHasStock ? -1 : 1;
            return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' });
        };
        const list = [...products].sort(compareProducts);
        if (!productSearch) return list;
        const term = productSearch.toLowerCase();
        return list.filter(p => String(p.name || '').toLowerCase().includes(term) || String(p.code || '').includes(productSearch));
    }, [products, productSearch]);`, 'a organização dos produtos');

  const fixedPaths = {
    modals: './modals-fixed-v52.js',
    'nova-venda': './nova-venda-fixed-v55.js',
    'aba-visao-geral': './aba-visao-geral-fixed.js',
    'aba-vendas-prazo': './aba-vendas-prazo-v52.js',
    'aba-vendas-caixa': './aba-vendas-caixa-v52.js',
    'aba-clientes': './aba-clientes-fixed-v52.js'
  };
  const freshModules = new Set([
    'modals','auth-admin','nova-venda','aba-visao-geral','aba-vendas-prazo','aba-vendas-caixa',
    'aba-produtos','aba-clientes','aba-financeiro-v54','sale-cancellation-modal-v57',
    'stock-movement-modal-v52','aba-taxas','payment-settings','utils'
  ]);

  source = source.replace(/(['"])(\.\/[^'"]+?\.js)(?:\?[^'"]*)?\1/g, (match, quote, modulePath) => {
    const moduleName = modulePath.split('/').pop().replace(/\.js$/, '');
    const resolved = fixedPaths[moduleName] || modulePath;
    const url = new URL(resolved, location.href);
    if (freshModules.has(moduleName) || resolved.includes('v52') || resolved.includes('v54') || resolved.includes('v55') || resolved.includes('v57')) url.search = '?v=57';
    return `'${url.href}'`;
  });

  source = source.replace(
    "title: installmentListModal.type === 'overdue' ? 'Parcelas em atraso' : 'Vencendo em 7 dias'",
    "title: installmentListModal.type === 'overdue' ? 'Parcelas em atraso' : installmentListModal.type === 'today' ? 'Parcelas vencendo hoje' : 'Parcelas a vencer nos próximos 7 dias'"
  );
  return source;
};
