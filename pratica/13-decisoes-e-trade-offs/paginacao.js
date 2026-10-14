// P1 · Duas formas de paginar a mesma lista (ver docs/13-decisoes-e-trade-offs.md, "Prática").
// A lista: todas as tarefas, das mais recentes para as mais antigas (id maior primeiro).
// Cada tarefa devolvida tem a forma { id, title }.
//
// listarPorOffset(db, pagina, tamanho)
//   pagina começa em 1. Devolve um array com no máximo `tamanho` tarefas.
//
// listarPorCursor(db, cursor, tamanho)
//   cursor = null para a primeira página. Devolve { tarefas, proximoCursor }:
//   proximoCursor é uma STRING opaca para pedir a página seguinte, ou null se não houver mais.
//   Um cursor inválido (que não foi gerado por esta função) lança um Error com "Cursor inválido".
export async function listarPorOffset(db, pagina, tamanho) {
  throw new Error('Por fazer: P1');
}

export async function listarPorCursor(db, cursor, tamanho) {
  throw new Error('Por fazer: P1');
}
