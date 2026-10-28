import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('.', import.meta.url));
for (const variant of ['full', 'mobile']) {
  console.log('Validando Worker ' + variant + '...');
  const result = spawnSync(process.execPath, ['--test', 'worker.test.mjs', 'worker.runtime.test.mjs', 'profile.test.mjs', 'sandbox.test.mjs', 'flow.test.mjs', 'production-profile.test.mjs'], { cwd, stdio: 'inherit', env: { ...process.env, PIX_WORKER_VARIANT: variant } });
  if (result.status !== 0) process.exit(result.status || 1);
}
