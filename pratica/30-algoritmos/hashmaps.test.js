import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rapido } from './ajuda.js';
import { agruparAnagramas, doisSomam, primeiroUnico } from './hashmaps.js';

describe('P1 · doisSomam', () => {
  it('casos simples', () => {
    assert.deepEqual(doisSomam([2, 7, 11, 15], 9), [0, 1]);
    assert.deepEqual(doisSomam([3, 2, 4], 6), [1, 2]);
    assert.deepEqual(doisSomam([3, 3], 6), [0, 1], 'o mesmo número duas vezes');
    assert.deepEqual(doisSomam([-1, 8, -4], -5), [0, 2]);
  });

  it('O(n): 50 000 números com a resposta no fim', () => {
    const nums = Array.from({ length: 50_000 }, (_, i) => 1_000_000 + i * 2); // nenhum par destes soma 4
    nums.push(1, 3);
    const r = rapido(() => doisSomam(nums, 4), 200, 'doisSomam');
    assert.deepEqual(r, [50_000, 50_001]);
  });
});

describe('P1 · agruparAnagramas', () => {
  it('agrupa pela ordem de aparição', () => {
    assert.deepEqual(agruparAnagramas(['sal', 'las', 'mar', 'ram', 'sol', 'als']), [['sal', 'las', 'als'], ['mar', 'ram'], ['sol']]);
    assert.deepEqual(agruparAnagramas([]), []);
    assert.deepEqual(agruparAnagramas(['ab', 'aab', 'aba']), [['ab'], ['aab', 'aba']], 'as letras repetidas contam');
  });
});

describe('P1 · primeiroUnico', () => {
  it('encontra o primeiro carácter único', () => {
    assert.equal(primeiroUnico('abacabad'), 3);
    assert.equal(primeiroUnico('aabb'), -1);
    assert.equal(primeiroUnico('z'), 0);
    assert.equal(primeiroUnico(''), -1);
  });

  it('O(n) com 200 000 caracteres', () => {
    const texto = 'ab'.repeat(100_000) + 'c';
    assert.equal(rapido(() => primeiroUnico(texto), 300, 'primeiroUnico'), 200_000);
  });
});
