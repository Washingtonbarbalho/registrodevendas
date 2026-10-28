import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('.', import.meta.url));
const options = { absWorkingDir: directory, entryPoints: ['worker.entry.js'], bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', charset: 'utf8', legalComments: 'none', logLevel: 'warning' };
await build({ ...options, define: { __MOBILE_BUILD__: 'false' }, outfile: 'worker.js', banner: { js: '// Registro de Vendas - Worker 105 completo. Gerado por build.mjs.' } });
await build({ ...options, define: { __MOBILE_BUILD__: 'true' }, outfile: 'worker-mobile.js', minify: true, lineLimit: 160, banner: { js: '// Registro de Vendas - Worker 105 compacto. Gerado por build.mjs.' } });
const compact = await fs.readFile(new URL('./worker-mobile.js', import.meta.url));
await fs.writeFile(new URL('./worker-mobile-manifest.json', import.meta.url), JSON.stringify({ version: '105', bytes: compact.length, sha256: createHash('sha256').update(compact).digest('hex') }) + '\n');
const full = await fs.readFile(new URL('./worker.js', import.meta.url));
const source = full.toString('utf8');
const lines = source.match(/[^\n]*\n|[^\n]+$/g) || [];
const midpoint = Math.ceil(lines.length / 2);
// A continuação começa em uma declaração de nível superior, perto da metade.
const boundaries = lines.flatMap((line, index) => index > 0 && /^(?:async )?function \w|^var [A-Za-z_$]/.test(line) ? [index] : []);
const nearestBoundary = boundaries.sort((a, b) => Math.abs(a - midpoint) - Math.abs(b - midpoint))[0] ?? midpoint;
const splitAfterLine = Math.abs(nearestBoundary - midpoint) <= Math.max(2, Math.ceil(lines.length * 0.02)) ? nearestBoundary : midpoint;
const chunks = [lines.slice(0, splitAfterLine).join(''), lines.slice(splitAfterLine).join('')].map(part => Buffer.from(part, 'utf8'));
if (!Buffer.concat(chunks).equals(full) || chunks.some(part => !part.length)) throw new Error('A divisão não reproduz o Worker completo.');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const parts = chunks.map((part, index) => ({ bytes: part.length, sha256: sha256(part), startLine: index === 0 ? 1 : splitAfterLine + 1, endLine: index === 0 ? splitAfterLine : lines.length }));
await fs.writeFile(new URL('./worker-full-manifest.json', import.meta.url), JSON.stringify({ version: '105', format: 'full-two-parts-v1', bytes: full.length, sha256: sha256(full), lines: lines.length, splitAfterLine, parts }) + '\n');
console.log('Worker completo e compacto gerados. Cópia completa em duas partes: ' + splitAfterLine + ' e ' + (lines.length - splitAfterLine) + ' linhas.');
