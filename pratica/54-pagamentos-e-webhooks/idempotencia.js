// P3 · Chaves de idempotência: repetir um pedido de pagamento não pode cobrar duas vezes.
import { createHash } from 'node:crypto';

export class ErroIdempotencia extends Error {}

// criarIdempotente(executar) → { processar(chave, pedido) }
//   executar: async (pedido) → resultado (ex.: cobrar o cartão)
//   processar(chave, pedido):
//   - primeira vez com esta chave: corre executar(pedido), guarda o resultado e devolve-o
//   - a mesma chave outra vez, com o MESMO pedido: devolve o resultado guardado, sem executar
//   - a mesma chave enquanto a primeira ainda está a correr: espera por ela e devolve o mesmo
//     resultado (nunca executa duas vezes em paralelo)
//   - a mesma chave com um pedido DIFERENTE: lança ErroIdempotencia (é um erro do cliente: reutilizou a chave)
//     ("o mesmo pedido" = o mesmo SHA-256 de JSON.stringify(pedido))
//   - se executar falhar: o erro propaga, e a chave fica livre para uma nova tentativa
export function criarIdempotente(executar) {
  throw new Error('Por fazer: P3');
}
