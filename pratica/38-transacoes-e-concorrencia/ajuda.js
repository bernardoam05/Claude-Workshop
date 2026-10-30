// Peças partilhadas pelos testes do módulo 38.
import assert from 'node:assert/strict';
import pg from 'pg';

// Um pool de ligações (como o src/api/src/db/pool.js), e um schema limpo e só deste teste.
export async function novaBd(sql) {
  assert.ok(process.env.DATABASE_URL, 'corre estes testes com "npm run verificar 38" (arranca o Postgres)');
  const esquema = `t_${Math.random().toString(36).slice(2, 10)}`;
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${esquema}`);
  await admin.end();
  // search_path: as tabelas sem prefixo são criadas e procuradas neste schema.
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 60, options: `-c search_path=${esquema}` });
  await pool.query(sql);
  return pool;
}

// Corre n chamadas ao mesmo tempo e devolve os resultados (sucesso ou erro) de cada uma.
export async function emParalelo(n, fn) {
  return Promise.allSettled(Array.from({ length: n }, (_, i) => fn(i)));
}
