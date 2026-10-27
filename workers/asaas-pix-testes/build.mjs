import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('.', import.meta.url));
const options = { absWorkingDir: directory, entryPoints: ['worker.entry.js'], bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', charset: 'utf8', legalComments: 'none', logLevel: 'warning' };
await build({ ...options, define: { __MOBILE_BUILD__: 'false' }, outfile: 'worker.js', banner: { js: '// Etapa 6: caixa e parcelas em copias Sandbox. Gerado por build.mjs.' } });
await build({ ...options, define: { __MOBILE_BUILD__: 'true' }, outfile: 'worker-mobile.js', minify: true, lineLimit: 160, banner: { js: '// Registro de Vendas - Worker Sandbox 103 compacto. Gerado por build.mjs.' } });
const compact = await fs.readFile(new URL('./worker-mobile.js', import.meta.url));
await fs.writeFile(new URL('./worker-mobile-manifest.json', import.meta.url), JSON.stringify({ version: '103', bytes: compact.length, sha256: createHash('sha256').update(compact).digest('hex') }) + '\n');
console.log('Worker completo e compacto gerados. Copia para celular: ' + compact.length + ' bytes.');
