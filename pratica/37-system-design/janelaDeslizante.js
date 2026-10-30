// P4 · Limitar pedidos com uma janela deslizante aproximada, sobre um armazenamento partilhado
// (como o Redis), para funcionar com várias réplicas da API.
//
// O problema da janela fixa (módulo 05): com 100 pedidos por minuto, um cliente pode fazer 100 no
// último segundo de um minuto e mais 100 no primeiro segundo do seguinte: 200 em 2 segundos.
//
// A janela deslizante aproximada conta os pedidos do minuto ATUAL e do ANTERIOR, e pesa o anterior
// pela fração que ainda cabe na janela:
//     estimativa = anterior × (1 − tempo decorrido no minuto atual / duração) + atual
//
// new JanelaDeslizante({ armazem, limite, janelaMs, agora = Date.now })
//   armazem: { async incr(chave), async get(chave), async expire(chave, segundos) } (como o Redis;
//            get devolve um número, ou null se a chave não existir)
//   async permitir(cliente) → { permitido, restantes }
//     - janela atual = Math.floor(agora() / janelaMs); chaves "lim:<cliente>:<n.º da janela>"
//     - calcula a estimativa COM este pedido; se passar do limite, recusa SEM contar o pedido
//     - se permitir, incrementa o contador da janela atual e põe-lhe uma expiração de 2 janelas
//       (em segundos, arredondado para cima)
//     - restantes = limite − estimativa (arredondada para cima), nunca abaixo de 0
export class JanelaDeslizante {
  constructor({ armazem, limite, janelaMs, agora = Date.now }) {
    throw new Error('Por fazer: P4');
  }
}
