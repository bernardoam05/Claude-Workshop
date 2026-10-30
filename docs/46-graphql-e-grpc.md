# 46 · GraphQL e gRPC

**Objetivo:** conhecer as duas alternativas ao REST que mais aparecem em empresas: o **GraphQL**, em que o cliente pede exatamente os dados de que precisa, e o **gRPC**, para comunicação rápida e tipada entre serviços. Saber escrever um esquema e os seus resolvers, resolver o problema N+1 com um DataLoader, definir um serviço em Protocol Buffers, e decidir quando cada um compensa.

**Ficheiros para ler:** `src/api/openapi.yaml` (o contrato REST da API, para comparar) e o módulo 13, que compara os três estilos.

**Pré-requisitos:** módulos 01 e 04 (REST e camadas), 26 (autorização) e 31 (o problema N+1, no Django).

---

## 1. O que o REST faz mal

O REST (módulo 01) organiza a API por **recursos**: `/api/tasks`, `/api/tasks/42`, `/api/users/7`. Funciona bem na maior parte dos casos, mas tem dois defeitos conhecidos:

- **Dados a mais** (*over-fetching*): o ecrã só precisa do título das tarefas, e o `GET /api/tasks` devolve tudo.
- **Pedidos a mais** (*under-fetching*): o ecrã precisa das tarefas **e** do nome do dono de cada uma, e isso são vários pedidos (ou um endpoint novo, feito à medida desse ecrã).

Numa app web numa rede rápida, isto raramente importa. Numa app móvel numa rede 3G, com vários ecrãs diferentes e uma equipa de backend que não consegue acompanhar os pedidos de endpoints novos, importa muito. Foi exatamente por isso que o Facebook criou o GraphQL, em 2012.

## 2. GraphQL: o cliente escolhe os campos

Uma API GraphQL tem **um** endpoint (`POST /graphql`) e um **esquema** tipado que descreve tudo o que se pode pedir:

```graphql
type Tarefa {
  id: ID!
  titulo: String!
  feita: Boolean!
  dono: Utilizador!
}

type Query {
  tarefas(feita: Boolean, primeiras: Int = 10): [Tarefa!]!
}
```

O cliente envia uma **consulta** com a forma exata da resposta que quer:

```graphql
query TarefasPorFazer {
  tarefas(feita: false) {
    titulo
    dono { nome }
  }
}
```

```json
{ "data": { "tarefas": [ { "titulo": "Ler o capítulo 3", "dono": { "nome": "Ana" } } ] } }
```

Um pedido, só os campos pedidos, e a relação com o dono no mesmo pedido. As três operações:

| Operação | Para quê | Equivalente REST |
|---|---|---|
| `query` | ler | `GET` |
| `mutation` | escrever | `POST`, `PATCH`, `DELETE` |
| `subscription` | receber eventos em tempo real (normalmente sobre WebSockets) | SSE / WebSockets (o módulo de tempo real) |

E as regras de tipos: `String`, `Int`, `Float`, `Boolean`, `ID`; o `!` quer dizer "nunca é null"; `[Tarefa!]!` é "uma lista que existe sempre, de tarefas que nunca são null". A nulabilidade é uma promessa ao cliente: se um campo `!` acabar por ser null (porque um resolver falhou), o GraphQL anula o objeto pai inteiro, até chegar a um campo que possa ser null. Promete com cuidado.

## 3. Resolvers

O esquema diz **o que** existe; os **resolvers** dizem **de onde vem**. Um resolver por campo, com quatro argumentos: o objeto pai, os argumentos do campo, o **contexto** (criado por pedido: o utilizador autenticado, o repositório, os carregadores) e informação sobre a consulta.

```js
const resolvers = {
  Query: {
    tarefas: (_pai, { feita, primeiras }, ctx) => ctx.repo.tarefasDe(ctx.utilizador.id, { feita, limite: primeiras }),
  },
  Tarefa: {
    dono: (tarefa, _args, ctx) => ctx.repo.utilizador(tarefa.donoId),   // o pai é a tarefa
  },
};
```

O motor do GraphQL percorre a consulta e chama os resolvers dos campos pedidos, e **só** desses: se o cliente não pedir o `dono`, o resolver do `dono` nunca corre.

Os **erros** não usam os códigos HTTP: a resposta é quase sempre `200`, com uma lista `errors` ao lado dos `data`, e cada erro pode ter um código em `extensions.code` (`UNAUTHENTICATED`, `BAD_USER_INPUT`, `FORBIDDEN`). Isto confunde as ferramentas de monitorização que contam erros pelo código HTTP (o módulo 19), e é uma das coisas a tratar quando se adota o GraphQL.

## 4. O problema N+1, outra vez, e o DataLoader

O resolver do `dono` acima tem um problema. Para uma lista de 50 tarefas, é chamado 50 vezes, e cada uma faz uma consulta: 1 consulta para as tarefas + 50 para os donos. É o N+1 do módulo 31, mas agora não há um `prefetch_related` à mão: cada resolver não sabe que os outros existem.

A solução padrão é o **DataLoader**: em vez de ir logo à base de dados, cada resolver pede ao carregador "dá-me o utilizador 7". O carregador junta todos os pedidos feitos no mesmo "tique" do *event loop* (enquanto o motor do GraphQL percorre a lista) e, no fim, faz **uma** consulta: `WHERE id IN (1, 2, 7)`. Além disso, guarda os resultados durante o pedido: pedir o mesmo utilizador duas vezes não vai duas vezes à base de dados.

Duas regras: cria um carregador **novo por pedido** (a cache não pode passar dos dados de um utilizador para outro), e a função de lote devolve os resultados **pela mesma ordem** das chaves.

## 5. O que o GraphQL complica

| Problema | Porquê | O que se faz |
|---|---|---|
| **Cache HTTP** | tudo é `POST /graphql`: o browser e as CDNs não sabem cachear | caches no cliente (Apollo Client, urql, Relay), e *persisted queries* com `GET` |
| **Consultas abusivas** | o cliente pode pedir `tarefas { dono { tarefas { dono { tarefas ... } } } }`, com profundidade ilimitada | limites de profundidade e de complexidade, timeouts, e listas sempre paginadas |
| **Autorização** | um campo pode ser alcançado por vários caminhos | a autorização vai nos resolvers (ou na camada de serviço), e nunca só na entrada |
| **Monitorização** | as respostas são `200` mesmo com erros; todas as consultas têm o mesmo URL | métricas por nome de operação e por erro |
| **Uploads de ficheiros** | não fazem parte do padrão | um endpoint REST à parte, ou URLs pré-assinados (o módulo de cloud) |

Em empresas, o GraphQL aparece muito como **BFF** (*backend for frontend*) ou **gateway**: uma camada GraphQL por cima de vários serviços REST ou gRPC, que dá ao frontend uma API à medida. As ferramentas mais usadas em Node são o **Apollo Server**, o **GraphQL Yoga** e o **Mercurius** (para o Fastify).

## 6. gRPC: chamadas entre serviços

O **gRPC** (criado pela Google) resolve outro problema: a comunicação **entre serviços**, onde importa a rapidez, os tipos e o contrato, e não a flexibilidade para um browser. O contrato escreve-se em **Protocol Buffers** (*protobuf*):

```protobuf
syntax = "proto3";
package notas;

message Nota { int32 id = 1; string titulo = 2; bool feita = 3; }
message PedidoNota { int32 id = 1; }

service Notas {
  rpc Obter (PedidoNota) returns (Nota);
  rpc Listar (PedidoLista) returns (stream Nota);
}
```

A partir do `.proto`, as ferramentas geram (ou carregam, como no P4) o código do cliente e do servidor em qualquer linguagem: um serviço em Go chama um serviço em Java como se fosse uma função local, com os tipos verificados. As diferenças em relação ao REST com JSON:

| | REST + JSON | gRPC |
|---|---|---|
| Formato | JSON (texto) | protobuf (binário: mais pequeno e mais rápido de ler e escrever) |
| Transporte | HTTP/1.1 ou 2 | HTTP/2, sempre |
| Contrato | opcional (OpenAPI) | obrigatório (o `.proto`) |
| Streaming | SSE ou WebSockets à parte | nativo, nos dois sentidos |
| Erros | códigos HTTP | códigos gRPC próprios (`NOT_FOUND`, `INVALID_ARGUMENT`, `DEADLINE_EXCEEDED`, `UNAVAILABLE`...) |
| Browser | sim | não diretamente (precisa do gRPC-Web, com um proxy) |
| Depurar à mão | `curl` | `grpcurl`, e é preciso o `.proto` |

Há quatro tipos de chamada: **unária** (um pedido, uma resposta), **stream do servidor** (um pedido, muitas respostas: o `Listar`), **stream do cliente** (muitos pedidos, uma resposta: um upload aos bocados) e **bidirecional** (um chat).

Os **prazos** (*deadlines*) são parte do protocolo: quem chama diz "tenho 2 segundos", o prazo viaja com o pedido e cada serviço sabe quanto tempo ainda tem. Um serviço que chama outro passa o prazo que sobra. É a forma de evitar que uma cadeia de chamadas fique pendurada (o módulo de resiliência volta a isto).

## 7. Evoluir um contrato sem partir os clientes

Os números dos campos (`= 1`, `= 2`) são a identidade de cada campo no formato binário; o nome não viaja. Daí as regras de evolução de um `.proto`, que valem (com outra forma) para qualquer API:

- **Acrescentar campos** com números novos: os clientes antigos ignoram-nos. Seguro.
- **Nunca mudar o número nem o tipo** de um campo existente: um cliente antigo leria o valor errado, sem erro.
- **Remover um campo:** marca o número como `reserved`, para ninguém o reutilizar por engano.
- Em GraphQL, a regra é parecida: acrescentar campos é seguro; para retirar um, marca-o com `@deprecated(reason: "...")` e espera que os clientes deixem de o usar (as ferramentas mostram quem ainda o pede).

## 8. Qual escolher

- **REST:** a escolha por omissão para APIs públicas e para a maior parte das aplicações. Simples, cacheável, toda a gente sabe usar.
- **GraphQL:** vários clientes (web, móvel) com necessidades diferentes, ecrãs com dados de muitas fontes, uma equipa de frontend que quer autonomia. Paga-se em complexidade no backend.
- **gRPC:** comunicação interna entre microserviços, sobretudo com muitas chamadas, várias linguagens, ou streaming. Raramente para o browser.

Muitas empresas usam os três: gRPC entre os serviços internos, uma camada GraphQL ou REST para os clientes, e REST para a API pública.

## Em resumo

- O REST pode obrigar a muitos pedidos (*under-fetching*) ou a dados a mais (*over-fetching*) quando há clientes com necessidades diferentes.
- No **GraphQL**, o cliente pede exatamente os campos que quer, a partir de um **esquema** tipado; os **resolvers** dizem onde ir buscar cada campo.
- Resolvers ingénuos dão o problema **N+1**; o **DataLoader** junta os pedidos num só.
- O GraphQL complica a cache HTTP, a limitação de pedidos (uma consulta pode ser enorme) e a autorização por campo.
- O **gRPC** usa **Protobuf** e HTTP/2: contratos fortes, binário, *streaming*; ideal entre serviços, não diretamente no browser.
- Um contrato evolui sem partir os clientes acrescentando campos e nunca reutilizando números ou nomes.
- REST para APIs públicas e simples, GraphQL para muitos clientes diferentes, gRPC entre serviços.

---

## Prática: escreve tu

Um esquema GraphQL, os seus resolvers (com sessão, autorização, validação e códigos de erro), um DataLoader escrito à mão (com um teste que conta as idas à base de dados), e um serviço gRPC com uma chamada unária, um stream e erros com os códigos certos. Os testes usam as bibliotecas oficiais: o `graphql` (com o `@graphql-tools/schema`), e o `@grpc/grpc-js` com um servidor e um cliente a sério, numa porta local.

**Ficheiros:** `pratica/46-graphql-e-grpc/` (`esquema.graphql`, `resolvers.js`, `carregador.js`, `notas.proto`, `servidorGrpc.js`)

**Verificar:** `npm run verificar 46` (dentro de `pratica/`). Só um exercício: `npm run verificar 46 esquema`, `... 46 resolvers`, `... 46 carregador` ou `... 46 grpc`. Os resolvers usam o esquema do P1 e o carregador do P3.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · O esquema (≈20 min)

**Ficheiro:** `esquema.graphql`

Os tipos `Utilizador` e `Tarefa`, as consultas e as mutações, com a nulabilidade certa em cada campo e um valor por omissão num argumento.

**Sintaxe que vais praticar:** `type`, campos com argumentos (`tarefas(feita: Boolean): [Tarefa!]!`), `!`, listas, valores por omissão (`Int = 10`), `type Query`, `type Mutation`, descrições entre aspas.

<details>
<summary>Solução de referência</summary>

```graphql
type Utilizador {
  id: ID!
  nome: String!
  tarefas(feita: Boolean): [Tarefa!]!
}

type Tarefa {
  id: ID!
  titulo: String!
  feita: Boolean!
  dono: Utilizador!
}

type Query {
  "Quem está autenticado (null sem sessão)."
  eu: Utilizador
  "Uma tarefa tua (null se não existir ou for de outra pessoa)."
  tarefa(id: ID!): Tarefa
  tarefas(feita: Boolean, primeiras: Int = 10): [Tarefa!]!
}

type Mutation {
  criarTarefa(titulo: String!): Tarefa!
  concluirTarefa(id: ID!): Tarefa
}
```
</details>

### P2 · Os resolvers (≈35 min)

**Ficheiro:** `resolvers.js`

Os resolvers das consultas, das mutações e dos campos `Tarefa.dono` e `Utilizador.tarefas`. Sem sessão, tudo dá `UNAUTHENTICATED` (exceto o `eu`, que dá null); as tarefas de outras pessoas "não existem"; os argumentos inválidos dão `BAD_USER_INPUT`.

**Sintaxe que vais praticar:** o objeto de resolvers por tipo, a assinatura `(pai, args, contexto)`, `new GraphQLError(mensagem, { extensions: { code } })`, funções auxiliares partilhadas pelos resolvers.

<details>
<summary>Pista</summary>

Escreve duas funções auxiliares: `exigirSessao(ctx)`, que lança o `UNAUTHENTICATED` ou devolve o utilizador, e `minhaTarefa(ctx, id)`, que devolve a tarefa só se for do utilizador. Assim, a regra de autorização está num sítio só, e o `tarefa` e o `concluirTarefa` usam a mesma.
</details>

<details>
<summary>Solução de referência</summary>

```js
import { GraphQLError } from 'graphql';

const erro = (mensagem, code) => new GraphQLError(mensagem, { extensions: { code } });

function exigirSessao(ctx) {
  if (!ctx.utilizador) throw erro('É preciso iniciar sessão', 'UNAUTHENTICATED');
  return ctx.utilizador;
}

// A autorização num sítio só: uma tarefa que não é tua "não existe".
async function minhaTarefa(ctx, id) {
  const eu = exigirSessao(ctx);
  const t = await ctx.repo.tarefa(id);
  return t && t.donoId === eu.id ? t : null;
}

export const resolvers = {
  Query: {
    eu: (_pai, _args, ctx) => ctx.utilizador,
    tarefa: (_pai, { id }, ctx) => minhaTarefa(ctx, id),
    tarefas: (_pai, { feita, primeiras }, ctx) => {
      const eu = exigirSessao(ctx);
      if (primeiras < 1 || primeiras > 100) throw erro('primeiras tem de estar entre 1 e 100', 'BAD_USER_INPUT');
      return ctx.repo.tarefasDe(eu.id, { feita, limite: primeiras });
    },
  },

  Mutation: {
    criarTarefa: (_pai, { titulo }, ctx) => {
      const eu = exigirSessao(ctx);
      const limpo = titulo.trim();
      if (limpo.length < 1 || limpo.length > 200) throw erro('O título tem de ter entre 1 e 200 caracteres', 'BAD_USER_INPUT');
      return ctx.repo.criar(eu.id, limpo);
    },
    concluirTarefa: async (_pai, { id }, ctx) => ((await minhaTarefa(ctx, id)) ? ctx.repo.concluir(id) : null),
  },

  // Resolvers de campos: o "pai" é o objeto que o resolver de cima devolveu.
  Tarefa: {
    dono: (tarefa, _args, ctx) => ctx.carregadores.utilizador.load(tarefa.donoId),
  },
  Utilizador: {
    tarefas: (utilizador, { feita }, ctx) => ctx.repo.tarefasDe(utilizador.id, { feita, limite: 100 }),
  },
};
```
</details>

### P3 · Um DataLoader (≈30 min)

**Ficheiro:** `carregador.js`

Juntar os pedidos do mesmo tique num lote, sem repetir chaves, com cache, e com falhas propagadas a todo o lote. O último teste corre uma consulta GraphQL com tarefas de dois donos e confirma que os utilizadores são pedidos **uma** vez.

**Sintaxe que vais praticar:** `queueMicrotask`, `Map` de chaves para promessas, criar uma `Promise` guardando o `resolve` e o `reject` para mais tarde, `Promise.resolve().then(...)` para tratar funções síncronas e assíncronas da mesma forma.

<details>
<summary>Pista</summary>

O truque é o momento em que o lote é despachado. O primeiro `load` de um tique cria o lote e agenda o despacho com `queueMicrotask`; os `load` seguintes, ainda no mesmo código síncrono, entram no mesmo lote. A microtarefa só corre quando esse código acabar. Guarda na cache a **promessa**, e não o valor: assim, dois pedidos à mesma chave no mesmo tique recebem a mesma promessa.
</details>

<details>
<summary>Solução de referência</summary>

```js
export function criarCarregador(emLote) {
  const cache = new Map();   // chave → Promise do valor (também serve para não repetir chaves)
  let pendentes = null;      // o lote em formação: chave → { resolve, reject }

  function despachar() {
    const lote = pendentes;
    pendentes = null;
    const chaves = [...lote.keys()];
    Promise.resolve()
      .then(() => emLote(chaves))
      .then(
        (valores) => chaves.forEach((k, i) => lote.get(k).resolve(valores[i])),
        (e) => {
          for (const k of chaves) {
            lote.get(k).reject(e);
            cache.delete(k); // não guardar falhas: um pedido seguinte pode tentar outra vez
          }
        },
      );
  }

  return {
    load(chave) {
      if (cache.has(chave)) return cache.get(chave);
      if (!pendentes) {
        pendentes = new Map();
        // Corre depois de todo o código síncrono atual: todos os load() deste "tique" entram no lote.
        queueMicrotask(despachar);
      }
      const promessa = new Promise((resolve, reject) => pendentes.set(chave, { resolve, reject }));
      cache.set(chave, promessa);
      return promessa;
    },
  };
}
```
</details>

### P4 · Um serviço gRPC (≈35 min)

**Ficheiros:** `notas.proto` e `servidorGrpc.js`

O contrato em Protocol Buffers e o servidor: uma chamada unária com `NOT_FOUND`, um stream do servidor com filtro, e uma criação com `INVALID_ARGUMENT`. Os testes usam um cliente gRPC a sério, com prazos.

**Sintaxe que vais praticar:** `syntax`, `package`, `message` com números de campo, `service` e `rpc`, `stream`; `protoLoader.loadSync`, `grpc.loadPackageDefinition`, `server.addService`, `callback(erro, resposta)`, `call.request`, `call.write`/`call.end`, `grpc.status`.

<details>
<summary>Pista</summary>

No servidor, os nomes dos métodos são os do `.proto` (`Obter`, `Listar`, `Criar`). As chamadas unárias recebem `(call, callback)`; as de stream do servidor recebem só `(call)`, escrevem com `call.write` e terminam com `call.end()`. Um erro é um objeto `{ code, message }` passado como primeiro argumento do `callback`.
</details>

<details>
<summary>Solução de referência</summary>

`notas.proto`:

```protobuf
syntax = "proto3";

package notas;

message Nota {
  int32 id = 1;
  string titulo = 2;
  bool feita = 3;
}

message PedidoNota {
  int32 id = 1;
}

message PedidoLista {
  bool so_por_fazer = 1;
}

message NovaNota {
  string titulo = 1;
}

service Notas {
  rpc Obter (PedidoNota) returns (Nota);
  rpc Listar (PedidoLista) returns (stream Nota);
  rpc Criar (NovaNota) returns (Nota);
}
```

`servidorGrpc.js`:

```js
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'node:url';

export function carregarDefinicao() {
  const definicao = protoLoader.loadSync(fileURLToPath(new URL('./notas.proto', import.meta.url)), {
    keepCase: true, // so_por_fazer continua so_por_fazer (e não soPorFazer)
    defaults: true, // campos em falta vêm com o valor por omissão (0, "", false)
  });
  return grpc.loadPackageDefinition(definicao).notas;
}

export function criarServidor(notas) {
  const servidor = new grpc.Server();
  servidor.addService(carregarDefinicao().Notas.service, {
    // Unário: (call, callback). O erro é o primeiro argumento do callback, com um código gRPC.
    Obter(call, callback) {
      const nota = notas.find((n) => n.id === call.request.id);
      if (!nota) return callback({ code: grpc.status.NOT_FOUND, message: `não há nenhuma nota ${call.request.id}` });
      callback(null, nota);
    },
    // Stream do servidor: escreve quantas mensagens quiser, e termina.
    Listar(call) {
      for (const nota of notas) {
        if (!call.request.so_por_fazer || !nota.feita) call.write(nota);
      }
      call.end();
    },
    Criar(call, callback) {
      const titulo = call.request.titulo.trim();
      if (!titulo) return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'o título é obrigatório' });
      const nota = { id: Math.max(0, ...notas.map((n) => n.id)) + 1, titulo, feita: false };
      notas.push(nota);
      callback(null, nota);
    },
  });
  return servidor;
}
```
</details>

## Experiências

1. **Uma consulta abusiva:** com os teus resolvers, escreve uma consulta com `eu { tarefas { dono { tarefas { dono { tarefas { titulo } } } } } }` e executa-a com o `executar` do `ajuda.js`. Quantas chamadas ao repositório faz? Agora imagina 10 níveis com 100 tarefas cada. Como a limitarias?
2. **Sem o DataLoader:** troca o resolver do `dono` por uma chamada direta, `ctx.repo.utilizadoresPorIds([tarefa.donoId]).then((r) => r[0])`, e corre o teste do P3. Quantas chamadas aparecem?
3. **gRPC à mão:** instala o [grpcurl](https://github.com/fullstorydev/grpcurl), arranca o teu servidor numa porta fixa (`bindAsync('127.0.0.1:50051', ...)`), e chama `grpcurl -plaintext -proto notas.proto -d '{"id": 2}' 127.0.0.1:50051 notas.Notas/Obter`.
4. **Evoluir o contrato:** com o servidor da experiência 3 a correr, copia o `notas.proto` para `notas-novo.proto`, acrescenta ao `Nota` o campo `string etiqueta = 4;` e chama o servidor com o `grpcurl` usando o `.proto` novo. Funciona: o campo que o servidor não conhece é ignorado. Agora, no `notas-novo.proto`, troca o `titulo` de `= 2` para `= 5` e repete. O que acontece ao título?

## Perguntas de pensamento crítico

1. Uma startup com uma app web e uma app móvel quer usar GraphQL "porque é moderno". Que perguntas lhes fazes?
2. Porque é que, numa API GraphQL, a autorização não pode ficar só num middleware à entrada, como no REST?
3. Porque é que o gRPC é popular entre microserviços mas raro para APIs públicas?

<details>
<summary>Respostas</summary>

1. Se os ecrãs têm necessidades de dados muito diferentes (se não, o REST chega), quantas pessoas vão manter o backend (o GraphQL exige DataLoaders, limites de complexidade, monitorização própria e cache no cliente), e se a API vai ser pública (o REST é mais simples para terceiros e cacheável). O GraphQL compensa quando há vários clientes com necessidades diferentes e uma equipa de frontend que ganha autonomia com ele; senão, é complexidade sem retorno.
2. Porque há um só endpoint, e a mesma tarefa pode ser alcançada por vários caminhos: `tarefa(id)`, `tarefas`, `eu { tarefas }`, ou através do dono de outra tarefa. Um middleware à entrada só sabe que o utilizador está autenticado, não sabe que dados a consulta vai tocar. A verificação tem de estar onde os dados são carregados: nos resolvers, ou melhor ainda, na camada de serviço que eles chamam.
3. Porque os seus pontos fortes (binário compacto, HTTP/2, contrato obrigatório, código gerado, streaming) importam sobretudo entre serviços internos, que trocam muitas mensagens e são controlados pela mesma empresa. Para terceiros, pesam os defeitos: não funciona no browser sem um proxy (gRPC-Web), não se testa com um `curl`, exige o `.proto` e geração de código, e não é cacheável pelas CDNs. Uma API pública REST com JSON é mais fácil de adotar.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 46`.

**1.** Que problema do REST o GraphQL resolve?

- a) A falta de autenticação
- b) Dados a mais e pedidos a mais: o cliente pede exatamente os campos e as relações de que precisa, num só pedido
- c) A lentidão das bases de dados
- d) A cache HTTP

<details><summary>Resposta</summary>

**b) Dados a mais e pedidos a mais: o cliente pede exatamente os campos e as relações de que precisa, num só pedido** — Over-fetching e under-fetching; em troca, a cache HTTP e a monitorização ficam mais difíceis.

</details>

**2.** Para que serve um DataLoader numa API GraphQL?

- a) Para validar o esquema
- b) Para juntar os pedidos de vários resolvers do mesmo tique numa só consulta (e evitar o N+1)
- c) Para fazer upload de ficheiros
- d) Para gerar o código do cliente

<details><summary>Resposta</summary>

**b) Para juntar os pedidos de vários resolvers do mesmo tique numa só consulta (e evitar o N+1)** — Cria-se um por pedido, e a função de lote devolve os resultados pela ordem das chaves.

</details>

**3.** Em que formato se escreve o contrato de um serviço gRPC (o ficheiro .proto)?

<details><summary>Resposta</summary>

**protocol buffers** — Binário, compacto, com números de campo que nunca se mudam depois de o serviço estar em uso.

</details>

**4.** Porque é que nunca se muda o número de um campo num .proto já em uso?

- a) Porque o compilador não deixa
- b) Porque é o número (e não o nome) que identifica o campo no formato binário: um cliente antigo leria o valor errado, sem erro
- c) Porque os números têm de ser sequenciais
- d) Porque afeta o desempenho

<details><summary>Resposta</summary>

**b) Porque é o número (e não o nome) que identifica o campo no formato binário: um cliente antigo leria o valor errado, sem erro** — Acrescentar campos novos é seguro; para remover, marca-se o número como reserved.

</details>

**5.** Qual destas é a escolha mais comum para a comunicação interna entre microserviços com muitas chamadas e várias linguagens?

- a) GraphQL
- b) gRPC
- c) SOAP
- d) Email

<details><summary>Resposta</summary>

**b) gRPC** — HTTP/2, binário, contrato obrigatório, streaming nativo e prazos que viajam com o pedido.

</details>

<!-- quiz:end -->
