import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { ErroCursor, codificarCursor, descodificarCursor, pagina } from './paginacao.js';

let db;
beforeEach(async () => {
  db = new PGlite();
  // 25 tarefas; as 5 primeiras com a MESMA data (o id desempata)
  await db.exec(`
    CREATE TABLE tarefas (id int PRIMARY KEY, titulo text, criada_em timestamptz);
    INSERT INTO tarefas SELECT g, 't' || g,
      CASE WHEN g <= 5 THEN '2026-10-01T10:00:00Z'::timestamptz ELSE '2026-10-01T10:00:00Z'::timestamptz + g * interval '1 minute' END
      FROM generate_series(1, 25) g;
  `);
});
async function todas(limite) {
  const ids = [];
  let depois;
  do {
    const p = await pagina(db, { limite, depois });
    ids.push(...p.itens.map((t) => t.id));
    depois = p.proximo;
  } while (depois);
  return ids;
}

describe('P2 · cursores', () => {
  it('ida e volta', () => {
    const c = codificarCursor({ criadaEm: '2026-10-01T10:00:00.000Z', id: 7 });
    assert.match(c, /^[\w-]+$/);
    assert.deepEqual(descodificarCursor(c), { criadaEm: '2026-10-01T10:00:00.000Z', id: 7 });
  });
  it('recusa cursores inválidos', () => {
    for (const mau of ['%%%', Buffer.from('não é json').toString('base64url'), codificarCursor({ criadaEm: 5, id: 1 }), Buffer.from('{"c":"x","i":1.5}').toString('base64url')]) {
      assert.throws(() => descodificarCursor(mau), ErroCursor, mau);
    }
  });
});

describe('P2 · pagina', () => {
  it('a primeira página, das mais recentes', async () => {
    const p = await pagina(db, { limite: 3 });
    assert.deepEqual(p.itens.map((t) => t.id), [25, 24, 23]);
    assert.ok(p.proximo);
  });
  it('percorre tudo sem repetir nem saltar, mesmo com datas iguais', async () => {
    const esperado = Array.from({ length: 25 }, (_, i) => 25 - i);
    assert.deepEqual(await todas(4), esperado);
    assert.deepEqual(await todas(25), esperado);
    assert.deepEqual(await todas(100), esperado);
  });
  it('a última página não tem próximo', async () => {
    const p = await pagina(db, { limite: 25 });
    assert.equal(p.proximo, null);
  });
  it('é estável quando entram tarefas novas no início (o OFFSET não seria)', async () => {
    const p1 = await pagina(db, { limite: 5 });
    await db.exec("INSERT INTO tarefas VALUES (100, 'nova', '2026-12-01T00:00:00Z'), (101, 'outra', '2026-12-02T00:00:00Z')");
    const p2 = await pagina(db, { limite: 5, depois: p1.proximo });
    assert.deepEqual(p2.itens.map((t) => t.id), [20, 19, 18, 17, 16]);
  });
  it('valida o limite e o cursor', async () => {
    await assert.rejects(pagina(db, { limite: 0 }), /limite/);
    await assert.rejects(pagina(db, { limite: 101 }), /limite/);
    await assert.rejects(pagina(db, { limite: 2.5 }), /limite/);
    await assert.rejects(pagina(db, { depois: 'lixo!' }), ErroCursor);
  });
  it('usa uma só consulta por página', async () => {
    let n = 0;
    const contado = { query: (...a) => (n++, db.query(...a)) };
    await pagina(contado, { limite: 5 });
    assert.equal(n, 1);
  });
});
