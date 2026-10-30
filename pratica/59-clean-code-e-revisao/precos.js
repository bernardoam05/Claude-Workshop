// P1 · Refatorar com uma rede de segurança: a função `calc` de precosLegado.js, reescrita com
// nomes que se percebem, constantes com nome e funções pequenas, SEM mudar o comportamento.

// Começa por dar nome aos números mágicos do código antigo (os testes importam estes quatro):
//   IVA (um objeto com as taxas de 'livro', 'comida' e 'outro'), DESCONTO_VIP, PORTES e MINIMO_SEM_PORTES.
export const IVA = {};
export const DESCONTO_VIP = undefined;
export const PORTES = undefined;
export const MINIMO_SEM_PORTES = undefined;

// descontoPorQuantidade(quantidade) → 0.15 a partir de 50 unidades, 0.05 a partir de 10, senão 0
export function descontoPorQuantidade(quantidade) {
  throw new Error('Por fazer: P1');
}

// taxaIva(categoria) → a taxa de IVA da categoria ('livro', 'comida'); qualquer outra paga a de 'outro'
export function taxaIva(categoria) {
  throw new Error('Por fazer: P1');
}

// totalLinha({ preco, quantidade, categoria }) → preço × quantidade, com o desconto por
//   quantidade e depois o IVA (sem arredondar)
export function totalLinha({ preco, quantidade, categoria }) {
  throw new Error('Por fazer: P1');
}

// totalEncomenda(linhas, cliente) → o mesmo que calc(linhas antigas, cliente), arredondado ao cêntimo:
//   soma das linhas; menos DESCONTO_VIP se cliente?.vip; mais PORTES se ficar abaixo de MINIMO_SEM_PORTES
//   (as linhas usam nomes novos: { preco, quantidade, categoria } em vez de { p, q, cat })
export function totalEncomenda(linhas, cliente) {
  throw new Error('Por fazer: P1');
}
