# 39 · Multi-inquilino (multi-tenancy)

**Objetivo:** desenhar um produto SaaS que serve muitas organizações (os **inquilinos**) a partir do mesmo sistema, sem que nenhuma veja os dados das outras e sem que uma afete o desempenho das restantes: os três modelos de isolamento dos dados, descobrir o inquilino de cada pedido, chaves compostas, *row-level security* no Postgres, e o "vizinho ruidoso".

**Ficheiros para ler:** `src/api/src/db/migrations/004_tasks_belong_to_users.sql` e `src/api/src/repositories/taskRepository.js` (como o workshop isola os dados por utilizador, hoje).

**Pré-requisitos:** módulos 03 (PostgreSQL), 28 (autorização), 36 (SQL avançado) e 38 (transações).

---

## 1. O que é um inquilino

Num produto como o Slack, o Jira ou o Notion, cada empresa cliente é um **inquilino** (*tenant*): tem os seus utilizadores, os seus dados, as suas configurações, e às vezes o seu plano (gratuito, empresarial). Todos usam a mesma aplicação, a correr na mesma infraestrutura. É isso que torna o SaaS barato de operar: um deploy serve milhares de clientes.

O workshop já isola dados **por utilizador** (cada tarefa tem um `user_id`). O multi-inquilino é um nível acima: as tarefas são da **organização**, partilhadas pelos seus membros, e o maior pesadelo de uma empresa SaaS é um cliente ver os dados de outro. Não é hipotético: é uma das fugas mais comuns e mais graves, e quase sempre vem de um `WHERE` esquecido numa consulta.

## 2. Três modelos de isolamento

| Modelo | Como | Isolamento | Custo e operação |
|---|---|---|---|
| **Base de dados por inquilino** | cada cliente tem a sua BD (ou o seu servidor) | o mais forte | caro; milhares de BDs para migrar, monitorizar, fazer backup |
| **Esquema por inquilino** | uma BD, um esquema Postgres por cliente (`acme.tarefas`) | bom | migrações × N esquemas; o Postgres sofre com dezenas de milhares de tabelas |
| **Esquema partilhado** | as mesmas tabelas, com uma coluna `inquilino_id` em todas | depende de nunca esquecer o filtro | o mais barato e simples de operar; o que a maioria usa |

A escolha raramente é pura: um padrão comum é **esquema partilhado para a maioria** e **BD dedicada para os grandes clientes** (que pagam por isso, ou que a exigem por contrato ou por regulação, módulo 53). Por isso, o código deve tratar "onde estão os dados deste inquilino" como uma configuração, e não espalhar a suposição por todo o lado.

## 3. Descobrir o inquilino de cada pedido

Antes de qualquer consulta, a aplicação precisa de saber a que inquilino pertence o pedido. As fontes habituais:

- o **subdomínio**: `acme.tarefas.pt`;
- o **token**: uma *claim* `inquilino` no JWT (no Keycloak, módulo 15, cada inquilino pode ser um *realm*, ou uma organização dentro de um *realm*);
- um **cabeçalho** (`X-Inquilino`) ou um segmento do caminho (`/org/acme/...`), em APIs.

A regra de ouro: **a fonte autenticada manda**. Se o token diz `acme` e o cabeçalho diz `globex`, o pedido é recusado, nunca "o cabeçalho ganha". Senão, qualquer utilizador da acme lê os dados da globex mudando um cabeçalho, que é o IDOR do módulo 26 à escala de empresas inteiras. E cuidado com a leitura do domínio: `acme.tarefas.pt.atacante.com` termina em... `atacante.com`.

Uma vez descoberto, o inquilino passa por todo o pedido (num contexto, como o `AsyncLocalStorage` do módulo 47), e entra em todas as consultas, chaves de cache, nomes de ficheiros no S3, eventos e logs.

## 4. Esquema partilhado bem feito

Com uma coluna `inquilino` em todas as tabelas, três cuidados fazem a diferença:

- **Chaves compostas**: `PRIMARY KEY (inquilino, id)` e chaves estrangeiras `(inquilino, projeto_id) REFERENCES projetos (inquilino, id)`. Assim, a base de dados **impede** que uma tarefa da acme aponte para um projeto da globex, mesmo que o id esteja certo. Com uma chave estrangeira só em `projeto_id`, isso passava.
- **Índices a começar pelo inquilino**: quase todas as consultas filtram por ele (a regra do prefixo do módulo 36).
- **Um repositório que não deixa esquecer**: o inquilino entra uma vez, na criação do repositório, e todas as operações o usam. Nenhuma consulta é escrita "à solta".

## 5. Row-level security: a segunda barreira

Mesmo com repositórios cuidadosos, um dia alguém escreve uma consulta de relatório sem o filtro. O Postgres tem uma rede de segurança: a ***row-level security*** (RLS). Uma **política** na tabela diz que linhas cada ligação pode ver e escrever:

```sql
ALTER TABLE notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas FORCE ROW LEVEL SECURITY;          -- também para o dono da tabela
CREATE POLICY por_inquilino ON notas
  USING      (inquilino = current_setting('app.inquilino', true))   -- o que se lê
  WITH CHECK (inquilino = current_setting('app.inquilino', true));  -- o que se escreve
```

A aplicação, no início de cada transação, diz quem é o inquilino (`set_config('app.inquilino', 'acme', true)`), e a partir daí até um `SELECT * FROM notas` sem `WHERE` só devolve as linhas da acme. Os detalhes que mordem:

- **os superutilizadores ignoram sempre o RLS**, e o dono da tabela também, sem o `FORCE`. A aplicação tem de usar um papel próprio, sem esses privilégios;
- o terceiro argumento `true` do `set_config` faz a definição valer **só até ao fim da transação**. Com um *pool* de ligações, uma definição "da sessão" passava para o pedido seguinte de outro inquilino;
- sem definição nenhuma, `current_setting(..., true)` dá `NULL`, e a política não deixa ver nada: **falha fechada**;
- o RLS custa algum desempenho (a condição entra em todas as consultas), e os índices têm de começar pelo inquilino.

O Supabase, por exemplo, assenta todo o controlo de acessos no RLS.

## 6. O vizinho ruidoso

Partilhar a infraestrutura também partilha os recursos: um cliente que importa um milhão de linhas, ou que faz um teste de carga contra a API, deixa todos os outros lentos. É o **vizinho ruidoso** (*noisy neighbor*). As defesas são as do módulo 50, aplicadas por inquilino:

- **quotas e limites de pedidos por inquilino** (com limites diferentes por plano), em vez de um limite global que o maior cliente esgota;
- **filas justas**: os trabalhos em segundo plano (módulos 06 e 07) rodam entre inquilinos, em vez de "primeiro a chegar, primeiro a ser servido", em que mil trabalhos de um cliente atrasam o único trabalho de outro;
- **anteparas** (módulo 50): os clientes grandes em *workers* ou réplicas próprias;
- **métricas por inquilino** (módulo 19, com cuidado com a cardinalidade das etiquetas), para saber quem está a gastar o quê, e para cobrar.

## 7. O resto do ciclo de vida

Um inquilino também se **cria** (provisionar: dados iniciais, configuração, utilizadores), se **exporta** (o RGPD dá direito à portabilidade, módulo 53), e se **apaga** por inteiro quando o contrato acaba: com o esquema partilhado, isso é um `DELETE ... WHERE inquilino = ?` em todas as tabelas, mais as caches, os ficheiros e os *backups*. Pensar nisto no início poupa muito trabalho depois.

## Em resumo

- Num SaaS, cada organização cliente é um **inquilino**; o maior perigo é um inquilino ver os dados de outro.
- Há três modelos de isolamento: **BD por inquilino** (o mais forte e caro), **esquema por inquilino**, e **esquema partilhado** com uma coluna de inquilino (o mais comum), muitas vezes misturados.
- O inquilino de cada pedido vem do subdomínio, do token ou de um cabeçalho, e **a fonte autenticada manda**: fontes em conflito recusam o pedido.
- No esquema partilhado, as **chaves compostas** `(inquilino, id)` impedem referências entre inquilinos, e um repositório criado para um inquilino nunca esquece o filtro.
- A ***row-level security*** do Postgres é a segunda barreira: o inquilino define-se por transação, e a aplicação usa um papel que não ignora as políticas.
- O **vizinho ruidoso** combate-se com quotas, filas justas e anteparas por inquilino.

---

## Prática: escreve tu

O multi-inquilino de ponta a ponta: descobrir o inquilino de um pedido sem deixar que um cabeçalho contradiga o token, um esquema partilhado com chaves compostas e um repositório que nunca esquece o filtro, *row-level security* num Postgres a sério (o PGlite, com papéis), e uma fila justa e quotas contra o vizinho ruidoso.

**Ficheiros:** `pratica/39-multi-inquilino/` (`inquilino.js`, `repositorio.js`, `rls.js`, `justica.js`)

**Verificar:** `npm run verificar 39` (dentro de `pratica/`). Só um exercício: `npm run verificar 39 inquilino`, `... 39 repositorio`, `... 39 rls` ou `... 39 justica`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Descobrir o inquilino (≈20 min)

**Ficheiro:** `inquilino.js`

Juntar o subdomínio, o cabeçalho e o token, recusar conflitos, pedidos sem inquilino e inquilinos desconhecidos, e não se deixar enganar por domínios parecidos.

**Sintaxe que vais praticar:** `split(':')[0]` para tirar a porta, `endsWith` com o ponto incluído, `new Set` para tirar repetidos, encadeamento opcional (`pedido.token?.inquilino`).

<details>
<summary>Pista</summary>

Junta numa lista todas as fontes que existem; tira os repetidos; depois é só contar: zero, um, ou mais do que um. Para o subdomínio, o anfitrião tem de terminar em `.` + domínio base, e o que sobra à frente não pode ter pontos.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P1 · Descobrir o inquilino (o cliente, a organização) de cada pedido.

export class ErroInquilino extends Error {}

// resolverInquilino(pedido, { dominioBase, validos }) → o id do inquilino (texto)
//   pedido: { anfitriao: 'acme.tarefas.pt:443', cabecalhos: { 'x-inquilino': ... }, token: { inquilino } | null }
//   As fontes possíveis:
//   - o subdomínio: anfitriao (sem a porta, em minúsculas) = '<sub>.<dominioBase>', com <sub> sem
//     pontos (o próprio dominioBase, ou outros domínios, não dão subdomínio)
//   - o cabeçalho 'x-inquilino'
//   - o token autenticado (token.inquilino)
//   Regras (todas com ErroInquilino):
//   - as fontes presentes têm de concordar entre si; valores diferentes → mensagem com 'conflito'
//     (um utilizador da acme não pode pedir dados da globex mudando um cabeçalho)
//   - nenhuma fonte → mensagem com 'Sem inquilino'
//   - um inquilino que não está em `validos` (um Set) → mensagem com 'desconhecido'
export function resolverInquilino(pedido, { dominioBase, validos }) {
  const fontes = [];
  if (pedido.token?.inquilino) fontes.push(pedido.token.inquilino);
  const anfitriao = (pedido.anfitriao ?? '').split(':')[0].toLowerCase();
  if (anfitriao.endsWith(`.${dominioBase}`)) {
    const sub = anfitriao.slice(0, -(dominioBase.length + 1));
    if (sub && !sub.includes('.')) fontes.push(sub);
  }
  if (pedido.cabecalhos?.['x-inquilino']) fontes.push(pedido.cabecalhos['x-inquilino']);
  const distintos = [...new Set(fontes)];
  if (distintos.length === 0) throw new ErroInquilino('Sem inquilino no pedido');
  if (distintos.length > 1) throw new ErroInquilino(`Inquilinos em conflito: ${distintos.join(', ')}`);
  if (!validos.has(distintos[0])) throw new ErroInquilino(`Inquilino desconhecido: ${distintos[0]}`);
  return distintos[0];
}
```
</details>

### P2 · Esquema partilhado (≈25 min)

**Ficheiro:** `repositorio.js`

As tabelas com chaves primárias e estrangeiras compostas, e um repositório criado para um inquilino, em que todas as operações usam esse inquilino.

**Sintaxe que vais praticar:** `PRIMARY KEY (a, b)`, `FOREIGN KEY (a, b) REFERENCES t (a, b)`, uma *closure* que guarda o inquilino, `affectedRows`.

<details>
<summary>Pista</summary>

O repositório é uma função que valida o inquilino e devolve um objeto com métodos; cada método tem `inquilino = $1` na consulta (e o inquilino na lista de parâmetros). Nenhum método recebe o inquilino como parâmetro: é isso que torna impossível esquecê-lo.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P2 · Esquema partilhado com uma coluna de inquilino, e um repositório que nunca a esquece.

// criarEsquema(db): cria as tabelas
//   projetos(inquilino text, id int, nome text)          chave primária (inquilino, id)
//   tarefas(inquilino text, id int, projeto_id int, titulo text)   chave primária (inquilino, id)
//   com uma chave estrangeira COMPOSTA (inquilino, projeto_id) → projetos(inquilino, id): assim é
//   impossível uma tarefa da acme apontar para um projeto da globex, mesmo com o id certo.
export async function criarEsquema(db) {
  await db.exec(`
    CREATE TABLE projetos (inquilino text NOT NULL, id int NOT NULL, nome text NOT NULL, PRIMARY KEY (inquilino, id));
    CREATE TABLE tarefas (
      inquilino text NOT NULL, id int NOT NULL, projeto_id int NOT NULL, titulo text NOT NULL,
      PRIMARY KEY (inquilino, id),
      FOREIGN KEY (inquilino, projeto_id) REFERENCES projetos (inquilino, id)
    );
  `);
}

// repositorio(db, inquilino) → { criarProjeto(id, nome), criarTarefa(id, projetoId, titulo),
//                                 tarefas(), tarefa(id), apagarTarefa(id) }
//   Todas as operações só veem e mexem nos dados DESTE inquilino:
//   tarefas() → [{ id, projeto_id, titulo }] por id; tarefa(id) → { id, projeto_id, titulo } ou null;
//   apagarTarefa(id) → true se apagou, false se não havia (incluindo se for de outro inquilino).
//   O inquilino tem de ser um texto não vazio; senão, lança um Error logo na criação.
export function repositorio(db, inquilino) {
  if (typeof inquilino !== 'string' || inquilino === '') throw new Error('Inquilino inválido');
  return {
    async criarProjeto(id, nome) {
      await db.query('INSERT INTO projetos (inquilino, id, nome) VALUES ($1, $2, $3)', [inquilino, id, nome]);
    },
    async criarTarefa(id, projetoId, titulo) {
      await db.query('INSERT INTO tarefas (inquilino, id, projeto_id, titulo) VALUES ($1, $2, $3, $4)', [inquilino, id, projetoId, titulo]);
    },
    async tarefas() {
      return (await db.query('SELECT id, projeto_id, titulo FROM tarefas WHERE inquilino = $1 ORDER BY id', [inquilino])).rows;
    },
    async tarefa(id) {
      return (await db.query('SELECT id, projeto_id, titulo FROM tarefas WHERE inquilino = $1 AND id = $2', [inquilino, id])).rows[0] ?? null;
    },
    async apagarTarefa(id) {
      return (await db.query('DELETE FROM tarefas WHERE inquilino = $1 AND id = $2', [inquilino, id])).affectedRows > 0;
    },
  };
}
```
</details>

### P3 · Row-level security (≈25 min)

**Ficheiro:** `rls.js`

Um papel para a aplicação, o RLS ativo e forçado com uma política de leitura e escrita, e uma função que corre código numa transação com o inquilino definido só até ao fim dela.

**Sintaxe que vais praticar:** `CREATE ROLE`, `GRANT`, `ENABLE`/`FORCE ROW LEVEL SECURITY`, `CREATE POLICY ... USING ... WITH CHECK`, `set_config(nome, valor, true)`, `SET LOCAL ROLE`.

<details>
<summary>Pista</summary>

Dentro da transação, primeiro o `set_config` (com `true` no fim: só para esta transação) e depois o `SET LOCAL ROLE app`; a partir daí, o código que corre já não é superutilizador e as políticas aplicam-se. Os testes confirmam que, depois da transação, não sobra nada definido.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P3 · Row-Level Security: o próprio Postgres filtra as linhas pelo inquilino, mesmo que o
// código se esqueça do WHERE.
// Tabela (criada pelos testes): notas(inquilino text, id int, texto text)

// ativarRls(db):
//   1. cria o papel `app` (sem login: é o papel com que a aplicação faz as consultas) e dá-lhe
//      SELECT, INSERT, UPDATE e DELETE na tabela notas
//   2. ativa o RLS na tabela, e FORÇA-o (sem o FORCE, o dono da tabela ignora as políticas)
//   3. cria uma política: só as linhas com inquilino = current_setting('app.inquilino', true),
//      tanto para ler (USING) como para escrever (WITH CHECK)
//   (Nota: um superutilizador ignora sempre o RLS; por isso a aplicação usa o papel app.)
export async function ativarRls(db) {
  await db.exec(`
    CREATE ROLE app NOLOGIN;
    GRANT SELECT, INSERT, UPDATE, DELETE ON notas TO app;
    ALTER TABLE notas ENABLE ROW LEVEL SECURITY;
    ALTER TABLE notas FORCE ROW LEVEL SECURITY;
    CREATE POLICY por_inquilino ON notas
      USING (inquilino = current_setting('app.inquilino', true))
      WITH CHECK (inquilino = current_setting('app.inquilino', true));
  `);
}

// comInquilino(db, inquilino, fn) → o resultado de fn(tx)
//   Corre fn numa transação em que: app.inquilino = inquilino (com set_config(..., true), que só
//   vale até ao fim da transação: com um pool de ligações, nunca passa para o pedido seguinte)
//   e o papel é app (SET LOCAL ROLE app).
//   Inquilino que não seja um texto não vazio → lança Error('Inquilino inválido') sem abrir nada.
export async function comInquilino(db, inquilino, fn) {
  if (typeof inquilino !== 'string' || inquilino === '') throw new Error('Inquilino inválido');
  return db.transaction(async (tx) => {
    await tx.query("SELECT set_config('app.inquilino', $1, true)", [inquilino]);
    await tx.query('SET LOCAL ROLE app');
    return fn(tx);
  });
}
```
</details>

### P4 · O vizinho ruidoso (≈25 min)

**Ficheiro:** `justica.js`

Uma fila que roda entre inquilinos (o grande não passa à frente do pequeno), e quotas por minuto com limites diferentes por plano.

**Sintaxe que vais praticar:** a ordem de inserção de um `Map` como fila de rotação (apagar e voltar a inserir manda para o fim), `filas.keys().next()`, janelas de tempo com `Math.floor`.

<details>
<summary>Pista</summary>

Um `Map` lembra-se da ordem em que as chaves foram inseridas. O próximo inquilino é a primeira chave; depois de lhe tirares um trabalho, apaga-o do `Map` e, se ainda tiver trabalhos, volta a inseri-lo: fica no fim da rotação.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P4 · O vizinho ruidoso: um inquilino com muito tráfego não pode atrasar os outros.

// criarFilaJusta() → { adicionar(inquilino, trabalho), proxima(), get tamanho }
//   Uma fila por inquilino; proxima() vai rodando entre os inquilinos (round-robin), um trabalho
//   de cada vez, pela ordem em que os inquilinos chegaram; dentro de cada inquilino, por ordem de
//   chegada. Um inquilino que fica sem trabalhos sai da rotação, e se voltar entra no fim.
//   proxima() → { inquilino, trabalho }, ou null se não houver nada.
export function criarFilaJusta() {
  const filas = new Map(); // inquilino → [trabalhos]   (a ordem do Map é a rotação)
  let tamanho = 0;
  return {
    adicionar(inquilino, trabalho) {
      if (!filas.has(inquilino)) filas.set(inquilino, []);
      filas.get(inquilino).push(trabalho);
      tamanho++;
    },
    proxima() {
      const primeiro = filas.keys().next();
      if (primeiro.done) return null;
      const inquilino = primeiro.value;
      const fila = filas.get(inquilino);
      const trabalho = fila.shift();
      filas.delete(inquilino);
      if (fila.length > 0) filas.set(inquilino, fila); // volta para o fim da rotação
      tamanho--;
      return { inquilino, trabalho };
    },
    get tamanho() {
      return tamanho;
    },
  };
}

// criarQuotas({ porMinuto, excecoes = {}, agora = Date.now }) → { permitir(inquilino) }
//   Limite de pedidos por inquilino em janelas fixas de um minuto (a janela de um instante t é
//   Math.floor(t / 60000)). O limite é excecoes[inquilino] se existir (os planos pagos), senão porMinuto.
//   permitir → { permitido, restantes }: conta o pedido se for permitido; restantes é quantos
//   ainda pode fazer nesta janela (0 quando é recusado). Cada inquilino tem a sua contagem.
export function criarQuotas({ porMinuto, excecoes = {}, agora = Date.now }) {
  const contagens = new Map(); // inquilino → { janela, usados }
  return {
    permitir(inquilino) {
      const janela = Math.floor(agora() / 60_000);
      const limite = Object.hasOwn(excecoes, inquilino) ? excecoes[inquilino] : porMinuto;
      let c = contagens.get(inquilino);
      if (!c || c.janela !== janela) {
        c = { janela, usados: 0 };
        contagens.set(inquilino, c);
      }
      if (c.usados >= limite) return { permitido: false, restantes: 0 };
      c.usados++;
      return { permitido: true, restantes: limite - c.usados };
    },
  };
}
```
</details>

## Experiências

1. **O workshop com organizações:** desenha (no papel) a migração da API do workshop de "tarefas por utilizador" para "tarefas por organização, partilhadas pelos membros". Que tabelas mudam? Como fazes a migração sem parar o serviço (módulo 52)?
2. **RLS no Postgres do workshop:** com o `psql`, ativa o RLS na tabela `tasks` com uma política por `user_id = current_setting('app.utilizador')::int`, cria um papel para a API, e vê o que acontece às consultas da API sem mudar o código. O que falta para funcionar?
3. **O superutilizador:** no PGlite (ou no `psql` como `postgres`), confirma que um superutilizador vê todas as linhas mesmo com o RLS forçado. Que consequências tem para a configuração da ligação da aplicação?
4. **Uma fila justa no RabbitMQ:** como farias o P4 com o RabbitMQ (módulo 06)? Uma fila por inquilino, uma fila com prioridades, *consumers* com `prefetch`? Compara as opções.

## Perguntas de pensamento crítico

1. Um cliente grande exige que os seus dados fiquem numa base de dados separada. Como acomodas isto num sistema com esquema partilhado, sem duplicar o código?
2. Porque é que o RLS é uma "segunda barreira" e não substitui o filtro por inquilino no código?
3. A API aceita o inquilino num cabeçalho `X-Inquilino` e usa-o se o token não tiver nenhum. Que risco vês?

<details>
<summary>Respostas</summary>

1. Tornando "onde estão os dados deste inquilino" numa configuração: um catálogo de inquilinos diz, para cada um, que ligação (ou que servidor) usar, e a camada de acesso aos dados escolhe a ligação a partir do inquilino do pedido. O código das consultas é o mesmo (continua a filtrar pelo inquilino, que na BD dedicada é sempre o mesmo valor). As migrações passam a correr em todas as bases de dados (a partilhada e as dedicadas), e a monitorização e os *backups* também. É o modelo híbrido mais comum.
2. Porque é uma rede de segurança para quando o código falha, não o mecanismo principal: o filtro explícito no código torna a intenção clara, permite índices e consultas eficientes, funciona em operações fora do Postgres (cache, ficheiros, eventos, outros serviços), e não depende de a ligação estar configurada com o papel e a definição certos. O RLS apanha o `WHERE` esquecido; o código não deve contar com ele para estar certo.
3. Que, se algum caminho autenticado deixar de pôr o inquilino no token (um tipo de token novo, uma integração, uma rota de administração, um erro de configuração no Keycloak), o cabeçalho passa a decidir, e qualquer utilizador pode escolher o inquilino de quem quiser. A fonte autenticada tem de ser obrigatória para pedidos autenticados; o cabeçalho, quando existe, só pode **confirmar** o que o token diz, nunca substituí-lo.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 39`.

**1.** Qual é o modelo de isolamento mais usado em SaaS, por ser o mais barato de operar?

- a) Base de dados por inquilino
- b) Esquema por inquilino
- c) Esquema partilhado com uma coluna de inquilino
- d) Um servidor por inquilino

<details><summary>Resposta</summary>

**c) Esquema partilhado com uma coluna de inquilino** — O risco é esquecer o filtro; daí as chaves compostas e o RLS.

</details>

**2.** O token diz 'acme' e o cabeçalho X-Inquilino diz 'globex'. O que deve acontecer?

- a) Usar o cabeçalho
- b) Usar o token e ignorar o cabeçalho em silêncio
- c) Recusar o pedido: as fontes estão em conflito
- d) Mostrar os dados das duas

<details><summary>Resposta</summary>

**c) Recusar o pedido: as fontes estão em conflito** — A fonte autenticada manda; um conflito é um sinal de ataque ou de erro.

</details>

**3.** Que funcionalidade do Postgres filtra as linhas por uma política em todas as consultas, mesmo sem WHERE (sigla)?

<details><summary>Resposta</summary>

**rls** — Os superutilizadores ignoram-na; a aplicação usa um papel próprio.

</details>

**4.** Porque se usa set_config('app.inquilino', x, true) com o true no fim?

- a) Para ser mais rápido
- b) Para a definição valer só até ao fim da transação e não passar para o pedido seguinte no pool de ligações
- c) Para guardar no disco
- d) Para o RLS ficar desligado

<details><summary>Resposta</summary>

**b) Para a definição valer só até ao fim da transação e não passar para o pedido seguinte no pool de ligações** — Uma definição de sessão passaria para outro inquilino na mesma ligação.

</details>

**5.** O que resolve uma fila justa (round-robin por inquilino)?

- a) Duplicados
- b) O vizinho ruidoso: mil trabalhos de um cliente não atrasam o único trabalho de outro
- c) Ordem dos eventos
- d) Falta de memória

<details><summary>Resposta</summary>

**b) O vizinho ruidoso: mil trabalhos de um cliente não atrasam o único trabalho de outro** — Junta-se a quotas por inquilino e a anteparas para os clientes grandes.

</details>

<!-- quiz:end -->
