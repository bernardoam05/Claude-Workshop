// P5 · Configuração de segurança (OWASP A05) e falhas de autenticação (A07).
//
// 1. cabecalhosSeguranca(): um middleware Express que acrescenta a TODAS as respostas:
//      Content-Security-Policy: default-src 'self'; frame-ancestors 'none'
//      X-Content-Type-Options: nosniff
//      Referrer-Policy: no-referrer
//      Strict-Transport-Security: max-age=31536000; includeSubDomains
//    e REMOVE o X-Powered-By (que o Express acrescenta, a dizer a toda a gente que és Express).
//
// 2. tokensIguais(a, b): compara dois tokens (strings) em TEMPO CONSTANTE, com crypto.timingSafeEqual.
//    Atenção: o timingSafeEqual lança um erro se os tamanhos forem diferentes; tokens de tamanhos
//    diferentes são simplesmente diferentes (devolve false).
//
// 3. cookieSessao(valor): devolve o valor do cabeçalho Set-Cookie para a sessão, com
//    HttpOnly, Secure, SameSite=Lax, Path=/ e Max-Age=3600. Ex.:
//      "sessao=abc; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600"
export function cabecalhosSeguranca() {
  return (req, res, next) => next();
}

export function tokensIguais(a, b) {
  return a === b;
}

export function cookieSessao(valor) {
  return `sessao=${valor}`;
}
