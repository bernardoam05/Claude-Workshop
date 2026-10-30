// P4 · Testes deterministas: aleatoriedade com semente e tempo controlado (o remédio para os
// testes "flaky", que às vezes passam e às vezes não).

// mulberry32(semente) → uma função () → número em [0, 1), sempre a mesma sequência para a mesma
//   semente (um gerador pseudoaleatório pequeno e rápido; NÃO serve para criptografia).
//   O algoritmo, com a = semente >>> 0, a cada chamada:
//     a = (a + 0x6d2b79f5) >>> 0
//     t = Math.imul(a ^ (a >>> 15), a | 1)
//     t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
//     devolve ((t ^ (t >>> 14)) >>> 0) / 4294967296
export function mulberry32(semente) {
  throw new Error('Por fazer: P4');
}

// baralhar(lista, aleatorio = Math.random) → uma lista NOVA baralhada (Fisher-Yates):
//   de i = n − 1 até 1: j = Math.floor(aleatorio() × (i + 1)); troca as posições i e j.
//   Recebe o gerador como parâmetro para os testes poderem passar um com semente.
export function baralhar(lista, aleatorio = Math.random) {
  throw new Error('Por fazer: P4');
}

// adiar(fn, ms) → uma função "debounced": cada chamada cancela a anterior e agenda fn (com os
//   argumentos da ÚLTIMA chamada) para daqui a ms. Só corre quando as chamadas param durante ms
//   (ex.: pesquisar enquanto se escreve, só quando se pára de escrever).
//   A função devolvida tem também .cancelar(), que cancela o que estiver agendado.
export function adiar(fn, ms) {
  throw new Error('Por fazer: P4');
}
