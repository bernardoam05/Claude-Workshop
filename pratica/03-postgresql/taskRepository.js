// P3 · Um repositório: o único sítio que fala SQL (como src/api/src/repositories/taskRepository.js).
// `db` tem a forma de um Pool do `pg`: db.query(sql, params) e db.connect() (ver testDb.js).
// Regra de ouro: os valores vêm SEMPRE em params ($1, $2...), NUNCA concatenados na string SQL.
//
// Todas as tarefas devolvidas têm a forma { id, projectId, title, done }.
export function createTaskRepository(db) {
  return {
    // Cria uma tarefa e devolve-a (sem um segundo SELECT).
    async create(projectId, title) {
      throw new Error('Por fazer: P3');
    },

    // Marca como concluída. Devolve a tarefa atualizada, ou null se o id não existir.
    async complete(id) {
      throw new Error('Por fazer: P3');
    },

    // Títulos das tarefas dos projetos de `ownerId` que contêm `text` (sem distinguir maiúsculas).
    // Devolve um array de strings, por ordem alfabética.
    async search(ownerId, text) {
      throw new Error('Por fazer: P3');
    },

    // Regista um evento processado. Devolve true se o inseriu, false se o event_id já existia
    // (idempotência: a mesma mensagem entregue duas vezes não pode contar duas vezes).
    async addEvent(eventId, type, taskId) {
      throw new Error('Por fazer: P3');
    },

    // Cria um projeto e as suas tarefas, TUDO OU NADA: se uma tarefa falhar, o projeto não fica criado.
    // Devolve { id, name, tasks: [ ...tarefas criadas ] }.
    async createProjectWithTasks(ownerId, name, titles) {
      throw new Error('Por fazer: P3');
    },
  };
}
