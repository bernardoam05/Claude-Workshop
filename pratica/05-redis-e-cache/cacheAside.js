// P1 · O padrão cache-aside, numa função reutilizável.
//
// cached(redis, key, ttlSeconds, load) devolve { value, source }:
//   - procura `key` no Redis; se existir → { value, source: 'cache' }
//   - se não existir → chama load() (a "ida à BD"), guarda o resultado com TTL e devolve
//     { value, source: 'database' }
//   - os valores guardam-se como JSON (o Redis só guarda strings)
//   - o Redis em baixo NUNCA parte a aplicação: se o get ou o set falharem, segue sem cache
//
// Regras completas em docs/05-redis-e-cache.md, secção "Prática".
export async function cached(redis, key, ttlSeconds, load) {
  throw new Error('Por fazer: P1');
}
