// Registro de Vendas - Worker 105 compacto. Gerado por build.mjs.
var Ge=a=>Number.isFinite(Number(a))?Number(a):0,Ce=class extends Error{constructor(r,n,s={}){super(n),this.name="FinancialCalculationError",this.code=r,this.details=
s}},re=a=>{let r=Ge(a),n=Math.sign(r||1)*Number.EPSILON*Math.max(1,Math.abs(r));return Math.round((r+n)*100)},oe=a=>Math.round(Ge(a))/100,sa=a=>oe(re(a)),ka=(a=[],r=n=>n)=>oe(
(Array.isArray(a)?a:[]).reduce((n,s,f)=>n+re(r(s,f)),0));var Ta=a=>a?typeof a?.toDate=="function"?a.toDate().toISOString().slice(0,10):typeof a?.seconds=="number"?new Date(a.seconds*1e3).toISOString().slice(0,10):String(
a).split("T")[0]:"";var ia=a=>a?.saleType==="prazo"||!a?.saleType;var Ia=a=>{if(Ge(a?.originalAmount)>0)return sa(a.originalAmount);let r=Math.max(0,re(a?.amount)),s=(Array.isArray(a?.history)?a.history:[]).reduce((f,m)=>f+Math.
max(0,re(m?.amount)),0);return oe(r+s)};var Sa=a=>(Array.isArray(a)?a:[]).map(r=>({...r,amount:sa(r.amount),originalAmount:Ia(r),history:Array.isArray(r.history)?r.history.map(n=>({...n})):[]})),da=(a,r,n,s,f=new Date().
toISOString())=>{let m=parseInt(r,10),l=Sa(a),b=l[m],A=re(n),I=Ta(s);if(!b||b.paid||re(b.amount)<=0)throw new Ce("invalid-installment","A parcela selecionada nã\
o está mais disponível para pagamento.");if(A<=0||!I)throw new Ce("invalid-payment","Informe um valor e uma data de pagamento válidos.");let O=l.slice(m).reduce(
(k,M)=>k+(M.paid?0:Math.max(0,re(M.amount))),0);if(A>O)throw new Ce("payment-exceeds-balance",`O pagamento informado é maior que o saldo restante do contrato (${oe(
O).toFixed(2).replace(".",",")}).`);let p=Math.max(0,re(b.amount)),_=Math.min(A,p),u=A-_,D=[];for(let k=m+1;u>0&&k<l.length;k+=1){let M=l[k];if(M.paid)continue;
let S=Math.max(0,re(M.amount));if(S<=0)continue;let C=Math.min(S,u),U=S-C;M.amount=oe(U),M.paid=U===0,M.paidAt=M.paid?I:null,M.paidAtDateTime=M.paid?f:null,M.history.
push({date:I,amount:oe(C),type:"abatement",fromInstallment:m,sourceTimestamp:f,timestamp:f}),D.push({installmentIndex:k,amount:oe(C)}),u-=C}let N=p-_,R={date:I,
amount:oe(_),type:A<p?"partial":A===p?"full":"full_surplus",timestamp:f};return A>p&&(R.surplus=oe(A-p),R.allocations=D),b.history.push(R),b.amount=oe(N),b.paid=
N===0,b.paidAt=b.paid?I:null,b.paidAtDateTime=b.paid?f:null,{installments:l,historyItem:R,allocations:D,paidAmount:oe(A),remainingBalance:ka(l.filter(k=>!k.paid),
k=>k.amount),allPaid:l.every(k=>k.paid||re(k.amount)<=0)}};var ue=class extends Error{constructor(r,n,s={}){super(n),this.name="InventoryReliabilityError",this.code=r,this.details=s}},Pa=(a,r)=>{let n=Number(a);if(!Number.
isInteger(n)||n<=0)throw new ue("invalid-quantity",`${r||"Produto"}: informe uma quantidade inteira maior que zero.`);return n},ca=(a=[])=>{if(!Array.isArray(a)||
a.length===0)throw new ue("empty-sale","Adicione pelo menos um produto antes de concluir a venda.");let r=new Map;for(let n of a){if(!n?.productId)throw new ue(
"invalid-product","Um item da venda não está vinculado a um produto válido. Atualize a página e tente novamente.");let s=String(n.productId),f=String(n.productName||
n.name||"Produto"),m=Pa(n.quantity,f),l=r.get(s);l?l.requestedQuantity+=m:r.set(s,{productId:s,productName:f,requestedQuantity:m})}return[...r.values()]},ua=(a=[],r=[])=>{
let n=new Map((Array.isArray(r)?r:[]).map(s=>[String(s.productId),s]));return a.map(s=>{let f=n.get(String(s.productId));if(!f)throw new ue("product-not-found",
`${s.productName}: o produto não foi encontrado. Atualize a página e tente novamente.`,{productId:s.productId});let m=Number(f.quantity);if(!Number.isInteger(
m)||m<0)throw new ue("invalid-stock",`${s.productName}: o saldo de estoque está inválido e precisa ser corrigido.`,{productId:s.productId,currentQuantity:m});
if(s.requestedQuantity>m)throw new ue("insufficient-stock",`${s.productName}: estoque disponível é ${m} un., mas a venda solicita ${s.requestedQuantity} un.`,
{productId:s.productId,currentQuantity:m,requestedQuantity:s.requestedQuantity});return{productId:s.productId,productName:s.productName,previousQuantity:m,requestedQuantity:s.
requestedQuantity,newQuantity:m-s.requestedQuantity}})};var de="/api/integrations/asaas/flow/charges",Ee=/^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/,la=/^[A-Za-z0-9_-]{1,128}$/,ne=a=>[
"creating","pending"].includes(a),W=a=>({stringValue:a}),fe=a=>({integerValue:String(a)}),pa=a=>({booleanValue:a}),We=a=>({timestampValue:a}),x=(a,r)=>a?.fields?.[r]?.
stringValue||"",se=(a,r)=>Number(a?.fields?.[r]?.integerValue||0),Ye=a=>JSON.stringify(a,(r,n)=>n&&typeof n=="object"&&!Array.isArray(n)?Object.fromEntries(Object.
keys(n).sort().map(s=>[s,n[s]])):n),qe=(a,r=0)=>{if(r>20)throw new Error("invalid_document");if("stringValue"in a)return a.stringValue;if("booleanValue"in a)return a.
booleanValue;if("integerValue"in a)return Number(a.integerValue);if("doubleValue"in a)return Number(a.doubleValue);if("timestampValue"in a)return a.timestampValue;
if("nullValue"in a)return null;if(a.arrayValue)return(a.arrayValue.values||[]).map(n=>qe(n,r+1));if(a.mapValue)return Object.fromEntries(Object.entries(a.mapValue.
fields||{}).map(([n,s])=>[n,qe(s,r+1)]));throw new Error("invalid_document")},He=a=>Object.fromEntries(Object.entries(a?.fields||{}).map(([r,n])=>[r,qe(n)])),Ue=(a,r)=>!!a&&
typeof a=="object"&&!Array.isArray(a)&&Object.keys(a).every(n=>r.includes(n));function ma(a){let{IntegrationError:r,json:n,sandboxTag:s,decryptAsaasKey:f,sandboxApi:m,
handleSandboxCheck:l,FIRESTORE_DOCUMENTS:b}=a,A=e=>"projects/vendas-aura/databases/(default)/documents/"+e,I=e=>"_asaas_flow_sandbox/"+e,O=(e,t)=>I(e)+"/orders/"+
t,p=(e,t)=>I(e)+"/pending/"+t,_=(e,t)=>I(e)+"/receipts/"+t,u=(e,t,d=409)=>{throw new r(e,t,d)},D=(e,t)=>s(e,"aura:source-parcel:v1:"+Ye({status:t.status||"activ\
e",installments:t.installments})),N=e=>((!e||e.fields.simulationOnly?.booleanValue!==!0||e.fields.flowVersion?.integerValue!=="1"||!Ee.test(x(e,"id"))||!["check\
out","installment"].includes(x(e,"kind"))||!Number.isSafeInteger(se(e,"amountCents"))||se(e,"amountCents")<500)&&u("flow_invalid","Não foi possível conferir o r\
egistro de teste."),e),R=e=>{N(e);let t=x(e,"state"),d=x(e,"kind"),c=e.fields.setupComplete?.booleanValue===!0,i=JSON.parse(x(e,"resultJson")||"{}"),g={creating:"\
Preparando o Pix de teste. Se a operação for interrompida, retome este teste pelo perfil.",pending:"Aguardando o pagamento de teste. Use somente a simulação n\
o Sandbox.",received:d==="checkout"?"Venda de teste confirmada. Caixa e estoque reais não foram alterados.":"Parcela de teste recebida. A parcela original não \
foi alterada.",cancelled:"Cobrança de teste cancelada. Nenhum registro real foi alterado.",refunded:"Reembolso conferido no Sandbox. O resultado da simulação f\
oi estornado.",review:"A origem ou o status mudou durante o teste. Confira a cobrança no Asaas Sandbox. Nenhuma baixa real foi realizada."};return{environment:"\
sandbox",simulationOnly:!0,id:x(e,"id"),kind:d,state:t,amountCents:se(e,"amountCents"),providerStatus:x(e,"providerStatus"),ready:c,payload:ne(t)&&c?x(e,"payloa\
d"):"",encodedImage:ne(t)&&c?x(e,"encodedImage"):"",receiptId:x(e,"receiptId"),confirmationSource:x(e,"confirmationSource"),summary:{receivedCents:i.receivedCents||
0,remainingCents:i.remainingCents||0,stockUnits:i.stockUnits||0,installmentPaid:i.installmentPaid===!0},message:g[t]||"Confira o andamento da cobrança de teste."}},
k=(e,t,d)=>({update:{name:A(e),fields:d},updateMask:{fieldPaths:Object.keys(d)},currentDocument:t?{updateTime:t.updateTime}:{exists:!1}}),M=(e,t)=>({delete:A(e),
currentDocument:{updateTime:t.updateTime}}),S=async(e,t)=>{for(let i of t){let g=i.update?.name||i.delete;if(!(g.startsWith(A(I(e.user.uid)+"/"))||g===A("_asaas\
_integrations/"+e.user.uid)))throw new Error("unsafe_write")}let d=await e.fetchGoogle(b.slice(0,-1)+":commit",{method:"POST",headers:e.headers,redirect:"manual",
signal:e.signal,body:JSON.stringify({writes:t})});[409,412].includes(d.status)&&u("flow_conflict","O teste mudou durante esta operação. Consulte o andamento e t\
ente novamente."),d.ok||u("flow_save_failed","Não foi possível salvar o teste. Consulte o andamento antes de repetir.",503);let c=JSON.parse(await d.text());(!Array.
isArray(c.writeResults)||c.writeResults.length!==t.length)&&u("flow_save_failed","A gravação do teste não foi confirmada. Consulte o andamento antes de repetir.",
503)},C=async(e,t)=>{let d=await e.load("_asaas_integrations/"+e.user.uid),c=await e.load(p(e.user.uid,x(t,"id"))),i=se(d,"pendingCharges");(!d||!c||!Number.isSafeInteger(
i)||i<1)&&u("flow_state_conflict","O andamento do teste precisa ser conferido antes de confirmar.",503);let g=[k("_asaas_integrations/"+e.user.uid,d,{pendingCharges:fe(
i-1)}),M(p(e.user.uid,x(t,"id")),c)];if(x(t,"sourceSlot")){let h=I(e.user.uid)+"/slots/"+x(t,"sourceSlot"),w=await e.load(h);(!w||x(w,"orderId")!==x(t,"id"))&&u(
"flow_state_conflict","Não foi possível conferir a reserva da parcela de teste.",503),g.push(M(h,w))}return g},U=async e=>{(e.headers.get("Content-Type")||"").
toLowerCase().startsWith("application/json")||u("invalid_body","Envie os dados do teste em JSON.",400);let t=e.body?.getReader();t||u("invalid_body","Informe os\
 dados do teste.",400);let d=[],c=0;for(;;){let{value:h,done:w}=await t.read();if(w)break;c+=h.length,c>12288&&(await t.cancel(),u("invalid_body","O pedido de t\
este excedeu o tamanho permitido.",413)),d.push(h)}let i=new Uint8Array(c),g=0;for(let h of d)i.set(h,g),g+=h.length;try{return JSON.parse(new TextDecoder("utf-\
8",{fatal:!0}).decode(i))}catch{u("invalid_body","Confira os dados do pedido de teste.",400)}},V=async e=>{let t=e.body?.getReader();if(t)for(;;){let{value:d,done:c}=await t.
read();if(c)return;d.length&&(await t.cancel(),u("invalid_body","Esta ação usa somente a cobrança salva.",400))}},K=async e=>{e.current?.fields?.enabled?.booleanValue||
u("flow_disabled","Ative a conexão Asaas Sandbox no perfil antes de testar.");let t=await f(e.env,e.user.uid,e.current.fields);return{key:t,keyTag:await s(e.env,
"aura:sandbox-key:v1:"+t),api:m(e.fetchAsaas,t,e.signal)}},H=(e,t)=>{(e?.id!==x(t,"paymentId")||e.customer!==x(t,"customerId")||e.externalReference!==x(t,"refer\
ence")||e.billingType!=="PIX"||e.value!==oe(se(t,"amountCents"))||typeof e.status!="string"||!/^[A-Z_]{3,64}$/.test(e.status))&&u("flow_payment_mismatch","A cob\
rança não corresponde ao pedido de teste. Nenhuma baixa foi realizada.")},Z=async(e,t)=>{if(t?.kind==="checkout"){(!Ue(t,["kind","idempotencyKey","items"])||!/^[a-f0-9-]{36}$/.
test(t.idempotencyKey||"")||!Ee.test(t.idempotencyKey)||!Array.isArray(t.items)||t.items.length<1||t.items.length>10)&&u("invalid_checkout","O teste do caixa ac\
eita de 1 a 10 itens válidos.",400);let d=t.items.map(w=>((!Ue(w,["productId","quantity","lineTotalCents"])||!la.test(w.productId||"")||!Number.isSafeInteger(w.
quantity)||w.quantity<1||w.quantity>999||!Number.isSafeInteger(w.lineTotalCents)||w.lineTotalCents<w.quantity||w.lineTotalCents>5e6)&&u("invalid_checkout","Conf\
ira os produtos, as quantidades e os preços do carrinho de teste.",400),{productId:w.productId,quantity:w.quantity,lineTotalCents:w.lineTotalCents})),c=ca(d),i=await Promise.
all(c.map(async w=>{let T=await e.load("artifacts/vendas-aura-main/users/"+e.user.uid+"/products/"+w.productId);T||u("product_not_found","Um produto do carrinho\
 não está mais disponível.");let v=He(T);return{productId:w.productId,quantity:v.quantity,name:String(v.name||"Produto").slice(0,160),costPrice:v.costPrice}})),
g;try{g=ua(c,i)}catch{u("invalid_stock","O estoque atual não permite esse carrinho de teste. Atualize as quantidades.")}let h=d.reduce((w,T)=>w+T.lineTotalCents,
0);return{id:t.idempotencyKey,amountCents:h,snapshot:{kind:"checkout",items:d,stockPlan:g,amountCents:h},request:{kind:t.kind,items:d}}}if(t?.kind==="installmen\
t"){(!Ue(t,["kind","saleId","installmentIndex"])||!la.test(t.saleId||"")||!Number.isInteger(t.installmentIndex)||t.installmentIndex<0||t.installmentIndex>119)&&
u("invalid_installment","Confira a venda e a parcela de teste.",400);let d=await e.load("artifacts/vendas-aura-main/users/"+e.user.uid+"/sales/"+t.saleId);d||u(
"sale_not_found","A venda não foi encontrada.");let c=He(d),i=c.installments?.[t.installmentIndex];(!ia(c)||c.status==="canceled"||!i||i.paid||re(i.amount)<=0)&&
u("installment_unavailable","Esta parcela não está mais disponível para o teste.");let g=await D(e.env,c),h=await s(e.env,"aura:installment-order:v1:"+e.user.
uid+":"+t.saleId+":"+t.installmentIndex+":"+g+":"+e.keyTag),w=(await s(e.env,"aura:parcel-slot:v1:"+t.saleId+":"+t.installmentIndex)).slice(0,32);return{id:h.slice(
0,32),sourceSlot:w,amountCents:re(i.amount),snapshot:{kind:"installment",installments:c.installments,installmentIndex:t.installmentIndex,saleId:t.saleId,sourceMarker:g},
request:{kind:t.kind,saleId:t.saleId,installmentIndex:t.installmentIndex,sourceMarker:g}}}u("invalid_kind","Escolha um teste do caixa ou de parcela.",400)},ae=async e=>{
let t=await e.fetchGoogle(b+I(e.user.uid)+"/pending?pageSize=10",{method:"GET",headers:e.headers,redirect:"manual",signal:e.signal});t.ok||u("flow_list_failed",
"Não foi possível carregar os testes pendentes.",503);let d=JSON.parse(await t.text());(d.nextPageToken||d.documents!==void 0&&!Array.isArray(d.documents))&&u(
"flow_list_failed","Não foi possível conferir os testes pendentes.",503);let c=(d.documents||[]).map(i=>{let g=x(i,"id");return(!Ee.test(g)||i.name!==A(p(e.user.
uid,g)))&&u("flow_list_failed","Não foi possível conferir um teste pendente.",503),{id:g,kind:x(i,"kind"),amountCents:se(i,"amountCents")}});return n({environment:"\
sandbox",simulationOnly:!0,orders:c})},q=async(e,t,d,c,i="")=>{N(t),H(d,t);let g=x(t,"state");if(i&&x(t,"lastEventId")===i)return t;let h=d.deleted!==!0&&d.status===
"RECEIVED",w=d.status==="REFUNDED",T=d.deleted===!0,v=g,$=JSON.parse(x(t,"resultJson")||"{}");if(h&&ne(g)){let B=JSON.parse(x(t,"snapshotJson"));if(B.kind==="ch\
eckout")$={receivedCents:se(t,"amountCents"),stockUnits:B.stockPlan.reduce((X,j)=>X+j.requestedQuantity,0),stockPlan:B.stockPlan,saleStatus:"completed"};else{let X=await e.
load("artifacts/vendas-aura-main/users/"+e.user.uid+"/sales/"+B.saleId);if(!X||await D(e.env,He(X))!==B.sourceMarker)v="review";else{let j=new Date().toISOString(),
G=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date),te=["year","month","day"].
map(De=>G.find(Ve=>Ve.type===De)?.value).join("-"),ce=da(B.installments,B.installmentIndex,oe(se(t,"amountCents")),te,j);ce.historyItem.provider="asaas-sandbox",
ce.historyItem.providerPaymentId=d.id,$={receivedCents:se(t,"amountCents"),remainingCents:re(ce.remainingBalance),installmentPaid:ce.installments[B.installmentIndex].
paid,installments:ce.installments,saleStatus:ce.allPaid?"completed":"active"}}}v!=="review"&&(v="received")}else w&&(g==="received"||ne(g))?(v="refunded",$={receivedCents:0,
refundedCents:se(t,"amountCents")}):h&&!["received","review"].includes(g)||T&&d.status==="RECEIVED"&&ne(g)?v="review":T&&ne(g)&&(v="cancelled");if(v===g&&!ne(g))
return t;let J={state:W(v),providerStatus:W(T?"DELETED":d.status),lastEventId:W(i||x(t,"lastEventId")),updatedAt:We(new Date().toISOString())},Q=[];if(ne(g)&&!ne(
v)&&Q.push(...await C(e,t)),v!==g&&["received","refunded","review"].includes(v)){Object.assign(J,{resultJson:W(JSON.stringify($)),receiptId:W(d.id),confirmationSource:W(
c)});let B=await e.load(_(e.user.uid,d.id));v==="received"&&B&&u("flow_receipt_conflict","Este pagamento já possui um resultado salvo. Confira o andamento do te\
ste.",503),Q.push(k(_(e.user.uid,d.id),B,{orderId:W(x(t,"id")),paymentId:W(d.id),state:W(v),amountCents:fe(se(t,"amountCents")),simulationOnly:pa(!0),resultJson:W(
JSON.stringify($))}))}return Q.unshift(k(O(e.user.uid,x(t,"id")),t,J)),await S(e,Q),e.load(O(e.user.uid,x(t,"id")))};return{methods:e=>e===de?["GET","POST"]:new RegExp(
"^"+de+"/(?:[a-f0-9]{32}|[a-f0-9-]{36})(?:/(prepare|simulate|reconcile|cancel))?$").test(e)?e.slice(de.length+1).includes("/")?["POST"]:["GET"]:[],matches:e=>e===
de||e.startsWith(de+"/"),handleRequest:async e=>{let t=new URL(e.request.url).pathname;if(t===de&&e.request.method==="GET")return ae(e);let d=await K(e);Object.
assign(e,d);let c,i;if(t===de){let w=await U(e.request),T=await e.load("_asaas_sandbox_checks/"+e.user.uid);if((x(T,"keyTag")!==e.keyTag||x(T,"providerStatus")!==
"RECEIVED"||!T?.fields?.webhookAt?.timestampValue)&&u("flow_diagnostic_required","Conclua primeiro o teste de cobrança e retorno automático no perfil."),w?.kind===
"checkout"&&Ee.test(w.idempotencyKey||"")&&(i=await e.load(O(e.user.uid,w.idempotencyKey)),i)){let $=await s(e.env,"aura:flow-request:v1:"+Ye({kind:w.kind,items:w.
items}));(!Ue(w,["kind","idempotencyKey","items"])||$!==x(i,"requestHash"))&&u("flow_intent_changed","Este teste pertence a outro carrinho. Abra uma nova cobran\
ça de teste.")}let v;if(i||(v=await Z(e,w)),c=i?x(i,"id"):v.id,v?.sourceSlot){let $=await e.load(I(e.user.uid)+"/slots/"+v.sourceSlot);$&&x($,"orderId")!==c&&u(
"flow_installment_pending","Já existe um teste pendente desta parcela. Retome ou cancele esse teste pelo perfil.")}if(i||(i=await e.load(O(e.user.uid,c))),!i){
(v.amountCents<500||v.amountCents>5e6)&&u("flow_amount_invalid","Neste teste, o valor deve ficar entre R$ 5,00 e R$ 50.000,00.",400);let $=JSON.stringify(v.snapshot);
new TextEncoder().encode($).length>64e3&&u("flow_snapshot_large","Este contrato é muito grande para o teste. Escolha outra parcela.",400);let J=await e.load("_\
asaas_integrations/"+e.user.uid);(!J?.fields?.enabled?.booleanValue||await s(e.env,"aura:sandbox-key:v1:"+await f(e.env,e.user.uid,J.fields))!==e.keyTag)&&u("fl\
ow_credential_changed","A conexão mudou. Reabra o perfil antes de gerar o teste.");let Q=se(J,"pendingCharges");(!Number.isInteger(Q)||Q<0||Q>=5)&&u("flow_pend\
ing_limit","Conclua ou cancele os testes pendentes no perfil antes de criar outro.");let ee={id:W(c),kind:W(w.kind),state:W("creating"),amountCents:fe(v.amountCents),
snapshotJson:W($),requestHash:W(await s(e.env,"aura:flow-request:v1:"+Ye(v.request))),keyTag:W(e.keyTag),reference:W("aura-flow-"+c),simulationOnly:pa(!0),flowVersion:fe(
1),sourceSlot:W(v.sourceSlot||""),createdAt:We(new Date().toISOString()),leaseUntil:We(new Date(0).toISOString())},B=[k(O(e.user.uid,c),null,ee),k(p(e.user.uid,
c),null,{id:W(c),kind:W(w.kind),amountCents:fe(v.amountCents)}),k("_asaas_integrations/"+e.user.uid,J,{pendingCharges:fe(Q+1)})];v.sourceSlot&&B.push(k(I(e.user.
uid)+"/slots/"+v.sourceSlot,null,{orderId:W(c)})),await S(e,B),i=await e.load(O(e.user.uid,c))}}else c=t.slice(de.length+1).split("/")[0],i=await e.load(O(e.user.
uid,c)),i||u("flow_not_found","A cobrança de teste não foi encontrada.",404);if(N(i),e.request.method==="GET")return n(R(i));x(i,"keyTag")!==e.keyTag&&u("flow\
_credential_changed","Este teste pertence à conexão anterior. Confira a cobrança no Asaas Sandbox.");let g=t.slice(de.length+1+c.length+1);if(t!==de&&await V(
e.request),t===de||g==="prepare"){if(!ne(x(i,"state")))return n(R(i));let w=new Request("https://worker.internal/api/integrations/asaas/sandbox-charge",{method:"\
POST"});if(await l({...e,request:w,checkPath:O(e.user.uid,c)}),i=await e.load(O(e.user.uid,c)),ne(x(i,"state"))){let T=I(e.user.uid)+"/payments/"+x(i,"paymentId"),
v=await e.load(T);await S(e,[k(O(e.user.uid,c),i,{state:W("pending")}),k(T,v,{orderId:W(c)})])}return n(R(await e.load(O(e.user.uid,c))))}if(g==="simulate"){if(!ne(
x(i,"state")))return n(R(i));let w=new Request("https://worker.internal/api/integrations/asaas/sandbox-charge/simulate",{method:"POST"});return await l({...e,request:w,
checkPath:O(e.user.uid,c)}),n({...R(await e.load(O(e.user.uid,c))),message:"Simulação enviada. Aguarde a confirmação automática do Asaas."})}if(!x(i,"payme\
ntId")){if(g==="cancel"&&ne(x(i,"state"))&&x(i,"pendingCreate")!=="payment")return await S(e,[k(O(e.user.uid,c),i,{state:W("cancelled")}),...await C(e,i)]),n(R(
await e.load(O(e.user.uid,c))));u("flow_not_prepared","Retome a preparação deste teste antes de conferir ou cancelar.")}let h=await e.api("/payments/"+x(i,"pa\
ymentId"));return H(h,i),g==="cancel"&&ne(x(i,"state"))&&h.deleted!==!0&&h.status==="CONFIRMED"&&u("flow_cancellation_blocked","O Asaas ainda está analisando a \
cobrança. Aguarde a conclusão para confirmar ou cancelar o teste."),g==="cancel"&&ne(x(i,"state"))&&h.deleted!==!0&&["PENDING","OVERDUE"].includes(h.status)&&
(await e.api("/payments/"+h.id,"DELETE"),h=await e.api("/payments/"+h.id),H(h,i),h.deleted!==!0&&!["RECEIVED","REFUNDED"].includes(h.status)&&u("flow_cancel_unk\
nown","O cancelamento ainda não foi confirmado pelo Asaas. Confira o andamento antes de repetir.")),n(R(await q(e,i,h,"reconciliation")))},handleWebhook:async e=>{
let t=e.event.payment.externalReference,d=await e.load(I(e.user.uid)+"/payments/"+e.event.payment.id),c=d?x(d,"orderId"):typeof t=="string"&&t.startsWith("aura-\
flow-")?t.slice(10):"";if(!Ee.test(c))return n({accepted:!0});let i=await e.load(O(e.user.uid,c));if(!i)return n({accepted:!0});if(N(i),x(i,"paymentId")||u("flo\
w_webhook_retry","A cobrança ainda está sendo registrada. Repetir entrega.",503),x(i,"paymentId")!==e.event.payment.id)return n({accepted:!0});e.current=await e.
load("_asaas_integrations/"+e.user.uid);let g=await e.load("artifacts/vendas-aura-main/users/"+e.user.uid+"/profile/info");if(g?.fields?.approved?.booleanValue!==
!0||!["","active"].includes(g.fields.status?.stringValue||"")||!e.current?.fields?.enabled?.booleanValue)return n({accepted:!0});if(Object.assign(e,await K(e)),
x(i,"keyTag")!==e.keyTag)return n({accepted:!0});let h=await e.api("/payments/"+e.event.payment.id);try{await q(e,i,h,"webhook",e.event.id)}catch(w){throw w.code===
"flow_conflict"&&u("flow_webhook_retry","O teste mudou. Repetir entrega.",503),w}return n({accepted:!0})}}}var pe="/api/integrations/asaas-production",Oa="https://api.asaas.com/v3/pix/addressKeys?status=ACTIVE&limit=1",Na="_asaas_production_integrations/";async function Me(a,r,n,s){
let{IntegrationError:f,encryptionKey:m,decodeBase64url:l}=s;if(n?.fields?.environment?.stringValue!=="production"||n.fields.version?.integerValue!=="1")throw new f(
"production_format_invalid","Não foi possível conferir a conexão de Produção salva.");try{let b=l(n.fields.iv?.stringValue);if(b.length!==12)throw new Error(
"invalid_iv");let A=new TextEncoder().encode("vendas-aura:asaas:production:v1:"+r),I=await crypto.subtle.decrypt({name:"AES-GCM",iv:b,additionalData:A},await m(
a),l(n.fields.cipher?.stringValue));return new TextDecoder("utf-8",{fatal:!0}).decode(I)}catch(b){throw b instanceof f?b:new f("production_key_unreadable","Não \
foi possível abrir a chave real salva. Confira a configuração de proteção antes de substituir a conexão.")}}function fa(a){let{IntegrationError:r,json:n,authenticatedUser:s,
checkFirebase:f,loadPrivateDocument:m,encryptionKey:l,base64url:b,decodeBase64url:A,integrationBody:I,DEFAULT_APP_ORIGIN:O,FIRESTORE_DOCUMENTS:p}=a,_=(S,C,U=503)=>{
throw new r(S,C,U)},u=S=>new TextEncoder().encode("vendas-aura:asaas:production:v1:"+S),D=async(S,C,U)=>{let V=crypto.getRandomValues(new Uint8Array(12)),K=await crypto.
subtle.encrypt({name:"AES-GCM",iv:V,additionalData:u(C)},await l(S),new TextEncoder().encode(U));return{cipher:b(new Uint8Array(K)),iv:b(V)}},N=(S,C,U)=>Me(S,C,
U,a),R=S=>({configured:!!S,environment:"production",connectionVersion:1,receivingEnabled:!1,hasActivePixKey:S?.fields?.hasActivePixKey?.booleanValue===!0,checkedAt:S?.
fields?.checkedAt?.timestampValue||null}),k=async S=>{let C=S.body?.getReader();if(C)for(;;){let{value:U,done:V}=await C.read();if(V)return;U.length&&(await C.cancel(),
_("invalid_body","Esta ação usa somente a conexão real salva.",400))}},M=async(S,C,U)=>{let V;try{V=await C(Oa,{method:"GET",redirect:"manual",signal:U,headers:{
accept:"application/json",access_token:S,"User-Agent":"RegistroDeVendas-Pix-Production-Connection/1.0"}})}catch(H){let Z=["TimeoutError","AbortError"].includes(
H?.name);_("production_connection_failed",Z?"A consulta da conta real excedeu o tempo de espera. Tente novamente.":"Não foi possível consultar a conta real do A\
saas. Tente novamente.",Z?504:503)}V.ok||_("production_key_rejected",[401,403].includes(V.status)?"O Asaas não aceitou a chave real. Confira se ela pertence à c\
onta de Produção e permite consultar as chaves Pix.":V.status===429?"O Asaas limitou temporariamente as consultas. Aguarde e tente novamente.":"O Asaas não co\
ncluiu a consulta da conta real. Tente novamente.",502);let K;try{K=JSON.parse(await V.text())}catch{_("production_response_invalid","O Asaas não retornou uma r\
esposta válida para a consulta da conta real.",502)}return Array.isArray(K?.data)||_("production_response_invalid","Não foi possível conferir a consulta da con\
ta real.",502),K.data.some(H=>H?.status==="ACTIVE")};return async(S,C,U,V)=>{let K=S.headers.get("Origin"),H=typeof C.APP_ORIGIN=="string"&&C.APP_ORIGIN.trim()?
C.APP_ORIGIN.trim():O;if(!K||K!==H)return n({code:"origin_denied",message:"Abra a conexão de Produção pelo sistema de vendas."},403);let Z={"Access-Control-A\
llow-Origin":K,Vary:"Origin"},ae=y=>{for(let[e,t]of Object.entries(Z))y.headers.set(e,t);return y},q=new URL(S.url).pathname,o=q===pe?["GET","PUT","DELETE"]:q===
pe+"/test"?["POST"]:[];if(!o.length)return ae(n({code:"not_found",message:"Rota não encontrada."},404));if(S.method==="OPTIONS"){if(!o.includes(S.headers.get("\
Access-Control-Request-Method")||""))return ae(n({code:"method_not_allowed",message:"Método não permitido."},405));let y=n(null,200);return new Response(null,
{status:204,headers:{...Object.fromEntries(y.headers),...Z,"Access-Control-Allow-Methods":o.join(", "),"Access-Control-Allow-Headers":"Authorization, Content-Ty\
pe","Access-Control-Max-Age":"600"}})}if(!o.includes(S.method))return ae(n({code:"method_not_allowed",message:"Método não permitido."},405));try{let y=await s(
S,U),e=S.method==="PUT"?await I(S):null;e&&(Object.keys(e).some(d=>d!=="apiKey")||typeof e.apiKey!="string")&&_("invalid_body","Informe somente a chave de API d\
e Produção. A ativação dos recebimentos será feita na próxima etapa.",400),e||await k(S);let t=await f(C,U,!1,async(d,c)=>{let i={accept:"application/json",
"Content-Type":"application/json",Authorization:"Bearer "+d},g=G=>m(U,i,c,G),h=await g("artifacts/vendas-aura-main/users/"+y.uid+"/profile/info");(h?.fields?.approved?.
booleanValue!==!0||!["","active"].includes(h.fields.status?.stringValue||""))&&_("account_not_approved","Sua conta precisa estar aprovada e ativa para conectar \
o Asaas real.",403);let w=Na+y.uid,T=await g(w),v=()=>new URLSearchParams(T?{"currentDocument.updateTime":T.updateTime}:{"currentDocument.exists":"false"});if([
"PUT","DELETE"].includes(S.method)&&Number(T?.fields?.pendingCharges?.integerValue||0)>0&&_("production_pending_charges","Existem cobranças pendentes vinculadas\
 à conexão real. Confira essas cobranças antes de alterar a chave.",409),S.method==="DELETE"){if(T){let G=await U(p+w+"?"+v(),{method:"DELETE",headers:i,redirect:"\
manual",signal:c});[409,412].includes(G.status)&&_("production_changed","A conexão real mudou. Atualize o perfil antes de remover.",409),!G.ok&&G.status!==404&&
_("production_delete_failed","Não foi possível remover a conexão real.")}return n({...R(null),message:"Chave de Produção removida. A conexão Sandbox foi pres\
ervada."})}if(await l(C),S.method==="GET")return T&&await N(C,y.uid,T),n(R(T));let $=e?e.apiKey.trim():T?await N(C,y.uid,T):"";$||_("production_key_required","I\
nforme a chave da API da sua conta real do Asaas.",400);let J=await M($,V,c),Q=new Date().toISOString(),ee={hasActivePixKey:{booleanValue:J},checkedAt:{timestampValue:Q},
updatedAt:{timestampValue:Q}};if(e){let G=await D(C,y.uid,$);Object.assign(ee,{environment:{stringValue:"production"},version:{integerValue:"1"},cipher:{stringValue:G.
cipher},iv:{stringValue:G.iv},enabled:{booleanValue:!1}})}let B=v();for(let G of Object.keys(ee))B.append("updateMask.fieldPaths",G);let X=await U(p+w+"?"+B,{method:"\
PATCH",headers:i,redirect:"manual",signal:c,body:JSON.stringify({fields:ee})});[409,412].includes(X.status)&&_("production_changed","A conexão real mudou durant\
e a consulta. Atualize o perfil e tente novamente.",409),X.ok||_("production_save_failed","A chave foi consultada, mas não foi possível confirmar a gravação. At\
ualize o perfil antes de repetir.");let j;try{j=JSON.parse(await X.text())}catch{_("production_save_failed","Não foi possível confirmar a gravação da conexão re\
al. Atualize o perfil antes de repetir.")}return(j?.name!=="projects/vendas-aura/databases/(default)/documents/"+w||typeof j.updateTime!="string"||!j.fields||Object.
entries(ee).some(([G,te])=>JSON.stringify(j.fields[G])!==JSON.stringify(te)))&&_("production_save_failed","Não foi possível confirmar a gravação da conexão real\
. Atualize o perfil antes de repetir."),n({...R(j),message:J?"Conta real do Asaas conectada. A chave está protegida e a consulta foi validada. Os recebimentos r\
eais ainda aguardam ativação.":"Conta real do Asaas conectada. Falta cadastrar ou ativar uma chave Pix nessa conta. Os recebimentos reais ainda aguardam ativa\
ção."})});return ae(t)}catch(y){return ae(n({code:y instanceof r?y.code:"production_unavailable",message:y instanceof r?y.message:"Não foi possível concluir a\
 consulta da conta real. Tente novamente."},y instanceof r?y.status:503))}}}var me=pe+"/receipt-check",Fe="/api/webhooks/asaas/production/",ha=["PAYMENT_CONFIRMED","PAYMENT_RECEIVED","PAYMENT_REFUNDED","PAYMENT_PARTIALLY_REFUNDED","PAYM\
ENT_DELETED","PAYMENT_OVERDUE","PAYMENT_RESTORED","PAYMENT_UPDATED","PAYMENT_REFUND_IN_PROGRESS"],Ra="https://api.asaas.com/v3",L=a=>({stringValue:a}),ie=a=>({timestampValue:a}),
ke=a=>({booleanValue:a}),he=a=>({integerValue:String(a)}),F=(a,r)=>a?.fields?.[r]?.stringValue||"",Te=(a,r)=>Number(a?.fields?.[r]?.integerValue||0),Ie=a=>typeof a==
"string"&&/^[A-Za-z0-9_-]{5,128}$/.test(a),je=()=>new Date().toISOString(),ye=()=>new Date(0).toISOString(),xa=()=>{let a=new Intl.DateTimeFormat("en-US",{timeZone:"\
America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date);return["year","month","day"].map(r=>a.find(n=>n.type===r).value).join(
"-")},Se=a=>typeof a=="number"&&Number.isFinite(a)&&Math.abs(a*100-Math.round(a*100))<1e-5?Math.round(a*100):null,Da=a=>{if(typeof a!="string"||!/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.
test(a))return!1;let r=a.replace(/\D/g,"");if(/^(\d)\1+$/.test(r))return!1;for(let n of[9,10])if([...r.slice(0,n)].reduce((m,l,b)=>m+Number(l)*(n+1-b),0)*10%11%
10!==Number(r[n]))return!1;return!0};function ya(a){let{IntegrationError:r,json:n,authenticatedUser:s,checkFirebase:f,loadPrivateDocument:m,sandboxTag:l,equalToken:b,
DEFAULT_APP_ORIGIN:A,FIRESTORE_DOCUMENTS:I,PUBLIC_WORKER_URL:O}=a,p=(o,y,e=409)=>{throw new r(o,y,e)},_=o=>"_asaas_production_checks/"+o,u=o=>"_asaas_production\
_integrations/"+o,D=o=>"projects/vendas-aura/databases/(default)/documents/"+o,N=(o,y,e)=>({update:{name:D(o),fields:e},updateMask:{fieldPaths:Object.keys(e)},currentDocument:y?
{updateTime:y.updateTime}:{exists:!1}}),R=async(o,y,e=!1)=>{if(!o.body){if(e)return null;p("invalid_body","Informe os dados do pagador do teste real.",400)}(o.headers.
get("Content-Type")||"").toLowerCase().startsWith("application/json")||p("invalid_body","Envie os dados do teste em JSON.",400);let t=o.body.getReader(),d=[],c=0;
for(;;){let{value:h,done:w}=await t.read();if(w)break;c+=h.length,c>y&&(await t.cancel(),p("invalid_body","Os dados excedem o tamanho permitido.",413)),d.push(h)}
if(!c&&e)return null;let i=new Uint8Array(c),g=0;for(let h of d)i.set(h,g),g+=h.length;try{let h=JSON.parse(new TextDecoder("utf-8",{fatal:!0}).decode(i));return e&&
(!h||typeof h!="object"||Array.isArray(h))&&p("invalid_body","Confira os dados do pagador.",400),h}catch{p("invalid_body","Não foi possível conferir os dados en\
viados.",400)}},k=async o=>{let y=o.body?.getReader();if(y)for(;;){let{value:e,done:t}=await y.read();if(t)return;e.length&&(await y.cancel(),p("invalid_body","\
Esta ação usa somente a cobrança real salva.",400))}},M=o=>((!o||typeof o!="object"||Array.isArray(o)||Object.keys(o).length!==2||Object.keys(o).some(y=>!["p\
ayerName","payerCpf"].includes(y))||typeof o.payerName!="string"||o.payerName.trim().length<2||o.payerName.length>160||/[\x00-\x1f\x7f]/.test(o.payerName)||!Da(
o.payerCpf))&&p("payer_required","Informe seu nome completo e um CPF válido para gerar o Pix real de R$ 5,00.",400),{name:o.payerName.normalize("NFC").trim().replace(
/\s+/g," ").toUpperCase(),cpfCnpj:o.payerCpf.replace(/\D/g,"")}),S=o=>{let y=F(o,"providerStatus")||"NOT_CREATED",e=o?.fields?.setupComplete?.booleanValue===!0,
t=!!o?.fields?.receivedWebhookAt?.timestampValue,d={NOT_CREATED:"Gere um Pix real de R$ 5,00 para validar a conta oficial e o retorno automático.",PENDING:"Pix\
 real pronto. Pague pelo aplicativo do seu banco e aguarde a confirmação automática.",OVERDUE:"A cobrança real está vencida. Confira o andamento antes de pag\
ar ou cancelar.",CONFIRMED:"O Asaas ainda está processando o pagamento real. Aguarde o recebimento.",RECEIVED:t?"Pagamento real recebido. Retorno automático da\
 conta oficial validado.":"Pagamento localizado na conta real. Aguardando o retorno automático autenticado.",DELETED:"Cobrança real cancelada. Ela não registro\
u venda, parcela ou baixa de estoque.",REFUNDED:"O Asaas informa que a cobrança foi estornada. Confira os valores na conta oficial.",REVIEW:"A cobrança foi alt\
erada fora do sistema. Confira o estado na conta oficial do Asaas."},c=e&&["PENDING","OVERDUE"].includes(y);return{environment:"production",diagnosticOnly:!0,amountCents:500,
started:!!F(o,"reference"),created:!!F(o,"paymentId"),ready:e,status:y,testComplete:t,webhookVerified:t,netCents:o?.fields?.netCents?.integerValue!==void 0?Te(o,
"netCents"):null,refundedCents:Te(o,"refundedCents"),payload:c?F(o,"payload"):"",encodedImage:c?F(o,"encodedImage"):"",message:F(o,"reference")&&!e&&!["DELETED",
"REFUNDED"].includes(y)?"A preparação foi iniciada. Retome este teste antes de gerar outra cobrança.":d[y]||"Confira o andamento do teste na conta real do As\
aas."}},C=async(o,y)=>{for(let d of y){let c=d.update?.name;if(!c||!(c===D(_(o.user.uid))||c.startsWith(D(_(o.user.uid)+"/history/"))||c===D(u(o.user.uid))))throw new Error(
"unsafe_production_check_write")}let e=await o.fetchGoogle(I.slice(0,-1)+":commit",{method:"POST",headers:o.headers,signal:o.signal,redirect:"manual",body:JSON.
stringify({writes:y})});[409,412].includes(e.status)&&p("production_check_changed","O teste mudou durante a operação. Atualize o andamento antes de repetir."),
e.ok||p("production_check_save_failed","Não foi possível confirmar a gravação. Confira o andamento do teste antes de repetir.",503);let t=JSON.parse(await e.
text());(!Array.isArray(t.writeResults)||t.writeResults.length!==y.length)&&p("production_check_save_failed","A gravação não foi confirmada. Confira o andamento\
 do teste antes de repetir.",503)},U=async o=>{let y=await o.load(u(o.user.uid));y||p("production_connection_required","Conecte e confira a chave da sua conta r\
eal no perfil antes deste teste.");let e=await Me(o.env,o.user.uid,y,a),t=await l(o.env,"aura:production-key:v1:"+e);return{integration:y,keyTag:t,api:async(c,i="\
GET",g)=>{let h;try{h=await o.fetchAsaas(Ra+c,{method:i,redirect:"manual",signal:o.signal,headers:{accept:"application/json",access_token:e,"User-Agent":"Regist\
roDeVendas-Pix-Production-Check/1.0",...g===void 0?{}:{"Content-Type":"application/json"}},...g===void 0?{}:{body:JSON.stringify(g)}})}catch{p("production_check\
_connection_failed","Não foi possível concluir a chamada à conta real. Confira o andamento antes de repetir.",503)}if(!h.ok){let w=new r("production_check_pr\
ovider_failed",[401,403].includes(h.status)?"O Asaas recusou o teste. Confira as permissões da chave real para clientes, cobranças e Webhooks.":h.status===400?
"O Asaas recusou os dados do teste real. Confira seu nome, CPF e as permissões da conta.":"O Asaas não concluiu o teste real. Confira o andamento antes de repe\
tir.",502);throw w.definitive=[400,401,403,404,422,429].includes(h.status),w}try{return JSON.parse(await h.text())}catch{p("production_check_response_invalid","\
O Asaas respondeu em um formato inesperado. Confira o andamento antes de repetir.",503)}}}},V=(o,y)=>{(!Ie(o?.id)||F(y,"paymentId")&&o.id!==F(y,"paymentId")||o.
customer!==F(y,"customerId")||o.externalReference!==F(y,"reference")||o.billingType!=="PIX"||Se(o.value)!==500||typeof o.status!="string"||!/^[A-Z_]{3,64}$/.test(
o.status))&&p("production_check_payment_mismatch","A cobrança real não corresponde a este teste. Nenhuma confirmação foi registrada.")},K=async(o,y,e,t="")=>{
if(V(e,y),t&&F(y,"lastEventId")===t)return y;let d=e.deleted!==!0&&e.status==="RECEIVED",c=Se(e.netValue);d&&(c===null||c<0||c>500)&&p("production_check_net_inv\
alid","Não foi possível conferir o valor líquido do teste real.",503);let i=Array.isArray(e.refunds)?e.refunds.filter(v=>v.status==="DONE"):[];i.some(v=>Se(v.
value)===null||Se(v.value)<0)&&p("production_check_refund_invalid","Não foi possível conferir o estorno do teste real.",503);let g=i.reduce((v,$)=>v+Se($.value),
0);g>500&&p("production_check_refund_invalid","O valor do estorno não corresponde ao teste real.",503);let h=e.deleted===!0?"DELETED":e.status;!y.fields.pendingCounted?.
booleanValue&&!y.fields.receivedWebhookAt?.timestampValue&&["PENDING","OVERDUE","CONFIRMED"].includes(h)&&(h="REVIEW");let w={providerStatus:L(h),refundedCents:he(
g),updatedAt:ie(je()),leaseUntil:ie(ye()),...c!==null&&c>=0&&c<=500?{netCents:he(c)}:{},...t?{lastEventId:L(t),webhookAt:ie(je())}:{}};d&&t&&!y.fields.receivedWebhookAt?.
timestampValue&&(w.receivedWebhookAt=ie(je()));let T=[];if(y.fields.pendingCounted?.booleanValue&&(d||["DELETED","REFUNDED"].includes(h))){let v=await o.load(u(
o.user.uid)),$=Te(v,"pendingCharges");(!v||!Number.isSafeInteger($)||$<1)&&p("production_check_state_conflict","O teste precisa ser conferido antes de concluir.",
503),w.pendingCounted=ke(!1),T.push(N(u(o.user.uid),v,{pendingCharges:he($-1)}))}return T.unshift(N(_(o.user.uid),y,w)),await C(o,T),o.load(_(o.user.uid))},H=async(o,y)=>{
let e=await o.load(_(o.user.uid)),t=F(e,"keyTag")===o.keyTag,d=y?M(y):null,c=d?await l(o.env,"aura:production-payer:v1:"+d.name+":"+d.cpfCnpj):"",i=t&&F(e,"prov\
iderStatus")==="DELETED"&&!e.fields.receivedWebhookAt?.timestampValue&&d;if(!t||i){d||p("payer_required","Informe seu nome e CPF para gerar o Pix real de R$ 5,0\
0.",400);let h=await o.load(u(o.user.uid));(!h||await l(o.env,"aura:production-key:v1:"+await Me(o.env,o.user.uid,h,a))!==o.keyTag)&&p("production_check_key_cha\
nged","A conexão real mudou. Reabra o perfil antes de gerar o teste."),Te(h,"pendingCharges")!==0&&p("production_check_pending","Conclua ou cancele o teste rea\
l pendente antes de gerar outro.");let T={keyTag:L(o.keyTag),reference:L("aura-prodcheck-"+crypto.randomUUID()),payerTag:L(c),customerId:L(""),paymentId:L(""),webhookId:L(
""),pendingCreate:L(""),providerStatus:L(""),payload:L(""),encodedImage:L(""),setupComplete:ke(!1),pendingCounted:ke(!0),webhookAt:{nullValue:null},receivedWebhookAt:{
nullValue:null},lastEventId:L(""),netCents:{nullValue:null},refundedCents:he(0),leaseUntil:ie(ye()),createdAt:ie(je())},v=[N(_(o.user.uid),e,T),N(u(o.user.uid),
h,{pendingCharges:he(1)})];e&&F(e,"reference")&&v.push(N(_(o.user.uid)+"/history/"+F(e,"reference"),null,e.fields)),await C(o,v),e=await o.load(_(o.user.uid))}else
d&&c!==F(e,"payerTag")&&p("production_check_other_payer","Já existe um teste real com outro pagador. Retome ou cancele essa cobrança antes de gerar outra.");if(e.
fields.setupComplete?.booleanValue)return S(e);Date.parse(e.fields.leaseUntil?.timestampValue||"")>Date.now()&&p("production_check_busy","A preparação já está e\
m andamento. Aguarde um minuto e confira o teste.");let g=async h=>{await C(o,[N(_(o.user.uid),e,h)]),e=await o.load(_(o.user.uid))};await g({leaseUntil:ie(new Date(
Date.now()+9e4).toISOString())});try{let h=F(e,"reference"),w=async j=>{let G=await o.api("/"+j+"?externalReference="+encodeURIComponent(h)+"&limit=2");return(!Array.
isArray(G?.data)||G.hasMore===!0||G.data.length>1||G.data.some(te=>te.externalReference!==h))&&p("production_check_duplicates","Não foi possível identificar um \
único registro do teste na conta real. Confira o painel Asaas."),G.data[0]||null},T=async(j,G,te,ce,De,Ve)=>{let Je=await ce();if(Je){De(Je),await g({...Ve(Je),
pendingCreate:L("")});return}F(e,"pendingCreate")===j&&p("production_check_creation_unknown","Uma criação anterior ficou sem confirmação. A cobrança não será re\
petida. Confira o painel Asaas e envie esta mensagem."),await g({pendingCreate:L(j)});let Be;try{Be=await o.api(G,"POST",te)}catch(ra){throw ra.definitive&&await g(
{pendingCreate:L("")}),ra}De(Be),await g({...Ve(Be),pendingCreate:L("")})};o.user.email||p("production_check_email_required","Sua conta precisa ter e-mail válid\
o para configurar o retorno automático.");let v=O+Fe+o.user.uid,$=await o.api("/webhooks?limit=100");(!Array.isArray($?.data)||$.hasMore===!0)&&p("production_c\
heck_webhook_invalid","Não foi possível conferir os Webhooks da conta real.");let J=$.data.filter(j=>j.url===v);(J.length>1||J.length&&!Ie(J[0].id))&&p("produ\
ction_check_webhook_invalid","Existe mais de um retorno para este teste real. Confira a conta Asaas.");let Q={name:"Registro de Vendas - validacao real",url:v,email:o.
user.email,enabled:!0,interrupted:!1,authToken:await l(o.env,"aura:production-webhook:v1:"+o.user.uid),events:ha,sendType:"SEQUENTIALLY",apiVersion:3},ee=j=>{(!Ie(
j?.id)||j.url!==v)&&p("production_check_webhook_invalid","Não foi possível conferir o retorno automático real.")};if(J.length){let j=await o.api("/webhooks/"+
J[0].id,"PUT",Q);ee(j),j.id!==J[0].id&&p("production_check_webhook_invalid","O retorno real não corresponde à configuração salva."),await g({webhookId:L(j.id),
...F(e,"pendingCreate")==="webhook"?{pendingCreate:L("")}:{}})}else await T("webhook","/webhooks",Q,async()=>null,ee,j=>({webhookId:L(j.id)}));if(!F(e,"customer\
Id")){let j=await w("customers"),G=te=>{(!Ie(te?.id)||te.externalReference!==h||te.deleted===!0||d&&te.cpfCnpj&&te.cpfCnpj.replace(/\D/g,"")!==d.cpfCnpj)&&p("pr\
oduction_check_customer_invalid","Não foi possível conferir o pagador do teste real.")};j?(G(j),await g({customerId:L(j.id),pendingCreate:L("")})):(F(e,"pendi\
ngCreate")==="customer"&&p("production_check_creation_unknown","O cadastro anterior ficou sem confirmação. Confira a conta Asaas antes de repetir."),d||p("pay\
er_required","Preencha novamente seu nome e CPF para retomar o cadastro do pagador.",400),await T("customer","/customers",{...d,externalReference:h,notificationDisabled:!0},
async()=>null,G,te=>({customerId:L(te.id)})))}F(e,"paymentId")||await T("payment","/payments",{customer:F(e,"customerId"),billingType:"PIX",value:5,dueDate:xa(),
description:"Validacao real da integracao Pix - Registro de Vendas",externalReference:h,interest:{value:0},fine:{value:0},discount:{value:0}},()=>w("payments"),
j=>V(j,e),j=>({paymentId:L(j.id),providerStatus:L(j.status)}));let B=await o.api("/payments/"+F(e,"paymentId"));V(B,e),B.deleted===!0&&p("production_check_delet\
ed","A cobrança real foi excluída no Asaas. Confira o teste antes de repetir.");let X=await o.api("/payments/"+B.id+"/pixQrCode");return(typeof X?.payload!="s\
tring"||X.payload.length<30||X.payload.length>8192||typeof X.encodedImage!="string"||!/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(X.encodedImage)||X.encodedImage.length>
2e5)&&p("production_check_qr_invalid","A cobrança real existe, mas o QR Code ainda não ficou disponível. Retome o teste."),await g({payload:L(X.payload),encodedImage:L(
X.encodedImage),setupComplete:ke(!0),providerStatus:L(B.status),leaseUntil:ie(ye())}),S(e)}catch(h){try{await g({leaseUntil:ie(ye())})}catch{}throw h}},Z=async(o,y,e)=>{
Object.assign(o,await U(o));let t=await o.load(_(o.user.uid));if(y==="get")return n(S(F(t,"keyTag")===o.keyTag?t:null));if(y==="prepare")return n(await H(o,e));
if((!t||F(t,"keyTag")!==o.keyTag)&&p("production_check_not_found","Não foi encontrado um teste para esta conexão real.",404),Date.parse(t.fields.leaseUntil?.timestampValue||
"")>Date.now()&&p("production_check_busy","A preparação está em andamento. Aguarde antes de conferir ou cancelar."),!F(t,"paymentId")){(y!=="cancel"||F(t,"pe\
ndingCreate")==="payment")&&p("production_check_not_prepared","Retome a preparação antes de conferir ou cancelar a cobrança real.");let i=await o.load(u(o.user.
uid)),g=Te(i,"pendingCharges");return(!t.fields.pendingCounted?.booleanValue||!Number.isSafeInteger(g)||g<1)&&p("production_check_state_conflict","Não foi possí\
vel conferir o cancelamento da preparação.",503),await C(o,[N(_(o.user.uid),t,{providerStatus:L("DELETED"),pendingCounted:ke(!1),leaseUntil:ie(ye())}),N(u(o.user.
uid),i,{pendingCharges:he(g-1)})]),n(S(await o.load(_(o.user.uid))))}let d=await o.api("/payments/"+F(t,"paymentId"));if(V(d,t),y==="cancel"&&d.deleted!==!0&&["\
PENDING","OVERDUE"].includes(d.status)){await C(o,[N(_(o.user.uid),t,{leaseUntil:ie(new Date(Date.now()+9e4).toISOString())})]),t=await o.load(_(o.user.uid));try{
await o.api("/payments/"+d.id,"DELETE"),d=await o.api("/payments/"+d.id)}catch(i){try{await C(o,[N(_(o.user.uid),t,{leaseUntil:ie(ye())})])}catch{}throw i}V(d,t),
d.deleted!==!0&&!["RECEIVED","REFUNDED"].includes(d.status)&&p("production_check_cancel_unknown","O Asaas ainda não confirmou o cancelamento. Confira o andament\
o antes de repetir.")}else y==="cancel"&&d.deleted!==!0&&!["RECEIVED","REFUNDED"].includes(d.status)&&p("production_check_cancel_blocked","O Asaas ainda está pr\
ocessando a cobrança. Aguarde antes de cancelar.");let c=await K(o,t,d);return n(S(c))};return{handleRequest:async(o,y,e,t)=>{let d=o.headers.get("Origin"),c=typeof y.
APP_ORIGIN=="string"&&y.APP_ORIGIN.trim()?y.APP_ORIGIN.trim():A;if(!d||d!==c)return n({code:"origin_denied",message:"Abra o teste real pelo perfil do sistema."},
403);let i=T=>(T.headers.set("Access-Control-Allow-Origin",d),T.headers.set("Vary","Origin"),T),g=new URL(o.url).pathname,h=g===me?o.method==="GET"?"get":"prepa\
re":g===me+"/reconcile"?"reconcile":g===me+"/cancel"?"cancel":"",w=g===me?["GET","POST"]:h?["POST"]:[];if(!w.length)return i(n({code:"not_found",message:"Rota n\
ão encontrada."},404));if(o.method==="OPTIONS"){if(!w.includes(o.headers.get("Access-Control-Request-Method")||""))return i(n({code:"method_not_allowed"},405));
let T=i(n(null));return T.headers.set("Access-Control-Allow-Methods",w.join(", ")),T.headers.set("Access-Control-Allow-Headers","Authorization, Content-Type"),new Response(
null,{status:204,headers:T.headers})}if(!w.includes(o.method))return i(n({code:"method_not_allowed",message:"Método não permitido."},405));try{let T=await s(o,
e),v=h==="prepare"?await R(o,4096,!0):(await k(o),null),$=await f(y,e,!1,async(J,Q)=>{let ee={accept:"application/json","Content-Type":"application/json",Authorization:"\
Bearer "+J},B=j=>m(e,ee,Q,j),X=await B("artifacts/vendas-aura-main/users/"+T.uid+"/profile/info");return(X?.fields?.approved?.booleanValue!==!0||!["","active"].
includes(X.fields.status?.stringValue||""))&&p("account_not_approved","Sua conta precisa estar aprovada e ativa para testar o Asaas real.",403),Z({request:o,user:T,
env:y,fetchGoogle:e,fetchAsaas:t,signal:Q,headers:ee,load:B},h,v)});return i($)}catch(T){return i(n({code:T instanceof r?T.code:"production_check_unavailable",message:T instanceof
r?T.message:"Não foi possível concluir o teste real. Confira o andamento antes de repetir."},T instanceof r?T.status:503))}},handleWebhook:async(o,y,e,t,d)=>{
if(!/^[A-Za-z0-9_-]{1,128}$/.test(e))return n({code:"not_found"},404);if(o.method!=="POST")return n({code:"method_not_allowed"},405);try{let c=o.headers.get("as\
aas-access-token")||"";if(!/^[a-f0-9]{64}$/.test(c)||!b(c,await l(y,"aura:production-webhook:v1:"+e)))return n({code:"unauthorized"},401);let i=await R(o,131072);
return typeof i?.id!="string"||!i.id||i.id.length>200||!Ie(i.payment?.id)?n({code:"invalid_event"},400):ha.includes(i.event)?await f(y,t,!1,async(g,h)=>{let w={
accept:"application/json","Content-Type":"application/json",Authorization:"Bearer "+g},T=ee=>m(t,w,h,ee),v=await T(_(e));if(v&&!F(v,"paymentId")&&i.payment.externalReference===
F(v,"reference")&&p("production_check_webhook_retry","A cobrança real ainda está sendo registrada. Repetir entrega.",503),!v||F(v,"paymentId")!==i.payment.id||
F(v,"lastEventId")===i.id)return n({accepted:!0});v.fields.setupComplete?.booleanValue||p("production_check_webhook_retry","A cobrança real ainda está sendo pre\
parada. Repetir entrega.",503);let $=await T("artifacts/vendas-aura-main/users/"+e+"/profile/info");if($?.fields?.approved?.booleanValue!==!0||!["","active"].includes(
$.fields.status?.stringValue||""))return n({accepted:!0});let J={user:{uid:e},env:y,headers:w,signal:h,load:T,fetchGoogle:t,fetchAsaas:d};if(Object.assign(J,await U(
J)),J.keyTag!==F(v,"keyTag"))return n({accepted:!0});let Q=await J.api("/payments/"+i.payment.id);try{await K(J,v,Q,i.id)}catch(ee){throw ee.code==="production_\
check_changed"&&p("production_check_webhook_retry","O teste mudou. Repetir entrega.",503),ee}return n({accepted:!0})}):n({accepted:!0})}catch(c){return n({code:c instanceof
r?c.code:"production_check_webhook_retry"},c instanceof r?c.status:503)}}}}var $e="https://api-sandbox.asaas.com/v3",Le=/^[a-f0-9]{64}$/i,Xe="vendas-aura",ga="https://oauth2.googleapis.com/token",Va="https://firestore.googleapis.com/v1\
/projects/vendas-aura/databases/(default)/documents/_pix_connection_check?pageSize=1&mask.fieldPaths=connectionTest",Ua="https://firestore.googleapis.com/v1/pro\
jects/vendas-aura/databases/(default)/documents/_pix_connection_check",le="https://firestore.googleapis.com/v1/projects/vendas-aura/databases/(default)/document\
s/",Ma="AIzaSyDQQcD2tzsVS8Xzy-GpHT897kB7EC-S8Ng",Ze="https://washingtonbarbalho.github.io",xe="/api/integrations/asaas",Oe=xe+"/sandbox-charge",ea="/api/webhook\
s/asaas/sandbox/",Aa="https://registro-vendas-pix-testes.washington-wn8.workers.dev",_a=["PAYMENT_CONFIRMED","PAYMENT_RECEIVED","PAYMENT_REFUNDED","PAYMENT_DELE\
TED","PAYMENT_OVERDUE","PAYMENT_RESTORED","PAYMENT_UPDATED"],ba=(a,r)=>fetch(a,r),na={"Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type\
-Options":"nosniff","X-Frame-Options":"DENY","Permissions-Policy":"camera=(), microphone=(), geolocation=()","Strict-Transport-Security":"max-age=31536000"};function E(a,r=200){
return new Response(JSON.stringify(a),{status:r,headers:{...na,"Content-Type":"application/json; charset=utf-8"}})}function aa(a,r){let n=a.length^r.length;for(let s=0;s<
64;s+=1)n|=(a.charCodeAt(s)||0)^(r.charCodeAt(s)||0);return n===0}function ja(){return new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><t\
itle>Registro de Vendas · Asaas Sandbox</title><main style="max-width:560px;margin:40px auto;padding:24px;font:16px/1.5 system-ui"><h1>Conexão Asaas · Etapa 8</\
h1><p>Abra Meu Perfil para validar uma cobrança real isolada de R$ 5,00 na conta oficial. Os recebimentos nas vendas e parcelas originais ainda aguardam ativaçã\
o.</p><p>Os testes usam cópias separadas. Vendas, parcelas e estoque reais não são alterados.</p><a href="https://washingtonbarbalho.github.io/registrodevendas/\
?v=105">Abrir o sistema</a></main></html>',{headers:{...na,"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'none'; style-src 'u\
nsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}})}function be(a){return btoa(String.fromCharCode(...a)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,
"_")}var P=class extends Error{constructor(r,n,s=503){super(n),this.code=r,this.status=s}};function we(a){if(typeof a!="string"||!/^[A-Za-z0-9_-]+$/.test(a))throw new Error(
"invalid_base64url");let r=a.replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(r+"=".repeat((4-r.length%4)%4)),n=>n.charCodeAt(0))}async function Ae(a){
if(typeof a.PIX_ENCRYPTION_KEY!="string"||!Le.test(a.PIX_ENCRYPTION_KEY.trim()))throw new P("integration_setup_required","A proteção da integração ainda precisa\
 ser configurada pelo administrador.");let r=Uint8Array.from(a.PIX_ENCRYPTION_KEY.trim().match(/../g)||[],n=>parseInt(n,16));return crypto.subtle.importKey("raw",
r,"AES-GCM",!1,["encrypt","decrypt"])}async function va(a,r,n){let s=crypto.getRandomValues(new Uint8Array(12)),f=new TextEncoder().encode("vendas-aura:asaas:sa\
ndbox:v1:"+r),m=await crypto.subtle.encrypt({name:"AES-GCM",iv:s,additionalData:f},await Ae(a),new TextEncoder().encode(n));return{cipher:be(new Uint8Array(m)),
iv:be(s)}}async function _e(a,r,n){if(n.environment?.stringValue!=="sandbox"||n.version?.integerValue!=="1")throw new P("integration_format_invalid","A configur\
ação salva precisa ser refeita.");try{let s=we(n.iv?.stringValue);if(s.length!==12)throw new Error("invalid_iv");let f=new TextEncoder().encode("vendas-aura:a\
saas:sandbox:v1:"+r),m=await crypto.subtle.decrypt({name:"AES-GCM",iv:s,additionalData:f},await Ae(a),we(n.cipher?.stringValue));return new TextDecoder("utf-8",
{fatal:!0}).decode(m)}catch(s){throw s instanceof P?s:new P("integration_key_unreadable","Não foi possível abrir a chave salva. Confira a configuração de proteç\
ão antes de substituir a integração.")}}async function Fa(a){try{let r=crypto.randomUUID(),n=await va(a,"diagnostic-only",r);if(await _e(a,"diagnostic-only",
{environment:{stringValue:"sandbox"},version:{integerValue:"1"},cipher:{stringValue:n.cipher},iv:{stringValue:n.iv}})!==r)throw new Error("encryption_check_fail\
ed");return E({code:"encryption_ready",encryptionReady:!0,message:"Proteção configurada e testada. O Worker consegue proteger e recuperar as chaves das integraç\
ões. A próxima etapa é conectar o Asaas Sandbox pelo perfil do sistema."})}catch(r){return E({code:"encryption_setup_required",message:r instanceof P?"Cadast\
re a chave gerada nesta página como Secret PIX_ENCRYPTION_KEY e clique em Deploy.":"Não foi possível validar a proteção. Confira o Secret PIX_ENCRYPTION_KEY."},
503)}}async function ta(a,r){let n=a.headers.get("Authorization")||"",s=n.startsWith("Bearer ")?n.slice(7):"",f=()=>new P("login_required","Entre novamente no s\
istema para configurar o Asaas.",401);if(!s||s.length>8192)throw f();let m;try{let I=s.split(".");if(I.length!==3)throw f();let O=JSON.parse(new TextDecoder().decode(
we(I[0])));m=JSON.parse(new TextDecoder().decode(we(I[1])));let p=Date.now()/1e3;if(O.alg!=="RS256"||m.aud!==Xe||m.iss!=="https://securetoken.google.com/vendas-\
aura"||typeof m.sub!="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(m.sub)||!Number.isFinite(m.exp)||m.exp<=p||!Number.isFinite(m.iat)||m.iat>p+60||!Number.isFinite(m.
auth_time)||m.auth_time>p+60)throw f()}catch{throw f()}let l=await r("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="+Ma,{method:"POST",headers:{
"Content-Type":"application/json",accept:"application/json"},body:JSON.stringify({idToken:s}),redirect:"manual",signal:AbortSignal.timeout(1e4)});if(!l.ok)throw[
400,401].includes(l.status)?f():new P("login_check_unavailable","Não foi possível validar seu acesso. Tente novamente.");let b=JSON.parse(await l.text()),A=Array.
isArray(b?.users)&&b.users.length===1?b.users[0]:null;if(!A||A.localId!==m.sub||A.disabled===!0||Number(A.validSince||0)>m.auth_time)throw f();return{uid:A.localId,
email:typeof A.email=="string"&&A.email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(A.email)?A.email:""}}async function ze(a,r,n,s){let f=await a(le+s,{method:"\
GET",headers:r,redirect:"manual",signal:n});if(f.status===404)return null;if(!f.ok)throw new P("integration_read_failed","Não foi possível carregar a configuraç\
ão da integração.");let m=JSON.parse(await f.text());if(m?.name!=="projects/vendas-aura/databases/(default)/documents/"+s||!m.fields||typeof m.fields!="objec\
t"||Array.isArray(m.fields)||typeof m.updateTime!="string"||!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(m.updateTime))throw new P("integration_read_failed","Não foi po\
ssível conferir a configuração salva.");return m}async function ve(a,r){await Ae(a);let n=Uint8Array.from(a.PIX_ENCRYPTION_KEY.trim().match(/../g)||[],m=>parseInt(
m,16)),s=await crypto.subtle.importKey("raw",n,{name:"HMAC",hash:"SHA-256"},!1,["sign"]),f=await crypto.subtle.sign("HMAC",s,new TextEncoder().encode(r));return Array.
from(new Uint8Array(f),m=>m.toString(16).padStart(2,"0")).join("")}var z=a=>({stringValue:a}),Ne=a=>({timestampValue:a}),wa=a=>({booleanValue:a}),Y=(a,r)=>a?.fields?.[r]?.
stringValue||"",Re=a=>typeof a=="string"&&/^[A-Za-z0-9_-]{5,128}$/.test(a);function oa(a,r,n){return async(s,f="GET",m)=>{let l=await a($e+s,{method:f,redirect:"\
manual",signal:n,headers:{accept:"application/json",access_token:r,"User-Agent":"RegistroDeVendas-Pix-Sandbox/2.0",...m===void 0?{}:{"Content-Type":"application\
/json"}},...m===void 0?{}:{body:JSON.stringify(m)}});if(!l.ok){let b=new P("sandbox_provider_failed",[401,403].includes(l.status)?"O Asaas recusou o acesso. Con\
fira as permissões da chave Sandbox para clientes, cobranças e Webhooks.":l.status===400?"O Asaas recusou os dados do teste. Confira se a conta Sandbox está a\
provada e permite cobranças Pix e Webhooks.":"O Asaas não concluiu o teste. Aguarde um pouco e tente novamente.",502);throw b.definitive=[400,401,403,404,422,
429].includes(l.status),b}try{return JSON.parse(await l.text())}catch{throw new P("sandbox_response_invalid","O Asaas respondeu em um formato inesperado. Reabra\
 o perfil para conferir o andamento do teste.")}}}function Qe(a,r=""){let n=a?.fields||{},s=Y(a,"providerStatus"),f=n.setupComplete?.booleanValue===!0,m=s==="RE\
CEIVED",l=!!n.webhookAt?.timestampValue;return{environment:"sandbox",created:!!Y(a,"paymentId"),ready:f,status:s||"NOT_CREATED",received:m,webhookVerified:l,testComplete:f&&
m&&l,paymentId:Y(a,"paymentId"),amount:Number(n.amountCents?.integerValue||500)/100,payload:f?Y(a,"payload"):"",encodedImage:f?Y(a,"encodedImage"):"",expirationDate:Y(
a,"expirationDate"),message:r||(f&&m&&l?"Teste completo: o pagamento simulado foi recebido e o retorno automático do Asaas foi validado. Nenhuma venda ou parcel\
a foi alterada.":f&&m?"O Asaas indica recebimento. Aguardando o retorno automático autenticado.":s==="CONFIRMED"?"O Asaas confirmou a simulação. Aguardando o r\
ecebimento e o retorno automático.":f&&!["PENDING","OVERDUE","RECEIVED"].includes(s)?"A cobrança de teste foi alterada no Asaas e não permite simular outro pag\
amento. Nenhuma venda ou parcela foi alterada.":f?"Cobrança de teste criada. Simule o pagamento para validar o retorno automático.":"Prepare uma cobrança isol\
ada de R$ 5,00 no Sandbox. Nenhum valor real será movimentado.")}}function Ke(a,r){if(!Re(a?.id)||Y(r,"paymentId")&&a.id!==Y(r,"paymentId")||a.customer!==Y(r,"\
customerId")||a.externalReference!==Y(r,"reference")||a.billingType!=="PIX"||a.value!==Number(r?.fields?.amountCents?.integerValue||500)/100||typeof a.status!="\
string"||!/^[A-Z_]{3,64}$/.test(a.status))throw new P("sandbox_payment_mismatch","Os dados da cobrança não correspondem ao teste. Nenhuma confirmação foi regist\
rada.",409)}async function Ca({request:a,user:r,env:n,current:s,headers:f,signal:m,load:l,fetchGoogle:b,fetchAsaas:A,checkPath:I}){if(!s||s.fields.enabled?.booleanValue!==
!0)throw new P("sandbox_disabled","Ative a conexão Asaas Sandbox no perfil antes de testar.",409);let O=await _e(n,r.uid,s.fields),p=await ve(n,"aura:sandbox-k\
ey:v1:"+O),_=I||"_asaas_sandbox_checks/"+r.uid,u=await l(_);Y(u,"keyTag")!==p&&(u=null);let D=new URL(a.url).pathname;if(a.method==="GET")return E(Qe(u));if(a.body){
let C=a.body.getReader();for(;;){let{value:U,done:V}=await C.read();if(V)break;if(U.length)throw await C.cancel(),new P("invalid_body","O teste usa somente a co\
brança preparada pelo sistema.",400)}}let N=oa(A,O,m);if(D===Oe+"/simulate"){if(!u?.fields?.setupComplete?.booleanValue)throw new P("sandbox_not_ready","Prepar\
e a cobrança de teste antes de simular o pagamento.",409);let C=Y(u,"paymentId"),U=await N("/payments/"+C);if(Ke(U,u),U.deleted===!0||!["PENDING","OVERDUE","CO\
NFIRMED","RECEIVED"].includes(U.status))throw new P("sandbox_status_invalid","Esta cobrança não permite a simulação. Confira o status no painel Asaas Sandbox.",
409);return["PENDING","OVERDUE"].includes(U.status)&&await N("/sandbox/payment/"+C+"/confirm","POST"),E(Qe(u,"Simulação enviada ao Asaas Sandbox. Aguarde o reto\
rno automático nesta tela."))}if(!r.email)throw new P("sandbox_email_required","Sua conta precisa ter um e-mail válido para configurar o retorno do Asaas.",409);
let R=await l(_);u=Y(R,"keyTag")===p?R:null;let k=R?.updateTime||"";if(u&&Date.parse(u.fields.leaseUntil?.timestampValue||"")>Date.now())throw new P("sandbox_bu\
sy","A preparação já está em andamento. Aguarde um minuto antes de tentar novamente.",409);let M=async C=>{let U=new URLSearchParams(k?{"currentDocument.upd\
ateTime":k}:{"currentDocument.exists":"false"});for(let H of Object.keys(C))U.append("updateMask.fieldPaths",H);let V=await b(le+_+"?"+U,{method:"PATCH",headers:f,
redirect:"manual",signal:m,body:JSON.stringify({fields:C})});if([409,412].includes(V.status))throw new P("sandbox_changed","O teste mudou durante esta operação.\
 Atualize a tela e tente novamente.",409);if(!V.ok)throw new P("sandbox_save_failed","Não foi possível salvar o andamento do teste. Aguarde um minuto e tente no\
vamente.");let K=JSON.parse(await V.text());if(K?.name!=="projects/vendas-aura/databases/(default)/documents/"+_||!K.updateTime||!K.fields)throw new P("sandbox_\
save_failed","Não foi possível conferir o andamento do teste. Aguarde um minuto e tente novamente.");u=K,k=K.updateTime},S=new Date(Date.now()+9e4).toISOString();
if(u)await M({leaseUntil:Ne(S)});else{let C={keyTag:z(p),reference:z("aura-sandbox-"+crypto.randomUUID()),customerId:z(""),paymentId:z(""),webhookId:z(""),pendingCreate:z(
""),providerStatus:z(""),payload:z(""),encodedImage:z(""),expirationDate:z(""),setupComplete:wa(!1),webhookAt:{nullValue:null},lastEventId:z(""),leaseUntil:Ne(S)};
await M(C)}try{let C=Y(u,"reference"),U=async(e,t,d)=>{let c=await N("/"+e+"?externalReference="+encodeURIComponent(t)+"&limit=2");if(!Array.isArray(c?.data)||c.
data.length>1||c.hasMore===!0||c.data.some(i=>!d(i)))throw new P("sandbox_duplicates","Não foi possível identificar um único registro para este teste. Confira o\
s registros de teste no Asaas Sandbox.",409);return c.data[0]||null},V=async(e,t,d,c,i,g)=>{let h=await c();if(h){i(h),await M({...g(h),pendingCreate:z("")});return}
if(Y(u,"pendingCreate")===e)throw new P("sandbox_creation_unknown","Uma criação anterior ficou sem confirmação. O sistema evitou repetir a cobrança. Confira o p\
ainel Asaas Sandbox e envie esta mensagem para continuarmos.",409);await M({pendingCreate:z(e)});let w;try{w=await N(t,"POST",d)}catch(T){throw T.definitive&&await M(
{pendingCreate:z("")}),T}i(w),await M({...g(w),pendingCreate:z("")})},K=Aa+ea+r.uid,H=await ve(n,"aura:sandbox-webhook:v1:"+r.uid),Z={name:"Registro de Vendas -\
 teste isolado",url:K,email:r.email,enabled:!0,interrupted:!1,authToken:H,events:_a,sendType:"SEQUENTIALLY",apiVersion:3},ae=await N("/webhooks?limit=100");if(!Array.
isArray(ae?.data)||ae.hasMore===!0)throw new P("sandbox_webhook_invalid","Não foi possível conferir os Webhooks da conta Sandbox.");let q=ae.data.filter(e=>e.
url===K);if(q.length>1||q.length&&!Re(q[0].id))throw new P("sandbox_webhook_invalid","Existe mais de um retorno para este teste. Confira os Webhooks no Asaas Sa\
ndbox.",409);if(q.length){let e=await N("/webhooks/"+q[0].id,"PUT",Z);if(e?.id!==q[0].id||e.url!==K)throw new P("sandbox_webhook_invalid","Não foi possível conf\
irmar a configuração do retorno automático.");await M({webhookId:z(e.id),...Y(u,"pendingCreate")==="webhook"?{pendingCreate:z("")}:{}})}else await V("webhook",
"/webhooks",Z,async()=>null,e=>{if(!Re(e?.id)||e.url!==K)throw new P("sandbox_webhook_invalid","Não foi possível conferir o retorno automático.")},e=>({webhookId:z(
e.id)}));if(Y(u,"customerId")||await V("customer","/customers",{name:"Cliente Teste Registro de Vendas",cpfCnpj:"24971563792",notificationDisabled:!0,externalReference:C},
()=>U("customers",C,t=>t.externalReference===C),t=>{if(!Re(t?.id)||t.externalReference!==C||t.deleted===!0)throw new P("sandbox_customer_invalid","Não foi possí\
vel conferir o cliente fictício de teste.")},t=>({customerId:z(t.id)})),!Y(u,"paymentId")){let e=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",
year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date),t=["year","month","day"].map(d=>e.find(c=>c.type===d)?.value).join("-");await V("payment",
"/payments",{customer:Y(u,"customerId"),billingType:"PIX",value:Number(u.fields.amountCents?.integerValue||500)/100,dueDate:t,description:"Teste isolado do Regi\
stro de Vendas - sem valor real",externalReference:C,interest:{value:0},fine:{value:0},discount:{value:0}},()=>U("payments",C,d=>d.externalReference===C),d=>Ke(
d,u),d=>({paymentId:z(d.id),providerStatus:z(d.status)}))}let o=await N("/payments/"+Y(u,"paymentId"));if(Ke(o,u),o.deleted===!0)throw new P("sandbox_payment_de\
leted","A cobrança de teste foi excluída no Asaas Sandbox. Envie esta mensagem para prepararmos outro teste.",409);let y={};if(!u.fields.setupComplete?.booleanValue){
let e=await N("/payments/"+o.id+"/pixQrCode");if(typeof e?.payload!="string"||e.payload.length<30||e.payload.length>8192||typeof e.encodedImage!="string"||!/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.
test(e.encodedImage)||e.encodedImage.length>2e5||typeof e.expirationDate!="string"||e.expirationDate.length>64)throw new P("sandbox_qr_invalid","A cobrança exis\
te, mas o Asaas ainda não retornou um QR Code válido. Tente preparar o teste novamente.");y={payload:z(e.payload),encodedImage:z(e.encodedImage),expirationDate:z(
e.expirationDate)}}return await M({...y,setupComplete:wa(!0),providerStatus:z(o.status),leaseUntil:Ne(new Date(0).toISOString())}),E(Qe(u))}catch(C){try{await M(
{leaseUntil:Ne(new Date(0).toISOString())})}catch{}throw C}}async function Ka(a,r,n,s,f,m){if(!/^[A-Za-z0-9_-]{1,128}$/.test(n))return E({code:"not_found"},404);
if(a.method!=="POST")return E({code:"method_not_allowed"},405);try{let l=a.headers.get("asaas-access-token")||"";if(!Le.test(l)||!aa(l,await ve(r,"aura:sandbox-\
webhook:v1:"+n)))return E({code:"unauthorized"},401);if(!(a.headers.get("Content-Type")||"").toLowerCase().startsWith("application/json"))return E({code:"invali\
d_body"},400);let b=a.body?.getReader(),A=[],I=0;if(!b)return E({code:"invalid_body"},400);for(;;){let{value:u,done:D}=await b.read();if(D)break;if(I+=u.length,
I>131072)return await b.cancel(),E({code:"invalid_body"},413);A.push(u)}let O=new Uint8Array(I),p=0;for(let u of A)O.set(u,p),p+=u.length;let _;try{_=JSON.parse(
new TextDecoder("utf-8",{fatal:!0}).decode(O))}catch{return E({code:"invalid_body"},400)}return!_||typeof _.id!="string"||_.id.length>200||!_.id||!Re(_.payment?.
id)?E({code:"invalid_event"},400):_a.includes(_.event)?await ge(r,s,!1,async(u,D)=>{let N={accept:"application/json","Content-Type":"application/json",Authorization:"\
Bearer "+u},R=q=>ze(s,N,D,q),k="_asaas_sandbox_checks/"+n,M=await R(k);if(!M||_.payment.id!==Y(M,"paymentId"))return m.handleWebhook({user:{uid:n},event:_,env:r,
headers:N,signal:D,load:R,fetchGoogle:s,fetchAsaas:f});if(Y(M,"lastEventId")===_.id)return E({accepted:!0});let S=await R("_asaas_integrations/"+n),C=await R("a\
rtifacts/vendas-aura-main/users/"+n+"/profile/info");if(!S?.fields?.enabled?.booleanValue||C?.fields?.approved?.booleanValue!==!0||!["","active"].includes(C.fields.
status?.stringValue||""))return E({accepted:!0});let U=await _e(r,n,S.fields);if(Y(M,"keyTag")!==await ve(r,"aura:sandbox-key:v1:"+U))return E({accepted:!0});let K=await oa(
f,U,D)("/payments/"+Y(M,"paymentId"));Ke(K,M);let H={providerStatus:z(K.deleted===!0?"DELETED":K.status),webhookAt:Ne(new Date().toISOString()),lastEventId:z(_.
id)},Z=new URLSearchParams({"currentDocument.updateTime":M.updateTime});for(let q of Object.keys(H))Z.append("updateMask.fieldPaths",q);if(!(await s(le+k+"?"+Z,
{method:"PATCH",headers:N,redirect:"manual",signal:D,body:JSON.stringify({fields:H})})).ok)throw new P("sandbox_webhook_retry","Retorno ainda não registrado. Re\
petir entrega.",503);return E({accepted:!0})}):E({accepted:!0})}catch(l){return E({code:l instanceof P?l.code:"sandbox_webhook_retry"},l instanceof P?l.status:503)}}
async function Ea(a){if(!(a.headers.get("Content-Type")||"").toLowerCase().startsWith("application/json"))throw new P("invalid_body","Envie a configuração em fo\
rmato JSON.",400);let r=a.body?.getReader();if(!r)throw new P("invalid_body","Informe a configuração da integração.",400);let n=0,s=[];for(;;){let{value:f,done:m}=await r.
read();if(m)break;if(n+=f.byteLength,n>4096)throw await r.cancel(),new P("invalid_body","A configuração enviada excedeu o tamanho permitido.",413);s.push(f)}try{
let f=new Uint8Array(n),m=0;for(let b of s)f.set(b,m),m+=b.length;let l=JSON.parse(new TextDecoder("utf-8",{fatal:!0}).decode(f));if(!l||typeof l!="object"||Array.
isArray(l)||Object.keys(l).length===0||Object.keys(l).some(b=>!["apiKey","enabled"].includes(b))||l.enabled!==void 0&&typeof l.enabled!="boolean"||l.apiKey!==void 0&&
(typeof l.apiKey!="string"||l.apiKey.trim().length<8||l.apiKey.trim().length>2048||/[^\x21-\x7e]/.test(l.apiKey.trim())))throw new Error("invalid_body");return l}catch{
throw new P("invalid_body","Confira a chave e a configuração enviadas.",400)}}async function $a(a,r,n){let s=await r($e+"/pix/addressKeys?status=ACTIVE&limit=\
1",{method:"GET",headers:{accept:"application/json",access_token:a,"User-Agent":"RegistroDeVendas-Pix-Sandbox-Profile/1.0"},redirect:"manual",signal:n});if(!s.ok)
throw new P("asaas_key_rejected",[401,403].includes(s.status)?"O Asaas não aceitou esta chave. Confira se ela pertence ao Sandbox e continua ativa.":"O Asaas n\
ão concluiu o teste. Tente novamente.",502);let f=JSON.parse(await s.text());if(!Array.isArray(f?.data))throw new P("asaas_response_invalid","O Asaas respondeu\
 em um formato inesperado.",502);return f.data.some(m=>m?.status==="ACTIVE")}function Pe(a){let r=a?.fields||{};return{configured:!!a,enabled:r.enabled?.booleanValue===
!0,environment:"sandbox",hasActivePixKey:r.hasActivePixKey?.booleanValue===!0,checkedAt:r.checkedAt?.timestampValue||null,flowVersion:1,pendingCharges:Number(r.
pendingCharges?.integerValue||0)}}async function La(a,r,n,s,f){let m=a.headers.get("Origin"),l=typeof r.APP_ORIGIN=="string"&&r.APP_ORIGIN.trim()?r.APP_ORIGIN.trim():
Ze,b=new URL(a.url).pathname;if(!m||m!==l)return E({code:"origin_denied",message:"Abra a integração pelo sistema de vendas."},403);let A={"Access-Control-Allo\
w-Origin":m,Vary:"Origin"},I=p=>{for(let[_,u]of Object.entries(A))p.headers.set(_,u);return p},O=b===xe?["GET","PUT","DELETE"]:b===Oe?["GET","POST"]:[xe+"/test",
Oe+"/simulate"].includes(b)?["POST"]:f.methods(b);if(!O.length)return I(E({code:"not_found",message:"Rota não encontrada."},404));if(a.method==="OPTIONS")return O.
includes(a.headers.get("Access-Control-Request-Method")||"")?new Response(null,{status:204,headers:{...na,...A,"Access-Control-Allow-Methods":O.join(", "),"Acce\
ss-Control-Allow-Headers":"Authorization, Content-Type","Access-Control-Max-Age":"600"}}):I(E({code:"method_not_allowed",message:"Método não permitido."},405));
if(!O.includes(a.method))return I(E({code:"method_not_allowed",message:"Método não permitido."},405));try{let p=await ta(a,n),_=p.uid,u=a.method==="PUT"?await Ea(
a):null,D=await ge(r,n,!1,async(N,R)=>{let k={accept:"application/json","Content-Type":"application/json",Authorization:"Bearer "+N},M="artifacts/vendas-aura-ma\
in/users/"+_+"/profile/info",S="_asaas_integrations/"+_,C=e=>ze(n,k,R,e),U=await C(M);if(U?.fields?.approved?.booleanValue!==!0||!["","active"].includes(U.fields.
status?.stringValue||""))throw new P("account_not_approved","Sua conta precisa estar aprovada e ativa para configurar o Asaas.",403);let V=await C(S);if(f.matches(
b))return f.handleRequest({request:a,user:p,env:r,current:V,headers:k,signal:R,load:C,fetchGoogle:n,fetchAsaas:s});if(b===Oe||b===Oe+"/simulate")return Ca({request:a,
user:p,env:r,current:V,headers:k,signal:R,load:C,fetchGoogle:n,fetchAsaas:s});if(Number(V?.fields?.pendingCharges?.integerValue||0)>0&&(a.method==="DELETE"||a.method===
"PUT"&&(u.enabled===!1||u.apiKey!==void 0)))throw new P("pending_charges","Conclua ou cancele os testes pendentes no perfil antes de alterar a chave ou usar Pix\
 manual.",409);let K=()=>new URLSearchParams(V?{"currentDocument.updateTime":V.updateTime}:{"currentDocument.exists":"false"}),H=async e=>{let t=K();for(let c of Object.
keys(e))t.append("updateMask.fieldPaths",c);let d=await n(le+S+"?"+t,{method:"PATCH",headers:k,redirect:"manual",signal:R,body:JSON.stringify({fields:e})});if([
409,412].includes(d.status))throw new P("integration_changed","A configuração mudou durante esta operação. Atualize a tela e tente novamente.",409);if(!d.ok)
throw new P("integration_save_failed","Não foi possível salvar a integração. Tente novamente.")};if(a.method==="DELETE"){if(V){let e=await n(le+S+"?"+K(),{method:"\
DELETE",headers:k,redirect:"manual",signal:R});if([409,412].includes(e.status))throw new P("integration_changed","A configuração mudou. Atualize a tela antes de\
 remover.",409);if(!e.ok&&e.status!==404)throw new P("integration_delete_failed","Não foi possível remover a integração.")}return E({...Pe(null),message:"Ch\
ave da integração removida."})}if(await Ae(r),a.method==="GET")return V&&await _e(r,_,V.fields),E(Pe(V));let Z=new Date().toISOString();if(a.method==="PUT"&&u.
enabled===!1&&u.apiKey===void 0)return V?(await H({enabled:{booleanValue:!1},updatedAt:{timestampValue:Z}}),E({...Pe(V),enabled:!1,message:"Pix manual seleciona\
do. A chave da integração permanece protegida."})):E({...Pe(null),message:"Pix manual selecionado."});let ae=u?.apiKey!==void 0?u.apiKey.trim():V?await _e(r,_,
V.fields):"";if(!ae)throw new P("asaas_key_required","Informe a chave da API do Asaas Sandbox para conectar.",400);let q=await $a(ae,s,R),o={hasActivePixKey:{booleanValue:q},
checkedAt:{timestampValue:Z},updatedAt:{timestampValue:Z}};if(a.method==="PUT"){let e=await va(r,_,ae);Object.assign(o,{environment:{stringValue:"sandbox"},version:{
integerValue:"1"},cipher:{stringValue:e.cipher},iv:{stringValue:e.iv},enabled:{booleanValue:u.enabled!==!1}})}await H(o);let y=Pe({fields:{...V?.fields||{},...o}});
return E({...y,message:q?"Asaas Sandbox conectado. A chave está salva e o teste foi concluído.":"Asaas Sandbox conectado. Falta cadastrar ou ativar uma chave \
Pix na conta de testes."})});return I(D)}catch(p){return I(E({code:p instanceof P?p.code:"integration_unavailable",message:p instanceof P?p.message:"Não foi pos\
sível concluir a operação do Asaas. Tente novamente."},p instanceof P?p.status:503))}}async function za(a,r,n){let s=crypto.randomUUID(),f="probe-"+s,m="proj\
ects/vendas-aura/databases/(default)/documents/_pix_connection_check/"+f,l="https://firestore.googleapis.com/v1/"+m,b={accept:"application/json","Content-Type":"\
application/json",Authorization:"Bearer "+r},A="criação",I=0,O=!1,p="";async function _(D,N,R){I=0;let k=await a(N,{method:D,headers:b,redirect:"manual",signal:n,
...R===void 0?{}:{body:JSON.stringify(R)}});if(!k.ok)throw I=k.status,A==="criação"&&[400,401,403,404,409,429].includes(I)&&(O=!1),new Error("diagnostic_reque\
st_failed");return k}async function u(D,N,R=""){let k=JSON.parse(await D.text());if(!k||k.name!==m||k.fields?.connectionTest?.booleanValue!==!0||k.fields?.probeId?.
stringValue!==s||k.fields?.stage?.stringValue!==N||typeof k.updateTime!="string"||!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(k.updateTime)||R&&k.updateTime!==R)throw new Error(
"diagnostic_document_mismatch");p=k.updateTime}try{O=!0;let D=await _("POST",Ua+"?documentId="+f,{fields:{connectionTest:{booleanValue:!0},probeId:{stringValue:s},
stage:{stringValue:"created"}}});await u(D,"created"),A="atualização";let N=new URLSearchParams({"updateMask.fieldPaths":"stage","currentDocument.updateTime":p}),
R=await _("PATCH",l+"?"+N,{fields:{stage:{stringValue:"updated"}}});return await u(R,"updated"),A="leitura",await u(await _("GET",l),"updated",p),A="exclusão",
await _("DELETE",l+"?"+new URLSearchParams({"currentDocument.updateTime":p})),E({code:"firebase_write_connected",firebaseConnected:!0,firestoreWrite:!0,diagnosticCleaned:!0,
message:"Teste completo do Firebase concluído. O Worker criou, atualizou, leu e excluiu um registro de diagnóstico. As permissões de leitura e gravação estão fu\
ncionando. Nenhum dado de vendas foi alterado."})}catch(D){let N=!O;if(p)try{let S=await a(l+"?"+new URLSearchParams({"currentDocument.updateTime":p}),{method:"\
DELETE",headers:b,redirect:"manual",signal:AbortSignal.timeout(8e3)});N=S.ok||S.status===404}catch{}let R=D instanceof Error&&(D.name==="TimeoutError"||D.name===
"AbortError"),k=I?" (HTTP "+I+")":R?" por tempo excedido":"",M=N?" O registro temporário foi limpo ou não chegou a ser criado.":" Pode ter ficado um registro \
de diagnóstico: "+f+". Guarde esta mensagem para conferir a limpeza.";return E({code:"firebase_write_failed",step:A,diagnosticCleaned:N,message:"O teste parou \
na etapa de "+A+k+". Confira as permissões da conta de serviço no Firebase. Não é necessário liberar as regras públicas do banco."+M},R?504:I===429?503:502)}}
async function ge(a,r,n=!1,s=null){if(typeof a.FIREBASE_SERVICE_ACCOUNT!="string"||!a.FIREBASE_SERVICE_ACCOUNT.trim())return E({code:"firebase_secret_required",
message:"Cadastre o JSON completo no Secret FIREBASE_SERVICE_ACCOUNT da Cloudflare e clique em Deploy."},503);let f;try{f=JSON.parse(a.FIREBASE_SERVICE_ACCOUNT)}catch{
return E({code:"firebase_json_invalid",message:"O Secret FIREBASE_SERVICE_ACCOUNT não contém um JSON válido. Copie todo o conteúdo do arquivo baixado do Firebas\
e, incluindo as chaves do início e do final."},503)}if(!f||f.type!=="service_account"||typeof f.client_email!="string"||!/^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.
test(f.client_email)||typeof f.private_key!="string")return E({code:"firebase_credentials_invalid",message:"O JSON não contém uma conta de serviço completa. Use\
 o arquivo gerado em Contas de serviço → Gerar nova chave privada."},503);if(f.project_id!==Xe)return E({code:"firebase_project_mismatch",message:"A credenci\
al precisa pertencer ao projeto vendas-aura. Gere a chave privada nesse projeto e atualize o Secret."},503);let m;try{let l=f.private_key.replace(/\\n/g,`
`).trim();if(!l.startsWith("-----BEGIN PRIVATE KEY-----")||!l.endsWith("-----END PRIVATE KEY-----"))throw new Error("Invalid PKCS8");let b=Uint8Array.from(atob(
l.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"")),N=>N.charCodeAt(0)),A=await crypto.subtle.importKey("pkcs8",b,{name:"RSASSA-PKCS1-v1_\
5",hash:"SHA-256"},!1,["sign"]),I=new TextEncoder,O=Math.floor(Date.now()/1e3),p={alg:"RS256",typ:"JWT",...typeof f.private_key_id=="string"?{kid:f.private_key_id}:
{}},_={iss:f.client_email,scope:"https://www.googleapis.com/auth/datastore",aud:ga,iat:O-30,exp:O+3300},u=be(I.encode(JSON.stringify(p)))+"."+be(I.encode(JSON.stringify(
_))),D=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",A,I.encode(u));m=u+"."+be(new Uint8Array(D))}catch{return E({code:"firebase_private_key_invalid",message:"Nã\
o foi possível ler a chave privada do Firebase. Atualize FIREBASE_SERVICE_ACCOUNT com o JSON completo, sem editar o campo private_key."},503)}try{let l=AbortSignal.
timeout(s?4e4:2e4),b=await r(ga,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",accept:"application/json"},body:new URLSearchParams({
grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:m}).toString(),redirect:"manual",signal:l});if(!b.ok)return E({code:"firebase_auth_failed",message:"\
O Google não aceitou a credencial. Confira se a conta de serviço e a chave privada estão ativas e se o JSON foi copiado integralmente."},502);let A=JSON.parse(
await b.text());if(!A||typeof A.access_token!="string"||!A.access_token||/[\r\n]/.test(A.access_token))return E({code:"firebase_auth_response_invalid",message:"\
O Google não retornou um token válido para o teste. Tente novamente."},502);if(s)return await s(A.access_token,l);if(n)return za(r,A.access_token,l);let I=await r(
Va,{method:"GET",headers:{accept:"application/json",Authorization:"Bearer "+A.access_token},redirect:"manual",signal:l});if(!I.ok)return E({code:"firebase_read_\
failed",message:{401:"O Firestore recusou a autenticação. Confira se a conta de serviço e a chave privada continuam ativas.",403:"A autenticação funcionou, m\
as o Firestore recusou a leitura. Confira se o Firestore está ativo e se a conta de serviço tem permissão de acesso. Não é necessário liberar as regras públicas\
 do banco.",404:"O banco Firestore padrão não foi encontrado no projeto vendas-aura. Confira o projeto e o banco usado pelo sistema.",429:"O Firebase limitou \
temporariamente as consultas. Aguarde e tente novamente."}[I.status]||"O Firestore não concluiu a consulta. Tente novamente mais tarde."},I.status===429?503:502);
let O=JSON.parse(await I.text());return!O||typeof O!="object"||Array.isArray(O)||O.error||O.documents!==void 0&&!Array.isArray(O.documents)?E({code:"firebase_re\
sponse_invalid",message:"O Firestore respondeu em um formato inesperado. Tente novamente."},502):E({code:"firebase_connected",firebaseConnected:!0,firestoreRead:!0,
mode:"read-only",projectId:Xe,message:"Conexão com o Firebase funcionando. A credencial foi aceita e a leitura do Firestore está autorizada no projeto vendas-au\
ra. Nenhum registro foi alterado. Use Testar gravação Firebase para conferir também a permissão de gravação."})}catch(l){return l instanceof P?E({code:l.code,
message:l.message},l.status):l instanceof Error&&(l.name==="TimeoutError"||l.name==="AbortError")?E({code:"firebase_timeout",message:"A consulta ao Firebase exc\
edeu "+(s?"40":"20")+" segundos. Aguarde um pouco e tente novamente."},504):l instanceof SyntaxError?E({code:"firebase_response_invalid",message:"O Google ou o \
Firestore não retornou uma resposta JSON válida. Tente novamente."},502):E({code:"firebase_connection_failed",message:"Não foi possível concluir a conexão com\
 o Firebase. Tente novamente; se persistir, confira o painel da Cloudflare."},502)}}function Ja(a={}){let r=a.fetchAsaas||ba,n=a.fetchGoogle||ba,s=ma({IntegrationError:P,
json:E,sandboxTag:ve,decryptAsaasKey:_e,sandboxApi:oa,handleSandboxCheck:Ca,FIRESTORE_DOCUMENTS:le}),f=fa({IntegrationError:P,json:E,authenticatedUser:ta,checkFirebase:ge,
loadPrivateDocument:ze,encryptionKey:Ae,base64url:be,decodeBase64url:we,integrationBody:Ea,DEFAULT_APP_ORIGIN:Ze,FIRESTORE_DOCUMENTS:le}),m=ya({IntegrationError:P,
json:E,authenticatedUser:ta,checkFirebase:ge,loadPrivateDocument:ze,encryptionKey:Ae,decodeBase64url:we,sandboxTag:ve,equalToken:aa,DEFAULT_APP_ORIGIN:Ze,FIRESTORE_DOCUMENTS:le,
PUBLIC_WORKER_URL:Aa});return{async fetch(l,b={}){let A=new URL(l.url);if(A.pathname.startsWith(Fe))return m.handleWebhook(l,b,A.pathname.slice(Fe.length),n,r);
if(A.pathname===me||A.pathname.startsWith(me+"/"))return m.handleRequest(l,b,n,r);if(A.pathname===pe||A.pathname.startsWith(pe+"/"))return f(l,b,n,r);if(A.pathname.
startsWith(ea))return Ka(l,b,A.pathname.slice(ea.length),n,r,s);if(A.pathname===xe||A.pathname.startsWith(xe+"/"))return La(l,b,n,r,s);if(l.method==="GET"&&A.pathname===
"/")return ja();if(l.method==="GET"&&A.pathname==="/health")return E({service:"registro-vendas-pix-testes",stage:"sandbox-charge-test",environment:"sandbox"});if(![
"/api/setup/check","/api/setup/firebase-check","/api/setup/firebase-write-check","/api/setup/encryption-check"].includes(A.pathname))return E({code:"not_found",
message:"Rota não encontrada."},404);if(l.method!=="POST")return E({code:"method_not_allowed",message:"Use os botões de teste desta página."},405);let I=l.headers.
get("Origin");if(I&&I!==A.origin||l.headers.get("Sec-Fetch-Site")==="cross-site")return E({code:"origin_denied",message:"Abra o teste pelo endereço do próprio W\
orker."},403);let O=typeof b.SETUP_TOKEN=="string"?b.SETUP_TOKEN.trim():"";if(!Le.test(O))return E({code:"setup_required",message:"Cadastre o código gerado nest\
a página no Secret SETUP_TOKEN da Cloudflare e clique em Deploy."},503);let p=l.headers.get("X-Setup-Token")||"";if(!Le.test(p)||!aa(p,O))return E({code:"unaut\
horized",message:"O código de configuração não confere com o Secret SETUP_TOKEN da Cloudflare."},401);if(A.pathname==="/api/setup/firebase-check")return ge(
b,n);if(A.pathname==="/api/setup/firebase-write-check")return ge(b,n,!0);if(A.pathname==="/api/setup/encryption-check")return Fa(b);if((typeof b.ASAAS_BASE_URL==
"string"?b.ASAAS_BASE_URL.trim().replace(/\/+$/,""):"")!==$e)return E({code:"sandbox_required",message:"Este código funciona somente em testes. Configure ASAAS_\
BASE_URL como https://api-sandbox.asaas.com/v3."},503);let u=typeof b.ASAAS_API_KEY=="string"?b.ASAAS_API_KEY.trim():"";if(!u||/[\r\n]/.test(u))return E({code:"\
api_key_required",message:"Cadastre a chave de API do Sandbox como Secret ASAAS_API_KEY e clique em Deploy."},503);try{let D=await r(`${$e}/pix/addressKeys?stat\
us=ACTIVE&limit=1`,{method:"GET",headers:{accept:"application/json",access_token:u,"User-Agent":"RegistroDeVendas-Pix-Sandbox-Setup/1.0"},redirect:"manual",signal:AbortSignal.
timeout(2e4)});if(!D.ok)return E({code:"asaas_unavailable",message:{401:"O Asaas não aceitou a chave de API. Confira se a chave é do Sandbox, está habilitada e \
foi copiada integralmente.",403:"O Asaas recusou o acesso. Confira as permissões e eventuais restrições de IP da chave no Sandbox.",429:"O Asaas limitou temp\
orariamente as consultas. Aguarde e tente novamente."}[D.status]||"O Asaas não concluiu a consulta. Tente novamente mais tarde."},D.status===429?503:502);let N=JSON.
parse(await D.text());if(!N||!Array.isArray(N.data))return E({code:"invalid_response",message:"O Asaas respondeu em um formato inesperado. Tente novamente mais \
tarde."},502);let R=N.data.some(k=>k?.status==="ACTIVE");return E({code:R?"ready_for_firebase":"pix_key_required",apiConnected:!0,hasActivePixKey:R,environment:"\
sandbox",message:R?"Conexão com o Asaas Sandbox funcionando. Existe uma chave Pix ativa de teste. Use os botões do Firebase para conferir também o acesso ao ban\
co.":"Conexão com o Asaas Sandbox funcionando. Falta cadastrar ou ativar uma chave Pix na conta de testes. Depois, repita este teste."})}catch(D){return D instanceof
Error&&(D.name==="TimeoutError"||D.name==="AbortError")?E({code:"asaas_timeout",message:"A consulta ao Asaas Sandbox excedeu 20 segundos. Aguarde um pouco e ten\
te novamente."},504):D instanceof SyntaxError?E({code:"invalid_response",message:"O Asaas não retornou uma resposta JSON válida. Tente novamente mais tarde."},
502):E({code:"connection_failed",message:"Não foi possível consultar o Asaas Sandbox. Tente novamente; se persistir, confira o painel da Cloudflare."},502)}}}}
var tt=Ja();export{Ja as createWorker,tt as default};
