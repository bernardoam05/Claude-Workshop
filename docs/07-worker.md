# 07 · O Worker

**Objetivo:** ler um consumidor de mensagens **linha a linha**, perceber cada decisão de falha, e saber escrever um consumidor novo.

**Ficheiros para ler (por esta ordem):** `src/worker/src/handler.ts` → `src/worker/src/index.ts` → `src/worker/test/handler.test.ts`.

> **Nota:** o worker está em TypeScript desde a versão atual. A lógica é a mesma que descrevemos; o que mudou é que os tipos (`TaskEvent`, `Queryable`) descrevem o contrato, e o compilador verifica o que escrevemos. Mas os tipos **não** validam o JSON que chega da fila: é por isso que existe `isTaskEvent`.

---

## 1. O que é um worker

Um worker é um processo que **não atende pedidos HTTP**. Passa a vida a consumir trabalho de uma fila. Repara no `Dockerfile` do worker: não tem `EXPOSE`. Não há porta.

Porque um processo separado e não código dentro da API? Três razões:

1. **Escala independente**: se a fila crescer, sobes o worker sem tocar na API (`docker compose up --scale worker=3`).
2. **Isolamento de falhas**: um bug no processamento de eventos não derruba os pedidos HTTP.
3. **Não bloquear o event loop** da API com trabalho pesado (módulo 01).

## 2. Separação: `handler.js` vs `index.js`

| Ficheiro | Responsabilidade | Testável sem RabbitMQ? |
|---|---|---|
| `handler.js` | **O quê**: o que fazer com um evento (regras, BD) | Sim |
| `index.js` | **Como**: ligar, declarar topologia, decidir ack/nack | Não |

Esta separação é a mesma ideia da API: a lógica é uma função pura de dependências, e o "encanamento" fica à volta. Por isso o `handler` recebe `db` por parâmetro e os testes usam uma BD falsa.

## 3. `parseEvent`: transformar bytes em dados

```js
export function parseEvent(buffer) {
  try { return JSON.parse(buffer.toString('utf8')); }
  catch { throw new MalformedEventError('JSON inválido'); }
}
```

Repara que **convertemos** o `SyntaxError` do `JSON.parse` num `MalformedEventError`. Porquê? Porque o consumidor precisa de decidir *o que fazer* com o erro, e decide com base no **tipo** do erro, não na mensagem de texto. Se deixássemos um `SyntaxError` escapar, o `index.js` não o distinguiria de um erro transitório da BD, e uma mensagem com JSON partido ficaria em loop de requeue para sempre.

## 4. `handle`: a validação antes do efeito

```js
if (typeof event?.eventId !== 'string' || typeof event?.type !== 'string' || !event?.task) {
  throw new MalformedEventError(...);
}
```

Regra: **valida antes de tocar em qualquer recurso**. Repara no `?.` (optional chaining): se `event` for `null`, `event?.eventId` é `undefined` em vez de rebentar. Assim um `null` também cai no erro esperado.

Reparar também que o `typeof` é mais rigoroso do que `!event.eventId`. Com `!`, `0` ou `""` passam como "ausentes"; com `typeof`, um número onde esperamos string é rejeitado.

## 5. O `INSERT ... ON CONFLICT`: o coração da idempotência

```sql
INSERT INTO task_events (event_id, type, task_id, payload)
VALUES ($1, $2, $3, $4)
ON CONFLICT (event_id) DO NOTHING
RETURNING event_id
```

Se for a primeira vez, devolve uma linha → `processado`. Se for reentrega, não insere e devolve zero linhas → `duplicado (ignorado)`. A BD decide, de forma atómica. Não há `SELECT` antes que pudesse ser ultrapassado por outra instância.

**Pergunta:** e se o worker correr em **três** réplicas a consumir a mesma fila? Duas podem receber a mesma mensagem (reentrega). Qual delas ganha o `INSERT`? (Resposta: uma só, e a outra vê `duplicado`. É por isto que a garantia vem da BD e não do RabbitMQ.)

## 6. Decidir ack/nack: a tabela de decisão

```js
try {
  const event = parseEvent(msg.content);
  const result = await handle(event);
  channel.ack(msg);                          // ✅ sucesso
} catch (err) {
  if (err instanceof MalformedEventError) {
    channel.nack(msg, false, false);         // ☠️ permanente → DLQ
  } else {
    channel.nack(msg, false, true);          // ♻️ transitório → volta à fila
  }
}
```

| Situação | Decisão | Porquê |
|---|---|---|
| Processou | `ack` | Trabalho feito |
| JSON inválido / campos em falta | `nack(false)` → DLQ | Reenviar não resolve |
| BD momentaneamente indisponível | `nack(true)` → fila | Pode resolver-se sozinha |
| Bug (`TypeError` no código) | `nack(true)` → fila | ⚠️ Vai entrar em loop! |

A última linha é **o** problema que deves saber discutir. Um bug determinístico, com `requeue=true`, reentrega a mesma mensagem para sempre, a cada milissegundo. Mitigações reais: limitar tentativas (contar `x-death` ou usar um cabeçalho próprio), *backoff* com filas de retry com TTL, e alertas sobre a DLQ.

**Pergunta para ti:** como implementarias "tenta no máximo 3 vezes e depois manda para a DLQ"? (Pista: o RabbitMQ mantém um contador no cabeçalho `x-death` quando a mensagem passa pela DLX.)

## 7. `prefetch`, consumo e shutdown

- `channel.prefetch(10)`: no máximo 10 mensagens não confirmadas em voo (módulo 06).
- `channel.consume(QUEUE, callback)`: o callback corre **para cada mensagem**, em paralelo até ao limite de prefetch. Não faças `await` de um loop dentro dele à espera de todas.
- `msg === null`: o broker cancelou o consumidor (ex.: a fila foi apagada). Tratamos isto em vez de deixar o processo a pendurar.
- O `shutdown` fecha o canal **antes** da ligação e da BD, por ordem inversa à de abertura.
- **Ligação perdida:** se o broker cair, o evento `close` da ligação dispara e o worker sai com código `1`. A flag `shuttingDown` distingue esta saída de um encerramento normal (sem ela, o nosso próprio `close` durante o `shutdown` faria um exit de erro). Ver a secção 12 do módulo 06 para a história de como isto foi descoberto.

## 8. Escrever um consumidor novo (exercício guiado)

Imagina que queres um consumidor que envia uma notificação quando uma tarefa é criada. Precisas de:

1. Um **binding** na topologia: a fila `worker.notifications` ligada a `task.created`.
2. Uma **fila própria**. Nunca partilhes a fila de um consumidor com outro: cada um recebe uma **cópia** da mensagem só se estiver ligado ao exchange com a sua própria fila.
3. Um **handler** puro e testável.
4. A mesma disciplina de ack/nack.

**Atenção à armadilha:** se duas instâncias do mesmo consumidor consomem a **mesma** fila, cada mensagem vai para **uma** delas (competing consumers, que é o que queremos para escalar). Se ligares dois consumidores **diferentes** à **mesma** fila, cada um recebe **metade** e nenhum recebe tudo. Escolhe filas diferentes para consumidores que precisam de **todos** os eventos.

---

## Prática: escreve tu

Aqui escreves TypeScript, e o verificador faz duas coisas por ordem: primeiro corre o compilador (`tsc`), depois os testes. **Um erro de tipos é uma falha**, mesmo que o código corresse bem. É a mesma regra do `npm test` em `src/worker`.

Os testes têm uma parte nova: **testes de tipos**. São linhas que **têm** de dar erro de compilação, marcadas com `// @ts-expect-error`. Se os teus tipos forem largos demais (um `any`, ou `type: string` em vez dos três literais), essas linhas deixam de dar erro, e o próprio `@ts-expect-error` passa a ser o erro: `Unused '@ts-expect-error' directive`. Assim os testes verificam não só o que o código **faz**, mas também o que os tipos **proíbem**.

**Verificar:** `npm run verificar 07 events` (P1), `... 07 result` (P2), `... 07 notificationHandler` (P3), dentro de `pratica/`. Usa o filtro: sem ele, o compilador queixa-se também dos exercícios que ainda não começaste.

Os ficheiros começam **só com comentários**: escreves tu as declarações de tipos e as assinaturas das funções, que é precisamente a sintaxe que interessa treinar.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Uma discriminated union e o seu type guard (≈40 min)

**Ficheiro:** `pratica/07-worker/events.ts`

O `handler.ts` do projeto tem um só tipo de evento. Aqui são três: `task.created`, `task.completed` e `task.deleted`, e o terceiro tem uma forma **diferente** (traz `taskId` e `userId`, não a tarefa). Escreve:

- os tipos, como uma *discriminated union*: um campo `type` com um literal diferente em cada variante;
- `isTaskEvent(value: unknown): value is TaskEvent`, que verifica em runtime **os campos de cada variante**;
- `describeEvent(event)`, com um `switch` que o compilador garante ser **exaustivo**.

**Sintaxe que vais praticar:** `interface`, `extends` entre interfaces, `type X = A | B | C`, tipos literais (`type: 'task.created'`), `unknown`, type guards (`value is T`), `Record<string, unknown>`, `switch` com estreitamento de tipos, `never`.

<details>
<summary>Pista</summary>

- Põe os campos comuns (`eventId`, `occurredAt`) numa interface base e faz as três variantes `extends` dela.
- No `isTaskEvent`, uma função auxiliar `isRecord(value): value is Record<string, unknown>` deixa-te escrever `value.task` sem conversões. Depois, um `switch (value.type)` com um `case` por variante.
- Para a exaustividade: no `default` do `switch` do `describeEvent`, escreve `const exhaustive: never = event;`. Se todos os casos estiverem tratados, ali `event` é `never` e compila. Se um dia alguém acrescentar um quarto tipo e se esquecer deste `switch`, essa linha deixa de compilar.
</details>

<details>
<summary>Solução de referência</summary>

```ts
export interface TaskSnapshot {
  id: number;
  title: string;
  done: boolean;
  userId: number;
}

// Os campos comuns a todos os eventos, escritos uma vez.
interface BaseEvent {
  eventId: string;
  occurredAt: string;
}

// `type` é o DISCRIMINANTE: um literal diferente em cada variante. É por ele que o compilador
// sabe, depois de um `if (e.type === ...)`, qual das variantes tem nas mãos.
export interface TaskCreated extends BaseEvent {
  type: 'task.created';
  task: TaskSnapshot;
}

export interface TaskCompleted extends BaseEvent {
  type: 'task.completed';
  task: TaskSnapshot;
}

export interface TaskDeleted extends BaseEvent {
  type: 'task.deleted';
  taskId: number;
  userId: number;
}

export type TaskEvent = TaskCreated | TaskCompleted | TaskDeleted;

// Objeto "normal" (não null, não array), com as propriedades acessíveis por nome.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSnapshot(value: unknown): value is TaskSnapshot {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.title === 'string' &&
    typeof value.done === 'boolean' &&
    typeof value.userId === 'number'
  );
}

export function isTaskEvent(value: unknown): value is TaskEvent {
  if (!isRecord(value)) return false;
  if (typeof value.eventId !== 'string' || typeof value.occurredAt !== 'string') return false;

  switch (value.type) {
    case 'task.created':
    case 'task.completed':
      return isSnapshot(value.task);
    case 'task.deleted':
      return typeof value.taskId === 'number' && typeof value.userId === 'number';
    default:
      return false;
  }
}

export function describeEvent(event: TaskEvent): string {
  switch (event.type) {
    case 'task.created':
      return `Tarefa ${event.task.id} criada: "${event.task.title}"`;
    case 'task.completed':
      return `Tarefa ${event.task.id} concluída: "${event.task.title}"`;
    case 'task.deleted':
      return `Tarefa ${event.taskId} apagada`;
    default: {
      // Se alguém acrescentar um 4.º tipo ao TaskEvent e se esquecer dele aqui, `event` deixa de ser
      // `never` e ESTA linha deixa de compilar. O compilador passa a lembrar-se por nós.
      const exhaustive: never = event;
      throw new Error(`tipo de evento desconhecido: ${JSON.stringify(exhaustive)}`);
    }
  }
}
```
</details>

### P2 · Erros como valores: um `Result` genérico (≈35 min)

**Ficheiro:** `pratica/07-worker/result.ts`

O `parseJson` do projeto **lança** quando o JSON é inválido. Uma alternativa muito usada em TypeScript (e a regra em Rust e Go) é **devolver** o erro como valor: `Result<T, E>` é ou `{ ok: true, value }` ou `{ ok: false, error }`. Quem chama é **obrigado** pelo compilador a verificar `ok` antes de mexer no valor, e os testes de tipos confirmam isso.

Escreve o tipo, os construtores `ok` e `err`, `map`, `partition` e um `parseEvent` que **nunca lança**.

**Sintaxe que vais praticar:** genéricos (`<T>`, `<T, U, E>`), parâmetros de tipo por omissão (`E = string`), arrow functions genéricas, tipos de funções como parâmetros (`fn: (value: T) => U`), `import { type X }`.

<details>
<summary>Pista</summary>

O `ok` devolve `Result<T, never>`: o lado do erro "não existe". Como `never` cabe em qualquer tipo, um `ok(5)` pode ser usado onde se espera `Result<number, string>` ou `Result<number, QualquerErro>`. No `map`, quando `result.ok` é `false`, podes devolver o próprio `result`: o compilador aceita, porque uma falha `Result<T, E>` também serve como `Result<U, E>`.
</details>

<details>
<summary>Solução de referência</summary>

```ts
import { isTaskEvent, type TaskEvent } from './events.js';

export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

// `never` no lado que não existe: um ok(5) serve como Result<number, string>, Result<number, Erro>...
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

export function partition<T, E>(results: Result<T, E>[]): { values: T[]; errors: E[] } {
  const values: T[] = [];
  const errors: E[] = [];
  for (const r of results) {
    if (r.ok) values.push(r.value);
    else errors.push(r.error);
  }
  return { values, errors };
}

export function parseEvent(buffer: Buffer): Result<TaskEvent> {
  let value: unknown;
  try {
    value = JSON.parse(buffer.toString('utf8'));
  } catch {
    return err('JSON inválido');
  }
  return isTaskEvent(value) ? ok(value) : err('formato de evento inválido');
}
```

Quando usar cada estilo? Exceções para o que é **inesperado** (a BD caiu); `Result` para o que é **esperado** e quem chama tem de tratar (input inválido). O worker do projeto usa exceções e distingue os dois casos pela classe (`MalformedEventError`). Ambos são defensáveis.
</details>

### P3 · O consumidor de notificações da secção 8 (≈35 min)

**Ficheiro:** `pratica/07-worker/notificationHandler.ts`

A secção 8 descreve um consumidor novo que notifica o dono quando uma tarefa é concluída. Escreve o seu handler, com a mesma disciplina do `handler.ts`: validação antes do efeito, idempotência com `ON CONFLICT`, dependências recebidas por parâmetro (a BD e a função `notify`).

Há um problema novo, que o `handler.ts` não tem: **dois efeitos** (gravar na BD e enviar a notificação). Se gravas e o envio falha, a próxima entrega da mensagem vê "duplicado" e **ninguém** é notificado. O teste obriga-te a resolver isto com uma **ação de compensação**: se o `notify` falhar, apaga o registo e volta a lançar o erro.

**Sintaxe que vais praticar:** `interface` com assinatura de método, `type` para funções, `export class ... extends Error`, destructuring tipado nos parâmetros (`{ db, notify }: { db: Queryable; notify: Notify }`), `Promise<HandleResult>`, estreitamento depois de um type guard.

<details>
<summary>Pista</summary>

Depois de `if (!isTaskEvent(value)) throw ...` e `if (value.type !== 'task.completed') return 'ignorado'`, o compilador já sabe que `value` é um `TaskCompleted`: podes escrever `value.task.title` sem nenhuma conversão. Se tiveres de escrever `as`, há um type guard mal feito no P1.
</details>

<details>
<summary>Solução de referência</summary>

```ts
import { isTaskEvent } from './events.js';

export interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }>;
}

export type Notify = (userId: number, text: string) => Promise<void>;

export type HandleResult = 'notificado' | 'duplicado' | 'ignorado';

export class MalformedEventError extends Error {}

export function createNotificationHandler({ db, notify }: { db: Queryable; notify: Notify }) {
  return async function handle(value: unknown): Promise<HandleResult> {
    if (!isTaskEvent(value)) throw new MalformedEventError('evento mal formado');
    if (value.type !== 'task.completed') return 'ignorado';

    // Aqui o compilador já sabe que é um TaskCompleted: value.task existe e está tipado.
    const { eventId, task } = value;
    const text = `Concluíste "${task.title}"`;

    const { rows } = await db.query(
      `INSERT INTO notifications (event_id, user_id, text) VALUES ($1, $2, $3)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [eventId, task.userId, text],
    );
    if (rows.length === 0) return 'duplicado';

    try {
      await notify(task.userId, text);
    } catch (err) {
      // Ação de compensação: sem ela, a próxima entrega via "duplicado" e a notificação perdia-se.
      await db.query('DELETE FROM notifications WHERE event_id = $1', [eventId]);
      throw err;
    }
    return 'notificado';
  };
}
```

A compensação também não é perfeita: se o processo morrer **depois** de o `notify` ter enviado e **antes** de devolver, a mensagem volta e é "duplicado" (bem). Mas se morrer **depois** do envio falhar e **antes** do `DELETE`, a notificação perde-se. Entre efeitos em sistemas diferentes não há garantias absolutas, só escolhas sobre qual falha é mais aceitável. É o mesmo problema do dual-write (módulo 06), noutra roupa.
</details>

## Experiências

1. **Escala:** `docker compose -f config/docker-compose.yml up -d --scale worker=3`. Cria 10 tarefas concluídas. Vê os logs dos três workers (`logs worker`). Quem processa o quê? A distribuição é justa? Repara que a fila tem **uma** só, por isso as três instâncias são *competing consumers*.
2. **Crash a meio:** adiciona um `await new Promise(r => setTimeout(r, 5000))` no `handle` temporariamente (e reconstrói com `up -d --build worker`, porque o código está na imagem), cria uma tarefa concluída e, durante a espera, faz `docker compose ... kill worker`. Depois de reiniciar, a mensagem é reprocessada? A tabela `task_events` tem uma linha só? (Repara que o `kill` não deu `ack`.) Desfaz a alteração.
3. **Mensagem envenenada:** envia um JSON com `eventId` mas sem `task` pelo painel do RabbitMQ (Exchanges → `tasks` → Publish message, routing key `task.created`). Confirma que vai para a DLQ.

## Perguntas de pensamento crítico

1. O handler tem `ON CONFLICT DO NOTHING`. Se em vez disso fizesse `SELECT` seguido de `INSERT`, em que situação é que dois workers passariam ambos no `SELECT`?
2. Se o `INSERT` correr com sucesso mas o worker morrer **antes** do `ack`, o que acontece? E o que acontece ao contador de estatísticas (que é calculado a partir de `task_events`)? Compara com a solução que usaria um contador Redis com `INCR`.
3. Porque é que a `DLQ` não tem consumidor? Quem deve olhar para ela, e com que ferramenta?

<details>
<summary>Resposta</summary>

1. Ambos fariam o `SELECT` ao mesmo tempo, ambos veriam "não existe", e ambos inseririam. A verificação e a escrita não são atómicas. O `ON CONFLICT` faz as duas coisas num único passo dentro da BD.
2. A linha fica em `task_events` (o `INSERT` foi commitado). Na reentrega, o `INSERT` não insere e devolve `duplicado`. O contador é **correto** porque é uma `COUNT` sobre a fonte de verdade. Com Redis `INCR`, a morte entre o `INSERT` e o `INCR` (ou entre o `INCR` e o `ack`) faria o contador ficar errado sem forma de o corrigir: são **duas** escritas em sistemas diferentes, o mesmo dual-write do módulo 06. Por isso escolhemos `COUNT` (ver `12-decisoes`).
3. Ninguém a consome de propósito: é um **armazém de falhas**. Um humano (ou um script) inspeciona, corrige a causa, e reenvia as mensagens para a fila principal. Ferramentas: o painel do RabbitMQ (Get messages / Move messages), ou o Shovel plugin para mover em massa. Uma DLQ sem alerta é uma falha silenciosa: é preciso monitorizar o tamanho dela.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 07`.

**1.** Porque é que o worker é um processo SEPARADO da API?

- a) Só por preferência de organização
- b) Escala independente, isolamento de falhas, e não bloqueia o event loop da API com trabalho pesado
- c) É sempre mais barato ter dois processos
- d) O RabbitMQ exige processos separados

<details><summary>Resposta</summary>

**b) Escala independente, isolamento de falhas, e não bloqueia o event loop da API com trabalho pesado** — Um bug no processamento de eventos não deve derrubar os pedidos HTTP da API.

</details>

**2.** O que garante a idempotência do handler ao gravar em task_events?

- a) Um mutex escrito à mão no código Node
- b) INSERT ... ON CONFLICT (event_id) DO NOTHING, atómico dentro da própria BD
- c) Um cache em memória do processo
- d) Nada em especial — confia-se na sorte

<details><summary>Resposta</summary>

**b) INSERT ... ON CONFLICT (event_id) DO NOTHING, atómico dentro da própria BD** — A BD decide atomicamente se é a primeira vez; não há janela de corrida entre verificar e escrever.

</details>

**3.** Que cabeçalho o RabbitMQ acrescenta a uma mensagem que passou pela dead-letter exchange, registando de onde veio e porquê?

<details><summary>Resposta</summary>

**x-death** — x-death regista exchange, fila, razão e quantas vezes a mensagem foi rejeitada.

</details>

**4.** O que acontece se o worker morrer DEPOIS do INSERT em task_events mas ANTES do ack?

- a) A linha gravada é perdida automaticamente
- b) A mensagem é reentregue; o INSERT seguinte é ignorado (ON CONFLICT), sem perda nem duplicação do efeito
- c) O sistema entra em deadlock
- d) É irrelevante, nunca acontece na prática

<details><summary>Resposta</summary>

**b) A mensagem é reentregue; o INSERT seguinte é ignorado (ON CONFLICT), sem perda nem duplicação do efeito** — É exatamente o cenário que a idempotência foi desenhada para cobrir.

</details>

**5.** Porque é perigoso usar nack(requeue=true) para um erro causado por um BUG determinístico no código?

- a) Não é perigoso, é a prática recomendada
- b) Cria um ciclo infinito de reentregas ao ritmo do erro, consumindo CPU para sempre, sem nunca resolver nada
- c) Torna a mensagem mais lenta a processar
- d) É o comportamento por omissão do RabbitMQ

<details><summary>Resposta</summary>

**b) Cria um ciclo infinito de reentregas ao ritmo do erro, consumindo CPU para sempre, sem nunca resolver nada** — Erros permanentes (como um bug) devem ir para a DLQ, não ser reenviados sem fim.

</details>

<!-- quiz:end -->
