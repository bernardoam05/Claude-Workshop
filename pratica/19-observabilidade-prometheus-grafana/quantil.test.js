import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { histogramQuantile } from './quantil.js';

// 100 pedidos: 50 com ≤ 0.1 s, 90 com ≤ 0.5 s, 99 com ≤ 1 s, e 1 mais lento.
const buckets = [
  { le: 0.1, contagem: 50 },
  { le: 0.5, contagem: 90 },
  { le: 1, contagem: 99 },
  { le: Infinity, contagem: 100 },
];
const perto = (atual, esperado) => assert.ok(Math.abs(atual - esperado) < 1e-9, `${atual} ≠ ${esperado}`);

describe('P3 · histogramQuantile', () => {
  it('p50: a mediana cai no fim do primeiro bucket', () => {
    perto(histogramQuantile(0.5, buckets), 0.1);
  });

  it('p25: interpola dentro do primeiro bucket, a partir de 0', () => {
    perto(histogramQuantile(0.25, buckets), 0.05);
  });

  it('p70: interpola dentro do segundo bucket, entre 0.1 e 0.5', () => {
    // posição 70: 20 das 40 observações do bucket (0.1, 0.5] → a meio → 0.3
    perto(histogramQuantile(0.7, buckets), 0.3);
  });

  it('p95: no terceiro bucket', () => {
    // posição 95: 5 das 9 observações do bucket (0.5, 1] → 0.5 + 0.5 × 5/9
    perto(histogramQuantile(0.95, buckets), 0.5 + 0.5 * (5 / 9));
  });

  it('p99.9: no bucket +Inf não se sabe nada; devolve o maior limite finito', () => {
    assert.equal(histogramQuantile(0.999, buckets), 1);
  });

  it('sem observações: NaN', () => {
    assert.ok(Number.isNaN(histogramQuantile(0.95, [{ le: 0.1, contagem: 0 }, { le: Infinity, contagem: 0 }])));
  });
});
