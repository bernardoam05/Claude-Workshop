import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { criarCdn, nomeComHash, reescreverReferencias } from './invalidacao.js';

const h8 = (c) => createHash('sha256').update(c).digest('hex').slice(0, 8);

describe('P4 · nomeComHash', () => {
  it('põe o hash antes da última extensão', () => {
    assert.equal(nomeComHash('app.js', 'x'), `app.${h8('x')}.js`);
    assert.equal(nomeComHash('js/app.min.js', 'x'), `js/app.min.${h8('x')}.js`);
  });
  it('sem extensão, ou com pontos só nas pastas', () => {
    assert.equal(nomeComHash('LICENSE', 'x'), `LICENSE.${h8('x')}`);
    assert.equal(nomeComHash('v1.2/LICENSE', 'x'), `v1.2/LICENSE.${h8('x')}`);
    assert.equal(nomeComHash('.env', 'x'), `.env.${h8('x')}`);
  });
  it('outro conteúdo, outro nome', () => {
    assert.notEqual(nomeComHash('app.js', 'a'), nomeComHash('app.js', 'b'));
  });
});

describe('P4 · reescreverReferencias', () => {
  it('troca só o que está no mapa', () => {
    const html = '<link href="app.css"><script src="app.js"></script><a href="/sobre">x</a>';
    assert.equal(
      reescreverReferencias(html, { 'app.css': 'app.1.css', 'app.js': 'app.2.js' }),
      '<link href="app.1.css"><script src="app.2.js"></script><a href="/sobre">x</a>',
    );
  });
});

describe('P4 · criarCdn', () => {
  it('guarda, obtém e purga por url', () => {
    const cdn = criarCdn();
    cdn.guardar('/t/1', 'um');
    assert.equal(cdn.obter('/t/1'), 'um');
    assert.equal(cdn.purgarUrl('/t/1'), 1);
    assert.equal(cdn.purgarUrl('/t/1'), 0);
    assert.equal(cdn.obter('/t/1'), undefined);
  });
  it('purga todos os urls de uma etiqueta', () => {
    const cdn = criarCdn();
    cdn.guardar('/tarefas/42', 'a', ['tarefa:42', 'projeto:7']);
    cdn.guardar('/projetos/7', 'b', ['projeto:7']);
    cdn.guardar('/projetos/8', 'c', ['projeto:8']);
    assert.equal(cdn.purgarEtiqueta('projeto:7'), 2);
    assert.equal(cdn.tamanho, 1);
    assert.equal(cdn.obter('/projetos/8'), 'c');
    assert.equal(cdn.purgarEtiqueta('tarefa:42'), 0, 'já tinha sido purgado');
  });
  it('guardar de novo substitui as etiquetas', () => {
    const cdn = criarCdn();
    cdn.guardar('/x', '1', ['a']);
    cdn.guardar('/x', '2', ['b']);
    assert.equal(cdn.purgarEtiqueta('a'), 0);
    assert.equal(cdn.obter('/x'), '2');
    assert.equal(cdn.purgarEtiqueta('b'), 1);
  });
});
