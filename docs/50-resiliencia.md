# 50 · Resiliência em sistemas distribuídos

**Objetivo:** saber construir serviços que continuam a funcionar quando as suas dependências falham ou ficam lentas: timeouts e prazos, tentativas sem piorar o problema, disjuntores (*circuit breakers*), anteparas (*bulkheads*), descarte de carga, pedidos com cobertura e alternativas. E perceber porque é que um serviço **lento** é mais perigoso do que um serviço **em baixo**.

**Ficheiros para ler:** `src/api/src/messaging/publisher.js` (a reconexão ao RabbitMQ do módulo 06) e `src/api/src/messaging/compositePublisher.js` (o Kafka como "melhor esforço", módulo 17).

**Pré-requisitos:** módulos 05 (tentativas e *single flight*), 06, 14 (P4: `retry` com backoff) e 48 (latência e percentis).

---

## 1. As falácias da computação distribuída

Há uma lista famosa (de Peter Deutsch e outros, na Sun, nos anos 90) de coisas que quem começa a fazer sistemas distribuídos assume, e que são falsas: a rede é fiável; a latência é zero; a largura de banda é infinita; a rede é segura; a topologia não muda; há um administrador; o transporte não custa nada; a rede é homogénea.

Num monólito, uma chamada a uma função nunca "demora 30 segundos" nem "às vezes não volta". Numa chamada de rede, ambas acontecem, todos os dias. Cada chamada entre serviços tem três resultados possíveis, e não dois: **sucesso**, **falha**, e **não sei** (o pedido saiu e não veio resposta: foi processado ou não?). Resiliência é decidir, para cada chamada, o que fazer em cada um.

## 2. Lento é pior do que em baixo

Um serviço em baixo responde logo com um erro de ligação: quem chama falha depressa e segue em frente. Um serviço **lento** (uma base de dados sobrecarregada, um *garbage collector* em pausa) segura cada pedido durante segundos. Quem chama acumula pedidos à espera: ligações abertas, memória, *threads*, entradas no *pool* da base de dados. Pela lei de Little (módulo 48), se a latência passa de 50 ms para 5 s com o mesmo tráfego, há 100 vezes mais pedidos em curso. Os recursos esgotam-se, e o serviço que chama também fica lento, e o que chama esse... É a **falha em cascata**: um serviço secundário lento derruba o sistema inteiro.

Todos os padrões deste módulo servem, de uma forma ou de outra, para **cortar a cascata**: falhar depressa, limitar o que cada dependência pode consumir, e ter um plano B.

## 3. Timeouts e prazos

A regra número um: **todas as chamadas de rede têm um timeout**. Os valores por omissão são muitas vezes "nunca" ou minutos (o `fetch` do Node não tem timeout por omissão). Sem timeout, um servidor que não responde pendura o teu pedido para sempre.

```js
const r = await fetch(url, { signal: AbortSignal.timeout(2000) });   // desiste ao fim de 2 s
```

O `AbortSignal` não só faz o teu código deixar de esperar: **cancela** o trabalho (o pedido HTTP é fechado). Desistir de esperar sem cancelar o trabalho deixa-o a consumir recursos até acabar.

Como escolher o valor: um pouco acima do p99 normal da dependência (módulo 48). Um timeout demasiado curto falha pedidos que iam correr bem; um demasiado longo não protege nada.

Numa cadeia de chamadas, os timeouts têm de ser **coerentes**. Se o frontend espera 3 s pela API, e a API dá 5 s ao serviço de stock, a API continua a esperar 2 s por uma resposta que já ninguém quer. A solução é propagar um **prazo** (*deadline*) absoluto: "este pedido acaba às 10:00:03". Cada serviço passa às suas sub-chamadas o tempo que **sobra**, e desiste logo se já não sobrar nada. O gRPC (módulo 46) faz isto por omissão; em HTTP, passa-se num cabeçalho.

## 4. Tentativas, sem piorar as coisas

Repetir uma chamada que falhou (módulo 14, P4) resolve as falhas **transitórias**: um pacote perdido, um servidor que estava a reiniciar. Mas tem regras, porque tentativas mal feitas transformam um problema pequeno num grande:

- **Só se repete o que é seguro repetir:** operações idempotentes (leituras, `PUT`, ou escritas com uma chave de idempotência). Repetir um "cobrar 50 €" sem chave pode cobrar duas vezes (o caso do "não sei" da secção 1).
- **Só se repetem erros transitórios:** timeouts, `503`, `429`, ligações recusadas. Um `400` ou um `404` vão dar o mesmo resultado.
- **Backoff exponencial com jitter** (módulos 24 e 45): esperar cada vez mais, com um valor aleatório, para não sincronizar milhares de clientes.
- **Respeitar o `Retry-After`** quando o servidor o envia.
- **Tentativas num só nível.** Se o frontend tenta 3 vezes, a API tenta 3 vezes o serviço de stock, e o stock tenta 3 vezes a base de dados, um pedido do utilizador pode virar 27 pedidos à base de dados, exatamente quando ela está com problemas. Tenta num nível (normalmente o mais perto da falha), ou usa um **orçamento de tentativas** (no máximo 10% de pedidos extra, por exemplo).

## 5. O disjuntor (circuit breaker)

Se uma dependência está em baixo, continuar a chamá-la (com timeouts e tentativas) só gasta recursos e atrasa todos os pedidos. O **disjuntor**, como o do quadro elétrico, corta a corrente quando há um problema:

```
         N falhas seguidas                   passou o tempo de espera
 FECHADO ──────────────────▶ ABERTO ──────────────────────────────▶ MEIO-ABERTO
 (normal)                    (falha logo,                           (deixa passar UMA
    ▲                         sem chamar)                            tentativa)
    │                             ▲                                       │
    └──────── a tentativa correu bem ─┼──────── a tentativa falhou ─────────┘
```

Enquanto está **aberto**, as chamadas falham **imediatamente**, sem tocar na dependência: quem chama não fica à espera, e a dependência tem tempo para recuperar sem ser martelada. De tempos a tempos, o disjuntor deixa passar uma tentativa para ver se ela já voltou.

Os disjuntores combinam-se com alternativas (§8): "se o circuito do serviço de recomendações estiver aberto, mostra os produtos mais vendidos". E as mudanças de estado são um sinal de alerta a sério: vale a pena registá-las e ter uma métrica (módulo 19). Bibliotecas que o fazem: `opossum` (Node), Resilience4j (Java), Polly (.NET).

## 6. Anteparas e descarte de carga

Um navio tem **anteparas**: paredes que dividem o casco em compartimentos estanques, para um rombo inundar só um. No software, a **antepara** (*bulkhead*) limita quantos recursos cada dependência pode ocupar:

- no máximo 10 pedidos ao serviço de PDFs ao mesmo tempo, com uma fila pequena;
- um *pool* de ligações à base de dados separado para os relatórios pesados e para a API;
- réplicas separadas para os clientes grandes, para um cliente abusivo não afetar os outros.

Assim, se o serviço de PDFs ficar lento, ocupa no máximo as suas 10 vagas, e o resto da API continua a funcionar.

O **descarte de carga** (*load shedding*) é a mesma ideia à entrada: quando o sistema está saturado, recusa **logo** os pedidos a mais (com um `503` e um `Retry-After`), em vez de os aceitar todos e servir todos mal. Servir bem 80% dos pedidos é melhor do que servir 100% com timeouts. Pode ser seletivo: descartar primeiro o tráfego menos importante (pré-carregamentos, *bots*, relatórios) e proteger o essencial (o checkout).

## 7. Pedidos com cobertura (hedging)

Contra a **latência da cauda** (o p99 do módulo 48): se uma leitura ainda não respondeu ao fim do tempo do p95, envia uma segunda cópia do mesmo pedido, possivelmente para outra réplica, e fica com a resposta que chegar primeiro, cancelando a outra. Custa poucos pedidos extra (só os ~5% mais lentos são duplicados) e corta muito a cauda: é uma técnica descrita pela Google no artigo *The Tail at Scale*. **Só** para operações idempotentes.

## 8. Alternativas e degradação graciosa

Quando uma dependência falha, há quase sempre uma resposta melhor do que um erro:

| Falha | Alternativa |
|---|---|
| o serviço de preços está em baixo | o último preço conhecido, da cache (com um aviso, se for importante) |
| as recomendações não respondem | os mais vendidos, ou nada (a página funciona sem elas) |
| o envio de emails falha | pôr na fila e tentar depois (módulo 06) |
| a pesquisa avançada está lenta | uma pesquisa simples na base de dados |

A pergunta de desenho é, para cada dependência: **esta funcionalidade é essencial para este pedido?** Se não for, o pedido não pode falhar por causa dela. Neste projeto, o Kafka já é tratado assim (módulo 17): se estiver em baixo, a criação de tarefas continua a funcionar e os eventos vão só para o RabbitMQ.

## 9. Testar a resiliência

Os padrões de resiliência só se provam quando as falhas acontecem, por isso provocam-se:

- nos testes, com dependências falsas que falham, demoram, ou respondem com lixo (como os desta prática);
- em ambientes de testes, com ferramentas que injetam latência e erros na rede (Toxiproxy, ou as falhas de um *service mesh*);
- em produção, com cuidado, com **engenharia do caos**: desligar deliberadamente instâncias ou zonas para provar que o sistema aguenta (o Chaos Monkey da Netflix tornou a ideia famosa). Fizeste uma versão pequena disto no módulo 06, ao parar o RabbitMQ.

Um **service mesh** (Istio, Linkerd) aplica timeouts, tentativas e disjuntores na rede, à volta de cada serviço, sem mudar o código. É prático em sistemas grandes, mas a lógica de negócio (que alternativa usar, o que é essencial) continua a ser do código.

---

## Prática: escreve tu

Os padrões do módulo, escritos de raiz para veres como funcionam por dentro: prazos com cancelamento, um disjuntor com os três estados, uma antepara com fila e descarte, e pedidos com cobertura e alternativa. Os testes usam relógios falsos e tarefas que só acabam quando o teste manda, para controlar o tempo e a concorrência sem esperas longas.

**Ficheiros:** `pratica/50-resiliencia/` (`prazos.js`, `disjuntor.js`, `antepara.js`, `cobertura.js`)

**Verificar:** `npm run verificar 50` (dentro de `pratica/`). Só um exercício: `npm run verificar 50 prazos`, `... 50 disjuntor`, `... 50 antepara` ou `... 50 cobertura`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Timeouts e prazos (≈25 min)

**Ficheiro:** `prazos.js`

Um `comPrazo` que desiste **e** cancela o trabalho (com um `AbortSignal`), sem deixar temporizadores pendurados, e um prazo absoluto que se passa de chamada em chamada, em que um filho nunca vive mais do que o pai.

**Sintaxe que vais praticar:** `AbortController`, `Promise.race`, `setTimeout`/`clearTimeout` num `finally`, um relógio injetado, `Math.min`/`Math.max`.

<details>
<summary>Pista</summary>

Uma `Promise` que rejeita quando o tempo acaba, em corrida (`Promise.race`) com a do trabalho. O temporizador é que aborta o controlador. No `finally`, limpa o temporizador: se o trabalho acabar primeiro, não queres que ele dispare mais tarde.
</details>

<details>
<summary>Solução de referência</summary>

```js
export class ErroPrazo extends Error {}

export async function comPrazo(fn, ms) {
  const controlo = new AbortController();
  let relogio;
  const prazo = new Promise((_, reject) => {
    relogio = setTimeout(() => {
      controlo.abort(); // avisa o trabalho para parar (um fetch com este sinal é cancelado)
      reject(new ErroPrazo(`não terminou em ${ms} ms`));
    }, ms);
  });
  try {
    return await Promise.race([fn(controlo.signal), prazo]);
  } finally {
    clearTimeout(relogio);
  }
}

export function criarPrazo(ms, agora = Date.now) {
  const fim = agora() + ms;
  const prazo = {
    restante: () => Math.max(0, fim - agora()),
    expirou: () => agora() >= fim,
    // Um prazo para uma sub-chamada: o menor entre o que lhe damos e o que nos falta.
    filho: (maxMs) => criarPrazo(Math.min(maxMs, prazo.restante()), agora),
  };
  return prazo;
}
```
</details>

### P2 · Um disjuntor (≈35 min)

**Ficheiro:** `disjuntor.js`

Os três estados e as transições do diagrama da secção 5, com um relógio injetado, um aviso a cada mudança, e a regra mais fácil de esquecer: em meio-aberto, só passa **uma** chamada de cada vez.

**Sintaxe que vais praticar:** campos e métodos privados, um *getter* com efeitos (o tempo passa), `try/catch/finally` com `await`, *listeners*.

<details>
<summary>Pista</summary>

Guarda o instante em que o circuito abriu. O *getter* `estado` compara-o com o relógio e, se o tempo de espera já passou, muda para meio-aberto. No `executar`, lê o estado **uma** vez no início e usa esse valor no `catch` e no `finally`, para saberes se esta chamada era a tentativa de teste.
</details>

<details>
<summary>Solução de referência</summary>

```js
export class ErroCircuitoAberto extends Error {}

export class Disjuntor {
  #estado = 'fechado';
  #falhas = 0;
  #abertoEm = 0;
  #tentativaEmCurso = false;
  #ouvintes = [];

  constructor({ limiarFalhas = 5, esperaMs = 10000, agora = Date.now } = {}) {
    Object.assign(this, { limiarFalhas, esperaMs, agora });
  }

  get estado() {
    // Passado o tempo de espera, o circuito está pronto para uma tentativa.
    if (this.#estado === 'aberto' && this.agora() - this.#abertoEm >= this.esperaMs) this.#mudar('meio-aberto');
    return this.#estado;
  }

  aoMudar(fn) {
    this.#ouvintes.push(fn);
  }

  #mudar(para) {
    const de = this.#estado;
    if (de === para) return;
    this.#estado = para;
    for (const fn of this.#ouvintes) fn(de, para);
  }

  #abrir() {
    this.#abertoEm = this.agora();
    this.#mudar('aberto');
  }

  async executar(fn) {
    const estado = this.estado;
    if (estado === 'aberto') throw new ErroCircuitoAberto('circuito aberto: o serviço está a falhar');
    if (estado === 'meio-aberto') {
      if (this.#tentativaEmCurso) throw new ErroCircuitoAberto('circuito meio-aberto: já há uma tentativa em curso');
      this.#tentativaEmCurso = true;
    }
    try {
      const resultado = await fn();
      this.#falhas = 0;
      this.#mudar('fechado');
      return resultado;
    } catch (e) {
      if (estado === 'meio-aberto') this.#abrir(); // a tentativa falhou: volta a abrir
      else if (++this.#falhas >= this.limiarFalhas) this.#abrir();
      throw e;
    } finally {
      if (estado === 'meio-aberto') this.#tentativaEmCurso = false;
    }
  }
}
```
</details>

### P3 · Uma antepara (≈25 min)

**Ficheiro:** `antepara.js`

No máximo N chamadas ao mesmo tempo, uma fila por ordem de chegada, e recusa imediata quando a fila está cheia. Um erro também tem de libertar a vaga.

**Sintaxe que vais praticar:** uma fila de funções `resolve` (`await new Promise((comecar) => fila.push(comecar))`), `shift`, `finally`, *getters*.

<details>
<summary>Pista</summary>

O truque da fila: para esperar por uma vaga, cria uma `Promise` e guarda a função `resolve` dela na fila. Quando uma chamada termina, tira a primeira função da fila e chama-a: a `Promise` resolve-se, e quem estava à espera continua.
</details>

<details>
<summary>Solução de referência</summary>

```js
export class ErroSobrecarga extends Error {}

export function criarAntepara({ maxConcorrentes, maxFila }) {
  let ativos = 0;
  const fila = []; // as funções "começa agora", por ordem de chegada

  const proximo = () => {
    ativos--;
    const seguinte = fila.shift();
    if (seguinte) seguinte();
  };

  return {
    get ativos() {
      return ativos;
    },
    get emFila() {
      return fila.length;
    },
    async executar(fn) {
      if (ativos >= maxConcorrentes) {
        if (fila.length >= maxFila) throw new ErroSobrecarga('demasiados pedidos: tenta mais tarde');
        await new Promise((comecar) => fila.push(comecar)); // espera pela vaga
      }
      ativos++;
      try {
        return await fn();
      } finally {
        proximo(); // com sucesso ou erro, a vaga passa ao primeiro da fila
      }
    },
  };
}
```
</details>

### P4 · Cobertura e alternativa (≈30 min)

**Ficheiro:** `cobertura.js`

Pedidos com cobertura (uma segunda cópia se a primeira demorar, a primeira resposta ganha, as outras são canceladas) e uma alternativa com a cache, para quando a fonte principal falha.

**Sintaxe que vais praticar:** um `new Promise` controlado à mão (`resolve`/`reject` chamados uma só vez), um `AbortController` por cópia, `setTimeout` para lançar a cópia seguinte.

<details>
<summary>Pista</summary>

Usa uma variável `acabou` para garantir que só a primeira resposta (ou a última falha) conta. Cada cópia agenda o lançamento da seguinte para daqui a `atrasoMs`; se a cópia falhar antes disso, lança a seguinte logo, sem esperar.
</details>

<details>
<summary>Solução de referência</summary>

```js
export async function comCobertura(fn, { atrasoMs, maxCopias = 2 }) {
  return new Promise((resolve, reject) => {
    const controlos = [];
    let falhadas = 0;
    let acabou = false;
    let relogio;

    const lancar = () => {
      if (acabou || controlos.length >= maxCopias) return;
      clearTimeout(relogio);
      const controlo = new AbortController();
      controlos.push(controlo);
      fn(controlo.signal).then(
        (valor) => {
          if (acabou) return;
          acabou = true;
          clearTimeout(relogio);
          for (const c of controlos) if (c !== controlo) c.abort(); // as outras já não são precisas
          resolve(valor);
        },
        (erro) => {
          if (acabou) return;
          if (++falhadas === maxCopias) {
            acabou = true;
            clearTimeout(relogio);
            return reject(erro);
          }
          lancar(); // esta falhou: a próxima começa já, sem esperar o atraso
        },
      );
      relogio = setTimeout(lancar, atrasoMs); // se esta demorar, começa outra
    };
    lancar();
  });
}

export async function comAlternativa(principal, { cache, chave }) {
  try {
    const valor = await principal();
    cache.set(chave, valor);
    return { valor, fonte: 'principal' };
  } catch (e) {
    if (cache.has(chave)) return { valor: cache.get(chave), fonte: 'cache' };
    throw e;
  }
}
```
</details>

## Experiências

1. **A cascata, ao vivo:** com a stack do workshop a correr, introduz um atraso de 5 s num endpoint da API (um `await new Promise((r) => setTimeout(r, 5000))` antes de responder) e faz um teste de carga com o k6 (módulo 48) a outro endpoint. O endpoint "rápido" também fica lento? Porquê (pensa no event loop, nas ligações do Nginx e no *pool* da base de dados)?
2. **Um disjuntor à volta do Redis:** na API, embrulha as chamadas à cache (módulo 05) no teu `Disjuntor`. Para o Redis (`docker compose ... stop redis`) e mede o tempo de resposta das listagens antes e depois de o circuito abrir.
3. **Tentativas que multiplicam:** num ficheiro `.mjs`, encadeia três funções, cada uma a chamar a seguinte com o `retry` do módulo 14 (3 tentativas), e a última sempre a falhar. Quantas vezes é chamada a última?
4. **Toxiproxy:** corre o [Toxiproxy](https://github.com/Shopify/toxiproxy) em Docker entre a API e o Postgres, e acrescenta 2 s de latência à ligação. O que acontece aos pedidos? E ao *pool* de ligações?

## Perguntas de pensamento crítico

1. O serviço de recomendações (que mostra "também te pode interessar") fica lento e o site inteiro deixa de responder. Que padrões teriam evitado isto, e como os aplicarias?
2. Porque é que uma tentativa automática num pedido "criar encomenda" é perigosa, e como a tornarias segura?
3. Um colega põe timeouts de 60 segundos "para dar tempo". Que problema isso cria?

<details>
<summary>Respostas</summary>

1. Um timeout curto nas chamadas às recomendações (perto do seu p99 normal), para nunca segurar a página; uma antepara que limite os pedidos simultâneos a esse serviço, para a lentidão dele não ocupar todos os recursos da API; um disjuntor que, com o serviço a falhar, deixe de o chamar e responda logo; e uma alternativa (uma lista dos mais vendidos, ou nenhuma secção de recomendações), porque é uma funcionalidade não essencial: a página nunca deveria falhar por causa dela.
2. Porque o resultado "não sei" existe: o pedido pode ter criado a encomenda e a resposta ter-se perdido no caminho. Repeti-lo cria uma encomenda duplicada (e cobra duas vezes). Torna-se segura com uma **chave de idempotência**: o cliente gera um id único para a operação e envia-o em todas as tentativas; o servidor guarda as chaves já processadas e, a uma repetida, devolve o resultado da primeira em vez de criar outra (o módulo de pagamentos trata disto em detalhe).
3. Que, quando a dependência ficar lenta, cada pedido fica preso até 60 s: os pedidos em curso acumulam-se (lei de Little), esgotam as ligações, a memória e o *pool* da base de dados, e o serviço de quem chama também fica lento, numa cascata. E o utilizador já desistiu muito antes dos 60 s, por isso o trabalho é desperdiçado. Os timeouts escolhem-se pelo comportamento normal da dependência (um pouco acima do p99), e o tempo total por pedido controla-se com um prazo que se propaga.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 50`.

**1.** Porque é que um serviço lento costuma ser mais perigoso do que um serviço em baixo?

- a) Porque gasta mais CPU
- b) Porque segura os pedidos de quem chama: os recursos (ligações, memória, pool) esgotam-se e a lentidão alastra em cascata
- c) Porque devolve dados errados
- d) Não é: é igual

<details><summary>Resposta</summary>

**b) Porque segura os pedidos de quem chama: os recursos (ligações, memória, pool) esgotam-se e a lentidão alastra em cascata** — Um serviço em baixo falha depressa; um lento faz acumular pedidos em curso (lei de Little).

</details>

**2.** O que faz um disjuntor (circuit breaker) no estado aberto?

- a) Chama o serviço com mais tentativas
- b) Falha imediatamente, sem chamar o serviço, até passar o tempo de espera
- c) Guarda os pedidos numa fila
- d) Reinicia o serviço

<details><summary>Resposta</summary>

**b) Falha imediatamente, sem chamar o serviço, até passar o tempo de espera** — Quem chama não fica à espera e o serviço tem tempo para recuperar; depois, uma tentativa em meio-aberto decide se fecha.

</details>

**3.** Que padrão limita quantos recursos uma dependência pode ocupar, para a sua lentidão não afundar o resto (nome em inglês)?

<details><summary>Resposta</summary>

**bulkhead** — Como os compartimentos estanques de um navio: no máximo N pedidos simultâneos e uma fila pequena por dependência.

</details>

**4.** Três serviços em cadeia repetem cada falha 3 vezes. Um pedido do utilizador pode gerar quantas chamadas à última dependência?

- a) 3
- b) 9
- c) 27
- d) 81

<details><summary>Resposta</summary>

**c) 27** — 3 × 3 × 3. Por isso se tenta num só nível, ou com um orçamento de tentativas.

</details>

**5.** Quando é seguro usar pedidos com cobertura (hedging)?

- a) Sempre
- b) Só em operações idempotentes, como leituras
- c) Só em pagamentos
- d) Nunca

<details><summary>Resposta</summary>

**b) Só em operações idempotentes, como leituras** — Duas cópias de um pedido que cria ou cobra algo podem executar as duas.

</details>

<!-- quiz:end -->
