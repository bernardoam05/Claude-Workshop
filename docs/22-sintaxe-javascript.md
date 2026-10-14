# 22 · Sintaxe de JavaScript/TypeScript usada neste projeto

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

## Prática: escreve tu

Esta chuleta serve para **ler** JavaScript. Os exercícios seguintes servem para o **escrever** sem pensar: funções curtas, cada uma a obrigar-te a usar uma construção concreta das secções acima. São os exercícios mais "de ginásio" da prática toda: repete-os daqui a uma semana, sem olhar para a solução, e vê quanto ficou.

**Verificar:** `npm run verificar 22` (dentro de `pratica/`). Só um exercício: `npm run verificar 22 basico`, `... 22 arrays`, `... 22 assincrono` ou `... 22 classes`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · O básico moderno (≈25 min)

**Ficheiro:** `pratica/22-sintaxe-javascript/basico.js`. Seis funções pequenas: destructuring nos parâmetros (com valores por omissão), `?.` e `??`, template literals, rest e spread em arrays e objetos, chaves calculadas, object shorthand e métodos.

Um dos testes distingue `??` de `||`: uma cidade `''` (vazia) é uma cidade, não "sem cidade". Com `||`, uma string vazia, um `0` ou um `false` também seriam trocados pelo valor por omissão.

<details>
<summary>Pista</summary>

Para tirar uma propriedade de um objeto sem o alterar, o truque é um destructuring com rest: `const { [campo]: _, ...resto } = objeto`. O `[campo]` usa o **valor** da variável como nome da propriedade, o `_` recebe o valor que não interessa, e o `...resto` fica com tudo o resto.
</details>

<details>
<summary>Solução de referência</summary>

```js
// Destructuring logo nos parâmetros, com valores por omissão para o que pode faltar.
export function resumirUtilizador({ nome, morada, papeis = [] }) {
  // ?. pára e dá undefined se morada não existir; ?? só troca null/undefined (um '' fica '').
  const cidade = morada?.cidade ?? 'sem cidade';
  return `${nome} (${cidade}) · ${papeis.length} papéis`;
}

export function separar(lista) {
  const [primeiro, ...resto] = lista;
  return { primeiro, resto }; // shorthand: { primeiro: primeiro, resto: resto }
}

export function semCampo(objeto, campo) {
  // [campo]: chave calculada; _ é o valor que deitamos fora; ...resto apanha as outras propriedades.
  const { [campo]: _, ...resto } = objeto;
  return resto;
}

export function fundir(base, ...extras) {
  // Os spreads aplicam-se por ordem: as propriedades repetidas são escritas por cima.
  return extras.reduce((acumulado, extra) => ({ ...acumulado, ...extra }), { ...base });
}

export function criarPonto(x, y) {
  return {
    x,
    y,
    distanciaA(outro) {
      return Math.hypot(outro.x - this.x, outro.y - this.y);
    },
  };
}

// `= {}` no fim: sem argumento nenhum, desestrutura um objeto vazio em vez de rebentar com undefined.
export function lerOpcoes({ porta = 3000, host = 'localhost', debug = false } = {}) {
  return { porta, host, debug };
}
```
</details>

### P2 · Métodos de array, sem `for` (≈30 min)

**Ficheiro:** `pratica/22-sintaxe-javascript/arrays.js`. Oito consultas sobre uma lista de tarefas, com uma regra que o teste verifica: **nenhum `for`, nenhum `let`**. Cada função é uma expressão encadeada (`filter`, `map`, `reduce`, `find`, `some`, `flatMap`, `toSorted`, `Object.groupBy`, `Object.entries`/`fromEntries`). A lista de testes está congelada (`Object.freeze`): um `.sort()` que a altere rebenta.

<details>
<summary>Pista</summary>

Para tirar repetidos de um array: `[...new Set(array)]`. Para transformar um objeto, passa-o a pares, transforma os pares e volta a montá-lo: `Object.fromEntries(Object.entries(obj).map(([chave, valor]) => [chave, novoValor]))`.
</details>

<details>
<summary>Solução de referência</summary>

```js
export const titulosFeitos = (tarefas) => tarefas.filter((t) => t.feita).map((t) => t.titulo);

export const minutosPorFazer = (tarefas) =>
  tarefas.filter((t) => !t.feita).reduce((soma, t) => soma + t.minutos, 0); // 0: valor inicial

export const primeiraDoProjeto = (tarefas, projeto) => tarefas.find((t) => t.projeto === projeto);

export const temTarefaLonga = (tarefas) => tarefas.some((t) => !t.feita && t.minutos > 60);

export const todasAsTags = (tarefas) => [...new Set(tarefas.flatMap((t) => t.tags))].toSorted();

// Object.groupBy (Node 21+) agrupa num objeto { chave: [elementos] }; depois trocam-se os
// elementos pelos títulos, com Object.entries → map → Object.fromEntries.
export const titulosPorProjeto = (tarefas) =>
  Object.fromEntries(
    Object.entries(Object.groupBy(tarefas, (t) => t.projeto)).map(([projeto, lista]) => [
      projeto,
      lista.map((t) => t.titulo),
    ]),
  );

export const indexarPorId = (tarefas) => Object.fromEntries(tarefas.map((t) => [t.id, t]));

// toSorted devolve uma cópia ordenada; o sort ordenava a própria lista (e rebentava, por estar congelada).
export const porDuracao = (tarefas) => tarefas.toSorted((a, b) => b.minutos - a.minutos);
```
</details>

### P3 · Promises e `async`/`await` (≈30 min)

**Ficheiro:** `pratica/22-sintaxe-javascript/assincrono.js`. Esperar, correr em série, correr em paralelo, sobreviver a falhas parciais (`Promise.allSettled`) e pôr um limite de tempo (`Promise.race`). Os testes registam **quando** cada função começa e acaba, por isso uma versão "em paralelo" que afinal corre em série não passa. O último teste confirma que o `comTimeout` não deixa um temporizador pendurado (o Node não terminaria enquanto ele existisse).

<details>
<summary>Pista</summary>

A diferença entre série e paralelo é só **onde** está o `await`. Em série: `for (const fn of fns) resultados.push(await fn())`, e cada uma espera pela anterior. Em paralelo: `fns.map((fn) => fn())` arranca todas, e só depois `await Promise.all(...)`.
</details>

<details>
<summary>Solução de referência</summary>

```js
export function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function emSerie(fns) {
  const resultados = [];
  for (const fn of fns) {
    resultados.push(await fn()); // o await DENTRO do ciclo é que faz esperar por cada uma
  }
  return resultados;
}

export async function emParalelo(fns) {
  // fns.map(fn => fn()) arranca todas JÁ; o Promise.all só espera.
  return Promise.all(fns.map((fn) => fn()));
}

export async function tudoOuQuaseTudo(fns) {
  const resultados = await Promise.allSettled(fns.map((fn) => fn()));
  return {
    ok: resultados.filter((r) => r.status === 'fulfilled').map((r) => r.value),
    falhas: resultados.filter((r) => r.status === 'rejected').map((r) => r.reason.message),
  };
}

export function comTimeout(promise, ms) {
  let timer;
  const despertador = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Tempo esgotado')), ms);
  });
  // A corrida: ganha a primeira a resolver ou a rejeitar. Ganhe quem ganhar, desliga-se o despertador.
  return Promise.race([promise, despertador]).finally(() => clearTimeout(timer));
}
```
</details>

### P4 · Closures, classes e erros (≈30 min)

**Ficheiro:** `pratica/22-sintaxe-javascript/classes.js`. Um contador com estado escondido numa closure (o padrão "fábrica" do projeto), uma classe `Conta` com um campo privado `#saldo`, um getter, um método estático e uma classe de erro própria, e um `try`/`catch`/`finally`.

<details>
<summary>Pista</summary>

No `Conta.transferir`, a ordem das duas operações é que garante o "tudo ou nada": se o levantamento for feito **primeiro** e falhar, o depósito nunca chega a acontecer. Pela ordem inversa, o destino ficava com o dinheiro e a origem não perdia nada.
</details>

<details>
<summary>Solução de referência</summary>

```js
export function criarContador(inicial = 0) {
  let valor = inicial; // só as três funções abaixo o veem: é isso uma closure
  return {
    incrementar: () => ++valor,
    decrementar: () => (valor = Math.max(0, valor - 1)),
    valor: () => valor,
  };
}

export class SaldoInsuficiente extends Error {
  constructor(emFalta) {
    super(`Saldo insuficiente: faltam ${emFalta}`);
    this.name = 'SaldoInsuficiente';
    this.emFalta = emFalta;
  }
}

export class Conta {
  #saldo = 0; // privado de verdade: fora da classe, conta.#saldo nem sequer compila

  constructor(titular) {
    this.titular = titular;
  }

  get saldo() {
    return this.#saldo;
  }

  depositar(valor) {
    if (!(valor > 0)) throw new RangeError('O depósito tem de ser positivo');
    this.#saldo += valor;
    return this; // devolver this permite encadear: conta.depositar(1).levantar(1)
  }

  levantar(valor) {
    if (valor > this.#saldo) throw new SaldoInsuficiente(valor - this.#saldo);
    this.#saldo -= valor;
    return this;
  }

  static transferir(de, para, valor) {
    de.levantar(valor); // se falhar, lança ANTES de mexer no destino: nada fica a meio
    para.depositar(valor);
  }
}

export function lerConfig(texto, aoTerminar = () => {}) {
  try {
    return { ok: true, valor: JSON.parse(texto) };
  } catch {
    return { ok: false, erro: 'JSON inválido' };
  } finally {
    aoTerminar(); // corre depois do return de qualquer um dos ramos
  }
}
```
</details>

## Como usar isto na prática

Não leias isto de uma vez. Quando chegares a um módulo (01, 04, 05, 06, 07...) e abrires um ficheiro `.js`/`.ts` que o módulo te manda ler, e uma linha não fizer sentido: volta aqui, procura a construção pelo símbolo (`?.`, `=>`, `...`), lê a explicação, e volta ao ficheiro. Ao fim de alguns módulos, vais deixar de precisar.
