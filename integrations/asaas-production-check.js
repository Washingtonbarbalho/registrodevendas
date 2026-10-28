import React, { useEffect, useRef, useState } from 'https://esm.sh/react@18.2.0';
import { auth } from '../firebase-config.js?v=105';
import { formatCurrency } from '../utils.js?v=105';
import { createAsaasProductionCheckClient } from './asaas-production-check-client.js?v=105';
const client = createAsaasProductionCheckClient({ getIdToken: force => auth.currentUser?.getIdToken(force) });
const h = React.createElement;

export const AsaasProductionCheck = () => {
    const [data, setData] = useState(null);
    const [payerName, setPayerName] = useState('');
    const [payerCpf, setPayerCpf] = useState('');
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState('');
    const [watchUntil, setWatchUntil] = useState(0);
    const pending = useRef(null);
    const mounted = useRef(false);
    const run = async (operation, watch = true) => {
        if (pending.current) return;
        const controller = new AbortController();
        pending.current = controller;
        setBusy(true); setError('');
        try {
            const next = await operation(controller.signal);
            if (!mounted.current) return;
            setData(next);
            if (next.testComplete || ['DELETED', 'REFUNDED', 'REVIEW'].includes(next.status)) setWatchUntil(0);
            else if (watch && next.ready) setWatchUntil(Date.now() + 120000);
        } catch (failure) { if (mounted.current) { setError(failure.message); setWatchUntil(0); } }
        finally { if (pending.current === controller) pending.current = null; if (mounted.current) setBusy(false); }
    };
    useEffect(() => {
        mounted.current = true;
        run(signal => client.get(signal));
        return () => { mounted.current = false; pending.current?.abort(); };
    }, []);
    useEffect(() => {
        if (!data?.ready || data.testComplete || busy || !watchUntil || watchUntil <= Date.now()) return;
        const timer = setTimeout(() => {
            if (document.visibilityState === 'hidden') setWatchUntil(0);
            else run(signal => client.get(signal), false);
        }, Math.min(8000, Math.max(0, watchUntil - Date.now())));
        return () => clearTimeout(timer);
    }, [data?.ready, data?.testComplete, busy, watchUntil]);
    const prepare = () => {
        const hasPayer = payerName.trim() || payerCpf.trim();
        if ((!data?.started || data?.status === 'DELETED' || hasPayer) && (payerName.trim().length < 2 || payerCpf.replace(/\D/g, '').length !== 11)) { setError('Preencha seu nome completo e CPF para gerar o teste real.'); return; }
        const payer = hasPayer ? { payerName: payerName.trim(), payerCpf } : undefined;
        setPayerName(''); setPayerCpf('');
        run(signal => client.prepare(payer, signal));
    };
    const canGenerate = data && !data.testComplete && (!data.ready || data.status === 'DELETED') && !['REFUNDED', 'REVIEW'].includes(data.status);
    const canPay = data?.ready && ['PENDING', 'OVERDUE'].includes(data.status);
    return h('section', { className: 'space-y-3 pt-4 border-t border-sky-200', 'aria-label': 'Teste de recebimento na conta real' },
        h('h4', { className: 'text-sm font-bold text-sky-950' }, 'Validar recebimento na conta real'),
        h('p', { className: 'text-xs text-sky-950 bg-white border border-sky-200 rounded-lg p-3' }, 'Este teste gera um Pix real de R$ 5,00. Você fará o pagamento pelo seu banco e o valor entrará na conta Asaas, sujeito às tarifas da sua conta. O teste não altera vendas, parcelas ou estoque do sistema.'),
        canGenerate && h('div', { className: 'space-y-2' },
            h('p', { className: 'text-xs text-slate-700' }, 'Informe seu nome e CPF como pagador. Esses dados serão enviados ao Asaas para cadastrar o pagador do teste.'),
            h('label', { htmlFor: 'production-check-payer', className: 'block text-xs font-bold text-slate-700' }, 'Seu nome completo'),
            h('input', { id: 'production-check-payer', type: 'text', autoComplete: 'off', maxLength: 160, value: payerName, disabled: busy, onChange: event => setPayerName(event.target.value), className: 'w-full p-3 rounded-lg border border-sky-200 bg-white' }),
            h('label', { htmlFor: 'production-check-cpf', className: 'block text-xs font-bold text-slate-700' }, 'Seu CPF como pagador do teste'),
            h('input', { id: 'production-check-cpf', type: 'text', inputMode: 'numeric', autoComplete: 'off', maxLength: 14, value: payerCpf, disabled: busy, onChange: event => setPayerCpf(event.target.value.replace(/[^\d.-]/g, '').slice(0, 14)), className: 'w-full p-3 rounded-lg border border-sky-200 bg-white' }),
            h('button', { type: 'button', disabled: busy, onClick: prepare, className: 'w-full p-3 rounded-lg bg-sky-900 text-white font-bold text-xs disabled:opacity-50' }, data.started && data.status !== 'DELETED' ? 'Retomar preparação do Pix real' : 'Gerar Pix real de R$ 5,00')
        ),
        data?.testComplete && h('div', { className: 'p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950', role: 'status' },
            h('p', { className: 'font-bold' }, 'Recebimento real e retorno automático validados.'),
            h('p', null, 'O Asaas confirmou o pagamento de R$ 5,00. O teste preservou os registros do sistema.'),
            data.netCents !== null && h('p', null, 'Valor líquido informado pelo Asaas: ' + formatCurrency(data.netCents / 100))
        ),
        canPay && data.encodedImage && h('img', { src: 'data:image/png;base64,' + data.encodedImage, alt: 'QR Code do Pix real de R$ 5,00', width: 192, height: 192, className: 'w-48 h-48 mx-auto' }),
        canPay && data.payload && h('div', { className: 'space-y-2' },
            h('label', { htmlFor: 'production-check-payload', className: 'block text-xs font-bold text-slate-700' }, 'Pix real — copia e cola'),
            h('textarea', { id: 'production-check-payload', readOnly: true, rows: 3, value: data.payload, onFocus: event => event.target.select(), className: 'w-full p-2 rounded-lg border border-sky-200 text-xs' }),
            h('button', { type: 'button', className: 'p-3 rounded-lg bg-white border border-sky-200 text-sky-950 font-bold text-xs', onClick: async () => {
                try { await navigator.clipboard.writeText(data.payload); setError(''); }
                catch { setError('Selecione e copie o Pix pelo campo acima.'); }
            } }, 'Copiar Pix real de R$ 5,00')
        ),
        data && h('p', { className: 'text-xs text-slate-700', role: 'status', 'aria-live': 'polite' }, data.message),
        error && h('p', { className: 'text-xs text-red-800 bg-red-50 p-3 rounded-lg', role: 'alert' }, error),
        busy && h('p', { className: 'text-xs text-slate-600', role: 'status' }, 'Consultando o teste real…'),
        h('div', { className: 'flex flex-wrap gap-2' },
            h('button', { type: 'button', disabled: busy, onClick: () => run(signal => client.get(signal)), className: 'p-3 rounded-lg bg-white border border-sky-200 text-sky-950 text-xs font-bold disabled:opacity-50' }, 'Verificar retorno real'),
            data?.created && h('button', { type: 'button', disabled: busy, onClick: () => run(signal => client.reconcile(signal)), className: 'p-3 rounded-lg bg-white border border-sky-200 text-sky-950 text-xs font-bold disabled:opacity-50' }, 'Conferir na conta Asaas'),
            data?.started && !data.testComplete && !['DELETED', 'REFUNDED', 'REVIEW'].includes(data.status) && h('button', { type: 'button', disabled: busy, onClick: () => run(signal => client.cancel(signal)), className: 'p-3 rounded-lg text-red-800 text-xs font-bold disabled:opacity-50' }, 'Cancelar cobrança real de teste')
        ),
        error && h('a', { href: './integrations/atualizar-worker.html?v=105-partes', target: '_blank', rel: 'noopener noreferrer', className: 'inline-block text-xs underline text-sky-900' }, 'Abrir atualização do Worker'),
        h('p', { className: 'text-xs text-slate-600' }, 'Se fechar o perfil ou abrir o banco, volte aqui e use Verificar retorno real. Esta etapa não solicita estornos nem faz transferências pela API.')
    );
};
