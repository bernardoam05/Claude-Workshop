import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resumoJoin, resumoN1 } from './resumo.js';
import { createTestDb } from './testDb.js';

// Embrulha a BD para CONTAR as queries e simular a latência de rede (aqui a BD está no mesmo
// processo e responde em microssegundos; um Postgres a sério está do outro lado de uma rede).
function comContador(db, latenciaMs = 2) {
  const embrulhada = {
    queries: 0,
    async query(sql, params) {
      embrulhada.queries++;
      await new Promise((resolve) => setTimeout(resolve, latenciaMs));
      return db.query(sql, params);
    },
  };
  return embrulhada;
}

async function novaBd(nProjetos) {
  const db = await createTestDb('schema.sql');
  for (let p = 1; p <= nProjetos; p++) {
    await db.query('INSERT INTO projects (name) VALUES ($1)', [`Projeto ${p}`]);
    // O último projeto fica sem tarefas; os outros têm 2.
    if (p < nProjetos) {
      await db.query('INSERT INTO tasks (project_id, title) VALUES ($1, $2), ($1, $3)', [p, `T${p}a`, `T${p}b`]);
    }
  }
  return db;
}

describe('P2 · N+1 vs JOIN', () => {
  it('as duas versões devolvem exatamente o mesmo resultado', async () => {
    const db = await novaBd(3);
    const esperado = [
      { projeto: 'Projeto 1', tarefas: ['T1a', 'T1b'] },
      { projeto: 'Projeto 2', tarefas: ['T2a', 'T2b'] },
      { projeto: 'Projeto 3', tarefas: [] },
    ];
    assert.deepEqual(await resumoN1(db), esperado);
    assert.deepEqual(await resumoJoin(db), esperado);
  });

  it('a versão N+1 faz 1 + N queries; a versão JOIN faz 1', async (t) => {
    const db = await novaBd(50);

    const n1 = comContador(db);
    let inicio = performance.now();
    await resumoN1(n1);
    const tempoN1 = performance.now() - inicio;

    const join = comContador(db);
    inicio = performance.now();
    await resumoJoin(join);
    const tempoJoin = performance.now() - inicio;

    assert.equal(n1.queries, 51, 'N+1: 1 query dos projetos + 50 queries de tarefas');
    assert.equal(join.queries, 1);
    // t.diagnostic escreve uma nota no relatório dos testes: vê os números quando correres.
    t.diagnostic(`50 projetos, 2 ms de rede por query: N+1 ${tempoN1.toFixed(0)} ms · JOIN ${tempoJoin.toFixed(0)} ms`);
  });
});
