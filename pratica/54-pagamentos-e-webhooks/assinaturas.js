// P2 · Webhooks assinados (como os da Stripe): provar que o pedido veio mesmo do fornecedor.
import { createHmac, timingSafeEqual } from 'node:crypto';

// assinar(corpo, segredo, t) → 't=<t>,v1=<hex>' em que hex é o HMAC-SHA256 de `${t}.${corpo}`
//   t: segundos desde 1970. O instante entra na assinatura para um atacante não conseguir
//   reenviar um pedido antigo com outro t.
export function assinar(corpo, segredo, t) {
  throw new Error('Por fazer: P2');
}

export class ErroAssinatura extends Error {}

// verificar(corpoBruto, cabecalho, segredos, { agora, tolerancia = 300 }) → true, ou lança ErroAssinatura
//   corpoBruto: o corpo EXATAMENTE como chegou (texto), antes de qualquer JSON.parse
//   cabecalho: 't=...,v1=...,v1=...' (pode ter várias v1 durante uma troca de segredo)
//   segredos: um segredo ou uma lista (o atual e o anterior, durante uma rotação)
//   agora: segundos desde 1970
//   Falha (ErroAssinatura) se: o cabeçalho não tiver t ou nenhuma v1; |agora − t| > tolerancia;
//   nenhuma combinação (v1, segredo) bater certo. Compara com timingSafeEqual (e confirma antes
//   que os comprimentos são iguais, senão ele lança).
export function verificar(corpoBruto, cabecalho, segredos, { agora, tolerancia = 300 }) {
  throw new Error('Por fazer: P2');
}
