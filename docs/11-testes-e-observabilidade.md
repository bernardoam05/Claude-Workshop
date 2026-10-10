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

1. Algo como `assert.ok(fakes.cacheDeletes.includes(TASKS_CACHE_KEY))` depois de `createTask`. Já existe no ficheiro de testes. Repara que testa **a interação** (o `del` foi chamado com a chave certa), que é exatamente o tipo de coisa que o fake permite verificar.
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
