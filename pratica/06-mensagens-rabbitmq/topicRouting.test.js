import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matches, route } from './topicRouting.js';

describe('P1 · matches', () => {
  const casos = [
    // [binding key, routing key, chega?]
    ['task.created', 'task.created', true],
    ['task.created', 'task.completed', false],
    ['task.*', 'task.created', true],
    ['task.*', 'task', false],
    ['task.*', 'task.created.urgent', false],
    ['*.created', 'task.created', true],
    ['*.created', 'user.created', true],
    ['*.*', 'task.created', true],
    ['task.#', 'task', true],
    ['task.#', 'task.created', true],
    ['task.#', 'task.created.urgent', true],
    ['task.#', 'user.created', false],
    ['#', 'qualquer.coisa.mesmo', true],
    ['#.urgent', 'urgent', true],
    ['#.urgent', 'task.created.urgent', true],
    ['#.urgent', 'task.urgent.created', false],
    ['task.#.urgent', 'task.urgent', true],
    ['task.#.urgent', 'task.a.b.c.urgent', true],
    ['task.*.urgent', 'task.urgent', false],
    ['#.created.#', 'a.b.created.c', true],
    ['task.created', 'task.createdx', false],
  ];

  for (const [binding, routing, esperado] of casos) {
    it(`"${binding}" ${esperado ? 'apanha' : 'NÃO apanha'} "${routing}"`, () => {
      assert.equal(matches(binding, routing), esperado);
    });
  }
});

describe('P1 · route', () => {
  // A topologia do projeto, mais duas filas imaginárias.
  const bindings = [
    { queue: 'worker.task-events', bindingKey: 'task.*' },
    { queue: 'auditoria', bindingKey: '#' },
    { queue: 'alertas', bindingKey: '#.urgent' },
    { queue: 'auditoria', bindingKey: 'task.#' }, // a mesma fila ligada duas vezes
  ];

  it('devolve as filas que recebem, sem repetidas, pela ordem dos bindings', () => {
    assert.deepEqual(route(bindings, 'task.created'), ['worker.task-events', 'auditoria']);
    assert.deepEqual(route(bindings, 'task.created.urgent'), ['auditoria', 'alertas']);
  });

  it('sem nenhum binding que apanhe, a mensagem não vai para lado nenhum (e perde-se!)', () => {
    assert.deepEqual(route([{ queue: 'q', bindingKey: 'task.*' }], 'user.created'), []);
  });
});
