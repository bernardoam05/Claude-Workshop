// P1 · debounce e throttle: dois clássicos de entrevista de frontend (ver docs/14, secção "Prática").
//
// debounce(fn, ms) devolve uma função que, chamada várias vezes seguidas, só executa fn UMA vez:
//   `ms` milissegundos depois da ÚLTIMA chamada, com os argumentos dessa última chamada.
//   (ex.: pesquisar só quando o utilizador para de escrever)
//
// throttle(fn, ms) devolve uma função que executa fn LOGO na primeira chamada e depois
//   ignora as chamadas seguintes até passarem `ms` milissegundos; a primeira chamada depois
//   disso volta a executar logo. (ex.: reagir ao scroll no máximo 10 vezes por segundo)
//
// Nos dois casos, fn é chamada com o mesmo `this` e os mesmos argumentos da chamada que a dispara.
export function debounce(fn, ms) {
  throw new Error('Por fazer: P1');
}

export function throttle(fn, ms) {
  throw new Error('Por fazer: P1');
}
