import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.2.0';
import { createPortal } from 'https://esm.sh/react-dom@18.2.0';
import {
  CalendarDays, Check, Clipboard, Crosshair, DollarSign, Edit3, MessageCircle,
  RefreshCw, Search, ShoppingBag, Target, TrendingUp, Users, X
} from 'https://esm.sh/lucide-react@0.292.0';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { db, APP_ID } from './firebase-config.js?v=92';
import { formatCurrency, formatDate, getBrazilDateString } from './utils.js';
import {
  buildCollectionMessage,
  buildCollectionQueue,
  buildRepurchaseMessage,
  buildRepurchaseSuggestions,
  buildWhatsappUrl,
  calculateMonthlyGoals,
  commercialMonthBounds,
  normalizeCommercialGoals
} from './commercial-engine-v74.js?v=92';

const h = React.createElement;
const EMPTY_GOAL = { revenue: 0, salesCount: 0, recurringCustomers: 0 };
const goalStorageKey = userId => `registro-vendas:commercial-goals:${userId || 'local'}`;

const readLocalGoals = userId => {
  try { return normalizeCommercialGoals(JSON.parse(localStorage.getItem(goalStorageKey(userId)) || '{}')); }
  catch (_) { return {}; }
};

const writeLocalGoals = (userId, goals) => {
  try { localStorage.setItem(goalStorageKey(userId), JSON.stringify(goals)); return true; }
  catch (_) { return false; }
};

const monthLabel = value => {
  const [year, month] = String(value || '').split('-').map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)));
};

const firstUpper = value => value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
const numberLabel = value => Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const metricValue = metric => metric.unit === 'currency' ? formatCurrency(metric.actual) : numberLabel(metric.actual);
const metricTarget = metric => metric.unit === 'currency' ? formatCurrency(metric.target) : numberLabel(metric.target);
const metricRemaining = metric => metric.unit === 'currency' ? formatCurrency(metric.remaining) : numberLabel(metric.remaining);

const copyText = async value => {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
};

const useBodyLock = open => useEffect(() => {
  if (!open) return undefined;
  const previous = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  return () => { document.body.style.overflow = previous; };
}, [open]);

const StatusPills = ({ value, onChange, counts }) => h('div', { className: 'commercial74-status-pills' },
  [['all', 'Todas'], ['overdue', 'Em atraso'], ['today', 'Hoje'], ['upcoming', 'Próximas']].map(([id, label]) =>
    h('button', {
      key: id, type: 'button', className: value === id ? 'is-active' : '', onClick: () => onChange(id)
    }, label, h('span', null, id === 'all' ? counts.all : counts[id] || 0))
  )
);

const GoalCard = ({ metric }) => h('article', { className: `commercial74-goal-card ${metric.reached ? 'is-reached' : ''}` },
  h('div', { className: 'commercial74-goal-heading' },
    h('span', { className: 'commercial74-goal-icon' }, h(metric.id === 'revenue' ? DollarSign : metric.id === 'salesCount' ? ShoppingBag : Users, { size: 18 })),
    h('div', null, h('span', null, metric.label), h('strong', null, metricValue(metric)))
  ),
  h('div', { className: 'commercial74-progress-track', role: 'progressbar', 'aria-valuenow': Math.round(metric.progress), 'aria-valuemin': 0, 'aria-valuemax': 100 },
    h('span', { style: { width: `${metric.progress}%` } })
  ),
  h('div', { className: 'commercial74-goal-foot' },
    h('span', null, metric.target > 0 ? `Meta ${metricTarget(metric)}` : 'Meta não definida'),
    h('strong', null, metric.target > 0
      ? metric.reached ? `${Math.round(metric.percent)}% · concluída` : `Faltam ${metricRemaining(metric)}`
      : 'Defina uma meta')
  )
);

const GoalEditor = ({ open, month, value, saving, error, onClose, onSave }) => {
  const [draft, setDraft] = useState({ ...EMPTY_GOAL });
  useBodyLock(open);
  useEffect(() => {
    if (open) setDraft({ ...EMPTY_GOAL, ...value });
  }, [open, month, value]);
  if (!open) return null;
  const update = (field, next) => setDraft(current => ({ ...current, [field]: next }));
  return createPortal(h('div', { className: 'commercial74-modal-overlay', role: 'presentation', onClick: onClose },
    h('form', {
      className: 'commercial74-goal-modal', role: 'dialog', 'aria-modal': 'true',
      'aria-labelledby': 'commercial-goal-title', onClick: event => event.stopPropagation(),
      onSubmit: event => { event.preventDefault(); onSave(draft); }
    },
      h('header', null,
        h('div', null,
          h('span', null, 'Planejamento mensal'),
          h('h2', { id: 'commercial-goal-title' }, `Metas de ${firstUpper(monthLabel(month))}`),
          h('p', null, 'Use metas objetivas e acompanhe o avanço com os mesmos números dos relatórios.')
        ),
        h('button', { type: 'button', onClick: onClose, 'aria-label': 'Fechar' }, h(X, { size: 20 }))
      ),
      h('div', { className: 'commercial74-goal-fields' },
        h('label', null, h('span', null, 'Faturamento líquido (R$)'), h('input', {
          type: 'number', min: '0', step: '0.01', inputMode: 'decimal', value: draft.revenue,
          onChange: event => update('revenue', event.target.value)
        })),
        h('label', null, h('span', null, 'Quantidade de vendas'), h('input', {
          type: 'number', min: '0', step: '1', inputMode: 'numeric', value: draft.salesCount,
          onChange: event => update('salesCount', event.target.value)
        })),
        h('label', null, h('span', null, 'Clientes que devem voltar'), h('input', {
          type: 'number', min: '0', step: '1', inputMode: 'numeric', value: draft.recurringCustomers,
          onChange: event => update('recurringCustomers', event.target.value)
        }))
      ),
      error && h('p', { className: 'commercial74-form-error' }, error),
      h('footer', null,
        h('button', { type: 'button', className: 'commercial74-secondary-button', onClick: onClose }, 'Cancelar'),
        h('button', { type: 'submit', className: 'commercial74-primary-button', disabled: saving },
          saving ? h(React.Fragment, null, h(RefreshCw, { size: 17, className: 'animate-spin' }), 'Salvando...')
            : h(React.Fragment, null, h(Check, { size: 17 }), 'Salvar metas'))
      )
    )
  ), document.body);
};

const CommercialRow = ({ entry, kind, storeName, pixKey, onNotice }) => {
  const isCollection = kind === 'collection';
  const message = isCollection
    ? buildCollectionMessage({ entry, storeName, pixKey })
    : buildRepurchaseMessage({ entry, storeName });
  const whatsappUrl = buildWhatsappUrl(entry.phone, message);
  const timing = entry.status === 'overdue'
    ? `${entry.daysOverdue} dia${entry.daysOverdue === 1 ? '' : 's'} em atraso`
    : entry.status === 'today' ? 'Ação para hoje'
    : `Em ${entry.daysUntil} dia${entry.daysUntil === 1 ? '' : 's'}`;
  const handleCopy = async () => {
    try { await copyText(message); onNotice('Mensagem copiada.'); }
    catch (error) { console.error(error); onNotice('Não foi possível copiar a mensagem.'); }
  };

  return h('article', { className: `commercial74-action-row is-${entry.status}` },
    h('div', { className: 'commercial74-row-main' },
      h('div', { className: 'commercial74-row-heading' },
        h('div', null,
          h('strong', null, entry.customerName),
          h('span', null, isCollection
            ? `Parcela ${entry.installmentNumber}/${entry.installmentsCount} · ${entry.contractId}`
            : entry.productName)
        ),
        h('span', { className: `commercial74-status is-${entry.status}` }, entry.statusLabel)
      ),
      h('div', { className: 'commercial74-row-details' },
        isCollection
          ? h(React.Fragment, null,
              h('span', null, h(DollarSign, { size: 15 }), formatCurrency(entry.amount)),
              h('span', null, h(CalendarDays, { size: 15 }), `Vencimento ${formatDate(entry.dueDate)}`))
          : h(React.Fragment, null,
              h('span', null, h(ShoppingBag, { size: 15 }), `Última compra ${formatDate(entry.lastPurchaseDate)}`),
              h('span', null, h(CalendarDays, { size: 15 }), `Ciclo de ${entry.cycleDays} dias`)),
        h('span', { className: 'commercial74-timing' }, timing)
      )
    ),
    h('div', { className: 'commercial74-row-actions' },
      h('button', { type: 'button', className: 'commercial74-copy-button', onClick: handleCopy },
        h(Clipboard, { size: 16 }), 'Copiar'),
      whatsappUrl
        ? h('a', { className: 'commercial74-whatsapp-button', href: whatsappUrl, target: '_blank', rel: 'noopener noreferrer' },
            h(MessageCircle, { size: 17 }), 'WhatsApp')
        : h('button', { type: 'button', className: 'commercial74-whatsapp-button', disabled: true, title: 'Cadastre o telefone do cliente' },
            h(MessageCircle, { size: 17 }), 'Sem telefone')
    )
  );
};

const EmptyActions = ({ kind, hasSearch }) => h('div', { className: 'commercial74-empty' },
  h('span', null, h(kind === 'collection' ? Check : Crosshair, { size: 24 })),
  h('strong', null, hasSearch ? 'Nenhuma ação encontrada' : kind === 'collection' ? 'Cobranças em dia' : 'Nenhuma recompra prevista'),
  h('p', null, hasSearch
    ? 'Ajuste a busca ou o filtro de situação.'
    : kind === 'collection'
      ? 'Não há parcelas abertas vencidas ou com vencimento nos próximos 7 dias.'
      : 'As sugestões aparecem 14 dias antes do ciclo de recompra configurado no produto.')
);

export const AbaComercial = ({
  userId, sales = [], products = [], customers = [], userProfile = {},
  analysisEndDate, onAnalysisPeriodChange, onAnalysisStartDateChange, onAnalysisEndDateChange
}) => {
  const today = getBrazilDateString();
  const [profile, setProfile] = useState(userProfile || {});
  const [goals, setGoals] = useState(() => {
    const remote = normalizeCommercialGoals(userProfile?.commercialGoals);
    return Object.keys(remote).length ? remote : readLocalGoals(userId);
  });
  const [month, setMonth] = useState((analysisEndDate || today).slice(0, 7));
  const [goalEditorOpen, setGoalEditorOpen] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState('');
  const [section, setSection] = useState('collection');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (analysisEndDate) setMonth(analysisEndDate.slice(0, 7));
  }, [analysisEndDate]);

  const chooseGoalMonth = value => {
    setMonth(value);
    const bounds = commercialMonthBounds(value);
    if (!bounds) return;
    onAnalysisPeriodChange?.('custom');
    onAnalysisStartDateChange?.(bounds.startDate);
    onAnalysisEndDateChange?.(bounds.endDate);
  };

  useEffect(() => {
    if (!userId) return undefined;
    const profileRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'profile', 'info');
    return onSnapshot(profileRef, snapshot => {
      const data = snapshot.data() || {};
      setProfile(current => ({ ...current, ...data }));
      const remoteGoals = normalizeCommercialGoals(data.commercialGoals);
      if (Object.keys(remoteGoals).length) {
        setGoals(remoteGoals);
        writeLocalGoals(userId, remoteGoals);
      } else {
        setGoals(readLocalGoals(userId));
      }
    }, error => {
      console.error('Erro ao carregar metas comerciais:', error);
      setGoalError('Não foi possível atualizar as metas agora. As ações comerciais continuam disponíveis.');
    });
  }, [userId]);

  useEffect(() => { setStatusFilter('all'); setSearch(''); }, [section]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 2_800);
    return () => clearTimeout(timer);
  }, [notice]);

  const collections = useMemo(() => buildCollectionQueue({ sales, customers, today, horizonDays: 7 }),
    [sales, customers, today]);
  const repurchases = useMemo(() => buildRepurchaseSuggestions({ sales, products, customers, today, horizonDays: 14 }),
    [sales, products, customers, today]);
  const goalResult = useMemo(() => calculateMonthlyGoals({ sales, customers, goals, month, today }),
    [sales, customers, goals, month, today]);
  const currentList = section === 'collection' ? collections : repurchases;
  const counts = useMemo(() => ({
    all: currentList.length,
    overdue: currentList.filter(item => item.status === 'overdue').length,
    today: currentList.filter(item => item.status === 'today').length,
    upcoming: currentList.filter(item => item.status === 'upcoming').length
  }), [currentList]);
  const visibleRows = useMemo(() => {
    const term = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    return currentList.filter(item => statusFilter === 'all' || item.status === statusFilter).filter(item => {
      if (!term) return true;
      return `${item.customerName} ${item.productName || ''} ${item.phone || ''}`
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(term);
    });
  }, [currentList, search, statusFilter]);
  const openCollectionTotal = collections.reduce((totalCents, item) => totalCents + Math.round(Number(item.amount || 0) * 100), 0) / 100;
  const currentGoal = goals[month] || EMPTY_GOAL;
  const storeName = profile?.storeName || profile?.name || userProfile?.storeName || 'Registro de Vendas';

  const saveGoals = async draft => {
    setGoalSaving(true);
    setGoalError('');
    const normalized = normalizeCommercialGoals({ ...goals, [month]: draft });
    const savedLocally = writeLocalGoals(userId, normalized);
    setGoals(normalized);
    try {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'profile', 'info'), {
        commercialGoals: normalized,
        commercialGoalsUpdatedAt: serverTimestamp()
      });
      setGoalEditorOpen(false);
      setNotice('Metas atualizadas.');
    } catch (error) {
      console.warn('Metas salvas localmente; sincronização pendente:', error);
      if (savedLocally) {
        setGoalEditorOpen(false);
        setNotice('Metas salvas neste aparelho. A sincronização será tentada novamente depois.');
      } else {
        setGoalError('Não foi possível salvar. Verifique a conexão e tente novamente.');
      }
    } finally {
      setGoalSaving(false);
    }
  };

  return h(React.Fragment, null,
    h('div', { className: 'commercial74-page' },
      h('header', { className: 'page-heading commercial74-page-heading' },
        h('div', { className: 'page-heading-copy' },
          h('span', { className: 'commercial74-eyebrow' }, 'Relacionamento e crescimento'),
          h('h1', { className: 'page-title' }, 'Comercial'),
          h('p', { className: 'page-description' }, 'Transforme parcelas, histórico e metas em ações simples para vender e receber melhor.')
        )
      ),
      h('section', { className: 'commercial74-overview' },
        h('article', { className: 'commercial74-overview-card is-alert' },
          h('span', null, h(MessageCircle, { size: 18 }), 'Cobranças para agir'),
          h('strong', null, collections.length),
          h('p', null, `${formatCurrency(openCollectionTotal)} em parcelas abertas até os próximos 7 dias`)
        ),
        h('article', { className: 'commercial74-overview-card is-opportunity' },
          h('span', null, h(RefreshCw, { size: 18 }), 'Oportunidades de recompra'),
          h('strong', null, repurchases.length),
          h('p', null, 'Clientes no momento previsto de reposição do produto')
        ),
        h('article', { className: 'commercial74-overview-card is-goal' },
          h('span', null, h(TrendingUp, { size: 18 }), 'Meta de faturamento'),
          h('strong', null, goalResult.metrics[0]?.target > 0 ? `${Math.round(goalResult.metrics[0].percent)}%` : '—'),
          h('p', null, goalResult.metrics[0]?.target > 0
            ? `${formatCurrency(goalResult.metrics[0].actual)} de ${formatCurrency(goalResult.metrics[0].target)}`
            : 'Defina a meta do mês para acompanhar o avanço')
        )
      ),
      h('section', { className: 'commercial74-goals-section' },
        h('div', { className: 'commercial74-section-heading' },
          h('div', null,
            h('span', null, h(Target, { size: 17 }), 'Metas'),
            h('h2', null, firstUpper(monthLabel(month))),
            h('p', null, 'Resultados atualizados pelas vendas e cancelamentos registrados no sistema.')
          ),
          h('div', { className: 'commercial74-goal-tools' },
            h('input', { type: 'month', value: month, onChange: event => chooseGoalMonth(event.target.value), 'aria-label': 'Mês das metas' }),
            h('button', { type: 'button', onClick: () => { setGoalError(''); setGoalEditorOpen(true); } }, h(Edit3, { size: 16 }), 'Editar metas')
          )
        ),
        h('div', { className: 'commercial74-goals-grid' }, goalResult.metrics.map(metric => h(GoalCard, { key: metric.id, metric })))
      ),
      h('section', { className: 'commercial74-actions-section' },
        h('div', { className: 'commercial74-actions-tabs', role: 'tablist', 'aria-label': 'Ações comerciais' },
          h('button', { type: 'button', role: 'tab', 'aria-selected': section === 'collection', className: section === 'collection' ? 'is-active' : '', onClick: () => setSection('collection') },
            h(MessageCircle, { size: 18 }), 'Cobranças', h('span', null, collections.length)),
          h('button', { type: 'button', role: 'tab', 'aria-selected': section === 'repurchase', className: section === 'repurchase' ? 'is-active' : '', onClick: () => setSection('repurchase') },
            h(RefreshCw, { size: 18 }), 'Recompra', h('span', null, repurchases.length))
        ),
        h('div', { className: 'commercial74-actions-copy' },
          h('div', null,
            h('h2', null, section === 'collection' ? 'Régua de cobrança' : 'Sugestões de recompra'),
            h('p', null, section === 'collection'
              ? 'Parcelas vencidas, de hoje e dos próximos 7 dias, prontas para enviar no WhatsApp.'
              : 'Oportunidades calculadas pelo último produto comprado e seu ciclo de recompra. O padrão é 60 dias.')
          ),
          h('label', { className: 'commercial74-search' },
            h(Search, { size: 17 }),
            h('input', { value: search, onChange: event => setSearch(event.target.value), placeholder: 'Buscar cliente ou produto', 'aria-label': 'Buscar ações comerciais' })
          )
        ),
        h(StatusPills, { value: statusFilter, onChange: setStatusFilter, counts }),
        notice && h('div', { className: 'commercial74-notice', role: 'status' }, h(Check, { size: 16 }), notice),
        h('div', { className: 'commercial74-list' },
          visibleRows.length
            ? visibleRows.map(entry => h(CommercialRow, {
                key: entry.id, entry, kind: section, storeName, pixKey: profile?.pixKey, onNotice: setNotice
              }))
            : h(EmptyActions, { kind: section, hasSearch: !!search || statusFilter !== 'all' })
        ),
        section === 'repurchase' && h('p', { className: 'commercial74-cycle-note' },
          'Dica: no cadastro do produto, ajuste “Recompra (dias)” conforme a duração real. Use 0 para desativar a sugestão daquele produto.')
      )
    ),
    h(GoalEditor, {
      open: goalEditorOpen, month, value: currentGoal, saving: goalSaving, error: goalError,
      onClose: () => { if (!goalSaving) setGoalEditorOpen(false); }, onSave: saveGoals
    })
  );
};
