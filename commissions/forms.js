import React, { useRef, useState } from 'https://esm.sh/react@18.2.0';
import { BadgePercent, RefreshCw, PlusCircle, UserPlus, Wallet } from 'https://esm.sh/lucide-react@0.292.0';
import { formatCurrency, getBrazilDateString } from '../utils.js?v=112';
import { showAppConfirm } from '../ui-interactions-v81.js?v=112';
import { isTermSale } from '../financial-core-v70.js?v=112';
import { commissionMethods, productBase, quote, saleCode, units } from './core.js?v=112';
import { brl, decimal, finishPercent, moneyDisplay, moneyMask, pastedMoney, percentMask, sellerPhoneMask } from './presentation.js?v=112';
import { CommissionDialog } from './dialog.js?v=112';

const h = React.createElement;
const label = (name, control) => h('label', { className: 'com-field' }, h('span', null, name), control);
const input = (name, value, set, props = {}) => label(name, h('input', {
  type: 'text', value, onChange: e => set(e.target.value), ...props
}));
const option = (value, title) => h('option', { key: value, value }, title);
const select = (name, value, change, options, props = {}) => label(name, h('select', {
  value, onChange: e => change(e.target.value), ...props
}, options));
const modeOptions = [option('percent', 'Percentual (%)'), option('fixed', 'Valor fixo (R$)')];
const methodOptions = Object.entries(commissionMethods).map(([key, label]) => option(key, label));
const preview = (mode, value, base) => {
  try { return quote(mode, units(value), base); } catch { return null; }
};
const action = (text, onClick, extra = {}) => h('button', { type: 'button', className: 'com-button', onClick, ...extra }, text);
const amountInput = (name, value, set, { percent = false, required = true } = {}) => label(name,
  h('span', { className: 'com-mask ' + (percent ? 'is-percent' : 'is-money') },
    h('input', {
      type: 'text', value, required, inputMode: percent ? 'decimal' : 'numeric', 'aria-label': name + (percent ? ' (%)' : ' (R$)'),
      placeholder: '0,00', autoComplete: 'off',
      onChange: e => set(percent ? percentMask(e.target.value) : moneyMask(e.target.value)),
      onFocus: e => e.currentTarget.select(),
      onBlur: percent ? e => set(finishPercent(e.target.value)) : undefined,
      onPaste: percent ? undefined : e => {
        if (!e.clipboardData) return;
        const next = pastedMoney(e.clipboardData.getData('text'));
        e.preventDefault();
        if (next !== null) set(next);
      }
    }),
    h('span', { className: 'com-mask-unit', 'aria-hidden': true }, percent ? '%' : 'R$')));

export function SaleCommissionField({ sellers, form, setForm, base, cost, expected, term }) {
  const active = sellers.filter(s => s.active !== false).sort((a,b) => a.name.localeCompare(b.name, 'pt-BR'));
  const change = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const amount = preview(form.mode, form.value, base);
  return h('section', { className: 'sale-section com-sale-field' },
    h('h3', null, h(BadgePercent, { size: 19, 'aria-hidden': true }), 'Vendedor e comissão'),
    select('Vendedor (opcional)', form.sellerId, id => {
      const seller = active.find(s => s.id === id);
      setForm({ sellerId: id, mode: 'percent', value: seller ? decimal(seller.rate) : '', expenses: form.expenses });
    }, [option('', 'Sem vendedor'), ...active.map(s => option(s.id, s.name))]),
    !active.length && h('small', { className: 'com-muted' }, 'Cadastre um vendedor na aba Vendedores e comissões.'),
    form.sellerId && h(React.Fragment, null,
      h('div', { className: 'com-grid' },
        select('Como calcular', form.mode, mode => setForm(prev => ({ ...prev, mode,
          value: mode === 'fixed' ? (amount !== null ? moneyDisplay(amount) : '') : decimal(active.find(s => s.id === prev.sellerId)?.rate || 0)
        })), modeOptions, { 'data-select-presentation': 'dropdown' }),
        amountInput('Comissão', form.value, v => change('value', v), { percent: form.mode === 'percent' }),
        term && amountInput('Despesas diretas da venda (opcional)', form.expenses, v => change('expenses', v), { required: false })),
      h('div', { className: 'com-callout' }, h('span', null, 'Base após descontos: ', brl(base)),
        h('strong', null, 'Comissão prevista: ', amount == null ? 'Confira o valor' : brl(amount))),
      term && h('small', { className: 'com-muted' }, 'A comissão só libera quando a venda cobrir custos, despesas diretas e a comissão inteira. As despesas informadas aqui não geram saída de caixa.'),
      term && amount != null && expected - cost - (units(form.expenses || '0') || 0) < amount
        && h('p', { className: 'com-warning' }, 'O lucro previsto desta venda não cobre a comissão combinada.')));
}

const info = {
  seller: { title: 'Cadastrar vendedor', icon: UserPlus, subtitle: 'Defina o percentual sugerido ao selecionar este vendedor em uma venda.' },
  credit: { title: 'Adicionar comissão', icon: PlusCircle, subtitle: 'Lance um bônus avulso ou um valor extra em uma venda.' },
  agreement: { title: 'Compensar comissão', icon: RefreshCw, subtitle: 'Registre um acordo sobre comissão já liquidada de uma venda cancelada.' },
  payout: { title: 'Registrar repasse', icon: Wallet, subtitle: 'Selecione as comissões e registre o valor já repassado ao vendedor.' }
};
const savedMessage = {
  seller: 'Cadastro salvo.', credit: 'Comissão adicionada.', payout: 'Repasse registrado.',
  immediate: 'Compensação registrada como entrada no Financeiro.', future: 'Compensação registrada para repasses futuros.'
};

export function CommissionForm({ kind, seller, editing, initialGrantId = '', sales, port, onPost, onClose, onSaved }) {
  const [form, set] = useState(() => ({
    name: editing?.name || '', phone: sellerPhoneMask(editing?.phone), rate: decimal(editing?.rate || 0), active: editing?.active !== false,
    saleId: '', grantId: initialGrantId, mode: 'fixed', value: '', expenses: '', reason: '',
    date: getBrazilDateString(), method: kind === 'payout' ? 'pix' : '', settlement: '', offset: '', amounts: {}
  }));
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const lock = useRef(false), [id] = useState(() => crypto.randomUUID());
  const change = (key, value) => set(p => ({ ...p, [key]: value }));
  const myRows = port.rows.filter(r => r.sellerId === seller?.id);
  const due = myRows.filter(r => r.available > 0);
  const recover = myRows.filter(r => r.recoverable > 0);
  const source = recover.find(r => r.id === form.grantId);
  const sale = sales.find(s => s.id === form.saleId);
  const term = sale && isTermSale(sale);
  const options = kind === 'credit' ? sales.filter(s => s.status !== 'canceled' && (!s.commission || s.commission.sellerId === seller?.id))
    .sort((a,b) => String(b.saleDate).localeCompare(String(a.saleDate))) : [];
  const credits = Object.entries(form.amounts).map(([grantId, value]) => ({
    grantId, saleId: myRows.find(r => r.id === grantId)?.saleId || '', amount: units(value)
  }));
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
      const cmd = { id, kind, sellerId: seller?.id || '', date: form.date, reason: form.reason };
      if (kind === 'seller') Object.assign(cmd, { sellerId: editing?.id || '', name: form.name, phone: form.phone,
        rate: units(finishPercent(form.rate)), active: form.active });
      if (kind === 'credit') Object.assign(cmd, { saleId: form.saleId, mode: form.mode,
        units: units(form.mode === 'percent' ? finishPercent(form.value) : form.value), expenseCents: units(form.expenses || '0') });
      if (kind === 'agreement') {
        const amount = units(form.value);
        if (!source || !amount || amount > source.recoverable) throw new Error('Selecione a comissão e confira o valor disponível para compensar.');
        if (!form.reason.trim()) throw new Error('Descreva o acordo com o vendedor.');
        if (!form.settlement) throw new Error('Escolha quando a comissão será compensada.');
        const immediate = form.settlement === 'immediate';
        if (immediate && !form.method) throw new Error('Selecione como o dinheiro foi devolvido.');
        const message = immediate
          ? 'Confirma que ' + seller.name + ' já devolveu ' + brl(amount) + ' via ' + commissionMethods[form.method] + '? O valor entra no Financeiro e não será abatido de outro repasse.'
          : 'Registrar ' + brl(amount) + ' para abater em repasses futuros de ' + seller.name + '? Nada entra no caixa agora.';
        if (!await showAppConfirm(message + ' O estorno do cliente não muda.', {
          title: immediate ? 'Confirmar devolução recebida' : 'Confirmar compensação futura',
          confirmLabel: immediate ? 'Registrar entrada' : 'Registrar acordo'
        })) return;
        Object.assign(cmd, { saleId: source.saleId, grantId: source.id, amount, settlement: form.settlement, method: form.method });
      }
      if (kind === 'payout') {
        if (!credits.length || credits.some(l => !(l.amount > 0) || l.amount > (myRows.find(r => r.id === l.grantId)?.available || 0))
          || !Number.isFinite(offset) || offset > Math.min(openOffsets, gross)) throw new Error('Confira os valores escolhidos e o abatimento.');
        if (!await showAppConfirm('Liquidar ' + brl(gross) + ', abater ' + brl(offset) + ' e registrar saída de ' + brl(gross - offset) + '?',
          { title: 'Confirmar repasse · ' + seller.name, confirmLabel: 'Confirmar repasse' })) return;
        Object.assign(cmd, { lines: credits, offset, method: form.method });
      }
      const result = await onPost(cmd);
      onSaved(kind === 'seller' ? result : seller.id, savedMessage[kind === 'agreement' ? form.settlement : kind]);
    } catch (err) { setError(err.message || 'Não foi possível registrar a operação.'); }
    finally { lock.current = false; setBusy(false); }
  };

  const settlementOption = (value, title, detail) => h('label', { className: 'com-choice' + (form.settlement === value ? ' is-selected' : '') },
    h('input', {
      type: 'radio', name: 'agreement-settlement', value, checked: form.settlement === value, required: true,
      onChange: () => set(prev => ({ ...prev, settlement: value, method: '' }))
    }),
    h('span', null, h('strong', null, title), h('small', null, detail)));

  return h(CommissionDialog, {
    title: editing ? 'Editar vendedor' : info[kind].title,
    subtitle: kind === 'seller' ? info.seller.subtitle : seller.name + ' · ' + info[kind].subtitle,
    icon: info[kind].icon, onClose, onSubmit: send, busy,
    actions: [
      action('Voltar', onClose, { key: 'cancel', disabled: busy }),
      h('button', { type: 'submit', className: 'page-primary-action com-submit', key: 'save', disabled: busy },
        busy ? 'Registrando…' : ({ seller: 'Salvar vendedor', credit: 'Adicionar comissão', agreement: 'Registrar compensação', payout: 'Registrar repasse' })[kind])
    ]
  },
    h('fieldset', { className: 'com-form-fields', disabled: busy },
      kind === 'seller' && h(React.Fragment, null,
        input('Nome do vendedor', form.name, v => change('name', v), { required: true, maxLength: 90, autoComplete: 'name', 'data-initial-focus': true }),
        h('div', { className: 'com-grid' },
          input('WhatsApp com DDD (opcional)', form.phone, v => change('phone', sellerPhoneMask(v)),
            { type: 'tel', inputMode: 'tel', autoComplete: 'tel-national', placeholder: '(85) 99999-9999' }),
          amountInput('Comissão padrão', form.rate, v => change('rate', v), { percent: true })),
        editing && h('label', { className: 'com-choice' }, h('input', {
          type: 'checkbox', checked: form.active, onChange: e => change('active', e.target.checked)
        }), h('span', null, h('strong', null, 'Vendedor ativo'), h('small', null, 'Inativar não apaga vendas nem o histórico.')))),

      kind === 'credit' && h(React.Fragment, null,
        select('Vincular a uma venda (opcional)', form.saleId, v => set(p => ({ ...p, saleId: v, mode: 'fixed', ...(p.mode === 'percent' ? { value: '' } : {}) })),
          [option('', 'Bônus avulso · sem venda'), ...options.map(s => option(s.id,
            saleCode(s) + ' · ' + (s.customerName || 'Venda avulsa') + ' · ' + formatCurrency(s.totalPrice)))]),
        h('div', { className: 'com-grid' },
          sale && select('Como calcular', form.mode, mode => set(p => ({ ...p, mode, value: '' })), modeOptions, { 'data-select-presentation': 'dropdown' }),
          amountInput('Comissão adicional', form.value, v => change('value', v), { percent: form.mode === 'percent' }),
          term && !sale.commission && amountInput('Despesas diretas (opcional)', form.expenses, v => change('expenses', v), { required: false })),
        h('div', { className: 'com-callout' }, h('strong', null, 'Crédito adicional: ', brl(creditPreview || 0)),
          h('small', null, term ? 'No crediário, a liberação considera a soma das comissões da venda.' : 'Disponível para repasse após o registro.'))),

      kind === 'agreement' && h(React.Fragment, null,
        select('Comissão de venda cancelada', form.grantId, v => change('grantId', v),
          [option('', 'Selecione a comissão já liquidada'), ...recover.map(r =>
            option(r.id, r.code + ' · ' + r.grant.reason + ' · até ' + brl(r.recoverable)))], { required: true }),
        amountInput('Valor da compensação', form.value, v => change('value', v)),
        source && h('small', { className: 'com-muted' }, 'Disponível para compensar nesta comissão: ' + brl(source.recoverable) + '.'),
        h('fieldset', { className: 'com-choices' }, h('legend', null, 'Como o vendedor vai compensar?'),
          settlementOption('immediate', 'Imediatamente', 'O vendedor já devolveu o valor. O sistema registra uma entrada no Financeiro.'),
          settlementOption('future', 'Em repasses futuros', 'O valor fica a compensar e poderá ser abatido em um próximo repasse.')),
        form.settlement === 'immediate' && select('Forma da devolução', form.method, v => change('method', v),
          [option('', 'Selecione uma forma'), ...methodOptions], { required: true, 'data-select-presentation': 'dropdown' }),
        h('small', { className: 'com-muted' }, 'Nenhuma opção altera o repasse original ou o estorno do cliente.')),

      kind === 'payout' && h(React.Fragment, null,
        h('fieldset', { className: 'com-picker' }, h('legend', null, 'Comissões disponíveis'),
          !due.length && h('p', { className: 'com-muted' }, 'Nenhuma comissão disponível para repasse.'),
          due.map(r => h('div', { className: 'com-pick', key: r.id },
            h('label', { className: 'com-choice' }, h('input', { type: 'checkbox', checked: r.id in form.amounts,
              onChange: e => amountFor(r.id, e.target.checked ? moneyDisplay(r.available) : null) }),
              h('span', null, h('strong', null, (r.code || 'Bônus avulso') + ' · ' + brl(r.available)),
                h('small', null, r.grant.reason))),
            r.id in form.amounts && amountInput('Liquidar', form.amounts[r.id], v => amountFor(r.id, v))))),
        h('div', { className: 'com-grid' },
          h('div', { hidden: gross > 0 && offset === gross }, select('Forma do repasse', form.method, v => change('method', v), methodOptions, { 'data-select-presentation': 'dropdown' })),
          openOffsets > 0 && amountInput('Abater de compensações (opcional)', form.offset, v => change('offset', v), { required: false })),
        openOffsets > 0 && h('small', { className: 'com-muted' }, 'Até ' + brl(Math.min(openOffsets, gross)) + ' pode ser abatido neste repasse.'),
        h('dl', { className: 'com-totals' },
          h('div', null, h('dt', null, 'Selecionado'), h('dd', null, brl(gross))),
          h('div', null, h('dt', null, 'Abatimento'), h('dd', null, brl(offset || 0))),
          h('div', null, h('dt', null, 'Saída de caixa'), h('dd', null, brl(Math.max(0, gross - (offset || 0))))))),

      kind !== 'seller' && h(React.Fragment, null,
        input(form.settlement === 'immediate' ? 'Data da devolução' : 'Data do lançamento', form.date, v => change('date', v),
          { type: 'date', max: getBrazilDateString(), required: true }),
        label(kind === 'payout' ? 'Observação (opcional)' : 'Motivo', h('textarea', {
          rows: 2, value: form.reason, onChange: e => change('reason', e.target.value), required: kind !== 'payout', maxLength: 320
        }))),
      error && h('p', { className: 'com-warning', role: 'alert' }, error)));
}
