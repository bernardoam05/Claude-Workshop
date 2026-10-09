# 13 · Competências de mercado: o que o workshop cobre e o que não

Este módulo responde a uma pergunta honesta: **o workshop cobre o que as vagas de fullstack/backend pedem?**

Resposta curta: **cobre o núcleo que as vagas pedem, incluindo Keycloak, E2E, CI e OpenAPI.** Ficam de fora sobretudo ferramentas que dependem da stack de cada empresa (Java/.NET, ORM, cloud, Terraform, Kafka). O mapa completo de ferramentas da indústria está no [módulo 15](15-trabalhar-numa-empresa.md).

Legenda: ✅ implementado e testado · 🟡 parcial (implementado com limitações, ou só em conceito) · ❌ não coberto

---

## Mapa de competências

| Competência | Estado | Onde está / onde estudar |
|---|---|---|
| Docker e Docker Compose | ✅ | módulo 02, `src/*/Dockerfile`, `config/docker-compose.yml` |
| Imagens multi-stage, utilizador não-root | ✅ | módulo 02, `src/web/Dockerfile`, `src/worker/Dockerfile` |
| SQL e modelação de dados | ✅ | módulo 03, migrações 001–004 |
| Índices e planos de execução avançados | 🟡 | só `EXPLAIN` básico no módulo 03 |
| Migrações versionadas | 🟡 | `migrate.js` funciona, mas não tem lock entre instâncias (exercício C13) |
| ORM | 🟡 | JPA/Hibernate no serviço Spring (módulo 17); a API Node continua com SQL à mão, de propósito |
| REST e códigos HTTP | ✅ | módulos 01 e 04 |
| OpenAPI / Swagger | ✅ | `src/api/openapi.yaml`, Swagger UI em `localhost:8088` |
| Lint (ESLint) | ✅ | `src/api/eslint.config.js`, corre no CI. Prettier não configurado |
| GraphQL, gRPC | ❌ | só comparação no módulo 12 |
| WebSockets e SSE | 🟡 | só comparação com polling no módulo 08 (exercício D8) |
| Filas e mensagens (RabbitMQ) | ✅ | módulos 06 e 07, com reconexão e DLQ testadas |
| Kafka | ✅ | módulo 16: tópico com 3 partições, chave por utilizador, consumer group, DLT, Kafka UI |
| Cache (Redis, cache-aside, TTL) | ✅ | módulo 05, cache isolada por utilizador |
| React: componentes, estado, efeitos | ✅ | módulo 08 |
| React: routing, data fetching avançado (React Router, TanStack Query) | ❌ | o `App.jsx` faz isto à mão, o que é bom para aprender, mas não é o que se usa em equipas |
| TypeScript | 🟡 | o **worker** está em TypeScript (`src/worker`, `strict` ativo); a API e o frontend ainda são JavaScript (exercício D2) |
| Autenticação e autorização (JWT, hash de passwords, dono por recurso) | ✅ | `authService.js`, `middleware/auth.js`, migrações 003–004, testes em `authService.test.js` |
| Identity Provider (Keycloak, OIDC, PKCE, SSO) | ✅ | módulo 14, serviço `keycloak` no compose, `oidcVerifier.js`, `oidc.js`, testado no browser |
| Sessões avançadas (cookies httpOnly, refresh tokens, BFF) | ❌ | o token vai no `localStorage` (módulo 14 explica o risco e a alternativa) |
| Segurança web (OWASP, CORS, rate limiting, segredos) | 🟡 | CORS evitado por desenho (módulo 09), segredos por variável de ambiente, falta rate limiting e `helmet` (exercício D7) |
| Testes unitários | ✅ | módulo 10, 27 testes entre API e worker |
| Testes de integração com BD real | ✅ | `src/api/test/integration/`, corre contra Postgres (`npm run test:integration`) |
| Testes E2E (Playwright) | ✅ | `tests/e2e/`: login local, login Keycloak e logout num browser real; corre no CI |
| Testes de carga | ❌ | não coberto |
| Métricas, dashboards e alertas (Prometheus, Grafana) | ✅ | módulo 18: API, Spring e RabbitMQ instrumentados, dashboard e 5 alertas como código |
| Logs estruturados e traces (Loki, OpenTelemetry) | ❌ | exercícios D13 e D16 |
| Java + Spring Boot | ✅ | módulo 17: `src/activity` com JPA, Flyway, Spring Security (RBAC com Keycloak), Spring Kafka, Actuator, JUnit/Mockito/MockMvc |
| .NET | ❌ | não coberto; os conceitos do módulo 17 transferem-se quase 1:1 (ASP.NET Core, EF Core) |
| CI/CD (GitHub Actions) | ✅ | módulo 19 + `.github/workflows/ci.yml`: testes, build, integração e teste de fumo, com `needs`, cache, artefactos e OIDC explicados |
| Git no dia a dia (branches, PRs, rebase, conflitos) | 🟡 | já fizeste fork (ver [Passo 0](00-indice.md#passo-0-faz-fork-deste-repositório)); falta só praticar branches e PRs a sério |
| Kubernetes | 🟡 | `config/k8s/api.yaml` (Deployment, Service, probes, segurança). Validado com o esquema oficial, **nunca aplicado a um cluster** |
| Cloud (AWS, Azure, GCP) | ❌ | não coberto; exercício D6 é conceptual |
| Infraestrutura como código (Terraform, Pulumi) | ❌ | não coberto |
| Arquitetura (camadas, DI, DDD) | ✅ | módulo 04; DDD só pelo nome |
| Linux, shell, redes | 🟡 | usados nos comandos; não há módulo dedicado |

---

## O que continua em falta (por ordem de importância)

1. **Git em equipa**: já estás no teu fork ([Passo 0](00-indice.md#passo-0-faz-fork-deste-repositório)). Falta praticar um branch por exercício com um PR, para treinar o fluxo real de equipa.
2. **Cloud e IaC**: o manifesto de Kubernetes nunca correu num cluster. Um deploy real exige uma conta e um registo de imagens.
3. **TypeScript na API e no frontend**: o worker já tem, os outros não.
4. **Tempo real e ORM**: SSE (D8) e a escolha de um ORM, com os trade-offs de cada um.

---

## Como fechar o que falta

Os exercícios do bloco D (em `11-exercicios.md`) cobrem o que ficou de fora: **D5** (Kubernetes num cluster local, se tiveres kind ou minikube), **D6** (deploy em cloud), **D8** (SSE). Os D1, D2 e D3 já estão implementados: o exercício é ler o código e fazer a experiência indicada.

Para Git, no teu fork (ver [Passo 0](00-indice.md#passo-0-faz-fork-deste-repositório)), cria um branch por exercício e abre um PR para ti próprio. Só com isto praticas o fluxo de equipa.
