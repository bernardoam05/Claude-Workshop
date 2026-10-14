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

Alternativa (NoSQL, ex.: MongoDB): flexível no schema, mas perdes as garantias acima e tens de as reimplementar na aplicação. Não é "melhor" nem "pior": é um trade-off (módulo 13).

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

## Prática: escreve tu

Os testes deste módulo correm num **PostgreSQL a sério**, mas dentro do Node: o [PGlite](https://pglite.dev) é o Postgres compilado para WebAssembly. Não precisas de Docker, e cada teste começa com uma base de dados nova, em memória. O SQL que escreves aqui corre igual no Postgres do `docker-compose`.

**Verificar:** `npm run verificar 03` (dentro de `pratica/`). Só um exercício: `npm run verificar 03 schema`, `... 03 queries` ou `... 03 taskRepository`.

Faz por ordem: o P2 e o P3 correm sobre as tabelas que **tu** crias no P1.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Escrever uma migração (≈30 min)

**Ficheiro:** `pratica/03-postgresql/schema.sql` (o `base.sql` já cria `users` e `task_events`)

Cria duas tabelas e um índice:

- `projects`: `id` gerado pela BD, `owner_id` (obrigatório, aponta para `users`; apagar o utilizador apaga os seus projetos), `name` (obrigatório, 1 a 100 caracteres, **único por dono**: dois utilizadores podem ter um projeto "Casa", o mesmo utilizador não), `created_at` (preenchido pela BD).
- `tasks`: `id`, `project_id` (obrigatório, aponta para `projects`, com o mesmo comportamento ao apagar), `title` (obrigatório, 1 a 200 caracteres), `done` (por omissão `false`), `due_date` (uma data **sem** hora, opcional), `created_at`.
- um índice em `tasks(project_id)`.

A migração tem de poder correr **duas vezes** sem erro.

Os testes não leem o teu SQL: tentam **violar** cada regra (inserir um nome vazio, um dono que não existe, um nome repetido...) e confirmam que o Postgres recusa com o código de erro certo. É assim que se testa um schema: pelas regras que ele garante.

**Sintaxe que vais praticar:** `CREATE TABLE IF NOT EXISTS`, `SERIAL PRIMARY KEY`, `NOT NULL`, `DEFAULT`, `CHECK (...)`, `REFERENCES ... ON DELETE CASCADE`, `UNIQUE (a, b)`, `CREATE INDEX IF NOT EXISTS`.

<details>
<summary>Pista</summary>

Relê as migrações em `src/api/src/db/migrations/`: têm quase tudo o que precisas. A unicidade "por dono" é uma restrição sobre **duas** colunas ao mesmo tempo, escrita como uma linha à parte dentro do `CREATE TABLE`. E repara: o Postgres cria um índice sozinho para `PRIMARY KEY` e `UNIQUE`, mas **não** para chaves estrangeiras. É por isso que o índice em `project_id` tem de ser pedido.
</details>

<details>
<summary>Solução de referência</summary>

```sql
CREATE TABLE IF NOT EXISTS projects (
  id         SERIAL PRIMARY KEY,
  owner_id   INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name       TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)            -- único POR dono, não na tabela inteira
);

CREATE TABLE IF NOT EXISTS tasks (
  id         SERIAL PRIMARY KEY,
  project_id INTEGER     NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  title      TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  done       BOOLEAN     NOT NULL DEFAULT FALSE,
  due_date   DATE,                   -- sem NOT NULL: nem todas as tarefas têm prazo
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O Postgres cria índices sozinho para PRIMARY KEY e UNIQUE, mas NÃO para chaves estrangeiras.
CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks (project_id);
```
</details>

### P2 · Seis consultas (≈45 min)

**Ficheiros:** `pratica/03-postgresql/queries/01-...sql` a `06-...sql` (o enunciado de cada uma está no próprio ficheiro)

O `seed.sql` enche as tuas tabelas com 3 utilizadores, 4 projetos e 11 tarefas. Escreve uma consulta por ficheiro. O teste compara o resultado **exato**: nomes das colunas, tipos e ordem das linhas.

Vão aparecer, por esta ordem: `JOIN`, `ORDER BY ... NULLS LAST`, `LEFT JOIN` com contagens (para não perder o projeto sem tarefas), aritmética de datas, `NOT EXISTS`, `GROUP BY` e, no fim, `HAVING`.

Uma armadilha de propósito: o `count(*)` devolve `bigint`, e o driver `pg` entrega `bigint` como **string** (relê a secção 5). O ambiente de testes reproduz isso. Se o teu resultado tiver `total: '2'` em vez de `total: 2`, já sabes porquê.

**Sintaxe que vais praticar:** `SELECT ... FROM ... JOIN ... ON`, `LEFT JOIN`, `WHERE`, `GROUP BY`, `HAVING`, `count(...) FILTER (WHERE ...)`, `::int`, `CURRENT_DATE`, `AS`.

<details>
<summary>Pista</summary>

- No P2b, `count(*)` contaria a linha "vazia" que o `LEFT JOIN` cria para o projeto sem tarefas. `count(t.id)` não conta, porque `t.id` é `NULL` nessa linha.
- No P2c, em Postgres, subtrair duas datas (`date - date`) dá um número inteiro de dias.
- No P2f, o `WHERE` filtra **linhas** antes de agrupar; o `HAVING` filtra **grupos** depois.
</details>

<details>
<summary>Solução de referência</summary>

```sql
-- 01-pendentes-mestrado.sql
SELECT t.title
FROM tasks t
JOIN projects p ON p.id = t.project_id
WHERE p.name = 'Mestrado' AND NOT t.done
ORDER BY t.due_date NULLS LAST, t.title;

-- 02-resumo-por-projeto.sql
-- LEFT JOIN mantém os projetos sem tarefas; count(t.id) conta só as linhas com tarefa (o NULL não conta).
SELECT
  p.name                                    AS project,
  count(t.id)::int                          AS total,
  count(t.id) FILTER (WHERE t.done)::int    AS done
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id
GROUP BY p.id, p.name
ORDER BY p.name;

-- 03-atrasadas.sql
-- date - date dá um inteiro (dias) em Postgres.
SELECT t.title, p.name AS project, CURRENT_DATE - t.due_date AS days_late
FROM tasks t
JOIN projects p ON p.id = t.project_id
WHERE NOT t.done AND t.due_date < CURRENT_DATE
ORDER BY days_late DESC;

-- 04-utilizadores-sem-projetos.sql
SELECT u.email
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.owner_id = u.id)
ORDER BY u.email;

-- 05-ranking-concluidas.sql
SELECT u.email, count(*)::int AS completed
FROM users u
JOIN projects p ON p.owner_id = u.id
JOIN tasks t ON t.project_id = p.id
WHERE t.done
GROUP BY u.id, u.email
ORDER BY completed DESC;

-- 06-projetos-sobrecarregados.sql
-- WHERE filtra LINHAS antes de agrupar; HAVING filtra GRUPOS depois de agrupar.
SELECT p.name AS project, count(*)::int AS pending
FROM projects p
JOIN tasks t ON t.project_id = p.id
WHERE NOT t.done
GROUP BY p.id, p.name
HAVING count(*) >= 3
ORDER BY pending DESC;
```

O P2d também se resolve com `LEFT JOIN projects p ON ... WHERE p.id IS NULL`. As duas formas são corretas; o `NOT EXISTS` diz a intenção de forma mais direta ("não existe nenhum projeto").
</details>

### P3 · Um repositório em JavaScript (≈45 min)

**Ficheiro:** `pratica/03-postgresql/taskRepository.js`

Agora o SQL sai dos ficheiros `.sql` e entra no código, como em `src/api/src/repositories/taskRepository.js`. Implementa cinco funções. Cada uma treina uma coisa diferente:

| Função | O que treina |
|---|---|
| `create` | `INSERT ... RETURNING`, parâmetros `$1`, aliases para camelCase |
| `complete` | `UPDATE ... RETURNING` e devolver `null` quando nada mudou |
| `search` | `ILIKE` com parâmetros, e um teste de **SQL injection** que tens de passar |
| `addEvent` | `ON CONFLICT DO NOTHING` e `rowCount` para saber se inseriu (idempotência, secção 9) |
| `createProjectWithTasks` | uma **transação** completa: `BEGIN`, `COMMIT`, `ROLLBACK`, e libertar a ligação |

**Sintaxe que vais praticar:** `await db.query(sql, [params])`, destructuring de `{ rows }` e `{ rowCount }`, `try`/`catch`/`finally`, template literals para o SQL (mas **nunca** para os valores).

<details>
<summary>Pista</summary>

- Uma transação tem de correr toda **na mesma ligação**. Com um pool, `db.query` pode usar uma ligação diferente a cada chamada; por isso pede-se um client com `db.connect()` e usa-se esse client para tudo. O `finally` com `client.release()` corre com ou sem erro.
- O teste de `search` com `'%'` é subtil: em `ILIKE`, `%` e `_` são wildcards. Mesmo passando o texto como parâmetro (o que impede SQL injection), um `%` do utilizador ainda significa "qualquer coisa". É preciso escapá-lo antes: `text.replace(/[\\%_]/g, '\\$&')`.
</details>

<details>
<summary>Solução de referência</summary>

```js
const COLUMNS = 'id, project_id AS "projectId", title, done';

// Em ILIKE, % e _ são wildcards. Escapamo-los para o texto do utilizador ser procurado tal como está.
const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

export function createTaskRepository(db) {
  return {
    async create(projectId, title) {
      const { rows } = await db.query(
        `INSERT INTO tasks (project_id, title) VALUES ($1, $2) RETURNING ${COLUMNS}`,
        [projectId, title],
      );
      return rows[0];
    },

    async complete(id) {
      const { rows } = await db.query(`UPDATE tasks SET done = true WHERE id = $1 RETURNING ${COLUMNS}`, [id]);
      return rows[0] ?? null;
    },

    async search(ownerId, text) {
      const { rows } = await db.query(
        `SELECT t.title
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         WHERE p.owner_id = $1 AND t.title ILIKE $2
         ORDER BY t.title`,
        [ownerId, `%${escapeLike(text)}%`],
      );
      return rows.map((r) => r.title);
    },

    async addEvent(eventId, type, taskId) {
      const { rowCount } = await db.query(
        `INSERT INTO task_events (event_id, type, task_id) VALUES ($1, $2, $3)
         ON CONFLICT (event_id) DO NOTHING`,
        [eventId, type, taskId],
      );
      return rowCount === 1;
    },

    async createProjectWithTasks(ownerId, name, titles) {
      // Uma transação tem de correr toda na MESMA ligação: por isso pedimos um client ao pool.
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const { rows: [project] } = await client.query(
          'INSERT INTO projects (owner_id, name) VALUES ($1, $2) RETURNING id, name',
          [ownerId, name],
        );
        const tasks = [];
        for (const title of titles) {
          const { rows } = await client.query(
            `INSERT INTO tasks (project_id, title) VALUES ($1, $2) RETURNING ${COLUMNS}`,
            [project.id, title],
          );
          tasks.push(rows[0]);
        }
        await client.query('COMMIT');
        return { ...project, tasks };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release(); // sempre, com ou sem erro: senão o pool fica sem ligações
      }
    },
  };
}
```
</details>

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
