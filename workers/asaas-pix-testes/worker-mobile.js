// Registro de Vendas - Worker Sandbox 103 compacto. Gerado por build.mjs.
var Ee=t=>Number.isFinite(Number(t))?Number(t):0,se=class extends Error{constructor(a,o,r={}){super(o),this.name="FinancialCalculationError",this.code=a,this.details=
r}},B=t=>{let a=Ee(t),o=Math.sign(a||1)*Number.EPSILON*Math.max(1,Math.abs(a));return Math.round((a+o)*100)},z=t=>Math.round(Ee(t))/100,Ve=t=>z(B(t)),tt=(t=[],a=o=>o)=>z(
(Array.isArray(t)?t:[]).reduce((o,r,c)=>o+B(a(r,c)),0));var at=t=>t?typeof t?.toDate=="function"?t.toDate().toISOString().slice(0,10):typeof t?.seconds=="number"?new Date(t.seconds*1e3).toISOString().slice(0,10):String(
t).split("T")[0]:"";var Me=t=>t?.saleType==="prazo"||!t?.saleType;var nt=t=>{if(Ee(t?.originalAmount)>0)return Ve(t.originalAmount);let a=Math.max(0,B(t?.amount)),r=(Array.isArray(t?.history)?t.history:[]).reduce((c,i)=>c+Math.
max(0,B(i?.amount)),0);return z(a+r)};var ot=t=>(Array.isArray(t)?t:[]).map(a=>({...a,amount:Ve(a.amount),originalAmount:nt(a),history:Array.isArray(a.history)?a.history.map(o=>({...o})):[]})),Ue=(t,a,o,r,c=new Date().
toISOString())=>{let i=parseInt(a,10),d=ot(t),g=d[i],f=B(o),b=at(r);if(!g||g.paid||B(g.amount)<=0)throw new se("invalid-installment","A parcela selecionada não \
está mais disponível para pagamento.");if(f<=0||!b)throw new se("invalid-payment","Informe um valor e uma data de pagamento válidos.");let C=d.slice(i).reduce(
(h,k)=>h+(k.paid?0:Math.max(0,B(k.amount))),0);if(f>C)throw new se("payment-exceeds-balance",`O pagamento informado é maior que o saldo restante do contrato (${z(
C).toFixed(2).replace(".",",")}).`);let w=Math.max(0,B(g.amount)),v=Math.min(f,w),s=f-v,P=[];for(let h=i+1;s>0&&h<d.length;h+=1){let k=d[h];if(k.paid)continue;let U=Math.
max(0,B(k.amount));if(U<=0)continue;let I=Math.min(U,s),M=U-I;k.amount=z(M),k.paid=M===0,k.paidAt=k.paid?b:null,k.paidAtDateTime=k.paid?c:null,k.history.push({date:b,
amount:z(I),type:"abatement",fromInstallment:i,sourceTimestamp:c,timestamp:c}),P.push({installmentIndex:h,amount:z(I)}),s-=I}let T=w-v,S={date:b,amount:z(v),type:f<
w?"partial":f===w?"full":"full_surplus",timestamp:c};return f>w&&(S.surplus=z(f-w),S.allocations=P),g.history.push(S),g.amount=z(T),g.paid=T===0,g.paidAt=g.paid?
b:null,g.paidAtDateTime=g.paid?c:null,{installments:d,historyItem:S,allocations:P,paidAmount:z(f),remainingBalance:tt(d.filter(h=>!h.paid),h=>h.amount),allPaid:d.
every(h=>h.paid||B(h.amount)<=0)}};var Z=class extends Error{constructor(a,o,r={}){super(o),this.name="InventoryReliabilityError",this.code=a,this.details=r}},rt=(t,a)=>{let o=Number(t);if(!Number.
isInteger(o)||o<=0)throw new Z("invalid-quantity",`${a||"Produto"}: informe uma quantidade inteira maior que zero.`);return o},Ke=(t=[])=>{if(!Array.isArray(t)||
t.length===0)throw new Z("empty-sale","Adicione pelo menos um produto antes de concluir a venda.");let a=new Map;for(let o of t){if(!o?.productId)throw new Z("i\
nvalid-product","Um item da venda não está vinculado a um produto válido. Atualize a página e tente novamente.");let r=String(o.productId),c=String(o.productName||
o.name||"Produto"),i=rt(o.quantity,c),d=a.get(r);d?d.requestedQuantity+=i:a.set(r,{productId:r,productName:c,requestedQuantity:i})}return[...a.values()]},je=(t=[],a=[])=>{
let o=new Map((Array.isArray(a)?a:[]).map(r=>[String(r.productId),r]));return t.map(r=>{let c=o.get(String(r.productId));if(!c)throw new Z("product-not-found",`${r.
productName}: o produto não foi encontrado. Atualize a página e tente novamente.`,{productId:r.productId});let i=Number(c.quantity);if(!Number.isInteger(i)||i<
0)throw new Z("invalid-stock",`${r.productName}: o saldo de estoque está inválido e precisa ser corrigido.`,{productId:r.productId,currentQuantity:i});if(r.requestedQuantity>
i)throw new Z("insufficient-stock",`${r.productName}: estoque disponível é ${i} un., mas a venda solicita ${r.requestedQuantity} un.`,{productId:r.productId,currentQuantity:i,
requestedQuantity:r.requestedQuantity});return{productId:r.productId,productName:r.productName,previousQuantity:i,requestedQuantity:r.requestedQuantity,newQuantity:i-
r.requestedQuantity}})};var Y="/api/integrations/asaas/flow/charges",ie=/^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/,Fe=/^[A-Za-z0-9_-]{1,128}$/,$=t=>[
"creating","pending"].includes(t),D=t=>({stringValue:t}),ae=t=>({integerValue:String(t)}),$e=t=>({booleanValue:t}),Se=t=>({timestampValue:t}),A=(t,a)=>t?.fields?.[a]?.
stringValue||"",G=(t,a)=>Number(t?.fields?.[a]?.integerValue||0),Te=t=>JSON.stringify(t,(a,o)=>o&&typeof o=="object"&&!Array.isArray(o)?Object.fromEntries(Object.
keys(o).sort().map(r=>[r,o[r]])):o),Ie=(t,a=0)=>{if(a>20)throw new Error("invalid_document");if("stringValue"in t)return t.stringValue;if("booleanValue"in t)return t.
booleanValue;if("integerValue"in t)return Number(t.integerValue);if("doubleValue"in t)return Number(t.doubleValue);if("timestampValue"in t)return t.timestampValue;
if("nullValue"in t)return null;if(t.arrayValue)return(t.arrayValue.values||[]).map(o=>Ie(o,a+1));if(t.mapValue)return Object.fromEntries(Object.entries(t.mapValue.
fields||{}).map(([o,r])=>[o,Ie(r,a+1)]));throw new Error("invalid_document")},ke=t=>Object.fromEntries(Object.entries(t?.fields||{}).map(([a,o])=>[a,Ie(o)])),ye=(t,a)=>!!t&&
typeof t=="object"&&!Array.isArray(t)&&Object.keys(t).every(o=>a.includes(o));function Le(t){let{IntegrationError:a,json:o,sandboxTag:r,decryptAsaasKey:c,sandboxApi:i,
handleSandboxCheck:d,FIRESTORE_DOCUMENTS:g}=t,f=e=>"projects/vendas-aura/databases/(default)/documents/"+e,b=e=>"_asaas_flow_sandbox/"+e,C=(e,n)=>b(e)+"/orders/"+
n,w=(e,n)=>b(e)+"/pending/"+n,v=(e,n)=>b(e)+"/receipts/"+n,s=(e,n,l=409)=>{throw new a(e,n,l)},P=(e,n)=>r(e,"aura:source-parcel:v1:"+Te({status:n.status||"activ\
e",installments:n.installments})),T=e=>((!e||e.fields.simulationOnly?.booleanValue!==!0||e.fields.flowVersion?.integerValue!=="1"||!ie.test(A(e,"id"))||!["check\
out","installment"].includes(A(e,"kind"))||!Number.isSafeInteger(G(e,"amountCents"))||G(e,"amountCents")<500)&&s("flow_invalid","Não foi possível conferir o reg\
istro de teste."),e),S=e=>{T(e);let n=A(e,"state"),l=A(e,"kind"),p=e.fields.setupComplete?.booleanValue===!0,u=JSON.parse(A(e,"resultJson")||"{}"),E={creating:"\
Preparando o Pix de teste. Se a operação for interrompida, retome este teste pelo perfil.",pending:"Aguardando o pagamento de teste. Use somente a simulação n\
o Sandbox.",received:l==="checkout"?"Venda de teste confirmada. Caixa e estoque reais não foram alterados.":"Parcela de teste recebida. A parcela original não \
foi alterada.",cancelled:"Cobrança de teste cancelada. Nenhum registro real foi alterado.",refunded:"Reembolso conferido no Sandbox. O resultado da simulação f\
oi estornado.",review:"A origem ou o status mudou durante o teste. Confira a cobrança no Asaas Sandbox. Nenhuma baixa real foi realizada."};return{environment:"\
sandbox",simulationOnly:!0,id:A(e,"id"),kind:l,state:n,amountCents:G(e,"amountCents"),providerStatus:A(e,"providerStatus"),ready:p,payload:$(n)&&p?A(e,"payload"):
"",encodedImage:$(n)&&p?A(e,"encodedImage"):"",receiptId:A(e,"receiptId"),confirmationSource:A(e,"confirmationSource"),summary:{receivedCents:u.receivedCents||0,
remainingCents:u.remainingCents||0,stockUnits:u.stockUnits||0,installmentPaid:u.installmentPaid===!0},message:E[n]||"Confira o andamento da cobrança de teste."}},
h=(e,n,l)=>({update:{name:f(e),fields:l},updateMask:{fieldPaths:Object.keys(l)},currentDocument:n?{updateTime:n.updateTime}:{exists:!1}}),k=(e,n)=>({delete:f(e),
currentDocument:{updateTime:n.updateTime}}),U=async(e,n)=>{for(let u of n){let E=u.update?.name||u.delete;if(!(E.startsWith(f(b(e.user.uid)+"/"))||E===f("_asaas\
_integrations/"+e.user.uid)))throw new Error("unsafe_write")}let l=await e.fetchGoogle(g.slice(0,-1)+":commit",{method:"POST",headers:e.headers,redirect:"manual",
signal:e.signal,body:JSON.stringify({writes:n})});[409,412].includes(l.status)&&s("flow_conflict","O teste mudou durante esta operação. Consulte o andamento e t\
ente novamente."),l.ok||s("flow_save_failed","Não foi possível salvar o teste. Consulte o andamento antes de repetir.",503);let p=JSON.parse(await l.text());(!Array.
isArray(p.writeResults)||p.writeResults.length!==n.length)&&s("flow_save_failed","A gravação do teste não foi confirmada. Consulte o andamento antes de repetir.",
503)},I=async(e,n)=>{let l=await e.load("_asaas_integrations/"+e.user.uid),p=await e.load(w(e.user.uid,A(n,"id"))),u=G(l,"pendingCharges");(!l||!p||!Number.isSafeInteger(
u)||u<1)&&s("flow_state_conflict","O andamento do teste precisa ser conferido antes de confirmar.",503);let E=[h("_asaas_integrations/"+e.user.uid,l,{pendingCharges:ae(
u-1)}),k(w(e.user.uid,A(n,"id")),p)];if(A(n,"sourceSlot")){let x=b(e.user.uid)+"/slots/"+A(n,"sourceSlot"),_=await e.load(x);(!_||A(_,"orderId")!==A(n,"id"))&&s(
"flow_state_conflict","Não foi possível conferir a reserva da parcela de teste.",503),E.push(k(x,_))}return E},M=async e=>{(e.headers.get("Content-Type")||"").
toLowerCase().startsWith("application/json")||s("invalid_body","Envie os dados do teste em JSON.",400);let n=e.body?.getReader();n||s("invalid_body","Informe os\
 dados do teste.",400);let l=[],p=0;for(;;){let{value:x,done:_}=await n.read();if(_)break;p+=x.length,p>12288&&(await n.cancel(),s("invalid_body","O pedido de t\
este excedeu o tamanho permitido.",413)),l.push(x)}let u=new Uint8Array(p),E=0;for(let x of l)u.set(x,E),E+=x.length;try{return JSON.parse(new TextDecoder("utf-\
8",{fatal:!0}).decode(u))}catch{s("invalid_body","Confira os dados do pedido de teste.",400)}},N=async e=>{let n=e.body?.getReader();if(n)for(;;){let{value:l,done:p}=await n.
read();if(p)return;l.length&&(await n.cancel(),s("invalid_body","Esta ação usa somente a cobrança salva.",400))}},K=async e=>{e.current?.fields?.enabled?.booleanValue||
s("flow_disabled","Ative a conexão Asaas Sandbox no perfil antes de testar.");let n=await c(e.env,e.user.uid,e.current.fields);return{key:n,keyTag:await r(e.env,
"aura:sandbox-key:v1:"+n),api:i(e.fetchAsaas,n,e.signal)}},J=(e,n)=>{(e?.id!==A(n,"paymentId")||e.customer!==A(n,"customerId")||e.externalReference!==A(n,"refer\
ence")||e.billingType!=="PIX"||e.value!==z(G(n,"amountCents"))||typeof e.status!="string"||!/^[A-Z_]{3,64}$/.test(e.status))&&s("flow_payment_mismatch","A cobra\
nça não corresponde ao pedido de teste. Nenhuma baixa foi realizada.")},W=async(e,n)=>{if(n?.kind==="checkout"){(!ye(n,["kind","idempotencyKey","items"])||!/^[a-f0-9-]{36}$/.
test(n.idempotencyKey||"")||!ie.test(n.idempotencyKey)||!Array.isArray(n.items)||n.items.length<1||n.items.length>10)&&s("invalid_checkout","O teste do caixa ac\
eita de 1 a 10 itens válidos.",400);let l=n.items.map(_=>((!ye(_,["productId","quantity","lineTotalCents"])||!Fe.test(_.productId||"")||!Number.isSafeInteger(_.
quantity)||_.quantity<1||_.quantity>999||!Number.isSafeInteger(_.lineTotalCents)||_.lineTotalCents<_.quantity||_.lineTotalCents>5e6)&&s("invalid_checkout","Conf\
ira os produtos, as quantidades e os preços do carrinho de teste.",400),{productId:_.productId,quantity:_.quantity,lineTotalCents:_.lineTotalCents})),p=Ke(l),u=await Promise.
all(p.map(async _=>{let j=await e.load("artifacts/vendas-aura-main/users/"+e.user.uid+"/products/"+_.productId);j||s("product_not_found","Um produto do carrinho\
 não está mais disponível.");let O=ke(j);return{productId:_.productId,quantity:O.quantity,name:String(O.name||"Produto").slice(0,160),costPrice:O.costPrice}})),
E;try{E=je(p,u)}catch{s("invalid_stock","O estoque atual não permite esse carrinho de teste. Atualize as quantidades.")}let x=l.reduce((_,j)=>_+j.lineTotalCents,
0);return{id:n.idempotencyKey,amountCents:x,snapshot:{kind:"checkout",items:l,stockPlan:E,amountCents:x},request:{kind:n.kind,items:l}}}if(n?.kind==="installmen\
t"){(!ye(n,["kind","saleId","installmentIndex"])||!Fe.test(n.saleId||"")||!Number.isInteger(n.installmentIndex)||n.installmentIndex<0||n.installmentIndex>119)&&
s("invalid_installment","Confira a venda e a parcela de teste.",400);let l=await e.load("artifacts/vendas-aura-main/users/"+e.user.uid+"/sales/"+n.saleId);l||s(
"sale_not_found","A venda não foi encontrada.");let p=ke(l),u=p.installments?.[n.installmentIndex];(!Me(p)||p.status==="canceled"||!u||u.paid||B(u.amount)<=0)&&
s("installment_unavailable","Esta parcela não está mais disponível para o teste.");let E=await P(e.env,p),x=await r(e.env,"aura:installment-order:v1:"+e.user.
uid+":"+n.saleId+":"+n.installmentIndex+":"+E+":"+e.keyTag),_=(await r(e.env,"aura:parcel-slot:v1:"+n.saleId+":"+n.installmentIndex)).slice(0,32);return{id:x.slice(
0,32),sourceSlot:_,amountCents:B(u.amount),snapshot:{kind:"installment",installments:p.installments,installmentIndex:n.installmentIndex,saleId:n.saleId,sourceMarker:E},
request:{kind:n.kind,saleId:n.saleId,installmentIndex:n.installmentIndex,sourceMarker:E}}}s("invalid_kind","Escolha um teste do caixa ou de parcela.",400)},H=async e=>{
let n=await e.fetchGoogle(g+b(e.user.uid)+"/pending?pageSize=10",{method:"GET",headers:e.headers,redirect:"manual",signal:e.signal});n.ok||s("flow_list_failed",
"Não foi possível carregar os testes pendentes.",503);let l=JSON.parse(await n.text());(l.nextPageToken||l.documents!==void 0&&!Array.isArray(l.documents))&&s(
"flow_list_failed","Não foi possível conferir os testes pendentes.",503);let p=(l.documents||[]).map(u=>{let E=A(u,"id");return(!ie.test(E)||u.name!==f(w(e.user.
uid,E)))&&s("flow_list_failed","Não foi possível conferir um teste pendente.",503),{id:E,kind:A(u,"kind"),amountCents:G(u,"amountCents")}});return o({environment:"\
sandbox",simulationOnly:!0,orders:p})},F=async(e,n,l,p,u="")=>{T(n),J(l,n);let E=A(n,"state");if(u&&A(n,"lastEventId")===u)return n;let x=l.deleted!==!0&&l.status===
"RECEIVED",_=l.status==="REFUNDED",j=l.deleted===!0,O=E,q=JSON.parse(A(n,"resultJson")||"{}");if(x&&$(E)){let L=JSON.parse(A(n,"snapshotJson"));if(L.kind==="che\
ckout")q={receivedCents:G(n,"amountCents"),stockUnits:L.stockPlan.reduce((he,Ce)=>he+Ce.requestedQuantity,0),stockPlan:L.stockPlan,saleStatus:"completed"};else{
let he=await e.load("artifacts/vendas-aura-main/users/"+e.user.uid+"/sales/"+L.saleId);if(!he||await P(e.env,ke(he))!==L.sourceMarker)O="review";else{let Ce=new Date().
toISOString(),Qe=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date),Xe=["year",
"month","day"].map(Ze=>Qe.find(et=>et.type===Ze)?.value).join("-"),te=Ue(L.installments,L.installmentIndex,z(G(n,"amountCents")),Xe,Ce);te.historyItem.provider=
"asaas-sandbox",te.historyItem.providerPaymentId=l.id,q={receivedCents:G(n,"amountCents"),remainingCents:B(te.remainingBalance),installmentPaid:te.installments[L.
installmentIndex].paid,installments:te.installments,saleStatus:te.allPaid?"completed":"active"}}}O!=="review"&&(O="received")}else _&&(E==="received"||$(E))?(O=
"refunded",q={receivedCents:0,refundedCents:G(n,"amountCents")}):x&&!["received","review"].includes(E)||j&&l.status==="RECEIVED"&&$(E)?O="review":j&&$(E)&&(O="c\
ancelled");if(O===E&&!$(E))return n;let ee={state:D(O),providerStatus:D(j?"DELETED":l.status),lastEventId:D(u||A(n,"lastEventId")),updatedAt:Se(new Date().toISOString())},
X=[];if($(E)&&!$(O)&&X.push(...await I(e,n)),O!==E&&["received","refunded","review"].includes(O)){Object.assign(ee,{resultJson:D(JSON.stringify(q)),receiptId:D(
l.id),confirmationSource:D(p)});let L=await e.load(v(e.user.uid,l.id));O==="received"&&L&&s("flow_receipt_conflict","Este pagamento já possui um resultado salvo\
. Confira o andamento do teste.",503),X.push(h(v(e.user.uid,l.id),L,{orderId:D(A(n,"id")),paymentId:D(l.id),state:D(O),amountCents:ae(G(n,"amountCents")),simulationOnly:$e(
!0),resultJson:D(JSON.stringify(q))}))}return X.unshift(h(C(e.user.uid,A(n,"id")),n,ee)),await U(e,X),e.load(C(e.user.uid,A(n,"id")))};return{methods:e=>e===Y?[
"GET","POST"]:new RegExp("^"+Y+"/(?:[a-f0-9]{32}|[a-f0-9-]{36})(?:/(prepare|simulate|reconcile|cancel))?$").test(e)?e.slice(Y.length+1).includes("/")?["POST"]:[
"GET"]:[],matches:e=>e===Y||e.startsWith(Y+"/"),handleRequest:async e=>{let n=new URL(e.request.url).pathname;if(n===Y&&e.request.method==="GET")return H(e);let l=await K(
e);Object.assign(e,l);let p,u;if(n===Y){let _=await M(e.request),j=await e.load("_asaas_sandbox_checks/"+e.user.uid);if((A(j,"keyTag")!==e.keyTag||A(j,"provider\
Status")!=="RECEIVED"||!j?.fields?.webhookAt?.timestampValue)&&s("flow_diagnostic_required","Conclua primeiro o teste de cobrança e retorno automático no perfil\
."),_?.kind==="checkout"&&ie.test(_.idempotencyKey||"")&&(u=await e.load(C(e.user.uid,_.idempotencyKey)),u)){let q=await r(e.env,"aura:flow-request:v1:"+Te({kind:_.
kind,items:_.items}));(!ye(_,["kind","idempotencyKey","items"])||q!==A(u,"requestHash"))&&s("flow_intent_changed","Este teste pertence a outro carrinho. Abra um\
a nova cobrança de teste.")}let O;if(u||(O=await W(e,_)),p=u?A(u,"id"):O.id,O?.sourceSlot){let q=await e.load(b(e.user.uid)+"/slots/"+O.sourceSlot);q&&A(q,"ord\
erId")!==p&&s("flow_installment_pending","Já existe um teste pendente desta parcela. Retome ou cancele esse teste pelo perfil.")}if(u||(u=await e.load(C(e.user.
uid,p))),!u){(O.amountCents<500||O.amountCents>5e6)&&s("flow_amount_invalid","Neste teste, o valor deve ficar entre R$ 5,00 e R$ 50.000,00.",400);let q=JSON.stringify(
O.snapshot);new TextEncoder().encode(q).length>64e3&&s("flow_snapshot_large","Este contrato é muito grande para o teste. Escolha outra parcela.",400);let ee=await e.
load("_asaas_integrations/"+e.user.uid);(!ee?.fields?.enabled?.booleanValue||await r(e.env,"aura:sandbox-key:v1:"+await c(e.env,e.user.uid,ee.fields))!==e.keyTag)&&
s("flow_credential_changed","A conexão mudou. Reabra o perfil antes de gerar o teste.");let X=G(ee,"pendingCharges");(!Number.isInteger(X)||X<0||X>=5)&&s("flow\
_pending_limit","Conclua ou cancele os testes pendentes no perfil antes de criar outro.");let De={id:D(p),kind:D(_.kind),state:D("creating"),amountCents:ae(O.amountCents),
snapshotJson:D(q),requestHash:D(await r(e.env,"aura:flow-request:v1:"+Te(O.request))),keyTag:D(e.keyTag),reference:D("aura-flow-"+p),simulationOnly:$e(!0),flowVersion:ae(
1),sourceSlot:D(O.sourceSlot||""),createdAt:Se(new Date().toISOString()),leaseUntil:Se(new Date(0).toISOString())},L=[h(C(e.user.uid,p),null,De),h(w(e.user.uid,
p),null,{id:D(p),kind:D(_.kind),amountCents:ae(O.amountCents)}),h("_asaas_integrations/"+e.user.uid,ee,{pendingCharges:ae(X+1)})];O.sourceSlot&&L.push(h(b(e.user.
uid)+"/slots/"+O.sourceSlot,null,{orderId:D(p)})),await U(e,L),u=await e.load(C(e.user.uid,p))}}else p=n.slice(Y.length+1).split("/")[0],u=await e.load(C(e.user.
uid,p)),u||s("flow_not_found","A cobrança de teste não foi encontrada.",404);if(T(u),e.request.method==="GET")return o(S(u));A(u,"keyTag")!==e.keyTag&&s("flow\
_credential_changed","Este teste pertence à conexão anterior. Confira a cobrança no Asaas Sandbox.");let E=n.slice(Y.length+1+p.length+1);if(n!==Y&&await N(e.
request),n===Y||E==="prepare"){if(!$(A(u,"state")))return o(S(u));let _=new Request("https://worker.internal/api/integrations/asaas/sandbox-charge",{method:"POS\
T"});if(await d({...e,request:_,checkPath:C(e.user.uid,p)}),u=await e.load(C(e.user.uid,p)),$(A(u,"state"))){let j=b(e.user.uid)+"/payments/"+A(u,"paymentId"),O=await e.
load(j);await U(e,[h(C(e.user.uid,p),u,{state:D("pending")}),h(j,O,{orderId:D(p)})])}return o(S(await e.load(C(e.user.uid,p))))}if(E==="simulate"){if(!$(A(u,"st\
ate")))return o(S(u));let _=new Request("https://worker.internal/api/integrations/asaas/sandbox-charge/simulate",{method:"POST"});return await d({...e,request:_,
checkPath:C(e.user.uid,p)}),o({...S(await e.load(C(e.user.uid,p))),message:"Simulação enviada. Aguarde a confirmação automática do Asaas."})}if(!A(u,"payme\
ntId")){if(E==="cancel"&&$(A(u,"state"))&&A(u,"pendingCreate")!=="payment")return await U(e,[h(C(e.user.uid,p),u,{state:D("cancelled")}),...await I(e,u)]),o(S(await e.
load(C(e.user.uid,p))));s("flow_not_prepared","Retome a preparação deste teste antes de conferir ou cancelar.")}let x=await e.api("/payments/"+A(u,"paymentId"));
return J(x,u),E==="cancel"&&$(A(u,"state"))&&x.deleted!==!0&&x.status==="CONFIRMED"&&s("flow_cancellation_blocked","O Asaas ainda está analisando a cobrança. Ag\
uarde a conclusão para confirmar ou cancelar o teste."),E==="cancel"&&$(A(u,"state"))&&x.deleted!==!0&&["PENDING","OVERDUE"].includes(x.status)&&(await e.api("\
/payments/"+x.id,"DELETE"),x=await e.api("/payments/"+x.id),J(x,u),x.deleted!==!0&&!["RECEIVED","REFUNDED"].includes(x.status)&&s("flow_cancel_unknown","O cance\
lamento ainda não foi confirmado pelo Asaas. Confira o andamento antes de repetir.")),o(S(await F(e,u,x,"reconciliation")))},handleWebhook:async e=>{let n=e.event.
payment.externalReference,l=await e.load(b(e.user.uid)+"/payments/"+e.event.payment.id),p=l?A(l,"orderId"):typeof n=="string"&&n.startsWith("aura-flow-")?n.slice(
10):"";if(!ie.test(p))return o({accepted:!0});let u=await e.load(C(e.user.uid,p));if(!u)return o({accepted:!0});if(T(u),A(u,"paymentId")||s("flow_webhook_retry",
"A cobrança ainda está sendo registrada. Repetir entrega.",503),A(u,"paymentId")!==e.event.payment.id)return o({accepted:!0});e.current=await e.load("_asaas_i\
ntegrations/"+e.user.uid);let E=await e.load("artifacts/vendas-aura-main/users/"+e.user.uid+"/profile/info");if(E?.fields?.approved?.booleanValue!==!0||!["","ac\
tive"].includes(E.fields.status?.stringValue||"")||!e.current?.fields?.enabled?.booleanValue)return o({accepted:!0});if(Object.assign(e,await K(e)),A(u,"keyTag")!==
e.keyTag)return o({accepted:!0});let x=await e.api("/payments/"+e.event.payment.id);try{await F(e,u,x,"webhook",e.event.id)}catch(_){throw _.code==="flow_confli\
ct"&&s("flow_webhook_retry","O teste mudou. Repetir entrega.",503),_}return o({accepted:!0})}}}var be="https://api-sandbox.asaas.com/v3",we=/^[a-f0-9]{64}$/i,Pe="vendas-aura",ze="https://oauth2.googleapis.com/token",st="https://firestore.googleapis.com/v1\
/projects/vendas-aura/databases/(default)/documents/_pix_connection_check?pageSize=1&mask.fieldPaths=connectionTest",it="https://firestore.googleapis.com/v1/pro\
jects/vendas-aura/databases/(default)/documents/_pix_connection_check",ne="https://firestore.googleapis.com/v1/projects/vendas-aura/databases/(default)/document\
s/",ct="AIzaSyDQQcD2tzsVS8Xzy-GpHT897kB7EC-S8Ng",dt="https://washingtonbarbalho.github.io",me="/api/integrations/asaas",de=me+"/sandbox-charge",Oe="/api/webhook\
s/asaas/sandbox/",ut="https://registro-vendas-pix-testes.washington-wn8.workers.dev",qe=["PAYMENT_CONFIRMED","PAYMENT_RECEIVED","PAYMENT_REFUNDED","PAYMENT_DELE\
TED","PAYMENT_OVERDUE","PAYMENT_RESTORED","PAYMENT_UPDATED"],Be=(t,a)=>fetch(t,a),Ne={"Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type\
-Options":"nosniff","X-Frame-Options":"DENY","Permissions-Policy":"camera=(), microphone=(), geolocation=()","Strict-Transport-Security":"max-age=31536000"};function m(t,a=200){
return new Response(JSON.stringify(t),{status:a,headers:{...Ne,"Content-Type":"application/json; charset=utf-8"}})}function Ge(t,a){let o=t.length^a.length;for(let r=0;r<
64;r+=1)o|=(t.charCodeAt(r)||0)^(a.charCodeAt(r)||0);return o===0}function lt(){return new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><t\
itle>Registro de Vendas · Asaas Sandbox</title><main style="max-width:560px;margin:40px auto;padding:24px;font:16px/1.5 system-ui"><h1>Asaas Sandbox · Etapa 6</\
h1><p>Worker de testes atualizado. Abra Meu Perfil no sistema para conferir a conexão e retomar cobranças do caixa ou das parcelas.</p><p>Os testes usam cópias \
separadas. Vendas, parcelas e estoque reais não são alterados.</p><a href="https://washingtonbarbalho.github.io/registrodevendas/?v=103">Abrir o sistema</a></ma\
in></html>',{headers:{...Ne,"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none';\
 frame-ancestors 'none'"}})}function le(t){return btoa(String.fromCharCode(...t)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}var y=class extends Error{constructor(a,o,r=503){
super(o),this.code=a,this.status=r}};function Ae(t){if(typeof t!="string"||!/^[A-Za-z0-9_-]+$/.test(t))throw new Error("invalid_base64url");let a=t.replace(/-/g,
"+").replace(/_/g,"/");return Uint8Array.from(atob(a+"=".repeat((4-a.length%4)%4)),o=>o.charCodeAt(0))}async function _e(t){if(typeof t.PIX_ENCRYPTION_KEY!="str\
ing"||!we.test(t.PIX_ENCRYPTION_KEY.trim()))throw new y("integration_setup_required","A proteção da integração ainda precisa ser configurada pelo administrador.");
let a=Uint8Array.from(t.PIX_ENCRYPTION_KEY.trim().match(/../g)||[],o=>parseInt(o,16));return crypto.subtle.importKey("raw",a,"AES-GCM",!1,["encrypt","decrypt"])}
async function We(t,a,o){let r=crypto.getRandomValues(new Uint8Array(12)),c=new TextEncoder().encode("vendas-aura:asaas:sandbox:v1:"+a),i=await crypto.subtle.encrypt(
{name:"AES-GCM",iv:r,additionalData:c},await _e(t),new TextEncoder().encode(o));return{cipher:le(new Uint8Array(i)),iv:le(r)}}async function oe(t,a,o){if(o.environment?.
stringValue!=="sandbox"||o.version?.integerValue!=="1")throw new y("integration_format_invalid","A configuração salva precisa ser refeita.");try{let r=Ae(o.iv?.
stringValue);if(r.length!==12)throw new Error("invalid_iv");let c=new TextEncoder().encode("vendas-aura:asaas:sandbox:v1:"+a),i=await crypto.subtle.decrypt({name:"\
AES-GCM",iv:r,additionalData:c},await _e(t),Ae(o.cipher?.stringValue));return new TextDecoder("utf-8",{fatal:!0}).decode(i)}catch(r){throw r instanceof y?r:new y(
"integration_key_unreadable","Não foi possível abrir a chave salva. Confira a configuração de proteção antes de substituir a integração.")}}async function pt(t){
try{let a=crypto.randomUUID(),o=await We(t,"diagnostic-only",a);if(await oe(t,"diagnostic-only",{environment:{stringValue:"sandbox"},version:{integerValue:"1"},
cipher:{stringValue:o.cipher},iv:{stringValue:o.iv}})!==a)throw new Error("encryption_check_failed");return m({code:"encryption_ready",encryptionReady:!0,message:"\
Proteção configurada e testada. O Worker consegue proteger e recuperar as chaves das integrações. A próxima etapa é conectar o Asaas Sandbox pelo perfil do sist\
ema."})}catch(a){return m({code:"encryption_setup_required",message:a instanceof y?"Cadastre a chave gerada nesta página como Secret PIX_ENCRYPTION_KEY e clique\
 em Deploy.":"Não foi possível validar a proteção. Confira o Secret PIX_ENCRYPTION_KEY."},503)}}async function mt(t,a){let o=t.headers.get("Authorization")||
"",r=o.startsWith("Bearer ")?o.slice(7):"",c=()=>new y("login_required","Entre novamente no sistema para configurar o Asaas.",401);if(!r||r.length>8192)throw c();
let i;try{let b=r.split(".");if(b.length!==3)throw c();let C=JSON.parse(new TextDecoder().decode(Ae(b[0])));i=JSON.parse(new TextDecoder().decode(Ae(b[1])));let w=Date.
now()/1e3;if(C.alg!=="RS256"||i.aud!==Pe||i.iss!=="https://securetoken.google.com/vendas-aura"||typeof i.sub!="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(i.sub)||!Number.
isFinite(i.exp)||i.exp<=w||!Number.isFinite(i.iat)||i.iat>w+60||!Number.isFinite(i.auth_time)||i.auth_time>w+60)throw c()}catch{throw c()}let d=await a("https:/\
/identitytoolkit.googleapis.com/v1/accounts:lookup?key="+ct,{method:"POST",headers:{"Content-Type":"application/json",accept:"application/json"},body:JSON.stringify(
{idToken:r}),redirect:"manual",signal:AbortSignal.timeout(1e4)});if(!d.ok)throw[400,401].includes(d.status)?c():new y("login_check_unavailable","Não foi possíve\
l validar seu acesso. Tente novamente.");let g=JSON.parse(await d.text()),f=Array.isArray(g?.users)&&g.users.length===1?g.users[0]:null;if(!f||f.localId!==i.sub||
f.disabled===!0||Number(f.validSince||0)>i.auth_time)throw c();return{uid:f.localId,email:typeof f.email=="string"&&f.email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.
test(f.email)?f.email:""}}async function Ye(t,a,o,r){let c=await t(ne+r,{method:"GET",headers:a,redirect:"manual",signal:o});if(c.status===404)return null;if(!c.
ok)throw new y("integration_read_failed","Não foi possível carregar a configuração da integração.");let i=JSON.parse(await c.text());if(i?.name!=="project\
s/vendas-aura/databases/(default)/documents/"+r||!i.fields||typeof i.fields!="object"||Array.isArray(i.fields)||typeof i.updateTime!="string"||!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.
test(i.updateTime))throw new y("integration_read_failed","Não foi possível conferir a configuração salva.");return i}async function fe(t,a){await _e(t);let o=Uint8Array.
from(t.PIX_ENCRYPTION_KEY.trim().match(/../g)||[],i=>parseInt(i,16)),r=await crypto.subtle.importKey("raw",o,{name:"HMAC",hash:"SHA-256"},!1,["sign"]),c=await crypto.
subtle.sign("HMAC",r,new TextEncoder().encode(a));return Array.from(new Uint8Array(c),i=>i.toString(16).padStart(2,"0")).join("")}var R=t=>({stringValue:t}),ue=t=>({
timestampValue:t}),Je=t=>({booleanValue:t}),V=(t,a)=>t?.fields?.[a]?.stringValue||"",pe=t=>typeof t=="string"&&/^[A-Za-z0-9_-]{5,128}$/.test(t);function Re(t,a,o){
return async(r,c="GET",i)=>{let d=await t(be+r,{method:c,redirect:"manual",signal:o,headers:{accept:"application/json",access_token:a,"User-Agent":"RegistroDeVe\
ndas-Pix-Sandbox/2.0",...i===void 0?{}:{"Content-Type":"application/json"}},...i===void 0?{}:{body:JSON.stringify(i)}});if(!d.ok){let g=new y("sandbox_provider_\
failed",[401,403].includes(d.status)?"O Asaas recusou o acesso. Confira as permissões da chave Sandbox para clientes, cobranças e Webhooks.":d.status===400?"O\
 Asaas recusou os dados do teste. Confira se a conta Sandbox está aprovada e permite cobranças Pix e Webhooks.":"O Asaas não concluiu o teste. Aguarde um pouc\
o e tente novamente.",502);throw g.definitive=[400,401,403,404,422,429].includes(d.status),g}try{return JSON.parse(await d.text())}catch{throw new y("sandbox_re\
sponse_invalid","O Asaas respondeu em um formato inesperado. Reabra o perfil para conferir o andamento do teste.")}}}function xe(t,a=""){let o=t?.fields||{},r=V(
t,"providerStatus"),c=o.setupComplete?.booleanValue===!0,i=r==="RECEIVED",d=!!o.webhookAt?.timestampValue;return{environment:"sandbox",created:!!V(t,"paymentId"),
ready:c,status:r||"NOT_CREATED",received:i,webhookVerified:d,testComplete:c&&i&&d,paymentId:V(t,"paymentId"),amount:Number(o.amountCents?.integerValue||500)/100,
payload:c?V(t,"payload"):"",encodedImage:c?V(t,"encodedImage"):"",expirationDate:V(t,"expirationDate"),message:a||(c&&i&&d?"Teste completo: o pagamento simulado\
 foi recebido e o retorno automático do Asaas foi validado. Nenhuma venda ou parcela foi alterada.":c&&i?"O Asaas indica recebimento. Aguardando o retorno auto\
mático autenticado.":r==="CONFIRMED"?"O Asaas confirmou a simulação. Aguardando o recebimento e o retorno automático.":c&&!["PENDING","OVERDUE","RECEIVED"].
includes(r)?"A cobrança de teste foi alterada no Asaas e não permite simular outro pagamento. Nenhuma venda ou parcela foi alterada.":c?"Cobrança de teste cri\
ada. Simule o pagamento para validar o retorno automático.":"Prepare uma cobrança isolada de R$ 5,00 no Sandbox. Nenhum valor real será movimentado.")}}function ge(t,a){
if(!pe(t?.id)||V(a,"paymentId")&&t.id!==V(a,"paymentId")||t.customer!==V(a,"customerId")||t.externalReference!==V(a,"reference")||t.billingType!=="PIX"||t.value!==
Number(a?.fields?.amountCents?.integerValue||500)/100||typeof t.status!="string"||!/^[A-Z_]{3,64}$/.test(t.status))throw new y("sandbox_payment_mismatch","Os da\
dos da cobrança não correspondem ao teste. Nenhuma confirmação foi registrada.",409)}async function He({request:t,user:a,env:o,current:r,headers:c,signal:i,
load:d,fetchGoogle:g,fetchAsaas:f,checkPath:b}){if(!r||r.fields.enabled?.booleanValue!==!0)throw new y("sandbox_disabled","Ative a conexão Asaas Sandbox no perf\
il antes de testar.",409);let C=await oe(o,a.uid,r.fields),w=await fe(o,"aura:sandbox-key:v1:"+C),v=b||"_asaas_sandbox_checks/"+a.uid,s=await d(v);V(s,"keyTag")!==
w&&(s=null);let P=new URL(t.url).pathname;if(t.method==="GET")return m(xe(s));if(t.body){let I=t.body.getReader();for(;;){let{value:M,done:N}=await I.read();if(N)
break;if(M.length)throw await I.cancel(),new y("invalid_body","O teste usa somente a cobrança preparada pelo sistema.",400)}}let T=Re(f,C,i);if(P===de+"/simula\
te"){if(!s?.fields?.setupComplete?.booleanValue)throw new y("sandbox_not_ready","Prepare a cobrança de teste antes de simular o pagamento.",409);let I=V(s,"pay\
mentId"),M=await T("/payments/"+I);if(ge(M,s),M.deleted===!0||!["PENDING","OVERDUE","CONFIRMED","RECEIVED"].includes(M.status))throw new y("sandbox_status_inval\
id","Esta cobrança não permite a simulação. Confira o status no painel Asaas Sandbox.",409);return["PENDING","OVERDUE"].includes(M.status)&&await T("/sandbo\
x/payment/"+I+"/confirm","POST"),m(xe(s,"Simulação enviada ao Asaas Sandbox. Aguarde o retorno automático nesta tela."))}if(!a.email)throw new y("sandbox_ema\
il_required","Sua conta precisa ter um e-mail válido para configurar o retorno do Asaas.",409);let S=await d(v);s=V(S,"keyTag")===w?S:null;let h=S?.updateTime||
"";if(s&&Date.parse(s.fields.leaseUntil?.timestampValue||"")>Date.now())throw new y("sandbox_busy","A preparação já está em andamento. Aguarde um minuto antes d\
e tentar novamente.",409);let k=async I=>{let M=new URLSearchParams(h?{"currentDocument.updateTime":h}:{"currentDocument.exists":"false"});for(let J of Object.keys(
I))M.append("updateMask.fieldPaths",J);let N=await g(ne+v+"?"+M,{method:"PATCH",headers:c,redirect:"manual",signal:i,body:JSON.stringify({fields:I})});if([409,412].
includes(N.status))throw new y("sandbox_changed","O teste mudou durante esta operação. Atualize a tela e tente novamente.",409);if(!N.ok)throw new y("sandbox_\
save_failed","Não foi possível salvar o andamento do teste. Aguarde um minuto e tente novamente.");let K=JSON.parse(await N.text());if(K?.name!=="projects/ven\
das-aura/databases/(default)/documents/"+v||!K.updateTime||!K.fields)throw new y("sandbox_save_failed","Não foi possível conferir o andamento do teste. Aguarde \
um minuto e tente novamente.");s=K,h=K.updateTime},U=new Date(Date.now()+9e4).toISOString();if(s)await k({leaseUntil:ue(U)});else{let I={keyTag:R(w),reference:R(
"aura-sandbox-"+crypto.randomUUID()),customerId:R(""),paymentId:R(""),webhookId:R(""),pendingCreate:R(""),providerStatus:R(""),payload:R(""),encodedImage:R(""),
expirationDate:R(""),setupComplete:Je(!1),webhookAt:{nullValue:null},lastEventId:R(""),leaseUntil:ue(U)};await k(I)}try{let I=V(s,"reference"),M=async(e,n,l)=>{
let p=await T("/"+e+"?externalReference="+encodeURIComponent(n)+"&limit=2");if(!Array.isArray(p?.data)||p.data.length>1||p.hasMore===!0||p.data.some(u=>!l(u)))throw new y(
"sandbox_duplicates","Não foi possível identificar um único registro para este teste. Confira os registros de teste no Asaas Sandbox.",409);return p.data[0]||
null},N=async(e,n,l,p,u,E)=>{let x=await p();if(x){u(x),await k({...E(x),pendingCreate:R("")});return}if(V(s,"pendingCreate")===e)throw new y("sandbox_creation_\
unknown","Uma criação anterior ficou sem confirmação. O sistema evitou repetir a cobrança. Confira o painel Asaas Sandbox e envie esta mensagem para continuarmo\
s.",409);await k({pendingCreate:R(e)});let _;try{_=await T(n,"POST",l)}catch(j){throw j.definitive&&await k({pendingCreate:R("")}),j}u(_),await k({...E(_),pendingCreate:R(
"")})},K=ut+Oe+a.uid,J=await fe(o,"aura:sandbox-webhook:v1:"+a.uid),W={name:"Registro de Vendas - teste isolado",url:K,email:a.email,enabled:!0,interrupted:!1,authToken:J,
events:qe,sendType:"SEQUENTIALLY",apiVersion:3},H=await T("/webhooks?limit=100");if(!Array.isArray(H?.data)||H.hasMore===!0)throw new y("sandbox_webhook_invalid",
"Não foi possível conferir os Webhooks da conta Sandbox.");let F=H.data.filter(e=>e.url===K);if(F.length>1||F.length&&!pe(F[0].id))throw new y("sandbox_webhoo\
k_invalid","Existe mais de um retorno para este teste. Confira os Webhooks no Asaas Sandbox.",409);if(F.length){let e=await T("/webhooks/"+F[0].id,"PUT",W);if(e?.
id!==F[0].id||e.url!==K)throw new y("sandbox_webhook_invalid","Não foi possível confirmar a configuração do retorno automático.");await k({webhookId:R(e.id),
...V(s,"pendingCreate")==="webhook"?{pendingCreate:R("")}:{}})}else await N("webhook","/webhooks",W,async()=>null,e=>{if(!pe(e?.id)||e.url!==K)throw new y("sand\
box_webhook_invalid","Não foi possível conferir o retorno automático.")},e=>({webhookId:R(e.id)}));if(V(s,"customerId")||await N("customer","/customers",{name:"\
Cliente Teste Registro de Vendas",cpfCnpj:"24971563792",notificationDisabled:!0,externalReference:I},()=>M("customers",I,n=>n.externalReference===I),n=>{if(!pe(
n?.id)||n.externalReference!==I||n.deleted===!0)throw new y("sandbox_customer_invalid","Não foi possível conferir o cliente fictício de teste.")},n=>({customerId:R(
n.id)})),!V(s,"paymentId")){let e=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date),
n=["year","month","day"].map(l=>e.find(p=>p.type===l)?.value).join("-");await N("payment","/payments",{customer:V(s,"customerId"),billingType:"PIX",value:Number(
s.fields.amountCents?.integerValue||500)/100,dueDate:n,description:"Teste isolado do Registro de Vendas - sem valor real",externalReference:I,interest:{value:0},
fine:{value:0},discount:{value:0}},()=>M("payments",I,l=>l.externalReference===I),l=>ge(l,s),l=>({paymentId:R(l.id),providerStatus:R(l.status)}))}let Q=await T(
"/payments/"+V(s,"paymentId"));if(ge(Q,s),Q.deleted===!0)throw new y("sandbox_payment_deleted","A cobrança de teste foi excluída no Asaas Sandbox. Envie esta me\
nsagem para prepararmos outro teste.",409);let re={};if(!s.fields.setupComplete?.booleanValue){let e=await T("/payments/"+Q.id+"/pixQrCode");if(typeof e?.payload!=
"string"||e.payload.length<30||e.payload.length>8192||typeof e.encodedImage!="string"||!/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(e.encodedImage)||e.encodedImage.
length>2e5||typeof e.expirationDate!="string"||e.expirationDate.length>64)throw new y("sandbox_qr_invalid","A cobrança existe, mas o Asaas ainda não retornou um\
 QR Code válido. Tente preparar o teste novamente.");re={payload:R(e.payload),encodedImage:R(e.encodedImage),expirationDate:R(e.expirationDate)}}return await k(
{...re,setupComplete:Je(!0),providerStatus:R(Q.status),leaseUntil:ue(new Date(0).toISOString())}),m(xe(s))}catch(I){try{await k({leaseUntil:ue(new Date(0).toISOString())})}catch{}
throw I}}async function ft(t,a,o,r,c,i){if(!/^[A-Za-z0-9_-]{1,128}$/.test(o))return m({code:"not_found"},404);if(t.method!=="POST")return m({code:"method_not_al\
lowed"},405);try{let d=t.headers.get("asaas-access-token")||"";if(!we.test(d)||!Ge(d,await fe(a,"aura:sandbox-webhook:v1:"+o)))return m({code:"unauthorized"},401);
if(!(t.headers.get("Content-Type")||"").toLowerCase().startsWith("application/json"))return m({code:"invalid_body"},400);let g=t.body?.getReader(),f=[],b=0;if(!g)
return m({code:"invalid_body"},400);for(;;){let{value:s,done:P}=await g.read();if(P)break;if(b+=s.length,b>131072)return await g.cancel(),m({code:"invalid_body"},
413);f.push(s)}let C=new Uint8Array(b),w=0;for(let s of f)C.set(s,w),w+=s.length;let v;try{v=JSON.parse(new TextDecoder("utf-8",{fatal:!0}).decode(C))}catch{return m(
{code:"invalid_body"},400)}return!v||typeof v.id!="string"||v.id.length>200||!v.id||!pe(v.payment?.id)?m({code:"invalid_event"},400):qe.includes(v.event)?await ve(
a,r,!1,async(s,P)=>{let T={accept:"application/json","Content-Type":"application/json",Authorization:"Bearer "+s},S=F=>Ye(r,T,P,F),h="_asaas_sandbox_checks/"+o,
k=await S(h);if(!k||v.payment.id!==V(k,"paymentId"))return i.handleWebhook({user:{uid:o},event:v,env:a,headers:T,signal:P,load:S,fetchGoogle:r,fetchAsaas:c});if(V(
k,"lastEventId")===v.id)return m({accepted:!0});let U=await S("_asaas_integrations/"+o),I=await S("artifacts/vendas-aura-main/users/"+o+"/profile/info");if(!U?.
fields?.enabled?.booleanValue||I?.fields?.approved?.booleanValue!==!0||!["","active"].includes(I.fields.status?.stringValue||""))return m({accepted:!0});let M=await oe(
a,o,U.fields);if(V(k,"keyTag")!==await fe(a,"aura:sandbox-key:v1:"+M))return m({accepted:!0});let K=await Re(c,M,P)("/payments/"+V(k,"paymentId"));ge(K,k);let J={
providerStatus:R(K.deleted===!0?"DELETED":K.status),webhookAt:ue(new Date().toISOString()),lastEventId:R(v.id)},W=new URLSearchParams({"currentDocument.updateTi\
me":k.updateTime});for(let F of Object.keys(J))W.append("updateMask.fieldPaths",F);if(!(await r(ne+h+"?"+W,{method:"PATCH",headers:T,redirect:"manual",signal:P,
body:JSON.stringify({fields:J})})).ok)throw new y("sandbox_webhook_retry","Retorno ainda não registrado. Repetir entrega.",503);return m({accepted:!0})}):m({accepted:!0})}catch(d){
return m({code:d instanceof y?d.code:"sandbox_webhook_retry"},d instanceof y?d.status:503)}}async function ht(t){if(!(t.headers.get("Content-Type")||"").toLowerCase().
startsWith("application/json"))throw new y("invalid_body","Envie a configuração em formato JSON.",400);let a=t.body?.getReader();if(!a)throw new y("invalid_bo\
dy","Informe a configuração da integração.",400);let o=0,r=[];for(;;){let{value:c,done:i}=await a.read();if(i)break;if(o+=c.byteLength,o>4096)throw await a.
cancel(),new y("invalid_body","A configuração enviada excedeu o tamanho permitido.",413);r.push(c)}try{let c=new Uint8Array(o),i=0;for(let g of r)c.set(g,i),i+=
g.length;let d=JSON.parse(new TextDecoder("utf-8",{fatal:!0}).decode(c));if(!d||typeof d!="object"||Array.isArray(d)||Object.keys(d).length===0||Object.keys(d).
some(g=>!["apiKey","enabled"].includes(g))||d.enabled!==void 0&&typeof d.enabled!="boolean"||d.apiKey!==void 0&&(typeof d.apiKey!="string"||d.apiKey.trim().length<
8||d.apiKey.trim().length>2048||/[^\x21-\x7e]/.test(d.apiKey.trim())))throw new Error("invalid_body");return d}catch{throw new y("invalid_body","Confira a chave\
 e a configuração enviadas.",400)}}async function yt(t,a,o){let r=await a(be+"/pix/addressKeys?status=ACTIVE&limit=1",{method:"GET",headers:{accept:"applicati\
on/json",access_token:t,"User-Agent":"RegistroDeVendas-Pix-Sandbox-Profile/1.0"},redirect:"manual",signal:o});if(!r.ok)throw new y("asaas_key_rejected",[401,403].
includes(r.status)?"O Asaas não aceitou esta chave. Confira se ela pertence ao Sandbox e continua ativa.":"O Asaas não concluiu o teste. Tente novamente.",502);
let c=JSON.parse(await r.text());if(!Array.isArray(c?.data))throw new y("asaas_response_invalid","O Asaas respondeu em um formato inesperado.",502);return c.data.
some(i=>i?.status==="ACTIVE")}function ce(t){let a=t?.fields||{};return{configured:!!t,enabled:a.enabled?.booleanValue===!0,environment:"sandbox",hasActivePixKey:a.
hasActivePixKey?.booleanValue===!0,checkedAt:a.checkedAt?.timestampValue||null,flowVersion:1,pendingCharges:Number(a.pendingCharges?.integerValue||0)}}async function gt(t,a,o,r,c){
let i=t.headers.get("Origin"),d=typeof a.APP_ORIGIN=="string"&&a.APP_ORIGIN.trim()?a.APP_ORIGIN.trim():dt,g=new URL(t.url).pathname;if(!i||i!==d)return m({code:"\
origin_denied",message:"Abra a integração pelo sistema de vendas."},403);let f={"Access-Control-Allow-Origin":i,Vary:"Origin"},b=w=>{for(let[v,s]of Object.entries(
f))w.headers.set(v,s);return w},C=g===me?["GET","PUT","DELETE"]:g===de?["GET","POST"]:[me+"/test",de+"/simulate"].includes(g)?["POST"]:c.methods(g);if(!C.length)
return b(m({code:"not_found",message:"Rota não encontrada."},404));if(t.method==="OPTIONS")return C.includes(t.headers.get("Access-Control-Request-Method")||"")?
new Response(null,{status:204,headers:{...Ne,...f,"Access-Control-Allow-Methods":C.join(", "),"Access-Control-Allow-Headers":"Authorization, Content-Type","Acce\
ss-Control-Max-Age":"600"}}):b(m({code:"method_not_allowed",message:"Método não permitido."},405));if(!C.includes(t.method))return b(m({code:"method_not_allow\
ed",message:"Método não permitido."},405));try{let w=await mt(t,o),v=w.uid,s=t.method==="PUT"?await ht(t):null,P=await ve(a,o,!1,async(T,S)=>{let h={accept:"a\
pplication/json","Content-Type":"application/json",Authorization:"Bearer "+T},k="artifacts/vendas-aura-main/users/"+v+"/profile/info",U="_asaas_integrations/"+v,
I=e=>Ye(o,h,S,e),M=await I(k);if(M?.fields?.approved?.booleanValue!==!0||!["","active"].includes(M.fields.status?.stringValue||""))throw new y("account_not_appr\
oved","Sua conta precisa estar aprovada e ativa para configurar o Asaas.",403);let N=await I(U);if(c.matches(g))return c.handleRequest({request:t,user:w,env:a,current:N,
headers:h,signal:S,load:I,fetchGoogle:o,fetchAsaas:r});if(g===de||g===de+"/simulate")return He({request:t,user:w,env:a,current:N,headers:h,signal:S,load:I,fetchGoogle:o,
fetchAsaas:r});if(Number(N?.fields?.pendingCharges?.integerValue||0)>0&&(t.method==="DELETE"||t.method==="PUT"&&(s.enabled===!1||s.apiKey!==void 0)))throw new y(
"pending_charges","Conclua ou cancele os testes pendentes no perfil antes de alterar a chave ou usar Pix manual.",409);let K=()=>new URLSearchParams(N?{"current\
Document.updateTime":N.updateTime}:{"currentDocument.exists":"false"}),J=async e=>{let n=K();for(let p of Object.keys(e))n.append("updateMask.fieldPaths",p);let l=await o(
ne+U+"?"+n,{method:"PATCH",headers:h,redirect:"manual",signal:S,body:JSON.stringify({fields:e})});if([409,412].includes(l.status))throw new y("integration_chang\
ed","A configuração mudou durante esta operação. Atualize a tela e tente novamente.",409);if(!l.ok)throw new y("integration_save_failed","Não foi possível s\
alvar a integração. Tente novamente.")};if(t.method==="DELETE"){if(N){let e=await o(ne+U+"?"+K(),{method:"DELETE",headers:h,redirect:"manual",signal:S});if([409,
412].includes(e.status))throw new y("integration_changed","A configuração mudou. Atualize a tela antes de remover.",409);if(!e.ok&&e.status!==404)throw new y(
"integration_delete_failed","Não foi possível remover a integração.")}return m({...ce(null),message:"Chave da integração removida."})}if(await _e(a),t.method===
"GET")return N&&await oe(a,v,N.fields),m(ce(N));let W=new Date().toISOString();if(t.method==="PUT"&&s.enabled===!1&&s.apiKey===void 0)return N?(await J({enabled:{
booleanValue:!1},updatedAt:{timestampValue:W}}),m({...ce(N),enabled:!1,message:"Pix manual selecionado. A chave da integração permanece protegida."})):m({...ce(
null),message:"Pix manual selecionado."});let H=s?.apiKey!==void 0?s.apiKey.trim():N?await oe(a,v,N.fields):"";if(!H)throw new y("asaas_key_required","Informe a\
 chave da API do Asaas Sandbox para conectar.",400);let F=await yt(H,r,S),Q={hasActivePixKey:{booleanValue:F},checkedAt:{timestampValue:W},updatedAt:{timestampValue:W}};
if(t.method==="PUT"){let e=await We(a,v,H);Object.assign(Q,{environment:{stringValue:"sandbox"},version:{integerValue:"1"},cipher:{stringValue:e.cipher},iv:{stringValue:e.
iv},enabled:{booleanValue:s.enabled!==!1}})}await J(Q);let re=ce({fields:{...N?.fields||{},...Q}});return m({...re,message:F?"Asaas Sandbox conectado. A chave e\
stá salva e o teste foi concluído.":"Asaas Sandbox conectado. Falta cadastrar ou ativar uma chave Pix na conta de testes."})});return b(P)}catch(w){return b(m(
{code:w instanceof y?w.code:"integration_unavailable",message:w instanceof y?w.message:"Não foi possível concluir a operação do Asaas. Tente novamente."},w instanceof
y?w.status:503))}}async function bt(t,a,o){let r=crypto.randomUUID(),c="probe-"+r,i="projects/vendas-aura/databases/(default)/documents/_pix_connection_check/"+
c,d="https://firestore.googleapis.com/v1/"+i,g={accept:"application/json","Content-Type":"application/json",Authorization:"Bearer "+a},f="criação",b=0,C=!1,w="";
async function v(P,T,S){b=0;let h=await t(T,{method:P,headers:g,redirect:"manual",signal:o,...S===void 0?{}:{body:JSON.stringify(S)}});if(!h.ok)throw b=h.status,
f==="criação"&&[400,401,403,404,409,429].includes(b)&&(C=!1),new Error("diagnostic_request_failed");return h}async function s(P,T,S=""){let h=JSON.parse(await P.
text());if(!h||h.name!==i||h.fields?.connectionTest?.booleanValue!==!0||h.fields?.probeId?.stringValue!==r||h.fields?.stage?.stringValue!==T||typeof h.updateTime!=
"string"||!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(h.updateTime)||S&&h.updateTime!==S)throw new Error("diagnostic_document_mismatch");w=h.updateTime}try{C=!0;let P=await v(
"POST",it+"?documentId="+c,{fields:{connectionTest:{booleanValue:!0},probeId:{stringValue:r},stage:{stringValue:"created"}}});await s(P,"created"),f="atualizaçã\
o";let T=new URLSearchParams({"updateMask.fieldPaths":"stage","currentDocument.updateTime":w}),S=await v("PATCH",d+"?"+T,{fields:{stage:{stringValue:"updated"}}});
return await s(S,"updated"),f="leitura",await s(await v("GET",d),"updated",w),f="exclusão",await v("DELETE",d+"?"+new URLSearchParams({"currentDocument.updateT\
ime":w})),m({code:"firebase_write_connected",firebaseConnected:!0,firestoreWrite:!0,diagnosticCleaned:!0,message:"Teste completo do Firebase concluído. O Worker\
 criou, atualizou, leu e excluiu um registro de diagnóstico. As permissões de leitura e gravação estão funcionando. Nenhum dado de vendas foi alterado."})}catch(P){
let T=!C;if(w)try{let U=await t(d+"?"+new URLSearchParams({"currentDocument.updateTime":w}),{method:"DELETE",headers:g,redirect:"manual",signal:AbortSignal.timeout(
8e3)});T=U.ok||U.status===404}catch{}let S=P instanceof Error&&(P.name==="TimeoutError"||P.name==="AbortError"),h=b?" (HTTP "+b+")":S?" por tempo excedido":"",k=T?
" O registro temporário foi limpo ou não chegou a ser criado.":" Pode ter ficado um registro de diagnóstico: "+c+". Guarde esta mensagem para conferir a limp\
eza.";return m({code:"firebase_write_failed",step:f,diagnosticCleaned:T,message:"O teste parou na etapa de "+f+h+". Confira as permissões da conta de serviço no\
 Firebase. Não é necessário liberar as regras públicas do banco."+k},S?504:b===429?503:502)}}async function ve(t,a,o=!1,r=null){if(typeof t.FIREBASE_SERVICE_ACCOUNT!=
"string"||!t.FIREBASE_SERVICE_ACCOUNT.trim())return m({code:"firebase_secret_required",message:"Cadastre o JSON completo no Secret FIREBASE_SERVICE_ACCOUNT da C\
loudflare e clique em Deploy."},503);let c;try{c=JSON.parse(t.FIREBASE_SERVICE_ACCOUNT)}catch{return m({code:"firebase_json_invalid",message:"O Secret FIREBASE_\
SERVICE_ACCOUNT não contém um JSON válido. Copie todo o conteúdo do arquivo baixado do Firebase, incluindo as chaves do início e do final."},503)}if(!c||c.
type!=="service_account"||typeof c.client_email!="string"||!/^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(c.client_email)||typeof c.private_key!="string")return m(
{code:"firebase_credentials_invalid",message:"O JSON não contém uma conta de serviço completa. Use o arquivo gerado em Contas de serviço → Gerar nova chave priv\
ada."},503);if(c.project_id!==Pe)return m({code:"firebase_project_mismatch",message:"A credencial precisa pertencer ao projeto vendas-aura. Gere a chave privada\
 nesse projeto e atualize o Secret."},503);let i;try{let d=c.private_key.replace(/\\n/g,`
`).trim();if(!d.startsWith("-----BEGIN PRIVATE KEY-----")||!d.endsWith("-----END PRIVATE KEY-----"))throw new Error("Invalid PKCS8");let g=Uint8Array.from(atob(
d.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"")),T=>T.charCodeAt(0)),f=await crypto.subtle.importKey("pkcs8",g,{name:"RSASSA-PKCS1-v1_\
5",hash:"SHA-256"},!1,["sign"]),b=new TextEncoder,C=Math.floor(Date.now()/1e3),w={alg:"RS256",typ:"JWT",...typeof c.private_key_id=="string"?{kid:c.private_key_id}:
{}},v={iss:c.client_email,scope:"https://www.googleapis.com/auth/datastore",aud:ze,iat:C-30,exp:C+3300},s=le(b.encode(JSON.stringify(w)))+"."+le(b.encode(JSON.stringify(
v))),P=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",f,b.encode(s));i=s+"."+le(new Uint8Array(P))}catch{return m({code:"firebase_private_key_invalid",message:"Nã\
o foi possível ler a chave privada do Firebase. Atualize FIREBASE_SERVICE_ACCOUNT com o JSON completo, sem editar o campo private_key."},503)}try{let d=AbortSignal.
timeout(r?4e4:2e4),g=await a(ze,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",accept:"application/json"},body:new URLSearchParams({
grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:i}).toString(),redirect:"manual",signal:d});if(!g.ok)return m({code:"firebase_auth_failed",message:"\
O Google não aceitou a credencial. Confira se a conta de serviço e a chave privada estão ativas e se o JSON foi copiado integralmente."},502);let f=JSON.parse(
await g.text());if(!f||typeof f.access_token!="string"||!f.access_token||/[\r\n]/.test(f.access_token))return m({code:"firebase_auth_response_invalid",message:"\
O Google não retornou um token válido para o teste. Tente novamente."},502);if(r)return await r(f.access_token,d);if(o)return bt(a,f.access_token,d);let b=await a(
st,{method:"GET",headers:{accept:"application/json",Authorization:"Bearer "+f.access_token},redirect:"manual",signal:d});if(!b.ok)return m({code:"firebase_read_\
failed",message:{401:"O Firestore recusou a autenticação. Confira se a conta de serviço e a chave privada continuam ativas.",403:"A autenticação funcionou, m\
as o Firestore recusou a leitura. Confira se o Firestore está ativo e se a conta de serviço tem permissão de acesso. Não é necessário liberar as regras públicas\
 do banco.",404:"O banco Firestore padrão não foi encontrado no projeto vendas-aura. Confira o projeto e o banco usado pelo sistema.",429:"O Firebase limitou \
temporariamente as consultas. Aguarde e tente novamente."}[b.status]||"O Firestore não concluiu a consulta. Tente novamente mais tarde."},b.status===429?503:502);
let C=JSON.parse(await b.text());return!C||typeof C!="object"||Array.isArray(C)||C.error||C.documents!==void 0&&!Array.isArray(C.documents)?m({code:"firebase_re\
sponse_invalid",message:"O Firestore respondeu em um formato inesperado. Tente novamente."},502):m({code:"firebase_connected",firebaseConnected:!0,firestoreRead:!0,
mode:"read-only",projectId:Pe,message:"Conexão com o Firebase funcionando. A credencial foi aceita e a leitura do Firestore está autorizada no projeto vendas-au\
ra. Nenhum registro foi alterado. Use Testar gravação Firebase para conferir também a permissão de gravação."})}catch(d){return d instanceof y?m({code:d.code,
message:d.message},d.status):d instanceof Error&&(d.name==="TimeoutError"||d.name==="AbortError")?m({code:"firebase_timeout",message:"A consulta ao Firebase exc\
edeu "+(r?"40":"20")+" segundos. Aguarde um pouco e tente novamente."},504):d instanceof SyntaxError?m({code:"firebase_response_invalid",message:"O Google ou o \
Firestore não retornou uma resposta JSON válida. Tente novamente."},502):m({code:"firebase_connection_failed",message:"Não foi possível concluir a conexão com\
 o Firebase. Tente novamente; se persistir, confira o painel da Cloudflare."},502)}}function wt(t={}){let a=t.fetchAsaas||Be,o=t.fetchGoogle||Be,r=Le({IntegrationError:y,
json:m,sandboxTag:fe,decryptAsaasKey:oe,sandboxApi:Re,handleSandboxCheck:He,FIRESTORE_DOCUMENTS:ne});return{async fetch(c,i={}){let d=new URL(c.url);if(d.pathname.
startsWith(Oe))return ft(c,i,d.pathname.slice(Oe.length),o,a,r);if(d.pathname===me||d.pathname.startsWith(me+"/"))return gt(c,i,o,a,r);if(c.method==="GET"&&d.pathname===
"/")return lt();if(c.method==="GET"&&d.pathname==="/health")return m({service:"registro-vendas-pix-testes",stage:"sandbox-charge-test",environment:"sandbox"});if(![
"/api/setup/check","/api/setup/firebase-check","/api/setup/firebase-write-check","/api/setup/encryption-check"].includes(d.pathname))return m({code:"not_found",
message:"Rota não encontrada."},404);if(c.method!=="POST")return m({code:"method_not_allowed",message:"Use os botões de teste desta página."},405);let g=c.headers.
get("Origin");if(g&&g!==d.origin||c.headers.get("Sec-Fetch-Site")==="cross-site")return m({code:"origin_denied",message:"Abra o teste pelo endereço do próprio W\
orker."},403);let f=typeof i.SETUP_TOKEN=="string"?i.SETUP_TOKEN.trim():"";if(!we.test(f))return m({code:"setup_required",message:"Cadastre o código gerado nest\
a página no Secret SETUP_TOKEN da Cloudflare e clique em Deploy."},503);let b=c.headers.get("X-Setup-Token")||"";if(!we.test(b)||!Ge(b,f))return m({code:"unaut\
horized",message:"O código de configuração não confere com o Secret SETUP_TOKEN da Cloudflare."},401);if(d.pathname==="/api/setup/firebase-check")return ve(
i,o);if(d.pathname==="/api/setup/firebase-write-check")return ve(i,o,!0);if(d.pathname==="/api/setup/encryption-check")return pt(i);if((typeof i.ASAAS_BASE_URL==
"string"?i.ASAAS_BASE_URL.trim().replace(/\/+$/,""):"")!==be)return m({code:"sandbox_required",message:"Este código funciona somente em testes. Configure ASAAS_\
BASE_URL como https://api-sandbox.asaas.com/v3."},503);let w=typeof i.ASAAS_API_KEY=="string"?i.ASAAS_API_KEY.trim():"";if(!w||/[\r\n]/.test(w))return m({code:"\
api_key_required",message:"Cadastre a chave de API do Sandbox como Secret ASAAS_API_KEY e clique em Deploy."},503);try{let v=await a(`${be}/pix/addressKeys?stat\
us=ACTIVE&limit=1`,{method:"GET",headers:{accept:"application/json",access_token:w,"User-Agent":"RegistroDeVendas-Pix-Sandbox-Setup/1.0"},redirect:"manual",signal:AbortSignal.
timeout(2e4)});if(!v.ok)return m({code:"asaas_unavailable",message:{401:"O Asaas não aceitou a chave de API. Confira se a chave é do Sandbox, está habilitada e \
foi copiada integralmente.",403:"O Asaas recusou o acesso. Confira as permissões e eventuais restrições de IP da chave no Sandbox.",429:"O Asaas limitou temp\
orariamente as consultas. Aguarde e tente novamente."}[v.status]||"O Asaas não concluiu a consulta. Tente novamente mais tarde."},v.status===429?503:502);let s=JSON.
parse(await v.text());if(!s||!Array.isArray(s.data))return m({code:"invalid_response",message:"O Asaas respondeu em um formato inesperado. Tente novamente mais \
tarde."},502);let P=s.data.some(T=>T?.status==="ACTIVE");return m({code:P?"ready_for_firebase":"pix_key_required",apiConnected:!0,hasActivePixKey:P,environment:"\
sandbox",message:P?"Conexão com o Asaas Sandbox funcionando. Existe uma chave Pix ativa de teste. Use os botões do Firebase para conferir também o acesso ao ban\
co.":"Conexão com o Asaas Sandbox funcionando. Falta cadastrar ou ativar uma chave Pix na conta de testes. Depois, repita este teste."})}catch(v){return v instanceof
Error&&(v.name==="TimeoutError"||v.name==="AbortError")?m({code:"asaas_timeout",message:"A consulta ao Asaas Sandbox excedeu 20 segundos. Aguarde um pouco e ten\
te novamente."},504):v instanceof SyntaxError?m({code:"invalid_response",message:"O Asaas não retornou uma resposta JSON válida. Tente novamente mais tarde."},
502):m({code:"connection_failed",message:"Não foi possível consultar o Asaas Sandbox. Tente novamente; se persistir, confira o painel da Cloudflare."},502)}}}}
var Tt=wt();export{wt as createWorker,Tt as default};
