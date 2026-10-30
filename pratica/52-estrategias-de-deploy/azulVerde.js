// P3 · Azul/verde: duas versões completas lado a lado, e o tráfego muda de uma vez.

// criarAzulVerde({ azul, verde, verificarSaude }) → { get ativo, encaminhar(pedido), trocar(), reverter() }
//   azul e verde: funções async (pedido) → resposta (as duas "instalações")
//   verificarSaude(cor): async → true/false
//   ativo: 'azul' no início
//   encaminhar(pedido): manda o pedido para a cor ativa
//   trocar(): passa o tráfego para a OUTRA cor, mas só se verificarSaude(outra) der true;
//             senão lança um Error e fica tudo como estava. Devolve a nova cor ativa.
//   reverter(): volta à cor anterior SEM verificar a saúde (reverter tem de ser imediato: a anterior
//             estava a funcionar há minutos). Lança um Error se nunca houve troca. Devolve a cor ativa.
export function criarAzulVerde({ azul, verde, verificarSaude }) {
  throw new Error('Por fazer: P3');
}
