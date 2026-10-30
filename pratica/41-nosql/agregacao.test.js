import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { agregar } from './agregacao.js';

const tarefas = [
  { _id: 1, estado: 'aberta', pontos: 3, tags: ['api', 'bug'], dono: { nome: 'Ana' } },
  { _id: 2, estado: 'feita', pontos: 5, tags: ['web'], dono: { nome: 'Rui' } },
  { _id: 3, estado: 'aberta', pontos: 8, tags: ['api'], dono: { nome: 'Ana' } },
  { _id: 4, estado: 'aberta', pontos: 1, tags: [], dono: { nome: 'Eva' } },
];

describe('P2 · agregar', () => {
  it('$match e $project', () => {
    const r = agregar(tarefas, [{ $match: { estado: 'feita' } }, { $project: { pontos: 1, quem: '$dono.nome' } }]);
    assert.deepEqual(r, [{ _id: 2, pontos: 5, quem: 'Rui' }]);
  });
  it('$group com acumuladores, pela ordem de aparecimento', () => {
    const r = agregar(tarefas, [
      { $group: { _id: '$dono.nome', n: { $sum: 1 }, pontos: { $sum: '$pontos' }, media: { $avg: '$pontos' }, ids: { $push: '$_id' } } },
    ]);
    assert.deepEqual(r, [
      { _id: 'Ana', n: 2, pontos: 11, media: 5.5, ids: [1, 3] },
      { _id: 'Rui', n: 1, pontos: 5, media: 5, ids: [2] },
      { _id: 'Eva', n: 1, pontos: 1, media: 1, ids: [4] },
    ]);
  });
  it('$group com _id null junta tudo; $min e $max', () => {
    assert.deepEqual(agregar(tarefas, [{ $group: { _id: null, min: { $min: '$pontos' }, max: { $max: '$pontos' } } }]), [
      { _id: null, min: 1, max: 8 },
    ]);
  });
  it('$unwind + $group: quantas tarefas por tag', () => {
    const r = agregar(tarefas, [
      { $unwind: '$tags' },
      { $group: { _id: '$tags', n: { $sum: 1 } } },
      { $sort: { n: -1, _id: 1 } },
    ]);
    assert.deepEqual(r, [{ _id: 'api', n: 2 }, { _id: 'bug', n: 1 }, { _id: 'web', n: 1 }]);
  });
  it('$sort por vários campos e $limit', () => {
    const r = agregar(tarefas, [{ $sort: { estado: 1, pontos: -1 } }, { $limit: 2 }, { $project: { _id: 1 } }]);
    assert.deepEqual(r, [{ _id: 3 }, { _id: 1 }]);
  });
  it('$project com _id: 0', () => {
    assert.deepEqual(agregar(tarefas.slice(0, 1), [{ $project: { _id: 0, estado: 1 } }]), [{ estado: 'aberta' }]);
  });
  it('não muda os documentos originais', () => {
    const copia = structuredClone(tarefas);
    agregar(tarefas, [{ $unwind: '$tags' }, { $sort: { pontos: 1 } }]);
    assert.deepEqual(tarefas, copia);
  });
  it('rejeita etapas desconhecidas', () => {
    assert.throws(() => agregar(tarefas, [{ $lookupp: {} }]), /\$lookupp/);
  });
});
