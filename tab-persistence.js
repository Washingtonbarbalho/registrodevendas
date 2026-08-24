const PREFIX = 'registro-vendas:reload-session:v3';
const WORKSPACE_KEY = `${PREFIX}:workspace`;
const LEGACY_LOCAL_PREFIXES = [
    'registro-vendas:resilience:',
    'registro-vendas:draft:',
    'registro-vendas:workspace',
    'registro-vendas:last-tab:'
];

const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const readSession = (key, fallback = null) => {
    try {
        const raw = sessionStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        console.warn('Não foi possível ler o estado temporário:', error);
        return fallback;
    }
};

const writeSession = (key, value) => {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn('Não foi possível salvar o estado temporário:', error);
    }
};

const removeSession = key => {
    try { sessionStorage.removeItem(key); } catch (_) {}
};

const clearTemporaryState = () => {
    try {
        Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith(PREFIX)) sessionStorage.removeItem(key);
        });
    } catch (_) {}
};

const clearLegacyLocalState = () => {
    try {
        Object.keys(localStorage).forEach(key => {
            if (LEGACY_LOCAL_PREFIXES.some(prefix => key.startsWith(prefix))) {
                localStorage.removeItem(key);
            }
        });
    } catch (_) {}
};

const navigationEntry = performance.getEntriesByType?.('navigation')?.[0];
const isPageReload = navigationEntry
    ? navigationEntry.type === 'reload'
    : performance.navigation?.type === 1;

clearLegacyLocalState();
if (!isPageReload) clearTemporaryState();

const waitFor = async (finder, timeout = 7000, interval = 100) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
        const result = finder();
        if (result) return result;
        await sleep(interval);
    }
    return null;
};

const identifyTab = text => {
    const label = normalize(text);
    if (label === 'visao geral' || label === 'inicio') return 'dashboard';
    if (label === 'vendas' || label === 'vendas a prazo' || label === 'a prazo') return 'sales';
    if (label === 'vendas no caixa' || label === 'caixa') return 'sales';
    if (label === 'produtos') return 'products';
    if (label === 'clientes') return 'customers';
    if (label === 'comercial') return 'commercial';
    if (label === 'financeiro' || label === 'fin.') return 'finance';
    if (label === 'relatorios' || label === 'relat.') return 'reports';
    if (label === 'backup e dados' || label === 'backup') return 'backup';
    if (label === 'taxas e juros' || label === 'taxas') return 'rates';
    return null;
};

const normalizeTabId = tab => tab === 'cashier' ? 'sales' : tab || 'dashboard';
let lastKnownTab = normalizeTabId(readSession(WORKSPACE_KEY, {})?.tab);

const currentTab = () => {
    const active = document.querySelector('.app-nav-button.is-active, .mobile-nav-button.is-active, .mobile-menu-nav-button.is-active, .mobile-quick-nav-button.is-active');
    const identified = identifyTab(active?.textContent);
    if (identified) lastKnownTab = identified;
    return lastKnownTab;
};

const getModalSignature = panel => {
    const title = normalize(panel.querySelector('h1, h2, h3, h4')?.textContent);
    const header = panel.querySelector(':scope > div[class*="border-b"]:first-child, :scope > header');
    const subtitle = normalize(header?.querySelector('p')?.textContent);
    return `modal:${title || 'sem-titulo'}:${subtitle}`;
};

const getSaleMode = screen => normalize(screen.querySelector('.sale-screen-header h2')?.textContent).includes('prazo') ? 'prazo' : 'direct';

const listContexts = () => {
    const contexts = [];
    const adminScreen = document.querySelector('.admin-screen');
    const saleScreen = document.querySelector('.sale-screen');

    if (adminScreen) contexts.push({ node: adminScreen, signature: 'admin:usuarios', kind: 'admin' });
    if (saleScreen) contexts.push({ node: saleScreen, signature: `sale:${getSaleMode(saleScreen)}`, kind: 'sale' });

    document.querySelectorAll('.app-modal-panel').forEach(panel => {
        contexts.push({ node: panel, signature: getModalSignature(panel), kind: 'modal' });
    });

    return contexts;
};

const fieldDescriptor = (field, index) => ({
    index,
    tag: field.tagName,
    type: field.type || '',
    name: field.name || '',
    placeholder: normalize(field.getAttribute('placeholder')),
    label: normalize(field.closest('div')?.querySelector('label')?.textContent),
    optionHint: field.tagName === 'SELECT' ? normalize(field.options?.[0]?.textContent) : ''
});

const serializeFields = context => Array.from(context.querySelectorAll('input, select, textarea')).map((field, index) => ({
    ...fieldDescriptor(field, index),
    value: field.value,
    checked: !!field.checked
}));

const findMatchingField = (context, saved) => {
    const fields = Array.from(context.querySelectorAll('input, select, textarea'));
    const ranked = fields.map((field, index) => {
        const current = fieldDescriptor(field, index);
        let score = 0;
        if (saved.tag === current.tag) score += 2;
        if (saved.type === current.type) score += 2;
        if (saved.name && saved.name === current.name) score += 8;
        if (saved.placeholder && saved.placeholder === current.placeholder) score += 9;
        if (saved.label && saved.label === current.label) score += 8;
        if (saved.optionHint && saved.optionHint === current.optionHint) score += 6;
        if (saved.index === index) score += 2;
        return { field, score };
    }).sort((a, b) => b.score - a.score);

    return ranked[0]?.score >= 4 ? ranked[0].field : fields[saved.index];
};

const setNativeFieldValue = (field, saved) => {
    if (!field) return;

    if (field.type === 'checkbox' || field.type === 'radio') {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
        if (setter) setter.call(field, !!saved.checked);
        else field.checked = !!saved.checked;
    } else {
        const prototype = field.tagName === 'SELECT'
            ? HTMLSelectElement.prototype
            : field.tagName === 'TEXTAREA'
                ? HTMLTextAreaElement.prototype
                : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        if (setter) setter.call(field, saved.value ?? '');
        else field.value = saved.value ?? '';
    }

    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
};

const formKey = (context, index) => `${PREFIX}:form:${index}:${context.signature}`;
const saleKey = mode => `${PREFIX}:sale:${mode}`;

const saveContextForm = (context, index) => {
    if (!context?.node) return;
    writeSession(formKey(context, index), {
        fields: serializeFields(context.node),
        updatedAt: Date.now()
    });
};

const restoreContextForm = async (context, index) => {
    if (!context?.node || context.node.dataset.reloadSessionRestored === 'true') return;
    const saved = readSession(formKey(context, index));
    if (!saved?.fields?.length) {
        context.node.dataset.reloadSessionRestored = 'true';
        return;
    }

    await sleep(180);
    saved.fields.forEach(field => setNativeFieldValue(findMatchingField(context.node, field), field));
    context.node.dataset.reloadSessionRestored = 'true';
};

const buildActionDescriptor = target => {
    const clickable = target.closest('button, [role="button"], .list-row, .metric-card.is-clickable');
    if (!clickable) return null;

    const row = clickable.closest('.list-row, .admin-user-row');
    const rowButtons = row ? Array.from(row.querySelectorAll('button')) : [];
    const parentModal = clickable.closest('.app-modal-panel');

    return {
        title: normalize(clickable.getAttribute('title')),
        text: normalize(clickable.textContent).slice(0, 120),
        rowTitle: normalize(row?.querySelector('.list-title, h3')?.textContent),
        buttonIndex: row && clickable.tagName === 'BUTTON' ? rowButtons.indexOf(clickable) : -1,
        clickRow: clickable.classList.contains('list-row'),
        parentModal: parentModal ? getModalSignature(parentModal) : ''
    };
};

const findActionElement = descriptor => {
    if (!descriptor) return null;

    let scope = document;
    if (descriptor.parentModal) {
        scope = Array.from(document.querySelectorAll('.app-modal-panel'))
            .find(panel => getModalSignature(panel) === descriptor.parentModal) || document;
    }

    if (descriptor.rowTitle) {
        const row = Array.from(scope.querySelectorAll('.list-row, .admin-user-row'))
            .find(item => normalize(item.querySelector('.list-title, h3')?.textContent) === descriptor.rowTitle);
        if (!row) return null;
        if (descriptor.clickRow) return row;
        const buttons = Array.from(row.querySelectorAll('button'));
        if (descriptor.buttonIndex >= 0 && buttons[descriptor.buttonIndex]) return buttons[descriptor.buttonIndex];
        if (descriptor.title) return buttons.find(button => normalize(button.getAttribute('title')) === descriptor.title) || null;
    }

    const candidates = Array.from(scope.querySelectorAll('button, [role="button"], .metric-card.is-clickable'));
    if (descriptor.title) {
        const byTitle = candidates.find(item => normalize(item.getAttribute('title')) === descriptor.title);
        if (byTitle) return byTitle;
    }
    if (descriptor.text) {
        return candidates.find(item => normalize(item.textContent) === descriptor.text)
            || candidates.find(item => normalize(item.textContent).includes(descriptor.text));
    }
    return null;
};

const findInputByPlaceholder = (context, text) => Array.from(context.querySelectorAll('input'))
    .find(input => normalize(input.placeholder).includes(normalize(text)));

const findInputByLabel = (context, text) => {
    const label = Array.from(context.querySelectorAll('label'))
        .find(item => normalize(item.textContent).includes(normalize(text)));
    return label?.parentElement?.querySelector('input, select, textarea') || null;
};

const readSaleDraft = mode => readSession(saleKey(mode), { cartItems: [] }) || { cartItems: [] };
const saveSaleDraft = (mode, patch) => writeSession(saleKey(mode), {
    ...readSaleDraft(mode),
    ...patch,
    updatedAt: Date.now()
});

const captureSaleState = screen => {
    const mode = getSaleMode(screen);
    const customerInput = findInputByPlaceholder(screen, 'nome do cliente');
    saveSaleDraft(mode, {
        fields: serializeFields(screen),
        customerName: customerInput?.value || '',
        addingCustomer: normalize(screen.textContent).includes('cadastro rapido')
    });
};

const captureCartAddition = screen => {
    const productInput = findInputByPlaceholder(screen, 'nome ou codigo');
    if (!productInput?.value) return;

    const item = {
        productSearch: productInput.value,
        quantity: findInputByLabel(screen, 'qtd')?.value || '1',
        discount: findInputByLabel(screen, 'desconto unit')?.value || '',
        price: findInputByLabel(screen, 'preco unit')?.value || ''
    };

    const mode = getSaleMode(screen);
    const current = readSaleDraft(mode);
    saveSaleDraft(mode, {
        cartItems: [...(Array.isArray(current.cartItems) ? current.cartItems : []), item]
    });
};

const chooseAutocompleteItem = async (input, wanted) => {
    if (!input || !wanted) return false;

    setNativeFieldValue(input, { value: wanted, checked: false });
    input.focus();
    input.dispatchEvent(new Event('focus', { bubbles: true }));
    await sleep(180);

    const normalizedWanted = normalize(wanted.replace(/^#\d+\s*-\s*/, ''));
    const option = await waitFor(() => {
        const candidates = Array.from(document.querySelectorAll('.absolute.z-20 > div, .absolute.z-20 [class*="cursor-pointer"]'));
        return candidates.find(candidate => {
            const text = normalize(candidate.textContent);
            return text.includes(normalizedWanted) || normalizedWanted.includes(text);
        });
    }, 4000, 80);

    if (!option) return false;
    option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    option.click();
    await sleep(180);
    return true;
};

const restoreSaleScreen = async screen => {
    if (!screen || screen.dataset.reloadSessionRestored === 'true') return;
    const mode = getSaleMode(screen);
    const draft = readSaleDraft(mode);

    if (!draft.updatedAt) {
        screen.dataset.reloadSessionRestored = 'true';
        return;
    }

    await sleep(260);

    if (draft.addingCustomer) {
        const addCustomerButton = Array.from(screen.querySelectorAll('button'))
            .find(button => normalize(button.textContent).includes('novo cadastro'));
        addCustomerButton?.click();
        await sleep(160);
    } else if (draft.customerName) {
        await chooseAutocompleteItem(findInputByPlaceholder(screen, 'nome do cliente'), draft.customerName);
    }

    const cartIsEmpty = normalize(screen.textContent).includes('nenhum produto adicionado');
    if (cartIsEmpty && Array.isArray(draft.cartItems)) {
        for (const item of draft.cartItems) {
            const selected = await chooseAutocompleteItem(findInputByPlaceholder(screen, 'nome ou codigo'), item.productSearch);
            if (!selected) continue;

            setNativeFieldValue(findInputByLabel(screen, 'qtd'), { value: item.quantity, checked: false });
            setNativeFieldValue(findInputByLabel(screen, 'desconto unit'), { value: item.discount, checked: false });
            setNativeFieldValue(findInputByLabel(screen, 'preco unit'), { value: item.price, checked: false });

            const addButton = Array.from(screen.querySelectorAll('button'))
                .find(button => normalize(button.textContent).includes('adicionar no carrinho'));
            addButton?.click();
            await sleep(220);
        }
    }

    if (draft.paymentMethod) {
        Array.from(screen.querySelectorAll('button'))
            .find(button => normalize(button.textContent) === normalize(draft.paymentMethod))
            ?.click();
        await sleep(120);
    }

    (draft.fields || []).forEach(field => setNativeFieldValue(findMatchingField(screen, field), field));
    screen.dataset.reloadSessionRestored = 'true';
};

let restoring = isPageReload;
let unloading = false;
let lastAction = null;
let previousContexts = [];
let runtimeStack = [];

const saveWorkspace = () => {
    writeSession(WORKSPACE_KEY, {
        tab: currentTab(),
        stack: runtimeStack,
        updatedAt: Date.now()
    });
};

const handleContexts = async () => {
    const current = listContexts();
    const currentSignatures = current.map(item => item.signature);

    if (!restoring) {
        if (current.length > previousContexts.length) {
            current.slice(previousContexts.length).forEach(context => {
                runtimeStack.push({ signature: context.signature, kind: context.kind, action: lastAction });
            });
            saveWorkspace();
        } else if (current.length < previousContexts.length && !unloading) {
            const removedIndexes = previousContexts
                .map((context, index) => ({ context, index }))
                .filter(({ context }) => !currentSignatures.includes(context.signature));

            removedIndexes.forEach(({ context, index }) => {
                removeSession(formKey(context, index));
                if (context.kind === 'sale') removeSession(saleKey(context.signature.split(':')[1]));
            });

            runtimeStack = runtimeStack.slice(0, current.length);
            saveWorkspace();
        }
    }

    previousContexts = current;
    current.forEach((context, index) => {
        if (context.kind === 'sale') restoreSaleScreen(context.node);
        else if (context.kind === 'modal') restoreContextForm(context, index);
    });
};

const restoreWorkspace = async () => {
    const workspace = readSession(WORKSPACE_KEY, null);
    if (!isPageReload || !workspace) {
        restoring = false;
        previousContexts = listContexts();
        return;
    }

    lastKnownTab = normalizeTabId(workspace.tab);
    const navButton = await waitFor(() => Array.from(document.querySelectorAll('.app-nav-button, .mobile-nav-button, .mobile-menu-nav-button, .mobile-quick-nav-button'))
        .find(button => identifyTab(button.textContent) === lastKnownTab));
    navButton?.click();
    await sleep(220);

    for (const entry of workspace.stack || []) {
        const action = await waitFor(() => findActionElement(entry.action), 6500, 120);
        if (!action) break;
        action.click();
        await waitFor(() => listContexts().some(context => context.signature === entry.signature), 6500, 120);
        await sleep(180);
    }

    runtimeStack = Array.isArray(workspace.stack) ? [...workspace.stack] : [];
    previousContexts = listContexts();
    restoring = false;
    handleContexts();
};

document.addEventListener('click', event => {
    const navButton = event.target.closest('.app-nav-button, .mobile-nav-button, .mobile-menu-nav-button, .mobile-quick-nav-button');
    if (navButton) {
        lastKnownTab = identifyTab(navButton.textContent) || lastKnownTab;
        setTimeout(saveWorkspace, 20);
    }

    const saleScreen = event.target.closest('.sale-screen');
    const button = event.target.closest('button');
    if (saleScreen && button) {
        const text = normalize(button.textContent);
        const mode = getSaleMode(saleScreen);
        if (['pix', 'dinheiro', 'debito', 'credito'].includes(text)) {
            saveSaleDraft(mode, { paymentMethod: button.textContent.trim() });
        }
        if (text.includes('adicionar no carrinho')) captureCartAddition(saleScreen);

        const cartRow = button.closest('div[class*="bg-yellow-50"], div[class*="bg-emerald-50"]');
        const cartLabel = normalize(cartRow?.querySelector('p.font-bold')?.textContent);
        if (cartLabel && /^\d+x\s+/.test(cartLabel) && !text) {
            const productName = cartLabel.replace(/^\d+x\s+/, '');
            const draft = readSaleDraft(mode);
            const cartItems = Array.isArray(draft.cartItems) ? [...draft.cartItems] : [];
            const itemIndex = cartItems.findIndex(item => normalize(item.productSearch).includes(productName));
            if (itemIndex >= 0) {
                cartItems.splice(itemIndex, 1);
                saveSaleDraft(mode, { cartItems });
            }
        }
    }

    if (!restoring) lastAction = buildActionDescriptor(event.target);
}, true);

document.addEventListener('input', event => {
    const contexts = listContexts();
    const index = contexts.findIndex(context => context.node.contains(event.target));
    if (index < 0) return;
    const context = contexts[index];
    if (context.kind === 'sale') captureSaleState(context.node);
    else if (context.kind === 'modal') saveContextForm(context, index);
}, true);

document.addEventListener('change', event => {
    const contexts = listContexts();
    const index = contexts.findIndex(context => context.node.contains(event.target));
    if (index < 0) return;
    const context = contexts[index];
    if (context.kind === 'sale') captureSaleState(context.node);
    else if (context.kind === 'modal') saveContextForm(context, index);
}, true);

window.addEventListener('beforeunload', () => {
    unloading = true;
    const contexts = listContexts();
    contexts.forEach((context, index) => {
        if (context.kind === 'sale') captureSaleState(context.node);
        else if (context.kind === 'modal') saveContextForm(context, index);
    });
    saveWorkspace();
});

const observer = new MutationObserver(() => {
    clearTimeout(window.__reloadSessionTimer);
    window.__reloadSessionTimer = setTimeout(handleContexts, 70);
});
observer.observe(document.documentElement, { childList: true, subtree: true });

setTimeout(() => {
    previousContexts = listContexts();
    restoreWorkspace();
}, 450);
