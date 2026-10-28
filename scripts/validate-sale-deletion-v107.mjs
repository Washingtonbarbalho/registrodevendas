import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const runtime = fs.readFileSync(`${root}app-runtime-v75.js`, 'utf8');
const deletionSource = runtime.slice(runtime.indexOf('    const requestDelete ='), runtime.indexOf('    const handleUpdateProfile ='));
const flagSource = runtime.match(/^const TEMPORARY_SALE_DELETION_ENABLED = (?:true|false);/m)?.[0];
assert.ok(flagSource, 'A liberação temporária deve ter uma opção centralizada para ativar ou desativar.');

const saleFixture = (saleType = 'term', status = 'active') => ({
  saleType, status, customerName: 'Cliente de teste', totalPrice: 100,
  items: [{ productId: 'product-1', productName: 'Perfume', quantity: 1, price: 100 }],
  installments: [{ number: 1, amount: 40, paid: false, history: [{ amount: 60, date: '2026-10-28' }] }],
  cancellations: status === 'canceled' ? [{ type: 'total', reason: 'Teste anterior' }] : []
});

const createHarness = ({ enabled = true, sale = saleFixture(), failCommit = false } = {}) => {
  const salePath = 'artifacts/test-app/users/owner/sales/sale-1';
  const productPath = 'artifacts/test-app/users/owner/products/product-1';
  const untouchedSalePath = 'artifacts/test-app/users/owner/sales/sale-2';
  const records = new Map([
    [productPath, { quantity: 7, costPrice: 40 }],
    [untouchedSalePath, saleFixture('direct', 'completed')]
  ]);
  if (sale) records.set(salePath, structuredClone(sale));
  const originalOthers = structuredClone([...records].filter(([key]) => key !== salePath));
  const writes = [];
  const notices = [];
  let sales = [{ id: 'sale-1', ...sale }, { id: 'sale-2', ...saleFixture('direct', 'completed') }];
  let selected = { id: 'sale-1' };

  const dependencies = {
    db: {}, APP_ID: 'test-app', user: { uid: 'owner' }, sales,
    doc: (_db, ...segments) => segments.join('/'),
    serverTimestamp: () => 'SERVER_TIMESTAMP',
    productDetailsData: { data: null },
    setProductDetailsData: () => {},
    setSelectedSaleDetail: next => { selected = next; },
    setSales: next => { sales = typeof next === 'function' ? next(sales) : next; },
    alert: message => notices.push(message),
    console: { error: () => {} },
    deleteDoc: async reference => { records.delete(reference); writes.push(['delete', reference]); },
    runTransaction: async (_db, callback) => {
      const pending = [];
      const result = await callback({
        get: async reference => ({ exists: () => records.has(reference), data: () => structuredClone(records.get(reference)) }),
        set: (reference, data, options) => pending.push({ reference, data, options }),
        update: () => assert.fail('Excluir uma venda não deve modificar o estoque ou cancelar a venda.'),
        delete: () => assert.fail('A exclusão deve funcionar com as regras atuais, que proíbem delete físico.')
      });
      if (failCommit) throw new Error('Permissão negada ao gravar.');
      for (const { reference, data, options } of pending) {
        assert.equal(options?.merge, undefined, 'Os dados comerciais precisam ser substituídos, sem merge.');
        records.set(reference, structuredClone(data));
        writes.push(['set', reference]);
      }
      return result;
    }
  };
  const controller = Function('dependencies', `
    const { db, APP_ID, user, sales, doc, serverTimestamp, productDetailsData,
      setProductDetailsData, setSelectedSaleDetail, setSales, alert, console,
      deleteDoc, runTransaction } = dependencies;
    ${flagSource.replace(/= (?:true|false);/, `= ${enabled};`)}
    let deleteModal = { open: false, type: null, id: null };
    const setDeleteModal = next => { deleteModal = next; };
    ${deletionSource}
    return { requestDelete, confirmDelete, close: () => { deleteModal.open = false; }, getModal: () => deleteModal };
  `)(dependencies);
  return {
    ...controller, records, writes, notices, salePath,
    getSales: () => sales, getSelected: () => selected,
    assertOthersUntouched: () => assert.deepEqual([...records].filter(([key]) => key !== salePath), originalOthers)
  };
};

for (const enabled of [true, false]) {
 for (const type of ['direct', 'term']) {
  for (const status of ['active', 'completed', 'canceled']) {
    const sale = saleFixture(type, status);
    const harness = createHarness({ enabled, sale });
    harness.requestDelete('sale', 'sale-1');
    if (!enabled && status !== 'canceled') {
      await harness.confirmDelete();
      assert.equal(harness.getModal().open, false, 'Sem exceção, a venda precisa ser cancelada antes da confirmação.');
      assert.equal(harness.writes.length, 0, 'Vendas ativas ou quitadas não podem ser excluídas sem cancelamento.');
      assert.deepEqual(harness.records.get(harness.salePath), sale);
      assert.deepEqual(harness.notices, ['Cancele a venda antes de excluir o registro.']);
      harness.assertOthersUntouched();
      continue;
    }
    assert.equal(harness.getModal().open, true, 'Vendas canceladas devem permitir a confirmação, mesmo sem a exceção temporária.');
    assert.equal(harness.writes.length, 0, 'Abrir a confirmação não pode excluir dados.');
    assert.deepEqual(harness.records.get(harness.salePath), sale);
    await harness.confirmDelete();
    assert.deepEqual(harness.records.get(harness.salePath), {
      deleted: true, deletedAt: 'SERVER_TIMESTAMP', deletedBy: 'owner'
    }, 'A venda, os itens e os pagamentos devem ser apagados, restando apenas o marcador.');
    assert.deepEqual(harness.writes, [['set', harness.salePath]]);
    assert.deepEqual(harness.getSales().map(item => item.id), ['sale-2']);
    assert.equal(harness.getSelected(), null);
    assert.equal(harness.getModal().open, false);
    assert.equal(harness.notices.length, 0);
    harness.assertOthersUntouched();
  }
 }
}

const canceledConfirmation = createHarness();
canceledConfirmation.requestDelete('sale', 'sale-1');
canceledConfirmation.close();
await canceledConfirmation.confirmDelete();
assert.equal(canceledConfirmation.writes.length, 0, 'Fechar a confirmação precisa manter a venda.');

const disabled = createHarness({ enabled: false });
disabled.requestDelete('sale', 'sale-1');
await disabled.confirmDelete();
assert.equal(disabled.getModal().open, false);
assert.equal(disabled.writes.length, 0, 'Desativar a flag deve bloquear exclusões sem cancelamento.');
disabled.requestDelete('product', 'product-1');
await disabled.confirmDelete();
assert.equal(disabled.records.has('artifacts/test-app/users/owner/products/product-1'), false,
  'Desativar exclusões de vendas não deve bloquear a exclusão de produtos.');

const staleStatus = createHarness({ enabled: false, sale: saleFixture('term', 'canceled') });
staleStatus.requestDelete('sale', 'sale-1');
assert.equal(staleStatus.getModal().open, true);
staleStatus.records.set(staleStatus.salePath, saleFixture('term', 'active'));
await staleStatus.confirmDelete();
assert.equal(staleStatus.writes.length, 0, 'O status atual no banco deve bloquear exclusão, mesmo com uma confirmação antiga aberta.');
assert.deepEqual(staleStatus.records.get(staleStatus.salePath), saleFixture('term', 'active'));
assert.deepEqual(staleStatus.notices, ['Cancele a venda antes de excluir o registro.']);
staleStatus.assertOthersUntouched();

for (const sale of [null, { deleted: true, deletedAt: 'PREVIOUS' }]) {
  const missing = createHarness({ sale });
  missing.requestDelete('sale', 'sale-1');
  await missing.confirmDelete();
  assert.equal(missing.writes.length, 0, 'Uma venda já removida não pode ser regravada.');
  assert.ok(missing.notices[0].includes('não foi encontrada'));
  missing.assertOthersUntouched();
}

const failure = createHarness({ failCommit: true });
failure.requestDelete('sale', 'sale-1');
await failure.confirmDelete();
assert.deepEqual(failure.records.get(failure.salePath), saleFixture());
assert.equal(failure.writes.length, 0);
assert.equal(failure.getModal().open, true, 'Uma falha não pode parecer uma exclusão concluída.');
assert.equal(failure.getSales().length, 2);
assert.deepEqual(failure.notices, ['Permissão negada ao gravar.']);
failure.assertOthersUntouched();

const listenerSource = runtime.match(/const unsubS = onSnapshot\(query\(salesRef\), (s => \{[^\n]+\})\);/)?.[1];
assert.ok(listenerSource, 'A assinatura central de vendas precisa estar acessível para validação.');
let reloadedSales;
let loading = true;
const listener = Function('setSales', 'setLoadingData', `return (${listenerSource});`)(
  value => { reloadedSales = value; }, value => { loading = value; }
);
listener({ docs: [
  { id: 'sale-1', data: () => ({ deleted: true, deletedAt: 'SERVER_TIMESTAMP' }) },
  { id: 'sale-2', data: () => saleFixture() }
] });
assert.deepEqual(reloadedSales.map(item => item.id), ['sale-2'],
  'Uma venda excluída não pode reaparecer nos relatórios após recarregar ou desativar a opção.');
assert.equal(loading, false);

const modalSource = fs.readFileSync(`${root}modals-core-runtime-v75.js`, 'utf8');
const modalBody = modalSource.slice(modalSource.indexOf('export const SaleDetailsModal ='))
  .split(/\nexport const /)[0].replace('export const ', 'const ');
const iconNames = modalSource.match(/import \{ ([^}]+) \} from 'https:\/\/esm.sh\/lucide-react/)[1].split(',').map(name => name.trim());
const React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
const modal = Function('dependencies', `const { React, formatCurrency, formatDate, getHistoryCashAmount, ${iconNames.join(', ')} } = dependencies;
  ${modalBody}
  return SaleDetailsModal;`)(Object.assign({
  React, formatCurrency: value => String(value), formatDate: value => String(value), getHistoryCashAmount: item => item.amount
}, Object.fromEntries(iconNames.map(name => [name, name]))));
const textOf = node => Array.isArray(node) ? node.map(textOf).join('') : node && typeof node === 'object' ? textOf(node.props.children) : String(node ?? '');
const nodesOf = node => Array.isArray(node) ? node.flatMap(nodesOf) : node && typeof node === 'object' ? [node, ...nodesOf(node.props.children)] : [];
const eligibilitySource = runtime.match(/allowDeleteSale: ([^\n]+),/)?.[1];
assert.ok(eligibilitySource, 'O painel deve definir quando o botão de exclusão fica disponível.');
const canDelete = Function('TEMPORARY_SALE_DELETION_ENABLED', 'activeSaleDetails', `return ${eligibilitySource};`);
for (const status of ['active', 'completed', 'canceled']) {
  for (const enabled of [true, false]) {
    const requests = [];
    const tree = modal({ isOpen: true, sale: { id: 'sale-1', ...saleFixture('direct', status) },
      allowDeleteSale: canDelete(enabled, { status }), onDeleteSale: (...args) => requests.push(args), onClose: () => {} });
    const button = nodesOf(tree).find(node => node.type === 'button' && textOf(node).includes('Excluir Registro Permanentemente'));
    assert.equal(Boolean(button), enabled || status === 'canceled', 'Sem a exceção temporária, somente vendas canceladas podem mostrar o botão de exclusão.');
    if (button) {
      button.props.onClick();
      assert.deepEqual(requests, [['sale', 'sale-1']]);
    }
  }
}

console.log('Exclusão validada: cancelamento prévio obrigatório, status atual conferido na transação, exceção temporária, estoque intacto e filtro após recarregar.');
