import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCompositePublisher } from '../src/messaging/compositePublisher.js';

const event = { eventId: 'e1', type: 'task.created', task: { id: 1, userId: 1 } };

test('publica no RabbitMQ e no Kafka', async () => {
  const sent = [];
  const publisher = createCompositePublisher({
    rabbit: { publish: async (rk) => sent.push(`rabbit:${rk}`) },
    kafka: { publish: async (e) => sent.push(`kafka:${e.type}`) },
  });

  await publisher.publish('task.created', event);

  assert.deepEqual(sent, ['rabbit:task.created', 'kafka:task.created']);
});

test('falha no RabbitMQ faz falhar o pedido (e o Kafka nem é tentado)', async () => {
  let kafkaCalled = false;
  const publisher = createCompositePublisher({
    rabbit: { publish: async () => { throw new Error('broker em baixo'); } },
    kafka: { publish: async () => { kafkaCalled = true; } },
  });

  await assert.rejects(publisher.publish('task.created', event), /broker em baixo/);
  assert.equal(kafkaCalled, false);
});

test('Kafka pendurado não pendura o pedido: desiste ao fim do timeout', async () => {
  const results = [];
  const publisher = createCompositePublisher({
    rabbit: { publish: async () => {} },
    kafka: { publish: () => new Promise(() => {}) }, // nunca resolve: simula um broker preso
    onKafkaResult: (type, result) => results.push(result),
    kafkaTimeoutMs: 50,
  });
  const originalError = console.error;
  console.error = () => {};

  const start = Date.now();
  try {
    await publisher.publish('task.created', event);
  } finally {
    console.error = originalError;
  }

  assert.ok(Date.now() - start < 1000, 'o pedido devia ter seguido logo após o timeout');
  assert.deepEqual(results, ['error']);
});

test('falha no Kafka NÃO faz falhar o pedido, mas é registada na métrica', async () => {
  const results = [];
  const publisher = createCompositePublisher({
    rabbit: { publish: async () => {} },
    kafka: { publish: async () => { throw new Error('kafka em baixo'); } },
    onKafkaResult: (type, result) => results.push(`${type}:${result}`),
  });
  const originalError = console.error;
  console.error = () => {}; // silenciar o log esperado durante o teste

  try {
    await publisher.publish('task.created', event);
  } finally {
    console.error = originalError;
  }

  assert.deepEqual(results, ['task.created:error']);
});
