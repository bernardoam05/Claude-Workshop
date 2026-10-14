// P4 · O que o "for: 5m" de uma regra de alerta quer dizer (ver docs/19, secção 8 e "Prática").
//
// avaliarAlerta(serie, { condicao, durante })
//   serie: [{ t, valor }] por ordem de tempo (t em segundos) — o resultado da expressão do alerta.
//   condicao: função valor → boolean (ex.: v => v > 0.05).
//   durante: segundos que a condição tem de se manter verdadeira (o "for").
//   Devolve um array com o estado do alerta em cada amostra:
//     'inactive' → a condição é falsa
//     'pending'  → a condição é verdadeira, mas há MENOS de `durante` segundos seguidos
//     'firing'   → a condição é verdadeira há `durante` segundos seguidos ou mais
//   Quando a condição fica falsa, a contagem recomeça do zero.
export function avaliarAlerta(serie, { condicao, durante }) {
  throw new Error('Por fazer: P4');
}
