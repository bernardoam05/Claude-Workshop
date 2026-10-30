import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ErroInquilino, resolverInquilino } from './inquilino.js';

const opcoes = { dominioBase: 'tarefas.pt', validos: new Set(['acme', 'globex']) };
const r = (pedido) => resolverInquilino({ cabecalhos: {}, token: null, ...pedido }, opcoes);

describe('P1 · resolverInquilino', () => {
  it('pelo subdomínio, sem porta nem maiúsculas a atrapalhar', () => {
    assert.equal(r({ anfitriao: 'ACME.tarefas.pt:8443' }), 'acme');
  });
  it('pelo cabeçalho ou pelo token', () => {
    assert.equal(r({ anfitriao: 'tarefas.pt', cabecalhos: { 'x-inquilino': 'globex' } }), 'globex');
    assert.equal(r({ anfitriao: 'api.outro.com', token: { inquilino: 'acme' } }), 'acme');
  });
  it('fontes que concordam são aceites', () => {
    assert.equal(r({ anfitriao: 'acme.tarefas.pt', cabecalhos: { 'x-inquilino': 'acme' }, token: { inquilino: 'acme' } }), 'acme');
  });
  it('o token manda: um cabeçalho ou um subdomínio diferente é um conflito', () => {
    assert.throws(() => r({ anfitriao: 'tarefas.pt', cabecalhos: { 'x-inquilino': 'globex' }, token: { inquilino: 'acme' } }), (e) => e instanceof ErroInquilino && /conflito/.test(e.message));
    assert.throws(() => r({ anfitriao: 'globex.tarefas.pt', token: { inquilino: 'acme' } }), /conflito/);
  });
  it('sem inquilino, ou desconhecido', () => {
    assert.throws(() => r({ anfitriao: 'tarefas.pt' }), /Sem inquilino/);
    assert.throws(() => r({ anfitriao: 'initech.tarefas.pt' }), /desconhecido/);
  });
  it('não se deixa enganar por domínios parecidos', () => {
    assert.throws(() => r({ anfitriao: 'acme.tarefas.pt.atacante.com' }), /Sem inquilino/);
    assert.throws(() => r({ anfitriao: 'acmetarefas.pt' }), /Sem inquilino/);
    assert.throws(() => r({ anfitriao: 'x.acme.tarefas.pt' }), /Sem inquilino/);
  });
});
