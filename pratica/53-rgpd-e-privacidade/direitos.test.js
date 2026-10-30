import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { apagarTitular, aplicarRetencao, exportarDados } from './direitos.js';

let db;
beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE TABLE utilizadores (id int PRIMARY KEY, email text NOT NULL, nome text NOT NULL);
    CREATE TABLE tarefas (id serial PRIMARY KEY, utilizador_id int NOT NULL REFERENCES utilizadores, titulo text);
    CREATE TABLE faturas (id serial PRIMARY KEY, utilizador_id int REFERENCES utilizadores, nif text, valor numeric, emitida_em date);
    CREATE TABLE acessos (id serial PRIMARY KEY, utilizador_id int NOT NULL REFERENCES utilizadores, ip text, em timestamptz);
    INSERT INTO utilizadores VALUES (1, 'ana@exemplo.pt', 'Ana'), (2, 'rui@exemplo.pt', 'Rui');
    INSERT INTO tarefas (utilizador_id, titulo) VALUES (1, 'a1'), (2, 'r1'), (1, 'a2');
    INSERT INTO faturas (utilizador_id, nif, valor, emitida_em) VALUES (1, '123456789', 9.99, '2026-01-01'), (2, '987654321', 5, '2026-02-01');
    INSERT INTO acessos (utilizador_id, ip, em) VALUES
      (1, '10.0.0.1', '2026-10-01T10:00:00Z'), (1, '10.0.0.2', '2026-05-01T10:00:00Z'), (2, '10.0.0.3', '2026-06-01T10:00:00Z');
  `);
});

describe('P4 · exportarDados', () => {
  it('junta tudo o que é do titular', async () => {
    const d = await exportarDados(db, 1);
    assert.equal(d.utilizador.email, 'ana@exemplo.pt');
    assert.deepEqual(d.tarefas.map((t) => t.titulo), ['a1', 'a2']);
    assert.equal(d.faturas.length, 1);
    assert.deepEqual(d.acessos.map((a) => a.ip), ['10.0.0.1', '10.0.0.2']);
  });
  it('falha para um titular que não existe', async () => {
    await assert.rejects(exportarDados(db, 99), /99/);
  });
});

describe('P4 · apagarTitular', () => {
  it('apaga os dados, guarda as faturas sem ligação ao titular, e não toca nos outros', async () => {
    assert.deepEqual(await apagarTitular(db, 1), { tarefas: 2, acessos: 2, faturasAnonimizadas: 1 });
    const { rows: u } = await db.query('SELECT id FROM utilizadores ORDER BY id');
    assert.deepEqual(u.map((r) => r.id), [2]);
    const { rows: f } = await db.query('SELECT utilizador_id, nif FROM faturas ORDER BY id');
    assert.deepEqual(f, [{ utilizador_id: null, nif: '123456789' }, { utilizador_id: 2, nif: '987654321' }]);
    assert.equal((await exportarDados(db, 2)).tarefas.length, 1);
  });
  it('é tudo ou nada', async () => {
    await db.exec('CREATE TABLE bloqueio (u int REFERENCES utilizadores); INSERT INTO bloqueio VALUES (1)');
    await assert.rejects(apagarTitular(db, 1), /foreign key/);
    assert.equal((await exportarDados(db, 1)).tarefas.length, 2, 'nada foi apagado');
  });
});

describe('P4 · aplicarRetencao', () => {
  it('apaga os acessos mais antigos do que o prazo', async () => {
    assert.equal(await aplicarRetencao(db, { agora: '2026-10-30T00:00:00Z' }), 2);
    const { rows } = await db.query('SELECT ip FROM acessos');
    assert.deepEqual(rows, [{ ip: '10.0.0.1' }]);
  });
  it('aceita outro prazo', async () => {
    assert.equal(await aplicarRetencao(db, { agora: '2026-10-30T00:00:00Z', diasAcessos: 365 }), 0);
  });
});
