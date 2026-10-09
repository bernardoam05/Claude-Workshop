# 16 · Kafka

**Objetivo:** perceber o modelo do Kafka (um **log**, não uma fila), porque é tão pedido nas empresas, e em que é diferente do RabbitMQ que já conheces.

**Ficheiros para ler:** `src/api/src/messaging/kafkaPublisher.js`, `src/api/src/messaging/compositePublisher.js`, `src/activity/src/main/java/pt/workshop/activity/events/TaskEventListener.java`, `src/activity/.../config/KafkaConfig.java`, serviços `kafka`, `kafka-init` e `kafka-ui` no compose.

**Interfaces:** Kafka UI em `http://localhost:8089` (tópicos, partições, mensagens, consumer groups).

---

## 1. O que mudou na arquitetura

```
                       ┌──► RabbitMQ ──► worker (Node/TS)       → task_events     (obrigatório)
API Node ── evento ────┤
                       └──► Kafka "task-events" ──► activity (Java/Spring) → activity.activity_events (best-effort)
                              3 partições, chave = userId
```

O **mesmo evento** vai para os dois brokers. Num sistema real escolherias um, mas aqui serve para os comparares lado a lado.

## 2. A diferença fundamental: fila vs log

| | RabbitMQ (fila) | Kafka (log) |
|---|---|---|
| Depois de consumida, a mensagem... | é **apagada** (ack) | **fica** (até ao fim da retenção: 7 dias aqui) |
| Quem guarda "onde vou"? | o broker (mensagens por confirmar) | o **consumidor** (offset por partição) |
| Novo consumidor quer o histórico | impossível, já foi apagado | começa no offset 0 e relê tudo |
| Ordem | por fila (mas com vários consumidores, perde-se) | **por partição**, garantida |
| Encaminhamento | exchanges, bindings, padrões (`task.*`) | só tópico + partição |
| Escalar consumidores | mais consumidores na mesma fila | mais consumidores no mesmo **grupo**, até ao nº de partições |
| Pensa nele como | caixa de tarefas | diário imutável de factos |

**Experiência que só o Kafka permite:** o serviço `activity` foi criado **depois** de já existirem eventos? Não importa: com `auto-offset-reset: earliest`, um consumer group novo lê o tópico desde o início. Muda o `group-id` em `application.yml` para `activity-service-v2`, reconstrói, e vê o serviço reprocessar todo o histórico (a idempotência evita duplicados).

## 3. Tópicos, partições e chaves

- **Tópico:** nome lógico (`task-events`).
- **Partição:** o tópico é dividido em N logs independentes (aqui 3). Cada mensagem tem um **offset** (posição) dentro da sua partição.
- **Chave:** decide a partição (`hash(chave) % 3`). Usamos `userId` (`kafkaPublisher.js`).

**Porque a chave importa:** o Kafka só garante ordem **dentro de uma partição**. Com chave = `userId`, todos os eventos de um utilizador ficam na mesma partição, por ordem: o `task.created` vem sempre antes do `task.completed` da mesma tarefa. Sem chave, as mensagens espalham-se e a ordem perde-se (era o problema P5 do módulo 11).

**Armadilha:** chaves mal distribuídas criam **partições quentes**. Se 90% dos eventos forem de um cliente gigante, uma partição recebe 90% da carga e um único consumidor fica sobrecarregado, enquanto os outros estão parados.

Vê isto acontecer: no Kafka UI → Topics → `task-events` → Messages, repara nas colunas Partition, Offset e Key. Os logs do `activity` também mostram `partição=…, offset=…`, e a tabela `activity.activity_events` guarda ambos.

## 4. Consumer groups

```
tópico task-events:   [P0] [P1] [P2]
grupo activity-service:  └─ instância A lê P0, P1, P2   (1 instância)
                         └─ A: P0   B: P1   C: P2       (3 instâncias)
                         └─ A: P0   B: P1   C: P2   D: (parada!)  (4 instâncias: uma a mais)
```

- Todas as instâncias com o mesmo `group-id` **dividem** as partições entre si.
- **Nº de partições = paralelismo máximo** de um grupo. É por isso que se escolhe o nº de partições a pensar no futuro, porque aumentá-lo depois muda o mapeamento chave → partição.
- Grupos diferentes são **independentes**: cada um tem os seus offsets e recebe tudo. É assim que vários serviços leem o mesmo tópico sem se atrapalharem.
- **Rebalance:** quando uma instância entra ou sai, as partições são redistribuídas. Durante esse momento o consumo pára brevemente.

Experiência: `docker compose ... up -d --scale activity=3`. No Kafka UI → Consumers → `activity-service`, vê que partição ficou com cada instância. Depois tenta `--scale activity=4`.

## 5. Offsets e commits: "pelo menos uma vez", outra vez

O consumidor diz ao Kafka "já processei até ao offset X" (**commit**). O Spring faz commit **depois** de o método `onMessage` terminar sem erro. Se o serviço morrer entre processar e fazer commit, ao voltar relê a partir do último commit: a mensagem é processada **outra vez**.

É o mesmo *at-least-once* do RabbitMQ, e a resposta é a mesma: **idempotência**. O `ActivityEventRepository.insertIfAbsent` usa `ON CONFLICT (event_id) DO NOTHING`, tal como o worker.

**Consumer lag** = (último offset do tópico) − (offset do grupo). É **a** métrica de saúde de um consumidor Kafka: se cresce sempre, o consumidor não está a acompanhar. Está no dashboard do Grafana e há um alerta para ela (módulo 18).

## 6. Erros: Dead Letter Topic

O Kafka entrega por ordem dentro de uma partição. Se uma mensagem falhar sempre, **bloqueia a partição inteira**: a seguinte nunca é lida. Por isso não basta "tentar outra vez".

`KafkaConfig.java` define:
- erro transitório → 2 novas tentativas com 1 s de intervalo;
- se continuar a falhar, ou se for `MalformedEventException` (permanente) → publica em `task-events.DLT` e **avança**.

É a mesma ideia da DLQ do RabbitMQ (módulo 06), com uma diferença: no Kafka não há `nack`. O "envio para a DLT" é uma nova publicação feita pelo próprio consumidor.

Experiência: no Kafka UI → Topics → `task-events` → Produce Message, envia `isto não é json`. Vê os logs do `activity` e depois a mensagem em `task-events.DLT`, com cabeçalhos que dizem a exceção e a origem.

## 7. Garantias do produtor

`kafkaPublisher.js`:
- `acks: -1` ("all"): o broker só confirma quando todas as réplicas em sincronia gravaram. Com `acks: 1`, um broker que morre logo a seguir pode perder a mensagem.
- `idempotent: true`: se um envio for repetido por um retry de rede, o broker deteta o duplicado. Atenção: isto **não** torna o sistema inteiro *exactly-once*. Só evita duplicados **entre o produtor e o broker**.

**Exactly-once** existe no Kafka (transações), mas só dentro do próprio Kafka (ler de um tópico, escrever noutro). Assim que há uma BD externa pelo meio, voltas a precisar de idempotência. Desconfia de quem promete *exactly-once* de ponta a ponta.

## 8. Best-effort e o dual-write, pior

A API agora escreve em **três** sítios: Postgres, RabbitMQ e Kafka. Decidimos (`compositePublisher.js`):
- RabbitMQ falha → o pedido falha (500).
- Kafka falha ou demora mais de 2 s → regista, conta numa métrica (`events_published_total{broker="kafka",result="error"}`) e **segue**.

O timeout não estava lá na primeira versão. Durante os testes, um pedido ficou pendurado, e percebemos que "opcional" sem limite de tempo pode derrubar a funcionalidade principal. Há um teste para isto em `compositePublisher.test.js`.

A forma correta, sem perdas, é o **outbox** (módulo 06): grava o evento na mesma transação da tarefa, e um processo separado publica no Kafka. Na indústria isto faz-se muitas vezes com **Debezium** (Change Data Capture), que lê o log de transações do Postgres e publica no Kafka sem uma linha de código na aplicação.

## 9. Ferramentas da linha de comandos

```bash
K="docker compose -f config/docker-compose.yml exec kafka /opt/kafka/bin"
$K/kafka-topics.sh --bootstrap-server localhost:9092 --list
$K/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic task-events
$K/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic task-events --from-beginning \
   --property print.key=true --property print.partition=true --property print.offset=true
$K/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group activity-service   # LAG por partição
```

## 10. Nota honesta sobre o cliente Node

Usamos `kafkajs` porque é JavaScript puro e simples de ler. Mas **não é atualizado desde 2023**. Em projetos novos, a Confluent recomenda `@confluentinc/kafka-javascript` (baseado em librdkafka, com API compatível). Em Java, o cliente oficial (usado pelo Spring Kafka) é a referência.

## 11. Kafka no ecossistema

- **Schema Registry + Avro/Protobuf:** contratos de mensagens versionados e validados. Muito usado em empresas grandes, porque JSON livre (como aqui) parte quando alguém muda um campo.
- **Kafka Connect:** conectores prontos (BD → Kafka, Kafka → Elasticsearch, S3...).
- **Kafka Streams / Flink:** processamento de streams (agregações, janelas de tempo, joins entre tópicos).
- **Serviços geridos:** Confluent Cloud, AWS MSK, Azure Event Hubs (compatível com o protocolo Kafka).
- **Redpanda:** alternativa compatível com o Kafka, num só binário.

---

## Perguntas de pensamento crítico

1. Porque é que a chave é `userId` e não `task.id`? O que ganhavas e perdias com `task.id`?
2. O tópico tem 3 partições. Queres 10 instâncias do `activity`. O que acontece? O que farias?
3. Um colega diz: "vamos trocar o RabbitMQ pelo Kafka em todo o lado, assim só temos um broker". Quando concordas e quando não?
4. O `activity` esteve parado 2 dias. Ao voltar, perdeu eventos? E se tivesse estado parado 10 dias?

<details>
<summary>Respostas</summary>

1. Com `userId`, a ordem é garantida **por utilizador**, o que permite por exemplo um feed de atividade ordenado. Com `task.id`, a ordem seria garantida só por tarefa (suficiente para created → completed), e a distribuição seria mais uniforme, porque um utilizador muito ativo não aqueceria uma partição. A escolha depende da ordem de que o negócio precisa.
2. Só 3 instâncias recebem partições; as outras 7 ficam paradas (e servem só de reserva). É preciso aumentar as partições, sabendo que isso muda o mapeamento chave → partição e quebra temporariamente a ordem para chaves que mudam de partição.
3. Concordas se precisas de reprocessar histórico, de vários consumidores independentes ou de volume muito alto, e se a equipa sabe operar Kafka. Não concordas se o caso é "filas de tarefas" com routing flexível, prioridades, TTL por mensagem e DLQ simples (onde o RabbitMQ é mais natural), ou se a equipa é pequena. Um broker a menos para operar é um argumento real, mas não é o único.
4. Em 2 dias não perdeu nada: a retenção é de 7 dias, e o grupo continua no seu offset, por isso lê o atraso todo (o lag vai estar alto durante uns minutos). Em 10 dias, as mensagens com mais de 7 dias já foram apagadas e perdem-se. A retenção é uma decisão de negócio, e há alertas de lag precisamente para não chegar a este ponto.
</details>
