const WORKER_URL = 'https://registro-vendas-pix-testes.washington-wn8.workers.dev';
class ProfileClientError extends Error {}

export const createAsaasProfileClient = ({ getIdToken, fetcher = globalThis.fetch, baseUrl = WORKER_URL }) => {
    const request = async (method, suffix = '', body, signal) => {
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
        const timeout = setTimeout(abort, 45000);
        try {
            for (let attempt = 0; attempt < 2; attempt += 1) {
                let idToken;
                try { idToken = await getIdToken(attempt > 0); } catch { throw new ProfileClientError('Entre novamente no sistema para configurar o Asaas.'); }
                if (!idToken) throw new ProfileClientError('Entre novamente no sistema para configurar o Asaas.');
                const response = await fetcher(baseUrl + '/api/integrations/asaas' + suffix, {
                    method, credentials: 'omit', redirect: 'manual', cache: 'no-store', signal: controller.signal,
                    headers: { Authorization: 'Bearer ' + idToken, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
                    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
                });
                if (response.status === 401 && attempt === 0) { await response.body?.cancel(); continue; }
                let data;
                try { data = await response.json(); } catch { throw new ProfileClientError('A conexão com o Asaas está indisponível. Tente novamente.'); }
                if (!response.ok) throw new ProfileClientError(typeof data?.message === 'string' && data.message.length <= 500 ? data.message : 'Não foi possível concluir a configuração do Asaas.');
                if (typeof data?.configured !== 'boolean' || typeof data.enabled !== 'boolean' || data.environment !== 'sandbox') throw new ProfileClientError('Não foi possível conferir a configuração do Asaas.');
                // Somente metadados seguros chegam ao estado da interface.
                return {
                    configured: data.configured, enabled: data.enabled, environment: 'sandbox',
                    hasActivePixKey: data.hasActivePixKey === true,
                    checkedAt: typeof data.checkedAt === 'string' && !Number.isNaN(Date.parse(data.checkedAt)) ? data.checkedAt : null,
                    message: typeof data.message === 'string' ? data.message : '',
                };
            }
            throw new Error('Entre novamente no sistema para configurar o Asaas.');
        } catch (error) {
            if (controller.signal.aborted) throw new Error('A operação foi interrompida ou demorou demais. Confira a conexão e tente novamente.');
            throw error instanceof ProfileClientError ? error : new Error('Não foi possível conectar ao Asaas. Confira sua conexão e tente novamente.');
        } finally {
            clearTimeout(timeout);
            signal?.removeEventListener('abort', abort);
        }
    };
    return {
        getStatus: signal => request('GET', '', undefined, signal),
        save: (settings, signal) => request('PUT', '', { enabled: settings.enabled, ...(settings.apiKey ? { apiKey: settings.apiKey } : {}) }, signal),
        testSavedKey: signal => request('POST', '/test', undefined, signal),
        remove: signal => request('DELETE', '', undefined, signal),
    };
};
