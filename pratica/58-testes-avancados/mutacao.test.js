import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { avaliarMutantes, gerarMutantes } from './mutacao.js';

describe('P3 · gerarMutantes', () => {
  it('um mutante por operador, com a linha', () => {
    const r = gerarMutantes('(a, b) =>\n  a <= b && b > 0');
    assert.deepEqual(r.map((m) => m.descricao), ["linha 2: '<=' → '<'", "linha 2: '&&' → '||'", "linha 2: '>' → '>='"]);
    assert.equal(r[0].codigo, '(a, b) =>\n  a < b && b > 0');
    assert.equal(r[2].codigo, '(a, b) =>\n  a <= b && b >= 0');
  });
  it('não mexe em =>, ++, +=, nem em palavras que contêm true', () => {
    const r = gerarMutantes('(x) => { let i = 0; i++; i += x; const trueValue = 1; return x === true; }');
    assert.deepEqual(r.map((m) => m.descricao), ["linha 1: '===' → '!=='", "linha 1: 'true' → 'false'"]);
  });
  it('sem operadores, sem mutantes', () => {
    assert.deepEqual(gerarMutantes('(x) => x'), []);
  });
});

describe('P3 · avaliarMutantes', () => {
  const maximo = '(a, b) => a > b ? a : b';
  it('testes fracos deixam mutantes vivos', () => {
    const fracos = (f) => assert.equal(f(5, 1), 5);
    const r = avaliarMutantes(maximo, fracos);
    assert.deepEqual(r, { total: 1, mortos: 0, sobreviventes: ["linha 1: '>' → '>='"], pontuacao: 0 });
  });
  it('um mutante equivalente sobrevive sempre (a >= b dá o mesmo máximo)', () => {
    const bons = (f) => {
      assert.equal(f(5, 1), 5);
      assert.equal(f(1, 5), 5);
      assert.equal(f(3, 3), 3);
    };
    assert.equal(avaliarMutantes(maximo, bons).mortos, 0);
  });
  it('testes bons matam os mutantes', () => {
    const entre = '(x, min, max) => x >= min && x <= max';
    const fracos = (f) => assert.equal(f(5, 0, 10), true);
    const bons = (f) => {
      assert.equal(f(5, 0, 10), true);
      assert.equal(f(0, 0, 10), true);
      assert.equal(f(10, 0, 10), true);
      assert.equal(f(-1, 0, 10), false);
      assert.equal(f(11, 0, 10), false);
    };
    const rf = avaliarMutantes(entre, fracos);
    assert.equal(rf.total, 3);
    assert.ok(rf.pontuacao < 1);
    assert.deepEqual(avaliarMutantes(entre, bons), { total: 3, mortos: 3, sobreviventes: [], pontuacao: 1 });
  });
  it('arredonda a pontuação', () => {
    const soma = '(a, b, c) => a + b + c > 0';
    const r = avaliarMutantes(soma, (f) => assert.equal(f(1, 2, 3), true));
    assert.equal(r.total, 3);
    assert.equal(r.pontuacao, Math.round((r.mortos / 3) * 100) / 100);
  });
  it('recusa testes que já falham com o original', () => {
    assert.throws(() => avaliarMutantes(maximo, (f) => assert.equal(f(1, 2), 1)), /código original/);
  });
});
