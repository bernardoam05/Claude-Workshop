// P2 · Um disjuntor (circuit breaker).

export class ErroCircuitoAberto extends Error {}

// new Disjuntor({ limiarFalhas = 5, esperaMs = 10000, agora = Date.now })
//   estado: "fechado" (normal) · "aberto" (falha logo, sem chamar) · "meio-aberto" (deixa passar UMA tentativa)
//   executar(fn) → o resultado de await fn()
//     - fechado: chama fn. Cada falha conta; um sucesso volta a pôr a contagem a 0. Ao chegar a
//       limiarFalhas falhas SEGUIDAS, abre.
//     - aberto: rejeita logo com ErroCircuitoAberto, SEM chamar fn (é isso que protege o serviço que está
//       em baixo e quem chama, que não fica à espera). Passados esperaMs desde que abriu, a próxima
//       chamada passa a meio-aberto e é a tentativa de teste.
//     - meio-aberto: só UMA chamada de cada vez passa (as outras, ao mesmo tempo, recebem
//       ErroCircuitoAberto). Se ela tiver sucesso, fecha; se falhar, volta a abrir (e o tempo recomeça).
//   get estado → o estado atual (tendo em conta o tempo: se já passou o esperaMs, diz "meio-aberto")
//   aoMudar(fn) → fn(de, para) é chamada sempre que o estado muda (para registar e alertar)
export class Disjuntor {
  constructor({ limiarFalhas = 5, esperaMs = 10000, agora = Date.now } = {}) {
    throw new Error('Por fazer: P2');
  }
}
