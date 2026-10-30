import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { caminhoMaisCurto, contarIlhas, dijkstra, ordemTopologica } from './grafos.js';

describe('P5 · caminhoMaisCurto (BFS)', () => {
  it('encontra o caminho mínimo à volta das paredes', () => {
    assert.equal(caminhoMaisCurto([
      'S.#.....',
      '.##.###.',
      '....#..E',
    ]), 13);
    assert.equal(caminhoMaisCurto(['SE']), 1);
  });

  it('-1 quando não há caminho', () => {
    assert.equal(caminhoMaisCurto(['S#E']), -1);
  });

  it('numa grelha grande e aberta, é rápido (cada célula só é visitada uma vez)', () => {
    const linha = '.'.repeat(400);
    const g = Array.from({ length: 400 }, () => linha);
    g[0] = 'S' + linha.slice(1);
    g[399] = linha.slice(1) + 'E';
    assert.equal(caminhoMaisCurto(g), 798);
  });
});

describe('P5 · contarIlhas', () => {
  it('conta as ilhas', () => {
    assert.equal(contarIlhas([
      '11000',
      '11000',
      '00100',
      '00011',
    ]), 3);
    assert.equal(contarIlhas(['0']), 0);
    assert.equal(contarIlhas(['101', '010', '101']), 5, 'diagonais não ligam');
  });
});

describe('P5 · ordemTopologica', () => {
  it('respeita as dependências, preferindo a ordem da lista', () => {
    assert.deepEqual(
      ordemTopologica(['deploy', 'build', 'test', 'lint'], [['build', 'test'], ['lint', 'test'], ['test', 'deploy']]),
      ['build', 'lint', 'test', 'deploy'],
    );
    assert.deepEqual(ordemTopologica(['a', 'b'], []), ['a', 'b']);
  });

  it('deteta ciclos', () => {
    assert.throws(() => ordemTopologica(['a', 'b', 'c'], [['a', 'b'], ['b', 'c'], ['c', 'a']]), /ciclo/);
  });
});

describe('P5 · dijkstra', () => {
  it('os menores custos a partir da origem', () => {
    const arestas = [['A', 'B', 4], ['A', 'C', 1], ['C', 'B', 2], ['B', 'D', 1], ['C', 'D', 5], ['E', 'A', 1]];
    assert.deepEqual(dijkstra(arestas, 'A'), { A: 0, C: 1, B: 3, D: 4 });
  });

  it('só os alcançáveis', () => {
    assert.deepEqual(dijkstra([['A', 'B', 1]], 'B'), { B: 0 });
  });
});
