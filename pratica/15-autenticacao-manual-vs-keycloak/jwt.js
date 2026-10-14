// P1 · Um JWT HS256 escrito à mão, só com node:crypto (ver docs/15, secção "Prática").
// Um JWT são três partes em base64url separadas por pontos: cabeçalho.payload.assinatura
// e a assinatura é HMAC-SHA256("cabeçalho.payload", segredo).
//
// assinar(payload, segredo, { expiraEm, agora })
//   payload: objeto com as claims (ex.: { sub: '7' }).
//   expiraEm: segundos de validade (opcional). Se vier, acrescenta iat e exp ao payload.
//   agora: segundos desde 1970 (por omissão, a hora atual). Existe para os testes controlarem o tempo.
//   Devolve a string do token. O cabeçalho é sempre { alg: 'HS256', typ: 'JWT' }.
//
// verificar(token, segredo, { agora })
//   Devolve o payload se o token for válido. Lança um Error se:
//     - não tiver três partes, ou o cabeçalho/payload não forem JSON;
//     - o alg do cabeçalho não for exatamente 'HS256' (ex.: 'none' → recusado!);
//     - a assinatura não bater certo (compara com crypto.timingSafeEqual);
//     - tiver exp e exp <= agora (expirado).
export function assinar(payload, segredo, { expiraEm, agora } = {}) {
  throw new Error('Por fazer: P1');
}

export function verificar(token, segredo, { agora } = {}) {
  throw new Error('Por fazer: P1');
}
