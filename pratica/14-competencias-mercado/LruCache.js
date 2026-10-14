// P2 · Uma cache LRU (Least Recently Used) com capacidade máxima (ver docs/14, secção "Prática").
//
// new LruCache(capacidade)
//   .get(chave)          → o valor, ou undefined. Conta como "usar" a chave.
//   .set(chave, valor)   → guarda (ou atualiza, o que também conta como usar). Se passar da
//                          capacidade, deita fora a chave usada há MAIS tempo. Devolve a própria cache
//                          (para poder encadear: cache.set('a', 1).set('b', 2)).
//   .has(chave)          → true/false. NÃO conta como usar.
//   .size                → quantas chaves tem (uma propriedade só de leitura, não um método).
// O estado interno não deve ser acessível de fora (cache.map, cache.dados... não existem).
export class LruCache {
  constructor(capacidade) {
    throw new Error('Por fazer: P2');
  }
}
