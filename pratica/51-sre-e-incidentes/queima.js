// P2 · Taxa de queima (burn rate) e alertas em várias janelas.

// taxaDeQueima({ maus, total, slo }) → a que velocidade se está a gastar o orçamento de erro
//   = (fração de maus) / (fração permitida pelo SLO). 1 = gasta o orçamento exatamente no fim do
//   período; 10 = gasta-o 10 vezes mais depressa. Sem pedidos → 0.
export function taxaDeQueima({ maus, total, slo }) {
  throw new Error('Por fazer: P2');
}

// As regras do livro de SRE da Google (Workbook, cap. 5) para um SLO de 30 dias: cada regra
// exige que a janela LONGA e a CURTA estejam ambas acima do limite. A longa prova que o problema
// é significativo; a curta prova que ainda está a acontecer (o alerta desliga-se depressa).
export const REGRAS = [
  { longa: '1h', curta: '5m', limite: 14.4, acao: 'pagina' }, // 2% do orçamento numa hora
  { longa: '6h', curta: '30m', limite: 6, acao: 'pagina' }, // 5% em seis horas
  { longa: '3d', curta: '6h', limite: 1, acao: 'ticket' }, // 10% em três dias
];

// avaliarAlertas(janelas, slo) → { acao: 'pagina' | 'ticket' | null, regra: '1h/5m' | ... | null }
//   janelas: { '5m': { maus, total }, '30m': ..., '1h': ..., '6h': ..., '3d': ... }
//   Devolve a PRIMEIRA regra (pela ordem de REGRAS) cujas duas janelas tenham uma taxa de queima
//   >= limite. Uma janela que falte conta como taxa 0.
export function avaliarAlertas(janelas, slo) {
  throw new Error('Por fazer: P2');
}
