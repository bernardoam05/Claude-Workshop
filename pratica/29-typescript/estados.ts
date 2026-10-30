// P2 · Uniões discriminadas e verificação exaustiva.

// EstadoPedido<T>: o estado de um pedido a uma API, em que cada estado só tem os campos que fazem
// sentido nele (é impossível ter "dados" e "erro" ao mesmo tempo):
//   { tipo: "inativo" } | { tipo: "a_carregar" } | { tipo: "sucesso"; dados: T } | { tipo: "erro"; mensagem: string }
export type EstadoPedido<T> = unknown;

// Acao<T>: o que pode acontecer:
//   { tipo: "pedir" } | { tipo: "recebido"; dados: T } | { tipo: "falhou"; mensagem: string } | { tipo: "repor" }
export type Acao<T> = unknown;

// reduzir(estado, acao) → o estado seguinte (como um reducer do React):
//   pedir → a_carregar · recebido → sucesso com os dados · falhou → erro com a mensagem · repor → inativo
// Um switch sobre acao.tipo, com um default que chama nunca(acao): se um dia acrescentarem um tipo de
// ação e se esquecerem dele aqui, o código deixa de COMPILAR.
export function reduzir(estado, acao) {
  throw new Error('Por fazer: P2');
}

// descrever(estado: EstadoPedido<unknown[]>) → um texto para o ecrã:
//   inativo → "" · a_carregar → "A carregar…" · sucesso → "<n> resultados" (ou "1 resultado") ·
//   erro → "Erro: <mensagem>". Também exaustivo, com nunca().
export function descrever(estado) {
  throw new Error('Por fazer: P2');
}

// nunca(x): a função que só aceita "never". Se for chamada em tempo de execução, lança um erro.
export function nunca(x) {
  throw new Error('Por fazer: P2');
}
