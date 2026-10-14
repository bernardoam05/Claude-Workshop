import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listarPorCursor, listarPorOffset } from './paginacao.js';
import { createTestDb } from './testDb.js';

// Uma BD com 10 tarefas (ids 1 a 10), num só projeto.
async function novaBd() {
  const db = await createTestDb('schema.sql');
  await db.query(`INSERT INTO projects (name) VALUES ('Mestrado')`);
  for (let i = 1; i <= 10; i++) await db.query('INSERT INTO tasks (project_id, title) VALUES (1, $1)', [`Tarefa ${i}`]);
  return db;
}
const ids = (tarefas) => tarefas.map((t) => t.id);

describe('P1 · listarPorOffset', () => {
  it('páginas de 4: [10..7], [6..3], [2, 1], e depois vazia', async () => {
    const db = await novaBd();
    assert.deepEqual(ids(await listarPorOffset(db, 1, 4)), [10, 9, 8, 7]);
    assert.deepEqual(ids(await listarPorOffset(db, 2, 4)), [6, 5, 4, 3]);
    assert.deepEqual(ids(await listarPorOffset(db, 3, 4)), [2, 1]);
    assert.deepEqual(await listarPorOffset(db, 4, 4), []);
    assert.deepEqual((await listarPorOffset(db, 1, 1))[0], { id: 10, title: 'Tarefa 10' });
  });

  it('O DEFEITO (este teste prova-o, não o corrige): se entrar uma tarefa entre duas páginas, repete-se uma', async () => {
    const db = await novaBd();
    const pagina1 = await listarPorOffset(db, 1, 4);
    await db.query(`INSERT INTO tasks (project_id, title) VALUES (1, 'Nova')`); // alguém criou uma tarefa
    const pagina2 = await listarPorOffset(db, 2, 4);
    assert.deepEqual(ids(pagina1), [10, 9, 8, 7]);
    assert.deepEqual(ids(pagina2), [7, 6, 5, 4], 'a tarefa 7 aparece outra vez: tudo "escorregou" uma posição');
  });
});

describe('P1 · listarPorCursor', () => {
  it('percorre a lista toda, página a página, até proximoCursor ser null', async () => {
    const db = await novaBd();
    const p1 = await listarPorCursor(db, null, 4);
    assert.deepEqual(ids(p1.tarefas), [10, 9, 8, 7]);
    assert.equal(typeof p1.proximoCursor, 'string', 'o cursor é uma string opaca');
    const p2 = await listarPorCursor(db, p1.proximoCursor, 4);
    assert.deepEqual(ids(p2.tarefas), [6, 5, 4, 3]);
    const p3 = await listarPorCursor(db, p2.proximoCursor, 4);
    assert.deepEqual(ids(p3.tarefas), [2, 1]);
    assert.equal(p3.proximoCursor, null, 'na última página, não há próximo cursor');
  });

  it('quando a última página fica exatamente cheia, não promete uma página vazia a seguir', async () => {
    const db = await novaBd();
    const p1 = await listarPorCursor(db, null, 5);
    const p2 = await listarPorCursor(db, p1.proximoCursor, 5);
    assert.deepEqual(ids(p2.tarefas), [5, 4, 3, 2, 1]);
    assert.equal(p2.proximoCursor, null);
  });

  it('se entrar uma tarefa entre duas páginas, NÃO se repete nem se perde nenhuma', async () => {
    const db = await novaBd();
    const p1 = await listarPorCursor(db, null, 4);
    await db.query(`INSERT INTO tasks (project_id, title) VALUES (1, 'Nova')`);
    const p2 = await listarPorCursor(db, p1.proximoCursor, 4);
    assert.deepEqual(ids(p2.tarefas), [6, 5, 4, 3]);
  });

  it('um cursor inventado é recusado', async () => {
    const db = await novaBd();
    await assert.rejects(listarPorCursor(db, 'isto-nao-e-um-cursor', 4), /Cursor inválido/);
  });
});
