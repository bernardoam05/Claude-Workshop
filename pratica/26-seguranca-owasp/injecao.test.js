import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { procurarNotas } from './injecao.js';

// Uma BD Postgres a sério (PGlite, como no módulo 03), com notas de dois donos e uma tabela de
// utilizadores com hashes de passwords: o que um atacante quereria roubar.
async function novaBd() {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE utilizadores (id INT PRIMARY KEY, email TEXT, hash TEXT);
    INSERT INTO utilizadores VALUES (1, 'ana@x.pt', '$2b$10$segredoDaAna'), (2, 'bruno@x.pt', '$2b$10$segredoDoBruno');
    CREATE TABLE notas (id SERIAL PRIMARY KEY, dono INT, titulo TEXT, criada_em TIMESTAMPTZ);
    INSERT INTO notas (dono, titulo, criada_em) VALUES
      (1, 'Comprar pão', '2026-01-02'), (1, 'Estudar SQL', '2026-01-01'), (2, 'Segredo do Bruno', '2026-01-03');
  `);
  return { query: async (sql, params) => ({ rows: (await pg.query(sql, params)).rows }), pg };
}

const titulos = (rows) => rows.map((r) => r.titulo);

describe('P1 · uso normal (tem de continuar a funcionar)', () => {
  it('lista as notas do dono, por data', async () => {
    const db = await novaBd();
    assert.deepEqual(titulos(await procurarNotas(db, { dono: 1 })), ['Estudar SQL', 'Comprar pão']);
  });

  it('pesquisa por texto, sem distinguir maiúsculas', async () => {
    const db = await novaBd();
    assert.deepEqual(titulos(await procurarNotas(db, { dono: 1, texto: 'sql' })), ['Estudar SQL']);
  });

  it('ordena por título quando pedido', async () => {
    const db = await novaBd();
    assert.deepEqual(titulos(await procurarNotas(db, { dono: 1, ordenar: 'titulo' })), ['Comprar pão', 'Estudar SQL']);
  });

  it("aceita textos com plicas (um nome como O'Brien não pode partir a query)", async () => {
    const db = await novaBd();
    assert.deepEqual(await procurarNotas(db, { dono: 1, texto: "O'Brien" }), []);
  });
});

describe('P1 · ataques (têm de falhar)', () => {
  it("texto = \"' OR dono = 2 --\" não mostra as notas dos outros", async () => {
    const db = await novaBd();
    // Colado no SQL, fica: titulo ILIKE '%' OR dono = 2 --%'  (o -- comenta o resto da linha)
    const r = await procurarNotas(db, { dono: 1, texto: "' OR dono = 2 --" }).catch(() => []);
    assert.ok(!titulos(r).includes('Segredo do Bruno'), 'a injeção leu as notas do Bruno');
  });

  it('um UNION SELECT não consegue ler a tabela de utilizadores', async () => {
    const db = await novaBd();
    const ataque = "' UNION SELECT id, hash FROM utilizadores --";
    const r = await procurarNotas(db, { dono: 1, texto: ataque, ordenar: 'titulo' }).catch(() => []);
    assert.ok(!JSON.stringify(r).includes('segredo'), 'a injeção leu os hashes das passwords');
  });

  it('"ordenar" só aceita colunas permitidas, e nunca corre SQL extra', async () => {
    const db = await novaBd();
    await assert.rejects(procurarNotas(db, { dono: 1, ordenar: 'id; DROP TABLE notas' }), /ordenar/);
    await assert.rejects(procurarNotas(db, { dono: 1, ordenar: 'dono' }), /ordenar/);
    const { rows } = await db.pg.query('SELECT count(*)::int AS n FROM notas');
    assert.equal(rows[0].n, 3, 'a tabela notas foi alterada');
  });

  it('o dono também não aceita SQL', async () => {
    const db = await novaBd();
    const r = await procurarNotas(db, { dono: '1 OR 1=1' }).catch(() => []);
    assert.ok(!titulos(r).includes('Segredo do Bruno'));
  });
});
