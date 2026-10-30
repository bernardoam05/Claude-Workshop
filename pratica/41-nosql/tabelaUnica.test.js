import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chaves, consultar } from './tabelaUnica.js';

const itens = [
  { tipo: 'projeto', id: 'p1', nome: 'Workshop', dono: 'ana' },
  { tipo: 'projeto', id: 'p2', nome: 'Casa', dono: 'ana' },
  { tipo: 'projeto', id: 'p3', nome: 'Outro', dono: 'rui' },
  { tipo: 'tarefa', id: 't1', projeto: 'p1', responsavel: 'rui', estado: 'aberta', prazo: '2026-11-10' },
  { tipo: 'tarefa', id: 't2', projeto: 'p1', responsavel: 'ana', estado: 'feita', prazo: '2026-10-01' },
  { tipo: 'tarefa', id: 't3', projeto: 'p2', responsavel: 'rui', estado: 'aberta', prazo: '2026-11-02' },
  { tipo: 'tarefa', id: 't4', projeto: 'p3', responsavel: 'rui', estado: 'feita', prazo: '2026-09-01' },
].map(chaves);
const ids = (r) => r.map((i) => i.id);

describe('P4 · chaves', () => {
  it('projeto', () => {
    const p = chaves({ tipo: 'projeto', id: 'p1', nome: 'W', dono: 'ana' });
    assert.deepEqual([p.PK, p.SK, p.GSI1PK, p.GSI1SK], ['PROJ#p1', 'META', 'USER#ana', 'PROJ#p1']);
    assert.equal(p.nome, 'W');
  });
  it('tarefa', () => {
    const t = chaves({ tipo: 'tarefa', id: 't1', projeto: 'p1', responsavel: 'rui', estado: 'aberta', prazo: '2026-11-10' });
    assert.deepEqual([t.PK, t.SK, t.GSI1PK, t.GSI1SK], ['PROJ#p1', 'TAREFA#t1', 'USER#rui', 'TAREFA#aberta#2026-11-10']);
  });
  it('tipo desconhecido', () => {
    assert.throws(() => chaves({ tipo: 'gato' }), /gato/);
  });
});

describe('P4 · consultar (os padrões de acesso)', () => {
  it('A: um projeto e as suas tarefas, numa só consulta', () => {
    const r = consultar(itens, { pk: 'PROJ#p1' });
    assert.deepEqual(r.map((i) => i.SK), ['META', 'TAREFA#t1', 'TAREFA#t2']);
  });
  it('A: só as tarefas, com begins_with', () => {
    assert.deepEqual(ids(consultar(itens, { pk: 'PROJ#p1', skComeca: 'TAREFA#' })), ['t1', 't2']);
  });
  it('B: os projetos de um utilizador, pelo índice', () => {
    assert.deepEqual(ids(consultar(itens, { indice: 'GSI1', pk: 'USER#ana', skComeca: 'PROJ#' })), ['p1', 'p2']);
  });
  it('C: as tarefas abertas de um utilizador, por prazo', () => {
    assert.deepEqual(ids(consultar(itens, { indice: 'GSI1', pk: 'USER#rui', skComeca: 'TAREFA#aberta#' })), ['t3', 't1']);
  });
  it('decrescente e com limite: o prazo mais distante', () => {
    assert.deepEqual(ids(consultar(itens, { indice: 'GSI1', pk: 'USER#rui', skComeca: 'TAREFA#aberta#', crescente: false, limite: 1 })), ['t1']);
  });
  it('itens sem as chaves do índice não aparecem nele', () => {
    const semIndice = [{ PK: 'X', SK: 'Y', id: 'z' }];
    assert.deepEqual(consultar(semIndice, { indice: 'GSI1', pk: 'X' }), []);
  });
  it('sem chave de partição não há Query', () => {
    assert.throws(() => consultar(itens, { skComeca: 'TAREFA#' }), /partição/);
  });
});
