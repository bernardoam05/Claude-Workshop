import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { ativarRls, comInquilino } from './rls.js';

let db;
beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE TABLE notas (inquilino text NOT NULL, id int NOT NULL, texto text, PRIMARY KEY (inquilino, id));
    INSERT INTO notas VALUES ('acme', 1, 'a1'), ('acme', 2, 'a2'), ('globex', 1, 'g1');
  `);
  await ativarRls(db);
});
const ler = (tx) => tx.query('SELECT inquilino, id FROM notas ORDER BY id').then((r) => r.rows);

describe('P3 · Row-Level Security', () => {
  it('uma consulta SEM where só vê as linhas do inquilino', async () => {
    assert.deepEqual(await comInquilino(db, 'acme', ler), [{ inquilino: 'acme', id: 1 }, { inquilino: 'acme', id: 2 }]);
    assert.deepEqual(await comInquilino(db, 'globex', ler), [{ inquilino: 'globex', id: 1 }]);
  });
  it('não se escrevem linhas para outro inquilino', async () => {
    await assert.rejects(
      comInquilino(db, 'acme', (tx) => tx.query("INSERT INTO notas VALUES ('globex', 9, 'intrusa')")),
      /row-level security/i,
    );
    await comInquilino(db, 'acme', (tx) => tx.query("INSERT INTO notas VALUES ('acme', 9, 'ok')"));
  });
  it('não se apagam nem mudam linhas de outro (simplesmente não as vê)', async () => {
    const r = await comInquilino(db, 'acme', (tx) => tx.query("DELETE FROM notas WHERE inquilino = 'globex'"));
    assert.equal(r.affectedRows, 0);
    assert.deepEqual(await comInquilino(db, 'globex', ler), [{ inquilino: 'globex', id: 1 }]);
  });
  it('a definição não passa para a transação seguinte', async () => {
    await comInquilino(db, 'acme', ler);
    const { rows } = await db.query("SELECT current_setting('app.inquilino', true) AS v, current_user AS u");
    assert.ok(!rows[0].v, `ficou definido: ${rows[0].v}`);
    assert.equal(rows[0].u, 'postgres');
  });
  it('com o papel app mas sem inquilino definido, não vê nada (falha fechado)', async () => {
    const r = await db.transaction(async (tx) => {
      await tx.query('SET LOCAL ROLE app');
      return ler(tx);
    });
    assert.deepEqual(r, []);
  });
  it('o RLS está forçado na tabela', async () => {
    const { rows } = await db.query("SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'notas'");
    assert.deepEqual(rows[0], { relrowsecurity: true, relforcerowsecurity: true });
  });
  it('recusa um inquilino vazio', async () => {
    await assert.rejects(comInquilino(db, '', ler), /Inquilino inválido/);
  });
});
