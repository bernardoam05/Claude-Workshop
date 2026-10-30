// P1 · Dinheiro em cêntimos (inteiros), nunca em números com vírgula.

// paraCentimos(texto) → inteiro: '12,34' → 1234; '1.234,5' → 123450; '7' → 700; '-0,05' → -5
//   Formato português: '.' separa os milhares (ignora-se), ',' as decimais (no máximo 2).
//   Qualquer outra coisa (letras, 3 decimais, vazio) → lança um Error('Valor inválido').
//   Não uses parseFloat: 0.1 + 0.2 !== 0.3 em vírgula flutuante. Trabalha com o texto.
export function paraCentimos(texto) {
  throw new Error('Por fazer: P1');
}

// formatar(centimos) → texto em euros, à portuguesa: 123456 → '1234,56 €'; -5 → '-0,05 €'
//   Usa Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }) e troca os espaços
//   especiais (U+00A0 e U+202F) que ele usa por espaços normais.
export function formatar(centimos) {
  throw new Error('Por fazer: P1');
}

// repartir(centimos, partes) → lista de `partes` inteiros que somam EXATAMENTE centimos, o mais
//   iguais possível; os cêntimos que sobram vão um a um para as primeiras partes.
//   repartir(1000, 3) → [334, 333, 333]. partes tem de ser um inteiro >= 1, senão Error('Número de partes inválido').
export function repartir(centimos, partes) {
  throw new Error('Por fazer: P1');
}

// comIva(centimos, taxaPercentagem) → { base, iva, total } em cêntimos inteiros
//   iva = a taxa sobre a base, arredondada ao cêntimo (metades para cima: Math.round)
//   comIva(1000, 23) → { base: 1000, iva: 230, total: 1230 }
export function comIva(centimos, taxaPercentagem) {
  throw new Error('Por fazer: P1');
}
