// P3 · Uma cache partilhada (o que uma CDN ou um proxy faz), à frente de uma origem.
import { interpretarCacheControl, tempoDeVida } from './cacheControl.js';

// criarCacheHttp({ origem, agora = Date.now }) → { obter(url, cabecalhosPedido = {}) }
//   origem: async (url, cabecalhosPedido) → { estado, cabecalhos, corpo } (cabeçalhos em minúsculas)
//   agora: função que dá o tempo em milissegundos (os testes usam um relógio falso)
//   obter → { estado, cabecalhos, corpo, cache } em que cache é 'MISS' | 'HIT' | 'REVALIDADA' | 'OBSOLETA'
//
//   Chave da cache: o url mais, se a resposta guardada tiver Vary (ex.: 'accept-language'), os
//   valores desses cabeçalhos do pedido. (Guarda por url a lista de cabeçalhos do Vary, e a chave
//   completa é o url com esses valores.)
//   - Só se guardam respostas 200 com tempoDeVida(..., { partilhada: true }) > 0, ou com ETag
//     (essas podem ser revalidadas mesmo com tempo de vida 0, como as de 'no-cache'). Nunca as 'no-store'.
//   - Entrada fresca → devolve-a, cache 'HIT', sem chamar a origem.
//   - Entrada expirada com ETag → chama a origem com If-None-Match; se vier 304, a entrada volta a
//     estar fresca (a contar de agora; usa o Cache-Control do 304 se tiver, senão o guardado) e
//     devolve-se o corpo guardado com cache 'REVALIDADA'; se vier outra coisa, trata-se como um MISS.
//   - Se a origem lançar um erro e houver uma entrada expirada há menos segundos do que o
//     stale-if-error do seu Cache-Control → devolve-a com cache 'OBSOLETA'. Senão, o erro propaga.
//   - O resto é 'MISS': pede à origem, guarda se puder, devolve.
export function criarCacheHttp({ origem, agora = Date.now }) {
  throw new Error('Por fazer: P3');
}
