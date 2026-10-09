# 18 · Observabilidade: Prometheus e Grafana

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
- Cada alerta deve ter um **runbook**: o que verificar e o que fazer (módulo 11, P6).

Em produção, o **Alertmanager** recebe os alertas, agrupa-os, silencia-os durante manutenções, e envia para Slack, email ou PagerDuty. Não o incluímos aqui.

## 9. Os três pilares, onde estamos

| Pilar | Estado no projeto | Ferramentas da indústria |
|---|---|---|
| **Métricas** | ✅ Prometheus + Grafana | Prometheus, Grafana, Datadog, Azure Monitor, CloudWatch |
| **Logs** | 🟡 `docker compose logs` (texto livre na API; o Spring já tem formato estruturado) | Loki, ELK/OpenSearch, Datadog |
| **Traces** | ❌ | **OpenTelemetry** + Jaeger/Tempo |

**Traces** são o passo seguinte: com OpenTelemetry, um pedido `POST /api/tasks` gera um *trace* que mostra o tempo gasto na API, no Postgres, no RabbitMQ, no Kafka e no serviço Spring, numa única linha temporal. É o exercício D13.

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
