import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TaskEvent } from './events.js';
import { createNotificationHandler, MalformedEventError, type Notify, type Queryable } from './notificationHandler.js';

// Uma BD falsa que percebe os dois comandos que o handler usa, e imita o ON CONFLICT DO NOTHING.
function fakeDb() {
  const ids = new Set<string>();
  const queries: { sql: string; params: unknown[] }[] = [];
  const db: Queryable = {
    async query(sql, params) {
      queries.push({ sql, params });
      const id = String(params[0]);
      if (/^\s*insert/i.test(sql)) {
        if (ids.has(id)) return { rows: [] };
        ids.add(id);
        return { rows: [{ event_id: id }] };
      }
      if (/^\s*delete/i.test(sql)) {
        ids.delete(id);
        return { rows: [] };
      }
      throw new Error(`query inesperada: ${sql}`);
    },
  };
  return { db, ids, queries };
}

// Um notify falso que regista as chamadas e pode falhar nas primeiras N.
function fakeNotify(falhasIniciais = 0) {
  const enviadas: [number, string][] = [];
  let falhas = falhasIniciais;
  const notify: Notify = async (userId, text) => {
    if (falhas > 0) {
      falhas--;
      throw new Error('serviço de email em baixo');
    }
    enviadas.push([userId, text]);
  };
  return { notify, enviadas };
}

const concluida: TaskEvent = {
  eventId: 'e-1',
  occurredAt: '2026-01-01T00:00:00Z',
  type: 'task.completed',
  task: { id: 3, title: 'Estudar TS', done: true, userId: 7 },
};

describe('P3 · createNotificationHandler', () => {
  it('task.completed → guarda e notifica o dono', async () => {
    const { db, queries } = fakeDb();
    const { notify, enviadas } = fakeNotify();
    const handle = createNotificationHandler({ db, notify });

    assert.equal(await handle(concluida), 'notificado');
    assert.deepEqual(enviadas, [[7, 'Concluíste "Estudar TS"']]);
    assert.deepEqual(queries[0]?.params, ['e-1', 7, 'Concluíste "Estudar TS"']);
    assert.match(queries[0]?.sql ?? '', /on conflict/i, 'o INSERT tem de ser idempotente');
  });

  it('a mesma mensagem duas vezes → notifica uma vez só', async () => {
    const { db } = fakeDb();
    const { notify, enviadas } = fakeNotify();
    const handle = createNotificationHandler({ db, notify });
    await handle(concluida);
    assert.equal(await handle(concluida), 'duplicado');
    assert.equal(enviadas.length, 1);
  });

  it('outros tipos de evento → ignorado, sem tocar na BD', async () => {
    const { db, queries } = fakeDb();
    const handle = createNotificationHandler({ db, notify: fakeNotify().notify });
    assert.equal(await handle({ ...concluida, type: 'task.created' }), 'ignorado');
    assert.equal(await handle({ eventId: 'e', occurredAt: 'x', type: 'task.deleted', taskId: 3, userId: 7 }), 'ignorado');
    assert.equal(queries.length, 0);
  });

  it('um evento mal formado → MalformedEventError', async () => {
    const handle = createNotificationHandler({ db: fakeDb().db, notify: fakeNotify().notify });
    await assert.rejects(handle({ type: 'task.completed' }), MalformedEventError);
    await assert.rejects(handle('lixo'), MalformedEventError);
  });

  it('se o notify falhar, desfaz o registo e lança; a próxima entrega consegue notificar', async () => {
    const { db, ids } = fakeDb();
    const { notify, enviadas } = fakeNotify(1);
    const handle = createNotificationHandler({ db, notify });

    await assert.rejects(handle(concluida), /email em baixo/);
    assert.equal(ids.has('e-1'), false, 'o registo ficou: a próxima entrega ia dar "duplicado" e ninguém era notificado');

    assert.equal(await handle(concluida), 'notificado');
    assert.equal(enviadas.length, 1);
  });
});
