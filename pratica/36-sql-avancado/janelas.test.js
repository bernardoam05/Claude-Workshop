import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { baseDeDados } from './dados.js';
import { criadasAcumuladas, intervalosEntreConclusoes, topPorProjeto } from './janelas.js';

let db;
before(async () => (db = await baseDeDados()));

describe('P1 · funções de janela', () => {
  it('top N por projeto', async () => {
    assert.deepEqual(await topPorProjeto(db, 2), [
      { projeto: 'api', id: 1, pontos: 13, posicao: 1 },
      { projeto: 'api', id: 3, pontos: 8, posicao: 2 },
      { projeto: 'ops', id: 10, pontos: 2, posicao: 1 },
      { projeto: 'web', id: 8, pontos: 8, posicao: 1 },
      { projeto: 'web', id: 7, pontos: 5, posicao: 2 },
    ]);
  });
  it('empates desfazem-se pelo id', async () => {
    const r = await topPorProjeto(db, 4);
    assert.deepEqual(r.filter((x) => x.projeto === 'api').map((x) => x.id), [1, 3, 5, 2]);
  });
  it('total acumulado', async () => {
    assert.deepEqual(await criadasAcumuladas(db), [
      { dia: '2026-10-01', criadas: 2, acumulado: 2 },
      { dia: '2026-10-02', criadas: 2, acumulado: 4 },
      { dia: '2026-10-03', criadas: 2, acumulado: 6 },
      { dia: '2026-10-05', criadas: 2, acumulado: 8 },
      { dia: '2026-10-06', criadas: 2, acumulado: 10 },
    ]);
  });
  it('o valor anterior com lag', async () => {
    assert.deepEqual(await intervalosEntreConclusoes(db), [
      { utilizador: 'ana', id: 2, dias: null },
      { utilizador: 'ana', id: 7, dias: 2 },
      { utilizador: 'ana', id: 10, dias: 2 },
      { utilizador: 'eva', id: 6, dias: null },
      { utilizador: 'rui', id: 4, dias: null },
      { utilizador: 'rui', id: 3, dias: 2 },
      { utilizador: 'rui', id: 8, dias: 4 },
    ]);
  });
});
