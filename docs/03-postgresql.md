# 03 · PostgreSQL, SQL e migrações

**Objetivo:** perceber porque usamos uma BD relacional, escrever SQL seguro, e evoluir o schema sem partir dados.

**Ficheiros para ler primeiro:** `src/api/src/db/migrations/001_create_tasks.sql`, `002_create_task_events.sql`, `src/api/src/repositories/taskRepository.js`, `src/api/src/db/migrate.js`, `src/api/src/db/pool.js`.

---

## 1. Porque uma BD relacional?

Os dados aqui têm **estrutura fixa** e **relações** (uma tarefa tem id, título, estado; um evento aponta para uma tarefa). Uma BD relacional dá-te de graça:

- **Tipos**: `INTEGER` não aceita `"abc"`.
- **Restrições** (constraints): `CHECK (char_length(title) BETWEEN 1 AND 200)` é aplicado **pela BD**, mesmo que a API tenha um bug.
- **Transações**: ou tudo acontece, ou nada.
- **Consultas ad-hoc**: `SELECT ... GROUP BY` sem precisar de código novo.

Alternativa (NoSQL, ex.: MongoDB): flexível no schema, mas perdes as garantias acima e tens de as reimplementar na aplicação. Não é "melhor" nem "pior": é um trade-off (módulo 12).

## 2. Lê o schema

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id         SERIAL PRIMARY KEY,
  title      TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  done       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Pergunta cada coluna:

- `SERIAL PRIMARY KEY`: `id` autoincrementa e é a chave que identifica a linha. Repara que o `SERIAL` gera `int4`. Ver a armadilha na secção 5.
- `NOT NULL`: a coluna tem sempre valor. Sem isto, `NULL` seria um valor "possível" e teria de ser tratado em todo o código.
- `DEFAULT now()`: a BD preenche a data. Não dependemos de o cliente ter o relógio certo (bem, dependemos do relógio do servidor da BD).
- `TIMESTAMPTZ` e não `TIMESTAMP`: guarda com fuso horário, normalizado para UTC. Quase sempre é o que queres.

**Pergunta:** porque é que a `task_events` **não** tem uma `FOREIGN KEY` para `tasks(id)`?

<details>
<summary>Resposta</summary>

Um evento de "tarefa concluída" pode ser processado pelo worker **depois** de a tarefa ter sido apagada (a fila tem atraso). Com uma FK, a inserção falharia e o evento iria para retry eterno. Como auditoria, o evento deve sobreviver à tarefa. É uma decisão consciente, e deve ser justificada, não aplicada por hábito.
</details>

## 3. SQL seguro: parâmetros, sempre

Lê `taskRepository.js`:

```js
pool.query('INSERT INTO tasks (title) VALUES ($1) RETURNING ...', [title]);
```

**Nunca** faças isto:

```js
// ❌ SQL INJECTION
pool.query(`INSERT INTO tasks (title) VALUES ('${title}')`);
```

Se `title` for `x'); DROP TABLE tasks; --`, o SQL executado é destrutivo. Com `$1`, o driver envia o SQL e o valor **separados**: o valor nunca é interpretado como SQL.

Regra que se aplica a **tudo**: nomes de tabelas e colunas não vêm como parâmetros (`$1` só serve para valores). Se precisares de nomes dinâmicos, usa uma lista branca (whitelist).

**Experiência** (tenta a injeção na API, que está protegida):

```bash
curl -s -X POST localhost:8080/api/tasks -H 'Content-Type: application/json' \
  -d '{"title":"x'"'"'); DROP TABLE tasks; --"}'
```

Depois confirma que a tabela ainda existe: `docker compose -f config/docker-compose.yml exec postgres psql -U workshop -d workshop -c '\dt'`.

## 4. RETURNING: pedir a linha de volta

Em Postgres, `INSERT`, `UPDATE` e `DELETE` podem devolver as linhas afetadas com `RETURNING`. Evita um segundo `SELECT` e evita uma **condição de corrida** (outro processo poderia alterar a linha entre o `INSERT` e o `SELECT`).

## 5. A armadilha do `bigint` (vale ouro)

O driver `pg` devolve tipos de 64 bits (`bigint`/`int8`) como **string**, porque o JavaScript só tem precisão segura até 2⁵³.

```js
// Com BIGSERIAL:
{ id: "9007199254740993" }  // string!
// Com SERIAL (int4):
{ id: 1 }                   // número
```

Por isso escolhemos `SERIAL` e usamos `::int` no `COUNT(*)` em `stats()`. Se não soubesses isto, `task.id === 1` falharia em silêncio com `"1"`.

## 6. Pool de ligações

Lê `db/pool.js`. Abrir uma ligação TCP e autenticar-se no Postgres é caro (dezenas de ms). O `Pool` mantém até 10 ligações abertas e **empresta-as** a cada query. Com `max: 10` e vários pedidos em simultâneo, os pedidos a mais esperam na fila do pool.

**Consequência:** se uma query demorar muito e segurar a ligação, o pool esgota-se e **todos** os pedidos bloqueiam. É um modo de falha clássico.

## 7. Migrações: evoluir o schema sem partir dados

O schema **muda** com o tempo. Não se "edita a tabela à mão" em produção. Cada alteração é um **ficheiro versionado**:

```
migrations/
  001_create_tasks.sql
  002_create_task_events.sql
```

`migrate.js` faz três coisas:

1. Cria `schema_migrations`, uma tabela que regista o que já foi aplicado.
2. Lê os `.sql` por ordem alfabética (por isso o prefixo numérico).
3. Aplica só os que faltam, **cada um numa transação** (`BEGIN`/`COMMIT`/`ROLLBACK`).

**Regra de ouro:** **nunca edites uma migração que já foi aplicada.** Em produção ela já correu, e a tua alteração não chega a lado nenhum (ou pior, cria divergência entre ambientes). Cria sempre um ficheiro novo.

**Experiência:**

```bash
docker compose -f config/docker-compose.yml exec postgres \
  psql -U workshop -d workshop -c 'SELECT * FROM schema_migrations;'
```

## 8. Consola SQL

```bash
docker compose -f config/docker-compose.yml exec postgres psql -U workshop -d workshop
```

Comandos úteis: `\dt` (tabelas), `\d tasks` (estrutura), `EXPLAIN ANALYZE SELECT ...` (plano de execução).

Experimenta:

```sql
EXPLAIN ANALYZE SELECT * FROM tasks ORDER BY created_at DESC;
```

Porque é que existe o índice `tasks_created_at_idx`? Corre o `EXPLAIN` com mais de 100 000 linhas (`INSERT ... SELECT generate_series(...)`) com e sem o índice (`DROP INDEX`). Mede a diferença. Um índice acelera leituras e **custa** escritas e espaço. Não se põem índices em tudo.

## 9. `ON CONFLICT`: upsert e idempotência

Na tabela `task_events`:

```sql
INSERT INTO task_events (event_id, ...) VALUES (...)
ON CONFLICT (event_id) DO NOTHING
RETURNING event_id;
```

Se a chave já existe, nada é inserido e `RETURNING` não devolve linhas. O código do worker usa exatamente isto para saber se um evento é novo (módulo 07). É a forma **atómica** de fazer "inserir se não existir": fazer um `SELECT` antes e depois um `INSERT` tem uma janela de corrida entre os dois.

## 10. Transações

`migrate.js` usa `BEGIN` / `COMMIT` / `ROLLBACK`. Experiência: escreve uma migração falsa com um erro no meio:

```sql
-- 003_teste.sql
CREATE TABLE teste (id int);
SELECT 1/0;   -- erro de divisão por zero
```

O ficheiro vai dentro da imagem da API, por isso tens de a **reconstruir**: `docker compose ... up -d --build api`. Vê os logs da API: a migração falha e o processo sai. A tabela `teste` **não** deve existir (`\dt`). O `ROLLBACK` desfez o `CREATE`. Depois **apaga o ficheiro**, porque ele falha sempre.

## 11. Índices vs consistência: o que a BD garante e o que não

A BD garante consistência **dentro** de uma transação. Não garante consistência **entre** serviços (a BD e o RabbitMQ). Este é o tema do módulo 06 (dual-write).

---

## Perguntas de pensamento crítico

1. A coluna `done` é `BOOLEAN NOT NULL DEFAULT FALSE`. Que bug evita cada uma das três partes?
2. Porque é que `stats()` faz três subconsultas numa só query em vez de três queries separadas? Que custo se evita?
3. Se duas pessoas marcarem a mesma tarefa como concluída **exatamente** ao mesmo tempo, quantos eventos `task.completed` são publicados? Porquê? (Pista: lê `updateTask` no serviço e pensa no intervalo entre o `findById` e o `setDone`.)

<details>
<summary>Resposta</summary>

1. `BOOLEAN` impede valores como `"sim"`; `NOT NULL` impede o terceiro estado ambíguo (`NULL`, nem verdadeiro nem falso); `DEFAULT FALSE` garante que um `INSERT` sem o campo não falha nem fica indefinido.
2. Cada query é um round-trip à rede, com custo de latência e de ligação ocupada. Uma query só é uma ida e volta.
3. Podem ser **dois**. Ambos fazem `findById`, veem `done = false`, e ambos publicam. Isto é uma **condição de corrida** (race condition) na lógica de aplicação. Soluções: `UPDATE ... WHERE done = false RETURNING` (a BD decide quem ganha), ou um lock de linha com `SELECT ... FOR UPDATE`. Repara que o teste unitário não apanha isto, porque corre sequencialmente. Discutiremos em `10-testes` e `12-decisoes`.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 03`.

**1.** Porque usar parâmetros ($1, $2) em vez de concatenar strings no SQL?

- a) É mais rápido a executar
- b) Evita SQL injection: separa o SQL dos valores enviados pelo utilizador
- c) É uma exigência sintática do driver pg
- d) Não há diferença real

<details><summary>Resposta</summary>

**b) Evita SQL injection: separa o SQL dos valores enviados pelo utilizador** — Com parâmetros, o valor nunca é interpretado como SQL, por mais hostil que seja.

</details>

**2.** Porque é que o driver pg devolve BIGINT como string em JavaScript?

- a) É um bug conhecido do driver
- b) Porque o JS só tem precisão segura até 2^53, e um bigint pode exceder isso
- c) Porque strings são mais seguras contra injection
- d) O Postgres exige esse formato

<details><summary>Resposta</summary>

**b) Porque o JS só tem precisão segura até 2^53, e um bigint pode exceder isso** — É por isso que o projeto usa SERIAL (int4) em vez de BIGSERIAL para o id das tarefas.

</details>

**3.** Que cláusula SQL torna um INSERT idempotente, ignorando a inserção se a chave já existir?

<details><summary>Resposta</summary>

**on conflict do nothing** — ON CONFLICT (coluna) DO NOTHING é a base da idempotência do worker e do serviço Spring.

</details>

**4.** Porque é que task_events NÃO tem FOREIGN KEY para tasks(id)?

- a) Foi um esquecimento
- b) O evento pode chegar depois de a tarefa ser apagada; é um registo de auditoria que deve sobreviver aos dados
- c) O Postgres não suporta FK nesse caso
- d) Seria mais lento ter a FK

<details><summary>Resposta</summary>

**b) O evento pode chegar depois de a tarefa ser apagada; é um registo de auditoria que deve sobreviver aos dados** — É uma decisão consciente: a FK faria o INSERT falhar para eventos tardios de tarefas já apagadas.

</details>

**5.** Para que serve correr uma migração dentro de BEGIN/COMMIT/ROLLBACK?

- a) Só por estilo, sem efeito
- b) Garante que, se algo falhar a meio, nada da migração fica parcialmente aplicado
- c) Torna a migração mais rápida
- d) É uma exigência do Postgres para qualquer query

<details><summary>Resposta</summary>

**b) Garante que, se algo falhar a meio, nada da migração fica parcialmente aplicado** — Uma migração falhada a meio, sem transação, deixaria o schema num estado inconsistente.

</details>

<!-- quiz:end -->
