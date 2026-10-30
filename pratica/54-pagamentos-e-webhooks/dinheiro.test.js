import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { comIva, formatar, paraCentimos, repartir } from './dinheiro.js';

describe('P1 · paraCentimos', () => {
  for (const [t, c] of [['12,34', 1234], ['1.234,5', 123450], ['7', 700], ['-0,05', -5], [' 0,1 ', 10], ['1234567,89', 123456789]]) {
    it(`${JSON.stringify(t)} → ${c}`, () => assert.equal(paraCentimos(t), c));
  }
  it('não sofre do 0.1 + 0.2', () => {
    assert.equal(paraCentimos('0,1') + paraCentimos('0,2'), paraCentimos('0,3'));
  });
  for (const t of ['', 'abc', '1,234', '12.34', '1.23,00', '--1']) {
    it(`recusa ${JSON.stringify(t)}`, () => assert.throws(() => paraCentimos(t), /Valor inválido/));
  }
});

describe('P1 · formatar', () => {
  it('à portuguesa', () => {
    assert.equal(formatar(123456), '1234,56 €');
    assert.equal(formatar(-5), '-0,05 €');
    assert.equal(formatar(12345678), '123 456,78 €');
  });
});

describe('P1 · repartir', () => {
  it('soma sempre o total', () => {
    assert.deepEqual(repartir(1000, 3), [334, 333, 333]);
    assert.deepEqual(repartir(5, 4), [2, 1, 1, 1]);
    assert.deepEqual(repartir(900, 3), [300, 300, 300]);
    for (let n = 1; n <= 7; n++) assert.equal(repartir(1001, n).reduce((a, b) => a + b, 0), 1001);
  });
  it('recusa partes inválidas', () => {
    assert.throws(() => repartir(100, 0), /partes inválido/);
    assert.throws(() => repartir(100, 1.5), /partes inválido/);
  });
});

describe('P1 · comIva', () => {
  it('calcula em cêntimos inteiros', () => {
    assert.deepEqual(comIva(1000, 23), { base: 1000, iva: 230, total: 1230 });
    assert.deepEqual(comIva(999, 23), { base: 999, iva: 230, total: 1229 });
    assert.deepEqual(comIva(250, 6), { base: 250, iva: 15, total: 265 });
  });
});
