// P4 · O vizinho ruidoso: um inquilino com muito tráfego não pode atrasar os outros.

// criarFilaJusta() → { adicionar(inquilino, trabalho), proxima(), get tamanho }
//   Uma fila por inquilino; proxima() vai rodando entre os inquilinos (round-robin), um trabalho
//   de cada vez, pela ordem em que os inquilinos chegaram; dentro de cada inquilino, por ordem de
//   chegada. Um inquilino que fica sem trabalhos sai da rotação, e se voltar entra no fim.
//   proxima() → { inquilino, trabalho }, ou null se não houver nada.
export function criarFilaJusta() {
  throw new Error('Por fazer: P4');
}

// criarQuotas({ porMinuto, excecoes = {}, agora = Date.now }) → { permitir(inquilino) }
//   Limite de pedidos por inquilino em janelas fixas de um minuto (a janela de um instante t é
//   Math.floor(t / 60000)). O limite é excecoes[inquilino] se existir (os planos pagos), senão porMinuto.
//   permitir → { permitido, restantes }: conta o pedido se for permitido; restantes é quantos
//   ainda pode fazer nesta janela (0 quando é recusado). Cada inquilino tem a sua contagem.
export function criarQuotas({ porMinuto, excecoes = {}, agora = Date.now }) {
  throw new Error('Por fazer: P4');
}
