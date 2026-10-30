import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emParalelo, novaBd } from './ajuda.js';
import { transferir } from './transferencias.js';

const SQL = `
  CREATE TABLE contas (id INT PRIMARY KEY, saldo NUMERIC NOT NULL CHECK (saldo >= 0));
  INSERT INTO contas VALUES (1, 1000), (2, 1000), (3, 50);
`;
const saldos = async (pool) => Object.fromEntries((await pool.query('SELECT id, saldo::int AS s FROM contas ORDER BY id')).rows.map((r) => [r.id, r.s]));

describe('P2 · transferir', () => {
  it('move o dinheiro', async () => {
    const pool = await novaBd(SQL);
    try {
      await transferir(pool, 1, 2, 300);
      assert.deepEqual(await saldos(pool), { 1: 700, 2: 1300, 3: 50 });
    } finally {
      await pool.end();
    }
  });

  it('sem saldo, não muda nada', async () => {
    const pool = await novaBd(SQL);
    try {
      await assert.rejects(transferir(pool, 3, 1, 51), /saldo/);
      assert.deepEqual(await saldos(pool), { 1: 1000, 2: 1000, 3: 50 });
    } finally {
      await pool.end();
    }
  });

  it('valida os argumentos', async () => {
    const pool = await novaBd(SQL);
    try {
      await transferir(pool, 1, 2, 1);
      await assert.rejects(transferir(pool, 1, 1, 10));
      await assert.rejects(transferir(pool, 1, 2, 0));
      await assert.rejects(transferir(pool, 1, 2, -5));
      assert.deepEqual(await saldos(pool), { 1: 999, 2: 1001, 3: 50 });
    } finally {
      await pool.end();
    }
  });

  it('200 transferências cruzadas ao mesmo tempo: sem deadlocks, e o dinheiro total conserva-se', async () => {
    const pool = await novaBd(SQL);
    try {
      const r = await emParalelo(200, (i) => (i % 2 ? transferir(pool, 1, 2, 1) : transferir(pool, 2, 1, 1)));
      const falhas = r.filter((x) => x.status === 'rejected').map((x) => `${x.reason.code ?? ''} ${x.reason.message}`);
      assert.deepEqual(falhas, [], 'um erro 40P01 é um deadlock: bloqueia as contas sempre pela mesma ordem');
      assert.deepEqual(await saldos(pool), { 1: 1000, 2: 1000, 3: 50 });
    } finally {
      await pool.end();
    }
  });
});
