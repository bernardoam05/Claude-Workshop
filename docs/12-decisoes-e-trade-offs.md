# 12 · Decisões e trade-offs

**Objetivo:** este é o módulo de **pensamento crítico**. Cada decisão deste projeto tem alternativas válidas. O que se pretende não é decorar as escolhas, mas saber **justificar** uma escolha, reconhecer o custo que ela tem, e dizer **quando** a mudarias.

Formato de cada entrada: **decisão** → alternativas → custo aceite → quando mudar.

---

## 1. Arquitetura

### 1.1 Porque separar um worker da API?
- **Alternativa:** processar os eventos dentro do próprio pedido HTTP.
- **Ganhos:** escala independente, isolamento de falhas, a API não fica lenta por causa de trabalho secundário.
- **Custo:** consistência eventual, mais um processo para operar, mais um sítio para falhar.
- **Mudar quando:** o trabalho é curto, tem de ser síncrono para o utilizador, e não há volume que justifique a complexidade.

### 1.2 Porque REST e não GraphQL ou gRPC?
- **REST:** HTTP nativo, cacheável, fácil de testar com `curl`, convenções conhecidas.
- **GraphQL:** bom quando clientes diferentes precisam de formas diferentes dos mesmos dados. Aqui há um só cliente.
- **gRPC:** eficiente para comunicação **entre serviços internos**, com contratos fortes. Não é o browser que o fala nativamente.
- **Mudar quando:** muitos clientes com necessidades diferentes (GraphQL), ou muita comunicação interna entre serviços (gRPC).

### 1.3 Porque um monólito modular e não microserviços?
Este projeto tem **três** processos, mas só **um** domínio. Microserviços têm custo operacional (rede, deploy, observabilidade, consistência entre serviços). Só compensam quando equipas diferentes precisam de deploys independentes. Estamos mais perto de um monólito com um worker do que de microserviços.

---

## 2. Dados

### 2.1 Porque PostgreSQL?
- **Alternativas:** MySQL/MariaDB (equivalentes), MongoDB (schema flexível), SQLite (ficheiro, sem servidor).
- **Porquê:** garantias transacionais, tipos fortes, `ON CONFLICT`, `JSONB` quando precisas de flexibilidade pontual, ecossistema.
- **Mudar quando:** padrões de acesso de chave-valor com volume enorme (Redis/DynamoDB), ou dados de séries temporais (TimescaleDB ou similar).

### 2.2 `SERIAL` (inteiro) ou `UUID` para a chave primária?
- **`SERIAL`**: pequeno, rápido de indexar, ordenável por criação. Mas **revela** o volume (`/tasks/1000` diz que há ~1000 tarefas) e é difícil de gerar em vários sítios sem coordenação.
- **`UUID`**: gerável em qualquer lado sem coordenação, não revela volume. Mais pesado no índice.
- **Decisão aqui:** `SERIAL` para a tabela de tarefas (um só servidor de BD), e `UUID` para o `eventId` (gerado pela API, sem coordenação com o worker). Dá para perceber porque se escolheu cada um.

### 2.3 Porque não há `FOREIGN KEY` em `task_events`?
Já vimos no módulo 03: o evento pode chegar depois do apagamento. A integridade referencial é **uma garantia útil**, e abdicar dela tem de ser uma decisão consciente. Aqui a `task_events` é um **registo de auditoria**, e os registos de auditoria devem sobreviver aos dados que descrevem.

### 2.4 Migrações feitas por nós (`migrate.js`) ou por uma ferramenta?
- **Nós:** ~40 linhas, zero dependências, perceptível de cabo a rabo. Ótimo para aprender.
- **Ferramentas** (Flyway, Liquibase, Prisma Migrate, Knex, node-pg-migrate): suportam rollback, *locks* entre instâncias, *dry-run*, integração com CI.
- **Limitação do nosso:** **não** tem lock. Se duas instâncias da API arrancarem ao mesmo tempo, podem tentar aplicar a mesma migração. Só funciona bem porque a API corre uma instância. **Isto é um bug latente** se escalares a API. O exercício C13 pede que o corrijas.
- **Mudar quando:** o primeiro deploy em produção. Não fiques com o que aprendeste em produção.

---

## 3. Cache

### 3.1 Redis ou cache em memória no processo?
- **Memória do processo**: zero infraestrutura, latência mínima. Mas **cada réplica** tem a sua cache e as invalidações não se propagam.
- **Redis**: partilhado, persistência opcional, mais um serviço para operar.
- **Mudar quando:** uma única instância para sempre (aí a memória do processo chega).

### 3.2 Invalidar (`del`) ou atualizar (`set`) na escrita?
- **Invalidar**: simples e correto. Custo: a próxima leitura paga a ida à BD.
- **Atualizar**: a cache fica quente, mas exige recalcular o valor a partir de dados que podem estar a mudar em paralelo → condições de corrida.
- **Escolha:** invalidar. Ver módulo 05.

---

## 4. Mensagens

### 4.1 RabbitMQ ou Kafka? (ou Redis Streams, ou SQS)
| | RabbitMQ | Kafka | Redis Streams | SQS |
|---|---|---|---|---|
| Modelo | fila + routing | log particionado | log simples | fila gerida |
| Retenção após consumo | apaga após `ack` | mantém por tempo/tamanho | mantém | apaga após `delete` |
| Reprocessar histórico | difícil | **nativo** | sim | não |
| Routing flexível | **sim** (exchanges) | por tópico/partição | não | limitado |
| Operação | um broker | cluster, complexo | já tens Redis | gerido pela AWS |

- **Porquê RabbitMQ aqui:** modelo de **tarefas** (um evento, um efeito), routing por padrão (`task.*`), DLQ nativa, curva de aprendizagem suave.
- **Kafka** se precisares de **reprocessar histórico** ou de *event sourcing*, ou de volumes de milhões por segundo.
- **Mudar quando:** precisares de reproduzir eventos antigos para um consumidor novo, ou tiveres volume que o RabbitMQ não aguente.

### 4.2 Estatísticas: `COUNT` na BD ou contador Redis com `INCR`?
Esta é **a** decisão mais instrutiva do projeto. A versão inicial era `INCR` no Redis.

- **`INCR`**: rápido, sem consulta à BD. Mas são **duas escritas** (`task_events` na BD + `INCR` no Redis) sem transação comum. Se o processo morrer entre elas, o contador fica **errado para sempre**, e a reentrega não corrige (o `INSERT` já deu `duplicado`, e o `INCR` nunca é repetido).
- **`COUNT` na BD**: uma só fonte de verdade. Custo: uma consulta a cada 5 segundos (com cache de 5s, é barata).
- **Decisão:** `COUNT`. Correção antes de velocidade, porque a velocidade não é necessária aqui e a correção não se recupera depois.
- **Regra geral:** **não mantenhas dois sistemas sincronizados à mão** se puderes ter uma fonte de verdade e uma projeção calculada.

### 4.3 Publicar depois de gravar (como fazemos) ou outbox?
Já vimos o **dual-write** (módulo 06). Hoje, se o RabbitMQ estiver em baixo, a tarefa fica gravada e o cliente recebe erro. É uma **inconsistência conhecida e aceite**.

- **Outbox:** resolve, mas adiciona uma tabela, um processo de relay e lógica de retry. É o caminho para produção.
- **Mudar quando:** um evento perdido tiver consequências reais (faturação, notificações legais).

### 4.4 `ack` manual ou automático?
Manual, porque o efeito do processamento tem de estar feito antes de a mensagem sair da fila. O custo é código de tratamento de erros (já o temos). Ver módulo 06.

---

## 5. Frontend e comunicação

### 5.1 Polling ou WebSocket para as estatísticas?
Polling a cada 3s. Um pedido barato com cache de 5s no servidor. WebSocket traria estado de ligação, reconexão e balanceamento sticky, para um ganho de 3 segundos de latência num contador. **Não compensa.** Mudar quando o requisito for "ver a chegada de mensagens em tempo real" com latência de centésimos de segundo.

### 5.2 React ou framework mais simples (HTMX, Svelte, Vue)?
Igualmente válidos. React tem o maior ecossistema e o maior mercado de emprego, o que conta para aprender. Não é o mais simples: para uma página com um formulário, HTMX ou JS puro chegavam.

### 5.3 SPA ou renderização no servidor (SSR)?
SPA (o que temos): simples de servir como ficheiros estáticos, interação rica, mas o primeiro carregamento é mais lento e o SEO é pior. SSR/SSG (Next.js, Astro): melhor para conteúdo público. Esta app é privada, por isso a SPA é a escolha natural.

---

## 6. Infraestrutura

### 6.1 Docker Compose ou Kubernetes?
Compose descreve a stack para **um** host. Kubernetes orquestra **muitos** hosts, com autoescala, self-healing e rolling updates. Para desenvolvimento e um servidor pequeno, Compose chega. Kubernetes tem um custo operacional alto que só se justifica com escala ou requisitos de disponibilidade. Não o escolhas por moda.

### 6.2 Nginx ou um gateway de aplicação (Traefik, Caddy)?
Nginx é maduro e está em todo o lado. Caddy trata de HTTPS automaticamente. Traefik integra-se com Docker e Kubernetes e descobre serviços sozinho. Escolha por contexto.

### 6.3 Imagem Alpine ou Debian?
Alpine é menor, mas usa `musl` em vez de `glibc`, o que pode dar problemas com binários nativos pré-compilados. Debian-slim é o compromisso mais seguro quando há dependências nativas. Aqui o Alpine funciona porque não há.

---

## 7. O que falta para produção

Este sistema é um **laboratório**. Para ir para produção, falta, pelo menos:

- [x] **Autenticação e autorização**: JWT com hash bcrypt e tarefas por utilizador (implementado).
- [ ] **Sessões mais seguras**: token em cookie `httpOnly` em vez de `localStorage`, refresh tokens e revogação.
- [ ] **HTTPS**: o Nginx serve em HTTP simples.
- [ ] **Limite de pedidos** (rate limiting) no Nginx ou na API.
- [ ] **Outbox** para o dual-write.
- [ ] **Migrações com lock** e rollback.
- [ ] **Segredos fora do compose**: vêm de um cofre (Vault, AWS Secrets Manager, variáveis do orquestrador).
- [ ] **Logs estruturados, métricas e traces** (módulo 10).
- [ ] **Backups** da BD e **teste de restauro** (um backup nunca testado não é um backup).
- [x] **CI**: testes, build, integração e teste de fumo a cada push (`.github/workflows/ci.yml`).
- [ ] **Publicar imagens versionadas** num registo, a partir do CI.
- [ ] **Limites de recursos** nos contentores (`mem_limit`, `cpus`).
- [x] **Testes de integração** com BD real (implementado).
- [ ] **Correção do `migrate.js`** para múltiplas instâncias.
- [ ] **Alertas** sobre o tamanho da DLQ e sobre a latência de consumo.

Repara que a lista não é "mais tecnologia". É, sobretudo, **operação**: saber o que acontece quando algo falha, e ser capaz de o ver.

---

## Exercício final de pensamento crítico

Um colega chega com esta proposta: *"Vamos pôr o worker a fazer a chamada à BD diretamente, e a API passa a publicar só um `POST` HTTP ao worker. Assim tiramos o RabbitMQ, que é mais uma peça para manter."*

Escreve, em 10 linhas, a tua resposta. Deves cobrir:

1. O que ganha e o que perde a proposta.
2. Se o problema de consistência fica resolvido, agravado, ou muda de forma.
3. O que farias **em vez disso**, e porquê.
4. Que informação te faltaria para decidir com confiança (requisitos de volume, tolerância a perda, equipa, orçamento).

<details>
<summary>Pistas (só depois de escreveres a tua)</summary>

- Trocar uma fila por uma chamada HTTP síncrona **remove o desacoplamento e a resiliência**: se o worker estiver em baixo, a API falha. A fila existia para isso.
- A API passa a depender da disponibilidade do worker: ganhaste um acoplamento novo.
- Um `POST` HTTP **não é** uma fila: não tem persistência, retries nem DLQ. Terias de reimplementar tudo isso à mão.
- Se o problema é a "peça a mais para manter", a resposta mais útil pode ser: manter a fila, mas usar um serviço gerido, ou (se o volume for pequeno) substituir por tabela de jobs em Postgres com `SELECT ... FOR UPDATE SKIP LOCKED`, que é uma fila razoável para volumes baixos e **não adiciona nenhuma peça nova**. Este é um bom exemplo de que a alternativa mais simples pode ser a melhor, mas só se o volume o permitir.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 12`.

**1.** Porque se escolheu SERIAL em vez de UUID para o id das tarefas?

- a) UUID não existe no Postgres
- b) SERIAL é mais pequeno/rápido com um só servidor de BD; UUID compensa quando não há coordenação central (como o eventId)
- c) Não há diferença prática entre os dois
- d) SERIAL é sempre mais seguro

<details><summary>Resposta</summary>

**b) SERIAL é mais pequeno/rápido com um só servidor de BD; UUID compensa quando não há coordenação central (como o eventId)** — É por isso que o eventId (gerado em vários sítios, sem coordenação) usa UUID, mas o id da tarefa usa SERIAL.

</details>

**2.** Porque se calculam as estatísticas com COUNT na BD em vez de um contador Redis (INCR)?

- a) COUNT é sempre mais rápido que INCR
- b) INCR seria uma segunda escrita desincronizada da BD (dual-write): uma falha entre as duas deixaria o contador errado para sempre
- c) O Redis não suporta a operação INCR
- d) Não há diferença prática entre as duas abordagens

<details><summary>Resposta</summary>

**b) INCR seria uma segunda escrita desincronizada da BD (dual-write): uma falha entre as duas deixaria o contador errado para sempre** — COUNT lê sempre a fonte de verdade; não há duas escritas para ficarem dessincronizadas.

</details>

**3.** Que padrão resolve o dual-write ao gravar o evento na MESMA transação SQL da mudança de negócio?

<details><summary>Resposta</summary>

**outbox** — Um processo separado (relay) lê a tabela outbox e publica, de forma assíncrona e sem perdas.

</details>

**4.** Porque se escolheu REST em vez de GraphQL para este projeto?

- a) GraphQL não tem bibliotecas para Node
- b) REST é sempre tecnicamente superior
- c) Há só UM cliente (o frontend); REST é mais simples nesse caso — GraphQL compensaria com VÁRIOS clientes com necessidades diferentes
- d) GraphQL é incompatível com Express

<details><summary>Resposta</summary>

**c) Há só UM cliente (o frontend); REST é mais simples nesse caso — GraphQL compensaria com VÁRIOS clientes com necessidades diferentes** — A escolha depende do contexto, não é uma regra absoluta.

</details>

**5.** Segundo o próprio módulo, o que falta a este sistema para ir para produção?

- a) Nada, já está pronto tal como está
- b) Coisas como HTTPS, rate limiting, outbox, lock nas migrações, segredos geridos e backups testados
- c) Só precisa de mais memória RAM
- d) Só falta trocar Node por Java

<details><summary>Resposta</summary>

**b) Coisas como HTTPS, rate limiting, outbox, lock nas migrações, segredos geridos e backups testados** — O módulo lista explicitamente uma checklist do que falta, mesmo depois de todas as iterações.

</details>

<!-- quiz:end -->
