import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Encurtador, codificar, descodificar } from './encurtador.js';

describe('P2 · base 62', () => {
  it('codifica', () => {
    assert.equal(codificar(0), '0');
    assert.equal(codificar(61), 'Z');
    assert.equal(codificar(62), '10');
    assert.equal(codificar(3843), 'ZZ');
  });

  it('descodificar é o inverso de codificar', () => {
    for (const n of [0, 1, 61, 62, 3843, 3844, 916_132_831, Number.MAX_SAFE_INTEGER]) {
      assert.equal(descodificar(codificar(n)), n);
    }
  });

  it('7 caracteres chegam para 3,5 biliões de URLs', () => {
    assert.equal(codificar(62 ** 7 - 1), 'Z'.repeat(7));
    assert.equal(codificar(62 ** 7 - 1).length, 7);
  });

  it('recusa valores inválidos', () => {
    assert.equal(codificar(5), '5');
    assert.equal(descodificar('5'), 5);
    assert.throws(() => codificar(-1));
    assert.throws(() => codificar(1.5));
    assert.throws(() => descodificar(''));
    assert.throws(() => descodificar('ab_c'));
  });
});

function novo() {
  let id = 1000;
  return new Encurtador({ proximoId: () => id++ });
}

describe('P2 · Encurtador', () => {
  it('encurta e expande', () => {
    const e = novo();
    const c = e.encurtar('https://exemplo.pt/um/caminho/muito/comprido?x=1');
    assert.equal(c, codificar(1000));
    assert.equal(e.expandir(c), 'https://exemplo.pt/um/caminho/muito/comprido?x=1');
  });

  it('o mesmo URL dá o mesmo código, sem gastar ids', () => {
    let pedidos = 0;
    const e = new Encurtador({ proximoId: () => 1000 + pedidos++ });
    const a = e.encurtar('https://a.pt');
    assert.equal(e.encurtar('https://a.pt'), a);
    assert.equal(pedidos, 1);
    assert.notEqual(e.encurtar('https://b.pt'), a);
  });

  it('só aceita http e https', () => {
    const e = novo();
    for (const u of ['javascript:alert(1)', 'ftp://x.pt', 'não é url', '']) {
      assert.throws(() => e.encurtar(u), /URL/, u);
    }
  });

  it('aliases personalizados', () => {
    const e = novo();
    assert.equal(e.encurtar('https://a.pt', { alias: 'promo-natal' }), 'promo-natal');
    assert.equal(e.expandir('promo-natal'), 'https://a.pt');
    assert.throws(() => e.encurtar('https://b.pt', { alias: 'promo-natal' }), /alias/);
    assert.throws(() => e.encurtar('https://c.pt', { alias: 'ab' }), /alias/);
    assert.throws(() => e.encurtar('https://c.pt', { alias: 'com espaço' }), /alias/);
  });

  it('um código desconhecido expande para null', () => {
    assert.equal(novo().expandir('naoexiste'), null);
  });

  it('conta os cliques', () => {
    const e = novo();
    const c = e.encurtar('https://a.pt');
    assert.equal(e.cliques(c), 0);
    e.expandir(c);
    e.expandir(c);
    assert.equal(e.cliques(c), 2);
    assert.equal(e.cliques('outro'), 0);
  });
});
