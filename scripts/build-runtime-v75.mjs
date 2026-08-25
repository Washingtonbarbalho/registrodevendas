import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const bootstrap = read('bootstrap-v75.js');
const version = bootstrap.match(/const VERSION = '([^']+)'/)?.[1];
if (!version) throw new Error('Não foi possível identificar a versão ativa da aplicação.');

const index = read('index.html');
for (const asset of [
  `bootstrap-v75.js?v=${version}`,
  `styles-runtime-v75.css?v=${version}`,
  `manifest.json?v=${version}`
]) {
  if (!index.includes(asset)) throw new Error(`A página inicial não carrega o arquivo ativo ${asset}.`);
}

const modules = new Set();
const scanModule = relativePath => {
  if (modules.has(relativePath)) return;
  const absolutePath = path.resolve(root, relativePath);
  if (!absolutePath.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Dependência fora da aplicação: ${relativePath}.`);
  }
  if (!fs.existsSync(absolutePath)) throw new Error(`Módulo necessário não encontrado: ${relativePath}.`);
  modules.add(relativePath);

  const source = read(relativePath);
  const references = /\b(?:from\s+|import\s*\()\s*['"](\.{1,2}\/[^'"]+)['"]/g;
  for (const reference of source.matchAll(references)) {
    const filename = reference[1].split('?')[0];
    const resolved = path.relative(root, path.resolve(path.dirname(absolutePath), filename));
    if (resolved.endsWith('.js') || resolved.endsWith('.mjs')) scanModule(resolved);
  }
};

for (const entry of ['bootstrap-v75.js', 'app-runtime-v75.js', 'tab-persistence.js']) scanModule(entry);
for (const module of modules) {
  const check = spawnSync(process.execPath, ['--check', path.join(root, module)], { encoding: 'utf8' });
  if (check.status !== 0) throw new Error(`Erro de sintaxe em ${module}:\n${check.stderr || check.stdout}`);
}

const manifest = JSON.parse(read('manifest.json'));
for (const icon of manifest.icons || []) {
  const filename = String(icon.src || '').split('?')[0];
  if (!filename || !fs.existsSync(path.join(root, filename))) {
    throw new Error(`Ícone do aplicativo não encontrado: ${filename || '(vazio)'}.`);
  }
}

if (!read('styles-runtime-v75.css').trim()) throw new Error('A folha de estilo principal está vazia.');
console.log(`Aplicação v${version} pronta: ${modules.size} módulos ativos, uma folha de estilo e nenhuma montagem legada.`);
