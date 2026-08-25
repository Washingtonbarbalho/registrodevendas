import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

if (typeof vm.SourceTextModule !== 'function') {
  throw new Error('Execute este gerador com node --experimental-vm-modules.');
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_VERSION = '79';
const blobStore = new Map();
const capturedBlobs = [];
let blobSequence = 0;

class BuildURL extends URL {}
BuildURL.createObjectURL = blob => {
  const url = `blob:registro-vendas-build-${++blobSequence}`;
  blobStore.set(url, blob);
  capturedBlobs.push(blob);
  return url;
};
BuildURL.revokeObjectURL = () => {};

const browserContext = vm.createContext({
  console,
  URL: BuildURL,
  Blob,
  Response,
  Headers,
  Request,
  TextEncoder,
  TextDecoder,
  setTimeout,
  clearTimeout,
  location: new URL('http://localhost/registrodevendas/'),
  navigator: { clipboard: { writeText: async () => {} }, onLine: true },
  document: {},
  alert() {},
  confirm() { return true; }
});

browserContext.fetch = async input => {
  const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
  const url = new URL(raw, browserContext.location.href);
  if (url.origin !== 'http://localhost') return new Response('', { status: 404 });
  const relative = decodeURIComponent(url.pathname.replace(/^\/registrodevendas\//, '').replace(/^\//, ''));
  const file = path.resolve(root, relative || 'index.html');
  if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file)) return new Response('', { status: 404 });
  return new Response(fs.readFileSync(file), {
    status: 200,
    headers: { 'content-type': 'text/javascript; charset=utf-8' }
  });
};

const exportNames = new Set([
  'default', 'useEffect', 'useMemo', 'useRef', 'useState', 'createPortal',
  'splitMoney', 'getHistoryCashAmount'
]);

for (const file of fs.readdirSync(root).filter(name => name.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of source.matchAll(/\{([^{}]*?)\}\s*from\s*['"]/gs)) {
    for (const part of match[1].split(',')) {
      const importedName = part.trim().split(/\s+as\s+/)[0];
      if (/^[A-Za-z_$][\w$]*$/.test(importedName)) exportNames.add(importedName);
    }
  }
}

const dummyFunction = function () { return 0; };
const dummyValue = new Proxy(dummyFunction, {
  get(_target, key) {
    if (key === 'current') return false;
    if (key === 'Fragment') return 'fragment';
    if (key === 'useRef') return () => ({ current: false });
    if (key === 'useState') return initial => [typeof initial === 'function' ? initial() : initial, dummyFunction];
    if (key === 'useMemo') return callback => callback();
    if (key === 'useEffect') return () => {};
    return dummyValue;
  }
});

const moduleCache = new Map();
const isLegacyLoader = identifier => {
  try {
    const name = path.basename(new URL(identifier).pathname);
    return name === 'modals-fixed.js'
      || name.startsWith('modals-fixed-v')
      || name === 'nova-venda-fixed.js'
      || name.startsWith('nova-venda-fixed-v')
      || name === 'aba-clientes-fixed.js'
      || name.startsWith('aba-clientes-fixed-v')
      || name.startsWith('customer-history-modal-v');
  } catch {
    return false;
  }
};

const resolveModule = (specifier, parent = browserContext.location.href) => {
  if (specifier.startsWith('blob:') || /^https?:/.test(specifier)) return specifier;
  if (parent.startsWith('blob:')) throw new Error(`Import relativo inesperado (${specifier}) em ${parent}.`);
  return new URL(specifier, parent).href;
};

const createSyntheticModule = identifier => new vm.SyntheticModule(
  [...exportNames],
  function initialize() {
    for (const name of exportNames) this.setExport(name, dummyValue);
  },
  { context: browserContext, identifier }
);

const getModuleSource = async identifier => {
  if (identifier.startsWith('blob:')) return blobStore.get(identifier).text();
  const url = new URL(identifier);
  const relative = decodeURIComponent(url.pathname.replace(/^\/registrodevendas\//, '').replace(/^\//, ''));
  return fs.readFileSync(path.join(root, relative), 'utf8');
};

const linker = async (specifier, referencingModule) => loadModule(specifier, referencingModule.identifier);

const loadModule = async (specifier, parent) => {
  const identifier = resolveModule(specifier, parent);
  if (moduleCache.has(identifier)) return moduleCache.get(identifier);

  let module;
  if (identifier.startsWith('blob:') || (identifier.startsWith('http://localhost/') && isLegacyLoader(identifier))) {
    module = new vm.SourceTextModule(await getModuleSource(identifier), {
      context: browserContext,
      identifier,
      initializeImportMeta(meta) { meta.url = identifier; },
      importModuleDynamically: async (childSpecifier, referencingModule) => {
        const child = await loadModule(childSpecifier, referencingModule.identifier);
        if (child.status === 'unlinked') await child.link(linker);
        if (child.status === 'linked') await child.evaluate();
        return child;
      }
    });
  } else {
    module = createSyntheticModule(identifier);
  }
  moduleCache.set(identifier, module);
  return module;
};

const evaluateEntry = async entry => {
  const module = await loadModule(new URL(entry, browserContext.location.href).href, browserContext.location.href);
  if (module.status === 'unlinked') await module.link(linker);
  if (module.status === 'linked') await module.evaluate();
};

await evaluateEntry('./modals-fixed-v69.js?v=69');
await evaluateEntry('./nova-venda-fixed-v70.js?v=70');
await evaluateEntry('./aba-clientes-fixed-v52.js?v=52');

const capturedSources = await Promise.all(capturedBlobs.map(blob => blob.text()));
const modalCore = capturedSources.find(source =>
  source.includes('export const PixCodeModal')
  && source.includes('QRCode.toDataURL(payload')
  && source.includes('onGeneratePdf')
  && !source.includes('URL.createObjectURL')
);
const modalWrapper = capturedSources.find(source =>
  source.includes('partialItems = cancellationEvents')
  && source.includes('originalModuleUrl')
  && source.includes('export const CustomerDetailsModal')
);
const saleRuntime = capturedSources.find(source =>
  source.includes('export const NewSaleScreen')
  && source.includes('const persistSale = async')
  && source.includes('currentDiscountReason')
  && source.includes('splitMoney')
  && !source.includes('URL.createObjectURL')
);
const customerRuntime = capturedSources.find(source =>
  source.includes('export const AbaClientes')
  && source.includes('CustomerPurchaseHistoryModal')
  && source.includes('Histórico de compras')
  && !source.includes('URL.createObjectURL')
);
const customerHistoryRuntime = capturedSources.find(source =>
  source.includes('export const CustomerPurchaseHistoryModal')
  && source.includes('const formatSaleMoment =')
  && !source.includes('URL.createObjectURL')
);

if (!modalCore || !modalWrapper || !saleRuntime || !customerRuntime || !customerHistoryRuntime) {
  throw new Error('Não foi possível identificar todos os módulos finais do runtime legado.');
}

const localizeImports = source => source
  .replace(/(['"])http:\/\/localhost\/registrodevendas\/([^'"]+?\.js)(?:\?[^'"]*)?\1/g, (_match, _quote, file) => `'./${file}?v=${RELEASE_VERSION}'`)
  .replace(/(['"])(\.\/[^'"]+?\.js)(?:\?[^'"]*)?\1/g, (_match, _quote, file) => `'${file}?v=${RELEASE_VERSION}'`);

const wrapperDynamicStart = modalWrapper.indexOf("const VERSION = '21';");
const wrapperExportsStart = modalWrapper.indexOf('export const UserProfileModal = originalModule.UserProfileModal;');
if (wrapperDynamicStart < 0 || wrapperExportsStart < wrapperDynamicStart) {
  throw new Error('Não foi possível retirar o carregador dinâmico dos modais.');
}

const staticModalWrapper = modalWrapper.slice(0, wrapperDynamicStart)
  + `import * as originalModule from './modals-core-runtime-v75.js?v=${RELEASE_VERSION}';\n\n`
  + modalWrapper.slice(wrapperExportsStart);

const generated = [
  ['modals-core-runtime-v75.js', modalCore, 'modais-base consolidados'],
  ['modals-runtime-v75.js', staticModalWrapper, 'modais finais consolidados'],
  ['nova-venda-runtime-v75.js', saleRuntime, 'nova venda consolidada'],
  ['aba-clientes-runtime-v75.js', customerRuntime, 'clientes consolidados'],
  ['customer-history-runtime-v75.js', customerHistoryRuntime, 'histórico de clientes consolidado']
];

for (const [file, source, label] of generated) {
  const preparedSource = file === 'aba-clientes-runtime-v75.js'
    ? source.replace(/\.\/customer-history-modal-v52\.js(?:\?[^'"]*)?/g, `./customer-history-runtime-v75.js?v=${RELEASE_VERSION}`)
    : source;
  let localizedSource = localizeImports(preparedSource);
  if (file === 'aba-clientes-runtime-v75.js') {
    localizedSource = localizedSource.replace(
      `./customer-history-modal-v52.js?v=${RELEASE_VERSION}`,
      `./customer-history-runtime-v75.js?v=${RELEASE_VERSION}`
    );
  }
  const finalSource = `// Gerado por scripts/consolidate-legacy-runtime-v75.mjs — ${label}.\n${localizedSource}`;
  for (const forbidden of ['http://localhost', 'URL.createObjectURL', 'new Blob([source]']) {
    if (finalSource.includes(forbidden)) throw new Error(`${file} ainda contém runtime dinâmico: ${forbidden}.`);
  }
  fs.writeFileSync(path.join(root, file), finalSource);
}

console.log(`Modais e Nova Venda consolidados em módulos estáticos v${RELEASE_VERSION}.`);
