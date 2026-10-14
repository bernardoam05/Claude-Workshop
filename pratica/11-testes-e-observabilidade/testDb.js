// Um PostgreSQL a sério dentro do Node (PGlite), com a forma de um Pool do `pg`.
// É o mesmo ajudante do módulo 03; ver lá os comentários completos.
// Uso: const db = await createTestDb('schema.sql');  (uma BD nova e vazia, só para esse teste)
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

export async function createTestDb(...ficheirosSql) {
  const pg = new PGlite({ parsers: { 20: (valor) => valor } }); // bigint como string, como no `pg`
  for (const ficheiro of ficheirosSql) {
    await pg.exec(readFileSync(new URL(ficheiro, import.meta.url), 'utf8'));
  }
  const query = async (sql, params = []) => {
    const r = await pg.query(sql, params);
    return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
  };
  return {
    query,
    async connect() {
      return { query, release() {} };
    },
  };
}
