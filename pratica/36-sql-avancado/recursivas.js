// P2 · CTEs recursivas: árvores numa tabela (tarefas e subtarefas, com pai_id).

// subarvore(db, id) → [{ id, titulo, nivel, caminho }]
//   A tarefa e todos os seus descendentes (filhos, netos...). nivel: 0 para a própria, 1 para os
//   filhos... caminho: os títulos desde a tarefa pedida, separados por ' > '.
//   Ordenado como uma árvore (cada nó seguido dos seus descendentes; irmãos por id).
//   Dica: guarda também o caminho de ids num array, e ordena por ele.
export async function subarvore(db, id) {
  throw new Error('Por fazer: P2');
}

// antepassados(db, id) → [ids] do topo da árvore até ao pai (sem a própria tarefa)
export async function antepassados(db, id) {
  throw new Error('Por fazer: P2');
}

// pontosDaSubarvore(db, id) → a soma dos pontos da tarefa e de todos os descendentes (0 se não existir)
export async function pontosDaSubarvore(db, id) {
  throw new Error('Por fazer: P2');
}
