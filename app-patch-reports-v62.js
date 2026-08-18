const replaceRequired = (source, marker, replacement, label) => {
  if (!source.includes(marker)) throw new Error(`Não foi possível preparar ${label}.`);
  return source.replace(marker, replacement);
};

export const applyReportsPatch = source => {
  const iconImport = "import { Users, User, LogOut, Lock, LayoutDashboard, Receipt, WalletCards, Package, Contact, Store, ShieldCheck, BadgePercent, Banknote } from 'https://esm.sh/lucide-react@0.292.0';";
  source = replaceRequired(
    source,
    iconImport,
    "import { Users, User, LogOut, Lock, LayoutDashboard, Receipt, WalletCards, Package, Contact, Store, ShieldCheck, BadgePercent, Banknote, FileBarChart } from 'https://esm.sh/lucide-react@0.292.0';",
    'o ícone dos Relatórios'
  );

  const financeImport = "import { AbaFinanceiro } from './aba-financeiro-v54.js';";
  source = replaceRequired(
    source,
    financeImport,
    financeImport + "\nimport { AbaRelatorios } from './aba-relatorios-v62.js';",
    'o módulo dos Relatórios'
  );

  const ratesNav = "        { id: 'rates', label: 'Taxas e juros', shortLabel: 'Taxas', icon: BadgePercent }";
  source = replaceRequired(
    source,
    ratesNav,
    "        { id: 'reports', label: 'Relatórios', shortLabel: 'Relat.', icon: FileBarChart },\n" + ratesNav,
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
