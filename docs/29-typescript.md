# 29 · TypeScript a sério

**Objetivo:** ir além das anotações básicas do módulo 07 e usar o sistema de tipos para tornar erros **impossíveis de escrever**: genéricos com restrições, `keyof` e tipos mapeados, tipos condicionais, *template literal types*, uniões discriminadas com verificação exaustiva, *type guards* e asserções, tipos com marca, `satisfies`, e tipos inferidos de esquemas de validação. No fim, migras um ficheiro JavaScript com dois bugs que os tipos teriam apanhado.

**Ficheiros para ler:** `src/worker/src/*.ts` e `src/worker/tsconfig.json` (o worker deste projeto, em TypeScript estrito), e a secção de TypeScript do módulo 22.

**Pré-requisitos:** módulos 07 e 22.

---

## 1. Para que servem os tipos

Os tipos não tornam o código mais rápido nem mudam o que ele faz: o TypeScript é apagado antes de correr. Servem para três coisas:

1. **Apanhar erros antes de correr:** `t.lenght`, `t.etiqueta` em vez de `t.etiquetas`, uma função chamada com os argumentos trocados. O P4 tem um ficheiro com dois destes, que estão no código há meses.
2. **Documentação que não fica desatualizada:** a assinatura `function escolher<T, K extends keyof T>(obj: T, chaves: K[]): Pick<T, K>` diz mais do que um comentário, e o compilador garante que é verdade.
3. **Mudar com confiança:** renomeia um campo e o compilador mostra todos os sítios que partiram. Num projeto grande, é a diferença entre um *refactor* de uma tarde e um de uma semana com medo.

O objetivo de um bom tipo não é descrever o que o código faz, é **excluir o que não pode acontecer**. Um estado de um pedido com `carregando: boolean; dados?: T; erro?: string` permite combinações impossíveis (`carregando: true` e `erro` ao mesmo tempo). Uma união discriminada (§4) não permite.

## 2. Genéricos

Um genérico é um tipo que é um parâmetro, como um argumento de uma função, mas para tipos:

```ts
function primeiro<T>(lista: readonly T[]): T | undefined {
  return lista[0];
}
primeiro([1, 2, 3]);      // T = number → devolve number | undefined
primeiro(['a', 'b']);     // T = string
```

O compilador **infere** o `T` a partir dos argumentos: quase nunca o escreves à mão ao chamar. As **restrições** (`extends`) limitam o que o `T` pode ser:

```ts
function escolher<T, K extends keyof T>(obj: T, chaves: readonly K[]): Pick<T, K> { ... }
escolher(tarefa, ['id', 'titulo']);    // ok: o resultado é { id: number; titulo: string }
escolher(tarefa, ['prioridade']);      // erro: "prioridade" não é uma chave de Tarefa
```

| Ferramenta | O que dá |
|---|---|
| `keyof T` | a união das chaves de T: `'id' \| 'titulo' \| 'feita'` |
| `T[K]` | o tipo do valor da chave K (*indexed access*) |
| `typeof x` | o tipo de uma variável (no sítio de um tipo) |
| `Pick<T, K>`, `Omit<T, K>` | T só com, ou sem, essas chaves |
| `Partial<T>`, `Required<T>`, `Readonly<T>` | todas opcionais, obrigatórias, ou só de leitura |
| `Record<K, V>` | um objeto com chaves K e valores V |
| `ReturnType<F>`, `Parameters<F>`, `Awaited<P>` | o que uma função devolve, recebe, ou o que uma Promise resolve |
| `NonNullable<T>` | T sem `null` e `undefined` |

## 3. Estreitar: type guards e asserções

O compilador acompanha o que o código já verificou, e **estreita** o tipo (*narrowing*):

```ts
function tamanho(x: string | string[]) {
  if (typeof x === 'string') return x.length;   // aqui x é string
  return x.length;                               // aqui x é string[]
}
```

Funciona com `typeof`, `instanceof`, `in`, comparações com literais, e com funções tuas que digam ao compilador o que verificaram:

```ts
// type guard: "se devolver true, x é uma Tarefa"
function eTarefa(x: unknown): x is Tarefa {
  return typeof x === 'object' && x !== null && 'titulo' in x;
}

// assertion function: "se não lançar, x é uma string"
function afirmarTexto(x: unknown): asserts x is string {
  if (typeof x !== 'string') throw new Error('não é texto');
}
```

Usa `unknown` (e não `any`) para tudo o que vem de fora (JSON, pedidos, ficheiros): o `unknown` obriga-te a verificar antes de usar; o `any` desliga o compilador, e o erro aparece em produção.

## 4. Uniões discriminadas e verificação exaustiva

```ts
type EstadoPedido<T> =
  | { tipo: 'inativo' }
  | { tipo: 'a_carregar' }
  | { tipo: 'sucesso'; dados: T }
  | { tipo: 'erro'; mensagem: string };
```

Cada variante tem um campo comum com um valor literal diferente (o "discriminante", aqui o `tipo`). Depois de um `if (e.tipo === 'sucesso')`, o compilador sabe que `e.dados` existe. E um estado de sucesso sem dados, ou com dados e um erro ao mesmo tempo, nem sequer se consegue escrever.

A **verificação exaustiva** garante que todos os casos são tratados:

```ts
function nunca(x: never): never {
  throw new Error(`valor inesperado: ${JSON.stringify(x)}`);
}

switch (estado.tipo) {
  case 'inativo': return '';
  case 'a_carregar': return 'A carregar…';
  case 'sucesso': return `${estado.dados.length} resultados`;
  case 'erro': return `Erro: ${estado.mensagem}`;
  default: return nunca(estado);   // estado é never aqui... se todos os casos estiverem tratados
}
```

Se alguém acrescentar `{ tipo: 'cancelado' }` ao tipo, este `switch` deixa de compilar, e o compilador mostra todos os sítios a atualizar. É o padrão dos *reducers* do React e dos eventos do worker (módulo 07).

## 5. Tipos mapeados, condicionais e template literals

**Mapeados:** um tipo novo a partir das chaves de outro.

```ts
type Opcoes<T> = { [K in keyof T]?: T[K] };                 // é o Partial<T>
type Validadores<T> = { [K in keyof T]: (v: T[K]) => boolean };
```

**Condicionais:** `A extends B ? X : Y`, um "if" para tipos. Juntando os dois, constroem-se tipos como "as chaves de T cujo valor é uma string":

```ts
type ChavesDoTipo<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T];
```

E podem ser recursivos (o `ParcialProfundo` do P3). Com o `infer`, extraem partes de outros tipos: `type Elemento<T> = T extends (infer E)[] ? E : never`.

**Template literal types:** tipos de texto com forma.

```ts
type Rota = `/api/${string}`;
type Endpoint = `${'GET' | 'POST'} ${Rota}`;   // 'GET /api/tarefas' é válido; 'FETCH /x' não
```

Uma palavra de cautela: tipos muito complicados tornam as mensagens de erro ilegíveis e o compilador lento. Usa-os em bibliotecas e nos sítios onde evitam bugs reais, não por desporto.

## 6. Tipos com marca

Para o TypeScript, um `number` é um `number`: nada impede `apagarTarefa(idDoUtilizador)`. Um **tipo com marca** (*branded type*) cria um tipo distinto, sem custo em tempo de execução:

```ts
type IdTarefa = number & { readonly __marca: 'IdTarefa' };

function idTarefa(n: number): IdTarefa {      // a única porta de entrada: valida e marca
  if (!Number.isInteger(n) || n < 1) throw new Error('id inválido');
  return n as IdTarefa;
}

function apagarTarefa(id: IdTarefa) { ... }
apagarTarefa(7);              // erro: um number não é um IdTarefa
apagarTarefa(idTarefa(7));    // ok
```

Também serve para valores validados: um `EmailValido`, um `HtmlEscapado` (o XSS do módulo 26, impedido pelos tipos).

## 7. `satisfies` e `as const`

```ts
const LIMITES = {
  maxTitulo: 200,
  etiquetasPermitidas: ['casa', 'trabalho', 'estudo'],
} as const satisfies { maxTitulo: number; etiquetasPermitidas: readonly string[] };

type Etiqueta = (typeof LIMITES.etiquetasPermitidas)[number];   // 'casa' | 'trabalho' | 'estudo'
```

- **`as const`** mantém os valores **literais** e torna tudo `readonly`: o tipo do `maxTitulo` é `200`, não `number`.
- **`satisfies`** verifica que o objeto cumpre um tipo, **sem** o alargar para esse tipo (uma anotação `: Config` alargava, e perdias os literais).
- E o tipo `Etiqueta` é **derivado** dos dados: acrescentar uma etiqueta à lista atualiza o tipo. Uma só fonte de verdade.

## 8. Validar o que vem de fora: tipos inferidos de esquemas

Os tipos desaparecem quando o código corre. Um `JSON.parse(texto) as Tarefa[]` não verifica nada: é uma promessa ao compilador que ninguém cumpre. Nas fronteiras (pedidos HTTP, mensagens, ficheiros, variáveis de ambiente), valida-se em tempo de execução, e o tipo é **inferido do esquema**, para não se escreverem as mesmas regras duas vezes:

```ts
import { z } from 'zod';

const EsquemaTarefa = z.object({ id: z.number().int().positive(), titulo: z.string().min(1) });
type Tarefa = z.infer<typeof EsquemaTarefa>;     // { id: number; titulo: string }

const tarefa = EsquemaTarefa.parse(JSON.parse(texto));   // lança se não cumprir; tarefa é Tarefa
```

É o que a API faz com o Zod (módulo 04). O mesmo existe noutras linguagens: o Pydantic em Python (o DRF do módulo 31 é parecido), as *data annotations* em C#.

## 9. Migrar JavaScript para TypeScript

Num projeto real, a migração faz-se aos poucos:

1. `allowJs` no `tsconfig`, para JS e TS conviverem; renomear ficheiro a ficheiro, das folhas (sem dependências) para o centro.
2. Começar com `strict: false` se for preciso, e apertar as regras aos poucos, até `strict: true`.
3. Tipar primeiro as **fronteiras** (o que entra e sai de cada módulo); o interior infere-se.
4. `// @ts-expect-error` com um comentário, em vez de `any`, para os casos que ficam para depois: quando o erro desaparecer, o compilador avisa que o comentário já não é preciso.

Opções do `tsconfig` que vale a pena ligar num projeto novo (estão todas no desta prática): `strict`, `noUncheckedIndexedAccess` (um `lista[0]` pode ser `undefined`, e o compilador obriga-te a tratar isso), `exactOptionalPropertyTypes` e `noImplicitReturns`.

## Em resumo

- Os tipos são documentação que o compilador verifica; **desaparecem ao compilar** e não validam nada em *runtime*.
- **Genéricos** escrevem código que funciona para vários tipos sem perder informação (`T` em vez de `any`).
- O compilador **estreita** os tipos a partir das verificações (`typeof`, `in`, *type guards*); as asserções (`as`) só calam o compilador.
- **Uniões discriminadas** com um campo comum (`tipo`) e um `never` no fim do `switch` tornam impossível esquecer um caso.
- Tipos mapeados, condicionais e *template literals* derivam tipos a partir de outros; tipos com **marca** distinguem valores com a mesma forma (um `IdUtilizador` não é um `IdTarefa`).
- `satisfies` confirma uma forma sem perder o tipo exato; `as const` congela literais.
- O que vem de fora **valida-se** com um esquema (zod) e o tipo **infere-se** dele: uma só fonte de verdade.
- Migra-se JavaScript para TypeScript aos poucos, ficheiro a ficheiro, apertando o `strict` com o tempo.

---

## Prática: escreve tu

Quatro ficheiros em TypeScript estrito. Os testes têm duas camadas: primeiro o **compilador** verifica os testes de tipos (asserções `esperar<Igual<A, B>>()` e linhas com `@ts-expect-error`, que têm de dar erro), e só depois correm os testes normais. Se a tua assinatura estiver errada, o compilador para tudo antes de correr, e a mensagem diz-te o ficheiro e a linha.

**Ficheiros:** `pratica/29-typescript/` (`genericos.ts`, `estados.ts`, `tiposAvancados.ts`, `migrado.ts`). Lê também o `legado.js`, o ficheiro a migrar no P4.

**Verificar:** `npm run verificar 29` (dentro de `pratica/`). Só um exercício: `npm run verificar 29 genericos`, `... 29 estados`, `... 29 tipos` ou `... 29 migrado`.

**Como ler os erros de tipos dos testes:** `Type 'false' does not satisfy the constraint 'true'` numa linha `esperar<Igual<...>>()` quer dizer que o tipo que produziste não é exatamente o esperado: passa o rato por cima no editor para veres o que é. `Unused '@ts-expect-error' directive` quer dizer que uma linha que **devia** dar erro (porque o código é inválido) compila: o teu tipo é demasiado permissivo.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Genéricos (≈30 min)

**Ficheiro:** `genericos.ts`

Quatro funções em que a parte difícil é a **assinatura**: agrupar, escolher chaves (só as que existem), tirar os nulos (com o tipo do resultado sem eles), e mapear os valores de um objeto mantendo as chaves.

**Sintaxe que vais praticar:** `<T, K extends PropertyKey>`, `K extends keyof T`, `Pick<T, K>`, `Partial<Record<K, V>>`, `readonly T[]`, o type guard `(x): x is T =>`, um tipo mapeado `{ [K in keyof T]: R }`, `??=`.

<details>
<summary>Pista</summary>

No `semNulos`, um `filter((x) => x !== null)` normal devolve o mesmo tipo da lista: o compilador não percebe o que o filtro fez. Com um *type guard* como função do filtro, `(x): x is T => ...`, percebe. No `mapearValores`, `Object.keys` devolve `string[]` (porque um objeto pode ter mais chaves do que o tipo diz); um `as (keyof T)[]` diz ao compilador o que tu sabes.
</details>

<details>
<summary>Solução de referência</summary>

```ts
export function agruparPor<T, K extends PropertyKey>(itens: readonly T[], chave: (item: T) => K): Partial<Record<K, T[]>> {
  const grupos: Partial<Record<K, T[]>> = {};
  for (const item of itens) {
    const k = chave(item);
    (grupos[k] ??= []).push(item);
  }
  return grupos;
}

// K extends keyof T: só se aceitam chaves que existem em T (e o resultado sabe quais foram).
export function escolher<T, K extends keyof T>(obj: T, chaves: readonly K[]): Pick<T, K> {
  const resultado = {} as Pick<T, K>;
  for (const k of chaves) resultado[k] = obj[k];
  return resultado;
}

// O "x is T" no filtro é um type guard: diz ao compilador o que sobra depois do filtro.
export function semNulos<T>(lista: readonly (T | null | undefined)[]): T[] {
  return lista.filter((x): x is T => x !== null && x !== undefined);
}

export function mapearValores<T extends object, R>(obj: T, fn: (valor: T[keyof T]) => R): { [K in keyof T]: R } {
  const resultado = {} as { [K in keyof T]: R };
  for (const k of Object.keys(obj) as (keyof T)[]) resultado[k] = fn(obj[k]);
  return resultado;
}
```
</details>

### P2 · Uniões discriminadas (≈25 min)

**Ficheiro:** `estados.ts`

O estado de um pedido e as ações que o mudam, como uniões discriminadas, um *reducer*, e uma descrição para o ecrã, ambos com verificação exaustiva.

**Sintaxe que vais praticar:** uniões de objetos com um discriminante literal, `switch` com estreitamento, `never` e uma função `nunca(x: never): never`, tipos genéricos (`EstadoPedido<T>`).

<details>
<summary>Solução de referência</summary>

```ts
export type EstadoPedido<T> =
  | { tipo: 'inativo' }
  | { tipo: 'a_carregar' }
  | { tipo: 'sucesso'; dados: T }
  | { tipo: 'erro'; mensagem: string };

export type Acao<T> =
  | { tipo: 'pedir' }
  | { tipo: 'recebido'; dados: T }
  | { tipo: 'falhou'; mensagem: string }
  | { tipo: 'repor' };

export function reduzir<T>(estado: EstadoPedido<T>, acao: Acao<T>): EstadoPedido<T> {
  switch (acao.tipo) {
    case 'pedir':
      return { tipo: 'a_carregar' };
    case 'recebido':
      return { tipo: 'sucesso', dados: acao.dados }; // aqui, o compilador sabe que acao tem dados
    case 'falhou':
      return { tipo: 'erro', mensagem: acao.mensagem };
    case 'repor':
      return { tipo: 'inativo' };
    default:
      // Se todos os casos foram tratados, acao é "never" aqui. Um caso novo esquecido não compila.
      return nunca(acao);
  }
}

export function descrever(estado: EstadoPedido<unknown[]>): string {
  switch (estado.tipo) {
    case 'inativo':
      return '';
    case 'a_carregar':
      return 'A carregar…';
    case 'sucesso':
      return estado.dados.length === 1 ? '1 resultado' : `${estado.dados.length} resultados`;
    case 'erro':
      return `Erro: ${estado.mensagem}`;
    default:
      return nunca(estado);
  }
}

export function nunca(x: never): never {
  throw new Error(`valor inesperado: ${JSON.stringify(x)}`);
}
```
</details>

### P3 · Tipos avançados (≈35 min)

**Ficheiro:** `tiposAvancados.ts`

Um `Partial` recursivo, as chaves de um certo tipo, rotas e endpoints com *template literal types*, um id com marca (com a função que é a única forma de o criar), e uma *assertion function*.

**Sintaxe que vais praticar:** tipos condicionais (`A extends B ? X : Y`) encaixados e recursivos, `{ [K in keyof T]: ... }[keyof T]`, `` `${A} ${B}` ``, interseções (`number & { ... }`), `asserts x is string`.

<details>
<summary>Pista</summary>

No `ParcialProfundo`, a ordem das perguntas importa: um array **também** "extends object", por isso pergunta primeiro se é um array (ou uma função), e só depois se é um objeto. No `ChavesDoTipo`, constrói primeiro um objeto em que cada chave tem como valor ela própria ou `never`, e depois indexa-o com `[keyof T]`: os `never` desaparecem da união.
</details>

<details>
<summary>Solução de referência</summary>

```ts
// Condicional e recursivo: para cada propriedade, se for um array ou uma função, fica como está;
// se for um objeto, aplica-se outra vez; senão, fica igual. E o "?" torna-as todas opcionais.
export type ParcialProfundo<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] | ((...args: never[]) => unknown)
    ? T[K]
    : T[K] extends object
      ? ParcialProfundo<T[K]>
      : T[K];
};

// Para cada chave K, "K se o valor for V, senão never"; o [keyof T] no fim junta os K que sobraram.
export type ChavesDoTipo<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T];

export type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type Rota = `/api/${string}`;
export type Endpoint = `${Metodo} ${Rota}`;

// A marca só existe para o compilador: em tempo de execução, um IdTarefa é só um número.
export type IdTarefa = number & { readonly __marca: 'IdTarefa' };

export function idTarefa(n: number): IdTarefa {
  if (!Number.isInteger(n) || n < 1) throw new Error(`id de tarefa inválido: ${n}`);
  return n as IdTarefa; // o único "as" do módulo: é aqui que se garante que a marca é verdadeira
}

export function afirmarTexto(x: unknown): asserts x is string {
  if (typeof x !== 'string') throw new Error(`esperava texto, veio ${typeof x}`);
}
```
</details>

### P4 · Migrar o legado (≈30 min)

**Ficheiro:** `migrado.ts` (a partir do `legado.js`)

O `legado.js` lê tarefas que vêm de fora (em inglês) e faz um resumo. Tem dois bugs que ninguém viu: um `.lenght` e um `.etiqueta` (em vez de `.etiquetas`). Reescreve-o em TypeScript, com um esquema Zod que valida e transforma os dados de fora, o tipo `Tarefa` **inferido** do esquema, e uma configuração com `satisfies` da qual se deriva o tipo das etiquetas. Os testes mostram também o legado a rebentar com os mesmos dados.

**Sintaxe que vais praticar:** `z.object`, `.int().positive()`, `.min(1)`, `.default([])`, `.transform(...)`, `z.output<typeof X>`, `z.array(X).parse`, `as const satisfies`, `(typeof X)[number]`.

<details>
<summary>Pista</summary>

Com um `.transform`, o esquema tem dois tipos: o da entrada (o que vem de fora) e o da saída (o que a transformação devolve). O `z.output` (ou `z.infer`, que é o mesmo) dá o da saída, que é a `Tarefa`. O `as const` vem **antes** do `satisfies`.
</details>

<details>
<summary>Solução de referência</summary>

```ts
import { z } from 'zod';

// Os dados de fora (em inglês), validados e transformados na forma de dentro.
export const EsquemaTarefaExterna = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(1),
    done: z.boolean(),
    tags: z.array(z.string()).default([]),
  })
  .transform((t) => ({ id: t.id, titulo: t.title, feita: t.done, etiquetas: t.tags }));

// z.output: o tipo DEPOIS da transformação. O tipo vem do esquema: mudar um muda o outro.
export type Tarefa = z.output<typeof EsquemaTarefaExterna>;

export function lerTarefas(json: string): Tarefa[] {
  let dados: unknown;
  try {
    dados = JSON.parse(json);
  } catch {
    throw new Error('JSON inválido');
  }
  return z.array(EsquemaTarefaExterna).parse(dados); // lança um ZodError se não cumprir
}

export function resumir(tarefas: readonly Tarefa[]): { total: number; feitas: number; porEtiqueta: Record<string, number> } {
  const porEtiqueta: Record<string, number> = {};
  for (const t of tarefas) {
    for (const e of t.etiquetas) porEtiqueta[e] = (porEtiqueta[e] ?? 0) + 1;
  }
  return { total: tarefas.length, feitas: tarefas.filter((t) => t.feita).length, porEtiqueta };
}

// "satisfies": verifica a forma sem perder os tipos exatos (o "as const" mantém os literais).
export const LIMITES = {
  maxTitulo: 200,
  etiquetasPermitidas: ['casa', 'trabalho', 'estudo'],
} as const satisfies { maxTitulo: number; etiquetasPermitidas: readonly string[] };

export type Etiqueta = (typeof LIMITES.etiquetasPermitidas)[number];
```
</details>

## Experiências

1. **Os dois bugs, apanhados:** copia o `legado.js` para `legado-tipado.ts`, acrescenta só os tipos dos parâmetros (`tarefas: Tarefa[]`, com o tipo do P4) e corre `npx tsc --noEmit -p .` dentro da pasta. Em que linhas aparecem os erros?
2. **Um caso novo esquecido:** no `estados.ts`, acrescenta `| { tipo: 'cancelado' }` ao `EstadoPedido`. Onde é que o compilador se queixa? Agora tira o `default: return nunca(...)` do `descrever` e repete: ainda se queixa?
3. **`noUncheckedIndexedAccess`:** escreve `const primeira = tarefas[0]; primeira.titulo;` e vê o erro. Desliga a opção no `tsconfig.json` e repete. Qual das duas versões te protege de uma lista vazia?
4. **`satisfies` contra uma anotação:** no P4, troca o `as const satisfies {...}` por uma anotação `const LIMITES: { maxTitulo: number; etiquetasPermitidas: readonly string[] } = {...}`. O que acontece ao tipo `Etiqueta`?

## Perguntas de pensamento crítico

1. Um colega usa `as Tarefa` sempre que o compilador se queixa, "porque sabe que está certo". Que problemas isso cria, e o que propões?
2. Porque é que os tipos do TypeScript não chegam para validar o corpo de um pedido HTTP?
3. Até onde vale a pena ir com tipos avançados? Dá um exemplo de onde compensam e outro de onde não.

<details>
<summary>Respostas</summary>

1. Um `as` não verifica nada: diz ao compilador "confia em mim", e desliga a única proteção que ele dava naquele sítio. Se os dados mudarem (um campo renomeado no servidor), o erro passa a aparecer em produção, longe da causa. A alternativa: perceber porque é que o compilador se queixa (muitas vezes é um caso real, como um `undefined`), estreitar o tipo com uma verificação ou um *type guard*, e, para dados de fora, validar com um esquema. O `as` fica para os poucos sítios onde tu garantes mesmo a verdade, como a função que cria um tipo com marca.
2. Porque os tipos são apagados antes de o código correr: em tempo de execução, o corpo é o que o cliente enviou, seja ele o que for. Um `req.body as NovaTarefa` não impede que chegue `{ "titulo": 42 }`. É preciso validar em tempo de execução (Zod, Pydantic...), e é bom que o tipo seja inferido do esquema, para as duas coisas não divergirem.
3. Compensam onde evitam bugs reais e frequentes, ou onde muita gente usa o código: uma biblioteca de rotas que garante que os parâmetros do URL existem, ids com marca num sistema com muitos tipos de ids, uniões discriminadas para estados. Não compensam quando o tipo fica mais difícil de perceber do que o bug que evita, quando as mensagens de erro ficam ilegíveis para a equipa, ou em código interno simples, que um teste cobre melhor.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 29`.

**1.** Para dados que vêm de fora (JSON, pedidos), que tipo se deve usar antes de os validar?

- a) any
- b) unknown: obriga a verificar antes de usar
- c) object
- d) never

<details><summary>Resposta</summary>

**b) unknown: obriga a verificar antes de usar** — O any desliga o compilador; o unknown obriga a estreitar (com typeof, type guards ou um esquema) antes de usar.

</details>

**2.** Para que serve a função nunca(x: never) no default de um switch sobre uma união discriminada?

- a) Para o código correr mais depressa
- b) Para o código deixar de compilar se alguém acrescentar um caso à união e se esquecer de o tratar
- c) Para apanhar exceções
- d) Para converter tipos

<details><summary>Resposta</summary>

**b) Para o código deixar de compilar se alguém acrescentar um caso à união e se esquecer de o tratar** — Se todos os casos forem tratados, o valor é never no default; um caso novo esquecido torna-o num tipo que não é never.

</details>

**3.** Qual é a diferença entre 'satisfies' e uma anotação de tipo (const x: T = ...)?

- a) Nenhuma
- b) satisfies verifica que o valor cumpre T sem o alargar para T, mantendo os tipos exatos (ex.: literais)
- c) satisfies não verifica nada
- d) A anotação é mais segura

<details><summary>Resposta</summary>

**b) satisfies verifica que o valor cumpre T sem o alargar para T, mantendo os tipos exatos (ex.: literais)** — Com a anotação, o tipo passa a ser T e perdem-se os literais; com satisfies, verifica-se e mantém-se o tipo exato.

</details>

**4.** Que operador de tipos dá a união das chaves de um tipo T?

<details><summary>Resposta</summary>

**keyof** — Usado em restrições como K extends keyof T e em tipos mapeados [K in keyof T].

</details>

**5.** Porque é que 'JSON.parse(texto) as Tarefa[]' não protege de nada?

- a) Porque o JSON.parse é lento
- b) Porque o 'as' só fala com o compilador: em tempo de execução não se verifica nada, e os tipos já foram apagados
- c) Porque falta um await
- d) Porque devia ser 'as const'

<details><summary>Resposta</summary>

**b) Porque o 'as' só fala com o compilador: em tempo de execução não se verifica nada, e os tipos já foram apagados** — Nas fronteiras valida-se em tempo de execução (Zod), com o tipo inferido do esquema.

</details>

<!-- quiz:end -->
