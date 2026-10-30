import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emParalelo, novaBd } from './ajuda.js';
import { comprarAtomico, comprarComBloqueio, comprarIngenuo } from './bilhetes.js';

const SQL = `
  CREATE TABLE eventos (id INT PRIMARY KEY, nome TEXT, disponiveis INT NOT NULL CHECK (disponiveis >= 0));
  CREATE TABLE compras (id SERIAL PRIMARY KEY, evento_id INT REFERENCES eventos(id), cliente TEXT);
  INSERT INTO eventos VALUES (1, 'Concerto', 10);
`;

async function corrida(comprar) {
  const pool = await novaBd(SQL);
  try {
    const r = await emParalelo(50, (i) => comprar(pool, 1, `cliente-${i}`));
    const erros = r.filter((x) => x.status === 'rejected').map((x) => x.reason.message);
    const vendidos = r.filter((x) => x.value === true).length;
    const { rows: [e] } = await pool.query('SELECT disponiveis FROM eventos WHERE id = 1');
    const { rows: [c] } = await pool.query('SELECT count(*)::int AS n FROM compras');
    return { vendidos, erros, disponiveis: e.disponiveis, compras: c.n };
  } finally {
    await pool.end();
  }
}

describe('P1 · o último bilhete (50 clientes, 10 bilhetes)', () => {
  it('demonstração: a versão ingénua vende bilhetes que não existem', async () => {
    const r = await corrida(comprarIngenuo);
    assert.ok(r.compras > 10, `a versão ingénua registou ${r.compras} compras para 10 bilhetes (se deu 10, tiveste sorte: corre outra vez)`);
  });

  it('comprarAtomico vende exatamente 10', async () => {
    const r = await corrida(comprarAtomico);
    assert.deepEqual(r.erros, []);
    assert.deepEqual({ vendidos: r.vendidos, disponiveis: r.disponiveis, compras: r.compras }, { vendidos: 10, disponiveis: 0, compras: 10 });
  });

  it('comprarComBloqueio vende exatamente 10', async () => {
    const r = await corrida(comprarComBloqueio);
    assert.deepEqual(r.erros, []);
    assert.deepEqual({ vendidos: r.vendidos, disponiveis: r.disponiveis, compras: r.compras }, { vendidos: 10, disponiveis: 0, compras: 10 });
  });

  it('as ligações voltam ao pool (sem release, o pool esgota-se e os pedidos ficam pendurados)', async () => {
    const pool = await novaBd(SQL);
    try {
      for (let i = 0; i < 70; i++) await comprarAtomico(pool, 1, 'x'); // mais do que o máximo do pool (60)
      assert.equal(pool.idleCount + pool.waitingCount <= pool.totalCount, true);
      assert.equal(pool.waitingCount, 0);
    } finally {
      await pool.end();
    }
  });
});
