import { Kafka, Partitioners, logLevel } from 'kafkajs';

// Tópico Kafka com o histórico de eventos de tarefas. Criado pelo serviço "kafka-init" do compose
// com 3 partições (ver config/docker-compose.yml).
export const TASK_EVENTS_TOPIC = 'task-events';

// Publisher Kafka. Diferença de modelo face ao RabbitMQ:
// - RabbitMQ: a mensagem é APAGADA depois do ack. Cada fila recebe uma cópia.
// - Kafka:    a mensagem fica num LOG durante o tempo de retenção. Cada consumer group lê ao seu ritmo,
//             guardando a sua posição (offset). Um consumidor novo pode reler o histórico desde o início.
export async function createKafkaPublisher({ brokers, clientId = 'workshop-api' }) {
  // Sem "retry" explícito: num produtor idempotente, limitar os retries pode quebrar a garantia de não-duplicação
  // (o kafkajs avisa disso). O limite de tempo por pedido HTTP é imposto em compositePublisher.js.
  const kafka = new Kafka({ clientId, brokers, logLevel: logLevel.WARN });
  const producer = kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner,
    // Idempotência do produtor: se um envio for repetido por causa de um retry de rede,
    // o broker deteta o duplicado e não o grava duas vezes.
    idempotent: true,
    maxInFlightRequests: 1,
  });
  await producer.connect();

  return {
    async publish(event) {
      await producer.send({
        topic: TASK_EVENTS_TOPIC,
        // A CHAVE decide a partição: o mesmo userId vai sempre para a mesma partição.
        // O Kafka só garante ordem DENTRO de uma partição, por isso os eventos de cada utilizador ficam ordenados.
        messages: [
          {
            key: String(event.task.userId),
            value: JSON.stringify(event),
            headers: { type: event.type },
          },
        ],
        acks: -1, // -1 = "all": só confirma quando todas as réplicas em sincronia gravaram
      });
    },

    async close() {
      await producer.disconnect();
    },
  };
}
