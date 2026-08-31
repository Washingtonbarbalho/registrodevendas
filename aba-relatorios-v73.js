import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.2.0';
import { createPortal } from 'https://esm.sh/react-dom@18.2.0';
import { db, APP_ID } from './firebase-config.js?v=92';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { formatCurrency, getBrazilDateString, getCurrentMonthEnd, getCurrentMonthStart } from './utils.js';
import { DateRangeFilter, DateRangePicker } from './components.js?v=92';
import {
  buildReport,
  PAYMENT_FILTERS,
  REPORT_DEFINITIONS,
  REPORT_GROUPS,
  reportPeriodLabel,
  SALE_CHANNELS
} from './reports-engine-v73.js?v=92';
import { createReportCsvFile, createReportExcelFile, downloadFile, shareFile } from './report-export-v74.js?v=92';
import { buildRepurchaseSuggestions, buildWhatsappUrl } from './commercial-engine-v74.js?v=92';
import { buildExecutiveInsights } from './executive-insights-v79.js?v=92';
import { getReportCategories, getReportFilterCapabilities } from './report-filters-v79.js?v=92';
import { resolveAnalysisPeriod } from './analysis-period-v79.js?v=92';
import { showAppDateRange } from './ui-interactions-v81.js?v=92';

const h = React.createElement;
const EMPTY_FINANCIAL = { entries: [], accounts: [] };

const ICON_PATHS = {
  result: ['M4 18l5-5 4 4 7-8', 'M15 9h5v5'],
  'period-comparison': ['M4 7h11', 'M12 4l3 3-3 3', 'M20 17H9', 'M12 14l-3 3 3 3'],
  'net-result': ['M12 3v18', 'M17 7H9a4 4 0 0 0 0 8h6a4 4 0 0 1 0 8H7'],
  'sales-channels': ['M5 12h6', 'M13 6h6', 'M13 18h6', 'M11 12l2-6', 'M11 12l2 6', 'M3 10h2v4H3'],
  'stock-replenishment': ['M4 7l8-4 8 4-8 4-8-4', 'M4 7v10l8 4 8-4V7', 'M12 11v10', 'M17 13v4', 'M15 15h4'],
  'stock-abc': ['M4 19V5', 'M4 19h16', 'M8 15v-4', 'M13 15V8', 'M18 15v-2'],
  'repeat-customers': ['M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M2 21c0-4 2.5-7 6-7s6 3 6 7', 'M18 8a4 4 0 1 1-3 7', 'M15 15h3v-3'],
  sales: ['M4 5h16v14H4z', 'M7 9h10', 'M7 13h7'],
  'sale-profit': ['M12 3v18', 'M16.5 7.5c0-1.8-2-3-4.5-3s-4.5 1.2-4.5 3 1.7 2.7 4.5 3 4.5 1.2 4.5 3-2 3-4.5 3-4.5-1.2-4.5-3'],
  products: ['M4 7l8-4 8 4-8 4-8-4', 'M4 7v10l8 4 8-4V7', 'M12 11v10'],
  stock: ['M4 5h16v5H4z', 'M4 14h16v5H4z', 'M8 7.5h3', 'M8 16.5h3'],
  purchases: ['M3 6h11v9H3z', 'M14 9h4l3 3v3h-7z', 'M7 18a1.5 1.5 0 1 0 0 .01', 'M18 18a1.5 1.5 0 1 0 0 .01'],
  credit: ['M4 6h16v12H4z', 'M15 10h5v4h-5z'],
  customers: ['M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M2 21c0-4 2.5-7 6-7s6 3 6 7', 'M16 7h6', 'M19 4v6'],
  'card-fees': ['M3 6h18v12H3z', 'M3 10h18', 'M7 15h4', 'M16 14l4 4', 'M20 14l-4 4'],
  discounts: ['M4 4h6l10 10-6 6L4 10z', 'M8 8h.01', 'M15 9l-6 6'],
  chart: ['M5 19V10', 'M12 19V5', 'M19 19v-7'],
  table: ['M4 5h16v14H4z', 'M4 10h16', 'M10 5v14'],
  filter: ['M4 6h16', 'M7 12h10', 'M10 18h4']
};

const ReportIcon = ({ name, size = 22 }) => h('svg', {
  viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true'
}, ...(ICON_PATHS[name] || ICON_PATHS.table).map((path, index) => h('path', { d: path, key: index })));

const normalizeFinancialData = value => ({
  entries: Array.isArray(value?.entries) ? value.entries : [],
  accounts: Array.isArray(value?.accounts) ? value.accounts : []
});

const useBodyLock = open => useEffect(() => {
  if (!open) return undefined;
  const previous = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  return () => { document.body.style.overflow = previous; };
}, [open]);

const MetricCard = ({ item }) => h('article', {
  className: `reports62-metric ${item.tone ? `is-${item.tone}` : ''}`
}, h('span', null, item.label), h('strong', null, item.display));

const ComparisonPanel = ({ comparison }) => {
  if (!comparison?.metrics?.length) return null;
  return h('section', { className: 'reports73-comparison' },
    h('div', { className: 'reports73-comparison-heading' },
      h('div', null,
        h('strong', null, 'Comparação com o período anterior'),
        h('span', null, reportPeriodLabel(comparison.previousPeriod.startDate, comparison.previousPeriod.endDate))
      ),
      h('span', { className: 'reports73-equivalent-days' }, `${comparison.days} dias × ${comparison.days} dias`)
    ),
    h('div', { className: 'reports73-comparison-grid' }, comparison.metrics.slice(0, 4).map(item =>
      h('article', { className: 'reports73-comparison-card', key: item.label },
        h('span', { className: 'reports73-comparison-label' }, item.label),
        h('strong', null, item.currentDisplay),
        h('div', { className: 'reports73-comparison-detail' },
          h('span', null, `Antes: ${item.previousDisplay}`),
          h('span', { className: `reports73-trend is-${item.tone}` }, item.deltaDisplay)
        )
      )
    ))
  );
};

const BarChart = ({ chart }) => {
  if (!chart?.items?.length) return null;
  const max = Math.max(1, ...chart.items.map(item => Number(item.value) || 0));
  return h('section', { className: 'reports62-chart-card' },
    h('div', { className: 'reports62-section-title' }, h(ReportIcon, { name: 'chart', size: 17 }), h('strong', null, chart.title)),
    h('div', { className: 'reports62-chart-list' }, chart.items.map((item, index) =>
      h('div', { className: 'reports62-chart-row', key: `${item.label}-${index}` },
        h('div', { className: 'reports62-chart-label' },
          h('span', { title: item.label }, item.label),
          h('strong', null, item.display || formatCurrency(item.value))
        ),
        h('div', { className: 'reports62-chart-track' }, h('span', {
          style: { width: `${Math.max(item.value > 0 ? 3 : 0, Math.min(100, (Number(item.value) || 0) / max * 100))}%` }
        }))
      )
    ))
  );
};

const ReportTable = ({ report, storeName }) => h('section', { className: 'reports62-table-card' },
  h('div', { className: 'reports62-section-title' }, h(ReportIcon, { name: 'table', size: 17 }), h('strong', null, 'Detalhamento')),
  report.rows.length === 0
    ? h('div', { className: 'reports62-empty-table' }, 'Nenhum registro encontrado no período selecionado.')
    : h('div', { className: 'reports62-table-scroll' },
      h('table', { className: 'reports62-table' },
        h('thead', null, h('tr', null,
          report.columns.map(column => h('th', { key: column }, column)),
          report.rowActions && h('th', { key: 'actions' }, 'Ação rápida')
        )),
        h('tbody', null, report.rows.map((row, rowIndex) =>
          h('tr', { key: rowIndex },
            row.map((cell, cellIndex) => h('td', { key: cellIndex }, cell)),
            report.rowActions && h('td', { key: 'action' }, (() => {
              const action = report.rowActions[rowIndex];
              const message = action?.type === 'repurchase'
                ? `Olá, ${action.customerName}! Aqui é da ${storeName || 'nossa loja'}. Posso ajudar você a escolher sua próxima fragrância?`
                : `Olá, ${action?.customerName || 'cliente'}! Aqui é da ${storeName || 'nossa loja'}. Como posso ajudar?`;
              const url = buildWhatsappUrl(action?.phone, message);
              return url ? h('a', {
                href: url,
                target: '_blank',
                rel: 'noopener noreferrer',
                className: 'reports79-whatsapp-action'
              }, 'WhatsApp') : h('span', { className: 'reports79-without-phone' }, 'Sem telefone');
            })())
          )
        ))
      )
    )
);

const generatePdf = async ({ report, storeName, startDate, endDate, paymentFilter, saleChannel, detailLevel = 'detailed' }) => {
  const module = await import('https://esm.sh/jspdf@2.5.1');
  const JsPdf = module.jsPDF || module.default?.jsPDF || module.default;
  if (!JsPdf) throw new Error('Biblioteca de PDF indisponível.');

  const landscape = detailLevel === 'detailed' && (report.columns?.length || 0) >= 6;
  const pdf = new JsPdf({ unit: 'mm', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const usable = width - margin * 2;
  const limit = height - 14;
  let y = 16;

  const ensure = needed => {
    if (y + needed <= limit) return;
    pdf.addPage();
    y = 16;
  };
  const line = (text, options = {}) => {
    const size = options.size || 9;
    pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(...(options.color || [51, 65, 85]));
    const lines = pdf.splitTextToSize(String(text ?? ''), options.width || usable);
    const lineHeight = size * .42 + 1.1;
    ensure(lines.length * lineHeight + 2);
    pdf.text(lines, options.x || margin, y);
    y += lines.length * lineHeight + (options.after ?? 2);
  };

  const drawTable = (columns, rows) => {
    if (!columns.length || !rows.length) return;
    const samples = rows.slice(0, 120);
    const weights = columns.map((column, index) => {
      let longest = String(column || '').length;
      samples.forEach(row => { longest = Math.max(longest, String(row?.[index] ?? '').length); });
      let weight = Math.min(28, Math.max(7, longest));
      const label = String(column || '').toLowerCase();
      if (/cliente|produto|descri|motivo|situa|pagamento|data|status|indicador/.test(label)) weight *= 1.2;
      if (/qtd|quant|unid|margem|rank|minimo|mínimo/.test(label)) weight *= .75;
      return weight;
    });
    const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    const widths = weights.map(weight => usable * weight / total);
    const pad = 1.4;
    const headerFont = landscape ? 6.2 : 6.7;
    const bodyFont = landscape ? 5.8 : 6.4;
    const lineHeight = 3.05;
    const wrap = (value, cellWidth, font) => {
      pdf.setFontSize(font);
      return pdf.splitTextToSize(String(value ?? ''), Math.max(5, cellWidth - pad * 2));
    };
    const drawHeader = () => {
      const wrapped = columns.map((column, index) => wrap(column, widths[index], headerFont));
      const rowHeight = Math.max(8, Math.max(...wrapped.map(lines => lines.length)) * lineHeight + 3.5);
      ensure(rowHeight);
      let x = margin;
      pdf.setFont('helvetica', 'bold');
      columns.forEach((_, index) => {
        pdf.setFillColor(15, 23, 42);
        pdf.setDrawColor(203, 213, 225);
        pdf.rect(x, y, widths[index], rowHeight, 'FD');
        pdf.setTextColor(255, 255, 255);
        pdf.text(wrapped[index], x + pad, y + 4);
        x += widths[index];
      });
      y += rowHeight;
    };

    drawHeader();
    rows.forEach((row, rowIndex) => {
      const wrapped = columns.map((_, index) => wrap(row?.[index] ?? '', widths[index], bodyFont));
      const rowHeight = Math.max(7.5, Math.max(...wrapped.map(lines => lines.length)) * lineHeight + 3.5);
      if (y + rowHeight > limit) {
        pdf.addPage();
        y = 16;
        drawHeader();
      }
      let x = margin;
      pdf.setFont('helvetica', 'normal');
      columns.forEach((_, index) => {
        pdf.setFillColor(...(rowIndex % 2 === 0 ? [248, 250, 252] : [255, 255, 255]));
        pdf.setDrawColor(226, 232, 240);
        pdf.rect(x, y, widths[index], rowHeight, 'FD');
        pdf.setTextColor(51, 65, 85);
        pdf.text(wrapped[index], x + pad, y + 4);
        x += widths[index];
      });
      y += rowHeight;
    });
  };

  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, width, 32, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(17);
  pdf.text(report.title, margin, 14);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(storeName || 'Registro de Vendas', margin, 21);
  pdf.text(`Período: ${reportPeriodLabel(startDate, endDate)}`, margin, 27);
  y = 40;

  if (report.id === 'sales' && paymentFilter !== 'all') {
    line(`Forma de pagamento: ${PAYMENT_FILTERS.find(([id]) => id === paymentFilter)?.[1] || paymentFilter}`, { bold: true });
  }
  if (saleChannel !== 'all') {
    line(`Canal: ${SALE_CHANNELS.find(([id]) => id === saleChannel)?.[1] || saleChannel}`, { bold: true });
  }
  if (report.creditPosition) {
    line(`Leitura da carteira: ${report.creditPosition.label}`, { bold: true });
  }

  line('Resumo', { size: 11, bold: true, color: [15, 23, 42], after: 3 });
  report.metrics.forEach(item => {
    ensure(8);
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(margin, y - 4, usable, 7, 1.5, 1.5, 'F');
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text(item.label, margin + 2, y);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(item.display, width - margin - 2, y, { align: 'right' });
    y += 9;
  });

  if (report.comparison && report.id !== 'period-comparison') {
    y += 3;
    line('Comparação com o período anterior', { size: 11, bold: true, color: [15, 23, 42], after: 2 });
    line(reportPeriodLabel(report.comparison.previousPeriod.startDate, report.comparison.previousPeriod.endDate), {
      size: 8, color: [100, 116, 139]
    });
    drawTable(['Indicador', 'Atual', 'Anterior', 'Variação'], report.comparison.metrics.map(item => [
      item.label, item.currentDisplay, item.previousDisplay, item.deltaDisplay
    ]));
    y += 5;
  }

  if (report.chart?.items?.length) {
    y += 2;
    line(report.chart.title, { size: 11, bold: true, color: [15, 23, 42], after: 3 });
    report.chart.items.slice(0, 10).forEach(item => line(`${item.label}: ${item.display || formatCurrency(item.value)}`, { size: 8 }));
  }
  if (detailLevel === 'detailed') {
    y += 3;
    line('Detalhamento', { size: 11, bold: true, color: [15, 23, 42], after: 3 });
    if (!report.rows.length) line('Nenhum registro encontrado no período selecionado.', { color: [100, 116, 139] });
    else drawTable(report.columns || [], report.rows || []);
  }

  if (report.notes?.length) {
    y += 4;
    line('Observações do relatório', { size: 10, bold: true });
    report.notes.forEach(note => line(`- ${note}`, { size: 8, color: [100, 116, 139] }));
  }
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(7);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · Página ${page}/${pageCount}`, width / 2, height - 7, { align: 'center' });
  }
  const filename = `relatorio-${report.id}-${detailLevel === 'executive' ? 'executivo' : 'detalhado'}-${startDate}-${endDate}.pdf`;
  const blob = pdf.output('blob');
  return new File([blob], filename, { type: 'application/pdf' });
};

const ReportModal = ({
  definition, sales, products, customers, financialData, storeName, onClose,
  analysisPeriod, analysisStartDate, analysisEndDate, onAnalysisPeriodChange,
  onAnalysisStartDateChange, onAnalysisEndDateChange
}) => {
  const [localPeriod, setLocalPeriod] = useState('month');
  const [localStartDate, setLocalStartDate] = useState(getCurrentMonthStart());
  const [localEndDate, setLocalEndDate] = useState(getCurrentMonthEnd());
  const period = analysisPeriod || localPeriod;
  const startDate = analysisStartDate || localStartDate;
  const endDate = analysisEndDate || localEndDate;
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [saleChannel, setSaleChannel] = useState('all');
  const [creditPositionMode, setCreditPositionMode] = useState('as-of');
  const [compareWithPrevious, setCompareWithPrevious] = useState(true);
  const [exportFormat, setExportFormat] = useState('pdf-detailed');
  const [exportLoading, setExportLoading] = useState('');
  useBodyLock(true);

  useEffect(() => {
    setPaymentFilter('all');
    setProductFilter('all');
    setCustomerFilter('all');
    setStatusFilter('all');
    setCategoryFilter('all');
    setSaleChannel('all');
    setCreditPositionMode('as-of');
    setCompareWithPrevious(true);
  }, [definition?.id]);

  const applyDateRange = selection => {
    setLocalPeriod('custom');
    setLocalStartDate(selection.startDate);
    setLocalEndDate(selection.endDate);
    onAnalysisPeriodChange?.('custom');
    onAnalysisStartDateChange?.(selection.startDate);
    onAnalysisEndDateChange?.(selection.endDate);
  };
  const applyPeriod = async next => {
    if (next === 'custom') {
      const selection = await showAppDateRange({ startDate, endDate });
      if (selection) applyDateRange(selection);
      return;
    }
    setLocalPeriod(next);
    onAnalysisPeriodChange?.(next);
    const selection = resolveAnalysisPeriod(next, getBrazilDateString());
    setLocalStartDate(selection.startDate);
    setLocalEndDate(selection.endDate);
    onAnalysisStartDateChange?.(selection.startDate);
    onAnalysisEndDateChange?.(selection.endDate);
  };
  const repurchaseSuggestions = useMemo(() => buildRepurchaseSuggestions({
    sales, products, customers, today: getBrazilDateString(), horizonDays: 14
  }), [sales, products, customers]);

  const report = useMemo(() => buildReport({
    reportId: definition.id,
    sales,
    products,
    customers,
    financialData,
    startDate,
    endDate,
    paymentFilter,
    productFilter,
    customerFilter,
    statusFilter,
    categoryFilter,
    saleChannel,
    creditPositionMode,
    repurchaseSuggestions,
    compareWithPrevious
  }), [definition.id, sales, products, customers, financialData, startDate, endDate, paymentFilter,
    productFilter, customerFilter, statusFilter, categoryFilter, saleChannel, creditPositionMode,
    repurchaseSuggestions, compareWithPrevious]);

  const invalidPeriod = !startDate || !endDate || startDate > endDate;
  const capabilities = getReportFilterCapabilities(definition.id);
  const categories = getReportCategories({ reportId: definition.id, products, financialData });
  const canCompare = ['result', 'sales', 'sale-profit', 'products', 'net-result', 'sales-channels', 'repeat-customers']
    .includes(definition.id);
  const exportInput = {
    report,
    storeName,
    startDate,
    endDate,
    paymentFilterLabel: PAYMENT_FILTERS.find(([id]) => id === paymentFilter)?.[1] || 'Todas as formas',
    saleChannelLabel: SALE_CHANNELS.find(([id]) => id === saleChannel)?.[1] || 'Todos os canais'
  };
  const generateSelectedFile = async () => {
    if (exportFormat === 'excel') return createReportExcelFile(exportInput);
    if (exportFormat === 'csv') return createReportCsvFile(exportInput);
    return generatePdf({
      report, storeName, startDate, endDate, paymentFilter, saleChannel,
      detailLevel: exportFormat === 'pdf-executive' ? 'executive' : 'detailed'
    });
  };
  const handleExport = async () => {
    if (invalidPeriod) return;
    setExportLoading('export');
    try {
      const file = await generateSelectedFile();
      downloadFile(file);
    } catch (error) {
      console.error(error);
      alert('Não foi possível gerar o arquivo selecionado.');
    } finally { setExportLoading(''); }
  };
  const handleShare = async () => {
    if (invalidPeriod) return;
    setExportLoading('share');
    try {
      const file = await generateSelectedFile();
      const result = await shareFile({
        file,
        title: report.title,
        text: `${storeName || 'Registro de Vendas'} · ${reportPeriodLabel(startDate, endDate)}`
      });
      if (result.downloaded) alert('O compartilhamento direto não está disponível neste aparelho. O arquivo foi baixado para você enviar.');
    } catch (error) {
      console.error(error);
      alert('Não foi possível compartilhar o relatório.');
    } finally { setExportLoading(''); }
  };

  return createPortal(
    h('div', { className: 'reports62-overlay', role: 'dialog', 'aria-modal': 'true' },
      h('div', { className: 'reports62-modal' },
        h('header', { className: 'reports62-modal-header' },
          h('div', { className: 'reports62-modal-title' },
            h('span', null, `Relatório ${definition.number}`),
            h('h2', null, definition.title),
            h('p', null, definition.description)
          ),
          h('button', { type: 'button', className: 'reports62-close', onClick: onClose, 'aria-label': 'Fechar' }, '×')
        ),
        h('div', { className: 'reports62-modal-scroll' },
          h('section', { className: 'reports62-filter-panel' },
            h('div', { className: 'reports62-filter-heading' }, h(ReportIcon, { name: 'filter', size: 17 }), h('strong', null, 'Filtros do relatório')),
            h('div', { className: 'reports62-period-buttons reports73-period-buttons' },
              [['week', '7 dias'], ['month', 'Mês atual'], ['last30', '30 dias'], ['custom', 'Personalizado']].map(([id, label]) =>
                h('button', { type: 'button', key: id, className: period === id ? 'is-active' : '', onClick: () => applyPeriod(id) }, label)
              )
            ),
            h('div', { className: 'reports62-filter-grid reports73-filter-grid' },
              h('div', { className: 'period82-report-field' },
                h('span', { className: 'period82-field-label' }, 'Período selecionado'),
                h(DateRangePicker, { startDate, endDate, onChange: applyDateRange })),
              capabilities.product && h('label', null, h('span', null, 'Produto'), h('select', {
                value: productFilter, onChange: event => setProductFilter(event.target.value)
              }, h('option', { value: 'all' }, 'Todos os produtos'), [...products]
                .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'pt-BR'))
                .map(product => h('option', { key: product.id, value: product.id }, product.name || 'Produto')))),
              capabilities.customer && h('label', null, h('span', null, 'Cliente'), h('select', {
                value: customerFilter, onChange: event => setCustomerFilter(event.target.value)
              }, h('option', { value: 'all' }, 'Todos os clientes'), [...customers]
                .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'pt-BR'))
                .map(customer => h('option', { key: customer.id, value: customer.id }, customer.name || 'Cliente')))),
              capabilities.payment && h('label', null, h('span', null, 'Forma de pagamento'), h('select', {
                value: paymentFilter, onChange: event => setPaymentFilter(event.target.value)
              }, PAYMENT_FILTERS.map(([id, label]) => h('option', { key: id, value: id }, label)))),
              capabilities.status && h('label', null, h('span', null, 'Situação'), h('select', {
                value: statusFilter, onChange: event => setStatusFilter(event.target.value)
              }, h('option', { value: 'all' }, 'Todas as situações'), ...(capabilities.productStatus
                ? [['available', 'Estoque adequado'], ['low', 'Estoque mínimo'], ['out', 'Sem estoque']]
                : [['open', 'Em aberto'], ['active', 'Ativas'], ['completed', 'Concluídas'], ['canceled', 'Canceladas']]
              ).map(([id, label]) => h('option', { key: id, value: id }, label)))),
              capabilities.category && h('label', null, h('span', null, 'Categoria'), h('select', {
                value: categoryFilter, onChange: event => setCategoryFilter(event.target.value)
              }, h('option', { value: 'all' }, 'Todas as categorias'), ...categories.map(category =>
                h('option', { key: category, value: category }, category)
              ))),
              definition.id === 'credit' && h('label', { className: 'reports73-credit-position-filter' },
                h('span', null, 'Leitura da carteira'), h('select', {
                  value: creditPositionMode, onChange: event => setCreditPositionMode(event.target.value)
                },
                h('option', { value: 'as-of' }, 'Situação na data final do período'),
                h('option', { value: 'current' }, 'Situação atual da carteira'))),
              capabilities.channel && h('label', null, h('span', null, 'Canal da venda'), h('select', {
                value: saleChannel, onChange: event => setSaleChannel(event.target.value)
              }, h('option', { value: 'all' }, 'Todos os canais'), SALE_CHANNELS.map(([id, label]) =>
                h('option', { key: id, value: id }, label)
              )))
            ),
            canCompare && h('label', { className: 'reports73-compare-toggle' }, h('input', {
              type: 'checkbox', checked: compareWithPrevious, onChange: event => setCompareWithPrevious(event.target.checked)
            }), h('span', null, 'Comparar com o período anterior equivalente')),
            invalidPeriod && h('div', { className: 'reports62-period-error' }, 'A data inicial não pode ser posterior à data final.')
          ),
          !invalidPeriod && h('div', { className: 'reports62-report-body' },
            h('section', { className: 'reports62-report-intro' }, h('div', null,
              h('span', null, storeName || 'Registro de Vendas'),
              h('h3', null, report.title),
              h('p', null, `${report.subtitle} · ${reportPeriodLabel(startDate, endDate)}`)
            )),
            report.creditPosition && h('section', { className: 'reports73-credit-position-note' },
              h('strong', null, report.creditPosition.label),
              h('span', null, 'Os saldos histórico e atual aparecem lado a lado; atrasos e clientes acompanham a leitura selecionada.')
            ),
            h('div', { className: 'reports62-metrics-grid' }, report.metrics.map(item => h(MetricCard, { key: item.label, item }))),
            report.comparison && report.id !== 'period-comparison' && h(ComparisonPanel, { comparison: report.comparison }),
            h(BarChart, { chart: report.chart }),
            h(ReportTable, { report, storeName }),
            report.notes?.length > 0 && h('section', { className: 'reports62-notes' },
              h('strong', null, 'Observações do relatório'),
              report.notes.map((note, index) => h('p', { key: index }, note))
            )
          )
        ),
        h('footer', { className: 'reports62-modal-footer' },
          h('div', { className: 'reports62-footer-period' }, invalidPeriod ? 'Período inválido' : reportPeriodLabel(startDate, endDate)),
          h('div', { className: 'reports62-footer-actions' },
            h('button', { type: 'button', className: 'reports62-secondary-btn', onClick: onClose }, 'Fechar'),
            h('select', {
              className: 'reports79-export-format',
              value: exportFormat,
              onChange: event => setExportFormat(event.target.value),
              'aria-label': 'Formato de exportação'
            },
            h('option', { value: 'pdf-executive' }, 'PDF executivo'),
            h('option', { value: 'pdf-detailed' }, 'PDF detalhado'),
            h('option', { value: 'excel' }, 'Excel (.xlsx)'),
            h('option', { value: 'csv' }, 'CSV (.csv)')),
            h('button', { type: 'button', className: 'reports74-share-btn', disabled: invalidPeriod || !!exportLoading, onClick: handleShare },
              exportLoading === 'share' ? 'Abrindo...' : 'Compartilhar'),
            h('button', { type: 'button', className: 'reports62-pdf-btn', disabled: invalidPeriod || !!exportLoading, onClick: handleExport },
              exportLoading === 'export' ? 'Gerando...' : 'Exportar')
          )
        )
      )
    ), document.body
  );
};

const ReportCard = ({ definition, onSelect }) => h('button', {
  type: 'button',
  className: `reports62-card ${definition.group === 'strategic' ? 'reports73-strategic-card' : ''}`,
  onClick: () => onSelect(definition.id)
},
  h('div', { className: `reports62-card-icon is-${definition.id}` }, h(ReportIcon, { name: definition.id, size: 22 })),
  h('div', { className: 'reports62-card-copy' },
    h('span', null, definition.group === 'strategic' ? 'Indicador estratégico' : `Relatório ${definition.number}`),
    h('strong', null, definition.title),
    h('p', null, definition.description)
  ),
  h('div', { className: 'reports62-card-arrow' }, '›')
);

export const AbaRelatorios = ({
  userId, sales = [], products = [], customers = [], userProfile = {},
  analysisPeriod = 'month', analysisStartDate = getCurrentMonthStart(), analysisEndDate = getCurrentMonthEnd(),
  onAnalysisPeriodChange, onAnalysisStartDateChange, onAnalysisEndDateChange
}) => {
  const [selectedReport, setSelectedReport] = useState(null);
  const [financialData, setFinancialData] = useState(EMPTY_FINANCIAL);
  const [financialWarning, setFinancialWarning] = useState('');

  useEffect(() => {
    if (!userId) return undefined;
    const profileRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'profile', 'info');
    return onSnapshot(profileRef, snapshot => {
      setFinancialData(normalizeFinancialData(snapshot.data()?.financialData));
      setFinancialWarning('');
    }, error => {
      console.error(error);
      setFinancialData(EMPTY_FINANCIAL);
      setFinancialWarning('Os dados manuais do Financeiro não puderam ser carregados. Os demais relatórios continuam disponíveis.');
    });
  }, [userId]);

  const selectedDefinition = REPORT_DEFINITIONS.find(item => item.id === selectedReport) || null;
  const executive = useMemo(() => buildExecutiveInsights({
    sales, products, customers, financialData, userProfile,
    startDate: analysisStartDate, endDate: analysisEndDate, today: getBrazilDateString()
  }), [sales, products, customers, financialData, userProfile, analysisStartDate, analysisEndDate]);
  const revenueTrend = executive.comparison?.metrics.find(item => item.label === 'Faturamento líquido');
  const resultTrend = executive.comparison?.metrics.find(item => item.label === 'Resultado líquido');
  const reportDirectory = new Map(REPORT_DEFINITIONS.map(definition => [definition.id, definition]));

  return h(React.Fragment, null,
    h('div', { className: 'reports62-page reports73-page' },
      h('div', { className: 'page-heading reports62-heading' },
        h('div', { className: 'page-heading-copy' },
          h('h1', { className: 'page-title' }, 'Relatórios'),
          h('p', { className: 'page-description' }, 'Entenda seus resultados e tome decisões com números confiáveis.')
        ),
        h('div', { className: 'reports62-count' }, h('strong', null, REPORT_DEFINITIONS.length), h('span', null, 'relatórios'))
      ),
      financialWarning && h('div', { className: 'reports62-warning' }, financialWarning),
      h(DateRangeFilter, {
        period: analysisPeriod,
        startDate: analysisStartDate,
        endDate: analysisEndDate,
        onPeriodChange: value => onAnalysisPeriodChange?.(value),
        onStartChange: value => { onAnalysisPeriodChange?.('custom'); onAnalysisStartDateChange?.(value); },
        onEndChange: value => { onAnalysisPeriodChange?.('custom'); onAnalysisEndDateChange?.(value); }
      }),
      h('section', { className: 'reports79-executive-overview' },
        h('div', { className: 'reports79-overview-heading' },
          h('div', null, h('span', null, 'Antes do detalhamento'), h('h2', null, 'Visão executiva')),
          h('strong', null, reportPeriodLabel(analysisStartDate, executive.effectiveEndDate))
        ),
        h('div', { className: 'reports79-overview-grid' }, [
          { label: 'Faturamento líquido', value: formatCurrency(executive.revenue), trend: revenueTrend },
          { label: 'Resultado líquido', value: formatCurrency(executive.netResult), trend: resultTrend },
          { label: 'Vendas realizadas', value: String(executive.salesCount), detail: `Ticket ${formatCurrency(executive.ticket)}` },
          { label: 'Clientes compradores', value: String(executive.buyers), detail: `${executive.newCustomers} novos · ${executive.recurringCustomers} recorrentes` },
          { label: 'Produtos para repor', value: String(executive.stockAlerts), detail: `${executive.stockoutProducts} sem estoque` },
          { label: 'Ações de recompra', value: String(executive.repurchaseOpportunities), detail: `${executive.pendingCollections} cobranças próximas` }
        ].map(item => h('article', { key: item.label, className: 'reports79-overview-card' },
          h('span', null, item.label),
          h('strong', null, item.value),
          item.trend
            ? h('small', { className: `is-${item.trend.tone}` }, `${item.trend.deltaDisplay} vs. período anterior`)
            : h('small', null, item.detail)
        )))
      ),
      ...REPORT_GROUPS.map(group => {
        const definitions = group.reportIds.map(id => reportDirectory.get(id)).filter(Boolean);
        return h('section', { key: group.id, className: 'reports73-group reports79-topic-group' },
          h('div', { className: 'reports73-group-heading' },
            h('div', null, h('span', null, group.description), h('h2', null, group.title)),
            h('strong', null, `${definitions.length} ${definitions.length === 1 ? 'relatório' : 'relatórios'}`)
          ),
          h('div', { className: 'reports62-grid' },
            definitions.map(definition => h(ReportCard, { key: definition.id, definition, onSelect: setSelectedReport }))
          )
        )
      })
    ),
    selectedDefinition && h(ReportModal, {
      definition: selectedDefinition,
      sales,
      products,
      customers,
      financialData,
      storeName: userProfile?.storeName || userProfile?.name || 'Registro de Vendas',
      analysisPeriod,
      analysisStartDate,
      analysisEndDate,
      onAnalysisPeriodChange,
      onAnalysisStartDateChange,
      onAnalysisEndDateChange,
      onClose: () => setSelectedReport(null)
    })
  );
};
