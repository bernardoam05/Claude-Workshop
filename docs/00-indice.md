# Workshop: Aplicação Fullstack por Dentro

Este workshop usa **uma aplicação real e pequena** (um gestor de tarefas) para te ensinar cada peça de um sistema moderno: frontend, API, base de dados, cache, fila de mensagens, worker, containers e proxy.

O objetivo **não** é decorar comandos. É que no fim consigas:

1. Explicar **porque** cada peça existe e o que acontece se ela falhar.
2. Ler qualquer ficheiro do projeto e saber o que ele faz e onde se liga ao resto.
3. Escrever um ficheiro novo (Dockerfile, migração, consumidor, rota) sem copiar às cegas.
4. Avaliar **trade-offs** e defender uma escolha técnica com argumentos.

---

## Passo 0: faz fork deste repositório

**Antes de tocares em qualquer ficheiro:** faz **fork** deste repositório para a tua conta do GitHub, e clona o **fork** (não este repositório diretamente).

```bash
# No GitHub: botão "Fork" nesta página. Depois, na tua máquina:
git clone git@github.com:<o-teu-utilizador>/Claude-Workshop.git
cd Claude-Workshop
```

Porquê antes de tudo o resto:

- Este repositório é o **template**: fica sempre intacto, no estado em que o começaste a estudar.
- Todos os exercícios do módulo 11 (mudar, partir, estender) alteram ficheiros. Se os fizeres aqui diretamente, não tens como voltar ao ponto de partida sem perder o que já escreveste.
- No teu fork podes usar Git **a sério**: um branch por exercício, commits, PRs para ti próprio, tal como o módulo 15 descreve. É o próprio exercício de Git que esse módulo pede.
- Se algo correr muito mal no fork, apagas e fazes fork de novo — o template nunca é afetado.

A partir daqui, sempre que este índice ou outro módulo disser "a partir da raiz do projeto", é a raiz do **teu fork clonado**.

---

## Arquitetura

```mermaid
flowchart LR
  B[Browser] -->|:8080| W["web<br/>(Nginx + React estático)"]
  W -->|"/api/*"| A["api<br/>(Express)"]
  A -->|SQL| P[(PostgreSQL)]
  A -->|"cache GET/SET/DEL"| R[(Redis)]
  A -->|"publica task.*"| Q{{RabbitMQ}}
  Q -->|"consome task.*"| K["worker<br/>(TypeScript)"]
  K -->|"grava task_events"| P
  A -->|"publica task-events<br/>(chave = userId)"| KF{{Kafka}}
  KF -->|"consumer group"| J["activity<br/>(Java / Spring Boot)"]
  J -->|"schema activity"| P
  W -->|"/api/activity/*"| J
  B -.->|"login OIDC"| KC[Keycloak]
  PR[Prometheus] -.->|"scrape /metrics"| A
  PR -.-> J
  PR -.-> Q
  G[Grafana] -.-> PR
```

Fluxo de um clique em "concluir tarefa":

1. O **React** envia `PATCH /api/tasks/3` ao browser → `fetch`.
2. O **Nginx** recebe em `:8080` e reencaminha `/api/*` para a **API**.
3. A **API** valida o pedido, atualiza o **PostgreSQL**, apaga a **cache Redis** e publica um evento `task.completed` no **RabbitMQ**. Responde `200` já.
4. O **worker** recebe o evento da fila, grava-o em `task_events` (uma vez só) e fica feito.
5. A **estatística** "processadas pelo worker" só sobe **depois**, quando o worker acabou. Isto é **consistência eventual**, e vais perceber porquê.

---

## Mapa do projeto

| Caminho | Responsabilidade |
|---|---|
| `src/web/` | Frontend React + Vite. Imagem final é só Nginx com ficheiros estáticos |
| `src/web/nginx.conf` | Serve a SPA e faz reverse proxy de `/api` |
| `src/api/src/index.js` | **Ponto de composição**: liga as peças concretas |
| `src/api/src/app.js` | Pipeline Express (middlewares, rotas, erros) |
| `src/api/src/routes/` | Camada HTTP: pedido → serviço → resposta |
| `src/api/src/services/` | Regras de negócio (cache + BD + eventos) |
| `src/api/src/repositories/` | Todo o SQL, num único sítio |
| `src/api/src/db/migrations/` | Evolução do schema, versionada |
| `src/api/src/cache/` | Wrapper do Redis (cache-aside) |
| `src/api/src/messaging/` | Publicação de eventos no RabbitMQ |
| `src/worker/src/` | Consumidor de eventos com idempotência e DLQ |
| `config/docker-compose.yml` | Orquestra os 6 serviços |
| `scripts/smoke-test.sh` | Prova que o fluxo completo funciona |
| `src/api/src/services/authService.js` | Registo, login, JWT e hash de passwords |
| `src/api/src/middleware/auth.js` | Exige token válido nas rotas de tarefas |
| `src/api/test/integration/` | Testes contra Postgres real |
| `src/worker/src/*.ts` | Worker em TypeScript (compilado para `dist/`) |
| `.github/workflows/ci.yml` | Pipeline de CI: testes, build, integração e teste de fumo |
| `config/k8s/api.yaml` | Deployment e Service da API para Kubernetes |
| `config/keycloak/realm-workshop.json` | Realm do Keycloak (cliente, utilizador de teste), importado no arranque |
| `src/api/src/services/oidcVerifier.js` | Verificação de tokens do Keycloak (RS256 + JWKS) |
| `src/web/src/oidc.js` | Login com Keycloak no browser (Authorization Code + PKCE) |
| `src/api/openapi.yaml` | Contrato da API (OpenAPI), servido pelo Swagger UI |
| `tests/e2e/` | Testes E2E com Playwright (browser real) |
| `src/activity/` | Microserviço **Java/Spring Boot**: consome Kafka, JPA + Flyway, Spring Security (RBAC) |
| `src/api/src/messaging/kafkaPublisher.js` | Publicação no **Kafka** (chave = userId) |
| `src/api/src/observability/metrics.js` | Métricas Prometheus da API |
| `config/prometheus/`, `config/grafana/` | Scrape, alertas, fonte de dados e dashboard (como código) |

---

## Roteiro

| # | Módulo | Peça principal | Tempo sugerido |
|---|---|---|---|
| 01 | [Fundamentos](01-fundamentos.md) | HTTP, REST, Node, Express | 2 h |
| 02 | [Docker](02-docker.md) | Imagens, contentores, compose | 3 h |
| 03 | [PostgreSQL](03-postgresql.md) | Schema, SQL seguro, migrações | 2 h |
| 04 | [API em camadas](04-api-em-camadas.md) | Routes, services, repositories, DI | 2 h |
| 05 | [Cache com Redis](05-redis-e-cache.md) | Cache-aside, TTL, invalidação | 1,5 h |
| 06 | [Mensagens com RabbitMQ](06-mensagens-rabbitmq.md) | Exchanges, ack, DLQ, idempotência | 3 h |
| 07 | [O Worker](07-worker.md) | Consumidor, falhas, escala | 1,5 h |
| 08 | [Frontend com React](08-frontend-react.md) | Componentes, estado, efeitos | 2 h |
| 09 | [Nginx, proxy e origem](09-nginx-proxy-e-origem.md) | Reverse proxy, CORS, SPA | 1 h |
| 10 | [Testes e observabilidade](10-testes-e-observabilidade.md) | Pirâmide, fakes, logs, health | 2 h |
| 11 | [Exercícios](11-exercicios.md) | Mudar, partir e estender | ∞ |
| 12 | [Decisões e trade-offs](12-decisoes-e-trade-offs.md) | Pensamento crítico | 1,5 h |
| 13 | [Competências de mercado](13-competencias-mercado.md) | O que está coberto e o que falta | 1 h + exercícios D1–D8 |
| 14 | [Autenticação: manual vs Keycloak](14-autenticacao-manual-vs-keycloak.md) | OIDC, PKCE, JWKS, SSO | 2 h |
| 15 | [Trabalhar numa empresa](15-trabalhar-numa-empresa.md) | Ferramentas da indústria, Git, PRs, entrevistas | 2 h |
| 16 | [Kafka](16-kafka.md) | Log, partições, consumer groups, DLT | 3 h |
| 17 | [Java e Spring Boot](17-spring-boot.md) | DI, JPA, Flyway, Spring Security, testes | 4 h |
| 18 | [Prometheus e Grafana](18-observabilidade-prometheus-grafana.md) | Métricas, PromQL, dashboards, alertas | 2 h |

Podes fazer por ordem. Os módulos 02, 03 e 06 são os mais densos.

---

## Como estudar (o método importa mais do que o conteúdo)

Para cada módulo:

1. **Lê** a teoria.
2. **Abre** os ficheiros indicados e lê-os **antes** de ler a explicação do que fazem.
3. **Corre** o sistema e observa o comportamento.
4. **Quebra** de propósito uma coisa (há sugestões em cada módulo).
5. **Responde** às perguntas de pensamento crítico **sem olhar** para as soluções.
6. Só depois abre as soluções (estão em `<details>`).

> **Regra de ouro:** se não consegues explicar, linha a linha, o que um ficheiro faz e o que aconteceria se essa linha não existisse, ainda não o percebeste.

---

## Pré-requisitos e arranque

Precisas de: **Docker** (com o daemon a correr), **Node.js 22+** e **npm** (para os testes e para desenvolver fora do Docker).

```bash
# Arrancar tudo (a partir da raiz do projeto)
docker compose -f config/docker-compose.yml up --build -d

# Se a porta 8080 estiver ocupada noutro projeto: WEB_PORT=8081 docker compose -f ... up --build -d
# Em qualquer ambiente real, define o teu segredo JWT: JWT_SECRET=... docker compose ...

# Verificar que funciona (cria um utilizador de teste e percorre o fluxo)
./scripts/smoke-test.sh          # ou: BASE_URL=http://localhost:8081 ./scripts/smoke-test.sh

# Abrir a aplicação:       http://localhost:8080 (ou a porta que escolheste)
# Painel do RabbitMQ:      http://localhost:15672   (utilizador: workshop / password: workshop)
# Keycloak (consola):      http://localhost:8180    (admin / admin)  · utilizador da app: alice / alice-password
# Swagger UI (API):        http://localhost:8088
# Kafka UI:               http://localhost:8089
# Prometheus:             http://localhost:9090
# Grafana:                http://localhost:3001   (dashboard abre logo; editar: admin / admin)
# Utilizadora admin:       carla / carla-password  (acede a /api/activity/*)

# Testes E2E (browser real, numa imagem Docker do Playwright; com o sistema a correr)
cd tests/e2e && npm install && docker run --rm --network host -v "$PWD:/e2e" -w /e2e \
  -e BASE_URL=http://localhost:8080 mcr.microsoft.com/playwright:v1.63.0-noble npx playwright test

# Ver logs de um serviço
docker compose -f config/docker-compose.yml logs -f worker

# Desligar (mantém os dados da BD)
docker compose -f config/docker-compose.yml down
```

> **Memória:** o sistema completo tem 4 JVMs (Keycloak, Kafka, Kafka UI, Spring). O compose define limites (`mem_limit` e heaps da JVM): o stack inteiro usa cerca de 2–2,5 GiB, por isso cabe numa VM do Docker de 4 GB. Com menos, ou com outros projetos a correr, os serviços são mortos (código 137). Confirma em Docker Desktop → Settings → Resources. O Kafka UI (`kafka-ui`) é o primeiro a dispensar se faltar RAM.

Testes (sem Docker, exceto a integração):

```bash
cd src/api    && npm test                 # unitários
cd src/api    && DATABASE_TEST_URL=... npm run test:integration   # contra Postgres real
cd src/worker && npm test                 # compila o TypeScript e corre os testes
```

Novidades desta versão: **autenticação** (módulo 04 e 13), **CI** (`.github/workflows/ci.yml`), **testes de integração**, **worker em TypeScript** (módulo 07) e **Kubernetes** (`config/k8s/`). O estado de cada competência está no [módulo 13](13-competencias-mercado.md).

---

## Checklist de auto-avaliação

No fim do workshop deves conseguir, **sem consultar nada**:

- [ ] Desenhar a arquitetura de cabeça e dizer o que cada seta transporta.
- [ ] Explicar a diferença entre **imagem** e **contentor**, e o que é uma **camada**.
- [ ] Explicar porque o `package.json` é copiado antes do `src/`, no Dockerfile.
- [ ] Explicar porque o `depends_on` com `service_healthy` é diferente de `depends_on` simples.
- [ ] Explicar cache-aside e um cenário onde a cache devolve dados errados.
- [ ] Explicar `ack`, `nack`, `prefetch`, DLQ e porque a entrega é "pelo menos uma vez".
- [ ] Explicar porque o worker tem de ser **idempotente**.
- [ ] Explicar o **dual-write problem** e pelo menos uma forma de o resolver.
- [ ] Escrever uma migração nova sem editar as antigas.
- [ ] Explicar porque o React e a API funcionam na mesma origem e para que serve o Nginx.
- [ ] Dizer o que falta a este sistema para ir para produção.
