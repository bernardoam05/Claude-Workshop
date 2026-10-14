// P1 · Como o Kafka escolhe a partição de uma mensagem com chave (ver docs/17-kafka.md, "Prática").
// É o algoritmo do produtor Java oficial, que o kafkajs copia (o Partitioners.DefaultPartitioner
// do src/api/src/messaging/kafkaPublisher.js). Por isso, produtores em Java e em Node mandam a
// mesma chave para a mesma partição.
//
// murmur2(chave) → inteiro de 32 bits COM sinal, o hash MurmurHash2 dos bytes UTF-8 da chave,
//   com a semente 0x9747b28c. O algoritmo (o mesmo do Kafka) está descrito passo a passo no módulo.
//
// particao(chave, numeroDeParticoes) → (murmur2(chave) & 0x7fffffff) % numeroDeParticoes
//   (o & 0x7fffffff tira o sinal: um hash negativo daria um resto negativo)
export function murmur2(chave) {
  throw new Error('Por fazer: P1');
}

export function particao(chave, numeroDeParticoes) {
  throw new Error('Por fazer: P1');
}
