import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = fs.readFileSync(path.join(root, 'nova-venda-runtime-v75.js'), 'utf8')
  .replace(/^import\s.*?;\r?\n/gm, '')
  .replace('export const NewSaleScreen =', 'const NewSaleScreen =');

assert.ok(!/^import\s/m.test(source), 'O formulário consolidado deve estar pronto para o simulador.');

const iconNames = [
  'ChevronLeft', 'User', 'UserPlus', 'X', 'Search', 'CheckCircle', 'ShoppingBag',
  'Tag', 'PlusCircle', 'Trash2', 'CreditCard', 'Calendar', 'QrCode', 'Banknote',
  'Copy', 'BadgePercent', 'RefreshCw', 'ThumbsUp', 'ShieldAlert'
];

const createSaleScreen = Function('dependencies', `
  const {
    React, useState, useEffect, db, APP_ID, collection, addDoc, serverTimestamp,
    formatCurrency, parseMoney, maskPhone, getBrazilDateString, addDays,
    generatePixPayload, analyzeCustomerCredit, MoneyInput, getCardRate,
    getCarnetRate, normalizePaymentSettings, evaluateTermEntryRules, splitMoney,
    QRCode, window, alert, setTimeout, ${iconNames.join(', ')}
  } = dependencies;
  ${source}
  return NewSaleScreen;
`);

const flattenNodes = value => {
  if (Array.isArray(value)) return value.flatMap(flattenNodes);
  if (!value || typeof value !== 'object') return [];
  return [value, ...flattenNodes(value.props?.children || [])];
};

const nodeText = value => {
  if (Array.isArray(value)) return value.map(nodeText).join('');
  if (value == null || value === false) return '';
  if (typeof value !== 'object') return String(value);
  return nodeText(value.props?.children || []);
};

const splitMoney = (value, count) => {
  const total = Math.round(Number(value || 0) * 100);
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, index) => (base + Number(index < remainder)) / 100);
};

const createHarness = ({ promotional = false } = {}) => {
  const states = [];
  let cursor = 0;
  let tree;
  let closed = 0;
  const saved = [];
  const notices = [];
  const scheduled = [];

  const useState = initial => {
    const index = cursor++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], next => {
      states[index] = typeof next === 'function' ? next(states[index]) : next;
    }];
  };

  const React = {
    Fragment: Symbol('Fragment'),
    createElement: (type, props, ...children) => ({
      type,
      props: { ...(props || {}), children: children.flat(Infinity) }
    }),
    useRef: initial => {
      const index = cursor++;
      if (!(index in states)) states[index] = { current: initial };
      return states[index];
    }
  };

  const icons = Object.fromEntries(iconNames.map(name => [name, name]));
  const customers = [{ id: 'customer-1', name: 'CLIENTE TESTE', phone: '85999999999', income: 2500 }];
  const products = [{
    id: 'product-1', name: 'Perfume de teste', code: '123',
    quantity: 4, costPrice: 40, salePrice: promotional ? 120 : 100,
    ...(promotional ? {
      isPromo: true, promoPrice: 90, promoStart: '2026-08-01', promoEnd: '2026-08-31'
    } : {})
  }];

  const dependencies = {
    ...icons,
    React,
    useState,
    useEffect: () => {},
    db: {},
    APP_ID: 'registro-teste',
    collection: () => ({}),
    addDoc: async () => ({ id: 'customer-new' }),
    serverTimestamp: () => 'timestamp',
    formatCurrency: value => new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL'
    }).format(Number(value) || 0),
    parseMoney: value => {
      if (typeof value === 'number') return value;
      const normalized = String(value || '').replace(/\./g, '').replace(',', '.');
      return Number(normalized) || 0;
    },
    maskPhone: value => value,
    getBrazilDateString: () => '2026-08-24',
    addDays: () => '2026-09-24',
    generatePixPayload: () => 'pix-seguro',
    analyzeCustomerCredit: () => ({
      approved: true, suggestedEntry: 0, availableLimit: 2000,
      calculatedLimit: 2000, currentDebt: 0, reason: 'Crédito aprovado.'
    }),
    MoneyInput: 'MoneyInput',
    getCardRate: () => 0,
    getCarnetRate: () => 0,
    normalizePaymentSettings: () => ({ card: { machineName: 'Maquininha teste' } }),
    evaluateTermEntryRules: () => ({
      ruleApplies: false, approved: true, requiredEntry: 0, shortage: 0, reasons: []
    }),
    splitMoney,
    QRCode: { toDataURL: async () => 'data:image/png;base64,teste' },
    window: { scrollTo() {} },
    alert: message => notices.push(message),
    setTimeout: callback => { scheduled.push(callback); return scheduled.length; }
  };

  const NewSaleScreen = createSaleScreen(dependencies);
  const props = {
    mode: 'unified',
    onClose: () => { closed += 1; },
    customers,
    products,
    sales: [],
    onSaveSale: async sale => { saved.push(sale); },
    userProfile: {},
    user: { uid: 'user-1' },
    paymentSettings: {}
  };

  const render = () => {
    cursor = 0;
    tree = NewSaleScreen(props);
    return tree;
  };
  const nodes = () => flattenNodes(tree);
  const find = (predicate, label) => {
    const result = nodes().find(predicate);
    assert.ok(result, `${label} não foi encontrado no formulário renderizado.`);
    return result;
  };
  const findButton = label => find(
    node => node.type === 'button' && nodeText(node).includes(label),
    `Botão ${label}`
  );
  const findPaymentSelect = () => find(
    node => node.type === 'select' && node.props.id === 'sale-payment-method',
    'Lista suspensa de forma de pagamento'
  );
  const chooseMethod = label => {
    const option = findPaymentSelect().props.children.find(node => nodeText(node) === label);
    assert.ok(option, `A forma de pagamento ${label} deve existir na lista suspensa.`);
    findPaymentSelect().props.onChange({ target: { value: option.props.value } });
    render();
  };
  const addProduct = () => {
    find(node => node.type === 'input' && node.props.placeholder === 'Buscar por nome ou código...',
      'Busca de produto').props.onChange({ target: { value: 'Perfume' } });
    render();
    find(node => node.props?.key === 'product-1' && typeof node.props.onClick === 'function',
      'Produto disponível').props.onClick();
    render();
    const addButton = findButton('Adicionar no Carrinho');
    assert.equal(addButton.props.disabled, false, 'O produto selecionado deve poder entrar no carrinho.');
    addButton.props.onClick();
    render();
    assert.ok(nodeText(tree).includes('Carrinho (1 itens)'), 'O carrinho deve preservar o produto selecionado.');
  };

  render();
  return {
    render, nodes, find, findButton, findPaymentSelect, chooseMethod, addProduct,
    saved, notices, scheduled,
    get closed() { return closed; },
    get tree() { return tree; }
  };
};

const initial = createHarness();
const methodOptions = initial.findPaymentSelect().props.children;
assert.deepEqual(methodOptions.map(nodeText), ['PIX', 'Dinheiro', 'Débito', 'Crédito', 'Crediário'],
  'A nova venda deve oferecer as cinco formas de pagamento no mesmo formulário.');
assert.equal(initial.findPaymentSelect().props.value, 'pix');
assert.ok(!initial.nodes().some(node => node.type === 'button' && typeof node.props['aria-pressed'] === 'boolean'),
  'A forma de pagamento deve ser apresentada como lista suspensa, sem os botões anteriores.');
assert.ok(nodeText(initial.tree).includes('Nova venda'));
assert.ok(!nodeText(initial.tree).includes('Frequência das Parcelas'),
  'Condições de crediário não devem aparecer antes de selecionar essa opção.');

const directMethods = [
  ['PIX', 'pix'], ['Dinheiro', 'money'], ['Débito', 'debit'], ['Crédito', 'credit']
];
for (const [label, expectedMethod] of directMethods) {
  const sale = createHarness();
  sale.chooseMethod(label);
  sale.addProduct();
  assert.equal(sale.findPaymentSelect().props.value, expectedMethod);
  if (expectedMethod === 'credit') {
    assert.ok(nodeText(sale.tree).includes('Parcelas no Cartão'),
      'Crédito deve preservar o parcelamento e os dados da maquininha.');
  }
  await sale.findButton('Finalizar Venda').props.onClick();
  assert.equal(sale.saved.length, 1, `${label} deve gravar exatamente uma venda.`);
  assert.equal(sale.saved[0].saleType, 'direct');
  assert.equal(sale.saved[0].paymentMethod, expectedMethod);
  assert.equal(sale.saved[0].status, 'completed');
  assert.equal(sale.saved[0].totalPrice, 100);
  assert.equal(sale.saved[0].anonymousSale, true, 'Vendas diretas devem continuar permitindo cliente opcional.');
  assert.equal(sale.closed, 1);
}

const promotionalSale = createHarness({ promotional: true });
promotionalSale.addProduct();
await promotionalSale.findButton('Finalizar Venda').props.onClick();
assert.equal(promotionalSale.saved.length, 1);
assert.equal(promotionalSale.saved[0].totalPrice, 90);
assert.equal(promotionalSale.saved[0].items[0].regularUnitPrice, 120);
assert.equal(promotionalSale.saved[0].items[0].promotionalUnitPrice, 90);
assert.equal(promotionalSale.saved[0].items[0].promotionUnitDiscount, 30);
assert.equal(promotionalSale.saved[0].items[0].promotionApplied, true,
  'A promoção precisa ser preservada na própria venda para manter o histórico confiável.');

const termSale = createHarness();
termSale.addProduct();
termSale.chooseMethod('Crediário');
assert.equal(termSale.findPaymentSelect().props.value, 'crediario');
assert.ok(nodeText(termSale.tree).includes('Carrinho (1 itens)'),
  'Mudar a forma de pagamento não pode apagar os produtos já selecionados.');
assert.ok(nodeText(termSale.tree).includes('Frequência das Parcelas'),
  'Crediário deve exibir entrada, vencimento, frequência e parcelamento.');

await termSale.findButton('Finalizar Venda').props.onClick();
assert.deepEqual(termSale.notices, ['Selecione um cliente cadastrado.']);
assert.equal(termSale.saved.length, 0, 'Crediário sem cliente não pode ser gravado.');

termSale.find(node => node.type === 'input' && node.props.placeholder === 'Busque pelo nome do cliente...',
  'Busca de cliente cadastrado').props.onChange({ target: { value: 'CLIENTE' } });
termSale.render();
termSale.find(node => node.props?.key === 'customer-1' && typeof node.props.onClick === 'function',
  'Cliente cadastrado').props.onClick();
termSale.render();

termSale.find(node => node.type === 'select' && Array.isArray(node.props.children)
  && node.props.children.length === 12, 'Quantidade de parcelas').props.onChange({ target: { value: '3' } });
termSale.render();
termSale.find(node => node.type === 'input' && node.props.type === 'date'
  && String(node.props.className || '').includes('focus:ring-yellow-500'),
  'Primeiro vencimento').props.onChange({ target: { value: '2026-09-24' } });
termSale.render();

await termSale.findButton('Finalizar Venda').props.onClick();
assert.equal(termSale.saved.length, 0, 'A venda a prazo deve aguardar a análise de crédito.');
assert.equal(termSale.scheduled.length, 1, 'A análise de crédito deve ser iniciada uma única vez.');
termSale.scheduled.shift()();
termSale.render();
assert.ok(nodeText(termSale.tree).includes('Venda aprovada!'),
  'A aprovação do crediário deve permanecer disponível no fluxo unificado.');
await termSale.findButton('Concluir e salvar venda').props.onClick();
assert.equal(termSale.saved.length, 1);
assert.equal(termSale.saved[0].saleType, 'prazo');
assert.equal(termSale.saved[0].customerId, 'customer-1');
assert.equal(termSale.saved[0].anonymousSale, false);
assert.equal(termSale.saved[0].installmentsCount, 3);
assert.deepEqual(termSale.saved[0].installments.map(installment => installment.amount), [33.34, 33.33, 33.33],
  'Crediário precisa preservar a divisão exata dos centavos.');
assert.equal(termSale.closed, 1);

console.log('Fluxo único validado: PIX, dinheiro, débito, crédito e crediário gravam corretamente.');
