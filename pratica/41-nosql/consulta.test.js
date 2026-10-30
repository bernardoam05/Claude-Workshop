import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { corresponde, valores } from './consulta.js';

const tarefa = {
  _id: 1,
  titulo: 'Rever PR',
  prioridade: 3,
  tags: ['urgente', 'backend'],
  dono: { nome: 'Ana', equipa: 'api' },
  comentarios: [{ autor: 'Rui', gostos: 2 }, { autor: 'Eva', gostos: 5 }],
};

describe('P1 · valores', () => {
  it('segue caminhos com pontos', () => {
    assert.deepEqual(valores(tarefa, 'dono.nome'), ['Ana']);
  });
  it('entra em arrays de objetos', () => {
    assert.deepEqual(valores(tarefa, 'comentarios.autor'), ['Rui', 'Eva']);
  });
  it('um array final dá o array e os elementos', () => {
    assert.deepEqual(valores(tarefa, 'tags'), [['urgente', 'backend'], 'urgente', 'backend']);
  });
  it('campo em falta dá []', () => {
    assert.deepEqual(valores(tarefa, 'dono.morada.rua'), []);
  });
});

describe('P1 · corresponde', () => {
  it('igualdade simples e em caminhos', () => {
    assert.equal(corresponde(tarefa, { titulo: 'Rever PR', 'dono.equipa': 'api' }), true);
    assert.equal(corresponde(tarefa, { titulo: 'Rever PR', 'dono.equipa': 'web' }), false);
  });
  it('igualdade com um elemento de um array, ou com o array inteiro', () => {
    assert.equal(corresponde(tarefa, { tags: 'urgente' }), true);
    assert.equal(corresponde(tarefa, { tags: ['urgente', 'backend'] }), true);
    assert.equal(corresponde(tarefa, { tags: 'casa' }), false);
  });
  it('comparações, todas ao mesmo tempo', () => {
    assert.equal(corresponde(tarefa, { prioridade: { $gte: 3, $lt: 5 } }), true);
    assert.equal(corresponde(tarefa, { prioridade: { $gt: 3 } }), false);
    assert.equal(corresponde(tarefa, { 'comentarios.gostos': { $gt: 4 } }), true, 'algum comentário com mais de 4');
  });
  it('não compara tipos diferentes', () => {
    assert.equal(corresponde(tarefa, { prioridade: { $gt: '1' } }), false);
  });
  it('$in, $nin, $ne e $exists', () => {
    assert.equal(corresponde(tarefa, { 'dono.nome': { $in: ['Ana', 'Rui'] } }), true);
    assert.equal(corresponde(tarefa, { tags: { $nin: ['casa'] } }), true);
    assert.equal(corresponde(tarefa, { tags: { $nin: ['backend'] } }), false);
    assert.equal(corresponde(tarefa, { prazo: { $ne: '2026-01-01' } }), true);
    assert.equal(corresponde(tarefa, { prazo: { $exists: false }, dono: { $exists: true } }), true);
  });
  it('$and e $or', () => {
    assert.equal(corresponde(tarefa, { $or: [{ prioridade: 1 }, { tags: 'urgente' }] }), true);
    assert.equal(corresponde(tarefa, { $and: [{ prioridade: 3 }, { tags: 'casa' }] }), false);
  });
  it('rejeita operadores desconhecidos', () => {
    assert.throws(() => corresponde(tarefa, { prioridade: { $quaseIgual: 3 } }), /\$quaseIgual/);
  });
});
