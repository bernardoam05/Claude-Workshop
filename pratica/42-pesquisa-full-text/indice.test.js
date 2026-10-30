import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { criarIndice } from './indice.js';

function exemplo() {
  const i = criarIndice();
  i.adicionar('a', 'rever o PR da API');
  i.adicionar('b', 'escrever testes para a API, testes de carga');
  i.adicionar('c', 'comprar pão');
  return i;
}

describe('P2 · criarIndice', () => {
  it('guarda as frequências por documento', () => {
    const i = exemplo();
    assert.deepEqual([...i.frequencias('testes')], [['b', 2]]);
    assert.deepEqual([...i.frequencias('api')].sort(), [['a', 1], ['b', 1]]);
    assert.equal(i.frequencias('nada').size, 0);
  });
  it('pesquisa com E (por omissão) e com OU', () => {
    const i = exemplo();
    assert.deepEqual(i.pesquisar('API testes'), ['b']);
    assert.deepEqual(i.pesquisar('API pão', { modo: 'ou' }), ['a', 'b', 'c']);
    assert.deepEqual(i.pesquisar('API inexistente'), []);
  });
  it('a consulta passa pelo mesmo tokenizador', () => {
    assert.deepEqual(exemplo().pesquisar('  REVER!! '), ['a']);
  });
  it('consulta vazia dá []', () => {
    assert.deepEqual(exemplo().pesquisar('...'), []);
  });
  it('remove documentos e apaga os termos que ficam vazios', () => {
    const i = exemplo();
    const antes = i.termos;
    i.remover('c');
    assert.deepEqual(i.pesquisar('pão'), []);
    assert.equal(i.termos, antes - 2);
  });
  it('voltar a adicionar um id substitui o documento', () => {
    const i = exemplo();
    i.adicionar('a', 'outra coisa');
    assert.deepEqual(i.pesquisar('rever'), []);
    assert.deepEqual(i.pesquisar('coisa'), ['a']);
  });
  it('aceita outro tokenizador', () => {
    const i = criarIndice((t) => t.split(','));
    i.adicionar(1, 'x,y');
    i.adicionar(2, 'y,z');
    assert.deepEqual(i.pesquisar('y'), [1, 2]);
  });
});
