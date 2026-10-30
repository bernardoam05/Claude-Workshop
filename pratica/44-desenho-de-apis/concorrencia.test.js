import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { aplicarMergePatch, criarServidor } from './concorrencia.js';

describe('P4 · JSON Merge Patch', () => {
  it('substitui, apaga com null e junta objetos', () => {
    const alvo = { titulo: 'A', prazo: '2026-11-01', meta: { cor: 'azul', prioridade: 1 }, etiquetas: ['x'] };
    const r = aplicarMergePatch(alvo, { titulo: 'B', prazo: null, meta: { prioridade: 2, nova: true }, etiquetas: ['y'] });
    assert.deepEqual(r, { titulo: 'B', meta: { cor: 'azul', prioridade: 2, nova: true }, etiquetas: ['y'] });
    assert.equal(alvo.titulo, 'A', 'o alvo não muda');
    assert.deepEqual(alvo.meta, { cor: 'azul', prioridade: 1 });
  });
  it('casos do RFC 7396', () => {
    assert.deepEqual(aplicarMergePatch({ a: 'b' }, { a: 'c' }), { a: 'c' });
    assert.deepEqual(aplicarMergePatch({ a: 'b' }, { b: 'c' }), { a: 'b', b: 'c' });
    assert.deepEqual(aplicarMergePatch({ a: ['b'] }, { a: 'c' }), { a: 'c' });
    assert.deepEqual(aplicarMergePatch({ a: 'c' }, { a: ['b'] }), { a: ['b'] });
    assert.deepEqual(aplicarMergePatch({ a: { b: 'c' } }, { a: { b: 'd', c: null } }), { a: { b: 'd' } });
    assert.deepEqual(aplicarMergePatch(['a', 'b'], ['c', 'd']), ['c', 'd']);
    assert.deepEqual(aplicarMergePatch({ a: 'b' }, ['c']), ['c']);
    assert.deepEqual(aplicarMergePatch({}, { a: { bb: { ccc: null } } }), { a: { bb: {} } });
  });
});

describe('P4 · If-Match', () => {
  let servidor;
  let base;
  before(async () => {
    servidor = criarServidor(new Map([[1, { titulo: 'Rever', estado: 'aberta' }]]));
    await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${servidor.address().port}`;
  });
  after(() => servidor.close());
  const patch = (corpo, cab = {}) =>
    fetch(`${base}/tarefas/1`, { method: 'PATCH', headers: { 'Content-Type': 'application/merge-patch+json', ...cab }, body: corpo });

  it('GET dá a versão no ETag', async () => {
    const r = await fetch(`${base}/tarefas/1`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('etag'), '"1"');
    assert.deepEqual(await r.json(), { titulo: 'Rever', estado: 'aberta' });
    assert.equal((await fetch(`${base}/tarefas/2`)).status, 404);
  });
  it('sem If-Match: 428', async () => {
    assert.equal((await patch('{"estado":"feita"}')).status, 428);
  });
  it('a atualização perdida é evitada: o segundo leva 412', async () => {
    const ana = await patch('{"estado":"em_curso"}', { 'If-Match': '"1"' });
    assert.equal(ana.status, 200);
    assert.equal(ana.headers.get('etag'), '"2"');
    const rui = await patch('{"titulo":"Rever o PR"}', { 'If-Match': '"1"' }); // o Rui leu a versão 1
    assert.equal(rui.status, 412);
    const rui2 = await patch('{"titulo":"Rever o PR"}', { 'If-Match': '"2"' }); // relê e tenta de novo
    assert.deepEqual(await rui2.json(), { titulo: 'Rever o PR', estado: 'em_curso' });
  });
  it('tipo errado e JSON inválido', async () => {
    const etag = (await fetch(`${base}/tarefas/1`)).headers.get('etag');
    assert.equal((await patch('{}', { 'If-Match': etag, 'Content-Type': 'application/json' })).status, 415);
    assert.equal((await patch('{nao json', { 'If-Match': etag })).status, 400);
    assert.equal((await fetch(`${base}/tarefas/1`, { method: 'DELETE' })).status, 405);
  });
});
