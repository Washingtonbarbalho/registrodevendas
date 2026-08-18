import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.2.0';
import { createPortal } from 'https://esm.sh/react-dom@18.2.0';
import { db, APP_ID } from './firebase-config.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { formatCurrency, getBrazilDateString, getCurrentMonthStart } from './utils.js';
import { buildReport, PAYMENT_FILTERS, REPORT_DEFINITIONS, reportPeriodLabel } from './reports-engine-v62.js';

const h = React.createElement;
const EMPTY_FINANCIAL = { entries: [], accounts: [] };
const REPORT_SYMBOLS = {
  result: '↗', sales: '▣', 'sale-profit': '$', products: '◇', stock: '□', purchases: '↓', credit: '₿'
};

const shiftDate = (dateValue, days) => {
  const [year, month, day] = String(dateValue || '').split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const normalizeFinancialData = value => ({ entries: Array.isArray(value?.entries) ? value.entries : [], accounts: Array.isArray(value?.accounts) ? value.accounts : [] });
const useBodyLock = open => useEffect(() => {
  if (!open) return undefined;
  const previous = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  return () => { document.body.style.overflow = previous; };
}, [open]);

const MetricCard = ({ item }) => h('article', { className: `reports62-metric ${item.tone ? `is-${item.tone}` : ''}` },
  h('span', null, item.label), h('strong', null, item.display)
);
const BarChart = ({ chart }) => {
  if (!chart?.items?.length) return null;
  const max = Math.max(1, ...chart.items.map(item => Number(item.value) || 0));
  return h('section', { className: 'reports62-chart-card' },
    h('div', { className: 'reports62-section-title' }, h('span', { 'aria-hidden': 'true' }, '▥'), h('strong', null, chart.title)),
    h('div', { className: 'reports62-chart-list' }, chart.items.map((item, index) => h('div', { className: 'reports62-chart-row', key: `${item.label}-${index}` },
      h('div', { className: 'reports62-chart-label' }, h('span', { title: item.label }, item.label), h('strong', null, item.display || formatCurrency(item.value))),
      h('div', { className: 'reports62-chart-track' }, h('span', { style: { width: `${Math.max(item.value > 0 ? 3 : 0, Math.min(100, (Number(item.value) || 0) / max * 100))}%` } }))
    )))
  );
};
const ReportTable = ({ report }) => h('section', { className: 'reports62-table-card' },
  h('div', { className: 'reports62-section-title' }, h('span', { 'aria-hidden': 'true' }, '≡'), h('strong', null, 'Detalhamento')),
  report.rows.length === 0 ? h('div', { className: 'reports62-empty-table' }, 'Nenhum registro encontrado no período selecionado.') :
    h('div', { className: 'reports62-table-scroll' }, h('table', { className: 'reports62-table' },
      h('thead', null, h('tr', null, report.columns.map(column => h('th', { key: column }, column)))),
      h('tbody', null, report.rows.map((row, rowIndex) => h('tr', { key: rowIndex }, row.map((cell, cellIndex) => h('td', { key: cellIndex }, cell)))))
    ))
);

const generatePdf = async ({ report, storeName, startDate, endDate, paymentFilter }) => {
  const module = await import('https://esm.sh/jspdf@2.5.1');
  const JsPdf = module.jsPDF || module.default?.jsPDF || module.default;
  if (!JsPdf) throw new Error('Biblioteca de PDF indisponível.');
  const pdf = new JsPdf({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = 210, pageHeight = 297, margin = 15, usable = 180;
  let y = 16;
  const ensure = height => { if (y + height > pageHeight - 15) { pdf.addPage(); y = 16; } };
  const line = (text, options = {}) => {
    const size = options.size || 9;
    pdf.setFont('helvetica', options.bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(...(options.color || [51,65,85]));
    const lines = pdf.splitTextToSize(String(text ?? ''), options.width || usable); ensure(lines.length * 4.5 + 2); pdf.text(lines, options.x || margin, y); y += lines.length * 4.5 + (options.after ?? 2);
  };
  pdf.setFillColor(15,23,42); pdf.rect(0,0,pageWidth,32,'F'); pdf.setTextColor(255,255,255); pdf.setFont('helvetica','bold'); pdf.setFontSize(17); pdf.text(report.title, margin, 14);
  pdf.setFont('helvetica','normal'); pdf.setFontSize(9); pdf.text(storeName || 'Registro de Vendas', margin, 21); pdf.text(`Período: ${reportPeriodLabel(startDate,endDate)}`, margin, 27); y = 40;
  if (report.id === 'sales' && paymentFilter !== 'all') line(`Forma de pagamento: ${PAYMENT_FILTERS.find(([v]) => v === paymentFilter)?.[1] || paymentFilter}`, { bold: true });
  line('Resumo', { size: 11, bold: true, color: [15,23,42], after: 3 });
  report.metrics.forEach(metric => { ensure(8); pdf.setFillColor(248,250,252); pdf.roundedRect(margin,y-4,usable,7,1.5,1.5,'F'); pdf.setFontSize(8); pdf.setFont('helvetica','normal'); pdf.setTextColor(100,116,139); pdf.text(metric.label,margin+2,y); pdf.setFont('helvetica','bold'); pdf.setTextColor(15,23,42); pdf.text(metric.display,pageWidth-margin-2,y,{align:'right'}); y += 9; });
  if (report.chart?.items?.length) { y += 2; line(report.chart.title, { size: 11, bold: true, color: [15,23,42], after: 3 }); report.chart.items.slice(0,10).forEach(item => line(`${item.label}: ${item.display || formatCurrency(item.value)}`, { size: 8 })); }
  y += 3; line('Detalhamento', { size: 11, bold: true, color: [15,23,42], after: 3 });
  if (!report.rows.length) line('Nenhum registro encontrado no período selecionado.', { color: [100,116,139] });
  else report.rows.forEach((row,index) => line(`${index+1}. ${row.map((cell,i) => `${report.columns[i] || `Campo ${i+1}`}: ${cell}`).join(' | ')}`, { size: 7.5 }));
  if (report.notes?.length) { y += 2; line('Observações do relatório', { size: 10, bold: true }); report.notes.forEach(note => line(`• ${note}`, { size: 8, color: [100,116,139] })); }
  const pages = pdf.getNumberOfPages(); for (let page=1; page<=pages; page++) { pdf.setPage(page); pdf.setFontSize(7); pdf.setTextColor(148,163,184); pdf.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · Página ${page}/${pages}`, pageWidth/2, pageHeight-7, { align:'center' }); }
  pdf.save(`relatorio-${report.id}-${startDate}-${endDate}.pdf`);
};

const ReportModal = ({ definition, sales, products, financialData, storeName, onClose }) => {
  const today = getBrazilDateString();
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState(getCurrentMonthStart());
  const [endDate, setEndDate] = useState(today);
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [pdfLoading, setPdfLoading] = useState(false);
  useBodyLock(true);
  useEffect(() => { setPeriod('month'); setStartDate(getCurrentMonthStart()); setEndDate(getBrazilDateString()); setPaymentFilter('all'); }, [definition?.id]);
  const applyPeriod = next => { const current = getBrazilDateString(); setPeriod(next); if (next === 'week') { setStartDate(shiftDate(current,-6)); setEndDate(current); } if (next === 'month') { setStartDate(getCurrentMonthStart()); setEndDate(current); } };
  const report = useMemo(() => buildReport({ reportId: definition.id, sales, products, financialData, startDate, endDate, paymentFilter }), [definition, sales, products, financialData, startDate, endDate, paymentFilter]);
  const invalidPeriod = !startDate || !endDate || startDate > endDate;
  const handlePdf = async () => { if (invalidPeriod) return; setPdfLoading(true); try { await generatePdf({ report, storeName, startDate, endDate, paymentFilter }); } catch (error) { console.error(error); alert('Não foi possível gerar o PDF.'); } finally { setPdfLoading(false); } };
  return createPortal(h('div', { className:'reports62-overlay', role:'dialog', 'aria-modal':'true' }, h('div', { className:'reports62-modal' },
    h('header', { className:'reports62-modal-header' }, h('div', { className:'reports62-modal-title' }, h('span',null,`Relatório ${definition.number}`), h('h2',null,definition.title), h('p',null,definition.description)), h('button',{type:'button',className:'reports62-close',onClick:onClose,'aria-label':'Fechar'},'×')),
    h('div',{className:'reports62-modal-scroll'}, h('section',{className:'reports62-filter-panel'}, h('div',{className:'reports62-filter-heading'},h('strong',null,'Filtros do relatório')),
      h('div',{className:'reports62-period-buttons'}, [['week','Últimos 7 dias'],['month','Mês atual'],['custom','Personalizado']].map(([value,label]) => h('button',{type:'button',key:value,className:period===value?'is-active':'',onClick:()=>applyPeriod(value)},label))),
      h('div',{className:'reports62-filter-grid'}, h('label',null,h('span',null,'Data inicial'),h('input',{type:'date',value:startDate,onChange:e=>{setStartDate(e.target.value);setPeriod('custom');}})), h('label',null,h('span',null,'Data final'),h('input',{type:'date',value:endDate,onChange:e=>{setEndDate(e.target.value);setPeriod('custom');}})), definition.id==='sales' && h('label',null,h('span',null,'Forma de pagamento'),h('select',{value:paymentFilter,onChange:e=>setPaymentFilter(e.target.value)},PAYMENT_FILTERS.map(([v,l])=>h('option',{key:v,value:v},l))))), invalidPeriod && h('div',{className:'reports62-period-error'},'A data inicial não pode ser posterior à data final.')),
      !invalidPeriod && h('div',{className:'reports62-report-body'}, h('section',{className:'reports62-report-intro'},h('div',null,h('span',null,storeName||'Registro de Vendas'),h('h3',null,report.title),h('p',null,`${report.subtitle} · ${reportPeriodLabel(startDate,endDate)}`))), h('div',{className:'reports62-metrics-grid'},report.metrics.map(item=>h(MetricCard,{key:item.label,item}))), h(BarChart,{chart:report.chart}), h(ReportTable,{report}), report.notes?.length>0 && h('section',{className:'reports62-notes'},h('strong',null,'Observações do relatório'),report.notes.map((note,index)=>h('p',{key:index},note))))),
    h('footer',{className:'reports62-modal-footer'},h('div',{className:'reports62-footer-period'},invalidPeriod?'Período inválido':reportPeriodLabel(startDate,endDate)),h('div',{className:'reports62-footer-actions'},h('button',{type:'button',className:'reports62-secondary-btn',onClick:onClose},'Fechar'),h('button',{type:'button',className:'reports62-pdf-btn',disabled:invalidPeriod||pdfLoading,onClick:handlePdf},pdfLoading?'Gerando PDF...':'Gerar PDF')))
  )),document.body);
};

export const AbaRelatorios = ({ userId, sales = [], products = [], userProfile = {} }) => {
  const [selectedReport, setSelectedReport] = useState(null);
  const [financialData, setFinancialData] = useState(EMPTY_FINANCIAL);
  const [financialWarning, setFinancialWarning] = useState('');
  useEffect(() => { if (!userId) return undefined; const profileRef = doc(db,'artifacts',APP_ID,'users',userId,'profile','info'); return onSnapshot(profileRef,snapshot=>{setFinancialData(normalizeFinancialData(snapshot.data()?.financialData));setFinancialWarning('');},error=>{console.error(error);setFinancialData(EMPTY_FINANCIAL);setFinancialWarning('Os dados manuais do Financeiro não puderam ser carregados. Os demais relatórios continuam disponíveis.');}); },[userId]);
  const selectedDefinition = REPORT_DEFINITIONS.find(item => item.id === selectedReport) || null;
  return h(React.Fragment,null,
    h('div',{className:'reports62-page'}, h('div',{className:'page-heading reports62-heading'},h('div',{className:'page-heading-copy'},h('h1',{className:'page-title'},'Relatórios'),h('p',{className:'page-description'},'Análises gerenciais de vendas, lucro, produtos, estoque, compras, crediário e resultado financeiro.')),h('div',{className:'reports62-count'},h('strong',null,REPORT_DEFINITIONS.length),h('span',null,'relatórios'))),
      financialWarning && h('div',{className:'reports62-warning'},financialWarning), h('section',{className:'reports62-guide'},h('div',{className:'reports62-guide-icon'},'▥'),h('div',null,h('strong',null,'Escolha o relatório que deseja analisar'),h('p',null,'Selecione últimos 7 dias, mês atual ou um período personalizado e gere PDF quando precisar.'))),
      h('div',{className:'reports62-grid'},REPORT_DEFINITIONS.map(definition=>h('button',{type:'button',key:definition.id,className:'reports62-card',onClick:()=>setSelectedReport(definition.id)},h('div',{className:`reports62-card-icon is-${definition.id}`},REPORT_SYMBOLS[definition.id]||'•'),h('div',{className:'reports62-card-copy'},h('span',null,`Relatório ${definition.number}`),h('strong',null,definition.title),h('p',null,definition.description)),h('div',{className:'reports62-card-arrow'},'›'))))
    ), selectedDefinition && h(ReportModal,{definition:selectedDefinition,sales,products,financialData,storeName:userProfile?.storeName||userProfile?.name||'Registro de Vendas',onClose:()=>setSelectedReport(null)}));
};
