import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.2.0';
import { AlertCircle, BadgePercent, BookOpen, CheckCircle, CreditCard, Info, RotateCcw, Save } from 'https://esm.sh/lucide-react@0.292.0';
import {
    DEFAULT_PAYMENT_SETTINGS,
    PAYMENT_FREQUENCIES,
    PAYMENT_INSTALLMENT_LIMIT,
    clonePaymentSettings,
    normalizePaymentSettings,
    parseRatePercent
} from './payment-settings.js?v=20';

const formatRate = value => parseRatePercent(value, 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
});

const cloneDraft = settings => JSON.parse(JSON.stringify(settings));

const RateInput = ({ value, onChange, label }) => React.createElement('label', { className: "rate-input-field" },
    React.createElement('span', { className: "rate-input-mobile-label" }, label),
    React.createElement('span', { className: "rate-input-control" },
        React.createElement('input', {
            type: "text",
            inputMode: "decimal",
            value: value,
            onChange: event => onChange(event.target.value),
            'aria-label': label
        }),
        React.createElement('span', null, "%")
    )
);

export const AbaTaxas = ({ settings, onSave }) => {
    const [section, setSection] = useState('card');
    const [frequency, setFrequency] = useState('monthly');
    const [draft, setDraft] = useState(() => clonePaymentSettings(settings));
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (dirty) return;
        setDraft(clonePaymentSettings(settings));
    }, [settings, dirty]);

    const updatePath = (path, value) => {
        setDraft(previous => {
            const next = cloneDraft(previous);
            let target = next;
            path.slice(0, -1).forEach(key => {
                target = target[key];
            });
            target[path[path.length - 1]] = value;
            return next;
        });
        setDirty(true);
        setMessage(null);
    };

    const nonZeroCarnetRates = useMemo(() => PAYMENT_FREQUENCIES.reduce((total, item) => {
        const rates = draft.carnet?.[item.id] || [];
        return total + rates.slice(1).filter(rate => parseRatePercent(rate, 0) > 0).length;
    }, 0), [draft]);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const normalized = normalizePaymentSettings(draft);
            await onSave(normalized);
            setDraft(clonePaymentSettings(normalized));
            setDirty(false);
            setMessage({ type: 'success', text: 'Taxas e juros salvos. As próximas vendas usarão esta tabela.' });
        } catch (error) {
            console.error('Erro ao salvar taxas:', error);
            setMessage({ type: 'error', text: 'Não foi possível salvar a tabela. Verifique sua conexão e tente novamente.' });
        } finally {
            setSaving(false);
        }
    };

    const restoreDefaults = () => {
        setDraft(clonePaymentSettings(DEFAULT_PAYMENT_SETTINGS));
        setDirty(true);
        setMessage({ type: 'info', text: 'Os valores padrão foram carregados. Clique em “Salvar alterações” para confirmar.' });
    };

    const cardCreditRows = Array.from({ length: PAYMENT_INSTALLMENT_LIMIT }, (_, index) => index + 1);
    const activeFrequency = PAYMENT_FREQUENCIES.find(item => item.id === frequency);

    return React.createElement('section', { className: "page-stack rates-page animate-fade-in" },
        React.createElement('div', { className: "page-heading" },
            React.createElement('div', { className: "page-heading-copy" },
                React.createElement('h1', { className: "page-title" }, "Taxas e juros"),
                React.createElement('p', { className: "page-description" }, "Configure a maquininha e os acréscimos do carnê usados automaticamente nas próximas vendas.")
            ),
            React.createElement('button', {
                type: "button",
                className: "page-primary-action",
                onClick: handleSave,
                disabled: saving || !dirty
            }, React.createElement(Save, { size: 17 }), saving ? "Salvando..." : dirty ? "Salvar alterações" : "Tudo salvo")
        ),

        message && React.createElement('div', { className: `rates-message is-${message.type}`, role: "status" },
            React.createElement(message.type === 'success' ? CheckCircle : message.type === 'error' ? AlertCircle : Info, { size: 18 }),
            React.createElement('span', null, message.text)
        ),

        React.createElement('div', { className: "rates-tabs", role: "tablist", 'aria-label': "Tipo de taxa" },
            React.createElement('button', {
                type: "button",
                role: "tab",
                'aria-selected': section === 'card',
                className: section === 'card' ? 'is-active' : '',
                onClick: () => setSection('card')
            }, React.createElement(CreditCard, { size: 18 }), React.createElement('span', null, "Cartão")),
            React.createElement('button', {
                type: "button",
                role: "tab",
                'aria-selected': section === 'carnet',
                className: section === 'carnet' ? 'is-active' : '',
                onClick: () => setSection('carnet')
            }, React.createElement(BookOpen, { size: 18 }), React.createElement('span', null, "Carnê"))
        ),

        section === 'card' && React.createElement('div', { className: "rates-panel" },
            React.createElement('div', { className: "rates-panel-heading" },
                React.createElement('div', null,
                    React.createElement('h2', null, "Tabela da maquininha"),
                    React.createElement('p', null, "Os valores atuais do sistema já estão preenchidos como padrão e podem ser substituídos pelas taxas da sua operadora.")
                ),
                React.createElement('label', { className: "rates-table-name" },
                    React.createElement('span', null, "Nome da tabela ou maquininha"),
                    React.createElement('input', {
                        type: "text",
                        maxLength: 80,
                        value: draft.card.machineName,
                        onChange: event => updatePath(['card', 'machineName'], event.target.value),
                        placeholder: "Ex.: Ton, Stone, PagBank"
                    })
                )
            ),

            React.createElement('section', { className: "rates-group" },
                React.createElement('div', { className: "rates-group-title" },
                    React.createElement('h3', null, "Débito"),
                    React.createElement('span', null, "Taxa única por modalidade")
                ),
                React.createElement('div', { className: "debit-rate-grid" },
                    React.createElement(RateInput, {
                        label: "Presencial · Visa/Master",
                        value: draft.card.presencial.debito.visa_master,
                        onChange: value => updatePath(['card', 'presencial', 'debito', 'visa_master'], value)
                    }),
                    React.createElement(RateInput, {
                        label: "Presencial · Outras",
                        value: draft.card.presencial.debito.outras,
                        onChange: value => updatePath(['card', 'presencial', 'debito', 'outras'], value)
                    }),
                    React.createElement(RateInput, {
                        label: "Link de pagamento",
                        value: draft.card.link.debito,
                        onChange: value => updatePath(['card', 'link', 'debito'], value)
                    })
                )
            ),

            React.createElement('section', { className: "rates-group" },
                React.createElement('div', { className: "rates-group-title" },
                    React.createElement('h3', null, "Crédito parcelado"),
                    React.createElement('span', null, "Percentual total descontado ou repassado em cada plano")
                ),
                React.createElement('div', { className: "rate-table-scroll" },
                    React.createElement('div', { className: "rate-table card-rate-table" },
                        React.createElement('div', { className: "rate-table-header" },
                            React.createElement('span', null, "Parcelas"),
                            React.createElement('span', null, "Presencial · Visa/Master"),
                            React.createElement('span', null, "Presencial · Outras"),
                            React.createElement('span', null, "Link de pagamento")
                        ),
                        cardCreditRows.map(count => React.createElement('div', { className: "rate-table-row", key: count },
                            React.createElement('strong', null, `${count}x`),
                            React.createElement(RateInput, {
                                label: `${count}x presencial Visa/Master`,
                                value: draft.card.presencial.credito.visa_master[count],
                                onChange: value => updatePath(['card', 'presencial', 'credito', 'visa_master', count], value)
                            }),
                            React.createElement(RateInput, {
                                label: `${count}x presencial outras bandeiras`,
                                value: draft.card.presencial.credito.outras[count],
                                onChange: value => updatePath(['card', 'presencial', 'credito', 'outras', count], value)
                            }),
                            React.createElement(RateInput, {
                                label: `${count}x por link de pagamento`,
                                value: draft.card.link.credito[count],
                                onChange: value => updatePath(['card', 'link', 'credito', count], value)
                            })
                        ))
                    )
                )
            )
        ),

        section === 'carnet' && React.createElement('div', { className: "rates-panel" },
            React.createElement('div', { className: "rates-panel-heading" },
                React.createElement('div', null,
                    React.createElement('h2', null, "Juros para vendas no carnê"),
                    React.createElement('p', null, "Defina uma taxa total para cada quantidade de parcelas e frequência. Planos não configurados continuam sem juros.")
                ),
                React.createElement('div', { className: "rates-summary-badge" },
                    React.createElement(BadgePercent, { size: 17 }),
                    React.createElement('span', null, `${nonZeroCarnetRates} plano${nonZeroCarnetRates === 1 ? '' : 's'} com juros`)
                )
            ),

            React.createElement('div', { className: "rates-info-card" },
                React.createElement(Info, { size: 19 }),
                React.createElement('p', null,
                    React.createElement('strong', null, "Como o cálculo funciona: "),
                    "a taxa escolhida é aplicada uma única vez ao saldo restante depois da entrada. O total com juros é então dividido igualmente entre as parcelas."
                )
            ),

            React.createElement('div', { className: "frequency-tabs", role: "tablist", 'aria-label': "Frequência do carnê" },
                PAYMENT_FREQUENCIES.map(item => React.createElement('button', {
                    type: "button",
                    key: item.id,
                    role: "tab",
                    'aria-selected': frequency === item.id,
                    className: frequency === item.id ? 'is-active' : '',
                    onClick: () => setFrequency(item.id)
                }, item.label))
            ),

            React.createElement('section', { className: "rates-group" },
                React.createElement('div', { className: "rates-group-title" },
                    React.createElement('h3', null, `Parcelamento ${activeFrequency.label.toLowerCase()}`),
                    React.createElement('span', null, "Taxa total adicionada ao saldo financiado")
                ),
                React.createElement('div', { className: "rate-table carnet-rate-table" },
                    React.createElement('div', { className: "rate-table-header" },
                        React.createElement('span', null, "Parcelas"),
                        React.createElement('span', null, "Taxa total"),
                        React.createElement('span', null, "Aplicação")
                    ),
                    cardCreditRows.map(count => {
                        const rate = parseRatePercent(draft.carnet[frequency][count], 0);
                        return React.createElement('div', { className: "rate-table-row", key: `${frequency}-${count}` },
                            React.createElement('strong', null, `${count}x`),
                            React.createElement(RateInput, {
                                label: `${activeFrequency.label} em ${count}x`,
                                value: draft.carnet[frequency][count],
                                onChange: value => updatePath(['carnet', frequency, count], value)
                            }),
                            React.createElement('span', { className: rate > 0 ? 'rate-status is-configured' : 'rate-status' },
                                rate > 0 ? `${formatRate(rate)}% sobre o saldo` : "Sem acréscimo"
                            )
                        );
                    })
                )
            )
        ),

        React.createElement('div', { className: "rates-footer" },
            React.createElement('button', { type: "button", className: "rates-reset-button", onClick: restoreDefaults },
                React.createElement(RotateCcw, { size: 16 }), "Restaurar valores padrão"
            ),
            React.createElement('p', null, "Alterações afetam somente novas vendas. Registros já realizados não são recalculados.")
        )
    );
};
