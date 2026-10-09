// Publica cada evento nos DOIS brokers, com garantias diferentes de propósito:
// - RabbitMQ (worker): OBRIGATÓRIO. Se falhar, o pedido falha (como antes).
// - Kafka (serviço de atividade): BEST-EFFORT. Se falhar ou demorar, regista e conta numa métrica, mas o pedido segue.
//
// Porquê? O Kafka alimenta um painel de analítica: perder um evento ali é aceitável; bloquear a criação
// de tarefas porque a analítica está em baixo não é. Isto é uma DECISÃO, com um custo (eventos perdidos),
// e está escrita aqui para ser discutida. A solução sem perdas é o outbox (módulo 06).
//
// "Best-effort" tem de ter um LIMITE DE TEMPO. Sem timeout, um broker lento ou um produtor preso em retries
// pendura o pedido HTTP até o Nginx desistir (504), e o "opcional" passa a derrubar a funcionalidade principal.
//
// O taskService não sabe nada disto: continua a chamar publisher.publish(routingKey, event).
// A composição acontece no index.js (ponto de composição), sem tocar na lógica de negócio.
export function createCompositePublisher({ rabbit, kafka, onKafkaResult = () => {}, kafkaTimeoutMs = 2000 }) {
  return {
    async publish(routingKey, event) {
      await rabbit.publish(routingKey, event);

      if (!kafka) return;
      let timer;
      try {
        await Promise.race([
          kafka.publish(event),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`timeout de ${kafkaTimeoutMs} ms`)), kafkaTimeoutMs);
          }),
        ]);
        onKafkaResult(event.type, 'ok');
      } catch (err) {
        onKafkaResult(event.type, 'error');
        console.error(`[kafka] evento ${event.eventId} perdido (best-effort):`, err.message);
      } finally {
        clearTimeout(timer); // sem isto, cada pedido deixava um timer pendente a segurar o processo
      }
    },

    async close() {
      await rabbit.close();
      if (kafka) await kafka.close().catch(() => {});
    },
  };
}
