# 42 · Pesquisa de texto (full-text search)

**Objetivo:** perceber como funciona uma caixa de pesquisa a sério, por dentro: analisadores (normalização, palavras vazias, radicais), o índice invertido, a ordenação por relevância com o BM25, e a pesquisa de texto do Postgres, que chega para a maioria dos produtos antes de ser preciso um Elasticsearch.

**Ficheiros para ler:** `src/api/src/routes/tasks.js` (a listagem de tarefas, onde uma pesquisa por título entraria).

**Pré-requisitos:** módulos 03 (Postgres e índices), 30 (estruturas de dados) e 41 (NoSQL).

---

## 1. Porque é que `LIKE '%texto%'` não chega

A primeira pesquisa que toda a gente escreve é `WHERE titulo ILIKE '%relatorio%'`. Tem quatro problemas:

- **É lenta:** um `%` no início impede o uso de um índice B-tree normal (módulo 03), por isso o Postgres lê a tabela toda. Com milhões de linhas, são segundos.
- **Não percebe a língua:** "relatório" não encontra "relatorio" (acentos), "relatórios" (plural), nem "Relatório" sem o `I` do `ILIKE`.
- **Não tem relevância:** devolve as linhas por qualquer ordem; um título que é exatamente "Relatório" aparece misturado com um texto de 10 páginas que o menciona uma vez.
- **Não tem lógica de pesquisa:** várias palavras em qualquer ordem, frases exatas, excluir termos.

Um motor de pesquisa resolve isto com duas ideias: **analisar** o texto em termos normalizados, e guardar um **índice invertido** desses termos.

## 2. O analisador

O analisador transforma texto em termos, e é aplicado **da mesma forma** aos documentos (quando se indexam) e às consultas (quando se pesquisa); senão, não batem certo. As etapas típicas:

1. **Normalização:** minúsculas, sem acentos (`Ações` → `acoes`), por vezes Unicode normalizado (NFC/NFD, módulo 24).
2. **Tokenização:** partir em palavras. Parece trivial até aparecerem "e-mail", "C#", "U.S.A.", URLs, ou línguas sem espaços (chinês, japonês).
3. **Palavras vazias** (*stop words*): tirar as palavras muito frequentes que não distinguem documentos ("o", "de", "para"). Os motores modernos tiram cada vez menos, porque o BM25 já lhes dá pouco peso e há frases que dependem delas ("ser ou não ser").
4. **Radical** (*stemming*): reduzir as palavras a uma raiz comum (`tarefas`, `tarefa` → `taref`), com regras por língua (o algoritmo Snowball tem versões para o português). A alternativa mais cara é a **lematização**, que usa um dicionário (`fui` → `ir`).
5. **Sinónimos**, opcionalmente: `carro` também encontra `automóvel`.

## 3. O índice invertido

Um índice "normal" vai do documento para as palavras. Um **índice invertido** vai de cada termo para a lista de documentos onde aparece (a *posting list*), muitas vezes com a frequência e as posições:

```
api      → { doc1: 1, doc2: 1 }
testes   → { doc2: 2 }
pao      → { doc3: 1 }
```

Pesquisar "api testes" é intersetar as listas de `api` e `testes`, o que é rápido mesmo com milhões de documentos, sobretudo se se começar pela lista mais pequena. As posições permitem pesquisar frases ("testes de carga": os termos em posições seguidas). É a mesma estrutura no Lucene (por baixo do Elasticsearch, do OpenSearch e do Solr), no GIN do Postgres, e no índice no fim de um livro.

## 4. Relevância: TF-IDF e BM25

Encontrar os documentos é metade do trabalho; a outra metade é **ordená-los**. A intuição:

- um documento que menciona o termo **mais vezes** é provavelmente mais relevante (*term frequency*, TF);
- mas um termo que aparece em **quase todos** os documentos ("api", num índice sobre APIs) quase não distingue nada; um termo **raro** pesa muito (*inverse document frequency*, IDF);
- e a mesma ocorrência num título curto vale mais do que num texto enorme (normalização pelo **comprimento**).

O **BM25** (*Best Matching 25*, dos anos 90) é a fórmula que junta isto, e é o padrão por omissão do Lucene desde 2016. Para cada termo da consulta presente num documento:

```
idf × tf × (k1 + 1) / (tf + k1 × (1 − b + b × comprimento / comprimentoMédio))
```

O `k1` (≈1,2) controla a **saturação**: a 10.ª ocorrência de uma palavra ajuda muito menos do que a 2.ª, ao contrário do TF-IDF clássico, em que repetir uma palavra 100 vezes ganhava sempre. O `b` (≈0,75) controla quanto pesa o comprimento do documento. A pontuação final é a soma por todos os termos da consulta.

Além do BM25, os motores juntam outros sinais: **pesos por campo** (o título vale mais do que o corpo), frescura, popularidade. E hoje há a **pesquisa semântica** com *embeddings* (módulo 55), que encontra "automóvel" quando se pesquisa "carro" sem sinónimos configurados; a **pesquisa híbrida** combina as duas, porque o BM25 continua a ser melhor para nomes próprios, códigos e termos exatos.

## 5. A pesquisa de texto do Postgres

O Postgres tem tudo isto incorporado:

- `to_tsvector('portuguese', texto)` é o analisador: devolve um `tsvector`, a lista de radicais com as posições (`'taref':2 'urgent':3`);
- `websearch_to_tsquery('portuguese', 'tarefa urgente -casa')` transforma o que o utilizador escreveu numa consulta (`'taref' & 'urgent' & !'cas'`), com a sintaxe de um motor de pesquisa: "frases entre aspas", `or`, `-excluir`;
- `@@` testa se um vetor corresponde a uma consulta;
- um índice **GIN** (*Generalized Inverted Index*) é exatamente um índice invertido;
- `ts_rank` ordena por relevância (não é o BM25, mas usa a frequência e os **pesos** A, B, C, D que se dão a cada campo com `setweight`);
- `ts_headline` gera o excerto com os termos marcados, para mostrar nos resultados.

O padrão habitual é uma **coluna gerada** com o `tsvector`, que o Postgres mantém sozinho a cada escrita, e um índice GIN sobre ela.

Para os **erros de escrita**, há a extensão `pg_trgm`: parte o texto em trigramas (`"gato"` → `"  g"`, `" ga"`, `"gat"`, `"ato"`, `"to "`) e mede a semelhança entre dois textos pelos trigramas em comum. Serve para o "querias dizer...?", e um índice GIN com `gin_trgm_ops` também acelera os `ILIKE '%texto%'`.

## 6. Quando passar para um motor dedicado

O Postgres chega enquanto a pesquisa é uma funcionalidade entre outras: milhares a alguns milhões de documentos, ordenação razoável, e a vantagem enorme de não haver um segundo sistema para manter sincronizado. Passa-se para o **Elasticsearch/OpenSearch** (ou para o Meilisearch, o Typesense) quando se precisa de: relevância afinada (BM25, *boosting*, funções de pontuação), facetas e agregações rápidas sobre muitos campos, tolerância a erros e autocompletar de qualidade, muitas línguas, ou volumes de centenas de milhões de documentos.

Nesse caso, a base de dados continua a ser a fonte da verdade, e o índice de pesquisa é uma **cópia** alimentada por eventos (módulo 17) ou por *change data capture*. É consistente eventualmente: um documento acabado de criar pode demorar um segundo a aparecer na pesquisa, e a interface tem de contar com isso.

## Em resumo

- `LIKE '%texto%'` é lento (não usa índices), não percebe a língua nem ordena por relevância.
- O **analisador** transforma texto em termos (minúsculas, sem acentos, sem palavras vazias, radicais) e aplica-se **igual** aos documentos e às consultas.
- O **índice invertido** vai de cada termo para os documentos onde aparece; pesquisar é intersetar listas.
- O **BM25** ordena por relevância: termos raros pesam mais (IDF), repetir um termo ajuda cada vez menos (saturação) e os documentos curtos ganham.
- O Postgres tem tudo isto: `tsvector`, `websearch_to_tsquery`, índices **GIN**, `ts_rank`, `ts_headline` e o `pg_trgm` para erros de escrita.
- Passa-se para um motor dedicado (Elasticsearch, OpenSearch, Meilisearch) quando a relevância, as facetas ou o volume o exigem; o índice passa a ser uma cópia, com consistência eventual.

---

## Prática: escreve tu

Um pequeno motor de pesquisa, de raiz: um analisador para português, um índice invertido com remoção e atualização, o BM25 com os valores exatos da fórmula, e por fim a pesquisa do Postgres (no PGlite, com a extensão `pg_trgm`), com pesos, excertos e sugestões para erros de escrita.

**Ficheiros:** `pratica/42-pesquisa-full-text/` (`analisador.js`, `indice.js`, `bm25.js`, `postgresFts.js`)

**Verificar:** `npm run verificar 42` (dentro de `pratica/`). Só um exercício: `npm run verificar 42 analisador`, `... 42 indice`, `... 42 bm25` ou `... 42 postgresFts`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · O analisador (≈20 min)

**Ficheiro:** `analisador.js`

Normalizar (minúsculas e sem acentos), um *stemmer* pequeno para os plurais em português, e a tokenização que junta tudo.

**Sintaxe que vais praticar:** `normalize('NFD')`, classes Unicode em expressões regulares (`\p{M}`, `\p{L}`, com a flag `u`), `endsWith`, `slice` com índices negativos, `Set.has`.

<details>
<summary>Pista</summary>

`'ç'.normalize('NFD')` dá dois caracteres: o `c` e um "cedilha combinante", que pertence à categoria `\p{M}` (marcas). Apagá-los tira todos os acentos de uma vez. No radical, testa as regras pela ordem dos comentários e devolve logo que uma se aplicar.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P1 · O analisador: transformar texto em termos pesquisáveis (o mesmo para os documentos e para
// as consultas, senão não batem certo).

export const PALAVRAS_VAZIAS = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas',
  'um', 'uma', 'para', 'por', 'com', 'que', 'se', 'ao', 'aos',
]);

// normalizar(texto) → minúsculas e sem acentos ('Ações' → 'acoes').
//   Dica: normalize('NFD') separa a letra do acento; os acentos são a categoria Unicode \p{M}.
export function normalizar(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

// radical(palavra) → uma redução simples do plural (um "stemmer" muito pequeno), para uma palavra
//   já normalizada. A primeira regra que se aplica ganha:
//     termina em 'coes'        → troca por 'cao'   (acoes → acao)
//     termina em 'ais'         → troca por 'al'    (manuais → manual)
//     termina em 'res', 'zes' ou 'ses' → tira o 'es' (flores → flor, vezes → vez)
//     termina em 's' e tem mais de 3 letras → tira o 's' (tarefas → tarefa; mas 'mas' e 'gas' ficam)
//     senão fica igual
export function radical(palavra) {
  if (palavra.endsWith('coes')) return palavra.slice(0, -4) + 'cao';
  if (palavra.endsWith('ais')) return palavra.slice(0, -3) + 'al';
  if (/(r|z|s)es$/.test(palavra)) return palavra.slice(0, -2);
  if (palavra.endsWith('s') && palavra.length > 3) return palavra.slice(0, -1);
  return palavra;
}

// tokenizar(texto) → lista de termos, pela ordem: normaliza, parte em tudo o que não é letra nem
//   algarismo, tira as palavras vazias, e reduz cada uma ao radical.
export function tokenizar(texto) {
  return normalizar(texto)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((p) => p && !PALAVRAS_VAZIAS.has(p))
    .map(radical);
}
```
</details>

### P2 · Um índice invertido (≈30 min)

**Ficheiro:** `indice.js`

Indexar, remover e substituir documentos, guardar as frequências, e pesquisar com E (interseção) e OU (união).

**Sintaxe que vais praticar:** `Map` de `Map`s, `Set`, um índice "ao contrário" (documento → termos) para conseguir remover, um *getter*, `??` para listas que não existem.

<details>
<summary>Pista</summary>

Guarda duas estruturas: `termo → Map(id → frequência)` e `id → Set(termos)`. Sem a segunda, remover um documento obrigava a percorrer todos os termos. Para o E, ordena os conjuntos por tamanho e filtra o mais pequeno.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P2 · Um índice invertido: para cada termo, a lista dos documentos onde aparece (e quantas vezes).

const tokenizarSimples = (texto) => texto.toLowerCase().split(/\W+/).filter(Boolean);

// criarIndice(tokenizar = tokenizarSimples) → {
//   adicionar(id, texto)   indexa o documento; se o id já existir, substitui-o (remove o antigo primeiro)
//   remover(id)            tira o documento de todos os termos (e apaga os termos que ficarem vazios)
//   frequencias(termo)     → Map id → quantas vezes o termo aparece nesse documento (vazio se nenhum)
//   pesquisar(consulta, { modo = 'e' })
//                          → ids ordenados (crescente) dos documentos com TODOS os termos da
//                            consulta ('e') ou com PELO MENOS UM ('ou'). Consulta sem termos → [].
//   get termos             → quantos termos diferentes há no índice
// }
//   A consulta passa pelo mesmo tokenizar que os documentos.
export function criarIndice(tokenizar = tokenizarSimples) {
  const porTermo = new Map(); // termo → Map(id → frequência)
  const porDoc = new Map(); // id → Set(termos), para conseguir remover
  const indice = {
    adicionar(id, texto) {
      if (porDoc.has(id)) indice.remover(id);
      const termos = new Set();
      for (const t of tokenizar(texto)) {
        if (!porTermo.has(t)) porTermo.set(t, new Map());
        const docs = porTermo.get(t);
        docs.set(id, (docs.get(id) ?? 0) + 1);
        termos.add(t);
      }
      porDoc.set(id, termos);
    },
    remover(id) {
      for (const t of porDoc.get(id) ?? []) {
        const docs = porTermo.get(t);
        docs.delete(id);
        if (docs.size === 0) porTermo.delete(t);
      }
      porDoc.delete(id);
    },
    frequencias(termo) {
      return new Map(porTermo.get(termo) ?? []);
    },
    pesquisar(consulta, { modo = 'e' } = {}) {
      const termos = [...new Set(tokenizar(consulta))];
      if (termos.length === 0) return [];
      const conjuntos = termos.map((t) => new Set(porTermo.get(t)?.keys() ?? []));
      let r;
      if (modo === 'e') {
        conjuntos.sort((a, b) => a.size - b.size); // começar pelo mais pequeno: menos trabalho
        r = [...conjuntos[0]].filter((id) => conjuntos.every((c) => c.has(id)));
      } else {
        r = [...new Set(conjuntos.flatMap((c) => [...c]))];
      }
      return r.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    },
    get termos() {
      return porTermo.size;
    },
  };
  return indice;
}
```
</details>

### P3 · BM25 (≈25 min)

**Ficheiro:** `bm25.js`

A fórmula da secção 4, sobre documentos já tokenizados, com `k1` e `b` configuráveis, e a ordenação com desempate.

**Sintaxe que vais praticar:** `Math.log` (o logaritmo natural), contagens com `Map`, `map` com índice, ordenação por dois critérios com `||`.

<details>
<summary>Pista</summary>

Calcula primeiro o que não depende do documento: `N`, o comprimento médio, e o `idf` de cada termo da consulta (em quantos documentos aparece). Depois, para cada documento, soma a parcela de cada termo com `tf > 0`.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P3 · Ordenar por relevância com o BM25 (o algoritmo por omissão do Lucene, do Elasticsearch e do OpenSearch).

// bm25(documentos, termosConsulta, { k1 = 1.2, b = 0.75 }) → [{ id, pontuacao }]
//   documentos: [{ id, termos: [...] }] (já tokenizados); termosConsulta: [...] (repetidos contam uma vez)
//   Para cada documento, a pontuação é a soma, por cada termo t da consulta que aparece nele, de:
//
//        idf(t) × tf × (k1 + 1) / (tf + k1 × (1 − b + b × dl / dlMedio))
//
//     tf: quantas vezes t aparece no documento        dl: número de termos do documento
//     dlMedio: média de dl em todos os documentos     N: número de documentos
//     n: em quantos documentos t aparece              idf(t) = ln(1 + (N − n + 0.5) / (n + 0.5))
//
//   Só entram os documentos com pontuação > 0, da maior para a menor (empate: id crescente).
export function bm25(documentos, termosConsulta, { k1 = 1.2, b = 0.75 } = {}) {
  const N = documentos.length;
  if (N === 0) return [];
  const dlMedio = documentos.reduce((s, d) => s + d.termos.length, 0) / N;
  const consulta = [...new Set(termosConsulta)];
  const contagens = documentos.map((d) => {
    const c = new Map();
    for (const t of d.termos) c.set(t, (c.get(t) ?? 0) + 1);
    return c;
  });
  const idf = new Map(
    consulta.map((t) => {
      const n = contagens.filter((c) => c.has(t)).length;
      return [t, Math.log(1 + (N - n + 0.5) / (n + 0.5))];
    }),
  );
  return documentos
    .map((d, i) => {
      let pontuacao = 0;
      for (const t of consulta) {
        const tf = contagens[i].get(t) ?? 0;
        if (tf === 0) continue;
        pontuacao += (idf.get(t) * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * d.termos.length) / dlMedio));
      }
      return { id: d.id, pontuacao };
    })
    .filter((r) => r.pontuacao > 0)
    .sort((x, y) => y.pontuacao - x.pontuacao || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}
```
</details>

### P4 · Pesquisa no Postgres (≈30 min)

**Ficheiro:** `postgresFts.js`

Uma coluna `tsvector` gerada com pesos, os índices GIN, a pesquisa com `websearch_to_tsquery`, `ts_rank` e `ts_headline`, e as sugestões com trigramas.

**Sintaxe que vais praticar:** `GENERATED ALWAYS AS (...) STORED`, `setweight` e `||` entre `tsvector`s, uma função na cláusula `FROM` (`FROM artigos, websearch_to_tsquery(...) AS q`), `similarity`.

<details>
<summary>Pista</summary>

Pôr a `tsquery` no `FROM` dá-lhe um nome (`q`) que podes usar no `WHERE`, no `ORDER BY` e no `ts_headline` sem a escrever três vezes. A coluna gerada usa `coalesce(titulo, '')` para um `NULL` não apagar o vetor inteiro.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P4 · Pesquisa de texto no Postgres: tsvector, tsquery, pesos, ranking, excertos e "querias dizer".
// A tabela (criada pelos testes): artigos(id serial, titulo text, corpo text)

// prepararPesquisa(db):
//   1. acrescenta à tabela artigos uma coluna `pesquisa` do tipo tsvector, GERADA a partir do título
//      (peso 'A') e do corpo (peso 'B'), com a configuração 'portuguese' (o Postgres mantém-na
//      sozinha a cada INSERT/UPDATE)
//   2. cria um índice GIN nessa coluna
//   3. cria um índice GIN de trigramas no título (gin_trgm_ops), para as sugestões
export async function prepararPesquisa(db) {
  await db.exec(`
    ALTER TABLE artigos ADD COLUMN pesquisa tsvector GENERATED ALWAYS AS (
      setweight(to_tsvector('portuguese', coalesce(titulo, '')), 'A') ||
      setweight(to_tsvector('portuguese', coalesce(corpo, '')), 'B')
    ) STORED;
    CREATE INDEX artigos_pesquisa ON artigos USING gin (pesquisa);
    CREATE INDEX artigos_titulo_trgm ON artigos USING gin (titulo gin_trgm_ops);
  `);
}

// pesquisar(db, texto, { limite = 10 }) → [{ id, titulo, excerto }]
//   Converte o texto com websearch_to_tsquery('portuguese', ...) (aceita "frases entre aspas",
//   OR e -excluir, como um motor de pesquisa); devolve os artigos que correspondem, por ts_rank
//   decrescente (empate: id crescente). O excerto é o ts_headline do corpo, com os termos entre
//   <b> e </b>, entre 4 e 12 palavras (opções 'StartSel=<b>, StopSel=</b>, MinWords=4, MaxWords=12').
export async function pesquisar(db, texto, { limite = 10 } = {}) {
  const { rows } = await db.query(
    `SELECT id, titulo,
            ts_headline('portuguese', corpo, q, 'StartSel=<b>, StopSel=</b>, MinWords=4, MaxWords=12') AS excerto
       FROM artigos, websearch_to_tsquery('portuguese', $1) AS q
      WHERE pesquisa @@ q
      ORDER BY ts_rank(pesquisa, q) DESC, id
      LIMIT $2`,
    [texto, limite],
  );
  return rows;
}

// sugerirTitulo(db, texto) → o título mais parecido com o texto (similarity do pg_trgm) se a
//   semelhança for maior do que 0.3; senão null. Serve para o "querias dizer...?" com erros de escrita.
export async function sugerirTitulo(db, texto) {
  const { rows } = await db.query(
    'SELECT titulo FROM artigos WHERE similarity(titulo, $1) > 0.3 ORDER BY similarity(titulo, $1) DESC, id LIMIT 1',
    [texto],
  );
  return rows[0]?.titulo ?? null;
}
```
</details>

## Experiências

1. **O `EXPLAIN`:** numa tabela com 200 000 linhas (gera-as com `generate_series` e texto aleatório), compara o `EXPLAIN ANALYZE` de um `ILIKE '%palavra%'` com o de um `pesquisa @@ websearch_to_tsquery(...)`, com e sem o índice GIN.
2. **O analisador do Postgres:** experimenta `SELECT to_tsvector('portuguese', '...')` com frases tuas, e compara com `'simple'` e com `'english'`. Que palavras vazias tira cada um? Como trata "não"?
3. **Uma pesquisa na API:** acrescenta um `?q=` à listagem de tarefas da API, com uma coluna gerada e o `websearch_to_tsquery`. Lembra-te da migração (módulo 52: a coluna nova não parte nada).
4. **O Elasticsearch:** corre `docker run -p 127.0.0.1:9200:9200 -e discovery.type=single-node -e xpack.security.enabled=false docker.elastic.co/elasticsearch/elasticsearch:8.15.3` (precisa de ~1 GB de RAM), indexa os mesmos artigos, e usa a API `_analyze` para ver o analisador `portuguese` e o `_explain` para ver as contas do BM25.

## Perguntas de pensamento crítico

1. Um utilizador pesquisa "relatórios" e não encontra um documento com o título "Relatório anual". O que pode estar a falhar, e onde?
2. Porque é que o BM25 dá pouco peso a palavras que aparecem em quase todos os documentos, e porque é que isso torna as palavras vazias menos importantes?
3. A equipa quer pôr o Elasticsearch para a pesquisa de tarefas, que tem 50 000 linhas. Que argumentos tens a favor de ficar no Postgres, e o que te faria mudar de ideias?

<details>
<summary>Respostas</summary>

1. O analisador: se não houver *stemming* (ou se a pesquisa usar outra configuração de língua do que a indexação), "relatórios" e "relatório" são termos diferentes; se não houver normalização de acentos ou de maiúsculas, também falha. A causa clássica é o documento ser analisado de uma forma (por exemplo, com `'simple'`) e a consulta de outra (`'portuguese'`), ou a pesquisa ser um `LIKE` sem análise nenhuma. A correção é usar o mesmo analisador, com radicais para português, nos dois lados.
2. Por causa do IDF: um termo presente em quase todos os documentos tem um IDF perto de zero, por isso contribui muito pouco para a pontuação, seja qual for o número de ocorrências. Não distingue um documento dos outros. As palavras vazias são exatamente esse caso, por isso mesmo que fiquem no índice quase não afetam a ordenação; e mantê-las permite pesquisar frases que dependem delas.
3. A favor do Postgres: 50 000 linhas é muito pouco (um índice GIN responde em milissegundos), não há um segundo sistema para operar, monitorizar e pagar, não há sincronização nem consistência eventual (uma tarefa criada aparece logo na pesquisa), e as permissões e os filtros (só as tarefas do utilizador) ficam na mesma consulta SQL. Mudaria de ideias se precisássemos de relevância afinada, facetas rápidas sobre muitos campos, autocompletar e tolerância a erros de grande qualidade, várias línguas, ou volumes muito maiores, e se medições mostrassem o Postgres a não chegar.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 42`.

**1.** Porque é que WHERE titulo ILIKE '%texto%' é lento numa tabela grande?

- a) Porque o ILIKE é mais lento do que o LIKE
- b) Porque o % no início impede o uso de um índice B-tree, e o Postgres lê a tabela toda
- c) Porque converte para minúsculas
- d) Não é lento

<details><summary>Resposta</summary>

**b) Porque o % no início impede o uso de um índice B-tree, e o Postgres lê a tabela toda** — Um índice de texto (GIN com tsvector, ou trigramas) resolve isto.

</details>

**2.** Como se chama a estrutura que vai de cada termo para a lista de documentos onde aparece?

<details><summary>Resposta</summary>

**índice invertido** — É a base do Lucene e do GIN do Postgres.

</details>

**3.** No BM25, o que faz o parâmetro k1?

- a) Controla o peso do comprimento do documento
- b) Controla a saturação: cada ocorrência repetida de um termo ajuda cada vez menos
- c) Define o número de resultados
- d) Escolhe a língua

<details><summary>Resposta</summary>

**b) Controla a saturação: cada ocorrência repetida de um termo ajuda cada vez menos** — O b controla a normalização pelo comprimento.

</details>

**4.** Porque é que um termo que aparece em quase todos os documentos pesa pouco?

- a) Por causa do IDF, que é quase zero para termos muito comuns
- b) Porque é removido sempre
- c) Porque o TF é zero
- d) Por causa do comprimento médio

<details><summary>Resposta</summary>

**a) Por causa do IDF, que é quase zero para termos muito comuns** — Um termo comum não distingue um documento dos outros.

</details>

**5.** No Postgres, o que faz websearch_to_tsquery('portuguese', 'tarefa urgente -casa')?

- a) Pesquisa na web
- b) Transforma o texto numa tsquery com radicais, E entre os termos, e exclusão de 'casa'
- c) Cria um índice
- d) Devolve um excerto

<details><summary>Resposta</summary>

**b) Transforma o texto numa tsquery com radicais, E entre os termos, e exclusão de 'casa'** — Aceita a sintaxe de um motor de pesquisa: aspas, or e -excluir.

</details>

<!-- quiz:end -->
