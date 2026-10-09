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
