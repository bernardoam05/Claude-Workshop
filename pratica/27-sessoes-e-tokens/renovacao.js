// P3 · Tokens de acesso curtos + tokens de renovação que rodam, com deteção de reutilização.
import { randomBytes } from 'node:crypto';

export class ErroReutilizacao extends Error {}

// criarEmissor({ agora = Date.now, vidaAcessoS = 900, vidaRenovacaoS = 30 * 24 * 3600 }) → {
//   emitir(utilizador) → { acesso, renovacao } (dois tokens aleatórios novos, de 32 bytes em
//      base64url) que começam uma "família" nova (um login = uma família)
//   validarAcesso(acesso) → utilizador, ou null se não existir ou tiver expirado
//   renovar(renovacao) → { acesso, renovacao } novos, da mesma família; o de renovação usado
//      fica GASTO. Erros:
//      - token desconhecido ou expirado → Error('Token de renovação inválido')
//      - token já GASTO → alguém o copiou (o utilizador legítimo ou o atacante já o tinha usado):
//        revoga a família inteira (todos os seus tokens de acesso e de renovação deixam de valer)
//        e lança ErroReutilizacao
//   revogarFamilia(renovacao) → logout: invalida a família desse token
// }
export function criarEmissor({ agora = Date.now, vidaAcessoS = 900, vidaRenovacaoS = 30 * 24 * 3600 } = {}) {
  throw new Error('Por fazer: P3');
}
