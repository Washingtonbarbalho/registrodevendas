const TAB_KEY = 'registro-vendas:last-tab:v1';

const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const identifyTab = text => {
    const label = normalize(text);
    if (label === 'visao geral' || label === 'inicio') return 'dashboard';
    if (label === 'vendas a prazo' || label === 'a prazo') return 'sales';
    if (label === 'vendas no caixa' || label === 'caixa') return 'cashier';
    if (label === 'produtos') return 'products';
    if (label === 'clientes') return 'customers';
    return null;
};

const clearOldFormDrafts = () => {
    try {
        const removablePrefixes = [
            'registro-vendas:resilience:',
            'registro-vendas:draft:',
            'registro-vendas:workspace'
        ];

        Object.keys(localStorage).forEach(key => {
            if (removablePrefixes.some(prefix => key.startsWith(prefix))) {
                localStorage.removeItem(key);
            }
        });
    } catch (error) {
        console.warn('Não foi possível limpar rascunhos antigos:', error);
    }
};

const saveTab = button => {
    const tab = identifyTab(button?.textContent);
    if (!tab) return;
    try {
        localStorage.setItem(TAB_KEY, tab);
    } catch (error) {
        console.warn('Não foi possível salvar a aba atual:', error);
    }
};

const restoreTab = () => {
    let savedTab = null;
    try {
        savedTab = localStorage.getItem(TAB_KEY);
    } catch (_) {}

    if (!savedTab || savedTab === 'dashboard') return true;

    const buttons = Array.from(document.querySelectorAll('.app-nav-button, .mobile-nav-button'));
    const target = buttons.find(button => identifyTab(button.textContent) === savedTab);
    if (!target) return false;

    target.click();
    return true;
};

clearOldFormDrafts();

document.addEventListener('click', event => {
    const button = event.target.closest('.app-nav-button, .mobile-nav-button');
    if (button) saveTab(button);
}, true);

let attempts = 0;
const restoreTimer = setInterval(() => {
    attempts += 1;
    const finished = restoreTab();
    if (finished || attempts >= 80) clearInterval(restoreTimer);
}, 100);
