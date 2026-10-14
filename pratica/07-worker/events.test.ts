import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeEvent, isTaskEvent, type TaskEvent } from './events.js';

const snapshot = { id: 3, title: 'Estudar TS', done: false, userId: 1 };
const criada: TaskEvent = { eventId: 'e1', occurredAt: '2026-01-01T00:00:00Z', type: 'task.created', task: snapshot };
const concluida: TaskEvent = {
  eventId: 'e2',
  occurredAt: '2026-01-01T00:00:00Z',
  type: 'task.completed',
  task: { ...snapshot, done: true },
};
const apagada: TaskEvent = { eventId: 'e3', occurredAt: '2026-01-01T00:00:00Z', type: 'task.deleted', taskId: 3, userId: 1 };

// ---------------------------------------------------------------------------------------------
// Testes de TIPOS: verificados pelo tsc antes de os testes correrem.
// Cada linha a seguir a um @ts-expect-error TEM de dar erro de compilação. Se o teu tipo for
// largo demais (ex.: `any`, ou `type: string`), o erro desaparece, e o próprio @ts-expect-error
// passa a ser o erro ("Unused '@ts-expect-error' directive").
// ---------------------------------------------------------------------------------------------

// @ts-expect-error: um evento de criação tem de trazer a tarefa
const semTask: TaskEvent = { eventId: 'x', occurredAt: 'x', type: 'task.created' };

// @ts-expect-error: um evento de "apagada" traz taskId e userId, não a tarefa
const apagadaComTask: TaskEvent = { eventId: 'x', occurredAt: 'x', type: 'task.deleted', task: snapshot };

// @ts-expect-error: só existem três tipos de evento
const tipoInventado: TaskEvent = { eventId: 'x', occurredAt: 'x', type: 'task.updated', task: snapshot };

// @ts-expect-error: o id da tarefa é um número
const idErrado: TaskEvent = { eventId: 'x', occurredAt: 'x', type: 'task.created', task: { ...snapshot, id: '3' } };

function estreitamento(e: TaskEvent): number {
  if (e.type === 'task.deleted') {
    // @ts-expect-error: dentro deste if, o compilador sabe que é um TaskDeleted (que não tem .task)
    e.task;
    return e.taskId; // ...e que tem .taskId
  }
  return e.task.id; // aqui só sobram TaskCreated e TaskCompleted, que têm os dois .task
}

function guarda(valor: unknown): TaskEvent | null {
  // @ts-expect-error: sem verificar, um unknown não pode ser usado como TaskEvent
  const semVerificar: TaskEvent = valor;
  if (isTaskEvent(valor)) return valor; // depois do type guard, pode
  return null;
}

void [semTask, apagadaComTask, tipoInventado, idErrado, estreitamento, guarda];

// ---------------------------------------------------------------------------------------------
// Testes de runtime: os tipos desaparecem quando o código corre; o isTaskEvent é que protege.
// ---------------------------------------------------------------------------------------------
describe('P1 · isTaskEvent', () => {
  it('aceita os três tipos de evento bem formados', () => {
    for (const e of [criada, concluida, apagada]) assert.equal(isTaskEvent(e), true, e.type);
  });

  it('rejeita o que não é um objeto', () => {
    for (const v of [null, undefined, 'task.created', 42, [criada]]) assert.equal(isTaskEvent(v), false, String(v));
  });

  it('rejeita eventos com campos comuns em falta ou com tipo errado', () => {
    const { eventId: _e, ...semEventId } = criada;
    const { occurredAt: _o, ...semOccurredAt } = criada;
    for (const v of [semEventId, semOccurredAt, { ...criada, eventId: 7 }, { ...criada, type: 'task.updated' }]) {
      assert.equal(isTaskEvent(v), false, JSON.stringify(v));
    }
  });

  it('verifica os campos de CADA tipo', () => {
    const invalidos = [
      { ...criada, task: undefined },
      { ...criada, task: { ...snapshot, id: '3' } },
      { ...criada, task: { ...snapshot, title: undefined } },
      { ...concluida, task: { ...snapshot, done: 'sim' } },
      { ...concluida, task: { ...snapshot, userId: null } },
      { ...apagada, taskId: '3' },
      { eventId: 'e', occurredAt: 'x', type: 'task.deleted', userId: 1 },
      { eventId: 'e', occurredAt: 'x', type: 'task.deleted', taskId: 3 },
    ];
    for (const v of invalidos) assert.equal(isTaskEvent(v), false, JSON.stringify(v));
  });
});

describe('P1 · describeEvent', () => {
  it('descreve cada tipo de evento', () => {
    assert.equal(describeEvent(criada), 'Tarefa 3 criada: "Estudar TS"');
    assert.equal(describeEvent(concluida), 'Tarefa 3 concluída: "Estudar TS"');
    assert.equal(describeEvent(apagada), 'Tarefa 3 apagada');
  });
});
