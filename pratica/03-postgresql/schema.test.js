import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createTestDb } from './testDb.js';

// Os códigos de erro do Postgres (SQLSTATE) são a forma fiável de saber QUE regra foi violada.
const NOT_NULL = '23502';
const FOREIGN_KEY = '23503';
const UNIQUE = '23505';
const CHECK = '23514';

async function falhaCom(promessa, codigo) {
  await assert.rejects(promessa, (err) => {
    assert.equal(err.code, codigo, `esperava o erro ${codigo}, veio ${err.code}: ${err.message}`);
    return true;
  });
}

// Cada teste começa com uma BD nova: base.sql + o teu schema.sql + dois utilizadores (ids 1 e 2).
async function novaBd() {
  const sql = readFileSync(new URL('schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /create\s+table/i, 'o schema.sql ainda não tem nenhum CREATE TABLE');
  const db = await createTestDb('base.sql', 'schema.sql');
  await db.query(`INSERT INTO users (email) VALUES ('a@x.pt'), ('b@x.pt')`);
  return db;
}

describe('P1 · schema.sql', () => {

  it('cria as colunas pedidas, com os nomes exatos', async () => {
    const db = await novaBd();
    const { rows } = await db.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_name IN ('projects', 'tasks') ORDER BY table_name, ordinal_position`,
    );
    const colunas = (tabela) => rows.filter((r) => r.table_name === tabela).map((r) => r.column_name).sort();
    assert.deepEqual(colunas('projects'), ['created_at', 'id', 'name', 'owner_id']);
    assert.deepEqual(colunas('tasks'), ['created_at', 'done', 'due_date', 'id', 'project_id', 'title']);
  });

  it('pode correr duas vezes seguidas (IF NOT EXISTS)', async () => {
    await novaBd();
    await assert.doesNotReject(createTestDb('base.sql', 'schema.sql', 'schema.sql'));
  });

  it('ids gerados pela BD e valores por omissão (done=false, created_at preenchido)', async () => {
    const db = await novaBd();
    const { rows: [p] } = await db.query(`INSERT INTO projects (owner_id, name) VALUES (1, 'P') RETURNING *`);
    assert.equal(p.id, 1);
    assert.ok(p.created_at instanceof Date, 'created_at devia ter um valor por omissão');

    const { rows: [t] } = await db.query(`INSERT INTO tasks (project_id, title) VALUES ($1, 'T') RETURNING *`, [p.id]);
    assert.equal(t.done, false);
    assert.equal(t.due_date, null);
    assert.ok(t.created_at instanceof Date);
  });

  it('nome do projeto: obrigatório, entre 1 e 100 caracteres', async () => {
    const db = await novaBd();
    await falhaCom(db.query(`INSERT INTO projects (owner_id, name) VALUES (1, NULL)`), NOT_NULL);
    await falhaCom(db.query(`INSERT INTO projects (owner_id, name) VALUES (1, '')`), CHECK);
    await falhaCom(db.query(`INSERT INTO projects (owner_id, name) VALUES (1, $1)`, ['x'.repeat(101)]), CHECK);
  });

  it('o mesmo utilizador não repete nomes de projeto; utilizadores diferentes podem', async () => {
    const db = await novaBd();
    await db.query(`INSERT INTO projects (owner_id, name) VALUES (1, 'Casa')`);
    await falhaCom(db.query(`INSERT INTO projects (owner_id, name) VALUES (1, 'Casa')`), UNIQUE);
    await assert.doesNotReject(db.query(`INSERT INTO projects (owner_id, name) VALUES (2, 'Casa')`));
  });

  it('título da tarefa: obrigatório, entre 1 e 200 caracteres', async () => {
    const db = await novaBd();
    await db.query(`INSERT INTO projects (owner_id, name) VALUES (1, 'P')`);
    await falhaCom(db.query(`INSERT INTO tasks (project_id, title) VALUES (1, NULL)`), NOT_NULL);
    await falhaCom(db.query(`INSERT INTO tasks (project_id, title) VALUES (1, '')`), CHECK);
    await falhaCom(db.query(`INSERT INTO tasks (project_id, title) VALUES (1, $1)`, ['x'.repeat(201)]), CHECK);
  });

  it('chaves estrangeiras: dono e projeto têm de existir', async () => {
    const db = await novaBd();
    await falhaCom(db.query(`INSERT INTO projects (owner_id, name) VALUES (999, 'P')`), FOREIGN_KEY);
    await falhaCom(db.query(`INSERT INTO tasks (project_id, title) VALUES (999, 'T')`), FOREIGN_KEY);
  });

  it('apagar um utilizador apaga os seus projetos e as tarefas deles (ON DELETE CASCADE)', async () => {
    const db = await novaBd();
    await db.query(`INSERT INTO projects (owner_id, name) VALUES (1, 'P')`);
    await db.query(`INSERT INTO tasks (project_id, title) VALUES (1, 'T1'), (1, 'T2')`);
    await db.query(`DELETE FROM users WHERE id = 1`);
    const { rows } = await db.query(
      `SELECT (SELECT count(*) FROM projects)::int AS p, (SELECT count(*) FROM tasks)::int AS t`,
    );
    assert.deepEqual(rows[0], { p: 0, t: 0 });
  });

  it('existe um índice em tasks(project_id)', async () => {
    const db = await novaBd();
    const { rows } = await db.query(`SELECT indexdef FROM pg_indexes WHERE tablename = 'tasks'`);
    assert.ok(
      rows.some((r) => /\(project_id\)/.test(r.indexdef)),
      'nenhum índice em tasks(project_id): procurar as tarefas de um projeto obrigava a ler a tabela toda',
    );
  });
});
