import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { atribuirRange, atribuirRoundRobin } from './atribuicao.js';

describe('P2 · atribuirRange', () => {
  it('divisão exata: 6 partições por 3 consumidores', () => {
    assert.deepEqual(atribuirRange(6, ['a', 'b', 'c']), { a: [0, 1], b: [2, 3], c: [4, 5] });
  });

  it('divisão não exata: os primeiros recebem uma a mais', () => {
    assert.deepEqual(atribuirRange(7, ['a', 'b', 'c']), { a: [0, 1, 2], b: [3, 4], c: [5, 6] });
  });

  it('os consumidores são ordenados alfabeticamente antes de dividir', () => {
    assert.deepEqual(atribuirRange(3, ['worker-b', 'worker-a']), { 'worker-a': [0, 1], 'worker-b': [2] });
  });

  it('mais consumidores do que partições: os que sobram ficam parados (com [])', () => {
    // O projeto tem 3 partições: um 4.º consumidor no mesmo grupo não recebe nada para fazer.
    assert.deepEqual(atribuirRange(3, ['a', 'b', 'c', 'd']), { a: [0], b: [1], c: [2], d: [] });
  });

  it('não altera a lista que recebe', () => {
    const consumidores = Object.freeze(['b', 'a']);
    assert.doesNotThrow(() => atribuirRange(2, consumidores));
  });
});

describe('P2 · atribuirRoundRobin', () => {
  it('distribui à vez, como quem dá cartas', () => {
    assert.deepEqual(atribuirRoundRobin(7, ['a', 'b', 'c']), { a: [0, 3, 6], b: [1, 4], c: [2, 5] });
  });

  it('também ordena, e também deixa os que sobram com []', () => {
    assert.deepEqual(atribuirRoundRobin(2, ['c', 'a', 'b']), { a: [0], b: [1], c: [] });
  });

  it('cada partição fica com exatamente um consumidor', () => {
    const resultado = atribuirRoundRobin(10, ['x', 'y', 'z']);
    assert.deepEqual(Object.values(resultado).flat().sort((p, q) => p - q), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
