import amqp, { type Channel, type ChannelModel } from 'amqplib';
import pg from 'pg';
import { config } from './config.js';
import { createEventHandler, MalformedEventError, parseJson } from './handler.js';

const EXCHANGE = 'tasks';              // o mesmo exchange que a API publica
const QUEUE = 'worker.task-events';    // a fila DESTE consumidor
const DLX = 'tasks.dlx';               // dead-letter exchange: para onde vão as mensagens rejeitadas
const DLQ = 'worker.task-events.dlq';  // dead-letter queue: onde ficam para inspeção manual

async function connectWithRetry(url: string, retries = 10, delayMs = 2000): Promise<ChannelModel> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await amqp.connect(url);
    } catch (err) {
      if (attempt >= retries) throw err;
      console.warn(`[worker] RabbitMQ indisponível (tentativa ${attempt}), a repetir...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function main(): Promise<void> {
  const db = new pg.Pool({ connectionString: config.databaseUrl, max: 5 });
  const connection = await connectWithRetry(config.rabbitUrl);
  const channel: Channel = await connection.createChannel();

  // Se a ligação cair (ex.: o RabbitMQ reiniciou), o consumidor deixa de existir.
  // Em vez de ficar "vivo" e surdo, saímos com erro e o Docker (restart policy) reinicia-nos com estado limpo.
  let shuttingDown = false;
  connection.on('error', (err: Error) => console.error('[worker] erro na ligação ao RabbitMQ:', err.message));
  connection.on('close', () => {
    if (shuttingDown) return;
    console.error('[worker] ligação ao RabbitMQ perdida, a sair para o Docker reiniciar');
    process.exit(1);
  });

  // Topologia: declarada por QUEM consome. Todas as declarações são idempotentes.
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  await channel.assertExchange(DLX, 'fanout', { durable: true });
  await channel.assertQueue(DLQ, { durable: true });
  await channel.bindQueue(DLQ, DLX, '');
  await channel.assertQueue(QUEUE, { durable: true, deadLetterExchange: DLX });
  await channel.bindQueue(QUEUE, EXCHANGE, 'task.*');

  // Controlo de fluxo: no máximo 10 mensagens entregues e ainda não confirmadas.
  await channel.prefetch(10);

  const handle = createEventHandler({
    // Adaptador: o pg.Pool tem mais métodos do que o Queryable precisa. O TS aceita porque só usamos "query".
    db: { query: (sql, params) => db.query(sql, params as unknown[]) },
  });

  await channel.consume(QUEUE, async (msg) => {
    if (msg === null) return; // o broker cancelou o consumidor
    try {
      const value = parseJson(msg.content);
      const result = await handle(value);
      console.log(`[worker] ${msg.fields.routingKey} → ${result}`);
      channel.ack(msg); // ACK só DEPOIS de o trabalho estar feito
    } catch (err) {
      if (err instanceof MalformedEventError) {
        console.error('[worker] mensagem inválida → DLQ:', err.message);
        channel.nack(msg, false, false); // requeue=false + DLX configurado → vai para a DLQ
      } else {
        console.error('[worker] erro transitório, a devolver à fila:', (err as Error).message);
        channel.nack(msg, false, true); // requeue=true → o broker volta a entregar
      }
    }
  });

  console.log(`[worker] a consumir ${QUEUE}`);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[worker] ${signal} recebido, a encerrar`);
    shuttingDown = true;
    await channel.close().catch(() => {});
    await connection.close().catch(() => {});
    await db.end();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  console.error('[worker] falha no arranque:', err);
  process.exit(1);
});
