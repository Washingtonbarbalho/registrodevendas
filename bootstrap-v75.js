import { registerOfflineSupport } from './offline-status-v75.js?v=75';

const VERSION = '75';

const withStage = async (label, task) => {
  try {
    return await task();
  } catch (error) {
    const detail = error?.message || String(error || 'Erro desconhecido');
    throw new Error(`${label}: ${detail}`);
  }
};

export const startApp = async () => {
  performance.mark?.('registro-vendas:start');
  registerOfflineSupport().catch(error => {
    console.warn('O aplicativo abriu sem o suporte offline completo.', error);
  });

  await withStage('Falha ao carregar a aplicação consolidada', async () => {
    await import(`./app-runtime-v75.js?v=${VERSION}`);
  });
  await withStage('Falha ao restaurar a última tela', async () => {
    await import(`./tab-persistence.js?v=${VERSION}`);
  });

  performance.mark?.('registro-vendas:ready');
  try {
    performance.measure?.('registro-vendas:startup', 'registro-vendas:start', 'registro-vendas:ready');
  } catch (_) {}
};
