import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { criarEsquema, repositorio } from './repositorio.js';

let db;
let acme;
let globex;
beforeEach(async () => {
  db = new PGlite();
  await criarEsquema(db);
  acme = repositorio(db, 'acme');
  globex = repositorio(db, 'globex');
  // os MESMOS ids nos dois inquilinos: as chaves são (inquilino, id)
  await acme.criarProjeto(1, 'Site');
  await globex.criarProjeto(1, 'App');
  await globex.criarProjeto(2, 'Interno');
  await acme.criarTarefa(1, 1, 'Rever o design');
  await globex.criarTarefa(1, 1, 'Corrigir o login');
});

describe('P2 · esquema partilhado', () => {
  it('cada inquilino só vê o que é seu', async () => {
    assert.deepEqual(await acme.tarefas(), [{ id: 1, projeto_id: 1, titulo: 'Rever o design' }]);
    assert.deepEqual(await globex.tarefa(1), { id: 1, projeto_id: 1, titulo: 'Corrigir o login' });
  });
  it('não se apaga o que é de outro', async () => {
    await globex.criarTarefa(2, 2, 'Só da globex');
    assert.equal(await acme.apagarTarefa(2), false);
    assert.ok(await globex.tarefa(2));
    assert.equal(await acme.apagarTarefa(1), true);
    assert.equal((await globex.tarefas()).length, 2);
  });
  it('a chave estrangeira composta impede referências entre inquilinos', async () => {
    await assert.rejects(acme.criarTarefa(2, 2, 'Aponta para o projeto 2, que só existe na globex'), /foreign key|violates/i);
  });
  it('as chaves primárias são por inquilino', async () => {
    await assert.rejects(acme.criarTarefa(1, 1, 'repetida'), /duplicate|unique/i);
  });
  it('o esquema tem as chaves pedidas', async () => {
    const { rows } = await db.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'tarefas'::regclass ORDER BY contype`,
    );
    const defs = rows.map((r) => r.def).join('\n');
    assert.match(defs, /FOREIGN KEY \(inquilino, projeto_id\) REFERENCES projetos\(inquilino, id\)/);
    assert.match(defs, /PRIMARY KEY \(inquilino, id\)/);
  });
  it('recusa um inquilino vazio', () => {
    assert.throws(() => repositorio(db, ''), /Inquilino inválido/);
    assert.throws(() => repositorio(db, undefined), /Inquilino inválido/);
  });
});
