import { formatCurrency, formatDate } from './utils.js';

const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const cleanDate = value => String(value || '').split('T')[0];
const paymentLabel = sale => {
  if (sale?.saleType !== 'direct') return 'Crediário';
  if (sale.paymentMethod === 'pix') return 'PIX';
  if (sale.paymentMethod === 'money') return 'Dinheiro';
  if (sale.paymentMethod === 'debit') return 'Cartão de débito';
  if (sale.paymentMethod === 'credit') return `Cartão de crédito (${sale.cardInstallments || 1}x)`;
  return 'Não informado';
};
const saleMoment = sale => {
  const date = cleanDate(sale?.saleDate || sale?.saleDateTime);
  let text = date ? formatDate(date) : '--/--/----';
  if (sale?.saleDateTime) {
    const parsed = new Date(sale.saleDateTime);
    if (!Number.isNaN(parsed.getTime())) text += ` às ${parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return text;
};
const contractId = sale => sale?.id ? `VP-${sale.id.slice(-5).toUpperCase()}` : 'VENDA';

export const generateSalePdfBlob = async ({ sale, userProfile = {}, type = 'detalhe', installment = null, historyItem = null }) => {
  if (!sale) throw new Error('Venda não informada.');
  const module = await import('https://esm.sh/jspdf@2.5.1');
  const JsPdf = module.jsPDF || module.default?.jsPDF || module.default;
  if (!JsPdf) throw new Error('Biblioteca de PDF indisponível.');
  const store = userProfile?.storeName || 'Registro de Vendas';
  const isDirect = sale.saleType === 'direct';
  const pdf = isDirect
    ? new JsPdf({ unit: 'mm', format: [80, 210], orientation: 'portrait' })
    : new JsPdf({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = isDirect ? 6 : 15;
  const usable = width - margin * 2;
  let y = isDirect ? 9 : 16;
  const ensure = needed => { if (y + needed > height - 10) { pdf.addPage(); y = 14; } };
  const text = (value, opts = {}) => {
    const size = opts.size || (isDirect ? 8 : 9);
    pdf.setFont('helvetica', opts.bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(...(opts.color || [40,40,40]));
    const lines = pdf.splitTextToSize(String(value ?? ''), opts.width || usable); const lineHeight = size * 0.39 + 1.2; ensure(lines.length * lineHeight + 2);
    pdf.text(lines, opts.x || margin, y, opts.align ? { align: opts.align } : undefined); y += lines.length * lineHeight + (opts.after ?? 1.5);
  };
  const rule = () => { ensure(4); pdf.setDrawColor(180,180,180); pdf.line(margin, y, width - margin, y); y += 4; };

  if (isDirect) {
    pdf.setFont('helvetica','bold'); pdf.setFontSize(13); pdf.text(store, width / 2, y, { align:'center' }); y += 6;
    pdf.setFont('helvetica','normal'); pdf.setFontSize(7); pdf.setTextColor(100,100,100); pdf.text('COMPROVANTE DE VENDA · DOCUMENTO NÃO FISCAL', width / 2, y, { align:'center' }); y += 6; rule();
    text(`Data: ${saleMoment(sale)}`, { size:7 });
    text(`Cliente: ${sale.customerName || 'Venda avulsa'}`, { size:7 });
    rule(); text('ITENS', { size:8, bold:true });
    (sale.items || []).forEach(item => { text(`${item.quantity || 1}x ${item.productName || 'Produto'}`, { size:7, bold:true, after:.5 }); text(`${formatCurrency(item.price || 0)}`, { size:7, after:1.5 }); });
    rule();
    if (num(sale.totalDiscount) > 0) text(`Descontos: - ${formatCurrency(sale.totalDiscount)}`, { size:7 });
    text(`TOTAL: ${formatCurrency(sale.totalPrice || 0)}`, { size:11, bold:true });
    text(`Pagamento: ${paymentLabel(sale)}`, { size:7 });
    if ((sale.paymentMethod === 'credit' || sale.paymentMethod === 'debit') && sale.feeConfig) {
      text(`Taxa: ${num(sale.feeConfig.percent).toLocaleString('pt-BR')}% · ${sale.feeConfig.type === 'com_juros' ? 'repassada ao cliente' : 'assumida pela loja'}`, { size:6.5 });
    }
    if (sale.status === 'canceled') text(`CANCELADA${sale.cancelReason ? ` · ${sale.cancelReason}` : ''}`, { size:8, bold:true, color:[185,28,28] });
    if (sale.notes) { rule(); text(`Observações: ${sale.notes}`, { size:7 }); }
    rule(); text('Obrigado pela preferência!', { size:8, bold:true, align:'center', x:width/2 });
  } else {
    const titles = { cobranca:'AVISO DE COBRANÇA', recibo:'RECIBO DE PAGAMENTO', quitacao:'TERMO DE QUITAÇÃO', registro:'DETALHAMENTO DA COMPRA', detalhe:'DETALHAMENTO DA COMPRA' };
    pdf.setFillColor(15,23,42); pdf.rect(0,0,width,30,'F'); pdf.setTextColor(255,255,255); pdf.setFont('helvetica','bold'); pdf.setFontSize(17); pdf.text(titles[type] || titles.detalhe, margin, 13); pdf.setFontSize(9); pdf.setFont('helvetica','normal'); pdf.text(store, margin, 21); y = 40;
    text(`Contrato: ${contractId(sale)}`, { bold:true }); text(`Data da venda: ${saleMoment(sale)}`); text(`Cliente: ${sale.customerName || 'Cliente'}`); if (sale.customerPhone) text(`Telefone: ${sale.customerPhone}`); rule();
    text('ITENS DA COMPRA', { bold:true, size:10 });
    (sale.items || []).forEach(item => text(`${item.quantity || 1}x ${item.productName || 'Produto'}  ·  ${formatCurrency(item.price || 0)}`, { size:8 }));
    rule(); text(`Valor total: ${formatCurrency(sale.totalPrice || 0)}`, { size:11, bold:true }); if (num(sale.entryAmount) > 0) text(`Entrada: ${formatCurrency(sale.entryAmount)}`);
    if (type === 'cobranca' && installment) { rule(); text('PARCELA EM COBRANÇA', { bold:true, size:10, color:[185,28,28] }); text(`Parcela ${installment.number}/${sale.installmentsCount || sale.installments?.length || 1}`); text(`Vencimento: ${formatDate(cleanDate(installment.dueDate))}`); text(`Valor em aberto: ${formatCurrency(installment.amount || 0)}`, { bold:true }); }
    if (type === 'recibo' && installment) { const paidValue = historyItem ? historyItem.amount : installment.originalAmount || installment.amount; const paidDate = historyItem ? historyItem.date : installment.paidAt; rule(); text('PAGAMENTO REGISTRADO', { bold:true, size:10, color:[4,120,87] }); text(`Parcela ${installment.number}/${sale.installmentsCount || sale.installments?.length || 1}`); text(`Valor pago: ${formatCurrency(paidValue || 0)}`, { bold:true }); text(`Data: ${formatDate(cleanDate(paidDate))}`); }
    rule(); text('PARCELAS', { bold:true, size:10 });
    const cols = [18, 38, 38, usable - 94]; let x = margin; pdf.setFillColor(241,245,249); pdf.setDrawColor(203,213,225); ['Nº','Vencimento','Valor','Situação'].forEach((label,i)=>{pdf.rect(x,y,cols[i],8,'FD');pdf.setFont('helvetica','bold');pdf.setFontSize(7);pdf.setTextColor(51,65,85);pdf.text(label,x+1.5,y+5);x+=cols[i];}); y += 8;
    (sale.installments || []).forEach(inst => { ensure(8); x=margin; const status = inst.paid ? `Pago${inst.paidAt ? ' ' + formatDate(cleanDate(inst.paidAt)) : ''}` : cleanDate(inst.dueDate) < cleanDate(new Date().toISOString()) ? 'Atrasada' : 'Em aberto'; [String(inst.number), formatDate(cleanDate(inst.dueDate)), formatCurrency(inst.originalAmount || inst.amount || 0), status].forEach((value,i)=>{pdf.setFillColor(255,255,255);pdf.setDrawColor(226,232,240);pdf.rect(x,y,cols[i],8,'FD');pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.setTextColor(51,65,85);pdf.text(pdf.splitTextToSize(value,cols[i]-3)[0] || '',x+1.5,y+5);x+=cols[i];}); y += 8; });
    if (sale.notes) { y += 5; text(`Observações: ${sale.notes}`, { size:8 }); }
    if (sale.status === 'canceled') { y += 4; text(`VENDA CANCELADA${sale.cancelReason ? ` · ${sale.cancelReason}` : ''}`, { bold:true, color:[185,28,28] }); }
  }
  return pdf.output('blob');
};

export const shareSalePdf = async options => {
  const blob = await generateSalePdfBlob(options);
  const sale = options?.sale;
  const isDirect = sale?.saleType === 'direct';
  const name = `${isDirect ? 'comprovante-venda' : 'contrato'}-${sale?.id ? sale.id.slice(-6) : Date.now()}.pdf`;
  const file = new File([blob], name, { type:'application/pdf' });
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files:[file] }))) {
    await navigator.share({ files:[file], title: isDirect ? 'Comprovante de venda' : 'Detalhamento da compra' });
    return { shared:true, downloaded:false };
  }
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href=url; link.download=name; document.body.appendChild(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  return { shared:false, downloaded:true };
};
