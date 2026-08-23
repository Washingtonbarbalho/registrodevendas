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

  const mobileState = "    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);";
  source = replaceRequired(
    source,
    mobileState,
    `${mobileState}\n    const [quickSaleMenuOpen, setQuickSaleMenuOpen] = useState(false);`,
    'o atalho mobile de nova venda'
  );

  const mobileMenuEffectEnd = "    }, [mobileMenuOpen]);\n    const [customers, setCustomers] = useState([]);";
  source = replaceRequired(source, mobileMenuEffectEnd, `    }, [mobileMenuOpen]);

    useEffect(() => {
        if (!quickSaleMenuOpen) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const closeQuickSale = event => {
            if (event.key === 'Escape') setQuickSaleMenuOpen(false);
        };
        window.addEventListener('keydown', closeQuickSale);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', closeQuickSale);
        };
    }, [quickSaleMenuOpen]);
    const [customers, setCustomers] = useState([]);`, 'o fechamento seguro do atalho de venda');

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
    const mobilePrimaryNav = ['dashboard', 'sales', 'products', 'finance']
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
                        setSelectedSaleDetail
                    })
`;
  source = source.slice(0, salesStart) + unifiedSalesRender + source.slice(productsStart);

  const firstModal = "        React.createElement(UserProfileModal, { isOpen: profileModalOpen,";
  const quickNavigation = `        React.createElement('nav', { className: "mobile-quick-nav", 'aria-label': "Acessos rápidos" },
            mobilePrimaryNav.slice(0, 2).map(item => React.createElement('button', {
                key: item.id,
                type: "button",
                onClick: () => { setView(item.id); setMobileMenuOpen(false); setQuickSaleMenuOpen(false); },
                className: \`mobile-quick-nav-button \${view === item.id ? 'is-active' : ''}\`
            }, React.createElement(item.icon, { size: 19 }), React.createElement('span', null, item.shortLabel))),
            React.createElement('button', {
                type: "button",
                onClick: () => { setQuickSaleMenuOpen(true); setMobileMenuOpen(false); },
                className: "mobile-quick-sale-button",
                'aria-label': "Registrar nova venda"
            }, React.createElement('span', { className: "mobile-quick-sale-icon" }, React.createElement(Plus, { size: 23 })), React.createElement('span', null, "Nova")),
            mobilePrimaryNav.slice(2).map(item => React.createElement('button', {
                key: item.id,
                type: "button",
                onClick: () => { setView(item.id); setMobileMenuOpen(false); setQuickSaleMenuOpen(false); },
                className: \`mobile-quick-nav-button \${view === item.id ? 'is-active' : ''}\`
            }, React.createElement(item.icon, { size: 19 }), React.createElement('span', null, item.id === 'finance' ? 'Financeiro' : item.shortLabel)))
        ),

        quickSaleMenuOpen && React.createElement('div', {
            className: "quick-sale-backdrop",
            onClick: () => setQuickSaleMenuOpen(false),
            role: "presentation"
        },
            React.createElement('section', {
                className: "quick-sale-sheet",
                role: "dialog",
                'aria-modal': "true",
                'aria-labelledby': "quick-sale-title",
                onClick: event => event.stopPropagation()
            },
                React.createElement('div', { className: "quick-sale-sheet-heading" },
                    React.createElement('div', null,
                        React.createElement('h2', { id: "quick-sale-title" }, "Qual venda deseja registrar?"),
                        React.createElement('p', null, "Escolha o tipo para abrir o formulário correto.")
                    ),
                    React.createElement('button', { type: "button", onClick: () => setQuickSaleMenuOpen(false), 'aria-label': "Fechar" }, "×")
                ),
                React.createElement('div', { className: "quick-sale-options" },
                    React.createElement('button', {
                        type: "button",
                        className: "quick-sale-option is-direct",
                        onClick: () => { setQuickSaleMenuOpen(false); setNewSaleMode('direct'); }
                    }, React.createElement('span', null, React.createElement(WalletCards, { size: 23 })), React.createElement('strong', null, "Venda no caixa"), React.createElement('small', null, "PIX, dinheiro ou cartão")),
                    React.createElement('button', {
                        type: "button",
                        className: "quick-sale-option is-term",
                        onClick: () => { setQuickSaleMenuOpen(false); setNewSaleMode('prazo'); }
                    }, React.createElement('span', null, React.createElement(Receipt, { size: 23 })), React.createElement('strong', null, "Venda a prazo"), React.createElement('small', null, "Entrada e parcelas"))
                )
            )
        ),

`;
  source = replaceRequired(source, firstModal, quickNavigation + firstModal, 'a barra mobile e o atalho de venda');

  return source;
};
