import { randomUUID } from 'node:crypto';

const STATS_TTL_SECONDS = 5;

// Chaves de cache por utilizador. Uma cache partilhada entre utilizadores seria uma fuga de dados.
export const tasksCacheKey = (userId) => `tasks:user:${userId}`;
export const statsCacheKey = (userId) => `stats:user:${userId}`;

// Camada de serviço (lógica de negócio). Não conhece HTTP (req/res) nem SQL:
// recebe as dependências como parâmetros, o que permite testá-la com versões falsas.
export function createTaskService({ repository, cache, publisher, cacheTtlSeconds }) {
  // Envelope de evento: id único (base da idempotência) + tipo + momento + payload.
  const buildEvent = (type, task) => ({
    eventId: randomUUID(),
    type,
    occurredAt: new Date().toISOString(),
    task,
  });

  // Depois de qualquer escrita, os dados em cache deste utilizador deixam de estar corretos.
  const invalidate = (userId) => cache.del(tasksCacheKey(userId), statsCacheKey(userId));

  return {
    async listTasks(userId) {
      const cached = await cache.getJSON(tasksCacheKey(userId));
      if (cached) return { tasks: cached, source: 'cache' };

      const tasks = await repository.findAll(userId);
      await cache.setJSON(tasksCacheKey(userId), tasks, cacheTtlSeconds);
      return { tasks, source: 'database' };
    },

    async createTask(userId, title) {
      const task = await repository.create(userId, title);
      await invalidate(userId);
      await publisher.publish('task.created', buildEvent('task.created', task));
      return task;
    },

    async updateTask(userId, id, done) {
      const before = await repository.findById(id, userId);
      if (!before) return null; // inexistente OU de outro utilizador: a resposta é a mesma (não revela existência)

      const task = await repository.setDone(id, userId, done);
      await invalidate(userId);

      // Só publicamos na transição false → true. Marcar duas vezes como concluída não gera dois eventos.
      if (done && !before.done) {
        await publisher.publish('task.completed', buildEvent('task.completed', task));
      }
      return task;
    },

    async deleteTask(userId, id) {
      const removed = await repository.remove(id, userId);
      if (removed) await invalidate(userId);
      return removed;
    },

    async getStats(userId) {
      const cached = await cache.getJSON(statsCacheKey(userId));
      if (cached) return cached;

      const stats = await repository.stats(userId);
      await cache.setJSON(statsCacheKey(userId), stats, STATS_TTL_SECONDS);
      return stats;
    },
  };
}
