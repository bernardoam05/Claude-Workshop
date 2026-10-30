import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { podeEditar, podeVer, tarefasVisiveis } from './consultas.js';

let db;
before(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE TABLE tarefas (id int PRIMARY KEY, titulo text, dono text, projeto_id int);
    CREATE TABLE membros (projeto_id int, utilizador text, papel text);
    CREATE TABLE partilhas (tarefa_id int, utilizador text);
    INSERT INTO tarefas VALUES (1,'a','ana',10),(2,'b','rui',10),(3,'c','rui',20),(4,'d','eva',30),(5,'e','eva',NULL);
    INSERT INTO membros VALUES (10,'ana','editor'),(10,'tiago','leitor'),(20,'tiago','editor');
    INSERT INTO partilhas VALUES (4,'ana');
  `);
});
const ids = (rs) => rs.map((r) => r.id);
const pessoas = [{ id: 'ana' }, { id: 'rui' }, { id: 'eva' }, { id: 'tiago' }, { id: 'zé' }, { id: 'chefe', admin: true }];

describe('P4 · autorização nas consultas', () => {
  it('cada um vê o que deve', async () => {
    assert.deepEqual(ids(await tarefasVisiveis(db, { id: 'ana' })), [1, 2, 4]);
    assert.deepEqual(ids(await tarefasVisiveis(db, { id: 'tiago' })), [1, 2, 3]);
    assert.deepEqual(ids(await tarefasVisiveis(db, { id: 'eva' })), [4, 5]);
    assert.deepEqual(ids(await tarefasVisiveis(db, { id: 'zé' })), []);
    assert.deepEqual(ids(await tarefasVisiveis(db, { id: 'chefe', admin: true })), [1, 2, 3, 4, 5]);
  });
  it('a lista usa uma só consulta', async () => {
    let n = 0;
    const contado = { query: (...a) => (n++, db.query(...a)), exec: (...a) => (n++, db.exec(...a)) };
    await tarefasVisiveis(contado, { id: 'ana' });
    assert.equal(n, 1);
  });
  it('podeVer bate sempre com a lista', async () => {
    for (const p of pessoas) {
      const visiveis = new Set(ids(await tarefasVisiveis(db, p)));
      for (const t of [1, 2, 3, 4, 5, 99]) assert.equal(await podeVer(db, p, t), visiveis.has(t), `${p.id} / ${t}`);
    }
  });
  it('editar: dono, editor do projeto, admin; ler não chega', async () => {
    assert.equal(await podeEditar(db, { id: 'ana' }, 2), true, 'editora do projeto 10');
    assert.equal(await podeEditar(db, { id: 'tiago' }, 2), false, 'só leitor do 10');
    assert.equal(await podeEditar(db, { id: 'tiago' }, 3), true);
    assert.equal(await podeEditar(db, { id: 'ana' }, 4), false, 'partilhada só para ler');
    assert.equal(await podeEditar(db, { id: 'eva' }, 5), true);
    assert.equal(await podeEditar(db, { id: 'chefe', admin: true }, 3), true);
    assert.equal(await podeEditar(db, { id: 'ana' }, 99), false);
  });
});
