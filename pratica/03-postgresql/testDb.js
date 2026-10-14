// Uma base de dados PostgreSQL a sério, mas a correr dentro do Node (PGlite: o Postgres compilado
// para WebAssembly). Não precisa de Docker. Cada teste cria a sua, do zero, em memória.
//
// Devolve um objeto com a MESMA forma que o Pool do driver `pg` usado em src/api:
//   db.query(sql, params) → { rows, rowCount }
//   db.connect()          → client com .query(...) e .release()   (para transações)
// e, como o `pg`, devolve bigint (ex.: count(*)) como STRING. Ver a secção 5 do módulo 03.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const INT8_OID = 20;

export async function createTestDb(...ficheirosSql) {
  const pg = new PGlite({ parsers: { [INT8_OID]: (valor) => valor } });
  for (const ficheiro of ficheirosSql) {
    const sql = readFileSync(new URL(ficheiro, import.meta.url), 'utf8');
    await pg.exec(sql);
  }

  const query = async (sql, params = []) => {
    const r = await pg.query(sql, params);
    return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
  };

  return {
    query,
    // O PGlite tem uma só ligação, por isso o "client" é a mesma. No pg, seria uma ligação do pool.
    async connect() {
      return { query, release() {} };
    },
    close: () => pg.close(),
  };
}

// Lê um ficheiro de queries/ (sem os comentários) para o correr nos testes.
export function lerQuery(nome) {
  return readFileSync(new URL(`queries/${nome}`, import.meta.url), 'utf8');
}

// O P2 e o P3 correm sobre o TEU schema.sql: sem o P1 feito, não há tabelas onde pôr o seed.sql.
export function assertSchemaFeito() {
  const sql = readFileSync(new URL('schema.sql', import.meta.url), 'utf8');
  if (!/create\s+table/i.test(sql)) {
    throw new Error('Faz primeiro o P1: o P2 e o P3 usam as tabelas criadas pelo teu schema.sql.');
  }
}
