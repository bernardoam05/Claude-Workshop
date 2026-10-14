// P2 · Guardar passwords como deve ser: um hash LENTO e com SAL (ver docs/15, secção "Prática").
// O projeto usa bcrypt (src/api/src/services/authService.js); aqui usas o scrypt do node:crypto,
// para veres as peças que o bcrypt esconde.
//
// hashPassword(password) → Promise<string> no formato 'scrypt$<sal em base64>$<hash em base64>'
//   o sal são 16 bytes aleatórios (crypto.randomBytes), diferentes em cada chamada;
//   o hash são 64 bytes de scrypt(password, sal).
//
// verificarPassword(password, guardado) → Promise<boolean>
//   true se a password der o mesmo hash com o sal guardado (compara com timingSafeEqual);
//   false se não der, ou se `guardado` não estiver no formato certo (nunca lança).
export async function hashPassword(password) {
  throw new Error('Por fazer: P2');
}

export async function verificarPassword(password, guardado) {
  throw new Error('Por fazer: P2');
}
