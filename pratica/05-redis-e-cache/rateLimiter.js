// P2 · Limitar pedidos por IP com uma janela fixa (INCR + EXPIRE).
//
// createRateLimiter(redis, { limit, windowSeconds }) devolve { hit(ip) }, e
// hit(ip) devolve { allowed, remaining, retryAfter }:
//   allowed     → true se este pedido ainda cabe no limite da janela atual
//   remaining   → quantos pedidos ainda cabem (nunca negativo)
//   retryAfter  → segundos até a janela recomeçar (0 se allowed)
// A chave no Redis é "ratelimit:<ip>".
//
// rateLimitMiddleware(limiter) devolve um middleware Express que:
//   - põe em TODAS as respostas o cabeçalho X-RateLimit-Remaining
//   - quando passa do limite, responde 429 {"error": "..."} com o cabeçalho Retry-After
//   - usa req.ip como identificador
export function createRateLimiter(redis, { limit, windowSeconds }) {
  throw new Error('Por fazer: P2');
}

export function rateLimitMiddleware(limiter) {
  throw new Error('Por fazer: P2');
}
