# 12 · Exercícios

Os exercícios estão em três níveis. **Não avances de nível sem fazer pelo menos metade do anterior.**

- **Nível A: Mudar.** Alterar código existente, seguindo o padrão do projeto.
- **Nível B: Partir.** Provocar falhas e explicar o que aconteceu.
- **Nível C: Estender.** Desenhar e implementar algo novo, com decisões tuas.

Regras para todos:

1. Antes de programar, escreve **em 3 linhas** o que vais mudar e em que ficheiros.
2. Antes de correr, **prevê** o resultado. Escreve a previsão.
3. Depois de correr, compara. Se erraste, percebe porquê antes de continuar.
4. Os testes (`npm test`) e o `smoke-test.sh` têm de continuar a passar no fim.

Cada exercício tem **pistas** escondidas. Só as abras se estiveres bloqueado há mais de 15 minutos.


## Antes de mexer no projeto: o treino isolado

Vários exercícios deste módulo têm um "treino" em `pratica/`: a mesma ideia, isolada, com testes que te dizem se está certa. Se um exercício te parecer grande demais, faz primeiro o treino correspondente. Depois, ligá-lo ao projeto a sério é sobretudo trabalho de canalização (e é essa a parte que este módulo treina).

| Exercício aqui | Treino isolado em `pratica/` |
|---|---|
| A2 · `GET /api/tasks/:id` | [04 P3](04-api-em-camadas.md#p3--camada-http-40-min): rotas com `:id`, validação do id e `404` |
| A3 · campo `priority` | [03 P1](03-postgresql.md#p1--escrever-uma-migração-30-min) (migração com `CHECK`) e [04 P1](04-api-em-camadas.md#p1--validação-com-zod-40-min) (`z.enum`) |
| A5 · Dockerfile sem multi-stage | [02 P3](02-docker.md#p3--multi-stage-build-20-min): o mesmo, ao contrário |
| B9 · limitar as tentativas | [06 P2](06-mensagens-rabbitmq.md#p2--um-consumidor-com-tentativas-limitadas-35-min): a opção do cabeçalho `x-retries` |
| C11 · testes de integração | [11 P3](11-testes-e-observabilidade.md#p3--testes-de-integração-com-um-postgres-a-sério-30-min-7-mutantes) |
| C12 · métricas com Prometheus | [19 P1](19-observabilidade-prometheus-grafana.md#p1--instrumentar-com-o-prom-client-35-min) |
| C14 · outbox | [06 P3](06-mensagens-rabbitmq.md#p3--outbox-a-resposta-ao-dual-write-40-min) |
| C16 · `X-Request-Id` | [01 P3](01-fundamentos.md#p3--a-mesma-api-com-express-e-um-middleware-teu-30-min) (e, em .NET, [21 P3](21-dotnet.md#p3--injeção-de-dependências-trocar-peças-e-tempos-de-vida-35-min)) |
| C17 · administradores | [15 P4](15-autenticacao-manual-vs-keycloak.md#p4--autenticação-e-autorização-como-middlewares-25-min): `exigirPapel` e `podeEditar` |
| C18 · rate limiting no Nginx | [10 P3](10-nginx-proxy-e-origem.md#p3--segurança-e-desempenho-25-min) (e a versão em JavaScript, [05 P2](05-redis-e-cache.md#p2--rate-limiting-com-incr-e-expire-35-min)) |
| D1 · pipeline de CI | [20](20-ci-cd-github-actions.md#prática-escreve-tu): três workflows escritos do zero |

---

## Nível A: Mudar

### A1. TTL configurável e prova com `X-Cache`
Já existe `CACHE_TTL_SECONDS` em `config.js`. Testa-o: define `CACHE_TTL_SECONDS=5` no `docker-compose.yml`, reconstrói a API e prova, com `curl -sI` a intervalos, que a cache expira ao fim de 5 segundos.

<details><summary>Pista</summary>

Alterar uma variável de ambiente no compose exige `docker compose up -d api` (recria o contentor). Não basta `restart`, porque o ambiente é definido na criação.
</details>

### A2. Endpoint `GET /api/tasks/:id`
Acrescenta uma rota que devolve **uma** tarefa. Segue o caminho completo: `routes/tasks.js` → `services/taskService.js` → `repositories/taskRepository.js` (já existe `findById`!). Escreve um teste em `routes.test.js` para o `404`.

<details><summary>Pista</summary>

Não precisas de cache para este endpoint. Se quiseres, pensa: que chave usarias, e que invalidação faria falta? Se não o usares, justifica porquê.
</details>

### A3. Campo `priority` (baixa, média, alta)
Adiciona uma prioridade às tarefas. Passos: uma **nova** migração `003_...sql` (**não** edites a 001), validação em `taskSchemas.js`, repositório, e um `<select>` em `TaskForm.jsx`.

<details><summary>Pista</summary>

Uma coluna nova com `NOT NULL` numa tabela com dados precisa de `DEFAULT`. Porquê? Pensa no que a migração faria a linhas existentes. (Vê também o problema P3, mais abaixo.)
</details>

### A4. Consumo atrasado
Para o worker, cria 5 tarefas e marca-as como concluídas. Depois arranca o worker. Observa os logs.

Responde: a API respondeu `200` às 5 conclusões **enquanto o worker estava parado?** Onde estão as mensagens neste momento? Que ferramenta te mostra isso?

### A5. Dockerfile do frontend sem multi-stage
Escreve, **do zero e sem olhar**, um `Dockerfile` alternativo para o `web` que corre o build **dentro** da imagem final (sem Nginx, usando `npm run preview` como servidor). Não o uses no compose. Compara tamanhos com `docker images`. Depois apaga-o: a pasta do projeto não deve ficar com ficheiros de experiências.

<details><summary>Pista</summary>

Pergunta-te: o que tem a imagem final que não precisa de ter? Quantas camadas tem o `node_modules`? Quanto pesa a imagem `nginx:alpine` comparada com `node:22-alpine`?
</details>

---

## Nível B: Partir

### B6. Postgres sem healthcheck
Remove o `healthcheck` do `postgres` no compose. Faz `down` (mantém volumes) e `up --build -d`. Observa a ordem de arranque nos logs da API.

Explica: porque é que a API às vezes falha no arranque? Porque é que o `restart: unless-stopped` a salva, e o que aparece nos logs enquanto isso acontece?

### B7. Nome de serviço errado
No `nginx.conf`, muda `http://api:3000` para `http://apix:3000`. Reconstrói o `web`. Lê os logs do contentor `web`.

Responde: porque é que o contentor do Nginx **morre** no arranque? Que mensagem aparece? Porque é que isto é diferente de um `502` (que vês em B-experiência do módulo 10)?

### B8. A mensagem envenenada e o reprocessamento
1. Publica uma mensagem inválida pelo painel do RabbitMQ (`task.created`, payload `"não é json"`).
2. Confirma que chegou à DLQ.
3. Usa o painel para **mover** a mensagem de volta para `worker.task-events`. Que acontece? Porquê?
4. Agora corrige a mensagem para ser válida e envia-a de novo. Que linha aparece em `task_events`?

<details><summary>Pista</summary>

No passo 3, a mensagem volta a falhar e vai novamente para a DLQ. Se não mudares o conteúdo, reprocessar só cria ciclos. A DLQ é para **corrigir a causa e reenviar**, não para ser um depósito.
</details>

### B9. Limitar as tentativas (3 retries)
Hoje, um erro transitório faz `requeue` **infinito**. Implementa: após 3 tentativas, a mensagem vai para a DLQ.

Pistas, sem solução: o RabbitMQ acrescenta `x-death` às mensagens que passam pela DLX. Mas a **primeira** rejeição com `requeue=true` não passa pela DLX. Então, como contas tentativas? Uma opção é um cabeçalho próprio ao reenviar. Outra é uma fila de *retry* com TTL. Compara as duas: qual é mais simples, e qual tem melhor comportamento sob carga?

### B10. Ordem e escala
Corre `docker compose ... up -d --scale worker=3`. Cria 30 tarefas e marca-as todas como concluídas o mais depressa possível.

Responde:
1. Como se distribuem as mensagens pelos três workers?
2. Garante-se a **ordem** de processamento (`task.created` antes de `task.completed` da mesma tarefa)? Prova com os logs.
3. O resultado final (`processedCompleted`) está correto? Porquê, apesar da ordem não estar garantida?

### B11. Reconexão dentro do worker
Hoje, se o RabbitMQ reiniciar, o worker **sai** com erro e o Docker reinicia-o. Funciona, mas o processo morre e volta a arrancar com um consumidor novo. Implementa um ciclo de reconexão **dentro** do processo, que volta a declarar a topologia e a consumir.

Responde antes de codificar: o que acontece às mensagens que estavam "em voo" (entregues e sem `ack`) quando a ligação cai? São reentregues? Porquê? Como é que isso afeta a idempotência?

---

## Nível C: Estender

### C11. Testes de integração com Postgres real
Os testes atuais usam fakes. Escreve **um** teste de integração que:

- Ligue a um Postgres real (o do compose, com a porta publicada temporariamente, ou um Postgres de teste).
- Corra `migrate()`.
- Crie uma tarefa com o repositório real, a marque como concluída e verifique `findById`.

Mantém-no separado (`test/integration/`) para que `npm test` normal continue sem infraestrutura.

<details><summary>Pista</summary>

Usa uma BD dedicada para os testes (ex.: `workshop_test`), para não sujares os dados do desenvolvimento. Limpa as tabelas no `before` de cada teste. Pensa em porque é que um teste de integração que deixa dados para trás torna os outros testes frágeis.
</details>

### C12. Métricas com Prometheus
Acrescenta um endpoint `GET /metrics` à API com:

- um contador de pedidos por rota e código HTTP;
- um histograma de latência.

Acrescenta um serviço Prometheus ao compose que faz scrape à API.

<details><summary>Pista</summary>

A biblioteca `prom-client` é o padrão para Node. Cuidado com **cardinalidade**: se usares o `id` da tarefa como label, crias uma série nova por tarefa e o Prometheus explode. Usa a **rota** (`/api/tasks/:id`), não o caminho real.
</details>

### C13. Migrações seguras com várias instâncias
Corre `docker compose ... up -d --scale api=2` numa base de dados **vazia** (sem volume: `down -v` primeiro). Observa os logs. Consegues ver dois processos a tentar aplicar a mesma migração?

Corrige `migrate.js` para que só **um** processo de cada vez aplique migrações. Pistas: PostgreSQL tem `pg_advisory_lock(chave)`, que é um lock de sessão entre ligações. Porque é que o lock tem de ser de **sessão** e não de transação? (Pensa no que acontece ao `COMMIT` de cada migração.)

### C14. Outbox
Resolve o dual-write do módulo 06:

1. Cria uma tabela `outbox` (migração nova).
2. Em `updateTask`, grava o evento **na mesma transação** que a alteração da tarefa. Isto exige que o `repository` aceite um cliente de transação.
3. Um processo *relay* (pode ser um `setInterval` no worker) lê a outbox não enviada, publica no RabbitMQ e marca como enviada.
4. Prova: para o RabbitMQ, cria tarefas, arranca-o, e verifica que **todos** os eventos chegam ao worker.

Responde no fim: o que acontece se o relay publicar, mas morrer antes de marcar como enviado? É um problema? Porquê é que o consumidor idempotente resolve isto?

### C15. O contador Redis e a corrida
Implementa a versão `INCR` das estatísticas (num branch, ou comentando a versão atual). Escreve um teste que simule: o `INSERT` tem sucesso, e depois o processo "morre" antes do `INCR`. Mostra que o contador fica **errado** e que a reentrega **não** o corrige.

Depois responde: que alterações mínimas tornariam o `INCR` correto? (Pista: a atomicidade exige uma transação que inclua o Redis, o que não existe. Há soluções parciais, e cada uma tem um custo.)

### C16. Correlação com `X-Request-Id`
Faz com que cada pedido HTTP tenha um id (aceita o que o cliente enviar, ou gera um). Propaga-o:

- nos logs da API;
- no evento publicado (campo `requestId`);
- nos logs do worker.

No fim, deves conseguir seguir **uma** tarefa com `docker compose logs api worker | grep <id>`.

<details><summary>Pista</summary>

Não confies cegamente em cabeçalhos vindos do exterior: um cliente pode enviar um id gigante ou com caracteres estranhos. Valida-o (tamanho e formato) antes de o propagar, como fazes com o resto da entrada.
</details>

### C17. Administradores podem gerir as tarefas de qualquer utilizador
> **Nota:** este exercício descrevia originalmente "acrescentar utilizadores e ownership" — mas isso já está implementado a sério (módulo 04, com JWT e Keycloak). Ficou obsoleto, por isso foi substituído por um passo a mais sobre a MESMA base.

Hoje, o papel `admin` do Keycloak já dá acesso a `/api/activity/*` e `/api/notifications/*` — mas **não** a `/api/tasks`: a Carla (admin) continua limitada às suas próprias tarefas, tal como a Alice. Combina os dois mecanismos de autorização que já existem no projeto (ownership por `user_id`, e papel `admin` do token):

- Um administrador deve conseguir listar, concluir ou apagar a tarefa de **qualquer** utilizador.
- Um utilizador normal continua limitado às suas.
- Decide: a cache (`tasks:user:<id>`) continua por utilizador mesmo quando um admin vê a lista de outro? O que mudarias na chave?
- Escreve um teste (no `taskService.test.js`) que prove que um admin vê as tarefas da Alice, e que a Alice continua sem ver as da Carla.

### C18. Rate limiting no Nginx
Limita cada IP a 10 pedidos por segundo em `/api/` com `limit_req`. Prova com um ciclo de `curl` que os pedidos a mais recebem `503` (ou `429` se configurares). Explica porque é que isto está no Nginx e não na API.

### C19. Desafio final: o painel de notificações no frontend
> **Nota:** este exercício pedia originalmente para construir um consumidor novo (fila própria, idempotente, com DLQ) — isso já está feito a sério, em C#/.NET (módulo 21, `src/notifications`). O que **falta** é só o frontend, e é mesmo isso que falta fazer: a prática de escrita continua, só muda o ficheiro.

O backend já existe e funciona (`GET /api/notifications/summary` e `/recent`, só para admins). Falta a parte React:

- Um componente novo (`NotificationsPanel.jsx`) que chama `/api/notifications/recent` e mostra a lista.
- Só deve aparecer (ou pelo menos funcionar) para quem tem o papel `admin` — mas o token fica no browser, e o frontend **não** o costuma decifrar. Decide: mostras sempre o link e deixas a API devolver 403 com uma mensagem amigável, ou decificas o JWT no cliente (`atob` na segunda parte do token) para saberes o papel antes de pedires? Qual é mais seguro? Qual dá melhor experiência?
- Escreve a função nova em `api.js`, o componente, e liga-o ao `App.jsx` — sem copiar o `StatsBar.jsx` linha a linha; usa-o como referência, não como molde.

---

## Nível D: Lacunas de mercado

Estes exercícios acrescentam competências que o projeto ainda não tem (ver `14-competencias-mercado.md`). Cada um é independente dos outros.

### D1. Pipeline de CI (GitHub Actions) ✅ já implementado
> Já existe em `.github/workflows/ci.yml`. Lê-o e faz a experiência: parte um teste da API e vê que o job `smoke` deixa de correr, por causa de `needs`. O enunciado original fica abaixo para referência.

Cria `.github/workflows/ci.yml` que, a cada push, corre `npm test` na API e no worker, faz `npm run build` no web, constrói as três imagens e corre o `smoke-test.sh` com o compose.

Pistas: usa `actions/setup-node` com `cache: npm`. Para o smoke test, `docker compose up -d --build --wait` (a flag `--wait` espera pelos healthchecks). Pensa: porque é que o job do smoke test deve correr **depois** dos testes unitários e não em paralelo?

### D2. TypeScript num serviço ✅ o worker já está em TypeScript
> Lê `src/worker/src/handler.ts` e `tsconfig.json`. Depois faz o mesmo na API: converte **uma** rota (ex.: `routes/auth.js`) e vê o compilador apanhar um erro de tipos. O enunciado original fica abaixo.

Converte **um** serviço (o worker é o mais pequeno) para TypeScript, com `tsc` e `tsconfig.json`. Começa pelo `handler.js`: define um tipo `TaskEvent` e faz o compilador apanhar o evento mal formado **em tempo de compilação** em vez de depender do `MalformedEventError`.

Responde: o que o TypeScript garante e o que **não** garante? (Pista: o que acontece a um JSON que chega da fila com um formato que não corresponde ao tipo?)

### D3. Autenticação com JWT ✅ já implementado
> Lê `src/api/src/services/authService.js`, `middleware/auth.js` e as migrações 003 e 004. Responde às perguntas do enunciado abaixo, e faz a experiência: `curl` a `/api/tasks` com um token adulterado (muda um carácter) e vê o 401.

Acrescenta registo e login:

- `POST /api/auth/register` e `POST /api/auth/login`;
- passwords guardadas com hash (`bcrypt` ou `argon2`), **nunca** em texto simples;
- um middleware que valida o token em `/api/tasks` e devolve `401` sem token válido;
- a tarefa passa a pertencer ao utilizador (ligar com C17).

Decisões a justificar: onde guardas o token no browser (cookie `httpOnly` ou `localStorage`, e porquê)? Quanto tempo dura o token, e como o revogas se um utilizador for desativado? Porque é que o `401` e o `403` são coisas diferentes?

### D4. Teste E2E com Playwright ✅ já implementado
> Lê `tests/e2e/specs/tasks.spec.js`. Acrescenta um teste que apaga uma tarefa e confirma que desaparece. Correr: ver `docs/00-indice.md`.

Escreve um teste de browser que: abre a app, cria uma tarefa, marca-a como concluída e confirma que o contador "processadas pelo worker" sobe (com espera, não com `sleep` fixo). Corre-o contra o compose.

Pistas: usa `expect(...).toHaveText()` com timeout, que espera até a condição ser verdadeira. Um `sleep(3000)` é a causa mais comum de testes E2E intermitentes.

### D5. Kubernetes: primeiro contacto
Escreve um `Deployment` e um `Service` para a API (com `replicas: 2`, `readinessProbe` apontando para `/api/health` e limites de memória). Valida com `kubectl apply --dry-run=client -f`, ou corre num cluster local (kind, minikube) se tiveres.

Responde: que diferença há entre a `readinessProbe` e a `livenessProbe` aqui, e o que acontece a um pedido enquanto um pod está a arrancar sem readiness?

### D6. Deploy numa cloud (conceito)
Sem gastar dinheiro: escreve, em notas, como publicarias este sistema numa cloud à tua escolha. Para cada peça (web, API, worker, Postgres, Redis, RabbitMQ) indica o serviço gerido equivalente (ex.: RDS, ElastiCache, Amazon MQ, ou um serviço de contentores) e porque o escolherias ou não o usarias. Depois, indica o que mudaria no código: nada, ou quê?

### D7. Auditoria de segurança
Percorre a lista OWASP Top 10 e, para cada item, indica se o projeto está protegido, parcialmente protegido ou exposto. Depois corrige **dois** itens: por exemplo, acrescenta `helmet` (cabeçalhos de segurança) e limites de tamanho nos inputs. Corre `npm audit` nas duas pastas e discute o que aparece.

### D8. Atualizações em tempo real com SSE
Substitui o polling de 3 segundos das estatísticas por Server-Sent Events: uma rota `GET /api/stats/stream` que envia um evento sempre que o worker processa uma conclusão.

Responde: o que muda na arquitetura? Quantas ligações abertas tens com 1000 utilizadores? Como é que a API sabe que o worker processou algo, se o worker e a API são processos diferentes? (Pista: é aqui que o RabbitMQ ou um canal Redis Pub/Sub entra.)

---

## Perguntas de pensamento crítico (cenários)

Estas não têm um comando para correr. Têm de pensar.

**P1. O contador mostra 998, mas o worker processou 1000 mensagens.**
Lista as hipóteses por ordem de probabilidade e diz como as testarias. (Pista: as mensagens da DLQ contam? A tabela tem um `UNIQUE`? Um evento pode ter sido de outro tipo?)

**P2. A API responde `500` a criar tarefas às 3h. O painel do RabbitMQ mostra a memória a 100%.**
Por ordem: o que é que pode estar a acontecer, o que verificas primeiro, e o que é que **não** farias antes de perceber a causa (ex.: reiniciar tudo)?

**P3. Precisas de uma coluna `NOT NULL` nova numa tabela com 1 milhão de linhas, sem downtime.**
Desenha a migração em três passos. Porque é que `ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT ...` é perigoso em algumas versões e bases de dados grandes? (Pista: pesquisa "Postgres ADD COLUMN DEFAULT volatile rewrite".)

**P4. Um cliente diz: "marquei a tarefa como concluída e voltou a aparecer como por concluir."**
Enumera três causas possíveis do lado do servidor e uma do lado do cliente. Como as distingues? (Pista: cache, concorrência, dois separadores abertos, o polling a ler dados antigos.)

**P5. Dois eventos da mesma tarefa, `task.created` e `task.completed`, chegam ao worker por ordem invertida.**
Isto pode acontecer? Quando? Que consequência tem para o nosso worker, e que consequência teria para um worker que construísse um histórico com "a última mensagem ganha"?

**P6. O tamanho da DLQ cresce 50 mensagens por hora, durante semanas.**
Ninguém olhou. Que alerta configurarias, quem o recebe, e o que dirias no runbook para quem o recebe?

<details>
<summary>Respostas resumidas</summary>

**P1.** Por ordem: (a) mensagens na DLQ ou ainda na fila (1000 processadas com 2 na DLQ, ou o contador lê de cache de 5s); (b) eventos duplicados que foram ignorados (o contador conta eventos, não mensagens, e isso é o comportamento certo); (c) um tipo de evento que não é `task.completed` mas foi contado. Testa com `SELECT type, count(*) FROM task_events GROUP BY type` e compara com o total do RabbitMQ (`messages_unacknowledged` + DLQ).

**P2.** Verificas primeiro: métricas de memória por fila (uma fila a crescer sem consumidor é o cenário mais provável: o worker parou, e as mensagens acumulam-se). Não reinicias tudo: perdes o estado que te ajudaria a diagnosticar, e podes esconder o problema. Se o RabbitMQ estiver sem memória, ele pode bloquear os publishers (*flow control*), e a API fica pendurada ou com erro, o que explica o `500`.

**P3.** Passo 1: `ADD COLUMN` nullable (rápido, sem reescrever). Passo 2: preencher em lotes (`UPDATE ... WHERE id BETWEEN ...`) fora de uma transação longa, para não bloquear escritas. Passo 3: `ALTER COLUMN SET NOT NULL` (rápido se a validação já estiver garantida, ou com `CHECK ... NOT VALID` seguido de `VALIDATE`). Em versões antigas do Postgres, um `DEFAULT` com função volátil reescrevia a tabela inteira com um lock exclusivo.

**P4.** Servidor: (a) cache com dados antigos (invalidação falhou ou houve corrida ao re-popular a cache); (b) dois pedidos concorrentes, um a gravar `done=false` depois do outro; (c) o polling ou a recarga do frontend a ler antes da escrita ter chegado. Cliente: um separador antigo com estado em memória, sem recarga. Para distinguir: `curl` direto à API (sem cache do browser) e olhar para o `X-Cache` e para o valor na BD.

**P5.** Sim, com dois consumidores, ou com reentregas: a mensagem `created` pode ser reprocessada depois da `completed`. Para o nosso worker, cada evento é uma linha independente com `ON CONFLICT`, por isso a ordem não importa para a contagem. Para um histórico "a última ganha", a ordem importa e seria um bug. Soluções: versão no evento e rejeitar versões antigas, ou particionar por `task_id` (um só consumidor por tarefa).

**P6.** Alerta sobre crescimento da DLQ (não sobre o tamanho absoluto), enviado a quem é responsável pelo worker, com o runbook: (1) ver o cabeçalho `x-death` e o `reason`; (2) agrupar por tipo de erro; (3) corrigir a causa; (4) reenviar em lote; (5) se for lixo, descartar com registo. Uma DLQ sem dono é um depósito de dados perdidos.
</details>
