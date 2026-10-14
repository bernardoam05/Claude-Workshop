// P1 · O básico moderno: destructuring, spread/rest, template literals, ?. e ??, object shorthand.
// Ver docs/22-sintaxe-javascript.md, secções do início até "Optional chaining", e "Prática".

// u = { nome, morada?: { cidade? }, papeis?: [...] }
// → "Ana (Lisboa) · 2 papéis"  ·  sem morada ou sem cidade: "(sem cidade)"  ·  sem papéis: "0 papéis"
// Escreve-a com destructuring nos parâmetros, ?. , ?? e uma template literal.
export function resumirUtilizador(u) {
  throw new Error('Por fazer: P1');
}

// [a, b, c] → { primeiro: a, resto: [b, c] }   ·   [] → { primeiro: undefined, resto: [] }
export function separar(lista) {
  throw new Error('Por fazer: P1');
}

// Uma CÓPIA do objeto sem a propriedade `campo` (o original não muda).
// semCampo({ a: 1, b: 2 }, 'a') → { b: 2 }
export function semCampo(objeto, campo) {
  throw new Error('Por fazer: P1');
}

// Junta vários objetos num novo; em caso de conflito, ganha o que vem mais à direita.
// fundir({ a: 1, b: 1 }, { b: 2 }, { c: 3 }) → { a: 1, b: 2, c: 3 }
export function fundir(base, ...extras) {
  throw new Error('Por fazer: P1');
}

// criarPonto(3, 4) → { x: 3, y: 4, distanciaA(outro) } (object shorthand para x, y e para o método)
// distanciaA devolve a distância euclidiana até outro ponto.
export function criarPonto(x, y) {
  throw new Error('Por fazer: P1');
}

// Lê opções com valores por omissão, num só destructuring:
// lerOpcoes({ porta: 8080 }) → { porta: 8080, host: 'localhost', debug: false }
// lerOpcoes() → { porta: 3000, host: 'localhost', debug: false }
export function lerOpcoes(opcoes) {
  throw new Error('Por fazer: P1');
}
