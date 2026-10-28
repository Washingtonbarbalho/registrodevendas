import React, { useEffect, useRef, useState } from 'https://esm.sh/react@18.2.0';
import { auth } from '../firebase-config.js?v=104';
import { showAppConfirm } from '../ui-interactions-v81.js?v=104';
import { createAsaasProfileClient } from './asaas-profile-client.js?v=104';
import { AsaasSandboxCheck } from './asaas-sandbox-check.js?v=104';
import { AsaasPendingCharges } from './asaas-flow-ui.js?v=104';
import { AsaasProductionSettings } from './asaas-production-settings.js?v=104';

const client = createAsaasProfileClient({
    getIdToken: async forceRefresh => {
        if (!auth.currentUser) throw new Error('Entre novamente no sistema para configurar o Asaas.');
        return auth.currentUser.getIdToken(forceRefresh);
    },
});

export const AsaasProfileSettings = () => {
    const [status, setStatus] = useState(null);
    const [mode, setMode] = useState('manual');
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
        const controller = new AbortController();
        let active = true;
        setLoading(true);
        setError('');
        client.getStatus(controller.signal).then(next => {
            if (!active) return;
            setStatus(next);
            setMode(next.enabled ? 'asaas' : 'manual');
        }).catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; controller.abort(); };
    }, [reload]);
    const run = async operation => {
        if (busy || loading || !status || pending.current) return;
        const controller = new AbortController();
        pending.current = controller;
        setBusy(true);
        setError('');
        setMessage('');
        try {
            const next = await operation(controller.signal);
            if (!mounted.current) return;
            setStatus(next);
            setMode(next.enabled ? 'asaas' : 'manual');
            setApiKey('');
            setMessage(next.message || 'Configuração atualizada.');
        } catch (failure) {
            if (mounted.current) setError(failure.message || 'Não foi possível concluir a operação.');
        } finally {
            if (mounted.current) setBusy(false);
            if (pending.current === controller) pending.current = null;
        }
    };
    const save = () => {
        if (mode === 'asaas' && !status?.configured && !apiKey.trim()) return setError('Informe a chave da API do Asaas Sandbox.');
        run(signal => client.save({ enabled: mode === 'asaas', ...(mode === 'asaas' && apiKey.trim() ? { apiKey: apiKey.trim() } : {}) }, signal));
    };
    const remove = async () => {
        if (busy || !status?.configured) return;
        if (await showAppConfirm('Remover a chave salva da integração Asaas? Você poderá cadastrar outra depois.', { title: 'Remover integração', confirmText: 'Remover chave', tone: 'danger' })) {
            if (mounted.current) run(signal => client.remove(signal));
        }
    };
    const disabled = loading || busy || !status;
    return React.createElement('section', { className: 'space-y-3 pt-4 border-t border-emerald-200', 'aria-label': 'Integração com Asaas' },
        React.createElement('p', { className: 'text-xs font-bold text-emerald-700 uppercase' }, 'Recebimento Pix'),
        React.createElement('label', { className: 'block text-xs font-bold text-slate-600', htmlFor: 'asaas-profile-mode' }, 'Forma de recebimento'),
        React.createElement('select', { id: 'asaas-profile-mode', className: 'w-full p-3 border border-slate-200 rounded-lg bg-white', value: mode, disabled, onChange: event => { setMode(event.target.value); setApiKey(''); setMessage(''); setError(''); } },
            React.createElement('option', { value: 'manual' }, 'Pix manual'),
            React.createElement('option', { value: 'asaas' }, 'Asaas — ambiente de testes')
        ),
        loading && React.createElement('p', { className: 'text-xs text-slate-500', role: 'status' }, 'Carregando a conexão…'),
        status?.configured && React.createElement('p', { className: 'text-xs text-emerald-800' }, status.enabled ? 'Chave Asaas salva e protegida.' : 'Pix manual em uso. Há uma chave Asaas protegida para os testes.'),
        status?.configured && !status.hasActivePixKey && React.createElement('p', { className: 'text-xs text-amber-800' }, 'Falta cadastrar ou ativar uma chave Pix na sua conta Asaas Sandbox.'),
        mode === 'asaas' && React.createElement(React.Fragment, null,
            React.createElement('label', { className: 'block text-xs font-bold text-slate-600', htmlFor: 'asaas-profile-key' }, 'Chave da API do Asaas Sandbox'),
            React.createElement('input', { id: 'asaas-profile-key', type: 'password', autoComplete: 'new-password', autoCapitalize: 'off', spellCheck: false, maxLength: 2048, className: 'w-full p-3 border border-slate-200 rounded-lg bg-white', value: apiKey, disabled, onChange: event => setApiKey(event.target.value), placeholder: status?.configured ? 'Preencha somente para substituir a chave' : 'Cole a chave da API do Sandbox' }),
            React.createElement('p', { className: 'text-xs text-slate-600' }, 'A chave salva não será exibida novamente. Cada usuário conecta sua própria conta Asaas.'),
            React.createElement('p', { className: 'text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3' }, 'Ambiente Sandbox: esta conexão ainda não recebe Pix reais. Valide a cobrança de teste abaixo antes de conectar o recebimento às vendas.')
        ),
        React.createElement('div', { className: 'flex flex-wrap gap-2' },
            React.createElement('button', { type: 'button', onClick: save, disabled, className: 'p-3 bg-emerald-700 text-white font-bold rounded-lg text-xs disabled:opacity-50' }, busy ? 'Aguarde…' : mode === 'asaas' ? 'Salvar conexão Asaas' : 'Usar Pix manual'),
            status?.configured && React.createElement('button', { type: 'button', onClick: () => run(signal => client.testSavedKey(signal)), disabled, className: 'p-3 bg-white border border-emerald-200 text-emerald-800 font-bold rounded-lg text-xs disabled:opacity-50' }, 'Testar chave salva'),
            status?.configured && React.createElement('button', { type: 'button', onClick: remove, disabled, className: 'p-3 text-red-700 font-bold rounded-lg text-xs disabled:opacity-50' }, 'Remover chave'),
            error && React.createElement('button', { type: 'button', onClick: () => setReload(previous => previous + 1), disabled: busy || loading, className: 'p-3 bg-white border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-50' }, 'Tentar novamente')
        ),
        error && React.createElement('p', { className: 'text-xs text-red-700 bg-red-50 p-3 rounded-lg', role: 'alert' }, error),
        message && React.createElement('p', { className: 'text-xs text-emerald-800 bg-white p-3 rounded-lg', role: 'status', 'aria-live': 'polite' }, message),
        React.createElement(AsaasProductionSettings),
        status?.enabled && mode === 'asaas' && !busy && React.createElement(AsaasSandboxCheck),
        status?.enabled && !busy && React.createElement(AsaasPendingCharges)
    );
};
