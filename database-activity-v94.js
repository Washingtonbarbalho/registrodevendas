const DEFAULT_MESSAGE = 'Atualizando informações...';
const activeOperations = new Map();
let operationSequence = 0;
let overlay = null;
let messageNode = null;
let hideTimer = null;

const hasDocument = () => typeof document !== 'undefined' && !!document.body;

const ensureOverlay = () => {
  if (!hasDocument()) return null;
  if (overlay?.isConnected) return overlay;

  overlay = document.createElement('div');
  overlay.className = 'app94-database-loading';
  overlay.hidden = true;
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.setAttribute('aria-atomic', 'true');

  const panel = document.createElement('div');
  panel.className = 'app94-database-loading-panel';

  const spinner = document.createElement('span');
  spinner.className = 'app94-database-loading-spinner';
  spinner.setAttribute('aria-hidden', 'true');

  const copy = document.createElement('span');
  copy.className = 'app94-database-loading-copy';
  messageNode = document.createElement('strong');
  messageNode.textContent = DEFAULT_MESSAGE;
  const hint = document.createElement('small');
  hint.textContent = 'Aguarde a sincronização com o banco de dados.';

  copy.append(messageNode, hint);
  panel.append(spinner, copy);
  overlay.append(panel);
  document.body.append(overlay);
  return overlay;
};

const renderActivity = () => {
  const currentOverlay = ensureOverlay();
  if (!currentOverlay) return;

  if (activeOperations.size > 0) {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    const messages = [...activeOperations.values()];
    messageNode.textContent = messages[messages.length - 1] || DEFAULT_MESSAGE;
    currentOverlay.hidden = false;
    currentOverlay.setAttribute('aria-busy', 'true');
    document.documentElement.classList.add('app94-database-is-busy');
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => currentOverlay.classList.add('is-visible'));
    } else {
      currentOverlay.classList.add('is-visible');
    }
    return;
  }

  currentOverlay.classList.remove('is-visible');
  currentOverlay.setAttribute('aria-busy', 'false');
  document.documentElement.classList.remove('app94-database-is-busy');
  hideTimer = setTimeout(() => {
    if (activeOperations.size === 0 && currentOverlay) currentOverlay.hidden = true;
  }, 180);
};

const waitForInterfacePaint = () => new Promise(resolve => {
  if (typeof requestAnimationFrame !== 'function') {
    setTimeout(resolve, 0);
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(resolve));
});

export const beginDatabaseActivity = (message = DEFAULT_MESSAGE) => {
  const id = ++operationSequence;
  activeOperations.set(id, String(message || DEFAULT_MESSAGE));
  renderActivity();
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    activeOperations.delete(id);
    renderActivity();
  };
};

export const finishDatabaseActivityAfterPaint = async finish => {
  await waitForInterfacePaint();
  finish?.();
};

export const trackDatabaseOperation = async (operation, message = DEFAULT_MESSAGE) => {
  const finish = beginDatabaseActivity(message);
  try {
    return await (typeof operation === 'function' ? operation() : operation);
  } finally {
    void finishDatabaseActivityAfterPaint(finish);
  }
};

export const getActiveDatabaseOperations = () => activeOperations.size;
