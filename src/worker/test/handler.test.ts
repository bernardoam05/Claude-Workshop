import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEventHandler, isTaskEvent, MalformedEventError, parseJson } from '../src/handler.js';

// BD falsa que imita "INSERT ... ON CONFLICT DO NOTHING RETURNING".
function fakeDb() {
  const seen = new Set<unknown>();
  return {
    query: async (_sql: string, params: unknown[]) => {
      const eventId = params[0];
      if (seen.has(eventId)) return { rows: [] };
      seen.add(eventId);
      return { rows: [{ event_id: eventId }] };
    },
  };
}

const event = {
  eventId: 'evt-1',
  type: 'task.completed',
  occurredAt: '2026-01-01T00:00:00.000Z',
  task: { id: 7, title: 'x', done: true, userId: 1 },
};

test('o mesmo evento processado duas vezes só tem efeito uma vez (idempotência)', async () => {
  const handle = createEventHandler({ db: fakeDb() });

  assert.equal(await handle(event), 'processado');
  assert.equal(await handle(event), 'duplicado (ignorado)');
});

test('eventos sem a forma certa são rejeitados como MalformedEventError', async () => {
  const handle = createEventHandler({ db: fakeDb() });

  await assert.rejects(handle({ type: 'task.completed' }), MalformedEventError);
  await assert.rejects(handle({ ...event, type: 'task.apagado' }), MalformedEventError);
  await assert.rejects(handle({ ...event, task: { id: 'não-é-número' } }), MalformedEventError);
});

test('isTaskEvent aceita a forma certa e recusa a errada', () => {
  assert.equal(isTaskEvent(event), true);
  assert.equal(isTaskEvent(null), false);
  assert.equal(isTaskEvent('texto'), false);
});

test('parseJson lê JSON válido', () => {
  assert.deepEqual(parseJson(Buffer.from('{"a":1}')), { a: 1 });
});

test('parseJson com JSON inválido lança MalformedEventError (não será reenviado)', () => {
  assert.throws(() => parseJson(Buffer.from('{isto não é json')), MalformedEventError);
});
