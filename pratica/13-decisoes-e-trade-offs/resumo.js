// P2 · O mesmo resultado com 1 + N queries, e com uma só (ver docs/13-decisoes-e-trade-offs.md, "Prática").
//
// As duas funções devolvem o MESMO array, um elemento por projeto (por ordem de id):
//   [{ projeto: 'Mestrado', tarefas: ['Ler artigo', 'Escrever capítulo'] }, ...]
// com as tarefas de cada projeto por ordem de id, e [] para um projeto sem tarefas.
//
// resumoN1(db)    → 1 query para os projetos + 1 query por projeto para as suas tarefas
// resumoJoin(db)  → UMA só query
export async function resumoN1(db) {
  throw new Error('Por fazer: P2');
}

export async function resumoJoin(db) {
  throw new Error('Por fazer: P2');
}
