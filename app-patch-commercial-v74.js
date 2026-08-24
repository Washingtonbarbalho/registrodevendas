const replaceRequired = (source, marker, replacement, label) => {
  if (!source.includes(marker)) throw new Error(`Não foi possível preparar ${label}.`);
  return source.replace(marker, replacement);
};

export const applyCommercialPatch = source => {
  const reportsImport = "import { AbaRelatorios } from './aba-relatorios-v65.js';";
  source = replaceRequired(
    source,
    reportsImport,
    `${reportsImport}\nimport { AbaComercial } from './aba-comercial-v74.js';`,
    'o módulo Comercial'
  );

  const reportsNavigation = "        { id: 'reports', label: 'Relatórios', shortLabel: 'Relat.', icon: LayoutDashboard },";
  source = replaceRequired(
    source,
    reportsNavigation,
    "        { id: 'commercial', label: 'Comercial', shortLabel: 'Comercial', icon: Store },\n" + reportsNavigation,
    'a navegação Comercial'
  );

  const reportsRender = "                    : view === 'reports' ? React.createElement(AbaRelatorios, {";
  source = replaceRequired(source, reportsRender, `                    : view === 'commercial' ? React.createElement(AbaComercial, {
                        userId: user.uid,
                        sales,
                        products,
                        customers,
                        userProfile
                    })
                    : view === 'reports' ? React.createElement(AbaRelatorios, {`, 'a tela Comercial');

  return source;
};
