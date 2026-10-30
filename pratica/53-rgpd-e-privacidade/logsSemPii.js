// P2 · Tirar dados pessoais dos logs.

// Nomes de campos cujo valor nunca deve ir para um log (comparação sem maiúsculas).
export const CAMPOS_SENSIVEIS = ['password', 'palavrapasse', 'token', 'authorization', 'nif', 'iban', 'cartao'];

// luhn(digitos) → true se a sequência de dígitos passar o algoritmo de Luhn (o dos cartões):
//   da direita para a esquerda, duplica um dígito sim, um não (começando no segundo); se o dobro
//   passar de 9, subtrai 9; a soma de tudo tem de ser múltipla de 10.
export function luhn(digitos) {
  throw new Error('Por fazer: P2');
}

// limparTexto(texto) → o texto com os dados pessoais substituídos:
//   - emails → '[email]'
//   - números de cartão: 13 a 19 dígitos, que podem estar separados por espaços ou hífenes, e que
//     passam o Luhn → '[cartao]' (os que não passam ficam: são ids de encomendas, por exemplo)
//   - telemóveis portugueses: 9 dígitos começados por 9, opcionalmente com +351 antes e espaços
//     entre grupos de 3 → '[telefone]'
//   Os cartões tratam-se ANTES dos telefones (senão, um pedaço de um cartão podia parecer um telefone).
export function limparTexto(texto) {
  throw new Error('Por fazer: P2');
}

// limparObjeto(valor) → uma cópia em que:
//   - os campos com nome em CAMPOS_SENSIVEIS passam a '[removido]' (em qualquer profundidade)
//   - os textos passam por limparTexto
//   - arrays e objetos são percorridos; os outros valores (números, booleanos, null) ficam iguais
export function limparObjeto(valor) {
  throw new Error('Por fazer: P2');
}
