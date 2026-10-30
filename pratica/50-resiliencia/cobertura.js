// P4 · Pedidos com cobertura (hedging) e alternativas (fallback).

// comCobertura(fn, { atrasoMs, maxCopias = 2 }) → o resultado da PRIMEIRA cópia que tiver sucesso
//   Contra a latência da cauda (o p99 do módulo de testes de carga): começa fn(sinal); se ao fim de
//   atrasoMs ainda não respondeu, começa outra cópia (até maxCopias no total). A primeira a ter sucesso
//   ganha, e as outras são ABORTADAS pelo seu sinal. Se TODAS falharem, rejeita com o erro da última.
//   (Só se usa com operações idempotentes: uma leitura, nunca um pagamento.)
export async function comCobertura(fn, { atrasoMs, maxCopias = 2 }) {
  throw new Error('Por fazer: P4');
}

// comAlternativa(principal, { cache, chave }) → { valor, fonte }
//   Tenta principal(). Se tiver sucesso, guarda o valor em cache (cache.set(chave, valor)) e devolve
//   { valor, fonte: "principal" }. Se falhar, e houver um valor em cache (cache.get(chave), mesmo que
//   antigo), devolve { valor, fonte: "cache" } (melhor dados de há 5 minutos do que um erro). Se não
//   houver, propaga o erro.
export async function comAlternativa(principal, { cache, chave }) {
  throw new Error('Por fazer: P4');
}
