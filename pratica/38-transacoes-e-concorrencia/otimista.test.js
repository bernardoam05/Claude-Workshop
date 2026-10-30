import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emParalelo, novaBd } from './ajuda.js';
import { Conflito, acrescentarAoTitulo, atualizarTitulo } from './otimista.js';

const SQL = `
  CREATE TABLE notas (id INT PRIMARY KEY, titulo TEXT NOT NULL, versao INT NOT NULL DEFAULT 1);
  INSERT INTO notas (id, titulo) VALUES (1, 'nota');
`;

describe('P3 · bloqueio otimista', () => {
  it('atualiza com a versão certa e devolve a nova', async () => {
    const pool = await novaBd(SQL);
    try {
      assert.equal(await atualizarTitulo(pool, 1, 'a', 1), 2);
      assert.equal(await atualizarTitulo(pool, 1, 'b', 2), 3);
    } finally {
      await pool.end();
    }
  });

  it('com uma versão antiga (alguém mudou entretanto), Conflito, e nada muda', async () => {
    const pool = await novaBd(SQL);
    try {
      await atualizarTitulo(pool, 1, 'da Ana', 1);
      await assert.rejects(atualizarTitulo(pool, 1, 'do Bruno', 1), Conflito);
      await assert.rejects(atualizarTitulo(pool, 99, 'x', 1), Conflito);
      assert.equal((await pool.query('SELECT titulo FROM notas WHERE id = 1')).rows[0].titulo, 'da Ana');
    } finally {
      await pool.end();
    }
  });

  it('10 edições ao mesmo tempo: com repetição, nenhuma se perde', async () => {
    const pool = await novaBd(SQL);
    try {
      const r = await emParalelo(10, (i) => acrescentarAoTitulo(pool, 1, `-${i}`, { tentativas: 20 }));
      assert.deepEqual(r.filter((x) => x.status === 'rejected').map((x) => x.reason.message), []);
      const { titulo, versao } = (await pool.query('SELECT titulo, versao FROM notas WHERE id = 1')).rows[0];
      for (let i = 0; i < 10; i++) assert.ok(titulo.includes(`-${i}`), `a edição ${i} perdeu-se: ${titulo}`);
      assert.equal(versao, 11);
    } finally {
      await pool.end();
    }
  });

  it('esgotadas as tentativas, o Conflito propaga-se', async () => {
    const pool = await novaBd(SQL);
    try {
      // Um "colega" que muda a nota sempre que a lemos: nunca vamos conseguir.
      const original = pool.query.bind(pool);
      pool.query = async (sql, params) => {
        const r = await original(sql, params);
        if (/^\s*SELECT/i.test(sql)) await original('UPDATE notas SET versao = versao + 1 WHERE id = 1');
        return r;
      };
      await assert.rejects(acrescentarAoTitulo(pool, 1, '-x', { tentativas: 3 }), Conflito);
    } finally {
      await pool.end();
    }
  });
});
