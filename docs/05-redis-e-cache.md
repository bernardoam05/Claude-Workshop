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
const cached = await cache.getJSON(TASKS_CACHE_KEY);
if (cached) return { tasks: cached, source: 'cache' };

const tasks = await repository.findAll();
await cache.setJSON(TASKS_CACHE_KEY, tasks, cacheTtlSeconds);
return { tasks, source: 'database' };
```

**Porque "apagar" e não "atualizar" a cache na escrita?** Atualizar exige recalcular o valor correto a partir de dados que podem ter mudado com outras escritas concorrentes. Apagar é mais simples e deixa a próxima leitura refazer o valor a partir da fonte de verdade. Perdes uma ida à BD; ganhas correção.

## 3. TTL: a rede de segurança

`setJSON(key, value, ttl)` usa `EX ttl`: a chave **expira sozinha** após N segundos.

Porque é que precisamos disto se já invalidamos na escrita? Porque **a invalidação pode falhar**:

- O `cache.del` lança exceção depois do `repository.create` ter corrido.
- Um processo morre entre a escrita na BD e o `del`.
- Outra API escreveu na BD sem passar por esta cache (ex.: alguém correu SQL à mão).

Com TTL, o pior caso é **dados desatualizados durante `CACHE_TTL_SECONDS`**, não para sempre. Escolher o TTL é um trade-off: TTL curto = dados frescos mas mais carga na BD; TTL longo = menos carga mas mais tempo de dados errados.

Neste projeto: `tasks:all` tem 60s e `stats` tem 5s. Porque é que as estatísticas têm TTL mais curto? (Resposta no fim.)

## 4. Chaves: um sítio só

As chaves estão em `taskService.js` como constantes (`TASKS_CACHE_KEY`, `STATS_CACHE_KEY`). Porquê? Se a chave for escrita à mão em dois sítios e um deles tiver um erro de digitação (`tasks:al`), a invalidação falha **em silêncio**: o `del` não apaga nada e não há erro. Constantes transformam esse erro num erro de importação, que é apanhado logo.

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
> GET tasks:all
> TTL tasks:all          # segundos até expirar (-2 = não existe, -1 = sem TTL)
> DEL tasks:all
```

Repara que `KEYS *` está **proibido** em produção: percorre todas as chaves e bloqueia o Redis (que é single-threaded para comandos). `SCAN` faz o mesmo em pedaços.

---

## Experiências

1. **Medir o efeito:** faz 1 `GET` (MISS) e depois cria uma tarefa. Confirma no `redis-cli` que `tasks:all` desapareceu. Faz `GET` outra vez: deve ser MISS, porque a invalidação funcionou.
2. **Ver a expiração:** `GET /api/tasks`, depois `TTL tasks:all` no redis-cli. Espera e vê o TTL a descer até `-2`.
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
