import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { indisponibilidadePermitida, orcamento, sli } from './slo.js';

const perto = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

describe('P1 · sli', () => {
  it('conta como maus os 5xx e os lentos, e como bons os 4xx', () => {
    const pedidos = [
      { estado: 200, ms: 100 },
      { estado: 404, ms: 50 }, // erro do cliente: bom
      { estado: 503, ms: 10 }, // erro do servidor: mau
      { estado: 200, ms: 900 }, // lento: mau
    ];
    perto(sli(pedidos, { latenciaMaxMs: 300 }), 0.5);
  });
  it('o limite de latência é inclusivo', () => {
    perto(sli([{ estado: 200, ms: 300 }], { latenciaMaxMs: 300 }), 1);
  });
  it('sem pedidos, o SLI é 1', () => {
    assert.equal(sli([], { latenciaMaxMs: 300 }), 1);
  });
});

describe('P1 · orcamento', () => {
  it('99,9% em 1 000 000 de pedidos permite 1000 maus', () => {
    const o = orcamento({ slo: 0.999, total: 1_000_000, maus: 250 });
    perto(o.permitidos, 1000);
    assert.equal(o.gastos, 250);
    perto(o.restante, 0.75);
  });
  it('fica negativo quando o SLO é violado', () => {
    perto(orcamento({ slo: 0.99, total: 1000, maus: 20 }).restante, -1);
  });
});

describe('P1 · indisponibilidadePermitida', () => {
  it('99,9% em 30 dias são 43,2 minutos', () => {
    perto(indisponibilidadePermitida(0.999, 30), 43.2);
  });
  it('99,99% em 365 dias são ~52,6 minutos', () => {
    perto(indisponibilidadePermitida(0.9999, 365), 52.56);
  });
});
