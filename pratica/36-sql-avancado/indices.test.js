import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { CONSULTAS, criarIndices } from './indices.js';

let db;
// O plano de uma consulta, como uma lista plana de nós { tipo, indice }.
async function plano(sql) {
  const { rows } = await db.query(`EXPLAIN (FORMAT JSON) ${sql}`);
  const nos = [];
  const visitar = (n) => {
    nos.push({ tipo: n['Node Type'], indice: n['Index Name'] });
    (n.Plans ?? []).forEach(visitar);
  };
  visitar(rows[0]['QUERY PLAN'][0].Plan);
  return nos;
}
const usaIndice = (nos) => nos.find((n) => n.indice);

before(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE TABLE tarefas (id serial PRIMARY KEY, utilizador text, projeto text, criada_em timestamptz, concluida_em timestamptz, titulo text);
    INSERT INTO tarefas (utilizador, projeto, criada_em, concluida_em, titulo)
      SELECT 'u' || (g % 500), 'p' || (g % 50), now() - g * interval '1 minute',
             CASE WHEN g % 20 = 0 THEN NULL ELSE now() END, 'tarefa ' || g
        FROM generate_series(1, 60000) g;
    CREATE TABLE utilizadores (id serial PRIMARY KEY, email text);
    INSERT INTO utilizadores (email) SELECT 'Pessoa' || g || '@Exemplo.PT' FROM generate_series(1, 20000) g;
  `);
  const antes = await plano(CONSULTAS.recentesDoUtilizador);
  assert.ok(!usaIndice(antes), 'antes dos teus índices, não há índice para esta consulta');
  await criarIndices(db);
  await db.exec('ANALYZE');
});

describe('P3 · índices à medida das consultas', () => {
  it('no máximo três índices novos', async () => {
    const { rows } = await db.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname NOT LIKE '%_pkey'");
    assert.ok(rows.length >= 1 && rows.length <= 3, rows.map((r) => r.indexname).join(', '));
  });
  it('recentes do utilizador: índice composto, sem Sort', async () => {
    const nos = await plano(CONSULTAS.recentesDoUtilizador);
    assert.ok(usaIndice(nos), JSON.stringify(nos));
    assert.ok(!nos.some((n) => n.tipo === 'Sort'), `ainda ordena: ${JSON.stringify(nos)}`);
  });
  it('abertas do projeto: um índice parcial', async () => {
    const nos = await plano(CONSULTAS.abertasDoProjeto);
    const i = usaIndice(nos);
    assert.ok(i, JSON.stringify(nos));
    const { rows } = await db.query('SELECT indexdef FROM pg_indexes WHERE indexname = $1', [i.indice]);
    assert.match(rows[0].indexdef, /WHERE \(?concluida_em IS NULL\)?/, 'o índice usado devia ser parcial');
  });
  it('por email: um índice sobre lower(email)', async () => {
    const i = usaIndice(await plano(CONSULTAS.porEmail));
    assert.ok(i, 'a consulta não usa índice');
    const { rows } = await db.query('SELECT indexdef FROM pg_indexes WHERE indexname = $1', [i.indice]);
    assert.match(rows[0].indexdef, /lower\(email\)/);
  });
});
