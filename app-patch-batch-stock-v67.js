const replaceRequired = (source, marker, replacement, label) => {
  if (!source.includes(marker)) throw new Error(`Não foi possível preparar ${label}.`);
  return source.replace(marker, replacement);
};

export const applyBatchStockPatch = source => {
  const financeImport = "import { AbaFinanceiro } from './aba-financeiro-v54.js';";
  source = replaceRequired(
    source,
    financeImport,
    "import { AbaFinanceiro } from './aba-financeiro-v67.js';\nimport { BatchStockModal } from './batch-stock-modal-v67.js';",
    'os módulos de estoque em lote e Financeiro'
  );

  const stockState = "    const [stockMovementData, setStockMovementData] = useState({ open: false, data: null });";
  source = replaceRequired(
    source,
    stockState,
    `${stockState}\n    const [batchStockOpen, setBatchStockOpen] = useState(false);`,
    'o estado da movimentação em lote'
  );

  const productsProps = "                        productSearch, setProductSearch, paginatedProducts, sortedProducts, productsPage, setProductsPage, setProductDetailsData, setProductModalData, ITEMS_PER_PAGE";
  source = replaceRequired(
    source,
    productsProps,
    "                        productSearch, setProductSearch, paginatedProducts, sortedProducts, productsPage, setProductsPage, setProductDetailsData, setProductModalData, onBatchMovement: () => setBatchStockOpen(true), ITEMS_PER_PAGE",
    'o botão de movimentação em lote na aba Produtos'
  );

  const stockModal = `        React.createElement(StockMovementModal, {
            isOpen: stockMovementData.open,
            onClose: () => setStockMovementData({open: false, data: null}),
            product: stockMovementData.data,
            onSave: handleStockMovement
        }),`;
  const stockWithBatchModal = `${stockModal}
        React.createElement(BatchStockModal, {
            isOpen: batchStockOpen,
            onClose: () => setBatchStockOpen(false),
            products: products,
            userId: user.uid,
            onSuccess: () => setBatchStockOpen(false)
        }),`;
  source = replaceRequired(source, stockModal, stockWithBatchModal, 'o modal de movimentação em lote');

  return source;
};
