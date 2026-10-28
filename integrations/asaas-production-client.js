const WORKER_URL = 'https://registro-vendas-pix-testes.washington-wn8.workers.dev';
class ProductionClientError extends Error {}

export const createAsaasProductionClient = ({ getIdToken, fetcher = globalThis.fetch, baseUrl = WORKER_URL }) => {
    const request = async (method, suffix = '', apiKey, signal) => {
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
        const timer = setTimeout(abort, 45000);
        try {
            for (let attempt = 0; attempt < 2; attempt += 1) {
                let token;
                try { token = await getIdToken(attempt > 0); } catch { throw new ProductionClientError('Entre novamente no sistema para conectar a conta real.'); }
                if (!token) throw new ProductionClientError('Entre novamente no sistema para conectar a conta real.');
                const response = await fetcher(baseUrl + '/api/integrations/asaas-production' + suffix, {
                    method, signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'manual',
                    headers: { Authorization: 'Bearer ' + token, ...(apiKey === undefined ? {} : { 'Content-Type': 'application/json' }) },
                    ...(apiKey === undefined ? {} : { body: JSON.stringify({ apiKey }) })
                });
                if (response.status === 401 && attempt === 0) { await response.body?.cancel(); continue; }
                if (response.status === 404) throw new ProductionClientError('Atualize o Worker para conectar a conta real do Asaas.');
                let data;
                try { data = await response.json(); } catch { throw new ProductionClientError('Não foi possível conferir a consulta da conta real.'); }
                if (!response.ok) throw new ProductionClientError(typeof data?.message === 'string' && data.message.length <= 500 ? data.message : 'Não foi possível conectar a conta real do Asaas.');
                if (typeof data?.configured !== 'boolean' || data.environment !== 'production' || data.connectionVersion !== 1 || data.receivingEnabled !== false) throw new ProductionClientError('A resposta da conexão real não corresponde a esta etapa. Atualize o sistema e confira o perfil.');
                return {
                    configured: data.configured, environment: 'production', connectionVersion: 1, receivingEnabled: false,
                    hasActivePixKey: data.hasActivePixKey === true,
                    checkedAt: typeof data.checkedAt === 'string' && !Number.isNaN(Date.parse(data.checkedAt)) ? data.checkedAt : null,
                    message: typeof data.message === 'string' && data.message.length <= 500 ? data.message : ''
                };
            }
            throw new ProductionClientError('Entre novamente no sistema para conectar a conta real.');
        } catch (error) {
            if (controller.signal.aborted) throw new ProductionClientError('A consulta foi interrompida ou demorou demais. Reabra o perfil para conferir a conexão real.');
            throw error instanceof ProductionClientError ? error : new ProductionClientError('Não foi possível conectar a conta real. Confira a conexão e tente novamente.');
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
        }
    };
    return {
        getStatus: signal => request('GET', '', undefined, signal),
        save: (apiKey, signal) => request('PUT', '', typeof apiKey === 'string' ? apiKey.trim() : '', signal),
        testSavedKey: signal => request('POST', '/test', undefined, signal),
        remove: signal => request('DELETE', '', undefined, signal)
    };
};
