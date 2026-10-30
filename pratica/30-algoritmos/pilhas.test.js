import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rapido } from './ajuda.js';
import { avaliarRPN, parentesesValidos, proximoMaior } from './pilhas.js';

describe('P3 · parentesesValidos', () => {
  it('pares bem e mal fechados', () => {
    assert.equal(parentesesValidos('({[]})'), true);
    assert.equal(parentesesValidos('f(x[1]) + {a: 2}'), true);
    assert.equal(parentesesValidos(''), true);
    assert.equal(parentesesValidos('([)]'), false);
    assert.equal(parentesesValidos('(('), false);
    assert.equal(parentesesValidos('))'), false);
    assert.equal(parentesesValidos('}'), false);
  });
});

describe('P3 · proximoMaior', () => {
  it('o próximo maior à direita', () => {
    assert.deepEqual(proximoMaior([2, 1, 2, 4, 3]), [4, 2, 4, -1, -1]);
    assert.deepEqual(proximoMaior([5, 4, 3]), [-1, -1, -1]);
    assert.deepEqual(proximoMaior([1, 2, 3]), [2, 3, -1]);
    assert.deepEqual(proximoMaior([]), []);
  });

  it('O(n) com 100 000 números a descer (o pior caso para a solução ingénua)', () => {
    const nums = Array.from({ length: 100_000 }, (_, i) => 100_000 - i);
    const r = rapido(() => proximoMaior(nums), 200, 'proximoMaior');
    assert.equal(r.length, 100_000);
    assert.ok(r.every((x) => x === -1));
  });
});

describe('P3 · avaliarRPN', () => {
  it('avalia expressões', () => {
    assert.equal(avaliarRPN(['2', '1', '+', '3', '*']), 9);
    assert.equal(avaliarRPN(['4', '13', '5', '/', '+']), 6);
    assert.equal(avaliarRPN(['7', '-2', '/']), -3, 'a divisão trunca para zero');
    assert.equal(avaliarRPN(['42']), 42);
  });

  it('expressões mal formadas', () => {
    assert.equal(avaliarRPN(['1', '2', '-']), -1);
    assert.throws(() => avaliarRPN(['1', '+']));
    assert.throws(() => avaliarRPN(['1', '2']));
    assert.throws(() => avaliarRPN([]));
    assert.throws(() => avaliarRPN(['1', 'x', '+']));
  });
});
