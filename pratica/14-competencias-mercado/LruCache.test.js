import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LruCache } from './LruCache.js';

describe('P2 · LruCache', () => {
  it('guarda e devolve valores; undefined para o que não tem', () => {
    const cache = new LruCache(2);
    cache.set('a', 1);
    assert.equal(cache.get('a'), 1);
    assert.equal(cache.get('z'), undefined);
  });

  it('set devolve a própria cache (encadeável) e size conta as chaves', () => {
    const cache = new LruCache(5).set('a', 1).set('b', 2);
    assert.ok(cache instanceof LruCache);
    assert.equal(cache.size, 2);
  });

  it('ao passar da capacidade, deita fora a chave usada há mais tempo', () => {
    const cache = new LruCache(2).set('a', 1).set('b', 2).set('c', 3);
    assert.equal(cache.has('a'), false);
    assert.equal(cache.has('b'), true);
    assert.equal(cache.has('c'), true);
    assert.equal(cache.size, 2);
  });

  it('get conta como usar: a chave lida sobrevive à próxima remoção', () => {
    const cache = new LruCache(2).set('a', 1).set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    assert.equal(cache.has('a'), true);
    assert.equal(cache.has('b'), false);
  });

  it('atualizar uma chave existente também conta como usar, e não aumenta o size', () => {
    const cache = new LruCache(2).set('a', 1).set('b', 2).set('a', 10);
    assert.equal(cache.size, 2);
    cache.set('c', 3);
    assert.equal(cache.get('a'), 10);
    assert.equal(cache.has('b'), false);
  });

  it('has NÃO conta como usar', () => {
    const cache = new LruCache(2).set('a', 1).set('b', 2);
    cache.has('a');
    cache.set('c', 3);
    assert.equal(cache.has('a'), false);
  });

  it('valores "falsy" (0, null, false) são valores como os outros', () => {
    const cache = new LruCache(3).set('zero', 0).set('nulo', null).set('falso', false);
    assert.equal(cache.get('zero'), 0);
    assert.equal(cache.get('nulo'), null);
    assert.equal(cache.has('falso'), true);
  });

  it('o estado interno é privado e size é só de leitura', () => {
    const cache = new LruCache(2).set('a', 1);
    assert.deepEqual(Object.keys(cache), [], 'a cache não deve ter propriedades públicas (usa campos #privados)');
    // Os módulos ES correm sempre em modo estrito: escrever numa propriedade só com getter lança TypeError.
    assert.throws(() => {
      cache.size = 99;
    }, TypeError);
    assert.equal(cache.size, 1);
  });
});
