const response = await fetch('./aba-clientes-fixed.js?v=52', { cache: 'no-store' });
if (!response.ok) throw new Error('Não foi possível carregar a aba de clientes.');
let source = await response.text();
source = source.replace("const VERSION = '25';", "const VERSION = '52';");
source = source.replace("./customer-history-modal.js", "./customer-history-modal-v52.js");
const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
let module;
try { module = await import(blobUrl); }
finally { URL.revokeObjectURL(blobUrl); }
if (typeof module?.AbaClientes !== 'function') throw new Error('A aba de clientes v52 não foi exportada corretamente.');
export const AbaClientes = module.AbaClientes;
