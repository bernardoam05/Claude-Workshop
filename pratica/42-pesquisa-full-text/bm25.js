// P3 · Ordenar por relevância com o BM25 (o algoritmo por omissão do Lucene, do Elasticsearch e do OpenSearch).

// bm25(documentos, termosConsulta, { k1 = 1.2, b = 0.75 }) → [{ id, pontuacao }]
//   documentos: [{ id, termos: [...] }] (já tokenizados); termosConsulta: [...] (repetidos contam uma vez)
//   Para cada documento, a pontuação é a soma, por cada termo t da consulta que aparece nele, de:
//
//        idf(t) × tf × (k1 + 1) / (tf + k1 × (1 − b + b × dl / dlMedio))
//
//     tf: quantas vezes t aparece no documento        dl: número de termos do documento
//     dlMedio: média de dl em todos os documentos     N: número de documentos
//     n: em quantos documentos t aparece              idf(t) = ln(1 + (N − n + 0.5) / (n + 0.5))
//
//   Só entram os documentos com pontuação > 0, da maior para a menor (empate: id crescente).
export function bm25(documentos, termosConsulta, { k1 = 1.2, b = 0.75 } = {}) {
  throw new Error('Por fazer: P3');
}
