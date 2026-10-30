import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { criarRouter } from './rotas.js';

const router = criarRouter([
  'app/page.js',
  'app/layout.js',
  'app/tarefas/page.js',
  'app/tarefas/[id]/page.js',
  'app/tarefas/nova/page.js',
  'app/tarefas/[id]/editar/page.js',
  'app/docs/[...partes]/page.js',
  'app/loja/[[...filtros]]/page.js',
  'app/(marketing)/sobre/page.js',
  'app/[utilizador]/page.js',
]);
const r = (c) => router.resolver(c);

describe('P1 · rotas por ficheiros', () => {
  it('a raiz e rotas estáticas', () => {
    assert.deepEqual(r('/'), { ficheiro: 'app/page.js', params: {} });
    assert.deepEqual(r('/tarefas'), { ficheiro: 'app/tarefas/page.js', params: {} });
    assert.deepEqual(r('/tarefas/'), { ficheiro: 'app/tarefas/page.js', params: {} });
  });
  it('segmentos dinâmicos, descodificados', () => {
    assert.deepEqual(r('/tarefas/42'), { ficheiro: 'app/tarefas/[id]/page.js', params: { id: '42' } });
    assert.deepEqual(r('/tarefas/a%20b/editar'), { ficheiro: 'app/tarefas/[id]/editar/page.js', params: { id: 'a b' } });
  });
  it('o estático ganha ao dinâmico', () => {
    assert.deepEqual(r('/tarefas/nova'), { ficheiro: 'app/tarefas/nova/page.js', params: {} });
    assert.deepEqual(r('/tarefas'), { ficheiro: 'app/tarefas/page.js', params: {} }, 'e não [utilizador]');
  });
  it('apanha-tudo: um ou mais segmentos', () => {
    assert.deepEqual(r('/docs/guia/instalar'), { ficheiro: 'app/docs/[...partes]/page.js', params: { partes: ['guia', 'instalar'] } });
    assert.deepEqual(r('/docs'), { ficheiro: 'app/[utilizador]/page.js', params: { utilizador: 'docs' } }, '/docs sozinho não serve ao [...partes]');
  });
  it('apanha-tudo opcional: zero ou mais', () => {
    assert.deepEqual(r('/loja'), { ficheiro: 'app/loja/[[...filtros]]/page.js', params: { filtros: [] } }, "o 'loja' estático ganha ao [utilizador]");
    assert.deepEqual(r('/loja/livros/novos'), { ficheiro: 'app/loja/[[...filtros]]/page.js', params: { filtros: ['livros', 'novos'] } });
  });
  it('os grupos não aparecem no URL', () => {
    assert.deepEqual(r('/sobre'), { ficheiro: 'app/(marketing)/sobre/page.js', params: {} });
  });
  it('só os page.js são rotas, e o que não existe dá null', () => {
    assert.equal(r('/tarefas/42/apagar'), null);
    assert.equal(criarRouter(['app/layout.js']).resolver('/'), null);
  });
  it('apanha-tudo opcional sem nada à frente', () => {
    assert.deepEqual(criarRouter(['app/loja/[[...f]]/page.js']).resolver('/loja'), { ficheiro: 'app/loja/[[...f]]/page.js', params: { f: [] } });
  });
});
