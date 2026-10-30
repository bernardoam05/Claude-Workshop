import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { deveAmostrar, guardarTrace } from './amostragem.js';

const ids = Array.from({ length: 20_000 }, () => randomBytes(16).toString('hex'));

describe('P4 · deveAmostrar', () => {
  it('é determinista: o mesmo trace dá sempre a mesma decisão', () => {
    for (const id of ids.slice(0, 100)) assert.equal(deveAmostrar(id, 0.3), deveAmostrar(id, 0.3));
  });

  it('a percentagem amostrada aproxima-se da taxa', () => {
    for (const taxa of [0.1, 0.5]) {
      const n = ids.filter((id) => deveAmostrar(id, taxa)).length / ids.length;
      assert.ok(Math.abs(n - taxa) < 0.03, `taxa ${taxa}: amostrou ${(n * 100).toFixed(1)}%`);
    }
  });

  it('os extremos', () => {
    assert.equal(deveAmostrar('ffffffffffffffffffffffffffffffff', 1), true);
    assert.equal(deveAmostrar('00000000000000000000000000000001', 0), false);
    assert.equal(deveAmostrar('ffffffffffffffff0000000000000000', 0.5), true, 'só contam os últimos 16 caracteres');
    assert.equal(deveAmostrar('0000000000000000ffffffffffffffff', 0.5), false);
  });

  it('uma taxa maior amostra tudo o que uma taxa menor amostrava', () => {
    for (const id of ids.slice(0, 2000)) if (deveAmostrar(id, 0.1)) assert.ok(deveAmostrar(id, 0.5));
  });
});

describe('P4 · guardarTrace (amostragem de cauda)', () => {
  const NUNCA = '0000000000000000ffffffffffffffff'; // com taxa < 1, nunca seria amostrado
  it('guarda sempre os traces com erro ou lentos', () => {
    assert.equal(guardarTrace([{ traceId: NUNCA, duracaoMs: 10, erro: false }, { traceId: NUNCA, duracaoMs: 5, erro: true }], { taxa: 0.01 }), true);
    assert.equal(guardarTrace([{ traceId: NUNCA, duracaoMs: 1500, erro: false }], { taxa: 0.01 }), true);
    assert.equal(guardarTrace([{ traceId: NUNCA, duracaoMs: 300, erro: false }], { taxa: 0.01, lentoMs: 200 }), true);
  });

  it('os normais seguem a taxa', () => {
    assert.equal(guardarTrace([{ traceId: NUNCA, duracaoMs: 10, erro: false }], { taxa: 0.01 }), false);
    assert.equal(guardarTrace([{ traceId: 'ffffffffffffffff0000000000000000', duracaoMs: 10, erro: false }], { taxa: 0.5 }), true);
  });
});
