const TONE_DEFINITIONS = {
  success: { title: 'Tudo certo', symbol: '✓' },
  error: { title: 'Não foi possível concluir', symbol: '!' },
  warning: { title: 'Atenção', symbol: '!' },
  info: { title: 'Informação', symbol: 'i' },
  danger: { title: 'Confirme esta ação', symbol: '!' }
};

const normalizeText = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export const inferAlertTone = message => {
  const normalized = normalizeText(message);
  if (/(erro|nao foi possivel|falha|indisponivel|nao encontrado)/.test(normalized)) return 'error';
  if (/(copiad|salv|concluid|sucesso|atualizad|registrad)/.test(normalized)) return 'success';
  if (/(informe|selecione|configure|obrigatori|inval|insuficiente|maior|nao pode)/.test(normalized)) return 'warning';
  return 'info';
};

export const filterModalOptions = (options, query) => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [...options];
  return options.filter(option => normalizeText(`${option.group || ''} ${option.label}`).includes(normalizedQuery));
};

export const readSelectOptions = select => {
  const rows = [];
  const appendOption = (option, group = '') => {
    if (!option || String(option.tagName || '').toUpperCase() !== 'OPTION') return;
    rows.push({
      value: String(option.value ?? ''),
      label: String(option.label || option.textContent || option.value || '').replace(/\s+/g, ' ').trim(),
      group,
      disabled: !!option.disabled,
      selected: !!option.selected
    });
  };

  Array.from(select?.children || []).forEach(child => {
    const tag = String(child?.tagName || '').toUpperCase();
    if (tag === 'OPTGROUP') {
      const group = String(child.label || '').trim();
      Array.from(child.children || []).forEach(option => appendOption(option, group));
    } else {
      appendOption(child);
    }
  });
  return rows;
};

let installed = false;
let host = null;
let activeTask = null;
const dialogQueue = [];
let lastSelect = null;
let lastSelectOpenedAt = 0;
let selectObserver = null;

const makeElement = (tag, className = '', text = '') => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== '') element.textContent = text;
  return element;
};

const ensureHost = () => {
  if (host?.isConnected) return host;
  host = makeElement('div', 'app81-ui-host');
  host.id = 'app-interaction-layer';
  document.body.appendChild(host);
  return host;
};

const getFocusable = panel => Array.from(panel.querySelectorAll(
  'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
));

const finishActiveTask = value => {
  if (!activeTask) return;
  const completed = activeTask;
  activeTask = null;
  completed.cleanup?.();
  ensureHost().replaceChildren();
  completed.resolve(value);
  queueMicrotask(runNextTask);
};

const buildDialogFrame = ({ tone = 'info', title, message, dismissible = true, cancelValue = false }) => {
  const overlay = makeElement('div', 'app81-dialog-overlay');
  overlay.setAttribute('role', 'presentation');
  const panel = makeElement('section', 'app81-dialog-panel');
  panel.dataset.tone = tone;
  panel.setAttribute('role', tone === 'error' || tone === 'warning' || tone === 'danger' ? 'alertdialog' : 'dialog');
  panel.setAttribute('aria-modal', 'true');

  const header = makeElement('header', 'app81-dialog-header');
  const icon = makeElement('span', 'app81-dialog-icon', TONE_DEFINITIONS[tone]?.symbol || 'i');
  icon.setAttribute('aria-hidden', 'true');
  const heading = makeElement('div', 'app81-dialog-heading');
  const eyebrow = makeElement('span', 'app81-dialog-eyebrow', tone === 'danger' ? 'Ação sensível' : 'Registro de Vendas');
  const titleElement = makeElement('h2', '', title || TONE_DEFINITIONS[tone]?.title || 'Informação');
  heading.append(eyebrow, titleElement);
  header.append(icon, heading);

  if (dismissible) {
    const close = makeElement('button', 'app81-dialog-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Fechar');
    close.addEventListener('click', () => finishActiveTask(cancelValue));
    header.appendChild(close);
  }

  panel.appendChild(header);
  if (message) panel.appendChild(makeElement('p', 'app81-dialog-message', String(message)));
  overlay.appendChild(panel);
  ensureHost().appendChild(overlay);

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const keyHandler = event => {
    if (event.key === 'Escape' && dismissible) {
      event.preventDefault();
      finishActiveTask(cancelValue);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = getFocusable(panel);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', keyHandler, true);
  overlay.addEventListener('click', event => {
    if (event.target === overlay && dismissible) finishActiveTask(cancelValue);
  });
  activeTask.cleanup = () => {
    document.body.style.overflow = previousOverflow;
    document.removeEventListener('keydown', keyHandler, true);
  };
  return { overlay, panel };
};

const renderFeedback = descriptor => {
  const tone = descriptor.tone || (descriptor.kind === 'confirm' ? 'warning' : inferAlertTone(descriptor.message));
  const frame = buildDialogFrame({
    tone,
    title: descriptor.title || TONE_DEFINITIONS[tone]?.title,
    message: descriptor.message,
    dismissible: true,
    cancelValue: false
  });
  const footer = makeElement('footer', 'app81-dialog-footer');

  if (descriptor.kind === 'confirm') {
    const cancel = makeElement('button', 'app81-dialog-button is-secondary', descriptor.cancelLabel || 'Voltar');
    cancel.type = 'button';
    cancel.addEventListener('click', () => finishActiveTask(false));
    const confirm = makeElement(
      'button',
      `app81-dialog-button is-primary ${tone === 'danger' ? 'is-danger' : ''}`,
      descriptor.confirmLabel || 'Confirmar'
    );
    confirm.type = 'button';
    confirm.addEventListener('click', () => finishActiveTask(true));
    footer.append(cancel, confirm);
    frame.panel.appendChild(footer);
    requestAnimationFrame(() => cancel.focus());
  } else {
    const acknowledge = makeElement('button', 'app81-dialog-button is-primary', descriptor.confirmLabel || 'Entendi');
    acknowledge.type = 'button';
    acknowledge.addEventListener('click', () => finishActiveTask(true));
    footer.appendChild(acknowledge);
    frame.panel.appendChild(footer);
    requestAnimationFrame(() => acknowledge.focus());
  }
};

const inferSelectTitle = select => {
  const explicit = select.getAttribute('aria-label') || select.getAttribute('title');
  if (explicit) return explicit;
  const label = select.closest('label') || Array.from(select.labels || [])[0];
  const labelText = label?.querySelector(':scope > span')?.textContent
    || Array.from(label?.childNodes || []).find(node => node.nodeType === Node.TEXT_NODE)?.textContent;
  if (String(labelText || '').trim()) return String(labelText).replace(/[*:]/g, '').trim();
  const previousLabel = select.previousElementSibling;
  if (previousLabel?.matches('label, p, span')) return previousLabel.textContent.replace(/[*:]/g, '').trim();
  return select.name ? `Selecionar ${select.name}` : 'Escolha uma opção';
};

const updateNativeSelect = (select, value) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (setter) setter.call(select, value);
  else select.value = value;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

const renderSelect = descriptor => {
  const { select } = descriptor;
  if (!select?.isConnected || select.disabled) {
    finishActiveTask(null);
    return;
  }
  const options = readSelectOptions(select);
  const frame = buildDialogFrame({
    tone: 'info',
    title: inferSelectTitle(select),
    message: descriptor.description || 'Toque na opção desejada para continuar.',
    dismissible: true,
    cancelValue: null
  });
  frame.panel.classList.add('app81-select-panel');

  const body = makeElement('div', 'app81-select-body');
  let search = null;
  if (options.length > 8) {
    const searchWrap = makeElement('div', 'app81-select-search');
    searchWrap.appendChild(makeElement('span', '', '⌕'));
    search = makeElement('input');
    search.type = 'search';
    search.placeholder = `Buscar entre ${options.length} opções...`;
    search.setAttribute('aria-label', 'Buscar opção');
    searchWrap.appendChild(search);
    body.appendChild(searchWrap);
  }

  const list = makeElement('div', 'app81-select-list');
  list.setAttribute('role', 'listbox');
  body.appendChild(list);
  frame.panel.appendChild(body);

  const renderRows = query => {
    const visible = filterModalOptions(options, query);
    list.replaceChildren();
    let currentGroup = null;
    visible.forEach(option => {
      if (option.group && option.group !== currentGroup) {
        currentGroup = option.group;
        list.appendChild(makeElement('div', 'app81-select-group', currentGroup));
      }
      const button = makeElement('button', `app81-select-option ${option.selected ? 'is-selected' : ''}`);
      button.type = 'button';
      button.disabled = option.disabled;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', option.selected ? 'true' : 'false');
      button.appendChild(makeElement('span', 'app81-select-option-label', option.label || 'Sem descrição'));
      button.appendChild(makeElement('span', 'app81-select-option-check', option.selected ? '✓' : ''));
      button.addEventListener('click', () => {
        updateNativeSelect(select, option.value);
        finishActiveTask(option.value);
        requestAnimationFrame(() => select.isConnected && select.focus({ preventScroll: true }));
      });
      list.appendChild(button);
    });
    if (visible.length === 0) {
      list.appendChild(makeElement('div', 'app81-select-empty', 'Nenhuma opção encontrada.'));
    }
  };

  renderRows('');
  search?.addEventListener('input', () => renderRows(search.value));
  const footer = makeElement('footer', 'app81-dialog-footer');
  const cancel = makeElement('button', 'app81-dialog-button is-secondary', 'Cancelar');
  cancel.type = 'button';
  cancel.addEventListener('click', () => finishActiveTask(null));
  footer.appendChild(cancel);
  frame.panel.appendChild(footer);

  requestAnimationFrame(() => {
    if (search) search.focus();
    else (list.querySelector('.is-selected') || list.querySelector('button:not([disabled])'))?.focus();
  });
};

function runNextTask() {
  if (activeTask || dialogQueue.length === 0) return;
  activeTask = dialogQueue.shift();
  if (activeTask.descriptor.kind === 'select') renderSelect(activeTask.descriptor);
  else renderFeedback(activeTask.descriptor);
}

const enqueueDialog = descriptor => new Promise(resolve => {
  dialogQueue.push({ descriptor, resolve, cleanup: null });
  runNextTask();
});

export const showAppAlert = (message, options = {}) => enqueueDialog({
  kind: 'alert',
  message: String(message || 'O sistema precisa da sua atenção.'),
  ...options
});

export const showAppConfirm = (message, options = {}) => enqueueDialog({
  kind: 'confirm',
  message: String(message || 'Deseja continuar?'),
  tone: options.danger ? 'danger' : options.tone || 'warning',
  ...options
});

export const showAppSelect = select => enqueueDialog({ kind: 'select', select });

const selectFromEvent = event => {
  const target = event.target;
  return target instanceof Element ? target.closest('select') : null;
};

const interceptSelectPointer = event => {
  const select = selectFromEvent(event);
  if (!select || select.disabled || select.multiple || select.dataset.nativeSelect === 'true') return;
  event.preventDefault();
  event.stopPropagation();
  const now = Date.now();
  if (lastSelect === select && now - lastSelectOpenedAt < 500) return;
  lastSelect = select;
  lastSelectOpenedAt = now;
  void showAppSelect(select);
};

const interceptSelectKeyboard = event => {
  const select = selectFromEvent(event);
  if (!select || select.disabled || select.multiple || !['Enter', ' ', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  void showAppSelect(select);
};

const decorateSelects = root => {
  const selects = [];
  if (root?.matches?.('select')) selects.push(root);
  root?.querySelectorAll?.('select').forEach(select => selects.push(select));
  selects.forEach(select => {
    if (select.multiple || select.dataset.nativeSelect === 'true') return;
    select.dataset.appSelect = 'dialog';
    select.setAttribute('aria-haspopup', 'dialog');
  });
};

export const installUiInteractions = () => {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return;
  installed = true;
  document.documentElement.classList.add('app81-ui-enhanced');
  ensureHost();
  decorateSelects(document);
  selectObserver = new MutationObserver(records => records.forEach(record =>
    record.addedNodes.forEach(node => decorateSelects(node))
  ));
  selectObserver.observe(document.body, { childList: true, subtree: true });

  window.alert = message => { void showAppAlert(message); };
  document.addEventListener('pointerdown', interceptSelectPointer, true);
  document.addEventListener('mousedown', interceptSelectPointer, true);
  document.addEventListener('touchstart', interceptSelectPointer, { capture: true, passive: false });
  document.addEventListener('click', interceptSelectPointer, true);
  document.addEventListener('keydown', interceptSelectKeyboard, true);

  window.RegistroVendasUI = Object.freeze({
    alert: showAppAlert,
    confirm: showAppConfirm,
    select: showAppSelect
  });
};
