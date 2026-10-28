// Registro de Vendas - Worker 104 compacto. Gerado por build.mjs.
var ke=a=>Number.isFinite(Number(a))?Number(a):0,le=class extends Error{constructor(t,n,r={}){super(n),this.name="FinancialCalculationError",this.code=t,this.details=
r}},Q=a=>{let t=ke(a),n=Math.sign(t||1)*Number.EPSILON*Math.max(1,Math.abs(t));return Math.round((t+n)*100)},H=a=>Math.round(ke(a))/100,je=a=>H(Q(a)),sa=(a=[],t=n=>n)=>H(
(Array.isArray(a)?a:[]).reduce((n,r,d)=>n+Q(t(r,d)),0));var ia=a=>a?typeof a?.toDate=="function"?a.toDate().toISOString().slice(0,10):typeof a?.seconds=="number"?new Date(a.seconds*1e3).toISOString().slice(0,10):String(
a).split("T")[0]:"";var Fe=a=>a?.saleType==="prazo"||!a?.saleType;var ca=a=>{if(ke(a?.originalAmount)>0)return je(a.originalAmount);let t=Math.max(0,Q(a?.amount)),r=(Array.isArray(a?.history)?a.history:[]).reduce((d,i)=>d+Math.
max(0,Q(i?.amount)),0);return H(t+r)};var da=a=>(Array.isArray(a)?a:[]).map(t=>({...t,amount:je(t.amount),originalAmount:ca(t),history:Array.isArray(t.history)?t.history.map(n=>({...n})):[]})),$e=(a,t,n,r,d=new Date().
toISOString())=>{let i=parseInt(t,10),c=da(a),m=c[i],g=Q(n),A=ia(r);if(!m||m.paid||Q(m.amount)<=0)throw new le("invalid-installment","A parcela selecionada não \
está mais disponível para pagamento.");if(g<=0||!A)throw new le("invalid-payment","Informe um valor e uma data de pagamento válidos.");let _=c.slice(i).reduce(
(b,O)=>b+(O.paid?0:Math.max(0,Q(O.amount))),0);if(g>_)throw new le("payment-exceeds-balance",`O pagamento informado é maior que o saldo restante do contrato (${H(
_).toFixed(2).replace(".",",")}).`);let C=Math.max(0,Q(m.amount)),h=Math.min(g,C),s=g-h,D=[];for(let b=i+1;s>0&&b<c.length;b+=1){let O=c[b];if(O.paid)continue;let E=Math.
max(0,Q(O.amount));if(E<=0)continue;let y=Math.min(E,s),x=E-y;O.amount=H(x),O.paid=x===0,O.paidAt=O.paid?A:null,O.paidAtDateTime=O.paid?d:null,O.history.push({date:A,
amount:H(y),type:"abatement",fromInstallment:i,sourceTimestamp:d,timestamp:d}),D.push({installmentIndex:b,amount:H(y)}),s-=y}let P=C-h,I={date:A,amount:H(h),type:g<
C?"partial":g===C?"full":"full_surplus",timestamp:d};return g>C&&(I.surplus=H(g-C),I.allocations=D),m.history.push(I),m.amount=H(P),m.paid=P===0,m.paidAt=m.paid?
A:null,m.paidAtDateTime=m.paid?d:null,{installments:c,historyItem:I,allocations:D,paidAmount:H(g),remainingBalance:sa(c.filter(b=>!b.paid),b=>b.amount),allPaid:c.
every(b=>b.paid||Q(b.amount)<=0)}};var oe=class extends Error{constructor(t,n,r={}){super(n),this.name="InventoryReliabilityError",this.code=t,this.details=r}},ua=(a,t)=>{let n=Number(a);if(!Number.
isInteger(n)||n<=0)throw new oe("invalid-quantity",`${t||"Produto"}: informe uma quantidade inteira maior que zero.`);return n},Le=(a=[])=>{if(!Array.isArray(a)||
a.length===0)throw new oe("empty-sale","Adicione pelo menos um produto antes de concluir a venda.");let t=new Map;for(let n of a){if(!n?.productId)throw new oe(
"invalid-product","Um item da venda não está vinculado a um produto válido. Atualize a página e tente novamente.");let r=String(n.productId),d=String(n.productName||
n.name||"Produto"),i=ua(n.quantity,d),c=t.get(r);c?c.requestedQuantity+=i:t.set(r,{productId:r,productName:d,requestedQuantity:i})}return[...t.values()]},ze=(a=[],t=[])=>{
let n=new Map((Array.isArray(t)?t:[]).map(r=>[String(r.productId),r]));return a.map(r=>{let d=n.get(String(r.productId));if(!d)throw new oe("product-not-found",
`${r.productName}: o produto não foi encontrado. Atualize a página e tente novamente.`,{productId:r.productId});let i=Number(d.quantity);if(!Number.isInteger(
i)||i<0)throw new oe("invalid-stock",`${r.productName}: o saldo de estoque está inválido e precisa ser corrigido.`,{productId:r.productId,currentQuantity:i});
if(r.requestedQuantity>i)throw new oe("insufficient-stock",`${r.productName}: estoque disponível é ${i} un., mas a venda solicita ${r.requestedQuantity} un.`,
{productId:r.productId,currentQuantity:i,requestedQuantity:r.requestedQuantity});return{productId:r.productId,productName:r.productName,previousQuantity:i,requestedQuantity:r.
requestedQuantity,newQuantity:i-r.requestedQuantity}})};var ee="/api/integrations/asaas/flow/charges",pe=/^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/,Je=/^[A-Za-z0-9_-]{1,128}$/,q=a=>[
"creating","pending"].includes(a),K=a=>({stringValue:a}),ce=a=>({integerValue:String(a)}),Be=a=>({booleanValue:a}),xe=a=>({timestampValue:a}),S=(a,t)=>a?.fields?.[t]?.
stringValue||"",Z=(a,t)=>Number(a?.fields?.[t]?.integerValue||0),Pe=a=>JSON.stringify(a,(t,n)=>n&&typeof n=="object"&&!Array.isArray(n)?Object.fromEntries(Object.
keys(n).sort().map(r=>[r,n[r]])):n),Ne=(a,t=0)=>{if(t>20)throw new Error("invalid_document");if("stringValue"in a)return a.stringValue;if("booleanValue"in a)return a.
booleanValue;if("integerValue"in a)return Number(a.integerValue);if("doubleValue"in a)return Number(a.doubleValue);if("timestampValue"in a)return a.timestampValue;
if("nullValue"in a)return null;if(a.arrayValue)return(a.arrayValue.values||[]).map(n=>Ne(n,t+1));if(a.mapValue)return Object.fromEntries(Object.entries(a.mapValue.
fields||{}).map(([n,r])=>[n,Ne(r,t+1)]));throw new Error("invalid_document")},Oe=a=>Object.fromEntries(Object.entries(a?.fields||{}).map(([t,n])=>[t,Ne(n)])),Ce=(a,t)=>!!a&&
typeof a=="object"&&!Array.isArray(a)&&Object.keys(a).every(n=>t.includes(n));function Ge(a){let{IntegrationError:t,json:n,sandboxTag:r,decryptAsaasKey:d,sandboxApi:i,
handleSandboxCheck:c,FIRESTORE_DOCUMENTS:m}=a,g=e=>"projects/vendas-aura/databases/(default)/documents/"+e,A=e=>"_asaas_flow_sandbox/"+e,_=(e,o)=>A(e)+"/orders/"+
o,C=(e,o)=>A(e)+"/pending/"+o,h=(e,o)=>A(e)+"/receipts/"+o,s=(e,o,l=409)=>{throw new t(e,o,l)},D=(e,o)=>r(e,"aura:source-parcel:v1:"+Pe({status:o.status||"activ\
e",installments:o.installments})),P=e=>((!e||e.fields.simulationOnly?.booleanValue!==!0||e.fields.flowVersion?.integerValue!=="1"||!pe.test(S(e,"id"))||!["check\
out","installment"].includes(S(e,"kind"))||!Number.isSafeInteger(Z(e,"amountCents"))||Z(e,"amountCents")<500)&&s("flow_invalid","Não foi possível conferir o reg\
istro de teste."),e),I=e=>{P(e);let o=S(e,"state"),l=S(e,"kind"),p=e.fields.setupComplete?.booleanValue===!0,u=JSON.parse(S(e,"resultJson")||"{}"),T={creating:"\
Preparando o Pix de teste. Se a operação for interrompida, retome este teste pelo perfil.",pending:"Aguardando o pagamento de teste. Use somente a simulação n\
o Sandbox.",received:l==="checkout"?"Venda de teste confirmada. Caixa e estoque reais não foram alterados.":"Parcela de teste recebida. A parcela original não \
foi alterada.",cancelled:"Cobrança de teste cancelada. Nenhum registro real foi alterado.",refunded:"Reembolso conferido no Sandbox. O resultado da simulação f\
oi estornado.",review:"A origem ou o status mudou durante o teste. Confira a cobrança no Asaas Sandbox. Nenhuma baixa real foi realizada."};return{environment:"\
sandbox",simulationOnly:!0,id:S(e,"id"),kind:l,state:o,amountCents:Z(e,"amountCents"),providerStatus:S(e,"providerStatus"),ready:p,payload:q(o)&&p?S(e,"payload"):
"",encodedImage:q(o)&&p?S(e,"encodedImage"):"",receiptId:S(e,"receiptId"),confirmationSource:S(e,"confirmationSource"),summary:{receivedCents:u.receivedCents||0,
remainingCents:u.remainingCents||0,stockUnits:u.stockUnits||0,installmentPaid:u.installmentPaid===!0},message:T[o]||"Confira o andamento da cobrança de teste."}},
b=(e,o,l)=>({update:{name:g(e),fields:l},updateMask:{fieldPaths:Object.keys(l)},currentDocument:o?{updateTime:o.updateTime}:{exists:!1}}),O=(e,o)=>({delete:g(e),
currentDocument:{updateTime:o.updateTime}}),E=async(e,o)=>{for(let u of o){let T=u.update?.name||u.delete;if(!(T.startsWith(g(A(e.user.uid)+"/"))||T===g("_asaas\
_integrations/"+e.user.uid)))throw new Error("unsafe_write")}let l=await e.fetchGoogle(m.slice(0,-1)+":commit",{method:"POST",headers:e.headers,redirect:"manual",
signal:e.signal,body:JSON.stringify({writes:o})});[409,412].includes(l.status)&&s("flow_conflict","O teste mudou durante esta operação. Consulte o andamento e t\
ente novamente."),l.ok||s("flow_save_failed","Não foi possível salvar o teste. Consulte o andamento antes de repetir.",503);let p=JSON.parse(await l.text());(!Array.
isArray(p.writeResults)||p.writeResults.length!==o.length)&&s("flow_save_failed","A gravação do teste não foi confirmada. Consulte o andamento antes de repetir.",
503)},y=async(e,o)=>{let l=await e.load("_asaas_integrations/"+e.user.uid),p=await e.load(C(e.user.uid,S(o,"id"))),u=Z(l,"pendingCharges");(!l||!p||!Number.isSafeInteger(
u)||u<1)&&s("flow_state_conflict","O andamento do teste precisa ser conferido antes de confirmar.",503);let T=[b("_asaas_integrations/"+e.user.uid,l,{pendingCharges:ce(
u-1)}),O(C(e.user.uid,S(o,"id")),p)];if(S(o,"sourceSlot")){let N=A(e.user.uid)+"/slots/"+S(o,"sourceSlot"),v=await e.load(N);(!v||S(v,"orderId")!==S(o,"id"))&&s(
"flow_state_conflict","Não foi possível conferir a reserva da parcela de teste.",503),T.push(O(N,v))}return T},x=async e=>{(e.headers.get("Content-Type")||"").
toLowerCase().startsWith("application/json")||s("invalid_body","Envie os dados do teste em JSON.",400);let o=e.body?.getReader();o||s("invalid_body","Informe os\
 dados do teste.",400);let l=[],p=0;for(;;){let{value:N,done:v}=await o.read();if(v)break;p+=N.length,p>12288&&(await o.cancel(),s("invalid_body","O pedido de t\
este excedeu o tamanho permitido.",413)),l.push(N)}let u=new Uint8Array(p),T=0;for(let N of l)u.set(N,T),T+=N.length;try{return JSON.parse(new TextDecoder("utf-\
8",{fatal:!0}).decode(u))}catch{s("invalid_body","Confira os dados do pedido de teste.",400)}},k=async e=>{let o=e.body?.getReader();if(o)for(;;){let{value:l,done:p}=await o.
read();if(p)return;l.length&&(await o.cancel(),s("invalid_body","Esta ação usa somente a cobrança salva.",400))}},V=async e=>{e.current?.fields?.enabled?.booleanValue||
s("flow_disabled","Ative a conexão Asaas Sandbox no perfil antes de testar.");let o=await d(e.env,e.user.uid,e.current.fields);return{key:o,keyTag:await r(e.env,
"aura:sandbox-key:v1:"+o),api:i(e.fetchAsaas,o,e.signal)}},$=(e,o)=>{(e?.id!==S(o,"paymentId")||e.customer!==S(o,"customerId")||e.externalReference!==S(o,"refer\
ence")||e.billingType!=="PIX"||e.value!==H(Z(o,"amountCents"))||typeof e.status!="string"||!/^[A-Z_]{3,64}$/.test(e.status))&&s("flow_payment_mismatch","A cobra\
nça não corresponde ao pedido de teste. Nenhuma baixa foi realizada.")},z=async(e,o)=>{if(o?.kind==="checkout"){(!Ce(o,["kind","idempotencyKey","items"])||!/^[a-f0-9-]{36}$/.
test(o.idempotencyKey||"")||!pe.test(o.idempotencyKey)||!Array.isArray(o.items)||o.items.length<1||o.items.length>10)&&s("invalid_checkout","O teste do caixa ac\
eita de 1 a 10 itens válidos.",400);let l=o.items.map(v=>((!Ce(v,["productId","quantity","lineTotalCents"])||!Je.test(v.productId||"")||!Number.isSafeInteger(v.
quantity)||v.quantity<1||v.quantity>999||!Number.isSafeInteger(v.lineTotalCents)||v.lineTotalCents<v.quantity||v.lineTotalCents>5e6)&&s("invalid_checkout","Conf\
ira os produtos, as quantidades e os preços do carrinho de teste.",400),{productId:v.productId,quantity:v.quantity,lineTotalCents:v.lineTotalCents})),p=Le(l),u=await Promise.
all(p.map(async v=>{let M=await e.load("artifacts/vendas-aura-main/users/"+e.user.uid+"/products/"+v.productId);M||s("product_not_found","Um produto do carrinho\
 não está mais disponível.");let R=Oe(M);return{productId:v.productId,quantity:R.quantity,name:String(R.name||"Produto").slice(0,160),costPrice:R.costPrice}})),
T;try{T=ze(p,u)}catch{s("invalid_stock","O estoque atual não permite esse carrinho de teste. Atualize as quantidades.")}let N=l.reduce((v,M)=>v+M.lineTotalCents,
0);return{id:o.idempotencyKey,amountCents:N,snapshot:{kind:"checkout",items:l,stockPlan:T,amountCents:N},request:{kind:o.kind,items:l}}}if(o?.kind==="installmen\
t"){(!Ce(o,["kind","saleId","installmentIndex"])||!Je.test(o.saleId||"")||!Number.isInteger(o.installmentIndex)||o.installmentIndex<0||o.installmentIndex>119)&&
s("invalid_installment","Confira a venda e a parcela de teste.",400);let l=await e.load("artifacts/vendas-aura-main/users/"+e.user.uid+"/sales/"+o.saleId);l||s(
"sale_not_found","A venda não foi encontrada.");let p=Oe(l),u=p.installments?.[o.installmentIndex];(!Fe(p)||p.status==="canceled"||!u||u.paid||Q(u.amount)<=0)&&
s("installment_unavailable","Esta parcela não está mais disponível para o teste.");let T=await D(e.env,p),N=await r(e.env,"aura:installment-order:v1:"+e.user.
uid+":"+o.saleId+":"+o.installmentIndex+":"+T+":"+e.keyTag),v=(await r(e.env,"aura:parcel-slot:v1:"+o.saleId+":"+o.installmentIndex)).slice(0,32);return{id:N.slice(
0,32),sourceSlot:v,amountCents:Q(u.amount),snapshot:{kind:"installment",installments:p.installments,installmentIndex:o.installmentIndex,saleId:o.saleId,sourceMarker:T},
request:{kind:o.kind,saleId:o.saleId,installmentIndex:o.installmentIndex,sourceMarker:T}}}s("invalid_kind","Escolha um teste do caixa ou de parcela.",400)},G=async e=>{
let o=await e.fetchGoogle(m+A(e.user.uid)+"/pending?pageSize=10",{method:"GET",headers:e.headers,redirect:"manual",signal:e.signal});o.ok||s("flow_list_failed",
"Não foi possível carregar os testes pendentes.",503);let l=JSON.parse(await o.text());(l.nextPageToken||l.documents!==void 0&&!Array.isArray(l.documents))&&s(
"flow_list_failed","Não foi possível conferir os testes pendentes.",503);let p=(l.documents||[]).map(u=>{let T=S(u,"id");return(!pe.test(T)||u.name!==g(C(e.user.
uid,T)))&&s("flow_list_failed","Não foi possível conferir um teste pendente.",503),{id:T,kind:S(u,"kind"),amountCents:Z(u,"amountCents")}});return n({environment:"\
sandbox",simulationOnly:!0,orders:p})},L=async(e,o,l,p,u="")=>{P(o),$(l,o);let T=S(o,"state");if(u&&S(o,"lastEventId")===u)return o;let N=l.deleted!==!0&&l.status===
"RECEIVED",v=l.status==="REFUNDED",M=l.deleted===!0,R=T,J=JSON.parse(S(o,"resultJson")||"{}");if(N&&q(T)){let B=JSON.parse(S(o,"snapshotJson"));if(B.kind==="che\
ckout")J={receivedCents:Z(o,"amountCents"),stockUnits:B.stockPlan.reduce((ne,te)=>ne+te.requestedQuantity,0),stockPlan:B.stockPlan,saleStatus:"completed"};else{
let ne=await e.load("artifacts/vendas-aura-main/users/"+e.user.uid+"/sales/"+B.saleId);if(!ne||await D(e.env,Oe(ne))!==B.sourceMarker)R="review";else{let te=new Date().
toISOString(),Y=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date),Ie=["year",
"month","day"].map(oa=>Y.find(ra=>ra.type===oa)?.value).join("-"),ie=$e(B.installments,B.installmentIndex,H(Z(o,"amountCents")),Ie,te);ie.historyItem.provider="\
asaas-sandbox",ie.historyItem.providerPaymentId=l.id,J={receivedCents:Z(o,"amountCents"),remainingCents:Q(ie.remainingBalance),installmentPaid:ie.installments[B.
installmentIndex].paid,installments:ie.installments,saleStatus:ie.allPaid?"completed":"active"}}}R!=="review"&&(R="received")}else v&&(T==="received"||q(T))?(R=
"refunded",J={receivedCents:0,refundedCents:Z(o,"amountCents")}):N&&!["received","review"].includes(T)||M&&l.status==="RECEIVED"&&q(T)?R="review":M&&q(T)&&(R="c\
ancelled");if(R===T&&!q(T))return o;let ae={state:K(R),providerStatus:K(M?"DELETED":l.status),lastEventId:K(u||S(o,"lastEventId")),updatedAt:xe(new Date().toISOString())},
X=[];if(q(T)&&!q(R)&&X.push(...await y(e,o)),R!==T&&["received","refunded","review"].includes(R)){Object.assign(ae,{resultJson:K(JSON.stringify(J)),receiptId:K(
l.id),confirmationSource:K(p)});let B=await e.load(h(e.user.uid,l.id));R==="received"&&B&&s("flow_receipt_conflict","Este pagamento já possui um resultado salvo\
. Confira o andamento do teste.",503),X.push(b(h(e.user.uid,l.id),B,{orderId:K(S(o,"id")),paymentId:K(l.id),state:K(R),amountCents:ce(Z(o,"amountCents")),simulationOnly:Be(
!0),resultJson:K(JSON.stringify(J))}))}return X.unshift(b(_(e.user.uid,S(o,"id")),o,ae)),await E(e,X),e.load(_(e.user.uid,S(o,"id")))};return{methods:e=>e===ee?
["GET","POST"]:new RegExp("^"+ee+"/(?:[a-f0-9]{32}|[a-f0-9-]{36})(?:/(prepare|simulate|reconcile|cancel))?$").test(e)?e.slice(ee.length+1).includes("/")?["POST"]:
["GET"]:[],matches:e=>e===ee||e.startsWith(ee+"/"),handleRequest:async e=>{let o=new URL(e.request.url).pathname;if(o===ee&&e.request.method==="GET")return G(e);
let l=await V(e);Object.assign(e,l);let p,u;if(o===ee){let v=await x(e.request),M=await e.load("_asaas_sandbox_checks/"+e.user.uid);if((S(M,"keyTag")!==e.keyTag||
S(M,"providerStatus")!=="RECEIVED"||!M?.fields?.webhookAt?.timestampValue)&&s("flow_diagnostic_required","Conclua primeiro o teste de cobrança e retorno automát\
ico no perfil."),v?.kind==="checkout"&&pe.test(v.idempotencyKey||"")&&(u=await e.load(_(e.user.uid,v.idempotencyKey)),u)){let J=await r(e.env,"aura:flow-request\
:v1:"+Pe({kind:v.kind,items:v.items}));(!Ce(v,["kind","idempotencyKey","items"])||J!==S(u,"requestHash"))&&s("flow_intent_changed","Este teste pertence a outro \
carrinho. Abra uma nova cobrança de teste.")}let R;if(u||(R=await z(e,v)),p=u?S(u,"id"):R.id,R?.sourceSlot){let J=await e.load(A(e.user.uid)+"/slots/"+R.sourceSlot);
J&&S(J,"orderId")!==p&&s("flow_installment_pending","Já existe um teste pendente desta parcela. Retome ou cancele esse teste pelo perfil.")}if(u||(u=await e.load(
_(e.user.uid,p))),!u){(R.amountCents<500||R.amountCents>5e6)&&s("flow_amount_invalid","Neste teste, o valor deve ficar entre R$ 5,00 e R$ 50.000,00.",400);let J=JSON.
stringify(R.snapshot);new TextEncoder().encode(J).length>64e3&&s("flow_snapshot_large","Este contrato é muito grande para o teste. Escolha outra parcela.",400);
let ae=await e.load("_asaas_integrations/"+e.user.uid);(!ae?.fields?.enabled?.booleanValue||await r(e.env,"aura:sandbox-key:v1:"+await d(e.env,e.user.uid,ae.fields))!==
e.keyTag)&&s("flow_credential_changed","A conexão mudou. Reabra o perfil antes de gerar o teste.");let X=Z(ae,"pendingCharges");(!Number.isInteger(X)||X<0||X>=
5)&&s("flow_pending_limit","Conclua ou cancele os testes pendentes no perfil antes de criar outro.");let re={id:K(p),kind:K(v.kind),state:K("creating"),amountCents:ce(
R.amountCents),snapshotJson:K(J),requestHash:K(await r(e.env,"aura:flow-request:v1:"+Pe(R.request))),keyTag:K(e.keyTag),reference:K("aura-flow-"+p),simulationOnly:Be(
!0),flowVersion:ce(1),sourceSlot:K(R.sourceSlot||""),createdAt:xe(new Date().toISOString()),leaseUntil:xe(new Date(0).toISOString())},B=[b(_(e.user.uid,p),null,
re),b(C(e.user.uid,p),null,{id:K(p),kind:K(v.kind),amountCents:ce(R.amountCents)}),b("_asaas_integrations/"+e.user.uid,ae,{pendingCharges:ce(X+1)})];R.sourceSlot&&
B.push(b(A(e.user.uid)+"/slots/"+R.sourceSlot,null,{orderId:K(p)})),await E(e,B),u=await e.load(_(e.user.uid,p))}}else p=o.slice(ee.length+1).split("/")[0],u=await e.
load(_(e.user.uid,p)),u||s("flow_not_found","A cobrança de teste não foi encontrada.",404);if(P(u),e.request.method==="GET")return n(I(u));S(u,"keyTag")!==e.keyTag&&
s("flow_credential_changed","Este teste pertence à conexão anterior. Confira a cobrança no Asaas Sandbox.");let T=o.slice(ee.length+1+p.length+1);if(o!==ee&&
await k(e.request),o===ee||T==="prepare"){if(!q(S(u,"state")))return n(I(u));let v=new Request("https://worker.internal/api/integrations/asaas/sandbox-charge",{
method:"POST"});if(await c({...e,request:v,checkPath:_(e.user.uid,p)}),u=await e.load(_(e.user.uid,p)),q(S(u,"state"))){let M=A(e.user.uid)+"/payments/"+S(u,"pa\
ymentId"),R=await e.load(M);await E(e,[b(_(e.user.uid,p),u,{state:K("pending")}),b(M,R,{orderId:K(p)})])}return n(I(await e.load(_(e.user.uid,p))))}if(T==="simu\
late"){if(!q(S(u,"state")))return n(I(u));let v=new Request("https://worker.internal/api/integrations/asaas/sandbox-charge/simulate",{method:"POST"});return await c(
{...e,request:v,checkPath:_(e.user.uid,p)}),n({...I(await e.load(_(e.user.uid,p))),message:"Simulação enviada. Aguarde a confirmação automática do Asaas."})}
if(!S(u,"paymentId")){if(T==="cancel"&&q(S(u,"state"))&&S(u,"pendingCreate")!=="payment")return await E(e,[b(_(e.user.uid,p),u,{state:K("cancelled")}),...await y(
e,u)]),n(I(await e.load(_(e.user.uid,p))));s("flow_not_prepared","Retome a preparação deste teste antes de conferir ou cancelar.")}let N=await e.api("/payment\
s/"+S(u,"paymentId"));return $(N,u),T==="cancel"&&q(S(u,"state"))&&N.deleted!==!0&&N.status==="CONFIRMED"&&s("flow_cancellation_blocked","O Asaas ainda está ana\
lisando a cobrança. Aguarde a conclusão para confirmar ou cancelar o teste."),T==="cancel"&&q(S(u,"state"))&&N.deleted!==!0&&["PENDING","OVERDUE"].includes(N.
status)&&(await e.api("/payments/"+N.id,"DELETE"),N=await e.api("/payments/"+N.id),$(N,u),N.deleted!==!0&&!["RECEIVED","REFUNDED"].includes(N.status)&&s("flow_c\
ancel_unknown","O cancelamento ainda não foi confirmado pelo Asaas. Confira o andamento antes de repetir.")),n(I(await L(e,u,N,"reconciliation")))},handleWebhook:async e=>{
let o=e.event.payment.externalReference,l=await e.load(A(e.user.uid)+"/payments/"+e.event.payment.id),p=l?S(l,"orderId"):typeof o=="string"&&o.startsWith("aura-\
flow-")?o.slice(10):"";if(!pe.test(p))return n({accepted:!0});let u=await e.load(_(e.user.uid,p));if(!u)return n({accepted:!0});if(P(u),S(u,"paymentId")||s("flo\
w_webhook_retry","A cobrança ainda está sendo registrada. Repetir entrega.",503),S(u,"paymentId")!==e.event.payment.id)return n({accepted:!0});e.current=await e.
load("_asaas_integrations/"+e.user.uid);let T=await e.load("artifacts/vendas-aura-main/users/"+e.user.uid+"/profile/info");if(T?.fields?.approved?.booleanValue!==
!0||!["","active"].includes(T.fields.status?.stringValue||"")||!e.current?.fields?.enabled?.booleanValue)return n({accepted:!0});if(Object.assign(e,await V(e)),
S(u,"keyTag")!==e.keyTag)return n({accepted:!0});let N=await e.api("/payments/"+e.event.payment.id);try{await L(e,u,N,"webhook",e.event.id)}catch(v){throw v.code===
"flow_conflict"&&s("flow_webhook_retry","O teste mudou. Repetir entrega.",503),v}return n({accepted:!0})}}}var me="/api/integrations/asaas-production",la="https://api.asaas.com/v3/pix/addressKeys?status=ACTIVE&limit=1",pa="_asaas_production_integrations/";function qe(a){
let{IntegrationError:t,json:n,authenticatedUser:r,checkFirebase:d,loadPrivateDocument:i,encryptionKey:c,base64url:m,decodeBase64url:g,integrationBody:A,DEFAULT_APP_ORIGIN:_,
FIRESTORE_DOCUMENTS:C}=a,h=(E,y,x=503)=>{throw new t(E,y,x)},s=E=>new TextEncoder().encode("vendas-aura:asaas:production:v1:"+E),D=async(E,y,x)=>{let k=crypto.getRandomValues(
new Uint8Array(12)),V=await crypto.subtle.encrypt({name:"AES-GCM",iv:k,additionalData:s(y)},await c(E),new TextEncoder().encode(x));return{cipher:m(new Uint8Array(
V)),iv:m(k)}},P=async(E,y,x)=>{(x.fields.environment?.stringValue!=="production"||x.fields.version?.integerValue!=="1")&&h("production_format_invalid","Não foi \
possível conferir a conexão de Produção salva.");try{let k=g(x.fields.iv?.stringValue);if(k.length!==12)throw new Error("invalid_iv");let V=await crypto.subtle.
decrypt({name:"AES-GCM",iv:k,additionalData:s(y)},await c(E),g(x.fields.cipher?.stringValue));return new TextDecoder("utf-8",{fatal:!0}).decode(V)}catch(k){if(k instanceof
t)throw k;h("production_key_unreadable","Não foi possível abrir a chave real salva. Confira a configuração de proteção antes de substituir a conexão.")}},
I=E=>({configured:!!E,environment:"production",connectionVersion:1,receivingEnabled:!1,hasActivePixKey:E?.fields?.hasActivePixKey?.booleanValue===!0,checkedAt:E?.
fields?.checkedAt?.timestampValue||null}),b=async E=>{let y=E.body?.getReader();if(y)for(;;){let{value:x,done:k}=await y.read();if(k)return;x.length&&(await y.cancel(),
h("invalid_body","Esta ação usa somente a conexão real salva.",400))}},O=async(E,y,x)=>{let k;try{k=await y(la,{method:"GET",redirect:"manual",signal:x,headers:{
accept:"application/json",access_token:E,"User-Agent":"RegistroDeVendas-Pix-Production-Connection/1.0"}})}catch($){let z=["TimeoutError","AbortError"].includes(
$?.name);h("production_connection_failed",z?"A consulta da conta real excedeu o tempo de espera. Tente novamente.":"Não foi possível consultar a conta real do A\
saas. Tente novamente.",z?504:503)}k.ok||h("production_key_rejected",[401,403].includes(k.status)?"O Asaas não aceitou a chave real. Confira se ela pertence à c\
onta de Produção e permite consultar as chaves Pix.":k.status===429?"O Asaas limitou temporariamente as consultas. Aguarde e tente novamente.":"O Asaas não co\
ncluiu a consulta da conta real. Tente novamente.",502);let V;try{V=JSON.parse(await k.text())}catch{h("production_response_invalid","O Asaas não retornou uma r\
esposta válida para a consulta da conta real.",502)}return Array.isArray(V?.data)||h("production_response_invalid","Não foi possível conferir a consulta da con\
ta real.",502),V.data.some($=>$?.status==="ACTIVE")};return async(E,y,x,k)=>{let V=E.headers.get("Origin"),$=typeof y.APP_ORIGIN=="string"&&y.APP_ORIGIN.trim()?
y.APP_ORIGIN.trim():_;if(!V||V!==$)return n({code:"origin_denied",message:"Abra a conexão de Produção pelo sistema de vendas."},403);let z={"Access-Control-A\
llow-Origin":V,Vary:"Origin"},G=F=>{for(let[e,o]of Object.entries(z))F.headers.set(e,o);return F},L=new URL(E.url).pathname,W=L===me?["GET","PUT","DELETE"]:L===
me+"/test"?["POST"]:[];if(!W.length)return G(n({code:"not_found",message:"Rota não encontrada."},404));if(E.method==="OPTIONS"){if(!W.includes(E.headers.get("A\
ccess-Control-Request-Method")||""))return G(n({code:"method_not_allowed",message:"Método não permitido."},405));let F=n(null,200);return new Response(null,{status:204,
headers:{...Object.fromEntries(F.headers),...z,"Access-Control-Allow-Methods":W.join(", "),"Access-Control-Allow-Headers":"Authorization, Content-Type","Access-\
Control-Max-Age":"600"}})}if(!W.includes(E.method))return G(n({code:"method_not_allowed",message:"Método não permitido."},405));try{let F=await r(E,x),e=E.method===
"PUT"?await A(E):null;e&&(Object.keys(e).some(l=>l!=="apiKey")||typeof e.apiKey!="string")&&h("invalid_body","Informe somente a chave de API de Produção. A ativ\
ação dos recebimentos será feita na próxima etapa.",400),e||await b(E);let o=await d(y,x,!1,async(l,p)=>{let u={accept:"application/json","Content-Type":"ap\
plication/json",Authorization:"Bearer "+l},T=Y=>i(x,u,p,Y),N=await T("artifacts/vendas-aura-main/users/"+F.uid+"/profile/info");(N?.fields?.approved?.booleanValue!==
!0||!["","active"].includes(N.fields.status?.stringValue||""))&&h("account_not_approved","Sua conta precisa estar aprovada e ativa para conectar o Asaas real.",
403);let v=pa+F.uid,M=await T(v),R=()=>new URLSearchParams(M?{"currentDocument.updateTime":M.updateTime}:{"currentDocument.exists":"false"});if(["PUT","DELETE"].
includes(E.method)&&Number(M?.fields?.pendingCharges?.integerValue||0)>0&&h("production_pending_charges","Existem cobranças pendentes vinculadas à conexão real.\
 Confira essas cobranças antes de alterar a chave.",409),E.method==="DELETE"){if(M){let Y=await x(C+v+"?"+R(),{method:"DELETE",headers:u,redirect:"manual",signal:p});
[409,412].includes(Y.status)&&h("production_changed","A conexão real mudou. Atualize o perfil antes de remover.",409),!Y.ok&&Y.status!==404&&h("production_dele\
te_failed","Não foi possível remover a conexão real.")}return n({...I(null),message:"Chave de Produção removida. A conexão Sandbox foi preservada."})}if(await c(
y),E.method==="GET")return M&&await P(y,F.uid,M),n(I(M));let J=e?e.apiKey.trim():M?await P(y,F.uid,M):"";J||h("production_key_required","Informe a chave da API \
da sua conta real do Asaas.",400);let ae=await O(J,k,p),X=new Date().toISOString(),re={hasActivePixKey:{booleanValue:ae},checkedAt:{timestampValue:X},updatedAt:{
timestampValue:X}};if(e){let Y=await D(y,F.uid,J);Object.assign(re,{environment:{stringValue:"production"},version:{integerValue:"1"},cipher:{stringValue:Y.cipher},
iv:{stringValue:Y.iv},enabled:{booleanValue:!1}})}let B=R();for(let Y of Object.keys(re))B.append("updateMask.fieldPaths",Y);let ne=await x(C+v+"?"+B,{method:"P\
ATCH",headers:u,redirect:"manual",signal:p,body:JSON.stringify({fields:re})});[409,412].includes(ne.status)&&h("production_changed","A conexão real mudou durant\
e a consulta. Atualize o perfil e tente novamente.",409),ne.ok||h("production_save_failed","A chave foi consultada, mas não foi possível confirmar a gravação. A\
tualize o perfil antes de repetir.");let te;try{te=JSON.parse(await ne.text())}catch{h("production_save_failed","Não foi possível confirmar a gravação da conexã\
o real. Atualize o perfil antes de repetir.")}return(te?.name!=="projects/vendas-aura/databases/(default)/documents/"+v||typeof te.updateTime!="string"||!te.fields||
Object.entries(re).some(([Y,Ie])=>JSON.stringify(te.fields[Y])!==JSON.stringify(Ie)))&&h("production_save_failed","Não foi possível confirmar a gravação da cone\
xão real. Atualize o perfil antes de repetir."),n({...I(te),message:ae?"Conta real do Asaas conectada. A chave está protegida e a consulta foi validada. Os rec\
ebimentos reais ainda aguardam ativação.":"Conta real do Asaas conectada. Falta cadastrar ou ativar uma chave Pix nessa conta. Os recebimentos reais ainda agu\
ardam ativação."})});return G(o)}catch(F){return G(n({code:F instanceof t?F.code:"production_unavailable",message:F instanceof t?F.message:"Não foi possível c\
oncluir a consulta da conta real. Tente novamente."},F instanceof t?F.status:503))}}}var Se="https://api-sandbox.asaas.com/v3",Te=/^[a-f0-9]{64}$/i,De="vendas-aura",We="https://oauth2.googleapis.com/token",ma="https://firestore.googleapis.com/v1\
/projects/vendas-aura/databases/(default)/documents/_pix_connection_check?pageSize=1&mask.fieldPaths=connectionTest",fa="https://firestore.googleapis.com/v1/pro\
jects/vendas-aura/databases/(default)/documents/_pix_connection_check",se="https://firestore.googleapis.com/v1/projects/vendas-aura/databases/(default)/document\
s/",ha="AIzaSyDQQcD2tzsVS8Xzy-GpHT897kB7EC-S8Ng",Qe="https://washingtonbarbalho.github.io",we="/api/integrations/asaas",he=we+"/sandbox-charge",Ve="/api/webhook\
s/asaas/sandbox/",ya="https://registro-vendas-pix-testes.washington-wn8.workers.dev",Xe=["PAYMENT_CONFIRMED","PAYMENT_RECEIVED","PAYMENT_REFUNDED","PAYMENT_DELE\
TED","PAYMENT_OVERDUE","PAYMENT_RESTORED","PAYMENT_UPDATED"],Ye=(a,t)=>fetch(a,t),Me={"Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type\
-Options":"nosniff","X-Frame-Options":"DENY","Permissions-Policy":"camera=(), microphone=(), geolocation=()","Strict-Transport-Security":"max-age=31536000"};function f(a,t=200){
return new Response(JSON.stringify(a),{status:t,headers:{...Me,"Content-Type":"application/json; charset=utf-8"}})}function Ze(a,t){let n=a.length^t.length;for(let r=0;r<
64;r+=1)n|=(a.charCodeAt(r)||0)^(t.charCodeAt(r)||0);return n===0}function ga(){return new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><t\
itle>Registro de Vendas · Asaas Sandbox</title><main style="max-width:560px;margin:40px auto;padding:24px;font:16px/1.5 system-ui"><h1>Conexão Asaas · Etapa 7</\
h1><p>Abra Meu Perfil para conectar a conta real do Asaas por consulta e retomar os testes Sandbox. A conexão de Produção ainda não cria cobranças reais.</p><p>\
Os testes usam cópias separadas. Vendas, parcelas e estoque reais não são alterados.</p><a href="https://washingtonbarbalho.github.io/registrodevendas/?v=104">A\
brir o sistema</a></main></html>',{headers:{...Me,"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inl\
ine'; base-uri 'none'; frame-ancestors 'none'"}})}function de(a){return btoa(String.fromCharCode(...a)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}var w=class extends Error{constructor(t,n,r=503){
super(n),this.code=t,this.status=r}};function Ae(a){if(typeof a!="string"||!/^[A-Za-z0-9_-]+$/.test(a))throw new Error("invalid_base64url");let t=a.replace(/-/g,
"+").replace(/_/g,"/");return Uint8Array.from(atob(t+"=".repeat((4-t.length%4)%4)),n=>n.charCodeAt(0))}async function _e(a){if(typeof a.PIX_ENCRYPTION_KEY!="str\
ing"||!Te.test(a.PIX_ENCRYPTION_KEY.trim()))throw new w("integration_setup_required","A proteção da integração ainda precisa ser configurada pelo administrador.");
let t=Uint8Array.from(a.PIX_ENCRYPTION_KEY.trim().match(/../g)||[],n=>parseInt(n,16));return crypto.subtle.importKey("raw",t,"AES-GCM",!1,["encrypt","decrypt"])}
async function ea(a,t,n){let r=crypto.getRandomValues(new Uint8Array(12)),d=new TextEncoder().encode("vendas-aura:asaas:sandbox:v1:"+t),i=await crypto.subtle.encrypt(
{name:"AES-GCM",iv:r,additionalData:d},await _e(a),new TextEncoder().encode(n));return{cipher:de(new Uint8Array(i)),iv:de(r)}}async function ue(a,t,n){if(n.environment?.
stringValue!=="sandbox"||n.version?.integerValue!=="1")throw new w("integration_format_invalid","A configuração salva precisa ser refeita.");try{let r=Ae(n.iv?.
stringValue);if(r.length!==12)throw new Error("invalid_iv");let d=new TextEncoder().encode("vendas-aura:asaas:sandbox:v1:"+t),i=await crypto.subtle.decrypt({name:"\
AES-GCM",iv:r,additionalData:d},await _e(a),Ae(n.cipher?.stringValue));return new TextDecoder("utf-8",{fatal:!0}).decode(i)}catch(r){throw r instanceof w?r:new w(
"integration_key_unreadable","Não foi possível abrir a chave salva. Confira a configuração de proteção antes de substituir a integração.")}}async function ba(a){
try{let t=crypto.randomUUID(),n=await ea(a,"diagnostic-only",t);if(await ue(a,"diagnostic-only",{environment:{stringValue:"sandbox"},version:{integerValue:"1"},
cipher:{stringValue:n.cipher},iv:{stringValue:n.iv}})!==t)throw new Error("encryption_check_failed");return f({code:"encryption_ready",encryptionReady:!0,message:"\
Proteção configurada e testada. O Worker consegue proteger e recuperar as chaves das integrações. A próxima etapa é conectar o Asaas Sandbox pelo perfil do sist\
ema."})}catch(t){return f({code:"encryption_setup_required",message:t instanceof w?"Cadastre a chave gerada nesta página como Secret PIX_ENCRYPTION_KEY e clique\
 em Deploy.":"Não foi possível validar a proteção. Confira o Secret PIX_ENCRYPTION_KEY."},503)}}async function aa(a,t){let n=a.headers.get("Authorization")||
"",r=n.startsWith("Bearer ")?n.slice(7):"",d=()=>new w("login_required","Entre novamente no sistema para configurar o Asaas.",401);if(!r||r.length>8192)throw d();
let i;try{let A=r.split(".");if(A.length!==3)throw d();let _=JSON.parse(new TextDecoder().decode(Ae(A[0])));i=JSON.parse(new TextDecoder().decode(Ae(A[1])));let C=Date.
now()/1e3;if(_.alg!=="RS256"||i.aud!==De||i.iss!=="https://securetoken.google.com/vendas-aura"||typeof i.sub!="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(i.sub)||!Number.
isFinite(i.exp)||i.exp<=C||!Number.isFinite(i.iat)||i.iat>C+60||!Number.isFinite(i.auth_time)||i.auth_time>C+60)throw d()}catch{throw d()}let c=await t("https:/\
/identitytoolkit.googleapis.com/v1/accounts:lookup?key="+ha,{method:"POST",headers:{"Content-Type":"application/json",accept:"application/json"},body:JSON.stringify(
{idToken:r}),redirect:"manual",signal:AbortSignal.timeout(1e4)});if(!c.ok)throw[400,401].includes(c.status)?d():new w("login_check_unavailable","Não foi possíve\
l validar seu acesso. Tente novamente.");let m=JSON.parse(await c.text()),g=Array.isArray(m?.users)&&m.users.length===1?m.users[0]:null;if(!g||g.localId!==i.sub||
g.disabled===!0||Number(g.validSince||0)>i.auth_time)throw d();return{uid:g.localId,email:typeof g.email=="string"&&g.email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.
test(g.email)?g.email:""}}async function Ue(a,t,n,r){let d=await a(se+r,{method:"GET",headers:t,redirect:"manual",signal:n});if(d.status===404)return null;if(!d.
ok)throw new w("integration_read_failed","Não foi possível carregar a configuração da integração.");let i=JSON.parse(await d.text());if(i?.name!=="project\
s/vendas-aura/databases/(default)/documents/"+r||!i.fields||typeof i.fields!="object"||Array.isArray(i.fields)||typeof i.updateTime!="string"||!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.
test(i.updateTime))throw new w("integration_read_failed","Não foi possível conferir a configuração salva.");return i}async function ve(a,t){await _e(a);let n=Uint8Array.
from(a.PIX_ENCRYPTION_KEY.trim().match(/../g)||[],i=>parseInt(i,16)),r=await crypto.subtle.importKey("raw",n,{name:"HMAC",hash:"SHA-256"},!1,["sign"]),d=await crypto.
subtle.sign("HMAC",r,new TextEncoder().encode(t));return Array.from(new Uint8Array(d),i=>i.toString(16).padStart(2,"0")).join("")}var U=a=>({stringValue:a}),ye=a=>({
timestampValue:a}),He=a=>({booleanValue:a}),j=(a,t)=>a?.fields?.[t]?.stringValue||"",ge=a=>typeof a=="string"&&/^[A-Za-z0-9_-]{5,128}$/.test(a);function Ke(a,t,n){
return async(r,d="GET",i)=>{let c=await a(Se+r,{method:d,redirect:"manual",signal:n,headers:{accept:"application/json",access_token:t,"User-Agent":"RegistroDeVe\
ndas-Pix-Sandbox/2.0",...i===void 0?{}:{"Content-Type":"application/json"}},...i===void 0?{}:{body:JSON.stringify(i)}});if(!c.ok){let m=new w("sandbox_provider_\
failed",[401,403].includes(c.status)?"O Asaas recusou o acesso. Confira as permissões da chave Sandbox para clientes, cobranças e Webhooks.":c.status===400?"O\
 Asaas recusou os dados do teste. Confira se a conta Sandbox está aprovada e permite cobranças Pix e Webhooks.":"O Asaas não concluiu o teste. Aguarde um pouc\
o e tente novamente.",502);throw m.definitive=[400,401,403,404,422,429].includes(c.status),m}try{return JSON.parse(await c.text())}catch{throw new w("sandbox_re\
sponse_invalid","O Asaas respondeu em um formato inesperado. Reabra o perfil para conferir o andamento do teste.")}}}function Re(a,t=""){let n=a?.fields||{},r=j(
a,"providerStatus"),d=n.setupComplete?.booleanValue===!0,i=r==="RECEIVED",c=!!n.webhookAt?.timestampValue;return{environment:"sandbox",created:!!j(a,"paymentId"),
ready:d,status:r||"NOT_CREATED",received:i,webhookVerified:c,testComplete:d&&i&&c,paymentId:j(a,"paymentId"),amount:Number(n.amountCents?.integerValue||500)/100,
payload:d?j(a,"payload"):"",encodedImage:d?j(a,"encodedImage"):"",expirationDate:j(a,"expirationDate"),message:t||(d&&i&&c?"Teste completo: o pagamento simulado\
 foi recebido e o retorno automático do Asaas foi validado. Nenhuma venda ou parcela foi alterada.":d&&i?"O Asaas indica recebimento. Aguardando o retorno auto\
mático autenticado.":r==="CONFIRMED"?"O Asaas confirmou a simulação. Aguardando o recebimento e o retorno automático.":d&&!["PENDING","OVERDUE","RECEIVED"].
includes(r)?"A cobrança de teste foi alterada no Asaas e não permite simular outro pagamento. Nenhuma venda ou parcela foi alterada.":d?"Cobrança de teste cri\
ada. Simule o pagamento para validar o retorno automático.":"Prepare uma cobrança isolada de R$ 5,00 no Sandbox. Nenhum valor real será movimentado.")}}function Ee(a,t){
if(!ge(a?.id)||j(t,"paymentId")&&a.id!==j(t,"paymentId")||a.customer!==j(t,"customerId")||a.externalReference!==j(t,"reference")||a.billingType!=="PIX"||a.value!==
Number(t?.fields?.amountCents?.integerValue||500)/100||typeof a.status!="string"||!/^[A-Z_]{3,64}$/.test(a.status))throw new w("sandbox_payment_mismatch","Os da\
dos da cobrança não correspondem ao teste. Nenhuma confirmação foi registrada.",409)}async function ta({request:a,user:t,env:n,current:r,headers:d,signal:i,
load:c,fetchGoogle:m,fetchAsaas:g,checkPath:A}){if(!r||r.fields.enabled?.booleanValue!==!0)throw new w("sandbox_disabled","Ative a conexão Asaas Sandbox no perf\
il antes de testar.",409);let _=await ue(n,t.uid,r.fields),C=await ve(n,"aura:sandbox-key:v1:"+_),h=A||"_asaas_sandbox_checks/"+t.uid,s=await c(h);j(s,"keyTag")!==
C&&(s=null);let D=new URL(a.url).pathname;if(a.method==="GET")return f(Re(s));if(a.body){let y=a.body.getReader();for(;;){let{value:x,done:k}=await y.read();if(k)
break;if(x.length)throw await y.cancel(),new w("invalid_body","O teste usa somente a cobrança preparada pelo sistema.",400)}}let P=Ke(g,_,i);if(D===he+"/simula\
te"){if(!s?.fields?.setupComplete?.booleanValue)throw new w("sandbox_not_ready","Prepare a cobrança de teste antes de simular o pagamento.",409);let y=j(s,"pay\
mentId"),x=await P("/payments/"+y);if(Ee(x,s),x.deleted===!0||!["PENDING","OVERDUE","CONFIRMED","RECEIVED"].includes(x.status))throw new w("sandbox_status_inval\
id","Esta cobrança não permite a simulação. Confira o status no painel Asaas Sandbox.",409);return["PENDING","OVERDUE"].includes(x.status)&&await P("/sandbo\
x/payment/"+y+"/confirm","POST"),f(Re(s,"Simulação enviada ao Asaas Sandbox. Aguarde o retorno automático nesta tela."))}if(!t.email)throw new w("sandbox_ema\
il_required","Sua conta precisa ter um e-mail válido para configurar o retorno do Asaas.",409);let I=await c(h);s=j(I,"keyTag")===C?I:null;let b=I?.updateTime||
"";if(s&&Date.parse(s.fields.leaseUntil?.timestampValue||"")>Date.now())throw new w("sandbox_busy","A preparação já está em andamento. Aguarde um minuto antes d\
e tentar novamente.",409);let O=async y=>{let x=new URLSearchParams(b?{"currentDocument.updateTime":b}:{"currentDocument.exists":"false"});for(let $ of Object.keys(
y))x.append("updateMask.fieldPaths",$);let k=await m(se+h+"?"+x,{method:"PATCH",headers:d,redirect:"manual",signal:i,body:JSON.stringify({fields:y})});if([409,412].
includes(k.status))throw new w("sandbox_changed","O teste mudou durante esta operação. Atualize a tela e tente novamente.",409);if(!k.ok)throw new w("sandbox_\
save_failed","Não foi possível salvar o andamento do teste. Aguarde um minuto e tente novamente.");let V=JSON.parse(await k.text());if(V?.name!=="projects/ven\
das-aura/databases/(default)/documents/"+h||!V.updateTime||!V.fields)throw new w("sandbox_save_failed","Não foi possível conferir o andamento do teste. Aguarde \
um minuto e tente novamente.");s=V,b=V.updateTime},E=new Date(Date.now()+9e4).toISOString();if(s)await O({leaseUntil:ye(E)});else{let y={keyTag:U(C),reference:U(
"aura-sandbox-"+crypto.randomUUID()),customerId:U(""),paymentId:U(""),webhookId:U(""),pendingCreate:U(""),providerStatus:U(""),payload:U(""),encodedImage:U(""),
expirationDate:U(""),setupComplete:He(!1),webhookAt:{nullValue:null},lastEventId:U(""),leaseUntil:ye(E)};await O(y)}try{let y=j(s,"reference"),x=async(e,o,l)=>{
let p=await P("/"+e+"?externalReference="+encodeURIComponent(o)+"&limit=2");if(!Array.isArray(p?.data)||p.data.length>1||p.hasMore===!0||p.data.some(u=>!l(u)))throw new w(
"sandbox_duplicates","Não foi possível identificar um único registro para este teste. Confira os registros de teste no Asaas Sandbox.",409);return p.data[0]||
null},k=async(e,o,l,p,u,T)=>{let N=await p();if(N){u(N),await O({...T(N),pendingCreate:U("")});return}if(j(s,"pendingCreate")===e)throw new w("sandbox_creation_\
unknown","Uma criação anterior ficou sem confirmação. O sistema evitou repetir a cobrança. Confira o painel Asaas Sandbox e envie esta mensagem para continuarmo\
s.",409);await O({pendingCreate:U(e)});let v;try{v=await P(o,"POST",l)}catch(M){throw M.definitive&&await O({pendingCreate:U("")}),M}u(v),await O({...T(v),pendingCreate:U(
"")})},V=ya+Ve+t.uid,$=await ve(n,"aura:sandbox-webhook:v1:"+t.uid),z={name:"Registro de Vendas - teste isolado",url:V,email:t.email,enabled:!0,interrupted:!1,authToken:$,
events:Xe,sendType:"SEQUENTIALLY",apiVersion:3},G=await P("/webhooks?limit=100");if(!Array.isArray(G?.data)||G.hasMore===!0)throw new w("sandbox_webhook_invalid",
"Não foi possível conferir os Webhooks da conta Sandbox.");let L=G.data.filter(e=>e.url===V);if(L.length>1||L.length&&!ge(L[0].id))throw new w("sandbox_webhoo\
k_invalid","Existe mais de um retorno para este teste. Confira os Webhooks no Asaas Sandbox.",409);if(L.length){let e=await P("/webhooks/"+L[0].id,"PUT",z);if(e?.
id!==L[0].id||e.url!==V)throw new w("sandbox_webhook_invalid","Não foi possível confirmar a configuração do retorno automático.");await O({webhookId:U(e.id),
...j(s,"pendingCreate")==="webhook"?{pendingCreate:U("")}:{}})}else await k("webhook","/webhooks",z,async()=>null,e=>{if(!ge(e?.id)||e.url!==V)throw new w("sand\
box_webhook_invalid","Não foi possível conferir o retorno automático.")},e=>({webhookId:U(e.id)}));if(j(s,"customerId")||await k("customer","/customers",{name:"\
Cliente Teste Registro de Vendas",cpfCnpj:"24971563792",notificationDisabled:!0,externalReference:y},()=>x("customers",y,o=>o.externalReference===y),o=>{if(!ge(
o?.id)||o.externalReference!==y||o.deleted===!0)throw new w("sandbox_customer_invalid","Não foi possível conferir o cliente fictício de teste.")},o=>({customerId:U(
o.id)})),!j(s,"paymentId")){let e=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date),
o=["year","month","day"].map(l=>e.find(p=>p.type===l)?.value).join("-");await k("payment","/payments",{customer:j(s,"customerId"),billingType:"PIX",value:Number(
s.fields.amountCents?.integerValue||500)/100,dueDate:o,description:"Teste isolado do Registro de Vendas - sem valor real",externalReference:y,interest:{value:0},
fine:{value:0},discount:{value:0}},()=>x("payments",y,l=>l.externalReference===y),l=>Ee(l,s),l=>({paymentId:U(l.id),providerStatus:U(l.status)}))}let W=await P(
"/payments/"+j(s,"paymentId"));if(Ee(W,s),W.deleted===!0)throw new w("sandbox_payment_deleted","A cobrança de teste foi excluída no Asaas Sandbox. Envie esta me\
nsagem para prepararmos outro teste.",409);let F={};if(!s.fields.setupComplete?.booleanValue){let e=await P("/payments/"+W.id+"/pixQrCode");if(typeof e?.payload!=
"string"||e.payload.length<30||e.payload.length>8192||typeof e.encodedImage!="string"||!/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(e.encodedImage)||e.encodedImage.
length>2e5||typeof e.expirationDate!="string"||e.expirationDate.length>64)throw new w("sandbox_qr_invalid","A cobrança existe, mas o Asaas ainda não retornou um\
 QR Code válido. Tente preparar o teste novamente.");F={payload:U(e.payload),encodedImage:U(e.encodedImage),expirationDate:U(e.expirationDate)}}return await O(
{...F,setupComplete:He(!0),providerStatus:U(W.status),leaseUntil:ye(new Date(0).toISOString())}),f(Re(s))}catch(y){try{await O({leaseUntil:ye(new Date(0).toISOString())})}catch{}
throw y}}async function wa(a,t,n,r,d,i){if(!/^[A-Za-z0-9_-]{1,128}$/.test(n))return f({code:"not_found"},404);if(a.method!=="POST")return f({code:"method_not_al\
lowed"},405);try{let c=a.headers.get("asaas-access-token")||"";if(!Te.test(c)||!Ze(c,await ve(t,"aura:sandbox-webhook:v1:"+n)))return f({code:"unauthorized"},401);
if(!(a.headers.get("Content-Type")||"").toLowerCase().startsWith("application/json"))return f({code:"invalid_body"},400);let m=a.body?.getReader(),g=[],A=0;if(!m)
return f({code:"invalid_body"},400);for(;;){let{value:s,done:D}=await m.read();if(D)break;if(A+=s.length,A>131072)return await m.cancel(),f({code:"invalid_body"},
413);g.push(s)}let _=new Uint8Array(A),C=0;for(let s of g)_.set(s,C),C+=s.length;let h;try{h=JSON.parse(new TextDecoder("utf-8",{fatal:!0}).decode(_))}catch{return f(
{code:"invalid_body"},400)}return!h||typeof h.id!="string"||h.id.length>200||!h.id||!ge(h.payment?.id)?f({code:"invalid_event"},400):Xe.includes(h.event)?await be(
t,r,!1,async(s,D)=>{let P={accept:"application/json","Content-Type":"application/json",Authorization:"Bearer "+s},I=L=>Ue(r,P,D,L),b="_asaas_sandbox_checks/"+n,
O=await I(b);if(!O||h.payment.id!==j(O,"paymentId"))return i.handleWebhook({user:{uid:n},event:h,env:t,headers:P,signal:D,load:I,fetchGoogle:r,fetchAsaas:d});if(j(
O,"lastEventId")===h.id)return f({accepted:!0});let E=await I("_asaas_integrations/"+n),y=await I("artifacts/vendas-aura-main/users/"+n+"/profile/info");if(!E?.
fields?.enabled?.booleanValue||y?.fields?.approved?.booleanValue!==!0||!["","active"].includes(y.fields.status?.stringValue||""))return f({accepted:!0});let x=await ue(
t,n,E.fields);if(j(O,"keyTag")!==await ve(t,"aura:sandbox-key:v1:"+x))return f({accepted:!0});let V=await Ke(d,x,D)("/payments/"+j(O,"paymentId"));Ee(V,O);let $={
providerStatus:U(V.deleted===!0?"DELETED":V.status),webhookAt:ye(new Date().toISOString()),lastEventId:U(h.id)},z=new URLSearchParams({"currentDocument.updateTi\
me":O.updateTime});for(let L of Object.keys($))z.append("updateMask.fieldPaths",L);if(!(await r(se+b+"?"+z,{method:"PATCH",headers:P,redirect:"manual",signal:D,
body:JSON.stringify({fields:$})})).ok)throw new w("sandbox_webhook_retry","Retorno ainda não registrado. Repetir entrega.",503);return f({accepted:!0})}):f({accepted:!0})}catch(c){
return f({code:c instanceof w?c.code:"sandbox_webhook_retry"},c instanceof w?c.status:503)}}async function na(a){if(!(a.headers.get("Content-Type")||"").toLowerCase().
startsWith("application/json"))throw new w("invalid_body","Envie a configuração em formato JSON.",400);let t=a.body?.getReader();if(!t)throw new w("invalid_bo\
dy","Informe a configuração da integração.",400);let n=0,r=[];for(;;){let{value:d,done:i}=await t.read();if(i)break;if(n+=d.byteLength,n>4096)throw await t.
cancel(),new w("invalid_body","A configuração enviada excedeu o tamanho permitido.",413);r.push(d)}try{let d=new Uint8Array(n),i=0;for(let m of r)d.set(m,i),i+=
m.length;let c=JSON.parse(new TextDecoder("utf-8",{fatal:!0}).decode(d));if(!c||typeof c!="object"||Array.isArray(c)||Object.keys(c).length===0||Object.keys(c).
some(m=>!["apiKey","enabled"].includes(m))||c.enabled!==void 0&&typeof c.enabled!="boolean"||c.apiKey!==void 0&&(typeof c.apiKey!="string"||c.apiKey.trim().length<
8||c.apiKey.trim().length>2048||/[^\x21-\x7e]/.test(c.apiKey.trim())))throw new Error("invalid_body");return c}catch{throw new w("invalid_body","Confira a chave\
 e a configuração enviadas.",400)}}async function Aa(a,t,n){let r=await t(Se+"/pix/addressKeys?status=ACTIVE&limit=1",{method:"GET",headers:{accept:"applicati\
on/json",access_token:a,"User-Agent":"RegistroDeVendas-Pix-Sandbox-Profile/1.0"},redirect:"manual",signal:n});if(!r.ok)throw new w("asaas_key_rejected",[401,403].
includes(r.status)?"O Asaas não aceitou esta chave. Confira se ela pertence ao Sandbox e continua ativa.":"O Asaas não concluiu o teste. Tente novamente.",502);
let d=JSON.parse(await r.text());if(!Array.isArray(d?.data))throw new w("asaas_response_invalid","O Asaas respondeu em um formato inesperado.",502);return d.data.
some(i=>i?.status==="ACTIVE")}function fe(a){let t=a?.fields||{};return{configured:!!a,enabled:t.enabled?.booleanValue===!0,environment:"sandbox",hasActivePixKey:t.
hasActivePixKey?.booleanValue===!0,checkedAt:t.checkedAt?.timestampValue||null,flowVersion:1,pendingCharges:Number(t.pendingCharges?.integerValue||0)}}async function va(a,t,n,r,d){
let i=a.headers.get("Origin"),c=typeof t.APP_ORIGIN=="string"&&t.APP_ORIGIN.trim()?t.APP_ORIGIN.trim():Qe,m=new URL(a.url).pathname;if(!i||i!==c)return f({code:"\
origin_denied",message:"Abra a integração pelo sistema de vendas."},403);let g={"Access-Control-Allow-Origin":i,Vary:"Origin"},A=C=>{for(let[h,s]of Object.entries(
g))C.headers.set(h,s);return C},_=m===we?["GET","PUT","DELETE"]:m===he?["GET","POST"]:[we+"/test",he+"/simulate"].includes(m)?["POST"]:d.methods(m);if(!_.length)
return A(f({code:"not_found",message:"Rota não encontrada."},404));if(a.method==="OPTIONS")return _.includes(a.headers.get("Access-Control-Request-Method")||"")?
new Response(null,{status:204,headers:{...Me,...g,"Access-Control-Allow-Methods":_.join(", "),"Access-Control-Allow-Headers":"Authorization, Content-Type","Acce\
ss-Control-Max-Age":"600"}}):A(f({code:"method_not_allowed",message:"Método não permitido."},405));if(!_.includes(a.method))return A(f({code:"method_not_allow\
ed",message:"Método não permitido."},405));try{let C=await aa(a,n),h=C.uid,s=a.method==="PUT"?await na(a):null,D=await be(t,n,!1,async(P,I)=>{let b={accept:"a\
pplication/json","Content-Type":"application/json",Authorization:"Bearer "+P},O="artifacts/vendas-aura-main/users/"+h+"/profile/info",E="_asaas_integrations/"+h,
y=e=>Ue(n,b,I,e),x=await y(O);if(x?.fields?.approved?.booleanValue!==!0||!["","active"].includes(x.fields.status?.stringValue||""))throw new w("account_not_appr\
oved","Sua conta precisa estar aprovada e ativa para configurar o Asaas.",403);let k=await y(E);if(d.matches(m))return d.handleRequest({request:a,user:C,env:t,current:k,
headers:b,signal:I,load:y,fetchGoogle:n,fetchAsaas:r});if(m===he||m===he+"/simulate")return ta({request:a,user:C,env:t,current:k,headers:b,signal:I,load:y,fetchGoogle:n,
fetchAsaas:r});if(Number(k?.fields?.pendingCharges?.integerValue||0)>0&&(a.method==="DELETE"||a.method==="PUT"&&(s.enabled===!1||s.apiKey!==void 0)))throw new w(
"pending_charges","Conclua ou cancele os testes pendentes no perfil antes de alterar a chave ou usar Pix manual.",409);let V=()=>new URLSearchParams(k?{"current\
Document.updateTime":k.updateTime}:{"currentDocument.exists":"false"}),$=async e=>{let o=V();for(let p of Object.keys(e))o.append("updateMask.fieldPaths",p);let l=await n(
se+E+"?"+o,{method:"PATCH",headers:b,redirect:"manual",signal:I,body:JSON.stringify({fields:e})});if([409,412].includes(l.status))throw new w("integration_chang\
ed","A configuração mudou durante esta operação. Atualize a tela e tente novamente.",409);if(!l.ok)throw new w("integration_save_failed","Não foi possível s\
alvar a integração. Tente novamente.")};if(a.method==="DELETE"){if(k){let e=await n(se+E+"?"+V(),{method:"DELETE",headers:b,redirect:"manual",signal:I});if([409,
412].includes(e.status))throw new w("integration_changed","A configuração mudou. Atualize a tela antes de remover.",409);if(!e.ok&&e.status!==404)throw new w(
"integration_delete_failed","Não foi possível remover a integração.")}return f({...fe(null),message:"Chave da integração removida."})}if(await _e(t),a.method===
"GET")return k&&await ue(t,h,k.fields),f(fe(k));let z=new Date().toISOString();if(a.method==="PUT"&&s.enabled===!1&&s.apiKey===void 0)return k?(await $({enabled:{
booleanValue:!1},updatedAt:{timestampValue:z}}),f({...fe(k),enabled:!1,message:"Pix manual selecionado. A chave da integração permanece protegida."})):f({...fe(
null),message:"Pix manual selecionado."});let G=s?.apiKey!==void 0?s.apiKey.trim():k?await ue(t,h,k.fields):"";if(!G)throw new w("asaas_key_required","Informe a\
 chave da API do Asaas Sandbox para conectar.",400);let L=await Aa(G,r,I),W={hasActivePixKey:{booleanValue:L},checkedAt:{timestampValue:z},updatedAt:{timestampValue:z}};
if(a.method==="PUT"){let e=await ea(t,h,G);Object.assign(W,{environment:{stringValue:"sandbox"},version:{integerValue:"1"},cipher:{stringValue:e.cipher},iv:{stringValue:e.
iv},enabled:{booleanValue:s.enabled!==!1}})}await $(W);let F=fe({fields:{...k?.fields||{},...W}});return f({...F,message:L?"Asaas Sandbox conectado. A chave est\
á salva e o teste foi concluído.":"Asaas Sandbox conectado. Falta cadastrar ou ativar uma chave Pix na conta de testes."})});return A(D)}catch(C){return A(f({
code:C instanceof w?C.code:"integration_unavailable",message:C instanceof w?C.message:"Não foi possível concluir a operação do Asaas. Tente novamente."},C instanceof
w?C.status:503))}}async function _a(a,t,n){let r=crypto.randomUUID(),d="probe-"+r,i="projects/vendas-aura/databases/(default)/documents/_pix_connection_check/"+
d,c="https://firestore.googleapis.com/v1/"+i,m={accept:"application/json","Content-Type":"application/json",Authorization:"Bearer "+t},g="criação",A=0,_=!1,C="";
async function h(D,P,I){A=0;let b=await a(P,{method:D,headers:m,redirect:"manual",signal:n,...I===void 0?{}:{body:JSON.stringify(I)}});if(!b.ok)throw A=b.status,
g==="criação"&&[400,401,403,404,409,429].includes(A)&&(_=!1),new Error("diagnostic_request_failed");return b}async function s(D,P,I=""){let b=JSON.parse(await D.
text());if(!b||b.name!==i||b.fields?.connectionTest?.booleanValue!==!0||b.fields?.probeId?.stringValue!==r||b.fields?.stage?.stringValue!==P||typeof b.updateTime!=
"string"||!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(b.updateTime)||I&&b.updateTime!==I)throw new Error("diagnostic_document_mismatch");C=b.updateTime}try{_=!0;let D=await h(
"POST",fa+"?documentId="+d,{fields:{connectionTest:{booleanValue:!0},probeId:{stringValue:r},stage:{stringValue:"created"}}});await s(D,"created"),g="atualizaçã\
o";let P=new URLSearchParams({"updateMask.fieldPaths":"stage","currentDocument.updateTime":C}),I=await h("PATCH",c+"?"+P,{fields:{stage:{stringValue:"updated"}}});
return await s(I,"updated"),g="leitura",await s(await h("GET",c),"updated",C),g="exclusão",await h("DELETE",c+"?"+new URLSearchParams({"currentDocument.updateT\
ime":C})),f({code:"firebase_write_connected",firebaseConnected:!0,firestoreWrite:!0,diagnosticCleaned:!0,message:"Teste completo do Firebase concluído. O Worker\
 criou, atualizou, leu e excluiu um registro de diagnóstico. As permissões de leitura e gravação estão funcionando. Nenhum dado de vendas foi alterado."})}catch(D){
let P=!_;if(C)try{let E=await a(c+"?"+new URLSearchParams({"currentDocument.updateTime":C}),{method:"DELETE",headers:m,redirect:"manual",signal:AbortSignal.timeout(
8e3)});P=E.ok||E.status===404}catch{}let I=D instanceof Error&&(D.name==="TimeoutError"||D.name==="AbortError"),b=A?" (HTTP "+A+")":I?" por tempo excedido":"",O=P?
" O registro temporário foi limpo ou não chegou a ser criado.":" Pode ter ficado um registro de diagnóstico: "+d+". Guarde esta mensagem para conferir a limp\
eza.";return f({code:"firebase_write_failed",step:g,diagnosticCleaned:P,message:"O teste parou na etapa de "+g+b+". Confira as permissões da conta de serviço no\
 Firebase. Não é necessário liberar as regras públicas do banco."+O},I?504:A===429?503:502)}}async function be(a,t,n=!1,r=null){if(typeof a.FIREBASE_SERVICE_ACCOUNT!=
"string"||!a.FIREBASE_SERVICE_ACCOUNT.trim())return f({code:"firebase_secret_required",message:"Cadastre o JSON completo no Secret FIREBASE_SERVICE_ACCOUNT da C\
loudflare e clique em Deploy."},503);let d;try{d=JSON.parse(a.FIREBASE_SERVICE_ACCOUNT)}catch{return f({code:"firebase_json_invalid",message:"O Secret FIREBASE_\
SERVICE_ACCOUNT não contém um JSON válido. Copie todo o conteúdo do arquivo baixado do Firebase, incluindo as chaves do início e do final."},503)}if(!d||d.
type!=="service_account"||typeof d.client_email!="string"||!/^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(d.client_email)||typeof d.private_key!="string")return f(
{code:"firebase_credentials_invalid",message:"O JSON não contém uma conta de serviço completa. Use o arquivo gerado em Contas de serviço → Gerar nova chave priv\
ada."},503);if(d.project_id!==De)return f({code:"firebase_project_mismatch",message:"A credencial precisa pertencer ao projeto vendas-aura. Gere a chave privada\
 nesse projeto e atualize o Secret."},503);let i;try{let c=d.private_key.replace(/\\n/g,`
`).trim();if(!c.startsWith("-----BEGIN PRIVATE KEY-----")||!c.endsWith("-----END PRIVATE KEY-----"))throw new Error("Invalid PKCS8");let m=Uint8Array.from(atob(
c.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"")),P=>P.charCodeAt(0)),g=await crypto.subtle.importKey("pkcs8",m,{name:"RSASSA-PKCS1-v1_\
5",hash:"SHA-256"},!1,["sign"]),A=new TextEncoder,_=Math.floor(Date.now()/1e3),C={alg:"RS256",typ:"JWT",...typeof d.private_key_id=="string"?{kid:d.private_key_id}:
{}},h={iss:d.client_email,scope:"https://www.googleapis.com/auth/datastore",aud:We,iat:_-30,exp:_+3300},s=de(A.encode(JSON.stringify(C)))+"."+de(A.encode(JSON.stringify(
h))),D=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",g,A.encode(s));i=s+"."+de(new Uint8Array(D))}catch{return f({code:"firebase_private_key_invalid",message:"Nã\
o foi possível ler a chave privada do Firebase. Atualize FIREBASE_SERVICE_ACCOUNT com o JSON completo, sem editar o campo private_key."},503)}try{let c=AbortSignal.
timeout(r?4e4:2e4),m=await t(We,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",accept:"application/json"},body:new URLSearchParams({
grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:i}).toString(),redirect:"manual",signal:c});if(!m.ok)return f({code:"firebase_auth_failed",message:"\
O Google não aceitou a credencial. Confira se a conta de serviço e a chave privada estão ativas e se o JSON foi copiado integralmente."},502);let g=JSON.parse(
await m.text());if(!g||typeof g.access_token!="string"||!g.access_token||/[\r\n]/.test(g.access_token))return f({code:"firebase_auth_response_invalid",message:"\
O Google não retornou um token válido para o teste. Tente novamente."},502);if(r)return await r(g.access_token,c);if(n)return _a(t,g.access_token,c);let A=await t(
ma,{method:"GET",headers:{accept:"application/json",Authorization:"Bearer "+g.access_token},redirect:"manual",signal:c});if(!A.ok)return f({code:"firebase_read_\
failed",message:{401:"O Firestore recusou a autenticação. Confira se a conta de serviço e a chave privada continuam ativas.",403:"A autenticação funcionou, m\
as o Firestore recusou a leitura. Confira se o Firestore está ativo e se a conta de serviço tem permissão de acesso. Não é necessário liberar as regras públicas\
 do banco.",404:"O banco Firestore padrão não foi encontrado no projeto vendas-aura. Confira o projeto e o banco usado pelo sistema.",429:"O Firebase limitou \
temporariamente as consultas. Aguarde e tente novamente."}[A.status]||"O Firestore não concluiu a consulta. Tente novamente mais tarde."},A.status===429?503:502);
let _=JSON.parse(await A.text());return!_||typeof _!="object"||Array.isArray(_)||_.error||_.documents!==void 0&&!Array.isArray(_.documents)?f({code:"firebase_re\
sponse_invalid",message:"O Firestore respondeu em um formato inesperado. Tente novamente."},502):f({code:"firebase_connected",firebaseConnected:!0,firestoreRead:!0,
mode:"read-only",projectId:De,message:"Conexão com o Firebase funcionando. A credencial foi aceita e a leitura do Firestore está autorizada no projeto vendas-au\
ra. Nenhum registro foi alterado. Use Testar gravação Firebase para conferir também a permissão de gravação."})}catch(c){return c instanceof w?f({code:c.code,
message:c.message},c.status):c instanceof Error&&(c.name==="TimeoutError"||c.name==="AbortError")?f({code:"firebase_timeout",message:"A consulta ao Firebase exc\
edeu "+(r?"40":"20")+" segundos. Aguarde um pouco e tente novamente."},504):c instanceof SyntaxError?f({code:"firebase_response_invalid",message:"O Google ou o \
Firestore não retornou uma resposta JSON válida. Tente novamente."},502):f({code:"firebase_connection_failed",message:"Não foi possível concluir a conexão com\
 o Firebase. Tente novamente; se persistir, confira o painel da Cloudflare."},502)}}function Ca(a={}){let t=a.fetchAsaas||Ye,n=a.fetchGoogle||Ye,r=Ge({IntegrationError:w,
json:f,sandboxTag:ve,decryptAsaasKey:ue,sandboxApi:Ke,handleSandboxCheck:ta,FIRESTORE_DOCUMENTS:se}),d=qe({IntegrationError:w,json:f,authenticatedUser:aa,checkFirebase:be,
loadPrivateDocument:Ue,encryptionKey:_e,base64url:de,decodeBase64url:Ae,integrationBody:na,DEFAULT_APP_ORIGIN:Qe,FIRESTORE_DOCUMENTS:se});return{async fetch(i,c={}){
let m=new URL(i.url);if(m.pathname===me||m.pathname.startsWith(me+"/"))return d(i,c,n,t);if(m.pathname.startsWith(Ve))return wa(i,c,m.pathname.slice(Ve.length),
n,t,r);if(m.pathname===we||m.pathname.startsWith(we+"/"))return va(i,c,n,t,r);if(i.method==="GET"&&m.pathname==="/")return ga();if(i.method==="GET"&&m.pathname===
"/health")return f({service:"registro-vendas-pix-testes",stage:"sandbox-charge-test",environment:"sandbox"});if(!["/api/setup/check","/api/setup/firebase-check",
"/api/setup/firebase-write-check","/api/setup/encryption-check"].includes(m.pathname))return f({code:"not_found",message:"Rota não encontrada."},404);if(i.method!==
"POST")return f({code:"method_not_allowed",message:"Use os botões de teste desta página."},405);let g=i.headers.get("Origin");if(g&&g!==m.origin||i.headers.get(
"Sec-Fetch-Site")==="cross-site")return f({code:"origin_denied",message:"Abra o teste pelo endereço do próprio Worker."},403);let A=typeof c.SETUP_TOKEN=="str\
ing"?c.SETUP_TOKEN.trim():"";if(!Te.test(A))return f({code:"setup_required",message:"Cadastre o código gerado nesta página no Secret SETUP_TOKEN da Cloudflare e\
 clique em Deploy."},503);let _=i.headers.get("X-Setup-Token")||"";if(!Te.test(_)||!Ze(_,A))return f({code:"unauthorized",message:"O código de configuração não \
confere com o Secret SETUP_TOKEN da Cloudflare."},401);if(m.pathname==="/api/setup/firebase-check")return be(c,n);if(m.pathname==="/api/setup/firebase-write-che\
ck")return be(c,n,!0);if(m.pathname==="/api/setup/encryption-check")return ba(c);if((typeof c.ASAAS_BASE_URL=="string"?c.ASAAS_BASE_URL.trim().replace(/\/+$/,""):
"")!==Se)return f({code:"sandbox_required",message:"Este código funciona somente em testes. Configure ASAAS_BASE_URL como https://api-sandbox.asaas.com/v3."},503);
let h=typeof c.ASAAS_API_KEY=="string"?c.ASAAS_API_KEY.trim():"";if(!h||/[\r\n]/.test(h))return f({code:"api_key_required",message:"Cadastre a chave de API do S\
andbox como Secret ASAAS_API_KEY e clique em Deploy."},503);try{let s=await t(`${Se}/pix/addressKeys?status=ACTIVE&limit=1`,{method:"GET",headers:{accept:"appli\
cation/json",access_token:h,"User-Agent":"RegistroDeVendas-Pix-Sandbox-Setup/1.0"},redirect:"manual",signal:AbortSignal.timeout(2e4)});if(!s.ok)return f({code:"\
asaas_unavailable",message:{401:"O Asaas não aceitou a chave de API. Confira se a chave é do Sandbox, está habilitada e foi copiada integralmente.",403:"O As\
aas recusou o acesso. Confira as permissões e eventuais restrições de IP da chave no Sandbox.",429:"O Asaas limitou temporariamente as consultas. Aguarde e t\
ente novamente."}[s.status]||"O Asaas não concluiu a consulta. Tente novamente mais tarde."},s.status===429?503:502);let D=JSON.parse(await s.text());if(!D||!Array.
isArray(D.data))return f({code:"invalid_response",message:"O Asaas respondeu em um formato inesperado. Tente novamente mais tarde."},502);let P=D.data.some(I=>I?.
status==="ACTIVE");return f({code:P?"ready_for_firebase":"pix_key_required",apiConnected:!0,hasActivePixKey:P,environment:"sandbox",message:P?"Conexão com o Asa\
as Sandbox funcionando. Existe uma chave Pix ativa de teste. Use os botões do Firebase para conferir também o acesso ao banco.":"Conexão com o Asaas Sandbox f\
uncionando. Falta cadastrar ou ativar uma chave Pix na conta de testes. Depois, repita este teste."})}catch(s){return s instanceof Error&&(s.name==="TimeoutErro\
r"||s.name==="AbortError")?f({code:"asaas_timeout",message:"A consulta ao Asaas Sandbox excedeu 20 segundos. Aguarde um pouco e tente novamente."},504):s instanceof
SyntaxError?f({code:"invalid_response",message:"O Asaas não retornou uma resposta JSON válida. Tente novamente mais tarde."},502):f({code:"connection_failed",
message:"Não foi possível consultar o Asaas Sandbox. Tente novamente; se persistir, confira o painel da Cloudflare."},502)}}}}var Na=Ca();export{Ca as createWorker,Na as default};
