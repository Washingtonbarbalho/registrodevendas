const canUseStorage = () => typeof window !== 'undefined' && !!window.localStorage;

export const loadDraft = (key, fallback = null) => {
    if (!key || !canUseStorage()) return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed?.value ?? fallback;
    } catch (error) {
        console.warn('Não foi possível recuperar o rascunho:', key, error);
        return fallback;
    }
};

export const saveDraft = (key, value) => {
    if (!key || !canUseStorage()) return;
    try {
        window.localStorage.setItem(key, JSON.stringify({
            updatedAt: new Date().toISOString(),
            value
        }));
    } catch (error) {
        console.warn('Não foi possível salvar o rascunho:', key, error);
    }
};

export const clearDraft = (key) => {
    if (!key || !canUseStorage()) return;
    try {
        window.localStorage.removeItem(key);
    } catch (error) {
        console.warn('Não foi possível apagar o rascunho:', key, error);
    }
};
