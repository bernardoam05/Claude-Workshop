// userId aparece como "userId" (camelCase) para ser igual ao que a API devolve noutros sítios.
const COLUMNS = 'id, title, done, created_at, user_id AS "userId"';

// Camada de acesso a dados: é o ÚNICO sítio que fala SQL.
// Cada query recebe o userId e filtra por ele. A regra "só vês as tuas tarefas" fica na BD,
// não só no código: mesmo que a camada de cima tenha um bug, uma tarefa de outro utilizador não sai daqui.
export function createTaskRepository(pool) {
  return {
    async findAll(userId) {
      const { rows } = await pool.query(
        `SELECT ${COLUMNS} FROM tasks WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId],
      );
      return rows;
    },

    async findById(id, userId) {
      const { rows } = await pool.query(
        `SELECT ${COLUMNS} FROM tasks WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );
      return rows[0] ?? null;
    },

    async create(userId, title) {
      // $1, $2 são parâmetros: o driver envia os valores separados do SQL.
      // NUNCA concatenar input do utilizador numa string SQL (SQL injection).
      const { rows } = await pool.query(
        `INSERT INTO tasks (title, user_id) VALUES ($1, $2) RETURNING ${COLUMNS}`,
        [title, userId],
      );
      return rows[0];
    },

    async setDone(id, userId, done) {
      const { rows } = await pool.query(
        `UPDATE tasks SET done = $3, updated_at = now()
         WHERE id = $1 AND user_id = $2
         RETURNING ${COLUMNS}`,
        [id, userId, done],
      );
      return rows[0] ?? null;
    },

    async remove(id, userId) {
      const { rowCount } = await pool.query(
        'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
        [id, userId],
      );
      return rowCount > 0;
    },

    async stats(userId) {
      // O evento guarda a tarefa completa no payload, por isso filtramos por payload->'task'->>'userId'.
      // ::int evita devolver bigint como string.
      const { rows } = await pool.query(
        `
        SELECT
          (SELECT count(*)::int FROM tasks WHERE user_id = $1)                              AS total,
          (SELECT count(*)::int FROM tasks WHERE user_id = $1 AND done)                     AS done,
          (SELECT count(*)::int FROM task_events
             WHERE type = 'task.completed' AND (payload->'task'->>'userId')::int = $1)      AS "processedCompleted"
        `,
        [userId],
      );
      return rows[0];
    },
  };
}
