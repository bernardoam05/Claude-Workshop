import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { increase, rate } from './rate.js';

// Amostras de um contador de pedidos, recolhidas de 15 em 15 s (o scrape_interval do projeto).
const amostras = (...valores) => valores.map((valor, i) => ({ t: i * 15, valor }));

describe('P2 · increase', () => {
  it('é a diferença entre a última e a primeira amostra', () => {
    assert.equal(increase(amostras(100, 130, 160, 220)), 120);
  });

  it('um contador que desce foi reiniciado: a subida desse intervalo conta desde 0', () => {
    // 100 → 130 (+30), reinício → 10 (+10, desde 0), → 40 (+30)
    assert.equal(increase(amostras(100, 130, 10, 40)), 70);
  });

  it('dois reinícios seguidos', () => {
    assert.equal(increase(amostras(50, 5, 2, 12)), 5 + 2 + 10);
  });

  it('com menos de duas amostras não há subida', () => {
    assert.equal(increase(amostras(42)), 0);
    assert.equal(increase([]), 0);
  });
});

describe('P2 · rate', () => {
  it('é a subida a dividir pelo tempo: pedidos por segundo', () => {
    // 120 pedidos em 45 s
    assert.equal(rate(amostras(100, 130, 160, 220)), 120 / 45);
  });

  it('não dá negativo depois de um reinício (era assim que se via um "pico" falso de -900%)', () => {
    assert.ok(rate(amostras(1000, 1010, 5, 15)) > 0);
  });

  it('com menos de duas amostras, 0', () => {
    assert.equal(rate(amostras(7)), 0);
  });
});
