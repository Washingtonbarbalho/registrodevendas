import { formatCurrency, formatDate } from './utils.js';
import { getHistoryCashAmount, getInstallmentFaceAmount } from './financial-core-v70.js';

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
const loadJsPdf = async () => {
  const module = await import('https://esm.sh/jspdf@2.5.1');
  const JsPdf = module.jsPDF || module.default?.jsPDF || module.default;
  if (!JsPdf) throw new Error('Biblioteca de PDF indisponível.');
  return JsPdf;
};
const safeFilePart = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase();
const shareOrDownloadPdf = async ({ blob, name, title }) => {
  const file = new File([blob], name, { type:'application/pdf' });
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files:[file] }))) {
    await navigator.share({ files:[file], title });
    return { shared:true, downloaded:false };
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { shared:false, downloaded:true };
};

export const SALE_PDF_INSTALLMENT_HEADER_STYLE = Object.freeze({
  fillColor: Object.freeze([15, 23, 42]),
  borderColor: Object.freeze([15, 23, 42]),
  textColor: Object.freeze([255, 255, 255])
});

export const INSTALLMENT_BOOKLET_LAYOUT = Object.freeze({
  pageFormat: 'a4',
  pageOrientation: 'portrait',
  cardsPerPage: 4,
  margin: 10,
  cardHeight: 64,
  cardGap: 5,
  storeCopyWidth: 68
});

export const generateSalePdfBlob = async ({ sale, userProfile = {}, type = 'detalhe', installment = null, historyItem = null }) => {
  if (!sale) throw new Error('Venda não informada.');
  const JsPdf = await loadJsPdf();
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
    if (type === 'recibo' && installment) { const paidValue = historyItem ? getHistoryCashAmount(historyItem) : installment.originalAmount || installment.amount; const paidDate = historyItem ? historyItem.date : installment.paidAt; rule(); text('PAGAMENTO REGISTRADO', { bold:true, size:10, color:[4,120,87] }); text(`Parcela ${installment.number}/${sale.installmentsCount || sale.installments?.length || 1}`); text(`Valor pago: ${formatCurrency(paidValue || 0)}`, { bold:true }); text(`Data: ${formatDate(cleanDate(paidDate))}`); }
    rule(); text('PARCELAS', { bold:true, size:10 }); ensure(10);
    const cols = [18, 38, 38, usable - 94]; let x = margin;
    ['Nº','Vencimento','Valor','Situação'].forEach((label,i) => {
      pdf.setFillColor(...SALE_PDF_INSTALLMENT_HEADER_STYLE.fillColor);
      pdf.setDrawColor(...SALE_PDF_INSTALLMENT_HEADER_STYLE.borderColor);
      pdf.rect(x,y,cols[i],8,'FD');
      pdf.setFont('helvetica','bold');
      pdf.setFontSize(7);
      pdf.setTextColor(...SALE_PDF_INSTALLMENT_HEADER_STYLE.textColor);
      pdf.text(label,x+1.5,y+5);
      x += cols[i];
    });
    y += 8;
    (sale.installments || []).forEach(inst => { ensure(8); x=margin; const status = inst.paid ? `Pago${inst.paidAt ? ' ' + formatDate(cleanDate(inst.paidAt)) : ''}` : cleanDate(inst.dueDate) < cleanDate(new Date().toISOString()) ? 'Atrasada' : 'Em aberto'; [String(inst.number), formatDate(cleanDate(inst.dueDate)), formatCurrency(inst.originalAmount || inst.amount || 0), status].forEach((value,i)=>{pdf.setFillColor(255,255,255);pdf.setDrawColor(226,232,240);pdf.rect(x,y,cols[i],8,'FD');pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.setTextColor(51,65,85);pdf.text(pdf.splitTextToSize(value,cols[i]-3)[0] || '',x+1.5,y+5);x+=cols[i];}); y += 8; });
    if (sale.notes) { y += 5; text(`Observações: ${sale.notes}`, { size:8 }); }
    if (sale.status === 'canceled') { y += 4; text(`VENDA CANCELADA${sale.cancelReason ? ` · ${sale.cancelReason}` : ''}`, { bold:true, color:[185,28,28] }); }
  }
  return pdf.output('blob');
};

const installmentBookletStatus = (sale, installment) => {
  if (sale?.status === 'canceled') return { label: 'VENDA CANCELADA', color: [185, 28, 28] };
  if (installment?.paid) {
    const paidDate = cleanDate(installment.paidAt);
    return { label: paidDate ? `PAGA EM ${formatDate(paidDate)}` : 'PAGA', color: [4, 120, 87] };
  }
  const dueDate = cleanDate(installment?.dueDate);
  const today = cleanDate(new Date().toISOString());
  if (dueDate && dueDate < today) return { label: 'VENCIDA', color: [185, 28, 28] };
  return { label: 'EM ABERTO', color: [71, 85, 105] };
};

const bookletText = (pdf, value, x, y, width, options = {}) => {
  pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
  pdf.setFontSize(options.size || 7);
  pdf.setTextColor(...(options.color || [51, 65, 85]));
  const line = pdf.splitTextToSize(String(value ?? ''), width)[0] || '';
  pdf.text(line, x, y, options.align ? { align: options.align } : undefined);
};

const bookletField = (pdf, label, value, x, y, width, options = {}) => {
  bookletText(pdf, label.toUpperCase(), x, y, width, { size: 5.5, bold: true, color: [100, 116, 139] });
  bookletText(pdf, value, x, y + 4.5, width, { size: options.size || 8, bold: options.bold !== false, color: options.color });
};

const drawInstallmentBookletCard = ({ pdf, sale, installment, index, userProfile, x, y, width, height }) => {
  const store = userProfile?.storeName || 'Registro de Vendas';
  const storePhone = userProfile?.phone || '';
  const customer = sale?.customerName || 'Cliente';
  const customerPhone = sale?.customerPhone || '';
  const totalInstallments = Number(sale?.installmentsCount) || sale?.installments?.length || 1;
  const installmentNumber = Number(installment?.number) || index + 1;
  const installmentValue = getInstallmentFaceAmount(installment);
  const dueDate = cleanDate(installment?.dueDate);
  const status = installmentBookletStatus(sale, installment);
  const storeCopyWidth = Math.min(INSTALLMENT_BOOKLET_LAYOUT.storeCopyWidth, width * .4);
  const customerX = x + storeCopyWidth;
  const customerWidth = width - storeCopyWidth;
  const headerHeight = 10;

  pdf.setLineWidth(.35);
  pdf.setDrawColor(148, 163, 184);
  pdf.setFillColor(255, 255, 255);
  pdf.rect(x, y, width, height, 'FD');

  pdf.setFillColor(245, 158, 11);
  pdf.setDrawColor(245, 158, 11);
  pdf.rect(x, y, storeCopyWidth, headerHeight, 'FD');
  bookletText(pdf, 'VIA DA LOJA', x + 4, y + 4.4, storeCopyWidth - 8, { size: 8, bold: true, color: [15, 23, 42] });
  bookletText(pdf, 'Destacar e guardar no pagamento', x + 4, y + 8, storeCopyWidth - 8, { size: 5, color: [51, 65, 85] });

  pdf.setFillColor(15, 23, 42);
  pdf.setDrawColor(15, 23, 42);
  pdf.rect(customerX, y, customerWidth, headerHeight, 'FD');
  bookletText(pdf, store, customerX + 4, y + 4.4, customerWidth - 43, { size: 8, bold: true, color: [255, 255, 255] });
  bookletText(pdf, 'CARNÊ DO CLIENTE', x + width - 4, y + 4.4, 36, { size: 6, bold: true, color: [255, 255, 255], align: 'right' });
  if (storePhone) bookletText(pdf, storePhone, customerX + 4, y + 8, customerWidth - 8, { size: 5, color: [203, 213, 225] });

  pdf.setDrawColor(100, 116, 139);
  pdf.setLineDashPattern([1.6, 1.6], 0);
  pdf.line(customerX, y, customerX, y + height);
  pdf.setLineDashPattern([], 0);
  bookletText(pdf, 'DESTACAR', customerX - 1.5, y + height - 2.5, 24, { size: 4.5, bold: true, color: [100, 116, 139], align: 'right' });

  bookletField(pdf, 'Cliente', customer, x + 4, y + 15, storeCopyWidth - 8, { size: 7.5 });
  bookletField(pdf, 'Parcela', `${installmentNumber}/${totalInstallments}`, x + 4, y + 25, 22, { size: 8 });
  bookletField(pdf, 'Vencimento', dueDate ? formatDate(dueDate) : '--/--/----', x + 29, y + 25, storeCopyWidth - 33, { size: 7 });
  bookletField(pdf, 'Valor da parcela', formatCurrency(installmentValue), x + 4, y + 36, storeCopyWidth - 8, { size: 10.5 });
  bookletText(pdf, 'Pago em: ____/____/________', x + 4, y + 51, storeCopyWidth - 8, { size: 5.8, bold: true });
  bookletText(pdf, 'Assinatura/caixa: __________________', x + 4, y + 57, storeCopyWidth - 8, { size: 5.4 });
  bookletText(pdf, status.label, x + 4, y + 62, storeCopyWidth - 8, { size: 5.4, bold: true, color: status.color });

  const contentX = customerX + 5;
  const contentWidth = customerWidth - 10;
  bookletText(pdf, `Contrato ${contractId(sale)}  |  Venda ${saleMoment(sale)}`, contentX, y + 15, contentWidth, { size: 5.8, color: [100, 116, 139] });
  bookletField(pdf, 'Cliente', customer, contentX, y + 21, contentWidth * .64, { size: 7.5 });
  if (customerPhone) bookletField(pdf, 'Telefone', customerPhone, contentX + contentWidth * .66, y + 21, contentWidth * .34, { size: 7 });

  const boxY = y + 31;
  const boxHeight = 18;
  const boxGap = 3;
  const firstWidth = 23;
  const secondWidth = 37;
  const thirdWidth = contentWidth - firstWidth - secondWidth - boxGap * 2;
  const boxes = [
    { x: contentX, width: firstWidth, label: 'Parcela', value: `${installmentNumber}/${totalInstallments}`, size: 8.5 },
    { x: contentX + firstWidth + boxGap, width: secondWidth, label: 'Vencimento', value: dueDate ? formatDate(dueDate) : '--/--/----', size: 7 },
    { x: contentX + firstWidth + secondWidth + boxGap * 2, width: thirdWidth, label: 'Valor', value: formatCurrency(installmentValue), size: 9.5 }
  ];
  boxes.forEach(box => {
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(box.x, boxY, box.width, boxHeight, 'FD');
    bookletText(pdf, box.label.toUpperCase(), box.x + 3, boxY + 5, box.width - 6, { size: 5, bold: true, color: [100, 116, 139] });
    bookletText(pdf, box.value, box.x + 3, boxY + 12.7, box.width - 6, { size: box.size, bold: true, color: [15, 23, 42] });
  });

  bookletText(pdf, status.label, contentX, y + 55, contentWidth, { size: 6.2, bold: true, color: status.color });
  bookletText(pdf, 'Documento não fiscal. Apresente esta via no pagamento.', contentX, y + 61.5, contentWidth, { size: 5, color: [100, 116, 139] });
};

export const generateInstallmentBookletPdfBlob = async ({ sale, userProfile = {} }) => {
  if (!sale) throw new Error('Venda não informada.');
  if (sale.saleType === 'direct') throw new Error('O carnê está disponível somente para vendas a prazo.');
  const installments = Array.isArray(sale.installments) ? sale.installments : [];
  if (installments.length === 0) throw new Error('Esta venda não possui parcelas para gerar o carnê.');

  const JsPdf = await loadJsPdf();
  const pdf = new JsPdf({
    unit: 'mm',
    format: INSTALLMENT_BOOKLET_LAYOUT.pageFormat,
    orientation: INSTALLMENT_BOOKLET_LAYOUT.pageOrientation
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const cardWidth = pageWidth - INSTALLMENT_BOOKLET_LAYOUT.margin * 2;

  installments.forEach((installment, index) => {
    const pageIndex = index % INSTALLMENT_BOOKLET_LAYOUT.cardsPerPage;
    if (index > 0 && pageIndex === 0) pdf.addPage();
    drawInstallmentBookletCard({
      pdf,
      sale,
      installment,
      index,
      userProfile,
      x: INSTALLMENT_BOOKLET_LAYOUT.margin,
      y: INSTALLMENT_BOOKLET_LAYOUT.margin + pageIndex * (INSTALLMENT_BOOKLET_LAYOUT.cardHeight + INSTALLMENT_BOOKLET_LAYOUT.cardGap),
      width: cardWidth,
      height: INSTALLMENT_BOOKLET_LAYOUT.cardHeight
    });
  });

  return pdf.output('blob');
};

export const shareSalePdf = async options => {
  const blob = await generateSalePdfBlob(options);
  const sale = options?.sale;
  const isDirect = sale?.saleType === 'direct';
  const name = `${isDirect ? 'comprovante-venda' : 'contrato'}-${sale?.id ? sale.id.slice(-6) : Date.now()}.pdf`;
  return shareOrDownloadPdf({ blob, name, title: isDirect ? 'Comprovante de venda' : 'Detalhamento da compra' });
};

export const shareInstallmentBookletPdf = async options => {
  const blob = await generateInstallmentBookletPdfBlob(options);
  const sale = options?.sale;
  const customerPart = safeFilePart(sale?.customerName) || 'cliente';
  const salePart = sale?.id ? safeFilePart(sale.id.slice(-6)) : String(Date.now());
  return shareOrDownloadPdf({
    blob,
    name: `carne-${customerPart}-${salePart}.pdf`,
    title: `Carnê de parcelas - ${sale?.customerName || 'Cliente'}`
  });
};
