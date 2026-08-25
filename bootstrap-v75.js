import { installUiInteractions } from './ui-interactions-v81.js?v=85';

const VERSION = '85';

const withStage = async (label, task) => {
  try {
    return await task();
  } catch (error) {
    const detail = error?.message || String(error || 'Erro desconhecido');
    throw new Error(`${label}: ${detail}`);
  }
};

export const startApp = async () => {
  installUiInteractions();
  performance.mark?.('registro-vendas:start');
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
