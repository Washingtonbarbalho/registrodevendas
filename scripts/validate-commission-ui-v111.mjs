import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as core from '../commissions/core.js';
import * as presentation from '../commissions/presentation.js';
import { createSaleCommission, stampFor } from '../commissions/store.js';
import { formatCurrency, formatDate } from '../utils.js';
import { isTermSale } from '../financial-core-v70.js';

// Exercita os componentes e callbacks com os mesmos dados fictícios, sem CDN ou Firebase.
const src = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const moduleFor = (file, deps, names) => Function(...Object.keys(deps),
  src(file).replace(/^import .*;$/gm, '').replace(/^export /gm, '') + '\nreturn {' + names + '};')(...Object.values(deps));
let slots = [], cursor = 0, effect;
const h = (type, props, ...children) => ({ type, props: props || {}, children:children.flat(Infinity) });
const useState = init => {
  const i = cursor++;
  if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init;
  return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }];
};
const react = { React:{ Fragment:'fragment', createElement:h }, useState, useEffect:fn=>{effect=fn;}, useMemo:fn=>fn(),
  useRef:v=>useState(()=>({ current:v }))[0], useId:()=>':label:' };
const treeNodes = t => t && typeof t === 'object' ? [t, ...t.children.flatMap(treeNodes)] : [];
const nodeText = t => t == null || t === false ? '' : typeof t === 'object' ? t.children.map(nodeText).join('') : String(t);
const view = (fn, props) => {
  slots = []; let tree;
  const render = () => { cursor=0; tree=fn(props); return tree; };
  render();
  const nodes = () => treeNodes(tree);
  const find = pred => { const n=nodes().find(pred); assert.ok(n,'Controle não encontrado'); return n; };
  const field = name => {
    const group = find(n => n.type==='label' && n.children[0]?.type==='span' && nodeText(n.children[0])===name);
    const result = treeNodes(group).find(n => ['input','select','textarea'].includes(n.type));
    assert.ok(result, name); return result;
  };
  const change = (name, value) => { field(name).props.onChange({ target:{ value } }); render(); };
  const click = (name, from = tree) => {
    const n=treeNodes(from).find(n=>n.type==='button' && nodeText(n)===name);
    assert.ok(n, name); assert.ok(!n.props.disabled, name); n.props.onClick(); render();
  };
  const submit = async () => { await tree.props.onSubmit({ preventDefault(){} }); render(); };
  return { render, nodes, field, change, find, click, submit, text:()=>nodeText(tree), get tree(){return tree;} };
};
const icons = Object.fromEntries('ArrowDownCircle BadgePercent Banknote Clock Copy Edit3 History MessageCircle Plus PlusCircle Receipt RefreshCw Search UserPlus Users Wallet X'.split(' ').map(n=>[n,'icon-'+n]));
const today = '2026-03-15', seller = { id:'A', name:'Ana', rate:850, phone:'+55 85 99999-1234' }, other = { id:'B', name:'Beatriz', rate:1200 };
const stamp = stampFor({ uid:'loja' },'Operadora', today, '2026-03-15T12:00:00Z');
let confirm = true, prompt = '', saved, opened, copied;
const deps = { ...core, ...presentation, ...icons, ...react, formatCurrency, formatDate, isTermSale, getBrazilDateString:()=>today, CommissionDialog:'CommissionDialog' };
const forms = moduleFor('commissions/forms.js', { ...deps,
  showAppConfirm:async (message,options)=>{prompt={message,...options};return confirm;} }, 'CommissionForm,SaleCommissionField');
const tabModule = moduleFor('commissions/tab.js', { ...deps, DateRangePicker:'DateRangePicker', CommissionForm:'CommissionForm',
  navigator:{clipboard:{writeText:async text=>{copied=text;}}} }, 'CommissionTab,CommissionDetails,MovementDetails,StatementDialog');
const book = core.readBook({ sellers:[seller,other] });
const live = { id:'S1', saleType:'direct', status:'completed', saleDate:today, customerName:'Cliente particular', productsTotal:100, totalPrice:105, totalCost:50 };
live.commission = createSaleCommission(live,{ sellerId:'A', mode:'percent', units:1000, expenseCents:0 },book,stamp);
const old = { ...live, id:'S0', customerName:'Cliente antigo' };
old.commission = createSaleCommission(old,{ sellerId:'A', mode:'fixed', units:1000, expenseCents:0 },book,stamp);
book.payouts.push({ ...stamp,id:'old-pay',sellerId:'A',sellerName:'Ana',gross:1000,cash:1000,offset:0,offsets:[],
  method:'money',reason:'Repasse realizado',lines:[{ grantId:'sale:S0',saleId:'S0',code:'S0',amount:1000 }] });
old.commission=core.cancelCommission(old,book,stamp,'Cancelada');old.status='canceled';
book.agreements.push({ ...stamp,id:'old-agreement',sellerId:'A',grantId:'sale:S0',saleId:'S0',code:'S0',amount:300,reason:'Acordo individual' });
book.refunds.push({ ...stamp,id:'refund',sellerId:'A',sellerName:'Ana',grantId:'sale:S0',saleId:'S0',code:'S0',amount:100,
  reason:'Acerto já recebido',settlement:'immediate',method:'pix' });
book.bonuses.push({ ...core.grant({ ...stamp,id:'only-b',kind:'credit',mode:'fixed',units:2900,reason:'Exclusivo da Beatriz' },0),sellerId:'B' });
const sales = [live,old], port = core.portfolio(sales,book);
const range = { startDate:today, endDate:today };
const overview = presentation.sellerOverview(port,seller.id,range);
const common = { seller,sales,port,onPost:async cmd=>{saved=cmd;return cmd.id;},onClose(){},onSaved(){} };

assert.equal(presentation.moneyMask('123456'),'1.234,56');
assert.equal(presentation.moneyMask(''),'');
assert.equal(presentation.pastedMoney('R$ 12,35'),'12,35');
assert.equal(presentation.pastedMoney('-3,00'),null);
assert.equal(presentation.percentMask('12.509'),'12,50');
assert.equal(presentation.finishPercent('7,'),'7,00');
assert.equal(presentation.sellerPhoneMask('+55 (85) 3222-1234'),'(85) 3222-1234');
assert.match(presentation.sellerWhatsappUrl('(55) 99999-1234','x'),/^https:\/\/wa.me\/5555999991234\?/);

const tab = view(tabModule.CommissionTab,{ book,sales,onPost(){},onOpenSale:s=>{opened=s.id;},storeName:'Loja Teste' });
assert.match(tab.text(),/Vendedores e comissões/);assert.match(tab.text(),/Saldo atual/);
assert.ok(!tab.nodes().some(n=>n.type==='CommissionForm'),'Sem formulário aberto por padrão.');
tab.click('Cadastrar vendedor'); assert.equal(tab.find(n=>n.type==='CommissionForm').props.kind,'seller');
tab.find(n=>n.type==='CommissionForm').props.onClose();tab.render();
tab.click('Ver detalhes',tab.nodes().find(n=>n.type==='article' && /Cliente particular/.test(nodeText(n))));
assert.equal(tab.find(n=>n.type===tabModule.CommissionDetails).props.row.id,'sale:S1');
tab.find(n=>n.type===tabModule.CommissionDetails).props.onOpenSale(live);assert.equal(opened,'S1');tab.render();
tab.click('Movimentações');assert.match(tab.text(),/Devolução recebida no caixa/);assert.doesNotMatch(tab.text(),/Cliente particular/);
tab.click('Compensações');assert.doesNotMatch(tab.text(),/Repasse registrado/);
tab.click('Extrato do vendedor');assert.equal(tab.find(n=>n.type===tabModule.StatementDialog).props.storeName,'Loja Teste');
tab.find(n=>n.type===tabModule.StatementDialog).props.onClose();tab.render();
tab.change('Vendedor','B');tab.click('Vendas e comissões');
assert.doesNotMatch(tab.text(),/Cliente particular/);assert.match(tab.text(),/Bônus avulso/);
tab.find(n=>n.type==='DateRangePicker').props.onChange({ startDate:'2026-04-01',endDate:'2026-04-30' });tab.render();
assert.match(tab.text(),/Nenhuma comissão para mostrar/);

const statement = view(tabModule.StatementDialog,{ seller,storeName:'Loja Teste',range,overview,onClose(){} });
const wa = statement.tree.props.actions.find(n=>n.type==='a').props.href;
assert.ok(wa.startsWith('https://wa.me/5585999991234?text='));
const message = new URL(wa).searchParams.get('text');
assert.match(message,/🧾 \*EXTRATO DE COMISSÕES\*/);assert.match(message,/💰 \*SALDO ATUAL\*/);
assert.match(message,/📋 \*MOVIMENTAÇÕES DO PERÍODO\*/);assert.match(message,/Loja Teste/);assert.match(message,/S1/);
assert.match(message,/Devoluções recebidas/);assert.match(message,/Compensação em repasses futuros/);
assert.doesNotMatch(message,/Beatriz|Cliente particular|Cliente antigo|Operadora|Acerto já recebido/);
await statement.tree.props.actions[0].props.onClick();assert.equal(copied,message);

const fieldProps = { sellers:[seller,other],form:{ sellerId:'',mode:'percent',value:'',expenses:'' },base:10000,cost:8000,expected:10500,term:true };
fieldProps.setForm = v => { fieldProps.form=typeof v==='function'?v(fieldProps.form):v; };
const field = view(forms.SaleCommissionField,fieldProps);
field.change('Vendedor (opcional)','A');assert.equal(field.field('Comissão').props.value,'8,50');
field.change('Como calcular','fixed');assert.equal(field.field('Comissão').props.value,'8,50');
field.change('Comissão','3000');assert.equal(field.field('Comissão').props.value,'30,00');assert.match(field.text(),/lucro previsto desta venda não cobre/);
field.change('Despesas diretas da venda (opcional)','12345');assert.equal(field.field('Despesas diretas da venda (opcional)').props.value,'123,45');
field.change('Vendedor (opcional)','');assert.doesNotMatch(field.text(),/Comissão prevista|indicador/i);

const reg = view(forms.CommissionForm,{ ...common,kind:'seller',seller:null });
assert.equal(reg.tree.type,'CommissionDialog');
reg.change('Nome do vendedor','Vendedora');reg.change('Comissão padrão','11,25');
reg.change('WhatsApp com DDD (opcional)','+55 85999999999');
assert.equal(reg.field('WhatsApp com DDD (opcional)').props.value,'(85) 99999-9999');
await reg.submit();assert.equal(saved.rate,1125);assert.equal(saved.sellerId,'');
const credit = view(forms.CommissionForm,{ ...common,kind:'credit' });
credit.change('Vincular a uma venda (opcional)','S1');credit.change('Como calcular','percent');
credit.change('Comissão adicional','7,50');credit.change('Motivo','Comissão manual');await credit.submit();
assert.deepEqual([saved.saleId,saved.units,saved.mode],['S1',750,'percent']);
const agreement = view(forms.CommissionForm,{ ...common,kind:'agreement',initialGrantId:'sale:S0' });
agreement.change('Valor da compensação','150');agreement.change('Motivo','Acerto confirmado');
saved=null;await agreement.submit();assert.equal(saved,null,'Não assumir um tratamento por padrão.');
const selectSettlement = value => {
  agreement.find(n=>n.type==='input' && n.props.type==='radio' && n.props.value===value).props.onChange();
  agreement.render();
};
selectSettlement('future');confirm=false;await agreement.submit();assert.equal(saved,null);
confirm=true;await agreement.submit();assert.deepEqual([saved.grantId,saved.amount,saved.settlement],['sale:S0',150,'future']);
assert.match(prompt.message,/Nada entra no caixa agora/);
selectSettlement('immediate');saved=null;await agreement.submit();assert.equal(saved,null,'A entrada exige a forma em que o dinheiro voltou.');
agreement.change('Forma da devolução','pix');await agreement.submit();
assert.equal(saved.settlement,'immediate');assert.equal(saved.method,'pix');assert.match(prompt.message,/já devolveu.*via Pix/);
assert.match(prompt.message,/O estorno do cliente não muda/);
const payout = view(forms.CommissionForm,{ ...common,kind:'payout' });
payout.find(n=>n.type==='input' && n.props.type==='checkbox').props.onChange({ target:{ checked:true } });payout.render();
payout.change('Liquidar','800');assert.equal(payout.field('Abater de compensações (opcional)').props.value,'');await payout.submit();
assert.equal(saved.offset,0);assert.deepEqual(saved.lines,[{grantId:'sale:S1',saleId:'S1',amount:800}]);
payout.change('Abater de compensações (opcional)','300');await payout.submit();assert.equal(saved.offset,300);
assert.match(prompt.message,/saída de R\$\s*5,00/);

// O contêiner real cria um portal, bloqueia a rolagem e devolve o foco ao sair.
let closed=0, focused='', restored=0;
const body={style:{overflow:'auto'}};
const opener={isConnected:true,focus(){restored++;}};
const fakeDocument={activeElement:opener,body};
const { CommissionDialog }=moduleFor('commissions/dialog.js',{ ...react,...icons, document:fakeDocument,
  createPortal:(child,dest)=>{ assert.equal(dest,body); return child; } },'CommissionDialog');
const frame=view(CommissionDialog,{title:'Cadastro',onClose(){closed++;},onSubmit(){}});
const panel=frame.find(n=>n.props.role==='dialog');
assert.equal(panel.type,'form');assert.equal(panel.props['aria-modal'],true);
assert.equal(panel.props['data-no-restore'],true);
panel.props.ref.current={ querySelector:()=>({focus(){focused='form';}}), querySelectorAll:()=>[] };
const cleanup=effect();assert.equal(focused,'form');assert.equal(body.style.overflow,'hidden');
panel.props.onKeyDown({key:'Escape',stopPropagation(){}});assert.equal(closed,1);
cleanup();assert.equal(restored,1);assert.equal(body.style.overflow,'auto');
assert.ok(src('app-runtime-v75.js').includes('book: commissionBook, sales, onPost: saveCommissionCommand'));
assert.ok(src('tab-persistence.js').includes("return 'commissions'"));
assert.ok(src('tab-persistence.js').includes('.app-modal-panel:not([data-no-restore])'));
console.log('Interface de comissões: modais, filtros, máscaras, extrato exclusivo, repasse e dois tipos de compensação validados.');
