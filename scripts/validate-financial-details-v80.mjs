import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildFinancialAccountDetails, filterFinancialAccounts } from '../financial-account-details-v80.js';
import { applyInstallmentPayment, getPurchaseGroups } from '../financial-core-v70.js';

const today = '2026-08-25';
assert.equal(buildFinancialAccountDetails(null), null);

const openManual = buildFinancialAccountDetails({
  id: 'manual-receivable',
  source: 'manual',
  direction: 'receivable',
  description: 'Serviço complementar',
  party: 'Ana Maria',
  category: 'Serviços',
  notes: 'Combinar pagamento por WhatsApp.',
  value: 45.75,
  dueDate: '2026-08-20',
  createdAt: '2026-08-10T10:00:00.000Z',
  status: { label: 'Atrasada', cls: 'is-overdue' }
}, { today });

assert.equal(openManual.title, 'Detalhes da conta a receber');
assert.equal(openManual.originalAmount, 45.75);
assert.equal(openManual.paidAmount, 0);
assert.equal(openManual.remainingAmount, 45.75);
assert.equal(openManual.daysUntilDue, -5);
assert.equal(openManual.category, 'Serviços');
assert.equal(openManual.notes, 'Combinar pagamento por WhatsApp.');
assert.equal(openManual.originDate, '2026-08-10');
assert.deepEqual(openManual.history, []);

const paidManual = buildFinancialAccountDetails({
  source: 'manual',
  direction: 'payable',
  description: 'Conta de energia',
  party: 'Concessionária',
  value: 99.99,
  dueDate: '2026-08-30',
  paid: true,
  paidAt: '2026-08-24',
  paidAtDateTime: '2026-08-24T14:10:00.000Z'
}, { today });
assert.equal(paidManual.title, 'Detalhes da conta a pagar');
assert.equal(paidManual.remainingAmount, 0);
assert.equal(paidManual.paidAmount, 99.99);
assert.equal(paidManual.daysUntilDue, null);
assert.equal(paidManual.history[0].amount, 99.99);
assert.equal(paidManual.history[0].label, 'Pagamento registrado');

const manualInstallment = buildFinancialAccountDetails({
  source: 'manual',
  direction: 'receivable',
  description: 'Consultoria · Parcela 1/3',
  value: 33.34,
  dueDate: '2026-08-31',
  installmentGroupId: 'manual-group-1',
  installmentNumber: 1,
  installmentsCount: 3,
  installmentOriginalTotal: 100
}, { today });
assert.equal(manualInstallment.installmentNumber, 1);
assert.equal(manualInstallment.installmentsCount, 3);
assert.equal(manualInstallment.originTotal, 100);
assert.equal(manualInstallment.originTotalLabel, 'Valor total do parcelamento');

const installments = [1, 2, 3].map(number => ({
  number,
  amount: 100,
  originalAmount: 100,
  dueDate: `2026-${String(number + 7).padStart(2, '0')}-20`,
  paid: false,
  history: []
}));
const distributed = applyInstallmentPayment(
  installments,
  0,
  250,
  '2026-08-24',
  '2026-08-24T12:00:00.000Z'
);
const sale = {
  id: 'sale-1',
  customerName: 'Maria Souza',
  customerPhone: '(85) 99999-0000',
  saleDate: '2026-07-18',
  totalPrice: 300,
  installmentsCount: 3,
  installments: distributed.installments,
  notes: 'Entrega realizada.',
  items: [{ productName: 'Perfume', quantity: 2, unitPrice: 150, price: 300 }]
};

const firstInstallment = buildFinancialAccountDetails({
  source: 'sale',
  sale,
  installmentIndex: 0,
  description: 'Maria Souza · Parcela 1/3',
  dueDate: '2026-08-20',
  value: 100,
  paid: true,
  paidAt: '2026-08-24',
  paidAtDateTime: '2026-08-24T12:00:00.000Z',
  status: { label: 'Recebida', cls: 'is-paid' }
}, { today });
assert.equal(firstInstallment.direction, 'receivable');
assert.equal(firstInstallment.originalAmount, 100);
assert.equal(firstInstallment.paidAmount, 100);
assert.equal(firstInstallment.historyTotal, 100,
  'O excedente transferido não pode ser duplicado nos detalhes da parcela de origem.');
assert.equal(firstInstallment.history[0].label, 'Pagamento com distribuição de excedente');
assert.equal(firstInstallment.customerPhone, '(85) 99999-0000');
assert.equal(firstInstallment.products[0].unitValue, 150);
assert.equal(firstInstallment.products[0].total, 300);

const partiallyPaid = buildFinancialAccountDetails({
  source: 'sale',
  sale,
  installmentIndex: 2,
  description: 'Maria Souza · Parcela 3/3',
  dueDate: '2026-10-20',
  value: 50,
  paid: false,
  partial: true,
  status: { label: 'Parcial', cls: 'is-partial' }
}, { today });
assert.equal(partiallyPaid.originalAmount, 100);
assert.equal(partiallyPaid.paidAmount, 50);
assert.equal(partiallyPaid.remainingAmount, 50);
assert.equal(partiallyPaid.historyTotal, 50);
assert.equal(partiallyPaid.history[0].label, 'Valor distribuído de outra parcela');

const plan = [
  { number: 1, amount: 40, dueDate: '2026-08-20', paid: true, paidAt: '2026-08-18' },
  { number: 2, amount: 40, dueDate: '2026-09-20', paid: false },
  { number: 3, amount: 40, dueDate: '2026-10-20', paid: false }
];
const products = [
  {
    id: 'cream',
    name: 'Creme hidratante',
    movements: [{
      id: 'movement-cream',
      type: 'compra',
      batchId: 'purchase-1',
      batchIndex: 0,
      quantity: 4,
      unitCost: 20,
      date: '2026-08-12T10:00:00.000Z',
      paymentMethod: 'credit',
      supplierName: 'Fornecedor Oficial',
      notes: 'Pedido de agosto.',
      financialInstallments: plan,
      financialCancellations: [{
        id: 'return-1',
        quantity: 1,
        amount: 20,
        accountReductionAmount: 20,
        cashRefundAmount: 0,
        hadCashOut: false,
        date: '2026-08-23'
      }]
    }]
  },
  {
    id: 'soap',
    name: 'Sabonete',
    movements: [{
      id: 'movement-soap',
      type: 'compra',
      batchId: 'purchase-1',
      batchIndex: 1,
      quantity: 2,
      unitCost: 20,
      date: '2026-08-12T10:00:00.000Z',
      paymentMethod: 'credit',
      financialInstallments: plan
    }]
  }
];
const purchaseGroup = getPurchaseGroups(products)[0];
const purchase = buildFinancialAccountDetails({
  source: 'stock',
  direction: 'payable',
  productId: 'cream',
  movementId: 'movement-cream',
  batchId: 'purchase-1',
  installmentIndex: 2,
  installmentNumber: 3,
  installmentsCount: 3,
  description: 'Compra em lote · Parcela 3/3',
  party: 'Crédito',
  dueDate: '2026-10-20',
  value: 20,
  paid: false,
  partial: true,
  status: { label: 'Parcial', cls: 'is-partial' }
}, { products, today });

assert.equal(purchase.sourceLabel, 'Compra de mercadoria em lote');
assert.equal(purchase.party, 'Fornecedor Oficial');
assert.equal(purchase.paymentMethod, 'Crédito');
assert.equal(purchase.originDate, '2026-08-12');
assert.equal(purchase.purchaseOriginalTotal, 120);
assert.equal(purchase.originTotal, 100);
assert.equal(purchase.purchasePaidTotal, 40);
assert.equal(purchase.purchaseOpenTotal, 60);
assert.equal(purchase.purchaseCanceledTotal, 20);
assert.equal(purchase.originalAmount, 20);
assert.equal(purchase.products.length, 2);
assert.equal(purchase.products[0].canceledQuantity, 1);
assert.equal(purchase.history[0].type, 'cancellation');
assert.equal(purchase.historyTotal, 0);

const paidPurchase = buildFinancialAccountDetails({
  source: 'stock',
  direction: 'payable',
  purchaseGroup,
  installmentIndex: 0,
  description: 'Compra em lote · Parcela 1/3',
  value: 40,
  paid: true,
  paidAt: '2026-08-18'
}, { today });
assert.equal(paidPurchase.remainingAmount, 0);
assert.equal(paidPurchase.paidAmount, 40);
assert.equal(paidPurchase.historyTotal, 40);

const portfolio = [
  { id: 'current', description: 'Parcela de agosto', party: 'Ana', dueDate: '2026-08-20', paid: false },
  { id: 'future', description: 'Parcela de setembro', party: 'Bruna', dueDate: '2026-09-20', paid: false },
  { id: 'distant', description: 'Parcela de outubro', party: 'Carla', dueDate: '2026-10-20', paid: false },
  { id: 'paid', description: 'Conta já paga', party: 'Davi', dueDate: '2026-09-10', paid: true },
  { id: 'canceled', description: 'Conta cancelada', party: 'Elisa', dueDate: '2026-10-10', paid: false, canceled: true }
];
const august = { startDate: '2026-08-01', endDate: '2026-08-31' };
assert.deepEqual(filterFinancialAccounts(portfolio, august).map(account => account.id), ['current'],
  'A visualização comum deve continuar respeitando o período selecionado.');
assert.deepEqual(filterFinancialAccounts(portfolio, { ...august, scope: 'all' }).map(account => account.id),
  ['current', 'future', 'distant'],
  'Os cartões precisam abrir todas as contas pendentes, inclusive parcelas de meses futuros.');
assert.deepEqual(filterFinancialAccounts(portfolio, { ...august, scope: 'all', status: 'paid' })
  .map(account => account.id), ['paid'],
  'Os filtros de contas pagas devem continuar funcionando na carteira completa.');
assert.deepEqual(filterFinancialAccounts(portfolio, { ...august, scope: 'all', search: 'Bruna' })
  .map(account => account.id), ['future'],
  'A busca continua disponível quando todas as datas são exibidas.');

const source = fs.readFileSync(new URL('../aba-financeiro-v68.js', import.meta.url), 'utf8');
for (const marker of [
  'const AccountDetailsModal =',
  "'Detalhes'",
  'onOpenDetails: setDetailsAccount',
  'buildFinancialAccountDetails(item, { products, today: getBrazilDateString() })',
  'Informações da conta',
  'Histórico da conta',
  'Saldo em aberto',
  'Produtos da venda',
  'Produtos da compra',
  'const AccountPortfolioModal =',
  'finance83-portfolio-modal',
  'finance83-portfolio-scroll',
  'finance85-installment-preview',
  'finance88-launch-card',
  'const MANUAL_LAUNCH_TYPES =',
  "{ value: 'income', label: 'Entrada financeira' }",
  "{ value: 'expense', label: 'Saída financeira' }",
  "{ value: 'receivable', label: 'Conta a receber' }",
  "{ value: 'payable', label: 'Conta a pagar' }",
  'Tipo de lançamento *',
  "setModalState({ kind: 'new', initial: null })",
  "setTab(form.kind === 'movement' ? 'movements' : form.kind)",
  'installmentGroupId',
  'installmentOriginalTotal',
  'buildPaymentInstallments(form.value, count, form.date)',
  'Saldo total em caixa',
  "summarizeFinancialLedger(\n    sharedLedger,\n    '',\n    getBrazilDateString()",
  "scope: 'all'",
  "scope: 'period'",
  'filteredAccounts.map(item => h(AccountRow, { key: item.id, item, tab: direction, ...rowActions }))',
  'openCompletePortfolio',
  'setPortfolioDirection(direction)',
  'finance82-summary-action',
  'Todos os vencimentos, inclusive parcelas dos próximos meses.'
]) assert.ok(source.includes(marker), `Detalhe financeiro ausente na interface: ${marker}`);

assert.match(source, /const openCompletePortfolio = direction => setPortfolioDirection\(direction\);/,
  'Os cartões devem abrir somente o modal da carteira, sem modificar a aba, a busca ou os filtros da página.');
assert.ok(!source.includes('setAccountScope('),
  'A carteira completa não pode ser exibida alterando o escopo do filtro da página financeira.');
assert.ok(!source.includes('finance82-portfolio-notice'),
  'O aviso de carteira completa na própria página não pode retornar.');
assert.ok(!source.includes("label: 'Saldo do período'"),
  'O primeiro cartão financeiro deve mostrar o caixa histórico realizado.');
assert.ok(!source.includes("kind: tab === 'receivable'"),
  'O botão de lançamento não pode mudar de função conforme a seção financeira.');
assert.ok(source.indexOf('Tipo de lançamento *') < source.indexOf('Descrição *'),
  'A escolha do tipo precisa aparecer antes dos demais campos do lançamento.');

console.log('Financeiro validado: lançamento unificado, parcelamento manual, saldo total em caixa, carteira independente e detalhes completos.');
