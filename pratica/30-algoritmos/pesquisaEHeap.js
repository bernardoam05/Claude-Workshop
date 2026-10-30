// P4 · Pesquisa binária e um heap.

// primeiraPosicao([1, 2, 2, 2, 5], 2) → 1: o índice da PRIMEIRA ocorrência num array ordenado; -1 se
// não existir. O(log n): não podes percorrer o array.
export function primeiraPosicao(ordenado, x) {
  throw new Error('Por fazer: P4');
}

// MinHeap: uma árvore binária guardada num array, em que cada pai é <= que os filhos.
//   (pai do índice i: Math.floor((i - 1) / 2); filhos: 2i + 1 e 2i + 2)
//   new MinHeap(comparar = (a, b) => a - b)
//   inserir(x): O(log n) · extrair(): tira e devolve o menor, O(log n); undefined se vazio
//   espreitar(): o menor, sem tirar · tamanho: um getter
export class MinHeap {
  constructor(comparar = (a, b) => a - b) {
    throw new Error('Por fazer: P4');
  }
}

// kMaiores([3, 1, 5, 12, 2, 11], 3) → [12, 11, 5] (por ordem decrescente).
// Usa um MinHeap de tamanho k: O(n log k), sem ordenar o array todo.
export function kMaiores(nums, k) {
  throw new Error('Por fazer: P4');
}
