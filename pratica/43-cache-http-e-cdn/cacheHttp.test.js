import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { criarCacheHttp } from './cacheHttp.js';

function montar(responderCom) {
  let t = 0;
  const pedidos = [];
  const cache = criarCacheHttp({
    agora: () => t,
    origem: async (url, cab) => {
      pedidos.push({ url, cab });
      return responderCom(url, cab, pedidos.length);
    },
  });
  return { cache, pedidos, avancar: (s) => (t += s * 1000) };
}
const ok = (cabecalhos, corpo = 'x') => ({ estado: 200, cabecalhos, corpo });

describe('P3 · cache HTTP partilhada', () => {
  it('MISS e depois HIT enquanto está fresca', async () => {
    const { cache, pedidos, avancar } = montar(() => ok({ 'cache-control': 's-maxage=60' }));
    assert.equal((await cache.obter('/a')).cache, 'MISS');
    avancar(59);
    const r = await cache.obter('/a');
    assert.equal(r.cache, 'HIT');
    assert.equal(r.corpo, 'x');
    assert.equal(pedidos.length, 1);
    avancar(2);
    assert.equal((await cache.obter('/a')).cache, 'MISS');
  });
  it('não guarda private, no-store, nem erros', async () => {
    for (const r of [ok({ 'cache-control': 'private, max-age=60' }), ok({ 'cache-control': 'no-store', etag: '"e"' }), { estado: 500, cabecalhos: { 'cache-control': 'max-age=60' }, corpo: '' }]) {
      const { cache, pedidos } = montar(() => r);
      await cache.obter('/a');
      await cache.obter('/a');
      assert.equal(pedidos.length, 2, JSON.stringify(r));
    }
  });
  it('revalida com If-None-Match e aproveita o 304', async () => {
    const { cache, pedidos, avancar } = montar((url, cab, n) =>
      n === 1 ? ok({ 'cache-control': 'max-age=10', etag: '"v1"' }, 'corpo grande') : { estado: 304, cabecalhos: {}, corpo: '' },
    );
    await cache.obter('/a');
    avancar(11);
    const r = await cache.obter('/a');
    assert.equal(r.cache, 'REVALIDADA');
    assert.equal(r.corpo, 'corpo grande');
    assert.equal(pedidos[1].cab['if-none-match'], '"v1"');
    avancar(5);
    assert.equal((await cache.obter('/a')).cache, 'HIT', 'voltou a ficar fresca por mais 10 s');
  });
  it('no-cache: guarda, mas revalida sempre', async () => {
    const { cache, pedidos } = montar((url, cab, n) => (n === 1 ? ok({ 'cache-control': 'no-cache', etag: '"v1"' }) : { estado: 304, cabecalhos: {}, corpo: '' }));
    await cache.obter('/a');
    assert.equal((await cache.obter('/a')).cache, 'REVALIDADA');
    assert.equal(pedidos.length, 2);
  });
  it('Vary: uma entrada por valor do cabeçalho', async () => {
    const { cache, pedidos } = montar((url, cab) => ok({ 'cache-control': 'max-age=60', vary: 'Accept-Language' }, cab['accept-language']));
    assert.equal((await cache.obter('/a', { 'accept-language': 'pt' })).corpo, 'pt');
    assert.equal((await cache.obter('/a', { 'accept-language': 'en' })).corpo, 'en');
    const r = await cache.obter('/a', { 'accept-language': 'pt' });
    assert.deepEqual([r.cache, r.corpo], ['HIT', 'pt']);
    assert.equal(pedidos.length, 2);
  });
  it('stale-if-error: serve a obsoleta se a origem falhar, dentro do prazo', async () => {
    const { cache, avancar } = montar((url, cab, n) => {
      if (n > 1) throw new Error('origem em baixo');
      return ok({ 'cache-control': 'max-age=10, stale-if-error=60' }, 'antiga');
    });
    await cache.obter('/a');
    avancar(30);
    const r = await cache.obter('/a');
    assert.deepEqual([r.cache, r.corpo], ['OBSOLETA', 'antiga']);
    avancar(60);
    await assert.rejects(cache.obter('/a'), /origem em baixo/);
  });
});
