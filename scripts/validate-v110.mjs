import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const runtime = read('app-runtime-v75.js');
const handlerStart = runtime.indexOf('    const handleAddSale = async (data) => {');
const handlerEnd = runtime.indexOf('    const handleCancelSaleLogic = async', handlerStart);
assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, 'A gravação central das vendas precisa continuar disponível.');

const handler = runtime.slice(handlerStart, handlerEnd);
for (const marker of [
  'await runTransaction(db, async transaction =>',
  'setSelectedSaleDetail({',
  '...normalizedSale,',
  'id: saleRef.id,',
  '__pendingSync: true',
  'setNewSaleMode(null);',
  "setView('sales');",
  'return saleRef.id;'
]) assert.ok(handler.includes(marker), `A abertura do detalhamento após a venda está incompleta: ${marker}`);

assert.ok(
  handler.indexOf('setSelectedSaleDetail({') > handler.indexOf('await runTransaction(db, async transaction =>'),
  'O detalhamento só pode abrir depois que a transação da venda for concluída.'
);
assert.ok(
  handler.indexOf('setSelectedSaleDetail({') < handler.indexOf('return saleRef.id;'),
  'A venda deve preparar seu detalhamento antes de encerrar a gravação.'
);

for (const marker of [
  'sales.find(sale => sale.id === selectedSaleDetail.id)',
  'selectedSaleDetail.__pendingSync ? selectedSaleDetail : null',
  'isOpen: !!activeSaleDetails',
  'sale: activeSaleDetails'
]) assert.ok(runtime.includes(marker), `O detalhamento imediato não está ligado ao modal: ${marker}`);

const saleForm = read('nova-venda-runtime-v75.js');
assert.ok(saleForm.includes('if (await persistSale(saleData)) onClose();'), 'A venda no caixa precisa aguardar a gravação central.');
assert.ok(saleForm.includes('if (await persistSale(saleDataToSave))'), 'A aprovação manual precisa aguardar a gravação central.');
assert.ok(saleForm.includes('await persistSale(approvedSaleData)'), 'A venda a prazo aprovada precisa usar a gravação central.');

assert.ok(read('bootstrap-v75.js').includes("const VERSION = '110'"));
assert.ok(read('index.html').includes("bootstrap-v75.js?v=110"));
assert.ok(read('LEIA-ME.txt').includes('abre automaticamente seu detalhamento na aba Vendas'));

console.log('Versão 110 validada: vendas no caixa e a prazo abrem o detalhamento somente após a gravação confirmada.');
