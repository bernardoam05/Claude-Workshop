// P2 · Como um consumer group divide as partições pelos seus consumidores
// (ver docs/17-kafka.md, secção 4 e "Prática").
// Ambas recebem o número de partições (ids 0, 1, 2...) e a lista de consumidores, e devolvem um
// objeto { consumidor: [partições] }, com TODOS os consumidores como chave (um consumidor sem
// partições fica com []). Os consumidores são tratados por ordem alfabética, como faz o Kafka.
//
// atribuirRange(numeroDeParticoes, consumidores)
//   cada consumidor recebe um BLOCO contíguo; se a divisão não for exata, os primeiros
//   consumidores recebem uma partição a mais. Ex.: 7 partições, [a, b, c] → a:[0,1,2] b:[3,4] c:[5,6]
//
// atribuirRoundRobin(numeroDeParticoes, consumidores)
//   distribui uma a uma, à vez, como quem dá cartas. Ex.: 7 partições, [a, b, c] → a:[0,3,6] b:[1,4] c:[2,5]
export function atribuirRange(numeroDeParticoes, consumidores) {
  throw new Error('Por fazer: P2');
}

export function atribuirRoundRobin(numeroDeParticoes, consumidores) {
  throw new Error('Por fazer: P2');
}
