import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { criarRbac } from './rbac.js';

const papeis = {
  leitor: { permissoes: ['tarefa:ler', 'projeto:ler'] },
  editor: { herda: ['leitor'], permissoes: ['tarefa:criar', 'tarefa:editar'] },
  gestor: { herda: ['editor'], permissoes: ['tarefa:*', 'projeto:editar'] },
  auditor: { permissoes: ['registo:ler'] },
  admin: { herda: ['gestor', 'auditor'], permissoes: ['*'] },
};

describe('P1 · RBAC', () => {
  it('as permissões incluem as herdadas, ordenadas e sem repetidos', () => {
    const r = criarRbac(papeis);
    assert.deepEqual(r.permissoesDe('editor'), ['projeto:ler', 'tarefa:criar', 'tarefa:editar', 'tarefa:ler']);
    assert.deepEqual(r.permissoesDe('gestor'), ['projeto:editar', 'projeto:ler', 'tarefa:*', 'tarefa:criar', 'tarefa:editar', 'tarefa:ler']);
    assert.deepEqual(r.permissoesDe('inexistente'), []);
  });
  it('pode, com permissões exatas e herdadas', () => {
    const r = criarRbac(papeis);
    assert.equal(r.pode(['leitor'], 'tarefa:ler'), true);
    assert.equal(r.pode(['leitor'], 'tarefa:criar'), false);
    assert.equal(r.pode(['editor'], 'projeto:ler'), true);
  });
  it('curingas', () => {
    const r = criarRbac(papeis);
    assert.equal(r.pode(['gestor'], 'tarefa:apagar'), true);
    assert.equal(r.pode(['gestor'], 'projeto:apagar'), false);
    assert.equal(r.pode(['gestor'], 'tarefas:apagar'), false, "'tarefa:*' não cobre 'tarefas:...'");
    assert.equal(r.pode(['admin'], 'faturacao:qualquer'), true);
  });
  it('vários papéis: basta um', () => {
    const r = criarRbac(papeis);
    assert.equal(r.pode(['leitor', 'auditor'], 'registo:ler'), true);
    assert.equal(r.pode([], 'tarefa:ler'), false);
    assert.equal(r.pode(['fantasma'], 'tarefa:ler'), false);
  });
  it('recusa heranças de papéis que não existem', () => {
    assert.throws(() => criarRbac({ a: { herda: ['b'] } }), /b/);
  });
  it('recusa ciclos', () => {
    assert.throws(() => criarRbac({ a: { herda: ['b'] }, b: { herda: ['c'] }, c: { herda: ['a'] } }), /Ciclo/);
  });
});
