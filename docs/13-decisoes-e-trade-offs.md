# 13 · Decisões e trade-offs

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
- [ ] **Logs estruturados, métricas e traces** (módulo 11).
- [ ] **Backups** da BD e **teste de restauro** (um backup nunca testado não é um backup).
- [x] **CI**: testes, build, integração e teste de fumo a cada push (`.github/workflows/ci.yml`).
- [ ] **Publicar imagens versionadas** num registo, a partir do CI.
- [ ] **Limites de recursos** nos contentores (`mem_limit`, `cpus`).
- [x] **Testes de integração** com BD real (implementado).
- [ ] **Correção do `migrate.js`** para múltiplas instâncias.
- [ ] **Alertas** sobre o tamanho da DLQ e sobre a latência de consumo.

Repara que a lista não é "mais tecnologia". É, sobretudo, **operação**: saber o que acontece quando algo falha, e ser capaz de o ver.

---

## Prática: escreve tu

Um trade-off descrito convence pouco. Um trade-off **medido** fica. Nos dois primeiros exercícios escreves as **duas** alternativas de uma decisão, e os testes mostram a diferença com números e com um defeito concreto. No terceiro escreves a decisão como se escreve numa empresa: um ADR.

**Verificar:** `npm run verificar 13` (dentro de `pratica/`). Só um exercício: `npm run verificar 13 paginacao`, `... 13 resumo` ou `... 13 adr`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Paginação: offset ou cursor? (≈40 min)

**Ficheiro:** `pratica/13-decisoes-e-trade-offs/paginacao.js`

Escreve as duas formas de paginar a mesma lista. A primeira, com `LIMIT`/`OFFSET`, é a que toda a gente escreve primeiro. A segunda, por **cursor** (*keyset pagination*), pede "as próximas N tarefas **depois desta**".

Um dos testes do offset é estranho de propósito: **prova o defeito**. Cria uma tarefa entre a página 1 e a 2, e confirma que a página 2 repete uma tarefa. O teste equivalente do cursor confirma que isso não acontece. É este par de testes que justifica a decisão do P3.

**Sintaxe que vais praticar:** `LIMIT $1 OFFSET $2`, `WHERE ($1::int IS NULL OR id < $1)`, `Buffer.from(...).toString('base64url')` e o caminho inverso, `JSON.parse` dentro de `try`, `.slice()` e `.at(-1)`.

<details>
<summary>Pista</summary>

Para saber se há página seguinte **sem** uma query extra, pede `tamanho + 1` linhas: se vierem todas, há mais; devolves só `tamanho` e usas o id da última para o cursor. O cursor é "opaco": codifica `{ ultimoId }` em base64url, para o cliente não depender do que tem lá dentro.
</details>

<details>
<summary>Solução de referência</summary>

```js
export async function listarPorOffset(db, pagina, tamanho) {
  const { rows } = await db.query('SELECT id, title FROM tasks ORDER BY id DESC LIMIT $1 OFFSET $2', [
    tamanho,
    (pagina - 1) * tamanho,
  ]);
  return rows;
}

// O cursor é "opaco": o cliente não deve depender do que tem lá dentro. Hoje é o último id;
// amanhã pode ser (data, id), e nenhum cliente parte por causa disso.
const codificar = (ultimoId) => Buffer.from(JSON.stringify({ ultimoId })).toString('base64url');

function descodificar(cursor) {
  try {
    const { ultimoId } = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Number.isInteger(ultimoId)) return ultimoId;
  } catch {
    // cai no throw de baixo
  }
  throw new Error('Cursor inválido');
}

export async function listarPorCursor(db, cursor, tamanho) {
  const depoisDe = cursor === null ? null : descodificar(cursor);
  // Pedimos UMA a mais: se vier, sabemos que há página seguinte sem fazer outra query.
  const { rows } = await db.query(
    `SELECT id, title FROM tasks
     WHERE ($1::int IS NULL OR id < $1)
     ORDER BY id DESC
     LIMIT $2`,
    [depoisDe, tamanho + 1],
  );
  const haMais = rows.length > tamanho;
  const tarefas = rows.slice(0, tamanho);
  return { tarefas, proximoCursor: haMais ? codificar(tarefas.at(-1).id) : null };
}
```
</details>

### P2 · N+1 queries contra um JOIN (≈35 min)

**Ficheiro:** `pratica/13-decisoes-e-trade-offs/resumo.js`

O problema de desempenho mais comum em aplicações com BD: pedir uma lista e depois, **para cada elemento**, ir buscar os seus filhos. Escreve as duas versões do mesmo resumo (projetos e os títulos das suas tarefas). Os testes confirmam que dão **o mesmo resultado**, contam as queries, e medem o tempo com 2 ms de "rede" por query (a latência típica entre uma API e uma BD na mesma cloud).

Repara no número que o teste escreve no relatório. Com 50 projetos, a diferença já é de mais de uma ordem de grandeza. Com 5000, a versão N+1 deixa de ser uma opção.

**Sintaxe que vais praticar:** `for...of` com `await` lá dentro (a forma "ingénua" e sequencial), `LEFT JOIN` + `GROUP BY`, `json_agg(... ORDER BY ...)`, `FILTER (WHERE ...)`, `COALESCE`.

<details>
<summary>Pista</summary>

`json_agg(t.title ORDER BY t.id)` junta os títulos de cada grupo num array JSON, e o driver devolve-o já como array de JavaScript. Para um projeto sem tarefas, o `LEFT JOIN` cria uma linha com `t.title` a `NULL`: o `FILTER (WHERE t.id IS NOT NULL)` tira-a, e o resultado fica `NULL`, que o `COALESCE(..., '[]')` troca por um array vazio.
</details>

<details>
<summary>Solução de referência</summary>

```js
export async function resumoN1(db) {
  const { rows: projetos } = await db.query('SELECT id, name FROM projects ORDER BY id');
  const resultado = [];
  for (const p of projetos) {
    // Uma ida à BD POR projeto: com 50 projetos, 50 viagens pela rede.
    const { rows } = await db.query('SELECT title FROM tasks WHERE project_id = $1 ORDER BY id', [p.id]);
    resultado.push({ projeto: p.name, tarefas: rows.map((r) => r.title) });
  }
  return resultado;
}

export async function resumoJoin(db) {
  // json_agg junta as linhas de cada grupo num array JSON, já na BD.
  // FILTER tira a linha "vazia" que o LEFT JOIN cria para um projeto sem tarefas;
  // COALESCE troca o NULL (grupo sem nada) por um array vazio.
  const { rows } = await db.query(`
    SELECT p.name AS projeto,
           COALESCE(json_agg(t.title ORDER BY t.id) FILTER (WHERE t.id IS NOT NULL), '[]') AS tarefas
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id
    GROUP BY p.id, p.name
    ORDER BY p.id
  `);
  return rows;
}
```

Os ORMs (Prisma, Hibernate, Entity Framework) escondem o SQL, e por isso escondem também este problema: `projeto.tarefas` dentro de um ciclo parece só acesso a uma propriedade. É a pergunta número um de quem revê código que usa um ORM.
</details>

### P3 · Escrever a decisão: um ADR (≈25 min)

**Ficheiro:** `pratica/13-decisoes-e-trade-offs/adr/0001-<tema>.md` (copia o `0000-modelo.md`)

O [módulo 16](16-trabalhar-numa-empresa.md#documentar-decisões-adrs) explica o que é um ADR (*Architecture Decision Record*). Escreve o teu primeiro, sobre a decisão do P1: offset ou cursor? Usa o que os testes te mostraram como **evidência** no Contexto, e sê honesto nas consequências negativas.

O verificador só confirma a **estrutura** (título, estado, contexto, decisão, pelo menos duas alternativas, consequências positivas **e** negativas). A qualidade do raciocínio, compara-a com a solução de referência.

<details>
<summary>Solução de referência</summary>

```markdown
# ADR 0001: Paginar a lista de tarefas por cursor, e não por offset

## Estado

Aceite

## Contexto

A lista de tarefas vai deixar de caber numa só resposta. Precisamos de páginas. A lista muda
enquanto o utilizador a percorre: o worker e outros separadores criam tarefas a qualquer momento.
O teste do P1 mostrou que, com OFFSET, uma tarefa criada entre a página 1 e a página 2 faz a
tarefa 7 aparecer duas vezes. Além disso, OFFSET 10000 obriga o Postgres a ler e deitar fora 10000
linhas antes de devolver as que interessam.

## Decisão

Vamos paginar por cursor (keyset pagination): cada página devolve um cursor opaco com o último id
visto, e a página seguinte pede "as tarefas com id menor do que este". A ordenação é por id
decrescente, que é estável e tem índice (a chave primária).

## Alternativas consideradas

- **OFFSET/LIMIT**: o mais simples de implementar e permite saltar para a página N. Rejeitado
  porque repete ou perde linhas quando a lista muda, e fica mais lento quanto mais fundo se vai.
- **Devolver tudo e paginar no frontend**: zero trabalho no backend. Rejeitado porque não escala:
  com milhares de tarefas, a primeira resposta fica enorme e lenta.
- **Cursor com (created_at, id)**: necessário se um dia a ordem deixar de ser a do id. Adiado: hoje
  o id já dá a ordem de criação, e um timestamp tem armadilhas de precisão (o JavaScript só guarda
  milissegundos, o Postgres guarda microssegundos).

## Consequências

### Positivas

- Nenhuma tarefa repetida ou perdida enquanto a lista muda.
- Desempenho constante em qualquer página, porque a query usa o índice da chave primária.
- O cursor é opaco: podemos mudar o que está lá dentro sem partir os clientes.

### Negativas

- Deixa de ser possível saltar diretamente para a "página 7": só se anda para a frente.
- Não sabemos o total de páginas sem uma query `count(*)` à parte.
- O código é um pouco mais complicado (codificar e validar o cursor, pedir uma linha a mais).
```
</details>

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

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 13`.

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
