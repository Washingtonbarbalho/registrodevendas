import React, { useEffect, useRef, useState } from 'https://esm.sh/react@18.2.0';
import { auth } from '../firebase-config.js?v=105';
import { formatCurrency } from '../utils.js?v=105';
import { createAsaasProfileClient } from './asaas-profile-client.js?v=105';
import { createAsaasFlowClient, createCheckoutTestRequest } from './asaas-flow-client.js?v=105';

const getIdToken = force => auth.currentUser?.getIdToken(force);
const profile = createAsaasProfileClient({ getIdToken });
const client = createAsaasFlowClient({ getIdToken });
const activeState = state => ['creating', 'pending'].includes(state);
const h = React.createElement;

const useAvailability = callback => {
    const [available, setAvailable] = useState(false);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        profile.getStatus(controller.signal).then(data => {
            if (!active) return;
            const ready = data.enabled && data.configured && data.flowVersion === 1;
            setAvailable(ready);
            callback?.(ready);
        }).catch(() => { if (active) { setAvailable(false); callback?.(false); } }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; controller.abort(); };
    }, []);
    return { available, loading };
};

export const AsaasCheckoutOption = ({ selected, onChange, onAvailability }) => {
    const { available, loading } = useAvailability(onAvailability);
    return h('div', { className: 'p-3 border border-amber-200 rounded-xl bg-amber-50 space-y-2' },
        h('label', { className: 'flex items-start gap-2 text-sm font-bold text-amber-900' },
            h('input', { type: 'checkbox', checked: selected, disabled: loading || !available && !selected, onChange: event => onChange(event.target.checked), className: 'mt-1' }),
            'Testar Pix automático do Asaas (Sandbox)'
        ),
        h('p', { className: 'text-xs text-amber-900' }, selected ? 'Esta compra será testada em uma cópia separada. Nenhuma venda, recebimento ou baixa de estoque real será registrada. Não pague pelo banco.' : 'Marque para testar o carrinho com a conta Asaas Sandbox conectada no perfil.'),
        !available && !loading && h('a', { href: './integrations/atualizar-worker.html?v=105', target: '_blank', rel: 'noopener noreferrer', className: 'text-xs underline text-amber-900' }, 'Conecte o Asaas e atualize o Worker para liberar o teste.')
    );
};

export const AsaasInstallmentButton = ({ onStart }) => {
    const { available, loading } = useAvailability();
    if (loading || !available) return null;
    return h('div', { className: 'mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl' },
        h('button', { type: 'button', onClick: onStart, className: 'w-full p-3 bg-amber-100 text-amber-900 rounded-lg text-sm font-bold' }, 'Testar Pix Asaas da parcela inteira'),
        h('p', { className: 'text-xs text-amber-900 mt-2' }, 'Usa o saldo atual da parcela em uma cópia de teste. A parcela original continua com o mesmo saldo.')
    );
};

export const AsaasFlowModal = ({ startRequest, orderId, onClose, onChanged }) => {
    const [data, setData] = useState(null);
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState('');
    const [watchUntil, setWatchUntil] = useState(0);
    const pending = useRef(null);
    const mounted = useRef(false);
    const run = async (operation, watch = true) => {
        if (pending.current) return;
        const controller = new AbortController();
        pending.current = controller;
        setBusy(true);
        setError('');
        try {
            const next = await operation(controller.signal);
            if (!mounted.current) return;
            setData(next);
            onChanged?.(next);
            if (!activeState(next.state)) setWatchUntil(0);
            else if (watch) setWatchUntil(Date.now() + 120000);
        } catch (failure) { if (mounted.current) { setError(failure.message); setWatchUntil(0); } }
        finally { if (pending.current === controller) pending.current = null; if (mounted.current) setBusy(false); }
    };
    useEffect(() => {
        mounted.current = true;
        run(signal => orderId ? client.get(orderId, signal) : client.create(startRequest, signal));
        return () => { mounted.current = false; pending.current?.abort(); };
    }, []);
    useEffect(() => {
        if (!data?.id || !watchUntil || watchUntil <= Date.now() || busy || !activeState(data.state)) return;
        const timer = setTimeout(() => {
            if (document.visibilityState === 'hidden') setWatchUntil(0);
            else run(signal => client.get(data.id, signal), false);
        }, Math.min(8000, Math.max(0, watchUntil - Date.now())));
        return () => clearTimeout(timer);
    }, [data?.id, data?.state, busy, watchUntil]);
    const retry = () => run(signal => data?.id ? data.ready ? client.get(data.id, signal) : client.prepare(data.id, signal) : orderId ? client.get(orderId, signal) : client.create(startRequest, signal));
    const canSimulate = data?.ready && activeState(data.state) && ['PENDING', 'OVERDUE'].includes(data.providerStatus);
    return h('div', { className: 'app-modal-overlay fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Pix Asaas Sandbox' },
        h('div', { className: 'app-modal-panel bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4' },
            h('div', { className: 'flex items-center justify-between gap-3' },
                h('h2', { className: 'font-bold text-lg text-slate-900' }, data?.kind === 'installment' || startRequest?.kind === 'installment' ? 'Pix de teste da parcela' : 'Pix de teste do caixa'),
                h('button', { type: 'button', onClick: () => onClose(data), 'aria-label': 'Fechar teste Pix', className: 'p-2 text-slate-600 font-bold' }, 'Fechar')
            ),
            h('p', { className: 'p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900' }, 'Somente Sandbox. Use a simulação; não pague pelo banco. A confirmação fica em uma cópia e não movimenta o caixa, as parcelas ou o estoque reais.'),
            data && h('p', { className: 'text-2xl font-black text-center text-emerald-900' }, formatCurrency(data.amountCents / 100)),
            data?.state === 'received' && h('div', { className: 'p-3 rounded-xl border border-emerald-200 bg-emerald-50 space-y-2', role: 'status' },
                h('p', { className: 'font-bold text-emerald-900' }, data.confirmationSource === 'webhook' ? 'Confirmação automática validada.' : 'Recebimento conferido na API do Asaas.'),
                data.kind === 'checkout'
                    ? h('p', { className: 'text-xs text-emerald-900' }, 'A cópia da venda foi concluída e a baixa simulada foi de ' + data.summary.stockUnits + ' unidade(s).')
                    : h('p', { className: 'text-xs text-emerald-900' }, 'A cópia da parcela foi paga. Saldo restante do contrato de teste: ' + formatCurrency(data.summary.remainingCents / 100) + '.')
            ),
            canSimulate && data.encodedImage && h('img', { src: 'data:image/png;base64,' + data.encodedImage, alt: 'QR Code Pix de teste Asaas', width: 192, height: 192, className: 'mx-auto w-48 h-48' }),
            canSimulate && data.payload && h('div', null,
                h('label', { className: 'block text-xs font-bold text-slate-600', htmlFor: 'asaas-flow-payload' }, 'Pix copia e cola de teste'),
                h('textarea', { id: 'asaas-flow-payload', rows: 3, readOnly: true, value: data.payload, onFocus: event => event.target.select(), className: 'w-full p-2 border border-slate-200 rounded-lg text-xs break-all' })
            ),
            data && h('p', { className: 'text-sm text-slate-700', role: 'status', 'aria-live': 'polite' }, data.message),
            error && h('p', { className: 'text-sm text-red-700', role: 'alert' }, error),
            busy && h('p', { className: 'text-sm text-slate-500', role: 'status' }, 'Consultando o teste…'),
            h('div', { className: 'flex flex-wrap gap-2' },
                canSimulate && h('button', { type: 'button', disabled: busy, onClick: () => run(signal => client.simulate(data.id, signal)), className: 'p-3 rounded-lg bg-emerald-700 text-white text-sm font-bold disabled:opacity-50' }, 'Simular pagamento no Sandbox'),
                (!data || activeState(data.state)) && h('button', { type: 'button', disabled: busy, onClick: retry, className: 'p-3 rounded-lg border border-slate-200 text-slate-700 text-sm font-bold disabled:opacity-50' }, !data?.ready ? 'Retomar preparação' : 'Verificar retorno'),
                data?.ready && ['pending', 'received'].includes(data.state) && h('button', { type: 'button', disabled: busy, onClick: () => run(signal => client.reconcile(data.id, signal)), className: 'p-3 rounded-lg border border-emerald-200 text-emerald-900 text-sm font-bold disabled:opacity-50' }, 'Conferir no Asaas'),
                data && activeState(data.state) && h('button', { type: 'button', disabled: busy, onClick: () => run(signal => client.cancel(data.id, signal)), className: 'p-3 rounded-lg border border-red-200 text-red-700 text-sm font-bold disabled:opacity-50' }, 'Cancelar cobrança de teste')
            ),
            h('p', { className: 'text-xs text-slate-500' }, 'Pode fechar esta janela. Retome cobranças em Meu Perfil → Testes pendentes.')
        )
    );
};

export const AsaasPendingCharges = () => {
    const [orders, setOrders] = useState([]);
    const [selected, setSelected] = useState('');
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        client.list(controller.signal).then(data => { if (active) { setOrders(data.orders); setError(''); } }).catch(failure => { if (active) setError(failure.message); });
        return () => { active = false; controller.abort(); };
    }, [reload]);
    return h('section', { className: 'space-y-2 p-3 bg-white border border-amber-200 rounded-lg', 'aria-label': 'Testes pendentes do Asaas' },
        h('p', { className: 'text-sm font-bold text-slate-800' }, 'Testes pendentes'),
        orders.length === 0 && !error && h('p', { className: 'text-xs text-slate-500' }, 'Nenhum teste do caixa ou de parcela pendente.'),
        orders.map(item => h('button', { key: item.id, type: 'button', onClick: () => setSelected(item.id), className: 'block w-full p-3 text-left text-sm border border-slate-200 rounded-lg' }, (item.kind === 'checkout' ? 'Caixa' : 'Parcela') + ' · ' + formatCurrency(item.amountCents / 100) + ' · Retomar')),
        error && h('p', { className: 'text-xs text-red-700', role: 'alert' }, error),
        h('button', { type: 'button', onClick: () => setReload(previous => previous + 1), className: 'text-xs underline text-slate-600' }, 'Atualizar testes pendentes'),
        selected && h(AsaasFlowModal, { orderId: selected, onClose: () => { setSelected(''); setReload(previous => previous + 1); } })
    );
};

export const asaasCheckout = { Option: AsaasCheckoutOption, Modal: AsaasFlowModal, createRequest: createCheckoutTestRequest };
