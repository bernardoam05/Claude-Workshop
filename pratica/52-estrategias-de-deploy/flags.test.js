import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { balde } from './canario.js';
import { criarFlags } from './flags.js';

describe('P2 · criarFlags', () => {
  it('uma flag desconhecida devolve o valor por omissão', () => {
    const f = criarFlags({});
    assert.equal(f.ativa('nao-existe', { id: 'ana' }), false);
    assert.equal(f.ativa('nao-existe', { id: 'ana' }, true), true);
  });
  it('desligada vence tudo', () => {
    const f = criarFlags({ x: { ligada: false, utilizadores: ['ana'], percentagem: 100 } });
    assert.equal(f.ativa('x', { id: 'ana' }), false);
  });
  it('liga para utilizadores escolhidos', () => {
    const f = criarFlags({ x: { ligada: true, utilizadores: ['ana'] } });
    assert.equal(f.ativa('x', { id: 'ana' }), true);
    assert.equal(f.ativa('x', { id: 'rui' }), false);
  });
  it('liga por regras de atributos', () => {
    const f = criarFlags({ x: { ligada: true, regras: [{ atributo: 'pais', valores: ['PT', 'BR'] }] } });
    assert.equal(f.ativa('x', { id: 'rui', pais: 'BR' }), true);
    assert.equal(f.ativa('x', { id: 'rui', pais: 'ES' }), false);
    assert.equal(f.ativa('x', { id: 'rui' }), false);
  });
  it('liga para uma percentagem, com o nome da flag como sal', () => {
    const f = criarFlags({ a: { ligada: true, percentagem: 30 }, b: { ligada: true, percentagem: 30 } });
    const ids = Array.from({ length: 2000 }, (_, i) => `u${i}`);
    for (const id of ids.slice(0, 50)) assert.equal(f.ativa('a', { id }), balde(id, 'a') < 30);
    const emA = ids.filter((id) => f.ativa('a', { id }));
    assert.ok(emA.length > 500 && emA.length < 700, `${emA.length}`);
    const emAeB = emA.filter((id) => f.ativa('b', { id }));
    assert.ok(emAeB.length < emA.length * 0.5, 'as duas flags não escolhem as mesmas pessoas');
  });
  it('sem nada configurado, está desligada', () => {
    assert.equal(criarFlags({ x: { ligada: true } }).ativa('x', { id: 'ana' }), false);
  });
});
