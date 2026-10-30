// P4 · Relatórios: séries sem buracos, contagens condicionais, subtotais e percentis.

// porSemana(db, desde, ate) → [{ semana, criadas, concluidas }]
//   Uma linha por semana (segunda-feira 'AAAA-MM-DD', de date_trunc('week', ...)) entre as
//   semanas de `desde` e de `ate` (texto 'AAAA-MM-DD'), INCLUINDO as semanas sem nada (com 0).
//   criadas: tarefas com criada_em nessa semana; concluidas: com concluida_em nessa semana.
//   Dica: generate_series para as semanas, e count(*) FILTER (WHERE ...).
export async function porSemana(db, desde, ate) {
  throw new Error('Por fazer: P4');
}

// resumoPorProjeto(db) → [{ projeto, tarefas, abertas, pontos }]
//   Uma linha por projeto e, no fim, uma linha de total com projeto null (GROUP BY ROLLUP).
//   abertas: as que não estão concluídas. Ordenado por projeto, com o total no fim.
export async function resumoPorProjeto(db) {
  throw new Error('Por fazer: P4');
}

// duracaoPorProjeto(db) → [{ projeto, mediana, p90 }]
//   Para as tarefas concluídas, os dias entre criada_em e concluida_em: a mediana e o percentil 90
//   (percentile_cont), arredondados a 1 casa decimal (números). Só projetos com tarefas concluídas,
//   ordenados por projeto.
export async function duracaoPorProjeto(db) {
  throw new Error('Por fazer: P4');
}
