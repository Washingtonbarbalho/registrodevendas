import { getBrazilDateString } from './utils.js';

export const ANALYSIS_PERIOD_STORAGE_PREFIX = 'registro-vendas-periodo-compartilhado-v79:';

const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

const moveDate = (value, days) => {
  if (!validDate(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + Number(days || 0), 12)).toISOString().slice(0, 10);
};

const monthEnd = value => {
  if (!validDate(value)) return '';
  const [year, month] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0, 12)).toISOString().slice(0, 10);
};

export const resolveAnalysisPeriod = (period = 'month', today = getBrazilDateString(), custom = {}) => {
  const reference = validDate(today) ? today : getBrazilDateString();
  if (period === 'week') return { period, startDate: moveDate(reference, -6), endDate: reference };
  if (period === 'last30') return { period, startDate: moveDate(reference, -29), endDate: reference };
  if (period === 'custom' && validDate(custom.startDate) && validDate(custom.endDate)) {
    return { period, startDate: custom.startDate, endDate: custom.endDate };
  }
  return { period: 'month', startDate: `${reference.slice(0, 7)}-01`, endDate: monthEnd(reference) };
};

const availableStorage = provided => {
  if (provided) return provided;
  try { return typeof localStorage === 'undefined' ? null : localStorage; }
  catch { return null; }
};

export const readSharedAnalysisPeriod = (userId, options = {}) => {
  const today = options.today || getBrazilDateString();
  const storage = availableStorage(options.storage);
  if (!userId || !storage) return resolveAnalysisPeriod('month', today);
  try {
    const saved = JSON.parse(storage.getItem(`${ANALYSIS_PERIOD_STORAGE_PREFIX}${userId}`) || 'null');
    return resolveAnalysisPeriod(saved?.period, today, saved || {});
  } catch {
    return resolveAnalysisPeriod('month', today);
  }
};

export const writeSharedAnalysisPeriod = (userId, selection, options = {}) => {
  const storage = availableStorage(options.storage);
  if (!userId || !storage || !validDate(selection?.startDate) || !validDate(selection?.endDate)) return false;
  try {
    storage.setItem(`${ANALYSIS_PERIOD_STORAGE_PREFIX}${userId}`, JSON.stringify({
      period: ['month', 'week', 'last30', 'custom'].includes(selection.period) ? selection.period : 'custom',
      startDate: selection.startDate,
      endDate: selection.endDate
    }));
    return true;
  } catch {
    return false;
  }
};
