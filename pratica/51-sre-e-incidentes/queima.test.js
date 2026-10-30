import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { avaliarAlertas, taxaDeQueima } from './queima.js';

const perto = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);
const slo = 0.999;
// Uma janela com a fração de erros dada (em 100 000 pedidos).
const j = (fracao) => ({ maus: Math.round(fracao * 100_000), total: 100_000 });

describe('P2 · taxaDeQueima', () => {
  it('1 quando os erros estão exatamente no limite do SLO', () => {
    perto(taxaDeQueima({ maus: 1, total: 1000, slo }), 1);
  });
  it('10 quando há 10 vezes mais erros do que o SLO permite', () => {
    perto(taxaDeQueima({ maus: 100, total: 10_000, slo }), 10);
  });
  it('0 sem pedidos', () => {
    assert.equal(taxaDeQueima({ maus: 0, total: 0, slo }), 0);
  });
});

describe('P2 · avaliarAlertas', () => {
  it('pagina com uma queima rápida em 1h E em 5m', () => {
    const r = avaliarAlertas({ '5m': j(0.02), '1h': j(0.015) }, slo);
    assert.deepEqual(r, { acao: 'pagina', regra: '1h/5m' });
  });
  it('não pagina se a janela curta já recuperou (o problema passou)', () => {
    const r = avaliarAlertas({ '5m': j(0), '1h': j(0.015), '30m': j(0), '6h': j(0.003) }, slo);
    assert.equal(r.acao, null);
  });
  it('não pagina por um pico curto que ainda não pesa na janela longa', () => {
    const r = avaliarAlertas({ '5m': j(0.5), '1h': j(0.005) }, slo);
    assert.equal(r.acao, null);
  });
  it('pagina com uma queima média sustentada (6h/30m)', () => {
    const r = avaliarAlertas({ '5m': j(0.007), '1h': j(0.007), '30m': j(0.007), '6h': j(0.0065) }, slo);
    assert.deepEqual(r, { acao: 'pagina', regra: '6h/30m' });
  });
  it('abre um ticket com uma queima lenta (3d/6h)', () => {
    const r = avaliarAlertas({ '5m': j(0.0012), '30m': j(0.0012), '1h': j(0.0012), '6h': j(0.0012), '3d': j(0.0011) }, slo);
    assert.deepEqual(r, { acao: 'ticket', regra: '3d/6h' });
  });
  it('sem janelas, sem alerta', () => {
    assert.deepEqual(avaliarAlertas({}, slo), { acao: null, regra: null });
  });
});
