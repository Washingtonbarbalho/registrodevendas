import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const salePdfSource = fs.readFileSync(path.join(root, 'sale-pdf-v65.js'), 'utf8')
  .replace(/^import\s.*?;\r?\n/gm, '')
  .replace("const module = await import('https://esm.sh/jspdf@2.5.1');", 'const module = { jsPDF: FakeJsPdf };')
  .replace(/export const /g, 'const ');

let renderedPdf = null;

class FakeJsPdf {
  constructor() {
    renderedPdf = this;
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
  }

  addPage() { this.calls.push({ type: 'page' }); }
  setFont(...value) { this.font = value; }
  setFontSize(value) { this.fontSize = value; }
  setFillColor(...value) { this.fillColor = value; }
  setDrawColor(...value) { this.drawColor = value; }
  setTextColor(...value) { this.textColor = value; }
  splitTextToSize(value) { return [String(value ?? '')]; }
  line(...value) { this.calls.push({ type: 'line', value }); }
  rect(x, y, width, height, mode) {
    this.calls.push({
      type: 'rect', x, y, width, height, mode,
      fillColor: [...this.fillColor], drawColor: [...this.drawColor]
    });
  }
  text(value, x, y) {
    this.calls.push({
      type: 'text', value: String(value), x, y,
      textColor: [...this.textColor], font: this.font, fontSize: this.fontSize
    });
  }
  output() { return new Blob(['pdf-validado'], { type: 'application/pdf' }); }
}

const createPdfModule = Function('formatCurrency', 'formatDate', 'getHistoryCashAmount', 'FakeJsPdf', `
  ${salePdfSource}
  return { generateSalePdfBlob, SALE_PDF_INSTALLMENT_HEADER_STYLE };
`);

const formatCurrency = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL'
}).format(Number(value) || 0);
const formatDate = value => {
  const [year, month, day] = String(value || '').split('T')[0].split('-');
  return year && month && day ? `${day}/${month}/${year}` : '--/--/----';
};
const { generateSalePdfBlob, SALE_PDF_INSTALLMENT_HEADER_STYLE } = createPdfModule(
  formatCurrency,
  formatDate,
  () => 0,
  FakeJsPdf
);

assert.deepEqual(SALE_PDF_INSTALLMENT_HEADER_STYLE.fillColor, [15, 23, 42]);
assert.deepEqual(SALE_PDF_INSTALLMENT_HEADER_STYLE.textColor, [255, 255, 255]);

const relativeLuminance = color => {
  const channels = color.map(channel => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const headerLuminance = relativeLuminance(SALE_PDF_INSTALLMENT_HEADER_STYLE.fillColor);
const textLuminance = relativeLuminance(SALE_PDF_INSTALLMENT_HEADER_STYLE.textColor);
const contrastRatio = (Math.max(headerLuminance, textLuminance) + 0.05)
  / (Math.min(headerLuminance, textLuminance) + 0.05);
assert.ok(contrastRatio >= 7, `O cabeçalho do PDF precisa ter alto contraste; encontrado ${contrastRatio.toFixed(2)}:1.`);

const blob = await generateSalePdfBlob({
  type: 'registro',
  userProfile: { storeName: 'Loja de teste' },
  sale: {
    id: 'sale-pdf-test',
    saleType: 'prazo',
    saleDate: '2026-09-14',
    customerName: 'CLIENTE TESTE',
    totalPrice: 100,
    items: [{ quantity: 1, productName: 'Produto teste', price: 100 }],
    installmentsCount: 2,
    installments: [
      { number: 1, dueDate: '2026-10-14', amount: 50, originalAmount: 50, paid: false },
      { number: 2, dueDate: '2026-11-14', amount: 50, originalAmount: 50, paid: false }
    ]
  }
});

assert.equal(blob.type, 'application/pdf');
assert.ok(renderedPdf, 'O detalhamento da venda deve criar o PDF.');

for (const label of ['Nº', 'Vencimento', 'Valor', 'Situação']) {
  const heading = renderedPdf.calls.find(call => call.type === 'text' && call.value === label);
  assert.ok(heading, `A coluna ${label} deve aparecer na tabela de parcelas.`);
  assert.deepEqual(heading.textColor, [255, 255, 255], `A coluna ${label} deve usar texto branco.`);

  const background = renderedPdf.calls.find(call => call.type === 'rect'
    && call.x === heading.x - 1.5
    && call.y === heading.y - 5
    && call.height === 8);
  assert.ok(background, `A coluna ${label} deve possuir fundo próprio.`);
  assert.deepEqual(background.fillColor, [15, 23, 42], `A coluna ${label} deve usar fundo escuro.`);
}

console.log(`Versão 95 validada: opções de parcelamento detalhadas e cabeçalho do PDF com contraste ${contrastRatio.toFixed(2)}:1.`);
