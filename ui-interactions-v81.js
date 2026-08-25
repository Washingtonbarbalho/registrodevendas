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

const ISO_CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CALENDAR_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const isCalendarDate = value => {
  if (!ISO_CALENDAR_DATE.test(String(value || ''))) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

const brazilCalendarToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

export const moveCalendarDate = (value, offset = 0) => {
  if (!isCalendarDate(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + Number(offset || 0)));
  return date.toISOString().slice(0, 10);
};

export const moveCalendarMonth = (value, offset = 0) => {
  if (!isCalendarDate(value)) return '';
  const [year, month] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + Number(offset || 0), 1));
  return date.toISOString().slice(0, 10);
};

export const buildCalendarMonth = value => {
  const reference = isCalendarDate(value) ? value : brazilCalendarToday();
  const firstDate = `${reference.slice(0, 7)}-01`;
  const [year, month] = firstDate.split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const visibleDays = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const firstVisible = moveCalendarDate(firstDate, -firstWeekday);
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(`${firstDate}T12:00:00Z`));

  return {
    month: firstDate.slice(0, 7),
    label: label.charAt(0).toUpperCase() + label.slice(1),
    firstWeekday,
    daysInMonth,
    days: Array.from({ length: visibleDays }, (_, index) => {
      const date = moveCalendarDate(firstVisible, index);
      return {
        date,
        day: Number(date.slice(8)),
        currentMonth: date.startsWith(firstDate.slice(0, 7))
      };
    })
  };
};

export const advanceCalendarRange = (selection, date) => {
  if (!isCalendarDate(date)) return null;
  const startDate = isCalendarDate(selection?.startDate) ? selection.startDate : '';
  const endDate = isCalendarDate(selection?.endDate) ? selection.endDate : '';
  if (!startDate || endDate) return { startDate: date, endDate: '' };
  return date < startDate
    ? { startDate: date, endDate: startDate }
    : { startDate, endDate: date };
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

const displayCalendarDate = value => isCalendarDate(value)
  ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
  : 'Escolha um dia';

const renderDateRange = descriptor => {
  const today = brazilCalendarToday();
  let selection = {
    startDate: isCalendarDate(descriptor.startDate) ? descriptor.startDate : '',
    endDate: isCalendarDate(descriptor.endDate) ? descriptor.endDate : ''
  };
  if (selection.startDate && selection.endDate && selection.startDate > selection.endDate) {
    selection = { startDate: selection.endDate, endDate: selection.startDate };
  }
  let choosingEnd = false;
  let visibleMonth = selection.startDate || today;

  const frame = buildDialogFrame({
    tone: 'info',
    title: descriptor.title || 'Selecione o período',
    message: 'Escolha a data inicial e depois a data final.',
    dismissible: true,
    cancelValue: null
  });
  frame.panel.classList.add('app82-calendar-panel');
  frame.panel.querySelector('.app81-dialog-icon').textContent = '▦';
  const instruction = frame.panel.querySelector('.app81-dialog-message');
  instruction.setAttribute('aria-live', 'polite');

  const body = makeElement('div', 'app82-calendar-body');
  const preview = makeElement('div', 'app82-calendar-preview');
  const startCard = makeElement('div', 'app82-calendar-preview-item is-start');
  const endCard = makeElement('div', 'app82-calendar-preview-item is-end');
  const startValue = makeElement('strong');
  const endValue = makeElement('strong');
  startCard.append(makeElement('span', '', 'Data inicial'), startValue);
  endCard.append(makeElement('span', '', 'Data final'), endValue);
  preview.append(startCard, makeElement('span', 'app82-calendar-preview-arrow', '→'), endCard);
  body.appendChild(preview);

  const navigation = makeElement('div', 'app82-calendar-navigation');
  const previous = makeElement('button', 'app82-calendar-nav-button', '‹');
  previous.type = 'button';
  previous.setAttribute('aria-label', 'Mês anterior');
  const monthTitle = makeElement('strong', 'app82-calendar-month');
  monthTitle.setAttribute('aria-live', 'polite');
  const next = makeElement('button', 'app82-calendar-nav-button', '›');
  next.type = 'button';
  next.setAttribute('aria-label', 'Próximo mês');
  navigation.append(previous, monthTitle, next);
  body.appendChild(navigation);

  const weekdays = makeElement('div', 'app82-calendar-weekdays');
  CALENDAR_WEEKDAYS.forEach(day => weekdays.appendChild(makeElement('span', '', day)));
  body.appendChild(weekdays);

  const grid = makeElement('div', 'app82-calendar-grid');
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', 'Seleção de datas');
  body.appendChild(grid);
  frame.panel.appendChild(body);

  const updateSelectionSummary = () => {
    startValue.textContent = displayCalendarDate(selection.startDate);
    endValue.textContent = displayCalendarDate(selection.endDate);
    startCard.classList.toggle('is-current-step', !choosingEnd);
    endCard.classList.toggle('is-current-step', choosingEnd);
    instruction.textContent = choosingEnd
      ? 'Agora escolha a data final. O período será aplicado automaticamente.'
      : 'Escolha a data inicial e depois a data final.';
  };

  const focusDate = date => requestAnimationFrame(() => {
    grid.querySelector(`[data-calendar-date="${date}"]`)?.focus({ preventScroll: true });
  });

  const renderMonth = preferredFocus => {
    const month = buildCalendarMonth(visibleMonth);
    monthTitle.textContent = month.label;
    grid.replaceChildren();

    month.days.forEach(day => {
      const isStart = day.date === selection.startDate;
      const isEnd = day.date === selection.endDate;
      const isBetween = !!selection.startDate && !!selection.endDate
        && day.date > selection.startDate && day.date < selection.endDate;
      const classes = [
        'app82-calendar-day',
        !day.currentMonth && 'is-outside',
        day.date === today && 'is-today',
        isStart && 'is-start',
        isEnd && 'is-end',
        isBetween && 'is-between'
      ].filter(Boolean).join(' ');
      const button = makeElement('button', classes, String(day.day));
      button.type = 'button';
      button.dataset.calendarDate = day.date;
      button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-selected', isStart || isEnd || isBetween ? 'true' : 'false');
      button.setAttribute('aria-label', new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
      }).format(new Date(`${day.date}T12:00:00Z`)));
      if (day.date === today) button.setAttribute('aria-current', 'date');

      button.addEventListener('click', () => {
        const nextSelection = advanceCalendarRange(choosingEnd ? selection : null, day.date);
        if (!nextSelection) return;
        selection = nextSelection;
        if (selection.endDate) {
          updateSelectionSummary();
          finishActiveTask(selection);
          return;
        }
        choosingEnd = true;
        visibleMonth = day.date;
        updateSelectionSummary();
        renderMonth(day.date);
      });

      button.addEventListener('keydown', event => {
        const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        if (!(event.key in offsets)) return;
        event.preventDefault();
        const nextDate = moveCalendarDate(day.date, offsets[event.key]);
        visibleMonth = nextDate;
        renderMonth(nextDate);
      });

      grid.appendChild(button);
    });

    if (preferredFocus) focusDate(preferredFocus);
  };

  previous.addEventListener('click', () => {
    visibleMonth = moveCalendarMonth(visibleMonth, -1);
    renderMonth();
  });
  next.addEventListener('click', () => {
    visibleMonth = moveCalendarMonth(visibleMonth, 1);
    renderMonth();
  });

  const footer = makeElement('footer', 'app81-dialog-footer');
  const cancel = makeElement('button', 'app81-dialog-button is-secondary', 'Cancelar');
  cancel.type = 'button';
  cancel.addEventListener('click', () => finishActiveTask(null));
  footer.appendChild(cancel);
  frame.panel.appendChild(footer);

  updateSelectionSummary();
  renderMonth();
  focusDate(selection.startDate || today);
};

function runNextTask() {
  if (activeTask || dialogQueue.length === 0) return;
  activeTask = dialogQueue.shift();
  if (activeTask.descriptor.kind === 'select') renderSelect(activeTask.descriptor);
  else if (activeTask.descriptor.kind === 'date-range') renderDateRange(activeTask.descriptor);
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

export const showAppDateRange = options => enqueueDialog({ kind: 'date-range', ...(options || {}) });

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
    select: showAppSelect,
    dateRange: showAppDateRange
  });
};
