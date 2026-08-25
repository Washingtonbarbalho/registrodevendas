import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizeSaleMoney } from '../financial-core-v70.js';
import { aggregateSaleItems, buildSaleInventoryPlan, InventoryReliabilityError } from '../inventory-reliability-v69.js';
import {
  buildSalesView,
  getOperationalSaleStatus,
  getOperationalSaleType,
  getSalePendingAmount,
  summarizeSalesView
} from '../sales-operations-v71.js';

const checkSyntax = file => {
  const path = file instanceof URL ? fileURLToPath(file) : file;
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Erro de sintaxe em ${path}:\n${result.stderr || result.stdout}`);
};

for (const file of [
  'bootstrap-v75.js',
  'app-runtime-v75.js',
  'sales-operations-v71.js',
  'aba-vendas-v71.js',
  'auth-screen-v71.js',
  'aba-comercial-v74.js',
  'nova-venda-runtime-v75.js',
  'tab-persistence.js'
]) checkSyntax(new URL(`../${file}`, import.meta.url));

const directAugust = {
  id: 'direct-august',
  saleType: 'direct',
  saleDate: '2026-08-20',
  saleDateTime: '2026-08-20T14:30:00.000Z',
  customerName: 'João da Silva',
  paymentMethod: 'pix',
  status: 'completed',
  totalPrice: 100,
  netReceived: 100,
  items: [{ productName: 'Creme de ação rápida', productCode: '000123' }]
};
const oldOpenTerm = {
  id: 'term-open',
  saleType: 'prazo',
  saleDate: '2026-05-10',
  customerName: 'Maria Souza',
  status: 'active',
  totalPrice: 90,
  installments: [
    { number: 1, amount: 0, paid: true, dueDate: '2026-06-10' },
    { number: 2, amount: 30.01, paid: false, dueDate: '2026-07-10' },
    { number: 3, amount: 29.99, paid: false, dueDate: '2026-08-10' }
  ],
  items: [{ productName: 'Perfume' }]
};
const oldCompletedTerm = {
  id: 'term-completed-old',
  saleType: 'prazo',
  saleDate: '2026-05-03',
  customerName: 'Cliente antigo',
  status: 'completed',
  totalPrice: 50,
  installments: [{ amount: 0, paid: true, dueDate: '2026-06-03' }]
};
const canceledAugust = {
  id: 'canceled-august',
  saleType: 'direct',
  saleDate: '2026-08-05',
  customerName: 'Venda cancelada',
  status: 'canceled',
  totalPrice: 40
};
const futureOpenTerm = {
  ...oldOpenTerm,
  id: 'term-future',
  saleDate: '2026-09-02',
  customerName: 'Venda futura'
};
const sales = [oldCompletedTerm, directAugust, canceledAugust, oldOpenTerm, futureOpenTerm];
const period = { currentStart: '2026-08-01', currentEnd: '2026-08-31' };

assert.equal(getOperationalSaleType(oldOpenTerm), 'term');
assert.equal(getOperationalSaleType(directAugust), 'direct');
assert.equal(getOperationalSaleStatus(oldOpenTerm), 'open');
assert.equal(getOperationalSaleStatus(canceledAugust), 'canceled');
assert.equal(getSalePendingAmount(oldOpenTerm), 60, 'O saldo deve continuar exato em centavos.');

const defaultView = buildSalesView({ sales, ...period });
assert.deepEqual(defaultView.map(sale => sale.id), ['term-open', 'direct-august', 'canceled-august']);
assert.ok(!defaultView.some(sale => sale.id === oldCompletedTerm.id), 'Vendas antigas quitadas não devem poluir o mês atual.');
assert.ok(defaultView.some(sale => sale.id === oldOpenTerm.id), 'Pendências antigas devem permanecer visíveis.');
assert.ok(!defaultView.some(sale => sale.id === futureOpenTerm.id), 'Vendas futuras não devem aparecer no mês atual.');

const accentedSearch = buildSalesView({ sales, ...period, query: 'creme de acao', type: 'direct' });
assert.deepEqual(accentedSearch.map(sale => sale.id), ['direct-august'], 'A busca deve ignorar acentos e combinar com o tipo.');

const strictCustomSearch = buildSalesView({
  sales,
  query: 'Maria',
  period: 'custom',
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  ...period
});
assert.equal(strictCustomSearch.length, 0, 'A busca não pode ignorar o período personalizado.');

const openOnly = buildSalesView({ sales, ...period, status: 'open' });
assert.deepEqual(openOnly.map(sale => sale.id), ['term-open']);
const allHistory = buildSalesView({ sales, ...period, period: 'all', sort: 'oldest' });
assert.equal(allHistory.length, 5);
assert.equal(allHistory[0].id, 'term-completed-old');

const summary = summarizeSalesView(defaultView);
assert.deepEqual({
  count: summary.count,
  direct: summary.directCount,
  term: summary.termCount,
  open: summary.openCount,
  completed: summary.completedCount,
  canceled: summary.canceledCount
}, {
  count: 3,
  direct: 2,
  term: 1,
  open: 1,
  completed: 1,
  canceled: 1
});
assert.equal(summary.pendingAmount, 60);
assert.equal(summary.cashNetAmount, 100, 'Vendas canceladas não podem entrar no resumo de caixa.');

assert.deepEqual(buildSalesView({ sales, ...period, type: 'direct' }).map(sale => sale.id),
  ['direct-august', 'canceled-august'], 'O filtro À vista deve reunir vendas diretas, inclusive canceladas.');
assert.deepEqual(buildSalesView({ sales, ...period, type: 'term' }).map(sale => sale.id),
  ['term-open'], 'O filtro A prazo deve manter as pendências antigas visíveis.');
assert.deepEqual(buildSalesView({ sales, ...period, status: 'completed' }).map(sale => sale.id),
  ['direct-august'], 'O filtro Concluídas deve mostrar apenas vendas quitadas no período.');
assert.deepEqual(buildSalesView({ sales, ...period, status: 'canceled' }).map(sale => sale.id),
  ['canceled-august'], 'O filtro Canceladas deve isolar vendas canceladas.');

const source = fs.readFileSync(new URL('../app-runtime-v75.js', import.meta.url), 'utf8');

for (const marker of [
  'aba-vendas-v71.js?v=',
  'auth-screen-v71.js?v=',
  'aba-relatorios-v73.js?v=',
  'aba-comercial-v74.js?v=',
  "{ id: 'sales', label: 'Vendas', shortLabel: 'Vendas'",
  "view === 'sales' ? React.createElement(AbaVendas",
  'mobile-quick-nav',
  "const mobilePrimaryNav = ['dashboard', 'sales', 'products', 'customers', 'finance']",
  'const mobileOverflowNav = navItems.filter',
  'mobile83-more-backdrop',
  'mobile83-more-nav-button',
  'mobilePrimaryNav.slice(0, 3)',
  'mobilePrimaryNav.slice(3)',
  "React.createElement('span', null, \"Mais\")",
  "{ id: 'commercial', label: 'Comercial'",
  "view === 'commercial' ? React.createElement(AbaComercial",
  "setNewSaleMode('unified')",
  'buildSaleInventoryPlan(requestedItems, inventoryRecords)',
  'getSalesAccrualSummary(sales, dashStartDate, dashEndDate)',
  "setAccessDenied('deleted')"
]) assert.ok(source.includes(marker), `Integração v71 ausente: ${marker}`);

for (const obsolete of [
  "view === 'cashier'",
  'AbaVendasPrazo',
  'AbaVendasCaixa',
  'cashierSearch',
  'salesSearch',
  "{ id: 'cashier'",
  "const mobilePrimaryNav = ['dashboard', 'sales', 'products', 'finance']",
  "item.id === 'finance' ? 'Financeiro' : item.shortLabel",
  "'aria-label': \"Abrir todos os módulos\"",
  'mobile-menu-toggle',
  'mobile-menu-drawer',
  'mobile-menu-nav-button',
  'mobileMenuOpen',
  'mobilePrimaryNav.slice(0, 2)',
  'mobilePrimaryNav.slice(2)',
  'quick-sale-sheet',
  'quickSaleMenuOpen',
  'Qual venda deseja registrar?',
  "setNewSaleMode('direct')",
  "setNewSaleMode('prazo')"
]) assert.ok(!source.includes(obsolete), `Fluxo duplicado ainda presente: ${obsolete}`);

const handlerStart = source.indexOf('    const handleAddSale = async (data) => {');
const handlerEnd = source.indexOf('    const handleCancelSaleLogic = async', handlerStart);
assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, 'A rotina real de gravação da venda precisa estar disponível para teste.');
const saleHandlerSource = source.slice(handlerStart, handlerEnd);

const makeSaleHarness = (initialStock, options = {}) => {
  const inventory = new Map(Object.entries(initialStock).map(([id, quantity]) => [id, { name: id, quantity }]));
  const savedSales = new Map();
  const committedOperations = [];
  const fakeDb = { name: 'firestore-test' };
  let saleNumber = 0;

  const collection = (_db, ...segments) => ({ path: segments.join('/') });
  const doc = (target, ...segments) => {
    if (segments.length === 0) {
      const id = `sale-${++saleNumber}`;
      return { id, path: `${target.path}/${id}` };
    }
    return { id: String(segments.at(-1)), path: segments.join('/') };
  };

  const runTransaction = async (_db, callback) => {
    const staged = [];
    const transaction = {
      get: async ref => ({
        exists: () => inventory.has(ref.id),
        data: () => inventory.get(ref.id)
      }),
      set: (ref, data) => staged.push({ type: 'set', ref, data }),
      update: (ref, data) => staged.push({ type: 'update', ref, data })
    };

    await callback(transaction);
    if (options.rejectCommit) throw new Error('Commit simulado recusado.');
    staged.forEach(operation => {
      if (operation.type === 'set') savedSales.set(operation.ref.id, operation.data);
      else inventory.set(operation.ref.id, { ...inventory.get(operation.ref.id), ...operation.data });
      committedOperations.push(operation);
    });
  };

  const createHandler = Function('dependencies', `
    const { db, APP_ID, user, doc, collection, runTransaction, serverTimestamp,
      aggregateSaleItems, buildSaleInventoryPlan, normalizeSaleMoney } = dependencies;
    const console = { error() {} };
    ${saleHandlerSource}
    return handleAddSale;
  `);

  const handleAddSale = createHandler({
    db: fakeDb,
    APP_ID: 'registro-vendas-test',
    user: { uid: 'owner-test' },
    doc,
    collection,
    runTransaction,
    serverTimestamp: () => ({ generatedBy: 'server' }),
    aggregateSaleItems,
    buildSaleInventoryPlan,
    normalizeSaleMoney
  });

  return { handleAddSale, inventory, savedSales, committedOperations };
};

const cashSale = {
  saleType: 'direct',
  paymentMethod: 'pix',
  saleChannel: 'instagram',
  customerId: null,
  customerName: 'VENDA AVULSA',
  status: 'completed',
  totalPrice: 35.55,
  totalCost: 999,
  netReceived: 35.55,
  items: [
    { productId: 'perfume', productName: 'Perfume', quantity: 2, unitPrice: 10, unitCost: 4, price: 20, cost: 8 },
    { productId: 'perfume', productName: 'Perfume', quantity: 1, unitPrice: 10, unitCost: 4, price: 10, cost: 4 },
    { productId: 'creme', productName: 'Creme', quantity: 1, unitPrice: 5.55, unitCost: 2.22, price: 5.55, cost: 2.22 }
  ],
  installments: []
};

const cashHarness = makeSaleHarness({ perfume: 4, creme: 2 });
const savedCashId = await cashHarness.handleAddSale(cashSale);
assert.equal(savedCashId, 'sale-1', 'A venda no caixa deve retornar o identificador realmente gravado.');
assert.equal(cashHarness.savedSales.size, 1, 'A venda precisa ser gravada uma única vez.');
assert.equal(cashHarness.savedSales.get(savedCashId)?.totalCost, 14.22, 'O custo precisa ser normalizado antes da gravação.');
assert.equal(cashHarness.savedSales.get(savedCashId)?.saleChannel, 'instagram', 'A transação de venda precisa preservar o canal escolhido.');
assert.equal(cashHarness.savedSales.get(savedCashId)?.inventoryOperationId, savedCashId);
assert.equal(cashHarness.inventory.get('perfume')?.quantity, 1, 'Produtos repetidos devem gerar apenas uma baixa consolidada.');
assert.equal(cashHarness.inventory.get('creme')?.quantity, 1);
assert.deepEqual(cashHarness.committedOperations.map(item => item.type), ['set', 'update', 'update']);

const termHarness = makeSaleHarness({ perfume: 1 });
const termSaleId = await termHarness.handleAddSale({
  saleType: 'prazo',
  customerId: 'customer-1',
  customerName: 'Cliente a prazo',
  status: 'active',
  entryAmount: 5,
  totalPrice: 999,
  items: [{ productId: 'perfume', productName: 'Perfume', quantity: 1, unitPrice: 100, unitCost: 60, price: 100, cost: 60 }],
  installments: [33.34, 33.33, 28.33].map((amount, index) => ({ number: index + 1, amount, paid: false }))
});
assert.equal(termHarness.savedSales.get(termSaleId)?.totalPrice, 100, 'A venda a prazo precisa fechar exatamente em centavos.');
assert.equal(termHarness.inventory.get('perfume')?.quantity, 0, 'A venda da última unidade precisa ser permitida.');

const insufficientHarness = makeSaleHarness({ perfume: 2, creme: 2 });
await assert.rejects(() => insufficientHarness.handleAddSale(cashSale), error => (
  error instanceof InventoryReliabilityError && error.code === 'insufficient-stock'
), 'Estoque insuficiente deve impedir a venda.');
assert.equal(insufficientHarness.savedSales.size, 0, 'Venda recusada não pode ficar gravada parcialmente.');
assert.equal(insufficientHarness.inventory.get('perfume')?.quantity, 2);
assert.equal(insufficientHarness.inventory.get('creme')?.quantity, 2);
assert.equal(insufficientHarness.committedOperations.length, 0);

const missingHarness = makeSaleHarness({ perfume: 4 });
await assert.rejects(() => missingHarness.handleAddSale(cashSale), error => (
  error instanceof InventoryReliabilityError && error.code === 'product-not-found'
), 'Produtos removidos devem impedir a gravação.');
assert.equal(missingHarness.savedSales.size, 0);
assert.equal(missingHarness.inventory.get('perfume')?.quantity, 4);

const failedCommitHarness = makeSaleHarness({ perfume: 4, creme: 2 }, { rejectCommit: true });
await assert.rejects(() => failedCommitHarness.handleAddSale(cashSale), /Nenhuma venda ou baixa de estoque foi gravada/);
assert.equal(failedCommitHarness.savedSales.size, 0, 'Falha no banco não pode registrar uma venda incompleta.');
assert.equal(failedCommitHarness.inventory.get('perfume')?.quantity, 4);
assert.equal(failedCommitHarness.inventory.get('creme')?.quantity, 2);

const authSource = fs.readFileSync(new URL('../auth-screen-v71.js', import.meta.url), 'utf8');
for (const marker of ['sendPasswordResetEmail', "autoComplete: 'current-password'", 'Lembrar meu e-mail', "type: 'submit'"]) {
  assert.ok(authSource.includes(marker), `Simplificação do login ausente: ${marker}`);
}
assert.ok(!authSource.includes("localStorage.setItem('password'"), 'A senha nunca pode ser persistida no aparelho.');

const salesUi = fs.readFileSync(new URL('../aba-vendas-v71.js', import.meta.url), 'utf8');
for (const marker of [
  'Mês atual + pendências', 'Todo o histórico', 'Período personalizado',
  'Todas', 'À vista', 'A prazo', 'Em aberto', 'Concluídas', 'Canceladas',
  'Nova venda', "setNewSaleMode('unified')"
]) {
  assert.ok(salesUi.includes(marker), `Filtro ou ação de vendas ausente: ${marker}`);
}
assert.equal((salesUi.match(/setNewSaleMode\(/g) || []).length, 1,
  'A área de vendas deve apresentar uma única entrada para cadastrar uma venda.');
assert.ok(!salesUi.includes("React.createElement('select', { value: status"),
  'Os estados da venda devem ser acessados diretamente nas abas, sem filtro duplicado.');

const baseSale = fs.readFileSync(new URL('../nova-venda-runtime-v75.js', import.meta.url), 'utf8');
for (const marker of [
  "import QRCode from 'https://esm.sh/qrcode@1.5.4';",
  'QRCode.toDataURL(payload',
  'const LocalPixQrCode = ({ payload }) =>',
  'const quantityAlreadyInCart = cart.reduce',
  'if (qty > remainingQuantity)',
  'if (!Number.isInteger(qty) || qty < 1)',
  'const acceptsEntry =',
  'A entrada não pode ser maior que o valor total dos produtos.',
  "const [paymentMethod, setPaymentMethod] = useState(initialMode === 'prazo' ? 'crediario' : 'pix');",
  "const mode = paymentMethod === 'crediario' ? 'prazo' : 'direct';",
  'sale-payment-select-field',
  'id: "sale-payment-method"',
  "['pix', 'PIX']",
  "['money', 'Dinheiro']",
  "['debit', 'Débito']",
  "['credit', 'Crédito']",
  "['crediario', 'Crediário']",
  'const selectPaymentMethod = method =>'
]) assert.ok(baseSale.includes(marker), `Proteção operacional ausente no formulário: ${marker}`);
assert.ok(!baseSale.includes('api.qrserver.com'), 'O formulário de vendas não pode enviar dados PIX a um serviço externo.');
assert.ok(!baseSale.includes('Nova Venda Direta (Caixa)'), 'A nova venda não deve exigir a escolha antecipada do tipo.');

const methodSelectorStart = baseSale.indexOf('    const selectPaymentMethod = method => {');
const methodSelectorEnd = baseSale.indexOf('\n    };', methodSelectorStart);
assert.ok(methodSelectorStart >= 0 && methodSelectorEnd > methodSelectorStart,
  'A seleção interna da forma de pagamento deve estar disponível.');
const buildMethodSelector = Function('setPaymentMethod', 'setDirectMethod', `
  ${baseSale.slice(methodSelectorStart, methodSelectorEnd + '\n    };'.length)}
  return selectPaymentMethod;
`);
const paymentSelections = [];
const directSelections = [];
const changePayment = buildMethodSelector(
  method => paymentSelections.push(method),
  method => directSelections.push(method)
);
changePayment('crediario');
assert.deepEqual(paymentSelections, ['crediario']);
assert.deepEqual(directSelections, [], 'Crediário não pode ser gravado como pagamento direto.');
for (const method of ['pix', 'money', 'debit', 'credit']) changePayment(method);
assert.deepEqual(paymentSelections, ['crediario', 'pix', 'money', 'debit', 'credit']);
assert.deepEqual(directSelections, ['pix', 'money', 'debit', 'credit'],
  'Cada forma de pagamento direta deve atualizar corretamente os dados da venda.');

const cartHandlerStart = baseSale.indexOf('    const handleAddItem = () => {');
const cartHandlerEnd = baseSale.indexOf('    const handleRemoveItem =', cartHandlerStart);
assert.ok(cartHandlerStart >= 0 && cartHandlerEnd > cartHandlerStart);
const createCartHandler = Function('dependencies', `
  const { currentQty, currentPrice, currentDiscount, currentDiscountReason, selectedProductId, products, cart, currentCost,
    parseMoney, alert, setCart, setSelectedProductId, setCurrentQty, setCurrentCost, setCurrentPrice,
    setBaseUnitPrice, setCurrentDiscount, setCurrentDiscountReason, setProductSearch } = dependencies;
  ${baseSale.slice(cartHandlerStart, cartHandlerEnd)}
  return handleAddItem;
`);

const tryAddingProduct = ({ quantity, available, previousQuantity = 0 }) => {
  const notices = [];
  let updatedCart = null;
  const previousCart = previousQuantity
    ? [{ productId: 'perfume', productName: 'Perfume', quantity: previousQuantity }]
    : [];
  const noop = () => {};
  const add = createCartHandler({
    currentQty: quantity,
    currentPrice: '10',
    currentDiscount: '0',
    currentDiscountReason: '',
    selectedProductId: 'perfume',
    products: [{ id: 'perfume', name: 'Perfume', code: '123', quantity: available }],
    cart: previousCart,
    currentCost: 4,
    parseMoney: value => Number(value) || 0,
    alert: message => notices.push(message),
    setCart: value => { updatedCart = value; },
    setSelectedProductId: noop,
    setCurrentQty: noop,
    setCurrentCost: noop,
    setCurrentPrice: noop,
    setBaseUnitPrice: noop,
    setCurrentDiscount: noop,
    setCurrentDiscountReason: noop,
    setProductSearch: noop
  });
  add();
  return { notices, updatedCart };
};

const validAddition = tryAddingProduct({ quantity: 1, available: 2, previousQuantity: 1 });
assert.equal(validAddition.updatedCart?.length, 2, 'A última unidade disponível precisa entrar no carrinho.');
assert.deepEqual(validAddition.notices, []);
const duplicateExcess = tryAddingProduct({ quantity: 2, available: 2, previousQuantity: 1 });
assert.equal(duplicateExcess.updatedCart, null, 'Itens repetidos não podem ultrapassar o estoque.');
assert.match(duplicateExcess.notices[0], /estoque disponível é 1 un/);
const fractionalQuantity = tryAddingProduct({ quantity: 1.5, available: 4 });
assert.equal(fractionalQuantity.updatedCart, null);
assert.match(fractionalQuantity.notices[0], /quantidade inteira/);
const emptyStock = tryAddingProduct({ quantity: 1, available: 0 });
assert.equal(emptyStock.updatedCart, null);
assert.match(emptyStock.notices[0], /estoque disponível é 0 un/);

const entryCalculationStart = baseSale.indexOf('    const acceptsEntry =');
const entryCalculationEnd = baseSale.indexOf('    const totalRemaining =', entryCalculationStart);
assert.ok(entryCalculationStart >= 0 && entryCalculationEnd > entryCalculationStart);
const getEffectiveEntry = Function('saleType', 'directMethod', 'entryAmount', 'parseMoney', `
  ${baseSale.slice(entryCalculationStart, entryCalculationEnd)}
  return entryValue;
`);
assert.equal(getEffectiveEntry('direct', 'pix', '25', Number), 0, 'PIX não pode herdar entrada digitada anteriormente no cartão.');
assert.equal(getEffectiveEntry('direct', 'money', '25', Number), 0);
assert.equal(getEffectiveEntry('direct', 'credit', '25', Number), 25);
assert.equal(getEffectiveEntry('prazo', 'pix', '25', Number), 25);

const persistenceSource = fs.readFileSync(new URL('../tab-persistence.js', import.meta.url), 'utf8');
const normalizeStart = persistenceSource.indexOf('const normalize =');
const normalizeEnd = persistenceSource.indexOf('const sleep =', normalizeStart);
const identifyStart = persistenceSource.indexOf('const identifyTab =');
const identifyEnd = persistenceSource.indexOf('const normalizeTabId =', identifyStart);
assert.ok(normalizeStart >= 0 && normalizeEnd > normalizeStart && identifyStart >= 0 && identifyEnd > identifyStart);
const identifyTab = Function(`${persistenceSource.slice(normalizeStart, normalizeEnd)}
  ${persistenceSource.slice(identifyStart, identifyEnd)}
  return identifyTab;`)();
assert.equal(identifyTab('Financeiro'), 'finance');
assert.equal(identifyTab('Fin.'), 'finance');
assert.equal(identifyTab('Clientes'), 'customers');
assert.equal(identifyTab('Comercial'), 'commercial');
assert.equal(identifyTab('Relatórios'), 'reports');
assert.equal(identifyTab('Relat.'), 'reports');
assert.equal(identifyTab('Vendas no caixa'), 'sales');
assert.ok(persistenceSource.includes('.mobile83-more-nav-button'),
  'A navegação pelo painel flutuante Mais precisa preservar a aba.');
assert.ok(!persistenceSource.includes('.mobile-menu-nav-button'),
  'A gaveta lateral removida não pode permanecer na restauração da navegação.');

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /bootstrap-v75\.js\?v=\d+/, 'O runtime técnico consolidado precisa estar ativo.');
assert.match(index, /styles-runtime-v75\.css\?v=\d+/, 'Os estilos consolidados precisam estar ativos.');

console.log('Aplicação v74 validada: venda atômica, navegação mobile e integração Comercial preservadas.');
