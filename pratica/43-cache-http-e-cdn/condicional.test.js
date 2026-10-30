import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { corresponde, etag, responder } from './condicional.js';

const corpo = JSON.stringify({ tarefas: [1, 2, 3] });
const modificadoEm = new Date('2026-10-29T10:00:00.500Z');
let servidor;
let base;
before(async () => {
  servidor = createServer((req, res) => {
    try {
      responder(req, res, { corpo, modificadoEm, cacheControl: 'no-cache' });
    } catch (e) {
      res.statusCode = 500;
      res.end(e.message);
    }
  });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => servidor.close());

describe('P2 · etag e corresponde', () => {
  it('o ETag é estável e muda com o conteúdo', () => {
    assert.match(etag('abc'), /^"[\w-]{16}"$/);
    assert.equal(etag('abc'), etag('abc'));
    assert.notEqual(etag('abc'), etag('abd'));
  });
  it('If-None-Match com listas, W/ e *', () => {
    assert.equal(corresponde('"x", W/"y"', '"y"'), true);
    assert.equal(corresponde('W/"x"', 'W/"x"'), true);
    assert.equal(corresponde('*', '"z"'), true);
    assert.equal(corresponde('"x"', '"z"'), false);
    assert.equal(corresponde(undefined, '"z"'), false);
  });
});

describe('P2 · responder', () => {
  it('a primeira resposta traz o corpo e os validadores', async () => {
    const r = await fetch(base);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('etag'), etag(corpo));
    assert.equal(r.headers.get('last-modified'), 'Thu, 29 Oct 2026 10:00:00 GMT');
    assert.equal(r.headers.get('cache-control'), 'no-cache');
    assert.equal(await r.text(), corpo);
  });
  it('304 sem corpo quando o ETag corresponde', async () => {
    const r = await fetch(base, { headers: { 'If-None-Match': etag(corpo) } });
    assert.equal(r.status, 304);
    assert.equal(await r.text(), '');
    assert.equal(r.headers.get('etag'), etag(corpo));
  });
  it('200 quando o ETag é outro, mesmo com If-Modified-Since recente', async () => {
    const r = await fetch(base, { headers: { 'If-None-Match': '"velho"', 'If-Modified-Since': 'Fri, 30 Oct 2026 00:00:00 GMT' } });
    assert.equal(r.status, 200);
  });
  it('If-Modified-Since: 304 se não mudou (ao segundo), 200 se mudou', async () => {
    assert.equal((await fetch(base, { headers: { 'If-Modified-Since': 'Thu, 29 Oct 2026 10:00:00 GMT' } })).status, 304);
    assert.equal((await fetch(base, { headers: { 'If-Modified-Since': 'Thu, 29 Oct 2026 09:59:59 GMT' } })).status, 200);
  });
  it('os pedidos que não são GET/HEAD não são condicionais', async () => {
    const r = await fetch(base, { method: 'POST', headers: { 'If-None-Match': '*' } });
    assert.equal(r.status, 200);
  });
});
