const replaceRequired = (source, marker, replacement, label) => {
  if (!source.includes(marker)) throw new Error(`Não foi possível preparar ${label}.`);
  return source.replace(marker, replacement);
};

const removeRequiredBlock = (source, startMarker, endMarker, label) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Não foi possível simplificar ${label}.`);
  return source.slice(0, start) + source.slice(end);
};

export const applyOperationsPatch = source => {
  const iconImport = "import { Users, User, LogOut, Lock, LayoutDashboard, Receipt, WalletCards, Package, Contact, Store, ShieldCheck, BadgePercent, Banknote } from 'https://esm.sh/lucide-react@0.292.0';";
  source = replaceRequired(
    source,
    iconImport,
    "import { Users, User, LogOut, Lock, LayoutDashboard, Receipt, WalletCards, Package, Contact, Store, ShieldCheck, BadgePercent, Banknote, Plus } from 'https://esm.sh/lucide-react@0.292.0';",
    'os atalhos operacionais'
  );

  const authImport = "import { AuthScreen, AdminUsersPanel } from './auth-admin.js';";
  source = replaceRequired(
    source,
    authImport,
    "import { AdminUsersPanel } from './auth-admin.js';\nimport { AuthScreen } from './auth-screen-v71.js';",
    'o login simplificado'
  );

  const oldSalesImports = "import { AbaVendasPrazo } from './aba-vendas-prazo.js';\nimport { AbaVendasCaixa } from './aba-vendas-caixa.js?v=4';";
  source = replaceRequired(
    source,
    oldSalesImports,
    "import { AbaVendas } from './aba-vendas-v71.js';",
    'a área única de vendas'
  );

  source = replaceRequired(source,
    "    const [salesPage, setSalesPage] = useState(1);\n    const [cashierPage, setCashierPage] = useState(1);\n",
    '',
    'a paginação duplicada das vendas'
  );
  source = replaceRequired(source,
    "    const [salesPeriod, setSalesPeriod] = useState('month');\n    const [salesStart, setSalesStart] = useState(getCurrentMonthStart());\n    const [salesEnd, setSalesEnd] = useState(getCurrentMonthEnd());\n\n    const [cashierPeriod, setCashierPeriod] = useState('month');\n    const [cashierStart, setCashierStart] = useState(getCurrentMonthStart());\n    const [cashierEnd, setCashierEnd] = useState(getCurrentMonthEnd());\n\n",
    '',
    'os períodos duplicados das vendas'
  );
  source = replaceRequired(source,
    "    const [salesSearch, setSalesSearch] = useState('');\n    const [cashierSearch, setCashierSearch] = useState('');\n",
    '',
    'as buscas duplicadas das vendas'
  );
  source = replaceRequired(source,
    "    useEffect(() => { if (salesPeriod === 'month') { setSalesStart(getCurrentMonthStart()); setSalesEnd(getCurrentMonthEnd()); } }, [salesPeriod]);\n    useEffect(() => { if (cashierPeriod === 'month') { setCashierStart(getCurrentMonthStart()); setCashierEnd(getCurrentMonthEnd()); } }, [cashierPeriod]);\n\n    useEffect(() => setSalesPage(1), [salesSearch, salesPeriod, salesStart, salesEnd]);\n    useEffect(() => setCashierPage(1), [cashierSearch, cashierPeriod, cashierStart, cashierEnd]);\n",
    '',
    'os efeitos duplicados das vendas'
  );

  source = removeRequiredBlock(
    source,
    '    const displayedSales = useMemo(() => {',
    '    const dashboardTotals = useMemo(() => {',
    'os cálculos antigos das duas listas de vendas'
  );

  source = replaceRequired(source,
    "    const paginatedSales = getPaginatedData(displayedSales, salesPage);\n    const paginatedCashier = getPaginatedData(directSales, cashierPage);\n",
    '',
    'as listas paginadas duplicadas'
  );

  source = replaceRequired(source,
    "        { id: 'sales', label: 'Vendas a prazo', shortLabel: 'A prazo', icon: Receipt },\n        { id: 'cashier', label: 'Vendas no caixa', shortLabel: 'Caixa', icon: WalletCards },",
    "        { id: 'sales', label: 'Vendas', shortLabel: 'Vendas', icon: Receipt },",
    'a navegação única de vendas'
  );

  const currentNav = "    const currentNav = navItems.find(item => item.id === view) || navItems[0];";
  source = replaceRequired(source, currentNav, `${currentNav}
    const mobilePrimaryNav = ['dashboard', 'sales', 'products', 'customers']
        .map(id => navItems.find(item => item.id === id))
        .filter(Boolean);`, 'os destinos rápidos do celular');

  const salesRenderStart = "                    : view === 'sales' ? React.createElement(AbaVendasPrazo, {";
  const productsRender = "                    : view === 'products' ? React.createElement(AbaProdutos, {";
  const salesStart = source.indexOf(salesRenderStart);
  const productsStart = source.indexOf(productsRender, salesStart + salesRenderStart.length);
  if (salesStart < 0 || productsStart < 0) throw new Error('Não foi possível unificar a renderização das vendas.');
  const unifiedSalesRender = `                    : view === 'sales' ? React.createElement(AbaVendas, {
                        sales,
                        setNewSaleMode,
                        setSelectedSaleDetail,
                        analysisPeriod: dashPeriod,
                        analysisStartDate: dashStartDate,
                        analysisEndDate: dashEndDate,
                        onAnalysisPeriodChange: setDashPeriod,
                        onAnalysisStartDateChange: setDashStartDate,
                        onAnalysisEndDateChange: setDashEndDate
                    })
`;
  source = source.slice(0, salesStart) + unifiedSalesRender + source.slice(productsStart);

  const firstModal = "        React.createElement(UserProfileModal, { isOpen: profileModalOpen,";
  const quickNavigation = `        React.createElement('nav', { className: "mobile-quick-nav", 'aria-label': "Acessos rápidos" },
            mobilePrimaryNav.slice(0, 2).map(item => React.createElement('button', {
                key: item.id,
                type: "button",
                onClick: () => { setView(item.id); setMobileMenuOpen(false); },
                className: \`mobile-quick-nav-button \${view === item.id ? 'is-active' : ''}\`
            }, React.createElement(item.icon, { size: 19 }), React.createElement('span', null, item.shortLabel))),
            React.createElement('button', {
                type: "button",
                onClick: () => { setNewSaleMode('unified'); setMobileMenuOpen(false); },
                className: "mobile-quick-sale-button",
                'aria-label': "Registrar nova venda"
            }, React.createElement('span', { className: "mobile-quick-sale-icon" }, React.createElement(Plus, { size: 23 })), React.createElement('span', null, "Nova")),
            mobilePrimaryNav.slice(2).map(item => React.createElement('button', {
                key: item.id,
                type: "button",
                onClick: () => { setView(item.id); setMobileMenuOpen(false); },
                className: \`mobile-quick-nav-button \${view === item.id ? 'is-active' : ''}\`
            }, React.createElement(item.icon, { size: 19 }), React.createElement('span', null, item.shortLabel)))
        ),

`;
  source = replaceRequired(source, firstModal, quickNavigation + firstModal, 'a barra mobile e o atalho de venda');

  return source;
};
