# 58 · Testes avançados

**Objetivo:** ir além dos testes por exemplos: testes baseados em propriedades (com o fast-check), testes de contrato entre serviços, testes de mutação para medir a qualidade dos próprios testes, e testes deterministas com tempo e aleatoriedade controlados. E saber quando cada um compensa.

**Ficheiros para ler:** `src/api/test/` (os testes da API), `pratica/11-testes-e-observabilidade/` (onde já escreveste testes) e `pratica/54-pagamentos-e-webhooks/dinheiro.js` (o `repartir`, que vais testar com propriedades).

**Pré-requisitos:** módulos 11 (testes), 29 (TypeScript) e 54 (o `repartir`).

---

## 1. O que os testes por exemplos não apanham

Um teste normal escolhe um exemplo e confirma o resultado: `repartir(1000, 3)` dá `[334, 333, 333]`. Funciona, mas só testa os casos em que **quem escreveu o teste pensou**. Os bugs vivem exatamente nos casos em que ninguém pensou: o zero, o número negativo, a lista vazia, o texto com um emoji, os dois pedidos ao mesmo tempo, o fim do mês.

E há uma pergunta que a cobertura de código (módulo 11) não responde: **os testes verificam alguma coisa?** Um teste que chama a função e não confirma o resultado dá 100% de cobertura e não apanha nada.

As técnicas deste módulo atacam estes dois problemas.

## 2. Testes baseados em propriedades

Em vez de exemplos, escreves **propriedades**: regras que valem para **qualquer** entrada. Uma biblioteca (o fast-check em JavaScript, o Hypothesis em Python, o QuickCheck em Haskell, onde a ideia nasceu) gera centenas de entradas aleatórias e procura uma que parta a regra.

```js
import fc from 'fast-check';

fc.assert(
  fc.property(fc.integer({ min: 0 }), fc.integer({ min: 1, max: 50 }), (centimos, partes) => {
    const r = repartir(centimos, partes);
    return r.reduce((a, b) => a + b, 0) === centimos;   // a soma é sempre o total
  }),
);
```

Quando encontra uma falha, o fast-check faz uma coisa preciosa: **encolhe** (*shrinking*) a entrada até ao exemplo mínimo que ainda falha. Em vez de "falhou com `centimos = 8 734 921, partes = 37`", diz "falhou com `centimos = 1, partes = 2`", que se percebe logo. E imprime a semente (*seed*), para reproduzir a mesma sequência.

O difícil é encontrar boas propriedades. Os padrões que mais se usam:

- **Ida e volta** (*round trip*): `descodificar(codificar(x)) === x`; `JSON.parse(JSON.stringify(x))`; ler o que se escreveu.
- **Invariantes**: o tamanho, a soma, a ordenação, "o resultado é sempre válido segundo o esquema".
- **Comparar com um modelo** (*oracle*): a versão otimizada dá o mesmo que uma versão simples e lenta (a pesquisa binária dá o mesmo que um `indexOf`; o índice invertido do módulo 42 dá o mesmo que um `filter`).
- **Idempotência**: `f(f(x)) === f(x)` (normalizar, ordenar, formatar).
- **Coisas que nunca acontecem**: não lança erros, não devolve `NaN`, não fica pendurado.

Uma propriedade que nunca falha também pode ser **fraca**: uma propriedade que só verifica "devolve um array" passa com quase qualquer bug. Por isso, na prática, vais testar as tuas propriedades contra implementações com bugs de propósito.

## 3. Testes de contrato

Num sistema com vários serviços (módulo 37), os testes de cada serviço passam, e mesmo assim a integração parte: a API mudou o nome de um campo de `titulo` para `title` e o frontend deixou de mostrar as tarefas. Os testes de ponta a ponta (com tudo a correr) apanham isto, mas são lentos, frágeis, e só correm no fim.

Os **testes de contrato orientados pelo consumidor** (*consumer-driven contract testing*, popularizados pelo **Pact**) resolvem isto com um ficheiro no meio:

1. O **consumidor** (o frontend) escreve nos seus testes o que espera da API: "a `GET /api/tasks` responde 200 com `tarefas`, uma lista de objetos com `id` numérico e `titulo` em texto". Os testes do consumidor correm contra um **fornecedor falso** gerado a partir disso, e o resultado é um **contrato** (um JSON).
2. O **fornecedor** (a API) corre, nos seus testes, cada pedido do contrato contra o código verdadeiro e confirma que as respostas correspondem.

O contrato diz só o que o consumidor **usa**: a API pode acrescentar campos à vontade, mas não pode tirar nem mudar os que alguém usa. E usa *matchers* ("um número qualquer") em vez de valores exatos, para não partir com dados diferentes. Numa empresa, os contratos ficam num servidor (o Pact Broker), e o pipeline do fornecedor pergunta "posso fazer deploy sem partir nenhum consumidor?" (`can-i-deploy`).

## 4. Testes de mutação

Para saber se os testes verificam alguma coisa, **estraga-se o código de propósito** e vê-se se eles reparam:

```js
// original                          // mutante
if (idade >= 18) return 'adulto';    if (idade > 18) return 'adulto';
```

Se os testes continuarem a passar com o mutante, o mutante **sobreviveu**: nenhum teste verifica o que acontece com 18 anos. A ferramenta (o **Stryker** para JavaScript/TypeScript e C#, o PIT para Java, o mutmut para Python) gera centenas de mutantes (trocar operadores, apagar instruções, trocar `true` por `false`, devolver valores vazios) e corre os testes para cada um. A **pontuação de mutação** é a fração de mutantes mortos.

É uma medida muito mais honesta do que a cobertura, mas tem custos: é lenta (os testes correm uma vez por mutante; as ferramentas limitam-se aos testes que cobrem cada linha), e há **mutantes equivalentes**, que mudam o código sem mudar o comportamento (num `max`, `a > b` e `a >= b` dão sempre o mesmo resultado) e que nenhum teste pode matar. Por isso não se persegue os 100%: usa-se para encontrar zonas importantes mal testadas, de preferência só no código alterado num *pull request*.

## 5. Testes deterministas: tempo e aleatoriedade

Um **teste instável** (*flaky*) é um teste que às vezes passa e às vezes falha sem mudanças no código. É venenoso: as pessoas habituam-se a carregar em "voltar a correr", e um dia ignoram uma falha verdadeira. As causas mais comuns:

- **tempo real**: `setTimeout` com esperas "que chegam", testes que falham à meia-noite, no fim do mês, ou na mudança de hora;
- **aleatoriedade** sem semente;
- **ordem**: testes que dependem do estado deixado por outros, ou da ordem de um `Set` ou de uma consulta sem `ORDER BY`;
- **concorrência** e rede: corridas, portas ocupadas, serviços externos.

O remédio é **controlar** essas fontes, normalmente **injetando-as**: o código recebe o relógio e o gerador aleatório como parâmetros (já o fizeste nos módulos 43 e 50), e os testes passam versões controladas. Para os temporizadores, os executores de testes têm **relógios falsos**: no `node:test`, `mock.timers.enable()` substitui o `setTimeout`, e `mock.timers.tick(300)` avança o tempo 300 ms instantaneamente (o Jest e o Vitest têm `useFakeTimers`). Para a aleatoriedade, um gerador com **semente** dá sempre a mesma sequência; o fast-check usa um assim, e é por isso que consegue reproduzir uma falha.

## 6. Onde é que isto encaixa

A pirâmide de testes do módulo 11 continua a valer: muitos testes unitários rápidos, alguns de integração, poucos de ponta a ponta. Estas técnicas são **complementos**:

| Técnica | Quando compensa |
|---|---|
| Propriedades | código com regras claras e muitas entradas possíveis: dinheiro, datas, parsers, codificadores, estruturas de dados, algoritmos |
| Contrato | vários serviços ou equipas, com uma API entre eles |
| Mutação | código crítico, para avaliar e melhorar os testes (não em todo o código, a cada *commit*) |
| Deterministas | sempre: qualquer teste que dependa de tempo ou de aleatoriedade |

---

## Prática: escreve tu

Desta vez parte do que escreves são testes. No P1, escreves propriedades com o fast-check, e os testes confirmam que elas apanham implementações com bugs. No P2, um pequeno sistema de contratos (verificar um valor contra *matchers*, gerar exemplos, um fornecedor falso e a verificação do fornecedor verdadeiro). No P3, um testador de mutação. No P4, um gerador com semente, um baralhador e uma função *debounce* testada com o relógio falso do `node:test`.

**Ficheiros:** `pratica/58-testes-avancados/` (`propriedades.js`, `contrato.js`, `mutacao.js`, `deterministico.js`)

**Verificar:** `npm run verificar 58` (dentro de `pratica/`). Só um exercício: `npm run verificar 58 propriedades`, `... 58 contrato`, `... 58 mutacao` ou `... 58 deterministico`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Propriedades com o fast-check (≈25 min)

**Ficheiro:** `propriedades.js`

Propriedades para o `repartir` do módulo 54 e para um codificador base64url. Os testes correm-nas contra a implementação certa (têm de passar) e contra cinco versões com bugs (cada uma tem de ser apanhada por pelo menos uma propriedade).

**Sintaxe que vais praticar:** `fc.property`, `fc.integer({ min, max })`, `fc.string({ unit: 'grapheme' })`, *spread* de uma lista de geradores (`fc.property(...entradas, fn)`), `every` com o índice e a lista.

<details>
<summary>Pista</summary>

Uma propriedade é `fc.property(gerador1, gerador2, (a, b) => condição)`, e falha se a função devolver `false` ou lançar um erro. Escreve uma propriedade por regra dos comentários; cada bug "plantado" nos testes viola pelo menos uma delas. O teste diz-te qual o bug que não estás a apanhar.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P1 · Testes baseados em propriedades (fast-check): em vez de exemplos, regras que valem para
// QUALQUER entrada, e o fast-check gera centenas de entradas à procura de uma que as parta.
// Aqui escreves as propriedades; os testes verificam que passam com uma implementação certa e
// que apanham implementações com bugs (se uma propriedade deixa passar um bug, é fraca).
import fc from 'fast-check';

// propriedadesRepartir(repartir) → lista de propriedades (fc.property) sobre
//   repartir(centimos, partes), a função do módulo 54 que reparte um valor em partes quase iguais.
//   Gera centimos inteiros de 0 a 10 000 000 e partes de 1 a 50. Tem de cobrir:
//   - devolve exatamente `partes` elementos
//   - a soma dos elementos é `centimos`
//   - o maior e o menor diferem no máximo 1
//   - a lista nunca cresce (os cêntimos a mais vão para as primeiras partes)
export function propriedadesRepartir(repartir) {
  const entradas = [fc.integer({ min: 0, max: 10_000_000 }), fc.integer({ min: 1, max: 50 })];
  return [
    fc.property(...entradas, (c, p) => repartir(c, p).length === p),
    fc.property(...entradas, (c, p) => repartir(c, p).reduce((a, b) => a + b, 0) === c),
    fc.property(...entradas, (c, p) => {
      const r = repartir(c, p);
      return Math.max(...r) - Math.min(...r) <= 1;
    }),
    fc.property(...entradas, (c, p) => repartir(c, p).every((v, i, r) => i === 0 || v <= r[i - 1])),
  ];
}

// propriedadesCodificador(codificar, descodificar) → lista de propriedades sobre um codificador
//   de texto para base64url (para pôr texto num URL). Gera textos Unicode quaisquer
//   (fc.string({ unit: 'grapheme' }): acentos, emojis...). Tem de cobrir:
//   - ida e volta: descodificar(codificar(t)) === t
//   - o resultado só tem os caracteres de base64url: letras, algarismos, '-' e '_' (sem '=')
export function propriedadesCodificador(codificar, descodificar) {
  const texto = fc.string({ unit: 'grapheme' });
  return [
    fc.property(texto, (t) => descodificar(codificar(t)) === t),
    fc.property(texto, (t) => /^[A-Za-z0-9_-]*$/.test(codificar(t))),
  ];
}
```
</details>

### P2 · Testes de contrato (≈35 min)

**Ficheiro:** `contrato.js`

Verificar um valor contra um *matcher* (tipos, expressões regulares, arrays, objetos com chaves a mais permitidas), gerar exemplos, um fornecedor falso para o consumidor e a verificação do fornecedor verdadeiro.

**Sintaxe que vais praticar:** recursão com um caminho (`$.tarefas[1].id`), `flatMap` para juntar listas de erros, o operador `in`, `new RegExp`, `Object.is`.

<details>
<summary>Pista</summary>

Em `verificarValor`, decide primeiro que tipo de *matcher* tens (tem `$tipo`? `$regex`? `$cadaUm`? é um objeto normal? é outro valor?) e trata cada caso. Nos arrays e nos objetos, chama a função para cada elemento ou chave, com o caminho acrescentado, e junta os erros com `flatMap`.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P2 · Testes de contrato orientados pelo consumidor (a ideia do Pact, em pequeno).
// O frontend (consumidor) escreve o que espera da API (fornecedor) num contrato. O contrato serve
// para duas coisas: um fornecedor FALSO para os testes do consumidor, e uma verificação do
// fornecedor VERDADEIRO nos testes da API. Se a API mudar algo de que o frontend depende, parte aqui.
//
// Um contrato: [{ descricao, pedido: { metodo, caminho }, resposta: { estado, corpo } }]
// O corpo da resposta é um "matcher":
//   { $tipo: 'texto' | 'numero' | 'booleano', $exemplo? }   → qualquer valor desse tipo
//   { $regex: '^\\d{4}-\\d{2}-\\d{2}$', $exemplo }          → um texto que corresponde
//   { $cadaUm: matcher, $min = 1 }                            → um array com pelo menos $min elementos, todos a corresponder
//   um objeto normal                                           → um objeto com (pelo menos) essas chaves, cada uma a
//                                                                corresponder; chaves a mais são permitidas (o
//                                                                consumidor só exige o que usa)
//   outro valor (texto, número, booleano, null)                → exatamente esse valor

const TIPOS = { texto: 'string', numero: 'number', booleano: 'boolean' };
const descrever = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

// verificarValor(valor, matcher, caminho = '$') → lista de erros, cada um a começar pelo caminho
//   onde falhou ('$.tarefas[1].id: ...'). [] se corresponder.
export function verificarValor(valor, matcher, caminho = '$') {
  if (matcher !== null && typeof matcher === 'object' && !Array.isArray(matcher)) {
    if ('$tipo' in matcher) {
      return typeof valor === TIPOS[matcher.$tipo] ? [] : [`${caminho}: esperava ${matcher.$tipo}, veio ${descrever(valor)}`];
    }
    if ('$regex' in matcher) {
      return typeof valor === 'string' && new RegExp(matcher.$regex).test(valor)
        ? []
        : [`${caminho}: não corresponde a /${matcher.$regex}/`];
    }
    if ('$cadaUm' in matcher) {
      if (!Array.isArray(valor)) return [`${caminho}: esperava array, veio ${descrever(valor)}`];
      const min = matcher.$min ?? 1;
      if (valor.length < min) return [`${caminho}: esperava pelo menos ${min} elementos, veio ${valor.length}`];
      return valor.flatMap((v, i) => verificarValor(v, matcher.$cadaUm, `${caminho}[${i}]`));
    }
    if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return [`${caminho}: esperava objeto, veio ${descrever(valor)}`];
    return Object.entries(matcher).flatMap(([k, m]) =>
      k in valor ? verificarValor(valor[k], m, `${caminho}.${k}`) : [`${caminho}.${k}: em falta`],
    );
  }
  return Object.is(valor, matcher) ? [] : [`${caminho}: esperava ${JSON.stringify(matcher)}, veio ${JSON.stringify(valor)}`];
}

// exemplo(matcher) → um valor de exemplo que corresponde ao matcher:
//   $tipo → o $exemplo se houver, senão 'texto' / 1 / true; $regex → o $exemplo;
//   $cadaUm → $min (ou 1) cópias do exemplo do elemento; objeto → o exemplo de cada chave; outro → ele próprio
export function exemplo(matcher) {
  if (matcher === null || typeof matcher !== 'object' || Array.isArray(matcher)) return matcher;
  if ('$tipo' in matcher) return matcher.$exemplo ?? { texto: 'texto', numero: 1, booleano: true }[matcher.$tipo];
  if ('$regex' in matcher) return matcher.$exemplo;
  if ('$cadaUm' in matcher) return Array.from({ length: matcher.$min ?? 1 }, () => exemplo(matcher.$cadaUm));
  return Object.fromEntries(Object.entries(matcher).map(([k, m]) => [k, exemplo(m)]));
}

// fornecedorFalso(contrato) → async ({ metodo, caminho }) → { estado, corpo }
//   Para os testes do CONSUMIDOR: responde às interações do contrato com os exemplos. Um pedido
//   que não está no contrato → { estado: 500, corpo: { erro: 'Pedido fora do contrato: GET /x' } }
//   (assim o consumidor não pode usar nada que o contrato não diga).
export function fornecedorFalso(contrato) {
  return async ({ metodo, caminho }) => {
    const i = contrato.find((x) => x.pedido.metodo === metodo && x.pedido.caminho === caminho);
    if (!i) return { estado: 500, corpo: { erro: `Pedido fora do contrato: ${metodo} ${caminho}` } };
    return { estado: i.resposta.estado, corpo: exemplo(i.resposta.corpo) };
  };
}

// verificarFornecedor(contrato, fornecedor) → lista de erros (para os testes do FORNECEDOR)
//   Faz cada pedido do contrato ao fornecedor verdadeiro (async (pedido) → { estado, corpo }) e
//   compara. Cada erro começa por '<descricao>: '. Um estado diferente dá
//   '<descricao>: estado esperado 200, veio 404' (e não se verifica o corpo).
export async function verificarFornecedor(contrato, fornecedor) {
  const erros = [];
  for (const { descricao, pedido, resposta } of contrato) {
    const r = await fornecedor(pedido);
    if (r.estado !== resposta.estado) {
      erros.push(`${descricao}: estado esperado ${resposta.estado}, veio ${r.estado}`);
      continue;
    }
    for (const e of verificarValor(r.corpo, resposta.corpo)) erros.push(`${descricao}: ${e}`);
  }
  return erros;
}
```
</details>

### P3 · Um testador de mutação (≈35 min)

**Ficheiro:** `mutacao.js`

Gerar um mutante por operador (com o número da linha), sem confundir `<=` com `<` nem tocar em `=>`, e avaliar quantos mutantes os testes matam.

**Sintaxe que vais praticar:** `matchAll` com alternativas ordenadas (as mais compridas primeiro), `m.index`, `new Function` para compilar código, `instanceof SyntaxError`.

<details>
<summary>Pista</summary>

A expressão regular tem de apanhar os símbolos que **não** se mudam (`=>`, `++`, `+=`...) para eles não serem lidos como `>` ou `+`; depois ignoras os que não estão em `MUTACOES`. A ordem das alternativas importa: `===` antes de `<=`, e `<=` antes de `<`.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P3 · Testes de mutação: quem testa os testes? Muda-se o código de propósito (um < passa a <=,
// um + a -) e corre-se os testes. Se continuarem a passar, o "mutante sobreviveu": os testes não
// estavam a verificar aquela linha a sério. (O Stryker faz isto para projetos inteiros.)

// As mutações: cada operador encontrado no código é trocado pelo seu par.
export const MUTACOES = {
  '<': '<=', '<=': '<', '>': '>=', '>=': '>',
  '===': '!==', '!==': '===',
  '&&': '||', '||': '&&',
  '+': '-', '-': '+',
  true: 'false', false: 'true',
};

// gerarMutantes(codigo) → [{ descricao, codigo }], um mutante por cada ocorrência de um operador
//   de MUTACOES, pela ordem em que aparecem no código.
//   descricao: "linha 2: '<' → '<='" (linhas a contar de 1)
//   Cuidado: '<=' é UM operador (não é '<' seguido de '='), '===' também, e '=>', '++', '--',
//   '+=' e '-=' não se mudam. true/false só como palavras inteiras.
//   (Simplificação: o código não tem textos nem comentários com estes símbolos.)
export function gerarMutantes(codigo) {
  const padrao = /===|!==|<=|>=|=>|&&|\|\||\+\+|--|\+=|-=|[<>+-]|\btrue\b|\bfalse\b/g;
  const mutantes = [];
  for (const m of codigo.matchAll(padrao)) {
    const op = m[0];
    if (!Object.hasOwn(MUTACOES, op)) continue;
    const linha = codigo.slice(0, m.index).split('\n').length;
    mutantes.push({
      descricao: `linha ${linha}: '${op}' → '${MUTACOES[op]}'`,
      codigo: codigo.slice(0, m.index) + MUTACOES[op] + codigo.slice(m.index + op.length),
    });
  }
  return mutantes;
}

// avaliarMutantes(codigo, testes) → { total, mortos, sobreviventes, pontuacao }
//   codigo: o texto de UMA expressão de função ('(a, b) => a < b ? a : b' ou 'function (x) {...}')
//   testes: (f) => void, lança um erro se f estiver errada (ex.: usa assert lá dentro)
//   - compila com new Function(`return (${codigo})`)()
//   - se os testes falharem com o código original → lança Error('Os testes falham com o código original')
//   - um mutante "morre" se os testes lançarem um erro com ele; "sobrevive" se passarem
//   - mutantes que não compilam (SyntaxError) não contam
//   - sobreviventes: as descrições dos que sobreviveram
//   - pontuacao: mortos / total, arredondada a 2 casas (sem mutantes → 1)
export function avaliarMutantes(codigo, testes) {
  const compilar = (c) => new Function(`return (${c})`)();
  const passa = (f) => {
    try {
      testes(f);
      return true;
    } catch {
      return false;
    }
  };
  if (!passa(compilar(codigo))) throw new Error('Os testes falham com o código original');
  let total = 0;
  let mortos = 0;
  const sobreviventes = [];
  for (const m of gerarMutantes(codigo)) {
    let f;
    try {
      f = compilar(m.codigo);
    } catch (e) {
      if (e instanceof SyntaxError) continue;
      throw e;
    }
    total++;
    if (passa(f)) sobreviventes.push(m.descricao);
    else mortos++;
  }
  return { total, mortos, sobreviventes, pontuacao: total === 0 ? 1 : Math.round((mortos / total) * 100) / 100 };
}
```
</details>

### P4 · Tempo e aleatoriedade controlados (≈20 min)

**Ficheiro:** `deterministico.js`

O gerador mulberry32 com semente, o baralhar de Fisher-Yates com o gerador injetado, e um *debounce* testado com `mock.timers` do `node:test`.

**Sintaxe que vais praticar:** `Math.imul` e `>>>`, troca com desestruturação, `clearTimeout`/`setTimeout`, uma função com uma propriedade (`adiada.cancelar = ...`).

<details>
<summary>Pista</summary>

No *debounce*, guarda o temporizador numa variável fora da função devolvida (uma *closure*). Cada chamada faz `clearTimeout` do anterior antes de agendar o novo; `clearTimeout(undefined)` não faz mal.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P4 · Testes deterministas: aleatoriedade com semente e tempo controlado (o remédio para os
// testes "flaky", que às vezes passam e às vezes não).

// mulberry32(semente) → uma função () → número em [0, 1), sempre a mesma sequência para a mesma
//   semente (um gerador pseudoaleatório pequeno e rápido; NÃO serve para criptografia).
//   O algoritmo, com a = semente >>> 0, a cada chamada:
//     a = (a + 0x6d2b79f5) >>> 0
//     t = Math.imul(a ^ (a >>> 15), a | 1)
//     t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
//     devolve ((t ^ (t >>> 14)) >>> 0) / 4294967296
export function mulberry32(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// baralhar(lista, aleatorio = Math.random) → uma lista NOVA baralhada (Fisher-Yates):
//   de i = n − 1 até 1: j = Math.floor(aleatorio() × (i + 1)); troca as posições i e j.
//   Recebe o gerador como parâmetro para os testes poderem passar um com semente.
export function baralhar(lista, aleatorio = Math.random) {
  const r = [...lista];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// adiar(fn, ms) → uma função "debounced": cada chamada cancela a anterior e agenda fn (com os
//   argumentos da ÚLTIMA chamada) para daqui a ms. Só corre quando as chamadas param durante ms
//   (ex.: pesquisar enquanto se escreve, só quando se pára de escrever).
//   A função devolvida tem também .cancelar(), que cancela o que estiver agendado.
export function adiar(fn, ms) {
  let temporizador;
  const adiada = (...args) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(...args), ms);
  };
  adiada.cancelar = () => clearTimeout(temporizador);
  return adiada;
}
```
</details>

## Experiências

1. **O encolhimento:** escreve uma propriedade que falha para listas com mais de 5 elementos (por exemplo, `(l) => l.length <= 5` com `fc.array(fc.integer())`), corre-a com `fc.assert` e lê a mensagem: que contraexemplo mostra? Corre outra vez com a `seed` que ela imprime.
2. **Propriedades no módulo 30:** testa a tua pesquisa binária ou o teu *heap* do módulo 30 comparando-os com um modelo simples (`indexOf`, `sort`).
3. **O Stryker a sério:** em `pratica/`, `npx stryker init` e depois `npx stryker run` com um dos teus módulos (por exemplo o 45). Abre o relatório HTML e olha para os mutantes sobreviventes: são testes em falta, ou mutantes equivalentes?
4. **Um teste instável de propósito:** escreve um teste que usa `setTimeout` de 50 ms e espera 60 ms com uma `Promise`, e corre-o 100 vezes com a máquina ocupada (por exemplo, com `node --test --test-concurrency=16` noutros testes). Depois reescreve-o com `mock.timers`.

## Perguntas de pensamento crítico

1. Que propriedades escreverias para uma função que ordena tarefas por prazo? E porque é que "o resultado está ordenado" não chega?
2. Uma equipa tem 95% de cobertura e uma pontuação de mutação de 40%. O que é que isto diz sobre os testes?
3. Quais são as vantagens dos testes de contrato em relação a um ambiente de testes de ponta a ponta com todos os serviços, e o que é que eles não apanham?

<details>
<summary>Respostas</summary>

1. Que o resultado está ordenado por prazo; que tem os mesmos elementos que a entrada (o mesmo tamanho e as mesmas tarefas, nem uma a mais nem a menos); que é estável (tarefas com o mesmo prazo mantêm a ordem original); que ordenar duas vezes dá o mesmo (idempotência); e que não muda a lista original. "Está ordenado" sozinho deixa passar uma função que devolve sempre `[]`, ou que perde ou duplica tarefas: é uma propriedade fraca.
2. Que o código é executado pelos testes, mas a maior parte das linhas executadas não é **verificada**: há testes que chamam as funções sem confirmar os resultados com detalhe (ou só o caso feliz), por isso mudanças no código (operadores, condições, valores devolvidos) não são detetadas. A cobertura mede o que corre; a mutação mede o que é verificado. Os mutantes sobreviventes mostram exatamente onde faltam asserções.
3. São rápidos e correm em cada serviço isoladamente, sem um ambiente partilhado e frágil; a falha aparece no *pull request* de quem parte o contrato, e diz exatamente que campo de que consumidor; e cada equipa pode fazer deploy de forma independente, perguntando se parte algum consumidor. O que não apanham: problemas que só aparecem com tudo junto (configuração, rede, autenticação entre serviços, desempenho), comportamento que não está no contrato (efeitos secundários, o que acontece depois de um `POST`), e erros nos próprios contratos (se o consumidor escrever no contrato uma coisa que não usa como diz).
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 58`.

**1.** O que faz o fast-check quando encontra uma entrada que parte uma propriedade?

- a) Para e mostra a primeira entrada aleatória
- b) Encolhe a entrada até ao exemplo mínimo que ainda falha, e mostra a semente
- c) Ignora e continua
- d) Corre o teste de novo até passar

<details><summary>Resposta</summary>

**b) Encolhe a entrada até ao exemplo mínimo que ainda falha, e mostra a semente** — O shrinking dá um contraexemplo pequeno e compreensível; a semente permite reproduzi-lo.

</details>

**2.** Num teste de contrato orientado pelo consumidor, quem escreve o contrato?

- a) O fornecedor (a API)
- b) O consumidor (ex.: o frontend), com o que realmente usa
- c) Uma terceira equipa de QA
- d) É gerado a partir do OpenAPI

<details><summary>Resposta</summary>

**b) O consumidor (ex.: o frontend), com o que realmente usa** — O fornecedor depois verifica, nos seus testes, que cumpre todos os contratos.

</details>

**3.** Num teste de mutação, como se chama um mutante que os testes não detetam (os testes continuam a passar)?

<details><summary>Resposta</summary>

**sobrevivente** — Mostra uma zona do código cujo comportamento nenhum teste verifica.

</details>

**4.** Num max(a, b) com 'a > b ? a : b', o mutante 'a >= b' sobrevive a todos os testes. Porquê?

- a) Os testes são fracos
- b) É um mutante equivalente: muda o código sem mudar o comportamento
- c) O Stryker tem um bug
- d) Porque a e b são números

<details><summary>Resposta</summary>

**b) É um mutante equivalente: muda o código sem mudar o comportamento** — Por isso não se persegue uma pontuação de 100%.

</details>

**5.** Qual é a melhor forma de testar código que usa setTimeout de 5 segundos?

- a) Esperar 5 segundos no teste
- b) Usar um relógio falso (ex.: mock.timers no node:test) e avançar o tempo
- c) Reduzir o tempo para 1 ms em produção
- d) Não testar

<details><summary>Resposta</summary>

**b) Usar um relógio falso (ex.: mock.timers no node:test) e avançar o tempo** — O teste fica instantâneo e determinista.

</details>

<!-- quiz:end -->
