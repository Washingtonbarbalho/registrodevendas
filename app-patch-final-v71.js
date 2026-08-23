const replaceRequired = (source, marker, replacement, label) => {
  if (!source.includes(marker)) throw new Error(`Não foi possível preparar ${label}.`);
  return source.replace(marker, replacement);
};

export const applyFinalPatches = source => {
  source = source.replaceAll(
    'b.saleDate.localeCompare(a.saleDate)',
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
    modals: './modals-fixed-v69.js',
    'nova-venda': './nova-venda-fixed-v70.js',
    'aba-visao-geral': './aba-visao-geral-fixed.js',
    'aba-produtos': './aba-produtos-v67.js',
    'aba-clientes': './aba-clientes-fixed-v52.js',
    'stock-movement-modal-v52': './stock-movement-modal-v68.js'
  };

  const freshModules = new Set([
    'modals', 'auth-admin', 'auth-screen-v71', 'nova-venda', 'aba-visao-geral', 'aba-vendas-v71',
    'sales-operations-v71', 'aba-produtos', 'aba-produtos-v67', 'aba-clientes', 'aba-financeiro-v68',
    'stock-movement-modal-v52', 'stock-movement-modal-v68', 'batch-stock-modal-v68', 'purchase-payment-v68',
    'aba-relatorios-v65', 'reports-engine-v65', 'reports-engine-v70', 'financial-core-v70', 'sale-pdf-v65',
    'aba-taxas', 'payment-settings', 'utils', 'components', 'inventory-reliability-v69'
  ]);

  source = source.replace(/(['"])(\.\/[^'"]+?\.js)(?:\?[^'"]*)?\1/g, (match, quote, modulePath) => {
    const moduleName = modulePath.split('/').pop().replace(/\.js$/, '');
    const resolved = fixedPaths[moduleName] || modulePath;
    const url = new URL(resolved, location.href);
    if (freshModules.has(moduleName) || /v(52|54|59|60|65|66|67|68|69|70|71)/.test(resolved)) url.search = '?v=71';
    return `'${url.href}'`;
  });

  return source.replace(
    "title: installmentListModal.type === 'overdue' ? 'Parcelas em atraso' : 'Vencendo em 7 dias'",
    "title: installmentListModal.type === 'overdue' ? 'Parcelas em atraso' : installmentListModal.type === 'today' ? 'Parcelas vencendo hoje' : 'Parcelas a vencer nos próximos 7 dias'"
  );
};
