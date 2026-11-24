import React, { useEffect, useRef, useState } from 'https://esm.sh/react@18.2.0';
import { formatCurrency, getBrazilDateString } from '../utils.js?v=111';
import { showAppConfirm } from '../ui-interactions-v81.js?v=111';
import { productBase, quote, saleCode, units } from './core.js?v=111';

export const h = React.createElement;
export const brl = cents => formatCurrency(cents / 100);
export const decimal = cents => (cents / 100).toFixed(2).replace('.', ',');
const label = (name, input) => h('label', { className: 'com-field' }, h('span', null, name), input);
const input = (name, value, set, props = {}) => label(name, h('input', {
  type: 'text', value, onChange: e => set(e.target.value), ...props
}));
const num = (name, value, set, required = true) => input(name, value, set, { inputMode: 'decimal', placeholder: '0,00', required, maxLength: 16 });
const opt = (value, title) => h('option', { key: value, value }, title);
const select = (name, value, change, options) => label(name, h('select', {
  value, onChange: e => change(e.target.value), 'data-select-presentation': 'dropdown'
}, options));
const modeOptions = () => [opt('percent', 'Porcentagem (%)'), opt('fixed', 'Valor fixo (R$)')];
const preview = (mode, value, base) => {
  try { return quote(mode, units(value), base); } catch { return null; }
};

export function SaleCommissionField({ sellers, form, setForm, base, cost, expected, term }) {
  const active = sellers.filter(s => s.active !== false);
  const change = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const amount = preview(form.mode, form.value, base);
  return h('section', { className: 'sale-section com-sale-field' },
    h('h3', null, 'Indicação e comissão'),
    select('Vendedor ou indicador (opcional)', form.sellerId, id => {
      const s = active.find(v => v.id === id);
      setForm({ sellerId: id, mode: 'percent', value: s ? decimal(s.rate) : '', expenses: form.expenses });
    }, [opt('', 'Sem indicação'), ...active.map(s => opt(s.id, s.name))]),
    !active.length && h('small', null, 'Cadastre um indicador na aba Vendedores e comissões.'),
    form.sellerId && h(React.Fragment, null,
      h('div', { className: 'com-grid' },
        select('Como calcular', form.mode, v => {
          setForm(prev => ({ ...prev, mode: v, value: v === 'fixed' && amount != null ? decimal(amount) : decimal(active.find(s => s.id === prev.sellerId)?.rate || 0) }));
        }, modeOptions()),
        num(form.mode === 'percent' ? 'Comissão (%)' : 'Comissão (R$)', form.value, v => change('value', v)),
        term && num('Despesas diretas da venda (R$, opcional)', form.expenses, v => change('expenses', v), false)),
      h('p', { className: 'com-note' }, 'Base dos produtos após descontos: ', brl(base), ' · Comissão prevista: ', h('strong', null, amount == null ? 'Confira o valor' : brl(amount))),
      term && h('small', null, 'A comissão inteira libera quando os recebimentos cobrirem custo, despesas diretas e comissão. Informar a despesa aqui não lança uma saída no caixa.'),
      term && amount != null && expected - cost - (units(form.expenses || '0') || 0) < amount
        && h('p', { className: 'com-warning' }, 'Atenção: o lucro previsto desta venda não cobre a comissão combinada.')));
}

const titles = { seller: 'Cadastrar vendedor', credit: 'Adicionar comissão', agreement: 'Lançar compensação manual', payout: 'Registrar repasse' };
export function CommissionForm({ kind, seller, editing, sales, port, onPost, onClose, onSaved }) {
  const [form, set] = useState(() => ({ name: editing?.name || '', phone: editing?.phone || '', rate: decimal(editing?.rate || 0),
    active: editing?.active !== false, saleId: '', grantId: '', mode: 'fixed', value: '', expenses: '', reason: '',
    date: getBrazilDateString(), method: 'pix', offset: '', amounts: {} }));
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const lock = useRef(false), [id] = useState(() => crypto.randomUUID());
  const panel = useRef(null);
  useEffect(() => {
    panel.current?.scrollIntoView({ block: 'nearest' });
    if (kind !== 'seller') panel.current?.querySelector('h3')?.focus({ preventScroll: true });
  }, [kind]);
  const change = (key, value) => set(p => ({ ...p, [key]: value }));
  const myRows = port.rows.filter(r => r.sellerId === seller?.id);
  const due = myRows.filter(r => r.available > 0);
  const recover = myRows.filter(r => r.recoverable > 0);
  const source = recover.find(r => r.id === form.grantId);
  const sale = sales.find(s => s.id === form.saleId);
  const options = sales.filter(s => s.status !== 'canceled' && (!s.commission || s.commission.sellerId === seller?.id))
    .sort((a,b) => String(b.saleDate).localeCompare(String(a.saleDate)));
  const credits = Object.entries(form.amounts).map(([grantId, value]) => ({
    grantId, saleId: myRows.find(r => r.id === grantId)?.saleId || '', amount: units(value) }));
  const gross = credits.reduce((s, l) => s + (l.amount || 0), 0);
  const offset = units(form.offset || '0');
  const openOffsets = port.agreements.filter(a => a.sellerId === seller?.id && a.date <= form.date).reduce((n, a) => n + a.remaining, 0);
  const creditPreview = preview(form.mode, form.value, sale ? productBase(sale) : 0);
  const amountFor = (key, value) => set(prev => {
    const amounts = { ...prev.amounts };
    if (value === null) delete amounts[key]; else amounts[key] = value;
    return { ...prev, amounts };
  });
  const send = async e => {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      let cmd = { id, kind, sellerId: seller?.id || '', date: form.date, reason: form.reason };
      if (kind === 'seller') Object.assign(cmd, { sellerId: editing?.id || '', name: form.name, phone: form.phone, rate: units(form.rate), active: form.active });
      if (kind === 'credit') Object.assign(cmd, { saleId: form.saleId, mode: form.mode, units: units(form.value), expenseCents: units(form.expenses || '0') });
      if (kind === 'agreement') {
        const amount = units(form.value);
        if (!source || !amount || amount > source.recoverable) throw new Error('Selecione a comissão e confira o valor disponível para o acordo.');
        if (!form.reason.trim()) throw new Error('Descreva o acordo individual com o vendedor.');
        if (!await showAppConfirm('Registrar um acordo de ' + brl(amount) + ' com ' + seller.name + '? O pagamento original e o estorno do cliente não mudam.',
          { title: 'Confirmar acordo individual', confirmLabel: 'Registrar acordo' })) return;
        Object.assign(cmd, { saleId: source.saleId, grantId: source.id, amount });
      }
      if (kind === 'payout') {
        if (!credits.length || credits.some(l => !(l.amount > 0) || l.amount > (myRows.find(r => r.id === l.grantId)?.available || 0))
          || !Number.isFinite(offset) || offset > Math.min(openOffsets, gross)) throw new Error('Confira os valores selecionados e o abatimento do acordo.');
        if (!await showAppConfirm('Liquidar ' + brl(gross) + ' de comissões, abater ' + brl(offset) + ' em acordos e registrar saída de ' + brl(gross - offset) + '? Registre somente o repasse já realizado.',
          { title: 'Confirmar repasse · ' + seller.name, confirmLabel: 'Confirmar repasse' })) return;
        Object.assign(cmd, { lines: credits, offset, method: form.method });
      }
      const result = await onPost(cmd); onSaved(kind === 'seller' ? result : seller.id);
    } catch (err) { setError(err.message || 'Não foi possível registrar a operação.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return h('form', { ref: panel, className: 'com-panel com-form', onSubmit: send, 'aria-label': titles[kind] },
    h('h3', { tabIndex: -1 }, editing ? 'Editar vendedor' : titles[kind]),
    kind === 'seller' ? h('div', { className: 'com-grid' },
      input('Nome', form.name, v => change('name', v), { required: true, maxLength: 90, autoFocus: true }),
      input('WhatsApp com DDD (opcional)', form.phone, v => change('phone', v), { type: 'tel', maxLength: 24 }),
      num('Comissão padrão (%)', form.rate, v => change('rate', v)),
      editing && label('Cadastro ativo', h('input', { type: 'checkbox', checked: form.active, onChange: e => change('active', e.target.checked) })))
    : h(React.Fragment, null,
      h('p', { className: 'com-muted' }, seller.name),
      kind === 'credit' && h(React.Fragment, null,
        select('Vincular a uma venda', form.saleId, v => set(p => ({ ...p, saleId: v, mode: v ? p.mode : 'fixed' })),
          [opt('', 'Bônus avulso · sem venda'), ...options.map(s => opt(s.id, saleCode(s) + ' · ' + (s.customerName || 'Venda avulsa') + ' · ' + formatCurrency(s.totalPrice)))]),
        h('div', { className: 'com-grid' },
          sale && select('Como calcular', form.mode, v => change('mode', v), modeOptions()),
          num(form.mode === 'percent' ? 'Comissão adicional (%)' : 'Comissão adicional (R$)', form.value, v => change('value', v)),
          sale && !sale.commission && sale.saleType !== 'direct' && num('Despesas diretas da venda (R$, opcional)', form.expenses, v => change('expenses', v), false)),
        h('p', { className: 'com-note' }, 'Crédito adicional: ', brl(creditPreview || 0), sale && sale.saleType !== 'direct' ? '. A liberação considera a soma das comissões desta venda.' : '. Disponível para repasse após o registro.')),
      kind === 'agreement' && h(React.Fragment, null,
        select('Comissão já liquidada de venda cancelada', form.grantId, v => change('grantId', v), [opt('', 'Selecione a comissão original'), ...recover.map(r =>
          opt(r.id, r.code + ' · ' + r.grant.reason + ' · até ' + brl(r.recoverable)))]),
        num('Valor do acordo (R$)', form.value, v => change('value', v)),
        h('small', null, 'O acordo fica no histórico mesmo sem saldo. Não há desconto no estorno do cliente nem entrada de dinheiro.')),
      kind === 'payout' && h(React.Fragment, null,
        h('fieldset', { className: 'com-picker' }, h('legend', null, 'Escolha as comissões e quanto liquidar de cada uma'),
          due.map(r => h('div', { className: 'com-pick', key: r.id },
            h('label', null, h('input', { type: 'checkbox', checked: r.id in form.amounts, onChange: e => amountFor(r.id, e.target.checked ? decimal(r.available) : null) }),
              (r.code || 'Bônus avulso') + ' · ' + r.grant.reason + ' · ' + brl(r.available)),
            r.id in form.amounts && num('Liquidar (R$)', form.amounts[r.id], v => amountFor(r.id, v))))),
        h('div', { className: 'com-grid' },
          select('Forma do repasse', form.method, v => change('method', v), [opt('pix', 'Pix'), opt('money', 'Dinheiro'), opt('transfer', 'Transferência')]),
          openOffsets > 0 && num('Abater de acordos (opcional, até ' + brl(Math.min(openOffsets, gross)) + ')', form.offset, v => change('offset', v), false)),
        h('p', { className: 'com-note' }, 'Selecionado: ' + brl(gross) + ' · Acordos: ' + brl(offset || 0) + ' · Saída de caixa: ', h('strong', null, brl(gross - (offset || 0))))),
      h('div', { className: 'com-grid' },
        input('Data do lançamento', form.date, v => change('date', v), { type: 'date', max: getBrazilDateString(), required: true }),
        input(kind === 'payout' ? 'Observação (opcional)' : 'Motivo ' + (kind === 'agreement' ? 'do acordo individual' : 'do crédito'), form.reason, v => change('reason', v),
          { required: kind !== 'payout', maxLength: 320 }))),
    error && h('p', { className: 'com-warning', role: 'alert' }, error),
    h('div', { className: 'com-actions' },
      h('button', { type: 'button', disabled: busy, onClick: onClose }, 'Voltar'),
      h('button', { type: 'submit', className: 'com-primary', disabled: busy }, busy ? 'Registrando…' : (kind === 'seller' ? 'Salvar vendedor' : titles[kind]))));
}
