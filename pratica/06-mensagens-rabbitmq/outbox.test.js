import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTask, relayOnce } from './outbox.js';
import { createTestDb } from './testDb.js';

// Um publisher falso: guarda o que "publicou" e pode falhar a partir da N-ésima mensagem.
function fakePublisher({ falhaNa } = {}) {
  const publicados = [];
  return {
    publicados,
    async publish(routingKey, payload) {
      if (falhaNa !== undefined && publicados.length + 1 === falhaNa) throw new Error('RabbitMQ em baixo');
      publicados.push([routingKey, payload]);
    },
  };
}

const porPublicar = async (db) =>
  (await db.query('SELECT count(*)::int AS n FROM outbox WHERE published_at IS NULL')).rows[0].n;

describe('P3 · createTask', () => {
  it('cria a tarefa e o evento na outbox, na mesma transação', async () => {
    const db = await createTestDb('schema.sql');
    const task = await createTask(db, 'Estudar outbox');
    assert.deepEqual(task, { id: 1, title: 'Estudar outbox' });

    const { rows } = await db.query('SELECT routing_key, payload, published_at FROM outbox');
    assert.deepEqual(rows, [
      { routing_key: 'task.created', payload: { type: 'task.created', task }, published_at: null },
    ]);
  });

  it('se a tarefa for inválida, não fica nem tarefa nem evento', async () => {
    const db = await createTestDb('schema.sql');
    await createTask(db, 'Válida');
    await assert.rejects(createTask(db, ''));
    assert.equal((await db.query('SELECT count(*)::int AS n FROM outbox')).rows[0].n, 1);
  });

  it('se o evento não puder ser escrito, a tarefa também desaparece (é isto que resolve o dual-write)', async () => {
    const db = await createTestDb('schema.sql');
    await createTask(db, 'Antes da avaria');
    await db.query('DROP TABLE outbox'); // forçar o 2.º INSERT a falhar
    await assert.rejects(createTask(db, 'Vai falhar'));
    const { rows } = await db.query('SELECT title FROM tasks');
    assert.deepEqual(rows, [{ title: 'Antes da avaria' }], 'a tarefa ficou gravada sem o seu evento');
  });
});

describe('P3 · relayOnce', () => {
  it('publica os eventos pendentes por ordem e marca-os como publicados', async () => {
    const db = await createTestDb('schema.sql');
    for (const t of ['A', 'B', 'C']) await createTask(db, t);
    const publisher = fakePublisher();

    assert.deepEqual(await relayOnce(db, publisher), { published: 3 });
    assert.deepEqual(publisher.publicados.map(([, p]) => p.task.title), ['A', 'B', 'C']);
    assert.equal(publisher.publicados[0][0], 'task.created');
    assert.equal(await porPublicar(db), 0);

    assert.deepEqual(await relayOnce(db, publisher), { published: 0 }, 'nada é publicado duas vezes');
  });

  it('respeita o batchSize', async () => {
    const db = await createTestDb('schema.sql');
    for (const t of ['A', 'B', 'C']) await createTask(db, t);
    assert.deepEqual(await relayOnce(db, fakePublisher(), { batchSize: 2 }), { published: 2 });
    assert.equal(await porPublicar(db), 1);
  });

  it('se o broker falhar a meio, para aí, não lança erro, e a próxima volta continua pela ordem certa', async () => {
    const db = await createTestDb('schema.sql');
    for (const t of ['A', 'B', 'C']) await createTask(db, t);

    const avariado = fakePublisher({ falhaNa: 2 });
    assert.deepEqual(await relayOnce(db, avariado), { published: 1 });
    assert.equal(await porPublicar(db), 2);

    const recuperado = fakePublisher();
    assert.deepEqual(await relayOnce(db, recuperado), { published: 2 });
    assert.deepEqual(recuperado.publicados.map(([, p]) => p.task.title), ['B', 'C']);
  });
});
