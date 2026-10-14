# 19 · Observabilidade: Prometheus e Grafana

**Objetivo:** saber instrumentar um serviço com métricas, consultá-las com PromQL, construir um dashboard e definir alertas. É o que te deixa responder a "está tudo bem em produção?" com números e não com palpites.

**Ficheiros:** `src/api/src/observability/metrics.js`, `src/activity/src/main/resources/application.yml` (secção `management`), `config/prometheus/prometheus.yml`, `config/prometheus/alerts.yml`, `config/grafana/`.

**Interfaces:**
- Prometheus: `http://localhost:9090` (Status → Targets; Graph; Alerts)
- Grafana: `http://localhost:3001` (abre logo o dashboard "Workshop · Visão geral"; para editar, admin / admin)

---

## 1. Como funciona

```
api:3000/metrics ────────┐
activity:8080/actuator/prometheus ──┼──◄── Prometheus (a cada 5 s, PULL) ──► guarda séries temporais
rabbitmq:15692/metrics/detailed ────┘          │  avalia alerts.yml
                                               ▼
                                            Grafana (consulta com PromQL, desenha)
```

- Cada serviço **expõe** métricas em texto num endpoint HTTP.
- O Prometheus **vai buscá-las** (modelo *pull*). Se um alvo não responder, a métrica `up{job="..."}` passa a 0, e isso já é um alerta (`AlvoEmBaixo`).
- O Grafana não guarda dados: só consulta o Prometheus e desenha.

Abre `http://localhost:9090/targets`: os quatro alvos devem estar **UP**.

## 2. O formato (abre tu mesmo)

```bash
docker compose -f config/docker-compose.yml exec api wget -qO- localhost:3000/metrics | grep http_request
```

```
http_request_duration_seconds_bucket{le="0.05",method="GET",route="/api/tasks",status="200",service="api"} 41
http_request_duration_seconds_count{method="GET",route="/api/tasks",status="200",service="api"} 42
```

Cada linha é uma **série**: nome + labels + valor. Cada combinação diferente de labels é uma série separada.

Repara que `/metrics` **não** está acessível pelo Nginx (só `/api/*` é encaminhado). Métricas revelam detalhes internos, e por isso só o Prometheus, dentro da rede, lhes chega.

## 3. Os quatro tipos de métrica

| Tipo | Comportamento | Exemplo no projeto |
|---|---|---|
| **Counter** | só sobe (reinicia a 0 se o processo reiniciar) | `events_published_total`, `activity_events_processed_total` |
| **Gauge** | sobe e desce | `nodejs_heap_size_used_bytes`, `rabbitmq_detailed_queue_messages_ready` |
| **Histogram** | conta valores em intervalos (*buckets*) | `http_request_duration_seconds` |
| **Summary** | percentis calculados no cliente | (evita-se: não se podem agregar entre instâncias) |

**Nunca olhes para o valor bruto de um counter**: "42 pedidos desde o arranque" não diz nada. Olha para a **taxa**: `rate(...[1m])`.

## 4. Cardinalidade: a forma mais rápida de matar o Prometheus

Em `metrics.js`, a label `route` usa o **padrão** (`/api/tasks/:id`), não o caminho real (`/api/tasks/42`). Com o caminho real, cada id criaria uma série nova: 1 milhão de tarefas, 1 milhão de séries, e o Prometheus fica sem memória. O teste `GET /metrics expõe métricas Prometheus com a rota como padrão` em `routes.test.js` garante isto.

Regra: **nunca** uses como label algo sem limite (ids, emails, URLs completos, mensagens de erro). Essas coisas vão para **logs** ou **traces**.

## 5. PromQL essencial

Experimenta no Prometheus (Graph) ou no Grafana (Explore):

```promql
# Pedidos por segundo, por rota
sum by (route) (rate(http_request_duration_seconds_count{job="api"}[1m]))

# Percentagem de erros 5xx
sum(rate(http_request_duration_seconds_count{status=~"5.."}[5m]))
  / sum(rate(http_request_duration_seconds_count[5m]))

# Latência p95 (95% dos pedidos são mais rápidos do que isto)
histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{job="api"}[5m])))

# Mensagens à espera em cada fila do RabbitMQ
rabbitmq_detailed_queue_messages_ready

# Atraso do consumidor Kafka (Spring)
max(kafka_consumer_fetch_manager_records_lag_max{job="activity"})

# Eventos Kafka perdidos pela API (best-effort)
sum(rate(events_published_total{broker="kafka", result="error"}[5m]))
```

**Porque p95 e não a média?** Se 95 pedidos demoram 10 ms e 5 demoram 5 s, a média é ≈ 260 ms e parece aceitável, mas 1 em cada 20 utilizadores espera 5 segundos. Os percentis mostram a cauda, que é o que os utilizadores sentem.

## 6. O que medir: RED, USE e os Golden Signals

- **RED** (para serviços que atendem pedidos): **R**ate, **E**rrors, **D**uration. Os três primeiros painéis do dashboard são exatamente isto.
- **USE** (para recursos: CPU, memória, filas): **U**tilization, **S**aturation, **E**rrors. Os painéis de filas, lag e memória.
- **Four Golden Signals** (Google SRE): latência, tráfego, erros, saturação. É a mesma ideia com outros nomes.

## 7. O dashboard

`config/grafana/dashboards/workshop-overview.json`, carregado no arranque por *provisioning*: dashboard e fonte de dados são **código** no Git, e não cliques que se perdem ao recriar o contentor. Os painéis:

1. Pedidos/s por rota, 2. Latência p95, 3. Erros 5xx/s (RED da API)
4. Mensagens à espera no RabbitMQ (por fila, incluindo a DLQ)
5. Eventos publicados no Kafka pela API (ok / error)
6. Eventos processados pelo `activity` (processado / duplicado)
7. Consumer lag do Kafka
8. Memória: heap Node vs heap JVM (compara os dois mundos)

Para alterar: edita no Grafana (admin / admin), exporta o JSON (Share → Export) e substitui o ficheiro.

## 8. Alertas

`config/prometheus/alerts.yml` tem 5 regras. Vê-as em `http://localhost:9090/alerts`:

| Alerta | Porquê |
|---|---|
| `ApiErrosElevados` | sintoma direto para o utilizador |
| `ApiLenta` (p95 > 500 ms) | sintoma direto |
| `MensagensNaDLQ` | trabalho que falhou e ninguém está a ver |
| `KafkaConsumerAtrasado` | trabalho a acumular |
| `AlvoEmBaixo` | sem métricas não há visibilidade |

Boas práticas que estas regras seguem:
- Alertar sobre **sintomas** (erros, latência, trabalho acumulado), não sobre causas (CPU a 80%). CPU alta sem impacto não deve acordar ninguém às 3h.
- `for: 1m`: a condição tem de durar, para não alertar por um pico de um segundo.
- Cada alerta deve ter um **runbook**: o que verificar e o que fazer (módulo 12, P6).

Em produção, o **Alertmanager** recebe os alertas, agrupa-os, silencia-os durante manutenções, e envia para Slack, email ou PagerDuty. Não o incluímos aqui.

## 9. Os três pilares, onde estamos

| Pilar | Estado no projeto | Ferramentas da indústria |
|---|---|---|
| **Métricas** | ✅ Prometheus + Grafana | Prometheus, Grafana, Datadog, Azure Monitor, CloudWatch |
| **Logs** | 🟡 `docker compose logs` (texto livre na API; o Spring já tem formato estruturado) | Loki, ELK/OpenSearch, Datadog |
| **Traces** | ❌ | **OpenTelemetry** + Jaeger/Tempo |

**Traces** são o passo seguinte: com OpenTelemetry, um pedido `POST /api/tasks` gera um *trace* que mostra o tempo gasto na API, no Postgres, no RabbitMQ, no Kafka e no serviço Spring, numa única linha temporal. É o exercício D13.

## Prática: escreve tu

Primeiro instrumentas uma aplicação, como se faz no dia a dia. Depois escreves, à mão, as três contas que o Prometheus faz por ti e que toda a gente usa sem saber bem o que são: o `rate()`, o `histogram_quantile()` e o `for:` dos alertas. Quem as escreveu uma vez nunca mais se engana a ler um dashboard.

**Verificar:** `npm run verificar 19` (dentro de `pratica/`). Só um exercício: `npm run verificar 19 metricas`, `... 19 rate`, `... 19 quantil` ou `... 19 alerta`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Instrumentar com o `prom-client` (≈35 min)

**Ficheiro:** `pratica/19-observabilidade-prometheus-grafana/metricas.js`

Os três tipos de métrica que mais se usam (secção 3), cada um para o seu caso: um **Counter** de tarefas criadas por origem, um **Gauge** de mensagens pendentes e um **Histogram** da duração de um processamento. E um middleware que conta pedidos HTTP **pela rota**, e não pelo caminho: o teste faz pedidos a `/tarefas/1`, `/tarefas/2` e `/tarefas/3`, e exige uma só série, `route="/tarefas/:id"`. É a regra de cardinalidade da secção 4, verificada.

Os testes leem o texto que o Prometheus leria em `GET /metrics` (secção 2).

**Sintaxe que vais praticar:** `new client.Counter/Gauge/Histogram({ name, help, labelNames, buckets, registers })`, `.inc({ label })`, `.set(n)`, `.startTimer()`, `try`/`finally`, `res.on('finish', ...)`, `req.route` e `req.baseUrl`.

<details>
<summary>Pista</summary>

O `startTimer()` de um Histogram devolve uma **função**: chamá-la regista o tempo passado desde o início, já em segundos. Chama-a num `finally`, para medir também as execuções que falham. No middleware, o `req.route` só fica preenchido **depois** de o router encontrar a rota: por isso lê-se dentro do `res.on('finish', ...)`, e não logo no início.
</details>

<details>
<summary>Solução de referência</summary>

```js
import client from 'prom-client';

export function criarMetricas() {
  // Um registry próprio: os testes (e duas instâncias na mesma app) não partilham contadores.
  const registry = new client.Registry();
  registry.setDefaultLabels({ service: 'pratica' });

  const tarefasCriadas = new client.Counter({
    name: 'tarefas_criadas_total', // convenção: contadores acabam em _total
    help: 'Tarefas criadas, por origem',
    labelNames: ['origem'],
    registers: [registry],
  });

  const pendentes = new client.Gauge({
    name: 'mensagens_pendentes',
    help: 'Mensagens à espera na fila',
    registers: [registry],
  });

  const processamento = new client.Histogram({
    name: 'processamento_duracao_segundos', // convenção: a unidade no nome, e sempre segundos
    help: 'Duração do processamento',
    buckets: [0.01, 0.05, 0.1, 0.5, 1],
    registers: [registry],
  });

  const pedidos = new client.Counter({
    name: 'http_pedidos_total',
    help: 'Pedidos HTTP, por método, rota e estado',
    labelNames: ['method', 'route', 'status'],
    registers: [registry],
  });

  return {
    registry,
    tarefaCriada: (origem) => tarefasCriadas.inc({ origem }),
    definirPendentes: (n) => pendentes.set(n),

    async medirProcessamento(fn) {
      const parar = processamento.startTimer(); // devolve uma função que regista os segundos passados
      try {
        return await fn();
      } finally {
        parar(); // finally: corre com sucesso ou com erro
      }
    },

    middleware(req, res, next) {
      // Só no 'finish' se sabe o status, e só aí o req.route já foi preenchido pelo router.
      res.on('finish', () => {
        const route = req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
        pedidos.inc({ method: req.method, route, status: String(res.statusCode) });
      });
      next();
    },
  };
}
```
</details>

### P2 · `rate()` e `increase()`, com reinícios do contador (≈20 min)

**Ficheiro:** `pratica/19-observabilidade-prometheus-grafana/rate.js`

Um Counter só sobe, até o processo reiniciar e ele voltar a 0. Se o `rate()` fizesse só "último menos primeiro", cada deploy aparecia no dashboard como uma queda enorme. O teste com `1000, 1010, 5, 15` é exatamente isso. Escreve a versão que o Prometheus usa: quando o valor desce, a subida desse intervalo é o próprio valor novo.

**Sintaxe que vais praticar:** `for` clássico com índice (para comparar cada amostra com a anterior), o operador ternário, `.at(-1)`.

<details>
<summary>Solução de referência</summary>

```js
export function increase(amostras) {
  let total = 0;
  for (let i = 1; i < amostras.length; i++) {
    const anterior = amostras[i - 1].valor;
    const atual = amostras[i].valor;
    // Desceu? O contador recomeçou do 0: tudo o que tem agora foi contado depois do reinício.
    total += atual >= anterior ? atual - anterior : atual;
  }
  return total;
}

export function rate(amostras) {
  if (amostras.length < 2) return 0;
  const segundos = amostras.at(-1).t - amostras[0].t;
  return increase(amostras) / segundos;
}
```

O Prometheus faz mais uma coisa que esta versão não faz: **extrapola** até aos limites da janela pedida (`[5m]`), porque as amostras raramente caem exatamente no início e no fim. É por isso que um `increase()` de um contador de inteiros pode dar `2.7`.
</details>

### P3 · `histogram_quantile()`: de onde vem um p95 (≈25 min)

**Ficheiro:** `pratica/19-observabilidade-prometheus-grafana/quantil.js`

O dashboard do projeto mostra a latência p95 com `histogram_quantile(0.95, ...)`. Mas o Prometheus nunca guardou a duração de cada pedido: só quantos couberam em cada bucket. O p95 é **estimado**: encontra-se o bucket onde cai o pedido número 95 (de 100) e interpola-se lá dentro, assumindo que os pedidos estão espalhados por igual. O algoritmo está passo a passo no ficheiro.

**Sintaxe que vais praticar:** `findIndex`, `?.` e `??` para o caso "não há bucket anterior", destructuring com renomeação (`const { le: fim, contagem } = ...`), `Infinity`, `NaN`.

<details>
<summary>Solução de referência</summary>

```js
export function histogramQuantile(q, buckets) {
  const total = buckets.at(-1).contagem;
  if (total === 0) return NaN;

  const posicao = q * total;
  const i = buckets.findIndex((b) => b.contagem >= posicao);
  const anterior = buckets[i - 1]; // undefined se i for 0

  // No bucket +Inf não há limite superior para interpolar: o melhor que se sabe é "acima de X".
  if (buckets[i].le === Infinity) return anterior.le;

  const inicio = anterior?.le ?? 0;
  const antes = anterior?.contagem ?? 0;
  const { le: fim, contagem } = buckets[i];
  // Assume que as observações estão espalhadas por igual dentro do bucket. É por isso que um p95
  // calculado de um histograma é uma ESTIMATIVA, tão boa quanto os buckets escolhidos.
  return inicio + ((fim - inicio) * (posicao - antes)) / (contagem - antes);
}
```

Consequência prática: um p95 só é tão bom quanto os buckets. Se o limite de latência que te importa é 300 ms e não tens nenhum bucket perto de 0.3, o valor que o Grafana mostra é uma interpolação entre limites distantes. Os buckets escolhem-se a pensar nos valores que vais querer ler.
</details>

### P4 · O `for:` de um alerta (≈15 min)

**Ficheiro:** `pratica/19-observabilidade-prometheus-grafana/alerta.js`

A secção 8 mostra regras com `for: 5m`. O que isso quer dizer, exatamente: a condição tem de ser verdadeira **em todas as avaliações seguidas** durante esse tempo. Até lá, o alerta está `pending`; se a condição falhar uma vez, volta a `inactive` e a contagem recomeça. Um dos testes mostra porque é que isto existe: um pico curto não acorda ninguém às 3 da manhã.

**Sintaxe que vais praticar:** `.map` com destructuring no parâmetro (`({ t, valor }) => ...`), uma variável de fora alterada dentro do `.map` (closure), `??=`.

<details>
<summary>Solução de referência</summary>

```js
export function avaliarAlerta(serie, { condicao, durante }) {
  let desde = null; // quando a condição ficou verdadeira (null = não está)
  return serie.map(({ t, valor }) => {
    if (!condicao(valor)) {
      desde = null;
      return 'inactive';
    }
    desde ??= t; // ??= só atribui se ainda for null: guarda o INÍCIO da sequência
    return t - desde >= durante ? 'firing' : 'pending';
  });
}
```
</details>

## 10. Experiências

1. **Gerar tráfego e ver o dashboard mexer:**
   ```bash
   for i in $(seq 200); do curl -s -o /dev/null localhost:8080/api/auth/config; done
   ```
2. **Provocar o alerta `AlvoEmBaixo`:** `docker compose ... stop activity`. Ao fim de ~30 s, vê o alerta em *Pending* e depois em *Firing*. Volta a arrancar.
3. **Ver a DLQ no dashboard:** publica uma mensagem inválida no RabbitMQ (módulo 06) e vê o painel 4 e o alerta `MensagensNaDLQ`.
4. **Ver lag:** para o `activity`, cria 50 tarefas, e volta a arrancar. Vê o lag subir e descer no painel 7.
5. **Ver a perda best-effort:** para o `kafka` e cria tarefas. A criação funciona (o RabbitMQ está bem), mas o painel 5 mostra `error`. Repara que cada criação demora até 2 s (o timeout).

## 11. Exercícios

- **D13. OpenTelemetry:** instrumenta a API Node (`@opentelemetry/sdk-node` com auto-instrumentação) e o Spring (Java agent), envia para um Jaeger no compose, e segue um pedido de ponta a ponta. Propaga o contexto do trace nos cabeçalhos das mensagens Kafka.
- **D14. Métrica de negócio:** um counter `tasks_completed_total` e um painel "tarefas concluídas por hora". Métricas de negócio são as que a gestão mais pede.
- **D15. SLO:** define "99% dos pedidos em menos de 300 ms em 30 dias" e cria um painel com o *error budget* que resta.
- **D16. Logs estruturados:** troca os `console.log` da API por `pino` (JSON) e junta Loki ao compose, com os logs no Grafana ao lado das métricas.

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 19`.

**1.** Porque é que a label 'route' usa o padrão (/api/tasks/:id) e não o caminho real (/api/tasks/42)?

- a) É só uma questão de estilo de código
- b) Usar o id real criaria uma série nova por cada tarefa (alta cardinalidade), podendo esgotar a memória do Prometheus
- c) O Express não permite expor o id real nas métricas
- d) Torna a consulta PromQL mais lenta de escrever

<details><summary>Resposta</summary>

**b) Usar o id real criaria uma série nova por cada tarefa (alta cardinalidade), podendo esgotar a memória do Prometheus** — Cardinalidade descontrolada é a forma mais rápida de derrubar um Prometheus.

</details>

**2.** Porque se usa o percentil p95 em vez da média para medir latência?

- a) A média é sempre a métrica mais útil, em qualquer caso
- b) A média esconde a 'cauda': pedidos muito lentos passam despercebidos nela, mas afetam utilizadores reais
- c) p95 é mais simples de calcular do que a média
- d) Não há diferença prática entre as duas

<details><summary>Resposta</summary>

**b) A média esconde a 'cauda': pedidos muito lentos passam despercebidos nela, mas afetam utilizadores reais** — 1 em cada 20 pedidos lentos pode ser invisível na média e visível no p95.

</details>

**3.** Que métrica indica se um consumidor Kafka está 'atrasado' a processar o tópico?

<details><summary>Resposta</summary>

**lag** — Consumer lag = último offset do tópico menos o offset do grupo.

</details>

**4.** Porque é que o 'up' de um alvo no Prometheus é uma forma simples de detetar que um serviço está em baixo?

- a) O Prometheus funciona por PULL: se o scrape falhar, 'up' fica automaticamente 0
- b) O Prometheus funciona por PUSH, e 'up' é enviado manualmente pelo serviço
- c) 'up' é calculado por um humano a verificar o painel
- d) Não existe a métrica 'up' no Prometheus

<details><summary>Resposta</summary>

**a) O Prometheus funciona por PULL: se o scrape falhar, 'up' fica automaticamente 0** — É o modelo pull que torna 'up == 0' um sinal fiável e automático de alvo indisponível.

</details>

**5.** Porque é que os painéis e os alertas estão em ficheiros no Git (provisioning), em vez de configurados a cliques na interface do Grafana?

- a) É só uma preferência estética
- b) Ficam versionados: sobrevivem a recriar o contentor e são revistos como código, não cliques que se perdem
- c) O Grafana obriga a este formato para funcionar
- d) Carrega mais rápido desta forma

<details><summary>Resposta</summary>

**b) Ficam versionados: sobrevivem a recriar o contentor e são revistos como código, não cliques que se perdem** — Dashboard e fonte de dados como código, tal como a infraestrutura em config/k8s/.

</details>

<!-- quiz:end -->
