import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rapido } from './ajuda.js';
import { formasDeSubir, maiorSubsequenciaComum, trocoMinimo } from './dinamica.js';

describe('P6 · formasDeSubir', () => {
  it('casos pequenos', () => {
    assert.deepEqual([1, 2, 3, 4, 5].map(formasDeSubir), [1n, 2n, 3n, 5n, 8n]);
  });

  it('n = 90 instantaneamente (e com BigInt: o número não cabe num Number exato)', () => {
    assert.equal(rapido(() => formasDeSubir(90), 50, 'formasDeSubir'), 4660046610375530309n);
  });
});

describe('P6 · trocoMinimo', () => {
  it('o mínimo de moedas', () => {
    assert.equal(trocoMinimo([1, 5, 10, 25], 63), 6);
    assert.equal(trocoMinimo([1, 3, 4], 6), 2, 'o guloso dava 3');
    assert.equal(trocoMinimo([2], 3), -1);
    assert.equal(trocoMinimo([5], 0), 0);
  });

  it('rápido para totais grandes', () => {
    assert.equal(rapido(() => trocoMinimo([1, 7, 13, 29, 41], 50_000), 500, 'trocoMinimo'), 1222);
  });
});

describe('P6 · maiorSubsequenciaComum', () => {
  it('o tamanho da LCS', () => {
    assert.equal(maiorSubsequenciaComum('ABCBDAB', 'BDCABA'), 4);
    assert.equal(maiorSubsequenciaComum('abc', 'def'), 0);
    assert.equal(maiorSubsequenciaComum('', 'abc'), 0);
    assert.equal(maiorSubsequenciaComum('programar', 'programa'), 8);
  });

  it('O(n·m) com dois textos de 2 000 caracteres', () => {
    const a = 'acgt'.repeat(500);
    const b = 'tgca'.repeat(500);
    rapido(() => maiorSubsequenciaComum(a, b), 1500, 'maiorSubsequenciaComum');
  });
});
