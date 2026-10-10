# 15 · Trabalhar numa empresa: ferramentas, práticas e o que ninguém te ensina

**Objetivo:** dar-te o mapa do que vais encontrar no primeiro emprego: as ferramentas mais usadas em cada área, como se trabalha em equipa, e o que este workshop **não** consegue ensinar.

---

## 1. Resposta honesta: este workshop chega?

**Para começar, sim. Para tudo, não, e nenhum curso chega.**

O que importa perceber:

- **Nenhuma empresa espera que um júnior conheça todas as ferramentas.** Espera que perceba os **conceitos** e aprenda a ferramenta deles depressa. Quem percebe filas aprende Kafka em semanas; quem só decorou comandos do RabbitMQ não.
- **Cada empresa tem a sua stack.** Uma usa Java + Angular + Azure; outra Node + React + AWS. O que transfere entre elas são os conceitos deste workshop: HTTP, SQL, cache, mensagens, containers, autenticação, testes.
- **O que mais distingue um júnior não é técnico:** saber pedir ajuda bem, escrever um PR que se revê depressa, ler código que não escreveste, e dizer "não sei, vou ver" em vez de inventar.

Abaixo está o mapa. Usa-o para saber **o que existe**, não para aprender tudo.

---

## 2. Mapa de ferramentas por área (o que é mais usado)

Legenda: ⭐ usado neste workshop · 📌 vale a pena conhecer bem · 👀 basta saber o que é

### Linguagens e frameworks de backend
| Ferramenta | Notas |
|---|---|
| **Java + Spring Boot** ⭐ 📌 | A mais pedida em Portugal (banca, seguros, telecom, consultoras). Se tiveres de escolher uma segunda stack, é esta |
| **C# + .NET** ⭐ | Muito forte em empresas Microsoft e consultoras (módulo 20) |
| **Node.js (Express, NestJS)** ⭐ | Express aqui; **NestJS** é o mais usado em projetos Node grandes (estrutura parecida com Spring) |
| **Python (FastAPI, Django)** 📌 | Dados, ML, automação, e APIs |
| **Go** 👀 | Infraestrutura, serviços de alto desempenho |
| **TypeScript** ⭐ | Worker aqui. É o padrão em Node e em frontend profissional |

### Frontend
| Ferramenta | Notas |
|---|---|
| **React** ⭐ | O mais usado no mundo |
| **Next.js** 📌 | React com renderização no servidor e routing; muito pedido |
| **Angular** 📌 | Muito comum em empresas grandes em Portugal |
| **Vue** 👀 | Popular, mas menos pedido cá |
| **TanStack Query, React Router, Zustand/Redux** 📌 | Data fetching, routing e estado global em React |
| **Tailwind CSS, Material UI, shadcn/ui** 👀 | Estilos e componentes |
| **Vite** ⭐ | Build tool |

### Dados
| Ferramenta | Notas |
|---|---|
| **PostgreSQL** ⭐ | A escolha por defeito em projetos novos |
| **SQL Server, Oracle** 📌 | Muito comuns em empresas grandes e no setor público. O SQL que aprendeste serve |
| **MySQL / MariaDB** 👀 | Muito usados em web |
| **MongoDB** 👀 | Documentos, schema flexível |
| **ORMs: Hibernate/JPA (Java), Entity Framework (.NET), Prisma/TypeORM (Node), SQLAlchemy (Python)** 📌 | Quase todas as empresas usam um. Saber SQL à mão (como aqui) faz-te perceber o que o ORM gera e porque é lento |
| **Flyway** ⭐, **Liquibase** 📌 | Migrações (o que o nosso `migrate.js` faz, mas com locks e rollback) |
| **Redis** ⭐ | Cache, sessões, rate limiting |
| **Elasticsearch / OpenSearch** 👀 | Pesquisa de texto e logs |

### Mensagens e eventos
| Ferramenta | Notas |
|---|---|
| **RabbitMQ** ⭐ | Filas de tarefas |
| **Apache Kafka** ⭐ 📌 | Streaming e event-driven em escala; muito pedido em vagas sénior e em banca |
| **AWS SQS/SNS, Azure Service Bus, Google Pub/Sub** 👀 | Versões geridas na cloud |

### Identidade e segurança
| Ferramenta | Notas |
|---|---|
| **Keycloak** ⭐ | IdP open source (módulo 14) |
| **Microsoft Entra ID, Auth0, Okta, Cognito** 📌 | IdPs SaaS. O protocolo (OIDC) é o mesmo |
| **HashiCorp Vault, AWS Secrets Manager, Azure Key Vault** 📌 | Onde vivem os segredos em produção (nunca no Git) |
| **OWASP Top 10** 📌 | A lista de vulnerabilidades que tens de saber explicar numa entrevista |
| **SonarQube, Snyk, Trivy, Dependabot/Renovate** 📌 | Análise de código, de dependências e de imagens. Correm no CI |

### APIs
| Ferramenta | Notas |
|---|---|
| **OpenAPI / Swagger** ⭐ | `src/api/openapi.yaml`, servido em `localhost:8088` |
| **Postman, Insomnia, Bruno** 📌 | Clientes HTTP para testar APIs à mão. Quase todas as equipas partilham coleções |
| **GraphQL, gRPC** 👀 | Alternativas a REST (módulo 12) |

### Containers, orquestração e cloud
| Ferramenta | Notas |
|---|---|
| **Docker, Docker Compose** ⭐ | Universal |
| **Kubernetes** ⭐ (manifesto) 📌 | `config/k8s/`. Em empresas médias e grandes. Tens de saber os conceitos: pod, deployment, service, ingress, probes |
| **Helm** 📌 | "Pacotes" de Kubernetes com templates. Quase sempre usado junto com K8s |
| **Argo CD, Flux** 👀 | GitOps: o cluster sincroniza-se sozinho com o Git |
| **AWS, Azure, GCP** 📌 | Escolhe uma e aprende o básico: computação (EC2 / App Service), BD gerida (RDS / Azure SQL), armazenamento (S3 / Blob), IAM. Azure é muito comum em Portugal |
| **Terraform** 📌 | Infraestrutura como código. O mais usado, independentemente da cloud |

### CI/CD e qualidade
| Ferramenta | Notas |
|---|---|
| **GitHub Actions** ⭐ | `.github/workflows/ci.yml` |
| **GitLab CI, Azure DevOps Pipelines, Jenkins** 📌 | Conceitos iguais, sintaxe diferente. Jenkins ainda aparece muito em empresas antigas |
| **ESLint, Prettier** ⭐ (ESLint) | Lint e formatação automática. Discussões de estilo em code review são tempo perdido: o Prettier decide |
| **Playwright, Cypress** ⭐ (Playwright) | Testes E2E |
| **JUnit, xUnit, pytest, Jest/Vitest** 📌 | Frameworks de testes de cada linguagem |
| **Testcontainers** 📌 | Arranca Postgres/Kafka reais em Docker dentro dos testes de integração. Padrão em Java e cada vez mais noutras linguagens |
| **k6, JMeter, Gatling** 👀 | Testes de carga |

### Observabilidade (o que te salva às 3h da manhã)
| Ferramenta | Notas |
|---|---|
| **Prometheus + Grafana** ⭐ | Métricas e dashboards. O par mais comum (módulo 18) |
| **OpenTelemetry** 📌 | O padrão para instrumentar traces, métricas e logs |
| **ELK (Elasticsearch, Logstash, Kibana), Loki** 📌 | Pesquisa de logs |
| **Datadog, New Relic, Dynatrace** 👀 | Plataformas pagas que fazem tudo |
| **Sentry** 📌 | Erros do frontend e do backend com stack trace e contexto |

### Trabalho em equipa
| Ferramenta | Notas |
|---|---|
| **Git + GitHub / GitLab / Azure Repos** 📌 | A ferramenta que vais usar todos os dias, mais do que qualquer outra |
| **Jira, Azure Boards, Linear** 📌 | Tickets e sprints. Jira domina |
| **Confluence, Notion** 👀 | Documentação interna |
| **Slack, Microsoft Teams** 👀 | Comunicação |

---

## 3. Como se trabalha numa equipa (o dia a dia real)

### O ciclo de uma tarefa

```
ticket no Jira → branch → código + testes → commit(s) → push → Pull Request
   → CI corre → code review → alterações → aprovação → merge → deploy automático → verificar em produção
```

### Git: o que tens de saber sem pensar

```bash
git switch -c feat/TASK-123-filtro-por-estado   # um branch por tarefa, com o id do ticket
git add -p                                       # escolher partes do ficheiro (commits pequenos e com sentido)
git commit -m "feat(tasks): filtrar tarefas por estado"
git fetch origin && git rebase origin/main       # atualizar o branch com o main
git push -u origin feat/TASK-123-filtro-por-estado
```

Conceitos que vão aparecer:
- **Trunk-based development** (branches curtos, merge diário para o `main`) vs **Git Flow** (branches `develop`, `release`, `hotfix`). A maioria das equipas modernas usa o primeiro.
- **Rebase vs merge:** rebase reescreve a história do teu branch para ficar linear. **Nunca** faças rebase de um branch partilhado que outros já puxaram.
- **Conflitos:** vão acontecer. Lê os dois lados, percebe a intenção de cada um, e corre os testes depois de resolver.
- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`): muitas equipas usam, e algumas geram o changelog a partir disso.
- `git log --oneline --graph`, `git blame`, `git bisect`: para perceber **porque** é que o código está como está, e quando um bug apareceu.

### Pull Requests e code review

Um bom PR:
- **Pequeno.** 200 linhas revêem-se em 15 minutos; 2000 linhas não se revêem, aprovam-se às cegas.
- **Descrição com: o quê, porquê, como testar.** O revisor não tem o teu contexto.
- **Uma só coisa.** Não misturar a feature com um refactor "já que estava aqui".
- CI verde **antes** de pedir revisão.

Quando revês:
- Comenta o **código**, não a pessoa. "Isto pode dar null quando X" em vez de "erraste".
- Distingue **bloqueante** de **sugestão** (muitas equipas usam o prefixo `nit:` para detalhes).
- Pergunta quando não percebes. Um júnior que pergunta "porque é que isto não tem lock?" num PR de um sénior está a fazer bem o trabalho.

### Rituais ágeis (Scrum é o mais comum)
- **Daily** (15 min): o que fiz, o que vou fazer, o que me bloqueia. **Diz o que te bloqueia**: ficar 2 dias preso em silêncio é o erro mais comum de um júnior.
- **Sprint planning**: escolher o trabalho das próximas 1–2 semanas. Vais estimar em *story points*.
- **Review / demo**: mostrar o que ficou feito.
- **Retrospetiva**: o que correu bem e mal na equipa.
- **Definition of Done**: o que tem de estar cumprido para dizer "está feito" (testes, review, documentação, deploy).

### Ambientes
`local` → `dev` → `staging` / `QA` → `produção`. O mesmo artefacto (imagem Docker) passa por todos; só muda a configuração (variáveis de ambiente). É exatamente por isso que o `config.js` lê tudo do ambiente.

### Incidentes e on-call
Em algum momento algo vai falhar em produção. O processo típico:
1. **Mitigar primeiro** (rollback, desligar a feature flag), **perceber depois**.
2. Comunicar no canal do incidente.
3. **Postmortem sem culpados** (*blameless*): o que aconteceu, porque é que o sistema deixou acontecer, o que muda para não se repetir.

Os módulos 06, 07 e 10 (DLQ, reconexão, health checks, o bug do Nginx com o IP da API) são exatamente o tipo de problema que aparece em incidentes reais.

### Documentar decisões: ADRs
Um **Architecture Decision Record** é um ficheiro curto: contexto, decisão, alternativas, consequências. O módulo 12 está escrito nesse espírito. Quando chegares a uma equipa, procura a pasta `docs/adr` ou equivalente: é a forma mais rápida de perceber **porque** é que o sistema é assim.

---

## 4. Os primeiros 30 dias num emprego novo

1. **Põe o projeto a correr localmente.** Se o README estiver errado, corrige-o: é o teu primeiro PR e toda a gente agradece.
2. **Lê o código pelo caminho de um pedido**, como fizemos no módulo 04: rota → serviço → repositório → BD.
3. **Pede uma tarefa pequena** e leva-a até produção. Vais aprender o processo inteiro (CI, review, deploy) com pouco risco.
4. **Pergunta bem:** "Estou a tentar X. Tentei A e B. Esperava Y e aconteceu Z. Podes ajudar?" Mostra o que tentaste. Uma pergunta assim resolve-se em 5 minutos.
5. **Toma notas** de comandos, nomes de serviços e quem sabe o quê.
6. **Lê os postmortems** antigos: é a forma mais rápida de perceber onde o sistema é frágil.

---

## 5. Entrevistas: o que te vão perguntar

Com este workshop consegues responder a quase todas estas perguntas. Treina-as em voz alta.

- Explica o que acontece quando escreves um URL no browser e carregas Enter.
- Diferença entre processo e thread; o que é o event loop do Node.
- Diferença entre `PUT` e `PATCH`; o que é idempotência.
- O que é um índice e quando **não** o deves criar. O que é uma transação (ACID).
- SQL injection: o que é e como se evita.
- Diferença entre imagem e contentor. Para que serve um multi-stage build.
- Porque usar uma fila? O que é *at-least-once*? Como tornas um consumidor idempotente?
- Cache: como invalidas? O que é um *cache stampede*?
- Autenticação vs autorização; 401 vs 403; o que é um JWT e porque não se guardam segredos lá dentro; o que é OIDC e PKCE.
- Pirâmide de testes; mock vs fake.
- **System design** (a partir de pleno, mas aparece em júnior): "desenha um encurtador de URLs" ou "desenha um sistema de notificações". Usa a estrutura deste workshop: API, BD, cache, fila, worker, e explica os trade-offs (módulo 12).

---

## 6. O que este workshop NÃO cobre (sê honesto contigo)

| Área | Porquê importa | Como começar |
|---|---|---|
| **.NET** ✅ já implementado | Muitas vagas em empresas Microsoft | Lê o módulo 20 (`src/notifications`); o exercício é refazer o WORKER (RabbitMQ) em .NET, não a API Node |
| **ORM em Node** | Muitas equipas Node usam Prisma | Converte o `taskRepository` para Prisma e compara o SQL gerado com o JPA do módulo 17 |
| **Cloud real** | Onde as apps correm | Conta gratuita na AWS ou Azure: põe a API num serviço de contentores com uma BD gerida |
| **Terraform** | IaC é padrão | Cria com Terraform os recursos do ponto anterior |
| **Traces e logs centralizados** | Diagnosticar produção | Exercícios D13 (OpenTelemetry) e D16 (Loki) |
| **Refresh tokens / BFF** | Sessões seguras numa SPA | Módulo 14, pergunta 2 |
| **Acessibilidade e performance web** | Qualidade do frontend | Lighthouse nas DevTools do Chrome |
| **Soft skills** | Decidem promoções | Só se aprendem a trabalhar com pessoas. Pratica explicar o workshop a um colega |

## 7. Plano sugerido (8 semanas, depois de acabares o workshop)

| Semana | Foco |
|---|---|
| 1 | Já fizeste fork ([Passo 0](00-indice.md#passo-0-faz-fork-deste-repositório)). Branches + PRs para cada exercício, e vê o CI a correr a sério |
| 2–3 | Exercícios D9–D12 do módulo 17: Testcontainers e refazer a API Node em **Spring Boot** |
| 4 | Prisma no projeto Node + Prettier + Husky (hooks de pre-commit) |
| 5 | Deploy numa cloud (AWS ou Azure) com uma BD gerida |
| 6 | Terraform para o que fizeste na semana 5 |
| 7 | OpenTelemetry e Loki (D13, D16): traces e logs ao lado das métricas que já tens |
| 8 | Kubernetes local (kind) com Helm; aplicar o `config/k8s/api.yaml` e completar para os outros serviços |

No fim disto, tens um projeto de portfólio que mostra praticamente tudo o que uma vaga júnior/pleno pede, e que consegues explicar linha a linha numa entrevista. **Isso vale mais do que qualquer certificado.**

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 15`.

**1.** O que é 'trunk-based development'?

- a) Nunca usar branches, tudo direto no main
- b) Branches curtos, com merge frequente (diário) para o main, em vez de branches longos tipo develop/release
- c) Um branch por desenvolvedor, para sempre
- d) Rebase automático a cada commit feito

<details><summary>Resposta</summary>

**b) Branches curtos, com merge frequente (diário) para o main, em vez de branches longos tipo develop/release** — É o modelo que a maioria das equipas modernas usa, em vez do Git Flow clássico.

</details>

**2.** Qual destas é uma boa prática de Pull Request, segundo o módulo?

- a) O maior possível, para poupar número de reviews
- b) Pequeno, com descrição de o quê/porquê/como testar, e CI verde antes de pedir revisão
- c) Sem descrição: o código explica-se a si próprio
- d) Só se deve abrir ao fim do dia de sexta-feira

<details><summary>Resposta</summary>

**b) Pequeno, com descrição de o quê/porquê/como testar, e CI verde antes de pedir revisão** — 2000 linhas num PR não se revêem a sério — aprovam-se às cegas.

</details>

**3.** Como se chama a reunião diária de ~15 min onde se diz o que se fez, o que se vai fazer e o que bloqueia?

<details><summary>Resposta</summary>

**daily** — É também onde deves dizer explicitamente o que te está a bloquear.

</details>

<!-- quiz:end -->
