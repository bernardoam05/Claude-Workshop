// P3 · Um DataLoader escrito à mão: junta os pedidos de vários resolvers numa só ida à base de dados.
//
// criarCarregador(emLote) → { load(chave) → Promise<valor> }
//   emLote(chaves) recebe um ARRAY de chaves e devolve (uma Promise de) um array de valores, pela
//   mesma ordem. O carregador:
//   - junta todas as chaves pedidas no MESMO "tique" (antes de o código síncrono atual acabar) e
//     chama emLote UMA vez com elas (agenda a chamada com queueMicrotask ou process.nextTick)
//   - não repete chaves dentro de um lote
//   - guarda os resultados: pedir outra vez a mesma chave (mesmo noutro tique) não volta a chamar emLote
//   - se emLote falhar, todas as promessas desse lote falham com o mesmo erro
// Cria-se um carregador NOVO por pedido HTTP (a cache não pode passar de um utilizador para outro).
export function criarCarregador(emLote) {
  throw new Error('Por fazer: P3');
}
