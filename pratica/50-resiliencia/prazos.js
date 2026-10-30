// P1 · Timeouts e prazos. Ver docs/50-resiliencia.md, secção "Prática".

export class ErroPrazo extends Error {}

// comPrazo(fn, ms) → o resultado de fn(sinal), ou rejeita com um ErroPrazo se demorar mais de ms.
//   fn recebe um AbortSignal que é ABORTADO quando o prazo acaba, para a operação poder PARAR (um
//   fetch com { signal } cancela o pedido; sem isto, o trabalho continuava a gastar recursos).
//   Limpa o temporizador quando fn termina (senão o processo fica vivo até ao fim do prazo).
export async function comPrazo(fn, ms) {
  throw new Error('Por fazer: P1');
}

// criarPrazo(ms, agora = Date.now) → { restante(), expirou(), filho(maxMs) }
//   Um prazo ABSOLUTO (o instante em que acaba), para passar de função em função e de serviço em serviço:
//   - restante(): milissegundos que faltam (nunca negativo)
//   - expirou(): true se já não falta nada
//   - filho(maxMs): um prazo para uma sub-chamada, que acaba no MAIS CEDO de: daqui a maxMs, ou o fim
//     deste prazo (uma chamada interna nunca pode ter mais tempo do que o pedido que a originou)
export function criarPrazo(ms, agora = Date.now) {
  throw new Error('Por fazer: P1');
}
