# 06 · Mensagens com RabbitMQ

**Objetivo:** perceber **porque** existem filas de mensagens, como o RabbitMQ as encaminha, e as garantias (e as não-garantias) de entrega. Esta é a parte mais conceptual do workshop: lê-a devagar.

**Ficheiros para ler primeiro:** `src/api/src/messaging/publisher.js`, `src/worker/src/index.js` (topologia), `config/docker-compose.yml` (serviço `rabbitmq`).

---

## 1. Síncrono vs assíncrono

Sem fila, a API faria tudo no próprio pedido:

```
PATCH /tasks/3  →  grava na BD  →  envia email  →  atualiza estatísticas  →  gera PDF  →  responde
```

Se o email demorar 4 segundos, o utilizador espera 4 segundos. Se o serviço de email estiver em baixo, o pedido **falha** por causa de uma coisa que não era o pedido.

Com uma fila:

```
PATCH /tasks/3  →  grava na BD  →  publica "task.completed"  →  responde (200)
                                          │
                                          ▼
                                    [ RabbitMQ ]  ──→  worker  →  email, estatísticas, PDF...
```

Ganhos:

- **Desacoplamento**: a API não sabe quem consome o evento. Podes adicionar um consumidor novo sem tocar na API.
- **Suavização de picos**: se chegarem 10 000 eventos de uma vez, a fila guarda-os e o worker processa ao seu ritmo.
- **Resiliência**: se o worker estiver em baixo, as mensagens **esperam** na fila.

Custo: **consistência eventual**. O efeito acontece depois, não no mesmo pedido. A estatística "processadas pelo worker" no frontend é exatamente isto.

## 2. Filas vs pub/sub vs o que usamos

- **Fila (queue)**: cada mensagem é entregue a **um** consumidor. Pensa em "tarefas para trabalhadores".
- **Pub/sub**: cada mensagem chega a **todos** os subscritores. Pensa em "notícias".
- **Exchange + bindings** (RabbitMQ): o produtor não publica diretamente numa fila. Publica num **exchange**, que encaminha a mensagem para as filas com base em **bindings** e na **routing key**.

Este último modelo separa "quem publica" de "quem recebe": o produtor só diz `task.completed`; quem decide que filas recebem isso são os bindings, que os consumidores definem.

## 3. Os tipos de exchange

| Tipo | Regra de encaminhamento | Exemplo |
|---|---|---|
| `direct` | routing key **igual** ao binding | `task.completed` → fila `completed` |
| `fanout` | ignora a routing key, envia para **todas** as filas ligadas | `tasks.dlx` → DLQ |
| `topic` | padrão com **wildcards**: `*` = uma palavra, `#` = zero ou mais | `task.*` apanha `task.created` e `task.completed` |

Usamos `topic` em `tasks`. O binding do worker é `task.*`, que apanha ambos os eventos. Se amanhã quiseres uma fila só para `task.deleted`, adicionas um binding sem mudar a API.

**Experiência:** no painel `http://localhost:15672` → Exchanges → `tasks` → Bindings. Vê o binding `task.*` para `worker.task-events`.

## 4. Declarar a topologia

Repara que **o produtor e o consumidor declaram** exchanges e filas com `assert*`. É idempotente: só cria se não existir, e falha se existir com argumentos diferentes.

Isto tem uma consequência prática importante: **se mudares um argumento de uma fila existente** (ex.: adicionar `x-dead-letter-exchange`), o RabbitMQ recusa com `PRECONDITION_FAILED`. Tens de apagar a fila (ou criar outra com outro nome). Experiência:

```bash
docker compose -f config/docker-compose.yml exec rabbitmq rabbitmqctl list_queues name arguments
```

## 5. Durabilidade: três coisas diferentes

Para uma mensagem **não se perder** são precisas três condições, e cada uma é diferente:

| Condição | Onde se define | Código |
|---|---|---|
| O **exchange** sobrevive a reinício do broker | `durable: true` | `assertExchange(..., { durable: true })` |
| A **fila** sobrevive a reinício | `durable: true` | `assertQueue(..., { durable: true })` |
| A **mensagem** é escrita em disco | `persistent: true` | `publish(..., { persistent: true })` |

Se faltar uma, perdes dados num reinício. Uma fila durável com mensagens não persistentes perde as mensagens. Mensagens persistentes numa fila não durável perdem-se com a fila.

## 6. Confirmações do produtor (publisher confirms)

Sem confirmações, `channel.publish()` é um "dispara e esquece": retorna antes de o broker ter recebido nada. Com `createConfirmChannel()`, o callback só é chamado quando o broker diz "recebi". É isso que o `publisher.js` espera:

```js
channel.publish(EXCHANGE, routingKey, body, options, (err) => (err ? reject(err) : resolve()));
```

Se o broker estiver em baixo, a publicação **falha** e a API responde com erro. Isto é melhor do que responder `200` e perder o evento em silêncio.

## 7. Confirmações do consumidor (ack / nack)

Este é o ponto mais importante do módulo.

```js
channel.ack(msg);                    // "trabalho feito, podes apagar"
channel.nack(msg, false, true);      // "falhei, devolve à fila" (requeue = true)
channel.nack(msg, false, false);     // "falhei, não quero esta mensagem" (→ DLX se existir)
```

Regra: **ack só depois de o trabalho estar concluído.** Se o worker morrer depois de receber a mensagem mas antes de fazer `ack`, o broker **reentrega-a** a outro consumidor (ou ao mesmo, quando reiniciar). Por isso a entrega é **pelo menos uma vez** (*at-least-once*).

Consequência inevitável: **a mesma mensagem pode chegar mais do que uma vez.** É por isto que o worker tem de ser **idempotente** (módulo 07).

**Alternativa perigosa:** `ack` automático ao receber (*auto-ack*). Se o worker morrer a meio, a mensagem desaparece. Entrega **no máximo uma vez** (*at-most-once*). Raramente é o que queres.

## 8. Prefetch: controlo de fluxo

```js
channel.prefetch(10);
```

Sem prefetch, o broker empurra **todas** as mensagens da fila para o consumidor de uma vez. Se forem 100 000, o worker enche a memória. Com prefetch 10, só recebe 10 não confirmadas; quando faz `ack`, recebe a próxima.

Regra prática: prefetch alto = throughput alto, mas mais memória e pior distribuição entre consumidores. Prefetch 1 = distribuição justa e lenta. O valor certo mede-se.

## 9. Dead Letter Queue (DLQ)

E se a mensagem **nunca** puder ser processada? Por exemplo, JSON inválido. Se fizermos `nack(requeue=true)`, ela volta, falha, volta, falha... para sempre. Um **ciclo infinito** que consome CPU e nunca termina.

A solução: uma **dead-letter exchange** (DLX). A fila principal tem `x-dead-letter-exchange: tasks.dlx`. Quando uma mensagem é rejeitada com `requeue=false`, o broker **re-publica-a** no DLX, que a envia para a **DLQ**, onde fica para inspeção.

```
worker.task-events  ──nack(requeue=false)──→  tasks.dlx (fanout)  ──→  worker.task-events.dlq
```

Vê isto acontecer no sistema real: o exercício B8 tem o passo a passo. No teste que fizemos, a mensagem chegou à DLQ com um cabeçalho `x-death`, que regista **de onde veio, quantas vezes e porquê** (`reason: rejected`). Esse cabeçalho é o que usas para diagnosticar.

**Regra:** `requeue=true` só para erros **transitórios** (BD momentaneamente em baixo). Para erros **permanentes** (dados inválidos), `requeue=false`. Misturar isto é o erro mais comum.

## 10. Idempotência: a resposta a "pelo menos uma vez"

Porque a entrega pode repetir-se, o efeito de processar um evento tem de ser **o mesmo** quer seja processado uma vez quer dez. Técnicas:

1. **Chave natural única** + `INSERT ... ON CONFLICT DO NOTHING` (o que fazemos, com `eventId`).
2. **Tabela de mensagens processadas** dentro da **mesma transação** que o efeito.
3. **Operações naturalmente idempotentes**: "definir `done = true`" é idempotente; "incrementar contador" **não**.

Por isso é que `eventId` é um UUID gerado pela API (`randomUUID()`) e **não** uma sequência do worker.

## 11. O problema do dual-write

Este é o problema mais importante do módulo e é fácil de não ver.

O `updateTask` faz **duas coisas** em sistemas diferentes:

```js
await repository.setDone(id, done);             // 1) escreve no Postgres
await publisher.publish('task.completed', ...); // 2) escreve no RabbitMQ
```

Não existe transação que abranja Postgres **e** RabbitMQ. Se o passo 2 falhar (broker em baixo), a BD mudou mas o evento **nunca** existirá: o worker nunca conta a conclusão. Se invertermos a ordem, o evento sai mas a BD pode não ter mudado.

**Experiência (faz isto a sério):**

```bash
docker compose -f config/docker-compose.yml stop rabbitmq
curl -s -X POST localhost:8080/api/tasks -H 'Content-Type: application/json' -d '{"title":"teste dual-write"}'
docker compose -f config/docker-compose.yml start rabbitmq
```

Resultado: a API responde erro (500), mas a tarefa **foi gravada** (confirma com `GET /api/tasks`). O cliente acha que falhou e pode repetir, criando duplicados. Isto é o problema, em concreto.

Soluções (discutimos no módulo 13):

- **Outbox pattern**: grava o evento **na mesma transação SQL** que a mudança, numa tabela `outbox`. Um processo separado lê a tabela e publica. Atómico, porque é só uma BD.
- **Change Data Capture** (ex.: Debezium): lê o log de transações da BD e publica.
- Aceitar a inconsistência e reconciliar periodicamente.

## 12. Um bug que só apareceu ao testar

Escrevemos a primeira versão do publisher e do worker, e os testes unitários passavam. Depois testámos **a queda do broker**, e apareceram dois problemas que os testes não viam:

| Componente | Sintoma (versão inicial) | Causa |
|---|---|---|
| API | **Todos** os `POST` falhavam com 500 **para sempre**, mesmo depois de o RabbitMQ voltar | a ligação morreu e o `publisher` guardava a referência morta |
| Worker | Morria em silêncio e só voltava porque o Docker o reiniciou (2 reinícios) | a ligação fechou-se sem handler; o processo sai sem explicar porquê |

**Porque é que os testes não apanharam?** Porque os fakes nunca "morrem". O teste assume que a dependência está sempre viva. Um teste de unidade não exercita o **estado de falha da infraestrutura**. Isto é o que os testes de integração (e as experiências com `docker compose stop`) são para.

**Correção (ver `messaging/publisher.js` e `worker/src/index.js`):**

- A API **reabre** a ligação no próximo `publish` quando a anterior caiu. Há um só pedido de reconexão de cada vez (o `opening` evita duas ligações em simultâneo), e num pedido HTTP só se tenta **uma vez**: não se faz um pedido esperar 20 segundos por um retry.
- O worker **regista** a perda e sai com código `1`. O Docker reinicia-o com estado limpo. É uma estratégia simples e válida (*fail fast + restart*), mas é uma **escolha**, não um acaso. O exercício B11 pede a alternativa (reconexão dentro do processo).

**Lição:** um sistema distribuído tem de ser testado pela **falha**, não só pelo caminho feliz. Repara que, mesmo corrigido, o dual-write continua lá: durante a queda, a API ainda devolve 500 e a tarefa fica gravada. A correção do bug tornou o sistema **recuperável**, não **consistente**. São coisas diferentes.

**Experiência (reproduz e verifica a correção):**

```bash
docker compose -f config/docker-compose.yml stop rabbitmq
curl -i -X POST localhost:8080/api/tasks -H 'Content-Type: application/json' -d '{"title":"x"}'   # 500
docker compose -f config/docker-compose.yml start rabbitmq
sleep 25
curl -i -X POST localhost:8080/api/tasks -H 'Content-Type: application/json' -d '{"title":"y"}'   # 201, sem reiniciar a API
```

---

## Prática: escreve tu

Nenhum destes exercícios precisa do RabbitMQ a correr. Isso é de propósito: a lógica que interessa (para onde vai uma mensagem, quando fazer `ack`, como não perder eventos) é código normal, e testa-se com versões falsas do canal e do publisher. É assim que o `src/worker/test/` testa o handler.

**Verificar:** `npm run verificar 06` (dentro de `pratica/`). Só um exercício: `npm run verificar 06 topicRouting`, `... 06 consumer` ou `... 06 outbox`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · O algoritmo de um topic exchange (≈35 min)

**Ficheiro:** `pratica/06-mensagens-rabbitmq/topicRouting.js`

Escreve `matches(bindingKey, routingKey)`, a regra que o RabbitMQ aplica a cada mensagem num exchange `topic` (secção 3): `*` substitui exatamente uma palavra, `#` substitui zero ou mais. Depois `route(bindings, routingKey)`, que diz que filas recebem a mensagem.

São 21 casos de teste, e cada um é uma pergunta de exame sobre topic exchanges. Antes de correres, tenta prever os mais estranhos: `"task.#"` apanha `"task"`? `"#.urgent"` apanha `"urgent"`?

**Sintaxe que vais praticar:** `split('.')`, destructuring com resto (`const [first, ...rest] = pattern`), `slice`, recursão, `filter` + `map`, `new Set` para tirar repetidos.

<details>
<summary>Pista</summary>

Pensa em `matchWords(padrão, palavras)` como uma função recursiva que só olha para a **primeira** palavra do padrão:

- padrão vazio: só bate se também não houver palavras;
- palavra literal ou `*`: tem de haver uma palavra, e ela tem de bater; depois, o resto com o resto;
- `#`: experimenta engolir 0 palavras, depois 1, depois 2... e pergunta à recursão se o resto bate com o que sobra.
</details>

<details>
<summary>Solução de referência</summary>

```js
export function matches(bindingKey, routingKey) {
  return matchWords(bindingKey.split('.'), routingKey.split('.'));
}

// Recursiva: compara a primeira palavra do padrão e resolve o resto com uma chamada a si mesma.
function matchWords(pattern, words) {
  if (pattern.length === 0) return words.length === 0; // padrão acabou: só bate se as palavras também

  const [first, ...rest] = pattern;

  if (first === '#') {
    // # pode engolir 0, 1, 2... palavras. Experimentamos todas as hipóteses até uma dar certo.
    for (let skip = 0; skip <= words.length; skip++) {
      if (matchWords(rest, words.slice(skip))) return true;
    }
    return false;
  }

  if (words.length === 0) return false; // * e palavras literais precisam de exatamente uma palavra
  return (first === '*' || first === words[0]) && matchWords(rest, words.slice(1));
}

export function route(bindings, routingKey) {
  const queues = bindings
    .filter(({ bindingKey }) => matches(bindingKey, routingKey))
    .map(({ queue }) => queue);
  return [...new Set(queues)]; // um Set mantém a ordem de inserção e descarta repetidos
}
```

O RabbitMQ não faz isto mensagem a mensagem: compila os bindings numa estrutura (uma *trie*) para não repetir trabalho. A regra, porém, é exatamente esta.
</details>

### P2 · Um consumidor com tentativas limitadas (≈35 min)

**Ficheiro:** `pratica/06-mensagens-rabbitmq/consumer.js`

O worker do projeto faz `nack(msg, false, true)` em qualquer erro transitório: a mensagem volta à fila **sem limite**. Se a BD estiver em baixo uma hora, a mesma mensagem dá voltas a toda a velocidade durante uma hora. Escreve um consumidor melhor:

- JSON inválido ou `PermanentError` → DLQ logo;
- erro transitório → republica a mensagem com um cabeçalho `x-retries` a contar as tentativas e faz `ack` da original;
- ao chegar a `maxRetries` → DLQ.

O teste verifica também a **ordem** das operações: primeiro republicar, depois `ack`. Antes de abrir a pista, pensa: se o processo morrer entre as duas, o que acontece em cada ordem?

**Sintaxe que vais praticar:** fechar sobre parâmetros (`createConsumer` devolve uma função), `instanceof`, `??` para cabeçalhos que podem não existir, spread de objetos para copiar e acrescentar um cabeçalho, `Buffer.toString('utf8')`.

<details>
<summary>Pista</summary>

Republicar e depois `ack`: se morrer pelo meio, a mensagem fica **duplicada** (e o handler é idempotente, aguenta). `ack` e depois republicar: se morrer pelo meio, a mensagem fica **perdida**. Num sistema "pelo menos uma vez", entre duplicar e perder escolhe-se sempre duplicar.
</details>

<details>
<summary>Solução de referência</summary>

```js
import { PermanentError } from './errors.js';

export function createConsumer({ channel, queue, handle, maxRetries = 3 }) {
  const toDlq = (msg) => {
    channel.nack(msg, false, false); // requeue=false + dead-letter exchange configurado → DLQ
    return 'dlq';
  };

  return async function onMessage(msg) {
    let value;
    try {
      value = JSON.parse(msg.content.toString('utf8'));
    } catch {
      return toDlq(msg); // bytes que não são JSON nunca vão passar a ser: não vale a pena repetir
    }

    try {
      await handle(value);
      channel.ack(msg);
      return 'ack';
    } catch (err) {
      if (err instanceof PermanentError) return toDlq(msg);

      const headers = msg.properties.headers ?? {};
      const retries = headers['x-retries'] ?? 0;
      if (retries >= maxRetries) return toDlq(msg); // desistimos: fica na DLQ para um humano ver

      // Primeiro a cópia, depois o ack. Se o processo morrer entre os dois, a mensagem fica
      // DUPLICADA (o handler é idempotente, aguenta). Pela ordem inversa ficava PERDIDA.
      channel.sendToQueue(queue, msg.content, {
        persistent: true,
        headers: { ...headers, 'x-retries': retries + 1 },
      });
      channel.ack(msg);
      return 'retry';
    }
  };
}
```

Isto ainda tenta outra vez **imediatamente**. Em produção, junta-se um atraso que cresce a cada tentativa (*exponential backoff*): com o RabbitMQ, faz-se com uma fila de espera com TTL e dead-letter de volta para a fila principal, ou com o plugin `delayed-message-exchange`.
</details>

### P3 · Outbox: a resposta ao dual-write (≈40 min)

**Ficheiro:** `pratica/06-mensagens-rabbitmq/outbox.js` (as tabelas já estão em `schema.sql`; os testes usam o mesmo Postgres embutido do módulo 03)

A secção 11 descreve o problema: gravar na BD e publicar no RabbitMQ são duas operações sem transação comum. Escreve as duas metades do padrão *transactional outbox*:

- `createTask` grava a tarefa **e** o evento numa tabela `outbox`, na **mesma** transação SQL. O teste apaga a tabela `outbox` a meio para provar que, se o evento falhar, a tarefa também desaparece.
- `relayOnce` lê os eventos por publicar, publica-os **por ordem** e marca cada um. Se o broker falhar a meio, para (não salta), e a próxima volta continua de onde ficou.

Este exercício é o treino isolado do [C14](12-exercicios.md#c14-outbox). Depois de o fazeres aqui, ligá-lo ao projeto a sério é sobretudo trabalho de canalização.

**Sintaxe que vais praticar:** transação com `BEGIN`/`COMMIT`/`ROLLBACK` (como no módulo 03), `for...of` com `break`, `JSON.stringify` para uma coluna `JSONB`, parâmetros por omissão num objeto (`{ batchSize = 10 } = {}`).

<details>
<summary>Pista</summary>

Em `relayOnce`, o `try`/`catch` envolve **só** o `publish`. O `break` dentro do `catch` sai do `for`. O `UPDATE` que marca o evento vem depois do `publish`, nunca antes: marcar primeiro e falhar a publicar seria perder o evento.
</details>

<details>
<summary>Solução de referência</summary>

```js
export async function createTask(db, title) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [task] } = await client.query(
      'INSERT INTO tasks (title) VALUES ($1) RETURNING id, title',
      [title],
    );
    // O evento é escrito na MESMA transação: ou ficam os dois, ou nenhum.
    await client.query('INSERT INTO outbox (routing_key, payload) VALUES ($1, $2)', [
      'task.created',
      JSON.stringify({ type: 'task.created', task }),
    ]);
    await client.query('COMMIT');
    return task;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function relayOnce(db, publisher, { batchSize = 10 } = {}) {
  const { rows } = await db.query(
    `SELECT id, routing_key, payload FROM outbox
     WHERE published_at IS NULL
     ORDER BY id
     LIMIT $1`,
    [batchSize],
  );

  let published = 0;
  for (const event of rows) {
    try {
      await publisher.publish(event.routing_key, event.payload);
    } catch {
      break; // o broker falhou: paramos para não trocar a ordem. A próxima volta continua daqui.
    }
    // Se o processo morrer AQUI (publicou mas não marcou), o evento sai outra vez na próxima volta.
    // A outbox garante "pelo menos uma vez", não "exatamente uma vez": o consumidor tem de ser idempotente.
    await db.query('UPDATE outbox SET published_at = now() WHERE id = $1', [event.id]);
    published++;
  }
  return { published };
}
```

Com vários relays a correr ao mesmo tempo, dois podiam ler o mesmo evento. A versão de produção lê com `SELECT ... FOR UPDATE SKIP LOCKED` dentro de uma transação, o que faz cada relay saltar as linhas que outro já está a tratar.
</details>

## Experiências

1. **Ver as mensagens:** no painel, cria uma tarefa e conclui-a. Vê a taxa de mensagens em Queues → `worker.task-events`.
2. **Provar at-least-once:** para o worker com `docker compose ... stop worker` e cria 3 tarefas concluídas. Arranca com `start worker`. Vê o worker a processar as 3 mensagens acumuladas. Isto é a fila a **absorver** a indisponibilidade.
3. **Provar a DLQ:** já fizeste. Relê os logs do worker e confirma `→ DLQ`.

## Perguntas de pensamento crítico

1. Porque é que o `ack` está **depois** do processamento e não **antes**? Descreve o cenário em que a ordem contrária perde dados.
2. Um colega propõe: "põe `autoAck: true` no `consume` e fica mais simples". Qual é a garantia que perdes? Em que tipo de dados isso seria aceitável?
3. Porque é que o `eventId` é gerado na API e não no worker? O que se perderia se fosse gerado no worker?
4. Como resolverias o dual-write **sem** uma fila? (Pista: onde é que o Postgres tem garantias que o RabbitMQ não tem?)

<details>
<summary>Resposta</summary>

1. Se fizeres `ack` antes e o worker morrer durante o processamento, o broker dá a mensagem como concluída e **nunca** a reentrega. O efeito (gravar em `task_events`, incrementar) não aconteceu, e ninguém sabe. Com `ack` depois, a morte reentrega a mensagem.
2. Perdes a garantia de que a mensagem sobrevive a uma falha do consumidor (passas a *at-most-once*). Aceitável para métricas de telemetria onde perder 0,1% dos eventos é irrelevante. Inaceitável para faturação.
3. Se o worker gerasse o id, uma **reentrega** geraria um id novo e a idempotência por `eventId` falharia: o mesmo evento seria contado duas vezes. O id tem de ser atribuído **uma vez**, na origem do facto, antes de qualquer retry. Quem cria o facto é quem gera a identidade.
4. Com uma BD: o **outbox**. Gravas a tarefa e a linha de outbox na mesma transação SQL. Ou ambas ficam, ou nenhuma. Depois, um processo (relay) lê o outbox e publica, marcando como enviado. Se o relay falhar, reenvia (at-least-once, e o consumidor é idempotente, como já vimos).
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 06`.

**1.** A entrega 'pelo menos uma vez' do RabbitMQ implica o quê para o consumidor?

- a) Nada de especial, pode ignorar isso
- b) Tem de ser idempotente: a mesma mensagem pode chegar mais de uma vez
- c) Tem de responder mais rápido
- d) Tem de usar menos memória

<details><summary>Resposta</summary>

**b) Tem de ser idempotente: a mesma mensagem pode chegar mais de uma vez** — Reentregas acontecem sempre que o consumidor morre entre receber e fazer ack.

</details>

**2.** Quando se deve usar nack(msg, false, false) — ou seja, sem requeue?

- a) Sempre, para qualquer erro
- b) Para erros PERMANENTES (ex.: JSON inválido), que reenviar nunca resolve
- c) Nunca, é sempre perigoso
- d) Só quando a fila está vazia

<details><summary>Resposta</summary>

**b) Para erros PERMANENTES (ex.: JSON inválido), que reenviar nunca resolve** — Erros permanentes com requeue=true criam um ciclo infinito; vão para a DLQ em vez disso.

</details>

**3.** Como se chama a fila para onde vão as mensagens que não podem ser processadas?

<details><summary>Resposta</summary>

**dlq** — Dead Letter Queue: um 'armazém de falhas', para inspeção humana.

</details>

**4.** Porque é que o ack só acontece DEPOIS do processamento, nunca antes?

- a) É mais lento fazer assim, mas é tradição
- b) Se o worker morrer antes do ack, a mensagem é reentregue; fazer ack antes perderia o trabalho se o processo morresse a meio
- c) O RabbitMQ obriga a essa ordem por protocolo
- d) Não há diferença prática

<details><summary>Resposta</summary>

**b) Se o worker morrer antes do ack, a mensagem é reentregue; fazer ack antes perderia o trabalho se o processo morresse a meio** — Ack cedo + morte do processo = efeito nunca aconteceu, mas o broker pensa que sim.

</details>

**5.** O que é o 'dual-write problem' aplicado ao RabbitMQ, neste projeto?

- a) Publicar a mesma mensagem duas vezes de propósito
- b) A BD pode ser escrita com sucesso e a publicação no RabbitMQ falhar (ou o inverso), sem uma transação comum aos dois
- c) Um bug de duplicação no worker
- d) Duas filas com o mesmo nome a competir

<details><summary>Resposta</summary>

**b) A BD pode ser escrita com sucesso e a publicação no RabbitMQ falhar (ou o inverso), sem uma transação comum aos dois** — Resolve-se com o padrão outbox: gravar o evento na mesma transação SQL da mudança.

</details>

<!-- quiz:end -->
