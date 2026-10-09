// Wrapper fino sobre o Redis, com a API que a aplicação realmente precisa.
// Guardamos JSON como string: o Redis não conhece objetos JS, só strings/bytes.
export function createCache(redis) {
  return {
    async getJSON(key) {
      const raw = await redis.get(key);
      return raw === null ? null : JSON.parse(raw);
    },

    // EX = expiração em segundos (TTL). Mesmo que a invalidação falhe, os dados caducam sozinhos.
    async setJSON(key, value, ttlSeconds) {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    },

    async del(...keys) {
      if (keys.length > 0) await redis.del(...keys);
    },
  };
}
