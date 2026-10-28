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
// Mantém o manifesto antigo para páginas em cache que ainda copiam em duas partes.
const baseLines = Math.floor(lines.length / 3);
let startLine = 1;
const thirds = Array.from({ length: 3 }, (_, index) => {
  const lineCount = baseLines + Number(index < lines.length % 3);
  const endLine = startLine + lineCount - 1;
  const bytes = Buffer.from(lines.slice(startLine - 1, endLine).join(''), 'utf8');
  const part = { bytes: bytes.length, sha256: sha256(bytes), startLine, endLine };
  startLine = endLine + 1;
  return { part, bytes };
});
if (!Buffer.concat(thirds.map(item => item.bytes)).equals(full) || thirds.some(item => !item.bytes.length)) throw new Error('As três partes não reproduzem o Worker completo.');
await fs.writeFile(new URL('./worker-three-parts-manifest.json', import.meta.url), JSON.stringify({ version: '105', format: 'full-three-parts-v1', bytes: full.length, sha256: sha256(full), lines: lines.length, parts: thirds.map(item => item.part) }) + '\n');
console.log('Worker completo e compacto gerados. Cópia completa em três partes: ' + thirds.map(item => item.part.endLine - item.part.startLine + 1).join(', ') + ' linhas.');
