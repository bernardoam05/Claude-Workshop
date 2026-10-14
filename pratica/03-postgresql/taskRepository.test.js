import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { createTaskRepository } from './taskRepository.js';
import { assertSchemaFeito, createTestDb } from './testDb.js';

// Cada teste começa com uma BD nova (o teu schema.sql + seed.sql), porque estes testes escrevem dados.
async function novo() {
  assertSchemaFeito();
  const db = await createTestDb('base.sql', 'schema.sql', 'seed.sql');
  return { db, repo: createTaskRepository(db) };
}

describe('P3 · taskRepository', () => {

  it('create devolve a tarefa nova, em camelCase', async () => {
    const { db, repo } = await novo();
    const task = await repo.create(2, 'Comprar lâmpadas');
    assert.deepEqual(task, { id: task.id, projectId: 2, title: 'Comprar lâmpadas', done: false });
    assert.equal(typeof task.id, 'number');
  });

  it('create guarda texto com aspas tal como está (prova de que usa parâmetros)', async () => {
    const { db, repo } = await novo();
    const titulo = `O'Neil'); DROP TABLE tasks; --`;
    const task = await repo.create(1, titulo);
    assert.equal(task.title, titulo);
    const { rows } = await db.query('SELECT count(*)::int AS n FROM tasks');
    assert.equal(rows[0].n, 12, 'a tabela tasks devia continuar a existir, com 12 tarefas');
  });

  it('complete marca como concluída e devolve a tarefa; null se não existir', async () => {
    const { db, repo } = await novo();
    const task = await repo.create(2, 'Nova');
    assert.deepEqual(await repo.complete(task.id), { ...task, done: true });
    assert.equal(await repo.complete(99999), null);
  });

  it('search procura nos projetos do dono, sem distinguir maiúsculas', async () => {
    const { db, repo } = await novo();
    assert.deepEqual(await repo.search(2, 'TREINO'), ['Treino de braços', 'Treino de costas', 'Treino de pernas']);
    assert.deepEqual(await repo.search(1, 'treino'), [], 'a Ana não pode ver tarefas do Bruno');
  });

  it('search não deixa o texto mudar a query (SQL injection)', async () => {
    const { db, repo } = await novo();
    assert.deepEqual(await repo.search(1, `' OR '1'='1`), []);
    assert.deepEqual(await repo.search(1, '%'), [], '"%" é um carácter normal na pesquisa, não um wildcard');
  });

  it('addEvent é idempotente: o mesmo eventId só entra uma vez', async () => {
    const { db, repo } = await novo();
    const id = randomUUID();
    assert.equal(await repo.addEvent(id, 'task.completed', 1), true);
    assert.equal(await repo.addEvent(id, 'task.completed', 1), false);
    const { rows } = await db.query('SELECT count(*)::int AS n FROM task_events');
    assert.equal(rows[0].n, 1);
  });

  it('createProjectWithTasks cria o projeto e as tarefas', async () => {
    const { db, repo } = await novo();
    const p = await repo.createProjectWithTasks(3, 'Mudança', ['Caixas', 'Fita-cola']);
    assert.equal(p.name, 'Mudança');
    assert.deepEqual(p.tasks.map((t) => [t.projectId, t.title, t.done]), [
      [p.id, 'Caixas', false],
      [p.id, 'Fita-cola', false],
    ]);
  });

  it('createProjectWithTasks é tudo ou nada: uma tarefa inválida desfaz o projeto', async () => {
    const { db, repo } = await novo();
    await assert.rejects(repo.createProjectWithTasks(3, 'Mudança', ['Caixas', '']));
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM projects WHERE name = 'Mudança'`);
    assert.equal(rows[0].n, 0, 'o projeto ficou criado sem as tarefas: faltou o ROLLBACK');
    // E a ligação ficou utilizável (a transação não ficou aberta, pendurada):
    await assert.doesNotReject(repo.createProjectWithTasks(3, 'Mudança', ['Caixas']));
  });
});
