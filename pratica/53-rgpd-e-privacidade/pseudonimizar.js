// P1 · Minimização, pseudonimização e máscaras.
import { createHmac } from 'node:crypto';

// minimizar(objeto, campos) → um objeto novo só com os campos da lista (os que existem).
//   "Recolhe e guarda só o que precisas para a finalidade."
export function minimizar(objeto, campos) {
  throw new Error('Por fazer: P1');
}

// pseudonimo(valor, chave) → texto hexadecimal de 64 caracteres: o HMAC-SHA256 do valor com a chave.
//   O mesmo valor dá sempre o mesmo pseudónimo (dá para juntar dados do mesmo titular nas
//   análises), mas sem a chave não se consegue voltar ao valor nem testar valores à sorte.
//   O valor é normalizado antes: sem espaços nas pontas e em minúsculas.
export function pseudonimo(valor, chave) {
  throw new Error('Por fazer: P1');
}

// mascararEmail('ana.silva@exemplo.pt') → 'a********@exemplo.pt'
//   Mantém a primeira letra e o domínio; o resto da parte local passa a '*' (o mesmo número).
//   Um email com parte local de 1 letra fica 'a@...' . Texto sem '@' → lança um Error('Email inválido').
export function mascararEmail(email) {
  throw new Error('Por fazer: P1');
}

// mascararFim(texto, visiveis = 4) → só os últimos `visiveis` caracteres que não são espaços ficam
//   visíveis; os outros caracteres que não são espaços passam a '•'. Os espaços mantêm-se.
//   mascararFim('PT50 0002 0123 1234 5678 9015 4') → '•••• •••• •••• •••• •••• •015 4'
export function mascararFim(texto, visiveis = 4) {
  throw new Error('Por fazer: P1');
}
