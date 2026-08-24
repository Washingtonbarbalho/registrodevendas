export const BACKUP_SCHEMA = 'registrodevendas.backup';
export const BACKUP_VERSION = 1;
export const DEFAULT_BACKUP_APP_ID = 'vendas-aura-main';
export const MAX_BACKUP_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_BACKUP_RECORDS = 200_000;

const TYPE_KEY = '__registroVendasBackupType';
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const PROFILE_BACKUP_FIELDS = Object.freeze([
  'name', 'storeName', 'phone', 'city',
  'pixType', 'pixKey', 'pixBank', 'pixName',
  'paymentSettings', 'paymentSettingsUpdatedAt',
  'financialData', 'financialUpdatedAt',
  'commercialGoals', 'commercialGoalsUpdatedAt',
  'updatedAt'
]);

const isObject = value => value !== null && typeof value === 'object';
const isTimestamp = value => isObject(value)
  && Number.isFinite(value.seconds)
  && Number.isFinite(value.nanoseconds)
  && typeof value.toDate === 'function';

const assertSafeKey = key => {
  if (FORBIDDEN_KEYS.has(key)) throw new Error(`Campo inseguro encontrado no backup: ${key}.`);
};

export const encodeBackupValue = (value, state = { seen: new WeakSet(), depth: 0 }) => {
  if (state.depth > 40) throw new Error('O backup contém dados aninhados além do limite seguro.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('O backup contém um número inválido.');
    return Object.is(value, -0) ? 0 : value;
  }
  if (value === undefined) return null;
  if (typeof value === 'bigint') return { [TYPE_KEY]: 'bigint', value: value.toString() };
  if (!isObject(value)) throw new Error('O backup contém um tipo de dado não suportado.');

  if (state.seen.has(value)) throw new Error('O backup contém uma referência circular.');
  state.seen.add(value);
  const nextState = { seen: state.seen, depth: state.depth + 1 };

  let encoded;
  if (isTimestamp(value)) {
    encoded = {
      [TYPE_KEY]: 'timestamp',
      iso: value.toDate().toISOString(),
      nanoseconds: Math.max(0, Math.min(999_999_999, Math.trunc(value.nanoseconds)))
    };
  } else if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error('O backup contém uma data inválida.');
    encoded = { [TYPE_KEY]: 'date', iso: value.toISOString() };
  } else if (Array.isArray(value)) {
    encoded = value.map(item => encodeBackupValue(item, nextState));
  } else {
    encoded = {};
    for (const [key, item] of Object.entries(value)) {
      assertSafeKey(key);
      if (item !== undefined) encoded[key] = encodeBackupValue(item, nextState);
    }
  }

  state.seen.delete(value);
  return encoded;
};

export const decodeBackupValue = (value, options = {}, depth = 0) => {
  if (depth > 40) throw new Error('O backup contém dados aninhados além do limite seguro.');
  if (!isObject(value)) return value;
  if (Array.isArray(value)) return value.map(item => decodeBackupValue(item, options, depth + 1));

  for (const key of Object.keys(value)) assertSafeKey(key);
  if (value[TYPE_KEY] === 'timestamp') {
    const date = new Date(value.iso);
    if (!Number.isFinite(date.getTime())) throw new Error('Timestamp inválido no backup.');
    return typeof options.timestampFactory === 'function'
      ? options.timestampFactory(value.iso, value.nanoseconds || 0)
      : date;
  }
  if (value[TYPE_KEY] === 'date') {
    const date = new Date(value.iso);
    if (!Number.isFinite(date.getTime())) throw new Error('Data inválida no backup.');
    return typeof options.dateFactory === 'function' ? options.dateFactory(value.iso) : date;
  }
  if (value[TYPE_KEY] === 'bigint') {
    if (!/^-?\d+$/.test(String(value.value || ''))) throw new Error('Número inteiro inválido no backup.');
    return typeof options.bigIntFactory === 'function' ? options.bigIntFactory(value.value) : String(value.value);
  }

  const decoded = {};
  for (const [key, item] of Object.entries(value)) {
    decoded[key] = decodeBackupValue(item, options, depth + 1);
  }
  return decoded;
};

export const stableStringify = value => {
  const visit = item => {
    if (Array.isArray(item)) return item.map(visit);
    if (!isObject(item)) return item;
    return Object.keys(item).sort().reduce((result, key) => {
      result[key] = visit(item[key]);
      return result;
    }, {});
  };
  return JSON.stringify(visit(value));
};

export const computeBackupChecksum = backup => {
  const { checksum: ignoredChecksum, ...payload } = backup || {};
  const text = stableStringify(payload);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, '0')}`;
};

const sanitizeDocumentId = value => {
  const id = String(value || '').trim();
  if (!id || id.length > 1_500 || id.includes('/') || id === '.' || id === '..') {
    throw new Error('O backup contém um identificador de registro inválido.');
  }
  return id;
};

const toBackupRecords = records => (Array.isArray(records) ? records : [])
  .map(record => {
    const id = sanitizeDocumentId(record?.id);
    const data = {};
    for (const [key, value] of Object.entries(record || {})) {
      if (key === 'id' || value === undefined) continue;
      assertSafeKey(key);
      data[key] = encodeBackupValue(value);
    }
    return { id, data };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

export const pickBackupProfile = profile => PROFILE_BACKUP_FIELDS.reduce((result, field) => {
  if (profile?.[field] !== undefined) result[field] = encodeBackupValue(profile[field]);
  return result;
}, {});

export const summarizeBackup = backup => ({
  products: Array.isArray(backup?.data?.products) ? backup.data.products.length : 0,
  customers: Array.isArray(backup?.data?.customers) ? backup.data.customers.length : 0,
  sales: Array.isArray(backup?.data?.sales) ? backup.data.sales.length : 0,
  total: ['products', 'customers', 'sales'].reduce(
    (total, key) => total + (Array.isArray(backup?.data?.[key]) ? backup.data[key].length : 0),
    0
  )
});

export const buildBackup = ({
  appId = DEFAULT_BACKUP_APP_ID,
  userId,
  userEmail = '',
  userProfile = {},
  products = [],
  customers = [],
  sales = [],
  createdAt = new Date()
}) => {
  const ownerUid = String(userId || '').trim();
  if (!ownerUid) throw new Error('Não foi possível identificar o proprietário do backup.');
  const createdDate = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (!Number.isFinite(createdDate.getTime())) throw new Error('Data de criação do backup inválida.');

  const payload = {
    schema: BACKUP_SCHEMA,
    schemaVersion: BACKUP_VERSION,
    appId: String(appId || DEFAULT_BACKUP_APP_ID),
    createdAt: createdDate.toISOString(),
    owner: {
      uid: ownerUid,
      email: String(userEmail || '').trim()
    },
    store: {
      name: String(userProfile?.storeName || userProfile?.name || 'Registro de Vendas').trim()
    },
    data: {
      profile: pickBackupProfile(userProfile),
      products: toBackupRecords(products),
      customers: toBackupRecords(customers),
      sales: toBackupRecords(sales)
    }
  };
  payload.summary = summarizeBackup(payload);
  payload.contentChecksum = computeBackupChecksum({
    schema: payload.schema,
    schemaVersion: payload.schemaVersion,
    appId: payload.appId,
    ownerUid: payload.owner.uid,
    data: payload.data
  });
  return { ...payload, checksum: computeBackupChecksum(payload) };
};

const validateEncodedValue = (value, depth = 0) => {
  if (depth > 40) throw new Error('O backup ultrapassa o limite de dados aninhados.');
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('O backup contém um número inválido.');
    return;
  }
  if (!isObject(value)) throw new Error('O backup contém um tipo de dado inválido.');
  if (Array.isArray(value)) {
    value.forEach(item => validateEncodedValue(item, depth + 1));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    assertSafeKey(key);
    validateEncodedValue(item, depth + 1);
  }
  if (value[TYPE_KEY] === 'timestamp' || value[TYPE_KEY] === 'date') {
    if (!Number.isFinite(new Date(value.iso).getTime())) throw new Error('O backup contém uma data inválida.');
  }
};

const validateRecords = (records, label, { requireValidStock = false } = {}) => {
  if (!Array.isArray(records)) throw new Error(`A lista de ${label} está ausente ou inválida.`);
  const ids = new Set();
  records.forEach(record => {
    if (!isObject(record) || Array.isArray(record)) throw new Error(`Um registro de ${label} está inválido.`);
    const id = sanitizeDocumentId(record.id);
    if (ids.has(id)) throw new Error(`O backup contém ${label} duplicados (${id}).`);
    ids.add(id);
    if (!isObject(record.data) || Array.isArray(record.data)) throw new Error(`Os dados de ${label} estão inválidos.`);
    validateEncodedValue(record.data);
    if (requireValidStock && (!Number.isInteger(record.data.quantity) || record.data.quantity < 0)) {
      throw new Error(`O produto ${id} possui estoque inválido no backup.`);
    }
  });
};

export const validateBackup = (backup, {
  expectedAppId = DEFAULT_BACKUP_APP_ID,
  expectedOwnerUid = ''
} = {}) => {
  if (!isObject(backup) || Array.isArray(backup)) throw new Error('O arquivo não contém um backup válido.');
  if (backup.schema !== BACKUP_SCHEMA || backup.schemaVersion !== BACKUP_VERSION) {
    throw new Error('Este arquivo não pertence a uma versão de backup compatível.');
  }
  if (backup.appId !== expectedAppId) throw new Error('O backup pertence a outro sistema ou ambiente.');
  if (!Number.isFinite(new Date(backup.createdAt).getTime())) throw new Error('A data do backup está inválida.');
  if (!isObject(backup.owner) || !String(backup.owner.uid || '').trim()) throw new Error('O proprietário do backup não foi identificado.');
  if (expectedOwnerUid && backup.owner.uid !== expectedOwnerUid) {
    throw new Error('Este backup pertence a outro usuário. Entre na conta correta para restaurá-lo.');
  }
  if (!isObject(backup.data) || Array.isArray(backup.data)) throw new Error('Os dados do backup estão ausentes.');
  if (!isObject(backup.data.profile) || Array.isArray(backup.data.profile)) throw new Error('O perfil do backup está inválido.');

  for (const key of Object.keys(backup.data.profile)) {
    assertSafeKey(key);
    if (!PROFILE_BACKUP_FIELDS.includes(key)) throw new Error(`O perfil contém um campo não permitido: ${key}.`);
  }
  validateEncodedValue(backup.data.profile);
  validateRecords(backup.data.products, 'produtos', { requireValidStock: true });
  validateRecords(backup.data.customers, 'clientes');
  validateRecords(backup.data.sales, 'vendas');

  const summary = summarizeBackup(backup);
  if (summary.total > MAX_BACKUP_RECORDS) throw new Error('O backup excede o limite seguro de registros.');
  if (backup.checksum !== computeBackupChecksum(backup)) {
    throw new Error('A verificação de integridade falhou. O arquivo pode estar incompleto ou alterado.');
  }
  const expectedContentChecksum = computeBackupChecksum({
    schema: backup.schema,
    schemaVersion: backup.schemaVersion,
    appId: backup.appId,
    ownerUid: backup.owner.uid,
    data: backup.data
  });
  if (backup.contentChecksum !== expectedContentChecksum) {
    throw new Error('O conteúdo do backup não passou na verificação de integridade.');
  }

  return { backup, summary };
};

export const serializeBackup = backup => `${JSON.stringify(backup, null, 2)}\n`;

export const getBackupFilename = backup => {
  const date = String(backup?.createdAt || new Date().toISOString()).slice(0, 19).replaceAll(':', '-');
  const store = String(backup?.store?.name || 'loja')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'loja';
  return `registro-vendas-${store}-${date}.json`;
};
