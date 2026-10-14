// P2 · Camada de serviço: as regras de negócio das notas. Não conhece HTTP nem SQL.
//
// createNoteService({ repository, clock }) devolve { list, create, update, remove }.
//   repository → ver memoryNoteRepository.js (o contrato)
//   clock      → função sem argumentos que devolve a hora atual como string ISO.
//                Recebê-la de fora permite aos testes controlar o tempo.
//
// Regras completas em docs/04-api-em-camadas.md, secção "Prática".
export function createNoteService({ repository, clock }) {
  throw new Error('Por fazer: P2');
}
