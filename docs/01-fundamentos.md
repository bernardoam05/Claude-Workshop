# 01 · Fundamentos

**Objetivo:** perceber o que acontece quando clicas num botão, do browser até à BD e de volta.

**Ficheiros para ler primeiro:** `src/api/src/app.js`, `src/api/src/routes/tasks.js`, `src/web/src/api.js`.

> Se a sintaxe de JavaScript ainda não for confortável (arrow functions, `async`/`await`, destructuring...), o [módulo 22](22-sintaxe-javascript.md) é uma referência rápida com linhas reais deste projeto. Consulta-o sempre que uma linha não fizer sentido.

---

## Walkthrough linha a linha

Isto é diferente do resto do módulo: aqui não se explica o CONCEITO (isso vem a seguir), explica-se o que **cada linha, por ordem, destes três ficheiros concretos** faz. Abre o ficheiro ao lado deste texto e segue as duas colunas juntas. Depois de fazer isto para os três, as secções 1 a 7 (a teoria) vão fazer muito mais sentido — porque já viste o código que elas explicam.

### `src/api/src/app.js`

```js
import express from 'express';
import { createRequireAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { createAuthRouter } from './routes/auth.js';
import { createTasksRouter } from './routes/tasks.js';
```
As primeiras 5 linhas não fazem nada ainda — só trazem código de outros ficheiros para este. `express` é uma biblioteca instalada (`npm install express`); os outros 4 `import` trazem funções que **nós** escrevemos noutros ficheiros deste projeto (repara no `./`, que significa "um ficheiro aqui ao lado", ao contrário de `express`, que vem de `node_modules`).

```js
export function createApp({ service, authService, healthCheck, oidcPublicConfig = null, metrics = null }) {
```
Aqui começa a única coisa que este ficheiro faz: declarar uma função chamada `createApp`. `export` quer dizer que outros ficheiros a podem importar (é o `index.js` quem a vai chamar, module 04). Os `{ }` no parâmetro são **destructuring** (módulo 22): em vez de receber um argumento qualquer e teres de escrever `args.service`, `args.authService`, etc., já chegam separados, com estes nomes. `= null` em dois deles é um valor por omissão: se quem chamar `createApp` não der `metrics`, a variável `metrics` vale `null` em vez de rebentar.

```js
  const app = express();
  const requireAuth = createRequireAuth(authService.verifyToken);
```
`express()` cria uma aplicação Express vazia — ainda sem nenhuma rota. `createRequireAuth(...)` (que vem do `import` da linha 2) recebe a função que sabe validar um token (`authService.verifyToken`) e devolve um **middleware** novo, pronto a usar-se em qualquer rota que precise de autenticação. Repara: `createApp` não sabe COMO se valida um token — só pede essa capacidade a quem o chamou (`authService`). É o padrão de injeção de dependências do módulo 04.

```js
  if (metrics) {
    app.use(metrics.httpMiddleware);
    app.get('/metrics', async (req, res) => {
      res.set('Content-Type', metrics.registry.contentType);
      res.send(await metrics.registry.metrics());
    });
  }
```
Se alguém passou `metrics` (módulo 19), liga aqui o middleware que mede CADA pedido, e cria uma rota `/metrics` que devolve os números recolhidos. Se `metrics` for `null` (o valor por omissão lá de cima), este bloco inteiro não corre — a app funciona sem métricas. `app.get('/metrics', async (req, res) => { ... })` é a forma de dizer "quando chegar um `GET /metrics`, corre esta função"; `req` é o pedido, `res` é a resposta que vais construir e enviar.

```js
  app.use(express.json({ limit: '10kb' }));
```
`app.use(...)` regista um middleware que corre em **todos** os pedidos, sem exceção de caminho. `express.json(...)` é um middleware que vem com a própria biblioteca: lê o corpo do pedido (se vier como JSON) e transforma-o num objeto JavaScript normal, disponível depois em `req.body`. `{ limit: '10kb' }` recusa corpos maiores do que isso — uma proteção simples contra pedidos gigantes.

```js
  app.get('/api/health', async (req, res) => {
    try {
      await healthCheck();
      res.json({ status: 'ok' });
    } catch (err) {
      res.status(503).json({ status: 'degraded', reason: err.message });
    }
  });
```
Uma rota só para esta função: `GET /api/health`. `healthCheck` foi recebido como parâmetro (lá na linha 9) — este ficheiro não sabe o que ela verifica (módulo 04 mostra que, no `index.js`, ela verifica a BD e o Redis). Se `healthCheck()` correr sem lançar erro, responde `{ status: 'ok' }`. Se lançar (o `await` deixa o erro "subir" até ao `catch`), responde com o código HTTP `503` e a razão.

```js
  app.use('/api', createAuthRouter(authService, oidcPublicConfig));
  app.use('/api', createTasksRouter(service, requireAuth));
```
Estas duas linhas ligam **conjuntos** de rotas (criados noutros ficheiros — `routes/auth.js` e `routes/tasks.js`) ao prefixo `/api`. `createTasksRouter(service, requireAuth)` é lido a seguir, no segundo ficheiro deste walkthrough.

```js
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
```
Os dois últimos middlewares ficam **depois** de todas as rotas, de propósito: se um pedido chegou até aqui, é porque nenhuma rota lá acima respondeu a ele (`notFound`, módulo 04), ou porque uma rota lançou um erro (`errorHandler` só corre quando algo é lançado com `throw`). `return app` devolve a aplicação construída — ainda **sem** estar a ouvir nenhuma porta; quem faz `app.listen(...)` é o `index.js`.

### `src/api/src/routes/tasks.js`

```js
import { Router } from 'express';
import { HttpError } from '../middleware/errorHandler.js';
import { createTaskSchema, idParamSchema, updateTaskSchema } from '../validation/taskSchemas.js';
```
`Router` é uma peça do Express para agrupar rotas sem precisar da app inteira. `HttpError` e os 3 esquemas são código nosso, de outros ficheiros (repara no `../`: "sobe uma pasta, depois entra").

```js
export function createTasksRouter(service, requireAuth) {
  const router = Router();
  router.use(requireAuth);
```
Esta função recebe o `service` (a lógica de negócio, módulo 04) e o `requireAuth` que `app.js` já tinha construído. `Router()` cria um "mini-Express" só com rotas de tarefas. `router.use(requireAuth)` aplica o middleware de autenticação a **todas** as rotas deste router — é por isto que todas as rotas a seguir já têm `req.user` disponível, sem o repetirem.

```js
  router.get('/tasks', async (req, res) => {
    const { tasks, source } = await service.listTasks(req.user.userId);
    res.set('X-Cache', source === 'cache' ? 'HIT' : 'MISS');
    res.json(tasks);
  });
```
`req.user.userId` só existe porque `requireAuth` correu antes e o pôs lá. `service.listTasks(...)` é chamado — este ficheiro não sabe SQL nem Redis, só pede o resultado ao serviço, e este devolve um objeto `{ tasks, source }` que logo se desempacota (destructuring, outra vez). `res.set(...)` acrescenta um cabeçalho à resposta (visível com `curl -i`); `res.json(tasks)` envia a lista como JSON.

```js
  router.post('/tasks', async (req, res) => {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);

    const task = await service.createTask(req.user.userId, parsed.data.title);
    res.status(201).json(task);
  });
```
`createTaskSchema.safeParse(req.body)` (zod, módulo 04) tenta validar o corpo do pedido. `safeParse` nunca lança erro — devolve um objeto com `success: true/false`. Se for `false`, `throw new HttpError(400, ...)` lança um erro que vai ser apanhado pelo `errorHandler` do `app.js` (repara: nenhum `try/catch` aqui — o Express 5 trata erros lançados dentro de funções `async` automaticamente, módulo 01). Se passar a validação, `parsed.data.title` é o título já validado e limpo (sem espaços a mais, por exemplo).

```js
  router.patch('/tasks/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'O campo "done" tem de ser booleano');

    const task = await service.updateTask(req.user.userId, id, parsed.data.done);
    if (!task) throw new HttpError(404, 'Tarefa não encontrada');
    res.json(task);
  });
```
`:id` no caminho da rota é um parâmetro de URL — `req.params.id` apanha o que vier aí (sempre como string). `parseId(...)` (função escrita no fim deste ficheiro) converte e valida. Se `service.updateTask(...)` devolver `null` — porque o id não existe, ou pertence a outro utilizador —, a rota lança `404`. O serviço nunca diz "não existe" e "não é teu" de formas diferentes, de propósito (não queres que um utilizador descubra que o id de outra pessoa existe).

```js
  router.delete('/tasks/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const removed = await service.deleteTask(req.user.userId, id);
    if (!removed) throw new HttpError(404, 'Tarefa não encontrada');
    res.status(204).end();
  });
```
Mesmo padrão. `res.status(204).end()` envia uma resposta de sucesso sem corpo nenhum (`204 No Content` — módulo 01 explica porquê este código e não `200`).

```js
  router.get('/stats', async (req, res) => {
    res.json(await service.getStats(req.user.userId));
  });

  return router;
}
```
A rota mais curta do ficheiro: pede as estatísticas ao serviço e devolve-as, sem transformar nada. `return router` devolve este conjunto de rotas, que o `app.js` liga com `app.use('/api', createTasksRouter(...))`.

```js
function parseId(raw) {
  const parsed = idParamSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, 'ID inválido');
  return parsed.data;
}
```
Esta função **não** tem `export` — só é usada aqui dentro, pelas rotas `PATCH` e `DELETE`, para não repetirem a mesma validação duas vezes.

### `src/web/src/api.js`

```js
const BASE = '/api';
const TOKEN_KEY = 'workshop-token';
const PROVIDER_KEY = 'workshop-provider';
const ID_TOKEN_KEY = 'workshop-id-token';
```
Quatro constantes de texto, usadas como chaves para guardar coisas no `localStorage` do browser (memória que sobrevive a recarregar a página). Estarem aqui, nomeadas, em vez de escritas à mão em cada sítio, evita um erro de digitação silencioso mais à frente.

```js
export const session = {
  getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  ...
```
`session` é um objeto com métodos (não uma classe, módulo 22) para gerir o que está guardado no browser. `getToken()` lê o token guardado. O `try/catch` existe porque o `localStorage` pode não estar disponível (modo privado do browser, por exemplo) — sem o `try`, isso rebentava a aplicação inteira só por tentar ler uma preferência.

```js
  setToken(token, provider = 'local', idToken = null) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(PROVIDER_KEY, provider);
      if (idToken) localStorage.setItem(ID_TOKEN_KEY, idToken);
    } catch {
      /* sem armazenamento: a sessão dura só enquanto a página estiver aberta */
    }
  },
```
Guarda o token, de ONDE veio (`local` ou `keycloak` — módulo 15 explica porquê isto importa para o logout), e, se existir, o `idToken` do Keycloak. `provider = 'local'` é outro valor por omissão: quem chamar `setToken(token)` sem mais nada assume que é login local.

```js
  clear() {
    try {
      [TOKEN_KEY, PROVIDER_KEY, ID_TOKEN_KEY].forEach((k) => localStorage.removeItem(k));
    } catch {
      /* nada a limpar */
    }
  },
};
```
`[TOKEN_KEY, PROVIDER_KEY, ID_TOKEN_KEY]` é um array com as 3 chaves. `.forEach(fn)` corre `fn` para cada elemento do array — aqui, remove cada uma. É equivalente a escrever as 3 linhas de `removeItem` à mão, mas sem repetir código.

```js
async function request(path, options = {}) {
  const token = session.getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
```
Esta função **não** tem `export` — é privada deste ficheiro, chamada por todas as funções de `api` mais abaixo. `fetch(...)` é a função embutida do browser para fazer pedidos HTTP. `` `${BASE}${path}` `` junta `/api` com o caminho pedido (ex.: `/tasks`), usando template literals (módulo 22). `...options` (spread) copia tudo o que veio em `options` (como `method` ou `body`) para este novo objeto. `...(token ? { Authorization: ... } : {})`: se houver token, acrescenta o cabeçalho `Authorization`; se não houver, `{}` não acrescenta nada — é a forma compacta de um `if` dentro de um objeto.

```js
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(body.error ?? `Erro HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }

  return res.status === 204 ? null : res.json();
}
```
`res.ok` é `true` para códigos 200-299, `false` para o resto. Se a resposta não for "ok", tenta ler o corpo como JSON (se falhar — por exemplo, se vier HTML em vez de JSON — usa `{}` em vez de rebentar); constrói um erro com a mensagem que a API mandou (ou o código HTTP, se não houver mensagem); guarda o código em `error.status` (usado no `App.jsx` para detetar um 401 e terminar a sessão); e lança-o. Se a resposta for `204` (sem corpo, como o `DELETE`), devolve `null`; senão, descodifica o corpo como JSON.

```js
export const api = {
  authConfig: () => request('/auth/config'),
  register: (email, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  listTasks: () => request('/tasks'),
  createTask: (title) => request('/tasks', { method: 'POST', body: JSON.stringify({ title }) }),
  setDone: (id, done) => request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ done }) }),
  removeTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  getStats: () => request('/stats'),
};
```
A única coisa que os componentes React (módulo 08) realmente importam. Cada função é uma arrow function de uma linha que só chama `request(...)` com o caminho e as opções certas. `JSON.stringify({ email, password })` transforma o objeto num texto JSON — o `fetch` precisa de texto, não de objetos. Nenhuma destas funções sabe o que é um token, um cabeçalho, ou um código de erro: isso já ficou todo resolvido dentro de `request`.

---

## 1. Cliente e servidor

Uma aplicação web é um **cliente** que pede e um **servidor** que responde.

- O **cliente** (o browser, com o código React) pede coisas: "dá-me as tarefas".
- O **servidor** (a API Express) decide e responde: "aqui estão, em JSON".

Quem executa o código **não** é quem o escreveu. O browser executa o JavaScript que o servidor (Nginx) lhe entrega. O servidor da API executa o Node.js no teu computador (ou no contentor).

## 2. HTTP: a linguagem da conversa

Um pedido HTTP tem:

```
PATCH /api/tasks/3 HTTP/1.1          ← método + caminho
Host: localhost:8080                 ← cabeçalhos (metadados)
Content-Type: application/json

{"done": true}                       ← corpo (payload)
```

A resposta tem um **código de estado**, cabeçalhos e corpo:

```
HTTP/1.1 200 OK
Content-Type: application/json
X-Cache: MISS

{"id":3,"title":"Estudar Docker","done":true,...}
```

Códigos que vais ver neste projeto:

| Código | Significado | Onde acontece |
|---|---|---|
| 200 | OK | `GET /api/tasks`, `PATCH` |
| 201 | Criado | `POST /api/tasks` |
| 204 | Sucesso sem corpo | `DELETE` |
| 400 | Pedido inválido (culpa do cliente) | validação com zod |
| 404 | Não existe | id desconhecido, rota desconhecida |
| 500 | Erro do servidor (culpa nossa) | bugs, BD em baixo |
| 503 | Serviço indisponível | `/api/health` quando uma dependência falha |

**Pergunta:** porque é que `POST` devolve `201` e não `200`? E porque é que a rota de apagar devolve `204`?

<details>
<summary>Resposta</summary>

`201` indica que um **recurso novo foi criado** (e idealmente o cabeçalho `Location` aponta para ele). `204` indica sucesso **sem corpo**, porque não há nada para devolver depois de apagar. Usar os códigos certos permite que o cliente e as ferramentas (proxies, monitorização) percebam o que aconteceu sem ler o corpo.
</details>

## 3. REST: convenções sobre HTTP

REST é um **estilo** de desenhar APIs à volta de **recursos** (substantivos) e **métodos** (verbos HTTP):

| Ação | Método | Caminho |
|---|---|---|
| listar tarefas | `GET` | `/api/tasks` |
| criar | `POST` | `/api/tasks` |
| alterar uma | `PATCH` | `/api/tasks/:id` |
| apagar uma | `DELETE` | `/api/tasks/:id` |

Diferença entre `PUT` e `PATCH`: `PUT` substitui o recurso inteiro; `PATCH` altera só os campos enviados. Por isso usamos `PATCH` com `{ "done": true }`.

**Idempotência de métodos HTTP** (não confundir com a idempotência do worker, módulo 07): `GET`, `PUT` e `DELETE` são idempotentes por definição (repetir não muda o resultado final). `POST` não é. Esta distinção vai importar quando falarmos de retries.

## 4. JSON e a fronteira

JSON é o formato de troca. Quando a API recebe `req.body`, **não sabe o que lá está**. Tudo o que vem do exterior é suspeito. Por isso validamos com zod (`src/api/src/validation/taskSchemas.js`) antes de tocar em qualquer lógica.

## 5. Processos, portas e variáveis de ambiente

- Um **processo** é um programa a correr. `node src/index.js` cria um processo.
- Uma **porta** é um número que identifica um serviço numa máquina. A API escuta na `3000`; o Nginx na `80` (exposta como `8080` no host).
- Uma **variável de ambiente** é configuração que vem de fora do código: `DATABASE_URL`, `REDIS_URL`. Lê-las em `src/api/src/config.js` permite a **mesma imagem** correr em ambientes diferentes.

Porque é que a password não está no código? Porque o código vai para o Git e as passwords não. Repara que no `docker-compose.yml` a password aparece, e isso é um **compromisso aceitável só para desenvolvimento local**. Em produção vem de um cofre de segredos.

## 6. Node.js e o event loop

Node executa JavaScript numa **única thread**. Para não bloquear, todas as operações de I/O (BD, rede, disco) são **assíncronas**: pedem algo e o event loop continua a tratar outros pedidos enquanto espera.

```js
// Isto NÃO bloqueia o servidor: enquanto a BD responde, outros pedidos são atendidos.
const { rows } = await pool.query('SELECT ...');
```

Consequência prática: **nunca** faças trabalho CPU-intensivo (ex.: um loop gigante) dentro de um pedido HTTP. Bloqueia **todos** os utilizadores. É um dos motivos para existir um **worker** separado (módulo 07).

## 7. Express: o pipeline de middlewares

Um pedido atravessa uma **cadeia** de funções. Cada uma recebe `(req, res, next)`:

```
pedido → express.json() → /api/health? → rotas /api/* → notFound → errorHandler
```

Lê `src/api/src/app.js`. A ordem **importa**:

- `express.json()` tem de estar **antes** das rotas, senão `req.body` está vazio.
- `notFound` e `errorHandler` estão **no fim**. Um erro salta por cima dos middlewares normais até encontrar um com **4 parâmetros** `(err, req, res, next)`.

Express 5 trata erros lançados em funções `async` automaticamente. Repara que as rotas em `routes/tasks.js` lançam `HttpError` sem `try/catch`. Em Express 4 isto **não** funcionava, e é a razão pela qual vais ver código antigo com `try/catch` em todo o lado.

---

## Experiências

1. Faz um pedido à mão e lê a resposta completa:
   ```bash
   curl -i http://localhost:8080/api/tasks
   ```
2. Pede uma rota que não existe e repara no corpo do erro: `curl -i http://localhost:8080/api/nada`.
3. Envia JSON inválido: `curl -i -X POST localhost:8080/api/tasks -H 'Content-Type: application/json' -d '{isto'`. Quem devolve esta resposta? Procura a resposta no código: é o `body-parser` (dentro do `express.json()`) a lançar um erro com `status 400`, que o `errorHandler` transforma em JSON.

## Perguntas de pensamento crítico

1. Se a API demorar 2 segundos a responder à BD, o que acontece aos outros utilizadores? Porquê?
2. Porque é que `errorHandler` esconde a mensagem de erro quando `status >= 500`?
3. Um cliente envia `PATCH /api/tasks/1` duas vezes com `{"done": true}`. O estado final muda? E o número de eventos publicados? (Responde antes de ver o módulo 04.)

<details>
<summary>Resposta</summary>

1. Nada, porque o Node não bloqueia durante I/O: o `await` liberta o event loop. Só ficam lentos se a BD estiver lenta ou se houver trabalho CPU pesado no meio do pedido.
2. Mensagens de erro internas (SQL, caminhos de ficheiros, stack traces) são informação útil para um atacante. Registamo-las no **servidor** (`console.error`) e devolvemos ao cliente uma mensagem genérica.
3. O estado final não muda (é idempotente). O número de eventos **também não** deve mudar: `updateTask` só publica quando há transição `false → true`. Repara que a verificação está no serviço, não na rota, porque é uma regra de negócio.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 01`.

**1.** Qual destes códigos HTTP significa 'recurso criado com sucesso' (ex.: POST /api/tasks)?

- a) 200 OK
- b) 201 Created
- c) 204 No Content
- d) 202 Accepted

<details><summary>Resposta</summary>

**b) 201 Created** — POST que cria um recurso novo responde 201, não 200.

</details>

**2.** Porque é que DELETE devolve 204 e não 200?

- a) Porque apagar falha sempre
- b) Porque não há corpo para devolver depois de apagar: 204 = sucesso sem corpo
- c) É mais rápido responder 204
- d) O Express exige 204 em DELETE

<details><summary>Resposta</summary>

**b) Porque não há corpo para devolver depois de apagar: 204 = sucesso sem corpo** — 204 No Content é o código certo quando a operação teve sucesso mas não há nada para devolver.

</details>

**3.** Porque é que o Node não bloqueia todos os utilizadores enquanto espera a resposta da BD?

- a) Porque usa várias threads para cada pedido
- b) Porque as operações de I/O são assíncronas e libertam o event loop enquanto esperam
- c) Porque o Postgres é sempre rápido
- d) Porque o Express faz cache automática

<details><summary>Resposta</summary>

**b) Porque as operações de I/O são assíncronas e libertam o event loop enquanto esperam** — O Node é single-threaded, mas o await liberta o event loop durante o I/O, para atender outros pedidos.

</details>

**4.** No Express, o que torna uma função reconhecível como middleware de ERRO?

- a) Ser declarada com async
- b) Ter 4 parâmetros: (err, req, res, next)
- c) Chamar-se errorHandler
- d) Estar no topo do ficheiro

<details><summary>Resposta</summary>

**b) Ter 4 parâmetros: (err, req, res, next)** — O Express reconhece um middleware de erro pela assinatura com 4 parâmetros, não pelo nome.

</details>

**5.** Que método HTTP altera só os campos enviados, sem substituir o recurso inteiro?

<details><summary>Resposta</summary>

**patch** — PATCH altera parcialmente; PUT substituiria o recurso inteiro.

</details>

<!-- quiz:end -->
