import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { contrair, criarV2, expandir, preencher } from './expandirContrair.js';

let db;
// A versão 1 da aplicação: só conhece a coluna nome.
const criarV1 = (nome) => db.query('INSERT INTO tarefas (nome) VALUES ($1)', [nome]);
const lerV1 = async () => (await db.query('SELECT nome FROM tarefas ORDER BY id')).rows.map((r) => r.nome);

beforeEach(async () => {
  db = new PGlite();
  await db.exec('CREATE TABLE tarefas (id serial PRIMARY KEY, nome text NOT NULL)');
  for (let i = 1; i <= 7; i++) await criarV1(`t${i}`);
});

describe('P4 · expandir/contrair', () => {
  it('depois de expandir, a versão antiga continua a funcionar', async () => {
    await expandir(db);
    await criarV1('t8');
    assert.equal((await lerV1()).length, 8);
  });
  it('a escrita dupla mantém as duas versões a ver o mesmo', async () => {
    await expandir(db);
    const id = await criarV2(db, 'nova');
    const { rows } = await db.query('SELECT nome, titulo FROM tarefas WHERE id = $1', [id]);
    assert.deepEqual(rows[0], { nome: 'nova', titulo: 'nova' });
    assert.ok((await lerV1()).includes('nova'));
  });
  it('preenche em lotes até não sobrar nenhuma', async () => {
    await expandir(db);
    await criarV2(db, 'já tem');
    const lotes = [];
    const original = db.query.bind(db);
    db.query = (sql, params) => {
      if (/^UPDATE/i.test(sql.trim())) lotes.push(params);
      return original(sql, params);
    };
    assert.equal(await preencher(db, { lote: 3 }), 7);
    assert.ok(lotes.length >= 3, 'usou vários UPDATE');
    assert.ok(lotes.every((p) => p?.[0] === 3), 'o tamanho do lote é um parâmetro');
    const { rows } = await original('SELECT count(*)::int AS n FROM tarefas WHERE titulo IS NULL OR titulo <> nome');
    assert.equal(rows[0].n, 0);
  });
  it('recusa contrair com linhas por preencher, sem mudar nada', async () => {
    await expandir(db);
    await assert.rejects(contrair(db), Error);
    await criarV1('ainda funciona');
    assert.equal((await lerV1()).length, 8);
  });
  it('depois de contrair, só existe titulo, e é obrigatório', async () => {
    await expandir(db);
    await preencher(db, { lote: 100 });
    await contrair(db);
    const { rows } = await db.query('SELECT titulo FROM tarefas ORDER BY id');
    assert.equal(rows[0].titulo, 't1');
    await assert.rejects(criarV1('x'), /nome/); // a versão antiga já não funciona: por isso só se contrai no fim
    await assert.rejects(db.query('INSERT INTO tarefas (titulo) VALUES (NULL)'), /null/i);
  });
});
