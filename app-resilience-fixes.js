const PREFIX = 'registro-vendas:resilience:v2';
const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const readJson = (key, fallback = null) => {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (_) {
        return fallback;
    }
};

const writeJson = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
};

const setNativeValue = (input, value) => {
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, value || '');
    else input.value = value || '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
};

const chooseCustomer = async (screen, customerName) => {
    const input = Array.from(screen.querySelectorAll('input')).find(item => normalize(item.placeholder).includes('nome do cliente'));
    if (!input || !customerName) return;
    setNativeValue(input, customerName);
    input.focus();
    await sleep(180);
    const candidates = Array.from(document.querySelectorAll('.absolute.z-20 > div, .absolute.z-20 [class*="cursor-pointer"]'));
    const wanted = normalize(customerName);
    const option = candidates.find(item => normalize(item.textContent).includes(wanted));
    if (option) {
        option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        option.click();
    }
};

const reinforceRestoredSale = async screen => {
    if (!screen || screen.dataset.rvFixApplied === 'true' || screen.dataset.rvDraftRestored !== 'true') return;
    screen.dataset.rvFixApplied = 'true';
    const mode = normalize(screen.querySelector('.sale-screen-header h2')?.textContent).includes('prazo') ? 'prazo' : 'direct';
    const draft = readJson(`${PREFIX}:sale:${mode}`, null);
    if (!draft) return;
    await sleep(320);
    if (!draft.addingCustomer && draft.customerName) await chooseCustomer(screen, draft.customerName);
};

const observer = new MutationObserver(() => {
    const screen = document.querySelector('.sale-screen');
    if (screen) reinforceRestoredSale(screen);
});
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-rv-draft-restored'] });

document.addEventListener('click', event => {
    const button = event.target.closest('.sale-screen button');
    if (!button) return;
    const itemRow = button.closest('div[class*="bg-yellow-50"], div[class*="bg-emerald-50"]');
    const itemText = normalize(itemRow?.querySelector('p.font-bold')?.textContent);
    if (!itemText || !/^\d+x\s+/.test(itemText)) return;
    const productName = itemText.replace(/^\d+x\s+/, '');
    const screen = button.closest('.sale-screen');
    const mode = normalize(screen?.querySelector('.sale-screen-header h2')?.textContent).includes('prazo') ? 'prazo' : 'direct';
    const key = `${PREFIX}:sale:${mode}`;
    const draft = readJson(key, null);
    if (!draft?.cartItems) return;
    const index = draft.cartItems.findIndex(item => normalize(item.productSearch).includes(productName));
    if (index >= 0) {
        const cartItems = [...draft.cartItems];
        cartItems.splice(index, 1);
        writeJson(key, { ...draft, cartItems, updatedAt: new Date().toISOString() });
    }
}, true);
