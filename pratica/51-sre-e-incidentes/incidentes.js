// P3 · Severidade e métricas de incidentes.

// severidade({ fracaoAfetada, perdaDeDados, haContorno }) → 'SEV1' | 'SEV2' | 'SEV3'
//   SEV1: houve perda de dados, ou metade ou mais dos utilizadores afetados
//   SEV2: 5% ou mais afetados e não há contorno (os utilizadores não conseguem fazer a tarefa)
//   SEV3: o resto
export function severidade({ fracaoAfetada, perdaDeDados = false, haContorno = false }) {
  throw new Error('Por fazer: P3');
}

// metricas(incidentes) → { mttdMin, mttrMin, total }
//   Cada incidente: { inicio, detetado, resolvido } (datas em texto ISO).
//   mttdMin: média, em minutos, do início até ser detetado (Mean Time To Detect)
//   mttrMin: média, em minutos, do início até ser resolvido (Mean Time To Resolve/Restore)
//   Arredondados a 1 casa decimal. Sem incidentes → { mttdMin: 0, mttrMin: 0, total: 0 }.
//   Um incidente com as datas fora de ordem é um erro de dados: lança um Error.
export function metricas(incidentes) {
  throw new Error('Por fazer: P3');
}
