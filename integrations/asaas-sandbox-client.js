const WORKER_URL = 'https://registro-vendas-pix-testes.washington-wn8.workers.dev';
class SandboxClientError extends Error {}

export const createAsaasSandboxClient = ({ getIdToken, fetcher = globalThis.fetch, baseUrl = WORKER_URL }) => {
    const request = async (method, suffix = '', signal) => {
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
        const timeout = setTimeout(abort, 65000);
        try {
            for (let attempt = 0; attempt < 2; attempt += 1) {
                let token;
                try { token = await getIdToken(attempt > 0); } catch { throw new SandboxClientError('Entre novamente no sistema para testar o Asaas.'); }
                if (!token) throw new SandboxClientError('Entre novamente no sistema para testar o Asaas.');
                const response = await fetcher(baseUrl + '/api/integrations/asaas/sandbox-charge' + suffix, {
                    method, headers: { Authorization: 'Bearer ' + token }, credentials: 'omit', redirect: 'manual', cache: 'no-store', signal: controller.signal,
                });
                if (response.status === 401 && attempt === 0) { await response.body?.cancel(); continue; }
                if (response.status === 404) throw new SandboxClientError('Atualize o código do Worker para liberar o teste de cobrança. Use o link de atualização abaixo.');
                let data;
                try { data = await response.json(); } catch { throw new SandboxClientError('Não foi possível consultar o teste. Confira a conexão e tente novamente.'); }
                if (!response.ok) throw new SandboxClientError(typeof data?.message === 'string' && data.message.length <= 500 ? data.message : 'Não foi possível concluir o teste do Asaas.');
                if (data?.environment !== 'sandbox' || typeof data.created !== 'boolean' || typeof data.ready !== 'boolean' || typeof data.webhookVerified !== 'boolean' || typeof data.status !== 'string' || !/^[A-Z_]{3,64}$/.test(data.status) || data.amount !== 5) throw new SandboxClientError('O retorno do teste está em um formato inesperado.');
                const received = data.status === 'RECEIVED';
                return {
                    environment: 'sandbox', created: data.created, ready: data.ready, status: data.status, amount: 5,
                    received, webhookVerified: data.webhookVerified, testComplete: data.ready && received && data.webhookVerified,
                    payload: typeof data.payload === 'string' && data.payload.length <= 8192 ? data.payload : '',
                    encodedImage: typeof data.encodedImage === 'string' && data.encodedImage.length <= 200000 && /^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(data.encodedImage) ? data.encodedImage : '',
                    message: typeof data.message === 'string' && data.message.length <= 500 ? data.message : '',
                };
            }
            throw new SandboxClientError('Entre novamente no sistema para testar o Asaas.');
        } catch (error) {
            if (controller.signal.aborted) throw new Error('O teste foi interrompido ou demorou demais. Reabra o perfil para conferir o andamento antes de repetir.');
            throw error instanceof SandboxClientError ? error : new Error('Não foi possível conectar ao teste. Reabra o perfil para conferir o andamento antes de repetir.');
        } finally {
            clearTimeout(timeout);
            signal?.removeEventListener('abort', abort);
        }
    };
    return {
        getStatus: signal => request('GET', '', signal),
        prepare: signal => request('POST', '', signal),
        simulate: signal => request('POST', '/simulate', signal),
    };
};
