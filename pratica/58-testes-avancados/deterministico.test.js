import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { adiar, baralhar, mulberry32 } from './deterministico.js';

describe('P4 · mulberry32', () => {
  it('a mesma semente dá a mesma sequência', () => {
    const r = mulberry32(42);
    assert.deepEqual([r(), r(), r()], [0.6011037519201636, 0.44829055899754167, 0.8524657934904099]);
  });
  it('fica em [0, 1) e sementes diferentes dão sequências diferentes', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const x = r();
      assert.ok(x >= 0 && x < 1);
    }
    assert.notEqual(mulberry32(1)(), mulberry32(2)());
  });
});

describe('P4 · baralhar', () => {
  it('é reprodutível com uma semente, e não muda o original', () => {
    const lista = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = baralhar(lista, mulberry32(1));
    assert.deepEqual(a, baralhar(lista, mulberry32(1)));
    assert.deepEqual(lista, [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual([...a].sort((x, y) => x - y), lista);
  });
  it('segue o Fisher-Yates à letra', () => {
    // com aleatorio sempre 0, j = 0 em cada passo
    assert.deepEqual(baralhar(['a', 'b', 'c', 'd'], () => 0), ['b', 'c', 'd', 'a']);
    // com aleatorio quase 1, j = i: nada muda
    assert.deepEqual(baralhar(['a', 'b', 'c'], () => 0.9999), ['a', 'b', 'c']);
  });
  it('não tem enviesamento grosseiro', () => {
    const r = mulberry32(3);
    const primeiros = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 3000; i++) primeiros[baralhar(['a', 'b', 'c'], r)[0]]++;
    for (const n of Object.values(primeiros)) assert.ok(n > 850 && n < 1150, JSON.stringify(primeiros));
  });
});

describe('P4 · adiar (com relógio falso)', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }));
  afterEach(() => mock.timers.reset());

  it('só corre quando as chamadas param, com os últimos argumentos', () => {
    const chamadas = [];
    const f = adiar((x) => chamadas.push(x), 300);
    f('a');
    mock.timers.tick(200);
    f('ab');
    mock.timers.tick(200);
    f('abc');
    assert.deepEqual(chamadas, []);
    mock.timers.tick(299);
    assert.deepEqual(chamadas, []);
    mock.timers.tick(1);
    assert.deepEqual(chamadas, ['abc']);
  });
  it('pode correr várias vezes, se houver pausas', () => {
    const chamadas = [];
    const f = adiar((x) => chamadas.push(x), 100);
    f(1);
    mock.timers.tick(100);
    f(2);
    mock.timers.tick(100);
    assert.deepEqual(chamadas, [1, 2]);
  });
  it('cancelar', () => {
    const chamadas = [];
    const f = adiar(() => chamadas.push(1), 100);
    f();
    f.cancelar();
    mock.timers.tick(1000);
    assert.deepEqual(chamadas, []);
  });
});
