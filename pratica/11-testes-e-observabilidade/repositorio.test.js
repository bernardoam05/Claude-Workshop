// P3 · Escreve aqui os testes de INTEGRAÇÃO do repositorio.js, contra um Postgres a sério.
// Ver docs/11-testes-e-observabilidade.md, secção "Prática".
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { carregar } from './alvo.js';
import { createTestDb } from './testDb.js';

const { createTaskRepository } = await carregar('repositorio');

// Cada teste começa com uma BD nova, com dois utilizadores (ids 1 e 2) e sem tarefas.
async function novo() {
  const db = await createTestDb('schema.sql');
  await db.query(`INSERT INTO users (email) VALUES ('ana@exemplo.pt'), ('bruno@exemplo.pt')`);
  return { db, repo: createTaskRepository(db) };
}

describe('taskRepository', () => {
  // Um exemplo para começar.
  it('criar devolve a tarefa nova, por fazer', async () => {
    const { repo } = await novo();
    const tarefa = await repo.criar(1, 'Estudar testes');
    assert.deepEqual(tarefa, { id: 1, userId: 1, title: 'Estudar testes', done: false });
  });
});
