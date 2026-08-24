const CURRENCY_FORMAT = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const PERCENT_FORMAT = '0.0%';
const DATE_FORMAT = 'dd/mm/yyyy';

const finiteNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;

const spreadsheetDate = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').split('T')[0]);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseBrazilianNumber = value => {
  const normalized = String(value || '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
};

const parseReportCellWithFormat = value => {
  if (value instanceof Date || typeof value === 'number' || typeof value === 'boolean') return { value, format: '' };
  if (value === null || value === undefined) return { value: '', format: '' };
  const text = String(value).replace(/\u00a0/g, ' ').trim();
  if (!text) return { value: '', format: '' };

  const brazilianDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (brazilianDate) {
    const date = spreadsheetDate(`${brazilianDate[3]}-${brazilianDate[2]}-${brazilianDate[1]}`);
    if (date) return { value: date, format: 'date' };
  }
  const isoDate = spreadsheetDate(text);
  if (isoDate) return { value: isoDate, format: 'date' };

  if (/%$/.test(text)) {
    const parsed = parseBrazilianNumber(text.replace('%', '').replace('+', ''));
    if (parsed !== null) return { value: parsed / 100, format: 'percent' };
  }

  if (/R\$/i.test(text)) {
    const negative = /^\s*-/.test(text) || /^\(.*\)$/.test(text);
    const parsed = parseBrazilianNumber(text.replace(/[()]/g, '').replace(/-?\s*R\$/i, '').trim());
    if (parsed !== null) return { value: negative ? -Math.abs(parsed) : parsed, format: 'currency' };
  }

  if (/^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(text) || /^[+-]?\d+(?:,\d+)?$/.test(text)) {
    const unsigned = text.replace(/^[+-]/, '');
    if (!/^0\d+/.test(unsigned)) {
      const parsed = parseBrazilianNumber(text);
      if (parsed !== null) return { value: parsed, format: Number.isInteger(parsed) ? 'integer' : 'decimal' };
    }
  }
  return { value: text, format: '' };
};

export const parseReportCell = value => parseReportCellWithFormat(value).value;

const metricCell = metric => {
  if (metric?.type === 'currency') return { value: finiteNumber(metric.value), format: 'currency' };
  if (metric?.type === 'percent') return { value: finiteNumber(metric.value) / 100, format: 'percent' };
  if (metric?.type === 'number') return { value: finiteNumber(metric.value), format: 'integer' };
  return { value: metric?.value ?? metric?.display ?? '', format: '' };
};

const makeSheet = ({ name, rows, formats = {}, headerRows = [], columnWidths = [], merges = [], autoFilter = '' }) => ({
  name, rows, formats, headerRows, columnWidths, merges, autoFilter
});

const setFormat = (formats, row, column, format) => {
  if (format) formats[`${row}:${column}`] = format;
};

export const buildReportWorkbookModel = ({
  report,
  storeName = 'Registro de Vendas',
  startDate,
  endDate,
  paymentFilterLabel = 'Todas as formas',
  saleChannelLabel = 'Todos os canais',
  generatedAt = new Date()
} = {}) => {
  if (!report) throw new Error('Relatório não informado para a exportação.');
  const sheets = [];
  const summaryFormats = {};
  const summaryRows = [
    [report.title || 'Relatório'],
    ['Loja', storeName],
    ['Data inicial', spreadsheetDate(startDate) || startDate || '', 'Data final', spreadsheetDate(endDate) || endDate || ''],
    ['Forma de pagamento', paymentFilterLabel, 'Canal da venda', saleChannelLabel],
    ['Gerado em', generatedAt],
    [],
    ['Resumo'],
    ['Indicador', 'Valor']
  ];
  setFormat(summaryFormats, 2, 1, 'date');
  setFormat(summaryFormats, 2, 3, 'date');
  setFormat(summaryFormats, 4, 1, 'date-time');
  (Array.isArray(report.metrics) ? report.metrics : []).forEach(metric => {
    const parsed = metricCell(metric);
    const rowIndex = summaryRows.length;
    summaryRows.push([metric.label, parsed.value]);
    setFormat(summaryFormats, rowIndex, 1, parsed.format);
  });
  if (report.subtitle) summaryRows.push([], ['Descrição', report.subtitle]);
  sheets.push(makeSheet({
    name: 'Resumo', rows: summaryRows, formats: summaryFormats, headerRows: [0, 6, 7],
    columnWidths: [34, 24, 24, 24], merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }]
  }));

  if (report.comparison?.metrics?.length) {
    const comparisonFormats = {};
    const comparisonRows = [
      ['Comparação com o período anterior'],
      ['Período atual', spreadsheetDate(report.comparison.currentPeriod?.startDate || startDate) || '', 'até', spreadsheetDate(report.comparison.currentPeriod?.endDate || endDate) || ''],
      ['Período anterior', spreadsheetDate(report.comparison.previousPeriod?.startDate) || '', 'até', spreadsheetDate(report.comparison.previousPeriod?.endDate) || ''],
      [],
      ['Indicador', 'Atual', 'Anterior', 'Diferença', 'Variação']
    ];
    [1, 2].forEach(row => { setFormat(comparisonFormats, row, 1, 'date'); setFormat(comparisonFormats, row, 3, 'date'); });
    report.comparison.metrics.forEach(metric => {
      const rowIndex = comparisonRows.length;
      const format = metric.type === 'currency' ? 'currency' : metric.type === 'percent' ? 'percent-points' : 'integer';
      comparisonRows.push([
        metric.label,
        metric.type === 'percent' ? finiteNumber(metric.current) / 100 : finiteNumber(metric.current),
        metric.type === 'percent' ? finiteNumber(metric.previous) / 100 : finiteNumber(metric.previous),
        metric.type === 'percent' ? finiteNumber(metric.delta) / 100 : finiteNumber(metric.delta),
        metric.percent === null || metric.percent === undefined ? '' : finiteNumber(metric.percent) / 100
      ]);
      [1, 2, 3].forEach(column => setFormat(comparisonFormats, rowIndex, column, format));
      setFormat(comparisonFormats, rowIndex, 4, 'percent');
    });
    sheets.push(makeSheet({
      name: 'Comparação', rows: comparisonRows, formats: comparisonFormats, headerRows: [0, 4],
      columnWidths: [32, 18, 18, 18, 16], merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }],
      autoFilter: `A5:E${comparisonRows.length}`
    }));
  }

  const detailFormats = {};
  const detailRows = [
    [report.title || 'Detalhamento'],
    [`Período: ${String(startDate || '')} a ${String(endDate || '')}`],
    [],
    [...(Array.isArray(report.columns) ? report.columns : [])]
  ];
  (Array.isArray(report.rows) ? report.rows : []).forEach(row => {
    const rowIndex = detailRows.length;
    const parsedRow = (Array.isArray(row) ? row : []).map((cell, columnIndex) => {
      const parsed = parseReportCellWithFormat(cell);
      setFormat(detailFormats, rowIndex, columnIndex, parsed.format);
      return parsed.value;
    });
    detailRows.push(parsedRow);
  });
  const detailColumns = Math.max(1, detailRows[3]?.length || 0);
  const detailEndColumn = String.fromCharCode(64 + Math.min(26, detailColumns));
  sheets.push(makeSheet({
    name: 'Detalhamento', rows: detailRows, formats: detailFormats, headerRows: [0, 3],
    columnWidths: Array.from({ length: detailColumns }, (_, index) => index === 0 ? 30 : 20),
    merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, detailColumns - 1) } }],
    autoFilter: report.rows?.length && report.columns?.length ? `A4:${detailEndColumn}${detailRows.length}` : ''
  }));

  if (report.notes?.length) {
    const noteRows = [['Observações do relatório'], ...report.notes.map((note, index) => [index + 1, note])];
    sheets.push(makeSheet({
      name: 'Observações', rows: noteRows, headerRows: [0], columnWidths: [8, 100],
      merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
    }));
  }

  return {
    filename: `relatorio-${report.id || 'geral'}-${startDate || 'inicio'}-${endDate || 'fim'}.xlsx`,
    sheets
  };
};

const applyCellFormat = (cell, format) => {
  if (!cell || !format) return;
  if (format === 'currency') cell.z = CURRENCY_FORMAT;
  if (format === 'percent' || format === 'percent-points') cell.z = PERCENT_FORMAT;
  if (format === 'date') cell.z = DATE_FORMAT;
  if (format === 'date-time') cell.z = 'dd/mm/yyyy hh:mm';
  if (format === 'integer') cell.z = '0';
  if (format === 'decimal') cell.z = '0.00';
};

const styleWorksheet = (XLSX, worksheet, sheet) => {
  worksheet['!cols'] = sheet.columnWidths.map(width => ({ wch: width }));
  worksheet['!merges'] = sheet.merges || [];
  if (sheet.autoFilter) worksheet['!autofilter'] = { ref: sheet.autoFilter };
  worksheet['!freeze'] = { xSplit: 0, ySplit: Math.max(...(sheet.headerRows || [0])) + 1, topLeftCell: `A${Math.max(...(sheet.headerRows || [0])) + 2}`, activePane: 'bottomLeft', state: 'frozen' };

  Object.entries(sheet.formats || {}).forEach(([key, format]) => {
    const [row, column] = key.split(':').map(Number);
    applyCellFormat(worksheet[XLSX.utils.encode_cell({ r: row, c: column })], format);
  });

  const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null;
  if (!range) return;
  (sheet.headerRows || []).forEach(row => {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (!cell) continue;
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: row === 0 ? 15 : 11 },
        fill: { patternType: 'solid', fgColor: { rgb: row === 0 ? '0F172A' : '334155' } },
        alignment: { vertical: 'center', wrapText: true }
      };
    }
  });
};

export const createReportExcelFile = async input => {
  const XLSX = await import('https://esm.sh/xlsx@0.18.5');
  if (!XLSX?.utils?.book_new) throw new Error('Biblioteca de Excel indisponível.');
  const model = buildReportWorkbookModel(input);
  const workbook = XLSX.utils.book_new();
  model.sheets.forEach(sheet => {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows, { cellDates: true });
    styleWorksheet(XLSX, worksheet, sheet);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  });
  workbook.Props = {
    Title: input?.report?.title || 'Relatório',
    Subject: 'Relatório comercial e financeiro',
    Author: input?.storeName || 'Registro de Vendas',
    CreatedDate: new Date()
  };
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true, compression: true });
  return new File([bytes], model.filename, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
};

export const downloadFile = file => {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name || 'relatorio';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

export const shareFile = async ({ file, title, text }) => {
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    try {
      await navigator.share({ files: [file], title, text });
      return { shared: true, downloaded: false, canceled: false };
    } catch (error) {
      if (error?.name === 'AbortError') return { shared: false, downloaded: false, canceled: true };
      console.warn('Compartilhamento direto indisponível:', error);
    }
  }
  downloadFile(file);
  return { shared: false, downloaded: true, canceled: false };
};
