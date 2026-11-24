import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as core from '../commissions/core.js';
import { createSaleCommission, stampFor } from '../commissions/store.js';
import { formatCurrency, formatDate } from '../utils.js';

// Mesmo simulador de hooks usado para validar a Nova venda, sem CDN nem dados reais.
const src = file => readFileSync(new URL('../'+file, import.meta.url),'utf8');
const moduleFor = (file, deps, names) => Function(...Object.keys(deps),
  src(file).replace(/^import .*;$/gm,'').replace(/^export /gm,'')+'\nreturn {'+names+'};')(...Object.values(deps));
let slots=[],cursor=0;
const h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)});
const useState=init=>{
  const i=cursor++;if(!(i in slots)) slots[i]=typeof init==='function'?init():init;
  return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];
};
const react={React:{Fragment:'fragment',createElement:h},useState,useEffect:()=>{},useMemo:f=>f(),useRef:v=>useState(()=>({current:v}))[0]};
const view=(fn, props)=>{
  slots=[];let tree;
  const render=()=>{cursor=0;tree=fn(props);return tree;};render();
  const walk=t=>t&&typeof t==='object'?[t,...t.children.flatMap(walk)]:[];
  const nodes=()=>walk(tree);
  const text=t=>t==null||t===false?'':typeof t==='object'?t.children.map(text).join(''):String(t);
  const find=(pred)=>{const n=nodes().find(pred);assert.ok(n,'Controle não encontrado');return n;};
  const field=name=>{
    const label=find(n=>n.type==='label'&&n.children[0]?.type==='span'&&text(n.children[0]).startsWith(name));
    return label.children.find(n=>['input','select'].includes(n?.type));
  };
  const change=(name,value)=>{field(name).props.onChange({target:{value}});render();};
  const click=name=>find(n=>n.type==='button'&&text(n)===name).props.onClick();
  const submit=async()=>{await tree.props.onSubmit({preventDefault(){}});render();};
  return {render,nodes,field,change,find,click,submit,text:()=>text(tree)};
};
const today='2026-03-15', seller={id:'A',name:'Ana',rate:850}, other={id:'B',name:'Beatriz',rate:1200};
const stamp=stampFor({uid:'loja'},'Operadora',today,'2026-03-15T12:00:00Z');
let confirm=true, prompt='', saved, opened, shared;
const forms=moduleFor('commissions/forms.js',{...core,...react,formatCurrency,getBrazilDateString:()=>today,
  showAppConfirm:async message=>{prompt=message;return confirm;}},'CommissionForm,SaleCommissionField,brl,decimal,h');
const {CommissionTab}=moduleFor('commissions/tab.js',{...react,...forms,...core,formatDate,
  getCurrentMonthStart:()=>today,getCurrentMonthEnd:()=>today,window:{open:url=>{shared=url;}}},'CommissionTab');
const book=core.readBook({sellers:[seller,other]});
const live={id:'S1',saleType:'direct',status:'completed',saleDate:today,customerName:'Cliente indicado',productsTotal:100,totalPrice:105,totalCost:50};
live.commission=createSaleCommission(live,{sellerId:'A',mode:'percent',units:1000,expenseCents:0},book,stamp);
const old={...live,id:'S0',customerName:'Cliente antigo'};
old.commission=createSaleCommission(old,{sellerId:'A',mode:'fixed',units:1000,expenseCents:0},book,stamp);
book.payouts.push({...stamp,id:'old-pay',sellerId:'A',sellerName:'Ana',gross:1000,cash:1000,offset:0,offsets:[],
  method:'money',reason:'Repasse realizado',lines:[{grantId:'sale:S0',saleId:'S0',code:'S0',amount:1000}]});
old.commission=core.cancelCommission(old,book,stamp,'Devolução');old.status='canceled';
book.agreements.push({...stamp,id:'old-agreement',sellerId:'A',grantId:'sale:S0',saleId:'S0',code:'S0',amount:300,reason:'Acordo individual'});
book.bonuses.push({...core.grant({...stamp,id:'only-b',kind:'credit',mode:'fixed',units:2900,reason:'Exclusivo da Beatriz'},0),sellerId:'B'});
const sales=[live,old],port=core.portfolio(sales,book);
const common={seller,sales,port,onPost:async cmd=>{saved=cmd;return cmd.id;},onClose(){},onSaved(){}};
const tab=view(CommissionTab,{book,sales,onPost(){},onOpenSale:s=>{opened=s.id;}});
assert.match(tab.text(),/Vendedores e comissões/);assert.match(tab.text(),/Disponível/);
tab.click('Ver venda');assert.equal(opened,'S1');tab.click('Compartilhar extrato no WhatsApp');
assert.match(decodeURIComponent(shared),/Extrato de comissões · Ana/);assert.doesNotMatch(decodeURIComponent(shared),/Exclusivo da Beatriz/);
tab.change('Vendedor ou indicador','B');assert.match(tab.text(),/Exclusivo da Beatriz/);assert.doesNotMatch(tab.text(),/Cliente indicado/);

const fieldProps={sellers:[seller,other],form:{sellerId:'',mode:'percent',value:'',expenses:''},base:10000,cost:8000,expected:10500,term:true};
fieldProps.setForm=v=>{fieldProps.form=typeof v==='function'?v(fieldProps.form):v;};
const field=view(forms.SaleCommissionField,fieldProps);
field.change('Vendedor ou indicador','A');assert.equal(field.field('Comissão (%)').props.value,'8,50');
field.change('Como calcular','fixed');assert.equal(field.field('Comissão (R$)').props.value,'8,50');
field.change('Comissão (R$)','30,00');assert.match(field.text(),/lucro previsto desta venda não cobre/);
field.change('Vendedor ou indicador','');assert.doesNotMatch(field.text(),/Comissão prevista/);

const reg=view(forms.CommissionForm,{...common,kind:'seller',seller:null});
reg.change('Nome','Indicadora');reg.change('Comissão padrão','11,25');await reg.submit();
assert.equal(saved.rate,1125);assert.equal(saved.sellerId,'');
const credit=view(forms.CommissionForm,{...common,kind:'credit'});
credit.change('Vincular','S1');credit.change('Como calcular','percent');credit.change('Comissão adicional','7,50');credit.change('Motivo','Nova indicação');await credit.submit();
assert.equal(saved.saleId,'S1');assert.equal(saved.units,750);assert.equal(saved.mode,'percent');
const agreement=view(forms.CommissionForm,{...common,kind:'agreement'});
agreement.change('Comissão já liquidada','sale:S0');agreement.change('Valor do acordo','1,50');agreement.change('Motivo','Acerto confirmado');
confirm=false;saved=null;await agreement.submit();assert.equal(saved,null);confirm=true;await agreement.submit();
assert.equal(saved.grantId,'sale:S0');assert.equal(saved.amount,150);assert.match(prompt,/estorno do cliente não mudam/);
const payout=view(forms.CommissionForm,{...common,kind:'payout'});
payout.find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});payout.render();
payout.change('Liquidar','8,00');assert.equal(payout.field('Abater de acordos').props.value,'');await payout.submit();
assert.equal(saved.offset,0);assert.deepEqual(saved.lines,[{grantId:'sale:S1',saleId:'S1',amount:800}]);
payout.change('Abater de acordos','3,00');await payout.submit();assert.equal(saved.offset,300);assert.match(prompt,/saída de R\$\s*5,00/);
assert.ok(src('app-runtime-v75.js').includes('book: commissionBook, sales, onPost: saveCommissionCommand'));
assert.ok(src('tab-persistence.js').includes("return 'commissions'"));
console.log('Interface de comissões: seleção do indicador, alerta de margem, filtros, extrato privado, créditos, repasses e confirmação do acordo validados.');
