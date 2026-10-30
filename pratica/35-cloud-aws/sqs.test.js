import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GetQueueAttributesCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { aws, unico } from './ajuda.js';
import { criarFilaComDlq, enviar, processarLote } from './sqs.js';

const contar = async (sqs, url) =>
  Number((await sqs.send(new GetQueueAttributesCommand({ QueueUrl: url, AttributeNames: ['ApproximateNumberOfMessages'] }))).Attributes.ApproximateNumberOfMessages);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

describe('P2 · SQS', () => {
  it('cria a fila com a DLQ ligada pela redrive policy', async () => {
    const { sqs } = aws();
    const { filaUrl, dlqUrl } = await criarFilaComDlq(sqs, unico('eventos'), { maxRecebimentos: 2, visibilidade: 1 });
    assert.match(dlqUrl, /-dlq$/);
    const { Attributes } = await sqs.send(new GetQueueAttributesCommand({ QueueUrl: filaUrl, AttributeNames: ['All'] }));
    assert.equal(Attributes.VisibilityTimeout, '1');
    const redrive = JSON.parse(Attributes.RedrivePolicy);
    assert.match(redrive.deadLetterTargetArn, /-dlq$/);
    assert.equal(String(redrive.maxReceiveCount), '2');
  });

  it('as mensagens processadas com sucesso são apagadas', async () => {
    const { sqs } = aws();
    const { filaUrl } = await criarFilaComDlq(sqs, unico('eventos'));
    await enviar(sqs, filaUrl, { tipo: 'nota.criada', id: 1 });
    await enviar(sqs, filaUrl, { tipo: 'nota.criada', id: 2 });
    const vistos = [];
    let total = 0;
    for (let i = 0; i < 5 && total < 2; i++) total += (await processarLote(sqs, filaUrl, async (e) => vistos.push(e.id))).processadas;
    assert.deepEqual(vistos.sort(), [1, 2]);
    await esperar(1500); // mais do que o VisibilityTimeout: se não tivessem sido apagadas, voltavam
    assert.equal(await contar(sqs, filaUrl), 0, 'as mensagens processadas deviam ter sido apagadas');
  });

  it('uma mensagem que falha sempre acaba na DLQ, sem bloquear as outras', async () => {
    const { sqs } = aws();
    const { filaUrl, dlqUrl } = await criarFilaComDlq(sqs, unico('eventos'), { maxRecebimentos: 2, visibilidade: 1 });
    await enviar(sqs, filaUrl, { id: 'boa' });
    await enviar(sqs, filaUrl, { id: 'venenosa' });
    const processar = async (e) => {
      if (e.id === 'venenosa') throw new Error('não sei tratar disto');
    };
    let falhadas = 0;
    for (let i = 0; i < 6; i++) {
      falhadas += (await processarLote(sqs, filaUrl, processar)).falhadas;
      await esperar(1200);
    }
    assert.equal(falhadas, 2, 'a venenosa devia ter falhado exatamente maxRecebimentos vezes');
    const naDlq = await sqs.send(new ReceiveMessageCommand({ QueueUrl: dlqUrl, MaxNumberOfMessages: 10, WaitTimeSeconds: 1 }));
    assert.deepEqual((naDlq.Messages ?? []).map((m) => JSON.parse(m.Body).id), ['venenosa']);
  });
});
