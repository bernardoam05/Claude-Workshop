# 49 · Depuração e profiling em Node.js

**Objetivo:** investigar uma API lenta ou que gasta memória sem parar, em vez de adivinhar: o event loop e o que o bloqueia, o depurador, perfis de CPU e *flame graphs*, *heap snapshots* e fugas de memória, *streams* com *backpressure*, e *worker threads* para o trabalho pesado.

**Ficheiros para ler:** `src/api/src/index.js` (como a API arranca) e `src/api/src/services/authService.js` (o hash das passwords, um clássico de trabalho de CPU numa API).

**Pré-requisitos:** módulos 01 (Node e Express), 47 (observabilidade) e 48 (testes de carga).

---

## 1. Um processo, uma thread para o teu código

O Node corre o teu JavaScript numa **só thread**, com um **event loop**: pega numa tarefa (um pedido que chegou, um temporizador que disparou, uma resposta da base de dados), corre o código dela até ao fim, e passa à seguinte. As operações de entrada e saída (rede, disco, base de dados) não esperam: são entregues ao sistema operativo ou à *thread pool* do **libuv**, e o resultado volta como uma tarefa nova. É por isso que um só processo Node atende milhares de ligações ao mesmo tempo.

O preço: **enquanto o teu código corre, nada mais corre**. Um ciclo que demora 200 ms a processar um pedido atrasa 200 ms **todos** os outros pedidos, os *health checks* (módulo 32: o Kubernetes pode matar o pod), os *heartbeats* do RabbitMQ. O sintoma típico de um teste de carga (módulo 48): a latência sobe para todos os pedidos, não só para os pesados, e a CPU está a 100% num núcleo.

O que bloqueia o event loop, por ordem de frequência:

- **funções síncronas** de I/O e de cripto: `readFileSync`, `pbkdf2Sync`, `bcrypt.hashSync`, `zlib.gzipSync`;
- **JSON enorme**: `JSON.parse`/`stringify` de dezenas de MB;
- **ciclos sobre muitos dados** (ordenar, agrupar, filtrar 1 milhão de linhas em memória, em vez de na base de dados, módulo 36);
- **expressões regulares catastróficas** (*ReDoS*): uma regex com repetições aninhadas, como `(a+)+$`, pode demorar minutos com um texto de 30 caracteres, e um atacante só precisa de enviar esse texto.

Mede-se com `perf_hooks.monitorEventLoopDelay()`, que diz quanto tempo o event loop demorou a voltar a cada momento. É uma métrica que vale a pena exportar para o Prometheus (módulo 19; o `prom-client` já a tem).

## 2. O depurador

O `console.log` resolve muito, mas um depurador mostra tudo, sem mudar o código:

```bash
node --inspect src/index.js          # depois, abre chrome://inspect no Chrome
node --inspect-brk src/index.js      # para logo na primeira linha
node --test --inspect-brk teste.js   # depurar um teste
```

No VS Code, o "JavaScript Debug Terminal" liga o depurador a qualquer `node` que corras nele. Pontos de paragem condicionais ("para só quando `id === 42`"), *logpoints* (um `console.log` sem tocar no código), ver a pilha de chamadas e as variáveis de cada nível, e, num contentor, expor a porta 9229 **só em desenvolvimento** (o depurador dá controlo total sobre o processo).

## 3. Perfis de CPU e flame graphs

Quando a CPU está alta, a pergunta é "em que função?". Um **perfil de CPU** amostra a pilha de chamadas milhares de vezes por segundo:

```bash
node --cpu-prof src/index.js         # escreve um .cpuprofile ao terminar; abre-o no separador Performance do Chrome
```

O resultado vê-se como um ***flame graph***: cada barra é uma função, a largura é o tempo que passou nela (e nas que ela chamou), e as barras de cima são chamadas pelas de baixo. Procura-se a barra larga no topo: é aí que o tempo vai. Ferramentas como o `0x` ou o Clinic.js (`clinic flame`, `clinic doctor`) geram estes gráficos diretamente. A regra de ouro: **medir antes de otimizar**; a intuição sobre "o que é lento" erra muitas vezes.

## 4. Memória e fugas

O JavaScript tem um *garbage collector*: liberta os objetos a que já ninguém se refere. Uma **fuga de memória** é um objeto que já não serve mas que **continua referenciado**, por isso nunca é libertado. A memória cresce devagar, ao longo de horas, até o processo ser morto (o famoso `JavaScript heap out of memory`, ou o OOMKilled do Kubernetes). As causas habituais:

- **caches sem limite**: um `Map` que guarda resultados "para não voltar a calcular" e nunca apaga nada (usa um limite e LRU, como no módulo 14, ou um TTL);
- **listeners que nunca se retiram**: cada pedido subscreve um evento e nunca cancela (o Node avisa com `MaxListenersExceededWarning`, que não se deve silenciar);
- **temporizadores e intervalos** esquecidos, e **closures** que prendem objetos grandes;
- **estruturas indexadas por chaves dinâmicas** (`eventos['tarefa:123']`) que nunca se limpam.

Para investigar: tira um ***heap snapshot*** (no `chrome://inspect`, ou `node --heapsnapshot-signal=SIGUSR2` e `kill -USR2 <pid>`), espera, tira outro, e compara-os: os objetos cujo número não para de subir são a fuga, e o painel "Retainers" mostra **quem** os está a segurar. Para associar dados a objetos sem os prender, há o `WeakMap` (a entrada desaparece quando o objeto-chave deixa de ser usado noutros sítios).

## 5. Streams e backpressure

Ler um ficheiro de 2 GB com `readFile` põe 2 GB em memória. Os **streams** processam os dados aos bocados (*chunks*): lê-se um pedaço, trata-se, escreve-se, e o pedaço é libertado. Dois detalhes importam:

- **os pedaços não são linhas** (nem registos, nem mensagens): uma linha pode chegar partida entre dois pedaços. Para ler linha a linha, usa-se o `readline` sobre o stream, ou guarda-se o resto incompleto de um pedaço para o seguinte;
- ***backpressure***: se a origem for mais rápida do que o destino (ler do disco e enviar para um cliente lento), os dados acumulam-se em memória. O `write()` devolve `false` quando o buffer do destino está cheio, e a origem tem de esperar pelo evento `drain`. O `stream.pipeline` (e o `pipe`) fazem isto sozinhos **e** propagam os erros, fechando todos os streams. Escrever num stream a partir de um `on('data')` sem olhar para o `false` é uma fuga de memória à espera de um cliente lento.

## 6. Trabalho de CPU: worker threads

Quando o trabalho é mesmo de CPU (gerar um PDF, redimensionar imagens, comprimir, calcular), há três saídas:

1. **As versões assíncronas das APIs do Node**: o `crypto.pbkdf2`, o `zlib.gzip` e o `fs` assíncronos correm na *thread pool* do libuv (4 threads por omissão, `UV_THREADPOOL_SIZE`) e não bloqueiam o event loop.
2. **Partir o trabalho** e ceder entre os pedaços (o `setImmediate`, a mesma ideia do módulo 56 no browser).
3. ***Worker threads***: outras threads com o seu próprio event loop, que comunicam com a principal por mensagens. Arrancar um worker custa alguns milissegundos e memória, por isso usa-se uma **piscina** (*pool*) de workers reaproveitados (a biblioteca `piscina` faz isto a sério), com uma fila para quando estão todos ocupados.

E para trabalho que pode esperar, a melhor opção continua a ser tirá-lo do pedido: uma fila e um *worker* separado (módulos 06 e 07).

## 7. Em produção

- **Métricas** do atraso do event loop, da memória (`heapUsed`, RSS) e do *garbage collector*, com alertas sobre a tendência (uma memória que sobe sempre é uma fuga).
- **Limites de memória** no contentor e `--max-old-space-size` coerente com eles.
- **Perfis contínuos** (*continuous profiling*: Pyroscope, Datadog, o Parca), que amostram a CPU em produção com custo baixo, para comparar antes e depois de um deploy.
- E os traces do módulo 47, que dizem **que pedido** é lento; o perfil diz **porquê**.

---

## Prática: escreve tu

As ferramentas para não bloquear e não ter fugas: medir o atraso do event loop e calcular hashes de passwords sem o parar, *streams* que leem linha a linha e respeitam a *backpressure* com um destino lento, um barramento de eventos e uma cache que não crescem para sempre, e uma piscina de *worker threads* com fila e recuperação de erros.

**Ficheiros:** `pratica/49-depuracao-e-profiling/` (`eventLoop.js`, `fluxos.js`, `fugas.js`, `piscina.js`; o código que corre dentro dos workers já está em `trabalhador.js`)

**Verificar:** `npm run verificar 49` (dentro de `pratica/`). Só um exercício: `npm run verificar 49 eventLoop`, `... 49 fluxos`, `... 49 fugas` ou `... 49 piscina`. O P4 usa o `atrasoDoEventLoop` do P1, por isso faz o P1 primeiro.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · O event loop (≈20 min)

**Ficheiro:** `eventLoop.js`

Medir o atraso do event loop durante uma função, e calcular hashes PBKDF2 sem o bloquear (os testes confirmam as duas coisas).

**Sintaxe que vais praticar:** `monitorEventLoopDelay` (`enable`, `disable`, `max`, `percentile`), `try/finally`, `util.promisify`, `Promise.all` com `map(async ...)`.

<details>
<summary>Pista</summary>

O histograma mede em nanossegundos: divide por 1 000 000. Para os hashes, `promisify(pbkdf2)` dá uma função que devolve uma `Promise`, e o `Promise.all` mantém a ordem dos resultados, mesmo que acabem por outra ordem.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P1 · Não bloquear o event loop.
import { pbkdf2 } from 'node:crypto';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { promisify } from 'node:util';

const pbkdf2Async = promisify(pbkdf2);

// atrasoDoEventLoop(fn) → { maxMs, p99Ms }
//   Mede quanto o event loop se atrasou enquanto `await fn()` corria: usa monitorEventLoopDelay
//   com resolution 5 (ms), enable() antes, disable() depois, e lê h.max e h.percentile(99)
//   (em nanossegundos: converte para milissegundos).
export async function atrasoDoEventLoop(fn) {
  const h = monitorEventLoopDelay({ resolution: 5 });
  h.enable();
  try {
    await fn();
  } finally {
    h.disable();
  }
  return { maxMs: h.max / 1e6, p99Ms: h.percentile(99) / 1e6 };
}

// hashSenhas(senhas, { sal, iteracoes }) → Promise com a lista de hashes (hex), pela mesma ordem
//   PBKDF2-SHA256, 32 bytes, com o sal e as iterações dados. Com a versão síncrona (pbkdf2Sync),
//   cada hash bloqueia o event loop dezenas de milissegundos e o servidor deixa de responder a
//   tudo o resto. Usa a versão assíncrona, que corre na thread pool do libuv.
export function hashSenhas(senhas, { sal, iteracoes }) {
  return Promise.all(senhas.map(async (s) => (await pbkdf2Async(s, sal, iteracoes, 32, 'sha256')).toString('hex')));
}
```
</details>

### P2 · Streams (≈30 min)

**Ficheiro:** `fluxos.js`

Somar um CSV linha a linha com linhas partidas entre pedaços, e transformar linhas de uma origem rápida para um destino lento sem acumular nada em memória, propagando os erros.

**Sintaxe que vais praticar:** `for await` sobre o `readline`, um `Transform` com `transform` e `flush`, `stream/promises.pipeline`, guardar o resto incompleto de um pedaço.

<details>
<summary>Pista</summary>

No `Transform`, junta o resto guardado ao pedaço novo, parte em `'\n'`, e guarda o **último** elemento como o novo resto (pode ser uma linha incompleta); as outras estão completas. No `flush`, trata o resto que sobrou. O `pipeline` trata da *backpressure* e dos erros por ti.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P2 · Streams: processar dados grandes aos bocados, com backpressure.
import { createInterface } from 'node:readline';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// somarPorCategoria(entrada) → { [categoria]: soma }
//   entrada: um Readable com texto CSV ('categoria,valor' por linha, com uma linha de cabeçalho
//   que se ignora, e linhas vazias que se ignoram). Os pedaços (chunks) do stream NÃO coincidem
//   com as linhas: uma linha pode vir partida em dois. Lê linha a linha (readline sobre o stream),
//   sem carregar o ficheiro inteiro em memória.
export async function somarPorCategoria(entrada) {
  const somas = {};
  let primeira = true;
  for await (const linha of createInterface({ input: entrada, crlfDelay: Infinity })) {
    if (primeira) {
      primeira = false;
      continue;
    }
    if (!linha.trim()) continue;
    const [categoria, valor] = linha.split(',');
    somas[categoria] = (somas[categoria] ?? 0) + Number(valor);
  }
  return somas;
}

// transformarLinhas(origem, destino, transformar) → Promise que acaba quando tudo foi escrito
//   Lê texto da origem, aplica transformar(linha) a cada linha (as linhas são separadas por '\n';
//   a última pode não ter '\n') e escreve cada resultado seguido de '\n' no destino.
//   Tem de respeitar a backpressure (se o destino for lento, a leitura espera: nada se acumula em
//   memória) e propagar os erros (se transformar lançar, a Promise rejeita e os streams fecham).
//   Dica: stream.promises.pipeline com um Transform que guarda o pedaço de linha incompleto.
export function transformarLinhas(origem, destino, transformar) {
  let resto = '';
  const porLinha = new Transform({
    transform(pedaco, _cod, feito) {
      try {
        const linhas = (resto + pedaco.toString()).split('\n');
        resto = linhas.pop();
        for (const l of linhas) this.push(`${transformar(l)}\n`);
        feito();
      } catch (e) {
        feito(e);
      }
    },
    flush(feito) {
      try {
        if (resto) this.push(`${transformar(resto)}\n`);
        feito();
      } catch (e) {
        feito(e);
      }
    },
  });
  return pipeline(origem, porLinha, destino);
}
```
</details>

### P3 · Sem fugas (≈25 min)

**Ficheiro:** `fugas.js`

Um barramento de eventos em que cancelar retira mesmo o subscritor e limpa as entradas vazias, e uma memoização com um máximo e LRU.

**Sintaxe que vais praticar:** `Map` de `Set`s, uma função "embrulho" para cada subscrição, copiar a lista antes de iterar (`[...conjunto]`), `Object.defineProperty` com um *getter* numa função.

<details>
<summary>Pista</summary>

Se guardares a própria `fn` no `Set`, a mesma função subscrita duas vezes só conta uma. Embrulha-a numa função nova a cada subscrição e guarda o embrulho: o `cancelar` apaga esse embrulho. Na LRU, um `Map` lembra-se da ordem de inserção: ao usar uma entrada, apaga-a e volta a pô-la (fica a mais recente); a mais antiga é `keys().next()`.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P3 · Fugas de memória: o que fica referenciado nunca é libertado.

// criarBarramento() → { subscrever(evento, fn) → cancelar, emitir(evento, dados), subscritores(evento), get eventos }
//   subscrever devolve uma função cancelar() que retira ESSE subscritor (chamá-la duas vezes não faz mal).
//   Quando um evento fica sem subscritores, a sua entrada é apagada (senão, com eventos dinâmicos
//   como 'tarefa:123', o Map cresce para sempre).
//   subscritores(evento) → quantos tem; eventos → quantos eventos têm subscritores.
//   emitir chama os subscritores pela ordem em que subscreveram (um subscritor que cancele durante
//   a emissão não impede os outros de serem chamados).
export function criarBarramento() {
  const mapa = new Map(); // evento → Set(fn)
  return {
    subscrever(evento, fn) {
      if (!mapa.has(evento)) mapa.set(evento, new Set());
      const conjunto = mapa.get(evento);
      const registo = (dados) => fn(dados); // uma entrada própria, mesmo que a mesma fn subscreva duas vezes
      conjunto.add(registo);
      return () => {
        conjunto.delete(registo);
        if (conjunto.size === 0 && mapa.get(evento) === conjunto) mapa.delete(evento);
      };
    },
    emitir(evento, dados) {
      for (const fn of [...(mapa.get(evento) ?? [])]) fn(dados);
    },
    subscritores: (evento) => mapa.get(evento)?.size ?? 0,
    get eventos() {
      return mapa.size;
    },
  };
}

// memoizar(fn, { max }) → uma função que guarda os resultados de fn por argumento (um só
//   argumento, comparado com ===), com NO MÁXIMO `max` resultados: quando enche, sai o usado há
//   mais tempo (LRU). Uma cache sem limite é a fuga de memória mais comum num servidor.
//   A função devolvida tem um getter `tamanho`.
export function memoizar(fn, { max }) {
  const cache = new Map();
  const memo = (arg) => {
    if (cache.has(arg)) {
      const v = cache.get(arg);
      cache.delete(arg);
      cache.set(arg, v);
      return v;
    }
    const v = fn(arg);
    cache.set(arg, v);
    if (cache.size > max) cache.delete(cache.keys().next().value);
    return v;
  };
  Object.defineProperty(memo, 'tamanho', { get: () => cache.size });
  return memo;
}
```
</details>

### P4 · Uma piscina de workers (≈35 min)

**Ficheiro:** `piscina.js`

N *worker threads* reaproveitados, uma fila para quando estão todos ocupados, e um worker novo no lugar de um que morreu com um erro.

**Sintaxe que vais praticar:** `new Worker(url)`, `postMessage` e os eventos `message`/`error`, guardar o trabalho em curso no próprio worker, `new Promise((resolver, rejeitar) => ...)` com as funções guardadas para mais tarde.

<details>
<summary>Pista</summary>

Mantém uma lista de workers livres e uma fila de trabalhos (`{ dados, resolver, rejeitar }`). `executar`: se houver um livre, entrega-lhe; senão, põe na fila. Quando um worker responde (ou morre e é substituído), chama a função `libertar`, que lhe dá o próximo trabalho da fila ou o devolve aos livres.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P4 · Uma piscina (pool) de worker threads para trabalho de CPU, fora do event loop.
import { Worker } from 'node:worker_threads';

// criarPiscina({ tamanho, ficheiro }) → { executar(dados), get ativos, fechar() }
//   Arranca `tamanho` workers com new Worker(ficheiro). executar(dados) → Promise com a resposta:
//   - se houver um worker livre, envia-lhe os dados (postMessage) e espera pela mensagem dele
//   - senão, o trabalho fica numa fila, e o primeiro worker a ficar livre apanha-o
//   - se o worker lançar um erro (evento 'error'), a Promise desse trabalho rejeita, o worker
//     (que morreu) é substituído por um novo, e a piscina continua com `tamanho` workers
//   ativos → quantos trabalhos estão a correr agora
//   fechar() → termina todos os workers (Promise)
export function criarPiscina({ tamanho, ficheiro }) {
  const livres = [];
  const fila = [];
  const todos = new Set();
  let ativos = 0;

  function arrancar() {
    const w = new Worker(ficheiro);
    todos.add(w);
    w.on('message', (resultado) => {
      const { resolver } = w.trabalho;
      w.trabalho = null;
      ativos--;
      resolver(resultado);
      libertar(w);
    });
    w.on('error', (erro) => {
      const t = w.trabalho;
      todos.delete(w);
      if (t) {
        ativos--;
        t.rejeitar(erro);
      }
      libertar(arrancar()); // um worker novo no lugar do que morreu
    });
    return w;
  }
  function libertar(w) {
    const proximo = fila.shift();
    if (proximo) correr(w, proximo);
    else livres.push(w);
  }
  function correr(w, t) {
    ativos++;
    w.trabalho = t;
    w.postMessage(t.dados);
  }
  for (let i = 0; i < tamanho; i++) livres.push(arrancar());

  return {
    executar(dados) {
      return new Promise((resolver, rejeitar) => {
        const t = { dados, resolver, rejeitar };
        const w = livres.shift();
        if (w) correr(w, t);
        else fila.push(t);
      });
    },
    get ativos() {
      return ativos;
    },
    async fechar() {
      await Promise.all([...todos].map((w) => w.terminate()));
    },
  };
}
```
</details>

## Experiências

1. **O hash síncrono, sob carga:** na API do workshop, troca temporariamente o hash das passwords por uma versão síncrona com muitas iterações, e faz um teste de carga com o k6 (módulo 48) ao login e, ao mesmo tempo, a `/api/health`. O que acontece à latência do *health check*?
2. **Um flame graph:** corre a API com `node --cpu-prof`, faz 1000 pedidos, para-a, e abre o `.cpuprofile` no separador *Performance* do Chrome. Onde vai o tempo?
3. **Uma fuga de propósito:** acrescenta à API um `Map` global que guarda cada pedido, faz 100 000 pedidos, e compara dois *heap snapshots* no `chrome://inspect`. Encontras o `Map` nos *Retainers*?
4. **ReDoS:** mede quanto tempo `/^(a+)+$/.test('a'.repeat(28) + 'b')` demora, com 24, 26 e 28 caracteres. Porque é que cresce assim? Como reescreverias a expressão?

## Perguntas de pensamento crítico

1. A API está lenta para todos os pedidos, com a CPU a 100% num núcleo e a base de dados tranquila. Por onde começas?
2. Porque é que uma fuga de memória quase nunca aparece nos testes, e como a detetarias antes de chegar a produção?
3. Quando usarias *worker threads* e quando usarias uma fila e um processo separado?

<details>
<summary>Respostas</summary>

1. É o retrato de um event loop bloqueado: o que corre na thread principal é lento, e todos os pedidos esperam por ele. Começo por confirmar com a métrica do atraso do event loop, depois tiro um perfil de CPU (`--cpu-prof`, ou o Clinic, ou o *profiler* contínuo) durante o problema e procuro a função larga no *flame graph*: uma chamada síncrona (cripto, compressão, `readFileSync`), JSON enorme, um ciclo sobre muitos dados, ou uma expressão regular. Os traces (módulo 47) ajudam a ver se é um tipo de pedido em particular.
2. Porque os testes correm pouco tempo e com poucos pedidos: uma fuga de alguns KB por pedido só se nota depois de horas e de milhões de pedidos. Detetava-a com um teste de resistência (*soak test*, módulo 48: carga moderada durante horas) a vigiar a memória, que deve estabilizar e não subir sempre; com métricas e alertas sobre a tendência da memória em produção; e, quando aparece, com dois *heap snapshots* comparados.
3. *Worker threads* quando o trabalho de CPU tem de dar a resposta **dentro do pedido** e é curto (de milissegundos a poucos segundos): redimensionar uma imagem para devolver, validar um ficheiro, calcular um relatório pequeno. Uma fila e um processo separado (módulos 06 e 07) quando o trabalho pode ser feito **depois** (enviar emails, gerar PDFs grandes, processar importações), quando é longo, quando tem de sobreviver a reinícios e ser repetido se falhar, ou quando se quer escalar o processamento de forma independente da API.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 49`.

**1.** Um pedido executa um ciclo de 200 ms de CPU. O que acontece aos outros pedidos no mesmo processo Node?

- a) Nada: o Node é assíncrono
- b) Esperam até o ciclo acabar: o event loop está bloqueado
- c) Correm noutra thread automaticamente
- d) São rejeitados

<details><summary>Resposta</summary>

**b) Esperam até o ciclo acabar: o event loop está bloqueado** — O teu JavaScript corre numa só thread; o I/O é que é assíncrono.

</details>

**2.** Num flame graph, o que indica uma barra muito larga?

- a) Uma função com muitas linhas
- b) Uma função onde se passou muito tempo (contando as que ela chamou)
- c) Um erro
- d) Uma fuga de memória

<details><summary>Resposta</summary>

**b) Uma função onde se passou muito tempo (contando as que ela chamou)** — Procura-se a barra larga no topo da pilha.

</details>

**3.** Como se chama o mecanismo que faz uma origem rápida esperar quando o destino de um stream está cheio (em inglês)?

<details><summary>Resposta</summary>

**backpressure** — O pipeline trata disso e propaga os erros.

</details>

**4.** Qual destas é a causa mais comum de uma fuga de memória num servidor Node?

- a) Usar const em vez de let
- b) Uma cache (Map) sem limite, ou listeners que nunca se retiram
- c) Usar async/await
- d) Usar streams

<details><summary>Resposta</summary>

**b) Uma cache (Map) sem limite, ou listeners que nunca se retiram** — Objetos que continuam referenciados nunca são libertados.

</details>

**5.** Que alternativa NÃO bloqueia o event loop para calcular um hash PBKDF2?

- a) crypto.pbkdf2Sync
- b) crypto.pbkdf2 (assíncrona, corre na thread pool do libuv)
- c) Um ciclo for
- d) JSON.stringify

<details><summary>Resposta</summary>

**b) crypto.pbkdf2 (assíncrona, corre na thread pool do libuv)** — Para trabalho de CPU próprio, worker threads.

</details>

<!-- quiz:end -->
