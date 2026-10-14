// Já feito: um Redis falso, em memória, com os poucos comandos de que os exercícios precisam e
// com a mesma forma de chamar do ioredis (o cliente usado em src/api). Tal como o Redis a sério:
//   - guarda só STRINGS (um objeto passado ao set vira "[object Object]");
//   - get de uma chave que não existe (ou já expirou) devolve null;
//   - set(chave, valor, 'EX', segundos) põe um TTL; ttl() devolve -2 se não existe, -1 se não tem TTL.
//
// Extras só para testes: `now` controla o relógio (para expirar chaves sem esperar), `calls`
// regista os comandos recebidos, e `failing = true` faz todos os comandos falharem (Redis em baixo).
export function createFakeRedis({ now = () => Date.now() } = {}) {
  const store = new Map(); // chave → { value, expiresAt }
  const calls = [];

  const alive = (key) => {
    const entry = store.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt <= now()) store.delete(key);
    return store.get(key) ?? null;
  };

  const redis = {
    calls,
    failing: false,

    async get(key) {
      record('get', key);
      return alive(key)?.value ?? null;
    },

    async set(key, value, mode, seconds) {
      record('set', key, value, mode, seconds);
      if (mode !== undefined && mode !== 'EX') throw new Error(`modo não suportado pelo fake: ${mode}`);
      store.set(key, { value: String(value), expiresAt: mode === 'EX' ? now() + seconds * 1000 : null });
      return 'OK';
    },

    async del(...keys) {
      record('del', ...keys);
      return keys.filter((k) => alive(k) && store.delete(k)).length;
    },

    async incr(key) {
      record('incr', key);
      const entry = alive(key);
      const value = Number(entry?.value ?? 0) + 1;
      store.set(key, { value: String(value), expiresAt: entry?.expiresAt ?? null });
      return value;
    },

    async expire(key, seconds) {
      record('expire', key, seconds);
      const entry = alive(key);
      if (!entry) return 0;
      entry.expiresAt = now() + seconds * 1000;
      return 1;
    },

    async ttl(key) {
      record('ttl', key);
      const entry = alive(key);
      if (!entry) return -2;
      if (entry.expiresAt === null) return -1;
      return Math.ceil((entry.expiresAt - now()) / 1000);
    },
  };

  function record(...call) {
    calls.push(call);
    if (redis.failing) throw new Error('ECONNREFUSED: o Redis está em baixo');
  }

  return redis;
}
