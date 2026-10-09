import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTaskService, tasksCacheKey } from '../src/services/taskService.js';

// Versões falsas (fakes) das dependências: o teste corre sem Postgres, Redis nem RabbitMQ.
function buildFakes() {
  const rows = new Map();
  let nextId = 1;
  const published = [];
  const cacheStore = new Map();
  const cacheDeletes = [];

  return {
    repository: {
      findAll: async (userId) => [...rows.values()].filter((t) => t.userId === userId),
      // Devolve uma CÓPIA, tal como uma linha vinda da BD. Devolver a referência
      // faria o "estado anterior" mudar junto com o atual, e o teste mentiria.
      findById: async (id, userId) => {
        const t = rows.get(id);
        return t && t.userId === userId ? { ...t } : null;
      },
      create: async (userId, title) => {
        const task = { id: nextId++, title, done: false, userId };
        rows.set(task.id, task);
        return task;
      },
      setDone: async (id, userId, done) => {
        const t = rows.get(id);
        if (!t || t.userId !== userId) return null;
        t.done = done;
        return { ...t };
      },
      remove: async (id, userId) => {
        const t = rows.get(id);
        if (!t || t.userId !== userId) return false;
        return rows.delete(id);
      },
      stats: async () => ({ total: 0, done: 0, processedCompleted: 0 }),
    },
    cache: {
      getJSON: async (key) => (cacheStore.has(key) ? cacheStore.get(key) : null),
      setJSON: async (key, value) => cacheStore.set(key, value),
      del: async (...keys) => {
        cacheDeletes.push(...keys);
        keys.forEach((k) => cacheStore.delete(k));
      },
    },
    publisher: {
      publish: async (routingKey, message) => published.push({ routingKey, message }),
    },
    published,
    cacheDeletes,
  };
}

test('listTasks: primeira leitura vai à BD, a segunda vem da cache', async () => {
  const fakes = buildFakes();
  const service = createTaskService({ ...fakes, cacheTtlSeconds: 60 });
  await service.createTask(1, 'Estudar Docker');

  const first = await service.listTasks(1);
  const second = await service.listTasks(1);

  assert.equal(first.source, 'database');
  assert.equal(second.source, 'cache');
});

test('createTask invalida a cache do utilizador e publica task.created', async () => {
  const fakes = buildFakes();
  const service = createTaskService({ ...fakes, cacheTtlSeconds: 60 });

  await service.createTask(1, 'Escrever relatório');

  assert.ok(fakes.cacheDeletes.includes(tasksCacheKey(1)));
  assert.equal(fakes.published.length, 1);
  assert.equal(fakes.published[0].routingKey, 'task.created');
  assert.equal(typeof fakes.published[0].message.eventId, 'string');
});

test('updateTask publica task.completed apenas na transição false → true', async () => {
  const fakes = buildFakes();
  const service = createTaskService({ ...fakes, cacheTtlSeconds: 60 });
  const task = await service.createTask(1, 'Ler sobre RabbitMQ');

  await service.updateTask(1, task.id, true);
  await service.updateTask(1, task.id, true); // repetir a mesma ação não pode gerar outro evento
  await service.updateTask(1, task.id, false);

  const completed = fakes.published.filter((p) => p.routingKey === 'task.completed');
  assert.equal(completed.length, 1);
});

test('updateTask devolve null e não publica nada para um id inexistente', async () => {
  const fakes = buildFakes();
  const service = createTaskService({ ...fakes, cacheTtlSeconds: 60 });

  const result = await service.updateTask(1, 999, true);

  assert.equal(result, null);
  assert.equal(fakes.published.length, 0);
});

test('um utilizador não vê, não altera nem apaga tarefas de outro', async () => {
  const fakes = buildFakes();
  const service = createTaskService({ ...fakes, cacheTtlSeconds: 60 });
  const alicesTask = await service.createTask(1, 'Segredo da Alice');

  const bobList = await service.listTasks(2);
  const bobUpdate = await service.updateTask(2, alicesTask.id, true);
  const bobDelete = await service.deleteTask(2, alicesTask.id);

  assert.deepEqual(bobList.tasks, []);
  assert.equal(bobUpdate, null);
  assert.equal(bobDelete, false);
  // E o evento de conclusão também não foi publicado pelo Bob.
  assert.equal(fakes.published.filter((p) => p.routingKey === 'task.completed').length, 0);
});
