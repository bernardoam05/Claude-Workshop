import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bm25 } from './bm25.js';

const doc = (id, texto) => ({ id, termos: texto.split(' ') });
const ids = (r) => r.map((x) => x.id);

describe('P3 · bm25', () => {
  it('dá o valor exato da fórmula', () => {
    const docs = [doc('a', 'gato preto'), doc('b', 'cao preto preto'), doc('c', 'peixe')];
    // gato: N=3, n=1 → idf = ln(1 + 2.5/1.5); doc a: tf=1, dl=2, dlMedio=2
    const idf = Math.log(1 + 2.5 / 1.5);
    const esperado = (idf * 1 * 2.2) / (1 + 1.2 * (1 - 0.75 + 0.75 * 1));
    const r = bm25(docs, ['gato']);
    assert.equal(r.length, 1);
    assert.equal(r[0].id, 'a');
    assert.ok(Math.abs(r[0].pontuacao - esperado) < 1e-12);
  });
  it('termos raros pesam mais do que termos comuns', () => {
    const docs = [doc('a', 'api lenta'), doc('b', 'api erro'), doc('c', 'api deploy'), doc('d', 'api erro')];
    const r = bm25(docs, ['api', 'lenta']);
    assert.equal(r[0].id, 'a', 'o único com o termo raro ganha');
  });
  it('repetir um termo ajuda, mas cada vez menos (saturação)', () => {
    const docs = [doc('a', 'x y y y'), doc('b', 'x y z w'), doc('c', 'z w z w'), doc('d', 'x x x x x x x x x x x x')];
    const r = bm25(docs, ['x']);
    const p = Object.fromEntries(r.map((x) => [x.id, x.pontuacao]));
    assert.ok(p.d > p.a, '12 vezes vale mais do que 1');
    assert.ok(p.d < 3 * p.a, 'mas não 12 vezes mais');
  });
  it('documentos mais curtos ganham com o mesmo tf', () => {
    const docs = [doc('longo', 'bug a b c d e f g h'), doc('curto', 'bug z'), doc('outro', 'nada aqui')];
    assert.deepEqual(ids(bm25(docs, ['bug'])), ['curto', 'longo']);
  });
  it('b = 0 desliga a normalização pelo comprimento', () => {
    const docs = [doc('longo', 'bug a b c d e f g h'), doc('curto', 'bug z')];
    const r = bm25(docs, ['bug'], { b: 0 });
    assert.equal(r[0].pontuacao, r[1].pontuacao);
    assert.deepEqual(ids(r), ['curto', 'longo'], 'empate: por id');
  });
  it('termos repetidos na consulta contam uma vez; sem resultados dá []', () => {
    const docs = [doc('a', 'gato'), doc('b', 'cao')];
    assert.deepEqual(bm25(docs, ['gato', 'gato']), bm25(docs, ['gato']));
    assert.deepEqual(bm25(docs, ['peixe']), []);
    assert.deepEqual(bm25([], ['x']), []);
  });
});
