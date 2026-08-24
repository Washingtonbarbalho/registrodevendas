const replaceRequired = (source, marker, replacement, label) => {
  if (!source.includes(marker)) throw new Error(`Não foi possível preparar ${label}.`);
  return source.replace(marker, replacement);
};

export const applyBackupPatch = source => {
  const commercialImport = "import { AbaComercial } from './aba-comercial-v74.js';";
  source = replaceRequired(
    source,
    commercialImport,
    `${commercialImport}\nimport { AbaBackup, BackupAutoSnapshot } from './aba-backup-v75.js';`,
    'o módulo de backup'
  );

  const ratesNavigation = "        { id: 'rates', label: 'Taxas e juros', shortLabel: 'Taxas', icon: BadgePercent }";
  source = replaceRequired(
    source,
    ratesNavigation,
    "        { id: 'backup', label: 'Backup e dados', shortLabel: 'Backup', icon: ShieldCheck },\n" + ratesNavigation,
    'a navegação de backup'
  );

  const financeRender = "                    : view === 'finance' ? React.createElement(AbaFinanceiro, {";
  source = replaceRequired(source, financeRender, `                    : view === 'backup' ? React.createElement(AbaBackup, {
                        userId: user.uid,
                        userEmail: user.email,
                        userProfile,
                        sales,
                        products,
                        customers
                    })
                    : view === 'finance' ? React.createElement(AbaFinanceiro, {`, 'a tela de backup');

  const shellStart = `    return React.createElement('div', { className: "app-shell" },`;
  source = replaceRequired(source, shellStart, `${shellStart}
        React.createElement(BackupAutoSnapshot, {
            ready: !loadingData,
            userId: user.uid,
            userEmail: user.email,
            userProfile,
            sales,
            products,
            customers
        }),`, 'os backups locais automáticos');

  return source;
};
