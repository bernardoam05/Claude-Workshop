// P3 · Promises e async/await (ver docs/22-sintaxe-javascript.md, "async / await e Promises", e "Prática").

// Uma Promise que resolve (com undefined) ao fim de `ms` milissegundos.
export function esperar(ms) {
  throw new Error('Por fazer: P3');
}

// Corre as funções assíncronas UMA DE CADA VEZ, pela ordem, e devolve os resultados.
// (fns é um array de funções sem argumentos que devolvem Promises)
export async function emSerie(fns) {
  throw new Error('Por fazer: P3');
}

// Corre todas AO MESMO TEMPO e devolve os resultados pela ordem das funções.
export async function emParalelo(fns) {
  throw new Error('Por fazer: P3');
}

// Corre todas ao mesmo tempo; nenhuma falha "rebenta" as outras.
// Devolve { ok: [valores das que resolveram], falhas: [mensagens dos erros das que rejeitaram] }
export async function tudoOuQuaseTudo(fns) {
  throw new Error('Por fazer: P3');
}

// Resolve com o valor da promise se ela acabar em menos de `ms`; senão rejeita com
// new Error('Tempo esgotado'). Não deixa temporizadores pendurados depois de acabar.
export function comTimeout(promise, ms) {
  throw new Error('Por fazer: P3');
}
