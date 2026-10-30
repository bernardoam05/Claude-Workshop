import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrarAoLer, projetoComTarefas } from './modelacao.js';

describe('P3 · projetoComTarefas', () => {
  const tarefas = [
    { id: 't1', projeto: 'p1', titulo: 'A', criadaEm: '2026-10-01T00:00:00Z', descricao: 'longa...' },
    { id: 't2', projeto: 'p1', titulo: 'B', criadaEm: '2026-10-03T00:00:00Z' },
    { id: 't3', projeto: 'p2', titulo: 'C', criadaEm: '2026-10-04T00:00:00Z' },
    { id: 't4', projeto: 'p1', titulo: 'D', criadaEm: '2026-10-02T00:00:00Z' },
  ];
  it('embute só as mais recentes, só com id e título, e guarda o total', () => {
    assert.deepEqual(projetoComTarefas({ id: 'p1', nome: 'Workshop' }, tarefas, { maxEmbutidas: 2 }), {
      id: 'p1',
      nome: 'Workshop',
      tarefasRecentes: [{ id: 't2', titulo: 'B' }, { id: 't4', titulo: 'D' }],
      totalTarefas: 3,
    });
  });
  it('um projeto sem tarefas', () => {
    assert.deepEqual(projetoComTarefas({ id: 'p9' }, tarefas, { maxEmbutidas: 5 }), { id: 'p9', tarefasRecentes: [], totalTarefas: 0 });
  });
  it('não muda a lista original', () => {
    const copia = structuredClone(tarefas);
    projetoComTarefas({ id: 'p1' }, tarefas, { maxEmbutidas: 1 });
    assert.deepEqual(tarefas, copia);
  });
});

describe('P3 · migrarAoLer', () => {
  it('migra um documento v1 até à v3', () => {
    assert.deepEqual(migrarAoLer({ _id: 1, nome: 'Rever', tags: 'api, bug ,' }), { _id: 1, titulo: 'Rever', tags: ['api', 'bug'], versaoEsquema: 3 });
  });
  it('migra um v2', () => {
    assert.deepEqual(migrarAoLer({ _id: 2, titulo: 'X', tags: '', versaoEsquema: 2 }), { _id: 2, titulo: 'X', tags: [], versaoEsquema: 3 });
  });
  it('deixa um v3 como está (mas é um objeto novo)', () => {
    const v3 = { _id: 3, titulo: 'Y', tags: ['a'], versaoEsquema: 3 };
    const r = migrarAoLer(v3);
    assert.deepEqual(r, v3);
    assert.notEqual(r, v3);
  });
  it('não muda o original', () => {
    const v1 = { _id: 1, nome: 'Rever', tags: 'a' };
    migrarAoLer(v1);
    assert.deepEqual(v1, { _id: 1, nome: 'Rever', tags: 'a' });
  });
  it('recusa versões do futuro', () => {
    assert.throws(() => migrarAoLer({ versaoEsquema: 4 }), /4/);
  });
});
