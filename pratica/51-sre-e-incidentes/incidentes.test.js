import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { metricas, severidade } from './incidentes.js';

describe('P3 · severidade', () => {
  it('perda de dados é sempre SEV1', () => {
    assert.equal(severidade({ fracaoAfetada: 0.001, perdaDeDados: true }), 'SEV1');
  });
  it('metade dos utilizadores é SEV1', () => {
    assert.equal(severidade({ fracaoAfetada: 0.5, haContorno: true }), 'SEV1');
  });
  it('10% sem contorno é SEV2; com contorno é SEV3', () => {
    assert.equal(severidade({ fracaoAfetada: 0.1 }), 'SEV2');
    assert.equal(severidade({ fracaoAfetada: 0.1, haContorno: true }), 'SEV3');
  });
  it('poucos afetados é SEV3', () => {
    assert.equal(severidade({ fracaoAfetada: 0.01 }), 'SEV3');
  });
});

describe('P3 · metricas', () => {
  it('calcula o MTTD e o MTTR médios em minutos', () => {
    const r = metricas([
      { inicio: '2026-10-01T10:00:00Z', detetado: '2026-10-01T10:05:00Z', resolvido: '2026-10-01T10:45:00Z' },
      { inicio: '2026-10-07T22:00:00Z', detetado: '2026-10-07T22:20:00Z', resolvido: '2026-10-08T00:00:00Z' },
    ]);
    assert.deepEqual(r, { mttdMin: 12.5, mttrMin: 82.5, total: 2 });
  });
  it('arredonda a uma casa decimal', () => {
    const r = metricas([
      { inicio: '2026-10-01T10:00:00Z', detetado: '2026-10-01T10:00:20Z', resolvido: '2026-10-01T10:01:00Z' },
    ]);
    assert.deepEqual(r, { mttdMin: 0.3, mttrMin: 1, total: 1 });
  });
  it('sem incidentes, tudo a zero', () => {
    assert.deepEqual(metricas([]), { mttdMin: 0, mttrMin: 0, total: 0 });
  });
  it('rejeita datas fora de ordem', () => {
    assert.throws(
      () => metricas([{ inicio: '2026-10-01T10:00:00Z', detetado: '2026-10-01T09:00:00Z', resolvido: '2026-10-01T11:00:00Z' }]),
      Error,
    );
  });
});
