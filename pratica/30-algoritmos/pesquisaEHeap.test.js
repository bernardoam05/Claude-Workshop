import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rapido } from './ajuda.js';
import { MinHeap, kMaiores, primeiraPosicao } from './pesquisaEHeap.js';

describe('P4 · primeiraPosicao', () => {
  it('a primeira ocorrência', () => {
    assert.equal(primeiraPosicao([1, 2, 2, 2, 5], 2), 1);
    assert.equal(primeiraPosicao([1, 2, 2, 2, 5], 5), 4);
    assert.equal(primeiraPosicao([1, 2, 2, 2, 5], 3), -1);
    assert.equal(primeiraPosicao([], 1), -1);
    assert.equal(primeiraPosicao([7, 7, 7], 7), 0);
  });

  it('O(log n): um milhão de pesquisas num array de um milhão', () => {
    const arr = Array.from({ length: 1_000_000 }, (_, i) => Math.floor(i / 3));
    rapido(() => {
      for (let i = 0; i < 1_000_000; i += 1) primeiraPosicao(arr, i % 333_333);
    }, 1500, 'primeiraPosicao');
  });
});

describe('P4 · MinHeap', () => {
  it('extrai sempre o menor', () => {
    const h = new MinHeap();
    for (const x of [5, 3, 8, 1, 9, 2, 2]) h.inserir(x);
    assert.equal(h.tamanho, 7);
    assert.equal(h.espreitar(), 1);
    const saida = [];
    while (h.tamanho) saida.push(h.extrair());
    assert.deepEqual(saida, [1, 2, 2, 3, 5, 8, 9]);
    assert.equal(h.extrair(), undefined);
  });

  it('aceita uma função de comparação', () => {
    const h = new MinHeap((a, b) => a.custo - b.custo);
    h.inserir({ no: 'x', custo: 5 });
    h.inserir({ no: 'y', custo: 1 });
    assert.equal(h.extrair().no, 'y');
  });

  it('O(log n) por operação: 200 000 inserções e extrações', () => {
    const h = new MinHeap();
    rapido(() => {
      for (let i = 200_000; i > 0; i--) h.inserir(i);
      for (let i = 0; i < 200_000; i++) h.extrair();
    }, 1000, 'MinHeap');
  });
});

describe('P4 · kMaiores', () => {
  it('os k maiores, por ordem decrescente', () => {
    assert.deepEqual(kMaiores([3, 1, 5, 12, 2, 11], 3), [12, 11, 5]);
    assert.deepEqual(kMaiores([1, 1, 1], 2), [1, 1]);
    assert.deepEqual(kMaiores([4], 1), [4]);
  });

  it('não ordena o array todo', async () => {
    const codigo = (await import('node:fs')).readFileSync(new URL('./pesquisaEHeap.js', import.meta.url), 'utf8');
    const corpo = codigo.slice(codigo.indexOf('export function kMaiores'));
    assert.ok(!/nums[^\n]*\.sort\(/.test(corpo), 'o exercício é com um heap de tamanho k');
    assert.deepEqual(kMaiores([2, 9], 1), [9]);
  });
});
