// P3 · Fugas de memória: o que fica referenciado nunca é libertado.

// criarBarramento() → { subscrever(evento, fn) → cancelar, emitir(evento, dados), subscritores(evento), get eventos }
//   subscrever devolve uma função cancelar() que retira ESSE subscritor (chamá-la duas vezes não faz mal).
//   Quando um evento fica sem subscritores, a sua entrada é apagada (senão, com eventos dinâmicos
//   como 'tarefa:123', o Map cresce para sempre).
//   subscritores(evento) → quantos tem; eventos → quantos eventos têm subscritores.
//   emitir chama os subscritores pela ordem em que subscreveram (um subscritor que cancele durante
//   a emissão não impede os outros de serem chamados).
export function criarBarramento() {
  throw new Error('Por fazer: P3');
}

// memoizar(fn, { max }) → uma função que guarda os resultados de fn por argumento (um só
//   argumento, comparado com ===), com NO MÁXIMO `max` resultados: quando enche, sai o usado há
//   mais tempo (LRU). Uma cache sem limite é a fuga de memória mais comum num servidor.
//   A função devolvida tem um getter `tamanho`.
export function memoizar(fn, { max }) {
  throw new Error('Por fazer: P3');
}
