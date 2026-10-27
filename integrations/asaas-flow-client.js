const WORKER = 'https://registro-vendas-pix-testes.washington-wn8.workers.dev';
const ID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/;
const STATES = ['creating', 'pending', 'received', 'cancelled', 'refunded', 'review'];
class FlowClientError extends Error {}

export const createCheckoutTestRequest = (cart, idempotencyKey) => ({
    kind: 'checkout', idempotencyKey,
    items: cart.map(item => ({ productId: item.productId, quantity: item.quantity, lineTotalCents: Math.round((Number(item.price) + Number.EPSILON * Math.max(1, Math.abs(Number(item.price)))) * 100) })),
});

export const createAsaasFlowClient = ({ getIdToken, fetcher = globalThis.fetch, baseUrl = WORKER }) => {
    const request = async (method, suffix, body, signal) => {
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
        const timeout = setTimeout(abort, 65000);
        try {
            for (let attempt = 0; attempt < 2; attempt++) {
                let token;
                try { token = await getIdToken(attempt > 0); } catch { throw new FlowClientError('Entre novamente no sistema para testar o Pix Asaas.'); }
                if (!token) throw new FlowClientError('Entre novamente no sistema para testar o Pix Asaas.');
                const response = await fetcher(baseUrl + '/api/integrations/asaas/flow/charges' + suffix, {
                    method, credentials: 'omit', cache: 'no-store', redirect: 'manual', signal: controller.signal,
                    headers: { Authorization: 'Bearer ' + token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
                    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
                });
                if (response.status === 401 && attempt === 0) { await response.body?.cancel(); continue; }
                if (response.status === 404 && suffix === '') throw new FlowClientError('Atualize o Worker para habilitar os testes do caixa e das parcelas.');
                let data;
                try { data = await response.json(); } catch { throw new FlowClientError('Não foi possível conferir o retorno do teste.'); }
                if (!response.ok) throw new FlowClientError(typeof data?.message === 'string' && data.message.length <= 500 ? data.message : 'Não foi possível concluir a operação de teste.');
                if (data?.environment !== 'sandbox' || data.simulationOnly !== true) throw new FlowClientError('O teste não retornou um ambiente Sandbox válido.');
                const summary = item => {
                    if (!ID.test(item?.id || '') || !['checkout', 'installment'].includes(item.kind) || !Number.isSafeInteger(item.amountCents) || item.amountCents < 500 || item.amountCents > 5000000) throw new FlowClientError('O retorno da cobrança de teste está incompleto.');
                    return { id: item.id, kind: item.kind, amountCents: item.amountCents };
                };
                if (Array.isArray(data.orders)) return { orders: data.orders.slice(0, 5).map(summary) };
                if (!STATES.includes(data.state) || typeof data.ready !== 'boolean') throw new FlowClientError('O andamento da cobrança de teste está incompleto.');
                const safe = summary(data);
                if (data.state === 'received' && (data.providerStatus !== 'RECEIVED' || data.summary?.receivedCents !== safe.amountCents || !['webhook', 'reconciliation'].includes(data.confirmationSource))) throw new FlowClientError('O recebimento de teste ainda não foi conferido pelo servidor.');
                return {
                    ...safe, environment: 'sandbox', simulationOnly: true, state: data.state, ready: data.ready,
                    providerStatus: typeof data.providerStatus === 'string' ? data.providerStatus : '',
                    payload: typeof data.payload === 'string' && data.payload.length <= 8192 ? data.payload : '',
                    encodedImage: typeof data.encodedImage === 'string' && data.encodedImage.length <= 200000 && /^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(data.encodedImage) ? data.encodedImage : '',
                    confirmationSource: ['webhook', 'reconciliation'].includes(data.confirmationSource) ? data.confirmationSource : '',
                    summary: {
                        receivedCents: Number.isSafeInteger(data.summary?.receivedCents) ? data.summary.receivedCents : 0,
                        remainingCents: Number.isSafeInteger(data.summary?.remainingCents) ? data.summary.remainingCents : 0,
                        stockUnits: Number.isSafeInteger(data.summary?.stockUnits) ? data.summary.stockUnits : 0,
                        installmentPaid: data.summary?.installmentPaid === true,
                    },
                    message: typeof data.message === 'string' && data.message.length <= 500 ? data.message : '',
                };
            }
            throw new FlowClientError('Entre novamente no sistema para testar o Pix Asaas.');
        } catch (error) {
            if (controller.signal.aborted) throw new Error('A operação foi interrompida ou demorou demais. Confira o teste em Meu Perfil → Testes pendentes antes de repetir.');
            throw error instanceof FlowClientError ? error : new Error('Não foi possível conectar. Confira o teste em Meu Perfil → Testes pendentes antes de repetir.');
        } finally {
            clearTimeout(timeout);
            signal?.removeEventListener('abort', abort);
        }
    };
    const resource = id => { if (!ID.test(id || '')) throw new FlowClientError('A identificação do teste é inválida.'); return '/' + id; };
    return {
        create: (body, signal) => request('POST', '', body, signal),
        list: signal => request('GET', '', undefined, signal),
        get: (id, signal) => request('GET', resource(id), undefined, signal),
        prepare: (id, signal) => request('POST', resource(id) + '/prepare', undefined, signal),
        simulate: (id, signal) => request('POST', resource(id) + '/simulate', undefined, signal),
        reconcile: (id, signal) => request('POST', resource(id) + '/reconcile', undefined, signal),
        cancel: (id, signal) => request('POST', resource(id) + '/cancel', undefined, signal),
    };
};
