import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createConsumer } from './consumer.js';
import { PermanentError } from './errors.js';

// Um canal falso: regista, por ordem, tudo o que o consumidor lhe pede.
function fakeChannel() {
  const log = [];
  return {
    log,
    ack: (msg) => log.push(['ack', msg]),
    nack: (msg, allUpTo, requeue) => log.push(['nack', msg, allUpTo, requeue]),
    sendToQueue: (queue, content, options) => log.push(['sendToQueue', queue, content, options]),
  };
}

// Uma mensagem como as que o amqplib entrega.
const mensagem = (body, headers = {}) => ({
  content: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)),
  fields: { routingKey: 'task.completed' },
  properties: { headers },
});

const queue = 'worker.task-events';

describe('P2 · createConsumer', () => {
  it('sucesso → ack (e o handle recebe o JSON já convertido)', async () => {
    const channel = fakeChannel();
    const recebidos = [];
    const onMessage = createConsumer({ channel, queue, handle: async (v) => recebidos.push(v) });
    const msg = mensagem({ eventId: 'e1' });

    assert.equal(await onMessage(msg), 'ack');
    assert.deepEqual(recebidos, [{ eventId: 'e1' }]);
    assert.deepEqual(channel.log, [['ack', msg]]);
  });

  it('JSON inválido → DLQ (nack sem requeue), sem sequer chamar o handle', async () => {
    const channel = fakeChannel();
    let chamado = false;
    const onMessage = createConsumer({ channel, queue, handle: async () => (chamado = true) });
    const msg = mensagem('{isto não é json');

    assert.equal(await onMessage(msg), 'dlq');
    assert.equal(chamado, false);
    assert.deepEqual(channel.log, [['nack', msg, false, false]]);
  });

  it('PermanentError → DLQ logo à primeira', async () => {
    const channel = fakeChannel();
    const onMessage = createConsumer({
      channel,
      queue,
      handle: async () => {
        throw new PermanentError('falta o campo task');
      },
    });
    const msg = mensagem({});
    assert.equal(await onMessage(msg), 'dlq');
    assert.deepEqual(channel.log, [['nack', msg, false, false]]);
  });

  it('erro transitório → volta à fila com x-retries=1 (persistente), e SÓ DEPOIS ack da original', async () => {
    const channel = fakeChannel();
    const onMessage = createConsumer({
      channel,
      queue,
      maxRetries: 3,
      handle: async () => {
        throw new Error('BD em baixo');
      },
    });
    const msg = mensagem({ eventId: 'e1' }, { 'x-origem': 'api' });

    assert.equal(await onMessage(msg), 'retry');
    assert.equal(channel.log.length, 2);
    const [[op1, fila, conteudo, opcoes], [op2, ackMsg]] = channel.log;
    assert.equal(op1, 'sendToQueue', 'primeiro republica...');
    assert.equal(fila, queue);
    assert.ok(conteudo.equals(msg.content), 'o conteúdo republicado tem de ser o mesmo');
    assert.equal(opcoes.persistent, true);
    assert.deepEqual(opcoes.headers, { 'x-origem': 'api', 'x-retries': 1 }, 'mantém os outros cabeçalhos');
    assert.equal(op2, 'ack', '...e só depois confirma a original');
    assert.equal(ackMsg, msg);
  });

  it('as tentativas acumulam-se e, ao chegar a maxRetries, a mensagem vai para a DLQ', async () => {
    const channel = fakeChannel();
    const onMessage = createConsumer({
      channel,
      queue,
      maxRetries: 3,
      handle: async () => {
        throw new Error('BD em baixo');
      },
    });

    assert.equal(await onMessage(mensagem({}, { 'x-retries': 2 })), 'retry');
    assert.equal(channel.log[0][3].headers['x-retries'], 3);

    const ultima = mensagem({}, { 'x-retries': 3 });
    assert.equal(await onMessage(ultima), 'dlq');
    assert.deepEqual(channel.log.at(-1), ['nack', ultima, false, false]);
  });

  it('funciona com mensagens sem cabeçalhos (properties.headers undefined)', async () => {
    const channel = fakeChannel();
    const onMessage = createConsumer({
      channel,
      queue,
      handle: async () => {
        throw new Error('timeout');
      },
    });
    const msg = { content: Buffer.from('{}'), fields: { routingKey: 'x' }, properties: {} };
    assert.equal(await onMessage(msg), 'retry');
    assert.deepEqual(channel.log[0][3].headers, { 'x-retries': 1 });
  });
});
