// P2 · Um pipeline de agregação ao estilo do MongoDB: cada etapa recebe a lista de documentos e
// devolve outra.
import { corresponde } from './consulta.js';

// O valor de uma expressão: '$dono.nome' é o valor do campo; qualquer outra coisa é ela própria.
function avaliar(doc, expr) {
  if (typeof expr !== 'string' || !expr.startsWith('$')) return expr;
  return expr.slice(1).split('.').reduce((v, p) => (v == null ? undefined : v[p]), doc);
}

// As etapas a suportar (uma função por etapa, numa tabela { $match: (docs, arg) => ..., ... }):
//   { $match: filtro }   → só os documentos que correspondem (usa o corresponde do P1)
//   { $unwind: '$campo' } → um documento por elemento do array (os sem array, ou vazio, desaparecem)
//   { $group: { _id: expr, nome: { $sum | $avg | $min | $max | $push: expr }, ... } }
//        grupos pela ordem em que aparecem; _id: null junta tudo num grupo. $sum soma os números
//        (com { $sum: 1 } conta); $avg é a média dos números (null se não houver); $min/$max
//        ignoram valores em falta (null se não houver nenhum); $push junta os valores num array.
//        Um acumulador desconhecido lança um Error.
//   { $sort: { campo: 1 | -1, ... } } → desempata pelos campos seguintes
//   { $limit: n }
//   { $project: { campo: 1, outro: '$a.b', _id: 0 } } → só esses campos (o _id fica, salvo _id: 0);
//        1 copia o campo (se existir); um texto '$...' calcula-o a partir de outro

// agregar(docs, pipeline) → os documentos depois de passarem por todas as etapas, por ordem.
//   Cada etapa é um objeto com uma só chave ({ $match: ... }). Uma etapa desconhecida lança um Error.
export function agregar(docs, pipeline) {
  throw new Error('Por fazer: P2');
}
