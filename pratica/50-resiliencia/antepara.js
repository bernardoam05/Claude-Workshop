// P3 · Antepara (bulkhead) e descarte de carga (load shedding).

export class ErroSobrecarga extends Error {}

// criarAntepara({ maxConcorrentes, maxFila }) → { executar(fn), get ativos, get emFila }
//   Limita quantas chamadas a um recurso correm ao mesmo tempo (como as anteparas de um navio, que
//   impedem uma fuga de afundar o navio inteiro: um serviço lento só ocupa a SUA parte dos recursos).
//   executar(fn) → o resultado de fn()
//     - se houver menos de maxConcorrentes a correr: corre já
//     - senão, se a fila tiver menos de maxFila: espera na fila (por ordem de chegada) até haver vaga
//     - senão: rejeita LOGO com um ErroSobrecarga (falhar depressa é melhor do que pendurar o pedido)
//     - quando uma chamada termina (com sucesso ou erro), a primeira da fila começa
export function criarAntepara({ maxConcorrentes, maxFila }) {
  throw new Error('Por fazer: P3');
}
