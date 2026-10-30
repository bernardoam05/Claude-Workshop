// P4 · Receber webhooks: duplicados, ordem trocada, e uma máquina de estados para o pagamento.

// Os estados de um pagamento, pela ordem em que avançam. 'falhado' é um estado final à parte.
export const ORDEM = ['pendente', 'autorizado', 'capturado', 'reembolsado'];

// criarRecetor() → { receber(evento), estado(pagamento) }
//   evento: { id, pagamento, estado } (estado é o NOVO estado do pagamento)
//   estado(pagamento) → o estado atual ('pendente' se nunca se recebeu nada)
//   receber(evento) → 'processado' | 'duplicado' | 'ignorado'
//   - um id de evento já recebido → 'duplicado' (os fornecedores entregam "pelo menos uma vez")
//   - 'falhado': só se o pagamento ainda não foi capturado (pendente ou autorizado); senão 'ignorado'
//   - um estado de ORDEM: só se estiver MAIS À FRENTE do que o atual (os eventos podem chegar fora
//     de ordem: o 'capturado' pode chegar antes do 'autorizado', que depois se ignora)
//   - nada sai de 'falhado'
//   - um estado desconhecido → lança um Error
//   Um evento ignorado conta como recebido (um reenvio dele é 'duplicado').
export function criarRecetor() {
  throw new Error('Por fazer: P4');
}
