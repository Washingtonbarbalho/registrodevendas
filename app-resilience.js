const STORAGE_PREFIX = 'registro-vendas:resilience:v2';
const WORKSPACE_KEY = `${STORAGE_PREFIX}:workspace`;
let restoringWorkspace = false;
let unloadingPage = false;
let lastAction = null;
let previousContexts = [];
let runtimeStack = [];

const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const readJson = (key, fallback = null) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        console.warn('Falha ao ler estado local:', error);
        return fallback;
    }
};

const writeJson = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn('Falha ao salvar estado local:', error);
    }
};

const removeKey = key => {
    try { localStorage.removeItem(key); } catch (_) {}
};

const waitFor = async (finder, timeout = 8000, interval = 100) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
        const result = finder();
        if (result) return result;
        await sleep(interval);
    }
    return null;
};

const getModalTitle = panel => {
    const title = panel.querySelector('h1, h2, h3, h4');
    const subtitle = title?.parentElement?.querySelector('p');
    return [title?.textContent, subtitle?.textContent].filter(Boolean).map(normalize).join('|');
};

const getSaleMode = screen => normalize(screen.querySelector('.sale-screen-header h2')?.textContent).includes('prazo') ? 'prazo' : 'direct';

const listContexts = () => {
    const contexts = [];
    const admin = document.querySelector('.admin-screen');
    const sale = document.querySelector('.sale-screen');
    if (admin) contexts.push({ node: admin, signature: 'admin:usuarios', kind: 'admin' });
    if (sale) contexts.push({ node: sale, signature: `sale:${getSaleMode(sale)}`, kind: 'sale' });
    document.querySelectorAll('.app-modal-panel').forEach((panel, index) => {
        contexts.push({ node: panel, signature: `modal:${getModalTitle(panel) || index}`, kind: 'modal' });
    });
    return contexts;
};

const formStorageKey = signature => `${STORAGE_PREFIX}:form:${signature}`;
const saleStorageKey = mode => `${STORAGE_PREFIX}:sale:${mode}`;

const findFieldLabel = field => {
    const parent = field.closest('div');
    const label = parent?.querySelector('label');
    if (label && label !== field) return normalize(label.textContent);
    const previous = field.previousElementSibling;
    if (previous?.tagName === 'LABEL') return normalize(previous.textContent);
    return '';
};

const fieldDescriptor = (field, index) => {
    const optionHint = field.tagName === 'SELECT' ? normalize(field.options?.[0]?.textContent) : '';
    return {
        index,
        tag: field.tagName,
        type: field.type || '',
        placeholder: normalize(field.getAttribute('placeholder')),
        label: findFieldLabel(field),
        optionHint
    };
};

const serializeFields = context => Array.from(context.querySelectorAll('input, select, textarea')).map((field, index) => ({
    ...fieldDescriptor(field, index),
    value: field.value,
    checked: !!field.checked
}));

const matchField = (context, saved) => {
    const fields = Array.from(context.querySelectorAll('input, select, textarea'));
    const scored = fields.map((field, index) => {
        const current = fieldDescriptor(field, index);
        let score = 0;
        if (saved.tag === current.tag) score += 2;
        if (saved.type === current.type) score += 1;
        if (saved.placeholder && saved.placeholder === current.placeholder) score += 8;
        if (saved.label && saved.label === current.label) score += 8;
        if (saved.optionHint && saved.optionHint === current.optionHint) score += 6;
        if (saved.index === index) score += 2;
        return { field, score };
    }).sort((a, b) => b.score - a.score);
    return scored[0]?.score >= 3 ? scored[0].field : fields[saved.index];
};

const setNativeValue = (field, saved) => {
    if (!field) return;
    if (field.type === 'checkbox' || field.type === 'radio') {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
        if (setter) setter.call(field, saved.checked);
        else field.checked = saved.checked;
    } else {
        const prototype = field.tagName === 'SELECT' ? HTMLSelectElement.prototype : field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        if (setter) setter.call(field, saved.value ?? '');
        else field.value = saved.value ?? '';
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
};

const saveContextForm = contextInfo => {
    if (!contextInfo?.node) return;
    writeJson(formStorageKey(contextInfo.signature), {
        updatedAt: new Date().toISOString(),
        fields: serializeFields(contextInfo.node)
    });
};

const restoreContextForm = async contextInfo => {
    if (!contextInfo?.node || contextInfo.node.dataset.rvDraftRestored === 'true') return;
    const saved = readJson(formStorageKey(contextInfo.signature));
    if (!saved?.fields?.length) {
        contextInfo.node.dataset.rvDraftRestored = 'true';
        return;
    }
    await sleep(220);
    saved.fields.forEach(fieldData => setNativeValue(matchField(contextInfo.node, fieldData), fieldData));
    contextInfo.node.dataset.rvDraftRestored = 'true';
};

const currentTab = () => {
    const active = document.querySelector('.app-nav-button.is-active, .mobile-nav-button.is-active');
    return normalize(active?.textContent);
};

const saveWorkspace = () => {
    const workspace = readJson(WORKSPACE_KEY, {}) || {};
    writeJson(WORKSPACE_KEY, {
        ...workspace,
        tab: currentTab() || workspace.tab || 'início',
        stack: runtimeStack,
        updatedAt: new Date().toISOString()
    });
};

const buildActionDescriptor = target => {
    const clickable = target.closest('button, [role="button"], .list-row');
    if (!clickable) return null;
    const row = clickable.closest('.list-row, .admin-user-row');
    const buttons = row ? Array.from(row.querySelectorAll('button')) : [];
    const rowTitle = row?.querySelector('.list-title, h3')?.textContent || '';
    const pageTitle = document.querySelector('.page-title')?.textContent || '';
    const parentModal = clickable.closest('.app-modal-panel');
    return {
        title: normalize(clickable.getAttribute('title')),
        text: normalize(clickable.textContent).slice(0, 100),
        rowTitle: normalize(rowTitle),
        buttonIndex: row && clickable.tagName === 'BUTTON' ? buttons.indexOf(clickable) : -1,
        clickRow: clickable.classList.contains('list-row'),
        pageTitle: normalize(pageTitle),
        parentModal: parentModal ? getModalTitle(parentModal) : ''
    };
};

const findActionElement = descriptor => {
    if (!descriptor) return null;
    let scope = document;
    if (descriptor.parentModal) {
        const panels = Array.from(document.querySelectorAll('.app-modal-panel'));
        scope = panels.find(panel => getModalTitle(panel) === descriptor.parentModal) || document;
    }

    if (descriptor.rowTitle) {
        const rows = Array.from(scope.querySelectorAll('.list-row, .admin-user-row'));
        const row = rows.find(item => normalize(item.querySelector('.list-title, h3')?.textContent) === descriptor.rowTitle);
        if (!row) return null;
        if (descriptor.clickRow) return row;
        const rowButtons = Array.from(row.querySelectorAll('button'));
        if (descriptor.buttonIndex >= 0 && rowButtons[descriptor.buttonIndex]) return rowButtons[descriptor.buttonIndex];
        if (descriptor.title) return rowButtons.find(button => normalize(button.getAttribute('title')) === descriptor.title) || null;
    }

    const candidates = Array.from(scope.querySelectorAll('button, [role="button"]'));
    if (descriptor.title) {
        const byTitle = candidates.find(item => normalize(item.getAttribute('title')) === descriptor.title);
        if (byTitle) return byTitle;
    }
    if (descriptor.text) {
        const exact = candidates.find(item => normalize(item.textContent) === descriptor.text);
        if (exact) return exact;
        return candidates.find(item => normalize(item.textContent).includes(descriptor.text) || descriptor.text.includes(normalize(item.textContent)));
    }
    return null;
};

const findInputByPlaceholder = (context, text) => Array.from(context.querySelectorAll('input')).find(input => normalize(input.placeholder).includes(normalize(text)));

const findInputByLabel = (context, text) => {
    const label = Array.from(context.querySelectorAll('label')).find(item => normalize(item.textContent).includes(normalize(text)));
    return label?.parentElement?.querySelector('input, select, textarea') || null;
};

const saleDraft = mode => readJson(saleStorageKey(mode), { cartItems: [] }) || { cartItems: [] };
const saveSaleDraft = (mode, patch) => writeJson(saleStorageKey(mode), { ...saleDraft(mode), ...patch, updatedAt: new Date().toISOString() });

const captureSaleState = screen => {
    const mode = getSaleMode(screen);
    const customerInput = findInputByPlaceholder(screen, 'nome do cliente');
    saveSaleDraft(mode, {
        fields: serializeFields(screen),
        customerName: customerInput?.value || '',
        addingCustomer: normalize(screen.textContent).includes('cadastro rápido')
    });
};

const captureCartAddition = screen => {
    const mode = getSaleMode(screen);
    const productInput = findInputByPlaceholder(screen, 'nome ou código');
    const quantity = findInputByLabel(screen, 'qtd');
    const discount = findInputByLabel(screen, 'desconto unit');
    const price = findInputByLabel(screen, 'preço unit');
    if (!productInput?.value) return;
    const item = {
        productSearch: productInput.value,
        quantity: quantity?.value || '1',
        discount: discount?.value || '',
        price: price?.value || ''
    };
    const draft = saleDraft(mode);
    const items = Array.isArray(draft.cartItems) ? [...draft.cartItems, item] : [item];
    saveSaleDraft(mode, { cartItems: items });
};

const chooseDropdownItem = async (input, wanted, timeout = 4000) => {
    if (!input || !wanted) return false;
    setNativeValue(input, { value: wanted, checked: false });
    input.focus();
    input.dispatchEvent(new Event('focus', { bubbles: true }));
    await sleep(160);
    const normalizedWanted = normalize(wanted.replace(/^#\d+\s*-\s*/, ''));
    const item = await waitFor(() => {
        const candidates = Array.from(document.querySelectorAll('.absolute.z-20 > div, .absolute.z-20 [class*="cursor-pointer"]'));
        return candidates.find(candidate => {
            const text = normalize(candidate.textContent);
            return text.includes(normalizedWanted) || normalize(wanted).includes(text);
        });
    }, timeout, 80);
    if (!item) return false;
    item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    item.click();
    await sleep(180);
    return true;
};

const restoreSale = async screen => {
    if (!screen || screen.dataset.rvDraftRestored === 'true') return;
    const mode = getSaleMode(screen);
    const draft = saleDraft(mode);
    if (!draft.updatedAt) {
        screen.dataset.rvDraftRestored = 'true';
        return;
    }

    await sleep(260);
    if (draft.addingCustomer) {
        const addCustomer = Array.from(screen.querySelectorAll('button')).find(button => normalize(button.textContent).includes('novo cadastro'));
        addCustomer?.click();
        await sleep(160);
    }

    if (draft.customerName && !draft.addingCustomer) {
        await chooseDropdownItem(findInputByPlaceholder(screen, 'nome do cliente'), draft.customerName);
    }

    const cartEmpty = normalize(screen.textContent).includes('nenhum produto adicionado');
    if (cartEmpty && Array.isArray(draft.cartItems)) {
        for (const item of draft.cartItems) {
            const productInput = findInputByPlaceholder(screen, 'nome ou código');
            const selected = await chooseDropdownItem(productInput, item.productSearch);
            if (!selected) continue;
            setNativeValue(findInputByLabel(screen, 'qtd'), { value: item.quantity, checked: false });
            setNativeValue(findInputByLabel(screen, 'desconto unit'), { value: item.discount, checked: false });
            setNativeValue(findInputByLabel(screen, 'preço unit'), { value: item.price, checked: false });
            const addButton = Array.from(screen.querySelectorAll('button')).find(button => normalize(button.textContent).includes('adicionar no carrinho'));
            addButton?.click();
            await sleep(220);
        }
    }

    const method = draft.paymentMethod;
    if (method) {
        const methodButton = Array.from(screen.querySelectorAll('button')).find(button => normalize(button.textContent) === normalize(method));
        methodButton?.click();
        await sleep(120);
    }

    (draft.fields || []).forEach(fieldData => setNativeValue(matchField(screen, fieldData), fieldData));
    screen.dataset.rvDraftRestored = 'true';
};

const handleContextChanges = async () => {
    const current = listContexts();
    const previousSignatures = previousContexts.map(item => item.signature);
    const currentSignatures = current.map(item => item.signature);

    if (!restoringWorkspace) {
        if (current.length > previousContexts.length) {
            current.slice(previousContexts.length).forEach(info => {
                runtimeStack.push({ signature: info.signature, kind: info.kind, action: lastAction });
            });
            saveWorkspace();
        } else if (current.length < previousContexts.length && !unloadingPage) {
            const removed = previousContexts.filter(item => !currentSignatures.includes(item.signature));
            removed.forEach(item => removeKey(formStorageKey(item.signature)));
            if (removed.some(item => item.kind === 'sale')) removeKey(saleStorageKey(removed.find(item => item.kind === 'sale').signature.split(':')[1]));
            runtimeStack = runtimeStack.slice(0, current.length);
            saveWorkspace();
        }
    }

    previousContexts = current;
    current.forEach(info => {
        if (info.kind === 'sale') restoreSale(info.node);
        else if (info.kind === 'modal') restoreContextForm(info);
    });
};

const restoreWorkspace = async () => {
    const workspace = readJson(WORKSPACE_KEY, null);
    if (!workspace) return;
    restoringWorkspace = true;

    const navButton = await waitFor(() => {
        const buttons = Array.from(document.querySelectorAll('.app-nav-button, .mobile-nav-button'));
        return buttons.find(button => normalize(button.textContent) === normalize(workspace.tab));
    }, 8000, 120);
    navButton?.click();
    await sleep(240);

    for (const entry of workspace.stack || []) {
        const action = await waitFor(() => findActionElement(entry.action), 6500, 120);
        if (!action) break;
        action.click();
        await waitFor(() => listContexts().some(context => context.signature === entry.signature), 6500, 120);
        await sleep(180);
    }

    runtimeStack = Array.isArray(workspace.stack) ? [...workspace.stack] : [];
    previousContexts = listContexts();
    restoringWorkspace = false;
    handleContextChanges();
};

document.addEventListener('click', event => {
    const nav = event.target.closest('.app-nav-button, .mobile-nav-button');
    if (nav) {
        setTimeout(() => saveWorkspace(), 20);
    }

    const screen = event.target.closest('.sale-screen');
    const button = event.target.closest('button');
    if (screen && button) {
        const text = normalize(button.textContent);
        const mode = getSaleMode(screen);
        if (['pix', 'dinheiro', 'débito', 'crédito'].includes(text)) saveSaleDraft(mode, { paymentMethod: button.textContent.trim() });
        if (text.includes('adicionar no carrinho')) captureCartAddition(screen);
    }

    if (!restoringWorkspace) lastAction = buildActionDescriptor(event.target);
}, true);

document.addEventListener('input', event => {
    const context = listContexts().find(item => item.node.contains(event.target));
    if (!context) return;
    if (context.kind === 'sale') captureSaleState(context.node);
    else if (context.kind === 'modal') saveContextForm(context);
}, true);

document.addEventListener('change', event => {
    const context = listContexts().find(item => item.node.contains(event.target));
    if (!context) return;
    if (context.kind === 'sale') captureSaleState(context.node);
    else if (context.kind === 'modal') saveContextForm(context);
}, true);

window.addEventListener('beforeunload', () => {
    unloadingPage = true;
    listContexts().forEach(context => {
        if (context.kind === 'sale') captureSaleState(context.node);
        else if (context.kind === 'modal') saveContextForm(context);
    });
    saveWorkspace();
});

const observer = new MutationObserver(() => {
    clearTimeout(window.__rvContextTimer);
    window.__rvContextTimer = setTimeout(handleContextChanges, 60);
});
observer.observe(document.documentElement, { childList: true, subtree: true });

setTimeout(() => {
    previousContexts = listContexts();
    restoreWorkspace();
}, 450);
