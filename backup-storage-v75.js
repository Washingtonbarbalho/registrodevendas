const DATABASE_NAME = 'registro-vendas-backups-v75';
const DATABASE_VERSION = 1;
const STORE_NAME = 'snapshots';
export const LOCAL_BACKUP_LIMIT = 5;

const requestResult = request => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Falha no armazenamento local.'));
});

const transactionDone = transaction => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error || new Error('Falha na transação de backup local.'));
  transaction.onabort = () => reject(transaction.error || new Error('A transação de backup local foi interrompida.'));
});

const openDatabase = () => new Promise((resolve, reject) => {
  if (!globalThis.indexedDB) {
    reject(new Error('Este navegador não disponibiliza armazenamento local para backups.'));
    return;
  }
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      const store = database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      store.createIndex('ownerUid', 'ownerUid', { unique: false });
      store.createIndex('createdAt', 'createdAt', { unique: false });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Não foi possível abrir os backups locais.'));
  request.onblocked = () => reject(new Error('Feche outras abas antigas do sistema e tente novamente.'));
});

const getAllRecords = async () => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const records = await requestResult(transaction.objectStore(STORE_NAME).getAll());
    await transactionDone(transaction);
    return records;
  } finally {
    database.close();
  }
};

const putRecord = async record => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
};

const deleteRecords = async keys => {
  if (!keys.length) return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    keys.forEach(key => store.delete(key));
    await transactionDone(transaction);
  } finally {
    database.close();
  }
};

export const listLocalBackups = async ownerUid => {
  const uid = String(ownerUid || '').trim();
  if (!uid) return [];
  const records = await getAllRecords();
  return records
    .filter(record => record.ownerUid === uid)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

export const getLocalBackup = async key => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const record = await requestResult(transaction.objectStore(STORE_NAME).get(String(key || '')));
    await transactionDone(transaction);
    return record?.backup || null;
  } finally {
    database.close();
  }
};

export const saveLocalBackup = async (backup, reason = 'automatic') => {
  const ownerUid = String(backup?.owner?.uid || '').trim();
  if (!ownerUid || !backup?.checksum || !backup?.createdAt) throw new Error('Backup local incompleto.');

  const existing = await listLocalBackups(ownerUid);
  const identical = existing.find(record => record.contentChecksum === backup.contentChecksum);
  if (identical) return identical;

  const record = {
    key: `${ownerUid}:${backup.createdAt}:${backup.checksum}`,
    ownerUid,
    createdAt: backup.createdAt,
    checksum: backup.checksum,
    contentChecksum: backup.contentChecksum,
    reason: String(reason || 'automatic'),
    summary: backup.summary || {},
    storeName: backup.store?.name || 'Registro de Vendas',
    backup
  };
  await putRecord(record);

  const updated = await listLocalBackups(ownerUid);
  await deleteRecords(updated.slice(LOCAL_BACKUP_LIMIT).map(item => item.key));
  return record;
};

export const clearLocalBackups = async ownerUid => {
  const records = await listLocalBackups(ownerUid);
  await deleteRecords(records.map(record => record.key));
};

export const getLocalBackupStorageEstimate = async () => {
  if (!globalThis.navigator?.storage?.estimate) return null;
  const estimate = await globalThis.navigator.storage.estimate();
  return {
    usage: Number(estimate.usage) || 0,
    quota: Number(estimate.quota) || 0
  };
};
