import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { criarFilaJusta, criarQuotas } from './justica.js';

describe('P4 · fila justa', () => {
  it('roda entre inquilinos, mesmo que um tenha muito mais trabalho', () => {
    const f = criarFilaJusta();
    for (let i = 1; i <= 5; i++) f.adicionar('grande', `g${i}`);
    f.adicionar('pequeno', 'p1');
    f.adicionar('medio', 'm1');
    f.adicionar('medio', 'm2');
    assert.equal(f.tamanho, 8);
    const ordem = [];
    let x;
    while ((x = f.proxima())) ordem.push(x.trabalho);
    assert.deepEqual(ordem, ['g1', 'p1', 'm1', 'g2', 'm2', 'g3', 'g4', 'g5']);
    assert.equal(f.tamanho, 0);
  });
  it('quem volta entra no fim da rotação', () => {
    const f = criarFilaJusta();
    f.adicionar('a', 'a1');
    f.adicionar('b', 'b1');
    f.adicionar('b', 'b2');
    assert.deepEqual(f.proxima(), { inquilino: 'a', trabalho: 'a1' });
    f.adicionar('a', 'a2');
    assert.deepEqual([f.proxima(), f.proxima(), f.proxima()].map((r) => r.trabalho), ['b1', 'a2', 'b2']);
    assert.equal(f.proxima(), null);
  });
});

describe('P4 · quotas por inquilino', () => {
  it('cada inquilino tem a sua contagem e o seu limite', () => {
    let t = 0;
    const q = criarQuotas({ porMinuto: 2, excecoes: { premium: 4 }, agora: () => t });
    assert.deepEqual(q.permitir('acme'), { permitido: true, restantes: 1 });
    assert.deepEqual(q.permitir('acme'), { permitido: true, restantes: 0 });
    assert.deepEqual(q.permitir('acme'), { permitido: false, restantes: 0 });
    assert.deepEqual(q.permitir('globex'), { permitido: true, restantes: 1 }, 'a acme não gastou a quota da globex');
    for (let i = 3; i >= 0; i--) assert.deepEqual(q.permitir('premium'), { permitido: true, restantes: i });
    assert.equal(q.permitir('premium').permitido, false);
  });
  it('a janela seguinte recomeça', () => {
    let t = 59_999;
    const q = criarQuotas({ porMinuto: 1, agora: () => t });
    assert.equal(q.permitir('acme').permitido, true);
    assert.equal(q.permitir('acme').permitido, false);
    t = 60_000;
    assert.equal(q.permitir('acme').permitido, true);
  });
  it("um inquilino chamado 'toString' não usa o limite errado", () => {
    const q = criarQuotas({ porMinuto: 1, agora: () => 0 });
    assert.equal(q.permitir('toString').permitido, true);
    assert.equal(q.permitir('toString').permitido, false);
  });
});
