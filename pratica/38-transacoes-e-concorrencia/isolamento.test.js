import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { novaBd } from './ajuda.js';
import { contarDuasVezes, emSerializavel, sairDoTurno } from './isolamento.js';

describe('P4 · níveis de isolamento', () => {
  const SQL = `CREATE TABLE tarefas (id SERIAL PRIMARY KEY, titulo TEXT); INSERT INTO tarefas (titulo) VALUES ('a'), ('b');`;

  it('READ COMMITTED vê o que os outros confirmaram entretanto', async () => {
    const pool = await novaBd(SQL);
    try {
      const r = await contarDuasVezes(pool, 'READ COMMITTED', () => pool.query("INSERT INTO tarefas (titulo) VALUES ('nova')"));
      assert.deepEqual(r, [2, 3]);
    } finally {
      await pool.end();
    }
  });

  it('REPEATABLE READ vê sempre a mesma fotografia', async () => {
    const pool = await novaBd(SQL);
    try {
      const r = await contarDuasVezes(pool, 'REPEATABLE READ', () => pool.query("INSERT INTO tarefas (titulo) VALUES ('nova')"));
      assert.deepEqual(r, [2, 2]);
    } finally {
      await pool.end();
    }
  });

  it('não aceita níveis inventados (nem SQL no lugar do nível)', async () => {
    const pool = await novaBd(SQL);
    try {
      assert.deepEqual(await contarDuasVezes(pool, 'READ COMMITTED', async () => {}), [2, 2]);
      await assert.rejects(contarDuasVezes(pool, 'READ COMMITTED; DROP TABLE tarefas', async () => {}));
    } finally {
      await pool.end();
    }
  });
});

describe('P4 · SERIALIZABLE e o write skew', () => {
  const SQL = `CREATE TABLE medicos (nome TEXT PRIMARY KEY, de_turno BOOLEAN NOT NULL); INSERT INTO medicos VALUES ('Ana', true), ('Bruno', true);`;

  it('demonstração: em READ COMMITTED, os dois saem e o hospital fica sem ninguém', async () => {
    const pool = await novaBd(SQL);
    try {
      // Os dois leem primeiro, e só depois escrevem (como acontece com dois pedidos ao mesmo tempo).
      const [a, b] = [await pool.connect(), await pool.connect()];
      await a.query('BEGIN');
      await b.query('BEGIN');
      const contar = async (c) => (await c.query('SELECT count(*)::int AS n FROM medicos WHERE de_turno')).rows[0].n;
      const [na, nb] = [await contar(a), await contar(b)];
      if (na >= 2) await a.query("UPDATE medicos SET de_turno = false WHERE nome = 'Ana'");
      if (nb >= 2) await b.query("UPDATE medicos SET de_turno = false WHERE nome = 'Bruno'");
      await a.query('COMMIT');
      await b.query('COMMIT');
      a.release();
      b.release();
      const { rows } = await pool.query('SELECT count(*)::int AS n FROM medicos WHERE de_turno');
      assert.equal(rows[0].n, 0);
    } finally {
      await pool.end();
    }
  });

  it('com sairDoTurno (SERIALIZABLE + repetição), fica sempre pelo menos um', async () => {
    for (let ronda = 0; ronda < 5; ronda++) {
      const pool = await novaBd(SQL);
      try {
        const r = await Promise.all([sairDoTurno(pool, 'Ana'), sairDoTurno(pool, 'Bruno')]);
        assert.deepEqual(r.filter(Boolean).length, 1, `ronda ${ronda}: saíram ${r.filter(Boolean).length}`);
        const { rows } = await pool.query('SELECT count(*)::int AS n FROM medicos WHERE de_turno');
        assert.equal(rows[0].n, 1);
      } finally {
        await pool.end();
      }
    }
  });

  it('emSerializavel repete os erros 40001 e propaga os outros', async () => {
    const pool = await novaBd(SQL);
    try {
      let chamadas = 0;
      const r = await emSerializavel(pool, async () => {
        chamadas++;
        if (chamadas < 3) throw Object.assign(new Error('could not serialize access'), { code: '40001' });
        return 'ok';
      });
      assert.equal(r, 'ok');
      assert.equal(chamadas, 3);
      let outras = 0;
      await assert.rejects(emSerializavel(pool, async () => {
        outras++;
        throw Object.assign(new Error('violação'), { code: '23505' });
      }), /violação/);
      assert.equal(outras, 1, 'só os erros de serialização se repetem');
      assert.equal(pool.waitingCount, 0);
    } finally {
      await pool.end();
    }
  });
});
