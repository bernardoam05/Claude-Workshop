# 37 · System design

**Objetivo:** saber desenhar um sistema que aguenta crescer, e saber defender as escolhas numa entrevista: estimativas de capacidade, escalar a aplicação e os dados, caches, filas, consistência, e os padrões que aparecem sempre (encurtador de URLs, feeds, limitação de pedidos).

**Ficheiros para ler:** o diagrama da arquitetura no [índice](00-indice.md#arquitetura) e o módulo 13 (decisões e trade-offs). Este módulo junta peças que já viste: cache (05), filas (06), Kafka (17), Kubernetes (30).

**Pré-requisitos:** módulos 03, 05, 06, 13 e 17.

---

## 1. O que é uma entrevista de system design

Dão-te um enunciado vago ("desenha o Twitter", "desenha um encurtador de URLs") e 45 minutos. Não há uma resposta certa. O que avaliam é o **processo**: se fazes as perguntas certas, se dimensionas com números, se conheces as peças e os seus custos, e se explicas os trade-offs em vez de recitar tecnologias.

Um guião que funciona:

1. **Requisitos (5 min).** Funcionais: o que faz? ("encurtar, redirecionar, contar cliques"). Não funcionais: quantos utilizadores, que latência, que disponibilidade, consistência forte ou eventual? O que fica **de fora**?
2. **Estimativas (5 min).** Pedidos por segundo, rácio leitura/escrita, armazenamento ao fim de 5 anos, largura de banda (§2).
3. **API (5 min).** Os endpoints principais: `POST /urls`, `GET /{codigo}`.
4. **Modelo de dados (5 min).** As tabelas ou documentos, e as consultas que precisam de ser rápidas.
5. **Desenho de alto nível (10 min).** As caixas e as setas: clientes, balanceador, serviços, BD, cache, filas.
6. **Aprofundar (10 min).** O que parte primeiro quando o tráfego multiplica por 10? Escolhe dois ou três pontos e vai ao detalhe.
7. **Trade-offs e falhas (5 min).** O que acontece se a cache cair? E se uma região inteira cair?

## 2. Contas nas costas de um envelope

Os números não precisam de ser exatos. Precisam de dizer **de que ordem de grandeza** é o problema, porque é isso que decide a arquitetura.

```
Encurtador: 100 M de URLs novos por mês, leitura:escrita = 100:1

Escritas: 100 M / (30 × 86 400 s) ≈ 40 por segundo (pico, ×3: 120/s)
Leituras: 40 × 100 = 4 000 por segundo (pico: 12 000/s)
Armazenamento: 100 M × 12 meses × 5 anos × 500 bytes = 3 TB
```

Conclusões que saem destes números: as escritas são poucas, e uma só BD Postgres aguenta-as com folga; as leituras são o problema, e pedem uma **cache** (§5); 3 TB cabem num servidor grande, mas já justificam pensar em particionar.

| Ordem de grandeza útil | Valor |
|---|---|
| segundos num dia | 86 400 (≈ 10⁵) |
| 1 milhão de pedidos por dia | ≈ 12 por segundo |
| uma instância Postgres bem configurada | milhares a dezenas de milhares de consultas simples por segundo |
| um Redis | ≈ 100 000 operações por segundo |
| latências (rede, disco, memória) | módulo 25, §8 |

## 3. Escalar a aplicação

**Vertical** (*scale up*): uma máquina maior. Simples, sem mudar código, mas tem um teto e um preço que cresce depressa, e continua a ser um ponto único de falha.

**Horizontal** (*scale out*): mais máquinas iguais atrás de um **balanceador de carga**. Não tem teto prático, e uma máquina que cai não leva o serviço com ela. A condição é a aplicação ser **sem estado** (*stateless*): nada de sessões ou ficheiros guardados na memória ou no disco de uma réplica. Tudo o que tem de sobreviver vai para a BD, para a cache ou para um armazenamento de objetos (S3). A API deste projeto já é assim: é por isso que o `replicas: 2` do módulo 32 funciona sem mudar uma linha.

O balanceador pode distribuir por **round-robin**, por **menos ligações**, ou por **hash** do cliente (para o mesmo cliente ir sempre à mesma réplica, quando isso ajuda uma cache local). E retira do conjunto as réplicas que falham o *health check*, como a readiness do Kubernetes.

## 4. Escalar os dados

A aplicação escala horizontalmente com facilidade. A base de dados é onde está o problema, porque tem estado.

**Réplicas de leitura.** O primário recebe as escritas e envia-as às réplicas; as leituras são espalhadas pelas réplicas. Funciona muito bem quando há muitas mais leituras do que escritas. O preço é o **atraso de replicação** (*replication lag*): um utilizador que acabou de escrever pode ler de uma réplica que ainda não recebeu a escrita, e não ver o que acabou de fazer. A solução habitual: ler do primário durante uns segundos depois de cada escrita do próprio utilizador (*read-your-writes*).

**Particionamento** (*sharding*). Os dados são divididos por várias bases de dados, cada uma com uma parte, por uma **chave de partição** (o id do utilizador, por exemplo). Cada BD fica mais pequena e mais rápida, e as escritas também escalam. O preço:

- consultas que atravessam partições ("os 10 utilizadores com mais tarefas") ficam caras;
- *joins* e transações entre partições ficam difíceis ou impossíveis;
- escolher mal a chave cria **partições quentes** (uma celebridade com milhões de seguidores numa só partição);
- mudar o número de partições move dados. Com `hash(chave) % N`, passar de 4 para 5 partições muda quase todas as chaves de sítio. Com **hashing consistente** (o P3), só cerca de 1/5 muda. É o que o Cassandra, o DynamoDB e muitas caches distribuídas usam.

O Kafka (módulo 17) é a mesma ideia: as partições de um tópico, com a chave a decidir em qual cai cada mensagem.

## 5. Caches, em todas as camadas

| Camada | Exemplo | Guarda |
|---|---|---|
| Browser | `Cache-Control` | ficheiros estáticos, respostas de API que podem ficar velhas |
| CDN | Cloudflare, CloudFront | estáticos (e páginas inteiras) perto dos utilizadores |
| Aplicação | Redis (módulo 05) | resultados de consultas, sessões, contadores |
| Base de dados | a cache de páginas do Postgres | os blocos mais usados, em memória |

No encurtador, os URLs mais populares são uma fração pequena de todos, mas recebem a maior parte dos cliques (é quase sempre assim: a **regra 80/20**). Uma cache com os mais pedidos absorve a maior parte das leituras.

Os problemas difíceis das caches já os viste no módulo 05: **invalidação** (quando os dados mudam), e a **debandada** (*thundering herd*: uma chave popular expira e mil pedidos vão à BD ao mesmo tempo; a solução é o *single flight*, P3 do módulo 05).

## 6. Assíncrono: filas e eventos

Nem tudo tem de acontecer durante o pedido. Enviar um email, gerar um PDF, processar um vídeo, atualizar estatísticas: o pedido grava a intenção, publica uma mensagem numa **fila** e responde logo; um **worker** faz o trabalho depois. É o que este projeto faz com o RabbitMQ e o worker (módulos 06 e 07).

O que se ganha: respostas rápidas, picos absorvidos pela fila (os workers processam ao seu ritmo), e falhas isoladas (se o serviço de email cair, os pedidos continuam a funcionar e as mensagens esperam). O que se paga: **consistência eventual** (o resultado aparece depois), mensagens duplicadas (**idempotência**, módulo 06), e mais peças para operar e monitorizar.

## 7. Consistência, disponibilidade e o teorema CAP

Num sistema distribuído, a rede **vai** falhar entre nós (uma **partição** de rede). Quando acontece, cada nó tem de escolher:

- **Consistência:** recusar responder até ter a certeza de que tem os dados mais recentes. (Um banco: mais vale dar erro do que mostrar um saldo errado.)
- **Disponibilidade:** responder com o que tem, mesmo que esteja desatualizado. (Um feed de notícias: mais vale mostrar o feed de há 5 segundos do que nada.)

É o **teorema CAP**: com partições de rede (P), escolhe-se entre consistência (C) e disponibilidade (A). O **PACELC** acrescenta o caso normal: mesmo **sem** partições (E, *else*), há um trade-off entre latência (L) e consistência (C): esperar pelas réplicas torna cada escrita mais lenta.

A maioria das decisões reais não é "consistência total ou nenhuma", mas **que** dados precisam de quê: o saldo e o stock precisam de consistência forte; o número de "gostos", as recomendações e as estatísticas vivem bem com consistência eventual.

## 8. Limitação de pedidos

Protege o sistema de abusos e de clientes com bugs, e garante uma partilha justa. Os algoritmos:

| Algoritmo | Como | Defeito |
|---|---|---|
| **Janela fixa** (módulo 05) | um contador por minuto | deixa passar o dobro na fronteira entre dois minutos |
| **Registo deslizante** | guarda o instante de cada pedido | exato, mas guarda um registo por pedido |
| **Janela deslizante aproximada** (P4) | contadores do minuto atual e do anterior, ponderados | aproximado, mas barato e sem o defeito da fronteira |
| **Token bucket** | um balde que enche a ritmo constante; cada pedido gasta uma ficha | permite rajadas controladas; é o do Nginx (módulo 10) e de muitas APIs públicas |

Com várias réplicas da API, o contador tem de estar num sítio partilhado (o Redis), e as operações têm de ser atómicas (`INCR`), senão duas réplicas leem 99, ambas escrevem 100, e passam 101 pedidos.

## 9. Três desenhos clássicos

**Encurtador de URLs.** Escritas raras, leituras muitas. O código curto vem de um **contador** codificado em base 62 (7 caracteres chegam para 3,5 biliões de URLs) ou de um hash do URL (com colisões para tratar). O redirecionamento é um `301` (permanente: o browser memoriza-o e já não volta a pedir, o que poupa servidores mas impede contar cliques) ou um `302` (temporário: todos os cliques passam pelo serviço). Cache para os códigos populares, e a contagem de cliques numa fila, para não atrasar o redirecionamento.

**Feed de notícias** (Twitter, Instagram). Duas estratégias:
- **Fan-out na escrita:** quando alguém publica, a publicação é copiada para o feed de cada seguidor. Ler o feed é instantâneo; publicar custa tanto quanto o número de seguidores. Ótimo para a maioria dos utilizadores; péssimo para uma celebridade com 100 milhões de seguidores.
- **Fan-out na leitura:** ao abrir o feed, juntam-se as publicações de quem se segue. Publicar é barato; ler é caro.
- Os sistemas reais fazem os dois: na escrita para os utilizadores normais, na leitura para as celebridades.

**Notificações** (email, push, SMS). Um serviço recebe pedidos de notificação, põe-nos numa fila por canal, e workers enviam-nos, com tentativas e uma fila de mensagens mortas (DLQ) para os que falham sempre. Preferências do utilizador, limites por utilizador (não enviar 50 pushes numa hora), e idempotência (não enviar o mesmo email duas vezes depois de uma nova tentativa). É, em ponto grande, o `src/notifications` do módulo 21.

---

## Prática: escreve tu

Quatro peças que aparecem nos quadros brancos das entrevistas, mas escritas a sério, com testes: as contas de capacidade, o núcleo de um encurtador de URLs, um anel de hashing consistente (com um teste que mede quantas chaves se movem quando entra um servidor), e um limitador de pedidos com janela deslizante sobre um armazenamento partilhado.

**Ficheiros:** `pratica/37-system-design/` (`estimativas.js`, `encurtador.js`, `hashConsistente.js`, `janelaDeslizante.js`)

**Verificar:** `npm run verificar 37` (dentro de `pratica/`). Só um exercício: `npm run verificar 37 estimativas`, `... 37 encurtador`, `... 37 hash` ou `... 37 janela`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Estimativas (≈15 min)

**Ficheiro:** `estimativas.js`

As contas da secção 2, em funções, e uma forma de as ler.

**Sintaxe que vais praticar:** desestruturação com valores por omissão nos parâmetros, `Math.ceil`, `toFixed` e `Number(...)`, um `while` que divide até caber.

<details>
<summary>Solução de referência</summary>

```js
const SEGUNDOS_POR_DIA = 86_400;

export function pedidosPorSegundo({ utilizadoresDiarios, pedidosPorUtilizador, fatorPico = 1 }) {
  const media = (utilizadoresDiarios * pedidosPorUtilizador) / SEGUNDOS_POR_DIA;
  return { media: Math.ceil(media), pico: Math.ceil(media * fatorPico) };
}

export function armazenamento({ itensPorDia, bytesPorItem, anos, replicas = 1 }) {
  return itensPorDia * bytesPorItem * 365 * anos * replicas;
}

const UNIDADES = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

export function formatarBytes(n) {
  let valor = n;
  let i = 0;
  while (valor >= 1000 && i < UNIDADES.length - 1) {
    valor /= 1000;
    i++;
  }
  // Number(x.toFixed(1)) tira o ",0" sozinho: 2.0 → 2
  return `${Number(valor.toFixed(1))} ${UNIDADES[i]}`;
}
```
</details>

### P2 · O encurtador de URLs (≈35 min)

**Ficheiro:** `encurtador.js`

Base 62 nos dois sentidos, e o serviço: o mesmo URL dá sempre o mesmo código, os aliases personalizados não se pisam, e os cliques são contados. O gerador de ids é injetado, como faria um sistema real com uma sequência da BD.

**Sintaxe que vais praticar:** `%` e `Math.floor` para mudar de base, `indexOf`, `Number.isSafeInteger`, três `Map`s com papéis diferentes, `new URL()` para validar.

<details>
<summary>Pista</summary>

Para codificar, usa a mesma ideia de passar um número para binário: o resto da divisão por 62 dá o último símbolo; divide e repete. Para descodificar, ao contrário: `n = n * 62 + valor` para cada símbolo, da esquerda para a direita. Para "o mesmo URL dá o mesmo código", precisas de um segundo `Map`, no sentido inverso.
</details>

<details>
<summary>Solução de referência</summary>

```js
export const ALFABETO = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE = ALFABETO.length;

export function codificar(n) {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`não é um inteiro >= 0: ${n}`);
  if (n === 0) return ALFABETO[0];
  let texto = '';
  // Como na conversão para binário: o resto da divisão é o último "dígito".
  while (n > 0) {
    texto = ALFABETO[n % BASE] + texto;
    n = Math.floor(n / BASE);
  }
  return texto;
}

export function descodificar(texto) {
  if (!texto) throw new Error('código vazio');
  let n = 0;
  for (const c of texto) {
    const valor = ALFABETO.indexOf(c);
    if (valor === -1) throw new Error(`carácter inválido: "${c}"`);
    n = n * BASE + valor;
  }
  return n;
}

const ALIAS_VALIDO = /^[A-Za-z0-9-]{3,30}$/;

export class Encurtador {
  constructor({ proximoId }) {
    this.proximoId = proximoId;
    this.porCodigo = new Map();   // código → url
    this.porUrl = new Map();      // url → código (para o mesmo url dar o mesmo código)
    this.contagem = new Map();    // código → cliques
  }

  encurtar(url, { alias } = {}) {
    let valido;
    try {
      valido = ['http:', 'https:'].includes(new URL(url).protocol);
    } catch {
      valido = false;
    }
    if (!valido) throw new Error(`URL inválido: "${url}"`);

    if (alias !== undefined) {
      if (!ALIAS_VALIDO.test(alias)) throw new Error(`alias inválido: "${alias}"`);
      const dono = this.porCodigo.get(alias);
      if (dono !== undefined && dono !== url) throw new Error(`alias já em uso: "${alias}"`);
      this.guardar(alias, url);
      return alias;
    }

    const existente = this.porUrl.get(url);
    if (existente) return existente;
    const codigo = codificar(this.proximoId());
    this.guardar(codigo, url);
    return codigo;
  }

  guardar(codigo, url) {
    this.porCodigo.set(codigo, url);
    if (!this.porUrl.has(url)) this.porUrl.set(url, codigo);
  }

  expandir(codigo) {
    const url = this.porCodigo.get(codigo);
    if (url === undefined) return null;
    this.contagem.set(codigo, this.cliques(codigo) + 1);
    return url;
  }

  cliques(codigo) {
    return this.contagem.get(codigo) ?? 0;
  }
}
```
</details>

### P3 · Hashing consistente (≈35 min)

**Ficheiro:** `hashConsistente.js`

Um anel com nós virtuais e pesquisa binária. Os testes medem duas coisas: que a carga fica equilibrada entre os nós, e que acrescentar um quinto nó move só cerca de 1/5 das chaves, quando o `hash % N` moveria quatro quintos.

**Sintaxe que vais praticar:** um array de objetos ordenado com `sort((a, b) => a.h - b.h)`, pesquisa binária com dois índices, `>> 1` para dividir por 2, `filter`, `new Set` para os nós únicos.

<details>
<summary>Pista</summary>

Pensa no anel como um array ordenado de posições. "A primeira posição >= h" é uma pesquisa binária: mantém um intervalo `[baixo, alto)` e corta-o ao meio até ficar vazio. Se a resposta for o fim do array, dá a volta: é a posição 0. Os nós virtuais são só mais posições para o mesmo nó, e é isso que equilibra a carga.
</details>

<details>
<summary>Solução de referência</summary>

```js
import { createHash } from 'node:crypto';

export function hash32(texto) {
  return createHash('md5').update(texto).digest().readUInt32BE(0);
}

export function porModulo(chave, nos) {
  return nos[hash32(chave) % nos.length];
}

export class Anel {
  constructor({ virtuais = 100 } = {}) {
    this.virtuais = virtuais;
    this.posicoes = []; // [{ h, no }], sempre ordenado por h
  }

  adicionar(no) {
    for (let i = 0; i < this.virtuais; i++) this.posicoes.push({ h: hash32(`${no}#${i}`), no });
    this.posicoes.sort((a, b) => a.h - b.h);
  }

  remover(no) {
    this.posicoes = this.posicoes.filter((p) => p.no !== no);
  }

  noPara(chave) {
    if (this.posicoes.length === 0) throw new Error('o anel está vazio');
    const h = hash32(chave);
    // Pesquisa binária: a primeira posição com h >= hash da chave.
    let baixo = 0;
    let alto = this.posicoes.length;
    while (baixo < alto) {
      const meio = (baixo + alto) >> 1;
      if (this.posicoes[meio].h < h) baixo = meio + 1;
      else alto = meio;
    }
    // Se passou da última, dá a volta ao anel: é a primeira.
    return this.posicoes[baixo % this.posicoes.length].no;
  }

  nos() {
    return [...new Set(this.posicoes.map((p) => p.no))].sort();
  }
}
```
</details>

### P4 · Limitador com janela deslizante (≈30 min)

**Ficheiro:** `janelaDeslizante.js`

O algoritmo da secção 8, sobre um armazém com a interface do Redis, com um relógio injetado. Um dos testes faz 100 pedidos no último segundo de um minuto e mais 100 dois segundos depois: com a janela fixa do módulo 05 passavam todos; com a tua, quase nenhum.

**Sintaxe que vais praticar:** `async`/`await` com um armazém assíncrono, `??` para chaves que não existem, `%` para a posição dentro da janela, `Math.ceil` e `Math.max`.

<details>
<summary>Solução de referência</summary>

```js
export class JanelaDeslizante {
  constructor({ armazem, limite, janelaMs, agora = Date.now }) {
    Object.assign(this, { armazem, limite, janelaMs, agora });
  }

  async permitir(cliente) {
    const t = this.agora();
    const janela = Math.floor(t / this.janelaMs);
    const chaveAtual = `lim:${cliente}:${janela}`;
    const anterior = (await this.armazem.get(`lim:${cliente}:${janela - 1}`)) ?? 0;
    const atual = (await this.armazem.get(chaveAtual)) ?? 0;

    // Que fração da janela anterior ainda está dentro dos últimos janelaMs?
    const decorrido = (t % this.janelaMs) / this.janelaMs;
    const estimativa = anterior * (1 - decorrido) + atual + 1; // + 1: este pedido

    if (estimativa > this.limite) return { permitido: false, restantes: 0 };

    await this.armazem.incr(chaveAtual);
    await this.armazem.expire(chaveAtual, Math.ceil((2 * this.janelaMs) / 1000));
    return { permitido: true, restantes: Math.max(0, this.limite - Math.ceil(estimativa)) };
  }
}
```

Repara que entre o `get` e o `incr` há uma janela em que outra réplica pode ler os mesmos valores: o limite pode ser ultrapassado por alguns pedidos em alturas de muito tráfego. Para ser exato, a leitura e o incremento têm de ser uma só operação atómica, num script Lua do Redis (o `EVAL`). Para a maior parte dos casos, a aproximação chega.
</details>

## Experiências

1. **Faz uma entrevista a ti próprio:** escolhe um enunciado ("desenha o sistema de reservas de um cinema"), põe um temporizador de 45 minutos, e segue o guião da secção 1 numa folha. No fim, compara com o que farias neste projeto: que peças já tens?
2. **Quantas chaves se movem:** num ficheiro `.mjs`, usa o teu `Anel` e o `porModulo` com 10 000 chaves, e mede quantas mudam de nó ao passar de 10 para 11 nós, nos dois casos. E com `virtuais: 1` em vez de 100, como fica o equilíbrio da carga?
3. **O preço da consistência:** no `docker-compose.yml`, imagina que acrescentavas uma réplica de leitura do Postgres. Que ecrã do frontend mostraria dados "atrasados" logo a seguir a criar uma tarefa? Como o resolverias?

## Perguntas de pensamento crítico

1. Num encurtador, porque é que se usa um contador e base 62, em vez de um hash do URL truncado a 7 caracteres?
2. O teu feed usa fan-out na escrita. Um utilizador com 50 milhões de seguidores publica. O que acontece, e o que mudarias?
3. Uma colega propõe particionar a base de dados das tarefas desde o primeiro dia, "para estarmos preparados". Que perguntas lhe fazes?

<details>
<summary>Respostas</summary>

1. Um hash truncado pode colidir: dois URLs diferentes com os mesmos 7 primeiros caracteres do hash, e então é preciso detetar a colisão e tentar outro valor, com uma leitura à BD em cada criação. Um contador nunca colide, e base 62 dá códigos curtos. Os defeitos do contador: os códigos são sequenciais (adivinháveis, o que pode ser um problema de privacidade), e é preciso um contador partilhado entre servidores (uma sequência da BD, ou blocos de ids reservados por cada servidor).
2. Uma publicação gera 50 milhões de escritas: a fila enche, os feeds dos seguidores ficam atrasados minutos, e o custo é enorme por uma só publicação. A solução híbrida: não fazer fan-out para contas com muitos seguidores; em vez disso, ao ler o feed, juntar as publicações recentes dessas poucas contas ao feed já pré-calculado.
3. Quanto tráfego e quantos dados espera ter, e quando? (Uma instância Postgres aguenta muito mais do que se pensa, e há réplicas de leitura e caches antes de ser preciso particionar.) Que consultas atravessariam partições, e quanto custariam? Qual seria a chave de partição, e haveria partições quentes? Particionar cedo de mais traz toda a complexidade (consultas, transações, migrações, operação) para resolver um problema que talvez nunca chegue.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 37`.

**1.** Qual é a condição para escalar uma API horizontalmente (mais réplicas atrás de um balanceador)?

- a) Usar uma base de dados NoSQL
- b) Ser sem estado: nada que tenha de sobreviver fica na memória ou no disco de uma réplica
- c) Ter um IP fixo
- d) Correr em Kubernetes

<details><summary>Resposta</summary>

**b) Ser sem estado: nada que tenha de sobreviver fica na memória ou no disco de uma réplica** — Sessões, ficheiros e contadores vão para a BD, a cache ou um armazenamento partilhado; qualquer réplica pode então atender qualquer pedido.

</details>

**2.** Porque se usa hashing consistente em vez de hash(chave) % N para distribuir chaves?

- a) É mais rápido de calcular
- b) Quando o número de nós muda, só uma pequena fração das chaves muda de nó (com % N, mudam quase todas)
- c) Garante que nunca há colisões
- d) Cifra as chaves

<details><summary>Resposta</summary>

**b) Quando o número de nós muda, só uma pequena fração das chaves muda de nó (com % N, mudam quase todas)** — Com % N, passar de 4 para 5 nós move ~80% das chaves; com o anel, ~20%.

</details>

**3.** Um utilizador cria uma tarefa e, ao recarregar a página, não a vê; segundos depois, aparece. Que mecanismo é o suspeito mais provável?

- a) Um deadlock
- b) O atraso de replicação: a leitura foi a uma réplica que ainda não tinha recebido a escrita
- c) Uma injeção de SQL
- d) O CORS

<details><summary>Resposta</summary>

**b) O atraso de replicação: a leitura foi a uma réplica que ainda não tinha recebido a escrita** — A solução habitual é ler do primário logo a seguir às escritas do próprio utilizador (read-your-writes).

</details>

**4.** Que teorema diz que, com uma partição de rede, um sistema distribuído tem de escolher entre consistência e disponibilidade?

<details><summary>Resposta</summary>

**cap** — O PACELC acrescenta que, mesmo sem partições, há um trade-off entre latência e consistência.

</details>

**5.** No desenho de um feed, o que é o fan-out na escrita?

- a) Ler as publicações de todos os seguidos quando o feed é aberto
- b) Copiar cada publicação para o feed de cada seguidor no momento em que é publicada
- c) Enviar as publicações por email
- d) Apagar publicações antigas

<details><summary>Resposta</summary>

**b) Copiar cada publicação para o feed de cada seguidor no momento em que é publicada** — Leitura instantânea, publicação cara; não serve para contas com milhões de seguidores, que se tratam na leitura.

</details>

<!-- quiz:end -->
