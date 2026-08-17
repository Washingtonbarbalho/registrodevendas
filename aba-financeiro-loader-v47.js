const response = await fetch('./aba-financeiro-fixed-v47.js?v=47', { cache: 'no-store' });
if (!response.ok) throw new Error('Não foi possível carregar o Financeiro v47 (' + response.status + ').');
let wrapperSource = await response.text();
const marker = "const blob = new Blob([source], { type: 'text/javascript' });";
if (!wrapperSource.includes(marker)) throw new Error('Não foi possível preparar os imports do Financeiro v47.');
wrapperSource = wrapperSource.replace(marker, `source = source.replace(/from\\s+(['\"])(\\.\\/[^'\"]+)\\1/g, (match, quote, modulePath) => {
  const moduleUrl = new URL(modulePath, location.href);
  moduleUrl.searchParams.set('v', '47');
  return "from '" + moduleUrl.href + "'";
});

${marker}`);
const blob = new Blob([wrapperSource], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
try {
  await import(url);
} finally {
  URL.revokeObjectURL(url);
}
