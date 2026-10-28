import React, { useEffect, useRef, useState } from 'https://esm.sh/react@18.2.0';
import { auth } from '../firebase-config.js?v=105';
import { showAppConfirm } from '../ui-interactions-v81.js?v=105';
import { createAsaasProductionClient } from './asaas-production-client.js?v=105';
import { AsaasProductionCheck } from './asaas-production-check.js?v=105';

const h = React.createElement;
const client = createAsaasProductionClient({ getIdToken: force => auth.currentUser?.getIdToken(force) });

export const AsaasProductionSettings = () => {
    const [status, setStatus] = useState(null);
    const [apiKey, setApiKey] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);
    const mounted = useRef(false);
    const pending = useRef(null);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; pending.current?.abort(); };
    }, []);
    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        setLoading(true);
        setError('');
        client.getStatus(controller.signal).then(next => { if (active) setStatus(next); })
            .catch(failure => { if (active) { setStatus(null); setError(failure.message); } })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; controller.abort(); };
    }, [reload]);
    const run = async operation => {
        if (loading || busy || !status || pending.current) return;
        const controller = new AbortController();
        pending.current = controller;
        setBusy(true);
        setError('');
        setMessage('');
        try {
            const next = await operation(controller.signal);
            if (mounted.current) { setStatus(next); setMessage(next.message || 'Conexão real conferida.'); }
        } catch (failure) { if (mounted.current) setError(failure.message || 'Não foi possível conferir a conta real.'); }
        finally { if (mounted.current) setBusy(false); if (pending.current === controller) pending.current = null; }
    };
    const connect = () => {
        const value = apiKey.trim();
        if (!value) { setError('Cole a chave da API da sua conta de Produção.'); return; }
        setApiKey('');
        run(signal => client.save(value, signal));
    };
    const remove = async () => {
        if (busy || loading || !status?.configured) return;
        if (await showAppConfirm('Remover a chave real salva? A conexão Sandbox continuará disponível.', { title: 'Remover conexão real', confirmText: 'Remover chave real', tone: 'danger' })) {
            if (mounted.current) run(signal => client.remove(signal));
        }
    };
    const disabled = loading || busy || !status;
    return h('section', { className: 'space-y-3 p-4 rounded-xl border border-sky-200 bg-sky-50', 'aria-label': 'Conta real do Asaas' },
        h('h3', { className: 'text-sm font-bold text-sky-900' }, 'Conta real do Asaas (Produção)'),
        h('p', { className: 'text-xs text-sky-900' }, 'Conecte a conta real para a próxima etapa. Este botão apenas consulta o Asaas e salva a chave protegida.'),
        h('p', { className: 'text-xs text-slate-700 bg-white rounded-lg p-3' }, 'Recebimentos reais aguardando ativação. A conexão, por si só, não cria cobranças nem altera vendas, parcelas ou estoque.'),
        loading && h('p', { className: 'text-xs text-slate-500', role: 'status' }, 'Conferindo a conexão real…'),
        status?.configured && h('p', { className: 'text-xs font-bold text-emerald-800' }, 'Chave de Produção salva e protegida.'),
        status?.configured && !status.hasActivePixKey && h('p', { className: 'text-xs text-amber-900' }, 'Cadastre ou ative uma chave Pix na conta real do Asaas antes da ativação dos recebimentos.'),
        h('label', { className: 'block text-xs font-bold text-slate-700', htmlFor: 'asaas-production-key' }, 'Chave da API do Asaas — Produção'),
        h('input', { id: 'asaas-production-key', type: 'password', autoComplete: 'new-password', autoCapitalize: 'off', spellCheck: false, maxLength: 2048, disabled, value: apiKey, onChange: event => setApiKey(event.target.value), placeholder: status?.configured ? 'Preencha somente para substituir a chave real' : 'Cole a chave de Produção', className: 'w-full p-3 border border-sky-200 rounded-lg bg-white' }),
        h('div', { className: 'flex flex-wrap gap-2' },
            h('button', { type: 'button', disabled: disabled || !apiKey.trim(), onClick: connect, className: 'p-3 bg-sky-800 text-white font-bold rounded-lg text-xs disabled:opacity-50' }, busy ? 'Aguarde…' : 'Conectar conta de produção'),
            status?.configured && h('button', { type: 'button', disabled, onClick: () => run(signal => client.testSavedKey(signal)), className: 'p-3 bg-white border border-sky-200 text-sky-900 font-bold rounded-lg text-xs disabled:opacity-50' }, 'Conferir chave real salva'),
            status?.configured && h('button', { type: 'button', disabled, onClick: remove, className: 'p-3 text-red-700 font-bold rounded-lg text-xs disabled:opacity-50' }, 'Remover chave real'),
            error && h('button', { type: 'button', disabled: busy || loading, onClick: () => setReload(value => value + 1), className: 'p-3 bg-white border border-slate-200 font-bold rounded-lg text-xs disabled:opacity-50' }, 'Conferir novamente')
        ),
        error && h('p', { className: 'text-xs text-red-700 p-3 bg-red-50 rounded-lg', role: 'alert' }, error),
        error && h('a', { href: './integrations/atualizar-worker.html?v=105-tres-partes', target: '_blank', rel: 'noopener noreferrer', className: 'inline-block text-xs underline text-sky-900' }, 'Abrir atualização do Worker'),
        message && h('p', { className: 'text-xs text-emerald-900 bg-white p-3 rounded-lg', role: 'status', 'aria-live': 'polite' }, message),
        status?.configured && status.hasActivePixKey && !busy && h(AsaasProductionCheck)
    );
};
