# 41 · Bases de dados NoSQL

**Objetivo:** perceber quando faz sentido uma base de dados que não é relacional, e como se modela para ela: documentos (MongoDB), chave-valor e tabela única (DynamoDB), e de passagem colunas largas e grafos. A ideia central: **no SQL modelas os dados; no NoSQL modelas os padrões de acesso**.

**Ficheiros para ler:** `src/api/src/db/` (o esquema relacional do workshop, para comparar) e `pratica/35-cloud-aws/dynamo.js` (a primeira tabela única, no LocalStack).

**Pré-requisitos:** módulos 03 (Postgres), 05 (Redis, que já é uma base de dados chave-valor), 35 (DynamoDB) e 38 (transações).

---

## 1. Porque é que existem

As bases de dados relacionais (módulo 03) são a escolha certa por omissão: esquema explícito, `JOIN`s, transações ACID, uma linguagem de consulta poderosa, décadas de ferramentas. O "NoSQL" (*not only SQL*) apareceu por volta de 2009, em empresas com problemas que um Postgres num só servidor não resolvia:

- **Escala horizontal:** distribuir os dados por dezenas ou centenas de máquinas. Um `JOIN` entre tabelas em máquinas diferentes é lento; as bases NoSQL desenham-se para que cada consulta vá a **uma** partição.
- **Forma dos dados:** documentos com estrutura variável e aninhada (um produto de roupa e um de eletrónica têm atributos diferentes), que em tabelas viram dezenas de colunas a `NULL` ou um modelo EAV difícil de consultar.
- **Latência previsível:** o DynamoDB promete milissegundos de um dígito com qualquer volume, porque só deixa fazer consultas que escalam.

O preço é perder parte do que o SQL dá: `JOIN`s, consultas arbitrárias, por vezes transações entre registos, e o esquema garantido pela base de dados. Hoje a fronteira está esbatida: o Postgres tem `jsonb` com índices, e o MongoDB tem transações e validação de esquema. Por isso a pergunta não é "SQL ou NoSQL?" mas "que padrões de acesso tenho, e que base de dados os serve melhor?".

## 2. Os tipos

| Tipo | Exemplos | Modelo | Bom para |
|---|---|---|---|
| Chave-valor | Redis, DynamoDB, Memcached | uma chave → um valor opaco | caches, sessões, contadores |
| Documentos | MongoDB, Couchbase, Firestore | documentos JSON com estrutura aninhada | catálogos, conteúdos, perfis, dados com forma variável |
| Colunas largas | Cassandra, ScyllaDB, HBase | partições com linhas ordenadas, muito escritas | séries temporais, eventos, IoT (módulo 60) em grande volume |
| Grafos | Neo4j, Amazon Neptune | nós e arestas | redes sociais, recomendações, fraude ("amigos de amigos") |
| Pesquisa | Elasticsearch, OpenSearch | índice invertido | pesquisa de texto (módulo 42) |

## 3. MongoDB: documentos

No MongoDB, os dados vivem em **coleções** de **documentos** (BSON, um JSON binário com mais tipos: datas, inteiros de 64 bits, `ObjectId`). Uma tarefa pode ser:

```js
{
  _id: ObjectId('6720...'),
  titulo: 'Rever PR',
  prioridade: 3,
  tags: ['urgente', 'backend'],
  dono: { id: 7, nome: 'Ana' },
  comentarios: [{ autor: 'Rui', texto: 'feito', em: ISODate('2026-10-01') }]
}
```

As consultas são filtros com a forma dos documentos:

```js
db.tarefas.find({ 'dono.nome': 'Ana', prioridade: { $gte: 3 }, tags: 'urgente' })
          .sort({ prioridade: -1 }).limit(20)
```

Repara em duas coisas que surpreendem: `'dono.nome'` entra em subdocumentos, e `tags: 'urgente'` corresponde a um documento cujo array **contém** `'urgente'`. Nos arrays de subdocumentos, `{ 'comentarios.autor': 'Rui' }` procura em todos os elementos. Para relatórios há o **pipeline de agregação**, uma lista de etapas pelas quais os documentos passam (`$match`, `$group`, `$sort`, `$unwind`, `$lookup` para um "JOIN"), a ideia do `GROUP BY` mas em passos. Os índices funcionam como no Postgres (árvores B, compostos, a regra do prefixo), e o `explain()` mostra se uma consulta os usa.

## 4. Modelar documentos: embutir ou referenciar

A grande decisão em cada relação:

- **Embutir** (o subdocumento vive dentro do pai): uma leitura traz tudo, e a escrita do conjunto é atómica (num documento, sempre). Bom quando os dados são lidos juntos, pertencem ao pai, e são poucos: a morada de um cliente, as linhas de uma encomenda.
- **Referenciar** (guardar o `_id` e procurar à parte, ou com `$lookup`): bom quando a coleção filha cresce sem limite, quando os dados são partilhados por muitos pais, ou quando são lidos sozinhos.

O limite que mais pesa é o crescimento: um documento tem no máximo **16 MB**, e cada leitura traz o documento inteiro. Um projeto com as tarefas todas embutidas fica enorme e lento ao fim de um ano. Os padrões que a comunidade usa:

- **Subconjunto** (*subset*): embute as 10 tarefas mais recentes e o total, e guarda todas numa coleção própria. A página do projeto lê um documento; a lista completa é outra consulta.
- **Referência estendida** (*extended reference*): na tarefa, guarda `dono: { id, nome }` e não só o id, para mostrar o nome sem outra consulta. É **desnormalização**: se a Ana mudar de nome, há muitas cópias para atualizar (ou aceita-se que fiquem desatualizadas durante algum tempo).
- **Versões do esquema** (*schema versioning*): sem um esquema imposto, documentos antigos e novos convivem. Cada documento diz a sua versão, e o código migra-o quando o lê (e pode regravá-lo já migrado). Evita migrações de milhões de documentos de uma vez.

"Sem esquema" não quer dizer que não haja esquema: quer dizer que o esquema vive **no código** em vez de na base de dados. O MongoDB permite validação com JSON Schema por coleção, e vale a pena usá-la.

## 5. DynamoDB: tabela única

O DynamoDB (módulo 35) vai mais longe: só deixa ler por **chave**. Cada item tem uma chave de partição (PK), que decide em que máquina fica, e opcionalmente uma chave de ordenação (SK), que ordena os itens dentro da partição. As operações eficientes são `GetItem` (uma chave exata) e `Query` (uma partição, com uma condição na SK como `begins_with` ou `BETWEEN`). Um `Scan` lê a tabela toda e é para evitar. Não há `JOIN`s.

Por isso o desenho começa ao contrário do SQL: **primeiro listam-se os padrões de acesso**, depois desenham-se as chaves para que cada um seja **uma** `Query`. No desenho de **tabela única**, tipos diferentes de entidades partilham a mesma tabela, com prefixos nas chaves:

| PK | SK | GSI1PK | GSI1SK | atributos |
|---|---|---|---|---|
| `PROJ#p1` | `META` | `USER#ana` | `PROJ#p1` | nome |
| `PROJ#p1` | `TAREFA#t1` | `USER#rui` | `TAREFA#aberta#2026-11-10` | título, estado, prazo |
| `PROJ#p1` | `TAREFA#t2` | `USER#ana` | `TAREFA#feita#2026-10-01` | ... |

- "um projeto e as suas tarefas" → `Query PK = PROJ#p1` (os itens relacionados vivem juntos, já "juntados");
- "os projetos da Ana" → `Query` no índice secundário global **GSI1**, `GSI1PK = USER#ana AND begins_with(GSI1SK, 'PROJ#')`;
- "as tarefas abertas do Rui, por prazo" → GSI1, `GSI1PK = USER#rui AND begins_with(GSI1SK, 'TAREFA#aberta#')`, já ordenadas pela data porque ela faz parte da SK.

É rapidíssimo e escala sem limite, mas é rígido: um padrão de acesso novo pode exigir um índice novo ou reescrever as chaves de todos os itens. Para dados com consultas imprevisíveis (relatórios, *back-office*), copia-se para outro sítio (um *data warehouse*, ou o Postgres).

## 6. Consistência e o teorema CAP

Uma base distribuída com réplicas tem de escolher o que fazer quando a rede entre as máquinas falha (uma **partição** de rede): ou continua a responder com dados possivelmente desatualizados (**disponibilidade**), ou recusa até ter a certeza (**consistência**). É o teorema **CAP**. O PACELC acrescenta que, mesmo sem falhas, há uma troca entre **latência** e consistência.

Na prática, muitas bases NoSQL deixam escolher por operação: o DynamoDB tem leituras "eventualmente consistentes" (por omissão, metade do preço) e "fortemente consistentes"; o MongoDB tem *read concern* e *write concern* (`w: 'majority'` espera que a maioria das réplicas confirme a escrita); o Cassandra tem níveis como `QUORUM`. A consistência eventual quer dizer que uma leitura logo a seguir a uma escrita pode não a ver, e o código tem de contar com isso.

## 7. Quando escolher o quê

- **Começa no Postgres.** Com `jsonb` e índices GIN, guardas documentos com forma variável sem largar as transações e os `JOIN`s. É a escolha certa na grande maioria dos produtos, até escalas muito grandes.
- **MongoDB** quando os dados são naturalmente documentos, lidos e escritos inteiros, com forma variável, e a equipa quer iterar depressa no modelo.
- **DynamoDB** quando os padrões de acesso são conhecidos e estáveis, a escala é grande ou imprevisível, e queres zero operação (*serverless*).
- **Redis** para dados quentes e efémeros (módulo 05), não como a fonte da verdade.
- **Cassandra** para volumes enormes de escrita com padrões simples (séries temporais).
- **Neo4j** quando as consultas são sobre caminhos e relações em profundidade.

E usar várias é normal (**persistência poliglota**): o Postgres como fonte da verdade, o Redis como cache, o OpenSearch para pesquisa, cada um alimentado por eventos (módulo 17).

## Em resumo

- As bases de dados NoSQL existem para **escalar horizontalmente**, guardar dados de forma variável e dar latência previsível, à custa de JOINs, consultas livres e, por vezes, transações.
- Os tipos principais: **chave-valor**, **documentos**, **colunas largas**, **grafos** e **pesquisa**.
- No **MongoDB**, os filtros têm a forma dos documentos (caminhos com pontos, arrays) e os relatórios usam o **pipeline de agregação**.
- Modelar documentos é decidir entre **embutir** (lido junto, com limite) e **referenciar** (cresce sem limite, partilhado), com padrões como o subconjunto e as versões do esquema.
- No **DynamoDB** só se lê por chave: listam-se primeiro os **padrões de acesso** e desenham-se as chaves (tabela única, índices secundários) para cada um ser uma só consulta.
- O teorema CAP e os níveis de consistência escolhem-se por operação.
- **Começa no Postgres** (com `jsonb`); o NoSQL escolhe-se por um problema concreto.

---

## Prática: escreve tu

Para perceberes como estas bases de dados pensam, escreves as partes centrais à mão: o motor de filtros do MongoDB (caminhos com pontos, arrays, operadores), um pipeline de agregação, dois padrões de modelação de documentos, e as chaves de uma tabela única com uma `Query` que serve os três padrões de acesso da secção 5.

**Ficheiros:** `pratica/41-nosql/` (`consulta.js`, `agregacao.js`, `modelacao.js`, `tabelaUnica.js`)

**Verificar:** `npm run verificar 41` (dentro de `pratica/`). Só um exercício: `npm run verificar 41 consulta`, `... 41 agregacao`, `... 41 modelacao` ou `... 41 tabelaUnica`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Os filtros do MongoDB (≈35 min)

**Ficheiro:** `consulta.js`

Encontrar os valores num caminho com pontos (entrando em arrays de subdocumentos) e avaliar um filtro com igualdade, operadores de comparação, `$in`, `$exists`, `$and` e `$or`.

**Sintaxe que vais praticar:** `split('.')`, `flatMap`, uma tabela de funções indexada pelo nome do operador, `Object.entries` + `every`/`some`, recursão.

<details>
<summary>Pista</summary>

Em `valores`, mantém uma lista de "valores atuais" (começa com `[doc]`) e, para cada parte do caminho, troca-a pelos valores seguintes: se o atual é um array, entra em cada elemento. No fim, expande os arrays (`[v, ...v]`). Em `corresponde`, decide primeiro se a condição é um valor simples (igualdade) ou um objeto de operadores (alguma chave começa por `$`).
</details>

<details>
<summary>Solução de referência</summary>

```js
// P1 · Os filtros do MongoDB, escritos à mão (o que o `find` faz a cada documento).

// valores(doc, caminho) → lista dos valores encontrados no caminho com pontos ('dono.nome', 'tags')
//   Quando o caminho passa por um array de objetos, segue para dentro de TODOS os elementos
//   ('comentarios.autor' num doc com 3 comentários → os 3 autores). Quando o valor final é um
//   array, a lista inclui o próprio array E os seus elementos (é assim que { tags: 'urgente' }
//   apanha um documento com tags: ['urgente', 'casa']). Campo em falta → [].
export function valores(doc, caminho) {
  let atuais = [doc];
  for (const parte of caminho.split('.')) {
    const seguintes = [];
    for (const v of atuais) {
      if (Array.isArray(v)) {
        for (const e of v) if (e !== null && typeof e === 'object' && parte in e) seguintes.push(e[parte]);
      } else if (v !== null && typeof v === 'object' && parte in v) seguintes.push(v[parte]);
    }
    atuais = seguintes;
  }
  return atuais.flatMap((v) => (Array.isArray(v) ? [v, ...v] : [v]));
}

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const comparavel = (a, b) => typeof a === typeof b && (typeof a === 'number' || typeof a === 'string');
const OPERADORES = {
  $eq: (vs, x) => vs.some((v) => igual(v, x)),
  $ne: (vs, x) => !vs.some((v) => igual(v, x)),
  $gt: (vs, x) => vs.some((v) => comparavel(v, x) && v > x),
  $gte: (vs, x) => vs.some((v) => comparavel(v, x) && v >= x),
  $lt: (vs, x) => vs.some((v) => comparavel(v, x) && v < x),
  $lte: (vs, x) => vs.some((v) => comparavel(v, x) && v <= x),
  $in: (vs, lista) => vs.some((v) => lista.some((x) => igual(v, x))),
  $nin: (vs, lista) => !vs.some((v) => lista.some((x) => igual(v, x))),
  $exists: (vs, sim) => (vs.length > 0) === sim,
};

// corresponde(doc, filtro) → true/false
//   filtro: { caminho: valor } (igualdade), { caminho: { $gt: 3, $lt: 10 } } (todos os operadores
//   têm de se cumprir), e { $and: [filtros] } / { $or: [filtros] }. Todas as chaves do filtro têm
//   de se cumprir. Operadores: $eq $ne $gt $gte $lt $lte $in $nin $exists.
//   As comparações ($gt...) só valem entre valores do mesmo tipo (números com números, textos com
//   textos). Um operador desconhecido lança um Error.
export function corresponde(doc, filtro) {
  return Object.entries(filtro).every(([chave, cond]) => {
    if (chave === '$and') return cond.every((f) => corresponde(doc, f));
    if (chave === '$or') return cond.some((f) => corresponde(doc, f));
    const vs = valores(doc, chave);
    const ehOperadores = cond !== null && typeof cond === 'object' && !Array.isArray(cond) && Object.keys(cond).some((k) => k.startsWith('$'));
    if (!ehOperadores) return OPERADORES.$eq(vs, cond);
    return Object.entries(cond).every(([op, x]) => {
      if (!OPERADORES[op]) throw new Error(`Operador desconhecido: ${op}`);
      return OPERADORES[op](vs, x);
    });
  });
}
```
</details>

### P2 · Um pipeline de agregação (≈35 min)

**Ficheiro:** `agregacao.js`

`$match`, `$unwind`, `$group` com cinco acumuladores, `$sort` por vários campos, `$limit` e `$project`, encadeados com um `reduce`.

**Sintaxe que vais praticar:** `reduce` sobre as etapas, `Map` para agrupar mantendo a ordem, `JSON.stringify` como chave de um grupo, desestruturação com resto (`{ _id, ...campos }`), `sort` com desempate.

<details>
<summary>Pista</summary>

Uma tabela `{ $match: (docs, arg) => ..., ... }` e `agregar` é um `reduce` que aplica cada etapa ao resultado da anterior. No `$group`, agrupa primeiro (um `Map` da chave em texto para a lista de documentos) e só depois calcula os acumuladores sobre os valores de cada grupo.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P2 · Um pipeline de agregação ao estilo do MongoDB: cada etapa recebe a lista de documentos e
// devolve outra.
import { corresponde } from './consulta.js';

// O valor de uma expressão: '$dono.nome' é o valor do campo; qualquer outra coisa é ela própria.
function avaliar(doc, expr) {
  if (typeof expr !== 'string' || !expr.startsWith('$')) return expr;
  return expr.slice(1).split('.').reduce((v, p) => (v == null ? undefined : v[p]), doc);
}

const ACUMULADORES = {
  $sum: (vs) => vs.reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0),
  $avg: (vs) => {
    const ns = vs.filter((v) => typeof v === 'number');
    return ns.length ? ns.reduce((s, v) => s + v, 0) / ns.length : null;
  },
  $min: (vs) => vs.filter((v) => v != null).reduce((a, b) => (a === null || b < a ? b : a), null),
  $max: (vs) => vs.filter((v) => v != null).reduce((a, b) => (a === null || b > a ? b : a), null),
  $push: (vs) => vs,
};

const ETAPAS = {
  // { $match: filtro } → só os documentos que correspondem
  $match: (docs, filtro) => docs.filter((d) => corresponde(d, filtro)),
  // { $unwind: '$campo' } → um documento por elemento do array (os sem array, ou vazio, desaparecem)
  $unwind: (docs, expr) => {
    const campo = expr.slice(1);
    return docs.flatMap((d) => (Array.isArray(d[campo]) ? d[campo].map((e) => ({ ...d, [campo]: e })) : []));
  },
  // { $group: { _id: expr, nome: { $sum | $avg | $min | $max | $push: expr } } }
  //   grupos pela ordem em que aparecem; _id: null junta tudo num grupo
  $group: (docs, { _id, ...campos }) => {
    const grupos = new Map();
    for (const d of docs) {
      const k = avaliar(d, _id) ?? null;
      const chave = JSON.stringify(k);
      if (!grupos.has(chave)) grupos.set(chave, { _id: k, docs: [] });
      grupos.get(chave).docs.push(d);
    }
    return [...grupos.values()].map((g) => {
      const saida = { _id: g._id };
      for (const [nome, acc] of Object.entries(campos)) {
        const [op, expr] = Object.entries(acc)[0];
        if (!ACUMULADORES[op]) throw new Error(`Acumulador desconhecido: ${op}`);
        saida[nome] = ACUMULADORES[op](g.docs.map((d) => avaliar(d, expr)));
      }
      return saida;
    });
  },
  // { $sort: { campo: 1 | -1, ... } } → estável; desempata pelos campos seguintes
  $sort: (docs, ordem) =>
    [...docs].sort((a, b) => {
      for (const [campo, dir] of Object.entries(ordem)) {
        const [x, y] = [avaliar(a, `$${campo}`), avaliar(b, `$${campo}`)];
        if (x < y) return -dir;
        if (x > y) return dir;
      }
      return 0;
    }),
  // { $limit: n }
  $limit: (docs, n) => docs.slice(0, n),
  // { $project: { campo: 1, outro: '$a.b', _id: 0 } } → só esses campos (o _id fica, salvo _id: 0);
  //   1 copia o campo; um texto '$...' calcula-o a partir de outro
  $project: (docs, proj) =>
    docs.map((d) => {
      const saida = proj._id === 0 || !('_id' in d) ? {} : { _id: d._id };
      for (const [campo, v] of Object.entries(proj)) {
        if (campo === '_id') continue;
        if (v === 1) {
          if (campo in d) saida[campo] = d[campo];
        } else saida[campo] = avaliar(d, v);
      }
      return saida;
    }),
};

// agregar(docs, pipeline) → os documentos depois de passarem por todas as etapas, por ordem.
//   Cada etapa é um objeto com uma só chave ({ $match: ... }). Uma etapa desconhecida lança um Error.
export function agregar(docs, pipeline) {
  return pipeline.reduce((atuais, etapa) => {
    const [nome, arg] = Object.entries(etapa)[0];
    if (!ETAPAS[nome]) throw new Error(`Etapa desconhecida: ${nome}`);
    return ETAPAS[nome](atuais, arg);
  }, docs);
}
```
</details>

### P3 · Modelar documentos (≈20 min)

**Ficheiro:** `modelacao.js`

O padrão do subconjunto (embutir só as tarefas recentes, com o total) e o das versões do esquema (migrar um documento antigo quando é lido).

**Sintaxe que vais praticar:** `sort` + `slice` + `map` com desestruturação, desestruturação para remover um campo (`const { nome, ...resto } = d`), `filter(Boolean)`.

<details>
<summary>Pista</summary>

Em `migrarAoLer`, aplica os passos em sequência com `if` (não `else if`): um documento v1 passa a v2 no primeiro `if`, e o segundo `if` apanha-o logo a seguir.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P3 · Modelar documentos: embutir com limite, e versões de esquema migradas ao ler.

// projetoComTarefas(projeto, tarefas, { maxEmbutidas }) → o documento do projeto, pronto a guardar
//   Embutir TODAS as tarefas faria o documento crescer sem limite (o MongoDB recusa documentos com
//   mais de 16 MB, e cada leitura traria tudo). O "padrão do subconjunto": embute só as
//   maxEmbutidas mais recentes (por criadaEm, da mais recente para a mais antiga), só com
//   { id, titulo }, e guarda o total. As restantes ficam na sua própria coleção.
//   → { ...projeto, tarefasRecentes: [{ id, titulo }, ...], totalTarefas }
//   Só contam as tarefas com tarefa.projeto === projeto.id.
export function projetoComTarefas(projeto, tarefas, { maxEmbutidas }) {
  const minhas = tarefas.filter((t) => t.projeto === projeto.id);
  const recentes = [...minhas]
    .sort((a, b) => Date.parse(b.criadaEm) - Date.parse(a.criadaEm))
    .slice(0, maxEmbutidas)
    .map(({ id, titulo }) => ({ id, titulo }));
  return { ...projeto, tarefasRecentes: recentes, totalTarefas: minhas.length };
}

// O "padrão das versões do esquema": os documentos antigos não se migram todos de uma vez; cada
// documento diz a sua versão (versaoEsquema; sem o campo é a 1) e migra-se quando é lido.
//   v1 → v2: o campo 'nome' passou a chamar-se 'titulo'
//   v2 → v3: 'tags' era um texto separado por vírgulas ('a, b'); passou a ser um array (['a', 'b']),
//            sem espaços nas pontas e sem elementos vazios ('' → [])
// migrarAoLer(doc) → um documento NOVO na versão 3 (com versaoEsquema: 3), aplicando os passos
//   que faltam por ordem. Uma versão maior do que 3 lança um Error (código antigo a ler dados novos).
export const VERSAO_ATUAL = 3;
export function migrarAoLer(doc) {
  let d = { ...doc, versaoEsquema: doc.versaoEsquema ?? 1 };
  if (d.versaoEsquema > VERSAO_ATUAL) throw new Error(`Versão ${d.versaoEsquema} é mais recente do que este código`);
  if (d.versaoEsquema === 1) {
    const { nome, ...resto } = d;
    d = { ...resto, titulo: nome, versaoEsquema: 2 };
  }
  if (d.versaoEsquema === 2) {
    const tags = typeof d.tags === 'string' ? d.tags.split(',').map((t) => t.trim()).filter(Boolean) : (d.tags ?? []);
    d = { ...d, tags, versaoEsquema: 3 };
  }
  return d;
}
```
</details>

### P4 · Tabela única (≈25 min)

**Ficheiro:** `tabelaUnica.js`

As chaves (PK, SK, GSI1PK, GSI1SK) de projetos e tarefas, e uma `Query` simulada sobre uma lista, com `begins_with`, ordem e limite, que serve os três padrões de acesso da secção 5.

**Sintaxe que vais praticar:** *template literals* para as chaves, `startsWith`, comparação de textos no `sort`, desestruturação de um array (`const [kp, ks] = ...`).

<details>
<summary>Pista</summary>

O truque do padrão C é pôr o estado **e** o prazo na SK do índice: `TAREFA#aberta#2026-11-10`. Como as datas ISO ordenam bem como texto, os itens ficam ordenados por prazo dentro de cada estado.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P4 · Desenho de tabela única (DynamoDB): as chaves desenham-se a partir dos padrões de acesso.
//
// Padrões de acesso que a tabela tem de servir, cada um com UMA consulta:
//   A. um projeto e todas as suas tarefas                → PK = PROJ#<id>
//   B. os projetos de um utilizador                      → índice GSI1, GSI1PK = USER#<dono>, SK começa por PROJ#
//   C. as tarefas de um utilizador num estado, por prazo → GSI1, GSI1PK = USER#<responsavel>, SK começa por TAREFA#<estado>#

// chaves(item) → o item com as chaves acrescentadas:
//   { tipo: 'projeto', id, nome, dono }
//     → PK 'PROJ#<id>', SK 'META', GSI1PK 'USER#<dono>', GSI1SK 'PROJ#<id>'
//   { tipo: 'tarefa', id, projeto, responsavel, estado, prazo ('2026-11-01') }
//     → PK 'PROJ#<projeto>', SK 'TAREFA#<id>', GSI1PK 'USER#<responsavel>', GSI1SK 'TAREFA#<estado>#<prazo>'
//   outro tipo → lança um Error
export function chaves(item) {
  if (item.tipo === 'projeto') {
    return { ...item, PK: `PROJ#${item.id}`, SK: 'META', GSI1PK: `USER#${item.dono}`, GSI1SK: `PROJ#${item.id}` };
  }
  if (item.tipo === 'tarefa') {
    return {
      ...item,
      PK: `PROJ#${item.projeto}`,
      SK: `TAREFA#${item.id}`,
      GSI1PK: `USER#${item.responsavel}`,
      GSI1SK: `TAREFA#${item.estado}#${item.prazo}`,
    };
  }
  throw new Error(`Tipo desconhecido: ${item.tipo}`);
}

// consultar(itens, { indice, pk, skComeca, crescente = true, limite }) → itens
//   Imita a operação Query do DynamoDB sobre uma lista de itens (já com chaves):
//   - indice: undefined → usa PK/SK; 'GSI1' → usa GSI1PK/GSI1SK (itens sem essas chaves não estão no índice)
//   - pk: igualdade exata na chave de partição (obrigatória: uma Query nunca percorre a tabela toda)
//   - skComeca: opcional, a chave de ordenação começa por este texto (o begins_with)
//   - ordena pela chave de ordenação (texto), crescente ou decrescente, e corta em `limite`
export function consultar(itens, { indice, pk, skComeca, crescente = true, limite }) {
  if (pk === undefined) throw new Error('Uma Query precisa da chave de partição');
  const [kp, ks] = indice === 'GSI1' ? ['GSI1PK', 'GSI1SK'] : ['PK', 'SK'];
  const r = itens
    .filter((i) => i[kp] === pk && i[ks] !== undefined && (skComeca === undefined || i[ks].startsWith(skComeca)))
    .sort((a, b) => (a[ks] < b[ks] ? -1 : a[ks] > b[ks] ? 1 : 0) * (crescente ? 1 : -1));
  return limite === undefined ? r : r.slice(0, limite);
}
```
</details>

## Experiências

1. **Um MongoDB a sério:** `docker run -d --name mongo -p 127.0.0.1:27017:27017 mongo:8.0`, e depois `docker exec -it mongo mongosh`. Insere as tarefas dos testes do P2 (`db.tarefas.insertMany([...])`) e corre os mesmos pipelines com `db.tarefas.aggregate([...])`. Os resultados são iguais aos teus?
2. **O índice:** na mesma base, insere 100 000 documentos com um ciclo no `mongosh` e compara o `explain('executionStats')` de um `find({ 'dono.nome': 'Ana' })` antes e depois de `db.tarefas.createIndex({ 'dono.nome': 1 })`. Olha para `totalDocsExamined`.
3. **O Postgres também faz documentos:** numa tabela com uma coluna `jsonb`, escreve a consulta equivalente a `{ tags: 'urgente', prioridade: { $gte: 3 } }` com os operadores `@>` e `->>`, e cria um índice GIN.
4. **A tabela única a sério:** leva o desenho do P4 para o LocalStack do módulo 35, com um GSI na criação da tabela, e faz as três consultas com `QueryCommand`.

## Perguntas de pensamento crítico

1. Uma colega propõe trocar o Postgres do workshop pelo MongoDB "porque é mais moderno e escala melhor". Que perguntas fazes antes de concordar?
2. Num MongoDB de uma loja, guardas as encomendas com as linhas embutidas, e o nome e o preço do produto copiados para cada linha. O produto muda de preço. Isto é um problema?
3. Porque é que, no DynamoDB, se listam os padrões de acesso antes de desenhar as chaves, e o que acontece quando aparece um padrão novo?

<details>
<summary>Respostas</summary>

1. Que padrões de acesso temos, e quais é que o Postgres serve mal? (As tarefas, os projetos e os utilizadores são relacionais, com `JOIN`s e transações, e o volume cabe à vontade num Postgres.) Qual é o problema concreto que queremos resolver: escala (temos números?), forma variável dos dados (o `jsonb` não chega?), velocidade de desenvolvimento? O que perdemos: transações entre coleções (o MongoDB tem, com custos), consultas *ad hoc*, as ferramentas e o conhecimento da equipa? E o custo da migração. Quase sempre a resposta é ficar no Postgres e usar `jsonb` onde a forma varia.
2. Não, é o comportamento certo: uma encomenda regista o preço e o nome **no momento da compra**, e não deve mudar quando o catálogo muda (a fatura tem de bater certo). É desnormalização com significado: a cópia é um facto histórico, não um dado duplicado. Seria um problema se fosse uma informação que tem de estar sempre atual (por exemplo, a disponibilidade em stock), que aí se lê do produto.
3. Porque o DynamoDB só faz consultas eficientes por chave (uma partição e uma condição na SK): se as chaves não foram desenhadas para um padrão, a única alternativa é um `Scan` à tabela inteira, lento e caro. Quando aparece um padrão novo, as opções são acrescentar um índice secundário global (com chaves novas, o que pode exigir reescrever os itens existentes para lhes acrescentar esses atributos), reaproveitar um índice com um prefixo novo na SK, ou copiar os dados para outro sistema que responda a consultas flexíveis. É o custo da rigidez em troca da escala e da latência previsíveis.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 41`.

**1.** No MongoDB, que documentos devolve find({ tags: 'urgente' })?

- a) Só os que têm tags exatamente igual a 'urgente'
- b) Os que têm tags igual a 'urgente' ou um array tags que contém 'urgente'
- c) Nenhum: é preciso $in
- d) Os que têm a palavra 'urgente' em qualquer campo

<details><summary>Resposta</summary>

**b) Os que têm tags igual a 'urgente' ou um array tags que contém 'urgente'** — Nos arrays, a igualdade corresponde a qualquer elemento.

</details>

**2.** Quando é melhor referenciar do que embutir um subdocumento?

- a) Quando os dados são sempre lidos com o pai
- b) Quando a coleção filha cresce sem limite ou é partilhada por muitos pais
- c) Nunca: embutir é sempre melhor
- d) Quando são poucos campos

<details><summary>Resposta</summary>

**b) Quando a coleção filha cresce sem limite ou é partilhada por muitos pais** — Embutir sem limite rebenta os 16 MB e torna cada leitura pesada.

</details>

**3.** No DynamoDB, que operação lê a tabela inteira e deve ser evitada (em inglês)?

<details><summary>Resposta</summary>

**scan** — As operações eficientes são GetItem e Query, sempre por chave.

</details>

**4.** Num desenho de tabela única, como se obtém um projeto e todas as suas tarefas?

- a) Com um JOIN
- b) Com uma Query à partição PK = PROJ#id, onde o projeto e as tarefas vivem juntos
- c) Com dois Scan
- d) Com um índice de texto

<details><summary>Resposta</summary>

**b) Com uma Query à partição PK = PROJ#id, onde o projeto e as tarefas vivem juntos** — Os itens relacionados partilham a chave de partição, e a SK distingue os tipos.

</details>

**5.** O que diz o teorema CAP?

- a) Que uma base de dados não pode ser rápida e barata
- b) Que, numa partição de rede, um sistema distribuído tem de escolher entre consistência e disponibilidade
- c) Que o SQL não escala
- d) Que as transações são impossíveis em NoSQL

<details><summary>Resposta</summary>

**b) Que, numa partição de rede, um sistema distribuído tem de escolher entre consistência e disponibilidade** — O PACELC acrescenta a troca entre latência e consistência mesmo sem falhas.

</details>

<!-- quiz:end -->
