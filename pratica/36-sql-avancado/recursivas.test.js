import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { baseDeDados } from './dados.js';
import { antepassados, pontosDaSubarvore, subarvore } from './recursivas.js';

let db;
before(async () => (db = await baseDeDados()));

describe('P2 · CTEs recursivas', () => {
  it('a subárvore, ordenada como uma árvore', async () => {
    assert.deepEqual(await subarvore(db, 1), [
      { id: 1, titulo: 'Lançar a v2', nivel: 0, caminho: 'Lançar a v2' },
      { id: 2, titulo: 'Desenhar o esquema', nivel: 1, caminho: 'Lançar a v2 > Desenhar o esquema' },
      { id: 3, titulo: 'Migrações', nivel: 2, caminho: 'Lançar a v2 > Desenhar o esquema > Migrações' },
      { id: 4, titulo: 'Índices', nivel: 2, caminho: 'Lançar a v2 > Desenhar o esquema > Índices' },
      { id: 5, titulo: 'Endpoints', nivel: 1, caminho: 'Lançar a v2 > Endpoints' },
      { id: 6, titulo: 'Testes', nivel: 2, caminho: 'Lançar a v2 > Endpoints > Testes' },
    ]);
  });
  it('uma folha e um id que não existe', async () => {
    assert.deepEqual((await subarvore(db, 9)).map((r) => r.id), [9]);
    assert.deepEqual(await subarvore(db, 99), []);
  });
  it('os antepassados, do topo para baixo', async () => {
    assert.deepEqual(await antepassados(db, 3), [1, 2]);
    assert.deepEqual(await antepassados(db, 6), [1, 5]);
    assert.deepEqual(await antepassados(db, 1), []);
  });
  it('somar uma subárvore', async () => {
    assert.equal(await pontosDaSubarvore(db, 1), 13 + 5 + 8 + 3 + 8 + 5);
    assert.equal(await pontosDaSubarvore(db, 7), 16);
    assert.equal(await pontosDaSubarvore(db, 99), 0);
  });
});
