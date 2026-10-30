// P1 · Funções de janela: cálculos sobre "vizinhos" de cada linha, sem a agrupar.

// topPorProjeto(db, n) → [{ projeto, id, pontos, posicao }]
//   As n tarefas com mais pontos de cada projeto (empate: id menor primeiro), com a posição
//   (1, 2, ...) dentro do projeto. Ordenado por projeto e posição.
export async function topPorProjeto(db, n) {
  throw new Error('Por fazer: P1');
}

// criadasAcumuladas(db) → [{ dia, criadas, acumulado }]
//   Por cada dia em que houve tarefas criadas: quantas nesse dia e o total acumulado até esse dia.
//   dia em texto 'AAAA-MM-DD'; números inteiros. Ordenado por dia.
export async function criadasAcumuladas(db) {
  throw new Error('Por fazer: P1');
}

// intervalosEntreConclusoes(db) → [{ utilizador, id, dias }]
//   Para cada tarefa concluída: quantos dias passaram desde a conclusão ANTERIOR do mesmo
//   utilizador (null na primeira). Ordenado por utilizador e data de conclusão (empate: id).
export async function intervalosEntreConclusoes(db) {
  throw new Error('Por fazer: P1');
}
