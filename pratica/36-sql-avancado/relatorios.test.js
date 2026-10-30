import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { baseDeDados } from './dados.js';
import { duracaoPorProjeto, porSemana, resumoPorProjeto } from './relatorios.js';

let db;
before(async () => (db = await baseDeDados()));

describe('P4 · relatórios', () => {
  it('uma linha por semana, incluindo as vazias', async () => {
    assert.deepEqual(await porSemana(db, '2026-09-23', '2026-10-21'), [
      { semana: '2026-09-21', criadas: 0, concluidas: 0 },
      { semana: '2026-09-28', criadas: 6, concluidas: 2 }, // 3 e 4 de outubro (sábado e domingo)
      { semana: '2026-10-05', criadas: 4, concluidas: 4 },
      { semana: '2026-10-12', criadas: 0, concluidas: 1 },
      { semana: '2026-10-19', criadas: 0, concluidas: 0 },
    ]);
  });
  it('subtotais com ROLLUP', async () => {
    assert.deepEqual(await resumoPorProjeto(db), [
      { projeto: 'api', tarefas: 6, abertas: 2, pontos: 42 },
      { projeto: 'ops', tarefas: 1, abertas: 0, pontos: 2 },
      { projeto: 'web', tarefas: 3, abertas: 1, pontos: 16 },
      { projeto: null, tarefas: 10, abertas: 3, pontos: 60 },
    ]);
  });
  it('mediana e p90 da duração', async () => {
    assert.deepEqual(await duracaoPorProjeto(db), [
      { projeto: 'api', mediana: 3, p90: 6.1 },
      { projeto: 'ops', mediana: 1, p90: 1 },
      { projeto: 'web', mediana: 4.5, p90: 6.5 },
    ]);
  });
});
