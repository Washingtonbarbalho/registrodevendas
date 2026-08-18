const replaceRequired = (source, marker, replacement, label) => {
  if (!source.includes(marker)) throw new Error(`Não foi possível preparar ${label}.`);
  return source.replace(marker, replacement);
};

export const applyReportsPatch = source => {
  const financeImport = "import { AbaFinanceiro } from './aba-financeiro-v54.js';";
  source = replaceRequired(
    source,
    financeImport,
    financeImport + "\nimport { AbaRelatorios } from './aba-relatorios-v63.js';",
    'o módulo dos Relatórios'
  );

  const ratesNav = "        { id: 'rates', label: 'Taxas e juros', shortLabel: 'Taxas', icon: BadgePercent }";
  source = replaceRequired(
    source,
    ratesNav,
    "        { id: 'reports', label: 'Relatórios', shortLabel: 'Relat.', icon: LayoutDashboard },\n" + ratesNav,
    'a navegação dos Relatórios'
  );

  const financeRender = "                    : view === 'finance' ? React.createElement(AbaFinanceiro, {";
  source = replaceRequired(
    source,
    financeRender,
    `                    : view === 'reports' ? React.createElement(AbaRelatorios, {
                        userId: user.uid,
                        sales,
                        products,
                        customers,
                        userProfile
                    })
                    : view === 'finance' ? React.createElement(AbaFinanceiro, {`,
    'a tela dos Relatórios'
  );

  return source;
};
