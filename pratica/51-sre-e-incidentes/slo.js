// P1 · SLI, SLO e orçamento de erro.

// sli(pedidos, { latenciaMaxMs }) → fração de pedidos "bons" (0..1)
//   Um pedido { estado, ms } é bom se não for um erro do servidor (estado < 500) E tiver demorado
//   no máximo latenciaMaxMs. Os 4xx contam como bons: são erros do cliente, não do serviço.
//   Sem pedidos → 1 (nada correu mal).
export function sli(pedidos, { latenciaMaxMs }) {
  throw new Error('Por fazer: P1');
}

// orcamento({ slo, total, maus }) → { permitidos, gastos, restante }
//   permitidos: quantos pedidos maus o SLO deixa ter neste período ((1 - slo) × total)
//   gastos: os maus que já houve
//   restante: a fração do orçamento que sobra (1 = intacto, 0 = gasto, negativo = SLO violado)
export function orcamento({ slo, total, maus }) {
  throw new Error('Por fazer: P1');
}

// indisponibilidadePermitida(slo, dias) → minutos de indisponibilidade total que o SLO permite
//   num período de `dias` dias (ex.: 99,9% em 30 dias → 43,2 minutos).
export function indisponibilidadePermitida(slo, dias) {
  throw new Error('Por fazer: P1');
}
