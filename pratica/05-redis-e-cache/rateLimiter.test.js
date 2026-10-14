import assert from 'node:assert/strict';
import { once } from 'node:events';
import { describe, it } from 'node:test';
import express from 'express';
import { createFakeRedis } from './fakeRedis.js';
import { createRateLimiter, rateLimitMiddleware } from './rateLimiter.js';

describe('P2 · createRateLimiter', () => {
  it('deixa passar até ao limite e bloqueia a seguir', async () => {
    const limiter = createRateLimiter(createFakeRedis({ now: () => 0 }), { limit: 3, windowSeconds: 60 });
    assert.deepEqual(await limiter.hit('1.2.3.4'), { allowed: true, remaining: 2, retryAfter: 0 });
    assert.deepEqual(await limiter.hit('1.2.3.4'), { allowed: true, remaining: 1, retryAfter: 0 });
    assert.deepEqual(await limiter.hit('1.2.3.4'), { allowed: true, remaining: 0, retryAfter: 0 });
    assert.deepEqual(await limiter.hit('1.2.3.4'), { allowed: false, remaining: 0, retryAfter: 60 });
  });

  it('cada IP tem o seu contador, na chave ratelimit:<ip>', async () => {
    const redis = createFakeRedis();
    const limiter = createRateLimiter(redis, { limit: 1, windowSeconds: 60 });
    await limiter.hit('1.1.1.1');
    assert.equal((await limiter.hit('2.2.2.2')).allowed, true);
    assert.equal(await redis.get('ratelimit:1.1.1.1'), '1');
  });

  it('a janela recomeça quando a chave expira', async () => {
    let agora = 0;
    const limiter = createRateLimiter(createFakeRedis({ now: () => agora }), { limit: 1, windowSeconds: 10 });
    await limiter.hit('ip');
    agora = 4_000;
    assert.deepEqual(await limiter.hit('ip'), { allowed: false, remaining: 0, retryAfter: 6 });
    agora = 10_000;
    assert.equal((await limiter.hit('ip')).allowed, true);
  });

  it('o TTL só é posto no 1.º pedido da janela (senão a janela nunca acabava)', async () => {
    let agora = 0;
    const redis = createFakeRedis({ now: () => agora });
    const limiter = createRateLimiter(redis, { limit: 100, windowSeconds: 10 });
    await limiter.hit('ip');
    agora = 5_000;
    await limiter.hit('ip');
    assert.equal(await redis.ttl('ratelimit:ip'), 5, 'o 2.º pedido não pode empurrar o fim da janela');
  });

  it('repara uma chave que ficou sem TTL (o processo morreu entre o INCR e o EXPIRE)', async () => {
    const redis = createFakeRedis({ now: () => 0 });
    await redis.set('ratelimit:ip', '7'); // sem EX: sem TTL, este IP ficaria bloqueado PARA SEMPRE
    const limiter = createRateLimiter(redis, { limit: 3, windowSeconds: 60 });
    await limiter.hit('ip');
    assert.equal(await redis.ttl('ratelimit:ip'), 60);
  });
});

describe('P2 · rateLimitMiddleware', () => {
  it('põe X-RateLimit-Remaining e responde 429 com Retry-After quando passa do limite', async () => {
    const limiter = createRateLimiter(createFakeRedis({ now: () => 0 }), { limit: 2, windowSeconds: 30 });
    const app = express();
    app.use(rateLimitMiddleware(limiter));
    app.get('/', (req, res) => res.json({ ok: true }));

    const server = app.listen(0);
    await once(server, 'listening');
    const url = `http://localhost:${server.address().port}/`;
    try {
      const r1 = await fetch(url);
      assert.equal(r1.status, 200);
      assert.equal(r1.headers.get('x-ratelimit-remaining'), '1');
      const r2 = await fetch(url);
      assert.equal(r2.headers.get('x-ratelimit-remaining'), '0');

      const r3 = await fetch(url);
      assert.equal(r3.status, 429);
      assert.equal(r3.headers.get('retry-after'), '30');
      assert.equal(r3.headers.get('x-ratelimit-remaining'), '0');
      assert.equal(typeof (await r3.json()).error, 'string');
    } finally {
      server.close();
    }
  });
});
