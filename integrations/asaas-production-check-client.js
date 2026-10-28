const WORKER_URL = 'https://registro-vendas-pix-testes.washington-wn8.workers.dev';
class ProductionCheckError extends Error {}
export const createAsaasProductionCheckClient = ({ getIdToken, fetcher = globalThis.fetch, baseUrl = WORKER_URL }) => {
    const call = async (method, suffix, payer, signal) => {
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
        const timer = setTimeout(abort, 65000);
        try {
            for (let attempt = 0; attempt < 2; attempt++) {
                let token;
                try { token = await getIdToken(attempt > 0); } catch { throw new ProductionCheckError('Entre novamente no sistema para conferir o teste real.'); }
                if (!token) throw new ProductionCheckError('Entre novamente no sistema para conferir o teste real.');
                const response = await fetcher(baseUrl + '/api/integrations/asaas-production/receipt-check' + suffix, {
                    method, credentials: 'omit', redirect: 'manual', cache: 'no-store', signal: controller.signal,
                    headers: { Authorization: 'Bearer ' + token, ...(payer ? { 'Content-Type': 'application/json' } : {}) },
                    ...(payer ? { body: JSON.stringify({ payerName: payer.payerName, payerCpf: payer.payerCpf }) } : {})
                });
                if (response.status === 401 && attempt === 0) { await response.body?.cancel(); continue; }
                if (response.status === 404) throw new ProductionCheckError('Atualize o Worker para liberar o teste de recebimento na conta real.');
                let data;
                try { data = await response.json(); } catch { throw new ProductionCheckError('Não foi possível conferir o andamento. Reabra o perfil antes de repetir o teste real.'); }
                if (!response.ok) throw new ProductionCheckError(typeof data?.message === 'string' && data.message.length <= 500 ? data.message : 'Não foi possível concluir o teste real.');
                if (data?.environment !== 'production' || data.diagnosticOnly !== true || data.amountCents !== 500 || !['started', 'created', 'ready', 'testComplete', 'webhookVerified'].every(key => typeof data[key] === 'boolean') || !/^[A-Z_]{3,64}$/.test(data.status || '') || data.testComplete !== data.webhookVerified || data.netCents !== null && (!Number.isSafeInteger(data.netCents) || data.netCents < 0 || data.netCents > 500) || !Number.isSafeInteger(data.refundedCents) || data.refundedCents < 0 || data.refundedCents > 500 || data.testComplete && (!data.created || !data.ready || data.netCents === null)) throw new ProductionCheckError('O retorno não corresponde ao teste real de R$ 5,00.');
                return {
                    environment: 'production', diagnosticOnly: true, amountCents: 500,
                    started: data.started, created: data.created, ready: data.ready, status: data.status,
                    testComplete: data.testComplete, webhookVerified: data.webhookVerified, netCents: data.netCents, refundedCents: data.refundedCents,
                    payload: typeof data.payload === 'string' && data.payload.length <= 8192 ? data.payload : '',
                    encodedImage: typeof data.encodedImage === 'string' && data.encodedImage.length <= 200000 && /^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(data.encodedImage) ? data.encodedImage : '',
                    message: typeof data.message === 'string' && data.message.length <= 500 ? data.message : ''
                };
            }
            throw new ProductionCheckError('Entre novamente no sistema para conferir o teste real.');
        } catch (error) {
            if (controller.signal.aborted) throw new ProductionCheckError('A consulta foi interrompida ou demorou demais. Confira o teste no perfil antes de gerar outra cobrança.');
            throw error instanceof ProductionCheckError ? error : new ProductionCheckError('Não foi possível conectar. Confira o teste no perfil antes de repetir.');
        } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    };
    return {
        get: signal => call('GET', '', undefined, signal),
        prepare: (payer, signal) => call('POST', '', payer, signal),
        reconcile: signal => call('POST', '/reconcile', undefined, signal),
        cancel: signal => call('POST', '/cancel', undefined, signal)
    };
};
