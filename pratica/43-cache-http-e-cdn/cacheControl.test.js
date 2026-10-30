import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { interpretarCacheControl, politica, tempoDeVida } from './cacheControl.js';

describe('P1 · interpretarCacheControl', () => {
  it('lê diretivas com e sem valor', () => {
    assert.deepEqual(interpretarCacheControl('Public, max-age=60, S-MAXAGE="300", no-cache, ,'), {
      public: true,
      'max-age': 60,
      's-maxage': 300,
      'no-cache': true,
    });
  });
  it('valores que não são números ficam texto', () => {
    assert.deepEqual(interpretarCacheControl('private="set-cookie"'), { private: 'set-cookie' });
  });
  it('vazio ou em falta dá {}', () => {
    assert.deepEqual(interpretarCacheControl(''), {});
    assert.deepEqual(interpretarCacheControl(), {});
  });
});

describe('P1 · tempoDeVida', () => {
  it('max-age', () => {
    assert.equal(tempoDeVida({ 'cache-control': 'max-age=120' }), 120);
  });
  it('s-maxage só conta numa cache partilhada', () => {
    const h = { 'cache-control': 'max-age=60, s-maxage=600' };
    assert.equal(tempoDeVida(h), 60);
    assert.equal(tempoDeVida(h, { partilhada: true }), 600);
  });
  it('private: o browser guarda, a CDN não', () => {
    const h = { 'cache-control': 'private, max-age=60' };
    assert.equal(tempoDeVida(h), 60);
    assert.equal(tempoDeVida(h, { partilhada: true }), 0);
  });
  it('no-store ganha a tudo', () => {
    assert.equal(tempoDeVida({ 'cache-control': 'no-store, max-age=60' }), 0);
  });
  it('Expires − Date quando não há max-age', () => {
    const h = { date: 'Thu, 29 Oct 2026 10:00:00 GMT', expires: 'Thu, 29 Oct 2026 10:05:00 GMT' };
    assert.equal(tempoDeVida(h), 300);
    assert.equal(tempoDeVida({ ...h, expires: 'Thu, 29 Oct 2026 09:00:00 GMT' }), 0);
    assert.equal(tempoDeVida({ ...h, 'cache-control': 'max-age=5' }), 5, 'max-age tem prioridade');
  });
  it('sem nada, 0', () => {
    assert.equal(tempoDeVida({}), 0);
  });
});

describe('P1 · politica', () => {
  it('cada tipo tem a sua política', () => {
    assert.equal(politica('estatico-com-hash'), 'public, max-age=31536000, immutable');
    assert.equal(politica('html'), 'no-cache');
    assert.equal(politica('api-privada'), 'private, no-cache');
    assert.equal(politica('sensivel'), 'no-store');
    assert.equal(tempoDeVida({ 'cache-control': politica('api-publica') }, { partilhada: true }), 300);
  });
  it('tipo desconhecido', () => {
    assert.throws(() => politica('toString'), /toString/);
  });
});
