import React, { useEffect, useRef, useState } from 'https://esm.sh/react@18.2.0';
import {
  AlertTriangle, Archive, CheckCircle2, Download, FileJson, HardDrive,
  RefreshCw, RotateCcw, ShieldCheck, Smartphone, Upload, WifiOff
} from 'https://esm.sh/lucide-react@0.292.0';
import { Timestamp, doc, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import {
  APP_ID,
  db,
  disableOfflineData,
  enableOfflineData,
  isOfflineDataEnabled,
  isOfflineDataRequested
} from './firebase-config.js';
import {
  MAX_BACKUP_FILE_BYTES,
  buildBackup,
  decodeBackupValue,
  getBackupFilename,
  serializeBackup,
  summarizeBackup,
  validateBackup
} from './backup-engine-v75.js';
import {
  LOCAL_BACKUP_LIMIT,
  clearLocalBackups,
  getLocalBackup,
  getLocalBackupStorageEstimate,
  listLocalBackups,
  saveLocalBackup
} from './backup-storage-v75.js';

const element = React.createElement;
const RESTORE_BATCH_SIZE = 400;

const formatBackupDate = value => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short'
  }).format(date);
};

const formatBytes = value => {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

const downloadBackup = backup => {
  const blob = new Blob([serializeBackup(backup)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = getBackupFilename(backup);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const decodeDocument = data => decodeBackupValue(data, {
  timestampFactory: iso => Timestamp.fromDate(new Date(iso)),
  dateFactory: iso => new Date(iso)
});

export const restoreBackupToFirestore = async ({
  backup,
  userId,
  firestore = db,
  appId = APP_ID,
  onProgress = () => {}
}) => {
  const { summary } = validateBackup(backup, { expectedAppId: appId, expectedOwnerUid: userId });
  const basePath = ['artifacts', appId, 'users', userId];
  const operations = [];
  const profileData = decodeDocument(backup.data.profile);
  operations.push({
    reference: doc(firestore, ...basePath, 'profile', 'info'),
    data: { ...profileData, updatedAt: serverTimestamp() }
  });

  for (const collectionName of ['products', 'customers', 'sales']) {
    for (const record of backup.data[collectionName]) {
      operations.push({
        reference: doc(firestore, ...basePath, collectionName, record.id),
        data: decodeDocument(record.data)
      });
    }
  }

  let completed = 0;
  for (let offset = 0; offset < operations.length; offset += RESTORE_BATCH_SIZE) {
    const batch = writeBatch(firestore);
    const chunk = operations.slice(offset, offset + RESTORE_BATCH_SIZE);
    chunk.forEach(operation => batch.set(operation.reference, operation.data, { merge: true }));
    await batch.commit();
    completed += chunk.length;
    onProgress({ completed, total: operations.length });
  }
  return summary;
};

const buildCurrentBackup = ({ userId, userEmail, userProfile, sales, products, customers }) => buildBackup({
  appId: APP_ID,
  userId,
  userEmail,
  userProfile,
  sales,
  products,
  customers
});

export const BackupAutoSnapshot = ({
  ready,
  userId,
  userEmail,
  userProfile,
  sales = [],
  products = [],
  customers = []
}) => {
  useEffect(() => {
    if (!ready || !userId || !isOfflineDataRequested()) return undefined;
    const timer = setTimeout(async () => {
      try {
        const backup = buildCurrentBackup({ userId, userEmail, userProfile, sales, products, customers });
        await saveLocalBackup(backup, 'automatic');
        globalThis.dispatchEvent?.(new CustomEvent('registro-vendas:backup-saved'));
      } catch (error) {
        console.warn('Não foi possível atualizar o backup local automático.', error);
      }
    }, 4_000);
    return () => clearTimeout(timer);
  }, [ready, userId, userEmail, userProfile, sales, products, customers]);
  return null;
};

const SummaryPills = ({ summary }) => element('div', { className: 'backup-summary-pills' },
  element('span', null, element('strong', null, summary.products), ' produtos'),
  element('span', null, element('strong', null, summary.customers), ' clientes'),
  element('span', null, element('strong', null, summary.sales), ' vendas')
);

const Notice = ({ notice }) => notice ? element('div', {
  className: `backup-notice is-${notice.type}`,
  role: notice.type === 'error' ? 'alert' : 'status'
}, notice.type === 'error'
  ? element(AlertTriangle, { size: 18 })
  : element(CheckCircle2, { size: 18 }),
notice.text) : null;

export const AbaBackup = ({
  userId,
  userEmail,
  userProfile = {},
  sales = [],
  products = [],
  customers = []
}) => {
  const fileInputRef = useRef(null);
  const [localBackups, setLocalBackups] = useState([]);
  const [storageEstimate, setStorageEstimate] = useState(null);
  const [pendingRestore, setPendingRestore] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(null);
  const offlineDataActive = isOfflineDataEnabled();
  const offlineDataRequested = isOfflineDataRequested();

  const refreshLocalBackups = async () => {
    try {
      const [snapshots, estimate] = await Promise.all([
        listLocalBackups(userId),
        getLocalBackupStorageEstimate().catch(() => null)
      ]);
      setLocalBackups(snapshots);
      setStorageEstimate(estimate);
    } catch (error) {
      setNotice({ type: 'error', text: error?.message || 'Não foi possível consultar os backups locais.' });
    }
  };

  useEffect(() => {
    refreshLocalBackups();
    const refresh = () => refreshLocalBackups();
    globalThis.addEventListener?.('registro-vendas:backup-saved', refresh);
    return () => globalThis.removeEventListener?.('registro-vendas:backup-saved', refresh);
  }, [userId]);

  const makeCurrentBackup = () => buildCurrentBackup({
    userId, userEmail, userProfile, sales, products, customers
  });

  const handleDownloadCurrent = async () => {
    setBusy('download');
    setNotice(null);
    try {
      const backup = makeCurrentBackup();
      validateBackup(backup, { expectedAppId: APP_ID, expectedOwnerUid: userId });
      if (isOfflineDataRequested()) await saveLocalBackup(backup, 'manual');
      downloadBackup(backup);
      await refreshLocalBackups();
      setNotice({ type: 'success', text: 'Backup conferido e baixado. Guarde o arquivo fora deste aparelho.' });
    } catch (error) {
      setNotice({ type: 'error', text: error?.message || 'Não foi possível gerar o backup.' });
    } finally {
      setBusy('');
    }
  };

  const handleFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy('file');
    setNotice(null);
    try {
      if (file.size > MAX_BACKUP_FILE_BYTES) throw new Error('O arquivo excede o limite de 50 MB.');
      const parsed = JSON.parse(await file.text());
      const { summary } = validateBackup(parsed, { expectedAppId: APP_ID, expectedOwnerUid: userId });
      setPendingRestore({ backup: parsed, summary, source: file.name });
      setNotice({ type: 'success', text: 'Arquivo validado. Confira o resumo antes de restaurar.' });
    } catch (error) {
      setPendingRestore(null);
      setNotice({ type: 'error', text: error instanceof SyntaxError ? 'O arquivo JSON está corrompido ou incompleto.' : (error?.message || 'Backup inválido.') });
    } finally {
      setBusy('');
    }
  };

  const handleChooseLocal = async record => {
    setBusy(record.key);
    setNotice(null);
    try {
      const backup = await getLocalBackup(record.key);
      const { summary } = validateBackup(backup, { expectedAppId: APP_ID, expectedOwnerUid: userId });
      setPendingRestore({ backup, summary, source: 'Cópia automática deste aparelho' });
      setNotice({ type: 'success', text: 'Cópia local validada. Confira o resumo antes de restaurar.' });
    } catch (error) {
      setNotice({ type: 'error', text: error?.message || 'Não foi possível abrir esta cópia.' });
    } finally {
      setBusy('');
    }
  };

  const handleDownloadLocal = async record => {
    setBusy(record.key);
    try {
      const backup = await getLocalBackup(record.key);
      validateBackup(backup, { expectedAppId: APP_ID, expectedOwnerUid: userId });
      downloadBackup(backup);
      setNotice({ type: 'success', text: 'Cópia local baixada com sucesso.' });
    } catch (error) {
      setNotice({ type: 'error', text: error?.message || 'Não foi possível baixar esta cópia.' });
    } finally {
      setBusy('');
    }
  };

  const handleRestore = async () => {
    if (!pendingRestore) return;
    if (!globalThis.navigator?.onLine) {
      setNotice({ type: 'error', text: 'Conecte-se à internet para restaurar. O uso normal continua disponível offline.' });
      return;
    }
    const confirmed = globalThis.confirm(
      `Restaurar ${pendingRestore.summary.total} registros? Os dados do backup serão mesclados aos atuais; nada será apagado.`
    );
    if (!confirmed) return;

    setBusy('restore');
    setProgress({ completed: 0, total: pendingRestore.summary.total + 1 });
    setNotice(null);
    try {
      const safetyBackup = makeCurrentBackup();
      if (isOfflineDataRequested()) await saveLocalBackup(safetyBackup, 'before-restore');
      else downloadBackup(safetyBackup);
      const summary = await restoreBackupToFirestore({
        backup: pendingRestore.backup,
        userId,
        onProgress: setProgress
      });
      setPendingRestore(null);
      await refreshLocalBackups();
      setNotice({
        type: 'success',
        text: `Restauração concluída: ${summary.products} produtos, ${summary.customers} clientes e ${summary.sales} vendas conferidos.`
      });
    } catch (error) {
      setNotice({
        type: 'error',
        text: `${error?.message || 'A restauração não foi concluída.'} Como a restauração apenas mescla registros, você pode repetir a operação com segurança.`
      });
    } finally {
      setBusy('');
      setProgress(null);
    }
  };

  const handleOfflinePreference = async () => {
    setNotice(null);
    if (offlineDataActive || offlineDataRequested) {
      const confirmed = globalThis.confirm('Desativar os dados offline e limpar a cópia local do Firestore neste aparelho?');
      if (!confirmed) return;
      setBusy('offline');
      try {
        await clearLocalBackups(userId);
        await disableOfflineData();
      } catch (error) {
        setBusy('');
        setNotice({ type: 'error', text: error?.message || 'Não foi possível limpar os dados offline.' });
      }
      return;
    }

    const confirmed = globalThis.confirm(
      'Este é um aparelho pessoal e protegido? Clientes, vendas e dados financeiros ficarão salvos neste navegador para uso offline.'
    );
    if (!confirmed) return;
    try {
      enableOfflineData();
    } catch (error) {
      setNotice({ type: 'error', text: error?.message || 'O navegador não permitiu ativar os dados offline.' });
    }
  };

  const currentSummary = summarizeBackup({ data: { products, customers, sales } });
  const storageText = storageEstimate?.quota
    ? `${formatBytes(storageEstimate.usage)} usados de ${formatBytes(storageEstimate.quota)} disponíveis no navegador`
    : 'Armazenamento protegido deste navegador';

  return element('section', { className: 'backup-page' },
    element('header', { className: 'backup-hero' },
      element('div', { className: 'backup-hero-icon' }, element(ShieldCheck, { size: 26 })),
      element('div', null,
        element('p', { className: 'backup-eyebrow' }, 'Segurança dos dados'),
        element('h1', null, 'Backup e restauração'),
        element('p', null, 'Cópias automáticas neste aparelho e arquivo JSON para guardar onde preferir.')
      )
    ),

    element(Notice, { notice }),

    element('article', { className: `backup-offline-card ${offlineDataActive ? 'is-active' : ''}` },
      element('span', { className: 'backup-offline-icon' }, offlineDataActive
        ? element(Smartphone, { size: 21 })
        : element(WifiOff, { size: 21 })),
      element('div', { className: 'backup-offline-copy' },
        element('h2', null, offlineDataActive ? 'Dados offline ativos neste aparelho' : 'Dados offline desativados'),
        element('p', null, offlineDataActive
          ? 'Consultas e alterações ficam disponíveis sem internet e sincronizam ao reconectar.'
          : offlineDataRequested
            ? 'A ativação não foi concluída neste navegador. Você pode limpar a preferência e tentar novamente.'
            : 'Ative somente em aparelho pessoal: o navegador guardará clientes, vendas, dados financeiros e as cópias automáticas.')
      ),
      element('button', {
        type: 'button',
        disabled: !!busy,
        onClick: handleOfflinePreference
      }, busy === 'offline' ? 'Limpando...' : (offlineDataActive || offlineDataRequested) ? 'Desativar e limpar' : 'Ativar neste aparelho')
    ),

    element('div', { className: 'backup-grid' },
      element('article', { className: 'backup-card backup-primary-card' },
        element('div', { className: 'backup-card-heading' },
          element('span', { className: 'backup-card-icon' }, element(Download, { size: 20 })),
          element('div', null, element('h2', null, 'Baixar uma cópia completa'), element('p', null, 'A forma mais segura de levar os dados para outro aparelho.'))
        ),
        element(SummaryPills, { summary: currentSummary }),
        element('button', {
          type: 'button',
          className: 'backup-button is-primary',
          disabled: !!busy,
          onClick: handleDownloadCurrent
        }, busy === 'download' ? element(RefreshCw, { size: 18, className: 'backup-spin' }) : element(FileJson, { size: 18 }),
        busy === 'download' ? 'Preparando...' : 'Baixar backup agora'),
        element('p', { className: 'backup-private-note' },
          element(AlertTriangle, { size: 16 }),
          'O arquivo contém clientes, vendas, dados financeiros e PIX. Guarde-o em local privado.'
        )
      ),

      element('article', { className: 'backup-card' },
        element('div', { className: 'backup-card-heading' },
          element('span', { className: 'backup-card-icon is-blue' }, element(Upload, { size: 20 })),
          element('div', null, element('h2', null, 'Restaurar de um arquivo'), element('p', null, 'O sistema valida proprietário, formato, estoque e integridade antes de gravar.'))
        ),
        element('input', {
          ref: fileInputRef,
          type: 'file',
          accept: 'application/json,.json',
          className: 'backup-file-input',
          onChange: handleFile
        }),
        element('button', {
          type: 'button',
          className: 'backup-button is-secondary',
          disabled: !!busy,
          onClick: () => fileInputRef.current?.click()
        }, busy === 'file' ? element(RefreshCw, { size: 18, className: 'backup-spin' }) : element(Upload, { size: 18 }),
        busy === 'file' ? 'Validando...' : 'Selecionar arquivo JSON'),
        element('p', { className: 'backup-safe-note' }, 'A restauração é não destrutiva: atualiza e recria registros, sem excluir o que já existe.')
      )
    ),

    pendingRestore && element('article', { className: 'backup-restore-preview' },
      element('div', { className: 'backup-restore-copy' },
        element('span', { className: 'backup-card-icon is-amber' }, element(RotateCcw, { size: 20 })),
        element('div', null,
          element('p', { className: 'backup-eyebrow' }, 'Pronto para restaurar'),
          element('h2', null, pendingRestore.backup.store?.name || 'Registro de Vendas'),
          element('p', null, `${formatBackupDate(pendingRestore.backup.createdAt)} • ${pendingRestore.source}`),
          element(SummaryPills, { summary: pendingRestore.summary })
        )
      ),
      progress && element('div', { className: 'backup-progress', role: 'status' },
        element('span', { style: { width: `${Math.min(100, (progress.completed / Math.max(1, progress.total)) * 100)}%` } }),
        element('small', null, `${progress.completed} de ${progress.total} registros`)
      ),
      element('div', { className: 'backup-restore-actions' },
        element('button', { type: 'button', className: 'backup-button is-ghost', disabled: !!busy, onClick: () => setPendingRestore(null) }, 'Cancelar'),
        element('button', { type: 'button', className: 'backup-button is-danger', disabled: !!busy, onClick: handleRestore },
          busy === 'restore' ? element(RefreshCw, { size: 18, className: 'backup-spin' }) : element(RotateCcw, { size: 18 }),
          busy === 'restore' ? 'Restaurando...' : 'Restaurar e mesclar'
        )
      )
    ),

    element('article', { className: 'backup-card backup-local-card' },
      element('div', { className: 'backup-card-heading backup-local-heading' },
        element('span', { className: 'backup-card-icon is-green' }, element(HardDrive, { size: 20 })),
        element('div', null,
          element('h2', null, `Cópias automáticas deste aparelho (${localBackups.length}/${LOCAL_BACKUP_LIMIT})`),
          element('p', null, storageText)
        ),
        element('button', { type: 'button', className: 'backup-refresh-button', onClick: refreshLocalBackups, title: 'Atualizar lista' }, element(RefreshCw, { size: 17 }))
      ),
      localBackups.length === 0
        ? element('div', { className: 'backup-empty' }, element(Archive, { size: 25 }), element('p', null,
          offlineDataRequested
            ? 'A primeira cópia será criada automaticamente após os dados carregarem.'
            : 'Ative este aparelho como confiável para manter até cinco cópias automáticas.'))
        : element('div', { className: 'backup-local-list' }, localBackups.map(record =>
          element('div', { className: 'backup-local-row', key: record.key },
            element('div', { className: 'backup-local-main' },
              element('strong', null, formatBackupDate(record.createdAt)),
              element('span', null, `${record.summary?.products || 0} produtos • ${record.summary?.customers || 0} clientes • ${record.summary?.sales || 0} vendas`)
            ),
            element('div', { className: 'backup-local-actions' },
              element('button', { type: 'button', disabled: !!busy, onClick: () => handleDownloadLocal(record) }, element(Download, { size: 16 }), 'Baixar'),
              element('button', { type: 'button', disabled: !!busy, onClick: () => handleChooseLocal(record) }, element(RotateCcw, { size: 16 }), 'Restaurar')
            )
          )
        ))
    )
  );
};
