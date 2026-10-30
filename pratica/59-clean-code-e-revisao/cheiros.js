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
  throw new Error('Por fazer: P2');
}
