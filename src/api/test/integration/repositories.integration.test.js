import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { migrate } from '../../src/db/migrate.js';
import { createPool } from '../../src/db/pool.js';
import { createTaskRepository } from '../../src/repositories/taskRepository.js';
import { createUserRepository } from '../../src/repositories/userRepository.js';

// Testes de INTEGRAÇÃO: correm contra um Postgres real. Apanham erros de SQL, de migração
// e de tipos que os testes unitários (com fakes) não veem.
const url = process.env.DATABASE_TEST_URL;
if (!url) {
  throw new Error('Define DATABASE_TEST_URL (ver docs/11-testes-e-observabilidade.md)');
}

// Guarda de segurança: estes testes APAGAM tabelas. Recusamos correr numa base que não seja de teste.
const dbName = new URL(url).pathname.slice(1);
if (!dbName.includes('test')) {
  throw new Error(`Recusado: a base "${dbName}" não parece ser de teste (o nome tem de conter "test")`);
}

const pool = createPool(url);
const tasks = createTaskRepository(pool);
const users = createUserRepository(pool);

before(async () => {
  await migrate(pool);
});

beforeEach(async () => {
  // Estado limpo antes de cada teste: nenhum teste depende da ordem dos outros.
  await pool.query('TRUNCATE task_events, tasks, users RESTART IDENTITY CASCADE');
});

after(async () => {
  await pool.end();
});

test('cada utilizador só lista as suas tarefas', async () => {
  const ana = await users.create('ana@teste.pt', 'hash');
  const bruno = await users.create('bruno@teste.pt', 'hash');
  await tasks.create(ana.id, 'tarefa da Ana');
  await tasks.create(bruno.id, 'tarefa do Bruno');

  const anaTasks = await tasks.findAll(ana.id);

  assert.equal(anaTasks.length, 1);
  assert.equal(anaTasks[0].title, 'tarefa da Ana');
  assert.equal(anaTasks[0].userId, ana.id);
});

test('findById e remove respeitam o dono (outro utilizador não encontra nem apaga)', async () => {
  const ana = await users.create('ana@teste.pt', 'hash');
  const bruno = await users.create('bruno@teste.pt', 'hash');
  const task = await tasks.create(ana.id, 'privada');

  assert.equal(await tasks.findById(task.id, bruno.id), null);
  assert.equal(await tasks.remove(task.id, bruno.id), false);
  assert.notEqual(await tasks.findById(task.id, ana.id), null);
});

test('setDone atualiza só a tarefa do dono', async () => {
  const ana = await users.create('ana@teste.pt', 'hash');
  const task = await tasks.create(ana.id, 'fazer');

  const updated = await tasks.setDone(task.id, ana.id, true);

  assert.equal(updated.done, true);
});

test('stats conta eventos processados pelo worker apenas do próprio utilizador', async () => {
  const ana = await users.create('ana@teste.pt', 'hash');
  const bruno = await users.create('bruno@teste.pt', 'hash');
  const anaTask = await tasks.create(ana.id, 'a');
  const brunoTask = await tasks.create(bruno.id, 'b');
  await tasks.setDone(anaTask.id, ana.id, true);

  // Simula o que o worker grava: o evento completo, com a tarefa dentro do payload.
  const insertEvent = (eventId, task) =>
    pool.query(
      `INSERT INTO task_events (event_id, type, task_id, payload) VALUES ($1, 'task.completed', $2, $3)`,
      [eventId, task.id, JSON.stringify({ eventId, type: 'task.completed', task })],
    );
  await insertEvent('11111111-1111-4111-8111-111111111111', { ...anaTask, done: true });
  await insertEvent('22222222-2222-4222-8222-222222222222', { ...brunoTask, done: true });

  const anaStats = await tasks.stats(ana.id);

  assert.deepEqual(anaStats, { total: 1, done: 1, processedCompleted: 1 });
});

test('email duplicado é rejeitado pela BD com código 23505', async () => {
  await users.create('ana@teste.pt', 'hash');

  await assert.rejects(users.create('ana@teste.pt', 'outro'), { code: '23505' });
});

test('findOrCreateExternal cria uma vez e devolve o mesmo id depois (sem password local)', async () => {
  const first = await users.findOrCreateExternal('kc-uuid-1', 'externo@teste.pt');
  const second = await users.findOrCreateExternal('kc-uuid-1', 'externo@teste.pt');

  assert.equal(first.id, second.id);
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [first.id]);
  assert.equal(rows[0].password_hash, null);
});

test('migrate é idempotente: correr duas vezes não aplica nada de novo', async () => {
  await migrate(pool);
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM schema_migrations');

  assert.equal(rows[0].n, 5);
});
