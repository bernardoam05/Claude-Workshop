import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFakeRedis } from './fakeRedis.js';
import { createCachedLoader } from './singleFlight.js';

// Um load() lento (como uma query pesada), que conta as chamadas.
function loadLento(valor, ms = 20) {
  const load = async () => {
    load.calls++;
    await new Promise((resolve) => setTimeout(resolve, ms));
    return valor;
  };
  load.calls = 0;
  return load;
}

describe('P3 · createCachedLoader (single flight)', () => {
  it('50 pedidos simultâneos com MISS fazem UMA só ida à BD', async () => {
    const get = createCachedLoader(createFakeRedis(), { ttlSeconds: 60 });
    const load = loadLento({ total: 42 });

    const resultados = await Promise.all(Array.from({ length: 50 }, () => get('stats', load)));

    assert.equal(load.calls, 1);
    for (const r of resultados) assert.deepEqual(r, { value: { total: 42 }, source: 'database' });
  });

  it('chaves diferentes não esperam umas pelas outras', async () => {
    const get = createCachedLoader(createFakeRedis(), { ttlSeconds: 60 });
    const a = loadLento('A');
    const b = loadLento('B');
    await Promise.all([get('a', a), get('b', b), get('a', a)]);
    assert.equal(a.calls, 1);
    assert.equal(b.calls, 1);
  });

  it('depois de o load acabar, os pedidos seguintes são HIT normais', async () => {
    const get = createCachedLoader(createFakeRedis(), { ttlSeconds: 60 });
    const load = loadLento('x');
    await get('k', load);
    assert.deepEqual(await get('k', load), { value: 'x', source: 'cache' });
    assert.equal(load.calls, 1);
  });

  it('se o load falhar, todos os que esperavam recebem o erro, e o próximo pedido tenta outra vez', async () => {
    const get = createCachedLoader(createFakeRedis(), { ttlSeconds: 60 });
    let tentativas = 0;
    const falhaUmaVez = async () => {
      tentativas++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (tentativas === 1) throw new Error('timeout da BD');
      return 'recuperou';
    };

    const resultados = await Promise.allSettled([get('k', falhaUmaVez), get('k', falhaUmaVez)]);
    assert.deepEqual(resultados.map((r) => r.status), ['rejected', 'rejected']);
    assert.equal(tentativas, 1);

    assert.deepEqual(await get('k', falhaUmaVez), { value: 'recuperou', source: 'database' });
  });
});
