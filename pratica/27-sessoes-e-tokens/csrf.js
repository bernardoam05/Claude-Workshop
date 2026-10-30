// P4 · Proteção contra CSRF quando a autenticação vai num cookie.
// Com um cookie, o browser envia-o SOZINHO em qualquer pedido para o teu site, incluindo um
// formulário escondido noutro site. Duas defesas, em camadas: confirmar a origem do pedido, e
// exigir um token que um site alheio não consegue ler.
import { createHmac, timingSafeEqual } from 'node:crypto';

const SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

// origemPermitida({ metodo, cabecalhos }, origensPermitidas) → true/false
//   cabecalhos com nomes em minúsculas.
//   - métodos seguros (GET, HEAD, OPTIONS) → true (não mudam nada)
//   - se houver 'sec-fetch-site': 'same-origin' → true; 'cross-site' ou 'same-site' → false
//     (só 'none', o utilizador a escrever o URL, continua para as regras seguintes)
//   - senão, se houver 'origin': true se estiver na lista
//   - senão, se houver 'referer': true se a origem do referer (new URL(referer).origin) estiver na lista
//   - sem nada disto → false (na dúvida, recusa)
export function origemPermitida({ metodo, cabecalhos }, origensPermitidas) {
  throw new Error('Por fazer: P4');
}

// tokenCsrf(sessaoId, segredo) → HMAC-SHA256 do id da sessão com o segredo, em base64url.
//   O servidor dá-o à página (num meta ou numa resposta JSON); a página manda-o de volta num
//   cabeçalho X-CSRF-Token. Um site alheio não o consegue ler nem calcular.
export function tokenCsrf(sessaoId, segredo) {
  throw new Error('Por fazer: P4');
}

// validarCsrf({ metodo, cabecalhos }, sessaoId, segredo) → true/false
//   Métodos seguros → true. Senão, o cabeçalho 'x-csrf-token' tem de ser igual a
//   tokenCsrf(sessaoId, segredo), comparado em tempo constante. Sem sessão ou sem token → false.
export function validarCsrf({ metodo, cabecalhos }, sessaoId, segredo) {
  throw new Error('Por fazer: P4');
}
