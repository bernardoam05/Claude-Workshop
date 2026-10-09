import amqp from 'amqplib';

// Topic exchange: encaminha cada mensagem para as filas cujo "binding" bate com a routing key.
// Ex.: routing key "task.completed" chega a uma fila ligada a "task.*".
export const EXCHANGE = 'tasks';

// O broker pode demorar a ficar pronto no arranque. Tentamos várias vezes antes de desistir.
export async function connectWithRetry(url, { retries = 10, delayMs = 2000 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await amqp.connect(url);
    } catch (err) {
      if (attempt >= retries) throw err;
      console.warn(`[rabbit] tentativa ${attempt} falhou, a repetir em ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function createPublisher(url) {
  let connection = null;
  let channel = null;
  let opening = null;

  // Abre uma ligação e um canal novos. Chamada no arranque e sempre que a ligação tiver caído.
  async function open(retries) {
    const conn = await connectWithRetry(url, { retries });
    // Sem estes listeners, um erro de rede é um "unhandled error" e mata o processo inteiro.
    conn.on('error', (err) => console.error('[rabbit] erro na ligação:', err.message));
    conn.on('close', () => {
      console.warn('[rabbit] ligação fechada; será reaberta no próximo publish');
      connection = null;
      channel = null;
    });

    // Confirm channel: o broker responde "recebi" a cada mensagem. Sem isto, publicar é "dispara e esquece".
    const ch = await conn.createConfirmChannel();
    ch.on('error', (err) => console.error('[rabbit] erro no canal:', err.message));
    await ch.assertExchange(EXCHANGE, 'topic', { durable: true });

    connection = conn;
    channel = ch;
    return ch;
  }

  // Garante um canal aberto. Se já houver um a abrir-se, espera por esse (evita ligações duplicadas).
  function ensureChannel(retries) {
    if (channel) return Promise.resolve(channel);
    opening ??= open(retries).finally(() => {
      opening = null;
    });
    return opening;
  }

  // No arranque insistimos: se o broker nunca aparecer, o processo deve falhar.
  await ensureChannel(10);

  return {
    async publish(routingKey, message) {
      // Num pedido HTTP não podemos esperar 20 segundos por um retry: uma única tentativa de reabrir.
      const ch = await ensureChannel(1);
      const body = Buffer.from(JSON.stringify(message));

      return new Promise((resolve, reject) => {
        ch.publish(
          EXCHANGE,
          routingKey,
          body,
          // persistent: a mensagem vai para disco (sobrevive a reinício do broker, desde que a fila seja durável)
          { persistent: true, contentType: 'application/json' },
          (err) => (err ? reject(err) : resolve()),
        );
      });
    },

    async close() {
      if (channel) await channel.close().catch(() => {});
      if (connection) await connection.close().catch(() => {});
    },
  };
}
