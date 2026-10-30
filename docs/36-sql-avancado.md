# 36 · SQL avançado

**Objetivo:** escrever o SQL que as aplicações reais precisam e que o `SELECT ... WHERE` não chega para fazer: funções de janela, CTEs (incluindo as recursivas, para árvores), relatórios com séries sem buracos, subtotais e percentis, e índices escolhidos a partir das consultas e confirmados com o `EXPLAIN`.

**Ficheiros para ler:** `src/api/src/db/migrations/` (o esquema do workshop) e `src/api/src/repositories/` (as consultas da API).

**Pré-requisitos:** módulos 03 (PostgreSQL) e 04 (repositórios).

---

## 1. Fazer o trabalho onde estão os dados

É tentador ler as linhas para a aplicação e calcular lá: um ciclo `for` para o total acumulado, um `sort` para o top 3 de cada projeto, recursão em JavaScript para uma árvore de subtarefas. Funciona com 100 linhas. Com um milhão, transfere-se tudo pela rede, ocupa-se a memória da API, e perde-se o que a base de dados faz melhor: o planeador escolhe os índices e os algoritmos, e os dados não saem do sítio. Quase todas as vagas de backend testam SQL, e as perguntas são exatamente as deste módulo.

## 2. CTEs: dar nomes a partes de uma consulta

Uma CTE (*common table expression*, o `WITH`) é uma subconsulta com nome, que torna as consultas compridas legíveis de cima para baixo:

```sql
WITH abertas AS (
  SELECT * FROM tarefas WHERE concluida_em IS NULL
), por_utilizador AS (
  SELECT utilizador, count(*) AS n FROM abertas GROUP BY utilizador
)
SELECT * FROM por_utilizador WHERE n > 10;
```

## 3. Funções de janela

Um `GROUP BY` junta as linhas e perde-as: o resultado tem uma linha por grupo. Uma **função de janela** calcula sobre um conjunto de linhas relacionadas (a "janela"), mas **mantém cada linha**:

```sql
SELECT id, projeto, pontos,
       row_number() OVER (PARTITION BY projeto ORDER BY pontos DESC) AS posicao,
       sum(pontos)  OVER (PARTITION BY projeto)                      AS total_do_projeto,
       lag(concluida_em) OVER (PARTITION BY utilizador ORDER BY concluida_em) AS anterior
  FROM tarefas;
```

- `PARTITION BY` divide em grupos (como um `GROUP BY` que não junta);
- `ORDER BY` dentro do `OVER` define a ordem, e com ela as funções "acumuladas" (`sum(...) OVER (ORDER BY dia)` é um total acumulado);
- `row_number()`, `rank()` (com empates e saltos) e `dense_rank()` numeram;
- `lag()` e `lead()` leem a linha anterior e a seguinte;
- uma **moldura** (`ROWS BETWEEN 6 PRECEDING AND CURRENT ROW`) faz médias móveis.

O "top N por grupo", uma pergunta clássica de entrevista, é um `row_number()` numa subconsulta e um `WHERE posicao <= N` por fora (não se pode filtrar uma função de janela no próprio `WHERE`, porque ela é calculada depois).

## 4. CTEs recursivas: árvores e grafos

Uma tabela com `pai_id` guarda uma árvore (subtarefas, categorias, comentários em resposta, organogramas). Para obter uma subárvore inteira, uma CTE **recursiva** tem duas partes: a âncora (o ponto de partida) e o passo (que junta a tabela com o que já se encontrou), repetido até não aparecer nada de novo:

```sql
WITH RECURSIVE arvore AS (
  SELECT id, titulo, 0 AS nivel FROM tarefas WHERE id = 1         -- âncora
  UNION ALL
  SELECT t.id, t.titulo, a.nivel + 1                               -- passo
    FROM tarefas t JOIN arvore a ON t.pai_id = a.id
)
SELECT * FROM arvore;
```

Uma ida à base de dados, em vez de uma consulta por nível (o N+1 do módulo 46, outra vez). Para ordenar como uma árvore, guarda-se o caminho de ids num array e ordena-se por ele. Com dados que podem ter ciclos (um grafo, não uma árvore), é preciso parar: o Postgres tem a cláusula `CYCLE`, ou guarda-se o caminho e não se volta a um nó que já lá está (é a mesma ideia da pesquisa em grafos do módulo 30).

## 5. Relatórios

Três técnicas que aparecem em quase todos os relatórios:

- **Séries sem buracos**: um `GROUP BY dia` só devolve os dias que têm dados; um gráfico com os dias vazios em falta mente. Gera-se a série completa com `generate_series` e junta-se com `LEFT JOIN` (ou subconsultas), com `0` onde não houver nada.
- **Contagens condicionais**: `count(*) FILTER (WHERE concluida_em IS NULL)` conta só algumas linhas, várias contagens numa só passagem.
- **Subtotais**: `GROUP BY ROLLUP (projeto)` acrescenta uma linha de total (com `projeto` a `NULL`); `GROUPING SETS` e `CUBE` fazem combinações mais ricas.
- **Percentis**: `percentile_cont(0.9) WITHIN GROUP (ORDER BY duracao)` (lembra-te do módulo 48: as médias escondem a cauda).

## 6. Índices à medida das consultas

O módulo 03 apresentou os índices B-tree. Escolhê-los bem é olhar para as consultas reais:

- **Compostos, pela ordem certa**: para `WHERE utilizador = ? ORDER BY criada_em DESC LIMIT 20`, um índice `(utilizador, criada_em DESC)` serve o filtro **e** a ordenação: o Postgres lê as primeiras 20 entradas do índice e para, sem ordenar nada. A regra é: primeiro as colunas de igualdade, depois a de ordenação ou de intervalo. Um índice `(a, b)` serve `WHERE a = ?`, mas não `WHERE b = ?` (a regra do prefixo).
- **Parciais**: `CREATE INDEX ... WHERE concluida_em IS NULL` só indexa as tarefas abertas. Se forem 5% da tabela, o índice tem 5% do tamanho e é mais rápido de manter.
- **Sobre expressões**: `WHERE lower(email) = ...` não usa um índice em `email`. Ou indexas a expressão (`CREATE INDEX ON utilizadores (lower(email))`), ou guardas o email já normalizado.
- **De cobertura**: `INCLUDE (titulo)` guarda colunas extra no índice, para a consulta nem ir à tabela (*index-only scan*).
- **Outros tipos**: GIN para `jsonb`, arrays e pesquisa de texto (módulo 42), BRIN para tabelas enormes ordenadas pelo tempo (registos, eventos).

Cada índice tem um custo: espaço, e cada `INSERT`/`UPDATE` tem de o atualizar. Indexar tudo "por precaução" torna as escritas lentas. A disciplina é: medir as consultas mais frequentes e mais lentas (a extensão `pg_stat_statements`), olhar para o plano, criar o índice certo, e voltar a olhar.

## 7. Ler um `EXPLAIN`

`EXPLAIN` mostra o plano que o Postgres escolheu; `EXPLAIN ANALYZE` executa a consulta e mostra os tempos e as linhas reais. O que procurar:

- **`Seq Scan`** numa tabela grande, com um filtro que devolve poucas linhas: falta um índice (ou as estatísticas estão desatualizadas: `ANALYZE`);
- **`Sort`** antes de um `LIMIT`: um índice com a ordem certa evitava-o;
- **estimativas muito longe da realidade** (`rows=10` previsto, 100 000 reais): o planeador escolheu mal por causa de estatísticas, e a solução pode ser `ANALYZE` ou estatísticas estendidas;
- **`Nested Loop`** com milhares de iterações sobre uma tabela sem índice na coluna de junção.

O plano depende dos dados: numa tabela pequena, um `Seq Scan` é a escolha certa (ler tudo é mais barato do que ir ao índice). Por isso os índices testam-se com volumes realistas, como nos testes da prática.

---

## Prática: escreve tu

SQL a sério, num Postgres (o PGlite) com tarefas, projetos e subtarefas: funções de janela (top N, total acumulado, `lag`), CTEs recursivas (subárvore ordenada, antepassados, somas), índices confirmados pelo plano de execução em 60 000 linhas, e relatórios com semanas vazias, `ROLLUP` e percentis.

**Ficheiros:** `pratica/36-sql-avancado/` (`janelas.js`, `recursivas.js`, `indices.js`, `relatorios.js`; os dados de teste estão em `dados.js`)

**Verificar:** `npm run verificar 36` (dentro de `pratica/`). Só um exercício: `npm run verificar 36 janelas`, `... 36 recursivas`, `... 36 indices` ou `... 36 relatorios`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Funções de janela (≈30 min)

**Ficheiro:** `janelas.js`

O top N de cada projeto com desempate, o total acumulado de tarefas criadas por dia, e os dias entre conclusões seguidas do mesmo utilizador.

**Sintaxe que vais praticar:** `row_number() OVER (PARTITION BY ... ORDER BY ...)`, uma função de janela sobre um agregado (`sum(count(*)) OVER (...)`), `lag`, subtração de datas (dá dias), `to_char`.

<details>
<summary>Pista</summary>

Para o top N, a numeração vai numa subconsulta e o filtro por fora. Para o acumulado, agrupa por dia e, na mesma consulta, faz `sum(count(*)) OVER (ORDER BY criada_em)`: as funções de janela são calculadas depois do `GROUP BY`.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P1 · Funções de janela: cálculos sobre "vizinhos" de cada linha, sem a agrupar.

// topPorProjeto(db, n) → [{ projeto, id, pontos, posicao }]
//   As n tarefas com mais pontos de cada projeto (empate: id menor primeiro), com a posição
//   (1, 2, ...) dentro do projeto. Ordenado por projeto e posição.
export async function topPorProjeto(db, n) {
  const { rows } = await db.query(
    `SELECT projeto, id, pontos, posicao FROM (
       SELECT projeto, id, pontos, row_number() OVER (PARTITION BY projeto ORDER BY pontos DESC, id) AS posicao
         FROM tarefas
     ) t WHERE posicao <= $1 ORDER BY projeto, posicao`,
    [n],
  );
  return rows.map((r) => ({ ...r, posicao: Number(r.posicao) }));
}

// criadasAcumuladas(db) → [{ dia, criadas, acumulado }]
//   Por cada dia em que houve tarefas criadas: quantas nesse dia e o total acumulado até esse dia.
//   dia em texto 'AAAA-MM-DD'; números inteiros. Ordenado por dia.
export async function criadasAcumuladas(db) {
  const { rows } = await db.query(
    `SELECT to_char(criada_em, 'YYYY-MM-DD') AS dia, count(*)::int AS criadas,
            (sum(count(*)) OVER (ORDER BY criada_em))::int AS acumulado
       FROM tarefas GROUP BY criada_em ORDER BY criada_em`,
  );
  return rows;
}

// intervalosEntreConclusoes(db) → [{ utilizador, id, dias }]
//   Para cada tarefa concluída: quantos dias passaram desde a conclusão ANTERIOR do mesmo
//   utilizador (null na primeira). Ordenado por utilizador e data de conclusão (empate: id).
export async function intervalosEntreConclusoes(db) {
  const { rows } = await db.query(
    `SELECT utilizador, id,
            concluida_em - lag(concluida_em) OVER (PARTITION BY utilizador ORDER BY concluida_em, id) AS dias
       FROM tarefas WHERE concluida_em IS NOT NULL
      ORDER BY utilizador, concluida_em, id`,
  );
  return rows;
}
```
</details>

### P2 · CTEs recursivas (≈30 min)

**Ficheiro:** `recursivas.js`

A subárvore de uma tarefa com o nível e o caminho dos títulos, ordenada como uma árvore; os antepassados do topo para baixo; e a soma dos pontos de uma subárvore.

**Sintaxe que vais praticar:** `WITH RECURSIVE`, `UNION ALL`, arrays (`ARRAY[id]`, `||` para acrescentar), concatenação de texto com `||`, `coalesce`.

<details>
<summary>Pista</summary>

Na âncora, o caminho é o próprio título e a ordem é `ARRAY[id]`; no passo, acrescenta-se `' > ' || t.titulo` ao caminho e `t.id` ao array. Ordenar por esse array dá a ordem de uma árvore (o pai antes dos filhos, os irmãos por id). Para subir, a junção é ao contrário: `t.id = a.id`, e guarda-se o `pai_id`.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P2 · CTEs recursivas: árvores numa tabela (tarefas e subtarefas, com pai_id).

// subarvore(db, id) → [{ id, titulo, nivel, caminho }]
//   A tarefa e todos os seus descendentes (filhos, netos...). nivel: 0 para a própria, 1 para os
//   filhos... caminho: os títulos desde a tarefa pedida, separados por ' > '.
//   Ordenado como uma árvore (cada nó seguido dos seus descendentes; irmãos por id).
//   Dica: guarda também o caminho de ids num array, e ordena por ele.
export async function subarvore(db, id) {
  const { rows } = await db.query(
    `WITH RECURSIVE arvore AS (
       SELECT id, titulo, 0 AS nivel, titulo AS caminho, ARRAY[id] AS ordem FROM tarefas WHERE id = $1
       UNION ALL
       SELECT t.id, t.titulo, a.nivel + 1, a.caminho || ' > ' || t.titulo, a.ordem || t.id
         FROM tarefas t JOIN arvore a ON t.pai_id = a.id
     )
     SELECT id, titulo, nivel, caminho FROM arvore ORDER BY ordem`,
    [id],
  );
  return rows;
}

// antepassados(db, id) → [ids] do topo da árvore até ao pai (sem a própria tarefa)
export async function antepassados(db, id) {
  const { rows } = await db.query(
    `WITH RECURSIVE acima AS (
       SELECT pai_id AS id, 1 AS distancia FROM tarefas WHERE id = $1 AND pai_id IS NOT NULL
       UNION ALL
       SELECT t.pai_id, a.distancia + 1 FROM tarefas t JOIN acima a ON t.id = a.id WHERE t.pai_id IS NOT NULL
     )
     SELECT id FROM acima ORDER BY distancia DESC`,
    [id],
  );
  return rows.map((r) => r.id);
}

// pontosDaSubarvore(db, id) → a soma dos pontos da tarefa e de todos os descendentes (0 se não existir)
export async function pontosDaSubarvore(db, id) {
  const { rows } = await db.query(
    `WITH RECURSIVE arvore AS (
       SELECT id, pontos FROM tarefas WHERE id = $1
       UNION ALL
       SELECT t.id, t.pontos FROM tarefas t JOIN arvore a ON t.pai_id = a.id
     )
     SELECT coalesce(sum(pontos), 0)::int AS total FROM arvore`,
    [id],
  );
  return rows[0].total;
}
```
</details>

### P3 · Índices à medida (≈20 min)

**Ficheiro:** `indices.js`

No máximo três índices para três consultas: um composto que evita o `Sort`, um parcial, e um sobre uma expressão. Os testes leem o plano com `EXPLAIN (FORMAT JSON)`.

**Sintaxe que vais praticar:** `CREATE INDEX ... (a, b DESC)`, `CREATE INDEX ... WHERE ...`, `CREATE INDEX ... (lower(email))`.

<details>
<summary>Pista</summary>

Olha para cada consulta e pergunta: que colunas são comparadas com igualdade, qual é a ordenação, e há alguma condição fixa (`concluida_em IS NULL`) ou função (`lower`) aplicada à coluna? O índice tem de ter exatamente essa forma.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P3 · Índices escolhidos a partir das consultas (e confirmados com o EXPLAIN).

// As três consultas mais frequentes da aplicação (não as mudes):
export const CONSULTAS = {
  recentesDoUtilizador: "SELECT * FROM tarefas WHERE utilizador = 'u42' ORDER BY criada_em DESC LIMIT 20",
  abertasDoProjeto: "SELECT * FROM tarefas WHERE projeto = 'p7' AND concluida_em IS NULL",
  porEmail: "SELECT * FROM utilizadores WHERE lower(email) = lower('Pessoa123@Exemplo.PT')",
};

// criarIndices(db): cria os índices que fazem estas três consultas usar um índice, com NO MÁXIMO
//   três índices novos (um por consulta, cada um à medida):
//   - recentesDoUtilizador: um índice composto que serve o filtro E a ordenação (sem passo de Sort)
//   - abertasDoProjeto: um índice PARCIAL, só com as tarefas abertas (são poucas; as concluídas,
//     a maioria, não ocupam espaço no índice)
//   - porEmail: um índice sobre uma EXPRESSÃO (lower(email)), senão o lower() impede o uso do índice
export async function criarIndices(db) {
  await db.exec(`
    CREATE INDEX tarefas_utilizador_recentes ON tarefas (utilizador, criada_em DESC);
    CREATE INDEX tarefas_abertas_por_projeto ON tarefas (projeto) WHERE concluida_em IS NULL;
    CREATE INDEX utilizadores_email_lower ON utilizadores (lower(email));
  `);
}
```
</details>

### P4 · Relatórios (≈30 min)

**Ficheiro:** `relatorios.js`

Tarefas criadas e concluídas por semana, incluindo as semanas vazias; um resumo por projeto com uma linha de total; e a mediana e o p90 dos dias para concluir.

**Sintaxe que vais praticar:** `generate_series` com `interval '1 week'`, `date_trunc('week', ...)`, `count(*) FILTER (WHERE ...)`, `GROUP BY ROLLUP`, `ORDER BY ... NULLS LAST`, `percentile_cont(...) WITHIN GROUP (ORDER BY ...)`.

<details>
<summary>Pista</summary>

A série de semanas vai no `FROM` (`generate_series(...) AS s(semana)`), e para cada semana contas as tarefas com uma subconsulta ou com um `LEFT JOIN` e `FILTER`. Para os percentis, a diferença entre duas datas é um número de dias, que podes ordenar diretamente.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P4 · Relatórios: séries sem buracos, contagens condicionais, subtotais e percentis.

// porSemana(db, desde, ate) → [{ semana, criadas, concluidas }]
//   Uma linha por semana (segunda-feira 'AAAA-MM-DD', de date_trunc('week', ...)) entre as
//   semanas de `desde` e de `ate` (texto 'AAAA-MM-DD'), INCLUINDO as semanas sem nada (com 0).
//   criadas: tarefas com criada_em nessa semana; concluidas: com concluida_em nessa semana.
//   Dica: generate_series para as semanas, e count(*) FILTER (WHERE ...).
export async function porSemana(db, desde, ate) {
  const { rows } = await db.query(
    `SELECT to_char(s.semana, 'YYYY-MM-DD') AS semana,
            (SELECT count(*) FROM tarefas t WHERE date_trunc('week', t.criada_em) = s.semana)::int AS criadas,
            (SELECT count(*) FROM tarefas t WHERE date_trunc('week', t.concluida_em) = s.semana)::int AS concluidas
       FROM generate_series(date_trunc('week', $1::date), date_trunc('week', $2::date), interval '1 week') AS s(semana)
      ORDER BY s.semana`,
    [desde, ate],
  );
  return rows;
}

// resumoPorProjeto(db) → [{ projeto, tarefas, abertas, pontos }]
//   Uma linha por projeto e, no fim, uma linha de total com projeto null (GROUP BY ROLLUP).
//   abertas: as que não estão concluídas. Ordenado por projeto, com o total no fim.
export async function resumoPorProjeto(db) {
  const { rows } = await db.query(
    `SELECT projeto, count(*)::int AS tarefas, count(*) FILTER (WHERE concluida_em IS NULL)::int AS abertas, sum(pontos)::int AS pontos
       FROM tarefas GROUP BY ROLLUP (projeto) ORDER BY projeto NULLS LAST`,
  );
  return rows;
}

// duracaoPorProjeto(db) → [{ projeto, mediana, p90 }]
//   Para as tarefas concluídas, os dias entre criada_em e concluida_em: a mediana e o percentil 90
//   (percentile_cont), arredondados a 1 casa decimal (números). Só projetos com tarefas concluídas,
//   ordenados por projeto.
export async function duracaoPorProjeto(db) {
  const { rows } = await db.query(
    `SELECT projeto,
            round(percentile_cont(0.5) WITHIN GROUP (ORDER BY concluida_em - criada_em)::numeric, 1)::float8 AS mediana,
            round(percentile_cont(0.9) WITHIN GROUP (ORDER BY concluida_em - criada_em)::numeric, 1)::float8 AS p90
       FROM tarefas WHERE concluida_em IS NOT NULL GROUP BY projeto ORDER BY projeto`,
  );
  return rows;
}
```
</details>

## Experiências

1. **`EXPLAIN ANALYZE` no workshop:** com a stack a correr, abre o `psql` (`docker compose -f config/docker-compose.yml exec postgres psql -U workshop`) e corre `EXPLAIN ANALYZE` à consulta da listagem de tarefas da API. Gera 200 000 tarefas com `generate_series` e repete. Que índice falta?
2. **`pg_stat_statements`:** ativa a extensão no Postgres do workshop, faz um teste de carga com o k6 (módulo 48), e lista as consultas por tempo total. É a forma de saber que consultas otimizar primeiro.
3. **`rank` vs. `dense_rank` vs. `row_number`:** com três tarefas empatadas em pontos, compara as três funções lado a lado.
4. **Uma árvore com ciclo:** cria propositadamente `pai_id` em ciclo (a → b → a) e corre a tua CTE recursiva. O que acontece? Corrige com a cláusula `CYCLE id SET ciclo USING caminho`.

## Perguntas de pensamento crítico

1. Um colega carrega todas as tarefas para a API e calcula o top 3 por projeto em JavaScript. Funciona nos testes. Que problemas vês, e quando é que essa abordagem seria aceitável?
2. Porque é que um índice em `(criada_em, utilizador)` não serve tão bem a consulta "as 20 tarefas mais recentes do utilizador X" como um em `(utilizador, criada_em DESC)`?
3. O `EXPLAIN` mostra um `Seq Scan` numa tabela com um índice na coluna do `WHERE`. Isto é sempre um problema?

<details>
<summary>Respostas</summary>

1. Transfere a tabela inteira pela rede a cada pedido, ocupa memória na API (que pode rebentar com o crescimento dos dados), fica mais lento a cada mês, e duplica lógica que a base de dados faz melhor com um `row_number()`. Com volumes pequenos e estáveis (uma tabela de configuração com 50 linhas), ou quando os dados já estão em memória por outra razão (uma cache), a diferença é irrelevante e o código em JavaScript pode ser mais simples de testar.
2. Por causa da ordem das colunas: num índice `(criada_em, utilizador)`, as entradas estão ordenadas primeiro pela data, e as do utilizador X estão espalhadas pelo índice todo. O Postgres teria de percorrer as entradas por data até encontrar 20 do X (podem estar muito para trás), ou ler todas as do X e ordená-las. Com `(utilizador, criada_em DESC)`, as entradas do X estão todas juntas e já pela ordem pedida: lê as primeiras 20 e para. Igualdade primeiro, ordenação depois.
3. Não. Se a consulta devolver uma fração grande da tabela (por exemplo, `WHERE ativo = true` com 90% ativos), ou se a tabela for pequena, ler a tabela toda de seguida é mais barato do que saltar entre o índice e a tabela, e o planeador escolhe bem. É um problema quando a consulta devolve poucas linhas de uma tabela grande; aí, vale a pena ver se as estatísticas estão atualizadas (`ANALYZE`), se o índice serve mesmo a condição (uma função, um tipo diferente, um `LIKE '%...'`), e se a estimativa de linhas do plano está certa.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 36`.

**1.** Qual é a diferença entre um GROUP BY e uma função de janela?

- a) Nenhuma
- b) O GROUP BY junta as linhas num resultado por grupo; a função de janela calcula sobre um grupo mas mantém cada linha
- c) A função de janela é mais lenta sempre
- d) O GROUP BY não suporta ORDER BY

<details><summary>Resposta</summary>

**b) O GROUP BY junta as linhas num resultado por grupo; a função de janela calcula sobre um grupo mas mantém cada linha** — Ex.: sum(pontos) OVER (PARTITION BY projeto) põe o total do projeto em cada linha.

</details>

**2.** Como se obtém o top 3 de cada projeto?

- a) LIMIT 3 com GROUP BY projeto
- b) row_number() OVER (PARTITION BY projeto ORDER BY ...) numa subconsulta, e WHERE posicao <= 3 por fora
- c) HAVING count(*) <= 3
- d) Não é possível em SQL

<details><summary>Resposta</summary>

**b) row_number() OVER (PARTITION BY projeto ORDER BY ...) numa subconsulta, e WHERE posicao <= 3 por fora** — Não se pode filtrar uma função de janela no próprio WHERE.

</details>

**3.** Que construção do SQL percorre uma árvore guardada com pai_id numa só consulta (três palavras em inglês)?

<details><summary>Resposta</summary>

**with recursive** — Âncora + passo, repetido até não haver linhas novas.

</details>

**4.** Para WHERE utilizador = ? ORDER BY criada_em DESC LIMIT 20, que índice é o certo?

- a) (criada_em)
- b) (criada_em, utilizador)
- c) (utilizador, criada_em DESC)
- d) um índice em cada coluna

<details><summary>Resposta</summary>

**c) (utilizador, criada_em DESC)** — Igualdade primeiro, ordenação depois: lê 20 entradas e para, sem Sort.

</details>

**5.** Porque é que WHERE lower(email) = ... não usa um índice simples em email?

- a) Porque lower é lento
- b) Porque o índice guarda email, não lower(email); é preciso um índice sobre a expressão
- c) Porque o Postgres não suporta índices em texto
- d) Usa sempre

<details><summary>Resposta</summary>

**b) Porque o índice guarda email, não lower(email); é preciso um índice sobre a expressão** — CREATE INDEX ON utilizadores (lower(email)).

</details>

<!-- quiz:end -->
