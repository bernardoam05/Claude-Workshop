# 59 · Código limpo, refatoração e revisão de código

**Objetivo:** escrever código que outras pessoas (e tu daqui a seis meses) percebem e conseguem mudar sem medo: nomes, funções pequenas, os "cheiros" mais comuns, refatorar com segurança com testes de caracterização, e fazer e receber revisões de código que melhoram o código sem estragar a equipa.

**Ficheiros para ler:** `src/api/src/services/` e `src/api/src/routes/tasks.js` (código razoavelmente limpo, para comparar) e `pratica/29-typescript/legado.js` (código que não é).

**Pré-requisitos:** módulos 11 (testes), 16 (trabalhar numa empresa: *pull requests*), 40 (arquitetura) e 58 (testes avançados).

---

## 1. Para quem é o código

O código é lido muitas mais vezes do que é escrito: em cada *bug*, em cada funcionalidade nova ao lado, em cada revisão. O custo de um sistema ao longo da vida é dominado pela manutenção, e a velocidade de uma equipa ao fim de dois anos depende sobretudo de quão fácil é **mudar** o código que já existe. "Código limpo" não é estética: é baixar esse custo.

Mas cuidado com a religião. Livros como o *Clean Code* (Robert C. Martin) popularizaram regras úteis, e também algumas que, levadas ao extremo, pioram o código (funções de três linhas espalhadas por vinte ficheiros, abstrações para coisas que só têm um caso). O critério que sobrevive é sempre o mesmo: **isto é fácil de perceber e de mudar com segurança?**

## 2. Nomes

O nome é a documentação que está sempre lá. Algumas regras práticas:

- **Diz o quê e porquê, não o como**: `tarefasAtrasadas` em vez de `lista2`; `MINIMO_SEM_PORTES` em vez de `50`.
- **Proporcional ao alcance**: `i` num ciclo de três linhas está ótimo; uma variável que vive num módulo inteiro precisa de um nome completo.
- **Funções são verbos, booleanos são perguntas**: `calcularTotal()`, `estaAtrasada`, `temPermissao`.
- **A mesma palavra para a mesma coisa** em todo o código (não `utilizador` num sítio, `user` noutro e `cliente` noutro, se forem a mesma coisa). É a "linguagem ubíqua" do módulo 40.
- **Sem abreviações crípticas nem codificações** (`strNome`, `arrTarefas`, `calc(i, c)`).

## 3. Funções

- **Pequenas e com um só nível de abstração**: uma função que lê o pedido, valida, faz contas, escreve SQL e formata a resposta está a fazer cinco coisas. Extrai cada uma com um nome que diz o que é.
- **Poucos parâmetros**: mais de três é um cheiro. Agrupa-os num objeto (`criarTarefa({ titulo, prioridade, prazo })`), que além disso torna as chamadas legíveis.
- **Sem parâmetros booleanos que mudam o comportamento** (`enviar(email, true)`: true o quê?). Duas funções com nomes diferentes são quase sempre melhores.
- **Sem efeitos escondidos**: uma função `validar` que também grava na base de dados vai surpreender alguém.
- **Retornos antecipados** (*guard clauses*) em vez de `if`s aninhados: trata os casos especiais no início e sai, para o caminho principal ficar sem indentação.

## 4. Os cheiros

Um **cheiro** (*code smell*, termo de Kent Beck e Martin Fowler) é um sinal de que **talvez** haja um problema. Não é uma regra: é um convite a olhar. Os mais comuns:

| Cheiro | O que fazer (a refatoração do catálogo de Fowler) |
|---|---|
| Função comprida | Extrair função |
| Muitos parâmetros | Introduzir objeto de parâmetros |
| Números mágicos | Substituir por constante com nome |
| Aninhamento fundo | Retornos antecipados; extrair função |
| Código duplicado | Extrair função (mas só à terceira vez: duas cópias parecidas ainda podem divergir) |
| `switch` sobre um tipo, repetido em vários sítios | Substituir condicional por polimorfismo ou por uma tabela |
| Comentários a explicar o que o código faz | Melhorar os nomes até o comentário ser desnecessário (os comentários bons explicam o **porquê**) |
| Classe ou módulo que sabe tudo | Partir por responsabilidades |
| Inveja de funcionalidades (uma função que mexe mais nos dados de outro objeto do que nos seus) | Mover a função para onde estão os dados |

Os *linters* (o ESLint com `max-lines-per-function`, `max-params`, `max-depth`, `complexity`, `no-magic-numbers`) e ferramentas como o SonarQube apontam muitos destes automaticamente. A **complexidade ciclomática** (o número de caminhos independentes numa função) é a métrica clássica: acima de 10, a função é difícil de testar a fundo.

## 5. Refatorar com segurança

**Refatorar** é mudar a estrutura do código **sem mudar o comportamento**. A palavra-chave é "sem": se o comportamento muda, é outra coisa (e deve ir noutro *commit*). As regras:

1. **Primeiro, uma rede de segurança.** Sem testes, não há forma de saber se o comportamento mudou. Num código antigo sem testes, escrevem-se primeiro **testes de caracterização** (Michael Feathers, *Working Effectively with Legacy Code*): testes que registam o que o código **faz agora**, certo ou errado. Uma técnica poderosa é o ***golden master***: guardar uma cópia do código antigo e comparar a versão nova com ela em milhares de entradas (com o fast-check do módulo 58).
2. **Passos pequenos**, cada um com os testes a passar, e *commits* frequentes. Se algo partir, sabes exatamente qual foi o passo.
3. **Separa refatoração de mudanças de comportamento**: num *pull request*, ou em *commits* separados, para o revisor conseguir verificar cada um.
4. **Usa as ferramentas**: o "renomear símbolo" e o "extrair função" do editor são mais seguros do que fazê-lo à mão.
5. **Os *bugs* encontrados ficam como estão**, durante a refatoração. Regista-os e corrige-os a seguir, com um teste que os demonstra.

Quando se refatora? Kent Beck: "torna a mudança fácil (isto pode ser difícil), e depois faz a mudança fácil". A melhor altura é imediatamente antes de mexer numa zona do código, e a regra do escuteiro: deixa o código um pouco melhor do que o encontraste. As reescritas totais ("deitar fora e começar de novo") quase sempre demoram muito mais do que o previsto e perdem comportamentos que ninguém sabia que existiam.

## 6. Revisão de código: fazer

A revisão de código (*code review*), num *pull request* (módulo 16), serve para apanhar erros, mas sobretudo para **partilhar conhecimento** (mais do que uma pessoa conhece cada parte) e manter a coerência. Como revisor:

- **Começa pelo grande**: o problema está bem resolvido? O desenho encaixa no resto? Há casos esquecidos (erros, concorrência, permissões, dados vazios)? Os testes testam o que importa? Só depois os detalhes.
- **Deixa a parte mecânica às máquinas**: formatação (Prettier), *lint*, testes, análise de segurança e verificações como as do P3 correm no CI. Um humano a comentar espaços é tempo perdido e irrita.
- **Comenta o código, não a pessoa**, e com perguntas quando não tens a certeza: "o que acontece aqui se a lista vier vazia?" em vez de "isto está mal".
- **Diz o peso de cada comentário**: "bloqueante", "sugestão", "*nit*" (pormenor, opcional). As *Conventional Comments* são uma convenção para isso.
- **Elogia** o que está bem feito: ensina tanto como as críticas.
- **Responde depressa**: um PR à espera de revisão dois dias bloqueia uma pessoa e cria conflitos. Muitas equipas combinam um prazo (no mesmo dia).
- **Aprova quando melhora o código**, mesmo que não seja como o farias. A pergunta é "está bom?", não "está como eu faria?".

## 7. Revisão de código: receber, e o tamanho

- **PRs pequenos**. Um PR de 50 linhas recebe uma revisão cuidadosa; um de 2000 recebe um "LGTM" (*looks good to me*). As estatísticas da indústria mostram que os defeitos encontrados por linha caem a pique acima de umas 400 linhas. Parte o trabalho (refatoração primeiro, depois a funcionalidade; *feature flags* do módulo 52 para entregar aos bocados).
- **Uma boa descrição**: o porquê, o que mudou, como testar, capturas de ecrã se for interface, e o que **não** está incluído.
- **Revê o teu próprio diff antes de pedir revisão.** Apanha metade dos comentários antes de alguém os fazer.
- **Não leves a peito**, e não discutas em 30 comentários: uma conversa de 5 minutos resolve.

## Em resumo

- O código é lido muito mais vezes do que escrito: "limpo" quer dizer **fácil de perceber e de mudar com segurança**, não seguir regras às cegas.
- Bons **nomes** dizem o quê e porquê; as **funções** são pequenas, com poucos parâmetros, sem flags booleanas nem efeitos escondidos.
- Um **cheiro** (função comprida, parâmetros a mais, aninhamento, números mágicos, duplicação) é um convite a olhar, com uma refatoração conhecida para cada um.
- **Refatorar** é mudar a estrutura sem mudar o comportamento: primeiro testes de **caracterização**, depois passos pequenos, e as mudanças de comportamento em separado.
- Numa **revisão de código**: o desenho primeiro, a parte mecânica às ferramentas, comentários sobre o código com o peso de cada um, e respostas rápidas.
- **PRs pequenos** recebem revisões a sério.

---

## Prática: escreve tu

Refatoração com rede de segurança: uma função antiga reescrita com nomes e funções pequenas, comparada com o original em mil encomendas aleatórias; um detetor de cheiros (funções compridas, parâmetros a mais, aninhamento, números mágicos); um robô de revisão que lê um diff e comenta as linhas acrescentadas; e um `switch` antigo substituído por uma tabela, comparado com o original em todas as combinações.

**Ficheiros:** `pratica/59-clean-code-e-revisao/` (`precos.js`, `cheiros.js`, `revisao.js`, `maquina.js`; e `precosLegado.js` e `maquinaLegado.js`, que não se mexem)

**Verificar:** `npm run verificar 59` (dentro de `pratica/`). Só um exercício: `npm run verificar 59 precos`, `... 59 cheiros`, `... 59 revisao` ou `... 59 maquina`.

Se nunca usaste a prática, lê primeiro a introdução no [módulo 01](01-fundamentos.md#prática-escreve-tu).

### P1 · Refatorar com testes de caracterização (≈25 min)

**Ficheiro:** `precos.js` (o original está em `precosLegado.js`)

Ler o código antigo, dar nome aos números mágicos, extrair o desconto, o IVA e o total de uma linha, e reescrever o total da encomenda. Os testes comparam a tua versão com a antiga em casos-limite e em mil encomendas geradas pelo fast-check.

**Sintaxe que vais praticar:** constantes exportadas, `??` para um valor por omissão, `reduce`, encadeamento opcional (`cliente?.vip`), retornos antecipados.

<details>
<summary>Pista</summary>

Lê o `calc` antigo e escreve, numa folha, o que cada número significa. Repara que `p + p * 0.06` é o mesmo que `p * (1 + 0.06)`, e que os dois `if`s aninhados da quantidade são uma função com dois retornos antecipados. Corre os testes depois de cada função extraída.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P1 · Refatorar com uma rede de segurança: a função `calc` de precosLegado.js, reescrita com
// nomes que se percebem, constantes com nome e funções pequenas, SEM mudar o comportamento.

export const IVA = { livro: 0.06, comida: 0.13, outro: 0.23 };
export const DESCONTO_VIP = 0.1;
export const PORTES = 4.99;
export const MINIMO_SEM_PORTES = 50;

// descontoPorQuantidade(quantidade) → 0.15 a partir de 50 unidades, 0.05 a partir de 10, senão 0
export function descontoPorQuantidade(quantidade) {
  if (quantidade >= 50) return 0.15;
  if (quantidade >= 10) return 0.05;
  return 0;
}

// taxaIva(categoria) → a taxa de IVA da categoria ('livro', 'comida'); qualquer outra paga a de 'outro'
export function taxaIva(categoria) {
  return IVA[categoria] ?? IVA.outro;
}

// totalLinha({ preco, quantidade, categoria }) → preço × quantidade, com o desconto por
//   quantidade e depois o IVA (sem arredondar)
export function totalLinha({ preco, quantidade, categoria }) {
  const semIva = preco * quantidade * (1 - descontoPorQuantidade(quantidade));
  return semIva * (1 + taxaIva(categoria));
}

// totalEncomenda(linhas, cliente) → o mesmo que calc(linhas antigas, cliente), arredondado ao cêntimo:
//   soma das linhas; menos DESCONTO_VIP se cliente?.vip; mais PORTES se ficar abaixo de MINIMO_SEM_PORTES
//   (as linhas usam nomes novos: { preco, quantidade, categoria } em vez de { p, q, cat })
export function totalEncomenda(linhas, cliente) {
  let total = linhas.reduce((soma, linha) => soma + totalLinha(linha), 0);
  if (cliente?.vip) total *= 1 - DESCONTO_VIP;
  if (total < MINIMO_SEM_PORTES) total += PORTES;
  return Math.round(total * 100) / 100;
}
```
</details>

### P2 · Um detetor de cheiros (≈35 min)

**Ficheiro:** `cheiros.js`

Encontrar funções com parâmetros a mais e com linhas a mais (contando as chavetas até ao fim da função), aninhamento demasiado fundo, e números mágicos fora de constantes com nome.

**Sintaxe que vais praticar:** expressões regulares com grupos opcionais (`(?:export\s+)?`), *lookbehind* e *lookahead* (`(?<![\w.])\d+(?![\w.])`), contar chavetas carácter a carácter, `flat`.

<details>
<summary>Pista</summary>

Guarda os problemas numa lista por linha (`porLinha[i]`) e faz três passagens (funções, aninhamento, números); no fim, `porLinha.flat()` dá-os por ordem de linha e, dentro de cada linha, pela ordem das passagens. Para o fim de uma função, conta `{` e `}` a partir da linha do `function` até a contagem voltar a zero.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P2 · Um detetor de "cheiros" no código (code smells): sinais de que algo pode precisar de ser
// refatorado. É o que ferramentas como o ESLint (max-lines-per-function, max-params, max-depth,
// no-magic-numbers) e o SonarQube fazem, em muito mais pequeno.

// detetarCheiros(codigo, { maxLinhas = 20, maxParametros = 3, maxProfundidade = 3 }) → lista de textos
//   Antes de analisar, ignora o que vem depois de '//' em cada linha (comentários).
//   (Simplificação: o código não tem textos com chavetas, números ou '//'.)
//   1. Funções declaradas com `function nome(...) {` (também com export/async antes):
//      - mais de maxParametros parâmetros → 'linha N: função nome com P parâmetros'
//      - mais de maxLinhas linhas, da linha do `function` à da chaveta que a fecha (inclusive)
//        → 'linha N: função nome com L linhas'   (N é a linha do `function`)
//   2. Aninhamento: cada '{' que deixa mais de maxProfundidade chavetas abertas ao mesmo tempo
//      → 'linha N: aninhamento de profundidade D' (D é o número de chavetas abertas depois dela)
//   3. Números mágicos: cada número que não seja 0 nem 1, fora de uma linha que declara uma
//      constante com nome em maiúsculas (const TAXA_IVA = 0.23) → 'linha N: número mágico X'
//   O resultado vem ordenado por linha (e, na mesma linha, pela ordem acima).
export function detetarCheiros(codigo, { maxLinhas = 20, maxParametros = 3, maxProfundidade = 3 } = {}) {
  const linhas = codigo.split('\n').map((l) => l.replace(/\/\/.*$/, ''));
  const porLinha = linhas.map(() => []);

  // 1. funções
  linhas.forEach((l, i) => {
    const m = /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/.exec(l);
    if (!m) return;
    const params = m[2].split(',').filter((p) => p.trim()).length;
    if (params > maxParametros) porLinha[i].push(`linha ${i + 1}: função ${m[1]} com ${params} parâmetros`);
    let prof = 0;
    let comecou = false;
    for (let j = i; j < linhas.length; j++) {
      for (const c of linhas[j]) {
        if (c === '{') {
          prof++;
          comecou = true;
        } else if (c === '}') prof--;
        if (comecou && prof === 0) {
          const total = j - i + 1;
          if (total > maxLinhas) porLinha[i].push(`linha ${i + 1}: função ${m[1]} com ${total} linhas`);
          return;
        }
      }
    }
  });

  // 2. aninhamento
  let abertas = 0;
  linhas.forEach((l, i) => {
    for (const c of l) {
      if (c === '{') {
        abertas++;
        if (abertas > maxProfundidade) porLinha[i].push(`linha ${i + 1}: aninhamento de profundidade ${abertas}`);
      } else if (c === '}') abertas--;
    }
  });

  // 3. números mágicos
  linhas.forEach((l, i) => {
    if (/^\s*(?:export\s+)?const\s+[A-Z][A-Z0-9_]*\s*=/.test(l)) return;
    for (const [n] of l.matchAll(/(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g)) {
      if (n !== '0' && n !== '1') porLinha[i].push(`linha ${i + 1}: número mágico ${n}`);
    }
  });

  return porLinha.flat();
}
```
</details>

### P3 · Um robô de revisão (≈30 min)

**Ficheiro:** `revisao.js`

Ler um diff unificado de vários ficheiros (incluindo apagados e novos), contar as linhas, e comentar as linhas acrescentadas com o número de linha certo: `console.log`, `debugger`, `.only` em testes, TODOs sem ticket e possíveis segredos.

**Sintaxe que vais praticar:** `startsWith`, ler o cabeçalho `@@ -a,b +c,d @@` com uma expressão regular, *lookahead* negativo (`TODO(?!.*#\d+)`), uma lista de regras `[regex, mensagem, condição]`.

<details>
<summary>Pista</summary>

Percorre o diff linha a linha com três variáveis: o ficheiro atual, o nome antigo (para os apagados) e o número da linha no ficheiro novo. O `@@` reinicia o número; `' '` e `'+'` avançam-no; `'-'` não. Atenção à ordem: verifica `'--- '` e `'+++ '` antes de `'-'` e `'+'`.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P3 · Um robô de revisão de código: lê um diff unificado (o que o `git diff` e os pull requests
// mostram) e comenta as linhas acrescentadas, como um revisor atento às coisas mecânicas, para os
// revisores humanos se concentrarem no que importa (o desenho, os nomes, os casos esquecidos).

// analisarDiff(diff) → [{ ficheiro, adicionadas, removidas }], pela ordem do diff
//   O nome vem da linha '+++ b/caminho'; se for '+++ /dev/null' (ficheiro apagado), vem de '--- a/caminho'.
//   adicionadas: linhas que começam por '+' (sem contar a '+++'); removidas: por '-' (sem contar a '---').
export function analisarDiff(diff) {
  const ficheiros = [];
  let atual = null;
  let antigo = null;
  for (const l of diff.split('\n')) {
    if (l.startsWith('--- ')) antigo = l.slice(4).replace(/^a\//, '');
    else if (l.startsWith('+++ ')) {
      const novo = l.slice(4);
      atual = { ficheiro: novo === '/dev/null' ? antigo : novo.replace(/^b\//, ''), adicionadas: 0, removidas: 0 };
      ficheiros.push(atual);
    } else if (atual && l.startsWith('+')) atual.adicionadas++;
    else if (atual && l.startsWith('-')) atual.removidas++;
  }
  return ficheiros;
}

// As regras, aplicadas a cada linha ACRESCENTADA (sem o '+'):
//   console.log(                       → 'console.log esquecido'
//   debugger                           → 'debugger esquecido'
//   .only(  (só em ficheiros com .test. ou .spec. no nome) → 'teste com .only: os outros não correm'
//   TODO sem '#123' nem 'ABC-123' na linha → 'TODO sem ticket'
//   AKIA seguido de 16 maiúsculas/algarismos, ou '-----BEGIN ... PRIVATE KEY-----', ou
//   password/secret/token seguido de : ou = e de um texto entre aspas com 8 ou mais caracteres
//                                      → 'possível segredo'
// comentar(diff) → [{ ficheiro, linha, mensagem }], pela ordem do diff e das regras acima.
//   linha é o número da linha no ficheiro NOVO: o cabeçalho '@@ -a,b +c,d @@' diz que a primeira
//   linha do bloco é a c; as linhas de contexto (' ') e as acrescentadas ('+') avançam o contador,
//   as removidas ('-') não.
const REGRAS = [
  [/console\.log\(/, 'console.log esquecido'],
  [/\bdebugger\b/, 'debugger esquecido'],
  [/\.only\(/, 'teste com .only: os outros não correm', (f) => /\.(test|spec)\./.test(f)],
  [/\bTODO\b(?!.*(#\d+|\b[A-Z]+-\d+\b))/, 'TODO sem ticket'],
  [/AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(password|secret|token)\s*[:=]\s*['"][^'"]{8,}['"]/i, 'possível segredo'],
];

export function comentar(diff) {
  const comentarios = [];
  let ficheiro = null;
  let antigo = null;
  let linha = 0;
  for (const l of diff.split('\n')) {
    if (l.startsWith('--- ')) antigo = l.slice(4).replace(/^a\//, '');
    else if (l.startsWith('+++ ')) ficheiro = l.slice(4) === '/dev/null' ? antigo : l.slice(4).replace(/^b\//, '');
    else if (l.startsWith('@@')) linha = Number(/\+(\d+)/.exec(l)[1]);
    else if (l.startsWith('+')) {
      const texto = l.slice(1);
      for (const [re, mensagem, soEm] of REGRAS) {
        if (re.test(texto) && (!soEm || soEm(ficheiro))) comentarios.push({ ficheiro, linha, mensagem });
      }
      linha++;
    } else if (l.startsWith(' ')) linha++;
  }
  return comentarios;
}
```
</details>

### P4 · De um switch para uma tabela (≈20 min)

**Ficheiro:** `maquina.js` (o original está em `maquinaLegado.js`)

Passar as transições de estado de uma tarefa para uma tabela, com o mesmo comportamento (e o mesmo erro) do `switch` em todas as combinações, e usar a tabela para listar as ações possíveis e os estados alcançáveis.

**Sintaxe que vais praticar:** um objeto de objetos como tabela, `Object.hasOwn` (para `'toString'` não ser um estado), `Object.keys`/`Object.values`, uma pesquisa em largura com uma fila.

<details>
<summary>Pista</summary>

A tabela sai do `switch` quase linha a linha: cada `case` é uma chave, cada `if (acao === ...) return ...` é um par `acao: destino`. O teste de equivalência testa estados e ações que não existem, incluindo `'toString'` e `'constructor'`: com `TRANSICOES[estado][acao]` simples, esses dariam funções em vez de um erro.
</details>

<details>
<summary>Solução de referência</summary>

```js
// P4 · Trocar condicionais por dados: o switch de maquinaLegado.js passa a uma TABELA de
// transições. As regras ficam visíveis num só sítio, e coisas novas (que ações são possíveis
// agora? que estados se conseguem alcançar?) saem da tabela sem mais switches.

// TRANSICOES: { [estado]: { [acao]: novoEstado } }, com exatamente as mesmas transições do legado.
export const TRANSICOES = {
  rascunho: { publicar: 'aberta', cancelar: 'cancelada' },
  aberta: { comecar: 'em_curso', cancelar: 'cancelada' },
  em_curso: { bloquear: 'bloqueada', concluir: 'feita', cancelar: 'cancelada' },
  bloqueada: { desbloquear: 'em_curso', cancelar: 'cancelada' },
  feita: { reabrir: 'aberta' },
  cancelada: { reabrir: 'aberta' },
};

// seguinte(estado, acao) → o novo estado; uma transição que não existe lança o MESMO erro que o
//   legado: Error('Ação "<acao>" impossível no estado "<estado>"'). Cuidado com nomes como
//   'toString' ou 'constructor', que existem em qualquer objeto.
export function seguinte(estado, acao) {
  const destinos = Object.hasOwn(TRANSICOES, estado) ? TRANSICOES[estado] : {};
  if (!Object.hasOwn(destinos, acao)) throw new Error(`Ação "${acao}" impossível no estado "${estado}"`);
  return destinos[acao];
}

// acoesPossiveis(estado) → as ações possíveis nesse estado, por ordem alfabética ([] se não existir)
export function acoesPossiveis(estado) {
  return Object.hasOwn(TRANSICOES, estado) ? Object.keys(TRANSICOES[estado]).sort() : [];
}

// alcancaveis(desde) → os estados a que se consegue chegar a partir de `desde` com zero ou mais
//   ações (inclui o próprio), por ordem alfabética
export function alcancaveis(desde) {
  const vistos = new Set([desde]);
  const fila = [desde];
  while (fila.length) {
    for (const destino of Object.values(TRANSICOES[fila.shift()] ?? {})) {
      if (!vistos.has(destino)) {
        vistos.add(destino);
        fila.push(destino);
      }
    }
  }
  return [...vistos].sort();
}
```
</details>

## Experiências

1. **O teu código antigo:** corre o teu `detetarCheiros` nas tuas soluções dos primeiros módulos da prática. Que cheiros encontras? Refatora um deles com os testes do módulo a passar em cada passo.
2. **O ESLint com regras de complexidade:** acrescenta `max-lines-per-function`, `max-params`, `max-depth` e `complexity` à configuração do ESLint da API e corre `npm run lint`. Concordas com tudo o que aparece?
3. **O robô no teu repositório:** corre `git diff main | node -e "..."` com o teu `comentar` sobre as tuas alterações atuais. E se o pusesses no CI (módulo 20), a comentar os *pull requests*?
4. **Revê um PR a sério:** escolhe um *pull request* aberto num projeto de código aberto que uses, lê-o com a lista da secção 6, e escreve (para ti) os comentários que farias, com o peso de cada um.

## Perguntas de pensamento crítico

1. Um colega quer refatorar o módulo de faturação, que não tem testes, "para o deixar limpo". Como propões fazê-lo com segurança?
2. Porque é que extrair código duplicado nem sempre é boa ideia?
3. Recebes um *pull request* de 1800 linhas com uma funcionalidade nova, uma refatoração e uma atualização de dependências. O que fazes?

<details>
<summary>Respostas</summary>

1. Primeiro, testes de caracterização que registam o comportamento atual (incluindo o que parece errado): casos escolhidos a partir de faturas reais anonimizadas, e um *golden master* que compara a versão nova com uma cópia da antiga em muitas entradas geradas. Depois, refatorar em passos pequenos, com os testes a passar em cada passo e *commits* frequentes, usando as refatorações automáticas do editor. Os *bugs* encontrados ficam registados e são corrigidos depois, em *commits* separados, com um teste cada. E só refatorar a parte que se vai mudar a seguir, não o módulo inteiro "porque sim".
2. Porque duas partes de código parecidas podem representar conceitos diferentes que só coincidem hoje; ao juntá-las, cria-se um acoplamento: a próxima mudança num dos casos obriga a parâmetros e `if`s na função partilhada, que fica pior do que a duplicação. A regra prática é esperar pela terceira repetição (*rule of three*) e perguntar se a duplicação é de **conhecimento** (a mesma regra de negócio, que tem de mudar junta) ou só de **forma**. "A duplicação é muito mais barata do que a abstração errada" (Sandi Metz).
3. Peço, com simpatia, para o partir: um PR com a atualização de dependências (verificável pelos testes e pelo *changelog*), um com a refatoração (sem mudanças de comportamento, verificável pelos testes existentes), e um com a funcionalidade (o único que exige uma revisão de lógica a fundo). Cada um revê-se a sério e reverte-se sozinho se partir algo. Se for urgente e não der para partir, combino uma revisão em conjunto (a pessoa explica o diff) em vez de deixar 300 comentários, e combinamos que da próxima vez se parte desde o início.
</details>

<!-- quiz:start -->

## Quiz rápido (autoavaliação)

Perguntas específicas deste módulo. Responde primeiro sem espiar a resposta. Versão interativa e corrigida automaticamente: `node scripts/quiz.mjs 59`.

**1.** O que é refatorar?

- a) Reescrever o código do zero
- b) Mudar a estrutura do código sem mudar o comportamento
- c) Corrigir bugs
- d) Acrescentar funcionalidades

<details><summary>Resposta</summary>

**b) Mudar a estrutura do código sem mudar o comportamento** — Mudanças de comportamento vão noutro commit.

</details>

**2.** Como se chamam os testes que registam o que o código antigo faz agora, certo ou errado, antes de o refatorar?

<details><summary>Resposta</summary>

**testes de caracterização** — Michael Feathers, Working Effectively with Legacy Code.

</details>

**3.** Qual destes NÃO é normalmente um cheiro de código?

- a) Uma função com 7 parâmetros
- b) if aninhados com 5 níveis
- c) Uma constante com nome, MINIMO_SEM_PORTES = 50
- d) O mesmo switch sobre um tipo repetido em vários sítios

<details><summary>Resposta</summary>

**c) Uma constante com nome, MINIMO_SEM_PORTES = 50** — Dar nome aos números mágicos é precisamente a cura.

</details>

**4.** Porque se preferem pull requests pequenos?

- a) Porque o Git não aceita grandes
- b) Porque recebem revisões cuidadosas e são fáceis de reverter; os grandes recebem um 'LGTM'
- c) Porque gastam menos disco
- d) Por causa do CI

<details><summary>Resposta</summary>

**b) Porque recebem revisões cuidadosas e são fáceis de reverter; os grandes recebem um 'LGTM'** — Os defeitos encontrados por linha caem muito acima de umas 400 linhas.

</details>

**5.** Numa revisão de código, o que deve ficar para as ferramentas automáticas?

- a) O desenho da solução
- b) Os casos esquecidos
- c) A formatação, o lint e verificações mecânicas como console.log esquecidos
- d) As permissões

<details><summary>Resposta</summary>

**c) A formatação, o lint e verificações mecânicas como console.log esquecidos** — Os humanos concentram-se no que as máquinas não veem.

</details>

<!-- quiz:end -->
