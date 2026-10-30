// P1 · Contas "nas costas de um envelope": a primeira coisa a fazer numa entrevista de system design.
// Ver docs/37-system-design.md, secção "Prática".

// pedidosPorSegundo({ utilizadoresDiarios, pedidosPorUtilizador, fatorPico = 1 })
//   → { media, pico }: a média por segundo ao longo de um dia (86 400 s) e o pico (média × fator),
//     ambos ARREDONDADOS PARA CIMA (dimensiona-se para o pior caso).
export function pedidosPorSegundo({ utilizadoresDiarios, pedidosPorUtilizador, fatorPico = 1 }) {
  throw new Error('Por fazer: P1');
}

// armazenamento({ itensPorDia, bytesPorItem, anos, replicas = 1 }) → bytes ao fim desse tempo
//   (um ano = 365 dias; cada réplica guarda uma cópia completa)
export function armazenamento({ itensPorDia, bytesPorItem, anos, replicas = 1 }) {
  throw new Error('Por fazer: P1');
}

// formatarBytes(n) → texto legível, com potências de 1000 e UMA casa decimal (sem ",0"):
//   512 → "512 B", 1500 → "1.5 KB", 2_000_000 → "2 MB", 3.25e12 → "3.3 TB", 7e15 → "7 PB"
//   (unidades: B, KB, MB, GB, TB, PB; usa ponto decimal)
export function formatarBytes(n) {
  throw new Error('Por fazer: P1');
}
