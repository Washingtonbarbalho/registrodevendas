import React from 'https://esm.sh/react@18.2.0';
import { Plus, Search, QrCode, Banknote, CreditCard, ChevronRight, WalletCards } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, formatDate } from './utils.js';
import { DateRangeFilter, Pagination } from './components.js';

const formatSaleMoment = sale => {
  if (sale?.saleDateTime) {
    const parsed = new Date(sale.saleDateTime);
    if (!Number.isNaN(parsed.getTime())) return `${formatDate(sale.saleDate)} · ${parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return `${formatDate(sale?.saleDate)} · --:--`;
};

export const AbaVendasCaixa = ({ setNewSaleMode, cashierPeriod, cashierStart, cashierEnd, setCashierPeriod, setCashierStart, setCashierEnd, cashierSearch, setCashierSearch, paginatedCashier, directSales, cashierPage, setCashierPage, setSelectedSaleDetail, ITEMS_PER_PAGE }) => {
  const getNetAmount = sale => {
    const saved = Number(sale.netReceived); if (Number.isFinite(saved)) return saved;
    let net = Number(sale.totalPrice) || 0; if (sale.feeConfig) net -= Number(sale.feeConfig.value) || 0; return net;
  };
  const getPaymentLabel = sale => sale.paymentMethod === 'credit' ? `Crédito ${sale.cardInstallments || 1}x` : sale.paymentMethod === 'debit' ? 'Débito' : sale.paymentMethod === 'money' ? 'Dinheiro' : 'PIX';
  const getPaymentIcon = sale => sale.paymentMethod === 'pix' ? React.createElement(QrCode,{size:13}) : sale.paymentMethod === 'money' ? React.createElement(Banknote,{size:13}) : React.createElement(CreditCard,{size:13});
  return React.createElement('section',{className:'page-stack animate-fade-in'},
    React.createElement('div',{className:'page-heading'},React.createElement('div',{className:'page-heading-copy'},React.createElement('h2',{className:'page-title'},'Vendas no caixa'),React.createElement('p',{className:'page-description'},'Vendas diretas com valor bruto, taxa e líquido recebido.')),React.createElement('button',{onClick:()=>setNewSaleMode('direct'),className:'page-primary-action is-success'},React.createElement(Plus,{size:18}),'Nova venda direta')),
    React.createElement(DateRangeFilter,{period:cashierPeriod,startDate:cashierStart,endDate:cashierEnd,onPeriodChange:setCashierPeriod,onStartChange:setCashierStart,onEndChange:setCashierEnd}),
    React.createElement('div',{className:'toolbar'},React.createElement('div',{className:'toolbar-search'},React.createElement(Search,{size:18}),React.createElement('input',{placeholder:'Buscar por cliente ou produto...',value:cashierSearch,onChange:e=>setCashierSearch(e.target.value.toUpperCase())})),React.createElement('span',{className:'result-count'},`${directSales.length} ${directSales.length===1?'venda':'vendas'}`)),
    React.createElement('div',{className:'list-shell'},
      React.createElement('div',{className:'list-header md:grid-cols-[minmax(0,1.7fr)_140px_140px_150px_120px_34px]'},React.createElement('span',null,'Cliente / data e hora'),React.createElement('span',null,'Pagamento'),React.createElement('span',null,'Cobrado'),React.createElement('span',null,'Líquido no caixa'),React.createElement('span',null,'Taxa'),React.createElement('span',null,'')),
      paginatedCashier.length===0 ? React.createElement('div',{className:'empty-state'},React.createElement('div',{className:'empty-state-icon'},React.createElement(WalletCards,{size:22})),React.createElement('p',{className:'empty-state-title'},'Nenhuma venda direta encontrada')) : paginatedCashier.map(sale=>{
        const net=getNetAmount(sale), gross=Number(sale.totalPrice)||0, fee=Number(sale.feeConfig?.value)||0, hasFee=fee>0&&(sale.paymentMethod==='credit'||sale.paymentMethod==='debit'), canceled=sale.status==='canceled';
        return React.createElement('div',{key:sale.id,onClick:()=>setSelectedSaleDetail(sale),className:`list-row ${canceled?'is-canceled':''} grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.7fr)_140px_140px_150px_120px_34px]`},
          React.createElement('div',{className:'list-main'},React.createElement('p',{className:`list-title ${canceled?'line-through text-red-600':''}`},sale.customerName||'Venda avulsa'),React.createElement('p',{className:'list-subtitle'},`Venda em ${formatSaleMoment(sale)}`),React.createElement('div',{className:'md:hidden mt-3 flex items-center gap-2 flex-wrap'},React.createElement('span',{className:`status-badge ${canceled?'status-canceled':'status-paid'}`},canceled?'Cancelada':getPaymentLabel(sale)),hasFee&&React.createElement('span',{className:'status-badge status-warning'},`Taxa ${formatCurrency(fee)}`))),
          React.createElement('div',{className:'hidden md:block'},React.createElement('span',{className:`status-badge ${canceled?'status-canceled':'status-info'}`},getPaymentIcon(sale),getPaymentLabel(sale))),
          React.createElement('div',{className:'hidden md:block list-meta font-semibold'},formatCurrency(gross)),React.createElement('div',{className:'hidden md:block list-value text-emerald-700'},formatCurrency(net)),React.createElement('div',{className:'hidden md:block'},React.createElement('span',{className:`text-xs font-extrabold ${hasFee?'text-orange-600':'text-slate-400'}`},hasFee?`- ${formatCurrency(fee)}`:'Sem taxa')),
          React.createElement('div',{className:'md:hidden text-right'},React.createElement('span',{className:'list-label-mobile'},'Líquido'),React.createElement('p',{className:`list-value ${canceled?'line-through text-red-600':'text-emerald-700'}`},formatCurrency(net)),React.createElement('p',{className:'mt-1 text-[10px] text-slate-400'},`Cobrado ${formatCurrency(gross)}`)),React.createElement('div',{className:'hidden md:grid place-items-center text-slate-300'},React.createElement(ChevronRight,{size:18})));
      })
    ),
    React.createElement(Pagination,{totalItems:directSales.length,itemsPerPage:ITEMS_PER_PAGE,currentPage:cashierPage,onPageChange:setCashierPage})
  );
};
