import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Anel, hash32, porModulo } from './hashConsistente.js';

const CHAVES = Array.from({ length: 10_000 }, (_, i) => `utilizador:${i}`);

function contar(fn) {
  const contagem = {};
  for (const c of CHAVES) {
    const no = fn(c);
    contagem[no] = (contagem[no] ?? 0) + 1;
  }
  return contagem;
}

describe('P3 · Anel de hashing consistente', () => {
  it('encontra o nó da primeira posição a seguir à chave, dando a volta ao anel', () => {
    const a = new Anel({ virtuais: 1 });
    for (const no of ['A', 'B', 'C']) a.adicionar(no);
    const posicoes = ['A', 'B', 'C'].map((no) => ({ no, h: hash32(`${no}#0`) })).sort((x, y) => x.h - y.h);
    for (const c of CHAVES.slice(0, 200)) {
      const h = hash32(c);
      const esperado = (posicoes.find((p) => p.h >= h) ?? posicoes[0]).no;
      assert.equal(a.noPara(c), esperado, c);
    }
  });

  it('com nós virtuais, a carga fica equilibrada (cada nó entre 15% e 35% de 4 nós)', () => {
    const a = new Anel({ virtuais: 200 });
    for (const no of ['A', 'B', 'C', 'D']) a.adicionar(no);
    for (const [no, n] of Object.entries(contar((c) => a.noPara(c)))) {
      assert.ok(n > 1500 && n < 3500, `${no} ficou com ${n} de 10 000 chaves`);
    }
  });

  it('acrescentar um 5.º nó move só ~1/5 das chaves (com módulo, moveria ~4/5)', () => {
    const nos = ['A', 'B', 'C', 'D'];
    const a = new Anel({ virtuais: 200 });
    for (const no of nos) a.adicionar(no);
    const antes = CHAVES.map((c) => a.noPara(c));
    a.adicionar('E');
    const movidas = CHAVES.filter((c, i) => a.noPara(c) !== antes[i]).length;
    assert.ok(movidas > 1200 && movidas < 2800, `moveram-se ${movidas} chaves`);
    assert.ok(CHAVES.every((c, i) => a.noPara(c) === antes[i] || a.noPara(c) === 'E'), 'as que se moveram só podem ter ido para o nó novo');

    const movidasModulo = CHAVES.filter((c) => porModulo(c, nos) !== porModulo(c, [...nos, 'E'])).length;
    assert.ok(movidasModulo > 7000, `com módulo moveram-se ${movidasModulo} (para comparar)`);
  });

  it('remover um nó só move as chaves que eram dele', () => {
    const a = new Anel({ virtuais: 100 });
    for (const no of ['A', 'B', 'C']) a.adicionar(no);
    const antes = CHAVES.map((c) => a.noPara(c));
    a.remover('B');
    assert.deepEqual(a.nos(), ['A', 'C']);
    CHAVES.forEach((c, i) => {
      if (antes[i] !== 'B') assert.equal(a.noPara(c), antes[i]);
      else assert.notEqual(a.noPara(c), 'B');
    });
  });

  it('um anel vazio não tem nó para ninguém', () => {
    const a = new Anel();
    assert.throws(() => a.noPara('x'));
  });
});
