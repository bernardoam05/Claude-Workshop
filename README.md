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

Depois, abre **[`docs/00-indice.md`](docs/00-indice.md)** — é o mapa de todo o workshop: a arquitetura, o roteiro dos 19 módulos, como arrancar o sistema, e como testares a ti próprio (há um quiz de linha de comandos com correção automática).

## O que vais construir e aprender

| Camada | Tecnologia | Módulo |
|---|---|---|
| Frontend | React + Vite, Nginx | [08](docs/08-frontend-react.md), [09](docs/09-nginx-proxy-e-origem.md) |
| API | Node.js/Express, arquitetura em camadas | [04](docs/04-api-em-camadas.md) |
| Dados | PostgreSQL, migrações | [03](docs/03-postgresql.md) |
| Cache | Redis, cache-aside | [05](docs/05-redis-e-cache.md) |
| Mensagens | RabbitMQ, worker (TypeScript) | [06](docs/06-mensagens-rabbitmq.md), [07](docs/07-worker.md) |
| Streaming | Kafka, consumer groups | [16](docs/16-kafka.md) |
| Microserviço | Java / Spring Boot | [17](docs/17-spring-boot.md) |
| Microserviço | C# / .NET | [20](docs/20-dotnet.md) |
| Identidade | JWT manual + Keycloak (OIDC/PKCE) | [14](docs/14-autenticacao-manual-vs-keycloak.md) |
| Observabilidade | Prometheus + Grafana | [18](docs/18-observabilidade-prometheus-grafana.md) |
| Containers | Docker, Docker Compose, Kubernetes | [02](docs/02-docker.md) |
| CI/CD | GitHub Actions | [19](docs/19-ci-cd-github-actions.md) |
| Testes | Unitários, integração, E2E (Playwright) | [10](docs/10-testes-e-observabilidade.md) |

Mais: [decisões e trade-offs](docs/12-decisoes-e-trade-offs.md) explicados a sério, um [mapa honesto de competências de mercado](docs/13-competencias-mercado.md), e um módulo sobre [como se trabalha numa empresa](docs/15-trabalhar-numa-empresa.md) (Git, PRs, entrevistas, ferramentas da indústria).

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

Acertar as perguntas prova que reconheces os conceitos — não prova que os sabes aplicar. Para isso, usa os [exercícios do módulo 11](docs/11-exercicios.md).

## Licença

[MIT](LICENSE) — usa, estuda, modifica e partilha livremente.

---

*Construído com o [Claude Code](https://claude.com/claude-code).*
