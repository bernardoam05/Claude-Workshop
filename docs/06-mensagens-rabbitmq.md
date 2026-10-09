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

Soluções (discutimos no módulo 12):

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
