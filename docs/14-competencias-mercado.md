# 14 · Competências de mercado: o que o workshop cobre e o que não

Este módulo responde a uma pergunta honesta: **o workshop cobre o que as vagas de fullstack/backend pedem?**

Resposta curta: **cobre o núcleo que as vagas pedem, incluindo Keycloak, E2E, CI e OpenAPI.** Ficam de fora sobretudo ferramentas que dependem da stack de cada empresa (Java/.NET, ORM, cloud, Terraform, Kafka). O mapa completo de ferramentas da indústria está no [módulo 16](16-trabalhar-numa-empresa.md).

Legenda: ✅ implementado e testado · 🟡 parcial (implementado com limitações, ou só em conceito) · ❌ não coberto

---

## Mapa de competências

| Competência | Estado | Onde está / onde estudar |
|---|---|---|
| Docker e Docker Compose | ✅ | módulo 02, `src/*/Dockerfile`, `config/docker-compose.yml` |
| Imagens multi-stage, utilizador não-root | ✅ | módulo 02, `src/web/Dockerfile`, `src/worker/Dockerfile` |
| SQL e modelação de dados | ✅ | módulo 03, migrações 001–004 |
| Índices e planos de execução avançados | 🟡 | só `EXPLAIN` básico no módulo 03 |
| Migrações versionadas | 🟡 | `migrate.js` funciona, mas não tem lock entre instâncias (exercício C13) |
| ORM | 🟡 | JPA/Hibernate no serviço Spring (módulo 18); a API Node continua com SQL à mão, de propósito |
| REST e códigos HTTP | ✅ | módulos 01 e 04 |
| OpenAPI / Swagger | ✅ | `src/api/openapi.yaml`, Swagger UI em `localhost:8088` |
| Lint (ESLint) | ✅ | `src/api/eslint.config.js`, corre no CI. Prettier não configurado |
| GraphQL, gRPC | ❌ | só comparação no módulo 13 |
| WebSockets e SSE | 🟡 | só comparação com polling no módulo 08 (exercício D8) |
| Filas e mensagens (RabbitMQ) | ✅ | módulos 06 e 07, com reconexão e DLQ testadas |
| Kafka | ✅ | módulo 17: tópico com 3 partições, chave por utilizador, consumer group, DLT, Kafka UI |
| Cache (Redis, cache-aside, TTL) | ✅ | módulo 05, cache isolada por utilizador |
| React: componentes, estado, efeitos | ✅ | módulo 08 |
| React: routing, data fetching avançado (React Router, TanStack Query) | ❌ | o `App.jsx` faz isto à mão, o que é bom para aprender, mas não é o que se usa em equipas |
| TypeScript | 🟡 | o **worker** está em TypeScript (`src/worker`, `strict` ativo); a API e o frontend ainda são JavaScript (exercício D2) |
| Autenticação e autorização (JWT, hash de passwords, dono por recurso) | ✅ | `authService.js`, `middleware/auth.js`, migrações 003–004, testes em `authService.test.js` |
| Identity Provider (Keycloak, OIDC, PKCE, SSO) | ✅ | módulo 15, serviço `keycloak` no compose, `oidcVerifier.js`, `oidc.js`, testado no browser |
| Sessões avançadas (cookies httpOnly, refresh tokens, BFF) | ❌ | o token vai no `localStorage` (módulo 15 explica o risco e a alternativa) |
| Segurança web (OWASP, CORS, rate limiting, segredos) | 🟡 | CORS evitado por desenho (módulo 10), segredos por variável de ambiente, falta rate limiting e `helmet` (exercício D7) |
| Testes unitários | ✅ | módulo 11, 27 testes entre API e worker |
| Testes de integração com BD real | ✅ | `src/api/test/integration/`, corre contra Postgres (`npm run test:integration`) |
| Testes E2E (Playwright) | ✅ | `tests/e2e/`: login local, login Keycloak e logout num browser real; corre no CI |
| Testes de carga | ❌ | não coberto |
| Métricas, dashboards e alertas (Prometheus, Grafana) | ✅ | módulo 19: API, Spring e RabbitMQ instrumentados, dashboard e 5 alertas como código |
| Logs estruturados e traces (Loki, OpenTelemetry) | ❌ | exercícios D13 e D16 |
| Java + Spring Boot | ✅ | módulo 18: `src/activity` com JPA, Flyway, Spring Security (RBAC com Keycloak), Spring Kafka, Actuator, JUnit/Mockito/MockMvc |
| .NET | ✅ | módulo 21: `src/notifications`, Minimal APIs, DI nativa, EF Core, RabbitMQ.Client v7, JWT Bearer + Keycloak (RBAC), xUnit |
| CI/CD (GitHub Actions) | ✅ | módulo 20 + `.github/workflows/ci.yml`: testes, build, integração e teste de fumo, com `needs`, cache, artefactos e OIDC explicados |
| Git no dia a dia (branches, PRs, rebase, conflitos) | 🟡 | já fizeste fork (ver [Passo 0](00-indice.md#passo-0-faz-fork-deste-repositório)); falta só praticar branches e PRs a sério |
| Kubernetes | 🟡 | `config/k8s/api.yaml` (Deployment, Service, probes, segurança). Validado com o esquema oficial, **nunca aplicado a um cluster** |
| Cloud (AWS, Azure, GCP) | ❌ | não coberto; exercício D6 é conceptual |
| Infraestrutura como código (Terraform, Pulumi) | ❌ | não coberto |
| Arquitetura (camadas, DI, DDD) | ✅ | módulo 04; DDD só pelo nome |
| Linux, shell, redes | 🟡 | usados nos comandos; não há módulo dedicado |

---

## O que continua em falta (por ordem de importância)

1. **Git em equipa**: já estás no teu fork ([Passo 0](00-indice.md#passo-0-faz-fork-deste-repositório)). Falta praticar um branch por exercício com um PR, para treinar o fluxo real de equipa.
2. **Cloud e IaC**: o manifesto de Kubernetes nunca correu num cluster. Um deploy real exige uma conta e um registo de imagens.
3. **TypeScript na API e no frontend**: o worker já tem, os outros não.
4. **Tempo real e ORM**: SSE (D8) e a escolha de um ORM, com os trade-offs de cada um.

---

## Como fechar o que falta

Os exercícios do bloco D (em `12-exercicios.md`) cobrem o que ficou de fora: **D5** (Kubernetes num cluster local, se tiveres kind ou minikube), **D6** (deploy em cloud), **D8** (SSE). Os D1, D2 e D3 já estão implementados: o exercício é ler o código e fazer a experiência indicada.

Para Git, no teu fork (ver [Passo 0](00-indice.md#passo-0-faz-fork-deste-repositório)), cria um branch por exercício e abre um PR para ti próprio. Só com isto praticas o fluxo de equipa.

## Prática: escreve tu

Este módulo é sobre o mercado, e uma parte do mercado é a **entrevista técnica**. Os quatro exercícios seguintes são clássicos de *live coding* em entrevistas de JavaScript (frontend e backend). Nenhum é um "puzzle" de algoritmos: são coisas que se escrevem mesmo no trabalho, e cada um obriga a dominar uma parte da linguagem que o resto do workshop só usa de passagem: closures, `this`, classes com campos privados, `Map`, Promises em paralelo.

**Verificar:** `npm run verificar 14` (dentro de `pratica/`). Só um exercício: `npm run verificar 14 tempo`, `... 14 LruCache`, `... 14 mapLimit` ou `... 14 retry`.

Treina-os como numa entrevista: **lê o enunciado, explica em voz alta** como vais fazer, e só depois escreve. Numa entrevista a sério, a explicação conta tanto como o código.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · `debounce` e `throttle` (≈25 min)

**Ficheiro:** `pratica/14-competencias-mercado/tempo.js`

`debounce` executa uma função só quando as chamadas **param** (pesquisar quando o utilizador deixa de escrever). `throttle` executa **no máximo uma vez** a cada N ms (reagir ao scroll). Os testes usam um relógio falso (`t.mock.timers`), que faz o tempo andar à ordem do teste.

**Sintaxe que vais praticar:** funções que devolvem funções (closures), `setTimeout`/`clearTimeout`, parâmetros rest (`...args`), `fn.apply(this, args)`, e a diferença entre `function` e arrow function no que toca ao `this`.

<details>
<summary>Pista</summary>

A função devolvida tem de ser uma `function` normal, e não uma arrow function: só assim recebe o `this` de quem a chama (`obj.guardar()`). Dentro do `setTimeout`, usa uma arrow function, que **herda** esse `this` em vez de criar um novo.
</details>

<details>
<summary>Solução de referência</summary>

```js
export function debounce(fn, ms) {
  let timer = null; // a closure lembra-se do temporizador entre chamadas
  // function (e não arrow) para receber o `this` de quem chama, e passá-lo à fn com apply.
  return function (...args) {
    clearTimeout(timer); // cada chamada nova cancela a anterior e recomeça a contagem
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

export function throttle(fn, ms) {
  let ultimaExecucao = -Infinity;
  return function (...args) {
    const agora = Date.now();
    if (agora - ultimaExecucao >= ms) {
      ultimaExecucao = agora;
      fn.apply(this, args);
    }
  };
}
```
</details>

### P2 · Uma cache LRU (≈25 min)

**Ficheiro:** `pratica/14-competencias-mercado/LruCache.js`

Uma cache com capacidade fixa que, quando enche, deita fora o que foi usado **há mais tempo**. É a pergunta de entrevista mais clássica sobre estruturas de dados, e em JavaScript tem uma resposta elegante: um `Map` guarda as chaves pela **ordem de inserção**.

**Sintaxe que vais praticar:** `class`, campos privados (`#mapa`), getters (`get size()`), `Map` (`has`/`get`/`set`/`delete`/`keys()`), iteradores (`.keys().next().value`), devolver `this` para encadear chamadas.

<details>
<summary>Pista</summary>

"Usar" uma chave é tirá-la do `Map` e voltar a pô-la: assim passa para o fim. A primeira chave do `Map` é sempre a usada há mais tempo, e obtém-se com `this.#mapa.keys().next().value`.
</details>

<details>
<summary>Solução de referência</summary>

```js
export class LruCache {
  // Campos com # são privados de verdade: nem cache.#mapa, nem Object.keys(cache) os veem.
  #capacidade;
  #mapa = new Map(); // um Map lembra-se da ORDEM de inserção: o primeiro é o usado há mais tempo

  constructor(capacidade) {
    this.#capacidade = capacidade;
  }

  get size() {
    return this.#mapa.size;
  }

  has(chave) {
    return this.#mapa.has(chave);
  }

  get(chave) {
    if (!this.#mapa.has(chave)) return undefined; // has, e não `if (!valor)`: 0 e null são valores
    const valor = this.#mapa.get(chave);
    // "Usar" = passar para o fim da fila: apagar e voltar a inserir.
    this.#mapa.delete(chave);
    this.#mapa.set(chave, valor);
    return valor;
  }

  set(chave, valor) {
    this.#mapa.delete(chave);
    this.#mapa.set(chave, valor);
    if (this.#mapa.size > this.#capacidade) {
      // keys().next().value é a primeira chave inserida, ou seja, a usada há mais tempo.
      this.#mapa.delete(this.#mapa.keys().next().value);
    }
    return this;
  }
}
```
</details>

### P3 · Um pool de Promises com limite (≈30 min)

**Ficheiro:** `pratica/14-competencias-mercado/mapLimit.js`

Processar 1000 itens assíncronos, mas só N de cada vez. `Promise.all` lança todos ao mesmo tempo, o que rebenta a rede ou a BD. Fazer "lotes de N" é melhor, mas desperdiça tempo: o lote inteiro espera pelo mais lento. Um dos testes deteta exatamente essa solução. Pedimos um **pool**: assim que um acaba, começa o seguinte.

**Sintaxe que vais praticar:** `async` functions como "trabalhadores", `Promise.all`, `Array.from({ length: n }, fn)`, `while` com `await` dentro, `try`/`catch` com `throw` para propagar.

<details>
<summary>Pista</summary>

Cria `limite` funções "trabalhadoras" que partilham um contador `proximo`. Cada uma, num `while`, tira o próximo índice (`const i = proximo++`), processa-o e guarda o resultado em `resultados[i]` (pelo índice, não com `push`, para manter a ordem). Depois, `await Promise.all(trabalhadores)`. Não há corridas no `proximo++`: o JavaScript só tem uma thread.
</details>

<details>
<summary>Solução de referência</summary>

```js
export async function mapLimit(itens, limite, fn) {
  const resultados = new Array(itens.length);
  let proximo = 0;
  let falhou = false;

  // Cada "trabalhador" tira o próximo índice livre e processa-o, até não haver mais.
  // Como o JavaScript só tem uma thread, o `proximo++` nunca é feito por dois ao mesmo tempo.
  async function trabalhador() {
    while (proximo < itens.length && !falhou) {
      const i = proximo++;
      try {
        resultados[i] = await fn(itens[i], i);
      } catch (err) {
        falhou = true; // os outros trabalhadores acabam o que têm em mãos, mas não pegam em mais
        throw err;
      }
    }
  }

  // `limite` trabalhadores em paralelo (ou menos, se houver menos itens).
  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, trabalhador);
  await Promise.all(trabalhadores); // rejeita assim que um trabalhador rejeita
  return resultados;
}
```
</details>

### P4 · Retry com exponential backoff (≈20 min)

**Ficheiro:** `pratica/14-competencias-mercado/retry.js`

O `connectWithRetry` do projeto (`src/api/src/messaging/publisher.js`) espera sempre o mesmo tempo entre tentativas. Escreve uma versão genérica em que a espera **duplica** a cada falha, e que não repete erros que não valem a pena (uma password errada não fica certa à quinta tentativa).

**Sintaxe que vais praticar:** destructuring de opções com valores por omissão (`{ tentativas = 3, ... } = {}`), `for (;;)` com `return` e `throw` como saídas, `return await` dentro de `try`.

<details>
<summary>Pista</summary>

`return fn()` dentro de um `try` **não** apanha a rejeição: devolve a Promise antes de ela rejeitar, e o `catch` nunca corre. Tem de ser `return await fn()`. É um dos raros casos em que `return await` não é redundante.
</details>

<details>
<summary>Solução de referência</summary>

```js
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function retry(fn, { tentativas = 3, atrasoInicialMs = 100, deveRepetir = () => true } = {}) {
  let atraso = atrasoInicialMs;
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await fn(); // o `await` é obrigatório: sem ele, o catch nunca via a rejeição
    } catch (err) {
      if (tentativa >= tentativas || !deveRepetir(err)) throw err;
      await esperar(atraso);
      atraso *= 2;
    }
  }
}
```

Em produção junta-se *jitter* (um pouco de aleatoriedade em cada espera). Sem ele, mil clientes que falharam ao mesmo tempo tentam outra vez **ao mesmo tempo**, e voltam a deitar o servidor abaixo.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 14`.

**1.** Segundo o módulo, o que é que este workshop ainda NÃO cobre?

- a) Docker e Docker Compose
- b) Testes E2E e CI/CD
- c) Cloud real (AWS/Azure/GCP) e Infraestrutura como Código
- d) Autenticação com Keycloak

<details><summary>Resposta</summary>

**c) Cloud real (AWS/Azure/GCP) e Infraestrutura como Código** — Cloud real e IaC continuam marcados como ❌ mesmo depois de todas as iterações do workshop.

</details>

**2.** Porque é que o módulo recomenda refazer a API em Spring Boot (ou .NET) como exercício prioritário?

- a) Porque é tecnicamente mais fácil que Node
- b) É a maior parte das vagas em Portugal, e o exercício transfere os mesmos conceitos aprendidos para outra stack
- c) Porque o Node vai deixar de ser usado em breve
- d) É uma exigência do próprio CI

<details><summary>Resposta</summary>

**b) É a maior parte das vagas em Portugal, e o exercício transfere os mesmos conceitos aprendidos para outra stack** — O valor não é a linguagem em si, é perceberes que os conceitos (camadas, DI, migrações) se repetem.

</details>

**3.** Que símbolo usa o módulo para indicar que uma competência está coberta só PARCIALMENTE?

<details><summary>Resposta</summary>

**🟡** — ✅ coberto, 🟡 parcial, ❌ não coberto.

</details>

<!-- quiz:end -->
