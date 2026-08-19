const replaceRequired = (source, marker, replacement, label) => {
  if (!source.includes(marker)) throw new Error(`Não foi possível preparar ${label}.`);
  return source.replace(marker, replacement);
};

export const applyMobileMenuPatch = source => {
  const viewState = "    const [view, setView] = useState('dashboard');";
  source = replaceRequired(
    source,
    viewState,
    `${viewState}\n    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);`,
    'o estado do menu mobile'
  );

  const adminState = "    const [showAdminPanel, setShowAdminPanel] = useState(false);";
  const mobileMenuEffects = `${adminState}

    useEffect(() => {
        if (!mobileMenuOpen) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const closeOnEscape = event => {
            if (event.key === 'Escape') setMobileMenuOpen(false);
        };
        const closeOnDesktop = () => {
            if (window.innerWidth >= 1024) setMobileMenuOpen(false);
        };
        window.addEventListener('keydown', closeOnEscape);
        window.addEventListener('resize', closeOnDesktop);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', closeOnEscape);
            window.removeEventListener('resize', closeOnDesktop);
        };
    }, [mobileMenuOpen]);`;
  source = replaceRequired(source, adminState, mobileMenuEffects, 'o comportamento de fechamento do menu mobile');

  const headerMarker = `            React.createElement('header', { className: "app-topbar" },`;
  const headerIndex = source.indexOf(headerMarker);
  if (headerIndex < 0) throw new Error('Não foi possível localizar o cabeçalho do aplicativo.');

  const titleDivMarker = `                React.createElement('div', { className: "min-w-0" },`;
  const titleIndex = source.indexOf(titleDivMarker, headerIndex + headerMarker.length);
  if (titleIndex < 0) throw new Error('Não foi possível localizar o título do cabeçalho mobile.');

  const leadingBlock = `                React.createElement('div', { className: "app-topbar-leading" },
                    React.createElement('button', {
                        type: "button",
                        onClick: () => setMobileMenuOpen(open => !open),
                        className: \`mobile-menu-toggle \${mobileMenuOpen ? 'is-open' : ''}\`,
                        'aria-label': mobileMenuOpen ? "Fechar menu" : "Abrir menu",
                        'aria-expanded': mobileMenuOpen,
                        'aria-controls': "mobile-navigation-drawer"
                    },
                        React.createElement('span', { className: "mobile-menu-lines", 'aria-hidden': "true" },
                            React.createElement('span', null),
                            React.createElement('span', null),
                            React.createElement('span', null)
                        )
                    ),
                    React.createElement('div', { className: "min-w-0" },`;
  source = source.slice(0, titleIndex) + leadingBlock + source.slice(titleIndex + titleDivMarker.length);

  const actionsMarker = `                React.createElement('div', { className: "flex items-center gap-2" },`;
  const actionsIndex = source.indexOf(actionsMarker, headerIndex);
  if (actionsIndex < 0) throw new Error('Não foi possível localizar as ações do cabeçalho.');
  source = source.slice(0, actionsIndex) + `                ),\n` + source.slice(actionsIndex);

  const mainMarker = `            React.createElement('main', { className: "app-content" },`;
  const mainIndex = source.indexOf(mainMarker, headerIndex);
  if (mainIndex < 0) throw new Error('Não foi possível localizar o conteúdo principal para inserir o menu mobile.');

  const drawerBlock = `            mobileMenuOpen && React.createElement('div', {
                className: "mobile-menu-backdrop",
                onClick: () => setMobileMenuOpen(false),
                role: "presentation"
            },
                React.createElement('aside', {
                    id: "mobile-navigation-drawer",
                    className: "mobile-menu-drawer",
                    role: "dialog",
                    'aria-modal': "true",
                    'aria-label': "Menu de navegação",
                    onClick: event => event.stopPropagation()
                },
                    React.createElement('div', { className: "mobile-menu-header" },
                        React.createElement('div', { className: "mobile-menu-brand" },
                            React.createElement('div', { className: "mobile-menu-brand-mark" }, React.createElement(Store, { size: 21 })),
                            React.createElement('div', { className: "min-w-0" },
                                React.createElement('p', { className: "mobile-menu-store-name truncate" }, userProfile?.storeName || "Registro de Vendas"),
                                React.createElement('p', { className: "mobile-menu-caption" }, "Menu principal")
                            )
                        ),
                        React.createElement('button', {
                            type: "button",
                            onClick: () => setMobileMenuOpen(false),
                            className: "mobile-menu-close",
                            'aria-label': "Fechar menu"
                        }, "×")
                    ),
                    React.createElement('nav', { className: "mobile-menu-nav", 'aria-label': "Navegação mobile" },
                        navItems.map(item => React.createElement('button', {
                            key: item.id,
                            type: "button",
                            onClick: () => { setView(item.id); setMobileMenuOpen(false); },
                            className: \`mobile-menu-nav-button \${view === item.id ? 'is-active' : ''}\`
                        },
                            React.createElement('span', { className: "mobile-menu-nav-icon" }, React.createElement(item.icon, { size: 20 })),
                            React.createElement('span', { className: "mobile-menu-nav-label" }, item.label),
                            view === item.id && React.createElement('span', { className: "mobile-menu-current-dot", 'aria-label': "Aba atual" })
                        ))
                    ),
                    React.createElement('div', { className: "mobile-menu-footer" },
                        React.createElement('div', { className: "mobile-menu-user" },
                            React.createElement('div', { className: "mobile-menu-user-avatar" }, React.createElement(User, { size: 17 })),
                            React.createElement('div', { className: "min-w-0" },
                                React.createElement('p', { className: "mobile-menu-user-name truncate" }, userProfile?.name || "Usuário"),
                                React.createElement('p', { className: "mobile-menu-user-email truncate" }, user.email)
                            )
                        )
                    )
                )
            ),

`;
  source = source.slice(0, mainIndex) + drawerBlock + source.slice(mainIndex);

  const bottomNavStartMarker = `        React.createElement('nav', { className: "mobile-bottom-nav", 'aria-label': "Navegação principal" },`;
  const bottomNavStart = source.indexOf(bottomNavStartMarker);
  if (bottomNavStart < 0) throw new Error('Não foi possível localizar a navegação inferior antiga.');
  const firstModalMarker = `        React.createElement(UserProfileModal, {`;
  const firstModalIndex = source.indexOf(firstModalMarker, bottomNavStart);
  if (firstModalIndex < 0) throw new Error('Não foi possível delimitar a navegação inferior antiga.');
  source = source.slice(0, bottomNavStart) + source.slice(firstModalIndex);

  return source;
};
