import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { filterModalOptions, inferAlertTone, readSelectOptions } from '../ui-interactions-v81.js';

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

const interactionSource = read('ui-interactions-v81.js');
for (const marker of [
  'window.alert = message =>',
  "document.addEventListener('pointerdown', interceptSelectPointer, true)",
  "document.addEventListener('touchstart', interceptSelectPointer",
  "document.addEventListener('keydown', interceptSelectKeyboard, true)",
  "select.setAttribute('aria-haspopup', 'dialog')",
  'new MutationObserver(records =>',
  "select.dispatchEvent(new Event('change', { bubbles: true }))",
  'options.length > 8',
  'Buscar entre ${options.length} opções',
  "role', 'listbox'",
  "aria-selected",
  'showAppConfirm',
  'showAppAlert'
]) assert.ok(interactionSource.includes(marker), `Camada interativa incompleta: ${marker}`);

const bootstrap = read('bootstrap-v75.js');
assert.ok(bootstrap.includes("import { installUiInteractions } from './ui-interactions-v81.js?v=81'"));
assert.ok(bootstrap.indexOf('installUiInteractions();') < bootstrap.indexOf("import(`./app-runtime-v75.js?v=${VERSION}`)"),
  'A camada visual precisa iniciar antes da aplicação.');

const productionFiles = fs.readdirSync(root)
  .filter(file => file.endsWith('.js'));
const productionSource = productionFiles.map(file => read(file)).join('\n');
assert.equal((productionSource.match(/\b(?:window\.)?(?:confirm|prompt)\s*\(/g) || []).length, 0,
  'Nenhuma confirmação ou prompt nativo pode permanecer no sistema.');
assert.equal((productionSource.match(/(?:createElement|\bh)\(['"]select['"]/g) || []).length, 28,
  'Todas as 28 listas suspensas auditadas precisam continuar cobertas pela camada visual.');
assert.equal((productionSource.match(/\b(?:window\.)?alert\s*\(/g) || []).length, 57,
  'Os 57 avisos auditados precisam permanecer cobertos pelo interceptador profissional.');
assert.ok(!/(?:createElement|\bh)\(['"]select['"][\s\S]{0,220}?multiple\s*:/.test(productionSource),
  'Seletores múltiplos exigiriam uma interação específica.');

for (const file of ['auth-admin.js', 'aba-financeiro-v68.js']) {
  const source = read(file);
  assert.ok(source.includes("from './ui-interactions-v81.js?v=81'"));
  assert.ok(source.includes('await showAppConfirm('));
}

const authScreen = read('auth-screen-v71.js');
assert.equal((authScreen.match(/React\.createElement\('form', \{[^}]*noValidate: true/g) || []).length, 2,
  'Login e cadastro não podem exibir validações nativas do navegador.');

const styles = read('styles-runtime-v75.css');
for (const marker of [
  '.app81-dialog-overlay', '.app81-dialog-panel', '.app81-select-panel',
  '.app81-select-search', '.app81-select-option.is-selected',
  '@keyframes app81-sheet-in', '@media (prefers-reduced-motion: reduce)'
]) assert.ok(styles.includes(marker), `Estilo interativo ausente: ${marker}`);

console.log('Interface v81 validada: 57 avisos, todas as confirmações e 28 listas suspensas usam a experiência visual do sistema.');
