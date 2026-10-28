import React, { useEffect, useRef, useState } from 'https://esm.sh/react@18.2.0';
import { auth } from '../firebase-config.js?v=105';
import { createAsaasSandboxClient } from './asaas-sandbox-client.js?v=105';

const client = createAsaasSandboxClient({ getIdToken: force => auth.currentUser?.getIdToken(force) });

export const AsaasSandboxCheck = () => {
    const [check, setCheck] = useState(null);
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [watchUntil, setWatchUntil] = useState(0);
    const mounted = useRef(false);
    const pending = useRef(null);
    const run = async (operation, watch = true) => {
        if (pending.current) return;
        const controller = new AbortController();
        pending.current = controller;
        setBusy(true);
        setError('');
        try {
            const next = await operation(controller.signal);
            if (!mounted.current) return;
            setCheck(next);
            setMessage(next.message);
            if (next.testComplete || !['NOT_CREATED', 'PENDING', 'OVERDUE', 'CONFIRMED'].includes(next.status)) setWatchUntil(0);
            else if (watch && next.ready) setWatchUntil(Date.now() + 120000);
        } catch (failure) {
            if (mounted.current) { setError(failure.message); setWatchUntil(0); }
        } finally {
            if (pending.current === controller) pending.current = null;
            if (mounted.current) setBusy(false);
        }
    };
    useEffect(() => {
        mounted.current = true;
        run(signal => client.getStatus(signal));
        return () => { mounted.current = false; pending.current?.abort(); };
    }, []);
    useEffect(() => {
        if (!watchUntil || watchUntil <= Date.now() || busy || check?.testComplete) return;
        const timer = setTimeout(() => {
            if (document.visibilityState !== 'hidden') run(signal => client.getStatus(signal), false);
            else setWatchUntil(0);
        }, Math.min(8000, Math.max(0, watchUntil - Date.now())));
        return () => clearTimeout(timer);
    }, [watchUntil, busy, check?.testComplete]);
    const canSimulate = check?.ready && ['PENDING', 'OVERDUE'].includes(check.status);
    const copy = async () => {
        try { await navigator.clipboard.writeText(check.payload); setMessage('Código Pix de teste copiado. Use somente no Sandbox.'); }
        catch { setError('Selecione e copie o código no campo abaixo.'); }
    };
    return React.createElement('section', { className: 'space-y-3 p-3 bg-white border border-emerald-200 rounded-lg', 'aria-label': 'Teste de cobrança Asaas Sandbox' },
        React.createElement('p', { className: 'text-sm font-bold text-emerald-900' }, 'Teste de cobrança e retorno automático'),
        React.createElement('p', { className: 'text-xs text-slate-600' }, 'Cobrança isolada de R$ 5,00, com cliente fictício. Use a simulação abaixo. Este teste não altera vendas, parcelas, saldo ou estoque do sistema.'),
        React.createElement('p', { className: 'text-xs font-bold text-amber-800' }, 'Somente Sandbox. Não pague este QR Code pelo seu banco.'),
        check?.testComplete && React.createElement('p', { className: 'text-sm font-bold text-emerald-800', role: 'status' }, 'Pagamento de teste recebido. Retorno automático validado.'),
        check?.status === 'CONFIRMED' && React.createElement('p', { className: 'text-xs text-amber-800' }, 'O Asaas confirmou a simulação. Aguardando o status de recebimento.'),
        canSimulate && check.encodedImage && React.createElement('img', { src: 'data:image/png;base64,' + check.encodedImage, alt: 'QR Code Pix de teste do Asaas Sandbox', className: 'mx-auto w-48 h-48', width: 192, height: 192 }),
        canSimulate && check.payload && React.createElement(React.Fragment, null,
            React.createElement('label', { htmlFor: 'asaas-test-payload', className: 'block text-xs font-bold text-slate-600' }, 'Pix copia e cola de teste'),
            React.createElement('textarea', { id: 'asaas-test-payload', value: check.payload, readOnly: true, rows: 3, className: 'w-full p-2 border border-slate-200 rounded-lg text-xs break-all', onFocus: event => event.target.select() }),
            React.createElement('button', { type: 'button', onClick: copy, className: 'p-2 text-xs font-bold text-emerald-800 border border-emerald-200 rounded-lg' }, 'Copiar Pix de teste')
        ),
        React.createElement('div', { className: 'flex flex-wrap gap-2' },
            (!check?.ready || error) && React.createElement('button', { type: 'button', disabled: busy || !check, onClick: () => run(signal => client.prepare(signal)), className: 'p-3 bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50' }, busy ? 'Aguarde…' : check?.created ? 'Retomar preparação do teste' : 'Criar cobrança de teste'),
            canSimulate && React.createElement('button', { type: 'button', disabled: busy, onClick: () => run(signal => client.simulate(signal)), className: 'p-3 bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50' }, busy ? 'Aguarde…' : 'Simular pagamento no Sandbox'),
            React.createElement('button', { type: 'button', disabled: busy, onClick: () => run(signal => client.getStatus(signal)), className: 'p-3 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-lg disabled:opacity-50' }, busy ? 'Consultando…' : 'Verificar retorno')
        ),
        message && React.createElement('p', { className: 'text-xs text-emerald-900', role: 'status', 'aria-live': 'polite' }, message),
        error && React.createElement('p', { className: 'text-xs text-red-700', role: 'alert' }, error),
        check?.ready && !check.testComplete && watchUntil > Date.now() && React.createElement('p', { className: 'text-xs text-slate-500' }, 'Aguardando o retorno automático por até dois minutos. Você também pode tocar em Verificar retorno.'),
        React.createElement('a', { href: './integrations/atualizar-worker.html?v=105', target: '_blank', rel: 'noopener noreferrer', className: 'inline-block text-xs underline text-slate-600' }, 'Copiar atualização do Worker')
    );
};
