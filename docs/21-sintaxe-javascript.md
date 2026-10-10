# 21 · Sintaxe de JavaScript/TypeScript usada neste projeto

**Isto não é um curso de JavaScript.** É uma referência rápida para as construções que vais mesmo encontrar nos ficheiros deste workshop (`src/api`, `src/worker`, `src/web`, `scripts/`). Não precisas de ler isto de uma vez — abre-o sempre que uma linha não fizer sentido, procura a construção, e volta ao ficheiro. Cada entrada tem a linha **real** do projeto, não um exemplo inventado.

Se preferires aprender isto de forma mais estruturada antes de começares, o [MDN JavaScript Guide](https://developer.mozilla.org/pt-PT/docs/Web/JavaScript/Guide) é a referência mais fiável e gratuita que existe.

---

## `const` / `let` (e porque quase nunca vês `var`)

```js
const STATS_TTL_SECONDS = 5;
let attempt = 1;
```

`const` = não pode ser reatribuída depois (mas se for um objeto, os seus CAMPOS ainda podem mudar). `let` = pode ser reatribuída. `var` é a forma antiga, com regras de visibilidade confusas — este projeto não a usa.

## Arrow functions (`=>`)

```js
export const tasksCacheKey = (userId) => `tasks:user:${userId}`;
```

Uma função escrita de forma compacta. É equivalente a:

```js
export function tasksCacheKey(userId) {
  return `tasks:user:${userId}`;
}
```

Se o corpo é só uma expressão (sem `{ }`), o `return` é implícito — o valor da expressão à direita do `=>` é devolvido automaticamente. Quando o corpo tem `{ }`, precisas de `return` explícito, como numa função normal:

```js
const buildEvent = (type, task) => ({   // repara nos parênteses a mais: sem eles, { seria lido
  eventId: randomUUID(),                // como o INÍCIO de um corpo de função, não como um objeto
  type,
  task,
});
```

## Object shorthand (`{ type, task }`)

No exemplo anterior, `{ eventId: randomUUID(), type, task }` é o mesmo que `{ eventId: randomUUID(), type: type, task: task }`. Quando o nome da variável e o nome do campo são iguais, escreve-se só uma vez.

## Destructuring (desempacotar objetos e arrays)

```js
const { rows } = await pool.query('SELECT ...');
```

Em vez de `const result = await pool.query(...)` e depois `result.rows`, tiras logo o campo que te interessa. Funciona com vários campos (`const { a, b } = obj`) e com arrays (`const [first, second] = lista`), e também em parâmetros de função:

```js
export function createTaskService({ repository, cache, publisher, cacheTtlSeconds }) {
```

Isto diz: "a função recebe UM objeto, e quero logo os campos `repository`, `cache`, `publisher` e `cacheTtlSeconds` dele, com esses nomes". É o padrão de **injeção de dependências** deste projeto (módulo 04) — parece complicado a ler a primeira vez, mas é só desempacotar.

## Template literals (`` ` ` `` com `${}`)

```js
throw new Error(`Variável de ambiente obrigatória em falta: ${name}`);
```

Como um `f-string` noutras linguagens: tudo dentro de `${...}` é avaliado como código e inserido na string. Usa-se crase (`` ` ``), não aspas normais.

## Optional chaining (`?.`) e nullish coalescing (`??`)

```js
const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
if (!user?.passwordHash || !ok) throw new HttpError(401, 'Credenciais inválidas');
```

- `user?.passwordHash`: se `user` for `null`/`undefined`, o resultado é `undefined` em vez de rebentar com "Cannot read property of null". Sem o `?.`, `user.passwordHash` quando `user` é `null` lança um erro.
- `a ?? b`: devolve `a`, a não ser que `a` seja `null` ou `undefined` — nesse caso devolve `b`. **Diferente de `a || b`**: `0 ?? 'default'` devolve `0` (zero é um valor válido), mas `0 || 'default'` devolve `'default'` (zero conta como "falso" no `||`). É por isto que `process.env.PORT ?? 3000` usa `??`: uma porta `0` configurada de propósito não devia ser substituída.

## `async` / `await` e Promises

```js
async function main() {
  const pool = createPool(config.databaseUrl);
  await migrate(pool);
  ...
}
```

Uma função `async` devolve sempre uma **Promise** (uma "promessa" de um valor que ainda não existe). `await` pausa a função até a Promise resolver, **sem bloquear o resto do programa** — é a base do módulo 01 (o event loop do Node). Só podes usar `await` dentro de uma função `async` (ou, em ficheiros `.mjs`, no topo do ficheiro).

Erros em código `async`: usa `try { ... } catch (err) { ... }`, exatamente como código síncrono — não precisas de `.then()`/`.catch()` encadeados.

## `import` / `export` (módulos ES)

```js
import { randomUUID } from 'node:crypto';
export const tasksCacheKey = (userId) => ...;
export function createTaskService(...) { ... }
export default function App() { ... }   // só no React (src/web)
```

- `export` (sem `default`): podes ter **vários** por ficheiro; quem importa escolhe o nome entre `{ }`: `import { tasksCacheKey } from './taskService.js'`.
- `export default`: só **um** por ficheiro; quem importa escolhe o nome que quiser, sem `{ }`: `import App from './App.jsx'`.
- `node:crypto`: o prefixo `node:` diz explicitamente "isto é um módulo embutido do Node", não um pacote instalado.

## Classes (usadas pouco, de propósito)

```js
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
```

`extends Error` = esta classe **é** um erro, com tudo o que isso implica (stack trace, `instanceof Error` funciona). `super(message)` chama o construtor da classe-mãe (`Error`) antes de continuares a construir a tua. Este projeto evita classes para lógica de negócio — prefere funções e closures (secção seguinte) — mas usa-as para erros, porque é o que a própria linguagem espera (`throw`/`catch`/`instanceof`).

## O padrão "fábrica" (factory) e closures

```js
export function createTaskService({ repository, cache, publisher, cacheTtlSeconds }) {
  const buildEvent = (type, task) => ({ ... });        // função privada, só visível aqui dentro
  const invalidate = (userId) => cache.del(...);         // idem

  return {
    async listTasks(userId) { ... },
    async createTask(userId, title) { ... },
  };
}
```

Isto é o padrão que vês em quase todos os ficheiros de `src/api/src/services` e `repositories`: uma função que recebe dependências e devolve um **objeto com métodos**. `buildEvent` e `invalidate` são **closures**: funções que "fecham" sobre as variáveis à sua volta (`repository`, `cache`, etc.) e continuam a ter acesso a elas depois de `createTaskService` ter terminado de correr. É a alternativa deste projeto a uma `class`, e o módulo 04 explica porquê (injeção de dependências, testes com fakes).

## Métodos de array: `.map`, `.filter`, `.find`, `.flatMap`

```js
{tasks.map((task) => (
  <li key={task.id}>...</li>
))}

const disponiveis = bank.map((m) => m.id).join(', ');
const perModule = bank.flatMap((mod) => shuffle(mod.questions).slice(0, 2));
```

- `.map(fn)`: transforma cada elemento de um array noutra coisa, devolve um array do MESMO tamanho. No React (`TaskList.jsx`), transforma cada tarefa num elemento `<li>`.
- `.flatMap(fn)`: como `.map`, mas se `fn` devolver um array, "achata-se" num nível — útil quando cada módulo dá VÁRIAS perguntas e queres uma lista só, não uma lista de listas.
- `.find(fn)`: devolve o primeiro elemento que satisfaz a condição, ou `undefined`.

Nenhum destes métodos altera o array original — devolvem um array/valor novo.

## `for...of` e `for` clássico

```js
for (const file of files) { ... }          // percorre VALORES (não índices)
for (let i = a.length - 1; i > 0; i--) { } // quando precisas do índice, ou de ir ao contrário
```

`for...of` é o mais comum neste projeto quando só precisas do valor. O `for` clássico aparece quando precisas do índice (como no baralhar do `quiz.mjs`).

## `try` / `catch` / `finally`

```js
try {
  evt = JSON.parse(buffer.toString('utf8'));
} catch {
  throw new MalformedEventException('JSON inválido');
}
```

Repara que `catch` aqui não tem parâmetro (`catch { }`, não `catch (err) { }`) — é válido quando não precisas do erro original, só de saber que algo falhou.

## TypeScript (só no `src/worker`): o que os `:tipo` significam

```ts
export interface TaskEvent {
  eventId: string;
  type: 'task.created' | 'task.completed';
  task: TaskSnapshot;
}

export function parseEvent(buffer: Buffer): unknown { ... }
```

TypeScript é JavaScript com **anotações de tipo**, que só existem durante a compilação — desaparecem completamente no `.js` final (módulo 07 explica isto com mais detalhe, incluindo porque isso implica que a validação em runtime continua a ser necessária). O que precisas de saber para ler:

- `interface X { campo: tipo; }`: descreve a FORMA de um objeto.
- `'a' | 'b'`: um tipo que só pode ser uma destas strings exatas (union type).
- `function f(x: Buffer): unknown`: `x` tem de ser um `Buffer`; a função devolve algo de tipo desconhecido (`unknown`), que tens de verificar antes de usar.
- `value is TaskEvent` (no `isTaskEvent`): uma função que, depois de chamada com `true`, diz ao compilador "a partir de agora, trata este valor como um `TaskEvent`" — chama-se *type guard*.

---

## Como usar isto na prática

Não leias isto de uma vez. Quando chegares a um módulo (01, 04, 05, 06, 07...) e abrires um ficheiro `.js`/`.ts` que o módulo te manda ler, e uma linha não fizer sentido: volta aqui, procura a construção pelo símbolo (`?.`, `=>`, `...`), lê a explicação, e volta ao ficheiro. Ao fim de alguns módulos, vais deixar de precisar.
