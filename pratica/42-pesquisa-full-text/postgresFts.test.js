import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pesquisar, prepararPesquisa, sugerirTitulo } from './postgresFts.js';

let db;
before(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`
    CREATE EXTENSION pg_trgm;
    CREATE TABLE artigos (id serial PRIMARY KEY, titulo text NOT NULL, corpo text NOT NULL);
    INSERT INTO artigos (titulo, corpo) VALUES
      ('Índices no Postgres', 'Um índice acelera as consultas mas torna as escritas mais lentas.'),
      ('Filas de mensagens', 'O RabbitMQ entrega mensagens aos consumidores; os índices não entram aqui.'),
      ('Cache com Redis', 'A cache guarda respostas para não repetir consultas lentas à base de dados.'),
      ('Testes de carga', 'Com o k6 medes a latência das consultas sob carga.');
  `);
  await prepararPesquisa(db);
});

describe('P4 · Postgres FTS', () => {
  it('a coluna é gerada e mantida pelo Postgres', async () => {
    await db.query("INSERT INTO artigos (titulo, corpo) VALUES ('Novo', 'tarefas urgentes')");
    const { rows } = await db.query("SELECT pesquisa::text AS v FROM artigos WHERE titulo = 'Novo'");
    assert.match(rows[0].v, /'taref'/);
    await db.query("DELETE FROM artigos WHERE titulo = 'Novo'");
  });
  it('cria os índices GIN', async () => {
    const { rows } = await db.query("SELECT indexdef FROM pg_indexes WHERE tablename = 'artigos' ORDER BY indexname");
    const defs = rows.map((r) => r.indexdef).join('\n');
    assert.match(defs, /USING gin \(pesquisa\)/);
    assert.match(defs, /gin_trgm_ops/);
  });
  it('encontra palavras pela raiz (consultas → consulta)', async () => {
    const r = await pesquisar(db, 'consulta');
    assert.deepEqual(r.map((x) => x.id).sort(), [1, 3, 4]);
  });
  it('o título pesa mais do que o corpo', async () => {
    const r = await pesquisar(db, 'índices');
    assert.equal(r[0].titulo, 'Índices no Postgres');
    assert.equal(r.length, 2);
  });
  it('aceita a sintaxe de motor de pesquisa (-excluir, OR)', async () => {
    assert.deepEqual((await pesquisar(db, 'índices -rabbitmq')).map((x) => x.id), [1]);
    assert.deepEqual((await pesquisar(db, 'redis or rabbitmq')).map((x) => x.id).sort(), [2, 3]);
  });
  it('devolve um excerto com os termos marcados, e respeita o limite', async () => {
    const r = await pesquisar(db, 'latência', { limite: 1 });
    assert.equal(r.length, 1);
    assert.match(r[0].excerto, /<b>latência<\/b>/);
  });
  it('sugere o título mais parecido, apesar dos erros', async () => {
    assert.equal(await sugerirTitulo(db, 'testes de crga'), 'Testes de carga');
    assert.equal(await sugerirTitulo(db, 'xyzzy'), null);
  });
});
