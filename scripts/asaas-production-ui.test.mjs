import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../integrations/asaas-production-settings.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace('const h = React.createElement;', '').replace(/^const client = .*;\n/m, '').replace('export const AsaasProductionSettings', 'const AsaasProductionSettings');
const create = new Function('React', 'useState', 'useEffect', 'useRef', 'h', 'client', 'showAppConfirm', "const AsaasProductionCheck = 'ProductionCheck';\n" + source + '\nreturn AsaasProductionSettings;');
const flatten = node => Array.isArray(node) ? node.flatMap(flatten) : !node || typeof node !== 'object' ? [] : [node, ...flatten(node.props.children)];
const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props.children) : node == null || node === false ? '' : String(node);
function harness({ failure = false } = {}) {
    const states = [], refs = [], effects = [], queue = [], calls = [];
    let cursor = 0, refCursor = 0, effectCursor = 0, tree;
    const h = (type, props, ...children) => ({ type, props: { ...props, children } });
    const client = {
        getStatus: async () => ({ configured: false }),
        save: async (key, signal) => { calls.push({ key, signal }); if (failure) throw new Error('Consulta indisponível.'); return { configured: true, message: 'Conta real conectada.', hasActivePixKey: true }; },
        testSavedKey: async () => ({ configured: true }), remove: async () => ({ configured: false })
    };
    const Component = create({}, initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; }, (effect, deps) => {
        const index = effectCursor++;
        if (!effects[index] || deps.some((value, index2) => value !== effects[index].deps[index2])) { queue.push(() => { effects[index]?.cleanup?.(); effects[index] = { deps, cleanup: effect() }; }); }
    }, initial => { const index = refCursor++; if (!(index in refs)) refs[index] = { current: initial }; return refs[index]; }, h, client, async () => true);
    const render = () => { cursor = refCursor = effectCursor = 0; tree = Component(); return tree; };
    const node = label => { const value = flatten(tree).find(item => item.type === 'button' && text(item) === label); assert.ok(value, label); return value; };
    const flush = async () => { while (queue.length) queue.shift()(); await new Promise(resolve => setImmediate(resolve)); render(); };
    return { render, flush, node, calls, input: () => flatten(tree).find(item => item.type === 'input'), get tree() { return tree; }, close: () => effects.forEach(effect => effect?.cleanup?.()) };
}
for (const failure of [false, true]) test('a tela real limpa a chave ao consultar e não aciona recebimentos (' + (failure ? 'falha' : 'sucesso') + ')', async () => {
    const f = harness({ failure });
    f.render(); await f.flush();
    assert.equal(f.node('Conectar conta de produção').props.disabled, true);
    f.input().props.onChange({ target: { value: 'real-key-only-for-ui-tests' } }); f.render();
    assert.equal(f.node('Conectar conta de produção').props.disabled, false);
    f.node('Conectar conta de produção').props.onClick(); f.render();
    assert.equal(f.input().props.value, '');
    await f.flush();
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].key, 'real-key-only-for-ui-tests');
    assert.match(text(f.tree), /Recebimentos reais aguardando ativação/);
    assert.ok(!text(f.tree).includes('real-key-only-for-ui-tests'));
    assert.ok(!flatten(f.tree).some(node => node.type === 'button' && /Gerar|Simular|Ativar/.test(text(node))));
    f.close();
});
