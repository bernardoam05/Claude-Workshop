// P2 · Sessões guardadas no servidor (o cookie só leva um id aleatório).
import { randomBytes } from 'node:crypto';

// criarSessoes({ agora = Date.now, inatividadeMs, maximoMs }) → {
//   criar(utilizador) → id: 32 bytes aleatórios em base64url (impossível de adivinhar)
//   obter(id) → { utilizador, criadaEm } ou null. A sessão expira se passar inatividadeMs desde o
//      último uso OU maximoMs desde que foi criada (uma sessão roubada não vive para sempre).
//      Cada obter com sucesso conta como uso (renova a inatividade). Expirada → é apagada e dá null.
//   rodar(id) → novo id para a MESMA sessão (mesmo utilizador e mesmo criadaEm); o id antigo deixa de
//      valer. Faz-se depois do login e de mudar privilégios (contra a "fixação de sessão"). id
//      inválido → null.
//   terminar(id)                  → apaga essa sessão (logout)
//   terminarTodas(utilizador) → quantas apagou (ex.: "terminar sessão em todos os dispositivos",
//      ou depois de mudar a password)
// }
export function criarSessoes({ agora = Date.now, inatividadeMs, maximoMs }) {
  throw new Error('Por fazer: P2');
}
