// Mede o tempo de uma função, para os testes de complexidade.
// Os limites são generosos (uma solução certa demora uma pequena fração), mas uma solução O(n²)
// com os tamanhos usados demora segundos.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

export function rapido(fn, limiteMs, mensagem) {
  const inicio = performance.now();
  const resultado = fn();
  const ms = performance.now() - inicio;
  assert.ok(ms < limiteMs, `${mensagem}: demorou ${ms.toFixed(0)} ms (limite ${limiteMs} ms). A complexidade está certa?`);
  return resultado;
}
