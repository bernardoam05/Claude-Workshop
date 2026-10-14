// P3 · Como o histogram_quantile() calcula um p95 a partir dos buckets (ver docs/19, "Prática").
//
// histogramQuantile(q, buckets)
//   q: entre 0 e 1 (0.95 = p95).
//   buckets: [{ le, contagem }] CUMULATIVOS e por ordem de le, com o último le = Infinity
//            (é a forma do _bucket do Prometheus: contagem = quantas observações ≤ le).
//   1. total = contagem do último bucket; se for 0, devolve NaN.
//   2. posicao = q × total.
//   3. encontra o primeiro bucket com contagem ≥ posicao.
//   4. se esse bucket for o +Inf, devolve o le do bucket anterior (o maior limite finito).
//   5. senão, interpola linearmente dentro do bucket:
//        inicio = le do bucket anterior (0 se for o primeiro); fim = le deste bucket
//        antes = contagem do bucket anterior (0 se for o primeiro)
//        resultado = inicio + (fim − inicio) × (posicao − antes) / (contagem − antes)
export function histogramQuantile(q, buckets) {
  throw new Error('Por fazer: P3');
}
