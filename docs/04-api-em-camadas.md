# 04 · API em camadas

**Objetivo:** perceber porque separamos a API em camadas, o que cada camada pode e não pode fazer, e como as peças são **ligadas** no arranque.

**Ficheiros para ler (por esta ordem):** `src/api/src/index.js` → `app.js` → `routes/tasks.js` → `services/taskService.js` → `repositories/taskRepository.js`.

---

## 1. O mapa das camadas

```
HTTP  →  routes/tasks.js  →  services/taskService.js  →  repositories/taskRepository.js  →  Postgres
          (traduz)            (decide)                    (guarda)
                                   ↓
                          cache/cache.js → Redis
                          messaging/publisher.js → RabbitMQ
```

Cada camada tem **uma responsabilidade** e só conhece a camada de baixo **pela forma** que lhe é dada:

| Camada | Sabe de | **Não** sabe de |
|---|---|---|
| `routes` | HTTP, códigos de estado, `req`/`res` | regras de negócio, SQL |
| `services` | regras (cache, eventos, transições) | HTTP, SQL |
| `repositories` | SQL | HTTP, regras |

**Porque é que isto importa?** Porque cada camada pode mudar sem arrastar as outras. Trocar Express por Fastify só mexe em `routes`. Trocar Postgres por outra BD só mexe em `repositories`. E podes testar a regra de negócio (`services`) **sem** um servidor HTTP nem uma BD.

## 2. Composição: `index.js` é o único sítio que conhece tudo

Lê `index.js`. Repara no padrão:

```js
const service = createTaskService({
  repository: createTaskRepository(pool),
  cache: createCache(redis),
  publisher,
  cacheTtlSeconds: config.cacheTtlSeconds,
});
```

Isto é **injeção de dependências** (DI) em versão manual. O serviço **não** cria o Postgres nem o Redis: recebe-os. Em vez de:

```js
// ❌ acoplado: o serviço decide qual é a BD
async function createTask(title) {
  const pool = new pg.Pool(...);   // impossível de testar sem Postgres
}
```

fazemos:

```js
// ✅ o serviço só usa o que lhe dão
export function createTaskService({ repository, cache, publisher }) { ... }
```

**Vantagem prática:** nos testes, passamos versões falsas (fakes). Vê `test/taskService.test.js`: a BD é um `Map` em memória, e os testes correm em milissegundos.

**Pergunta:** porque é que `createTaskService` é uma **função que devolve um objeto** e não uma classe com `new`?

<details>
<summary>Resposta</summary>

Não é obrigatório, é um estilo. Uma função-fábrica (`createX`) evita `this` (que se perde facilmente em callbacks), e as dependências ficam numa **closure**, invisíveis de fora. A API pública é só o objeto que devolve. Ambos os estilos são válidos; o importante é ser consistente no projeto.
</details>

## 3. Routes: traduzir, não decidir

Lê `routes/tasks.js`. Uma rota típica tem quatro passos:

1. **Validar** a entrada (`safeParse` com zod).
2. **Chamar** o serviço.
3. **Traduzir** o resultado em HTTP (`201`, `404`).
4. **Enviar** a resposta.

Repara no `PATCH`:

```js
const task = await service.updateTask(id, parsed.data.done);
if (!task) throw new HttpError(404, 'Tarefa não encontrada');
```

A rota **não sabe** porque é que a tarefa não existe. O serviço devolve `null`, a rota decide que isso é um `404`. Se amanhã o serviço lançar uma exceção própria, só a tradução muda.

## 4. Validação: na fronteira, uma vez

`validation/taskSchemas.js` define **o contrato** do que aceitamos:

```js
title: z.string().trim().min(1).max(200)
```

Três coisas a notar:

- **`.trim()` antes de `.min(1)`**: `"   "` passa como vazio. A ordem das regras importa.
- **`z.coerce.number()`** para o `:id` da URL: os parâmetros de URL chegam sempre como string. `coerce` converte e valida numa só operação.
- **`safeParse`** em vez de `parse`: não lança exceção, devolve `{ success, data | error }`. Mais fácil de tratar.

**Porque validar se a BD já tem `CHECK`?** Defesa em profundidade. A BD protege os dados; a validação na API dá uma **mensagem de erro útil** (`400` com texto legível) em vez de um erro SQL cru (`500`). São camadas diferentes com propósitos diferentes.

## 5. Erros: uma só forma de os devolver

Lê `middleware/errorHandler.js`. Há dois tipos de erro:

- **Esperados** (`HttpError(404, ...)`): o cliente fez algo que não podia. Devolvemos a mensagem.
- **Inesperados** (qualquer outro): bugs ou infraestrutura. Registamos o stack trace e devolvemos `500` genérico.

Isto mantém a API **previsível**: todos os erros têm o formato `{ "error": "..." }`.

## 6. `app.js` vs `index.js`: separar a construção do arranque

`createApp` **constrói** a aplicação Express (sem a pôr a escutar). `index.js` **arranca** o processo: liga BD, Redis, RabbitMQ, faz `listen` e trata do `SIGTERM`.

Porquê a separação? Os testes de rotas (`test/routes.test.js`) importam `createApp`, mas **não** importam `index.js`. Se o código de arranque estivesse no mesmo ficheiro, importar a app para um teste tentaria ligar-se a infraestrutura.

## 7. Encerramento gracioso (graceful shutdown)

Quando fazes `docker stop`, o Docker envia `SIGTERM` e espera uns segundos antes de enviar `SIGKILL`. Se não tratares `SIGTERM`:

- Pedidos a meio são cortados.
- Ligações ficam abertas no servidor da BD.

`index.js` trata o sinal: `server.close()` deixa de aceitar pedidos novos, espera pelos atuais, e só depois fecha a BD e sai com `process.exit(0)`.

**Experiência:** `time docker compose ... stop api` e depois `docker compose ... logs api | tail`. Vê a mensagem `SIGTERM recebido, a encerrar`.

---

## Prática: escreve tu

Vais construir uma funcionalidade nova, **notas**, atravessando as três camadas deste módulo, uma de cada vez: validação → serviço → rotas. Cada camada tem os seus testes, e cada uma é testada **sozinha**, com versões falsas das outras. É a mesma técnica dos testes em `src/api/test/`.

**Verificar:** `npm run verificar 04` (dentro de `pratica/`). Só uma camada: `npm run verificar 04 noteSchemas`, `... 04 noteService` ou `... 04 notesRouter`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Validação com zod (≈40 min)

**Ficheiro:** `pratica/04-api-em-camadas/noteSchemas.js`

Escreve três esquemas:

- `createNoteSchema`: `title` (obrigatório, sem espaços nas pontas, 1 a 120 caracteres, com as mensagens "O título é obrigatório" e "Máximo de 120 caracteres"), `body` (até 2000 caracteres, por omissão `''`), `tags` (até 5, cada uma com 1 a 20 caracteres, em minúsculas, sem repetidas, por omissão `[]`), `pinned` (booleano, por omissão `false`). **Campos desconhecidos são rejeitados.**
- `updateNoteSchema`: os mesmos campos, todos opcionais, **sem** valores por omissão, e pelo menos um tem de vir ("Indica pelo menos um campo para alterar").
- `listQuerySchema`: para a query string `?tag=...&pinned=true|false&limit=...`; `limit` entre 1 e 50, por omissão 20.

Há duas armadilhas reais escondidas nos testes, e as duas apanham programadores experientes:

1. Se fizeres o `updateNoteSchema` com `createNoteSchema.partial()`, os valores por omissão continuam lá. Um `PATCH` que só muda o título passa a mandar `pinned: false`, e **desafixa** a nota sem ninguém pedir.
2. `z.coerce.boolean()` converte `'false'` em `true`, porque em JavaScript qualquer string não vazia é verdadeira (`Boolean('false') === true`).

**Sintaxe que vais praticar:** `z.object`/`z.strictObject`, `z.string().trim().min().max()`, `z.array(...)`, `.default(...)`, `.optional()`, `.transform(...)`, `.refine(...)`, `z.enum([...])`, `z.coerce.number()`, `new Set(...)` com spread.

<details>
<summary>Pista</summary>

Define cada campo **uma vez** numa constante (`const title = z.string()...`) e usa-a nos dois esquemas: no de criação com `.default(...)`, no de alteração com `.optional()`. Para a mensagem de "campo em falta" (quando nem sequer chega uma string), o zod 4 aceita `z.string({ error: '...' })`.
</details>

<details>
<summary>Solução de referência</summary>

```js
import { z } from 'zod';

// Cada campo definido UMA vez e reutilizado pelos dois esquemas de escrita.
// { error } no z.string() é a mensagem para quando nem sequer vem uma string (ex.: o campo falta).
const title = z
  .string({ error: 'O título é obrigatório' })
  .trim()
  .min(1, 'O título é obrigatório')
  .max(120, 'Máximo de 120 caracteres');
const body = z.string().max(2000, 'Máximo de 2000 caracteres');
const tags = z
  .array(z.string().trim().toLowerCase().min(1, 'Tag vazia').max(20, 'Máximo de 20 caracteres por tag'))
  .max(5, 'Máximo de 5 tags')
  .transform((lista) => [...new Set(lista)]); // Set remove as repetidas; o spread volta a fazer um array
const pinned = z.boolean();

// strictObject: um campo que não conhecemos (ex.: userId) é um erro, não é ignorado em silêncio.
export const createNoteSchema = z.strictObject({
  title,
  body: body.default(''),
  tags: tags.default([]),
  pinned: pinned.default(false),
});

// Sem .default() aqui: num PATCH, um campo ausente quer dizer "não mexer", não "pôr o valor por omissão".
export const updateNoteSchema = z
  .strictObject({
    title: title.optional(),
    body: body.optional(),
    tags: tags.optional(),
    pinned: pinned.optional(),
  })
  .refine((dados) => Object.keys(dados).length > 0, { message: 'Indica pelo menos um campo para alterar' });

export const listQuerySchema = z.object({
  tag: z.string().trim().toLowerCase().min(1).optional(),
  // z.coerce.boolean() estaria ERRADO: Boolean('false') é true (qualquer string não vazia é verdadeira).
  pinned: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
```
</details>

### P2 · Erros do domínio e camada de serviço (≈45 min)

**Ficheiros:** `pratica/04-api-em-camadas/errors.js` e `pratica/04-api-em-camadas/noteService.js`

Primeiro as classes de erro (`DomainError`, `NotFoundError`, `ConflictError`, com herança). Depois o serviço, que recebe o repositório e um **relógio** por injeção de dependências (secção 2) e aplica as regras:

- `list(userId, { tag, pinned, limit })`: só as notas do utilizador; filtros opcionais; afixadas primeiro, depois a mais recentemente alterada.
- `create(userId, dados)`: guarda com `userId`, `createdAt` e `updatedAt` vindos do relógio. **No máximo 3 notas afixadas por utilizador** (`ConflictError`).
- `update(userId, id, alterações)`: só os campos pedidos, `updatedAt` novo; o limite de afixadas também se aplica, mas afixar uma nota já afixada não conta duas vezes.
- `remove(userId, id)`.
- Nota inexistente **ou de outro utilizador**: `NotFoundError('Nota')`, nos dois casos (porquê o mesmo erro? relê o comentário em `taskService.updateTask`).

O serviço **não sabe** que existe HTTP. Não há `404` aqui, só "não encontrado".

**Sintaxe que vais praticar:** `class X extends Y`, `super(...)`, `this.constructor.name`, `instanceof`, `.filter().sort().slice()`, comparadores de `sort` (`(a, b) => ...`), spread de objetos (`{ ...data, userId }`).

<details>
<summary>Pista</summary>

Duas funções auxiliares dentro do `createNoteService` poupam muita repetição: `findOwn(userId, id)` (busca e lança `NotFoundError` se não for do utilizador) e `assertCanPin(userId)` (conta as afixadas e lança `ConflictError`). Para ordenar por dois critérios: `b.pinned - a.pinned || b.updatedAt.localeCompare(a.updatedAt)`. Em JavaScript, `true - false` é `1`, e o `||` só usa o segundo critério quando o primeiro dá `0` (empate).
</details>

<details>
<summary>Solução de referência</summary>

```js
// errors.js
export class DomainError extends Error {
  constructor(message) {
    super(message);
    // this.constructor.name é o nome da classe concreta: "NotFoundError", "ConflictError"...
    // Assim as subclasses herdam isto sem repetir a linha.
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(what) {
    super(`${what} não encontrada`);
  }
}

export class ConflictError extends DomainError {}
```

```js
// noteService.js
import { ConflictError, NotFoundError } from './errors.js';

const MAX_PINNED = 3;

export function createNoteService({ repository, clock }) {
  // "Inexistente" e "de outro utilizador" dão o mesmo erro: não revelamos que a nota existe.
  async function findOwn(userId, id) {
    const note = await repository.findById(id);
    if (!note || note.userId !== userId) throw new NotFoundError('Nota');
    return note;
  }

  async function assertCanPin(userId) {
    const notes = await repository.findAllByUser(userId);
    if (notes.filter((n) => n.pinned).length >= MAX_PINNED) {
      throw new ConflictError(`Máximo de ${MAX_PINNED} notas afixadas`);
    }
  }

  return {
    async list(userId, { tag, pinned, limit = 20 }) {
      const notes = await repository.findAllByUser(userId);
      return notes
        .filter((n) => tag === undefined || n.tags.includes(tag))
        .filter((n) => pinned === undefined || n.pinned === pinned)
        // Comparador: negativo = a primeiro. true - false = 1, por isso b.pinned - a.pinned põe as afixadas à frente.
        .sort((a, b) => b.pinned - a.pinned || b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit);
    },

    async create(userId, data) {
      if (data.pinned) await assertCanPin(userId);
      const now = clock();
      return repository.insert({ ...data, userId, createdAt: now, updatedAt: now });
    },

    async update(userId, id, changes) {
      const note = await findOwn(userId, id);
      // Só conta como "afixar" se passar de false para true.
      if (changes.pinned && !note.pinned) await assertCanPin(userId);
      return repository.update(id, { ...changes, updatedAt: clock() });
    },

    async remove(userId, id) {
      await findOwn(userId, id);
      await repository.delete(id);
    },
  };
}
```
</details>

### P3 · Camada HTTP (≈40 min)

**Ficheiro:** `pratica/04-api-em-camadas/notesRouter.js`

Escreve o router Express: quatro rotas, validação com os teus esquemas do P1, e **um** middleware de erro dentro do router que traduz erros de validação em `400`, `NotFoundError` em `404` e `ConflictError` em `409`. Um erro que não reconhece **segue em frente** com `next(err)`: o `500` não é decisão deste router.

Os testes têm duas partes. A primeira usa um **serviço falso** que regista as chamadas: prova que o router valida, converte (o `:id` chega como string `'3'` e tem de seguir como número `3`) e traduz, sem depender do teu P2. A segunda junta as três camadas a sério.

**Sintaxe que vais praticar:** `Router()`, `router.get/post/patch/delete`, `req.params`, `req.query`, `req.body`, `res.status(204).end()`, middleware de erro com `instanceof`.

<details>
<summary>Pista</summary>

Uma função `validate(schema, input)` que faz `safeParse` e **lança** um erro com a primeira mensagem deixa cada rota com duas ou três linhas. Como o Express 5 apanha erros lançados em funções `async`, esse erro vai parar ao middleware de erro do router sem nenhum `try`/`catch`.
</details>

<details>
<summary>Solução de referência</summary>

```js
import { Router } from 'express';
import { z } from 'zod';
import { ConflictError, NotFoundError } from './errors.js';
import { createNoteSchema, listQuerySchema, updateNoteSchema } from './noteSchemas.js';

const idSchema = z.coerce.number().int().positive();

// Erro de validação "embrulhado" para o middleware de erro deste router o reconhecer.
class ValidationError extends Error {}

// parse que, em vez de devolver { success, error }, lança logo um ValidationError com a 1.ª mensagem.
function validate(schema, input) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);
  return parsed.data;
}

export function createNotesRouter(service) {
  const router = Router();

  router.get('/notes', async (req, res) => {
    const query = validate(listQuerySchema, req.query);
    res.json(await service.list(req.user.userId, query));
  });

  router.post('/notes', async (req, res) => {
    const data = validate(createNoteSchema, req.body);
    res.status(201).json(await service.create(req.user.userId, data));
  });

  router.patch('/notes/:id', async (req, res) => {
    const id = validate(idSchema, req.params.id);
    const changes = validate(updateNoteSchema, req.body);
    res.json(await service.update(req.user.userId, id, changes));
  });

  router.delete('/notes/:id', async (req, res) => {
    const id = validate(idSchema, req.params.id);
    await service.remove(req.user.userId, id);
    res.status(204).end();
  });

  // A tradução domínio → HTTP vive aqui, num só sítio. O serviço nunca soube o que é um 404.
  router.use((err, req, res, next) => {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    if (err instanceof ConflictError) return res.status(409).json({ error: err.message });
    next(err);
  });

  return router;
}
```
</details>

**Depois de passar:** escreveste o equivalente a `validation/` + `services/` + `routes/` do projeto. Repara no que **não** precisaste para testar cada camada: o P1 não precisou de servidor, o P2 não precisou de HTTP, e a primeira parte do P3 não precisou do serviço verdadeiro. É isso que as camadas compram.

## Experiências

1. Adiciona um campo que não existe ao corpo: `curl -X POST ... -d '{"title":"a","foo":1}'`. O zod ignora campos desconhecidos por omissão. É bom ou mau? Pensa no que acontece se um cliente enviar `"done": true` a `POST` (a criação)?
2. Muda a mensagem de erro em `taskSchemas.js` e corre `npm test` em `src/api`. O teste que a verifica (`/obrigatório/`) reage? Porque é que um teste a verificar texto exato pode ser frágil?

## Perguntas de pensamento crítico

1. Se o `repository.create` falhar **depois** de o `cache.del` ter sido chamado, o que é que os clientes veem? (Pista: a ordem das linhas em `createTask`.)
2. A regra "só publicar na transição false → true" está no serviço. Porque **não** na rota? Porque **não** na BD (um trigger)?
3. Um colega quer importar `taskRepository` diretamente numa rota "para ser mais rápido". Que argumento usas para o convencer a não o fazer?

<details>
<summary>Resposta</summary>

1. Na ordem atual, o `create` falha antes do `del`, por isso a cache não é tocada e continua correta. Se a ordem fosse inversa, a cache era apagada e o `create` falhava, e a próxima leitura voltava a encher a cache com dados iguais: inofensivo aqui, mas o raciocínio "apaga a cache depois de escrever" é o correto (módulo 05).
2. É uma **regra de negócio**. Na rota, ficava acoplada ao HTTP e não era testável sem servidor. Na BD (trigger), ficava invisível para quem lê o código da aplicação e seria difícil de testar e de versionar. Há casos em que um trigger é a escolha certa (garantias que a aplicação não pode dar), mas não aqui.
3. Quando a rota fala com a BD diretamente, a regra "invalidar cache" e "publicar evento" têm de ser **copiadas** para cada rota. Quando alguém se esquece numa delas, o sistema fica inconsistente sem nenhum erro visível. A camada de serviço existe precisamente para que estas regras estejam num único sítio.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 04`.

**1.** Nas camadas deste projeto, quem é o ÚNICO sítio que fala SQL?

- a) As rotas (routes/)
- b) O serviço (services/)
- c) O repositório (repositories/)
- d) O ficheiro app.js

<details><summary>Resposta</summary>

**c) O repositório (repositories/)** — Rotas traduzem HTTP; serviços decidem regras; só o repositório toca em SQL.

</details>

**2.** Porque é que o serviço recebe repository/cache/publisher como parâmetros (DI), em vez de os criar ele próprio?

- a) É mais rápido em runtime
- b) Permite testar com versões falsas (fakes), sem BD, Redis nem RabbitMQ reais
- c) É uma exigência do Express
- d) Reduz o número de ficheiros do projeto

<details><summary>Resposta</summary>

**b) Permite testar com versões falsas (fakes), sem BD, Redis nem RabbitMQ reais** — É o que torna os testes unitários possíveis em milissegundos, sem infraestrutura.

</details>

**3.** Em updateTask, o evento task.completed só é publicado numa transição de 'done' de false para...?

<details><summary>Resposta</summary>

**true** — Marcar duas vezes como concluída não gera dois eventos; só a transição conta.

</details>

**4.** Porque é que app.js e index.js estão em ficheiros separados?

- a) Só por estética de organização
- b) app.js só CONSTRÓI a app (testável sem infraestrutura); index.js ARRANCA o processo e liga tudo
- c) Não há razão técnica
- d) Para reduzir o número de linhas por ficheiro

<details><summary>Resposta</summary>

**b) app.js só CONSTRÓI a app (testável sem infraestrutura); index.js ARRANCA o processo e liga tudo** — Os testes de rotas importam createApp sem nunca tocar em Postgres, Redis ou RabbitMQ.

</details>

**5.** O que é o 'dual-write problem' mencionado neste módulo?

- a) Escrever duas vezes seguidas na mesma tabela por engano
- b) Escrever em dois sistemas (BD e fila) sem uma transação que cubra os dois, podendo um falhar e o outro não
- c) Um bug que duplica linhas na BD
- d) Publicar a mesma mensagem duas vezes na fila

<details><summary>Resposta</summary>

**b) Escrever em dois sistemas (BD e fila) sem uma transação que cubra os dois, podendo um falhar e o outro não** — Se o RabbitMQ estiver em baixo, a tarefa fica gravada na BD mas o evento nunca é publicado.

</details>

<!-- quiz:end -->
