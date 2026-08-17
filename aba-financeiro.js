import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.2.0';
import {
    ArrowDown,
    ArrowUp,
    Banknote,
    CalendarDays,
    Check,
    Clock3,
    CreditCard,
    Package,
    Plus,
    Receipt,
    RotateCcw,
    Search,
    Trash2,
    Wallet,
    X
} from 'https://esm.sh/lucide-react@0.292.0';
import { db, APP_ID } from './firebase-config.js';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { MoneyInput } from './components.js';
import { formatCurrency, formatDate, getBrazilDateString, parseMoney } from './utils.js';

const h = React.createElement;

const cleanDate = value => String(value || '').split('T')[0];
const numberValue = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
const roundMoney = value => Math.round((numberValue(value) + Number.EPSILON) * 100) / 100;
const normalizeText = value => String(value || '').trim();

const paymentMethodLabel = sale => {
    if (sale.paymentMethod === 'pix') return 'PIX';
    if (sale.paymentMethod === 'money') return 'Dinheiro';
    if (sale.paymentMethod === 'debit') return 'Cartão de débito';
    if (sale.paymentMethod === 'credit') {
        const count = Math.max(1, parseInt(sale.cardInstallments, 10) || 1);
        return `Cartão de crédito · ${count}x`;
    }
    return 'Venda';
};

const getDirectNetAmount = sale => {
    const saved = Number(sale?.netReceived);
    if (sale?.netReceived !== undefined && sale?.netReceived !== null && sale?.netReceived !== '' && Number.isFinite(saved)) {
        return roundMoney(saved);
    }

    let value = numberValue(sale?.totalPrice);
    const fee = numberValue(sale?.feeConfig?.value);
    if (sale?.feeConfig && fee > 0) value -= fee;
    return roundMoney(Math.max(0, value));
};

const getHistoryCashAmount = item => {
    if (!item || item.type === 'abatement') return 0;
    const base = numberValue(item.amount);
    const surplus = item.type === 'full_surplus' ? numberValue(item.surplus) : 0;
    return roundMoney(Math.max(0, base + surplus));
};

const getInstallmentFaceValue = installment => {
    const original = numberValue(installment?.originalAmount);
    if (original > 0) return roundMoney(original);

    const current = numberValue(installment?.amount);
    const history = Array.isArray(installment?.history) ? installment.history : [];
    const alreadyApplied = history.reduce((total, item) => {
        if (!item) return total;
        if (item.type === 'full_surplus') return total + numberValue(item.amount);
        return total + numberValue(item.amount);
    }, 0);

    return roundMoney(Math.max(0, current + alreadyApplied));
};

const getAutomaticMovements = (sales, products) => {
    const movements = [];

    (Array.isArray(sales) ? sales : [])
        .filter(sale => sale && sale.status !== 'canceled')
        .forEach(sale => {
            const isTermSale = sale.saleType === 'prazo' || !sale.saleType;

            if (sale.saleType === 'direct') {
                const amount = getDirectNetAmount(sale);
                if (amount > 0 && sale.saleDate) {
                    movements.push({
                        id: `sale-direct-${sale.id}`,
                        date: cleanDate(sale.saleDate),
                        direction: 'income',
                        amount,
                        description: sale.anonymousSale
                            ? 'Venda no caixa · Venda avulsa'
                            : `Venda no caixa · ${sale.customerName || 'Cliente'}`,
                        detail: paymentMethodLabel(sale),
                        category: 'Venda',
                        source: 'Venda automática',
                        sourceType: 'sale',
                        automatic: true,
                        sale
                    });
                }
                return;
            }

            if (!isTermSale) return;

            const entry = numberValue(sale.entryAmount);
            if (entry > 0 && sale.saleDate) {
                movements.push({
                    id: `sale-term-entry-${sale.id}`,
                    date: cleanDate(sale.saleDate),
                    direction: 'income',
                    amount: roundMoney(entry),
                    description: `Entrada da venda a prazo · ${sale.customerName || 'Cliente'}`,
                    detail: 'Entrada recebida na venda',
                    category: 'Venda a prazo',
                    source: 'Venda automática',
                    sourceType: 'sale',
                    automatic: true,
                    sale
                });
            }

            (sale.installments || []).forEach((installment, installmentIndex) => {
                const history = Array.isArray(installment.history) ? installment.history : [];

                if (history.length > 0) {
                    history.forEach((item, historyIndex) => {
                        const amount = getHistoryCashAmount(item);
                        const date = cleanDate(item?.date || item?.timestamp || installment.paidAt);
                        if (amount <= 0 || !date) return;

                        movements.push({
                            id: `sale-term-payment-${sale.id}-${installmentIndex}-${historyIndex}-${item?.timestamp || date}`,
                            date,
                            direction: 'income',
                            amount,
                            description: `Recebimento · ${sale.customerName || 'Cliente'}`,
                            detail: `Parcela ${installment.number || installmentIndex + 1}`,
                            category: 'Recebimento de crediário',
                            source: 'Venda a prazo',
                            sourceType: 'sale',
                            automatic: true,
                            sale
                        });
                    });
                    return;
                }

                if (installment.paid && installment.paidAt) {
                    const amount = numberValue(installment.originalAmount || installment.amount);
                    if (amount > 0) {
                        movements.push({
                            id: `sale-term-paid-${sale.id}-${installmentIndex}`,
                            date: cleanDate(installment.paidAt),
                            direction: 'income',
                            amount: roundMoney(amount),
                            description: `Recebimento · ${sale.customerName || 'Cliente'}`,
                            detail: `Parcela ${installment.number || installmentIndex + 1}`,
                            category: 'Recebimento de crediário',
                            source: 'Venda a prazo',
                            sourceType: 'sale',
                            automatic: true,
                            sale
                        });
                    }
                }
            });
        });

    (Array.isArray(products) ? products : []).forEach(product => {
        (Array.isArray(product.movements) ? product.movements : []).forEach((movement, movementIndex) => {
            if (movement?.type !== 'compra') return;
            const quantity = Math.max(0, numberValue(movement.quantity));
            const unitCost = Math.max(0, numberValue(movement.unitCost));
            const amount = roundMoney(quantity * unitCost);
            const date = cleanDate(movement.date);
            if (amount <= 0 || !date) return;

            movements.push({
                id: `purchase-${product.id}-${movement.id || movementIndex}`,
                date,
                direction: 'expense',
                amount,
                description: `Compra de mercadoria · ${product.name || product.code || 'Produto'}`,
                detail: `${quantity} un. × ${formatCurrency(unitCost)}`,
                category: 'Compra de mercadoria',
                source: 'Estoque',
                sourceType: 'stock',
                automatic: true
            });
        });
    });

    return movements;
};

const getAutomaticReceivables = sales => {
    const rows = [];

    (Array.isArray(sales) ? sales : [])
        .filter(sale => sale && sale.status !== 'canceled' && (sale.saleType === 'prazo' || !sale.saleType))
        .forEach(sale => {
            (sale.installments || []).forEach((installment, index) => {
                const history = Array.isArray(installment.history) ? installment.history : [];
                const cashReceived = history.reduce((total, item) => {
                    if (!item || item.type === 'abatement') return total;
                    return total + numberValue(item.amount);
                }, 0);
                const abatements = history.reduce((total, item) => {
                    if (item?.type !== 'abatement') return total;
                    return total + numberValue(item.amount);
                }, 0);

                const faceValue = getInstallmentFaceValue(installment);
                const openAmount = installment.paid ? 0 : roundMoney(Math.max(0, numberValue(installment.amount)));
                const status = installment.paid
                    ? 'paid'
                    : (cashReceived > 0 || abatements > 0)
                        ? 'partial'
                        : 'open';

                rows.push({
                    id: `receivable-${sale.id}-${index}`,
                    kind: 'receivable',
                    automatic: true,
                    source: 'Venda a prazo',
                    description: `${sale.customerName || 'Cliente'} · Parcela ${installment.number || index + 1}/${sale.installmentsCount || sale.installments?.length || 1}`,
                    party: sale.customerName || '',
                    dueDate: cleanDate(installment.dueDate),
                    status,
                    paidAt: cleanDate(installment.paidAt),
                    amount: status === 'paid' ? faceValue : openAmount,
                    faceValue,
                    openAmount,
                    sale,
                    installment,
                    installmentIndex: index
                });
            });
        });

    return rows;
};

const statusMeta = (row, today) => {
    if (row.status === 'paid') {
        return {
            label: row.kind === 'payable' ? 'Pago' : 'Recebido',
            className: 'is-paid'
        };
    }
    if (row.status === 'partial') return { label: 'Parcial', className: 'is-partial' };
    if (row.dueDate && row.dueDate < today) return { label: 'Vencido', className: 'is-overdue' };
    if (row.dueDate === today) return { label: 'Vence hoje', className: 'is-today' };
    return { label: 'Em aberto', className: 'is-open' };
};

const EmptyState = ({ text }) => h('div', { className: 'finance-empty' },
    h(Wallet, { size: 30 }),
    h('strong', null, text)
);

const FinanceMovementModal = ({ open, onClose, onSave }) => {
    const today = getBrazilDateString();
    const [direction, setDirection] = useState('income');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(today);
    const [category, setCategory] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setDirection('income');
        setDescription('');
        setAmount('');
        setDate(getBrazilDateString());
        setCategory('');
        setNotes('');
        setSaving(false);
    }, [open]);

    if (!open) return null;

    const submit = async event => {
        event.preventDefault();
        const parsedAmount = parseMoney(amount);
        if (!normalizeText(description)) return alert('Informe a descrição do lançamento.');
        if (!(parsedAmount > 0)) return alert('Informe um valor maior que zero.');
        if (!date) return alert('Informe a data do lançamento.');

        setSaving(true);
        try {
            await onSave({
                direction,
                description: normalizeText(description),
                amount: roundMoney(parsedAmount),
                date,
                category: normalizeText(category) || (direction === 'income' ? 'Outras entradas' : 'Outras saídas'),
                notes: normalizeText(notes)
            });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return h('div', { className: 'finance-modal-overlay', role: 'dialog', 'aria-modal': 'true' },
        h('form', { className: 'finance-modal', onSubmit: submit },
            h('div', { className: 'finance-modal-header' },
                h('div', null,
                    h('h2', null, 'Novo lançamento'),
                    h('p', null, 'Registre uma entrada ou saída que não veio automaticamente do sistema.')
                ),
                h('button', { type: 'button', className: 'finance-icon-button', onClick: onClose, title: 'Fechar' }, h(X, { size: 18 }))
            ),
            h('div', { className: 'finance-modal-body' },
                h('div', { className: 'finance-type-selector' },
                    h('button', {
                        type: 'button',
                        className: direction === 'income' ? 'is-active is-income' : '',
                        onClick: () => setDirection('income')
                    }, h(ArrowUp, { size: 17 }), 'Entrada'),
                    h('button', {
                        type: 'button',
                        className: direction === 'expense' ? 'is-active is-expense' : '',
                        onClick: () => setDirection('expense')
                    }, h(ArrowDown, { size: 17 }), 'Saída')
                ),
                h('label', { className: 'finance-field' },
                    h('span', null, 'Descrição *'),
                    h('input', {
                        value: description,
                        onChange: event => setDescription(event.target.value),
                        placeholder: direction === 'income' ? 'Ex.: Aporte no caixa' : 'Ex.: Frete da mercadoria'
                    })
                ),
                h('div', { className: 'finance-form-grid' },
                    h('label', { className: 'finance-field' },
                        h('span', null, 'Valor *'),
                        h(MoneyInput, { value: amount, onChange: setAmount, placeholder: '0,00' })
                    ),
                    h('label', { className: 'finance-field' },
                        h('span', null, 'Data *'),
                        h('input', { type: 'date', value: date, onChange: event => setDate(event.target.value) })
                    )
                ),
                h('label', { className: 'finance-field' },
                    h('span', null, 'Categoria'),
                    h('input', {
                        value: category,
                        onChange: event => setCategory(event.target.value),
                        placeholder: direction === 'income' ? 'Ex.: Aporte, serviço, outros' : 'Ex.: Transporte, aluguel, outros'
                    })
                ),
                h('label', { className: 'finance-field' },
                    h('span', null, 'Observação'),
                    h('textarea', {
                        rows: 3,
                        value: notes,
                        onChange: event => setNotes(event.target.value),
                        placeholder: 'Informações adicionais do lançamento'
                    })
                )
            ),
            h('div', { className: 'finance-modal-footer' },
                h('button', { type: 'button', className: 'finance-secondary-button', onClick: onClose }, 'Cancelar'),
                h('button', { type: 'submit', className: 'finance-primary-button', disabled: saving },
                    saving ? 'Salvando...' : 'Salvar lançamento'
                )
            )
        )
    );
};

const FinanceAccountModal = ({ open, initialKind, onClose, onSave }) => {
    const [kind, setKind] = useState(initialKind || 'receivable');
    const [description, setDescription] = useState('');
    const [party, setParty] = useState('');
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState(getBrazilDateString());
    const [category, setCategory] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setKind(initialKind || 'receivable');
        setDescription('');
        setParty('');
        setAmount('');
        setDueDate(getBrazilDateString());
        setCategory('');
        setNotes('');
        setSaving(false);
    }, [open, initialKind]);

    if (!open) return null;

    const submit = async event => {
        event.preventDefault();
        const parsedAmount = parseMoney(amount);
        if (!normalizeText(description)) return alert('Informe a descrição da conta.');
        if (!(parsedAmount > 0)) return alert('Informe um valor maior que zero.');
        if (!dueDate) return alert('Informe o vencimento.');

        setSaving(true);
        try {
            await onSave({
                kind,
                description: normalizeText(description),
                party: normalizeText(party),
                amount: roundMoney(parsedAmount),
                dueDate,
                category: normalizeText(category) || (kind === 'receivable' ? 'Conta a receber' : 'Conta a pagar'),
                notes: normalizeText(notes)
            });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return h('div', { className: 'finance-modal-overlay', role: 'dialog', 'aria-modal': 'true' },
        h('form', { className: 'finance-modal', onSubmit: submit },
            h('div', { className: 'finance-modal-header' },
                h('div', null,
                    h('h2', null, kind === 'receivable' ? 'Nova conta a receber' : 'Nova conta a pagar'),
                    h('p', null, 'Cadastre compromissos financeiros que não são gerados automaticamente.')
                ),
                h('button', { type: 'button', className: 'finance-icon-button', onClick: onClose, title: 'Fechar' }, h(X, { size: 18 }))
            ),
            h('div', { className: 'finance-modal-body' },
                h('div', { className: 'finance-type-selector' },
                    h('button', {
                        type: 'button',
                        className: kind === 'receivable' ? 'is-active is-income' : '',
                        onClick: () => setKind('receivable')
                    }, 'A receber'),
                    h('button', {
                        type: 'button',
                        className: kind === 'payable' ? 'is-active is-expense' : '',
                        onClick: () => setKind('payable')
                    }, 'A pagar')
                ),
                h('label', { className: 'finance-field' },
                    h('span', null, 'Descrição *'),
                    h('input', {
                        value: description,
                        onChange: event => setDescription(event.target.value),
                        placeholder: kind === 'receivable' ? 'Ex.: Valor emprestado ao cliente' : 'Ex.: Aluguel da loja'
                    })
                ),
                h('label', { className: 'finance-field' },
                    h('span', null, kind === 'receivable' ? 'Cliente / origem' : 'Fornecedor / favorecido'),
                    h('input', {
                        value: party,
                        onChange: event => setParty(event.target.value),
                        placeholder: 'Opcional'
                    })
                ),
                h('div', { className: 'finance-form-grid' },
                    h('label', { className: 'finance-field' },
                        h('span', null, 'Valor *'),
                        h(MoneyInput, { value: amount, onChange: setAmount, placeholder: '0,00' })
                    ),
                    h('label', { className: 'finance-field' },
                        h('span', null, 'Vencimento *'),
                        h('input', { type: 'date', value: dueDate, onChange: event => setDueDate(event.target.value) })
                    )
                ),
                h('label', { className: 'finance-field' },
                    h('span', null, 'Categoria'),
                    h('input', {
                        value: category,
                        onChange: event => setCategory(event.target.value),
                        placeholder: kind === 'receivable' ? 'Ex.: Outros recebíveis' : 'Ex.: Aluguel, fornecedor, energia'
                    })
                ),
                h('label', { className: 'finance-field' },
                    h('span', null, 'Observação'),
                    h('textarea', {
                        rows: 3,
                        value: notes,
                        onChange: event => setNotes(event.target.value),
                        placeholder: 'Informações adicionais'
                    })
                )
            ),
            h('div', { className: 'finance-modal-footer' },
                h('button', { type: 'button', className: 'finance-secondary-button', onClick: onClose }, 'Cancelar'),
                h('button', { type: 'submit', className: 'finance-primary-button', disabled: saving },
                    saving ? 'Salvando...' : 'Salvar conta'
                )
            )
        )
    );
};

export const AbaFinanceiro = ({ userId, sales, products, onOpenSale }) => {
    const today = getBrazilDateString();
    const [section, setSection] = useState('movements');
    const [startDate, setStartDate] = useState(() => `${today.slice(0, 7)}-01`);
    const [endDate, setEndDate] = useState(today);
    const [search, setSearch] = useState('');
    const [accountFilter, setAccountFilter] = useState('open');
    const [manualMovements, setManualMovements] = useState([]);
    const [manualAccounts, setManualAccounts] = useState([]);
    const [movementModalOpen, setMovementModalOpen] = useState(false);
    const [accountModal, setAccountModal] = useState({ open: false, kind: 'receivable' });
    const [dataError, setDataError] = useState('');

    useEffect(() => {
        if (!userId) return undefined;

        const movementsRef = collection(db, 'artifacts', APP_ID, 'users', userId, 'financeEntries');
        const accountsRef = collection(db, 'artifacts', APP_ID, 'users', userId, 'financeAccounts');

        const unsubscribeMovements = onSnapshot(
            query(movementsRef),
            snapshot => {
                setManualMovements(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
                setDataError('');
            },
            error => {
                console.error('Erro ao carregar lançamentos financeiros:', error);
                setDataError('Não foi possível carregar os lançamentos manuais do financeiro.');
            }
        );

        const unsubscribeAccounts = onSnapshot(
            query(accountsRef),
            snapshot => {
                setManualAccounts(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
                setDataError('');
            },
            error => {
                console.error('Erro ao carregar contas financeiras:', error);
                setDataError('Não foi possível carregar as contas manuais do financeiro.');
            }
        );

        return () => {
            unsubscribeMovements();
            unsubscribeAccounts();
        };
    }, [userId]);

    const automaticMovements = useMemo(() => getAutomaticMovements(sales, products), [sales, products]);
    const automaticReceivables = useMemo(() => getAutomaticReceivables(sales), [sales]);

    const paidManualAccountMovements = useMemo(() => manualAccounts
        .filter(account => account.status === 'paid' && account.paidAt)
        .map(account => ({
            id: `manual-account-paid-${account.id}`,
            date: cleanDate(account.paidAt),
            direction: account.kind === 'payable' ? 'expense' : 'income',
            amount: roundMoney(account.amount),
            description: `${account.kind === 'payable' ? 'Conta paga' : 'Conta recebida'} · ${account.description || 'Sem descrição'}`,
            detail: account.party || account.category || '',
            category: account.category || (account.kind === 'payable' ? 'Conta a pagar' : 'Conta a receber'),
            source: 'Conta manual',
            sourceType: 'manual-account',
            automatic: true
        })), [manualAccounts]);

    const allMovements = useMemo(() => {
        const manual = manualMovements.map(item => ({
            ...item,
            date: cleanDate(item.date),
            amount: roundMoney(item.amount),
            automatic: false,
            source: 'Lançamento manual',
            sourceType: 'manual'
        }));

        return [...automaticMovements, ...paidManualAccountMovements, ...manual]
            .filter(item => item.amount > 0 && item.date)
            .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
    }, [automaticMovements, paidManualAccountMovements, manualMovements]);

    const periodMovements = useMemo(() => {
        const lowerSearch = search.toLowerCase().trim();
        return allMovements.filter(item => {
            if (startDate && item.date < startDate) return false;
            if (endDate && item.date > endDate) return false;
            if (!lowerSearch) return true;
            return [
                item.description,
                item.detail,
                item.category,
                item.source
            ].some(value => String(value || '').toLowerCase().includes(lowerSearch));
        });
    }, [allMovements, startDate, endDate, search]);

    const manualAccountRows = useMemo(() => manualAccounts.map(account => ({
        ...account,
        kind: account.kind === 'payable' ? 'payable' : 'receivable',
        amount: roundMoney(account.amount),
        faceValue: roundMoney(account.amount),
        openAmount: account.status === 'paid' ? 0 : roundMoney(account.amount),
        dueDate: cleanDate(account.dueDate),
        paidAt: cleanDate(account.paidAt),
        status: account.status === 'paid' ? 'paid' : 'open',
        automatic: false,
        source: 'Conta manual'
    })), [manualAccounts]);

    const receivables = useMemo(() => [...automaticReceivables, ...manualAccountRows.filter(row => row.kind === 'receivable')]
        .sort((a, b) => {
            const aOpen = a.status !== 'paid';
            const bOpen = b.status !== 'paid';
            if (aOpen !== bOpen) return aOpen ? -1 : 1;
            return String(a.dueDate || '9999-99-99').localeCompare(String(b.dueDate || '9999-99-99'));
        }), [automaticReceivables, manualAccountRows]);

    const payables = useMemo(() => manualAccountRows
        .filter(row => row.kind === 'payable')
        .sort((a, b) => {
            const aOpen = a.status !== 'paid';
            const bOpen = b.status !== 'paid';
            if (aOpen !== bOpen) return aOpen ? -1 : 1;
            return String(a.dueDate || '9999-99-99').localeCompare(String(b.dueDate || '9999-99-99'));
        }), [manualAccountRows]);

    const totalIncome = periodMovements
        .filter(item => item.direction === 'income')
        .reduce((total, item) => total + item.amount, 0);
    const totalExpense = periodMovements
        .filter(item => item.direction === 'expense')
        .reduce((total, item) => total + item.amount, 0);
    const periodBalance = totalIncome - totalExpense;
    const totalReceivableOpen = receivables
        .filter(item => item.status !== 'paid')
        .reduce((total, item) => total + numberValue(item.openAmount || item.amount), 0);
    const totalPayableOpen = payables
        .filter(item => item.status !== 'paid')
        .reduce((total, item) => total + numberValue(item.openAmount || item.amount), 0);

    const saveMovement = async data => {
        await addDoc(collection(db, 'artifacts', APP_ID, 'users', userId, 'financeEntries'), {
            ...data,
            source: 'manual',
            createdAt: serverTimestamp()
        });
    };

    const saveAccount = async data => {
        await addDoc(collection(db, 'artifacts', APP_ID, 'users', userId, 'financeAccounts'), {
            ...data,
            status: 'open',
            paidAt: null,
            createdAt: serverTimestamp()
        });
    };

    const toggleManualAccount = async account => {
        const isPaid = account.status === 'paid';
        await updateDoc(
            doc(db, 'artifacts', APP_ID, 'users', userId, 'financeAccounts', account.id),
            {
                status: isPaid ? 'open' : 'paid',
                paidAt: isPaid ? null : getBrazilDateString(),
                updatedAt: serverTimestamp()
            }
        );
    };

    const removeMovement = async item => {
        if (item.automatic) return;
        if (!confirm('Excluir este lançamento manual?')) return;
        await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'financeEntries', item.id));
    };

    const removeAccount = async account => {
        if (account.automatic) return;
        if (!confirm('Excluir esta conta manual?')) return;
        await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'financeAccounts', account.id));
    };

    const resetPeriodToMonth = () => {
        const current = getBrazilDateString();
        setStartDate(`${current.slice(0, 7)}-01`);
        setEndDate(current);
    };

    const filteredAccounts = rows => {
        const lowerSearch = search.toLowerCase().trim();
        return rows.filter(row => {
            if (accountFilter === 'open' && row.status === 'paid') return false;
            if (accountFilter === 'paid' && row.status !== 'paid') return false;
            if (!lowerSearch) return true;
            return [row.description, row.party, row.source, row.category]
                .some(value => String(value || '').toLowerCase().includes(lowerSearch));
        });
    };

    const renderSummary = () => h('div', { className: 'finance-summary-grid' },
        h('article', { className: 'finance-summary-card is-balance' },
            h('span', null, 'Saldo do período'),
            h('strong', null, formatCurrency(periodBalance)),
            h('small', null, `${formatDate(startDate)} a ${formatDate(endDate)}`)
        ),
        h('article', { className: 'finance-summary-card is-income' },
            h('span', null, 'Entradas'),
            h('strong', null, formatCurrency(totalIncome)),
            h('small', null, `${periodMovements.filter(item => item.direction === 'income').length} movimentações`)
        ),
        h('article', { className: 'finance-summary-card is-expense' },
            h('span', null, 'Saídas'),
            h('strong', null, formatCurrency(totalExpense)),
            h('small', null, `${periodMovements.filter(item => item.direction === 'expense').length} movimentações`)
        ),
        h('article', { className: 'finance-summary-card is-receivable' },
            h('span', null, 'A receber em aberto'),
            h('strong', null, formatCurrency(totalReceivableOpen)),
            h('small', null, `${receivables.filter(item => item.status !== 'paid').length} contas/parcelas`)
        ),
        h('article', { className: 'finance-summary-card is-payable' },
            h('span', null, 'A pagar em aberto'),
            h('strong', null, formatCurrency(totalPayableOpen)),
            h('small', null, `${payables.filter(item => item.status !== 'paid').length} contas`)
        )
    );

    const renderMovements = () => h(React.Fragment, null,
        h('div', { className: 'finance-toolbar' },
            h('div', { className: 'finance-date-range' },
                h('label', null, h('span', null, 'De'), h('input', { type: 'date', value: startDate, onChange: event => setStartDate(event.target.value) })),
                h('label', null, h('span', null, 'Até'), h('input', { type: 'date', value: endDate, onChange: event => setEndDate(event.target.value) })),
                h('button', { type: 'button', className: 'finance-icon-button', onClick: resetPeriodToMonth, title: 'Mês atual' }, h(RotateCcw, { size: 17 }))
            ),
            h('div', { className: 'finance-search' },
                h(Search, { size: 17 }),
                h('input', { value: search, onChange: event => setSearch(event.target.value), placeholder: 'Buscar movimentações...' })
            ),
            h('button', { type: 'button', className: 'finance-primary-button', onClick: () => setMovementModalOpen(true) },
                h(Plus, { size: 17 }), 'Novo lançamento'
            )
        ),
        h('div', { className: 'finance-list surface' },
            h('div', { className: 'finance-list-head' },
                h('span', null, 'Data'),
                h('span', null, 'Descrição'),
                h('span', null, 'Origem'),
                h('span', null, 'Valor'),
                h('span', null, '')
            ),
            periodMovements.length === 0
                ? h(EmptyState, { text: 'Nenhuma movimentação encontrada neste período.' })
                : periodMovements.map(item => h('div', { className: 'finance-movement-row', key: item.id },
                    h('div', { className: 'finance-row-date' },
                        h(CalendarDays, { size: 15 }),
                        h('span', null, formatDate(item.date))
                    ),
                    h('div', { className: 'finance-row-main' },
                        h('strong', null, item.description),
                        h('small', null, [item.detail, item.category].filter(Boolean).join(' · '))
                    ),
                    h('div', { className: 'finance-source-pill' }, item.source || (item.automatic ? 'Automático' : 'Manual')),
                    h('strong', { className: `finance-row-value ${item.direction === 'income' ? 'is-income' : 'is-expense'}` },
                        item.direction === 'income' ? '+ ' : '- ',
                        formatCurrency(item.amount)
                    ),
                    h('div', { className: 'finance-row-actions' },
                        item.sourceType === 'sale' && item.sale && onOpenSale && h('button', {
                            type: 'button',
                            className: 'finance-icon-button',
                            onClick: () => onOpenSale(item.sale),
                            title: 'Ver venda'
                        }, h(Receipt, { size: 16 })),
                        !item.automatic && h('button', {
                            type: 'button',
                            className: 'finance-icon-button is-danger',
                            onClick: () => removeMovement(item),
                            title: 'Excluir lançamento'
                        }, h(Trash2, { size: 16 }))
                    )
                ))
        )
    );

    const renderAccounts = kind => {
        const rows = filteredAccounts(kind === 'receivable' ? receivables : payables);
        const isReceivable = kind === 'receivable';

        return h(React.Fragment, null,
            h('div', { className: 'finance-toolbar' },
                h('div', { className: 'finance-filter-tabs' },
                    ['open', 'paid', 'all'].map(filter => h('button', {
                        type: 'button',
                        key: filter,
                        className: accountFilter === filter ? 'is-active' : '',
                        onClick: () => setAccountFilter(filter)
                    }, filter === 'open' ? 'Em aberto' : filter === 'paid' ? (isReceivable ? 'Recebidas' : 'Pagas') : 'Todas'))
                ),
                h('div', { className: 'finance-search' },
                    h(Search, { size: 17 }),
                    h('input', {
                        value: search,
                        onChange: event => setSearch(event.target.value),
                        placeholder: isReceivable ? 'Buscar contas a receber...' : 'Buscar contas a pagar...'
                    })
                ),
                h('button', {
                    type: 'button',
                    className: 'finance-primary-button',
                    onClick: () => setAccountModal({ open: true, kind })
                }, h(Plus, { size: 17 }), isReceivable ? 'Nova conta a receber' : 'Nova conta a pagar')
            ),
            h('div', { className: 'finance-list surface' },
                h('div', { className: 'finance-account-head' },
                    h('span', null, 'Vencimento'),
                    h('span', null, 'Descrição'),
                    h('span', null, 'Status'),
                    h('span', null, 'Valor'),
                    h('span', null, '')
                ),
                rows.length === 0
                    ? h(EmptyState, { text: isReceivable ? 'Nenhuma conta a receber encontrada.' : 'Nenhuma conta a pagar encontrada.' })
                    : rows.map(row => {
                        const status = statusMeta(row, today);
                        const displayedAmount = row.status === 'paid' ? row.faceValue || row.amount : row.openAmount || row.amount;

                        return h('div', { className: `finance-account-row ${status.className}`, key: row.id },
                            h('div', { className: 'finance-row-date' },
                                h(Clock3, { size: 15 }),
                                h('span', null, formatDate(row.dueDate))
                            ),
                            h('div', { className: 'finance-row-main' },
                                h('strong', null, row.description),
                                h('small', null, [row.party, row.source].filter(Boolean).join(' · '))
                            ),
                            h('span', { className: `finance-status ${status.className}` }, status.label),
                            h('strong', { className: isReceivable ? 'finance-row-value is-income' : 'finance-row-value is-expense' },
                                formatCurrency(displayedAmount)
                            ),
                            h('div', { className: 'finance-row-actions' },
                                row.automatic && row.sale && onOpenSale && h('button', {
                                    type: 'button',
                                    className: 'finance-icon-button',
                                    onClick: () => onOpenSale(row.sale),
                                    title: 'Ver venda'
                                }, h(Receipt, { size: 16 })),
                                !row.automatic && h('button', {
                                    type: 'button',
                                    className: row.status === 'paid' ? 'finance-icon-button' : 'finance-settle-button',
                                    onClick: () => toggleManualAccount(row),
                                    title: row.status === 'paid' ? 'Reabrir conta' : (isReceivable ? 'Marcar como recebida' : 'Marcar como paga')
                                }, row.status === 'paid'
                                    ? h(RotateCcw, { size: 16 })
                                    : h(React.Fragment, null, h(Check, { size: 15 }), h('span', null, isReceivable ? 'Receber' : 'Pagar'))
                                ),
                                !row.automatic && h('button', {
                                    type: 'button',
                                    className: 'finance-icon-button is-danger',
                                    onClick: () => removeAccount(row),
                                    title: 'Excluir conta'
                                }, h(Trash2, { size: 16 }))
                            )
                        );
                    })
            )
        );
    };

    return h('section', { className: 'page-stack finance-page animate-fade-in' },
        h('div', { className: 'page-heading' },
            h('div', { className: 'page-heading-copy' },
                h('h1', { className: 'page-title' }, 'Financeiro'),
                h('p', { className: 'page-description' }, 'Acompanhe entradas, saídas, contas a receber e contas a pagar em um único lugar.')
            )
        ),
        dataError && h('div', { className: 'finance-error' }, dataError),
        renderSummary(),
        h('div', { className: 'finance-section-tabs', role: 'tablist', 'aria-label': 'Seções do financeiro' },
            h('button', {
                type: 'button',
                role: 'tab',
                'aria-selected': section === 'movements',
                className: section === 'movements' ? 'is-active' : '',
                onClick: () => { setSection('movements'); setSearch(''); }
            }, h(Banknote, { size: 18 }), 'Movimentações'),
            h('button', {
                type: 'button',
                role: 'tab',
                'aria-selected': section === 'receivable',
                className: section === 'receivable' ? 'is-active' : '',
                onClick: () => { setSection('receivable'); setAccountFilter('open'); setSearch(''); }
            }, h(ArrowUp, { size: 18 }), 'Contas a receber'),
            h('button', {
                type: 'button',
                role: 'tab',
                'aria-selected': section === 'payable',
                className: section === 'payable' ? 'is-active' : '',
                onClick: () => { setSection('payable'); setAccountFilter('open'); setSearch(''); }
            }, h(ArrowDown, { size: 18 }), 'Contas a pagar')
        ),
        section === 'movements'
            ? renderMovements()
            : renderAccounts(section === 'receivable' ? 'receivable' : 'payable'),
        h(FinanceMovementModal, {
            open: movementModalOpen,
            onClose: () => setMovementModalOpen(false),
            onSave: saveMovement
        }),
        h(FinanceAccountModal, {
            open: accountModal.open,
            initialKind: accountModal.kind,
            onClose: () => setAccountModal({ open: false, kind: 'receivable' }),
            onSave: saveAccount
        })
    );
};
