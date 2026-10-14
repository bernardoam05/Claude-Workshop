// P4 · Repetir uma operação que falha, esperando cada vez mais (exponential backoff)
// (ver docs/14, secção "Prática").
//
// retry(fn, { tentativas = 3, atrasoInicialMs = 100, deveRepetir = () => true } = {})
//   chama fn(); se resolver, devolve o resultado.
//   se rejeitar e ainda houver tentativas (e deveRepetir(erro) for true), espera e tenta outra vez:
//     antes da 2.ª tentativa espera atrasoInicialMs, antes da 3.ª o dobro, depois o dobro...
//   se esgotar as tentativas, ou deveRepetir(erro) for false, rejeita com o ÚLTIMO erro.
export async function retry(fn, opcoes = {}) {
  throw new Error('Por fazer: P4');
}
