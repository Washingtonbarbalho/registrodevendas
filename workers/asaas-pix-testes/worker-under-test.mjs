const worker = await import(process.env.PIX_WORKER_VARIANT === 'mobile' ? './worker-mobile.js' : './worker.js');
export const createWorker = worker.createWorker;
