import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { avaliarCanario, balde, naVersaoNova } from './canario.js';

describe('P1 · balde', () => {
  it('dá os valores do FNV-1a', () => {
    assert.equal(balde('ana'), 61); // FNV-1a(':ana') = 1683192461
    assert.equal(balde('ana', 'novo-checkout'), 4); // FNV-1a('novo-checkout:ana') = 1089466904
  });
  it('é estável e fica entre 0 e 99', () => {
    for (let i = 0; i < 1000; i++) {
      const b = balde(`u${i}`);
      assert.ok(Number.isInteger(b) && b >= 0 && b < 100);
      assert.equal(balde(`u${i}`), b);
    }
  });
  it('distribui mais ou menos por igual', () => {
    const n = 10_000;
    const abaixo = Array.from({ length: n }, (_, i) => balde(`utilizador-${i}`)).filter((b) => b < 10).length;
    assert.ok(abaixo > n * 0.08 && abaixo < n * 0.12, `${abaixo} em ${n} no 0-9`);
  });
});

describe('P1 · naVersaoNova', () => {
  it('0% ninguém, 100% toda a gente', () => {
    assert.equal(naVersaoNova('ana', 0), false);
    assert.equal(naVersaoNova('ana', 100), true);
  });
  it('ao subir a percentagem, quem já estava continua', () => {
    const ids = Array.from({ length: 500 }, (_, i) => `u${i}`);
    const a5 = ids.filter((id) => naVersaoNova(id, 5));
    const a20 = new Set(ids.filter((id) => naVersaoNova(id, 20)));
    assert.ok(a5.length > 0);
    for (const id of a5) assert.ok(a20.has(id), id);
  });
});

describe('P1 · avaliarCanario', () => {
  const base = { pedidos: 100_000, erros: 100, p99Ms: 400 };
  it('espera com poucos pedidos', () => {
    assert.equal(avaliarCanario({ base, canario: { pedidos: 100, erros: 50, p99Ms: 9000 } }), 'esperar');
  });
  it('reverte com mais erros', () => {
    assert.equal(avaliarCanario({ base, canario: { pedidos: 1000, erros: 10, p99Ms: 400 } }), 'reverter');
  });
  it('reverte com o p99 mais lento', () => {
    assert.equal(avaliarCanario({ base, canario: { pedidos: 1000, erros: 1, p99Ms: 500 } }), 'reverter');
  });
  it('promove quando está dentro das margens', () => {
    assert.equal(avaliarCanario({ base, canario: { pedidos: 1000, erros: 5, p99Ms: 470 } }), 'promover');
  });
  it('aceita outras margens', () => {
    const canario = { pedidos: 50, erros: 0, p99Ms: 470 };
    assert.equal(avaliarCanario({ base, canario }, { minPedidos: 10, fatorLatencia: 1.1 }), 'reverter');
  });
});
