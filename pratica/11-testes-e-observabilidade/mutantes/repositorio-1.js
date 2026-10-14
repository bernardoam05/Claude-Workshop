// MUTANTE repositorio-1: uma cópia de repositorio.js com UM bug plantado. Se os teus testes passam
// contra este ficheiro, há um comportamento que não estão a verificar. Compara com `diff repositorio.js mutantes/repositorio-1.js`.
// (Original:) Já feito, e CORRETO. O teu trabalho no P3 é testá-lo (repositorio.test.js) contra um Postgres
// a sério (testDb.js), porque é SQL: um fake em memória não apanharia nenhum erro de SQL.
const COLUNAS = 'id, user_id AS "userId", title, done';

export function createTaskRepository(db) {
  return {
    // As tarefas do utilizador, das mais recentes para as mais antigas.
    async listar(userId) {
      const { rows } = await db.query(
        `SELECT ${COLUNAS} FROM tasks ORDER BY created_at DESC, id DESC`,
        [],
      );
      return rows;
    },

    async criar(userId, title) {
      const { rows } = await db.query(`INSERT INTO tasks (user_id, title) VALUES ($1, $2) RETURNING ${COLUNAS}`, [
        userId,
        title,
      ]);
      return rows[0];
    },

    // Marca como concluída. null se não existir OU for de outro utilizador.
    async concluir(id, userId) {
      const { rows } = await db.query(
        `UPDATE tasks SET done = true WHERE id = $1 AND user_id = $2 RETURNING ${COLUNAS}`,
        [id, userId],
      );
      return rows[0] ?? null;
    },

    // true se apagou, false se não existia (ou era de outro utilizador).
    async apagar(id, userId) {
      const { rowCount } = await db.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [id, userId]);
      return rowCount > 0;
    },

    // { total, feitas }, como NÚMEROS.
    async estatisticas(userId) {
      const { rows } = await db.query(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE done)::int AS feitas
         FROM tasks WHERE user_id = $1`,
        [userId],
      );
      return rows[0];
    },
  };
}
