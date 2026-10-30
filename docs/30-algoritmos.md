# 30 · Algoritmos e estruturas de dados (para entrevistas)

**Objetivo:** dominar o essencial que as entrevistas técnicas pedem: a notação O grande, as estruturas de dados certas para cada problema, e os padrões que resolvem a maior parte dos exercícios (mapas de hash, dois ponteiros, janelas deslizantes, pilhas, pesquisa binária, heaps, grafos e programação dinâmica).

**Ficheiros para ler:** nenhum do projeto. É um módulo de treino.

**Pré-requisitos:** JavaScript (módulo 22).

---

## 1. Porque é que as empresas pedem isto

Muitas empresas, sobretudo as grandes e as que contratam muita gente, filtram candidatos com problemas de algoritmos: 45 minutos, um editor partilhado, um enunciado como "dado um array, encontra os dois números que somam X". Podes achar que não reflete o trabalho do dia a dia, e em parte tens razão. Mas o que se avalia é transferível: se partes um problema em passos, se pensas no custo do que escreves, se testas os casos de canto, e se explicas o teu raciocínio em voz alta.

E há uma parte que aparece mesmo no trabalho: saber que um `includes` dentro de um `for` sobre 100 000 elementos são 10 mil milhões de operações, e que um `Set` resolve o mesmo em 100 000.

## 2. O grande: quanto cresce o custo

A notação **O grande** descreve como o tempo (ou a memória) cresce quando a entrada cresce, ignorando constantes:

| Complexidade | Nome | Exemplo | n = 1 000 000 |
|---|---|---|---|
| O(1) | constante | `map.get(k)`, `arr[i]` | 1 operação |
| O(log n) | logarítmica | pesquisa binária | 20 |
| O(n) | linear | percorrer um array uma vez | 1 milhão |
| O(n log n) | | ordenar bem (`arr.sort`) | 20 milhões |
| O(n²) | quadrática | um `for` dentro de outro `for` | 1 bilião: minutos |
| O(2ⁿ) | exponencial | todas as combinações | impossível |

Duas regras práticas: um ciclo sobre a entrada é O(n); um ciclo dentro de outro, ambos sobre a entrada, é O(n²). E cuidado com o custo escondido nos métodos: `arr.includes(x)`, `arr.indexOf(x)`, `arr.shift()` e `str.slice()` são O(n), por isso, dentro de um ciclo, transformam um O(n) num O(n²).

Para entradas pequenas, nada disto importa. Para 100 000 elementos, é a diferença entre 1 milissegundo e 10 segundos. Os testes desta prática usam entradas desse tamanho, com limites de tempo, para te mostrarem a diferença.

## 3. As estruturas de dados, e quando usar cada uma

| Estrutura | Em JavaScript | Bom para | Custo |
|---|---|---|---|
| Array | `[]` | acesso por índice, percorrer, acrescentar no fim | `arr[i]` e `push` O(1); procurar O(n); inserir no início O(n) |
| Mapa de hash | `Map` (ou um objeto) | "já vi isto?", contar, agrupar, indexar por chave | inserir, procurar e apagar O(1) em média |
| Conjunto | `Set` | pertença, remover duplicados | O(1) em média |
| Pilha | array com `push`/`pop` | o último a entrar é o primeiro a sair: parênteses, desfazer, DFS | O(1) |
| Fila | array com um índice a avançar (ou uma lista ligada) | o primeiro a entrar é o primeiro a sair: BFS, tarefas | O(1) (o `shift()` de um array é O(n)!) |
| Heap | não há nativo: escreve-se (P4) | "dá-me sempre o menor": prioridades, os k maiores, Dijkstra | inserir e extrair O(log n) |
| Árvore de pesquisa | não há nativo | dados ordenados com inserções | O(log n), se equilibrada |
| Grafo | `Map` de nó → lista de vizinhos | redes, dependências, caminhos | depende do algoritmo |

O mapa de hash é a ferramenta mais útil de todas. Quando a solução óbvia tem dois ciclos encaixados, a pergunta a fazer é quase sempre: "e se eu guardar o que já vi num `Map`?".

Duas armadilhas do JavaScript que custam entrevistas:

- `[10, 9, 1].sort()` dá `[1, 10, 9]`: sem função de comparação, o `sort` compara como **texto**. Para números: `sort((a, b) => a - b)`.
- Um objeto como mapa converte as chaves para strings (`obj[1]` e `obj["1"]` são a mesma), e tem chaves herdadas (`"constructor"`). Prefere o `Map`.

## 4. Os padrões que resolvem a maior parte dos problemas

| Padrão | Sinal no enunciado | Exercício |
|---|---|---|
| **Mapa de hash** | "encontra um par", "já apareceu?", "agrupa", "conta" | P1 |
| **Dois ponteiros** | array ordenado, palíndromos, "de fora para dentro" | P2 |
| **Janela deslizante** | "o maior/menor pedaço contíguo que...", "k elementos seguidos" | P2 |
| **Pilha** | parênteses, "o próximo maior", expressões, desfazer | P3 |
| **Pesquisa binária** | dados ordenados, "a primeira posição em que...", "o menor valor que funciona" | P4 |
| **Heap** | "os k maiores", "sempre o próximo mais urgente", juntar listas ordenadas | P4 |
| **BFS** | o caminho **mais curto** num grafo sem pesos, níveis | P5 |
| **DFS** | explorar tudo o que está ligado, componentes, ciclos | P5 |
| **Ordenação topológica** | dependências, ordem de compilação, pré-requisitos | P5 |
| **Dijkstra** | caminho mais curto com **custos** | P5 |
| **Programação dinâmica** | "de quantas formas", "o mínimo/máximo", e os subproblemas repetem-se | P6 |

## 5. Grafos em três parágrafos

Um grafo são **nós** ligados por **arestas**. Uma grelha é um grafo (cada célula liga às vizinhas); as dependências do `npm` são um grafo; uma rede social é um grafo.

**BFS** (busca em largura) usa uma **fila**: visita primeiro tudo o que está a 1 passo, depois a 2, e assim por diante. Por isso, a primeira vez que chega a um nó, chegou pelo caminho mais curto. **DFS** (busca em profundidade) usa uma **pilha** (ou recursão): vai o mais longe possível por um caminho antes de voltar atrás; serve para explorar tudo o que está ligado. Em ambos, marca os nós **visitados**, senão andas em círculos.

Quando as arestas têm custos diferentes, o BFS deixa de dar o caminho mais barato. O **Dijkstra** resolve-o com um heap: sai sempre o nó mais barato ainda por tratar. A **ordenação topológica** (o algoritmo de Kahn) ordena tarefas com dependências: começa pelas que não dependem de nada, e cada uma que termina liberta as que esperavam por ela. Se sobrarem tarefas que esperam umas pelas outras, há um ciclo. É o que um sistema de build, o `npm`, ou um pipeline de CI com `needs:` (módulo 20) fazem.

## 6. Programação dinâmica sem medo

Um problema é de **programação dinâmica** quando se pode partir em subproblemas mais pequenos **que se repetem**. A forma de chegar à solução:

1. Escreve a solução **recursiva**: "as formas de subir n degraus são as formas de subir n−1 (se o último passo foi de 1) mais as de n−2 (se foi de 2)".
2. Repara que a recursão calcula as mesmas coisas muitas vezes: `formas(90)` calcula `formas(50)` milhões de vezes. A recursão ingénua é O(2ⁿ).
3. **Guarda** os resultados (memoização, com um `Map`) ou calcula-os **de baixo para cima** numa tabela. Passa a O(n).

As perguntas que te levam à tabela: o que representa cada célula (`melhor[v]` = o menor número de moedas para fazer v)? Qual é o caso base (`melhor[0] = 0`)? Como se calcula uma célula a partir das anteriores?

## 7. Como abordar um problema numa entrevista

1. **Repete o problema por palavras tuas e faz perguntas.** O array pode ter negativos? Pode estar vazio? Há sempre solução?
2. **Faz um exemplo à mão**, pequeno, incluindo um caso de canto.
3. **Diz a solução de força bruta** e a sua complexidade, mesmo que seja má. Mostra que sabes resolver, e dá-te um ponto de partida.
4. **Otimiza:** onde está o trabalho repetido? Que estrutura de dados o elimina? (Muitas vezes, um `Map`.)
5. **Escreve o código**, a falar.
6. **Testa à mão** com o teu exemplo e com os casos de canto: vazio, um elemento, todos iguais, valores negativos.
7. **Diz a complexidade** final, de tempo e de memória.

Ficar calado 10 minutos a pensar é o erro mais comum. O entrevistador quer ouvir o raciocínio, e muitas vezes ajuda quando percebe onde estás preso.

---

## Prática: escreve tu

Dezoito funções e uma classe (o heap), em seis ficheiros: uma família de problemas por ficheiro. Além de verificarem as respostas (incluindo os casos de canto), alguns testes usam entradas grandes e um limite de tempo: uma solução O(n²) dá as respostas certas mas falha no tempo. Quando isso acontecer, a mensagem diz-te quanto demorou.

**Ficheiros:** `pratica/30-algoritmos/` (`hashmaps.js`, `janelas.js`, `pilhas.js`, `pesquisaEHeap.js`, `grafos.js`, `dinamica.js`)

**Verificar:** `npm run verificar 30` (dentro de `pratica/`). Só um exercício: `npm run verificar 30 hashmaps`, `... 30 janelas`, `... 30 pilhas`, `... 30 pesquisa`, `... 30 grafos` ou `... 30 dinamica`. O `grafos.js` usa o `MinHeap` do P4: faz o P4 primeiro.

Para treinares como numa entrevista: antes de escreveres cada função, diz em voz alta (ou escreve num comentário) a solução de força bruta e a sua complexidade, e só depois a melhor.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Mapas de hash (≈25 min)

**Ficheiro:** `hashmaps.js`

O padrão mais útil: guardar o que já viste para não teres de procurar outra vez.

**Sintaxe que vais praticar:** `Map` (`has`, `get`, `set`, `values`), espalhar uma string em caracteres (`[...p]`), `sort().join('')` como chave.

<details>
<summary>Pista</summary>

No `doisSomam`, em vez de procurares o par de cada número noutro ciclo, pergunta a um `Map` "já vi o número que me falta?". Nos anagramas, duas palavras são anagramas se, com as letras ordenadas, forem iguais: isso é uma chave.
</details>

<details>
<summary>Solução de referência</summary>

```js
export function doisSomam(nums, alvo) {
  const vistos = new Map(); // número → índice onde apareceu
  for (let i = 0; i < nums.length; i++) {
    const falta = alvo - nums[i];
    if (vistos.has(falta)) return [vistos.get(falta), i];
    vistos.set(nums[i], i);
  }
  return null;
}

export function agruparAnagramas(palavras) {
  // Duas palavras são anagramas se tiverem as mesmas letras ordenadas: essa é a chave do grupo.
  // Um Map lembra-se da ordem de inserção, por isso os grupos saem pela ordem de aparição.
  const grupos = new Map();
  for (const p of palavras) {
    const chave = [...p].sort().join('');
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(p);
  }
  return [...grupos.values()];
}

export function primeiroUnico(texto) {
  const contagem = new Map();
  for (const c of texto) contagem.set(c, (contagem.get(c) ?? 0) + 1);
  for (let i = 0; i < texto.length; i++) {
    if (contagem.get(texto[i]) === 1) return i;
  }
  return -1;
}
```
</details>

### P2 · Dois ponteiros e janelas (≈30 min)

**Ficheiro:** `janelas.js`

Três problemas que se resolvem percorrendo a entrada uma só vez, com dois índices que andam de forma coordenada.

**Sintaxe que vais praticar:** dois índices num `while`, regex com a flag `i`, um `Map` com a última posição de cada carácter, `Math.max`.

<details>
<summary>Pista</summary>

Na janela sem repetições, guarda a última posição onde viste cada carácter. Quando o carácter atual já está **dentro** da janela, a janela passa a começar logo a seguir a essa posição. Cuidado com o "abba": o início da janela nunca pode andar para trás. Na soma máxima, não voltes a somar a janela toda: soma o que entra e subtrai o que sai.
</details>

<details>
<summary>Solução de referência</summary>

```js
const alfanumerico = (c) => /[a-z0-9]/i.test(c);

export function ehPalindromo(texto) {
  let i = 0;
  let j = texto.length - 1;
  while (i < j) {
    if (!alfanumerico(texto[i])) i++;
    else if (!alfanumerico(texto[j])) j--;
    else if (texto[i].toLowerCase() !== texto[j].toLowerCase()) return false;
    else {
      i++;
      j--;
    }
  }
  return true;
}

export function maiorSemRepetir(texto) {
  const ultimaVez = new Map(); // carácter → último índice onde apareceu
  let inicio = 0;
  let melhor = 0;
  for (let fim = 0; fim < texto.length; fim++) {
    const c = texto[fim];
    // Se o carácter já está DENTRO da janela, a janela passa a começar logo a seguir a ele.
    // (Math.max: o início nunca anda para trás; é o caso "abba".)
    if (ultimaVez.has(c)) inicio = Math.max(inicio, ultimaVez.get(c) + 1);
    ultimaVez.set(c, fim);
    melhor = Math.max(melhor, fim - inicio + 1);
  }
  return melhor;
}

export function somaMaximaJanela(nums, k) {
  if (k < 1 || k > nums.length) throw new Error(`k inválido: ${k}`);
  let soma = 0;
  for (let i = 0; i < k; i++) soma += nums[i];
  let melhor = soma;
  // Deslizar: entra o da direita, sai o da esquerda. Uma soma e uma subtração por passo.
  for (let i = k; i < nums.length; i++) {
    soma += nums[i] - nums[i - k];
    melhor = Math.max(melhor, soma);
  }
  return melhor;
}
```
</details>

### P3 · Pilhas (≈30 min)

**Ficheiro:** `pilhas.js`

Parênteses equilibrados, o "próximo maior" com uma pilha monótona, e uma calculadora em notação polaca inversa (a forma como os compiladores avaliam expressões).

**Sintaxe que vais praticar:** `push`/`pop`/`at(-1)`, o operador `in` num objeto, um objeto de funções (`{ '+': (a, b) => a + b }`), `Math.trunc`.

<details>
<summary>Pista</summary>

No `proximoMaior`, a pilha guarda os **índices** que ainda não encontraram o seu próximo maior. Cada número novo "resolve" todos os da pilha que forem menores do que ele (tira-os e escreve a resposta). Cada índice entra e sai da pilha uma só vez: é por isso que é O(n), apesar do `while` dentro do `for`.
</details>

<details>
<summary>Solução de referência</summary>

```js
const PARES = { ')': '(', ']': '[', '}': '{' };

export function parentesesValidos(texto) {
  const pilha = [];
  for (const c of texto) {
    if ('([{'.includes(c)) pilha.push(c);
    else if (c in PARES && pilha.pop() !== PARES[c]) return false;
  }
  return pilha.length === 0;
}

export function proximoMaior(nums) {
  const resposta = new Array(nums.length).fill(-1);
  const pilha = []; // índices à espera do seu "próximo maior", com valores a descer
  for (let i = 0; i < nums.length; i++) {
    // O número atual é a resposta de todos os da pilha que são menores do que ele.
    while (pilha.length && nums[pilha.at(-1)] < nums[i]) resposta[pilha.pop()] = nums[i];
    pilha.push(i);
  }
  return resposta;
}

const OPERACOES = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => Math.trunc(a / b),
};

export function avaliarRPN(tokens) {
  const pilha = [];
  for (const t of tokens) {
    if (t in OPERACOES) {
      if (pilha.length < 2) throw new Error(`faltam operandos para "${t}"`);
      const b = pilha.pop(); // atenção à ordem: o segundo operando sai primeiro
      const a = pilha.pop();
      pilha.push(OPERACOES[t](a, b));
    } else if (/^-?\d+$/.test(t)) {
      pilha.push(Number(t));
    } else {
      throw new Error(`símbolo desconhecido: "${t}"`);
    }
  }
  if (pilha.length !== 1) throw new Error('expressão mal formada');
  return pilha[0];
}
```
</details>

### P4 · Pesquisa binária e um heap (≈40 min)

**Ficheiro:** `pesquisaEHeap.js`

A pesquisa binária que encontra a **primeira** ocorrência (a variante que mais aparece, e que mais se escreve mal), um heap mínimo escrito de raiz, e os k maiores com um heap pequeno.

**Sintaxe que vais praticar:** intervalos meio abertos `[baixo, alto)`, `>> 1`, um `getter` (`get tamanho()`), troca por desestruturação (`[a, b] = [b, a]`), um parâmetro com uma função por omissão.

<details>
<summary>Pista</summary>

Na pesquisa binária, quando `arr[meio]` é igual ao que procuras, **não pares**: pode haver outro igual à esquerda, por isso continua com `alto = meio`. No heap, o `inserir` põe o elemento no fim e faz-o **subir** enquanto for menor do que o pai; o `extrair` tira a raiz, põe lá o último elemento, e faz-o **descer** trocando com o menor dos filhos.
</details>

<details>
<summary>Solução de referência</summary>

```js
export function primeiraPosicao(ordenado, x) {
  let baixo = 0;
  let alto = ordenado.length; // intervalo [baixo, alto)
  while (baixo < alto) {
    const meio = (baixo + alto) >> 1;
    if (ordenado[meio] < x) baixo = meio + 1;
    else alto = meio; // mesmo que seja igual: pode haver outro à esquerda
  }
  return ordenado[baixo] === x ? baixo : -1;
}

export class MinHeap {
  constructor(comparar = (a, b) => a - b) {
    this.comparar = comparar;
    this.dados = [];
  }

  get tamanho() {
    return this.dados.length;
  }

  espreitar() {
    return this.dados[0];
  }

  inserir(x) {
    const d = this.dados;
    d.push(x);
    // Sobe enquanto for menor do que o pai.
    let i = d.length - 1;
    while (i > 0) {
      const pai = (i - 1) >> 1;
      if (this.comparar(d[i], d[pai]) >= 0) break;
      [d[i], d[pai]] = [d[pai], d[i]];
      i = pai;
    }
  }

  extrair() {
    const d = this.dados;
    if (d.length === 0) return undefined;
    const menor = d[0];
    const ultimo = d.pop();
    if (d.length > 0) {
      // O último vai para a raiz e desce, trocando com o menor dos filhos.
      d[0] = ultimo;
      let i = 0;
      for (;;) {
        const e = 2 * i + 1;
        const dir = e + 1;
        let alvo = i;
        if (e < d.length && this.comparar(d[e], d[alvo]) < 0) alvo = e;
        if (dir < d.length && this.comparar(d[dir], d[alvo]) < 0) alvo = dir;
        if (alvo === i) break;
        [d[i], d[alvo]] = [d[alvo], d[i]];
        i = alvo;
      }
    }
    return menor;
  }
}

export function kMaiores(nums, k) {
  // Um heap com os k maiores vistos até agora; a raiz é o MENOR deles, o primeiro a sair.
  const heap = new MinHeap();
  for (const x of nums) {
    heap.inserir(x);
    if (heap.tamanho > k) heap.extrair();
  }
  const resultado = [];
  while (heap.tamanho) resultado.push(heap.extrair());
  return resultado.reverse();
}
```
</details>

### P5 · Grafos (≈45 min)

**Ficheiro:** `grafos.js`

O caminho mais curto numa grelha (BFS), as ilhas de um mapa (DFS), a ordem de execução de tarefas com dependências (ordenação topológica, com deteção de ciclos), e o caminho mais barato com custos (Dijkstra).

**Sintaxe que vais praticar:** uma fila com um índice que avança, uma pilha explícita, o encadeamento opcional para os limites da grelha (`grelha[ny]?.[nx]`), `Map` de listas de adjacência, o `MinHeap` do P4 com objetos.

<details>
<summary>Pista</summary>

Marca uma célula como visitada quando a **pões** na fila, e não quando a tiras: senão, a mesma célula entra na fila várias vezes. No Dijkstra, o heap pode ter entradas antigas de um nó cujo custo já melhorou; quando sair uma, compara com a melhor distância conhecida e ignora-a se for pior.
</details>

<details>
<summary>Solução de referência</summary>

```js
import { MinHeap } from './pesquisaEHeap.js';

const DIRECOES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function encontrar(grelha, letra) {
  for (let y = 0; y < grelha.length; y++) {
    const x = grelha[y].indexOf(letra);
    if (x !== -1) return [y, x];
  }
  return null;
}

export function caminhoMaisCurto(grelha) {
  const [sy, sx] = encontrar(grelha, 'S');
  const visto = grelha.map((linha) => new Array(linha.length).fill(false));
  visto[sy][sx] = true;
  // BFS: uma fila; tudo o que está à distância d sai antes do que está à distância d + 1.
  // (Um índice a avançar em vez de shift(): o shift() de um array é O(n).)
  const fila = [[sy, sx, 0]];
  for (let i = 0; i < fila.length; i++) {
    const [y, x, d] = fila[i];
    if (grelha[y][x] === 'E') return d;
    for (const [dy, dx] of DIRECOES) {
      const ny = y + dy;
      const nx = x + dx;
      if (grelha[ny]?.[nx] !== undefined && grelha[ny][nx] !== '#' && !visto[ny][nx]) {
        visto[ny][nx] = true;
        fila.push([ny, nx, d + 1]);
      }
    }
  }
  return -1;
}

export function contarIlhas(grelha) {
  const visto = grelha.map((linha) => new Array(linha.length).fill(false));
  let ilhas = 0;
  for (let y = 0; y < grelha.length; y++) {
    for (let x = 0; x < grelha[y].length; x++) {
      if (grelha[y][x] !== '1' || visto[y][x]) continue;
      ilhas++;
      // DFS com uma pilha explícita (a recursão rebentaria a pilha numa ilha muito grande).
      const pilha = [[y, x]];
      visto[y][x] = true;
      while (pilha.length) {
        const [cy, cx] = pilha.pop();
        for (const [dy, dx] of DIRECOES) {
          const ny = cy + dy;
          const nx = cx + dx;
          if (grelha[ny]?.[nx] === '1' && !visto[ny][nx]) {
            visto[ny][nx] = true;
            pilha.push([ny, nx]);
          }
        }
      }
    }
  }
  return ilhas;
}

export function ordemTopologica(tarefas, dependencias) {
  // Algoritmo de Kahn: quantas dependências faltam a cada tarefa; as que têm 0 podem correr.
  const faltam = new Map(tarefas.map((t) => [t, 0]));
  const depois = new Map(tarefas.map((t) => [t, []]));
  for (const [antes, dep] of dependencias) {
    faltam.set(dep, faltam.get(dep) + 1);
    depois.get(antes).push(dep);
  }
  const posicao = new Map(tarefas.map((t, i) => [t, i]));
  const prontas = new MinHeap((a, b) => posicao.get(a) - posicao.get(b));
  for (const t of tarefas) if (faltam.get(t) === 0) prontas.inserir(t);

  const ordem = [];
  while (prontas.tamanho) {
    const t = prontas.extrair();
    ordem.push(t);
    for (const d of depois.get(t)) {
      faltam.set(d, faltam.get(d) - 1);
      if (faltam.get(d) === 0) prontas.inserir(d);
    }
  }
  // Se sobraram tarefas, elas esperam umas pelas outras: há um ciclo.
  if (ordem.length !== tarefas.length) throw new Error('há um ciclo nas dependências');
  return ordem;
}

export function dijkstra(arestas, origem) {
  const vizinhos = new Map();
  for (const [de, para, custo] of arestas) {
    if (!vizinhos.has(de)) vizinhos.set(de, []);
    vizinhos.get(de).push([para, custo]);
  }
  const distancia = { [origem]: 0 };
  const heap = new MinHeap((a, b) => a.custo - b.custo);
  heap.inserir({ no: origem, custo: 0 });
  while (heap.tamanho) {
    const { no, custo } = heap.extrair();
    if (custo > distancia[no]) continue; // uma entrada antiga, já melhorada entretanto
    for (const [v, c] of vizinhos.get(no) ?? []) {
      const novo = custo + c;
      if (distancia[v] === undefined || novo < distancia[v]) {
        distancia[v] = novo;
        heap.inserir({ no: v, custo: novo });
      }
    }
  }
  return distancia;
}
```
</details>

### P6 · Programação dinâmica (≈35 min)

**Ficheiro:** `dinamica.js`

Três clássicos, cada um com uma tabela diferente. O primeiro tem de responder para n = 90 instantaneamente, e num `BigInt`, porque o resultado já não cabe num `Number` exato.

**Sintaxe que vais praticar:** `BigInt` (`1n`), `new Array(n).fill(...)`, `Infinity`, tabelas de uma dimensão, e uma tabela de duas dimensões guardada linha a linha.

<details>
<summary>Pista</summary>

Para o troco, a tabela é `melhor[v]`, de 0 até ao total; cada valor tenta todas as moedas: `melhor[v] = min(melhor[v - m] + 1)`. Para a LCS, a célula `[i][j]` responde para os primeiros i caracteres de `a` e os primeiros j de `b`: se os últimos caracteres forem iguais, é a diagonal + 1; senão, o melhor entre "sem o último de a" e "sem o último de b".
</details>

<details>
<summary>Solução de referência</summary>

```js
export function formasDeSubir(n) {
  // formas(n) = formas(n - 1) + formas(n - 2): o último passo foi de 1 ou de 2 degraus.
  // De baixo para cima, guardando só os dois últimos: O(n) tempo, O(1) memória.
  let antes = 1n; // formas(0)
  let agora = 1n; // formas(1)
  for (let i = 2; i <= n; i++) [antes, agora] = [agora, antes + agora];
  return agora;
}

export function trocoMinimo(moedas, total) {
  // melhor[v] = o menor número de moedas para fazer v
  const melhor = new Array(total + 1).fill(Infinity);
  melhor[0] = 0;
  for (let v = 1; v <= total; v++) {
    for (const m of moedas) {
      if (m <= v && melhor[v - m] + 1 < melhor[v]) melhor[v] = melhor[v - m] + 1;
    }
  }
  return melhor[total] === Infinity ? -1 : melhor[total];
}

export function maiorSubsequenciaComum(a, b) {
  // t[i][j] = a LCS de a[0..i) e b[0..j). Guardamos só a linha anterior.
  let anterior = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const atual = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      atual[j] = a[i - 1] === b[j - 1] ? anterior[j - 1] + 1 : Math.max(anterior[j], atual[j - 1]);
    }
    anterior = atual;
  }
  return anterior[b.length];
}
```
</details>

## Experiências

1. **Sente a diferença:** escreve o `doisSomam` com dois `for` encaixados e corre o teste de 50 000 números. Quanto demorou? Faz as contas: quantas comparações fez?
2. **O `shift()` é O(n):** no `caminhoMaisCurto`, troca o índice que avança por `fila.shift()`. Corre o teste da grelha 400 × 400. Mede com e sem.
3. **Recursão ingénua:** escreve `const f = (n) => n <= 1 ? 1n : f(n - 1) + f(n - 2)` e mede `f(30)`, `f(35)` e `f(40)`. Quanto cresce o tempo de cada vez? Depois acrescenta uma cache num `Map` e repete.
4. **Uma entrevista simulada:** escolhe três problemas "Easy" e dois "Medium" do [LeetCode](https://leetcode.com) ou do [NeetCode](https://neetcode.io), com um temporizador de 25 minutos cada, e segue os sete passos da secção 7 em voz alta.

## Perguntas de pensamento crítico

1. Um colega escreveu `for (const t of tarefas) if (ids.includes(t.id)) ...` com 50 000 tarefas e 50 000 ids, e o endpoint demora 8 segundos. Porquê, e qual é a correção de uma linha?
2. Porque é que o BFS encontra o caminho mais curto numa grelha, e o DFS não?
3. Quando é que uma solução O(n²) é perfeitamente aceitável?

<details>
<summary>Respostas</summary>

1. O `includes` percorre o array dos ids de cada vez: são 50 000 × 50 000 = 2 500 milhões de comparações. A correção: `const conjunto = new Set(ids)` antes do ciclo, e `conjunto.has(t.id)` lá dentro. Cada pergunta passa a O(1), e o total a O(n).
2. Porque o BFS visita os nós por ordem de distância: todos os que estão a 1 passo, depois todos os que estão a 2, e assim por diante. A primeira vez que chega ao destino, não há caminho mais curto por explorar. O DFS segue um caminho até ao fim antes de experimentar outro, por isso pode chegar ao destino por um caminho longo primeiro.
3. Quando o n é pequeno e tem um limite conhecido: comparar os 20 campos de um formulário entre si, ou as 50 linhas de uma fatura. Uma solução mais simples e legível vale mais do que uma otimização que ninguém vai notar. A complexidade importa quando a entrada cresce sem controlo (utilizadores, tarefas, logs).
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 30`.

**1.** Qual é a complexidade de 'for (const x of a) if (b.includes(x)) ...', com a e b do mesmo tamanho n?

- a) O(n)
- b) O(n log n)
- c) O(n²)
- d) O(log n)

<details><summary>Resposta</summary>

**c) O(n²)** — O includes percorre b de cada vez. Com um Set(b) e has(), fica O(n).

</details>

**2.** O que devolve [10, 9, 1].sort() em JavaScript?

- a) [1, 9, 10]
- b) [10, 9, 1]
- c) [1, 10, 9]
- d) Um erro

<details><summary>Resposta</summary>

**c) [1, 10, 9]** — Sem função de comparação, o sort compara como texto: '1' < '10' < '9'. Para números: sort((a, b) => a - b).

</details>

**3.** Para encontrar o caminho com MENOS passos numa grelha sem pesos, que algoritmo usas?

- a) DFS
- b) BFS
- c) Ordenação topológica
- d) Pesquisa binária

<details><summary>Resposta</summary>

**b) BFS** — O BFS visita por ordem de distância; a primeira chegada é a mais curta. Com custos diferentes, usa-se o Dijkstra.

</details>

**4.** Que estrutura de dados dá sempre o menor (ou maior) elemento em O(log n) por inserção e extração?

<details><summary>Resposta</summary>

**heap** — É a base das filas de prioridade, dos 'k maiores' e do Dijkstra.

</details>

**5.** Quando é que um problema pede programação dinâmica?

- a) Sempre que há um array
- b) Quando se parte em subproblemas mais pequenos que se repetem, e guardar as respostas evita recalculá-las
- c) Quando os dados estão ordenados
- d) Quando há strings

<details><summary>Resposta</summary>

**b) Quando se parte em subproblemas mais pequenos que se repetem, e guardar as respostas evita recalculá-las** — A recursão ingénua do Fibonacci é O(2^n); guardando os subproblemas, passa a O(n).

</details>

<!-- quiz:end -->
