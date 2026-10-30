# 47 · Observabilidade: logs estruturados e traces com OpenTelemetry

**Objetivo:** completar a observabilidade dos módulos 11 e 19 com as duas peças que faltam: **logs estruturados** que se pesquisam e se ligam entre serviços, e **traces distribuídos** que mostram, passo a passo, onde um pedido passou o tempo, através de vários serviços. A ferramenta padrão da indústria para isto é o **OpenTelemetry**.

**Ficheiros para ler:** `src/api/src/observability/metrics.js` (as métricas do módulo 19) e o middleware de `X-Request-Id` do P3 do módulo 01.

**Pré-requisitos:** módulos 11 (logs, health checks) e 19 (métricas), e o módulo 06 (um pedido que atravessa a API, o RabbitMQ e o worker).

---

## 1. Os três pilares, e quando cada um responde

| Pilar | Pergunta a que responde | Exemplo | Ferramentas |
|---|---|---|---|
| **Métricas** (módulo 19) | **Quanto?** e **Quando começou?** Números agregados no tempo | "a latência p95 subiu para 2 s às 14h03" | Prometheus, Grafana |
| **Logs** | **O que aconteceu** neste caso concreto? | "o pedido r-81 falhou: timeout ao Redis" | Loki, Elasticsearch/OpenSearch, CloudWatch Logs |
| **Traces** | **Onde** é que este pedido passou o tempo, e em que serviço falhou? | "dos 2 s, 1,8 s foram numa query ao Postgres no serviço de stock" | Jaeger, Tempo, Zipkin, Honeycomb, Datadog |

Um incidente típico usa os três por ordem: um **alerta** sobre uma métrica avisa que algo está mal; os **traces** dos pedidos lentos mostram em que serviço e em que operação; os **logs** desse pedido mostram a mensagem de erro exata. Para isso funcionar, os três têm de estar **ligados** pelos mesmos identificadores, e é isso que este módulo ensina.

## 2. Logs estruturados

Um log em texto livre é fácil de escrever e difícil de usar:

```
2026-10-29 10:00:01 ERROR Falhou o pedido do utilizador 42 ao criar tarefa: timeout
```

Para encontrar "todos os erros do utilizador 42 na última hora", tens de escrever expressões regulares frágeis. Um log **estruturado** é um objeto JSON por linha:

```json
{"ts":"2026-10-29T10:00:01.123Z","nivel":"error","msg":"falhou a criar a tarefa","servico":"api","utilizador_id":42,"pedido_id":"r-81","erro":{"nome":"TimeoutError","mensagem":"redis timeout"},"trace_id":"4bf92f35..."}
```

Cada campo pesquisa-se e filtra-se diretamente (`nivel = error AND utilizador_id = 42`), e conta-se e agrupa-se como numa base de dados. Regras para bons logs:

- **Uma mensagem fixa e campos variáveis.** `msg: "falhou a criar a tarefa"` com `utilizador_id: 42`, e não `"falhou a tarefa do utilizador 42"`. Assim, todas as ocorrências têm a mesma mensagem e agrupam-se.
- **Níveis com significado:** `error` (algo falhou e precisa de atenção), `warn` (estranho, mas tratado), `info` (eventos de negócio: "tarefa criada"), `debug` (detalhe, desligado em produção).
- **Contexto em todas as linhas de um pedido:** o id do pedido, o id do utilizador, o trace id. Um logger "filho" com esses campos, criado no início de cada pedido, trata disso.
- **Nunca registes segredos nem dados pessoais desnecessários:** passwords, tokens, cookies, números de cartão. Os logs são lidos por muito mais gente do que a base de dados e ficam guardados durante meses. A melhor defesa é o logger esconder esses campos sozinho (o P1).
- **Escreve para o stdout.** Numa app em contentores, quem recolhe e envia os logs para o sistema central é a plataforma (o Docker, o Kubernetes, um agente como o Fluent Bit ou o Promtail), e não a app.

Em Node, as bibliotecas mais usadas são o **pino** (muito rápido) e o **winston**. No P1 escreves um pequeno, para perceberes o que elas fazem.

## 3. Traces distribuídos

Um pedido a um sistema com vários serviços passa por muitos sítios: o Nginx, a API, o Redis, o Postgres, uma mensagem no RabbitMQ, o worker, outra base de dados. Quando demora 3 segundos, onde está o tempo?

Um **trace** é a história completa de um pedido, e é feito de **spans**. Cada span é uma operação com início, fim, um nome e atributos, e aponta para o seu **span pai**:

```
trace 4bf92f35...                                                    0 ms ─────────── 2 000 ms
└─ api: POST /api/orders                                             ████████████████████████
   ├─ postgres: INSERT orders                                        ██
   ├─ stock: GET /stock   (outro serviço, outra máquina)                ██████████████████
   │  └─ postgres: SELECT stock WHERE ...  (sem índice!)                  ████████████████
   └─ rabbitmq: publish order.created                                                   █
```

Num ecrã como este (o Jaeger ou o Grafana Tempo mostram exatamente isto), vê-se logo que o problema é uma query no serviço de stock. Os conceitos:

| Conceito | O que é |
|---|---|
| **Trace id** | 16 bytes (32 caracteres hex), iguais em todos os spans do pedido, em todos os serviços |
| **Span id** | 8 bytes, um por operação |
| **Atributos** | pares chave-valor: `http.method`, `db.statement`, `encomenda.id` |
| **Eventos** | coisas pontuais dentro de um span: "exceção", "retry", "notificação falhou" |
| **Estado** | `OK`, `ERROR` ou por definir |

## 4. OpenTelemetry

O **OpenTelemetry** (OTel) é o padrão aberto (da CNCF, a mesma fundação do Kubernetes) para produzir traces, métricas e logs, em qualquer linguagem, e enviá-los para qualquer ferramenta. Antes dele, cada fornecedor tinha a sua biblioteca, e mudar de ferramenta era reescrever a instrumentação. As peças:

- **API:** o que o teu código usa (`trace.getTracer(...)`, `startActiveSpan`). Não faz nada sozinha: sem um SDK configurado, os spans não vão para lado nenhum, e não custam quase nada.
- **SDK:** configurado uma vez, no arranque: que spans guardar (amostragem), como os agrupar, e para onde os enviar.
- **Exportadores:** enviam para um destino, normalmente pelo protocolo **OTLP**.
- **Collector:** um serviço intermediário que recebe a telemetria de todas as apps, a filtra e amostra, e a envia para um ou vários destinos. Assim, mudar de ferramenta é mudar a configuração do collector, e não as apps.
- **Instrumentação automática:** pacotes que criam spans sozinhos para o HTTP, o Express, o `pg`, o Redis, o `amqplib`... Em Node, `@opentelemetry/auto-instrumentations-node`; em Java, um *agent* que se junta à JVM sem mudar código; em .NET, o `OpenTelemetry.Extensions.Hosting`. Os spans manuais (como no P2) são para a lógica de negócio que só tu conheces.

A configuração típica numa app Node, no arranque, antes de importar o resto:

```js
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

new NodeSDK({
  serviceName: 'api',
  traceExporter: new OTLPTraceExporter({ url: 'http://jaeger:4318/v1/traces' }),
  instrumentations: [getNodeAutoInstrumentations()],
}).start();
```

## 5. Propagação: o trace que atravessa serviços

Como é que o serviço de stock sabe que o pedido dele faz parte do trace da API? Pelo cabeçalho **`traceparent`**, do padrão W3C Trace Context:

```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
             ↑  ↑ trace id (32 hex)               ↑ span id do pai   ↑ flags (01 = amostrado)
             versão
```

Quem chama **injeta** o cabeçalho com o seu contexto (o trace id e o span ativo); quem recebe **extrai-o** e cria os seus spans como filhos. Com a instrumentação automática, isto acontece sozinho em todas as chamadas HTTP. Nas mensagens (RabbitMQ, Kafka, SQS), o `traceparent` vai nos cabeçalhos da mensagem, e o trace atravessa a fila até ao worker: a API e o worker do módulo 06 apareceriam no mesmo trace.

O que torna o "span ativo" possível em Node, sem o passares de função em função, é o **AsyncLocalStorage**: um contexto que segue o código através dos `await` e dos callbacks. É o que o `otel.js` da prática configura, e é por isso que, no P1, o logger sabe o trace id sem ninguém lho dar.

## 6. Amostragem

Um sistema com 10 000 pedidos por segundo, com 20 spans cada, produz 200 000 spans por segundo. Guardá-los todos custa uma fortuna e quase ninguém os vai ver. Por isso, **amostra-se**:

- **Na cabeça** (*head sampling*): a decisão é tomada no início do pedido ("guardo 1%"), e viaja no `traceparent` (o bit "amostrado"), para todos os serviços tomarem a mesma decisão. É barato, mas decide às cegas: o pedido raro que falhou tem 99% de probabilidade de não ser guardado.
- **Na cauda** (*tail sampling*): o collector espera que o trace termine e decide com base no que aconteceu: guarda **todos** os traces com erros ou lentos, e só uma amostra dos normais. É o que se quer, mas exige guardar os traces em memória até acabarem.

Para a decisão ser a mesma em todos os serviços sem comunicação entre eles, calcula-se a partir do próprio trace id (que é aleatório): "amostro se os últimos 64 bits do trace id forem menores do que taxa × 2^64". É o P4.

## 7. Juntar tudo

- O logger põe o `trace_id` em cada linha: de um trace lento, saltas para os logs desse pedido; de um log de erro, saltas para o trace.
- As métricas guardam **exemplars**: de um pico no gráfico de latência, um clique leva a um trace concreto desse pico.
- O mesmo `trace_id` volta ao cliente num cabeçalho, ou numa página de erro ("refere este código ao apoio ao cliente"), para se encontrar o pedido exato de quem se queixa.

Para este projeto, os passos seriam: o `NodeSDK` com a instrumentação automática na API e no worker, o *agent* do OpenTelemetry no Spring (`activity`) e o pacote do .NET em `notifications`, um Jaeger (ou o Tempo, ao lado do Grafana do módulo 19) no compose, e o `trace_id` nos logs. São os exercícios D13 e D16 do módulo 12.

---

## Prática: escreve tu

Quatro peças de observabilidade: um logger estruturado (com segredos escondidos e ligação aos traces), spans à volta de um processo de negócio (incluindo os erros), um trace que atravessa dois serviços HTTP com o `traceparent`, e uma decisão de amostragem determinista. Os testes usam o SDK do OpenTelemetry a sério, configurado no `otel.js` com um exportador em memória, e leem os spans que o teu código produziu.

**Ficheiros:** `pratica/47-observabilidade-otel/` (`logger.js`, `tracing.js`, `propagacao.js`, `amostragem.js`). O `otel.js` já está feito.

**Verificar:** `npm run verificar 47` (dentro de `pratica/`). Só um exercício: `npm run verificar 47 logger`, `... 47 tracing`, `... 47 propagacao` ou `... 47 amostragem`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Um logger estruturado (≈30 min)

**Ficheiro:** `logger.js`

Uma linha JSON por evento, com níveis, campos base, loggers filhos, segredos escondidos a qualquer profundidade, erros legíveis, e o `trace_id`/`span_id` do span ativo.

**Sintaxe que vais praticar:** uma função que devolve um objeto de funções (uma fábrica), *closures*, uma função recursiva sobre objetos e arrays, `Object.entries`/`Object.fromEntries`, `instanceof Error`, `trace.getActiveSpan()`.

<details>
<summary>Pista</summary>

Escreve primeiro uma função `limparValor(v)` recursiva: se for um `Error`, devolve o objeto legível; se for um array, aplica-se a cada elemento; se for um objeto, percorre as chaves e troca as sensíveis por `"[REDACTED]"`; senão, devolve o valor. O `JSON.stringify` de um `Error` dá `{}`, porque as propriedades `message` e `stack` não são enumeráveis.
</details>

<details>
<summary>Solução de referência</summary>

```js
import { trace } from '@opentelemetry/api';

const NIVEIS = { debug: 10, info: 20, warn: 30, error: 40 };
const SENSIVEIS = new Set(['password', 'senha', 'token', 'authorization', 'cookie']);

// Percorre o valor e devolve uma cópia sem segredos e com os Error legíveis.
function limparValor(valor) {
  if (valor instanceof Error) return { nome: valor.name, mensagem: valor.message, stack: valor.stack };
  if (Array.isArray(valor)) return valor.map(limparValor);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, SENSIVEIS.has(k.toLowerCase()) ? '[REDACTED]' : limparValor(v)]),
    );
  }
  return valor;
}

export function criarLogger({ nivel = 'info', escrever = (l) => process.stdout.write(`${l}\n`), agora = () => new Date(), base = {} } = {}) {
  const minimo = NIVEIS[nivel];

  const registar = (n) => (msg, campos = {}) => {
    if (NIVEIS[n] < minimo) return;
    const span = trace.getActiveSpan();
    const ligacao = span ? { trace_id: span.spanContext().traceId, span_id: span.spanContext().spanId } : {};
    escrever(JSON.stringify({ ts: agora().toISOString(), nivel: n, msg, ...limparValor({ ...base, ...campos }), ...ligacao }));
  };

  return {
    debug: registar('debug'),
    info: registar('info'),
    warn: registar('warn'),
    error: registar('error'),
    filho: (campos) => criarLogger({ nivel, escrever, agora, base: { ...base, ...campos } }),
  };
}
```
</details>

### P2 · Spans à volta de um processo (≈25 min)

**Ficheiro:** `tracing.js`

Um ajudante `comSpan` que cria um span ativo, regista os erros e o termina sempre, e um processo de encomenda com um span por passo. Uma falha na notificação não pode desfazer uma encomenda paga, mas tem de ficar visível no trace.

**Sintaxe que vais praticar:** `tracer.startActiveSpan(nome, callback)`, `span.setAttributes`, `span.recordException`, `span.setStatus({ code: SpanStatusCode.ERROR })`, `span.addEvent`, `try/catch/finally` com `await`.

<details>
<summary>Pista</summary>

O `startActiveSpan` devolve o que o callback devolver, por isso podes fazer `return tracer.startActiveSpan(nome, async (span) => { ... })`. O `finally` garante o `span.end()` em todos os caminhos: com sucesso, com erro, e com `return` a meio.
</details>

<details>
<summary>Solução de referência</summary>

```js
import { SpanStatusCode, trace } from '@opentelemetry/api';

export const tracer = trace.getTracer('notas');

export async function comSpan(nome, atributos, fn) {
  return tracer.startActiveSpan(nome, async (span) => {
    span.setAttributes(atributos);
    try {
      return await fn(span);
    } catch (erro) {
      span.recordException(erro); // um evento "exception" com o tipo, a mensagem e o stack
      span.setStatus({ code: SpanStatusCode.ERROR, message: erro.message });
      throw erro;
    } finally {
      span.end(); // sem isto, o span nunca é exportado
    }
  });
}

export async function processarEncomenda(encomenda, { validar, cobrar, notificar }) {
  return comSpan('processar-encomenda', { 'encomenda.id': encomenda.id, 'encomenda.total': encomenda.total }, async (span) => {
    await comSpan('validar', {}, () => validar(encomenda));
    await comSpan('cobrar', {}, () => cobrar(encomenda));
    try {
      await comSpan('notificar', {}, () => notificar(encomenda));
    } catch {
      // A encomenda está paga: uma notificação falhada não a desfaz. Mas fica registada no trace.
      span.addEvent('notificacao-falhou');
    }
    return 'concluida';
  });
}
```
</details>

### P3 · Um trace entre dois serviços (≈30 min)

**Ficheiro:** `propagacao.js`

Ler um `traceparent` à mão (com as regras de validação do padrão), e depois pôr dois serviços HTTP no mesmo trace: a loja injeta o contexto nos cabeçalhos, o serviço de stock extrai-o e cria o seu span como filho.

**Sintaxe que vais praticar:** regex com grupos de captura, `parseInt(x, 16) & 1`, `propagation.inject`, `propagation.extract`, `startActiveSpan(nome, opcoes, contexto, callback)`.

<details>
<summary>Pista</summary>

O `startActiveSpan` tem uma forma com quatro argumentos: o nome, as opções (pode ser `{}`), o **contexto pai** (o que o `extract` devolveu), e o callback. Sem esse terceiro argumento, o span do stock começaria um trace novo.
</details>

<details>
<summary>Solução de referência</summary>

```js
import { context, propagation, trace } from '@opentelemetry/api';
import http from 'node:http';

const FORMATO = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export function lerTraceparent(valor) {
  const m = FORMATO.exec(valor ?? '');
  if (!m) return null;
  const [, versao, traceId, spanId, flags] = m;
  if (versao === 'ff' || /^0+$/.test(traceId) || /^0+$/.test(spanId)) return null;
  return { versao, traceId, spanId, amostrado: (parseInt(flags, 16) & 1) === 1 };
}

const tracer = trace.getTracer('notas');

export function criarServicoStock() {
  return http.createServer((req, res) => {
    // O contexto de quem chamou vem no cabeçalho traceparent; o extract transforma-o num Context.
    const pai = propagation.extract(context.active(), req.headers);
    tracer.startActiveSpan('stock: GET /stock', {}, pai, (span) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ traceId: span.spanContext().traceId }));
      span.end();
    });
  });
}

export async function consultarStock(url) {
  return tracer.startActiveSpan('loja: consultar-stock', async (span) => {
    try {
      const cabecalhos = {};
      propagation.inject(context.active(), cabecalhos); // escreve o traceparent com o span ativo
      const r = await fetch(url, { headers: cabecalhos });
      return await r.json();
    } finally {
      span.end();
    }
  });
}
```
</details>

### P4 · Amostragem (≈20 min)

**Ficheiro:** `amostragem.js`

A decisão de amostragem na cabeça, determinista a partir do trace id, e a decisão na cauda, que guarda sempre o que correu mal.

**Sintaxe que vais praticar:** `BigInt` (`2n ** 64n`, `BigInt("0x...")`), comparações entre BigInts, `Array.prototype.some`.

<details>
<summary>Pista</summary>

Os números do JavaScript só são exatos até 2^53, por isso um valor de 64 bits tem de ser um `BigInt`. E não se misturam `BigInt` e `Number` numa conta: converte a taxa para um inteiro (ex.: em milionésimos) antes de a multiplicares por `2n ** 64n`.
</details>

<details>
<summary>Solução de referência</summary>

```js
const DOIS_64 = 2n ** 64n;

export function deveAmostrar(traceId, taxa) {
  if (taxa <= 0) return false;
  if (taxa >= 1) return true;
  const valor = BigInt(`0x${traceId.slice(-16)}`);
  // taxa × 2^64, em inteiros: a taxa com 6 casas decimais chega para a amostragem.
  const limite = (BigInt(Math.round(taxa * 1e6)) * DOIS_64) / 1_000_000n;
  return valor < limite;
}

export function guardarTrace(spans, { taxa, lentoMs = 1000 }) {
  if (spans.some((s) => s.erro || s.duracaoMs >= lentoMs)) return true;
  return deveAmostrar(spans[0].traceId, taxa);
}
```
</details>

## Experiências

1. **Ver os teus spans no Jaeger:** arranca um Jaeger com `docker run -d --name jaeger -p 16686:16686 -p 4318:4318 jaegertracing/jaeger:2.11.0`. No `otel.js`, junta um segundo processador com um exportador OTLP (`npm install -D @opentelemetry/exporter-trace-otlp-http`; `new SimpleSpanProcessor(new OTLPTraceExporter({ url: 'http://localhost:4318/v1/traces' }))`) e corre os testes do P2 e do P3. Abre `http://localhost:16686`, escolhe o serviço e vê a cascata de spans.
2. **O contexto perde-se:** no P2, troca o `await comSpan('cobrar', ...)` por um `setTimeout(() => comSpan('cobrar', ...), 0)` (sem esperar). Onde aparece agora o span "cobrar" na árvore? Porquê?
3. **Logs com o pino:** instala o `pino` e compara a saída de `pino().info({ utilizador_id: 42 }, 'tarefa criada')` com a do teu logger. O que tem a mais? (Experimenta também a opção `redact`.)
4. **Quanto custa guardar tudo:** com 500 pedidos por segundo, 15 spans por pedido e cerca de 1 KB por span, quantos GB por dia produz o sistema? E com amostragem de 5% na cabeça mais todos os erros (1% dos pedidos)?

## Perguntas de pensamento crítico

1. Uma colega quer registar o corpo completo de cada pedido e de cada resposta, "para depurar mais depressa". Que riscos vês, e que alternativa propões?
2. Porque é que a decisão de amostragem tem de ser a mesma em todos os serviços de um trace? O que acontece se cada um decidir sozinho, com `Math.random()`?
3. Já tens métricas no Prometheus (módulo 19). Que pergunta é que só um trace te responde?

<details>
<summary>Respostas</summary>

1. Os corpos têm dados pessoais e segredos (passwords no login, tokens, moradas, dados de pagamento), que passam a viver nos logs durante meses, lidos por muito mais pessoas, o que viola o princípio da minimização do RGPD e é uma fuga de dados à espera de acontecer. Além disso, o volume (e o custo) dos logs dispara. A alternativa: registar campos escolhidos (ids, tamanhos, códigos de estado), usar traces para o percurso do pedido, e, se for preciso o corpo para um bug concreto, ativá-lo temporariamente, com os campos sensíveis escondidos.
2. Porque um trace é a soma dos spans de todos os serviços. Se cada serviço decidir sozinho, um trace fica guardado na API mas não no serviço de stock: fica com buracos, e a cascata mostra uma chamada que "desaparece". Com a decisão tomada a partir do trace id (ou propagada no `traceparent`), todos os serviços decidem o mesmo para o mesmo pedido.
3. Onde é que **um pedido concreto** passou o tempo, através dos vários serviços. As métricas dizem que a latência p95 da API subiu, mas são agregadas: não dizem que os pedidos lentos são os que chamam o serviço de stock com um certo tipo de produto, nem que o tempo está numa query sem índice dentro desse serviço. O trace mostra a cascata desse pedido, operação a operação.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 47`.

**1.** Qual é a vantagem de um log estruturado (JSON) sobre um log em texto livre?

- a) Ocupa menos espaço
- b) Cada campo pesquisa-se, filtra-se e agrupa-se diretamente, sem expressões regulares frágeis
- c) É mais bonito no terminal
- d) Não precisa de níveis

<details><summary>Resposta</summary>

**b) Cada campo pesquisa-se, filtra-se e agrupa-se diretamente, sem expressões regulares frágeis** — Uma mensagem fixa e campos variáveis: todas as ocorrências agrupam-se, e 'nivel = error AND utilizador_id = 42' é uma consulta simples.

</details>

**2.** Num trace distribuído, o que têm em comum todos os spans de um mesmo pedido, em todos os serviços?

- a) O span id
- b) O trace id
- c) O nome
- d) A duração

<details><summary>Resposta</summary>

**b) O trace id** — Cada operação tem o seu span id e aponta para o pai; o trace id é o mesmo do princípio ao fim.

</details>

**3.** Que cabeçalho HTTP do padrão W3C leva o contexto do trace de um serviço para o seguinte?

<details><summary>Resposta</summary>

**traceparent** — Formato 00-<trace id>-<span id do pai>-<flags>; quem chama injeta, quem recebe extrai.

</details>

**4.** Qual é a vantagem da amostragem na cauda (tail sampling) sobre a amostragem na cabeça?

- a) É mais barata
- b) Decide no fim do trace, por isso pode guardar sempre os pedidos com erro ou lentos
- c) Não precisa de collector
- d) Guarda todos os traces

<details><summary>Resposta</summary>

**b) Decide no fim do trace, por isso pode guardar sempre os pedidos com erro ou lentos** — Na cabeça decide-se às cegas; na cauda já se sabe como o pedido correu, à custa de guardar os traces até acabarem.

</details>

**5.** O que é a API do OpenTelemetry sem um SDK configurado?

- a) Um erro no arranque
- b) Uma camada que não faz nada (os spans não vão para lado nenhum) e quase não custa
- c) Um exportador para a consola
- d) O mesmo que o Collector

<details><summary>Resposta</summary>

**b) Uma camada que não faz nada (os spans não vão para lado nenhum) e quase não custa** — É o que permite às bibliotecas instrumentarem-se sem impor nada; quem decide para onde vai a telemetria é a app, ao configurar o SDK.

</details>

<!-- quiz:end -->
