import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const source = fs.readFileSync(new URL('../integrations/asaas-production-check.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace(/^const client = .*;\n/m, '').replace('const h = React.createElement;', '').replace('export const AsaasProductionCheck', 'const AsaasProductionCheck');
const create = new Function('useState', 'useRef', 'useEffect', 'h', 'client', 'formatCurrency', 'document', 'navigator', 'setTimeout', 'clearTimeout', source + '\nreturn AsaasProductionCheck;');
const flatten = node => Array.isArray(node) ? node.flatMap(flatten) : !node || typeof node !== 'object' ? [] : [node, ...flatten(node.props.children)];
const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props.children) : node == null || node === false ? '' : String(node);
function harness({ fail = false, paid = false } = {}) {
    const states = [], refs = [], effects = [], queue = [], calls = [];
    let cursor = 0, rc = 0, ec = 0, tree;
    const h = (type, props, ...children) => ({ type, props: { ...props, children } });
    const empty = { started: false, ready: false, created: false, testComplete: false, status: 'NOT_CREATED', netCents: null, message: '' };
    const ready = { ...empty, started: true, ready: true, created: true, status: 'PENDING', payload: 'PIX_TEST_PAYLOAD', encodedImage: '', message: 'Pague pelo banco.' };
    const client = {
        get: async () => { calls.push(['get']); return paid ? { ...ready, testComplete: true, status: 'RECEIVED', netCents: 450 } : empty; },
        prepare: async payer => { calls.push(['prepare', payer]); if (fail) throw new Error('Consulta indisponível.'); return ready; },
        reconcile: async () => ready, cancel: async () => ({ ...ready, status: 'DELETED' })
    };
    const Component = create(initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; }, initial => { const index = rc++; if (!(index in refs)) refs[index] = { current: initial }; return refs[index]; }, (effect, deps) => {
        const index = ec++;
        if (!effects[index] || deps.some((value, i) => value !== effects[index].deps[i])) queue.push(() => { effects[index]?.cleanup?.(); effects[index] = { deps, cleanup: effect() }; });
    }, h, client, value => 'R$ ' + value.toFixed(2), { visibilityState: 'visible' }, { clipboard: { writeText: async () => {} } }, () => 1, () => {});
    const render = () => { cursor = rc = ec = 0; tree = Component(); };
    const flush = async () => { while (queue.length) queue.shift()(); await new Promise(resolve => setImmediate(resolve)); render(); };
    const button = label => flatten(tree).find(node => node.type === 'button' && text(node) === label);
    const input = id => flatten(tree).find(node => node.type === 'input' && node.props.id === id);
    return { render, flush, button, input, calls, get tree() { return tree; }, close: () => effects.forEach(effect => effect?.cleanup?.()) };
}
for (const fail of [false, true]) test('cobrança real exige clique explícito e limpa nome/CPF ao iniciar (' + (fail ? 'falha' : 'sucesso') + ')', async () => {
    const f = harness({ fail }); f.render(); await f.flush();
    assert.deepEqual(f.calls, [['get']]);
    assert.match(text(f.tree), /Pix real de R\$ 5,00/); assert.match(text(f.tree), /tarifas/);
    f.input('production-check-payer').props.onChange({ target: { value: 'PAGADOR TESTE' } });
    f.input('production-check-cpf').props.onChange({ target: { value: '52998224725' } }); f.render();
    f.button('Gerar Pix real de R$ 5,00').props.onClick(); f.render();
    if (f.input('production-check-payer')) { assert.equal(f.input('production-check-payer').props.value, ''); assert.equal(f.input('production-check-cpf').props.value, ''); }
    await f.flush();
    assert.equal(f.calls[1][0], 'prepare'); assert.equal(f.calls[1][1].payerCpf, '52998224725');
    assert.ok(!text(f.tree).includes('52998224725')); assert.ok(!text(f.tree).includes('Simular pagamento'));
    f.close();
});
test('somente o resultado recebido do servidor apresenta a validação e nenhum pagamento é disparado ao abrir', async () => {
    const f = harness({ paid: true }); f.render(); await f.flush();
    assert.match(text(f.tree), /Recebimento real e retorno automático validados/);
    assert.equal(f.button('Gerar Pix real de R$ 5,00'), undefined);
    assert.deepEqual(f.calls, [['get']]); f.close();
});
