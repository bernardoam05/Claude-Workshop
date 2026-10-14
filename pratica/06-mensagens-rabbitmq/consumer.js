// P2 · Um consumidor que decide ack / retry / DLQ, com um número MÁXIMO de tentativas.
//
// createConsumer({ channel, queue, handle, maxRetries }) devolve onMessage(msg), a função que
// se passaria a channel.consume(queue, onMessage). `channel` tem a forma de um canal do amqplib:
//   channel.ack(msg)
//   channel.nack(msg, allUpTo, requeue)       → com requeue=false, vai para a DLQ
//   channel.sendToQueue(queue, content, options)
// e `msg` também: { content: Buffer, fields: { routingKey }, properties: { headers } }.
//
// onMessage devolve 'ack', 'retry' ou 'dlq' (útil para logs) e decide assim:
//   - corpo que não é JSON → DLQ
//   - handle(valor) correu bem → ack
//   - handle lançou PermanentError → DLQ
//   - handle lançou outro erro (transitório) → tentar outra vez, até maxRetries vezes:
//       volta a pôr a mensagem na fila com o cabeçalho "x-retries" a contar as tentativas
//       (e persistent: true), e só DEPOIS faz ack da original;
//       quando x-retries já chegou a maxRetries → DLQ.
// Regras completas em docs/06-mensagens-rabbitmq.md, secção "Prática".
export function createConsumer({ channel, queue, handle, maxRetries = 3 }) {
  throw new Error('Por fazer: P2');
}
