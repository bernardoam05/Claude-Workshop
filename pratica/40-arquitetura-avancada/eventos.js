// P2 · Event sourcing e CQRS: o estado de uma conta é a soma dos eventos que lhe aconteceram.
//
// Eventos: { tipo: "ContaAberta", contaId, titular } · { tipo: "Depositado", contaId, valor }
//          { tipo: "Levantado", contaId, valor }      · { tipo: "ContaFechada", contaId }

// aplicar(estado, evento) → o estado seguinte (PURA: não muda o estado recebido, devolve um novo).
//   estado: null (antes de aberta) ou { contaId, titular, saldo, aberta }
export function aplicar(estado, evento) {
  throw new Error('Por fazer: P2');
}

// reconstruir(eventos) → o estado atual, aplicando os eventos por ordem a partir de null.
export function reconstruir(eventos) {
  throw new Error('Por fazer: P2');
}

// Comandos: recebem o estado ATUAL e devolvem os eventos a gravar (ou lançam um Error se o comando for
// inválido). Não mudam nada: decidir e mudar são passos separados.
//   abrir(estado, contaId, titular): só se estado for null
//   depositar(estado, valor): conta aberta, valor > 0
//   levantar(estado, valor): conta aberta, valor > 0, e valor <= saldo (senão Error com "saldo")
//   fechar(estado): conta aberta com saldo 0
export function abrir(estado, contaId, titular) {
  throw new Error('Por fazer: P2');
}
export function depositar(estado, valor) {
  throw new Error('Por fazer: P2');
}
export function levantar(estado, valor) {
  throw new Error('Por fazer: P2');
}
export function fechar(estado) {
  throw new Error('Por fazer: P2');
}

// ArmazemDeEventos: guarda os eventos por stream (um stream por conta), só acrescentando.
//   acrescentar(streamId, eventos, versaoEsperada): versaoEsperada é o número de eventos que o stream
//     tinha quando o leste; se entretanto mudou, Error com "concorrência" (bloqueio otimista, módulo 38).
//     Cada evento guardado fica com { ...evento, versao: <posição no stream, a começar em 1> }.
//   ler(streamId) → os eventos desse stream ([] se não existir)
//   todos() → todos os eventos de todos os streams, pela ordem em que foram gravados
//   subscrever(fn) → fn(evento) é chamada para cada evento novo gravado (para as projeções)
export class ArmazemDeEventos {
  constructor() {
    throw new Error('Por fazer: P2');
  }
}

// executar(armazem, contaId, comando, ...args): o ciclo de um comando:
//   lê o stream, reconstrói o estado, chama comando(estado, ...args), e acrescenta os eventos com a
//   versão lida. Devolve o estado novo.
export function executar(armazem, contaId, comando, ...args) {
  throw new Error('Por fazer: P2');
}

// ProjecaoSaldos: o lado de LEITURA (CQRS). Um modelo pensado para uma consulta: o saldo total de cada
// titular, somando todas as suas contas abertas.
//   new ProjecaoSaldos(armazem): lê os eventos que já existem e subscreve os novos
//   saldoDe(titular) → number (0 se não houver)
export class ProjecaoSaldos {
  constructor(armazem) {
    throw new Error('Por fazer: P2');
  }
}
