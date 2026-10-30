// P1 · Os filtros do MongoDB, escritos à mão (o que o `find` faz a cada documento).

// valores(doc, caminho) → lista dos valores encontrados no caminho com pontos ('dono.nome', 'tags')
//   Quando o caminho passa por um array de objetos, segue para dentro de TODOS os elementos
//   ('comentarios.autor' num doc com 3 comentários → os 3 autores). Quando o valor final é um
//   array, a lista inclui o próprio array E os seus elementos (é assim que { tags: 'urgente' }
//   apanha um documento com tags: ['urgente', 'casa']). Campo em falta → [].
export function valores(doc, caminho) {
  throw new Error('Por fazer: P1');
}

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const comparavel = (a, b) => typeof a === typeof b && (typeof a === 'number' || typeof a === 'string');

// Dica: uma tabela { $eq: (vs, x) => ..., $gt: ..., ... } com uma função por operador, em que vs
// é a lista de valores(doc, caminho), poupa muitos if.

// corresponde(doc, filtro) → true/false
//   filtro: { caminho: valor } (igualdade), { caminho: { $gt: 3, $lt: 10 } } (todos os operadores
//   têm de se cumprir), e { $and: [filtros] } / { $or: [filtros] }. Todas as chaves do filtro têm
//   de se cumprir. Operadores: $eq $ne $gt $gte $lt $lte $in $nin $exists.
//   As comparações ($gt...) só valem entre valores do mesmo tipo (números com números, textos com
//   textos). Um operador desconhecido lança um Error.
export function corresponde(doc, filtro) {
  throw new Error('Por fazer: P1');
}
