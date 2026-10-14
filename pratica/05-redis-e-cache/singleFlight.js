// P3 · Proteger a BD de uma "manada" (cache stampede).
//
// Quando uma chave popular expira, 100 pedidos ao mesmo tempo veem MISS e vão TODOS à BD.
// createCachedLoader(redis, { ttlSeconds }) devolve uma função get(key, load) igual ao cached()
// do P1, com uma diferença: pedidos SIMULTÂNEOS para a mesma chave que dão MISS partilham UMA
// só chamada a load(). Os outros esperam pelo resultado dessa (source: 'database' para todos).
// Quando load() acaba (com sucesso OU com erro), o próximo MISS volta a chamar load().
export function createCachedLoader(redis, { ttlSeconds }) {
  throw new Error('Por fazer: P3');
}
