import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const salePdfSource = read('sale-pdf-v65.js')
  .replace(/^import\s.*?;\r?\n/gm, '')
  .replace("const module = await import('https://esm.sh/jspdf@2.5.1');", 'const module = { jsPDF: FakeJsPdf };')
  .replace(/export const /g, 'const ');

let renderedPdf = null;

class FakeJsPdf {
  constructor(options) {
    renderedPdf = this;
    this.options = options;
    this.internal = {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297
      }
    };
    this.calls = [];
    this.fillColor = [];
    this.drawColor = [];
    this.textColor = [];
    this.lineDash = [];
  }

  addPage() { this.calls.push({ type: 'page' }); }
  setFont(...value) { this.font = value; }
  setFontSize(value) { this.fontSize = value; }
  setFillColor(...value) { this.fillColor = value; }
  setDrawColor(...value) { this.drawColor = value; }
  setTextColor(...value) { this.textColor = value; }
  setLineWidth(value) { this.lineWidth = value; }
  setLineDashPattern(value) { this.lineDash = [...value]; }
  splitTextToSize(value) { return [String(value ?? '')]; }
  line(x1, y1, x2, y2) {
    this.calls.push({ type: 'line', x1, y1, x2, y2, lineDash: [...this.lineDash] });
  }
  rect(x, y, width, height, mode) {
    this.calls.push({
      type: 'rect', x, y, width, height, mode,
      fillColor: [...this.fillColor], drawColor: [...this.drawColor]
    });
  }
  text(value, x, y, options) {
    this.calls.push({
      type: 'text', value: String(value), x, y, options,
      textColor: [...this.textColor], font: this.font, fontSize: this.fontSize
    });
  }
  output() { return new Blob(['carne-validado'], { type: 'application/pdf' }); }
}

const createPdfModule = Function(
  'formatCurrency',
  'formatDate',
  'getHistoryCashAmount',
  'getInstallmentFaceAmount',
  'FakeJsPdf',
  `${salePdfSource}
   return { generateInstallmentBookletPdfBlob, INSTALLMENT_BOOKLET_LAYOUT };`
);

const formatCurrency = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL'
}).format(Number(value) || 0);
const formatDate = value => {
  const [year, month, day] = String(value || '').split('T')[0].split('-');
  return year && month && day ? `${day}/${month}/${year}` : '--/--/----';
};
const getInstallmentFaceAmount = installment => Number(installment?.originalAmount ?? installment?.amount) || 0;
const { generateInstallmentBookletPdfBlob, INSTALLMENT_BOOKLET_LAYOUT } = createPdfModule(
  formatCurrency,
  formatDate,
  () => 0,
  getInstallmentFaceAmount,
  FakeJsPdf
);

assert.equal(INSTALLMENT_BOOKLET_LAYOUT.pageFormat, 'a4');
assert.equal(INSTALLMENT_BOOKLET_LAYOUT.cardsPerPage, 3);
assert.ok(INSTALLMENT_BOOKLET_LAYOUT.cardHeight < 100, 'Cada canhoto deve permanecer horizontal e compacto.');

const installments = [
  { number: 1, dueDate: '2026-10-10', amount: 125.5, originalAmount: 125.5, paid: true, paidAt: '2026-10-09' },
  { number: 2, dueDate: '2026-11-10', amount: 125.5, originalAmount: 125.5, paid: false },
  { number: 3, dueDate: '2026-12-10', amount: 125.5, originalAmount: 125.5, paid: false },
  { number: 4, dueDate: '2027-01-10', amount: 125.5, originalAmount: 125.5, paid: false }
];

const blob = await generateInstallmentBookletPdfBlob({
  userProfile: { storeName: 'Loja Modelo', phone: '(11) 3333-4444' },
  sale: {
    id: 'venda-carne-123456',
    saleType: 'prazo',
    saleDate: '2026-09-10',
    customerName: 'Maria da Silva',
    customerPhone: '(11) 99999-8888',
    installmentsCount: 4,
    installments
  }
});

assert.equal(blob.type, 'application/pdf');
assert.ok(renderedPdf, 'O carnê deve criar um PDF.');
assert.deepEqual(renderedPdf.options, { unit: 'mm', format: 'a4', orientation: 'portrait' });
assert.equal(renderedPdf.calls.filter(call => call.type === 'page').length, 1,
  'Quatro parcelas devem ocupar duas páginas, com três canhotos na primeira.');

const horizontalCards = renderedPdf.calls.filter(call => call.type === 'rect'
  && call.width === 190
  && call.height === INSTALLMENT_BOOKLET_LAYOUT.cardHeight);
assert.equal(horizontalCards.length, installments.length, 'Cada parcela deve gerar um canhoto horizontal próprio.');
assert.ok(horizontalCards.every(card => card.width > card.height * 2), 'Os canhotos precisam ser mais largos do que altos.');

const labels = renderedPdf.calls.filter(call => call.type === 'text').map(call => call.value);
assert.equal(labels.filter(value => value === 'VIA DA LOJA').length, installments.length);
assert.equal(labels.filter(value => value === 'CARNÊ DO CLIENTE').length, installments.length);
assert.ok(labels.includes('Maria da Silva'), 'O nome do cliente deve constar no carnê.');
assert.ok(labels.includes('(11) 99999-8888'), 'O telefone do cliente deve constar na via do cliente.');
assert.ok(labels.includes('1/4') && labels.includes('4/4'), 'O número de cada parcela deve ser impresso.');
assert.ok(labels.some(value => value.includes('125,50')), 'O valor original da parcela deve ser impresso.');
assert.ok(labels.some(value => value === 'PAGA EM 09/10/2026'), 'Parcelas pagas devem manter a situação atual no carnê.');

const cutLines = renderedPdf.calls.filter(call => call.type === 'line'
  && call.x1 === call.x2
  && call.y2 - call.y1 === INSTALLMENT_BOOKLET_LAYOUT.cardHeight
  && call.lineDash.length > 0);
assert.equal(cutLines.length, installments.length, 'Cada canhoto deve possuir uma linha vertical destacável entre as duas vias.');

await assert.rejects(
  () => generateInstallmentBookletPdfBlob({ sale: { saleType: 'prazo', installments: [] } }),
  /não possui parcelas/i
);

const salesSource = read('aba-vendas-v71.js');
for (const marker of ['onGenerateBooklet', 'sales-row-booklet-button', 'Carnê PDF', 'Gerar carnê das parcelas em PDF']) {
  assert.ok(salesSource.includes(marker), `A listagem de vendas não contém o marcador do carnê: ${marker}`);
}

const appSource = read('app-runtime-v75.js');
for (const marker of ['shareInstallmentBookletPdf', 'handleGenerateInstallmentBooklet', 'onGenerateBooklet: handleGenerateInstallmentBooklet']) {
  assert.ok(appSource.includes(marker), `O runtime não integrou o carnê: ${marker}`);
}

const styles = read('styles-runtime-v75.css');
for (const marker of ['.sales-row-actions', '.sales-row-booklet-button', '.sales-row-open-button']) {
  assert.ok(styles.includes(marker), `O botão de carnê não possui estilo responsivo: ${marker}`);
}

console.log('Versão 98 validada: botão por venda a prazo e carnê horizontal com duas vias para cada parcela.');
