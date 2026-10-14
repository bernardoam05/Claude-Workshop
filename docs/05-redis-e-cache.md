# 05 · Redis e cache

**Objetivo:** perceber o que é uma cache, o padrão cache-aside usado aqui, e os modos de falha (dados errados, invalidação em falta).

**Ficheiros para ler primeiro:** `src/api/src/cache/cache.js`, `src/api/src/services/taskService.js` (funções `listTasks`, `getStats`, `invalidate`).

---

## 1. O que é o Redis

Redis é um armazenamento **em memória** chave-valor. Muito rápido (microssegundos), mas:

- Os dados vivem na RAM. Se o contentor morrer sem persistência, perdes-os. Para cache isto é **aceitável**: a fonte de verdade é a BD.
- Guarda **strings** (e outras estruturas: listas, conjuntos, contadores, hashes). Aqui usamos strings com JSON dentro.

**Porque não uma cache em memória no próprio processo da API (um `Map`)?** Porque se tiveres três réplicas da API, cada uma teria a sua cache, com dados diferentes. Uma escrita numa réplica não invalidaria a cache das outras. O Redis é **partilhado** entre todas as réplicas.

## 2. Cache-aside: o padrão

```
leitura:  1) procura na cache
          2) se houver (HIT) → devolve
          3) se não (MISS) → vai à BD → guarda na cache com TTL → devolve

escrita:  1) escreve na BD
          2) apaga (invalida) a chave na cache
```

Lê `listTasks`:

```js
const cached = await cache.getJSON(tasksCacheKey(userId));
if (cached) return { tasks: cached, source: 'cache' };

const tasks = await repository.findAll(userId);
await cache.setJSON(tasksCacheKey(userId), tasks, cacheTtlSeconds);
return { tasks, source: 'database' };
```

Repara que a chave tem o `userId` lá dentro (`tasks:user:7`). Cada utilizador tem a sua entrada na cache: uma chave partilhada por todos mostraria as tarefas de uma pessoa a outra.

**Porque "apagar" e não "atualizar" a cache na escrita?** Atualizar exige recalcular o valor correto a partir de dados que podem ter mudado com outras escritas concorrentes. Apagar é mais simples e deixa a próxima leitura refazer o valor a partir da fonte de verdade. Perdes uma ida à BD; ganhas correção.

## 3. TTL: a rede de segurança

`setJSON(key, value, ttl)` usa `EX ttl`: a chave **expira sozinha** após N segundos.

Porque é que precisamos disto se já invalidamos na escrita? Porque **a invalidação pode falhar**:

- O `cache.del` lança exceção depois do `repository.create` ter corrido.
- Um processo morre entre a escrita na BD e o `del`.
- Outra API escreveu na BD sem passar por esta cache (ex.: alguém correu SQL à mão).

Com TTL, o pior caso é **dados desatualizados durante `CACHE_TTL_SECONDS`**, não para sempre. Escolher o TTL é um trade-off: TTL curto = dados frescos mas mais carga na BD; TTL longo = menos carga mas mais tempo de dados errados.

Neste projeto: `tasks:user:<id>` tem 60s e `stats:user:<id>` tem 5s. Porque é que as estatísticas têm TTL mais curto? (Resposta no fim.)

## 4. Chaves: um sítio só

As chaves são construídas num só sítio, em `taskService.js`, por duas funções (`tasksCacheKey(userId)` e `statsCacheKey(userId)`). Porquê? Se a chave for escrita à mão em dois sítios e um deles tiver um erro de digitação (`tasks:usr:7`), a invalidação falha **em silêncio**: o `del` não apaga nada e não há erro. Com uma função partilhada, um erro de digitação no nome dela é um erro de importação, que é apanhado logo.

## 5. O cabeçalho `X-Cache`

A rota `GET /api/tasks` devolve `X-Cache: HIT` ou `MISS`. É uma ferramenta de **diagnóstico**, não de lógica. Em produção, costuma-se expor métricas de *hit ratio* em vez de cabeçalhos por pedido.

```bash
curl -sI localhost:8080/api/tasks | grep -i x-cache   # MISS
curl -sI localhost:8080/api/tasks | grep -i x-cache   # HIT
```

## 6. Inspecionar o Redis

```bash
docker compose -f config/docker-compose.yml exec redis redis-cli
> KEYS *                 # cuidado em produção: bloqueia o servidor (usa SCAN)
> GET tasks:user:1       # o 1 é o id do teu utilizador (vê-o com KEYS tasks:*)
> TTL tasks:user:1       # segundos até expirar (-2 = não existe, -1 = sem TTL)
> DEL tasks:user:1
```

Repara que `KEYS *` está **proibido** em produção: percorre todas as chaves e bloqueia o Redis (que é single-threaded para comandos). `SCAN` faz o mesmo em pedaços.

---

## Prática: escreve tu

Os testes usam um Redis **falso**, em memória (`pratica/05-redis-e-cache/fakeRedis.js`), com os mesmos comandos e a mesma forma de chamar do `ioredis`. Comporta-se como o verdadeiro nas coisas que importam: só guarda strings, `get` de uma chave inexistente dá `null`, as chaves expiram. Tem dois extras para testes: um relógio controlável (para expirar chaves sem esperar) e um modo `failing` (para simular o Redis em baixo).

**Verificar:** `npm run verificar 05` (dentro de `pratica/`). Só um exercício: `npm run verificar 05 cacheAside`, `... 05 rateLimiter` ou `... 05 singleFlight`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Cache-aside, à prova de falhas (≈25 min)

**Ficheiro:** `pratica/05-redis-e-cache/cacheAside.js`

Escreve `cached(redis, key, ttlSeconds, load)`: a lógica do `listTasks` (secção 2), mas genérica, para qualquer chave e qualquer `load`. Os testes exigem três coisas que o código do projeto não precisa de tratar, e que uma função genérica precisa:

- **Valores "falsy" são HIT.** Se converteres o JSON primeiro e depois fizeres `if (valor)`, como o projeto faz, um `0` ou um `false` guardados em cache parecem "não há nada". O projeto safa-se porque guarda sempre arrays.
- **O Redis em baixo não parte a aplicação.** Se o `get` ou o `set` falharem, a resposta vem da BD. A cache é uma otimização; não pode ser um ponto de falha.
- **Um erro da BD não é engolido.** Esse tem de chegar a quem chamou, e nada fica em cache.

**Sintaxe que vais praticar:** `async`/`await`, `try`/`catch` sem variável, `JSON.stringify`/`JSON.parse`, `!== null`, devolver objetos `{ value, source }`.

<details>
<summary>Pista</summary>

Precisas de **dois** `try`/`catch` separados, um à volta do `get` e outro à volta do `set`, e **nenhum** à volta do `load()`. Se puseres tudo dentro de um só `try`, o erro da BD é apanhado junto com o do Redis.
</details>

<details>
<summary>Solução de referência</summary>

```js
export async function cached(redis, key, ttlSeconds, load) {
  let raw = null;
  try {
    raw = await redis.get(key);
  } catch {
    // Redis em baixo: seguimos para a BD. (Num serviço real, registávamos um aviso e uma métrica.)
  }

  // null quer dizer "não existe". Comparar com null, e não com `if (raw)`, mantém o 0 e o false como HIT.
  if (raw !== null) return { value: JSON.parse(raw), source: 'cache' };

  const value = await load(); // um erro aqui é da BD: deixamo-lo subir
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Não conseguir guardar em cache não é razão para falhar o pedido: já temos o valor.
  }
  return { value, source: 'database' };
}
```
</details>

### P2 · Rate limiting com `INCR` e `EXPIRE` (≈35 min)

**Ficheiro:** `pratica/05-redis-e-cache/rateLimiter.js`

O Redis não serve só para cache. Um dos usos mais comuns é **limitar pedidos**: "no máximo N pedidos por IP a cada X segundos". Escreve `createRateLimiter` com uma **janela fixa**: um contador por IP (`INCR`), que expira no fim da janela (`EXPIRE`). Depois, o middleware Express que responde `429 Too Many Requests` com o cabeçalho `Retry-After`.

Dois detalhes que os testes verificam e que separam uma versão que "parece funcionar" de uma correta:

- O TTL só se põe no **primeiro** pedido da janela. Se cada pedido fizer `EXPIRE` outra vez, a janela nunca acaba para quem não para de pedir.
- Se o processo morrer **entre** o `INCR` e o `EXPIRE`, a chave fica sem TTL e esse IP fica bloqueado **para sempre**. A tua função tem de detetar e reparar isso.

**Sintaxe que vais praticar:** template literals para a chave, `await` em sequência, `Math.max`, middleware `async (req, res, next)`, `res.set(...)`, `res.status(429)`.

<details>
<summary>Pista</summary>

Uma forma de resolver os dois detalhes de uma vez: depois do `INCR`, pergunta o `TTL`. O `TTL` dá `-1` quando a chave existe mas não tem expiração, que é exatamente o que acontece no primeiro pedido (o `INCR` acabou de a criar) **e** no caso do processo que morreu. Nos dois casos, a resposta é a mesma: `EXPIRE`.
</details>

<details>
<summary>Solução de referência</summary>

```js
export function createRateLimiter(redis, { limit, windowSeconds }) {
  return {
    async hit(ip) {
      const key = `ratelimit:${ip}`;
      // INCR é atómico: dois pedidos ao mesmo tempo nunca leem o mesmo número.
      const count = await redis.incr(key);

      // -1 = a chave existe mas não tem TTL. Acontece no 1.º pedido da janela (o INCR acabou de a
      // criar) e também se um processo morreu entre o INCR e o EXPIRE. Nos dois casos, pomos o TTL.
      let ttl = await redis.ttl(key);
      if (ttl === -1) {
        await redis.expire(key, windowSeconds);
        ttl = windowSeconds;
      }

      const allowed = count <= limit;
      return { allowed, remaining: Math.max(0, limit - count), retryAfter: allowed ? 0 : ttl };
    },
  };
}

export function rateLimitMiddleware(limiter) {
  return async (req, res, next) => {
    const { allowed, remaining, retryAfter } = await limiter.hit(req.ip);
    res.set('X-RateLimit-Remaining', String(remaining));
    if (!allowed) {
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Demasiados pedidos. Tenta outra vez mais tarde.' });
    }
    next();
  };
}
```

Isto ainda tem um buraco pequeno: entre o `INCR` e o `TTL` há duas idas ao Redis, não atómicas. Em produção, resolve-se com um script Lua (`EVAL`), que o Redis corre de uma só vez, ou com uma biblioteca como `rate-limiter-flexible`.
</details>

### P3 · Proteger a BD de uma manada (≈30 min)

**Ficheiro:** `pratica/05-redis-e-cache/singleFlight.js`

Imagina que a chave `stats` expira e chegam 50 pedidos no mesmo instante. Todos veem `MISS` e todos vão à BD. Isto chama-se **cache stampede**, e já deitou abaixo sistemas grandes. A solução clássica é *single flight*: o primeiro pedido vai à BD, os outros 49 **esperam pela mesma Promise**.

Escreve `createCachedLoader`, reutilizando o teu `cached` do P1. O teste dispara 50 pedidos com `Promise.all` e conta as idas à BD: tem de ser **uma**.

**Sintaxe que vais praticar:** `new Map()` (`has`/`get`/`set`/`delete`), guardar uma **Promise** (e não o seu resultado) numa variável, `.finally(...)`, closures (a função devolvida lembra-se do `Map`).

<details>
<summary>Pista</summary>

O truque é guardar no `Map` a Promise **antes** de ela terminar. Quem chega a seguir encontra-a e faz `return` dela: não chama `load()`. Quando ela termina, com sucesso ou com erro, tira-se do `Map` (é isso que o `.finally` faz), para o próximo `MISS` tentar outra vez.
</details>

<details>
<summary>Solução de referência</summary>

```js
import { cached } from './cacheAside.js';

export function createCachedLoader(redis, { ttlSeconds }) {
  // chave → Promise do pedido que já está a decorrer. Vive em memória, neste processo.
  const inFlight = new Map();

  return function get(key, load) {
    // Já há alguém a tratar desta chave? Esperamos pela MESMA Promise em vez de ir à BD outra vez.
    if (inFlight.has(key)) return inFlight.get(key);

    // .finally corre com sucesso ou com erro: a chave sai do mapa e o próximo MISS tenta de novo.
    const promise = cached(redis, key, ttlSeconds, load).finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  };
}
```

Repara no limite desta solução: o `Map` vive **num processo**. Com 3 réplicas da API, ainda podem ir 3 pedidos à BD em vez de 1. Para uma proteção entre processos, usa-se um *lock* no próprio Redis (`SET chave valor NX EX 5`).
</details>

## Experiências

1. **Medir o efeito:** faz 1 `GET` (MISS) e depois cria uma tarefa. Confirma no `redis-cli` que `tasks:user:<o teu id>` desapareceu. Faz `GET` outra vez: deve ser MISS, porque a invalidação funcionou.
2. **Ver a expiração:** `GET /api/tasks`, depois `TTL tasks:user:<o teu id>` no redis-cli. Espera e vê o TTL a descer até `-2`.
3. **Provar a necessidade de invalidar:** no `taskService.js`, comenta a linha `invalidate()` dentro de `createTask`. Cria uma tarefa e lista. A tarefa aparece? Quanto tempo demora a aparecer? Desfaz a alteração depois.

## Perguntas de pensamento crítico

1. Dois pedidos `GET /api/tasks` chegam **ao mesmo tempo** quando a cache está vazia. Quantas idas à BD são feitas? Porque é que isto é um problema quando há muitos utilizadores? (Nome do fenómeno: *cache stampede* ou *thundering herd*.) Como o mitigarias?
2. Há uma condição de corrida assim: o pedido A lê a BD (valor antigo), o pedido B escreve na BD e apaga a cache, o pedido A volta e **guarda o valor antigo na cache**. O que acontece aos próximos 60 segundos? Como reduzirias a janela?
3. Porque é que o `getStats` tem TTL de 5s e não 60s, mesmo sabendo que as estatísticas ficam atrás do worker de qualquer forma?

<details>
<summary>Resposta</summary>

1. Ambos veem MISS e ambos vão à BD. Com muitos utilizadores, a BD recebe uma rajada de consultas idênticas. Mitigações: *request coalescing* (o primeiro pedido fica a "voar" e os outros esperam pela mesma promessa), TTL com *jitter* (desfasar as expirações), ou *refresh-ahead* (recarregar antes de expirar).
2. Os próximos 60 segundos servem dados antigos. A janela é o tempo entre a leitura e a escrita da cache. Reduz-se com TTL mais curto, ou com um **versionamento** (guardar um número de versão e rejeitar escritas com versão antiga). Não se elimina totalmente sem locks.
3. Porque as estatísticas são baratas de recalcular mas são **pedidas com frequência** pelo frontend (de 3 em 3 segundos). Um TTL de 5s é um compromisso: no pior caso, o número fica 5 segundos atrás de algo que já ficou atrás do worker. Não há razão para servir dados de há um minuto. A regra geral: o TTL segue **quanto tempo os dados podem estar errados sem prejudicar ninguém**, não quanto custa recalcular.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 05`.

**1.** No padrão cache-aside, o que se faz à cache depois de uma escrita na BD?

- a) Atualiza-se a cache com o novo valor calculado
- b) Invalida-se (apaga-se), deixando a próxima leitura repor a partir da BD
- c) Nada, a cache gere-se sozinha
- d) Duplica-se a chave com um sufixo novo

<details><summary>Resposta</summary>

**b) Invalida-se (apaga-se), deixando a próxima leitura repor a partir da BD** — Apagar é mais simples e evita condições de corrida ao recalcular o valor.

</details>

**2.** Para que serve o TTL se já se invalida a cache explicitamente em cada escrita?

- a) Não serve para nada, é redundante
- b) É uma rede de segurança: limita quanto tempo dados errados podem durar, se a invalidação falhar
- c) Torna as leituras mais rápidas
- d) É uma exigência do protocolo Redis

<details><summary>Resposta</summary>

**b) É uma rede de segurança: limita quanto tempo dados errados podem durar, se a invalidação falhar** — Se o cache.del falhar ou nunca for chamado, o TTL garante que o erro não dura para sempre.

</details>

**3.** Como se chama o fenómeno em que muitos pedidos simultâneos, todos com cache vazia, atacam a BD ao mesmo tempo?

<details><summary>Resposta</summary>

**cache stampede** — Mitiga-se com request coalescing, TTL com jitter, ou refresh-ahead.

</details>

**4.** Porque é perigoso usar o comando KEYS * em produção no Redis?

- a) Não é perigoso, é só lento
- b) Bloqueia o Redis enquanto percorre todas as chaves (usa SCAN em vez disso)
- c) Apaga todas as chaves existentes
- d) Exige sempre autenticação

<details><summary>Resposta</summary>

**b) Bloqueia o Redis enquanto percorre todas as chaves (usa SCAN em vez disso)** — O Redis é essencialmente single-threaded para comandos; KEYS * bloqueia tudo durante a busca.

</details>

**5.** Porque é que as estatísticas (stats) têm TTL mais curto (5s) do que a lista de tarefas (60s)?

- a) Foi uma escolha arbitrária, sem critério
- b) São pedidas com muito mais frequência pelo frontend (polling a cada 3s), por isso um TTL curto mantém-nas frescas a baixo custo
- c) Porque ocupam mais espaço em memória
- d) Porque dependem diretamente do Redis

<details><summary>Resposta</summary>

**b) São pedidas com muito mais frequência pelo frontend (polling a cada 3s), por isso um TTL curto mantém-nas frescas a baixo custo** — O TTL segue quanto tempo os dados podem estar desatualizados sem prejudicar ninguém.

</details>

<!-- quiz:end -->
