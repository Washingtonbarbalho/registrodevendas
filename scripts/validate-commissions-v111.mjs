import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyInstallmentPayment, applySelectedInstallmentsPayment, buildFinancialLedger, fromCents, normalizeSaleMoney, reverseInstallmentPayment, toCents } from '../financial-core-v70.js';
import { aggregateSaleItems, buildSaleInventoryPlan } from '../inventory-reliability-v69.js';
import { buildReport } from '../reports-engine-v73.js';
import { archiveCommission, cancelCommission, commissionCashEntries, isCommissionCashEntry, portfolio, position, quote, readBook, recordTransition, saleCode, saleDraft, units } from '../commissions/core.js';
import { archiveBeforeDelete, bookFrom, createSaleCommission, postCommission, stampFor } from '../commissions/store.js';

// Testa os handlers da aplicação com documentos fictícios; não há conexão de rede.
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const source = read('app-runtime-v75.js');
const handler = (name, next, deps) => {
  const start = source.indexOf('    const ' + name + ' ='), end = source.indexOf('    const ' + next + ' =', start);
  assert.ok(start >= 0 && end > start, name);
  return Function(...Object.keys(deps), source.slice(start, end) + '\nreturn ' + name + ';')(...Object.values(deps));
};
const day = n => '2026-03-' + String(n).padStart(2, '0');
let clock = day(1), nextSale = 0, fail = false;
const who = { uid: 'test-store', email: 'loja@example.invalid' };
const stamp = (date = clock) => stampFor(who, 'Operadora', date);
const ref = (family, id) => ({ path: family + '/' + id, id });
const profileRef = ref('profile','info'), saleRef = id => ref('sales', id);
const docs = new Map([
  [profileRef.path, { approved: true, financialData: { entries: [{ id: 'original' }], accounts: [] } }],
  ['products/p', { name: 'Perfume de teste', quantity: 30 }]
]);
const get = ref => structuredClone(docs.get(ref.path));
const snapshot = ref => ({ exists: () => docs.has(ref.path), data: () => get(ref) });
const sale = id => ({ ...get(saleRef(id)), id });
const allSales = () => [...docs.keys()].filter(k => k.startsWith('sales/')).map(k => sale(k.slice(6))).filter(s => !s.deleted);
const book = () => bookFrom(snapshot(profileRef)), port = () => portfolio(allSales(), book());
const row = grantId => port().rows.find(r => r.id === grantId);
const runTransaction = async (_db, fn) => {
  const staged = new Map();
  const tx = {
    get: async r => { assert.equal(staged.size, 0, 'Firestore exige todas as leituras antes das escritas'); return snapshot(r); },
    set: (r, v) => staged.set(r.path, structuredClone(v)),
    update: (r, patch) => {
      const obj = staged.get(r.path) || get(r);
      assert.ok(obj, r.path);
      for (const [path, v] of Object.entries(patch)) {
        const keys = path.split('.'); let dest = obj;
        for (const k of keys.slice(0,-1)) dest = dest[k] ??= {};
        dest[keys.at(-1)] = structuredClone(v);
      }
      staged.set(r.path, obj);
    }
  };
  const result = await fn(tx);
  if (fail) throw new Error('Falha simulada no commit');
  for (const [k,v] of staged) docs.set(k,v);
  return result;
};
const env = { user: who, name: 'Operadora', today: day(31), runTransaction, db: {}, profileRef, saleRef };
const common = {
  ...env, APP_ID:'test', now: clock, doc: (target, ...parts) => parts.length ? ref(parts.at(-2), parts.at(-1)) : ref(target, 'T' + String(++nextSale).padStart(5,'0')),
  collection: (_db, ...parts) => parts.at(-1), serverTimestamp: () => 'servidor', getBrazilDateString: () => clock,
  commissionStamp: stamp, commissionProfileRef: () => profileRef, createSaleCommission, cancelCommission, bookFrom,
  recordTransition, normalizeSaleMoney, aggregateSaleItems, buildSaleInventoryPlan,
  setSelectedSaleDetail() {}, setNewSaleMode() {}, setView() {}, console: { error() {} },
  alert: message => { throw new Error(message); }, toCents, fromCents
};
const add = handler('handleAddSale', 'handleCancelSaleLogic', common);
const cancel = handler('handleCancelSaleLogic', 'confirmCancelSale', common);
const payment = (saleId, index, indices = [index]) => handler('handleConfirmPayment', 'handleDeletePayment',
  { ...common, paymentModal: { saleId, index, indices, source:'sale' }, applyInstallmentPayment, applySelectedInstallmentsPayment,
    setPaymentModal() {}, EMPTY_PAYMENT_MODAL: {} });
const reverse = (saleId, instIndex, histIndex) => handler('handleDeletePayment','handlePayFromList',
  { ...common, deletePaymentModal: { saleId, instIndex, histIndex }, reverseInstallmentPayment, setDeletePaymentModal() {} });
const del = id => handler('confirmDelete','handleUpdateProfile', { ...common, deleteModal: { open:true,type:'sale',id },
  sales:allSales(), TEMPORARY_SALE_DELETION_ENABLED:false, archiveBeforeDelete, setSales(){}, setDeleteModal(){} })();
const cmd = data => postCommission(env, { sellerId: 'A', date: clock, ...data });
const pay = (id, lines, override = {}) => cmd({ id, kind:'payout', lines, method:'pix', ...override });
const line = (saleId, amount) => ({ saleId, grantId:'sale:' + saleId, amount });
const bonus = (id, amount) => cmd({ id, kind:'credit', mode:'fixed', units:amount, reason:'Indicação de campanha' });
const agreement = (id, saleId, amount, override = {}) => cmd({ id, kind:'agreement', saleId, grantId:'sale:' + saleId, amount,
  reason:'Acordo individual sobre venda cancelada', settlement:'future', ...override });
const linked = (id, saleId, amount, extra = {}) => cmd({ id, kind:'credit', saleId, mode:'fixed', units:amount, reason:'Crédito adicional acordado', ...extra });
const cash = () => commissionCashEntries(get(profileRef).financialData);
const base = { saleType:'prazo', saleDate:clock, status:'active', customerName:'Cliente teste', productsTotal:300, totalPrice:300,
  totalCost:200, items:[{ productId:'p', quantity:1, unitPrice:300, price:300, unitCost:200, cost:200 }],
  entryAmount:50, installments:[100,100,50].map((amount,i) => ({ number:i+1, amount, paid:false, dueDate:day(10+i) })) };
const agreed = { sellerId:'A', mode:'percent', units:1000, expenseCents:0 };
assert.equal(units('1.234,56'),123456); assert.equal(units('0,01'),1); assert.ok(Number.isNaN(units('-5')));
assert.equal(quote('percent',1250,10005),1251); assert.throws(() => quote('percent',10001,100));
assert.equal(saleDraft({ sellerId:'' }),null); assert.throws(() => saleDraft({ sellerId:'A', mode:'fixed', value:'0' }));
await cmd({ kind:'seller', id:'A', sellerId:'', name:'Vendedora A', rate:800, phone:'+55 (85) 99999-1111' });
assert.equal(book().sellers[0].phone,'85999991111');
await assert.rejects(() => cmd({ kind:'seller',id:'wrong-phone',sellerId:'',name:'Outro',rate:500,phone:'12345' }),/WhatsApp válido/);
await cmd({ kind:'seller', id:'B', sellerId:'', name:'Vendedor B', rate:700 });
const t = await add({ ...base, commissionDraft:agreed }), g = 'sale:' + t;
assert.equal(saleCode(sale(t)), 'VP-00001');
assert.equal(sale(t).commission.sellerName,'Vendedora A'); assert.ok(!('commissionDraft' in sale(t)));
assert.equal(row(g).pending,3000); assert.equal(row(g).available,0);
await cmd({ kind:'seller',id:'edit1',sellerId:'A',name:'Vendedora A atual',rate:2000 });
assert.equal(row(g).amount,3000); assert.equal(sale(t).commission.sellerName,'Vendedora A');
await assert.rejects(() => pay('not-ready',[line(t,1)]),/saldo/);
clock=day(5);
await payment(t,0)(170,clock,'pix'); // 50 + 170; o excedente abate parte da parcela 2.
assert.equal(position(sale(t)).receipts,22000); assert.equal(row(g).available,0);
clock=day(6); await payment(t,1)(10,clock,'money');
assert.equal(row(g).available,3000); assert.equal(row(g).pending,0);
await assert.rejects(() => pay('antes',[line(t,100)],{ date:day(5) }),/data/);
await assert.rejects(() => pay('outro',[line(t,100)],{ sellerId:'B' }),/saldo/);
fail=true; await assert.rejects(() => pay('p1',[line(t,2000)]),/simulada/); fail=false;
assert.equal(cash().length,0); assert.equal(row(g).available,3000);
await pay('p1',[line(t,2000)]); await pay('p1',[line(t,2000)]); // Duplo clique/reenvio.
assert.equal(row(g).available,1000); assert.deepEqual(cash().map(e => e.value),[20]);
await assert.rejects(() => pay('stale',[line(t,2000)]),/saldo/);
await assert.rejects(() => agreement('too-soon',t,100),/cancelada/);
clock=day(7);
await cancel(t,'Devolução integral');
assert.equal(sale(t).cancellations[0].customerRefundAmount,230);
assert.equal(sale(t).cancellations[0].storeImpactAmount,230);
assert.equal(row(g).paid,2000); assert.equal(row(g).recoverable,2000); assert.equal(row(g).available,0);
assert.deepEqual(sale(t).commission.history.filter(e => e.kind==='void').map(e => e.amount),[-1000]);
assert.equal(book().agreements.length,0); assert.equal(cash().length,1);
await assert.rejects(() => cancel(t,'Duplicado'),/já foi/);
await assert.rejects(() => agreement('a0',t,100,{ date:day(6) }),/anterior/);
await assert.rejects(() => agreement('a0',t,2001),/supera/);
await assert.rejects(() => agreement('a0',t,100,{ reason:' ' }),/Descreva/);
await agreement('a1',t,1500); await agreement('a1',t,1500);
assert.equal(row(g).recoverable,500); assert.equal(port().agreements[0].remaining,1500);
assert.equal(book().agreements[0].settlement,'future');
assert.equal(book().refunds.length,0);
const legacyBook=book(); delete legacyBook.agreements[0].settlement;
assert.equal(portfolio(allSales(),legacyBook).agreements[0].remaining,1500);
const ledger = () => buildFinancialLedger({ sales:allSales(), financialData:{ entries:cash() } });
assert.deepEqual(ledger().filter(r => r.type==='expense').map(r => r.amount).sort((a,b)=>a-b),[20,230]);
assert.equal(book().agreements[0].actor,who.uid); assert.equal(book().agreements[0].code,'VP-00001');
await del(t);
assert.deepEqual(Object.keys(get(saleRef(t))).sort(),['deleted','deletedAt','deletedBy']);
assert.ok(!('customerName' in book().archives[0])); assert.ok(!('items' in book().archives[0]));
assert.equal(row(g).paid,2000); assert.equal(row(g).recoverable,500);
await agreement('a2',t,500); await assert.rejects(() => agreement('a3',t,1),/supera/);
clock=day(8); await bonus('b1',1000); await bonus('b2',1000);
await pay('p2',[{ grantId:'b1',amount:300 }]); // Acordos não abatem sem solicitação.
assert.equal(book().payouts.at(-1).offset,0); assert.equal(port().agreements[0].remaining,1500);
await pay('p3',[{ grantId:'b1',amount:700 },{ grantId:'b2',amount:1000 }],{ offset:1500 });
assert.deepEqual(cash().map(e => e.value),[20,3,2]);
assert.deepEqual(book().payouts.at(-1).offsets,[{ agreementId:'a1',amount:1500 }]);
await bonus('b3',500); await pay('p4',[{ grantId:'b3',amount:500 }],{ offset:500 });
assert.equal(cash().length,3,'Um repasse inteiramente compensado não é saída de caixa.');
assert.deepEqual(port().agreements.map(a => a.remaining),[0,0]);
assert.deepEqual(get(profileRef).financialData.entries,[{ id:'original' }]);
const context={ sales:[], products:[], customers:[], financialData:{ entries:cash() }, startDate:day(1), endDate:day(31) };
const reports=buildReport({ ...context, reportId:'net-result' });
assert.equal(reports.metrics.find(m=>m.label==='Resultado líquido').value,-25);
const detail=buildReport({ ...context, reportId:'result' }).rows.find(r=>r[0]==='Repasses de comissão');
assert.deepEqual(detail.slice(0,2),['Repasses de comissão','3']); assert.match(detail[2],/25,00/);

clock=day(10);
const x = await add({ ...base, saleDate:clock, commissionDraft:{ ...agreed, expenseCents:1000 } });
const xg='sale:'+x;
await payment(x,0)(180,clock); assert.equal(position(sale(x)).profit,2000); assert.equal(row(xg).pending,3000);
await payment(x,1)(10,clock); assert.equal(row(xg).available,3000);
await linked('extra',x,500); assert.equal(row(xg).pending,3000); assert.equal(row('extra').pending,500);
await linked('extra',x,500); assert.equal(sale(x).commission.grants.length,2);
await assert.rejects(() => linked('wrong',x,100,{ sellerId:'B' }),/outro vendedor/);
await payment(x,1)(5,clock); assert.equal(row(xg).available,3000); assert.equal(row('extra').available,500);
await reverse(x,1,2)(); assert.equal(row(xg).available,0); assert.equal(row('extra').available,0);
assert.ok(sale(x).commission.history.some(e => e.kind==='hold'));
const pre=position(sale(x));
clock=day(11);
await assert.rejects(() => payment(x,1,[1,2])(55,clock,'pix',{ discountAmount:10 }),/saldo das parcelas mudou/);
assert.deepEqual(position(sale(x)),pre);
await payment(x,1,[1,2])(50,clock,'pix',{ discountAmount:10 });
assert.equal(position(sale(x)).receipts,29000,'O desconto conjunto não é dinheiro recebido.');
assert.equal(row(xg).amount,2900); assert.equal(row('extra').amount,500); assert.equal(row('extra').available,500);
assert.equal(sale(x).commission.history.find(e => e.kind==='reprice').amount,-100);
await reverse(x,1,sale(x).installments[1].history.length-1)();
assert.deepEqual(position(sale(x)),pre); assert.equal(sale(x).commission.history.filter(e => e.kind==='reprice').at(-1).amount,100);
await cancel(x,'Cancelou antes do repasse');
assert.deepEqual(sale(x).commission.history.filter(e => e.kind==='void').map(e => e.amount),[-3000,-500]);
assert.equal(row(xg).recoverable,0);

clock=day(12);
let cardSale;
for (const method of ['pix','money','debit','credit']) {
  const id=await add({ ...base, saleType:'direct', saleDate:clock, status:'completed', paymentMethod:method,
    totalPrice:method==='credit'?330:300, netReceived:295, installments:[], commissionDraft:agreed });
  const r=row('sale:'+id);
  assert.equal(r.available,3000); assert.equal(r.code,id); assert.equal(sale(id).commission.grants.length,1);
  if (method==='credit') {
    cardSale=id;
    await pay('card-paid',[line(id,3000)]); await cancel(id,'Cancelamento no cartão');
    assert.ok(!sale(id).commission.history.some(e => e.kind==='void'));
    assert.equal(sale(id).cancellations[0].customerRefundAmount,330); assert.equal(sale(id).cancellations[0].storeImpactAmount,295);
    assert.equal(row('sale:'+id).recoverable,3000);
  }
}
const cardId='sale:'+cardSale;
const originalCancel = get(saleRef(cardSale));
await assert.rejects(() => agreement('missing-kind',cardSale,300,{ settlement:undefined }),/Escolha/);
await assert.rejects(() => agreement('missing-method',cardSale,300,{ settlement:'immediate' }),/Selecione como/);
await assert.rejects(() => agreement('too-early',cardSale,300,{ settlement:'immediate', method:'pix', date:day(11) }),/anterior/);
clock=day(13);
const recordRefund = () => agreement('refund-1',cardSale,1200,{ settlement:'immediate', method:'pix' });
fail=true; await assert.rejects(recordRefund,/simulada/); fail=false;
assert.equal(book().refunds.length,0);
await recordRefund(); await recordRefund();
assert.equal(book().refunds.length,1);
assert.equal(book().refunds[0].actor,who.uid);
assert.equal(book().refunds[0].code,cardSale);
assert.equal(row(cardId).recoverable,1800);
assert.equal(book().agreements.some(a => a.id==='refund-1'),false);
assert.equal(port().agreements.find(a => a.id==='refund-1').remaining,0);
await assert.rejects(() => agreement('duplicate-amount',cardSale,1801),/supera/);
assert.deepEqual(get(saleRef(cardSale)),originalCancel,'A devolução não muda o estorno do cliente nem escreve na venda.');
const refundEntries = cash().filter(e=>e.commissionRefundId);
assert.deepEqual(refundEntries.map(e=>[e.id,e.type,e.value,e.date]),[['commission-refund-refund-1','income',12,day(13)]]);
assert.equal(cash().filter(isCommissionCashEntry).length,cash().length);
await bonus('new-bonus',1500);
await assert.rejects(() => pay('refund-offset',[{ grantId:'new-bonus',amount:1500 }],{ offset:1200 }),/saldo de acordos/);
await agreement('future-card',cardSale,1800);
assert.equal(book().refunds.length,1);
assert.equal(row(cardId).recoverable,0);
await pay('future-offset',[{ grantId:'new-bonus',amount:1500 }],{ offset:1500 });
assert.deepEqual(book().payouts.at(-1).offsets,[{ agreementId:'future-card',amount:1500 }]);
assert.equal(port().agreements.find(a=>a.id==='future-card').remaining,300);
assert.equal(ledger().find(e=>e.manual?.commissionRefundId).amount,12);
const refundContext = {...context, financialData:{ entries:cash() }, startDate:day(13),endDate:day(13)};
const refundReport = buildReport({ ...refundContext,reportId:'result' });
assert.equal(refundReport.metrics.find(m=>m.label==='Entradas de caixa').value,12);
const refundDetail = refundReport.rows.find(r=>r[0]==='Devoluções de comissão');
assert.equal(refundDetail[1],'1'); assert.match(refundDetail[2],/12,00/);
assert.equal(buildReport({ ...refundContext,reportId:'net-result' }).metrics.find(m=>m.label==='Resultado líquido').value,12);
await del(cardSale);
assert.equal(cash().filter(e=>e.commissionRefundId).length,1,'Excluir uma venda não apaga a devolução já recebida.');
assert.deepEqual(get(profileRef).financialData.entries,[{ id:'original' }]);
const ordinary=await add({ ...base, saleDate:clock });
assert.equal(sale(ordinary).commission,undefined);
await linked('manual-percent',ordinary,750,{ mode:'percent' }); assert.equal(row('manual-percent').pending,2250);
await assert.rejects(() => linked('deleted',t,100),/cancelada ou excluída/);
await assert.rejects(() => bonus('invalid',0),/0,01/);
await assert.rejects(() => cmd({ ...agreed, kind:'credit',id:'s',reason:'Sem venda' }),/reais/);
await assert.rejects(() => pay('future',[line(ordinary,1)],{ date:'2027-01-01' }),/data válida/);
await cmd({ kind:'seller',id:'inactivate',sellerId:'A',name:'Vendedora A',rate:1000,active:false });
const qty=get(ref('products','p')).quantity, count=allSales().length;
await assert.rejects(() => add({ ...base, commissionDraft:agreed }),/não está disponível/);
assert.equal(allSales().length,count); assert.equal(get(ref('products','p')).quantity,qty);
await assert.rejects(() => bonus('inactive',100),/Reative/);
assert.ok(port().history.some(e => e.code==='VP-00001' && e.kind==='void'));
assert.throws(() => archiveCommission(sale(ordinary)),/Cancele/);
assert.deepEqual(readBook(null).sellers,[]);
const legacy={...sale(ordinary), totalCost:null, entryAmount:300};
assert.equal(position(legacy).costs,20000); assert.ok(position(legacy).released);
assert.equal(position({...legacy,items:[]}).released,false,'Custo desconhecido não libera o crediário.');
assert.ok(!/commission|comissão/i.test(read('sale-pdf-v65.js')),'O documento do cliente não mostra comissões.');
assert.ok(read('aba-financeiro-v68.js').includes('!isCommissionCashEntry(entry)'));
assert.ok(read('aba-relatorios-v73.js').includes('...commissionCashEntries(value)'));
console.log('Comissões: venda, estornos, repasses, devolução imediata no caixa, compensação futura e histórico após exclusão validados.');
