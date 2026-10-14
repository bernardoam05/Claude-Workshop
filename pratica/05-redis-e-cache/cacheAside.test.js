import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cached } from './cacheAside.js';
import { createFakeRedis } from './fakeRedis.js';

// Um load() falso que conta quantas vezes foi chamado (= quantas idas à "BD").
function contador(valor) {
  const load = async () => {
    load.calls++;
    return valor;
  };
  load.calls = 0;
  return load;
}

describe('P1 · cached (cache-aside)', () => {
  it('1.º pedido vai à BD (MISS), o 2.º vem da cache (HIT)', async () => {
    const redis = createFakeRedis();
    const load = contador([{ id: 1, title: 'Estudar Redis' }]);

    assert.deepEqual(await cached(redis, 'tasks:user:1', 60, load), {
      value: [{ id: 1, title: 'Estudar Redis' }],
      source: 'database',
    });
    assert.deepEqual(await cached(redis, 'tasks:user:1', 60, load), {
      value: [{ id: 1, title: 'Estudar Redis' }],
      source: 'cache',
    });
    assert.equal(load.calls, 1);
  });

  it('guarda JSON com TTL (SET chave valor EX segundos)', async () => {
    const redis = createFakeRedis();
    await cached(redis, 'k', 30, contador({ a: 1 }));
    assert.equal(await redis.get('k'), '{"a":1}', 'o valor no Redis tem de ser JSON');
    assert.equal(await redis.ttl('k'), 30, 'a chave tem de ter TTL de 30 s');
  });

  it('depois de o TTL passar, volta à BD', async () => {
    let agora = 0;
    const redis = createFakeRedis({ now: () => agora });
    const load = contador('x');
    await cached(redis, 'k', 10, load);
    agora = 9_000;
    assert.equal((await cached(redis, 'k', 10, load)).source, 'cache');
    agora = 10_000;
    assert.equal((await cached(redis, 'k', 10, load)).source, 'database');
    assert.equal(load.calls, 2);
  });

  it('valores "falsy" (0, false, "", []) também são HIT', async () => {
    // O projeto faz `if (cached)`: funciona lá, porque guarda sempre arrays/objetos.
    // Numa função genérica, um 0 em cache não pode ser confundido com "não há nada".
    for (const valor of [0, false, '', []]) {
      const redis = createFakeRedis();
      const load = contador(valor);
      await cached(redis, 'k', 60, load);
      const segunda = await cached(redis, 'k', 60, load);
      assert.deepEqual(segunda, { value: valor, source: 'cache' }, `valor ${JSON.stringify(valor)}`);
      assert.equal(load.calls, 1);
    }
  });

  it('Redis em baixo: a aplicação continua a responder, a partir da BD', async () => {
    const redis = createFakeRedis();
    redis.failing = true;
    assert.deepEqual(await cached(redis, 'k', 60, contador('da BD')), { value: 'da BD', source: 'database' });
  });

  it('um erro do load() (a BD) NÃO é engolido: chega a quem chamou', async () => {
    const redis = createFakeRedis();
    await assert.rejects(
      cached(redis, 'k', 60, async () => {
        throw new Error('BD em baixo');
      }),
      /BD em baixo/,
    );
    assert.equal(await redis.get('k'), null, 'nada pode ficar guardado em cache quando o load falha');
  });
});
