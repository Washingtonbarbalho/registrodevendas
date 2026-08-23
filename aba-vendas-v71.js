import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.2.0';
import {
  ArrowDownUp, Banknote, CalendarDays, CheckCircle2, ChevronRight, CreditCard,
  Plus, Receipt, RotateCcw, Search, SlidersHorizontal, WalletCards, X, XCircle
} from 'https://esm.sh/lucide-react@0.292.0';
import { Pagination } from './components.js?v=71';
import { formatCurrency, formatDate, getCurrentMonthEnd, getCurrentMonthStart } from './utils.js?v=71';
import {
  buildSalesView,
  getNextOpenDueDate,
  getOperationalSaleStatus,
  getOperationalSaleType,
  getSalePaymentLabel,
  getSalePendingAmount,
  SALES_VIEW_DEFAULTS,
  summarizeSalesView
} from './sales-operations-v71.js?v=71';
import { getDirectSaleNet } from './financial-core-v70.js?v=71';

const ITEMS_PER_PAGE = 12;

const formatSaleMoment = sale => {
  const date = sale?.saleDate || sale?.saleDateTime;
  let time = '--:--';
  if (sale?.saleDateTime) {
    const parsed = new Date(sale.saleDateTime);
    if (!Number.isNaN(parsed.getTime())) time = parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return `${formatDate(date)} · ${time}`;
};

const statusPresentation = sale => {
  const status = getOperationalSaleStatus(sale);
  if (status === 'canceled') return { label: 'Cancelada', className: 'status-canceled', icon: XCircle };
  if (status === 'completed' && getOperationalSaleType(sale) === 'term') return { label: 'Quitada', className: 'status-paid', icon: CheckCircle2 };
  if (status === 'completed') return { label: 'Recebida', className: 'status-paid', icon: CheckCircle2 };
  return { label: 'Em aberto', className: 'status-open', icon: Receipt };
};

const TypeTabs = ({ value, onChange, summary }) => {
  const options = [
    ['all', 'Todas', summary.count],
    ['direct', 'No caixa', summary.directCount],
    ['term', 'A prazo', summary.termCount]
  ];
  return React.createElement('div', { className: 'sales-type-tabs', role: 'tablist', 'aria-label': 'Tipo de venda' },
    options.map(([id, label, count]) => React.createElement('button', {
      key: id,
      type: 'button',
      role: 'tab',
      'aria-selected': value === id,
      onClick: () => onChange(id),
      className: `sales-type-tab ${value === id ? 'is-active' : ''}`
    }, React.createElement('span', null, label), React.createElement('strong', null, count)))
  );
};

const SaleRow = ({ sale, onOpen }) => {
  const type = getOperationalSaleType(sale);
  const status = statusPresentation(sale);
  const StatusIcon = status.icon;
  const pending = getSalePendingAmount(sale);
  const net = getDirectSaleNet(sale);
  const installments = Array.isArray(sale?.installments) ? sale.installments : [];
  const paidCount = installments.filter(item => item?.paid).length;
  const totalInstallments = Number(sale?.installmentsCount) || installments.length || 0;
  const nextDue = getNextOpenDueDate(sale);
  const canceled = getOperationalSaleStatus(sale) === 'canceled';
  const customer = sale?.customerName || 'Venda avulsa';

  return React.createElement('button', {
    type: 'button',
    onClick: () => onOpen(sale),
    className: `sales-unified-row ${canceled ? 'is-canceled' : ''}`,
    'aria-label': `Abrir venda de ${customer}`
  },
    React.createElement('div', { className: 'sales-row-main' },
      React.createElement('div', { className: 'sales-row-title-line' },
        React.createElement('p', { className: 'sales-row-title' }, customer),
        React.createElement('span', { className: `sales-kind-badge ${type === 'direct' ? 'is-direct' : 'is-term'}` },
          type === 'direct' ? React.createElement(WalletCards, { size: 12 }) : React.createElement(Receipt, { size: 12 }),
          type === 'direct' ? 'No caixa' : 'A prazo'
        )
      ),
      React.createElement('p', { className: 'sales-row-subtitle' }, formatSaleMoment(sale)),
      React.createElement('div', { className: 'sales-row-mobile-badges' },
        React.createElement('span', { className: `status-badge ${status.className}` }, React.createElement(StatusIcon, { size: 12 }), status.label),
        React.createElement('span', { className: 'status-badge status-neutral' }, getSalePaymentLabel(sale))
      )
    ),
    React.createElement('div', { className: 'sales-row-type' },
      React.createElement('span', { className: `sales-kind-badge ${type === 'direct' ? 'is-direct' : 'is-term'}` },
        type === 'direct' ? React.createElement(CreditCard, { size: 13 }) : React.createElement(Receipt, { size: 13 }),
        getSalePaymentLabel(sale)
      )
    ),
    React.createElement('div', { className: 'sales-row-money' },
      React.createElement('span', null, 'Total'),
      React.createElement('strong', null, formatCurrency(sale?.totalPrice))
    ),
    React.createElement('div', { className: 'sales-row-money is-highlight' },
      React.createElement('span', null, type === 'direct' ? 'Líquido' : 'Saldo'),
      React.createElement('strong', { className: canceled ? 'is-muted' : '' }, formatCurrency(type === 'direct' ? net : pending)),
      type === 'term' && React.createElement('small', null,
        nextDue ? `Próxima ${formatDate(nextDue)}` : totalInstallments > 0 ? `${paidCount}/${totalInstallments} pagas` : 'Sem parcelas'
      )
    ),
    React.createElement('div', { className: 'sales-row-status' },
      React.createElement('span', { className: `status-badge ${status.className}` }, React.createElement(StatusIcon, { size: 12 }), status.label)
    ),
    React.createElement(ChevronRight, { size: 18, className: 'sales-row-arrow' })
  );
};

export const AbaVendas = ({ sales, setNewSaleMode, setSelectedSaleDetail }) => {
  const [query, setQuery] = useState(SALES_VIEW_DEFAULTS.query);
  const [type, setType] = useState(SALES_VIEW_DEFAULTS.type);
  const [status, setStatus] = useState(SALES_VIEW_DEFAULTS.status);
  const [period, setPeriod] = useState(SALES_VIEW_DEFAULTS.period);
  const [sort, setSort] = useState(SALES_VIEW_DEFAULTS.sort);
  const [startDate, setStartDate] = useState(getCurrentMonthStart());
  const [endDate, setEndDate] = useState(getCurrentMonthEnd());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  const typeSummary = useMemo(() => summarizeSalesView(buildSalesView({
    sales,
    query,
    type: 'all',
    status,
    period,
    sort,
    startDate,
    endDate,
    currentStart: getCurrentMonthStart(),
    currentEnd: getCurrentMonthEnd()
  })), [sales, query, status, period, sort, startDate, endDate]);
  const filteredSales = useMemo(() => buildSalesView({
    sales,
    query,
    type,
    status,
    period,
    sort,
    startDate,
    endDate,
    currentStart: getCurrentMonthStart(),
    currentEnd: getCurrentMonthEnd()
  }), [sales, query, type, status, period, sort, startDate, endDate]);
  const filteredSummary = useMemo(() => summarizeSalesView(filteredSales), [filteredSales]);

  useEffect(() => setPage(1), [query, type, status, period, sort, startDate, endDate]);
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / ITEMS_PER_PAGE));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const paginated = filteredSales.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const advancedCount = Number(status !== SALES_VIEW_DEFAULTS.status)
    + Number(period !== SALES_VIEW_DEFAULTS.period)
    + Number(sort !== SALES_VIEW_DEFAULTS.sort);
  const hasFilters = !!query || type !== SALES_VIEW_DEFAULTS.type || advancedCount > 0;
  const resetFilters = () => {
    setQuery('');
    setType(SALES_VIEW_DEFAULTS.type);
    setStatus(SALES_VIEW_DEFAULTS.status);
    setPeriod(SALES_VIEW_DEFAULTS.period);
    setSort(SALES_VIEW_DEFAULTS.sort);
    setStartDate(getCurrentMonthStart());
    setEndDate(getCurrentMonthEnd());
  };

  return React.createElement('section', { className: 'page-stack sales-unified-page animate-fade-in' },
    React.createElement('div', { className: 'page-heading sales-unified-heading' },
      React.createElement('div', { className: 'page-heading-copy' },
        React.createElement('h2', { className: 'page-title' }, 'Vendas'),
        React.createElement('p', { className: 'page-description' }, 'Caixa e vendas a prazo no mesmo lugar, com acesso direto aos detalhes.')
      ),
      React.createElement('div', { className: 'sales-create-actions' },
        React.createElement('button', { type: 'button', onClick: () => setNewSaleMode('direct'), className: 'sales-create-button is-direct' },
          React.createElement(WalletCards, { size: 18 }), React.createElement('span', null, 'Venda no caixa')
        ),
        React.createElement('button', { type: 'button', onClick: () => setNewSaleMode('prazo'), className: 'sales-create-button is-term' },
          React.createElement(Plus, { size: 18 }), React.createElement('span', null, 'Venda a prazo')
        )
      )
    ),

    React.createElement('div', { className: 'sales-filter-panel' },
      React.createElement('div', { className: 'sales-search-line' },
        React.createElement('label', { className: 'sales-search-box' },
          React.createElement(Search, { size: 18 }),
          React.createElement('input', {
            type: 'search',
            value: query,
            onChange: event => setQuery(event.target.value),
            placeholder: 'Buscar cliente, produto, código ou pagamento...',
            'aria-label': 'Buscar vendas'
          }),
          query && React.createElement('button', { type: 'button', onClick: () => setQuery(''), 'aria-label': 'Limpar busca' }, React.createElement(X, { size: 16 }))
        ),
        React.createElement('button', {
          type: 'button',
          onClick: () => setFiltersOpen(open => !open),
          className: `sales-filter-toggle ${filtersOpen || advancedCount ? 'is-active' : ''}`,
          'aria-expanded': filtersOpen
        }, React.createElement(SlidersHorizontal, { size: 17 }), React.createElement('span', null, 'Filtros'), advancedCount > 0 && React.createElement('strong', null, advancedCount))
      ),

      React.createElement(TypeTabs, { value: type, onChange: setType, summary: typeSummary }),

      filtersOpen && React.createElement('div', { className: 'sales-advanced-filters animate-fade-in' },
        React.createElement('label', { className: 'sales-filter-field' },
          React.createElement('span', null, 'Status'),
          React.createElement('select', { value: status, onChange: event => setStatus(event.target.value) },
            React.createElement('option', { value: 'all' }, 'Todos os status'),
            React.createElement('option', { value: 'open' }, 'Em aberto'),
            React.createElement('option', { value: 'completed' }, 'Recebidas / quitadas'),
            React.createElement('option', { value: 'canceled' }, 'Canceladas')
          )
        ),
        React.createElement('label', { className: 'sales-filter-field' },
          React.createElement('span', null, 'Período'),
          React.createElement('select', { value: period, onChange: event => setPeriod(event.target.value) },
            React.createElement('option', { value: 'current' }, 'Mês atual + pendências'),
            React.createElement('option', { value: 'all' }, 'Todo o histórico'),
            React.createElement('option', { value: 'custom' }, 'Período personalizado')
          )
        ),
        React.createElement('label', { className: 'sales-filter-field' },
          React.createElement('span', null, 'Ordenar'),
          React.createElement('div', { className: 'sales-select-with-icon' },
            React.createElement(ArrowDownUp, { size: 14 }),
            React.createElement('select', { value: sort, onChange: event => setSort(event.target.value) },
              React.createElement('option', { value: 'priority' }, 'Prioridade de cobrança'),
              React.createElement('option', { value: 'recent' }, 'Mais recentes'),
              React.createElement('option', { value: 'oldest' }, 'Mais antigas'),
              React.createElement('option', { value: 'value' }, 'Maior valor')
            )
          )
        ),
        period === 'custom' && React.createElement(React.Fragment, null,
          React.createElement('label', { className: 'sales-filter-field' },
            React.createElement('span', null, 'Data inicial'),
            React.createElement('div', { className: 'sales-select-with-icon' }, React.createElement(CalendarDays, { size: 14 }), React.createElement('input', { type: 'date', value: startDate, onChange: event => setStartDate(event.target.value) }))
          ),
          React.createElement('label', { className: 'sales-filter-field' },
            React.createElement('span', null, 'Data final'),
            React.createElement('div', { className: 'sales-select-with-icon' }, React.createElement(CalendarDays, { size: 14 }), React.createElement('input', { type: 'date', value: endDate, onChange: event => setEndDate(event.target.value) }))
          )
        )
      ),

      React.createElement('div', { className: 'sales-filter-result' },
        React.createElement('div', null,
          React.createElement('strong', null, `${filteredSummary.count} ${filteredSummary.count === 1 ? 'venda' : 'vendas'}`),
          React.createElement('span', null, period === 'current' ? 'Mês atual e pendências anteriores' : period === 'all' ? 'Todo o histórico' : `${formatDate(startDate)} a ${formatDate(endDate)}`)
        ),
        filteredSummary.openCount > 0 && React.createElement('div', { className: 'sales-pending-summary' },
          React.createElement(Receipt, { size: 15 }), React.createElement('span', null, `${filteredSummary.openCount} em aberto · ${formatCurrency(filteredSummary.pendingAmount)}`)
        ),
        hasFilters && React.createElement('button', { type: 'button', onClick: resetFilters, className: 'sales-reset-button' }, React.createElement(RotateCcw, { size: 14 }), 'Limpar')
      )
    ),

    React.createElement('div', { className: 'sales-unified-list' },
      React.createElement('div', { className: 'sales-unified-list-header' },
        React.createElement('span', null, 'Cliente / data'),
        React.createElement('span', null, 'Tipo / pagamento'),
        React.createElement('span', null, 'Valor'),
        React.createElement('span', null, 'Recebido / saldo'),
        React.createElement('span', null, 'Status'),
        React.createElement('span', null, '')
      ),
      paginated.length === 0
        ? React.createElement('div', { className: 'empty-state sales-empty-state' },
          React.createElement('div', { className: 'empty-state-icon' }, React.createElement(Banknote, { size: 22 })),
          React.createElement('p', { className: 'empty-state-title' }, 'Nenhuma venda encontrada'),
          React.createElement('p', { className: 'empty-state-copy' }, hasFilters ? 'Ajuste ou limpe os filtros para ampliar a busca.' : 'Sua próxima venda aparecerá aqui.'),
          hasFilters && React.createElement('button', { type: 'button', onClick: resetFilters, className: 'sales-empty-reset' }, 'Limpar filtros')
        )
        : paginated.map(sale => React.createElement(SaleRow, { key: sale.id, sale, onOpen: setSelectedSaleDetail }))
    ),

    React.createElement(Pagination, {
      totalItems: filteredSales.length,
      itemsPerPage: ITEMS_PER_PAGE,
      currentPage: page,
      onPageChange: setPage
    })
  );
};
