import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  advanceCalendarRange,
  buildCalendarMonth,
  filterModalOptions,
  exceededTapTolerance,
  inferAlertTone,
  isCalendarDate,
  moveCalendarDate,
  moveCalendarMonth,
  readSelectOptions,
  showAppDateRange
} from '../ui-interactions-v81.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

assert.equal(inferAlertTone('Código PIX copiado!'), 'success');
assert.equal(inferAlertTone('Não foi possível salvar a venda.'), 'error');
assert.equal(inferAlertTone('Informe uma quantidade válida.'), 'warning');
assert.equal(inferAlertTone('O relatório está pronto para consulta.'), 'info');

const options = [
  { value: 'pix', label: 'PIX', group: 'Pagamento' },
  { value: 'credit', label: 'Crédito', group: 'Pagamento' },
  { value: 'instagram', label: 'Instagram', group: 'Canal' }
];
assert.deepEqual(filterModalOptions(options, 'credito').map(item => item.value), ['credit']);
assert.deepEqual(filterModalOptions(options, 'pagamento').map(item => item.value), ['pix', 'credit']);
assert.equal(filterModalOptions(options, '').length, 3);

assert.equal(exceededTapTolerance({ x: 100, y: 200 }, { x: 104, y: 205 }), false,
  'Pequenos movimentos naturais do dedo ainda precisam contar como toque.');
assert.equal(exceededTapTolerance({ x: 100, y: 200 }, { x: 100, y: 208 }), true,
  'Um deslocamento de rolagem precisa cancelar a ativação acidental.');
assert.equal(exceededTapTolerance({ x: 100, y: 200 }, { x: 91, y: 201 }), true,
  'A proteção também precisa reconhecer deslocamentos horizontais.');

const option = (value, label, extra = {}) => ({
  tagName: 'OPTION', value, label, textContent: label, disabled: false, selected: false, ...extra
});
const fakeSelect = {
  children: [
    option('', 'Selecione...'),
    {
      tagName: 'OPTGROUP', label: 'Entradas',
      children: [option('purchase', 'Compra', { selected: true }), option('adjustment', 'Ajuste', { disabled: true })]
    }
  ]
};
assert.deepEqual(readSelectOptions(fakeSelect), [
  { value: '', label: 'Selecione...', group: '', disabled: false, selected: false },
  { value: 'purchase', label: 'Compra', group: 'Entradas', disabled: false, selected: true },
  { value: 'adjustment', label: 'Ajuste', group: 'Entradas', disabled: true, selected: false }
]);

assert.ok(isCalendarDate('2024-02-29'), 'Anos bissextos precisam aparecer corretamente no calendário.');
assert.ok(!isCalendarDate('2025-02-29'), 'Datas inexistentes não podem ser aceitas.');
assert.equal(moveCalendarDate('2026-08-31', 1), '2026-09-01');
assert.equal(moveCalendarMonth('2026-12-20', 1), '2027-01-01');
assert.equal(moveCalendarMonth('2026-01-20', -1), '2025-12-01');

const leapMonth = buildCalendarMonth('2024-02-15');
assert.equal(leapMonth.daysInMonth, 29);
assert.equal(leapMonth.days.length, 35);
assert.ok(leapMonth.days.some(day => day.date === '2024-02-29' && day.currentMonth));
assert.equal(buildCalendarMonth('2026-08-15').days.length, 42,
  'Meses que ocupam seis semanas precisam manter todos os dias visíveis.');

assert.deepEqual(advanceCalendarRange(null, '2026-08-12'),
  { startDate: '2026-08-12', endDate: '' });
assert.deepEqual(advanceCalendarRange({ startDate: '2026-08-12', endDate: '' }, '2026-08-25'),
  { startDate: '2026-08-12', endDate: '2026-08-25' });
assert.deepEqual(advanceCalendarRange({ startDate: '2026-08-25', endDate: '' }, '2026-08-12'),
  { startDate: '2026-08-12', endDate: '2026-08-25' },
  'A segunda data anterior à primeira deve gerar um intervalo válido automaticamente.');
assert.deepEqual(advanceCalendarRange({ startDate: '2026-08-12', endDate: '' }, '2026-08-12'),
  { startDate: '2026-08-12', endDate: '2026-08-12' },
  'Também deve ser possível filtrar apenas um dia.');
assert.deepEqual(advanceCalendarRange({ startDate: '2026-08-01', endDate: '2026-08-31' }, '2026-09-03'),
  { startDate: '2026-09-03', endDate: '' },
  'Uma nova escolha deve recomeçar o intervalo anterior.');

class TestElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentElement = null;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {};
    this.className = '';
    this.textContent = '';
    this.classList = {
      add: value => this.setClass(value, true),
      toggle: (value, enabled) => this.setClass(value, enabled)
    };
  }

  get isConnected() {
    return this === this.ownerDocument.body || !!this.parentElement?.isConnected;
  }

  setClass(value, enabled) {
    const values = new Set(String(this.className).split(/\s+/).filter(Boolean));
    if (enabled) values.add(value);
    else values.delete(value);
    this.className = [...values].join(' ');
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  append(...children) {
    children.forEach(child => this.appendChild(child));
  }

  replaceChildren(...children) {
    this.children.forEach(child => { child.parentElement = null; });
    this.children = [];
    this.append(...children);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(callback);
  }

  matches(selector) {
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    const calendarDate = selector.match(/^\[data-calendar-date="([^"]+)"\]$/);
    if (calendarDate) return this.dataset.calendarDate === calendarDate[1];
    return this.tagName === selector.toUpperCase();
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = node => node.children.forEach(child => {
      if (child.matches(selector)) matches.push(child);
      visit(child);
    });
    visit(this);
    return matches;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  click() {
    const event = { target: this, preventDefault() {}, stopPropagation() {} };
    (this.listeners.get('click') || []).forEach(callback => callback(event));
  }
}

const previousDocument = globalThis.document;
const previousAnimationFrame = globalThis.requestAnimationFrame;
const testDocument = {
  activeElement: null,
  addEventListener() {},
  removeEventListener() {},
  createElement(tagName) { return new TestElement(tagName, this); }
};
testDocument.body = new TestElement('body', testDocument);
globalThis.document = testDocument;
globalThis.requestAnimationFrame = callback => { callback(); return 1; };

try {
  const selectionPromise = showAppDateRange({ startDate: '2026-08-01', endDate: '2026-08-31' });
  assert.ok(testDocument.body.querySelector('.app82-calendar-panel'),
    'O seletor precisa abrir um modal próprio com o calendário.');
  testDocument.body.querySelector('[data-calendar-date="2026-08-12"]').click();
  assert.ok(testDocument.body.querySelector('.app82-calendar-panel'),
    'O primeiro toque precisa manter o calendário aberto para escolher a data final.');
  assert.ok(testDocument.body.querySelector('.app81-dialog-message').textContent.includes('data final'));
  testDocument.body.querySelector('[data-calendar-date="2026-08-25"]').click();
  assert.deepEqual(await selectionPromise, { startDate: '2026-08-12', endDate: '2026-08-25' });
  assert.equal(testDocument.body.querySelector('.app82-calendar-panel'), null,
    'O segundo toque precisa aplicar o período e fechar o calendário automaticamente.');

  const crossMonthPromise = showAppDateRange({ startDate: '2026-08-01', endDate: '2026-08-31' });
  testDocument.body.querySelector('[data-calendar-date="2026-08-29"]').click();
  testDocument.body.querySelectorAll('.app82-calendar-nav-button')[1].click();
  testDocument.body.querySelector('[data-calendar-date="2026-09-08"]').click();
  assert.deepEqual(await crossMonthPromise, { startDate: '2026-08-29', endDate: '2026-09-08' },
    'O intervalo precisa funcionar quando começa em um mês e termina no seguinte.');
} finally {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
  if (previousAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
  else globalThis.requestAnimationFrame = previousAnimationFrame;
}

const interactionSource = read('ui-interactions-v81.js');
for (const marker of [
  'window.alert = message =>',
  "document.addEventListener('pointerdown', beginTouchGesture, true)",
  "document.addEventListener('pointermove', moveTouchGesture, true)",
  "document.addEventListener('pointercancel', event => finishTouchGesture(event, true), true)",
  "document.addEventListener('touchstart', beginSelectTouch, { capture: true, passive: true })",
  "document.addEventListener('touchmove', moveSelectTouch, { capture: true, passive: true })",
  "document.addEventListener('touchend', event => finishSelectTouch(event), { capture: true, passive: false })",
  'activateSelect(gesture.select, event)',
  "document.addEventListener('pointerdown', interceptSelectMousePointer, true)",
  "document.addEventListener('click', interceptApplicationClick, true)",
  'consumeBlockedTouchClick',
  'SCROLL_CLICK_BLOCK_MS',
  "document.addEventListener('keydown', interceptSelectKeyboard, true)",
  "select.setAttribute('aria-haspopup', 'dialog')",
  'new MutationObserver(records =>',
  "select.dispatchEvent(new Event('change', { bubbles: true }))",
  'options.length > 8',
  'Buscar entre ${options.length} opções',
  "role', 'listbox'",
  "aria-selected",
  'showAppConfirm',
  'showAppAlert',
  'showAppDateRange',
  'renderDateRange',
  "kind: 'date-range'",
  "Agora escolha a data final. O período será aplicado automaticamente.",
  "button.setAttribute('role', 'gridcell')",
  "ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7"
]) assert.ok(interactionSource.includes(marker), `Camada interativa incompleta: ${marker}`);
assert.ok(!interactionSource.includes("touchstart', interceptSelect"),
  'Listas personalizadas não podem abrir no início do toque, antes de distinguir uma rolagem.');
assert.ok(interactionSource.indexOf('event.preventDefault();\n  event.stopPropagation();\n  activateSelect(gesture.select, event)')
  > interactionSource.indexOf('const finishSelectTouch ='),
  'O seletor nativo precisa ser bloqueado no fim do toque antes de abrir o modal próprio.');

const bootstrap = read('bootstrap-v75.js');
const version = bootstrap.match(/const VERSION = '([^']+)'/)?.[1];
assert.ok(version, 'A versão ativa precisa estar disponível no carregador.');
assert.ok(bootstrap.includes(`import { installUiInteractions } from './ui-interactions-v81.js?v=${version}'`));
assert.ok(bootstrap.indexOf('installUiInteractions();') < bootstrap.indexOf("import(`./app-runtime-v75.js?v=${VERSION}`)"),
  'A camada visual precisa iniciar antes da aplicação.');

const productionFiles = fs.readdirSync(root)
  .filter(file => file.endsWith('.js'));
const productionSource = productionFiles.map(file => read(file)).join('\n');
assert.equal((productionSource.match(/\b(?:window\.)?(?:confirm|prompt)\s*\(/g) || []).length, 0,
  'Nenhuma confirmação ou prompt nativo pode permanecer no sistema.');
assert.equal((productionSource.match(/(?:createElement|\bh)\(['"]select['"]/g) || []).length, 30,
  'Todas as 30 listas suspensas auditadas precisam continuar cobertas pela camada visual.');
assert.equal((productionSource.match(/\b(?:window\.)?alert\s*\(/g) || []).length, 60,
  'Os 60 avisos auditados precisam permanecer cobertos pelo interceptador profissional.');
assert.ok(!/(?:createElement|\bh)\(['"]select['"][\s\S]{0,220}?multiple\s*:/.test(productionSource),
  'Seletores múltiplos exigiriam uma interação específica.');

for (const file of ['auth-admin.js', 'aba-financeiro-v68.js']) {
  const source = read(file);
  assert.ok(source.includes(`from './ui-interactions-v81.js?v=${version}'`));
  assert.ok(source.includes('await showAppConfirm('));
}

for (const file of ['components.js', 'aba-vendas-v71.js', 'aba-relatorios-v73.js']) {
  const source = read(file);
  assert.ok(source.includes('DateRangePicker'), `${file} precisa usar o calendário compartilhado.`);
  assert.ok(!/type:\s*['"]date['"]/.test(source),
    `${file} não pode manter campos separados de data nos filtros por período.`);
}
const finance = read('aba-financeiro-v68.js');
assert.equal((finance.match(/type:\s*['"]date['"]/g) || []).length, 1,
  'O Financeiro deve manter apenas a data individual de cadastro, sem datas nativas no filtro de período.');
assert.ok(finance.includes('const AccountPortfolioModal ='),
  'Os cartões financeiros precisam abrir a carteira completa em um modal independente.');
assert.ok(finance.includes("scope: 'period'") && finance.includes("scope: 'all'"),
  'A página deve manter seu período enquanto o modal consulta contas de todos os vencimentos.');
assert.ok(!finance.includes('showingCompletePortfolio'),
  'A carteira completa não pode substituir a listagem filtrada da página financeira.');

const authScreen = read('auth-screen-v71.js');
assert.equal((authScreen.match(/React\.createElement\('form', \{[^}]*noValidate: true/g) || []).length, 2,
  'Login e cadastro não podem exibir validações nativas do navegador.');

const styles = read('styles-runtime-v75.css');
for (const marker of [
  '.app81-dialog-overlay', '.app81-dialog-panel', '.app81-select-panel',
  '.app81-select-search', '.app81-select-option.is-selected',
  '@keyframes app81-sheet-in', '@media (prefers-reduced-motion: reduce)',
  '.period82-trigger', '.app82-calendar-panel', '.app82-calendar-grid',
  '.app82-calendar-day.is-start', '.finance82-summary-action',
  '.finance83-portfolio-modal', '.finance83-portfolio-scroll', '.finance85-installment-preview',
  '.finance88-launch-card', '.finance88-launch-placeholder',
  '.mobile83-more-sheet', '.mobile83-more-nav-button'
]) assert.ok(styles.includes(marker), `Estilo interativo ausente: ${marker}`);

console.log(`Interface v${version} validada: lançamento financeiro unificado, calendário único, 60 avisos e 30 seletores.`);
