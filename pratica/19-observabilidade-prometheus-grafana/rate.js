// P2 · O que o rate() e o increase() do PromQL fazem, à mão (ver docs/19, secção 5 e "Prática").
// Versão simplificada: sem a extrapolação até aos limites da janela que o Prometheus faz.
//
// amostras: [{ t, valor }] de UM contador, por ordem de tempo (t em segundos).
//
// increase(amostras) → quanto o contador subiu entre a primeira e a última amostra.
//   Um contador só sobe. Se o valor DESCER, o processo reiniciou e o contador voltou a 0:
//   nesse caso, a subida desse intervalo é o próprio valor novo (contou desde 0), e não negativa.
//   Com menos de 2 amostras → 0.
//
// rate(amostras) → increase(amostras) / (t da última − t da primeira), em "por segundo".
//   Com menos de 2 amostras → 0.
export function increase(amostras) {
  throw new Error('Por fazer: P2');
}

export function rate(amostras) {
  throw new Error('Por fazer: P2');
}
