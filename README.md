# Claude Workshop — aprende fullstack a sério, por dentro de um sistema real

Um workshop construído à volta de **uma aplicação real e pequena** (um gestor de tarefas), que te ensina — a sério, não por atalhos — Docker, PostgreSQL, Redis, RabbitMQ, Kafka, autenticação (manual e OIDC/Keycloak), microserviços em Java/Spring Boot e C#/.NET, observabilidade (Prometheus/Grafana), testes a vários níveis e CI/CD com GitHub Actions.

Não é um tutorial para copiares comandos. É para, no fim, conseguires: explicar **porque** cada peça existe e o que acontece se ela falhar; ler qualquer ficheiro do projeto e saber onde se liga ao resto; escrever um ficheiro novo sem copiar às cegas; e defender uma escolha técnica com argumentos, não com "é o que todos usam".

## Começa aqui

**Não trabalhes diretamente neste repositório.** Ele é o **template** — fica sempre intacto, para poderes voltar ao ponto de partida sempre que quiseres. Faz fork (ou, se for a tua própria conta, cria uma cópia num repositório novo) e clona **essa** cópia:

```bash
# No GitHub: botão "Fork", no canto superior direito desta página.
git clone git@github.com:<o-teu-utilizador>/Claude-Workshop.git
cd Claude-Workshop
```

Depois, abre **[`docs/00-indice.md`](docs/00-indice.md)** — é o mapa de todo o workshop: a arquitetura, o roteiro dos 61 módulos, como arrancar o sistema, e como testares a ti próprio (há um quiz de linha de comandos com correção automática).

## O que vais construir e aprender

| Camada | Tecnologia | Módulo |
|---|---|---|
| Frontend | React + Vite, Nginx | [08](docs/08-frontend-react.md), [10](docs/10-nginx-proxy-e-origem.md) |
| Estilos | CSS, Tailwind | [09](docs/09-estilos-css.md) |
| API | Node.js/Express, arquitetura em camadas | [04](docs/04-api-em-camadas.md) |
| Dados | PostgreSQL, migrações | [03](docs/03-postgresql.md) |
| Cache | Redis, cache-aside | [05](docs/05-redis-e-cache.md) |
| Mensagens | RabbitMQ, worker (TypeScript) | [06](docs/06-mensagens-rabbitmq.md), [07](docs/07-worker.md) |
| Streaming | Kafka, consumer groups | [17](docs/17-kafka.md) |
| Microserviço | Java / Spring Boot | [18](docs/18-spring-boot.md) |
| Microserviço | C# / .NET | [21](docs/21-dotnet.md) |
| Identidade | JWT manual + Keycloak (OIDC/PKCE) | [15](docs/15-autenticacao-manual-vs-keycloak.md) |
| Observabilidade | Prometheus + Grafana | [19](docs/19-observabilidade-prometheus-grafana.md) |
| Containers | Docker, Docker Compose, Kubernetes | [02](docs/02-docker.md), [32](docs/32-kubernetes.md) |
| CI/CD | GitHub Actions | [20](docs/20-ci-cd-github-actions.md) |
| Testes | Unitários, integração, E2E (Playwright) | [11](docs/11-testes-e-observabilidade.md) |
| Sistema e rede | Linux, Bash, systemd, DNS, TCP, TLS | [24](docs/24-linux-e-bash.md), [25](docs/25-redes.md) |
| Segurança | OWASP Top 10; sessões e cookies; autorização (RBAC, ABAC, ReBAC) | [26](docs/26-seguranca-owasp.md), [27](docs/27-sessoes-e-tokens.md), [28](docs/28-autorizacao.md) |
| Linguagens | TypeScript a sério, algoritmos e estruturas de dados | [29](docs/29-typescript.md), [30](docs/30-algoritmos.md) |
| Python | Django + Django REST Framework, uvicorn | [31](docs/31-django.md) |
| Infraestrutura como código | Terraform, Ansible | [33](docs/33-terraform.md), [34](docs/34-ansible.md) |
| Cloud | AWS (S3, SQS, DynamoDB, IAM) num LocalStack | [35](docs/35-cloud-aws.md) |
| Arquitetura e dados | SQL avançado, system design, transações, multi-inquilino, DDD, hexagonal, event sourcing, sagas | [36](docs/36-sql-avancado.md) a [40](docs/40-arquitetura-avancada.md) |
| Mais dados | MongoDB e DynamoDB, pesquisa de texto, cache HTTP e CDN | [41](docs/41-nosql.md), [42](docs/42-pesquisa-full-text.md), [43](docs/43-cache-http-e-cdn.md) |
| APIs | Desenho de APIs (erros, paginação, versões), SSE e WebSockets, GraphQL, gRPC | [44](docs/44-desenho-de-apis.md), [45](docs/45-tempo-real.md), [46](docs/46-graphql-e-grpc.md) |
| Produção | OpenTelemetry, k6, depuração e profiling em Node, resiliência, SRE, estratégias de deploy | [47](docs/47-observabilidade-otel.md) a [52](docs/52-estrategias-de-deploy.md) |
| Produto | RGPD, pagamentos e webhooks, LLMs (API do Claude, RAG) | [53](docs/53-rgpd-e-privacidade.md), [54](docs/54-pagamentos-e-webhooks.md), [55](docs/55-llms.md) |
| Frontend avançado | Core Web Vitals, acessibilidade, Next.js e SSR | [56](docs/56-performance-e-acessibilidade.md), [57](docs/57-nextjs-e-ssr.md) |
| Qualidade | Testes por propriedades, contratos e mutação; clean code e revisão | [58](docs/58-testes-avancados.md), [59](docs/59-clean-code-e-revisao.md) |
| IoT | MQTT (Mosquitto, paho-mqtt) | [60](docs/60-iot-mqtt.md) |
| Jogos | pygame: ciclo de jogo, passo fixo | [61](docs/61-jogo-pygame.md) |

**Em todos os módulos escreves código, não só lês:** cada um tem exercícios em [`pratica/`](pratica/), com testes automáticos que te dizem se está certo (`cd pratica && npm install && npm run verificar 01`). Ver [como funciona a prática](docs/00-indice.md#a-prática-ler-ensina-a-reconhecer-escrever-ensina-a-produzir).

Mais: [decisões e trade-offs](docs/13-decisoes-e-trade-offs.md) explicados a sério, um [mapa honesto de competências de mercado](docs/14-competencias-mercado.md), e um módulo sobre [como se trabalha numa empresa](docs/16-trabalhar-numa-empresa.md) (Git, PRs, entrevistas, ferramentas da indústria).

## Arranque rápido

```bash
docker compose -f config/docker-compose.yml up --build -d
./scripts/smoke-test.sh
```

Abre `http://localhost:8080`. Detalhes, portas de cada ferramenta (Keycloak, Kafka UI, Grafana...) e requisitos de memória estão no índice.

## Testa-te a sério

Cada módulo termina com um quiz de autoavaliação, de leitura direta. Há também uma versão interativa, com correção automática e sem dependências:

```bash
node scripts/quiz.mjs status   # o teu progresso
node scripts/quiz.mjs 06       # quiz só do módulo 06
node scripts/quiz.mjs geral    # perguntas que ligam vários módulos entre si
node scripts/quiz.mjs exame    # tudo junto
```

Acertar as perguntas prova que reconheces os conceitos — não prova que os sabes aplicar. Para isso, usa os [exercícios do módulo 12](docs/12-exercicios.md).

## Licença

[MIT](LICENSE) — usa, estuda, modifica e partilha livremente.

---

*Construído com o [Claude Code](https://claude.com/claude-code).*
