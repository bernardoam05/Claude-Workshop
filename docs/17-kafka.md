# 17 · Kafka

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

**Porque a chave importa:** o Kafka só garante ordem **dentro de uma partição**. Com chave = `userId`, todos os eventos de um utilizador ficam na mesma partição, por ordem: o `task.created` vem sempre antes do `task.completed` da mesma tarefa. Sem chave, as mensagens espalham-se e a ordem perde-se (era o problema P5 do módulo 12).

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

**Consumer lag** = (último offset do tópico) − (offset do grupo). É **a** métrica de saúde de um consumidor Kafka: se cresce sempre, o consumidor não está a acompanhar. Está no dashboard do Grafana e há um alerta para ela (módulo 19).

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

## Prática: escreve tu

As três ideias centrais deste módulo (a chave decide a partição, o grupo divide as partições, o offset marca até onde se leu) são algoritmos pequenos. Escreve-os, e deixam de ser "magia do Kafka". Nenhum exercício precisa do Kafka a correr; o primeiro compara o teu código com o `kafkajs`, o cliente que a API usa.

**Verificar:** `npm run verificar 17` (dentro de `pratica/`). Só um exercício: `npm run verificar 17 particionador`, `... 17 atribuicao` ou `... 17 processador`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · O particionador: que partição recebe esta chave? (≈40 min)

**Ficheiro:** `pratica/17-kafka/particionador.js`

A secção 3 diz que "o mesmo `userId` vai sempre para a mesma partição". Quem decide é um hash, o **MurmurHash2**, igual em todos os clientes Kafka (Java, Node, Go...). Se dois clientes usassem hashes diferentes, a mesma chave podia ir parar a partições diferentes e a ordem perdia-se. Os testes usam os valores de teste do **próprio Kafka** (em Java) e comparam 300 chaves com o `kafkajs`.

O algoritmo, passo a passo (todas as contas em inteiros de **32 bits**, como o `int` do Java):

1. Converte a chave para bytes UTF-8 (`Buffer.from(chave, 'utf8')`). `n` é o número de **bytes**, não de caracteres.
2. `h = 0x9747b28c ^ n`.
3. Para cada bloco de 4 bytes `b0 b1 b2 b3`: `k = b0 | b1<<8 | b2<<16 | b3<<24`; `k = k * M`; `k = k ^ (k >>> 24)`; `k = k * M`; `h = h * M`; `h = h ^ k` (com `M = 0x5bd1e995`).
4. Os 1 a 3 bytes que sobram: se sobram 3, `h ^= b2 << 16`; se sobram 2 ou mais, `h ^= b1 << 8`; se sobra 1 ou mais, `h ^= b0` e depois `h = h * M`.
5. No fim: `h ^= h >>> 13`; `h = h * M`; `h ^= h >>> 15`.
6. A partição é `(h & 0x7fffffff) % numeroDeParticoes`.

A armadilha está nos "32 bits". Em JavaScript, `k * M` dá um número enorme (até 2⁶²) e perde precisão, e o resultado sai errado. A multiplicação tem de "dar a volta" como em Java: é isso que o `Math.imul(k, M)` faz.

**Sintaxe que vais praticar:** operadores bit a bit (`^`, `|`, `&`, `<<`, `>>>`), `Math.imul`, `Buffer` como array de bytes, `switch` com casos que "caem" para o seguinte (sem `break`), `| 0` para obter um inteiro de 32 bits com sinal.

<details>
<summary>Pista</summary>

Se os teus valores estiverem "quase certos" (o sinal ou os últimos dígitos errados), procura um `*` que devia ser `Math.imul`. Se só as chaves com acentos falharem, estás a contar caracteres (`chave.length`) em vez de bytes (`bytes.length`).
</details>

<details>
<summary>Solução de referência</summary>

```js
const SEMENTE = 0x9747b28c;
const M = 0x5bd1e995;
const R = 24;

// MurmurHash2 em aritmética de 32 bits, como em Java (int). Em JavaScript os números são reais de
// 64 bits; Math.imul multiplica como um int de 32 bits (deita fora o que transborda), e os
// operadores bit a bit (^, >>>, |0) trabalham sempre em 32 bits. É isso que imita o Java.
export function murmur2(chave) {
  const bytes = Buffer.from(chave, 'utf8');
  const n = bytes.length;
  let h = SEMENTE ^ n;

  // Blocos de 4 bytes, lidos como um inteiro little-endian.
  const blocos = Math.floor(n / 4);
  for (let i = 0; i < blocos; i++) {
    const j = i * 4;
    let k = bytes[j] | (bytes[j + 1] << 8) | (bytes[j + 2] << 16) | (bytes[j + 3] << 24);
    k = Math.imul(k, M);
    k ^= k >>> R;
    k = Math.imul(k, M);
    h = Math.imul(h, M);
    h ^= k;
  }

  // Os 1 a 3 bytes que sobram. O switch "cai" de um case para o seguinte de propósito (sem break).
  const resto = n & ~3;
  switch (n % 4) {
    case 3:
      h ^= bytes[resto + 2] << 16;
    // falls through
    case 2:
      h ^= bytes[resto + 1] << 8;
    // falls through
    case 1:
      h ^= bytes[resto];
      h = Math.imul(h, M);
  }

  h ^= h >>> 13;
  h = Math.imul(h, M);
  h ^= h >>> 15;
  return h | 0; // | 0 converte para inteiro de 32 bits com sinal, como o int do Java
}

export function particao(chave, numeroDeParticoes) {
  return (murmur2(chave) & 0x7fffffff) % numeroDeParticoes;
}
```
</details>

### P2 · Dividir partições por um consumer group (≈25 min)

**Ficheiro:** `pratica/17-kafka/atribuicao.js`

A secção 4 explica que, num consumer group, cada partição é lida por **um só** consumidor. Escreve as duas estratégias clássicas de divisão: **range** (blocos contíguos) e **round-robin** (uma a uma, à vez). Um dos testes reproduz a situação do projeto com um consumidor a mais: 3 partições e 4 consumidores. O quarto fica **parado**. Mais consumidores do que partições não dá mais velocidade.

**Sintaxe que vais praticar:** `toSorted()` (ordenar sem alterar o original), `Object.fromEntries`, `Math.floor` e `%`, `forEach` com índice.

<details>
<summary>Solução de referência</summary>

```js
// toSorted (e não sort): devolve uma cópia ordenada, sem mexer na lista original.
const vazio = (consumidores) => Object.fromEntries(consumidores.map((c) => [c, []]));

export function atribuirRange(numeroDeParticoes, consumidores) {
  const ordenados = consumidores.toSorted();
  const resultado = vazio(ordenados);
  const base = Math.floor(numeroDeParticoes / ordenados.length);
  const extra = numeroDeParticoes % ordenados.length; // os primeiros `extra` recebem mais uma

  let proxima = 0;
  ordenados.forEach((consumidor, i) => {
    const quantas = base + (i < extra ? 1 : 0);
    for (let k = 0; k < quantas; k++) resultado[consumidor].push(proxima++);
  });
  return resultado;
}

export function atribuirRoundRobin(numeroDeParticoes, consumidores) {
  const ordenados = consumidores.toSorted();
  const resultado = vazio(ordenados);
  for (let p = 0; p < numeroDeParticoes; p++) {
    resultado[ordenados[p % ordenados.length]].push(p); // % dá a volta: 0, 1, 2, 0, 1, 2...
  }
  return resultado;
}
```
</details>

### P3 · Offsets, tentativas e Dead Letter Topic (≈35 min)

**Ficheiro:** `pratica/17-kafka/processadorDeParticao.js`

O coração de um consumidor Kafka: processar as mensagens de uma partição **por ordem**, tentar outra vez quando algo falha, mandar para o DLT o que não tem remédio (secção 6), e dizer **até onde** se pode fazer commit (secção 5).

Dois detalhes que os testes verificam e que costumam sair mal:

- no Kafka, o commit é do **próximo** offset a ler (o último processado + 1), não do último processado;
- se nem o DLT aceitar a mensagem, **não se pode saltar** para a seguinte: perdia-se a mensagem. Para-se ali, e o commit fica antes dela, para ser relida depois.

**Sintaxe que vais praticar:** `for...of` com `await` (sequencial, de propósito), um `for` de tentativas com `break`, `try`/`catch` encaixados, `break` para sair do ciclo de fora.

<details>
<summary>Pista</summary>

Porque é que não se pode usar `await Promise.all(mensagens.map(handle))`? Porque corria todas ao mesmo tempo, e a ordem da partição (que é a razão de existir da chave) perdia-se. O último teste mede isso mesmo.
</details>

<details>
<summary>Solução de referência</summary>

```js
export async function processarParticao(mensagens, { handle, enviarParaDlt, maxTentativas = 3 }) {
  const processadas = [];
  const paraDlt = [];
  let offsetParaCommit = null;

  // for...of com await: uma mensagem de cada vez, pela ordem. Um .map com async lançava-as todas
  // ao mesmo tempo e a ordem da partição perdia-se.
  for (const mensagem of mensagens) {
    let ultimoErro = null;
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
      try {
        await handle(mensagem);
        ultimoErro = null;
        break;
      } catch (err) {
        ultimoErro = err;
      }
    }

    if (ultimoErro === null) {
      processadas.push(mensagem.offset);
    } else {
      try {
        await enviarParaDlt(mensagem, ultimoErro);
        paraDlt.push(mensagem.offset);
      } catch {
        break; // não a podemos saltar sem a guardar em lado nenhum: paramos, e o commit fica antes dela
      }
    }
    offsetParaCommit = mensagem.offset + 1; // commit = "a próxima que quero ler"
  }

  return { offsetParaCommit, processadas, paraDlt };
}
```

Compara com o consumidor Java em `src/activity`: lá, as tentativas e o DLT são configurados num `DefaultErrorHandler` do Spring Kafka, e não escritos à mão. A lógica é esta.
</details>

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

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 17`.

**1.** Qual a diferença principal entre uma fila (RabbitMQ) e um log (Kafka)?

- a) Não há diferença real entre os dois
- b) No RabbitMQ a mensagem é apagada após o ack; no Kafka fica no log até ao fim da retenção, e cada consumidor guarda o seu próprio offset
- c) Kafka só funciona com aplicações Java
- d) RabbitMQ não tem o conceito de filas

<details><summary>Resposta</summary>

**b) No RabbitMQ a mensagem é apagada após o ack; no Kafka fica no log até ao fim da retenção, e cada consumidor guarda o seu próprio offset** — É por isso que um consumer group novo no Kafka pode reler todo o histórico desde o início.

</details>

**2.** Porque é que a chave usada na publicação para o Kafka é o userId?

- a) É só o campo mais pequeno disponível para servir de chave
- b) Garante que todos os eventos do mesmo utilizador vão para a MESMA partição, preservando a ordem entre eles
- c) O Kafka exige obrigatoriamente uma chave numérica
- d) Reduz o tamanho total da mensagem

<details><summary>Resposta</summary>

**b) Garante que todos os eventos do mesmo utilizador vão para a MESMA partição, preservando a ordem entre eles** — O Kafka só garante ordem DENTRO de uma partição; a chave decide a partição.

</details>

**3.** Com N partições num tópico, qual é o paralelismo MÁXIMO de UM consumer group?

- a) Sempre 1, independentemente de N
- b) Igual ao número de partições (N)
- c) Ilimitado, não depende das partições
- d) Igual ao número de brokers do cluster

<details><summary>Resposta</summary>

**b) Igual ao número de partições (N)** — Com mais instâncias do que partições, as excedentes ficam sem nenhuma partição atribuída.

</details>

**4.** Porque é uma mensagem envenenada especialmente perigosa no Kafka, mais do que no RabbitMQ?

- a) Não é mais perigosa, o comportamento é idêntico
- b) O Kafka entrega por ordem dentro da partição: enquanto não avançar, bloqueia TODAS as mensagens seguintes dessa partição
- c) O Kafka apaga automaticamente mensagens inválidas
- d) Só afeta o produtor, nunca o consumidor

<details><summary>Resposta</summary>

**b) O Kafka entrega por ordem dentro da partição: enquanto não avançar, bloqueia TODAS as mensagens seguintes dessa partição** — É por isso que existe o Dead Letter Topic: avançar o offset sem perder a mensagem problemática.

</details>

**5.** O que significa 'idempotent: true' no produtor Kafka deste projeto?

- a) Garante exactly-once em todo o sistema, ponta a ponta
- b) Evita que retries de REDE do próprio produtor dupliquem a mensagem NO BROKER — não cobre falhas depois disso (ex.: numa BD externa)
- c) Ativa compressão automática das mensagens
- d) É exatamente o mesmo que 'acks: all'

<details><summary>Resposta</summary>

**b) Evita que retries de REDE do próprio produtor dupliquem a mensagem NO BROKER — não cobre falhas depois disso (ex.: numa BD externa)** — Exactly-once ponta a ponta continua a exigir idempotência do lado do consumidor.

</details>

<!-- quiz:end -->
