# 54 · Pagamentos e webhooks

**Objetivo:** saber integrar pagamentos sem perder nem duplicar dinheiro: representar valores sem erros de arredondamento, o fluxo de um pagamento com cartão (autorizar, capturar, reembolsar), chaves de idempotência, e receber webhooks com assinatura, duplicados e ordem trocada. Os exemplos seguem o modelo da Stripe, mas as ideias valem para qualquer fornecedor (Adyen, Mollie, a SIBS com o MB WAY e as Referências Multibanco).

**Ficheiros para ler:** `src/api/src/routes/tasks.js` (como a API recebe pedidos JSON) e o `retry` do módulo 14.

**Pré-requisitos:** módulos 13 (segurança), 38 (transações), 40 (sagas) e 50 (resiliência: o "não sei").

---

## 1. O dinheiro não é um `number`

```js
0.1 + 0.2            // 0.30000000000000004
19.99 * 3            // 59.97000000000001
```

Os números de vírgula flutuante (IEEE 754) não representam exatamente a maior parte das frações decimais. Num carrinho de compras, isso aparece como um cêntimo a mais ou a menos numa fatura, totais que não batem certo com a soma das linhas, e uma reconciliação contabilística que falha. As regras:

- **Guarda e calcula em cêntimos inteiros** (a "unidade menor" da moeda): 19,99 € é `1999`. É o que todas as APIs de pagamentos usam (`amount: 1999, currency: 'eur'`). Cuidado: nem todas as moedas têm 2 casas decimais (o iene tem 0, o dinar do Kuwait tem 3).
- Na base de dados: `integer`/`bigint` em cêntimos, ou `numeric(12, 2)` (decimal exato). Nunca `real` ou `double precision`.
- **Arredondamento só num sítio, e explícito**: o IVA de uma linha, um desconto de 15%. Decide a regra (metades para cima? o arredondamento do banqueiro?) e o momento (por linha ou no total; a lei fiscal às vezes decide por ti).
- **Repartir** um valor (um pagamento em 3 prestações de 10 €) dá 3,33 + 3,33 + 3,33 = 9,99. O cêntimo que sobra tem de ir para algum lado.
- **Formatar** só na apresentação, com `Intl.NumberFormat` e a localização certa (`1234,56 €` em Portugal, `€1,234.56` na Irlanda).

## 2. O fluxo de um pagamento com cartão

```
 cliente            o teu servidor                   fornecedor (Stripe)              banco do cliente
   │  checkout  ─────▶ cria PaymentIntent (1230, eur) ──▶
   │  ◀──── client_secret ─────────────────────────────
   │  dados do cartão (direto ao fornecedor, nunca ao teu servidor) ─▶ autoriza ──▶ 3-D Secure
   │                                                      ◀───────────────────── aprovado
   │                    ◀──── webhook: payment_intent.succeeded ─────
   │                    marca a encomenda como paga, envia
```

Pontos importantes:

- **Os dados do cartão nunca passam pelo teu servidor.** O formulário do cartão é do fornecedor (um *iframe* ou a página dele), e tu só recebes um identificador. Assim ficas fora da maior parte das exigências do **PCI DSS**, a norma de segurança para quem trata dados de cartões (que é pesadíssima).
- **Autorizar** reserva o valor no cartão; **capturar** cobra-o mesmo. Podem ser o mesmo passo, ou separados (um hotel autoriza na reserva e captura no *check-out*; uma loja captura quando envia).
- **Autenticação forte** (a diretiva europeia PSD2): o banco pode pedir uma confirmação (3-D Secure, na app do banco). O pagamento fica "à espera de ação" e o resultado chega mais tarde.
- **Reembolsos** são operações novas, nunca se "apaga" um pagamento. E há os **chargebacks** (o cliente contesta no banco), que chegam semanas depois.

O ponto central: **o resultado chega de forma assíncrona**, por webhook. Nunca marques uma encomenda como paga só porque o browser do cliente voltou à página de "obrigado": ele pode ter fechado o separador antes, ou alguém pode abrir esse URL à mão.

## 3. Idempotência: o "não sei" com dinheiro

O módulo 50 falou do terceiro resultado de uma chamada de rede: **não sei**. O teu servidor pede ao fornecedor "cobra 12,30 €", e a ligação cai antes da resposta. Cobrou ou não? Se repetires, podes cobrar duas vezes; se não repetires, podes não cobrar.

A solução é a **chave de idempotência**: o cliente gera um identificador único **para a operação** (um UUID, ou derivado do id da encomenda: `encomenda-981-pagamento`) e envia-o em todas as tentativas, num cabeçalho `Idempotency-Key`. O servidor guarda, por chave, o pedido e o resultado:

- primeira vez: executa, guarda o resultado;
- repetição com a mesma chave e o mesmo pedido: devolve o resultado guardado, **sem executar**;
- repetição enquanto a primeira ainda está a correr: espera por ela (ou responde `409 Conflict`);
- a mesma chave com um pedido diferente: é um erro do cliente (`422`).

A Stripe aceita chaves de idempotência em todos os `POST` e guarda-as durante 24 horas. E deves oferecer o mesmo nas **tuas** APIs que criam coisas importantes (encomendas, transferências): o teu frontend também tem o "não sei". Num sistema com várias instâncias, a tabela de chaves vive na base de dados, com uma restrição de unicidade na chave (módulo 38: a base de dados resolve a corrida).

## 4. Webhooks: receber

Um webhook é um `POST` do fornecedor para um URL teu, a avisar que algo aconteceu. Receber webhooks de forma segura e correta tem cinco regras:

1. **Verifica a assinatura.** O URL é público: qualquer pessoa pode fazer um `POST` com `{"tipo": "pagamento.capturado"}`. O fornecedor assina cada pedido com um HMAC (módulo 13) e um segredo partilhado; recalculas e comparas. Assina-se o **corpo bruto**, os bytes exatos que chegaram: se fizeres `JSON.parse` e depois `JSON.stringify`, a ordem das chaves ou os espaços mudam e a assinatura deixa de bater certo (no Express, é preciso `express.raw()` nessa rota). A comparação é em **tempo constante** (`timingSafeEqual`), para não revelar a assinatura certa byte a byte pelo tempo de resposta.
2. **Rejeita pedidos antigos.** A assinatura inclui um *timestamp*, e recusas os que tenham mais de 5 minutos: assim, um pedido intercetado não pode ser reenviado mais tarde (*replay*).
3. **Responde depressa (2xx) e processa depois.** O fornecedor espera a resposta poucos segundos; se demorares (ou falhares), ele repete. Guarda o evento, põe-no numa fila (módulo 06) e responde `200`.
4. **Espera duplicados.** A entrega é "pelo menos uma vez" (módulo 17): o mesmo evento pode chegar duas ou três vezes. Guarda os ids dos eventos já processados e ignora os repetidos.
5. **Espera a ordem trocada.** O `capturado` pode chegar antes do `autorizado`. Modela o pagamento como uma **máquina de estados** que só avança, e ignora os eventos que o fariam recuar. Em caso de dúvida, pergunta à API do fornecedor o estado atual do pagamento, que é a fonte da verdade.

Para **enviar** webhooks (se o teu produto os oferecer), as regras são as do outro lado: assinar, repetir com *backoff* exponencial durante horas ou dias, um id por evento, e uma página onde os clientes veem as entregas falhadas e as podem reenviar.

## 5. Reconciliação

Por muito bem feito que esteja, algo vai falhar: um webhook perdido durante uma indisponibilidade de horas, um bug que marcou uma encomenda errada. A **reconciliação** é um processo periódico (diário) que compara o que o teu sistema acha com o que o fornecedor diz (os relatórios de pagamentos e de transferências para o banco), e assinala as diferenças. Numa empresa a sério, é a equipa financeira que o exige, e as diferenças têm de ser explicadas ao cêntimo.

## 6. Testar pagamentos

Os fornecedores têm um **modo de teste** com cartões de teste: `4242 4242 4242 4242` aprova, outros números simulam recusas, 3-D Secure ou fraude. A CLI da Stripe (`stripe listen --forward-to localhost:3000/webhooks`) encaminha os webhooks do modo de teste para a tua máquina, e `stripe trigger payment_intent.succeeded` dispara eventos. Nos testes automáticos, isola o fornecedor atrás de um adaptador (a arquitetura hexagonal do módulo 40) e testa a tua lógica com eventos falsos assinados por ti, como na prática deste módulo.

---

## Prática: escreve tu

As quatro peças que protegem o dinheiro: valores em cêntimos (com repartição e IVA sem perder cêntimos), a verificação da assinatura de um webhook com rotação de segredos, um processador com chaves de idempotência que aguenta pedidos em paralelo, e um recetor de webhooks com duplicados, ordem trocada e uma máquina de estados.

**Ficheiros:** `pratica/54-pagamentos-e-webhooks/` (`dinheiro.js`, `assinaturas.js`, `idempotencia.js`, `recetor.js`)

**Verificar:** `npm run verificar 54` (dentro de `pratica/`). Só um exercício: `npm run verificar 54 dinheiro`, `... 54 assinaturas`, `... 54 idempotencia` ou `... 54 recetor`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Dinheiro em cêntimos (≈25 min)

**Ficheiro:** `dinheiro.js`

Ler valores escritos à portuguesa sem `parseFloat`, formatar com `Intl`, repartir sem perder cêntimos, e calcular o IVA.

**Sintaxe que vais praticar:** grupos de captura com valores por omissão na desestruturação (`[, sinal, inteiros, decimais = '']`), `padEnd`, `replaceAll`, `Intl.NumberFormat`, `Array.from({ length })`.

<details>
<summary>Pista</summary>

Uma expressão regular para o formato inteiro: sinal opcional, a parte inteira (ou com pontos a cada 3 algarismos, ou sem pontos nenhuns), e opcionalmente uma vírgula com 1 ou 2 algarismos. Depois é só aritmética com inteiros: `inteiros × 100 + decimais` (com `'5'.padEnd(2, '0')` a dar `'50'`).
</details>

<details>
<summary>Solução de referência</summary>

```js
// P1 · Dinheiro em cêntimos (inteiros), nunca em números com vírgula.

// paraCentimos(texto) → inteiro: '12,34' → 1234; '1.234,5' → 123450; '7' → 700; '-0,05' → -5
//   Formato português: '.' separa os milhares (ignora-se), ',' as decimais (no máximo 2).
//   Qualquer outra coisa (letras, 3 decimais, vazio) → lança um Error('Valor inválido').
//   Não uses parseFloat: 0.1 + 0.2 !== 0.3 em vírgula flutuante. Trabalha com o texto.
export function paraCentimos(texto) {
  const m = /^(-?)(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/.exec(texto.trim());
  if (!m) throw new Error('Valor inválido');
  const [, sinal, inteiros, decimais = ''] = m;
  const c = Number(inteiros.replaceAll('.', '')) * 100 + Number(decimais.padEnd(2, '0'));
  return sinal ? -c : c;
}

// formatar(centimos) → texto em euros, à portuguesa: 123456 → '1234,56 €'; -5 → '-0,05 €'
//   Usa Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }) e troca os espaços
//   especiais (U+00A0 e U+202F) que ele usa por espaços normais.
export function formatar(centimos) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
    .format(centimos / 100)
    .replace(/[\u00a0\u202f]/g, ' ');
}

// repartir(centimos, partes) → lista de `partes` inteiros que somam EXATAMENTE centimos, o mais
//   iguais possível; os cêntimos que sobram vão um a um para as primeiras partes.
//   repartir(1000, 3) → [334, 333, 333]. partes tem de ser um inteiro >= 1, senão Error('Número de partes inválido').
export function repartir(centimos, partes) {
  if (!Number.isInteger(partes) || partes < 1) throw new Error('Número de partes inválido');
  const base = Math.floor(centimos / partes);
  const resto = centimos - base * partes;
  return Array.from({ length: partes }, (_, i) => base + (i < resto ? 1 : 0));
}

// comIva(centimos, taxaPercentagem) → { base, iva, total } em cêntimos inteiros
//   iva = a taxa sobre a base, arredondada ao cêntimo (metades para cima: Math.round)
//   comIva(1000, 23) → { base: 1000, iva: 230, total: 1230 }
export function comIva(centimos, taxaPercentagem) {
  const iva = Math.round((centimos * taxaPercentagem) / 100);
  return { base: centimos, iva, total: centimos + iva };
}
```
</details>

### P2 · Assinatura de webhooks (≈25 min)

**Ficheiro:** `assinaturas.js`

Assinar e verificar no formato `t=...,v1=...`, com tolerância de tempo, várias assinaturas e vários segredos (para trocar o segredo sem parar), e comparação em tempo constante.

**Sintaxe que vais praticar:** `createHmac`, `timingSafeEqual` com `Buffer`s, `[x].flat()` para aceitar um valor ou uma lista, classes de erro próprias.

<details>
<summary>Pista</summary>

Parte o cabeçalho em pares `chave=valor`. Valida primeiro a forma (há `t` inteiro e pelo menos uma `v1`), depois o tempo, e só no fim calcula HMACs. O `timingSafeEqual` lança um erro se os dois `Buffer`s tiverem comprimentos diferentes: verifica isso antes.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P2 · Webhooks assinados (como os da Stripe): provar que o pedido veio mesmo do fornecedor.
import { createHmac, timingSafeEqual } from 'node:crypto';

// assinar(corpo, segredo, t) → 't=<t>,v1=<hex>' em que hex é o HMAC-SHA256 de `${t}.${corpo}`
//   t: segundos desde 1970. O instante entra na assinatura para um atacante não conseguir
//   reenviar um pedido antigo com outro t.
export function assinar(corpo, segredo, t) {
  return `t=${t},v1=${createHmac('sha256', segredo).update(`${t}.${corpo}`).digest('hex')}`;
}

export class ErroAssinatura extends Error {}

// verificar(corpoBruto, cabecalho, segredos, { agora, tolerancia = 300 }) → true, ou lança ErroAssinatura
//   corpoBruto: o corpo EXATAMENTE como chegou (texto), antes de qualquer JSON.parse
//   cabecalho: 't=...,v1=...,v1=...' (pode ter várias v1 durante uma troca de segredo)
//   segredos: um segredo ou uma lista (o atual e o anterior, durante uma rotação)
//   agora: segundos desde 1970
//   Falha (ErroAssinatura) se: o cabeçalho não tiver t ou nenhuma v1; |agora − t| > tolerancia;
//   nenhuma combinação (v1, segredo) bater certo. Compara com timingSafeEqual (e confirma antes
//   que os comprimentos são iguais, senão ele lança).
export function verificar(corpoBruto, cabecalho, segredos, { agora, tolerancia = 300 }) {
  const partes = (cabecalho ?? '').split(',').map((p) => p.trim().split('='));
  const t = Number(partes.find(([k]) => k === 't')?.[1]);
  const assinaturas = partes.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!Number.isInteger(t) || assinaturas.length === 0) throw new ErroAssinatura('Cabeçalho de assinatura inválido');
  if (Math.abs(agora - t) > tolerancia) throw new ErroAssinatura('Assinatura fora do prazo');
  for (const segredo of [segredos].flat()) {
    const esperada = Buffer.from(createHmac('sha256', segredo).update(`${t}.${corpoBruto}`).digest('hex'));
    for (const a of assinaturas) {
      const recebida = Buffer.from(a);
      if (recebida.length === esperada.length && timingSafeEqual(recebida, esperada)) return true;
    }
  }
  throw new ErroAssinatura('Assinatura não confere');
}
```
</details>

### P3 · Chaves de idempotência (≈25 min)

**Ficheiro:** `idempotencia.js`

Executar uma operação uma só vez por chave, mesmo com repetições em paralelo, recusar a reutilização de uma chave com outro pedido, e libertar a chave quando a operação falha.

**Sintaxe que vais praticar:** guardar a **promessa** (e não o resultado) num `Map`, `Promise.resolve().then(...)` para apanhar erros síncronos, `.catch` que limpa e volta a lançar.

<details>
<summary>Pista</summary>

O truque para os pedidos em paralelo é o mesmo do *single flight* do módulo 05: guarda a promessa no `Map` **antes** de ela acabar. Quem chega a seguir recebe a mesma promessa. Guarda também a impressão digital do pedido (o hash do JSON) para comparar.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P3 · Chaves de idempotência: repetir um pedido de pagamento não pode cobrar duas vezes.
import { createHash } from 'node:crypto';

export class ErroIdempotencia extends Error {}

// criarIdempotente(executar) → { processar(chave, pedido) }
//   executar: async (pedido) → resultado (ex.: cobrar o cartão)
//   processar(chave, pedido):
//   - primeira vez com esta chave: corre executar(pedido), guarda o resultado e devolve-o
//   - a mesma chave outra vez, com o MESMO pedido: devolve o resultado guardado, sem executar
//   - a mesma chave enquanto a primeira ainda está a correr: espera por ela e devolve o mesmo
//     resultado (nunca executa duas vezes em paralelo)
//   - a mesma chave com um pedido DIFERENTE: lança ErroIdempotencia (é um erro do cliente: reutilizou a chave)
//     ("o mesmo pedido" = o mesmo SHA-256 de JSON.stringify(pedido))
//   - se executar falhar: o erro propaga, e a chave fica livre para uma nova tentativa
export function criarIdempotente(executar) {
  const entradas = new Map(); // chave → { impressao, promessa }
  const impressaoDe = (pedido) => createHash('sha256').update(JSON.stringify(pedido)).digest('hex');
  return {
    processar(chave, pedido) {
      const impressao = impressaoDe(pedido);
      const e = entradas.get(chave);
      if (e) {
        if (e.impressao !== impressao) return Promise.reject(new ErroIdempotencia(`A chave ${chave} já foi usada com outro pedido`));
        return e.promessa;
      }
      const promessa = Promise.resolve()
        .then(() => executar(pedido))
        .catch((erro) => {
          entradas.delete(chave);
          throw erro;
        });
      entradas.set(chave, { impressao, promessa });
      return promessa;
    },
  };
}
```
</details>

### P4 · Um recetor de webhooks (≈20 min)

**Ficheiro:** `recetor.js`

Uma máquina de estados para o pagamento, que só avança, aceita eventos fora de ordem, trata o `falhado` como final e ignora duplicados.

**Sintaxe que vais praticar:** `Set` para os ids vistos, `indexOf` numa lista ordenada para comparar estados, desestruturação com renomeação (`{ estado: novo }`).

<details>
<summary>Pista</summary>

A posição de cada estado em `ORDEM` diz quão "à frente" está. Um evento só se aplica se a posição nova for maior do que a atual. Marca o id como visto **antes** de decidir se o aplicas, para um evento ignorado também contar como recebido.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P4 · Receber webhooks: duplicados, ordem trocada, e uma máquina de estados para o pagamento.

// Os estados de um pagamento, pela ordem em que avançam. 'falhado' é um estado final à parte.
export const ORDEM = ['pendente', 'autorizado', 'capturado', 'reembolsado'];

// criarRecetor() → { receber(evento), estado(pagamento) }
//   evento: { id, pagamento, estado } (estado é o NOVO estado do pagamento)
//   estado(pagamento) → o estado atual ('pendente' se nunca se recebeu nada)
//   receber(evento) → 'processado' | 'duplicado' | 'ignorado'
//   - um id de evento já recebido → 'duplicado' (os fornecedores entregam "pelo menos uma vez")
//   - 'falhado': só se o pagamento ainda não foi capturado (pendente ou autorizado); senão 'ignorado'
//   - um estado de ORDEM: só se estiver MAIS À FRENTE do que o atual (os eventos podem chegar fora
//     de ordem: o 'capturado' pode chegar antes do 'autorizado', que depois se ignora)
//   - nada sai de 'falhado'
//   - um estado desconhecido → lança um Error
//   Um evento ignorado conta como recebido (um reenvio dele é 'duplicado').
export function criarRecetor() {
  const vistos = new Set();
  const estados = new Map();
  const estado = (pagamento) => estados.get(pagamento) ?? 'pendente';
  return {
    estado,
    receber({ id, pagamento, estado: novo }) {
      if (novo !== 'falhado' && !ORDEM.includes(novo)) throw new Error(`Estado desconhecido: ${novo}`);
      if (vistos.has(id)) return 'duplicado';
      vistos.add(id);
      const atual = estado(pagamento);
      let pode;
      if (atual === 'falhado') pode = false;
      else if (novo === 'falhado') pode = ORDEM.indexOf(atual) < ORDEM.indexOf('capturado');
      else pode = ORDEM.indexOf(novo) > ORDEM.indexOf(atual);
      if (!pode) return 'ignorado';
      estados.set(pagamento, novo);
      return 'processado';
    },
  };
}
```
</details>

## Experiências

1. **O 0,1 + 0,2 no Postgres:** compara `SELECT 0.1::float8 + 0.2::float8` com `SELECT 0.1::numeric + 0.2::numeric`. E `SELECT sum(x) FROM generate_series(1, 1000)` com `x = 0.1` nos dois tipos.
2. **Uma rota de webhooks no Express:** escreve um `POST /webhooks/pagamentos` na API, com `express.raw({ type: 'application/json' })`, o `verificar` do P2 e o recetor do P4. Testa-a com `curl`, assinando o corpo com o teu `assinar`. O que acontece se usares `express.json()` em vez de `express.raw()`?
3. **Idempotência na API:** acrescenta o cabeçalho `Idempotency-Key` ao `POST /api/tasks`, com a tabela de chaves no Postgres (`PRIMARY KEY` na chave). Envia o mesmo pedido duas vezes em paralelo com `curl ... & curl ... &`.
4. **O modo de teste da Stripe:** com uma conta de testes (gratuita), usa a CLI (`stripe listen`, `stripe trigger`) e olha para os cabeçalhos `Stripe-Signature` que chegam.

## Perguntas de pensamento crítico

1. A página de "pagamento concluído" do frontend chama a API para marcar a encomenda como paga. Que problemas tem isto, e qual é a alternativa?
2. O teu servidor pediu uma cobrança e a ligação caiu sem resposta. Explica o que fazes, e o papel da chave de idempotência.
3. Porque é que a verificação da assinatura de um webhook tem de usar o corpo bruto, e não o objeto depois do `JSON.parse`?

<details>
<summary>Respostas</summary>

1. Qualquer pessoa pode chamar essa rota (ou abrir a página) sem ter pago, por isso é uma forma de ter encomendas grátis; e se o cliente fechar o separador antes de a página carregar (ou o 3-D Secure demorar), a encomenda paga nunca é marcada. A alternativa é a fonte da verdade ser o fornecedor: o webhook assinado (`payment_intent.succeeded`) marca a encomenda como paga, e a página de "obrigado" só mostra o estado (pode consultá-lo à API, que pode perguntar ao fornecedor). A reconciliação diária apanha o que escapar.
2. Repito o pedido com **a mesma** chave de idempotência da primeira tentativa (derivada da encomenda, por exemplo). Se a primeira tentativa chegou a cobrar, o fornecedor reconhece a chave e devolve o resultado dessa cobrança sem cobrar outra vez; se não chegou, a cobrança acontece agora. Sem a chave, repetir pode cobrar duas vezes e não repetir pode deixar a encomenda por cobrar. Se continuar sem resposta, a encomenda fica num estado "pagamento por confirmar" e o webhook ou a reconciliação resolvem.
3. Porque a assinatura foi calculada sobre os bytes exatos que o fornecedor enviou. Depois do `JSON.parse` e de um novo `JSON.stringify`, o texto pode mudar (espaços, ordem das chaves, a forma de escrever números ou caracteres Unicode), e o HMAC é completamente diferente com um único byte de diferença. Por isso, a rota tem de ler o corpo como texto/`Buffer`, verificar, e só depois fazer o `JSON.parse`.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 54`.

**1.** Como se deve guardar 19,99 € numa base de dados?

- a) double precision 19.99
- b) integer 1999 (cêntimos) ou numeric(12,2)
- c) text '19,99 €'
- d) real 19.99

<details><summary>Resposta</summary>

**b) integer 1999 (cêntimos) ou numeric(12,2)** — Os números de vírgula flutuante não representam exatamente a maior parte das frações decimais.

</details>

**2.** Para que serve uma chave de idempotência num pedido de cobrança?

- a) Para cifrar o pedido
- b) Para que repetir o pedido (depois de um 'não sei') devolva o resultado da primeira vez em vez de cobrar outra vez
- c) Para identificar o cliente
- d) Para acelerar o pedido

<details><summary>Resposta</summary>

**b) Para que repetir o pedido (depois de um 'não sei') devolva o resultado da primeira vez em vez de cobrar outra vez** — O cliente envia a mesma chave em todas as tentativas da mesma operação.

</details>

**3.** Que função do node:crypto se usa para comparar assinaturas sem revelar informação pelo tempo de resposta?

<details><summary>Resposta</summary>

**timingsafeequal** — Compara em tempo constante; exige Buffers do mesmo comprimento.

</details>

**4.** Porque é que os webhooks assinados incluem um timestamp na assinatura?

- a) Para ordenar os eventos
- b) Para impedir que um pedido intercetado seja reenviado mais tarde (replay)
- c) Para calcular a latência
- d) Por causa do fuso horário

<details><summary>Resposta</summary>

**b) Para impedir que um pedido intercetado seja reenviado mais tarde (replay)** — Recusa-se o que tiver mais de alguns minutos.

</details>

**5.** O evento 'capturado' chega antes do 'autorizado' do mesmo pagamento. O que faz um recetor bem feito?

- a) Rejeita com erro 500 para o fornecedor repetir
- b) Aplica o capturado e ignora depois o autorizado, porque o estado só avança
- c) Aplica os dois pela ordem de chegada, ficando autorizado
- d) Apaga o pagamento

<details><summary>Resposta</summary>

**b) Aplica o capturado e ignora depois o autorizado, porque o estado só avança** — A entrega não garante ordem; a máquina de estados só avança.

</details>

<!-- quiz:end -->
