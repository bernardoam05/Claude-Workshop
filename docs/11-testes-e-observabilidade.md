# 11 · Testes e observabilidade

**Objetivo:** perceber **o que** testar, **com que nível de isolamento**, e como saber, em produção, se o sistema está saudável.

**Ficheiros para ler primeiro:** `src/api/test/taskService.test.js`, `src/api/test/routes.test.js`, `src/worker/test/handler.test.js`, `scripts/smoke-test.sh`, e os endpoints `/api/health` e `/api/stats`.

---

## 1. Porque testar

Um teste é uma **especificação executável**. Diz o que o código deve fazer, e corre sempre que mudas algo. O valor não está em "ter cobertura", mas em **poder mudar o código com confiança**.

Os testes deste projeto correm com `npm test` **sem Docker, sem BD, sem rede**. Isso é de propósito: testes lentos e frágeis não são corridos, e testes que não são corridos não servem.

## 2. A pirâmide

```
           ▲   poucos: E2E (browser + sistema todo)   → scripts/smoke-test.sh
          ▲▲   alguns: integração (BD real)            → test/integration/ (npm run test:integration)
        ▲▲▲▲   muitos: unitários (lógica, com fakes)    → services/, handler.js
```

Quanto mais alto, mais realista, mais lento e mais frágil. Quanto mais baixo, mais rápido e mais focado. Uma base larga de testes unitários com poucos E2E é o equilíbrio típico.

## 3. Test doubles: nomes que importam

| Termo | O que é | Exemplo no projeto |
|---|---|---|
| **Stub** | devolve valores pré-definidos | `findAll: async () => [...]` |
| **Fake** | implementação **funcional** simplificada | a BD em `Map` em `taskService.test.js` |
| **Mock** | verifica **interações** (foi chamado com X?) | `assert.equal(published.length, 1)` |
| **Spy** | regista chamadas, sem mudar comportamento | `cacheDeletes.push(...)` |

Na prática, os nossos testes são **fakes com verificação de interações**. O fake `repository` **funciona** (guarda e devolve tarefas), e depois verificamos o que foi publicado.

**Regra importante que aplicámos:** o fake tem de se comportar como o real. O `findById` devolve uma **cópia**, porque a BD também devolve uma linha nova. Na primeira versão devolvia a referência, e o teste "mentiu" (passava ou falhava pelas razões erradas). Um fake que não imita o real dá uma falsa sensação de segurança.

**Pergunta:** se o fake `setDone` não fizesse nada (devolvesse sempre `done: false`), que teste deixaria de detetar um bug? Escreve o bug que passaria despercebido.

<details>
<summary>Resposta</summary>

O teste "só publica na transição false → true" continuaria a passar, mas com razões erradas: o `findById` daria `done: false` sempre, e publicaria em **todas** as chamadas. Se o teste tivesse verificado `published.length === 1` depois de duas chamadas `done: true`, falharia. Ou seja, o teste depende de o fake ser fiel: um fake preguiçoso esconde bugs.
</details>

## 4. O que testar (e o que não)

Testa **comportamento observável**, não implementação:

- ✅ "Marcar duas vezes como concluída publica um evento."
- ✅ "Pedido com título vazio devolve 400."
- ✅ "Duas entregas do mesmo evento têm efeito uma vez."
- ❌ "A função X chama a função Y com 3 argumentos exatos." Isto parte sempre que refatorares.

Um teste que parte em refatoração **sem** mudança de comportamento é um teste mal escrito.

## 5. O que os testes **não** apanham

Dizer isto em voz alta é parte da engenharia:

- **Condições de corrida** (duas chamadas concorrentes ao `updateTask`). Os testes são sequenciais. Para os apanhar: testes de carga ou de concorrência com BD real.
- **Erros de SQL**: o fake não sabe que `$1` está mal escrito. Só um teste de integração com Postgres real o apanha.
- **Configuração errada do Docker** (ex.: porta trocada no compose). Só o `smoke-test.sh` o apanha.

Por isso existem **três níveis**. Nenhum sozinho chega.

## 6. Testes de rotas sem infraestrutura

`routes.test.js` arranca a app Express numa porta livre (`listen(0)`), faz pedidos reais com `fetch`, e usa um serviço falso. Testa o **contrato HTTP** (códigos, cabeçalhos, JSON) sem BD. Repara em `withServer`: arranca, executa, e **fecha sempre** no `finally`, mesmo que o teste falhe. Sem isto, um teste que falha deixava o servidor aberto e os testes seguintes falhavam por porta ocupada.

## 7. `node:test`: sem frameworks

Usamos o test runner **embutido** do Node (`node --test`) e `node:assert/strict`. Zero dependências de teste. Trade-off: menos açúcar sintático do que Jest ou Vitest, mas nada para instalar e nada para atualizar. Para um projeto pequeno, é a escolha certa; para um grande, Vitest ou Jest dão melhor relatório e *mocks* automáticos.

## 8. Observabilidade: saber o que se passa

Testes dizem se o código está certo **antes** de sair. Observabilidade diz o que está a acontecer **depois**. Tem três pilares:

| Pilar | O que é | No projeto |
|---|---|---|
| **Logs** | eventos textuais | `console.log` / `console.error` (ver `docker compose logs`) |
| **Métricas** | números agregados ao longo do tempo | não temos (exercício C12: Prometheus) |
| **Traces** | o caminho de um pedido entre serviços | não temos (ver exercício C16 para a correlação, que é o primeiro passo) |

## 9. Health checks: duas perguntas diferentes

- **Liveness**: "o processo está vivo?" Se não, reinicia-o.
- **Readiness**: "está pronto para receber trabalho?" Se não, não lhe mandes pedidos.

Lê o `/api/health`: faz `SELECT 1` e `PING` ao Redis. Isto é **readiness** disfarçada: se a BD estiver em baixo, devolve `503`. O Docker usa-o para o `healthcheck`, e o compose usa-o para decidir o arranque (módulo 02).

**Armadilha:** se o liveness dependesse da BD, uma BD em baixo faria o Docker **reiniciar a API** em loop, o que não resolve nada e piora a situação. Liveness deve ser barato e local; readiness pode olhar para dependências.

Experiência: `docker compose ... stop postgres` e depois `curl -i localhost:8080/api/health`. Recebes `503`. Repara que o processo da API continua vivo (`docker compose ps` mostra `running`).

## 10. Logs: o que escrever

Os nossos logs são texto livre: `[worker] task.completed → processado`. Para um sistema real, usa-se **logs estruturados** (JSON), porque podem ser pesquisados e agregados:

```json
{"level":"info","service":"worker","event":"task.completed","result":"processado","eventId":"8f1c...","ts":"2026-10-04T10:00:00Z"}
```

Com `eventId` em todos os logs de um fluxo, consegues seguir **uma** tarefa desde o pedido HTTP até ao worker. Isto chama-se **correlação**, e é um exercício avançado: propaga um `X-Request-Id` da API para o evento.

## 11. O smoke test

`scripts/smoke-test.sh` é um **E2E mínimo**: percorre o fluxo real pelo Nginx e confirma que o worker processou. Repara que espera de forma **ativa** (ciclo com `sleep`), porque o worker é assíncrono: não há uma resposta síncrona para verificar. Isto é testar consistência eventual.

---

## Prática: escreve tu

Neste módulo os papéis invertem-se: o código já está escrito e **correto**. Tu escreves **os testes**.

Como se sabe se uns testes são bons? Não chega que passem: um ficheiro sem testes também "passa". O verificador usa **mutation testing**:

1. corre os teus testes contra o código verdadeiro, onde **têm de passar**;
2. corre-os outra vez contra cada **mutante**, uma cópia do código com **um** bug plantado (um `<` trocado por `<=`, uma linha a menos, uma ordem trocada). Cada mutante tem de fazer **pelo menos um** teste falhar.

Um mutante que "sobrevive" é um bug real que os teus testes deixariam chegar a produção. Os mutantes estão em `pratica/11-testes-e-observabilidade/mutantes/`, mas **não os abras antes de tempo**: o exercício é descobrir sozinho que comportamentos merecem um teste. Quando um sobreviver, tenta primeiro adivinhar porquê; só depois faz `diff prazos.js mutantes/prazos-3.js` para ver o bug.

Em projetos reais, isto faz-se com ferramentas como o [Stryker](https://stryker-mutator.io), que geram os mutantes sozinhas. Aqui foram escritos à mão, um por cada erro típico.

**Verificar:** `npm run verificar 11 prazos`, `... 11 lembretes` ou `... 11 repositorio` (dentro de `pratica/`). Demora alguns segundos: corre os teus testes uma vez por mutante.

Cada ficheiro de teste já tem **um** teste de exemplo, para veres a sintaxe. Os testes importam o código através de `carregar(...)` (em `alvo.js`), e não diretamente: é isso que deixa o verificador trocar o código pelos mutantes.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Testes unitários de funções puras (≈30 min, 8 mutantes)

**Ficheiro:** `pratica/11-testes-e-observabilidade/prazos.test.js` · **Código a testar:** `prazos.js`

`estadoDaTarefa` classifica uma tarefa (`concluida`, `sem-prazo`, `atrasada`, `hoje`, `em-breve`, `futura`) e `ordenarPorUrgencia` ordena uma lista. São funções puras (sem BD, sem rede, sem relógio), o caso mais simples de testar. E mesmo assim há 8 maneiras de as estragar sem que um teste "óbvio" dê por isso.

**Sintaxe que vais praticar:** `describe`/`it`, `assert.equal`, `assert.deepEqual`, `.map((t) => t.id)` para comparar só o que importa, `structuredClone` para confirmar que algo não foi alterado.

<details>
<summary>Pista</summary>

Os bugs vivem nas **fronteiras**. Se "em breve" é "1 a 3 dias", testa o dia 0, o dia 1, o dia 3 e o dia 4. E pensa nos casos que se combinam: uma tarefa **feita** com um prazo que **já passou** é o quê? Na ordenação, testa os desempates (mesmo estado, mesmo prazo) e verifica que a lista original **não** muda.
</details>

<details>
<summary>Solução de referência</summary>

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { carregar } from './alvo.js';

const { estadoDaTarefa, ordenarPorUrgencia } = await carregar('prazos');

const HOJE = '2026-10-14';
const tarefa = (due, extra = {}) => ({ id: 1, done: false, due, ...extra });

describe('estadoDaTarefa', () => {
  it('uma tarefa feita está concluída', () => {
    assert.equal(estadoDaTarefa({ done: true, due: '2026-10-20' }, HOJE), 'concluida');
  });

  it('uma tarefa feita está concluída MESMO que o prazo já tenha passado', () => {
    assert.equal(estadoDaTarefa(tarefa('2026-10-01', { done: true }), HOJE), 'concluida');
  });

  it('sem prazo: sem-prazo', () => {
    assert.equal(estadoDaTarefa(tarefa(null), HOJE), 'sem-prazo');
    assert.equal(estadoDaTarefa({ id: 1, done: false }, HOJE), 'sem-prazo');
  });

  // Os limites são onde moram os bugs: testa o último dia de cada estado e o primeiro do seguinte.
  it('fronteiras: ontem, hoje, amanhã, daqui a 3 dias, daqui a 4 dias', () => {
    assert.equal(estadoDaTarefa(tarefa('2026-10-13'), HOJE), 'atrasada');
    assert.equal(estadoDaTarefa(tarefa('2026-10-14'), HOJE), 'hoje');
    assert.equal(estadoDaTarefa(tarefa('2026-10-15'), HOJE), 'em-breve');
    assert.equal(estadoDaTarefa(tarefa('2026-10-17'), HOJE), 'em-breve');
    assert.equal(estadoDaTarefa(tarefa('2026-10-18'), HOJE), 'futura');
  });
});

describe('ordenarPorUrgencia', () => {
  it('ordena por estado: atrasada, hoje, em-breve, futura, sem-prazo, concluída', () => {
    const tarefas = [
      { id: 1, done: true, due: '2026-10-01' },
      { id: 2, done: false, due: null },
      { id: 3, done: false, due: '2026-12-01' },
      { id: 4, done: false, due: '2026-10-15' },
      { id: 5, done: false, due: '2026-10-14' },
      { id: 6, done: false, due: '2026-10-10' },
    ];
    assert.deepEqual(ordenarPorUrgencia(tarefas, HOJE).map((t) => t.id), [6, 5, 4, 3, 2, 1]);
  });

  it('no mesmo estado, o prazo mais antigo primeiro', () => {
    const tarefas = [
      { id: 1, done: false, due: '2026-10-12' },
      { id: 2, done: false, due: '2026-10-05' },
    ];
    assert.deepEqual(ordenarPorUrgencia(tarefas, HOJE).map((t) => t.id), [2, 1]);
  });

  it('no mesmo prazo, o id mais baixo primeiro', () => {
    const tarefas = [
      { id: 9, done: false, due: '2026-10-20' },
      { id: 3, done: false, due: '2026-10-20' },
    ];
    assert.deepEqual(ordenarPorUrgencia(tarefas, HOJE).map((t) => t.id), [3, 9]);
  });

  it('não altera a lista original', () => {
    const tarefas = [
      { id: 2, done: false, due: null },
      { id: 1, done: false, due: '2026-10-10' },
    ];
    const copia = structuredClone(tarefas);
    ordenarPorUrgencia(tarefas, HOJE);
    assert.deepEqual(tarefas, copia);
  });
});
```
</details>

### P2 · Dublês de teste: fakes e mocks (≈40 min, 8 mutantes)

**Ficheiro:** `pratica/11-testes-e-observabilidade/lembretes.test.js` · **Código a testar:** `lembretes.js`

O serviço de lembretes envia um email por utilizador com as tarefas que acabam amanhã. Tem três dependências (repositório, mailer e relógio), todas recebidas por parâmetro. Substitui-as por dublês (secção 3): um repositório **fake** que devolve as tarefas que lhe deres, um mailer **mock** que regista as chamadas, e um relógio parado num dia fixo.

Os mutantes deste exercício são do tipo que só se apanha verificando **interações**: um email por tarefa em vez de um por utilizador, marcar como lembrada **antes** de enviar (e perder o lembrete se o envio falhar), parar no primeiro erro em vez de continuar com os outros...

**Sintaxe que vais praticar:** `mock.fn(async () => ...)` do `node:test`, `fn.mock.callCount()`, `fn.mock.calls[i].arguments`, funções de montagem (`function montar(tarefas, opcoes)`) que poupam repetição entre testes.

<details>
<summary>Pista</summary>

Escreve uma função `montar(tarefas, { mailerFalhaPara })` que cria os três dublês e o serviço, e devolve tudo. Cada teste fica com três linhas: montar, chamar, verificar. Para o caso da falha, faz o mailer **lançar** um erro só para um utilizador, e verifica três coisas: o resultado, que o outro utilizador recebeu o email, e o que foi (e não foi) marcado como lembrado.
</details>

<details>
<summary>Solução de referência</summary>

```js
import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { carregar } from './alvo.js';

const { createReminderService } = await carregar('lembretes');

const HOJE = '2026-10-14';
const AMANHA = '2026-10-15';

// Um repositório FAKE: devolve as tarefas que lhe dermos, mas só se a data pedida for a de amanhã
// (como faria a BD), e regista o que foi marcado. As funções são mock.fn para podermos inspecioná-las.
function montar(tarefas, { mailerFalhaPara = [] } = {}) {
  const repository = {
    tarefasComPrazo: mock.fn(async (data) => (data === AMANHA ? structuredClone(tarefas) : [])),
    marcarLembradas: mock.fn(async () => {}),
  };
  const mailer = {
    enviar: mock.fn(async (userId) => {
      if (mailerFalhaPara.includes(userId)) throw new Error('SMTP em baixo');
    }),
  };
  const service = createReminderService({ repository, mailer, clock: () => HOJE });
  return { service, repository, mailer };
}

const t = (id, userId, extra = {}) => ({ id, userId, title: `Tarefa ${id}`, done: false, lembrada: false, ...extra });
const argumentos = (fn) => fn.mock.calls.map((c) => c.arguments);

describe('enviarLembretes', () => {
  it('sem tarefas para amanhã, não envia nenhum email', async () => {
    const { service, mailer } = montar([]);
    assert.deepEqual(await service.enviarLembretes(), { enviados: 0, falhas: [] });
    assert.equal(mailer.enviar.mock.callCount(), 0);
  });

  it('pergunta ao repositório pelas tarefas de AMANHÃ', async () => {
    const { service, repository } = montar([]);
    await service.enviarLembretes();
    assert.deepEqual(argumentos(repository.tarefasComPrazo), [[AMANHA]]);
  });

  it('um email por utilizador, com o número e os títulos das tarefas DELE', async () => {
    const { service, mailer } = montar([t(1, 7), t(2, 7), t(3, 8)]);
    assert.deepEqual(await service.enviarLembretes(), { enviados: 2, falhas: [] });
    assert.deepEqual(argumentos(mailer.enviar), [
      [7, 'Amanhã acaba o prazo de 2 tarefa(s)', ['Tarefa 1', 'Tarefa 2']],
      [8, 'Amanhã acaba o prazo de 1 tarefa(s)', ['Tarefa 3']],
    ]);
  });

  it('ignora tarefas já feitas e tarefas já lembradas', async () => {
    const { service, mailer } = montar([t(1, 7, { done: true }), t(2, 7, { lembrada: true }), t(3, 7)]);
    await service.enviarLembretes();
    assert.deepEqual(argumentos(mailer.enviar), [[7, 'Amanhã acaba o prazo de 1 tarefa(s)', ['Tarefa 3']]]);
  });

  it('marca como lembradas as tarefas enviadas', async () => {
    const { service, repository } = montar([t(1, 7), t(2, 7)]);
    await service.enviarLembretes();
    assert.deepEqual(argumentos(repository.marcarLembradas), [[[1, 2]]]);
  });

  it('se o email de um utilizador falhar: continua com os outros e NÃO marca as tarefas dele', async () => {
    const { service, mailer, repository } = montar([t(1, 7), t(2, 8)], { mailerFalhaPara: [7] });
    assert.deepEqual(await service.enviarLembretes(), { enviados: 1, falhas: [7] });
    assert.equal(mailer.enviar.mock.callCount(), 2);
    assert.deepEqual(argumentos(repository.marcarLembradas), [[[2]]]);
  });
});
```
</details>

### P3 · Testes de integração com um Postgres a sério (≈30 min, 7 mutantes)

**Ficheiro:** `pratica/11-testes-e-observabilidade/repositorio.test.js` · **Código a testar:** `repositorio.js`

O repositório é SQL. Um fake em memória não apanharia **nenhum** dos seus bugs, porque o bug estaria no SQL que o fake substitui. Por isso, estes testes correm contra um Postgres de verdade (o PGlite do módulo 03), um degrau acima na pirâmide (secção 2).

Os mutantes são os bugs de SQL mais caros que existem: um `WHERE user_id` esquecido (a Ana vê as tarefas do Bruno), um `UPDATE` que não confirma o dono, um `count(*)` que volta como string...

**Sintaxe que vais praticar:** testes `async`, `await` em sequência para preparar dados, e a função `novo()` que dá a cada teste uma BD limpa (para os testes não dependerem uns dos outros).

<details>
<summary>Pista</summary>

Para cada função, pergunta: "e se fosse **outro** utilizador?". A maior parte dos mutantes deste exercício só se apanha com dois utilizadores na mesma BD. E não te esqueças de testar o que acontece quando se repete uma operação (concluir duas vezes, apagar duas vezes).
</details>

<details>
<summary>Solução de referência</summary>

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { carregar } from './alvo.js';
import { createTestDb } from './testDb.js';

const { createTaskRepository } = await carregar('repositorio');

async function novo() {
  const db = await createTestDb('schema.sql');
  await db.query(`INSERT INTO users (email) VALUES ('ana@exemplo.pt'), ('bruno@exemplo.pt')`);
  return { db, repo: createTaskRepository(db) };
}

describe('taskRepository', () => {
  it('criar devolve a tarefa nova, por fazer', async () => {
    const { repo } = await novo();
    const tarefa = await repo.criar(1, 'Estudar testes');
    assert.deepEqual(tarefa, { id: 1, userId: 1, title: 'Estudar testes', done: false });
  });

  it('listar só devolve as tarefas do utilizador, das mais recentes para as mais antigas', async () => {
    const { repo } = await novo();
    await repo.criar(1, 'Primeira da Ana');
    await repo.criar(2, 'Do Bruno');
    await repo.criar(1, 'Segunda da Ana');
    assert.deepEqual((await repo.listar(1)).map((t) => t.title), ['Segunda da Ana', 'Primeira da Ana']);
  });

  it('concluir marca como feita, e concluir duas vezes continua feita', async () => {
    const { repo } = await novo();
    const { id } = await repo.criar(1, 'X');
    assert.equal((await repo.concluir(id, 1)).done, true);
    assert.equal((await repo.concluir(id, 1)).done, true);
  });

  it('concluir uma tarefa inexistente ou de outro utilizador dá null e não muda nada', async () => {
    const { repo } = await novo();
    const { id } = await repo.criar(1, 'Da Ana');
    assert.equal(await repo.concluir(999, 1), null);
    assert.equal(await repo.concluir(id, 2), null);
    assert.equal((await repo.listar(1))[0].done, false);
  });

  it('apagar devolve true se apagou e false se não havia nada para apagar', async () => {
    const { repo } = await novo();
    const { id } = await repo.criar(1, 'X');
    assert.equal(await repo.apagar(id, 2), false, 'não se apagam tarefas de outros');
    assert.equal(await repo.apagar(id, 1), true);
    assert.equal(await repo.apagar(id, 1), false);
  });

  it('estatisticas conta total e feitas, como números', async () => {
    const { repo } = await novo();
    const { id } = await repo.criar(1, 'A');
    await repo.criar(1, 'B');
    await repo.criar(2, 'Do Bruno');
    await repo.concluir(id, 1);
    assert.deepEqual(await repo.estatisticas(1), { total: 2, feitas: 1 });
  });
});
```
</details>

**Depois de passar:** repara quantos testes precisaste para matar 23 mutantes, e como eram pequenos. Agora abre `src/api/test/taskService.test.js` e pergunta, para cada `if` do `taskService.js`: que mutante sobreviveria aos testes que lá estão?

## Experiências

1. **Quebrar um teste de propósito:** em `taskService.js`, troca `if (done && !before.done)` por `if (done)`. Corre `npm test` em `src/api`. Qual teste falha? Porquê? Desfaz.
2. **Quebrar a integração:** no `docker-compose.yml`, muda a `DATABASE_URL` do worker para uma password errada. Reinicia. Que logs aparecem? Porque é que o worker **não** tem healthcheck e como o verias em `docker compose ps`?
3. **Health:** para o Redis e vê o `/api/health`. Depois reinicia o Redis e vê se a API recupera sem reiniciar. (Pista: o `ioredis` reconecta sozinho.)

## Perguntas de pensamento crítico

1. Escreve um teste que **falharia** se a regra "invalidar a cache em `createTask`" fosse removida. Tens de usar o `cacheDeletes` do fake. Que assert escreves?
2. A pirâmide diz "muitos unitários". Porque é que um teste E2E que cria uma tarefa e verifica o contador **parece** mais útil e no entanto não é suficiente sozinho?
3. Um teste intermitente (passa 9 vezes em 10) aparece no CI. O que fazes **antes** de o marcar como `skip`?

<details>
<summary>Resposta</summary>

1. Algo como `assert.ok(fakes.cacheDeletes.includes(tasksCacheKey(1)))` depois de `createTask`. Já existe no ficheiro de testes. Repara que testa **a interação** (o `del` foi chamado com a chave certa), que é exatamente o tipo de coisa que o fake permite verificar.
2. O E2E é mais próximo do real, mas: é lento, falha por motivos não relacionados (rede, timing), não diz **qual** parte falhou, e só cobre o caminho feliz. Com 50 casos de borda em E2E, o CI demora uma hora e ninguém o corre. Os unitários dão feedback em milissegundos e localizam o problema.
3. Não se marca como `skip`. Primeiro tentas **reproduzir** (correr 100 vezes em loop: `for i in $(seq 100); do npm test || break; done`). Intermitência quase sempre é: **dependência de tempo** (timers, `setTimeout` de 10ms), **estado partilhado** entre testes, ou **ordem** de execução. Um teste marcado como `skip` é uma dívida que ninguém paga.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 11`.

**1.** Na pirâmide de testes, que nível deve ter o MAIOR número de testes?

- a) Testes E2E (browser)
- b) Testes de integração (BD real)
- c) Testes unitários (com fakes)
- d) Testes manuais

<details><summary>Resposta</summary>

**c) Testes unitários (com fakes)** — Rápidos, focados e sem infraestrutura — por isso são a base larga da pirâmide.

</details>

**2.** Qual a diferença entre um 'fake' e um 'mock', como usados neste workshop?

- a) São sempre sinónimos, sem diferença prática
- b) Um fake tem uma implementação funcional simplificada; um mock foca-se em verificar interações (foi chamado com X?)
- c) Mock é sempre mais rápido de escrever que um fake
- d) Fake só se usa em testes de Java

<details><summary>Resposta</summary>

**b) Um fake tem uma implementação funcional simplificada; um mock foca-se em verificar interações (foi chamado com X?)** — Os testes do projeto são, na prática, fakes com verificação de interações.

</details>

**3.** Porque é que um fake que devolve a mesma REFERÊNCIA de objeto (em vez de uma cópia) pode 'mentir' num teste?

- a) Nunca pode, é sempre seguro
- b) Mudanças feitas depois também alteram o 'valor antigo' já capturado, escondendo bugs de transição de estado
- c) Torna o teste mais lento
- d) Impede o teste de compilar

<details><summary>Resposta</summary>

**b) Mudanças feitas depois também alteram o 'valor antigo' já capturado, escondendo bugs de transição de estado** — Foi exactamente o que aconteceu no teste de updateTask: corrigiu-se fazendo findById devolver uma cópia.

</details>

**4.** Qual a diferença entre um healthcheck de liveness e um de readiness?

- a) São o mesmo conceito com nomes diferentes
- b) Liveness pergunta 'o processo está vivo?'; readiness pergunta 'está pronto para receber trabalho?' (verifica dependências)
- c) Liveness só existe no Kubernetes
- d) Readiness é sempre mais rápido de calcular

<details><summary>Resposta</summary>

**b) Liveness pergunta 'o processo está vivo?'; readiness pergunta 'está pronto para receber trabalho?' (verifica dependências)** — Se a liveness dependesse da BD, uma BD em baixo faria reiniciar a API em loop, sem resolver nada.

</details>

**5.** Que ferramenta corre os testes E2E num browser real neste projeto?

<details><summary>Resposta</summary>

**playwright** — Playwright, correndo numa imagem Docker oficial, inclusive no CI.

</details>

<!-- quiz:end -->
